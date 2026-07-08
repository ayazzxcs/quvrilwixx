const fs = require('fs');
const path = require('path');

const SCRIPT = '<script src="/slot-access.js" defer></script>';
const BODY_MARKER = '</body>';

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function shouldPatch(file) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  if (rel.startsWith('blog/')) return false;
  if (['about.html', 'contact.html', 'privacy.html', 'terms.html'].includes(rel)) return false;
  return rel === 'index.html' || rel === 'product.html' || rel.startsWith('product/') || rel.startsWith('category/') || [
    'top-trending-products/index.html',
    'trending-this-month/index.html',
    'best-dropshipping-products-2026/index.html',
    'best-tiktok-products-to-sell/index.html',
    'high-margin-dropshipping-products/index.html',
    'high-margin-products/index.html',
    'viral-tiktok-products/index.html',
    'low-competition-products/index.html'
  ].includes(rel);
}

function patchFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html.replace(/<script\s+src=["']\/slot-access\.js["']\s+defer><\/script>\s*/g, '');
  if (html.includes(BODY_MARKER)) html = html.replace(BODY_MARKER, `${SCRIPT}\n${BODY_MARKER}`);
  else html += `\n${SCRIPT}\n`;
  if (html !== before) fs.writeFileSync(file, html, 'utf8');
}

let count = 0;
for (const file of walk(process.cwd())) {
  if (!shouldPatch(file)) continue;
  patchFile(file);
  count++;
}
console.log(`Quvirl slot access script injected into ${count} research HTML files.`);
