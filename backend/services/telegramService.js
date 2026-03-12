const TelegramBot = require('node-telegram-bot-api');

let bot = null;
let chatId = null;
const sentSignals = new Map(); // Track sent signals
const SIGNAL_COOLDOWN = 3600000; // 1 hour in milliseconds

function initTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chat) {
    console.log('Telegram not configured');
    return false;
  }
  
  bot = new TelegramBot(token, { polling: false });
  chatId = chat;
  return true;
}

async function sendSignal(symbol, signal, price, rsi, ema5, ema10, ema15, ema20) {
  if (!bot || !chatId) return;
  
  // Check if signal was recently sent
  const signalKey = `${symbol}-${signal}`;
  const lastSent = sentSignals.get(signalKey);
  const now = Date.now();
  
  if (lastSent && (now - lastSent) < SIGNAL_COOLDOWN) {
    return; // Skip duplicate
  }
  
  const emoji = signal === 'BUY' ? '🟢' : signal === 'SELL' ? '🔴' : '🟡';
  const message = `${emoji} *${signal}* Signal\n\n` +
    `Symbol: *${symbol}*\n` +
    `Price: ₹${price}\n` +
    `RSI: ${rsi}\n` +
    `EMA5: ₹${ema5}\n` +
    `EMA10: ₹${ema10}\n` +
    `EMA15: ₹${ema15}\n` +
    `EMA20: ₹${ema20}`;
  
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    sentSignals.set(signalKey, now); // Mark as sent
    
    // Cleanup old entries
    for (const [key, timestamp] of sentSignals.entries()) {
      if (now - timestamp > SIGNAL_COOLDOWN) {
        sentSignals.delete(key);
      }
    }
  } catch (error) {
    console.error('Telegram send error:', error.message);
  }
}

async function sendBulkSignals(signals) {
  if (!bot || !chatId) return;
  
  const now = Date.now();
  
  // Filter out recently sent signals
  const buySignals = signals.filter(s => {
    const key = `${s.symbol}-${s.signal}`;
    const lastSent = sentSignals.get(key);
    return s.signal === 'BUY' && (!lastSent || (now - lastSent) >= SIGNAL_COOLDOWN);
  });
  
  const sellSignals = signals.filter(s => {
    const key = `${s.symbol}-${s.signal}`;
    const lastSent = sentSignals.get(key);
    return s.signal === 'SELL' && (!lastSent || (now - lastSent) >= SIGNAL_COOLDOWN);
  });
  
  if (buySignals.length === 0 && sellSignals.length === 0) return;
  
  let message = '📊 *Trading Signals Update*\n\n';
  
  if (buySignals.length > 0) {
    message += `🟢 *BUY Signals (${buySignals.length})*\n\n`;
    buySignals.forEach(s => {
      message += `*${s.symbol}*\n`;
      message += `Price: ₹${s.price} | RSI: ${s.rsi}\n`;
      message += `EMA5: ₹${s.ema5} | EMA10: ₹${s.ema10}\n`;
      message += `EMA15: ₹${s.ema15} | EMA20: ₹${s.ema20}\n\n`;
      sentSignals.set(`${s.symbol}-${s.signal}`, now);
    });
  }
  
  if (sellSignals.length > 0) {
    message += `🔴 *SELL Signals (${sellSignals.length})*\n\n`;
    sellSignals.forEach(s => {
      message += `*${s.symbol}*\n`;
      message += `Price: ₹${s.price} | RSI: ${s.rsi}\n`;
      message += `EMA5: ₹${s.ema5} | EMA10: ₹${s.ema10}\n`;
      message += `EMA15: ₹${s.ema15} | EMA20: ₹${s.ema20}\n\n`;
      sentSignals.set(`${s.symbol}-${s.signal}`, now);
    });
  }
  
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
    // Cleanup old entries
    for (const [key, timestamp] of sentSignals.entries()) {
      if (now - timestamp > SIGNAL_COOLDOWN) {
        sentSignals.delete(key);
      }
    }
  } catch (error) {
    console.error('Telegram send error:', error.message);
  }
}

module.exports = { initTelegram, sendSignal, sendBulkSignals };
