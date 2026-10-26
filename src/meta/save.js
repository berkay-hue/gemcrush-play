// Player state: localStorage, optional Supabase mirror.
import { CONFIG } from '../config.js';
import { getLang, setLang } from '../i18n.js'; // F333
import { gameNow, learnServerTime, onClockJump } from './clock.js'; // F356

const KEY = 'gemcrush.save.v1';
const def = () => ({
  deviceId: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2),
  level: 1,                       // highest unlocked
  stars: {},                      // levelId -> 0..3
  best: {},                       // levelId -> score
  coins: CONFIG.coins.start,
  lives: CONFIG.lives.max,
  lifeTs: gameNow(),              // timestamp of last life regen tick
  inLevel: 0,                     // oynanan bölüm (kapanırsa açılışta can düşülür)
  boosters: { hammer: 1, moves5: 1, shuffle: 1, prism: 0 },
  daily: { last: 0, streak: 0 },
  removeAds: false,
  sound: true,
  music: true,                    // F40: arka plan müziği
  lang: null,
  levelsPlayed: 0,
  tutorialDone: false,
  v: 2,                           // save schema version
  starsSpent: 0,
  profile: { name: '', avatar: '🧑‍🌾' },
  gems: 5,                        // Faz 5: hard currency (diamonds)                  // farm wallet: balance = totalStars() - starsSpent
  theme: 'meadow', themes: [],   // F4: satın alınan temalar
  farm: { owned: [], perks: {} }, // farm purchases (Faz 1) + derived perks (Faz 2)
  event: { week: -1, done: 0 },   // F14: hasat festivali ilerlemesi
  pass: { season: '', xp: 0, claimed: [] }, // F14: sezon yolu
});

export const save = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate({ ...def(), ...JSON.parse(raw) });
  } catch {}
  return def();
}

// v1 -> v2: farm wallet. Stars earned before v2 become spendable immediately.
function migrate(s) {
  const d = def();
  s.farm = { ...d.farm, ...(s.farm || {}) };
  s.farm.owned = Array.isArray(s.farm.owned) ? s.farm.owned : [];
  s.profile = { ...d.profile, ...(s.profile || {}) };
  if (typeof s.gems !== 'number' || s.gems < 0) s.gems = d.gems;
  if (typeof s.starsSpent !== 'number' || s.starsSpent < 0) s.starsSpent = 0;
  s.themes = Array.isArray(s.themes) ? s.themes.filter((x) => typeof x === 'string').slice(0, 20) : [];
  if (typeof s.theme !== 'string' || (s.theme !== 'meadow' && !s.themes.includes(s.theme))) s.theme = 'meadow';
  const e = s.event || {}; s.event = { week: Number.isInteger(e.week) ? e.week : -1, done: Number.isInteger(e.done) && e.done >= 0 && e.done <= 10 ? e.done : 0 };
  const p = s.pass || {}; s.pass = { season: typeof p.season === 'string' ? p.season : '', xp: typeof p.xp === 'number' && p.xp >= 0 ? Math.min(p.xp, 750) : 0, claimed: Array.isArray(p.claimed) ? p.claimed.filter((x) => Number.isInteger(x) && x >= 1 && x <= 30) : [] };
  s.v = 2;
  return s;
}

// ---- Kayıt alanı: profil + kayıt kodu (cihaz taşıma) + veri silme ----
// F308: sunucu da bu listeyi tutar (gc_ab_avatar, supabase/f308-avatar.sql); yeni avatar eklerken orayı da güncelle.
export const AVATARS = ['🧑‍🌾', '👩‍🌾', '👨‍🌾', '🐔', '🐄', '🐑', '🦊', '🐱'];
export function setProfile(p) { save.profile = { ...(save.profile || {}), ...p }; persist(); }
export function exportCode() {
  const b = new TextEncoder().encode(JSON.stringify(save));
  let bin = ''; b.forEach((x) => { bin += String.fromCharCode(x); });
  return 'GC1.' + btoa(bin);
}
function decodeCode(code) {
  try {
    const bin = atob(String(code).trim().replace(/^GC1\./, ''));
    const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return obj && typeof obj === 'object' && typeof obj.level === 'number' ? obj : null;
  } catch { return null; }
}
// F352 (uygulamadaki F146): kodun bölüm/altını, kayda dokunmadan (yüklemeden önce onay için)
export function peekCode(code) { const o = decodeCode(code); return o && { level: o.level, coins: typeof o.coins === 'number' ? o.coins : 0 }; }
// F352: kod tüm ilerlemenin (ve bulut kaydının) yerine geçer — önce ask(peek) onayı; geçersiz kod false, iptal null (kayıt aynen kalır)
export function loadCode(code, ask) { const pk = peekCode(code); if (!pk) return false; if (!ask(pk)) return null; return importCode(code); }
export function importCode(code) {
  try {
    const obj = decodeCode(code);
    if (!obj) return false;
    const next = migrate({ ...def(), ...obj });
    next.rev = rev(save); // F312: koddaki sürüm taşınmaz, sürüm geri de gitmez
    Object.keys(save).forEach((k) => delete save[k]); Object.assign(save, next); keepLang(); force++; persist(); return true;
  } catch { return false; }
}
// F339 (uygulamadaki F127 + F339): sunucu hesabı silmedikçe yerelde hiçbir şeye dokunma, silindi deme.
// Ağ/sunucu hatası → false, oturum ve kayıt durur (tekrar denenir). false dönerse token sunucuda yok (hesaba başka
// yerden girildi): hesap bulutta duruyor → oturum kapanır, kayıt durur; yeniden girip silinir.
export async function wipeAll() {
  const a = account();
  if (a) {
    let ok; try { ok = await rpc('gc_delete', { p_token: a.token }); } catch { return false; }
    if (ok !== true) { if ((account() || {}).token === a.token) setAccount(null); return false; }
    setAccount(null);
  }
  try { localStorage.removeItem(KEY); localStorage.removeItem(OKEY); localStorage.removeItem(LKEY); } catch {} // F369
  const next = def(); Object.keys(save).forEach((k) => delete save[k]); Object.assign(save, next); persist();
  return true;
}

// F312: base = bu sekmenin son eşleştiği bulut kopyası (sürüm:ilerleme:harcanan yıldız), bilinmiyorsa null.
// force > 0 = kod içe aktarıldı, içe aktarılanı taşıyan yazma bitene dek eşitleme karşılaştırmadan yazar. queue = eşitlemeler sırayla.
// unsent = bu hesabın son eşitlemesi düştü (çevrimdışı), değişiklik buluta gitmemiş olabilir (F334).
let syncTimer = null, base = null, force = 0, queue = Promise.resolve(), unsent = false;
// F312: kayıt sürümü (uygulamadaki F126 ile aynı) — ilerleme eşitken hangi tarafın yeni olduğunu ayırır.
// Web cihaz saatini kullanmaz (+1): uygulamanın sunucu saatli sürümünü geçip eski kaydı kazandıramaz.
const rev = (s) => (typeof s.rev === 'number' && s.rev > 0 ? s.rev : 0);
// starsSpent: sunucudaki gc_star_to_coin sürümü değiştirmeden yıldızı altına çevirir; bu da bulutun ilerlemesi sayılsın
const sig = (s) => rev(s) + ':' + progressScore(s) + ':' + (s.starsSpent || 0);
export function persist() {
  save.rev = rev(save) + 1;
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {}
  if (account()) { clearTimeout(syncTimer); syncTimer = setTimeout(() => { syncTimer = null; pushCloud(); }, 2500); }
}

// ---- Hesap: kullanıcı adı + şifre, ilerleme bulutta (gc_* RPC, token hash'li) ----
const AKEY = 'gemcrush.account.v1';
// F331: oturum kapanınca cihazdaki kaydın sahibi (hesap + o anki ilerleme) — uygulamadaki F126 sahip kaydının karşılığı.
// Başka hesapla girişte kayıt o andan beri ilerlemediyse önceki oyuncunun kaydı yeni hesabın bulutuna itilmez.
const OKEY = 'gemcrush.owner.v1';
export function account() { try { return JSON.parse(localStorage.getItem(AKEY) || 'null'); } catch { return null; } }
// F369 (uygulamadaki F215): sunucu oturumu düşürünce (hesaba başka cihazdan girildi) hesap sessizce çıkıyordu, bulut
// yedeğinin durduğu fark edilmiyordu. Düşen hesabın yalnız adı saklanır: üstte uyarı çıkar (onSessionLost), giriş formu
// nedeni yazıp adı hazır getirir; yeniden giriş/kayıtta ve tüm silmede silinir. Çıkış yazmaz.
const LKEY = 'gemcrush.lost.v1';
export function lostUser() { try { const u = localStorage.getItem(LKEY); return typeof u === 'string' && u ? u : null; } catch { return null; } }
let lostCb = null;
export function onSessionLost(f) { lostCb = f; }
function dropSession(a) {
  const u = String((a && a.user) || '');
  try { if (u) localStorage.setItem(LKEY, u); } catch {}
  setAccount(null);
  if (u && lostCb) { try { lostCb(u); } catch {} }
}
function setAccount(a) {
  base = null; force = 0; unsent = false;
  try {
    const o = account();
    if (a) { localStorage.setItem(AKEY, JSON.stringify(a)); localStorage.removeItem(OKEY); localStorage.removeItem(LKEY); } // F369
    else { if (o) localStorage.setItem(OKEY, JSON.stringify({ user: o.user, score: progressScore(save) })); localStorage.removeItem(AKEY); }
  } catch {}
}
async function rpc(fn, body) {
  const c = CONFIG.cloud || {};
  if (!c.url) throw new Error('offline');
  const o = { method: 'POST', headers: { apikey: c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  // F312: asılı istek sırayı kilitlemesin (AbortSignal.timeout eski Safari'de yok, sayaçla kesilir)
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = ac && setTimeout(() => ac.abort(), 20000);
  if (ac) o.signal = ac.signal;
  try {
    const r = await fetch(`${c.url}/rest/v1/rpc/${fn}`, o);
    // F356 (uygulamadaki F298): sunucunun Date başlığı oyun saatini düzeltir (hata yanıtı da olsa)
    learnServerTime(r.headers && r.headers.get && r.headers.get('date'));
    let bad = false;
    const j = await r.json().catch(() => { bad = true; return null; });
    // F344: sunucunun mesajla reddi (işlem geri alındı) ile belirsiz hata (ag) ayrılır
    // F347: mesajlı 5xx (ağ geçidi, zaman aşımı) red sayılmaz — işlem sunucuda yapılmış olabilir
    if (!r.ok) { const e = new Error((j && j.message) || 'ag'); e.status = r.status; e.server = !!(j && j.message) && r.status < 500; throw e; }
    // F312: gövdesi okunamayan çekme (zaman aşımı, kopan bağlantı) çekme hatasıdır; boş sayılıp üstüne yazılmasın.
    // Dönüşsüz RPC'ler boş gövde dönebilir, onlar için eski davranış kalır.
    if (bad && fn === 'gc_pull') throw new Error('ag');
    return j;
  } finally { clearTimeout(tm); }
}
// ilerleme puanı: hangisi daha ileride
export function progressScore(s) { return (s.level || 0) * 1000 + Object.values(s.stars || {}).reduce((a, n) => a + (n || 0), 0); }
// F333: benimsenen kayıt (giriş, açılışta bulut, kodla yükleme) dili değiştirebilir; oyun yenilenene kadar eski dilde
// kalıyordu. Çalışan dil kayda uyar; kayıtta dil yoksa seçili dil yazılır (sonraki açılış da aynı dilde açılır).
function keepLang() { if (typeof save.lang === 'string') setLang(save.lang); save.lang = getLang(); }
function adopt(obj) { const next = migrate({ ...def(), ...obj }); Object.keys(save).forEach((k) => delete save[k]); Object.assign(save, next); keepLang(); try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} }
// F309: buluta yazmadan önce buluttaki kayıtta olup bu kayıtta olmayan mağaza alımları (uygulamada alınıp itilmiş;
// iapLog = son 20 {id, p, g}) bu kayda işlenir — uygulamadaki _mergeCloudBuys'ın karşılığı. Yoksa web'in ileri kaydı
// itilince ödenmiş altın/elmas silinirdi. iapGranted kırpıldıysa (100) hangisinin verildiği bilinemez → atlanır.
// Kumbara (piggy_break) alındığı andaki elmasla (g). Sunucuya yeni bir şey açmaz: kayıt zaten istemciden itiliyor.
const PIGGY = 'co.saascorner.farmtastic.iap.piggy_break';
function mergeCloudBuys(c, t = save) {
  const log = c && Array.isArray(c.iapLog) ? c.iapLog : null;
  if (!log) return false;
  const done = Array.isArray(t.iapGranted) ? t.iapGranted.map(String) : [];
  if (done.length >= 100) return false;
  let mine = Array.isArray(t.iapLog) ? t.iapLog.filter((e) => e && typeof e === 'object') : [];
  let ch = false;
  for (const e of log) {
    if (!e || typeof e !== 'object') continue;
    const { id, p, g } = e;
    if (typeof id !== 'string' || !id || typeof p !== 'string' || done.includes(id)) continue;
    const pr = (CONFIG.iap.products || []).find((x) => x.id === p), gg = p === PIGGY && Number.isFinite(g) && g > 0 ? Math.floor(g) : 0;
    if (!pr && !gg) continue;
    if (gg) t.gems = (t.gems || 0) + gg;
    else {
      if (pr.removeAds) t.removeAds = true;
      if (pr.starter) t.starterBought = true;
      if (pr.lives) t.lives = Math.max(t.lives || 0, 0) + pr.lives;
      if (pr.coins) t.coins = (t.coins || 0) + pr.coins;
      if (pr.gems) t.gems = (t.gems || 0) + pr.gems;
    }
    done.push(id);
    mine = mine.filter((x) => x.id !== id); mine.push(gg ? { id, p, g: gg } : { id, p });
    ch = true;
  }
  if (ch) { t.iapGranted = done.slice(-100); t.iapLog = mine.slice(-20); }
  return ch;
}
// F312: buluta yazmadan önce çek. Bulut bu sekmenin base'inden sonra başka yerde (uygulama, öbür sekme)
// değiştiyse ve ilerlemesi geride değilse onu al, sayfayı yenile — eski sekme yeni kaydı ezmesin.
// base bilinmiyorsa (açılış ya da açılışta çekme hatası) açılış kuralı: ilerleme, eşitse sürüm, eşit sürümde bulut.
// true: bulut alındı. lr: açılışta çağrı anındaki yerel sürüm (bekleme sırasında artanlar sayılmaz);
// açılış dışında güncel sürüm — sırada beklerken yapılan düzenleme, yanıtı kaybolan kendi yazmasına yenilmez.
function pushCloud(boot = false) {
  const lr = rev(save);
  // eski anahtarla geç dönen 'oturum' hatası arada açılan yeni oturumu kapatmasın
  const run = () => {
    const t = (account() || {}).token;
    const mine = () => { const b = account(); return !!b && b.token === t; };
    return sync(boot, lr).then((r) => { if (mine()) unsent = false; return r; }, (e) => { if (mine()) unsent = true; if (/oturum/.test(e.message) && mine()) dropSession(account()); return false; }); // F369: sessiz çıkış yok
  };
  return (queue = queue.then(run, run));
}
async function sync(boot, lr) {
  const a = account(); if (!a) return false;
  const same = () => { const b = account(); return !!b && b.token === a.token; };
  const c = await rpc('gc_pull', { p_token: a.token });
  if (!same()) return false;
  if (c && typeof c.level === 'number' && !force) {
    const cs = progressScore(c), ls = progressScore(save);
    let take;
    if (base === null) {
      if (!boot && sig(c) === sig(save)) { base = sig(c); return false; }
      take = cs > ls || (cs === ls && rev(c) >= (boot ? lr : rev(save)));
    } else if (sig(c) === base) {
      if (sig(save) === base) return false;
      take = false;
    } else take = cs >= ls;
    if (take) {
      adopt(c); base = sig(c);
      if (!boot && typeof location !== 'undefined' && location.reload) location.reload();
      return true;
    }
  }
  if (force && c && rev(c) >= rev(save)) {
    // içe aktarılan kod buluttakinden yeni sürümle yazılsın; uygulama açılışta onu eski sanıp ezmesin
    save.rev = rev(c) + 1;
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {}
  }
  // F309: itiş buluttaki uygulama alımlarını silmesin
  if (mergeCloudBuys(c)) { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} }
  const sent = sig(save), f = force; // yazma sürerken içe aktarılan kod zorlamasını korur
  // yazma sunucuya ulaşıp yanıtı kaybolabilir: base bilinmez sayılır, sekme bulutta gördüğü kendi kopyasını
  // başkasının yazması sanıp sonraki düzenlemeleri silmez (açılış kuralı: eşit ilerlemede yeni sürüm kalır)
  try { await rpc('gc_push', { p_token: a.token, p_save: save }); } catch (e) { if (same()) base = null; throw e; }
  if (same()) { base = sent; if (force === f) force = 0; }
  return false;
}
// F334: çıkıştaki son itiş — o hesaba, çıkış anındaki kopyayla (sonraki misafir ilerlemesi gitmez). Karar sync ile aynı:
// bulut başka yerde ilerlediyse ezilmez; alınmaz da (oturum kapandı, cihazdaki kayıt artık misafirin).
function flush(a, s, b, f) {
  const run = async () => {
    const c = await rpc('gc_pull', { p_token: a.token });
    if (c && typeof c.level === 'number') {
      if (f) { if (rev(c) >= rev(s)) s.rev = rev(c) + 1; }
      else {
        const cs = progressScore(c), ls = progressScore(s);
        if (b === null ? sig(c) === sig(s) || cs > ls || (cs === ls && rev(c) >= rev(s)) : sig(c) === b ? sig(s) === b : cs >= ls) return false;
      }
    }
    mergeCloudBuys(c, s); // F309
    await rpc('gc_push', { p_token: a.token, p_save: s });
    return false;
  };
  const go = () => run().catch(() => false);
  return (queue = queue.then(go, go));
}
// F312: sekme gizlenirken bekleyen kaydı hemen gönder; geri gelince buluta bak (başka yerde oynandıysa al)
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (!account()) { if (!document.hidden) clockProbe(); return; } // F356: misafir de öne dönüşte sunucu saatini öğrensin
    if (!document.hidden) pushCloud();
    else if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; pushCloud(); }
  });
}
export async function register(user, pass) {
  const sent = sig(save);
  const token = await rpc('gc_register', { p_user: user, p_pass: pass, p_save: save });
  setAccount({ user: user.trim().toLowerCase(), token }); base = sent;
}
// giriş: buluttaki ve cihazdaki kayıttan ileride olanı tutar
// F331: cihazdaki kayıt başka hesabınsa ve çıkıştan beri ilerlemediyse buluta itilmez — bu hesabın kaydı alınır (yoksa sıfırdan).
// Çıkıştan sonra misafir olarak ilerlendiyse bugünkü kural: ileride olan kalır.
export async function login(user, pass) {
  const r = await rpc('gc_login', { p_user: user, p_pass: pass });
  const u = user.trim().toLowerCase();
  let o = null; try { o = JSON.parse(localStorage.getItem(OKEY) || 'null'); } catch {}
  setAccount({ user: u, token: r.token });
  const ok = r.save && typeof r.save.level === 'number';
  if (o && o.user !== u && progressScore(save) === o.score) { adopt(ok ? r.save : {}); if (ok) base = sig(r.save); return; }
  if (ok && progressScore(r.save) >= progressScore(save)) { adopt(r.save); base = sig(r.save); }
  else await pushCloud();
}
// F5: sıralama — önce güncel ilerlemeyi it ki kendi sıran taze olsun
export async function leaderboard(kind) {
  const a = account();
  if (a) { clearTimeout(syncTimer); await pushCloud(); }
  return rpc('gc_leaderboard', { p_kind: kind, p_token: a ? a.token : null, p_limit: 50 });
}
// F9: arkadaşlar — kod (ya da kullanıcı adı) ile ekle, çiftliğini salt-okunur ziyaret et
const tok = () => { const a = account(); if (!a) throw new Error('hesap'); return a.token; };
export const myFriendCode = () => rpc('gc_me', { p_token: tok() });
export const friendList = () => rpc('gc_friend_list', { p_token: tok() });
export const friendAdd = (code) => rpc('gc_friend_add', { p_token: tok(), p_code: code });
// F311: gelen arkadaşlık istekleri — kabul friendAdd ile (karşılıklı istek arkadaş yapar), ret ayrı
export const friendReqs = () => rpc('gc_friend_reqs', { p_token: tok() });
export const friendReject = (code) => rpc('gc_friend_reject', { p_token: tok(), p_code: code });
export const friendRemove = (code) => rpc('gc_friend_remove', { p_token: tok(), p_code: code });
export const friendFarm = (code) => rpc('gc_friend_farm', { p_token: tok(), p_code: code });
// F11: arkadaş etkileşimi — can gönder/iste, ziyarette yardım (arkadaş başına günde 1), gelen kutusu, arkadaş sıralaması
export const giftSend = (code, kind) => rpc('gc_gift_send', { p_token: tok(), p_code: code, p_kind: kind });
export const inbox = () => rpc('gc_inbox', { p_token: tok() });
export async function friendLb() { clearTimeout(syncTimer); await pushCloud(); return rpc('gc_friend_lb', { p_token: tok() }); }
export const HELP_REWARD = { helper: 25, owner: 40 };
export const GIFT_LIFE_CAP = 10; // hediye canlar üst sınırı aşabilir (max+5)
// F347 (uygulamadaki F226): 'life' gerçekte eklenen can (üst sınırda kesilen sayılmaz), 'left' kutuda bekleyen can hediyesi.
// replay (F326): yanıtı kaybolmuş alımın yeniden gönderimi. Sunucu o kimlikle eski boş yere göre aldığı canları döner,
// o hediyeler kutudan çoktan düştü; şimdiki canla kesilirse kaybolurdu → hepsi eklenir.
export function applyInbox(r, replay = false) {
  const n = (k) => (r && typeof r[k] === 'number' && Number.isFinite(r[k]) ? Math.min(1000, Math.max(0, Math.trunc(r[k]))) : 0);
  const life = n('life'), help = n('help'), before = save.lives, cap = replay ? GIFT_LIFE_CAP + life : GIFT_LIFE_CAP;
  if (life) save.lives = Math.max(before, Math.min(cap, before + life));
  if (help) save.coins += help * HELP_REWARD.owner;
  persist();
  return { life: save.lives - before, help, coins: help * HELP_REWARD.owner, left: n('left') };
}
export async function helpFriend(code) { await giftSend(code, 'help'); save.coins += HELP_REWARD.helper; persist(); return HELP_REWARD.helper; }
// F36: canlı çiftlik linki — herkese açık görüntü + cihaz başına günde 1 sulama; sahibi girişte toplar
export const publicFarm = (code) => rpc('gc_public_farm', { p_code: code });
export function deviceId() {
  try { let d = localStorage.getItem('gc_dev'); if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`); localStorage.setItem('gc_dev', d); } return d; }
  catch { return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}
export const publicWater = (code) => rpc('gc_public_water', { p_code: code, p_device: deviceId() });
export const waterClaimRaw = () => rpc('gc_water_claim', { p_token: tok() });
export const farmLink = (code, base = (typeof location !== 'undefined' ? location.origin + location.pathname : '')) => `${base}?ciftlik=${encodeURIComponent(code)}`;
// F347 (uygulamadaki F226/F326): sunucu yalnız boş yer kadar can hediyesi alır, kalanı kutuda bekler. Eskiden gc_inbox_claim
// bütün canları kutudan düşüyordu, üst sınırı aşanlar kayboluyordu. Alım bir kimlikle gider; yanıt kaybolursa kimlik cihazda
// kalır, sonraki alım aynı kimlikle gider ve sunucu aynı sonucu döner (hediye kaybolmaz). Süren alım varken ikinci çağrı
// istek atmaz, null döner. Kimlik hesap başına saklanır; yanıt gelmeden hesap değiştiyse yanıt başka kayda eklenmez,
// kimlik ilk hesabın girişinde yeniden gönderilir.
const INKEY = 'gemcrush.inboxNonce.v1:';
let inboxBusy = null;
const inboxUser = () => account()?.user ?? null;
function inboxNonce(u = inboxUser()) {
  try { const n = u != null ? localStorage.getItem(INKEY + u) : null; return typeof n === 'string' && n ? n : null; } catch { return null; }
}
export const inboxPending = () => !!inboxNonce();
export function claimInbox() {
  if (inboxBusy) return inboxBusy.then(() => null, () => null);
  const p = inboxBusy = claimInbox0();
  p.then(() => { inboxBusy = null; }, () => { inboxBusy = null; });
  return p;
}
async function claimInbox0() {
  const tk = tok(), u = account().user;
  tickLives();
  let n = inboxNonce(u);
  const replay = !!n, base = save.lives;
  if (!n) { n = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; try { localStorage.setItem(INKEY + u, n); } catch {} }
  const done = () => { try { if (inboxNonce(u) === n) localStorage.removeItem(INKEY + u); } catch {} };
  let r;
  try { r = await rpc('gc_inbox_claim2', { p_token: tk, p_room: Math.max(0, GIFT_LIFE_CAP - base), p_nonce: n }); }
  catch (e) { if (e.server) done(); throw e; } // sunucu reddetti: işlem geri alındı, bekleyen kalmasın
  if (inboxUser() !== u) return null; // yanıt gelmeden çıkış/hesap değişti: kimlik ilk hesapta bekler
  if (!r || typeof r !== 'object') throw new Error('ag'); // gövde okunamadı: sonuç bilinmiyor, kimlik kalır
  // istek sürerken can arttıysa (yenilenme, günlük kutu) sunucunun boş yere göre verdiği canlar kesilmesin
  const g = applyInbox(r, replay || save.lives > base);
  done();
  return g;
}
// günlük hediye kutusu (cihazda, günde 1)
// F338 (uygulamadaki F259): yalnız gün ileri gidince açılır; saati geri alıp düzeltmek kutuyu yeniden açmasın
export function giftBoxReady(now = gameNow()) { return Math.floor(now / 86400000) > (save.giftBox ?? -1); }
export function openGiftBox(now = gameNow(), rnd = Math.random) {
  if (!giftBoxReady(now)) return null;
  save.giftBox = Math.floor(now / 86400000);
  const x = rnd();
  let r;
  if (x < 0.15) { r = { gems: 1 }; save.gems += 1; }
  else if (x < 0.4) { r = { life: 1 }; save.lives = Math.max(save.lives, Math.min(GIFT_LIFE_CAP, save.lives + 1)); } // F405 (uygulamadaki F175): 10'un üstündeki canlar kırpılmasın
  else { r = { coins: 60 + Math.floor(rnd() * 10) * 10 }; save.coins += r.coins; }
  persist();
  return r;
}
// F334: çıkış bekleyen (2.5 sn içindeki) ya da itilemeyen değişikliği silmesin, o hesabın bulutuna yine gitsin (uygulamadaki
// F126/F329 karşılığı). Yoksa aynı hesaba geri girişte ilerleme eşit olduğu için bulut kazanıyor, alım/hasat kayboluyordu.
// Bekleyen: son eşleşmeden (base) beri değişen kayıt; base bilinmiyorsa kurulu itiş ya da düşen eşitleme.
// Bekleyen yoksa itilmez: başka cihazın daha yeni kaydı ezilmez.
export function logout() {
  const a = account(), p = base === null ? !!syncTimer || unsent : sig(save) !== base;
  clearTimeout(syncTimer); syncTimer = null;
  const r = a && p ? flush(a, JSON.parse(JSON.stringify(save)), base, force) : Promise.resolve(false);
  setAccount(null);
  return r;
}
// açılışta: bulut daha ilerideyse onu al; true dönerse sahne yenilenmeli
// F312: ilerleme eşitse sürümü yeni olan kalır, eşit sürümde bulut — web'deki eski kopya uygulamada
// yapılan çiftlik/envanter değişikliklerini ezmesin. Açılış bitene kadar başka itme sırada bekler.
export async function syncOnBoot() { return account() ? pushCloud(true) : false; }
// F356 (uygulamadaki F298): misafir hiç RPC yapmayabilir; oyun saati için ucuz, yan etkisiz bir sunucu sorusu.
// Cihaz saati oturum içinde sıçrarsa da sorulur.
export const clockProbe = () => rpc('gc_app_version', { p_platform: 'web' }).catch(() => null);
onClockJump(clockProbe);
export function authError(e) {
  const m = String(e && e.message || '');
  // F365 (uygulamadaki F160/F194): 10 yanlış denemede sunucu 'hatali_kilit' döner; 'hatali'dan önce bakılmazsa
  // "şifre yanlış" görünür. Kayıtta filtreye takılan kullanıcı adı (isim_uygunsuz) "bağlantı hatası" görünmesin.
  if (m.includes('hatali_kilit')) return 'kilit';
  if (m.includes('isim_uygunsuz')) return 'isim';
  return ['kullanici_adi', 'sifre_kisa', 'alinmis', 'hatali'].find((k) => m.includes(k)) || 'ag';
}

// Dev/test: on localhost lives are always full
// F353: yayındaki sayfada ?dev=1 artık sınırsız can vermez — yalnız yerel geliştirme
export const DEV = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
// ---- lives ----
export function tickLives() { // F356: can süresi oyun saatiyle
  if (DEV) { save.lives = CONFIG.lives.max; save.lifeTs = gameNow(); return; }
  if (save.lives >= CONFIG.lives.max) { save.lifeTs = gameNow(); return; }
  const gained = Math.floor((gameNow() - save.lifeTs) / CONFIG.lives.regenMs);
  if (gained > 0) {
    save.lives = Math.min(CONFIG.lives.max, save.lives + gained);
    save.lifeTs += gained * CONFIG.lives.regenMs;
    if (save.lives >= CONFIG.lives.max) save.lifeTs = gameNow();
    persist();
  }
}
export function msToNextLife() {
  if (save.lives >= CONFIG.lives.max) return 0;
  return Math.max(0, CONFIG.lives.regenMs - (gameNow() - save.lifeTs));
}
export function spendLife() {
  tickLives();
  if (DEV) { save.lives = CONFIG.lives.max; return true; }
  if (save.lives <= 0) return false;
  if (save.lives === CONFIG.lives.max) save.lifeTs = gameNow();
  save.lives--; persist(); return true;
}
// Can yalnız KAYBEDİNCE gider. Bölüm başında "askıda" işaretlenir; kazanınca silinir,
// kaybedince/çıkınca can düşülür. Uygulama bölüm ortasında kapatılırsa açılışta düşülür.
// F355 (uygulamadaki F180): bu çalıştırmada başlayan bölüm açılış hesabına karışmaz (link ziyareti → çiftlik → bölüm, eşitleme bitmeden)
let levelBegun = false;
export function beginLevel(id) { levelBegun = true; save.inLevel = id; persist(); }
export function endLevel(won) {
  if (!save.inLevel) return;
  save.inLevel = 0;
  if (!won) spendLife(); else persist();
}
// F355: bölüm ortasında kapatılan sekme açılışta kaybetmiş sayılır — yoksa sekmeyi kapatıp kaçmak canı korurdu. Kapanan bölümün no'sunu döner.
export function settlePendingLevel() {
  const id = save.inLevel;
  if (!id || levelBegun) return 0;
  recordLoss(); endLevel(false);
  return id;
}
// F342 (uygulamadaki F175): can eklemek üst sınırı aşan hediye canları silmez; ödül canları cap ile hediye sınırına kadar eklenir
export function addLife(n = 1, cap = CONFIG.lives.max) { save.lives = Math.max(save.lives, Math.min(cap, save.lives + n)); persist(); }

// ---- coins ----
export function addCoins(n) { save.coins += n; persist(); }
export function addGems(n) { save.gems += n; persist(); }
export function spendGems(n) { if (save.gems < n) return false; save.gems -= n; persist(); return true; }
export function spendCoins(n) { if (save.coins < n) return false; save.coins -= n; persist(); return true; }

// ---- progress ----
// Returns how many NEW farm stars this win added (only improvements count, replays can't farm stars).
export function recordWin(levelId, score, stars) {
  const prev = save.stars[levelId] || 0;
  save.stars[levelId] = Math.max(prev, stars);
  save.best[levelId] = Math.max(save.best[levelId] || 0, score);
  if (levelId >= save.level) save.level = levelId + 1;
  save.levelsPlayed++;
  persist();
  return Math.max(0, stars - prev);
}
export function recordLoss() { save.levelsPlayed++; persist(); }

// ---- daily ----
export function dailyStatus(now = gameNow()) {
  const day = Math.floor(now / 86400000);
  const last = save.daily.last;
  // F338 (uygulamadaki F259): alınan günden önceki bir gün de "alındı" sayılır (saati geri alıp ödülü yeniden almak kapandı)
  if (day <= last) return { available: false, streak: save.daily.streak };
  const streak = last === day - 1 ? save.daily.streak % 7 : 0; // F361 (uygulamadaki F78): seri 7 günde başa döner (takvim + ödül 25..300 döner)
  return { available: true, streak, reward: CONFIG.dailyRewards[Math.min(streak, CONFIG.dailyRewards.length - 1)] };
}
export function claimDaily(now = gameNow()) {
  const s = dailyStatus(now);
  if (!s.available) return 0;
  save.daily = { last: Math.floor(now / 86400000), streak: s.streak + 1 };
  addCoins(s.reward);
  if (s.streak === 6) { save.boosters.hammer = (save.boosters.hammer || 0) + 1; addGems(1); } // F361 (uygulamadaki F78): 7. gün her yoldan 💎1 + 🔨1
  return s.reward;
}

// ---- farm stars (wallet) ----
export function totalStars() { return Object.values(save.stars).reduce((a, n) => a + (n || 0), 0); }
export function starBalance() { return Math.max(0, totalStars() - save.starsSpent); }
export function spendStars(n) { if (starBalance() < n) return false; save.starsSpent += n; persist(); return true; }
// F38: oyuncu pazarı — hesaplı çağrı (token eklenir)
export const acctRpc = (fn, body = {}) => rpc(fn, { p_token: tok(), ...body });
