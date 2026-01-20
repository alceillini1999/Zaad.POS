const { verify } = require('../utils/jwt');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Authorization header missing' });
  const parts = header.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'Invalid Authorization header' });
  const token = parts[1];
  const payload = verify(token);
  if (!payload) return res.status(401).json({ message: 'Invalid token' });
  const user = await User.findById(payload.id).select('-passwordHash');
  if (!user) return res.status(401).json({ message: 'User not found' });
  req.user = user;
  next();
}

module.exports = authMiddleware;
