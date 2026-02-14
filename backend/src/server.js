let dotenvLoaded = false;
try { require('dotenv').config(); dotenvLoaded = true; } catch { console.log('dotenv not found — using host env only'); }

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { pathToFileURL } = require('url');

const app = express();
// Render/Proxies: trust the first proxy so secure cookies & IP work correctly
app.set('trust proxy', 1);
app.use(helmet());

// ✅ حمّل Router سواء كان CommonJS أو ESModule (مضمون)
async function loadRouter(p) {
  try {
    const mod = require(p);
    return mod?.default || mod;
  } catch (e) {
    // لو الملف ESModule، استعمل dynamic import
    const resolved = require.resolve(p, { paths: [__dirname] });
    const mod = await import(pathToFileURL(resolved).href);
    return mod?.default || mod;
  }
}

// CORS
const defaultAllow = 'https://zaad-bakery.onrender.com,https://zaad-bakery-site.onrender.com,http://localhost:5173';
const allowlist = (process.env.CORS_ALLOWLIST || defaultAllow).split(',').map(s => s.trim()).filter(Boolean);
app.use((req,res,next)=>{ res.setHeader('Vary','Origin'); next(); });
app.use(cors({
  origin(origin, cb){
    if (!origin) return cb(null, true);
    try {
      const hostname = new URL(origin).hostname;
      if (allowlist.includes(origin)) return cb(null, true);
      if (/\.onrender\.com$/.test(hostname)) return cb(null, true);
    } catch {}
    return cb(new Error('Not allowed by CORS'));
  },
  credentials:true,
  methods:['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders:['Content-Type','Authorization']
}));
app.options('*', cors());

// JSON
app.use(express.json());

// Cookies (for httpOnly auth)
app.use(cookieParser());

// Health
app.get('/api/healthz', (req, res) =>
  res.json({ status:'ok', name:'zaad-bakery-backend', dotenvLoaded })
);

(async () => {
  // Routers (✅ الآن تحميل ESModule مضمون)
  app.use('/api/auth',     await loadRouter('./routes/auth'));
  app.use('/api/whatsapp', await loadRouter('./routes/whatsapp'));
  app.use('/api/uploads',  await loadRouter('./routes/uploads'));
  app.use('/api/stats',    await loadRouter('./routes/stats'));
  app.use('/api/pos',      await loadRouter('./routes/pos'));

  // Google Sheets–backed routes
  app.use('/api/products', await loadRouter('./routes/products'));
  app.use('/api/clients',  await loadRouter('./routes/clients'));
  app.use('/api/expenses', await loadRouter('./routes/expenses'));
  app.use('/api/sales',    await loadRouter('./routes/sales'));

  // ✅ Delivery Orders (unpaid) -> mark paid -> normal sale
  app.use('/api/delivery', await loadRouter('./routes/delivery'));

  // ✅ NEW: Cash routes (Start Day / End Day)
  app.use('/api/cash',     await loadRouter('./routes/cash'));
  app.use('/api/manual-withdrawals', await loadRouter('./routes/manualWithdrawals'));
  app.use('/api/transfers', await loadRouter('./routes/transfers'));

  // ==== Upload support (ثابت + API) ====
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  const uploadRouter = await loadRouter('./routes/upload');
  app.use('/api/upload', uploadRouter);
  app.use('/api/uploads', uploadRouter);

  // ✅ لو أي /api route غير موجود -> رجّع JSON (لتجنب HTML)
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found', method: req.method, path: req.originalUrl });
  });

  // Static frontend
  const distDir = path.join(__dirname, '../../frontend/dist');
  const indexFile = path.join(distDir, 'index.html');
  const hasDist = fs.existsSync(indexFile);
  console.log('[STATIC] distDir =', distDir, 'hasDist =', hasDist);

  if (hasDist) {
    app.use(express.static(distDir));
    const sendIndex = (req, res) => {
      try { res.sendFile(indexFile); }
      catch (e) {
        console.error('sendFile(index.html) failed:', e?.message || e);
        res.status(200).json({ status:'backend-live', note:'failed to serve index.html', error:true });
      }
    };
    app.get('/', sendIndex);
    app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : sendIndex(req, res));
  } else {
    app.get('/', (_req, res) => res.json({ status:'backend-live', note:'frontend/dist not found' }));
  }

  // ✅ Mongo (اختياري)
  const MONGO_URI = process.env.MONGO_URI;
  if (MONGO_URI) {
    mongoose.connect(MONGO_URI).then(() => {
      console.log('Mongo connected');
      ensureAdmin().catch(e => console.error('ensureAdmin failed:', e?.message || e));
    }).catch(err => console.error('Mongo connection error:', err?.message || err));
  } else {
    console.log('Mongo disabled: MONGO_URI not set (Google Sheets mode).');
  }

  // Bootstrap Admin (يعمل فقط إذا كان Mongo مفعّل + بيانات الأدمن موجودة)
  let User;
  try { User = require('./models/User'); } catch {}
  async function ensureAdmin() {
    if (!MONGO_URI || !User) return;

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPass = process.env.ADMIN_PASSWORD;
    console.log('ENV check -> ADMIN_EMAIL:', !!adminEmail, 'ADMIN_PASSWORD:', !!adminPass);

    if (!adminEmail || !adminPass) {
      console.log('ADMIN_EMAIL or ADMIN_PASSWORD not provided — skipping admin bootstrap.');
      return;
    }

    try {
      const exists = await User.findOne({ email: adminEmail.toLowerCase() });
      if (!exists) {
        const hash = await bcrypt.hash(adminPass, 10);
        await new User({ name:'Owner', email:adminEmail.toLowerCase(), passwordHash:hash, role:'owner' }).save();
        console.log('Created initial admin user:', adminEmail);
      } else {
        console.log('Admin user already exists.');
      }
    } catch (err) {
      console.error('Admin creation error', err?.message || err);
    }
  }

  // Start
  const PORT = process.env.PORT ? parseInt(process.env.PORT,10) : 5000;
  app.listen(PORT, () => {
    console.log(`Server started and listening on port ${PORT}`);
    console.log('NODE_ENV=', process.env.NODE_ENV || 'development');

    setTimeout(async () => {
      try {
        const whatsappService = require('./services/whatsappService');
        if (whatsappService?.start) await whatsappService.start();
        console.log('WhatsApp start attempted.');
      } catch (err) { console.error('WhatsApp start error:', err?.message || err); }
    }, 2000);
  });
})();
