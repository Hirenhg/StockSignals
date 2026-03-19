const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

let cache = { data: null, time: 0 };
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// Map index names to categories
const CATEGORY_MAP = {
  'NIFTY 50': 'Broad Market', 'NIFTY 100': 'Broad Market', 'NIFTY 200': 'Broad Market',
  'NIFTY 500': 'Broad Market', 'NIFTY NEXT 50': 'Broad Market',
  'NIFTY MIDCAP 50': 'Midcap', 'NIFTY MIDCAP 100': 'Midcap', 'NIFTY MIDCAP 150': 'Midcap',
  'NIFTY SMALLCAP 50': 'Smallcap', 'NIFTY SMALLCAP 100': 'Smallcap', 'NIFTY SMALLCAP 250': 'Smallcap',
  'NIFTY BANK': 'Sectoral', 'NIFTY PRIVATE BANK': 'Sectoral', 'NIFTY PSU BANK': 'Sectoral',
  'NIFTY FINANCIAL SERVICES': 'Sectoral', 'NIFTY IT': 'Sectoral', 'NIFTY AUTO': 'Sectoral',
  'NIFTY PHARMA': 'Sectoral', 'NIFTY HEALTHCARE INDEX': 'Sectoral', 'NIFTY FMCG': 'Sectoral',
  'NIFTY METAL': 'Sectoral', 'NIFTY REALTY': 'Sectoral', 'NIFTY ENERGY': 'Sectoral',
  'NIFTY OIL & GAS': 'Sectoral', 'NIFTY INFRASTRUCTURE': 'Sectoral', 'NIFTY COMMODITIES': 'Sectoral',
  'NIFTY MEDIA': 'Sectoral', 'NIFTY CPSE': 'Sectoral', 'NIFTY PSE': 'Sectoral',
  'NIFTY ALPHA 50': 'Thematic', 'NIFTY INDIA DEFENCE': 'Thematic',
  'NIFTY EV & NEW AGE AUTOMOTIVE': 'Thematic', 'NIFTY INDIA CONSUMPTION': 'Thematic',
  'NIFTY INDIA MANUFACTURING': 'Thematic', 'NIFTY CAPITAL MARKETS': 'Thematic',
  'NIFTY INDIA TOURISM': 'Thematic', 'NIFTY INDIA DIGITAL': 'Thematic',
};

const WANTED = new Set(Object.keys(CATEGORY_MAP));

async function fetchLiveSectorPE() {
  if (cache.data && (Date.now() - cache.time) < CACHE_TTL) return cache.data;

  const res = await axios.get('https://www.nseindia.com/api/allIndices', {
    httpsAgent: agent,
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });

  const all = res.data?.data || [];
  const results = all
    .filter(d => WANTED.has(d.index) && d.pe && parseFloat(d.pe) > 0)
    .map(d => ({
      sector: d.index,
      pe: parseFloat(parseFloat(d.pe).toFixed(2)),
      pb: parseFloat(parseFloat(d.pb).toFixed(2)),
      category: CATEGORY_MAP[d.index] || 'Other',
    }));

  if (results.length > 0) {
    cache = { data: results, time: Date.now() };
  }
  return results;
}

module.exports = { fetchLiveSectorPE };
