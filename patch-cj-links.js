const fs = require('fs');
const FILE = 'products.json';
const CJ_HOST = 'https://www.' + 'cj' + 'dropshipping' + '.com';
const ALI_HOST = 'https://www.aliexpress.us';
function get(obj, path) { return path.split('.').reduce((v, p) => v && v[p], obj); }
function pick(obj, keys) { for (const k of keys) { const v = get(obj, k); if (v !== undefined && v !== null && String(v).trim()) return String(v).trim(); } return ''; }
function slug(text) { return String(text || 'product').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/g, '') || 'product'; }
function isBad(url, host) { const u = String(url || '').trim(); return !u.startsWith('http') || u === host || u === host + '/'; }
function isAli(item) { return /aliexpress/i.test([item.supplier, item.source, item.marketplace, item.supplierUrl, item.productUrl, pick(item, ['trendProof.supplierSource.source','trendProof.supplierSource.supplier','proof.supplierSource.source'])].join(' ')); }
function fix(item) {
  const direct = pick(item, ['supplierUrl','productUrl','productLink','shopUrl','raw.productUrl','raw.productLink','raw.shopUrl','trendProof.supplierSource.productUrl','proof.supplierSource.productUrl','trendProof.cjSupplier.productUrl','proof.cjSupplier.productUrl']);
  if (direct && direct.startsWith('http') && !/^https?:\/\/www\.(cj)?dropshipping\.com\/?$/i.test(direct)) return direct;
  const name = pick(item, ['name','productName','title','raw.productName','raw.title']) || 'product';
  const id = pick(item, ['pid','productId','id','sku','raw.pid','raw.productId']);
  if (isAli(item)) {
    const cleanId = String(id || '').replace(/^aliexpress-/i, '').replace(/[^0-9]/g, '');
    if (/^\d{10,}$/.test(cleanId)) return ALI_HOST + '/item/' + cleanId + '.html';
    return ALI_HOST + '/w/wholesale-' + encodeURIComponent(name) + '.html';
  }
  if (/^\d{10,}$/.test(id)) return CJ_HOST + '/product/' + slug(name) + '-p-' + id + '.html';
  return CJ_HOST + '/search?keyword=' + encodeURIComponent(name);
}
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const list = Array.isArray(data) ? data : (data.products || []);
let changed = 0;
for (const item of list) { const old = item.supplierUrl; item.supplierUrl = fix(item); if (old !== item.supplierUrl) changed++; }
fs.writeFileSync(FILE, JSON.stringify(Array.isArray(data) ? list : Object.assign({}, data, { products: list }), null, 2));
console.log('Supplier links fixed:', changed, 'products:', list.length);
