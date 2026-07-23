const crypto = require('crypto');

const ALIEXPRESS_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const API_BASE = 'https://api-sg.aliexpress.com/sync';
const METHOD = 'aliexpress.ds.product.get';

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

  const rows = await response.json();

  if (!response.ok || !rows.length || !rows[0].access_token) {
    throw new Error('No AliExpress access token found in Supabase');
  }

  return rows[0].access_token;
}

function getSkuList(json) {
  return (
    json.aliexpress_ds_product_get_response?.result?.ae_item_sku_info_dtos
      ?.ae_item_sku_info_d_t_o || []
  );
}

function pickBestSku(skus) {
  const valid = skus
    .filter((sku) => sku.sku_attr && Number(sku.sku_available_stock || 0) > 0)
    .sort((a, b) => {
      const stockDiff =
        Number(b.sku_available_stock || 0) - Number(a.sku_available_stock || 0);

      if (stockDiff !== 0) return stockDiff;

      return Number(a.offer_sale_price || a.sku_price || 999999) -
        Number(b.offer_sale_price || b.sku_price || 999999);
    });

  return valid[0] || null;
}

function skuLabel(sku) {
  const props =
    sku.ae_sku_property_dtos?.ae_sku_property_d_t_o ||
    [];

  return props
    .map((p) => {
      const name = p.sku_property_name || '';
      const value =
        p.property_value_definition_name ||
        p.sku_property_value ||
        '';

      return `${name}: ${value}`.trim();
    })
    .filter(Boolean)
    .join(', ');
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    if (!ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ ok: false, error: 'Missing environment variables' });
    }

    const {
      productId,
      shipToCountry = 'US',
      currency = 'USD',
      language = 'en'
    } = req.body || {};

    if (!productId) {
      return res.status(400).json({ ok: false, error: 'Missing productId' });
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
      product_id: String(productId),
      ship_to_country: shipToCountry,
      target_currency: currency,
      target_language: language,
      remove_personal_benefit: 'false'
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
      throw new Error('AliExpress product details response was not JSON: ' + (text || '[EMPTY RESPONSE]'));
    }

    if (!response.ok || json.error_response) {
      return res.status(400).json({ ok: false, error: json });
    }

    const skus = getSkuList(json);
    const bestSku = pickBestSku(skus);

    if (!bestSku) {
      return res.status(400).json({
        ok: false,
        error: 'No in-stock SKU found for this AliExpress product',
        raw: json
      });
    }

    return res.status(200).json({
      ok: true,
      selectedSku: {
        skuAttr: String(bestSku.sku_attr || ''),
        skuId: String(bestSku.sku_id || ''),
        price: String(bestSku.offer_sale_price || bestSku.sku_price || ''),
        currency: String(bestSku.currency_code || currency),
        stock: Number(bestSku.sku_available_stock || 0),
        label: skuLabel(bestSku),
        imageUrl:
          bestSku.ae_sku_property_dtos?.ae_sku_property_d_t_o?.[0]?.sku_image || ''
      },
      skus: skus.map((sku) => ({
        skuAttr: String(sku.sku_attr || ''),
        skuId: String(sku.sku_id || ''),
        price: String(sku.offer_sale_price || sku.sku_price || ''),
        currency: String(sku.currency_code || currency),
        stock: Number(sku.sku_available_stock || 0),
        label: skuLabel(sku),
        imageUrl:
          sku.ae_sku_property_dtos?.ae_sku_property_d_t_o?.[0]?.sku_image || ''
      })),
      raw: json
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
