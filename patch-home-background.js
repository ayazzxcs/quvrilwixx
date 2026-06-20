const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const css = `/* Full-screen external product-lifestyle background slideshow */
.dynamicBg{position:fixed;inset:0;z-index:-5;overflow:hidden;background:#0b1020;pointer-events:none}
.dynamicBg .bgSlide{position:absolute;inset:-5%;background-size:contain;background-position:center;background-repeat:no-repeat;opacity:0;transform:translateX(100%) scale(.94);transition:transform 1.25s ease,opacity 1.25s ease;filter:blur(10px) saturate(1.14) brightness(.92);}
.dynamicBg .bgSlide.active{opacity:.52;transform:translateX(0) scale(.94)}
.dynamicBg .bgSlide.prev{opacity:0;transform:translateX(-100%) scale(.94)}
.dynamicBg::before{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(120deg,rgba(34,197,94,.18),rgba(59,130,246,.13),rgba(20,184,166,.14));mix-blend-mode:screen}
.dynamicBg::after{content:"";position:absolute;inset:0;z-index:3;background:rgba(7,12,28,.10);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.bgSpark{position:fixed;inset:0;z-index:-3;pointer-events:none;background-image:radial-gradient(circle,rgba(255,255,255,.14) 1px,transparent 1.4px);background-size:70px 70px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.75),transparent 82%);animation:sparkDrift 26s linear infinite;opacity:.14}
.hero,.panel,.toolbar,.premiumTrending,.winningPanel,.topNav,.card{backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
@keyframes sparkDrift{from{background-position:0 0}to{background-position:70px 140px}}
@media(max-width:600px){.dynamicBg .bgSlide{inset:-2%;background-size:92% auto;filter:blur(8px) saturate(1.12) brightness(.95)}.dynamicBg .bgSlide.active{opacity:.44}.dynamicBg::after{background:rgba(7,12,28,.16)}}
@media (prefers-reduced-motion: reduce){.dynamicBg .bgSlide{transition:none}.bgSpark{animation:none!important}}`;

html = html.replace(/\/\* Dynamic blurred video-style background \*\/[\s\S]*?@media \(prefers-reduced-motion: reduce\)\{\.bgTrack,\.dynamicBg::before,\.bgVideoTile::after,\.bgSpark\{animation:none!important\}\}/, css);
html = html.replace(/\/\* Full-screen product image slideshow background \*\/[\s\S]*?@media \(prefers-reduced-motion: reduce\)\{\.dynamicBg \.bgSlide\{transition:none\}\.bgSpark\{animation:none!important\}\}/, css);

html = html.replace(/<div class="dynamicBg" aria-hidden="true">[\s\S]*?<\/div>\s*<div class="bgSpark" aria-hidden="true"><\/div>/, `<div class="dynamicBg" aria-hidden="true"><div class="bgSlide active" id="bgSlideA"></div><div class="bgSlide" id="bgSlideB"></div></div>\n<div class="bgSpark" aria-hidden="true"></div>`);

const js = `
function initProductBackgroundSlideshow() {
  const a = document.getElementById("bgSlideA");
  const b = document.getElementById("bgSlideB");
  if (!a || !b) return;
  const imgs = [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1600&auto=format&fit=max",
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=1600&auto=format&fit=max",
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1600&auto=format&fit=max",
    "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=1600&auto=format&fit=max",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1600&auto=format&fit=max",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=max",
    "https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=1600&auto=format&fit=max",
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=1600&auto=format&fit=max",
    "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?q=80&w=1600&auto=format&fit=max",
    "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1600&auto=format&fit=max"
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
console.log('Patched homepage with fitted blurred external product-lifestyle background slideshow.');
