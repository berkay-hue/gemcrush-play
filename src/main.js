import { CONFIG } from './config.js';
import { Boot } from './scenes/Boot.js';
import { Map as MapScene } from './scenes/Map.js';
import { Game } from './scenes/Game.js';
import { Farm } from './scenes/Farm.js';
import { Zone } from './scenes/Zone.js';
import { initAds } from './monetize/ads.js';
import { initIap } from './monetize/iap.js';
import { flush } from './analytics.js';
import { sfx } from './sound.js';
import { fadeIn } from './ui/widgets.js';

window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
initAds().catch(() => {});
initIap().catch(() => {});
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
  scene: [Boot, Farm, Zone, MapScene, Game],
});

// her sahne açılışında yumuşak geçiş (Boot hariç)
window.__game.events.once('ready', () => {
  window.__game.scene.scenes.forEach((s) => { if (s.scene.key !== 'Boot') s.events.on('create', () => fadeIn(s)); });
});
