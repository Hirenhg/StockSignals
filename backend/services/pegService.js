const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 50 });

// 5-minute cache for live data
const cache = {};
const CACHE_TTL = 5 * 60 * 1000;

async function fetchStockFundamentals(symbol) {
  const cached = cache[symbol];
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;

  // Fetch price from Yahoo v8
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=1d`;
  const yr = await axios.get(yahooUrl, { timeout: 8000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const meta = yr.data?.chart?.result?.[0]?.meta || {};
  const price = meta.regularMarketPrice || 0;
  const prevClose = meta.chartPreviousClose || 0;
  const pChange = prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : null;

  // Fetch PE, dividend yield, market cap from Yahoo quoteSummary
  let pe = null, dividendYield = null, marketCap = null;
  try {
    const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}.NS?modules=summaryDetail`;
    const sr = await axios.get(summaryUrl, { timeout: 8000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const sd = sr.data?.quoteSummary?.result?.[0]?.summaryDetail || {};
    pe = sd.trailingPE?.raw || null;
    const dyRaw = sd.dividendYield?.raw;
    dividendYield = dyRaw != null ? parseFloat((dyRaw * 100).toFixed(2)) : null;
    const mcRaw = sd.marketCap?.raw;
    marketCap = mcRaw ? parseFloat((mcRaw / 1e7).toFixed(0)) : null;
  } catch {}

  const data = { price, prevClose, pChange, pe, dividendYield, marketCap };
  cache[symbol] = { data, time: Date.now() };
  return data;
}

// Fast price-only fetch via Yahoo v8 (no PE/div, ~50ms per stock)
async function fetchPriceOnly(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=1d`;
  const r = await axios.get(url, { timeout: 5000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const m = r.data?.chart?.result?.[0]?.meta;
  const price = m?.regularMarketPrice || 0;
  const prevClose = m?.chartPreviousClose || 0;
  const pChange = prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : null;
  return { price, prevClose, pChange };
}

module.exports = { fetchStockFundamentals, fetchPriceOnly };
