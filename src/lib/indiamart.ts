// ─── IndiaMART data provider (Apify-compatible) ──────────────────────────────
// PRD §5: licensed data via Apify pay-per-result. If APIFY_TOKEN is configured
// the real actor endpoint is used; otherwise a deterministic demo dataset that
// mirrors the Apify response schema keeps the pipeline fully exercisable.

export interface IndiaMartRawItem {
  product_name: string;
  product_url: string;
  price_inr: number;
  unit: string;
  moq?: number;
  supplier_name: string;
  supplier_url?: string;
  location: string;
  supplier_rating?: string;
  supplier_type?: string;
  nature_of_business?: string;
  years_in_business?: string;
  gst_verified: boolean;
  trust_seal?: boolean;
  // Extra detail payload the LLM extractor reads (Apify detail pages):
  detail?: {
    brand?: string;
    hsn?: string;
    mrp?: number;
    manufacturer?: string;
    country_of_origin?: string;
    net_quantity?: string;
    customer_care?: string;
    month_year_mfg?: string;
    weight_grams?: number;
    pack_quantity?: number;
    colour?: string;
    material?: string;
    capacity?: string;
    description?: string;
  };
}

export interface IndiaMartSearchResult {
  searchQuery: string;
  productName: string;
  productUrl: string;
  priceInr: number;
  unit: string;
  moq?: number;
  supplierName: string;
  supplierUrl: string;
  location: string;
  supplierRating?: number;
  supplierType?: string;
  natureOfBusiness?: string;
  yearsInBusiness?: number;
  gstVerified: boolean;
  trustSeal: boolean;
  raw: IndiaMartRawItem;
}

// ─────────────────────────────────────────────────────────────────────────────
// Curated demo dataset (mirrors real IndiaMART listing shapes)
// ─────────────────────────────────────────────────────────────────────────────

const DATASET: Array<{ keys: string[]; items: IndiaMartRawItem[] }> = [
  {
    keys: ['lunch box', 'tiffin', 'lunchbox'],
    items: [
      {
        product_name: 'Stainless Steel Lunch Box 3 Container 750ml Leak Proof Tiffin Silver',
        product_url: 'https://dir.indiamart.com/impcat/ss-lunch-box.html',
        price_inr: 285,
        unit: 'Piece',
        moq: 24,
        supplier_name: 'Jayant Metal Industries',
        supplier_url: 'https://jayantmetal.indiamart.com',
        location: 'Ahmedabad, Gujarat',
        supplier_rating: '4.9',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Manufacturer of steel houseware',
        years_in_business: '5',
        gst_verified: true,
        trust_seal: true,
        detail: {
          brand: 'Jayant',
          hsn: '73239310',
          mrp: 799,
          manufacturer: 'Jayant Metal Industries, Plot 42, GIDC Phase II, Ahmedabad 382445',
          country_of_origin: 'India',
          net_quantity: '750ml x 3 containers',
          customer_care: 'care@jayantmetal.com',
          month_year_mfg: '08/2025',
          weight_grams: 520,
          pack_quantity: 1,
          colour: 'silver',
          material: 'stainless steel',
          capacity: '750ml',
          description:
            'Food-grade SS304 stainless steel lunch box with three 750ml containers, silicone gasket leak-proof lids, ideal for office and school meals. Custom logo printing available on bulk orders.',
        },
      },
      {
        product_name: 'Milton Thermosteel Flip Lid Flask 500ml Silver Insulated Bottle Wholesale',
        product_url: 'https://dir.indiamart.com/impcat/thermosteel-flask.html',
        price_inr: 412,
        unit: 'Piece',
        moq: 20,
        supplier_name: 'Milton Traders',
        supplier_url: 'https://miltontraders.indiamart.com',
        location: 'Delhi',
        supplier_rating: '4.2',
        supplier_type: 'Distributor',
        nature_of_business: 'Authorised distributor of insulated ware',
        years_in_business: '8',
        gst_verified: true,
        trust_seal: true,
        detail: {
          brand: 'Milton',
          hsn: '96170019',
          mrp: 1150,
          manufacturer: 'Hamilton Housewares Pvt Ltd, Mumbai',
          country_of_origin: 'India',
          net_quantity: '500ml',
          customer_care: 'customercare@hamiltonhousewares.com',
          month_year_mfg: '06/2025',
          weight_grams: 440,
          pack_quantity: 1,
          colour: 'silver',
          material: 'stainless steel',
          capacity: '500ml',
          description:
            'Double-walled vacuum insulated thermosteel flask, keeps beverages hot 12h / cold 24h, flip lid with secure lock. Distributed in wholesale lots of 20.',
        },
      },
      {
        product_name: 'SS Clip Lock Lunch Box 2 Container 600ml Airtight Blue School Tiffin',
        product_url: 'https://dir.indiamart.com/impcat/clip-lock-lunch-box.html',
        price_inr: 240,
        unit: 'Piece',
        moq: 50,
        supplier_name: 'Shreeji Steelware',
        supplier_url: 'https://shreejisteelware.indiamart.com',
        location: 'Rajkot, Gujarat',
        supplier_rating: '4.5',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Manufacturer and wholesaler',
        years_in_business: '3',
        gst_verified: true,
        trust_seal: false,
        detail: {
          brand: 'Shreeji',
          hsn: '73239310',
          mrp: 625,
          manufacturer: 'Shreeji Steelware, Street 7, Aji GIDC, Rajkot 360003',
          country_of_origin: 'India',
          net_quantity: '600ml x 2 containers',
          customer_care: '+91 98250 11223',
          month_year_mfg: '07/2025',
          weight_grams: 380,
          pack_quantity: 1,
          colour: 'blue',
          material: 'stainless steel',
          capacity: '600ml',
          description:
            'Clip-lock airtight two-tier lunch box in 600ml, powder-coated body, school-friendly design. Bulk rates for 50+ pieces.',
        },
      },
      {
        product_name: 'Plastic Storage Container Set 5 Pcs Kitchen Multipurpose Boxes Wholesale',
        product_url: 'https://dir.indiamart.com/impcat/plastic-storage-container.html',
        price_inr: 95,
        unit: 'Set',
        moq: 100,
        supplier_name: 'XYZ Plastics',
        supplier_url: 'https://xyzplastics.indiamart.com',
        location: 'Jaipur, Rajasthan',
        supplier_rating: '3.1',
        supplier_type: 'Trader',
        nature_of_business: 'Trader of plastic household items',
        years_in_business: '1',
        gst_verified: false,
        trust_seal: false,
        detail: {
          brand: '',
          hsn: '39241090',
          weight_grams: 620,
          pack_quantity: 5,
          colour: 'multicolour',
          material: 'pp plastic',
          description: 'Assorted plastic kitchen storage containers, 5 piece set. Loose packaging, no branded MRP sticker.',
        },
        // NOTE: no MRP / manufacturer / country_of_origin / net_quantity → Legal Metrology gate will block listing.
      },
    ],
  },
  {
    keys: ['water bottle', 'bottle', 'flask'],
    items: [
      {
        product_name: 'Stainless Steel Water Bottle 1 Litre Fridge Bottle Set of 2 Silver',
        product_url: 'https://dir.indiamart.com/impcat/ss-water-bottle.html',
        price_inr: 165,
        unit: 'Piece',
        moq: 48,
        supplier_name: 'Ansh Houseware',
        supplier_url: 'https://anshhouseware.indiamart.com',
        location: 'Moradabad, Uttar Pradesh',
        supplier_rating: '4.4',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Manufacturer of stainless steel bottles',
        years_in_business: '4',
        gst_verified: true,
        trust_seal: true,
        detail: {
          brand: 'Ansh',
          hsn: '73239310',
          mrp: 599,
          manufacturer: 'Ansh Houseware, Pakbara Road, Moradabad 244001',
          country_of_origin: 'India',
          net_quantity: '1 litre x 2 bottles',
          customer_care: 'support@anshhouseware.in',
          month_year_mfg: '09/2025',
          weight_grams: 560,
          pack_quantity: 2,
          colour: 'silver',
          material: 'stainless steel',
          capacity: '1 litre',
          description:
            'Single-wall stainless steel fridge bottles, 1 litre each, screw cap, set of 2. Laser-etched branding available above 500 pieces.',
        },
      },
      {
        product_name: 'Copper Water Bottle 1000ml Hammered Ayurvedic Tamra Jal Vessel',
        product_url: 'https://dir.indiamart.com/impcat/copper-water-bottle.html',
        price_inr: 320,
        unit: 'Piece',
        moq: 30,
        supplier_name: 'Tamra Crafts',
        supplier_url: 'https://tamracrafts.indiamart.com',
        location: 'Jodhpur, Rajasthan',
        supplier_rating: '4.6',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Handicraft copperware manufacturer',
        years_in_business: '6',
        gst_verified: true,
        trust_seal: true,
        detail: {
          brand: 'Tamra',
          hsn: '74198090',
          mrp: 999,
          manufacturer: 'Tamra Crafts, Basni Industrial Area, Jodhpur 342005',
          country_of_origin: 'India',
          net_quantity: '1000ml',
          customer_care: 'hello@tamracrafts.com',
          month_year_mfg: '05/2025',
          weight_grams: 380,
          pack_quantity: 1,
          colour: 'copper',
          material: 'copper',
          capacity: '1000ml',
          description:
            'Pure copper hammered water bottle, 1000ml, ayurvedic tamra jal storage, leak-proof threaded cap. Gift-box packaging optional.',
        },
      },
      {
        product_name: 'Plastic Water Bottle 500ml Assorted Colors Bulk Lot No Brand',
        product_url: 'https://dir.indiamart.com/impcat/plastic-water-bottle.html',
        price_inr: 38,
        unit: 'Piece',
        moq: 200,
        supplier_name: 'Ganesh Polymers',
        supplier_url: 'https://ganeshpolymers.indiamart.com',
        location: 'Indore, Madhya Pradesh',
        supplier_rating: '3.4',
        supplier_type: 'Trader',
        nature_of_business: 'Trader',
        years_in_business: '2',
        gst_verified: false,
        trust_seal: false,
        detail: {
          hsn: '39233010',
          weight_grams: 80,
          pack_quantity: 1,
          colour: 'assorted',
          material: 'pet plastic',
          capacity: '500ml',
          description: 'Unbranded PET bottles, assorted colours, loose lots.',
        },
      },
    ],
  },
  {
    keys: ['yoga mat', 'yoga', 'exercise mat'],
    items: [
      {
        product_name: 'Extra Thick Yoga Mat 13mm Anti Skid with Carrying Strap Purple',
        product_url: 'https://dir.indiamart.com/impcat/yoga-mat.html',
        price_inr: 385,
        unit: 'Piece',
        moq: 25,
        supplier_name: 'ZenFit Exports',
        supplier_url: 'https://zenfit.indiamart.com',
        location: 'Noida, Uttar Pradesh',
        supplier_rating: '4.7',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Fitness gear manufacturer and exporter',
        years_in_business: '7',
        gst_verified: true,
        trust_seal: true,
        detail: {
          brand: 'ZenFit',
          hsn: '95069110',
          mrp: 1199,
          manufacturer: 'ZenFit Exports, Sector 63, Noida 201301',
          country_of_origin: 'India',
          net_quantity: '1 yoga mat 13mm x 610mm x 1730mm',
          customer_care: 'care@zenfit.in',
          month_year_mfg: '08/2025',
          weight_grams: 1100,
          pack_quantity: 1,
          colour: 'purple',
          material: 'eva foam',
          description:
            '13mm high-density EVA yoga mat, anti-skid texture on both sides, includes carrying strap. Ideal for home workouts and physio.',
        },
      },
      {
        product_name: 'TPE Yoga Mat 6mm Dual Tone Eco Friendly Non Slip Alignment Lines',
        product_url: 'https://dir.indiamart.com/impcat/tpe-yoga-mat.html',
        price_inr: 520,
        unit: 'Piece',
        moq: 20,
        supplier_name: 'Prana Sports',
        supplier_url: 'https://pranasports.indiamart.com',
        location: 'Rishikesh, Uttarakhand',
        supplier_rating: '4.3',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Yoga products manufacturer',
        years_in_business: '2',
        gst_verified: true,
        trust_seal: false,
        detail: {
          brand: 'Prana',
          hsn: '95069110',
          mrp: 1499,
          manufacturer: 'Prana Sports, Rishikesh 249201',
          country_of_origin: 'India',
          net_quantity: '1 mat 6mm x 610mm x 1830mm',
          customer_care: 'info@pranasports.in',
          month_year_mfg: '07/2025',
          weight_grams: 900,
          pack_quantity: 1,
          colour: 'dual tone teal',
          material: 'tpe',
          description: 'Dual-tone TPE mat with alignment lines, closed-cell, odourless, 6mm.',
        },
      },
    ],
  },
  {
    keys: ['storage container', 'kitchen container', 'airtight'],
    items: [
      {
        product_name: 'Airtight Kitchen Storage Container Set of 6 Plastic 1.1L Modular Clear',
        product_url: 'https://dir.indiamart.com/impcat/kitchen-storage-container.html',
        price_inr: 340,
        unit: 'Set',
        moq: 40,
        supplier_name: 'Perfect Polywares',
        supplier_url: 'https://perfectpolywares.indiamart.com',
        location: 'Daman, Daman & Diu',
        supplier_rating: '4.5',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Injection moulding houseware manufacturer',
        years_in_business: '9',
        gst_verified: true,
        trust_seal: true,
        detail: {
          brand: 'Perfect',
          hsn: '39241020',
          mrp: 899,
          manufacturer: 'Perfect Polywares, Daman 396210',
          country_of_origin: 'India',
          net_quantity: '6 containers x 1.1L',
          customer_care: 'sales@perfectpolywares.com',
          month_year_mfg: '06/2025',
          weight_grams: 900,
          pack_quantity: 6,
          colour: 'clear',
          material: 'food-grade pp',
          capacity: '1.1L',
          description:
            'Modular stackable airtight containers, six-piece 1.1L set, food-grade polypropylene, silicone-sealed lids.',
        },
      },
      {
        product_name: 'Plastic Storage Boxes Multipurpose 750ml 5 Pc Unbranded Bulk',
        product_url: 'https://dir.indiamart.com/impcat/plastic-storage-boxes.html',
        price_inr: 110,
        unit: 'Set',
        moq: 100,
        supplier_name: 'XYZ Plastics',
        supplier_url: 'https://xyzplastics.indiamart.com',
        location: 'Jaipur, Rajasthan',
        supplier_rating: '3.1',
        supplier_type: 'Trader',
        nature_of_business: 'Trader of plastic household items',
        years_in_business: '1',
        gst_verified: false,
        trust_seal: false,
        detail: {
          hsn: '39241090',
          weight_grams: 620,
          pack_quantity: 5,
          material: 'pp plastic',
          description: 'Unbranded storage boxes, loose cartons.',
        },
      },
    ],
  },
  {
    keys: ['led bulb', 'led light', 'bulb'],
    items: [
      {
        product_name: '9W LED Bulb B22 Cool Day Light Pack of 4 BIS Certified',
        product_url: 'https://dir.indiamart.com/impcat/led-bulb.html',
        price_inr: 168,
        unit: 'Pack',
        moq: 100,
        supplier_name: 'Voltarc Electronics',
        supplier_url: 'https://voltarc.indiamart.com',
        location: 'Noida, Uttar Pradesh',
        supplier_rating: '4.6',
        supplier_type: 'Manufacturer',
        nature_of_business: 'LED lighting manufacturer',
        years_in_business: '5',
        gst_verified: true,
        trust_seal: true,
        detail: {
          brand: 'Voltarc',
          hsn: '94054090',
          mrp: 649,
          manufacturer: 'Voltarc Electronics, Sector 59, Noida 201309',
          country_of_origin: 'India',
          net_quantity: '4 bulbs x 9W',
          customer_care: 'service@voltarc.in',
          month_year_mfg: '09/2025',
          weight_grams: 260,
          pack_quantity: 4,
          watt: '9W',
          colour: 'cool daylight',
          description: 'B22 9W LED bulbs, 810 lumen, 4-pack, BIS certified driver, 2-year replacement warranty.',
        },
      },
    ],
  },
  {
    keys: ['t shirt', 'tshirt', 'shirt', 'apparel'],
    items: [
      {
        product_name: 'Mens Cotton Blend Round Neck T Shirt Pack of 3 Solid Colors Wholesale',
        product_url: 'https://dir.indiamart.com/impcat/mens-t-shirt.html',
        price_inr: 330,
        unit: 'Set',
        moq: 50,
        supplier_name: 'Tirupur Garments Co',
        supplier_url: 'https://tirupurgarments.indiamart.com',
        location: 'Tiruppur, Tamil Nadu',
        supplier_rating: '4.5',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Knitwear manufacturer and exporter',
        years_in_business: '11',
        gst_verified: true,
        trust_seal: true,
        detail: {
          brand: 'Tirupur Basics',
          hsn: '61091090',
          mrp: 1199,
          manufacturer: 'Tirupur Garments Co, Avinashi Road, Tiruppur 641603',
          country_of_origin: 'India',
          net_quantity: '3 t-shirts',
          customer_care: 'orders@tirupurbasics.com',
          month_year_mfg: '09/2025',
          weight_grams: 520,
          pack_quantity: 3,
          colour: 'mixed solid',
          material: 'cotton blend',
          description: '180 GSM combed cotton blend round neck tees, sizes S-XXL mixed, pre-shrunk, pack of 3.',
        },
      },
      {
        product_name: 'Womens Rayon Kurta Palazzo Set Ethnic Wear Teal Bulk Order',
        product_url: 'https://dir.indiamart.com/impcat/kurta-set.html',
        price_inr: 425,
        unit: 'Set',
        moq: 30,
        supplier_name: 'Jaipur Rathi Fabrics',
        supplier_url: 'https://rathifabrics.indiamart.com',
        location: 'Jaipur, Rajasthan',
        supplier_rating: '4.2',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Ethnic wear manufacturer',
        years_in_business: '6',
        gst_verified: true,
        trust_seal: false,
        detail: {
          brand: 'Anouk',
          hsn: '62114300',
          mrp: 1499,
          manufacturer: 'Rathi Fabrics, Sanganer, Jaipur 302029',
          country_of_origin: 'India',
          net_quantity: '1 kurta + 1 palazzo',
          customer_care: 'care@rathifabrics.in',
          month_year_mfg: '07/2025',
          weight_grams: 480,
          pack_quantity: 1,
          colour: 'teal',
          material: 'rayon',
          description: 'Rayon straight kurta with matching palazzo, screen printed, sizes M-3XL, teal.',
        },
      },
    ],
  },
  {
    keys: ['resistance band', 'fitness band', 'exercise band'],
    items: [
      {
        product_name: 'Latex Resistance Band Set of 5 Loop Bands with Door Anchor Carry Pouch',
        product_url: 'https://dir.indiamart.com/impcat/resistance-band.html',
        price_inr: 145,
        unit: 'Set',
        moq: 60,
        supplier_name: 'ZenFit Exports',
        supplier_url: 'https://zenfit.indiamart.com',
        location: 'Noida, Uttar Pradesh',
        supplier_rating: '4.7',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Fitness gear manufacturer and exporter',
        years_in_business: '7',
        gst_verified: true,
        trust_seal: true,
        detail: {
          brand: 'ZenFit',
          hsn: '95069190',
          mrp: 599,
          manufacturer: 'ZenFit Exports, Sector 63, Noida 201301',
          country_of_origin: 'India',
          net_quantity: '5 bands + door anchor + pouch',
          customer_care: 'care@zenfit.in',
          month_year_mfg: '08/2025',
          weight_grams: 420,
          pack_quantity: 7,
          material: 'latex',
          description: 'Five latex loop bands 10-50 lb, door anchor, ankle straps and mesh carry pouch included.',
        },
      },
    ],
  },
  {
    keys: ['notebook', 'diary', 'stationery'],
    items: [
      {
        product_name: 'School Notebook 172 Pages Single Line 21x29.7cm Pack of 6 Wholesale',
        product_url: 'https://dir.indiamart.com/impcat/school-notebook.html',
        price_inr: 178,
        unit: 'Pack',
        moq: 80,
        supplier_name: 'Sahara Paper Mills',
        supplier_url: 'https://saharapaper.indiamart.com',
        location: 'Muzaffarnagar, Uttar Pradesh',
        supplier_rating: '4.3',
        supplier_type: 'Manufacturer',
        nature_of_business: 'Paper stationery manufacturer',
        years_in_business: '12',
        gst_verified: true,
        trust_seal: true,
        detail: {
          brand: 'Sahara',
          hsn: '48202000',
          mrp: 420,
          manufacturer: 'Sahara Paper Mills, Industrial Estate, Muzaffarnagar 251001',
          country_of_origin: 'India',
          net_quantity: '6 notebooks x 172 pages',
          customer_care: 'info@saharapaper.in',
          month_year_mfg: '10/2025',
          weight_grams: 1500,
          pack_quantity: 6,
          pages: '172',
          description: 'Single-line ruled notebooks, 70 GSM paper, soft cover, six-pack.',
        },
      },
    ],
  },
];

// ── Generic generator for arbitrary queries ──
function generateGenericItems(query: string): IndiaMartRawItem[] {
  const seed = Array.from(query).reduce((a, c) => a + c.charCodeAt(0), 0);
  const cap = query.replace(/\b\w/g, (c) => c.toUpperCase());
  const basePrice = 120 + (seed % 280);
  const makers = [
    { name: 'Balaji Trading Co', city: 'Surat, Gujarat', type: 'Trader', yrs: '3', rating: '3.8', gst: false },
    { name: 'National Handicrafts Hub', city: 'Jodhpur, Rajasthan', type: 'Manufacturer', yrs: '6', rating: '4.4', gst: true },
    { name: 'Metro Wholesale Depot', city: 'Chennai, Tamil Nadu', type: 'Distributor', yrs: '9', rating: '4.1', gst: true },
  ];
  return makers.map((m, i) => ({
    product_name: `${cap} — Wholesale Bulk Supply ${['Standard Grade', 'Premium Finish', 'Export Quality'][i]}`,
    product_url: `https://dir.indiamart.com/impcat/${encodeURIComponent(query.replace(/\s+/g, '-'))}.html`,
    price_inr: basePrice + i * 65,
    unit: 'Piece',
    moq: 25 + i * 25,
    supplier_name: m.name,
    supplier_url: `https://${m.name.toLowerCase().replace(/[^a-z]/g, '')}.indiamart.com`,
    location: m.city,
    supplier_rating: m.rating,
    supplier_type: m.type,
    nature_of_business: `${m.type} of ${query}`,
    years_in_business: m.yrs,
    gst_verified: m.gst,
    trust_seal: m.gst && i !== 0,
    detail: {
      hsn: '63079019',
      weight_grams: 300 + i * 150,
      pack_quantity: 1,
      material: 'mixed',
      description: `${cap} supplied in bulk lots. Ask supplier for MRP label, brand and packaging details.`,
    },
  }));
}

function findDataset(query: string): IndiaMartRawItem[] {
  const q = query.toLowerCase();
  const direct = DATASET.find((d) => d.keys.some((k) => q.includes(k) || k.includes(q)));
  if (direct) return direct.items;
  // token-level fallback
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  for (const d of DATASET) {
    if (d.keys.some((k) => tokens.some((t) => k.includes(t)))) return d.items;
  }
  return generateGenericItems(query);
}

// ── Public provider API ──

export async function searchIndiaMart(
  query: string,
  opts: { gstVerifiedOnly?: boolean; maxResults?: number } = {}
): Promise<{ results: IndiaMartSearchResult[]; provider: string }> {
  // Token resolution: admin-dashboard config (DB) first, then environment.
  const { getApifyConfig } = await import('./apify-config');
  const apify = await getApifyConfig();
  const token = apify.enabled ? apify.token : null;
  if (token) {
    try {
      return { ...(await apifySearch(query, token, opts, apify.actorId ?? undefined)), provider: 'apify' };
    } catch {
      // fall through to demo dataset
    }
  }
  let items = findDataset(query);
  if (opts.gstVerifiedOnly) items = items.filter((i) => i.gst_verified);
  items = items.slice(0, opts.maxResults ?? 10);
  return {
    results: items.map((raw) => ({
      searchQuery: query,
      productName: raw.product_name,
      productUrl: raw.product_url,
      priceInr: raw.price_inr,
      unit: raw.unit,
      moq: raw.moq,
      supplierName: raw.supplier_name,
      supplierUrl: raw.supplier_url ?? '',
      location: raw.location,
      supplierRating: raw.supplier_rating ? parseFloat(raw.supplier_rating) : undefined,
      supplierType: raw.supplier_type,
      natureOfBusiness: raw.nature_of_business,
      yearsInBusiness: raw.years_in_business ? parseInt(raw.years_in_business, 10) : undefined,
      gstVerified: raw.gst_verified,
      trustSeal: raw.trust_seal ?? false,
      raw,
    })),
    provider: 'apify-mock',
  };
}

async function apifySearch(
  query: string,
  token: string,
  opts: { gstVerifiedOnly?: boolean; maxResults?: number },
  actorIdOverride?: string
): Promise<{ results: IndiaMartSearchResult[] }> {
  // Actor is configurable via the admin dashboard (DB) or APIFY_ACTOR_ID
  // (default: the IndiaMART supplier/product scraper). Runs synchronously and
  // returns dataset items.
  const actorId = actorIdOverride ?? process.env.APIFY_ACTOR_ID ?? 'thirdwatch~indiamart-supplier-scraper';
  const res = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=45`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerms: [query], maxResults: opts.maxResults ?? 10, fetchDetails: true }),
      signal: AbortSignal.timeout(50000),
    }
  );
  if (!res.ok) throw new Error(`Apify returned ${res.status}`);
  const items = (await res.json()) as Array<Record<string, unknown>>;

  // Real actors vary in field naming — normalize both snake_case and camelCase.
  const pick = (o: Record<string, unknown>, ...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = o[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return undefined;
  };
  const num = (v: string | undefined): number | undefined => {
    if (!v) return undefined;
    const m = v.replace(/[^0-9.]/g, '');
    return m ? parseFloat(m) : undefined;
  };

  let mapped = items
    .map((o) => {
      const productName = pick(o, 'product_name', 'productName', 'title', 'name') ?? '';
      const priceRaw = pick(o, 'price_inr', 'priceInr', 'price', 'min_price');
      const priceInr = num(priceRaw) ?? 0;
      const raw: IndiaMartRawItem = {
        product_name: productName,
        product_url: pick(o, 'product_url', 'productUrl', 'url', 'link') ?? '',
        price_inr: priceInr,
        unit: pick(o, 'unit', 'price_unit') ?? 'Piece',
        moq: num(pick(o, 'moq', 'min_order_quantity', 'minimum_order_quantity')),
        supplier_name: pick(o, 'supplier_name', 'supplierName', 'company', 'seller_name') ?? 'Unknown supplier',
        supplier_url: pick(o, 'supplier_url', 'supplierUrl', 'seller_url'),
        location: pick(o, 'location', 'city', 'supplier_location', 'address') ?? '',
        supplier_rating: pick(o, 'supplier_rating', 'supplierRating', 'rating'),
        supplier_type: pick(o, 'supplier_type', 'supplierType', 'business_type'),
        nature_of_business: pick(o, 'nature_of_business', 'natureOfBusiness'),
        years_in_business: pick(o, 'years_in_business', 'yearsInBusiness', 'experience'),
        gst_verified: Boolean(o.gst_verified ?? o.gstVerified ?? o.gst),
        trust_seal: Boolean(o.trust_seal ?? o.trustSeal),
      };
      return { searchQuery: query, productName, productUrl: raw.product_url, priceInr, unit: raw.unit, moq: raw.moq, supplierName: raw.supplier_name, supplierUrl: raw.supplier_url ?? '', location: raw.location, supplierRating: raw.supplier_rating ? parseFloat(raw.supplier_rating) : undefined, supplierType: raw.supplier_type, natureOfBusiness: raw.nature_of_business, yearsInBusiness: raw.years_in_business ? parseInt(raw.years_in_business, 10) : undefined, gstVerified: raw.gst_verified, trustSeal: Boolean(raw.trust_seal), raw };
    })
    .filter((m) => m.productName && m.priceInr > 0);
  if (opts.gstVerifiedOnly) mapped = mapped.filter((m) => m.gstVerified);
  return { results: mapped };
}
