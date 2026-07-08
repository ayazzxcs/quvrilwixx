const {
  cors, send, requireEnv, hashValue, token, getIp, getUserAgent, monthKey,
  nextMonthKey, lockStartDateObj, isBeforeLock, publicAccessUntil,
  supabaseAuthFetch, countRows, findSlots, insertRow, updateRow,
  normalizeEmail, validEmail
} = require('../lib/slot-utils');

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

async function getVerifiedUser(cfg, accessToken) {
  const result = await supabaseAuthFetch(cfg, 'user', { method: 'GET' }, accessToken);
  return result.data;
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'Use POST.' });

  const cfg = requireEnv(res, { requireAnon: true });
  if (!cfg) return;

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const supabaseAccessToken = String(body.accessToken || '').trim();
    const deviceId = String(body.deviceId || '').trim();

    if (!supabaseAccessToken || supabaseAccessToken.length < 20) {
      return send(res, 400, { ok: false, code: 'bad_token', message: 'Verification token missing or expired. Please request a new verification link.' });
    }
    if (!deviceId || deviceId.length < 12) {
      return send(res, 400, { ok: false, code: 'bad_device', message: 'Device check failed. Refresh and try again.' });
    }

    const user = await getVerifiedUser(cfg, supabaseAccessToken);
    const email = normalizeEmail(user?.email);
    if (!user?.id || !validEmail(email)) {
      return send(res, 401, { ok: false, code: 'email_not_verified', message: 'Email verification failed. Please request a new verification link.' });
    }

    const now = new Date();
    const ip = getIp(req);
    const userAgent = getUserAgent(req);
    const emailHash = hashValue(email, cfg.hashSecret);
    const deviceHash = hashValue(deviceId, cfg.hashSecret);
    const ipHash = hashValue(ip, cfg.hashSecret);
    const uaHash = hashValue(userAgent, cfg.hashSecret);
    const { targetMonth, status, slotNumber, beforeLock, movedToNext } = await pickMonth(cfg, now);
    const rawToken = token();
    const accessTokenHash = hashValue(rawToken, cfg.hashSecret);

    const existingDevice = await findSlots(cfg, `slot_month=eq.${encodeURIComponent(targetMonth)}&device_id_hash=eq.${encodeURIComponent(deviceHash)}`, 1);
    if (existingDevice.length && normalizeEmail(existingDevice[0].email) !== email) {
      const existing = existingDevice[0];
      return send(res, 409, {
        ok: false,
        code: 'device_duplicate',
        message: `A slot is already reserved from this device for ${existing.slot_month}.`,
        slot: { month: existing.slot_month, slotNumber: existing.slot_number, status: existing.status }
      });
    }

    const existingEmail = await findSlots(cfg, `slot_month=eq.${encodeURIComponent(targetMonth)}&email=eq.${encodeURIComponent(email)}`, 1);
    if (existingEmail.length) {
      const existing = existingEmail[0];
      const saved = await updateRow(cfg, 'quvirl_slots', existing.id, {
        access_token_hash: accessTokenHash,
        device_id_hash: deviceHash,
        ip_hash: ipHash,
        user_agent_hash: uaHash,
        auth_user_id: user.id,
        verified_at: now.toISOString(),
        source: body.source || existing.source || 'site'
      });
      return send(res, 200, {
        ok: true,
        publicAccess: beforeLock,
        publicAccessUntil: publicAccessUntil(cfg),
        accessToken: rawToken,
        message: `Your Quvirl research slot for ${saved.slot_month} is verified and saved on this device.`,
        slot: { month: saved.slot_month, slotNumber: saved.slot_number, status: saved.status, reservedFor: saved.reserved_for }
      });
    }

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
      source: body.source || 'email_verify',
      reserved_for: beforeLock ? 'next_month' : (movedToNext ? 'next_month' : 'current_month'),
      verified_at: now.toISOString(),
      auth_user_id: user.id
    };

    const saved = await insertRow(cfg, 'quvirl_slots', row);
    const message = status === 'active'
      ? (beforeLock
          ? `Your Quvirl research access slot is verified for ${targetMonth}. Public access stays open until ${publicAccessUntil(cfg).slice(0, 10)}.`
          : movedToNext
            ? `This month is full. Your verified Quvirl research access slot is reserved for ${targetMonth}.`
            : `Your Quvirl research access slot is verified and active for ${targetMonth}.`)
      : `All visible slots are currently full. Your verified email has been added to the ${targetMonth} waitlist.`;

    return send(res, 200, {
      ok: true,
      publicAccess: beforeLock,
      publicAccessUntil: publicAccessUntil(cfg),
      accessToken: rawToken,
      message,
      slot: { month: saved.slot_month, slotNumber: saved.slot_number, status: saved.status, reservedFor: saved.reserved_for }
    });
  } catch (err) {
    console.error(err);
    send(res, 500, { ok: false, message: err.message || 'Could not verify slot.' });
  }
};
