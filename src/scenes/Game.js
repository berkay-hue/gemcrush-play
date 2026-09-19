import { CONFIG } from '../config.js';
import { Board, BOSS_EVERY } from '../engine/board.js';
import { bestMove } from '../engine/bot.js';
import { CELL, gemKey } from '../textures.js';
import { save, persist, beginLevel, endLevel, addCoins, spendCoins, recordWin, recordLoss, addLife } from '../meta/save.js';
import { perks, sheepOnLoss } from '../meta/farm.js';
import { winCut, WIN_CUT } from '../meta/crops.js';
import { zoneCut } from '../meta/zones.js';
import { addEnergy } from '../meta/energy.js';
import { startBereket } from '../meta/bereket.js';
import { cure } from '../meta/animals.js';
import { currentQuest } from '../meta/quests.js';
import { t, getLang } from '../i18n.js';
import { showRewarded, maybeInterstitial } from '../monetize/ads.js';
import { track } from '../analytics.js';
import { sfx } from '../sound.js';
import { txt, button, modal, FONT } from '../ui/widgets.js';
import { currentTheme, themeById } from '../meta/themes.js';
import { festWin, festNext, festivalLevels } from '../meta/event.js';
import { addXp, winXp } from '../meta/pass.js';
const BAR_W = 290;

let OX = 14, OY = 210; // board origin (create() ortalar)
const px = (c) => OX + c * CELL + CELL / 2;
const py = (r) => OY + r * CELL + CELL / 2;
const DUR = { swap: 140, clear: 160, fall: 70, combo: 300 };

export class Game extends Phaser.Scene {
  constructor() { super('Game'); }
  init(data) { this.level = data.level; this.vetFor = data.vetFor || null; }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0d1512');
    this.perks = perks();
    this.freeShuffle = this.perks.freeShuffle;
    this.board = new Board(this.level, (Date.now() ^ (this.level.seed * 7919)) >>> 0, this.perks);
    this.board.moves += this.perks.extraMoves;
    this.busy = false; this.ended = false; this.sel = null; this.mode = null; this.idle = 0;
    beginLevel(this.level.id);
    track('level_start', { level: this.level.id, lives: save.lives, coins: save.coins });

    // layers
    OX = Math.round((width - this.board.W * CELL) / 2);
    OY = Math.round(218 + Math.max(0, (832 - 218 - this.board.H * CELL) / 2));
    this.drawScenery();
    this.bg = this.add.container(0, 0);
    this.gemLayer = this.add.container(0, 0);
    this.fx = this.add.container(0, 0).setDepth(50);
    this.sprites = {}; this.overlays = {};
    this.drawBoardBg();
    this.syncBoard();

    // HUD
    const hud = this.add.graphics();
    this.woodPlank(hud, 0, 0, width, 200, 0);
    hud.fillStyle(0xffb71b, 0.9); hud.fillRect(0, 196, width, 4);
    hud.fillStyle(0x000000, 0.25); hud.fillRect(0, 200, width, 6);
    // F16: sol=kuzu maskot, orta=hedefler, sağ=kurt(boss) ya da sepet
    const BX = [104, width - 196];
    for (const bx of BX) {
      hud.fillStyle(0x000000, 0.3); hud.fillRoundedRect(bx, 78, 92, 74, 18);
      hud.fillStyle(0xf5e6c4, 1); hud.fillRoundedRect(bx, 74, 92, 74, 18);
      hud.fillStyle(0xffffff, 0.35); hud.fillRoundedRect(bx + 6, 78, 80, 16, 8);
      hud.lineStyle(3, 0x8a5a2b, 1); hud.strokeRoundedRect(bx, 74, 92, 74, 18);
    }
    hud.fillStyle(0x3a2412, 0.55); hud.fillRoundedRect(width / 2 - 90, 8, 180, 30, 15);
    button(this, 40, 40, 60, 44, '✕', () => this.quit(), 0x2a333a, '#fff', 20);
    this.add.text(width / 2, 22, this.level.festival ? this.level.name : `${t('level')} ${this.level.id}`, { fontFamily: FONT, fontSize: '20px', color: '#ffe8b0', fontStyle: 'bold' }).setOrigin(0.5);
    txt(this, 150, 90, t('moves'), 15, '#8a5a2b'); this.movesTxt = txt(this, 150, 125, '', 38, '#3a2412');
    txt(this, width - 150, 90, t('score'), 15, '#8a5a2b'); this.scoreTxt = txt(this, width - 150, 125, '0', 24, '#c0620a');
    this.objTxt = this.add.container(width / 2, 104);
    this.objIcons = [];
    this.buildObjectives();
    // score bar with star marks
    this.barBg = this.add.rectangle(width / 2, 180, BAR_W + 4, 16, 0x000000, 0.5).setOrigin(0.5).setStrokeStyle(2, 0xffffff, 0.15);
    this.bar = this.add.rectangle(width / 2 - BAR_W / 2, 180, 0, 10, 0xffb71b).setOrigin(0, 0.5);
    this.starMarks = [1, 2, 3].map((i) => this.add.image(width / 2 - BAR_W / 2 + BAR_W * i / 3 - (i === 3 ? 10 : 0), 180, 'stargray').setScale(0.45));
    // maskot kuzu
    this.lambHome = { x: 54, y: 200 };
    this.lamb = this.add.image(54, 200, 'lamb').setOrigin(0.5, 1).setDisplaySize(112, 112).setDepth(30);
    this.lambScale = this.lamb.scaleX;
    this.lambIdle = this.tweens.add({ targets: this.lamb, scaleY: this.lambScale * 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.lamb.setInteractive({ useHandCursor: true }).on('pointerup', () => this.lambMood('happy', 900));
    if (!this.level.boss) this.drawBasket(width - 52, 196);
    if (this.level.boss) this.buildBoss();
    this.refreshHud();

    // boosters bar
    this.boosterBtns = {};
    const boosters = ['hammer', 'moves5', 'shuffle', 'prism'];
    const icons = { hammer: '🔨', moves5: '+5', shuffle: '🔀', prism: '🌈' };
    const shelf = this.add.graphics();
    this.woodPlank(shelf, 0, height - 128, width, 128, 1);
    shelf.fillStyle(0xffb71b, 0.9); shelf.fillRect(0, height - 128, width, 4);
    boosters.forEach((b, i) => {
      const x = 80 + i * 127, y = height - 70;
      const c = button(this, x, y, 110, 74, '', () => this.useBooster(b), 0x2f6b3a, '#fff');
      const ic = txt(this, 0, -12, icons[b], 26); const cnt = txt(this, 0, 20, '', 14, '#ffe58a');
      c.add([ic, cnt]); c.cnt = cnt; c.key = b;
      this.boosterBtns[b] = c;
    });
    this.refreshBoosters();

    // input
    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', () => { this.dragFrom = null; });

    // hint timer
    this.time.addEvent({ delay: 1000, loop: true, callback: () => { if (!this.busy && !this.ended && !this.mode) { this.idle++; if (this.idle === 5) this.showHint(); } } });

    if (this.level.id === 1 && !save.tutorialDone) this.tutorial();
    else if (this.level.id >= 6) this.preLevel();
    // level intro toast
    if (!this.level.boss) this.toast(this.level.name || `${t('level')} ${this.level.id}`, 30);
    const q = currentQuest(); if (q) this.time.delayedCall(1400, () => { if (!this.ended) this.toast(`📜 ${t('questNext')}: ${q.text[getLang()] || q.text.tr}`, 20); });
  }

  // ---------- drawing ----------
  woodPlank(g, x, y, w, h, seed = 0, rad = 0) {
    const cols = [0x9a6534, 0x8c5a2d, 0xa36d3a];
    if (rad) { g.fillStyle(0x8c5a2d, 1); g.fillRoundedRect(x, y, w, h, rad); }
    const n = Math.max(2, Math.round(h / 34)), ph = h / n;
    for (let i = 0; i < n; i++) {
      const yy = y + i * ph, inset = rad && (i === 0 || i === n - 1) ? rad : 0;
      g.fillStyle(cols[(i + seed) % 3], 1); g.fillRect(x + inset, yy, w - inset * 2, ph);
      g.fillStyle(0xffffff, 0.08); g.fillRect(x + inset, yy + 1, w - inset * 2, 3);
      g.fillStyle(0x000000, 0.28); g.fillRect(x + inset, yy + ph - 2, w - inset * 2, 2);
      for (let k = 0; k < 3; k++) { g.fillStyle(0x5e3a1a, 0.18); g.fillRect(x + ((i * 97 + k * 173 + seed * 51) % Math.max(1, w - 60)), yy + ph * (0.35 + k * 0.15), 40 + k * 12, 1.5); }
    }
  }
  drawScenery() {
    const { width, height } = this.scale;
    const g = this.add.graphics();
    const th = this.level.festival ? themeById('sunset') : currentTheme(); // F14: festival = hasat tonları
    g.fillGradientStyle(th.sky[0], th.sky[0], th.sky[1], th.sky[1], 1); g.fillRect(0, 0, width, height * 0.55);
    const sun = this.add.circle(width - 90, 250, 46, th.sun).setAlpha(0.9);
    const halo = this.add.circle(width - 90, 250, 90, th.halo, 0.35);
    this.tweens.add({ targets: halo, scale: 1.15, alpha: 0.2, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const hills = this.add.graphics();
    const hill = (baseY, amp, col, ph) => { hills.fillStyle(col, 1); hills.beginPath(); hills.moveTo(0, height); for (let xx = 0; xx <= width; xx += 10) hills.lineTo(xx, baseY + Math.sin(xx / 90 + ph) * amp); hills.lineTo(width, height); hills.closePath(); hills.fillPath(); };
    hill(height * 0.40, 26, th.hills[0], 0.4);
    // uzak ambar
    hills.fillStyle(0xb8402f, 1); hills.fillRect(60, height * 0.40 - 58, 70, 50); hills.fillTriangle(52, height * 0.40 - 56, 138, height * 0.40 - 56, 95, height * 0.40 - 92);
    hills.fillStyle(0xffffff, 1); hills.fillRect(84, height * 0.40 - 36, 22, 28);
    hill(height * 0.46, 20, th.hills[1], 2.1);
    hill(height * 0.55, 14, th.hills[2], 4.0);
    hills.fillStyle(th.hills[3], 1); hills.fillRect(0, height * 0.6, width, height);
    for (let i = 0; i < 70; i++) { const gx = (i * 67) % width, gy = height * 0.6 + ((i * 131) % (height * 0.4)); hills.fillStyle(i % 2 ? th.grass[0] : th.grass[1], 1); hills.fillTriangle(gx, gy, gx + 4, gy - 12, gx + 8, gy); }
    // çit
    const fy = height * 0.56; hills.fillStyle(0xf1e3c6, 1);
    hills.fillRect(0, fy + 6, width, 5); hills.fillRect(0, fy + 20, width, 5);
    for (let xx = 8; xx < width; xx += 34) { hills.fillRect(xx, fy - 4, 8, 36); hills.fillTriangle(xx, fy - 4, xx + 8, fy - 4, xx + 4, fy - 10); }
    // bulutlar
    for (let i = 0; i < 4; i++) {
      const c = this.add.container(-60 + i * 170, 240 + (i % 2) * 70);
      [[0, 0, 26], [24, -10, 30], [50, 0, 24], [26, 8, 26]].forEach(([dx, dy, r]) => c.add(this.add.circle(dx, dy, r, 0xffffff, 0.92)));
      this.tweens.add({ targets: c, x: c.x + width + 160, duration: 60000 + i * 9000, repeat: -1, onRepeat: () => { c.x = -140; } });
    }
    // uçuşan polen
    for (let i = 0; i < 14; i++) {
      const d = this.add.circle(Math.random() * width, height * (0.3 + Math.random() * 0.6), 2 + Math.random() * 2, th.mote, 0.8);
      this.tweens.add({ targets: d, y: d.y - 40 - Math.random() * 60, x: d.x + (Math.random() - 0.5) * 60, alpha: 0, duration: 3000 + Math.random() * 3000, repeat: -1, delay: Math.random() * 3000 });
    }
    void sun;
  }

  drawBoardBg() {
    const g = this.add.graphics(); this.bg.add(g);
    const W = this.board.W * CELL, H = this.board.H * CELL, x = OX - 10, y = OY - 10;
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x - 8, y + 4, W + 36, H + 36, 26);
    this.woodPlank(g, x - 8, y - 8, W + 36, H + 36, 2, 26);
    g.lineStyle(3, 0xffb71b, 0.9); g.strokeRoundedRect(x - 8, y - 8, W + 36, H + 36, 26);
    g.fillStyle(0x12301f, 0.95); g.fillRoundedRect(x + 2, y + 2, W + 16, H + 16, 18);
    g.fillGradientStyle(0x2d6b45, 0x2d6b45, 0x0f2a1b, 0x0f2a1b, 0.55); g.fillRect(x + 12, y + 8, W - 4, H + 4);
    g.fillStyle(0xffffff, 0.06); g.fillRoundedRect(x + 8, y + 6, W + 4, 26, 12);
    g.lineStyle(2, 0x000000, 0.5); g.strokeRoundedRect(x + 2, y + 2, W + 16, H + 16, 18);
    for (const [nx, ny] of [[x, y], [x + W + 20, y], [x, y + H + 20], [x + W + 20, y + H + 20]]) { g.fillStyle(0x6b4a2a, 1); g.fillCircle(nx, ny, 5); g.fillStyle(0xe8c98f, 1); g.fillCircle(nx - 1, ny - 1, 2.5); }
    for (let r = 0; r < this.board.H; r++) for (let c = 0; c < this.board.W; c++) {
      if (this.board.hole[r][c]) continue;
      this.bg.add(this.add.image(px(c), py(r), (r + c) % 2 ? 'tile2' : 'tile'));
    }
  }
  overlayKey(r, c) {
    const b = this.board;
    if (b.rock[r][c]) return b.rock[r][c] >= 2 ? 'rock2' : 'rock1';
    if (b.fence[r][c]) return 'fence';
    if (b.mud[r][c]) return 'mud';
    if (b.jelly[r][c]) return b.jelly[r][c] >= 2 ? 'jelly2' : 'jelly1';
    return null;
  }
  syncBoard() {
    for (const k in this.sprites) { this.sprites[k].destroy(); }
    for (const k in this.overlays) { this.overlays[k].destroy(); }
    this.sprites = {}; this.overlays = {};
    const b = this.board;
    for (let r = 0; r < b.H; r++) for (let c = 0; c < b.W; c++) {
      if (b.hole[r][c]) continue;
      const ok = this.overlayKey(r, c);
      if (ok && ok.startsWith('jelly')) this.overlays[r * 100 + c] = this.add.image(px(c), py(r), ok); // jelly under gem
      const g = b.cells[r][c];
      if (g) this.sprites[r * 100 + c] = this.mkGem(r, c, g);
      if (ok && !ok.startsWith('jelly')) this.overlays[r * 100 + c] = this.add.image(px(c), py(r), ok);
      if (g && g.locked && g.type >= 0) { const l = this.add.image(px(c), py(r), 'lock'); this.overlays[(r * 100 + c) + 10000] = l; }
      if (g && b.ice[r][c]) this.overlays[(r * 100 + c) + 20000] = this.add.image(px(c), py(r), `ice${Math.min(2, b.ice[r][c])}`);
    }
    this.children.bringToTop(this.fx);
  }
  mkGem(r, c, g) {
    const s = this.add.image(px(c), py(r), gemKey(g));
    s.gemType = g.type; s.special = g.special;
    if (g.special) {
      const col = g.special === 'prism' ? 0xffffff : (CONFIG.gemColors[g.type] ?? 0xffffff);
      const a = this.add.image(s.x, s.y, 'glow').setTint(col).setAlpha(0.55).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD);
      this.children.moveBelow(a, s); s.aura = a;
      this.tweens.add({ targets: a, scale: 0.85, alpha: 0.25, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.InOut' });
      s.once('destroy', () => a.destroy());
      if (g.special === 'prism') this.tweens.add({ targets: s, angle: 360, duration: 5000, repeat: -1 });
      else this.tweens.add({ targets: s, scale: 1.07, yoyo: true, repeat: -1, duration: 450, ease: 'Sine.InOut' });
    }
    return s;
  }
  update() {
    for (const k in this.sprites) { const s = this.sprites[k]; if (s.aura) { s.aura.x = s.x; s.aura.y = s.y; } }
  }
  refreshHud() {
    const b = this.board;
    this.movesTxt.setText(String(b.moves));
    this.movesTxt.setColor(b.moves <= 5 ? '#e0203c' : '#3a2412');
    if (b.moves <= 5 && b.moves > 0 && !this.movesPulse) this.movesPulse = this.tweens.add({ targets: this.movesTxt, scale: 1.18, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    if ((b.moves > 5 || b.moves === 0) && this.movesPulse) { this.movesPulse.stop(); this.movesPulse = null; this.movesTxt.setScale(1); }
    this.scoreTxt.setText(String(b.score));
    if (this.lamb && !this.ended && this.lamb.texture.key !== 'lamb_happy') this.lamb.setTexture(b.moves <= 3 ? 'lamb_scared' : 'lamb');
    this.tweens.add({ targets: this.bar, width: BAR_W * b.objFrac(), duration: 250, ease: 'Cubic.Out' });
    if (this.bossBar) { const hp = Math.max(0, 1 - b.objFrac()); this.tweens.add({ targets: this.bossBar, width: 196 * hp, duration: 300 }); this.bossTurn.setText(`⚡${BOSS_EVERY - (b.used % BOSS_EVERY)}`); }
    const st = b.stars();
    this.starMarks.forEach((m, i) => {
      const on = st >= i + 1;
      if (on && m.texture.key !== 'star') { m.setTexture('star'); this.tweens.add({ targets: m, scale: 0.75, yoyo: true, duration: 180, ease: 'Back.Out' }); sfx.special && sfx.special(); this.starEarnFx(m.x, m.y); }
    });
    const prog = b.progress();
    prog.forEach((p, i) => { const o = this.objIcons[i]; if (o) { o.lbl.setText(`${Math.min(p.current, p.target)}/${p.target}`); if (p.current >= p.target && !o.check.visible) { o.check.setVisible(true).setScale(0); this.tweens.add({ targets: o.check, scale: 1, duration: 300, ease: 'Back.Out' }); this.ringAt(this.objTxt.x + o.x, this.objTxt.y + o.y, 0x2ee06a); } } });
  }
  buildObjectives() {
    const prog = this.board.progress();
    const n = prog.length; const gap = n >= 3 ? 66 : 84;
    prog.forEach((p, i) => {
      const x = (i - (n - 1) / 2) * gap;
      const c = this.add.container(x, 0);
      let icon;
      if (p.kind === 'collect') icon = this.add.image(0, 0, `gem${p.gemType}`).setScale(0.6);
      else if (p.kind === 'jelly') icon = this.add.image(0, 0, 'jelly2').setScale(0.6);
      else if (p.kind === 'rock') icon = this.add.image(0, 0, 'rock2').setScale(0.6);
      else if (p.kind === 'lock') icon = this.add.image(0, 0, 'lock').setScale(0.6);
      else if (p.kind === 'ice') icon = this.add.image(0, 0, 'ice2').setScale(0.6);
      else if (p.kind === 'fence') icon = this.add.image(0, 0, 'fence').setScale(0.6);
      else if (p.kind === 'mud') icon = this.add.image(0, 0, 'mud').setScale(0.6);
      else icon = txt(this, 0, 0, '🏆', 28);
      const lbl = txt(this, 0, 34, '', 16, '#fff');
      const check = txt(this, 22, -18, '✔', 18, '#2ee06a').setVisible(false);
      c.add([icon, lbl, check]); c.lbl = lbl; c.check = check;
      this.objTxt.add(c); this.objIcons.push(c);
    });
  }
  refreshBoosters() {
    for (const k in this.boosterBtns) {
      const n = save.boosters[k] || 0;
      this.boosterBtns[k].cnt.setText(n > 0 ? `x${n}` : `🪙${CONFIG.boosters[k]}`);
    }
  }

  // ---------- input ----------
  cellAt(p) {
    const c = Math.floor((p.x - OX) / CELL), r = Math.floor((p.y - OY) / CELL);
    if (r < 0 || c < 0 || r >= this.board.H || c >= this.board.W || this.board.hole[r][c]) return null;
    return [r, c];
  }
  onDown(p) {
    if (this.busy || this.ended) return;
    const cell = this.cellAt(p); if (!cell) return;
    this.idle = 0; this.hideHint();
    if (this.mode) { this.applyBoosterAt(cell); return; }
    if (this.sel) {
      const [r, c] = this.sel;
      if (Math.abs(r - cell[0]) + Math.abs(c - cell[1]) === 1) { this.trySwap(this.sel, cell); return; }
    }
    this.select(cell); this.dragFrom = cell;
  }
  onMove(p) {
    if (!this.dragFrom || this.busy || this.ended || this.mode) return;
    const [r, c] = this.dragFrom;
    const dx = p.x - px(c), dy = p.y - py(r);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.45) return;
    const to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
    this.dragFrom = null;
    if (to[0] < 0 || to[1] < 0 || to[0] >= this.board.H || to[1] >= this.board.W || this.board.hole[to[0]][to[1]]) return;
    this.trySwap([r, c], to);
  }
  select(cell) {
    this.clearSel();
    this.sel = cell;
    this.selRect = this.add.rectangle(px(cell[1]), py(cell[0]), CELL - 4, CELL - 4).setStrokeStyle(4, 0xffffff, 0.9).setDepth(40);
  }
  clearSel() { this.sel = null; if (this.selRect) { this.selRect.destroy(); this.selRect = null; } }

  async trySwap(a, b) {
    this.clearSel(); this.dragFrom = null;
    const sa = this.sprites[a[0] * 100 + a[1]], sb = this.sprites[b[0] * 100 + b[1]];
    if (!sa || !sb) return;
    const events = this.board.playSwap(a[0], a[1], b[0], b[1]);
    const lk = (q) => this.board.cells[q[0]][q[1]]?.locked;
    if (lk(a) || lk(b)) { // kilitli taş yerinden oynamaz; yalnız kilit tıkırdar
      sfx.bad();
      for (const q of [a, b]) if (lk(q)) { const l = this.overlays[q[0] * 100 + q[1] + 10000]; if (l && !l.rattling) { l.rattling = true; this.tweens.add({ targets: l, angle: { from: -7, to: 7 }, duration: 55, yoyo: true, repeat: 2, onComplete: () => { l.angle = 0; l.rattling = false; } }); } }
      return;
    }
    if (!events) {
      this.busy = true; sfx.bad();
      await this.tw([{ targets: sa, x: px(b[1]), y: py(b[0]), duration: DUR.swap, yoyo: true }, { targets: sb, x: px(a[1]), y: py(a[0]), duration: DUR.swap, yoyo: true }]);
      this.busy = false; return;
    }
    await this.runEvents(events);
  }

  // ---------- animation queue ----------
  tw(list) {
    return Promise.all(list.map((cfg) => new Promise((res) => this.tweens.add({ ...cfg, onComplete: res }))));
  }
  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }

  async runEvents(events) {
    this.busy = true;
    let maxCascade = 0;
    for (const e of events) {
      switch (e.type) {
        case 'swap': {
          const sa = this.sprites[e.from[0] * 100 + e.from[1]], sb = this.sprites[e.to[0] * 100 + e.to[1]];
          sfx.swap();
          await this.tw([sa && { targets: sa, x: px(e.to[1]), y: py(e.to[0]), duration: DUR.swap }, sb && { targets: sb, x: px(e.from[1]), y: py(e.from[0]), duration: DUR.swap }].filter(Boolean));
          this.sprites[e.from[0] * 100 + e.from[1]] = sb; this.sprites[e.to[0] * 100 + e.to[1]] = sa;
          break;
        }
        case 'combo': {
          if (e.kind === 'single') { sfx.combo(); await this.wait(60); break; }
          sfx.combo(); this.comboFx(px(e.at[1]), py(e.at[0]), e.kind); this.lambMood('happy', 1100);
          this.toast(e.kind === 'prism_prism' ? t('legendary') : t('amazing'), 44);
          await this.wait(DUR.combo + 150);
          break;
        }
        case 'convert': { const s = this.sprites[e.at[0] * 100 + e.at[1]]; if (s) { s.setTexture(`gem${s.gemType}_${e.special}`); s.special = e.special; } break; }
        case 'match': {
          maxCascade = Math.max(maxCascade, e.cascade);
          sfx.match(e.cascade);
          this.floatScore(e.cells, e.score);
          if (e.cascade >= 2) this.cascadeFx(e.cells, e.cascade);
          break;
        }
        case 'spawn_special': {
          await this.wait(DUR.clear);
          const s = this.sprites[e.at[0] * 100 + e.at[1]];
          const g = { type: e.gemType, special: e.special };
          if (s) s.destroy();
          const n = this.mkGem(e.at[0], e.at[1], g); n.setScale(0.2);
          this.sprites[e.at[0] * 100 + e.at[1]] = n;
          sfx.special(); this.tweens.add({ targets: n, scale: 1, duration: 200, ease: 'Back.Out' });
          this.specialBirth(n.x, n.y, e.gemType);
          break;
        }
        case 'specials_fire': {
          let ms = 200;
          for (const h of e.hits) { const s = this.sprites[h.at[0] * 100 + h.at[1]]; ms = Math.max(ms, this.fireFx(px(h.at[1]), py(h.at[0]), h.special, s && s.gemType)); }
          sfx.special(); await this.wait(ms);
          break;
        }
        case 'rock_hit': { sfx.rock(); this.updOverlay(e.at); this.shake(e.at); break; }
        case 'jelly_hit': { this.updOverlay(e.at); break; }
        case 'fence_hit': case 'mud_hit': { sfx.rock(); this.updOverlay(e.at); break; }
        case 'ice_hit': { sfx.rock(); this.updIce(e.at); break; }
        case 'mud_spread': {
          const k = e.at[0] * 100 + e.at[1]; const s = this.sprites[k];
          if (s) { delete this.sprites[k]; this.tweens.add({ targets: s, scale: 0, duration: 200, onComplete: () => s.destroy() }); }
          const m = this.add.image(px(e.at[1]), py(e.at[0]), 'mud').setScale(0.2); this.overlays[k] = m;
          this.tweens.add({ targets: m, scale: 1, duration: 260, ease: 'Back.Out' }); await this.wait(260); break;
        }
        case 'boss_attack': { await this.bossAttackFx(e.cells); break; }
        case 'unlock': { const l = this.overlays[e.at[0] * 100 + e.at[1] + 10000]; if (l) { this.tweens.add({ targets: l, alpha: 0, scale: 1.5, duration: 200, onComplete: () => l.destroy() }); delete this.overlays[e.at[0] * 100 + e.at[1] + 10000]; }
          const s = this.sprites[e.at[0] * 100 + e.at[1]]; const g = this.board.cells[e.at[0]][e.at[1]]; if (s && g) s.setTexture(gemKey(g)); break; }
        case 'clear': {
          const tws = []; let flyN = 0;
          for (const [r, c] of e.cells) {
            const s = this.sprites[r * 100 + c];
            if (!s) continue;
            delete this.sprites[r * 100 + c];
            this.burst(s.x, s.y, s.gemType, e.reason);
            if (flyN < 8 && this.flyToGoal(s.x, s.y, s.gemType)) flyN++;
            tws.push({ targets: s, scale: 1.3, alpha: 0, duration: DUR.clear, ease: 'Quad.Out', onComplete: () => s.destroy() });
          }
          if (tws.length) await this.tw(tws);
          break;
        }
        case 'fall': {
          sfx.fall();
          const tws = [];
          const moved = {};
          for (const f of e.falls) { const s = this.sprites[f.from[0] * 100 + f.from[1]]; if (!s) continue; delete this.sprites[f.from[0] * 100 + f.from[1]]; moved[f.to[0] * 100 + f.to[1]] = s; }
          Object.assign(this.sprites, moved);
          for (const k in moved) { const s = moved[k]; const r = Math.floor(k / 100), c = k % 100; tws.push({ targets: s, y: py(r), duration: DUR.fall * Math.max(1, Math.abs(py(r) - s.y) / CELL), ease: 'Quad.In', onComplete: () => this.land(s) }); }
          const maxAbove = {};
          for (const sp of e.spawns) maxAbove[sp.at[1]] = Math.max(maxAbove[sp.at[1]] || 0, sp.fromAbove);
          for (const sp of e.spawns) {
            const [r, c] = sp.at;
            // tahtanın SON hâli değil, bu olaydaki gerçek renk (yoksa zincir sonunda renk değişiyordu)
            const s = this.mkGem(r, c, { type: sp.gemType, special: null, locked: false });
            s.y = py(r - maxAbove[c]);
            this.sprites[r * 100 + c] = s;
            tws.push({ targets: s, y: py(r), duration: DUR.fall * maxAbove[c], ease: 'Quad.In', onComplete: () => this.land(s) });
          }
          this.children.bringToTop(this.fx);
          if (tws.length) await this.tw(tws);
          break;
        }
        case 'shuffle': { this.toast(t('shuffle'), 36); await this.wait(250); this.syncBoard(); break; }
      }
    }
    this.syncBoard(); // authoritative resync
    this.refreshHud();
    if (maxCascade >= 3) this.toast(maxCascade >= 5 ? t('legendary') : t('great'), 40);
    this.busy = false;
    this.checkEnd();
  }

  // ---------- fx ----------
  spawnFx(x, y, key, opts = {}) {
    const p = this.add.image(x, y, key); this.fx.add(p);
    if (opts.tint !== undefined) p.setTint(opts.tint);
    if (opts.add) p.setBlendMode(Phaser.BlendModes.ADD);
    if (opts.scale !== undefined) p.setScale(opts.scale);
    if (opts.alpha !== undefined) p.setAlpha(opts.alpha);
    if (opts.angle !== undefined) p.setAngle(opts.angle);
    return p;
  }
  // gem destroyed: glow pop + coloured shards + white sparks
  burst(x, y, type, reason) {
    const col = CONFIG.gemColors[type] ?? 0xffffff;
    const big = reason && reason !== 'match';
    const glow = this.spawnFx(x, y, 'glow', { tint: col, add: true, scale: 0.3, alpha: 0.9 });
    this.tweens.add({ targets: glow, scale: big ? 1.3 : 0.9, alpha: 0, duration: 260, ease: 'Quad.Out', onComplete: () => glow.destroy() });
    const n = big ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const p = this.spawnFx(x, y, 'shard', { tint: col, scale: 0.5 + Math.random() * 0.6, angle: Math.random() * 360 });
      const a = (Math.PI * 2 / n) * i + Math.random() * 0.6, d = 38 + Math.random() * 42;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + 26, angle: p.angle + 180 + Math.random() * 180, alpha: 0, scale: 0.1, duration: 380 + Math.random() * 220, ease: 'Quad.Out', onComplete: () => p.destroy() });
    }
    for (let i = 0; i < 4; i++) {
      const p = this.spawnFx(x, y, 'spark', { add: true, scale: 0.25 + Math.random() * 0.35 });
      const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 30;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, angle: 90, alpha: 0, scale: 0, duration: 300 + Math.random() * 150, onComplete: () => p.destroy() });
    }
  }
  // landing squash & stretch
  land(s) {
    if (!s.active) return;
    const base = s.special ? s.scaleX : 1;
    this.tweens.add({ targets: s, scaleX: base * 1.14, scaleY: base * 0.82, duration: 70, yoyo: true, ease: 'Quad.Out', onComplete: () => s.active && s.setScale(base) });
  }
  // a special gem fires: returns ms to wait before the clear
  fireFx(x, y, kind, type) {
    const col = CONFIG.gemColors[type] ?? 0xffffff;
    if (kind === 'line_h' || kind === 'line_v') { this.beam(x, y, kind === 'line_h' ? 'h' : 'v', col); return 260; }
    if (kind === 'bomb') { this.shockwave(x, y, col, 1); return 320; }
    if (kind === 'prism') { this.prismWave(x, y); return 420; }
    this.shockwave(x, y, col, 0.6); return 200;
  }
  beam(x, y, dir, col) {
    const W = this.board.W * CELL, H = this.board.H * CELL;
    const cx = OX + W / 2, cy = OY + H / 2;
    const len = dir === 'h' ? W : H;
    const b = this.spawnFx(dir === 'h' ? cx : x, dir === 'h' ? y : cy, 'beam', { tint: col, add: true, alpha: 0 });
    b.setDisplaySize(len + 40, 60); if (dir === 'v') b.setAngle(90);
    const core = this.spawnFx(b.x, b.y, 'beam', { add: true, alpha: 0 });
    core.setDisplaySize(len + 40, 22); if (dir === 'v') core.setAngle(90);
    this.tweens.add({ targets: [b, core], alpha: 1, duration: 60, yoyo: true, hold: 120, onComplete: () => { b.destroy(); core.destroy(); } });
    // two flares racing to the edges
    for (const sgn of [-1, 1]) {
      const f = this.spawnFx(x, y, 'flare', { tint: col, add: true, scale: 0.9 });
      const tx = dir === 'h' ? x + sgn * len / 2 : x, ty = dir === 'v' ? y + sgn * len / 2 : y;
      this.tweens.add({ targets: f, x: tx, y: ty, angle: 180, duration: 220, ease: 'Quad.Out', onComplete: () => f.destroy() });
      this.tweens.add({ targets: f, alpha: 0, delay: 140, duration: 100 });
    }
    // sparks along the line
    for (let i = 0; i < 10; i++) {
      const t = (i + 0.5) / 10, sx = dir === 'h' ? OX + t * W : x + (Math.random() - 0.5) * 30, sy = dir === 'v' ? OY + t * H : y + (Math.random() - 0.5) * 30;
      const p = this.spawnFx(sx, sy, 'spark', { add: true, scale: 0.2, alpha: 0 });
      this.tweens.add({ targets: p, alpha: 1, scale: 0.6, delay: 40 + Math.random() * 120, duration: 90, yoyo: true, onComplete: () => p.destroy() });
    }
    this.cameras.main.shake(140, 0.006);
  }
  shockwave(x, y, col, k = 1) {
    const flash = this.spawnFx(x, y, 'glow', { tint: 0xffffff, add: true, scale: 0.2, alpha: 1 });
    this.tweens.add({ targets: flash, scale: 2.2 * k, alpha: 0, duration: 320, ease: 'Cubic.Out', onComplete: () => flash.destroy() });
    const heat = this.spawnFx(x, y, 'glow', { tint: col, add: true, scale: 0.5, alpha: 0.9 });
    this.tweens.add({ targets: heat, scale: 3 * k, alpha: 0, duration: 420, ease: 'Quad.Out', onComplete: () => heat.destroy() });
    for (let i = 0; i < 2; i++) {
      const ring = this.spawnFx(x, y, 'ring', { tint: i ? col : 0xffffff, add: true, scale: 0.2, alpha: 0.95 });
      this.tweens.add({ targets: ring, scale: (2.6 + i * 0.8) * k, alpha: 0, delay: i * 70, duration: 380, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    }
    for (let i = 0; i < 14; i++) {
      const p = this.spawnFx(x, y, i % 3 ? 'shard' : 'spark', { tint: i % 2 ? col : 0xffffff, add: i % 3 === 0, scale: 0.5 + Math.random() * 0.7, angle: Math.random() * 360 });
      const a = (Math.PI * 2 / 14) * i, d = (70 + Math.random() * 70) * k;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + 30, angle: p.angle + 360, alpha: 0, scale: 0, duration: 450 + Math.random() * 200, ease: 'Quad.Out', onComplete: () => p.destroy() });
    }
    this.cameras.main.shake(200 * k, 0.012 * k);
    this.cameras.main.flash(120, 255, 255, 255, false);
  }
  prismWave(x, y) {
    const cols = [0xff4d6d, 0xffb000, 0x3dff7a, 0x3fa9ff, 0xc86bff, 0xffffff];
    cols.forEach((c, i) => {
      const ring = this.spawnFx(x, y, 'ring', { tint: c, add: true, scale: 0.1, alpha: 1 });
      this.tweens.add({ targets: ring, scale: 9, alpha: 0, delay: i * 45, duration: 520, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    });
    const core = this.spawnFx(x, y, 'flare', { add: true, scale: 0.4 });
    this.tweens.add({ targets: core, scale: 3, angle: 180, alpha: 0, duration: 450, ease: 'Quad.Out', onComplete: () => core.destroy() });
    for (let i = 0; i < 20; i++) {
      const p = this.spawnFx(x, y, 'spark', { tint: cols[i % cols.length], add: true, scale: 0.3 + Math.random() * 0.5 });
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 160;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, angle: 360, alpha: 0, duration: 400 + Math.random() * 250, ease: 'Quad.Out', onComplete: () => p.destroy() });
    }
    this.cameras.main.shake(260, 0.012);
    this.cameras.main.flash(180, 255, 255, 255, false);
  }
  comboFx(x, y, kind) {
    if (kind === 'prism_prism') { this.prismWave(x, y); this.shockwave(x, y, 0xffffff, 1.6); }
    else if (kind.startsWith('prism')) this.prismWave(x, y);
    else if (kind.includes('bomb')) this.shockwave(x, y, 0xffffff, kind === 'bomb_bomb' ? 1.8 : 1.2);
    else { this.beam(x, y, 'h', 0xffffff); this.beam(x, y, 'v', 0xffffff); }
  }
  flash(x, y, kind) { this.fireFx(x, y, kind, undefined); }
  particles(x, y, type) { this.burst(x, y, type, 'match'); }
  floatScore(cells, score) {
    const [r, c] = cells[Math.floor(cells.length / 2)];
    const big = score >= 300;
    const tx = txt(this, px(c), py(r), `+${score}`, big ? 34 : 24, big ? '#ffd23f' : '#ffe58a').setDepth(60).setStroke('#2a1200', big ? 8 : 5).setScale(0.4);
    this.tweens.add({ targets: tx, scale: 1, duration: 160, ease: 'Back.Out' });
    this.tweens.add({ targets: tx, y: py(r) - 64, alpha: 0, delay: 200, duration: 550, ease: 'Quad.In', onComplete: () => tx.destroy() });
  }
  // F3: çağlayan sayacı — her zincirde büyüyen "Zincir xN"
  cascadeFx(cells, n) {
    const [r, c] = cells[Math.floor(cells.length / 2)];
    const cols = ['#9dffb8', '#7fe0ff', '#ffd23f', '#ff9a3c', '#ff4d9a'];
    const tx = txt(this, px(c), py(r) - 30, `${t('chain')} x${n}`, 20 + Math.min(n, 6) * 3, cols[Math.min(n - 2, cols.length - 1)]).setDepth(61).setStroke('#1a0a00', 6).setScale(0.2);
    this.tweens.add({ targets: tx, scale: 1, duration: 180, ease: 'Back.Out' });
    this.tweens.add({ targets: tx, y: tx.y - 50, alpha: 0, delay: 380, duration: 420, onComplete: () => tx.destroy() });
    if (n >= 4) { const cam = this.cameras.main; cam.shake(120 + n * 20, 0.003 * Math.min(n, 7)); this.tweens.add({ targets: cam, zoom: 1.03, duration: 90, yoyo: true }); }
  }
  // F3: toplanan taş hedef sayacına uçar
  flyToGoal(x, y, type) {
    const i = this.board.progress().findIndex((p) => p.kind === 'collect' && p.gemType === type && p.current < p.target);
    const o = i >= 0 && this.objIcons[i]; if (!o) return false;
    const tx = this.objTxt.x + o.x, ty = this.objTxt.y + o.y;
    const g = this.add.image(x, y, `gem${type}`).setScale(0.55).setDepth(80);
    const tr = this.add.image(x, y, 'glow').setTint(CONFIG.gemColors[type] ?? 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.7).setDepth(79);
    const mx = (x + tx) / 2 + (Math.random() - 0.5) * 160, my = Math.min(y, ty) - 60;
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(tx, ty));
    const st = { t: 0 };
    this.tweens.add({ targets: st, t: 1, duration: 520 + Math.random() * 120, ease: 'Quad.In',
      onUpdate: () => { const pt = curve.getPoint(st.t); g.setPosition(pt.x, pt.y).setScale(0.55 - st.t * 0.2); tr.setPosition(pt.x, pt.y); },
      onComplete: () => { g.destroy(); tr.destroy(); this.tweens.add({ targets: o, scale: 1.25, duration: 70, yoyo: true }); this.ringAt(tx, ty, CONFIG.gemColors[type], 0.4); } });
    return true;
  }
  ringAt(x, y, col = 0xffffff, k = 0.6, parent) {
    const ring = this.add.image(x, y, 'ring').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setScale(0.1).setAlpha(0.95).setDepth(81);
    if (parent) parent.add(ring);
    this.tweens.add({ targets: ring, scale: 1.4 * k, alpha: 0, duration: 360, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
  }
  specialBirth(x, y, type) {
    const col = CONFIG.gemColors[type] ?? 0xffffff;
    this.ringAt(x, y, col, 0.9); this.ringAt(x, y, 0xffffff, 0.6);
    const f = this.spawnFx(x, y, 'flare', { tint: col, add: true, scale: 0.2 });
    this.tweens.add({ targets: f, scale: 1.2, angle: 90, alpha: 0, duration: 380, ease: 'Quad.Out', onComplete: () => f.destroy() });
  }
  starEarnFx(x, y, parent) {
    const add = (o) => { if (parent) parent.add(o); else o.setDepth(82); return o; };
    const g = add(this.add.image(x, y, 'glow').setTint(0xffd23f).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(1));
    this.tweens.add({ targets: g, scale: parent ? 2.4 : 1.4, alpha: 0, duration: 520, ease: 'Quad.Out', onComplete: () => g.destroy() });
    for (let i = 0; i < 10; i++) {
      const p = add(this.add.image(x, y, 'spark').setTint(i % 2 ? 0xffd23f : 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3 + Math.random() * 0.3));
      const a = (Math.PI * 2 / 10) * i, d = (parent ? 70 : 36) + Math.random() * 30;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, angle: 180, duration: 420 + Math.random() * 200, ease: 'Quad.Out', onComplete: () => p.destroy() });
    }
  }
  // F3: kalan hamleler hamle sayacından tahtaya roket olarak uçar, patlar (bonus skor)
  async victoryFx(left) {
    this.toast(t('win'), 44);
    const n = Math.min(left, 12); if (!n) { await this.wait(500); return; }
    await this.wait(450);
    const sx = this.movesTxt.x, sy = this.movesTxt.y;
    for (let i = 0; i < n; i++) {
      const r = Math.floor(Math.random() * this.board.H), c = Math.floor(Math.random() * this.board.W);
      const x = px(c), y = py(r), col = CONFIG.gemColors[i % 6];
      const rk = this.spawnFx(sx, sy, 'flare', { tint: col, add: true, scale: 0.5 });
      this.tweens.add({ targets: rk, x, y, angle: 360, duration: 300, ease: 'Quad.In', onComplete: () => { rk.destroy(); this.shockwave(x, y, col, 0.45); sfx.match(Math.min(i + 1, 6)); this.floatScore([[r, c]], 200); } });
      this.movesTxt.setText(String(left - i - 1));
      await this.wait(110);
    }
    await this.wait(550);
  }
  confetti(parent) {
    const { width, height } = this.scale;
    for (let i = 0; i < 40; i++) {
      const p = this.add.rectangle(width / 2 + (Math.random() - 0.5) * 120, height / 2 - 200, 8 + Math.random() * 6, 12 + Math.random() * 8, CONFIG.gemColors[i % 6]).setAngle(Math.random() * 360);
      parent.add(p);
      this.tweens.add({ targets: p, x: p.x + (Math.random() - 0.5) * 560, y: height / 2 + 150 + Math.random() * 250, angle: p.angle + 540 + Math.random() * 360, alpha: { from: 1, to: 0 }, delay: Math.random() * 300, duration: 1300 + Math.random() * 900, ease: 'Cubic.Out', onComplete: () => p.destroy() });
    }
  }
  shake(at) { const o = this.overlays[at[0] * 100 + at[1]]; if (o) this.tweens.add({ targets: o, x: o.x + 4, duration: 40, yoyo: true, repeat: 3 }); }
  updIce(at) {
    const k = at[0] * 100 + at[1] + 20000; const o = this.overlays[k]; if (o) { o.destroy(); delete this.overlays[k]; }
    const lv = this.board.ice[at[0]][at[1]];
    if (lv) this.overlays[k] = this.add.image(px(at[1]), py(at[0]), `ice${Math.min(2, lv)}`);
    else this.particles(px(at[1]), py(at[0]), 6);
  }
  async bossAttackFx(cells) {
    await this.wolfLunge(false);
    this.toast(t('bossAttack'), 30);
    for (const [r, c] of cells) {
      const k = r * 100 + c + 20000; if (this.overlays[k]) this.overlays[k].destroy();
      const o = this.add.image(px(c), py(r), 'ice1').setScale(2).setAlpha(0); this.overlays[k] = o;
      this.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 280, ease: 'Quad.In' });
    }
    await this.wait(320);
  }
  updOverlay(at) {
    const k = at[0] * 100 + at[1]; const o = this.overlays[k]; if (o) { o.destroy(); delete this.overlays[k]; }
    const nk = this.overlayKey(at[0], at[1]);
    if (nk) { const n = this.add.image(px(at[1]), py(at[0]), nk); this.overlays[k] = n; if (nk.startsWith('jelly')) this.children.sendToBack(n), this.children.moveAbove(n, this.bg); }
    else this.particles(px(at[1]), py(at[0]), 5);
  }
  toast(s, size = 32) {
    const { width } = this.scale;
    const y = OY + this.board.H * CELL / 2;
    const glow = this.add.image(width / 2, y, 'glow').setTint(0xffb71b).setBlendMode(Phaser.BlendModes.ADD).setDepth(69).setScale(0).setAlpha(0.8);
    const tx = txt(this, width / 2, y, s, size, '#fff3c4').setDepth(70).setStroke('#7a3b00', 8).setShadow(0, 6, '#000', 8, true, true).setScale(0.3).setAngle(-6);
    this.tweens.add({ targets: glow, scale: 3.5, alpha: 0, duration: 500, ease: 'Quad.Out', onComplete: () => glow.destroy() });
    this.tweens.add({ targets: tx, scale: 1.15, angle: 3, duration: 260, ease: 'Back.Out', onComplete: () => this.tweens.add({ targets: tx, alpha: 0, y: tx.y - 50, scale: 1.3, delay: 450, duration: 300, onComplete: () => tx.destroy() }) });
  }
  showHint() {
    const m = bestMove(this.board, 0); if (!m) return;
    this.hint = [this.sprites[m[0] * 100 + m[1]], this.sprites[m[2] * 100 + m[3]]].filter(Boolean);
    this.hintTw = this.tweens.add({ targets: this.hint, scale: 1.15, yoyo: true, repeat: -1, duration: 350 });
  }
  hideHint() { if (this.hintTw) { this.hintTw.stop(); this.hint.forEach((s) => s.active && s.setScale(1)); this.hintTw = null; } }

  // ---------- F13: boss + seviye öncesi güçlendirici ----------
  buildBoss() {
    const { width } = this.scale;
    const x = width / 2 - 100, y = 56;
    this.add.rectangle(x + 100, y, 200, 14, 0x000000, 0.55).setStrokeStyle(2, 0x9b4dff, 0.9);
    this.bossBar = this.add.rectangle(x + 2, y, 196, 10, 0xe0203c).setOrigin(0, 0.5);
    this.add.image(x - 18, y, 'wolf').setDisplaySize(36, 36);
    this.bossTurn = txt(this, x + 226, y, '', 16, '#e7c6ff');
    this.wolfHome = { x: width - 54, y: 200 };
    this.boss = this.add.image(this.wolfHome.x, this.wolfHome.y, 'wolf').setOrigin(0.5, 1).setDisplaySize(116, 116).setDepth(30);
    this.wolfScale = this.boss.scaleX;
    this.wolfIdle = this.tweens.add({ targets: this.boss, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.InOut' });
    if (this.level.id < 6) this.time.delayedCall(300, () => this.bossIntro());
  }
  // kurt tahtanın ortasına fırlar, kuzuya "hamm" diye atılır, sonra köşesine çekilir
  bossIntro() {
    if (this.introDone || this.ended) return; this.introDone = true; this.busy = true;
    const { width } = this.scale;
    const cy = OY + this.board.H * CELL / 2;
    const dim = this.add.rectangle(width / 2, this.scale.height / 2, width, this.scale.height, 0x000000, 0).setDepth(80);
    const L = this.add.image(width / 2 - 120, cy + 150, 'lamb_scared').setOrigin(0.5, 1).setDisplaySize(190, 190).setDepth(82).setAlpha(0);
    const Wf = this.add.image(width + 200, cy + 130, 'wolf').setOrigin(0.5, 1).setDisplaySize(330, 330).setDepth(83);
    const ws = Wf.scaleX;
    const cap = txt(this, width / 2, cy - 250, t('bossIntro') || 'Kurt geldi!', 40, '#ffe0e0').setStroke('#5a0010', 8).setDepth(84).setAlpha(0);
    this.boss.setVisible(false); this.lamb.setAlpha(0);
    this.tweens.add({ targets: dim, fillAlpha: 0.6, duration: 250 });
    this.tweens.add({ targets: L, alpha: 1, duration: 250 });
    this.tweens.add({ targets: L, x: L.x - 6, yoyo: true, repeat: 14, duration: 60, delay: 300 });
    this.tweens.chain({ targets: Wf, tweens: [
      { x: width / 2 + 90, duration: 420, ease: 'Back.Out' },
      { x: width / 2 + 40, y: cy + 110, scaleX: ws * 1.12, scaleY: ws * 1.12, angle: -10, duration: 220, ease: 'Quad.In', onStart: () => { sfx.rock && sfx.rock(); this.cameras.main.shake(160, 0.01); this.tweens.add({ targets: cap, alpha: 1, scale: { from: 0.4, to: 1 }, duration: 260, ease: 'Back.Out' }); } },
      { x: width / 2 + 90, y: cy + 130, scaleX: ws, scaleY: ws, angle: 0, duration: 260, ease: 'Sine.Out', hold: 600 },
    ] });
    this.time.delayedCall(1900, () => {
      this.tweens.add({ targets: dim, fillAlpha: 0, duration: 350, onComplete: () => dim.destroy() });
      this.tweens.add({ targets: cap, alpha: 0, duration: 250, onComplete: () => cap.destroy() });
      this.tweens.add({ targets: Wf, x: this.wolfHome.x, y: this.wolfHome.y, displayWidth: 116, displayHeight: 116, duration: 450, ease: 'Cubic.InOut', onComplete: () => { Wf.destroy(); this.boss.setVisible(true); } });
      this.tweens.add({ targets: L, x: this.lambHome.x, y: this.lambHome.y, displayWidth: 112, displayHeight: 112, duration: 450, ease: 'Cubic.InOut', onComplete: () => { L.destroy(); this.lamb.setAlpha(1); this.lambMood('scared', 1200); if (!this.ended) this.busy = false; } });
    });
  }
  lambMood(m, ms = 0) {
    if (!this.lamb || !this.lamb.active) return;
    const key = m === 'idle' ? 'lamb' : `lamb_${m}`;
    this.lamb.setTexture(key);
    if (m === 'happy') this.tweens.add({ targets: this.lamb, y: this.lambHome.y - 18, duration: 160, yoyo: true, repeat: 1, ease: 'Quad.Out' });
    if (m === 'scared') this.tweens.add({ targets: this.lamb, x: this.lambHome.x - 3, duration: 50, yoyo: true, repeat: 5, onComplete: () => this.lamb.active && this.lamb.setX(this.lambHome.x) });
    if (this.lambTimer) this.lambTimer.remove();
    if (ms) this.lambTimer = this.time.delayedCall(ms, () => this.lamb.active && this.lamb.setTexture(this.board.moves <= 3 && !this.ended ? 'lamb_scared' : 'lamb'));
  }
  // kurt kuzuya atılır (saldırı/kayıp anı)
  wolfLunge(big = false) {
    if (!this.boss || !this.boss.active) return Promise.resolve();
    const b = this.boss, s = this.wolfScale, h = this.wolfHome;
    this.lambMood('scared', 900);
    return new Promise((res) => this.tweens.chain({ targets: b, tweens: [
      { x: h.x + 14, scaleX: s * 0.92, scaleY: s * 1.06, duration: 120, ease: 'Quad.Out' },
      { x: big ? this.lambHome.x + 110 : h.x - 150, y: h.y + (big ? 60 : 20), scaleX: s * (big ? 1.7 : 1.3), scaleY: s * (big ? 1.7 : 1.3), angle: -12, duration: 200, ease: 'Quad.In', onComplete: () => this.cameras.main.shake(120, 0.008) },
      { x: h.x, y: h.y, scaleX: s, scaleY: s, angle: 0, duration: 380, ease: 'Back.Out', delay: big ? 350 : 60, onComplete: res },
    ] }));
  }
  drawBasket(x, y) {
    const g = this.add.graphics().setDepth(29);
    g.fillStyle(0x000000, 0.3); g.fillEllipse(x, y - 2, 92, 14);
    g.fillStyle(0x9a6a36, 1); g.fillRoundedRect(x - 42, y - 50, 84, 46, 14);
    g.lineStyle(3, 0x5a3a1a, 1); g.strokeRoundedRect(x - 42, y - 50, 84, 46, 14);
    g.lineStyle(2, 0x6d4520, 0.8); for (let i = 1; i < 6; i++) g.lineBetween(x - 42 + i * 14, y - 48, x - 42 + i * 14, y - 6);
    g.lineBetween(x - 40, y - 30, x + 40, y - 30);
    const gems = [[-22, -56, 0], [0, -64, 2], [22, -56, 4], [-10, -50, 1], [12, -50, 3]].map(([dx, dy, k]) => this.add.image(x + dx, y + dy, `gem${k}`).setScale(0.42).setDepth(28));
    g.lineStyle(5, 0x7a4f25, 1); g.beginPath(); g.arc(x, y - 50, 36, Math.PI, 0); g.strokePath();
    this.tweens.add({ targets: gems, y: '-=3', yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.InOut', delay: (i) => i * 120 });
  }
  preLevel() {
    const { width, height } = this.scale;
    this.busy = true;
    const m = modal(this, 560, 430); const cx = width / 2, top = height / 2 - 215;
    const done = () => { if (!this.ended) this.busy = false; if (this.level.boss) this.time.delayedCall(250, () => this.bossIntro()); };
    m.c.list[0].once('pointerup', () => { m.close(); done(); });
    const origClose = m.close; m.close = () => { origClose(); done(); };
    m.c.add(txt(this, cx, top + 50, t('preTitle'), 28, '#ffe58a'));
    m.c.add(txt(this, cx, top + 90, t('preSub'), 16, '#d8e8d0'));
    const pick = { bomb: false, moves5: false };
    const items = [['bomb', '💣', t('preBomb')], ['moves5', '+5', t('preMoves')]];
    items.forEach(([k, ic, label], i) => {
      const x = cx + (i ? 130 : -130), y = top + 200;
      const own = save.boosters[k] || 0;
      const card = this.add.rectangle(x, y, 220, 150, 0x1d4a2a, 1).setStrokeStyle(4, 0x3f7a4d).setInteractive({ useHandCursor: true });
      const tick = txt(this, x + 88, y - 58, '', 26);
      m.c.add([card, txt(this, x, y - 30, ic, 44), txt(this, x, y + 18, label, 17), txt(this, x, y + 48, own ? `×${own}` : `🪙 ${CONFIG.preBoosters[k]}`, 16, '#ffe58a'), tick]);
      card.on('pointerup', () => { pick[k] = !pick[k]; card.setStrokeStyle(4, pick[k] ? 0xffb71b : 0x3f7a4d); tick.setText(pick[k] ? '✅' : ''); });
    });
    m.c.add(button(this, cx - 120, top + 350, 210, 64, `📺 ${t('preAd')}`, async () => {
      const ok = await showRewarded('prelevel');
      if (!ok) { this.toast(t('adFail') || '—', 22); return; }
      m.close(); this.applyPre({ bomb: true, moves5: false }, true);
    }, 0x5b3fa0, '#fff', 18));
    m.c.add(button(this, cx + 120, top + 350, 210, 64, `▶ ${t('play')}`, () => {
      if (!this.applyPre(pick, false)) return;
      m.close();
    }, 0x2f9e44, '#fff', 22));
  }
  applyPre(pick, free) {
    if (!free) {
      let coins = 0;
      for (const k in pick) if (pick[k] && !(save.boosters[k] > 0)) coins += CONFIG.preBoosters[k];
      if (coins && !spendCoins(coins)) { this.toast(t('notEnoughCoins'), 24); return false; }
      for (const k in pick) if (pick[k] && save.boosters[k] > 0) save.boosters[k]--;
      persist();
    }
    const used = Object.keys(pick).filter((k) => pick[k]);
    if (!used.length) return true;
    track('prelevel_booster', { level: this.level.id, boosters: used.join(','), free });
    if (pick.moves5) { this.board.moves += 5; sfx.coin(); }
    if (pick.bomb) {
      const free2 = this.board.freeGems();
      if (free2.length) { const [r, c] = free2[Math.floor(Math.random() * free2.length)]; this.board.cells[r][c].special = 'bomb'; sfx.special(); this.syncBoard(); this.burst(px(c), py(r), 0, 'special'); }
    }
    this.refreshHud(); this.refreshBoosters();
    return true;
  }

  // ---------- boosters ----------
  async useBooster(k) {
    if (this.busy || this.ended) return;
    if (this.mode === k) { this.setMode(null); return; }
    const has = (save.boosters[k] || 0) > 0;
    const pay = () => { if (k === 'shuffle' && this.freeShuffle > 0) { this.freeShuffle--; this.toast('🐴', 30); return true; } if (has) { save.boosters[k]--; persist(); } else if (!spendCoins(CONFIG.boosters[k])) { this.toast(t('notEnoughCoins'), 24); return false; } track('booster_use', { booster: k, level: this.level.id, paidCoins: !has }); this.refreshBoosters(); return true; };
    if (k === 'moves5') { if (!pay()) return; this.board.moves += 5; this.refreshHud(); sfx.coin(); return; }
    if (k === 'shuffle') { if (!pay()) return; this.board.events = []; this.board.shuffle(); await this.runEvents(this.board.events); return; }
    this.pendingPay = pay; this.setMode(k); this.toast(k === 'hammer' ? '🔨' : '🌈', 40);
  }
  setMode(m) { this.mode = m; for (const k in this.boosterBtns) this.boosterBtns[k].setAlpha(m && m !== k ? 0.4 : 1); }
  async applyBoosterAt([r, c]) {
    const g = this.board.cells[r][c];
    const blk = this.board.blocked(r, c) && this.mode === 'hammer';
    if (!blk && (!g || g.type < 0)) return;
    const k = this.mode; this.setMode(null);
    if (!this.pendingPay()) return;
    if (k === 'hammer') { const ev = this.board.useHammer(r, c); if (ev) await this.runEvents(ev); }
    else if (k === 'prism') { g.special = 'prism'; sfx.special(); this.syncBoard(); }
  }

  // ---------- end of level ----------
  checkEnd() {
    if (this.ended) return;
    if (this.board.isWon()) return this.win();
    if (this.board.isLost()) return this.outOfMoves();
  }
  async win() {
    this.ended = true; sfx.win(); endLevel(true);
    const left = this.board.moves;
    this.lambMood('happy');
    if (this.boss && this.boss.active) { this.wolfIdle && this.wolfIdle.stop(); this.boss.setTexture('wolf_hurt'); this.tweens.add({ targets: this.boss, x: this.scale.width + 140, angle: 20, duration: 700, delay: 350, ease: 'Back.In' }); }
    await this.victoryFx(left);
    const bonus = this.board.cashOutMoves();
    const stars = this.board.stars(); const score = this.board.score;
    const coins = CONFIG.coins.winReward + CONFIG.coins.threeStar + left * CONFIG.coins.perMoveLeft;
    const fest = this.level.festival; const fr = fest ? festWin(fest) : null;
    const newStars = fest ? 0 : recordWin(this.level.id, score, stars); addCoins(coins);
    const xp = winXp(stars, !!fest), tierUp = addXp(xp);
    const cut = winCut(); this.cropCut = cut.length + zoneCut(); const en = stars === 3 ? 3 : 2; addEnergy(en);
    if (stars === 3) startBereket();
    if (this.vetFor) cure(this.vetFor);
    this.farmData = { cropCut: this.cropCut, cut, energy: en, bereket: stars === 3, cured: this.vetFor };
    track('level_win', { level: this.level.id, score, stars, newStars, movesLeft: left });
    if (fr) track('event_win', { n: fest, all: !!fr.all });
    const { width, height } = this.scale;
    const { c } = modal(this, 440, 460);
    c.add(txt(this, width / 2, height / 2 - 170, t('win'), 40, '#ffb71b'));
    const wl = this.add.image(width / 2 - 200, height / 2 - 150, 'lamb_happy').setDisplaySize(130, 130); c.add(wl);
    this.tweens.add({ targets: wl, y: wl.y - 14, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.InOut' });
    for (let i = 0; i < 3; i++) {
      const sx = width / 2 - 80 + i * 80, sy = height / 2 - 90;
      const s = this.add.image(sx, sy, i < stars ? 'star' : 'stargray').setScale(0); c.add(s);
      this.tweens.add({ targets: s, scale: 1, delay: 200 + i * 220, duration: 280, ease: 'Back.Out', onStart: () => { if (i < stars) { sfx.special && sfx.special(); this.starEarnFx(sx, sy, c); } } });
    }
    this.confetti(c);
    c.add(txt(this, width / 2, height / 2 - 20, `${t('score')}: ${score}`, 26, '#fff'));
    if (left) c.add(txt(this, width / 2, height / 2 + 15, `${t('movesBonus')} ${left} × 🪙${CONFIG.coins.perMoveLeft}  ·  ${t('bonus')} +${bonus}`, 18, '#9fb3a8'));
    c.add(this.add.image(width / 2 - 40, height / 2 + 60, 'coin').setScale(0.6)); c.add(txt(this, width / 2 + 10, height / 2 + 60, `+${coins}`, 26, '#ffe58a'));
    const extra = [newStars ? `⭐ +${newStars}` : '', `🎟️ +${xp} XP${tierUp ? ' ⬆' : ''}`, fr ? `🌾 +${fr.coins}🪙${fr.hammer ? ' +🔨' : ''}${fr.gems ? ` +💎${fr.gems}` : ''}` : ''].filter(Boolean).join('  ·  ');
    c.add(txt(this, width / 2, height / 2 + 95, extra, 19, '#ffb71b'));
    if (cut.length) c.add(txt(this, width / 2, height / 2 - 140, `🌽 ${t('cropFaster')} −${WIN_CUT / 60000} ${t('minShort')}`, 18, '#9dffb8'));
    const nf = fest ? festNext() : 0;
    const last = fest ? !nf : this.level.id >= this.cache.json.get('levels').length;
    c.add(button(this, width / 2, height / 2 + 140, 300, 64, last ? t('map') : t('next'), async () => {
      await maybeInterstitial('level_end');
      if (last || this.vetFor) this.scene.start('Farm', this.farmData); else this.scene.start('Game', { level: fest ? festivalLevels(this.cache.json.get('levels'))[nf - 1] : this.cache.json.get('levels')[this.level.id] });
    }, 0x2ee06a, '#04220e'));
    c.add(button(this, width / 2, height / 2 + 205, 200, 44, t('map'), async () => { await maybeInterstitial('level_end'); this.scene.start('Farm', this.farmData); }, 0x2a333a, '#fff', 18));
  }
  outOfMoves() {
    this.ended = true;
    track('level_out_of_moves', { level: this.level.id, score: this.board.score });
    const { width, height } = this.scale;
    const { c, close } = modal(this, 440, 440);
    c.add(txt(this, width / 2, height / 2 - 160, t('outOfMoves'), 34, '#ff3b5c'));
    c.add(txt(this, width / 2, height / 2 - 100, `${t('continueFor')} +${CONFIG.ads.rewardedExtraMoves} ${t('moves')}`, 20, '#fff'));
    let decided = false; // ✕ ile kapatılırsa kayıp say (oyun "ended" durumunda asılı kalmasın)
    c.once('destroy', () => { if (!decided) this.lose(); });
    const cont = () => { decided = true; this.board.moves += CONFIG.ads.rewardedExtraMoves; this.ended = false; this.refreshHud(); close(); track('continue', { level: this.level.id }); };
    c.add(button(this, width / 2, height / 2 - 30, 360, 64, `📺 ${t('watchAd')}`, async () => { if (await showRewarded('extra_moves')) cont(); }, 0x3f7bff, '#fff', 22));
    c.add(button(this, width / 2, height / 2 + 50, 360, 64, `🪙 ${CONFIG.boosters.moves5} ${t('coins')}`, () => { if (spendCoins(CONFIG.boosters.moves5)) cont(); else this.toast(t('notEnoughCoins'), 24); }, 0xffb71b, '#1a1200', 22));
    c.add(button(this, width / 2, height / 2 + 140, 300, 56, t('lose'), () => { decided = true; close(); this.lose(); }, 0x2a333a, '#fff', 20));
  }
  async lose() {
    this.ended = true; sfx.lose(); recordLoss(); endLevel(false);
    if (this.lamb) this.lamb.setTexture('lamb_scared');
    if (this.boss && this.boss.active) await this.wolfLunge(true);
    if (sheepOnLoss()) { addLife(1); this.time.delayedCall(600, () => this.toast('🐑 +1 ❤', 30)); }
    track('level_fail', { level: this.level.id, score: this.board.score });
    const { width, height } = this.scale;
    const { c } = modal(this, 440, 340);
    c.add(txt(this, width / 2, height / 2 - 100, t('lose'), 36, '#ff3b5c'));
    c.add(this.add.image(width / 2 - 190, height / 2 - 130, 'lamb_scared').setDisplaySize(120, 120));
    if (this.level.boss) c.add(this.add.image(width / 2 + 190, height / 2 - 130, 'wolf').setDisplaySize(120, 120));
    c.add(txt(this, width / 2, height / 2 - 40, `${t('score')}: ${this.board.score}`, 22, '#fff'));
    c.add(button(this, width / 2, height / 2 + 40, 300, 64, t('retry'), async () => { await maybeInterstitial('level_end'); this.scene.start(save.lives > 0 ? 'Game' : 'Farm', { level: this.level }); }, 0x2ee06a, '#04220e'));
    c.add(button(this, width / 2, height / 2 + 115, 200, 44, t('map'), async () => { await maybeInterstitial('level_end'); this.scene.start('Farm'); }, 0x2a333a, '#fff', 18));
  }
  quit() {
    if (this.ended || this.quitOpen) return;
    const { width, height } = this.scale;
    this.quitOpen = true;
    const { c, close } = modal(this, 420, 300);
    c.once('destroy', () => { this.quitOpen = false; });
    c.add(txt(this, width / 2, height / 2 - 95, t('quitQ'), 30, '#ffb71b'));
    c.add(txt(this, width / 2, height / 2 - 45, t('quitWarn'), 20, '#ff9aa9'));
    c.add(button(this, width / 2, height / 2 + 25, 300, 60, t('keepPlaying'), () => close(), 0x2ee06a, '#04220e', 22));
    c.add(button(this, width / 2, height / 2 + 100, 240, 48, t('quitYes'), () => {
      if (this.ended) return; this.ended = true; recordLoss(); endLevel(false);
      track('level_quit', { level: this.level.id }); this.scene.start('Farm');
    }, 0x2a333a, '#fff', 18));
  }

  tutorial() {
    const { width } = this.scale;
    const steps = [t('tut1'), t('tut2'), t('tut3')];
    let i = 0;
    const box = this.add.container(0, 0).setDepth(900);
    const bg = this.add.rectangle(width / 2, OY - 30, 500, 60, 0x000000, 0.85).setStrokeStyle(2, 0xffb71b);
    const tx = txt(this, width / 2, OY - 30, steps[0], 17, '#fff', { wordWrap: { width: 480 } });
    box.add([bg, tx]);
    const adv = () => { i++; if (i >= steps.length) { box.destroy(); save.tutorialDone = true; persist(); this.input.off('pointerup', adv); } else tx.setText(steps[i]); };
    this.input.on('pointerup', adv);
  }
}
