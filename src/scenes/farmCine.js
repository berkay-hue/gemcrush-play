// F21: açılış sahnesi (sinema bantları + başlık) ve kartpostal düğmesi
import { farmTitle } from '../ui/farmTitle.js';
import { getLang } from '../i18n.js';
import { weatherNow, hourNow } from '../farm3d/ambience.js';
import { txt } from '../ui/widgets.js';
import { postcard } from '../ui/cinema.js';
import { sfx } from '../sound.js';

const L = (tr, en) => (getLang() === 'en' ? en : tr);

export const CineMixin = {
  opening() {
    const { width, height } = this.scale, B = 96, D = 60;
    const top = this.add.rectangle(width / 2, -B / 2, width, B, 0x000000).setDepth(D);
    const bot = this.add.rectangle(width / 2, height + B / 2, width, B, 0x000000).setDepth(D);
    const h = hourNow();
    const greet = h < 6 ? L('İyi geceler', 'Good night') : h < 12 ? L('Günaydın', 'Good morning') : h < 18 ? L('İyi günler', 'Good afternoon') : L('İyi akşamlar', 'Good evening');
    const wx = { yagmur: L('🌧 yağmurlu', '🌧 rainy'), ruzgar: L('🍃 rüzgârlı', '🍃 windy'), acik: L('☀️ açık', '☀️ clear') }[weatherNow()] || '';
    const date = new Date().toLocaleDateString(getLang() === 'en' ? 'en-US' : 'tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
    const title = txt(this, width / 2, height * 0.42, farmTitle(), 44, '#ffd23f').setDepth(D + 1).setAlpha(0).setScale(0.85);
    title.setStroke && title.setStroke('#3a2410', 8);
    const sub = txt(this, width / 2, height * 0.42 + 46, `${greet} · ${date} · ${wx}`, 17, '#ffffff').setDepth(D + 1).setAlpha(0);
    const catcher = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.001).setDepth(D + 2).setInteractive();
    const parts = [top, bot, title, sub, catcher];
    let done = false;
    const end = () => {
      if (done) return; done = true; catcher.destroy();
      this.tweens.add({ targets: [title, sub], alpha: 0, y: '-=16', duration: 380 });
      this.tweens.add({ targets: top, y: -B / 2, duration: 520, ease: 'Cubic.In' });
      this.tweens.add({ targets: bot, y: height + B / 2, duration: 520, ease: 'Cubic.In', onComplete: () => parts.forEach((p) => p.active && p.destroy()) });
    };
    this.tweens.add({ targets: top, y: B / 2, duration: 520, ease: 'Cubic.Out' });
    this.tweens.add({ targets: bot, y: height - B / 2, duration: 520, ease: 'Cubic.Out' });
    this.tweens.add({ targets: title, alpha: 1, scale: 1, delay: 380, duration: 700, ease: 'Back.Out' });
    this.tweens.add({ targets: sub, alpha: 0.92, delay: 800, duration: 600 });
    catcher.on('pointerup', end);
    this.time.delayedCall(2800, end);
    this.events.once('shutdown', () => { done = true; });
  },

  async snap() {
    if (this._snapping) return; this._snapping = true;
    const { width, height } = this.scale;
    const fl = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 1).setDepth(80);
    this.tweens.add({ targets: fl, alpha: 0, duration: 450, onComplete: () => fl.destroy() });
    try { sfx.special && sfx.special(); } catch {}
    try {
      const r = await postcard(this.w3, this.game);
      if (r !== 'cancel') this.toast(r === 'shared' ? L('💌 Kartpostal gönderildi!', '💌 Postcard shared!') : L('💌 Kartpostal hazır — indirildi!', '💌 Postcard ready — downloaded!'));
    } catch { this.toast(L('Kartpostal oluşturulamadı', 'Could not make postcard')); }
    this._snapping = false;
  },
};
