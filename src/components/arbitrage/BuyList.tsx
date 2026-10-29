'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { inr } from '@/lib/format';
import { BuyListItemData, Verdict } from '@/lib/client-types';
import { VerdictBadge } from './ui-bits';
import { ShoppingCart, Trash2, Loader2, Eye } from 'lucide-react';

const STATUSES = ['planned', 'quoted', 'negotiated', 'ordered', 'received'] as const;

export function BuyList({ onOpenDeal }: { onOpenDeal: (dealId: string) => void }) {
  const { toast } = useToast();
  const [items, setItems] = useState<BuyListItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/buy-list');
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateItem(id: string, patch: { quantity?: number; status?: string }) {
    setBusyId(id);
    try {
      await fetch('/api/buy-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      await load();
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/buy-list?id=${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast({ title: 'Removed from buy list' });
    } catch {
      toast({ title: 'Remove failed', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  const totals = items.reduce(
    (acc, i) => ({
      units: acc.units + i.quantity,
      cost: acc.cost + i.quantity * i.deal.purchasePrice,
      profit: acc.profit + i.quantity * i.deal.netProfit,
    }),
    { units: 0, cost: 0, profit: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Buy List / Action Plan</h1>
          <p className="text-sm text-zinc-500">Planned purchases from IndiaMART suppliers. Track quote → order → receipt.</p>
        </div>
        {items.length > 0 && (
          <div className="flex gap-2 text-xs">
            <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
              <div className="text-zinc-500">Planned units</div>
              <div className="text-base font-bold tabular-nums text-zinc-900">{totals.units}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
              <div className="text-zinc-500">Capital outlay</div>
              <div className="text-base font-bold tabular-nums text-zinc-900">{inr(totals.cost)}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="text-emerald-700">Projected profit</div>
              <div className="text-base font-bold tabular-nums text-emerald-800">{inr(totals.profit)}</div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <ShoppingCart className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-2 text-sm font-medium text-zinc-600">Your buy list is empty</p>
          <p className="mt-1 text-xs text-zinc-500">Analyze deals on the dashboard and click “Add to Buy List”.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  <th className="px-3 py-2.5 font-semibold">Supplier</th>
                  <th className="px-3 py-2.5 font-semibold">Verdict</th>
                  <th className="px-3 py-2.5 font-semibold">Unit cost</th>
                  <th className="px-3 py-2.5 font-semibold">Unit profit</th>
                  <th className="px-3 py-2.5 font-semibold">Qty</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-zinc-100 last:border-0">
                    <td className="max-w-[220px] px-4 py-3">
                      <div className="truncate font-medium text-zinc-900" title={i.deal.title}>
                        {i.deal.title}
                      </div>
                      {i.deal.moq && <div className="text-[11px] text-zinc-500">MOQ {i.deal.moq} units</div>}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {i.deal.supplierName}
                      <div className="text-[11px] text-zinc-400">{i.deal.supplierLocation}</div>
                    </td>
                    <td className="px-3 py-3">
                      <VerdictBadge verdict={i.deal.verdict as Verdict} size="sm" />
                    </td>
                    <td className="px-3 py-3 tabular-nums">{inr(i.deal.purchasePrice)}</td>
                    <td className={cn('px-3 py-3 font-semibold tabular-nums', i.deal.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                      {inr(i.deal.netProfit)}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={1}
                        value={i.quantity}
                        onChange={(e) => {
                          const q = Math.max(1, Number(e.target.value) || 1);
                          setItems((prev) => prev.map((x) => (x.id === i.id ? { ...x, quantity: q } : x)));
                        }}
                        onBlur={(e) => {
                          const q = Math.max(1, Number(e.target.value) || 1);
                          if (q !== i.quantity) updateItem(i.id, { quantity: q });
                        }}
                        className="h-8 w-16 rounded-md border border-zinc-200 px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        aria-label={`Quantity for ${i.deal.title}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={i.status}
                        onChange={(e) => updateItem(i.id, { status: e.target.value })}
                        className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        aria-label={`Status for ${i.deal.title}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => onOpenDeal(i.deal.id)} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="View deal">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(i.id)} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove item">
                          {busyId === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
