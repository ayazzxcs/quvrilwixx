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
    const metaImage = getMeta('og:image') || getMeta('twitter:image');

    if (metaImage && !metaImage.includes('logo') && !metaImage.includes('icon')) {
      try {
        return new URL(metaImage, window.location.origin).href;
      } catch {
        return metaImage;
      }
    }

    const images = Array.from(document.querySelectorAll('img'))
      .map((img) => {
        const src =
          img.currentSrc ||
          img.getAttribute('src') ||
          img.getAttribute('data-src') ||
          img.getAttribute('data-original') ||
          '';

        let absolute = '';

        try {
          absolute = src ? new URL(src, window.location.origin).href : '';
        } catch {
          absolute = src;
        }

        return {
          src: absolute,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0,
          area: (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0)
        };
      })
      .filter((item) => {
        if (!item.src) return false;
        if (item.src.startsWith('data:')) return false;
        if (item.src.includes('logo')) return false;
        if (item.src.includes('icon')) return false;
        if (item.src.includes('favicon')) return false;
        if (item.width < 120 || item.height < 120) return false;
        return true;
      })
      .sort((a, b) => b.area - a.area);

    return images.length ? images[0].src : '';
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
      id: document.body.getAttribute('data-product-id') || window.location.pathname,
      title: getTitle(),
      description: getDescription(),
      imageUrl: getImage(),
      sourceUrl: window.location.href,
      category: document.body.getAttribute('data-category') || 'Trending Product',
      price: '19.99',
      score: document.body.getAttribute('data-quvirl-score') || ''
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

      .qv-overlay {
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

      .qv-overlay.qv-open {
        display: flex;
      }

      .qv-modal {
        width: min(94vw, 760px);
        max-height: 88vh;
        overflow: auto;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 28px;
        padding: 22px;
        background:
          radial-gradient(circle at top left, rgba(34, 197, 94, 0.20), transparent 34%),
          linear-gradient(145deg, #0f172a, #020617);
        color: #e5eefb;
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
      }

      .qv-kicker {
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

      .qv-title {
        margin: 0 0 8px;
        font-size: 26px;
        line-height: 1.07;
        font-weight: 950;
        color: #ffffff;
      }

      .qv-copy {
        margin: 0 0 18px;
        font-size: 14px;
        line-height: 1.55;
        color: #b7c4d7;
      }

      .qv-label {
        display: block;
        margin: 0 0 8px;
        font-size: 13px;
        color: #cbd5e1;
        font-weight: 800;
      }

      .qv-input {
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

      .qv-input:focus {
        border-color: rgba(34, 197, 94, 0.7);
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
      }

      .qv-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 18px;
      }

      .qv-action {
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 14px;
        padding: 12px 14px;
        font-size: 14px;
        font-weight: 900;
        cursor: pointer;
      }

      .qv-secondary {
        background: rgba(15, 23, 42, 0.85);
        color: #e2e8f0;
      }

      .qv-primary {
        background: linear-gradient(135deg, #22c55e, #14b8a6);
        color: #001b0b;
        border-color: rgba(52, 211, 153, 0.8);
      }

      .qv-status {
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

      .qv-status.qv-show {
        display: block;
      }

      .qv-supplier-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(215px, 1fr));
        gap: 12px;
        margin-top: 16px;
      }

      .qv-supplier-card {
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 18px;
        overflow: hidden;
        background: rgba(15, 23, 42, 0.82);
      }

      .qv-supplier-card img {
        width: 100%;
        height: 150px;
        object-fit: cover;
        background: #020617;
      }

      .qv-supplier-body {
        padding: 12px;
      }

      .qv-supplier-title {
        margin: 0 0 8px;
        color: #fff;
        font-size: 13px;
        line-height: 1.35;
        font-weight: 800;
        min-height: 52px;
      }

      .qv-supplier-meta {
        color: #a7f3d0;
        font-size: 12px;
        line-height: 1.45;
        margin-bottom: 10px;
      }

      .qv-supplier-select {
        width: 100%;
        border: 1px solid rgba(52, 211, 153, 0.55);
        border-radius: 12px;
        background: linear-gradient(135deg, #22c55e, #14b8a6);
        color: #001b0b;
        padding: 10px 11px;
        font-weight: 900;
        cursor: pointer;
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

        .qv-modal {
          border-radius: 24px;
          padding: 20px;
        }

        .qv-title {
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
    let overlay = document.querySelector('.qv-connect-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'qv-overlay qv-connect-overlay';

      overlay.innerHTML = `
        <div class="qv-modal" role="dialog" aria-modal="true">
          <div class="qv-kicker">Shopify integration</div>
          <h2 class="qv-title">Connect your Shopify store</h2>
          <p class="qv-copy">
            Connect your store to add Quvirl product research picks directly to Shopify as draft products.
          </p>

          <label class="qv-label" for="qv-shopify-shop-input">
            Shopify store name or .myshopify.com domain
          </label>
          <input
            id="qv-shopify-shop-input"
            class="qv-input"
            type="text"
            placeholder="example-store.myshopify.com"
            autocomplete="off"
          />

          <div class="qv-status"></div>

          <div class="qv-actions">
            <button type="button" class="qv-action qv-secondary" data-qv-close>
              Cancel
            </button>
            <button type="button" class="qv-action qv-primary" data-qv-connect>
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
        const status = overlay.querySelector('.qv-status');
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
    const overlay = document.querySelector('.qv-connect-overlay');
    if (overlay) overlay.classList.remove('qv-open');
  }

  function openSupplierModal() {
    let overlay = document.querySelector('.qv-supplier-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'qv-overlay qv-supplier-overlay';

      overlay.innerHTML = `
        <div class="qv-modal" role="dialog" aria-modal="true">
          <div class="qv-kicker">AliExpress supplier</div>
          <h2 class="qv-title">Choose a supplier option</h2>
          <p class="qv-copy">
            Quvirl will search AliExpress and attach your selected supplier data to the Shopify draft product.
          </p>

          <div class="qv-status qv-show">Searching AliExpress supplier options...</div>
          <div class="qv-supplier-grid"></div>

          <div class="qv-actions">
            <button type="button" class="qv-action qv-secondary" data-qv-close>
              Cancel
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (event) {
        if (event.target === overlay || event.target.hasAttribute('data-qv-close')) {
          closeSupplierModal();
        }
      });
    }

    overlay.classList.add('qv-open');
    searchSupplierOptions();
  }

  function closeSupplierModal() {
    const overlay = document.querySelector('.qv-supplier-overlay');
    if (overlay) overlay.classList.remove('qv-open');
  }

  async function searchSupplierOptions() {
    const overlay = document.querySelector('.qv-supplier-overlay');
    const grid = overlay.querySelector('.qv-supplier-grid');
    const status = overlay.querySelector('.qv-status');

    grid.innerHTML = '';
    status.textContent = 'Searching AliExpress supplier options...';
    status.classList.add('qv-show');

    try {
      const product = productPayload();

      const response = await fetch('/api/aliexpress/search-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keyword: product.title,
          shipToCountry: 'US',
          currency: 'USD'
        })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ? JSON.stringify(result.error) : 'AliExpress search failed');
      }

      if (!result.options || !result.options.length) {
        status.textContent = 'No AliExpress supplier options found. Try editing the product title or search keyword later.';
        return;
      }

      status.textContent = 'Select one supplier option to continue.';
      renderSupplierOptions(result.options);
    } catch (error) {
      status.textContent = 'Failed to load supplier options: ' + error.message;
    }
  }

  function renderSupplierOptions(options) {
    const overlay = document.querySelector('.qv-supplier-overlay');
    const grid = overlay.querySelector('.qv-supplier-grid');

    grid.innerHTML = '';

    options.forEach((supplier) => {
      const card = document.createElement('div');
      card.className = 'qv-supplier-card';

      card.innerHTML = `
        ${supplier.imageUrl ? `" alt="">` : ''}
        <div class="qv-supplier-body">
          <p class="qv-supplier-title">${escapeHtml(supplier.title || 'AliExpress product')}</p>
          <div class="qv-supplier-meta">
            ${supplier.price ? `Price: ${escapeHtml(String(supplier.price))} ${escapeHtml(supplier.currency || '')}<br>` : ''}
            ${supplier.orders ? `Orders: ${escapeHtml(String(supplier.orders))}<br>` : ''}
            ${supplier.rating ? `Rating: ${escapeHtml(String(supplier.rating))}<br>` : ''}
            ${supplier.itemId ? `Item ID: ${escapeHtml(String(supplier.itemId))}` : ''}
          </div>
          <button type="button" class="qv-supplier-select">Select supplier & add draft</button>
        </div>
      `;

      card.querySelector('.qv-supplier-select').addEventListener('click', function () {
        addToShopifyWithSupplier(supplier);
      });

      grid.appendChild(card);
    });
  }

  async function addToShopifyWithSupplier(supplier) {
    const overlay = document.querySelector('.qv-supplier-overlay');
    const status = overlay.querySelector('.qv-status');

    const shop = getConnectedShop();
    const installToken = getInstallToken();

    if (!shop || !installToken) {
      closeSupplierModal();
      openConnectModal();
      return;
    }

    status.textContent = 'Creating Shopify draft product with selected supplier...';
    status.classList.add('qv-show');

    try {
      const response = await fetch('/api/shopify/add-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop,
          installToken,
          product: productPayload(),
          supplier
        })
      });

      const text = await response.text();

      let result;
      try {
        result = JSON.parse(text);
        } catch (error) {
        throw new Error('Supplier API returned non-JSON response: ' + text.slice(0, 200));
        }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || JSON.stringify(result.errors || result));
      }

      if (result.status === 'exists') {
        status.textContent = 'This product already exists in your Shopify store. Supplier selection was saved.';
      } else {
        status.textContent = 'Product added to Shopify as a draft with selected AliExpress supplier data.';
      }

      setTimeout(closeSupplierModal, 1800);
    } catch (error) {
      status.textContent = 'Failed to add product: ' + error.message;
    }
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
          'Disconnect Shopify store ' + shop + '? This removes the saved connection from this browser.'
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

    add.addEventListener('click', function () {
      if (!isConnected()) {
        openConnectModal();
        return;
      }

      openSupplierModal();
    });

    refreshConnectionButton();

    wrap.appendChild(connection);
    wrap.appendChild(add);
    document.body.appendChild(wrap);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
