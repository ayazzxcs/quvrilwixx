const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

html = html.replace(/<section class="quvirlSignalHub"[\s\S]*?<\/section>\s*/g, '');
html = html.replace(/\/\* Signal hub side-layout final override \*\/[\s\S]*?(?=<\/style>)/g, '');

const css = `
/* Quvirl brand blue virl override */
.brandVirl,
.brandText b .brandVirl,
.miniBrand .brandVirl,
.sideBrand .brandVirl{
  color:#58a6ff!important;
  -webkit-text-fill-color:#58a6ff!important;
  text-shadow:none!important;
}
`;

html = html.replace(/\/\* Quvirl brand blue virl override \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', css + '\n</style>');

fs.writeFileSync(file, html, 'utf8');
console.log('Removed Quvirl signal hub section and changed virl brand color to blue.');
