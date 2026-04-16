const calculateIndicators = require("../indicators/indicators");

function generateSignal(prices, ohlc) {
  if (!prices || prices.length < 20) return { signal: "HOLD" };

  const ind = calculateIndicators(prices, ohlc);
  const price = prices[prices.length - 1];

  if (!ind.r1 || !ind.s1) return { signal: "HOLD", price, rsi: ind.rsi, ema7: ind.ema7, r1: ind.r1, r2: ind.r2, r3: ind.r3, s1: ind.s1, s2: ind.s2, s3: ind.s3 };

  let signal = "HOLD";
  let sl = null, target = null;

  // BUY: price breaks above R1 + volume spike + strong bullish candle
  if (ind.prevPrice <= ind.r1 && price > ind.r1 && ind.volSpike && ind.strongCandle === 'bullish') {
    signal = "BUY";
    sl = parseFloat(ind.r1.toFixed(2));
    target = parseFloat((price + (price - ind.r1) * 2).toFixed(2));
  }
  // SELL: price breaks below S1 + volume spike + strong bearish candle
  else if (ind.prevPrice >= ind.s1 && price < ind.s1 && ind.volSpike && ind.strongCandle === 'bearish') {
    signal = "SELL";
    sl = parseFloat(ind.s1.toFixed(2));
    target = parseFloat((price - (ind.s1 - price) * 2).toFixed(2));
  }

  return {
    signal, price, rsi: ind.rsi, ema7: ind.ema7, sl, target,
    r1: ind.r1, r2: ind.r2, r3: ind.r3, s1: ind.s1, s2: ind.s2, s3: ind.s3
  };
}

module.exports = generateSignal;
