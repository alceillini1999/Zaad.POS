const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

function sign(payload, opts) {
  return jwt.sign(payload, JWT_SECRET, Object.assign({ expiresIn: '7d' }, opts));
}

function verify(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { sign, verify };
