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

  function saveConnectionFromCallback() {
    const shop = getParam('shopify_connected');
    const token = getParam('qv_shopify_token');

    if (shop && token) {
      localStorage.setItem('quvirl_shopify_shop', shop);
      localStorage.setItem('quvirl_shopify_token', token);

      const cleanUrl = window.location.href
        .replace(/[?&]shopify_connected=[^&]+/, '')
        .replace(/[?&]qv_shopify_token=[^&]+/, '')
        .replace('?&', '?')
        .replace(/\?$/, '');

      window.history.replaceState({}, document.title, cleanUrl);
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

  function createButton() {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:86px',
      'z-index:99999',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
      'align-items:flex-end'
    ].join(';');

    const connect = document.createElement('button');
    connect.textContent = 'Connect Shopify';
    connect.style.cssText = buttonStyle('#0d1117', '#30363d', '#f0f6fc');

    const add = document.createElement('button');
    add.textContent = 'Add to Shopify';
    add.style.cssText = buttonStyle('#16a34a', '#34d399', '#001b0b');

    connect.addEventListener('click', function () {
      let shop = prompt('Enter your Shopify store name or .myshopify.com domain');

      if (!shop) return;

      shop = shop.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

      const authUrl =
        '/api/shopify/auth' +
        '?shop=' + encodeURIComponent(shop) +
        '&returnUrl=' + encodeURIComponent(window.location.href);

      window.location.href = authUrl;
    });

    add.addEventListener('click', async function () {
      const shop = localStorage.getItem('quvirl_shopify_shop');
      const installToken = localStorage.getItem('quvirl_shopify_token');

      if (!shop || !installToken) {
        alert('Please connect your Shopify store first.');
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
      }
    });

    wrap.appendChild(connect);
    wrap.appendChild(add);
    document.body.appendChild(wrap);
  }

  function buttonStyle(bg, border, color) {
    return [
      'border:1px solid ' + border,
      'background:' + bg,
      'color:' + color,
      'font-weight:800',
      'border-radius:999px',
      'padding:12px 16px',
      'box-shadow:0 14px 40px rgba(0,0,0,.35)',
      'cursor:pointer',
      'font-size:14px'
    ].join(';');
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
