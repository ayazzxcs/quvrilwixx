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

  if (!Number.isFinite(n) || n <= 0) {
    return '19.99';
  }

  return n.toFixed(2);
}

function safeUrl(value, fallback = 'https://quvirl.com') {
  const raw = clean(value);

  if (!raw) return fallback;

  try {
    return new URL(raw).href;
  } catch {
    return fallback;
  }
}

function tokenHash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function supplierPlatform(supplier) {
  const platform =
    supplier?.platform ||
    supplier?.supplierPlatform ||
    supplier?.supplier_platform ||
    '';

  if (String(platform).toLowerCase() === 'cjdropshipping') {
    return 'cjdropshipping';
  }

  if (String(platform).toLowerCase() === 'cj') {
    return 'cjdropshipping';
  }

  if (supplier?.vid || supplier?.variantId || supplier?.variantSku) {
    return 'cjdropshipping';
  }

  return 'aliexpress';
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

  if (rows[0].install_token_hash !== tokenHash(installToken)) {
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
    body: JSON.stringify({
      query,
      variables
    })
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

  const data = await shopifyGraphql(shop, accessToken, query, {
    handle
  });

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

  const data = await shopifyGraphql(shop, accessToken, mutation, {
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

  const errors = data.productVariantsBulkUpdate?.userErrors || [];

  if (errors.length) {
    throw new Error('Variant update failed: ' + JSON.stringify(errors));
  }

  return data;
}

async function saveSupplierSelection({ shop, product, supplier, shopifyProduct }) {
  if (!supplier) return;

  const platform = supplierPlatform(supplier);

  const hasAliExpressSupplier = Boolean(supplier.itemId);
  const hasCJSupplier = Boolean(supplier.pid || supplier.productId || supplier.vid || supplier.variantId);

  if (!hasAliExpressSupplier && !hasCJSupplier) return;

  const payload = {
    shop_domain: shop,
    quvirl_product_id: clean(product.id || product.slug || product.sourceUrl || product.title),
    quvirl_product_title: clean(product.title),

    supplier_platform: platform,
    supplier_item_id: platform === 'aliexpress' ? clean(supplier.itemId) : clean(supplier.pid || supplier.productId || ''),
    supplier_sku_id:
      platform === 'aliexpress'
        ? clean(supplier.skuId || '')
        : clean(supplier.vid || supplier.variantId || ''),
    supplier_url: supplier.productUrl ? safeUrl(supplier.productUrl, 'https://quvirl.com') : 'https://quvirl.com',
    supplier_title: clean(supplier.title || supplier.productName || ''),
    supplier_image_url: supplier.imageUrl ? safeUrl(supplier.imageUrl, 'https://quvirl.com') : 'https://quvirl.com',
    supplier_price: supplier.price ? String(supplier.price) : '',
    supplier_currency: supplier.currency ? String(supplier.currency) : '',

    raw_supplier_data: {
      supplier,
      shopifyProduct
    }
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/quvirl_supplier_selections`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error('Supplier selection save failed: ' + text);
  }
}

function buildSupplierBlock(supplier) {
  const platform = supplierPlatform(supplier);
  const isCJ = platform === 'cjdropshipping';

  if (!supplier || (!supplier.itemId && !supplier.pid && !supplier.productId && !supplier.vid)) {
    return `
      <h3>Supplier setup required</h3>
      <p>No supplier option was selected. Choose and verify a supplier before publishing this product.</p>
    `;
  }

  if (isCJ) {
    return `
      <h3>Selected CJdropshipping supplier</h3>
      <ul>
        <li><strong>Supplier product:</strong> ${clean(supplier.title || supplier.productName || 'CJdropshipping product')}</li>
        <li><strong>CJ product ID:</strong> ${clean(supplier.pid || supplier.productId || '')}</li>
        <li><strong>CJ variant ID:</strong> ${clean(supplier.vid || supplier.variantId || '')}</li>
        ${supplier.variantSku ? `<li><strong>CJ variant SKU:</strong> ${clean(supplier.variantSku)}</li>` : ''}
        ${supplier.variantKey || supplier.selectedVariant ? `<li><strong>Selected variant:</strong> ${clean(supplier.variantKey || supplier.selectedVariant)}</li>` : ''}
        ${supplier.variantStock ? `<li><strong>Variant stock:</strong> ${clean(supplier.variantStock)}</li>` : ''}
        ${supplier.price ? `<li><strong>Supplier price:</strong> ${clean(supplier.price)} ${clean(supplier.currency || 'USD')}</li>` : ''}
        ${supplier.fromCountryCode ? `<li><strong>Ships from:</strong> ${clean(supplier.fromCountryCode)}</li>` : ''}
        ${supplier.productUrl ? `<li><strong>Supplier URL:</strong> ${safeUrl(supplier.productUrl)}Open CJ supplier</a></li>` : ''}
      </ul>
    `;
  }

  return `
    <h3>Selected AliExpress supplier</h3>
    <ul>
      <li><strong>Supplier product:</strong> ${clean(supplier.title || 'AliExpress product')}</li>
      <li><strong>Supplier item ID:</strong> ${clean(supplier.itemId || '')}</li>
      ${supplier.skuId ? `<li><strong>Supplier SKU ID:</strong> ${clean(supplier.skuId)}</li>` : ''}
      ${supplier.skuAttr ? `<li><strong>Supplier SKU attribute:</strong> ${clean(supplier.skuAttr)}</li>` : ''}
      ${supplier.selectedVariant ? `<li><strong>Selected variant:</strong> ${clean(supplier.selectedVariant)}</li>` : ''}
      ${supplier.variantStock ? `<li><strong>Variant stock:</strong> ${clean(supplier.variantStock)}</li>` : ''}
      ${supplier.price ? `<li><strong>Supplier price:</strong> ${clean(supplier.price)} ${clean(supplier.currency || '')}</li>` : ''}
      ${supplier.orders ? `<li><strong>Orders:</strong> ${clean(supplier.orders)}</li>` : ''}
      ${supplier.rating ? `<li><strong>Rating:</strong> ${clean(supplier.rating)}</li>` : ''}
      ${supplier.productUrl ? `<li><strong>Supplier URL:</strong> " target="_blank" rel="noopener noreferrer">Open AliExpress supplier</a></li>` : ''}
    </ul>
  `;
}

function buildDescription({ title, category, score, sourceUrl, supplier }) {
  const supplierBlock = buildSupplierBlock(supplier);

  return `
    <h2>${title}</h2>

    <p><strong>Imported from Quvirl product research.</strong></p>

    <ul>
      <li><strong>Category:</strong> ${category}</li>
      ${score ? `<li><strong>Quvirl score:</strong> ${score}</li>` : ''}
      <li><strong>Source research page:</strong> " target="_blank" rel="noopener noreferrer">Open Quvirl product research</a></li>
    </ul>

    ${supplierBlock}

    <p><em>Important: This product is imported as a draft. Before publishing, review supplier product, variant, cost, shipping time, stock, product quality, pricing, and fulfillment setup.</em></p>
  `;
}

function buildMetafields({ supplier, sourceUrl }) {
  const platform = supplierPlatform(supplier);
  const isCJ = platform === 'cjdropshipping';

  const fields = [
    {
      namespace: 'quvirl',
      key: 'supplier_platform',
      type: 'single_line_text_field',
      value: isCJ ? 'cjdropshipping' : 'aliexpress'
    },
    {
      namespace: 'quvirl',
      key: 'supplier_status',
      type: 'single_line_text_field',
      value:
        supplier && (supplier.itemId || supplier.pid || supplier.productId || supplier.vid || supplier.variantId)
          ? 'supplier_selected'
          : 'supplier_setup_required'
    },

    // AliExpress fields
    {
      namespace: 'quvirl',
      key: 'supplier_item_id',
      type: 'single_line_text_field',
      value: supplier?.itemId || ''
    },
    {
      namespace: 'quvirl',
      key: 'supplier_sku_id',
      type: 'single_line_text_field',
      value: supplier?.skuId || ''
    },
    {
      namespace: 'quvirl',
      key: 'supplier_sku_attr',
      type: 'single_line_text_field',
      value: supplier?.skuAttr || ''
    },

    // CJ fields
    {
      namespace: 'quvirl',
      key: 'cj_product_id',
      type: 'single_line_text_field',
      value: supplier?.pid || supplier?.productId || ''
    },
    {
      namespace: 'quvirl',
      key: 'cj_variant_id',
      type: 'single_line_text_field',
      value: supplier?.vid || supplier?.variantId || ''
    },
    {
      namespace: 'quvirl',
      key: 'cj_variant_sku',
      type: 'single_line_text_field',
      value: supplier?.variantSku || ''
    },
    {
      namespace: 'quvirl',
      key: 'cj_variant_key',
      type: 'single_line_text_field',
      value: supplier?.variantKey || supplier?.selectedVariant || ''
    },
    {
      namespace: 'quvirl',
      key: 'cj_from_country_code',
      type: 'single_line_text_field',
      value: supplier?.fromCountryCode || supplier?.countryCode || 'CN'
    },

    // Shared supplier fields
    {
      namespace: 'quvirl',
      key: 'supplier_variant',
      type: 'single_line_text_field',
      value: supplier?.selectedVariant || supplier?.variantKey || ''
    },
    {
      namespace: 'quvirl',
      key: 'supplier_stock',
      type: 'single_line_text_field',
      value: supplier?.variantStock ? String(supplier.variantStock) : ''
    },
    {
      namespace: 'quvirl',
      key: 'supplier_url',
      type: 'url',
      value: supplier?.productUrl ? safeUrl(supplier.productUrl) : ''
    },
    {
      namespace: 'quvirl',
      key: 'supplier_title',
      type: 'single_line_text_field',
      value: supplier?.title || supplier?.productName || ''
    },
    {
      namespace: 'quvirl',
      key: 'supplier_price',
      type: 'single_line_text_field',
      value: supplier?.price ? String(supplier.price) : ''
    },
    {
      namespace: 'quvirl',
      key: 'source_url',
      type: 'url',
      value: safeUrl(sourceUrl)
    },
    {
      namespace: 'quvirl',
      key: 'fulfillment_note',
      type: 'multi_line_text_field',
      value: isCJ
        ? 'Selected CJdropshipping supplier and variant ID data was attached by Quvirl. Review supplier, variant, price, shipping, and fulfillment setup before publishing.'
        : 'Selected AliExpress supplier and SKU attribute data was attached by Quvirl. Review supplier, variant, price, shipping, and fulfillment setup before publishing.'
    }
  ];

  return fields.filter((field) => {
    if (field.type === 'url') return Boolean(field.value);

    return (
      field.value !== undefined &&
      field.value !== null &&
      String(field.value).trim() !== ''
    );
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed'
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Missing Supabase secrets'
      });
    }

    const { shop, installToken, product, supplier } = req.body || {};

    if (!shop || !installToken || !product) {
      return res.status(400).json({
        ok: false,
        error: 'Missing shop, installToken, or product'
      });
    }

    const store = await getStore(shop, installToken);

    if (!store) {
      return res.status(401).json({
        ok: false,
        error: 'Shopify store is not connected or token is invalid'
      });
    }

    const title = clean(product.title || 'Quvirl Trending Product');
    const category = clean(product.category || 'Trending Product');
    const imageUrl = clean(product.imageUrl || supplier?.imageUrl || '');
    const sourceUrl = safeUrl(product.sourceUrl || 'https://quvirl.com');
    const score = clean(product.score || '');
    const price = money(product.price || supplier?.price || 19.99);

    const handle = `quvirl-${slugify(title)}`;
    const platform = supplierPlatform(supplier);

    const sku =
      platform === 'cjdropshipping'
        ? supplier?.variantSku
          ? `QV-CJ-${slugify(supplier.variantSku).slice(0, 32).toUpperCase()}`
          : supplier?.vid
            ? `QV-CJ-${slugify(supplier.vid).slice(0, 32).toUpperCase()}`
            : `QV-CJ-${slugify(title).slice(0, 32).toUpperCase()}`
        : supplier?.skuId
          ? `QV-AE-SKU-${slugify(supplier.skuId).slice(0, 32).toUpperCase()}`
          : supplier?.itemId
            ? `QV-AE-${slugify(supplier.itemId).slice(0, 32).toUpperCase()}`
            : `QV-${slugify(title).slice(0, 32).toUpperCase()}`;

    const existing = await productByHandle(shop, store.access_token, handle);

    if (existing) {
      await saveSupplierSelection({
        shop,
        product: {
          ...product,
          title,
          sourceUrl
        },
        supplier,
        shopifyProduct: existing
      });

      return res.status(200).json({
        ok: true,
        status: 'exists',
        product: existing
      });
    }

    const tags = [
      'quvirl',
      'quvirl-import',
      'trending-product',
      platform === 'cjdropshipping'
        ? 'supplier-cjdropshipping'
        : 'supplier-aliexpress',
      supplier?.itemId || supplier?.pid || supplier?.productId || supplier?.vid || supplier?.variantId
        ? 'supplier-selected'
        : 'supplier-setup-required',
      platform === 'cjdropshipping'
        ? supplier?.vid || supplier?.variantId
          ? 'supplier-cj-variant-ready'
          : 'supplier-cj-variant-missing'
        : supplier?.skuAttr
          ? 'supplier-sku-ready'
          : 'supplier-sku-missing',
      'draft-review-required',
      category
    ].filter(Boolean);

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

    const variables = {
      product: {
        title,
        handle,
        descriptionHtml: buildDescription({
          title,
          category,
          score,
          sourceUrl,
          supplier
        }),
        vendor: 'Quvirl',
        productType: category,
        status: 'DRAFT',
        tags,
        metafields: buildMetafields({
          supplier,
          sourceUrl
        }),
        seo: {
          title: `${title} | Quvirl Product Research`,
          description: platform === 'cjdropshipping'
            ? 'Imported from Quvirl product research with selected CJdropshipping supplier and variant data. Review supplier, price, shipping, and fulfillment before publishing.'
            : 'Imported from Quvirl product research with selected AliExpress supplier and SKU data. Review supplier, price, shipping, and fulfillment before publishing.'
        }
      },
      media: imageUrl
        ? [
            {
              mediaContentType: 'IMAGE',
              originalSource: safeUrl(imageUrl),
              alt: title
            }
          ]
        : []
    };

    const data = await shopifyGraphql(shop, store.access_token, mutation, variables);
    const result = data.productCreate;

    if (result.userErrors && result.userErrors.length) {
      return res.status(400).json({
        ok: false,
        errors: result.userErrors
      });
    }

    const created = result.product;
    const variantId = created.variants?.nodes?.[0]?.id;

    if (variantId) {
      await updateVariant(shop, store.access_token, created.id, variantId, price, sku);
    }

    await saveSupplierSelection({
      shop,
      product: {
        ...product,
        title,
        sourceUrl
      },
      supplier,
      shopifyProduct: created
    });

    return res.status(200).json({
      ok: true,
      status: 'created',
      product: created
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
