const crypto = require('crypto');

const ALIEXPRESS_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://quvirl.com';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALIEXPRESS_REST_URL = 'https://api-sg.aliexpress.com/rest';
const ALIEXPRESS_TOKEN_API = '/auth/token/create';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function signIopRequest(params, secret, apiPath) {
  const sorted = Object.keys(params)
    .sort()
    .filter((key) => key !== 'sign')
    .map((key) => key + params[key])
    .join('');

  const signBase = `${apiPath}${sorted}`;

  return crypto
    .createHmac('sha256', clean(secret))
    .update(signBase)
    .digest('hex')
    .toUpperCase();
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
      tokenJson.access_token_response?.access_token ||
      '',

    refresh_token:
      tokenJson.refresh_token ||
      tokenJson.refreshToken ||
      tokenJson.data?.refresh_token ||
      tokenJson.data?.refreshToken ||
      tokenJson.access_token_response?.refresh_token ||
      '',

    expire_time:
      tokenJson.expire_time ||
      tokenJson.expireTime ||
      tokenJson.data?.expire_time ||
      tokenJson.data?.expireTime ||
      tokenJson.access_token_response?.expire_time ||
      null,

    refresh_token_valid_time:
      tokenJson.refresh_token_valid_time ||
      tokenJson.refreshTokenValidTime ||
      tokenJson.data?.refresh_token_valid_time ||
      tokenJson.data?.refreshTokenValidTime ||
      tokenJson.access_token_response?.refresh_token_valid_time ||
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

async function exchangeCodeForToken(code) {
  const params = {
    app_key: clean(ALIEXPRESS_APP_KEY),
    code: clean(code),
    sign_method: 'sha256',
    timestamp: Date.now().toString()
  };

  params.sign = signIopRequest(params, ALIEXPRESS_APP_SECRET, ALIEXPRESS_TOKEN_API);

  const response = await fetch(`${ALIEXPRESS_REST_URL}${ALIEXPRESS_TOKEN_API}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      Accept: 'application/json'
    },
    body: new URLSearchParams(params)
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('AliExpress token response was not JSON: ' + (text || '[EMPTY RESPONSE]'));
  }

  return {
    response,
    json
  };
}

function extractAccessToken(tokenJson) {
  return (
    tokenJson.access_token ||
    tokenJson.accessToken ||
    tokenJson.data?.access_token ||
    tokenJson.data?.accessToken ||
    tokenJson.access_token_response?.access_token ||
    tokenJson.token_result?.access_token ||
    tokenJson.result?.access_token ||
    ''
  );
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

    const { response, json } = await exchangeCodeForToken(code);
    const accessToken = extractAccessToken(json);

    if (!response.ok || !accessToken) {
      return res.status(400).send(JSON.stringify(json));
    }

    await saveAliExpressConnection({
      shop: verifiedState.shop,
      installTokenHash: verifiedState.installTokenHash,
      tokenJson: json
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
