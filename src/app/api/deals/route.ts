import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrap } from '@/lib/user';
import { safeJSON } from '@/lib/pipeline';

export async function GET() {
  await ensureBootstrap();
  const analyses = await db.dealAnalysis.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      extractedProduct: { include: { indiaMartProduct: true } },
    },
  });

  const deals = [];
  for (const a of analyses) {
    const match = a.amazonMatchId ? await db.amazonMatch.findUnique({ where: { id: a.amazonMatchId } }) : null;
    const buyItem = await db.buyListItem.findFirst({ where: { dealAnalysisId: a.id } });
    deals.push({
      id: a.id,
      title: a.extractedProduct.title,
      brand: a.extractedProduct.brand,
      category: a.extractedProduct.category,
      purchasePrice: a.extractedProduct.purchasePrice,
      moq: a.extractedProduct.moq,
      packQuantity: a.extractedProduct.packQuantity,
      supplierName: a.extractedProduct.indiaMartProduct.supplierName,
      supplierLocation: a.extractedProduct.indiaMartProduct.location,
      supplierRating: a.extractedProduct.indiaMartProduct.supplierRating,
      yearsInBusiness: a.extractedProduct.indiaMartProduct.yearsInBusiness,
      gstVerified: a.extractedProduct.indiaMartProduct.gstVerified,
      trustSeal: a.extractedProduct.indiaMartProduct.trustSeal,
      match: match
        ? { asin: match.asin, matchType: match.matchType, confidenceScore: match.confidenceScore, needsReview: match.needsReview, verifiedByUser: match.verifiedByUser }
        : null,
      verdict: a.verdict,
      roi: a.roi,
      netProfit: a.netProfit,
      maxBuyPrice: a.maxBuyPrice,
      confidenceScore: a.confidenceScore,
      riskSummary: a.riskSummary,
      priceCutters7d: a.priceCutters7d,
      competitionSellers: a.competitionSellers,
      amazonPrice: a.amazonPrice,
      createdAt: a.createdAt,
      inBuyList: Boolean(buyItem),
      reasons: safeJSON(a.verdictReasonsJson, []),
    });
  }
  return NextResponse.json({ deals });
}
