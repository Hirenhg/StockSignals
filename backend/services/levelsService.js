const axios = require('axios');
const https = require('https');
const { EMA, RSI } = require('technicalindicators');
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
      candles.push({ open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] || 0 });
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

function calcEmaFull(candles) {
  const closes = candles.map(c => c.close);
  const calc = (period) => {
    if (closes.length < period) return null;
    const vals = EMA.calculate({ period, values: closes });
    return vals.length ? parseFloat(vals[vals.length - 1].toFixed(2)) : null;
  };
  return { ema7: calc(7), ema50: calc(50), ema200: calc(200) };
}

function calcRSI(candles) {
  const closes = candles.map(c => c.close);
  if (closes.length < 15) return null;
  const vals = RSI.calculate({ period: 14, values: closes });
  return vals.length ? parseFloat(vals[vals.length - 1].toFixed(2)) : null;
}

function calcVolumeSignal(candles) {
  if (candles.length < 20) return 'Neutral';
  const vols = candles.map(c => c.volume || 0).filter(v => v > 0);
  if (vols.length < 10) return 'Neutral';
  const avgVol = vols.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, vols.length);
  const lastVol = vols[vols.length - 1];
  if (lastVol > avgVol * 1.5) return 'Good';
  if (lastVol < avgVol * 0.6) return 'Bad';
  return 'Neutral';
}

function calcStatus(price, ema7d, ema7w, ema7m, ema50d, ema200d, rsi) {
  let score = 0;
  if (ema7d && price > ema7d) score++;
  if (ema7w && price > ema7w) score++;
  if (ema7m && price > ema7m) score++;
  if (ema50d && price > ema50d) score++;
  if (ema200d && price > ema200d) score++;
  if (rsi && rsi > 60) score++;
  if (score >= 5) return 'Strong Buy';
  if (score === 4) return 'Momentum Buy';
  if (score === 3) return 'Buy on Dip';
  if (score === 2) return 'Strong Support';
  if (score === 1) return 'Hold';
  return 'Weak';
}

function calcUpChance(price, ema7d, ema7w, ema7m, ema50d, ema200d, rsi) {
  // Each condition adds weight to upside probability
  let pts = 0, total = 6;
  if (ema7d && price > ema7d) pts++;
  if (ema7w && price > ema7w) pts++;
  if (ema7m && price > ema7m) pts++;
  if (ema50d && price > ema50d) pts++;
  if (ema200d && price > ema200d) pts++;
  if (rsi && rsi > 50 && rsi < 70) pts++;
  return Math.round((pts / total) * 100);
}

function calcValuation(price, ema50, ema200, rsi) {
  // Price well below both EMAs + RSI oversold = Undervalued
  // Price well above both EMAs + RSI overbought = Overvalued
  // Otherwise = Fair Value
  const below50 = ema50 ? (ema50 - price) / ema50 * 100 : 0;
  const below200 = ema200 ? (ema200 - price) / ema200 * 100 : 0;
  const above50 = ema50 ? (price - ema50) / ema50 * 100 : 0;
  const above200 = ema200 ? (price - ema200) / ema200 * 100 : 0;
  if (below50 > 5 && below200 > 5 && rsi && rsi < 45) return 'Undervalued';
  if (above50 > 10 && above200 > 10 && rsi && rsi > 65) return 'Overvalued';
  return 'Fair Value';
}

async function getWatchlistAnalysis(symbol) {
  try {
    const [daily, weekly, monthly] = await Promise.all([
      fetchOHLC(symbol, '1d', '1y'),
      fetchOHLC(symbol, '1wk', '2y'),
      fetchOHLC(symbol, '1mo', '5y'),
    ]);
    if (!daily || !weekly || !monthly) return null;

    const dEma = calcEmaFull(daily.candles);
    const wEma = calcEmaFull(weekly.candles);
    const mEma = calcEmaFull(monthly.candles);
    const rsi = calcRSI(daily.candles);
    const volume = calcVolumeSignal(daily.candles);
    const price = parseFloat(daily.price.toFixed(2));

    const ema50Above = dEma.ema50 ? price > dEma.ema50 : null;
    const ema200Above = dEma.ema200 ? price > dEma.ema200 : null;

    const status = calcStatus(price, dEma.ema7, wEma.ema7, mEma.ema7, dEma.ema50, dEma.ema200, rsi);
    const upChancePct = calcUpChance(price, dEma.ema7, wEma.ema7, mEma.ema7, dEma.ema50, dEma.ema200, rsi);
    const valuation = calcValuation(price, dEma.ema50, dEma.ema200, rsi);

    // Stop Loss = 7 EMA Daily, Target = 1:2 R:R
    // If price > 7EMA: SL = 7EMA (natural support)
    // If price < 7EMA: SL = price * 0.97 (3% buffer, stock is weak)
    const ema7d = dEma.ema7;
    const stopLoss = ema7d
      ? (price > ema7d ? parseFloat(ema7d.toFixed(2)) : parseFloat((price * 0.97).toFixed(2)))
      : parseFloat((price * 0.97).toFixed(2));
    const risk = Math.abs(price - stopLoss);
    const target = parseFloat((price + risk * 2).toFixed(2));
    const targetPct = parseFloat(((target - price) / price * 100).toFixed(2));
    const stopLossPct = parseFloat(((stopLoss - price) / price * 100).toFixed(2));

    return {
      symbol,
      price,
      pChange: daily.pChange,
      ema7Daily: dEma.ema7,
      ema7Weekly: wEma.ema7,
      ema7Monthly: mEma.ema7,
      ema50Above,
      ema200Above,
      rsi,
      volume,
      status,
      upChancePct,
      valuation,
      target,
      targetPct,
      stopLoss,
      stopLossPct,
    };
  } catch { return null; }
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

    const wc = weekly.candles[weekly.candles.length - 2];
    const mc = monthly.candles[monthly.candles.length - 2];

    const prevDay = daily.candles[daily.candles.length - 2];

    const dailyEma = calcEma7(daily.candles);
    const weeklyEma = calcEma7(weekly.candles);
    const monthlyEma = calcEma7(monthly.candles);

    return {
      symbol,
      price: parseFloat(daily.price.toFixed(2)),
      pChange: daily.pChange,
      daily: { ...calcPivots(prevDay.high, prevDay.low, prevDay.close), ...dailyEma },
      weekly: { ...calcPivots(wc.high, wc.low, wc.close), ...weeklyEma },
      monthly: { ...calcPivots(mc.high, mc.low, mc.close), ...monthlyEma },
    };
  } catch { return null; }
}

module.exports = { getLevels, getWatchlistAnalysis };