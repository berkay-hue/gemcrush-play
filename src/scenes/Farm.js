// Farm hub (Faz 1): the home screen. Stars earned in match-3 buy buildings,
// animals and fields. The OYNA sign starts the next level.
import { CONFIG } from '../config.js';
import { save, tickLives, msToNextLife, starBalance } from '../meta/save.js';
import { SEASONS, currentSeason, decor, buySeasonal } from '../meta/season.js';
import { showRewarded } from '../monetize/ads.js';
import { Visitors, KINDS } from '../farm3d/visitors.js';
import { isSick, hunger, LIVESTOCK } from '../meta/animals.js';
import { CATALOG, TABS, item, status, buyItem, owns, PERK_TEXT, newUnlocks, markSeen, posOf, setPos, land, LAND_MAX, landCost, landLvl, landStatus, buyLand, BLD_MAX, bldLvl, upgradeCost, upgrade, ambarCap } from '../meta/farm.js';
import { PRODUCTS, TRADES, HATCH_WINS, isReady, readyAt, collect, inventory, sell, trade, hatchState, incubate, hatch, rush, rushCost, ambarUsed, ambarFull } from '../meta/produce.js';
import { currentQuest, questDone, claimQuest, takeDialog } from '../meta/quests.js';
import { t, getLang } from '../i18n.js';
import { energy, E_MAX } from '../meta/energy.js';
import { track } from '../analytics.js';
import { sfx } from '../sound.js';
import { txt, button, modal, fmtMs } from '../ui/widgets.js';
import { CROPS, WIN_CUT, cropState, growth, msLeft, plant, harvest, cropRush, cropRushCost, autoHarvest } from '../meta/crops.js';
import { buildFarmArt, spawnChickens } from '../farmArt.js';
import { getWorld, LAYOUT } from '../farm3d/FarmWorld.js';
import { RegionMixin } from './farmRegions.js';
import { BridgeMixin, isSickAnimal } from './farmBridge.js';
import { ftueCurrent, ftueDone, farmDaily, farmClaimDaily, awaySummary } from '../meta/onboard.js';
import { PETS, petsOpen, nameOf, setName, lovePet, loveState, LOVE_N, claimPage, pageClaimed, PAGE_REWARD } from '../meta/bond.js';

const MOVABLE = (id) => ['building', 'plot', 'vehicle'].includes((item(id) || {}).kind);

export class Farm extends Phaser.Scene {
  constructor() { super('Farm'); }

  create(data = {}) {
    const { width, height } = this.scale;
    this.levels = this.cache.json.get('levels');
    tickLives();
    // F1: 3D world behind a transparent Phaser canvas; 2D meadow only as fallback
    this.w3 = getWorld();
    if (this.w3) this.setup3d();
    else {
    this.cameras.main.setBackgroundColor('#7cc36a');
    const g = this.add.graphics();
    g.fillStyle(0x9fd8f0).fillRect(0, 100, width, 120);                 // sky
    g.fillStyle(0x5aa84a).fillEllipse(120, 230, 420, 120).fillEllipse(430, 225, 380, 110); // hills
    g.fillStyle(0x7cc36a).fillRect(0, 230, width, height - 230);
    g.fillStyle(0xc9a26b).fillRect(width / 2 - 30, 560, 60, height - 700); // path
    g.fillStyle(0x6fb85e);
    for (let i = 0; i < 40; i++) g.fillCircle((i * 97) % width, 260 + ((i * 53) % 640), 6 + (i % 4));
    txt(this, 440, 150, '☁️', 40); txt(this, 90, 130, '☀️', 44);

    buildFarmArt(this);
    }
    this.nodes = {};
    for (const it of CATALOG) this.drawItem(it);
    if (this.w3) for (const id in PETS) this.w3.setItem(id, petsOpen() ? 'owned' : 'hidden');
    // live chickens wander around the coop
    if (!this.w3 && owns('tavuk')) spawnChickens(this, 2 + (owns('horoz') ? 2 : 0), { x: 40, y: 400, w: 200, h: 110 }, owns('horoz'));
    if (data.cropCut) this.toast(`🌽 −${Math.round(WIN_CUT / 60000) * data.cropCut} ${t('minShort')}!`);

    // HUD
    this.add.rectangle(width / 2, 50, width, 100, 0x0a0f0d, 0.92);
    this.add.image(40, 50, 'heart').setScale(0.7);
    this.livesTxt = txt(this, 90, 42, '', 24, '#ffffff').setOrigin(0, 0.5);
    this.lifeTimer = txt(this, 90, 68, '', 16, '#9fb3a8').setOrigin(0, 0.5);
    this.add.image(width - 150, 50, 'coin').setScale(0.6);
    this.coinsTxt = txt(this, width - 120, 38, '', 22, '#ffe58a').setOrigin(0, 0.5);
    this.gemsTxt = txt(this, width - 150, 72, '', 18, '#8fe3ff').setOrigin(0, 0.5);
    txt(this, width / 2, 36, t('farm'), 26, '#ffb71b');
    this.starsTxt = txt(this, width / 2, 72, '', 20, '#ffe58a');
    button(this, width - 50, 180, 80, 40, `🧺 ${t('market')}`, () => this.market(), 0xffb71b, '#1a1200', 16);
    const hs = hatchState();
    if (owns('kumes')) {
      const hb = button(this, width - 50, 230, 80, 40, hs.active ? (hs.ready ? '🐣 !' : `🥚 ${hs.done}/${HATCH_WINS}`) : '🪺', () => this.nest(), 0x2a333a, '#fff', 16);
      if (hs.ready) this.tweens.add({ targets: hb, scale: 1.1, yoyo: true, repeat: -1, duration: 400 });
    }
    // seasonal decor already bought, placed along the fence
    decor().forEach((id, i) => { const s = SEASONS.find((x) => x.id === id); if (s) txt(this, 40 + i * 50, 300, s.emoji, 40); });
    const se = currentSeason();
    if (!decor().includes(se.id)) button(this, 50, 180, 80, 40, `${se.emoji} 💎${se.price}`, () => this.seasonal(), 0x8fe3ff, '#06222e', 16);
    button(this, width - 50, 130, 80, 40, `🗺 ${t('map')}`, () => this.scene.start('Map'), 0x2a333a, '#fff', 16);

    button(this, 22, 470, 40, 90, '◀', () => (this.w3 ? this.goRegion(-1) : this.scene.start('Zone', { zone: 'sol' })), 0x2a333a, '#fff', 22);
    button(this, width - 22, 470, 40, 90, '▶', () => (this.w3 ? this.goRegion(1) : this.scene.start('Zone', { zone: 'sag' })), 0x2a333a, '#fff', 22);
    this.energyTxt = txt(this, width / 2, 100, `⚡${energy()}/${E_MAX}`, 16, '#ffe58a').setOrigin(0.5, 0);
    this.drawBereket();
    // OYNA sign
    const lvN = Math.min(save.level, this.levels.length);
    this.playBtn = button(this, width / 2, height - 60, 300, 72, `🪧 ${t('play')} ▶ ${t('level')} ${lvN}`, () => this.tryStart(this.levels[lvN - 1]), 0x2ee06a, '#04220e', 24);

    if (this.w3) {
      const nu = newUnlocks().length;
      this.shopBtn = button(this, 70, height - 60, 120, 64, `🏪 ${t('shop')}${nu ? ' •' + nu : ''}`, () => this.shop(), nu ? 0xff5a8a : 0xffb71b, nu ? '#fff' : '#1a1200', 18);
      if (nu) this.tweens.add({ targets: this.shopBtn, scale: 1.08, yoyo: true, repeat: -1, duration: 450 });
      button(this, width - 70, height - 60, 120, 64, `✋ ${t('edit')}`, () => this.toggleEdit(), 0x2a333a, '#fff', 18);
      this.playBtn.setScale(0.8);
    }
    this.drawQuest();
    this.time.delayedCall(400, () => this.bridgeArrive(data));
    if (data.cropCut !== undefined && ftueDone('play')) this.time.delayedCall(2200, () => { ftueDone('reward'); this.drawHint(); });
    this.drawHint();
    if (!Farm._greeted) { Farm._greeted = true; this.time.delayedCall(700, () => this.greet()); }
    button(this, 50, 230, 80, 40, `📖 ${this.bookCount()}`, () => this.book(), 0x2a333a, '#fff', 16);
    // Faz 6: harvest animation - product flies from the animal to the market basket
    if (data.harvest && this.nodes[data.harvest] && PRODUCTS[data.harvest]) {
      const n = this.nodes[data.harvest];
      for (let i = 0; i < 3; i++) {
        const f = txt(this, n.x, n.y - 30, PRODUCTS[data.harvest].emoji, 34);
        this.tweens.add({ targets: f, x: width - 50, y: 180, scale: 0.5, alpha: 0.2, delay: i * 120, duration: 700, ease: 'Cubic.In', onComplete: () => f.destroy() });
      }
    }
    if (data.dlg) { const d = takeDialog(data.dlg); if (d) this.dialog(d); }

    this.refreshHud();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshHud() });
  }

  drawItem(it) {
    const st = status(it.id);
    const c = this.add.container(it.x, it.y);
    const big = it.kind === 'building' ? 64 : 48;
    if (this.w3) return this.drawItem3d(it, st, c, big);
    c.add(this.add.ellipse(0, big * 0.55, big * 1.3, big * 0.35, 0x000000, 0.18));
    if (it.kind === 'plot') {
      c.add(this.add.image(0, 10, 'soil').setAlpha(st === 'owned' ? 1 : 0.45));
      if (st === 'owned') { this.drawCrop(c, it); this.nodes[it.id] = c; }
    }
    const e = txt(this, 0, 0, it.emoji, big).setAlpha(st === 'owned' ? 1 : 0.35);
    if (!(it.kind === 'plot' && st === 'owned')) c.add(e);
    if (st === 'owned') {
      if (it.kind === 'animal') this.tweens.add({ targets: e, y: -6, yoyo: true, repeat: -1, duration: 600 + (it.x % 7) * 90, ease: 'Sine.InOut' });
      if (PRODUCTS[it.id] && isReady(it.id)) {
        const b = txt(this, 30, -38, PRODUCTS[it.id].emoji, 30);
        c.add(b); this.tweens.add({ targets: b, y: -46, yoyo: true, repeat: -1, duration: 450 });
      }
    } else {
      const tag = st === 'locked' ? '🔒' : `⭐ ${it.price}`;
      const col = st === 'buyable' ? 0xffb71b : 0x2a333a;
      c.add(this.add.rectangle(0, big * 0.5 + 14, 70, 26, col, 0.95).setStrokeStyle(2, 0x000000, 0.3));
      c.add(txt(this, 0, big * 0.5 + 14, tag, 15, st === 'buyable' ? '#1a1200' : '#fff'));
      if (st === 'buyable') this.tweens.add({ targets: c, scale: 1.06, yoyo: true, repeat: -1, duration: 700 });
    }
    const hit = this.add.rectangle(0, 10, 120, 110, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => (it.kind === 'plot' && st === 'owned' ? this.plotTap(it.id) : this.itemModal(it.id)));
    c.add(hit);
    this.nodes[it.id] = c;
  }

  drawCrop(c, it) {
    if (this.w3) return this.drawCrop3d(c, it);
    if (c.crop) c.crop.destroy();
    const g = this.add.container(0, 0); c.crop = g; c.addAt(g, 2);
    const st = cropState(it.id);
    if (st === 'empty') { g.add(txt(this, 0, 4, `＋ ${t('plant')}`, 18, '#fff2d6')); return; }
    const stage = st === 'ready' ? 3 : Math.min(2, Math.floor(growth(it.id) * 3));
    const ripeEmoji = CROPS[it.id].key !== 'corn' && stage === 3;
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
      const x = -48 + k * 32 + (r ? 12 : 0), y = -8 + r * 26;
      const p = ripeEmoji ? txt(this, x, y + 12, it.emoji, 26) : this.add.image(x, y, `corn${stage}`).setOrigin(0.5, 0.85).setScale(0.8);
      g.add(p);
      this.tweens.add({ targets: p, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 1100 + ((k + r) % 3) * 200, ease: 'Sine.InOut' });
    }
    if (st === 'growing') {
      g.add(this.add.rectangle(0, 46, 104, 14, 0x0a0f0d, 0.8).setStrokeStyle(2, 0xffffff, 0.6));
      c.bar = this.add.rectangle(-50, 46, 100 * growth(it.id), 10, 0x2ee06a).setOrigin(0, 0.5); g.add(c.bar);
      c.left = txt(this, 0, 64, fmtMs(msLeft(it.id)), 14, '#ffffff'); g.add(c.left);
    } else {
      const b = txt(this, 44, -44, '✨', 26); g.add(b);
      this.tweens.add({ targets: b, scale: 1.3, yoyo: true, repeat: -1, duration: 500 });
    }
    c.cropState = st; c.cropStage = stage;
  }
  setup3d() {
    const w = this.w3;
    this.cameras.main.transparent = true;
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    { const ah = autoHarvest(); if (ah) this.time.delayedCall(600, () => this.toast(`🚜 +${ah} 🪙`)); }
    w.show(); w.posOf = posOf; w.tmpPos = null; w.setLand(land());
    if (!w.visitors) w.visitors = new Visitors(w);
    this.events.once('shutdown', () => w.hide());
    this.setupRegions();
    // drag = pan, pinch/wheel = zoom, short tap = raycast pick
    const pad = this.add.zone(0, 0, this.scale.width, this.scale.height).setOrigin(0).setInteractive().setDepth(-10);
    let down = null, pinch = 0;
    pad.on('pointerdown', (p) => { down = { x: p.x, y: p.y, lx: p.x, ly: p.y, t: Date.now(), moved: false }; });
    this.input.on('pointermove', (p) => {
      const a = this.input.pointer1, b = this.input.pointer2;
      if (a && b && a.isDown && b.isDown) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) w.zoomBy(pinch / d); pinch = d; if (down) down.moved = true; return;
      }
      pinch = 0;
      if (!down || !p.isDown) return;
      w.pan(p.x - down.lx, p.y - down.ly); down.lx = p.x; down.ly = p.y;
      if (Math.hypot(p.x - down.x, p.y - down.y) > 12) down.moved = true;
    });
    pad.on('pointerup', (p) => {
      if (down && !down.moved && Date.now() - down.t < 500 && this.placing) this.placeTap(p);
      else if (down && !down.moved && Date.now() - down.t < 500 && this.editing) { const id = w.pick(p.x, p.y); if (id && MOVABLE(id)) this.placeStart(id, true); }
      else if (down && !down.moved && Date.now() - down.t < 500 && !this.regionTap(p)) {
        const vis = w.visitors.pick(p.x, p.y);
        const id = vis ? null : w.pick(p.x, p.y);
        if (vis) this.greetVisitor(vis);
        else if (id === 'market') this.market();
        else if (id && PETS[id]) this.petAnimal(id);
        else if (id && item(id).kind === 'animal' && status(id) === 'owned') this.petAnimal(id);
        else if (id) { const it = item(id); (it.kind === 'plot' && status(id) === 'owned') ? this.plotTap(id) : this.itemModal(id); }
      }
      down = null; pinch = 0;
    });
    this.input.on('wheel', (_p, _o, _dx, dy) => w.zoomBy(dy > 0 ? 1.08 : 0.93));
    this.input.on('pointerupoutside', () => { down = null; });
    // overlays follow their 3D anchors
    this.events.on('update', () => {
      for (const id in this.nodes) {
        const a = w.anchor(id, 0.15), c = this.nodes[id];
        if (a && c.active) { c.x = a.x; c.y = a.y; c.setVisible(a.vis && a.y > 90 && a.y < 900); }
      }
    });
  }

  drawItem3d(it, st, c, big) {
    // F12: boş başlangıç — sahip olunmayan hiçbir şey dünyada görünmez, Mağaza'dan alınır
    if (st !== 'owned') { this.w3.setItem(it.id, 'hidden'); this.nodes[it.id] = c; return; }
    const sick = st === 'owned' && it.kind === 'animal' && LIVESTOCK.includes(it.id) && isSick(it.id);
    this.w3.setItem(it.id, st === 'owned' ? 'owned' : 'ghost', it.kind === 'plot' ? { crop: st === 'owned' ? cropState(it.id) : '', growth: st === 'owned' ? growth(it.id) : 0 } : { sick });
    this.nodes[it.id] = c;
    if (sick) {
      const b = txt(this, 0, -34, '🤒', 30);
      c.add(b); this.tweens.add({ targets: b, angle: 10, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.InOut' });
    }
    if (st === 'owned') {
      if (it.kind === 'plot') this.drawCrop(c, it);
      if (PRODUCTS[it.id] && isReady(it.id)) {
        const b = txt(this, 0, -30, PRODUCTS[it.id].emoji, 30);
        c.add(b); this.tweens.add({ targets: b, y: -40, yoyo: true, repeat: -1, duration: 450 });
      }
    } else {
      const tag = st === 'locked' ? `🔒 ${it.emoji}` : `${it.emoji} ⭐ ${it.price}`;
      const col = st === 'buyable' ? 0xffb71b : 0x2a333a;
      c.add(this.add.rectangle(0, -10, 96, 28, col, 0.95).setStrokeStyle(2, 0x000000, 0.3));
      c.add(txt(this, 0, -10, tag, 15, st === 'buyable' ? '#1a1200' : '#fff'));
      if (st === 'buyable') this.tweens.add({ targets: c, scale: 1.06, yoyo: true, repeat: -1, duration: 700 });
    }
  }

  drawCrop3d(c, it) {
    if (c.crop) c.crop.destroy();
    const g = this.add.container(0, 0); c.crop = g; c.add(g);
    const st = cropState(it.id);
    this.w3.setItem(it.id, 'owned', { crop: st, growth: st === 'growing' ? growth(it.id) : 0 });
    if (st === 'empty') g.add(txt(this, 0, 0, `＋ ${t('plant')}`, 16, '#fff2d6').setStroke('#3a2a10', 4));
    else if (st === 'growing') {
      g.add(this.add.rectangle(0, 0, 84, 12, 0x0a0f0d, 0.8).setStrokeStyle(2, 0xffffff, 0.6));
      c.bar = this.add.rectangle(-40, 0, 80 * growth(it.id), 8, 0x2ee06a).setOrigin(0, 0.5); g.add(c.bar);
      c.left = txt(this, 0, 16, fmtMs(msLeft(it.id)), 13, '#ffffff').setStroke('#000', 3); g.add(c.left);
    } else {
      const b = txt(this, 0, -6, `✨${it.emoji}`, 26); g.add(b);
      this.tweens.add({ targets: b, scale: 1.25, yoyo: true, repeat: -1, duration: 500 });
    }
    c.cropState = st; c.cropStage = st === 'ready' ? 3 : Math.min(2, Math.floor(growth(it.id) * 3));
  }

  plotTap(id) {
    const it = item(id); const c = this.nodes[id]; const st = cropState(id);
    if (st === 'empty') {
      plant(id); if (ftueDone('plant')) this.drawHint(); sfx.coin && sfx.coin(); track('crop_plant', { plot: id });
      this.drawCrop(c, it); this.tweens.add({ targets: c.crop, scaleY: { from: 0.2, to: 1 }, duration: 400, ease: 'Back.Out' });
      this.toast(`${it.emoji} ${t('planted')} · ${fmtMs(CROPS[id].ms)}`);
      return;
    }
    if (st === 'ready') {
      const coins = harvest(id); if (!coins) return;
      sfx.harvest(); this.w3.burst(id); track('crop_harvest', { plot: id, coins });
      const sk = this.add.image(c.x - 60, c.y - 10, 'sickle').setDepth(900);
      this.tweens.add({ targets: sk, x: c.x + 60, angle: 360, duration: 450, onComplete: () => sk.destroy() });
      for (let i = 0; i < 5; i++) {
        const f = txt(this, c.x - 40 + i * 20, c.y, it.emoji, 28).setDepth(901);
        this.tweens.add({ targets: f, x: this.scale.width - 140, y: 40, scale: 0.4, delay: 200 + i * 80, duration: 650, ease: 'Cubic.In', onComplete: () => f.destroy() });
      }
      this.time.delayedCall(260, () => { this.drawCrop(c, it); this.refreshHud(); });
      this.toast(`+🪙${coins}`);
      return;
    }
    // growing: info + rush + go play to speed up
    const { width, height } = this.scale; const { c: m, close } = modal(this, 440, 360);
    m.add(txt(this, width / 2, height / 2 - 125, it.emoji, 60));
    m.add(txt(this, width / 2, height / 2 - 70, this.itemName(it), 28, '#ffb71b'));
    const left = txt(this, width / 2, height / 2 - 30, `⏳ ${fmtMs(msLeft(id))}`, 26, '#ffe58a'); m.add(left);
    const tk = this.time.addEvent({ delay: 1000, loop: true, callback: () => { if (!m.active) return tk.remove(); left.setText(`⏳ ${fmtMs(msLeft(id))}`); } });
    m.add(txt(this, width / 2, height / 2 + 8, t('cropTip'), 17, '#9dffb8'));
    m.add(button(this, width / 2, height / 2 + 60, 300, 56, `▶ ${t('play')} (−5 ${t('minShort')})`, () => { close(); this.playBtn.emit('pointerup'); }, 0x2ee06a, '#04220e', 20));
    const cost = cropRushCost(id), ok = save.gems >= cost;
    const done = () => { sfx.coin(); close(); this.drawCrop(c, it); };
    m.add(button(this, width / 2 - 100, height / 2 + 125, 180, 48, `💎 ${cost} ${t('rush')}`, () => { if (cropRush(id)) { track('crop_rush', { plot: id, via: 'gems' }); done(); } }, ok ? 0x8fe3ff : 0x2a333a, ok ? '#06222e' : '#777', 17));
    m.add(button(this, width / 2 + 100, height / 2 + 125, 180, 48, `📺 ${t('rush')}`, async () => { if (await showRewarded('crop_rush') && cropRush(id, true)) { track('crop_rush', { plot: id, via: 'ad' }); done(); } }, 0x3f7bff, '#fff', 17));
  }
  tickCrops() {
    for (const it of CATALOG) {
      const c = this.nodes[it.id]; if (!c || !c.crop) continue;
      const st = cropState(it.id), stage = st === 'ready' ? 3 : st === 'growing' ? Math.min(2, Math.floor(growth(it.id) * 3)) : -1;
      if (st !== c.cropState || (st === 'growing' && stage !== c.cropStage)) { this.drawCrop(c, it); continue; }
      if (st === 'growing') { c.bar.width = 100 * growth(it.id); c.left.setText(fmtMs(msLeft(it.id))); }
    }
  }
  toast(msg) {
    const { width } = this.scale;
    const tt = txt(this, width / 2, 260, msg, 24, '#ffffff').setDepth(2000).setStroke('#0a0f0d', 6);
    this.tweens.add({ targets: tt, y: 220, alpha: 0, delay: 900, duration: 700, onComplete: () => tt.destroy() });
  }
  drawQuest() {
    const { width } = this.scale;
    const q = currentQuest();
    const c = this.add.container(width / 2 - 40, 130);
    c.add(this.add.rectangle(0, 0, width - 120, 44, 0x0a0f0d, 0.8).setStrokeStyle(2, 0xffb71b, 0.8));
    if (!q) { c.add(txt(this, 0, 0, `📜 ${t('questAll')}`, 17, '#fff')); return; }
    const done = questDone();
    c.add(txt(this, -((width - 120) / 2) + 14, 0, `📜 ${q.text[getLang()] || q.text.tr}`, 17, '#fff').setOrigin(0, 0.5));
    if (done) {
      const b = button(this, (width - 120) / 2 - 70, 0, 124, 34, `${t('questClaim')} 🪙${q.reward}`, () => {
        const r = claimQuest(); if (r) { sfx.coin(); track('quest_claim', { quest: q.id, reward: r }); this.scene.restart(); }
      }, 0x2ee06a, '#04220e', 14);
      c.add(b); this.tweens.add({ targets: b, scale: 1.08, yoyo: true, repeat: -1, duration: 500 });
    } else c.add(txt(this, (width - 120) / 2 - 14, 0, `🪙${q.reward}`, 16, '#ffe58a').setOrigin(1, 0.5));
  }

  dialog(lines, i = 0) {
    if (i >= lines.length) return;
    const { width, height } = this.scale;
    const [who, say] = lines[i];
    const c = this.add.container(width / 2, height - 190).setDepth(50);
    c.add(this.add.rectangle(0, 0, width - 40, 110, 0xffffff, 0.97).setStrokeStyle(3, 0x0a0f0d));
    c.add(this.add.triangle(-width / 2 + 90, 62, 0, 0, 24, 0, 0, 20, 0xffffff));
    c.add(txt(this, -width / 2 + 70, 0, who, 48));
    c.add(txt(this, 40, -6, say[getLang()] || say.tr, 19, '#0a0f0d').setWordWrapWidth(width - 180));
    c.add(txt(this, width / 2 - 50, 38, '▶', 16, '#888'));
    c.setScale(0.6); this.tweens.add({ targets: c, scale: 1, duration: 180, ease: 'Back.Out' });
    const hit = this.add.rectangle(width / 2, height / 2, width, height, 0, 0.001).setInteractive().setDepth(49);
    hit.on('pointerup', () => { c.destroy(); hit.destroy(); this.dialog(lines, i + 1); });
  }

  market() {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 460, 470);
    c.add(txt(this, width / 2, height / 2 - 195, `🧺 ${t('market')}`, 30, '#ffb71b'));
    const inv = inventory();
    const icons = { shuffle: '🔀', hammer: '🔨', moves5: '+5' };
    Object.values(PRODUCTS).forEach((p, i) => {
      const y = height / 2 - 120 + i * 105; const n = inv[p.good] || 0;
      c.add(txt(this, width / 2 - 170, y, `${p.emoji} ×${n}`, 26, '#fff').setOrigin(0, 0.5));
      c.add(button(this, width / 2 + 20, y, 110, 46, `🪙${p.price}`, () => { if (sell(p.good)) { sfx.coin(); track('market_sell', { good: p.good }); close(); this.market(); this.refreshHud(); } }, n ? 0x2ee06a : 0x2a333a, n ? '#04220e' : '#777', 18));
      c.add(button(this, width / 2 + 150, y, 120, 46, `3→${icons[TRADES[p.good]]}`, () => { if (trade(p.good)) { sfx.coin(); track('market_trade', { good: p.good }); close(); this.market(); } }, n >= 3 ? 0x3f7bff : 0x2a333a, n >= 3 ? '#fff' : '#777', 18));
    });
    c.add(txt(this, width / 2, height / 2 + 190, `🐥 ×${save.farm.chicks || 0}`, 20, '#ffe58a'));
  }

  nest() {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 420, 300);
    const hs = hatchState();
    let msg = t('nestEmpty'), act = null;
    if (hs.ready) { msg = t('nestReady'); act = [`🐣 ${t('hatch')}`, () => { if (hatch()) { sfx.win?.(); track('egg_hatch', {}); close(); this.scene.restart(); } }]; }
    else if (hs.active) msg = `🥚 ${hs.done} / ${HATCH_WINS} ${t('nestWins')}`;
    else if ((inventory().egg || 0) > 0) act = [`🥚 ${t('incubate')}`, () => { if (incubate()) { track('egg_incubate', {}); close(); this.scene.restart(); } }];
    c.add(txt(this, width / 2, height / 2 - 90, '🪺', 56));
    c.add(txt(this, width / 2, height / 2 - 20, msg, 19, '#fff').setWordWrapWidth(360));
    if (act) c.add(button(this, width / 2, height / 2 + 70, 260, 58, act[0], act[1], 0x2ee06a, '#04220e', 22));
    else c.add(button(this, width / 2, height / 2 + 70, 200, 50, 'OK', close, 0x2a333a, '#fff', 20));
  }

  itemName(it) { return it.name[getLang()] || it.name.tr; }

  // F3: say hi to a wild visitor
  greetVisitor(v) {
    const a = this.w3.visitors.anchorOf(v), r = this.w3.visitors.greet(v), K = KINDS[v.kind];
    sfx.coin && sfx.coin();
    const msg = r.first ? `Yeni dost! ${K.emoji} ${K.name} albüme eklendi` : `Selamlaştın! ${K.emoji}`;
    const t1 = txt(this, a.x, a.y, msg, 18, '#fff').setDepth(960).setStroke('#3a2a00', 5);
    const t2 = txt(this, a.x, a.y + 26, r.coins ? `+🪙${r.coins}` : 'bugünlük ödül bitti', 16, r.coins ? '#ffe58a' : '#ddd').setDepth(960).setStroke('#3a2a00', 4);
    this.tweens.add({ targets: [t1, t2], y: '-=60', alpha: 0, delay: 700, duration: 1100, onComplete: () => { t1.destroy(); t2.destroy(); } });
    this.refreshHud();
  }

  // F2: petting -> jump + heart burst + small status card; second tap opens the modal
  petAnimal(id) {
    const w = this.w3, a = w.anchor(id, 0.3); w.poke(id); sfx.pet(); w.burst(id, 0xff7aa8, 10);
    if (a) for (let i = 0; i < 6; i++) {
      const h = txt(this, a.x, a.y, i % 3 ? '❤️' : '💕', 22 + (i % 3) * 4).setDepth(950);
      this.tweens.add({ targets: h, x: a.x + (Math.random() - 0.5) * 110, y: a.y - 60 - Math.random() * 70, alpha: 0, scale: 1.4, duration: 900 + i * 60, ease: 'Cubic.Out', onComplete: () => h.destroy() });
    }
    if (this._petId === id && Date.now() - this._petT < 2500) { this._petId = null; this.card && this.card.destroy(); return this.nameModal(id); }
    if (ftueDone('pet')) { this.drawHint(); this.toast('🎉 Rehber tamam! Çiftlik senin.'); }
    const lv0 = lovePet(id);
    if (lv0.reward) { sfx.coin && sfx.coin(); this.toast(`💞 Sevgi turu tamam! +🪙${lv0.reward.coins} +💎${lv0.reward.gems}`); this.refreshHud(); }
    else if (!loveState().done) this.toast(`💞 Sevgi turu ${lv0.n}/${LOVE_N}`);
    this._petId = id; this._petT = Date.now();
    this.card && this.card.destroy();
    if (!a) return;
    const it = item(id) || PETS[id], lv = LIVESTOCK.includes(id), sick = lv && isSick(id);
    const line = sick ? 'Hasta 🤒 — veteriner lazım' : lv ? ('Tokluk ' + hunger(id) + '% · mutlu 😊') : 'Mutlu 😊';
    const c = this.card = this.add.container(Math.max(120, Math.min(420, a.x)), Math.max(90, a.y - 90)).setDepth(960);
    c.add(this.add.rectangle(0, 0, 220, 58, 0xfff8e6, 0.96).setStrokeStyle(3, 0xffb71b));
    c.add(txt(this, 0, -12, it.emoji + ' ' + (nameOf(id) || (it.name && it.name.tr) || it.name || id), 17, '#3a2a00'));
    c.add(txt(this, 0, 12, line + ' · tekrar dokun', 12, sick ? '#a33' : '#556'));
    c.setScale(0.6); this.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.Out' });
    this.time.delayedCall(2500, () => { if (this.card === c) { c.destroy(); this.card = null; } });
  }

  // F7: named animal card; livestock/products still reachable through the main modal
  nameModal(id) {
    const it = item(id) || PETS[id], { width, height } = this.scale;
    const { c, close } = modal(this, 400, 300);
    c.add(txt(this, width / 2, height / 2 - 95, it.emoji, 60));
    c.add(txt(this, width / 2, height / 2 - 40, nameOf(id) || 'Adı yok', 28, '#ffb71b'));
    c.add(txt(this, width / 2, height / 2 - 8, (it.name && (it.name[getLang()] || it.name.tr)) || it.name, 16, '#ccc'));
    c.add(button(this, width / 2 - (PETS[id] ? 0 : 90), height / 2 + 50, 170, 50, '✏️ Ad ver', () => {
      const n = window.prompt('Adı ne olsun?', nameOf(id) || '');
      if (n !== null) { setName(id, n); close(); this.nameModal(id); }
    }, 0x2ee06a, '#04220e', 18));
    if (!PETS[id]) c.add(button(this, width / 2 + 90, height / 2 + 50, 170, 50, 'Detay ▶', () => { close(); this.itemModal(id); }, 0x2a333a, '#fff', 18));
    c.add(button(this, width / 2, height / 2 + 115, 120, 42, '✕', close, 0x2a333a, '#fff', 18));
  }

  itemModal(id) {
    if (isSickAnimal(id)) return this.vetModal(id);
    const it = item(id); const st = status(id);
    const { width, height } = this.scale;
    const { c, close } = modal(this, 420, 320);
    c.add(txt(this, width / 2, height / 2 - 110, it.emoji, 64));
    c.add(txt(this, width / 2, height / 2 - 55, this.itemName(it), 28, '#ffb71b'));
    let msg = '';
    if (st === 'owned') msg = t('farmOwned');
    else if (st === 'locked') msg = (save.level || 1) < (it.lvl || 1) || !it.needs ? `🔒 ${t('level')} ${it.lvl}` : `${t('farmNeeds')}: ${this.itemName(item(it.needs))}`;
    else msg = `⭐ ${it.price}  ·  ${t('farmHave')} ${starBalance()}`;
    c.add(txt(this, width / 2, height / 2 + 5, msg, 20, '#fff'));
    if (PERK_TEXT[id]) c.add(txt(this, width / 2, height / 2 - 18, `✨ ${PERK_TEXT[id][getLang()] || PERK_TEXT[id].tr}`, 16, '#9dffb8'));
    if (st === 'owned' && PRODUCTS[id]) {
      const pr = PRODUCTS[id];
      c.add(txt(this, width / 2, height / 2 + 140, `🏚️ ${ambarUsed()}/${ambarCap()}`, 15, ambarFull() ? '#ff9a9a' : '#9fb3a8'));
      if (isReady(id)) c.add(button(this, width / 2, height / 2 + 80, 260, 60, `${t('collect')} ${pr.emoji}`, () => {
        if (ambarFull()) { this.toast(t('ambarFull')); return; }
        if (collect(id)) { sfx.coin(); track('farm_collect', { item: id }); close(); this.scene.restart({ harvest: id }); }
      }, 0x2ee06a, '#04220e', 22));
      else {
        const left = txt(this, width / 2, height / 2 + 45, `${pr.emoji} ⏳ ${fmtMs(readyAt(id) - Date.now())}`, 22, '#ffe58a'); c.add(left);
        const tk = this.time.addEvent({ delay: 1000, loop: true, callback: () => { if (!c.active) return tk.remove(); left.setText(`${pr.emoji} ⏳ ${fmtMs(Math.max(0, readyAt(id) - Date.now()))}`); } });
        const done = () => { sfx.coin(); close(); this.scene.restart(); };
        c.add(button(this, width / 2 - 95, height / 2 + 110, 170, 50, `💎 ${rushCost(id)} ${t('rush')}`, () => { if (rush(id)) { track('farm_rush', { item: id, via: 'gems' }); done(); } }, save.gems >= rushCost(id) ? 0x8fe3ff : 0x2a333a, save.gems >= rushCost(id) ? '#06222e' : '#777', 18));
        c.add(button(this, width / 2 + 95, height / 2 + 110, 170, 50, `📺 ${t('rush')}`, async () => { if (await showRewarded('farm_rush') && rush(id, true)) { track('farm_rush', { item: id, via: 'ad' }); done(); } }, 0x3f7bff, '#fff', 18));
      }
      return;
    }
    if (st === 'owned' && it.kind === 'building') {
      const lv = bldLvl(id);
      c.add(txt(this, width / 2, height / 2 + 40, `${t('level')} ${lv}/${BLD_MAX}${id === 'ambar' ? `  ·  🏚️ ${ambarUsed()}/${ambarCap()}` : ''}`, 18, '#ffe58a'));
      if (lv < BLD_MAX) {
        const ok = (save.coins || 0) >= upgradeCost(id);
        c.add(button(this, width / 2, height / 2 + 100, 280, 56, `⬆ ${t('upgrade')} 🪙 ${upgradeCost(id)}`, () => {
          if (!upgrade(id)) { this.toast(t('needCoins')); return; }
          sfx.build(); track('farm_upgrade', { item: id, lv: lv + 1 }); close(); this.scene.restart();
        }, ok ? 0x2ee06a : 0x2a333a, ok ? '#04220e' : '#888', 20));
      }
      return;
    }
    if (st === 'buyable') {
      c.add(button(this, width / 2, height / 2 + 75, 260, 60, `${t('farmBuy')} ⭐ ${it.price}`, () => {
        if (buyItem(id)) { if (id === 'kumes') ftueDone('coop'); sfx.build(); track('farm_buy', { item: id, price: it.price }); close(); this.scene.restart({ dlg: id }); }
      }, 0x2ee06a, '#04220e', 22));
    } else if (st === 'expensive') {
      c.add(txt(this, width / 2, height / 2 + 45, t('farmEarn'), 17, '#9fb3a8'));
      c.add(button(this, width / 2, height / 2 + 100, 260, 56, `${t('play')} ▶`, () => { close(); this.playBtn.emit('pointerup'); }, 0x2ee06a, '#04220e', 22));
    } else c.add(button(this, width / 2, height / 2 + 90, 200, 50, 'OK', close, 0x2a333a, '#fff', 20));
  }

  // ---- F12: Mağaza (sekmeli), F15: bölüm kilitleri ----
  shop(tab = 'building') {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 500, 760);
    markSeen(CATALOG.filter((i) => status(i.id) !== 'locked' || (save.level || 1) >= (i.lvl || 1)).map((i) => i.id));
    const top = height / 2 - 380;
    c.add(txt(this, width / 2, top + 40, `🏪 ${t('shop')}  ·  ⭐ ${starBalance()}`, 26, '#ffb71b'));
    [...TABS, ['land', '🗺️']].forEach(([k, e], i) => c.add(button(this, width / 2 - 180 + i * 90, top + 100, 82, 50, e, () => { close(); this.shop(k); }, k === tab ? 0xffb71b : 0x2a333a, k === tab ? '#1a1200' : '#fff', 26)));
    if (tab === 'land') {
      const n = land(), ls = landStatus(), y = top + 220;
      c.add(txt(this, width / 2, y, `🗺️ ${t('land')} ${n}/${LAND_MAX}`, 24, '#fff'));
      c.add(txt(this, width / 2, y + 40, t('landHint'), 15, '#9fb3a8'));
      if (ls === 'max') c.add(txt(this, width / 2, y + 110, '✅ MAX', 26, '#9dffb8'));
      else if (ls === 'level') c.add(txt(this, width / 2, y + 110, `🔒 ${t('level')} ${landLvl()}`, 22, '#ff9a9a'));
      else c.add(button(this, width / 2, y + 110, 300, 60, `${t('expand')} 🪙 ${landCost()}`, () => {
        if (!buyLand()) { this.toast(t('needCoins')); return; }
        sfx.build(); track('farm_land', { n: n + 1 }); close(); this.scene.restart();
      }, ls === 'ok' ? 0x2ee06a : 0x2a333a, ls === 'ok' ? '#04220e' : '#888', 22));
      return;
    }
    CATALOG.filter((i) => i.kind === tab).forEach((it, i) => {
      const y = top + 175 + i * 84, st = status(it.id);
      c.add(this.add.rectangle(width / 2, y, 450, 74, 0x000000, 0.25).setStrokeStyle(2, 0xffffff, 0.12));
      c.add(txt(this, width / 2 - 185, y, it.emoji, 38));
      c.add(txt(this, width / 2 - 145, y - 12, this.itemName(it), 20, '#fff').setOrigin(0, 0.5));
      let sub = '';
      if (st === 'locked') sub = (save.level || 1) < (it.lvl || 1) ? `🔒 ${t('level')} ${it.lvl}` : `🔒 ${t('farmNeeds')}: ${this.itemName(item(it.needs))}`;
      else if (PERK_TEXT[it.id]) sub = PERK_TEXT[it.id][getLang()] || PERK_TEXT[it.id].tr;
      c.add(txt(this, width / 2 - 145, y + 14, sub, 13, st === 'locked' ? '#ff9a9a' : '#9dffb8').setOrigin(0, 0.5));
      if (st === 'owned') c.add(txt(this, width / 2 + 170, y, '✅', 30));
      else if (st !== 'locked') c.add(button(this, width / 2 + 160, y, 110, 50, it.price ? `⭐ ${it.price}` : t('free'), () => {
        if (st !== 'buyable') { this.toast(t('farmEarn')); return; }
        if (!buyItem(it.id)) return;
        if (it.id === 'kumes') ftueDone('coop');
        sfx.build(); track('farm_buy', { item: it.id, price: it.price }); close();
        if (MOVABLE(it.id)) this.placeStart(it.id, false); else this.scene.restart({ dlg: it.id });
      }, st === 'buyable' ? 0x2ee06a : 0x2a333a, st === 'buyable' ? '#04220e' : '#888', 20));
    });
  }

  // ---- F13: taşıma / yerleştirme ----
  toggleEdit() {
    this.editing = !this.editing;
    if (this.editBanner) this.editBanner.destroy();
    this.editBanner = this.editing ? this.banner(`✋ ${t('editHint')}`, [[`✔ ${t('done')}`, () => this.toggleEdit()]]) : null;
  }
  banner(msg, btns) {
    const { width } = this.scale, c = this.add.container(0, 0).setDepth(900);
    c.add(this.add.rectangle(width / 2, 150, width, 110, 0x0a0f0d, 0.9));
    c.add(txt(this, width / 2, 125, msg, 18, '#ffe58a'));
    btns.forEach(([l, f, col], i) => c.add(button(this, width / 2 + (i - (btns.length - 1) / 2) * 170, 172, 150, 44, l, f, col || 0x2ee06a, '#04220e', 18)));
    return c;
  }
  placeStart(id, moving) {
    const w = this.w3; if (this.editBanner) { this.editBanner.destroy(); this.editBanner = null; } this.editing = false;
    let p = w.where(id).map((v) => Math.round(v * 2) / 2);
    if (!this.placeValid(id, p)) search: for (let r = 1; r < 12; r++) for (let a = 0; a < 16; a++) {
      const q = [Math.round((p[0] + r * Math.cos(a * Math.PI / 8)) * 2) / 2, Math.round((p[1] + r * Math.sin(a * Math.PI / 8)) * 2) / 2];
      if (this.placeValid(id, q)) { p = q; break search; }
    }
    this.placing = { id, moving, p };
    if (this.nodes[id]) this.nodes[id].setVisible(false);
    this.placeBanner = this.banner(`📍 ${t('placeHint')}`, [
      [`✔ ${t('place')}`, () => this.placeOk()],
      [`✕`, () => { const d = this.placing; this.placing = null; w.tmpPos = null; this.scene.restart(d.moving ? {} : { dlg: d.id }); }, 0x2a333a],
    ]);
    this.placeShow();
  }
  placeShow() {
    const { id, p } = this.placing, w = this.w3;
    w.tmpPos = { id, p }; this.placing.bad = !this.placeValid(id, p);
    w.setItem(id, 'place', { bad: this.placing.bad });
  }
  placeTap(pt) {
    const g = this.w3.groundAt(pt.x, pt.y); if (!g) return;
    this.placing.p = g.map((v) => Math.round(v * 2) / 2); this.placeShow();
  }
  placeValid(id, [x, z]) {
    const e = 10 + 2 * land(), rad = (k) => (LAYOUT[k].plot ? 1.5 : k === 'traktor' ? 1.1 : 2.1);
    if (Math.abs(x) > e || Math.abs(z) > e - 2) return false;
    if (Math.hypot(x, z) < 1.2 + rad(id) * 0.4) return false;          // çeşme
    if (x > 4.5 && z < -5) return false;                               // göl
    if (land() === 0 && x < -6.5 && Math.abs(z + 0.5) < 2.5) return false; // değirmen
    for (const k of [...CATALOG.map((i) => i.id), 'market']) {
      if (k === id || !LAYOUT[k] || !(k === 'market' || (owns(k) && MOVABLE(k)))) continue;
      const q = this.w3.where(k); if (Math.hypot(q[0] - x, q[1] - z) < (rad(k) + rad(id)) * 0.8) return false;
    }
    return true;
  }
  placeOk() {
    const d = this.placing; if (!d) return;
    if (d.bad) { this.toast(`⛔ ${t('placeBad')}`); sfx.click(); return; }
    setPos(d.id, d.p[0], d.p[1]); sfx.build(); track('farm_place', { item: d.id, moved: !!d.moving });
    this.placing = null; this.w3.tmpPos = null; this.scene.restart(d.moving ? {} : { dlg: d.id });
  }

  bookCount() {
    const all = CATALOG.length + SEASONS.length + Object.keys(KINDS).length, al = save.farm.album || {};
    return `${CATALOG.filter((i) => owns(i.id)).length + decor().length + Object.keys(KINDS).filter((k) => al[k]).length}/${all}`;
  }

  // Faz 6: collection book - every farm item and seasonal decor, owned or silhouette
  book(page = 'farm') {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 480, 680);
    const al = save.farm.album || {};
    const pages = {
      farm: CATALOG.map((i) => ({ emoji: i.emoji, have: owns(i.id), name: nameOf(i.id) || this.itemName(i) })),
      season: SEASONS.map((s) => ({ emoji: s.emoji, have: decor().includes(s.id), name: s[getLang()] || s.tr })),
      visitors: Object.entries(KINDS).map(([k, K]) => ({ emoji: K.emoji, have: !!al[k], name: al[k] ? `${K.name} ×${al[k]}` : K.name })),
    };
    c.add(txt(this, width / 2, height / 2 - 300, `📖 ${t('book')} ${this.bookCount()}`, 28, '#ffb71b'));
    ['farm', 'season', 'visitors'].forEach((p, i) => c.add(button(this, width / 2 - 145 + i * 145, height / 2 - 250, 136, 40,
      { farm: '🏡 Çiftlik', season: '🎃 Sezon', visitors: '🦊 Ziyaretçi' }[p], () => { close(); this.book(p); }, p === page ? 0xffb71b : 0x2a333a, p === page ? '#1a1200' : '#fff', 15)));
    const list = pages[page], full = list.every((x) => x.have);
    list.forEach((it, k) => {
      const x = width / 2 - 165 + (k % 4) * 110, y = height / 2 - 175 + Math.floor(k / 4) * 96;
      c.add(this.add.rectangle(x, y, 96, 86, it.have ? 0x2ee06a : 0x2a333a, it.have ? 0.25 : 0.8));
      c.add(txt(this, x, y - 10, it.have ? it.emoji : '❔', 34));
      c.add(txt(this, x, y + 28, it.have ? it.name : '???', 12, '#fff'));
    });
    const have = list.filter((x) => x.have).length, ry = height / 2 + 250;
    if (pageClaimed(page)) c.add(txt(this, width / 2, ry, '✅ Sayfa ödülü alındı', 18, '#9dffb8'));
    else if (full) c.add(button(this, width / 2, ry, 240, 48, `Sayfa tamam! 💎${PAGE_REWARD[page]}`, () => {
      if (claimPage(page, true)) { sfx.coin && sfx.coin(); this.refreshHud(); close(); this.book(page); }
    }, 0x2ee06a, '#04220e', 18));
    else c.add(txt(this, width / 2, ry, `${have}/${list.length} · tamamla → 💎${PAGE_REWARD[page]}`, 18, '#ffe58a'));
    if (page === 'farm' && save.farm.chicks) c.add(txt(this, width / 2, ry - 40, `🐤 × ${save.farm.chicks}`, 20, '#ffe58a'));
    c.add(button(this, width / 2, height / 2 + 305, 140, 44, '✕', close, 0x2a333a, '#fff'));
  }

  seasonal() {
    const { width, height } = this.scale;
    const s = currentSeason();
    const { c, close } = modal(this, 420, 300);
    c.add(txt(this, width / 2, height / 2 - 90, s.emoji, 64));
    c.add(txt(this, width / 2, height / 2 - 30, s[getLang()] || s.tr, 26, '#ffb71b'));
    c.add(txt(this, width / 2, height / 2 + 10, t('seasonOnly'), 17, '#9fb3a8'));
    c.add(button(this, width / 2, height / 2 + 80, 240, 56, `💎 ${s.price}`, () => {
      if (buySeasonal()) { sfx.coin(); track('farm_season', { item: s.id }); close(); this.scene.restart(); }
      else { close(); this.scene.start('Map', { shop: true }); }
    }, 0x8fe3ff, '#06222e', 22));
  }

  // F8: current guide step as a bouncing banner (+ finger on the play sign)
  drawHint() {
    this.hint && this.hint.destroy(); this.hint = null;
    const cur = ftueCurrent(); if (!cur) return;
    const { width, height } = this.scale;
    const c = this.hint = this.add.container(width / 2, height - 150).setDepth(40);
    const tx = txt(this, 0, 0, cur.text, 18, '#1a1200');
    c.add([this.add.rectangle(0, 0, tx.width + 36, 44, 0xffe58a).setStrokeStyle(3, 0x3a2a10), tx]);
    this.tweens.add({ targets: c, y: c.y - 8, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.InOut' });
    if (cur.id === 'play') {
      const f = txt(this, 150, 70, '👇', 36); c.add(f);
      this.tweens.add({ targets: f, y: 80, yoyo: true, repeat: -1, duration: 350 });
    }
  }

  // F8: session greeting = daily streak reward, then "while you were away"
  greet() {
    const away = awaySummary();
    const next = () => { if (away && away.lines.length) this.dialog([['🌙', { tr: `Sen yokken (${away.away}): ${away.lines.slice(0, 4).join(', ')}` }]]); };
    const d = farmDaily(); if (!d.available) return next();
    const { width, height } = this.scale;
    const { c, close } = modal(this, 440, 340);
    c.add(txt(this, width / 2, height / 2 - 120, `🎁 ${t('daily')}`, 30, '#ffb71b'));
    c.add(txt(this, width / 2, height / 2 - 70, `🔥 ${d.streak + 1}. gün serisi`, 20, '#fff'));
    for (let i = 0; i < 7; i++) {
      const x = width / 2 - 180 + i * 60, on = i <= d.streak % 7;
      c.add([this.add.rectangle(x, height / 2 - 10, 50, 56, on ? 0xffb71b : 0x2a333a), txt(this, x, height / 2 - 10, i === 6 ? '💎' : `${i + 1}`, 18, on ? '#1a1200' : '#9fb3a8')]);
    }
    c.add(button(this, width / 2, height / 2 + 100, 220, 60, `${t('claim')} 🪙${d.reward}`, () => {
      const r = farmClaimDaily(); if (r) { sfx.coin && sfx.coin(); track('daily_claim', { streak: r.streak, reward: r.coins, src: 'farm' }); this.toast(`+🪙${r.coins}${r.gems ? ' +💎1' : ''}`); }
      this.refreshHud(); close(); next();
    }, 0x2ee06a, '#04220e', 22));
  }

  refreshHud() {
    tickLives();
    this.livesTxt.setText(`${save.lives} / ${CONFIG.lives.max}`);
    const ms = msToNextLife();
    this.lifeTimer.setText(ms ? `${t('nextLife')} ${fmtMs(ms)}` : t('full'));
    this.coinsTxt.setText(String(save.coins));
    this.gemsTxt.setText(`💎 ${save.gems}`);
    this.starsTxt.setText(`⭐ ${starBalance()}`);
    if (this.nodes) this.tickCrops();
  }

  tryStart(lv) {
    tickLives();
    if (save.lives <= 0) { this.scene.start('Map', { livesModal: true }); return; }
    this.preLevel(lv);
  }
}
Object.assign(Farm.prototype, RegionMixin, BridgeMixin);
