const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CJ_CREATE_SOURCING_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/product/sourcing/create';

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

function safeUrl(value) {
  const raw = clean(value);

  if (!raw) return '';

  try {
    return new URL(raw).href;
  } catch {
    return raw;
  }
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

function extractSourcingId(json) {
  return (
    json?.data?.cjSourcingId ||
    json?.data?.sourceId ||
    json?.data?.sourcingId ||
    json?.cjSourcingId ||
    json?.sourceId ||
    ''
  );
}

async function saveSourcingRequest(payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/cj_sourcing_requests`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
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
    throw new Error('Failed to save CJ sourcing request: ' + text);
  }

  return Array.isArray(rows) ? rows[0] : null;
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

    const productTitle =
      clean(getRequestValue(req, 'productName')) ||
      clean(getRequestValue(req, 'title')) ||
      clean(getRequestValue(req, 'productTitle'));

    const productImage =
      safeUrl(getRequestValue(req, 'productImage')) ||
      safeUrl(getRequestValue(req, 'imageUrl')) ||
      safeUrl(getRequestValue(req, 'productImageUrl'));

    const productUrl =
      safeUrl(getRequestValue(req, 'productUrl')) ||
      safeUrl(getRequestValue(req, 'sourceUrl')) ||
      safeUrl(getRequestValue(req, 'url'));

    const price = clean(getRequestValue(req, 'price'));

    if (!productTitle) {
      return res.status(400).json({
        ok: false,
        error: 'Missing product title',
        receivedBody: req.body || null,
        receivedQuery: req.query || null
      });
    }

    if (!productImage) {
      return res.status(400).json({
        ok: false,
        error: 'Missing product image URL',
        receivedBody: req.body || null,
        receivedQuery: req.query || null
      });
    }

    const connection = await getLatestCJConnection();

    const cjPayload = {
      thirdProductId: clean(getRequestValue(req, 'thirdProductId') || getRequestValue(req, 'productId')),
      thirdVariantId: clean(getRequestValue(req, 'thirdVariantId') || getRequestValue(req, 'variantId')),
      thirdProductSku: clean(getRequestValue(req, 'thirdProductSku') || getRequestValue(req, 'sku')),
      productName: productTitle,
      productImage,
      productUrl,
      remark: clean(
        getRequestValue(req, 'remark') ||
          'Created by Quvirl exact CJ supplier sourcing flow. Please source the same or closest product from this image and title.'
      ),
      price
    };

    const response = await fetch(CJ_CREATE_SOURCING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CJ-Access-Token': connection.access_token
      },
      body: JSON.stringify(cjPayload)
    });

    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('CJ sourcing create response was not JSON: ' + (text || '[EMPTY RESPONSE]'));
    }

    if (!response.ok || json.success === false || json.result === false) {
      return res.status(400).json({
        ok: false,
        error: json
      });
    }

    const cjSourcingId = extractSourcingId(json);

    const saved = await saveSourcingRequest({
      quvirl_product_id: clean(
        getRequestValue(req, 'quvirlProductId') ||
          getRequestValue(req, 'id') ||
          productUrl ||
          productTitle
      ),
      product_title: productTitle,
      product_image_url: productImage,
      product_url: productUrl,
      price,
      cj_sourcing_id: cjSourcingId ? String(cjSourcingId) : '',
      raw_create_response: json,
      updated_at: new Date().toISOString()
    });

    return res.status(200).json({
      ok: true,
      cjSourcingId,
      sourcingRequestId: saved?.id || null,
      response: json
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
