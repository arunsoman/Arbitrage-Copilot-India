// ─── Legal Metrology & Amazon policy compliance gates ────────────────────────
// PRD §3.1: listing generation MUST be gated on mandatory declarations.

export interface LMFields {
  mrp?: number | null;
  manufacturerName?: string | null;
  countryOfOrigin?: string | null;
  netQuantity?: string | null;
  customerCare?: string | null;
  monthYearMfg?: string | null;
}

export interface LMCheckItem {
  field: string;
  label: string;
  present: boolean;
  value?: string;
  mandatory: boolean;
}

export interface ComplianceResult {
  canGenerateListing: boolean;
  missingMandatory: string[];
  checks: LMCheckItem[];
}

const LM_RULES: Array<{ field: keyof LMFields; label: string; mandatory: boolean; format?: (v: unknown) => string }> = [
  { field: 'mrp', label: 'MRP (Max Retail Price)', mandatory: true, format: (v) => `₹${v}` },
  { field: 'manufacturerName', label: 'Manufacturer / Packer name', mandatory: true },
  { field: 'countryOfOrigin', label: 'Country of Origin', mandatory: true },
  { field: 'netQuantity', label: 'Net Quantity', mandatory: true },
  { field: 'customerCare', label: 'Customer Care details', mandatory: false },
  { field: 'monthYearMfg', label: 'Month & Year of manufacture', mandatory: false },
];

export function checkLegalMetrology(fields: LMFields): ComplianceResult {
  const checks: LMCheckItem[] = [];
  const missing: string[] = [];

  for (const rule of LM_RULES) {
    const raw = fields[rule.field];
    const present = raw !== undefined && raw !== null && raw !== '' && raw !== 0;
    if (rule.mandatory && !present) missing.push(rule.label);
    checks.push({
      field: rule.field,
      label: rule.label,
      present,
      value: present && rule.format ? rule.format(raw) : present ? String(raw) : undefined,
      mandatory: rule.mandatory,
    });
  }

  return {
    canGenerateListing: missing.length === 0,
    missingMandatory: missing,
    checks,
  };
}

// ─── Amazon content policy: prohibited claims scanner ────────────────────────

const PROHIBITED_PATTERNS: Array<{ pattern: RegExp; label: string; suggestion: string }> = [
  { pattern: /\b(best|no\.?\s*1|#1|top[- ]rated|world'?s best)\b/i, label: 'Superlative claim ("best / #1 / top-rated")', suggestion: 'Remove superlatives — Amazon prohibits unsubstantiated ranking claims.' },
  { pattern: /\b(guaranteed|guarantee(d)? results|100%\s*(effective|safe|working))\b/i, label: 'Guaranteed-result claim', suggestion: 'Remove guarantee wording — outcomes cannot be promised.' },
  { pattern: /\b(cure|cures|heals|treats|therapeutic|medicinal)\b/i, label: 'Medical claim', suggestion: 'Remove medical/therapeutic claims — restricted category wording.' },
  { pattern: /\b(fda\s*approved|iso\s*certified|ce\s*certified)\b/i, label: 'Unverified certification claim', suggestion: 'Only reference certifications you can document.' },
  { pattern: /\b(cheapest|lowest price|discount|sale|offer|deal of the day)\b/i, label: 'Promotional pricing language', suggestion: 'Remove price/promo language — against listing style rules.' },
  { pattern: /\b(contact us|visit our website|www\.|https?:\/\/|call now|whatsapp)\b/i, label: 'External contact / link', suggestion: 'Remove external contact info — prohibited in listings.' },
  { pattern: /\b(free\s+(gift|shipping|sample))\b/i, label: 'Unauthorised promotion', suggestion: 'Remove gift/shipping promo wording.' },
  { pattern: /\b(5\s*star|five\s*star|review us|leave a review)\b/i, label: 'Review manipulation', suggestion: 'Remove review solicitation — violates Amazon review policy.' },
];

export interface ClaimScanResult {
  clean: boolean;
  findings: Array<{ label: string; suggestion: string; matched: string }>;
}

export function scanProhibitedClaims(text: string): ClaimScanResult {
  const findings: ClaimScanResult['findings'] = [];
  for (const rule of PROHIBITED_PATTERNS) {
    const m = text.match(rule.pattern);
    if (m) {
      findings.push({ label: rule.label, suggestion: rule.suggestion, matched: m[0] });
    }
  }
  return { clean: findings.length === 0, findings };
}

// ─── Amazon character limits ─────────────────────────────────────────────────

export const LIMITS = {
  title: 200,
  bullet: 240,
  bullets: 5,
  description: 2000,
  backendKeywords: 249,
};
