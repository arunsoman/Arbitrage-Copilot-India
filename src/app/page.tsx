'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell, ViewName } from '@/components/arbitrage/AppShell';
import { Onboarding } from '@/components/arbitrage/Onboarding';
import { Dashboard } from '@/components/arbitrage/Dashboard';
import { DealDetail } from '@/components/arbitrage/DealDetail';
import { ListingDraftView } from '@/components/arbitrage/ListingDraftView';
import { BuyList } from '@/components/arbitrage/BuyList';
import { AdminDashboard } from '@/components/arbitrage/AdminDashboard';
import { Login } from '@/components/arbitrage/Login';
import { SupplierPortal } from '@/components/arbitrage/SupplierPortal';
import { ShipmentsView } from '@/components/arbitrage/ShipmentsView';
import { SessionData, UserProfile } from '@/lib/client-types';
import { clearSessionToken, installSessionTokenHeader } from '@/lib/client-session';

// Attach the signed session token to every same-origin /api/ request so auth
// keeps working even when the browser blocks cookies in the preview iframe.
installSessionTokenHeader();

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewName>('dashboard');
  const [dealId, setDealId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const json: SessionData = await res.json();
      setSession(json);
      return json;
    } catch {
      setSession({ demoMode: false, user: null });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Full seller profile (profit rules etc.) for the arbitrager home page.
  useEffect(() => {
    if (session?.user?.role === 'seller') {
      fetch('/api/settings', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => setProfile(j.user))
        .catch(() => setProfile(null));
    } else {
      setProfile(null);
    }
  }, [session?.user?.id, session?.user?.onboardingDone]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  function refresh() {
    setRefreshKey((k) => k + 1);
    loadSession();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    clearSessionToken();
    setView('dashboard');
    setDealId(null);
    loadSession();
  }

  function openDeal(id: string) {
    setDealId(id);
    setView('deal');
  }

  function openDraft(id: string) {
    setDealId(id);
    setView('listing');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          <p className="mt-3 text-sm font-medium text-zinc-500">Loading Arbitrage Copilot…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-red-600">
        Could not load your session. Please refresh the page.
      </div>
    );
  }

  // ── Login gate: demo avatar personas (demo mode only) + conventional login ──
  if (!session.user) {
    return <Login session={session} onLogin={refresh} />;
  }

  const user = session.user;

  // ── Role-based home pages ──
  if (user.role === 'supplier') {
    return <SupplierPortal key={`supplier-${refreshKey}`} user={user} onLogout={logout} />;
  }

  const isAdmin = user.role === 'admin';

  if (isAdmin) {
    return (
      <AppShell user={user} view={view} onNav={setView} onRefresh={refresh} onLogout={logout} demoMode={session.demoMode}>
        {view === 'shipments' && <ShipmentsView key={`admin-ship-${refreshKey}`} canBook={false} />}
        {view !== 'shipments' && <AdminDashboard key={`admin-${refreshKey}`} />}
      </AppShell>
    );
  }

  // seller / arbitrager — admin module is exclusive to the admin role
  if (!user.onboardingDone) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-10">
        {profile ? <Onboarding user={profile} onDone={refresh} /> : <LoadingScreen />}
      </div>
    );
  }

  if (!profile) return <LoadingScreen />;

  const sellerView: ViewName = view === 'admin' ? 'dashboard' : view; // guard stale admin state

  return (
    <AppShell user={profile} view={sellerView} onNav={setView} onRefresh={refresh} onLogout={logout} demoMode={session.demoMode}>
      {sellerView === 'dashboard' && <Dashboard key={`dash-${refreshKey}`} user={profile} onOpenDeal={openDeal} onDraftListing={openDraft} />}
      {sellerView === 'deal' && dealId && <DealDetail key={`deal-${dealId}-${refreshKey}`} dealId={dealId} onBack={() => setView('dashboard')} onDraft={openDraft} />}
      {sellerView === 'listing' && dealId && <ListingDraftView key={`listing-${dealId}-${refreshKey}`} dealId={dealId} onBack={() => setView('deal')} />}
      {sellerView === 'buylist' && <BuyList key={`buylist-${refreshKey}`} onOpenDeal={openDeal} />}
      {sellerView === 'shipments' && <ShipmentsView key={`ship-${refreshKey}`} />}
    </AppShell>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
    </div>
  );
}
