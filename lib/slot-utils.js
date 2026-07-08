const crypto = require('crypto');

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || 'https://quvirl.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(body));
}

function env() {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const slotLimit = Number(process.env.SLOT_LIMIT || 10000);
  const lockStartDate = process.env.ACCESS_LOCK_START_DATE || '2026-08-01T00:00:00.000Z';
  const siteUrl = (process.env.SITE_URL || 'https://quvirl.com').replace(/\/$/, '');
  const hashSecret = process.env.IP_HASH_SECRET || serviceKey || 'quvirl-local-secret';
  return { supabaseUrl, serviceKey, anonKey, slotLimit, lockStartDate, siteUrl, hashSecret };
}

function requireEnv(res, opts = {}) {
  const cfg = env();
  const requireAnon = opts.requireAnon !== false;
  if (!cfg.supabaseUrl || !cfg.serviceKey || (requireAnon && !cfg.anonKey)) {
    send(res, 500, {
      ok: false,
      code: 'missing_env',
      message: 'Quvirl slot API is not configured. Add SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables.'
    });
    return null;
  }
  return cfg;
}

function hashValue(value, secret) {
  if (!value) return null;
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

function token() {
  return crypto.randomBytes(32).toString('hex');
}

function getIp(req) {
  const raw = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.headers['cf-connecting-ip'] || req.socket?.remoteAddress || '';
  return String(raw).split(',')[0].trim();
}

function getUserAgent(req) {
  return String(req.headers['user-agent'] || '').slice(0, 500);
}

function monthKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function nextMonthKey(date = new Date()) {
  return monthKey(addMonths(date, 1));
}

function lockStartDateObj(cfg) {
  const d = new Date(cfg.lockStartDate);
  return Number.isNaN(d.getTime()) ? new Date('2026-08-01T00:00:00.000Z') : d;
}

function isBeforeLock(cfg, now = new Date()) {
  return now.getTime() < lockStartDateObj(cfg).getTime();
}

function publicAccessUntil(cfg) {
  return lockStartDateObj(cfg).toISOString();
}

function todayRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function supabaseFetch(cfg, path, options = {}) {
  const url = `${cfg.supabaseUrl}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = text; }
  }
  if (!res.ok) {
    const msg = typeof data === 'string' ? data : (data?.message || data?.hint || res.statusText);
    throw new Error(`Supabase ${res.status}: ${msg}`);
  }
  const countHeader = res.headers.get('content-range');
  let count = null;
  if (countHeader && countHeader.includes('/')) {
    const tail = countHeader.split('/').pop();
    count = tail === '*' ? null : Number(tail);
  }
  return { data, count, status: res.status };
}

async function supabaseAuthFetch(cfg, path, options = {}, bearerToken = null) {
  const url = `${cfg.supabaseUrl}/auth/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${bearerToken || cfg.anonKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = text; }
  }
  if (!res.ok) {
    const msg = typeof data === 'string' ? data : (data?.msg || data?.message || data?.error_description || res.statusText);
    throw new Error(`Supabase Auth ${res.status}: ${msg}`);
  }
  return { data, status: res.status };
}

async function countTableRows(cfg, table, query) {
  const result = await supabaseFetch(cfg, `${table}?select=id&${query}`, {
    method: 'GET',
    headers: { Prefer: 'count=exact', Range: '0-0' }
  });
  return Number(result.count || 0);
}

async function countRows(cfg, query) {
  return countTableRows(cfg, 'quvirl_slots', query);
}

async function findTableRows(cfg, table, query, limit = 10) {
  const result = await supabaseFetch(cfg, `${table}?select=*&${query}&order=created_at.desc&limit=${limit}`, { method: 'GET' });
  return Array.isArray(result.data) ? result.data : [];
}

async function findSlots(cfg, query, limit = 10) {
  return findTableRows(cfg, 'quvirl_slots', query, limit);
}

async function insertRow(cfg, table, row) {
  const result = await supabaseFetch(cfg, table, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

async function updateRow(cfg, table, id, patch) {
  const result = await supabaseFetch(cfg, `${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = normalizeEmail(email);
  if (clean.length > 254) return false;
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!basicEmailRegex.test(clean)) return false;
  const domain = clean.split('@')[1];
  if (!domain || domain.includes('..')) return false;
  const blockedTypoDomains = new Set([
    'gmail.comd', 'gmail.con', 'gmail.co', 'gamil.com', 'gmial.com', 'gnail.com', 'gmai.com', 'gmail.cm',
    'yahoo.comd', 'yahoo.con', 'yaho.com', 'outlook.comd', 'outlook.con', 'hotmail.comd', 'hotmail.con'
  ]);
  if (blockedTypoDomains.has(domain)) return false;
  return true;
}

function maskEmail(email) {
  const clean = normalizeEmail(email);
  const [name, domain] = clean.split('@');
  if (!name || !domain) return clean;
  const visible = name.length <= 2 ? name[0] || '*' : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${visible}@${domain}`;
}

function slotLookupMonths(cfg, now = new Date()) {
  const months = [monthKey(now), monthKey(lockStartDateObj(cfg)), nextMonthKey(lockStartDateObj(cfg))];
  return [...new Set(months)];
}

module.exports = {
  cors, send, env, requireEnv, hashValue, token, getIp, getUserAgent,
  monthKey, nextMonthKey, lockStartDateObj, isBeforeLock, publicAccessUntil,
  todayRange, supabaseFetch, supabaseAuthFetch, countTableRows, countRows,
  findTableRows, findSlots, insertRow, updateRow, normalizeEmail, validEmail,
  maskEmail, slotLookupMonths
};
