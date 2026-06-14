const fs = require('fs');
const path = require('path');

const SITE_URL = (process.env.SITE_URL || 'https://droptrend.pages.dev').replace(/\/$/, '');
const PRODUCTS_URL = process.env.PRODUCTS_URL || 'https://raw.githubusercontent.com/ayazzxcs/Droptrendv2-backend/main/products.json';
const MAX_PRODUCT_PAGES = Number(process.env.MAX_PRODUCT_PAGES || 1500);
const NOW = new Date().toISOString().slice(0, 10);
const MONTH_KEY = new Date().toISOString().slice(0, 7);
const MARKET_SIGNAL_COPY = 'Based on recent monthly market signals from Google Trends, Amazon demand, and CJ supplier data.';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function cleanProductName(value) {
  let s = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value ?? '');
  s = s.trim();
  if ((s.startsWith('[') && s.endsWith(']')) || s.includes('\",\"') || s.includes("','")) {
    try {
      const parsed = JSON.parse(s.replace(/'/g, '"'));
      if (Array.isArray(parsed)) s = parsed.filter(Boolean).join(' ');
    } catch (e) {
      s = s.replace(/^\s*\[+/, '').replace(/\]+\s*$/, '').replace(/["']/g, '').replace(/,/g, ' ');
    }
  }
  return s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim() || 'Untitled product';
}
function first(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return '';
}
function proof(p) { return p?.trendProof || p?.proof || {}; }
function slugify(input, max = 80) {
  return String(input || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'product';
}
function categorySlug(category) {
  const c = String(category || 'general').toLowerCase();
  if (c.includes('pet')) return 'pet-products';
  if (c.includes('beaut')) return 'beauty-products';
  if (c.includes('home') || c.includes('garden') || c.includes('furniture')) return 'home-living-products';
  if (c.includes('jewel') || c.includes('ring') || c.includes('necklace') || c.includes('earring')) return 'jewelry-products';
  if (c.includes('fashion') || c.includes('cloth') || c.includes('women') || c.includes('men')) return 'fashion-products';
  if (c.includes('car') || c.includes('auto')) return 'automotive-products';
  if (c.includes('fitness') || c.includes('sport')) return 'fitness-products';
  if (c.includes('gadget') || c.includes('elect') || c.includes('device')) return 'gadgets-products';
  return slugify(category || 'general-products', 50) || 'general-products';
}
function normalize(raw) {
  const pr = proof(raw);
  const google = pr.googleTrends || {};
  const amazon = pr.amazon || {};
  const cj = pr.cjSupplier || {};
  const name = cleanProductName(first(raw.name, raw.productName, raw.title, raw.raw?.productName, 'Untitled product'));
  const category = first(raw.category, raw.categoryName, raw.productType, raw.raw?.categoryName, 'General');
  const image = first(raw.image, raw.productImage, raw.bigImage, raw.img, raw.raw?.productImage, raw.raw?.bigImage, Array.isArray(raw.raw?.productImageSet) ? raw.raw.productImageSet[0] : '');
  const supplierUrl = first(raw.supplierUrl, raw.productUrl, raw.productLink, raw.shopUrl, raw.raw?.productUrl, raw.raw?.productLink, 'https://www.cjdropshipping.com/');
  const cost = num(first(raw.cost, raw.supplierPrice, raw.sellPrice, raw.raw?.sellPrice, cj.price));
  const shipping = num(first(raw.shipping, raw.shippingPrice, raw.freight, raw.raw?.shippingPrice, cj.shipping));
  const sell = num(first(raw.sell, raw.suggestedPrice, raw.salePrice, raw.raw?.salePrice)) || Math.max(9.99, (cost + shipping) * 2.2);
  const profit = Math.max(0, num(first(raw.profit, sell - cost - shipping)));
  const margin = sell ? Math.round((profit / sell) * 100) : 0;
  const id = String(first(raw.id, raw.pid, raw.productId, raw.sku, raw.raw?.pid, raw.raw?.productId, name)).trim();
  const score = Math.max(1, Math.min(100, num(first(raw.dropTrendScore, raw.trend, raw.winningScore))));
  const keywords = [raw.aiKeywords, raw.specificKeywords, raw.tags].flat().filter(Boolean).join(', ');
  return {
    ...raw,
    id, name, category, image, supplierUrl, cost, shipping, sell, profit, margin, score,
    googleGrowth: num(first(google.growthPercent, raw.growthPercent, raw.googleGrowth)),
    googleScore: num(first(google.score, raw.googleScore, raw.googleTrendScore)),
    trendDirection: first(raw.trendDirection, raw.googleTrendDirection, google.trendDirection, 'flat'),
    amazonScore: num(first(amazon.score, raw.amazonScore, raw.amazonDemandScore)),
    amazonRating: first(amazon.bestRating, raw.bestRating, ''),
    amazonReviews: num(first(amazon.bestRatingsTotal, raw.bestRatingsTotal, 0)),
    cjScore: num(first(cj.score, raw.cjScore, raw.cjSupplierScore)),
    confidence: first(pr.confidence, raw.confidence, 'Medium'),
    keywords,
    slug: '',
    url: ''
  };
}
function formatGrowth(n, direction) {
  n = Math.round(num(n));
  if (direction === 'up') return `Google searches increased about ${Math.abs(n)}%`;
  if (direction === 'down') return `Google searches decreased about ${Math.abs(n)}%`;
  if (!n) return 'Google interest is currently stable';
  return n > 0 ? `Google searches increased about ${n}%` : `Google searches decreased about ${Math.abs(n)}%`;
}
function money(n) { return '$' + Number(num(n)).toFixed(2); }
function layout({ title, description, canonical, body, schema = [], extraHead = '' }) {
  const schemas = Array.isArray(schema) ? schema.filter(Boolean) : [schema].filter(Boolean);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${extraHead}
<style>
:root{--bg:#0b1020;--card:#101832;--line:#26345e;--text:#edf2ff;--muted:#aab7da;--accent:#6ee7b7}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;background:radial-gradient(circle at top left,#1b2c61,#0b1020 42%,#060913);color:var(--text);line-height:1.6}a{color:#6ee7b7;text-decoration:none}.wrap{max-width:1180px;margin:auto;padding:24px}.hero,.card{background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.035));border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:0 18px 60px rgba(0,0,0,.25)}.hero{margin:14px 0 22px}h1{font-size:42px;line-height:1.1;margin:10px 0 12px}h2{margin-top:0}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.product{background:#101832;border:1px solid var(--line);border-radius:20px;overflow:hidden}.product img{width:100%;height:210px;object-fit:cover;background:#fff}.body{padding:15px}.title{font-weight:850;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.pill{display:inline-flex;background:#1a254a;color:#cbd5ff;padding:6px 9px;border-radius:999px;font-size:12px;margin:4px 4px 0 0}.metric{background:#0a1128;border:1px solid var(--line);border-radius:14px;padding:10px;margin:8px 0}.metric b{color:var(--accent)}.links{display:flex;gap:10px;flex-wrap:wrap}.links a,.btn{background:linear-gradient(135deg,#22c55e,#14b8a6);color:#04110c;font-weight:900;border-radius:12px;padding:11px 14px;display:inline-flex}.btn2{background:#182143;color:var(--text);border:1px solid var(--line)}.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.toc{display:flex;gap:8px;flex-wrap:wrap}.toc a{background:#182143;border:1px solid var(--line);padding:8px 10px;border-radius:999px;font-size:13px}@media(max-width:900px){.grid,.two{grid-template-columns:1fr 1fr}h1{font-size:34px}}@media(max-width:620px){.wrap{padding:14px}.grid,.two{grid-template-columns:1fr}h1{font-size:29px}.product img{height:230px}}
</style>
${schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body><div class="wrap"><p><a href="/">← DropTrend</a></p>${body}<footer class="muted" style="text-align:center;margin:34px 0 10px;border-top:1px solid var(--line);padding-top:20px">DropTrend is independent and is not affiliated with Amazon, Google, CJdropshipping or AliExpress.</footer></div></body>
</html>`;
}
function productCard(p) {
  return `<article class="product"><a href="${esc(p.url)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></a><div class="body"><a class="title" href="${esc(p.url)}">${esc(p.name)}</a><div><span class="pill">Score ${p.score}/100</span><span class="pill">${esc(p.category)}</span></div><div class="metric">Profit: <b>${money(p.profit)}</b> • Margin: <b>${p.margin}%</b></div><div class="metric">${esc(formatGrowth(p.googleGrowth, p.trendDirection))}</div></div></article>`;
}
function relatedProducts(p, all, count = 8) {
  const sameCat = all.filter(x => x.id !== p.id && categorySlug(x.category) === categorySlug(p.category));
  return sameCat.sort((a, b) => b.score - a.score).slice(0, count);
}
function productPage(p, all) {
  const canonical = `${SITE_URL}${p.url}`;
  const title = `${p.name} - Trending Dropshipping Product | DropTrend`;
  const desc = `${p.name} trend research: DropTrend score ${p.score}/100, ${formatGrowth(p.googleGrowth, p.trendDirection)}, Amazon demand ${p.amazonScore || 0}/100 and CJ supplier score ${p.cjScore || 0}/100.`;
  const rel = relatedProducts(p, all, 9);
  const faq = [
    { q: `Is ${p.name} good for dropshipping?`, a: `${p.name} may be worth testing because DropTrend combines monthly search trend data, Amazon marketplace demand and CJ supplier signals before ranking it.` },
    { q: 'What does the DropTrend score mean?', a: 'The DropTrend score combines Google Trends, Amazon demand and CJ supplier metrics into one monthly product research score.' },
    { q: 'Should I test this product with ads?', a: `Check the score, margin, product image quality, supplier availability and audience fit before spending ad budget on ${p.name}.` }
  ];
  const schema = [
    {'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'DropTrend','item':SITE_URL+'/'},{'@type':'ListItem','position':2,'name':p.category,'item':`${SITE_URL}/category/${categorySlug(p.category)}/`},{'@type':'ListItem','position':3,'name':p.name,'item':canonical}]},
    {'@context':'https://schema.org','@type':'Product','name':p.name,'image':p.image?[p.image]:undefined,'category':p.category,'description':desc,'brand':{'@type':'Brand','name':'DropTrend'},'offers':{'@type':'Offer','priceCurrency':'USD','price':p.sell||p.cost||0,'availability':'https://schema.org/InStock','url':canonical},...(p.amazonRating?{'aggregateRating':{'@type':'AggregateRating','ratingValue':String(p.amazonRating),'reviewCount':String(p.amazonReviews||1)}}:{})},
    {'@context':'https://schema.org','@type':'FAQPage','mainEntity':faq.map(f=>({'@type':'Question','name':f.q,'acceptedAnswer':{'@type':'Answer','text':f.a}}))}
  ];
  const body = `<main><section class="hero"><div class="two"><div><img src="${esc(p.image)}" alt="${esc(p.name)} product image" style="width:100%;border-radius:18px;background:#fff" loading="eager"></div><div><span class="pill">${esc(p.category)}</span><span class="pill">Confidence: ${esc(p.confidence)}</span><h1>${esc(p.name)}</h1><p class="muted">Dropshipping product research powered by monthly Google Trends, Amazon market demand and supplier data.</p><div class="metric">DropTrend Score: <b>${p.score}/100</b></div><div class="metric">Google Trends: <b>${esc(formatGrowth(p.googleGrowth, p.trendDirection))}</b></div><div class="metric">Amazon Demand: <b>${p.amazonScore || 0}/100</b>${p.amazonReviews ? ` • ${p.amazonReviews.toLocaleString()} reviews` : ''}${p.amazonRating ? ` • ${esc(p.amazonRating)}★` : ''}</div><div class="metric">CJ Supplier Score: <b>${p.cjScore || 0}/100</b></div><div class="metric">Estimated Profit: <b>${money(p.profit)}</b> • Margin: <b>${p.margin}%</b></div><p class="links"><a href="${esc(p.supplierUrl)}" target="_blank" rel="noopener">Open CJ Supplier</a><a class="btn2" href="/category/${categorySlug(p.category)}/">More ${esc(p.category)}</a></p></div></div></section><section class="card"><h2>Why this product is trending</h2><p>${esc(p.name)} appears on DropTrend because it matched a combination of recent monthly real-market product signals. The page checks 30–90 day search momentum from Google Trends, marketplace validation from Amazon demand signals, and supplier readiness from CJdropshipping data.</p><p>For sellers, this means ${esc(p.name)} can be reviewed as a possible product test instead of guessing from random viral videos. The strongest parts to check are the DropTrend score, category fit, margin, supplier image quality, reviews/rating signal and whether the product solves a clear buyer problem.</p><p>This product belongs to the ${esc(p.category)} market, so the best test is usually a focused single-product landing page, one clear product benefit, and 3–5 short ad creatives. Avoid treating the score as a guaranteed winner. Use it as a shortlist signal, then validate buyer response with small-budget ad testing, organic TikTok/Reels posts, and supplier delivery checks.</p></section><section class="card" style="margin-top:18px"><h2>Monthly market research summary</h2><p><b>Search demand:</b> ${esc(formatGrowth(p.googleGrowth, p.trendDirection))}. A stable or rising monthly pattern is usually safer for dropshippers than a short weekly spike because product sourcing, page setup and ad testing take time.</p><p><b>Marketplace validation:</b> Amazon demand score is ${p.amazonScore || 0}/100${p.amazonReviews ? ` with ${p.amazonReviews.toLocaleString()} review signals` : ''}. This helps identify whether buyers already understand the product type.</p><p><b>Supplier readiness:</b> CJ supplier score is ${p.cjScore || 0}/100. Before testing, still check processing time, shipping methods, product variants, image quality, refund risk and whether the supplier page looks active.</p></section><section class="card" style="margin-top:18px"><h2>Ad angles and audience ideas</h2><ul><li><b>Problem-solution angle:</b> show the problem first, then demonstrate how ${esc(p.name)} fixes it quickly.</li><li><b>Comparison angle:</b> compare a normal option versus this product’s convenience, design or price advantage.</li><li><b>Gift angle:</b> test creatives around gifting, home improvement, beauty routine, pet care or daily convenience depending on the category.</li><li><b>UGC angle:</b> use short videos, simple demos, before/after shots and clear captions for TikTok, Instagram Reels and Facebook ads.</li></ul></section><section class="card" style="margin-top:18px"><h2>Dropshipping checklist</h2><div class="two"><div><div class="metric">Supplier cost: <b>${money(p.cost)}</b></div><div class="metric">Suggested sell price: <b>${money(p.sell)}</b></div><div class="metric">Estimated margin: <b>${p.margin}%</b></div></div><div><div class="metric">Category: <b>${esc(p.category)}</b></div><div class="metric">Confidence: <b>${esc(p.confidence)}</b></div><div class="metric">Keywords: <b>${esc(p.keywords || p.name).slice(0, 180)}</b></div></div></div><p class="muted">A strong test product should have a simple buyer problem, clear product images, enough margin after shipping and ads, and a supplier that can handle consistent fulfillment.</p></section><section class="card" style="margin-top:18px"><h2>FAQ</h2>${faq.map(f=>`<h3>${esc(f.q)}</h3><p class="muted">${esc(f.a)}</p>`).join('')}</section>${rel.length ? `<section style="margin-top:24px"><h2>Related trending products</h2><div class="grid">${rel.map(productCard).join('')}</div></section>` : ''}</main>`;
  return layout({ title, description: desc, canonical, body, schema, extraHead: p.image ? `<meta property="og:image" content="${esc(p.image)}">` : '' });
}
function listingPage({ slug, title, description, intro, products, priority = '0.8' }) {
  const canonical = `${SITE_URL}/${slug}/`;
  const schema = {'@context':'https://schema.org','@type':'CollectionPage','name':title,'description':description,'url':canonical};
  const body = `<section class="hero"><h1>${esc(title)}</h1><p class="muted">${esc(intro)}</p><p class="pill">Monthly market signal update: ${esc(MONTH_KEY)}</p><div class="toc"><a href="/top-trending-products/">Top trending products</a><a href="/trending-this-month/">Trending this month</a><a href="/category/pet-products/">Pet products</a><a href="/category/home-living-products/">Home products</a><a href="/category/beauty-products/">Beauty products</a><a href="/blog/best-dropshipping-products-2026/">Best products 2026</a></div></section><div class="grid">${products.map(productCard).join('')}</div><section class="card" style="margin-top:24px"><h2>How DropTrend ranks these products</h2><p>DropTrend ranks products using recent monthly Google Trends search demand, Amazon market demand and CJdropshipping supplier data. Use this page to shortlist products, then check supplier quality, ad creatives, delivery time and margin before testing.</p><p class="muted">${esc(MARKET_SIGNAL_COPY)} This is designed for dropshippers who need more stable demand signals, not short-lived weekly hype.</p></section>`;
  return { html: layout({ title, description, canonical, body, schema }), url: canonical, priority };
}
function blogPage(slug, title, description, products, angle) {
  const canonical = `${SITE_URL}/blog/${slug}/`;
  const items = products.slice(0, 20);
  const body = `<article class="hero"><h1>${esc(title)}</h1><p class="muted">${esc(description)}</p><p>Updated ${NOW}. This guide uses DropTrend monthly product signals to help ecommerce sellers find product ideas with search demand, supplier availability and marketplace validation.</p></article><section class="card"><h2>${esc(angle)}</h2><ol>${items.map(p=>`<li><a href="${esc(p.url)}"><b>${esc(p.name)}</b></a> — Score ${p.score}/100, ${esc(formatGrowth(p.googleGrowth, p.trendDirection))}, estimated margin ${p.margin}%.</li>`).join('')}</ol></section><section style="margin-top:24px"><h2>Explore these products</h2><div class="grid">${items.slice(0, 12).map(productCard).join('')}</div></section>`;
  const schema = {'@context':'https://schema.org','@type':'Article','headline':title,'description':description,'dateModified':NOW,'datePublished':NOW,'author':{'@type':'Organization','name':'DropTrend'},'publisher':{'@type':'Organization','name':'DropTrend'},'mainEntityOfPage':canonical};
  return { html: layout({ title, description, canonical, body, schema }), url: canonical, priority: '0.75' };
}

function blogIndexPage(products) {
  const canonical = `${SITE_URL}/blog/`;
  const top = products.slice(0, 12);
  const posts = [
    { href:'/blog/best-dropshipping-products-2026/', title:'Best Dropshipping Products 2026', desc:'A monthly research list of product ideas ranked by market signals.' },
    { href:'/blog/best-tiktok-products-to-sell/', title:'Best TikTok Products to Sell', desc:'Visual product ideas for TikTok, Reels and short-form ads.' },
    { href:'/blog/high-margin-dropshipping-products/', title:'High Margin Dropshipping Products', desc:'Product ideas sorted by estimated margin and demand signals.' }
  ];
  const body = `<section class="hero"><h1>DropTrend Product Research Blog</h1><p class="muted">Monthly dropshipping research guides based on Google Trends, Amazon demand and CJ supplier data.</p><div class="grid">${posts.map(post => `<article class="card"><h2><a href="${post.href}">${esc(post.title)}</a></h2><p class="muted">${esc(post.desc)}</p><a class="btn" href="${post.href}">Read guide</a></article>`).join('')}</div></section><section style="margin-top:24px"><h2>Popular products from this month</h2><div class="grid">${top.map(productCard).join('')}</div></section>`;
  const schema = {'@context':'https://schema.org','@type':'Blog','name':'DropTrend Product Research Blog','description':'Dropshipping product research guides using monthly market signals.','url':canonical};
  return { html: layout({ title:'DropTrend Blog - Dropshipping Product Research', description:'Monthly dropshipping product research guides based on Google Trends, Amazon demand and supplier data.', canonical, body, schema }), url: canonical, priority: '0.8' };
}

async function loadProducts() {
  if (fs.existsSync('products.json')) return JSON.parse(fs.readFileSync('products.json', 'utf8'));
  const res = await fetch(`${PRODUCTS_URL}${PRODUCTS_URL.includes('?') ? '&' : '?'}v=${MONTH_KEY}`);
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  return await res.json();
}
function writePage(relPath, html) {
  const full = path.join(process.cwd(), relPath, 'index.html');
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html, 'utf8');
}
async function main() {
  const data = await loadProducts();
  const source = Array.isArray(data) ? data : data.products || [];
  const products = source.map(normalize).filter(p => p.name && p.image && p.score > 0).sort((a, b) => b.score - a.score).slice(0, MAX_PRODUCT_PAGES);
  const used = new Set();
  for (const p of products) {
    let slug = `${slugify(p.name)}-${slugify(p.id, 24)}`.slice(0, 115).replace(/-+$/,'');
    const base = slug;
    let i = 2;
    while (used.has(slug)) slug = `${base}-${i++}`;
    used.add(slug);
    p.slug = slug;
    p.url = `/product/${slug}/`;
  }
  const urls = [{ loc: `${SITE_URL}/`, priority: '1.0' }];
  for (const p of products) {
    writePage(`product/${p.slug}`, productPage(p, products));
    urls.push({ loc: `${SITE_URL}${p.url}`, priority: '0.8' });
  }
  const pages = [];
  pages.push(listingPage({ slug:'top-trending-products', title:'Top Trending Dropshipping Products', description:'The top trending dropshipping products ranked by monthly DropTrend score, Google Trends, Amazon demand and CJ supplier data.', intro:'A monthly-updated shortlist of product ideas with recent market signals for more stable dropshipping tests.', products:products.slice(0,60), priority:'0.9' }));
  pages.push(listingPage({ slug:'trending-this-month', title:'Trending Dropshipping Products This Month', description:'Monthly dropshipping product ideas with trend growth, demand validation, supplier signals and estimated margins.', intro:'Use this monthly market signal view to find products worth testing for Shopify, TikTok Shop and ecommerce ads.', products:products.slice(0,100), priority:'0.9' }));
  pages.push(listingPage({ slug:'high-margin-products', title:'High Margin Dropshipping Products', description:'Dropshipping products ranked by stronger estimated profit margin, monthly demand signals and supplier readiness.', intro:'A profit-focused monthly shortlist for sellers who want products with better pricing room before ad costs.', products:[...products].sort((a,b)=>b.margin-a.margin || b.score-a.score).slice(0,100), priority:'0.88' }));
  pages.push(listingPage({ slug:'viral-tiktok-products', title:'Viral TikTok Dropshipping Products', description:'TikTok-friendly dropshipping products with visual hooks, product-market demand and supplier signals.', intro:'Product ideas that may work well for short-form videos, demos, UGC creatives and social commerce testing.', products:products.filter(p => !/retainer|replacement|part|clip/i.test(p.name)).slice(0,100), priority:'0.86' }));
  pages.push(listingPage({ slug:'low-competition-products', title:'Low Competition Dropshipping Product Ideas', description:'Dropshipping product ideas selected from monthly market signals for sellers looking beyond obvious saturated products.', intro:'Use this page to discover less obvious product ideas with supplier availability and stable demand signals.', products:[...products].sort((a,b)=>(b.score-b.amazonReviews/1000)-(a.score-a.amazonReviews/1000)).slice(0,100), priority:'0.84' }));
  pages.push(listingPage({ slug:'best-dropshipping-products-2026', title:'Best Dropshipping Products 2026', description:'The best dropshipping products for 2026 ranked by monthly DropTrend score, Google Trends, Amazon demand and CJ supplier data.', intro:'A monthly product research page for sellers looking for stronger product ideas in 2026 with stable market signals, supplier availability and margin estimates.', products:products.slice(0,120), priority:'0.88' }));
  pages.push(listingPage({ slug:'best-tiktok-products-to-sell', title:'Best TikTok Products to Sell', description:'TikTok-friendly product ideas ranked by visual appeal, product demand, monthly trend signals and supplier readiness.', intro:'Use this monthly shortlist to find products that can work for TikTok, Reels, UGC demos and short-form product ads.', products:products.filter(p => !/retainer|replacement|bumper|bracket|clip|fastener|auto part/i.test((p.name||'') + ' ' + (p.category||''))).slice(0,120), priority:'0.87' }));
  pages.push(listingPage({ slug:'high-margin-dropshipping-products', title:'High Margin Dropshipping Products', description:'High-margin dropshipping product ideas sorted by estimated profit margin, monthly demand signals and supplier data.', intro:'A monthly profit-focused research page for sellers who want product ideas with better room for ad costs and testing.', products:[...products].sort((a,b)=>b.margin-a.margin || b.profit-a.profit || b.score-a.score).slice(0,120), priority:'0.88' }));
  const groups = new Map();
  for (const p of products) {
    const key = categorySlug(p.category);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  for (const [key, list] of groups) {
    const nice = key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    pages.push(listingPage({ slug:`category/${key}`, title:`Trending ${nice} for Dropshipping`, description:`Find trending ${nice.toLowerCase()} ranked by DropTrend score, Google Trends, Amazon demand and CJ supplier data.`, intro:`Browse ${nice.toLowerCase()} with product images, supplier links, trend signals and margin estimates.`, products:list.slice(0,80), priority:'0.85' }));
  }
  pages.push(blogIndexPage(products));
  pages.push(blogPage('best-dropshipping-products-2026', 'Best Dropshipping Products 2026', 'A programmatic DropTrend list of winning product ideas for 2026 using Google Trends, Amazon demand and supplier data.', products, 'Top product ideas to review'));
  pages.push(blogPage('best-tiktok-products-to-sell', 'Best TikTok Products to Sell', 'Find TikTok-friendly product ideas with visual hooks, strong margins and marketplace demand signals.', products.filter(p => !/auto|clip|retainer/i.test(p.category + ' ' + p.name)), 'TikTok-friendly product ideas'));
  pages.push(blogPage('high-margin-dropshipping-products', 'High Margin Dropshipping Products', 'Dropshipping product ideas sorted for stronger estimated profit margins and real product demand signals.', [...products].sort((a,b)=>b.margin-a.margin || b.score-a.score), 'Products with stronger estimated margins'));
  for (const pg of pages) {
    const rel = pg.url.replace(SITE_URL + '/', '').replace(/\/$/, '');
    writePage(rel, pg.html);
    urls.push({ loc: pg.url, priority: pg.priority });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${NOW}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync('sitemap.xml', xml, 'utf8');
  fs.writeFileSync('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8');
  console.log(`Generated ${products.length} product pages, ${pages.length} SEO landing/blog/category pages, and sitemap.xml with ${urls.length} URLs.`);
}
main().catch(err => { console.error(err); process.exit(1); });
