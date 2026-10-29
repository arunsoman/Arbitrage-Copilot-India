'use client';

import { useCallback, useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AdminData } from '@/lib/client-types';
import { timeAgo } from '@/lib/format';
import { Activity, Bot, Download, ShieldAlert, Wrench, Globe, Save, Play, Search, TrendingUp, Loader2 } from 'lucide-react';

interface ApifyConfigView {
  actorId: string | null;
  tokenMasked: string | null;
  enabled: boolean;
  source: 'database' | 'environment' | 'none';
  hasStoredToken: boolean;
}

interface SearchReport {
  totals: { totalSearches: number; uniqueQueries: number; last7dSearches: number; avgResultsPerSearch: number };
  topQueries: Array<{ query: string; count: number; totalResults: number; avgResults: number; lastSearchedAt: string }>;
  daily: Array<{ day: string; count: number }>;
  recent: Array<{ id: string; query: string; resultCount: number; provider: string; createdAt: string }>;
}

export function AdminDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apify, setApify] = useState<ApifyConfigView | null>(null);
  const [apifyActor, setApifyActor] = useState('');
  const [apifyToken, setApifyToken] = useState('');
  const [apifyBusy, setApifyBusy] = useState<'save' | 'test' | null>(null);
  const [apifyTest, setApifyTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport] = useState<SearchReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [auditRes, configRes, reportRes] = await Promise.all([
        fetch('/api/admin/audit'),
        fetch('/api/admin/config'),
        fetch('/api/admin/search-report'),
      ]);
      const auditJson = await auditRes.json();
      setData(auditJson);
      if (configRes.ok) {
        const cfg = await configRes.json();
        setApify(cfg.apifyConfig ?? null);
        setApifyActor(cfg.apifyConfig?.actorId ?? '');
      }
      if (reportRes.ok) setReport(await reportRes.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleConfig(kind: 'toolPermissions' | 'complianceGates', key: string, value: boolean) {
    if (!data) return;
    const next = { [kind]: { ...data.config[kind], [key]: value } };
    setData({ ...data, config: { ...data.config, [kind]: { ...data.config[kind], [key]: value } } });
    try {
      await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch {
      toast({ title: 'Could not save setting', variant: 'destructive' });
      load();
    }
  }

  async function saveApify(enabled?: boolean) {
    setApifyBusy('save');
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apifyConfig: {
            actorId: apifyActor,
            token: apifyToken.trim() !== '' ? apifyToken.trim() : undefined,
            enabled: enabled ?? apify?.enabled ?? true,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setApify(json.apifyConfig);
      setApifyActor(json.apifyConfig.actorId ?? '');
      setApifyToken('');
      toast({ title: 'Apify integration saved' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Could not save Apify config', variant: 'destructive' });
    } finally {
      setApifyBusy(null);
    }
  }

  async function testApify() {
    setApifyBusy('test');
    setApifyTest(null);
    try {
      const res = await fetch('/api/admin/apify/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: apifyToken.trim() !== '' ? apifyToken.trim() : undefined, actorId: apifyActor }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Test failed');
      setApifyTest({ ok: true, text: `Token valid — Apify account "${json.username}" (${json.plan}). Live IndiaMART searches will use this actor.` });
    } catch (e) {
      setApifyTest({ ok: false, text: e instanceof Error ? e.message : 'Connection test failed' });
    } finally {
      setApifyBusy(null);
    }
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      ['timestamp', 'action', 'model', 'prompt_version', 'confidence', 'latency_ms', 'fallback'],
      ...data.logs.map((l) => [
        l.createdAt,
        l.action,
        l.modelVersion,
        l.promptVersion,
        l.confidenceScore ?? '',
        l.latencyMs ?? '',
        l.fallbackUsed,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'llm-audit-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-zinc-900">Admin & Compliance Dashboard</h1>
        <p className="text-sm text-zinc-500">Audit every LLM decision, control tool permissions and enforce compliance gates.</p>
      </div>

      {/* System health */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="System health">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Activity className="h-4 w-4 text-emerald-600" /> 📊 System Health
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Audit logs" value={String(data.stats.auditLogs)} />
          <Stat label="LLM calls" value={String(data.stats.llmCalls)} />
          <Stat label="Avg LLM latency" value={data.stats.avgLatencyMs ? `${(data.stats.avgLatencyMs / 1000).toFixed(1)}s` : '—'} />
          <Stat label="Deal analyses" value={String(data.stats.dealAnalyses)} />
          <Stat label="ASIN matches" value={String(data.stats.asinMatches)} />
          <Stat label="Listing drafts" value={String(data.stats.listingDrafts)} />
          <Stat label="Error rate" value={`${data.stats.errorRatePct}%`} tone={data.stats.errorRatePct > 5 ? 'warn' : 'ok'} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> IndiaMART API (Apify): operational
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Amazon SP-API: sandbox / simulated
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Fee engine: deterministic v1
          </span>
        </div>
      </section>

      {/* IndiaMART / Apify integration */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Apify integration">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Globe className="h-4 w-4 text-emerald-600" /> IndiaMART data source (Apify)
          </h2>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-bold',
              apify?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            )}
          >
            {apify?.enabled ? `LIVE — token from ${apify.source}` : 'DEMO DATASET — no token configured'}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Configure the Apify actor that scrapes IndiaMART. When a token is saved here it takes priority over the
          APIFY_TOKEN environment variable; without one the platform runs on the built-in demo dataset.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Actor ID</span>
            <Input
              value={apifyActor}
              onChange={(e) => setApifyActor(e.target.value)}
              placeholder="thirdwatch~indiamart-supplier-scraper"
              className="mt-1 h-10 font-mono text-xs"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
              API token {apify?.tokenMasked ? <span className="font-mono normal-case text-zinc-400">(saved: {apify.tokenMasked})</span> : null}
            </span>
            <Input
              type="password"
              value={apifyToken}
              onChange={(e) => setApifyToken(e.target.value)}
              placeholder={apify?.tokenMasked ? 'Leave empty to keep saved token' : 'apify_api_...'}
              className="mt-1 h-10 font-mono text-xs"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => saveApify()} disabled={apifyBusy !== null} className="h-10 bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800">
            {apifyBusy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save config
          </Button>
          <Button onClick={testApify} disabled={apifyBusy !== null} variant="outline" className="h-10 px-4 text-xs font-semibold">
            {apifyBusy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Test connection
          </Button>
          <span className="text-[11px] text-zinc-400">Token is stored server-side and never returned to the browser.</span>
        </div>
        {apifyTest && (
          <p role="status" className={cn('mt-2 rounded-lg px-3 py-2 text-xs font-medium', apifyTest.ok ? 'border border-emerald-200 bg-emerald-50 text-emerald-800' : 'border border-red-200 bg-red-50 text-red-700')}>
            {apifyTest.text}
          </p>
        )}
      </section>

      {/* Search insights — most-queried report */}
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm" aria-label="Search insights">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Search className="h-4 w-4 text-emerald-600" /> 🔎 Search Insights — what users query most
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">last 14 days</span>
        </div>
        {report ? (
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total searches" value={String(report.totals.totalSearches)} />
              <Stat label="Unique queries" value={String(report.totals.uniqueQueries)} />
              <Stat label="Last 7 days" value={String(report.totals.last7dSearches)} />
              <Stat label="Avg results / search" value={String(report.totals.avgResultsPerSearch)} />
            </div>

            {report.topQueries.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  <TrendingUp className="h-3.5 w-3.5" /> Top queries
                </p>
                <ul className="space-y-1.5">
                  {report.topQueries.map((q) => {
                    const max = Math.max(...report.topQueries.map((t) => t.count), 1);
                    return (
                      <li key={q.query} className="grid grid-cols-[1fr_auto] items-center gap-2">
                        <div className="min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-xs font-semibold text-zinc-800">{q.query}</span>
                            <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">avg {q.avgResults} results</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(6, (q.count / max) * 100)}%` }} />
                          </div>
                        </div>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-zinc-700">{q.count}×</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
                No searches recorded yet — the report fills in as arbitragers query IndiaMART.
              </p>
            )}

            {report.recent.length > 0 && (
              <div className="mt-4 rounded-xl bg-zinc-50/70 p-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Recent activity</p>
                <ul className="space-y-1">
                  {report.recent.slice(0, 6).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="truncate font-medium text-zinc-700">“{r.query}”</span>
                      <span className="shrink-0 text-zinc-400">{r.resultCount} results · {timeAgo(r.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4"><Skeleton className="h-24 w-full rounded-xl" /></div>
        )}
      </section>

      {/* Audit log */}
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm" aria-label="LLM audit log">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Bot className="h-4 w-4 text-emerald-600" /> 🔍 LLM Audit Log
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">model · prompt · input · output · confidence</span>
          </h2>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full min-w-[680px] text-xs">
            <thead className="sticky top-0 bg-zinc-50 text-left text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Timestamp</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Model</th>
                <th className="px-3 py-2 font-semibold">Prompt</th>
                <th className="px-3 py-2 font-semibold">Confidence</th>
                <th className="px-3 py-2 font-semibold">Latency</th>
                <th className="px-3 py-2 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    No LLM calls recorded yet — run a search or deal analysis.
                  </td>
                </tr>
              )}
              {data.logs.map((l) => (
                <tr key={l.id} className="border-b border-zinc-50 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{timeAgo(l.createdAt)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700">{l.action}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-zinc-600">{l.modelVersion}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-zinc-400">{l.promptVersion}</td>
                  <td className="px-3 py-2 tabular-nums">{l.confidenceScore ? `${Math.round(l.confidenceScore * 100)}%` : '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-zinc-500">{l.latencyMs ? `${(l.latencyMs / 1000).toFixed(1)}s` : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded px-1.5 py-0.5 font-semibold', l.fallbackUsed ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
                      {l.fallbackUsed ? 'fallback' : 'llm'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Permissions + gates */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Tool permissions">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Wrench className="h-4 w-4 text-emerald-600" /> ⚙️ Tool Permissions
          </h2>
          <div className="space-y-2.5">
            {Object.entries(data.config.toolPermissions).map(([key, on]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <code className="text-xs text-zinc-700">{key}</code>
                <div className="flex items-center gap-2">
                  {key === 'draft_listing' && !on && <span className="text-[10px] text-zinc-400">requires review</span>}
                  <Switch checked={on} onCheckedChange={(v) => toggleConfig('toolPermissions', key, v)} aria-label={`Toggle ${key}`} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Compliance gates">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <ShieldAlert className="h-4 w-4 text-emerald-600" /> 🚫 Compliance Gates
          </h2>
          <div className="space-y-2.5">
            {Object.entries(data.config.complianceGates).map(([key, on]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-xs capitalize text-zinc-700">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
                <Switch checked={on} onCheckedChange={(v) => toggleConfig('complianceGates', key, v)} aria-label={`Toggle ${key}`} />
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-zinc-50 p-2.5 text-[11px] leading-relaxed text-zinc-500">
            Mandatory gates cannot be fully disabled in production deployments — the Legal Metrology gate is enforced
            server-side in <code>/api/listing</code> regardless of UI state in this MVP.
          </p>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'ok' }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={cn('mt-0.5 text-lg font-bold tabular-nums', tone === 'warn' ? 'text-amber-600' : 'text-zinc-900')}>{value}</div>
    </div>
  );
}
