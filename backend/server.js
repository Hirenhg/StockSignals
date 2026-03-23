process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require('dotenv').config();
const express = require("express");
const fs = require('fs');
const path = require('path');
const getStockHistory = require("./services/stockService");
const { getStockFull } = require("./services/stockService");
const generateSignal = require("./services/signalService");
const { generateEquitySignal } = require("./services/equitySignalService");
const { initTelegram, sendBulkSignals, setTelegramEnabled, isTelegramEnabled } = require("./services/telegramService");
const { requestOTP, verifyOTP, authMiddleware, optionalAuth, getUserByMobile, updateUser } = require("./services/authService");
const TelegramBot = require('node-telegram-bot-api');

const { initializeWebSocket, getLiveData, updateSubscription } = require("./services/angelWebSocket");

initTelegram();

// Telegram bot instance for OTP
const otpBot = process.env.TELEGRAM_BOT_TOKEN ? new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false }) : null;
const otpChatId = process.env.TELEGRAM_CHAT_ID;

const app = express();
const stocksPath = path.join(__dirname, './data/stocks.json');
const indicesPath = path.join(__dirname, './data/indices.json');
const optionsPath = path.join(__dirname, './data/options.json');
const commoditiesPath = path.join(__dirname, './data/commodities.json');
const cryptoPath = path.join(__dirname, './data/crypto.json');
const nifty50Path = path.join(__dirname, './data/nifty50.json');
const niftynext50Path = path.join(__dirname, './data/niftynext50.json');

const getStocks = () => JSON.parse(fs.readFileSync(stocksPath, 'utf8'));
const getIndices = () => JSON.parse(fs.readFileSync(indicesPath, 'utf8'));
const getOptions = () => JSON.parse(fs.readFileSync(optionsPath, 'utf8'));
const getCommodities = () => JSON.parse(fs.readFileSync(commoditiesPath, 'utf8'));
const getCrypto = () => JSON.parse(fs.readFileSync(cryptoPath, 'utf8'));
const getNifty50 = () => JSON.parse(fs.readFileSync(nifty50Path, 'utf8'));
const getNiftyNext50 = () => JSON.parse(fs.readFileSync(niftynext50Path, 'utf8'));

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
            const data = await getStockFull(stock.symbol, '5m', '5d');
            if (!data || !data.closes || data.closes.length < 20) return null;

            const result = generateSignal(data.closes);
            const currentPrice = parseFloat(data.closes[data.closes.length - 1].toFixed(2));
            const prevClose = data.prevClose;
            const pChange = prevClose ? parseFloat(((currentPrice - prevClose) / prevClose * 100).toFixed(2)) : null;

            return {
              symbol: stock.symbol,
              signal: result.signal,
              rsi: result.rsi?.toFixed(2) || '0',
              ema5: result.ema5?.toFixed(2) || '0',
              ema10: result.ema10?.toFixed(2) || '0',
              ema15: result.ema15?.toFixed(2) || '0',
              ema20: result.ema20?.toFixed(2) || '0',
              price: currentPrice.toFixed(2),
              pChange,
              week52High: data.week52High,
              week52Low: data.week52Low,
              timestamp: new Date().toISOString()
            };
          } catch { return null; }
        })
      );
      results.push(...batchResults.filter(r => r !== null));
    }
    res.json(results);

    if (type === 'stocks') {
      const buySignals = results.filter(r => r.signal === 'BUY');
      const sellSignals = results.filter(r => r.signal === 'SELL');
      if (buySignals.length > 0 || sellSignals.length > 0) sendBulkSignals(results);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch signals" });
  }
});

app.get("/api/equity-signals/:type", async (req, res) => {
  try {
    const type = req.params.type || 'stocks';
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
    const batchSize = 10;
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (stock) => {
          try {
            const ohlc5m = await getStockHistory(stock.symbol, '5m', '5d', false, false, false, true);
            if (!ohlc5m || ohlc5m.length < 40) return null;

            const result = generateEquitySignal(ohlc5m);
            const currentPrice = parseFloat(ohlc5m[ohlc5m.length - 1].close.toFixed(2));

            const data = await getStockFull(stock.symbol, '1d', '5d');
            const prevClose = data?.prevClose || null;
            const pChange = prevClose ? parseFloat(((currentPrice - prevClose) / prevClose * 100).toFixed(2)) : null;

            return {
              symbol: stock.symbol,
              signal: result.signal,
              price: currentPrice.toFixed(2),
              ema10: result.ema10?.toFixed(2),
              ema20: result.ema20?.toFixed(2),
              sma40: result.sma40?.toFixed(2),
              channelTop: result.channelTop?.toFixed(2),
              channelBot: result.channelBot?.toFixed(2),
              dirTrend: result.dirTrend,
              barColor: result.barColor,
              goldenCross: result.goldenCross,
              deathCross: result.deathCross,
              pChange,
              week52High: data?.week52High || null,
              week52Low: data?.week52Low || null,
              timestamp: new Date().toISOString()
            };
          } catch { return null; }
        })
      );
      results.push(...batchResults.filter(r => r !== null));
    }
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch equity signals" });
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
    const symbolMaster = JSON.parse(fs.readFileSync(path.join(__dirname, './data/OpenAPIScripMaster.json'), 'utf8'));
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
    const symbolMaster = JSON.parse(fs.readFileSync(path.join(__dirname, './data/OpenAPIScripMaster.json'), 'utf8'));
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
  try {
    const { getAngelOptionData } = require("./services/angelOneService");
    const { sendBulkSignals } = require("./services/telegramService");
    const options = getOptions();
    if (!options || options.length === 0) {
      return res.json([]);
    }

    const liveData = getLiveData();
    const hasWebSocketData = Object.keys(liveData).length > 0;
    
    if (!hasWebSocketData) {
      const tokens = options.map(opt => opt.token);
      const restData = await getAngelOptionData(tokens);
      
      const enrichedOptions = await Promise.all(options.map(async (opt) => {
        const live = restData.find(d => d.tradingSymbol === opt.symbol);
        
        let signal = 'HOLD';
        let rsi = null;
        let ema5 = null;
        let ema10 = null;
        let ema15 = null;
        let ema20 = null;
        
        try {
          const symbolMatch = opt.symbol.match(/^([A-Z]+)/);
          if (!symbolMatch) {
            throw new Error('Invalid symbol format');
          }
          
          let underlyingSymbol = symbolMatch[1];
          
          const indexMap = {
            'NIFTY': '^NSEI',
            'BANKNIFTY': '^NSEBANK',
            'FINNIFTY': '^CNXFIN',
            'MIDCPNIFTY': '^NSEMDCP50'
          };
          
          if (indexMap[underlyingSymbol]) {
            underlyingSymbol = indexMap[underlyingSymbol];
          }
          
          const prices5m = await getStockHistory(underlyingSymbol, '5m', '5d');
          
          if (prices5m && prices5m.length >= 20) {
            const result = generateSignal(prices5m);
            signal = result.signal;
            rsi = result.rsi.toFixed(2);
            ema5 = result.ema5.toFixed(2);
            ema10 = result.ema10.toFixed(2);
            ema15 = result.ema15.toFixed(2);
            ema20 = result.ema20.toFixed(2);
          }
        } catch (err) {}
        
        return {
          ...opt,
          ltp: live?.ltp || 0,
          open: live?.open || 0,
          high: live?.high || 0,
          low: live?.low || 0,
          close: live?.close || 0,
          pChange: live?.ltp && live?.close ? parseFloat(((live.ltp - live.close) / live.close * 100).toFixed(2)) : null,
          signal,
          rsi,
          ema5,
          ema10,
          ema15,
          ema20,
          price: (live?.ltp || 0).toFixed(2),
          symbol: opt.symbol
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
      const ltp = wsLive?.ltp || restLive?.ltp || 0;
      const open = restLive?.open || 0;
      const high = restLive?.high || 0;
      const low = restLive?.low || 0;
      const close = restLive?.close || 0;

      let signal = 'HOLD', rsi = null, ema5 = null, ema10 = null, ema15 = null, ema20 = null;

      try {
        const symbolMatch = opt.symbol.match(/^([A-Z]+)/);
        if (symbolMatch) {
          let underlyingSymbol = symbolMatch[1];
          const indexMap = { 'NIFTY': '^NSEI', 'BANKNIFTY': '^NSEBANK', 'FINNIFTY': '^CNXFIN', 'MIDCPNIFTY': '^NSEMDCP50' };
          if (indexMap[underlyingSymbol]) underlyingSymbol = indexMap[underlyingSymbol];
          const prices5m = await getStockHistory(underlyingSymbol, '5m', '5d');
          if (prices5m && prices5m.length >= 20) {
            const result = generateSignal(prices5m);
            signal = result.signal;
            rsi = result.rsi.toFixed(2);
            ema5 = result.ema5.toFixed(2);
            ema10 = result.ema10.toFixed(2);
            ema15 = result.ema15.toFixed(2);
            ema20 = result.ema20.toFixed(2);
          }
        }
      } catch (err) {}

      return {
        ...opt,
        ltp, open, high, low, close,
        pChange: ltp && close ? parseFloat(((ltp - close) / close * 100).toFixed(2)) : null,
        timestamp: wsLive?.timestamp || null,
        signal, rsi, ema5, ema10, ema15, ema20
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

app.get("/api/optionchain/:symbol", async (req, res) => {
  try {
    const { getAngelOptionData } = require("./services/angelOneService");
    const symbol = req.params.symbol.toUpperCase();
    const expiry = req.query.expiry || '';

    const symbolMasterPath = path.join(__dirname, './data/OpenAPIScripMaster.json');
    const symbolMaster = JSON.parse(fs.readFileSync(symbolMasterPath, 'utf8'));

    // Find all NFO options for this underlying
    const regex = new RegExp(`^${symbol}\\d`);
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

    // Build chain rows
    const chain = strikes.map(strike => {
      const ce = parsed.find(p => p.strike === strike && p.type === 'CE');
      const pe = parsed.find(p => p.strike === strike && p.type === 'PE');
      const ceLive = ce ? liveDataMap[ce.symbol] : null;
      const peLive = pe ? liveDataMap[pe.symbol] : null;

      return {
        strike,
        ce: ce ? {
          symbol: ce.symbol, token: ce.token, lotSize: ce.lotSize,
          ltp: ceLive?.ltp || 0, oi: ceLive?.opnInterest || 0,
          volume: ceLive?.tradeVolume || 0, change: ceLive?.netChange || 0
        } : null,
        pe: pe ? {
          symbol: pe.symbol, token: pe.token, lotSize: pe.lotSize,
          ltp: peLive?.ltp || 0, oi: peLive?.opnInterest || 0,
          volume: peLive?.tradeVolume || 0, change: peLive?.netChange || 0
        } : null
      };
    });

    res.json({ expiries, selectedExpiry, chain, symbol });
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
  
  const symbolMasterPath = path.join(__dirname, './data/OpenAPIScripMaster.json');
  const symbolMaster = JSON.parse(fs.readFileSync(symbolMasterPath, 'utf8'));
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
  
  data.push({ symbol: symbol.toUpperCase() });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  res.json({ message: `${type.slice(0, -1)} added successfully`, symbol: symbol.toUpperCase() });
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
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, './data/OpenAPIScripMaster.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to load symbol master data" });
  }
});

// Fast price-only endpoint for all pages
app.post("/api/prices", async (req, res) => {
  try {
    const { fetchPriceOnly } = require('./services/pegService');
    const { symbols } = req.body;
    if (!symbols || !symbols.length) return res.json({});
    const unique = [...new Set(symbols)];
    const priceMap = {};
    await Promise.all(
      unique.map(async (sym) => {
        try {
          const skipNS = sym.startsWith('^') || sym.includes('-') || sym.includes('=');
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${skipNS ? sym : sym + '.NS'}?interval=1d&range=1d`;
          const axios = require('axios');
          const https = require('https');
          const agent = new https.Agent({ rejectUnauthorized: false });
          const r = await axios.get(url, { timeout: 5000, httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
          const m = r.data?.chart?.result?.[0]?.meta;
          const price = m?.regularMarketPrice || 0;
          const prevClose = m?.chartPreviousClose || 0;
          const pChange = prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : null;
          priceMap[sym] = { price, prevClose, pChange };
        } catch { priceMap[sym] = null; }
      })
    );
    res.json(priceMap);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// PEG Ratio (Peter Lynch) routes
const pegPath = path.join(__dirname, './data/peg.json');
const getPEG = () => JSON.parse(fs.readFileSync(pegPath, 'utf8'));

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
          const dy = live.dividendYield ?? stock.manualDivYield ?? null;
          const peg = live.pe && epsGrowth ? parseFloat((live.pe / (epsGrowth + (dy || 0))).toFixed(2)) : null;
          let pegStatus = null;
          if (peg !== null) pegStatus = peg < 1 ? 'Undervalued' : peg <= 2 ? 'Fairly Valued' : 'Overvalued';
          return { ...stock, ...live, dividendYield: dy, epsGrowth, peg, pegStatus };
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

app.put("/api/peg/:name", (req, res) => {
  const data = getPEG();
  const idx = data.findIndex(d => d.name.toUpperCase() === req.params.name.toUpperCase());
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  fs.writeFileSync(pegPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Updated successfully' });
});

app.delete("/api/peg/:name", (req, res) => {
  const data = getPEG();
  const idx = data.findIndex(d => d.name.toUpperCase() === req.params.name.toUpperCase());
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.splice(idx, 1);
  fs.writeFileSync(pegPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Deleted successfully' });
});

// Portfolio (COVID) routes
const portfolioPath = path.join(__dirname, './data/portfolio.json');
const getPortfolio = () => JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));

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

app.post("/api/portfolio", (req, res) => {
  const data = getPortfolio();
  const { name, buy, qty } = req.body;
  if (!name || !buy || !qty) return res.status(400).json({ error: 'Name, buy price and quantity required' });
  data.push({ name: name.toUpperCase(), buy: parseFloat(buy), qty: parseInt(qty) });
  fs.writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Added successfully' });
});

app.put("/api/portfolio/:index", (req, res) => {
  const data = getPortfolio();
  const idx = parseInt(req.params.index);
  if (idx < 0 || idx >= data.length) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  fs.writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Updated successfully' });
});

app.delete("/api/portfolio/:index", (req, res) => {
  const data = getPortfolio();
  const idx = parseInt(req.params.index);
  if (idx < 0 || idx >= data.length) return res.status(404).json({ error: 'Not found' });
  data.splice(idx, 1);
  fs.writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
  res.json({ message: 'Deleted successfully' });
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
    res.json(liveData || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Sector PE data' });
  }
});

// Auth routes
app.post("/api/auth/send-otp", (req, res) => {
  const { mobile } = req.body;
  const result = requestOTP(mobile, otpBot, otpChatId);
  res.status(result.success ? 200 : 400).json(result);
});

app.post("/api/auth/verify-otp", (req, res) => {
  const { mobile, otp } = req.body;
  const result = verifyOTP(mobile, otp);
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

// Paper Trading routes
app.get("/api/paper-trade/wallet", authMiddleware, (req, res) => {
  const user = getUserByMobile(req.user.mobile);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.wallet) {
    user.wallet = { balance: 1000000, initialBalance: 1000000 };
    user.positions = [];
    user.trades = [];
    updateUser(req.user.mobile, { wallet: user.wallet, positions: user.positions, trades: user.trades });
  }
  res.json({ wallet: user.wallet, positions: user.positions || [], trades: (user.trades || []).slice(-50).reverse() });
});

app.post("/api/paper-trade/buy", authMiddleware, (req, res) => {
  const { symbol, price, qty } = req.body;
  if (!symbol || !price || !qty) return res.status(400).json({ error: 'Symbol, price and qty required' });
  const buyPrice = parseFloat(price);
  const buyQty = parseInt(qty);
  const cost = buyPrice * buyQty;
  const user = getUserByMobile(req.user.mobile);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.wallet) { user.wallet = { balance: 1000000, initialBalance: 1000000 }; user.positions = []; user.trades = []; }
  if (user.wallet.balance < cost) return res.status(400).json({ error: 'Insufficient balance' });

  user.wallet.balance = parseFloat((user.wallet.balance - cost).toFixed(2));
  const existing = (user.positions || []).find(p => p.symbol === symbol.toUpperCase());
  if (existing) {
    const totalQty = existing.qty + buyQty;
    existing.avgPrice = parseFloat(((existing.avgPrice * existing.qty + buyPrice * buyQty) / totalQty).toFixed(2));
    existing.qty = totalQty;
  } else {
    if (!user.positions) user.positions = [];
    user.positions.push({ symbol: symbol.toUpperCase(), avgPrice: buyPrice, qty: buyQty });
  }
  if (!user.trades) user.trades = [];
  user.trades.push({ symbol: symbol.toUpperCase(), type: 'BUY', price: buyPrice, qty: buyQty, total: cost, date: new Date().toISOString() });
  updateUser(req.user.mobile, { wallet: user.wallet, positions: user.positions, trades: user.trades });
  res.json({ message: 'Buy order executed', wallet: user.wallet, positions: user.positions });
});

app.post("/api/paper-trade/sell", authMiddleware, (req, res) => {
  const { symbol, price, qty } = req.body;
  if (!symbol || !price || !qty) return res.status(400).json({ error: 'Symbol, price and qty required' });
  const sellPrice = parseFloat(price);
  const sellQty = parseInt(qty);
  const user = getUserByMobile(req.user.mobile);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.positions) return res.status(400).json({ error: 'No positions to sell' });
  const pos = user.positions.find(p => p.symbol === symbol.toUpperCase());
  if (!pos || pos.qty < sellQty) return res.status(400).json({ error: 'Insufficient quantity' });

  const proceeds = sellPrice * sellQty;
  user.wallet.balance = parseFloat((user.wallet.balance + proceeds).toFixed(2));
  pos.qty -= sellQty;
  if (pos.qty === 0) user.positions = user.positions.filter(p => p.symbol !== symbol.toUpperCase());
  if (!user.trades) user.trades = [];
  user.trades.push({ symbol: symbol.toUpperCase(), type: 'SELL', price: sellPrice, qty: sellQty, total: proceeds, date: new Date().toISOString() });
  updateUser(req.user.mobile, { wallet: user.wallet, positions: user.positions, trades: user.trades });
  res.json({ message: 'Sell order executed', wallet: user.wallet, positions: user.positions });
});

app.post("/api/paper-trade/reset", authMiddleware, (req, res) => {
  const user = getUserByMobile(req.user.mobile);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.wallet = { balance: 1000000, initialBalance: 1000000 };
  user.positions = [];
  user.trades = [];
  updateUser(req.user.mobile, { wallet: user.wallet, positions: user.positions, trades: user.trades });
  res.json({ message: 'Paper trading account reset', wallet: user.wallet });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  
  const options = getOptions();
  const tokens = options.map(opt => opt.token);
  initializeWebSocket(tokens);
});