// F6: "Bereket" — after a 3-star win, crop harvests pay double for 10 minutes.
import { save, persist } from './save.js';
import { gameNow } from './clock.js'; // F356: süreler oyun saatiyle
export const BEREKET_MS = 10 * 60000;
export const bereketLeft = (now = gameNow()) => Math.max(0, (save.farm.bereket || 0) - now);
export function startBereket(now = gameNow()) { save.farm.bereket = now + BEREKET_MS; persist(); }
