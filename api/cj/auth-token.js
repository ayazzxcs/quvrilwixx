const CJ_API_KEY = process.env.CJ_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CJ_AUTH_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken';

function maskApiKey(apiKey) {
  const value = String(apiKey || '');

  if (value.length <= 10) {
    return '***';
  }

  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}

async function saveCJConnection(cjResponse) {
  const data = cjResponse.data || {};

  const payload = {
    api_key_masked: maskApiKey(CJ_API_KEY),
    open_id: data.openId ? String(data.openId) : '',
    access_token: data.accessToken || '',
    access_token_expiry_date: data.accessTokenExpiryDate || null,
    refresh_token: data.refreshToken || '',
    refresh_token_expiry_date: data.refreshTokenExpiryDate || null,
    raw_response: cjResponse,
    updated_at: new Date().toISOString()
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/cj_connections`, {
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
    throw new Error('Failed to save CJ connection: ' + text);
  }

  return Array.isArray(rows) ? rows[0] : null;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed'
      });
    }

    if (!CJ_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Missing CJ_API_KEY or Supabase environment variables'
      });
    }

    const response = await fetch(CJ_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey: CJ_API_KEY
      })
    });

    const json = await response.json();

    if (!response.ok || json.success === false || json.code !== 200) {
      return res.status(400).json({
        ok: false,
        error: json
      });
    }

    const saved = await saveCJConnection(json);

    return res.status(200).json({
      ok: true,
      connectionId: saved?.id || null,
      openId: json.data?.openId || null,
      accessTokenExpiryDate: json.data?.accessTokenExpiryDate || null,
      refreshTokenExpiryDate: json.data?.refreshTokenExpiryDate || null
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
