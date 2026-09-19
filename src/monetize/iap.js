// In-app purchases. Native: cordova-plugin-purchase (CdvPurchase) via Capacitor.
// Web/dev: simulated purchase (grants immediately) so the shop flow is testable.
import { CONFIG } from '../config.js';
import { save, addCoins, addGems, persist } from '../meta/save.js';
import { track } from '../analytics.js';

let store = null;
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

export async function initIap() {
  const CdvPurchase = window.CdvPurchase;
  if (!CdvPurchase) return; // web fallback
  store = CdvPurchase.store;
  const platform = CdvPurchase.Platform[window.Capacitor?.getPlatform?.() === 'ios' ? 'APPLE_APPSTORE' : 'GOOGLE_PLAY'];
  for (const p of CONFIG.iap.products) {
    store.register({ id: p.id, type: p.removeAds || p.starter ? CdvPurchase.ProductType.NON_CONSUMABLE : CdvPurchase.ProductType.CONSUMABLE, platform });
  }
  store.when().approved((tx) => tx.verify()).verified((r) => { grant(r.productId); r.finish(); });
  await store.initialize([platform]);
}

function grant(productId) {
  const p = CONFIG.iap.products.find((x) => x.id === productId);
  if (!p) return;
  if (p.removeAds) save.removeAds = true;
  if (p.starter) save.starterBought = true;
  if (p.lives) save.lives = Math.max(save.lives || 0, 0) + p.lives;
  if (p.coins) addCoins(p.coins);
  if (p.gems) addGems(p.gems);
  persist();
  track('purchase', { product: productId });
}

export function price(p) {
  if (store) { const prod = store.get(p.id); if (prod?.pricing?.price) return prod.pricing.price; }
  return p.priceLabel;
}

export async function buy(p) {
  track('purchase_start', { product: p.id });
  if (store) {
    const prod = store.get(p.id);
    if (!prod) return false;
    await prod.getOffer().order();
    return true; // grant happens via verified() callback
  }
  // F43: mobil uygulamada asla bedava/test satın alma yok — mağaza yüklenemediyse satın alma olmaz
  if (isNative()) return false;
  // web: simulate
  const ok = window.confirm(`[TEST] Buy ${p.id} for ${p.priceLabel}?`);
  if (ok) grant(p.id);
  return ok;
}

export async function restore() {
  if (store) { await store.restorePurchases(); return true; }
  return false;
}
