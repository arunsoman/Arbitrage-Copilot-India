import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { notifySupplierCrm } from '@/lib/crm';

function canSee(user: { role: string; id: string }, s: { ownerId: string; supplierUserId: string | null }) {
  if (user.role === 'admin') return true;
  if (user.role === 'seller') return s.ownerId === user.id;
  if (user.role === 'supplier') return s.supplierUserId === user.id;
  return false;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const s = await db.fbaShipment.findUnique({ where: { id } });
  if (!s || !canSee(user, s)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ shipment: { ...s, items: JSON.parse(s.itemsJson || '[]'), statusHistory: JSON.parse(s.statusHistoryJson || '[]') } });
}

// Supplier: mark packed & ready · Arbitrager/Admin: cancel draft/ready shipments
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const s = await db.fbaShipment.findUnique({ where: { id } });
  if (!s || !canSee(user, s)) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const history = JSON.parse(s.statusHistoryJson || '[]') as Array<Record<string, unknown>>;

  if (body.action === 'mark_packed') {
    if (user.role !== 'supplier' || s.supplierUserId !== user.id) {
      return NextResponse.json({ error: 'Only the assigned supplier can mark the consignment packed.' }, { status: 403 });
    }
    if (!['booked', 'awb_assigned'].includes(s.status)) {
      return NextResponse.json({ error: `Cannot pack a shipment in status "${s.status}".` }, { status: 409 });
    }
    history.push({ status: 'ready_for_pickup', at: new Date().toISOString(), by: user.email, note: 'Supplier confirmed FNSKU labelling & packing complete' });
    const updated = await db.fbaShipment.update({
      where: { id },
      data: { status: 'ready_for_pickup', statusHistoryJson: JSON.stringify(history) },
    });
    return NextResponse.json({ shipment: updated });
  }

  if (body.action === 'cancel') {
    if (['in_transit', 'delivered'].includes(s.status)) {
      return NextResponse.json({ error: 'In-transit or delivered cargo cannot be cancelled.' }, { status: 409 });
    }
    history.push({ status: 'cancelled', at: new Date().toISOString(), by: user.email, note: typeof body.note === 'string' ? body.note : '' });
    const updated = await db.fbaShipment.update({
      where: { id },
      data: { status: 'cancelled', statusHistoryJson: JSON.stringify(history) },
    });
    // CRM push: pull the prep order out of the supplier's queue too.
    const crm = await notifySupplierCrm({
      origin: req.nextUrl.origin,
      event: 'cancelled',
      shipment: {
        id: updated.id,
        supplierUserId: updated.supplierUserId,
        supplierName: updated.supplierName,
        awb: updated.awb,
        courierName: updated.courierName,
        status: updated.status,
        mode: updated.mode,
        totalWeightKg: updated.totalWeightKg,
        declaredValue: updated.declaredValue,
        destinationCode: updated.destinationCode,
        itemsJson: updated.itemsJson,
        pickupToken: updated.pickupToken,
        pickupScheduledFor: updated.pickupScheduledFor,
      },
    });
    return NextResponse.json({ shipment: updated, crm });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
