const CJ_API_KEY = process.env.CJ_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CJ_GET_TOKEN_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken';

const CJ_REFRESH_TOKEN_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/authentication/refreshAccessToken';

function maskApiKey(apiKey) {
  const value = String(apiKey || '');

  if (value.length <= 10) {
    return '***';
  }

  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}

async function getLatestCJConnection() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cj_connections?select=*&order=created_at.desc&limit=1`,
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

  return rows[0];
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

async function updateCJConnection(id, cjResponse) {
  const data = cjResponse.data || {};

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cj_connections?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        access_token: data.accessToken || '',
        access_token_expiry_date: data.accessTokenExpiryDate || null,
        refresh_token: data.refreshToken || '',
        refresh_token_expiry_date: data.refreshTokenExpiryDate || null,
        raw_response: cjResponse,
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error('Failed to update CJ connection: ' + text);
  }
}

async function getAccessToken() {
  if (!CJ_API_KEY) {
    throw new Error('Missing CJ_API_KEY');
  }

  const response = await fetch(CJ_GET_TOKEN_URL, {
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
    return {
      ok: false,
      error: json
    };
  }

  const saved = await saveCJConnection(json);

  return {
    ok: true,
    action: 'get',
    connectionId: saved?.id || null,
    openId: json.data?.openId || null,
    accessTokenExpiryDate: json.data?.accessTokenExpiryDate || null,
    refreshTokenExpiryDate: json.data?.refreshTokenExpiryDate || null
  };
}

async function refreshAccessToken() {
  const connection = await getLatestCJConnection();

  if (!connection || !connection.refresh_token) {
    throw new Error('No CJ refresh token found in Supabase. Run action=get first.');
  }

  const response = await fetch(CJ_REFRESH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: connection.refresh_token
    })
  });

  const json = await response.json();

  if (!response.ok || json.success === false || json.code !== 200) {
    return {
      ok: false,
      error: json
    };
  }

  await updateCJConnection(connection.id, json);

  return {
    ok: true,
    action: 'refresh',
    connectionId: connection.id,
    accessTokenExpiryDate: json.data?.accessTokenExpiryDate || null,
    refreshTokenExpiryDate: json.data?.refreshTokenExpiryDate || null
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed'
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Missing Supabase environment variables'
      });
    }

    const action = String(req.body?.action || 'get').toLowerCase();

    let result;

    if (action === 'refresh') {
      result = await refreshAccessToken();
    } else {
      result = await getAccessToken();
    }

    const status = result.ok ? 200 : 400;

    return res.status(status).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
