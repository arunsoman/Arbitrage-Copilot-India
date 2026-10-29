// ─── Amazon ASIN matching — retrieval-first cascade ─────────────────────────
// Stage 1: lexical retrieval over the catalog index
// Stage 2: deterministic rerank (brand, category, attributes, price band)
// Stage 3: classification (exact / variant / similar / no_match) + reasons

import { AmazonCatalog } from '@prisma/client';
import { CascadeTraceStep, MatchReason, MatchType } from './types';

const STOPWORDS = new Set([
  'with', 'for', 'and', 'the', 'set', 'pack', 'of', 'pcs', 'piece', 'pieces',
  'free', 'size', 'colour', 'color', 'best', 'new', 'export', 'quality',
  'premium', 'wholesale', 'traders', 'industries', 'ltd', 'pvt',
]);

export interface ScoredCandidate {
  catalog: AmazonCatalog;
  score: number; // 0..1
  reasons: MatchReason[];
}

export interface MatchResult {
  asin: string | null;
  productTitle: string;
  matchType: MatchType;
  confidence: number;
  reasons: MatchReason[];
  cascadeTrace: CascadeTraceStep[];
  needsReview: boolean;
  runnersUp: Array<{ asin: string; title: string; score: number }>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => {
      // light stemming for plurals
      if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
      return t;
    });
}

function numericTokens(text: string): string[] {
  return text.toLowerCase().match(/\d+(?:\.\d+)?\s?(?:ml|l|gm|g|kg|inch|in|watt|w|mah|piece|pc)?/g) ?? [];
}

function jaccardOverlap(a: string[], b: string[]): { overlap: number; shared: string[] } {
  const setB = new Set(b);
  const shared: string[] = [];
  let hits = 0;
  for (const t of new Set(a)) {
    if (setB.has(t)) {
      hits++;
      shared.push(t);
    }
  }
  const denom = new Set([...a, ...b]).size || 1;
  return { overlap: hits / Math.max(6, denom * 0.8), shared };
}

export function matchAsin(
  product: {
    title: string;
    brand?: string | null;
    category?: string | null;
    purchasePrice: number;
    attributes?: Record<string, unknown>;
  },
  catalog: AmazonCatalog[]
): MatchResult {
  const trace: CascadeTraceStep[] = [];
  const qTokens = tokenize(product.title);
  const qNums = numericTokens(product.title);

  // ── Stage 1: lexical retrieval ──
  const stage1 = catalog
    .map((c) => {
      const cTokens = tokenize(`${c.title} ${c.keywords} ${c.brand ?? ''}`);
      const { overlap, shared } = jaccardOverlap(qTokens, cTokens);
      return { catalog: c, lexical: overlap, shared };
    })
    .filter((x) => x.lexical > 0.08)
    .sort((a, b) => b.lexical - a.lexical)
    .slice(0, 8);

  trace.push({
    stage: 'retrieval',
    description: `Lexical retrieval over ${catalog.length} indexed ASINs`,
    candidates: stage1.length,
    topScore: stage1[0] ? Math.round(stage1[0].lexical * 100) / 100 : undefined,
  });

  if (stage1.length === 0) {
    trace.push({ stage: 'classification', description: 'No candidates above retrieval threshold', candidates: 0 });
    return {
      asin: null,
      productTitle: '',
      matchType: 'no_match',
      confidence: 0.05,
      reasons: [{ signal: 'retrieval', detail: 'No catalog ASIN shared enough tokens with the supplier item.', weight: 0 }],
      cascadeTrace: trace,
      needsReview: false,
      runnersUp: [],
    };
  }

  // ── Stage 2: deterministic rerank ──
  const scored: ScoredCandidate[] = stage1.map(({ catalog: c, lexical, shared }) => {
    const reasons: MatchReason[] = [];
    let score = Math.min(0.55, lexical * 0.9);

    reasons.push({
      signal: 'Keyword overlap',
      detail: `${shared.slice(0, 4).join(', ')}${shared.length > 4 ? '…' : ''} matched between supplier item and ASIN "${c.title.slice(0, 48)}…"`,
      weight: Math.round(score * 100) / 100,
    });

    // Brand signal
    if (product.brand) {
      const cBrand = (c.brand ?? '').toLowerCase();
      if (cBrand && cBrand === product.brand.toLowerCase()) {
        score += 0.18;
        reasons.push({ signal: 'Brand', detail: `Brand "${product.brand}" matches ASIN brand.`, weight: 0.18 });
      } else if (cBrand && cBrand.includes(product.brand.toLowerCase())) {
        score += 0.1;
        reasons.push({ signal: 'Brand (partial)', detail: `Supplier brand appears in ASIN brand "${c.brand}".`, weight: 0.1 });
      } else if (cBrand) {
        score -= 0.06;
        reasons.push({ signal: 'Brand mismatch', detail: `ASIN brand "${c.brand}" differs from supplier brand "${product.brand}".`, weight: -0.06 });
      }
    }

    // Category signal
    if (product.category && c.category === product.category) {
      score += 0.12;
      reasons.push({ signal: 'Category', detail: `Both classified under ${c.category}.`, weight: 0.12 });
    } else if (product.category) {
      score -= 0.05;
      reasons.push({ signal: 'Category mismatch', detail: `Supplier category ${product.category} vs ASIN category ${c.category}.`, weight: -0.05 });
    }

    // Numeric attribute signal (capacity / count / size)
    const cNums = numericTokens(c.title);
    const numShared = qNums.filter((n) => cNums.includes(n));
    if (qNums.length > 0) {
      if (numShared.length > 0) {
        score += Math.min(0.15, 0.09 * numShared.length);
        reasons.push({ signal: 'Specifications', detail: `Numeric specs matched: ${numShared.join(', ')}.`, weight: 0.09 });
      } else {
        score -= 0.08;
        reasons.push({ signal: 'Spec mismatch', detail: `Numeric specs ${qNums.join(', ')} not found in ASIN title.`, weight: -0.08 });
      }
    }

    // Price-band plausibility (Amazon price should be ≥ ~1.3× supplier cost for arbitrage, but wildly higher suggests different product)
    const ratio = c.price / Math.max(1, product.purchasePrice);
    if (ratio >= 1.2 && ratio <= 6) {
      score += 0.06;
      reasons.push({ signal: 'Price band', detail: `Amazon price ₹${c.price} is a plausible ${ratio.toFixed(1)}× of supplier cost.`, weight: 0.06 });
    } else if (ratio > 8) {
      score -= 0.07;
      reasons.push({ signal: 'Price implausible', detail: `Amazon price ₹${c.price} is ${ratio.toFixed(1)}× supplier cost — possibly a different product.`, weight: -0.07 });
    }

    // Attribute hints (colour / material) stored in catalog attributes
    const attrs = safeParse(c.attributesJson) as Record<string, string>;
    const prodAttrs = product.attributes ?? {};
    for (const key of ['colour', 'color', 'material', 'capacity', 'flavour']) {
      const pv = String(prodAttrs[key] ?? '').toLowerCase();
      const cv = String(attrs[key] ?? '').toLowerCase();
      if (pv && cv) {
        if (cv.includes(pv) || pv.includes(cv)) {
          score += 0.07;
          reasons.push({ signal: `${key[0].toUpperCase()}${key.slice(1)}`, detail: `${key} "${pv}" matches ASIN attribute.`, weight: 0.07 });
          break;
        }
      }
    }

    // Image-similarity stand-in (deterministic lexical proximity of image hint)
    if (c.imageHint && product.title.toLowerCase().includes(c.imageHint.toLowerCase())) {
      score += 0.04;
      reasons.push({ signal: 'Image', detail: `Listing imagery tagged "${c.imageHint}" consistent with supplier photos.`, weight: 0.04 });
    }

    score = Math.max(0.02, Math.min(0.99, score));
    return { catalog: c, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];

  trace.push({
    stage: 'rerank',
    description: 'Deterministic rerank: brand, category, specs, price band, attributes',
    candidates: scored.length,
    topScore: Math.round(top.score * 100) / 100,
  });

  // ── Stage 3: classification ──
  let matchType: MatchType;
  if (top.score >= 0.82) matchType = 'exact';
  else if (top.score >= 0.62) matchType = 'variant';
  else if (top.score >= 0.42) matchType = 'similar';
  else matchType = 'no_match';

  // Hard guard: a wildly implausible price ratio means we are almost certainly
  // looking at a different product (e.g. ₹38 unbranded bottle vs ₹949 flask).
  // Downgrade any positive classification to no_match.
  const priceRatio = top.catalog.price / Math.max(1, product.purchasePrice);
  if (priceRatio > 8 && matchType !== 'no_match') {
    top.reasons.push({
      signal: 'Price implausible',
      detail: `Amazon price ₹${top.catalog.price} is ${priceRatio.toFixed(1)}× the supplier cost — match rejected as a different product.`,
      weight: -0.2,
    });
    matchType = 'no_match';
  }

  // Ambiguity: two candidates too close → review queue
  const ambiguous = second ? top.score - second.score < 0.06 && top.score < 0.85 : false;
  const needsReview =
    (matchType === 'no_match' && top.score >= 0.3) ||
    matchType === 'similar' ||
    ambiguous ||
    (matchType === 'variant' && top.score < 0.68);

  trace.push({
    stage: 'classification',
    description: 'Classify match type and review-routing',
    candidates: 1,
    topScore: Math.round(top.score * 100) / 100,
  });

  return {
    asin: matchType === 'no_match' ? null : top.catalog.asin,
    productTitle: matchType === 'no_match' ? '' : top.catalog.title,
    matchType,
    confidence: Math.round(top.score * 100) / 100,
    reasons: top.reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    cascadeTrace: trace,
    needsReview: matchType === 'no_match' ? false : needsReview,
    runnersUp: scored.slice(1, 4).map((s) => ({ asin: s.catalog.asin, title: s.catalog.title, score: Math.round(s.score * 100) / 100 })),
  };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}
