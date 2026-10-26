// F356 (uygulamadaki F298): oyun saati = cihaz saati + sunucu farkı. Bilgisayar/telefon saati ileri alınınca
// can, enerji, ekin ve diğer süreler erken dolmasın:
// - Sunucu yanıtlarının Date başlığından fark öğrenilir; 2 dakikayı aşan fark düzeltilir, küçüğüne dokunulmaz.
// - Oturum içinde cihaz saati performance.now()'dan 5 sn'den fazla ayrılırsa (saat ayarı, uyku) sıçrama sayılmaz;
//   sunucuya hemen sorulur, gelen yanıt düzeltir.
// - Oyun saati geri gitmez: saklanan en yüksek değerin altına inmez.
// save.js/analytics.js'i içe aktarmaz (döngü olmasın); sunucuya soran işlevi save.js onClockJump ile verir.
const KEY = 'gemcrush.clock.v1';
export const CLOCK_SLACK = 120000;
const JUMP = 5000;
const pnow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
let off = 0, hw = 0, saved = 0, ld = 0, lp = 0, onJump = null;
try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c) { off = Math.abs(+c.off || 0) > CLOCK_SLACK ? +c.off : 0; hw = saved = +c.hw || 0; } } catch {}
const keep = () => { saved = hw; try { localStorage.setItem(KEY, JSON.stringify({ off, hw })); } catch {} };
export const onClockJump = (f) => { onJump = f; };
export function gameNow() {
  const d = Date.now(), p = pnow();
  let j = false;
  if (ld && Math.abs(d - ld - (p - lp)) > JUMP) { off += ld - d + (p - lp); j = true; } // sıçramayı sayma
  ld = d; lp = p;
  const g = Math.max(d + off, hw);
  hw = g;
  if (j || hw - saved >= 30000) keep();
  if (j && onJump) setTimeout(onJump, 0);
  return g;
}
// oyun saatindeki bir anın cihaz saatindeki karşılığı (işletim sistemi bildirimleri cihaz saatiyle çalar)
export const deviceMs = (g) => g - (gameNow() - Date.now());
// sunucu yanıtının Date başlığı (her RPC'den sonra)
export function learnServerTime(h) {
  const s = h ? Date.parse(h) : NaN;
  if (!Number.isFinite(s)) return;
  const d = Date.now(), n = Math.abs(s - d) > CLOCK_SLACK ? s - d : 0;
  ld = d; lp = pnow();
  const top = hw > s + CLOCK_SLACK; if (top) hw = s; // saklanan en yüksek değer sunucu saatini aşamaz: saati ileri alınmış açılışta yazılan değer oyun saatini dondurmasın
  if (!top && Math.abs(n - off) < 30000) return; // Date başlığı saniye hassasiyetinde; küçük oynamada kaydetme
  off = n; keep();
}
