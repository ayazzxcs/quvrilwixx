# DropTrend Cloudflare Pages SEO Setup

## Files included
- `index.html` — latest fixed frontend with SEO meta tags and fixed Google/Amazon display
- `robots.txt` — replace `YOUR-DOMAIN.com` with your real domain
- `_headers` — Cloudflare Pages headers
- `_redirects` — simple SEO landing redirects
- `scripts/generate-seo-pages.js` — creates `/product/<slug>/index.html` pages and `sitemap.xml` from your backend products feed

## Cloudflare Pages build command
Set your build command to:

```bash
SITE_URL=https://YOUR-DOMAIN.com node scripts/generate-seo-pages.js
```

Then deploy. Replace `YOUR-DOMAIN.com` with your actual domain or pages.dev URL.

## After deploy
1. Open `/sitemap.xml` and confirm product URLs exist.
2. Add site to Google Search Console.
3. Submit `https://YOUR-DOMAIN.com/sitemap.xml`.
4. Request indexing for homepage.

## Important
Product pages are generated from:
`https://raw.githubusercontent.com/ayazzxcs/Droptrendv2-backend/main/products.json`
