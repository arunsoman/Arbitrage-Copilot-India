// ─── Deal pipeline: search → extract → match → analyze ──────────────────────
// Orchestrates the MVP flow from PRD §4. Deterministic tools compute numbers;
// the LLM only explains (and is optional at every step).

import { db } from '@/lib/db';
import { searchIndiaMart } from './indiamart';
import { extractCatalogBatch, explainDeal, ExtractionOutput } from './llm';
import { matchAsin } from './asin-matcher';
import { calculateMargin, estimateInboundShipping, estimatePackaging } from './fees';
import { getMarketSignals } from './price-history';
import { decideVerdict } from './verdict';
import { ensureBootstrap, ensureUser } from './user';
import { ProfitRules } from './types';
import type { DealAnalysis, ExtractedProduct, AmazonMatch, IndiaMartProduct } from '@prisma/client';

export interface SearchOutcome {
  provider: string;
  extractionMethod: string;
  products: Array<{
    indiaMartProductId: string;
    extractedProductId: string;
    title: string;
    supplierName: string;
    supplierLocation: string;
    supplierRating?: number;
    supplierType?: string;
    yearsInBusiness?: number;
    gstVerified: boolean;
    trustSeal: boolean;
    moq?: number;
    purchasePrice: number;
    mrp?: number;
    brand?: string;
    category?: string;
    packQuantity: number;
    confidenceScore: number;
    reviewStatus: string;
    extractionMethod: string;
  }>;
}

export async function runSearch(
  query: string,
  opts: { gstVerifiedOnly?: boolean; maxResults?: number } = {}
): Promise<SearchOutcome> {
  await ensureBootstrap();
  const user = await ensureUser();

  const { results, provider } = await searchIndiaMart(query, opts);

  // Analytics: every query is logged for the admin "most-searched" report.
  try {
    await db.searchLog.create({
      data: { userId: user.id, query: query.trim().slice(0, 200), resultCount: results.length, provider },
    });
  } catch {
    /* analytics must never break the search */
  }

  if (results.length === 0) {
    return { provider, extractionMethod: 'heuristic', products: [] };
  }

  // Persist IndiaMART snapshots (idempotent on query+product+supplier)
  const indiaMartRows = [];
  for (const r of results) {
    const existing = await db.indiaMartProduct.findFirst({
      where: { searchQuery: query, productName: r.productName, supplierName: r.supplierName },
    });
    if (existing) {
      await db.indiaMartProduct.update({
        where: { id: existing.id },
        data: {
          priceInr: r.priceInr,
          rawJson: JSON.stringify(r.raw),
          gstVerified: r.gstVerified,
          trustSeal: r.trustSeal,
          fetchedAt: new Date(),
        },
      });
      indiaMartRows.push(existing.id);
    } else {
      const row = await db.indiaMartProduct.create({
        data: {
          searchQuery: query,
          productName: r.productName,
          productUrl: r.productUrl,
          priceInr: r.priceInr,
          unit: r.unit,
          moq: r.moq,
          supplierName: r.supplierName,
          supplierUrl: r.supplierUrl,
          location: r.location,
          supplierRating: r.supplierRating,
          supplierType: r.supplierType,
          natureOfBusiness: r.natureOfBusiness,
          yearsInBusiness: r.yearsInBusiness,
          gstVerified: r.gstVerified,
          trustSeal: r.trustSeal,
          rawJson: JSON.stringify(r.raw),
          provider,
        },
      });
      indiaMartRows.push(row.id);
    }
  }

  // LLM-powered schema-constrained extraction (batch call, heuristic fallback)
  const freshRows = await db.indiaMartProduct.findMany({
    where: { id: { in: indiaMartRows } },
    orderBy: { fetchedAt: 'desc' },
  });

  const inputs = freshRows.map((row) => ({
    productName: row.productName,
    priceInr: row.priceInr,
    unit: row.unit,
    supplierName: row.supplierName,
    detailJson: row.rawJson,
  }));
  const { outputs, source: extractionMethod } = await extractCatalogBatch(
    inputs,
    user.gstRateDefault,
    user.id
  );

  const products: SearchOutcome['products'] = [];
  for (let i = 0; i < freshRows.length; i++) {
    const row = freshRows[i];
    const ex: ExtractionOutput = outputs[i];
    const existing = await db.extractedProduct.findUnique({
      where: { indiaMartProductId: row.id },
    });
    const data = {
      title: ex.title,
      brand: ex.brand ?? null,
      category: ex.category ?? null,
      mrp: ex.mrp ?? null,
      purchasePrice: ex.purchasePrice,
      gstRate: ex.gstRate,
      moq: ex.moq ?? null,
      packQuantity: ex.packQuantity,
      weightGrams: ex.weightGrams ?? null,
      attributesJson: JSON.stringify(ex.attributes),
      manufacturerName: ex.manufacturerName ?? null,
      countryOfOrigin: ex.countryOfOrigin ?? null,
      netQuantity: ex.netQuantity ?? null,
      customerCare: ex.customerCare ?? null,
      monthYearMfg: ex.monthYearMfg ?? null,
      extractionMethod,
      confidenceScore: ex.confidence,
      reviewStatus: ex.confidence >= 0.75 ? 'auto_ok' : 'flagged',
    };
    let extracted = existing
      ? await db.extractedProduct.update({ where: { id: existing.id }, data })
      : await db.extractedProduct.create({
          data: { indiaMartProductId: row.id, ...data },
        });
    products.push({
      indiaMartProductId: row.id,
      extractedProductId: extracted.id,
      title: extracted.title,
      supplierName: row.supplierName,
      supplierLocation: row.location ?? '',
      supplierRating: row.supplierRating ?? undefined,
      supplierType: row.supplierType ?? undefined,
      yearsInBusiness: row.yearsInBusiness ?? undefined,
      gstVerified: row.gstVerified,
      trustSeal: row.trustSeal,
      moq: extracted.moq ?? undefined,
      purchasePrice: extracted.purchasePrice,
      mrp: extracted.mrp ?? undefined,
      brand: extracted.brand ?? undefined,
      category: extracted.category ?? undefined,
      packQuantity: extracted.packQuantity,
      confidenceScore: extracted.confidenceScore,
      reviewStatus: extracted.reviewStatus,
      extractionMethod,
    });
  }

  return { provider, extractionMethod, products };
}

export interface FullDeal {
  analysis: DealAnalysis;
  extracted: ExtractedProduct;
  indiaMart: IndiaMartProduct | null;
  match: AmazonMatch | null;
}

export async function analyzeProduct(
  extractedProductId: string,
  opts: { withExplanation?: boolean } = {}
): Promise<FullDeal> {
  await ensureBootstrap();
  const user = await ensureUser();

  const extracted = await db.extractedProduct.findUniqueOrThrow({
    where: { id: extractedProductId },
  });
  const indiaMart = await db.indiaMartProduct.findUnique({
    where: { id: extracted.indiaMartProductId },
  });

  const catalog = await db.amazonCatalog.findMany();
  const attributes = safeJSON<Record<string, string>>(extracted.attributesJson, {});

  // ── ASIN match cascade ──
  const matchResult = matchAsin(
    {
      title: extracted.title,
      brand: extracted.brand,
      category: extracted.category,
      purchasePrice: extracted.purchasePrice,
      attributes,
    },
    catalog
  );

  // Replace previous match for this product (re-analysis keeps one canonical row)
  await db.amazonMatch.deleteMany({ where: { extractedProductId: extracted.id } });
  const match = await db.amazonMatch.create({
    data: {
      extractedProductId: extracted.id,
      asin: matchResult.asin ?? '—',
      productTitle: matchResult.productTitle,
      matchType: matchResult.matchType,
      confidenceScore: matchResult.confidence,
      reasonJson: JSON.stringify(matchResult.reasons),
      cascadeTraceJson: JSON.stringify(matchResult.cascadeTrace),
      needsReview: matchResult.needsReview,
    },
  });

  // ── Deterministic market + margin computation ──
  const catalogItem = matchResult.asin ? catalog.find((c) => c.asin === matchResult.asin) : undefined;
  const amazonPrice = catalogItem?.price ?? 0;
  const weightGrams = extracted.weightGrams ?? catalogItem?.weightGrams ?? 500;
  const referralPct = catalogItem?.referralPct ?? 10;
  const inboundShipping = estimateInboundShipping(weightGrams);
  const packaging = estimatePackaging(amazonPrice || extracted.purchasePrice * 2.5);

  const rules: ProfitRules = {
    minRoi: user.minRoi,
    maxBuyPrice: user.maxBuyPrice,
    minProfit: user.minProfit,
    gstRateDefault: user.gstRateDefault,
    riskTolerance: (['conservative', 'balanced', 'aggressive'].includes(user.riskTolerance)
      ? user.riskTolerance
      : 'balanced') as ProfitRules['riskTolerance'],
  };

  const margin = calculateMargin({
    supplierCost: extracted.purchasePrice,
    gstRate: extracted.gstRate,
    inboundShipping,
    packaging,
    amazonPrice: amazonPrice || extracted.purchasePrice * 2.2,
    referralPct,
    weightGrams,
    minRoi: rules.minRoi,
    minProfit: rules.minProfit,
  });

  const signals = catalogItem
    ? getMarketSignals(catalogItem.asin, catalogItem.price)
    : { history: [], trend30dPct: 0, sellers: 0, priceCutters7d: 0 };

  const verdictOutput = decideVerdict({
    margin,
    hasMatch: Boolean(catalogItem) && matchResult.matchType !== 'no_match',
    matchType: matchResult.matchType,
    matchConfidence: matchResult.confidence,
    gstVerified: indiaMart?.gstVerified ?? false,
    trend30dPct: signals.trend30dPct,
    priceCutters7d: signals.priceCutters7d,
    sellers: signals.sellers,
    rules,
  });

  const toolTrace = [
    { tool: 'search_amazon_candidates', summary: `Retrieval over ${catalog.length} ASINs → ${matchResult.matchType}` },
    { tool: 'calculate_fees', summary: `Referral ₹${margin.fees.referralFee} + Closing ₹${margin.fees.closingFee} + FBA ₹${margin.fees.fbaFulfillmentFee}` },
    { tool: 'calculate_margin', summary: `Net profit ₹${margin.netProfit} · ROI ${margin.roi}% · Max buy ₹${margin.maxBuyPrice}` },
    { tool: 'get_price_history', summary: `30d trend ${signals.trend30dPct}% · ${signals.sellers} sellers · ${signals.priceCutters7d} cutters` },
    { tool: 'verify_GST', summary: indiaMart?.gstVerified ? 'Supplier GST verified' : 'Supplier NOT GST verified' },
  ];

  await db.dealAnalysis.deleteMany({ where: { extractedProductId: extracted.id } });
  let analysis = await db.dealAnalysis.create({
    data: {
      extractedProductId: extracted.id,
      amazonMatchId: match.id,
      supplierCost: extracted.purchasePrice,
      gstAmount: margin.gstAmount,
      inboundShippingCost: inboundShipping,
      packagingCost: packaging,
      totalCost: margin.totalCost,
      amazonPrice: amazonPrice,
      referralFee: margin.fees.referralFee,
      closingFee: margin.fees.closingFee,
      fbaFulfillmentFee: margin.fees.fbaFulfillmentFee,
      netPayout: margin.netPayout,
      netProfit: margin.netProfit,
      roi: margin.roi,
      maxBuyPrice: margin.maxBuyPrice,
      verdict: verdictOutput.verdict,
      verdictReasonsJson: JSON.stringify(verdictOutput.reasons),
      riskSummary: verdictOutput.riskSummary,
      competitionSellers: signals.sellers,
      priceTrend30d: signals.trend30dPct,
      priceCutters7d: signals.priceCutters7d,
      confidenceScore: verdictOutput.confidence,
      toolTraceJson: JSON.stringify(toolTrace),
      explanation: null,
    },
  });

  if (opts.withExplanation) {
    analysis = await ensureExplanation(analysis.id);
  }

  return { analysis, extracted, indiaMart: indiaMart ?? null, match };
}

// Generate (and persist) the LLM explanation for a deal, if not present yet.
export async function ensureExplanation(dealAnalysisId: string): Promise<DealAnalysis> {
  const analysis = await db.dealAnalysis.findUniqueOrThrow({ where: { id: dealAnalysisId } });
  if (analysis.explanation) return analysis;

  const user = await ensureUser();
  const extracted = await db.extractedProduct.findUniqueOrThrow({
    where: { id: analysis.extractedProductId },
  });
  const indiaMart = await db.indiaMartProduct.findUnique({
    where: { id: extracted.indiaMartProductId },
  });
  const match = analysis.amazonMatchId
    ? await db.amazonMatch.findUnique({ where: { id: analysis.amazonMatchId } })
    : null;

  const { text, source } = await explainDeal(
    {
      productTitle: extracted.title,
      supplierName: indiaMart?.supplierName ?? 'Unknown supplier',
      supplierCost: analysis.supplierCost,
      maxBuyPrice: analysis.maxBuyPrice,
      verdict: analysis.verdict,
      roi: analysis.roi,
      netProfit: analysis.netProfit,
      minRoi: user.minRoi,
      minProfit: user.minProfit,
      amazonPrice: analysis.amazonPrice,
      sellers: analysis.competitionSellers,
      priceCutters7d: analysis.priceCutters7d,
      trend30dPct: analysis.priceTrend30d,
      matchType: match?.matchType ?? 'unknown',
      matchConfidence: match?.confidenceScore ?? 0.5,
      gstVerified: indiaMart?.gstVerified ?? false,
      moq: extracted.moq ?? undefined,
      riskSummary: analysis.riskSummary ?? '',
    },
    user.id
  );

  return db.dealAnalysis.update({
    where: { id: analysis.id },
    data: { explanation: text, explanationSource: source },
  });
}

export function safeJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
