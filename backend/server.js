require('dotenv').config();
const express = require("express");
const fs = require('fs');
const path = require('path');
const getStockHistory = require("./services/stockService");
const { getStockFull } = require("./services/stockService");
const generateSignal = require("./services/signalService");
const { initTelegram, sendBulkSignals, setTelegramEnabled, isTelegramEnabled } = require("./services/telegramService");
const { loginWithMobile, authMiddleware, optionalAuth, getUserByMobile, updateUser } = require("./services/authService");

const { initializeWebSocket, getLiveData, updateSubscription } = require("./services/angelWebSocket");

initTelegram();

const app = express();
const stocksPath = path.join(__dirname, './data/stocks.json');
const indicesPath = path.join(__dirname, './data/indices.json');
const optionsPath = path.join(__dirname, './data/options.json');
const optionHistoryPath = path.join(__dirname, './data/option-history.json');
const commoditiesPath = path.join(__dirname, './data/commodities.json');
const cryptoPath = path.join(__dirname, './data/crypto.json');
const nifty50Path = path.join(__dirname, './data/nifty50.json');
const niftynext50Path = path.join(__dirname, './data/niftynext50.json');
const pegPath = path.join(__dirname, './data/peg.json');
const portfolioPath = path.join(__dirname, './data/portfolio.json');

const getStocks = () => JSON.parse(fs.readFileSync(stocksPath, 'utf8'));
const getIndices = () => JSON.parse(fs.readFileSync(indicesPath, 'utf8'));
const getOptions = () => JSON.parse(fs.readFileSync(optionsPath, 'utf8'));
const getCommodities = () => JSON.parse(fs.readFileSync(commoditiesPath, 'utf8'));
const getCrypto = () => JSON.parse(fs.readFileSync(cryptoPath, 'utf8'));
const getNifty50 = () => JSON.parse(fs.readFileSync(nifty50Path, 'utf8'));
const getNiftyNext50 = () => JSON.parse(fs.readFileSync(niftynext50Path, 'utf8'));

// Cache OpenAPIScripMaster in memory (loaded once, avoids repeated disk reads)
let symbolMasterCache = null;
let symbolMasterLoadTime = 0;
const SYMBOL_MASTER_TTL = 60 * 60 * 1000; // 1 hour
function getSymbolMaster() {
  if (!symbolMasterCache || Date.now() - symbolMasterLoadTime > SYMBOL_MASTER_TTL) {
    symbolMasterCache = JSON.parse(fs.readFileSync(path.join(__dirname, './data/OpenAPIScripMaster.json'), 'utf8'));
    symbolMasterLoadTime = Date.now();
  }
  return symbolMasterCache;
}
// Pre-load at startup
try { getSymbolMaster(); } catch {}

// Signal cache to avoid re-fetching from Yahoo on rapid requests
const signalCache = new Map();
const SIGNAL_CACHE_TTL = 45 * 1000; // 45 seconds

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ 
    message: "Stock Signal API Running",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/signals/:type", async (req, res) => {
  try {
    const type = req.params.type || 'stocks';

    // Return cached signals if fresh
    const cached = signalCache.get(type);
    if (cached && Date.now() - cached.time < SIGNAL_CACHE_TTL) {
      return res.json(cached.data);
    }

    let stocks = [];
    switch(type) {
      case 'indices': stocks = getIndices(); break;
      case 'commodities': stocks = getCommodities(); break;
      case 'crypto': stocks = getCrypto(); break;
      case 'nifty50': stocks = getNifty50(); break;
      case 'niftynext50': stocks = getNiftyNext50(); break;
      default: stocks = getStocks();
    }
    if (!stocks || stocks.length === 0) return res.json([]);

    const results = [];
    const batchSize = 20;
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (stock) => {
          try {
            // Fetch both 15m and 1h data for dual-timeframe confirmation
            const [data15m, data1h] = await Promise.all([
              getStockFull(stock.symbol, '15m', '5d'),
              getStockFull(stock.symbol, '60m', '1mo')
            ]);
            if (!data15m || !data15m.closes || data15m.closes.length < 20) return null;

            const result15m = generateSignal(data15m.closes, data15m.ohlc);
            const result1h = (data1h && data1h.closes && data1h.closes.length >= 20)
              ? generateSignal(data1h.closes, data1h.ohlc)
              : { signal: "HOLD" };

            // Dual-timeframe confirmation: both must agree
            let confirmedSignal = "HOLD";
            if (result15m.signal === "BUY" && result1h.signal === "BUY") confirmedSignal = "BUY";
            else if (result15m.signal === "SELL" && result1h.signal === "SELL") confirmedSignal = "SELL";

            const currentPrice = parseFloat(data15m.closes[data15m.closes.length - 1].toFixed(2));
            const prevClose = data15m.prevClose;
            const pChange = prevClose ? parseFloat(((currentPrice - prevClose) / prevClose * 100).toFixed(2)) : null;

            return {
              symbol: stock.symbol,
              signal: confirmedSignal,
              signal15m: result15m.signal,
              signal1h: result1h.signal,
              rsi: result15m.rsi?.toFixed(2) || '0',
              ema7: result15m.ema7?.toFixed(2) || '0',
              macdLine: result15m.macdLine?.toFixed(2) || null,
              macdSignal: result15m.macdSignal?.toFixed(2) || null,
              macdHist: result15m.macdHist?.toFixed(2) || null,
              pivot: result15m.pivot?.toFixed(2) || null,
              r1: result15m.r1?.toFixed(2) || null,
              r2: result15m.r2?.toFixed(2) || null,
              r3: result15m.r3?.toFixed(2) || null,
              s1: result15m.s1?.toFixed(2) || null,
              s2: result15m.s2?.toFixed(2) || null,
              s3: result15m.s3?.toFixed(2) || null,
              price: currentPrice.toFixed(2),
              pChange,
              week52High: data15m.week52High,
              week52Low: data15m.week52Low,
              timestamp: new Date().toISOString()
            };
          } catch { return null; }
        })
      );
      results.push(...batchResults.filter(r => r !== null));
    }
    res.json(results);

    // Cache the results
    signalCache.set(type, { data: results, time: Date.now() });

    if (type === 'stocks') {
      const buySignals = results.filter(r => r.signal === 'BUY');
      const sellSignals = results.filter(r => r.signal === 'SELL');
      if (buySignals.length > 0 || sellSignals.length > 0) sendBulkSignals(results);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch signals" });
  }
});

app.get("/api/chart/:symbol", async (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const interval = req.query.interval || '5m';
    const range = req.query.range || '5d';
    const skipNS = symbol.startsWith('^') || symbol.includes('-') || symbol.includes('=');
    const fullSymbol = skipNS ? symbol : `${symbol}.NS`;
    const axios = require('axios');
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(fullSymbol)}?range=${range}&interval=${interval}`;
    const response = await axios.get(url, { timeout: 15000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const result = response.data?.chart?.result?.[0];
    if (!result) return res.json({ candles: [] });
    const timestamps = result.timestamp || [];
    const q = result.indicators.quote[0];
    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null) {
        candles.push({ time: timestamps[i], open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] || 0 });
      }
    }
    res.json({ candles, symbol });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

app.get("/api/search", (req, res) => {
  const q = (req.query.q || '').toUpperCase().trim();
  const type = req.query.type || 'stocks';
  if (q.length < 1) return res.json([]);
  try {
    if (type === 'indices') {
      const indexSuggestions = [
        { symbol: '^NSEI', name: 'Nifty 50' },
        { symbol: '^BSESN', name: 'BSE Sensex' },
        { symbol: '^NSEBANK', name: 'Bank Nifty' },
        { symbol: '^CNXIT', name: 'Nifty IT' },
        { symbol: '^CNXPHARMA', name: 'Nifty Pharma' },
        { symbol: '^CNXAUTO', name: 'Nifty Auto' },
        { symbol: '^CNXFMCG', name: 'Nifty FMCG' },
        { symbol: '^CNXMETAL', name: 'Nifty Metal' },
        { symbol: '^CNXREALTY', name: 'Nifty Realty' },
        { symbol: '^CNXENERGY', name: 'Nifty Energy' },
        { symbol: '^CNXFIN', name: 'Nifty Fin Service' },
        { symbol: '^CNXPSUBANK', name: 'Nifty PSU Bank' },
        { symbol: '^CNXPVTBANK', name: 'Nifty Pvt Bank' },
        { symbol: '^NSEMDCP50', name: 'Nifty Midcap 50' },
      ].filter(s => s.symbol.toUpperCase().includes(q) || s.name.toUpperCase().includes(q));
      return res.json(indexSuggestions.slice(0, 10));
    }
    const symbolMaster = getSymbolMaster();
    const results = symbolMaster
      .filter(s => s.exch_seg === 'NSE' && s.instrumenttype === '' && s.symbol.endsWith('-EQ') && s.name.includes(q))
      .slice(0, 20)
      .map(s => ({ symbol: s.name, name: s.symbol.replace('-EQ', '') }));
    res.json(results);
  } catch { res.json([]); }
});

app.get("/api/options/search", (req, res) => {
  const q = (req.query.q || '').toUpperCase().trim();
  if (q.length < 2) return res.json([]);
  try {
    const symbolMaster = getSymbolMaster();
    const results = symbolMaster
      .filter(s => s.exch_seg === 'NFO' && (s.instrumenttype === 'OPTIDX' || s.instrumenttype === 'OPTSTK') && s.symbol.includes(q))
      .slice(0, 20)
      .map(s => ({ symbol: s.symbol, lotSize: s.lotsize, expiry: s.expiry }));
    res.json(results);
  } catch { res.json([]); }
});

app.get("/api/options/data", (req, res) => {
  const options = getOptions();
  res.json(options);
});

app.get("/api/options/test-rest", async (req, res) => {
  try {
    const { getAngelOptionData } = require("./services/angelOneService");
    const options = getOptions();
    const tokens = options.map(opt => opt.token);
    const data = await getAngelOptionData(tokens);
    res.json({ tokens, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/options/refresh", async (req, res) => {
  try {
    const options = getOptions();
    const tokens = options.map(opt => opt.token);
    updateSubscription(tokens);
    res.json({ message: "Options data refreshed", count: tokens.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to refresh options" });
  }
});

app.get("/api/options/live", async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  try {
    const { getAngelOptionData } = require("./services/angelOneService");
    const { sendBulkSignals } = require("./services/telegramService");
    const options = getOptions();
    if (!options || options.length === 0) return res.json([]);

    const axios = require('axios');
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    // Fetch LTP/OHLC from Yahoo Finance for each option's underlying
    async function getUnderlyingOHLC(optSymbol) {
      try {
        const match = optSymbol.match(/^([A-Z]+)/);
        if (!match) return null;
        let sym = match[1];
        const indexMap = { 'NIFTY': '^NSEI', 'BANKNIFTY': '^NSEBANK', 'FINNIFTY': '^CNXFIN', 'MIDCPNIFTY': '^NSEMDCP50' };
        const yahooSym = indexMap[sym] || `${sym}.NS`;
        const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1d&range=5d&_=${Date.now()}`, {
          timeout: 8000, httpsAgent: agent,
          headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        const result = r.data?.chart?.result?.[0];
        if (!result) return null;
        const q = result.indicators.quote[0];
        const meta = result.meta;
        const closes = q.close.filter(c => c != null);
        const opens = q.open.filter(c => c != null);
        const highs = q.high.filter(c => c != null);
        const lows = q.low.filter(c => c != null);
        const ltp = parseFloat((meta.regularMarketPrice || closes[closes.length - 1] || 0).toFixed(2));
        const open = parseFloat((opens[opens.length - 1] || 0).toFixed(2));
        const high = parseFloat((highs[highs.length - 1] || 0).toFixed(2));
        const low = parseFloat((lows[lows.length - 1] || 0).toFixed(2));
        const close = parseFloat((meta.chartPreviousClose || closes[closes.length - 2] || 0).toFixed(2));
        const pChange = close ? parseFloat(((ltp - close) / close * 100).toFixed(2)) : null;
        return { ltp, open, high, low, close, pChange };
      } catch { return null; }
    }

    const liveData = getLiveData();
    const hasWebSocketData = Object.keys(liveData).length > 0;
    
    if (!hasWebSocketData) {
      const tokens = options.map(opt => opt.token);
      const restData = await getAngelOptionData(tokens);
      
      const enrichedOptions = await Promise.all(options.map(async (opt) => {
        const live = restData.find(d => d.tradingSymbol === opt.symbol);
        let ltp = live?.ltp || 0;
        let open = live?.open || 0;
        let high = live?.high || 0;
        let low = live?.low || 0;
        let close = live?.close || 0;
        let pChange = live?.ltp && live?.close ? parseFloat(((live.ltp - live.close) / live.close * 100).toFixed(2)) : null;

        // Fallback to Yahoo Finance if Angel returns no data
        if (!ltp) {
          const yData = await getUnderlyingOHLC(opt.symbol);
          if (yData) { ltp = yData.ltp; open = yData.open; high = yData.high; low = yData.low; close = yData.close; pChange = yData.pChange; }
        }
        
        let signal = 'HOLD';
        let rsi = null;
        let ema7 = null;
        let pivot = null, r1 = null, r2 = null, r3 = null, s1 = null, s2 = null, s3 = null;
        
        try {
          const symbolMatch = opt.symbol.match(/^([A-Z]+)/);
          if (!symbolMatch) throw new Error('Invalid symbol format');
          
          let underlyingSymbol = symbolMatch[1];
          const indexMap = { 'NIFTY': '^NSEI', 'BANKNIFTY': '^NSEBANK', 'FINNIFTY': '^CNXFIN', 'MIDCPNIFTY': '^NSEMDCP50' };
          if (indexMap[underlyingSymbol]) underlyingSymbol = indexMap[underlyingSymbol];
          
          // Dual-timeframe: 15m + 1h confirmation (same as stocks)
          const [data15m, data1h] = await Promise.all([
            getStockFull(underlyingSymbol, '15m', '5d'),
            getStockFull(underlyingSymbol, '60m', '1mo')
          ]);
          
          if (data15m && data15m.closes && data15m.closes.length >= 20) {
            const result15m = generateSignal(data15m.closes, data15m.ohlc);
            const result1h = (data1h && data1h.closes && data1h.closes.length >= 20)
              ? generateSignal(data1h.closes, data1h.ohlc)
              : { signal: 'HOLD' };
            if (result15m.signal === 'BUY' && result1h.signal === 'BUY') signal = 'BUY';
            else if (result15m.signal === 'SELL' && result1h.signal === 'SELL') signal = 'SELL';
            rsi = result15m.rsi?.toFixed(2);
            ema7 = result15m.ema7?.toFixed(2);
            pivot = result15m.pivot?.toFixed(2);
            r1 = result15m.r1?.toFixed(2); r2 = result15m.r2?.toFixed(2); r3 = result15m.r3?.toFixed(2);
            s1 = result15m.s1?.toFixed(2); s2 = result15m.s2?.toFixed(2); s3 = result15m.s3?.toFixed(2);
          }
        } catch (err) {}
        
        return {
          ...opt,
          ltp, open, high, low, close,
          pChange: ltp && close ? parseFloat(((ltp - close) / close * 100).toFixed(2)) : null,
          signal, rsi, ema7, pivot, r1, r2, r3, s1, s2, s3,
          price: ltp.toFixed(2), symbol: opt.symbol
        };
      }));
      
      const buySignals = enrichedOptions.filter(o => o.signal === 'BUY');
      const sellSignals = enrichedOptions.filter(o => o.signal === 'SELL');
      if (buySignals.length > 0 || sellSignals.length > 0) {
        sendBulkSignals(enrichedOptions);
      }
      
      return res.json(enrichedOptions);
    }
    
    const wsTokens = options.map(opt => opt.token);
    const wsRestData = await getAngelOptionData(wsTokens).catch(() => []);

    const enrichedOptions = await Promise.all(options.map(async (opt) => {
      const wsLive = liveData[opt.token];
      const restLive = wsRestData.find(d => d.tradingSymbol === opt.symbol);
      let ltp = wsLive?.ltp || restLive?.ltp || 0;
      let open = restLive?.open || 0;
      let high = restLive?.high || 0;
      let low = restLive?.low || 0;
      let close = restLive?.close || 0;
      let pChange = ltp && close ? parseFloat(((ltp - close) / close * 100).toFixed(2)) : null;

      // Fallback to Yahoo Finance if Angel returns no data
      if (!ltp) {
        const yData = await getUnderlyingOHLC(opt.symbol);
        if (yData) { ltp = yData.ltp; open = yData.open; high = yData.high; low = yData.low; close = yData.close; pChange = yData.pChange; }
      }

      let signal = 'HOLD', rsi = null, ema7 = null;
      let pivot = null, r1 = null, r2 = null, r3 = null, s1 = null, s2 = null, s3 = null;

      try {
        const symbolMatch = opt.symbol.match(/^([A-Z]+)/);
        if (symbolMatch) {
          let underlyingSymbol = symbolMatch[1];
          const indexMap = { 'NIFTY': '^NSEI', 'BANKNIFTY': '^NSEBANK', 'FINNIFTY': '^CNXFIN', 'MIDCPNIFTY': '^NSEMDCP50' };
          if (indexMap[underlyingSymbol]) underlyingSymbol = indexMap[underlyingSymbol];
          // Dual-timeframe: 15m + 1h confirmation (same as stocks)
          const [data15m, data1h] = await Promise.all([
            getStockFull(underlyingSymbol, '15m', '5d'),
            getStockFull(underlyingSymbol, '60m', '1mo')
          ]);
          if (data15m && data15m.closes && data15m.closes.length >= 20) {
            const result15m = generateSignal(data15m.closes, data15m.ohlc);
            const result1h = (data1h && data1h.closes && data1h.closes.length >= 20)
              ? generateSignal(data1h.closes, data1h.ohlc)
              : { signal: 'HOLD' };
            if (result15m.signal === 'BUY' && result1h.signal === 'BUY') signal = 'BUY';
            else if (result15m.signal === 'SELL' && result1h.signal === 'SELL') signal = 'SELL';
            rsi = result15m.rsi?.toFixed(2);
            ema7 = result15m.ema7?.toFixed(2);
            pivot = result15m.pivot?.toFixed(2);
            r1 = result15m.r1?.toFixed(2); r2 = result15m.r2?.toFixed(2); r3 = result15m.r3?.toFixed(2);
            s1 = result15m.s1?.toFixed(2); s2 = result15m.s2?.toFixed(2); s3 = result15m.s3?.toFixed(2);
          }
        }
      } catch (err) {}

      return {
        ...opt,
        ltp, open, high, low, close,
        pChange: ltp && close ? parseFloat(((ltp - close) / close * 100).toFixed(2)) : null,
        timestamp: wsLive?.timestamp || null,
        signal, rsi, ema7, pivot, r1, r2, r3, s1, s2, s3
      };
    }));

    res.json(enrichedOptions);
  } catch (error) {
    console.error("Options live data error:", error.message);
    res.status(500).json({ error: "Failed to fetch live options data" });
  }
});

app.get("/api/sectors", async (req, res) => {
  try {
    const sectors = [
      { name: 'NIFTY 50', symbol: '^NSEI', category: 'Broad Market' },
      { name: 'NIFTY NEXT 50', symbol: '^NSMIDCP', category: 'Broad Market' },
      { name: 'NIFTY BANK', symbol: '^NSEBANK', category: 'Sectoral' },
      { name: 'NIFTY IT', symbol: '^CNXIT', category: 'Sectoral' },
      { name: 'NIFTY PHARMA', symbol: '^CNXPHARMA', category: 'Sectoral' },
      { name: 'NIFTY AUTO', symbol: '^CNXAUTO', category: 'Sectoral' },
      { name: 'NIFTY FMCG', symbol: '^CNXFMCG', category: 'Sectoral' },
      { name: 'NIFTY METAL', symbol: '^CNXMETAL', category: 'Sectoral' },
      { name: 'NIFTY REALTY', symbol: '^CNXREALTY', category: 'Sectoral' },
      { name: 'NIFTY ENERGY', symbol: '^CNXENERGY', category: 'Sectoral' },
      { name: 'NIFTY INFRA', symbol: '^CNXINFRA', category: 'Sectoral' },
      { name: 'NIFTY PSE', symbol: '^CNXPSE', category: 'Sectoral' },
      { name: 'NIFTY MEDIA', symbol: '^CNXMEDIA', category: 'Sectoral' },
      { name: 'NIFTY FIN SERVICE', symbol: '^CNXFIN', category: 'Sectoral' },
      { name: 'NIFTY COMMODITIES', symbol: '^CNXCOMMODITIES', category: 'Thematic' },
      { name: 'NIFTY CONSUMPTION', symbol: '^CNXCONSUMPTION', category: 'Thematic' },
      { name: 'NIFTY PSU BANK', symbol: '^CNXPSUBANK', category: 'Sectoral' },
      { name: 'NIFTY PVT BANK', symbol: '^CNXPVTBANK', category: 'Sectoral' },
    ];

    const results = await Promise.all(
      sectors.map(async (sector) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sector.symbol}?range=2d&interval=1d`;
          const axios = require('axios');
          const https = require('https');
          const agent = new https.Agent({ rejectUnauthorized: false });
          const response = await axios.get(url, {
            timeout: 10000, httpsAgent: agent,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          const result = response.data?.chart?.result?.[0];
          if (!result) return { ...sector, last: 0, change: 0, pChange: 0 };
          const meta = result.meta;
          const quote = result.indicators.quote[0];
          const closes = quote.close.filter(c => c !== null);
          const opens = quote.open.filter(c => c !== null);
          const highs = quote.high.filter(c => c !== null);
          const lows = quote.low.filter(c => c !== null);
          const last = closes[closes.length - 1] || meta.regularMarketPrice || 0;
          const prev = closes.length >= 2 ? closes[closes.length - 2] : meta.chartPreviousClose || last;
          const change = last - prev;
          const pChange = prev ? (change / prev) * 100 : 0;
          return { ...sector, last: parseFloat(last.toFixed(2)), change: parseFloat(change.toFixed(2)), pChange: parseFloat(pChange.toFixed(2)), open: parseFloat((opens[opens.length - 1] || 0).toFixed(2)), high: parseFloat((highs[highs.length - 1] || 0).toFixed(2)), low: parseFloat((lows[lows.length - 1] || 0).toFixed(2)), prevClose: parseFloat(prev.toFixed(2)) };
        } catch (err) {
          return { ...sector, last: 0, change: 0, pChange: 0 };
        }
      })
    );
    res.json(results.filter(r => r.last > 0));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

// Black-Scholes Greeks helpers
const bsNormCdf = (x) => {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5 * (1 + sign * y);
};
const bsNormPdf = (x) => Math.exp(-0.5*x*x) / Math.sqrt(2*Math.PI);
const bsPrice = (S,K,T,r,sigma,isCall) => {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = (Math.log(S/K) + (r + 0.5*sigma*sigma)*T) / (sigma*Math.sqrt(T));
  const d2 = d1 - sigma*Math.sqrt(T);
  return isCall ? S*bsNormCdf(d1) - K*Math.exp(-r*T)*bsNormCdf(d2) : K*Math.exp(-r*T)*bsNormCdf(-d2) - S*bsNormCdf(-d1);
};
const bsIV = (S,K,T,r,marketPrice,isCall) => {
  if (T <= 0 || marketPrice <= 0) return 0;
  let lo=0.01, hi=5, mid;
  for (let i=0; i<100; i++) {
    mid = (lo+hi)/2;
    const p = bsPrice(S,K,T,r,mid,isCall);
    if (Math.abs(p - marketPrice) < 0.01) return mid;
    if (p > marketPrice) hi = mid; else lo = mid;
  }
  return mid;
};
const bsGreeks = (S,K,T,r,sigma,isCall) => {
  if (T <= 0 || sigma <= 0) return { iv: 0, delta: 0, gamma: 0, theta: 0, vega: 0 };
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S/K) + (r + 0.5*sigma*sigma)*T) / (sigma*sqrtT);
  const d2 = d1 - sigma*sqrtT;
  const delta = isCall ? bsNormCdf(d1) : bsNormCdf(d1) - 1;
  const gamma = bsNormPdf(d1) / (S * sigma * sqrtT);
  const theta = (-(S*bsNormPdf(d1)*sigma)/(2*sqrtT) - r*K*Math.exp(-r*T)*(isCall ? bsNormCdf(d2) : -bsNormCdf(-d2))) / 365;
  const vega = S * bsNormPdf(d1) * sqrtT / 100;
  return { iv: sigma, delta, gamma, theta, vega };
};

app.get("/api/optionchain/:symbol", async (req, res) => {
  try {
    const { getAngelOptionData } = require("./services/angelOneService");
    const symbol = req.params.symbol.toUpperCase();
    const expiry = req.query.expiry || '';

    const symbolMaster = getSymbolMaster();

    // Find all NFO options for this underlying
    const regex = new RegExp(`^${symbol}\d`);
    let allOptions = symbolMaster.filter(s => 
      s.exch_seg === 'NFO' && 
      s.instrumenttype && 
      (s.instrumenttype === 'OPTIDX' || s.instrumenttype === 'OPTSTK') &&
      regex.test(s.symbol)
    );

    if (allOptions.length === 0) {
      return res.json({ expiries: [], chain: [], spotPrice: 0 });
    }

    // Extract unique expiries and filter out past dates
    const monthMap = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
    const parseExpiry = (exp) => {
      const day = parseInt(exp.substring(0, 2));
      const mon = monthMap[exp.substring(2, 5)];
      const year = parseInt(exp.substring(5));
      return new Date(year, mon, day);
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiries = [...new Set(allOptions.map(o => o.expiry))]
      .filter(exp => parseExpiry(exp) >= today)
      .sort((a, b) => parseExpiry(a) - parseExpiry(b));
    const selectedExpiry = expiry || expiries[0];

    // Filter by selected expiry
    const expiryOptions = allOptions.filter(o => o.expiry === selectedExpiry);

    // Parse strike and type from each option
    const parsed = expiryOptions.map(o => {
      const isCE = o.symbol.endsWith('CE');
      const isPE = o.symbol.endsWith('PE');
      if (!isCE && !isPE) return null;
      return {
        token: o.token,
        symbol: o.symbol,
        strike: parseFloat(o.strike) / 100,
        type: isCE ? 'CE' : 'PE',
        lotSize: o.lotsize
      };
    }).filter(Boolean);

    // Get unique strikes sorted
    const strikes = [...new Set(parsed.map(p => p.strike))].sort((a, b) => a - b);

    // Fetch live data for all tokens (max 50 at a time from Angel API)
    const allTokens = parsed.map(p => p.token);
    let liveDataMap = {};

    for (let i = 0; i < allTokens.length; i += 50) {
      const batch = allTokens.slice(i, i + 50);
      try {
        const data = await getAngelOptionData(batch);
        data.forEach(d => {
          liveDataMap[d.tradingSymbol] = d;
        });
      } catch (err) {}
    }

    // Fetch spot price for Greeks calculation
    let spotPrice = 0;
    try {
      const indexMap = { 'NIFTY': '^NSEI', 'BANKNIFTY': '^NSEBANK', 'FINNIFTY': '^CNXFIN', 'MIDCPNIFTY': '^NSEMDCP50' };
      const yahooSym = indexMap[symbol] || `${symbol}.NS`;
      const axios = require('axios');
      const https = require('https');
      const agent = new https.Agent({ rejectUnauthorized: false });
      const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1d&range=1d`, { timeout: 5000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
      spotPrice = r.data?.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
    } catch {}

    // Calculate time to expiry in years
    const expiryDate = parseExpiry(selectedExpiry);
    expiryDate.setHours(15, 30, 0, 0); // Market close time IST
    const T = Math.max((expiryDate - new Date()) / (365.25 * 24 * 60 * 60 * 1000), 1/365.25);
    const riskFreeRate = 0.07; // ~7% India risk-free rate

    // Build chain rows with Greeks
    const chain = strikes.map(strike => {
      const ce = parsed.find(p => p.strike === strike && p.type === 'CE');
      const pe = parsed.find(p => p.strike === strike && p.type === 'PE');
      const ceLive = ce ? liveDataMap[ce.symbol] : null;
      const peLive = pe ? liveDataMap[pe.symbol] : null;

      let ceGreeks = null, peGreeks = null;
      if (spotPrice > 0) {
        const ceLtp = ceLive?.ltp || 0;
        const peLtp = peLive?.ltp || 0;
        if (ceLtp > 0) {
          const iv = bsIV(spotPrice, strike, T, riskFreeRate, ceLtp, true);
          ceGreeks = bsGreeks(spotPrice, strike, T, riskFreeRate, iv, true);
        }
        if (peLtp > 0) {
          const iv = bsIV(spotPrice, strike, T, riskFreeRate, peLtp, false);
          peGreeks = bsGreeks(spotPrice, strike, T, riskFreeRate, iv, false);
        }
      }

      return {
        strike,
        ce: ce ? {
          symbol: ce.symbol, token: ce.token, lotSize: ce.lotSize,
          ltp: ceLive?.ltp || 0, oi: ceLive?.opnInterest || 0,
          volume: ceLive?.tradeVolume || 0, change: ceLive?.netChange || 0,
          iv: ceGreeks ? parseFloat((ceGreeks.iv * 100).toFixed(2)) : null,
          delta: ceGreeks ? parseFloat(ceGreeks.delta.toFixed(4)) : null,
          gamma: ceGreeks ? parseFloat(ceGreeks.gamma.toFixed(4)) : null,
          theta: ceGreeks ? parseFloat(ceGreeks.theta.toFixed(2)) : null,
          vega: ceGreeks ? parseFloat(ceGreeks.vega.toFixed(2)) : null
        } : null,
        pe: pe ? {
          symbol: pe.symbol, token: pe.token, lotSize: pe.lotSize,
          ltp: peLive?.ltp || 0, oi: peLive?.opnInterest || 0,
          volume: peLive?.tradeVolume || 0, change: peLive?.netChange || 0,
          iv: peGreeks ? parseFloat((peGreeks.iv * 100).toFixed(2)) : null,
          delta: peGreeks ? parseFloat(peGreeks.delta.toFixed(4)) : null,
          gamma: peGreeks ? parseFloat(peGreeks.gamma.toFixed(4)) : null,
          theta: peGreeks ? parseFloat(peGreeks.theta.toFixed(2)) : null,
          vega: peGreeks ? parseFloat(peGreeks.vega.toFixed(2)) : null
        } : null
      };
    });

    res.json({ expiries, selectedExpiry, chain, symbol, spotPrice });
  } catch (error) {
    console.error("Option chain error:", error.message);
    res.status(500).json({ error: "Failed to fetch option chain" });
  }
});

app.post("/api/options", (req, res) => {
  const { symbol } = req.body;
  if (!symbol) {
    return res.status(400).json({ error: "Symbol is required" });
  }
  
  const symbolMaster = getSymbolMaster();
  const found = symbolMaster.find(s => s.symbol === symbol.toUpperCase() && s.exch_seg === 'NFO');
  
  if (!found) {
    return res.status(404).json({ error: "Symbol not found in NFO" });
  }
  
  const options = getOptions();
  const exists = options.find(o => o.symbol === symbol.toUpperCase());
  if (exists) {
    return res.status(400).json({ error: "Option already exists" });
  }
  
  options.push({ 
    symbol: symbol.toUpperCase(), 
    token: found.token,
    exchange: "NFO",
    lotSize: found.lotsize,
    tickSize: "5.000000"
  });
  fs.writeFileSync(optionsPath, JSON.stringify(options, null, 2));
  
  const tokens = options.map(opt => opt.token);
  updateSubscription(tokens);
  
  res.json({ message: "Option added successfully" });
});

app.delete("/api/options/:symbol", (req, res) => {
  const { symbol } = req.params;
  const options = getOptions();
  const index = options.findIndex(o => o.symbol === symbol.toUpperCase());
  
  if (index === -1) {
    return res.status(404).json({ error: "Option not found" });
  }
  
  options.splice(index, 1);
  fs.writeFileSync(optionsPath, JSON.stringify(options, null, 2));
  res.json({ message: "Option deleted successfully" });
});

// Tracker hits — global for all users
const trackerHitsPath = path.join(__dirname, './data/tracker-hits.json');
const getTrackerHits = () => { try { return JSON.parse(fs.readFileSync(trackerHitsPath, 'utf8')) } catch { return [] } };
const saveTrackerHits = (hits) => fs.writeFileSync(trackerHitsPath, JSON.stringify(hits, null, 2));

app.get("/api/tracker/hits", (req, res) => {
  res.json(getTrackerHits());
});

app.post("/api/tracker/hits", (req, res) => {
  const { hits: newHits } = req.body;
  if (!newHits || !Array.isArray(newHits) || !newHits.length) return res.json({ saved: 0 });
  const existing = getTrackerHits();
  const existingIds = new Set(existing.map(h => h.id + h.hitTime));
  const unique = newHits.filter(h => !existingIds.has(h.id + h.hitTime));
  if (unique.length) {
    const updated = [...unique, ...existing];
    saveTrackerHits(updated);
  }
  res.json({ saved: unique.length });
});

// Fast price-only endpoint for all pages
app.post("/api/prices", async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols) || !symbols.length) return res.json({});
    const unique = [...new Set(symbols)];
    const priceMap = {};
    const axios = require('axios');
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    await Promise.all(
      unique.map(async (sym) => {
        try {
          const skipNS = sym.startsWith('^') || sym.includes('-') || sym.includes('=');
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${skipNS ? sym : sym + '.NS'}?interval=1d&range=1d`;
          const r = await axios.get(url, { timeout: 5000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
          const m = r.data?.chart?.result?.[0]?.meta;
          if (!m) { priceMap[sym] = null; return; }
          const price = m.regularMarketPrice || 0;
          const prevClose = m.chartPreviousClose || 0;
          const pChange = prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : null;
          priceMap[sym] = { price, prevClose, pChange };
        } catch { priceMap[sym] = null; }
      })
    );
    res.json(priceMap);
  } catch (error) {
    res.json({});
  }
});

app.post("/api/peg", (req, res) => {
  const data = getPEG();
  const entry = req.body;
  if (!entry.name) return res.status(400).json({ error: 'Name is required' });
  if (data.find(d => d.name.toUpperCase() === entry.name.toUpperCase()))
    return res.status(400).json({ error: 'Entry already exists' });
  data.push({ ...entry, name: entry.name.toUpperCase(), category: entry.category || 'PEG' });
  fs.writeFileSync(pegPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Added successfully' });
});

app.post("/api/portfolio", (req, res) => {
  const data = getPortfolio();
  const { name, buy, qty } = req.body;
  if (!name || !buy || !qty) return res.status(400).json({ error: 'Name, buy price and quantity required' });
  data.push({ name: name.toUpperCase(), buy: parseFloat(buy), qty: parseInt(qty) });
  fs.writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Added successfully' });
});

app.post("/api/:type", (req, res) => {
  const { type } = req.params;
  const { symbol } = req.body;
  if (!symbol) {
    return res.status(400).json({ error: "Symbol is required" });
  }
  
  let data, filePath;
  switch(type) {
    case 'stocks':
      data = getStocks();
      filePath = stocksPath;
      break;
    case 'indices':
      data = getIndices();
      filePath = indicesPath;
      break;
    case 'commodities':
      data = getCommodities();
      filePath = commoditiesPath;
      break;
    case 'crypto':
      data = getCrypto();
      filePath = cryptoPath;
      break;
    case 'nifty50':
      data = getNifty50();
      filePath = nifty50Path;
      break;
    case 'niftynext50':
      data = getNiftyNext50();
      filePath = niftynext50Path;
      break;
    default:
      return res.status(400).json({ error: "Invalid type" });
  }
  
  const exists = data.find(s => s.symbol === symbol.toUpperCase());
  if (exists) {
    return res.status(400).json({ error: `${type.slice(0, -1)} already exists` });
  }
  
  data.unshift({ symbol: symbol.toUpperCase() });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  signalCache.delete(type);
  res.json({ message: `${type.slice(0, -1)} added successfully`, symbol: symbol.toUpperCase() });
});

app.delete("/api/peg/:name", (req, res) => {
  const data = getPEG();
  const idx = data.findIndex(d => d.name.toUpperCase() === req.params.name.toUpperCase());
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.splice(idx, 1);
  fs.writeFileSync(pegPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Deleted successfully' });
});

app.delete("/api/portfolio/:index", (req, res) => {
  const data = getPortfolio();
  const idx = parseInt(req.params.index);
  if (idx < 0 || idx >= data.length) return res.status(404).json({ error: 'Not found' });
  data.splice(idx, 1);
  fs.writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Deleted successfully' });
});

app.delete("/api/:type/:symbol", (req, res) => {
  const { type, symbol } = req.params;
  
  let data, filePath;
  switch(type) {
    case 'indices':
      data = getIndices();
      filePath = indicesPath;
      break;
    case 'stocks':
      data = getStocks();
      filePath = stocksPath;
      break;
    case 'nifty50':
      data = getNifty50();
      filePath = nifty50Path;
      break;
    case 'niftynext50':
      data = getNiftyNext50();
      filePath = niftynext50Path;
      break;
    case 'commodities':
      data = getCommodities();
      filePath = commoditiesPath;
      break;
    case 'crypto':
      data = getCrypto();
      filePath = cryptoPath;
      break;
    default:
      return res.status(400).json({ error: "Invalid type" });
  }
  
  const index = data.findIndex(s => s.symbol === symbol.toUpperCase());
  
  if (index === -1) {
    return res.status(404).json({ error: `${type.slice(0, -1)} not found` });
  }
  
  data.splice(index, 1);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  res.json({ message: `${type.slice(0, -1)} deleted successfully` });
});

app.get("/api/telegram/test", async (req, res) => {
  try {
    const stocks = getStocks();
    const { sendSignal } = require("./services/telegramService");
    
    // Find first BUY signal from live data
    for (const stock of stocks) {
      try {
        const prices5m = await getStockHistory(stock.symbol, '1d', '3mo');
        if (!prices5m || prices5m.length < 20) continue;
        
        const result = generateSignal(prices5m);
        
        if (result.signal === 'BUY') {
          const price = prices5m[prices5m.length - 1].toFixed(2);
          await sendSignal(
            stock.symbol,
            result.signal,
            price,
            result.rsi.toFixed(2),
            result.ema5.toFixed(2),
            result.ema10.toFixed(2),
            result.ema15.toFixed(2),
            result.ema20.toFixed(2)
          );
          return res.json({ message: "Live BUY signal sent", symbol: stock.symbol });
        }
      } catch (err) {
        continue;
      }
    }
    
    res.json({ message: "No BUY signals found in current market data" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send test signal" });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const axios = require('axios');
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const stocks = getStocks();
    const results = [];

    for (let i = 0; i < stocks.length; i += 3) {
      const batch = stocks.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map(async ({ symbol }) => {
          try {
            const afterDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const url = `https://news.google.com/rss/search?q=${symbol}+stock+NSE+after:${afterDate}&hl=en-IN&gl=IN&ceid=IN:en`;
            const rss = await axios.get(url, { timeout: 10000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
            const xml = rss.data;
            const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
            const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const news = items.map(item => {
              const title = (item.match(/<title>(.*?)<\/title>/) || [])[1] || '';
              const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
              const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
              const source = (item.match(/<source.*?>(.*?)<\/source>/) || [])[1] || '';
              const time = pubDate ? new Date(pubDate) : null;
              return { title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'), publisher: source, link, time: time ? time.toISOString() : null };
            }).filter(n => n.time && new Date(n.time) >= threeMonthsAgo).sort((a, b) => new Date(b.time) - new Date(a.time));
            return { symbol, news };
          } catch { return { symbol, news: [] }; }
        })
      );
      results.push(...batchResults);
    }
    // Fetch general market news
    try {
      const marketQueries = ['Indian+stock+market', 'NSE+BSE+market', 'Nifty+Sensex'];
      const marketNews = [];
      for (const q of marketQueries) {
        try {
          const url = `https://news.google.com/rss/search?q=${q}+after:${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}&hl=en-IN&gl=IN&ceid=IN:en`;
          const rss = await axios.get(url, { timeout: 10000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
          const items = rss.data.match(/<item>[\s\S]*?<\/item>/g) || [];
          const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          items.forEach(item => {
            const title = (item.match(/<title>(.*?)<\/title>/) || [])[1] || '';
            const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
            const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
            const source = (item.match(/<source.*?>(.*?)<\/source>/) || [])[1] || '';
            const time = pubDate ? new Date(pubDate) : null;
            if (time && time >= threeMonthsAgo && !marketNews.find(n => n.title === title.replace(/&amp;/g, '&'))) {
              marketNews.push({ title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'), publisher: source, link, time: time.toISOString() });
            }
          });
        } catch {}
      }
      if (marketNews.length > 0) {
        results.unshift({ symbol: 'MARKET', news: marketNews.sort((a, b) => new Date(b.time) - new Date(a.time)) });
      }
    } catch {}

    res.json(results.filter(r => r.news.length > 0));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

app.get("/api/telegram/status", (req, res) => {
  res.json({ enabled: isTelegramEnabled() });
});

app.post("/api/telegram/toggle", (req, res) => {
  const { enabled } = req.body;
  setTelegramEnabled(!!enabled);
  res.json({ enabled: isTelegramEnabled() });
});

app.get("/api/symbol-master", async (req, res) => {
  try {
    const data = getSymbolMaster();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to load symbol master data" });
  }
});

const getPEG = () => JSON.parse(fs.readFileSync(pegPath, 'utf8'));

// PEG Ratio (Peter Lynch) routes

app.get("/api/peg", (req, res) => {
  const data = getPEG();
  const category = req.query.category;
  res.json(category ? data.filter(d => d.category === category) : data);
});

app.get("/api/peg/categories", (req, res) => {
  const data = getPEG();
  res.json([...new Set(data.map(d => d.category))]);
});

app.get("/api/peg/live", async (req, res) => {
  try {
    const { fetchStockFundamentals } = require('./services/pegService');
    const data = getPEG();
    const category = req.query.category;
    const filtered = category ? data.filter(d => d.category === category) : data;
    if (!filtered.length) return res.json([]);

    const results = await Promise.all(
      filtered.map(async (stock) => {
        try {
          const live = await fetchStockFundamentals(stock.name);
          const epsGrowth = stock.epsGrowth || null;
          const dy = stock.manualDivYield != null ? stock.manualDivYield : (live.dividendYield ?? null);
          const pe = stock.manualPE != null ? stock.manualPE : live.pe;
          const peg = pe && epsGrowth ? parseFloat(((epsGrowth + (dy || 0)) / pe).toFixed(2)) : null;
          let pegStatus = null;
          if (peg !== null) pegStatus = peg >= 1 ? 'Undervalued' : peg >= 0.5 ? 'Fairly Valued' : 'Overvalued';
          return { ...stock, ...live, pe, dividendYield: dy, epsGrowth, peg, pegStatus };
        } catch { return { ...stock, price: 0, pe: null, epsGrowth: stock.epsGrowth || null, peg: null, pegStatus: null }; }
      })
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch PEG live data' });
  }
});

app.get("/api/peg/prices", async (req, res) => {
  try {
    const { fetchPriceOnly } = require('./services/pegService');
    const data = getPEG();
    const category = req.query.category;
    const filtered = category ? data.filter(d => d.category === category) : data;
    const uniqueNames = [...new Set(filtered.map(s => s.name))];
    const priceMap = {};
    await Promise.all(
      uniqueNames.map(async (name) => {
        try { priceMap[name] = await fetchPriceOnly(name); }
        catch { priceMap[name] = null; }
      })
    );
    res.json(priceMap);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

app.put("/api/peg/:name", (req, res) => {
  const data = getPEG();
  const idx = data.findIndex(d => d.name.toUpperCase() === req.params.name.toUpperCase());
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  fs.writeFileSync(pegPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Updated successfully' });
});

const getPortfolio = () => JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));

// Portfolio (COVID) routes

app.get("/api/portfolio", (req, res) => {
  res.json(getPortfolio());
});

app.get("/api/portfolio/live", async (req, res) => {
  try {
    const { fetchStockFundamentals } = require('./services/pegService');
    const data = getPortfolio();
    if (!data.length) return res.json([]);

    // Fetch unique symbols only (cache handles duplicates)
    const uniqueNames = [...new Set(data.map(s => s.name))];
    const liveMap = {};
    await Promise.all(
      uniqueNames.map(async (name) => {
        try { liveMap[name] = await fetchStockFundamentals(name); }
        catch { liveMap[name] = { price: 0, pChange: null }; }
      })
    );

    const results = data.map((stock) => {
      const live = liveMap[stock.name] || { price: 0, pChange: null };
      const holding = parseFloat((stock.buy * stock.qty).toFixed(2));
      const portfolioToday = parseFloat((live.price * stock.qty).toFixed(2));
      const pnl = parseFloat((portfolioToday - holding).toFixed(2));
      const pnlPct = holding ? parseFloat(((pnl / holding) * 100).toFixed(2)) : 0;
      return { ...stock, lastPrice: live.price, pChange: live.pChange, holding, portfolioToday, pnl, pnlPct };
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio live data' });
  }
});

app.get("/api/portfolio/prices", async (req, res) => {
  try {
    const { fetchPriceOnly } = require('./services/pegService');
    const data = getPortfolio();
    if (!data.length) return res.json({});
    const uniqueNames = [...new Set(data.map(s => s.name))];
    const priceMap = {};
    await Promise.all(
      uniqueNames.map(async (name) => {
        try { priceMap[name] = await fetchPriceOnly(name); }
        catch { priceMap[name] = null; }
      })
    );
    res.json(priceMap);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

app.put("/api/portfolio/:index", (req, res) => {
  const data = getPortfolio();
  const idx = parseInt(req.params.index);
  if (idx < 0 || idx >= data.length) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  fs.writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Updated successfully' });
});

// Nifty PE data
app.get("/api/nifty-pe", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, './data/niftype.json'), 'utf8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load Nifty PE data' });
  }
});

app.get("/api/sector-pe", async (req, res) => {
  try {
    const { fetchLiveSectorPE } = require('./services/sectorPEService');
    const liveData = await fetchLiveSectorPE();
    const pegData = getPEG();
    const merged = (liveData || []).map(s => {
      const o = pegData.find(p => p.category === 'SectorPE' && p.name === s.sector);
      if (!o) return s;
      return { ...s, pe: o.pe != null ? o.pe : s.pe, pb: o.pb != null ? o.pb : s.pb };
    });
    res.json(merged);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Sector PE data' });
  }
});

app.put("/api/sector-pe/:sector", (req, res) => {
  const data = getPEG();
  const sector = decodeURIComponent(req.params.sector);
  const idx = data.findIndex(d => d.category === 'SectorPE' && d.name === sector);
  if (idx === -1) {
    data.push({ name: sector, category: 'SectorPE', ...req.body });
  } else {
    data[idx] = { ...data[idx], ...req.body };
  }
  fs.writeFileSync(pegPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Updated successfully' });
});

// History Tracker - backtest CSV + live Yahoo 3mo data
let historyTrackerCache = { data: null, date: null };
// Reset cache on server restart to pick up new CSV files
historyTrackerCache = { data: null, date: null };

function backtestRows(rows, symbol, targetPct, slPct) {
  const hits = [];
  const usedDates = new Set();
  const closes = rows.map(r => r.close);
  for (let i = 20; i < rows.length; i++) {
    const entryDate = rows[i].date.slice(0, 10);
    if (usedDates.has(entryDate)) continue;
    const sig = generateSignal(closes.slice(0, i + 1), rows.slice(Math.max(0, i - 1), i + 1).map(r => ({ high: r.high, low: r.low, close: r.close })));
    if (sig.signal !== 'BUY' && sig.signal !== 'SELL') continue;
    const entry = rows[i].close;
    const isBuy = sig.signal === 'BUY';
    const target = parseFloat((isBuy ? entry * (1 + targetPct / 100) : entry * (1 - targetPct / 100)).toFixed(2));
    const sl = parseFloat((isBuy ? entry * (1 - slPct / 100) : entry * (1 + slPct / 100)).toFixed(2));
    usedDates.add(entryDate);
    for (let j = i + 1; j < rows.length; j++) {
      const h = rows[j].high, l = rows[j].low;
      if (isBuy) {
        if (h >= target) { hits.push({ date: rows[i].date, exitDate: rows[j].date, symbol, signal: 'BUY', entry, target, sl, exitPrice: target, result: 'TARGET', pnlPct: targetPct }); break; }
        if (l <= sl) { hits.push({ date: rows[i].date, exitDate: rows[j].date, symbol, signal: 'BUY', entry, target, sl, exitPrice: sl, result: 'SL', pnlPct: -slPct }); break; }
      } else {
        if (l <= target) { hits.push({ date: rows[i].date, exitDate: rows[j].date, symbol, signal: 'SELL', entry, target, sl, exitPrice: target, result: 'TARGET', pnlPct: targetPct }); break; }
        if (h >= sl) { hits.push({ date: rows[i].date, exitDate: rows[j].date, symbol, signal: 'SELL', entry, target, sl, exitPrice: sl, result: 'SL', pnlPct: -slPct }); break; }
      }
    }
  }
  return hits;
}

app.get("/api/history-tracker", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const forceRefresh = req.query.refresh === '1';
    if (!forceRefresh && historyTrackerCache.data && historyTrackerCache.date === today) {
      return res.json(historyTrackerCache.data);
    }

    const allHits = [];

    const wlStocks = getStocks().map(s => s.symbol);

    // ATR-based target/SL per stock
    const axios = require('axios');
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const stockPctMap = {};
    await Promise.all(wlStocks.map(async (sym) => {
      try {
        const skipNS = sym.startsWith('^') || sym.includes('-') || sym.includes('=');
        const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${skipNS ? sym : sym + '.NS'}?range=1mo&interval=1d`, {
          timeout: 8000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const result = r.data?.chart?.result?.[0];
        if (!result) { stockPctMap[sym] = { targetPct: 6, slPct: 3 }; return; }
        const q = result.indicators.quote[0];
        const candles = [];
        for (let i = 0; i < q.close.length; i++) {
          if (q.high[i] != null && q.low[i] != null && q.close[i] != null)
            candles.push({ high: q.high[i], low: q.low[i], close: q.close[i] });
        }
        if (candles.length < 14) { stockPctMap[sym] = { targetPct: 6, slPct: 3 }; return; }
        const price = candles[candles.length - 1].close;
        const atr = candles.slice(-14).reduce((s, c) => s + (c.high - c.low), 0) / 14;
        stockPctMap[sym] = {
          targetPct: Math.max(parseFloat(((atr * 3 / price) * 100).toFixed(2)), 1),
          slPct: Math.max(parseFloat(((atr * 1.5 / price) * 100).toFixed(2)), 0.5)
        };
      } catch { stockPctMap[sym] = { targetPct: 6, slPct: 3 }; }
    }));


    // CSV files - NSE daily OHLC format
    const csvFiles = [
      { file: 'SUPRIYA-EQ-29-01-2026-29-04-2026.csv', symbol: 'SUPRIYA' },
    ];
    const mnths = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
    const parseNum = (s) => parseFloat((s || '').replace(/"/g, '').replace(/,/g, ''));
    const parseDt = (s) => { const m = (s||'').trim().match(/^(\d{1,2})-(\w{3})-(\d{4})$/); if (!m) return null; const mon = mnths[m[2]]; return mon ? m[3]+'-'+mon+'-'+m[1].padStart(2,'0') : null; };
    for (const { file: csvFile, symbol } of csvFiles) {
      try {
        const raw = fs.readFileSync(path.join(__dirname, './data/', csvFile), 'utf8').replace(/^\uFEFF/, '');
        const csvLines = raw.split('\n').map(l => l.trim()).filter(l => l && /^\d{1,2}-/.test(l));
        const rows = csvLines.map(l => {
          const c = l.split(',').map(s => s.replace(/"/g, '').trim());
          const date = parseDt(c[0]);
          if (!date) return null;
          const open = parseNum(c[2]), high = parseNum(c[3]), low = parseNum(c[4]), close = parseNum(c[7]);
          if (isNaN(close) || isNaN(high) || isNaN(low)) return null;
          return { date, open, high, low, close };
        }).filter(Boolean).reverse();
        if (rows.length < 21) continue;
        const { targetPct, slPct } = stockPctMap[symbol] || { targetPct: 2, slPct: 1 };
        allHits.push(...backtestRows(rows, symbol, targetPct, slPct));
      } catch (e) { console.error('CSV error:', csvFile, e.message); }
    }
    // Live Yahoo - daily 3mo backtest, only watchlist stocks, 1 trade per stock per day
    const batchSize = 5;
    const liveStocks = wlStocks.filter(s => !s.startsWith('^'));
    for (let i = 0; i < liveStocks.length; i += batchSize) {
      const batch = liveStocks.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (sym) => {
        try {
          const ohlc = await getStockHistory(sym, '1d', '3mo', false, false, false, true);
          if (!ohlc || ohlc.length < 25) return [];
          const { targetPct, slPct } = stockPctMap[sym] || { targetPct: 2, slPct: 1 };
          const rows = ohlc.map((bar, idx) => ({ date: `day-${idx}`, open: bar.open, high: bar.high, low: bar.low, close: bar.close }));
          return backtestRows(rows, sym, targetPct, slPct);
        } catch { return []; }
      }));
      batchResults.forEach(h => allHits.push(...h));
    }
    const watchlistSymbols = new Set(wlStocks);
    const stockHits = allHits.filter(h => watchlistSymbols.has(h.symbol));
    stockHits.sort((a, b) => a.date.localeCompare(b.date));
    const result = {
      stocks: { hits: stockHits, targetCount: stockHits.filter(h => h.result === 'TARGET').length, slCount: stockHits.filter(h => h.result === 'SL').length, total: stockHits.length }
    };
    historyTrackerCache = { data: result, date: today };
    res.json(result);
  } catch (error) {
    console.error('History tracker error:', error.message);
    res.status(500).json({ error: 'Failed to run history tracker' });
  }
});

// Auth routes
app.post("/api/auth/login", (req, res) => {
  const { mobile } = req.body;
  const result = loginWithMobile(mobile);
  res.status(result.success ? 200 : 400).json(result);
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = getUserByMobile(req.user.mobile);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, mobile: user.mobile, name: user.name, watchlist: user.watchlist });
});

app.post("/api/auth/refresh", authMiddleware, (req, res) => {
  const user = getUserByMobile(req.user.mobile);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { jwt: jwtLib } = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'stocksignal-secret-key-2024';
  const newToken = require('jsonwebtoken').sign({ mobile: user.mobile, userId: user.id }, JWT_SECRET, { expiresIn: '365d' });
  res.json({ token: newToken, user: { id: user.id, mobile: user.mobile, name: user.name } });
});

app.put("/api/auth/profile", authMiddleware, (req, res) => {
  const { name } = req.body;
  const user = updateUser(req.user.mobile, { name });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, mobile: user.mobile, name: user.name });
});

// User watchlist routes
app.get("/api/auth/watchlist", authMiddleware, (req, res) => {
  const user = getUserByMobile(req.user.mobile);
  res.json(user?.watchlist || []);
});

app.post("/api/auth/watchlist", authMiddleware, (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  const user = getUserByMobile(req.user.mobile);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.watchlist.find(s => s.symbol === symbol.toUpperCase())) return res.status(400).json({ error: 'Already in watchlist' });
  user.watchlist.push({ symbol: symbol.toUpperCase() });
  updateUser(req.user.mobile, { watchlist: user.watchlist });
  res.json({ message: 'Added to watchlist', watchlist: user.watchlist });
});

app.delete("/api/auth/watchlist/:symbol", authMiddleware, (req, res) => {
  const { symbol } = req.params;
  const user = getUserByMobile(req.user.mobile);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.watchlist = user.watchlist.filter(s => s.symbol !== symbol.toUpperCase());
  updateUser(req.user.mobile, { watchlist: user.watchlist });
  res.json({ message: 'Removed from watchlist', watchlist: user.watchlist });
});

// Buyers — stocks where buy quantity >= 60% (NSE India real data)
const { getStockBuyerSeller, getIndexStocks } = require('./services/nseService');
let buyersCache = { data: null, time: 0 };
const BUYERS_CACHE_TTL = 5 * 60 * 1000; // 5 min

app.get("/api/buyers", async (req, res) => {
  try {
    if (buyersCache.data && Date.now() - buyersCache.time < BUYERS_CACHE_TTL) {
      return res.json(buyersCache.data);
    }

    // Get all unique symbols from nifty50 + niftynext50 + watchlist
    const n50 = getNifty50();
    const nn50 = getNiftyNext50();
    const wl = getStocks();
    const allSymbols = [...new Map([...n50, ...nn50, ...wl].map(s => [s.symbol, s])).values()]
      .filter(s => !s.symbol.startsWith('^'));

    // Also get bulk price data from index API for price/volume fallback
    let indexPriceMap = {};
    try {
      const [n50Data, nn50Data] = await Promise.all([
        getIndexStocks('NIFTY 50').catch(() => []),
        getIndexStocks('NIFTY NEXT 50').catch(() => [])
      ]);
      [...n50Data, ...nn50Data].forEach(s => {
        if (s.symbol) indexPriceMap[s.symbol] = s;
      });
    } catch {}

    // Fetch per-stock buy/sell quantities from NSE (batched)
    const results = [];
    const batchSize = 3; // NSE rate limits, keep batches small
    for (let i = 0; i < allSymbols.length; i += batchSize) {
      const batch = allSymbols.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async ({ symbol }) => {
        try {
          const data = await getStockBuyerSeller(symbol);
          const buyQty = data.totalBuyQuantity || 0;
          const sellQty = data.totalSellQuantity || 0;
          const totalQty = buyQty + sellQty;
          if (totalQty === 0) return null;

          const buyPct = parseFloat((buyQty / totalQty * 100).toFixed(2));
          const sellPct = parseFloat((sellQty / totalQty * 100).toFixed(2));
          const idx = indexPriceMap[symbol];
          const price = data.lastPrice || idx?.lastPrice || 0;
          const pChange = data.pChange != null ? parseFloat(parseFloat(data.pChange).toFixed(2)) : (idx?.pChange != null ? parseFloat(parseFloat(idx.pChange).toFixed(2)) : null);
          const vol = data.totalTradedVolume || idx?.totalTradedVolume || 0;
          const totalVolLakh = vol > 0 ? parseFloat((vol / 100000).toFixed(2)) : 0;

          return {
            symbol,
            price: parseFloat(parseFloat(price).toFixed(2)),
            pChange,
            buyPct,
            sellPct,
            totalVolLakh,
            week52High: data.yearHigh ? parseFloat(parseFloat(data.yearHigh).toFixed(2)) : (idx?.yearHigh ? parseFloat(parseFloat(idx.yearHigh).toFixed(2)) : null),
            week52Low: data.yearLow ? parseFloat(parseFloat(data.yearLow).toFixed(2)) : (idx?.yearLow ? parseFloat(parseFloat(idx.yearLow).toFixed(2)) : null),
            timestamp: new Date().toISOString()
          };
        } catch { return null; }
      }));
      results.push(...batchResults.filter(Boolean));
      if (i + batchSize < allSymbols.length) await new Promise(r => setTimeout(r, 300));
    }
    buyersCache = { data: results, time: Date.now() };
    res.json(results);
  } catch (error) {
    console.error('Buyers API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch buyers data' });
  }
});

// Market Mood Index
app.get("/api/market-mood", async (req, res) => {
  try {
    const axios = require('axios');
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const yahooFetch = async (sym, interval='1d', range='1mo') => {
      const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}`, { timeout: 8000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const result = r.data?.chart?.result?.[0];
      if (!result) return null;
      const q = result.indicators.quote[0];
      const closes = q.close.filter(c => c != null);
      return { closes, meta: result.meta };
    };

    // 1. India VIX (lower = greed, higher = fear)
    let vixScore = 50;
    let vixValue = null;
    try {
      const vix = await yahooFetch('^INDIAVIX', '1d', '5d');
      if (vix && vix.closes.length) {
        vixValue = parseFloat(vix.closes[vix.closes.length - 1].toFixed(2));
        // VIX 10-15 = extreme greed, 15-20 = greed, 20-25 = neutral, 25-35 = fear, 35+ = extreme fear
        if (vixValue <= 12) vixScore = 95;
        else if (vixValue <= 15) vixScore = 80;
        else if (vixValue <= 20) vixScore = 65;
        else if (vixValue <= 25) vixScore = 50;
        else if (vixValue <= 30) vixScore = 35;
        else if (vixValue <= 35) vixScore = 20;
        else vixScore = 5;
      }
    } catch {}

    // 2. Nifty 50 breadth (% stocks above 20 EMA)
    const nifty50 = JSON.parse(fs.readFileSync(nifty50Path, 'utf8'));
    let aboveEma = 0, totalChecked = 0;
    const { EMA } = require('technicalindicators');
    const batchSize = 10;
    for (let i = 0; i < nifty50.length; i += batchSize) {
      const batch = nifty50.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (s) => {
        try {
          const d = await yahooFetch(`${s.symbol}.NS`, '1d', '2mo');
          if (!d || d.closes.length < 20) return null;
          const ema20 = EMA.calculate({ period: 20, values: d.closes });
          const lastEma = ema20[ema20.length - 1];
          const lastClose = d.closes[d.closes.length - 1];
          return lastClose > lastEma ? 1 : 0;
        } catch { return null; }
      }));
      results.filter(r => r !== null).forEach(r => { totalChecked++; aboveEma += r; });
    }
    const breadthPct = totalChecked > 0 ? parseFloat((aboveEma / totalChecked * 100).toFixed(1)) : 50;
    const breadthScore = breadthPct; // 0-100 directly maps

    // 3. Nifty momentum (14-period RSI)
    let momentumScore = 50;
    let niftyRsi = null;
    let niftyChange = null;
    try {
      const nifty = await yahooFetch('^NSEI', '1d', '2mo');
      if (nifty && nifty.closes.length >= 15) {
        const closes = nifty.closes;
        const price = closes[closes.length - 1];
        const prevPrice = closes[closes.length - 2];
        niftyChange = parseFloat(((price - prevPrice) / prevPrice * 100).toFixed(2));
        // RSI calculation
        let gains = 0, losses = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
          const diff = closes[i] - closes[i - 1];
          if (diff > 0) gains += diff; else losses -= diff;
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        niftyRsi = parseFloat((100 - 100 / (1 + rs)).toFixed(2));
        momentumScore = niftyRsi; // RSI 0-100 maps directly
      }
    } catch {}

    // 4. Nifty distance from 52-week high/low
    let highLowScore = 50;
    let niftyPrice = null;
    try {
      const niftyY = await yahooFetch('^NSEI', '1wk', '1y');
      if (niftyY && niftyY.closes.length > 10) {
        const closes = niftyY.closes;
        niftyPrice = parseFloat(closes[closes.length - 1].toFixed(2));
        const high52 = Math.max(...closes);
        const low52 = Math.min(...closes);
        highLowScore = high52 !== low52 ? parseFloat(((niftyPrice - low52) / (high52 - low52) * 100).toFixed(1)) : 50;
      }
    } catch {}

    // Weighted composite score
    const moodScore = Math.round(
      vixScore * 0.30 +
      breadthScore * 0.30 +
      momentumScore * 0.25 +
      highLowScore * 0.15
    );

    let mood;
    if (moodScore >= 80) mood = 'Extreme Greed';
    else if (moodScore >= 60) mood = 'Greed';
    else if (moodScore >= 40) mood = 'Neutral';
    else if (moodScore >= 20) mood = 'Fear';
    else mood = 'Extreme Fear';

    res.json({
      score: moodScore,
      mood,
      indicators: {
        vix: { value: vixValue, score: vixScore, label: 'India VIX' },
        breadth: { value: breadthPct, score: Math.round(breadthScore), label: 'Market Breadth', detail: `${aboveEma}/${totalChecked} above 20 EMA` },
        momentum: { value: niftyRsi, score: Math.round(momentumScore), label: 'Nifty RSI' },
        highLow: { value: niftyPrice, score: Math.round(highLowScore), label: '52W High/Low' },
      },
      niftyChange,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Market mood error:', error.message);
    res.status(500).json({ error: 'Failed to compute market mood' });
  }
});

// Quarterly Results — scrape from Yahoo Finance page
app.get("/api/results", async (req, res) => {
  try {
    const axios = require('axios');
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const stocks = [...getNifty50(), ...getStocks()];
    const unique = [...new Map(stocks.map(s => [s.symbol, s])).values()];

    const extractVal = (html, key) => {
      const re = new RegExp(`\\\\"${key}\\\\":\\{\\\\"raw\\\\":([\d.\\-eE+]+)`);
      const m = html.match(re);
      return m ? parseFloat(m[1]) : null;
    };
    const extractArr = (html, key) => {
      const re = new RegExp(`\\\\"${key}\\\\":\\[\\{\\\\"raw\\\\":([\d.\\-eE+]+)`);
      const m = html.match(re);
      return m ? parseFloat(m[1]) : null;
    };

    const results = [];
    const batchSize = 5;
    for (let i = 0; i < unique.length; i += batchSize) {
      const batch = unique.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async ({ symbol }) => {
        try {
          const r = await axios.get(`https://finance.yahoo.com/quote/${symbol}.NS/`, {
            timeout: 15000, httpsAgent: agent,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          const html = r.data;

          const revenue = extractVal(html, 'totalRevenue');
          const netProfit = extractVal(html, 'netIncomeToCommon');
          const opRaw = extractVal(html, 'operatingMargins');
          const operatingMargin = opRaw != null ? parseFloat((opRaw * 100).toFixed(2)) : null;
          const pmRaw = extractVal(html, 'profitMargins');
          const profitMargin = pmRaw != null ? parseFloat((pmRaw * 100).toFixed(2)) : null;
          const dyRaw = extractVal(html, 'dividendYield');
          const dividendYield = dyRaw != null ? parseFloat((dyRaw * 100).toFixed(2)) : null;
          const rgRaw = extractVal(html, 'revenueGrowth');
          const revenueGrowth = rgRaw != null ? parseFloat((rgRaw * 100).toFixed(2)) : null;
          const egRaw = extractVal(html, 'earningsGrowth');
          const earningsGrowth = egRaw != null ? parseFloat((egRaw * 100).toFixed(2)) : null;
          const earningsTs = extractArr(html, 'earningsDate');
          const earningsDate = earningsTs ? new Date(earningsTs * 1000).toISOString().slice(0, 10) : null;
          const forwardEps = extractVal(html, 'forwardEps');
          const trailingEps = extractVal(html, 'trailingEps');

          let overall = 'Neutral';
          let score = 0;
          if (operatingMargin != null && operatingMargin > 15) score++;
          if (profitMargin != null && profitMargin > 10) score++;
          if (revenueGrowth != null && revenueGrowth > 5) score++;
          if (earningsGrowth != null && earningsGrowth > 5) score++;
          if (dividendYield != null && dividendYield > 0.5) score++;
          if (score >= 4) overall = 'Strong';
          else if (score >= 3) overall = 'Decent';
          else if (score >= 2) overall = 'Stable';
          else if (score <= 1) overall = 'Weak';

          return {
            symbol, revenue, netProfit, operatingMargin, profitMargin,
            dividendYield, earningsDate, revenueGrowth, earningsGrowth,
            forwardEps, trailingEps, overall, score
          };
        } catch { return null; }
      }));
      results.push(...batchResults.filter(Boolean));
    }
    res.json(results);
  } catch (error) {
    console.error('Results error:', error.message);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Index Key Levels (manual daily update)
const indexLevelsPath = path.join(__dirname, './data/index-levels.json');
const getIndexLevels = () => JSON.parse(fs.readFileSync(indexLevelsPath, 'utf8'));

app.get('/api/index-levels', (req, res) => {
  res.json(getIndexLevels());
});

app.put('/api/index-levels/:symbol', (req, res) => {
  const data = getIndexLevels();
  const idx = data.findIndex(d => d.symbol.toUpperCase() === req.params.symbol.toUpperCase());
  if (idx === -1) return res.status(404).json({ error: 'Symbol not found' });
  data[idx] = { ...data[idx], ...req.body };
  fs.writeFileSync(indexLevelsPath, JSON.stringify(data, null, 2));
  res.json(data[idx]);
});

// Support & Resistance Levels
const { getLevels, getWatchlistAnalysis } = require('./services/levelsService');

// Watchlist Stock Analysis (EMA Pro, RSI, Volume, Up Chance, Target, SL)
app.get('/api/watchlist-analysis', optionalAuth, async (req, res) => {
  try {
    const { EMA, RSI } = require('technicalindicators');
    const axios = require('axios');
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    let watchlistSymbols = getStocks().map(s => s.symbol);
    if (req.user) {
      const user = getUserByMobile(req.user.mobile);
      const userWl = (user?.watchlist || []).map(w => w.symbol);
      watchlistSymbols = [...new Set([...watchlistSymbols, ...userWl])];
    }
    if (!watchlistSymbols.length) return res.json([]);

    const fetchOHLC = async (symbol, interval, range) => {
      const skipNS = symbol.startsWith('^') || symbol.includes('-') || symbol.includes('=');
      const fullSymbol = skipNS ? symbol : `${symbol}.NS`;
      const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(fullSymbol)}?range=${range}&interval=${interval}`, {
        timeout: 10000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const result = r.data?.chart?.result?.[0];
      if (!result) return null;
      const q = result.indicators.quote[0];
      const meta = result.meta;
      const candles = [];
      for (let i = 0; i < q.close.length; i++) {
        if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null)
          candles.push({ open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] || 0 });
      }
      const price = meta.regularMarketPrice || (candles.length ? candles[candles.length - 1].close : 0);
      const prevClose = meta.chartPreviousClose || 0;
      const avgVol = candles.length >= 20 ? candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20 : 0;
      return { candles, price, prevClose, avgVol };
    };

    const results = await Promise.all(watchlistSymbols.map(async (symbol) => {
      try {
        const [daily, weekly, monthly] = await Promise.all([
          fetchOHLC(symbol, '1d', '1y'),
          fetchOHLC(symbol, '1wk', '2y'),
          fetchOHLC(symbol, '1mo', '5y'),
        ]);
        if (!daily || daily.candles.length < 20) return null;

        const closes = daily.candles.map(c => c.close);
        const price = parseFloat(daily.price.toFixed(2));

        // EMA Pro (7 EMA) for daily/weekly/monthly
        const ema7Daily = daily.candles.length >= 7 ? parseFloat(EMA.calculate({ period: 7, values: closes }).slice(-1)[0].toFixed(2)) : null;
        const ema7Weekly = weekly && weekly.candles.length >= 7 ? parseFloat(EMA.calculate({ period: 7, values: weekly.candles.map(c => c.close) }).slice(-1)[0].toFixed(2)) : null;
        const ema7Monthly = monthly && monthly.candles.length >= 7 ? parseFloat(EMA.calculate({ period: 7, values: monthly.candles.map(c => c.close) }).slice(-1)[0].toFixed(2)) : null;

        // 50 & 200 EMA
        const ema50 = closes.length >= 50 ? EMA.calculate({ period: 50, values: closes }).slice(-1)[0] : null;
        const ema200 = closes.length >= 200 ? EMA.calculate({ period: 200, values: closes }).slice(-1)[0] : null;
        const ema50Above = ema50 != null ? price >= ema50 : null;
        const ema200Above = ema200 != null ? price >= ema200 : null;

        // RSI
        const rsiValues = closes.length >= 15 ? RSI.calculate({ period: 14, values: closes }) : [];
        const rsi = rsiValues.length ? parseFloat(rsiValues[rsiValues.length - 1].toFixed(1)) : null;

        // Volume
        const lastVol = daily.candles[daily.candles.length - 1].volume;
        const volume = daily.avgVol > 0 ? (lastVol >= daily.avgVol * 1.2 ? 'Good' : lastVol < daily.avgVol * 0.7 ? 'Bad' : 'Average') : 'Average';

        // Up Chance score (0-100)
        let score = 0;
        if (ema7Daily && price >= ema7Daily) score += 20;
        if (ema7Weekly && price >= ema7Weekly) score += 20;
        if (ema7Monthly && price >= ema7Monthly) score += 20;
        if (ema50Above) score += 15;
        if (ema200Above) score += 15;
        if (rsi && rsi >= 50 && rsi <= 70) score += 10;
        const upChancePct = score;

        // Status
        let status = 'Weak';
        if (score >= 90) status = 'Strong Buy';
        else if (score >= 70) status = 'Momentum Buy';
        else if (score >= 50) status = 'Buy on Dip';
        else if (score >= 30) status = 'Strong Support';
        else if (score >= 20) status = 'Hold';

        // Target & Stop Loss (based on ATR-like range)
        const recentCandles = daily.candles.slice(-14);
        const atr = recentCandles.reduce((s, c) => s + (c.high - c.low), 0) / recentCandles.length;
        const targetPct = parseFloat(((atr * 3 / price) * 100).toFixed(1));
        const stopLossPct = parseFloat(((atr * 1.5 / price) * 100).toFixed(1));
        const target = parseFloat((price * (1 + targetPct / 100)).toFixed(2));
        const stopLoss = parseFloat((price * (1 - stopLossPct / 100)).toFixed(2));

        // Valuation (simple P/B proxy via 52w position)
        const high52 = Math.max(...closes.slice(-252));
        const low52 = Math.min(...closes.slice(-252));
        const pos52 = high52 !== low52 ? (price - low52) / (high52 - low52) : 0.5;
        const valuation = pos52 < 0.35 ? 'Undervalued' : pos52 > 0.75 ? 'Overvalued' : 'Fair Value';

        return { symbol, price, ema7Daily, ema7Weekly, ema7Monthly, ema50Above, ema200Above, rsi, volume, status, upChancePct, target, targetPct, stopLoss, stopLossPct: -stopLossPct, valuation };
      } catch { return null; }
    }));

    res.json(results.filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch watchlist analysis' });
  }
});

app.get("/api/levels", optionalAuth, async (req, res) => {
  try {
    const indices = getIndices();
    const symbols = indices.map(i => i.symbol);
    const results = (await Promise.all(symbols.map(s => getLevels(s)))).filter(Boolean);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch levels' });
  }
});

app.get("/api/watchlist-analysis", optionalAuth, async (req, res) => {
  try {
    const stocks = getStocks();
    let watchlist = [];
    if (req.user) {
      const user = getUserByMobile(req.user.mobile);
      watchlist = (user?.watchlist || []).map(w => w.symbol);
    }
    const symbols = [...new Set([...stocks.map(s => s.symbol), ...watchlist])];
    const resultsRaw = await Promise.all(symbols.map(s => getWatchlistAnalysis(s)));
    const resultMap = new Map(resultsRaw.filter(Boolean).map(r => [r.symbol, r]));
    const results = symbols.map(s => resultMap.get(s)).filter(Boolean);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch watchlist analysis' });
  }
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  
  const options = getOptions();
  const tokens = options.map(opt => opt.token);
  initializeWebSocket(tokens);
});