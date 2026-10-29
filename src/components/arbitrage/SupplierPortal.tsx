'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Factory, MapPin, Phone, PackageCheck, Tag, Boxes, ClipboardCheck, Truck,
  Loader2, CircleDashed, FileText, Receipt, IndianRupee, Weight, CheckCircle2, BadgeCheck,
  Webhook, Send, Save, Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SessionUser, SupplierOrdersData } from '@/lib/client-types';

interface CrmData {
  crm: { webhookUrl: string | null; apiTokenMasked: string | null; lastNotifiedAt: string | null; lastStatus: string | null };
  logs: Array<{ id: string; event: string; status: string; httpStatus: number | null; attempts: number; url: string | null; responseSnippet: string | null; createdAt: string }>;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  booked: { label: 'New Order — Prep Required', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  awb_assigned: { label: 'AWB Assigned — Prep Required', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  ready_for_pickup: { label: 'Packed · Awaiting Pickup', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  pickup_scheduled: { label: 'Pickup Scheduled', cls: 'bg-violet-50 text-violet-800 border-violet-200' },
  in_transit: { label: 'In Transit', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  delivered: { label: 'Delivered at FC', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const PREP_STEPS = [
  { icon: <Tag className="h-4 w-4" />, title: 'Print & paste FNSKU labels', body: 'Each sellable unit must carry the Amazon-assigned FNSKU barcode covering the original barcode (or use manufacturer barcode if enrolled).' },
  { icon: <Boxes className="h-4 w-4" />, title: 'Box to FBA spec', body: 'Use six-sided rigid cartons, B2B cargo grade. Max 22 kg per box unless containing a single oversize unit. Attach the box ID label on top.' },
  { icon: <ClipboardCheck className="h-4 w-4" />, title: 'Legal Metrology declarations', body: 'MRP, manufacturer, country of origin and net quantity must be printed on each unit — mandatory under LM Rules 2017 for marketplace listing.' },
  { icon: <PackageCheck className="h-4 w-4" />, title: 'Keep consignment ready', body: 'Goods must be packed, stacked at the pickup point and accompanied by the manifest before the courier arrives.' },
];

const EVENT_META: Record<string, { label: string; cls: string }> = {
  consignment_booked: { label: 'New prep order', cls: 'bg-amber-50 text-amber-800' },
  pickup_scheduled: { label: 'Pickup scheduled', cls: 'bg-violet-50 text-violet-800' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-700' },
  in_transit: { label: 'In transit', cls: 'bg-sky-50 text-sky-800' },
  delivered: { label: 'Delivered at FC', cls: 'bg-emerald-50 text-emerald-700' },
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function SupplierPortal({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [data, setData] = useState<SupplierOrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crmData, setCrmData] = useState<CrmData | null>(null);
  const [crmUrl, setCrmUrl] = useState('');
  const [crmToken, setCrmToken] = useState('');
  const [crmBusy, setCrmBusy] = useState<'save' | 'test' | null>(null);
  const [crmMsg, setCrmMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/supplier/orders');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load orders');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadCrm = useCallback(async () => {
    try {
      const res = await fetch('/api/supplier/crm', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) {
        setCrmData(json);
        setCrmUrl(json.crm.webhookUrl ?? '');
      }
    } catch {
      /* CRM panel is optional — ignore load failures */
    }
  }, []);

  useEffect(() => { loadCrm(); }, [loadCrm]);

  async function saveCrm() {
    setCrmBusy('save');
    setCrmMsg(null);
    try {
      const res = await fetch('/api/supplier/crm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: crmUrl, apiToken: crmToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setCrmToken('');
      setCrmMsg({ ok: true, text: 'CRM webhook saved. New consignments will be pushed automatically.' });
      await loadCrm();
    } catch (e) {
      setCrmMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setCrmBusy(null);
    }
  }

  async function testCrm() {
    setCrmBusy('test');
    setCrmMsg(null);
    try {
      const res = await fetch('/api/supplier/crm', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Test failed');
      const r = json.result as { status: string; url: string | null; httpStatus: number | null };
      setCrmMsg(
        r.status === 'delivered'
          ? { ok: true, text: `Test push delivered to your CRM (${r.httpStatus}). Check the inbox entry below.` }
          : { ok: false, text: `Test push failed (${r.status}). Verify the URL is reachable.` }
      );
      await loadCrm();
    } catch (e) {
      setCrmMsg({ ok: false, text: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setCrmBusy(null);
    }
  }

  async function markPacked(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_packed' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Update failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  const pending = data?.orders.filter((o) => ['booked', 'awb_assigned'].includes(o.status)) ?? [];
  const upcoming = data?.orders.filter((o) => ['ready_for_pickup', 'pickup_scheduled'].includes(o.status)) ?? [];
  const done = data?.orders.filter((o) => ['in_transit', 'delivered', 'cancelled'].includes(o.status)) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
              <Factory className="h-4 w-4 text-white" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-zinc-900">Supplier Portal</p>
              <p className="truncate text-[10px] font-medium text-zinc-500">{data?.profile?.companyName ?? user.businessName ?? user.name}</p>
            </div>
          </div>
          <button onClick={onLogout} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 pb-16 pt-6">
        {/* Profile card */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-bold tracking-tight text-zinc-900">
              Namaste, {user.name} <BadgeCheck className="inline h-4 w-4 text-emerald-600" />
            </h1>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-800">
              {pending.length + upcoming.length} active consignment{(pending.length + upcoming.length) === 1 ? '' : 's'}
            </Badge>
          </div>
          {data?.profile ? (
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-600 sm:grid-cols-2">
              <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />{data.profile.addressLine}, {data.profile.city}, {data.profile.state} — {data.profile.pincode}</p>
              <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" />{data.profile.contactPhone ?? '—'} · GSTIN {data.profile.gstin ?? '—'}</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">Complete your supplier profile to receive FBA prep orders.</p>
          )}
        </section>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        {/* CRM push integration — receive orders without logging in */}
        <section aria-label="CRM integration" className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
              <Webhook className="h-4 w-4 text-emerald-600" /> CRM push integration
            </h2>
            {crmData?.crm.webhookUrl ? (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-800">
                <Radio className="mr-1 h-3 w-3" /> Connected — orders pushed automatically
              </Badge>
            ) : (
              <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-[10px] font-semibold text-zinc-600">
                Not connected
              </Badge>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Connect your own CRM or ERP webhook: every consignment event (new prep order, pickup scheduled, in transit,
            delivered, cancelled) is signed with your secret key and POSTed to your system in real time — no need to log
            in to this portal.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              value={crmUrl}
              onChange={(e) => setCrmUrl(e.target.value)}
              placeholder="https://your-crm.example.com/hooks/arbitrage-copilot"
              className="h-10 text-xs"
              aria-label="CRM webhook URL"
            />
            <div className="flex gap-2">
              <Button onClick={saveCrm} disabled={crmBusy !== null} className="h-10 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
                {crmBusy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </Button>
              <Button onClick={testCrm} disabled={crmBusy !== null || !crmData?.crm.webhookUrl} variant="outline" className="h-10 px-3 text-xs font-semibold">
                {crmBusy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send test
              </Button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
            <span>Secret key: <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono">{crmData?.crm.apiTokenMasked ?? '—'}</code></span>
            {crmData?.crm.lastNotifiedAt && (
              <span>Last push {new Date(crmData.crm.lastNotifiedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {crmData.crm.lastStatus}</span>
            )}
          </div>
          {crmMsg && (
            <p role="status" className={cn('mt-2 rounded-lg px-3 py-2 text-xs font-medium', crmMsg.ok ? 'border border-emerald-200 bg-emerald-50 text-emerald-800' : 'border border-red-200 bg-red-50 text-red-700')}>
              {crmMsg.text}
            </p>
          )}
          {crmData && crmData.logs.length > 0 && (
            <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50/60 p-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Recent CRM pushes</p>
              <ul className="space-y-1">
                {crmData.logs.map((l) => {
                  const meta = EVENT_META[l.event] ?? { label: l.event, cls: 'bg-zinc-100 text-zinc-700' };
                  return (
                    <li key={l.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={cn('rounded px-1.5 py-0.5 font-semibold', meta.cls)}>{meta.label}</span>
                      <span className={cn('font-semibold', l.status === 'delivered' ? 'text-emerald-700' : l.status === 'failed' ? 'text-red-600' : 'text-zinc-400')}>
                        {l.status}{l.httpStatus ? ` · ${l.httpStatus}` : ''}
                      </span>
                      <span className="truncate font-mono text-[10px] text-zinc-400">{l.url ?? '—'}</span>
                      <span className="ml-auto shrink-0 text-zinc-400">{new Date(l.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>


        {/* Prep playbook */}
        <section aria-label="FBA prep instructions">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">FBA prep playbook</h2>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PREP_STEPS.map((s, i) => (
              <div key={i} className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">{s.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{s.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Orders */}
        <section aria-label="Consignment orders">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Consignment orders</h2>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
          ) : data?.orders.length ? (
            <div className="mt-2 space-y-4">
              {[...pending, ...upcoming, ...done].map((o) => {
                const meta = STATUS_META[o.status] ?? STATUS_META.booked;
                const canPack = ['booked', 'awb_assigned'].includes(o.status);
                return (
                  <article key={o.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-900">
                          {o.totalUnits} units → FC {o.destinationCode} <span className="font-normal text-zinc-500">({o.destination?.city}, {o.destination?.state})</span>
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {o.mode} cargo · {o.totalWeightKg} kg · value {inr(o.declaredValue)}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn('shrink-0 text-[10px] font-semibold', meta.cls)}>{meta.label}</Badge>
                    </div>

                    <div className="mt-3 max-h-32 space-y-1 overflow-y-auto rounded-xl bg-zinc-50 p-2.5" style={{ scrollbarWidth: 'thin' }}>
                      {o.items.map((it, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate text-zinc-700">{it.title}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-zinc-500">×{it.qty} · SKU {it.sku}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {canPack && (
                        <Button onClick={() => markPacked(o.id)} disabled={busyId === o.id} className="h-10 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700">
                          {busyId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Mark Packed &amp; Ready
                        </Button>
                      )}
                      {o.pickupScheduledFor && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 text-[11px] font-medium text-violet-800">
                          <CircleDashed className="h-3.5 w-3.5" />
                          Pickup {new Date(o.pickupScheduledFor).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · Token {o.pickupToken}
                        </span>
                      )}
                      {o.awb && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-mono font-medium text-zinc-700">
                          <Truck className="h-3.5 w-3.5" /> {o.courierName} · {o.awb}
                        </span>
                      )}
                      {o.labelUrl && (
                        <a href={o.labelUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50">
                          <FileText className="h-3.5 w-3.5" /> Label
                        </a>
                      )}
                      {o.manifestUrl && (
                        <a href={o.manifestUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50">
                          <Receipt className="h-3.5 w-3.5" /> Manifest
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
              <Factory className="mx-auto h-10 w-10 text-zinc-300" />
              <p className="mt-3 text-sm font-semibold text-zinc-700">No consignments yet</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
                When an arbitrager books cargo from your warehouse to an Amazon FC, the prep order will appear here.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="mt-auto border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-4xl px-4 py-3 text-center text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Shiprocket Cargo doorstep pickup · <Weight className="h-3 w-3" /> PTL from ~₹6/kg</span>
        </div>
      </footer>
    </div>
  );
}
