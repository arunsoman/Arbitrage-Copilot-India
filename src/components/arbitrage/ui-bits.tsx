'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Verdict, MatchType } from '@/lib/client-types';
import { Star, MapPin, BadgeCheck, ShieldCheck } from 'lucide-react';

export const VERDICT_STYLE: Record<Verdict, { label: string; badge: string; dot: string }> = {
  strong_buy: { label: 'STRONG BUY', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
  watch: { label: 'WATCH', badge: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  avoid: { label: 'AVOID', badge: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-500' },
  needs_review: { label: 'NEEDS REVIEW', badge: 'bg-sky-100 text-sky-800 border-sky-300', dot: 'bg-sky-500' },
};

export function VerdictBadge({ verdict, size = 'md' }: { verdict: Verdict; size?: 'sm' | 'md' }) {
  const s = VERDICT_STYLE[verdict] ?? VERDICT_STYLE.needs_review;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide',
        s.badge,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export function MatchTypeBadge({ match }: { match: { matchType: MatchType; confidenceScore: number } | null }) {
  if (!match || match.matchType === 'no_match') {
    return <span className="text-xs font-medium text-zinc-500">No Match</span>;
  }
  const color =
    match.matchType === 'exact'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : match.matchType === 'variant'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-zinc-100 text-zinc-600 border-zinc-200';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium', color)}>
      {match.asin} · {match.matchType} · {Math.round(match.confidenceScore * 100)}%
    </span>
  );
}

export function SupplierBadges({
  gstVerified,
  rating,
  years,
  location,
  trustSeal,
  compact,
}: {
  gstVerified: boolean;
  rating?: number | null;
  years?: number | null;
  location?: string | null;
  trustSeal?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600', compact && 'gap-x-2')}>
      <span className={cn('inline-flex items-center gap-1 font-medium', gstVerified ? 'text-emerald-700' : 'text-red-600')}>
        <ShieldCheck className="h-3.5 w-3.5" />
        GST {gstVerified ? '✓' : '✗'}
      </span>
      {trustSeal && (
        <span className="inline-flex items-center gap-1 font-medium text-teal-700">
          <BadgeCheck className="h-3.5 w-3.5" /> TrustSEAL
        </span>
      )}
      {rating !== undefined && rating !== null && (
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {rating.toFixed(1)}
        </span>
      )}
      {years !== undefined && years !== null && <span>{years} yrs</span>}
      {!compact && location && (
        <span className="inline-flex items-center gap-1 text-zinc-500">
          <MapPin className="h-3.5 w-3.5" /> {location}
        </span>
      )}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'good' | 'bad' | 'warn' | 'strong';
}) {
  const tones: Record<string, string> = {
    default: 'text-zinc-900',
    good: 'text-emerald-700',
    bad: 'text-red-700',
    warn: 'text-amber-700',
    strong: 'text-emerald-700',
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={cn('mt-0.5 text-lg font-bold tabular-nums', tones[tone])}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

export function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: 'good' | 'bad' }) {
  return (
    <div className={cn('flex items-center justify-between py-1 text-sm', bold && 'font-semibold')}>
      <span className="text-zinc-600">{label}</span>
      <span className={cn('tabular-nums', bold && 'text-zinc-900', tone === 'good' && 'text-emerald-700', tone === 'bad' && 'text-red-700')}>
        {value}
      </span>
    </div>
  );
}

export function ConfidenceBar({ score }: { score: number }) {
  const pctVal = Math.round(score * 100);
  const color = pctVal >= 80 ? 'bg-emerald-500' : pctVal >= 60 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pctVal}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-zinc-700">{pctVal}%</span>
    </div>
  );
}

export function Sparkline({ data, width = 220, height = 44 }: { data: Array<{ day: number; price: number }>; width?: number; height?: number }) {
  if (data.length < 2) return <div className="text-xs text-zinc-400">No price history</div>;
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const points = data
    .map((d, i) => `${(i / (data.length - 1)) * width},${height - ((d.price - min) / range) * (height - 6) - 3}`)
    .join(' ');
  const up = prices[prices.length - 1] >= prices[0];
  const stroke = up ? '#059669' : '#dc2626';
  return (
    <svg width={width} height={height} className="overflow-visible" aria-label="30-day price history">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function TrendPill({ trend }: { trend: number }) {
  const down = trend < 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        down ? 'bg-red-50 text-red-700' : trend > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
      )}
    >
      {down ? '↓' : trend > 0 ? '↑' : '–'} {Math.abs(trend)}% (30d)
    </span>
  );
}
