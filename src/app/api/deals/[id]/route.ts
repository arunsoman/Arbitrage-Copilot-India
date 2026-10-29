import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureExplanation, safeJSON } from '@/lib/pipeline';
import { getMarketSignals } from '@/lib/price-history';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let analysis = await db.dealAnalysis.findUnique({
    where: { id },
    include: {
      extractedProduct: { include: { indiaMartProduct: true } },
    },
  });
  if (!analysis) return NextResponse.json({ error: 'deal not found' }, { status: 404 });

  // Lazily generate the LLM explanation on first open (PRD: explain in plain language)
  if (!analysis.explanation) {
    await ensureExplanation(analysis.id);
    analysis = await db.dealAnalysis.findUniqueOrThrow({
      where: { id },
      include: { extractedProduct: { include: { indiaMartProduct: true } } },
    });
  }

  const match = analysis.amazonMatchId
    ? await db.amazonMatch.findUnique({ where: { id: analysis.amazonMatchId } })
    : null;

  // Reconstruct price history deterministically for the chart
  const history = match && match.asin !== '—' ? getMarketSignals(match.asin, analysis.amazonPrice).history : [];

  return NextResponse.json({
    analysis: {
      ...analysis,
      verdictReasons: safeJSON(analysis.verdictReasonsJson, []),
      toolTrace: safeJSON(analysis.toolTraceJson, []),
    },
    match: match
      ? {
          ...match,
          reasons: safeJSON(match.reasonJson, []),
          cascadeTrace: safeJSON(match.cascadeTraceJson, []),
        }
      : null,
    history,
  });
}
