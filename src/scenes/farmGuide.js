// F25: Kuzucuk'un rehberi — ilk girişte bir kez açılır, sonra ❓ düğmesinden. Çiftlikte ne neye yarar, kuzu anlatır.
import { save, persist } from '../meta/save.js';
import { txt, button, modal } from '../ui/widgets.js';
import { getLang } from '../i18n.js';
import { sfx } from '../sound.js';
import { track } from '../analytics.js';

const L = (tr, en) => (getLang() === 'en' ? en : tr);
// [büyük ikon, başlık, anlatım]
export const GUIDE = [
  ['👋', ['Merhaba!', 'Hi there!'], ['Ben Kuzucuk, çiftliğin rehberiyim. Sana her şeyin ne işe yaradığını anlatacağım!', 'I’m Lambkin, your farm guide. Let me show you what everything does!']],
  ['⭐', ['Oyna, yıldız kazan', 'Play, earn stars'], ['Şeker bölümlerini oyna. Her kazanç ⭐ yıldız verir. Yıldızlarla bina, hayvan ve tarla alırsın.', 'Play candy levels. Every win gives ⭐ stars. Spend stars on buildings, animals and fields.']],
  ['🌾', ['Tarla ve tohum', 'Fields & seeds'], ['Tarlana dokun, istediğin tohumu seç. Ürün gerçek zamanda büyür; her bölüm kazanman süreyi 5 dk kısaltır. Hazır olunca parmağınla tarlanın üstünden geçip biç!', 'Tap a field and pick any seed. Crops grow in real time; every level win cuts 5 min. When ripe, swipe across fields to harvest!']],
  ['🥚', ['Yumurta nasıl çıkar?', 'Where do eggs come from?'], ['Önce 🛖 Kümes, sonra 🐔 tavuk al. Tavuklar her saat yumurtlar; kaç tavuğun varsa o kadar yumurta! Her hayvandan en fazla 4 tane alabilirsin.', 'Buy a 🛖 Coop, then a 🐔 hen. Hens lay every hour — more hens, more eggs! You can own up to 4 of each animal.']],
  ['🧺', ['Ürünler ne işe yarar?', 'What are goods for?'], ['Yumurta, süt, yün, mısır ambara gider. Pazarda 🪙 paraya sat, siparişleri teslim et ya da Takas’ta güçlendiriciye çevir: 🌽🌽+🥚 = +5 hamle!', 'Eggs, milk, wool and corn go to the storehouse. Sell them for 🪙, deliver orders, or trade them for boosters: 🌽🌽+🥚 = +5 moves!']],
  ['🐄', ['Hayvanların süper gücü', 'Animal superpowers'], ['Her hayvan oyunda yardım eder: 🐓 horoz her bölüme +2 hamle, 🐑 koyun can iade eder, 🐎 at bedava karıştırma verir. Ahır hayvanlarını besle, aç kalırsa hastalanır!', 'Animals help in levels: 🐓 +2 moves, 🐑 refunds lives, 🐎 free shuffle. Feed barn animals or they get sick!']],
  ['🚜', ['Traktör ne yapar?', 'What does the tractor do?'], ['Traktör (seviye 20) hazır ekinleri kendisi biçer ve hemen yeniden eker. Sen oyundayken bile tarla çalışmaya devam eder!', 'The tractor (level 20) harvests ripe crops and replants them on its own. Your fields keep working while you play!']],
  ['📋', ['Siparişler ve ambar', 'Orders & storehouse'], ['Köylüler panoda ürün ister. Teslim et → 🪙 para + XP ile çiftlik seviyen artar. Ambar dolarsa 🏚️ yükselt.', 'Villagers post orders. Deliver → 🪙 + XP to level up your farm. Storehouse full? Upgrade it 🏚️.']],
  ['⚡', ['Enerji ve elmas', 'Energy & gems'], ['Çiftlik işleri ⚡ enerji harcar, zamanla kendiliğinden dolar. 💎 elmasla beklemeyi atlarsın.', 'Farm chores use ⚡ energy, which refills over time. 💎 gems skip any wait.']],
  ['🎉', ['Hazırsın!', 'You’re ready!'], ['Takılırsan sağdaki ❓ düğmesine bas, ben hep buradayım. Hadi çiftliği büyütelim!', 'Stuck? Tap the ❓ button on the right, I’m always here. Let’s grow the farm!']],
];

export const guideSeen = () => !!(save.farm && save.farm.guide);
export function markGuide() { save.farm.guide = 1; persist(); }

// Prosedürel kuzu portresi (yün bulutu + yüz)
function lamb(scene, x, y, s = 1) {
  const g = scene.add.graphics();
  const wool = [[0, -34, 26], [-26, -22, 22], [26, -22, 22], [-34, 4, 20], [34, 4, 20], [-18, 26, 20], [18, 26, 20], [0, 30, 20]];
  g.fillStyle(0xd9d3c4); wool.forEach(([a, b, r]) => g.fillCircle(a * s + 2, b * s + 4, r * s));
  g.fillStyle(0xfdfbf4); wool.forEach(([a, b, r]) => g.fillCircle(a * s, b * s, r * s));
  g.fillStyle(0xf2a7b5).fillEllipse(-34 * s, -8 * s, 26 * s, 13 * s).fillEllipse(34 * s, -8 * s, 26 * s, 13 * s); // kulaklar
  g.fillStyle(0x4a3b36).fillEllipse(0, 4 * s, 44 * s, 52 * s); // yüz
  g.fillStyle(0xfdfbf4).fillCircle(0, -20 * s, 14 * s).fillCircle(-10 * s, -16 * s, 9 * s).fillCircle(10 * s, -16 * s, 9 * s); // perçem
  g.fillStyle(0xffffff).fillCircle(-9 * s, 2 * s, 7 * s).fillCircle(9 * s, 2 * s, 7 * s);
  g.fillStyle(0x111111).fillCircle(-8 * s, 3 * s, 4 * s).fillCircle(10 * s, 3 * s, 4 * s);
  g.fillStyle(0xffffff).fillCircle(-7 * s, 1 * s, 1.5 * s).fillCircle(11 * s, 1 * s, 1.5 * s);
  g.fillStyle(0xff8fa3, 0.6).fillCircle(-15 * s, 14 * s, 5 * s).fillCircle(15 * s, 14 * s, 5 * s); // yanak
  g.lineStyle(2 * s, 0x221815).beginPath(); g.arc(0, 14 * s, 6 * s, 0.2, Math.PI - 0.2); g.strokePath();
  const c = scene.add.container(x, y, [g]);
  scene.tweens.add({ targets: c, y: y - 6, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
  return c;
}

export const GuideMixin = {
  guide(page = 0) {
    const { width, height } = this.scale;
    const { c, close } = modal(this, 480, 620);
    const top = height / 2 - 310, [ic, head, body] = GUIDE[page], last = page === GUIDE.length - 1;
    c.add(txt(this, width / 2, top + 34, L('📖 Kuzucuk’un Rehberi', '📖 Lambkin’s Guide'), 22, '#ffb71b'));
    c.add(lamb(this, width / 2 - 150, top + 140, 1.15));
    // konuşma balonu
    const bw = 250, bh = 150, bx = width / 2 + 55, by = top + 140;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(bx - bw / 2 + 3, by - bh / 2 + 5, bw, bh, 20);
    g.fillStyle(0xfff8e6).fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 20).fillTriangle(bx - bw / 2 + 2, by - 14, bx - bw / 2 + 2, by + 14, bx - bw / 2 - 20, by + 4);
    g.lineStyle(3, 0xffb71b).strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 20);
    c.add(g);
    const ico = txt(this, bx, by - 22, ic, 62); c.add(ico);
    ico.setScale(0.3); this.tweens.add({ targets: ico, scale: 1, duration: 380, ease: 'Back.Out' });
    c.add(txt(this, bx, by + 44, L(...head), 22, '#3a2206'));
    c.add(txt(this, width / 2, top + 330, L(...body), 20, '#f5f4eb', { wordWrap: { width: 410 }, lineSpacing: 6 }));
    // sayfa noktaları
    GUIDE.forEach((_, i) => c.add(this.add.circle(width / 2 + (i - (GUIDE.length - 1) / 2) * 22, top + 470, i === page ? 7 : 5, i === page ? 0xffb71b : 0x5d6b62)));
    const go = (p) => { sfx.tap && sfx.tap(); close(); if (p >= GUIDE.length) { markGuide(); track('guide_done'); this.lambReact && this.lambReact('dance', L('Hadi başlayalım! 🎉', 'Let’s go! 🎉')); } else this.guide(p); };
    if (page > 0) c.add(button(this, width / 2 - 110, top + 545, 170, 58, L('◀ Geri', '◀ Back'), () => go(page - 1), 0x2a333a, '#fff', 20));
    c.add(button(this, page > 0 ? width / 2 + 110 : width / 2, top + 545, page > 0 ? 190 : 260, 58, last ? L('Başla ▶', 'Start ▶') : L('İleri ▶', 'Next ▶'), () => go(page + 1), 0x2ee06a, '#04220e', 22));
    if (!last) c.add(txt(this, width / 2 - 200, top + 34, L('Atla', 'Skip'), 17, '#9fb3a8').setInteractive({ useHandCursor: true }).on('pointerup', () => { close(); markGuide(); track('guide_skip', { page }); }));
  },
};
