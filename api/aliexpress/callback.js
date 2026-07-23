const crypto = require('crypto');

const ALIEXPRESS_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const ALIEXPRESS_CALLBACK_URL =
  process.env.ALIEXPRESS_CALLBACK_URL || 'https://quvirl.com/api/aliexpress/callback';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TOKEN_URL = 'https://oauth.aliexpress.com/token';

async function exchangeCodeForToken(code) {
  const params = {
    grant_type: 'authorization_code',
    client_id: ALIEXPRESS_APP_KEY,
    client_secret: ALIEXPRESS_APP_SECRET,
    code,
    redirect_uri: ALIEXPRESS_CALLBACK_URL
  };

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      Accept: 'application/json'
    },
    body: new URLSearchParams(params)
  });

  const text = await response.text();

  let json = null;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      rawText: text || '[EMPTY RESPONSE]'
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    json
  };
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

  return text;
}

module.exports = async function handler(req, res) {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).send('Missing AliExpress authorization code');
    }

    if (
      !ALIEXPRESS_APP_KEY ||
      !ALIEXPRESS_APP_SECRET ||
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).send('Missing required environment variables');
    }

    const tokenResult = await exchangeCodeForToken(String(code));

    if (!tokenResult.ok || !tokenResult.json || !tokenResult.json.access_token) {
      return res.status(500).send(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>AliExpress Token Debug - Quvirl</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                background: #020617;
                color: #e5eefb;
                padding: 32px;
              }
              .card {
                max-width: 900px;
                margin: 40px auto;
                background: #0f172a;
                border: 1px solid #7f1d1d;
                border-radius: 20px;
                padding: 24px;
              }
              pre {
                white-space: pre-wrap;
                word-break: break-word;
                background: #020617;
                border: 1px solid #334155;
                padding: 14px;
                border-radius: 12px;
                color: #fecaca;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>AliExpress token exchange failed</h1>
              <p><strong>Request URL:</strong> ${TOKEN_URL}</p>
              <p><strong>Status:</strong> ${tokenResult.status}</p>
              <p><strong>Content-Type:</strong> ${tokenResult.contentType || ''}</p>
              <h3>Response</h3>
              <pre>${JSON.stringify(tokenResult.json || tokenResult.rawText, null, 2)}</pre>
            </div>
          </body>
        </html>
      `);
    }

    await saveAliExpressConnection(tokenResult.json);

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
          <pre>${String(error.stack || error.message)}</pre>
        </body>
      </html>
    `);
  }
};
