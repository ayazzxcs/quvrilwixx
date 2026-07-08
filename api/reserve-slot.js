const {
  cors, send, requireEnv, hashValue, token, getIp, getUserAgent, monthKey,
  nextMonthKey, lockStartDateObj, isBeforeLock, publicAccessUntil, todayRange,
  supabaseFetch, countRows, findSlots, normalizeEmail, validEmail
} = require('../lib/slot-utils');

async function createSlot(cfg, row) {
  const result = await supabaseFetch(cfg, 'quvirl_slots', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

async function pickMonth(cfg, now) {
  const currentMonth = monthKey(now);
  const nextMonth = nextMonthKey(now);
  const beforeLock = isBeforeLock(cfg, now);
  const lockMonth = monthKey(lockStartDateObj(cfg));

  let targetMonth = beforeLock ? lockMonth : currentMonth;
  let activeCount = await countRows(cfg, `slot_month=eq.${encodeURIComponent(targetMonth)}&status=eq.active`);
  if (activeCount < cfg.slotLimit) return { targetMonth, status: 'active', slotNumber: activeCount + 1, currentMonth, beforeLock, movedToNext: false };

  targetMonth = beforeLock ? nextMonthKey(lockStartDateObj(cfg)) : nextMonth;
  activeCount = await countRows(cfg, `slot_month=eq.${encodeURIComponent(targetMonth)}&status=eq.active`);
  if (activeCount < cfg.slotLimit) return { targetMonth, status: 'active', slotNumber: activeCount + 1, currentMonth, beforeLock, movedToNext: true };

  return { targetMonth, status: 'waitlist', slotNumber: null, currentMonth, beforeLock, movedToNext: true };
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'Use POST.' });

  const cfg = requireEnv(res);
  if (!cfg) return;

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const email = normalizeEmail(body.email);
    const deviceId = String(body.deviceId || '').trim();

    if (!validEmail(email)) return send(res, 400, { ok: false, code: 'bad_email', message: 'Enter a valid email address.' });
    if (!deviceId || deviceId.length < 12) return send(res, 400, { ok: false, code: 'bad_device', message: 'Device check failed. Refresh and try again.' });

    const now = new Date();
    const ip = getIp(req);
    const userAgent = getUserAgent(req);
    const emailHash = hashValue(email, cfg.hashSecret);
    const deviceHash = hashValue(deviceId, cfg.hashSecret);
    const ipHash = hashValue(ip, cfg.hashSecret);
    const uaHash = hashValue(userAgent, cfg.hashSecret);
    const { targetMonth, status, slotNumber, currentMonth, beforeLock, movedToNext } = await pickMonth(cfg, now);

    const existingEmail = await findSlots(cfg, `slot_month=eq.${encodeURIComponent(targetMonth)}&email=eq.${encodeURIComponent(email)}`, 1);
    if (existingEmail.length) {
      const existing = existingEmail[0];
      return send(res, 200, {
        ok: true,
        duplicate: true,
        message: `This email already has a Quvirl research slot for ${existing.slot_month}.`,
        publicAccess: beforeLock,
        publicAccessUntil: publicAccessUntil(cfg),
        slot: { month: existing.slot_month, slotNumber: existing.slot_number, status: existing.status }
      });
    }

    const existingDevice = await findSlots(cfg, `slot_month=eq.${encodeURIComponent(targetMonth)}&device_id_hash=eq.${encodeURIComponent(deviceHash)}`, 1);
    if (existingDevice.length) {
      const existing = existingDevice[0];
      return send(res, 409, {
        ok: false,
        code: 'device_duplicate',
        message: `A slot is already reserved from this device for ${existing.slot_month}.`,
        slot: { month: existing.slot_month, slotNumber: existing.slot_number, status: existing.status }
      });
    }

    const day = todayRange(now);
    const ipDayCount = await countRows(cfg, `ip_hash=eq.${encodeURIComponent(ipHash)}&created_at=gte.${encodeURIComponent(day.start)}&created_at=lt.${encodeURIComponent(day.end)}`);
    if (ipDayCount >= Number(process.env.IP_DAILY_LIMIT || 3)) {
      return send(res, 429, { ok: false, code: 'ip_daily_limit', message: 'Too many slot requests from this network today. Try again later.' });
    }

    const ipMonthCount = await countRows(cfg, `ip_hash=eq.${encodeURIComponent(ipHash)}&slot_month=eq.${encodeURIComponent(targetMonth)}`);
    if (ipMonthCount >= Number(process.env.IP_MONTHLY_LIMIT || 10)) {
      return send(res, 429, { ok: false, code: 'ip_monthly_limit', message: 'Too many slot requests from this network for this month.' });
    }

    const rawToken = token();
    const accessTokenHash = hashValue(rawToken, cfg.hashSecret);
    const row = {
      email,
      email_hash: emailHash,
      slot_month: targetMonth,
      status,
      slot_number: slotNumber,
      access_token_hash: accessTokenHash,
      device_id_hash: deviceHash,
      ip_hash: ipHash,
      user_agent_hash: uaHash,
      source: body.source || 'site',
      reserved_for: beforeLock ? 'next_month' : (movedToNext ? 'next_month' : 'current_month')
    };

    const saved = await createSlot(cfg, row);
    const message = status === 'active'
      ? (beforeLock
          ? `Your Quvirl research access slot is reserved for ${targetMonth}. Public access stays open until ${publicAccessUntil(cfg).slice(0, 10)}.`
          : movedToNext
            ? `This month is full. Your Quvirl research access slot is reserved for ${targetMonth}.`
            : `Your Quvirl research access slot is active for ${targetMonth}.`)
      : `All visible slots are currently full. You have been added to the ${targetMonth} waitlist.`;

    send(res, 200, {
      ok: true,
      publicAccess: beforeLock,
      publicAccessUntil: publicAccessUntil(cfg),
      accessToken: rawToken,
      message,
      slot: {
        month: saved.slot_month,
        slotNumber: saved.slot_number,
        status: saved.status,
        reservedFor: saved.reserved_for
      }
    });
  } catch (err) {
    console.error(err);
    send(res, 500, { ok: false, message: err.message || 'Could not reserve slot.' });
  }
};
