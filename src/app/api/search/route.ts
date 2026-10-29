import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runSearch } from '@/lib/pipeline';
import { checkLegalMetrology } from '@/lib/compliance';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = String(body.query ?? '').trim();
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

    const gstVerifiedOnly = Boolean(body.gstVerifiedOnly);
    const outcome = await runSearch(query, { gstVerifiedOnly, maxResults: 8 });

    // Enrich each product with its latest deal verdict (if analyzed before)
    const enriched = [];
    for (const p of outcome.products) {
      const deal = await db.dealAnalysis.findFirst({
        where: { extractedProductId: p.extractedProductId },
        orderBy: { createdAt: 'desc' },
      });
      const extracted = await db.extractedProduct.findUnique({ where: { id: p.extractedProductId } });
      const lm = extracted
        ? checkLegalMetrology({
            mrp: extracted.mrp,
            manufacturerName: extracted.manufacturerName,
            countryOfOrigin: extracted.countryOfOrigin,
            netQuantity: extracted.netQuantity,
            customerCare: extracted.customerCare,
          })
        : null;
      let matchInfo: { asin: string; matchType: string; confidenceScore: number } | null = null;
      if (deal?.amazonMatchId) {
        const m = await db.amazonMatch.findUnique({ where: { id: deal.amazonMatchId } });
        if (m) matchInfo = { asin: m.asin, matchType: m.matchType, confidenceScore: m.confidenceScore };
      }
      enriched.push({
        ...p,
        lmCanGenerateListing: lm?.canGenerateListing ?? false,
        lmMissing: lm?.missingMandatory ?? [],
        deal: deal
          ? {
              id: deal.id,
              verdict: deal.verdict,
              roi: deal.roi,
              netProfit: deal.netProfit,
              maxBuyPrice: deal.maxBuyPrice,
              confidenceScore: deal.confidenceScore,
              riskSummary: deal.riskSummary,
              priceCutters7d: deal.priceCutters7d,
              amazonPrice: deal.amazonPrice,
              competitionSellers: deal.competitionSellers,
            }
          : null,
        match: matchInfo,
      });
    }

    return NextResponse.json({
      provider: outcome.provider,
      extractionMethod: outcome.extractionMethod,
      query,
      products: enriched,
    });
  } catch (err) {
    console.error('search failed', err);
    return NextResponse.json({ error: 'search failed', detail: String(err) }, { status: 500 });
  }
}
