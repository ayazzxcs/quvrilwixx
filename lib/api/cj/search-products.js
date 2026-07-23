const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CJ_PRODUCT_LIST_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/product/listV2';

async function getLatestCJConnection() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cj_connections?select=*&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const rows = await response.json();

  if (!response.ok || !Array.isArray(rows) || !rows.length || !rows[0].access_token) {
    throw new Error('No CJ access token found in Supabase');
  }

  return rows[0];
}

function normalizeCJProducts(json) {
  const content = json.data?.content || [];
  const products = [];

  for (const group of content) {
    const productList = group.productList || [];

    for (const product of productList) {
      products.push({
        platform: 'cjdropshipping',
        productId: product.id || product.pid || '',
        pid: product.id || product.pid || '',
        title: product.nameEn || product.productNameEn || '',
        sku: product.sku || product.spu || product.productSku || '',
        imageUrl: product.bigImage || product.productImage || '',
        price: product.nowPrice || product.sellPrice || product.discountPrice || '',
        currency: 'USD',
        categoryId: product.categoryId || '',
        categoryName:
          product.threeCategoryName ||
          product.categoryName ||
          product.oneCategoryName ||
          '',
        listedNum: product.listedNum || '',
        inventory:
          product.warehouseInventoryNum ||
          product.totalVerifiedInventory ||
          '',
        deliveryCycle: product.deliveryCycle || '',
        raw: product
      });
    }
  }

  return products.slice(0, 8);
}

function getRequestValue(req, key, fallback = '') {
  const body = req.body || {};
  const query = req.query || {};

  return (
    body[key] ||
    query[key] ||
    query[key.toLowerCase()] ||
    query[key.toUpperCase()] ||
    fallback
  );
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed'
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Missing Supabase environment variables'
      });
    }

    const keyword =
      getRequestValue(req, 'keyword') ||
      getRequestValue(req, 'keyWord') ||
      getRequestValue(req, 'q');

    const countryCode = getRequestValue(req, 'countryCode', 'US');
    const page = getRequestValue(req, 'page', 1);
    const size = getRequestValue(req, 'size', 8);

    if (!keyword) {
      return res.status(400).json({
        ok: false,
        error: 'Missing keyword',
        receivedBody: req.body || null,
        receivedQuery: req.query || null
      });
    }

    const connection = await getLatestCJConnection();

    const url = new URL(CJ_PRODUCT_LIST_URL);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(size));
    url.searchParams.set('keyWord', String(keyword).slice(0, 120));
    url.searchParams.set('countryCode', String(countryCode).toUpperCase());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'CJ-Access-Token': connection.access_token
      }
    });

    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('CJ product search response was not JSON: ' + (text || '[EMPTY RESPONSE]'));
    }

    if (!response.ok || json.success === false || json.result === false) {
      return res.status(400).json({
        ok: false,
        error: json
      });
    }

    return res.status(200).json({
      ok: true,
      options: normalizeCJProducts(json),
      raw: json
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
