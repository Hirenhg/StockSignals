const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function fetchOHLC(symbol, interval, range) {
  const skipNS = symbol.startsWith('^') || symbol.includes('-') || symbol.includes('=');
  const fullSymbol = skipNS ? symbol : `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(fullSymbol)}?range=${range}&interval=${interval}`;
  const r = await axios.get(url, {
    timeout: 10000, httpsAgent: agent,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const result = r.data?.chart?.result?.[0];
  if (!result) return null;
  const q = result.indicators.quote[0];
  const meta = result.meta;
  const len = q.close.length;
  const candles = [];
  for (let i = 0; i < len; i++) {
    if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null) {
      candles.push({ open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] });
    }
  }
  const price = meta.regularMarketPrice || (candles.length ? candles[candles.length - 1].close : 0);
  const prevClose = meta.chartPreviousClose || 0;
  const pChange = prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : null;
  return { candles, price, prevClose, pChange };
}

function calcPivots(h, l, c) {
  const pp = (h + l + c) / 3;
  const range = h - l;
  return {
    r3: parseFloat((pp + range * 1.000).toFixed(2)),
    r2: parseFloat((pp + range * 0.618).toFixed(2)),
    r1: parseFloat((pp + range * 0.382).toFixed(2)),
    pp: parseFloat(pp.toFixed(2)),
    s1: parseFloat((pp - range * 0.382).toFixed(2)),
    s2: parseFloat((pp - range * 0.618).toFixed(2)),
    s3: parseFloat((pp - range * 1.000).toFixed(2)),
    prevHigh: parseFloat(h.toFixed(2)),
    prevLow: parseFloat(l.toFixed(2)),
    prevClose: parseFloat(c.toFixed(2)),
  };
}

async function getLevels(symbol) {
  try {
    const [weekly, monthly] = await Promise.all([
      fetchOHLC(symbol, '1wk', '3mo'),
      fetchOHLC(symbol, '1mo', '1y'),
    ]);
    if (!weekly || !monthly || weekly.candles.length < 2 || monthly.candles.length < 2) return null;

    // Use previous completed candle for pivots
    const wc = weekly.candles[weekly.candles.length - 2];
    const mc = monthly.candles[monthly.candles.length - 2];

    return {
      symbol,
      price: parseFloat(weekly.price.toFixed(2)),
      pChange: weekly.pChange,
      weekly: calcPivots(wc.high, wc.low, wc.close),
      monthly: calcPivots(mc.high, mc.low, mc.close),
    };
  } catch { return null; }
}

module.exports = { getLevels };
