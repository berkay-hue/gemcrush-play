// F9: arkadaş çiftliği ziyareti — aynı 3D dünya, arkadaşın kaydıyla salt-okunur çizilir; Geri → kendi çiftliğin
import { t, getLang } from '../i18n.js';
import { txt, button } from '../ui/widgets.js';
import { possessive } from '../ui/farmTitle.js';
import { getWorld } from '../farm3d/FarmWorld.js';
import { CATALOG, ARSA } from '../meta/farm.js';
import { PETS } from '../meta/bond.js';
import { themeById } from '../meta/themes.js';
import { helpFriend, publicWater, account } from '../meta/save.js';
import { clearLink } from '../meta/link.js';
import { authForm } from '../ui/authForm.js';
import { track } from '../analytics.js';

export class Visit extends Phaser.Scene {
  constructor() { super('Visit'); }

  create({ f, guest }) {
    const { width, height } = this.scale;
    const w = this.w3 = getWorld();
    const farm = (f && f.farm) || {};
    const owned = Array.isArray(farm.owned) ? farm.owned : [];
    const plots = Array.isArray(farm.plots) ? farm.plots : [];
    if (w) {
      this.cameras.main.transparent = true;
      this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
      w.show();
      w.posOf = (id) => (farm.pos || {})[id] || null; w.tmpPos = null;
      w.setPlots(ARSA.map((a) => ({ ...a, owned: plots.includes(a.id) })));
      w.setTheme(themeById(f.theme));
      for (const it of CATALOG) {
        const has = owned.includes(it.id);
        w.setItem(it.id, has ? 'owned' : 'hidden', it.kind === 'plot' ? { crop: '', growth: 0 } : { lv: (farm.lv || {})[it.id] });
      }
      for (const id in PETS) w.setItem(id, 'hidden');
      this.events.once('shutdown', () => w.hide());
      // yalnız gezinme: sürükle = kaydır, kıstır/tekerlek = yakınlaş
      const pad = this.add.zone(0, 0, width, height).setOrigin(0).setInteractive().setDepth(-10);
      let last = null, pinch = 0;
      pad.on('pointerdown', (p) => { last = { x: p.x, y: p.y }; });
      this.input.on('pointermove', (p) => {
        const a = this.input.pointer1, b = this.input.pointer2;
        if (a && b && a.isDown && b.isDown) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) w.zoomBy(pinch / d); pinch = d; return; }
        pinch = 0;
        if (!last || !p.isDown) return;
        w.pan(p.x - last.x, p.y - last.y); last = { x: p.x, y: p.y };
      });
      this.input.on('pointerup', () => { last = null; pinch = 0; });
      this.input.on('wheel', (_p, _o, _dx, dy) => w.zoomBy(dy > 0 ? 1.08 : 0.93));
    } else this.cameras.main.setBackgroundColor('#7cc36a');

    const g = this.add.graphics();
    g.fillStyle(0x0f1f17, 0.42).fillRoundedRect(width / 2 - 170, 12, 340, 62, 31);
    txt(this, width / 2, 34, `${(f && f.avatar) || '🧑‍🌾'} ${getLang() === 'en' ? `${(f && f.name) || '?'}'s Farm` : `${possessive((f && f.name) || '?')} Çiftliği`}`, 21, '#f5f4eb').setShadow(0, 2, 'rgba(10,15,13,0.6)', 6, false, true);
    txt(this, width / 2, 58, `👀 ${t('frVisiting')} · ${t('level')} ${(f && f.level) || 1}`, 14, '#ffe7a3').setAlpha(0.9);
    // F36: linkten gelen misafir — günde 1 sulama + kendi çiftliğini kur
    if (guest && f && f.code) {
      const cnt = txt(this, width / 2, 82, `💧 ${f.waters || 0} ${t('lkWaters')}`, 14, '#bfe9ff').setShadow(0, 2, 'rgba(10,15,13,0.6)', 6, false, true);
      const note = txt(this, width / 2, height - 208, '', 15, '#ffe7a3').setShadow(0, 2, 'rgba(10,15,13,0.7)', 6, false, true);
      let busy = false, done = false;
      const wb = button(this, width / 2, height - 150, 260, 60, `💧 ${t('lkWater')}`, async () => {
        if (busy || done) return; busy = true;
        try { const r = await publicWater(f.code); done = true; track('link_water'); cnt.setText(`💧 ${r.waters} ${t('lkWaters')}`); note.setText(`🌱 ${t('lkWatered')}`).setColor('#8ff0b0'); if (w && w.burst) owned.slice(0, 8).forEach((id) => w.burst(id, 0x6fd3ff, 12)); }
        catch (er) { const m = String(er.message); done = /bugun|dolu/.test(m); note.setText(m.includes('bugun') ? t('lkToday') : m.includes('dolu') ? t('lkFull') : `⚠️ ${t('rkOffline')}`).setColor('#ffe7a3'); }
        busy = false; if (done) wb.setAlpha(0.5);
      }, 0x2ee06a, '#04220e', 22);
      button(this, width / 2, height - 72, 260, 60, `🌱 ${t('lkMine')}`, async () => {
        clearLink(); track('link_join');
        if (!account()) await new Promise((res) => authForm(res, t('guest')));
        this.scene.start('Farm');
      }, 0xffb71b, '#1a1200', 20);
      return;
    }
    // F11: yardım et — ekinleri sula / hayvanları besle; ikiniz de ödül alırsınız (günde 1)
    if (f && f.code) {
      const note = txt(this, width / 2, height - 172, '', 16, '#ffe7a3').setShadow(0, 2, 'rgba(10,15,13,0.7)', 6, false, true);
      let busy = false;
      const hb = button(this, width / 2, height - 132, 240, 56, `💧 ${t('frHelp')}`, async () => {
        if (busy) return; busy = true;
        try { await helpFriend(f.code); track('friend_help'); note.setText(`🌱 ${t('frHelped')}`).setColor('#8ff0b0'); if (w && w.burst) owned.slice(0, 6).forEach((id) => w.burst(id, 0x6fd3ff, 10)); }
        catch (er) { note.setText(String(er.message).includes('bugun') ? t('frHelpedToday') : `⚠️ ${t('rkOffline')}`).setColor('#ffe7a3'); }
        hb.setAlpha(0.5);
      }, 0x2ee06a, '#04220e', 20);
    }
    button(this, width / 2, height - 60, 240, 64, `⬅ ${t('frBack')}`, () => this.scene.start('Farm'), 0xffb71b, '#1a1200', 22);
  }
}
