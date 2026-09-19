// F3: wild visitors. They walk in from the forest edge, wander a little and
// leave. Tap one -> "Selamlaştın!" + coins + album entry (daily-capped).
import * as T from '../../vendor/three/three.module.min.js';
import { save, persist, addCoins } from '../meta/save.js';
import { owns } from '../meta/farm.js';

export const KINDS = {
  sincap: { emoji: '🐿', name: 'Sincap', h: 0.35, v: 1.3, w: 3, lure: 'findik' },
  tavsan: { emoji: '🐰', name: 'Tavşan', model: 'animal-bunny', h: 0.4, v: 1.1, w: 3, lure: 'havuc' },
  tilki: { emoji: '🦊', name: 'Tilki', model: 'animal-fox', h: 0.5, v: 0.9, w: 1.5 },
  geyik: { emoji: '🦌', name: 'Geyik', model: 'animal-deer', h: 0.9, v: 0.6, w: 1 },
  ari: { emoji: '🐝', name: 'Arı', model: 'animal-bee', h: 0.22, v: 1.0, w: 2, fly: 1.2, lure: 'cicek' },
  kelebek: { emoji: '🦋', name: 'Kelebek', h: 0.3, v: 0.8, w: 2.5, fly: 1.0 },
};
const DAILY_GREETS = 8, REWARD = 5;
const day = () => new Date().toISOString().slice(0, 10);
const box = (w, h, d, c, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color: c, flatShading: true })); m.position.set(x, y, z); m.castShadow = true; return m; };

// procedural cube squirrel: body, head, ears, big fluffy tail, a hazelnut
function squirrel() {
  const g = new T.Group(), b = new T.Group(); g.add(b);
  const fur = 0xc4662b, light = 0xf2c89a;
  b.add(box(0.5, 0.45, 0.7, fur, 0, 0.3, 0), box(0.4, 0.38, 0.38, fur, 0, 0.62, 0.35), box(0.3, 0.2, 0.08, light, 0, 0.55, 0.55));
  b.add(box(0.1, 0.14, 0.06, fur, -0.12, 0.86, 0.33), box(0.1, 0.14, 0.06, fur, 0.12, 0.86, 0.33));
  b.add(box(0.06, 0.06, 0.02, 0x111111, -0.1, 0.66, 0.55), box(0.06, 0.06, 0.02, 0x111111, 0.1, 0.66, 0.55));
  const tail = new T.Group(); tail.position.set(0, 0.35, -0.35); b.add(tail);
  tail.add(box(0.36, 0.7, 0.3, fur, 0, 0.35, -0.1), box(0.4, 0.3, 0.4, light, 0, 0.72, 0.02));
  b.add(box(0.14, 0.14, 0.14, 0x7a4a1c, 0, 0.42, 0.52));
  g.userData.tail = tail; return g;
}
function butterfly() {
  const g = new T.Group(), b = new T.Group(); g.add(b);
  const col = [0xff7ab8, 0x7ad0ff, 0xffd23d][Math.floor(Math.random() * 3)];
  const wing = (s) => { const w = new T.Mesh(new T.PlaneGeometry(0.4, 0.5), new T.MeshStandardMaterial({ color: col, side: T.DoubleSide })); w.geometry.translate(0.2 * s, 0, 0); w.rotation.x = -Math.PI / 2; const p = new T.Group(); p.add(w); return p; };
  const L = wing(-1), R = wing(1); b.add(L, R, box(0.06, 0.06, 0.4, 0x222222, 0, 0, 0));
  g.userData.wings = [L, R]; return g;
}

export class Visitors {
  constructor(world) {
    this.w = world; this.list = []; this.next = performance.now() + 4000; this.n = 0;
    world.tickers.push((t, dt) => this.tick(t, dt));
  }
  pickKind() {
    const ks = Object.keys(KINDS), ws = ks.map((k) => KINDS[k].w * (KINDS[k].lure && owns(KINDS[k].lure) ? 3 : 1));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ks.length; i++) if ((r -= ws[i]) < 0) return ks[i];
    return ks[0];
  }
  async spawn(kind = this.pickKind()) {
    const K = KINDS[kind], a = Math.random() * Math.PI * 2, R = 9.5;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    let o;
    if (kind === 'sincap') { o = squirrel(); o.scale.setScalar(K.h / 0.9); o.position.set(x, 0, z); this.w.S.add(o); }
    else if (kind === 'kelebek') { o = butterfly(); o.scale.setScalar(K.h / 0.4); o.position.set(x, 0, z); this.w.S.add(o); }
    else o = await this.w.put(K.model, x, 0, { h: K.h });
    if (kind !== 'sincap' && kind !== 'kelebek') o.position.z = z;
    const v = { id: 'v' + ++this.n, kind, o, st: 'in', tx: (Math.random() - 0.5) * 8, tz: (Math.random() - 0.5) * 6, stay: 3 + Math.floor(Math.random() * 3), ph: Math.random() * 9, ex: x, ez: z, jump: 0 };
    this.list.push(v); return v;
  }
  tick(t, dt) {
    if (t > this.next && this.list.length < 3) { this.next = t + 15000 + Math.random() * 20000; this.spawn(); }
    for (const v of this.list.slice()) {
      const K = KINDS[v.kind], p = v.o.position, dx = v.tx - p.x, dz = v.tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.1) {
        if (v.st === 'out') { this.w.S.remove(v.o); this.list.splice(this.list.indexOf(v), 1); continue; }
        if (--v.stay <= 0) { v.st = 'out'; v.tx = v.ex; v.tz = v.ez; }
        else { v.tx = p.x + (Math.random() - 0.5) * 4; v.tz = p.z + (Math.random() - 0.5) * 4; v.tx = Math.max(-7, Math.min(7, v.tx)); v.tz = Math.max(-6, Math.min(6, v.tz)); }
      } else {
        const s = K.v * dt * (v.st === 'out' ? 1.5 : 1);
        p.x += dx / d * Math.min(s, d); p.z += dz / d * Math.min(s, d);
        let r = Math.atan2(dx, dz) - v.o.rotation.y; r = Math.atan2(Math.sin(r), Math.cos(r)); v.o.rotation.y += r * 0.12;
      }
      const c = v.o.children[0], sc = v.o.scale.x;
      let y = K.fly ? K.fly + Math.sin(t / 300 + v.ph) * 0.2 : Math.abs(Math.sin(t / 90 + v.ph)) * 0.08;
      if (v.jump > 0) { v.jump = Math.max(0, v.jump - dt); y += Math.sin(v.jump / 0.6 * Math.PI) * 0.4; }
      if (c) c.position.y = y / sc;
      if (v.o.userData.tail) v.o.userData.tail.rotation.x = Math.sin(t / 200 + v.ph) * 0.25;
      if (v.o.userData.wings) { const f = Math.sin(t / 45) * 0.9; v.o.userData.wings[0].rotation.z = f; v.o.userData.wings[1].rotation.z = -f; }
    }
  }
  // nearest visitor to a Phaser-space point (visitors are small, use screen distance)
  pick(px, py) {
    let best = null, bd = 55;
    for (const v of this.list) { const K = KINDS[v.kind], p = v.o.position, a = this.w.project(p.x, (K.fly || 0) + K.h * 0.5, p.z); const d = Math.hypot(a.x - px, a.y - py); if (a.vis && d < bd) { bd = d; best = v; } }
    return best;
  }
  // greet -> {coins, first, left}. Visitor hops and runs off.
  greet(v) {
    v.jump = 0.6; v.st = 'out'; v.tx = v.ex; v.tz = v.ez;
    const f = save.farm, g = f.greet && f.greet.day === day() ? f.greet : (f.greet = { day: day(), n: 0 });
    f.album = f.album || {};
    const first = !f.album[v.kind]; f.album[v.kind] = (f.album[v.kind] || 0) + 1;
    let coins = 0; if (g.n < DAILY_GREETS) { g.n++; coins = REWARD * (first ? 3 : 1); addCoins(coins); }
    persist();
    return { coins, first, left: DAILY_GREETS - g.n };
  }
  anchorOf(v) { const K = KINDS[v.kind], p = v.o.position; return this.w.project(p.x, (K.fly || 0) + K.h + 0.3, p.z); }
}
