const crypto = require('crypto');

const ALIEXPRESS_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QUVIRL_INTERNAL_API_KEY = process.env.QUVIRL_INTERNAL_API_KEY;

const API_BASE = 'https://api-sg.aliexpress.com/sync';
const METHOD = 'aliexpress.ds.order.create';

const DEFAULT_LOGISTICS_SERVICE = process.env.ALIEXPRESS_DEFAULT_LOGISTICS_SERVICE || 'EPAM';
const DEFAULT_PAY_CURRENCY = process.env.ALIEXPRESS_PAY_CURRENCY || 'USD';

function timestamp() {
  return Date.now().toString();
}

function signTopRequest(params, secret) {
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

function phoneCountry(countryCode) {
  const map = {
    US: '+1',
    CA: '+1',
    GB: '+44',
    AU: '+61',
    IN: '+91',
    JP: '+81',
    DE: '+49',
    FR: '+33',
    NL: '+31',
    BR: '+55',
    RU: '+7'
  };

  return map[String(countryCode || '').toUpperCase()] || '';
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function getLatestAliExpressConnection() {
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

  return rows[0];
}

async function getFulfillmentRecord(id) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/aliexpress_auto_fulfillments?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const rows = await response.json();

  if (!response.ok || !rows.length) {
    throw new Error('Fulfillment record not found');
  }

  return rows[0];
}

async function updateFulfillmentRecord(id, patch) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/aliexpress_auto_fulfillments?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        ...patch,
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error('Failed to update fulfillment record: ' + text);
  }
}

function buildAliExpressOrderPayload(record) {
  const address = record.shipping_address || {};
  const lineItem = record.line_item || {};

  const quantity = Number(lineItem.quantity || 1);
  const productCount = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

  const fullName =
    clean(address.name) ||
    clean(`${address.first_name || ''} ${address.last_name || ''}`) ||
    clean(record.customer_name) ||
    'Customer';

  const countryCode = clean(address.country_code || record.customer_country || '').toUpperCase();

  const mobileNo =
    clean(address.phone) ||
    clean(address.mobile_no) ||
    clean(lineItem.phone) ||
    '0000000000';

  const supplierSku =
    clean(record.supplier_sku_attr) ||
    clean(record.supplier_sku_id) ||
    clean(lineItem.sku);

  const logisticsService =
    clean(record.logistics_service_name) ||
    DEFAULT_LOGISTICS_SERVICE;

  if (!record.supplier_item_id) {
    throw new Error('Missing supplier_item_id');
  }

  if (!supplierSku) {
    throw new Error('Missing supplier SKU or sku_attr');
  }

  if (!countryCode || !address.address1 || !address.city || !address.zip) {
    throw new Error('Incomplete shipping address');
  }

  return {
    ds_extend_request: {
      payment: {
        try_to_pay: 'false',
        pay_currency: DEFAULT_PAY_CURRENCY
      }
    },
    param_place_order_request4_open_api_d_t_o: {
      product_items: [
        {
          logistics_service_name: logisticsService,
          sku_attr: supplierSku,
          product_count: String(productCount),
          product_id: String(record.supplier_item_id),
          order_memo: `Quvirl auto-created from Shopify order ${record.shopify_order_name || record.shopify_order_id}`
        }
      ],
      logistics_address: {
        zip: clean(address.zip),
        country: countryCode,
        address: clean(address.address1),
        address2: clean(address.address2),
        city: clean(address.city),
        contact_person: fullName,
        mobile_no: mobileNo,
        locale: 'en_US',
        full_name: fullName,
        province: clean(address.province || address.province_code || address.state),
        phone_country: phoneCountry(countryCode)
      },
      out_order_id: `${record.shopify_order_id}-${record.shopify_line_item_id}`
    }
  };
}

async function createAliExpressOrder(record) {
  const connection = await getLatestAliExpressConnection();
  const payload = buildAliExpressOrderPayload(record);

  const params = {
    app_key: ALIEXPRESS_APP_KEY.trim(),
    method: METHOD,
    sign_method: 'sha256',
    timestamp: timestamp(),
    format: 'json',
    v: '2.0',
    session: connection.access_token,
    ds_extend_request: JSON.stringify(payload.ds_extend_request),
    param_place_order_request4_open_api_d_t_o: JSON.stringify(payload.param_place_order_request4_open_api_d_t_o)
  };

  params.sign = signTopRequest(params, ALIEXPRESS_APP_SECRET);

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
    throw new Error('AliExpress order response was not JSON: ' + (text || '[EMPTY RESPONSE]'));
  }

  if (!response.ok || json.error_response || json.error_code || (json.code && String(json.code) !== '0')) {
    throw new Error('AliExpress order create failed: ' + JSON.stringify(json, null, 2));
  }

  return json;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    if (
      !ALIEXPRESS_APP_KEY ||
      !ALIEXPRESS_APP_SECRET ||
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY ||
      !QUVIRL_INTERNAL_API_KEY
    ) {
      return res.status(500).json({ ok: false, error: 'Missing environment variables' });
    }

    const internalKey = req.headers['x-quvirl-internal-key'];

    if (internalKey !== QUVIRL_INTERNAL_API_KEY) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { fulfillmentId } = req.body || {};

    if (!fulfillmentId) {
      return res.status(400).json({ ok: false, error: 'Missing fulfillmentId' });
    }

    const record = await getFulfillmentRecord(fulfillmentId);

    if (record.status === 'auto_fulfilled') {
      return res.status(200).json({ ok: true, status: 'already_fulfilled' });
    }

    await updateFulfillmentRecord(fulfillmentId, {
      status: 'creating_aliexpress_order',
      failure_reason: null
    });

    const aliResponse = await createAliExpressOrder(record);

    const aliOrderId =
      aliResponse?.aliexpress_ds_order_create_response?.result?.order_id ||
      aliResponse?.result?.order_id ||
      aliResponse?.order_id ||
      null;

    await updateFulfillmentRecord(fulfillmentId, {
      status: 'auto_fulfilled',
      aliexpress_order_id: aliOrderId ? String(aliOrderId) : null,
      raw_aliexpress_response: aliResponse,
      failure_reason: null
    });

    return res.status(200).json({
      ok: true,
      status: 'auto_fulfilled',
      aliexpress_order_id: aliOrderId,
      response: aliResponse
    });
  } catch (error) {
    const { fulfillmentId } = req.body || {};

    if (fulfillmentId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await updateFulfillmentRecord(fulfillmentId, {
          status: 'auto_failed_aliexpress_error',
          failure_reason: error.message
        });
      } catch {}
    }

    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
};
