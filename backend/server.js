// server.js
// 1. Kerakli kutubxonalarni loyihaga chaqirib olamiz (Import)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config(); // .env faylidagi o'zgaruvchilarni o'qish uchun

const app = express();

// 2. Middleware-larni sozlaymiz
app.use(cors()); // Boshqa domenlardan keladigan so'rovlarga ruxsat berish
app.use(express.json()); // Serverga kelayotgan JSON ma'lumotlarni o'qiy olish formatiga keltirish

// 3. MongoDB bazasiga ulanish
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB bazasiga ulandik!"))
    .catch((err) => console.error("❌ Baza bilan ulanishda xato:", err));

// 4. Ma'lumotlar sxemasini tuzamiz (Database Schemas)
// Foydalanuvchilar jadvali tuzilishi
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// Mahsulotlar jadvali tuzilishi
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true }
});
const Product = mongoose.model('Product', ProductSchema);

// 5. Auth Middleware (Tokenni tekshirish funksiyasi)
// Bu funksiya maxfiy sahifalarga kirayotganda foydalanuvchida token borligini tekshiradi
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Headerdan tokenni ajratib olish
    if (!token) return res.status(401).json({ message: "Kirish taqiqlangan, token yo'q!" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId; // Token ichidagi foydalanuvchi ID-sini so'rovga biriktirish
        next(); // Keyingi bosqichga o'tishga ruxsat
    } catch (err) {
        res.status(403).json({ message: "Yaroqsiz yoki eskirgan token!" });
    }
};

// 6. API Yo'nalishlari (Routes)

// Regstratsiya (Ro'yxatdan o'tish)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Parolni shifrlaymiz (10 darajali xavfsizlik bilan)
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save(); // Bazaga saqlash
        res.status(201).json({ message: "Foydalanuvchi muvaffaqiyatli yaratildi!" });
    } catch (err) {
        res.status(400).json({ message: "Bu nom band, boshqa nom tanlang!" });
    }
});

// Login (Tizimga kirish)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Foydalanuvchi topilmadi!" });

    // Kiritilgan parolni bazadagi shifrlangan parol bilan solishtirish
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Noto'g'ri parol!" });

    // Foydalanuvchiga 1 soat amal qiladigan token beramiz
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, username });
});

// Hamma mahsulotlarni olish (Hamma ko'ra oladi)
app.get('/api/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

// Yangi mahsulot qo'shish (Faqat tizimga kirganlar uchun - verifyToken bor)
app.post('/api/products', verifyToken, async (req, res) => {
    try {
        const { name, price, category, date } = req.body;
        const newProduct = new Product({ name, price, category });
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ message: "Mahsulot qo'shishda xatolik!" });
    }
});

// Mahsulotni o'chirish (Faqat tizimga kirganlar uchun)
app.delete('/api/products/:id', verifyToken, async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Mahsulot o'chirildi!" });
});

// 7. Serverni portga qo'yish
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend server ${PORT}-portda yonib turibdi...`));
