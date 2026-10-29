// ─── Session auth: cookie sessions + scrypt passwords + demo users ───────────
// Demo mode (NEXT_PUBLIC_DEMO_MODE !== 'false'): the login screen shows one
// avatar per user type; clicking one opens a session without a password.
// Conventional mode: only the email/password form is offered.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { cookies, headers } from 'next/headers';
import { db } from '@/lib/db';
import { ensureBootstrap } from './user';

// Header used as a cookieless fallback when the browser blocks cookies
// entirely (e.g. third-party-cookie blocking inside preview iframes).
export const SESSION_HEADER = 'x-session-token';

const COOKIE_NAME = 'ac_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SECRET = process.env.SESSION_SECRET ?? 'arbitrage-copilot-demo-secret-2026';

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
}

// ── Passwords (scrypt, no external dependency) ───────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [, salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ── Signed session cookie ────────────────────────────────────────────────────

interface SessionPayload {
  userId: string;
  role: string;
  exp: number;
}

function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('base64url');
}

export function serializeSession(userId: string, role: string): string {
  const payload: SessionPayload = { userId, role, exp: Date.now() + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function parseSession(raw: string | undefined): SessionPayload | null {
  if (!raw) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (!payload.userId || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string, role: string, proto?: string | null) {
  const jar = await cookies();
  // Over HTTPS the app may be embedded in a cross-site iframe (preview host).
  // SameSite=Lax cookies are dropped in that context, so switch to
  // SameSite=None; Secure. Plain Lax stays for local http dev.
  const isHttps = (proto ?? '').split(',')[0].trim() === 'https';
  jar.set(COOKIE_NAME, serializeSession(userId, role), {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getSessionUser() {
  const jar = await cookies();
  let payload = parseSession(jar.get(COOKIE_NAME)?.value);
  if (!payload) {
    // Cookieless fallback: browsers that block third-party cookies in the
    // preview iframe still authenticate via the signed token header.
    const h = await headers();
    payload = parseSession(h.get(SESSION_HEADER) ?? undefined);
  }
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.userId }, include: { supplierProfile: true } });
  return user;
}

// Server-side gate for admin-only endpoints. The UI hides the admin module
// from other roles; this enforces it on the API surface (401/403).
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { user: null, res: { status: 401, body: { error: 'Authentication required.' } } as const };
  if (user.role !== 'admin') {
    return { user: null, res: { status: 403, body: { error: 'Admin access required.' } } as const };
  }
  return { user, res: null };
}

// ── Demo user seeding (idempotent) ───────────────────────────────────────────

const DEMO_USERS: Array<{
  email: string;
  name: string;
  role: string;
  password: string;
  avatarColor: string;
  businessName?: string;
  onboardingDone: boolean;
  supplier?: {
    companyName: string;
    gstin: string;
    contactPhone: string;
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
    prepCapabilities: string[];
    crmWebhookUrl?: string;
    crmApiToken?: string;
  };
}> = [
  {
    email: 'ramesh@arbitragecopilot.in',
    name: 'Ramesh',
    role: 'seller',
    password: 'demo1234',
    avatarColor: 'amber',
    businessName: 'Ramesh Enterprises',
    onboardingDone: true,
  },
  {
    email: 'jayant@jayantmetal.in',
    name: 'Jayant Metals',
    role: 'supplier',
    password: 'supplier1234',
    avatarColor: 'emerald',
    businessName: 'Jayant Metal Industries',
    onboardingDone: true,
    supplier: {
      companyName: 'Jayant Metal Industries',
      gstin: '24AAACJ1234F1Z5',
      contactPhone: '+91 98240 11223',
      addressLine: 'Plot 42, GIDC Phase II, Vatva',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '382445',
      prepCapabilities: ['fnsku_labelling', 'bubble_wrap', 'boxing'],
      crmWebhookUrl: '/api/mock/crm',
      crmApiToken: 'jayant-crm-demo-secret',
    },
  },
  {
    email: 'admin@arbitragecopilot.in',
    name: 'Ops Admin',
    role: 'admin',
    password: 'admin1234',
    avatarColor: 'violet',
    businessName: 'Arbitrage Copilot',
    onboardingDone: true,
  },
];

export async function ensureDemoUsers() {
  await ensureBootstrap(); // existing seller + catalog + config
  for (const du of DEMO_USERS) {
    let user = await db.user.findUnique({ where: { email: du.email } });
    if (!user) {
      user = await db.user.create({
        data: {
          name: du.name,
          email: du.email,
          role: du.role,
          passwordHash: hashPassword(du.password),
          avatarColor: du.avatarColor,
          businessName: du.businessName,
          gstin: du.supplier?.gstin ?? (du.role === 'seller' ? '27AAXXXXXXXZ1' : null),
          state: du.supplier?.state ?? (du.role === 'seller' ? 'Maharashtra' : null),
          amazonConnected: du.role === 'seller',
          amazonConnectedAt: du.role === 'seller' ? new Date() : null,
          onboardingDone: du.onboardingDone,
        },
      });
    } else if (!user.passwordHash) {
      // Pre-existing account (e.g. seller created by ensureUser) — attach the
      // seeded password so conventional login works for it too.
      user = await db.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(du.password) },
      });
    }
    if (du.supplier) {
      const existing = await db.supplierProfile.findUnique({ where: { userId: user.id } });
      if (!existing) {
        await db.supplierProfile.create({
          data: { userId: user.id, ...du.supplier, prepCapabilities: JSON.stringify(du.supplier.prepCapabilities) },
        });
      } else if (!existing.crmWebhookUrl && du.supplier.crmWebhookUrl) {
        // Backfill the demo CRM webhook on pre-existing profiles so the
        // supplier integration works without re-seeding the database.
        await db.supplierProfile.update({
          where: { userId: user.id },
          data: { crmWebhookUrl: du.supplier.crmWebhookUrl, crmApiToken: du.supplier.crmApiToken },
        });
      }
    }
  }
}

export const DEMO_USER_CARDS = [
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
] as const;
