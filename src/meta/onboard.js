// F8: first-time guide (5 steps), farm-side daily streak, "while you were away" summary.
import { save, persist, dailyStatus, claimDaily, addGems } from './save.js';
import { CROPS, SEEDS } from './crops.js';
import { PRODUCTS, isReady } from './produce.js';
import { owns } from './farm.js';
import { gameNow } from './clock.js'; // F356: süreler oyun saatiyle

export const FTUE = [
  { id: 'play', text: '👆 İlk bölümü oyna, yıldız kazan' },
  { id: 'reward', text: '✨ Kazandıkların çiftliğe uçuyor!' },
  { id: 'coop', text: '👆 Kümese dokun, yıldızla satın al' },
  { id: 'plant', text: '👆 Tarla al ve ek, ürün zamanla büyür' },
  { id: 'pet', text: '👆 Bir hayvana dokun, onu sev' },
];
// Existing players (already past level 3 or owning the coop) skip the guide.
// F385 (uygulamadaki F205): yalnız rehber kaydı ilk kurulurken (atlanınca skipped yazılır); yeni oyuncu 1-3'ü 'Sonraki'
// ile geçip çiftliğe 4. seviyede dönünce rehberi kaybetmesin
const st = () => {
  const f = (save.farm.ftue = save.farm.ftue || {});
  if (f.i == null) { const old = save.level > 3 || owns('kumes'); f.i = old ? FTUE.length : 0; if (old) f.skipped = true; persist(); }
  return f;
};
export function ftueCurrent() {
  return FTUE[st().i] || null;
}
export function ftueDone(id) {
  const cur = ftueCurrent();
  if (!cur || cur.id !== id) return false;
  st().i++; persist(); return true;
}

// Daily: 7th day of a streak also gives a gem.
export function farmDaily() { return dailyStatus(); }
export function farmClaimDaily(now = gameNow()) { // F356: durum ve alım aynı oyun saati anıyla
  const s = dailyStatus(now); if (!s.available) return null;
  const coins = claimDaily(now); const gems = s.streak === 6 ? 1 : 0; // F361 (uygulamadaki F78): 💎 + 🔨 claimDaily içinde verilir
  return { coins, gems, streak: s.streak + 1 };
}

// Away summary: what finished since the last session (min 10 min away).
export function awaySummary(now = gameNow()) {
  const last = save.lastSeen || 0;
  save.lastSeen = now; persist();
  if (!last || now - last < 10 * 60000) return null;
  const crops = save.farm.crops || {}; const lines = [];
  for (const [id, c] of Object.entries(crops)) if (c.readyAt > last && c.readyAt <= now) CROPS[id] && lines.push(`${(SEEDS[c.seed] || CROPS[id]).emoji} hasat hazır`);
  const prod = (save.farm.prod || {});
  for (const id in PRODUCTS) if (prod[id] > last && isReady(id, now)) lines.push(`${PRODUCTS[id].emoji || '📦'} ürün toplanmayı bekliyor`);
  const h = Math.floor((now - last) / 3600000), m = Math.floor((now - last) / 60000) % 60;
  return { away: h ? `${h} sa ${m} dk` : `${m} dk`, lines };
}
export function touchSeen() { save.lastSeen = gameNow(); persist(); }
