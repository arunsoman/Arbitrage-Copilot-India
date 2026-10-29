'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { inr } from '@/lib/format';
import { DealDetailData } from '@/lib/client-types';
import { MetricTile, Row, Sparkline, SupplierBadges, TrendPill, VerdictBadge, MatchTypeBadge } from './ui-bits';
import {
  ArrowLeft, Loader2, Sparkles, Package, ShieldCheck, AlertTriangle, Check, X,
  FileText, ShoppingCart, Send, Bot, CheckCheck, Wrench, Scale,
} from 'lucide-react';

export function DealDetail({
  dealId,
  onBack,
  onDraft,
}: {
  dealId: string;
  onBack: () => void;
  onDraft: (dealId: string) => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<DealDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'failed');
      setData(json);
    } catch (e) {
      toast({ title: 'Could not load deal', description: String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [dealId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateDraft() {
    if (!data) return;
    setDrafting(true);
    try {
      const res = await fetch('/api/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealAnalysisId: dealId }),
      });
      const json = await res.json();
      if (res.status === 422) {
        toast({
          title: 'Listing blocked — Legal Metrology',
          description: `Missing: ${json.missing.join(', ')}. Ask the supplier for these mandatory declarations first.`,
          variant: 'destructive',
        });
        return;
      }
      if (!res.ok) throw new Error(json.detail ?? 'failed');
      onDraft(dealId);
    } catch (e) {
      toast({ title: 'Draft generation failed', description: String(e), variant: 'destructive' });
    } finally {
      setDrafting(false);
    }
  }

  async function addToBuyList() {
    setAdding(true);
    try {
      await fetch('/api/buy-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealAnalysisId: dealId, quantity: 24 }),
      });
      toast({ title: 'Added to Buy List', description: '24 units planned.' });
    } catch {
      toast({ title: 'Could not add', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  }

  async function verifyMatch(decision: 'approved' | 'rejected') {
    if (!data?.match) return;
    try {
      await fetch('/api/match/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: data.match.id, decision }),
      });
      toast({ title: decision === 'approved' ? 'Match approved' : 'Match rejected — routed back to review queue' });
      load();
    } catch {
      toast({ title: 'Could not record decision', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const a = data.analysis;
  const ex = a.extractedProduct;
  const im = ex.indiaMartProduct;
  const lmChecks = [
    { label: 'MRP', value: ex.mrp ? inr(ex.mrp) : null },
    { label: 'Manufacturer', value: ex.manufacturerName },
    { label: 'Country of Origin', value: ex.countryOfOrigin },
    { label: 'Net Quantity', value: ex.netQuantity },
    { label: 'Customer Care', value: ex.customerCare },
    { label: 'Mfg. Month/Year', value: ex.monthYearMfg },
  ];
  const lmMissingCount = lmChecks.filter((c) => !c.value).length;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">{ex.title}</h1>
        <VerdictBadge verdict={a.verdict} />
      </div>

      {/* Top cards: image + supplier */}
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="flex h-40 items-center justify-center rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-100 to-zinc-50 md:h-full">
          <div className="text-center text-zinc-400">
            <Package className="mx-auto h-10 w-10" />
            <div className="mt-1 text-[11px] font-medium">{ex.category ?? 'Product'} image</div>
            <div className="text-[10px]">from IndiaMART listing</div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Supplier</h2>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-base font-semibold text-zinc-900">{im.supplierName}</div>
            <span className="text-[11px] text-zinc-400">{im.supplierType ?? ''} · {im.yearsInBusiness ?? '?'} yrs in business</span>
          </div>
          <div className="mt-2">
            <SupplierBadges gstVerified={im.gstVerified} rating={im.supplierRating} years={im.yearsInBusiness} location={im.location} trustSeal={im.trustSeal} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600 sm:grid-cols-4">
            <div>
              <div className="text-zinc-400">MOQ</div>
              <div className="font-semibold text-zinc-900">{ex.moq ? `${ex.moq} units` : '—'}</div>
            </div>
            <div>
              <div className="text-zinc-400">Pack</div>
              <div className="font-semibold text-zinc-900">{ex.packQuantity} pc{ex.packQuantity > 1 ? 's' : ''}</div>
            </div>
            <div>
              <div className="text-zinc-400">GST rate</div>
              <div className="font-semibold text-zinc-900">{ex.gstRate}%</div>
            </div>
            <div>
              <div className="text-zinc-400">Brand</div>
              <div className="font-semibold text-zinc-900">{ex.brand ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Profit breakdown + Amazon data */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Profit breakdown">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            💰 Profit Breakdown <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">DETERMINISTIC</span>
          </h2>
          <div className="space-y-0.5">
            <Row label="Supplier Cost" value={inr(a.supplierCost)} />
            <Row label={`GST (${ex.gstRate}%)`} value={inr(a.gstAmount)} />
            <Row label="Inbound Shipping" value={inr(a.inboundShippingCost)} />
            <Row label="Packaging" value={inr(a.packagingCost)} />
            <div className="my-1.5 border-t border-dashed border-zinc-200" />
            <Row label="Total Cost" value={inr(a.totalCost)} bold />
            <Row label="Amazon Payout" value={inr(a.netPayout)} />
            <div className="my-1.5 border-t border-dashed border-zinc-200" />
            <Row label="NET PROFIT" value={inr(a.netProfit)} bold tone={a.netProfit >= 0 ? 'good' : 'bad'} />
            <Row label="ROI" value={`${a.roi.toFixed(1)}%`} bold tone={a.roi >= 25 ? 'good' : a.roi >= 15 ? undefined : 'bad'} />
            <Row label="Max Buy Price" value={inr(a.maxBuyPrice)} bold />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Amazon data">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            📊 Amazon Data
            {a.amazonPrice > 0 && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">{data.match?.asin}</span>}
          </h2>
          {data.match && data.match.matchType !== 'no_match' && a.amazonPrice > 0 ? (
            <>
              <div className="space-y-0.5">
                <Row label="Current Price" value={inr(a.amazonPrice)} />
                <Row label={`Referral Fee`} value={`${inr(a.referralFee)}`} />
                <Row label="Closing Fee" value={inr(a.closingFee)} />
                <Row label="FBA Fulfillment" value={inr(a.fbaFulfillmentFee)} />
                <div className="my-1.5 border-t border-dashed border-zinc-200" />
                <Row label="Net Payout" value={inr(a.netPayout)} bold />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 p-3">
                <div>
                  <div className="text-[11px] font-medium text-zinc-500">Price history (30d)</div>
                  <Sparkline data={data.history} width={200} height={40} />
                </div>
                <div className="text-right">
                  <TrendPill trend={a.priceTrend30d} />
                  <div className="mt-1 text-[11px] text-zinc-500">{a.competitionSellers} active sellers</div>
                  {a.priceCutters7d > 0 && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
                      <AlertTriangle className="h-3 w-3" /> {a.priceCutters7d} cut prices in 7d
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-sm text-zinc-500">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-zinc-300" />
              No reliable Amazon ASIN match — profit model unavailable.
            </div>
          )}
        </section>
      </div>

      {/* AI verdict */}
      <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm" aria-label="AI verdict">
        <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <Bot className="h-4 w-4 text-emerald-600" /> 🤖 AI Verdict
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">
            {a.explanationSource === 'llm' ? 'tool-calling agent' : 'template fallback'}
          </span>
        </h2>
        <p className="text-sm leading-relaxed text-zinc-700">{a.explanation ?? 'Generating explanation…'}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>
              Confidence: <b className="text-zinc-800">{Math.round(a.confidenceScore * 100)}%</b>
            </span>
            <span className="text-zinc-300">|</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600" /> All numbers from deterministic calculators
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" title="Deterministic tool trace">
            <Wrench className="h-3 w-3 text-zinc-400" />
            {a.toolTrace.map((t) => (
              <span key={t.tool} title={t.summary} className="cursor-help rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 hover:bg-zinc-200">
                {t.tool}
              </span>
            ))}
          </div>
        </div>
        {/* Verdict reasons checklist */}
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {a.verdictReasons.map((r) => (
            <div key={r.code} className={cn('flex items-start gap-2 rounded-lg border p-2 text-xs', r.passed ? 'border-emerald-100 bg-emerald-50/60' : 'border-red-100 bg-red-50/60')}>
              {r.passed ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
              <div>
                <div className={cn('font-semibold', r.passed ? 'text-emerald-800' : 'text-red-700')}>{r.label}</div>
                <div className="text-zinc-600">{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Match card */}
      {data.match && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="ASIN match">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              🔗 Amazon ASIN Match <MatchTypeBadge match={data.match} />
            </h2>
            {data.match.needsReview && !data.match.verifiedByUser && (
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => verifyMatch('approved')}>
                  <CheckCheck className="mr-1 h-3.5 w-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="h-7 border-red-200 text-red-700 hover:bg-red-50" onClick={() => verifyMatch('rejected')}>
                  <X className="mr-1 h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            )}
            {data.match.verifiedByUser === 'approved' && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Verified by you ✓</span>}
            {data.match.verifiedByUser === 'rejected' && <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Rejected — in review queue</span>}
          </div>
          {data.match.matchType !== 'no_match' ? (
            <>
              <p className="text-sm text-zinc-700">{data.match.productTitle}</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {data.match.reasons.slice(0, 6).map((r, i) => (
                  <div key={i} className="rounded-lg bg-zinc-50 p-2 text-xs">
                    <span className={cn('font-semibold', r.weight >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                      {r.weight >= 0 ? '+' : ''}
                      {r.weight} {r.signal}
                    </span>
                    <span className="text-zinc-600"> — {r.detail}</span>
                  </div>
                ))}
              </div>
              <details className="mt-2 text-xs text-zinc-500">
                <summary className="cursor-pointer select-none hover:text-zinc-700">Retrieval cascade trace</summary>
                <ol className="mt-1.5 list-inside list-decimal space-y-0.5">
                  {data.match.cascadeTrace.map((s, i) => (
                    <li key={i}>
                      <b>{s.stage}</b> — {s.description}
                      {s.topScore !== undefined && ` · top score ${s.topScore}`}
                    </li>
                  ))}
                </ol>
              </details>
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              No ASIN matched with sufficient confidence. The item is likely too generic or not sold on Amazon.in.
            </p>
          )}
        </section>
      )}

      {/* Legal Metrology */}
      <section className={cn('rounded-2xl border p-4 shadow-sm', lmMissingCount === 0 ? 'border-emerald-200 bg-white' : 'border-amber-200 bg-white')} aria-label="Legal Metrology check">
        <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <Scale className="h-4 w-4 text-zinc-400" /> 📋 Legal Metrology Check
          {lmMissingCount === 0 ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">COMPLIANT</span>
          ) : (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{lmMissingCount} MISSING</span>
          )}
        </h2>
        <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {lmChecks.map((c) => (
            <div key={c.label} className="flex items-start gap-1.5 text-xs">
              {c.value ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />}
              <span className={cn(c.value ? 'text-zinc-700' : 'text-zinc-400')}>
                <b>{c.label}:</b> {c.value ?? 'missing — obtain from supplier'}
              </span>
            </div>
          ))}
        </div>
        {lmMissingCount > 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-800">
            Listing generation is gated by the Legal Metrology (Packaged Commodities) Rules 2011. Obtain the missing
            declarations from the supplier before drafting the Amazon listing. Non-compliance has led to 448 notices
            and ₹77.9L in compounding fees across e-commerce entities.
          </p>
        )}
      </section>

      {/* Actions */}
      <div className="sticky bottom-16 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={generateDraft} disabled={drafting}>
          {drafting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
          Generate Listing Draft
        </Button>
        <Button
          variant="outline"
          onClick={() => toast({ title: 'Supplier inquiry (Phase 2)', description: 'AI-drafted supplier messages arrive in Phase 2. For now, contact the supplier on IndiaMART.' })}
        >
          <Send className="mr-1 h-4 w-4" /> Send Supplier Inquiry
        </Button>
        <Button
          variant="outline"
          onClick={addToBuyList}
          disabled={adding || a.verdict === 'avoid' || a.verdict === 'needs_review'}
          title={
            a.verdict === 'needs_review'
              ? 'Ambiguous match — approve it in the review queue first (US-3.4)'
              : a.verdict === 'avoid'
                ? 'AVOID deals cannot be added to the buy list'
                : 'Add 24 units to buy list'
          }
        >
          {adding ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-1 h-4 w-4" />}
          Add to Buy List
        </Button>
      </div>
    </div>
  );
}
