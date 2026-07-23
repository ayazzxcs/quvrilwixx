const crypto = require('crypto');

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://quvirl.com';

const SHOPIFY_SCOPES =
  process.env.SHOPIFY_SCOPES ||
  'read_products,write_products,read_orders';

function normalizeShop(shop) {
  shop = String(shop || '').trim().toLowerCase();
  shop = shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  if (!shop.endsWith('.myshopify.com')) {
    shop = `${shop}.myshopify.com`;
  }

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    return '';
  }

  return shop;
}

function signState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const sig = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(encoded)
    .digest('hex');

  return `${encoded}.${sig}`;
}

module.exports = async function handler(req, res) {
  try {
    const shop = normalizeShop(req.query.shop);
    const returnUrl = String(req.query.returnUrl || SHOPIFY_APP_URL);

    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      return res.status(500).send('Missing Shopify app secrets');
    }

    if (!shop) {
      return res.status(400).send('Invalid Shopify shop domain');
    }

    const redirectUri = `${SHOPIFY_APP_URL}/api/shopify/callback`;

    const state = signState({
      shop,
      returnUrl,
      ts: Date.now()
    });

    const authUrl =
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${encodeURIComponent(SHOPIFY_API_KEY)}` +
      `&scope=${encodeURIComponent(SHOPIFY_SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`;

    return res.redirect(authUrl);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
