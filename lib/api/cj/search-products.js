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

function cleanImageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    url.search = '';
    return url.href.toLowerCase();
  } catch {
    return String(value || '').toLowerCase();
  }
}

function imagePathTokens(value) {
  const cleaned = cleanImageUrl(value);

  return cleaned
    .replace(/^https?:\/\//, '')
    .replace(/\.[a-z0-9]{2,5}($|\?)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length >= 4);
}

function longestCommonSubstringLength(a, b) {
  const first = String(a || '');
  const second = String(b || '');

  if (!first || !second) return 0;

  const rows = first.length + 1;
  const cols = second.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));

  let max = 0;

  for (let i = 1; i <= first.length; i += 1) {
    for (let j = 1; j <= second.length; j += 1) {
      if (first[i - 1] === second[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > max) max = dp[i][j];
      }
    }
  }

  return max;
}

function scoreImageSimilarity(sourceImageUrl, candidateImageUrl) {
  const source = cleanImageUrl(sourceImageUrl);
  const candidate = cleanImageUrl(candidateImageUrl);

  if (!source || !candidate) {
    return {
      imageMatchScore: 0,
      imageMatchLevel: 'No image',
      imageMatchedTerms: []
    };
  }

  if (source === candidate) {
    return {
      imageMatchScore: 100,
      imageMatchLevel: 'Exact image URL',
      imageMatchedTerms: ['exact_url']
    };
  }

  const sourceTokens = imagePathTokens(source);
  const candidateTokens = imagePathTokens(candidate);
  const matchedTerms = sourceTokens.filter((token) => candidateTokens.includes(token));

  let score = 0;

  if (matchedTerms.length) {
    score += Math.min(70, matchedTerms.length * 18);
  }

  const commonLength = longestCommonSubstringLength(source, candidate);
  const shortestLength = Math.min(source.length, candidate.length);

  if (shortestLength > 0) {
    const commonRatio = commonLength / shortestLength;

    if (commonRatio > 0.65) {
      score += 45;
    } else if (commonRatio > 0.45) {
      score += 28;
    } else if (commonRatio > 0.3) {
      score += 15;
    }
  }

  if (source.includes('cjdropshipping') && candidate.includes('cjdropshipping')) {
    score += 8;
  }

  if (source.includes('cf.cjdropshipping.com') && candidate.includes('cf.cjdropshipping.com')) {
    score += 10;
  }

  score = Math.min(100, Math.round(score));

  let imageMatchLevel = 'Low visual match';

  if (score >= 80) {
    imageMatchLevel = 'High visual match';
  } else if (score >= 45) {
    imageMatchLevel = 'Medium visual match';
  } else if (score <= 0) {
    imageMatchLevel = 'No image match';
  }

  return {
    imageMatchScore: score,
    imageMatchLevel,
    imageMatchedTerms: unique(matchedTerms)
  };
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(normalizeText(term)));
}

function scoreProduct(product, originalTitle, category, sourceImageUrl) {
  const title = normalizeText(product.title);
  const combined = normalizeText(`${product.title} ${product.categoryName || ''}`);
  const original = normalizeText(`${originalTitle || ''} ${category || ''}`);
  const wantedTerms = getImportantTerms(original);

  let titleScore = 0;
  const matchedTerms = [];
  const penaltyTerms = [];

  for (const term of wantedTerms) {
    if (!term) continue;

    if (combined.includes(term)) {
      titleScore += 8;
      matchedTerms.push(term);
    }
  }

  const originalTokens = tokenize(original).filter((term) => !STOP_WORDS.has(term));

  for (const term of originalTokens) {
    if (combined.includes(term)) {
      titleScore += 3;
    }
  }

  if (original.includes('linen') && combined.includes('linen')) titleScore += 18;
  if (original.includes('collar') && combined.includes('collar')) titleScore += 12;
  if (original.includes('stand') && combined.includes('stand')) titleScore += 10;
  if (original.includes('button') && combined.includes('button')) titleScore += 10;
  if (original.includes('short') && combined.includes('short')) titleScore += 8;
  if (original.includes('sleeve') && combined.includes('sleeve')) titleScore += 8;
  if (original.includes('shirt') && combined.includes('shirt')) titleScore += 8;

  if (original.includes('short sleeve') && combined.includes('long sleeve')) {
    titleScore -= 35;
    penaltyTerms.push('long sleeve');
  }

  if (original.includes('shirt') && hasAny(title, ['pants', 'trousers', 'jeans', 'shorts'])) {
    titleScore -= 45;
    penaltyTerms.push('wrong clothing type');
  }

  if (original.includes('linen') && !combined.includes('linen')) {
    titleScore -= 12;
    penaltyTerms.push('missing linen');
  }

  if (original.includes('collar') && !combined.includes('collar')) {
    titleScore -= 10;
    penaltyTerms.push('missing collar');
  }

  if (original.includes('button') && !combined.includes('button')) {
    titleScore -= 8;
    penaltyTerms.push('missing button');
  }

  if (original.includes('men') || original.includes('mens')) {
    if (hasAny(title, ['women', 'womens', "women's", 'lady', 'ladies', 'blouse', 'dress'])) {
      titleScore -= 30;
      penaltyTerms.push('wrong gender/category signal');
    }
  }

  if (hasAny(title, ['t-shirt', 'tshirt', 'tee']) && original.includes('button')) {
    titleScore -= 12;
    penaltyTerms.push('t-shirt instead of button shirt');
  }

  const inventory = Number(product.inventory || 0);
  if (inventory > 10) titleScore += 4;
  if (inventory > 100) titleScore += 6;

  const price = Number(product.price || 0);
  if (price > 0) titleScore += 2;

  titleScore = Math.max(0, Math.round(titleScore));

  const imageScore = scoreImageSimilarity(sourceImageUrl, product.imageUrl);

  const finalScore = Math.round(
    imageScore.imageMatchScore * 0.65 +
      Math.min(100, titleScore) * 0.35
  );

  let matchLevel = 'Low match';

  if (finalScore >= 70) {
    matchLevel = 'High match';
  } else if (finalScore >= 40) {
    matchLevel = 'Medium match';
  }

  return {
    ...product,
    titleMatchScore: Math.min(100, titleScore),
    imageMatchScore: imageScore.imageMatchScore,
    imageMatchLevel: imageScore.imageMatchLevel,
    imageMatchedTerms: imageScore.imageMatchedTerms,
    matchScore: finalScore,
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

    const imageUrl =
      getRequestValue(req, 'imageUrl') ||
      getRequestValue(req, 'productImage') ||
      getRequestValue(req, 'sourceImageUrl') ||
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
      return scoreProduct(product, keyword, category, imageUrl);
    });

    const ranked = dedupeProducts(scored)
      .sort((a, b) => {
        const scoreDiff = Number(b.matchScore || 0) - Number(a.matchScore || 0);

        if (scoreDiff !== 0) return scoreDiff;

        const imageDiff = Number(b.imageMatchScore || 0) - Number(a.imageMatchScore || 0);

        if (imageDiff !== 0) return imageDiff;

        return Number(b.inventory || 0) - Number(a.inventory || 0);
      })
      .slice(0, 8);

    return res.status(200).json({
      ok: true,
      query: {
        originalKeyword: keyword,
        category,
        imageUrl,
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
