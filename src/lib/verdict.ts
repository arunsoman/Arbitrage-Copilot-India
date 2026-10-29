// ─── Deterministic verdict engine ────────────────────────────────────────────
// Strong Buy / Watch / Avoid / Needs Review — pure rules over engine outputs.

import { MarginResult, MatchType, ProfitRules, RiskTolerance, Verdict } from './types';

export interface VerdictInput {
  margin: MarginResult;
  hasMatch: boolean;
  matchType: MatchType;
  matchConfidence: number; // 0..1
  gstVerified: boolean;
  trend30dPct: number;
  priceCutters7d: number;
  sellers: number;
  rules: ProfitRules;
}

export interface VerdictReason {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface VerdictOutput {
  verdict: Verdict;
  reasons: VerdictReason[];
  riskSummary: string;
  confidence: number;
}

const TOLERANCE_TUNING: Record<RiskTolerance, { minConf: number; maxCutters: number; roiSlack: number }> = {
  conservative: { minConf: 0.85, maxCutters: 1, roiSlack: 1.0 },
  balanced: { minConf: 0.8, maxCutters: 2, roiSlack: 0.85 },
  aggressive: { minConf: 0.7, maxCutters: 3, roiSlack: 0.7 },
};

export function decideVerdict(input: VerdictInput): VerdictOutput {
  const { margin, rules } = input;
  const tuning = TOLERANCE_TUNING[rules.riskTolerance] ?? TOLERANCE_TUNING.balanced;

  const reasons: VerdictReason[] = [];
  const add = (code: string, label: string, passed: boolean, detail: string) =>
    reasons.push({ code, label, passed, detail });

  const roiPass = margin.roi >= rules.minRoi;
  add(
    'roi',
    `ROI ≥ ${rules.minRoi}%`,
    roiPass,
    `Projected ROI is ${margin.roi.toFixed(1)}% on a total cost of ₹${margin.totalCost.toFixed(0)}.`
  );

  const profitPass = margin.netProfit >= rules.minProfit;
  add(
    'profit',
    `Net profit ≥ ₹${rules.minProfit}`,
    profitPass,
    `Projected net profit is ₹${margin.netProfit.toFixed(0)} per unit after all fees, GST and inbound shipping.`
  );

  const pricePass = margin.supplierCost <= margin.maxBuyPrice && margin.headroomVsCost >= 0;
  add(
    'price',
    'Supplier cost within max buy price',
    pricePass,
    `Max buy price is ₹${margin.maxBuyPrice.toFixed(0)}; supplier asks ₹${margin.supplierCost.toFixed(0)} (headroom ₹${margin.headroomVsCost.toFixed(0)}).`
  );

  const matchPass = input.hasMatch && input.matchConfidence >= tuning.minConf;
  add(
    'match',
    `ASIN match confidence ≥ ${Math.round(tuning.minConf * 100)}%`,
    matchPass,
    input.hasMatch
      ? `${input.matchType} match with ${Math.round(input.matchConfidence * 100)}% confidence.`
      : 'No Amazon ASIN match found — cannot evaluate sellability.'
  );

  const competitionPass = input.priceCutters7d <= tuning.maxCutters;
  add(
    'competition',
    `Price stability (${input.priceCutters7d} seller${input.priceCutters7d === 1 ? '' : 's'} cut prices in 7d)`,
    competitionPass,
    `${input.sellers} active sellers; trend over 30 days is ${input.trend30dPct > 0 ? '+' : ''}${input.trend30dPct}%.`
  );

  const gstPass = input.gstVerified;
  add(
    'gst',
    'Supplier GST verified',
    gstPass,
    gstPass ? 'Supplier has a verified GSTIN on IndiaMART.' : 'Supplier is not GST-verified — input tax credit risk.'
  );

  // ── Decision cascade ──
  const hardFailNoMatch = !input.hasMatch || input.matchType === 'no_match';
  const ambiguous = input.hasMatch && input.matchConfidence < 0.5;
  const criticalFail = !roiPass || !profitPass || !pricePass || hardFailNoMatch;

  let verdict: Verdict;
  if (hardFailNoMatch) {
    verdict = 'avoid';
  } else if (ambiguous) {
    verdict = 'needs_review';
  } else if (criticalFail) {
    // Some economics fail — but an ambiguous match still routes to review.
    verdict = input.matchConfidence < tuning.minConf && input.matchConfidence >= 0.5 ? 'needs_review' : 'avoid';
  } else if (
    roiPass &&
    profitPass &&
    pricePass &&
    matchPass &&
    competitionPass &&
    gstPass
  ) {
    verdict = 'strong_buy';
  } else {
    verdict = 'watch';
  }

  // Confidence in the verdict itself (deterministic blend).
  let confidence = 0.5 + 0.4 * input.matchConfidence;
  if (!gstPass) confidence -= 0.05;
  if (Math.abs(input.trend30dPct) > 8) confidence -= 0.03;
  if (verdict === 'avoid' && (hardFailNoMatch || (!roiPass && !profitPass))) confidence = Math.min(0.9, confidence + 0.08);
  confidence = Math.max(0.3, Math.min(0.97, Math.round(confidence * 100) / 100));

  // Risk summary text (deterministic).
  const riskParts: string[] = [];
  if (input.priceCutters7d > 0)
    riskParts.push(`${input.priceCutters7d} seller${input.priceCutters7d === 1 ? '' : 's'} cut prices in the last 7 days`);
  if (input.trend30dPct <= -5) riskParts.push(`Amazon price trending down ${Math.abs(input.trend30dPct)}% over 30 days`);
  if (input.trend30dPct >= 5) riskParts.push(`Amazon price up ${input.trend30dPct}% over 30 days (may invite new sellers)`);
  if (!input.gstVerified) riskParts.push('supplier is not GST-verified (no input tax credit)');
  if (input.sellers > 25) riskParts.push(`high competition with ${input.sellers} active sellers`);
  if (riskParts.length === 0) riskParts.push('no significant risk flags detected');

  return {
    verdict,
    reasons,
    riskSummary: riskParts.join('; '),
    confidence,
  };
}

export const VERDICT_META: Record<Verdict, { label: string; emoji: string; color: string; bg: string; border: string; dot: string }> = {
  strong_buy: {
    label: 'STRONG BUY',
    emoji: '🟢',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  watch: {
    label: 'WATCH',
    emoji: '🟡',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  avoid: {
    label: 'AVOID',
    emoji: '🔴',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  needs_review: {
    label: 'NEEDS REVIEW',
    emoji: '🔵',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
};
