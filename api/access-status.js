const {
  cors, send, requireEnv, hashValue, getIp, getUserAgent, monthKey,
  isBeforeLock, publicAccessUntil, countRows, findSlots
} = require('../lib/slot-utils');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'Use POST.' });

  const cfg = requireEnv(res);
  if (!cfg) return;

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const now = new Date();
    const currentMonth = monthKey(now);
    const publicOpen = isBeforeLock(cfg, now);
    const deviceHash = hashValue(body.deviceId || '', cfg.hashSecret);
    const tokenHash = hashValue(body.accessToken || '', cfg.hashSecret);
    const ipHash = hashValue(getIp(req), cfg.hashSecret);
    const uaHash = hashValue(getUserAgent(req), cfg.hashSecret);

    let activeSlot = null;
    if (tokenHash) {
      const slots = await findSlots(
        cfg,
        `slot_month=eq.${encodeURIComponent(currentMonth)}&access_token_hash=eq.${encodeURIComponent(tokenHash)}&status=eq.active`,
        1
      );
      if (slots.length) activeSlot = slots[0];
    }

    if (!activeSlot && deviceHash) {
      const slots = await findSlots(
        cfg,
        `slot_month=eq.${encodeURIComponent(currentMonth)}&device_id_hash=eq.${encodeURIComponent(deviceHash)}&status=eq.active`,
        1
      );
      if (slots.length) activeSlot = slots[0];
    }

    const activeCount = await countRows(cfg, `slot_month=eq.${encodeURIComponent(currentMonth)}&status=eq.active`);
    const remaining = Math.max(0, cfg.slotLimit - activeCount);

    send(res, 200, {
      ok: true,
      publicAccess: publicOpen,
      publicAccessUntil: publicAccessUntil(cfg),
      currentMonth,
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
