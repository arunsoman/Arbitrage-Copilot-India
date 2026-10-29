// ─── LLM layer (backend only) ────────────────────────────────────────────────
// z-ai-web-dev-sdk. The LLM EXPLAINS and DRAFTS; it never produces numbers.
// Every call is audited (model, prompt version, input snapshot, output,
// confidence, latency). Every call has a deterministic fallback so the
// pipeline degrades gracefully.

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { LIMITS, scanProhibitedClaims } from './compliance';
import { inr, pct } from './format';

const MODEL = 'glm-4.6';
const PROMPT_VERSION = 'v1.0.0';
const LLM_TIMEOUT_MS = 45000;

async function withTimeout<T>(p: Promise<T>, ms = LLM_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), ms)),
  ]);
}

export interface LLMCallMeta {
  userId?: string;
  action: 'deal_explanation' | 'listing_draft' | 'catalog_extraction';
  inputSnapshot: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence?: number;
  latencyMs?: number;
  fallbackUsed: boolean;
}

export async function auditLLM(meta: LLMCallMeta): Promise<void> {
  try {
    await db.lLMAuditLog.create({
      data: {
        userId: meta.userId,
        action: meta.action,
        modelVersion: meta.fallbackUsed ? 'template-fallback' : MODEL,
        promptVersion: PROMPT_VERSION,
        inputSnapshot: JSON.stringify(meta.inputSnapshot).slice(0, 8000),
        outputJson: JSON.stringify(meta.output).slice(0, 8000),
        confidenceScore: meta.confidence,
        latencyMs: meta.latencyMs,
        fallbackUsed: meta.fallbackUsed,
      },
    });
  } catch {
    // audit failures must never break the pipeline
  }
}

async function chatJSON(system: string, user: string): Promise<string | null> {
  try {
    const zai = await ZAI.create();
    const completion = await withTimeout(
      zai.chat.completions.create({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        thinking: { type: 'disabled' },
        temperature: 0.4,
      })
    );
    return completion.choices[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

function extractJSONBlock(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ─── Deal explanation (tool-grounded, plain language) ───────────────────────

export interface ExplanationContext {
  productTitle: string;
  supplierName: string;
  supplierCost: number;
  maxBuyPrice: number;
  verdict: string;
  roi: number;
  netProfit: number;
  minRoi: number;
  minProfit: number;
  amazonPrice: number;
  sellers: number;
  priceCutters7d: number;
  trend30dPct: number;
  matchType: string;
  matchConfidence: number;
  gstVerified: boolean;
  moq?: number;
  riskSummary: string;
}

export async function explainDeal(ctx: ExplanationContext, userId?: string): Promise<{ text: string; source: 'llm' | 'template' }> {
  const started = Date.now();
  const system =
    'You are the deal-explanation agent for an Amazon India arbitrage platform. ' +
    'You receive ALL numbers from deterministic fee calculators. You MUST NOT invent, ' +
    'round, or recompute any number — only use the figures provided. Write 2-4 sentences ' +
    'of plain, practical advice for the seller: state the verdict reason, the headroom ' +
    'between supplier price and max buy price, the main risk, and one concrete next step ' +
    '(e.g., suggested test order size referencing MOQ). Do not use headings or bullet points. ' +
    'Do not mention that you are an AI.';
  const user = `Deal data (all from deterministic tools):
- Product: ${ctx.productTitle}
- Supplier: ${ctx.supplierName} (GST verified: ${ctx.gstVerified ? 'yes' : 'no'}, MOQ: ${ctx.moq ?? 'n/a'})
- Supplier cost: ₹${ctx.supplierCost}
- Max buy price (ROI ${ctx.minRoi}% floor): ₹${ctx.maxBuyPrice}
- Net profit per unit: ₹${ctx.netProfit}; ROI: ${ctx.roi}%
- Amazon price: ₹${ctx.amazonPrice}; ${ctx.sellers} active sellers; ${ctx.priceCutters7d} sellers cut price in last 7 days; 30d price trend: ${ctx.trend30dPct}%
- ASIN match: ${ctx.matchType} (${Math.round(ctx.matchConfidence * 100)}% confidence)
- Rule thresholds: min ROI ${ctx.minRoi}%, min profit ₹${ctx.minProfit}
- Deterministic risk summary: ${ctx.riskSummary}
- Verdict: ${ctx.verdict}`;

  const raw = await chatJSON(system, user);
  const text = raw?.trim();
  const ok = text && text.length > 60 && text.length < 900;
  const output = { explanation: ok ? text : null };

  await auditLLM({
    userId,
    action: 'deal_explanation',
    inputSnapshot: ctx as unknown as Record<string, unknown>,
    output,
    confidence: ok ? 0.9 : undefined,
    latencyMs: Date.now() - started,
    fallbackUsed: !ok,
  });

  if (ok && text) return { text, source: 'llm' };
  return { text: templateExplanation(ctx), source: 'template' };
}

function templateExplanation(ctx: ExplanationContext): string {
  const headroom = Math.round(ctx.maxBuyPrice - ctx.supplierCost);
  const headroomTxt =
    headroom > 0
      ? `You have ₹${headroom} of headroom below your max buy price of ${inr(ctx.maxBuyPrice)}.`
      : `The supplier is asking ${inr(ctx.supplierCost)}, which is ₹${Math.abs(headroom)} above your max buy price of ${inr(ctx.maxBuyPrice)} — negotiate down or walk away.`;
  const risk =
    ctx.priceCutters7d > 0
      ? `The main risk is short-term price competition — ${ctx.priceCutters7d} sellers reduced prices this week.`
      : Math.abs(ctx.trend30dPct) > 8
        ? `The main risk is price direction — Amazon price moved ${ctx.trend30dPct}% over the last 30 days.`
        : ctx.gstVerified
          ? 'No major risk flags were detected by the deterministic checks.'
          : 'The main risk is supplier GST status — without a GST-verified supplier you lose input tax credit.';
  const moq = ctx.moq ? ` Consider a test order of ${ctx.moq} units (the supplier MOQ) before scaling.` : ' Consider a small test order before scaling.';
  return `This is a ${ctx.verdict.replace('_', ' ')} at the current supplier price of ${inr(ctx.supplierCost)} — projected ${pct(ctx.roi)} ROI and ${inr(ctx.netProfit)} net profit per unit, both computed by the deterministic fee engine. ${headroomTxt} ${risk}${moq}`;
}

// ─── Listing draft (gated upstream by Legal Metrology check) ────────────────

export interface ListingDraftContext {
  title: string;
  brand?: string | null;
  category?: string | null;
  material?: string | null;
  colour?: string | null;
  capacity?: string | null;
  packQuantity?: number;
  netQuantity?: string | null;
  mrp?: number | null;
  supplierDescription?: string;
  amazonAsinTitle?: string | null;
  amazonPrice?: number | null;
}

export interface ListingDraftOutput {
  title: string;
  bullets: string[];
  description: string;
  backendKeywords: string;
  source: 'llm' | 'template';
}

export async function draftListing(ctx: ListingDraftContext, userId?: string): Promise<ListingDraftOutput> {
  const started = Date.now();
  const system =
    'You are the Amazon India listing copywriter for an arbitrage platform. Draft a compliant, factual listing from the supplied supplier data. ' +
    'RULES: title <= 200 chars, capitalize key words, no promotional phrases. Exactly 5 bullet points, each <= 240 chars, each starting with an ALL-CAPS feature label followed by a colon. ' +
    'Description 3-5 sentences, factual, no promises. Backend keywords: comma-separated, lowercase, no brand you cannot prove, no duplicates of title words beyond necessity. ' +
    'PROHIBITED: "best", "no.1", "guaranteed", medical claims, price/promo language, external links, review solicitation. ' +
    'Return ONLY valid JSON: {"title": "...", "bullets": ["...", ...], "description": "...", "backend_keywords": "..."}.';
  const user = `Supplier data:
- Supplier title: ${ctx.title}
- Brand: ${ctx.brand ?? '(unknown — do not invent a brand)'}
- Category: ${ctx.category ?? 'Home & Kitchen'}
- Material: ${ctx.material ?? 'n/a'}; Colour: ${ctx.colour ?? 'n/a'}; Capacity: ${ctx.capacity ?? 'n/a'}
- Pack quantity: ${ctx.packQuantity ?? 1}; Net quantity: ${ctx.netQuantity ?? 'n/a'}
- MRP: ${ctx.mrp ? `₹${ctx.mrp}` : 'n/a'}
- Competitive Amazon reference listing: ${ctx.amazonAsinTitle ?? 'n/a'} (price ₹${ctx.amazonPrice ?? 'n/a'})
- Supplier description: ${ctx.supplierDescription?.slice(0, 900) ?? 'n/a'}`;

  const raw = await chatJSON(system, user);
  const parsed = extractJSONBlock(raw ?? '') as
    | { title?: string; bullets?: string[]; description?: string; backend_keywords?: string }
    | null;

  let draft: ListingDraftOutput | null = null;
  if (parsed && typeof parsed.title === 'string' && Array.isArray(parsed.bullets) && parsed.bullets.length >= 3) {
    draft = {
      title: parsed.title.slice(0, LIMITS.title),
      bullets: parsed.bullets.slice(0, LIMITS.bullets).map((b) => String(b).slice(0, LIMITS.bullet)),
      description: String(parsed.description ?? '').slice(0, LIMITS.description),
      backendKeywords: String(parsed.backend_keywords ?? '').slice(0, LIMITS.backendKeywords),
      source: 'llm',
    };
  } else {
    draft = templateListing(ctx);
  }

  // Policy scrub regardless of source
  const scanText = `${draft.title} ${draft.bullets.join(' ')} ${draft.description}`;
  const scan = scanProhibitedClaims(scanText);
  for (const f of scan.findings) {
    draft.title = scrub(draft.title, f.matched);
    draft.bullets = draft.bullets.map((b) => scrub(b, f.matched));
    draft.description = scrub(draft.description, f.matched);
  }
  draft.title = draft.title.slice(0, LIMITS.title);

  await auditLLM({
    userId,
    action: 'listing_draft',
    inputSnapshot: ctx as unknown as Record<string, unknown>,
    output: draft as unknown as Record<string, unknown>,
    confidence: draft.source === 'llm' ? 0.88 : undefined,
    latencyMs: Date.now() - started,
    fallbackUsed: draft.source === 'template',
  });

  return draft;
}

function scrub(text: string, match: string): string {
  if (!match) return text;
  const re = new RegExp(`\\b${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s*,?;?`, 'gi');
  return text.replace(re, '').replace(/\s{2,}/g, ' ').trim();
}

function templateListing(ctx: ListingDraftContext): ListingDraftOutput {
  const name = ctx.title.replace(/wholesale|bulk|export quality|standard grade/gi, '').replace(/\s{2,}/g, ' ').trim();
  const t = `${name} — ${ctx.packQuantity && ctx.packQuantity > 1 ? `Pack of ${ctx.packQuantity}` : 'Single'}${ctx.material ? `, ${ctx.material}` : ''}${ctx.colour ? `, ${ctx.colour}` : ''}`;
  const bullets = [
    `MATERIAL & BUILD: Made with ${ctx.material ?? 'quality materials'} designed for everyday home use.`,
    `PACK CONTENTS: ${ctx.netQuantity ?? `${ctx.packQuantity ?? 1} unit(s)`} — ideal for gifting and daily needs.`,
    `PRACTICAL DESIGN: Compact, easy to store and clean; suits kitchen, office and travel use.`,
    `CARE: Wipe clean with a dry cloth; avoid abrasive cleaners to keep the finish intact.`,
    `SUITABLE FOR: Households, hostels, offices and as a thoughtful utility gift.`,
  ];
  const description =
    `${name} offered in ${ctx.netQuantity ?? `a pack of ${ctx.packQuantity ?? 1}`}. ` +
    `Sourced from a verified supplier and prepared for Amazon FBA with standard packaging. ` +
    `A practical everyday item for home and kitchen use.`;
  const backendKeywords = [ctx.category, ctx.material, ctx.colour, ctx.capacity]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join(', ');
  return {
    title: t.slice(0, LIMITS.title),
    bullets,
    description,
    backendKeywords,
    source: 'template',
  };
}

// ─── Catalog extraction (schema-constrained, batch) ─────────────────────────

export interface ExtractionInput {
  productName: string;
  priceInr: number;
  unit: string;
  supplierName: string;
  detailJson: string;
}

export interface ExtractionOutput {
  supplierSku?: string;
  title: string;
  brand?: string;
  category?: string;
  mrp?: number;
  purchasePrice: number;
  gstRate: number;
  moq?: number;
  packQuantity: number;
  weightGrams?: number;
  attributes: Record<string, string>;
  manufacturerName?: string;
  countryOfOrigin?: string;
  netQuantity?: string;
  customerCare?: string;
  monthYearMfg?: string;
  confidence: number;
}

export async function extractCatalogBatch(
  items: ExtractionInput[],
  gstRateDefault: number,
  userId?: string
): Promise<{ outputs: ExtractionOutput[]; source: 'llm' | 'heuristic' }> {
  const started = Date.now();
  const system =
    'You are the catalog-extraction agent for an arbitrage sourcing platform. From raw IndiaMART listing payloads, output one normalized JSON object per item. ' +
    'Schema per item: {"index": number, "supplier_sku": string|null, "title": string (cleaned, title case, no "wholesale/bulk/export" words), "brand": string|null, ' +
    '"category": one of ["Home & Kitchen","Beauty","Toys","Electronics","Apparel","Sports","Office Products","Health","Grocery","Furniture"], "mrp": number|null, ' +
    '"purchase_price": number, "gst_rate": number, "moq": number|null, "pack_quantity": number, "weight_grams": number|null, ' +
    '"attributes": object with any of colour/material/capacity/watt/pages/pieces, "manufacturer_name": string|null, "country_of_origin": string|null, ' +
    '"net_quantity": string|null, "customer_care": string|null, "month_year_mfg": string|null, "confidence": number 0-1}. ' +
    'NEVER invent values that are absent in the source — use null. If MRP or manufacturer is missing, leave it null (a downstream compliance gate depends on this). ' +
    'purchase_price defaults to the listing price. gst_rate defaults to ' + gstRateDefault + ' unless the category implies otherwise (Apparel 5, Toys/Sports/Health 12). ' +
    'Return ONLY valid JSON: {"items": [ ... ]} preserving order and the "index" field.';
  const user = items
    .map((it, i) => `[${i}] name: ${it.productName}\n    price: ₹${it.priceInr} per ${it.unit}; supplier: ${it.supplierName}\n    detail_json: ${it.detailJson.slice(0, 700)}`)
    .join('\n');

  const raw = await chatJSON(system, user);
  const parsed = extractJSONBlock(raw ?? '') as { items?: Array<Record<string, unknown>> } | null;

  if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
    const byIndex = new Map<number, Record<string, unknown>>();
    parsed.items.forEach((o, i) => {
      const idx = typeof o.index === 'number' ? o.index : i;
      byIndex.set(idx, o);
    });
    const outputs = items.map((it, i) => {
      const o = (byIndex.get(i) ?? {}) as Record<string, unknown>;
      return heuristicExtract(it, gstRateDefault, o);
    });
    await auditLLM({
      userId,
      action: 'catalog_extraction',
      inputSnapshot: { count: items.length },
      output: { items: outputs.map((o) => ({ title: o.title, brand: o.brand ?? null })) },
      latencyMs: Date.now() - started,
      fallbackUsed: false,
    });
    return { outputs, source: 'llm' };
  }

  const outputs = items.map((it) => heuristicExtract(it, gstRateDefault));
  await auditLLM({
    userId,
    action: 'catalog_extraction',
    inputSnapshot: { count: items.length },
    output: { items: outputs.map((o) => ({ title: o.title })) },
    latencyMs: Date.now() - started,
    fallbackUsed: true,
  });
  return { outputs, source: 'heuristic' };
}

// Deterministic extraction from the structured detail payload (fallback + merge).
export function heuristicExtract(item: ExtractionInput, gstRateDefault: number, llm?: Record<string, unknown>): ExtractionOutput {
  let detail: Record<string, unknown> = {};
  try {
    detail = JSON.parse(item.detailJson);
  } catch {
    detail = {};
  }
  const d = (detail as { detail?: Record<string, unknown> }).detail ?? detail;
  const s = (k: string): string | undefined => {
    const v = d[k] ?? llm?.[k];
    if (v === null || v === undefined || v === '') return undefined;
    return String(v);
  };
  const n = (k: string): number | undefined => {
    const v = d[k] ?? llm?.[k];
    if (v === null || v === undefined || v === '') return undefined;
    const num = Number(v);
    return Number.isFinite(num) ? num : undefined;
  };

  const cleanTitle = item.productName
    .replace(/wholesale|bulk\s+(supply|order|lot)|export\s+quality|standard\s+grade|premium\s+finish/gi, '')
    .replace(/[-–]{1,2}\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const attributes: Record<string, string> = {};
  for (const key of ['colour', 'color', 'material', 'capacity', 'watt', 'pages', 'pieces', 'flavour']) {
    const v = s(key) ?? s(key === 'color' ? 'colour' : key === 'colour' ? 'color' : key);
    if (v) attributes[key === 'color' ? 'colour' : key] = v;
  }

  const moq = n('moq') ?? (llm?.moq !== undefined && llm?.moq !== null ? Number(llm.moq) : undefined);
  const packQuantity = n('pack_quantity') ?? 1;
  const mrp = n('mrp');
  const category = s('category') ?? guessCategory(item.productName);

  return {
    supplierSku: s('supplier_sku') ?? s('hsn') ? `IM-${s('hsn') ?? 'GEN'}-${item.supplierName.slice(0, 3).toUpperCase()}` : undefined,
    title: (typeof llm?.title === 'string' && llm.title ? llm.title : cleanTitle).slice(0, 160),
    brand: s('brand') || (typeof llm?.brand === 'string' && llm.brand ? llm.brand : undefined) || undefined,
    category,
    mrp,
    purchasePrice: item.priceInr,
    gstRate: n('gst_rate') ?? (category === 'Apparel' ? 5 : ['Toys', 'Sports', 'Health'].includes(category) ? 12 : gstRateDefault),
    moq: moq && moq > 0 ? Math.round(moq) : undefined,
    packQuantity: packQuantity > 0 ? Math.round(packQuantity) : 1,
    weightGrams: n('weight_grams'),
    attributes,
    manufacturerName: s('manufacturer') ?? s('manufacturer_name'),
    countryOfOrigin: s('country_of_origin') ?? 'India',
    netQuantity: s('net_quantity') ?? (packQuantity > 1 ? `Pack of ${packQuantity}` : undefined),
    customerCare: s('customer_care'),
    monthYearMfg: s('month_year_mfg'),
    confidence: typeof llm?.confidence === 'number' ? llm.confidence : detail && Object.keys(d).length > 3 ? 0.82 : 0.55,
  };
}

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/(lunch|tiffin|bottle|flask|container|knife|cutting|kitchen|cookware|storage)/.test(n)) return 'Home & Kitchen';
  if (/(yoga|dumbbell|resistance|fitness|gym|sports)/.test(n)) return 'Sports';
  if (/(t.?shirt|kurta|apparel|garment|clothing)/.test(n)) return 'Apparel';
  if (/(led|bulb|cable|electronic|charger|light)/.test(n)) return 'Electronics';
  if (/(notebook|diary|pen|stationery)/.test(n)) return 'Office Products';
  if (/(toy|blocks|puzzle)/.test(n)) return 'Toys';
  if (/(soap|cream|lip|beauty|serum|shampoo)/.test(n)) return 'Beauty';
  return 'Home & Kitchen';
}
