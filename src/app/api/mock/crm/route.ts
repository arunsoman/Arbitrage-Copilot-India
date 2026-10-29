import { NextRequest, NextResponse } from 'next/server';

// Demo receiver that stands in for a supplier's CRM webhook endpoint. It
// accepts any signed push so the CRM-integration flow is fully exercisable in
// demo deployments (Jayant Metals' profile points here). A real supplier would
// register their own https://their-crm.example.com/hooks/... URL instead.
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const signature = req.headers.get('x-ac-signature');
  return NextResponse.json({
    ok: true,
    demo: true,
    receivedEvent: (payload as { event?: string }).event ?? 'unknown',
    consignmentId: (payload as { consignment?: { id?: string } }).consignment?.id ?? null,
    signaturePresent: Boolean(signature),
    receivedAt: new Date().toISOString(),
    note: 'Recorded in supplier CRM inbox (demo receiver).',
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST signed Arbitrage Copilot webhook payloads here. This demo receiver always answers 200.',
  });
}
