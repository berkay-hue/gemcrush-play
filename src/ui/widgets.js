// Small shared UI helpers for Phaser scenes.
import { sfx } from '../sound.js';
import { buildIcons, splitIcon, iconKey } from './icons.js';

export const FONT = '"Baloo 2", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function txt(scene, x, y, s, size = 22, color = '#ffffff', extra = {}) {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', align: 'center', ...extra }).setOrigin(0.5);
}

// F17: altın rakam — dikey degradeli dolgu + koyu kahve kontur
export function goldText(scene, x, y, s, size = 20, extra = {}) {
  const t = txt(scene, x, y, s, size, '#ffd23f', { stroke: '#5a3500', strokeThickness: Math.max(3, Math.round(size / 5)), ...extra });
  const paint = () => { const g = t.context.createLinearGradient(0, 0, 0, t.height); g.addColorStop(0.1, '#fff6c2'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(0.9, '#e88a00'); t.setFill(g); };
  const raw = t.setText.bind(t);
  t.setText = (v) => { raw(v); paint(); return t; };
  paint();
  return t.setShadow(0, 2, 'rgba(40,20,0,.45)', 2, true, false);
}

// F17: ikon + metin (setText başındaki emojiyi ikona çevirir, yeniden hizalar). align: 'left' | 'right' | 'center'
export function iconLabel(scene, x, y, s, size = 16, { align = 'left', gold = true, color = '#ffffff', icon } = {}) {
  buildIcons(scene);
  const c = scene.add.container(x, y);
  const img = scene.add.image(0, 0, 'ic-coin').setDisplaySize(size * 1.35, size * 1.35);
  const t = gold ? goldText(scene, 0, 0, '', size) : txt(scene, 0, 0, '', size, color);
  t.setOrigin(0, 0.5); c.add([img, t]);
  const lay = (v) => {
    const sp = splitIcon(v); const key = icon ? `ic-${icon}` : sp?.key;
    img.setVisible(!!key); if (key) img.setTexture(key).setDisplaySize(size * 1.35, size * 1.35);
    t.setText(sp ? sp.rest : String(v));
    const iw = key ? size * 1.35 + 3 : 0, W = iw + t.width;
    const x0 = align === 'left' ? 0 : align === 'right' ? -W : -W / 2;
    img.x = x0 + iw / 2 - 1; t.x = x0 + iw;
    c.w = W;
  };
  c.setText = (v) => { lay(v); return c; };
  c.text = t;
  lay(s);
  return c;
}

export function button(scene, x, y, w, h, label, onClick, color = 0xffb71b, textColor = '#1a1200', size = 24) {
  buildIcons(scene);
  const c = scene.add.container(x, y);
  const base = scene.add.graphics(); // F17: sabit dudak — yüz basınca içine gömülür
  const dark = Phaser.Display.Color.IntegerToColor(color).darken(34).color;
  const light = Phaser.Display.Color.IntegerToColor(color).lighten(18).color;
  const LIP = 5;
  base.fillStyle(0x000000, 0.4); base.fillRoundedRect(-w / 2, -h / 2 + LIP + 3, w, h, 16);
  base.fillStyle(dark, 1); base.fillRoundedRect(-w / 2, -h / 2 + LIP, w, h, 16);
  const face = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(Phaser.Display.Color.IntegerToColor(color).darken(12).color, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
  g.fillGradientStyle(light, light, color, color, 1); g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 5, 14);
  g.fillStyle(0xffffff, 0.28); g.fillRoundedRect(-w / 2 + 5, -h / 2 + 4, w - 10, h / 2 - 5, { tl: 11, tr: 11, bl: 4, br: 4 });
  g.lineStyle(2, 0xffffff, 0.25); g.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 15);
  const t = txt(scene, 0, -1, '', size, textColor).setShadow(0, 2, 'rgba(0,0,0,0.35)', 2, true, true);
  const ic = scene.add.image(0, -1, 'ic-coin').setVisible(false);
  face.add([g, ic, t]);
  const raw = t.setText.bind(t);
  const lay = (v) => {
    const sp = splitIcon(v);
    raw(sp ? sp.rest : String(v));
    if (!sp) { ic.setVisible(false); t.x = 0; return; }
    const is = Math.min(h * 0.74, size * 1.45);
    ic.setTexture(sp.key).setDisplaySize(is, is).setVisible(true);
    const gap = sp.rest ? 5 : 0, W = is + gap + (sp.rest ? t.width : 0);
    ic.x = -W / 2 + is / 2; t.x = -W / 2 + is + gap + (sp.rest ? t.width / 2 : 0);
    if (!sp.rest) ic.x = 0;
  };
  t.setText = (v) => { lay(v); return t; };
  lay(label);
  c.add([base, face]);
  c.setSize(w, h + LIP).setInteractive({ useHandCursor: true });
  const to = (scale, duration) => { scene.tweens.killTweensOf(c); scene.tweens.add({ targets: c, scale, duration, ease: 'Quad.Out' }); };
  const push = (down) => { scene.tweens.killTweensOf(face); scene.tweens.add({ targets: face, y: down ? LIP - 1 : 0, duration: down ? 50 : 160, ease: down ? 'Quad.Out' : 'Back.Out' }); };
  c.on('pointerover', () => to(1.04, 110));
  let pressed = false; // F16: yalnız bu düğmede başlayan dokunuş tıklar (DOM paneli üstünden sızan bırakma tetiklemez)
  c.on('pointerout', () => { pressed = false; to(1, 110); push(false); });
  c.on('pointerdown', () => { pressed = true; sfx.click(); to(0.97, 60); push(true); });
  c.on('pointerup', () => { if (!pressed) return; pressed = false; push(false); scene.tweens.killTweensOf(c); c.setScale(0.97); scene.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.Out' }); onClick && onClick(); });
  c.label = t;
  c.face = face;
  return c;
}

// F17: ahşap çerçeveli panel — kalas kenar, damar, köşe çivileri; içi koyu yeşil (beyaz yazı okunur kalsın)
export function panel(scene, x, y, w, h, alpha = 0.96) {
  const g = scene.add.graphics();
  const L = x - w / 2, T = y - h / 2, B = 14;
  g.fillStyle(0x000000, 0.5); g.fillRoundedRect(L, T + 10, w, h, 26);
  g.fillGradientStyle(0xb8773a, 0xb8773a, 0x6e3f18, 0x6e3f18, 1); g.fillRoundedRect(L, T, w, h, 26);
  // damarlar (kalas dokusu, tohumlu → her açılışta aynı)
  let sd = Math.round(w * 7 + h * 13);
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  g.lineStyle(1.5, 0x4a2508, 0.35);
  for (let i = 0; i < 10; i++) { const yy = T + 4 + rnd() * (h - 8), x0 = L + 6 + rnd() * w * 0.5; g.lineBetween(x0, yy, Math.min(L + w - 6, x0 + 30 + rnd() * w * 0.4), yy + (rnd() - 0.5) * 3); }
  g.fillStyle(0xffe2b0, 0.22); g.fillRoundedRect(L + 4, T + 3, w - 8, 6, 3);
  // iç alan
  g.fillStyle(0x3a1e08, 1); g.fillRoundedRect(L + B - 3, T + B - 3, w - 2 * B + 6, h - 2 * B + 6, 18);
  g.fillGradientStyle(0x1e3a31, 0x1e3a31, 0x0c1a15, 0x0c1a15, alpha); g.fillRoundedRect(L + B, T + B, w - 2 * B, h - 2 * B, 16);
  g.fillStyle(0xffffff, 0.05); g.fillRoundedRect(L + B + 4, T + B + 4, w - 2 * B - 8, 40, { tl: 12, tr: 12, bl: 0, br: 0 });
  g.lineStyle(2, 0xffb71b, 0.55); g.strokeRoundedRect(L + B + 3, T + B + 3, w - 2 * B - 6, h - 2 * B - 6, 13);
  g.lineStyle(3, 0x3a1e08, 0.9); g.strokeRoundedRect(L, T, w, h, 26);
  // çiviler
  for (const [nx, ny] of [[L + 9, T + 9], [L + w - 9, T + 9], [L + 9, T + h - 9], [L + w - 9, T + h - 9]]) {
    g.fillStyle(0x2a1a0a, 1); g.fillCircle(nx, ny + 1, 4.2); g.fillStyle(0xc9ced2, 1); g.fillCircle(nx, ny, 3.6); g.fillStyle(0xffffff, 0.8); g.fillCircle(nx - 1.1, ny - 1.1, 1.2);
  }
  return g;
}

// Full-screen modal container; returns {c, close}
export function modal(scene, w, h) {
  const { width, height } = scene.scale;
  const cam = scene.cameras.main;
  const c = scene.add.container(cam.scrollX, cam.scrollY).setDepth(1000); // kaydırılmış haritada da ekranda kalsın
  const dim = scene.add.rectangle(width / 2, height / 2, width * 1.4, height * 1.4, 0x000000, 0.7).setInteractive();
  c.add(dim);
  c.add(panel(scene, width / 2, height / 2, w, h));
  // ölçek ekran ortasından: konteyner (0,0)'da, çocuklar mutlak koordinatlı
  const pop = { s: 1 };
  const applyPop = () => { c.setScale(pop.s); c.x = cam.scrollX + (width / 2) * (1 - pop.s); c.y = cam.scrollY + (height / 2) * (1 - pop.s); };
  const closeFn = () => { if (!c.active) return; dim.disableInteractive(); scene.tweens.add({ targets: pop, s: 0.92, duration: 150, ease: 'Quad.In', onUpdate: applyPop }); scene.tweens.add({ targets: c, alpha: 0, duration: 150, onComplete: () => c.destroy() }); };
  // F22: büyük, görünür kapatma düğmesi (eski ✕ metni parmakla zor vuruluyordu)
  const bx = width / 2 + w / 2 - 30, by = height / 2 - h / 2 + 30;
  const xb = scene.add.circle(bx, by, 24, 0x7a1f1f, 1).setStrokeStyle(3, 0xffd9a0);
  const x = scene.add.text(bx, by - 1, '✕', { fontFamily: 'system-ui, sans-serif', fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
  const hit = scene.add.circle(bx, by, 40, 0x000000, 0.001).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', () => xb.setScale(0.9)).on('pointerout', () => xb.setScale(1)).on('pointerup', closeFn);
  c.add([xb, x, hit]);
  // F41: sonradan eklenen tente/tabela ✕'i örtmesin — her kare en üstte tut
  const keepTop = () => { if (!c.active) return scene.events.off('postupdate', keepTop); if (c.list[c.list.length - 1] !== hit) { c.bringToTop(xb); c.bringToTop(x); c.bringToTop(hit); } };
  scene.events.on('postupdate', keepTop); c.once('destroy', () => scene.events.off('postupdate', keepTop));
  c.setAlpha(0); scene.tweens.add({ targets: c, alpha: 1, duration: 180 });
  pop.s = 0.85; applyPop(); scene.tweens.add({ targets: pop, s: 1, duration: 280, ease: 'Back.Out', onUpdate: applyPop });
  return { c, close: closeFn };
}

export function fmtMs(ms) {
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// Sahne girişinde yumuşak açılış (main.js tüm sahnelere bağlar)
export function fadeIn(scene) { scene.cameras.main.fadeIn(240, 10, 15, 13); }

// F16: DOM katmanı (arkadaşlar, giriş, görevler…) açıkken olayların oyuna sızmasını keser
export function shield(el) {
  el.dataset.gcOverlay = '1';
  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'wheel'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
  return el;
}

// ---- F16: premium mağaza parçaları ----
const shade = (c, p) => (p >= 0 ? Phaser.Display.Color.IntegerToColor(c).lighten(p) : Phaser.Display.Color.IntegerToColor(c).darken(-p)).color;

// Degradeli, gölgeli, parlak kenarlı kart. accent: kenar/parıltı rengi
export function card(scene, x, y, w, h, { top = 0x2c5a45, bottom = 0x143126, accent = 0xffffff, accentA = 0.14, glow = false, r = 18 } = {}) {
  const g = scene.add.graphics();
  if (glow) { g.fillStyle(accent, 0.18); g.fillRoundedRect(x - w / 2 - 6, y - h / 2 - 6, w + 12, h + 12, r + 6); }
  g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x - w / 2, y - h / 2 + 6, w, h, r);
  g.fillGradientStyle(top, top, bottom, bottom, 1); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
  g.fillStyle(0xffffff, 0.08); g.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 3, w - 8, h * 0.42, { tl: r - 3, tr: r - 3, bl: 6, br: 6 });
  g.lineStyle(2, accent, accentA); g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
  return g;
}

// Yuvarlak ikon yuvası (ikon arkası parlak daire)
export function iconSlot(scene, x, y, s, icon, color = 0xffb71b, size) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3); g.fillCircle(0, 4, s / 2);
  g.fillGradientStyle(shade(color, 25), shade(color, 25), shade(color, -30), shade(color, -30), 1); g.fillCircle(0, 0, s / 2);
  g.fillStyle(0xffffff, 0.3); g.fillEllipse(-s * 0.12, -s * 0.2, s * 0.55, s * 0.28);
  g.lineStyle(3, 0xffffff, 0.55); g.strokeCircle(0, 0, s / 2 - 1);
  const k = iconKey(icon); if (k) buildIcons(scene);
  c.add([g, k ? scene.add.image(0, 1, k).setDisplaySize(s * 0.66, s * 0.66) : txt(scene, 0, 2, icon, size || Math.round(s * 0.52))]);
  return c;
}

// Köşe kurdelesi (EN İYİ, POPÜLER, YENİ…)
export function ribbon(scene, x, y, label, color = 0xff3b5c) {
  const c = scene.add.container(x, y).setAngle(-8);
  const t = txt(scene, 0, 0, label, 13, '#ffffff').setShadow(0, 1, 'rgba(0,0,0,.4)', 2, true, true);
  const w = Math.max(56, t.width + 20);
  const g = scene.add.graphics();
  g.fillStyle(shade(color, -35), 1); g.fillRoundedRect(-w / 2, -11, w, 25, 9);
  g.fillStyle(color, 1); g.fillRoundedRect(-w / 2, -13, w, 24, 9);
  g.fillStyle(0xffffff, 0.3); g.fillRoundedRect(-w / 2 + 3, -11, w - 6, 9, 6);
  c.add([g, t]);
  scene.tweens.add({ targets: c, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return c;
}

// Başlıkta para birimi çipi
export function chip(scene, x, y, icon, value, color = 0xffb71b) {
  const c = scene.add.container(x, y);
  const t = goldText(scene, 24, 0, String(value), 18).setOrigin(0, 0.5);
  const w = t.width + 56;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45); g.fillRoundedRect(-17, -16, w, 32, 16);
  g.lineStyle(2, color, 0.7); g.strokeRoundedRect(-17, -16, w, 32, 16);
  c.add([g, iconSlot(scene, 0, 0, 34, icon, color, 18), t]);
  c.w = w;
  return c;
}

// Nabız gibi atan parlak çerçeve (öne çıkan teklif)
export function shine(scene, x, y, w, h, color = 0xffe58a) {
  const g = scene.add.graphics();
  g.lineStyle(4, color, 1); g.strokeRoundedRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6, 21);
  scene.tweens.add({ targets: g, alpha: 0.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return g;
}

// F28: dükkân tentesi — kırmızı/krem çizgili, fistolu alt kenar (premium mağaza başlığı)
export function awning(scene, cx, y, w, h = 34, n = 10) {
  const g = scene.add.graphics(), L = cx - w / 2, sw = w / n, r = sw / 2;
  g.fillStyle(0x000000, 0.3); g.fillRoundedRect(L, y + 6, w, h, { tl: 14, tr: 14, bl: 0, br: 0 });
  for (let i = 0; i < n; i++) {
    const red = i % 2 === 0, x = L + i * sw;
    const top = red ? 0xff5a5a : 0xfff4dc, bot = red ? 0xc42a36 : 0xe8d3a8;
    g.fillGradientStyle(top, top, bot, bot, 1);
    g.fillRect(x, y, sw + 0.5, h);
    g.fillStyle(bot, 1); g.fillCircle(x + r, y + h, r);
    g.fillStyle(0x000000, 0.12); g.fillCircle(x + r, y + h + 3, r * 0.55);
  }
  g.fillStyle(0xffffff, 0.3); g.fillRect(L, y + 2, w, 4);
  g.fillStyle(0x7a4f14, 1); g.fillRoundedRect(L - 6, y - 8, w + 12, 12, 6);
  g.fillStyle(0xffd45a, 1); g.fillRoundedRect(L - 6, y - 8, w + 12, 5, 4);
  return g;
}

// F28: asılı altın tabela (başlık)
export function signBoard(scene, cx, y, label, size = 26) {
  const c = scene.add.container(cx, y);
  const t = txt(scene, 0, -1, label, size, '#3a2206');
  const w = t.width + 56, h = size + 22;
  const g = scene.add.graphics();
  g.lineStyle(3, 0x5a3a0c, 1); g.lineBetween(-w / 2 + 18, -h / 2, -w / 2 + 26, -h / 2 - 22); g.lineBetween(w / 2 - 18, -h / 2, w / 2 - 26, -h / 2 - 22);
  g.fillStyle(0x5a3a0c, 1); g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 14);
  g.fillGradientStyle(0xffe27a, 0xffe27a, 0xe79a12, 0xe79a12, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.fillStyle(0xffffff, 0.35); g.fillRoundedRect(-w / 2 + 6, -h / 2 + 4, w - 12, h * 0.36, 9);
  g.lineStyle(3, 0x7a4f14, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  c.add([g, t]);
  scene.tweens.add({ targets: c, angle: { from: -1.2, to: 1.2 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return c;
}
