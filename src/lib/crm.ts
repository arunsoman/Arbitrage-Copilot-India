// ─── Outbound CRM webhooks for suppliers ─────────────────────────────────────
// Suppliers keep working inside their own CRM: whenever a consignment event
// happens (booked, pickup scheduled, cancelled, in transit, delivered) we POST
// a signed payload to the supplier's configured webhook URL. Deliveries are
// attempted twice and every attempt is audited in CrmNotificationLog, so ops
// can see exactly what was pushed and whether the supplier's CRM accepted it.

import { createHmac } from 'crypto';
import { db } from '@/lib/db';

export type CrmEvent =
  | 'consignment_booked'
  | 'pickup_scheduled'
  | 'cancelled'
  | 'in_transit'
  | 'delivered';

const EVENT_LABELS: Record<CrmEvent, string> = {
  consignment_booked: 'New FBA prep order booked',
  pickup_scheduled: 'Courier pickup scheduled',
  cancelled: 'Consignment cancelled',
  in_transit: 'Cargo in transit to Amazon FC',
  delivered: 'Delivered at Amazon FC',
};

export function signCrmPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

interface NotifyInput {
  shipment: {
    id: string;
    supplierUserId: string | null;
    supplierName: string;
    awb: string | null;
    courierName: string | null;
    status: string;
    mode: string;
    totalWeightKg: number;
    declaredValue: number;
    destinationCode: string | null;
    itemsJson: string;
    pickupToken: string | null;
    pickupScheduledFor: Date | null;
  };
  event: CrmEvent;
  /** Request origin of the triggering API call, used to resolve relative webhook URLs. */
  origin?: string;
}

export interface CrmNotifyResult {
  status: 'delivered' | 'failed' | 'skipped' | 'simulated';
  url: string | null;
  httpStatus: number | null;
  attempts: number;
  detail?: string;
}

function resolveUrl(raw: string, origin?: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  // Relative URL (e.g. the demo receiver '/api/mock/crm') — resolve against
  // the request origin so it works on any host, including the preview.
  const base = origin && /^https?:\/\//i.test(origin) ? origin : 'http://localhost:3000';
  try {
    return new URL(raw, base).toString();
  } catch {
    return raw;
  }
}

function buildPayload(input: NotifyInput) {
  const items = JSON.parse(input.shipment.itemsJson || '[]') as Array<Record<string, unknown>>;
  return {
    event: input.event,
    message: EVENT_LABELS[input.event],
    platform: 'arbitrage-copilot',
    consignment: {
      id: input.shipment.id,
      supplierName: input.shipment.supplierName,
      status: input.shipment.status,
      mode: input.shipment.mode,
      awb: input.shipment.awb,
      courier: input.shipment.courierName,
      totalWeightKg: input.shipment.totalWeightKg,
      declaredValueInr: input.shipment.declaredValue,
      destinationFc: input.shipment.destinationCode,
      pickupToken: input.shipment.pickupToken,
      pickupScheduledFor: input.shipment.pickupScheduledFor?.toISOString() ?? null,
      itemCount: items.length,
      totalUnits: items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
      items: items.map((i) => ({ title: i.title, sku: i.sku, qty: i.qty })),
    },
    prepRequired: ['consignment_booked', 'pickup_scheduled'].includes(input.event),
    occurredAt: new Date().toISOString(),
  };
}

async function postWebhook(url: string, body: string, secret: string): Promise<{ ok: boolean; httpStatus: number | null; snippet: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AC-Event': 'arbitrage-copilot',
        'X-AC-Signature': `sha256=${signCrmPayload(body, secret)}`,
      },
      body,
      signal: AbortSignal.timeout(6000),
    });
    const text = (await res.text().catch(() => '')) || '';
    return { ok: res.ok, httpStatus: res.status, snippet: text.slice(0, 180) };
  } catch (e) {
    return { ok: false, httpStatus: null, snippet: e instanceof Error ? e.message : 'network error' };
  }
}

/**
 * Push a consignment event to the supplier's CRM. Never throws — failures are
 * logged and returned so the calling API can surface them without breaking
 * the primary operation.
 */
export async function notifySupplierCrm(input: NotifyInput): Promise<CrmNotifyResult> {
  const profile = input.shipment.supplierUserId
    ? await db.supplierProfile.findUnique({ where: { userId: input.shipment.supplierUserId } })
    : null;

  const payload = buildPayload(input);
  const body = JSON.stringify(payload);
  const url = profile?.crmWebhookUrl ? resolveUrl(profile.crmWebhookUrl, input.origin) : null;
  const secret = profile?.crmApiToken ?? 'arbitrage-copilot-demo-secret-2026';

  let result: CrmNotifyResult;
  if (!url) {
    result = { status: 'skipped', url: null, httpStatus: null, attempts: 0, detail: 'No CRM webhook configured for this supplier.' };
  } else {
    // Two attempts with a short backoff.
    let attempt = await postWebhook(url, body, secret);
    const attempts = attempt.ok ? 1 : 2;
    if (!attempt.ok) {
      await new Promise((r) => setTimeout(r, 400));
      attempt = await postWebhook(url, body, secret);
    }
    result = {
      status: attempt.ok ? 'delivered' : 'failed',
      url,
      httpStatus: attempt.httpStatus,
      attempts,
      detail: attempt.ok ? 'Webhook accepted by supplier CRM.' : attempt.snippet,
    };
  }

  await db.crmNotificationLog.create({
    data: {
      shipmentId: input.shipment.id,
      supplierUserId: input.shipment.supplierUserId,
      event: input.event,
      url,
      status: result.status,
      httpStatus: result.httpStatus,
      attempts: result.attempts,
      payloadJson: body,
      responseSnippet: result.detail ?? null,
    },
  });

  if (profile) {
    await db.supplierProfile.update({
      where: { userId: profile.userId },
      data: { crmLastNotifiedAt: new Date(), crmLastStatus: result.status },
    });
  }

  return result;
}

/** Latest CRM push per shipment for the given shipment ids. */
export async function latestCrmStatuses(shipmentIds: string[]) {
  if (shipmentIds.length === 0) return {};
  const rows = await db.crmNotificationLog.findMany({
    where: { shipmentId: { in: shipmentIds } },
    orderBy: { createdAt: 'desc' },
  });
  const out: Record<string, { event: string; status: string; at: string }> = {};
  for (const row of rows) {
    if (!out[row.shipmentId]) {
      out[row.shipmentId] = { event: row.event, status: row.status, at: row.createdAt.toISOString() };
    }
  }
  return out;
}
