(function () {
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function getMeta(name) {
    const meta =
      document.querySelector(`meta[property="${name}"]`) ||
      document.querySelector(`meta[name="${name}"]`);

    return meta ? meta.getAttribute('content') : '';
  }

  function getTitle() {
    const h1 = document.querySelector('h1');
    return (h1 && h1.textContent.trim()) || document.title || 'Quvirl Trending Product';
  }

  function getImage() {
    return getMeta('og:image') || getMeta('twitter:image') || '';
  }

  function getDescription() {
    return getMeta('description') || getMeta('og:description') || '';
  }

  function getConnectedShop() {
    return localStorage.getItem('quvirl_shopify_shop') || '';
  }

  function getInstallToken() {
    return localStorage.getItem('quvirl_shopify_token') || '';
  }

  function isConnected() {
    return Boolean(getConnectedShop() && getInstallToken());
  }

  function saveConnectionFromCallback() {
    const shop = getParam('shopify_connected');
    const token = getParam('qv_shopify_token');

    if (shop && token) {
      localStorage.setItem('quvirl_shopify_shop', shop);
      localStorage.setItem('quvirl_shopify_token', token);

      const url = new URL(window.location.href);
      url.searchParams.delete('shopify_connected');
      url.searchParams.delete('qv_shopify_token');

      window.history.replaceState({}, document.title, url.toString());
    }
  }

  function productPayload() {
    return {
      title: getTitle(),
      description: getDescription(),
      imageUrl: getImage(),
      sourceUrl: window.location.href,
      category: document.body.getAttribute('data-category') || 'Trending Product',
      price: '19.99'
    };
  }

  function createStyles() {
    if (document.getElementById('quvirl-shopify-styles')) return;

    const style = document.createElement('style');
    style.id = 'quvirl-shopify-styles';
    style.textContent = `
      .qv-shopify-floating {
        position: fixed;
        right: 18px;
        bottom: 86px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-end;
      }

      .qv-shopify-btn {
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 999px;
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
        transition: transform 0.15s ease, opacity 0.15s ease;
      }

      .qv-shopify-btn:active {
        transform: scale(0.98);
      }

      .qv-shopify-btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .qv-shopify-connect {
        background: #0d1117;
        color: #f0f6fc;
        border-color: #30363d;
      }

      .qv-shopify-disconnect {
        background: rgba(127, 29, 29, 0.92);
        color: #fff;
        border-color: rgba(248, 113, 113, 0.5);
      }

      .qv-shopify-add {
        background: linear-gradient(135deg, #22c55e, #14b8a6);
        color: #001b0b;
        border-color: rgba(52, 211, 153, 0.8);
      }

      .qv-shopify-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(2, 6, 23, 0.72);
        backdrop-filter: blur(10px);
      }

      .qv-shopify-overlay.qv-open {
        display: flex;
      }

      .qv-shopify-modal {
        width: min(94vw, 520px);
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 28px;
        padding: 22px;
        background:
          radial-gradient(circle at top left, rgba(34, 197, 94, 0.20), transparent 34%),
          linear-gradient(145deg, #0f172a, #020617);
        color: #e5eefb;
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
      }

      .qv-shopify-kicker {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding: 7px 11px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.12);
        border: 1px solid rgba(34, 197, 94, 0.28);
        color: #86efac;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .qv-shopify-title {
        margin: 0 0 8px;
        font-size: 26px;
        line-height: 1.07;
        font-weight: 950;
        color: #ffffff;
      }

      .qv-shopify-copy {
        margin: 0 0 18px;
        font-size: 14px;
        line-height: 1.55;
        color: #b7c4d7;
      }

      .qv-shopify-label {
        display: block;
        margin: 0 0 8px;
        font-size: 13px;
        color: #cbd5e1;
        font-weight: 800;
      }

      .qv-shopify-input {
        width: 100%;
        box-sizing: border-box;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.9);
        color: #ffffff;
        padding: 14px 14px;
        outline: none;
        font-size: 15px;
      }

      .qv-shopify-input:focus {
        border-color: rgba(34, 197, 94, 0.7);
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
      }

      .qv-shopify-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 18px;
      }

      .qv-shopify-action {
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 14px;
        padding: 12px 14px;
        font-size: 14px;
        font-weight: 900;
        cursor: pointer;
      }

      .qv-shopify-action-secondary {
        background: rgba(15, 23, 42, 0.85);
        color: #e2e8f0;
      }

      .qv-shopify-action-primary {
        background: linear-gradient(135deg, #22c55e, #14b8a6);
        color: #001b0b;
        border-color: rgba(52, 211, 153, 0.8);
      }

      .qv-shopify-status {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.16);
        color: #a7f3d0;
        font-size: 13px;
        line-height: 1.45;
        display: none;
      }

      .qv-shopify-status.qv-show {
        display: block;
      }

      @media (max-width: 560px) {
        .qv-shopify-floating {
          right: 14px;
          bottom: 72px;
        }

        .qv-shopify-btn {
          padding: 11px 14px;
          font-size: 13px;
        }

        .qv-shopify-modal {
          border-radius: 24px;
          padding: 20px;
        }

        .qv-shopify-title {
          font-size: 23px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeShop(shop) {
    shop = String(shop || '').trim().toLowerCase();
    shop = shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    if (!shop) return '';

    if (!shop.endsWith('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }

    return shop;
  }

  function openConnectModal() {
    let overlay = document.querySelector('.qv-shopify-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'qv-shopify-overlay';

      overlay.innerHTML = `
        <div class="qv-shopify-modal" role="dialog" aria-modal="true">
          <div class="qv-shopify-kicker">Shopify integration</div>
          <h2 class="qv-shopify-title">Connect your Shopify store</h2>
          <p class="qv-shopify-copy">
            Connect your store to add Quvirl product research picks directly to Shopify as draft products. You can review, edit, price, and publish them from your Shopify admin.
          </p>

          <label class="qv-shopify-label" for="qv-shopify-shop-input">
            Shopify store name or .myshopify.com domain
          </label>
          <input
            id="qv-shopify-shop-input"
            class="qv-shopify-input"
            type="text"
            placeholder="example-store.myshopify.com"
            autocomplete="off"
          />

          <div class="qv-shopify-status"></div>

          <div class="qv-shopify-actions">
            <button type="button" class="qv-shopify-action qv-shopify-action-secondary" data-qv-close>
              Cancel
            </button>
            <button type="button" class="qv-shopify-action qv-shopify-action-primary" data-qv-connect>
              Continue to Shopify
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (event) {
        if (event.target === overlay || event.target.hasAttribute('data-qv-close')) {
          closeConnectModal();
        }
      });

      overlay.querySelector('[data-qv-connect]').addEventListener('click', function () {
        const input = overlay.querySelector('#qv-shopify-shop-input');
        const status = overlay.querySelector('.qv-shopify-status');
        const shop = normalizeShop(input.value);

        if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
          status.textContent = 'Please enter a valid Shopify store domain, for example example-store.myshopify.com.';
          status.classList.add('qv-show');
          return;
        }

        status.textContent = 'Redirecting to Shopify approval...';
        status.classList.add('qv-show');

        const authUrl =
          '/api/shopify/auth' +
          '?shop=' + encodeURIComponent(shop) +
          '&returnUrl=' + encodeURIComponent(window.location.href);

        window.location.href = authUrl;
      });
    }

    overlay.classList.add('qv-open');

    setTimeout(function () {
      const input = overlay.querySelector('#qv-shopify-shop-input');
      if (input) input.focus();
    }, 50);
  }

  function closeConnectModal() {
    const overlay = document.querySelector('.qv-shopify-overlay');
    if (overlay) overlay.classList.remove('qv-open');
  }

  function createButton() {
    createStyles();

    const wrap = document.createElement('div');
    wrap.className = 'qv-shopify-floating';

    const connection = document.createElement('button');
    connection.type = 'button';
    connection.className = 'qv-shopify-btn';

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'qv-shopify-btn qv-shopify-add';
    add.textContent = 'Add to Shopify';

    function refreshConnectionButton() {
      if (isConnected()) {
        connection.textContent = 'Disconnect Shopify';
        connection.className = 'qv-shopify-btn qv-shopify-disconnect';
        connection.title = 'Connected to ' + getConnectedShop();
      } else {
        connection.textContent = 'Connect Shopify';
        connection.className = 'qv-shopify-btn qv-shopify-connect';
        connection.title = 'Connect a Shopify store';
      }
    }

    connection.addEventListener('click', function () {
      if (isConnected()) {
        const shop = getConnectedShop();

        const confirmed = confirm(
          'Disconnect Shopify store ' + shop + '? This will remove the saved connection from this browser.'
        );

        if (!confirmed) return;

        localStorage.removeItem('quvirl_shopify_shop');
        localStorage.removeItem('quvirl_shopify_token');

        refreshConnectionButton();
        alert('Shopify disconnected from this browser.');
        return;
      }

      openConnectModal();
    });

    add.addEventListener('click', async function () {
      const shop = getConnectedShop();
      const installToken = getInstallToken();

      if (!shop || !installToken) {
        openConnectModal();
        return;
      }

      add.disabled = true;
      add.textContent = 'Adding...';

      try {
        const response = await fetch('/api/shopify/add-product', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            shop,
            installToken,
            product: productPayload()
          })
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || JSON.stringify(result.errors || result));
        }

        if (result.status === 'exists') {
          alert('This product already exists in your Shopify store.');
        } else {
          alert('Product added to Shopify as a draft.');
        }
      } catch (error) {
        alert('Failed to add product: ' + error.message);
      } finally {
        add.disabled = false;
        add.textContent = 'Add to Shopify';
        refreshConnectionButton();
      }
    });

    refreshConnectionButton();

    wrap.appendChild(connection);
    wrap.appendChild(add);
    document.body.appendChild(wrap);
  }

  function shouldShow() {
    const path = window.location.pathname;

    if (path === '/') return false;
    if (path.includes('privacy')) return false;
    if (path.includes('terms')) return false;
    if (path.includes('contact')) return false;
    if (path.includes('about')) return false;
    if (path.includes('slot-verify')) return false;

    return true;
  }

  saveConnectionFromCallback();

  if (shouldShow()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createButton);
    } else {
      createButton();
    }
  }
})();
