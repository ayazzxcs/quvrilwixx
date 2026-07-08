const {
  cors, send, requireEnv, hashValue, getIp, getUserAgent, monthKey,
  nextMonthKey, lockStartDateObj, isBeforeLock, publicAccessUntil, todayRange,
  supabaseAuthFetch, countTableRows, countRows, findSlots, insertRow,
  normalizeEmail, validEmail, maskEmail
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

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'Use POST.' });

  const cfg = requireEnv(res, { requireAnon: true });
  if (!cfg) return;

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const email = normalizeEmail(body.email);
    const deviceId = String(body.deviceId || '').trim();

    if (!validEmail(email)) return send(res, 400, { ok: false, code: 'bad_email', message: 'Please enter a valid email address.' });
    if (!deviceId || deviceId.length < 12) return send(res, 400, { ok: false, code: 'bad_device', message: 'Device check failed. Refresh and try again.' });

    const now = new Date();
    const ip = getIp(req);
    const userAgent = getUserAgent(req);
    const emailHash = hashValue(email, cfg.hashSecret);
    const deviceHash = hashValue(deviceId, cfg.hashSecret);
    const ipHash = hashValue(ip, cfg.hashSecret);
    const uaHash = hashValue(userAgent, cfg.hashSecret);
    const { targetMonth, beforeLock, movedToNext } = await pickMonth(cfg, now);

    const existingEmail = await findSlots(cfg, `slot_month=eq.${encodeURIComponent(targetMonth)}&email=eq.${encodeURIComponent(email)}`, 1);
    if (existingEmail.length) {
      const existing = existingEmail[0];
      return send(res, 200, {
        ok: true,
        alreadyReserved: true,
        verificationRequired: false,
        message: `This email already has a verified Quvirl research slot for ${existing.slot_month}.`,
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
        message: `A verified slot is already reserved from this device for ${existing.slot_month}.`,
        slot: { month: existing.slot_month, slotNumber: existing.slot_number, status: existing.status }
      });
    }

    const day = todayRange(now);
    const dailyLimit = Number(process.env.IP_DAILY_LIMIT || 3);
    const monthlyLimit = Number(process.env.IP_MONTHLY_LIMIT || 10);
    const ipDayAttempts = await countTableRows(cfg, 'quvirl_slot_attempts', `ip_hash=eq.${encodeURIComponent(ipHash)}&created_at=gte.${encodeURIComponent(day.start)}&created_at=lt.${encodeURIComponent(day.end)}`);
    if (ipDayAttempts >= dailyLimit) {
      return send(res, 429, { ok: false, code: 'ip_daily_limit', message: 'Too many verification requests from this network today. Try again later.' });
    }

    const ipMonthAttempts = await countTableRows(cfg, 'quvirl_slot_attempts', `ip_hash=eq.${encodeURIComponent(ipHash)}&target_month=eq.${encodeURIComponent(targetMonth)}`);
    if (ipMonthAttempts >= monthlyLimit) {
      return send(res, 429, { ok: false, code: 'ip_monthly_limit', message: 'Too many verification requests from this network for this month.' });
    }

    await insertRow(cfg, 'quvirl_slot_attempts', {
      email_hash: emailHash,
      target_month: targetMonth,
      device_id_hash: deviceHash,
      ip_hash: ipHash,
      user_agent_hash: uaHash,
      source: body.source || 'site'
    });

    const redirectTo = `${cfg.siteUrl}/slot-verify.html`;
    await supabaseAuthFetch(
      cfg,
      `otp?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          create_user: true,
          data: {
            source: 'quvirl_slot',
            target_month: targetMonth
          }
        })
      }
    );

    const message = movedToNext
      ? `This month is full. Check ${maskEmail(email)} and verify your email to reserve a ${targetMonth} slot.`
      : `Check ${maskEmail(email)} and open the verification link to confirm your Quvirl research slot for ${targetMonth}.`;

    return send(res, 200, {
      ok: true,
      verificationRequired: true,
      publicAccess: beforeLock,
      publicAccessUntil: publicAccessUntil(cfg),
      emailMasked: maskEmail(email),
      targetMonth,
      message
    });
  } catch (err) {
    console.error(err);
    send(res, 500, { ok: false, message: err.message || 'Could not send verification email.' });
  }
};
