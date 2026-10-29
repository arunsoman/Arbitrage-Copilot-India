// ─── Deterministic Amazon India fee engine ───────────────────────────────────
// All outputs are pure functions of inputs. No LLM ever produces these numbers.
// Fee tables: Amazon India reference (2025), configurable per PRD §15.

import { FeeBreakdown, MarginInput, MarginResult } from './types';

// FBA fulfillment (pick, pack, ship) — national, incl. weight handling.
export const FBA_FULFILLMENT_TABLE: Array<{ maxGrams: number; fee: number }> = [
  { maxGrams: 500, fee: 63 },
  { maxGrams: 1000, fee: 88 },
  { maxGrams: 2000, fee: 127 },
  { maxGrams: 5000, fee: 192 },
  { maxGrams: 10000, fee: 297 },
];

export function fbaFulfillmentFee(weightGrams: number): number {
  const w = Math.max(0, weightGrams);
  for (const band of FBA_FULFILLMENT_TABLE) {
    if (w <= band.maxGrams) return band.fee;
  }
  const base = 297;
  const extraKg = Math.ceil((w - 10000) / 1000);
  return base + extraKg * 14;
}

// Closing fee by price band (₹6–₹21 per PRD).
export function closingFee(amazonPrice: number): number {
  if (amazonPrice < 100) return 6;
  if (amazonPrice < 250) return 10;
  if (amazonPrice < 500) return 15;
  return 21;
}

export function referralFee(amazonPrice: number, referralPct: number): number {
  return roundHalfUp((referralPct / 100) * amazonPrice);
}

export function calculateFees(amazonPrice: number, referralPct: number, weightGrams: number): FeeBreakdown {
  const ref = referralFee(amazonPrice, referralPct);
  const closing = closingFee(amazonPrice);
  const fba = fbaFulfillmentFee(weightGrams);
  return {
    referralFee: ref,
    closingFee: closing,
    fbaFulfillmentFee: fba,
    totalAmazonFees: ref + closing + fba,
  };
}

function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

// ─── Margin calculator ───────────────────────────────────────────────────────

export function calculateMargin(input: MarginInput): MarginResult {
  const gstAmount = round2((input.supplierCost * input.gstRate) / 100);
  const totalCost = round2(input.supplierCost + gstAmount + input.inboundShipping + input.packaging);

  const fees = calculateFees(input.amazonPrice, input.referralPct, input.weightGrams);
  const netPayout = round2(input.amazonPrice - fees.totalAmazonFees);
  const netProfit = round2(netPayout - totalCost);
  const roi = totalCost > 0 ? round2((netProfit / totalCost) * 100) : 0;

  // Max buy price: the supplier cost at which ROI falls to exactly minRoi.
  // netPayout = (1 + minRoi) * (c*(1+g) + ship + pkg)  →  solve for c.
  const minRoi = Math.max(0, input.minRoi) / 100;
  let maxBuyPrice = 0;
  const shipAndPkg = input.inboundShipping + input.packaging;
  if (1 + minRoi > 0) {
    const costExGst = netPayout / (1 + minRoi) - shipAndPkg;
    maxBuyPrice = costExGst / (1 + input.gstRate / 100);
  }
  maxBuyPrice = round2(Math.max(0, maxBuyPrice));

  return {
    supplierCost: input.supplierCost,
    gstAmount,
    totalCost,
    fees,
    netPayout,
    netProfit,
    roi,
    maxBuyPrice,
    headroomVsCost: round2(maxBuyPrice - input.supplierCost),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Category defaults (referral %, typical GST) ─────────────────────────────

export const CATEGORY_DEFAULTS: Record<string, { referralPct: number; gstRate: number }> = {
  'Home & Kitchen': { referralPct: 9, gstRate: 18 },
  Beauty: { referralPct: 11, gstRate: 18 },
  Toys: { referralPct: 10, gstRate: 12 },
  Electronics: { referralPct: 5.5, gstRate: 18 },
  Apparel: { referralPct: 13, gstRate: 5 },
  Sports: { referralPct: 10, gstRate: 12 },
  Grocery: { referralPct: 10.5, gstRate: 12 },
  Furniture: { referralPct: 8.5, gstRate: 18 },
  'Office Products': { referralPct: 8.5, gstRate: 18 },
  Health: { referralPct: 12, gstRate: 12 },
};

export function categoryDefaults(category: string): { referralPct: number; gstRate: number } {
  return CATEGORY_DEFAULTS[category] ?? { referralPct: 10, gstRate: 18 };
}

// Deterministic inbound shipping estimate by weight (seller-paid, regional avg).
export function estimateInboundShipping(weightGrams: number): number {
  const w = Math.max(0, weightGrams);
  if (w <= 500) return 35;
  if (w <= 1000) return 42;
  if (w <= 2000) return 55;
  if (w <= 5000) return 80;
  return 120;
}

export function estimatePackaging(amazonPrice: number): number {
  if (amazonPrice < 300) return 10;
  if (amazonPrice < 800) return 15;
  return 25;
}
