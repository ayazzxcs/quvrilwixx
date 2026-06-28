const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// Rename visible brand/site copy from DropTrend to Quvirl.
html = html
  .replace(/DropTrend v2/g, 'Quvirl')
  .replace(/DropTrend/g, 'Quvirl')
  .replace(/Droptrend/g, 'Quvirl')
  .replace(/Drop trend/g, 'Quvirl')
  .replace(/DropTrend score/g, 'Quvirl score')
  .replace(/DropTrend guides/g, 'Quvirl guides')
  .replace(/DropTrend Signal Engine/g, 'Quvirl Signal Engine')
  .replace(/<span>Drop<\/span><span class="brandTrend">Trend<\/span>/g, '<span>Quvirl</span>')
  .replace(/<b>Drop<\/b>\s*<span class="brandWord">Trend<\/span>/g, '<b>Quvirl</b>')
  .replace(/<b>Drop<\/b>\s*<span>Trend<\/span>/g, '<b>Quvirl</b>')
  .replace(/<div><span>Drop<\/span><span class="brandTrend">Trend<\/span><\/div>/g, '<div><span>Quvirl</span></div>')
  .replace(/<div class="brandText"><b>Drop<\/b><span[^>]*>Trend<\/span>/g, '<div class="brandText"><b>Quvirl</b><span')
  .replace(/<div class="brandText"><b>Drop<\/b>\s*<span>Trend<\/span>/g, '<div class="brandText"><b>Quvirl</b><span>')
  .replace(/<div class="brandText"><b>Drop<\/b>/g, '<div class="brandText"><b>Quvirl</b>')
  .replace(/<span>Drop<\/span>\s*<span class="brandTrend">Trend<\/span>/g, '<span>Quvirl</span>')
  .replace(/Drop\s*<span class="brandTrend">Trend<\/span>/g, 'Quvirl');

const quvirlCss = `
/* Quvirl blue-only brand cleanup */
:root{--accent:#58a6ff!important;--gh-green:#58a6ff!important;--gh-green2:#79c0ff!important;--gh-blue:#58a6ff!important;--gh-purple:#1f6feb!important}
.brandTrend,.brandWord,.miniBrand span,.sideBrand span{color:#58a6ff!important}
.brandText b,.miniBrand,.sideBrand{color:#f0f6fc!important}
.badge,.navPill,.winBadge,.visualChip,.pill,.currencyBtn.active,button{
  background:rgba(31,111,235,.18)!important;
  border-color:rgba(88,166,255,.45)!important;
  color:#dbeafe!important;
}
button,.currencyBtn.active{background:linear-gradient(180deg,#1f6feb,#0d419d)!important;color:#fff!important}
.scoreRing{background:conic-gradient(#58a6ff calc(var(--score)*1%),rgba(255,255,255,.10) 0)!important}
.scoreRing b,.profit,.result{color:#79c0ff!important}
.signalPanel{grid-template-columns:1fr!important;max-width:680px!important}
.signalPanel .signalCard:nth-child(2){display:none!important}
.signalCard span{color:#79c0ff!important}
.signalBar i{background:linear-gradient(90deg,#1f6feb,#58a6ff,#79c0ff)!important;box-shadow:0 0 15px rgba(88,166,255,.55)!important}
.signalBar i::after{box-shadow:0 0 12px #79c0ff!important}
.stat::after{background:radial-gradient(circle,rgba(88,166,255,.22),transparent 66%)!important}
.stat:hover,.signalCard:hover,.trendLink:hover,.card:hover{border-color:#58a6ff!important;box-shadow:0 28px 80px rgba(0,0,0,.60),0 0 0 1px rgba(88,166,255,.22)!important}
.premiumTrending::before,.winningPanel::before,.signalCard::before,.stat::before,.card::before,.trendLink::before,.toolbar::before{background:linear-gradient(120deg,rgba(88,166,255,.78),rgba(31,111,235,.52),rgba(121,192,255,.46),rgba(48,54,61,.28))!important}
.wrap::after{background:radial-gradient(circle at 50% 38%,rgba(31,111,235,.66),transparent 18%),radial-gradient(circle at 28% 48%,rgba(88,166,255,.38),transparent 22%),radial-gradient(circle at 75% 52%,rgba(121,192,255,.28),transparent 24%),linear-gradient(180deg,#000b49 0%,#030827 38%,#010409 78%)!important}
.hero::before{border-color:rgba(88,166,255,.44)!important;box-shadow:0 0 0 1px rgba(255,255,255,.05) inset,0 0 80px rgba(88,166,255,.32),0 28px 90px rgba(0,0,0,.65)!important}
@keyframes dtSoftPulse{0%,100%{box-shadow:0 0 0 rgba(88,166,255,0)}50%{box-shadow:0 0 22px rgba(88,166,255,.22)}}
`;

html = html.replace(/\/\* Quvirl blue-only brand cleanup \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', quvirlCss + '\n</style>');

fs.writeFileSync(file, html, 'utf8');
console.log('Patched Quvirl branding: blue-only accents and removed Product Intelligence box.');
