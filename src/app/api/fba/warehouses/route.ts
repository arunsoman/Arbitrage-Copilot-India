import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBootstrap } from '@/lib/user';

export async function GET() {
  await ensureBootstrap();
  const warehouses = await db.fbaWarehouse.findMany({ orderBy: { code: 'asc' } });
  return NextResponse.json({ warehouses });
}
