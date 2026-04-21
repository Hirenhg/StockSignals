const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 50 });

// 5-minute cache for live data
const cache = {};
const CACHE_TTL = 5 * 60 * 1000;

async function fetchStockFundamentals(symbol) {
  const cached = cache[symbol];
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;

  const url = `https://www.google.com/finance/quote/${encodeURIComponent(symbol)}:NSE`;
  const r = await axios.get(url, {
    timeout: 8000, httpsAgent: agent,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const h = r.data;

  const price = parseFloat(h.match(/data-last-price="([\d.]+)"/)?.[1]) || 0;

  const g = (label) => {
    const re = new RegExp(label + '<\\/div>[\\s\\S]*?class="P6K39c">([^<]+)');
    return h.match(re)?.[1]?.replace(/[₹,]/g, '').trim() || null;
  };

  const prevClose = parseFloat(g('Previous close')) || 0;
  const pe = parseFloat(g('P\\/E ratio')) || null;
  const divRaw = g('Dividend yield');
  const dividendYield = divRaw ? parseFloat(divRaw) : null;

  const mktCapRaw = g('Market cap');
  let marketCap = null;
  if (mktCapRaw) {
    const v = parseFloat(mktCapRaw);
    if (mktCapRaw.includes('T')) marketCap = parseFloat((v * 1e12 / 1e7).toFixed(0));      // T → Cr
    else if (mktCapRaw.includes('B')) marketCap = parseFloat((v * 1e9 / 1e7).toFixed(0));  // B → Cr
    else if (mktCapRaw.includes('M')) marketCap = parseFloat((v * 1e6 / 1e7).toFixed(0));  // M → Cr
    else marketCap = parseFloat((v / 1e7).toFixed(0));
  }

  const pChange = prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : null;

  const data = { price, prevClose, pChange, pe, dividendYield, marketCap };
  cache[symbol] = { data, time: Date.now() };
  return data;
}

// Fast price-only fetch via Yahoo v8 (no PE/div, ~50ms per stock)
const yahooAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 50 });

async function fetchPriceOnly(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=1d`;
  const r = await axios.get(url, { timeout: 5000, httpsAgent: yahooAgent, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const m = r.data?.chart?.result?.[0]?.meta;
  const price = m?.regularMarketPrice || 0;
  const prevClose = m?.chartPreviousClose || 0;
  const pChange = prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : null;
  return { price, prevClose, pChange };
}

module.exports = { fetchStockFundamentals, fetchPriceOnly };
