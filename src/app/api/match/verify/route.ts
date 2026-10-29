import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const matchId = String(body.matchId ?? '');
  const decision = body.decision; // approved | rejected
  if (!matchId || !['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'matchId and decision (approved|rejected) required' }, { status: 400 });
  }
  const updated = await db.amazonMatch.update({
    where: { id: matchId },
    data: { verifiedByUser: decision, needsReview: decision === 'approved' ? false : true },
  });
  return NextResponse.json({ match: updated });
}
