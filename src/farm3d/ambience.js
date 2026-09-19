// F19: yaşayan çiftlik — gece fenerleri + ateşböcekleri, yağmur/rüzgâr, kuş sürüleri, uyuyan kuzu.
// Hava gerçek saate bağlı ve deterministik (3 saatlik dilimler); test: ?hava=yagmur|ruzgar|acik, ?saat=22
import * as T from '../../vendor/three/three.module.min.js';

const Q = () => new URLSearchParams(location.search);
export function hourNow() { const q = Q().get('saat'); if (q != null && q !== '') return +q; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
export function weatherNow(d = new Date()) {
  const q = Q().get('hava'); if (q) return q;
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  const h = (Math.imul(d.getFullYear() * 1000 + doy * 8 + Math.floor(d.getHours() / 3), 2654435761) >>> 0) % 100;
  return h < 18 ? 'yagmur' : h < 42 ? 'ruzgar' : 'acik';
}

function glowTex(inner = 'rgba(255,230,140,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.45)')); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function zTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.font = 'bold 52px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 8; x.strokeStyle = '#2a3550'; x.strokeText('Z', 32, 34); x.fillStyle = '#fff'; x.fillText('Z', 32, 34);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

export class Ambience {
  constructor(w) {
    this.w = w; const S = w.S;
    this.weather = weatherNow(); this.night = 0; this.wind = this.weather === 'ruzgar' ? 1 : this.weather === 'yagmur' ? 0.6 : 0.15;
    // fener + kamp ateşi ışıkları (gece yanar)
    const glow = glowTex();
    this.lamps = w.lampSpots.map(([x, y, z, fire]) => {
      const L = new T.PointLight(fire ? 0xff8a3a : 0xffc46a, 0, fire ? 5 : 4.5, 1.6); L.position.set(x, y, z); S.add(L);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: glow, color: fire ? 0xff9a50 : 0xffd27a, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }));
      sp.position.set(x, y, z); sp.scale.setScalar(fire ? 1.6 : 1.1); S.add(sp);
      return { L, sp, fire, ph: Math.random() * 9 };
    });
    // ateşböcekleri
    const N = 36, pos = new Float32Array(N * 3);
    this.flies = [];
    for (let i = 0; i < N; i++) this.flies.push({ x: (Math.random() - 0.5) * 22, z: (Math.random() - 0.5) * 17, y: 0.4 + Math.random() * 1.4, a: Math.random() * 9, s: 0.3 + Math.random() * 0.5 });
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    this.flyPts = new T.Points(geo, new T.PointsMaterial({ map: glowTex('rgba(210,255,120,1)'), size: 0.42, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }));
    this.flyPts.frustumCulled = false; S.add(this.flyPts);
    // yağmur: kamera çevresinde düşen çizgiler
    const R = 700, rp = new Float32Array(R * 6);
    this.drops = []; for (let i = 0; i < R; i++) this.drops.push([(Math.random() - 0.5) * 30, Math.random() * 14, (Math.random() - 0.5) * 24]);
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3));
    this.rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0xdde9ff, transparent: true, opacity: 0.7, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = this.weather === 'yagmur'; S.add(this.rain);
    // su birikintisi halkaları
    this.rings = [];
    // kuş sürüsü
    this.birds = null; this.birdT = 3000 + Math.random() * 6000;
    // uyuyan kuzu "Zzz"
    this.zmat = new T.SpriteMaterial({ map: zTex(), transparent: true, depthWrite: false, opacity: 0 });
    this.zs = [0, 1, 2].map(() => { const s = new T.Sprite(this.zmat.clone()); s.scale.setScalar(0.4); S.add(s); return s; });
    w.tickers.push((t, dt) => this.tick(t, dt || 0.016));
  }

  bird() {
    const g = new T.Group(), m = new T.MeshBasicMaterial({ color: 0x2c2a33, side: T.DoubleSide });
    const wing = (s) => { const p = new T.Group(), w = new T.Mesh(new T.PlaneGeometry(0.5, 0.16), m); w.position.x = 0.25 * s; p.add(w); return p; };
    const L = wing(-1), Rw = wing(1); g.add(L, Rw, new T.Mesh(new T.BoxGeometry(0.12, 0.08, 0.28), m));
    g.userData.w = [L, Rw]; return g;
  }
  spawnBirds() {
    const n = 3 + Math.floor(Math.random() * 4), dir = Math.random() < 0.5 ? 1 : -1, z0 = -6 + Math.random() * 10, y = 6 + Math.random() * 2;
    const g = new T.Group(); this.w.S.add(g);
    for (let i = 0; i < n; i++) { const b = this.bird(); const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1); b.position.set(-Math.abs(k) * 0.8 * dir, 0, k * 0.7); b.userData.ph = Math.random() * 6; g.add(b); }
    g.position.set(-22 * dir, y, z0); g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.birds = { g, dir, v: 3 + Math.random() * 1.5 };
  }

  tick(t, dt) {
    const w = this.w, night = this.night = w.nightK || 0, rain = this.weather === 'yagmur';
    // fenerler: gece + yağmurda yanar, ateş titrer
    const lit = Math.min(1, night * 1.4 + (rain ? 0.35 : 0));
    for (const l of this.lamps) {
      const fl = l.fire ? 0.75 + 0.25 * Math.sin(t / 70 + l.ph) * Math.sin(t / 130 + l.ph * 2) : 0.95 + 0.05 * Math.sin(t / 300 + l.ph);
      l.L.intensity = lit * (l.fire ? 7 : 5) * fl; l.sp.material.opacity = lit * 0.9 * fl;
    }
    // ateşböcekleri: yalnız gece, yağmursuz
    const fo = rain ? 0 : Math.max(0, night - 0.35) / 0.65;
    this.flyPts.visible = fo > 0.01;
    if (this.flyPts.visible) {
      const a = this.flyPts.geometry.attributes.position;
      this.flies.forEach((f, i) => {
        f.a += dt * f.s; f.x += Math.cos(f.a) * dt * 0.35; f.z += Math.sin(f.a * 1.3) * dt * 0.35;
        a.setXYZ(i, f.x, f.y + Math.sin(t / 700 + i) * 0.25, f.z);
      });
      a.needsUpdate = true; this.flyPts.material.opacity = fo * (0.6 + 0.4 * Math.sin(t / 400));
    }
    // yağmur
    if (this.rain.visible) {
      const p = this.rain.geometry.attributes.position, c = w.target, sl = this.wind * 0.18;
      this.drops.forEach((d, i) => {
        d[1] -= dt * 16; d[0] += dt * 16 * sl;
        if (d[1] < 0) {
          if (Math.random() < 0.05 && this.rings.length < 24) this.ring(c.x + d[0], c.z + d[2]);
          d[1] += 14; d[0] = (Math.random() - 0.5) * 30;
        }
        const x = c.x + d[0], z = c.z + d[2];
        p.setXYZ(i * 2, x, d[1], z); p.setXYZ(i * 2 + 1, x - sl * 0.7, d[1] + 0.7, z);
      });
      p.needsUpdate = true;
    }
    this.rings = this.rings.filter((r) => {
      r.life -= dt; const k = 1 - r.life / 0.6; r.m.scale.setScalar(0.2 + k * 1.2); r.m.material.opacity = 0.5 * (1 - k);
      if (r.life > 0) return true; this.w.S.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); return false;
    });
    // rüzgâr: ağaçlar salınır
    for (const tr of w.trees || []) { if (!tr.o) continue; tr.o.rotation.z = Math.sin(t / (900 - this.wind * 350) + tr.ph) * (0.015 + this.wind * 0.05); }
    // kuşlar: gündüz, yağmursuz, arada bir sürü geçer
    this.birdT -= dt * 1000;
    if (!this.birds && this.birdT < 0 && !rain && night < 0.5) this.spawnBirds();
    if (this.birds) {
      const B = this.birds; B.g.position.x += B.dir * B.v * dt; B.g.position.y += Math.sin(t / 900) * dt * 0.3;
      B.g.children.forEach((b) => { const f = Math.sin(t / 90 + b.userData.ph) * 0.7; b.userData.w[0].rotation.z = f; b.userData.w[1].rotation.z = -f; });
      if (Math.abs(B.g.position.x) > 24) { w.S.remove(B.g); this.birds = null; this.birdT = 9000 + Math.random() * 14000; }
    }
    // uyuyan kuzu: Zzz
    const sleep = w.mascotSleep ? 1 : 0, [mx, mz] = w.mascotPos || [0, 0];
    this.zs.forEach((s, i) => {
      const k = ((t / 1800 + i / 3) % 1);
      s.position.set(mx + 0.3 + k * 0.6, 2 + k * 1.3, mz + 0.2); s.material.opacity = sleep * Math.sin(k * Math.PI); s.scale.setScalar(0.25 + k * 0.3);
    });
  }
  ring(x, z) {
    const m = new T.Mesh(new T.RingGeometry(0.1, 0.14, 16), new T.MeshBasicMaterial({ color: 0xe8f2ff, transparent: true, opacity: 0.5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z); this.w.S.add(m); this.rings.push({ m, life: 0.6 });
  }
}
