const fs = require('fs');
const path = require('path');

const symbolMasterPath = path.join(__dirname, '../data/OpenAPIScripMaster.json');

if (!fs.existsSync(symbolMasterPath)) {
    console.log("Symbol master file not found. Please download from Angel One.");
    process.exit(1);
}

const symbolMaster = JSON.parse(fs.readFileSync(symbolMasterPath, 'utf8'));

const searchSymbols = [
    'NIFTY30MAR2523500CE',
    'NIFTY30MAR2523500PE',
    'NYKAA28MAR25260CE',
    'NYKAA28MAR25260PE'
];

console.log("Searching for option tokens...\n");

searchSymbols.forEach(symbol => {
    const found = symbolMaster.find(s => s.symbol === symbol && s.exch_seg === 'NFO');
    if (found) {
        console.log(`${symbol}:`);
        console.log(`  Token: ${found.token}`);
        console.log(`  Name: ${found.name}`);
        console.log(`  Lot Size: ${found.lotsize}`);
        console.log();
    } else {
        console.log(`${symbol}: NOT FOUND`);
        console.log();
    }
});

console.log("\nSearching for NIFTY MAR 2025 options...");
const niftyOptions = symbolMaster.filter(s => 
    s.symbol.includes('NIFTY') && 
    s.symbol.includes('MAR25') && 
    s.exch_seg === 'NFO' &&
    (s.symbol.includes('23500CE') || s.symbol.includes('23500PE'))
);

console.log(`Found ${niftyOptions.length} NIFTY options:`);
niftyOptions.slice(0, 5).forEach(opt => {
    console.log(`  ${opt.symbol} - Token: ${opt.token}`);
});
