import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrap } from '@/lib/user';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  await ensureBootstrap();
  // Prefer the authenticated seller; fall back to the first seller account for
  // backward compatibility with unauthenticated API consumers.
  const sessionUser = await getSessionUser();
  const user =
    sessionUser && sessionUser.role === 'seller'
      ? await db.user.findUnique({ where: { id: sessionUser.id } })
      : await db.user.findFirst({ where: { role: 'seller' } });
  if (!user) return NextResponse.json({ error: 'no user' }, { status: 500 });
  return NextResponse.json({
    user: {
      ...user,
      preferredCategories: JSON.parse(user.preferredCategories || '[]'),
    },
  });
}

export async function POST(req: NextRequest) {
  await ensureBootstrap();
  const sessionUser = await getSessionUser();
  const user =
    sessionUser && sessionUser.role === 'seller'
      ? await db.user.findUnique({ where: { id: sessionUser.id } })
      : await db.user.findFirst({ where: { role: 'seller' } });
  if (!user) return NextResponse.json({ error: 'no user' }, { status: 500 });

  const body = await req.json();
  const allowed: Record<string, unknown> = {};

  if (typeof body.name === 'string') allowed.name = body.name;
  if (typeof body.gstin === 'string') allowed.gstin = body.gstin;
  if (typeof body.businessName === 'string') allowed.businessName = body.businessName;
  if (typeof body.state === 'string') allowed.state = body.state;
  if (typeof body.minRoi === 'number') allowed.minRoi = body.minRoi;
  if (typeof body.maxBuyPrice === 'number') allowed.maxBuyPrice = body.maxBuyPrice;
  if (typeof body.minProfit === 'number') allowed.minProfit = body.minProfit;
  if (typeof body.gstRateDefault === 'number') allowed.gstRateDefault = body.gstRateDefault;
  if (['conservative', 'balanced', 'aggressive'].includes(body.riskTolerance)) allowed.riskTolerance = body.riskTolerance;
  if (Array.isArray(body.preferredCategories)) allowed.preferredCategories = JSON.stringify(body.preferredCategories);
  if (typeof body.amazonConnected === 'boolean') {
    allowed.amazonConnected = body.amazonConnected;
    allowed.amazonConnectedAt = body.amazonConnected ? new Date() : null;
  }
  if (typeof body.onboardingDone === 'boolean') allowed.onboardingDone = body.onboardingDone;

  const updated = await db.user.update({ where: { id: user.id }, data: allowed });
  return NextResponse.json({
    user: { ...updated, preferredCategories: JSON.parse(updated.preferredCategories || '[]') },
  });
}
