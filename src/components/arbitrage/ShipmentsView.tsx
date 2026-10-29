'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Truck, PackageCheck, MapPin, Weight, IndianRupee, Clock, FileText, Receipt,
  Radio, CheckCircle2, CircleDashed, Loader2, Plus, X, ChevronRight, BadgeIndianRupee, Webhook,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Shipment, QuoteResponse, FbaWarehouseData, CourierQuote, TrackingScan } from '@/lib/client-types';

const STATUS_FLOW = ['booked', 'awb_assigned', 'ready_for_pickup', 'pickup_scheduled', 'in_transit', 'delivered'] as const;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  booked: { label: 'Booked', cls: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  awb_assigned: { label: 'AWB Assigned', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  ready_for_pickup: { label: 'Packed · Ready', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  pickup_scheduled: { label: 'Pickup Scheduled', cls: 'bg-violet-50 text-violet-800 border-violet-200' },
  in_transit: { label: 'In Transit', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  delivered: { label: 'Delivered at FC', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function ShipmentsView({ canBook = true }: { canBook?: boolean }) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [warehouses, setWarehouses] = useState<FbaWarehouseData[]>([]);
  const [provider, setProvider] = useState<string>('shiprocket-demo');
  const [loading, setLoading] = useState(true);
  const [bookOpen, setBookOpen] = useState(false);
  const [trackingFor, setTrackingFor] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TrackingScan[] | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, wRes] = await Promise.all([fetch('/api/shipments'), fetch('/api/fba/warehouses')]);
      const sJson = await sRes.json();
      const wJson = await wRes.json();
      setShipments(sJson.shipments ?? []);
      setProvider(sJson.provider ?? 'shiprocket-demo');
      setWarehouses(wJson.warehouses ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function track(id: string) {
    setTrackingFor(id);
    setTracking(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/shipments/${id}/track`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Tracking failed');
      setTracking(json.tracking?.scans ?? []);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Tracking failed');
      setTrackingFor(null);
    }
  }

  async function schedulePickup(id: string) {
    setActionBusy(`pickup:${id}`);
    setActionError(null);
    try {
      const res = await fetch(`/api/shipments/${id}/pickup`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Pickup scheduling failed');
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Pickup scheduling failed');
    } finally {
      setActionBusy(null);
    }
  }

  const stats = useMemo(() => {
    const active = shipments.filter((s) => !['delivered', 'cancelled'].includes(s.status));
    const freight = shipments.reduce((sum, s) => sum + (s.freightQuoted ?? 0), 0);
    return { active: active.length, freight, delivered: shipments.filter((s) => s.status === 'delivered').length };
  }, [shipments]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">FBA Inbound Shipments</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Supplier → Amazon FC bulk cargo via{' '}
            <Badge variant="outline" className={cn('gap-1 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800')}>
              <Truck className="h-3 w-3" /> Shiprocket Cargo
            </Badge>
            <span className="ml-1 text-xs">{provider === 'shiprocket-live' ? '(live API)' : '(sandbox)'}</span>
          </p>
        </div>
        <Button onClick={() => setBookOpen(true)} className="h-11 w-full text-sm font-semibold sm:w-auto" data-testid="new-shipment" disabled={!canBook}>
          <Plus className="mr-1.5 h-4 w-4" /> New FBA Shipment
        </Button>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active', value: String(stats.active), icon: <Radio className="h-3.5 w-3.5" /> },
          { label: 'Freight booked', value: inr(stats.freight), icon: <BadgeIndianRupee className="h-3.5 w-3.5" /> },
          { label: 'Delivered', value: String(stats.delivered), icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {s.icon} {s.label}
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-zinc-900">{s.value}</div>
          </div>
        ))}
      </div>

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{actionError}</p>
      )}

      {/* Shipment cards */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
      ) : shipments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <Truck className="mx-auto h-10 w-10 text-zinc-300" />
          <p className="mt-3 text-sm font-semibold text-zinc-700">No cargo shipments yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
            Book your first B2B consignment from an IndiaMART supplier to an Amazon Fulfillment Center. PTL / FTL rates start around ₹6/kg.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {shipments.map((s) => (
            <ShipmentCard
              key={s.id}
              shipment={s}
              onTrack={() => track(s.id)}
              onPickup={() => schedulePickup(s.id)}
              trackingBusy={trackingFor === s.id}
              pickupBusy={actionBusy === `pickup:${s.id}`}
            />
          ))}
        </ul>
      )}

      {/* Tracking sheet */}
      <Dialog open={trackingFor !== null} onOpenChange={(open) => { if (!open) { setTrackingFor(null); setTracking(null); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Radio className="h-4 w-4 text-amber-600" /> Tracking · AWB</DialogTitle>
          </DialogHeader>
          {tracking === null ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
          ) : (
            <ol className="relative space-y-4 border-l-2 border-zinc-200 pl-5">
              {[...tracking].reverse().map((scan, i) => (
                <li key={i} className="relative">
                  <span className={cn('absolute -left-[27px] top-0.5 h-4 w-4 rounded-full border-2 border-white', i === 0 ? 'bg-emerald-500' : 'bg-zinc-300')} />
                  <p className="text-sm font-semibold text-zinc-900">{scan.status}</p>
                  <p className="text-xs leading-relaxed text-zinc-600">{scan.activity}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{scan.location} · {new Date(scan.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>

      {canBook && (
        <BookingDialog open={bookOpen} onClose={() => setBookOpen(false)} warehouses={warehouses} onBooked={() => { setBookOpen(false); load(); }} />
      )}
    </div>
  );
}

function ShipmentCard({ shipment: s, onTrack, onPickup, trackingBusy, pickupBusy }: {
  shipment: Shipment; onTrack: () => void; onPickup: () => void; trackingBusy: boolean; pickupBusy: boolean;
}) {
  const statusMeta = STATUS_META[s.status] ?? STATUS_META.booked;
  const canPickup = ['awb_assigned', 'ready_for_pickup', 'booked'].includes(s.status);
  const stepIdx = STATUS_FLOW.indexOf(s.status as (typeof STATUS_FLOW)[number]);

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      {/* Route header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-zinc-900">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="truncate">{s.pickupAddress?.city ?? 'Supplier'} · {s.supplierName}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="truncate">FC {s.destinationCode}</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {s.mode} cargo · {s.totalWeightKg} kg · {s.items.reduce((a, i) => a + i.qty, 0)} units · declared {inr(s.declaredValue)}
          </p>
        </div>
        <Badge variant="outline" className={cn('shrink-0 text-[10px] font-semibold', statusMeta.cls)}>{statusMeta.label}</Badge>
      </div>

      {/* Lane progress */}
      <div className="mt-4 flex items-center gap-1">
        {STATUS_FLOW.map((st, i) => (
          <div key={st} className="flex flex-1 flex-col gap-1" title={STATUS_META[st]?.label ?? st}>
            <span className={cn('h-1.5 rounded-full', i <= stepIdx ? 'bg-amber-500' : 'bg-zinc-200')} />
            <span className={cn('text-[9px] font-medium leading-none', i <= stepIdx ? 'text-zinc-700' : 'text-zinc-300')}>
              {STATUS_META[st]?.label.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      {/* Courier & freight grid */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Info icon={<PackageCheck className="h-3.5 w-3.5" />} label="AWB" value={s.awb ?? '—'} mono />
        <Info icon={<Truck className="h-3.5 w-3.5" />} label="Courier" value={s.courierName ?? '—'} />
        <Info icon={<IndianRupee className="h-3.5 w-3.5" />} label="Freight" value={s.freightQuoted != null ? `${inr(s.freightQuoted)} (${s.freightPerKg ?? '—'}/kg)` : '—'} />
        <Info icon={<Clock className="h-3.5 w-3.5" />} label="ETA" value={s.etaDays != null ? `${s.etaDays} days` : '—'} />
      </div>

      {/* Items */}
      <div className="mt-3 max-h-36 space-y-1.5 overflow-y-auto rounded-xl bg-zinc-50 p-2.5" style={{ scrollbarWidth: 'thin' }}>
        {s.items.map((it, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-zinc-700">{it.title}</span>
            <span className="shrink-0 font-semibold tabular-nums text-zinc-500">{it.qty} × {inr(it.unitPrice)}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canPickup && (
          <Button size="sm" onClick={onPickup} disabled={pickupBusy} className="h-9 bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800">
            {pickupBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
            Schedule Pickup
          </Button>
        )}
        {s.pickupScheduledFor && (
          <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 text-[11px] font-medium text-violet-800">
            <CircleDashed className="h-3.5 w-3.5" />
            Pickup {new Date(s.pickupScheduledFor).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · Token {s.pickupToken}
          </span>
        )}
        {s.awb && (
          <Button size="sm" variant="outline" onClick={onTrack} disabled={trackingBusy} className="h-9 text-xs font-semibold">
            {trackingBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />} Track
          </Button>
        )}
        {s.labelUrl && (
          <a href={s.labelUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
            <FileText className="h-3.5 w-3.5" /> Label
          </a>
        )}
        {s.crm && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium',
              s.crm.status === 'delivered'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-zinc-200 bg-zinc-50 text-zinc-500'
            )}
            title={`Last CRM push: ${s.crm.event} · ${s.crm.status}`}
          >
            <Webhook className="h-3.5 w-3.5" />
            CRM {s.crm.status === 'delivered' ? 'notified' : s.crm.status}
          </span>
        )}
        {s.manifestUrl && (
          <a href={s.manifestUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
            <Receipt className="h-3.5 w-3.5" /> Manifest
          </a>
        )}
      </div>
    </li>
  );
}

function Info({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">{icon} {label}</div>
      <div className={cn('mt-0.5 truncate font-semibold text-zinc-900', mono && 'font-mono text-[11px]')}>{value}</div>
    </div>
  );
}

// ── Booking wizard (select items → FC & mode → quote → confirm) ──────────────

function BookingDialog({ open, onClose, warehouses, onBooked }: {
  open: boolean; onClose: () => void; warehouses: FbaWarehouseData[]; onBooked: () => void;
}) {
  const [items, setItems] = useState<Array<{ id: string; title: string; qty: number; unitPrice: number; weightGrams: number; supplierName: string; profit: number }>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [warehouseCode, setWarehouseCode] = useState('');
  const [mode, setMode] = useState<'PTL' | 'FTL'>('PTL');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [courierId, setCourierId] = useState<number | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ awb: string; courier: string; freight: number; freightDeltaPerUnit: number; labelUrl: string; manifestUrl: string; crm: { status: string; detail?: string } | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1); setQuote(null); setBooked(null); setError(null); setCourierId(null); setSelected({});
    (async () => {
      const res = await fetch('/api/buy-list');
      const json = await res.json();
      const shippable = (json.items ?? []).filter((i: { status: string }) => ['planned', 'quoted', 'negotiated'].includes(i.status));
      setItems(shippable.map((i: { id: string; quantity: number; deal: { title: string; purchasePrice: number; netProfit: number; supplierName: string } }) => ({
        id: i.id, title: i.deal.title, qty: i.quantity, unitPrice: i.deal.purchasePrice,
        weightGrams: 500, supplierName: i.deal.supplierName, profit: i.deal.netProfit,
      })));
    })();
  }, [open]);

  const selIds = useMemo(() => items.filter((i) => selected[i.id]).map((i) => i.id), [items, selected]);
  const totalWeight = useMemo(
    () => Math.round(items.filter((i) => selected[i.id]).reduce((sum, i) => sum + (i.weightGrams * i.qty) / 1000, 0) * 100) / 100,
    [items, selected]
  );

  async function getQuote() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/shipments/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyListItemIds: selIds, warehouseCode, mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.message ?? 'Quote failed');
      setQuote(json);
      setCourierId(json.quotes?.[0]?.courierCompanyId ?? null);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quote failed');
    } finally {
      setBusy(false);
    }
  }

  async function book() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyListItemIds: selIds, warehouseCode, mode, courierCompanyId: courierId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? 'Booking failed');
      setBooked({
        awb: json.shipment.awb, courier: json.courier, freight: json.freightQuoted,
        freightDeltaPerUnit: json.freightDeltaPerUnit, labelUrl: json.labelUrl, manifestUrl: json.manifestUrl,
        crm: json.crm ?? null,
      });
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setBusy(false);
    }
  }

  const chosen: CourierQuote | null = quote?.quotes.find((q) => q.courierCompanyId === courierId) ?? null;
  const wh = warehouses.find((w) => w.code === warehouseCode);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" style={{ scrollbarWidth: 'thin' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4 text-amber-600" /> New FBA Inbound Shipment
            <span className="ml-auto text-xs font-normal text-zinc-400">Step {Math.min(step, 4)} of 4</span>
          </DialogTitle>
        </DialogHeader>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

        {/* Step 1: pick cargo */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-zinc-500">
              Consolidate buy-list items into one B2B cargo consignment. Shiprocket Cargo picks up from the supplier&apos;s premises.
            </p>
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500">
                No shippable buy-list items. Add STRONG BUY / WATCH deals to your buy list first.
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {items.map((it) => (
                  <label key={it.id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors', selected[it.id] ? 'border-amber-400 bg-amber-50' : 'border-zinc-200 hover:bg-zinc-50')}>
                    <input
                      type="checkbox"
                      checked={Boolean(selected[it.id])}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [it.id]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 accent-amber-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900">{it.title}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {it.supplierName} · {it.qty} × {inr(it.unitPrice)} · est. {it.weightGrams} g/unit
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} className="h-10 text-sm">Cancel</Button>
              <Button disabled={selIds.length === 0} onClick={() => setStep(2)} className="h-10 bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800">
                Next: Destination <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: FC + mode */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Amazon Fulfillment Center</p>
              <div className="max-h-52 space-y-2 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {warehouses.map((w) => (
                  <label key={w.code} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors', warehouseCode === w.code ? 'border-amber-400 bg-amber-50' : 'border-zinc-200 hover:bg-zinc-50')}>
                    <input type="radio" name="wh" checked={warehouseCode === w.code} onChange={() => setWarehouseCode(w.code)} className="mt-0.5 h-4 w-4 accent-amber-600" />
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900">{w.code} — {w.name}</span>
                      <span className="block text-xs text-zinc-500">{w.address}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cargo mode · consolidated weight {totalWeight} kg</p>
              <div className="grid grid-cols-2 gap-2">
                {(['PTL', 'FTL'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn('rounded-xl border p-3 text-left transition-colors', mode === m ? 'border-amber-400 bg-amber-50' : 'border-zinc-200 hover:bg-zinc-50')}
                  >
                    <span className="block text-sm font-bold text-zinc-900">{m}</span>
                    <span className="block text-[11px] leading-snug text-zinc-500">
                      {m === 'PTL' ? 'Part Truck Load — pay per kg, from ~₹6/kg' : 'Full Truck Load — flat per-lane truck rate'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="h-10 text-sm">Back</Button>
              <Button disabled={!warehouseCode || busy} onClick={getQuote} className="h-10 bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Check Rates &amp; Serviceability
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: quotes */}
        {step === 3 && quote && (
          <div className="space-y-3">
            <div className="rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600">
              Lane <span className="font-semibold">{quote.lane.pickupPincode} → {quote.lane.deliveryPincode}</span> · {quote.lane.weightKg} kg ·
              suggested <span className="font-semibold">{quote.suggestedMode}</span>
              {quote.profitImpact && (
                <span className={cn('mt-1 block font-semibold', quote.profitImpact.deltaPerUnit > 0 ? 'text-red-700' : 'text-emerald-700')}>
                  Profit impact: freight = {inr(quote.profitImpact.quotedFreightPerUnit)}/unit ({quote.profitImpact.deltaPerUnit >= 0 ? '+' : ''}{inr(quote.profitImpact.deltaPerUnit)} vs engine estimate)
                </span>
              )}
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {quote.quotes.map((q) => (
                <label key={q.courierCompanyId} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors', courierId === q.courierCompanyId ? 'border-amber-400 bg-amber-50' : 'border-zinc-200 hover:bg-zinc-50')}>
                  <input type="radio" name="courier" checked={courierId === q.courierCompanyId} onChange={() => setCourierId(q.courierCompanyId)} className="h-4 w-4 accent-amber-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-900">{q.courierName}</span>
                    <span className="block text-[11px] text-zinc-500">₹{q.ratePerKg}/kg · min {inr(q.minFreight)} · ETA {q.etaDays} d · {q.services.join(', ')}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold tabular-nums text-zinc-900">{inr(q.freight)}</span>
                    {q.freightPerUnit != null && <span className="block text-[10px] text-zinc-500">{inr(q.freightPerUnit)}/unit</span>}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="h-10 text-sm">Back</Button>
              <Button disabled={!chosen || busy} onClick={book} className="h-10 bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Book Cargo · {chosen ? inr(chosen.freight) : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: confirmation */}
        {step === 4 && booked && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <div>
              <p className="text-base font-bold text-zinc-900">Cargo booked via Shiprocket</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Order created, courier assigned and label + manifest generated. Schedule the doorstep pickup from the shipment card.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-left">
              <Info icon={<PackageCheck className="h-3.5 w-3.5" />} label="AWB" value={booked.awb} mono />
              <Info icon={<Truck className="h-3.5 w-3.5" />} label="Courier" value={booked.courier} />
              <Info icon={<Weight className="h-3.5 w-3.5" />} label="Freight" value={inr(booked.freight)} />
              <Info icon={<BadgeIndianRupee className="h-3.5 w-3.5" />} label="Per-unit delta" value={`${booked.freightDeltaPerUnit >= 0 ? '+' : ''}${inr(booked.freightDeltaPerUnit)}`} />
            </div>
            {booked.crm && (
              <p
                role="status"
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-medium',
                  booked.crm.status === 'delivered'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                )}
              >
                {booked.crm.status === 'delivered'
                  ? '🔗 Supplier CRM notified — the prep order was pushed to their system automatically.'
                  : `Supplier CRM push: ${booked.crm.status}${booked.crm.detail ? ` — ${booked.crm.detail}` : ''}`}
              </p>
            )}
            <div className="flex justify-center gap-2">
              <a href={booked.labelUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                <FileText className="h-3.5 w-3.5" /> Label
              </a>
              <a href={booked.manifestUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                <Receipt className="h-3.5 w-3.5" /> Manifest
              </a>
              <Button onClick={onBooked} className="h-10 bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800">Done</Button>
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>
    );
  }
