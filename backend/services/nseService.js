const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

// ===== NSE INDIA (Primary) =====
const NSE_BASE = 'https://www.nseindia.com';
const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
};

let cookies = '';
let cookieTime = 0;
const COOKIE_TTL = 2 * 60 * 1000;

async function refreshCookies(force = false) {
  if (!force && cookies && Date.now() - cookieTime < COOKIE_TTL) return;
  try {
    const res = await axios.get(NSE_BASE, {
      httpsAgent: agent, headers: NSE_HEADERS, timeout: 15000, maxRedirects: 5,
    });
    const sc = res.headers['set-cookie'];
    if (sc) { cookies = sc.map(c => c.split(';')[0]).join('; '); cookieTime = Date.now(); }
  } catch (e) {
    console.error('NSE cookie refresh failed:', e.message);
  }
}

async function nseGet(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await refreshCookies(attempt > 0);
      const res = await axios.get(url, {
        httpsAgent: agent, timeout: 15000,
        headers: { ...NSE_HEADERS, Cookie: cookies, Referer: NSE_BASE },
      });
      const sc = res.headers['set-cookie'];
      if (sc) { cookies = sc.map(c => c.split(';')[0]).join('; '); cookieTime = Date.now(); }
      return res.data;
    } catch (e) {
      if (attempt === retries) throw e;
      cookies = '';
      cookieTime = 0;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

// ===== GROWW (Fallback 1) =====
async function getFromGroww(symbol) {
  try {
    // Groww uses search to find the stock, then fetches market depth
    const searchRes = await axios.get(`https://groww.in/v1/api/search/v1/entity?app=false&entity_type=stock&page=0&q=${encodeURIComponent(symbol)}&size=1`, {
      httpsAgent: agent, timeout: 10000,
      headers: { 'User-Agent': NSE_HEADERS['User-Agent'] },
    });
    const stock = searchRes.data?.content?.[0];
    if (!stock || !stock.search_id) return null;

    const growwSymbol = stock.search_id;
    const [liveRes, depthRes] = await Promise.all([
      axios.get(`https://groww.in/v1/api/stocks_data/v1/accord_points/exchange/NSE/segment/CASH/latest_prices_ohlc/${growwSymbol}`, {
        httpsAgent: agent, timeout: 10000,
        headers: { 'User-Agent': NSE_HEADERS['User-Agent'] },
      }).catch(() => null),
      axios.get(`https://groww.in/v1/api/stocks_data/v1/accord_points/exchange/NSE/segment/CASH/market_depth/${growwSymbol}`, {
        httpsAgent: agent, timeout: 10000,
        headers: { 'User-Agent': NSE_HEADERS['User-Agent'] },
      }).catch(() => null),
    ]);

    const liveData = liveRes?.data;
    const depth = depthRes?.data;

    let buyQty = 0, sellQty = 0;
    if (depth?.buy) buyQty = depth.buy.reduce((sum, b) => sum + (b.quantity || 0), 0);
    if (depth?.sell) sellQty = depth.sell.reduce((sum, s) => sum + (s.quantity || 0), 0);

    return {
      symbol,
      lastPrice: liveData?.ltp || 0,
      pChange: liveData?.dayChangePerc || 0,
      totalBuyQuantity: buyQty,
      totalSellQuantity: sellQty,
      totalTradedVolume: liveData?.volume || 0,
      yearHigh: liveData?.high52 || null,
      yearLow: liveData?.low52 || null,
    };
  } catch (e) {
    return null;
  }
}

// ===== UPSTOX (Fallback 2) =====
async function getFromUpstox(symbol) {
  try {
    const res = await axios.get(`https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_EQ|${encodeURIComponent(symbol)}`, {
      httpsAgent: agent, timeout: 10000,
      headers: {
        'User-Agent': NSE_HEADERS['User-Agent'],
        'Accept': 'application/json',
      },
    });
    const data = res.data?.data?.[`NSE_EQ|${symbol}`];
    if (!data) return null;

    const depth = data.depth || {};
    let buyQty = 0, sellQty = 0;
    if (depth.buy) buyQty = depth.buy.reduce((sum, b) => sum + (b.quantity || 0), 0);
    if (depth.sell) sellQty = depth.sell.reduce((sum, s) => sum + (s.quantity || 0), 0);

    return {
      symbol,
      lastPrice: data.last_price || 0,
      pChange: data.net_change ? ((data.net_change / (data.last_price - data.net_change)) * 100) : 0,
      totalBuyQuantity: buyQty,
      totalSellQuantity: sellQty,
      totalTradedVolume: data.volume || 0,
      yearHigh: data.ohlc?.high || null,
      yearLow: data.ohlc?.low || null,
    };
  } catch {
    return null;
  }
}

// ===== MAIN: Fetch with fallback chain =====
async function getStockBuyerSeller(symbol) {
  // Try NSE first
  try {
    const [quote, tradeInfo] = await Promise.all([
      nseGet(`${NSE_BASE}/api/quote-equity?symbol=${encodeURIComponent(symbol)}`).catch(() => null),
      nseGet(`${NSE_BASE}/api/quote-equity?symbol=${encodeURIComponent(symbol)}&section=trade_info`).catch(() => null),
    ]);

    const priceInfo = quote?.priceInfo || {};
    const mkt = tradeInfo?.marketDeptOrderBook || {};
    const preOpen = quote?.preOpenMarket || {};

    let buyQty = mkt.totalBuyQuantity || 0;
    let sellQty = mkt.totalSellQuantity || 0;
    if (buyQty === 0 && sellQty === 0) {
      buyQty = preOpen.totalBuyQuantity || 0;
      sellQty = preOpen.totalSellQuantity || 0;
    }

    // If NSE returned valid data, use it
    if (buyQty > 0 || sellQty > 0) {
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
  } catch (e) {
    console.log(`NSE failed for ${symbol}: ${e.message}`);
  }

  // Fallback 1: Groww
  const growwData = await getFromGroww(symbol);
  if (growwData && (growwData.totalBuyQuantity > 0 || growwData.totalSellQuantity > 0)) {
    return growwData;
  }

  // Fallback 2: Upstox public API
  const upstoxData = await getFromUpstox(symbol);
  if (upstoxData && (upstoxData.totalBuyQuantity > 0 || upstoxData.totalSellQuantity > 0)) {
    return upstoxData;
  }

  // All sources failed — return zeros
  return {
    symbol,
    lastPrice: 0,
    pChange: 0,
    totalBuyQuantity: 0,
    totalSellQuantity: 0,
    totalTradedVolume: 0,
    yearHigh: null,
    yearLow: null,
  };
}

// Fetch index stocks (bulk)
async function getIndexStocks(indexName) {
  const data = await nseGet(`${NSE_BASE}/api/equity-stockIndices?index=${encodeURIComponent(indexName)}`);
  return data?.data || [];
}

module.exports = { getStockBuyerSeller, getIndexStocks, refreshCookies };
