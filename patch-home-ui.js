const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const currencyBox = `<div class="currencyBox">
<span class="small">Currency:</span>
<button class="currencyBtn" id="currencyUSD" onclick="setCurrency('USD')">USD $</button>
<button class="currencyBtn active" id="currencyINR" onclick="setCurrency('INR')">INR ₹</button>
<button class="currencyBtn" id="currencyEUR" onclick="setCurrency('EUR')">EUR €</button>
<button class="currencyBtn" id="currencyGBP" onclick="setCurrency('GBP')">GBP £</button>
<button class="currencyBtn" id="currencyCAD" onclick="setCurrency('CAD')">CAD C$</button>
<button class="currencyBtn" id="currencyAUD" onclick="setCurrency('AUD')">AUD A$</button>
<span class="rateText" id="fxStatus">Loading exchange rate...</span>
</div>`;

html = html.replace(/<div class="currencyBox">[\s\S]*?<span class="rateText" id="fxStatus">Loading exchange rate\.\.\.<\/span>\s*<\/div>/, currencyBox);

html = html.replace(/<select id="market" onchange="resetAndRender\(\)">[\s\S]*?<\/select>\s*<button onclick="exportCSV\(\)">Export CSV<\/button>/, `<select id="market" onchange="resetAndRender()"><option value="all" selected>All markets</option><option value="India">India</option><option value="US">US</option><option value="Worldwide">Worldwide</option></select>`);
html = html.replace(/<button onclick="exportCSV\(\)">Export CSV<\/button>/g, '');

html = html.replace(/let usdToInr = 83\.5;\s*let fxIsLive = false;/, `const currencyRates = { USD: 1, INR: 83.5, EUR: 0.92, GBP: 0.78, CAD: 1.36, AUD: 1.52 };
const currencySymbols = { USD: "$", INR: "₹", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$" };
let usdToInr = currencyRates.INR;
let fxIsLive = false;`);

html = html.replace(/function convertFromUSD\(value\) \{[\s\S]*?\n\}/, `function convertFromUSD(value) {
  const v = num(value);
  return v * (currencyRates[currentCurrency] || 1);
}`);

html = html.replace(/function fmt\(n\) \{[\s\S]*?\n\}/, `function fmt(n) {
  const value = convertFromUSD(n);
  const symbol = currencySymbols[currentCurrency] || "$";
  const localeMap = { USD: "en-US", INR: "en-IN", EUR: "de-DE", GBP: "en-GB", CAD: "en-CA", AUD: "en-AU" };
  return symbol + Number(value).toLocaleString(localeMap[currentCurrency] || "en-US", { maximumFractionDigits: 2 });
}`);

html = html.replace(/function updateCurrencyButtons\(\) \{[\s\S]*?\n\}\n\nasync function loadExchangeRate/, `function updateCurrencyButtons() {
  Object.keys(currencyRates).forEach(code => {
    const btn = document.getElementById("currency" + code);
    if (btn) btn.classList.toggle("active", currentCurrency === code);
  });
  const fx = document.getElementById("fxStatus");
  if (fx) {
    if (currentCurrency === "USD") {
      fx.textContent = "Showing original CJ USD prices";
    } else {
      const rate = currencyRates[currentCurrency] || 1;
      const symbol = currencySymbols[currentCurrency] || "";
      fx.textContent = (fxIsLive ? "Live FX" : "Fallback FX") + ": 1 USD ≈ " + symbol + rate.toFixed(2);
    }
  }
}

async function loadExchangeRate`);

html = html.replace(/const rate = Number\(data\?\.rates\?\.INR\);\s*if \(Number\.isFinite\(rate\) && rate > 1\) \{\s*usdToInr = rate;\s*fxIsLive = true;\s*\}/, `let updated = false;
    Object.keys(currencyRates).forEach(code => {
      const rate = Number(data?.rates?.[code]);
      if (Number.isFinite(rate) && rate > 0) {
        currencyRates[code] = rate;
        updated = true;
      }
    });
    usdToInr = currencyRates.INR;
    fxIsLive = updated;`);

fs.writeFileSync(file, html, 'utf8');
console.log('Patched homepage UI: removed CSV export, kept All markets, added major currencies.');
