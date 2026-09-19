// Minimal analytics: queue in localStorage, flush to Supabase `events` if configured.
import { CONFIG } from './config.js';
import { save } from './meta/save.js';

const QKEY = 'gemcrush.events';
let queue = [];
try { queue = JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch {}

export function track(name, props = {}) {
  queue.push({ device_id: save.deviceId, name, props, ts: new Date().toISOString() });
  if (queue.length > 500) queue = queue.slice(-500);
  try { localStorage.setItem(QKEY, JSON.stringify(queue)); } catch {}
  if (queue.length >= 20) flush();
}

export async function flush() {
  if (!CONFIG.supabase.url || !queue.length) return;
  const batch = queue.splice(0, queue.length);
  try {
    const r = await fetch(`${CONFIG.supabase.url}/rest/v1/events`, {
      method: 'POST',
      headers: { apikey: CONFIG.supabase.anonKey, Authorization: `Bearer ${CONFIG.supabase.anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!r.ok) throw new Error(r.status);
  } catch { queue.unshift(...batch); }
  try { localStorage.setItem(QKEY, JSON.stringify(queue)); } catch {}
}
window.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
setInterval(flush, 60000);
