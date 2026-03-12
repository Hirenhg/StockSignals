const calculateIndicators = require("../indicators/indicators");

function generateSignal(prices) {
  const { ema5, ema10, ema15, ema20, rsi } = calculateIndicators(prices);

  let signal = "HOLD";

  // Check if EMAs are aligned: 5 > 10 > 15 > 20 (bullish alignment)
  if (ema5 > ema10 && ema10 > ema15 && ema15 > ema20 && rsi > 50) {
    signal = "BUY";
  } else if (ema5 < ema10 && ema10 < ema15 && ema15 < ema20 && rsi < 50) {
    signal = "SELL";
  }

  return { signal, rsi, ema5, ema10, ema15, ema20 };
}

module.exports = generateSignal;