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

const animationCss = `
/* DropTrend premium motion upgrade */
html{scroll-behavior:smooth}
.motion-ready .topNav,
.motion-ready .hero,
.motion-ready .premiumTrending,
.motion-ready .winningPanel,
.motion-ready .sectionTitle,
.motion-ready .panel{animation:dtFadeUp .7s cubic-bezier(.22,1,.36,1) both}
.motion-ready .topNav{animation-delay:.04s}
.motion-ready .hero{animation-delay:.10s}
.motion-ready .premiumTrending{animation-delay:.16s}
.motion-ready .winningPanel{animation-delay:.22s}
.motion-ready .stat,.motion-ready .trendLink,.motion-ready .signalCard,.motion-ready .card{opacity:0;transform:translateY(18px) scale(.98)}
.motion-ready .dt-in{animation:dtFadeUp .62s cubic-bezier(.22,1,.36,1) forwards}
.card{will-change:transform,box-shadow,border-color}
.card::after,.trendLink::after,.premiumTrending::after,.winningPanel::after,.signalCard::before,.stat::before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 0%,rgba(255,255,255,.14) 45%,transparent 60%);transform:translateX(-125%);opacity:0;pointer-events:none}
.card:hover::after,.trendLink:hover::after,.premiumTrending:hover::after,.winningPanel:hover::after,.signalCard:hover::before,.stat:hover::before{animation:dtShine .85s ease both;opacity:1}
.card:hover{transform:translateY(-7px) scale(1.012);box-shadow:0 22px 55px rgba(0,0,0,.34);border-color:rgba(110,231,183,.52)}
.img img{transition:transform .75s ease,filter .75s ease}
.card:hover .img img{transform:scale(1.07);filter:saturate(1.1) contrast(1.05)}
.score,.winBadge,.navPill{animation:dtSoftPulse 2.8s ease-in-out infinite}
button,.currencyBtn,.siteChip,.menuItem{transition:transform .2s ease,filter .2s ease,background .2s ease,border-color .2s ease}
button:hover,.currencyBtn:hover,.siteChip:hover,.menuItem:hover{transform:translateY(-2px);filter:brightness(1.06)}
.scoreRing{animation:dtRingPulse 2.6s ease-in-out infinite}
.sideMenu{transition:transform .32s cubic-bezier(.22,1,.36,1)!important}
.menuItem{opacity:0;transform:translateX(-14px)}
#menuToggle:checked ~ .sideMenu .menuItem{animation:dtMenuSlide .42s ease forwards}
#menuToggle:checked ~ .sideMenu .menuItem:nth-child(1){animation-delay:.04s}
#menuToggle:checked ~ .sideMenu .menuItem:nth-child(2){animation-delay:.08s}
#menuToggle:checked ~ .sideMenu .menuItem:nth-child(3){animation-delay:.12s}
#menuToggle:checked ~ .sideMenu .menuItem:nth-child(4){animation-delay:.16s}

/* Monthly Signal Engine + upper stats modern glass upgrade */
.stats{perspective:900px}
.stat{position:relative;overflow:hidden;background:linear-gradient(145deg,rgba(15,25,55,.82),rgba(255,255,255,.075))!important;border:1px solid rgba(181,212,244,.22)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 18px 42px rgba(0,0,0,.22);transition:transform .32s cubic-bezier(.22,1,.36,1),box-shadow .32s,border-color .32s}
.stat::after{content:"";position:absolute;width:120px;height:120px;right:-55px;top:-55px;border-radius:50%;background:radial-gradient(circle,rgba(110,231,183,.26),transparent 65%);filter:blur(2px);animation:dtOrbBreathe 4.2s ease-in-out infinite}
.stat:hover{transform:translateY(-5px) rotateX(3deg);box-shadow:0 25px 55px rgba(0,0,0,.32),0 0 30px rgba(110,231,183,.10);border-color:rgba(110,231,183,.45)!important}
.stat b{background:linear-gradient(90deg,#fff,#b7ffe8,#b5d4f4);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 18px rgba(110,231,183,.10)}
.signalPanel{position:relative}
.signalCard{position:relative;overflow:hidden;background:linear-gradient(145deg,rgba(7,17,39,.88),rgba(18,33,68,.72))!important;border:1px solid rgba(181,212,244,.22)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 20px 50px rgba(0,0,0,.25);transition:transform .32s cubic-bezier(.22,1,.36,1),box-shadow .32s,border-color .32s}
.signalCard:hover{transform:translateY(-5px);box-shadow:0 28px 62px rgba(0,0,0,.34),0 0 34px rgba(34,197,94,.12);border-color:rgba(110,231,183,.44)!important}
.signalCard span{color:#b5d4f4!important;text-shadow:0 0 12px rgba(181,212,244,.18)}
.signalCard b{letter-spacing:.1px}
.signalBars{gap:10px!important;margin:14px 0!important}
.signalRow{grid-template-columns:82px 1fr 46px!important;gap:10px!important;position:relative;z-index:2}
.signalRow > span:first-child{font-weight:900;text-transform:uppercase;letter-spacing:.45px;color:#aab7da}
.signalRow > span:last-child{font-weight:900;color:#dffcf4;text-align:right}
.signalBar{height:10px!important;background:rgba(3,9,24,.78)!important;border:1px solid rgba(181,212,244,.16)!important;box-shadow:inset 0 2px 8px rgba(0,0,0,.38);position:relative;overflow:hidden}
.signalBar::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);transform:translateX(-120%);animation:dtBarSweep 2.4s ease-in-out infinite}
.signalBar i{position:relative;background:linear-gradient(90deg,#22c55e,#6ee7b7,#38bdf8)!important;background-size:220% 100%!important;box-shadow:0 0 18px rgba(110,231,183,.48),0 0 4px rgba(56,189,248,.55);transform-origin:left;animation:dtBarGrow 1.25s cubic-bezier(.22,1,.36,1) both,dtBarFlow 2.3s linear infinite!important}
.signalBar i::after{content:"";position:absolute;right:-5px;top:50%;width:10px;height:10px;border-radius:50%;background:#eafff8;box-shadow:0 0 16px #6ee7b7;transform:translateY(-50%)}
.visualChips .visualChip{transition:transform .22s ease,box-shadow .22s ease;border-color:rgba(110,231,183,.30)!important;background:rgba(110,231,183,.12)!important}
.visualChip:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.22),0 0 16px rgba(110,231,183,.14)}

@keyframes dtFadeUp{from{opacity:0;transform:translateY(22px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes dtShine{from{transform:translateX(-125%)}to{transform:translateX(125%)}}
@keyframes dtSoftPulse{0%,100%{box-shadow:0 0 0 rgba(110,231,183,0)}50%{box-shadow:0 0 22px rgba(110,231,183,.18)}}
@keyframes dtRingPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes dtMenuSlide{to{opacity:1;transform:translateX(0)}}
@keyframes dtBarGrow{from{transform:scaleX(0);filter:blur(2px)}to{transform:scaleX(1);filter:blur(0)}}
@keyframes dtBarFlow{from{background-position:0% 50%}to{background-position:220% 50%}}
@keyframes dtBarSweep{0%,35%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
@keyframes dtOrbBreathe{0%,100%{transform:scale(.85);opacity:.45}50%{transform:scale(1.2);opacity:.85}}
@media(max-width:600px){.card:hover{transform:translateY(-3px) scale(1.004)}.motion-ready .card{transform:translateY(12px) scale(.99)}.signalRow{grid-template-columns:64px 1fr 32px!important;gap:7px!important}.signalBar{height:8px!important}.stat:hover,.signalCard:hover{transform:translateY(-2px)}}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}.motion-ready .topNav,.motion-ready .hero,.motion-ready .premiumTrending,.motion-ready .winningPanel,.motion-ready .sectionTitle,.motion-ready .panel,.motion-ready .dt-in,.score,.winBadge,.navPill,.scoreRing,#menuToggle:checked ~ .sideMenu .menuItem,.signalBar::after,.signalBar i,.stat::after{animation:none!important}.motion-ready .stat,.motion-ready .trendLink,.motion-ready .signalCard,.motion-ready .card,.menuItem{opacity:1!important;transform:none!important}.card:hover,.card:hover .img img,button:hover,.currencyBtn:hover,.siteChip:hover,.menuItem:hover,.stat:hover,.signalCard:hover{transform:none!important}}
`;

html = html.replace(/\/\* DropTrend premium motion upgrade \*\/[\s\S]*?(?=<\/style>)/, '');
html = html.replace('</style>', animationCss + '\n</style>');

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
    } else {
      document.querySelectorAll(targets).forEach(reveal);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDropTrendMotion);
  else initDropTrendMotion();
})();
</script>`;

html = html.replace(/<script>\s*\(function\(\)\{\s*function initDropTrendMotion\(\)[\s\S]*?<\/script>\s*/g, '');
html = html.replace('</body>', animationJs + '\n</body>');

fs.writeFileSync(file, html, 'utf8');
console.log('Patched homepage UI: currencies, modern stats, animated monthly signal bars.');
