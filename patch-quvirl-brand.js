const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const TEXT_EXTS = new Set(['.html', '.xml', '.txt', '.json']);

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, text) { fs.writeFileSync(file, text, 'utf8'); }
function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (TEXT_EXTS.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}
function replaceBrandText(text) {
  return text
    .replace(/Drop\s*<span[^>]*>\s*Trend\s*<\/span>/g, 'Qu<span>virl</span>')
    .replace(/Quvirl<\/a>/g, 'Qu<span>virl</span></a>')
    .replace(/DropTrend v2/g, 'Quvirl')
    .replace(/DropTrend Score/g, 'Quvirl Score')
    .replace(/DropTrend score/g, 'Quvirl score')
    .replace(/DropTrend scoring/g, 'Quvirl scoring')
    .replace(/DropTrend Signal Engine/g, 'Quvirl Signal Engine')
    .replace(/DropTrend guides/g, 'Quvirl guides')
    .replace(/DropTrend/g, 'Quvirl')
    .replace(/Droptrend/g, 'Quvirl')
    .replace(/Drop trend/g, 'Quvirl')
    .replace(/Drop\s*Trend/g, 'Quvirl')
    .replace(/droptrend score/gi, 'Quvirl score')
    .replace(/Drop<span class="brandWord">Trend<\/span>/g, 'Quvirl')
    .replace(/<b>Drop<\/b>\s*<span[^>]*>Trend<\/span>/g, '<b>Quvirl</b>')
    .replace(/<span>Drop<\/span>\s*<span[^>]*>Trend<\/span>/g, '<span>Quvirl</span>');
}

function finalQuvirlPolish(text) {
  text = text
    .replace(/(<div class="signalRow"><span>Demand<\/span><div class="signalBar"><i style="width:76%"><\/i><\/div><b>)Worldwide(<\/b><\/div>)/g, '$1World$2')
    .replace(/(<div class="signalRow"><span>Supply<\/span><div class="signalBar"><i style="width:82%"><\/i><\/div><b>)Supplier Data(<\/b><\/div>)/g, '$1Both$2')
    .replace(/<a class="logo" href="\/">(?:Qu<span>virl<\/span>|Quvirl|<span class="brandQu">Qu<\/span><span class="brandVirl">virl<\/span>)<\/a>/g, '<a class="logo" href="/"><span class="brandQu">Qu</span><span class="brandVirl">virl</span></a>')
    .replace(/--brand:#38BDF8;/g, '--brand:#58a6ff;');

  if (text.includes('.logo span{color:var(--brand)}') && !text.includes('.logo .brandQu{color:#ffffff')) {
    text = text.replace(
      '.logo span{color:var(--brand)}',
      '.logo span{color:var(--brand)}\n  .logo .brandQu{color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;}\n  .logo .brandVirl{color:#58a6ff!important;-webkit-text-fill-color:#58a6ff!important;}'
    );
  }
  return text;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const before = read(file);
  const after = finalQuvirlPolish(replaceBrandText(before));
  if (after !== before) { write(file, after); changed++; }
}

const home = path.join(ROOT, 'index.html');
if (fs.existsSync(home)) {
  let html = read(home);

  html = html.replace(/<div class="brandLogo">[\s\S]*?<\/div>\s*<\/div>\s*<div class="badge">/, `<div class="brandLogo">
  <div class="brandMark" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#0C447C"/>
<path d="M16 44 L30 30 L40 38 L52 18" stroke="#378ADD" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="10" y="34" width="13" height="13" rx="3" fill="#B5D4F4"/>
</svg></div>
  <div class="brandText"><b><span class="brandQu">Qu</span><span class="brandVirl">virl</span></b><span>Discover Winning Products Before Everyone Else</span></div>
</div>

<div class="badge">`);

  html = html.replace(/<span class="brandQu">Qu<\/span><span class="brandVirl">virl<\/span>/g, 'Quvirl');
  html = html.replace(/<b>Quvirl<\/b>/g, '<b><span class="brandQu">Qu</span><span class="brandVirl">virl</span></b>');
  html = html.replace(/>Quvirl</g, '><span class="brandQu">Qu</span><span class="brandVirl">virl</span><');

  const hubMarkup = `<section class="quvirlSignalHub" aria-label="Quvirl signal hub">
  <div class="hubMap" aria-hidden="true">
    <div class="hubWire wGoogle"></div><div class="hubWire wAmazon"></div><div class="hubWire wCJ"></div>
    <div class="hubCore"><b><span class="brandQu">Qu</span><span class="brandVirl">virl</span></b><small>Signal Hub</small></div>
    <div class="hubNode nGoogle">Google<br><small>Trends</small></div>
    <div class="hubNode nAmazon">Amazon<br><small>Demand</small></div>
    <div class="hubNode nCJ">CJ<br><small>Supplier</small></div>
  </div>
</section>`;

  html = html.replace(/<section class="quvirlSignalHub"[\s\S]*?<\/section>\s*/g, '');
  html = html.replace(/<p class="small" id="apiStatus"/, hubMarkup + '\n<p class="small" id="apiStatus"');

  const css = `
/* Quvirl consolidated final styling */
:root{--accent:#6ee7b7!important;--gh-green:#22c55e!important;--gh-green2:#6ee7b7!important;--muted:#ffffff!important;--gh-muted:#ffffff!important}
html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important}.wrap{width:100%!important;max-width:1240px!important;margin:auto!important;box-sizing:border-box!important}.hero,.topNav,.toolbar,.premiumTrending,.winningPanel,.panel,.grid,.winnerGrid,.calc,.calculator,.marginCalculator,.marginCalc{max-width:100%!important;box-sizing:border-box!important}
.brandQu,.brandVirl,.brandText b .brandQu,.brandText b .brandVirl,.miniBrand .brandQu,.miniBrand .brandVirl,.sideBrand .brandQu,.sideBrand .brandVirl{display:inline!important;white-space:nowrap!important;line-height:1!important;text-shadow:none!important}.brandQu,.brandText b .brandQu,.miniBrand .brandQu,.sideBrand .brandQu{color:#ffffff!important;-webkit-text-fill-color:#ffffff!important}.brandVirl,.brandText b .brandVirl,.miniBrand .brandVirl,.sideBrand .brandVirl{color:#58a6ff!important;-webkit-text-fill-color:#58a6ff!important;text-shadow:none!important}.brandLogo .brandText b,.hero .brandLogo .brandText b,.heroCard .brandLogo .brandText b{display:block!important;font-size:72px!important;line-height:1!important;letter-spacing:-2px!important;white-space:nowrap!important;text-shadow:none!important;font-weight:950!important}.brandLogo .brandText b .brandQu,.brandLogo .brandText b .brandVirl,.hero .brandLogo .brandText b .brandQu,.hero .brandLogo .brandText b .brandVirl,.heroCard .brandLogo .brandText b .brandQu,.heroCard .brandLogo .brandText b .brandVirl{font-size:inherit!important;line-height:inherit!important;font-weight:inherit!important}.miniBrand{font-size:22px!important;line-height:1!important;white-space:nowrap!important;text-shadow:none!important}.sideBrand{white-space:nowrap!important;text-shadow:none!important}
.badge,.navPill,.winBadge,.visualChip,.pill{background:rgba(110,231,183,.14)!important;border-color:rgba(110,231,183,.34)!important;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important}.currencyBtn.active,button{background:linear-gradient(135deg,#22c55e,#14b8a6)!important;border-color:rgba(110,231,183,.45)!important;color:#04110c!important}.signalPanel{grid-template-columns:1fr 1fr!important;max-width:980px!important;gap:16px!important}.signalPanel .signalCard:nth-child(2){display:block!important}.signalCard span{color:#6ee7b7!important}.signalBar i{background:linear-gradient(90deg,#22c55e,#14b8a6,#6ee7b7)!important;box-shadow:0 0 16px rgba(110,231,183,.48)!important}.scoreRing{background:conic-gradient(#6ee7b7 calc(var(--score)*1%),rgba(255,255,255,.10) 0)!important}.scoreRing b,.profit,.result{color:#6ee7b7!important;-webkit-text-fill-color:#6ee7b7!important}
.quvirlSignalHub{width:min(980px,100%);margin:28px auto 8px;padding:22px 10px;border-radius:30px;background:radial-gradient(circle at 50% 55%,rgba(34,197,94,.24),transparent 38%),linear-gradient(180deg,rgba(0,0,0,.76),rgba(0,0,0,.90));border:1px solid rgba(110,231,183,.24);box-shadow:0 28px 90px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05);overflow:hidden}.hubMap{position:relative;width:100%;height:390px;margin:0 auto;overflow:hidden}.hubCore{position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);width:220px;height:138px;border-radius:28px;background:linear-gradient(135deg,#11b73e,#00d084);display:grid;place-items:center;align-content:center;box-shadow:0 0 0 1px rgba(255,255,255,.16) inset,0 0 65px rgba(34,197,94,.52);z-index:3}.hubCore b{font-size:38px!important;line-height:1!important}.hubCore small{font-weight:900;color:#fff!important;opacity:.95}.hubNode{position:absolute;width:150px;min-height:88px;border-radius:24px;background:#fff;color:#05070b!important;font-weight:950;display:grid;place-items:center;text-align:center;box-shadow:0 16px 38px rgba(0,0,0,.45);z-index:4;font-size:17px;line-height:1.1}.hubNode small{color:#23272f!important;font-weight:800;font-size:12px}.hubNode::after{content:"";position:absolute;width:15px;height:15px;border-radius:50%;background:#22c55e;box-shadow:0 0 16px rgba(34,197,94,.8)}.nGoogle{left:15%;top:43%}.nAmazon{right:15%;top:43%}.nCJ{left:50%;top:10%;transform:translateX(-50%)}.nGoogle::after{right:-26px;top:50%}.nAmazon::after{left:-26px;top:50%}.nCJ::after{left:50%;bottom:-26px}.hubWire{position:absolute;left:50%;top:58%;height:2px;background:linear-gradient(90deg,rgba(110,231,183,.08),rgba(110,231,183,.72));transform-origin:left center;z-index:1}.wGoogle{width:230px;transform:rotate(180deg)}.wAmazon{width:230px;transform:rotate(0deg)}.wCJ{width:152px;transform:rotate(270deg)}
.card,.grid .card,.winnerGrid .card,.motion-ready .card,.motion-ready .dt-in.card{opacity:1!important;visibility:visible!important;transform:none!important;animation:none!important}.card::after{display:none!important;animation:none!important}.card:hover{transform:translateY(-3px)!important}.img img{opacity:1!important;visibility:visible!important}.grid,.winnerGrid{min-height:0!important;overflow:visible!important}.premiumTrending,.winningPanel{overflow:visible!important}.muted,.small,.rateText,.lead,.premiumTrending p,.winningHead p,.card .muted,.card .small,.card p,.card span,.metric span,.m span,.stat span,.signalRow>span:first-child,.signalRow>span:last-child,.trendLink small,.siteChip small,.menuItem span,.chev,.menuSubTitle,.footer,.footer *,.table th,.table td,.brandText span,.sectionTitle p,.winningPanel p,.visualSummary span,.money span,.row span,.productMeta,.productMeta *{color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;opacity:.96!important}.card .title,.card b,.card strong,h1,h2,h3,.sectionTitle h2,.winningHead h2,.signalCard b,.stat b,.m b,.metric b{color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;opacity:1!important}.pill,.visualChip,.winBadge,.navPill,.badge{color:#ffffff!important;-webkit-text-fill-color:#ffffff!important}
.hero::before,.hero::after{display:none!important;content:none!important}.hero{padding-bottom:70px!important;min-height:auto!important}.toolbar{margin-top:18px!important}.toolbar input,.toolbar select{min-width:0!important;width:100%!important}#calc,.calc,.calculator,.marginCalculator,.marginCalc,[id*="calc" i],[class*="calc" i]{width:100%!important;max-width:100%!important;overflow:hidden!important;box-sizing:border-box!important}#calc input,.calc input,.calculator input,.marginCalculator input,.marginCalc input,[id*="calc" i] input,[class*="calc" i] input{min-width:0!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}#calc .inputs,.calc .inputs,.calculator .inputs,.marginCalculator .inputs,.marginCalc .inputs,#calc .row,.calc .row,.calculator .row,.marginCalculator .row,.marginCalc .row,[id*="calc" i] .row,[class*="calc" i] .row{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;width:100%!important;max-width:100%!important;overflow:hidden!important;box-sizing:border-box!important}
@media(max-width:700px){.wrap{padding:14px!important;max-width:100%!important;overflow:hidden!important}.topNav{width:100%!important;margin-left:0!important;margin-right:0!important}.hero{text-align:center!important;padding-left:0!important;padding-right:0!important;overflow:hidden!important}h1{max-width:100%!important;font-size:clamp(34px,9vw,48px)!important;line-height:1.02!important;letter-spacing:-1.5px!important}.lead{max-width:100%!important;font-size:14px!important}.stats{grid-template-columns:1fr!important;width:100%!important;max-width:100%!important}.currencyBox{justify-content:center!important;width:100%!important}.signalPanel{grid-template-columns:1fr!important;width:100%!important;max-width:100%!important;gap:12px!important}.signalCard{padding:12px!important;min-width:0!important;overflow:hidden!important}.signalCard b{font-size:14px!important;line-height:1.2!important}.signalCard span{font-size:9px!important}.signalCard p.small{font-size:9px!important;line-height:1.35!important}.signalRow{grid-template-columns:54px minmax(0,1fr) auto!important;gap:6px!important;align-items:center!important}.signalRow>span:first-child{font-size:8px!important}.signalRow>b{font-size:11px!important;justify-self:end!important;max-width:96px!important;white-space:normal!important;text-align:right!important;overflow-wrap:anywhere!important;line-height:1.08!important}.signalBar{height:7px!important}.visualChips{gap:5px!important}.visualChip{font-size:8px!important;padding:5px 6px!important}.toolbar{grid-template-columns:1fr!important;width:100%!important;margin-left:0!important;margin-right:0!important;margin-top:18px!important}.premiumTrending,.winningPanel{width:100%!important;margin-left:0!important;margin-right:0!important}.trendLinks{grid-template-columns:1fr!important}.winnerGrid,.grid{grid-template-columns:1fr!important;width:100%!important}.card{width:100%!important;max-width:100%!important}.card:hover{transform:none!important}.brandLogo .brandText b,.hero .brandLogo .brandText b,.heroCard .brandLogo .brandText b{font-size:54px!important;line-height:1!important;letter-spacing:-1.5px!important}.miniBrand{font-size:22px!important}#calc .inputs,.calc .inputs,.calculator .inputs,.marginCalculator .inputs,.marginCalc .inputs,#calc .row,.calc .row,.calculator .row,.marginCalculator .row,.marginCalc .row,[id*="calc" i] .row,[class*="calc" i] .row{grid-template-columns:1fr 1fr!important;gap:10px!important}#calc input,.calc input,.calculator input,.marginCalculator input,.marginCalc input,[id*="calc" i] input,[class*="calc" i] input{font-size:14px!important;padding:14px 12px!important}.quvirlSignalHub{padding:18px 6px!important;margin-top:24px!important;border-radius:24px!important}.hubMap{height:330px!important;min-height:330px!important}.hubCore{width:138px!important;height:96px!important;border-radius:21px!important;top:60%!important}.hubCore b{font-size:27px!important}.hubNode{width:94px!important;min-height:62px!important;border-radius:17px!important;font-size:12px!important}.hubNode small{font-size:10px!important}.nGoogle{left:8%!important;top:46%!important}.nAmazon{right:8%!important;top:46%!important}.nCJ{left:50%!important;top:8%!important;transform:translateX(-50%)!important}.wGoogle{width:118px!important}.wAmazon{width:118px!important}.wCJ{width:122px!important}}
`;

  html = html.replace(/\/\* Quvirl consolidated final styling \*\/[\s\S]*?(?=<\/style>)/g, '');
  html = html.replace(/\/\* Quvirl brand:[\s\S]*?(?=<\/style>)/g, '');
  html = html.replace(/\/\* Quvirl brand cleanup:[\s\S]*?(?=<\/style>)/g, '');
  html = html.replace(/\/\* Quvirl blue-only brand cleanup \*\/[\s\S]*?(?=<\/style>)/g, '');
  html = html.replace(/\/\* Old mint green theme override \*\/[\s\S]*?(?=<\/style>)/g, '');
  html = html.replace(/\/\* Product card animation fix: show cards immediately \*\/[\s\S]*?(?=<\/style>)/g, '');
  html = html.replace(/\/\* Product card text contrast fix \*\/[\s\S]*?(?=<\/style>)/g, '');
  html = html.replace(/\/\* Remove grey text across site \*\/[\s\S]*?(?=<\/style>)/g, '');
  html = html.replace(/\/\* Quvirl split brand name[^*]*\*\/[\s\S]*?(?=<\/style>)/g, '');
  html = html.replace('</style>', css + '\n</style>');
  html = finalQuvirlPolish(html);
  write(home, html);
}

console.log(`Applied consolidated Quvirl branding with side-wise fixed 3-source signal hub. Text-updated files: ${changed}.`);
