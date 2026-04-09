const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'stocksignal-secret-key-2024';
const usersPath = path.join(__dirname, '../data/users');

if (!fs.existsSync(usersPath)) fs.mkdirSync(usersPath, { recursive: true });

function loginWithMobile(mobile) {
  if (!mobile || mobile.length < 10) return { success: false, error: 'Valid mobile number required' };
  const user = getOrCreateUser(mobile);
  const token = jwt.sign({ mobile, userId: user.id }, JWT_SECRET, { expiresIn: '365d' });
  return { success: true, token, user: { id: user.id, mobile: user.mobile, name: user.name } };
}

function getOrCreateUser(mobile) {
  const userFile = path.join(usersPath, `${mobile}.json`);
  if (fs.existsSync(userFile)) {
    return JSON.parse(fs.readFileSync(userFile, 'utf8'));
  }
  const user = {
    id: `user_${mobile}`,
    mobile,
    name: '',
    watchlist: [],
    wallet: { balance: 1000000, initialBalance: 1000000 },
    positions: [],
    trades: [],
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
  return user;
}

function getUserByMobile(mobile) {
  const userFile = path.join(usersPath, `${mobile}.json`);
  if (!fs.existsSync(userFile)) return null;
  return JSON.parse(fs.readFileSync(userFile, 'utf8'));
}

function updateUser(mobile, updates) {
  const userFile = path.join(usersPath, `${mobile}.json`);
  if (!fs.existsSync(userFile)) return null;
  const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));
  Object.assign(user, updates);
  fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
  return user;
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional auth — doesn't block, just attaches user if token present
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }
  next();
}

module.exports = { loginWithMobile, authMiddleware, optionalAuth, getUserByMobile, updateUser, getOrCreateUser };
