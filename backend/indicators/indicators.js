const { RSI, EMA } = require("technicalindicators");

function calcFibLevels(high, low, close) {
  const pp = (high + low + close) / 3;
  const range = high - low;
  return {
    r1: pp + 0.382 * range, r2: pp + 0.618 * range, r3: pp + 1.000 * range,
    s1: pp - 0.382 * range, s2: pp - 0.618 * range, s3: pp - 1.000 * range,
  };
}

function calculateIndicators(prices, ohlc) {
  const ema7Arr = EMA.calculate({ period: 7, values: prices });
  const rsiArr = RSI.calculate({ period: 14, values: prices });

  const ema7 = ema7Arr.length ? ema7Arr[ema7Arr.length - 1] : null;
  const rsi = rsiArr.length ? rsiArr[rsiArr.length - 1] : null;
  const price = prices[prices.length - 1];
  const prevPrice = prices.length >= 2 ? prices[prices.length - 2] : null;

  // Volume spike: current vol > 1.5x of 20-candle avg
  let volSpike = false;
  if (ohlc && ohlc.length >= 21) {
    const vols = ohlc.map(b => b.volume || 0);
    const avg = vols.slice(-21, -1).reduce((s, v) => s + v, 0) / 20;
    volSpike = avg > 0 && vols[vols.length - 1] > avg * 1.5;
  }

  // Strong candle: body > 60% of range
  let strongCandle = null;
  if (ohlc && ohlc.length >= 1) {
    const c = ohlc[ohlc.length - 1];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    if (range > 0 && body / range > 0.6)
      strongCandle = c.close > c.open ? 'bullish' : 'bearish';
  }

  let fibLevels = null;
  if (ohlc && ohlc.length >= 2) {
    const prev = ohlc[ohlc.length - 2];
    fibLevels = calcFibLevels(prev.high, prev.low, prev.close);
  }

  return { ema7, rsi, price, prevPrice, volSpike, strongCandle, ...fibLevels };
}

module.exports = calculateIndicators;
