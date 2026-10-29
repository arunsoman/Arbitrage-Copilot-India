import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LIMITS, scanProhibitedClaims } from '@/lib/compliance';
import { safeJSON } from '@/lib/pipeline';

// Save edits / mark human reviewed. Publishing stays OUT of scope (no auto-publish).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const draft = await db.listingDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: 'draft not found' }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.title === 'string') data.title = body.title.slice(0, LIMITS.title);
  if (Array.isArray(body.bullets)) {
    data.bulletsJson = JSON.stringify(body.bullets.slice(0, LIMITS.bullets).map((b: unknown) => String(b).slice(0, LIMITS.bullet)));
  }
  if (typeof body.description === 'string') data.description = body.description.slice(0, LIMITS.description);
  if (typeof body.backendKeywords === 'string') data.backendKeywords = body.backendKeywords.slice(0, LIMITS.backendKeywords);
  if (typeof body.humanReviewed === 'boolean') data.humanReviewed = body.humanReviewed;
  if (body.published === true) {
    // Compliance gate: never auto-publish in MVP; persist as reviewed copy only.
    return NextResponse.json(
      { error: 'publishing_blocked', message: 'Auto-publishing is disabled in MVP. Copy the draft to Amazon Seller Central manually.' },
      { status: 403 }
    );
  }

  const title = (data.title as string) ?? draft.title;
  const bullets = data.bulletsJson ? safeJSON<string[]>(data.bulletsJson as string, []) : safeJSON<string[]>(draft.bulletsJson, []);
  const description = (data.description as string) ?? draft.description;
  const scan = scanProhibitedClaims(`${title} ${bullets.join(' ')} ${description}`);

  const compliance = safeJSON(draft.complianceStatusJson, {});
  compliance.claims = { clean: scan.clean, findings: scan.findings };
  compliance.charLimits = {
    title: { length: title.length, max: LIMITS.title, ok: title.length <= LIMITS.title },
    bullets: { count: bullets.length, maxCount: LIMITS.bullets, ok: bullets.length <= LIMITS.bullets },
    description: { length: description.length, max: LIMITS.description, ok: description.length <= LIMITS.description },
  };
  data.complianceStatusJson = JSON.stringify(compliance);

  const updated = await db.listingDraft.update({ where: { id }, data });
  return NextResponse.json({
    draft: { ...updated, bullets, compliance },
  });
}
