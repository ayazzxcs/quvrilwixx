const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const css = `
/* Remove grey text across site */
:root{--muted:#ffffff!important;--gh-muted:#ffffff!important}
.muted,.small,.rateText,.lead,
.premiumTrending p,.winningHead p,
.card .muted,.card .small,.card p,.card span,
.metric span,.m span,.stat span,
.signalRow>span:first-child,.signalRow>span:last-child,
.trendLink small,.siteChip small,.menuItem span,.chev,.menuSubTitle,
.footer,.footer *,.table th,.table td,
.brandText span,.sectionTitle p,.winningPanel p,
.visualSummary span,.money span,.row span,
.productMeta,.productMeta *{
  color:#ffffff!important;
  -webkit-text-fill-color:#ffffff!important;
  opacity:.96!important;
}
.card .title,.card b,.card strong,
h1,h2,h3,.sectionTitle h2,.winningHead h2,
.signalCard b,.stat b,.m b,.metric b{
  color:#ffffff!important;
  -webkit-text-fill-color:#ffffff!important;
  opacity:1!important;
}
.profit,.result,.scoreRing b,.signalCard span{
  color:#6ee7b7!important;
  -webkit-text-fill-color:#6ee7b7!important;
}
.pill,.visualChip,.winBadge,.navPill,.badge{
  color:#ffffff!important;
  -webkit-text-fill-color:#ffffff!important;
}
`;

html = html.replace(/\/\* Remove grey text across site \*\/[\s\S]*?(?=<\/style>)/g, '');
html = html.replace('</style>', css + '\n</style>');

fs.writeFileSync(file, html, 'utf8');
console.log('Replaced muted grey text with white site-wide.');
