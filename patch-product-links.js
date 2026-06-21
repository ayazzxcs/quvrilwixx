const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const fixed = `function productPageUrl(p) {
  const id = String(first(p.id, p.pid, p.productId, p.sku, p.raw?.pid, p.raw?.productId, p.name, p.productName, "")).trim();
  const name = cleanProductName(first(p.name, p.productName, p.title, p.raw?.productName, id));
  const slug = (slugify(name, 80) + "-" + slugify(id, 24)).slice(0, 115).replace(/-+$/g, "");
  return "/product/" + slug + "/";
}`;

html = html.replace(/function productPageUrl\(p\) \{[\s\S]*?\n\}/, fixed);

fs.writeFileSync(file, html, 'utf8');
console.log('Patched product card links to match generated static product page slugs.');
