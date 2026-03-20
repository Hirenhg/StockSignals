const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'stocksignal-secret-key-2024';
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
const otpStore = new Map(); // mobile -> { otp, expires, attempts }
const usersPath = path.join(__dirname, '../data/users');

if (!fs.existsSync(usersPath)) fs.mkdirSync(usersPath, { recursive: true });

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendOTPViaTelegram(bot, chatId, mobile, otp) {
  if (!bot || !chatId) return false;
  const message = `🔐 *OTP Login*\n\nMobile: *${mobile}*\nOTP: *${otp}*\n\nValid for 5 minutes.`;
  try {
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    return true;
  } catch { return false; }
}

function requestOTP(mobile, bot, chatId) {
  if (!mobile || mobile.length < 10) return { success: false, error: 'Valid mobile number required' };

  const existing = otpStore.get(mobile);
  if (existing && Date.now() - existing.created < 30000) {
    return { success: false, error: 'Please wait 30 seconds before requesting again' };
  }

  const otp = generateOTP();
  otpStore.set(mobile, { otp, expires: Date.now() + OTP_EXPIRY, attempts: 0, created: Date.now() });

  const sent = sendOTPViaTelegram(bot, chatId, mobile, otp);
  console.log(`OTP for ${mobile}: ${otp}`);

  return { success: true, message: sent ? 'OTP sent via Telegram' : 'OTP generated (check console)' };
}

function verifyOTP(mobile, otp) {
  const stored = otpStore.get(mobile);
  if (!stored) return { success: false, error: 'No OTP requested. Please request OTP first.' };
  if (Date.now() > stored.expires) { otpStore.delete(mobile); return { success: false, error: 'OTP expired. Please request again.' }; }
  if (stored.attempts >= 3) { otpStore.delete(mobile); return { success: false, error: 'Too many attempts. Please request new OTP.' }; }

  stored.attempts++;

  if (stored.otp !== otp) return { success: false, error: 'Invalid OTP' };

  otpStore.delete(mobile);

  // Create/get user
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

module.exports = { requestOTP, verifyOTP, authMiddleware, optionalAuth, getUserByMobile, updateUser, getOrCreateUser };
