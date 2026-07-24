const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CJ_PRODUCT_LIST_URL =
  'https://developers.cjdropshipping.com/api2.0/v1/product/listV2';

const STOP_WORDS = new Set([
  'casual',
  'solid',
  'color',
  'plus',
  'size',
  'fashion',
  'new',
  'hot',
  'sale',
  'men',
  'mens',
  'man',
  'women',
  'womens',
  'lady',
  'ladies',
  'for',
  'and',
  'with',
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'to'
]);

const IMPORTANT_TERMS = [
  'linen',
  'cotton',
  'shirt',
  'blouse',
  'hoodie',
  'sweater',
  'dress',
  'pants',
  'shorts',
  'jacket',
  'coat',
  'collar',
  'stand',
  'button',
  'sleeve',
  'short',
  'long',
  'vneck',
  'v-neck',
  'loose',
  'oversized',
  'summer',
  'beach',
  'solid',
  'plus'
];

const NEGATIVE_GROUPS = [
  ['long sleeve', 'long-sleeve'],
  ['women', 'womens', "women's", 'lady', 'ladies', 'blouse', 'dress'],
  ['hoodie', 'sweater', 'sweatshirt'],
  ['pants', 'trousers', 'jeans'],
  ['t-shirt', 'tshirt', 'tee']
];

async function getLatestCJConnection() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cj_connections?select=*&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const rows = await response.json();

  if (!response.ok || !Array.isArray(rows) || !rows.length || !rows[0].access_token) {
    throw new Error('No CJ access token found in Supabase');
  }

  return rows[0];
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[-_/]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .map((term) => term.trim())
    .filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getImportantTerms(title) {
  const normalized = normalizeText(title);
  const terms = tokenize(title);

  const picked = [];

  for (const term of terms) {
    if (IMPORTANT_TERMS.includes(term)) {
      picked.push(term);
    }

    if (!STOP_WORDS.has(term) && term.length >= 4) {
      picked.push(term);
    }
  }

  if (normalized.includes('stand collar') || normalized.includes('stand-collar')) {
    picked.push('stand', 'collar');
  }

  if (normalized.includes('button up') || normalized.includes('button-up')) {
    picked.push('button');
  }

  if (normalized.includes('short sleeve') || normalized.includes('short-sleeve')) {
    picked.push('short', 'sleeve');
  }

  if (normalized.includes('long sleeve') || normalized.includes('long-sleeve')) {
    picked.push('long', 'sleeve');
  }

  return unique(picked).slice(0, 12);
}

function buildSearchKeywords(title, category) {
  const normalized = normalizeText(`${title} ${category || ''}`);
  const terms = getImportantTerms(normalized);

  const keywords = [];

  const hasLinen = normalized.includes('linen');
  const hasStandCollar =
    normalized.includes('stand collar') ||
    normalized.includes('stand-collar') ||
    (normalized.includes('stand') && normalized.includes('collar'));
  const hasShortSleeve =
    normalized.includes('short sleeve') ||
    normalized.includes('short-sleeve') ||
    (normalized.includes('short') && normalized.includes('sleeve'));
  const hasButton =
    normalized.includes('button') ||
    normalized.includes('button up') ||
    normalized.includes('button-up');
  const hasShirt =
    normalized.includes('shirt') ||
    normalized.includes('top') ||
    normalized.includes('blouse');

  if (hasLinen && hasStandCollar && hasShortSleeve) {
    keywords.push('linen stand collar short sleeve shirt');
  }

  if (hasLinen && hasButton) {
    keywords.push('button up linen shirt');
  }

  if (hasLinen && hasShortSleeve) {
    keywords.push('short sleeve linen shirt');
  }

  if (hasStandCollar && hasShirt) {
    keywords.push('stand collar shirt');
  }

  if (terms.length) {
    keywords.push(terms.slice(0, 6).join(' '));
  }

  keywords.push(
    normalizeText(title)
      .split(' ')
      .filter((term) => !STOP_WORDS.has(term))
      .slice(0, 8)
      .join(' ')
  );

  keywords.push(normalizeText(title));

  return unique(keywords)
    .filter((keyword) => keyword.length >= 3)
    .slice(0, 5);
}

function normalizeCJProducts(json, searchKeywordUsed) {
  const content = json.data?.content || [];
  const products = [];

  for (const group of content) {
    const productList = group.productList || [];

    for (const product of productList) {
      products.push({
        platform: 'cjdropshipping',
        productId: product.id || product.pid || '',
        pid: product.id || product.pid || '',
        title: product.nameEn || product.productNameEn || '',
        sku: product.sku || product.spu || product.productSku || '',
        imageUrl: product.bigImage || product.productImage || '',
        price: product.nowPrice || product.sellPrice || product.discountPrice || '',
        currency: 'USD',
        categoryId: product.categoryId || '',
        categoryName:
          product.threeCategoryName ||
          product.categoryName ||
          product.oneCategoryName ||
          '',
        listedNum: product.listedNum || '',
        inventory:
          product.warehouseInventoryNum ||
          product.totalVerifiedInventory ||
          product.totalUnVerifiedInventory ||
          '',
        deliveryCycle: product.deliveryCycle || '',
        searchKeywordUsed,
        raw: product
      });
    }
  }

  return products;
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(normalizeText(term)));
}

function scoreProduct(product, originalTitle, category) {
  const title = normalizeText(product.title);
  const combined = normalizeText(`${product.title} ${product.categoryName || ''}`);
  const original = normalizeText(`${originalTitle || ''} ${category || ''}`);
  const wantedTerms = getImportantTerms(original);

  let score = 0;
  const matchedTerms = [];
  const penaltyTerms = [];

  for (const term of wantedTerms) {
    if (!term) continue;

    if (combined.includes(term)) {
      score += 8;
      matchedTerms.push(term);
    }
  }

  const originalTokens = tokenize(original).filter((term) => !STOP_WORDS.has(term));

  for (const term of originalTokens) {
    if (combined.includes(term)) {
      score += 3;
    }
  }

  if (original.includes('linen') && combined.includes('linen')) score += 18;
  if (original.includes('collar') && combined.includes('collar')) score += 12;
  if (original.includes('stand') && combined.includes('stand')) score += 10;
  if (original.includes('button') && combined.includes('button')) score += 10;
  if (original.includes('short') && combined.includes('short')) score += 8;
  if (original.includes('sleeve') && combined.includes('sleeve')) score += 8;
  if (original.includes('shirt') && combined.includes('shirt')) score += 8;

  if (original.includes('short sleeve') && combined.includes('long sleeve')) {
    score -= 35;
    penaltyTerms.push('long sleeve');
  }

  if (original.includes('shirt') && hasAny(title, ['pants', 'trousers', 'jeans', 'shorts'])) {
    score -= 45;
    penaltyTerms.push('wrong clothing type');
  }

  if (original.includes('linen') && !combined.includes('linen')) {
    score -= 12;
    penaltyTerms.push('missing linen');
  }

  if (original.includes('collar') && !combined.includes('collar')) {
    score -= 10;
    penaltyTerms.push('missing collar');
  }

  if (original.includes('button') && !combined.includes('button')) {
    score -= 8;
    penaltyTerms.push('missing button');
  }

  if (original.includes('men') || original.includes('mens')) {
    if (hasAny(title, ['women', 'womens', "women's", 'lady', 'ladies', 'blouse', 'dress'])) {
      score -= 30;
      penaltyTerms.push('wrong gender/category signal');
    }
  }

  if (hasAny(title, ['t-shirt', 'tshirt', 'tee']) && original.includes('button')) {
    score -= 12;
    penaltyTerms.push('t-shirt instead of button shirt');
  }

  const inventory = Number(product.inventory || 0);
  if (inventory > 10) score += 4;
  if (inventory > 100) score += 6;

  const price = Number(product.price || 0);
  if (price > 0) score += 2;

  let matchLevel = 'Low match';

  if (score >= 65) {
    matchLevel = 'High match';
  } else if (score >= 35) {
    matchLevel = 'Medium match';
  }

  return {
    ...product,
    matchScore: Math.max(0, Math.round(score)),
    matchLevel,
    matchedTerms: unique(matchedTerms),
    penaltyTerms: unique(penaltyTerms)
  };
}

function dedupeProducts(products) {
  const map = new Map();

  for (const product of products) {
    const key = product.pid || product.productId || product.sku || product.title;

    if (!key) continue;

    const existing = map.get(key);

    if (!existing || Number(product.matchScore || 0) > Number(existing.matchScore || 0)) {
      map.set(key, product);
    }
  }

  return Array.from(map.values());
}

function getRequestValue(req, key, fallback = '') {
  const body = req.body || {};
  const query = req.query || {};

  return (
    body[key] ||
    query[key] ||
    query[key.toLowerCase()] ||
    query[key.toUpperCase()] ||
    fallback
  );
}

async function searchCJProducts({ accessToken, keyword, countryCode, page, size }) {
  const url = new URL(CJ_PRODUCT_LIST_URL);
  url.searchParams.set('page', String(page));
  url.searchParams.set('size', String(size));
  url.searchParams.set('keyWord', String(keyword).slice(0, 120));
  url.searchParams.set('countryCode', String(countryCode).toUpperCase());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'CJ-Access-Token': accessToken
    }
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('CJ product search response was not JSON: ' + (text || '[EMPTY RESPONSE]'));
  }

  if (!response.ok || json.success === false || json.result === false) {
    return {
      ok: false,
      error: json,
      products: []
    };
  }

  return {
    ok: true,
    raw: json,
    products: normalizeCJProducts(json, keyword)
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed'
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Missing Supabase environment variables'
      });
    }

    const keyword =
      getRequestValue(req, 'keyword') ||
      getRequestValue(req, 'keyWord') ||
      getRequestValue(req, 'q');

    const category =
      getRequestValue(req, 'category') ||
      getRequestValue(req, 'categoryName') ||
      '';

    const countryCode = getRequestValue(req, 'countryCode', 'US');
    const page = Number(getRequestValue(req, 'page', 1));
    const size = Number(getRequestValue(req, 'size', 12));

    if (!keyword) {
      return res.status(400).json({
        ok: false,
        error: 'Missing keyword',
        receivedBody: req.body || null,
        receivedQuery: req.query || null
      });
    }

    const connection = await getLatestCJConnection();
    const searchKeywords = buildSearchKeywords(keyword, category);

    const allProducts = [];
    const rawResponses = [];

    for (const searchKeyword of searchKeywords) {
      const result = await searchCJProducts({
        accessToken: connection.access_token,
        keyword: searchKeyword,
        countryCode,
        page,
        size
      });

      if (result.ok) {
        rawResponses.push({
          keyword: searchKeyword,
          raw: result.raw
        });

        allProducts.push(...result.products);
      }
    }

    const scored = allProducts.map((product) => {
      return scoreProduct(product, keyword, category);
    });

    const ranked = dedupeProducts(scored)
      .sort((a, b) => {
        const scoreDiff = Number(b.matchScore || 0) - Number(a.matchScore || 0);

        if (scoreDiff !== 0) return scoreDiff;

        return Number(b.inventory || 0) - Number(a.inventory || 0);
      })
      .slice(0, 8);

    return res.status(200).json({
      ok: true,
      query: {
        originalKeyword: keyword,
        category,
        countryCode,
        searchKeywords
      },
      options: ranked,
      raw: rawResponses
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
};
