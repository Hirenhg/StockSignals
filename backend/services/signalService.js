const calculateIndicators = require("../indicators/indicators");

function generateSignal(prices) {
  if (!prices || prices.length < 20) {
    return { signal: "HOLD" };
  }

  const { ema5, ema10, ema15, ema20, rsi } = calculateIndicators(prices);
  const price = prices[prices.length - 1];

  if (!ema5 || !ema10 || !ema15 || !ema20 || !rsi) {
    return { signal: "HOLD" };
  }

  let signal = "HOLD";

  // Bullish - EMAs aligned (5>10>15>20)
  const isBullish = ema5 > ema10 && ema10 > ema15 && ema15 > ema20;
  
  // Bearish - EMAs aligned (5<10<15<20)
  const isBearish = ema5 < ema10 && ema10 < ema15 && ema15 < ema20;

  if (isBullish && price > ema20 && rsi > 50) {
    signal = "BUY";
  } else if (isBearish && price < ema20 && rsi < 50) {
    signal = "SELL";
  }

  return { signal, price, rsi, ema5, ema10, ema15, ema20, isBullish, isBearish };
}

function generateMultiTimeframeSignal(prices1m, prices5m, prices15m) {
  if (!prices1m || !prices5m || !prices15m) {
    return { signal: "HOLD" };
  }

  const signal1m = generateSignal(prices1m);
  const signal5m = generateSignal(prices5m);
  const signal15m = generateSignal(prices15m);

  // Check if all timeframes show bullish alignment
  const allBullish = signal1m.isBullish && signal5m.isBullish && signal15m.isBullish;
  
  // Check if all timeframes show bearish alignment
  const allBearish = signal1m.isBearish && signal5m.isBearish && signal15m.isBearish;

  let finalSignal = "HOLD";
  
  if (allBullish && signal5m.rsi > 50) {
    finalSignal = "BUY";
  } else if (allBearish && signal5m.rsi < 50) {
    finalSignal = "SELL";
  }

  return {
    signal: finalSignal,
    price: signal5m.price,
    rsi: signal5m.rsi,
    ema5: signal5m.ema5,
    ema10: signal5m.ema10,
    ema15: signal5m.ema15,
    ema20: signal5m.ema20,
    timeframes: {
      '1m': { signal: signal1m.signal, isBullish: signal1m.isBullish, isBearish: signal1m.isBearish },
      '5m': { signal: signal5m.signal, isBullish: signal5m.isBullish, isBearish: signal5m.isBearish },
      '15m': { signal: signal15m.signal, isBullish: signal15m.isBullish, isBearish: signal15m.isBearish }
    }
  };
}

module.exports = generateSignal;
module.exports.generateMultiTimeframeSignal = generateMultiTimeframeSignal;