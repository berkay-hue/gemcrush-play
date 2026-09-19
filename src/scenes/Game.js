import { CONFIG } from '../config.js';
import { Board } from '../engine/board.js';
import { bestMove } from '../engine/bot.js';
import { CELL, gemKey } from '../textures.js';
import { save, persist, spendLife, addCoins, spendCoins, recordWin, recordLoss, addLife } from '../meta/save.js';
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
import { txt, button, modal } from '../ui/widgets.js';

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
    spendLife();
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
    for (const bx of [60, width - 200]) {
      hud.fillStyle(0x000000, 0.3); hud.fillRoundedRect(bx, 78, 140, 74, 18);
      hud.fillStyle(0xf5e6c4, 1); hud.fillRoundedRect(bx, 74, 140, 74, 18);
      hud.lineStyle(3, 0x8a5a2b, 1); hud.strokeRoundedRect(bx, 74, 140, 74, 18);
    }
    hud.fillStyle(0x3a2412, 0.55); hud.fillRoundedRect(width / 2 - 90, 8, 180, 30, 15);
    button(this, 40, 40, 60, 44, '✕', () => this.quit(), 0x2a333a, '#fff', 20);
    this.add.text(width / 2, 22, `${t('level')} ${this.level.id}`, { fontFamily: 'system-ui', fontSize: '20px', color: '#ffe8b0', fontStyle: 'bold' }).setOrigin(0.5);
    txt(this, 130, 90, t('moves'), 16, '#8a5a2b'); this.movesTxt = txt(this, 130, 125, '', 40, '#3a2412');
    txt(this, width - 130, 90, t('score'), 16, '#8a5a2b'); this.scoreTxt = txt(this, width - 130, 125, '0', 34, '#c0620a');
    this.objTxt = this.add.container(width / 2, 108);
    this.objIcons = [];
    this.buildObjectives();
    // score bar with star marks
    this.barBg = this.add.rectangle(width / 2, 178, 400, 14, 0x000000, 0.5).setOrigin(0.5).setStrokeStyle(2, 0xffffff, 0.15);
    this.bar = this.add.rectangle(width / 2 - 200, 178, 0, 10, 0xffb71b).setOrigin(0, 0.5);
    const s = this.level.stars || [0, 1, 2];
    this.starMarks = [1, 2].map((i) => this.add.image(width / 2 - 200 + 400 * Math.min(1, s[i] / (s[2] * 1.1 || 1)), 178, 'stargray').setScale(0.4));
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
    // level intro toast
    this.toast(this.level.name || `${t('level')} ${this.level.id}`, 30);
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
    g.fillGradientStyle(0x6ec6f0, 0x6ec6f0, 0xc8ecff, 0xc8ecff, 1); g.fillRect(0, 0, width, height * 0.55);
    const sun = this.add.circle(width - 90, 250, 46, 0xfff1a8).setAlpha(0.9);
    const halo = this.add.circle(width - 90, 250, 90, 0xfff6c8, 0.35);
    this.tweens.add({ targets: halo, scale: 1.15, alpha: 0.2, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const hills = this.add.graphics();
    const hill = (baseY, amp, col, ph) => { hills.fillStyle(col, 1); hills.beginPath(); hills.moveTo(0, height); for (let xx = 0; xx <= width; xx += 10) hills.lineTo(xx, baseY + Math.sin(xx / 90 + ph) * amp); hills.lineTo(width, height); hills.closePath(); hills.fillPath(); };
    hill(height * 0.40, 26, 0x8fd16a, 0.4);
    // uzak ambar
    hills.fillStyle(0xb8402f, 1); hills.fillRect(60, height * 0.40 - 58, 70, 50); hills.fillTriangle(52, height * 0.40 - 56, 138, height * 0.40 - 56, 95, height * 0.40 - 92);
    hills.fillStyle(0xffffff, 1); hills.fillRect(84, height * 0.40 - 36, 22, 28);
    hill(height * 0.46, 20, 0x6dbb4f, 2.1);
    hill(height * 0.55, 14, 0x55a23e, 4.0);
    hills.fillStyle(0x4a9135, 1); hills.fillRect(0, height * 0.6, width, height);
    for (let i = 0; i < 70; i++) { const gx = (i * 67) % width, gy = height * 0.6 + ((i * 131) % (height * 0.4)); hills.fillStyle(i % 2 ? 0x3f822c : 0x5cae43, 1); hills.fillTriangle(gx, gy, gx + 4, gy - 12, gx + 8, gy); }
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
      const d = this.add.circle(Math.random() * width, height * (0.3 + Math.random() * 0.6), 2 + Math.random() * 2, 0xfff6b0, 0.8);
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
    g.fillStyle(0x0c2418, 0.94); g.fillRoundedRect(x + 2, y + 2, W + 16, H + 16, 18);
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
      if (ok && ok.startsWith('rock')) this.overlays[r * 100 + c] = this.add.image(px(c), py(r), ok);
      if (g && g.locked && g.type >= 0) { const l = this.add.image(px(c), py(r), 'lock'); this.overlays[(r * 100 + c) + 10000] = l; }
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
    this.scoreTxt.setText(String(b.score));
    const s3 = (this.level.stars || [0, 0, 1])[2] * 1.1 || 1;
    this.tweens.add({ targets: this.bar, width: Math.min(400, 400 * b.score / s3), duration: 200 });
    const st = b.stars();
    this.starMarks.forEach((m, i) => m.setTexture(st >= i + 2 ? 'star' : 'stargray'));
    const prog = b.progress();
    prog.forEach((p, i) => { const o = this.objIcons[i]; if (o) { o.lbl.setText(`${Math.min(p.current, p.target)}/${p.target}`); if (p.current >= p.target) o.check.setVisible(true); } });
  }
  buildObjectives() {
    const prog = this.board.progress();
    const n = prog.length; const gap = 90;
    prog.forEach((p, i) => {
      const x = (i - (n - 1) / 2) * gap;
      const c = this.add.container(x, 0);
      let icon;
      if (p.kind === 'collect') icon = this.add.image(0, 0, `gem${p.gemType}`).setScale(0.6);
      else if (p.kind === 'jelly') icon = this.add.image(0, 0, 'jelly2').setScale(0.6);
      else if (p.kind === 'rock') icon = this.add.image(0, 0, 'rock2').setScale(0.6);
      else if (p.kind === 'lock') icon = this.add.image(0, 0, 'lock').setScale(0.6);
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
          sfx.combo(); this.comboFx(px(e.at[1]), py(e.at[0]), e.kind);
          this.toast(e.kind === 'prism_prism' ? t('legendary') : t('amazing'), 44);
          await this.wait(DUR.combo + 150);
          break;
        }
        case 'convert': { const s = this.sprites[e.at[0] * 100 + e.at[1]]; if (s) { s.setTexture(`gem${s.gemType}_${e.special}`); s.special = e.special; } break; }
        case 'match': {
          maxCascade = Math.max(maxCascade, e.cascade);
          sfx.match(e.cascade);
          this.floatScore(e.cells, e.score);
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
        case 'unlock': { const l = this.overlays[e.at[0] * 100 + e.at[1] + 10000]; if (l) { this.tweens.add({ targets: l, alpha: 0, scale: 1.5, duration: 200, onComplete: () => l.destroy() }); delete this.overlays[e.at[0] * 100 + e.at[1] + 10000]; }
          const s = this.sprites[e.at[0] * 100 + e.at[1]]; const g = this.board.cells[e.at[0]][e.at[1]]; if (s && g) s.setTexture(gemKey(g)); break; }
        case 'clear': {
          const tws = [];
          for (const [r, c] of e.cells) {
            const s = this.sprites[r * 100 + c];
            if (!s) continue;
            delete this.sprites[r * 100 + c];
            this.burst(s.x, s.y, s.gemType, e.reason);
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
  shake(at) { const o = this.overlays[at[0] * 100 + at[1]]; if (o) this.tweens.add({ targets: o, x: o.x + 4, duration: 40, yoyo: true, repeat: 3 }); }
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
    const g = this.board.cells[r][c]; if (!g || g.type < 0) return;
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
    this.ended = true; sfx.win();
    const bonus = this.board.cashOutMoves();
    const stars = this.board.stars(); const score = this.board.score;
    const coins = CONFIG.coins.winReward + (stars === 3 ? CONFIG.coins.threeStar : 0);
    const newStars = recordWin(this.level.id, score, stars); addCoins(coins);
    const cut = winCut(); this.cropCut = cut.length + zoneCut(); const en = stars === 3 ? 3 : 2; addEnergy(en);
    if (stars === 3) startBereket();
    if (this.vetFor) cure(this.vetFor);
    this.farmData = { cropCut: this.cropCut, cut, energy: en, bereket: stars === 3, cured: this.vetFor };
    track('level_win', { level: this.level.id, score, stars, newStars, movesLeft: 0 });
    const { width, height } = this.scale;
    const { c } = modal(this, 440, 460);
    c.add(txt(this, width / 2, height / 2 - 170, t('win'), 40, '#ffb71b'));
    for (let i = 0; i < 3; i++) { const s = this.add.image(width / 2 - 80 + i * 80, height / 2 - 90, i < stars ? 'star' : 'stargray').setScale(0); c.add(s); this.tweens.add({ targets: s, scale: 1, delay: 200 + i * 200, duration: 250, ease: 'Back.Out' }); }
    c.add(txt(this, width / 2, height / 2 - 20, `${t('score')}: ${score}`, 26, '#fff'));
    if (bonus) c.add(txt(this, width / 2, height / 2 + 15, `${t('bonus')} +${bonus}`, 18, '#9fb3a8'));
    c.add(this.add.image(width / 2 - 40, height / 2 + 60, 'coin').setScale(0.6)); c.add(txt(this, width / 2 + 10, height / 2 + 60, `+${coins}`, 26, '#ffe58a'));
    if (newStars) c.add(txt(this, width / 2, height / 2 + 95, `⭐ +${newStars} ${t('farmStars')}`, 20, '#ffb71b'));
    if (cut.length) c.add(txt(this, width / 2, height / 2 - 140, `🌽 ${t('cropFaster')} −${WIN_CUT / 60000} ${t('minShort')}`, 18, '#9dffb8'));
    const last = this.level.id >= this.cache.json.get('levels').length;
    c.add(button(this, width / 2, height / 2 + 140, 300, 64, last ? t('map') : t('next'), async () => {
      await maybeInterstitial('level_end');
      if (last || this.vetFor) this.scene.start('Farm', this.farmData); else this.scene.start('Game', { level: this.cache.json.get('levels')[this.level.id] });
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
    const cont = () => { this.board.moves += CONFIG.ads.rewardedExtraMoves; this.ended = false; this.refreshHud(); close(); track('continue', { level: this.level.id }); };
    c.add(button(this, width / 2, height / 2 - 30, 360, 64, `📺 ${t('watchAd')}`, async () => { if (await showRewarded('extra_moves')) cont(); }, 0x3f7bff, '#fff', 22));
    c.add(button(this, width / 2, height / 2 + 50, 360, 64, `🪙 ${CONFIG.boosters.moves5} ${t('coins')}`, () => { if (spendCoins(CONFIG.boosters.moves5)) cont(); else this.toast(t('notEnoughCoins'), 24); }, 0xffb71b, '#1a1200', 22));
    c.add(button(this, width / 2, height / 2 + 140, 300, 56, t('lose'), () => { close(); this.lose(); }, 0x2a333a, '#fff', 20));
  }
  async lose() {
    this.ended = true; sfx.lose(); recordLoss();
    if (sheepOnLoss()) { addLife(1); this.time.delayedCall(600, () => this.toast('🐑 +1 ❤', 30)); }
    track('level_fail', { level: this.level.id, score: this.board.score });
    const { width, height } = this.scale;
    const { c } = modal(this, 440, 340);
    c.add(txt(this, width / 2, height / 2 - 100, t('lose'), 36, '#ff3b5c'));
    c.add(txt(this, width / 2, height / 2 - 40, `${t('score')}: ${this.board.score}`, 22, '#fff'));
    c.add(button(this, width / 2, height / 2 + 40, 300, 64, t('retry'), async () => { await maybeInterstitial('level_end'); this.scene.start(save.lives > 0 ? 'Game' : 'Farm', { level: this.level }); }, 0x2ee06a, '#04220e'));
    c.add(button(this, width / 2, height / 2 + 115, 200, 44, t('map'), async () => { await maybeInterstitial('level_end'); this.scene.start('Farm'); }, 0x2a333a, '#fff', 18));
  }
  quit() { if (this.ended) return; this.ended = true; recordLoss(); track('level_quit', { level: this.level.id }); this.scene.start('Farm'); }

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
