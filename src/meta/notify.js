// F15: yerel bildirimler (yalnız native). Uygulama arka plana geçince planlanır, öne gelince iptal edilir.
// plan() saf: test edilebilir; DOM/Capacitor bağımlılığı yok.
import { CONFIG } from '../config.js';
import { save } from './save.js';
import { CROPS, SEEDS } from './crops.js';
import { festActive, festMsLeft } from '../engine/festival.js';
import { t } from '../i18n.js';

const DAY = 86400000, QUIET_FROM = 22, QUIET_TO = 9;
// sessiz saatlere (22:00–09:00) düşeni 09:00'a kaydır
export function unquiet(at) {
  const d = new Date(at), h = d.getHours();
  if (h >= QUIET_FROM) { d.setDate(d.getDate() + 1); d.setHours(QUIET_TO, 0, 0, 0); }
  else if (h < QUIET_TO) d.setHours(QUIET_TO, 0, 0, 0);
  return d.getTime();
}
export function plan(s = save, now = Date.now()) {
  const out = [];
  const max = CONFIG.lives.max, regen = CONFIG.lives.regenMs;
  if ((s.lives ?? max) < max) {
    const first = Math.max(0, regen - (now - (s.lifeTs || now)));
    out.push({ id: 1, key: 'lives', at: now + first + (max - s.lives - 1) * regen });
  }
  const grow = Object.entries(s.farm?.crops || {}).filter(([id, c]) => CROPS[id] && c.readyAt > now).sort((a, b) => a[1].readyAt - b[1].readyAt);
  if (grow.length) out.push({ id: 2, key: 'crops', at: grow[0][1].readyAt, emoji: (SEEDS[grow[0][1].seed] || CROPS[grow[0][0]]).emoji });
  const left = festMsLeft(now);
  if (festActive(now)) { if (left > DAY + 3600000) out.push({ id: 3, key: 'festEnd', at: now + left - DAY }); }
  else out.push({ id: 3, key: 'festStart', at: now + left + 60000 });
  return out.map((n) => ({ ...n, at: unquiet(n.at) })).filter((n) => n.at > now + 60000);
}

let LN = null, asked = false;
const plugin = () => {
  const cap = typeof window !== 'undefined' && window.Capacitor;
  if (!cap || !cap.isNativePlatform?.()) return null;
  return (LN = LN || cap.Plugins?.LocalNotifications || cap.registerPlugin?.('LocalNotifications') || null);
};
async function allowed(p) {
  try {
    let st = (await p.checkPermissions()).display;
    if (st === 'prompt' && !asked) { asked = true; st = (await p.requestPermissions()).display; }
    return st === 'granted';
  } catch { return false; }
}
async function cancelAll(p) { try { await p.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] }); } catch {} }
export async function scheduleAll() {
  const p = plugin(); if (!p || save.settings?.notify === false) return;
  if (!(await allowed(p))) return;
  await cancelAll(p);
  const list = plan();
  if (!list.length) return;
  try {
    await p.schedule({ notifications: list.map((n) => ({
      id: n.id, title: t(`nt_${n.key}_t`).replace('{e}', n.emoji || '🌾'), body: t(`nt_${n.key}_b`).replace('{e}', n.emoji || '🌾'),
      schedule: { at: new Date(n.at), allowWhileIdle: true },
    })) });
  } catch (e) { console.warn('notify', e); }
}
export function initNotify() {
  const p = plugin(); if (!p) return;
  allowed(p);
  document.addEventListener('visibilitychange', () => { if (document.hidden) scheduleAll(); else cancelAll(p); });
}
