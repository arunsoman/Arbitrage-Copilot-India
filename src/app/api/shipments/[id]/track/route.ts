import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { trackAwb } from '@/lib/shiprocket';
import { notifySupplierCrm } from '@/lib/crm';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const s = await db.fbaShipment.findUnique({ where: { id } });
  if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (user.role === 'seller' && s.ownerId !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (user.role === 'supplier' && s.supplierUserId !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (!s.awb) return NextResponse.json({ error: 'AWB not assigned yet.' }, { status: 409 });

  const tracking = await trackAwb(s.awb, s.courierName ?? undefined);
  const history = JSON.parse(s.statusHistoryJson || '[]') as Array<Record<string, unknown>>;
  let status = s.status;
  if (tracking.delivered && status !== 'delivered') {
    status = 'delivered';
    history.push({ status: 'delivered', at: new Date().toISOString(), by: 'shiprocket', note: `POD at ${s.destinationCode}` });
  } else if (!tracking.delivered && tracking.scans.length >= 3 && ['awb_assigned', 'ready_for_pickup', 'pickup_scheduled'].includes(status)) {
    status = 'in_transit';
    history.push({ status: 'in_transit', at: new Date().toISOString(), by: 'shiprocket', note: tracking.scans[tracking.scans.length - 1]?.activity ?? '' });
  }
  const previousStatus = s.status;
  await db.fbaShipment.update({
    where: { id },
    data: { trackingJson: JSON.stringify(tracking.scans), status, statusHistoryJson: JSON.stringify(history) },
  });

  // CRM push on milestone transitions so the supplier's system stays in sync.
  let crm = null;
  if (status !== previousStatus && (status === 'in_transit' || status === 'delivered')) {
    crm = await notifySupplierCrm({
      origin: req.nextUrl.origin,
      event: status,
      shipment: {
        id: s.id,
        supplierUserId: s.supplierUserId,
        supplierName: s.supplierName,
        awb: s.awb,
        courierName: s.courierName,
        status,
        mode: s.mode,
        totalWeightKg: s.totalWeightKg,
        declaredValue: s.declaredValue,
        destinationCode: s.destinationCode,
        itemsJson: s.itemsJson,
        pickupToken: s.pickupToken,
        pickupScheduledFor: s.pickupScheduledFor,
      },
    });
  }

  return NextResponse.json({ tracking, crm });
}
