// F21: sinematik anlar — kuzu siluetli iris geçişi + çiftlik kartpostalı
import { farmTitle } from './farmTitle.js';
import { getLang } from '../i18n.js';
import { starBalance } from '../meta/save.js';

const L = (tr, en) => (getLang() === 'en' ? en : tr);

// kuzu silueti (yün bulutu + baş + kulaklar + bacaklar), siyah = görünen delik
const LAMB = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#000">
<circle cx="38" cy="44" r="16"/><circle cx="54" cy="38" r="17"/><circle cx="68" cy="47" r="15"/><circle cx="46" cy="58" r="16"/><circle cx="62" cy="60" r="15"/><circle cx="30" cy="56" r="12"/>
<ellipse cx="22" cy="42" rx="11" ry="13"/><ellipse cx="12" cy="36" rx="8" ry="4" transform="rotate(-25 12 36)"/><ellipse cx="30" cy="30" rx="7" ry="4" transform="rotate(35 30 30)"/>
<rect x="36" y="66" width="7" height="20" rx="3"/><rect x="60" y="66" width="7" height="20" rx="3"/></g></svg>`);

let busy = null;
export function irisOpen(ms = 700) {
  try {
    if (busy) busy.remove();
    const d = document.createElement('div'); busy = d;
    const pre = CSS.supports('mask-composite', 'exclude') ? '' : '-webkit-';
    Object.assign(d.style, { position: 'fixed', inset: '0', background: '#0a0f0d', zIndex: 50, pointerEvents: 'none' });
    const set = (px) => {
      const m = `url("${LAMB}") center / ${px}px ${px}px no-repeat, linear-gradient(#000,#000)`;
      d.style.webkitMaskImage = d.style.maskImage = ''; d.style[pre ? 'webkitMask' : 'mask'] = m;
      if (pre) d.style.webkitMaskComposite = 'xor'; else d.style.maskComposite = 'exclude';
    };
    set(1); document.body.appendChild(d);
    const max = 3.2 * Math.max(innerWidth, innerHeight), hold = 110, t0 = performance.now();
    const step = (t) => {
      const k = Math.max(0, (t - t0 - hold) / ms);
      if (k >= 1) { d.remove(); if (busy === d) busy = null; return; }
      set(Math.max(1, Math.pow(max, k * k * (3 - 2 * k)))); requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } catch {}
}

// kartpostal: 3D dünya + Phaser katmanı → krem çerçeveli 1080×1350 kart
export async function postcard(w3, game) {
  const W = 1080, H = 1350, pad = 54, ph = 1030;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#f5f4eb'; x.fillRect(0, 0, W, H);
  const pw = W - pad * 2;
  const shot = document.createElement('canvas'); const sw = w3 ? w3.canvas.width : game.canvas.width, sh = w3 ? w3.canvas.height : game.canvas.height;
  shot.width = sw; shot.height = sh; const sx = shot.getContext('2d');
  if (w3) { try { w3.R.render(w3.S, w3.C); } catch {} sx.drawImage(w3.canvas, 0, 0, sw, sh); }
  // yalnız 3D sahne; UI düğmeleri kartta olmasın
  const r = pw / ph, sr = sw / sh; let cw = sw, ch = sh, cx = 0, cy = 0;
  if (sr > r) { cw = sh * r; cx = (sw - cw) / 2; } else { ch = sw / r; cy = (sh - ch) * 0.4; }
  x.save(); x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 18; x.fillStyle = '#fff'; x.fillRect(pad, pad, pw, ph); x.restore();
  x.drawImage(shot, cx, cy, cw, ch, pad, pad, pw, ph);
  const g = x.createLinearGradient(0, pad + ph - 220, 0, pad + ph); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
  x.fillStyle = g; x.fillRect(pad, pad + ph - 220, pw, 220);
  const font = (s, wt = 800) => `${wt} ${s}px "Baloo 2", system-ui, sans-serif`;
  x.fillStyle = '#0a0f0d'; x.textBaseline = 'alphabetic';
  x.font = font(64); x.fillText(farmTitle(), pad, pad + ph + 100, W - pad * 2 - 260);
  const date = new Date().toLocaleDateString(getLang() === 'en' ? 'en-US' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  x.font = font(34, 600); x.fillStyle = '#5a6a5f'; x.fillText(`${date}  ·  ⭐ ${starBalance()}`, pad, pad + ph + 160);
  x.font = font(30, 600); x.fillStyle = '#ffffff'; x.fillText(L('Selamlar çiftlikten!', 'Greetings from the farm!'), pad + 30, pad + ph - 34);
  // pul/damga
  x.save(); x.translate(W - pad - 120, pad + ph + 110); x.rotate(-0.18);
  x.strokeStyle = '#ffb71b'; x.lineWidth = 6; x.setLineDash([10, 7]); x.beginPath(); x.arc(0, 0, 92, 0, Math.PI * 2); x.stroke();
  x.setLineDash([]); x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 74, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#e0971a'; x.textAlign = 'center'; x.font = font(26); x.fillText('Farmtastic', 0, -4); x.font = font(22, 700); x.fillText('🐑 ' + L('ÇİFTLİK', 'FARM'), 0, 28);
  x.restore();
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
  const name = 'farmtastic-kartpostal.jpg';
  try {
    const file = new File([blob], name, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: farmTitle(), text: L('Çiftliğime bak! 🐑', 'Check out my farm! 🐑') }); return 'shared'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); return 'saved';
}
