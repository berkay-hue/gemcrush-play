// F33: dizilim kombosu — aynı tohum yan yana ekilirse her komşu +%10 satış (en fazla +%30).
// Arılar: kovanın yakınındaki tarla %15 hızlı büyür (tozlaşma); kovan yakınında ayçiçeği açıksa bal %25 hızlı gelir.
import { save } from './save.js';
import { posOf, owns } from './farm.js';

const SQ3 = Math.sqrt(3), hex = (q, r) => [2 * (q + r / 2), SQ3 * r];
// FarmWorld LAYOUT ile aynı varsayılan yerler (Düzenle ile taşınınca posOf kazanır)
const HEX = { tarla1: [-2, 2], tarla2: [-1, 2], tarla3: [0, 2], tarla4: [-3, 3], tarla5: [-2, 3], tarla6: [-1, 3], tarla7: [0, 3], tarla8: [-4, 4], tarla9: [-3, 4], tarla10: [-2, 4] };
export const HIVE = [-6, 3.7], NEAR = 2.3, BEE_R = 4.5;
export const COMBO_STEP = 0.1, COMBO_MAX = 3, BEE_SPEED = 0.85, HONEY_SPEED = 0.75;
export const PLOTS = Object.keys(HEX);

export const plotPos = (id) => posOf(id) || (HEX[id] ? hex(...HEX[id]) : null);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const crops = () => (save.farm && save.farm.crops) || {};

// komşu tarlalar (ekili olsun olmasın)
export function neighbors(id) {
  const p = plotPos(id); if (!p) return [];
  return PLOTS.filter((o) => o !== id && owns(o) && dist(p, plotPos(o)) < NEAR);
}
// aynı tohumu taşıyan ekili komşu sayısı (0..COMBO_MAX)
export function comboOf(id) {
  const c = crops()[id]; if (!c || !c.seed) return 0;
  return Math.min(COMBO_MAX, neighbors(id).filter((o) => crops()[o] && crops()[o].seed === c.seed).length);
}
export const comboMul = (id) => 1 + COMBO_STEP * comboOf(id);
// kovan yakınında mı (kovan alınmış olmalı)
export const beeNear = (id) => owns('kovan') && !!plotPos(id) && dist(plotPos(id), HIVE) < BEE_R;
export const beeSpeed = (id) => (beeNear(id) ? BEE_SPEED : 1);
// kovan çevresinde ekili ayçiçeği var mı
export const flowersNearHive = () => owns('kovan') && PLOTS.some((o) => owns(o) && crops()[o] && crops()[o].seed === 'sunflower' && dist(plotPos(o), HIVE) < BEE_R);
export const honeyMul = () => (flowersNearHive() ? HONEY_SPEED : 1);
