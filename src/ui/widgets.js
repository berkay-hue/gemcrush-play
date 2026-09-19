// Small shared UI helpers for Phaser scenes.
import { sfx } from '../sound.js';

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

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
  c.on('pointerdown', () => { sfx.click(); scene.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true }); });
  c.on('pointerup', () => onClick && onClick());
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
  const dim = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setInteractive();
  c.add(dim);
  c.add(panel(scene, width / 2, height / 2, w, h));
  const closeFn = () => { if (!c.active) return; dim.disableInteractive(); scene.tweens.add({ targets: c, alpha: 0, duration: 150, onComplete: () => c.destroy() }); };
  const x = scene.add.text(width / 2 + w / 2 - 26, height / 2 - h / 2 + 26, '✕', { fontFamily: 'sans-serif', fontSize: '26px', color: '#fff', fontStyle: 'bold' })
    .setOrigin(0.5).setPadding(10).setInteractive({ useHandCursor: true }).on('pointerup', closeFn);
  c.add(x);
  c.setAlpha(0); scene.tweens.add({ targets: c, alpha: 1, duration: 180 });
  const inner = c.list[1]; inner.setScale(0.8); scene.tweens.add({ targets: inner, scale: 1, duration: 260, ease: 'Back.Out' });
  return { c, close: closeFn };
}

export function fmtMs(ms) {
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
