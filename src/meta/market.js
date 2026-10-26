// F38: oyuncular arası pazar — fiyat son 24 saatin arz/talebiyle oynar (sunucu: gc_market_*)
// İlan verirken mal hemen ambardan düşer; satılmazsa 48 saat sonra (ya da geri çekince) iade olur.
import { save, persist, addCoins, acctRpc, claimOnce } from './save.js';

export const FEE = 0.05, MAX_LISTINGS = 8;
export const band = (p) => [Math.floor(p * 0.8), Math.ceil(p * 1.25)];
export const bandOk = (p, x) => { const [a, b] = band(p); return x >= a && x <= b; };
export const idx = (sold, unsold) => Math.max(0.6, Math.min(1.6, 1 + 0.5 * (sold - unsold) / (sold + unsold + 6)));
export const trend = (i) => Math.round((i - 1) * 100); // +% / -%
const inv = () => ((save.farm = save.farm || {}).inv = save.farm.inv || {});

export const mktList = () => acctRpc('gc_market_list');

// F344 (uygulamadaki F190): ilan verme/geri çekme sürerken ikincisi yok — çift dokunuşta iki ilan açılıp ambardan iki kez mal düşüyordu
let posting = false;
export const mktPosting = () => posting;

// F344 (uygulamadaki F267): yanıt kaybolunca (ağ koptu, mesajsız 5xx) ilan sunucuda açılmış olabilir; malı ambara koymak
// ilanla birlikte çiftliyordu. Sunucu mesajla reddettiyse işlem geri alınmıştır → iade. Belirsizse sunucudaki ilan sayısı
// `mine` (çağıranın son gördüğü) ile karşılaştırılır: arttıysa ilan açılmış (başarı), artmadıysa iade; doğrulanamazsa iade yok.
export async function mktPost(good, n, price, mine = null) {
  if (posting) throw new Error('mesgul');
  const I = inv(); if ((I[good] || 0) < n) throw new Error('mal');
  posting = true; I[good] -= n; persist();
  try { return await acctRpc('gc_market_post', { p_good: good, p_n: n, p_price: price }); }
  catch (e) {
    const rejected = !!e.server || e.message === 'offline' || e.message === 'hesap';
    const now = rejected || mine == null ? null : await mineOf(good);
    if (now != null && now > mine) return { price };
    if (rejected || now != null) { I[good] = (I[good] || 0) + n; persist(); }
    throw e;
  } finally { posting = false; }
}
async function mineOf(good) {
  try { const L = await mktList(); const g = L && L.goods && L.goods[good]; return g ? (g.mine || 0) : null; } catch { return null; }
}

// F344 (uygulamadaki F135): alım sürerken ikinci alım yok — çift dokunuşta iki istek de tüm bakiyeyi p_max gönderiyordu
let buying = false;
export const mktBusy = () => buying;
// F344 (uygulamadaki F166): düğme en ucuz ilanı (birim fiyat × adet) gösteriyor; p_max tüm bakiye olunca sunucu daha
// pahalı bir ilanı da seçebiliyordu — birim fiyat ve toplam bedel düğmedekiyle sınırlı
export async function mktBuy(good, unit = null, maxN = null) {
  if (buying) throw new Error('mesgul');
  buying = true;
  try {
    const coins = save.coins || 0, cap = unit != null && maxN > 0 ? Math.min(coins, unit * maxN) : coins;
    const r = await acctRpc('gc_market_buy', unit != null ? { p_good: good, p_max: cap, p_unit: unit } : { p_good: good, p_max: cap });
    applyBuy(r); return r;
  } finally { buying = false; }
}
// F344 (uygulamadaki F135): bakiye yetmiyorsa 0'a kırpıp malı vermek yok — alım reddedilir
export function applyBuy(r) {
  if ((save.coins || 0) < r.cost) throw new Error('yok');
  save.coins = (save.coins || 0) - r.cost; const I = inv(); I[r.good] = (I[r.good] || 0) + r.n; persist();
}
export async function mktClaim(cancel = false) {
  if (cancel) { if (posting) throw new Error('mesgul'); posting = true; } // F344: geri çekme de ilan kilidini tutar
  try { const r = await claimOnce('gc_market_claim', { p_cancel: cancel }, `gc_market_claim:${cancel}`); applyClaim(r); return r; } // F408
  finally { if (cancel) posting = false; }
}
export function applyClaim(r) {
  if (!r) return r; const I = inv(); let n = 0;
  for (const [g, k] of Object.entries(r.back || {})) { I[g] = (I[g] || 0) + k; n += k; }
  if (r.coins) addCoins(r.coins); else if (n) persist();
  return r;
}
