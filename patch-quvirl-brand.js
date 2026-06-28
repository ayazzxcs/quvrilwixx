const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

html = html.replace(/<div class="brandLogo">[\s\S]*?<\/div>\s*<\/div>\s*<div class="badge">/, `<div class="brandLogo">
  <div class="brandMark" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#0C447C"/>
<path d="M16 44 L30 30 L40 38 L52 18" stroke="#378ADD" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="10" y="34" width="13" height="13" rx="3" fill="#B5D4F4"/>
</svg></div>
  <div class="brandText"><b>Quvirl</b><span>Discover Winning Products Before Everyone Else</span></div>
</div>

<div class="badge">`);

html = html
  .replace(/DropTrend v2/g, 'Quvirl')
  .replace(/DropTrend/g, 'Quvirl')
  .replace(/Droptrend/g, 'Quvirl')
  .replace(/Drop trend/g, 'Quvirl')
  .replace(/Drop\s*Trend/g, 'Quvirl')
  .replace(/Drop<span class="brandWord">Trend<\/span>/g, 'Quvirl')
  .replace(/<b>Drop<\/b>\s*<span[^>]*>Trend<\/span>/g, '<b>Quvirl</b>')
  .replace(/<span>Drop<\/span>\s*<span[^>]*>Trend<\/span>/g, '<span>Quvirl</span>');

const css = `
/* Quvirl brand: blue name, green theme, no background override */
.brandTrend,.brandWord,.miniBrand span,.sideBrand span,.brandText b,.miniBrand,.sideBrand{color:#58a6ff!important}
.brandText b{font-size:28px!important;letter-spacing:-.5px!important}
.brandText .brandWord{display:none!important}
.badge,.navPill,.winBadge,.visualChip,.pill,.currencyBtn.active,button{background:rgba(46,160,67,.16)!important;border-color:rgba(126,231,135,.38)!important;color:#7ee787!important}
button,.currencyBtn.active{background:linear-gradient(180deg,#238636,#1f6f30)!important;color:#fff!important}
.signalPanel{grid-template-columns:1fr!important;max-width:680px!important}
.signalPanel .signalCard:nth-child(2){display:none!important}
.signalCard span{color:#7ee787!important}
.signalBar i{background:linear-gradient(90deg,#238636,#3fb950,#7ee787)!important;box-shadow:0 0 15px rgba(63,185,80,.55)!important}
.scoreRing{background:conic-gradient(#7ee787 calc(var(--score)*1%),rgba(255,255,255,.10) 0)!important}
.scoreRing b,.profit,.result{color:#7ee787!important}
`;

html = html.replace(/\/\* Quvirl brand:[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* Quvirl brand cleanup:[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* Quvirl blue-only brand cleanup \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', css + '\n</style>');

fs.writeFileSync(file, html, 'utf8');
console.log('Applied Quvirl brand only. Background is controlled by patch-home-background.js.');
