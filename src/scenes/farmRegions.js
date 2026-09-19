// Farm helpers: small particle effects (F7: side regions removed — plots live on the main map).
import { txt } from '../ui/widgets.js';

export const RegionMixin = {
  dustPuff(x, y, n = 9) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, d = 50 + Math.random() * 40;
      const p = txt(this, x, y, i % 3 ? '💨' : '✨', 26 + Math.random() * 14).setDepth(1500);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6 - 20, alpha: 0, scale: 1.6, duration: 650 + Math.random() * 250, ease: 'Cubic.Out', onComplete: () => p.destroy() });
    }
  },
};
