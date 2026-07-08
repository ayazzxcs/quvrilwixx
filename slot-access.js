(function () {
  const CFG = {
    lockStartDate: window.QUIVRL_LOCK_START_DATE || '2026-08-01T00:00:00.000Z',
    apiStatus: '/api/access-status',
    apiReserve: '/api/reserve-slot',
    storagePrefix: 'quvirl_slot_',
    slotLimit: 10000
  };

  const researchPaths = [
    '/', '/product/', '/category/', '/top-trending-products/', '/trending-this-month/',
    '/best-dropshipping-products-2026/', '/best-tiktok-products-to-sell/',
    '/high-margin-dropshipping-products/', '/high-margin-products/', '/viral-tiktok-products/',
    '/low-competition-products/'
  ];

  function isResearchPage() {
    const path = location.pathname;
    if (path === '/') return true;
    return researchPaths.some(p => p !== '/' && path.startsWith(p));
  }

  if (!isResearchPage()) return;

  function $(id) { return document.getElementById(id); }
  function store(key, value) { try { localStorage.setItem(CFG.storagePrefix + key, value); } catch (_) {} }
  function read(key) { try { return localStorage.getItem(CFG.storagePrefix + key) || ''; } catch (_) { return ''; } }
  function remove(key) { try { localStorage.removeItem(CFG.storagePrefix + key); } catch (_) {} }

  function getDeviceId() {
    let id = read('device_id');
    if (!id) {
      if (window.crypto && crypto.randomUUID) id = crypto.randomUUID();
      else id = 'qv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      store('device_id', id);
    }
    return id;
  }

  function beforeLock() {
    return Date.now() < new Date(CFG.lockStartDate).getTime();
  }

  function monthName(yyyyMm) {
    if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return 'next month';
    const [y, m] = yyyyMm.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en', { month: 'long', year: 'numeric' });
  }

  function injectCss() {
    if ($('qvSlotCss')) return;
    const css = document.createElement('style');
    css.id = 'qvSlotCss';
    css.textContent = `
      .qv-slot-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:9998;max-width:980px;margin:auto;background:linear-gradient(135deg,#ffffff,#eef7ff);color:#0f172a;border:1px solid rgba(12,68,124,.18);box-shadow:0 18px 55px rgba(0,0,0,.32);border-radius:18px;padding:16px;display:none}
      .qv-slot-row{display:flex;gap:14px;justify-content:space-between;align-items:center;flex-wrap:wrap}.qv-slot-copy{min-width:250px;flex:1}.qv-slot-copy b{display:block;font-size:16px;margin-bottom:4px}.qv-slot-copy p{margin:0;color:#475569;font-size:13px;line-height:1.48}.qv-slot-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.qv-slot-btn{border:0;border-radius:12px;padding:11px 15px;font-weight:900;cursor:pointer;background:#0C447C;color:#fff}.qv-slot-btn.secondary{background:#fff;color:#0f172a;border:1px solid #cbd5e1}.qv-slot-btn:disabled{opacity:.65;cursor:not-allowed}.qv-slot-mini{font-size:12px;color:#64748b;margin-top:6px}.qv-slot-modal{position:fixed;inset:0;z-index:10000;background:rgba(2,6,23,.74);backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;padding:18px}.qv-slot-card{width:min(520px,100%);background:#ffffff;color:#0f172a;border-radius:22px;border:1px solid rgba(12,68,124,.16);box-shadow:0 24px 90px rgba(0,0,0,.42);padding:22px}.qv-slot-card h2{margin:0 0 8px;font-size:25px;line-height:1.15;color:#0f172a}.qv-slot-card p{color:#475569;line-height:1.55}.qv-slot-card input{width:100%;padding:13px 14px;border:1px solid #cbd5e1;border-radius:13px;background:#fff;color:#0f172a;font-size:15px}.qv-slot-form-actions{display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}.qv-slot-alert{display:none;margin-top:12px;padding:11px;border-radius:12px;background:#eff6ff;color:#0c4a6e;border:1px solid #bae6fd;font-size:13px}.qv-slot-alert.err{background:#fff1f2;color:#9f1239;border-color:#fecdd3}.qv-access-wall{position:fixed;inset:0;z-index:9997;background:rgba(2,6,23,.84);backdrop-filter:blur(12px);display:none;align-items:center;justify-content:center;padding:18px}.qv-wall-card{width:min(620px,100%);background:#ffffff;color:#0f172a;border-radius:24px;padding:24px;box-shadow:0 24px 90px rgba(0,0,0,.45);text-align:left}.qv-wall-card h2{font-size:28px;line-height:1.12;margin:0 0 10px;color:#0f172a}.qv-wall-card p{color:#475569;line-height:1.55}.qv-wall-points{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:14px 0}.qv-wall-points span{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:13px;padding:10px;font-size:13px;font-weight:800;color:#334155}.qv-locked .winningPanel,.qv-locked #all-products,.qv-locked #grid,.qv-locked #winnerGrid,.qv-locked .productDetail,.qv-locked main{filter:blur(8px);pointer-events:none;user-select:none}.qv-slot-badge{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:rgba(110,231,183,.13);border:1px solid rgba(110,231,183,.28);color:#b7ffe8;font-size:12px;font-weight:900;margin-left:8px}@media(max-width:620px){.qv-wall-points{grid-template-columns:1fr}.qv-slot-banner{left:10px;right:10px;bottom:10px}.qv-slot-actions{width:100%}.qv-slot-btn{flex:1}.qv-slot-card{padding:18px}}`;
    document.head.appendChild(css);
  }

  function buildUi() {
    if ($('qvSlotBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'qvSlotBanner';
    banner.className = 'qv-slot-banner';
    banner.innerHTML = `<div class="qv-slot-row"><div class="qv-slot-copy"><b id="qvSlotTitle">Free research access is open this month</b><p id="qvSlotText">Full Quvirl product research becomes slot-based next month. Reserve your free slot now.</p><div class="qv-slot-mini" id="qvSlotMini"></div></div><div class="qv-slot-actions"><button class="qv-slot-btn secondary" id="qvSlotHide" type="button">Not now</button><button class="qv-slot-btn" id="qvSlotOpen" type="button">Reserve Free Slot</button></div></div>`;
    document.body.appendChild(banner);

    const modal = document.createElement('div');
    modal.id = 'qvSlotModal';
    modal.className = 'qv-slot-modal';
    modal.innerHTML = `<div class="qv-slot-card"><h2 id="qvModalTitle">Reserve your Quvirl research slot</h2><p id="qvModalText">Use one email to reserve one monthly research access slot. This helps keep product research access stable and prevents automated abuse.</p><form id="qvSlotForm"><input id="qvSlotEmail" type="email" autocomplete="email" placeholder="Enter your email" required><div class="qv-slot-form-actions"><button class="qv-slot-btn secondary" type="button" id="qvSlotClose">Cancel</button><button class="qv-slot-btn" type="submit" id="qvSlotSubmit">Confirm Slot</button></div><div class="qv-slot-alert" id="qvSlotAlert"></div></form></div>`;
    document.body.appendChild(modal);

    const wall = document.createElement('div');
    wall.id = 'qvAccessWall';
    wall.className = 'qv-access-wall';
    wall.innerHTML = `<div class="qv-wall-card"><h2 id="qvWallTitle">Quvirl research access is slot-based now</h2><p id="qvWallText">Full product research is limited to confirmed monthly slots. Claim an available slot to view the full product database, score breakdowns, supplier links and demand signals.</p><div class="qv-wall-points"><span>Google Trends signals</span><span>Amazon demand checks</span><span>Supplier data</span><span>Product score details</span></div><div class="qv-slot-form-actions" style="justify-content:flex-start"><button class="qv-slot-btn" id="qvWallClaim" type="button">Claim Research Access</button><a class="qv-slot-btn secondary" href="/blog/" style="text-decoration:none">Read public guides</a></div><div class="qv-slot-alert" id="qvWallAlert"></div></div>`;
    document.body.appendChild(wall);

    $('qvSlotOpen').addEventListener('click', openModal);
    $('qvWallClaim').addEventListener('click', openModal);
    $('qvSlotClose').addEventListener('click', closeModal);
    $('qvSlotHide').addEventListener('click', function () { store('banner_hidden', String(Date.now())); banner.style.display = 'none'; });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    $('qvSlotForm').addEventListener('submit', reserveSlot);
  }

  function openModal() { $('qvSlotModal').style.display = 'flex'; setTimeout(() => $('qvSlotEmail')?.focus(), 50); }
  function closeModal() { $('qvSlotModal').style.display = 'none'; }
  function alertBox(msg, isError) {
    const box = $('qvSlotAlert');
    if (!box) return;
    box.textContent = msg;
    box.className = 'qv-slot-alert' + (isError ? ' err' : '');
    box.style.display = 'block';
  }
  function wallAlert(msg, isError) {
    const box = $('qvWallAlert');
    if (!box) return;
    box.textContent = msg;
    box.className = 'qv-slot-alert' + (isError ? ' err' : '');
    box.style.display = 'block';
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || 'Request failed');
      err.data = data;
      throw err;
    }
    return data;
  }

  function setConfirmed(data, email) {
    if (data.accessToken) store('access_token', data.accessToken);
    if (email) store('email', email);
    if (data.slot?.month) store('slot_month', data.slot.month);
    if (data.slot?.status) store('slot_status', data.slot.status);
  }

  async function reserveSlot(e) {
    e.preventDefault();
    const btn = $('qvSlotSubmit');
    const email = $('qvSlotEmail').value.trim().toLowerCase();
    btn.disabled = true;
    btn.textContent = 'Confirming...';
    try {
      const data = await postJson(CFG.apiReserve, { email, deviceId: getDeviceId(), source: location.pathname });
      setConfirmed(data, email);
      alertBox(data.message || 'Your Quvirl research access slot is confirmed.', false);
      wallAlert(data.message || 'Your Quvirl research access slot is confirmed.', false);
      updateUi({ ...data, hasAccess: !!data.publicAccess || data.slot?.status === 'active', slot: data.slot });
      setTimeout(closeModal, 900);
    } catch (err) {
      alertBox(err.message || 'Could not reserve slot. Try again.', true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm Slot';
    }
  }

  function updateUi(status) {
    const banner = $('qvSlotBanner');
    const wall = $('qvAccessWall');
    const hidden = read('banner_hidden');
    const token = read('access_token');
    const reservedMonth = status.slot?.month || read('slot_month');
    const reservedStatus = status.slot?.status || read('slot_status');

    if (status.publicAccess) {
      document.body.classList.remove('qv-locked');
      wall.style.display = 'none';
      if (reservedMonth && reservedStatus) {
        $('qvSlotTitle').textContent = 'Your Quvirl research slot is reserved';
        $('qvSlotText').textContent = `Your access slot for ${monthName(reservedMonth)} is saved on this device. Public access is still open this month.`;
        $('qvSlotOpen').textContent = 'Slot Reserved';
        $('qvSlotOpen').disabled = true;
        $('qvSlotMini').textContent = reservedStatus === 'active' ? 'Confirmed monthly slot' : 'Waitlist saved';
        banner.style.display = 'block';
        return;
      }
      $('qvSlotTitle').textContent = 'Free research access is open this month';
      $('qvSlotText').textContent = 'From next month, full Quvirl product research will be limited to confirmed monthly slots. Reserve your free slot now.';
      $('qvSlotOpen').textContent = 'Reserve Free Slot';
      $('qvSlotOpen').disabled = false;
      $('qvSlotMini').textContent = `Limit: ${(status.slotLimit || CFG.slotLimit).toLocaleString('en-IN')} confirmed users per month.`;
      if (!hidden) banner.style.display = 'block';
      return;
    }

    if (status.hasAccess || token) {
      document.body.classList.remove('qv-locked');
      wall.style.display = 'none';
      $('qvSlotTitle').textContent = 'Research access active';
      $('qvSlotText').textContent = reservedMonth ? `You are using your confirmed Quvirl research slot for ${monthName(reservedMonth)}.` : 'Your confirmed Quvirl research slot is active.';
      $('qvSlotOpen').textContent = 'Access Active';
      $('qvSlotOpen').disabled = true;
      $('qvSlotMini').textContent = status.remainingSlots !== undefined ? `${status.remainingSlots.toLocaleString('en-IN')} slots left this month.` : '';
      banner.style.display = hidden ? 'none' : 'block';
      return;
    }

    document.body.classList.add('qv-locked');
    wall.style.display = 'flex';
    banner.style.display = 'none';
    if (status.remainingSlots === 0) {
      $('qvWallTitle').textContent = 'This month’s Quvirl slots are full';
      $('qvWallText').textContent = 'Reserve your next-month research slot to view full product research when the next access window opens.';
      $('qvWallClaim').textContent = 'Reserve Next Month Slot';
    } else {
      $('qvWallTitle').textContent = 'Claim your Quvirl research slot';
      $('qvWallText').textContent = 'Full product research is limited to confirmed monthly slots. Claim one of the remaining slots to view product scores, supplier links and demand signals.';
      $('qvWallClaim').textContent = 'Claim Research Access';
    }
  }

  async function init() {
    injectCss();
    buildUi();
    try {
      const status = await postJson(CFG.apiStatus, {
        deviceId: getDeviceId(),
        accessToken: read('access_token')
      });
      updateUi(status);
    } catch (err) {
      if (beforeLock()) {
        updateUi({ publicAccess: true, hasAccess: true, slotLimit: CFG.slotLimit });
      } else {
        document.body.classList.add('qv-locked');
        $('qvAccessWall').style.display = 'flex';
        wallAlert(err.message || 'Could not verify access. Try refreshing.', true);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
