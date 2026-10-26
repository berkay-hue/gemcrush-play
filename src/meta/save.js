// Player state: localStorage, optional Supabase mirror.
import { CONFIG } from '../config.js';
import { getLang, setLang } from '../i18n.js'; // F333

const KEY = 'gemcrush.save.v1';
const def = () => ({
  deviceId: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2),
  level: 1,                       // highest unlocked
  stars: {},                      // levelId -> 0..3
  best: {},                       // levelId -> score
  coins: CONFIG.coins.start,
  lives: CONFIG.lives.max,
  lifeTs: Date.now(),             // timestamp of last life regen tick
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
export function importCode(code) {
  try {
    const bin = atob(String(code).trim().replace(/^GC1\./, ''));
    const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!obj || typeof obj !== 'object' || typeof obj.level !== 'number') return false;
    const next = migrate({ ...def(), ...obj });
    next.rev = rev(save); // F312: koddaki sürüm taşınmaz, sürüm geri de gitmez
    Object.keys(save).forEach((k) => delete save[k]); Object.assign(save, next); keepLang(); force++; persist(); return true;
  } catch { return false; }
}
export async function wipeAll() {
  const a = account();
  if (a) { try { await rpc('gc_delete', { p_token: a.token }); } catch {} setAccount(null); }
  try { localStorage.removeItem(KEY); localStorage.removeItem(OKEY); } catch {}
  const next = def(); Object.keys(save).forEach((k) => delete save[k]); Object.assign(save, next); persist();
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
function setAccount(a) {
  base = null; force = 0; unsent = false;
  try {
    const o = account();
    if (a) { localStorage.setItem(AKEY, JSON.stringify(a)); localStorage.removeItem(OKEY); }
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
    let bad = false;
    const j = await r.json().catch(() => { bad = true; return null; });
    if (!r.ok) throw new Error((j && j.message) || 'ag');
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
    return sync(boot, lr).then((r) => { if (mine()) unsent = false; return r; }, (e) => { if (mine()) unsent = true; if (/oturum/.test(e.message) && mine()) setAccount(null); return false; });
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
    await rpc('gc_push', { p_token: a.token, p_save: s });
    return false;
  };
  const go = () => run().catch(() => false);
  return (queue = queue.then(go, go));
}
// F312: sekme gizlenirken bekleyen kaydı hemen gönder; geri gelince buluta bak (başka yerde oynandıysa al)
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (!account()) return;
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
export function applyInbox(r) {
  const life = (r && r.life) || 0, help = (r && r.help) || 0;
  if (life) save.lives = Math.max(save.lives, Math.min(GIFT_LIFE_CAP, save.lives + life));
  if (help) save.coins += help * HELP_REWARD.owner;
  persist();
  return { life, help, coins: help * HELP_REWARD.owner };
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
export async function claimInbox() { return applyInbox(await rpc('gc_inbox_claim', { p_token: tok() })); }
// günlük hediye kutusu (cihazda, günde 1)
export function giftBoxReady(now = Date.now()) { return (save.giftBox || -1) !== Math.floor(now / 86400000); }
export function openGiftBox(now = Date.now(), rnd = Math.random) {
  if (!giftBoxReady(now)) return null;
  save.giftBox = Math.floor(now / 86400000);
  const x = rnd();
  let r;
  if (x < 0.15) { r = { gems: 1 }; save.gems += 1; }
  else if (x < 0.4) { r = { life: 1 }; save.lives = Math.min(GIFT_LIFE_CAP, save.lives + 1); }
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
export function authError(e) { const m = String(e && e.message || ''); return ['kullanici_adi', 'sifre_kisa', 'alinmis', 'hatali'].find((k) => m.includes(k)) || 'ag'; }

// Dev/test: on localhost (or ?dev=1) lives are always full
export const DEV = typeof location !== 'undefined' && (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /[?&]dev=1/.test(location.search));
// ---- lives ----
export function tickLives() {
  if (DEV) { save.lives = CONFIG.lives.max; save.lifeTs = Date.now(); return; }
  if (save.lives >= CONFIG.lives.max) { save.lifeTs = Date.now(); return; }
  const gained = Math.floor((Date.now() - save.lifeTs) / CONFIG.lives.regenMs);
  if (gained > 0) {
    save.lives = Math.min(CONFIG.lives.max, save.lives + gained);
    save.lifeTs += gained * CONFIG.lives.regenMs;
    if (save.lives >= CONFIG.lives.max) save.lifeTs = Date.now();
    persist();
  }
}
export function msToNextLife() {
  if (save.lives >= CONFIG.lives.max) return 0;
  return Math.max(0, CONFIG.lives.regenMs - (Date.now() - save.lifeTs));
}
export function spendLife() {
  tickLives();
  if (DEV) { save.lives = CONFIG.lives.max; return true; }
  if (save.lives <= 0) return false;
  if (save.lives === CONFIG.lives.max) save.lifeTs = Date.now();
  save.lives--; persist(); return true;
}
// Can yalnız KAYBEDİNCE gider. Bölüm başında "askıda" işaretlenir; kazanınca silinir,
// kaybedince/çıkınca can düşülür. Uygulama bölüm ortasında kapatılırsa açılışta düşülür.
export function beginLevel(id) { save.inLevel = id; persist(); }
export function endLevel(won) {
  if (!save.inLevel) return;
  save.inLevel = 0;
  if (!won) spendLife(); else persist();
}
export function settlePendingLevel() { if (save.inLevel) endLevel(false); }
export function addLife(n = 1) { save.lives = Math.min(CONFIG.lives.max, save.lives + n); persist(); }

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
export function dailyStatus() {
  const day = Math.floor(Date.now() / 86400000);
  const last = save.daily.last;
  if (last === day) return { available: false, streak: save.daily.streak };
  const streak = last === day - 1 ? save.daily.streak : 0;
  return { available: true, streak, reward: CONFIG.dailyRewards[Math.min(streak, CONFIG.dailyRewards.length - 1)] };
}
export function claimDaily() {
  const s = dailyStatus();
  if (!s.available) return 0;
  save.daily = { last: Math.floor(Date.now() / 86400000), streak: s.streak + 1 };
  addCoins(s.reward);
  return s.reward;
}

// ---- farm stars (wallet) ----
export function totalStars() { return Object.values(save.stars).reduce((a, n) => a + (n || 0), 0); }
export function starBalance() { return Math.max(0, totalStars() - save.starsSpent); }
export function spendStars(n) { if (starBalance() < n) return false; save.starsSpent += n; persist(); return true; }
// F38: oyuncu pazarı — hesaplı çağrı (token eklenir)
export const acctRpc = (fn, body = {}) => rpc(fn, { p_token: tok(), ...body });
