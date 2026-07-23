const SUPABASE_URL = process.env_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CJ_PRODUCT_QUERY_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/product/query';

const CJ_STOCK_BY_VID_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/product/stock/queryByVid';

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

function totalInventoryForCountry(variant, countryCode) {
  const inventories = variant.inventories || [];
  const targetCountry = String(countryCode || '').toUpperCase();

  let total = 0;

  for (const inventory of inventories) {
    if (!targetCountry || String(inventory.countryCode || '').toUpperCase() === targetCountry) {
      total += Number(
        inventory.totalInventory ||
          inventory.totalInventoryNum ||
          inventory.cjInventory ||
          inventory.factoryInventory ||
          0
      );
    }
  }

  return total;
}

function pickBestVariant(variants, countryCode) {
  if (!Array.isArray(variants) || !variants.length) return null;

  const sorted = variants
    .filter((variant) => variant.vid)
    .map((variant) => ({
      ...variant,
      _qvStock: totalInventoryForCountry(variant, countryCode)
    }))
    .sort((a, b) => {
      const stockDiff = Number(b._qvStock || 0) - Number(a._qvStock || 0);

      if (stockDiff !== 0) return stockDiff;

      return Number(a.variantSellPrice || 999999) - Number(b.variantSellPrice || 999999);
    });

  return sorted[0] || null;
}

function normalizeVariant(variant, countryCode) {
  if (!variant) return null;

  return {
    vid: String(variant.vid || ''),
    pid: String(variant.pid || ''),
    variantName: variant.variantNameEn || variant.variantName || '',
    variantSku: variant.variantSku || '',
    variantKey: variant.variantKey || '',
    imageUrl: variant.variantImage || '',
    price: variant.variantSellPrice ? String(variant.variantSellPrice) : '',
    currency: 'USD',
    weight: variant.variantWeight || '',
    length: variant.variantLength || '',
    width: variant.variantWidth || '',
    height: variant.variantHeight || '',
    stock: Number(variant._qvStock || totalInventoryForCountry(variant, countryCode) || 0),
    raw: variant
  };
}

async function fetchStockByVid(accessToken, vid) {
  const url = new URL(CJ_STOCK_BY_VID_URL);
  url.searchParams.set('vid', String(vid));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'CJ-Access-Token': accessToken
    }
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }

  if (!response.ok || json.success === false || json.result === false) {
    return null;
  }

  return json;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
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

    const {
      productId,
      pid,
      productSku,
      variantSku,
      countryCode = 'US'
    } = req.body || {};

    const lookupPid = productId || pid;

    if (!lookupPid && !productSku && !variantSku) {
      return res.status(400).json({
        ok: false,
        error: 'Missing productId, pid, productSku, or variantSku'
      });
    }

    const connection = await getLatestCJConnection();

    const url = new URL(CJ_PRODUCT_QUERY_URL);

    if (lookupPid) {
      url.searchParams.set('pid', String(lookupPid));
    } else if (productSku) {
      url.searchParams.set('productSku', String(productSku));
    } else if (variantSku) {
      url.searchParams.set('variantSku', String(variantSku));
    }

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
      throw new Error('CJ product details response was not JSON: ' + (text || '[EMPTY RESPONSE]'));
    }

    if (!response.ok || json.success === false || json.result === false) {
      return res.status(400).json({
        ok: false,
        error: json
      });
    }

    const product = json.data || {};
    const variants = product.variants || [];
    const bestVariant = pickBestVariant(variants, countryCode);

    if (!bestVariant) {
      return res.status(400).json({
        ok: false,
        error: 'No CJ variant found for this product',
        raw: json
      });
    }

    const stockResponse = await fetchStockByVid(connection.access_token, bestVariant.vid);

    const selectedVariant = normalizeVariant(bestVariant, countryCode);

    return res.status(200).json({
      ok: true,
      product: {
        pid: String(product.pid || lookupPid || ''),
        productName: product.productNameEn || product.productName || '',
        productSku: product.productSku || '',
        imageUrl: product.bigImage || product.productImageSet?.[0] || '',
        sellPrice: product.sellPrice ? String(product.sellPrice) : '',
        categoryName: product.categoryName || '',
        productWeight: product.productWeight || '',
        packingWeight: product.packingWeight || '',
        productProEnSet: product.productProEnSet || [],
        raw: product
      },
      selectedVariant,
      variants: variants.map((variant) => normalizeVariant(variant, countryCode)),
      stockResponse,
      raw: json
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
