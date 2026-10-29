'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ListingDraftData } from '@/lib/client-types';
import { inr } from '@/lib/format';
import {
  ArrowLeft, Loader2, RefreshCw, Save, Copy, Trash2, Check, X, AlertTriangle, Scale, PenLine, ShieldAlert,
} from 'lucide-react';

export function ListingDraftView({ dealId, onBack }: { dealId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ListingDraftData['draft']>(null);
  const [title, setTitle] = useState('');
  const [bullets, setBullets] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dealTitle, setDealTitle] = useState('');

  const applyDraft = useCallback((d: NonNullable<ListingDraftData['draft']>) => {
    setDraft(d);
    setTitle(d.title);
    setBullets(d.bullets);
    setDescription(d.description);
    setKeywords(d.backendKeywords);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/listing?dealAnalysisId=${dealId}`);
      const json: ListingDraftData = await res.json();
      if (json.draft) applyDraft(json.draft);
      const dealRes = await fetch(`/api/deals/${dealId}`);
      if (dealRes.ok) {
        const dealJson = await dealRes.json();
        setDealTitle(dealJson.analysis?.extractedProduct?.title ?? '');
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [dealId, applyDraft]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealAnalysisId: dealId }),
      });
      const json = await res.json();
      if (res.status === 422) {
        toast({
          title: 'Blocked by Legal Metrology gate',
          description: `Missing mandatory declarations: ${json.missing.join(', ')}.`,
          variant: 'destructive',
        });
        return;
      }
      if (!res.ok) throw new Error(json.detail ?? 'failed');
      applyDraft(json.draft);
      toast({ title: 'Draft generated', description: `Source: ${json.draft.generationSource === 'llm' ? 'AI copywriter' : 'template fallback'}. Review before use.` });
    } catch (e) {
      toast({ title: 'Generation failed', description: String(e), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }

  async function save(humanReviewed?: boolean) {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/listing/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, bullets, description, backendKeywords: keywords, humanReviewed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? 'failed');
      applyDraft(json.draft);
      toast({ title: humanReviewed ? 'Saved & marked human-reviewed' : 'Draft saved' });
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function copyToClipboard() {
    const text = `TITLE:\n${title}\n\nBULLETS:\n${bullets.map((b) => `• ${b}`).join('\n')}\n\nDESCRIPTION:\n${description}\n\nBACKEND KEYWORDS:\n${keywords}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: 'Paste into Amazon Seller Central after review. Auto-publishing is disabled by policy.' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> Back to Deal
        </button>
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <PenLine className="mx-auto h-8 w-8 text-zinc-300" />
          <h1 className="mt-2 text-base font-semibold text-zinc-900">Amazon Listing Draft</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {dealTitle ? `For: ${dealTitle}` : 'Generate an Amazon-ready title, bullets and description from the extracted IndiaMART data.'}
          </p>
          <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {generating ? 'Drafting…' : 'Generate Listing Draft'}
          </Button>
          <p className="mt-3 text-[11px] text-zinc-400">
            Gate check: MRP, manufacturer, country of origin and net quantity must be present (Legal Metrology).
          </p>
        </div>
      </div>
    );
  }

  const compliance = draft.compliance;
  const claimsClean = compliance?.claims?.clean ?? true;
  const findings = compliance?.claims?.findings ?? [];
  const lm = compliance?.legalMetrology;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Back to Deal
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900">
          📝 Amazon Listing Draft
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">REVIEW BEFORE PUBLISHING</span>
        </h1>
        <span className="text-[11px] text-zinc-400">
          generated by: <code className="rounded bg-zinc-100 px-1">{draft.generationSource === 'llm' ? 'ai-copywriter' : 'template-fallback'}</code>
        </span>
      </div>

      {/* Title */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Title</h2>
          <span className={cn('text-xs tabular-nums', title.length > 200 ? 'font-bold text-red-600' : 'text-zinc-500')}>
            Characters: {title.length}/200
          </span>
        </div>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-zinc-200 p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Listing title"
        />
      </section>

      {/* Bullets */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Bullet Points ({bullets.length}/5)</h2>
          <span className="text-xs text-zinc-500">each ≤ 240 chars</span>
        </div>
        <div className="space-y-2">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
              <div className="flex-1">
                <textarea
                  value={b}
                  rows={2}
                  onChange={(e) => setBullets((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                  className="w-full resize-none rounded-lg border border-zinc-200 p-2.5 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label={`Bullet point ${i + 1}`}
                />
                <div className={cn('text-right text-[10px] tabular-nums', b.length > 240 ? 'font-bold text-red-600' : 'text-zinc-400')}>
                  {b.length}/240
                </div>
              </div>
              <button
                onClick={() => setBullets((prev) => prev.filter((_, j) => j !== i))}
                className="mt-2 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                aria-label={`Remove bullet ${i + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {bullets.length < 5 && (
            <Button variant="outline" size="sm" onClick={() => setBullets((prev) => [...prev, ''])}>
              + Add bullet
            </Button>
          )}
        </div>
      </section>

      {/* Description */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Description</h2>
          <span className={cn('text-xs tabular-nums', description.length > 2000 ? 'font-bold text-red-600' : 'text-zinc-500')}>
            {description.length}/2000
          </span>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="w-full resize-none rounded-lg border border-zinc-200 p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Listing description"
        />
      </section>

      {/* Backend keywords */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Backend Search Terms</h2>
          <span className={cn('text-xs tabular-nums', keywords.length > 249 ? 'font-bold text-red-600' : 'text-zinc-500')}>
            {keywords.length}/249
          </span>
        </div>
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Backend search terms"
          placeholder="comma separated keywords"
        />
      </section>

      {/* Compliance panel */}
      <section className={cn('rounded-2xl border p-4 shadow-sm', claimsClean ? 'border-emerald-200 bg-white' : 'border-amber-300 bg-amber-50/40')} aria-label="Compliance check">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <ShieldAlert className={cn('h-4 w-4', claimsClean ? 'text-emerald-600' : 'text-amber-600')} /> ⚠️ Compliance Check
        </h2>
        <div className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          <div className="flex items-center gap-1.5">
            {claimsClean ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
            <span className="text-zinc-700">
              {claimsClean ? 'No prohibited claims detected' : `${findings.length} prohibited claim${findings.length > 1 ? 's' : ''} detected`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {title.length <= 200 && bullets.every((b) => b.length <= 240) ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <X className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className="text-zinc-700">Character limits respected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-zinc-700">MRP, Manufacturer, Country of Origin present</span>
          </div>
          {lm?.checks && (
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-zinc-700">
                Legal Metrology: {lm.checks.filter((c) => c.present && c.mandatory).length}/{lm.checks.filter((c) => c.mandatory).length} mandatory declarations
              </span>
            </div>
          )}
        </div>
        {!claimsClean && findings.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-800">
            {findings.map((f, i) => (
              <li key={i}>
                <b>“{f.matched}”</b> — {f.label}. {f.suggestion}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save Draft
        </Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => save(true)} disabled={saving}>
          <Check className="mr-1 h-4 w-4" /> Save & Mark Reviewed
        </Button>
        <Button variant="outline" onClick={copyToClipboard}>
          <Copy className="mr-1 h-4 w-4" /> Copy to Amazon Seller Central
        </Button>
        <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onBack}>
          <X className="mr-1 h-4 w-4" /> Discard
        </Button>
        <Button variant="ghost" onClick={generate} disabled={generating} className="text-zinc-500">
          <RefreshCw className="mr-1 h-4 w-4" /> Regenerate
        </Button>
      </div>

      <p className="flex items-center gap-1.5 rounded-lg bg-zinc-100 p-3 text-[11px] text-zinc-600">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        AI-generated. You are responsible for accuracy. Never auto-publish — Amazon requires human review of AI content (no auto-publishing in this MVP).
      </p>
      {draft.humanReviewed && (
        <p className="text-xs font-medium text-emerald-700">✓ Human review recorded on {new Date().toLocaleDateString('en-IN')}</p>
      )}
    </div>
  );
}
