const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// Rename visible brand/site copy from DropTrend to Quvirl.
html = html
  .replace(/DropTrend v2/g, 'Quvirl')
  .replace(/DropTrend/g, 'Quvirl')
  .replace(/Droptrend/g, 'Quvirl')
  .replace(/Drop trend/g, 'Quvirl')
  .replace(/Drop\s*Trend/g, 'Quvirl')
  .replace(/Drop\s*<\/b>\s*<span[^>]*>Trend<\/span>/g, 'Quvirl</b>')
  .replace(/<b>Drop<\/b>\s*<span[^>]*>Trend<\/span>/g, '<b>Quvirl</b>')
  .replace(/<span>Drop<\/span>\s*<span[^>]*>Trend<\/span>/g, '<span>Quvirl</span>')
  .replace(/<div><span>Drop<\/span><span class="brandTrend">Trend<\/span><\/div>/g, '<div><span>Quvirl</span></div>')
  .replace(/<div class="brandText"><b>Drop<\/b>[\s\S]*?<\/div>/g, '<div class="brandText"><b>Quvirl</b><span>Discover Winning Products Before Everyone Else</span></div>')
  .replace(/Quvirl score/g, 'Quvirl score')
  .replace(/Quvirl Signal Engine/g, 'Quvirl Signal Engine');

const quvirlCss = `
/* Quvirl brand cleanup: green theme + blue brand + background images */
:root{--accent:#6ee7b7!important;--gh-green:#2ea043!important;--gh-green2:#7ee787!important;--gh-blue:#58a6ff!important;--gh-purple:#8957e5!important}

/* Brand name blue only */
.brandTrend,.brandWord,.miniBrand span,.sideBrand span,.brandText b,.miniBrand,.sideBrand{color:#58a6ff!important}

/* Restore the product/logistics background slideshow that patch-home-background creates */
.dynamicBg{display:block!important;position:fixed!important;inset:0!important;z-index:-5!important;overflow:hidden!important;background:#010409!important;pointer-events:none!important}
.dynamicBg .bgSlide{display:block!important;position:absolute!important;inset:-4%!important;background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important;filter:blur(9px) saturate(1.08) brightness(.88)!important;transition:transform 1.25s ease,opacity 1.25s ease!important;opacity:0!important;transform:translateX(100%) scale(.88)!important}
.dynamicBg .bgSlide.active{opacity:.22!important;transform:translateX(0) scale(.88)!important}
.dynamicBg .bgSlide.prev{opacity:0!important;transform:translateX(-100%) scale(.88)!important}
.wrap::after{background:radial-gradient(circle at 50% 38%,rgba(35,134,54,.34),transparent 18%),radial-gradient(circle at 28% 48%,rgba(88,166,255,.24),transparent 22%),radial-gradient(circle at 75% 52%,rgba(46,160,67,.22),transparent 24%),linear-gradient(180deg,#001b3a 0%,#030827 38%,#010409 78%)!important}

/* Back to green accents */
.badge,.navPill,.winBadge,.visualChip,.pill,.currencyBtn.active,button{
  background:rgba(46,160,67,.16)!important;
  border-color:rgba(126,231,135,.38)!important;
  color:#7ee787!important;
}
button,.currencyBtn.active{background:linear-gradient(180deg,#238636,#1f6f30)!important;color:#fff!important}
.scoreRing{background:conic-gradient(#7ee787 calc(var(--score)*1%),rgba(255,255,255,.10) 0)!important}
.scoreRing b,.profit,.result{color:#7ee787!important}
.signalPanel{grid-template-columns:1fr!important;max-width:680px!important}
.signalPanel .signalCard:nth-child(2){display:none!important}
.signalCard span{color:#7ee787!important}
.signalBar i{background:linear-gradient(90deg,#238636,#3fb950,#7ee787)!important;box-shadow:0 0 15px rgba(63,185,80,.55)!important}
.signalBar i::after{box-shadow:0 0 12px #7ee787!important}
.stat::after{background:radial-gradient(circle,rgba(63,185,80,.22),transparent 66%)!important}
.stat:hover,.signalCard:hover,.trendLink:hover,.card:hover{border-color:#3fb950!important;box-shadow:0 28px 80px rgba(0,0,0,.60),0 0 0 1px rgba(63,185,80,.20)!important}
.premiumTrending::before,.winningPanel::before,.signalCard::before,.stat::before,.card::before,.trendLink::before,.toolbar::before{background:linear-gradient(120deg,rgba(126,231,135,.68),rgba(46,160,67,.48),rgba(88,166,255,.35),rgba(48,54,61,.28))!important}
.hero::before{border-color:rgba(126,231,135,.34)!important;box-shadow:0 0 0 1px rgba(255,255,255,.05) inset,0 0 80px rgba(63,185,80,.20),0 28px 90px rgba(0,0,0,.65)!important}
@keyframes dtSoftPulse{0%,100%{box-shadow:0 0 0 rgba(63,185,80,0)}50%{box-shadow:0 0 22px rgba(63,185,80,.22)}}
@media(max-width:600px){.dynamicBg .bgSlide{background-size:88% auto!important;opacity:0!important}.dynamicBg .bgSlide.active{opacity:.18!important}}
`;

html = html.replace(/\/\* Quvirl brand cleanup: green theme \+ blue brand \+ background images \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* Quvirl blue-only brand cleanup \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', quvirlCss + '\n</style>');

fs.writeFileSync(file, html, 'utf8');
console.log('Patched Quvirl branding: green accents restored, blue brand name, and background image slideshow enabled.');
