const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const router = express.Router();

// مجلد الحفظ
const uploadDir = path.join(process.cwd(), 'uploads', 'whatsapp');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename:    (_, file, cb) => {
    const ext  = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const base = path.basename(file.originalname || 'image', ext).replace(/\s+/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const upload = multer({ storage });

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok:false, error:'No file uploaded' });

  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http');
  const host  = req.headers['x-forwarded-host']  || req.get('host');
  const publicPath = `/uploads/whatsapp/${req.file.filename}`;
  const url = `${proto}://${host}${publicPath}`;

  res.json({ ok:true, url, filename:req.file.filename });
});

module.exports = router;
