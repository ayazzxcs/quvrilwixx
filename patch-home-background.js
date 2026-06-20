const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const css = `/* Full-screen product image slideshow background */
.dynamicBg{position:fixed;inset:0;z-index:-5;overflow:hidden;background:#050814;pointer-events:none}
.dynamicBg .bgSlide{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat;opacity:0;transform:translateX(100%);transition:transform 1.25s ease,opacity 1.25s ease;filter:saturate(1.05) contrast(1.05)}
.dynamicBg .bgSlide.active{opacity:.42;transform:translateX(0)}
.dynamicBg .bgSlide.prev{opacity:0;transform:translateX(-100%)}
.dynamicBg::before{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,rgba(5,8,20,.88),rgba(5,8,20,.58),rgba(5,8,20,.9)),radial-gradient(circle at 18% 16%,rgba(34,197,94,.24),transparent 32%),radial-gradient(circle at 82% 22%,rgba(59,130,246,.22),transparent 34%)}
.dynamicBg::after{content:"";position:absolute;inset:0;z-index:3;background:rgba(5,8,20,.42);backdrop-filter:blur(1.2px)}
.bgSpark{position:fixed;inset:0;z-index:-3;pointer-events:none;background-image:radial-gradient(circle,rgba(255,255,255,.18) 1px,transparent 1.4px);background-size:70px 70px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.8),transparent 80%);animation:sparkDrift 26s linear infinite;opacity:.18}
.hero,.panel,.toolbar,.premiumTrending,.winningPanel,.topNav,.card{backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
@keyframes sparkDrift{from{background-position:0 0}to{background-position:70px 140px}}
@media(max-width:600px){.dynamicBg .bgSlide{background-position:center}.dynamicBg .bgSlide.active{opacity:.30}.dynamicBg::before{background:linear-gradient(180deg,rgba(5,8,20,.9),rgba(5,8,20,.64),rgba(5,8,20,.94))}}
@media (prefers-reduced-motion: reduce){.dynamicBg .bgSlide{transition:none}.bgSpark{animation:none!important}}`;

html = html.replace(/\/\* Dynamic blurred video-style background \*\/[\s\S]*?@media \(prefers-reduced-motion: reduce\)\{\.bgTrack,\.dynamicBg::before,\.bgVideoTile::after,\.bgSpark\{animation:none!important\}\}/, css);

html = html.replace(/<div class="dynamicBg" aria-hidden="true">[\s\S]*?<\/div>\s*<div class="bgSpark" aria-hidden="true"><\/div>/, `<div class="dynamicBg" aria-hidden="true"><div class="bgSlide active" id="bgSlideA"></div><div class="bgSlide" id="bgSlideB"></div></div>\n<div class="bgSpark" aria-hidden="true"></div>`);

const js = `
function initProductBackgroundSlideshow() {
  const a = document.getElementById("bgSlideA");
  const b = document.getElementById("bgSlideB");
  if (!a || !b || !Array.isArray(products) || !products.length) return;
  const imgs = products.map(normalizeProduct).map(p => p.image).filter(Boolean).filter(src => /^https?:/i.test(src));
  if (!imgs.length) return;
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

if (!html.includes('function initProductBackgroundSlideshow()')) {
  html = html.replace(/\nfunction exportCSV\(\) \{/, js + '\nfunction exportCSV() {');
}
html = html.replace(/resetAndRender\(\);\n      return;/, 'resetAndRender();\n      initProductBackgroundSlideshow();\n      return;');
html = html.replace(/resetAndRender\(\);\n\}/, 'resetAndRender();\n  initProductBackgroundSlideshow();\n}');

fs.writeFileSync(file, html, 'utf8');
console.log('Patched homepage full-screen product background slideshow.');
