// F18: oyun hissi — titreşim, vuruş durması, kombo yakınlaşma, uçan paralar, sayan rakamlar.
import { goldText } from './widgets.js';

const H = { light: 10, medium: 22, heavy: [30, 40, 45] };
export function haptic(kind = 'light') {
  try {
    const hp = window.Capacitor?.Plugins?.Haptics;
    if (hp && window.Capacitor.isNativePlatform?.()) { hp.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }); return; }
    if (navigator.vibrate) navigator.vibrate(H[kind] ?? 10);
  } catch (e) { /* yok */ }
}

// Vuruş durması: dünya bir anlığına donar, sonra akar (tween + zamanlayıcılar birlikte).
export function hitStop(scene, ms = 70, scale = 0.05) {
  if (scene._hs) return;
  scene._hs = true;
  const tw = scene.tweens, tm = scene.time;
  tw.timeScale = scale; tm.timeScale = scale;
  setTimeout(() => { if (scene.sys?.isActive?.() !== false) { tw.timeScale = 1; tm.timeScale = 1; } scene._hs = false; }, ms);
}

// Kombo yakınlaşma: kamera olay noktasına doğru hafifçe dalar, dev "Harika!" damgası.
export function comboZoom(scene, x, y, label, k = 1) {
  const cam = scene.cameras.main, { width, height } = scene.scale;
  const z = 1 + 0.07 * k;
  scene.tweens.add({ targets: cam, zoom: z, scrollX: (x - width / 2) * 0.35, scrollY: (y - height / 2) * 0.35, duration: 110, ease: 'Quad.Out', yoyo: true, hold: 180, onComplete: () => { cam.setZoom(1); cam.setScroll(0, 0); } });
  if (!label) return;
  const t = goldText(scene, width / 2, height * 0.42, label, 58).setDepth(200).setScrollFactor(0).setScale(2.6).setAlpha(0).setAngle(-8);
  scene.tweens.add({ targets: t, scale: 1, alpha: 1, angle: -4, duration: 180, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, y: t.y - 40, alpha: 0, scale: 1.15, delay: 620, duration: 320, ease: 'Quad.In', onComplete: () => t.destroy() });
}

// Sayaç: metni eski değerden yenisine sayarak çıkar, sonunda zıplar.
export function countUp(scene, textObj, from, to, ms = 600) {
  const o = { v: from };
  scene.tweens.add({ targets: o, v: to, duration: ms, ease: 'Quad.Out', onUpdate: () => textObj.setText(String(Math.round(o.v))), onComplete: () => {
    textObj.setText(String(to));
    const s = textObj.scale || 1;
    scene.tweens.add({ targets: textObj, scale: s * 1.25, duration: 90, yoyo: true, ease: 'Quad.Out' });
  } });
}

// Paralar kaynaktan sayaca yay çizerek uçar; her varışta onHit(i) çağrılır.
export function flyCoins(scene, fx, fy, tx, ty, n = 8, onHit, done, key = 'ic-coin') {
  n = Math.max(1, Math.min(14, n));
  let left = n;
  for (let i = 0; i < n; i++) {
    const c = scene.add.image(fx, fy, scene.textures.exists(key) ? key : 'coin').setDepth(1100).setScrollFactor(0);
    c.setDisplaySize(26, 26); const s0 = c.scale; c.setScale(0);
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 40;
    const mx = fx + Math.cos(a) * r, my = fy + Math.sin(a) * r;
    scene.tweens.add({ targets: c, x: mx, y: my, scale: s0 * 1.1, duration: 180, delay: i * 35, ease: 'Back.Out', onComplete: () => {
      const cx = (mx + tx) / 2 + (Math.random() - 0.5) * 120, cy = Math.min(my, ty) - 60;
      const p = { t: 0 };
      scene.tweens.add({ targets: p, t: 1, duration: 420 + i * 25, ease: 'Quad.In', onUpdate: () => {
        const u = p.t, v = 1 - u;
        c.x = v * v * mx + 2 * v * u * cx + u * u * tx; c.y = v * v * my + 2 * v * u * cy + u * u * ty;
        c.setScale(s0 * (1.1 - 0.4 * u)); c.angle = u * 360;
      }, onComplete: () => { c.destroy(); onHit && onHit(i); if (--left === 0) done && done(); } });
    } });
  }
}

// Seçim/yerleşme esnemesi: taşı kısa bir squash-stretch ile canlandır.
export function squash(scene, s, k = 1) {
  if (!s || !s.active) return;
  const bx = s.scaleX, by = s.scaleY;
  scene.tweens.add({ targets: s, scaleX: bx * (1 + 0.18 * k), scaleY: by * (1 - 0.16 * k), duration: 60, yoyo: true, ease: 'Quad.Out', onComplete: () => s.active && s.setScale(bx, by) });
}
