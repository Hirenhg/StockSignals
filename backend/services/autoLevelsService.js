const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

const agent = new https.Agent({ rejectUnauthorized: false });
const indexLevelsPath = path.join(__dirname, '../data/index-levels.json');

const INDEX_MAP = {
  NIFTY:     { yahoo: '^NSEI',    label: 'NIFTY SPOT' },
  BANKNIFTY: { yahoo: '^NSEBANK', label: 'BANK NIFTY SPOT' },
  SENSEX:    { yahoo: '^BSESN',   label: 'SENSEX SPOT' },
};

function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

function round(v, decimals = 0) {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

async function fetchCloses(yahooSymbol, interval, range) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastErr;
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}&_=${Date.now()}`;
      const r = await axios.get(url, {
        timeout: 12000,
        httpsAgent: agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });
      const result = r.data?.chart?.result?.[0];
      if (!result) throw new Error('No result in Yahoo response');
      const closes = result.indicators.quote[0].close.filter(c => c != null);
      if (closes.length < 7) throw new Error('Not enough closes');
      const price = result.meta.regularMarketPrice || closes[closes.length - 1];
      return { closes, price };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function computeLevels(symbol, ema7_15m, ema7_1h) {
  const step  = symbol === 'BANKNIFTY' ? 10 : 5;
  const t1Pct = symbol === 'BANKNIFTY' ? 0.005 : 0.003;
  const t2Pct = symbol === 'BANKNIFTY' ? 0.010 : 0.006;

  // Both 15M & 1H EMA-7 must agree — entry above/below the higher/lower of both
  const bullishAbove = round(Math.max(ema7_15m, ema7_1h) + step, 0);
  const bearishBelow = round(Math.min(ema7_15m, ema7_1h) - step, 0);

  // Targets anchored to 1H EMA-7 (higher timeframe = more reliable)
  const t1Bull = round(ema7_1h * (1 + t1Pct), 0);
  const t2Bull = round(ema7_1h * (1 + t2Pct), 0);
  const t1Bear = round(ema7_1h * (1 - t1Pct), 0);
  const t2Bear = round(ema7_1h * (1 - t2Pct), 0);

  return { bullishAbove, bullishTargets: [t1Bull, t2Bull], bearishBelow, bearishTargets: [t1Bear, t2Bear] };
}

async function autoUpdateIndexLevels() {
  const data = JSON.parse(fs.readFileSync(indexLevelsPath, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  let updated = false;
  const errors = [];

  for (const [symbol, meta] of Object.entries(INDEX_MAP)) {
    try {
      const [data15m, data1h] = await Promise.all([
        fetchCloses(meta.yahoo, '15m', '5d'),
        fetchCloses(meta.yahoo, '1h', '30d'),
      ]);
      const price = data15m.price;
      const ema7_15m = calcEMA(data15m.closes, 7);
      const ema7_1h  = calcEMA(data1h.closes, 7);
      if (!ema7_15m || !ema7_1h) throw new Error('EMA calculation failed');

      const levels = computeLevels(symbol, ema7_15m, ema7_1h);
      const idx = data.findIndex(d => d.symbol.toUpperCase() === symbol);
      const entry = {
        symbol,
        label: meta.label,
        cmp: round(price, 2),
        ...levels,
        date: today,
        note: data[idx]?.note || 'Trade with strict SL as per risk appetite.',
      };

      if (idx === -1) data.push(entry);
      else data[idx] = entry;
      updated = true;
    } catch (e) {
      errors.push(`${symbol}: ${e.message}`);
      console.error(`autoLevels: failed for ${symbol}:`, e.message);
    }
  }

  if (updated) fs.writeFileSync(indexLevelsPath, JSON.stringify(data, null, 2));
  if (errors.length === Object.keys(INDEX_MAP).length) {
    throw new Error('All symbols failed: ' + errors.join('; '));
  }
  return data;
}

module.exports = { autoUpdateIndexLevels };
