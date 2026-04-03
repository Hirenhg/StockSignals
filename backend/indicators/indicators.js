const { EMA, RSI } = require("technicalindicators");

// Fibonacci Pivot Points from previous candle's H/L/C
function calcFibPivot(high, low, close) {
  const pivot = (high + low + close) / 3;
  const range = high - low;
  return {
    pivot,
    r1: pivot + 0.382 * range,
    r2: pivot + 0.618 * range,
    r3: pivot + 1.000 * range,
    s1: pivot - 0.382 * range,
    s2: pivot - 0.618 * range,
    s3: pivot - 1.000 * range,
  };
}

function calculateIndicators(prices, ohlc) {
  const ema7 = EMA.calculate({ period: 7, values: prices });
  const rsi = RSI.calculate({ period: 14, values: prices });

  let fibPivot = null;
  if (ohlc && ohlc.length >= 2) {
    const prev = ohlc[ohlc.length - 2];
    fibPivot = calcFibPivot(prev.high, prev.low, prev.close);
  }

  return {
    ema7: ema7[ema7.length - 1],
    rsi: rsi[rsi.length - 1],
    ...fibPivot
  };
}

module.exports = calculateIndicators;