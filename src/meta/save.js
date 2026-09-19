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
  boosters: { hammer: 1, moves5: 1, shuffle: 1, prism: 0 },
  daily: { last: 0, streak: 0 },
  removeAds: false,
  sound: true,
  lang: null,
  levelsPlayed: 0,
  tutorialDone: false,
  v: 2,                           // save schema version
  starsSpent: 0,
  profile: { name: '', avatar: '🧑‍🌾' },
  gems: 5,                        // Faz 5: hard currency (diamonds)                  // farm wallet: balance = totalStars() - starsSpent
  farm: { owned: [], perks: {} }, // farm purchases (Faz 1) + derived perks (Faz 2)
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
  const id = save.deviceId;
  if (CONFIG.supabase.url) try {
    await fetch(`${CONFIG.supabase.url}/rest/v1/profiles?device_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { apikey: CONFIG.supabase.anonKey, Authorization: `Bearer ${CONFIG.supabase.anonKey}` } });
  } catch {}
  try { localStorage.removeItem(KEY); } catch {}
  const next = def(); Object.keys(save).forEach((k) => delete save[k]); Object.assign(save, next); persist();
}

let syncTimer = null;
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {}
  if (CONFIG.supabase.url) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(cloudSync, 3000);
  }
}

async function cloudSync() {
  try {
    await fetch(`${CONFIG.supabase.url}/rest/v1/profiles`, {
      method: 'POST',
      headers: { apikey: CONFIG.supabase.anonKey, Authorization: `Bearer ${CONFIG.supabase.anonKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ device_id: save.deviceId, progress: { level: save.level, stars: save.stars, coins: save.coins, starsSpent: save.starsSpent, farm: save.farm }, updated_at: new Date().toISOString() }),
    });
  } catch {}
}

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
