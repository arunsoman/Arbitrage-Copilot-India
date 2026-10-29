import { NextRequest, NextResponse } from 'next/server';
import { analyzeProduct } from '@/lib/pipeline';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const extractedProductId = String(body.extractedProductId ?? '');
    if (!extractedProductId) return NextResponse.json({ error: 'extractedProductId is required' }, { status: 400 });
    const withExplanation = body.withExplanation !== false;
    const deal = await analyzeProduct(extractedProductId, { withExplanation });
    return NextResponse.json(deal);
  } catch (err) {
    console.error('analyze failed', err);
    return NextResponse.json({ error: 'analyze failed', detail: String(err) }, { status: 500 });
  }
}
