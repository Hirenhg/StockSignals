const { EMA, SMA, ATR } = require("technicalindicators");

function generateEquitySignal(ohlcData) {
  if (!ohlcData || ohlcData.length < 40) return { signal: "HOLD" };

  const closes = ohlcData.map(d => d.close);
  const highs = ohlcData.map(d => d.high);
  const lows = ohlcData.map(d => d.low);
  const opens = ohlcData.map(d => d.open);

  const ema10 = EMA.calculate({ period: 10, values: closes });
  const ema20 = EMA.calculate({ period: 20, values: closes });
  const sma40 = SMA.calculate({ period: 40, values: closes });
  const atr40 = ATR.calculate({ period: 40, high: highs, low: lows, close: closes });

  if (!ema10.length || !ema20.length || !sma40.length || !atr40.length) {
    return { signal: "HOLD" };
  }

  // Align arrays to same length (shortest)
  const len = Math.min(ema10.length, ema20.length, sma40.length, atr40.length, opens.length, closes.length);
  const offset = (arr, total) => arr.slice(arr.length - len);

  const e10 = offset(ema10);
  const e20 = offset(ema20);
  const s40 = offset(sma40);
  const a40 = offset(atr40);
  const c = offset(closes);
  const o = offset(opens);

  const rangeLen = 0.618;

  // Process conditions bar by bar to track state
  let condition = 0;
  let lastSignalType = null;

  for (let i = 0; i < len; i++) {
    const chBasis = a40[i] * rangeLen;
    const chTop = s40[i] + chBasis;
    const chBot = s40[i] - chBasis;
    const inRange = (o[i] <= chTop || c[i] <= chTop) && (o[i] >= chBot || c[i] >= chBot);
    const dirTrend = inRange ? 0 : c[i] >= s40[i] ? 1 : -1;

    const buyCond = dirTrend === 1 && e10[i] > e20[i];
    const sellCond = dirTrend === -1 && e10[i] < e20[i];
    const buyCloseCo = dirTrend === 1 && e10[i] < e20[i];
    const sellCloseC = dirTrend === -1 && e10[i] > e20[i];
    const closeCond = buyCloseCo || sellCloseC;

    if (condition !== 1 && buyCond) condition = 1;
    else if (condition !== -1 && sellCond) condition = -1;
    else if (condition !== 0 && closeCond) condition = 0;

    // Check for golden/death cross
    if (i > 0) {
      const prevE20 = e20[i - 1];
      const prevS40 = s40[i - 1];
      if (prevE20 <= prevS40 && e20[i] > s40[i]) lastSignalType = 'GOLDEN_CROSS';
      if (prevE20 >= prevS40 && e20[i] < s40[i]) lastSignalType = 'DEATH_CROSS';
    }
  }

  const last = len - 1;
  const prev = len - 2;
  const chBasis = a40[last] * rangeLen;
  const chTop = s40[last] + chBasis;
  const chBot = s40[last] - chBasis;
  const inRange = (o[last] <= chTop || c[last] <= chTop) && (o[last] >= chBot || c[last] >= chBot);
  const dirTrend = inRange ? 0 : c[last] >= s40[last] ? 1 : -1;

  // Determine bar color state
  let barColor = 'orange';
  if (dirTrend === 1 && o[last] <= c[last]) barColor = 'green';
  else if (dirTrend === 1 && o[last] > c[last]) barColor = 'greenLight';
  else if (dirTrend === -1 && o[last] >= c[last]) barColor = 'red';
  else if (dirTrend === -1 && o[last] < c[last]) barColor = 'redLight';

  // Map condition to signal
  let signal = "HOLD";
  if (condition === 1) signal = "ENTRY";
  else if (condition === -1) signal = "EXIT";

  // Check if current bar is a fresh signal
  let isFreshEntry = false, isFreshExit = false, isFreshClose = false;
  if (prev >= 0) {
    // Recalculate prev condition
    const prevChBasis = a40[prev] * rangeLen;
    const prevChTop = s40[prev] + prevChBasis;
    const prevChBot = s40[prev] - prevChBasis;
    const prevInRange = (o[prev] <= prevChTop || c[prev] <= prevChTop) && (o[prev] >= prevChBot || c[prev] >= prevChBot);
    const prevDirTrend = prevInRange ? 0 : c[prev] >= s40[prev] ? 1 : -1;
    const prevBuyCond = prevDirTrend === 1 && e10[prev] > e20[prev];
    const prevSellCond = prevDirTrend === -1 && e10[prev] < e20[prev];

    const buyCond = dirTrend === 1 && e10[last] > e20[last];
    const sellCond = dirTrend === -1 && e10[last] < e20[last];

    if (buyCond && !prevBuyCond) isFreshEntry = true;
    if (sellCond && !prevSellCond) isFreshExit = true;
  }

  // Check golden/death cross on last bar
  let goldenCross = false, deathCross = false;
  if (prev >= 0) {
    if (e20[prev] <= s40[prev] && e20[last] > s40[last]) goldenCross = true;
    if (e20[prev] >= s40[prev] && e20[last] < s40[last]) deathCross = true;
  }

  return {
    signal,
    price: c[last],
    ema10: e10[last],
    ema20: e20[last],
    sma40: s40[last],
    atr: a40[last],
    channelTop: chTop,
    channelBot: chBot,
    dirTrend,
    barColor,
    goldenCross,
    deathCross,
    isFreshEntry,
    isFreshExit,
    condition
  };
}

module.exports = { generateEquitySignal };
