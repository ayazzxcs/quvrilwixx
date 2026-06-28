const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// Strong brand cleanup: replace the hero brand block directly.
html = html.replace(/<div class="brandLogo">[\s\S]*?<\/div>\s*<\/div>\s*<div class="badge">/, `<div class="brandLogo">
  <div class="brandMark" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#0C447C"/>
<path d="M16 44 L30 30 L40 38 L52 18" stroke="#378ADD" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="10" y="34" width="13" height="13" rx="3" fill="#B5D4F4"/>
</svg></div>
  <div class="brandText"><b>Quvirl</b><span>Discover Winning Products Before Everyone Else</span></div>
</div>

<div class="badge">`);

// Rename visible brand/site copy from DropTrend to Quvirl.
html = html
  .replace(/DropTrend v2/g, 'Quvirl')
  .replace(/DropTrend/g, 'Quvirl')
  .replace(/Droptrend/g, 'Quvirl')
  .replace(/Drop trend/g, 'Quvirl')
  .replace(/Drop\s*Trend/g, 'Quvirl')
  .replace(/Drop<span class="brandWord">Trend<\/span>/g, 'Quvirl')
  .replace(/<b>Drop<\/b>\s*<span[^>]*>Trend<\/span>/g, '<b>Quvirl</b>')
  .replace(/<span>Drop<\/span>\s*<span[^>]*>Trend<\/span>/g, '<span>Quvirl</span>');

const quvirlCss = `
/* Quvirl brand cleanup: green theme + blue brand + visible background images */
:root{--accent:#6ee7b7!important;--gh-green:#2ea043!important;--gh-green2:#7ee787!important;--gh-blue:#58a6ff!important;--gh-purple:#8957e5!important}

/* Brand name blue only */
.brandTrend,.brandWord,.miniBrand span,.sideBrand span,.brandText b,.miniBrand,.sideBrand{color:#58a6ff!important}
.brandText b{font-size:28px!important;letter-spacing:-.5px!important}
.brandText .brandWord{display:none!important}

/* Make the uploaded logistics/product background images visible again */
.dynamicBg{display:block!important;position:fixed!important;inset:0!important;z-index:-5!important;overflow:hidden!important;background:#010409!important;pointer-events:none!important}
.dynamicBg .bgSlide{display:block!important;position:absolute!important;inset:-8%!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;filter:blur(5px) saturate(1.15) brightness(.72)!important;transition:transform 1.25s ease,opacity 1.25s ease!important;opacity:0!important;transform:translateX(100%) scale(1.08)!important}
.dynamicBg .bgSlide.active{opacity:.46!important;transform:translateX(0) scale(1.08)!important}
.dynamicBg .bgSlide.prev{opacity:0!important;transform:translateX(-100%) scale(1.08)!important}
.dynamicBg::after{content:""!important;display:block!important;position:absolute!important;inset:0!important;background:linear-gradient(180deg,rgba(1,4,9,.54),rgba(1,4,9,.78) 45%,rgba(1,4,9,.94))!important;pointer-events:none!important}
.wrap::after{background:radial-gradient(circle at 50% 38%,rgba(35,134,54,.25),transparent 18%),radial-gradient(circle at 28% 48%,rgba(88,166,255,.18),transparent 22%),radial-gradient(circle at 75% 52%,rgba(46,160,67,.18),transparent 24%),linear-gradient(180deg,rgba(0,27,58,.58) 0%,rgba(3,8,39,.62) 38%,rgba(1,4,9,.88) 78%)!important}

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
@media(max-width:600px){.dynamicBg .bgSlide{background-size:cover!important;filter:blur(4px) saturate(1.1) brightness(.70)!important}.dynamicBg .bgSlide.active{opacity:.38!important}.brandText b{font-size:26px!important}}
`;

html = html.replace(/\/\* Quvirl brand cleanup: green theme \+ blue brand \+ visible background images \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* Quvirl brand cleanup: green theme \+ blue brand \+ background images \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* Quvirl blue-only brand cleanup \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', quvirlCss + '\n</style>');

const bgScript = `
<script>
(function(){
  function forceQuvirlBackground(){
    var a = document.getElementById('bgSlideA');
    var b = document.getElementById('bgSlideB');
    if (!a || !b) return;
    var imgs = ['/assets/bg-logistics-1.svg','/assets/bg-logistics-2.svg','/assets/bg-logistics-3.svg','/assets/bg-logistics-4.svg','/assets/bg-logistics-5.svg','/assets/bg-logistics-6.svg'];
    var i = 0, current = a, next = b;
    current.style.backgroundImage = 'url("' + imgs[0] + '")';
    next.style.backgroundImage = 'url("' + imgs[1] + '")';
    current.classList.add('active');
    if (window.quvirlBgTimer) clearInterval(window.quvirlBgTimer);
    window.quvirlBgTimer = setInterval(function(){
      i++;
      next.style.backgroundImage = 'url("' + imgs[i % imgs.length] + '")';
      next.classList.remove('prev');
      current.classList.remove('active');
      current.classList.add('prev');
      next.classList.add('active');
      var old = current; current = next; next = old;
      setTimeout(function(){ next.classList.remove('prev'); }, 1300);
    }, 5200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', forceQuvirlBackground);
  else forceQuvirlBackground();
  window.addEventListener('load', forceQuvirlBackground);
})();
</script>`;

html = html.replace(/<script>\s*\(function\(\)\{\s*function forceQuvirlBackground\(\)[\s\S]*?<\/script>\s*/g, '');
html = html.replace('</body>', bgScript + '\n</body>');

fs.writeFileSync(file, html, 'utf8');
console.log('Patched Quvirl branding: fixed hero name, restored green accents, forced background image slideshow.');
