const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CJ_GET_TOKEN_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken';

const CJ_REFRESH_TOKEN_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/authentication/refreshAccessToken';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function tokenHash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function maskApiKey(apiKey) {
  const value = String(apiKey || '');

  if (value.length <= 10) {
    return '***';
  }

  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}

async function getShopifyStore(shop, installToken) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shopify_stores?shop_domain=eq.${encodeURIComponent(shop)}&select=*`,
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

  const store = rows[0];

  if (store.install_token_hash !== tokenHash(installToken)) {
    return null;
  }

  return store;
}

async function getLatestCJConnectionForShop(shop) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cj_connections?shop_domain=eq.${encodeURIComponent(shop)}&select=*&order=updated_at.desc&limit=1`,
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

async function saveCJConnection({ shop, installToken, apiKey, cjResponse }) {
  const data = cjResponse.data || {};

  const payload = {
    shop_domain: shop,
    install_token_hash: tokenHash(installToken),
    api_key_masked: maskApiKey(apiKey),
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

async function connectCJ({ shop, installToken, apiKey }) {
  const store = await getShopifyStore(shop, installToken);

  if (!store) {
    return {
      ok: false,
      error: 'Shopify store is not connected or token is invalid'
    };
  }

  const response = await fetch(CJ_GET_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiKey
    })
  });

  const json = await response.json();

  if (!response.ok || json.success === false || json.result === false || json.code !== 200) {
    return {
      ok: false,
      error: json
    };
  }

  const saved = await saveCJConnection({
    shop,
    installToken,
    apiKey,
    cjResponse: json
  });

  return {
    ok: true,
    action: 'connect',
    connectionId: saved?.id || null,
    shop,
    openId: json.data?.openId || null,
    accessTokenExpiryDate: json.data?.accessTokenExpiryDate || null,
    refreshTokenExpiryDate: json.data?.refreshTokenExpiryDate || null
  };
}

async function refreshCJ({ shop, installToken }) {
  const store = await getShopifyStore(shop, installToken);

  if (!store) {
    return {
      ok: false,
      error: 'Shopify store is not connected or token is invalid'
    };
  }

  const connection = await getLatestCJConnectionForShop(shop);

  if (!connection || !connection.refresh_token) {
    return {
      ok: false,
      error: 'No CJ connection found for this Shopify store'
    };
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

  if (!response.ok || json.success === false || json.result === false || json.code !== 200) {
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
    shop,
    accessTokenExpiryDate: json.data?.accessTokenExpiryDate || null,
    refreshTokenExpiryDate: json.data?.refreshTokenExpiryDate || null
  };
}

async function statusCJ({ shop, installToken }) {
  const store = await getShopifyStore(shop, installToken);

  if (!store) {
    return {
      ok: false,
      connected: false,
      error: 'Shopify store is not connected or token is invalid'
    };
  }

  const connection = await getLatestCJConnectionForShop(shop);

  return {
    ok: true,
    connected: Boolean(connection?.access_token),
    shop,
    apiKeyMasked: connection?.api_key_masked || '',
    openId: connection?.open_id || '',
    accessTokenExpiryDate: connection?.access_token_expiry_date || null,
    refreshTokenExpiryDate: connection?.refresh_token_expiry_date || null
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
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

    const body = req.body || {};
    const query = req.query || {};

    const action = clean(body.action || query.action || 'status').toLowerCase();
    const shop = clean(body.shop || query.shop);
    const installToken = clean(body.installToken || query.installToken);
    const apiKey = clean(body.apiKey || query.apiKey);

    if (!shop || !installToken) {
      return res.status(400).json({
        ok: false,
        error: 'Missing shop or installToken'
      });
    }

    let result;

    if (action === 'connect') {
      if (!apiKey) {
        return res.status(400).json({
          ok: false,
          error: 'Missing CJ API key'
        });
      }

      result = await connectCJ({
        shop,
        installToken,
        apiKey
      });
    } else if (action === 'refresh') {
      result = await refreshCJ({
        shop,
        installToken
      });
    } else {
      result = await statusCJ({
        shop,
        installToken
      });
    }

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
