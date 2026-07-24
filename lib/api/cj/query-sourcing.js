const SUPABASE_URL = SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CJ_QUERY_SOURCING_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/product/sourcing/query';

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

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

function normalizeQueryData(json) {
  const data = json?.data;

  if (Array.isArray(data)) {
    return data[0] || {};
  }

  if (data && Array.isArray(data.list)) {
    return data.list[0] || {};
  }

  return data || {};
}

async function updateSourcingRequest(cjSourcingId, json) {
  if (!cjSourcingId) return;

  const data = normalizeQueryData(json);

  const patch = {
    cj_source_number: clean(data.sourceNumber || ''),
    cj_product_id: clean(data.cjProductId || data.productId || ''),
    cj_variant_id: clean(data.variantId || ''),
    cj_variant_sku: clean(data.cjVariantSku || ''),
    source_status: clean(data.sourceStatus || ''),
    source_status_text: clean(data.sourceStatusStr || ''),
    raw_query_response: json,
    updated_at: new Date().toISOString()
  };

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cj_sourcing_requests?cj_sourcing_id=eq.${encodeURIComponent(cjSourcingId)}`,
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

  if (!response.ok) {
    const text = await response.text();
    throw new Error('Failed to update CJ sourcing request: ' + text);
  }
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

    const cjSourcingId =
      clean(getRequestValue(req, 'cjSourcingId')) ||
      clean(getRequestValue(req, 'sourceId')) ||
      clean(getRequestValue(req, 'sourcingId'));

    if (!cjSourcingId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing cjSourcingId'
      });
    }

    const connection = await getLatestCJConnection();

    const response = await fetch(CJ_QUERY_SOURCING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CJ-Access-Token': connection.access_token
      },
      body: JSON.stringify({
        sourceIds: [cjSourcingId]
      })
    });

    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('CJ sourcing query response was not JSON: ' + (text || '[EMPTY RESPONSE]'));
    }

    if (!response.ok || json.success === false || json.result === false) {
      return res.status(400).json({
        ok: false,
        error: json
      });
    }

    await updateSourcingRequest(cjSourcingId, json);

    return res.status(200).json({
      ok: true,
      cjSourcingId,
      result: normalizeQueryData(json),
      response: json
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
