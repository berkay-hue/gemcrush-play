// Analytics: level events are queued in localStorage and flushed to Supabase `gc_track` RPC
// (bölüm hunisi: başlama/kazanma/kaybetme/bırakma + kaçıncı deneme). Other events stay local (tasks).
import { CONFIG } from './config.js';
import { save } from './meta/save.js';
import { bump } from './meta/tasks.js';

const QKEY = 'gemcrush.events';
const AKEY = 'gemcrush.attempts';
const KIND = { level_start: 'start', level_win: 'win', level_fail: 'fail', level_quit: 'quit', continue: 'continue' };
let queue = [], attempts = {};
try { queue = JSON.parse(localStorage.getItem(QKEY) || '[]').filter(e => e && e.kind); } catch {}
try { attempts = JSON.parse(localStorage.getItem(AKEY) || '{}'); } catch {}

export function track(name, props = {}) {
  try { bump(name, props); } catch {}
  const kind = KIND[name], level = props.level;
  if (!kind || !Number.isFinite(level)) return;
  if (kind === 'start') { attempts[level] = (attempts[level] || 0) + 1; try { localStorage.setItem(AKEY, JSON.stringify(attempts)); } catch {} }
  queue.push({ device: save.deviceId, level, kind, attempt: attempts[level] || 1, stars: props.stars ?? null,
    moves_left: props.movesLeft ?? null, score: props.score ?? null, ts: new Date().toISOString() });
  if (queue.length > 500) queue = queue.slice(-500);
  try { localStorage.setItem(QKEY, JSON.stringify(queue)); } catch {}
  if (queue.length >= 20) flush();
}

let busy = false;
export async function flush() {
  const c = CONFIG.cloud;
  if (busy || !c?.url || !queue.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  busy = true;
  const batch = queue.splice(0, 50);
  try {
    const r = await fetch(`${c.url}/rest/v1/rpc/gc_track`, {
      method: 'POST', keepalive: true,
      headers: { apikey: c.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_events: batch }),
    });
    if (!r.ok) throw new Error(r.status);
  } catch { queue.unshift(...batch); }
  busy = false;
  try { localStorage.setItem(QKEY, JSON.stringify(queue)); } catch {}
}
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  setInterval(flush, 60000);
}
