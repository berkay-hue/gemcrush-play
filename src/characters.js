// F16: maskot (çiftçi kuzu "Kuzi") + boss kurt — tamamen prosedürel canvas çizimi (varlık dosyası yok)
const INK = '#2b1d14';

function ell(ctx, x, y, rx, ry, fill, lw = 0, stroke = INK, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function rad(ctx, x, y, r, c0, c1, ox = -0.35, oy = -0.35) {
  const g = ctx.createRadialGradient(x + r * ox, y + r * oy, r * 0.1, x, y, r); g.addColorStop(0, c0); g.addColorStop(1, c1); return g;
}
function wool(ctx, cx, cy, rx, ry, n, puff, lw) {
  // bulut kenarlı yün: önce kontur, sonra dolgu (iç çizgiler görünmez)
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  ctx.fillStyle = INK; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, puff + lw, 0, Math.PI * 2); ctx.fill(); });
  ctx.beginPath(); ctx.ellipse(cx, cy, rx + lw, ry + lw, 0, 0, Math.PI * 2); ctx.fill();
  pts.forEach(([x, y]) => { ctx.fillStyle = rad(ctx, x, y, puff, '#ffffff', '#e9e1d2'); ctx.beginPath(); ctx.arc(x, y, puff, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = rad(ctx, cx, cy, Math.max(rx, ry), '#ffffff', '#efe7d8'); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

// mood: 'idle' | 'happy' | 'scared'
export function drawLamb(ctx, W, H, mood = 'idle') {
  ctx.save(); ctx.scale(W / 256, H / 256); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const sc = mood === 'scared';
  // gölge
  ell(ctx, 128, 244, 70, 10, 'rgba(0,0,0,.28)');
  // bacaklar + toynak
  for (const x of [104, 152]) {
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x - 13, 196, 26, 46, 10); ctx.fill();
    ctx.fillStyle = '#5a4034'; ctx.beginPath(); ctx.roundRect(x - 9, 198, 18, 36, 8); ctx.fill();
    ctx.fillStyle = '#1d1410'; ctx.beginPath(); ctx.roundRect(x - 11, 228, 22, 12, 5); ctx.fill();
  }
  // yün gövde
  wool(ctx, 128, 168, 58, 46, 12, 17, 5);
  // tulum (kot) — önlük + pantolon
  const den = ctx.createLinearGradient(0, 130, 0, 222); den.addColorStop(0, '#4f86d1'); den.addColorStop(1, '#244b86');
  ctx.beginPath(); ctx.moveTo(96, 140); ctx.lineTo(160, 140); ctx.lineTo(164, 172); ctx.quadraticCurveTo(188, 190, 176, 214);
  ctx.quadraticCurveTo(128, 228, 80, 214); ctx.quadraticCurveTo(68, 190, 92, 172); ctx.closePath();
  ctx.fillStyle = den; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  // dikiş + cep
  ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd36e';
  ctx.beginPath(); ctx.moveTo(101, 146); ctx.lineTo(155, 146); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(112, 158, 32, 22, 5); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.roundRect(112, 158, 32, 22, 5); ctx.fill();
  ctx.fillStyle = '#e04a3a'; ctx.beginPath(); ctx.moveTo(122, 160); ctx.lineTo(134, 160); ctx.lineTo(128, 170); ctx.fill(); // cepteki mendil
  // askılar + düğmeler (marka sarısı)
  ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(100, 142); ctx.lineTo(92, 118); ctx.moveTo(156, 142); ctx.lineTo(164, 118); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = '#3b6fb6'; ctx.beginPath(); ctx.moveTo(100, 142); ctx.lineTo(92, 118); ctx.moveTo(156, 142); ctx.lineTo(164, 118); ctx.stroke();
  for (const x of [101, 155]) { ell(ctx, x, 143, 6, 6, rad(ctx, x, 143, 6, '#fff3c4', '#ffb71b'), 2.5); }
  // kollar (yün)
  wool(ctx, 64, 160, 14, 16, 6, 8, 4);
  wool(ctx, 192, 150, 14, 16, 6, 8, 4);
  // dirgen (sağ elde) — sap + çatal
  if (!sc) {
    ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(206, 230); ctx.lineTo(218, 70); ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = '#b07a3a'; ctx.beginPath(); ctx.moveTo(206, 230); ctx.lineTo(218, 70); ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.beginPath();
    ctx.moveTo(203, 74); ctx.lineTo(233, 76); ctx.moveTo(204, 75); ctx.lineTo(202, 42); ctx.moveTo(218, 76); ctx.lineTo(219, 38); ctx.moveTo(232, 77); ctx.lineTo(236, 44); ctx.stroke();
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#cfd6e0'; ctx.beginPath();
    ctx.moveTo(204, 74); ctx.lineTo(232, 76); ctx.moveTo(204, 75); ctx.lineTo(202, 44); ctx.moveTo(218, 76); ctx.lineTo(219, 40); ctx.moveTo(232, 77); ctx.lineTo(236, 46); ctx.stroke();
    wool(ctx, 196, 150, 13, 14, 6, 8, 4); // kol sapın önünde
  }
  // kulaklar (sarkık)
  for (const [x, r] of [[80, -0.5], [176, 0.5]]) {
    ell(ctx, x, 100, 24, 12, '#f0cdb3', 5, INK, r);
    ell(ctx, x, 101, 15, 6, '#f39aa6', 0, INK, r);
  }
  // yüz
  ell(ctx, 128, 100, 44, 40, rad(ctx, 128, 100, 44, '#fbe7d6', '#e8c2a6'), 5);
  // şapkanın altından kâkül yünü
  wool(ctx, 128, 64, 26, 10, 7, 10, 4);
  // gözler
  if (mood === 'happy') {
    ctx.lineWidth = 6; ctx.strokeStyle = INK;
    for (const x of [110, 146]) { ctx.beginPath(); ctx.arc(x, 102, 10, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  } else if (sc) {
    for (const x of [110, 146]) { ell(ctx, x, 98, 13, 15, '#fff', 4); ell(ctx, x + (x < 128 ? 3 : -3), 101, 4, 4, INK); }
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(98, 78); ctx.lineTo(118, 84); ctx.moveTo(158, 78); ctx.lineTo(138, 84); ctx.stroke();
    // ter damlası
    ctx.fillStyle = '#7fd0ff'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(172, 70); ctx.quadraticCurveTo(184, 90, 172, 94); ctx.quadraticCurveTo(160, 90, 172, 70); ctx.fill(); ctx.stroke();
  } else {
    for (const x of [110, 146]) { ell(ctx, x, 100, 10, 13, INK); ell(ctx, x - 3, 95, 4, 5, '#fff'); ell(ctx, x + 3, 105, 2, 2, '#fff'); }
  }
  // yanaklar
  ell(ctx, 96, 118, 9, 6, 'rgba(255,120,140,.55)'); ell(ctx, 160, 118, 9, 6, 'rgba(255,120,140,.55)');
  // burun + ağız
  ell(ctx, 128, 116, 7, 5, '#c9707e', 2.5);
  ctx.lineWidth = 4; ctx.strokeStyle = INK;
  if (sc) { ell(ctx, 128, 131, 8, 10, '#6b1f2a', 3.5); }
  else if (mood === 'happy') { ctx.beginPath(); ctx.moveTo(114, 124); ctx.quadraticCurveTo(128, 142, 142, 124); ctx.closePath(); ctx.fillStyle = '#8c2a36'; ctx.fill(); ctx.stroke(); ell(ctx, 128, 132, 6, 3, '#ff8ea0'); }
  else { ctx.beginPath(); ctx.moveTo(116, 124); ctx.quadraticCurveTo(122, 131, 128, 124); ctx.quadraticCurveTo(134, 131, 140, 124); ctx.stroke(); }
  // ağızda buğday sapı (çiftçi dokunuşu)
  if (!sc) {
    ctx.lineWidth = 3; ctx.strokeStyle = '#c99a2e'; ctx.beginPath(); ctx.moveTo(140, 126); ctx.lineTo(176, 112); ctx.stroke();
    ctx.fillStyle = '#f2c14e'; for (let i = 0; i < 4; i++) ell(ctx, 170 + i * 4, 113 - i * 1.6, 4, 2.2, '#f2c14e', 1.2, '#9a6a12', -0.4);
  }
  // hasır şapka: kenar + tepe + kırmızı bant
  ctx.save(); ctx.translate(128, 62); ctx.rotate(sc ? -0.18 : -0.06);
  const straw = ctx.createLinearGradient(0, -40, 0, 12); straw.addColorStop(0, '#ffe08a'); straw.addColorStop(1, '#d19a32');
  ell(ctx, 0, 4, 78, 16, straw, 5);
  ctx.beginPath(); ctx.moveTo(-40, 4); ctx.bezierCurveTo(-40, -44, 40, -44, 40, 4); ctx.closePath(); ctx.fillStyle = straw; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#d9483b'; ctx.beginPath(); ctx.moveTo(-40, -2); ctx.bezierCurveTo(-38, -12, 38, -12, 40, -2); ctx.lineTo(40, 4); ctx.bezierCurveTo(20, 0, -20, 0, -40, 4); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(120,70,10,.55)';
  for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(i * 13, -2); ctx.lineTo(i * 14.5, 16); ctx.stroke(); }
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 12, -30 + Math.abs(i) * 3); ctx.lineTo(i * 15, -12); ctx.stroke(); }
  ell(ctx, -18, -24, 10, 4, 'rgba(255,255,255,.35)', 0, INK, -0.5);
  // şapkada papatya
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ell(ctx, 28 + Math.cos(a) * 6, -6 + Math.sin(a) * 6, 5, 3, '#fff', 1.2, INK, a); }
  ell(ctx, 28, -6, 3.5, 3.5, '#ffb71b', 1.2);
  ctx.restore();
  ctx.restore();
}

// mood: 'hungry' (ağzı açık, salyası akan) | 'hurt' (kaçan, sersem)
export function drawWolf(ctx, W, H, mood = 'hungry') {
  ctx.save(); ctx.scale(W / 256, H / 256); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hurt = mood === 'hurt';
  const fur = (y0, y1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#8a93a6'); g.addColorStop(1, '#474e60'); return g; };
  // omuz / gövde (tüylü yaka)
  ctx.beginPath(); ctx.moveTo(40, 256); ctx.lineTo(52, 186);
  for (let i = 0; i <= 8; i++) { const x = 52 + i * 19, y = 170 + (i % 2 ? 14 : 0) - Math.sin(i / 8 * Math.PI) * 10; ctx.lineTo(x, y); }
  ctx.lineTo(216, 256); ctx.closePath(); ctx.fillStyle = fur(160, 256); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  ell(ctx, 128, 236, 42, 30, '#c9ced8', 0);
  // pençeler (kalkmış, pençe tırnakları)
  for (const [x, s] of [[34, 1], [222, -1]]) {
    if (hurt) continue;
    ctx.save(); ctx.translate(x, 168); ctx.scale(s, 1);
    ctx.beginPath(); ctx.moveTo(-10, 90); ctx.quadraticCurveTo(-16, 30, 0, -4); ctx.quadraticCurveTo(22, -8, 26, 20); ctx.quadraticCurveTo(24, 60, 22, 90); ctx.closePath();
    ctx.fillStyle = fur(-10, 90); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-2 + i * 10, -2); ctx.quadraticCurveTo(-4 + i * 12, -20, 4 + i * 12, -26); ctx.lineTo(8 + i * 10, -4); ctx.closePath(); ctx.fillStyle = '#f4efe2'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke(); }
    ctx.restore();
  }
  // kulaklar
  const earDrop = hurt ? 22 : 0;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(128 + s * 30, 66); ctx.lineTo(128 + s * (62 + earDrop), 6 + earDrop * 1.6); ctx.lineTo(128 + s * 74, 84); ctx.closePath();
    ctx.fillStyle = fur(10, 84); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128 + s * 40, 70); ctx.lineTo(128 + s * (60 + earDrop), 24 + earDrop * 1.4); ctx.lineTo(128 + s * 66, 78); ctx.closePath(); ctx.fillStyle = '#e9a0a8'; ctx.fill();
  }
  // kafa (yanak tüyleri sivri)
  ctx.beginPath(); ctx.moveTo(128, 44);
  ctx.bezierCurveTo(186, 44, 204, 90, 200, 116); ctx.lineTo(216, 128); ctx.lineTo(196, 136); ctx.lineTo(206, 152); ctx.lineTo(180, 154);
  ctx.lineTo(76, 154); ctx.lineTo(50, 152); ctx.lineTo(60, 136); ctx.lineTo(40, 128); ctx.lineTo(56, 116); ctx.bezierCurveTo(52, 90, 70, 44, 128, 44); ctx.closePath();
  ctx.fillStyle = fur(44, 154); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  // alın tüy tutamı
  ctx.fillStyle = '#9aa3b5'; ctx.beginPath(); ctx.moveTo(112, 46); ctx.lineTo(128, 70); ctx.lineTo(144, 46); ctx.lineTo(128, 58); ctx.closePath(); ctx.fill();
  // namlu (açık renk)
  ell(ctx, 128, 132, 46, 34, '#d6dae3', 5);
  // gözler + kaşlar
  if (hurt) {
    ctx.lineWidth = 5; ctx.strokeStyle = INK;
    for (const x of [100, 156]) { ctx.beginPath(); ctx.moveTo(x - 10, 88); ctx.lineTo(x + 10, 102); ctx.moveTo(x + 10, 88); ctx.lineTo(x - 10, 102); ctx.stroke(); }
  } else {
    for (const [x, s] of [[100, -1], [156, 1]]) {
      ctx.beginPath(); ctx.moveTo(x - 14, 90); ctx.quadraticCurveTo(x, 80, x + 14, 92); ctx.quadraticCurveTo(x, 106, x - 14, 90); ctx.closePath();
      ctx.fillStyle = rad(ctx, x, 92, 14, '#fff6a8', '#f2a81a', 0, 0); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      ell(ctx, x + s * 2, 93, 3, 7, INK); ell(ctx, x - 5, 88, 2.5, 2, '#fff');
      ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x - s * 20, 74); ctx.lineTo(x + s * 12, 86); ctx.stroke(); // kızgın kaş
    }
  }
  // burun
  ell(ctx, 128, 114, 13, 9, rad(ctx, 128, 114, 13, '#5b6070', '#101218'), 3);
  ell(ctx, 124, 111, 4, 2.5, 'rgba(255,255,255,.6)');
  // ağız
  if (hurt) {
    ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(104, 140);
    for (let i = 1; i <= 6; i++) ctx.lineTo(104 + i * 8, 140 + (i % 2 ? -5 : 5)); ctx.stroke();
    // yıldızlar (sersem)
    ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (const [sx, sy] of [[70, 40], [186, 34], [128, 20]]) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 12, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
  } else {
    ctx.beginPath(); ctx.moveTo(94, 128); ctx.quadraticCurveTo(128, 124, 162, 128); ctx.quadraticCurveTo(160, 176, 128, 180); ctx.quadraticCurveTo(96, 176, 94, 128); ctx.closePath();
    ctx.fillStyle = '#5a0f1c'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ell(ctx, 128, 166, 20, 11, '#e2566c'); ctx.lineWidth = 2; ctx.strokeStyle = '#a8283e'; ctx.beginPath(); ctx.moveTo(128, 158); ctx.lineTo(128, 172); ctx.stroke();
    // dişler
    ctx.fillStyle = '#fffdf2'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    const fang = (x, y, h, up) => { ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + (up ? -h : h)); ctx.lineTo(x + 6, y); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    [100, 112, 124, 132, 144, 156].forEach((x, i) => fang(x, 128, i === 0 || i === 5 ? 18 : 9, false));
    [108, 128, 148].forEach((x) => fang(x, 176, 9, true));
    // salya
    ctx.fillStyle = 'rgba(190,235,255,.9)'; ctx.beginPath(); ctx.moveTo(152, 170); ctx.quadraticCurveTo(160, 196, 154, 204); ctx.quadraticCurveTo(146, 198, 152, 170); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#5f8fa8'; ctx.stroke();
  }
  ctx.restore();
}

export function buildCharacters(make) {
  make('lamb', (c, w, h) => drawLamb(c, w, h, 'idle'), 256, 256);
  make('lamb_happy', (c, w, h) => drawLamb(c, w, h, 'happy'), 256, 256);
  make('lamb_scared', (c, w, h) => drawLamb(c, w, h, 'scared'), 256, 256);
  make('wolf', (c, w, h) => drawWolf(c, w, h, 'hungry'), 256, 256);
  make('wolf_hurt', (c, w, h) => drawWolf(c, w, h, 'hurt'), 256, 256);
}
