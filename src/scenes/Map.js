import { CONFIG } from '../config.js';
import { save, persist, tickLives, msToNextLife, addLife, addCoins, spendCoins, dailyStatus, claimDaily, starBalance, AVATARS, setProfile, exportCode, importCode, wipeAll, totalStars, account, logout, leaderboard } from '../meta/save.js';
import { t, setLang, getLang } from '../i18n.js';
import { showRewarded } from '../monetize/ads.js';
import { buy, price, restore } from '../monetize/iap.js';
import { track } from '../analytics.js';
import { sfx } from '../sound.js';
import { musicOn, setMusic } from '../music.js';
import { txt, button, modal, fmtMs, card, iconSlot, ribbon, chip, shine, awning, signBoard } from '../ui/widgets.js';
import { authForm } from '../ui/authForm.js';
import { nameBox, codeBox } from '../ui/farmTitle.js';
import { THEMES, currentTheme, ownsTheme, buyTheme, setTheme } from '../meta/themes.js';

export class Map extends Phaser.Scene {
  constructor() { super('Map'); }

  init(data) { this.openLives = !!(data && data.livesModal); this.openShop = !!(data && data.shop); }

  create() {
    const { width, height } = this.scale;
    this.levels = this.cache.json.get('levels');
    this.cameras.main.setBackgroundColor('#0d1512');
    this.bg = this.add.image(width / 2, height / 2, this.themeBg()).setDisplaySize(width, height).setScrollFactor(0);
    tickLives();

    // --- scrolling level path ---
    const STEP = 92;
    const total = this.levels.length;
    const worldH = 160 + total * STEP + 200;
    this.path = this.add.container(0, 0);
    const g = this.add.graphics();
    this.path.add(g);
    const nodes = [];
    const xFor = (i) => width / 2 + Math.sin(i * 0.9) * 150;
    const yFor = (i) => worldH - 200 - i * STEP;
    g.lineStyle(16, 0x000000, 0.25);
    for (let i = 0; i < total - 1; i++) { g.lineBetween(xFor(i), yFor(i) + 4, xFor(i + 1), yFor(i + 1) + 4); }
    g.lineStyle(10, 0xffb71b, 0.18);
    for (let i = 0; i < total - 1; i++) { g.lineBetween(xFor(i), yFor(i), xFor(i + 1), yFor(i + 1)); }
    // decorative floating gems along the path
    for (let i = 0; i < total; i += 3) {
      const d = this.add.image(xFor(i) + (i % 2 ? -150 : 150), yFor(i) + 30, `gem${i % 6}`).setAlpha(0.28).setScale(0.9).setAngle(i * 37);
      this.path.add(d);
      this.tweens.add({ targets: d, y: d.y - 14, angle: d.angle + 12, yoyo: true, repeat: -1, duration: 2200 + i * 90, ease: 'Sine.InOut' });
    }
    for (let i = 0; i < total; i++) {
      const lv = this.levels[i];
      const x = xFor(i), y = yFor(i);
      const unlocked = lv.id <= save.level;
      const current = lv.id === save.level;
      const c = this.add.container(x, y);
      c.add(this.add.circle(0, 5, 31, 0x000000, 0.4));
      if (current) { const gl = this.add.image(0, 0, 'glow').setTint(0xffb71b).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9); c.add(gl); this.tweens.add({ targets: gl, alpha: 0.4, scale: 1.1, yoyo: true, repeat: -1, duration: 700 }); }
      if (lv.chapter && (i === 0 || this.levels[i - 1].chapter !== lv.chapter)) { // bölüm tabelası
        const sx = xFor(i) > width / 2 ? x - 150 : x + 150, sy = y - 10;
        const sg = this.add.graphics(); sg.fillStyle(0x000000, 0.35); sg.fillRoundedRect(sx - 88, sy - 26 + 4, 176, 52, 14);
        sg.fillStyle(0x6b4423, 1); sg.fillRoundedRect(sx - 88, sy - 26, 176, 52, 14); sg.lineStyle(3, 0xffb71b, 0.9); sg.strokeRoundedRect(sx - 88, sy - 26, 176, 52, 14);
        this.path.add(sg); this.path.add(txt(this, sx, sy - 8, `${t('chapter')} ${Math.floor((lv.id - 101) / 10) + 2}`, 13, '#ffe58a'));
        this.path.add(txt(this, sx, sy + 10, lv.chapter, 18, '#ffffff'));
      }
      if (lv.id % 10 === 0) { // F21: her 10 bölümde bir simge yapı
        const LM = ['🏰', '🌋', '🗼', '⛲', '🌉', '🏯', '🎡', '🗿', '⛩', '🏝'];
        const mx = xFor(i) > width / 2 ? x - 118 : x + 118, done = lv.id < save.level;
        const sh = this.add.circle(mx, y + 2, 44, done ? 0xffb71b : 0x000000, done ? 0.22 : 0.3).setStrokeStyle(3, done ? 0xffb71b : 0x6b7a70, 0.8);
        const ic = txt(this, mx, y, LM[(lv.id / 10 - 1) % LM.length], 58, '#ffffff').setAlpha(done ? 1 : 0.55);
        if (!done) ic.setTint(0xb0b0b0);
        const tag = txt(this, mx, y + 58, done ? '✔' : `${lv.id}`, 13, done ? '#7dff9b' : '#ffe58a');
        this.path.add(sh); this.path.add(ic); this.path.add(tag);
        if (done) this.tweens.add({ targets: ic, y: y - 6, yoyo: true, repeat: -1, duration: 1100 + (i % 3) * 150, ease: 'Sine.InOut' });
      }
      const circ = this.add.circle(0, 0, 30, unlocked ? (lv.boss ? 0x9b4dff : lv.wall ? 0xff3b5c : 0xffb71b) : 0x2a333a);
      circ.setStrokeStyle(4, current ? 0xffffff : 0x000000, current ? 1 : 0.4);
      c.add(circ); c.add(this.add.circle(0, -9, 18, 0xffffff, unlocked ? 0.22 : 0.06));
      const n = txt(this, 0, 0, String(lv.id), 22, unlocked ? '#1a1200' : '#7a8590');
      c.add(n);
      if (lv.boss) { c.add(txt(this, 0, 42, `💀 ${t('hard')}`, 14, '#e6d1ff').setShadow(0, 2, '#000', 3, true, true)); }
      const st = save.stars[lv.id] || 0;
      for (let k = 0; k < 3; k++) c.add(this.add.image(-22 + k * 22, -40, k < st ? 'star' : 'stargray').setScale(0.35));
      if (unlocked) {
        circ.setInteractive({ useHandCursor: true });
        circ.on('pointerup', (p) => { if (Math.abs(p.downY - p.upY) < 12) this.tryStart(lv); });
      }
      if (current) this.tweens.add({ targets: c, scale: 1.12, yoyo: true, repeat: -1, duration: 600 });
      this.path.add(c);
      nodes.push(c);
    }
    // camera scroll: drag / wheel, clamp
    this.cameras.main.setBounds(0, 0, width, worldH);
    const targetY = Math.max(0, Math.min(worldH - height, yFor(save.level - 1) - height * 0.55));
    this.cameras.main.scrollY = targetY;
    this.input.on('pointermove', (p) => { if (p.isDown) this.cameras.main.scrollY -= (p.y - p.prevPosition.y); });
    this.input.on('wheel', (_p, _o, _dx, dy) => { this.cameras.main.scrollY += dy; });

    // --- HUD (fixed) ---
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(10);
    const bar = this.add.rectangle(width / 2, 50, width, 100, 0x0a0f0d, 0.92);
    this.hud.add(bar);
    this.hud.add(this.add.image(40, 50, 'heart').setScale(0.7));
    this.livesTxt = txt(this, 90, 42, '', 24, '#ffffff').setOrigin(0, 0.5);
    this.lifeTimer = txt(this, 90, 68, '', 16, '#9fb3a8').setOrigin(0, 0.5);
    this.hud.add([this.livesTxt, this.lifeTimer]);
    const lifeBtn = this.add.circle(40, 50, 28).setInteractive({ useHandCursor: true }); lifeBtn.on('pointerup', () => this.livesModal()); this.hud.add(lifeBtn);
    this.hud.add(this.add.image(width - 150, 50, 'coin').setScale(0.6));
    this.coinsTxt = txt(this, width - 120, 50, '', 24, '#ffe58a').setOrigin(0, 0.5);
    this.hud.add(this.coinsTxt);
    const shopBtn = button(this, width - 40, 50, 56, 44, '+', () => this.shop(), 0xffb71b, '#1a1200', 30); this.hud.add(shopBtn);
    const setBtn = button(this, width - 40, 110, 56, 40, '⚙', () => this.settings(), 0x2a333a, '#ffffff', 22); this.hud.add(setBtn);
    const themeBtn = button(this, width - 40, 162, 56, 40, '🎨', () => this.themes(), 0x7a4dff, '#ffffff', 20); this.hud.add(themeBtn);
    const lbBtn = button(this, width - 40, 214, 56, 40, '🏆', () => this.ranks(), 0xffb71b, '#1a1200', 20); this.hud.add(lbBtn);
    this.hud.add(txt(this, width / 2, 36, 'FARMTASTIC GEMS', 24, '#ffb71b'));
    this.starsTxt = txt(this, width / 2, 72, '', 20, '#ffe58a'); this.hud.add(this.starsTxt);

    const playBtn = button(this, width / 2, height - 60, 260, 70, `${t('play')}  ▶  ${t('level')} ${Math.min(save.level, total)}`, () => this.tryStart(this.levels[Math.min(save.level, total) - 1]), 0x2ee06a, '#04220e', 24);
    this.hud.add(playBtn);

    this.refreshHud();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshHud() });

    const farmBtn = button(this, 60, 110, 100, 40, `🏡 ${t('farm')}`, () => this.scene.start('Farm'), 0x2ee06a, '#04220e', 16); this.hud.add(farmBtn);
    // container scrollFactor çocuklara geçmez → kaydırılmış haritada tıklama alanları kayıyordu
    this.hud.setScrollFactor(0, 0, true);
    if (this.openLives) this.time.delayedCall(200, () => this.livesModal());
    if (this.openShop) this.time.delayedCall(200, () => this.shop());
    const d = dailyStatus();
    if (d.available) this.time.delayedCall(400, () => this.dailyModal(d));
  }

  refreshHud() {
    tickLives();
    this.livesTxt.setText(`${save.lives} / ${CONFIG.lives.max}`);
    const ms = msToNextLife();
    this.lifeTimer.setText(ms ? `${t('nextLife')} ${fmtMs(ms)}` : t('full'));
    this.coinsTxt.setText(String(save.coins));
    this.starsTxt.setText(`⭐ ${starBalance()}`);
  }

  tryStart(lv) {
    tickLives();
    if (save.lives <= 0) { this.livesModal(); return; }
    this.scene.start('Game', { level: lv });
  }

  // ---------- modals ----------
  dailyModal(d) {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 440, 420);
    c.add(txt(this, width / 2, height / 2 - 160, t('daily'), 34, '#ffb71b'));
    for (let i = 0; i < 7; i++) {
      const x = width / 2 - 165 + (i % 4) * 110, y = height / 2 - 80 + Math.floor(i / 4) * 90;
      const done = i < d.streak, today = i === d.streak;
      const r = this.add.rectangle(x, y, 96, 76, today ? 0xffb71b : done ? 0x2ee06a : 0x2a333a, 1).setStrokeStyle(2, 0xffffff, 0.2);
      c.add([r, this.add.image(x, y - 12, 'coin').setScale(0.4), txt(this, x, y + 20, `${CONFIG.dailyRewards[i]}`, 16, today ? '#1a1200' : '#fff')]);
      c.add(txt(this, x, y - 30, `${t('day')} ${i + 1}`, 12, today ? '#1a1200' : done ? '#04220e' : '#9fb3a8'));
    }
    c.add(button(this, width / 2, height / 2 + 150, 220, 60, `${t('claim')} +${d.reward}`, () => {
      const r = claimDaily(); sfx.coin(); track('daily_claim', { streak: d.streak + 1, reward: r }); this.refreshHud(); close();
    }, 0x2ee06a, '#04220e'));
  }

  livesModal() {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 440, 360);
    const full = save.lives >= CONFIG.lives.max;
    c.add(txt(this, width / 2, height / 2 - 120, full ? t('lives') : t('noLives'), 32, '#ffb71b'));
    const timer = txt(this, width / 2, height / 2 - 60, '', 22, '#ffffff'); c.add(timer);
    const upd = () => { tickLives(); const ms = msToNextLife(); timer.setText(`${save.lives}/${CONFIG.lives.max}  ${ms ? t('nextLife') + ' ' + fmtMs(ms) : t('full')}`); };
    upd(); const ev = this.time.addEvent({ delay: 1000, loop: true, callback: upd });
    if (!full) {
      c.add(button(this, width / 2, height / 2 + 10, 360, 60, `📺 ${t('lifeAd')}`, async () => {
        if (await showRewarded('life')) { addLife(1); sfx.coin(); this.refreshHud(); ev.remove(); close(); }
      }, 0x3f7bff, '#ffffff', 20));
      c.add(button(this, width / 2, height / 2 + 85, 360, 60, `💰 ${t('buy')} 5 ${t('lives')} · 150`, () => {
        if (spendCoins(150)) { addLife(5); sfx.coin(); this.refreshHud(); ev.remove(); close(); } else this.shop();
      }, 0xffb71b, '#1a1200', 20));
    }
    c.add(button(this, width / 2, height / 2 + 150, 160, 50, '✕', () => { ev.remove(); close(); }, 0x2a333a, '#ffffff'));
  }

  shop() {
    const { width, height } = this.scale, cx = width / 2;
    const { c, close } = modal(this, 500, 860);
    const top = height / 2 - 430, en = getLang() === 'en';
    c.add(awning(this, cx, top + 8, 488, 26, 12));
    c.add(signBoard(this, cx, top + 50, `🏪 ${t('shop')}`, 22));
    const ch1 = chip(this, 0, top + 88, '🪙', save.coins || 0, 0xffb71b), ch2 = chip(this, 0, top + 88, '💎', save.gems || 0, 0x46c8ff);
    const gap = 16, tw = ch1.w + ch2.w + gap; ch1.x = cx - tw / 2 + 17; ch2.x = ch1.x + ch1.w + gap; c.add([ch1, ch2]);
    const P = CONFIG.iap.products, buyP = async (p) => { if (await buy(p)) { sfx.coin(); track('shop_buy', { id: p.id }); close(); this.refreshHud(); this.shop(); } };
    let y = top + 132;
    // Başlangıç paketi afişi
    const sp = P.find((p) => p.starter);
    if (sp && !save.starterBought) {
      const h = 136; y += h / 2;
      c.add(shine(this, cx, y, 450, h));
      c.add(card(this, cx, y, 450, h, { top: 0x8a3dd6, bottom: 0x3a1470, accent: 0xffe58a, accentA: 0.9 }));
      c.add(this.add.image(cx - 170, y + 8, 'lamb_happy').setDisplaySize(108, 108));
      c.add(txt(this, cx + 30, y - 50, en ? 'STARTER PACK' : 'BAŞLANGIÇ PAKETİ', 22, '#ffe58a').setShadow(0, 2, 'rgba(0,0,0,.5)', 3, true, true));
      c.add(txt(this, cx + 30, y - 16, `🪙${sp.coins}  💎${sp.gems}  ❤️+${sp.lives}`, 20, '#ffffff'));
      c.add(txt(this, cx - 30, y + 34, sp.was, 17, '#d9c2ff').setStroke('#3a1470', 1));
      const ln = this.add.rectangle(cx - 30, y + 34, 50, 2, 0xff6b8a); c.add(ln);
      c.add(button(this, cx + 90, y + 34, 150, 52, price(sp), () => buyP(sp), 0x2ee06a, '#04220e', 22));
      c.add(ribbon(this, cx + 180, y - h / 2 + 6, '-70%', 0xff3b5c));
            y += h / 2 + 18;
    }
    // Ücretsiz: reklam izle
    y += 30;
    c.add(card(this, cx, y, 450, 60, { top: 0x2f5fd0, bottom: 0x1a3478, accent: 0x9fc0ff, accentA: 0.5 }));
    c.add(txt(this, cx - 200, y, `📺 ${t('watchAd')}`, 19, '#fff').setOrigin(0, 0.5));
    c.add(button(this, cx + 150, y, 120, 44, `+${CONFIG.ads.rewardedCoins} 🪙`, async () => {
      if (await showRewarded('shop_coins')) { addCoins(CONFIG.ads.rewardedCoins); sfx.coin(); this.refreshHud(); close(); this.shop(); }
    }, 0xffffff, '#1a3478', 17));
    y += 30 + 22;
    // Paket ızgarası (2 sütun): altın + elmas
    const packs = P.filter((p) => !p.starter && !(p.removeAds && save.removeAds));
    const cw = 216, chh = 128, colX = [cx - 117, cx + 117];
    const sizeOf = (p) => p.removeAds ? '🚫' : (p.gems ? ['💎', '💎💎', '💎💎💎'] : ['🪙', '🪙🪙', '💰'])[p.gems ? (p.gems >= 300 ? 2 : p.gems >= 100 ? 1 : 0) : (p.coins >= 4000 ? 2 : p.coins >= 1500 ? 1 : 0)];
    packs.forEach((p, i) => {
      const x = colX[i % 2], yy = y + chh / 2 + Math.floor(i / 2) * (chh + 14), best = p.badge === 'best', gem = !!p.gems;
      if (best) c.add(shine(this, x, yy, cw, chh, 0x7dffa8));
      c.add(card(this, x, yy, cw, chh, gem ? { top: 0x1f6fa8, bottom: 0x0d2f52, accent: best ? 0x7dffa8 : 0x8fe3ff, accentA: best ? 0.9 : 0.4 } : { top: 0x9a6a12, bottom: 0x4a2f06, accent: best ? 0x7dffa8 : 0xffe58a, accentA: best ? 0.9 : 0.4 }));
      c.add(iconSlot(this, x, yy - 30, 52, sizeOf(p), gem ? 0x46c8ff : 0xffb71b, sizeOf(p).length > 2 ? 18 : 26));
      c.add(txt(this, x, yy + 12, p.removeAds ? (en ? 'No ads' : 'Reklamsız') : gem ? `${p.gems}` : `${p.coins}`, p.removeAds ? 20 : 24, '#ffffff').setShadow(0, 2, 'rgba(0,0,0,.5)', 3, true, true));
      c.add(button(this, x, yy + 44, 140, 38, price(p), () => buyP(p), best ? 0x2ee06a : 0xffb71b, best ? '#04220e' : '#1a1200', 19));
      if (p.badge) c.add(ribbon(this, x + cw / 2 - 30, yy - chh / 2 + 4, best ? (en ? 'BEST' : 'EN İYİ') : (en ? 'POPULAR' : 'POPÜLER'), best ? 0x22b85a : 0xff3b5c));
    });
    y += Math.ceil(packs.length / 2) * (chh + 14);
    c.add(txt(this, cx, Math.min(y + 14, top + 836), `↺ ${t('restore')}`, 15, '#9fb3a8').setInteractive({ useHandCursor: true }).on('pointerup', async () => { const ok = await restore().catch(() => false); this.toast(ok ? (en ? 'Purchases restored ✓' : 'Satın alımlar geri yüklendi ✓') : (en ? 'Store not available' : 'Mağaza şu an kullanılamıyor')); this.refreshHud(); }));
  }

  // harita arka planı temaya göre (her tema için bir kez üretilir)
  themeBg() {
    const th = currentTheme(), key = `bgGrad_${th.id}`;
    if (!this.textures.exists(key)) {
      const ct = this.textures.createCanvas(key, 270, 480), ctx = ct.getContext(), w = 270, h = 480;
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, th.map[0]); g.addColorStop(0.5, th.map[1]); g.addColorStop(1, th.map[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const v = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.2, w / 2, h * 0.5, w * 0.9); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); ct.refresh();
    }
    return key;
  }

  themes() {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 480, 700);
    const lang = getLang() === 'en' ? 'en' : 'tr';
    c.add(txt(this, width / 2, height / 2 - 310, `🎨 ${t('themes')}`, 32, '#ffb71b'));
    c.add(txt(this, width / 2, height / 2 - 272, t('themeHint'), 15, '#cfe3d8'));
    const draw = () => {
      (this._thRows || []).forEach((o) => o.destroy()); this._thRows = [];
      let y = height / 2 - 200;
      for (const th of THEMES) {
        const g = this.add.graphics();
        g.fillGradientStyle(th.sky[0], th.sky[0], th.hills[1], th.hills[1], 1); g.fillRoundedRect(width / 2 - 210, y - 42, 84, 84, 14);
        g.fillStyle(th.hills[0], 1); g.fillRoundedRect(width / 2 - 210, y + 8, 84, 34, { tl: 0, tr: 0, bl: 14, br: 14 });
        g.fillStyle(th.sun, 1); g.fillCircle(width / 2 - 146, y - 22, 9);
        const cur = save.theme === th.id, own = ownsTheme(th.id);
        if (cur) { g.lineStyle(4, 0x2ee06a, 1); g.strokeRoundedRect(width / 2 - 214, y - 46, 92, 92, 16); }
        const nm = txt(this, width / 2 - 108, y - 14, `${th.icon} ${th[lang]}`, 20, '#ffffff').setOrigin(0, 0.5);
        const pr = txt(this, width / 2 - 108, y + 16, own ? t('owned') : th.gems ? `💎 ${th.gems}` : `🪙 ${th.price}`, 16, own ? '#8ff0b0' : '#ffe58a').setOrigin(0, 0.5);
        const label = cur ? '✓' : own ? t('use') : t('buy');
        const b = button(this, width / 2 + 150, y, 110, 50, label, () => {
          if (cur) return;
          if (!own) { if (!buyTheme(th.id)) { sfx.error && sfx.error(); this.toast(th.gems ? t('needGems') : t('needCoins')); return; } sfx.coin(); track('theme_buy', { id: th.id }); }
          setTheme(th.id); track('theme_set', { id: th.id }); this.bg.setTexture(this.themeBg()); this.refreshHud(); draw();
        }, cur ? 0x2a333a : own ? 0x2ee06a : 0xffb71b, cur ? '#8ff0b0' : '#1a1200', 18);
        this._thRows.push(g, nm, pr, b); c.add([g, nm, pr, b]);
        y += 104;
      }
    };
    draw();
    c.add(button(this, width / 2, height / 2 + 310, 160, 50, '✕', close, 0x2a333a, '#ffffff'));
  }

  // F5: sıralama tabloları (bulut hesabı gerekir; misafir görür ama listede yer almaz)
  ranks(kind = 'level') {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 480, 740);
    const top = height / 2 - 340;
    c.add(txt(this, width / 2, top + 20, `🏆 ${t('ranks')}`, 30, '#ffb71b'));
    const KINDS = [['level', '🗺️', 'rkLevel'], ['stars', '⭐', 'rkStars'], ['spent', '🌾', 'rkSpent'], ['week', '📅', 'rkWeek']];
    let rows = [];
    const clear = () => { rows.forEach((o) => o.destroy()); rows = []; };
    const add = (o) => { rows.push(o); c.add(o); return o; };
    const tabs = KINDS.map(([k, ic, lb], i) => {
      const b = button(this, width / 2 - 171 + i * 114, top + 72, 108, 44, `${ic} ${t(lb)}`, () => load(k), 0x2a333a, '#ffffff', 14);
      c.add(b); return [k, b];
    });
    const acc = account();
    const load = async (k) => {
      kind = k; clear();
      tabs.forEach(([kk, b]) => { const on = kk === k; b.setAlpha(on ? 1 : 0.55).setScale(on ? 1.05 : 1); b.label.setColor(on ? '#ffe58a' : '#ffffff'); });
      add(txt(this, width / 2, top + 120, t(k === 'week' ? 'rkWeekHint' : k === 'spent' ? 'rkSpentHint' : 'rkHint'), 14, '#9fb3a8'));
      const wait = add(txt(this, width / 2, height / 2, '…', 28, '#ffffff'));
      let r;
      try { r = await leaderboard(k); } catch { if (kind === k && c.active) wait.setText(t('rkOffline')); return; }
      if (kind !== k || !c.active) return;
      wait.destroy();
      const list = (r && r.top) || [];
      if (!list.length) add(txt(this, width / 2, height / 2 - 40, t('rkEmpty'), 18, '#cfe3d8'));
      const fmt = (v) => (k === 'level' ? `${t('level')} ${Math.min(v, 200)}` : k === 'week' ? `+${v} ⭐` : k === 'spent' ? `${v} 🌾` : `${v} ⭐`);
      const medal = ['🥇', '🥈', '🥉'];
      list.slice(0, 10).forEach((e, i) => {
        const y = top + 160 + i * 42;
        const g = add(this.add.graphics());
        g.fillStyle(e.me ? 0x2ee06a : i % 2 ? 0x1b2420 : 0x222d28, e.me ? 0.35 : 1); g.fillRoundedRect(width / 2 - 210, y - 18, 420, 38, 10);
        add(txt(this, width / 2 - 182, y, medal[e.rank - 1] || `${e.rank}.`, e.rank <= 3 ? 22 : 17, '#ffe58a'));
        add(txt(this, width / 2 - 150, y, `${e.avatar || '🧑‍🌾'} ${e.name}`, 18, e.me ? '#8ff0b0' : '#ffffff').setOrigin(0, 0.5));
        add(txt(this, width / 2 + 196, y, fmt(e.val), 17, '#ffe58a').setOrigin(1, 0.5));
      });
      const by = top + 160 + 10 * 42 + 20;
      if (acc) {
        const me = r && r.me;
        add(txt(this, width / 2, by, me ? `${t('rkYou')}: #${me.rank} / ${r.total}  ·  ${fmt(me.val)}` : t('rkNotYet'), 18, '#8fe3ff'));
      } else {
        add(txt(this, width / 2, by, t('rkGuest'), 15, '#cfe3d8', { wordWrap: { width: 400 }, align: 'center' }));
        add(button(this, width / 2, by + 56, 300, 50, `☁️ ${t('saveCloud')}`, () => { close(); authForm((ok) => { if (ok) this.scene.restart({}); }); }, 0x3f7bff, '#fff', 18));
      }
      track('leaderboard_view', { kind: k });
    };
    load(kind);
  }

  toast(msg) {
    const { width, height } = this.scale;
    const tt = txt(this, width / 2, height / 2 + 250, msg, 20, '#ffffff').setDepth(2000).setScrollFactor(0).setBackgroundColor('#000000aa').setPadding(12, 6);
    this.tweens.add({ targets: tt, alpha: 0, y: tt.y - 30, delay: 1200, duration: 500, onComplete: () => tt.destroy() });
  }

  settings() {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 400, 470);
    c.add(txt(this, width / 2, height / 2 - 185, t('settings'), 30, '#ffb71b'));
    const pr = save.profile || {};
    const pb = button(this, width / 2, height / 2 - 120, 300, 56, `${pr.avatar || '👤'} ${pr.name || t('profile')}`, () => { close(); this.profile(); }, 0x2ee06a, '#04220e');
    const sb = button(this, width / 2, height / 2 - 50, 300, 56, `${t('sound')}: ${save.sound ? 'ON' : 'OFF'}`, () => { save.sound = !save.sound; persist(); sb.label.setText(`${t('sound')}: ${save.sound ? 'ON' : 'OFF'}`); }, 0x2a333a, '#ffffff');
    const mb = button(this, width / 2, height / 2 + 20, 300, 56, `🎵 ${t('music')}: ${musicOn() ? 'ON' : 'OFF'}`, () => { setMusic(!musicOn()); mb.label.setText(`🎵 ${t('music')}: ${musicOn() ? 'ON' : 'OFF'}`); }, 0x2a333a, '#ffffff');
    const lb = button(this, width / 2, height / 2 + 90, 300, 56, `${t('lang')}: ${getLang().toUpperCase()}`, () => { const l = getLang() === 'tr' ? 'en' : 'tr'; setLang(l); save.lang = l; persist(); close(); this.scene.restart({}); }, 0x2a333a, '#ffffff');
    const pp = txt(this, width / 2, height / 2 + 160, t('privacy'), 16, '#8fe3ff').setInteractive({ useHandCursor: true }).on('pointerup', () => window.open(CONFIG.privacyUrl, '_blank'));
    c.add([pb, sb, mb, lb, pp]);
  }

  // ---- Kayıt alanı: profil, kayıt kodu, veri silme ----
  profile() {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 440, 620);
    const y0 = height / 2 - 270, pr = save.profile || {};
    c.add(txt(this, width / 2, y0 + 10, `👤 ${t('profile')}`, 28, '#ffb71b'));
    const av = txt(this, width / 2, y0 + 80, pr.avatar || '🧑‍🌾', 64).setInteractive({ useHandCursor: true });
    av.on('pointerup', () => { const i = (AVATARS.indexOf(save.profile.avatar) + 1) % AVATARS.length; setProfile({ avatar: AVATARS[i] }); av.setText(AVATARS[i]); });
    c.add(av);
    c.add(txt(this, width / 2, y0 + 130, t('tapAvatar'), 13, '#9fb3a8'));
    const nb = button(this, width / 2, y0 + 180, 320, 52, `✏️ ${pr.name || t('setName')}`, () => {
      nameBox({ title: t('setName'), value: save.profile.name || '', placeholder: t('setName'), onSave: (n) => { if (n) { setProfile({ name: n }); nb.label.setText(`✏️ ${n}`); } } });
    }, 0x2a333a, '#fff', 20);
    c.add(nb);
    c.add(txt(this, width / 2, y0 + 232, `${t('level')} ${save.level}  ·  ⭐ ${totalStars()}  ·  🪙 ${save.coins}`, 17, '#ffe58a'));
    const acc = account();
    c.add(txt(this, width / 2, y0 + 268, acc ? `☁️ ${t('loggedAs')} ${acc.user}` : t('accountHint'), 15, acc ? '#8fe3ff' : '#9fb3a8', { wordWrap: { width: 380 } }));
    c.add(button(this, width / 2, y0 + 318, 320, 52, acc ? `🚪 ${t('logout')}` : `☁️ ${t('saveCloud')}`, () => {
      if (acc) { logout(); close(); this.scene.restart({}); return; }
      close(); authForm((ok) => { if (ok) { this.scene.restart({}); } });
    }, acc ? 0x2a333a : 0x3f7bff, '#fff', 20));
    c.add(button(this, width / 2, y0 + 378, 320, 44, `📋 ${t('copyCode')}`, () => {
      codeBox({ title: `📋 ${t('copyCode')}`, value: exportCode(), readOnly: true, okLabel: `📋 ${t('copyBtn')}` });
    }, 0x2a333a, '#fff', 18));
    c.add(button(this, width / 2, y0 + 430, 320, 44, `📥 ${t('loadCode')}`, () => {
      codeBox({ title: `📥 ${t('loadCode')}`, okLabel: `📥 ${t('loadBtn')}`, onSave: (code) => {
        if (!code || !importCode(code)) return false;
        close(); this.scene.restart({}); return true;
      } });
    }, 0x2a333a, '#fff', 20));
    c.add(button(this, width / 2, y0 + 495, 320, 48, `🗑️ ${t('wipe')}`, async () => {
      if (!window.confirm(t('wipeConfirm'))) return;
      await wipeAll(); close(); this.scene.restart({});
    }, 0xc0392b, '#fff', 20));
  }
  toastMsg(m) {
    const { width, height } = this.scale;
    const tt = txt(this, width / 2, this.cameras.main.scrollY + height - 160, m, 20, '#fff', { backgroundColor: '#000a', padding: { x: 14, y: 8 } }).setDepth(2000);
    this.tweens.add({ targets: tt, alpha: 0, delay: 1400, duration: 400, onComplete: () => tt.destroy() });
  }

}
