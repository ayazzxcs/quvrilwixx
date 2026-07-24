const crypto = require('crypto');

const ALIEXPRESS_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://quvirl.com';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function tokenHash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function normalizeShop(shop) {
  shop = clean(shop).toLowerCase();
  shop = shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  if (!shop) return '';

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
    .createHmac('sha256', ALIEXPRESS_APP_SECRET)
    .update(encoded)
    .digest('hex');

  return `${encoded}.${sig}`;
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

module.exports = async function handler(req, res) {
  try {
    if (!ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET) {
      return res.status(500).send('Missing AliExpress app credentials');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send('Missing Supabase environment variables');
    }

    const shop = normalizeShop(req.query.shop);
    const installToken = clean(req.query.installToken);
    const returnUrl = clean(req.query.returnUrl) || SHOPIFY_APP_URL;

    if (!shop || !installToken) {
      return res.status(400).send('Missing shop or installToken');
    }

    const store = await getShopifyStore(shop, installToken);

    if (!store) {
      return res.status(401).send('Shopify store is not connected or token is invalid');
    }

    const redirectUri = `${SHOPIFY_APP_URL}/api/aliexpress/callback`;

    const state = signState({
      shop,
      installTokenHash: tokenHash(installToken),
      returnUrl,
      ts: Date.now()
    });

    const authUrl =
      'https://oauth.aliexpress.com/authorize' +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(ALIEXPRESS_APP_KEY)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&view=web` +
      `&sp=ae`;

    return res.redirect(authUrl);
  } catch (error) {
    return res.status(500).send(error.message || String(error));
  }
};
