const crypto = require('crypto');

const ALIEXPRESS_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const API_BASE = 'https://api-sg.aliexpress.com/rest';
const TOKEN_PATH = '/auth/token/create';

function timestamp() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');

  return (
    d.getUTCFullYear() +
    '-' +
    pad(d.getUTCMonth() + 1) +
    '-' +
    pad(d.getUTCDate()) +
    ' ' +
    pad(d.getUTCHours()) +
    ':' +
    pad(d.getUTCMinutes()) +
    ':' +
    pad(d.getUTCSeconds())
  );
}

function signRequest(apiPath, params, secret) {
  const sorted = Object.keys(params)
    .sort()
    .filter((key) => key !== 'sign')
    .map((key) => key + params[key])
    .join('');

  const stringToSign = apiPath + sorted;

  return crypto
    .createHmac('sha256', secret.trim())
    .update(stringToSign)
    .digest('hex')
    .toUpperCase();
}

function encodeQuery(params) {
  return Object.keys(params)
    .map((key) => {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    })
    .join('&');
}

async function exchangeCodeForToken(code) {
  const params = {
    app_key: ALIEXPRESS_APP_KEY.trim(),
    code: String(code),
    format: 'json',
    sign_method: 'sha256',
    timestamp: timestamp(),
    v: '2.0'
  };

  params.sign = signRequest(TOKEN_PATH, params, ALIEXPRESS_APP_SECRET);

  const queryString = encodeQuery(params);

  const requestUrl = API_BASE + TOKEN_PATH + '?' + queryString;
  
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json'
    }
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      'AliExpress token response was not JSON. Status: ' +
        response.status +
        '. Timestamp sent: ' +
        params.timestamp +
        '. Request URL: ' +
        requestUrl +
        '. Raw: ' +
        (text || '[EMPTY RESPONSE]')
    );
  }

  if (!response.ok || json.error_response || json.error_code || json.code) {
    throw new Error(
      'Timestamp sent: ' +
        params.timestamp +
        '\nRequest URL: ' +
        requestUrl +
        '\nError: ' +
        JSON.stringify(json, null, 2)
    );
  }

  return json;
}

function tokenExpiry(seconds) {
  const n = Number(seconds || 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Date.now() + n * 1000).toISOString();
}

async function saveConnection(tokenJson) {
  const accessToken = tokenJson.access_token;

  if (!accessToken) {
    throw new Error('No access_token returned: ' + JSON.stringify(tokenJson));
  }

  const payload = {
    aliexpress_user_id: tokenJson.user_id ? String(tokenJson.user_id) : null,
    seller_id: tokenJson.seller_id ? String(tokenJson.seller_id) : null,
    account_id: tokenJson.account_id ? String(tokenJson.account_id) : null,
    access_token: accessToken,
    refresh_token: tokenJson.refresh_token || null,
    token_expires_at: tokenExpiry(tokenJson.expires_in),
    refresh_token_expires_at: tokenExpiry(tokenJson.refresh_expires_in),
    scope: tokenJson.sp || tokenJson.scope || null,
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
    throw new Error('Supabase save failed: ' + text);
  }
}

module.exports = async function handler(req, res) {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).send('Missing AliExpress authorization code');
    }

    if (!ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send('Missing required environment variables');
    }

    const tokenJson = await exchangeCodeForToken(code);
    await saveConnection(tokenJson);

    return res.status(200).send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>AliExpress Connected - Quvirl</title>
          <style>
            body { font-family: Arial, sans-serif; background:#020617; color:#e5eefb; padding:32px; }
            .card { max-width:720px; margin:40px auto; background:#0f172a; border:1px solid #334155; border-radius:20px; padding:24px; }
            .ok { color:#86efac; font-weight:800; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>AliExpress connected</h1>
            <p class="ok">Access token saved successfully.</p>
            <p>You can close this page and continue setup.</p>
            <p>State: ${String(state || '')}</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).send(`
      <!doctype html>
      <html>
        <body style="background:#020617;color:#fecaca;font-family:Arial;padding:32px;">
          <h1>AliExpress connection error</h1>
          <pre style="white-space:pre-wrap;word-break:break-word;">${String(error.stack || error.message)}</pre>
        </body>
      </html>
    `);
  }
};
