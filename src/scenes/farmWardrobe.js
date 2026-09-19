// F27: Kuzucuk'un gardırobu — şapka / tulum / aksesuar; 3D kuzu anında giyinir
import { save } from '../meta/save.js';
import { SLOTS, WARDROBE, look, owns, locked, worn, buy, wear } from '../meta/wardrobe.js';
import { txt, button, modal, card } from '../ui/widgets.js';
import { getLang } from '../i18n.js';
import { sfx } from '../sound.js';
import { track } from '../analytics.js';

const L = (tr, en) => (getLang() === 'en' ? en : tr);
const TAB = { hat: ['👒', 'Şapka', 'Hats'], suit: ['👕', 'Tulum', 'Overalls'], acc: ['🎀', 'Aksesuar', 'Extras'] };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export const WardrobeMixin = {
  wardrobe(slot = 'hat') {
    const { width, height } = this.scale;
    const H = 800, top = height / 2 - H / 2;
    const { c, close } = modal(this, 500, H);
    c.add(txt(this, width / 2, top + 36, L('👕 Kuzucuk’un Gardırobu', '👕 Lambkin’s Wardrobe'), 24, '#ffb71b'));
    c.add(txt(this, width / 2, top + 68, L('Giydir, kuzu çiftlikte hemen giyer!', 'Dress up — Lambkin wears it on the farm!'), 15, '#cfe8d8'));
    let body = null;
    const draw = () => {
      if (body) body.destroy();
      body = this.add.container(0, 0); c.add(body);
      // sekmeler
      SLOTS.forEach((s, i) => {
        const on = s === slot, [ic, tr, en] = TAB[s];
        body.add(button(this, width / 2 + (i - 1) * 150, top + 112, 140, 44, `${ic} ${L(tr, en)}`, () => { if (!on) { slot = s; sfx.click(); draw(); } }, on ? 0xffb71b : 0x2a333a, on ? '#1a1200' : '#fff', 17));
      });
      const list = WARDROBE.filter((w) => w.slot === slot), cw = 140, ch = 160;
      list.forEach((w, i) => {
        const x = width / 2 + ((i % 3) - 1) * (cw + 12), y = top + 230 + Math.floor(i / 3) * (ch + 14);
        const isW = worn(w.id), own = owns(w.id), lk = !own && locked(w.id);
        body.add(card(this, x, y, cw, ch, { accent: isW ? 0xffb71b : 0xffffff, accentA: isW ? 0.9 : 0.14, glow: isW, r: 16 }));
        if (w.color != null) {
          const g = this.add.graphics();
          g.fillStyle(0x000000, 0.3).fillRoundedRect(x - 30, y - 50, 60, 52, 12);
          g.fillStyle(w.color).fillRoundedRect(x - 30, y - 54, 60, 52, 12);
          g.fillStyle(0xffffff, w.metal ? 0.45 : 0.18).fillRoundedRect(x - 26, y - 51, 52, 16, 8);
          g.fillStyle(0xffc640).fillRect(x - 6, y - 38, 12, 8); // düğme
          body.add(g);
        } else body.add(txt(this, x, y - 28, w.emoji, 46));
        body.add(txt(this, x, y + 16, L(w.name.tr, w.name.en), 15, '#fff'));
        let lab, col = 0x2e9e4f, tc = '#fff';
        if (isW) { lab = L('Giyili ✓', 'Wearing ✓'); col = 0x44505a; }
        else if (own) lab = L('Giy', 'Wear');
        else if (lk) { lab = `🔒 ${L('Sv', 'Lv')} ${w.lvl}`; col = 0x44505a; }
        else if (w.cost.g) { lab = `💎 ${w.cost.g}`; col = 0x7b4fc9; }
        else { lab = `🪙 ${w.cost.c}`; col = 0xffb71b; tc = '#1a1200'; }
        body.add(button(this, x, y + 54, 112, 38, lab, () => this.wardrobePick(w, draw), col, tc, 16));
      });
    };
    draw();
    c.add(button(this, width / 2, top + H - 50, 220, 52, L('Tamam', 'Done'), close, 0x2e9e4f, '#fff', 22));
  },

  wardrobePick(w, redraw) {
    if (worn(w.id)) return;
    if (!owns(w.id)) {
      const r = buy(w.id);
      if (r === 'locked') { this.toast(L(`🔒 Seviye ${w.lvl}’te açılır`, `🔒 Unlocks at level ${w.lvl}`)); return; }
      if (r === 'coins') { this.toast(L('Yeterli para yok 🪙', 'Not enough coins 🪙')); return; }
      if (r === 'gems') { this.toast(L('Yeterli elmas yok 💎', 'Not enough gems 💎')); return; }
      track('wardrobe_buy', { id: w.id });
      sfx.coin();
    }
    wear(w.id); sfx.click();
    this.w3 && this.w3.mascotDress && this.w3.mascotDress(look());
    this.refreshHud && this.refreshHud();
    this.lambReact && this.lambReact('dance', L('Yakıştı mı? 😍', 'How do I look? 😍'));
    redraw();
  },
};
