import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ensureBootstrap, getSystemConfig } from '@/lib/user';

export async function GET() {
  const { res } = await requireAdmin();
  if (res) return NextResponse.json(res.body, { status: res.status });
  await ensureBootstrap();
  const [logs, stats, config] = await Promise.all([
    db.lLMAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
    db.$transaction([
      db.lLMAuditLog.count(),
      db.dealAnalysis.count(),
      db.amazonMatch.count(),
      db.listingDraft.count(),
      db.indiaMartProduct.count(),
      db.buyListItem.count(),
    ]),
    getSystemConfig(),
  ]);

  const llmCalls = await db.lLMAuditLog.count({ where: { fallbackUsed: false } });
  const withLatency = await db.lLMAuditLog.findMany({
    where: { latencyMs: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  const avgLatency =
    withLatency.length > 0
      ? Math.round(withLatency.reduce((a, l) => a + (l.latencyMs ?? 0), 0) / withLatency.length)
      : 0;

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      modelVersion: l.modelVersion,
      promptVersion: l.promptVersion,
      confidenceScore: l.confidenceScore,
      latencyMs: l.latencyMs,
      fallbackUsed: l.fallbackUsed,
      createdAt: l.createdAt,
      inputSnapshot: safeParse(l.inputSnapshot),
      outputJson: safeParse(l.outputJson),
    })),
    stats: {
      auditLogs: stats[0],
      dealAnalyses: stats[1],
      asinMatches: stats[2],
      listingDrafts: stats[3],
      indiaMartProducts: stats[4],
      buyListItems: stats[5],
      llmCalls,
      avgLatencyMs: avgLatency,
      errorRatePct: stats[0] > 0 ? Math.round(((stats[0] - llmCalls) / stats[0]) * 1000) / 10 : 0,
    },
    config,
  });
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
