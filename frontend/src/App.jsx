import { useState, useEffect, useCallback } from 'react';

// Asosiy API manzili (Backend manzili)
const API_URL = 'https://ecommerce-backend-app-c9bp.onrender.com';

function App() {
  // --- STATE-LAR (Ma'lumotlarni saqlash xotirasi) ---
  const [products, setProducts] = useState([]); // Mahsulotlar ro'yxati uchun
  const [name, setName] = useState(''); // Yangi mahsulot nomi inputi uchun
  const [price, setPrice] = useState(''); // Yangi mahsulot narxi inputi uchun
  const [category, setCategory] = useState(''); // Yangi mahsulot kategoriyasi inputi uchun

  // Auth (Tizimga kirish) xotirasi. Brauzer yopilib ochilganda ham eslab qolishi uchun localStorage ishlatamiz
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [authMode, setAuthMode] = useState('login'); // 'login' yoki 'register' rejimini almashtirish
  const [formUser, setFormUser] = useState(''); // Login inputi uchun
  const [formPass, setFormPass] = useState(''); // Parol inputi uchun

    // Hamma mahsulotlarni backenddan olib kelish funksiyasi (GET)
  const fetchProducts = useCallback(() => {
    fetch(`${API_URL}/products`)
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error("Mahsulotlarni yuklashda xato:", err));
  }, []);
  
  // --- EFFEKTLAR (Sahifa yuklanganda ishlaydigan kod) ---
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);



  // --- FUNKSIYALAR ---

  // Ro'yxatdan o'tish va Kirish funksiyasi (POST)
  const handleAuth = (e) => {
    e.preventDefault(); // Sahifa qayta yuklanib ketishini oldini oladi
    const endpoint = authMode === 'login' ? 'login' : 'register';

    fetch(`${API_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: formUser, password: formPass })
    })
    .then(res => res.json())
    .then(data => {
      if (data.token) {
        // Agar tizimga muvaffaqiyatli kirsak, token va ism brauzerga saqlanadi
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        setToken(data.token);
        setUsername(data.username);
        setFormUser(''); setFormPass('');
      } else {
        alert(data.message);
        if(authMode === 'register') setAuthMode('login'); // Registratsiyadan keyin loginga o'tkazish
      }
    });
  };

  // Tizimdan chiqish funksiyasi
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(''); setUsername('');
  };

  // Yangi mahsulot qo'shish funksiyasi (POST)
  const handleAddProduct = (e) => {
    e.preventDefault();
    fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // Tokenni header orqali yuboramiz (Xavfsizlik)
      },
      body: JSON.stringify({ name, price: Number(price), category })
    })
    .then(res => res.json())
    .then(data => {
      setProducts([...products, data]); // Yangi mahsulotni ro'yxatga qo'shish
      setName(''); setPrice(''); setCategory(''); // Formani tozalash
    });
  };

  // Mahsulotni o'chirish funksiyasi (DELETE)
  const handleDelete = (id) => {
    fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(() => {
      // O'chgan mahsulotni ekrandan ham olib tashlash
      setProducts(products.filter(p => p._id !== id));
    });
  };

  // --- INTERFEYS (Tailwind CSS bilan bezatilgan UI) ---
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans text-gray-800">
      
      {/* Yuqori Header Qismi */}
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-10 gap-4">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600">
          🛒 E-Commerce Global
        </h1>
        {token ? (
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium">Xush kelibsiz, <span className="text-blue-600 font-bold">{username}</span></p>
            <button onClick={handleLogout} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-sm">
              Chiqish
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400 font-medium">Mahsulot qo'shish yoki o'chirish uchun tizimga kiring</p>
        )}
      </header>

      {/* Asosiy Kontent Qismi */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chap blok: Autentifikatsiya yoki Mahsulot boshqaruvi */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
          {!token ? (
            <div>
              <h2 className="text-xl font-bold mb-4 text-gray-900">
                {authMode === 'login' ? 'Tizimga Kirish' : "Ro'yxatdan O'tish"}
              </h2>
              <form onSubmit={handleAuth} className="space-y-3">
                <input type="text" placeholder="Foydalanuvchi nomi" value={formUser} onChange={e => setFormUser(e.target.value)} className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition text-sm" required />
                <input type="password" placeholder="Parol" value={formPass} onChange={e => setFormPass(e.target.value)} className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition text-sm" required />
                <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition font-bold text-sm shadow-md shadow-blue-100">
                  {authMode === 'login' ? 'Tizimga Kirish' : "Hisob Yaratish"}
                </button>
              </form>
              <p onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs text-blue-500 text-center mt-4 cursor-pointer hover:underline font-medium">
                {authMode === 'login' ? "Yangi hisob yaratish" : "Menda hisob bor, kirish sahifasi"}
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold mb-4 text-gray-900">Yangi Mahsulot Qo'shish</h2>
              <form onSubmit={handleAddProduct} className="space-y-3">
                <input type="text" placeholder="Mahsulot nomi" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition text-sm" required />
                <input type="number" placeholder="Narxi ($ yoki so'm)" value={price} onChange={e => setPrice(e.target.value)} className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition text-sm" required />
                <input type="text" placeholder="Kategoriya (masalan: Elektronika)" value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition text-sm" required />
                <button type="submit" className="w-full bg-emerald-500 text-white p-3 rounded-xl hover:bg-emerald-600 transition font-bold text-sm shadow-md shadow-emerald-100">
                  Omborga Joylash
                </button>
              </form>
            </div>
          )}
        </div>

        {/* O'ng blok: Mahsulotlar vitrinasi (Ro'yxat) */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-black text-gray-900 mb-6">Sotuvdagi Mahsulotlar Ro'yxati</h2>
          {products.length === 0 ? (
            <p className="text-gray-400 bg-white p-6 rounded-2xl border text-center font-medium">Hozircha mahsulotlar yo'q. Birinchilardan bo'lib qo'shing!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map(product => (
                <div key={product._id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition group">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                      {product.category}
                    </span>
                    <h3 className="text-lg font-bold text-gray-800 mt-2 group-hover:text-blue-600 transition">{product.name}</h3>
                    <p className="text-xl font-black text-gray-900 mt-1">{product.price?.toLocaleString()} UZS</p>
                    <p className="text-xl font-black text-gray-900 mt-1">{product.date}</p>
                  </div>
                  {token && (
                    <button onClick={() => handleDelete(product._id)} className="mt-5 w-full bg-rose-50 text-rose-600 font-bold p-2.5 rounded-xl hover:bg-rose-500 hover:text-white transition text-center text-xs">
                      Mahsulotni o'chirish
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default App;
