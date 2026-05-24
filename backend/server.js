const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB bazasiga ulandik!"))
    .catch((err) => console.error("❌ Baza bilan ulanishda xato:", err));

// Database Schemas & Models
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true }
});
const Product = mongoose.model('Product', ProductSchema);

// Auth Middleware (Token Verification)
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

// --- API ROUTES ---

// 1. Foydalanuvchini ro'yxatdan o'tkazish (REGISTER)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Barcha maydonlarni to'ldiring!" });
        }

        const cleanUsername = username.trim();

        // Ism bandligini tekshirish (Case-Insensitive)
        const existingUser = await User.findOne({ 
            username: { $regex: new RegExp("^" + cleanUsername + "$", "i") } 
        });
        if (existingUser) {
            return res.status(400).json({ message: "Bu nom band, boshqasini tanlang!" });
        }

        // Parolni shifrlash
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({ username: cleanUsername, password: hashedPassword });
        await newUser.save();

        return res.status(201).json({ message: "Foydalanuvchi muvaffaqiyatli yaratildi!" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Serverda ichki xatolik yuz berdi!" });
    }
});

// 2. Tizimga kirish (LOGIN)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Barcha maydonlarni to'ldiring!" });
        }

        const cleanUsername = username.trim();

        // Foydalanuvchini bazadan qidirish (Case-Insensitive)
        const user = await User.findOne({ 
            username: { $regex: new RegExp("^" + cleanUsername + "$", "i") } 
        });
        if (!user) {
            return res.status(400).json({ message: "Foydalanuvchi topilmadi!" });
        }

        // Parolni tekshirish
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Noto'g'ri parol!" });
        }

        // Token berish (1 soat amal qiladi)
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        return res.json({ token, username: user.username });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Serverda ichki xatolik yuz berdi!" });
    }
});

// 3. Hamma mahsulotlarni olish (GET)
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        return res.json(products);
    } catch (err) {
        return res.status(500).json({ message: "Mahsulotlarni yuklashda xatolik!" });
    }
});

// 4. Yangi mahsulot qo'shish (POST - Himoyalangan)
app.post('/api/products', verifyToken, async (req, res) => {
    try {
        const { name, price, category } = req.body;
        if (!name || !price || !category) {
            return res.status(400).json({ message: "Ma'lumotlar to'liq emas!" });
        }

        const newProduct = new Product({ name, price: Number(price), category });
        await newProduct.save();
        
        return res.status(201).json(newProduct);
    } catch (err) {
        return res.status(500).json({ message: "Mahsulot qo'shishda xatolik!" });
    }
});

// 5. Mahsulotni o'chirish (DELETE - Himoyalangan)
app.delete('/api/products/:id', verifyToken, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        return res.json({ message: "Mahsulot o'chirildi!" });
    } catch (err) {
        return res.status(500).json({ message: "O'chirishda xatolik yuz berdi!" });
    }
});

// Server Port Settings
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend server ${PORT}-portda yonib turibdi...`));
