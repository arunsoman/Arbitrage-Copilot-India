// ─── Bootstrap: demo user + catalog seed (idempotent) ────────────────────────

import { db } from '@/lib/db';
import { AMAZON_CATALOG_SEED } from './amazon-catalog';

const DEMO_USER_EMAIL = 'ramesh@arbitragecopilot.in';

export async function ensureUser() {
  let user = await db.user.findUnique({ where: { email: DEMO_USER_EMAIL } });
  if (!user) {
    user = await db.user.create({
      data: {
        name: 'Ramesh',
        email: DEMO_USER_EMAIL,
        role: 'seller',
        businessName: 'Ramesh Enterprises',
        gstin: '27AAXXXXXXXZ1',
        state: 'Maharashtra',
        minRoi: 25,
        maxBuyPrice: 500,
        minProfit: 150,
        gstRateDefault: 18,
        riskTolerance: 'balanced',
        preferredCategories: JSON.stringify(['Home & Kitchen', 'Sports', 'Electronics']),
        amazonConnected: true,
        amazonConnectedAt: new Date(),
      },
    });
  }
  return user;
}

export async function ensureCatalog() {
  const count = await db.amazonCatalog.count();
  if (count === 0) {
    await db.amazonCatalog.createMany({
      data: AMAZON_CATALOG_SEED.map((c) => ({
        asin: c.asin,
        title: c.title,
        brand: c.brand,
        category: c.category,
        price: c.price,
        referralPct: c.referralPct,
        weightGrams: c.weightGrams,
        attributesJson: JSON.stringify(c.attributes),
        keywords: c.keywords,
        imageHint: c.imageHint,
      })),
    });
  }
}

export async function ensureSystemConfig() {
  const defaults: Record<string, unknown> = {
    toolPermissions: {
      extract_catalog_item: true,
      search_amazon_candidates: true,
      verify_product_match: true,
      calculate_margin: true,
      create_buy_list_item: true,
      draft_listing: false, // requires review
    },
    complianceGates: {
      blockListingIfMrpMissing: true,
      blockListingIfManufacturerMissing: true,
      blockListingIfCountryOfOriginMissing: true,
      requireHumanReview: true,
    },
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await db.systemConfig.findUnique({ where: { key } });
    if (!existing) {
      await db.systemConfig.create({ data: { key, value: JSON.stringify(value) } });
    }
  }
}

export async function ensureWarehouses() {
  const count = await db.fbaWarehouse.count();
  if (count > 0) return;
  await db.fbaWarehouse.createMany({
    data: [
      { code: 'BOM4', name: 'Amazon FC — Bhiwandi (Mumbai)', state: 'Maharashtra', city: 'Bhiwandi', pincode: '421302', address: 'Kone Bhiwandi Logistics Park, Anjur Phata, Bhiwandi 421302, MH' },
      { code: 'DEL3', name: 'Amazon FC — Tughlakabad (Delhi NCR)', state: 'Delhi', city: 'New Delhi', pincode: '110020', address: 'Plot SP-136-140, Tughlakabad Industrial Area, New Delhi 110020' },
      { code: 'BLR7', name: 'Amazon FC — Attibele (Bengaluru)', state: 'Karnataka', city: 'Bengaluru', pincode: '562107', address: 'SY 90-107 Attibele Hobli, Anekal Taluk, Bengaluru Urban 562107, KA' },
      { code: 'HYD8', name: 'Amazon FC — Kothur (Hyderabad)', state: 'Telangana', city: 'Hyderabad', pincode: '509216', address: 'Survey 226-232, Kothur Mandal, Mahabubnagar Dist, NH-44, 509216, TS' },
      { code: 'MAA3', name: 'Amazon FC — Periyapalayam (Chennai)', state: 'Tamil Nadu', city: 'Chennai', pincode: '601102', address: 'SF 244-247 Periyapalayam Rd, Uthukottai Taluk, Tiruvallur 601102, TN' },
      { code: 'AMD1', name: 'Amazon FC — Kheda Corridor (Ahmedabad)', state: 'Gujarat', city: 'Ahmedabad', pincode: '382424', address: 'SP 46-52 Nana Chiloda Cir, Kalyanpur, Ahmedabad 382424, GJ' },
      { code: 'CCU2', name: 'Amazon FC — Bantala (Kolkata)', state: 'West Bengal', city: 'Kolkata', pincode: '743502', address: 'Block NF, Bantala Leather Complex, 24 Parganas (S), 743502, WB' },
    ],
  });
}

export async function ensureBootstrap() {
  await Promise.all([ensureUser(), ensureCatalog(), ensureSystemConfig(), ensureWarehouses()]);
}

export async function getSystemConfig(): Promise<{ toolPermissions: Record<string, boolean>; complianceGates: Record<string, boolean> }> {
  const rows = await db.systemConfig.findMany();
  const out: Record<string, Record<string, boolean>> = { toolPermissions: {}, complianceGates: {} };
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      /* ignore */
    }
  }
  return {
    toolPermissions: out.toolPermissions ?? {},
    complianceGates: out.complianceGates ?? {},
  };
}
