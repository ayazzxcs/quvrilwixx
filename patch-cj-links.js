const fs = require('fs');
const FILE = 'products.json';
const HOST = 'https://www.' + 'cj' + 'dropshipping' + '.com';
function get(obj, path) { return path.split('.').reduce((v, p) => v && v[p], obj); }
function pick(obj, keys) { for (const k of keys) { const v = get(obj, k); if (v !== undefined && v !== null && String(v).trim()) return String(v).trim(); } return ''; }
function slug(text) { return String(text || 'product').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/g, '') || 'product'; }
function bad(url) { const u = String(url || '').trim(); return !u.startsWith('http') || u === HOST || u === HOST + '/'; }
function fix(item) { const direct = pick(item, ['supplierUrl','productUrl','productLink','shopUrl','raw.productUrl','raw.productLink','raw.shopUrl']); if (direct && !bad(direct)) return direct; const name = pick(item, ['name','productName','title','raw.productName']) || 'product'; const id = pick(item, ['pid','productId','id','sku','raw.pid','raw.productId']); if (/^\d{10,}$/.test(id)) return HOST + '/product/' + slug(name) + '-p-' + id + '.html'; return HOST + '/search?keyword=' + encodeURIComponent(name); }
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const list = Array.isArray(data) ? data : (data.products || []);
let changed = 0;
for (const item of list) { const old = item.supplierUrl; item.supplierUrl = fix(item); if (old !== item.supplierUrl) changed++; }
fs.writeFileSync(FILE, JSON.stringify(Array.isArray(data) ? list : Object.assign({}, data, { products: list }), null, 2));
console.log('Supplier links fixed:', changed, 'products:', list.length);
