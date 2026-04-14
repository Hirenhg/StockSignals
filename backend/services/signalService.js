const calculateIndicators = require("../indicators/indicators");

function generateSignal(prices, ohlc) {
  if (!prices || prices.length < 20) return { signal: "HOLD" };

  const { ema7, rsi, macdLine, macdSignal, macdHist, pivot, r1, r2, r3, s1, s2, s3 } = calculateIndicators(prices, ohlc);
  const price = prices[prices.length - 1];

  if (!ema7 || !rsi) return { signal: "HOLD" };

  let signal = "HOLD";

  if (pivot) {
    if (price > ema7 && price > pivot && rsi > 50 && price <= r2) signal = "BUY";
    else if (price < ema7 && price < pivot && rsi < 50 && price >= s2) signal = "SELL";
  } else {
    if (price > ema7 && rsi > 55) signal = "BUY";
    else if (price < ema7 && rsi < 45) signal = "SELL";
  }

  return { signal, price, rsi, ema7, macdLine, macdSignal, macdHist, pivot, r1, r2, r3, s1, s2, s3 };
}

module.exports = generateSignal;