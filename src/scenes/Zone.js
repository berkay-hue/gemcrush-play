// Faz 1: expansion zone scene (left = Orman Kıyısı, right = Dere Kenarı).
import { save, starBalance } from '../meta/save.js';
import { ZONES, OBST, zoneOpen, openZone, obstState, obstLeft, startClear, collectClear, clearRush, clearRushCost, zoneDone } from '../meta/zones.js';
import { energy, E_MAX, msToNextEnergy } from '../meta/energy.js';
import { txt, button, modal, fmtMs } from '../ui/widgets.js';
import { getLang } from '../i18n.js';
import { sfx } from '../sound.js';

const L = (o) => (getLang() === 'tr' ? o.tr : o.en);
const S = {
  back: { tr: 'Çiftlik', en: 'Farm' }, open: { tr: 'Aç', en: 'Unlock' }, needStars: { tr: 'Yıldız yetmiyor — seviye oyna!', en: 'Not enough stars — play levels!' },
  clear: { tr: 'Temizle', en: 'Clear' }, coins: { tr: 'Altın yetmiyor', en: 'Not enough coins' }, energy: { tr: 'Enerji bitti — bir seviye oyna ya da bekle', en: 'Out of energy — play a level or wait' },
  done: { tr: 'Bölge temiz! Açıldı:', en: 'Zone cleared! Unlocked:' }, win: { tr: 'Her galibiyet −5 dk', en: 'Each win −5 min' },
};

export class Zone extends Phaser.Scene {
  constructor() { super('Zone'); }
  create(data = {}) {
    const z = (this.z = data.zone || 'sol'), Z = ZONES[z];
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Z.bg);
    const g = this.add.graphics();
    g.fillStyle(0x9fd8f0).fillRect(0, 100, width, 120);
    g.fillStyle(z === 'sol' ? 0x3f7f3a : 0x5aa84a).fillEllipse(width / 2, 235, width * 1.4, 120);
    if (z === 'sol') for (let i = 0; i < 7; i++) txt(this, 30 + i * 75, 250 + (i % 2) * 20, '🌲', 54);
    else { g.fillStyle(0x4aa3d8).fillRoundedRect(width - 90, 230, 70, height - 360, 30); txt(this, width - 55, 330, '🐟', 30); }
    // HUD
    this.add.rectangle(width / 2, 50, width, 100, 0x0a0f0d, 0.92);
    txt(this, width / 2, 36, L(Z.name), 26, '#ffb71b');
    this.hud = txt(this, width / 2, 72, '', 18, '#ffe58a');
    button(this, z === 'sol' ? width - 60 : 60, 150, 100, 40, z === 'sol' ? `${L(S.back)} ▶` : `◀ ${L(S.back)}`, () => this.scene.start('Farm'), 0x2a333a, '#fff', 16);
    txt(this, width / 2, height - 40, `⚡ ${L(S.win)}`, 16, '#0a0f0d');
    this.items = [];
    if (!zoneOpen(z)) this.drawLocked(); else this.drawObstacles();
    this.refresh(); this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refresh() });
  }
  drawLocked() {
    const { width, height } = this.scale, Z = ZONES[this.z];
    this.add.rectangle(width / 2, height / 2, width - 60, 300, 0x0a0f0d, 0.8).setStrokeStyle(3, 0xffb71b);
    txt(this, width / 2, height / 2 - 100, '🔒', 60);
    txt(this, width / 2, height / 2 - 30, `🎁 ${L(Z.unlocks)}`, 20, '#fff');
    button(this, width / 2, height / 2 + 60, 220, 60, `${L(S.open)} ⭐${Z.price}`, () => {
      if (openZone(this.z)) { sfx.win(); this.scene.restart({ zone: this.z }); } else this.toast(L(S.needStars));
    }, 0xffb71b, '#1a1200', 22);
  }
  drawObstacles() {
    for (const o of ZONES[this.z].obstacles) {
      const k = OBST[o.kind];
      this.add.ellipse(o.x, o.y + 30, 90, 26, 0x000000, 0.18);
      const icon = txt(this, o.x, o.y, k.emoji, o.kind === 'bush' ? 56 : 66);
      const tag = txt(this, o.x, o.y + 52, '', 15, '#fff').setBackgroundColor('#0a0f0dcc').setPadding(6, 3);
      icon.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.tap(o));
      this.items.push({ o, icon, tag });
    }
  }
  tap(o) {
    const st = obstState(this.z, o.id), k = OBST[o.kind];
    if (st === 'idle') {
      const r = startClear(this.z, o.id);
      if (r) return this.toast(L(S[r] || S.coins));
      sfx.swap && sfx.swap();
    } else if (st === 'ready') {
      const r = collectClear(this.z, o.id); sfx.win();
      this.toast(`+${r.coins}🪙${r.gems ? ` +${r.gems}💎` : ''}`);
      if (zoneDone(this.z)) this.toast(`${L(S.done)} ${L(ZONES[this.z].unlocks)}`, 3000);
    } else if (st === 'clearing') {
      const cost = clearRushCost(this.z, o.id), m = modal(this, 400, 220);
      m.c.add(txt(this, 0, -60, `${k.emoji} ${fmtMs(obstLeft(this.z, o.id))}`, 24, '#fff'));
      m.c.add(button(this, 0, 20, 260, 56, `⏩ 💎${cost}`, () => { if (clearRush(this.z, o.id)) { m.close(); this.refresh(); } else this.toast('💎?'); }, 0x8fe3ff, '#06222e', 20));
      return;
    }
    this.refresh();
  }
  refresh() {
    const now = Date.now(), e = energy(now);
    this.hud.setText(`⚡${e}/${E_MAX}${e < E_MAX ? ` (+1 ${fmtMs(msToNextEnergy(now))})` : ''}   🪙${save.coins}   ⭐${starBalance()}`);
    for (const it of this.items) {
      const st = obstState(this.z, it.o.id), k = OBST[it.o.kind];
      if (st === 'done') { it.icon.setVisible(false); it.tag.setText('✨').setBackgroundColor(''); continue; }
      it.icon.setAlpha(st === 'clearing' ? 0.55 : 1);
      it.tag.setText(st === 'idle' ? `🪙${k.coins} ⚡${k.energy}` : st === 'ready' ? '✅ !' : `⏳ ${fmtMs(obstLeft(this.z, it.o.id, now))}`);
    }
  }
  toast(s, ms = 1800) {
    const t = txt(this, this.scale.width / 2, 200, s, 20, '#fff').setBackgroundColor('#0a0f0dee').setPadding(12, 8).setDepth(50);
    this.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 400, onComplete: () => t.destroy() });
  }
}
