import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrap } from '@/lib/user';

export async function GET() {
  await ensureBootstrap();
  const items = await db.buyListItem.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      dealAnalysis: {
        include: { extractedProduct: { include: { indiaMartProduct: true } } },
      },
    },
  });
  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      status: i.status,
      notes: i.notes,
      createdAt: i.createdAt,
      deal: {
        id: i.dealAnalysis.id,
        title: i.dealAnalysis.extractedProduct.title,
        supplierName: i.dealAnalysis.extractedProduct.indiaMartProduct.supplierName,
        supplierLocation: i.dealAnalysis.extractedProduct.indiaMartProduct.location,
        purchasePrice: i.dealAnalysis.supplierCost,
        netProfit: i.dealAnalysis.netProfit,
        roi: i.dealAnalysis.roi,
        maxBuyPrice: i.dealAnalysis.maxBuyPrice,
        verdict: i.dealAnalysis.verdict,
        moq: i.dealAnalysis.extractedProduct.moq,
      },
    })),
  });
}

export async function POST(req: NextRequest) {
  await ensureBootstrap();
  const body = await req.json();
  const dealAnalysisId = String(body.dealAnalysisId ?? '');
  if (!dealAnalysisId) return NextResponse.json({ error: 'dealAnalysisId required' }, { status: 400 });
  const quantity = Math.max(1, Number(body.quantity ?? 1));

  // PRD US-3.4: ambiguous / rejected matches must not enter the buy list.
  const deal = await db.dealAnalysis.findUnique({
    where: { id: dealAnalysisId },
    include: { amazonMatch: true },
  });
  if (!deal) return NextResponse.json({ error: 'deal not found' }, { status: 404 });
  if (deal.verdict === 'avoid' || deal.verdict === 'needs_review') {
    return NextResponse.json(
      {
        error: 'buy_list_blocked',
        message:
          deal.verdict === 'needs_review'
            ? 'This match is ambiguous and must be approved in the review queue before it can enter your buy list.'
            : 'This deal was marked AVOID by the deterministic engine and cannot be added to the buy list.',
      },
      { status: 409 }
    );
  }

  const existing = await db.buyListItem.findFirst({ where: { dealAnalysisId } });
  if (existing) {
    const updated = await db.buyListItem.update({
      where: { id: existing.id },
      data: { quantity },
    });
    return NextResponse.json({ item: updated });
  }
  const item = await db.buyListItem.create({
    data: { dealAnalysisId, quantity, status: 'planned' },
  });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (typeof body.quantity === 'number') data.quantity = Math.max(1, body.quantity);
  if (['planned', 'quoted', 'negotiated', 'ordered', 'received'].includes(body.status)) data.status = body.status;
  if (typeof body.notes === 'string') data.notes = body.notes;
  const updated = await db.buyListItem.update({ where: { id }, data });
  return NextResponse.json({ item: updated });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await db.buyListItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
