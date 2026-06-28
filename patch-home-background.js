const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const css = `/* Full-screen uploaded logistics background slideshow - visible */
.dynamicBg{position:fixed!important;inset:0!important;z-index:0!important;overflow:hidden!important;background:#010409!important;pointer-events:none!important;display:block!important}
.dynamicBg .bgSlide{position:absolute!important;inset:-6%!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;opacity:0;transform:translateX(100%) scale(1.1);transition:transform 1.1s ease,opacity 1.1s ease;filter:blur(2px) saturate(1.2) brightness(.95)!important;display:block!important}
.dynamicBg .bgSlide.active{opacity:.72!important;transform:translateX(0) scale(1.1)!important}
.dynamicBg .bgSlide.prev{opacity:0!important;transform:translateX(-100%) scale(1.1)!important}
.dynamicBg::after{content:""!important;position:absolute!important;inset:0!important;background:linear-gradient(180deg,rgba(1,4,9,.22),rgba(1,4,9,.58) 45%,rgba(1,4,9,.88))!important;pointer-events:none!important}
.wrap{position:relative!important;z-index:2!important}
.hero,.panel,.toolbar,.premiumTrending,.winningPanel,.topNav,.card{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
@media(max-width:600px){.dynamicBg .bgSlide{inset:-4%!important;background-size:cover!important;filter:blur(2px) saturate(1.15) brightness(.92)!important}.dynamicBg .bgSlide.active{opacity:.68!important}}
@media (prefers-reduced-motion: reduce){.dynamicBg .bgSlide{transition:none}}`;

html = html.replace(/\/\* Full-screen uploaded logistics background slideshow[\s\S]*?@media \(prefers-reduced-motion: reduce\)\{\.dynamicBg \.bgSlide\{transition:none\}\}/g, css);
html = html.replace(/<div class="dynamicBg" aria-hidden="true">[\s\S]*?<\/div>\s*<div class="bgSpark" aria-hidden="true"><\/div>/, `<div class="dynamicBg" aria-hidden="true"><div class="bgSlide active" id="bgSlideA"></div><div class="bgSlide" id="bgSlideB"></div></div>\n<div class="bgSpark" aria-hidden="true"></div>`);

const js = `
function initProductBackgroundSlideshow() {
  const a = document.getElementById("bgSlideA");
  const b = document.getElementById("bgSlideB");
  if (!a || !b) return;
  const imgs = [
    "/assets/bg-logistics-1.svg",
    "/assets/bg-logistics-2.svg",
    "/assets/bg-logistics-3.svg",
    "/assets/bg-logistics-4.svg",
    "/assets/bg-logistics-5.svg",
    "/assets/bg-logistics-6.svg"
  ];
  imgs.forEach(src => { const im = new Image(); im.src = src; });
  let index = 0;
  let current = a;
  let next = b;
  current.style.backgroundImage = 'url("' + imgs[0] + '")';
  next.style.backgroundImage = 'url("' + imgs[1] + '")';
  current.classList.add('active');
  next.classList.remove('active','prev');
  if (window.droptrendBgTimer) clearInterval(window.droptrendBgTimer);
  if (window.quvirlBgTimer) clearInterval(window.quvirlBgTimer);
  window.droptrendBgTimer = setInterval(() => {
    index++;
    next.style.backgroundImage = 'url("' + imgs[index % imgs.length] + '")';
    next.classList.remove('prev');
    current.classList.remove('active');
    current.classList.add('prev');
    next.classList.add('active');
    const old = current;
    current = next;
    next = old;
    setTimeout(() => next.classList.remove('prev'), 1200);
  }, 3200);
}
`;

html = html.replace(/\nfunction initProductBackgroundSlideshow\(\) \{[\s\S]*?\n\}\n\s*function exportCSV\(\) \{/, js + '\nfunction exportCSV() {');
if (!html.includes('function initProductBackgroundSlideshow()')) {
  html = html.replace(/\nfunction exportCSV\(\) \{/, js + '\nfunction exportCSV() {');
}
html = html.replace(/autoLoadProducts\(\);/, 'autoLoadProducts();\ninitProductBackgroundSlideshow();');

fs.writeFileSync(file, html, 'utf8');
console.log('Patched homepage with visible sliding logistics background images.');
