const crypto = require('cryptoprocess.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://quvirl.com';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALIEXPRESS_TOKEN_URL = 'https://oauth.aliexpress.com/token';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function verifyState(state) {
  const parts = String(state || '').split('.');

  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;

  const expected = crypto
    .createHmac('sha256', ALIEXPRESS_APP_SECRET)
    .update(encoded)
    .digest('hex');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function saveAliExpressConnection({ shop, installTokenHash, tokenJson }) {
  const payload = {
    shop_domain: shop,
    install_token_hash: installTokenHash,

    access_token:
      tokenJson.access_token ||
      tokenJson.accessToken ||
      tokenJson.data?.access_token ||
      tokenJson.data?.accessToken ||
      '',

    refresh_token:
      tokenJson.refresh_token ||
      tokenJson.refreshToken ||
      tokenJson.data?.refresh_token ||
      tokenJson.data?.refreshToken ||
      '',

    expire_time:
      tokenJson.expire_time ||
      tokenJson.expireTime ||
      tokenJson.data?.expire_time ||
      tokenJson.data?.expireTime ||
      null,

    refresh_token_valid_time:
      tokenJson.refresh_token_valid_time ||
      tokenJson.refreshTokenValidTime ||
      tokenJson.data?.refresh_token_valid_time ||
      tokenJson.data?.refreshTokenValidTime ||
      null,

    raw_response: tokenJson,
    updated_at: new Date().toISOString()
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/aliexpress_connections`, {
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
    throw new Error('Failed to save AliExpress connection: ' + text);
  }

  return Array.isArray(rows) ? rows[0] : null;
}

module.exports = async function handler(req, res) {
  try {
    if (!ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET) {
      return res.status(500).send('Missing AliExpress app credentials');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send('Missing Supabase environment variables');
    }

    const code = clean(req.query.code);
    const state = clean(req.query.state);

    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }

    const verifiedState = verifyState(state);

    if (!verifiedState || !verifiedState.shop || !verifiedState.installTokenHash) {
      return res.status(401).send('Invalid AliExpress OAuth state');
    }

    const redirectUri = `${SHOPIFY_APP_URL}/api/aliexpress/callback`;

    const tokenResponse = await fetch(ALIEXPRESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: ALIEXPRESS_APP_KEY,
        client_secret: ALIEXPRESS_APP_SECRET,
        redirect_uri: redirectUri
      }).toString()
    });

    const tokenText = await tokenResponse.text();

    let tokenJson;
    try {
      tokenJson = JSON.parse(tokenText);
    } catch {
      tokenJson = {
        raw: tokenText
      };
    }

    const accessToken =
      tokenJson.access_token ||
      tokenJson.accessToken ||
      tokenJson.data?.access_token ||
      tokenJson.data?.accessToken;

    if (!tokenResponse.ok || !accessToken) {
      return res.status(400).send(JSON.stringify(tokenJson));
    }

    await saveAliExpressConnection({
      shop: verifiedState.shop,
      installTokenHash: verifiedState.installTokenHash,
      tokenJson
    });

    const returnUrl = verifiedState.returnUrl || SHOPIFY_APP_URL;
    const separator = returnUrl.includes('?') ? '&' : '?';

    return res.redirect(
      `${returnUrl}${separator}aliexpress_connected=${encodeURIComponent(verifiedState.shop)}`
    );
  } catch (error) {
    return res.status(500).send(error.message || String(error));
  }
};
