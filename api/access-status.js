const {
  cors, send, requireEnv, hashValue, getIp, getUserAgent, monthKey,
  isBeforeLock, publicAccessUntil, countRows, findSlots, slotLookupMonths,
  lockStartDateObj
} = require('../lib/slot-utils');

async function findActiveSlotBy(cfg, field, value, months) {
  if (!value) return null;
  for (const m of months) {
    const slots = await findSlots(
      cfg,
      `slot_month=eq.${encodeURIComponent(m)}&${field}=eq.${encodeURIComponent(value)}&status=eq.active`,
      1
    );
    if (slots.length) return slots[0];
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'Use POST.' });

  const cfg = requireEnv(res, { requireAnon: false });
  if (!cfg) return;

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const now = new Date();
    const currentMonth = monthKey(now);
    const publicOpen = isBeforeLock(cfg, now);
    const displayMonth = publicOpen ? monthKey(lockStartDateObj(cfg)) : currentMonth;
    const lookupMonths = slotLookupMonths(cfg, now);
    const deviceHash = hashValue(body.deviceId || '', cfg.hashSecret);
    const tokenHash = hashValue(body.accessToken || '', cfg.hashSecret);
    const ipHash = hashValue(getIp(req), cfg.hashSecret);
    const uaHash = hashValue(getUserAgent(req), cfg.hashSecret);

    let activeSlot = await findActiveSlotBy(cfg, 'access_token_hash', tokenHash, lookupMonths);
    if (!activeSlot) activeSlot = await findActiveSlotBy(cfg, 'device_id_hash', deviceHash, lookupMonths);

    const activeCount = await countRows(cfg, `slot_month=eq.${encodeURIComponent(displayMonth)}&status=eq.active`);
    const remaining = Math.max(0, cfg.slotLimit - activeCount);

    send(res, 200, {
      ok: true,
      publicAccess: publicOpen,
      publicAccessUntil: publicAccessUntil(cfg),
      currentMonth,
      displayMonth,
      hasAccess: publicOpen || !!activeSlot,
      slot: activeSlot ? {
        month: activeSlot.slot_month,
        slotNumber: activeSlot.slot_number,
        status: activeSlot.status
      } : null,
      slotLimit: cfg.slotLimit,
      usedSlots: activeCount,
      remainingSlots: remaining,
      signals: { deviceKnown: !!deviceHash, ipKnown: !!ipHash, uaKnown: !!uaHash }
    });
  } catch (err) {
    console.error(err);
    send(res, 500, { ok: false, message: err.message || 'Could not check access.' });
  }
};
