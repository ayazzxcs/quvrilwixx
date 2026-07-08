const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

html = html.replace(/<section class="quvirlSignalHub"[\s\S]*?<\/section>\s*/g, '');
html = html.replace(/\/\* Signal hub side-layout final override \*\/[\s\S]*?(?=<\/style>)/g, '');

const css = `
/* Quvirl final blue brand + mobile signal panel override */
.brandVirl,
.brandText b .brandVirl,
.miniBrand .brandVirl,
.sideBrand .brandVirl{
  color:#58a6ff!important;
  -webkit-text-fill-color:#58a6ff!important;
  text-shadow:none!important;
}
@media(max-width:700px){
  .signalPanel{grid-template-columns:1fr!important;width:100%!important;max-width:100%!important;gap:12px!important}
  .signalCard{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow:hidden!important}
  .signalRow{grid-template-columns:54px minmax(0,1fr) auto!important;gap:6px!important;align-items:center!important}
  .signalRow>b{font-size:11px!important;justify-self:end!important;max-width:96px!important;white-space:normal!important;text-align:right!important;overflow-wrap:anywhere!important;line-height:1.08!important}
}
`;

html = html.replace(/\/\* Quvirl final blue brand + mobile signal panel override \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', css + '\n</style>');

fs.writeFileSync(file, html, 'utf8');
console.log('Removed Quvirl signal hub section and applied final blue brand/mobile signal overrides.');
