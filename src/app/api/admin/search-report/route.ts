import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// Admin report: what is being searched the most on the platform.
// Top queries with counts, daily volume for the last 14 days and recent activity.
export async function GET() {
  const { res } = await requireAdmin();
  if (res) return NextResponse.json(res.body, { status: res.status });

  const since14d = new Date(Date.now() - 14 * 86400000);
  const since7d = new Date(Date.now() - 7 * 86400000);

  const [total, uniqueQueries, last7d, rows, recent] = await Promise.all([
    db.searchLog.count(),
    db.$queryRawUnsafe<Array<{ n: number }>>('SELECT COUNT(DISTINCT query) as n FROM SearchLog'),
    db.searchLog.count({ where: { createdAt: { gte: since7d } } }),
    db.searchLog.groupBy({
      by: ['query'],
      _count: { query: true },
      _sum: { resultCount: true },
      _avg: { resultCount: true },
      _max: { createdAt: true },
      orderBy: { _count: { query: 'desc' } },
      take: 12,
    }),
    db.searchLog.findMany({ orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  // Daily buckets for the last 14 days (SQLite-safe: aggregate in JS).
  const dailyRaw = await db.searchLog.findMany({
    where: { createdAt: { gte: since14d } },
    select: { createdAt: true },
  });
  const daily: Array<{ day: string; count: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    daily.push({ day: key, count: 0 });
  }
  const dayIndex = new Map(daily.map((d, i) => [d.day, i]));
  for (const r of dailyRaw) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const idx = dayIndex.get(key);
    if (idx !== undefined) daily[idx].count++;
  }

  const totalResults = rows.reduce((a, r) => a + (r._sum.resultCount ?? 0), 0);

  return NextResponse.json({
    totals: {
      totalSearches: total,
      uniqueQueries: Number(uniqueQueries[0]?.n ?? 0),
      last7dSearches: last7d,
      avgResultsPerSearch: total > 0 ? Math.round((totalResults / total) * 10) / 10 : 0,
    },
    topQueries: rows.map((r) => ({
      query: r.query,
      count: r._count.query,
      totalResults: r._sum.resultCount ?? 0,
      avgResults: Math.round((r._avg.resultCount ?? 0) * 10) / 10,
      lastSearchedAt: r._max.createdAt,
    })),
    daily,
    recent: recent.map((r) => ({
      id: r.id,
      query: r.query,
      resultCount: r.resultCount,
      provider: r.provider,
      createdAt: r.createdAt,
    })),
  });
}
