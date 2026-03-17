const { EMA, RSI } = require("technicalindicators");

function calculateIndicators(prices) {
  const ema5 = EMA.calculate({ period: 5, values: prices });
  const ema10 = EMA.calculate({ period: 10, values: prices });
  const ema15 = EMA.calculate({ period: 15, values: prices });
  const ema20 = EMA.calculate({ period: 20, values: prices });
  const rsi = RSI.calculate({ period: 14, values: prices });

  return {
    ema5: ema5[ema5.length - 1],
    ema10: ema10[ema10.length - 1],
    ema15: ema15[ema15.length - 1],
    ema20: ema20[ema20.length - 1],
    rsi: rsi[rsi.length - 1]
  };
}

module.exports = calculateIndicators;