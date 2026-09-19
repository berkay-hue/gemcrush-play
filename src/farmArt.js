// Procedural 2.5D farm art (original, Hay Day-inspired style): soft shading,
// thick outlines, chunky shapes. Everything drawn on canvas, no image assets.
const OUT = '#4a2f14';
function tex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const ct = scene.textures.createCanvas(key, w, h); const x = ct.getContext();
  x.lineJoin = 'round'; x.lineCap = 'round'; draw(x); ct.refresh();
}
function blob(x, cx, cy, rx, ry, fill, hi, lw = 3) {
  const g = x.createRadialGradient(cx - rx * 0.35, cy - ry * 0.4, 1, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, hi); g.addColorStop(1, fill);
  x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fillStyle = g; x.fill();
  x.lineWidth = lw; x.strokeStyle = OUT; x.stroke();
}
// frame: 0/1 walk, 2 peck; rooster: bigger comb + dark glossy tail. 120x110 canvas, ~¾ view shading
function chicken(x, f, rooster = false) {
  const rg = (cx, cy, r, a, b, d) => { const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.1); g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, d); return g; };
  const ell = (cx, cy, rx, ry, rot, fill, lw = 3) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, 7); x.fillStyle = fill; x.fill(); if (lw) { x.lineWidth = lw; x.strokeStyle = OUT; x.stroke(); } };
  const by = f === 1 ? -3 : 0, peck = f === 2;
  const leg = (lx, ly, a) => {
    x.strokeStyle = '#c9731c'; x.lineWidth = 5; const ex = lx + Math.sin(a) * 14, ey = ly + Math.cos(a) * 14;
    x.beginPath(); x.moveTo(lx, ly); x.lineTo(ex, ey); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.moveTo(ex - 6, ey + 1); x.lineTo(ex + 7, ey + 1); x.moveTo(ex, ey); x.lineTo(ex + 5, ey - 3); x.stroke();
  };
  leg(52, 80 + by, f === 0 ? 0.35 : -0.25); leg(64, 80 + by, f === 0 ? -0.3 : 0.3);
  const tail = rooster ? [['#1f5a3a', '#0f2e22'], ['#b8561c', '#6e2c0c'], ['#2b7a4c', '#123a26']] : [['#e9dcc6', '#cdb89a'], ['#f4ead9', '#cdb89a'], ['#fbf5ea', '#cdb89a']];
  [-0.9, -0.5, -0.15].forEach((a, i) => ell(26 + i * 3, 42 + by + i * 3 - (rooster ? 6 : 0), 9, rooster ? 28 : 22, a, rg(26, 38 + by, 22, '#fff', tail[i][0], tail[i][1])));
  ell(58, 60 + by, 34, 27, -0.12, rg(58, 60 + by, 34, '#ffffff', '#f6efe2', '#cbb596'));
  x.save(); x.beginPath(); x.ellipse(58, 60 + by, 34, 27, -0.12, 0, 7); x.clip();
  x.fillStyle = 'rgba(160,120,80,.18)'; x.beginPath(); x.ellipse(60, 86 + by, 36, 14, 0, 0, 7); x.fill(); x.restore();
  ell(52, 62 + by, 17, 12, 0.25, rg(50, 60 + by, 17, '#fffaf0', '#efe2cc', '#c7ad88'), 2.5);
  x.strokeStyle = 'rgba(120,85,50,.55)'; x.lineWidth = 1.8;
  for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(58 - i * 6, 66 + by, 8, 0.2, 1.6); x.stroke(); }
  const hx = peck ? 92 : 84, hy = (peck ? 58 : 30) + by;
  ell((58 + hx) / 2 + 6, (50 + hy) / 2 + 4, 14, 17, peck ? -1 : 0.3, rg(78, 44, 18, '#fff', '#f6efe2', '#d8c4a6'), 0);
  const cs = rooster ? 1.4 : 1;
  [[-7, -14, 6], [0, -17, 7], [7, -13, 6]].forEach(([dx, dy, r]) => ell(hx + dx * cs, hy + dy * cs, r * cs, r * cs, 0, rg(hx + dx, hy + dy, r, '#ff7a6b', '#e3322a', '#9e1a14'), 2.5));
  ell(hx, hy, 15, 14, 0, rg(hx, hy, 15, '#ffffff', '#f7f0e4', '#d6c2a2'));
  const bx = hx + 13, bk = hy + 2;
  x.beginPath(); x.moveTo(bx - 2, bk - 6); x.lineTo(bx + 13, bk + (peck ? 6 : 1)); x.lineTo(bx - 2, bk + 5); x.closePath();
  const gb = x.createLinearGradient(bx, bk - 6, bx, bk + 5); gb.addColorStop(0, '#ffd35a'); gb.addColorStop(1, '#e08a12');
  x.fillStyle = gb; x.fill(); x.lineWidth = 2.5; x.strokeStyle = OUT; x.stroke();
  ell(bx + 1, bk + 11, 4 * cs, 6 * cs, 0, rg(bx, bk + 10, 6, '#ff6f60', '#d92a22', '#931810'), 2);
  ell(hx + 5, hy - 3, 4.2, 5, 0, '#2a1a10', 0); ell(hx + 6.3, hy - 5, 1.6, 1.6, 0, '#fff', 0);
  ell(hx + 1, hy + 5, 4, 2.5, 0, 'rgba(255,140,140,.45)', 0);
}
function soil(x, w, h) {
  // raised 2.5D bed: side face + top with furrows
  x.fillStyle = '#6b4220'; x.beginPath(); x.roundRect(4, 14, w - 8, h - 16, 16); x.fill();
  const g = x.createLinearGradient(0, 4, 0, h - 14); g.addColorStop(0, '#b27a45'); g.addColorStop(1, '#8e5a2c');
  x.fillStyle = g; x.beginPath(); x.roundRect(4, 4, w - 8, h - 22, 16); x.fill();
  x.lineWidth = 3; x.strokeStyle = OUT; x.stroke();
  x.strokeStyle = 'rgba(70,40,15,.45)'; x.lineWidth = 4;
  for (let i = 1; i < 4; i++) { const y = 4 + i * (h - 22) / 4; x.beginPath(); x.moveTo(16, y); x.lineTo(w - 16, y); x.stroke(); }
  x.strokeStyle = 'rgba(255,220,170,.25)'; x.lineWidth = 2;
  for (let i = 1; i < 4; i++) { const y = 2 + i * (h - 22) / 4; x.beginPath(); x.moveTo(18, y); x.lineTo(w - 18, y); x.stroke(); }
}
// corn plant stages 0 sprout .. 3 ripe with cobs
function corn(x, s) {
  const H = [14, 30, 50, 60][s], base = 66;
  x.lineWidth = 2; x.strokeStyle = '#2f5a14';
  x.fillStyle = s === 3 ? '#9fbf3a' : '#5dbb2e';
  x.beginPath(); x.roundRect(18, base - H, 6, H, 3); x.fill(); x.stroke();
  const leaf = (y, d, l) => { x.beginPath(); x.moveTo(21, y); x.quadraticCurveTo(21 + d * l, y - l * 0.9, 21 + d * l * 1.2, y + 4); x.quadraticCurveTo(21 + d * l * 0.5, y - 2, 21, y + 4); x.fill(); x.stroke(); };
  x.fillStyle = s === 3 ? '#8fb33a' : '#6ccf3a';
  leaf(base - H * 0.3, -1, 8 + s * 3); leaf(base - H * 0.55, 1, 8 + s * 3);
  if (s >= 2) leaf(base - H * 0.8, -1, 10);
  if (s === 3) {
    blob(x, 30, base - H * 0.55, 5, 11, '#f2c21b', '#fff09a', 2);
    x.fillStyle = '#9ccf4a'; x.beginPath(); x.moveTo(26, base - H * 0.4); x.quadraticCurveTo(24, base - H * 0.7, 30, base - H * 0.75); x.lineTo(28, base - H * 0.4); x.fill();
    x.fillStyle = '#c98a2e'; x.beginPath(); x.moveTo(21, base - H); x.lineTo(16, base - H - 8); x.lineTo(21, base - H - 4); x.lineTo(26, base - H - 8); x.fill();
  }
}
export function buildFarmArt(scene) {
  for (let f = 0; f < 3; f++) { tex(scene, `chick${f}`, 120, 110, (x) => chicken(x, f)); tex(scene, `roost${f}`, 120, 110, (x) => chicken(x, f, true)); }
  tex(scene, 'soil', 150, 96, (x) => soil(x, 150, 96));
  for (let s = 0; s < 4; s++) tex(scene, `corn${s}`, 44, 70, (x) => corn(x, s));
  tex(scene, 'sickle', 48, 48, (x) => {
    x.strokeStyle = '#7a4a1e'; x.lineWidth = 6; x.beginPath(); x.moveTo(10, 42); x.lineTo(20, 28); x.stroke();
    x.strokeStyle = '#cfd6dc'; x.lineWidth = 5; x.beginPath(); x.arc(28, 20, 14, Math.PI * 0.9, Math.PI * 2.1); x.stroke();
  });
}
// chickens wander inside a rect, flip, peck; returns nothing (tweens own them)
export function spawnChickens(scene, n, area, rooster = false) {
  if (!scene.anims.exists('chick_walk')) {
    scene.anims.create({ key: 'chick_walk', frames: [{ key: 'chick0' }, { key: 'chick1' }], frameRate: 8, repeat: -1 });
    scene.anims.create({ key: 'chick_peck', frames: [{ key: 'chick0' }, { key: 'chick2' }, { key: 'chick0' }, { key: 'chick2' }], frameRate: 6 });
    scene.anims.create({ key: 'roost_walk', frames: [{ key: 'roost0' }, { key: 'roost1' }], frameRate: 8, repeat: -1 });
    scene.anims.create({ key: 'roost_peck', frames: [{ key: 'roost0' }, { key: 'roost2' }, { key: 'roost0' }, { key: 'roost2' }], frameRate: 6 });
  }
  for (let i = 0; i < n; i++) {
    const sh = scene.add.ellipse(0, 0, 40, 12, 0x000000, 0.18);
    const k = rooster && i === 0 ? 'roost' : 'chick';
    const c = scene.add.sprite(area.x + Math.random() * area.w, area.y + Math.random() * area.h, k + '0').setScale(k === 'roost' ? 0.58 : 0.5);
    const step = () => {
      if (!c.active) return;
      if (Math.random() < 0.4) {
        c.play(k + '_peck'); c.once('animationcomplete', () => scene.time.delayedCall(300 + Math.random() * 900, step));
        return;
      }
      const tx = area.x + Math.random() * area.w, ty = area.y + Math.random() * area.h;
      c.setFlipX(tx < c.x); c.play(k + '_walk');
      scene.tweens.add({ targets: c, x: tx, y: ty, duration: Phaser.Math.Distance.Between(c.x, c.y, tx, ty) * 22 + 200,
        onUpdate: () => c.setDepth(c.y), onComplete: () => { c.stop(); c.setTexture(k + '0'); scene.time.delayedCall(200 + Math.random() * 1200, step); } });
    };
    scene.events.on('update', () => { if (c.active) sh.setPosition(c.x, c.y + 24).setDepth(c.y - 1); });
    scene.time.delayedCall(i * 250, step);
  }
}
