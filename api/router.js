const routes = {
  'shopify/auth': require('../lib/api/shopify/auth'),
  'shopify/callback': require('../lib/api/shopify/callback'),
  'shopify/add-product': require('../lib/api/shopify/add-product'),
  'shopify/webhooks/order-paid': require('../lib/api/shopify/webhooks/order-paid'),

  'aliexpress/auth': require('../lib/api/aliexpress/auth'),
  'aliexpress/callback': require('../lib/api/aliexpress/callback'),
  'aliexpress/search-options': require('../lib/api/aliexpress/search-options'),
  'aliexpress/product-details': require('../lib/api/aliexpress/product-details'),
  'aliexpress/create-order': require('../lib/api/aliexpress/create-order'),

  'cj/token': require('../lib/api/cj/token')
};

function getRoutePath(req) {
  const raw = req.query?.path || '';

  if (Array.isArray(raw)) {
    return raw.join('/');
  }

  return String(raw || '').replace(/^\/+|\/+$/g, '');
}

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function parseBodyForNormalRoutes(req, routePath) {
  if (routePath === 'shopify/webhooks/order-paid') {
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    req.body = {};
    return;
  }

  const rawBodyBuffer = await readRawBody(req);
  const rawBody = rawBodyBuffer.toString('utf8');

  req.rawBody = rawBody;

  if (!rawBody) {
    req.body = {};
    return;
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();

  if (contentType.includes('application/json')) {
    try {
      req.body = JSON.parse(rawBody);
    } catch {
      req.body = {};
    }

    return;
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    req.body = Object.fromEntries(new URLSearchParams(rawBody));
    return;
  }

  req.body = rawBody;
}

module.exports = async function router(req, res) {
  try {
    const routePath = getRoutePath(req);
    const handler = routes[routePath];

    if (!handler) {
      return res.status(404).json({
        ok: false,
        error: 'API route not found',
        route: routePath
      });
    }

    await parseBodyForNormalRoutes(req, routePath);

    return handler(req, res);
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
