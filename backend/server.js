require('dotenv').config(); 

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🛠️ IKKALA BAZAGA XAVFSIZ PARALLEL ULANISH
// ==========================================
const localConn = mongoose.createConnection(process.env.LOCAL_MONGO_URI);
const atlasConn = mongoose.createConnection(process.env.ATLAS_MONGO_URI);

localConn.on('connected', () => console.log("✅ 1/2: Lokal MongoDB tayyor."));
localConn.on('error', (err) => console.log("⚠️ Lokal bazada ulanish kechikmoqda..."));

atlasConn.on('connected', () => console.log("✅ 2/2: Bulutli MongoDB Atlas tayyor."));
atlasConn.on('error', (err) => console.log("⚠️ Internet uzilgan: Atlas-ga ulanish to'xtatildi, lokal rejim faol."));

// ==========================================
// 📊 SCHEMAS & MODELS
// ==========================================
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true }
});

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true }
});

const LocalUser = localConn.model('User', UserSchema);
const AtlasUser = atlasConn.model('User', UserSchema);

const LocalProduct = localConn.model('Product', ProductSchema);
const AtlasProduct = atlasConn.model('Product', ProductSchema);

// ==========================================
// 🚦 AUTH MIDDLEWARE
// ==========================================
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ message: "Kirish taqiqlangan, token yo'q!" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(403).json({ message: "Yaroqsiz yoki eskirgan token!" });
    }
};

// ==========================================
// 🚀 API ROUTES (AQLLI PARALLEL SAQLASH)
// ==========================================

// 1. RO'YXATDAN O'TISH (REGISTER)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Barcha maydonlarni to'ldiring!" });
        }

        const cleanUsername = username.trim();

        // Bandlikni lokal bazadan tekshirish
        const existingUser = await LocalUser.findOne({ 
            username: { $regex: new RegExp("^" + cleanUsername + "$", "i") } 
        });
        if (existingUser) {
            return res.status(400).json({ message: "Bu nom band, boshqasini tanlang!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // 🔥 AQLLI PARALLEL SAQLASH: Internet bo'lsa Atlasga ham yozadi, bo'lmasa saytni qulashdan asraydi
        const newLocalUser = new LocalUser({ username: cleanUsername, password: hashedPassword });
        const savedLocal = await newLocalUser.save();

        if (atlasConn.readyState === 1) { // Agar Atlas internetga ulangan bo'lsa
            try {
                const newAtlasUser = new AtlasUser({ _id: savedLocal._id, username: cleanUsername, password: hashedPassword });
                await newAtlasUser.save();
                console.log("☁️ Ma'lumot parallel ravishda Atlas-ga ham yozildi.");
            } catch (atlasErr) {
                console.log("⚠️ Atlas-ga yozishda kechikish bo'ldi, lekin lokal saqlandi.");
            }
        }

        return res.status(201).json({ message: "Foydalanuvchi muvaffaqiyatli yaratildi!" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Serverda muammo yuz berdi!" });
    }
});

// 2. TIZIMGA KIRISH (LOGIN)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUsername = username.trim();

        const user = await LocalUser.findOne({ 
            username: { $regex: new RegExp("^" + cleanUsername + "$", "i") } 
        });
        if (!user) return res.status(400).json({ message: "Foydalanuvchi topilmadi!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Noto'g'ri parol!" });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token, username: user.username });
    } catch (err) {
        return res.status(500).json({ message: "Server xatosi!" });
    }
});

// 3. MAHSULOTLARNI OLISH (GET)
app.get('/api/products', async (req, res) => {
    try {
        const products = await LocalProduct.find();
        return res.json(products);
    } catch (err) {
        return res.status(500).json({ message: "Xatolik!" });
    }
});

// 4. YANGI MAHSULOT QO'SHISH (POST)
app.post('/api/products', verifyToken, async (req, res) => {
    try {
        const { name, price, category } = req.body;

        const newLocalProduct = new LocalProduct({ name, price: Number(price), category });
        const savedLocal = await newLocalProduct.save();

        if (atlasConn.readyState === 1) { // Internet bor bo'lsa Atlasga parallel yozish
            try {
                const newAtlasProduct = new AtlasProduct({ _id: savedLocal._id, name, price: Number(price), category });
                await newAtlasProduct.save();
            } catch (e) {
                console.log("⚠️ Mahsulot bulutga yuklanmadi, lekin kompyuterda saqlandi.");
            }
        }

        return res.status(201).json(savedLocal);
    } catch (err) {
        return res.status(500).json({ message: "Xatolik!" });
    }
});

// 5. MAHSULOTNI O'CHIRISH (DELETE)
app.delete('/api/products/:id', verifyToken, async (req, res) => {
    try {
        await LocalProduct.findByIdAndDelete(req.params.id);
        
        if (atlasConn.readyState === 1) {
            try { await AtlasProduct.findByIdAndDelete(req.params.id); } catch(e) {}
        }
        return res.json({ message: "O'chirildi!" });
    } catch (err) {
        return res.status(500).json({ message: "Xatolik!" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda barqaror ishlamoqda...`));
