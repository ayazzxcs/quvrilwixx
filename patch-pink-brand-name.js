const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// Reset old split markup, then split visible Quvirl brand into Qu + virl.
html = html.replace(/<span class="brandQu">Qu<\/span><span class="brandVirl">virl<\/span>/g, 'Quvirl');
html = html.replace(/<b>Quvirl<\/b>/g, '<b><span class="brandQu">Qu</span><span class="brandVirl">virl</span></b>');
html = html.replace(/>Quvirl</g, '><span class="brandQu">Qu</span><span class="brandVirl">virl</span><');

const css = `
/* Quvirl split brand name final: Qu white, virl pink */
.brandQu,.brandVirl,
.brandText b .brandQu,.brandText b .brandVirl,
.miniBrand .brandQu,.miniBrand .brandVirl,
.sideBrand .brandQu,.sideBrand .brandVirl{
  display:inline!important;
  white-space:nowrap!important;
  line-height:1!important;
  text-shadow:none!important;
}
.brandQu,
.brandText b .brandQu,
.miniBrand .brandQu,
.sideBrand .brandQu{
  color:#ffffff!important;
  -webkit-text-fill-color:#ffffff!important;
}
.brandVirl,
.brandText b .brandVirl,
.miniBrand .brandVirl,
.sideBrand .brandVirl{
  color:#ff4fd8!important;
  -webkit-text-fill-color:#ff4fd8!important;
}
.brandText b{
  display:block!important;
  font-size:44px!important;
  line-height:1!important;
  letter-spacing:-1px!important;
  white-space:nowrap!important;
  text-shadow:none!important;
}
.miniBrand{
  font-size:22px!important;
  line-height:1!important;
  white-space:nowrap!important;
  text-shadow:none!important;
}
.sideBrand{
  white-space:nowrap!important;
  text-shadow:none!important;
}
@media(max-width:700px){
  .brandText b{font-size:40px!important;line-height:1!important}
  .miniBrand{font-size:22px!important}
}
`;

html = html.replace(/\/\* Quvirl pink brand name \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* Quvirl split brand name: Qu white, virl pink \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace(/\/\* Quvirl split brand name final: Qu white, virl pink \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', css + '\n</style>');

fs.writeFileSync(file, html, 'utf8');
console.log('Applied final split Quvirl brand name: Qu white, virl pink, no glow, bigger hero brand.');
