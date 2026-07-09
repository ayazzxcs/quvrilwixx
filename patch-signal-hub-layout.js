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

/* Quvirl remove fake market-scan code box */
.hero::before,.hero::after{display:none!important;content:none!important}
.hero{padding-bottom:70px!important;min-height:auto!important}
.toolbar{margin-top:18px!important}
@media(max-width:700px){
  .hero{padding-bottom:38px!important;min-height:auto!important}
  .toolbar{margin-top:18px!important}
}


/* Quvirl laptop/desktop compact spacing fix
   Keeps the same design but pulls the real product area higher on 1366x768 laptops. */
@media (min-width: 901px){
  .wrap{padding-top:14px!important}
  .topNav{margin-bottom:8px!important;padding:8px 12px!important;border-radius:16px!important}
  .menuBtnLabel{width:36px!important;height:36px!important;border-radius:11px!important;font-size:20px!important}
  .miniMark{width:30px!important;height:30px!important;border-radius:9px!important}
  .miniMark svg{width:20px!important;height:20px!important}
  .miniBrand{font-size:19px!important}
  .navPill{padding:6px 10px!important;font-size:11px!important}
  .hero{padding-top:18px!important;padding-bottom:16px!important;gap:10px!important;min-height:auto!important}
  .brandLogo{margin-bottom:7px!important;gap:10px!important}
  .brandMark{width:44px!important;height:44px!important;border-radius:12px!important}
  .brandMark svg{width:29px!important;height:29px!important}
  .brandLogo .brandText b,.hero .brandLogo .brandText b,.heroCard .brandLogo .brandText b{font-size:50px!important;line-height:.95!important;letter-spacing:-1.25px!important}
  .brandText span{font-size:11px!important;margin-top:1px!important}
  .badge{padding:6px 11px!important;font-size:12px!important}
  h1{max-width:880px!important;margin:12px auto 9px!important;font-size:clamp(38px,5.2vw,56px)!important;line-height:1!important;letter-spacing:-2px!important}
  .lead{max-width:730px!important;font-size:15px!important;line-height:1.42!important}
  .stats{max-width:640px!important;margin:14px auto 0!important;gap:10px!important}
  .stat{padding:10px 12px!important;border-radius:14px!important}
  .stat b{font-size:21px!important;line-height:1!important}
  .stat span{font-size:10px!important;margin-top:3px!important}
  .currencyBox{margin-top:10px!important;gap:6px!important}
  .currencyBtn{padding:7px 11px!important;font-size:12px!important}
  .rateText{font-size:11px!important}
  .heroVisual.signalPanel{max-width:760px!important;margin-top:12px!important;gap:12px!important}
  .heroVisual .signalCard{padding:10px 12px!important;border-radius:14px!important}
  .heroVisual .signalCard span{font-size:9px!important}
  .heroVisual .signalCard b{font-size:14px!important;margin-top:3px!important}
  .heroVisual .signalBars{gap:6px!important;margin:8px 0!important}
  .heroVisual .signalRow{grid-template-columns:76px 1fr 38px!important;gap:7px!important;margin:4px 0!important;font-size:10px!important}
  .heroVisual .signalBar{height:6px!important}
  .heroVisual .visualChips{gap:5px!important;margin:7px 0 6px!important}
  .heroVisual .visualChip{font-size:9px!important;padding:4px 6px!important}
  .heroVisual p.small{font-size:10px!important;line-height:1.25!important;margin:5px 0 0!important}
  #apiStatus{margin-top:8px!important;font-size:11px!important}
  .toolbar{margin:8px 0 12px!important;padding:10px!important;border-radius:16px!important;gap:8px!important}
  .toolbar input,.toolbar select{padding:10px 12px!important;font-size:12px!important;border-radius:11px!important}
  .premiumTrending{margin:12px 0 14px!important;padding:14px!important;border-radius:18px!important}
  .premiumTrending h2{margin:0 0 4px!important;font-size:22px!important;line-height:1.1!important}
  .premiumTrending p{margin:4px 0 12px!important;font-size:12px!important;line-height:1.35!important}
  .trendLinks{gap:8px!important}
  .trendLink{padding:10px 12px!important;border-radius:14px!important}
  .trendLink b{font-size:13px!important}
  .trendLink span{font-size:11px!important;line-height:1.25!important}
  .winningPanel{margin:14px 0 18px!important;padding:16px!important;border-radius:20px!important}
  .winningHead{margin-bottom:12px!important}
  .winningHead h2{font-size:24px!important;line-height:1.1!important}
  .winningHead p{margin-top:5px!important;font-size:12px!important;line-height:1.35!important}
  .winnerGrid{gap:14px!important}
  .winnerGrid .img{height:180px!important}
  .winnerGrid .body{padding:13px!important}
  .winnerGrid .title{font-size:15px!important;line-height:1.2!important}
  .winnerGrid .metricGrid,.winnerGrid .money{margin:8px 0!important;gap:6px!important}
  .winnerGrid .metric,.winnerGrid .m{padding:7px!important}
  .winnerGrid .actions{margin-top:8px!important}
}
`;

html = html.replace(/\/\* Quvirl final blue brand \+ mobile signal panel override \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', css + '\n</style>');


// Quvirl final homepage signal-box label cleanup
html = html.replace(/(<div class="signalRow"><span>Demand<\/span><div class="signalBar"><i style="width:76%"><\/i><\/div><b>)Worldwide(<\/b><\/div>)/g, '$1World$2');
html = html.replace(/(<div class="signalRow"><span>Supply<\/span><div class="signalBar"><i style="width:82%"><\/i><\/div><b>)Supplier Data(<\/b><\/div>)/g, '$1Both$2');

fs.writeFileSync(file, html, 'utf8');
console.log('Removed Quvirl signal hub section and applied final blue brand/mobile signal overrides.');
