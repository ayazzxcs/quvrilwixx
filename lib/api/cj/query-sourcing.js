const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CJ_QUERY_SOURCING_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/product/sourcing/query';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function tokenHash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
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

async function getShopifyStore(shop, installToken) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shopify_stores?shop_domain=eq.${encodeURIComponent(shop)}&select=*`,
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

  const store = rows[0];

  if (store.install_token_hash !== tokenHash(installToken)) {
    return null;
  }

  return store;
}

async function getLatestCJConnectionForShop(shop) {
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

async function findSavedSourcingRequest({ shop, cjSourcingId, cjSourceNumber }) {
  const queries = [];

  if (cjSourcingId) {
    queries.push(
      `${SUPABASE_URL}/rest/v1/cj_sourcing_requests?shop_domain=eq.${encodeURIComponent(shop)}&cj_sourcing_id=eq.${encodeURIComponent(cjSourcingId)}&select=*&order=updated_at.desc&limit=1`
    );
  }

  if (cjSourceNumber) {
    queries.push(
      `${SUPABASE_URL}/rest/v1/cj_sourcing_requests?shop_domain=eq.${encodeURIComponent(shop)}&cj_source_number=eq.${encodeURIComponent(cjSourceNumber)}&select=*&order=updated_at.desc&limit=1`
    );
  }

  for (const url of queries) {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const rows = await response.json();

    if (response.ok && Array.isArray(rows) && rows.length) {
      return rows[0];
    }
  }

  return null;
}

function normalizeQueryData(json) {
  const data = json?.data;

  if (Array.isArray(data)) {
    return data[0] || {};
  }

  if (data && Array.isArray(data.list)) {
    return data.list[0] || {};
  }

  if (json?.result && typeof json.result === 'object') {
    return json.result;
  }

  return data || {};
}

function extractSourceNumber(json) {
  return deepFindFirst(json, [
    'sourceNumber',
    'source_number',
    'sourceNo',
    'source_no',
    'cjSourceNumber',
    'cj_source_number',
    'sourcingNumber',
    'sourcing_number'
  ]);
}

function extractProductId(json) {
  return deepFindFirst(json, [
    'cjProductId',
    'cj_product_id',
    'productPid',
    'product_pid',
    'pid',
    'cjPid',
    'cj_pid'
  ]);
}

function extractVariantId(json) {
  return deepFindFirst(json, [
    'variantId',
    'variant_id',
    'vid',
    'cjVariantId',
    'cj_variant_id'
  ]);
}

function extractVariantSku(json) {
  return deepFindFirst(json, [
    'cjVariantSku',
    'cj_variant_sku',
    'variantSku',
    'variant_sku',
    'sku'
  ]);
}

function extractStatus(json) {
  return deepFindFirst(json, [
    'sourceStatus',
    'source_status',
    'status',
    'statusCode',
    'status_code'
  ]);
}

function extractStatusText(json) {
  return deepFindFirst(json, [
    'sourceStatusStr',
    'source_status_text',
    'statusText',
    'status_text',
    'message',
    'msg'
  ]);
}

async function updateSourcingRequest({ shop, cjSourcingId, cjSourceNumber, json }) {
  const data = normalizeQueryData(json);

  const sourceNumber = extractSourceNumber(json) || extractSourceNumber(data) || cjSourceNumber;
  const productId = extractProductId(json) || extractProductId(data);
  const variantId = extractVariantId(json) || extractVariantId(data);
  const variantSku = extractVariantSku(json) || extractVariantSku(data);
  const status = extractStatus(json) || extractStatus(data);
  const statusText = extractStatusText(json) || extractStatusText(data);

  const patch = {
    cj_source_number: clean(sourceNumber || ''),
    cj_product_id: clean(productId || ''),
    cj_variant_id: clean(variantId || ''),
    cj_variant_sku: clean(variantSku || ''),
    source_status: clean(status || ''),
    source_status_text: clean(statusText || ''),
    raw_query_response: json,
    updated_at: new Date().toISOString()
  };

  const filters = [];

  if (cjSourcingId) {
    filters.push(`cj_sourcing_id=eq.${encodeURIComponent(cjSourcingId)}`);
  }

  if (sourceNumber) {
    filters.push(`cj_source_number=eq.${encodeURIComponent(sourceNumber)}`);
  }

  if (!filters.length) return patch;

  for (const filter of filters) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/cj_sourcing_requests?shop_domain=eq.${encodeURIComponent(shop)}&${filter}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(patch)
      }
    );

    if (response.ok) {
      return patch;
    }
  }

  return patch;
}

async function callCJQuery(connection, payload) {
  const response = await fetch(CJ_QUERY_SOURCING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': connection.access_token
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('CJ sourcing query response was not JSON: ' + (text || '[EMPTY RESPONSE]'));
  }

  return {
    response,
    json,
    payload
  };
}

function isGoodCJResponse(result) {
  const { response, json } = result;

  if (!response.ok) return false;
  if (json.success === false || json.result === false) return false;

  return true;
}

async function queryCJWithFallbacks({ connection, cjSourcingId, cjSourceNumber }) {
  const attempts = [];

  if (cjSourceNumber) {
    attempts.push({ sourceNumbers: [cjSourceNumber] });
    attempts.push({ sourceNumber: cjSourceNumber });
    attempts.push({ sourceNos: [cjSourceNumber] });
    attempts.push({ sourceNo: cjSourceNumber });
  }

  if (cjSourcingId) {
    attempts.push({ sourceIds: [cjSourcingId] });
    attempts.push({ sourceId: cjSourcingId });
    attempts.push({ sourcingIds: [cjSourcingId] });
    attempts.push({ sourcingId: cjSourcingId });
  }

  let last = null;

  for (const payload of attempts) {
    const result = await callCJQuery(connection, payload);
    last = result;

    if (isGoodCJResponse(result)) {
      const data = normalizeQueryData(result.json);
      const sourceNumber = extractSourceNumber(result.json) || extractSourceNumber(data);
      const productId = extractProductId(result.json) || extractProductId(data);
      const statusText = extractStatusText(result.json) || extractStatusText(data);

      if (sourceNumber || productId || statusText || JSON.stringify(result.json).length > 30) {
        return result;
      }
    }
  }

  return last;
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

    const shop = clean(getRequestValue(req, 'shop'));
    const installToken = clean(getRequestValue(req, 'installToken'));

    if (!shop || !installToken) {
      return res.status(400).json({
        ok: false,
        error: 'Missing shop or installToken'
      });
    }

    const store = await getShopifyStore(shop, installToken);

    if (!store) {
      return res.status(401).json({
        ok: false,
        error: 'Shopify store is not connected or token is invalid'
      });
    }

    const connection = await getLatestCJConnectionForShop(shop);

    if (!connection) {
      return res.status(400).json({
        ok: false,
        code: 'CJ_NOT_CONNECTED',
        error: 'CJ account is not connected for this Shopify store'
      });
    }

    let cjSourcingId =
      clean(getRequestValue(req, 'cjSourcingId')) ||
      clean(getRequestValue(req, 'sourceId')) ||
      clean(getRequestValue(req, 'sourcingId'));

    let cjSourceNumber =
      clean(getRequestValue(req, 'cjSourceNumber')) ||
      clean(getRequestValue(req, 'sourceNumber')) ||
      clean(getRequestValue(req, 'sourceNo'));

    if (!cjSourcingId && !cjSourceNumber) {
      return res.status(400).json({
        ok: false,
        error: 'Missing cjSourcingId or cjSourceNumber'
      });
    }

    const saved = await findSavedSourcingRequest({
      shop,
      cjSourcingId,
      cjSourceNumber
    });

    if (saved) {
      cjSourcingId = cjSourcingId || clean(saved.cj_sourcing_id);
      cjSourceNumber = cjSourceNumber || clean(saved.cj_source_number);
    }

    const result = await queryCJWithFallbacks({
      connection,
      cjSourcingId,
      cjSourceNumber
    });

    if (!result || !isGoodCJResponse(result)) {
      return res.status(400).json({
        ok: false,
        error: result?.json || 'CJ query failed'
      });
    }

    const patch = await updateSourcingRequest({
      shop,
      cjSourcingId,
      cjSourceNumber,
      json: result.json
    });

    const data = normalizeQueryData(result.json);

    const normalized = {
      ...data,
      cjSourceNumber:
        patch.cj_source_number ||
        extractSourceNumber(result.json) ||
        extractSourceNumber(data) ||
        cjSourceNumber ||
        '',
      cjProductId:
        patch.cj_product_id ||
        extractProductId(result.json) ||
        extractProductId(data) ||
        '',
      variantId:
        patch.cj_variant_id ||
        extractVariantId(result.json) ||
        extractVariantId(data) ||
        '',
      cjVariantSku:
        patch.cj_variant_sku ||
        extractVariantSku(result.json) ||
        extractVariantSku(data) ||
        '',
      sourceStatus:
        patch.source_status ||
        extractStatus(result.json) ||
        extractStatus(data) ||
        '',
      sourceStatusStr:
        patch.source_status_text ||
        extractStatusText(result.json) ||
        extractStatusText(data) ||
        ''
    };

    return res.status(200).json({
      ok: true,
      cjSourcingId,
      cjSourceNumber: normalized.cjSourceNumber,
      result: normalized,
      response: result.json,
      queryPayloadUsed: result.payload
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
