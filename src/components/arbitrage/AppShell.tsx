'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Home, ClipboardList, ShieldCheck, Bell, Zap, ShoppingCart, RefreshCw, Truck, LogOut, Sparkles } from 'lucide-react';

// Minimal structural type so both the full seller profile and the session user fit.
export interface ShellUser {
  name: string;
  email: string;
  role: string;
  gstin?: string | null;
  businessName?: string | null;
}

export type ViewName = 'dashboard' | 'deal' | 'listing' | 'buylist' | 'shipments' | 'admin';

export function AppShell({
  user,
  view,
  onNav,
  onRefresh,
  onLogout,
  demoMode,
  children,
}: {
  user: ShellUser | null;
  view: ViewName;
  onNav: (v: ViewName) => void;
  onRefresh: () => void;
  onLogout?: () => void;
  demoMode?: boolean;
  children: React.ReactNode;
}) {
  const isAdmin = user?.role === 'admin';
  // Admin module is exclusive to the admin role — never shown to arbitragers.
  const navItems: Array<{ id: ViewName; label: string; icon: React.ReactNode }> = isAdmin
    ? [
        { id: 'admin', label: 'Admin', icon: <ShieldCheck className="h-4 w-4" /> },
        { id: 'shipments', label: 'Shipments', icon: <Truck className="h-4 w-4" /> },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: <Home className="h-4 w-4" /> },
        { id: 'buylist', label: 'Buy List', icon: <ShoppingCart className="h-4 w-4" /> },
        { id: 'shipments', label: 'Shipments', icon: <Truck className="h-4 w-4" /> },
      ];

  const active = (id: ViewName) =>
    view === id || ((view === 'deal' || view === 'listing') && id === 'dashboard');

  const initials = (user?.name ?? 'A')[0]?.toUpperCase();
  const avatarCls =
    user?.role === 'admin'
      ? 'bg-violet-100 text-violet-800'
      : user?.role === 'supplier'
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-amber-100 text-amber-800';

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <button className="flex items-center gap-2" onClick={() => onNav(isAdmin ? 'admin' : 'dashboard')} aria-label="Arbitrage Copilot home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900">
              <Zap className="h-4.5 w-4.5 text-amber-400" />
            </span>
            <span className="hidden text-sm font-bold tracking-tight text-zinc-900 sm:block">
              ARBITRAGE COPILOT
              <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-800">INDIA MVP</span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active(item.id) ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            {demoMode && (
              <span className="hidden items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 sm:inline-flex">
                <Sparkles className="h-3 w-3" /> DEMO
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onRefresh} aria-label="Refresh data">
              <RefreshCw className="h-4 w-4 text-zinc-500" />
            </Button>
            <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
              <Bell className="h-4 w-4 text-zinc-500" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold', avatarCls)}>
                    {initials}
                  </span>
                  <span className="hidden sm:block">{user?.name ?? 'Account'}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{user?.businessName ?? '—'}</div>
                  <div className="text-xs font-normal text-zinc-500">{user?.email}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Role: {user?.role ?? '—'} · GSTIN: {user?.gstin ?? '—'}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isAdmin && <DropdownMenuItem onClick={() => onNav('buylist')}>Buy List</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => onNav('shipments')}>FBA Shipments</DropdownMenuItem>
                {onLogout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:text-red-700">
                      <LogOut className="h-4 w-4" /> Sign out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-10">{children}</main>

      {/* Mobile bottom navigation (PRD Screen 8) — 3 items for sellers, 2 for admin */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Mobile">
        <div className={cn('grid', navItems.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className={cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium',
                active(item.id) ? 'text-zinc-900' : 'text-zinc-400'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <footer className="mt-auto border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1 px-4 py-3 text-[11px] text-zinc-500 sm:flex-row">
          <span>Arbitrage Copilot — sourcing intelligence for Amazon India sellers. Data: IndiaMART (Apify) · Logistics: Shiprocket Cargo.</span>
          <span>No auto-publish · No auto-purchase · Human review required</span>
        </div>
      </footer>
    </div>
  );
}
