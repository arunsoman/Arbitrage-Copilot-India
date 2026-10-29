import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrap } from '@/lib/user';
import { ensureDemoUsers, getSessionUser } from '@/lib/auth';
import {
  assignAwb,
  createForwardShipment,
  generateLabel,
  generateManifest,
  guessPincodeFromLocation,
  isShiprocketLive,
  quoteFreight,
  shiprocketProviderLabel,
  suggestCargoMode,
} from '@/lib/shiprocket';
import { notifySupplierCrm, latestCrmStatuses } from '@/lib/crm';

function slugLocation(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28) || 'SUPPLIER_PRIMARY';
}

export async function GET() {
  await ensureBootstrap();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const where =
    user.role === 'seller'
      ? { ownerId: user.id }
      : user.role === 'supplier'
        ? { supplierUserId: user.id }
        : {}; // admin sees all

  const rows = await db.fbaShipment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  const crmByShipment = await latestCrmStatuses(rows.map((r) => r.id));

  return NextResponse.json({
    provider: shiprocketProviderLabel(),
    shipments: rows.map((s) => ({
      id: s.id,
      supplierName: s.supplierName,
      destinationCode: s.destinationCode,
      destination: JSON.parse(s.destinationJson || '{}'),
      mode: s.mode,
      items: JSON.parse(s.itemsJson || '[]'),
      totalWeightKg: s.totalWeightKg,
      declaredValue: s.declaredValue,
      freightQuoted: s.freightQuoted,
      freightPerKg: s.freightPerKg,
      etaDays: s.etaDays,
      provider: s.provider,
      shiprocketOrderId: s.shiprocketOrderId,
      shiprocketShipmentId: s.shiprocketShipmentId,
      awb: s.awb,
      courierName: s.courierName,
      labelUrl: s.labelUrl,
      manifestUrl: s.manifestUrl,
      pickupToken: s.pickupToken,
      pickupScheduledFor: s.pickupScheduledFor,
      status: s.status,
      statusHistory: JSON.parse(s.statusHistoryJson || '[]'),
      tracking: JSON.parse(s.trackingJson || '[]'),
      pickupAddress: JSON.parse(s.pickupAddressJson || '{}'),
      crm: crmByShipment[s.id] ?? null,
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  await ensureDemoUsers();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (user.role !== 'seller') {
    return NextResponse.json({ error: 'Only the arbitrager books FBA inbound shipments.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const buyListItemIds: string[] = Array.isArray(body.buyListItemIds) ? body.buyListItemIds : [];
  const warehouseCode = typeof body.warehouseCode === 'string' ? body.warehouseCode : '';
  const mode: 'PTL' | 'FTL' = body.mode === 'FTL' ? 'FTL' : 'PTL';

  if (buyListItemIds.length === 0) return NextResponse.json({ error: 'Select at least one buy-list item to ship.' }, { status: 400 });

  const warehouse = await db.fbaWarehouse.findUnique({ where: { code: warehouseCode } });
  if (!warehouse) return NextResponse.json({ error: 'Choose a valid Amazon Fulfillment Center.' }, { status: 400 });

  const rows = await db.buyListItem.findMany({
    where: { id: { in: buyListItemIds } },
    include: {
      dealAnalysis: { include: { extractedProduct: { include: { indiaMartProduct: true } } } },
    },
  });
  if (rows.length === 0) return NextResponse.json({ error: 'Buy-list items not found.' }, { status: 404 });

  // ── Build the cargo consignment ────────────────────────────────────────────
  const items = rows.map((r) => {
    const ep = r.dealAnalysis.extractedProduct;
    const weightGrams = ep.weightGrams ?? 500;
    return {
      buyListItemId: r.id,
      title: ep.title,
      sku: ep.supplierSku ?? `SKU-${ep.id.slice(-6).toUpperCase()}`,
      qty: r.quantity,
      unitPrice: r.dealAnalysis.supplierCost,
      weightGrams,
      hsn: '',
      mrp: ep.mrp ?? Math.round(r.dealAnalysis.supplierCost * 2.5),
      unitsPerBox: ep.packQuantity ?? 1,
    };
  });
  const totalWeightKg = Math.max(
    Math.round(items.reduce((sum, it) => sum + (it.weightGrams * it.qty) / 1000, 0) * 100) / 100,
    1
  );
  const declaredValue = Math.round(items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0));
  const totalUnits = items.reduce((sum, it) => sum + it.qty, 0);
  const supplierName = rows[0].dealAnalysis.extractedProduct.indiaMartProduct.supplierName;
  const supplierLocation = rows[0].dealAnalysis.extractedProduct.indiaMartProduct.location ?? 'India';

  // ── Resolve pickup location: supplier portal profile when available ───────
  const supplierUser = await db.user.findFirst({
    where: { role: 'supplier', supplierProfile: { companyName: { contains: supplierName.split(' ')[0] } } },
    include: { supplierProfile: true },
  });
  const profile = supplierUser?.supplierProfile ?? null;
  const pickupLocationName = profile ? profile.pickupLocationName : slugLocation(supplierName);
  const pickupAddress = profile
    ? {
        name: pickupLocationName,
        address: `${profile.addressLine ?? ''}, ${profile.city ?? ''}`.replace(/^[,\s]+|[,\s]+$/g, ''),
        city: profile.city ?? 'India',
        state: profile.state ?? 'India',
        pincode: profile.pincode ?? '110001',
        phone: profile.contactPhone ?? '+91 90000 00000',
      }
    : {
        name: pickupLocationName,
        address: `C/o ${supplierName}, ${supplierLocation}`,
        city: supplierLocation.split(',')[0]?.trim() ?? 'India',
        state: supplierLocation.split(',')[1]?.trim() ?? 'India',
        pincode: guessPincodeFromLocation(supplierLocation),
        phone: '+91 90000 00000',
      };

  // ── Serviceability + best courier ──────────────────────────────────────────
  const finalMode: 'PTL' | 'FTL' = typeof body.mode === 'string' ? mode : suggestCargoMode(totalWeightKg);
  const serviceability = await import('@/lib/shiprocket').then((m) =>
    m.checkCargoServiceability({
      pickupPincode: pickupAddress.pincode,
      deliveryPincode: warehouse.pincode,
      weightKg: totalWeightKg,
      mode: finalMode,
    })
  );
  if (!serviceability.serviceable || serviceability.couriers.length === 0) {
    return NextResponse.json(
      { error: 'no_serviceable_courier', message: `No cargo partner services the ${pickupAddress.pincode} → ${warehouse.pincode} lane for ${finalMode}.` },
      { status: 422 }
    );
  }
  const chosen =
    serviceability.couriers.find((c) => String(c.courier_company_id) === String(body.courierCompanyId)) ??
    serviceability.couriers.slice().sort((a, b) => quoteFreight(a, totalWeightKg, finalMode) - quoteFreight(b, totalWeightKg, finalMode))[0];
  const freightQuoted = quoteFreight(chosen, totalWeightKg, finalMode);

  // ── Shiprocket: create order + request shipment (single call) ─────────────
  const live = isShiprocketLive();
  const fsPayload = {
    order_id: `FBA-${Date.now().toString(36).toUpperCase()}`,
    order_date: new Date().toISOString().slice(0, 10),
    pickup_location: pickupAddress.name,
    billing_customer_name: 'Amazon Inbound Dock',
    billing_last_name: `FC ${warehouse.code}`,
    billing_address: warehouse.address,
    billing_city: warehouse.city,
    billing_pincode: warehouse.pincode,
    billing_state: warehouse.state,
    billing_country: 'India',
    billing_email: 'fba-inbound@arbitragecopilot.in',
    billing_phone: '+91 90000 00001',
    shipping_is_billing: true as const,
    order_items: items.map((it) => ({ name: it.title, sku: it.sku, units: it.qty, selling_price: it.unitPrice, hsn: it.hsn })),
    payment_method: 'Prepaid' as const,
    sub_total: declaredValue,
    length_cm: 60,
    breadth_cm: 45,
    height_cm: 40,
    weight_kg: totalWeightKg,
    shipment_type: finalMode,
  };

  const created = await createForwardShipment(fsPayload);
  const awbRes = await assignAwb(String(created.shipment_id), finalMode);
  const label = await generateLabel(String(created.shipment_id));
  const manifest = await generateManifest(String(created.shipment_id));

  // ── Persist ────────────────────────────────────────────────────────────────
  const now = new Date();
  const shipment = await db.fbaShipment.create({
    data: {
      ownerId: user.id,
      supplierUserId: supplierUser?.id ?? null,
      supplierName,
      pickupAddressJson: JSON.stringify(pickupAddress),
      destinationJson: JSON.stringify({
        code: warehouse.code,
        name: warehouse.name,
        address: warehouse.address,
        city: warehouse.city,
        state: warehouse.state,
        pincode: warehouse.pincode,
      }),
      destinationCode: warehouse.code,
      mode: finalMode,
      itemsJson: JSON.stringify(items),
      totalWeightKg,
      declaredValue,
      freightQuoted,
      freightPerKg: Math.round((freightQuoted / totalWeightKg) * 100) / 100,
      etaDays: awbRes.etd
        ? Math.max(1, Math.ceil((new Date(awbRes.etd).getTime() - now.getTime()) / 86400000))
        : chosen.eta_days,
      provider: live ? 'shiprocket' : 'demo',
      shiprocketOrderId: String(created.order_id),
      shiprocketShipmentId: String(created.shipment_id),
      awb: awbRes.awb_code,
      courierName: awbRes.courier_name,
      labelUrl: label.label_url,
      manifestUrl: manifest.manifest_url,
      status: 'awb_assigned',
      statusHistoryJson: JSON.stringify([
        { status: 'booked', at: now.toISOString(), by: user.email, note: `Cargo order created (${finalMode}, ${totalWeightKg} kg)` },
        { status: 'awb_assigned', at: now.toISOString(), by: 'shiprocket', note: `${awbRes.courier_name} · AWB ${awbRes.awb_code}` },
      ]),
    },
  });

  // Buy-list rows graduate to ordered
  await db.buyListItem.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: 'ordered' } });

  // Push the new prep order straight into the supplier's CRM (if connected) so
  // they don't need to log in to discover it.
  const crm = await notifySupplierCrm({
    origin: req.nextUrl.origin,
    event: 'consignment_booked',
    shipment: {
      id: shipment.id,
      supplierUserId: shipment.supplierUserId,
      supplierName,
      awb: shipment.awb,
      courierName: shipment.courierName,
      status: shipment.status,
      mode: finalMode,
      totalWeightKg,
      declaredValue,
      destinationCode: warehouse.code,
      itemsJson: shipment.itemsJson,
      pickupToken: null,
      pickupScheduledFor: null,
    },
  });

  const freightPerUnit = Math.round((freightQuoted / totalUnits) * 100) / 100;
  const estInboundPerUnit = rows[0].dealAnalysis.inboundShippingCost;
  return NextResponse.json({
    shipment: { id: shipment.id, awb: awbRes.awb_code, status: shipment.status },
    courier: awbRes.courier_name,
    freightQuoted,
    freightPerUnit,
    freightDeltaPerUnit: Math.round((freightPerUnit - estInboundPerUnit) * 100) / 100,
    labelUrl: label.label_url,
    manifestUrl: manifest.manifest_url,
    provider: live ? 'shiprocket' : 'demo',
    crm: { status: crm.status, detail: crm.detail, url: crm.url, supplierNotified: crm.status === 'delivered' },
  });
}
