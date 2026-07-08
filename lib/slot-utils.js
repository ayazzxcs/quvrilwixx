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
  const slotLimit = Number(process.env.SLOT_LIMIT || 10000);
  const lockStartDate = process.env.ACCESS_LOCK_START_DATE || '2026-08-01T00:00:00.000Z';
  const siteUrl = process.env.SITE_URL || 'https://quvirl.com';
  const hashSecret = process.env.IP_HASH_SECRET || serviceKey || 'quvirl-local-secret';
  return { supabaseUrl, serviceKey, slotLimit, lockStartDate, siteUrl, hashSecret };
}

function requireEnv(res) {
  const cfg = env();
  if (!cfg.supabaseUrl || !cfg.serviceKey) {
    send(res, 500, {
      ok: false,
      code: 'missing_env',
      message: 'Quvirl slot API is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables.'
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
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  return d;
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

async function countRows(cfg, query) {
  const result = await supabaseFetch(cfg, `quvirl_slots?select=id&${query}`, {
    method: 'GET',
    headers: { Prefer: 'count=exact', Range: '0-0' }
  });
  return Number(result.count || 0);
}

async function findSlots(cfg, query, limit = 10) {
  const result = await supabaseFetch(cfg, `quvirl_slots?select=*&${query}&order=created_at.desc&limit=${limit}`, { method: 'GET' });
  return Array.isArray(result.data) ? result.data : [];
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

module.exports = {
  cors, send, env, requireEnv, hashValue, token, getIp, getUserAgent,
  monthKey, nextMonthKey, lockStartDateObj, isBeforeLock, publicAccessUntil,
  todayRange, supabaseFetch, countRows, findSlots, normalizeEmail, validEmail
};
