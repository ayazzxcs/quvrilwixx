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
html = html.replace(/<select id="market" onchange="resetAndRender\(\)">[\s\S]*?<\/select>\s*<button onclick="exportCSV\(\)">Export CSV<\/button>/, `<select id="market" onchange="resetAndRender()"><option value="all" selected>All markets</option></select>`);
html = html.replace(/<select id="market" onchange="resetAndRender\(\)">[\s\S]*?<\/select>/, `<select id="market" onchange="resetAndRender()"><option value="all" selected>All markets</option></select>`);
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
    if (currentCurrency === "USD") fx.textContent = "Showing original CJ USD prices";
    else {
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
      if (Number.isFinite(rate) && rate > 0) { currencyRates[code] = rate; updated = true; }
    });
    usdToInr = currencyRates.INR;
    fxIsLive = updated;`);

const githubHeroCss = `
/* DropTrend GitHub homepage inspired upgrade */
:root{--gh-bg:#010409;--gh-card:#0d1117;--gh-card2:#070b12;--gh-border:#30363d;--gh-text:#f0f6fc;--gh-muted:#8b949e;--gh-green:#2ea043;--gh-green2:#7ee787;--gh-blue:#58a6ff;--gh-purple:#bc8cff;--gh-violet:#8957e5}
html{scroll-behavior:smooth}body{background:#010409!important;color:var(--gh-text)!important;overflow-x:hidden}
body::before,body::after,.bg-orb,.orb1,.orb2,.orb3,.bgSpark{display:none!important;background:none!important;animation:none!important}.dynamicBg,.dynamicBg .bgSlide{background:none!important;opacity:0!important}.wrap::before{display:none!important}
.wrap::after{content:"";position:fixed;inset:-18% -20% auto -20%;height:820px;z-index:-5;pointer-events:none;background:radial-gradient(circle at 50% 38%,rgba(137,87,229,.62),transparent 18%),radial-gradient(circle at 28% 48%,rgba(88,166,255,.34),transparent 22%),radial-gradient(circle at 75% 52%,rgba(188,140,255,.30),transparent 24%),linear-gradient(180deg,#000b49 0%,#030827 38%,#010409 78%);filter:saturate(1.1);animation:dtSpaceGlow 10s ease-in-out infinite alternate}
.wrap{max-width:1240px!important}.hero{position:relative;text-align:center;padding-top:58px!important;padding-bottom:300px!important;min-height:720px}.hero>*{position:relative;z-index:2}.brandLogo{justify-content:center}.brandMark{box-shadow:0 0 34px rgba(88,166,255,.38)!important}.badge{margin-inline:auto;background:rgba(88,166,255,.08)!important;border:1px solid rgba(88,166,255,.30)!important;color:#dbeafe!important}
h1{max-width:850px;margin:24px auto 18px!important;font-size:clamp(42px,7vw,76px)!important;line-height:.98!important;letter-spacing:-3px!important;color:#fff!important;text-shadow:0 0 42px rgba(188,140,255,.28)}.lead{max-width:760px;margin:0 auto!important;color:#d0d7de!important;font-size:18px!important}.stats{max-width:780px;margin:26px auto 0!important}.currencyBox{justify-content:center}.signalPanel{max-width:980px;margin-left:auto!important;margin-right:auto!important}
.hero::before{content:"";position:absolute;left:50%;bottom:34px;width:min(980px,96vw);height:270px;transform:translateX(-50%);border-radius:24px;background:linear-gradient(180deg,rgba(88,166,255,.28),rgba(188,140,255,.18) 16%,rgba(13,17,23,.96) 17%,rgba(7,11,18,.98));border:1px solid rgba(88,166,255,.38);box-shadow:0 0 0 1px rgba(255,255,255,.05) inset,0 0 80px rgba(137,87,229,.35),0 28px 90px rgba(0,0,0,.65);animation:dtLaptopFloat 5s ease-in-out infinite}
.hero::after{content:"DropTrend Signal Engine\\A  const signals = await market.scan({ google: true, amazon: true, supplier: 'CJ' });\\A  score.products().rankBy('real_market_demand');\\A  deploy.trendingPages(1500);";white-space:pre;text-align:left;position:absolute;left:50%;bottom:72px;width:min(860px,82vw);height:176px;transform:translateX(-50%);border-radius:14px;background:linear-gradient(180deg,#0d1117,#070b12);border:1px solid #30363d;color:#8b949e;font:600 13px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:22px 24px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);animation:dtCodePulse 3.4s ease-in-out infinite}.hero .heroCard{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}
.topNav,.panel,.toolbar,.premiumTrending,.winningPanel,.stat,.signalCard,.card,.trendLink,.m,.metric,.siteChip{background:linear-gradient(180deg,#0d1117,#070b12)!important;border:1px solid var(--gh-border)!important;box-shadow:0 18px 50px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.035)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.toolbar{margin-top:-235px!important;position:relative;z-index:8}.premiumTrending,.winningPanel,.signalCard,.stat,.card,.trendLink,.toolbar{position:relative;overflow:hidden;border-radius:22px!important}.premiumTrending::before,.winningPanel::before,.signalCard::before,.stat::before,.card::before,.trendLink::before,.toolbar::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(120deg,rgba(88,166,255,.65),rgba(126,231,135,.42),rgba(188,140,255,.55),rgba(48,54,61,.28));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.26;pointer-events:none;transition:opacity .3s}.premiumTrending:hover::before,.winningPanel:hover::before,.signalCard:hover::before,.stat:hover::before,.card:hover::before,.trendLink:hover::before,.toolbar:hover::before{opacity:.9}
h1,.sectionTitle h2,.winningHead h2,.premiumTrending h2{color:#fff!important}.lead,.muted,.small,.premiumTrending p,.winningHead p,.rateText{color:var(--gh-muted)!important}.badge,.navPill,.winBadge,.visualChip,.pill{background:rgba(46,160,67,.14)!important;border:1px solid rgba(126,231,135,.32)!important;color:var(--gh-green2)!important}
input,select,button,.currencyBtn{background:#0d1117!important;border:1px solid #30363d!important;color:#f0f6fc!important}button,.currencyBtn.active{background:#238636!important;border-color:#3fb950!important;color:#fff!important}.currencyBtn:not(.active){background:#0d1117!important;color:#f0f6fc!important}
.motion-ready .topNav,.motion-ready .hero,.motion-ready .premiumTrending,.motion-ready .winningPanel,.motion-ready .sectionTitle,.motion-ready .panel{animation:dtFadeUp .75s cubic-bezier(.22,1,.36,1) both}.motion-ready .stat,.motion-ready .trendLink,.motion-ready .signalCard,.motion-ready .card{opacity:0;transform:translateY(20px) scale(.985)}.motion-ready .dt-in{animation:dtFadeUp .62s cubic-bezier(.22,1,.36,1) forwards}.stat{transition:transform .28s,border-color .28s,box-shadow .28s!important}.stat:hover,.signalCard:hover,.trendLink:hover{transform:translateY(-4px);border-color:#58a6ff!important;box-shadow:0 26px 70px rgba(0,0,0,.55),0 0 0 1px rgba(88,166,255,.22)!important}.stat b{color:#f0f6fc!important;background:none!important;-webkit-text-fill-color:#f0f6fc}.stat::after{content:"";position:absolute;width:110px;height:110px;right:-55px;top:-55px;border-radius:50%;background:radial-gradient(circle,rgba(88,166,255,.20),transparent 66%);animation:dtOrbBreathe 4s ease-in-out infinite}
.signalCard span{color:#7ee787!important;font-weight:900!important}.signalBars{gap:12px!important;margin:16px 0!important}.signalRow{grid-template-columns:82px 1fr 45px!important;gap:10px!important;align-items:center!important}.signalRow>span:first-child{color:#8b949e!important;font-weight:900!important;text-transform:uppercase;letter-spacing:.45px!important}.signalRow>span:last-child{color:#f0f6fc!important;font-weight:900!important;text-align:right!important}.signalBar{height:9px!important;background:#010409!important;border:1px solid #30363d!important;border-radius:999px!important;overflow:hidden!important;box-shadow:inset 0 1px 6px rgba(0,0,0,.65)!important;position:relative!important}.signalBar::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(240,246,252,.16),transparent);transform:translateX(-120%);animation:dtBarSweep 2.2s ease-in-out infinite}.signalBar i{height:100%!important;border-radius:999px!important;background:linear-gradient(90deg,#238636,#3fb950,#7ee787)!important;background-size:220% 100%!important;box-shadow:0 0 15px rgba(63,185,80,.55)!important;transform-origin:left;animation:dtBarGrow 1.1s cubic-bezier(.22,1,.36,1) both,dtBarFlow 2.4s linear infinite!important;position:relative!important}.signalBar i::after{content:"";position:absolute;right:-4px;top:50%;width:8px;height:8px;border-radius:50%;background:#f0fff4;box-shadow:0 0 12px #7ee787;transform:translateY(-50%)}
.card{transition:transform .28s,border-color .28s,box-shadow .28s!important}.card:hover{transform:translateY(-7px);border-color:#58a6ff!important;box-shadow:0 30px 80px rgba(0,0,0,.62),0 0 0 1px rgba(88,166,255,.22)!important}.card::after,.trendLink::after,.signalCard::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent,rgba(88,166,255,.11),transparent);transform:translateX(-130%);pointer-events:none}.card:hover::after,.trendLink:hover::after,.signalCard:hover::after{animation:dtShine .8s ease both}.img img{transition:transform .65s,filter .65s}.card:hover .img img{transform:scale(1.045);filter:saturate(1.06) contrast(1.04)}.scoreRing{animation:dtRingPulse 2.8s ease-in-out infinite}.score,.navPill{animation:dtSoftPulse 3s ease-in-out infinite}
button,.currencyBtn,.siteChip,.menuItem{transition:transform .2s,filter .2s,border-color .2s!important}button:hover,.currencyBtn:hover,.siteChip:hover,.menuItem:hover{transform:translateY(-2px);filter:brightness(1.08)}.sideMenu{background:#0d1117!important;border-right:1px solid #30363d!important}.menuItem{opacity:0;transform:translateX(-14px);background:#0d1117!important;border-bottom:1px solid #21262d!important}#menuToggle:checked ~ .sideMenu .menuItem{animation:dtMenuSlide .42s ease forwards}
@keyframes dtFadeUp{from{opacity:0;transform:translateY(22px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes dtShine{from{transform:translateX(-130%)}to{transform:translateX(130%)}}@keyframes dtSoftPulse{0%,100%{box-shadow:0 0 0 rgba(63,185,80,0)}50%{box-shadow:0 0 22px rgba(63,185,80,.20)}}@keyframes dtRingPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}@keyframes dtMenuSlide{to{opacity:1;transform:translateX(0)}}@keyframes dtBarGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes dtBarFlow{from{background-position:0% 50%}to{background-position:220% 50%}}@keyframes dtBarSweep{0%,35%{transform:translateX(-120%)}100%{transform:translateX(120%)}}@keyframes dtOrbBreathe{0%,100%{transform:scale(.85);opacity:.35}50%{transform:scale(1.18);opacity:.75}}@keyframes dtSpaceGlow{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-18px) scale(1.04)}}@keyframes dtLaptopFloat{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-12px)}}@keyframes dtCodePulse{0%,100%{box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 0 rgba(88,166,255,0)}50%{box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 34px rgba(88,166,255,.18)}}
@media(max-width:700px){.hero{padding-top:34px!important;padding-bottom:235px!important;min-height:660px}.hero::before{height:210px;bottom:18px;width:94vw}.hero::after{height:130px;bottom:52px;width:80vw;font-size:9px;padding:14px}h1{font-size:clamp(36px,10vw,56px)!important;letter-spacing:-1.8px!important}.lead{font-size:15px!important}.toolbar{margin-top:-190px!important}.signalRow{grid-template-columns:64px 1fr 32px!important;gap:7px!important}.signalBar{height:8px!important}.card:hover,.stat:hover,.signalCard:hover{transform:translateY(-2px)}}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}.wrap::after,.hero::before,.hero::after,.motion-ready .topNav,.motion-ready .hero,.motion-ready .premiumTrending,.motion-ready .winningPanel,.motion-ready .sectionTitle,.motion-ready .panel,.motion-ready .dt-in,.score,.navPill,.scoreRing,#menuToggle:checked ~ .sideMenu .menuItem,.signalBar::after,.signalBar i,.stat::after{animation:none!important}.motion-ready .stat,.motion-ready .trendLink,.motion-ready .signalCard,.motion-ready .card,.menuItem{opacity:1!important;transform:none!important}.card:hover,.card:hover .img img,button:hover,.currencyBtn:hover,.siteChip:hover,.menuItem:hover,.stat:hover,.signalCard:hover{transform:none!important}}
`;

html = html.replace(/\/\* DropTrend premium motion upgrade \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* DropTrend GitHub-dark motion upgrade \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* DropTrend GitHub homepage inspired upgrade \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', githubHeroCss + '\n</style>');

const animationJs = `
<script>
(function(){
  function initDropTrendMotion(){
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.classList.add('motion-ready');
    const targets = '.stat,.trendLink,.signalCard,.card,.sectionTitle,.panel';
    const reveal = (el, index) => {
      if (el.dataset.dtMotion) return;
      el.dataset.dtMotion = '1';
      el.style.animationDelay = Math.min(index * 45, 360) + 'ms';
      el.classList.add('dt-in');
    };
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const items = Array.from(document.querySelectorAll(targets));
            reveal(entry.target, items.indexOf(entry.target));
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      document.querySelectorAll(targets).forEach(el => observer.observe(el));
      const mo = new MutationObserver(() => document.querySelectorAll(targets).forEach(el => {
        if (!el.dataset.dtMotion) observer.observe(el);
      }));
      mo.observe(document.body, { childList: true, subtree: true });
    } else document.querySelectorAll(targets).forEach(reveal);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDropTrendMotion);
  else initDropTrendMotion();
})();
</script>`;
html = html.replace(/<script>\s*\(function\(\)\{\s*function initDropTrendMotion\(\)[\s\S]*?<\/script>\s*/g, '');
html = html.replace('</body>', animationJs + '\n</body>');

fs.writeFileSync(file, html, 'utf8');
console.log('Patched homepage UI: GitHub homepage inspired hero with code panel, deep glow and black cards.');
