// ─── Client-side view models (mirror API responses) ──────────────────────────

export type Verdict = 'strong_buy' | 'watch' | 'avoid' | 'needs_review';
export type MatchType = 'exact' | 'variant' | 'similar' | 'no_match';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  gstin?: string | null;
  businessName?: string | null;
  state?: string | null;
  minRoi: number;
  maxBuyPrice: number;
  minProfit: number;
  gstRateDefault: number;
  riskTolerance: 'conservative' | 'balanced' | 'aggressive';
  preferredCategories: string[];
  amazonConnected: boolean;
  onboardingDone: boolean;
}

export interface DealSummary {
  id: string;
  title: string;
  brand?: string | null;
  category?: string | null;
  purchasePrice: number;
  moq?: number | null;
  packQuantity: number;
  supplierName: string;
  supplierLocation?: string | null;
  supplierRating?: number | null;
  yearsInBusiness?: number | null;
  gstVerified: boolean;
  trustSeal: boolean;
  match: { asin: string; matchType: MatchType; confidenceScore: number; needsReview: boolean; verifiedByUser?: string | null } | null;
  verdict: Verdict;
  roi: number;
  netProfit: number;
  maxBuyPrice: number;
  confidenceScore: number;
  riskSummary?: string | null;
  priceCutters7d: number;
  competitionSellers: number;
  amazonPrice: number;
  inBuyList?: boolean;
}

export interface SearchProduct {
  indiaMartProductId: string;
  extractedProductId: string;
  title: string;
  supplierName: string;
  supplierLocation: string;
  supplierRating?: number;
  supplierType?: string;
  yearsInBusiness?: number;
  gstVerified: boolean;
  trustSeal: boolean;
  moq?: number;
  purchasePrice: number;
  mrp?: number;
  brand?: string;
  category?: string;
  packQuantity: number;
  confidenceScore: number;
  reviewStatus: string;
  extractionMethod: string;
  lmCanGenerateListing: boolean;
  lmMissing: string[];
  deal: {
    id: string;
    verdict: Verdict;
    roi: number;
    netProfit: number;
    maxBuyPrice: number;
    confidenceScore: number;
    riskSummary?: string | null;
    priceCutters7d: number;
    amazonPrice: number;
    competitionSellers: number;
  } | null;
  match: { asin: string; matchType: MatchType; confidenceScore: number } | null;
}

export interface VerdictReason {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface DealDetailData {
  analysis: {
    id: string;
    extractedProductId: string;
    supplierCost: number;
    gstAmount: number;
    inboundShippingCost: number;
    packagingCost: number;
    totalCost: number;
    amazonPrice: number;
    referralFee: number;
    closingFee: number;
    fbaFulfillmentFee: number;
    netPayout: number;
    netProfit: number;
    roi: number;
    maxBuyPrice: number;
    verdict: Verdict;
    verdictReasons: VerdictReason[];
    riskSummary?: string | null;
    competitionSellers: number;
    priceTrend30d: number;
    priceCutters7d: number;
    explanation?: string | null;
    explanationSource: 'llm' | 'template';
    confidenceScore: number;
    toolTrace: Array<{ tool: string; summary: string }>;
    extractedProduct: {
      title: string;
      brand?: string | null;
      category?: string | null;
      mrp?: number | null;
      purchasePrice: number;
      gstRate: number;
      moq?: number | null;
      packQuantity: number;
      manufacturerName?: string | null;
      countryOfOrigin?: string | null;
      netQuantity?: string | null;
      customerCare?: string | null;
      monthYearMfg?: string | null;
      indiaMartProduct: {
        productName: string;
        productUrl?: string | null;
        supplierName: string;
        supplierUrl?: string | null;
        location?: string | null;
        supplierRating?: number | null;
        supplierType?: string | null;
        yearsInBusiness?: number | null;
        gstVerified: boolean;
        trustSeal: boolean;
      };
    };
  };
  match: {
    id: string;
    asin: string;
    productTitle: string;
    matchType: MatchType;
    confidenceScore: number;
    reasons: Array<{ signal: string; detail: string; weight: number }>;
    cascadeTrace: Array<{ stage: string; description: string; candidates: number; topScore?: number }>;
    needsReview: boolean;
    verifiedByUser?: string | null;
  } | null;
  history: Array<{ day: number; price: number }>;
}

export interface ListingDraftData {
  draft: {
    id: string;
    title: string;
    bullets: string[];
    description: string;
    backendKeywords: string;
    generationSource: 'llm' | 'template';
    humanReviewed: boolean;
    compliance: {
      legalMetrology?: { canGenerateListing: boolean; missingMandatory: string[]; checks: Array<{ field: string; label: string; present: boolean; value?: string; mandatory: boolean }> };
      claims: { clean: boolean; findings: Array<{ label: string; suggestion: string; matched: string }> };
      charLimits: Record<string, { length?: number; count?: number; max?: number; maxCount?: number; ok: boolean }>;
    };
  } | null;
}

export interface BuyListItemData {
  id: string;
  quantity: number;
  status: string;
  notes?: string | null;
  deal: {
    id: string;
    title: string;
    supplierName: string;
    supplierLocation?: string | null;
    purchasePrice: number;
    netProfit: number;
    roi: number;
    maxBuyPrice: number;
    verdict: Verdict;
    moq?: number | null;
  };
}

export interface SupplierProfileLite {
  companyName: string;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  contactPhone?: string | null;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'seller' | 'admin' | 'supplier' | string;
  avatarColor: string;
  gstin?: string | null;
  businessName?: string | null;
  state?: string | null;
  onboardingDone: boolean;
  supplierProfile?: SupplierProfileLite | null;
}

export interface SessionData {
  demoMode: boolean;
  user: SessionUser | null;
}

export interface DemoCard {
  role: string;
  label: string;
  tagline: string;
  email: string;
  icon: string;
  color: string;
  password: string;
}

export interface ShipmentItem {
  buyListItemId: string;
  title: string;
  sku: string;
  qty: number;
  unitPrice: number;
  weightGrams: number;
  hsn?: string;
  mrp?: number;
  unitsPerBox?: number;
}

export interface StatusEvent {
  status: string;
  at: string;
  by: string;
  note: string;
}

export interface TrackingScan {
  date: string;
  activity: string;
  location: string;
  status: string;
}

export interface Shipment {
  id: string;
  supplierName: string;
  destinationCode: string | null;
  destination: { code?: string; name?: string; address?: string; city?: string; state?: string; pincode?: string };
  mode: 'PTL' | 'FTL';
  items: ShipmentItem[];
  totalWeightKg: number;
  declaredValue: number;
  freightQuoted: number | null;
  freightPerKg: number | null;
  etaDays: number | null;
  provider: string;
  shiprocketOrderId: string | null;
  shiprocketShipmentId: string | null;
  awb: string | null;
  courierName: string | null;
  labelUrl: string | null;
  manifestUrl: string | null;
  pickupToken: string | null;
  pickupScheduledFor: string | null;
  status: string;
  statusHistory: StatusEvent[];
  tracking: TrackingScan[];
  pickupAddress: { name?: string; address?: string; city?: string; state?: string; pincode?: string; phone?: string };
  crm?: { event: string; status: string; at: string } | null;
  createdAt: string;
}

export interface CourierQuote {
  courierCompanyId: number;
  courierName: string;
  ratePerKg: number;
  minFreight: number;
  freight: number;
  freightPerUnit: number | null;
  etaDays: number;
  services: string[];
}

export interface QuoteResponse {
  provider: string;
  lane: { pickupPincode: string; deliveryPincode: string; weightKg: number; mode: 'PTL' | 'FTL' };
  suggestedMode: 'PTL' | 'FTL';
  serviceable: boolean;
  quotes: CourierQuote[];
  profitImpact: { estimatedInboundPerUnit: number; quotedFreightPerUnit: number; deltaPerUnit: number } | null;
}

export interface FbaWarehouseData {
  id: string;
  code: string;
  name: string;
  state: string;
  city: string;
  pincode: string;
  address: string;
}

export interface SupplierOrder {
  id: string;
  supplierName: string;
  destinationCode: string | null;
  destination: { code?: string; name?: string; address?: string; city?: string; state?: string; pincode?: string };
  mode: 'PTL' | 'FTL';
  items: Array<{ title: string; sku: string; qty: number; mrp?: number }>;
  totalUnits: number;
  totalWeightKg: number;
  declaredValue: number;
  status: string;
  awb: string | null;
  courierName: string | null;
  pickupToken: string | null;
  pickupScheduledFor: string | null;
  labelUrl: string | null;
  manifestUrl: string | null;
  createdAt: string;
}

export interface SupplierOrdersData {
  profile: (SupplierProfileLite & { gstin?: string | null; addressLine?: string | null; prepCapabilities?: string[]; crmConnected?: boolean; crmLastStatus?: string | null }) | null;
  orders: SupplierOrder[];
}

export interface AdminData {
  logs: Array<{
    id: string;
    action: string;
    modelVersion: string;
    promptVersion: string;
    confidenceScore?: number | null;
    latencyMs?: number | null;
    fallbackUsed: boolean;
    createdAt: string;
  }>;
  stats: {
    auditLogs: number;
    dealAnalyses: number;
    asinMatches: number;
    listingDrafts: number;
    indiaMartProducts: number;
    buyListItems: number;
    llmCalls: number;
    avgLatencyMs: number;
    errorRatePct: number;
  };
  config: {
    toolPermissions: Record<string, boolean>;
    complianceGates: Record<string, boolean>;
  };
}
