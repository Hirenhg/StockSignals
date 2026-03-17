const TelegramBot = require('node-telegram-bot-api');

let bot = null;
let chatId = null;
const sentSignals = new Map();
const SIGNAL_COOLDOWN = 1200000;

function initTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chat) return false;
  
  bot = new TelegramBot(token, { polling: false });
  chatId = chat;
  return true;
}

async function sendWithRetry(message, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return true;
    } catch (error) {
      const isNetworkError = ['ECONNRESET', 'ETIMEDOUT', 'EFATAL', 'ENOTFOUND', 'EAI_AGAIN'].some(
        code => error.message?.includes(code) || error.code === code
      );
      if (isNetworkError && i < retries - 1) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      } else {
        throw error;
      }
    }
  }
  return false;
}

async function sendSignal(symbol, signal, price) {
  if (!bot || !chatId) return;
  
  const signalKey = `${symbol}-${signal}`;
  const now = Date.now();
  if (sentSignals.get(signalKey) && (now - sentSignals.get(signalKey)) < SIGNAL_COOLDOWN) return;
  
  const emoji = signal === 'BUY' ? '🟢' : signal === 'SELL' ? '🔴' : '🟡';
  const message = `${emoji} *${signal}* Signal\n\nSymbol: *${symbol}*\nPrice: ₹${price}`;
  
  try {
    await sendWithRetry(message);
    sentSignals.set(signalKey, now);
  } catch (error) {
    // Network errors (ISP blocking Telegram) - silent in dev
  }
}

async function sendBulkSignals(signals) {
  if (!bot || !chatId) return;
  
  const now = Date.now();
  
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
    buySignals.forEach(s => message += `*${s.symbol}* - ₹${s.price}\n`);
    message += '\n';
  }
  
  if (sellSignals.length > 0) {
    message += `🔴 *SELL Signals (${sellSignals.length})*\n\n`;
    sellSignals.forEach(s => message += `*${s.symbol}* - ₹${s.price}\n`);
  }
  
  try {
    await sendWithRetry(message);
    buySignals.forEach(s => sentSignals.set(`${s.symbol}-${s.signal}`, now));
    sellSignals.forEach(s => sentSignals.set(`${s.symbol}-${s.signal}`, now));
    
    for (const [key, timestamp] of sentSignals.entries()) {
      if (now - timestamp > SIGNAL_COOLDOWN) sentSignals.delete(key);
    }
  } catch (error) {
    // Network errors (ISP blocking Telegram) - silent in dev
  }
}

module.exports = { initTelegram, sendSignal, sendBulkSignals };
