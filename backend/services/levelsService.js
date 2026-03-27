const axios = require('axios');
const https = require('https');
const { EMA } = require('technicalindicators');
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

function calcEma7(candles) {
  if (!candles || candles.length < 7) return { ema7: null, signal: null }
  const closes = candles.map(c => c.close);
  const emaValues = EMA.calculate({ period: 7, values: closes });
  const ema7 = emaValues.length ? parseFloat(emaValues[emaValues.length - 1].toFixed(2)) : null;
  const price = closes[closes.length - 1];
  let signal = null;
  if (ema7) {
    const prevClose = closes[closes.length - 2];
    const prevEma = emaValues.length >= 2 ? emaValues[emaValues.length - 2] : null;
    if (prevEma && prevClose <= prevEma && price > ema7) signal = 'Bullish';
    else if (prevEma && prevClose >= prevEma && price < ema7) signal = 'Bearish';
    else if (price > ema7) signal = 'Above';
    else signal = 'Below';
  }
  return { ema7, signal };
}

async function getLevels(symbol) {
  try {
    const [daily, weekly, monthly] = await Promise.all([
      fetchOHLC(symbol, '1d', '1mo'),
      fetchOHLC(symbol, '1wk', '3mo'),
      fetchOHLC(symbol, '1mo', '1y'),
    ]);
    if (!weekly || !monthly || weekly.candles.length < 2 || monthly.candles.length < 2) return null;
    if (!daily || daily.candles.length < 2) return null;

    const dc = daily.candles[daily.candles.length - 2];
    const wc = weekly.candles[weekly.candles.length - 2];
    const mc = monthly.candles[monthly.candles.length - 2];

    const dailyEma = calcEma7(daily.candles);
    const weeklyEma = calcEma7(weekly.candles);
    const monthlyEma = calcEma7(monthly.candles);

    return {
      symbol,
      price: parseFloat(daily.price.toFixed(2)),
      pChange: daily.pChange,
      daily: { ...calcPivots(dc.high, dc.low, dc.close), ...dailyEma },
      weekly: { ...calcPivots(wc.high, wc.low, wc.close), ...weeklyEma },
      monthly: { ...calcPivots(mc.high, mc.low, mc.close), ...monthlyEma },
    };
  } catch { return null; }
}

module.exports = { getLevels };
