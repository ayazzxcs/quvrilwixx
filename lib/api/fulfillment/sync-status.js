const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QUVIRL_INTERNAL_API_KEY = process.env.QUVIRL_INTERNAL_API_KEY;

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function shopifyGid(type, id) {
  const value = String(id || '');

  if (value.startsWith('gid://')) {
    return value;
  }

  return `gid://shopify/${type}/${value}`;
}

function addMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function safeJson(value) {
  if (!value) return {};

  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function deepFindFirst(obj, keys) {
  const wanted = keys.map((key) => key.toLowerCase());
  const seen = new Set();

  function visit(value) {
    if (!value || typeof value !== 'object') return '';

    if (seen.has(value)) return '';
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }

      return '';
    }

    for (const [key, item] of Object.entries(value)) {
      if (wanted.includes(String(key).toLowerCase())) {
        const cleaned = clean(item);
        if (cleaned) return cleaned;
      }
    }

    for (const item of Object.values(value)) {
      const found = visit(item);
      if (found) return found;
    }

    return '';
  }

  return visit(obj);
}

function extractTracking(rawResponse) {
  const json = safeJson(rawResponse);

  const trackingNumber = deepFindFirst(json, [
    'trackingNumber',
    'tracking_number',
    'trackingNo',
    'tracking_no',
    'trackNumber',
    'track_number',
    'waybillNumber',
    'waybill_number',
    'logisticsTrackingNumber',
    'logistics_tracking_number',
    'shipmentTrackingNumber',
    'shipment_tracking_number'
  ]);

  const trackingCompany = deepFindFirst(json, [
    'trackingCompany',
    'tracking_company',
    'carrier',
    'carrierName',
    'carrier_name',
    'logisticsCompany',
    'logistics_company',
    'logisticName',
    'logistic_name',
    'shippingCarrier',
    'shipping_carrier'
  ]);

  const trackingUrl = deepFindFirst(json, [
    'trackingUrl',
    'tracking_url',
    'trackUrl',
    'track_url',
    'logisticsTrackingUrl',
    'logistics_tracking_url'
  ]);

  return {
    trackingNumber,
    trackingCompany,
    trackingUrl
  };
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

  if (!response.ok || !Array.isArray(rows) || !rows.length) {
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
    body: JSON.stringify({
      query,
      variables
    })
  });

  const json = await response.json();

  if (!response.ok || json.errors) {
    throw new Error('Shopify GraphQL error: ' + JSON.stringify(json));
  }

  return json.data;
}

async function getFulfillmentOrderLineTarget({ shop, accessToken, orderId, lineItemId }) {
  const query = `
    query getFulfillmentOrders($id: ID!) {
      order(id: $id) {
        id
        fulfillmentOrders(first: 20) {
          nodes {
            id
            status
            lineItems(first: 50) {
              nodes {
                id
                remainingQuantity
                lineItem {
                  id
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyGraphql(shop, accessToken, query, {
    id: shopifyGid('Order', orderId)
  });

  const targetLineItemGid = shopifyGid('LineItem', lineItemId);
  const fulfillmentOrders = data.order?.fulfillmentOrders?.nodes || [];

  for (const fulfillmentOrder of fulfillmentOrders) {
    const lineItems = fulfillmentOrder.lineItems?.nodes || [];

    for (const fulfillmentOrderLineItem of lineItems) {
      if (
        fulfillmentOrderLineItem.lineItem?.id === targetLineItemGid &&
        Number(fulfillmentOrderLineItem.remainingQuantity || 0) > 0
      ) {
        return {
          fulfillmentOrderId: fulfillmentOrder.id,
          fulfillmentOrderLineItemId: fulfillmentOrderLineItem.id,
          quantity: Number(fulfillmentOrderLineItem.remainingQuantity || 1)
        };
      }
    }
  }

  return null;
}

async function createShopifyFulfillment({
  shop,
  accessToken,
  orderId,
  lineItemId,
  trackingNumber,
  trackingCompany,
  trackingUrl
}) {
  const target = await getFulfillmentOrderLineTarget({
    shop,
    accessToken,
    orderId,
    lineItemId
  });

  if (!target) {
    throw new Error('No open Shopify fulfillment order line item found');
  }

  const mutation = `
    mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
      fulfillmentCreateV2(fulfillment: $fulfillment) {
        fulfillment {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const trackingInfo = {
    number: trackingNumber
  };

  if (trackingCompany) {
    trackingInfo.company = trackingCompany;
  }

  if (trackingUrl) {
    trackingInfo.url = trackingUrl;
  }

  const data = await shopifyGraphql(shop, accessToken, mutation, {
    fulfillment: {
      notifyCustomer: true,
      trackingInfo,
      lineItemsByFulfillmentOrder: [
        {
          fulfillmentOrderId: target.fulfillmentOrderId,
          fulfillmentOrderLineItems: [
            {
              id: target.fulfillmentOrderLineItemId,
              quantity: target.quantity
            }
          ]
        }
      ]
    }
  });

  const result = data.fulfillmentCreateV2;
  const errors = result?.userErrors || [];

  if (errors.length) {
    throw new Error('Shopify fulfillment create failed: ' + JSON.stringify(errors));
  }

  return result.fulfillment;
}

async function fetchRows(table) {
  const statusFilter = [
    'supplier_order_created_awaiting_manual_payment',
    'auto_fulfilled',
    'creating_aliexpress_order',
    'creating_cj_order',
    'ready_for_aliexpress_order_create',
    'ready_for_cj_order_create'
  ].join(',');

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=*&shopify_fulfillment_id=is.null&status=in.(${encodeURIComponent(statusFilter)})&order=updated_at.asc&limit=25`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const rows = await response.json();

  if (!response.ok || !Array.isArray(rows)) {
    throw new Error(`Failed to fetch ${table}: ` + JSON.stringify(rows));
  }

  return rows;
}

async function updateRow(table, id, patch) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
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
        updated_at: nowIso()
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update ${table}: ${text}`);
  }
}

function getRawSupplierResponse(row, platform) {
  if (platform === 'aliexpress') {
    return row.raw_aliexpress_response || {};
  }

  return row.raw_cj_response || {};
}

async function processRow({ table, platform, row }) {
  const rawSupplierResponse = getRawSupplierResponse(row, platform);
  const tracking = extractTracking(rawSupplierResponse);

  await updateRow(table, row.id, {
    last_sync_at: nowIso(),
    sync_attempts: Number(row.sync_attempts || 0) + 1
  });

  if (!tracking.trackingNumber) {
    await updateRow(table, row.id, {
      status: 'supplier_order_created_awaiting_manual_payment',
      next_sync_at: addMinutes(60),
      failure_reason: null
    });

    return {
      ok: true,
      status: 'no_tracking_yet',
      id: row.id,
      platform
    };
  }

  const shop = clean(row.shop_domain);
  const store = await getShopifyStore(shop);

  if (!store?.access_token) {
    await updateRow(table, row.id, {
      status: 'failed_needs_attention',
      failure_reason: 'Shopify store token not found',
      next_sync_at: addMinutes(120)
    });

    return {
      ok: false,
      status: 'missing_shopify_token',
      id: row.id,
      platform
    };
  }

  const fulfillment = await createShopifyFulfillment({
    shop,
    accessToken: store.access_token,
    orderId: row.shopify_order_id,
    lineItemId: row.shopify_line_item_id,
    trackingNumber: tracking.trackingNumber,
    trackingCompany: tracking.trackingCompany,
    trackingUrl: tracking.trackingUrl
  });

  await updateRow(table, row.id, {
    status: 'shopify_fulfilled',
    tracking_number: tracking.trackingNumber,
    tracking_company: tracking.trackingCompany || null,
    tracking_url: tracking.trackingUrl || null,
    shopify_fulfillment_id: fulfillment?.id || null,
    shopify_fulfilled_at: nowIso(),
    failure_reason: null,
    next_sync_at: null
  });

  return {
    ok: true,
    status: 'shopify_fulfilled',
    id: row.id,
    platform,
    shopifyFulfillmentId: fulfillment?.id || null
  };
}

async function processTable(table, platform) {
  const rows = await fetchRows(table);
  const results = [];

  for (const row of rows) {
    try {
      const result = await processRow({
        table,
        platform,
        row
      });

      results.push(result);
    } catch (error) {
      await updateRow(table, row.id, {
        status: 'failed_retrying',
        failure_reason: error.message || String(error),
        next_sync_at: addMinutes(120),
        sync_attempts: Number(row.sync_attempts || 0) + 1
      });

      results.push({
        ok: false,
        status: 'failed_retrying',
        id: row.id,
        platform,
        error: error.message || String(error)
      });
    }
  }

  return results;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
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

    const internalKey =
      req.headers['x-quvirl-internal-key'] ||
      req.query?.key ||
      '';

    if (internalKey !== QUVIRL_INTERNAL_API_KEY) {
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized'
      });
    }

    const aliResults = await processTable(
      'aliexpress_auto_fulfillments',
      'aliexpress'
    );

    const cjResults = await processTable(
      'cj_auto_fulfillments',
      'cjdropshipping'
    );

    return res.status(200).json({
      ok: true,
      aliexpress: aliResults,
      cjdropshipping: cjResults
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
