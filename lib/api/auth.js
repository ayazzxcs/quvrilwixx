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

  // Handle GET (Redirect to Supabase Google OAuth)
  try {
    const siteUrl = cfg.siteUrl || `https://${req.headers.host || 'quvirl.com'}`;
    const redirectTo = `${siteUrl}/slot-verify.html`;
    const googleAuthUrl = `${cfg.supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;

    res.writeHead(302, {
      Location: googleAuthUrl
    });
    return res.end();
  } catch (err) {
    console.error('Google redirect error:', err);
    return send(res, 500, { ok: false, message: 'Could not initialize Google authentication.' });
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
  resend
};
