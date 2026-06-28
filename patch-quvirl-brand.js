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
/* Quvirl brand: blue name, green theme, mobile layout fix */
html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
.wrap{width:100%!important;max-width:1240px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}
.hero,.topNav,.toolbar,.premiumTrending,.winningPanel,.panel,.grid,.winnerGrid{max-width:100%!important;box-sizing:border-box!important}
.brandTrend,.brandWord,.miniBrand span,.sideBrand span,.brandText b,.miniBrand,.sideBrand{color:#58a6ff!important}
.brandText b{font-size:28px!important;letter-spacing:-.5px!important}
.brandText .brandWord{display:none!important}
.badge,.navPill,.winBadge,.visualChip,.pill,.currencyBtn.active,button{background:rgba(46,160,67,.16)!important;border-color:rgba(126,231,135,.38)!important;color:#7ee787!important}
button,.currencyBtn.active{background:linear-gradient(180deg,#238636,#1f6f30)!important;color:#fff!important}
.signalPanel{grid-template-columns:1fr 1fr!important;max-width:980px!important;gap:16px!important}
.signalPanel .signalCard:nth-child(2){display:block!important}
.signalCard span{color:#7ee787!important}
.signalBar i{background:linear-gradient(90deg,#238636,#3fb950,#7ee787)!important;box-shadow:0 0 15px rgba(63,185,80,.55)!important}
.scoreRing{background:conic-gradient(#7ee787 calc(var(--score)*1%),rgba(255,255,255,.10) 0)!important}
.scoreRing b,.profit,.result{color:#7ee787!important}
.hero::after{overflow:hidden!important;white-space:pre-wrap!important;word-break:break-word!important;max-width:calc(100vw - 40px)!important}
.toolbar input,.toolbar select{min-width:0!important;width:100%!important}
@media(max-width:700px){
  .wrap{padding:14px!important;max-width:100%!important;overflow:hidden!important}
  .topNav{width:100%!important;margin-left:0!important;margin-right:0!important}
  .hero{text-align:center!important;padding-left:0!important;padding-right:0!important;overflow:hidden!important}
  h1{max-width:100%!important;font-size:clamp(34px,9vw,48px)!important;line-height:1.02!important;letter-spacing:-1.5px!important}
  .lead{max-width:100%!important;font-size:14px!important}
  .stats{grid-template-columns:1fr!important;width:100%!important;max-width:100%!important}
  .currencyBox{justify-content:center!important;width:100%!important}
  .signalPanel{grid-template-columns:1fr 1fr!important;width:100%!important;max-width:100%!important;gap:10px!important}
  .signalCard{padding:12px!important;min-width:0!important;overflow:hidden!important}
  .signalCard b{font-size:14px!important;line-height:1.2!important}
  .signalCard span{font-size:9px!important}
  .signalCard p.small{font-size:9px!important;line-height:1.35!important}
  .signalRow{grid-template-columns:46px 1fr 24px!important;gap:5px!important}
  .signalRow>span:first-child{font-size:8px!important}
  .signalRow>b{font-size:10px!important}
  .signalBar{height:7px!important}
  .visualChips{gap:5px!important}
  .visualChip{font-size:8px!important;padding:5px 6px!important}
  .toolbar{grid-template-columns:1fr!important;width:100%!important;margin-left:0!important;margin-right:0!important}
  .premiumTrending,.winningPanel{width:100%!important;margin-left:0!important;margin-right:0!important}
  .trendLinks{grid-template-columns:1fr!important}
  .winnerGrid,.grid{grid-template-columns:1fr!important;width:100%!important}
  .card{width:100%!important;max-width:100%!important}
}
`;

html = html.replace(/\/\* Quvirl brand:[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* Quvirl brand cleanup:[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* Quvirl blue-only brand cleanup \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', css + '\n</style>');

fs.writeFileSync(file, html, 'utf8');
console.log('Applied Quvirl brand, mobile width fix, and side-by-side Product Intelligence box.');
