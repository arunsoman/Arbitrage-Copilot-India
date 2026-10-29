import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { generatePickup } from '@/lib/shiprocket';
import { notifySupplierCrm } from '@/lib/crm';

// Schedule the doorstep pickup at the supplier's location (Shiprocket
// generatePickup API).
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const s = await db.fbaShipment.findUnique({ where: { id } });
  if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (user.role === 'seller' && s.ownerId !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (!s.shiprocketShipmentId) return NextResponse.json({ error: 'Shipment not created with the courier yet.' }, { status: 409 });
  if (['cancelled', 'delivered', 'in_transit', 'pickup_scheduled'].includes(s.status)) {
    return NextResponse.json({ error: `Pickup cannot be scheduled from status "${s.status}".` }, { status: 409 });
  }

  const pickup = await generatePickup(s.shiprocketShipmentId);
  const history = JSON.parse(s.statusHistoryJson || '[]') as Array<Record<string, unknown>>;
  history.push({
    status: 'pickup_scheduled',
    at: new Date().toISOString(),
    by: user.email,
    note: `${pickup.pickup_status} · Token ${pickup.pickup_token_number}`,
  });
  const updated = await db.fbaShipment.update({
    where: { id },
    data: {
      pickupToken: pickup.pickup_token_number,
      pickupScheduledFor: new Date(pickup.pickup_scheduled_date),
      status: 'pickup_scheduled',
      statusHistoryJson: JSON.stringify(history),
    },
  });

  // CRM push: supplier's system learns the courier arrival + token.
  const crm = await notifySupplierCrm({
    origin: _req.nextUrl.origin,
    event: 'pickup_scheduled',
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

  return NextResponse.json({ pickup, shipment: updated, crm });
}
