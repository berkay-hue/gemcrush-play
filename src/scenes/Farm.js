// Farm hub (Faz 1): the home screen. Stars earned in match-3 buy buildings,
// animals and fields. The OYNA sign starts the next level.
import { CONFIG } from '../config.js';
import { save, tickLives, msToNextLife, starBalance } from '../meta/save.js';
import { SEASONS, currentSeason, decor, buySeasonal } from '../meta/season.js';
import { MEVSIM, ORDER, mevsim, nextMevsim, daysLeft, inSeason, SPEED } from '../meta/mevsim.js';
import { showRewarded } from '../monetize/ads.js';
import { Visitors, KINDS } from '../farm3d/visitors.js';
import { isSick, hunger, LIVESTOCK } from '../meta/animals.js';
import { CATALOG, TABS, item, status, buyItem, owns, PERK_TEXT, newUnlocks, markSeen, posOf, setPos, ARSA, arsa, ownsPlot, plotStatus, buyPlot, inPlot, ANIMAL_MAX, animalCount, moreStatus, buyMore, BLD_MAX, bldLvl, upgradeCost, upgrade, ambarCap } from '../meta/farm.js';
import { PRODUCTS, TRADES, GOODS, RECIPES, canCraft, craft, HATCH_WINS, isReady, readyAt, collect, inventory, sell, trade, hatchState, incubate, hatch, rush, rushCost, ambarUsed, ambarFull } from '../meta/produce.js';
import { currentQuest, questDone, claimQuest, takeDialog } from '../meta/quests.js';
import { claimWater } from '../meta/link.js';
import { t, getLang } from '../i18n.js';
import { SLOTS, refreshOrders, canDeliver, deliver, skip, readyCount, xpProgress } from '../meta/orders.js';
import { energy, E_MAX } from '../meta/energy.js';
import { track } from '../analytics.js';
import { sfx } from '../sound.js';
import { CineMixin } from './farmCine.js';
import { txt, button, modal, fmtMs, card, iconSlot, chip, goldText, iconLabel, ribbon, shine, awning, signBoard } from '../ui/widgets.js';
import { dailyDeal, owns as wOwns, locked as wLocked, buy as wBuy, wear as wWear, look as wLook } from '../meta/wardrobe.js';
import { buildIcons } from '../ui/icons.js';
import { flyCoins, countUp, haptic } from '../ui/juice.js';
import { farmTitle, renameBox, nameBox } from '../ui/farmTitle.js';
import { friendsPanel } from '../ui/friends.js';
import { tasksPanel } from '../ui/tasks.js';
import { tasksBadge } from '../meta/tasks.js';
import { festActive, festMsLeft, festivalLevels, festDone, festNext, FEST_N, FEST_COINS, FEST_ALL_GEMS } from '../meta/event.js';
import { TIERS, XP_TIER, pass, tierOf, claimable, claim, reward, rewardIcon, seasonMsLeft } from '../meta/pass.js';
import { friendFarm, account, inbox } from '../meta/save.js';
import { NORMAL_SEEDS } from '../meta/crops.js';
import { rareOwned, rareCount, RARE_PITY } from '../meta/rare.js';
import { CROPS, SEEDS, seedOf, cropInfo, seedOpen, WIN_CUT, cropState, growth, msLeft, plant, harvest, cropRush, cropRushCost, autoHarvest, cropMs, seedPrice, plotLvl, plotUpgradeCost, upgradePlot, cropYield } from '../meta/crops.js';
import { CHAIN, state as chainState, msLeft as chainLeft, progress as chainProg, missing as chainMissing, canStart as chainCan, start as chainStart, collectChain } from '../meta/chain.js';
import { LAYERS, layerStatus, buyLayer, hasLayer, layerSig } from '../meta/layers.js';
import { HAVA, hava, forecast, havaTick, msToNextSlot } from '../meta/hava.js';
import { comboOf, beeNear, neighbors, flowersNearHive, COMBO_STEP } from '../meta/combo.js';
import { PESTS, SCARE, pestAt, shoo, scareStatus, buyScarecrow, hasScarecrow, pestSig } from '../meta/pests.js';
import { buildFarmArt, spawnChickens } from '../farmArt.js';
import { getWorld, LAYOUT } from '../farm3d/FarmWorld.js';
import { RegionMixin } from './farmRegions.js';
import { THEMES, currentTheme, ownsTheme, buyTheme, setTheme } from '../meta/themes.js';
import { BridgeMixin, isSickAnimal } from './farmBridge.js';
import { HandsMixin } from './farmHands.js';
import { LambMixin } from './farmLamb.js';
import { GuideMixin, guideSeen } from './farmGuide.js';
import { WardrobeMixin } from './farmWardrobe.js';
import { look } from '../meta/wardrobe.js';
import { ftueCurrent, ftueDone, farmDaily, farmClaimDaily, awaySummary } from '../meta/onboard.js';
import { PETS, petsOpen, nameOf, setName, lovePet, loveState, LOVE_N, claimPage, pageClaimed, PAGE_REWARD } from '../meta/bond.js';

const PLOT_W = 2.1, PLOT_D = 1.9; // F22: tarla ayak izi (2 sıra toprak) — komşu tarla bu kadar ötede
const ISL_HW = 11, ISL_HD = 9; // ana ada (FarmWorld ISL 12×10, kenar payı)
const MOVABLE = (id) => id !== 'degirmen' && ['building', 'plot', 'vehicle'].includes((item(id) || {}).kind);

export class Farm extends Phaser.Scene {
  constructor() { super('Farm'); }

  create(data = {}) {
    this._data = data;
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
    // F8: sade üst bar — koyu şerit yok; sahneye yedirilmiş yarı saydam haplar + "<isim>'ın Çiftliği"
    buildIcons(this);
    this.hud = this.add.container(0, 0).setDepth(5);
    const chip = (x, y, w, h) => { const g = this.add.graphics(); g.fillStyle(0x0f1f17, 0.38).fillRoundedRect(x, y, w, h, h / 2); g.lineStyle(1, 0xf5f4eb, 0.18).strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, h / 2); this.hud.add(g); };
    const soft = (o) => o.setShadow(0, 1, 'rgba(10,15,13,0.55)', 3, false, true);
    chip(12, 14, 132, 40); chip(width - 144, 14, 132, 40); chip(width - 144, 58, 132, 30);
    const heart = this.add.image(36, 34, 'ic-heart').setDisplaySize(28, 28);
    this.livesTxt = soft(txt(this, 58, 34, '', 19, '#f5f4eb').setOrigin(0, 0.5));
    this.lifeTimer = soft(txt(this, 134, 35, '', 13, '#f5f4eb').setOrigin(1, 0.5).setAlpha(0.75));
    const coin = this.add.image(width - 120, 34, 'ic-coin').setDisplaySize(28, 28);
    this.coinsTxt = goldText(this, width - 100, 34, '', 20).setOrigin(0, 0.5);
    this.gemsTxt = iconLabel(this, width - 134, 73, '💎 0', 15, { gold: false, color: '#dff6ff' });
    this.titleTxt = txt(this, width / 2, 28, '', 21, '#f5f4eb').setAlpha(0.92).setShadow(0, 2, 'rgba(10,15,13,0.6)', 6, false, true);
    this.titleTxt.setInteractive({ useHandCursor: true }).on('pointerup', () => renameBox((ok) => { if (ok) { this.drawTitle(); this.w3 && this.w3.setSignText && this.w3.setSignText(farmTitle()); this.toast(`✏️ ${this.titleTxt.text}`); } }));
    this.starsTxt = iconLabel(this, width / 2 - 8, 55, '⭐ 0', 15, { align: 'right' });
    this.hud.add([heart, this.livesTxt, this.lifeTimer, coin, this.coinsTxt, this.gemsTxt, this.titleTxt, this.starsTxt]);
    this.drawTitle();
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

    this.energyTxt = iconLabel(this, width / 2 + 8, 55, `⚡${energy()}/${E_MAX}`, 15);
    this.hud.add(this.energyTxt);
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
    this.events.once('shutdown', () => this.events.off('update', this.fingerFollow, this));
    this.drawHint();
    const cine = !Farm._cine; if (cine) { Farm._cine = true; this.opening(); }
    if (!Farm._greeted) { Farm._greeted = true; this.time.delayedCall(cine ? 3000 : 700, () => this.greet()); }
    button(this, 50, 230, 80, 40, `📖 ${this.bookCount()}`, () => this.book(), 0x2a333a, '#fff', 16);
    button(this, width - 50, 280, 80, 40, `👥`, () => this.friends(), 0x2a333a, '#fff', 20);
    this.inboxBadge(width - 16, 264);
    this.waterClaim();
    button(this, width - 50, 330, 80, 40, '📜', () => this.tasks(), 0x2a333a, '#fff', 20);
    button(this, width - 50, 380, 80, 40, '📸', () => this.snap(), 0x2a333a, '#fff', 20);
    button(this, width - 50, 430, 80, 40, '❓', () => this.guide(0), 0x2a333a, '#fff', 20); // F25: kuzu rehberi
    button(this, width - 50, 480, 80, 40, '👕', () => this.wardrobe(), 0x2a333a, '#fff', 20); // F27: kuzu gardırobu
    this.w3 && this.w3.mascotDress && this.w3.mascotDress(look());
    this.taskBadge(width - 16, 314);
    this.ordBtn = button(this, 50, 280, 80, 40, '📋', () => this.orders(), 0x2a333a, '#fff', 18);
    button(this, 50, 330, 80, 40, '🌾', () => this.festival(), festActive() ? 0xc9761b : 0x2a333a, '#fff', 20);
    this.festBadge(86, 314);
    button(this, 50, 380, 80, 40, '🎟️', () => this.seasonPass(), 0x2a333a, '#fff', 20);
    this.passBadge(86, 364);
    button(this, 50, 430, 80, 40, mevsim().emoji, () => this.seasonModal(), 0x2a333a, '#fff', 20); // F31: mevsimler
    this.havaBtn = button(this, 50, 480, 80, 40, hava().emoji, () => this.havaModal(), 0x2a333a, '#fff', 20); // F35: hava kartları
    // Faz 6: harvest animation - product flies from the animal to the market basket
    if (data.harvest && this.nodes[data.harvest] && PRODUCTS[data.harvest]) {
      const n = this.nodes[data.harvest];
      for (let i = 0; i < 3; i++) {
        const f = txt(this, n.x, n.y - 30, PRODUCTS[data.harvest].emoji, 34);
        this.tweens.add({ targets: f, x: width - 50, y: 180, scale: 0.5, alpha: 0.2, delay: i * 120, duration: 700, ease: 'Cubic.In', onComplete: () => f.destroy() });
      }
    }
    if (data.dlg) { const d = takeDialog(data.dlg); if (d) this.dialog(d); }
    else if (!guideSeen()) this.time.delayedCall(900, () => this.guide(0)); // F25: ilk girişte rehber

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
    const ripeEmoji = seedOf(it.id) !== 'corn' && stage === 3;
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
      const x = -48 + k * 32 + (r ? 12 : 0), y = -8 + r * 26;
      const p = ripeEmoji ? txt(this, x, y + 12, cropInfo(it.id).emoji, 26) : this.add.image(x, y, `corn${stage}`).setOrigin(0.5, 0.85).setScale(0.8);
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
    w.show(); w.posOf = posOf; w.tmpPos = null; if (w.chainBelt) w.chainBelt(owns('degirmen') && owns('firin')); w.setPlots(ARSA.map((a) => ({ ...a, owned: ownsPlot(a.id) }))); w.setTheme(currentTheme()); w.setSeason && w.setSeason(mevsim());
    if (!w.visitors) w.visitors = new Visitors(w);
    this.events.once('shutdown', () => w.hide());
    // drag = pan, pinch/wheel = zoom, short tap = raycast pick
    const pad = this.add.zone(0, 0, this.scale.width, this.scale.height).setOrigin(0).setInteractive().setDepth(-10);
    let down = null, pinch = 0;
    pad.on('pointerdown', (p) => {
      down = { x: p.x, y: p.y, lx: p.x, ly: p.y, t: Date.now(), moved: false };
      // F22: yerleştirirken nesnenin üstüne basıp sürükle (kamera kaymaz)
      if (this.placing) { const g = w.groundAt(p.x, p.y), q = this.placing.p; if (g && Math.hypot(g[0] - q[0], g[1] - q[1]) < 2.4) down.drag = [q[0] - g[0], q[1] - g[1]]; }
      else this.harvestStart(p, down);
    });
    this.input.on('pointermove', (p) => {
      const a = this.input.pointer1, b = this.input.pointer2;
      if (a && b && a.isDown && b.isDown) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) w.zoomBy(pinch / d); pinch = d; if (down) down.moved = true; return;
      }
      pinch = 0;
      if (!down || !p.isDown || this.bucketDrag) return;
      if (down.harvest) { this.harvestAt(p, down); down.moved = true; return; }
      if (down.drag && this.placing) { const g = w.groundAt(p.x, p.y); if (g) { this.placing.p = this.placeSnap(this.placing.id, [g[0] + down.drag[0], g[1] + down.drag[1]]); this.placeShow(); } down.moved = true; return; }
      w.pan(p.x - down.lx, p.y - down.ly); down.lx = p.x; down.ly = p.y;
      if (Math.hypot(p.x - down.x, p.y - down.y) > 12) down.moved = true;
    });
    pad.on('pointerup', (p) => {
      if (down && down.harvest) { this.harvestEnd(down); down = null; pinch = 0; return; }
      if (down && !down.moved && Date.now() - down.t < 500 && this.placing) this.placeTap(p);
      else if (down && !down.moved && Date.now() - down.t < 500 && this.editing) { const id = w.pick(p.x, p.y); if (id && MOVABLE(id)) this.placeStart(id, true); }
      else if (down && !down.moved && Date.now() - down.t < 500 && this.signHit(p)) this.signTap();
      else if (down && !down.moved && Date.now() - down.t < 500 && !this.plotSignTap(p)) {
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
    this.input.on('pointerupoutside', () => { if (down && down.harvest) this.harvestEnd(down); down = null; });
    this.setupHands();
    // F16c/F20: maskot kuzu 3D (FarmWorld.mascot); dokunma + konuşma balonu farmLamb.js'de
    this.setupLamb(this._data || {});

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
    this.w3.setItem(it.id, st === 'owned' ? 'owned' : 'ghost', it.kind === 'plot' ? { crop: st === 'owned' ? cropState(it.id) : '', seed: seedOf(it.id), growth: st === 'owned' ? growth(it.id) : 0, layers: layerSig(it.id) + (st === 'owned' ? pestSig(it.id) : '') } : { sick, n: it.kind === 'animal' ? animalCount(it.id) : 0 });
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
      // F30: değirmen/fırın rozeti — hazırsa çıktı zıplar, çalışıyorsa ⏳
      if (CHAIN[it.id]) {
        const cs = chainState(it.id);
        if (cs === 'ready') { const b = txt(this, 0, -34, GOODS[CHAIN[it.id].out].emoji, 30); c.add(b); this.tweens.add({ targets: b, y: -46, yoyo: true, repeat: -1, duration: 450 }); }
        else if (cs === 'busy') { const b = txt(this, 0, -30, '⏳', 22); c.add(b); this.tweens.add({ targets: b, angle: 180, repeat: -1, duration: 1400, repeatDelay: 400 }); }
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
    this.w3.setItem(it.id, 'owned', { crop: st, seed: seedOf(it.id), growth: st === 'growing' ? growth(it.id) : 0, layers: layerSig(it.id) + pestSig(it.id) });
    { const L = LAYERS.filter((l) => hasLayer(it.id, l.id)).map((l) => l.emoji).join('') + (hasScarecrow(it.id) ? SCARE.emoji : '') + (st !== 'empty' && comboOf(it.id) ? '🔗' + comboOf(it.id) : '') + (beeNear(it.id) ? '🐝' : ''); if (L) g.add(txt(this, 0, st === 'growing' ? -22 : -34, L, 14)); }
    // F32: zararlı rozeti — sallanır, dokununca kovulur
    c.pest = pestAt(it.id);
    if (c.pest) { const pb = txt(this, 34, st === 'growing' ? -26 : -40, PESTS[c.pest].emoji + '❗', 24).setStroke('#000', 3); g.add(pb); this.tweens.add({ targets: pb, angle: { from: -12, to: 12 }, y: pb.y - 5, yoyo: true, repeat: -1, duration: 260 }); }
    if (st === 'empty') g.add(txt(this, 0, 0, `＋ ${t('plant')}`, 16, '#fff2d6').setStroke('#3a2a10', 4));
    else if (st === 'growing') {
      g.add(this.add.rectangle(0, 0, 84, 12, 0x0a0f0d, 0.8).setStrokeStyle(2, 0xffffff, 0.6));
      c.bar = this.add.rectangle(-40, 0, 80 * growth(it.id), 8, 0x2ee06a).setOrigin(0, 0.5); g.add(c.bar);
      c.left = txt(this, 0, 16, fmtMs(msLeft(it.id)), 13, '#ffffff').setStroke('#000', 3); g.add(c.left);
    } else {
      const b = txt(this, 0, -6, `✨${cropInfo(it.id).emoji}`, 26); g.add(b);
      this.tweens.add({ targets: b, scale: 1.25, yoyo: true, repeat: -1, duration: 500 });
    }
    c.cropState = st; c.cropStage = st === 'ready' ? 3 : Math.min(2, Math.floor(growth(it.id) * 3));
  }

  plotTap(id) {
    const it = item(id); const c = this.nodes[id]; const st = cropState(id);
    if (st === 'empty') return this.seedPicker(id);
    if (pestAt(id)) return this.shooPest(id);
    if (st === 'ready') {
      this.harvestPlot(id);
      return;
    }
    // growing: info + rush + go play to speed up
    const { width, height } = this.scale; const { c: m, close } = modal(this, 440, 430);
    m.add(txt(this, width / 2, height / 2 - 125, cropInfo(id).emoji, 60));
    m.add(txt(this, width / 2, height / 2 - 70, `${this.itemName(it)} · ${cropInfo(id).name[getLang()] || cropInfo(id).name.tr}`, 26, '#ffb71b'));
    const left = txt(this, width / 2, height / 2 - 30, `⏳ ${fmtMs(msLeft(id))}`, 26, '#ffe58a'); m.add(left);
    const tk = this.time.addEvent({ delay: 1000, loop: true, callback: () => { if (!m.active) return tk.remove(); left.setText(`⏳ ${fmtMs(msLeft(id))}`); } });
    m.add(txt(this, width / 2, height / 2 + 2, `${t('cropTip')}  ·  ${t('level')} ${plotLvl(id)}`, 17, '#9dffb8'));
    { const en = getLang() === 'en', cb = comboOf(id), bz = beeNear(id), bits = [cb ? `🔗×${cb} +%${Math.round(cb * COMBO_STEP * 100)} ${en ? 'coins' : 'para'}` : '', bz ? `🐝 ${en ? '15% faster' : '%15 hızlı'}` : ''].filter(Boolean);
      m.add(txt(this, width / 2, height / 2 + 24, bits.length ? bits.join('  ·  ') : (en ? '🔗 Same seed side by side = +10% each' : '🔗 Aynı tohumu yan yana ek = komşu başına +%10'), 14, bits.length ? '#ffd45a' : '#9fb3a8')); }
    m.add(button(this, width / 2, height / 2 + 60, 300, 56, `▶ ${t('play')} (−5 ${t('minShort')})`, () => { close(); this.playBtn.emit('pointerup'); }, 0x2ee06a, '#04220e', 20));
    const cost = cropRushCost(id), ok = save.gems >= cost;
    const done = () => { sfx.coin(); close(); this.drawCrop(c, it); };
    m.add(button(this, width / 2 - 100, height / 2 + 125, 180, 48, `💎 ${cost} ${t('rush')}`, () => { if (cropRush(id)) { track('crop_rush', { plot: id, via: 'gems' }); done(); } }, ok ? 0x8fe3ff : 0x2a333a, ok ? '#06222e' : '#777', 17));
    m.add(button(this, width / 2 + 100, height / 2 + 125, 180, 48, `📺 ${t('rush')}`, async () => { if (await showRewarded('crop_rush') && cropRush(id, true)) { track('crop_rush', { plot: id, via: 'ad' }); done(); } }, 0x3f7bff, '#fff', 17));
    m.add(button(this, width / 2, height / 2 + 180, 300, 44, `🧱 ${getLang() === 'en' ? 'Field layers' : 'Tarla katmanları'}`, () => { close(); this.layersModal(id); }, 0xc98a3e, '#2a1604', 17));
  }
  // F23: boş tarlaya dokununca tohum seç — 3×3 kart; kilitli tohum seviyesini, fiyatlı tohum parasını gösterir
  seedPicker(id) {
    const it = item(id), c = this.nodes[id], en = getLang() === 'en';
    const { width, height } = this.scale; const { c: m, close } = modal(this, 500, 690);
    m.add(txt(this, width / 2, height / 2 - 235, en ? '🌱 Choose a seed' : '🌱 Tohum seç', 30, '#ffb71b'));
    m.add(txt(this, width / 2, height / 2 - 200, this.itemName(it), 17, '#cfe8d8'));
    const keys = NORMAL_SEEDS.slice().sort((a, b) => SEEDS[a].lvl - SEEDS[b].lvl || SEEDS[a].ms - SEEDS[b].ms), last = seedOf(id);
    const go = (k) => {
      if (!plant(id, Date.now(), k)) { this.toast(en ? 'Not enough coins' : 'Yeterli para yok 🪙'); return; }
      close(); if (ftueDone('plant')) this.drawHint(); sfx.coin && sfx.coin(); track('crop_plant', { plot: id, seed: k });
      this.drawCrop(c, it); this.tweens.add({ targets: c.crop, scaleY: { from: 0.2, to: 1 }, duration: 400, ease: 'Back.Out' });
      this.toast(`${SEEDS[k].emoji} ${t('planted')} · ${fmtMs(cropMs(id))}`);
    };
    const cr = save.farm.crops || {}, nb = new Set(neighbors(id).map((o) => cr[o] && cr[o].seed).filter(Boolean));
    keys.forEach((k, i) => {
      const S = SEEDS[k], open = seedOpen(k), x = width / 2 + ((i % 3) - 1) * 150, y = height / 2 - 110 + Math.floor(i / 3) * 128;
      const sel = k === last && open;
      const cg = this.add.graphics();
      cg.fillStyle(0x000000, 0.3); cg.fillRoundedRect(x - 66, y - 52, 132, 116, 18);
      cg.fillGradientStyle(open ? 0x3d7a58 : 0x3a4146, open ? 0x3d7a58 : 0x3a4146, open ? 0x1b4230 : 0x22282c, open ? 0x1b4230 : 0x22282c, 1);
      cg.fillRoundedRect(x - 66, y - 56, 132, 112, 18);
      cg.lineStyle(sel ? 4 : 2, sel ? 0xffd45a : 0xffffff, sel ? 1 : 0.25); cg.strokeRoundedRect(x - 66, y - 56, 132, 112, 18);
      m.add(cg);
      m.add(txt(this, x, y - 22, S.emoji, 40).setAlpha(open ? 1 : 0.4));
      m.add(txt(this, x, y + 14, S.name[getLang()] || S.name.tr, 16, open ? '#ffffff' : '#9aa'));
      const sz = inSeason(k), hh = S.ms * (sz ? SPEED : 1) / 3600000;
      if (sz) { cg.lineStyle(3, 0x9fe870, 0.9); cg.strokeRoundedRect(x - 62, y - 52, 124, 104, 15); }
      m.add(txt(this, x, y + 36, open ? `⏳${hh < 10 ? Math.round(hh * 10) / 10 : Math.round(hh)}${t('hShort')} · 🪙${seedPrice(k)}` : `🔒 ${t('level')} ${S.lvl}`, 12, open ? '#ffe58a' : '#ff9a9a'));
      if (open && S.cost) m.add(txt(this, x + 50, y - 44, `-${S.cost}🪙`, 12, '#ffd9a0'));
      if (S.good && open) m.add(txt(this, x - 50, y - 44, '🏚️', 14));
      if (sz) m.add(txt(this, x - 50, y - 22, '✨', 16));
      if (open && nb.has(k)) m.add(txt(this, x + 50, y - 22, '🔗', 16));
      const z = this.add.zone(x, y, 132, 112).setInteractive({ useHandCursor: open });
      z.on('pointerup', () => { if (open) go(k); else this.toast(`🔒 ${t('level')} ${S.lvl}`); });
      m.add(z);
    });
    // F34: nadir tohumlar — envanterde varsa altın düğme, yoksa ipucu
    const ro = rareOwned();
    if (ro.length) ro.forEach((k, i) => {
      const S = SEEDS[k], w = ro.length > 1 ? 225 : 300, x = width / 2 + (ro.length > 1 ? (i - 0.5) * 235 : 0);
      m.add(button(this, x, height / 2 + 232, w, 42, `${S.emoji} ${S.name[getLang()] || S.name.tr} ×${rareCount(k)}`, () => go(k), 0xffcf3a, '#3a2400', 16));
    });
    else m.add(txt(this, width / 2, height / 2 + 232, en ? `✨ Rare seeds drop from harvests (${RARE_PITY - (save.farm.rarePity | 0)} harvests to a sure one)` : `✨ Hasatta nadir tohum düşebilir (garantiye ${RARE_PITY - (save.farm.rarePity | 0)} hasat)`, 13, '#ffe58a'));
    m.add(txt(this, width / 2, height / 2 + 268, en ? '🏚️ = goes to the barn · others sell for coins' : '🏚️ = ambara girer · diğerleri paraya satılır', 13, '#cfe8d8'));
    m.add(txt(this, width / 2, height / 2 + 284, `${mevsim().emoji} ✨ ${en ? 'in season: +25% faster, +20% price' : 'mevsim tohumu: %25 hızlı, %20 pahalı'}  ·  🔗 ${en ? 'neighbour match +10%' : 'komşuyla aynı +%10'}${beeNear(id) ? '  ·  🐝 %15' : ''}`, 13, '#9fe870'));
    m.add(button(this, width / 2, height / 2 + 318, 280, 38, `🧱 ${en ? 'Field layers' : 'Tarla katmanları'} ${LAYERS.filter((l) => hasLayer(id, l.id)).map((l) => l.emoji).join('')}`, () => { close(); this.layersModal(id); }, 0xc98a3e, '#2a1604', 16));
  }
  // F32: zararlıyı kov — emoji kaçar, +5 🪙; korkuluk yoksa karga için ipucu
  shooPest(id) {
    const it = item(id), c = this.nodes[id], en = getLang() === 'en', k = shoo(id); if (!k) return;
    sfx.click && sfx.click(); haptic && haptic(); track('pest_shoo', { plot: id, pest: k });
    const cx = c ? c.x : this.scale.width / 2, cy = c ? c.y : this.scale.height / 2;
    const e = txt(this, cx + 30, cy - 30, PESTS[k].emoji, 34).setDepth(950);
    this.tweens.add({ targets: e, x: cx + (k === 'crow' ? 260 : 90), y: cy - (k === 'crow' ? 320 : 10), angle: k === 'crow' ? -20 : 180, alpha: 0, scale: k === 'crow' ? 1.4 : 0.4, duration: 800, ease: 'Quad.In', onComplete: () => e.destroy() });
    const p = txt(this, cx, cy - 20, `💨 +🪙5`, 20, '#ffe58a').setStroke('#000', 4).setDepth(951);
    this.tweens.add({ targets: p, y: cy - 70, alpha: 0, duration: 900, onComplete: () => p.destroy() });
    if (c) this.drawCrop(c, it); this.refreshHud();
    this.toast(k === 'crow' && !hasScarecrow(id) ? (en ? '🐦‍⬛ Shooed! A scarecrow keeps crows away for good 🧑‍🌾' : '🐦‍⬛ Kovuldu! Korkuluk kargaları hep uzak tutar 🧑‍🌾') : (en ? `${PESTS[k].emoji} Shooed! Crop saved` : `${PESTS[k].emoji} Kovuldu! Ürün kurtuldu`));
  }
  // F29: katmanlı tarla — gübre → fıskiye → sera; her katman tarlada 3D görünür
  layersModal(id) {
    const it = item(id), c = this.nodes[id], en = getLang() === 'en', L = en ? 'en' : 'tr';
    const { width, height } = this.scale; const { c: m, close } = modal(this, 500, 650);
    m.add(txt(this, width / 2, height / 2 - 280, en ? '🧱 Field layers' : '🧱 Tarla katmanları', 30, '#ffb71b'));
    m.add(txt(this, width / 2, height / 2 - 245, `${this.itemName(it)} · ${en ? 'build from the ground up' : 'topraktan yukarı kur'}`, 16, '#cfe8d8'));
    // F32: korkuluk — katman sırasından bağımsız, kargaları uzak tutar
    { const y = height / 2 + 200, s = scareStatus(id), own = s === 'owned';
      const g = this.add.graphics();
      g.fillStyle(own ? 0x2f6b48 : 0x3a2f1a, 1); g.fillRoundedRect(width / 2 - 225, y - 46, 450, 92, 18);
      g.lineStyle(own ? 3 : 2, own ? 0x9dffb8 : 0xffb71b, own ? 0.9 : 0.35); g.strokeRoundedRect(width / 2 - 225, y - 46, 450, 92, 18);
      m.add(g); m.add(txt(this, width / 2 - 185, y, SCARE.emoji, 40));
      m.add(txt(this, width / 2 - 145, y - 16, en ? 'Scarecrow' : 'Korkuluk', 20, '#ffffff').setOrigin(0, 0.5));
      m.add(txt(this, width / 2 - 145, y + 14, en ? 'Crows never land here' : 'Karga bu tarlaya konmaz', 13, '#ffe58a').setOrigin(0, 0.5));
      if (own) m.add(txt(this, width / 2 + 165, y, en ? '✅ Standing' : '✅ Dikili', 17, '#9dffb8'));
      else m.add(button(this, width / 2 + 160, y, 118, 46, s === 'locked' ? `🔒 ${t('level')} ${SCARE.lvl}` : `🪙 ${SCARE.cost}`, () => {
        const r = buyScarecrow(id);
        if (r !== 'ok') { this.toast(r === 'locked' ? `🔒 ${t('level')} ${SCARE.lvl}` : (en ? 'Not enough coins' : 'Yeterli para yok 🪙')); return; }
        sfx.coin && sfx.coin(); track('scarecrow_buy', { plot: id });
        close(); if (c) this.drawCrop(c, it); this.w3.burst && this.w3.burst(id); this.refreshHud();
        this.toast(en ? '🧑‍🌾 Scarecrow up — crows, beware!' : '🧑‍🌾 Korkuluk dikildi — kargalar kaçsın!');
        this.time.delayedCall(250, () => this.layersModal(id));
      }, s === 'ok' ? 0xffb71b : 0x2a333a, s === 'ok' ? '#1a1200' : '#bbb', 15)); }
    LAYERS.forEach((l, i) => {
      const y = height / 2 - 165 + i * 115, s = layerStatus(id, l.id), own = s === 'owned';
      const g = this.add.graphics();
      g.fillStyle(own ? 0x2f6b48 : 0x33291c, 1); g.fillRoundedRect(width / 2 - 225, y - 50, 450, 100, 18);
      g.lineStyle(own ? 3 : 2, own ? 0x9dffb8 : 0xffffff, own ? 0.9 : 0.2); g.strokeRoundedRect(width / 2 - 225, y - 50, 450, 100, 18);
      m.add(g);
      m.add(txt(this, width / 2 - 185, y, l.emoji, 44));
      m.add(txt(this, width / 2 - 145, y - 18, `${i + 1}. ${l.name[L]}`, 20, '#ffffff').setOrigin(0, 0.5));
      m.add(txt(this, width / 2 - 145, y + 14, l.info[L], 13, '#ffe58a').setOrigin(0, 0.5));
      const price = l.cost.g ? `💎 ${l.cost.g}` : `🪙 ${l.cost.c}`;
      if (own) { m.add(txt(this, width / 2 + 165, y, en ? '✅ Built' : '✅ Kurulu', 17, '#9dffb8')); return; }
      const lbl = s === 'locked' ? `🔒 ${t('level')} ${l.lvl}` : s === 'need' ? (en ? `⬆ ${LAYERS[i - 1].emoji} first` : `⬆ önce ${LAYERS[i - 1].emoji}`) : price;
      const ok = s === 'ok';
      m.add(button(this, width / 2 + 160, y, 118, 46, lbl, () => {
        const r = buyLayer(id, l.id);
        if (r !== 'ok') { this.toast(r === 'locked' ? `🔒 ${t('level')} ${l.lvl}` : r === 'need' ? `${LAYERS[i - 1].emoji} ${en ? 'needed first' : 'önce gerekli'}` : r === 'gems' ? (en ? 'Not enough gems 💎' : 'Yeterli elmas yok 💎') : (en ? 'Not enough coins' : 'Yeterli para yok 🪙')); return; }
        sfx.coin && sfx.coin(); track('layer_buy', { plot: id, layer: l.id });
        close(); if (c) this.drawCrop(c, it); this.w3.burst && this.w3.burst(id); this.refreshHud();
        this.toast(`${l.emoji} ${l.name[L]} ${en ? 'built!' : 'kuruldu!'}`);
        this.time.delayedCall(250, () => this.layersModal(id));
      }, ok ? 0xffb71b : 0x2a333a, ok ? '#1a1200' : '#bbb', 15));
    });
    m.add(txt(this, width / 2, height / 2 + 280, en ? 'Layers stay forever · 3D on your field' : 'Katmanlar kalıcıdır · tarlanda 3D görünür', 14, '#cfe8d8'));
  }
  tickCrops() {
    for (const it of CATALOG) {
      const c = this.nodes[it.id]; if (!c || !c.crop) continue;
      const st = cropState(it.id), stage = st === 'ready' ? 3 : st === 'growing' ? Math.min(2, Math.floor(growth(it.id) * 3)) : -1;
      if (st !== c.cropState || (st === 'growing' && stage !== c.cropStage) || (this.w3 && st !== 'empty' && (pestAt(it.id) || null) !== (c.pest || null))) { this.drawCrop(c, it); continue; }
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

  market(tab = 'sell') {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 480, 700);
    const top = height / 2 - 350;
    c.add(txt(this, width / 2, top + 36, `🧺 ${t('market')}`, 28, '#ffb71b').setShadow(0, 3, 'rgba(0,0,0,.5)', 4, true, true));
    { const a = chip(this, 0, top + 70, '🪙', save.coins || 0, 0xffb71b), b = chip(this, 0, top + 70, '🏚️', `${ambarUsed()}/${ambarCap()}`, ambarFull() ? 0xff5a5a : 0x9dffb8); a.x = width / 2 - (a.w + b.w + 14) / 2 + 17; b.x = a.x + a.w + 14; c.add([a, b]); }
    [['sell', `🪙 ${t('sellTab')}`], ['craft', `🔁 ${t('tradeTab')}`]].forEach(([k, l], i) => c.add(button(this, width / 2 - 105 + i * 210, top + 118, 196, 48, l, () => { close(); this.market(k); }, k === tab ? 0xffb71b : 0x2a333a, k === tab ? '#1a1200' : '#fff', 19)));
    const inv = inventory();
    const icons = { shuffle: '🔀', hammer: '🔨', moves5: '+5', prism: '🌈' };
    const again = () => { close(); this.market(tab); this.refreshHud(); };
    if (tab === 'sell') {
      const step = Object.keys(GOODS).length > 7 ? 58 : Object.keys(GOODS).length > 5 ? 76 : 88, bh = Math.min(46, step - 12);
      Object.values(GOODS).forEach((p, i) => {
        const y = top + 192 + i * step; const n = inv[p.good] || 0;
        c.add(card(this, width / 2, y, 440, step - 12, n ? { top: 0x7a5420, bottom: 0x3e2a0e, accent: 0xffe58a, accentA: 0.45 } : { top: 0x3a4146, bottom: 0x1d2226, accentA: 0.1 }));
        c.add(iconSlot(this, width / 2 - 178, y, Math.min(54, step - 10), p.emoji, n ? 0xffb71b : 0x5b646a, 28));
        c.add(txt(this, width / 2 - 140, y, `×${n}`, 26, n ? '#fff' : '#8a949a').setOrigin(0, 0.5));
        c.add(button(this, width / 2 + 40, y, 110, bh, `🪙${p.price}`, () => { if (sell(p.good)) { sfx.coin(); track('market_sell', { good: p.good }); again(); } }, n ? 0x2ee06a : 0x2a333a, n ? '#04220e' : '#777', 18));
        if (TRADES[p.good]) c.add(button(this, width / 2 + 160, y, 110, bh, `3→${icons[TRADES[p.good]]}`, () => { if (trade(p.good)) { sfx.coin(); track('market_trade', { good: p.good }); again(); } }, n >= 3 ? 0x3f7bff : 0x2a333a, n >= 3 ? '#fff' : '#777', 18));
      });
      c.add(txt(this, width / 2, top + 650, `🐥 ×${save.farm.chicks || 0}`, 20, '#ffe58a'));
      return;
    }
    c.add(txt(this, width / 2, top + 160, t('tradeHint'), 15, '#9fb3a8'));
    RECIPES.forEach((r, i) => {
      const y = top + 232 + i * 100, ok = canCraft(i);
      c.add(card(this, width / 2, y, 440, 86, ok ? { top: 0x2c6a48, bottom: 0x123522, accent: 0x7dffa8, accentA: 0.8, glow: true } : { top: 0x3a4146, bottom: 0x1d2226, accentA: 0.1 }));
      const need = Object.entries(r.need).map(([g, n]) => `${GOODS[g].emoji}${Math.min(inv[g] || 0, n)}/${n}`).join('  ');
      c.add(txt(this, width / 2 - 200, y, need, 20, '#fff').setOrigin(0, 0.5));
      c.add(button(this, width / 2 + 160, y, 110, 50, `→ ${icons[r.give]}`, () => {
        const b = craft(i); if (!b) { this.toast(t('tradeNeed')); return; }
        sfx.coin(); track('market_craft', { recipe: i, give: b }); this.toast(`+1 ${icons[b]}`); again();
      }, ok ? 0x3f7bff : 0x2a333a, ok ? '#fff' : '#777', 22));
    });
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
    { const p = w.where && w.where(id); if (p && w.mascotLook) w.mascotLook(p[0], p[1]); } // F20: kuzu da bakar
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
      nameBox({ title: getLang() === 'en' ? 'Give a name' : 'Ad ver', value: nameOf(id) || '', placeholder: it.emoji, onSave: (n) => { setName(id, n); close(); this.nameModal(id); } });
    }, 0x2ee06a, '#04220e', 18));
    if (!PETS[id]) c.add(button(this, width / 2 + 90, height / 2 + 50, 170, 50, 'Detay ▶', () => { close(); this.itemModal(id); }, 0x2a333a, '#fff', 18));
    c.add(button(this, width / 2, height / 2 + 115, 120, 42, '✕', close, 0x2a333a, '#fff', 18));
  }

  // F30: üretim zinciri penceresi (değirmen: 🌾×2 → 🥣, fırın: 🥣+🥚 → 🍞)
  chainModal(id) {
    const { width, height } = this.scale, en = getLang() === 'en';
    const it = item(id), R = CHAIN[id], out = GOODS[R.out], inv = inventory(), cs = chainState(id);
    const { c, close } = modal(this, 440, 470);
    const cy = height / 2, again = () => { close(); this.chainModal(id); };
    c.add(txt(this, width / 2, cy - 185, it.emoji, 56));
    c.add(txt(this, width / 2, cy - 130, this.itemName(it), 28, '#ffb71b'));
    // tarif satırı: girdiler → çıktı
    const ins = Object.entries(R.in);
    const row = [...ins.map(([g, n]) => ({ e: GOODS[g].emoji, s: `${Math.min(inv[g] || 0, n)}/${n}`, ok: (inv[g] || 0) >= n })), { arrow: true }, { e: out.emoji, s: `×1`, ok: true }];
    const gap = 92, x0 = width / 2 - ((row.length - 1) * gap) / 2;
    row.forEach((r, i) => {
      const x = x0 + i * gap;
      if (r.arrow) { c.add(txt(this, x, cy - 60, '➜', 34, '#ffe58a')); return; }
      c.add(iconSlot(this, x, cy - 66, 62, r.e, r.ok ? 0x2ee06a : 0xff5a5a, 32));
      c.add(txt(this, x, cy - 20, r.s, 17, r.ok ? '#9dffb8' : '#ff9a9a'));
    });
    c.add(txt(this, width / 2, cy + 12, `⏱ ${fmtMs(R.ms)}  ·  🏚️ ${ambarUsed()}/${ambarCap()}`, 16, '#9fb3a8'));
    if (cs === 'ready') {
      c.add(txt(this, width / 2, cy + 58, en ? `${out.emoji} ready!` : `${out.emoji} hazır!`, 24, '#9dffb8'));
      c.add(button(this, width / 2, cy + 130, 280, 60, `${t('collect')} ${out.emoji}`, () => {
        const g = collectChain(id); if (!g) { this.toast(t('ambarFull')); return; }
        sfx.coin(); haptic(); track('chain_collect', { item: id, good: g }); this.toast(`+1 ${out.emoji}`); close(); this.scene.restart();
      }, 0x2ee06a, '#04220e', 22));
    } else if (cs === 'busy') {
      const bw = 320, bx = width / 2 - bw / 2, by = cy + 62;
      c.add(this.add.rectangle(width / 2, by, bw, 22, 0x1d2226).setStrokeStyle(2, 0x000000, 0.4));
      const bar = this.add.rectangle(bx, by, Math.max(4, bw * chainProg(id)), 18, 0xffb71b).setOrigin(0, 0.5); c.add(bar);
      const left = txt(this, width / 2, cy + 98, `⏳ ${fmtMs(chainLeft(id))}`, 20, '#ffe58a'); c.add(left);
      const tk = this.time.addEvent({ delay: 1000, loop: true, callback: () => {
        if (!c.active) return tk.remove();
        if (chainState(id) === 'ready') { tk.remove(); again(); return; }
        bar.width = Math.max(4, bw * chainProg(id)); left.setText(`⏳ ${fmtMs(chainLeft(id))}`);
      } });
      c.add(button(this, width / 2, cy + 160, 220, 50, 'OK', close, 0x2a333a, '#fff', 20));
    } else {
      const miss = chainMissing(id), ok = chainCan(id);
      c.add(txt(this, width / 2, cy + 58, ok ? (en ? 'Ready to produce' : 'Üretime hazır') : `${en ? 'Missing' : 'Eksik'}: ${miss.map((g) => GOODS[g].emoji).join(' ')}`, 19, ok ? '#9dffb8' : '#ff9a9a'));
      c.add(button(this, width / 2, cy + 130, 280, 60, `▶ ${en ? 'Start' : 'Başlat'} ${out.emoji}`, () => {
        if (!chainStart(id)) { this.toast(en ? 'Not enough ingredients' : 'Malzeme yetmiyor'); return; }
        sfx.build(); track('chain_start', { item: id }); this.toast(en ? `${it.emoji} working…` : `${it.emoji} çalışıyor…`); close(); this.scene.restart();
      }, ok ? 0x2ee06a : 0x2a333a, ok ? '#04220e' : '#888', 22));
    }
    c.add(txt(this, width / 2, cy + 200, en ? '🌾 → 🌬️ → 🥣 → 🍞 → 📋 orders' : '🌾 → 🌬️ → 🥣 → 🍞 → 📋 siparişler', 14, '#9fb3a8'));
  }

  itemModal(id) {
    if (isSickAnimal(id)) return this.vetModal(id);
    if (CHAIN[id] && status(id) === 'owned') return this.chainModal(id);
    const it = item(id); const st = status(id);
    const { width, height } = this.scale;
    const { c, close } = modal(this, 420, st === 'owned' && it.kind === 'animal' ? 410 : 320);
    c.add(txt(this, width / 2, height / 2 - 110, it.emoji, 64));
    c.add(txt(this, width / 2, height / 2 - 55, this.itemName(it), 28, '#ffb71b'));
    let msg = '';
    if (st === 'owned') msg = t('farmOwned');
    else if (st === 'locked') msg = (save.level || 1) < (it.lvl || 1) || !it.needs ? `🔒 ${t('level')} ${it.lvl}` : `${t('farmNeeds')}: ${this.itemName(item(it.needs))}`;
    else msg = `⭐ ${it.price}  ·  ${t('farmHave')} ${starBalance()}`;
    c.add(txt(this, width / 2, height / 2 + 5, msg, 20, '#fff'));
    if (PERK_TEXT[id]) c.add(txt(this, width / 2, height / 2 - 18, `✨ ${PERK_TEXT[id][getLang()] || PERK_TEXT[id].tr}`, 16, '#9dffb8'));
    if (st === 'owned' && it.kind === 'animal') this.moreRow(c, id, close);
    if (st === 'owned' && PRODUCTS[id]) {
      const pr = PRODUCTS[id];
      c.add(txt(this, width / 2, height / 2 + 140, `🏚️ ${ambarUsed()}/${ambarCap()}`, 15, ambarFull() ? '#ff9a9a' : '#9fb3a8'));
      if (id === 'kovan') { const en = getLang() === 'en', fl = flowersNearHive(); c.add(txt(this, width / 2, height / 2 + 26, fl ? (en ? '🌻 flowers nearby: honey 25% faster' : '🌻 çiçek yakında: bal %25 hızlı') : (en ? '🌻 plant sunflowers near the hive: honey +25% faster' : '🌻 kovanın yanına ayçiçeği ek: bal %25 hızlı'), 14, fl ? '#ffd45a' : '#9fb3a8')); }
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

  // F24: "Sende 2/4 · +1 al ⭐" satırı (hayvan kartı üstünde)
  moreRow(c, id, close) {
    const { width, height } = this.scale, it = item(id), n = animalCount(id), ms = moreStatus(id);
    c.add(txt(this, width / 2 - (ms === 'max' ? 0 : 70), height / 2 + 160, `${it.emoji.repeat(n)}  ${n}/${ANIMAL_MAX}${ms === 'max' ? ' ✅' : ''}`, 20, '#ffe58a'));
    if (ms === 'max') return;
    const ok = ms === 'buyable';
    c.add(button(this, width / 2 + 120, height / 2 + 160, 130, 44, `+1 ⭐${it.price}`, () => {
      if (!buyMore(id)) { this.toast(t('farmEarn')); return; }
      sfx.build(); track('farm_buy_more', { item: id, n: n + 1 }); close(); this.scene.restart();
    }, ok ? 0x2ee06a : 0x2a333a, ok ? '#04220e' : '#888', 16));
  }

  // ---- F7: satılık arsalar (sağ/sol) + tema önizleme ----
  plotSignTap(p) {
    const id = this.w3.pick(p.x, p.y);
    if (!id || !id.startsWith('arsa:')) return false;
    this.plotBuyTap(id.slice(5)); return true;
  }
  plotBuyTap(id) {
    const { width, height } = this.scale, a = arsa(id), st = plotStatus(id);
    const { c, close } = modal(this, 440, 340);
    c.add(txt(this, width / 2, height / 2 - 110, `🪧 ${t('plot')} · ${a.id.startsWith('sol') ? '⬅️' : '➡️'}`, 28, '#ffb71b'));
    c.add(txt(this, width / 2, height / 2 - 60, `${t('level')} ${a.lvl}+  ·  🪙 ${a.coins}`, 20, '#fff'));
    if (st === 'owned') { c.add(txt(this, width / 2, height / 2 + 20, `✅ ${t('plotOwned')}`, 22, '#9dffb8')); c.add(button(this, width / 2, height / 2 + 100, 200, 50, 'OK', close, 0x2a333a, '#fff', 20)); return; }
    if (st === 'level') {
      c.add(txt(this, width / 2, height / 2 + 10, `🔒 ${t('needLevel')}: ${a.lvl}`, 20, '#ff9a9a'));
      c.add(button(this, width / 2, height / 2 + 90, 260, 56, `${t('play')} ▶`, () => { close(); this.playBtn.emit('pointerup'); }, 0x2ee06a, '#04220e', 22));
      return;
    }
    c.add(button(this, width / 2, height / 2 + 40, 300, 60, `${t('plotBuy')} 🪙 ${a.coins}`, () => {
      if (!buyPlot(id)) { sfx.error && sfx.error(); this.toast(t('needCoins')); return; }
      sfx.coin(); track('farm_plot', { id }); close();
      const q = this.w3.project((a.rect[0] + a.rect[2]) / 2, 0, (a.rect[1] + a.rect[3]) / 2); this.dustPuff(q.x, q.y, 14);
      this.time.delayedCall(450, () => this.scene.restart());
    }, st === 'ok' ? 0x2ee06a : 0x2a333a, st === 'ok' ? '#04220e' : '#888', 22));
    c.add(button(this, width / 2, height / 2 + 115, 160, 46, t('close'), close, 0x2a333a, '#fff', 18));
  }
  themeBuyUse(id) {
    if (!ownsTheme(id)) { if (!buyTheme(id)) { sfx.error && sfx.error(); this.toast(t('needGems')); return false; } sfx.coin(); track('theme_buy', { id }); }
    setTheme(id); track('theme_set', { id }); this.w3.setTheme(currentTheme()); this.refreshHud && this.refreshHud(); return true;
  }
  themePreview(id) {
    const { width, height } = this.scale, th = THEMES.find((x) => x.id === id), lang = getLang() === 'en' ? 'en' : 'tr';
    this.w3.setTheme(th); if (this.hud) this.hud.setVisible(false);
    const bar = this.add.container(0, 0).setDepth(900);
    bar.add(this.add.rectangle(width / 2, height - 110, width - 30, 150, 0x0a0f0d, 0.88).setStrokeStyle(2, 0xffb71b, 0.8));
    bar.add(txt(this, width / 2, height - 160, `${th.icon} ${th[lang]} — ${t('previewHint')}`, 18, '#fff'));
    const end = (keep) => { bar.destroy(); if (this.hud) this.hud.setVisible(true); if (!keep) this.w3.setTheme(currentTheme()); };
    const own = ownsTheme(id);
    bar.add(button(this, width / 2 - 95, height - 100, 170, 56, own ? t('use') : `${t('buy')} 💎${th.gems}`, () => { if (this.themeBuyUse(id)) end(true); }, 0xffb71b, '#1a1200', 18));
    bar.add(button(this, width / 2 + 95, height - 100, 170, 56, t('close'), () => { end(false); this.shop('theme'); }, 0x2a333a, '#fff', 18));
  }

  // ---- F12: Mağaza (sekmeli), F15: bölüm kilitleri ----
  shop(tab = 'building') {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 500, 830);
    markSeen(CATALOG.filter((i) => status(i.id) !== 'locked' || (save.level || 1) >= (i.lvl || 1)).map((i) => i.id));
    const top = height / 2 - 415, en = getLang() === 'en';
    // F28: tente + asılı altın tabela
    c.add(awning(this, width / 2, top + 10, 488, 34, 12));
    c.add(signBoard(this, width / 2, top + 66, `🏪 ${t('shop')}`, 24));
    { const ch = [chip(this, 0, top + 108, '⭐', starBalance(), 0xffd23f), chip(this, 0, top + 108, '🪙', save.coins || 0, 0xffb71b), chip(this, 0, top + 108, '💎', save.gems || 0, 0x46c8ff)]; let x = width / 2 - (ch.reduce((s, k) => s + k.w, 0) + 20) / 2 + 17; ch.forEach((k) => { k.x = x; x += k.w + 10; c.add(k); }); }
    { const promo = button(this, width / 2, top + 792, 440, 48, en ? '💎 Gem & coin packs  ›' : '💎 Elmas & altın paketleri  ›', () => { close(); track('farm_promo'); this.scene.start('Map', { shop: true }); }, 0x8a3dd6, '#ffffff', 19); c.add(promo); c.add(shine(this, width / 2, top + 792, 440, 48, 0xd9a8ff)); }
    // F28: etiketli sekme şeridi (7 sekme; 👕 gardırobu açar)
    const TL = { building: ['Bina', 'Build'], animal: ['Hayvan', 'Animals'], plot: ['Tarla', 'Fields'], vehicle: ['Araç', 'Vehicle'], land: ['Arsa', 'Land'], theme: ['Tema', 'Theme'], wardrobe: ['Giysi', 'Outfits'] };
    const tabs = [...TABS, ['land', '🗺️'], ['theme', '🎨'], ['wardrobe', '👕']];
    { const bar = this.add.graphics(); bar.fillStyle(0x0a1410, 0.75); bar.fillRoundedRect(width / 2 - 232, top + 136, 464, 62, 18); bar.lineStyle(2, 0xffb71b, 0.35); bar.strokeRoundedRect(width / 2 - 232, top + 136, 464, 62, 18); c.add(bar); }
    tabs.forEach(([k, e], i) => {
      const x = width / 2 - 198 + i * 66, on = k === tab;
      const b = button(this, x, top + 160, 60, 40, e, () => { if (on) return; sfx.click(); close(); if (k === 'wardrobe') this.wardrobe(); else this.shop(k); }, on ? 0xffb71b : 0x2a333a, on ? '#1a1200' : '#fff', 22);
      c.add(b);
      c.add(txt(this, x, top + 188, TL[k][en ? 1 : 0], 11, on ? '#ffd45a' : '#9fb3a8'));
    });
    this.dealCard(c, close, top + 238, tab);
    const n0 = c.list.length;
    this.time.delayedCall(0, () => c.list.slice(n0).forEach((o, i) => {
      if (o.y === undefined) return;
      const y = o.y; o.setAlpha(0); o.y = y + 18;
      this.tweens.add({ targets: o, alpha: 1, y, duration: 260, delay: 60 + Math.floor(i / 5) * 45, ease: 'Back.Out' });
    }));
    if (tab === 'land') {
      c.add(txt(this, width / 2, top + 300, t('landHint'), 15, '#9fb3a8'));
      ARSA.forEach((a, i) => {
        const y = top + 350 + i * 72, st = plotStatus(a.id), side = a.id.startsWith('sol') ? '⬅️' : '➡️';
        c.add(card(this, width / 2, y, 450, 64, st === 'owned' ? { top: 0x2c6a48, bottom: 0x123522, accent: 0x7dffa8, accentA: 0.5 } : st === 'ok' ? { top: 0x6b4a1a, bottom: 0x35240c, accent: 0xffe58a, accentA: 0.5 } : { top: 0x3a4146, bottom: 0x1d2226, accentA: 0.1 }));
        c.add(iconSlot(this, width / 2 - 185, y, 52, side, st === 'level' ? 0x5b646a : 0x6fcf6a, 26));
        c.add(txt(this, width / 2 - 145, y - 12, `${t('plot')} ${i + 1}`, 20, '#fff').setOrigin(0, 0.5));
        c.add(txt(this, width / 2 - 145, y + 14, st === 'owned' ? `✅ ${t('plotOwned')}` : `${t('level')} ${a.lvl}+ · 🪙 ${a.coins}`, 13, st === 'level' ? '#ff9a9a' : '#9dffb8').setOrigin(0, 0.5));
        if (st === 'owned') return;
        c.add(button(this, width / 2 + 150, y, 130, 50, st === 'level' ? `🔒 ${a.lvl}` : `🪙 ${a.coins}`, () => { close(); this.plotBuyTap(a.id); }, st === 'ok' ? 0x2ee06a : 0x2a333a, st === 'ok' ? '#04220e' : '#aaa', 18));
      });
      return;
    }
    if (tab === 'theme') {
      const lang = getLang() === 'en' ? 'en' : 'tr';
            THEMES.forEach((th, i) => {
        const y = top + 330 + i * 64, own = ownsTheme(th.id), cur = currentTheme().id === th.id;
        c.add(card(this, width / 2, y, 450, 58, cur ? { top: 0x2c6a48, bottom: 0x123522, accent: 0x7dffa8, accentA: 0.9, glow: true } : { top: 0x24455a, bottom: 0x10212c, accent: 0x8fe3ff, accentA: 0.3 }));
        const g = this.add.graphics(); g.fillGradientStyle(th.sky[0], th.sky[0], th.hills[1], th.hills[1], 1); g.fillRoundedRect(width / 2 - 215, y - 26, 52, 52, 10); c.add(g);
        c.add(txt(this, width / 2 - 189, y, th.icon, 26));
        c.add(txt(this, width / 2 - 150, y - 11, th[lang], 18, '#fff').setOrigin(0, 0.5));
        c.add(txt(this, width / 2 - 150, y + 13, own ? t('owned') : `💎 ${th.gems}`, 13, own ? '#8ff0b0' : '#8fe3ff').setOrigin(0, 0.5));
        c.add(button(this, width / 2 + 80, y, 96, 44, `👁 ${t('preview')}`, () => { close(); this.themePreview(th.id); }, 0x2a333a, '#fff', 14));
        if (cur) c.add(txt(this, width / 2 + 180, y, '✓', 26, '#8ff0b0'));
        else c.add(button(this, width / 2 + 180, y, 86, 44, own ? t('use') : `💎 ${th.gems}`, () => { close(); this.themeBuyUse(th.id); }, own ? 0x2ee06a : 0xffb71b, '#1a1200', 15));
      });
      return;
    }
    CATALOG.filter((i) => i.kind === tab).forEach((it, i) => {
      const y = top + 342 + i * 78, st = status(it.id);
      const lk = st === 'locked';
      c.add(card(this, width / 2, y, 450, 74, lk ? { top: 0x3a4146, bottom: 0x1d2226, accentA: 0.1 } : st === 'owned' ? { top: 0x2c6a48, bottom: 0x123522, accent: 0x7dffa8, accentA: 0.45 } : { top: 0x6b4a1a, bottom: 0x35240c, accent: 0xffe58a, accentA: 0.55, glow: st === 'buyable' }));
      c.add(iconSlot(this, width / 2 - 185, y, 58, it.emoji, lk ? 0x5b646a : 0xffb71b, 32).setAlpha(lk ? 0.6 : 1));
      c.add(txt(this, width / 2 - 145, y - 12, this.itemName(it), 20, '#fff').setOrigin(0, 0.5));
      let sub = '';
      if (st === 'locked') sub = (save.level || 1) < (it.lvl || 1) ? `🔒 ${t('level')} ${it.lvl}` : `🔒 ${t('farmNeeds')}: ${this.itemName(item(it.needs))}`;
      else if (PERK_TEXT[it.id]) sub = PERK_TEXT[it.id][getLang()] || PERK_TEXT[it.id].tr;
      c.add(txt(this, width / 2 - 145, y + 14, sub, 13, st === 'locked' ? '#ff9a9a' : '#9dffb8').setOrigin(0, 0.5));
      if (st === 'owned' && it.kind === 'plot') {
        const lv = plotLvl(it.id);
        c.add(txt(this, width / 2 - 145, y + 14, `${t('level')} ${lv}/${BLD_MAX} · ⏱ ${fmtMs(cropMs(it.id))} · ×${cropYield(it.id)}`, 13, '#ffe58a').setOrigin(0, 0.5).setDepth(1));
        if (lv >= BLD_MAX) c.add(txt(this, width / 2 + 170, y, '✅', 30));
        else {
          const ok = (save.coins || 0) >= plotUpgradeCost(it.id);
          c.add(button(this, width / 2 + 160, y, 110, 50, `⬆🪙${plotUpgradeCost(it.id)}`, () => {
            if (!upgradePlot(it.id)) { this.toast(t('needCoins')); return; }
            sfx.build(); track('plot_upgrade', { plot: it.id, lv: lv + 1 }); close(); this.shop(tab); this.refreshHud();
          }, ok ? 0x2ee06a : 0x2a333a, ok ? '#04220e' : '#888', 16));
        }
      } else if (st === 'owned' && it.kind === 'animal') {
        const n = animalCount(it.id), ms = moreStatus(it.id);
        c.add(txt(this, width / 2 + 88, y, `${n}/${ANIMAL_MAX}`, 18, '#ffe58a'));
        if (ms === 'max') c.add(txt(this, width / 2 + 170, y, '✅', 30));
        else c.add(button(this, width / 2 + 170, y, 96, 50, `+1 ⭐${it.price}`, () => {
          if (!buyMore(it.id)) { this.toast(t('farmEarn')); return; }
          sfx.build(); track('farm_buy_more', { item: it.id, n: n + 1 }); close(); this.scene.restart();
        }, ms === 'buyable' ? 0x2ee06a : 0x2a333a, ms === 'buyable' ? '#04220e' : '#888', 17));
      } else if (st === 'owned') c.add(txt(this, width / 2 + 170, y, '✅', 30));
      else if (st !== 'locked') c.add(button(this, width / 2 + 160, y, 110, 50, it.price ? `⭐ ${it.price}` : t('free'), () => {
        if (st !== 'buyable') { this.toast(t('farmEarn')); return; }
        if (!buyItem(it.id)) return;
        if (it.id === 'kumes') ftueDone('coop');
        sfx.build(); track('farm_buy', { item: it.id, price: it.price }); close();
        if (MOVABLE(it.id)) this.placeStart(it.id, false); else this.scene.restart({ dlg: it.id });
      }, st === 'buyable' ? 0x2ee06a : 0x2a333a, st === 'buyable' ? '#04220e' : '#888', 20));
    });
  }

  // F28: Günün Fırsatı — kuzunun gardırobundan her gün bir parça %50 indirimli, gece yarısına geri sayım
  dealCard(c, close, y, tab) {
    const { width } = this.scale, en = getLang() === 'en', { it, price } = dailyDeal();
    const own = wOwns(it.id), lk = wLocked(it.id), cur = price.g ? '💎' : '🪙', amt = price.g || price.c, old = it.cost.g || it.cost.c;
    c.add(card(this, width / 2, y, 450, 84, { top: 0x7a2a52, bottom: 0x3a0f28, accent: 0xffb3d9, accentA: 0.7, glow: !own }));
    if (!own) c.add(shine(this, width / 2, y, 450, 84, 0xffc2e6));
    c.add(ribbon(this, width / 2 - 150, y - 44, en ? '⚡ DEAL OF THE DAY' : '⚡ GÜNÜN FIRSATI', 0xe0337a));
    c.add(iconSlot(this, width / 2 - 185, y + 4, 58, it.emoji || '👕', it.color || 0xffb3d9, 30));
    c.add(txt(this, width / 2 - 145, y - 8, it.name[en ? 'en' : 'tr'], 19, '#fff').setOrigin(0, 0.5));
    const cd = txt(this, width / 2 - 145, y + 18, '', 13, '#ffd1ea').setOrigin(0, 0.5); c.add(cd);
    const tick = () => { if (!cd.active) return; const d = new Date(), m = new Date(d); m.setHours(24, 0, 0, 0); const q = Math.floor((m - d) / 1000), hh = Math.floor(q / 3600), mm = String(Math.floor(q / 60) % 60).padStart(2, '0'), ss = String(q % 60).padStart(2, '0'); cd.setText(`⏳ ${hh}:${mm}:${ss} · ${cur}${old} → ${cur}${amt}`); };
    tick(); const tm = this.time.addEvent({ delay: 1000, loop: true, callback: () => (cd.active ? tick() : tm.remove()) });
    if (own) { c.add(txt(this, width / 2 + 160, y + 4, en ? 'Owned ✓' : 'Alındı ✓', 18, '#8ff0b0')); return; }
    if (lk) { c.add(button(this, width / 2 + 160, y + 4, 110, 48, `🔒 ${it.lvl}`, () => this.toast(`${t('level')} ${it.lvl}`), 0x2a333a, '#aaa', 18)); return; }
    c.add(button(this, width / 2 + 160, y + 4, 110, 50, `${cur} ${amt}`, () => {
      const r = wBuy(it.id, 0.5);
      if (r !== 'ok') { sfx.error(); this.toast(r === 'gems' ? t('needGems') : t('needCoins')); return; }
      wWear(it.id); this.w3 && this.w3.mascotDress && this.w3.mascotDress(wLook()); this.lambReact && this.lambReact('dance', en ? 'How do I look? 😍' : 'Yakıştı mı? 😍'); sfx.coin(); track('deal_buy', { item: it.id }); close(); this.toast(en ? `${it.name.en} — Lambkin is wearing it!` : `${it.name.tr} — Kuzucuk giydi!`); this.shop(tab); this.refreshHud();
    }, 0xff4f9a, '#ffffff', 20));
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
    let p = this.placeSnap(id, w.where(id));
    if (!this.placeValid(id, p)) search: for (let r = 1; r < 12; r++) for (let a = 0; a < 16; a++) {
      const q = [Math.round((p[0] + r * Math.cos(a * Math.PI / 8)) * 2) / 2, Math.round((p[1] + r * Math.sin(a * Math.PI / 8)) * 2) / 2];
      if (this.placeValid(id, q)) { p = q; break search; }
    }
    this.placing = { id, moving, p };
    if (this.nodes[id]) this.nodes[id].setVisible(false);
    this.placeBanner = this.banner(`📍 ${t('placeHint')} · ✋`, [
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
    this.placing.p = this.placeSnap(this.placing.id, g); this.placeShow();
  }
  // F22: tarlalar komşu tarlaya kenar kenara yapışır (boşluk kalmaz); diğerleri 0,5'lik ızgaraya
  placeSnap(id, g) {
    const p = g.map((v) => Math.round(v * 2) / 2);
    if (!LAYOUT[id] || !LAYOUT[id].plot) return p;
    let best = null, bd = 0.9;
    for (const k of CATALOG.map((i) => i.id)) {
      if (k === id || !LAYOUT[k] || !LAYOUT[k].plot || !owns(k)) continue;
      const q = this.w3.where(k);
      for (const [dx, dz] of [[PLOT_W, 0], [-PLOT_W, 0], [0, PLOT_D], [0, -PLOT_D]]) {
        const c = [q[0] + dx, q[1] + dz], d = Math.hypot(c[0] - g[0], c[1] - g[1]);
        if (d < bd && this.placeValid(id, c)) { bd = d; best = c; }
      }
    }
    return best || p;
  }
  placeValid(id, [x, z]) {
    const rad = (k) => (LAYOUT[k].plot ? 1.5 : k === 'traktor' ? 1.1 : 2.1), r = rad(id) * 0.5;
    const main = Math.abs(x) <= ISL_HW - r && Math.abs(z) <= ISL_HD - r;
    if (!main && !inPlot(x, z, r)) return false;                          // ana ada ya da sahip olunan arsa
    if (Math.hypot(x, z) < 1.2 + rad(id) * 0.4) return false;          // çeşme
    if (x > 4.5 && z < -5 && main) return false;                       // göl
    if (x < -6.5 && x > -10.5 && Math.abs(z + 0.5) < 2.5) return false; // değirmen
    for (const k of [...CATALOG.map((i) => i.id), 'market']) {
      if (k === id || !LAYOUT[k] || !(k === 'market' || (owns(k) && MOVABLE(k)))) continue;
      const q = this.w3.where(k);
      if (LAYOUT[k].plot && LAYOUT[id].plot) { if (Math.abs(q[0] - x) < PLOT_W - 0.05 && Math.abs(q[1] - z) < PLOT_D - 0.05) return false; continue; } // tarla-tarla: yalnız üst üste binmesin
      if (Math.hypot(q[0] - x, q[1] - z) < (rad(k) + rad(id)) * 0.8) return false;
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

  // F8: current guide step as a bouncing banner + a finger locked onto the real target
  drawHint() {
    this.hint && this.hint.destroy(); this.hint = null;
    this.finger && this.finger.destroy(); this.finger = null;
    this.events.off('update', this.fingerFollow, this);
    const cur = ftueCurrent(); if (!cur) return;
    const { width, height } = this.scale;
    const c = this.hint = this.add.container(width / 2, height - 215).setDepth(40);
    const tx = txt(this, 0, 0, cur.text.replace(/^👆\s*/, ''), 18, '#1a1200');
    c.add([this.add.rectangle(0, 0, tx.width + 36, 44, 0xffe58a).setStrokeStyle(3, 0x3a2a10), tx]);
    this.tweens.add({ targets: c, y: c.y - 8, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.InOut' });
    if (!this.hintTarget(cur.id)) return;
    this.finger = txt(this, 0, 0, '👇', 40).setOrigin(0.5, 1).setDepth(41);
    this.fingerBob = 0;
    this.tweens.add({ targets: this, fingerBob: 10, yoyo: true, repeat: -1, duration: 350 });
    const q = this.hintTarget(cur.id), w = this.w3, ids = { coop: 'kumes', plant: 'tarla1' };
    if (w && ids[cur.id] && q && (q.x < 40 || q.x > width - 40 || q.y < 150 || q.y > height - 200)) {
      const p = w.where(ids[cur.id]); if (p) { w.target.x = p[0]; w.target.z = p[1]; }   // bring it into view
    }
    this.fingerFollow();
    this.events.on('update', this.fingerFollow, this);
  }
  // screen point the guide finger touches (tip = bottom of the emoji)
  hintTarget(id) {
    const w = this.w3;
    if (id === 'play' && this.playBtn) return { x: this.playBtn.x, y: this.playBtn.y - 36 * this.playBtn.scaleY };
    if (!w) return null;
    if (id === 'coop') return w.anchor('kumes', 0.8);
    if (id === 'plant') { const p = ['tarla1', 'tarla2', 'tarla3'].map((k) => w.anchor(k, 0.4)).find((q) => q && q.vis); return p || null; }
    if (id === 'pet') { const m = w.movers.find((a) => a.pet) || w.movers[0]; return m ? w.anchor(m.id, 0.9) : null; }
    return null;
  }
  fingerFollow() {
    if (!this.finger || !this.finger.active) return;
    const cur = ftueCurrent(), q = cur && this.hintTarget(cur.id);
    this.finger.setVisible(!!q && q.vis !== false); if (!q) return;
    const { width } = this.scale, off = q.x < 24 ? '👈' : q.x > width - 24 ? '👉' : '👇';
    if (this.finger.text !== off) this.finger.setText(off);
    this.finger.setPosition(Math.max(28, Math.min(width - 28, q.x)), Math.max(170, q.y - 6 - (this.fingerBob || 0)));
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

  // F10: sipariş panosu
  orders() {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 480, 640);
    const top = height / 2 - 320, list = refreshOrders(), xp = xpProgress(), inv = inventory();
    c.add(txt(this, width / 2, top + 42, `📋 ${t('orders')}`, 28, '#ffb71b'));
    c.add(txt(this, width / 2, top + 84, `${t('farmLv')} ${xp.level}  ·  XP ${xp.cur}/${xp.need}`, 17, '#9dffb8'));
    c.add(this.add.rectangle(width / 2, top + 112, 380, 12, 0x000000, 0.4).setStrokeStyle(1, 0xffffff, 0.2));
    c.add(this.add.rectangle(width / 2 - 190, top + 112, 380 * Math.min(1, xp.cur / xp.need), 12, 0x2ee06a).setOrigin(0, 0.5));
    const again = () => { close(); this.orders(); this.refreshHud(); };
    list.slice(0, SLOTS).forEach((o, i) => {
      const y = top + 200 + i * 140;
      c.add(this.add.rectangle(width / 2, y, 440, 124, 0x000000, 0.25).setStrokeStyle(2, canDeliver(i) ? 0x2ee06a : 0xffffff, canDeliver(i) ? 0.7 : 0.12));
      if (o.wait) {
        const w = txt(this, width / 2, y, `🚶 ${t('orderWait')} ${fmtMs(o.wait - Date.now())}`, 19, '#9fb3a8'); c.add(w);
        const tk = this.time.addEvent({ delay: 1000, loop: true, callback: () => { if (!w.active) return tk.remove(); const ms = o.wait - Date.now(); if (ms <= 0) { tk.remove(); again(); } else w.setText(`🚶 ${t('orderWait')} ${fmtMs(ms)}`); } });
        return;
      }
      c.add(txt(this, width / 2 - 200, y - 32, `${o.emoji} ${o.name}`, 20, '#fff').setOrigin(0, 0.5));
      const need = Object.entries(o.need).map(([g, n]) => `${GOODS[g].emoji}${Math.min(inv[g] || 0, n)}/${n}`).join('   ');
      c.add(txt(this, width / 2 - 200, y + 4, need, 22, '#ffe58a').setOrigin(0, 0.5));
      c.add(txt(this, width / 2 - 200, y + 38, `🪙${o.coins}  ·  +${o.xp} XP`, 16, '#9dffb8').setOrigin(0, 0.5));
      const ok = canDeliver(i);
      c.add(button(this, width / 2 + 140, y - 12, 140, 50, t('deliver'), () => {
        const r = deliver(i); if (!r) { this.toast(t('tradeNeed')); return; }
        sfx.coin(); track('order_deliver', { coins: r.coins, xp: r.xp });
        this.toast(`+🪙${r.coins}  +${r.xp} XP${r.levelUp ? `  ·  ⬆️ ${t('farmLv')} ${r.levelUp} +💎1` : ''}`); again();
      }, ok ? 0x2ee06a : 0x2a333a, ok ? '#04220e' : '#777', 19));
      c.add(button(this, width / 2 + 140, y + 40, 140, 36, `❌ ${t('orderSkip')}`, () => { if (skip(i)) { track('order_skip', {}); again(); } }, 0x3a2a2a, '#fbb', 14));
    });
    c.add(txt(this, width / 2, top + 610, t('ordersHint'), 14, '#9fb3a8').setWordWrapWidth(420));
  }

  // F9: arkadaşlar paneli → ziyaret
  // F11: gelen kutusunda bekleyen hediye/istek sayısı 👥 üstünde
  inboxBadge(x, y) {
    if (this.frBadge) { this.frBadge.destroy(); this.frBadge = null; }
    if (!account()) return;
    inbox().then((r) => {
      const n = ((r && r.inbox) || []).length;
      if (!n || !this.sys.isActive()) return;
      const c = this.frBadge = this.add.container(x, y).setDepth(50);
      c.add(this.add.circle(0, 0, 12, 0xff4d5e).setStrokeStyle(2, 0xffffff));
      c.add(txt(this, 0, 0, String(Math.min(n, 9)), 14, '#fff'));
    }).catch(() => {});
  }
  // F36: linkten gelen sulamaları topla → 🪙 + ekinler hızlanır
  waterClaim() {
    if (!account() || Farm._wClaiming) return; Farm._wClaiming = true;
    claimWater().then((r) => {
      if (!r || !this.sys.isActive()) return;
      this.refreshHud(); this.toast(`💧 ${r.n} ${t('lkGot')} · +${r.coins} 🪙`);
    }).catch(() => {}).finally(() => { Farm._wClaiming = false; });
  }
  friends() {
    friendsPanel((code) => {
      friendFarm(code).then((f) => this.scene.start('Visit', { f })).catch(() => this.toast(`⚠️ ${t('frFarmErr')}`));
    }, () => this.friends(), () => { this.refreshHud(); this.inboxBadge(this.scale.width - 16, 264); });
  }

  // F12: görevler/başarım/albüm — alınabilir ödül sayısı 📜 üstünde
  taskBadge(x, y) {
    if (this.tkBadge) { this.tkBadge.destroy(); this.tkBadge = null; }
    const n = tasksBadge();
    if (!n) return;
    const c = this.tkBadge = this.add.container(x, y).setDepth(50);
    c.add(this.add.circle(0, 0, 12, 0xff4d5e).setStrokeStyle(2, 0xffffff));
    c.add(txt(this, 0, 0, String(Math.min(n, 9)), 14, '#fff'));
  }
  tasks() {
    tasksPanel(() => { this.refreshHud(); this.taskBadge(this.scale.width - 16, 314); });
  }

  // F14: hasat festivali — 2 haftada bir 1 hafta, 10 sınırlı bölüm, sırayla
  festBadge(x, y) {
    if (this.fBadge) { this.fBadge.destroy(); this.fBadge = null; }
    if (!festNext()) return;
    const c = this.fBadge = this.add.container(x, y).setDepth(50);
    c.add(this.add.circle(0, 0, 12, 0xff4d5e).setStrokeStyle(2, 0xffffff));
    c.add(txt(this, 0, 0, '!', 14, '#fff'));
  }
  festival() {
    const { width, height } = this.scale; const cx = width / 2, cy = height / 2;
    const { c, close } = modal(this, 460, 470);
    const on = festActive(), left = festMsLeft(), d = Math.floor(left / 86400000), h = Math.floor(left / 3600000) % 24;
    c.add(txt(this, cx, cy - 200, `🌾 ${t('festTitle')}`, 30, '#ffb71b'));
    c.add(txt(this, cx, cy - 162, `${on ? t('festEnds') : t('festNextIn')} ${d}${t('dayShort')} ${h}${t('hourShort')}`, 18, on ? '#9dffb8' : '#9fb3a8'));
    const done = on ? festDone() : 0, nx = festNext();
    for (let i = 0; i < FEST_N; i++) {
      const x = cx - 168 + (i % 5) * 84, y = cy - 95 + Math.floor(i / 5) * 100, n = i + 1;
      const st = n <= done ? 'done' : n === nx ? 'next' : 'lock';
      const col = st === 'done' ? 0x2ee06a : st === 'next' ? 0xffb71b : 0x2a333a;
      const b = this.add.circle(x, y, 32, col).setStrokeStyle(3, 0xffffff, st === 'next' ? 1 : 0.3); c.add(b);
      c.add(txt(this, x, y, st === 'done' ? '✓' : st === 'lock' ? '🔒' : String(n), st === 'next' ? 26 : 20, st === 'next' ? '#04220e' : '#fff'));
      if (n === 5 || n === FEST_N) c.add(txt(this, x, y + 42, n === 5 ? '🔨' : `💎${FEST_ALL_GEMS}`, 14, '#ffe58a'));
      if (st === 'next') { b.setInteractive({ useHandCursor: true }); b.on('pointerup', () => this.festPlay(close, n)); }
    }
    c.add(txt(this, cx, cy + 80, `${t('festReward')} 🪙${FEST_COINS} · XP ×2`, 17, '#fff'));
    if (nx) c.add(button(this, cx, cy + 140, 280, 60, `▶ ${t('play')} ${nx}/${FEST_N}`, () => this.festPlay(close, nx), 0x2ee06a, '#04220e', 22));
    else c.add(txt(this, cx, cy + 140, on ? `🏆 ${t('festAllDone')}` : t('festClosed'), 20, '#ffb71b'));
    c.add(button(this, cx, cy + 205, 160, 40, t('close'), () => close(), 0x2a333a, '#fff', 16));
  }
  festPlay(close, n) {
    close(); track('event_start', { n });
    this.tryStart(festivalLevels(this.levels || this.cache.json.get('levels'))[n - 1]);
  }
  // F14: ücretsiz sezon yolu — bölüm kazandıkça XP, 30 basamak
  passBadge(x, y) {
    if (this.pBadge) { this.pBadge.destroy(); this.pBadge = null; }
    const n = claimable();
    if (!n) return;
    const c = this.pBadge = this.add.container(x, y).setDepth(50);
    c.add(this.add.circle(0, 0, 12, 0xff4d5e).setStrokeStyle(2, 0xffffff));
    c.add(txt(this, 0, 0, String(Math.min(n, 9)), 14, '#fff'));
  }
  // F31: haftalık mevsim döngüsü — sahne rengi + parçacık + mevsim tohumlarına bonus
  // F35: yeni hava dilimi ekinlere dokundu → kısa bildirim
  havaHits(hh) {
    const en = getLang() === 'en', w = hh[hh.length - 1][1].replace('-guard', ''), H = HAVA[w]; if (!H) return;
    const hit = hh.filter((x) => !x[1].endsWith('-guard')).length, safe = hh.length - hit;
    this.toast(`${H.emoji} ${H[en ? 'en' : 'tr']}: ${H.fx[en ? 'en' : 'tr']}` + (hit ? ` (${hit} 🌱)` : '') + (safe ? `  ·  ${safe} ${H.guard === 'sera' ? '🏡' : '💦'} ${en ? 'protected' : 'korundu'}` : ''));
  }
  havaModal() {
    const en = getLang() === 'en', L = en ? 'en' : 'tr', F = forecast(Date.now(), 4), H = HAVA[F[0].id], mins = Math.ceil(msToNextSlot() / 60000);
    const { width, height } = this.scale, cx = width / 2, cy = height / 2; const { c, close } = modal(this, 480, 540);
    c.add(txt(this, cx, cy - 225, `${H.emoji} ${H[L]}`, 34, '#ffb71b'));
    c.add(txt(this, cx, cy - 188, H.fx[L], 16, '#cfe8d8'));
    c.add(txt(this, cx, cy - 162, en ? `Changes in ${Math.floor(mins / 60)}h ${mins % 60}m · a new card every 3 hours` : `${Math.floor(mins / 60)} sa ${mins % 60} dk sonra değişir · 3 saatte bir yeni kart`, 14, '#9fb3a8'));
    c.add(txt(this, cx, cy - 122, en ? 'Forecast' : 'Tahmin', 18, '#fff'));
    F.slice(1).forEach((f, i) => {
      const x = cx + (i - 1.5) * 104, W = HAVA[f.id], hh = new Date(f.at).getHours();
      const bad = !!W.guard, g = this.add.graphics(); g.fillStyle(bad ? 0x5a3a3a : 0x3d7a58, 1); g.fillRoundedRect(x - 46, cy - 100, 92, 100, 14); g.lineStyle(3, bad ? 0xff8a6a : 0x9fe870, 0.9); g.strokeRoundedRect(x - 46, cy - 100, 92, 100, 14); c.add(g);
      c.add(txt(this, x, cy - 82, `${String(hh).padStart(2, '0')}:00`, 13, '#cfe8d8'));
      c.add(txt(this, x, cy - 50, W.emoji, 32));
      c.add(txt(this, x, cy - 16, W[L], 13, '#fff'));
    });
    const own = Object.keys(this.nodes).filter((id) => /^tarla/.test(id) && owns(id)), ns = own.filter((id) => hasLayer(id, 'sera')).length, nf = own.filter((id) => hasLayer(id, 'fiskiye')).length;
    c.add(txt(this, cx, cy + 35, en ? 'Your shields' : 'Korumaların', 18, '#fff'));
    c.add(txt(this, cx, cy + 68, `🏡 ${en ? 'Greenhouse' : 'Sera'} ${ns}/${own.length} → 🌨️   ·   💦 ${en ? 'Sprinkler' : 'Fıskiye'} ${nf}/${own.length} → 🔥`, 15, '#cfe8d8'));
    c.add(txt(this, cx, cy + 100, en ? '🌧️ Rain speeds every growing crop' : '🌧️ Yağmur büyüyen her ekini hızlandırır', 14, '#9fe870'));
    const next = F.slice(1).find((f) => HAVA[f.id].guard), weak = next && own.find((id) => !hasLayer(id, HAVA[next.id].guard));
    if (next) c.add(txt(this, cx, cy + 128, en ? `⚠️ ${HAVA[next.id].emoji} ${HAVA[next.id].en} coming — ${HAVA[next.id].guard === 'sera' ? 'greenhouse' : 'sprinkler'} protects` : `⚠️ ${HAVA[next.id].emoji} ${HAVA[next.id].tr} geliyor — ${HAVA[next.id].guard === 'sera' ? 'sera' : 'fıskiye'} korur`, 14, '#ff8a6a'));
    c.add(button(this, cx, cy + 190, 260, 46, weak ? (en ? '🛡️ Add a shield' : '🛡️ Koruma kur') : (en ? '👍 Got it' : '👍 Tamam'), () => { close(); if (weak) this.layersModal(weak); }, 0x5aa83a, '#fff', 18));
  }
  seasonModal() {
    const en = getLang() === 'en', L = en ? 'en' : 'tr', M = mevsim(), N = nextMevsim(), d = daysLeft();
    const { width, height } = this.scale, cx = width / 2, cy = height / 2; const { c, close } = modal(this, 480, 500);
    c.add(txt(this, cx, cy - 205, `${M.emoji} ${M[L]}`, 34, '#ffb71b'));
    c.add(txt(this, cx, cy - 165, en ? `${d} day${d > 1 ? 's' : ''} left · seasons change every Monday` : `${d} gün kaldı · mevsim her pazartesi döner`, 15, '#9fb3a8'));
    c.add(txt(this, cx, cy - 120, en ? 'Season seeds' : 'Mevsim tohumları', 18, '#fff'));
    M.seeds.forEach((k, i) => {
      const x = cx + (i - 1) * 120, S = SEEDS[k];
      const g = this.add.graphics(); g.fillStyle(0x3d7a58, 1); g.fillRoundedRect(x - 50, cy - 95, 100, 90, 16); g.lineStyle(3, 0x9fe870, 0.9); g.strokeRoundedRect(x - 50, cy - 95, 100, 90, 16); c.add(g);
      c.add(txt(this, x, cy - 62, S ? S.emoji : '🌱', 36));
      c.add(txt(this, x, cy - 24, S ? (S.name[getLang()] || S.name.tr) : k, 13, '#fff'));
    });
    c.add(txt(this, cx, cy + 25, en ? '✨ +25% faster growth · +20% sale price' : '✨ %25 daha hızlı büyür · %20 daha pahalı satılır', 16, '#9fe870'));
    c.add(txt(this, cx, cy + 70, en ? `Next: ${N.emoji} ${N[L]}  (${N.seeds.map((k) => SEEDS[k] ? SEEDS[k].emoji : '').join(' ')})` : `Sıradaki: ${N.emoji} ${N[L]}  (${N.seeds.map((k) => SEEDS[k] ? SEEDS[k].emoji : '').join(' ')})`, 16, '#cfe8d8'));
    c.add(txt(this, cx, cy + 105, ORDER.map((k) => MEVSIM[k]).map((x) => x.id === M.id ? `[${x.emoji}]` : x.emoji).join('  →  '), 20, '#fff'));
    const empty = Object.keys(this.nodes).find((id) => /^tarla/.test(id) && owns(id) && cropState(id) === 'empty');
    c.add(button(this, cx, cy + 165, 260, 46, empty ? (en ? '🌱 Plant a season seed' : '🌱 Mevsim tohumu ek') : (en ? '👍 Got it' : '👍 Tamam'), () => { close(); if (empty) this.seedPicker(empty); }, 0x5aa83a, '#fff', 18));
  }
  seasonPass() {
    const { width, height } = this.scale; const cx = width / 2, cy = height / 2;
    const { c, close } = modal(this, 480, 560);
    const p = pass(), tier = tierOf(), left = seasonMsLeft(), d = Math.floor(left / 86400000);
    c.add(txt(this, cx, cy - 245, `🎟️ ${t('passTitle')}`, 30, '#ffb71b'));
    c.add(txt(this, cx, cy - 210, `${t('passTier')} ${tier}/${TIERS}  ·  ${t('festEnds')} ${d}${t('dayShort')}`, 17, '#9fb3a8'));
    const into = tier >= TIERS ? XP_TIER : p.xp % XP_TIER;
    c.add(this.add.rectangle(cx, cy - 182, 360, 14, 0x2a333a));
    c.add(this.add.rectangle(cx - 180, cy - 182, 360 * into / XP_TIER, 14, 0xffb71b).setOrigin(0, 0.5));
    c.add(txt(this, cx, cy - 162, tier >= TIERS ? t('passMax') : `${into}/${XP_TIER} XP`, 14, '#fff'));
    for (let i = 1; i <= TIERS; i++) {
      const x = cx - 180 + ((i - 1) % 5) * 90, y = cy - 118 + Math.floor((i - 1) / 5) * 64;
      const got = p.claimed.includes(i), open = i <= tier && !got;
      const b = this.add.rectangle(x, y, 80, 54, got ? 0x1d5c34 : open ? 0xffb71b : 0x2a333a).setStrokeStyle(2, 0xffffff, open ? 1 : 0.25); c.add(b);
      c.add(txt(this, x, y - 14, String(i), 12, open ? '#04220e' : '#9fb3a8'));
      c.add(txt(this, x, y + 8, got ? '✓' : rewardIcon(reward(i)), 17, open ? '#04220e' : '#fff'));
      if (open) {
        b.setInteractive({ useHandCursor: true });
        b.on('pointerup', () => {
          const r = claim(i); if (!r) return;
          sfx.coin && sfx.coin(); track('pass_claim', { tier: i });
          close(); this.refreshHud(); this.passBadge(86, 364); this.toast(`🎟️ ${rewardIcon(r)}`); this.seasonPass();
        });
      }
    }
    c.add(txt(this, cx, cy + 272 - 40, t('passHint'), 15, '#9fb3a8'));
  }

  drawTitle() {
    this.titleTxt.setText(`${farmTitle()}  ✎`);
  }

  refreshHud() {
    tickLives();
    this.livesTxt.setText(`${save.lives}/${CONFIG.lives.max}`);
    const ms = msToNextLife();
    this.lifeTimer.setText(ms ? fmtMs(ms) : t('full'));
    if (this._coinShown == null) { this._coinShown = save.coins; this.coinsTxt.setText(String(save.coins)); }
    else if (save.coins !== this._coinShown && !this._coinAnim) {
      const from = this._coinShown, to = save.coins; this._coinShown = to;
      if (to > from) {
        this._coinAnim = true;
        const { width, height } = this.scale, src = this.coinFrom || { x: width / 2, y: height / 2 }; this.coinFrom = null;
        flyCoins(this, src.x, src.y, width - 116, 34, Math.ceil((to - from) / 10), () => { sfx.coin && sfx.coin(); haptic('light'); }, () => { this._coinAnim = false; countUp(this, this.coinsTxt, from, to, 450); });
      } else countUp(this, this.coinsTxt, from, to, 300);
    }
    this.gemsTxt.setText(`💎 ${save.gems}`);
    this.starsTxt.setText(`⭐ ${starBalance()}`);
    const hh = havaTick(); if (hh.length) this.havaHits(hh);
    if (this.havaBtn) this.havaBtn.label.setText(hava().emoji);
    if (this.nodes) this.tickCrops();
    if (this.ordBtn) { const n = readyCount(); this.ordBtn.label.setText(n ? `📋 ✓${n}` : '📋'); }
  }

  tryStart(lv) {
    tickLives();
    if (save.lives <= 0) { this.scene.start('Map', { livesModal: true }); return; }
    this.preLevel(lv);
  }
}
Object.assign(Farm.prototype, RegionMixin, BridgeMixin, HandsMixin, LambMixin, GuideMixin, WardrobeMixin, CineMixin);
