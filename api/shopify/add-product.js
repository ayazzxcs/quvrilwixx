const crypto = require('crypto');

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '19.99';
  return n.toFixed(2);
}

async function getStore(shop, installToken) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shopify_stores?shop_domain=eq.${encodeURIComponent(shop)}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const rows = await response.json();

  if (!response.ok || !rows.length) {
    return null;
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(String(installToken || ''))
    .digest('hex');

  if (rows[0].install_token_hash !== tokenHash) {
    return null;
  }

  return rows[0];
}

async function shopifyGraphql(shop, accessToken, query, variables = {}) {
  const endpoint = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();

  if (!response.ok || json.errors) {
    throw new Error(JSON.stringify(json));
  }

  return json.data;
}

async function productByHandle(shop, accessToken, handle) {
  const query = `
    query productByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        handle
      }
    }
  `;

  const data = await shopifyGraphql(shop, accessToken, query, { handle });
  return data.productByHandle;
}

async function updateVariant(shop, accessToken, productId, variantId, price, sku) {
  const mutation = `
    mutation updateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          sku
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  return shopifyGraphql(shop, accessToken, mutation, {
    productId,
    variants: [
      {
        id: variantId,
        price,
        inventoryItem: {
          sku
        }
      }
    ]
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ ok: false, error: 'Missing Supabase secrets' });
    }

    const { shop, installToken, product } = req.body || {};

    if (!shop || !installToken || !product) {
      return res.status(400).json({ ok: false, error: 'Missing shop, installToken, or product' });
    }

    const store = await getStore(shop, installToken);

    if (!store) {
      return res.status(401).json({ ok: false, error: 'Shopify store is not connected or token is invalid' });
    }

    const title = clean(product.title || 'Quvirl Trending Product');
    const category = clean(product.category || 'Trending Product');
    const imageUrl = clean(product.imageUrl || '');
    const sourceUrl = clean(product.sourceUrl || 'https://quvirl.com');
    const score = clean(product.score || '');
    const price = money(product.price || 19.99);
    const handle = `quvirl-${slugify(title)}`;
    const sku = `QV-${slugify(title).slice(0, 32).toUpperCase()}`;

    const existing = await productByHandle(shop, store.access_token, handle);

    if (existing) {
      return res.status(200).json({
        ok: true,
        status: 'exists',
        product: existing
      });
    }

    const descriptionHtml = `
      <h2>${title}</h2>
      <p><strong>Imported from Quvirl product research.</strong></p>
      <ul>
        <li><strong>Category:</strong> ${category}</li>
        ${score ? `<li><strong>Quvirl score:</strong> ${score}</li>` : ''}
        <li><strong>Source research page:</strong> ${sourceUrl}${sourceUrl}</a></li>
      </ul>
      <p><em>Review supplier availability, shipping time, price, product quality, and fulfillment setup before publishing.</em></p>
    `;

    const mutation = `
      mutation createProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
          product {
            id
            title
            handle
            variants(first: 1) {
              nodes {
                id
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await shopifyGraphql(shop, store.access_token, mutation, {
      product: {
        title,
        handle,
        descriptionHtml,
        vendor: 'Quvirl',
        productType: category,
        status: 'DRAFT',
        tags: ['quvirl', 'quvirl-import', 'trending-product', category],
        seo: {
          title: `${title} | Quvirl Product Research`,
          description: 'Imported from Quvirl product research. Review supplier, price, shipping, and fulfillment before publishing.'
        }
      },
      media: imageUrl
        ? [
            {
              mediaContentType: 'IMAGE',
              originalSource: imageUrl,
              alt: title
            }
          ]
        : []
    });

    const result = data.productCreate;

    if (result.userErrors && result.userErrors.length) {
      return res.status(400).json({ ok: false, errors: result.userErrors });
    }

    const created = result.product;
    const variantId = created.variants?.nodes?.[0]?.id;

    if (variantId) {
      await updateVariant(shop, store.access_token, created.id, variantId, price, sku);
    }

    return res.status(200).json({
      ok: true,
      status: 'created',
      product: created
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};
