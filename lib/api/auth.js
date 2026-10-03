const {
  cors, send, requireEnv, normalizeEmail, validEmail
} = require('../slot-utils');

/**
 * Handle user registration (Sign Up) with Supabase Auth.
 * Supabase automatically dispatches the verification email with a confirmation link.
 */
async function signup(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'Use POST.' });

  const cfg = requireEnv(res, { requireAnon: true });
  if (!cfg) return;

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const email = normalizeEmail(body.email);
    const password = String(body.password || '').trim();
    const name = String(body.name || '').trim() || email.split('@')[0];
    const channel = String(body.channel || 'Shopify Dropshipping').trim();

    if (!validEmail(email)) {
      return send(res, 400, { ok: false, code: 'bad_email', message: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 6) {
      return send(res, 400, { ok: false, code: 'bad_password', message: 'Password must be at least 6 characters.' });
    }

    const siteUrl = cfg.siteUrl || `https://${req.headers.host || 'quvirl.com'}`;
    const redirectTo = `${siteUrl}/slot-verify.html`;

    const signupUrl = `${cfg.supabaseUrl}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`;
    const authRes = await fetch(signupUrl, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          name,
          channel,
          source: 'quvirl_signup',
          registered_at: new Date().toISOString()
        }
      })
    });

    const text = await authRes.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) { data = text; }

    if (!authRes.ok) {
      const errMsg = (data && (data.msg || data.message || data.error_description)) || 'Could not complete signup.';
      const lower = errMsg.toLowerCase();

      if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('unique constraint')) {
        return send(res, 409, {
          ok: false,
          code: 'user_already_exists',
          message: 'An account with this email already exists. Please switch to the Sign In tab.'
        });
      }

      return send(res, authRes.status, {
        ok: false,
        code: 'auth_error',
        message: errMsg
      });
    }

    // Check if auto-confirmed (e.g. if email confirmation is disabled in Supabase)
    const hasSession = !!(data && (data.access_token || data.session));
    const isConfirmed = !!(data && data.user && data.user.confirmed_at);

    if (hasSession && isConfirmed) {
      return send(res, 200, {
        ok: true,
        verificationRequired: false,
        accessToken: data.access_token || data.session?.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || name,
          channel: data.user.user_metadata?.channel || channel
        },
        message: 'Account created and verified. Launching Quvirl Product Radar...'
      });
    }

    // Real verification email dispatched by Supabase
    return send(res, 200, {
      ok: true,
      verificationRequired: true,
      email,
      message: `A verification email has been dispatched to ${email}. Please check your inbox and click the confirmation link to activate your access.`
    });
  } catch (err) {
    console.error('Signup error:', err);
    return send(res, 500, { ok: false, message: err.message || 'Could not process signup request.' });
  }
}

/**
 * Handle user authentication (Sign In) with Supabase Auth.
 */
async function signin(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'Use POST.' });

  const cfg = requireEnv(res, { requireAnon: true });
  if (!cfg) return;

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const email = normalizeEmail(body.email);
    const password = String(body.password || '').trim();

    if (!validEmail(email)) {
      return send(res, 400, { ok: false, code: 'bad_email', message: 'Please enter a valid email address.' });
    }
    if (!password) {
      return send(res, 400, { ok: false, code: 'bad_password', message: 'Please enter your password.' });
    }

    const tokenUrl = `${cfg.supabaseUrl}/auth/v1/token?grant_type=password`;
    const authRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const text = await authRes.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) { data = text; }

    if (!authRes.ok) {
      const errMsg = (data && (data.msg || data.message || data.error_description)) || 'Authentication failed.';
      const lower = errMsg.toLowerCase();

      if (lower.includes('email not confirmed')) {
        return send(res, 403, {
          ok: false,
          code: 'email_not_confirmed',
          email,
          message: 'Your email has not been verified yet. Please check your inbox for the confirmation email.'
        });
      }

      if (lower.includes('invalid') || lower.includes('credentials') || lower.includes('grant')) {
        return send(res, 401, {
          ok: false,
          code: 'invalid_credentials',
          message: 'Incorrect email or password. Please verify your credentials and try again.'
        });
      }

      return send(res, authRes.status, {
        ok: false,
        code: 'auth_failed',
        message: errMsg
      });
    }

    return send(res, 200, {
      ok: true,
      accessToken: data.access_token,
      user: {
        id: data.user?.id,
        email: data.user?.email || email,
        name: data.user?.user_metadata?.name || email.split('@')[0],
        channel: data.user?.user_metadata?.channel || 'Shopify Dropshipping'
      },
      message: 'Signed in successfully. Launching Product Radar...'
    });
  } catch (err) {
    console.error('Signin error:', err);
    return send(res, 500, { ok: false, message: err.message || 'Could not authenticate.' });
  }
}

/**
 * Handle Google OAuth / Sign-In.
 * - GET: Redirects user to Supabase Google OAuth provider.
 * - POST: Verifies Google ID token from Google Identity Services / One Tap.
 */
async function google(req, res) {
  if (cors(req, res)) return;

  const cfg = requireEnv(res, { requireAnon: true });
  if (!cfg) return;

  // Handle POST (Google ID token / credential)
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
      const idToken = body.idToken || body.credential;

      if (!idToken) {
        return send(res, 400, { ok: false, message: 'Google ID token or credential is required.' });
      }

      const tokenUrl = `${cfg.supabaseUrl}/auth/v1/token?grant_type=id_token`;
      const authRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: 'google',
          id_token: idToken
        })
      });

      const text = await authRes.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) { data = text; }

      if (!authRes.ok) {
        const errMsg = (data && (data.msg || data.message || data.error_description)) || 'Google authentication failed.';
        return send(res, authRes.status, { ok: false, message: errMsg });
      }

      return send(res, 200, {
        ok: true,
        accessToken: data.access_token,
        user: {
          id: data.user?.id,
          email: data.user?.email,
          name: data.user?.user_metadata?.full_name || data.user?.user_metadata?.name || data.user?.email?.split('@')[0],
          avatar: data.user?.user_metadata?.avatar_url || data.user?.user_metadata?.picture
        },
        message: 'Google authentication successful.'
      });
    } catch (err) {
      console.error('Google POST error:', err);
      return send(res, 500, { ok: false, message: err.message || 'Google token verification failed.' });
    }
  }

  // Handle GET (Redirect to Google OAuth)
  try {
    const rawSite = (cfg.siteUrl || `https://${req.headers.host || 'quvirl.com'}`).replace(/\/$/, '');
    const isLocal = rawSite.includes('localhost') || rawSite.includes('127.0.0.1');
    const siteUrl = isLocal ? rawSite : 'https://quvirl.com';
    const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '499035886701-9snnuga6fshl83i041b386u36uftnfij.apps.googleusercontent.com').trim().replace(/['"]/g, '');
    const googleClientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim().replace(/['"]/g, '');

    // If GOOGLE_CLIENT_SECRET is provided, use direct OAuth so Google strictly displays quvirl.com (No Supabase Pro required)
    if (googleClientSecret) {
      const callbackUrl = `${siteUrl}/api/auth/callback`;
      const directGoogleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'online',
        prompt: 'select_account'
      }).toString();

      const isCheck = req.query && (req.query.check === '1' || req.query.json === 'true');
      if (isCheck) {
        return send(res, 200, { ok: true, enabled: true, direct: true, url: directGoogleAuthUrl });
      }

      res.writeHead(302, { Location: directGoogleAuthUrl });
      return res.end();
    }

    const redirectTo = `${siteUrl}/slot-verify.html`;
    const googleAuthUrl = `${cfg.supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;

    const isCheck = req.query && (req.query.check === '1' || req.query.json === 'true');

    // Test if Supabase has Google provider enabled
    try {
      const checkRes = await fetch(googleAuthUrl, {
        method: 'GET',
        redirect: 'manual'
      });

      if (checkRes.status === 400) {
        const text = await checkRes.text();
        if (text.includes('not enabled') || text.includes('Unsupported provider')) {
          if (isCheck) {
            return send(res, 200, {
              ok: false,
              enabled: false,
              code: 'google_provider_disabled',
              message: 'Google Sign-In is not enabled in your Supabase dashboard yet.'
            });
          }
          res.writeHead(302, {
            Location: `${siteUrl}/intro.html?auth_error=google_provider_disabled`
          });
          return res.end();
        }
      }

      const targetLocation = checkRes.headers.get('location') || googleAuthUrl;

      if (isCheck) {
        return send(res, 200, {
          ok: true,
          enabled: true,
          url: targetLocation
        });
      }

      res.writeHead(302, {
        Location: targetLocation
      });
      return res.end();
    } catch (checkErr) {
      if (isCheck) {
        return send(res, 200, {
          ok: true,
          enabled: true,
          url: googleAuthUrl
        });
      }
      res.writeHead(302, {
        Location: googleAuthUrl
      });
      return res.end();
    }
  } catch (err) {
    console.error('Google redirect error:', err);
    return send(res, 500, { ok: false, message: 'Could not initialize Google authentication.' });
  }
}

/**
 * Handle direct OAuth callback from Google.
 * Exchanges authorization code for Google id_token/access_token,
 * then activates the user session in Supabase via id_token grant or Admin API fallback.
 */
async function callback(req, res) {
  if (cors(req, res)) return;
  const cfg = requireEnv(res, { requireAnon: true });
  if (!cfg) return;

  const rawSite = (cfg.siteUrl || `https://${req.headers.host || 'quvirl.com'}`).replace(/\/$/, '');
  const isLocal = rawSite.includes('localhost') || rawSite.includes('127.0.0.1');
  const siteUrl = isLocal ? rawSite : 'https://quvirl.com';
  const code = req.query && req.query.code;

  if (!code) {
    const error = req.query && req.query.error ? `?auth_error=${encodeURIComponent(req.query.error)}` : '';
    res.writeHead(302, { Location: `${siteUrl}/intro.html${error}` });
    return res.end();
  }

  const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '499035886701-9snnuga6fshl83i041b386u36uftnfij.apps.googleusercontent.com').trim().replace(/['"]/g, '');
  const googleClientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim().replace(/['"]/g, '');

  if (!googleClientSecret) {
    res.writeHead(302, { Location: `${siteUrl}/intro.html?auth_error=missing_google_client_secret` });
    return res.end();
  }

  try {
    const callbackUrl = `${siteUrl}/api/auth/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code'
      }).toString()
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || (!tokenData.id_token && !tokenData.access_token)) {
      console.error('Google token exchange error:', tokenData);
      const errMsg = encodeURIComponent((tokenData && (tokenData.error_description || tokenData.error)) || 'Google token exchange failed');
      res.writeHead(302, { Location: `${siteUrl}/intro.html?auth_error=google_exchange_failed&auth_desc=${errMsg}` });
      return res.end();
    }

    // 1. Fetch user profile from Google using the verified access token
    let userEmail = null;
    let userName = null;
    let userAvatar = null;
    if (tokenData.access_token) {
      try {
        const gProfileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const gProfile = await gProfileRes.json();
        if (gProfile && gProfile.email) {
          userEmail = gProfile.email.toLowerCase().trim();
          userName = gProfile.name || gProfile.given_name || userEmail.split('@')[0];
          userAvatar = gProfile.picture;
        }
      } catch (gErr) {
        console.error('Google profile fetch failed:', gErr);
      }
    }

    // 2. Primary Path: Supabase standard id_token grant (Free tier)
    if (tokenData.id_token) {
      try {
        const supabaseTokenUrl = `${cfg.supabaseUrl}/auth/v1/token?grant_type=id_token`;
        const sRes = await fetch(supabaseTokenUrl, {
          method: 'POST',
          headers: {
            apikey: cfg.anonKey,
            Authorization: `Bearer ${cfg.anonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            provider: 'google',
            id_token: tokenData.id_token,
            access_token: tokenData.access_token
          })
        });

        const sData = await sRes.json();
        if (sRes.ok && sData.access_token) {
          const redirectFragment = `#access_token=${encodeURIComponent(sData.access_token)}&refresh_token=${encodeURIComponent(sData.refresh_token || '')}&token_type=bearer&type=signup`;
          res.writeHead(302, { Location: `${siteUrl}/slot-verify.html${redirectFragment}` });
          return res.end();
        }
        console.warn('Supabase id_token grant returned error:', sData);
      } catch (err) {
        console.warn('Supabase id_token grant attempt failed:', err);
      }
    }

    // 3. Fallback Path: Supabase Admin API with service role key
    if (userEmail && cfg.serviceKey) {
      try {
        // Ensure user exists and is confirmed in Supabase
        await fetch(`${cfg.supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            apikey: cfg.serviceKey,
            Authorization: `Bearer ${cfg.serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: userEmail,
            email_confirm: true,
            user_metadata: {
              name: userName || userEmail.split('@')[0],
              avatar_url: userAvatar,
              channel: 'Shopify Dropshipping',
              source: 'google_oauth'
            }
          })
        });

        // Generate magic link token for immediate session activation
        const linkRes = await fetch(`${cfg.supabaseUrl}/auth/v1/admin/generate_link`, {
          method: 'POST',
          headers: {
            apikey: cfg.serviceKey,
            Authorization: `Bearer ${cfg.serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'magiclink',
            email: userEmail,
            options: {
              redirectTo: `${siteUrl}/slot-verify.html`
            }
          })
        });

        const linkData = await linkRes.json();
        const actionLink = linkData?.properties?.action_link || linkData?.action_link;
        const hashedToken = linkData?.properties?.hashed_token || linkData?.hashed_token;

        if (actionLink) {
          res.writeHead(302, { Location: actionLink });
          return res.end();
        }

        if (hashedToken) {
          res.writeHead(302, { Location: `${siteUrl}/slot-verify.html?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink` });
          return res.end();
        }
      } catch (adminErr) {
        console.error('Supabase admin fallback failed:', adminErr);
      }
    }

    res.writeHead(302, { Location: `${siteUrl}/intro.html?auth_error=supabase_exchange_failed` });
    return res.end();
  } catch (err) {
    console.error('Auth callback exception:', err);
    res.writeHead(302, { Location: `${siteUrl}/intro.html?auth_error=callback_error` });
    return res.end();
  }
}

/**
 * Handle resending verification email.
 */
async function resend(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'Use POST.' });

  const cfg = requireEnv(res, { requireAnon: true });
  if (!cfg) return;

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const email = normalizeEmail(body.email);

    if (!validEmail(email)) {
      return send(res, 400, { ok: false, message: 'Please enter a valid email address.' });
    }

    const siteUrl = cfg.siteUrl || `https://${req.headers.host || 'quvirl.com'}`;
    const redirectTo = `${siteUrl}/slot-verify.html`;
    const resendUrl = `${cfg.supabaseUrl}/auth/v1/resend`;

    const authRes = await fetch(resendUrl, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: redirectTo
        }
      })
    });

    const text = await authRes.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) { data = text; }

    if (!authRes.ok) {
      const errMsg = (data && (data.msg || data.message || data.error_description)) || 'Could not resend email.';
      return send(res, authRes.status, { ok: false, message: errMsg });
    }

    return send(res, 200, {
      ok: true,
      email,
      message: `A fresh verification link has been sent to ${email}.`
    });
  } catch (err) {
    console.error('Resend error:', err);
    return send(res, 500, { ok: false, message: err.message || 'Could not resend verification email.' });
  }
}

module.exports = {
  signup,
  signin,
  google,
  callback,
  resend
};
