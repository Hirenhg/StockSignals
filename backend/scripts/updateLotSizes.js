const fs = require('fs');
const path = require('path');

const symbolMasterPath = path.join(__dirname, '../data/OpenAPIScripMaster.json');
const optionsPath = path.join(__dirname, '../data/options.json');

const symbolMaster = JSON.parse(fs.readFileSync(symbolMasterPath, 'utf8'));
const options = JSON.parse(fs.readFileSync(optionsPath, 'utf8'));

console.log("Updating lot sizes...\n");

options.forEach(opt => {
    const found = symbolMaster.find(s => s.symbol === opt.symbol && s.exch_seg === 'NFO');
    if (found) {
        console.log(`${opt.symbol}: ${opt.lotSize} -> ${found.lotsize}`);
        opt.lotSize = found.lotsize;
    } else {
        console.log(`${opt.symbol}: NOT FOUND in symbol master`);
    }
});

fs.writeFileSync(optionsPath, JSON.stringify(options, null, 2));
console.log("\nLot sizes updated successfully!");
