// F5: side regions (Orman Kıyısı / Dere Kenarı) live in the same 3D world.
// ◀ ▶ glide the camera; locked regions are fogged with a ⭐ sign; obstacles
// are 3D (bush / stump / rock) with Phaser tags following them.
import { save, starBalance } from '../meta/save.js';
import { ZONES, OBST, zoneOpen, openZone, obstState, obstLeft, startClear, collectClear, clearRush, clearRushCost, zoneDone } from '../meta/zones.js';
import { FarmWorld } from '../farm3d/FarmWorld.js';
import { txt, button, modal, fmtMs } from '../ui/widgets.js';
import { getLang } from '../i18n.js';
import { sfx } from '../sound.js';

const L = (o) => (getLang() === 'tr' ? o.tr : o.en);
const S = {
  open: { tr: 'Aç', en: 'Unlock' }, needStars: { tr: 'Yıldız yetmiyor — seviye oyna!', en: 'Not enough stars — play levels!' },
  coins: { tr: 'Altın yetmiyor', en: 'Not enough coins' }, energy: { tr: 'Enerji bitti — bir seviye oyna', en: 'Out of energy — play a level' },
  done: { tr: 'Bölge temiz! Açıldı:', en: 'Zone cleared! Unlocked:' }, home: { tr: 'Çiftlik', en: 'Farm' },
};
const ORDER = ['sol', '', 'sag'];

export const RegionMixin = {
  setupRegions() {
    const w = this.w3;
    this.region = w.cx === -26 ? 'sol' : w.cx === 26 ? 'sag' : '';
    this.rtags = [];
    for (const z of ['sol', 'sag']) {
      w.buildRegion(z, ZONES[z].obstacles).then(() => {
        if (!this.sys || !this.sys.isActive()) return;
        w.setRegionFog(z, !zoneOpen(z));
        for (const o of ZONES[z].obstacles) {
          const tag = txt(this, 0, 0, '', 14, '#fff').setBackgroundColor('#0a0f0dcc').setPadding(6, 3).setDepth(5);
          this.rtags.push({ z, o, tag });
        }
        const sign = txt(this, 0, 0, '', 20, '#1a1200').setBackgroundColor('#ffb71b').setPadding(10, 6).setDepth(5);
        this.rtags.push({ z, sign });
        this.refreshRegions();
      });
    }
    this.regionLabel = txt(this, this.scale.width / 2, 150, '', 20, '#ffb71b').setStroke('#0a0f0d', 5).setDepth(6);
    this.setRegionLabel();
    this.events.on('update', () => this.followRegions());
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshRegions() });
  },
  goRegion(step) {
    const i = Math.max(0, Math.min(2, ORDER.indexOf(this.region) + step));
    this.region = ORDER[i];
    this.w3.glideTo(FarmWorld.regionCenter(this.region));
    sfx.swap && sfx.swap();
    this.setRegionLabel();
  },
  setRegionLabel() {
    this.regionLabel.setText(this.region ? `🧭 ${L(ZONES[this.region].name)}` : '');
  },
  followRegions() {
    const w = this.w3;
    for (const r of this.rtags) {
      const a = r.sign ? w.project(FarmWorld.regionCenter(r.z), 3.4, 0) : w.obstacleAnchor(r.z, r.o.id, 0.5);
      const el = r.sign || r.tag;
      el.setPosition(a.x, a.y).setOrigin(0.5);
      el.setVisible(a.vis && a.y > 110 && a.y < 880 && a.x > -60 && a.x < 600 && el.text !== '');
    }
  },
  refreshRegions() {
    const now = Date.now();
    for (const r of this.rtags) {
      if (r.sign) { r.sign.setText(zoneOpen(r.z) ? '' : `🔒 ${L(ZONES[r.z].name)} · ⭐${ZONES[r.z].price}`); continue; }
      const st = obstState(r.z, r.o.id, now), k = OBST[r.o.kind];
      this.w3.setObstacle(r.z, r.o.id, st);
      r.tag.setText(st === 'locked' || st === 'done' ? '' : st === 'idle' ? `🪙${k.coins} ⚡${k.energy}` : st === 'ready' ? '✅ !' : `⏳ ${fmtMs(obstLeft(r.z, r.o.id, now))}`);
    }
  },
  // returns true when the tap was consumed by a region
  regionTap(p) {
    const z = this.region; if (!z || !this.w3.regions || !this.w3.regions[z]) return false;
    if (!zoneOpen(z)) { this.unlockModal(z); return true; }
    const id = this.w3.pickObstacle(z, p.x, p.y); if (!id) return false;
    const o = ZONES[z].obstacles.find((x) => x.id === id), st = obstState(z, id), k = OBST[o.kind];
    if (st === 'idle') {
      const r = startClear(z, id);
      if (r) this.toast(L(S[r] || S.coins)); else { sfx.swap && sfx.swap(); this.refreshHud(); }
    } else if (st === 'ready') {
      const a = this.w3.obstacleAnchor(z, id, 0.3);
      const r = collectClear(z, id); sfx.win();
      this.dustPuff(a.x, a.y);
      this.toast(`+${r.coins}🪙${r.gems ? ` +${r.gems}💎` : ''}`);
      if (zoneDone(z)) this.time.delayedCall(900, () => this.toast(`${L(S.done)} ${L(ZONES[z].unlocks)}`));
      this.refreshHud();
    } else if (st === 'clearing') {
      const cost = clearRushCost(z, id), m = modal(this, 400, 220);
      m.c.add(txt(this, this.scale.width / 2, this.scale.height / 2 + -60, `${k.emoji} ${fmtMs(obstLeft(z, id))}`, 24, '#fff'));
      m.c.add(button(this, this.scale.width / 2, this.scale.height / 2 + 20, 260, 56, `⏩ 💎${cost}`, () => { if (clearRush(z, id)) { m.close(); this.refreshRegions(); this.refreshHud(); } else this.toast('💎?'); }, 0x8fe3ff, '#06222e', 20));
    }
    this.refreshRegions();
    return true;
  },
  unlockModal(z) {
    const Z = ZONES[z], m = modal(this, 420, 300);
    m.c.add(txt(this, this.scale.width / 2, this.scale.height / 2 + -90, `🔒 ${L(Z.name)}`, 26, '#ffb71b'));
    m.c.add(txt(this, this.scale.width / 2, this.scale.height / 2 + -30, `🎁 ${L(Z.unlocks)}`, 18, '#fff'));
    m.c.add(button(this, this.scale.width / 2, this.scale.height / 2 + 50, 220, 60, `${L(S.open)} ⭐${Z.price}`, () => {
      if (openZone(z)) { sfx.win(); m.close(); this.w3.setRegionFog(z, false); this.refreshRegions(); this.refreshHud(); const a = this.w3.project(FarmWorld.regionCenter(z), 1, 0); this.dustPuff(a.x, a.y, 14); }
      else this.toast(L(S.needStars));
    }, 0xffb71b, '#1a1200', 22));
  },
  dustPuff(x, y, n = 9) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, d = 50 + Math.random() * 40;
      const p = txt(this, x, y, i % 3 ? '💨' : '✨', 26 + Math.random() * 14).setDepth(1500);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6 - 20, alpha: 0, scale: 1.6, duration: 650 + Math.random() * 250, ease: 'Cubic.Out', onComplete: () => p.destroy() });
    }
  },
};
