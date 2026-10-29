// ─── Shiprocket Cargo provider (B2B / FBA inbound logistics) ─────────────────
// Shiprocket's dedicated Cargo solution moves bulk inventory from a supplier
// (e.g. IndiaMART) to an Amazon Fulfillment Center. Supports PTL / FTL modes.
//
// Live mode: set SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD (API user created in
// the Shiprocket panel). All calls hit https://apiv2.shiprocket.in/v1/external.
// Demo mode: deterministic responses that mirror the real API shapes so the
// whole booking → AWB → pickup → tracking lifecycle stays exercisable.

import { createHash } from 'crypto';

const API_BASE = process.env.SHIPROCKET_API_BASE ?? 'https://apiv2.shiprocket.in/v1/external';
const SR_EMAIL = process.env.SHIPROCKET_EMAIL;
const SR_PASSWORD = process.env.SHIPROCKET_PASSWORD;

export function isShiprocketLive(): boolean {
  return Boolean(SR_EMAIL && SR_PASSWORD);
}

export function shiprocketProviderLabel(): string {
  return isShiprocketLive() ? 'shiprocket-live' : 'shiprocket-demo';
}

// ── Auth ─────────────────────────────────────────────────────────────────────

let cachedToken: { token: string; fetchedAt: number } | null = null;

export interface ShiprocketAuthResponse {
  token: string;
}

async function srFetch<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.auth !== false) {
    const { token } = await getToken();
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Shiprocket ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export async function getToken(): Promise<ShiprocketAuthResponse> {
  if (cachedToken && Date.now() - cachedToken.fetchedAt < 9 * 24 * 60 * 60 * 1000) {
    return { token: cachedToken.token };
  }
  if (!SR_EMAIL || !SR_PASSWORD) {
    throw new Error('Shiprocket credentials not configured (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD)');
  }
  const data = await srFetch<ShiprocketAuthResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email: SR_EMAIL, password: SR_PASSWORD }),
  });
  cachedToken = { token: data.token, fetchedAt: Date.now() };
  return data;
}

// ── Shared shapes ────────────────────────────────────────────────────────────

export interface CargoCourier {
  courier_company_id: number;
  courier_name: string;
  rate_per_kg: number;       // freight rate per charged kg
  min_charged_weight_kg: number;
  min_freight: number;       // minimum freight charge per shipment
  eta_days: number;
  transit_intensity?: string; // e.g. "PTL", "FTL"
  services: string[];        // ["PTL","FTL","DOORSTEP_PICKUP",...]
}

export interface ServiceabilityResult {
  serviceable: boolean;
  pincode: { pickup: string; delivery: string };
  charged_weight_kg: number;
  couriers: CargoCourier[];
}

export interface ForwardShipmentPayload {
  // Order
  order_id: string;                 // platform reference
  order_date: string;               // ISO date
  pickup_location: string;          // registered pickup location name (supplier warehouse)
  // Consignee (Amazon FC dock)
  billing_customer_name: string;
  billing_last_name?: string;
  billing_address: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;
  // Shipping is same as billing for B2B dock delivery
  shipping_is_billing: true;
  // Goods
  order_items: Array<{ name: string; sku: string; units: number; selling_price: number; hsn?: string }>;
  payment_method: 'Prepaid';
  sub_total: number;                // declared value INR
  // Cargo dimensions
  length_cm: number;
  breadth_cm: number;
  height_cm: number;
  weight_kg: number;
  shipment_type?: 'PTL' | 'FTL';
}

export interface ForwardShipmentResult {
  order_id: number | string;
  shipment_id: number | string;
  status: string;
  awb_assigned: boolean;
  courier_name?: string;
  awb_code?: string;
  label_url?: string;
  manifest_url?: string;
}

export interface AwbAssignResult {
  awb_code: string;
  courier_name: string;
  courier_company_id?: number;
  etd?: string;
  freight_charges?: number;
  label_url?: string;
  manifest_url?: string;
}

export interface PickupResult {
  pickup_status: string;
  pickup_token_number: string;
  pickup_scheduled_date: string;
  pickup_generated_date?: string;
}

export interface TrackingScan {
  date: string;
  activity: string;
  location: string;
  status: string;
}

export interface TrackingResult {
  awb_code: string;
  courier_name: string;
  current_status: string;
  delivered: boolean;
  etd?: string;
  scans: TrackingScan[];
}

// ── Demo (deterministic) engine ──────────────────────────────────────────────
// Seeded from a hash of the reference so the same id always yields the same
// courier / AWB / ETA — keeps the demo believable and repeatable.

const DEMO_COURIERS: Array<Omit<CargoCourier, 'rate_per_kg' | 'min_freight' | 'eta_days'>> = [
  { courier_company_id: 9101, courier_name: 'GATI-KWE Cargo', min_charged_weight_kg: 100, services: ['PTL', 'DOORSTEP_PICKUP'] },
  { courier_company_id: 9102, courier_name: 'TCI Freight', min_charged_weight_kg: 500, services: ['PTL', 'FTL'] },
  { courier_company_id: 9103, courier_name: 'Safeexpress B2B', min_charged_weight_kg: 100, services: ['PTL', 'DOORSTEP_PICKUP'] },
  { courier_company_id: 9104, courier_name: 'V-Trans Cargo', min_charged_weight_kg: 2000, services: ['FTL'] },
  { courier_company_id: 9105, courier_name: 'BlueDart Surface Cargo', min_charged_weight_kg: 50, services: ['PTL', 'DOORSTEP_PICKUP'] },
];

function seeded(seed: string): () => number {
  const h = createHash('sha256').update(seed).digest();
  let i = 0;
  return () => {
    const v = h[i % h.length];
    i += 1;
    return v / 255;
  };
}

export const CARGO_RATE_CARD = {
  // Shiprocket Cargo headline: B2B surface freight from ~₹6/kg on PTL lanes.
  basePerKgPt: 6.5,
  minFreightPt: 1450,
  perKgSteps: 1.8, // +₹/kg per 100 km lane band (demo lanes)
  ftlPerKm: 42,    // ₹/km per full truck (demo)
  ftlMin: 18000,
};

function laneDistanceKm(pickupPin: string, deliveryPin: string): number {
  // Deterministic pseudo-distance from pincode zones (first digit = region,
  // mirroring India Post's zone system — demo only).
  const zone = (p: string) => parseInt(p.slice(0, 1), 10) || 1;
  const d = Math.abs(zone(pickupPin) - zone(deliveryPin));
  return 300 + d * 500;
}

function demoCouriersFor(weightKg: number, mode: string, pickupPin: string, deliveryPin: string): CargoCourier[] {
  const km = laneDistanceKm(pickupPin, deliveryPin);
  return DEMO_COURIERS.filter((c) => c.services.includes(mode)).map((c) => {
    const rand = seeded(`${c.courier_company_id}:${pickupPin}:${deliveryPin}:${mode}`);
    if (mode === 'FTL') {
      const freight = Math.max(CARGO_RATE_CARD.ftlMin, Math.round(km * CARGO_RATE_CARD.ftlPerKm * (0.9 + rand() * 0.2)));
      return {
        ...c,
        rate_per_kg: Math.round((freight / Math.max(weightKg, c.min_charged_weight_kg)) * 100) / 100,
        min_freight: freight,
        eta_days: 2 + Math.floor(km / 600),
      };
    }
    const perKg = Math.round((CARGO_RATE_CARD.basePerKgPt + (km / 500) * CARGO_RATE_CARD.perKgSteps * (0.85 + rand() * 0.3)) * 100) / 100;
    const charged = Math.max(weightKg, c.min_charged_weight_kg);
    return {
      ...c,
      rate_per_kg: perKg,
      min_freight: CARGO_RATE_CARD.minFreightPt,
      eta_days: 3 + Math.floor(km / 450),
      freight_quote: Math.round(Math.max(CARGO_RATE_CARD.minFreightPt, perKg * charged)),
    } as CargoCourier;
  });
}

// ── Public API (live with fallback to demo) ──────────────────────────────────

export async function checkCargoServiceability(input: {
  pickupPincode: string;
  deliveryPincode: string;
  weightKg: number;
  mode: 'PTL' | 'FTL';
}): Promise<ServiceabilityResult> {
  if (isShiprocketLive()) {
    try {
      // Shiprocket serviceability endpoint — cargo couriers surfaced for heavy freight lanes.
      const data = await srFetch<{
        data?: {
          available_courier_companies?: Array<Record<string, unknown>>;
        };
      }>('/serviceability/', {
        method: 'POST',
        body: JSON.stringify({
          pickup_postcode: input.pickupPincode,
          delivery_postcode: input.deliveryPincode,
          weight: Math.max(input.weightKg, 1),
          cod: 0,
          declared_value: 1,
          mode: input.mode,
        }),
      });
      const raw = data.data?.available_courier_companies ?? [];
      const couriers: CargoCourier[] = raw.map((c, idx) => ({
        courier_company_id: Number(c.courier_company_id ?? 9000 + idx),
        courier_name: String(c.courier_name ?? 'Cargo partner'),
        rate_per_kg: Number(c.rate_per_kg ?? c.freight_charges ?? 0) || 0,
        min_charged_weight_kg: Number(c.min_weight ?? 50),
        min_freight: Number(c.freight_charges ?? 0) || 0,
        eta_days: Number(c.eta ?? c.estimated_delivery_days ?? 5),
        services: [input.mode],
      }));
      return {
        serviceable: couriers.length > 0,
        pincode: { pickup: input.pickupPincode, delivery: input.deliveryPincode },
        charged_weight_kg: input.weightKg,
        couriers,
      };
    } catch {
      // fall through to demo
    }
  }
  // Demo: cargo lanes are serviceable unless pincode malformed
  const ok = /^\d{6}$/.test(input.pickupPincode) && /^\d{6}$/.test(input.deliveryPincode);
  return {
    serviceable: ok,
    pincode: { pickup: input.pickupPincode, delivery: input.deliveryPincode },
    charged_weight_kg: Math.max(input.weightKg, 1),
    couriers: ok ? demoCouriersFor(Math.max(input.weightKg, 1), input.mode, input.pickupPincode, input.deliveryPincode) : [],
  };
}

export async function createForwardShipment(payload: ForwardShipmentPayload): Promise<ForwardShipmentResult> {
  if (isShiprocketLive()) {
    try {
      const data = await srFetch<ForwardShipmentResult>('/shipments/create/forward-shipment', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return data;
    } catch {
      // fall through to demo
    }
  }
  const rand = seeded(`fs:${payload.order_id}`);
  const idNum = 1000000000 + Math.floor(rand() * 899999999);
  const shipNum = idNum + 1;
  return {
    order_id: idNum,
    shipment_id: shipNum,
    status: 'NEW',
    awb_assigned: false,
  };
}

export async function assignAwb(shipmentRef: string, mode: 'PTL' | 'FTL' = 'PTL'): Promise<AwbAssignResult> {
  if (isShiprocketLive()) {
    try {
      const data = await srFetch<AwbAssignResult>('/courier/assign/awb', {
        method: 'POST',
        body: JSON.stringify({ shipment_id: shipmentRef, mode }),
      });
      return data;
    } catch {
      // fall through to demo
    }
  }
  const rand = seeded(`awb:${shipmentRef}`);
  const couriers = DEMO_COURIERS.filter((c) => c.services.includes(mode));
  const courier = couriers[Math.floor(rand() * couriers.length)] ?? DEMO_COURIERS[0];
  const prefix = mode === 'FTL' ? 'FTL' : 'CG';
  const digits = String(1000000000 + Math.floor(rand() * 8999999999));
  return {
    awb_code: `${prefix}${digits.slice(0, 10)}`,
    courier_name: courier.courier_name,
    courier_company_id: courier.courier_company_id,
    etd: new Date(Date.now() + (3 + Math.floor(rand() * 5)) * 86400000).toISOString(),
    freight_charges: Math.round(1500 + rand() * 9000),
  };
}

export async function generateLabel(shipmentRef: string): Promise<{ label_url: string }> {
  if (isShiprocketLive()) {
    try {
      return await srFetch<{ label_url: string }>('/courier/generate/label', {
        method: 'POST',
        body: JSON.stringify({ shipment_id: [shipmentRef] }),
      });
    } catch {
      // fall through
    }
  }
  return { label_url: `https://demo.shiprocket.in/labels/${shipmentRef}.pdf` };
}

export async function generateManifest(shipmentRef: string): Promise<{ manifest_url: string }> {
  if (isShiprocketLive()) {
    try {
      return await srFetch<{ manifest_url: string }>('/manifests/generate', {
        method: 'POST',
        body: JSON.stringify({ shipment_id: [shipmentRef] }),
      });
    } catch {
      // fall through
    }
  }
  return { manifest_url: `https://demo.shiprocket.in/manifests/${shipmentRef}.pdf` };
}

export async function generatePickup(shipmentRef: string): Promise<PickupResult> {
  if (isShiprocketLive()) {
    try {
      const data = await srFetch<PickupResult>('/courier/generate/pickup', {
        method: 'POST',
        body: JSON.stringify({ shipment_id: [shipmentRef] }),
      });
      return data;
    } catch {
      // fall through
    }
  }
  const rand = seeded(`pickup:${shipmentRef}`);
  const days = 1 + Math.floor(rand() * 2);
  const scheduled = new Date(Date.now() + days * 86400000);
  return {
    pickup_status: 'Pickup Scheduled',
    pickup_token_number: `PTK${String(100000 + Math.floor(rand() * 899999))}`,
    pickup_scheduled_date: scheduled.toISOString(),
    pickup_generated_date: new Date().toISOString(),
  };
}

export async function trackAwb(awb: string, courier?: string): Promise<TrackingResult> {
  if (isShiprocketLive()) {
    try {
      const data = await srFetch<{
        tracking_data?: {
          shipment_status?: number;
          shipment_track?: Array<Record<string, unknown>>;
          shipment_track_activities?: Array<Record<string, unknown>>;
        };
      }>(`/courier/track/awb/${encodeURIComponent(awb)}${courier ? `?courier_name=${encodeURIComponent(courier)}` : ''}`);
      const td = data.tracking_data ?? {};
      const activities = td.shipment_track_activities ?? [];
      const track0 = td.shipment_track ?? [];
      const t0 = Array.isArray(track0) && track0.length > 0 ? track0[0] : {};
      const scans: TrackingScan[] = activities.map((a) => ({
        date: String(a.date ?? a.activity_date ?? ''),
        activity: String(a.activity ?? ''),
        location: String(a.location ?? ''),
        status: String(a['status'] ?? ''),
      }));
      const statusNum = Number(td.shipment_status ?? 0);
      return {
        awb_code: String(t0.awb ?? awb),
        courier_name: String(t0.courier_name ?? courier ?? ''),
        current_status: scans[0]?.status ?? (statusNum === 7 ? 'Delivered' : 'In Transit'),
        delivered: statusNum === 7,
        etd: t0.expected_delivery_date ? String(t0.expected_delivery_date) : undefined,
        scans,
      };
    } catch {
      // fall through
    }
  }
  // Demo: derive progress from the AWB hash so tracking evolves believably.
  const rand = seeded(`track:${awb}`);
  const created = Date.now() - Math.floor(rand() * 6 * 86400000);
  const totalDays = 4 + Math.floor(rand() * 4);
  const elapsedDays = Math.floor((Date.now() - created) / 86400000);
  const delivered = elapsedDays >= totalDays;
  const courierName = DEMO_COURIERS[Math.floor(rand() * DEMO_COURIERS.length)].courier_name;
  const legs = [
    { activity: 'Pickup scheduled. Shipment booked via Shiprocket Cargo.', location: 'Origin', status: 'Pickup Scheduled' },
    { activity: 'Cargo collected from supplier premises (doorstep pickup).', location: 'Origin', status: 'Picked Up' },
    { activity: 'Received at origin hub. Consolidated for line-haul.', location: 'Origin Hub', status: 'In Transit' },
    { activity: 'Departed origin hub on line-haul truck.', location: 'Origin Hub', status: 'In Transit' },
    { activity: 'Arrived at destination hub. Out for dock delivery.', location: 'Destination Hub', status: 'In Transit' },
    { activity: 'Delivered at Amazon Fulfillment Center dock. POD generated.', location: 'Amazon FC', status: 'Delivered' },
  ];
  const progress = delivered ? legs.length : Math.min(legs.length - 1, 1 + Math.floor((elapsedDays / totalDays) * (legs.length - 1)));
  const scans: TrackingScan[] = legs.slice(0, Math.max(progress, 1)).map((leg, i) => ({
    date: new Date(created + i * (totalDays / legs.length) * 86400000).toISOString(),
    activity: leg.activity,
    location: leg.location,
    status: leg.status,
  }));
  return {
    awb_code: awb,
    courier_name: courierName,
    current_status: delivered ? 'Delivered' : scans[scans.length - 1]?.status ?? 'In Transit',
    delivered,
    etd: new Date(created + totalDays * 86400000).toISOString(),
    scans,
  };
}

// ── Weight / mode helpers (cargo economics) ──────────────────────────────────

export function suggestCargoMode(totalWeightKg: number): 'PTL' | 'FTL' {
  // Practical rule of thumb: under ~2,000 kg consolidated freight → PTL.
  return totalWeightKg >= 2000 ? 'FTL' : 'PTL';
}

// Resolve a pickup pincode for a supplier without a registered portal profile:
// derive it from the IndiaMART location city (demo lane map), else NCR default.
const CITY_PINCODES: Record<string, string> = {
  ahmedabad: '382445', gandhinagar: '382010', surat: '395003', vadodara: '390001', rajkot: '360001',
  mumbai: '400001', 'navi mumbai': '400703', thane: '400601', pune: '411001', nagpur: '440001',
  delhi: '110001', 'new delhi': '110020', noida: '201301', gurgaon: '122001', gurugram: '122001',
  ghaziabad: '201001', faridabad: '121002', 'tughlakabad': '110020',
  bengaluru: '560100', bangalore: '560100', mysore: '570001',
  hyderabad: '509216', secunderabad: '500003', chennai: '601102', kolkata: '743502',
  jaipur: '302013', jodhpur: '342001', indore: '452010', bhopal: '462001',
  ludhiana: '141003', jalandhar: '144001', chandigarh: '160002',
  kanpur: '208001', lucknow: '226004', varanasi: '221001', moradabad: '244001',
  coimbatore: '641012', madurai: '625001', kochi: '682303', ahmednagar: '414001',
};

export function guessPincodeFromLocation(location: string): string {
  const city = location.split(',')[0]?.trim().toLowerCase() ?? '';
  return CITY_PINCODES[city] ?? '110001';
}

export function quoteFreight(courier: CargoCourier, weightKg: number, mode: 'PTL' | 'FTL'): number {
  const charged = Math.max(weightKg, courier.min_charged_weight_kg);
  if (mode === 'FTL') return Math.round(courier.min_freight);
  return Math.round(Math.max(courier.min_freight, courier.rate_per_kg * charged));
}
