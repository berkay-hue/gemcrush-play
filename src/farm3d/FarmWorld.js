// F1: 3D farm world (Three.js) drawn on its own canvas BEHIND the transparent
// Phaser canvas. Phaser keeps HUD, modals and match-3; this module only draws
// the farm, answers "what did the player tap?" and projects 3D points to
// Phaser screen space so overlays (price tags, bars) can follow the models.
import * as T from '../../vendor/three/three.module.min.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import * as SU from '../../vendor/three/SkeletonUtils.js';
import { Ambience, hourNow } from './ambience.js';

const SQ3 = Math.sqrt(3);
export const hex = (q, r) => [2 * (q + r / 2), SQ3 * r];
const key = (q, r) => q + ',' + r;
const RAD = 5;

// item id -> hex + model. Screen top of the old 2D farm = far side (-z).
// Sanat: %100 Kenney (CC0) — Nature Kit (zemin/ağaç/ekin/çit), Fantasy Town Kit
// (modüler duvar+çatıdan derlenen binalar), Cube Pets (hayvanlar).
// 'b:<ad>' = Fantasy Town parçalarından derlenen bina (bkz. BUILD), 'p:sheep' = kutu koyun.
export const LAYOUT = {
  ambar: { at: [1, -3], model: 'b:ambar', h: 2.4, ry: -0.3 },
  kumes: { at: [-2, -1], model: 'b:kumes', h: 1.5, ry: 0.5 },
  ahir: { at: [3, -2], model: 'b:ahir', h: 2.2, ry: -0.5 },
  tavuk: { area: [-5.5, -0.5, -2.5, 2.2], model: 'animal-chick', h: 0.32, n: 2 },
  horoz: { area: [-5.5, -0.5, -2.5, 2.2], model: 'animal-chick', h: 0.42, n: 1 },
  koyun: { area: [3, -0.8, 6.5, 2.4], model: 'p:sheep', h: 0.6, n: 1 },
  inek: { area: [3, -0.8, 6.5, 2.4], model: 'animal-cow', h: 0.8, n: 1 },
  at: { area: [3, -0.8, 6.5, 2.4], model: 'animal-deer', h: 0.95, n: 1 },
  tarla1: { at: [-2, 2], plot: 1 }, tarla2: { at: [-1, 2], plot: 1 }, tarla3: { at: [0, 2], plot: 1 },
  tarla4: { at: [-3, 3], plot: 1 }, tarla5: { at: [-2, 3], plot: 1 }, tarla6: { at: [-1, 3], plot: 1 },
  market: { at: [-1, -3], model: 'b:pazar', h: 1.5, ry: 0.4 },
  traktor: { at: [1, 2], model: 'town/cart', h: 0.9, ry: 0.6 },
  // F7: evcil hayvanlar (sol bölge açılınca). köpek kamerayı izler, kedi güneşlenir
  kopek: { area: [-4, 0.5, 4, 5], model: 'animal-dog', h: 0.5, n: 1, pet: 'follow' },
  kedi: { area: [-1, 0.8, 2, 1.8], model: 'animal-cat', h: 0.36, n: 1, pet: 'sun' },
};
// F13: animals live in a pen that follows their home building
export const HOME = { tavuk: 'kumes', horoz: 'kumes', koyun: 'ahir', inek: 'ahir', at: 'ahir' };
// [model, [x,z] dünya, yükseklik, ry]
const DECOR = [
  ['b:degirmen', [-8.5, -0.5], 4.2, 0.5], ['town/fountain-round', [0, 0], 0, 0, 1.1],
  ['tree_oak', [-9.5, 6.5], 2.4, 0], ['tree_default', [-7.5, 8.2], 2.8, 1], ['tree_oak', [-1, -8.4], 2.2, 2],
  ['tree_pineRoundA', [3.5, -8.6], 2.6, 3], ['tree_fat', [-4, -7.6], 2.2, 0], ['tree_default', [10.2, 1], 2.6, 1],
  ['tree_oak', [-10.3, 2.5], 2.3, 2], ['tree_blocks', [9, 6], 2, 0], ['tree_pineTallA', [2.5, 8.2], 3, 4],
  ['plant_bush', [-6, 5.4], 0.7, 0], ['plant_bushSmall', [7, -2.8], 0.5, 1], ['flower_yellowA', [-3.4, 6.2], 0.4, 0],
  ['flower_purpleA', [4.6, 5], 0.4, 1], ['flower_redB', [-6.8, -3.5], 0.4, 2], ['mushroom_red', [-9, 4.8], 0.4, 0],
  ['rock_smallC', [7.5, 7.3], 0.5, 1], ['log_stack', [-5.4, -5.6], 0.7, 0.4], ['stump_round', [7, 4.2], 0.4, 0],
  ['town/cart', [2.4, -3.8], 1.1, -0.8], ['town/lantern', [1.5, 1.2], 1.4, 0], ['campfire_logs', [-2.8, -5.6], 0.4, 0],
  ['town/lantern', [2.9, 6.3], 1.4, 0], ['town/lantern', [-6.2, 2.3], 1.4, 0],
];
// F19: gece yanan ışık noktaları [x, y, z, ateş?]
const LAMPS = [[1.5, 1.25, 1.2], [2.9, 1.25, 6.3], [-6.2, 1.25, 2.3], [-2.8, 0.5, -5.6, 1]];
// F9: dekorun çarpışma yarıçapı (hayvanlar içinden geçmesin)
const DECOR_R = (n) => n === 'b:degirmen' ? 1.5 : n === 'town/fountain-round' ? 1.25 : n.startsWith('tree_') ? 0.6 : n === 'town/cart' ? 0.75 : n === 'log_stack' ? 0.5 : n === 'campfire_logs' ? 0.45 : n === 'town/lantern' ? 0.25 : n.startsWith('rock_') || n.startsWith('stump') ? 0.35 : 0;
const ITEM_R = { ambar: 1.8, ahir: 1.6, kumes: 1.05, market: 1.3, traktor: 0.85 };
// F9: çiftliğin dışı sık orman — harita sınırı. Oynanan alan: x ±22 (arsalar dahil), z -10..10
function forestPts() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = [], step = LOW_END ? 2.6 : 1.9;
  for (let x = -50; x <= 50; x += step) for (let z = -40; z <= 30; z += step) {
    const jx = x + (rnd() - 0.5) * step * 0.8, jz = z + (rnd() - 0.5) * step * 0.8;
    const ax = Math.abs(jx);
    const inPlay = ax < 23.2 && jz > -11.2 && jz < 11.2;
    if (inPlay) continue;
    if (ax < 16 && jz < -11 && jz > -17) { if (rnd() < 0.55) continue; }   // tema dekoru için arka şeritte seyrek
    if (jz > 11 && jz < 15 && rnd() < 0.5) continue;                        // ön kenar: kamerayı kapatmasın
    P.push({ x: jx, z: jz, k: Math.floor(rnd() * 1000), s: 0.8 + rnd() * 0.55, ry: rnd() * 6.28 });
  }
  return P;
}
const POND = [[8, -7], [10, -7], [8, -9], [6, -9]]; // 2x2 göl karoları (ada-yerel)
const ISL = [12, 10]; // ana ada yarı boyutları

// Low-end: <=4 cores or <=3GB RAM -> no shadows, lower pixel ratio, no MSAA
export const LOW_END = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3 || /[?&]low=1/.test(location.search);
function url(n) { return 'assets3d/' + n + (n.startsWith('kaykit/') ? '.gltf' : '.glb'); }

// Fantasy Town modüler bina tarifleri. Birim hücre = 1; duvar parçası hücrenin
// +x kenarında durur → kenar dönüşleri: E 0, N π/2, W π, S -π/2.
const EDGE = { E: 0, N: Math.PI / 2, W: Math.PI, S: -Math.PI / 2 };
function recipe(w, d, { wall, door, win, roof, floors = 1 }) {
  const P = [], ox = (w - 1) / 2, oz = (d - 1) / 2;
  for (let f = 0; f < floors; f++) for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
    const sides = [];
    if (i === w - 1) sides.push('E'); if (i === 0) sides.push('W'); if (j === 0) sides.push('N'); if (j === d - 1) sides.push('S');
    for (const sd of sides) {
      const front = sd === 'S' && f === 0 && i === Math.floor((w - 1) / 2);
      P.push([front ? door : (win && (i + j + f) % 2 ? win : wall), i - ox, f, j - oz, EDGE[sd]]);
    }
  }
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) P.push([roof, i - ox, floors, j - oz, 0]);
  return P;
}
const BUILD = {
  ambar: recipe(2, 2, { wall: 'town/wall-wood', door: 'town/wall-wood-door', win: 'town/wall-wood-window-shutters', roof: 'town/roof-high-gable' }),
  ahir: recipe(2, 2, { wall: 'town/wall-wood-detail-cross', door: 'town/wall-wood-doorway-square-wide', win: 'town/wall-wood', roof: 'town/roof-gable' }),
  kumes: recipe(1, 1, { wall: 'town/wall-wood', door: 'town/wall-wood-doorway-round', roof: 'town/roof-gable' }),
  degirmen: recipe(1, 1, { wall: 'town/wall', door: 'town/wall-doorway-round', win: 'town/wall-window-small', roof: 'town/roof-high-point', floors: 2 })
    .concat([['town/windmill', 0, 1.6, 0.62, -Math.PI / 2, 'blade']]),
  pazar: [['town/stall-red', -0.6, 0, 0, 0], ['town/stall-green', 0.6, 0, 0, 0], ['town/stall-bench', 0, 0, 0.9, 0]],
};

export class FarmWorld {
  constructor() {
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'absolute', left: 0, top: 0, zIndex: 0, display: 'none' });
    document.getElementById('app').prepend(this.canvas);
    this.R = new T.WebGLRenderer({ canvas: this.canvas, antialias: !LOW_END, powerPreference: 'high-performance' });
    this.R.shadowMap.enabled = !LOW_END; this.R.shadowMap.type = T.PCFSoftShadowMap;
    this.R.toneMapping = T.ACESFilmicToneMapping; this.R.outputColorSpace = T.SRGBColorSpace;
    const S = this.S = new T.Scene();
    this.skyBase = 0xa8dcf2;
    S.background = new T.Color(0xa8dcf2); S.fog = new T.Fog(0xa8dcf2, 34, 62);
    this.C = new T.PerspectiveCamera(34, 540 / 960, 0.1, 200);
    this.target = new T.Vector3(0, 0, 0.6); this.zoom = 1;
    S.add(this.hemi = new T.HemisphereLight(0xffffff, 0x6a8f4a, 1.25));
    const sun = this.sun = new T.DirectionalLight(0xfff0d0, 2.2);
    sun.position.set(8, 14, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006;
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22 }); S.add(sun);
    this.loader = new GLTFLoader(); this.cache = {};
    this.items = {}; this.movers = []; this.tickers = []; this.running = false;
    this.ray = new T.Raycaster();
    this.lampSpots = LAMPS; this.trees = []; this.nightK = 0;
    this.buildGround();
    this.amb = new Ambience(this);
    addEventListener('resize', () => this.fit());
  }

  load(n) {
    if (this.cache[n]) return this.cache[n];
    this.progress(1, 0);
    return (this.cache[n] = this.loader.loadAsync(url(n)).finally(() => this.progress(0, 1)));
  }
  // thin top bar while GLB models stream in
  progress(add, done) {
    this.pend = (this.pend || 0) + add; this.done = (this.done || 0) + done;
    let bar = this.bar;
    if (!bar) {
      bar = this.bar = document.createElement('div');
      Object.assign(bar.style, { position: 'absolute', left: 0, top: 0, height: '3px', width: '0', background: '#ffb71b', zIndex: 5, transition: 'width .2s, opacity .4s', pointerEvents: 'none' });
      document.getElementById('app').appendChild(bar);
    }
    const f = this.pend ? this.done / this.pend : 1;
    bar.style.opacity = f >= 1 ? 0 : 1; bar.style.width = (f * 100) + '%';
    if (f >= 1) this.pend = this.done = 0;
  }

  async put(n, x, z, { s = 1, ry = 0, h, parent = this.S } = {}) {
    let o;
    if (n.startsWith('b:')) o = await this.building(n.slice(2));
    else if (n === 'p:sheep') o = this.sheep();
    else o = SU.clone((await this.load(n)).scene);
    o.traverse((m) => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; this.tint(m.material); } });
    if (h) { o.updateMatrixWorld(true); const b = new T.Box3().setFromObject(o, true); s = h / (b.max.y - b.min.y); o.position.y = -b.min.y * s; }
    o.scale.setScalar(s); o.position.x = x; o.position.z = z; o.rotation.y = ry;
    parent.add(o); return o;
  }

  // Kenney kare zemin adası (ground_grass ×2) + toprak gövde, çevresi göl
  buildGround() {
    // F9: mavi deniz yerine orman tabanı (tema rengiyle boyanır)
    const fl = this.floor = new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshStandardMaterial({ color: 0x5f9e3c, roughness: 1 }));
    fl.rotation.x = -Math.PI / 2; fl.position.y = -0.06; fl.receiveShadow = true; this.S.add(fl);
    this.island(0, ...ISL, POND);
    for (const [n, [x, z], h, ry, s] of DECOR) this.put(n, x, z, h ? { h, ry } : { s, ry }).then((o) => { if (n.startsWith('tree_')) this.trees.push({ o, ph: x * 3 + z }); });
    this.mascot(-7.3, 1.1);
    this.signboard(1.3, 6.7);
  }

  // F16c: maskot Kuzi 3D — çiftçi tulumlu, hasır şapkalı, yabalı kuzu (prosedürel)
  mascot(x, z) {
    const g = new T.Group(), body = new T.Group(), M = (c, r = 0.85) => new T.MeshStandardMaterial({ color: c, roughness: r });
    const add = (geo, m, px, py, pz, par = body) => { const o = new T.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; par.add(o); return o; };
    const S = (r) => new T.SphereGeometry(r, 14, 10);
    const wool = M(0xfbf8f0, 1), skin = M(0xf2dcc4), dark = M(0x3a2e2a), denim = M(0x3f78c9), straw = M(0xe8c066), band = M(0xd9453b), wood = M(0x8a5a32), steel = M(0xb8c0c8, 0.4), pink = M(0xf29aa6);
    // bacaklar + toynaklar
    for (const sx of [-0.2, 0.2]) { add(new T.CylinderGeometry(0.09, 0.09, 0.4, 8), denim, sx, 0.25, 0); add(new T.CylinderGeometry(0.1, 0.11, 0.1, 8), dark, sx, 0.05, 0.02); }
    // gövde: tulum + yün tüyleri
    add(new T.CylinderGeometry(0.34, 0.38, 0.5, 14), denim, 0, 0.66, 0);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(S(0.2), wool, Math.cos(a) * 0.3, 0.98 + (i % 2) * 0.05, Math.sin(a) * 0.26); }
    add(S(0.3), wool, 0, 1.02, 0);
    add(new T.BoxGeometry(0.34, 0.24, 0.06), denim, 0, 0.84, 0.33); // göğüs cebi
    add(new T.BoxGeometry(0.12, 0.08, 0.02), M(0xffc640, 0.4), 0, 0.88, 0.37);
    for (const sx of [-0.14, 0.14]) add(new T.BoxGeometry(0.07, 0.42, 0.05), denim, sx, 1.02, 0.28); // askılar
    // kollar
    for (const sx of [-1, 1]) { const arm = add(S(0.12), wool, sx * 0.42, 0.86, 0.06); arm.scale.set(1, 1.5, 1); add(S(0.07), dark, sx * 0.46, 0.7, 0.1); }
    // kafa
    const head = new T.Group(); head.position.set(0, 1.42, 0.05); body.add(head);
    add(S(0.3), skin, 0, 0, 0, head).scale.set(1, 0.95, 0.9);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(S(0.11), wool, Math.cos(a) * 0.14, 0.26, Math.sin(a) * 0.1, head); } // perçem
    for (const sx of [-1, 1]) {
      const ear = add(S(0.1), skin, sx * 0.33, 0.04, -0.02, head); ear.scale.set(1.7, 0.6, 0.8); ear.rotation.z = sx * -0.4;
      add(S(0.055), dark, sx * 0.11, 0.04, 0.25, head); add(S(0.018), M(0xffffff, 0.3), sx * 0.11 + 0.02, 0.07, 0.3, head);
      add(S(0.05), pink, sx * 0.19, -0.08, 0.21, head).scale.set(1, 0.6, 0.4); // yanak
    }
    add(S(0.05), pink, 0, -0.06, 0.28, head).scale.set(1.2, 0.8, 0.8); // burun
    add(new T.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), dark, 0, -0.13, 0.25, head).rotation.z = Math.PI; // gülümseme
    // hasır şapka
    add(new T.CylinderGeometry(0.5, 0.52, 0.04, 20), straw, 0, 0.3, 0, head);
    add(new T.CylinderGeometry(0.22, 0.26, 0.24, 16), straw, 0, 0.43, 0, head);
    add(new T.CylinderGeometry(0.265, 0.265, 0.07, 16), band, 0, 0.36, 0, head);
    // yaba (sağ elde)
    const fork = new T.Group(); fork.position.set(0.48, 0.2, 0.12); body.add(fork);
    add(new T.CylinderGeometry(0.025, 0.025, 1.7, 6), wood, 0, 0.8, 0, fork);
    add(new T.BoxGeometry(0.24, 0.035, 0.035), steel, 0, 1.66, 0, fork);
    for (const fx of [-0.1, 0, 0.1]) add(new T.CylinderGeometry(0.014, 0.01, 0.26, 5), steel, fx, 1.8, 0, fork);
    g.add(body); g.scale.setScalar(1.25); g.position.set(x, 0, z); g.rotation.y = 0.35;
    this.S.add(g);
    let hop = 0;
    this.mascotHop = () => { hop = 1; };
    this.tickers.push((t, dt) => {
      if (!g.parent) return;
      if (hop > 0) hop = Math.max(0, hop - (dt || 0.016) / 0.7);
      const zz = this.mascotSleep = this.nightK > 0.6 && hop === 0; // F19: gece uyur
      if (zz) { body.position.y = -0.08 + Math.sin(t / 1100) * 0.02; head.rotation.x = 0.42 + Math.sin(t / 1100) * 0.06; head.rotation.y = 0; body.rotation.z = 0.06; fork.rotation.z = 0.35; return; }
      head.rotation.x = 0;
      body.position.y = Math.abs(Math.sin(t / 420)) * 0.05 + Math.sin(hop * Math.PI) * 0.6;
      body.rotation.z = Math.sin(t / 700) * 0.04;
      head.rotation.y = Math.sin(t / 1300) * 0.25 + (hop > 0 ? Math.sin(hop * 20) * 0.2 : 0);
      fork.rotation.z = -0.12 + Math.sin(t / 900) * 0.05;
    });
    this.mascotPos = [x, z];
  }


  // PR-A: çiftlik adı tahta tabelası (iki direk + tahta, yüzü CanvasTexture)
  signboard(x, z) {
    const g = new T.Group(), M = (c, r = 0.9) => new T.MeshStandardMaterial({ color: c, roughness: r });
    const wood = M(0x8a5a32), dark = M(0x5e3b1e);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 176;
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const face = new T.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const add = (geo, m, px, py, pz) => { const o = new T.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
    for (const sx of [-1.15, 1.15]) { add(new T.BoxGeometry(0.16, 1.9, 0.16), dark, sx, 0.95, 0); add(new T.ConeGeometry(0.13, 0.2, 4), dark, sx, 1.99, 0).rotation.y = Math.PI / 4; }
    add(new T.BoxGeometry(2.7, 0.92, 0.14), [wood, wood, wood, wood, face, wood], 0, 1.3, 0.06);
    add(new T.BoxGeometry(2.86, 0.08, 0.2), dark, 0, 1.8, 0.06);
    for (const [px, pz] of [[-0.6, 0.35], [0.7, 0.3]]) add(new T.SphereGeometry(0.16, 8, 6), M(0x6fae4a, 1), px, 0.1, pz).scale.set(1.3, 0.7, 1.1); // çimen öbeği
    const draw = (text) => {
      const c = cv.getContext('2d'), W = cv.width, H = cv.height;
      c.fillStyle = '#9a6a3c'; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) { c.fillStyle = i % 2 ? '#a8784a' : '#8f6034'; c.fillRect(0, i * H / 3, W, H / 3 - 3); c.fillStyle = '#6b4424'; c.fillRect(0, (i + 1) * H / 3 - 3, W, 3); }
      c.strokeStyle = 'rgba(70,40,15,.28)'; c.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const y = (i * 37) % H; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(W * 0.3, y + 6, W * 0.6, y - 6, W, y + 3); c.stroke(); }
      c.fillStyle = '#4a2d14'; for (const [nx, ny] of [[18, 18], [W - 18, 18], [18, H - 18], [W - 18, H - 18]]) { c.beginPath(); c.arc(nx, ny, 6, 0, 7); c.fill(); }
      let fs = 70; const font = (n) => `800 ${n}px "Baloo 2", system-ui, sans-serif`;
      c.font = font(fs); while (c.measureText(text).width > W - 70 && fs > 26) c.font = font(fs -= 2);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(40,20,5,.55)'; c.fillText(text, W / 2 + 2, H / 2 + 5);
      c.fillStyle = '#fff3cf'; c.fillText(text, W / 2, H / 2 + 2);
      tex.needsUpdate = true;
    };
    this.setSignText = (text) => { this._signText = text; draw(text); if (document.fonts) document.fonts.ready.then(() => this._signText === text && draw(text)); };
    this.setSignText(this._signText || 'Çiftliğim');
    g.position.set(x, 0, z); g.rotation.y = -0.12; this.S.add(g);
    this.signPos = [x, z]; this.signG = g;
    let wig = 0; this.signWiggle = () => { wig = 1; };
    this.tickers.push((t, dt) => { if (wig > 0) { wig = Math.max(0, wig - (dt || 0.016) / 0.6); g.rotation.z = Math.sin(wig * 18) * 0.05 * wig; } });
  }

  // F13: live position of an item (save override via this.posOf, else layout)
  where(id) {
    const L = LAYOUT[id]; if (!L) return null;
    if (this.tmpPos && this.tmpPos.id === id) return this.tmpPos.p;
    const p = this.posOf && this.posOf(id);
    if (p) return p;
    if (L.at) return hex(...L.at);
    const h = HOME[id];
    if (h) { const d = hex(...LAYOUT[h].at), w = this.where(h); return [(L.area[0] + L.area[2]) / 2 + w[0] - d[0], (L.area[1] + L.area[3]) / 2 + w[1] - d[1]]; }
    return [(L.area[0] + L.area[2]) / 2, (L.area[1] + L.area[3]) / 2];
  }
  areaOf(id) {
    const L = LAYOUT[id], h = HOME[id];
    if (!h) return L.area;
    const d = hex(...LAYOUT[h].at), w = this.where(h), ox = w[0] - d[0], oz = w[1] - d[1];
    return [L.area[0] + ox, L.area[1] + oz, L.area[2] + ox, L.area[3] + oz];
  }
  // Phaser-space point -> ground (y=0) world point
  groundAt(px, py) {
    this.ray.setFromCamera(new T.Vector2(px / 540 * 2 - 1, 1 - py / 960 * 2), this.C);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    if (Math.abs(d.y) < 1e-4) return null;
    const k = -o.y / d.y; return [o.x + d.x * k, o.z + d.z * k];
  }
  // F7: side plots (ARSA). Owned → grass; locked → dirt + a tappable "for sale" sign ('arsa:<id>').
  setPlots(list) {
    const sig = JSON.stringify(list.map((a) => [a.id, a.owned]));
    if (this._plotSig === sig) return; this._plotSig = sig;
    if (this._plotG) this.S.remove(this._plotG);
    for (const k in this.items) if (k.startsWith('arsa:')) delete this.items[k];
    const g = this._plotG = new T.Group(); this.S.add(g);
    const M = new T.MeshStandardMaterial({ color: 0x9a6b44, roughness: 1 });
    for (const a of list) {
      const [x0, z0, x1, z1] = a.rect;
      for (let x = x0 + 1; x < x1; x += 2) for (let z = z0 + 1; z < z1; z += 2) this.put(a.owned ? 'ground_grass' : 'ground_pathTile', x, z, { s: 2, parent: g });
      const b = new T.Mesh(new T.BoxGeometry(x1 - x0 - 0.02, 0.9, z1 - z0 - 0.02), M);
      b.position.set((x0 + x1) / 2, -0.58, (z0 + z1) / 2); b.receiveShadow = true; g.add(b);
      if (a.owned) continue;
      const sg = new T.Group(); sg.userData.id = 'arsa:' + a.id; g.add(sg);
      this.put('sign', (x0 + x1) / 2, (z0 + z1) / 2, { h: 1.6, parent: sg });
      this.items['arsa:' + a.id] = { g: sg, sig: 'arsa', state: 'owned', at: [(x0 + x1) / 2, (z0 + z1) / 2] };
    }
    g.position.y = -0.02;
  }
  // F7: theme = sky tint + a backdrop "dress" of models behind the island (z < -10)
  setTheme(th) {
    this.skyBase = th.skyBase || 0xa8dcf2; this.daylight();
    if (this._dressId === th.id) return; this._dressId = th.id;
    // F9: tema tüm çiftliği boyar — çimen, yapraklar, orman tabanı ve orman ağaçları
    this.th = th;
    this.floor.material.color.set(th.ground || 0x5f9e3c);
    const seen = new Set();
    this.S.traverse((m) => { if (m.isMesh && m.material && !seen.has(m.material)) { seen.add(m.material); this.tint(m.material); } });
    this.forest(th);
    if (this._dressG) this.S.remove(this._dressG);
    const g = this._dressG = new T.Group(); this.S.add(g);
    for (const [m, x, z, h, ry = 0] of th.dress || []) this.put(m, x, z, { h, ry, parent: g });
  }

  // F9: Kenney malzemeleri ada göre: 'grass' → tema çimeni, 'leafs*' → tema yaprağı (önbellekte paylaşılır)
  tint(mat) {
    if (Array.isArray(mat)) return mat.forEach((m) => this.tint(m));
    const n = mat && mat.name || '', th = this.th || {};
    const [c, k] = n === 'grass' ? (th.grassTint || []) : n.startsWith('leafs') ? (th.leafTint || []) : [];
    if (!n || mat.transparent || (mat.userData.base === undefined && k === undefined)) return;
    if (mat.userData.base === undefined) mat.userData.base = mat.color.getHex();   // sayı: clone() JSON kopyasında bozulmaz
    mat.color.setHex(mat.userData.base); if (k) mat.color.lerp(new T.Color(c), k);
  }
  // F9: orman halkası — tür başına InstancedMesh (yüzlerce ağaç, birkaç draw call)
  async forest(th) {
    const kinds = th.trees || ['tree_default', 'tree_oak', 'tree_pineRoundA', 'tree_fat', 'tree_pineTallA', 'tree_detailed'];
    const tok = this._forestTok = (this._forestTok || 0) + 1;
    const pts = this._fpts || (this._fpts = forestPts());
    const dz = (p) => Math.abs(p.x) < 16.5 && p.z < -10.5 && p.z > -18.5;   // tema dekor şeridi açık kalsın
    const use = (th.dress || []).length ? pts.filter((p) => !dz(p)) : pts;
    const g = new T.Group();
    await Promise.all(kinds.map(async (name, ki) => {
      const list = use.filter((p) => p.k % kinds.length === ki); if (!list.length) return;
      const src = (await this.load(name)).scene; src.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(src, true), base = 3.2 / (b.max.y - b.min.y);
      const M = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
      src.traverse((m) => {
        if (!m.isMesh) return; this.tint(m.material);
        const im = new T.InstancedMesh(m.geometry, m.material, list.length);
        list.forEach((p, i) => {
          const s = base * p.s; q.setFromAxisAngle(up, p.ry);
          M.compose(new T.Vector3(p.x, -b.min.y * s - 0.06, p.z), q, new T.Vector3(s, s, s)).multiply(m.matrixWorld);
          im.setMatrixAt(i, M);
        });
        im.castShadow = !LOW_END; im.receiveShadow = false; g.add(im);
      });
    }));
    if (tok !== this._forestTok) return;
    if (this._forestG) this.S.remove(this._forestG);
    this._forestG = g; this.S.add(g);
  }
  // F9: hayvanların geçemeyeceği daireler [x, z, r] — sahip olunan binalar, tarlalar, dekor
  colliders() {
    const C = [];
    for (const [n, [x, z]] of DECOR) { const r = DECOR_R(n); if (r) C.push([x, z, r]); }
    if (this.signPos) C.push([...this.signPos, 1.3]);
    for (const id in LAYOUT) {
      const it = this.items[id], L = LAYOUT[id];
      if (!it || it.state !== 'owned' || L.area) continue;
      const [x, z] = this.where(id); C.push([x, z, L.plot ? 1.15 : ITEM_R[id] || 1]);
    }
    return C;
  }
  // pen=true: ağıl çiti de engel (ağılda yaşamayan hayvanlar için)
  blocked(x, z, pad = 0.25, pen = false) {
    for (const c of this._col || []) if (Math.hypot(x - c[0], z - c[1]) < c[2] + pad) return c;
    const f = pen && this._pen;
    if (f && x > f[0] - pad && x < f[2] + pad && z > f[1] - pad && z < f[3] + pad) return 'pen';
    return null;
  }
  freeIn(b, pen) {
    for (let i = 0; i < 12; i++) { const p = this.rndIn(b); if (!this.blocked(p[0], p[1], 0.35, pen)) return p; }
    return this.rndIn(b);
  }

  island(cx, hw, hd, water = [], parent = this.S) {
    const K = 2, isW = (x, z) => water.some(([a, b]) => a === x && b === z);
    for (let x = -hw + 1; x < hw; x += K) for (let z = -hd + 1; z < hd; z += K) {
      if (Math.abs(x) > hw - 2 && Math.abs(z) > hd - 2) continue; // yuvarlak köşe
      const w = isW(x, z);
      this.put(w ? 'ground_riverTile' : 'ground_grass', cx + x, z, { s: K, parent });
      if (w && (x + z) % 4 === 0) this.put('lily_large', cx + x + 0.3, z - 0.2, { s: K, parent });
    }
    const M = new T.MeshStandardMaterial({ color: 0x9a6b44, roughness: 1 });
    // ada gövdesi: köşeleri kesik iki kutu
    for (const [w, d] of [[hw * 2, hd * 2 - 4], [hw * 2 - 4, hd * 2]]) {
      const b = new T.Mesh(new T.BoxGeometry(w - 0.02, 0.9, d - 0.02), M); b.position.set(cx, -0.58, 0); b.receiveShadow = true; parent.add(b);
    }
  }

  fenceRect(x0, z0, x1, z1, parent = this.S) {
    const nx = Math.round((x1 - x0) / 1.2), nz = Math.round((z1 - z0) / 1.2), kx = (x1 - x0) / nx, kz = (z1 - z0) / nz;
    for (let i = 0; i < nx; i++) { const x = x0 + kx * (i + 0.5); this.put('fence_simple', x, z0, { s: kx, parent }); this.put('fence_simple', x, z1, { s: kx, parent }); }
    for (let i = 0; i < nz; i++) { const z = z0 + kz * (i + 0.5); this.put('fence_simple', x0, z, { s: kz, ry: Math.PI / 2, parent }); this.put('fence_simple', x1, z, { s: kz, ry: Math.PI / 2, parent }); }
  }

  // Fantasy Town parçalarından bina derle (put() h ile ölçekler)
  async building(name) {
    const g = new T.Group(), blades = [];
    await Promise.all(BUILD[name].map(async ([m, x, y, z, ry, tag]) => {
      const o = await this.put(m, x, z, { ry, parent: g }); o.position.y = y;
      if (tag === 'blade') blades.push(o);
    }));
    for (const b of blades) {
      // windmill.glb blades lie in the model's YZ plane: spin about the LOCAL x axis via an inner pivot
      // (rotation.x on b itself is applied after its yaw, i.e. about the parent's X -> wrong plane)
      const spin = new T.Group(); [...b.children].forEach((k) => spin.add(k)); b.add(spin);
      const tick = (t, dt) => { if (!this.S.getObjectById(g.id)) return; spin.rotation.x -= (dt || 0.016) * 1.1 * (1 + 2.6 * (this.amb?.wind || 0)); }; this.tickers.push(tick);
    }
    return g;
  }

  // Kenney'de koyun yok → Cube Pets diliyle kutulardan
  sheep() {
    const g = new T.Group(), M = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.9 });
    const box = (w, h, d, x, y, z, m) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); };
    const wool = M(0xf4f1ea), face = M(0x3b302b);
    box(0.9, 0.6, 1.1, 0, 0.62, 0, wool); box(0.46, 0.46, 0.4, 0, 0.8, 0.66, face); box(0.5, 0.2, 0.3, 0, 1.06, 0.58, wool);
    for (const [x, z] of [[-0.28, -0.35], [0.28, -0.35], [-0.28, 0.35], [0.28, 0.35]]) box(0.16, 0.34, 0.16, x, 0.17, z, face);
    return g;
  }

  // state: 'owned' | 'ghost' | 'hidden'. Rebuilds an item's models when state changes.
  async setItem(id, state, opts = {}) {
    const L = LAYOUT[id]; if (!L) return;
    const cur = this.items[id];
    if (id === 'ahir' && state !== 'owned') this._pen = null;
    const stage = opts.crop === 'growing' ? Math.min(2, Math.floor((opts.growth || 0) * 3)) : -1;
    const pos = state === 'hidden' ? '' : String(this.where(id));
    const sig = state + '|' + (opts.crop || '') + stage + (opts.sick ? '|sick' : '') + '|' + pos + (opts.lv || '') + (opts.bad ? '|bad' : '');
    if (cur && cur.sig === sig) return;
    if (cur) { this.S.remove(cur.g); this.movers = this.movers.filter((m) => m.id !== id); }
    const g = new T.Group(); g.userData.id = id; this.S.add(g);
    const it = this.items[id] = { g, sig, state };
    if (state === 'hidden') return;
    if (L.plot) {
      const [x, z] = this.where(id);
      for (const dz of [-0.45, 0.45]) await this.put('crops_dirtRow', x, z + dz, { s: 1.6, parent: g });
      const cells = [[-0.9, -0.4], [0, -0.4], [0.9, -0.4], [-0.45, 0.4], [0.45, 0.4]];
      if (opts.crop === 'growing') {
        // F4: tohum → filiz → yeşeren; aşama değişince sig değişir, model yenilenir
        const m = ['crops_leafsStageA', 'crops_wheatStageA', 'crops_wheatStageB'][stage], h = [0.2, 0.4, 0.6][stage];
        for (const [dx, dz] of cells) await this.put(m, x + dx, z + dz, { h, ry: Math.random() * 6, parent: g });
      } else if (opts.crop === 'ready') {
        const ripe = { tarla2: 'crops_cornStageD', tarla4: 'crop_pumpkin', tarla5: 'plant_bushLarge' }[id];
        if (ripe) for (const [dx, dz] of cells) await this.put(ripe, x + dx, z + dz, { h: ripe === 'crops_cornStageD' ? 0.9 : 0.45, ry: Math.random() * 6, parent: g });
        else for (const [dx, dz] of cells) await this.put('crop_carrot', x + dx, z + dz, { h: 0.4, ry: Math.random() * 6, parent: g });
        // olgun ürün hafifçe zıplar: "hasat et" çağrısı
        const kids = g.children.slice(2), ph = Math.random() * 6;
        const tick = (t) => { if (!g.parent) { this.tickers = this.tickers.filter((f) => f !== tick); return; } kids.forEach((k, i) => { k.position.y = Math.max(0, Math.sin(t / 180 + ph + i)) * 0.08; }); };
        this.tickers.push(tick);
      }
    } else if (L.area) {
      const n = state === 'owned' ? L.n : 1, area = this.areaOf(id);
      for (let i = 0; i < n; i++) {
        this._col = this.colliders();
        const [x, z] = this.freeIn(area, HOME[id] !== 'ahir');
        const o = await this.put(L.model, x, z, { h: L.h, ry: Math.random() * 6, parent: g });
        if (state === 'owned') this.movers.push({ id, o, area, st: 'idle', until: 0, tx: x, tz: z, ph: Math.random() * 9, v: (L.h < 0.5 ? 0.8 : 0.45) * (opts.sick ? 0.35 : 1), sick: !!opts.sick, ry0: 0, jump: 0, pet: L.pet, pen: HOME[id] !== 'ahir', stk: 0 });
      }
    } else {
      const [x, z] = this.where(id);
      await this.put(L.model, x, z, { h: L.h, ry: L.ry || 0, parent: g });
      // ahır ağılı binayla birlikte taşınır
      if (id === 'ahir' && state === 'owned') { const d = hex(...L.at), ox = x - d[0], oz = z - d[1]; this._pen = [2.6 + ox, -1.4 + oz, 7.4 + ox, 3 + oz]; this.fenceRect(...this._pen, g); }
    }
    if (state === 'place') g.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.6; m.material.color.lerp(new T.Color(opts.bad ? 0xff4040 : 0x40ff70), 0.5); } });
    if (opts.sick) g.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.lerp(new T.Color(0x7fbf4a), 0.45); } });
    if (state === 'ghost') g.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.38; m.castShadow = false; } });
  }

  // tap reaction: the animal jumps and faces the camera
  poke(id) { for (const a of this.movers) if (a.id === id) { a.jump = 0.6; a.st = 'look'; a.ry0 = 0; a.until = performance.now() + 1500; } }

  rndIn(b) { return [b[0] + Math.random() * (b[2] - b[0]), b[1] + Math.random() * (b[3] - b[1])]; }

  // world anchor of an item (top of its model) for overlays
  anchor(id, lift = 0) {
    if (this.items[id]?.at) return this.project(this.items[id].at[0], 1 + lift, this.items[id].at[1]);
    const L = LAYOUT[id]; if (!L) return null;
    let x, z, y = (L.h || 0.3) + lift;
    const m = L.area && this.movers.find((a) => a.id === id);
    if (m) { x = m.o.position.x; z = m.o.position.z; } else [x, z] = this.where(id);
    return this.project(x, y, z);
  }
  project(x, y, z) {
    this.C.updateMatrixWorld(); const v = new T.Vector3(x, y, z).project(this.C);
    return { x: (v.x + 1) / 2 * 540, y: (1 - v.y) / 2 * 960, vis: v.z < 1 };
  }

  // Phaser-space tap -> item id (or null)
  pick(px, py) {
    this.ray.setFromCamera(new T.Vector2(px / 540 * 2 - 1, 1 - py / 960 * 2), this.C);
    const hits = this.ray.intersectObjects(Object.values(this.items).map((i) => i.g), true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.id) o = o.parent; if (o) return o.userData.id; }
    // fallback: nearest anchor within 60px (small animals are hard to hit)
    let best = null, bd = 60;
    for (const id in this.items) { if (this.items[id].state === 'hidden') continue; const a = this.anchor(id, -0.2); const d = a && Math.hypot(a.x - px, a.y - py); if (d < bd) { bd = d; best = id; } }
    return best;
  }



  pan(dx, dy) {
    const k = 0.028 * this.zoom;
    // F7: fixed bounds — main island + side plots; the camera never glides to other regions
    this.target.x = Math.max(-18, Math.min(18, this.target.x - dx * k));
    this.target.z = Math.max(-8, Math.min(9, this.target.z - dy * k));
  }
  zoomBy(f) { this.zoom = Math.max(0.55, Math.min(1.35, this.zoom * f)); }

  placeCamera() {
    const d = 26 * this.zoom;
    this.C.position.set(this.target.x, this.target.y + d * 0.72, this.target.z + d * 0.69);
    this.C.lookAt(this.target);
  }

  // keep the 3D canvas exactly over the Phaser canvas (FIT letterbox)
  fit() {
    const pc = [...document.querySelectorAll('#app canvas')].find((c) => c !== this.canvas);
    if (!pc) return;
    if (pc.style.position !== 'relative') { pc.style.position = 'relative'; pc.style.zIndex = 1; }
    const r = pc.getBoundingClientRect(), pr = this.canvas.parentElement.getBoundingClientRect();
    const sig = [r.left - pr.left, r.top - pr.top, r.width, r.height].map(Math.round).join();
    if (sig === this._fit) return; this._fit = sig;
    Object.assign(this.canvas.style, { left: r.left - pr.left + 'px', top: r.top - pr.top + 'px', width: r.width + 'px', height: r.height + 'px', pointerEvents: 'none' });
    this.R.setPixelRatio(Math.min(LOW_END ? 1.5 : 2, devicePixelRatio));
    this.R.setSize(r.width, r.height, false);
  }

  show() {
    this.canvas.style.display = 'block'; this._fit = null; this.fit();
    if (!this._intro) { this._intro = performance.now(); this.zoomEnd = this.zoom; this.zoom = this.zoom * 1.7; }
    if (this.running) return; this.running = true;
    let last = performance.now();
    this.R.setAnimationLoop((t) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; this.frame(t, dt); });
  }
  // F10: sky + sun follow the real local hour (soft; never fully dark)
  daylight(h = hourNow()) {
    const day = Math.max(0, Math.sin((h - 6) / 12 * Math.PI));          // 0 night .. 1 noon
    this.nightK = Math.min(1, Math.max(0, (h >= 12 ? h - 18.6 : 5.6 - h) / 1.4)); // F19
    const wet = this.amb?.weather === 'yagmur' ? 1 : 0;
    const warm = Math.max(0, 1 - Math.abs(h - 18.5) / 2) + Math.max(0, 1 - Math.abs(h - 6.5) / 2);
    const sky = new T.Color(0x2c3e66).lerp(new T.Color(this.skyBase), 0.35 + 0.65 * day).lerp(new T.Color(0xffb88a), warm * 0.35);
    if (wet) sky.lerp(new T.Color(0x6f7c8a), 0.45);
    sky.lerp(new T.Color(0x141c33), this.nightK * 0.55);
    this.S.background.copy(sky); this.S.fog.color.copy(sky);
    this.sun.intensity = (0.9 + 1.3 * day) * (1 - 0.35 * wet) * (1 - 0.45 * this.nightK);
    this.hemi.intensity = 1.25 * (1 - 0.4 * this.nightK) * (1 - 0.15 * wet);
    this.hemi.color.set(0xffffff).lerp(new T.Color(0x8fa6e0), this.nightK * 0.7);
    this.sun.color.set(0xfff0d0).lerp(new T.Color(0xff9a5a), warm * 0.6);
    this.sun.position.set(8 * Math.cos((h - 12) / 12 * Math.PI) + 2, 14, 6);
  }
  // F10: drifting soft cloud shadows over the ground
  clouds(dt) {
    if (!this._clouds) {
      const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.09, depthWrite: false });
      this._clouds = [0, 1, 2].map((i) => {
        const m = new T.Mesh(new T.CircleGeometry(3 + i, 20), mat);
        m.rotation.x = -Math.PI / 2; m.scale.set(1.6, 1, 1); m.position.set(-14 + i * 11, 0.06, -6 + i * 5); m.renderOrder = 2;
        this.S.add(m); return m;
      });
    }
    const wet = this.amb?.weather === 'yagmur';
    for (const m of this._clouds) { m.material.opacity = wet ? 0.2 : 0.09 * (1 - this.nightK * 0.7); m.position.x += dt * (0.6 + 1.4 * (this.amb?.wind || 0)); if (m.position.x > 18) m.position.x = -18; }
  }
  // F10: little cube burst at an item (harvest, pet, buy)
  burst(id, color = 0xffd23f, n = 14) {
    const o = this.items[id]?.g; if (!o) return;
    const p = new T.Vector3(); o.getWorldPosition(p);
    this._sp = this._sp || [];
    for (let i = 0; i < n; i++) {
      const m = new T.Mesh(new T.BoxGeometry(0.09, 0.09, 0.09), new T.MeshBasicMaterial({ color, transparent: true }));
      m.position.set(p.x, p.y + 0.5, p.z); this.S.add(m);
      const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 1.5;
      this._sp.push({ m, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 2.5 + Math.random() * 2, life: 0.9 });
    }
  }
  sparks(dt) {
    if (!this._sp || !this._sp.length) return;
    this._sp = this._sp.filter((s) => {
      s.life -= dt; s.vy -= 9 * dt;
      s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt;
      s.m.rotation.x += dt * 8; s.m.material.opacity = Math.max(0, s.life / 0.9);
      if (s.life > 0) return true;
      this.S.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); return false;
    });
  }
  hide() { this.running = false; this.R.setAnimationLoop(null); this.canvas.style.display = 'none'; }

  // F9: çarpışmalı adım — engele gelince teğet boyunca kayar, ilerleyemezse vazgeçer (false)
  step(a, ux, uz, v) {
    const p = a.o.position, pad = 0.3, k = v / (a.v || 1);
    let nx = p.x + ux * v, nz = p.z + uz * v;
    if (this.blocked(p.x, p.z, 0, a.pen)) { p.x = nx; p.z = nz; return true; }   // zaten içindeyse serbestçe çıksın
    const c = this.blocked(nx, nz, pad, a.pen);
    if (c === 'pen') { a.stk += k; return a.stk < 1.5; }
    if (c) {
      let ox = nx - c[0], oz = nz - c[1]; const od = Math.hypot(ox, oz) || 1; ox /= od; oz /= od;
      const sg = Math.sign(-oz * ux + ox * uz) || 1;             // hedefe yakın taraftan dolan
      nx = p.x - oz * sg * v; nz = p.z + ox * sg * v;
      const c2 = this.blocked(nx, nz, pad, a.pen);
      if (c2 && c2 !== 'pen') { const qx = nx - c2[0], qz = nz - c2[1], qd = Math.hypot(qx, qz) || 1; nx = c2[0] + qx / qd * (c2[2] + pad); nz = c2[1] + qz / qd * (c2[2] + pad); }
      if (this.blocked(nx, nz, pad * 0.9, a.pen)) { a.stk += k; return a.stk < 1.5; }
      a.stk += k * 0.3; if (a.stk > 5) return false;
    }
    p.x = nx; p.z = nz; return true;
  }

  frame(t, dt) {
    // F2: small state machine per animal: idle -> look / eat / walk, squash-stretch hop
    if (!this._colT || t - this._colT > 600) { this._colT = t; this._col = this.colliders(); }
    for (const a of this.movers) {
      const p = a.o.position, c = a.o.children[0];
      if (t > a.until && a.st !== 'walk') {
        const r = Math.random(), slow = a.sick ? 2.5 : 1;
        if (a.pet === 'follow' && r < 0.8) {
          a.st = 'walk'; a.stk = 0;
          a.tx = Math.max(-11, Math.min(11, this.target.x + (Math.random() - 0.5) * 3)); a.tz = Math.max(-8.5, Math.min(8.5, this.target.z + 1 + Math.random() * 2));
          if (this.blocked(a.tx, a.tz, 0.35, true)) [a.tx, a.tz] = this.freeIn([a.tx - 2, a.tz - 2, a.tx + 2, a.tz + 2], true);
        }
        else if (a.pet === 'sun' && r < 0.6) a.st = 'sun';
        else if (r < 0.45) { a.st = 'walk'; a.stk = 0; [a.tx, a.tz] = this.freeIn(a.area, a.pen); }
        else if (r < 0.7) { a.st = 'look'; a.ry0 = a.o.rotation.y; }
        else if (r < 0.9) a.st = 'eat';
        else a.st = 'idle';
        a.until = t + (1200 + Math.random() * 2200) * slow;
      }
      let hop = 0, sq = 1, tilt = 0;
      if (a.st === 'walk') {
        const dx = a.tx - p.x, dz = a.tz - p.z, d = Math.hypot(dx, dz), v = a.v * dt * (a.pet === 'follow' && d > 3 ? 3 : 1);
        if (d < 0.05) { a.st = 'idle'; a.until = t + 800; }
        else if (!this.step(a, dx / d, dz / d, v)) { a.st = 'idle'; a.until = t + 600; }
        else { let r = Math.atan2(dx, dz) - a.o.rotation.y; r = Math.atan2(Math.sin(r), Math.cos(r)); a.o.rotation.y += r * 0.1; }
        const s = Math.sin(t / (a.sick ? 220 : 110) + a.ph); hop = Math.abs(s) * 0.06; sq = 1 + (Math.abs(s) < 0.25 ? -0.08 : 0.04);
      } else if (a.st === 'look') a.o.rotation.y = a.ry0 + Math.sin(t / 400 + a.ph) * 0.6;
      else if (a.st === 'sun') { sq = 0.72 + Math.sin(t / 900 + a.ph) * 0.02; }   // kedi yayılıp güneşlenir
      else if (a.st === 'eat') tilt = 0.35 + Math.sin(t / 150) * 0.08;
      else sq = 1 + Math.sin(t / 500 + a.ph) * 0.025;             // breathing
      if (!a.jump && (a.id.startsWith('tavuk') || a.id.startsWith('horoz')) && a.st !== 'walk' && Math.random() < dt * 0.35) a.jump = 0.6; // F19: tavuklar zıplar
      if (a.jump > 0) { a.jump = Math.max(0, a.jump - dt); const k = a.jump / 0.6; hop += Math.sin(k * Math.PI) * 0.25; }
      if (c) { const s0 = a.o.scale.x; c.position.y = hop / s0; c.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); c.rotation.x = tilt; }
    }
    for (const f of this.tickers) f(t, dt);
    if (this._intro && this.zoomEnd) {             // F10 intro camera flight
      const k = Math.min(1, (t - this._intro) / 1600), e = 1 - Math.pow(1 - k, 3);
      this.zoom = this.zoomEnd * (1.7 - 0.7 * e); if (k >= 1) this.zoomEnd = 0;
    }
    if ((this._n || 0) % 120 === 0) this.daylight();
    this.clouds(dt); this.sparks(dt);
    if ((this._n = (this._n || 0) + 1) % 20 === 0) this.fit();
    this.placeCamera();
    this.R.render(this.S, this.C);
  }
}

let world = null;
export function getWorld() {
  if (world !== null) return world || null;
  try { world = new FarmWorld(); } catch (e) { console.warn('3D off', e); world = false; }
  return world || null;
}
