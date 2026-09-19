// F6: game-in-game bridge. Win rewards fly into the 3D farm, the vet level
// cures a sick animal (it dances), 3-star wins start Bereket, and a pre-level
// card tells what the level brings to the farm.
import { save, tickLives } from '../meta/save.js';
import { txt, button, modal, fmtMs } from '../ui/widgets.js';
import { WIN_CUT, cropState } from '../meta/crops.js';
import { CATALOG, owns } from '../meta/farm.js';
import { isSick, vetLeft, useVet, cureWithGems, CURE_GEMS, LIVESTOCK } from '../meta/animals.js';
import { bereketLeft } from '../meta/bereket.js';
import { sfx } from '../sound.js';

const MIN = Math.round(WIN_CUT / 60000);

export const BridgeMixin = {
  bridgeArrive(d) {
    const { width, height } = this.scale;
    const from = { x: width / 2, y: height - 60 };
    let delay = 250;
    (d.cut || []).forEach((id) => {
      const a = this.w3 ? this.w3.anchor(id, 0.3) : this.nodes[id] && { x: this.nodes[id].x, y: this.nodes[id].y, vis: true };
      if (!a || !a.vis) return;
      for (let i = 0; i < 4; i++) {
        const s = txt(this, from.x, from.y, '✨', 26).setDepth(1500);
        this.tweens.add({ targets: s, x: a.x + (i - 1.5) * 12, y: a.y, scale: 0.6, delay: delay + i * 70, duration: 700, ease: 'Cubic.InOut', onComplete: () => s.destroy() });
      }
      this.time.delayedCall(delay + 750, () => {
        const l = txt(this, a.x, a.y - 10, `−${MIN} dk ✨`, 20, '#9dffb8').setDepth(1501).setStroke('#0a0f0d', 5);
        this.tweens.add({ targets: l, y: a.y - 60, alpha: 0, delay: 700, duration: 800, onComplete: () => l.destroy() });
        sfx.coin && sfx.coin();
      });
      delay += 220;
    });
    if (d.energy && this.energyTxt) {
      const e = this.energyTxt;
      for (let i = 0; i < d.energy; i++) {
        const s = txt(this, from.x, from.y, '⚡', 28).setDepth(1500);
        this.tweens.add({ targets: s, x: e.x, y: e.y + 8, scale: 0.5, delay: delay + i * 120, duration: 650, ease: 'Cubic.In', onComplete: () => { s.destroy(); this.tweens.add({ targets: e, scale: 1.4, yoyo: true, duration: 120 }); } });
      }
    }
    if (d.bereket) this.time.delayedCall(delay + 600, () => this.toast('🌾 Bereket! 10 dk hasat ×2'));
    if (d.cured) this.danceAnimal(d.cured);
  },

  danceAnimal(id) {
    const a = this.w3 && this.w3.anchor(id, 0.4);
    for (let i = 0; i < 6; i++) this.time.delayedCall(i * 650, () => this.w3 && this.w3.poke(id));
    if (a && a.vis) ['🎉', '💚', '🎵', '💚', '🎶'].forEach((e, i) => {
      const s = txt(this, a.x, a.y, e, 28).setDepth(1500);
      this.tweens.add({ targets: s, x: a.x + (i - 2) * 35, y: a.y - 90, alpha: 0, delay: 200 + i * 150, duration: 1300, onComplete: () => s.destroy() });
    });
    this.toast('🩺 İyileşti! 💃');
  },

  // Bereket badge under the energy line; ticks with refreshHud
  drawBereket() {
    const { width } = this.scale;
    this.berTxt = txt(this, width / 2, 122, '', 15, '#ffe58a').setOrigin(0.5, 0).setStroke('#0a0f0d', 4).setDepth(950);
    const tick = () => { const ms = bereketLeft(); this.berTxt.setText(ms ? `🌾 Bereket ×2 · ${fmtMs(ms)}` : ''); };
    tick(); this.time.addEvent({ delay: 1000, loop: true, callback: tick });
  },

  // pre-level card: what this level brings to the farm
  preLevel(lv, vetFor = null) {
    tickLives();
    if (save.lives <= 0) { this.scene.start('Map', { livesModal: true }); return; }
    const { width, height } = this.scale; const cx = width / 2, cy = height / 2;
    const { c, close } = modal(this, 440, 400);
    c.add(txt(this, cx, cy - 160, vetFor ? '🩺 Veteriner bölümü' : `🪧 Bölüm ${lv.id}`, 28, '#ffb71b'));
    c.add(txt(this, cx, cy - 118, 'Bu bölüm çiftliğine ne kazandırır?', 17, '#fff'));
    const growing = CATALOG.filter((i) => i.kind === 'plot' && owns(i.id) && cropState(i.id) === 'growing').length;
    const rows = [];
    if (vetFor) rows.push(`💚 ${vetFor} iyileşir ve dans eder`);
    rows.push(growing ? `🌽 ${growing} tarla −${MIN} dk` : `🌽 Ekili tarlalar −${MIN} dk`);
    rows.push('⚡ +2 enerji (3⭐ ise +3)');
    rows.push('🌾 3⭐ → 10 dk Bereket (hasat ×2)');
    rows.push('⭐ Yeni yıldızlar = yeni hayvan/bina');
    rows.forEach((r, i) => c.add(txt(this, cx, cy - 75 + i * 36, r, 18, '#9dffb8')));
    c.add(button(this, cx, cy + 140, 280, 60, '▶ OYNA', () => { close(); this.scene.start('Game', { level: lv, vetFor }); }, 0x2ee06a, '#04220e', 24));
  },

  vetModal(id) {
    const { width, height } = this.scale; const cx = width / 2, cy = height / 2;
    const { c, close } = modal(this, 420, 320);
    c.add(txt(this, cx, cy - 110, '🤒', 60));
    c.add(txt(this, cx, cy - 50, `${id} hasta`, 26, '#ffb71b'));
    const n = vetLeft();
    c.add(txt(this, cx, cy - 12, `Veteriner bölümünü kazan → iyileşir (bugün ${n}/3)`, 16, '#fff'));
    const lvN = Math.min(save.level, this.levels.length);
    c.add(button(this, cx, cy + 50, 300, 56, n ? '🩺 Veteriner bölümü' : '🩺 Yarın tekrar', () => {
      if (!n || !useVet()) return; close(); this.preLevel(this.levels[lvN - 1], id);
    }, n ? 0x2ee06a : 0x2a333a, n ? '#04220e' : '#777', 20));
    const ok = save.gems >= CURE_GEMS;
    c.add(button(this, cx, cy + 115, 220, 48, `💎 ${CURE_GEMS} hemen`, () => { if (cureWithGems(id)) { close(); this.scene.restart({ cured: id }); } }, ok ? 0x8fe3ff : 0x2a333a, ok ? '#06222e' : '#777', 18));
  },
};
export const isSickAnimal = (id) => LIVESTOCK.includes(id) && owns(id) && isSick(id);
