const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const css = `/* Full-screen uploaded logistics background slideshow - clean no dots/circles */
.dynamicBg{position:fixed;inset:0;z-index:-5;overflow:hidden;background:#0b1020;pointer-events:none}
.dynamicBg .bgSlide{position:absolute;inset:-4%;background-size:contain;background-position:center;background-repeat:no-repeat;opacity:0;transform:translateX(100%) scale(.88);transition:transform 1.25s ease,opacity 1.25s ease;filter:blur(9px) saturate(1.1) brightness(1.04);}
.dynamicBg .bgSlide.active{opacity:.56;transform:translateX(0) scale(.88)}
.dynamicBg .bgSlide.prev{opacity:0;transform:translateX(-100%) scale(.88)}
.dynamicBg::before,.dynamicBg::after,.bgSpark,.bg-orb,.orb1,.orb2,.orb3,body::before,body::after,.wrap::before{display:none!important;content:none!important;background:none!important;animation:none!important}
.hero,.panel,.toolbar,.premiumTrending,.winningPanel,.topNav,.card{backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
@media(max-width:600px){.dynamicBg .bgSlide{inset:-2%;background-size:88% auto;filter:blur(7px) saturate(1.08) brightness(1.04)}.dynamicBg .bgSlide.active{opacity:.48}}
@media (prefers-reduced-motion: reduce){.dynamicBg .bgSlide{transition:none}}`;

html = html.replace(/\/\* Dynamic blurred video-style background \*\/[\s\S]*?@media \(prefers-reduced-motion: reduce\)\{\.bgTrack,\.dynamicBg::before,\.bgVideoTile::after,\.bgSpark\{animation:none!important\}\}/, css);
html = html.replace(/\/\* Full-screen product image slideshow background \*\/[\s\S]*?@media \(prefers-reduced-motion: reduce\)\{\.dynamicBg \.bgSlide\{transition:none\}\.bgSpark\{animation:none!important\}\}/, css);
html = html.replace(/\/\* Full-screen external product-lifestyle background slideshow \*\/[\s\S]*?@media \(prefers-reduced-motion: reduce\)\{\.dynamicBg \.bgSlide\{transition:none\}\.bgSpark\{animation:none!important\}\}/, css);
html = html.replace(/\/\* Full-screen uploaded logistics background slideshow(?: - clean no dots\/circles)? \*\/[\s\S]*?@media \(prefers-reduced-motion: reduce\)\{\.dynamicBg \.bgSlide\{transition:none\}(?:\.bgSpark\{animation:none!important\})?\}/, css);

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
    "/assets/bg-logistics-4.svg"
  ];
  for (let i = imgs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
  }
  let index = 0;
  let current = a;
  let next = b;
  current.style.backgroundImage = 'url("' + imgs[index % imgs.length] + '")';
  next.style.backgroundImage = 'url("' + imgs[(index + 1) % imgs.length] + '")';
  if (window.droptrendBgTimer) clearInterval(window.droptrendBgTimer);
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
    setTimeout(() => next.classList.remove('prev'), 1300);
  }, 5200);
}
`;

html = html.replace(/\nfunction initProductBackgroundSlideshow\(\) \{[\s\S]*?\n\}\n\s*function exportCSV\(\) \{/, js + '\nfunction exportCSV() {');
if (!html.includes('function initProductBackgroundSlideshow()')) {
  html = html.replace(/\nfunction exportCSV\(\) \{/, js + '\nfunction exportCSV() {');
}
html = html.replace(/resetAndRender\(\);\n      return;/, 'resetAndRender();\n      initProductBackgroundSlideshow();\n      return;');
html = html.replace(/resetAndRender\(\);\n\}/, 'resetAndRender();\n  initProductBackgroundSlideshow();\n}');

fs.writeFileSync(file, html, 'utf8');
console.log('Patched homepage with clean logistics background slideshow, broken images removed.');
