// Procedural jewel art via Canvas (zero external assets).
// Everything is drawn at 2x resolution and downsampled for crisp edges.
import { CONFIG } from './config.js';

export const CELL = 64;
const SS = 2; // supersample

function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }
function rgb(n) { return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(n, f, a = 1) {
  const [r, g, b] = rgb(n).map((v) => Math.max(0, Math.min(255, v * f)));
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}
function mix(n, m, t) { const a = rgb(n), b = rgb(m); return `rgb(${a.map((v, i) => (v + (b[i] - v) * t) | 0).join(',')})`; }

// ---------- silhouettes (polygon points) ----------
function poly(type, s) {
  const c = s / 2, r = s * 0.41, pts = [];
  const reg = (n, rot, rx = r, ry = r) => { for (let i = 0; i < n; i++) { const a = (Math.PI * 2 / n) * i + rot; pts.push([c + rx * Math.cos(a), c + ry * Math.sin(a)]); } };
  switch (type) {
    case 0: reg(8, -Math.PI / 8); break;                           // elmas: octagon (brilliant top view)
    case 1: reg(6, -Math.PI / 2); break;                           // yakut: hexagon, pointy top
    case 2: { const w = r * 0.78, h = r * 1.0, k = r * 0.3;        // zumrut: emerald step cut
      pts.push([c - w + k, c - h], [c + w - k, c - h], [c + w, c - h + k], [c + w, c + h - k], [c + w - k, c + h], [c - w + k, c + h], [c - w, c + h - k], [c - w, c - h + k]); break; }
    case 3: reg(12, -Math.PI / 2, r * 0.8, r * 1.02); break;       // safir: oval
    case 4: { const w = r * 0.92, k = r * 0.28;                    // altin: cushion square
      pts.push([c - w + k, c - w], [c + w - k, c - w], [c + w, c - w + k], [c + w, c + w - k], [c + w - k, c + w], [c - w + k, c + w], [c - w, c + w - k], [c - w, c - w + k]); break; }
    default: reg(5, -Math.PI / 2, r * 1.02, r * 1.02);             // gumus: pentagon crystal
  }
  return pts;
}
function tracePoly(ctx, pts, round = 0) {
  ctx.beginPath();
  if (!round) { pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); return; }
  // rounded corners
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    const a = [p1[0] + v1[0] / l1 * round, p1[1] + v1[1] / l1 * round], b = [p1[0] + v2[0] / l2 * round, p1[1] + v2[1] / l2 * round];
    if (i === 0) ctx.moveTo(a[0], a[1]); else ctx.lineTo(a[0], a[1]);
    ctx.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  ctx.closePath();
}

// ---------- jewel renderer ----------
function drawJewel(ctx, type, s, special) {
  const col = CONFIG.gemColors[type];
  const c = s / 2;
  const pts = poly(type, s);
  const round = type === 3 ? s * 0.06 : s * 0.03;
  const metallic = type === 4 || type === 5;
  const inner = pts.map(([x, y]) => [c + (x - c) * 0.52, c + (y - c) * 0.52]);

  // drop shadow
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = s * 0.08; ctx.shadowOffsetY = s * 0.06;
  tracePoly(ctx, pts, round); ctx.fillStyle = shade(col, 0.35); ctx.fill(); ctx.restore();

  // Style B "3D cut": hard flat-shaded crown facets between outer and inner polygon.
  // Each facet gets one solid tone from its angle to the light (no soft gradients).
  const light = -Math.PI * 0.7;
  ctx.save(); tracePoly(ctx, pts, round); ctx.clip();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ai = inner[i], bi = inner[(i + 1) % pts.length];
    const mx = (a[0] + b[0]) / 2 - c, my = (a[1] + b[1]) / 2 - c;
    const l = Math.cos(Math.atan2(my, mx) - light);        // -1 .. 1
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(bi[0], bi[1]); ctx.lineTo(ai[0], ai[1]); ctx.closePath();
    ctx.fillStyle = shade(col, 0.72 + l * 0.5); ctx.fill();
  }
  // table (flat top facet): crisp diagonal gradient, bright to deep
  const tg = ctx.createLinearGradient(c - s * 0.26, c - s * 0.26, c + s * 0.26, c + s * 0.26);
  tg.addColorStop(0, shade(col, 1.55)); tg.addColorStop(0.5, hex(col)); tg.addColorStop(1, shade(col, 0.7));
  tracePoly(ctx, inner); ctx.fillStyle = tg; ctx.fill();
  if (type === 2) { // emerald step ring
    const mid = pts.map(([x, y]) => [c + (x - c) * 0.78, c + (y - c) * 0.78]);
    tracePoly(ctx, mid); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = s * 0.012; ctx.stroke();
  }
  // facet edges
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = s * 0.012;
  tracePoly(ctx, inner); ctx.stroke();
  ctx.beginPath(); for (let i = 0; i < pts.length; i++) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(inner[i][0], inner[i][1]); } ctx.stroke();
  // metallic sheen band
  if (metallic) {
    const sg = ctx.createLinearGradient(0, s, s, 0);
    sg.addColorStop(0.38, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.5)'); sg.addColorStop(0.62, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, s, s);
  }
  // sharp triangular glint on the table (signature of the cut look)
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.beginPath(); ctx.moveTo(c - s * 0.15, c - s * 0.17); ctx.lineTo(c - s * 0.05, c - s * 0.23); ctx.lineTo(c - s * 0.01, c - s * 0.12); ctx.closePath(); ctx.fill();

  // ----- specials -----
  if (special === 'line_h' || special === 'line_v') {
    ctx.save();
    if (special === 'line_v') { ctx.translate(c, c); ctx.rotate(Math.PI / 2); ctx.translate(-c, -c); }
    ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = s * 0.08;
    for (let i = -1; i <= 1; i++) {
      const y = c + i * s * 0.17, h = i ? s * 0.045 : s * 0.07;
      const lg = ctx.createLinearGradient(0, 0, s, 0);
      lg.addColorStop(0, 'rgba(255,255,255,.2)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,.2)');
      ctx.fillStyle = lg; ctx.fillRect(0, y - h / 2, s, h);
    }
    // arrow heads
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(s * 0.06, c); ctx.lineTo(s * 0.2, c - s * 0.11); ctx.lineTo(s * 0.2, c + s * 0.11); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.94, c); ctx.lineTo(s * 0.8, c - s * 0.11); ctx.lineTo(s * 0.8, c + s * 0.11); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (special === 'bomb') {
    // dark core with glowing fuse-ring + sparkles (wrapped)
    ctx.save(); ctx.shadowColor = shade(col, 1.8); ctx.shadowBlur = s * 0.12;
    const bg = ctx.createRadialGradient(c - s * 0.05, c - s * 0.06, 0, c, c, s * 0.24);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.35, shade(col, 1.5)); bg.addColorStop(0.75, 'rgba(20,10,30,1)'); bg.addColorStop(1, 'rgba(20,10,30,1)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(c, c, s * 0.24, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.arc(c, c, s * 0.24, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) { const a = Math.PI / 4 * i; const rr = s * 0.33; star(ctx, c + rr * Math.cos(a), c + rr * Math.sin(a), i % 2 ? s * 0.035 : s * 0.055); }
  }
  ctx.restore();
  // outline: dark inner + bright outer
  tracePoly(ctx, pts, round); ctx.strokeStyle = 'rgba(0,0,20,.45)'; ctx.lineWidth = s * 0.035; ctx.stroke();
  tracePoly(ctx, pts, round); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = s * 0.014; ctx.stroke();
  // top-right sparkle
  ctx.fillStyle = 'rgba(255,255,255,.95)'; star(ctx, c + s * 0.17, c - s * 0.2, s * 0.1);
}

function star(ctx, x, y, r, n = 4) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = Math.PI / n * i - Math.PI / 2; const rr = i % 2 ? r * 0.3 : r; ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
  ctx.closePath(); ctx.fill();
}

// prism = colour bomb: dark glossy sphere covered with coloured sparks
function drawPrism(ctx, s) {
  const c = s / 2, r = s * 0.4;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = s * 0.1; ctx.shadowOffsetY = s * 0.05;
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fillStyle = '#1a1030'; ctx.fill(); ctx.restore();
  const g = ctx.createRadialGradient(c - r * 0.4, c - r * 0.45, r * 0.05, c, c, r);
  g.addColorStop(0, '#6a5a9a'); g.addColorStop(0.5, '#2a1c4e'); g.addColorStop(1, '#0c0818');
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.clip();
  const cols = ['#ff4d6d', '#ffb000', '#3dff7a', '#3fa9ff', '#c86bff', '#ffffff', '#5ff3ff'];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.85;
    const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
    ctx.save(); ctx.shadowColor = cols[i % cols.length]; ctx.shadowBlur = s * 0.05;
    ctx.fillStyle = cols[i % cols.length]; star(ctx, x, y, s * (0.035 + rnd() * 0.04)); ctx.restore();
  }
  ctx.restore();
  const hg = ctx.createRadialGradient(c - r * 0.4, c - r * 0.5, 0, c - r * 0.4, c - r * 0.5, r * 0.6);
  hg.addColorStop(0, 'rgba(255,255,255,.9)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(c - r * 0.4, c - r * 0.5, r * 0.5, r * 0.32, -0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = s * 0.02; ctx.stroke();
}

// ---------- board & misc ----------
function drawTile(ctx, s, alt) {
  const p = s * 0.03;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = s * 0.06; ctx.shadowOffsetY = s * 0.03;
  ctx.fillStyle = alt ? 'rgba(18,30,26,.9)' : 'rgba(26,42,36,.9)';
  ctx.beginPath(); ctx.roundRect(p, p, s - 2 * p, s - 2 * p, s * 0.14); ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,.25)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(p, p, s - 2 * p, s - 2 * p, s * 0.14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = s * 0.02; ctx.beginPath(); ctx.roundRect(p + 1, p + 1, s - 2 * p - 2, s - 2 * p - 2, s * 0.13); ctx.stroke();
}
function drawJelly(ctx, s, strong) {
  const p = s * 0.05;
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, strong ? 'rgba(150,90,255,.85)' : 'rgba(150,100,255,.5)'); g.addColorStop(1, strong ? 'rgba(80,20,200,.9)' : 'rgba(90,40,220,.55)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(p, p, s - 2 * p, s - 2 * p, s * 0.16); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.roundRect(p + s * 0.08, p + s * 0.06, s * 0.5, s * 0.16, s * 0.08); ctx.fill();
  ctx.strokeStyle = strong ? 'rgba(230,210,255,.95)' : 'rgba(210,190,255,.7)'; ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.roundRect(p, p, s - 2 * p, s - 2 * p, s * 0.16); ctx.stroke();
}
function drawRock(ctx, s, dark) {
  const p = s * 0.06;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = s * 0.06; ctx.shadowOffsetY = s * 0.04;
  const g = ctx.createRadialGradient(s * 0.35, s * 0.3, s * 0.05, s / 2, s / 2, s * 0.6);
  g.addColorStop(0, dark ? '#5a5f68' : '#8a9099'); g.addColorStop(1, dark ? '#24272d' : '#40454d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(p, p, s - 2 * p, s - 2 * p, s * 0.1); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = s * 0.035;
  ctx.beginPath(); ctx.moveTo(s * 0.2, s * 0.3); ctx.lineTo(s * 0.45, s * 0.5); ctx.lineTo(s * 0.35, s * 0.8); ctx.moveTo(s * 0.45, s * 0.5); ctx.lineTo(s * 0.75, s * 0.4); ctx.stroke();
  if (dark) { ctx.beginPath(); ctx.moveTo(s * 0.6, s * 0.15); ctx.lineTo(s * 0.7, s * 0.35); ctx.lineTo(s * 0.85, s * 0.3); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.roundRect(p + 2, p + 2, s - 2 * p - 4, s - 2 * p - 4, s * 0.09); ctx.stroke();
}
function drawStar(ctx, s, on) {
  const c = s / 2;
  ctx.save(); if (on) { ctx.shadowColor = 'rgba(255,200,40,.9)'; ctx.shadowBlur = s * 0.12; }
  const g = ctx.createRadialGradient(c - s * 0.1, c - s * 0.12, s * 0.05, c, c, s * 0.45);
  if (on) { g.addColorStop(0, '#fff6c0'); g.addColorStop(0.5, '#ffc21a'); g.addColorStop(1, '#e08a00'); }
  else { g.addColorStop(0, '#5a5f6a'); g.addColorStop(1, '#2a2e36'); }
  ctx.fillStyle = g; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2; const rr = i % 2 ? s * 0.2 : s * 0.44; ctx.lineTo(c + rr * Math.cos(a), c + rr * Math.sin(a)); }
  ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.strokeStyle = on ? '#a86e00' : '#1a1c22'; ctx.lineWidth = s * 0.03; ctx.stroke();
  if (on) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(c - s * 0.08, c - s * 0.12, s * 0.12, s * 0.06, -0.6, 0, Math.PI * 2); ctx.fill(); }
}

export function buildTextures(scene) {
  const s = CELL;
  // draw at SS× on an offscreen canvas, downsample into the Phaser canvas texture
  const make = (key, fn, w = s, h = s) => {
    const off = document.createElement('canvas'); off.width = w * SS; off.height = h * SS;
    const octx = off.getContext('2d'); octx.scale(SS, SS); fn(octx, w, h);
    const tex = scene.textures.createCanvas(key, w, h);
    const ctx = tex.getContext(); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(off, 0, 0, w, h);
    tex.refresh();
  };
  for (let t = 0; t < CONFIG.gemTypes; t++) {
    make(`gem${t}`, (ctx) => drawJewel(ctx, t, s, null));
    make(`gem${t}_line_h`, (ctx) => drawJewel(ctx, t, s, 'line_h'));
    make(`gem${t}_line_v`, (ctx) => drawJewel(ctx, t, s, 'line_v'));
    make(`gem${t}_bomb`, (ctx) => drawJewel(ctx, t, s, 'bomb'));
  }
  make('prism', (ctx) => drawPrism(ctx, s));
  make('tile', (ctx) => drawTile(ctx, s, false));
  make('tile2', (ctx) => drawTile(ctx, s, true));
  make('jelly1', (ctx) => drawJelly(ctx, s, false));
  make('jelly2', (ctx) => drawJelly(ctx, s, true));
  make('rock1', (ctx) => drawRock(ctx, s, false));
  make('rock2', (ctx) => drawRock(ctx, s, true));
  // F13 engelleri
  for (const lv of [1, 2]) make(`ice${lv}`, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, `rgba(225,248,255,${lv > 1 ? 0.78 : 0.6})`); g.addColorStop(0.5, `rgba(150,215,245,${lv > 1 ? 0.62 : 0.45})`); g.addColorStop(1, `rgba(90,170,225,${lv > 1 ? 0.75 : 0.55})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(s * 0.04, s * 0.04, s * 0.92, s * 0.92, s * 0.16); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = s * 0.045; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(s * 0.14, s * 0.2); ctx.lineTo(s * 0.42, s * 0.12); ctx.lineTo(s * 0.18, s * 0.42); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = s * 0.02; ctx.beginPath();
    ctx.moveTo(s * 0.62, s * 0.62); ctx.lineTo(s * 0.82, s * 0.86); ctx.moveTo(s * 0.62, s * 0.62); ctx.lineTo(s * 0.88, s * 0.58);
    if (lv > 1) { ctx.moveTo(s * 0.3, s * 0.72); ctx.lineTo(s * 0.5, s * 0.55); ctx.lineTo(s * 0.46, s * 0.86); }
    ctx.stroke();
  });
  make('fence', (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(s * 0.06, s * 0.84, s * 0.88, s * 0.08);
    const plank = (x) => {
      const g = ctx.createLinearGradient(x, 0, x + s * 0.2, 0); g.addColorStop(0, '#c98a4a'); g.addColorStop(0.5, '#e7b06c'); g.addColorStop(1, '#9a5f2a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, s * 0.22); ctx.lineTo(x + s * 0.1, s * 0.08); ctx.lineTo(x + s * 0.2, s * 0.22); ctx.lineTo(x + s * 0.2, s * 0.88); ctx.lineTo(x, s * 0.88); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5b3414'; ctx.lineWidth = s * 0.025; ctx.stroke();
    };
    for (const x of [0.08, 0.4, 0.72]) plank(s * x);
    for (const y of [0.34, 0.66]) { ctx.fillStyle = '#8a531f'; ctx.fillRect(s * 0.04, s * y, s * 0.92, s * 0.1); ctx.strokeStyle = '#5b3414'; ctx.strokeRect(s * 0.04, s * y, s * 0.92, s * 0.1);
      ctx.fillStyle = '#d9d9d9'; for (const x of [0.18, 0.5, 0.82]) { ctx.beginPath(); ctx.arc(s * x, s * (y + 0.05), s * 0.022, 0, 7); ctx.fill(); } }
  });
  make('mud', (ctx) => {
    const g = ctx.createRadialGradient(s * 0.42, s * 0.38, s * 0.05, s * 0.5, s * 0.5, s * 0.5);
    g.addColorStop(0, '#8a5a32'); g.addColorStop(0.7, '#5e3a1c'); g.addColorStop(1, '#3d2410');
    ctx.fillStyle = g; ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, rr = s * (0.4 + (i % 2 ? 0.05 : -0.02)); const x = s * 0.5 + Math.cos(a) * rr, y = s * 0.52 + Math.sin(a) * rr * 0.9; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,190,.35)'; for (const [x, y, r] of [[0.36, 0.34, 0.07], [0.6, 0.3, 0.04], [0.66, 0.6, 0.05]]) { ctx.beginPath(); ctx.arc(s * x, s * y, s * r, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#2e1a0a'; for (const [x, y, r] of [[0.46, 0.64, 0.05], [0.3, 0.56, 0.03]]) { ctx.beginPath(); ctx.arc(s * x, s * y, s * r, 0, 7); ctx.fill(); }
  });
  make('lock', (ctx) => {
    // hafif karartma: kilitli taş "donmuş" görünsün
    ctx.fillStyle = 'rgba(20,28,40,.22)'; ctx.beginPath(); ctx.roundRect(s * 0.04, s * 0.04, s * 0.92, s * 0.92, s * 0.14); ctx.fill();
    // çapraz zincir: kalın, birbirine geçmiş çelik halkalar
    const link = (x, y, ang, flat) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      const w = s * (flat ? 0.17 : 0.19), h = s * (flat ? 0.055 : 0.12);
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
      ctx.strokeStyle = '#262b34'; ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowColor = 'transparent';
      const g = ctx.createLinearGradient(0, -h / 2 - s * 0.03, 0, h / 2 + s * 0.03); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#d7dce5'); g.addColorStop(0.6, '#8f97a6'); g.addColorStop(1, '#5a616e');
      ctx.strokeStyle = g; ctx.lineWidth = s * 0.045; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = s * 0.012; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
      ctx.restore();
    };
    for (const dir of [1, -1]) {
      const ang = dir * Math.PI / 4, n = 6;
      for (let i = 0; i < n; i++) {
        const t = 0.07 + (0.86 * i) / (n - 1);
        if (Math.abs(t - 0.5) < 0.15) continue; // ortada asma kilit
        link(s * t, dir > 0 ? s * t : s * (1 - t), ang, i % 2 === 1);
      }
    }
    ctx.save(); ctx.lineCap = 'round';
    const cx = s * 0.5;
    // kulp
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
    ctx.strokeStyle = '#2f343d'; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.arc(cx, s * 0.44, s * 0.125, Math.PI, 0); ctx.stroke();
    ctx.shadowColor = 'transparent';
    const sg = ctx.createLinearGradient(cx - s * 0.15, 0, cx + s * 0.15, 0); sg.addColorStop(0, '#7d8594'); sg.addColorStop(0.45, '#ffffff'); sg.addColorStop(0.7, '#b9c0cc'); sg.addColorStop(1, '#6b7280');
    ctx.strokeStyle = sg; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.arc(cx, s * 0.44, s * 0.125, Math.PI, 0); ctx.stroke();
    // gövde
    const bx = s * 0.28, by = s * 0.42, bw = s * 0.44, bh = s * 0.36, rr = s * 0.08;
    ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#6e4204'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, rr); ctx.fill();
    ctx.shadowColor = 'transparent';
    const bg = ctx.createLinearGradient(0, by, 0, by + bh); bg.addColorStop(0, '#fff0a8'); bg.addColorStop(0.3, '#ffcc3a'); bg.addColorStop(0.7, '#e89a0e'); bg.addColorStop(1, '#a8660a');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(bx + s * 0.018, by + s * 0.018, bw - s * 0.036, bh - s * 0.036, rr * 0.8); ctx.fill();
    // üst parlama
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.roundRect(bx + s * 0.05, by + s * 0.035, bw - s * 0.1, s * 0.06, s * 0.03); ctx.fill();
    // perçinler
    for (const [ix, iy] of [[0.13, 0.25], [0.87, 0.25], [0.13, 0.8], [0.87, 0.8]]) {
      const px = bx + bw * ix, py = by + bh * iy;
      const rg = ctx.createRadialGradient(px - s * 0.006, py - s * 0.006, 0, px, py, s * 0.02); rg.addColorStop(0, '#fff6c8'); rg.addColorStop(1, '#8a5406');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, s * 0.018, 0, Math.PI * 2); ctx.fill();
    }
    // anahtar deliği (gömme halka + delik)
    const ky = by + bh * 0.5;
    ctx.fillStyle = '#b07a12'; ctx.beginPath(); ctx.arc(cx, ky, s * 0.058, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,180,.8)'; ctx.lineWidth = s * 0.01; ctx.beginPath(); ctx.arc(cx, ky, s * 0.058, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = '#2e1a01'; ctx.beginPath(); ctx.arc(cx, ky - s * 0.01, s * 0.024, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - s * 0.011, ky); ctx.lineTo(cx + s * 0.011, ky); ctx.lineTo(cx + s * 0.018, ky + s * 0.045); ctx.lineTo(cx - s * 0.018, ky + s * 0.045); ctx.closePath(); ctx.fill();
    ctx.restore();
  });
  make('lockedgem', (ctx) => { const g = ctx.createRadialGradient(s * 0.4, s * 0.4, 2, s / 2, s / 2, s * 0.4); g.addColorStop(0, '#c7cedb'); g.addColorStop(1, '#5e6675'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2); ctx.fill(); });

  // ----- particles / fx -----
  make('particle', (ctx) => { const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.3); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); });
  make('shard', (ctx) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.15); ctx.lineTo(s * 0.72, s * 0.5); ctx.lineTo(s * 0.5, s * 0.85); ctx.lineTo(s * 0.28, s * 0.5); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.15); ctx.lineTo(s * 0.72, s * 0.5); ctx.lineTo(s * 0.5, s * 0.5); ctx.closePath(); ctx.fill(); }, 32, 32);
  make('spark', (ctx) => { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 6; ctx.fillStyle = '#fff'; star(ctx, s / 2, s / 2, s * 0.45); ctx.restore(); });
  make('glow', (ctx, w) => { const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, w); }, 128, 128);
  make('ring', (ctx, w) => { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2 - 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }, 128, 128);
  make('beam', (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, 'rgba(255,255,255,.8)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(0.65, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }, 64, 40);
  make('flare', (ctx, w) => { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 8; ctx.fillStyle = '#fff'; star(ctx, w / 2, w / 2, w * 0.48, 4); ctx.restore(); star(ctx, w / 2, w / 2, w * 0.25, 4); }, 96, 96);

  // ----- HUD -----
  make('star', (ctx) => drawStar(ctx, s, true));
  make('stargray', (ctx) => drawStar(ctx, s, false));
  make('heart', (ctx) => { const c = s / 2; ctx.save(); ctx.shadowColor = 'rgba(255,60,90,.7)'; ctx.shadowBlur = s * 0.1; const g = ctx.createRadialGradient(c - s * 0.1, c - s * 0.05, 2, c, c, s * 0.4); g.addColorStop(0, '#ff8ca0'); g.addColorStop(0.6, '#ff3b5c'); g.addColorStop(1, '#a8102c'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c, s * 0.82); ctx.bezierCurveTo(s * 0.05, s * 0.5, s * 0.15, s * 0.12, c, s * 0.34); ctx.bezierCurveTo(s * 0.85, s * 0.12, s * 0.95, s * 0.5, c, s * 0.82); ctx.fill(); ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(s * 0.36, s * 0.36, s * 0.09, s * 0.05, -0.5, 0, Math.PI * 2); ctx.fill(); });
  make('coin', (ctx) => { const c = s / 2; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2; const g = ctx.createRadialGradient(c - 8, c - 8, 4, c, c, s * 0.42); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.6, '#ffc21a'); g.addColorStop(1, '#c97e00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, s * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#a86e00'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c, c, s * 0.32, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#a86e00'; ctx.font = `bold ${s * 0.42}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', c, c + 1); });
  make('bgGrad', (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#12332a'); g.addColorStop(0.5, '#0b1a15'); g.addColorStop(1, '#050a08'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); const v = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.2, w / 2, h * 0.5, w * 0.9); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); }, 270, 480);
}

export function gemKey(g) {
  if (!g) return null;
  if (g.locked && g.type < 0) return 'lockedgem';
  if (g.special === 'prism') return 'prism';
  return g.special ? `gem${g.type}_${g.special}` : `gem${g.type}`;
}
