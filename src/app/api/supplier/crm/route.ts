import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { notifySupplierCrm } from '@/lib/crm';

function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 6) return '••••••';
  return `${token.slice(0, 3)}••••••${token.slice(-3)}`;
}

// Supplier's CRM integration settings: view, update and test the webhook that
// receives consignment pushes so the supplier never has to log in here.
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'supplier') {
    return NextResponse.json({ error: 'Supplier session required.' }, { status: 403 });
  }
  const profile = await db.supplierProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: 'Supplier profile missing.' }, { status: 404 });

  const logs = await db.crmNotificationLog.findMany({
    where: { supplierUserId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  return NextResponse.json({
    crm: {
      webhookUrl: profile.crmWebhookUrl,
      apiTokenMasked: maskToken(profile.crmApiToken),
      lastNotifiedAt: profile.crmLastNotifiedAt,
      lastStatus: profile.crmLastStatus,
    },
    logs: logs.map((l) => ({
      id: l.id,
      event: l.event,
      status: l.status,
      httpStatus: l.httpStatus,
      attempts: l.attempts,
      url: l.url,
      responseSnippet: l.responseSnippet,
      createdAt: l.createdAt,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== 'supplier') {
    return NextResponse.json({ error: 'Supplier session required.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const webhookUrl = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
  if (webhookUrl && !/^(https?:\/\/|\/api\/)/i.test(webhookUrl)) {
    return NextResponse.json(
      { error: 'Webhook URL must start with https:// (or /api/ for this platform).' },
      { status: 400 }
    );
  }
  const data: { crmWebhookUrl: string | null; crmApiToken?: string } = { crmWebhookUrl: webhookUrl || null };
  if (typeof body.apiToken === 'string' && body.apiToken.trim() !== '') {
    data.crmApiToken = body.apiToken.trim();
  }
  await db.supplierProfile.update({ where: { userId: user.id }, data });
  return NextResponse.json({ ok: true });
}

// Send a test ping so the supplier can verify their CRM accepts our payloads.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== 'supplier') {
    return NextResponse.json({ error: 'Supplier session required.' }, { status: 403 });
  }
  const profile = await db.supplierProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: 'Supplier profile missing.' }, { status: 404 });
  if (!profile.crmWebhookUrl) {
    return NextResponse.json({ error: 'Add a CRM webhook URL first.' }, { status: 400 });
  }

  // A lightweight synthetic consignment representing a test push.
  const result = await notifySupplierCrm({
    origin: req.nextUrl.origin,
    event: 'consignment_booked',
    shipment: {
      id: `TEST-${Date.now().toString(36).toUpperCase()}`,
      supplierUserId: user.id,
      supplierName: profile.companyName,
      awb: null,
      courierName: null,
      status: 'test',
      mode: 'PTL',
      totalWeightKg: 0,
      declaredValue: 0,
      destinationCode: 'TEST',
      itemsJson: JSON.stringify([{ title: 'CRM integration test ping', sku: 'TEST', qty: 0 }]),
      pickupToken: null,
      pickupScheduledFor: null,
    },
  });

  return NextResponse.json({ ok: result.status === 'delivered', result });
}
