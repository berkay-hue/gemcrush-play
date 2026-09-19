import { buildTextures } from '../textures.js';
import { save, tickLives, account, syncOnBoot } from '../meta/save.js';
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
    const logo = txt(this, width / 2, height / 2, 'GEM CRUSH', 64, '#ffb71b');
    this.tweens.add({ targets: logo, scale: 1.08, yoyo: true, duration: 500, repeat: 1, onComplete: async () => {
      // hesap yoksa oyun giriş ekranıyla açılır; "hesapsız devam" her zaman mümkün
      if (!account()) await new Promise((res) => authForm(res, t('guest')));
      await synced;
      this.scene.start('Farm');
    } });
  }
}
