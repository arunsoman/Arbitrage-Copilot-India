import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureDemoUsers, serializeSession, setSessionCookie, verifyPassword } from '@/lib/auth';

// Conventional email + password login (always available, the only path when
// demo mode is off).
export async function POST(req: NextRequest) {
  await ensureDemoUsers();
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }
  await setSessionCookie(user.id, user.role, req.headers.get('x-forwarded-proto'));
  // sessionToken powers the cookieless fallback for browsers that block
  // third-party cookies inside the preview iframe.
  return NextResponse.json({ ok: true, role: user.role, sessionToken: serializeSession(user.id, user.role) });
}
