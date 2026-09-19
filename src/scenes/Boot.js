import { buildTextures } from '../textures.js';
import { save, tickLives } from '../meta/save.js';
import { setLang, detectLang } from '../i18n.js';
import { track } from '../analytics.js';
import { txt } from '../ui/widgets.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() { this.load.json('levels', 'levels/levels.json'); }
  create() {
    buildTextures(this);
    setLang(save.lang || detectLang());
    tickLives();
    track('session_start', { level: save.level, lang: save.lang });
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a0f0d');
    const t = txt(this, width / 2, height / 2, 'GEM CRUSH', 64, '#ffb71b');
    this.tweens.add({ targets: t, scale: 1.08, yoyo: true, duration: 500, repeat: 1, onComplete: () => this.scene.start('Farm') });
  }
}
