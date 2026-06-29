const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const css = `
/* Signal hub side-layout final override */
.quvirlSignalHub{overflow:hidden!important}
.quvirlSignalHub .hubMap{height:430px!important;min-height:430px!important;width:100%!important;max-width:100%!important;position:relative!important;overflow:hidden!important}
.quvirlSignalHub .hubCore{left:43%!important;top:54%!important;transform:translate(-50%,-50%)!important;width:230px!important;height:145px!important}
.quvirlSignalHub .hubNode{width:150px!important;min-height:88px!important}
.quvirlSignalHub .nGoogle{left:8%!important;top:44%!important;transform:none!important}
.quvirlSignalHub .nAmazon{right:8%!important;top:30%!important;transform:none!important}
.quvirlSignalHub .nCJ{right:8%!important;top:63%!important;transform:none!important}
.quvirlSignalHub .nGoogle::after{right:-26px!important;left:auto!important;top:50%!important;bottom:auto!important}
.quvirlSignalHub .nAmazon::after,.quvirlSignalHub .nCJ::after{left:-26px!important;right:auto!important;top:50%!important;bottom:auto!important}
.quvirlSignalHub .hubWire{left:43%!important;top:54%!important;transform-origin:left center!important}
.quvirlSignalHub .wGoogle{width:238px!important;transform:rotate(180deg)!important}
.quvirlSignalHub .wAmazon{width:265px!important;transform:rotate(-28deg)!important}
.quvirlSignalHub .wCJ{width:270px!important;transform:rotate(30deg)!important}
@media(max-width:700px){
  .quvirlSignalHub .hubMap{height:350px!important;min-height:350px!important}
  .quvirlSignalHub .hubCore{left:42%!important;top:52%!important;width:138px!important;height:96px!important}
  .quvirlSignalHub .hubNode{width:94px!important;min-height:62px!important}
  .quvirlSignalHub .nGoogle{left:4%!important;top:43%!important}
  .quvirlSignalHub .nAmazon{right:4%!important;top:31%!important}
  .quvirlSignalHub .nCJ{right:4%!important;top:61%!important}
  .quvirlSignalHub .hubWire{left:42%!important;top:52%!important}
  .quvirlSignalHub .wGoogle{width:108px!important;transform:rotate(180deg)!important}
  .quvirlSignalHub .wAmazon{width:128px!important;transform:rotate(-30deg)!important}
  .quvirlSignalHub .wCJ{width:128px!important;transform:rotate(30deg)!important}
}
`;

html = html.replace(/\/\* Signal hub side-layout final override \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', css + '\n</style>');
fs.writeFileSync(file, html, 'utf8');
console.log('Applied fixed side-wise signal hub layout.');
