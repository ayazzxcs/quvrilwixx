const crypto = require('crypto');

const ALIEXPRESS_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const ALIEXPRESS_API_BASE = process.env.ALIEXPRESS_API_BASE || 'https://api-sg.aliexpress.com';

const TOKEN_PATH = '/auth/token/security/create';

function makeAliExpressSign(path, params, appSecret) {
  const sorted = Object.keys(params)
    .sort()
    .filter((key) => key !== 'sign')
    .map((key) => `${key}${params[key]}`)
    .join('');

  const signString = path + sorted;

  return crypto
    .createHmac('sha256', appSecret)
    .update(signString)
    .digest('hex')
    .toUpperCase();
}

async function tryTokenExchange(code, uuid) {
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
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      'Accept': 'application/json'
    },
    body
  });

  const text = await response.text();

  return {
    requestUrl: `${ALIEXPRESS_API_BASE}${TOKEN_PATH}`,
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get('content-type') || '',
    rawText: text
  };
}

module.exports = async function handler(req, res) {
  try {
    const { code, state, uuid } = req.query;

    if (!code) {
      return res.status(400).send('Missing AliExpress authorization code');
    }

    if (!ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET) {
      return res.status(500).send('Missing ALIEXPRESS_APP_KEY or ALIEXPRESS_APP_SECRET');
    }

    const result = await tryTokenExchange(String(code), uuid ? String(uuid) : '');

    return res.status(200).send(`
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
              border: 1px solid #334155;
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
              color: #86efac;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>AliExpress Token Debug</h1>
            <p><strong>Request URL:</strong> ${result.requestUrl}</p>
            <p><strong>Status:</strong> ${result.status} ${result.statusText}</p>
            <p><strong>Content-Type:</strong> ${result.contentType}</p>
            <p><strong>State:</strong> ${String(state || '')}</p>
            <p><strong>UUID:</strong> ${String(uuid || '')}</p>
            <h3>Raw response</h3>
            <pre>${String(result.rawText || '[EMPTY RESPONSE]')}</pre>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).send(`
      <!doctype html>
      <html>
        <body style="background:#020617;color:#fecaca;font-family:Arial;padding:32px;">
          <h1>AliExpress Debug Error</h1>
          <pre>${String(error.stack || error.message)}</pre>
        </body>
      </html>
    `);
  }
};
