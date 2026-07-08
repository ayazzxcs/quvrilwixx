const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE = 'https://quvirl.com';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.vercel'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, data) { fs.writeFileSync(file, data, 'utf8'); }

function canonicalForFile(rel) {
  rel = rel.replace(/\\/g, '/');
  if (rel === 'index.html') return `${SITE}/`;
  if (rel === 'about.html') return `${SITE}/about`;
  if (rel === 'contact.html') return `${SITE}/contact`;
  if (rel === 'privacy.html') return `${SITE}/privacy`;
  if (rel === 'terms.html') return `${SITE}/terms`;
  if (rel.endsWith('/index.html')) return `${SITE}/${rel.replace(/\/index\.html$/, '/')}`;
  return null;
}

function upsertHeadTag(html, tagName, attrs, replacement) {
  const attrKeys = Object.keys(attrs);
  const attrRegex = attrKeys.map(k => `(?=[^>]*\\b${k}=["']${attrs[k]}["'])`).join('');
  const re = new RegExp(`<${tagName}\\b${attrRegex}[^>]*>`, 'i');
  if (re.test(html)) return html.replace(re, replacement);
  return html.replace(/<\/title>\s*/i, m => `${m}\n${replacement}\n`);
}

function fixHtml(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let html = read(file);
  const before = html;
  const canonical = canonicalForFile(rel);

  // Replace old Cloudflare Pages domain everywhere it can leak into SEO tags/schema.
  html = html.replace(/https:\/\/droptrend\.pages\.dev/g, SITE);
  html = html.replace(/http:\/\/droptrend\.pages\.dev/g, SITE);

  // Fix invalid stray brace found after </style> on the homepage. It can cause crawlers to miss head tags.
  html = html.replace(/(<\/style>\s*)}\s*(\n\s*<meta\s+name=["']description["'])/i, '$1$2');

  // Add/update canonical + robots + og:url for crawlable HTML pages.
  if (canonical && /<head[\s>]/i.test(html)) {
    const canonicalTag = `<link rel="canonical" href="${canonical}">`;
    const robotsTag = `<meta name="robots" content="index,follow,max-image-preview:large">`;
    const ogUrlTag = `<meta property="og:url" content="${canonical}">`;

    if (/<link\b[^>]*rel=["']canonical["'][^>]*>/i.test(html)) html = html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/i, canonicalTag);
    else html = html.replace(/<\/title>\s*/i, m => `${m}\n${canonicalTag}\n`);

    if (/<meta\b[^>]*name=["']robots["'][^>]*>/i.test(html)) html = html.replace(/<meta\b[^>]*name=["']robots["'][^>]*>/i, robotsTag);
    else html = html.replace(new RegExp(canonicalTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${canonicalTag}\n${robotsTag}`);

    if (/<meta\b[^>]*property=["']og:url["'][^>]*>/i.test(html)) html = html.replace(/<meta\b[^>]*property=["']og:url["'][^>]*>/i, ogUrlTag);
    else html = html.replace(new RegExp(robotsTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${robotsTag}\n${ogUrlTag}`);
  }

  // Remove old DropTrend public-facing text. Keep code identifiers safe.
  html = html.replace(/DropTrend/g, 'Quvirl').replace(/Droptrend/g, 'Quvirl');
  html = html.replace(/droptrend-v2-products\.csv/g, 'quvirl-products.csv');

  if (html !== before) write(file, html);
}

for (const file of walk(ROOT)) {
  if (/\.(html|xml|txt|jsonc|js)$/i.test(file)) {
    let txt = read(file);
    const before = txt;
    txt = txt.replace(/https:\/\/droptrend\.pages\.dev/g, SITE).replace(/http:\/\/droptrend\.pages\.dev/g, SITE);
    if (txt !== before) write(file, txt);
  }
  if (/\.html$/i.test(file)) fixHtml(file);
}

// Keep robots.txt pointed at the real domain.
write(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

// Ensure sitemap includes important static pages and contains no old domain.
const sitemapPath = path.join(ROOT, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  let sitemap = read(sitemapPath).replace(/https:\/\/droptrend\.pages\.dev/g, SITE);
  const staticPages = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/about`, priority: '0.6' },
    { loc: `${SITE}/contact`, priority: '0.5' },
    { loc: `${SITE}/privacy`, priority: '0.4' },
    { loc: `${SITE}/terms`, priority: '0.4' },
  ];
  const today = new Date().toISOString().slice(0, 10);
  for (const page of staticPages) {
    if (!sitemap.includes(`<loc>${page.loc}</loc>`)) {
      sitemap = sitemap.replace('</urlset>', `  <url>\n    <loc>${page.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${page.priority}</priority>\n  </url>\n</urlset>`);
    }
  }
  write(sitemapPath, sitemap);
}

console.log('Applied Quvirl Vercel SEO canonical fixes.');
