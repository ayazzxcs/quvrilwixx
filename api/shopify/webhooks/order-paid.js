const crypto = require('crypto');

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function verifyShopifyWebhook(rawBody, hmacHeader) {
  if (!SHOPIFY_API_SECRET || !hmacHeader) return false;

  const digest = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, 'base64'),
      Buffer.from(hmacHeader, 'base64')
    );
  } catch {
    return false;
  }
}

function normalizeShop(shop) {
  return String(shop || '').trim().toLowerCase();
}

function shopifyGid(type, id) {
  const value = String(id || '');
  if (value.startsWith('gid://')) return value;
  return `gid://shopify/${type}/${value}`;
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
        metafields(first: 20, namespace: "quvirl") {
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
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error('Supabase fulfillment save failed: ' + text);
  }
}

function shippingAddressComplete(address) {
  if (!address) return false;

  return Boolean(
    address.first_name &&
    address.address1 &&
    address.city &&
    address.country_code &&
    address.zip
  );
}

function fulfillmentFailureReason({ supplierFields, address }) {
  if (!supplierFields.supplier_item_id) return 'missing_supplier_item_id';
  if (!shippingAddressComplete(address)) return 'missing_or_incomplete_shipping_address';
  return '';
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

  const status = reason ? `auto_failed_${reason}` : 'ready_for_aliexpress_order_create';

  await saveFulfillmentRecord({
    shop_domain: shop,
    shopify_order_id: String(order.id),
    shopify_order_name: String(order.name || ''),
    shopify_line_item_id: String(lineItem.id || ''),
    shopify_product_id: String(lineItem.product_id || ''),
    shopify_variant_id: String(lineItem.variant_id || ''),
    supplier_item_id: supplierFields.supplier_item_id || '',
    supplier_sku_id: supplierFields.supplier_sku_id || '',
    supplier_url: supplierFields.supplier_url || '',
    customer_country: order.shipping_address?.country_code || '',
    shipping_address: order.shipping_address || null,
    line_item: lineItem,
    status,
    failure_reason: reason || null,
    raw_shopify_order: order,
    updated_at: new Date().toISOString()
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method not allowed');
    }

    if (!SHOPIFY_API_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send('Missing environment variables');
    }

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks).toString('utf8');
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];

    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      return res.status(401).send('Invalid webhook HMAC');
    }

    const shop = normalizeShop(req.headers['x-shopify-shop-domain']);
    const order = JSON.parse(rawBody);

    if (!shop) {
      return res.status(400).send('Missing Shopify shop domain');
    }

    const store = await getShopifyStore(shop);

    if (!store) {
      return res.status(200).send('Shop not connected to Quvirl');
    }

    const lineItems = order.line_items || [];

    for (const lineItem of lineItems) {
      await processLineItem({
        shop,
        store,
        order,
        lineItem
      });
    }

    return res.status(200).send('OK');
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
