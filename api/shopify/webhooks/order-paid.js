const crypto = require('crypto');

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';

const SHOPIFY_API_SECRET = (
  process.env.SHOPIFY_WEBHOOK_SECRET ||
  process.env.SHOPIFY_API_SECRET ||
  ''
).trim();

const SHOPIFY_WEBHOOK_URL_SECRET = (
  process.env.SHOPIFY_WEBHOOK_URL_SECRET || ''
).trim();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QUVIRL_INTERNAL_API_KEY = process.env.QUVIRL_INTERNAL_API_KEY;
const QUVIRL_APP_URL = process.env.SHOPIFY_APP_URL || 'https://quvirl.com';

function verifyShopifyWebhook(rawBodyBuffer, hmacHeader) {
  if (!SHOPIFY_API_SECRET || !hmacHeader || !rawBodyBuffer) {
    return false;
  }

  const calculatedDigest = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(rawBodyBuffer)
    .digest('base64');

  const receivedDigest = String(hmacHeader || '').trim();

  const calculatedBuffer = Buffer.from(calculatedDigest, 'utf8');
  const receivedBuffer = Buffer.from(receivedDigest, 'utf8');

  if (calculatedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(calculatedBuffer, receivedBuffer);
}

function normalizeShop(shop) {
  return String(shop || '').trim().toLowerCase();
}

function shopifyGid(type, id) {
  const value = String(id || '');
  if (value.startsWith('gid://')) return value;
  return `gid://shopify/${type}/${value}`;
}

function getUrlSecret(req) {
  try {
    const requestUrl = new URL(req.url, QUVIRL_APP_URL);
    return String(requestUrl.searchParams.get('secret') || '').trim();
  } catch {
    return '';
  }
}

async function saveWebhookDebugLog(payload) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

    await fetch(`${SUPABASE_URL}/rest/v1/shopify_webhook_debug_logs`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // Debug logging must never block webhook processing.
  }
}

async function getShopifyStore(shopDomain) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shopify_stores?shop_domain=eq.${encodeURIComponent(shopDomain)}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const rows = await response.json();

  if (!response.ok || !rows.length) {
    return null;
  }

  return rows[0];
}

async function shopifyGraphql(shop, accessToken, query, variables = {}) {
  const endpoint = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();

  if (!response.ok || json.errors) {
    throw new Error(JSON.stringify(json));
  }

  return json.data;
}

async function getProductSupplierMetafields(shop, accessToken, productId) {
  if (!productId) return {};

  const query = `
    query getProductSupplierMetafields($id: ID!) {
      product(id: $id) {
        id
        title
        metafields(first: 30, namespace: "quvirl") {
          nodes {
            key
            value
          }
        }
      }
    }
  `;

  const data = await shopifyGraphql(shop, accessToken, query, {
    id: shopifyGid('Product', productId)
  });

  const nodes = data.product?.metafields?.nodes || [];
  const fields = {};

  for (const node of nodes) {
    fields[node.key] = node.value;
  }

  return fields;
}

async function saveFulfillmentRecord(payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/aliexpress_auto_fulfillments`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  let rows;
  try {
    rows = JSON.parse(text);
  } catch {
    rows = [];
  }

  if (!response.ok) {
    throw new Error('Supabase fulfillment save failed: ' + text);
  }

  return Array.isArray(rows) ? rows[0] : null;
}

function shippingAddressComplete(address) {
  if (!address) return false;

  return Boolean(
    address.address1 &&
    address.city &&
    address.country_code &&
    address.zip
  );
}

function fulfillmentFailureReason({ supplierFields, address }) {
  if (!supplierFields.supplier_item_id) {
    return 'missing_supplier_item_id';
  }

  if (!supplierFields.supplier_sku_attr && !supplierFields.supplier_sku_id) {
    return 'missing_supplier_sku_or_sku_attr';
  }

  if (!shippingAddressComplete(address)) {
    return 'missing_or_incomplete_shipping_address';
  }

  return '';
}

async function triggerAliExpressCreateOrder(fulfillmentId) {
  const response = await fetch(`${QUVIRL_APP_URL}/api/aliexpress/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Quvirl-Internal-Key': QUVIRL_INTERNAL_API_KEY
    },
    body: JSON.stringify({
      fulfillmentId
    })
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = {
      ok: false,
      error: text
    };
  }

  return json;
}

async function processLineItem({ shop, store, order, lineItem }) {
  const supplierFields = await getProductSupplierMetafields(
    shop,
    store.access_token,
    lineItem.product_id
  );

  const reason = fulfillmentFailureReason({
    supplierFields,
    address: order.shipping_address
  });

  const initialStatus = reason
    ? `auto_failed_${reason}`
    : 'ready_for_aliexpress_order_create';

  const record = await saveFulfillmentRecord({
    shop_domain: shop,
    shopify_order_id: String(order.id),
    shopify_order_name: String(order.name || ''),
    shopify_line_item_id: String(lineItem.id || ''),
    shopify_product_id: String(lineItem.product_id || ''),
    shopify_variant_id: String(lineItem.variant_id || ''),

    supplier_item_id: supplierFields.supplier_item_id || '',
    supplier_sku_id: supplierFields.supplier_sku_id || '',
    supplier_sku_attr: supplierFields.supplier_sku_attr || '',
    supplier_url: supplierFields.supplier_url || '',
    logistics_service_name: supplierFields.logistics_service_name || '',

    customer_country: order.shipping_address?.country_code || '',
    customer_name:
      order.shipping_address?.name ||
      `${order.shipping_address?.first_name || ''} ${order.shipping_address?.last_name || ''}`.trim(),

    shipping_address: order.shipping_address || null,
    line_item: lineItem,

    status: initialStatus,
    failure_reason: reason || null,

    raw_shopify_order: order,
    updated_at: new Date().toISOString()
  });

  if (!reason && record?.id) {
    const aliResult = await triggerAliExpressCreateOrder(record.id);

    await saveWebhookDebugLog({
      shop_domain: shop,
      topic: 'orders/paid',
      hmac_present: true,
      hmac_valid: true,
      status: aliResult?.ok
        ? 'aliexpress_create_order_triggered'
        : 'aliexpress_create_order_failed',
      error: aliResult?.ok ? null : JSON.stringify(aliResult)
    });
  } else {
    await saveWebhookDebugLog({
      shop_domain: shop,
      topic: 'orders/paid',
      hmac_present: true,
      hmac_valid: true,
      status: 'fulfillment_record_saved_with_failure_reason',
      error: reason || null
    });
  }
}

module.exports = async function handler(req, res) {
  let rawBody = '';
  let shop = '';
  let topic = '';

  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method not allowed');
    }

    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY ||
      !QUVIRL_INTERNAL_API_KEY
    ) {
      return res.status(500).send('Missing environment variables');
    }

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const rawBodyBuffer = Buffer.concat(chunks);
    rawBody = rawBodyBuffer.toString('utf8');

    const hmacHeader = req.headers['x-shopify-hmac-sha256'];

    shop = normalizeShop(req.headers['x-shopify-shop-domain']);
    topic = String(req.headers['x-shopify-topic'] || '');

    const hmacValid = verifyShopifyWebhook(rawBodyBuffer, hmacHeader);

    const urlSecret = getUrlSecret(req);
    const urlSecretValid =
      Boolean(SHOPIFY_WEBHOOK_URL_SECRET) &&
      Boolean(urlSecret) &&
      urlSecret === SHOPIFY_WEBHOOK_URL_SECRET;

    const acceptedWebhook = hmacValid || urlSecretValid;

    await saveWebhookDebugLog({
      shop_domain: shop,
      topic,
      hmac_present: Boolean(hmacHeader),
      hmac_valid: hmacValid,
      status: acceptedWebhook
        ? hmacValid
          ? 'received_valid_hmac'
          : 'received_valid_url_secret'
        : 'received_invalid_hmac',
      error: acceptedWebhook
        ? JSON.stringify({
            secret_present: Boolean(SHOPIFY_API_SECRET),
            secret_length: SHOPIFY_API_SECRET ? SHOPIFY_API_SECRET.length : 0,
            url_secret_present: Boolean(SHOPIFY_WEBHOOK_URL_SECRET),
            url_secret_used: Boolean(urlSecret),
            raw_body_length: rawBodyBuffer.length,
            hmac_header_length: hmacHeader ? String(hmacHeader).length : 0
          })
        : JSON.stringify({
            message: 'Invalid webhook HMAC',
            secret_present: Boolean(SHOPIFY_API_SECRET),
            secret_length: SHOPIFY_API_SECRET ? SHOPIFY_API_SECRET.length : 0,
            url_secret_present: Boolean(SHOPIFY_WEBHOOK_URL_SECRET),
            url_secret_used: Boolean(urlSecret),
            raw_body_length: rawBodyBuffer.length,
            hmac_header_length: hmacHeader ? String(hmacHeader).length : 0
          })
    });

    if (!acceptedWebhook) {
      return res.status(401).send('Invalid webhook signature');
    }

    if (!shop) {
      await saveWebhookDebugLog({
        shop_domain: '',
        topic,
        hmac_present: Boolean(hmacHeader),
        hmac_valid: hmacValid,
        status: 'missing_shop_domain',
        error: 'Missing Shopify shop domain header'
      });

      return res.status(400).send('Missing Shopify shop domain');
    }

    const order = JSON.parse(rawBody);

    const store = await getShopifyStore(shop);

    if (!store) {
      await saveWebhookDebugLog({
        shop_domain: shop,
        topic,
        hmac_present: Boolean(hmacHeader),
        hmac_valid: hmacValid,
        status: 'shop_not_connected_to_quvirl',
        error: 'No matching shopify_stores row found'
      });

      return res.status(200).send('Shop not connected to Quvirl');
    }

    const lineItems = order.line_items || [];

    await saveWebhookDebugLog({
      shop_domain: shop,
      topic,
      hmac_present: Boolean(hmacHeader),
      hmac_valid: hmacValid,
      status: `processing_${lineItems.length}_line_items`,
      error: null
    });

    for (const lineItem of lineItems) {
      await processLineItem({
        shop,
        store,
        order,
        lineItem
      });
    }

    await saveWebhookDebugLog({
      shop_domain: shop,
      topic,
      hmac_present: Boolean(hmacHeader),
      hmac_valid: hmacValid,
      status: 'processed_successfully',
      error: null
    });

    return res.status(200).send('OK');
  } catch (error) {
    await saveWebhookDebugLog({
      shop_domain: shop,
      topic,
      hmac_present: null,
      hmac_valid: null,
      status: 'handler_error',
      error: error.message || String(error)
    });

    return res.status(500).send(error.message || String(error));
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
