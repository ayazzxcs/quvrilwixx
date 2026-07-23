const crypto = require('crypto');

const ALIEXPRESS_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const API_BASE = 'https://api-sg.aliexpress.com/sync';
const METHOD = 'aliexpress.ds.text.search';

function timestamp() {
  return Date.now().toString();
}

function signRequest(params, secret) {
  const sorted = Object.keys(params)
    .sort()
    .filter((key) => key !== 'sign')
    .map((key) => key + params[key])
    .join('');

  return crypto
    .createHmac('sha256', secret.trim())
    .update(sorted)
    .digest('hex')
    .toUpperCase();
}

async function getLatestAliExpressToken() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/aliexpress_connections?select=*&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const text = await response.text();

  let rows;
  try {
    rows = JSON.parse(text);
  } catch {
    throw new Error('Supabase did not return JSON: ' + text);
  }

  if (!response.ok) {
    throw new Error('Supabase token lookup failed: ' + JSON.stringify(rows));
  }

  if (!rows.length || !rows[0].access_token) {
    throw new Error('No AliExpress access token found in Supabase');
  }

  return rows[0].access_token;
}

function normalizeProducts(json, currency) {
  const data =
    json.aliexpress_ds_text_search_response?.data ||
    json.result ||
    json.data ||
    {};

  const products =
    data.products?.selection_search_product ||
    data.products ||
    [];

  if (!Array.isArray(products)) return [];

  return products.slice(0, 6).map((p) => {
    const itemUrl = p.itemUrl || p.item_url || '';

    return {
      itemId: String(p.itemId || p.item_id || ''),
      skuId: String(p.skuId || p.sku_id || ''),
      title: p.title || '',
      imageUrl: p.itemMainPic || p.imageUrl || p.image || '',
      productUrl: itemUrl
        ? String(itemUrl).startsWith('http')
          ? itemUrl
          : 'https:' + itemUrl
        : '',
      price: p.targetSalePrice || p.salePrice || p.salePriceFormat || '',
      currency: p.targetOriginalPriceCurrency || p.salePriceCurrency || currency,
      orders: p.orders || '',
      rating: p.score || '',
      raw: p
    };
  });
}

module.exports = async function handler(req, res) {
  try {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    if (!ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Missing required environment variables'
      });
    }

    const { keyword, shipToCountry = 'US', currency = 'USD' } = req.body || {};

    if (!keyword) {
      return res.status(400).json({
        ok: false,
        error: 'Missing keyword'
      });
    }

    const accessToken = await getLatestAliExpressToken();

    const params = {
      app_key: ALIEXPRESS_APP_KEY.trim(),
      method: METHOD,
      sign_method: 'sha256',
      timestamp: timestamp(),
      format: 'json',
      v: '2.0',
      session: accessToken,
      keywords: String(keyword).slice(0, 120),
      ship_to_country: shipToCountry,
      target_currency: currency,
      page_size: '6',
      page_index: '1'
    };

    params.sign = signRequest(params, ALIEXPRESS_APP_SECRET);

    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        Accept: 'application/json'
      },
      body: new URLSearchParams(params)
    });

    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: 'AliExpress did not return JSON',
        status: response.status,
        raw: text || '[EMPTY RESPONSE]'
      });
    }

    if (!response.ok || json.error_response) {
      return res.status(400).json({
        ok: false,
        error: json
      });
    }

    return res.status(200).json({
      ok: true,
      options: normalizeProducts(json, currency),
      raw: json
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
