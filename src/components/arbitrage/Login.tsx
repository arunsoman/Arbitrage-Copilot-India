'use client';

import { useState } from 'react';
import { Zap, Factory, ShieldCheck, Truck, Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { saveSessionToken } from '@/lib/client-session';
import { DemoCard, SessionData } from '@/lib/client-types';

const DEMO_CARDS: DemoCard[] = [
  {
    role: 'seller',
    label: 'Arbitrager',
    tagline: 'Source on IndiaMART → sell on Amazon FBA',
    email: 'ramesh@arbitragecopilot.in',
    icon: 'zap',
    color: 'amber',
    password: 'demo1234',
  },
  {
    role: 'supplier',
    label: 'Supplier',
    tagline: 'Prep, label & hand over cargo pickups',
    email: 'jayant@jayantmetal.in',
    icon: 'factory',
    color: 'emerald',
    password: 'supplier1234',
  },
  {
    role: 'admin',
    label: 'Admin',
    tagline: 'Platform ops, audit & compliance',
    email: 'admin@arbitragecopilot.in',
    icon: 'shield',
    color: 'violet',
    password: 'admin1234',
  },
];

function PersonaIcon({ icon, className }: { icon: string; className?: string }) {
  if (icon === 'factory') return <Factory className={className} />;
  if (icon === 'shield') return <ShieldCheck className={className} />;
  if (icon === 'truck') return <Truck className={className} />;
  return <Zap className={className} />;
}

const COLOR_STYLES: Record<string, { avatar: string; ring: string; hover: string; chip: string }> = {
  amber: {
    avatar: 'bg-amber-100 text-amber-800',
    ring: 'hover:border-amber-400 hover:shadow-amber-100',
    hover: 'group-hover:bg-amber-200',
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  emerald: {
    avatar: 'bg-emerald-100 text-emerald-800',
    ring: 'hover:border-emerald-400 hover:shadow-emerald-100',
    hover: 'group-hover:bg-emerald-200',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  violet: {
    avatar: 'bg-violet-100 text-violet-800',
    ring: 'hover:border-violet-400 hover:shadow-violet-100',
    hover: 'group-hover:bg-violet-200',
    chip: 'bg-violet-50 text-violet-800 border-violet-200',
  },
};

export function Login({ session, onLogin }: { session: SessionData; onLogin: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!session.demoMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  async function demoLogin(card: DemoCard) {
    setBusy(card.email);
    setError(null);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: card.email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Demo login failed');
      if (typeof json.sessionToken === 'string') saveSessionToken(json.sessionToken);
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Demo login failed');
    } finally {
      setBusy(null);
    }
  }

  async function conventionalLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy('form');
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Login failed');
      if (typeof json.sessionToken === 'string') saveSessionToken(json.sessionToken);
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8 sm:max-w-2xl md:justify-center">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 shadow-sm">
            <Zap className="h-7 w-7 text-amber-400" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">Arbitrage Copilot</h1>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-zinc-500">
            Sourcing intelligence for Amazon India sellers — IndiaMART discovery, FBA profit engine &amp; Shiprocket Cargo inbound.
          </p>
        </div>

        {/* Demo-mode avatar personas (hidden entirely in production mode) */}
        {session.demoMode && (
          <section className="mt-8" aria-label="Demo user personas">
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <Sparkles className="h-3.5 w-3.5" />
                DEMO MODE
              </span>
              <span className="text-xs text-zinc-500">pick a role to jump straight in</span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {DEMO_CARDS.map((card) => {
                const style = COLOR_STYLES[card.color] ?? COLOR_STYLES.amber;
                return (
                  <button
                    key={card.email}
                    onClick={() => demoLogin(card)}
                    disabled={busy !== null}
                    aria-label={`Continue as ${card.label}`}
                    className={cn(
                      'group flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm transition-all hover:shadow-md disabled:opacity-60',
                      style.ring
                    )}
                  >
                    <span className={cn('flex h-14 w-14 items-center justify-center rounded-full transition-colors', style.avatar, style.hover)}>
                      {busy === card.email ? <Loader2 className="h-6 w-6 animate-spin" /> : <PersonaIcon icon={card.icon} className="h-7 w-7" />}
                    </span>
                    <span className="text-sm font-bold text-zinc-900">{card.label}</span>
                    <span className="text-[11px] leading-snug text-zinc-500">{card.tagline}</span>
                    <span className={cn('mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', style.chip)}>
                      Enter home page <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Divider — only meaningful when both paths exist (demo mode) */}
        {session.demoMode && (
          <div className="my-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200" />
            <button
              onClick={() => setShowForm((v) => !v)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
              aria-expanded={showForm}
            >
              {showForm ? 'or use a demo persona above' : 'or sign in with email'}
            </button>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
        )}

        {/* Conventional login */}
        {showForm && (
          <form onSubmit={conventionalLogin} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm" aria-label="Conventional login">
            <h2 className="text-sm font-bold text-zinc-900">Sign in</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Use your platform credentials. Roles: arbitrager, supplier, admin.</p>
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@company.in"
                    className="h-11 pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="h-11 pl-9 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy !== null} className="h-11 w-full text-sm font-semibold">
                {busy === 'form' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
              </Button>
              {session.demoMode && (
                <p className="text-center text-[11px] text-zinc-400">
                  Demo credentials: ramesh@arbitragecopilot.in / demo1234 · jayant@jayantmetal.in / supplier1234 · admin@arbitragecopilot.in / admin1234
                </p>
              )}
            </div>
          </form>
        )}
        {error && !showForm && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700">
            {error}
          </p>
        )}
      </main>

      <footer className="mt-auto border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-md px-4 py-3 text-center text-[11px] leading-relaxed text-zinc-500 sm:max-w-2xl">
          Demo dataset: IndiaMART via Apify-compatible provider · Logistics via Shiprocket Cargo (B2B / FBA inbound) ·
          <span className="font-medium text-zinc-600"> No auto-publish · No auto-purchase · Human review required</span>
        </div>
      </footer>
    </div>
  );
}
