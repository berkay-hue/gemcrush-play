// Player state: localStorage, optional Supabase mirror.
import { CONFIG } from '../config.js';

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
    Object.keys(save).forEach((k) => delete save[k]); Object.assign(save, next); persist(); return true;
  } catch { return false; }
}
export async function wipeAll() {
  const a = account();
  if (a) { try { await rpc('gc_delete', { p_token: a.token }); } catch {} setAccount(null); }
  try { localStorage.removeItem(KEY); } catch {}
  const next = def(); Object.keys(save).forEach((k) => delete save[k]); Object.assign(save, next); persist();
}

let syncTimer = null;
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {}
  if (account()) { clearTimeout(syncTimer); syncTimer = setTimeout(pushCloud, 2500); }
}

// ---- Hesap: kullanıcı adı + şifre, ilerleme bulutta (gc_* RPC, token hash'li) ----
const AKEY = 'gemcrush.account.v1';
export function account() { try { return JSON.parse(localStorage.getItem(AKEY) || 'null'); } catch { return null; } }
function setAccount(a) { try { a ? localStorage.setItem(AKEY, JSON.stringify(a)) : localStorage.removeItem(AKEY); } catch {} }
async function rpc(fn, body) {
  const c = CONFIG.cloud || {};
  if (!c.url) throw new Error('offline');
  const r = await fetch(`${c.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.message) || 'ag');
  return j;
}
// ilerleme puanı: hangisi daha ileride
export function progressScore(s) { return (s.level || 0) * 1000 + Object.values(s.stars || {}).reduce((a, n) => a + (n || 0), 0); }
function adopt(obj) { const next = migrate({ ...def(), ...obj }); Object.keys(save).forEach((k) => delete save[k]); Object.assign(save, next); try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} }
async function pushCloud() { const a = account(); if (!a) return; try { await rpc('gc_push', { p_token: a.token, p_save: save }); } catch (e) { if (/oturum/.test(e.message)) setAccount(null); } }
export async function register(user, pass) {
  const token = await rpc('gc_register', { p_user: user, p_pass: pass, p_save: save });
  setAccount({ user: user.trim().toLowerCase(), token });
}
// giriş: buluttaki ve cihazdaki kayıttan ileride olanı tutar
export async function login(user, pass) {
  const r = await rpc('gc_login', { p_user: user, p_pass: pass });
  setAccount({ user: user.trim().toLowerCase(), token: r.token });
  if (r.save && typeof r.save.level === 'number' && progressScore(r.save) >= progressScore(save)) adopt(r.save);
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
export function logout() { clearTimeout(syncTimer); setAccount(null); }
// açılışta: bulut daha ilerideyse onu al; true dönerse sahne yenilenmeli
export async function syncOnBoot() {
  const a = account(); if (!a) return false;
  try {
    const s = await rpc('gc_pull', { p_token: a.token });
    if (s && typeof s.level === 'number' && progressScore(s) > progressScore(save)) { adopt(s); return true; }
    await pushCloud();
  } catch (e) { if (/oturum/.test(e.message)) setAccount(null); }
  return false;
}
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
