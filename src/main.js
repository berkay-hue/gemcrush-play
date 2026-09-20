import { CONFIG } from './config.js';
import { Boot } from './scenes/Boot.js';
import { Map as MapScene } from './scenes/Map.js';
import { Game } from './scenes/Game.js';
import { Farm } from './scenes/Farm.js';
import { Visit } from './scenes/Visit.js';
import { Zone } from './scenes/Zone.js';
import { initAds } from './monetize/ads.js';
import { initIap } from './monetize/iap.js';
import { flush } from './analytics.js';
import { initNotify } from './meta/notify.js';
import { sfx } from './sound.js';
import { music, trackFor } from './music.js';
import { fadeIn } from './ui/widgets.js';
import { irisOpen } from './ui/cinema.js';

window.addEventListener('pointerdown', () => { sfx.unlock(); music.unlock(); }, { once: true });
initIap().catch(() => {});
// F44: ATT (izleme izni) ekranı Apple kuralınca uygulama içeriği göründükten SONRA çıkmalı —
// AdMob.initialize izni kendisi ister, o yüzden reklam motorunu ilk sahne çizilince başlatıyoruz.
let adsStarted = false;
const startAds = () => { if (adsStarted) return; adsStarted = true; setTimeout(() => initAds().catch(() => {}), 800); };
setTimeout(startAds, 6000); // emniyet: sahne açılmasa da reklamlar başlasın
try { initNotify(); } catch {}
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

window.__game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: CONFIG.width,
  height: CONFIG.height,
  backgroundColor: '#0a0f0d',
  transparent: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [Boot, Farm, Zone, MapScene, Game, Visit],
});
// F40: her sahne açılışında uygun parça (giriş/çiftlik ↔ bölüm) yumuşak geçişle
window.__game.events.once('ready', () => window.__game.scene.scenes.forEach((s) => s.events.on('start', () => music.play(trackFor(s.scene.key)))));

// F16b: yalnız BİZİM DOM panellerimiz (shield() ile işaretli) girdiyi kapatır; eklenti/tarayıcı öğeleri kapatmaz
const overlayOpen = () => !!document.querySelector('body > [data-gc-overlay]:not([style*="display: none"])');
let inputTimer = 0;
const syncInput = () => {
  const g = window.__game; if (!g || !g.input) return;
  clearTimeout(inputTimer);
  if (overlayOpen()) { g.input.enabled = false; g.input.pointers?.forEach((p) => p.reset && p.reset()); }
  else if (!g.input.enabled) inputTimer = setTimeout(() => { g.input.enabled = true; }, 180); // kapanış dokunuşunun bırakması da yutulsun
};
new MutationObserver(syncInput).observe(document.body, { childList: true, attributes: true, subtree: true, attributeFilter: ['style'] });
setInterval(() => { const g = window.__game; if (g && g.input && !g.input.enabled && !overlayOpen()) g.input.enabled = true; }, 1000); // emniyet: girdi asla kilitli kalmasın

// her sahne açılışında yumuşak geçiş (Boot hariç)
window.__game.events.once('ready', () => {
  window.__game.scene.scenes.forEach((s) => { if (s.scene.key !== 'Boot') s.events.on('create', () => { startAds(); if (window.__lastScene && window.__lastScene !== s.scene.key) irisOpen(); else fadeIn(s); window.__lastScene = s.scene.key; }); });
});
