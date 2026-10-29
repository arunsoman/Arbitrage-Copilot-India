import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_USER_CARDS, ensureDemoUsers, isDemoMode, serializeSession, setSessionCookie } from '@/lib/auth';

// One-click demo login: only permitted when the product is hosted in demo
// mode. The login screen renders one avatar per user type; clicking an avatar
// lands the visitor straight on that user's home page.
export async function POST(req: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: 'Demo mode is disabled on this deployment.' }, { status: 403 });
  }
  await ensureDemoUsers();
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const card = DEMO_USER_CARDS.find((c) => c.email === email);
  if (!card) {
    return NextResponse.json({ error: 'Unknown demo persona.' }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { email: card.email } });
  if (!user) return NextResponse.json({ error: 'Demo user missing.' }, { status: 500 });
  await setSessionCookie(user.id, user.role, req.headers.get('x-forwarded-proto'));
  // sessionToken powers the cookieless fallback for browsers that block
  // third-party cookies inside the preview iframe.
  return NextResponse.json({ ok: true, role: user.role, sessionToken: serializeSession(user.id, user.role) });
}
