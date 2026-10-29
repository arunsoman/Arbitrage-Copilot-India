// ─── Deterministic market signals (price history, competition) ───────────────
// Seeded pseudo-random from the ASIN so results are stable across calls.
// In production these come from the SP-API Pricing role snapshots (cached).

import { MarketSignals, PriceHistoryPoint } from './types';

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededFloat(seed: number, salt: number): number {
  const x = Math.sin(seed * 9301 + salt * 49297) * 233280;
  return x - Math.floor(x);
}

export function getMarketSignals(asin: string, currentPrice: number): MarketSignals {
  const seed = hashCode(asin);
  const history: PriceHistoryPoint[] = [];
  const baseDrift = (seededFloat(seed, 1) - 0.45) * 0.18; // -8.1% .. +9.9% drift
  const vol = 0.012 + seededFloat(seed, 2) * 0.02;

  for (let day = 30; day >= 0; day--) {
    const progress = (30 - day) / 30;
    const trend = 1 + baseDrift * progress;
    const noise = (seededFloat(seed, day + 10) - 0.5) * 2 * vol;
    history.push({
      day,
      price: Math.round(currentPrice * trend * (1 + noise)),
    });
  }
  history[history.length - 1].price = Math.round(currentPrice);

  const first = history[0].price;
  const last = history[history.length - 1].price;
  const trend30dPct = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0;

  const sellers = 5 + Math.floor(seededFloat(seed, 3) * 30);
  const cutterBias = baseDrift < -0.03 ? 3 : seededFloat(seed, 4) < 0.5 ? 0 : 1;
  const priceCutters7d = Math.min(
    5,
    Math.floor(seededFloat(seed, 5) * 3) + cutterBias
  );

  return { history, trend30dPct, sellers, priceCutters7d };
}
