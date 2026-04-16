const axios = require("axios");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getStockHistory(symbol, interval = '1m', range = '1d', getInfo = false, getVolume = false, getHighLow = false, getOHLC = false) {
  const maxRetries = 2;
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) await delay(300 * attempt);
      
      const skipNS = symbol.startsWith('^') || symbol.includes('-') || symbol.includes('=');
      const fullSymbol = skipNS ? symbol : `${symbol}.NS`;
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${fullSymbol}?range=${range}&interval=${interval}`;
      const response = await axios.get(url, { 
        timeout: 10000,
        httpsAgent: agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      
      if (!response.data?.chart?.result?.[0]) {
        throw new Error('Invalid response from Yahoo Finance');
      }
      
      if (getInfo) {
        const meta = response.data.chart.result[0].meta;
        return {
          week52High: meta.fiftyTwoWeekHigh ? meta.fiftyTwoWeekHigh.toFixed(2) : null,
          week52Low: meta.fiftyTwoWeekLow ? meta.fiftyTwoWeekLow.toFixed(2) : null
        };
      }
      
      if (getVolume) {
        const volumes = response.data.chart.result[0].indicators.quote[0].volume;
        if (!volumes) return null;
        const latestVolume = volumes.filter(v => v !== null && v !== undefined).pop();
        if (!latestVolume) return null;
        return latestVolume >= 1000 ? (latestVolume / 1000).toFixed(0) : latestVolume.toFixed(0);
      }
      
      if (getHighLow) {
        const highs = response.data.chart.result[0].indicators.quote[0].high.filter(h => h !== null);
        const lows = response.data.chart.result[0].indicators.quote[0].low.filter(l => l !== null);
        if (highs.length >= 2 && lows.length >= 2) {
          return {
            high: highs[highs.length - 2].toFixed(2),
            low: lows[lows.length - 2].toFixed(2)
          };
        }
        return null;
      }
      
      if (getOHLC) {
        const q = response.data.chart.result[0].indicators.quote[0];
        const len = q.close.length;
        const ohlc = [];
        for (let i = 0; i < len; i++) {
          if (q.close[i] != null && q.open[i] != null && q.high[i] != null && q.low[i] != null) {
            ohlc.push({ open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] || 0 });
          }
        }
        return ohlc;
      }

      const prices = response.data.chart.result[0].indicators.quote[0].close;
      return prices.filter((p) => p !== null);
      
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) await delay(300);
    }
  }
  
  throw lastError;
}

async function getStockFull(symbol, interval = '5m', range = '5d') {
  try {
    const skipNS = symbol.startsWith('^') || symbol.includes('-') || symbol.includes('=');
    const fullSymbol = skipNS ? symbol : `${symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${fullSymbol}?range=${range}&interval=${interval}`;
    const response = await axios.get(url, {
      timeout: 10000, httpsAgent: agent,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' }
    });
    if (!response.data?.chart?.result?.[0]) return null;
    const result = response.data.chart.result[0];
    const meta = result.meta;
    const q = result.indicators.quote[0];
    const closes = q.close.filter(p => p !== null);
    const len = q.close.length;
    const ohlc = [];
    for (let i = 0; i < len; i++) {
      if (q.close[i] != null && q.open[i] != null && q.high[i] != null && q.low[i] != null) {
        ohlc.push({ open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] || 0 });
      }
    }
    return {
      closes,
      ohlc,
      week52High: meta.fiftyTwoWeekHigh ? meta.fiftyTwoWeekHigh.toFixed(2) : null,
      week52Low: meta.fiftyTwoWeekLow ? meta.fiftyTwoWeekLow.toFixed(2) : null,
      prevClose: meta.chartPreviousClose ? meta.chartPreviousClose : null
    };
  } catch { return null; }
}

module.exports = getStockHistory;
module.exports.getStockFull = getStockFull;
