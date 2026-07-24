(function () {
  const cjSourcingCache = new Map();

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
      .filter((img) => !img.closest('.qv-overlay'))
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

  function formatApiError(value) {
    if (!value) return 'Unknown error';

    if (typeof value === 'string') return value;

    try {
      if (value.message) return value.message;
      if (value.error) return formatApiError(value.error);
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function appendImage(parent, imageUrl, altText) {
    if (!imageUrl) return;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = altText || 'Supplier product image';
    img.loading = 'lazy';
    parent.appendChild(img);
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
        width: min(94vw, 820px);
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

      .qv-supplier-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 14px 0 12px;
      }

      .qv-supplier-tab {
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 999px;
        padding: 9px 12px;
        background: rgba(15, 23, 42, 0.8);
        color: #dbeafe;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
      }

      .qv-supplier-tab.qv-active {
        background: linear-gradient(135deg, #22c55e, #14b8a6);
        color: #001b0b;
        border-color: rgba(52, 211, 153, 0.8);
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
        display: block;
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

      .qv-supplier-badge {
        display: inline-flex;
        margin-bottom: 8px;
        padding: 5px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 950;
        background: rgba(59, 130, 246, 0.18);
        color: #bfdbfe;
        border: 1px solid rgba(96, 165, 250, 0.35);
      }

      .qv-supplier-badge.qv-cj {
        background: rgba(250, 204, 21, 0.13);
        color: #fef08a;
        border-color: rgba(250, 204, 21, 0.35);
      }

      .qv-match {
        margin: 0 0 10px;
        padding: 8px 9px;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.16);
        color: #dbeafe;
        font-size: 11px;
        line-height: 1.45;
      }

      .qv-match strong {
        color: #a7f3d0;
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
          status.textContent =
            'Please enter a valid Shopify store domain, for example example-store.myshopify.com.';
          status.classList.add('qv-show');
          return;
        }

        status.textContent = 'Redirecting to Shopify approval...';
        status.classList.add('qv-show');

        const authUrl =
          '/api/shopify/auth' +
          '?shop=' +
          encodeURIComponent(shop) +
          '&returnUrl=' +
          encodeURIComponent(window.location.href);

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
          <div class="qv-kicker">Supplier selection</div>
          <h2 class="qv-title">Choose a supplier option</h2>
          <p class="qv-copy">
            AliExpress shows live supplier options. CJdropshipping uses the seller's connected CJ account for exact sourcing.
          </p>

          <div class="qv-supplier-tabs">
            <button type="button" class="qv-supplier-tab qv-active" data-source="aliexpress">
              AliExpress
            </button>
            <button type="button" class="qv-supplier-tab" data-source="cjdropshipping">
              CJdropshipping
            </button>
          </div>

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

      overlay.querySelectorAll('.qv-supplier-tab').forEach((button) => {
        button.addEventListener('click', function () {
          overlay.querySelectorAll('.qv-supplier-tab').forEach((tab) => {
            tab.classList.remove('qv-active');
          });

          button.classList.add('qv-active');
          searchSupplierOptions(button.getAttribute('data-source') || 'aliexpress');
        });
      });
    }

    overlay.classList.add('qv-open');

    const active = overlay.querySelector('.qv-supplier-tab.qv-active');
    const source = active ? active.getAttribute('data-source') : 'aliexpress';

    searchSupplierOptions(source || 'aliexpress');
  }

  function closeSupplierModal() {
    const overlay = document.querySelector('.qv-supplier-overlay');
    if (overlay) overlay.classList.remove('qv-open');
  }

  async function searchSupplierOptions(source) {
    const overlay = document.querySelector('.qv-supplier-overlay');
    const grid = overlay.querySelector('.qv-supplier-grid');
    const status = overlay.querySelector('.qv-status');

    grid.innerHTML = '';

    const supplierSource = source || 'aliexpress';
    const product = productPayload();

    if (supplierSource === 'cjdropshipping') {
      const shop = getConnectedShop();
      const installToken = getInstallToken();

      if (!shop || !installToken) {
        closeSupplierModal();
        openConnectModal();
        return;
      }

      status.textContent = 'Checking CJ connection...';
      status.classList.add('qv-show');

      try {
        const cjStatus = await getCJConnectionStatus();

        if (!cjStatus.connected) {
          status.textContent = 'Connect your CJdropshipping account first.';
          renderCJConnectCard(product);
          return;
        }

        await submitCJSourcingRequest(product);
      } catch (error) {
        status.textContent = 'Failed to check CJ connection: ' + formatApiError(error);
        renderCJConnectCard(product);
      }

      return;
    }

    status.textContent = 'Searching AliExpress supplier options...';
    status.classList.add('qv-show');

    try {
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

      const text = await response.text();

      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error('Supplier API returned non-JSON response: ' + text.slice(0, 200));
      }

      if (!response.ok || !result.ok) {
        throw new Error(formatApiError(result.error || result));
      }

      if (!result.options || !result.options.length) {
        status.textContent =
          'No AliExpress supplier options found. Try editing the product title or search keyword later.';
        return;
      }

      const normalized = result.options.map((option) => ({
        ...option,
        platform: 'aliexpress'
      }));

      status.textContent = 'Select one AliExpress supplier option to continue.';
      renderSupplierOptions(normalized, 'aliexpress');
    } catch (error) {
      status.textContent = 'Failed to load supplier options: ' + formatApiError(error);
    }
  }

  async function getCJConnectionStatus() {
    const shop = getConnectedShop();
    const installToken = getInstallToken();

    const response = await fetch('/api/cj/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'status',
        shop,
        installToken
      })
    });

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('CJ status API returned non-JSON response: ' + text.slice(0, 200));
    }

    if (!response.ok || !result.ok) {
      return {
        connected: false,
        error: result.error || result
      };
    }

    return result;
  }

  function renderCJConnectCard(product) {
    const overlay = document.querySelector('.qv-supplier-overlay');
    const grid = overlay.querySelector('.qv-supplier-grid');
    const status = overlay.querySelector('.qv-status');

    grid.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'qv-supplier-card';

    appendImage(card, product.imageUrl, product.title || 'CJ product');

    const body = document.createElement('div');
    body.className = 'qv-supplier-body';

    body.innerHTML = `
      <div class="qv-supplier-badge qv-cj">
        Connect CJdropshipping
      </div>

      <p class="qv-supplier-title">Connect your CJ account</p>

      <div class="qv-match">
        <strong>Paste your CJ API Key once</strong><br>
        Quvirl will use this seller CJ account for CJ sourcing and future CJ order creation.
      </div>

      <label class="qv-label" for="qv-cj-api-key">
        CJ API Key
      </label>

      <input
        id="qv-cj-api-key"
        class="qv-input"
        type="password"
        placeholder="CJUserNum@api@..."
        autocomplete="off"
      />

      <button type="button" class="qv-supplier-select" data-qv-connect-cj>
        Connect CJ & submit sourcing
      </button>
    `;

    card.appendChild(body);
    grid.appendChild(card);

    const button = body.querySelector('[data-qv-connect-cj]');

    button.addEventListener('click', async function () {
      const input = body.querySelector('#qv-cj-api-key');
      const apiKey = String(input.value || '').trim();

      if (!apiKey) {
        status.textContent = 'Please paste your CJ API key first.';
        status.classList.add('qv-show');
        return;
      }

      button.disabled = true;
      status.textContent = 'Connecting CJ account...';
      status.classList.add('qv-show');

      try {
        await connectCJAccount(apiKey);

        status.textContent = 'CJ connected. Submitting exact sourcing request...';

        await submitCJSourcingRequest(product);
      } catch (error) {
        status.textContent = 'Failed to connect CJ: ' + formatApiError(error);
        button.disabled = false;
      }
    });
  }

  async function connectCJAccount(apiKey) {
    const shop = getConnectedShop();
    const installToken = getInstallToken();

    if (!shop || !installToken) {
      throw new Error('Shopify must be connected first');
    }

    const response = await fetch('/api/cj/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'connect',
        shop,
        installToken,
        apiKey
      })
    });

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('CJ connect API returned non-JSON response: ' + text.slice(0, 200));
    }

    if (!response.ok || !result.ok) {
      throw new Error(formatApiError(result.error || result));
    }

    return result;
  }

  async function submitCJSourcingRequest(product) {
    const overlay = document.querySelector('.qv-supplier-overlay');
    const status = overlay.querySelector('.qv-status');

    const shop = getConnectedShop();
    const installToken = getInstallToken();

    if (!shop || !installToken) {
      throw new Error('Missing Shopify shop or install token');
    }

    const cacheKey = `${shop}|${product.id}|${product.title}|${product.imageUrl}`;

    if (cjSourcingCache.has(cacheKey)) {
      const cached = cjSourcingCache.get(cacheKey);
      status.textContent = 'Exact CJ supplier sourcing request already submitted.';
      renderCJSourcingSubmitted(cached, product);
      return;
    }

    status.textContent = 'Submitting exact CJ supplier sourcing request...';
    status.classList.add('qv-show');

    const response = await fetch('/api/cj/create-sourcing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shop,
        installToken,
        productName: product.title,
        productImage: product.imageUrl,
        productUrl: product.sourceUrl,
        price: product.price,
        quvirlProductId: product.id
      })
    });

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('CJ sourcing API returned non-JSON response: ' + text.slice(0, 200));
    }

    if (!response.ok || !result.ok) {
      throw new Error(formatApiError(result.error || result));
    }

    cjSourcingCache.set(cacheKey, result);

    status.textContent = 'Exact CJ supplier sourcing request submitted.';
    renderCJSourcingSubmitted(result, product);
  }

  function renderCJSourcingSubmitted(result, product) {
    const overlay = document.querySelector('.qv-supplier-overlay');
    const grid = overlay.querySelector('.qv-supplier-grid');

    const cjSourcingId = result.cjSourcingId || '';
    const sourcingRequestId = result.sourcingRequestId || '';

    grid.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'qv-supplier-card';

    appendImage(card, product.imageUrl, product.title || 'CJ sourcing product');

    const body = document.createElement('div');
    body.className = 'qv-supplier-body';

    body.innerHTML = `
      <div class="qv-supplier-badge qv-cj">
        CJdropshipping exact sourcing
      </div>

      <p class="qv-supplier-title">${escapeHtml(product.title)}</p>

      <div class="qv-match">
        <strong>Exact supplier request submitted</strong><br>
        CJ will source this product using the product image, title, and page URL.<br>
        ${
          cjSourcingId
            ? `CJ sourcing ID: ${escapeHtml(String(cjSourcingId))}<br>`
            : ''
        }
        ${
          sourcingRequestId
            ? `Quvirl request ID: ${escapeHtml(String(sourcingRequestId))}<br>`
            : ''
        }
      </div>

      <div class="qv-supplier-meta">
        Status: Waiting for CJ sourcing result<br>
        Product URL saved: Yes<br>
        Product image saved: ${product.imageUrl ? 'Yes' : 'No'}
      </div>

      ${
        cjSourcingId
          ? `<button type="button" class="qv-supplier-select" data-cj-check="${escapeHtml(String(cjSourcingId))}">
              Check CJ sourcing result
            </button>`
          : ''
      }
    `;

    card.appendChild(body);
    grid.appendChild(card);

    const checkButton = grid.querySelector('[data-cj-check]');

    if (checkButton) {
      checkButton.addEventListener('click', function () {
        checkCJSourcingResult(cjSourcingId);
      });
    }
  }

  async function checkCJSourcingResult(cjSourcingId) {
    const overlay = document.querySelector('.qv-supplier-overlay');
    const grid = overlay.querySelector('.qv-supplier-grid');
    const status = overlay.querySelector('.qv-status');

    if (!cjSourcingId) {
      status.textContent = 'Missing CJ sourcing ID.';
      status.classList.add('qv-show');
      return;
    }

    const shop = getConnectedShop();
    const installToken = getInstallToken();

    if (!shop || !installToken) {
      status.textContent = 'Missing Shopify connection. Please reconnect Shopify.';
      status.classList.add('qv-show');
      return;
    }

    status.textContent = 'Checking CJ sourcing result...';
    status.classList.add('qv-show');

    try {
      const response = await fetch('/api/cj/query-sourcing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop,
          installToken,
          cjSourcingId
        })
      });

      const text = await response.text();

      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error('CJ sourcing query returned non-JSON response: ' + text.slice(0, 200));
      }

      if (!response.ok || !result.ok) {
        throw new Error(formatApiError(result.error || result));
      }

      const sourced = result.result || {};
      const cjProductId = sourced.cjProductId || sourced.productId || '';
      const cjVariantId = sourced.variantId || '';
      const cjVariantSku = sourced.cjVariantSku || '';
      const sourceStatus = sourced.sourceStatus || '';
      const sourceStatusText = sourced.sourceStatusStr || '';

      if (!cjProductId && !cjVariantId) {
        status.textContent =
          'CJ has not returned a sourced product yet. Please check again later.';

        const existingCard = grid.querySelector('.qv-match');

        if (existingCard) {
          existingCard.innerHTML = `
            <strong>CJ sourcing still pending</strong><br>
            Status: ${escapeHtml(sourceStatus || 'Pending')}<br>
            ${
              sourceStatusText
                ? `Message: ${escapeHtml(sourceStatusText)}<br>`
                : ''
            }
            Please check again later.
          `;
        }

        return;
      }

      status.textContent = 'CJ sourced product found. Fetching product details...';

      const detailsResponse = await fetch('/api/cj/product-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: cjProductId,
          countryCode: 'US'
        })
      });

      const detailsText = await detailsResponse.text();

      let details;
      try {
        details = JSON.parse(detailsText);
      } catch {
        throw new Error('CJ product details returned non-JSON response: ' + detailsText.slice(0, 200));
      }

      if (!detailsResponse.ok || !details.ok || !details.selectedVariant) {
        throw new Error(formatApiError(details.error || details));
      }

      const supplier = {
        platform: 'cjdropshipping',
        pid: details.product?.pid || cjProductId,
        productId: details.product?.pid || cjProductId,
        title: details.product?.productName || 'CJ sourced product',
        productName: details.product?.productName || 'CJ sourced product',
        imageUrl: details.product?.imageUrl || '',
        price: details.selectedVariant.price || details.product?.sellPrice || '',
        currency: 'USD',
        vid: cjVariantId || details.selectedVariant.vid,
        variantId: cjVariantId || details.selectedVariant.vid,
        variantSku: cjVariantSku || details.selectedVariant.variantSku,
        variantKey: details.selectedVariant.variantKey || '',
        selectedVariant:
          details.selectedVariant.variantKey ||
          details.selectedVariant.variantName ||
          '',
        variantStock: details.selectedVariant.stock || 0,
        fromCountryCode: 'CN',
        sourcingId: cjSourcingId
      };

      status.textContent = 'CJ sourced supplier is ready. Review and select it.';
      renderSupplierOptions([supplier], 'cjdropshipping');
    } catch (error) {
      status.textContent = 'Failed to check CJ sourcing result: ' + formatApiError(error);
    }
  }

  function renderSupplierOptions(options, source) {
    const overlay = document.querySelector('.qv-supplier-overlay');
    const grid = overlay.querySelector('.qv-supplier-grid');

    grid.innerHTML = '';

    options.forEach((supplier) => {
      const platform = supplier.platform || source || 'aliexpress';
      const isCJ = platform === 'cjdropshipping';

      const title =
        supplier.title ||
        supplier.productName ||
        (isCJ ? 'CJdropshipping product' : 'AliExpress product');

      const itemId = isCJ ? supplier.pid || supplier.productId : supplier.itemId;
      const sku = isCJ ? supplier.variantSku || supplier.sku : supplier.skuId;
      const inventory = isCJ ? supplier.variantStock || supplier.inventory : '';
      const category = isCJ ? supplier.categoryName : '';

      const card = document.createElement('div');
      card.className = 'qv-supplier-card';

      appendImage(card, supplier.imageUrl, title);

      const body = document.createElement('div');
      body.className = 'qv-supplier-body';

      body.innerHTML = `
        <div class="qv-supplier-badge ${isCJ ? 'qv-cj' : ''}">
          ${isCJ ? 'CJdropshipping' : 'AliExpress'}
        </div>

        <p class="qv-supplier-title">${escapeHtml(title)}</p>

        <div class="qv-supplier-meta">
          ${supplier.price ? `Price: ${escapeHtml(String(supplier.price))} ${escapeHtml(supplier.currency || 'USD')}<br>` : ''}
          ${itemId ? `${isCJ ? 'PID' : 'Item ID'}: ${escapeHtml(String(itemId))}<br>` : ''}
          ${sku ? `SKU: ${escapeHtml(String(sku))}<br>` : ''}
          ${inventory ? `Inventory: ${escapeHtml(String(inventory))}<br>` : ''}
          ${category ? `Category: ${escapeHtml(String(category))}<br>` : ''}
          ${supplier.orders ? `Orders: ${escapeHtml(String(supplier.orders))}<br>` : ''}
          ${supplier.rating ? `Rating: ${escapeHtml(String(supplier.rating))}<br>` : ''}
        </div>

        <button type="button" class="qv-supplier-select">
          Select supplier & add draft
        </button>
      `;

      card.appendChild(body);

      const selectButton = body.querySelector('.qv-supplier-select');

      selectButton.addEventListener('click', function () {
        addToShopifyWithSupplier(supplier);
      });

      grid.appendChild(card);
    });
  }

  function getCJStockFromResponse(detailResult, countryCode) {
    const rows = detailResult?.stockResponse?.data || [];
    const targetCountry = String(countryCode || 'US').toUpperCase();

    const match = rows.find((row) => {
      return String(row.countryCode || '').toUpperCase() === targetCountry;
    });

    if (!match) {
      return detailResult?.selectedVariant?.stock || 0;
    }

    return Number(
      match.totalInventoryNum ||
        match.storageNum ||
        match.cjInventoryNum ||
        match.factoryInventoryNum ||
        detailResult?.selectedVariant?.stock ||
        0
    );
  }

  async function enrichAliExpressSupplier(supplier) {
    const detailResponse = await fetch('/api/aliexpress/product-details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId: supplier.itemId,
        shipToCountry: 'US',
        currency: 'USD',
        language: 'en'
      })
    });

    const detailText = await detailResponse.text();

    let detailResult;
    try {
      detailResult = JSON.parse(detailText);
    } catch {
      throw new Error('Product details API returned non-JSON response: ' + detailText.slice(0, 200));
    }

    if (!detailResponse.ok || !detailResult.ok || !detailResult.selectedSku) {
      throw new Error(formatApiError(detailResult.error || detailResult));
    }

    supplier.platform = 'aliexpress';
    supplier.skuAttr = detailResult.selectedSku.skuAttr;
    supplier.skuId = detailResult.selectedSku.skuId;
    supplier.selectedVariant = detailResult.selectedSku.label;
    supplier.variantPrice = detailResult.selectedSku.price;
    supplier.variantStock = detailResult.selectedSku.stock;

    if (detailResult.selectedSku.price) {
      supplier.price = detailResult.selectedSku.price;
    }

    if (detailResult.selectedSku.currency) {
      supplier.currency = detailResult.selectedSku.currency;
    }

    if (detailResult.selectedSku.imageUrl) {
      supplier.imageUrl = detailResult.selectedSku.imageUrl;
    }

    return supplier;
  }

  async function enrichCJSupplier(supplier) {
    const productId = supplier.pid || supplier.productId;

    if (!productId) {
      throw new Error('Missing CJ product ID');
    }

    const detailResponse = await fetch('/api/cj/product-details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId,
        countryCode: 'US'
      })
    });

    const detailText = await detailResponse.text();

    let detailResult;
    try {
      detailResult = JSON.parse(detailText);
    } catch {
      throw new Error('CJ product details API returned non-JSON response: ' + detailText.slice(0, 200));
    }

    if (!detailResponse.ok || !detailResult.ok || !detailResult.selectedVariant) {
      throw new Error(formatApiError(detailResult.error || detailResult));
    }

    const selected = detailResult.selectedVariant;
    const stock = getCJStockFromResponse(detailResult, 'US');

    supplier.platform = 'cjdropshipping';
    supplier.pid = detailResult.product?.pid || productId;
    supplier.productId = detailResult.product?.pid || productId;
    supplier.productName = detailResult.product?.productName || supplier.title || '';
    supplier.title = detailResult.product?.productName || supplier.title || '';
    supplier.vid = supplier.vid || selected.vid;
    supplier.variantId = supplier.variantId || selected.vid;
    supplier.variantSku = supplier.variantSku || selected.variantSku;
    supplier.variantKey = supplier.variantKey || selected.variantKey;
    supplier.selectedVariant = supplier.selectedVariant || selected.variantKey || selected.variantName;
    supplier.variantPrice = selected.price;
    supplier.variantStock = stock;
    supplier.fromCountryCode = supplier.fromCountryCode || (stock > 0 ? 'US' : 'CN');

    if (selected.price) {
      supplier.price = selected.price;
    }

    if (selected.currency) {
      supplier.currency = selected.currency;
    }

    if (selected.imageUrl) {
      supplier.imageUrl = selected.imageUrl;
    } else if (detailResult.product?.imageUrl) {
      supplier.imageUrl = detailResult.product.imageUrl;
    }

    return supplier;
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

    const platform = supplier.platform || 'aliexpress';
    const isCJ = platform === 'cjdropshipping';
    const sourceLabel = isCJ ? 'CJdropshipping' : 'AliExpress';

    status.textContent = `Fetching ${sourceLabel} variant details...`;
    status.classList.add('qv-show');

    try {
      const enrichedSupplier = isCJ
        ? await enrichCJSupplier(supplier)
        : await enrichAliExpressSupplier(supplier);

      status.textContent = `Creating Shopify draft product with selected ${sourceLabel} supplier and variant...`;

      const response = await fetch('/api/shopify/add-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop,
          installToken,
          product: productPayload(),
          supplier: enrichedSupplier
        })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(formatApiError(result.error || result.errors || result));
      }

      if (result.status === 'exists') {
        status.textContent = 'This product already exists in your Shopify store. Supplier selection was saved.';
      } else {
        status.textContent = `Product added to Shopify as a draft with selected ${sourceLabel} supplier and variant data.`;
      }

      setTimeout(closeSupplierModal, 1800);
    } catch (error) {
      status.textContent = 'Failed to add product: ' + formatApiError(error);
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
