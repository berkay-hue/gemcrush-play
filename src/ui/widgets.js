// Small shared UI helpers for Phaser scenes.
import { sfx } from '../sound.js';

export const FONT = '"Baloo 2", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function txt(scene, x, y, s, size = 22, color = '#ffffff', extra = {}) {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', align: 'center', ...extra }).setOrigin(0.5);
}

export function button(scene, x, y, w, h, label, onClick, color = 0xffb71b, textColor = '#1a1200', size = 24) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const dark = Phaser.Display.Color.IntegerToColor(color).darken(28).color;
  const light = Phaser.Display.Color.IntegerToColor(color).lighten(18).color;
  g.fillStyle(0x000000, 0.4); g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 16);
  g.fillStyle(dark, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
  g.fillGradientStyle(light, light, color, color, 1); g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 7, 14);
  g.fillStyle(0xffffff, 0.28); g.fillRoundedRect(-w / 2 + 5, -h / 2 + 4, w - 10, h / 2 - 5, { tl: 11, tr: 11, bl: 4, br: 4 });
  g.lineStyle(2, 0xffffff, 0.25); g.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 15);
  const t = txt(scene, 0, -1, label, size, textColor).setShadow(0, 2, 'rgba(0,0,0,0.35)', 2, true, true);
  c.add([g, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  const to = (scale, duration) => { scene.tweens.killTweensOf(c); scene.tweens.add({ targets: c, scale, duration, ease: 'Quad.Out' }); };
  c.on('pointerover', () => to(1.04, 110));
  let pressed = false; // F16: yalnız bu düğmede başlayan dokunuş tıklar (DOM paneli üstünden sızan bırakma tetiklemez)
  c.on('pointerout', () => { pressed = false; to(1, 110); });
  c.on('pointerdown', () => { pressed = true; sfx.click(); to(0.93, 60); });
  c.on('pointerup', () => { if (!pressed) return; pressed = false; scene.tweens.killTweensOf(c); c.setScale(0.93); scene.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.Out' }); onClick && onClick(); });
  c.label = t;
  return c;
}

export function panel(scene, x, y, w, h, alpha = 0.96) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.5); g.fillRoundedRect(x - w / 2, y - h / 2 + 10, w, h, 26);
  g.fillGradientStyle(0x1e3a31, 0x1e3a31, 0x0c1a15, 0x0c1a15, alpha); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 26);
  g.fillStyle(0xffffff, 0.06); g.fillRoundedRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, 44, { tl: 20, tr: 20, bl: 0, br: 0 });
  g.lineStyle(4, 0xffb71b, 0.95); g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 26);
  g.lineStyle(2, 0xfff0b8, 0.35); g.strokeRoundedRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 21);
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
  const x = scene.add.text(width / 2 + w / 2 - 26, height / 2 - h / 2 + 26, '✕', { fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: '#fff', fontStyle: 'bold' })
    .setOrigin(0.5).setPadding(10).setInteractive({ useHandCursor: true }).on('pointerup', closeFn);
  c.add(x);
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
  c.add([g, txt(scene, 0, 2, icon, size || Math.round(s * 0.52))]);
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
  const t = txt(scene, 24, 0, String(value), 18, '#ffffff').setOrigin(0, 0.5);
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
