const crypto = require('crypto');

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://quvirl.com';
const SHOPIFY_WEBHOOK_URL_SECRET = process.env.SHOPIFY_WEBHOOK_URL_SECRET || '';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function verifyState(state) {
  const parts = String(state || '').split('.');

  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;

  const expected = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(encoded)
    .digest('hex');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
}

function verifyShopifyHmac(query) {
  const { hmac, signature, ...rest } = query;

  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((key) => {
      const value = Array.isArray(rest[key]) ? rest[key].join(',') : rest[key];
      return `${key}=${value}`;
    })
    .join('&');

  const digest = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(digest));
  } catch {
    return false;
  }
}

async function saveShop({ shop, accessToken, scope, installToken }) {
  const installTokenHash = crypto
    .createHash('sha256')
    .update(installToken)
    .digest('hex');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/shopify_stores`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      shop_domain: shop,
      access_token: accessToken,
      scope,
      install_token_hash: installTokenHash,
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function shopifyGraphql(shop, accessToken, query, variables = {}) {
  const endpoint = `https://${shop}/admin/api/2026-07/graphql.json`;

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
    throw new Error(JSON.stringify(json));
  }

  return json.data;
}

function orderPaidWebhookUri() {
  const base = `${SHOPIFY_APP_URL}/api/shopify/webhooks/order-paid`;

  if (!SHOPIFY_WEBHOOK_URL_SECRET) {
    return base;
  }

  return `${base}?secret=${encodeURIComponent(SHOPIFY_WEBHOOK_URL_SECRET)}`;
}

async function registerOrderPaidWebhook(shop, accessToken) {
  const mutation = `
    mutation webhookSubscriptionCreate(
      $topic: WebhookSubscriptionTopic!,
      $webhookSubscription: WebhookSubscriptionInput!
    ) {
      webhookSubscriptionCreate(
        topic: $topic,
        webhookSubscription: $webhookSubscription
      ) {
        webhookSubscription {
          id
          topic
          uri
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyGraphql(shop, accessToken, mutation, {
    topic: 'ORDERS_PAID',
    webhookSubscription: {
      uri: orderPaidWebhookUri(),
      format: 'JSON'
    }
  });

  const errors = data.webhookSubscriptionCreate?.userErrors || [];

  if (errors.length) {
    console.log('Webhook registration errors:', JSON.stringify(errors));
  }

  return data.webhookSubscriptionCreate?.webhookSubscription || null;
}

module.exports = async function handler(req, res) {
  try {
    if (
      !SHOPIFY_API_KEY ||
      !SHOPIFY_API_SECRET ||
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).send('Missing environment variables');
    }

    if (!verifyShopifyHmac(req.query)) {
      return res.status(401).send('Invalid Shopify HMAC');
    }

    const { shop, code, state, scope } = req.query;

    const verifiedState = verifyState(state);

    if (!verifiedState || verifiedState.shop !== shop) {
      return res.status(401).send('Invalid OAuth state');
    }

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code
      })
    });

    const tokenJson = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenJson.access_token) {
      return res.status(400).send(JSON.stringify(tokenJson));
    }

    const installToken = crypto.randomBytes(32).toString('hex');

    await saveShop({
      shop,
      accessToken: tokenJson.access_token,
      scope: tokenJson.scope || scope || '',
      installToken
    });

    await registerOrderPaidWebhook(shop, tokenJson.access_token);

    const returnUrl = verifiedState.returnUrl || SHOPIFY_APP_URL;
    const separator = returnUrl.includes('?') ? '&' : '?';

    return res.redirect(
      `${returnUrl}${separator}shopify_connected=${encodeURIComponent(shop)}&qv_shopify_token=${encodeURIComponent(installToken)}`
    );
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
