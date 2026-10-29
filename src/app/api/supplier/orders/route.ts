import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// Supplier portal home feed: consignments assigned to this supplier that need
// prep (FNSKU labelling, boxing) and their pickup state.
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'supplier') {
    return NextResponse.json({ error: 'Supplier session required.' }, { status: 403 });
  }
  const profile = user.supplierProfile;
  // Shipments explicitly linked OR matched by company name (legacy rows).
  const shipments = await db.fbaShipment.findMany({
    where: {
      OR: [
        { supplierUserId: user.id },
        { supplierName: profile ? { contains: profile.companyName.split(' ')[0] } : user.name },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  const orders = shipments.map((s) => {
    const items = JSON.parse(s.itemsJson || '[]') as Array<{ title: string; sku: string; qty: number; mrp?: number }>;
    return {
      id: s.id,
      supplierName: s.supplierName,
      destinationCode: s.destinationCode,
      destination: JSON.parse(s.destinationJson || '{}'),
      mode: s.mode,
      items,
      totalUnits: items.reduce((sum, i) => sum + i.qty, 0),
      totalWeightKg: s.totalWeightKg,
      declaredValue: s.declaredValue,
      status: s.status,
      awb: s.awb,
      courierName: s.courierName,
      pickupToken: s.pickupToken,
      pickupScheduledFor: s.pickupScheduledFor,
      labelUrl: s.labelUrl,
      manifestUrl: s.manifestUrl,
      createdAt: s.createdAt,
    };
  });

  return NextResponse.json({
    profile: profile
      ? {
          companyName: profile.companyName,
          gstin: profile.gstin,
          contactPhone: profile.contactPhone,
          addressLine: profile.addressLine,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          prepCapabilities: JSON.parse(profile.prepCapabilities || '[]'),
          crmConnected: Boolean(profile.crmWebhookUrl),
          crmLastStatus: profile.crmLastStatus,
        }
      : null,
    orders,
  });
}
