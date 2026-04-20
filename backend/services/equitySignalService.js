const { EMA, SMA, ATR } = require("technicalindicators");

// Analyze a single timeframe
function analyzeTF(ohlcData) {
  if (!ohlcData || ohlcData.length < 40) return null;

  const closes = ohlcData.map(d => d.close);
  const highs = ohlcData.map(d => d.high);
  const lows = ohlcData.map(d => d.low);
  const opens = ohlcData.map(d => d.open);

  const ema10 = EMA.calculate({ period: 10, values: closes });
  const ema20 = EMA.calculate({ period: 20, values: closes });
  const sma40 = SMA.calculate({ period: 40, values: closes });
  const atr40 = ATR.calculate({ period: 40, high: highs, low: lows, close: closes });

  if (!ema10.length || !ema20.length || !sma40.length || !atr40.length) return null;

  const len = Math.min(ema10.length, ema20.length, sma40.length, atr40.length, opens.length, closes.length);
  const offset = (arr) => arr.slice(arr.length - len);

  const e10 = offset(ema10), e20 = offset(ema20), s40 = offset(sma40), a40 = offset(atr40);
  const c = offset(closes), o = offset(opens);
  const rangeLen = 0.618;
  const last = len - 1;

  const chBasis = a40[last] * rangeLen;
  const chTop = s40[last] + chBasis;
  const chBot = s40[last] - chBasis;
  const inRange = (o[last] <= chTop || c[last] <= chTop) && (o[last] >= chBot || c[last] >= chBot);
  const dirTrend = inRange ? 0 : c[last] >= s40[last] ? 1 : -1;

  let bias = 'HOLD';
  if (dirTrend === 1 && e10[last] > e20[last]) bias = 'ENTRY';
  else if (dirTrend === -1 && e10[last] < e20[last]) bias = 'EXIT';

  let barColor = 'orange';
  if (dirTrend === 1 && o[last] <= c[last]) barColor = 'green';
  else if (dirTrend === 1 && o[last] > c[last]) barColor = 'greenLight';
  else if (dirTrend === -1 && o[last] >= c[last]) barColor = 'red';
  else if (dirTrend === -1 && o[last] < c[last]) barColor = 'redLight';

  let goldenCross = false, deathCross = false;
  if (len >= 2) {
    const prev = last - 1;
    if (e20[prev] <= s40[prev] && e20[last] > s40[last]) goldenCross = true;
    if (e20[prev] >= s40[prev] && e20[last] < s40[last]) deathCross = true;
  }

  return {
    bias, price: c[last], ema10: e10[last], ema20: e20[last], sma40: s40[last],
    atr: a40[last], channelTop: chTop, channelBot: chBot, dirTrend, barColor,
    goldenCross, deathCross
  };
}

// Multi-timeframe: signal when at least 2 of 3 timeframes agree
function generateEquitySignal(tf1h, tf30m, tf15m) {
  const analyses = [
    analyzeTF(tf1h),
    analyzeTF(tf30m),
    analyzeTF(tf15m),
  ].filter(Boolean);

  if (!analyses.length) return { signal: "HOLD" };

  const primary = analyses[analyses.length - 1]; // 15m as display source

  const entryCount = analyses.filter(a => a.bias === 'ENTRY').length;
  const exitCount = analyses.filter(a => a.bias === 'EXIT').length;

  let signal = "HOLD";
  if (entryCount >= 2) signal = "ENTRY";
  else if (exitCount >= 2) signal = "EXIT";

  return {
    signal,
    price: primary.price,
    ema10: primary.ema10,
    ema20: primary.ema20,
    sma40: primary.sma40,
    atr: primary.atr,
    channelTop: primary.channelTop,
    channelBot: primary.channelBot,
    dirTrend: primary.dirTrend,
    barColor: primary.barColor,
    goldenCross: analyses.some(a => a.goldenCross),
    deathCross: analyses.some(a => a.deathCross),
    tfBias: { '1h': analyses[0]?.bias, '30m': analyses[1]?.bias, '15m': analyses[2]?.bias }
  };
}

module.exports = { generateEquitySignal };
