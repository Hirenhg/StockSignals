const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

const NSE_BASE = 'https://www.nseindia.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

let cookies = '';
let cookieTime = 0;
const COOKIE_TTL = 3 * 60 * 1000;

async function refreshCookies() {
  if (cookies && Date.now() - cookieTime < COOKIE_TTL) return;
  try {
    const res = await axios.get(NSE_BASE, {
      httpsAgent: agent, headers: HEADERS, timeout: 10000, maxRedirects: 5,
    });
    const sc = res.headers['set-cookie'];
    if (sc) { cookies = sc.map(c => c.split(';')[0]).join('; '); cookieTime = Date.now(); }
  } catch {}
}

async function nseGet(url) {
  await refreshCookies();
  const res = await axios.get(url, {
    httpsAgent: agent, timeout: 10000,
    headers: { ...HEADERS, Cookie: cookies, Referer: NSE_BASE },
  });
  const sc = res.headers['set-cookie'];
  if (sc) { cookies = sc.map(c => c.split(';')[0]).join('; '); cookieTime = Date.now(); }
  return res.data;
}

// Fetch full quote + trade_info for a stock — returns buy/sell quantities
async function getStockBuyerSeller(symbol) {
  const [quote, tradeInfo] = await Promise.all([
    nseGet(`${NSE_BASE}/api/quote-equity?symbol=${encodeURIComponent(symbol)}`).catch(() => null),
    nseGet(`${NSE_BASE}/api/quote-equity?symbol=${encodeURIComponent(symbol)}&section=trade_info`).catch(() => null),
  ]);

  const priceInfo = quote?.priceInfo || {};
  const mkt = tradeInfo?.marketDeptOrderBook || {};
  const preOpen = quote?.preOpenMarket || {};

  // During market hours: use marketDeptOrderBook. After hours: fallback to preOpenMarket
  let buyQty = mkt.totalBuyQuantity || 0;
  let sellQty = mkt.totalSellQuantity || 0;
  if (buyQty === 0 && sellQty === 0) {
    buyQty = preOpen.totalBuyQuantity || 0;
    sellQty = preOpen.totalSellQuantity || 0;
  }

  return {
    symbol,
    lastPrice: priceInfo.lastPrice || 0,
    pChange: priceInfo.pChange || 0,
    totalBuyQuantity: buyQty,
    totalSellQuantity: sellQty,
    totalTradedVolume: tradeInfo?.securityWiseDP?.quantityTraded || mkt?.tradeInfo?.totalTradedVolume || 0,
    yearHigh: priceInfo.weekHighLow?.max || null,
    yearLow: priceInfo.weekHighLow?.min || null,
  };
}

// Fetch index stocks (bulk — no buy/sell qty available here)
async function getIndexStocks(indexName) {
  const data = await nseGet(`${NSE_BASE}/api/equity-stockIndices?index=${encodeURIComponent(indexName)}`);
  return data?.data || [];
}

module.exports = { getStockBuyerSeller, getIndexStocks, refreshCookies };
