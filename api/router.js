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

  'cj/token': require('../lib/api/cj/token'),
  'cj/search-products': require('../lib/api/cj/search-products'),
  'cj/product-details': require('../lib/api/cj/product-details'),
  'cj/create-sourcing': require('../lib/api/cj/create-sourcing'),
  'cj/query-sourcing': require('../lib/api/cj/query-sourcing')
};

function getRoutePath(req) {
  const rawQueryPath = req.query && req.query.path ? req.query.path : '';

  if (Array.isArray(rawQueryPath)) {
    return rawQueryPath.join('/');
  }

  if (rawQueryPath) {
    return String(rawQueryPath).replace(/^\/+|\/+$/g, '');
  }

  const urlWithoutQuery = String(req.url || '').split('?')[0];

  return urlWithoutQuery
    .replace(/^\/api\/router\/?/, '')
    .replace(/^\/api\/?/, '')
    .replace(/^\/+|\/+$/g, '');
}

function removeRouterOnlyQueryParams(req) {
  if (!req.query) return;

  delete req.query.path;
}

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function parseBodyForRoute(req, routePath) {
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

    removeRouterOnlyQueryParams(req);

    await parseBodyForRoute(req, routePath);

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
