# Arbitrage Copilot — Setup Guide

IndiaMART → Amazon FBA arbitrage platform with Shiprocket Cargo freight,
supplier CRM webhooks, and role-based portals (arbitrager / supplier / admin).

## Quick Start

```bash
# 1. Install dependencies (bun or npm)
bun install        # or: npm install

# 2. Set up the SQLite database
npx prisma db push
npx prisma generate

# 3. Start the dev server
npm run dev        # http://localhost:3000
```

Demo users are seeded automatically on first login attempt:

| Role      | Email                       | Password       | Lands on |
|-----------|-----------------------------|----------------|----------|
| Arbitrager| ramesh@arbitragecopilot.in  | demo1234       | Deal discovery dashboard |
| Supplier  | jayant@jayantmetal.in       | demo1234       | Supplier portal (consignments + CRM) |
| Admin     | admin@arbitragecopilot.in   | demo1234       | Admin dashboard (Apify config + reports) |

> In demo mode (`NEXT_PUBLIC_DEMO_MODE` unset/true) the login page also shows
> one-click avatar login. Set `NEXT_PUBLIC_DEMO_MODE=false` for production —
> avatars disappear and demo API logins return 403.

## Environment Variables (all optional — demo fallbacks work without them)

| Variable | Purpose | Fallback when unset |
|----------|---------|---------------------|
| `APIFY_TOKEN` | Real IndiaMART scraping via Apify actor | Curated demo dataset |
| `APIFY_ACTOR_ID` | Actor to run (default configurable in Admin UI) | Built-in default |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | Live Shiprocket Cargo API (quote/AWB/label/pickup/track) | Deterministic demo freight engine |
| `NEXT_PUBLIC_DEMO_MODE` | `false` hides demo avatars & blocks demo login | Demo mode on |

Admins can also set the Apify token/actor from the dashboard
(**Admin → IndiaMART data source**) — DB config overrides env; token is
write-only and masked on read.

## Feature Map

### Arbitrager (seller)
- Search IndiaMART catalog (LLM-extracted products), analyze deals
- ASIN matching with price-ratio guard, deterministic fee/profit engine
- Verdicts: strong_buy / watch / avoid / needs_review with grounded AI explanation
- Listing drafts with Legal Metrology compliance gate (server-enforced 422)
- Buy list → Shiprocket Cargo booking wizard (quote → AWB → label → pickup → track)

### Supplier
- Sees consignments destined for their factory, marks "Packed & Ready"
- Schedules carrier pickup, receives pickup token
- **CRM integration (no platform login required)**: signed webhooks
  (`X-AC-Signature` HMAC) pushed on booked / pickup / cancel / transit / delivered
  - Configure in Supplier Portal → CRM card (webhook URL + shared secret + test ping)
  - Every push audited (`CrmNotificationLog`); demo receiver at `POST /api/mock/crm`

### Admin (hidden from arbitragers — UI and API both enforced)
- System health, LLM audit log with CSV export, tool permissions, compliance gates
- **Apify config**: actor ID + token, connection test (no billed run)
- **Search Insights**: total/unique queries, 7-day activity, most-queried
  products bar chart, recent searches

## Tech Stack

- Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- Prisma + SQLite (`db/custom.db`)
- z-ai-web-dev-sdk (LLM extraction/explanations, audited)
- Session: HMAC-signed cookie (`SameSite=None; Secure` on HTTPS for iframe
  previews) + `x-session-token` header fallback for cookie-blocked browsers

## Project Layout

```
prisma/schema.prisma        # data model (users, deals, shipments, CRM logs, search logs)
src/lib/                    # auth, fees, verdict, asin-matcher, shiprocket, crm,
                            # indiamart, apify-config, llm, pipeline, compliance
src/app/api/                # REST API (auth, search, analyze, deals, listing,
                            # buy-list, shipments, supplier, admin, mock/crm)
src/components/arbitrage/   # role UIs (Dashboard, DealDetail, SupplierPortal,
                            # AdminDashboard, ShipmentsView, Login, ...)
```
