import { buildTextures } from '../textures.js';
import { save, tickLives, account, syncOnBoot, settlePendingLevel } from '../meta/save.js';
import { authForm } from '../ui/authForm.js';
import { setLang, detectLang, t } from '../i18n.js';
import { track } from '../analytics.js';
import { txt } from '../ui/widgets.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() { this.load.json('levels', 'levels/levels.json'); }
  create() {
    buildTextures(this);
    setLang(save.lang || detectLang());
    const synced = account() ? syncOnBoot().catch(() => {}) : Promise.resolve();
    tickLives();
    track('session_start', { level: save.level, lang: save.lang });
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a0f0d');
    // yazı tipi hazır olmadan metin çizme (Phaser metni ilk çizimde dokuya yakar)
    const fontReady = (document.fonts ? Promise.race([document.fonts.load('800 24px "Baloo 2"'), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve()).catch(() => {});
    fontReady.then(() => this.splash(width, height, synced));
  }

  splash(width, height, synced) {
    // yeşil-siyah degrade zemin + ortada sıcak ışıma
    const g = this.add.graphics();
    g.fillGradientStyle(0x173a2e, 0x173a2e, 0x060a08, 0x060a08, 1); g.fillRect(0, 0, width, height);
    if (this.textures.exists('glow')) this.add.image(width / 2, height * 0.42, 'glow').setTint(0xffb71b).setAlpha(0.35).setScale(6);
    // süzülen taşlar
    const n = Object.keys(this.textures.list).filter((k) => /^gem\d+$/.test(k)).length || 5;
    for (let i = 0; i < 14; i++) {
      const gem = this.add.image(Phaser.Math.Between(20, width - 20), Phaser.Math.Between(height * 0.05, height * 0.95), `gem${i % n}`)
        .setScale(Phaser.Math.FloatBetween(0.35, 0.7)).setAlpha(Phaser.Math.FloatBetween(0.25, 0.6)).setAngle(Phaser.Math.Between(-20, 20));
      this.tweens.add({ targets: gem, y: gem.y - Phaser.Math.Between(20, 50), angle: gem.angle + Phaser.Math.Between(-15, 15), duration: Phaser.Math.Between(1800, 3200), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    const logo = txt(this, width / 2, height * 0.42, 'GEM CRUSH', 68, '#ffb71b')
      .setStroke('#5a3500', 10).setShadow(0, 6, '#000000', 10, true, true).setScale(0.6).setAlpha(0);
    const sub = txt(this, width / 2, height * 0.42 + 62, t('splashTag'), 22, '#f5f4eb').setAlpha(0);
    // yükleme çubuğu
    const bw = Math.min(260, width * 0.6), by = height * 0.72;
    const bar = this.add.graphics();
    bar.fillStyle(0x000000, 0.45).fillRoundedRect(width / 2 - bw / 2, by - 7, bw, 14, 7);
    const fill = this.add.graphics(); const prog = { p: 0 };
    const draw = () => { fill.clear(); fill.fillStyle(0xffb71b, 1).fillRoundedRect(width / 2 - bw / 2 + 2, by - 5, Math.max(10, (bw - 4) * prog.p), 10, 5); };
    draw();
    this.tweens.add({ targets: logo, scale: 1, alpha: 1, duration: 520, ease: 'Back.Out' });
    this.tweens.add({ targets: sub, alpha: 0.9, delay: 250, duration: 400 });
    this.tweens.add({ targets: logo, scale: 1.04, delay: 600, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: prog, p: 1, duration: 1000, ease: 'Sine.InOut', onUpdate: draw, onComplete: async () => {
      // hesap yoksa oyun giriş ekranıyla açılır; "hesapsız devam" her zaman mümkün
      if (!account()) await new Promise((res) => authForm(res, t('guest')));
      await synced;
      this.cameras.main.fadeOut(220, 10, 15, 13);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Farm'));
    } });
  }
}
