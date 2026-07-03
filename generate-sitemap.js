import { readFileSync, writeFileSync } from "fs";

const SITE = (process.env.SITE_URL || "https://quvirl.com").replace(/\/$/, "");
const products = JSON.parse(readFileSync("products.json", "utf8"));

function first(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return "";
}
function cleanProductName(value) {
  return String(Array.isArray(value) ? value.filter(Boolean).join(" ") : (value ?? "")).replace(/\s+/g, " ").trim() || "Untitled product";
}
function slugify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "product";
}
function nameOf(raw) {
  return cleanProductName(first(raw.name, raw.productName, raw.title, raw.raw?.productName, "Untitled product"));
}
function idOf(raw) {
  return String(first(raw.id, raw.pid, raw.productId, raw.sku, raw.raw?.pid, raw.raw?.productId, raw.name, raw.productName, nameOf(raw))).trim();
}
function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

const urls = [
  `${SITE}/`,
  ...products.slice(0, 5000).map(p => `${SITE}/product.html?id=${encodeURIComponent(idOf(p))}&slug=${encodeURIComponent(slugify(nameOf(p)))}`)
];

const unique = [...new Set(urls)];
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique.map((url, i) => `  <url>
    <loc>${xmlEscape(url)}</loc>
    <priority>${i === 0 ? "1.0" : "0.8"}</priority>
  </url>`).join("\n")}
</urlset>
`;

writeFileSync("sitemap.xml", xml);
console.log(`Generated sitemap.xml with ${unique.length} URLs`);
