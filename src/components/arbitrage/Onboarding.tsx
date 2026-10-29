'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/lib/client-types';
import { Link2, Target, FileText, Check, Loader2, ShieldCheck, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = ['Home & Kitchen', 'Beauty', 'Toys', 'Electronics', 'Apparel', 'Sports'];
const STATES = ['Maharashtra', 'Delhi', 'Gujarat', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'Rajasthan', 'Telangana', 'West Bengal', 'Other'];

export function Onboarding({ user, onDone }: { user: UserProfile; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [amazonConnected, setAmazonConnected] = useState(user.amazonConnected);
  const [minRoi, setMinRoi] = useState(String(user.minRoi));
  const [maxBuyPrice, setMaxBuyPrice] = useState(String(user.maxBuyPrice));
  const [minProfit, setMinProfit] = useState(String(user.minProfit));
  const [gstRate, setGstRate] = useState(String(user.gstRateDefault));
  const [categories, setCategories] = useState<string[]>(user.preferredCategories ?? []);
  const [riskTolerance, setRiskTolerance] = useState(user.riskTolerance);
  const [gstin, setGstin] = useState(user.gstin ?? '');
  const [businessName, setBusinessName] = useState(user.businessName ?? '');
  const [state, setState] = useState(user.state ?? 'Maharashtra');
  const [gstConfirmed, setGstConfirmed] = useState(false);

  async function save(payload: Record<string, unknown>, nextStep?: number) {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      if (nextStep) setStep(nextStep);
      else onDone();
    } catch {
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Welcome to Arbitrage Copilot</h1>
        <p className="mt-1 text-sm text-zinc-500">Three quick steps to start finding profitable IndiaMART deals.</p>
      </div>

      <div className="mb-6 flex items-center justify-center gap-2" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                s < step ? 'bg-emerald-600 text-white' : s === step ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'
              )}
            >
              {s < step ? <Check className="h-3.5 w-3.5" /> : s}
            </div>
            {s < 3 && <div className={cn('h-0.5 w-10 rounded', s < step ? 'bg-emerald-500' : 'bg-zinc-200')} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <Link2 className="h-5 w-5 text-emerald-600" /> Connect Your Amazon Seller Account
          </div>
          <p className="text-sm leading-relaxed text-zinc-600">
            To show you real profit and fee estimates, we need to read your Amazon seller data. We only request:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" /> Product Listing role — to check listing eligibility
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" /> Pricing role — to read current Amazon prices
            </li>
          </ul>
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            We do NOT access your customer data, orders, or payments. In this demo the OAuth handshake is simulated;
            production uses Amazon SP-API Login with Seller Central.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Skip for now
            </Button>
            <div className="flex gap-2">
              {amazonConnected ? (
                <Button variant="outline" onClick={() => setStep(2)}>
                  <Check className="mr-1 h-4 w-4 text-emerald-600" /> Connected — Continue
                </Button>
              ) : (
                <Button
                  className="bg-zinc-900 hover:bg-zinc-800"
                  disabled={saving}
                  onClick={() => {
                    setAmazonConnected(true);
                    save({ amazonConnected: true }, 2);
                  }}
                >
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
                  Connect with Amazon SP-API
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <Target className="h-5 w-5 text-emerald-600" /> Set Your Profit Rules
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="minRoi">Minimum ROI (%)</Label>
              <Input id="minRoi" type="number" value={minRoi} onChange={(e) => setMinRoi(e.target.value)} />
              <p className="text-[11px] text-zinc-500">25% means ₹25 profit on ₹100.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxBuy">Maximum Buy Price (₹ per unit)</Label>
              <Input id="maxBuy" type="number" value={maxBuyPrice} onChange={(e) => setMaxBuyPrice(e.target.value)} />
              <p className="text-[11px] text-zinc-500">Inclusive of GST.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minProfit">Minimum Net Profit (₹ per unit)</Label>
              <Input id="minProfit" type="number" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} />
              <p className="text-[11px] text-zinc-500">After all Amazon fees, GST and shipping.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gstRate">Default GST Rate (%)</Label>
              <Input id="gstRate" type="number" value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
              <p className="text-[11px] text-zinc-500">Change if your products differ.</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label>Preferred Categories</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <label
                  key={c}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    categories.includes(c) ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  )}
                >
                  <Checkbox
                    checked={categories.includes(c)}
                    onCheckedChange={(v) => setCategories((prev) => (v ? [...prev, c] : prev.filter((x) => x !== c)))}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label>Risk Tolerance</Label>
            <RadioGroup value={riskTolerance} onValueChange={(v) => setRiskTolerance(v as UserProfile['riskTolerance'])} className="flex flex-wrap gap-2">
              {(['conservative', 'balanced', 'aggressive'] as const).map((r) => (
                <div key={r} className="flex items-center">
                  <RadioGroupItem value={r} id={`risk-${r}`} className="peer sr-only" />
                  <Label
                    htmlFor={`risk-${r}`}
                    className={cn(
                      'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium capitalize peer-[:checked]:border-zinc-900 peer-[:checked]:bg-zinc-900 peer-[:checked]:text-white',
                      'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    )}
                  >
                    {r}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              className="bg-zinc-900 hover:bg-zinc-800"
              disabled={saving}
              onClick={() =>
                save(
                  {
                    minRoi: Number(minRoi) || 25,
                    maxBuyPrice: Number(maxBuyPrice) || 500,
                    minProfit: Number(minProfit) || 150,
                    gstRateDefault: Number(gstRate) || 18,
                    preferredCategories: categories,
                    riskTolerance,
                  },
                  3
                )
              }
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Next
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <FileText className="h-5 w-5 text-emerald-600" /> Business Details (for GST compliance)
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input id="gstin" placeholder="27AAXXXXXXXZ1" value={gstin} onChange={(e) => setGstin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bizName">Business Name</Label>
              <Input id="bizName" placeholder="Ramesh Enterprises" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
              <Checkbox checked={gstConfirmed} onCheckedChange={(v) => setGstConfirmed(Boolean(v))} className="mt-0.5" />
              I confirm I have a valid GST registration for selling on Amazon India.
            </label>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={saving || !gstConfirmed || !gstin}
              onClick={() =>
                save({
                  gstin,
                  businessName,
                  state,
                  onboardingDone: true,
                })
              }
            >
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Complete Setup
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-zinc-500">You&apos;re ready to start finding profitable deals.</p>
        </div>
      )}
    </div>
  );
}
