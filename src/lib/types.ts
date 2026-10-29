// ─── Shared domain types for Arbitrage Copilot ───────────────────────────────

export type Verdict = 'strong_buy' | 'watch' | 'avoid' | 'needs_review';
export type MatchType = 'exact' | 'variant' | 'similar' | 'no_match';
export type RiskTolerance = 'conservative' | 'balanced' | 'aggressive';

export interface FeeBreakdown {
  referralFee: number;
  closingFee: number;
  fbaFulfillmentFee: number;
  totalAmazonFees: number;
}

export interface MarginInput {
  supplierCost: number;      // buy price ex-GST from supplier
  gstRate: number;           // percent, e.g. 18
  inboundShipping: number;   // seller-paid, per unit
  packaging: number;         // per unit
  amazonPrice: number;       // current competitive listing price on Amazon.in
  referralPct: number;       // category referral fee percent
  weightGrams: number;       // shipped weight
  minRoi: number;            // percent
  minProfit: number;         // INR
}

export interface MarginResult {
  supplierCost: number;      // echo of input for downstream consumers
  gstAmount: number;
  totalCost: number;
  fees: FeeBreakdown;
  netPayout: number;
  netProfit: number;
  roi: number;               // percent
  maxBuyPrice: number;       // buy price at which ROI == minRoi
  headroomVsCost: number;    // maxBuyPrice - supplierCost
}

export interface PriceHistoryPoint {
  day: number; // days ago
  price: number;
}

export interface MarketSignals {
  history: PriceHistoryPoint[];
  trend30dPct: number;
  sellers: number;
  priceCutters7d: number;
}

export interface MatchReason {
  signal: string;
  detail: string;
  weight: number;
}

export interface CascadeTraceStep {
  stage: string;
  description: string;
  candidates: number;
  topScore?: number;
}

export interface ProfitRules {
  minRoi: number;
  maxBuyPrice: number;
  minProfit: number;
  gstRateDefault: number;
  riskTolerance: RiskTolerance;
}
