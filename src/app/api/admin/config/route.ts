import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getApifyConfig, maskToken } from '@/lib/apify-config';
import { getSystemConfig } from '@/lib/user';

export async function GET() {
  const { res } = await requireAdmin();
  if (res) return NextResponse.json(res.body, { status: res.status });
  const [config, apify] = await Promise.all([getSystemConfig(), getApifyConfig()]);
  return NextResponse.json({
    ...config,
    apifyConfig: {
      actorId: apify.source === 'database' ? apify.actorId : apify.actorId,
      tokenMasked: maskToken(apify.token),
      enabled: apify.enabled,
      source: apify.source,
      hasStoredToken: apify.source === 'database',
    },
  });
}

export async function PUT(req: NextRequest) {
  const { res } = await requireAdmin();
  if (res) return NextResponse.json(res.body, { status: res.status });
  const body = await req.json().catch(() => ({}));

  if (body.toolPermissions && typeof body.toolPermissions === 'object') {
    await db.systemConfig.upsert({
      where: { key: 'toolPermissions' },
      update: { value: JSON.stringify(body.toolPermissions) },
      create: { key: 'toolPermissions', value: JSON.stringify(body.toolPermissions) },
    });
  }
  if (body.complianceGates && typeof body.complianceGates === 'object') {
    await db.systemConfig.upsert({
      where: { key: 'complianceGates' },
      update: { value: JSON.stringify(body.complianceGates) },
      create: { key: 'complianceGates', value: JSON.stringify(body.complianceGates) },
    });
  }

  // Apify integration config: token is write-only (never returned). An empty
  // string keeps the stored token; explicit null clears it.
  if (body.apifyConfig && typeof body.apifyConfig === 'object') {
    const incoming = body.apifyConfig as { actorId?: unknown; token?: unknown; enabled?: unknown };
    const existingRow = await db.systemConfig.findUnique({ where: { key: 'apifyConfig' } });
    const existing = existingRow ? (JSON.parse(existingRow.value) as Record<string, unknown>) : {};
    const next: Record<string, unknown> = { ...existing };
    if (typeof incoming.actorId === 'string') next.actorId = incoming.actorId.trim();
    if (incoming.token === null) delete next.token;
    else if (typeof incoming.token === 'string' && incoming.token.trim() !== '') next.token = incoming.token.trim();
    next.enabled = incoming.enabled !== false;
    await db.systemConfig.upsert({
      where: { key: 'apifyConfig' },
      update: { value: JSON.stringify(next) },
      create: { key: 'apifyConfig', value: JSON.stringify(next) },
    });
  }

  const [config, apify] = await Promise.all([getSystemConfig(), getApifyConfig()]);
  return NextResponse.json({
    ...config,
    apifyConfig: {
      actorId: apify.actorId,
      tokenMasked: maskToken(apify.token),
      enabled: apify.enabled,
      source: apify.source,
      hasStoredToken: apify.source === 'database',
    },
  });
}
