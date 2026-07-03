const fs = require('fs');
const path = require('path');

const SITE_URL = (process.env.SITE_URL || 'https://quvirl.com').replace(/\/$/, '');
const PRODUCTS_URL = process.env.PRODUCTS_URL || 'https://raw.githubusercontent.com/ayazzxcs/Droptrendv2-backend/main/products.json';
const MAX_PRODUCT_PAGES = Number(process.env.MAX_PRODUCT_PAGES || 1000);
const FAVICON_HEAD = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0C447C">
<meta property="og:image" content="${SITE_URL}/logo.png">
<meta name="twitter:image" content="${SITE_URL}/logo.png">`;
const ORGANIZATION_SCHEMA = {'@context':'https://schema.org','@type':'Organization','name':'Quvirl','url':SITE_URL,'logo':`${SITE_URL}/logo.png`};

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

function proof(p) {
  return p?.trendProof || p?.proof || {};
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product';
}

function normalize(raw) {
  const name = cleanProductName(first(raw.name, raw.productName, raw.title, raw.raw?.productName, 'Untitled product'));
  const category = first(raw.category, raw.categoryName, raw.raw?.categoryName, 'General');
  const image = first(raw.image, raw.productImage, raw.raw?.productImage, '');
  const supplierUrl = first(raw.supplierUrl, raw.productUrl, raw.raw?.productUrl, 'https://www.cjdropshipping.com/');
  const cost = num(first(raw.cost, raw.supplierPrice, raw.raw?.sellPrice, proof(raw).cjSupplier?.price));
  const sell = num(first(raw.sell, raw.suggestedPrice, raw.salePrice)) || Math.max(9.99, cost * 2.2);
  const profit = num(first(raw.profit, sell - cost - num(raw.shipping)));
  const margin = sell ? Math.round((profit / sell) * 100) : 0;
  const google = proof(raw).googleTrends || {};
  const amazon = proof(raw).amazon || {};
  const cj = proof(raw).cjSupplier || {};
  return {
    ...raw,
    name,
    category,
    image,
    supplierUrl,
    cost,
    sell,
    profit,
    margin,
    score: num(first(raw.dropTrendScore, raw.trend, raw.winningScore)),
    googleGrowth: num(first(google.growthPercent, raw.googleGrowth)),
    amazonScore: num(first(amazon.score, raw.amazonScore, raw.amazonDemandScore)),
    amazonRating: first(amazon.bestRating, raw.bestRating, ''),
    amazonReviews: num(first(amazon.bestRatingsTotal, raw.bestRatingsTotal, 0)),
    cjScore: num(first(cj.score, raw.cjScore, raw.cjSupplierScore)),
    confidence: first(proof(raw).confidence, raw.confidence, 'Low')
  };
}

function formatGrowth(n) {
  n = Math.round(num(n));
  if (!n) return 'No Google growth signal matched';
  return n > 0 ? `Google searches up ${n}%` : `Google searches down ${Math.abs(n)}%`;
}

function pageTemplate(p, url) {
  const title = `${p.name} - Trending Dropshipping Product | Quvirl`;
  const desc = `${p.name} trend research: Quvirl score ${p.score}/100, ${formatGrowth(p.googleGrowth)}, Amazon demand ${p.amazonScore || 0}/100, CJ supplier score ${p.cjScore || 0}/100.`;
  const imgTag = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : '';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: p.image ? [p.image] : undefined,
    category: p.category,
    description: desc,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: p.sell || p.cost || 0,
      availability: 'https://schema.org/InStock',
      url
    }
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${FAVICON_HEAD}
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="product">
${p.image ? `<meta property="og:image" content="${esc(p.image)}">` : ''}
<style>
body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:#0b1020;color:#edf2ff;line-height:1.6}.wrap{max-width:980px;margin:auto;padding:24px}.card{background:#101832;border:1px solid #26345e;border-radius:22px;padding:22px}a{color:#6ee7b7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.hero img{width:100%;border-radius:18px;background:#111}.pill{display:inline-block;background:#1a254a;color:#cbd5ff;padding:7px 10px;border-radius:999px;margin:4px}.metric{background:#0a1128;border:1px solid #26345e;border-radius:14px;padding:12px;margin:8px 0}.metric b{color:#6ee7b7}@media(max-width:700px){.grid{grid-template-columns:1fr}}
</style>
<script type="application/ld+json">${JSON.stringify(ORGANIZATION_SCHEMA).replace(/</g, '\\u003c')}</script>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<div class="wrap">
<p><a href="/">← Back to Quvirl</a></p>
<div class="card hero">
  <div class="grid">
    <div>${imgTag}</div>
    <div>
      <h1>${esc(p.name)}</h1>
      <p><span class="pill">${esc(p.category)}</span><span class="pill">Confidence: ${esc(p.confidence)}</span></p>
      <div class="metric">Quvirl Score: <b>${p.score}/100</b></div>
      <div class="metric">Google Trends: <b>${esc(formatGrowth(p.googleGrowth))}</b></div>
      <div class="metric">Amazon Demand: <b>${p.amazonScore || 0}/100</b>${p.amazonReviews ? ` • ${p.amazonReviews.toLocaleString()} reviews` : ''}${p.amazonRating ? ` • ${esc(p.amazonRating)}★` : ''}</div>
      <div class="metric">CJ Supplier Score: <b>${p.cjScore || 0}/100</b></div>
      <div class="metric">Estimated Profit: <b>$${Number(p.profit || 0).toFixed(2)}</b> • Margin: <b>${p.margin}%</b></div>
      <p><a href="${esc(p.supplierUrl)}" target="_blank" rel="noopener">Open CJ supplier</a></p>
    </div>
  </div>
</div>
<section class="card" style="margin-top:22px">
<h2>Why this product appears on Quvirl</h2>
<p>${esc(p.name)} is included because it matched Quvirl's product research system combining Google Trends signals, Amazon demand validation and CJdropshipping supplier data.</p>
<p>This page is for dropshipping product research and does not mean the exact CJ SKU is officially sold by Amazon or endorsed by Google, Amazon or CJdropshipping.</p>
</section>
</div>
</body>
</html>`;
}


function money(n) {
  return `$${Number(num(n) || 0).toFixed(2)}`;
}

function productUrlFromSlug(slug) {
  return `${SITE_URL}/product/${slug}/`;
}

function teaserCard(p) {
  return `<article class="item">
    ${p.image ? `<a href="${esc(p.url)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></a>` : ''}
    <div>
      <h3><a href="${esc(p.url)}">${esc(p.name)}</a></h3>
      <p class="muted">${esc(p.category)} • Quvirl Score ${Math.round(num(p.score))}/100</p>
      <p>Margin ${Math.round(num(p.margin))}% • Profit ${money(p.profit)} • Amazon demand ${Math.round(num(p.amazonScore))}/100</p>
    </div>
  </article>`;
}

function landingTemplate(page, products) {
  const title = `${page.title} | Quvirl`;
  const desc = page.description;
  const url = `${SITE_URL}/${page.slug}/`;
  const faq = [
    { q: `What is ${page.title}?`, a: `${page.title} is a Quvirl research page built from monthly dropshipping market signals, supplier data, Google Trends indicators and Amazon demand signals.` },
    { q: 'Is this updated live every day?', a: 'No. Quvirl focuses on monthly trend intelligence because dropshippers usually need stable demand, not short-lived daily spikes.' },
    { q: 'How should dropshippers use this page?', a: 'Use it to shortlist products, compare demand signals, check supplier pricing and decide which products deserve deeper ad testing.' }
  ];
  const ld = [
    ORGANIZATION_SCHEMA,
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: page.title, description: desc, url },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${FAVICON_HEAD}
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<style>
body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:#0b1020;color:#edf2ff;line-height:1.6}.wrap{max-width:1120px;margin:auto;padding:24px}a{color:#6ee7b7}.hero,.card{background:#101832;border:1px solid #26345e;border-radius:22px;padding:24px;margin:18px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.item{display:grid;grid-template-columns:120px 1fr;gap:14px;background:#0a1128;border:1px solid #26345e;border-radius:16px;padding:12px}.item img{width:120px;height:120px;object-fit:cover;border-radius:12px}.muted{color:#aab7df}.pill{display:inline-block;background:#1a254a;color:#cbd5ff;padding:7px 10px;border-radius:999px;margin:4px}@media(max-width:760px){.grid{grid-template-columns:1fr}.item{grid-template-columns:90px 1fr}.item img{width:90px;height:90px}}
</style>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<div class="wrap">
<p><a href="/">← Back to Quvirl</a></p>
<section class="hero">
  <p><span class="pill">Monthly market signals</span><span class="pill">Google Trends + Amazon Demand + Supplier Data</span></p>
  <h1>${esc(page.title)}</h1>
  <p>${esc(page.intro)}</p>
</section>
<section class="card">
<h2>Featured products</h2>
<div class="grid">
${products.map(teaserCard).join('\n')}
</div>
</section>
<section class="card">
<h2>How Quvirl selected these products</h2>
<p>Quvirl ranks products using a combination of supplier availability, estimated profit margin, Google Trends movement, Amazon demand validation and product research confidence. This page is designed for dropshippers who want monthly product research ideas instead of unstable daily hype.</p>
<p>Use these products as a shortlist. Before launching ads, check the supplier page, shipping time, creatives, target audience and current competitor ads.</p>
</section>
<section class="card">
<h2>FAQ</h2>
${faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n')}
</section>
</div>
</body>
</html>`;
}

function writeLandingPage(page, products, sitemap) {
  const dir = path.join(page.slug);
  fs.mkdirSync(dir, { recursive: true });
  const selected = page.pick(products).slice(0, page.limit || 30);
  fs.writeFileSync(path.join(dir, 'index.html'), landingTemplate(page, selected), 'utf8');
  sitemap.push(`  <url><loc>${SITE_URL}/${page.slug}/</loc><priority>${page.priority || '0.8'}</priority></url>`);
}

function makeBlogPost(page, products, sitemap) {
  const dir = path.join('blog', page.slug);
  fs.mkdirSync(dir, { recursive: true });
  const selected = page.pick(products).slice(0, page.limit || 20);
  const url = `${SITE_URL}/blog/${page.slug}/`;
  const html = landingTemplate({ ...page, slug: `blog/${page.slug}` }, selected);
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  sitemap.push(`  <url><loc>${url}</loc><priority>0.75</priority></url>`);
}

async function loadProducts() {
  if (fs.existsSync('products.json')) {
    return JSON.parse(fs.readFileSync('products.json', 'utf8'));
  }
  const res = await fetch(PRODUCTS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  return await res.json();
}

async function main() {
  const data = await loadProducts();
  const products = (Array.isArray(data) ? data : data.products || [])
    .map(normalize)
    .filter(p => p.name && p.image && p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PRODUCT_PAGES);

  const sitemap = [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, `  <url><loc>${SITE_URL}/</loc><priority>1.0</priority></url>`];
  const used = new Set();

  for (const p of products) {
    let slug = slugify(p.name);
    let baseSlug = slug;
    let i = 2;
    while (used.has(slug)) slug = `${baseSlug}-${i++}`;
    used.add(slug);
    p.slug = slug;
    p.url = productUrlFromSlug(slug);
    const dir = path.join('product', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageTemplate(p, p.url), 'utf8');
    sitemap.push(`  <url><loc>${p.url}</loc><priority>0.7</priority></url>`);
  }

  const byMargin = [...products].sort((a, b) => (b.margin - a.margin) || (b.score - a.score));
  const byViral = [...products].sort((a, b) => (b.googleGrowth - a.googleGrowth) || (b.amazonScore - a.amazonScore) || (b.score - a.score));
  const byLowCompetition = [...products].sort((a, b) => (b.score - a.score) || (b.margin - a.margin)).filter(p => p.amazonReviews < 5000 || p.amazonReviews === 0);
  const byTikTok = products.filter(p => /led|beauty|pet|kitchen|car|phone|mini|portable|makeup|hair|light|toy|fitness|home/i.test(`${p.name} ${p.category}`));

  const landingPages = [
    {
      slug: 'top-trending-products',
      title: 'Top Trending Dropshipping Products',
      description: 'Monthly Quvirl list of top dropshipping products based on Google Trends, Amazon demand and supplier signals.',
      intro: 'Explore the strongest monthly product opportunities ranked by Quvirl score, supplier data, Google Trends movement and Amazon demand validation.',
      pick: list => list,
      priority: '0.9'
    },
    {
      slug: 'trending-this-month',
      title: 'Trending Dropshipping Products This Month',
      description: 'Monthly dropshipping trend research page for products with recent market demand signals.',
      intro: 'This monthly list avoids short daily hype and focuses on products showing stronger recent market signals for dropshipping research.',
      pick: list => list,
      priority: '0.9'
    },
    {
      slug: 'high-margin-products',
      title: 'High Margin Dropshipping Products',
      description: 'High margin dropshipping product ideas selected from Quvirl monthly product research data.',
      intro: 'Find products with stronger estimated margin potential, useful for testing ad campaigns where profit room matters.',
      pick: () => byMargin,
      priority: '0.85'
    },
    {
      slug: 'viral-tiktok-products',
      title: 'Viral TikTok Products for Dropshipping',
      description: 'TikTok-friendly dropshipping product ideas based on monthly product trend and demand signals.',
      intro: 'Discover visual, demonstration-friendly products that may work well for TikTok-style creatives and short-form video ads.',
      pick: () => byTikTok.length ? byTikTok.sort((a, b) => b.score - a.score) : byViral,
      priority: '0.85'
    },
    {
      slug: 'low-competition-products',
      title: 'Low Competition Dropshipping Products',
      description: 'Dropshipping product ideas with useful trend signals and potentially lower visible Amazon review competition.',
      intro: 'Use this shortlist to research products that may be less saturated while still showing useful market signals.',
      pick: () => byLowCompetition.length ? byLowCompetition : products,
      priority: '0.85'
    },
    {
      slug: 'best-dropshipping-products-2026',
      title: 'Best Dropshipping Products 2026',
      description: 'Best dropshipping products for 2026 based on monthly Quvirl product research signals.',
      intro: 'A research list for dropshippers preparing product tests in 2026 using monthly market intelligence rather than temporary spikes.',
      pick: list => list,
      priority: '0.85'
    },
    {
      slug: 'best-tiktok-products-to-sell',
      title: 'Best TikTok Products to Sell',
      description: 'Best TikTok product ideas to sell using dropshipping, selected from Quvirl monthly trend signals.',
      intro: 'These product ideas are selected for TikTok-style selling angles, visual hooks and monthly demand signals.',
      pick: () => byTikTok.length ? byTikTok.sort((a, b) => b.googleGrowth - a.googleGrowth || b.score - a.score) : byViral,
      priority: '0.85'
    },
    {
      slug: 'high-margin-dropshipping-products',
      title: 'High Margin Dropshipping Products to Sell',
      description: 'High margin dropshipping products to sell based on estimated profit, supplier data and Quvirl score.',
      intro: 'This page focuses on products with better estimated profit room for dropshipping stores and paid ads.',
      pick: () => byMargin,
      priority: '0.85'
    }
  ];

  for (const page of landingPages) writeLandingPage(page, products, sitemap);

  const blogPages = [
    {
      slug: 'best-dropshipping-products-2026',
      title: 'Best Dropshipping Products 2026',
      description: 'A monthly research-backed guide to the best dropshipping products for 2026.',
      intro: 'This guide summarizes strong product opportunities from Quvirl monthly market signals for dropshippers planning 2026 product tests.',
      pick: list => list,
      limit: 24
    },
    {
      slug: 'viral-tiktok-products',
      title: 'Viral TikTok Products for Dropshipping',
      description: 'TikTok product ideas for dropshipping selected from monthly trend signals.',
      intro: 'Use these products to brainstorm short-form ad creatives, hooks and product demonstration angles.',
      pick: () => byTikTok.length ? byTikTok : byViral,
      limit: 24
    },
    {
      slug: 'high-margin-products',
      title: 'High Margin Products for Dropshipping',
      description: 'High margin product ideas for dropshipping stores using Quvirl research data.',
      intro: 'These products may give more room for ad costs, bundles and testing because of stronger estimated margin potential.',
      pick: () => byMargin,
      limit: 24
    }
  ];
  for (const page of blogPages) makeBlogPost(page, products, sitemap);

  fs.writeFileSync('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8');
  sitemap.push(`</urlset>`);
  fs.writeFileSync('sitemap.xml', sitemap.join('\n'), 'utf8');
  console.log(`Generated ${products.length} product pages, ${landingPages.length} landing pages, ${blogPages.length} blog pages, robots.txt and sitemap.xml`);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
