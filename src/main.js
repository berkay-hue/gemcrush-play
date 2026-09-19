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
import { fadeIn } from './ui/widgets.js';

window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
initAds().catch(() => {});
initIap().catch(() => {});
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

// F16: body'ye eklenen sabit DOM katmanı varken Phaser girdisini tamamen kapat (arkadaki düğmeler basılmasın)
const overlayOpen = () => [...document.body.children].some((el) => el.id !== 'app' && el.style && el.style.position === 'fixed' && el.style.display !== 'none');
let inputTimer = 0;
new MutationObserver(() => {
  const g = window.__game; if (!g || !g.input) return;
  clearTimeout(inputTimer);
  if (overlayOpen()) { g.input.enabled = false; g.input.pointers?.forEach((p) => p.reset && p.reset()); }
  else inputTimer = setTimeout(() => { g.input.enabled = true; }, 180); // kapanış dokunuşunun bırakması da yutulsun
}).observe(document.body, { childList: true, attributes: true, subtree: false, attributeFilter: ['style'] });

// her sahne açılışında yumuşak geçiş (Boot hariç)
window.__game.events.once('ready', () => {
  window.__game.scene.scenes.forEach((s) => { if (s.scene.key !== 'Boot') s.events.on('create', () => fadeIn(s)); });
});
