import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { checkCargoServiceability, guessPincodeFromLocation, quoteFreight, shiprocketProviderLabel, suggestCargoMode } from '@/lib/shiprocket';

// Rate & serviceability quote for a cargo lane before booking. Accepts either
// buy-list selection ({ buyListItemIds, warehouseCode }) or a raw lane
// ({ pickupPincode, deliveryPincode, weightKg }).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let pickupPincode = typeof body.pickupPincode === 'string' ? body.pickupPincode : '';
  let deliveryPincode = typeof body.deliveryPincode === 'string' ? body.deliveryPincode : '';
  let weightKg = typeof body.weightKg === 'number' ? body.weightKg : 0;
  let totalUnits = 0;
  let estInboundPerUnit: number | null = null;

  if (Array.isArray(body.buyListItemIds) && body.buyListItemIds.length > 0) {
    const rows = await db.buyListItem.findMany({
      where: { id: { in: body.buyListItemIds } },
      include: { dealAnalysis: { include: { extractedProduct: { include: { indiaMartProduct: true } } } } },
    });
    weightKg = 0;
    totalUnits = rows.reduce((s, r) => s + r.quantity, 0);
    for (const r of rows) {
      const w = (r.dealAnalysis.extractedProduct.weightGrams ?? 500) * r.quantity;
      weightKg += w / 1000;
      estInboundPerUnit = r.dealAnalysis.inboundShippingCost;
    }
    const supplierName = rows[0]?.dealAnalysis.extractedProduct.indiaMartProduct.supplierName ?? '';
    const supplierLoc = rows[0]?.dealAnalysis.extractedProduct.indiaMartProduct.location ?? '';
    if (supplierName) {
      const su = await db.user.findFirst({
        where: { role: 'supplier', supplierProfile: { companyName: { contains: supplierName.split(' ')[0] } } },
        include: { supplierProfile: true },
      });
      if (su?.supplierProfile?.pincode) pickupPincode = su.supplierProfile.pincode;
    }
    if (!pickupPincode) pickupPincode = guessPincodeFromLocation(supplierLoc);
    if (typeof body.warehouseCode === 'string') {
      const wh = await db.fbaWarehouse.findUnique({ where: { code: body.warehouseCode } });
      if (wh) {
        deliveryPincode = wh.pincode;
      }
    }
  }

  if (!/^\d{6}$/.test(pickupPincode) || !/^\d{6}$/.test(deliveryPincode)) {
    return NextResponse.json({ error: 'Both 6-digit pickup and delivery pincodes are required.' }, { status: 400 });
  }
  weightKg = Math.max(Math.round(weightKg * 100) / 100, 1);
  const mode: 'PTL' | 'FTL' = body.mode === 'FTL' || body.mode === 'PTL' ? body.mode : suggestCargoMode(weightKg);

  const serviceability = await checkCargoServiceability({ pickupPincode, deliveryPincode, weightKg, mode });
  const quotes = serviceability.couriers
    .map((c) => ({ ...c, freight: quoteFreight(c, weightKg, mode) }))
    .sort((a, b) => a.freight - b.freight);

  return NextResponse.json({
    provider: shiprocketProviderLabel(),
    lane: { pickupPincode, deliveryPincode, weightKg, mode },
    suggestedMode: suggestCargoMode(weightKg),
    serviceable: serviceability.serviceable,
    quotes: quotes.map((q) => ({
      courierCompanyId: q.courier_company_id,
      courierName: q.courier_name,
      ratePerKg: q.rate_per_kg,
      minFreight: q.min_freight,
      freight: q.freight,
      freightPerUnit: totalUnits > 0 ? Math.round((q.freight / totalUnits) * 100) / 100 : null,
      etaDays: q.eta_days,
      services: q.services,
    })),
    profitImpact: estInboundPerUnit != null && quotes[0] && totalUnits > 0
      ? {
          estimatedInboundPerUnit: estInboundPerUnit,
          quotedFreightPerUnit: Math.round((quotes[0].freight / totalUnits) * 100) / 100,
          deltaPerUnit: Math.round((quotes[0].freight / totalUnits - estInboundPerUnit) * 100) / 100,
        }
      : null,
  });
}
