// GemCrush core engine. Pure logic, no rendering. Runs in browser and Node.
//
// Gem types (index): 0 Elmas, 1 Yakut, 2 Zümrüt, 3 Safir, 4 Altın, 5 Gümüş
// Specials: 'line_h' | 'line_v' | 'bomb' | 'prism'
//   4 in a row      -> line (clears its row/column)
//   5 in L / T      -> bomb  (3x3 blast)
//   5 in a line     -> prism (swap with any gem: clears every gem of that color)
// Combos (swap two specials):
//   prism+prism -> whole board
//   prism+line  -> every gem of that color becomes a line, all fire
//   prism+bomb  -> every gem of that color becomes a bomb, all fire
//   line+line   -> row + column cross
//   line+bomb   -> 3 rows + 3 columns
//   bomb+bomb   -> 5x5 blast
//
// Layers: jelly[r][c] (0..2, cleared by clearing the cell), rock[r][c] (hp, damaged by
// adjacent clears or specials), hole[r][c] (no cell), lock on gem (chain; a match unlocks
// instead of clearing).

import { makeRng } from './rng.js';

export const SPECIALS = ['line_h', 'line_v', 'bomb', 'prism'];

export class Board {
  constructor(level, seed = 1, perks = null) {
    this.level = level;
    this.bombBonus = (perks && perks.bombBonus) || 0;
    this.W = level.width || 8;
    this.H = level.height || 8;
    this.types = level.gemTypes || 6;
    this.rng = makeRng(seed);
    this.moves = level.moves;
    this.score = 0;
    this.collected = {};
    this.events = [];
    this.cascade = 0;
    this.hole = grid(this.H, this.W, false);
    this.jelly = grid(this.H, this.W, 0);
    this.rock = grid(this.H, this.W, 0);
    this.cells = grid(this.H, this.W, null);
    this.applyLayout(level.layout);
    this.fillInitial();
  }

  // layout: array of H strings, W chars each.
  // '.' normal, 'X' hole, 'j' jelly1, 'J' jelly2, 'r' rock1, 'R' rock2, 'l' locked gem
  applyLayout(layout) {
    if (!layout) return;
    for (let r = 0; r < this.H; r++)
      for (let c = 0; c < this.W; c++) {
        const ch = (layout[r] || '')[c] || '.';
        if (ch === 'X') this.hole[r][c] = true;
        else if (ch === 'j') this.jelly[r][c] = 1;
        else if (ch === 'J') this.jelly[r][c] = 2;
        else if (ch === 'r') this.rock[r][c] = 1;
        else if (ch === 'R') this.rock[r][c] = 2;
        else if (ch === 'l') this.cells[r][c] = { type: -1, special: null, locked: true };
      }
  }

  fillInitial() {
    for (let r = 0; r < this.H; r++)
      for (let c = 0; c < this.W; c++) {
        if (this.hole[r][c] || this.rock[r][c]) { this.cells[r][c] = null; continue; }
        const locked = !!(this.cells[r][c] && this.cells[r][c].locked);
        let t;
        let guard = 0;
        do { t = this.rng.int(this.types); guard++; }
        while (guard < 50 && this.makesMatchAt(r, c, t));
        this.cells[r][c] = { type: t, special: null, locked };
      }
    if (!this.findValidMoves().length) this.shuffle();
  }

  makesMatchAt(r, c, t) {
    const g = (rr, cc) => this.cells[rr] && this.cells[rr][cc] && this.cells[rr][cc].type === t;
    return (g(r, c - 1) && g(r, c - 2)) || (g(r - 1, c) && g(r - 2, c));
  }

  isPlayable(r, c) {
    return r >= 0 && c >= 0 && r < this.H && c < this.W && !this.hole[r][c];
  }
  gem(r, c) {
    return this.isPlayable(r, c) ? this.cells[r][c] : null;
  }

  // ---------- Moves ----------

  canSwap(r1, c1, r2, c2) {
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
    const a = this.gem(r1, c1), b = this.gem(r2, c2);
    if (!a || !b || a.locked || b.locked) return false;
    // any special gem can be swapped in any direction; it fires on its own
    if (a.special || b.special) return true;
    this.swapCells(r1, c1, r2, c2);
    const ok = this.findMatches().length > 0;
    this.swapCells(r1, c1, r2, c2);
    return ok;
  }

  swapCells(r1, c1, r2, c2) {
    const t = this.cells[r1][c1];
    this.cells[r1][c1] = this.cells[r2][c2];
    this.cells[r2][c2] = t;
  }

  findValidMoves() {
    const out = [];
    for (let r = 0; r < this.H; r++)
      for (let c = 0; c < this.W; c++) {
        if (c + 1 < this.W && this.canSwap(r, c, r, c + 1)) out.push([r, c, r, c + 1]);
        if (r + 1 < this.H && this.canSwap(r, c, r + 1, c)) out.push([r, c, r + 1, c]);
      }
    return out;
  }

  shuffle() {
    const pool = [];
    for (let r = 0; r < this.H; r++)
      for (let c = 0; c < this.W; c++) {
        const g = this.gem(r, c);
        if (g && !g.locked && !g.special) pool.push(g.type);
      }
    let tries = 0;
    do {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = this.rng.int(i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      let k = 0;
      for (let r = 0; r < this.H; r++)
        for (let c = 0; c < this.W; c++) {
          const g = this.gem(r, c);
          if (g && !g.locked && !g.special) g.type = pool[k++];
        }
      tries++;
    } while (tries < 200 && (this.findMatches().length || !this.findValidMoves().length));
    this.events.push({ type: 'shuffle' });
  }

  // Player move. Returns events for animation; null if illegal.
  playSwap(r1, c1, r2, c2) {
    if (!this.canSwap(r1, c1, r2, c2)) return null;
    this.events = [];
    this.cascade = 0;
    this.moves--;
    const a = this.gem(r1, c1), b = this.gem(r2, c2);
    this.swapCells(r1, c1, r2, c2);
    this.events.push({ type: 'swap', from: [r1, c1], to: [r2, c2] });

    const comboHandled = this.applySwapCombo(r1, c1, r2, c2, a, b);
    this.resolve(comboHandled ? null : [[r1, c1], [r2, c2]]);
    if (!this.findValidMoves().length && !this.isWon()) this.shuffle();
    return this.events;
  }

  // Booster: remove one gem (hammer)
  useHammer(r, c) {
    const g = this.gem(r, c);
    if (!g) return null;
    this.events = [];
    this.cascade = 0;
    this.clearSet(new Set([key(r, c)]), 'hammer');
    this.resolve(null);
    return this.events;
  }

  // ---------- Combos ----------

  applySwapCombo(r1, c1, r2, c2, a, b) {
    const sa = a.special, sb = b.special;
    if (!sa && !sb) return false;
    // after swap, a is at (r2,c2), b at (r1,c1)
    const pa = [r2, c2], pb = [r1, c1];
    const set = new Set();
    const add = (r, c) => { if (this.isPlayable(r, c)) set.add(key(r, c)); };

    if (sa === 'prism' && sb === 'prism') {
      for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) add(r, c);
      this.events.push({ type: 'combo', kind: 'prism_prism', at: pa });
      this.clearSet(set, 'combo', true);
      return true;
    }
    if (sa === 'prism' || sb === 'prism') {
      const prismPos = sa === 'prism' ? pa : pb;
      const other = sa === 'prism' ? b : a;
      const otherPos = sa === 'prism' ? pb : pa;
      const color = other.type;
      if (other.special) {
        // every gem of that color becomes the other special, then all fire
        const kind = other.special;
        for (let r = 0; r < this.H; r++)
          for (let c = 0; c < this.W; c++) {
            const g = this.gem(r, c);
            if (g && g.type === color && !g.locked && !g.special) {
              g.special = kind === 'bomb' ? 'bomb' : (this.rng.int(2) ? 'line_h' : 'line_v');
              this.events.push({ type: 'convert', at: [r, c], special: g.special });
            }
          }
        this.events.push({ type: 'combo', kind: 'prism_' + kind, at: prismPos });
        add(...prismPos); add(...otherPos);
        for (let r = 0; r < this.H; r++)
          for (let c = 0; c < this.W; c++) {
            const g = this.gem(r, c);
            if (g && g.type === color) add(r, c);
          }
        this.clearSet(set, 'combo', true);
      } else {
        this.events.push({ type: 'combo', kind: 'prism', at: prismPos, color });
        add(...prismPos);
        for (let r = 0; r < this.H; r++)
          for (let c = 0; c < this.W; c++) {
            const g = this.gem(r, c);
            if (g && g.type === color) add(r, c);
          }
        this.clearSet(set, 'prism', true);
      }
      return true;
    }
    if (sa && sb) {
      const [r, c] = pa;
      const isLine = (s) => s === 'line_h' || s === 'line_v';
      if (isLine(sa) && isLine(sb)) {
        for (let i = 0; i < this.W; i++) add(r, i);
        for (let i = 0; i < this.H; i++) add(i, c);
        this.events.push({ type: 'combo', kind: 'cross', at: pa });
      } else if (sa === 'bomb' && sb === 'bomb') {
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) add(r + dr, c + dc);
        this.events.push({ type: 'combo', kind: 'bigbomb', at: pa });
      } else {
        for (let d = -1; d <= 1; d++) {
          for (let i = 0; i < this.W; i++) add(r + d, i);
          for (let i = 0; i < this.H; i++) add(i, c + d);
        }
        this.events.push({ type: 'combo', kind: 'linebomb', at: pa });
      }
      add(...pb);
      this.clearSet(set, 'combo', true);
      return true;
    }
    // single special swapped with a plain gem: if the swap makes a match, resolve
    // normally (the special clears with its group); otherwise fire it where it landed
    if (this.findMatches().length) return false;
    const pos = sa ? pa : pb;
    add(...pos);
    this.events.push({ type: 'combo', kind: 'single', at: pos });
    this.clearSet(set, 'special', true);
    return true;
  }

  // ---------- Resolution loop ----------

  resolve(swapped) {
    let guard = 0;
    while (guard++ < 60) {
      const groups = this.findMatches();
      if (groups.length) {
        this.cascade++;
        this.processMatches(groups, swapped);
        swapped = null;
      }
      const fell = this.gravityAndRefill();
      if (!groups.length && !fell) break;
    }
  }

  // Returns groups: [{cells:[[r,c],...], runs:[{dir,len,cells}]}]
  findMatches() {
    const runs = [];
    for (let r = 0; r < this.H; r++) {
      let c = 0;
      while (c < this.W) {
        const g = this.gem(r, c);
        if (!g || g.type < 0) { c++; continue; }
        let e = c;
        while (e + 1 < this.W && this.gem(r, e + 1) && this.gem(r, e + 1).type === g.type) e++;
        if (e - c + 1 >= 3) runs.push({ dir: 'h', len: e - c + 1, cells: range(c, e).map((x) => [r, x]) });
        c = e + 1;
      }
    }
    for (let c = 0; c < this.W; c++) {
      let r = 0;
      while (r < this.H) {
        const g = this.gem(r, c);
        if (!g || g.type < 0) { r++; continue; }
        let e = r;
        while (e + 1 < this.H && this.gem(e + 1, c) && this.gem(e + 1, c).type === g.type) e++;
        if (e - r + 1 >= 3) runs.push({ dir: 'v', len: e - r + 1, cells: range(r, e).map((x) => [x, c]) });
        r = e + 1;
      }
    }
    // merge runs sharing a cell into groups
    const groups = [];
    const owner = new Map();
    for (const run of runs) {
      let target = null;
      for (const [r, c] of run.cells) {
        const o = owner.get(key(r, c));
        if (o !== undefined) { target = o; break; }
      }
      if (target === null) {
        target = groups.length;
        groups.push({ cells: [], runs: [], type: this.gem(...run.cells[0]).type });
      }
      const grp = groups[target];
      grp.runs.push(run);
      for (const [r, c] of run.cells) {
        const k = key(r, c);
        if (!owner.has(k)) { owner.set(k, target); grp.cells.push([r, c]); }
      }
    }
    return groups;
  }

  processMatches(groups, swapped) {
    const toClear = new Set();
    for (const grp of groups) {
      const maxLen = Math.max(...grp.runs.map((x) => x.len));
      const hasH = grp.runs.some((x) => x.dir === 'h');
      const hasV = grp.runs.some((x) => x.dir === 'v');
      let special = null;
      if (maxLen >= 5) special = 'prism';
      else if (hasH && hasV) special = 'bomb';
      else if (maxLen === 4) special = this.bombBonus && this.rng.next() < this.bombBonus ? 'bomb' : (hasH ? 'line_h' : 'line_v');

      let spawnAt = null;
      if (special) {
        // prefer the cell the player swapped into, else the run's middle / intersection
        if (swapped) spawnAt = grp.cells.find(([r, c]) => swapped.some(([sr, sc]) => sr === r && sc === c)) || null;
        if (!spawnAt) {
          if (hasH && hasV) {
            const h = grp.runs.find((x) => x.dir === 'h'), v = grp.runs.find((x) => x.dir === 'v');
            spawnAt = h.cells.find(([r, c]) => v.cells.some(([vr, vc]) => vr === r && vc === c)) || grp.cells[0];
          } else {
            const run = grp.runs[0];
            spawnAt = run.cells[Math.floor(run.len / 2)];
          }
        }
      }
      const base = 60 + (grp.cells.length - 3) * 20;
      this.score += base * this.cascade;
      this.events.push({ type: 'match', cells: grp.cells, gemType: grp.type, score: base * this.cascade, cascade: this.cascade });
      for (const [r, c] of grp.cells) toClear.add(key(r, c));
      if (special) {
        grp.spawn = { at: spawnAt, special };
      }
    }
    // specials spawned survive the clear
    const keep = new Map();
    for (const grp of groups) if (grp.spawn) keep.set(key(...grp.spawn.at), grp);
    for (const k of keep.keys()) toClear.delete(k);
    this.clearSet(toClear, 'match', false);
    for (const [k, grp] of keep) {
      const [r, c] = grp.spawn.at;
      const g = this.gem(r, c);
      if (g) {
        g.special = grp.spawn.special;
        g.type = grp.type;
        g.locked = false;
        this.events.push({ type: 'spawn_special', at: [r, c], special: g.special, gemType: g.type });
      }
    }
  }

  // Clears a set of cells, triggering specials found inside (chain), damaging layers.
  clearSet(set, reason, fromSpecial) {
    const queue = [...set];
    const done = new Set();
    const cleared = [];
    const hits = []; // special activations for FX
    while (queue.length) {
      const k = queue.pop();
      if (done.has(k)) continue;
      done.add(k);
      const [r, c] = unkey(k);
      if (!this.isPlayable(r, c)) continue;
      // rock: takes damage instead
      if (this.rock[r][c] > 0) {
        this.rock[r][c]--;
        this.events.push({ type: 'rock_hit', at: [r, c], left: this.rock[r][c] });
        this.score += 30;
        continue;
      }
      const g = this.cells[r][c];
      if (!g) continue;
      if (g.locked) {
        g.locked = false;
        this.events.push({ type: 'unlock', at: [r, c] });
        this.score += 30;
        continue;
      }
      // activate special
      if (g.special) {
        const s = g.special;
        hits.push({ at: [r, c], special: s });
        const add = (rr, cc) => { if (this.isPlayable(rr, cc)) queue.push(key(rr, cc)); };
        if (s === 'line_h') for (let i = 0; i < this.W; i++) add(r, i);
        else if (s === 'line_v') for (let i = 0; i < this.H; i++) add(i, c);
        else if (s === 'bomb') for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(r + dr, c + dc);
        else if (s === 'prism') {
          // fired indirectly: clear the most common color
          const count = new Array(this.types).fill(0);
          for (let rr = 0; rr < this.H; rr++) for (let cc = 0; cc < this.W; cc++) { const x = this.gem(rr, cc); if (x && x.type >= 0) count[x.type]++; }
          const color = count.indexOf(Math.max(...count));
          for (let rr = 0; rr < this.H; rr++) for (let cc = 0; cc < this.W; cc++) { const x = this.gem(rr, cc); if (x && x.type === color) add(rr, cc); }
        }
        this.score += 100;
      }
      if (g.type >= 0) this.collected[g.type] = (this.collected[g.type] || 0) + 1;
      this.cells[r][c] = null;
      cleared.push([r, c]);
      if (this.jelly[r][c] > 0) {
        this.jelly[r][c]--;
        this.events.push({ type: 'jelly_hit', at: [r, c], left: this.jelly[r][c] });
        this.score += 40;
      }
      // damage adjacent rocks
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (this.isPlayable(rr, cc) && this.rock[rr][cc] > 0 && !done.has(key(rr, cc))) {
          this.rock[rr][cc]--;
          done.add(key(rr, cc));
          this.events.push({ type: 'rock_hit', at: [rr, cc], left: this.rock[rr][cc] });
          this.score += 30;
        }
      }
    }
    if (hits.length) this.events.push({ type: 'specials_fire', hits });
    if (cleared.length) this.events.push({ type: 'clear', cells: cleared, reason });
    return cleared;
  }

  gravityAndRefill() {
    const falls = [];
    const spawns = [];
    for (let c = 0; c < this.W; c++) {
      let write = this.H - 1;
      for (let r = this.H - 1; r >= 0; r--) {
        if (this.hole[r][c] || this.rock[r][c]) {
          // barrier: everything above stacks on top of it
          write = r - 1;
          continue;
        }
        const g = this.cells[r][c];
        if (g) {
          if (g.locked) { write = r - 1; continue; } // locked gems do not fall
          if (write !== r) {
            this.cells[write][c] = g;
            this.cells[r][c] = null;
            falls.push({ from: [r, c], to: [write, c] });
          }
          write--;
        }
      }
      // refill from top of each empty stretch that is open to the sky (top of column segment)
    }
    // spawn new gems into empty playable cells, top-down, and record their "drop distance"
    for (let c = 0; c < this.W; c++) {
      let above = 0;
      for (let r = 0; r < this.H; r++) {
        if (this.hole[r][c] || this.rock[r][c]) { above = 0; continue; }
        if (!this.cells[r][c]) {
          const t = this.rng.int(this.types);
          this.cells[r][c] = { type: t, special: null, locked: false };
          above++;
          spawns.push({ at: [r, c], gemType: t, fromAbove: above });
        }
      }
    }
    if (falls.length || spawns.length) this.events.push({ type: 'fall', falls, spawns });
    return falls.length > 0 || spawns.length > 0;
  }

  // ---------- Objectives ----------

  progress() {
    const obj = this.level.objectives;
    const out = [];
    if (obj.score) out.push({ kind: 'score', target: obj.score, current: Math.min(this.score, obj.score) });
    if (obj.collect)
      for (const [t, n] of Object.entries(obj.collect))
        out.push({ kind: 'collect', gemType: +t, target: n, current: Math.min(this.collected[t] || 0, n) });
    if (obj.jelly) {
      const total = this.count(this.jelly);
      out.push({ kind: 'jelly', target: obj.jelly, current: obj.jelly - total });
    }
    if (obj.rock) {
      const total = this.count(this.rock);
      out.push({ kind: 'rock', target: obj.rock, current: obj.rock - total });
    }
    if (obj.lock) {
      let left = 0;
      for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) if (this.cells[r][c] && this.cells[r][c].locked) left++;
      out.push({ kind: 'lock', target: obj.lock, current: obj.lock - left });
    }
    return out;
  }
  count(layer) {
    let n = 0;
    for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) n += layer[r][c];
    return n;
  }
  isWon() {
    return this.progress().every((p) => p.current >= p.target);
  }
  isLost() {
    return this.moves <= 0 && !this.isWon();
  }
  // Hedef ilerlemesi 0..1 (her hedef eşit ağırlık)
  objFrac() {
    const p = this.progress();
    if (!p.length) return 0;
    return p.reduce((a, o) => a + Math.min(1, o.current / o.target), 0) / p.length;
  }
  // Yıldız = hedef ilerlemesi: ⅓ → 1, ⅔ → 2, bölüm bitince 3. Kazanmak = 3 yıldız.
  stars() {
    if (this.isWon()) return 3;
    const f = this.objFrac();
    return f >= 2 / 3 ? 2 : f >= 1 / 3 ? 1 : 0;
  }
  // Convert leftover moves to score at the end of a won level
  cashOutMoves() {
    const bonus = this.moves * 200;
    this.score += bonus;
    this.moves = 0;
    return bonus;
  }
}

export function key(r, c) { return r * 100 + c; }
export function unkey(k) { return [Math.floor(k / 100), k % 100]; }
function grid(h, w, v) { return Array.from({ length: h }, () => new Array(w).fill(v)); }
function range(a, b) { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; }
