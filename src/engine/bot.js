// Greedy bot used for level calibration and for in-game hints.
// Scores every legal move by simulating it on a cloned board and looking at
// objective progress + score. Deliberately weaker than a good human.

import { Board } from './board.js';

export function cloneBoard(b) {
  const n = Object.create(Board.prototype);
  n.level = b.level; n.W = b.W; n.H = b.H; n.types = b.types;
  n.moves = b.moves; n.bombBonus = b.bombBonus || 0; n.score = b.score; n.cascade = 0; n.events = [];
  n.collected = { ...b.collected };
  n.hole = b.hole;
  n.jelly = b.jelly.map((r) => r.slice());
  n.rock = b.rock.map((r) => r.slice());
  n.ice = b.ice.map((r) => r.slice()); n.fence = b.fence.map((r) => r.slice()); n.mud = b.mud.map((r) => r.slice());
  n.used = b.used; n.mudHit = 0;
  n.cells = b.cells.map((r) => r.map((g) => (g ? { ...g } : null)));
  // cloned sims use a fixed rng so evaluation is deterministic
  let s = 12345;
  n.rng = { int: (k) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % k; }, next: () => 0.5 };
  return n;
}

export function evaluate(before, after) {
  let v = after.score - before.score;
  const pb = before.progress(), pa = after.progress();
  for (let i = 0; i < pa.length; i++) {
    const gain = pa[i].current - pb[i].current;
    if (pa[i].kind !== 'score') v += gain * 300;
  }
  // specials on board are worth keeping
  for (let r = 0; r < after.H; r++)
    for (let c = 0; c < after.W; c++) {
      const g = after.cells[r][c];
      if (g && g.special) v += g.special === 'prism' ? 250 : g.special === 'bomb' ? 150 : 100;
    }
  return v;
}

export function bestMove(board, noise = 0) {
  const moves = board.findValidMoves();
  if (!moves.length) return null;
  let best = null, bestV = -Infinity;
  for (const m of moves) {
    const sim = cloneBoard(board);
    sim.playSwap(...m);
    let v = evaluate(board, sim);
    if (noise) v += (Math.random() - 0.5) * noise;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}

// Play a whole level. Returns {won, movesLeft, score, stars}
export function playLevel(level, seed, noise = 0, perks = null) {
  const b = new Board(level, seed, perks);
  if (perks && perks.extraMoves) b.moves += perks.extraMoves;
  let guard = 0;
  while (!b.isWon() && b.moves > 0 && guard++ < 500) {
    const m = bestMove(b, noise);
    if (!m) break;
    b.playSwap(...m);
  }
  const won = b.isWon();
  if (won) b.cashOutMoves();
  return { won, movesLeft: b.moves, score: b.score, stars: b.stars() };
}
