import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrap } from '@/lib/user';
import { draftListing } from '@/lib/llm';
import { checkLegalMetrology, LIMITS, scanProhibitedClaims } from '@/lib/compliance';
import { safeJSON } from '@/lib/pipeline';

export async function GET(req: NextRequest) {
  const dealAnalysisId = req.nextUrl.searchParams.get('dealAnalysisId');
  if (!dealAnalysisId) return NextResponse.json({ error: 'dealAnalysisId required' }, { status: 400 });
  const draft = await db.listingDraft.findFirst({
    where: { dealAnalysisId },
    orderBy: { createdAt: 'desc' },
  });
  if (!draft) return NextResponse.json({ draft: null });
  return NextResponse.json({
    draft: {
      ...draft,
      bullets: safeJSON<string[]>(draft.bulletsJson, []),
      compliance: safeJSON(draft.complianceStatusJson, {}),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    await ensureBootstrap();
    const body = await req.json();
    const dealAnalysisId = String(body.dealAnalysisId ?? '');
    if (!dealAnalysisId) return NextResponse.json({ error: 'dealAnalysisId required' }, { status: 400 });

    const analysis = await db.dealAnalysis.findUnique({
      where: { id: dealAnalysisId },
      include: { extractedProduct: { include: { indiaMartProduct: true } } },
    });
    if (!analysis) return NextResponse.json({ error: 'deal not found' }, { status: 404 });

    // ── LEGAL METROLOGY GATE (PRD §3.1: listing generation is blocked) ──
    const ex = analysis.extractedProduct;
    const lm = checkLegalMetrology({
      mrp: ex.mrp,
      manufacturerName: ex.manufacturerName,
      countryOfOrigin: ex.countryOfOrigin,
      netQuantity: ex.netQuantity,
      customerCare: ex.customerCare,
      monthYearMfg: ex.monthYearMfg,
    });
    if (!lm.canGenerateListing) {
      return NextResponse.json(
        {
          error: 'legal_metrology_blocked',
          message:
            'Listing draft is blocked: mandatory Legal Metrology declarations are missing. Obtain these from the supplier first.',
          missing: lm.missingMandatory,
          checks: lm.checks,
        },
        { status: 422 }
      );
    }

    const match = analysis.amazonMatchId
      ? await db.amazonMatch.findUnique({ where: { id: analysis.amazonMatchId } })
      : null;

    const attrs = safeJSON<Record<string, string>>(ex.attributesJson, {});
    const user = await db.user.findFirst({ where: { role: 'seller' } });

    const draft = await draftListing(
      {
        title: ex.title,
        brand: ex.brand,
        category: ex.category,
        material: attrs.material ?? null,
        colour: attrs.colour ?? null,
        capacity: attrs.capacity ?? null,
        packQuantity: ex.packQuantity,
        netQuantity: ex.netQuantity,
        mrp: ex.mrp,
        supplierDescription: (safeJSON<{ detail?: { description?: string } }>(
          analysis.extractedProduct.indiaMartProduct.rawJson,
          {}
        ).detail?.description) ?? null,
        amazonAsinTitle: match && match.asin !== '—' ? match.productTitle : null,
        amazonPrice: analysis.amazonPrice || null,
      },
      user?.id
    );

    const titleScan = scanProhibitedClaims(draft.title);
    const bulletsScan = scanProhibitedClaims(draft.bullets.join(' '));
    const descScan = scanProhibitedClaims(draft.description);
    const findings = [...titleScan.findings, ...bulletsScan.findings, ...descScan.findings];

    const compliance = {
      legalMetrology: lm,
      claims: { clean: findings.length === 0, findings },
      charLimits: {
        title: { length: draft.title.length, max: LIMITS.title, ok: draft.title.length <= LIMITS.title },
        bullets: {
          count: draft.bullets.length,
          maxCount: LIMITS.bullets,
          ok: draft.bullets.length <= LIMITS.bullets && draft.bullets.every((b) => b.length <= LIMITS.bullet),
        },
        description: { length: draft.description.length, max: LIMITS.description, ok: draft.description.length <= LIMITS.description },
      },
    };

    await db.listingDraft.deleteMany({ where: { dealAnalysisId } });
    const saved = await db.listingDraft.create({
      data: {
        dealAnalysisId,
        title: draft.title,
        bulletsJson: JSON.stringify(draft.bullets),
        description: draft.description,
        backendKeywords: draft.backendKeywords,
        complianceStatusJson: JSON.stringify(compliance),
        generationSource: draft.source,
        humanReviewed: false,
        published: false,
      },
    });

    return NextResponse.json({
      draft: { ...saved, bullets: draft.bullets, compliance },
    });
  } catch (err) {
    console.error('listing draft failed', err);
    return NextResponse.json({ error: 'listing draft failed', detail: String(err) }, { status: 500 });
  }
}
