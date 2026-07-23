const crypto = require('crypto');

const ALIEXPRESS_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const ALIEXPRESS_API_BASE = process.env.ALIEXPRESS_API_BASE || 'https://api-sg.aliexpress.com';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TOKEN_PATH = '/auth/token/security/create';

function makeAliExpressSign(path, params, appSecret) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('');

  const signString = path + sorted;

  return crypto
    .createHmac('sha256', appSecret)
    .update(signString)
    .digest('hex')
    .toUpperCase();
}

async function exchangeCodeForToken(code, uuid) {
  const params = {
    app_key: ALIEXPRESS_APP_KEY,
    code,
    sign_method: 'sha256',
    timestamp: Date.now().toString()
  };

  if (uuid) {
    params.uuid = uuid;
  }

  params.sign = makeAliExpressSign(TOKEN_PATH, params, ALIEXPRESS_APP_SECRET);

  const body = new URLSearchParams(params);

  const response = await fetch(`${ALIEXPRESS_API_BASE}${TOKEN_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
    },
    body
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`AliExpress token response was not JSON: ${text}`);
  }

  if (!response.ok || json.error_response || json.error_code || json.code) {
    throw new Error(`AliExpress token exchange failed: ${JSON.stringify(json)}`);
  }

  return json;
}

function tokenExpiry(expiresInSeconds) {
  const seconds = Number(expiresInSeconds || 0);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function saveAliExpressConnection(tokenJson) {
  const accessToken = tokenJson.access_token;
  const refreshToken = tokenJson.refresh_token || null;

  if (!accessToken) {
    throw new Error(`No access_token returned by AliExpress: ${JSON.stringify(tokenJson)}`);
  }

  const payload = {
    aliexpress_user_id: tokenJson.user_id ? String(tokenJson.user_id) : null,
    seller_id: tokenJson.seller_id ? String(tokenJson.seller_id) : null,
    account_id: tokenJson.account_id ? String(tokenJson.account_id) : null,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: tokenExpiry(tokenJson.expires_in),
    refresh_token_expires_at: tokenExpiry(tokenJson.refresh_expires_in),
    scope: tokenJson.sp || null,
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

  if (!response.ok) {
    throw new Error(`Supabase save failed: ${text}`);
  }

  return text;
}

module.exports = async function handler(req, res) {
  try {
    if (
      !ALIEXPRESS_APP_KEY ||
      !ALIEXPRESS_APP_SECRET ||
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).send('Missing required environment variables');
    }

    const { code, state, uuid } = req.query;

    if (!code) {
      return res.status(400).send('Missing AliExpress authorization code');
    }

    const tokenJson = await exchangeCodeForToken(String(code), uuid ? String(uuid) : '');

    await saveAliExpressConnection(tokenJson);

    return res.status(200).send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>AliExpress Connected - Quvirl</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: #020617;
              color: #e5eefb;
              padding: 32px;
            }
            .card {
              max-width: 720px;
              margin: 40px auto;
              background: #0f172a;
              border: 1px solid #334155;
              border-radius: 20px;
              padding: 24px;
            }
            .ok {
              color: #86efac;
              font-weight: 800;
            }
            .muted {
              color: #94a3b8;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>AliExpress connected</h1>
            <p class="ok">Authorization code exchanged successfully.</p>
            <p class="muted">
              Quvirl has saved the AliExpress access token securely in Supabase.
              You can close this page and continue setup.
            </p>
            <p class="muted">State: ${String(state || '')}</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>AliExpress Connection Error - Quvirl</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: #020617;
              color: #e5eefb;
              padding: 32px;
            }
            .card {
              max-width: 820px;
              margin: 40px auto;
              background: #0f172a;
              border: 1px solid #7f1d1d;
              border-radius: 20px;
              padding: 24px;
            }
            pre {
              white-space: pre-wrap;
              word-break: break-word;
              background: #111827;
              border-radius: 12px;
              padding: 14px;
              color: #fecaca;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>AliExpress connection failed</h1>
            <p>Copy this error and send it back so we can adjust the token exchange request.</p>
            <pre>${String(error.message)}</pre>
          </div>
        </body>
      </html>
    `);
  }
};
