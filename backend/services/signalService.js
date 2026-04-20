const calculateIndicators = require("../indicators/indicators");

// Analyze a single timeframe and return its bias
function analyzeTimeframe(prices, ohlc) {
  if (!prices || prices.length < 20) return null;
  const ind = calculateIndicators(prices, ohlc);
  if (!ind.r1 || !ind.s1) return { bias: 'NEUTRAL', ...ind };

  let bias = 'NEUTRAL';
  const price = prices[prices.length - 1];

  if (ind.prevPrice <= ind.r1 && price > ind.r1 && ind.volSpike && ind.strongCandle === 'bullish') bias = 'BUY';
  else if (ind.prevPrice >= ind.s1 && price < ind.s1 && ind.volSpike && ind.strongCandle === 'bearish') bias = 'SELL';

  return { bias, price, ...ind };
}

// Multi-timeframe signal: BUY/SELL only when at least 2 of 3 timeframes agree
function generateSignal(tf1h, tf30m, tf15m) {
  const analyses = [
    tf1h ? analyzeTimeframe(tf1h.closes, tf1h.ohlc) : null,
    tf30m ? analyzeTimeframe(tf30m.closes, tf30m.ohlc) : null,
    tf15m ? analyzeTimeframe(tf15m.closes, tf15m.ohlc) : null,
  ].filter(Boolean);

  if (!analyses.length) return { signal: "HOLD" };

  // Use 15m as primary for price/indicators display
  const primary = analyses[analyses.length - 1];
  const price = primary.price;

  const buyCount = analyses.filter(a => a.bias === 'BUY').length;
  const sellCount = analyses.filter(a => a.bias === 'SELL').length;

  let signal = "HOLD", sl = null, target = null;

  if (buyCount >= 2) {
    signal = "BUY";
    sl = primary.r1 ? parseFloat(primary.r1.toFixed(2)) : null;
    target = primary.r1 ? parseFloat((price + (price - primary.r1) * 2).toFixed(2)) : null;
  } else if (sellCount >= 2) {
    signal = "SELL";
    sl = primary.s1 ? parseFloat(primary.s1.toFixed(2)) : null;
    target = primary.s1 ? parseFloat((price - (primary.s1 - price) * 2).toFixed(2)) : null;
  }

  return {
    signal, price, rsi: primary.rsi, ema7: primary.ema7, sl, target,
    r1: primary.r1, r2: primary.r2, r3: primary.r3,
    s1: primary.s1, s2: primary.s2, s3: primary.s3,
    tfBias: { '1h': analyses[0]?.bias, '30m': analyses[1]?.bias, '15m': analyses[2]?.bias }
  };
}

module.exports = generateSignal;
