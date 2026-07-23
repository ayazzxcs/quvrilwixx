const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CJ_REFRESH_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/authentication/refreshAccessToken';

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

  if (!response.ok || !rows.length || !rows[0].refresh_token) {
    throw new Error('No CJ refresh token found in Supabase');
  }

  return rows[0];
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

    const connection = await getLatestCJConnection();

    const response = await fetch(CJ_REFRESH_URL, {
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
      return res.status(400).json({
        ok: false,
        error: json
      });
    }

    await updateCJConnection(connection.id, json);

    return res.status(200).json({
      ok: true,
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
