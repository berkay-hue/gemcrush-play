// PR-A: elle çiftlik — tahta tabela (çiftlik adı), sürükleyerek hasat, besleme kovası
import { save, persist } from '../meta/save.js';
import { item, status, owns } from '../meta/farm.js';
import { cropState, harvest, SEEDS } from '../meta/crops.js';
import { hunger, feed, feedLeft, isSick, LIVESTOCK, FEED_COINS } from '../meta/animals.js';
import { energy, E_MAX } from '../meta/energy.js';
import { rollGold } from '../meta/care.js';
import { track } from '../analytics.js';
import { sfx } from '../sound.js';
import { txt } from '../ui/widgets.js';
import { getLang } from '../i18n.js';
import { sickleTex } from '../farmArt.js';
import { farmTitle, renameBox } from '../ui/farmTitle.js';
import { t } from '../i18n.js';

const hhmm = (ms) => { const m = Math.ceil(ms / 60000); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

export const HandsMixin = {
  setupHands() {
    sickleTex(this);
    const w = this.w3;
    w.setSignText && w.setSignText(farmTitle());
    this.buildBucket();
  },

  // ---- tabela ----
  signHit(p) {
    const w = this.w3; if (!w.signPos) return false;
    const [x, z] = w.signPos, a = w.project(x, 0.2, z), b = w.project(x, 1.9, z);
    if (!a.vis) return false;
    const h = Math.max(20, a.y - b.y);
    return Math.abs(p.x - a.x) < h * 0.85 && p.y < a.y + 8 && p.y > b.y - 8;
  },
  signTap() {
    sfx.click(); this.w3.signWiggle && this.w3.signWiggle();
    renameBox((ok) => {
      if (!ok) return;
      this.w3.setSignText && this.w3.setSignText(farmTitle());
      this.w3.signWiggle && this.w3.signWiggle();
      if (this.drawTitle) this.drawTitle();
      this.toast(`🪧 ${farmTitle()}`);
    });
  },

  // ---- hasat ----
  isReadyPlot(id) { return !!id && item(id)?.kind === 'plot' && status(id) === 'owned' && cropState(id) === 'ready'; },
  harvestPlot(id, quiet = false) {
    const it = item(id); const c = this.nodes[id]; const r = harvest(id); if (!r) return null;
    const coins = r.coins;
    sfx.harvest(); this.w3.burst(id); this.w3.poke && this.w3.poke(id);
    track('crop_harvest', { plot: id, coins, good: r.good, n: r.n, drag: quiet });
    const cx = c ? c.x : this.scale.width / 2, cy = c ? c.y : this.scale.height / 2;
    if (!quiet) {
      const sk = this.add.image(cx - 60, cy - 10, 'sickle').setDepth(900);
      this.tweens.add({ targets: sk, x: cx + 60, angle: 360, duration: 450, onComplete: () => sk.destroy() });
    }
    for (let i = 0; i < 5; i++) {
      const f = txt(this, cx - 40 + i * 20, cy, r.emoji || it.emoji, 28).setDepth(901);
      this.tweens.add({ targets: f, y: cy - 30, duration: 160, delay: i * 30, ease: 'Quad.Out' });
      this.tweens.add({ targets: f, x: this.scale.width - 140, y: 40, scale: 0.4, delay: 200 + i * 80, duration: 650, ease: 'Cubic.In', onComplete: () => f.destroy() });
    }
    if (coins && !this.coinFrom) this.coinFrom = { x: cx, y: cy };
    this.time.delayedCall(260, () => { if (c) this.drawCrop(c, it); this.refreshHud(); });
    if (!quiet) this.toast([r.n ? `+${r.n} ${r.emoji || it.emoji} → 🏚️` : '', coins ? `+🪙${coins}` : '', r.good && coins ? t('ambarFull') : '', r.replant ? '💦 ' + (getLang() === 'en' ? 'replanted' : 'yeniden ekildi') : '', r.pest ? (r.pest === 'crow' ? '🐦‍⬛' : '🐛') + ' −%30' : '', r.dolu ? '🌨️ −%30' : '', r.combo ? `🔗×${r.combo} +%${r.combo * 10}` : '', r.gem ? `+💎${r.gem}` : ''].filter(Boolean).join('  ·  '));
    if (r.rare) this.rareDrop(r.rare, cx, cy);
    return { ...r, emoji: r.emoji || it.emoji };
  },
  // F34: nadir tohum düştü — parlayan tohum yükselir, ışık halkası, kısa kutlama yazısı
  rareDrop(k, cx, cy) {
    const S = SEEDS[k], en = getLang() === 'en'; track('rare_drop', { seed: k });
    const ring = this.add.circle(cx, cy - 20, 20, 0xffe58a, 0.55).setDepth(960);
    this.tweens.add({ targets: ring, radius: 90, alpha: 0, duration: 700, ease: 'Quad.Out', onComplete: () => ring.destroy() });
    const e = txt(this, cx, cy - 10, S.emoji, 48).setDepth(961).setScale(0.3);
    this.tweens.add({ targets: e, y: cy - 110, scale: 1.3, duration: 650, ease: 'Back.Out' });
    this.tweens.add({ targets: e, alpha: 0, delay: 1700, duration: 400, onComplete: () => e.destroy() });
    const l = txt(this, cx, cy - 165, en ? `✨ Rare seed: ${S.name.en}!` : `✨ Nadir tohum: ${S.name.tr}!`, 22, '#ffe58a').setStroke('#3a2400', 5).setDepth(962).setAlpha(0);
    this.tweens.add({ targets: l, alpha: 1, y: cy - 175, duration: 350, delay: 300, yoyo: true, hold: 1400, onComplete: () => l.destroy() });
    sfx.coin && sfx.coin();
  },
  // pad pointerdown'dan: hazır tarlada başlarsa sürükleyerek hasat moduna gir
  harvestStart(p, down) {
    const id = this.placing || this.editing ? null : this.w3.pick(p.x, p.y);
    if (!this.isReadyPlot(id)) return false;
    down.harvest = { done: new Set(), n: 0, coins: 0, em: [] };
    this.sickle = this.add.image(p.x, p.y - 30, 'sickle').setDepth(950).setScale(1.2);
    this.harvestAt(p, down);
    return true;
  },
  harvestAt(p, down) {
    const H = down.harvest; if (!H) return;
    if (this.sickle) { this.sickle.setPosition(p.x, p.y - 30); this.sickle.angle = Math.sin(Date.now() / 60) * 25; }
    const id = this.w3.pick(p.x, p.y);
    if (!this.isReadyPlot(id) || H.done.has(id)) return;
    H.done.add(id);
    const r = this.harvestPlot(id, true); if (!r) return;
    H.n += r.n || 0; H.coins += r.coins || 0; if (!H.em.includes(r.emoji)) H.em.push(r.emoji);
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* yok */ }
  },
  harvestEnd(down) {
    const H = down.harvest; if (!H) return;
    if (this.sickle) { const s = this.sickle; this.sickle = null; this.tweens.add({ targets: s, alpha: 0, scale: 0.6, duration: 180, onComplete: () => s.destroy() }); }
    const k = H.done.size; if (!k) return;
    this.lambReact && this.time.delayedCall(500, () => this.lambReact('joy', k > 2 ? '✋ ×' + k + ' — süper hasat! 🌾' : 'Mis gibi ürün! 🌾'));
    this.toast([k > 1 ? `✋ ×${k}` : '', H.n ? `+${H.n} ${H.em.join('')} → 🏚️` : '', H.coins ? `+🪙${H.coins}` : ''].filter(Boolean).join('  ·  '));
    const f = save.farm; if (k === 1 && !f.dragTip) { f.dragTip = 1; persist(); this.time.delayedCall(1300, () => this.toast('✋ Parmağını tarlaların üstünde sürükle, hepsini topla!')); }
  },

  // ---- besleme kovası ----
  ownedLivestock() { return LIVESTOCK.filter((id) => owns(id) && this.w3.anchor(id, 0)); },
  buildBucket() {
    if (this.bucket) { this.bucket.destroy(); this.bucket = null; }
    if (!this.ownedLivestock().length) return;
    const X = 50, Y = 440;
    const c = this.add.container(X, Y).setDepth(60);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35); g.fillEllipse(0, 24, 50, 12);
    g.fillStyle(0x6b4a2b, 1); g.fillRoundedRect(-22, -12, 44, 36, { tl: 4, tr: 4, bl: 12, br: 12 });
    g.fillStyle(0x8f653d, 1); g.fillRoundedRect(-19, -10, 38, 31, { tl: 3, tr: 3, bl: 10, br: 10 });
    g.fillStyle(0x3d2a17, 1); for (const y of [-2, 12]) g.fillRect(-21, y, 42, 3);
    g.fillStyle(0xe8c25a, 1); g.fillEllipse(0, -12, 40, 11);
    g.fillStyle(0xf5d97a, 1); for (let i = 0; i < 7; i++) g.fillEllipse(-14 + i * 4.6, -14 + (i % 2) * 2, 5, 3);
    g.lineStyle(3, 0x3d2a17, 1); g.beginPath(); g.arc(0, -12, 22, Math.PI * 1.05, Math.PI * 1.95); g.strokePath();
    const lbl = txt(this, 0, 36, 'Yem', 13, '#fff3cf').setShadow(0, 1, 'rgba(0,0,0,.6)', 3, true, true);
    const dot = this.add.circle(18, -18, 7, 0xff3b5c).setStrokeStyle(2, 0xffffff);
    c.add([g, lbl, dot]); c.dot = dot;
    c.setSize(56, 70).setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(c);
    this.bucket = c; this.bucketHome = [X, Y];
    const hungry = () => this.ownedLivestock().some((id) => !isSick(id) && feedLeft(id) === 0 && hunger(id) < 70);
    const pulse = () => { if (!c.active) return; dot.setVisible(hungry()); };
    pulse(); const ev = this.time.addEvent({ delay: 5000, loop: true, callback: pulse }); c.once('destroy', () => ev.remove());
    this.tweens.add({ targets: c, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    c.on('dragstart', () => { this.bucketDrag = true; sfx.click(); this.tweens.killTweensOf(c); c.angle = 0; c.setScale(1.15); this.showHungerBars(true); });
    c.on('drag', (_p, x, y) => { c.setPosition(x, y); this.bucketHover(x, y); });
    c.on('dragend', () => { this.bucketDrag = false; const id = this.bucketHover(c.x, c.y); this.showHungerBars(false); if (id) this.feedAnimal(id); this.bucketBack(); });
    c.on('pointerup', () => { if (!this.bucketDrag && !this._bucketTipped) { this._bucketTipped = 1; this.toast('🪣 Kovayı sürükleyip bir hayvanın üstüne bırak'); } });
  },
  bucketBack() {
    const c = this.bucket; if (!c) return; const [X, Y] = this.bucketHome;
    this.tweens.add({ targets: c, x: X, y: Y, scale: 1, duration: 320, ease: 'Back.Out', onComplete: () => this.tweens.add({ targets: c, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' }) });
  },
  bucketTarget(x, y) {
    let best = null, bd = 80;
    for (const id of this.ownedLivestock()) {
      const a = this.w3.anchor(id, 0.6); if (!a || !a.vis) continue;
      const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = id; }
    }
    if (best) return best;
    const id = this.w3.pick(x, y);
    return id && LIVESTOCK.includes(id) && owns(id) ? id : null;
  },
  bucketHover(x, y) {
    const id = this.bucketTarget(x, y);
    for (const k in this.hbars || {}) this.hbars[k].setScale(k === id ? 1.2 : 1);
    return id;
  },
  showHungerBars(on) {
    for (const k in this.hbars || {}) this.hbars[k].destroy();
    this.hbars = {};
    if (this.hbarEv) { this.events.off('update', this.hbarEv); this.hbarEv = null; }
    if (!on) return;
    for (const id of this.ownedLivestock()) {
      const b = this.add.container(0, 0).setDepth(55);
      const g = this.add.graphics(); b.add(g); b.g = g;
      b.add(txt(this, 0, -18, item(id).emoji, 20));
      this.hbars[id] = b; this.drawHungerBar(id);
    }
    this.hbarEv = () => { for (const id in this.hbars) { const a = this.w3.anchor(id, 0.9); if (a) this.hbars[id].setPosition(a.x, a.y - 16).setVisible(a.vis); } };
    this.hbarEv(); this.events.on('update', this.hbarEv);
  },
  drawHungerBar(id, v = hunger(id)) {
    const b = this.hbars && this.hbars[id]; if (!b) return;
    const g = b.g; g.clear();
    const sick = isSick(id), col = sick ? 0x9b59b6 : v > 60 ? 0x6fd14a : v > 30 ? 0xffc53d : 0xff4d4d;
    g.fillStyle(0x000000, 0.55); g.fillRoundedRect(-30, -4, 60, 12, 6);
    g.fillStyle(col, 1); g.fillRoundedRect(-28, -2, Math.max(4, 56 * v / 100), 8, 4);
    g.fillStyle(0xffffff, 0.3); g.fillRoundedRect(-28, -2, Math.max(4, 56 * v / 100), 3, 2);
    if (feedLeft(id) > 0 && !sick) { g.lineStyle(2, 0xffffff, 0.6); g.strokeRoundedRect(-30, -4, 60, 12, 6); }
  },
  feedAnimal(id) {
    const before = hunger(id), r = feed(id), it = item(id);
    if (r === 'cd') return this.toast(`${it.emoji} tok · ⏳ ${hhmm(feedLeft(id))}`);
    if (r === 'sick') return this.toast(`${it.emoji} hasta — veteriner lazım 🩺`);
    if (r === 'coins') { this.lambReact && this.lambReact('sad', 'Yem parası yetmedi 😢'); return this.toast(`🪙 yetersiz (${FEED_COINS} gerekli)`); }
    if (r === 'energy') { this.lambReact && this.lambReact('sad', 'Enerjimiz bitti 😴'); return this.toast('⚡ enerji yok'); }
    sfx.coin && sfx.coin(); track('animal_feed', { id, before });
    this.w3.poke && this.w3.poke(id); this.w3.burst && this.w3.burst(id, 0x9ccc3a, 14);
    const a = this.w3.anchor(id, 0.5), bx = this.bucket ? this.bucket.x : 50, by = this.bucket ? this.bucket.y : 440;
    if (a) for (let i = 0; i < 6; i++) {
      const f = txt(this, bx, by - 10, '🌾', 20).setDepth(902);
      this.tweens.add({ targets: f, x: a.x + (i - 2.5) * 8, y: a.y, angle: 180, scale: 0.6, delay: i * 40, duration: 380, ease: 'Quad.In', onComplete: () => f.destroy() });
    }
    if (navigator.vibrate) try { navigator.vibrate([10, 30, 10]); } catch (e) { /* yok */ }
    this.toast(`${it.emoji} doydu 💚  −🪙${FEED_COINS}  −⚡1`);
    if (this.lambReact) { const p = this.w3.where && this.w3.where(id); if (p && this.w3.mascotLook) this.w3.mascotLook(p[0], p[1]); this.lambReact('joy', 'Afiyet olsun ' + it.emoji + ' 💚'); }
    if (this.energyTxt) this.energyTxt.setText(`⚡${energy()}/${E_MAX}`);
    if (this.bucket) this.bucket.dot.setVisible(this.ownedLivestock().some((k) => !isSick(k) && feedLeft(k) === 0 && hunger(k) < 70));
    if (rollGold(id) && this.goldEgg) this.goldEgg(id); // F37: mutlu hayvan besleyince altın yumurta şansı
    this.refreshHud();
  },
};
