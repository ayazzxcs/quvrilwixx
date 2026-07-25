const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QUVIRL_INTERNAL_API_KEY = process.env.QUVIRL_INTERNAL_API_KEY;

const CJ_CREATE_ORDER_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2';

const CJ_DEFAULT_LOGISTIC_NAME = process.env.CJ_DEFAULT_LOGISTIC_NAME || '';
const CJ_DEFAULT_FROM_COUNTRY_CODE = process.env.CJ_DEFAULT_FROM_COUNTRY_CODE || 'CN';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function tokenHash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function getQuantityFromRecord(record) {
  const lineItem = record.line_item || {};
  const quantity = Number(lineItem.quantity || 1);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function phoneFromAddress(address) {
  return (
    clean(address.phone) ||
    clean(address.mobile_no) ||
    clean(address.mobile) ||
    clean(address.telephone) ||
    '0000000000'
  );
}

function countryNameFromAddress(address, record) {
  return (
    clean(address.country) ||
    clean(address.country_name) ||
    clean(record.customer_country) ||
    clean(address.country_code) ||
    ''
  );
}

function fullNameFromAddress(address, record) {
  return (
    clean(address.name) ||
    clean(`${address.first_name || ''} ${address.last_name || ''}`) ||
    clean(record.customer_name) ||
    'Customer'
  );
}

async function getCJConnectionForShop(shop) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cj_connections?shop_domain=eq.${encodeURIComponent(shop)}&select=*&order=updated_at.desc&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const rows = await response.json();

  if (!response.ok || !Array.isArray(rows) || !rows.length || !rows[0].access_token) {
    return null;
  }

  return rows[0];
}

async function getCJFulfillmentRecord(id) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cj_auto_fulfillments?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const rows = await response.json();

  if (!response.ok || !Array.isArray(rows) || !rows.length) {
    throw new Error('CJ fulfillment record not found');
  }

  return rows[0];
}

async function updateCJFulfillmentRecord(id, patch) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cj_auto_fulfillments?id=eq.${encodeURIComponent(id)}`,
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
    throw new Error('Failed to update CJ fulfillment record: ' + text);
  }
}

function buildCJOrderPayload(record) {
  const address = record.shipping_address || {};
  const lineItem = record.line_item || {};

  const quantity = getQuantityFromRecord(record);
  const variantId = clean(record.cj_variant_id || lineItem.cj_variant_id || lineItem.variantId);
  const orderNumber = clean(record.shopify_order_name || record.shopify_order_id || record.id);

  const shippingCountryCode = clean(
    address.country_code || address.countryCode || record.customer_country || ''
  ).toUpperCase();

  const shippingCountry = countryNameFromAddress(address, record);
  const shippingCustomerName = fullNameFromAddress(address, record);
  const shippingPhone = phoneFromAddress(address);

  const shippingProvince = clean(
    address.province ||
      address.province_code ||
      address.state ||
      address.state_code ||
      ''
  );

  const shippingCity = clean(address.city || '');
  const shippingZip = clean(address.zip || address.postal_code || '');
  const shippingAddress = clean(address.address1 || address.address || '');
  const shippingAddress2 = clean(address.address2 || '');

  const logisticName = clean(record.logistic_name || record.logistics_service_name || CJ_DEFAULT_LOGISTIC_NAME);
  const fromCountryCode = clean(record.from_country_code || record.fromCountryCode || CJ_DEFAULT_FROM_COUNTRY_CODE).toUpperCase();

  if (!variantId) {
    throw new Error('Missing CJ variant ID');
  }

  if (!orderNumber) {
    throw new Error('Missing order number');
  }

  if (!shippingCountryCode) {
    throw new Error('Missing shipping country code');
  }

  if (!shippingCountry) {
    throw new Error('Missing shipping country');
  }

  if (!shippingProvince) {
    throw new Error('Missing shipping province/state');
  }

  if (!shippingCity) {
    throw new Error('Missing shipping city');
  }

  if (!shippingAddress) {
    throw new Error('Missing shipping address');
  }

  if (!shippingCustomerName) {
    throw new Error('Missing shipping customer name');
  }

  if (!logisticName) {
    throw new Error('Missing CJ logisticName. Set CJ_DEFAULT_LOGISTIC_NAME in environment variables.');
  }

  if (!fromCountryCode) {
    throw new Error('Missing CJ fromCountryCode');
  }

  return {
    orderNumber,
    shippingZip,
    shippingCountry,
    shippingCountryCode,
    shippingProvince,
    shippingCity,
    shippingCounty: clean(address.county || ''),
    shippingPhone,
    shippingCustomerName,
    shippingAddress,
    shippingAddress2,
    taxId: clean(address.tax_id || ''),
    remark: `Quvirl auto-created from Shopify order ${orderNumber}`,
    email: clean(record.customer_email || address.email || ''),
    consigneeID: '',
    payType: 3,
    shopAmount: '',
    logisticName,
    fromCountryCode,
    houseNumber: clean(address.house_number || ''),
    platform: 'shopify',
    iossType: '',
    iossNumber: '',
    orderFlow: 1,
    shopLogisticsType: 2,
    products: [
      {
        vid: variantId,
        quantity,
        storeLineItemId: clean(record.shopify_line_item_id || lineItem.id || '')
      }
    ]
  };
}

function extractCJOrderId(json) {
  const data = json?.data || json?.result || {};

  return (
    data.orderId ||
    data.order_id ||
    data.cjOrderId ||
    data.cj_order_id ||
    data.orderNumber ||
    data.order_number ||
    json?.orderId ||
    json?.order_id ||
    ''
  );
}

async function createCJOrder(record, connection) {
  const payload = buildCJOrderPayload(record);

  const response = await fetch(CJ_CREATE_ORDER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': connection.access_token,
      platformToken: ''
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('CJ create order response was not JSON: ' + (text || '[EMPTY RESPONSE]'));
  }

  if (!response.ok || json.success === false || json.result === false || (json.code && Number(json.code) !== 200)) {
    throw new Error('CJ create order failed: ' + JSON.stringify(json));
  }

  return {
    payload,
    json,
    cjOrderId: extractCJOrderId(json)
  };
}

module.exports = async function handler(req, res) {
  const { fulfillmentId } = req.body || {};

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed'
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !QUVIRL_INTERNAL_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Missing environment variables'
      });
    }

    const internalKey = req.headers['x-quvirl-internal-key'];

    if (internalKey !== QUVIRL_INTERNAL_API_KEY) {
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized'
      });
    }

    if (!fulfillmentId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing fulfillmentId'
      });
    }

    const record = await getCJFulfillmentRecord(fulfillmentId);

    if (record.status === 'auto_fulfilled') {
      return res.status(200).json({
        ok: true,
        status: 'already_fulfilled'
      });
    }

    const shop = clean(record.shop_domain);

    if (!shop) {
      await updateCJFulfillmentRecord(fulfillmentId, {
        status: 'auto_failed_cj_not_connected',
        failure_reason: 'Missing shop_domain on CJ fulfillment record'
      });

      return res.status(400).json({
        ok: false,
        status: 'auto_failed_cj_not_connected',
        error: 'Missing shop_domain on CJ fulfillment record'
      });
    }

    const connection = await getCJConnectionForShop(shop);

    if (!connection) {
      await updateCJFulfillmentRecord(fulfillmentId, {
        status: 'auto_failed_cj_not_connected',
        failure_reason: 'CJ account is not connected for this Shopify store'
      });

      return res.status(400).json({
        ok: false,
        status: 'auto_failed_cj_not_connected',
        error: 'CJ account is not connected for this Shopify store'
      });
    }

    await updateCJFulfillmentRecord(fulfillmentId, {
      status: 'creating_cj_order',
      failure_reason: null
    });

    const result = await createCJOrder(record, connection);

    await updateCJFulfillmentRecord(fulfillmentId, {
      status: 'auto_fulfilled',
      cj_order_id: result.cjOrderId ? String(result.cjOrderId) : null,
      cj_order_number: result.payload.orderNumber,
      raw_cj_response: result.json,
      failure_reason: null
    });

    return res.status(200).json({
      ok: true,
      status: 'auto_fulfilled',
      cj_order_id: result.cjOrderId,
      response: result.json
    });
  } catch (error) {
    if (fulfillmentId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await updateCJFulfillmentRecord(fulfillmentId, {
          status: 'auto_failed_cj_error',
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
