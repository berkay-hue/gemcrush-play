// F17: emoji yerine prosedürel çizilmiş ikonlar (canvas, 2× örnekleme). Anahtar: 'ic-<ad>'.
const S = 64, SS = 2;
const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const rad = (ctx, x, y, r, stops) => { const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const outline = (ctx, w = 3, c = 'rgba(40,22,6,.85)') => { ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineJoin = 'round'; ctx.stroke(); };
const shine = (ctx, x, y, rx, ry, a = -0.5) => { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); ctx.fill(); };
const star = (ctx, cx, cy, ro, ri, n = 5) => { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = Math.PI / n * i - Math.PI / 2, r = i % 2 ? ri : ro; ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } ctx.closePath(); };
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

const DRAW = {
  coin(ctx) {
    ctx.fillStyle = '#9a5b00'; ctx.beginPath(); ctx.arc(32, 35, 25, 0, 7); ctx.fill();
    ctx.fillStyle = rad(ctx, 32, 32, 26, [[0, '#fff3b0'], [0.45, '#ffcf3a'], [1, '#d88a00']]); ctx.beginPath(); ctx.arc(32, 32, 25, 0, 7); ctx.fill(); outline(ctx);
    ctx.strokeStyle = 'rgba(160,90,0,.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(32, 32, 18, 0, 7); ctx.stroke();
    ctx.fillStyle = '#e59a00'; star(ctx, 32, 33, 11, 5); ctx.fill(); ctx.fillStyle = '#fff1a8'; star(ctx, 31, 31, 10, 4.5); ctx.fill();
    shine(ctx, 22, 20, 8, 4);
  },
  gem(ctx) {
    const P = [[12, 24], [22, 12], [42, 12], [52, 24], [32, 54]];
    ctx.beginPath(); P.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 10, 0, 54, [[0, '#bff4ff'], [0.4, '#46c8ff'], [1, '#1466c8']]); ctx.fill(); outline(ctx, 3, '#0b3a6e');
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(12, 24); ctx.lineTo(52, 24); ctx.lineTo(32, 54); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(11,58,110,.55)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(12, 24); ctx.lineTo(52, 24); ctx.moveTo(22, 12); ctx.lineTo(26, 24); ctx.lineTo(32, 54); ctx.lineTo(38, 24); ctx.lineTo(42, 12); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.moveTo(24, 15); ctx.lineTo(30, 15); ctx.lineTo(24, 22); ctx.closePath(); ctx.fill();
  },
  heart(ctx) {
    ctx.beginPath(); ctx.moveTo(32, 54); ctx.bezierCurveTo(4, 36, 6, 10, 22, 11); ctx.bezierCurveTo(28, 11, 31, 16, 32, 19); ctx.bezierCurveTo(33, 16, 36, 11, 42, 11); ctx.bezierCurveTo(58, 10, 60, 36, 32, 54); ctx.closePath();
    ctx.fillStyle = rad(ctx, 32, 30, 28, [[0, '#ff9aa8'], [0.5, '#ff3b5c'], [1, '#b0102e']]); ctx.fill(); outline(ctx, 3, '#6e0618');
    shine(ctx, 20, 20, 6, 3.5, -0.8);
  },
  star(ctx) {
    star(ctx, 32, 34, 27, 12); ctx.fillStyle = lin(ctx, 0, 6, 0, 60, [[0, '#fff3a0'], [0.5, '#ffd23f'], [1, '#e08a00']]); ctx.fill(); outline(ctx, 3, '#7a4300');
    shine(ctx, 26, 22, 6, 3, -0.4);
  },
  bolt(ctx) {
    ctx.beginPath(); [[36, 6], [14, 36], [29, 36], [24, 58], [50, 26], [34, 26], [42, 6]].forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 6, 0, 58, [[0, '#fff7a8'], [0.5, '#ffd000'], [1, '#ff9a00']]); ctx.fill(); outline(ctx, 3, '#7a4300');
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(35, 10); ctx.lineTo(22, 30); ctx.lineTo(27, 30); ctx.closePath(); ctx.fill();
  },
  map(ctx) {
    ctx.beginPath(); [[8, 14], [24, 8], [40, 14], [56, 8], [56, 50], [40, 56], [24, 50], [8, 56]].forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 8, 0, 56, [[0, '#fff4d6'], [1, '#e9cf95']]); ctx.fill(); outline(ctx, 3, '#6b4a1e');
    ctx.fillStyle = 'rgba(107,74,30,.18)'; ctx.fillRect(24, 8, 16, 48);
    ctx.fillStyle = '#7ec96a'; ctx.beginPath(); ctx.ellipse(18, 40, 7, 5, 0, 0, 7); ctx.fill();
    ctx.setLineDash([3, 3]); ctx.strokeStyle = '#d0342c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(14, 22); ctx.quadraticCurveTo(34, 20, 30, 34); ctx.quadraticCurveTo(28, 44, 44, 40); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#d0342c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(42, 34); ctx.lineTo(48, 42); ctx.moveTo(48, 34); ctx.lineTo(42, 42); ctx.stroke();
  },
  basket(ctx) {
    ctx.strokeStyle = '#6b3d14'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(32, 30, 16, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 28); ctx.lineTo(56, 28); ctx.lineTo(50, 56); ctx.lineTo(14, 56); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 28, 0, 56, [[0, '#e0a255'], [1, '#9a5a22']]); ctx.fill(); outline(ctx, 3, '#4a2508');
    ctx.strokeStyle = 'rgba(74,37,8,.55)'; ctx.lineWidth = 2; ctx.beginPath(); for (let y = 35; y < 56; y += 7) { ctx.moveTo(11, y); ctx.lineTo(53, y); } for (let x = 18; x < 50; x += 8) { ctx.moveTo(x, 29); ctx.lineTo(x + 1, 55); } ctx.stroke();
    rr(ctx, 6, 24, 52, 7, 3); ctx.fillStyle = '#c47f3a'; ctx.fill(); outline(ctx, 2.5, '#4a2508');
  },
  book(ctx) {
    ctx.fillStyle = '#7a3a18'; rr(ctx, 6, 16, 52, 38, 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(32, 18); ctx.quadraticCurveTo(20, 10, 9, 14); ctx.lineTo(9, 48); ctx.quadraticCurveTo(20, 44, 32, 52); ctx.quadraticCurveTo(44, 44, 55, 48); ctx.lineTo(55, 14); ctx.quadraticCurveTo(44, 10, 32, 18); ctx.closePath();
    ctx.fillStyle = '#fff6df'; ctx.fill(); outline(ctx, 2.5, '#5a2a10');
    ctx.strokeStyle = 'rgba(90,42,16,.4)'; ctx.lineWidth = 1.6; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(14, 22 + i * 7); ctx.lineTo(28, 24 + i * 7); ctx.moveTo(36, 24 + i * 7); ctx.lineTo(50, 22 + i * 7); } ctx.moveTo(32, 18); ctx.lineTo(32, 52); ctx.stroke();
  },
  friends(ctx) {
    const person = (x, y, s, c1, c2) => { ctx.fillStyle = lin(ctx, 0, y - 10 * s, 0, y + 22 * s, [[0, c1], [1, c2]]); ctx.beginPath(); ctx.arc(x, y - 6 * s, 9 * s, 0, 7); ctx.fill(); outline(ctx, 2.5); ctx.beginPath(); ctx.ellipse(x, y + 17 * s, 15 * s, 11 * s, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); outline(ctx, 2.5); };
    person(42, 26, 0.9, '#9fe3ff', '#2b8fd6'); person(24, 30, 1, '#ffe08a', '#f29a1a');
  },
  scroll(ctx) {
    rr(ctx, 14, 12, 36, 42, 3); ctx.fillStyle = lin(ctx, 0, 12, 0, 54, [[0, '#fff4d6'], [1, '#e6c98a']]); ctx.fill(); outline(ctx, 2.5, '#6b4a1e');
    for (const y of [10, 52]) { rr(ctx, 9, y - 4, 46, 9, 4.5); ctx.fillStyle = '#c9954a'; ctx.fill(); outline(ctx, 2.5, '#5a3510'); }
    ctx.strokeStyle = 'rgba(107,74,30,.5)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(20, 21 + i * 7); ctx.lineTo(i === 3 ? 34 : 44, 21 + i * 7); } ctx.stroke();
    ctx.fillStyle = '#d0342c'; ctx.beginPath(); ctx.arc(42, 44, 5, 0, 7); ctx.fill();
  },
  board(ctx) {
    rr(ctx, 12, 10, 40, 48, 5); ctx.fillStyle = lin(ctx, 0, 10, 0, 58, [[0, '#d99a52'], [1, '#9a5a22']]); ctx.fill(); outline(ctx, 3, '#4a2508');
    rr(ctx, 17, 17, 30, 36, 2); ctx.fillStyle = '#fffaf0'; ctx.fill();
    rr(ctx, 24, 6, 16, 9, 3); ctx.fillStyle = '#b8c2c8'; ctx.fill(); outline(ctx, 2.5, '#3b4348');
    ctx.strokeStyle = '#2ea34a'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(20, 26 + i * 9); ctx.lineTo(23, 29 + i * 9); ctx.lineTo(27, 23 + i * 9); } ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(31, 26 + i * 9); ctx.lineTo(43, 26 + i * 9); } ctx.stroke();
  },
  wheat(ctx) {
    ctx.strokeStyle = '#9a6b12'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(32, 58); ctx.quadraticCurveTo(31, 36, 33, 12); ctx.stroke();
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const y = 16 + i * 8; ctx.save(); ctx.translate(32 + s * 5, y); ctx.rotate(s * 0.55); ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 8, 0, 0, 7); ctx.fillStyle = lin(ctx, 0, -8, 0, 8, [[0, '#ffe38a'], [1, '#e0a020']]); ctx.fill(); outline(ctx, 1.8, '#7a4a00'); ctx.restore(); }
    ctx.beginPath(); ctx.ellipse(33, 10, 4, 7, 0, 0, 7); ctx.fillStyle = '#ffe38a'; ctx.fill(); outline(ctx, 1.8, '#7a4a00');
  },
  ticket(ctx) {
    ctx.save(); ctx.translate(32, 32); ctx.rotate(-0.25);
    ctx.beginPath(); ctx.moveTo(-26, -15); ctx.lineTo(26, -15); ctx.lineTo(26, -5); ctx.arc(26, 0, 5, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(26, 15); ctx.lineTo(-26, 15); ctx.lineTo(-26, 5); ctx.arc(-26, 0, 5, Math.PI / 2, -Math.PI / 2, true); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, -15, 0, 15, [[0, '#ff8fb0'], [1, '#d6245a']]); ctx.fill(); outline(ctx, 3, '#5e0a24');
    ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -12); ctx.lineTo(10, 12); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffe38a'; star(ctx, -8, 0, 9, 4); ctx.fill(); ctx.restore();
  },
  shop(ctx) {
    rr(ctx, 10, 28, 44, 28, 3); ctx.fillStyle = lin(ctx, 0, 28, 0, 56, [[0, '#e7b77a'], [1, '#a8662c']]); ctx.fill(); outline(ctx, 3, '#4a2508');
    rr(ctx, 26, 38, 13, 18, 2); ctx.fillStyle = '#6b3d14'; ctx.fill();
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(6 + i * 10.4, 14); ctx.lineTo(16.4 + i * 10.4, 14); ctx.lineTo(16.4 + i * 10.4, 26); ctx.arc(11.2 + i * 10.4, 26, 5.2, 0, Math.PI); ctx.closePath(); ctx.fillStyle = i % 2 ? '#fff6e8' : '#e8413a'; ctx.fill(); }
    ctx.beginPath(); ctx.rect(6, 12, 52, 3); ctx.fillStyle = '#9a2a20'; ctx.fill();
    ctx.strokeStyle = 'rgba(74,37,8,.9)'; ctx.lineWidth = 2.5; ctx.strokeRect(6, 12, 52, 14);
  },
  hammer(ctx) {
    ctx.save(); ctx.translate(32, 32); ctx.rotate(-0.7);
    rr(ctx, -4, -6, 8, 34, 3); ctx.fillStyle = lin(ctx, -4, 0, 4, 0, [[0, '#d99a52'], [1, '#8a4f1c']]); ctx.fill(); outline(ctx, 2.5, '#4a2508');
    rr(ctx, -17, -20, 34, 15, 4); ctx.fillStyle = lin(ctx, 0, -20, 0, -5, [[0, '#e3e9ee'], [1, '#7c8a94']]); ctx.fill(); outline(ctx, 2.5, '#2a3238');
    ctx.restore();
  },
  egg(ctx) {
    ctx.beginPath(); ctx.ellipse(32, 36, 17, 22, 0, 0, 7); ctx.fillStyle = rad(ctx, 32, 34, 24, [[0, '#ffffff'], [0.6, '#fbeed8'], [1, '#d9c2a0']]); ctx.fill(); outline(ctx, 3, '#6b4a1e');
    ctx.fillStyle = 'rgba(160,120,70,.35)'; [[26, 44, 2.5], [38, 30, 2], [36, 48, 1.8]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
    shine(ctx, 26, 24, 5, 3, -0.5);
  },
  sign(ctx) {
    ctx.fillStyle = '#6b3d14'; ctx.fillRect(29, 34, 6, 24); ctx.strokeStyle = '#3a1e06'; ctx.lineWidth = 2; ctx.strokeRect(29, 34, 6, 24);
    rr(ctx, 6, 12, 52, 26, 5); ctx.fillStyle = lin(ctx, 0, 12, 0, 38, [[0, '#e3a860'], [1, '#a8662c']]); ctx.fill(); outline(ctx, 3, '#4a2508');
    ctx.fillStyle = '#2ee06a'; ctx.beginPath(); ctx.moveTo(26, 18); ctx.lineTo(40, 25); ctx.lineTo(26, 32); ctx.closePath(); ctx.fill(); outline(ctx, 2, '#04220e');
  },
};
// emoji → ikon eşlemesi (düğme etiketlerinin başındaki emoji otomatik ikona döner)
export const EMOJI_ICON = {
  '🪙': 'coin', '💎': 'gem', '❤️': 'heart', '❤': 'heart', '⭐': 'star', '⚡': 'bolt', '🗺': 'map', '🗺️': 'map', '🧺': 'basket', '📖': 'book', '👥': 'friends',
  '📜': 'scroll', '📋': 'board', '🌾': 'wheat', '🎟️': 'ticket', '🎟': 'ticket', '🏪': 'shop', '✋': 'hammer', '🥚': 'egg', '🪺': 'egg', '🪧': 'sign',
};

export function buildIcons(scene) {
  if (scene.textures.exists('ic-coin')) return;
  for (const [name, fn] of Object.entries(DRAW)) {
    const off = document.createElement('canvas'); off.width = off.height = S * SS;
    const octx = off.getContext('2d'); octx.scale(SS, SS);
    octx.shadowColor = 'rgba(0,0,0,0)'; fn(octx);
    const tex = scene.textures.createCanvas(`ic-${name}`, S, S);
    const ctx = tex.getContext(); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(off, 0, 0, S, S); tex.refresh();
  }
}
export function iconKey(emoji) { const n = EMOJI_ICON[emoji]; return n ? `ic-${n}` : null; }
// "🗺 Harita" → { key:'ic-map', rest:'Harita' } ; eşleşme yoksa null
export function splitIcon(label) {
  const s = String(label ?? '');
  for (const e of Object.keys(EMOJI_ICON).sort((a, b) => b.length - a.length)) if (s.startsWith(e)) return { key: `ic-${EMOJI_ICON[e]}`, rest: s.slice(e.length).trim() };
  return null;
}
