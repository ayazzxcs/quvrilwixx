const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// Split visible Quvirl brand into Qu + virl where possible.
html = html.replace(/<b>Quvirl<\/b>/g, '<b><span class="brandQu">Qu</span><span class="brandVirl">virl</span></b>');
html = html.replace(/>(Quvirl)<\/g, '><span class="brandQu">Qu</span><span class="brandVirl">virl</span><');

const css = `
/* Quvirl split brand name: Qu white, virl pink */
.brandText b,.miniBrand,.sideBrand,.brandTrend,.brandWord{
  color:#ffffff!important;
  -webkit-text-fill-color:#ffffff!important;
}
.brandQu{
  color:#ffffff!important;
  -webkit-text-fill-color:#ffffff!important;
}
.brandVirl{
  color:#ff4fd8!important;
  -webkit-text-fill-color:#ff4fd8!important;
  text-shadow:0 0 18px rgba(255,79,216,.38)!important;
}
.brandText b{
  text-shadow:none!important;
}
`;

html = html.replace(/\/\* Quvirl pink brand name \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* Quvirl split brand name: Qu white, virl pink \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', css + '\n</style>');

fs.writeFileSync(file, html, 'utf8');
console.log('Applied split Quvirl brand name: Qu white, virl pink.');
