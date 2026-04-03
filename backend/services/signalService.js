const calculateIndicators = require("../indicators/indicators");

function generateSignal(prices, ohlc) {
  if (!prices || prices.length < 20) return { signal: "HOLD" };

  const { ema7, rsi, pivot, r1, r2, r3, s1, s2, s3 } = calculateIndicators(prices, ohlc);
  const price = prices[prices.length - 1];

  if (!ema7 || !rsi) return { signal: "HOLD" };

  let signal = "HOLD";

  if (pivot) {
    // BUY: price above EMA7, above pivot, RSI > 50, price near/above S1 (bouncing from support)
    if (price > ema7 && price > pivot && rsi > 50 && price <= r2) {
      signal = "BUY";
    }
    // SELL: price below EMA7, below pivot, RSI < 50, price near/below R1 (rejecting from resistance)
    else if (price < ema7 && price < pivot && rsi < 50 && price >= s2) {
      signal = "SELL";
    }
  } else {
    // Fallback: EMA7 + RSI only
    if (price > ema7 && rsi > 55) signal = "BUY";
    else if (price < ema7 && rsi < 45) signal = "SELL";
  }

  return { signal, price, rsi, ema7, pivot, r1, r2, r3, s1, s2, s3 };
}

module.exports = generateSignal;