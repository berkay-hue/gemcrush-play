import { CONFIG } from '../config.js';
import { save, persist, tickLives, msToNextLife, addLife, addCoins, spendCoins, dailyStatus, claimDaily, starBalance, AVATARS, setProfile, exportCode, importCode, wipeAll, totalStars, account, logout } from '../meta/save.js';
import { t, setLang, getLang } from '../i18n.js';
import { showRewarded } from '../monetize/ads.js';
import { buy, price, restore } from '../monetize/iap.js';
import { track } from '../analytics.js';
import { sfx } from '../sound.js';
import { txt, button, modal, fmtMs } from '../ui/widgets.js';
import { authForm } from '../ui/authForm.js';

export class Map extends Phaser.Scene {
  constructor() { super('Map'); }

  init(data) { this.openLives = !!(data && data.livesModal); this.openShop = !!(data && data.shop); }

  create() {
    const { width, height } = this.scale;
    this.levels = this.cache.json.get('levels');
    this.cameras.main.setBackgroundColor('#0d1512');
    this.add.image(width / 2, height / 2, 'bgGrad').setDisplaySize(width, height).setScrollFactor(0);
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
      const circ = this.add.circle(0, 0, 30, unlocked ? (lv.wall ? 0xff3b5c : 0xffb71b) : 0x2a333a);
      circ.setStrokeStyle(4, current ? 0xffffff : 0x000000, current ? 1 : 0.4);
      c.add(circ); c.add(this.add.circle(0, -9, 18, 0xffffff, unlocked ? 0.22 : 0.06));
      const n = txt(this, 0, 0, String(lv.id), 22, unlocked ? '#1a1200' : '#7a8590');
      c.add(n);
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
    this.hud.add(txt(this, width / 2, 36, 'GEM CRUSH', 26, '#ffb71b'));
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
    const { width, height } = this.scale;
    const { c, close } = modal(this, 460, 620);
    c.add(txt(this, width / 2, height / 2 - 270, t('shop'), 34, '#ffb71b'));
    let y = height / 2 - 200;
    // free coins via ad
    c.add(button(this, width / 2, y, 400, 60, `📺 ${t('watchAd')} · +${CONFIG.ads.rewardedCoins}`, async () => {
      if (await showRewarded('shop_coins')) { addCoins(CONFIG.ads.rewardedCoins); sfx.coin(); this.refreshHud(); }
    }, 0x3f7bff, '#ffffff', 20));
    y += 80;
    for (const p of CONFIG.iap.products) {
      if (p.removeAds && save.removeAds) continue;
      const label = p.removeAds ? `🚫 ${t('removeAds')} +${p.coins}` : p.gems ? `💎 ${p.gems}` : `🪙 ${p.coins} ${t('coins')}`;
      const b = button(this, width / 2, y, 400, 64, `${label}   ${price(p)}`, async () => { if (await buy(p)) { sfx.coin(); this.refreshHud(); } }, p.badge === 'best' ? 0x2ee06a : 0xffb71b, '#1a1200', 20);
      c.add(b);
      if (p.badge) c.add(txt(this, width / 2 + 170, y - 28, p.badge === 'best' ? 'BEST' : 'POPULAR', 12, '#ff3b5c'));
      y += 78;
    }
    c.add(button(this, width / 2, y + 10, 260, 44, t('restore'), () => restore(), 0x2a333a, '#ffffff', 16));
    c.add(button(this, width / 2, height / 2 + 270, 160, 50, '✕', close, 0x2a333a, '#ffffff'));
  }

  settings() {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 400, 400);
    c.add(txt(this, width / 2, height / 2 - 150, t('settings'), 30, '#ffb71b'));
    const pr = save.profile || {};
    const pb = button(this, width / 2, height / 2 - 80, 300, 56, `${pr.avatar || '👤'} ${pr.name || t('profile')}`, () => { close(); this.profile(); }, 0x2ee06a, '#04220e');
    const sb = button(this, width / 2, height / 2 - 10, 300, 56, `${t('sound')}: ${save.sound ? 'ON' : 'OFF'}`, () => { save.sound = !save.sound; persist(); sb.label.setText(`${t('sound')}: ${save.sound ? 'ON' : 'OFF'}`); }, 0x2a333a, '#ffffff');
    const lb = button(this, width / 2, height / 2 + 60, 300, 56, `${t('lang')}: ${getLang().toUpperCase()}`, () => { const l = getLang() === 'tr' ? 'en' : 'tr'; setLang(l); save.lang = l; persist(); close(); this.scene.restart(); }, 0x2a333a, '#ffffff');
    const pp = txt(this, width / 2, height / 2 + 130, t('privacy'), 16, '#8fe3ff').setInteractive({ useHandCursor: true }).on('pointerup', () => window.open(CONFIG.privacyUrl, '_blank'));
    c.add([pb, sb, lb, pp]);
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
      const n = (window.prompt(t('setName'), save.profile.name || '') || '').trim().slice(0, 16);
      if (n) { setProfile({ name: n }); nb.label.setText(`✏️ ${n}`); }
    }, 0x2a333a, '#fff', 20);
    c.add(nb);
    c.add(txt(this, width / 2, y0 + 232, `${t('level')} ${save.level}  ·  ⭐ ${totalStars()}  ·  🪙 ${save.coins}`, 17, '#ffe58a'));
    const acc = account();
    c.add(txt(this, width / 2, y0 + 268, acc ? `☁️ ${t('loggedAs')} ${acc.user}` : t('accountHint'), 15, acc ? '#8fe3ff' : '#9fb3a8', { wordWrap: { width: 380 } }));
    c.add(button(this, width / 2, y0 + 318, 320, 52, acc ? `🚪 ${t('logout')}` : `☁️ ${t('saveCloud')}`, () => {
      if (acc) { logout(); close(); this.scene.restart(); return; }
      close(); authForm((ok) => { if (ok) { this.scene.restart(); } });
    }, acc ? 0x2a333a : 0x3f7bff, '#fff', 20));
    c.add(button(this, width / 2, y0 + 378, 320, 44, `📋 ${t('copyCode')}`, async () => {
      const code = exportCode();
      try { await navigator.clipboard.writeText(code); this.toastMsg(t('copied')); } catch { window.prompt(t('copyCode'), code); }
    }, 0x2a333a, '#fff', 18));
    c.add(button(this, width / 2, y0 + 430, 320, 44, `📥 ${t('loadCode')}`, () => {
      const code = window.prompt(t('loadCode'));
      if (!code) return;
      if (importCode(code)) { close(); this.scene.restart(); } else this.toastMsg(t('badCode'));
    }, 0x2a333a, '#fff', 20));
    c.add(button(this, width / 2, y0 + 495, 320, 48, `🗑️ ${t('wipe')}`, async () => {
      if (!window.confirm(t('wipeConfirm'))) return;
      await wipeAll(); close(); this.scene.restart();
    }, 0xc0392b, '#fff', 20));
  }
  toastMsg(m) {
    const { width, height } = this.scale;
    const tt = txt(this, width / 2, this.cameras.main.scrollY + height - 160, m, 20, '#fff', { backgroundColor: '#000a', padding: { x: 14, y: 8 } }).setDepth(2000);
    this.tweens.add({ targets: tt, alpha: 0, delay: 1400, duration: 400, onComplete: () => tt.destroy() });
  }

}
