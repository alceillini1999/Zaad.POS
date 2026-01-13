let dotenvLoaded = false;
try { require('dotenv').config(); dotenvLoaded = true; } catch { console.log('dotenv not found — using host env only'); }

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
app.use(helmet());

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

// Health
app.get('/api/healthz', (req, res) =>
  res.json({ status:'ok', name:'zaad-bakery-backend', dotenvLoaded })
);

// Routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/pos', require('./routes/pos'));

// Google Sheets–backed routes
app.use('/api/products', require('./routes/products'));
app.use('/api/clients',  require('./routes/clients'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/sales',    require('./routes/sales'));

// ==== Upload support (ثابت + API) ====
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// تحمل إما CommonJS أو ESModule
const _uploadRouter = require('./routes/upload');
const uploadRouter = _uploadRouter?.default || _uploadRouter;
app.use('/api/upload', uploadRouter);   // المسار الجديد الذي تستخدمه الواجهة
app.use('/api/uploads', uploadRouter);  // مسار قديم للتوافق

// Static frontend
const distDir = path.join(__dirname, '../../frontend/dist');
const indexFile = path.join(distDir, 'index.html');
const hasDist = fs.existsSync(indexFile);
console.log('[STATIC] distDir =', distDir, 'hasDist =', hasDist);

if (hasDist) {
  app.use(express.static(distDir));
  const sendIndex = (req, res) => {
    try { res.sendFile(indexFile); }
    catch (e) { console.error('sendFile(index.html) failed:', e?.message || e); res.status(200).json({ status:'backend-live', note:'failed to serve index.html', error:true }); }
  };
  app.get('/', sendIndex);
  app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : sendIndex(req, res));
} else {
  app.get('/', (_req, res) => res.json({ status:'backend-live', note:'frontend/dist not found' }));
}

// Mongo
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/Zaad Bakery';
mongoose.connect(MONGO).then(() => {
  console.log('Mongo connected');
  ensureAdmin().catch(e => console.error('ensureAdmin failed:', e?.message || e));
}).catch(err => console.error('Mongo connection error:', err?.message || err));

// Bootstrap Admin
const User = require('./models/User');
async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass = process.env.ADMIN_PASSWORD;
  console.log('ENV check -> ADMIN_EMAIL:', !!adminEmail, 'ADMIN_PASSWORD:', !!adminPass);
  if (!adminEmail || !adminPass) { console.log('ADMIN_EMAIL or ADMIN_PASSWORD not provided — skipping admin bootstrap.'); return; }
  try {
    const exists = await User.findOne({ email: adminEmail.toLowerCase() });
    if (!exists) {
      const hash = await bcrypt.hash(adminPass, 10);
      await new User({ name:'Owner', email:adminEmail.toLowerCase(), passwordHash:hash, role:'owner' }).save();
      console.log('Created initial admin user:', adminEmail);
    } else { console.log('Admin user already exists.'); }
  } catch (err) { console.error('Admin creation error', err?.message || err); }
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
