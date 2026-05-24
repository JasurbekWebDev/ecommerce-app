// 1. Eng birinchi .env faylini o'qiymiz
require('dotenv').config(); 

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware sozlamalari
app.use(cors());
app.use(express.json());

// ==========================================
// 🛠️ IKKALA BAZAGA PARALLEL ULANISH TIZIMI
// ==========================================
const localConn = mongoose.createConnection(process.env.LOCAL_MONGO_URI);
const atlasConn = mongoose.createConnection(process.env.ATLAS_MONGO_URI);

localConn.on('connected', () => console.log("✅ 1/2: Lokal MongoDB-ga ulandik!"));
localConn.on('error', (err) => console.error("❌ Lokal bazada xato:", err));

atlasConn.on('connected', () => console.log("✅ 2/2: Bulutli MongoDB Atlas-ga ulandik!"));
atlasConn.on('error', (err) => console.error("❌ Atlas bazasida xato:", err));

// ==========================================
// 📊 DATABASE SCHEMAS & MODELS
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

// Modellarni ikkala alohida ulanishga bog'laymiz
const LocalUser = localConn.model('User', UserSchema);
const AtlasUser = atlasConn.model('User', UserSchema);

const LocalProduct = localConn.model('Product', ProductSchema);
const AtlasProduct = atlasConn.model('Product', ProductSchema);

// ==========================================
// 🚦 AUTH MIDDLEWARE (TOKEN TEKSHIRISH)
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
// 🚀 API ROUTES (PARALLEL SAQLASH)
// ==========================================

// 1. RO'YXATDAN O'TISH (REGISTER)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Barcha maydonlarni to'ldiring!" });
        }

        const cleanUsername = username.trim();

        // Lokal bazadan bandlikni tekshiramiz
        const existingUser = await LocalUser.findOne({ 
            username: { $regex: new RegExp("^" + cleanUsername + "$", "i") } 
        });
        if (existingUser) {
            return res.status(400).json({ message: "Bu nom band, boshqasini tanlang!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Bir vaqtning o'zida ikkala bazaga ham saqlaymiz
        const newLocalUser = new LocalUser({ username: cleanUsername, password: hashedPassword });
        const savedLocal = await newLocalUser.save();

        const newAtlasUser = new AtlasUser({ _id: savedLocal._id, username: cleanUsername, password: hashedPassword });
        await newAtlasUser.save();

        return res.status(201).json({ message: "Foydalanuvchi ikkala bazada ham yaratildi!" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Serverda ichki xatolik yuz berdi!" });
    }
});

// 2. TIZIMGA KIRISH (LOGIN)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Barcha maydonlarni to'ldiring!" });
        }

        const cleanUsername = username.trim();

        // Lokal bazadan foydalanuvchini tekshiramiz
        const user = await LocalUser.findOne({ 
            username: { $regex: new RegExp("^" + cleanUsername + "$", "i") } 
        });
        if (!user) {
            return res.status(400).json({ message: "Foydalanuvchi topilmadi!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Noto'g'ri parol!" });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token, username: user.username });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Serverda ichki xatolik yuz berdi!" });
    }
});

// 3. MAHSULOTLARNI OLISH (GET)
app.get('/api/products', async (req, res) => {
    try {
        // Tezroq ishlashi uchun lokal bazadan o'qiydi
        const products = await LocalProduct.find();
        return res.json(products);
    } catch (err) {
        return res.status(500).json({ message: "Mahsulotlarni yuklashda xatolik!" });
    }
});

// 4. YANGI MAHSULOT QO'SHISH (POST)
app.post('/api/products', verifyToken, async (req, res) => {
    try {
        const { name, price, category } = req.body;
        if (!name || !price || !category) {
            return res.status(400).json({ message: "Ma'lumotlar to'liq emas!" });
        }

        // Ikkala bazaga parallel saqlash
        const newLocalProduct = new LocalProduct({ name, price: Number(price), category });
        const savedLocal = await newLocalProduct.save();

        const newAtlasProduct = new AtlasProduct({ _id: savedLocal._id, name, price: Number(price), category });
        await newAtlasProduct.save();
        
        return res.status(201).json(savedLocal);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Mahsulot qo'shishda xatolik!" });
    }
});

// 5. MAHSULOTNI O'CHIRISH (DELETE)
app.delete('/api/products/:id', verifyToken, async (req, res) => {
    try {
        // Ikkala bazadan parallel o'chirish
        await LocalProduct.findByIdAndDelete(req.params.id);
        await AtlasProduct.findByIdAndDelete(req.params.id);
        return res.json({ message: "Mahsulot o'chirildi!" });
    } catch (err) {
        return res.status(500).json({ message: "O'chirishda xatolik yuz berdi!" });
    }
});

// Serverni portga qo'yish
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend server ${PORT}-portda yonib turibdi...`));
