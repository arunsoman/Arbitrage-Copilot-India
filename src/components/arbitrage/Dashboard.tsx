'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { inr } from '@/lib/format';
import { DealSummary, SearchProduct, UserProfile, Verdict } from '@/lib/client-types';
import { MatchTypeBadge, MetricTile, SupplierBadges, VerdictBadge } from './ui-bits';
import { Loader2, Search, Filter, Sparkles, ShieldCheck, TrendingDown, Eye, ShoppingCart, FileText, BarChart3, X } from 'lucide-react';

const SUGGESTIONS = ['stainless steel lunch box', 'water bottle', 'yoga mat', 'kitchen storage container', 'led bulb', 'cotton t shirt', 'resistance band', 'notebook'];

export function Dashboard({
  user,
  onOpenDeal,
  onDraftListing,
}: {
  user: UserProfile;
  onOpenDeal: (dealId: string) => void;
  onDraftListing: (dealId: string) => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [gstOnly, setGstOnly] = useState(false);
  const [searching, setSearching] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<SearchProduct[] | null>(null);
  const [recent, setRecent] = useState<DealSummary[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [extraction, setExtraction] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch('/api/deals');
      const data = await res.json();
      setRecent(data.deals ?? []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  async function doSearch(q?: string) {
    const term = (q ?? query).trim();
    if (!term) return;
    setSearching(true);
    setShowSuggestions(false);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term, gstVerifiedOnly: gstOnly }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'search failed');
      setResults(data.products);
      setProvider(data.provider);
      setExtraction(data.extractionMethod);
      if ((data.products ?? []).length === 0) {
        toast({ title: 'No products found', description: `Nothing on IndiaMART for "${term}".` });
      }
      loadRecent();
    } catch (e) {
      toast({ title: 'Search failed', description: String(e), variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  }

  async function analyze(p: SearchProduct) {
    setAnalyzingIds((prev) => new Set(prev).add(p.extractedProductId));
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedProductId: p.extractedProductId, withExplanation: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'analyze failed');
      setResults((prev) =>
        (prev ?? []).map((x) =>
          x.extractedProductId === p.extractedProductId
            ? {
                ...x,
                deal: {
                  id: data.analysis.id,
                  verdict: data.analysis.verdict,
                  roi: data.analysis.roi,
                  netProfit: data.analysis.netProfit,
                  maxBuyPrice: data.analysis.maxBuyPrice,
                  confidenceScore: data.analysis.confidenceScore,
                  riskSummary: data.analysis.riskSummary,
                  priceCutters7d: data.analysis.priceCutters7d,
                  amazonPrice: data.analysis.amazonPrice,
                  competitionSellers: data.analysis.competitionSellers,
                },
                match: data.match
                  ? { asin: data.match.asin, matchType: data.match.matchType, confidenceScore: data.match.confidenceScore }
                  : null,
              }
            : x
        )
      );
      toast({ title: 'Deal analyzed', description: `${data.analysis.verdict.replace('_', ' ').toUpperCase()} · ROI ${data.analysis.roi.toFixed(0)}%` });
      loadRecent();
    } catch (e) {
      toast({ title: 'Analysis failed', description: String(e), variant: 'destructive' });
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(p.extractedProductId);
        return next;
      });
    }
  }

  async function addToBuyList(dealId: string) {
    setAddingIds((prev) => new Set(prev).add(dealId));
    try {
      const res = await fetch('/api/buy-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealAnalysisId: dealId, quantity: 24 }),
      });
      if (res.status === 409) {
        const j = await res.json();
        toast({ title: 'Cannot add to Buy List', description: j.message, variant: 'destructive' });
        return;
      }
      if (!res.ok) throw new Error();
      toast({ title: 'Added to Buy List', description: '24 units planned. Adjust quantity in the Buy List tab.' });
      loadRecent();
    } catch {
      toast({ title: 'Could not add to buy list', variant: 'destructive' });
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(dealId);
        return next;
      });
    }
  }

  // Quick filters (PRD Screen 4)
  const quickFiltersActive = useMemo(
    () => ({
      roi: user.minRoi,
      profit: user.minProfit,
      gst: gstOnly,
    }),
    [user.minRoi, user.minProfit, gstOnly]
  );

  const filteredRecent = useMemo(() => {
    return recent.filter((d) => {
      if (quickFiltersActive.gst && !d.gstVerified) return false;
      return true;
    });
  }, [recent, quickFiltersActive]);

  return (
    <div className="space-y-6" ref={searchRef}>
      {/* Search bar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              placeholder="Search IndiaMART products…"
              className="pl-9"
              aria-label="Search IndiaMART products"
            />
            {showSuggestions && !searching && (
              <div className="absolute left-0 right-0 top-11 z-20 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Try a demo search</div>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                    onClick={() => {
                      setQuery(s);
                      doSearch(s);
                    }}
                  >
                    <Search className="h-3.5 w-3.5 text-zinc-400" /> {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button className="bg-zinc-900 hover:bg-zinc-800" onClick={() => doSearch()} disabled={searching}>
            {searching ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
            Search
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
            <Filter className="h-3.5 w-3.5" /> Quick filters:
          </span>
          <button
            onClick={() => setGstOnly((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              gstOnly ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> GST Verified {gstOnly ? '✓' : ''}
          </button>
          <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600">ROI ≥ {quickFiltersActive.roi}%</span>
          <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600">Min Profit ≥ {inr(quickFiltersActive.profit)}</span>
          <span className="ml-auto text-[11px] text-zinc-400">Rules from onboarding — change anytime in profile.</span>
        </div>
      </div>

      {/* Search results */}
      {searching && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {results && !searching && (
        <section aria-label="Search results">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              📦 Results ({results.length} products found)
              {query && <span className="text-zinc-400">for “{query}”</span>}
            </h2>
            <span className="flex items-center gap-2 text-[11px] text-zinc-400">
              provider: <code className="rounded bg-zinc-100 px-1">{provider}</code> · extraction:{' '}
              <code className="rounded bg-zinc-100 px-1">{extraction}</code>
              <button onClick={() => { setResults(null); setQuery(''); }} className="inline-flex items-center gap-0.5 hover:text-zinc-600">
                <X className="h-3 w-3" /> clear
              </button>
            </span>
          </div>
          <div className="space-y-3">
            {results.map((p) => (
              <SearchResultCard
                key={p.extractedProductId}
                product={p}
                analyzing={analyzingIds.has(p.extractedProductId)}
                adding={p.deal ? addingIds.has(p.deal.id) : false}
                onAnalyze={() => analyze(p)}
                onOpenDeal={() => p.deal && onOpenDeal(p.deal.id)}
                onDraft={() => p.deal && onDraftListing(p.deal.id)}
                onAdd={() => p.deal && addToBuyList(p.deal.id)}
                minRoi={user.minRoi}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent analyzed deals */}
      <section aria-label="Recent deals">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <BarChart3 className="h-4 w-4 text-zinc-400" /> Recent deal analyses
        </h2>
        {filteredRecent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-zinc-300" />
            <p className="mt-2 text-sm font-medium text-zinc-600">No analyzed deals yet</p>
            <p className="mt-1 text-xs text-zinc-500">
              Search IndiaMART above, then run <span className="font-medium">Analyze deal</span> to get profit, verdict and compliance checks.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredRecent.map((d) => (
              <RecentDealCard key={d.id} deal={d} onOpenDeal={onOpenDeal} onDraft={onDraftListing} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SearchResultCard({
  product,
  analyzing,
  adding,
  onAnalyze,
  onOpenDeal,
  onAdd,
  onDraft,
  minRoi,
}: {
  product: SearchProduct;
  analyzing: boolean;
  adding: boolean;
  onAnalyze: () => void;
  onOpenDeal: () => void;
  onAdd: () => void;
  onDraft: () => void;
  minRoi: number;
}) {
  const deal = product.deal;
  const verdictTone = deal
    ? deal.verdict === 'strong_buy'
      ? 'good'
      : deal.verdict === 'avoid'
        ? 'bad'
        : 'warn'
    : 'default';

  return (
    <article className={cn('rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md', deal ? verdictBorder(deal.verdict) : 'border-zinc-200')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {deal && <VerdictBadge verdict={deal.verdict} />}
            {!deal && <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">NOT ANALYZED</span>}
            {deal && (
              <span className="text-xs font-semibold text-zinc-700">
                ROI: <span className={cn(verdictTone === 'good' && 'text-emerald-700', verdictTone === 'bad' && 'text-red-700', verdictTone === 'warn' && 'text-amber-700')}>{deal.roi.toFixed(0)}%</span>
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-zinc-900" title={product.title}>
            {product.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
            <span className="font-medium text-zinc-800">Supplier: {product.supplierName}</span>
            <SupplierBadges gstVerified={product.gstVerified} rating={product.supplierRating} years={product.yearsInBusiness} compact trustSeal={product.trustSeal} />
            <span>
              Cost: <span className="font-semibold text-zinc-900">{inr(product.purchasePrice)}</span>
              {product.packQuantity > 1 && <span className="text-zinc-500"> /{product.packQuantity} pcs</span>}
            </span>
            {product.moq && <span>MOQ: {product.moq}</span>}
          </div>
          <div className="mt-1.5">
            {deal ? (
              <MatchTypeBadge match={product.match} />
            ) : (
              <span className="text-xs text-zinc-400">Run analysis to find the matching Amazon ASIN.</span>
            )}
          </div>
          {deal?.priceCutters7d ? (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
              <TrendingDown className="h-3 w-3" /> {deal.priceCutters7d} sellers cut prices this week
            </p>
          ) : null}
        </div>

        {deal && (
          <div className="grid w-full shrink-0 grid-cols-3 gap-2 sm:w-64">
            <MetricTile label="Profit" value={inr(deal.netProfit)} tone={deal.netProfit >= 0 ? 'good' : 'bad'} />
            <MetricTile label="Max Buy" value={inr(deal.maxBuyPrice)} />
            <MetricTile label="Confidence" value={`${Math.round(deal.confidenceScore * 100)}%`} />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
        {deal ? (
          <>
            <Button size="sm" variant="outline" onClick={onOpenDeal}>
              <Eye className="mr-1 h-3.5 w-3.5" /> View Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onAdd}
              disabled={adding || deal.verdict === 'avoid' || deal.verdict === 'needs_review'}
              title={
                deal.verdict === 'needs_review'
                  ? 'Ambiguous match — approve it in the review queue first'
                  : deal.verdict === 'avoid'
                    ? 'AVOID deals cannot be added to the buy list'
                    : 'Add 24 units to buy list'
              }
            >
              {adding ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="mr-1 h-3.5 w-3.5" />}
              Add to Buy List
            </Button>
            <Button size="sm" variant="ghost" onClick={onDraft} className="text-emerald-700 hover:bg-emerald-50">
              <FileText className="mr-1 h-3.5 w-3.5" /> Listing Draft
            </Button>
          </>
        ) : (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onAnalyze} disabled={analyzing}>
            {analyzing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
            {analyzing ? 'Matching & computing…' : 'Analyze deal'}
          </Button>
        )}
        {product.lmMissing.length > 0 && (
          <span className="ml-auto rounded bg-red-50 px-2 py-1 text-[11px] text-red-700" title={product.lmMissing.join(', ')}>
            ⚠ Legal Metrology: {product.lmMissing.length} mandatory field{product.lmMissing.length > 1 ? 's' : ''} missing
          </span>
        )}
      </div>
    </article>
  );
}

function RecentDealCard({ deal, onOpenDeal, onDraft }: { deal: DealSummary; onOpenDeal: (id: string) => void; onDraft: (id: string) => void }) {
  return (
    <article className={cn('rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md', verdictBorder(deal.verdict))}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={deal.verdict} size="sm" />
            <MatchTypeBadge match={deal.match} />
          </div>
          <h3 className="mt-1.5 truncate text-sm font-semibold text-zinc-900" title={deal.title}>
            {deal.title}
          </h3>
          <div className="mt-1 text-xs text-zinc-600">
            {deal.supplierName} · {deal.supplierLocation} · Cost {inr(deal.purchasePrice)}
          </div>
        </div>
        <div className="text-right">
          <div className={cn('text-lg font-bold tabular-nums', deal.roi >= 25 ? 'text-emerald-700' : deal.roi >= 15 ? 'text-amber-700' : 'text-red-700')}>
            {deal.roi.toFixed(0)}%
          </div>
          <div className="text-[11px] text-zinc-500">ROI</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-600">
        <span>
          Profit: <b className="text-zinc-900">{inr(deal.netProfit)}</b>
        </span>
        <span>
          Max Buy: <b className="text-zinc-900">{inr(deal.maxBuyPrice)}</b>
        </span>
        <span>
          Amazon: <b className="text-zinc-900">{deal.amazonPrice ? inr(deal.amazonPrice) : '—'}</b>
        </span>
        <span>Confidence: <b className="text-zinc-900">{Math.round(deal.confidenceScore * 100)}%</b></span>
      </div>
      <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
        <Button size="sm" variant="outline" onClick={() => onOpenDeal(deal.id)}>
          <Eye className="mr-1 h-3.5 w-3.5" /> View Details
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDraft(deal.id)} className="text-emerald-700 hover:bg-emerald-50">
          <FileText className="mr-1 h-3.5 w-3.5" /> Listing
        </Button>
      </div>
    </article>
  );
}

function verdictBorder(v: Verdict): string {
  return v === 'strong_buy'
    ? 'border-emerald-200'
    : v === 'watch'
      ? 'border-amber-200'
      : v === 'avoid'
        ? 'border-red-200'
        : 'border-sky-200';
}
