// F20: tepkili kuzu — konuşma balonu, dokunma tepkileri, duruma göre laf, olaylara sevinç/üzüntü
import { save } from '../meta/save.js';
import { item, status } from '../meta/farm.js';
import { cropState } from '../meta/crops.js';
import { hunger, feedLeft, isSick } from '../meta/animals.js';
import { energy } from '../meta/energy.js';
import { weatherNow, hourNow } from '../farm3d/ambience.js';
import { sfx } from '../sound.js';
import { txt } from '../ui/widgets.js';
import { farmTitle } from '../ui/farmTitle.js';
import { getLang } from '../i18n.js';

const L = (tr, en) => (getLang() === 'en' ? en : tr);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const LambMixin = {
  setupLamb(data = {}) {
    const w = this.w3;
    const zone = this.add.zone(0, 0, 60, 90).setOrigin(0.5, 1).setDepth(1).setInteractive({ useHandCursor: true });
    this._lambTaps = [];
    zone.on('pointerup', () => this.lambTap());
    this.events.on('update', () => {
      const [LX, LZ] = w.mascotPos || [-7.3, 1.1];
      const a = w.project(LX, 0, LZ), b = w.project(LX, 2.6, LZ);
      const h = Math.max(24, Math.min(260, a.y - b.y));
      zone.setSize(h * 0.7, h).setPosition(a.x, a.y);
      if (zone.input) zone.input.hitArea.setSize(h * 0.7, h);
      const vis = a.vis && a.y > 90 && a.y < 900; zone.setVisible(vis);
      const bb = this.lambBubble;
      if (bb && bb.active) { bb.x = Math.max(bb.halfW + 8, Math.min(540 - bb.halfW - 8, b.x)); bb.y = Math.max(bb.hH + 100, b.y - 6); bb.tail.x = Math.max(-bb.halfW + 18, Math.min(bb.halfW - 18, b.x - bb.x)); bb.setVisible(vis); }
    });
    // açılış: alışveriş sonrası dans, yoksa selam
    this.time.delayedCall(1600, () => {
      if (data.dlg) this.lambReact('dance', pick([L('Yeni bir şey! Çok güzel olmuş 🤩', 'Something new! Looks great 🤩'), L('Bayıldım! Hemen yerleşelim 🎉', 'Love it! Let’s settle in 🎉')]));
      else this.lambReact('wave', this.lambGreeting());
    });
    // boşta laf: 35–55 sn'de bir
    const idle = () => { this._lambIdle = this.time.delayedCall(35000 + Math.random() * 20000, () => { if (!this.placing && !this.card && !w.mascotSleep) this.lambSay(this.lambLine()); idle(); }); };
    idle();
  },

  lambGreeting() {
    const h = hourNow(), name = farmTitle();
    const hi = h < 5 ? L('Hâlâ uyanık mısın? 🌙', 'Still awake? 🌙') : h < 12 ? L('Günaydın çiftçi! ☀️', 'Morning, farmer! ☀️') : h < 18 ? L('Hoş geldin! 🌾', 'Welcome back! 🌾') : L('İyi akşamlar! 🌆', 'Good evening! 🌆');
    return Math.random() < 0.4 && name ? `${hi}\n${name}` : hi;
  },

  // duruma göre söylenecek şey (öncelik: acil durum → fırsat → hava → sohbet)
  lambLine() {
    const cat = save.farm && save.farm.pos ? Object.keys(save.farm.pos) : [];
    const ids = Object.keys((this.w3 && this.w3.items) || {}).concat(cat);
    const own = [...new Set(ids)].filter((id) => item(id) && status(id) === 'owned');
    const ready = own.filter((id) => item(id).kind === 'plot' && cropState(id) === 'ready').length;
    const sick = own.filter((id) => item(id).kind === 'animal' && isSick(id)).length;
    const hungry = own.filter((id) => item(id).kind === 'animal' && !isSick(id) && feedLeft(id) === 0 && hunger(id) < 50).length;
    const wx = weatherNow(), h = hourNow();
    const out = [];
    if (sick) out.push(L('Bir hayvanımız hasta 🤒 veterineri çağıralım mı?', 'One of our animals is sick 🤒'));
    if (hungry) out.push(L(`Karnı acıkanlar var 🪣 kovayı sürükle!`, 'Some animals are hungry 🪣 drag the bucket!'));
    if (ready) out.push(ready > 1 ? L(`${ready} tarla hazır! Parmağınla süpür ✋`, `${ready} fields ready! Swipe them ✋`) : L('Bir tarla hasat bekliyor 🌾', 'A field is ready 🌾'));
    if (out.length) return out[0];
    if (wx === 'yagmur') out.push(L('Yağmur tarlalara iyi gelir 🌧️', 'Rain is good for crops 🌧️'), L('Şapkam ıslandı ama olsun 😅', 'My hat’s wet, oh well 😅'));
    if (wx === 'ruzgar') out.push(L('Değirmen bugün çok hızlı dönüyor 💨', 'The windmill is flying today 💨'));
    if (h >= 20 || h < 6) out.push(L('Ateşböceklerini gördün mü? ✨', 'Seen the fireflies? ✨'), L('Birazdan uyurum… 😴', 'I’ll sleep soon… 😴'));
    if (energy() > 0) out.push(L('Bir bölüm oynayalım mı? 💎', 'Play a level? 💎'));
    out.push(L('Bu çiftlik her gün daha güzel 💛', 'This farm gets better every day 💛'), L('Tavuklar yine zıplıyor 🐔', 'The chickens are hopping again 🐔'),
      L('Yabamı kimse görmesin, yeni cilaladım ✨', 'Just polished my pitchfork ✨'), L('Bana dokunursan dans ederim 💃', 'Tap me and I dance 💃'));
    return pick(out);
  },

  lambTap() {
    const now = Date.now();
    this._lambTaps = this._lambTaps.filter((t0) => now - t0 < 1800); this._lambTaps.push(now);
    sfx.click();
    if (this.w3.mascotSleep) { this._lambWake = now; return this.lambReact('joy', L('Hı? Uyuyordum… 😪', 'Huh? I was asleep… 😪')); }
    if (this._lambTaps.length >= 4) { this._lambTaps = []; return this.lambReact('dance', pick([L('Dans zamanı! 💃🕺', 'Dance time! 💃🕺'), L('Ritmi hissediyorum 🎶', 'Feel the beat 🎶')])); }
    this.lambReact(Math.random() < 0.5 ? 'joy' : 'wave', this.lambLine());
  },

  // mood: joy | sad | wave | dance
  lambReact(mood, line) {
    const w = this.w3;
    if (w.mascotReact) w.mascotReact(mood);
    if (line) this.lambSay(line, mood === 'sad' ? '#6a4b8c' : '#3a2a00');
  },

  lambSay(msg, color = '#3a2a00') {
    if (this.lambBubble) this.lambBubble.destroy();
    const c = this.add.container(270, 300).setDepth(940);
    const t0 = txt(this, 0, 0, msg, 17, color, { align: 'center', wordWrap: { width: 230 } }).setOrigin(0.5);
    const W = Math.max(90, t0.width + 30), H = t0.height + 22;
    const g = this.add.graphics();
    g.fillStyle(0x0a0f0d, 0.18).fillRoundedRect(-W / 2 + 3, -H + 3, W, H, 16);
    g.fillStyle(0xfffaf0, 1).fillRoundedRect(-W / 2, -H, W, H, 16).lineStyle(3, 0xffb71b, 1).strokeRoundedRect(-W / 2, -H, W, H, 16);
    const tail = this.add.triangle(0, 0, -9, -3, 9, -3, 0, 12, 0xfffaf0).setOrigin(0.5, 0).setStrokeStyle(0);
    t0.setY(-H / 2);
    c.add([g, tail, t0]); c.halfW = W / 2; c.hH = H; c.tail = tail;
    c.setScale(0.3); c.alpha = 0;
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.lambBubble = c;
    this.time.delayedCall(2600 + msg.length * 45, () => { if (this.lambBubble === c) this.tweens.add({ targets: c, alpha: 0, scale: 0.8, duration: 220, onComplete: () => { c.destroy(); if (this.lambBubble === c) this.lambBubble = null; } }); });
  },
};
