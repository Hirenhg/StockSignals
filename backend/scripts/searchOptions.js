const fs = require('fs');
const path = require('path');

const symbolMasterPath = path.join(__dirname, '../data/OpenAPIScripMaster.json');

if (!fs.existsSync(symbolMasterPath)) {
    console.log("Symbol master file not found.");
    process.exit(1);
}

const symbolMaster = JSON.parse(fs.readFileSync(symbolMasterPath, 'utf8'));

console.log("Searching for NIFTY options with strike 23500...\n");
const niftyOptions = symbolMaster.filter(s => 
    s.name === 'NIFTY' && 
    s.exch_seg === 'NFO' &&
    s.symbol.includes('23500')
).slice(0, 10);

niftyOptions.forEach(opt => {
    console.log(`Symbol: ${opt.symbol}, Token: ${opt.token}, Expiry: ${opt.expiry}`);
});

console.log("\n\nSearching for NYKAA options with strike 260...\n");
const nykaaOptions = symbolMaster.filter(s => 
    s.name === 'NYKAA' && 
    s.exch_seg === 'NFO' &&
    s.symbol.includes('260')
).slice(0, 10);

nykaaOptions.forEach(opt => {
    console.log(`Symbol: ${opt.symbol}, Token: ${opt.token}, Expiry: ${opt.expiry}`);
});
