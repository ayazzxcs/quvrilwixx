const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const hub = `<section class="quvirlSignalHub" aria-label="Quvirl signal hub">
  <div class="hubDetails">
    <span>Real market signal stack</span>
    <h2>See why a product is worth testing before spending money.</h2>
    <p>Quvirl connects three practical signals: search interest from Google Trends, buyer demand from Amazon, and supplier availability from CJdropshipping.</p>
    <div class="hubDetailList">
      <b>Google Trends</b><small>Checks demand direction and search momentum.</small>
      <b>Amazon Demand</b><small>Uses reviews, rating and demand signals.</small>
      <b>CJ Supplier</b><small>Checks product source, price and supply readiness.</small>
    </div>
  </div>
  <div class="hubMap" aria-hidden="true">
    <div class="hubWire wGoogle"></div><div class="hubWire wAmazon"></div><div class="hubWire wCJ"></div>
    <div class="hubCore"><b><span class="brandQu">Qu</span><span class="brandVirl">virl</span></b><small>Signal Hub</small></div>
    <div class="hubNode nGoogle">Google<br><small>Trends</small></div>
    <div class="hubNode nAmazon">Amazon<br><small>Demand</small></div>
    <div class="hubNode nCJ">CJ<br><small>Supplier</small></div>
  </div>
</section>`;

html = html.replace(/<section class="quvirlSignalHub"[\s\S]*?<\/section>\s*/g, '');
html = html.replace(/<p class="small" id="apiStatus"/, hub + '\n<p class="small" id="apiStatus"');

const css = `
/* Signal hub side-layout final override */
.quvirlSignalHub{display:grid!important;grid-template-columns:.9fr 1.1fr!important;gap:16px!important;align-items:center!important;overflow:hidden!important;width:min(980px,100%)!important;margin:24px auto 8px!important;padding:18px 18px!important;min-height:360px!important}
.quvirlSignalHub .hubDetails{text-align:left!important;padding:8px 10px!important;position:relative!important;z-index:5!important;order:1!important}
.quvirlSignalHub .hubMap{height:330px!important;min-height:330px!important;width:100%!important;max-width:100%!important;position:relative!important;overflow:hidden!important;order:2!important}
.quvirlSignalHub .hubDetails span{display:inline-block!important;color:#6ee7b7!important;font-size:11px!important;letter-spacing:.12em!important;text-transform:uppercase!important;font-weight:950!important;margin-bottom:8px!important}
.quvirlSignalHub .hubDetails h2{font-size:clamp(24px,2.7vw,36px)!important;line-height:1.06!important;margin:0 0 12px!important;color:#fff!important;-webkit-text-fill-color:#fff!important;letter-spacing:-1px!important}
.quvirlSignalHub .hubDetails p{font-size:14px!important;line-height:1.55!important;color:#fff!important;-webkit-text-fill-color:#fff!important;opacity:.92!important;margin:0 0 12px!important}
.quvirlSignalHub .hubDetailList{display:grid!important;gap:8px!important;margin-top:10px!important}
.quvirlSignalHub .hubDetailList b{color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:14px!important}
.quvirlSignalHub .hubDetailList small{display:block!important;color:#fff!important;-webkit-text-fill-color:#fff!important;opacity:.78!important;font-size:12px!important;margin-top:2px!important}
.quvirlSignalHub .hubCore{left:44%!important;top:54%!important;transform:translate(-50%,-50%)!important;width:160px!important;height:104px!important;border-radius:22px!important}
.quvirlSignalHub .hubCore b{font-size:28px!important}
.quvirlSignalHub .hubCore small{font-size:12px!important}
.quvirlSignalHub .hubNode{width:106px!important;min-height:66px!important;border-radius:18px!important;font-size:13px!important;line-height:1.1!important}
.quvirlSignalHub .hubNode small{font-size:10px!important}
.quvirlSignalHub .nGoogle{left:2%!important;top:43%!important;transform:none!important}
.quvirlSignalHub .nAmazon{right:3%!important;top:29%!important;transform:none!important}
.quvirlSignalHub .nCJ{right:3%!important;top:62%!important;transform:none!important}
.quvirlSignalHub .nGoogle::after{right:-20px!important;left:auto!important;top:50%!important;bottom:auto!important}
.quvirlSignalHub .nAmazon::after,.quvirlSignalHub .nCJ::after{left:-20px!important;right:auto!important;top:50%!important;bottom:auto!important}
.quvirlSignalHub .hubWire{left:44%!important;top:54%!important;transform-origin:left center!important}
.quvirlSignalHub .wGoogle{width:150px!important;transform:rotate(180deg)!important}
.quvirlSignalHub .wAmazon{width:168px!important;transform:rotate(-29deg)!important}
.quvirlSignalHub .wCJ{width:170px!important;transform:rotate(31deg)!important}
@media(max-width:700px){
  .quvirlSignalHub{grid-template-columns:1fr!important;gap:8px!important;padding:16px 8px!important;margin-top:20px!important;border-radius:24px!important;min-height:auto!important}
  .quvirlSignalHub .hubDetails{order:1!important;text-align:left!important;padding:8px 10px!important}
  .quvirlSignalHub .hubMap{order:2!important;height:300px!important;min-height:300px!important}
  .quvirlSignalHub .hubDetails h2{font-size:24px!important;letter-spacing:-.8px!important}
  .quvirlSignalHub .hubDetails p{font-size:13px!important;line-height:1.45!important}
  .quvirlSignalHub .hubDetailList{grid-template-columns:1fr!important;background:rgba(255,255,255,.04)!important;border:1px solid rgba(110,231,183,.18)!important;border-radius:18px!important;padding:10px!important}
  .quvirlSignalHub .hubCore{left:42%!important;top:52%!important;width:132px!important;height:90px!important;border-radius:20px!important}
  .quvirlSignalHub .hubCore b{font-size:25px!important}
  .quvirlSignalHub .hubNode{width:88px!important;min-height:58px!important;border-radius:16px!important;font-size:11px!important}
  .quvirlSignalHub .hubNode small{font-size:9px!important}
  .quvirlSignalHub .nGoogle{left:4%!important;top:42%!important}
  .quvirlSignalHub .nAmazon{right:4%!important;top:30%!important}
  .quvirlSignalHub .nCJ{right:4%!important;top:60%!important}
  .quvirlSignalHub .hubWire{left:42%!important;top:52%!important}
  .quvirlSignalHub .wGoogle{width:104px!important;transform:rotate(180deg)!important}
  .quvirlSignalHub .wAmazon{width:120px!important;transform:rotate(-30deg)!important}
  .quvirlSignalHub .wCJ{width:120px!important;transform:rotate(30deg)!important}
}
`;

html = html.replace(/\/\* Signal hub side-layout final override \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', css + '\n</style>');
fs.writeFileSync(file, html, 'utf8');
console.log('Applied compact signal hub with left details and right visual.');
