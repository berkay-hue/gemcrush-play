// F30: üretim zinciri — buğday → değirmen → un → fırın (+yumurta) → ekmek → sipariş/pazar.
import { save, persist } from './save.js';
import { owns } from './farm.js';
import { inventory, stash, ambarFull } from './produce.js';

const M = 60000;
export const CHAIN = {
  degirmen: { in: { wheat: 2 }, out: 'flour', ms: 20 * M },
  firin: { in: { flour: 1, egg: 1 }, out: 'bread', ms: 40 * M },
};
const C = () => { const f = save.farm; if (!f.chain || typeof f.chain !== 'object') f.chain = {}; return f.chain; };

// 'none' (bina yok) | 'idle' | 'busy' | 'ready'
export function state(id, now = Date.now()) {
  if (!CHAIN[id] || !owns(id)) return 'none';
  const j = C()[id]; if (!j || !j.until) return 'idle';
  return now >= j.until ? 'ready' : 'busy';
}
export const msLeft = (id, now = Date.now()) => Math.max(0, ((C()[id] || {}).until || 0) - now);
export const progress = (id, now = Date.now()) => (state(id, now) === 'busy' ? 1 - msLeft(id, now) / CHAIN[id].ms : state(id, now) === 'ready' ? 1 : 0);
export const missing = (id) => Object.entries(CHAIN[id].in).filter(([g, n]) => (inventory()[g] || 0) < n).map(([g]) => g);
export const canStart = (id, now = Date.now()) => state(id, now) === 'idle' && !missing(id).length;
export function start(id, now = Date.now()) {
  if (!canStart(id, now)) return false;
  const inv = inventory(); for (const [g, n] of Object.entries(CHAIN[id].in)) inv[g] -= n;
  C()[id] = { until: now + CHAIN[id].ms }; persist(); return true;
}
// hazır ürünü ambara alır; ambar doluysa null
export function collectChain(id, now = Date.now()) {
  if (state(id, now) !== 'ready' || ambarFull()) return null;
  if (!stash(CHAIN[id].out, 1)) return null;
  delete C()[id]; persist(); return CHAIN[id].out;
}
export const anyReady = (now = Date.now()) => Object.keys(CHAIN).some((id) => state(id, now) === 'ready');
