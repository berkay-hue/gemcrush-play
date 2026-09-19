// F14: Hasat festivali — saf (DOM'suz) bölüm üretici; test-bot da bunu kullanır.
// Festival her iki haftada bir, 7 gün sürer (epoch haftası çiftse açık).
export const WEEK = 604800000, FEST_N = 10, FEST_BASE = 1000;
const TEMPLATES = [12, 25, 38, 47, 56, 63, 74, 85, 93, 100];
export const FEST_EXTRA = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]; // şablona eklenen hamle

export const festWeek = (now = Date.now()) => Math.floor(now / WEEK);
export const festActive = (now = Date.now()) => festWeek(now) % 2 === 1;
// açıksa bitişe, kapalıysa sonraki başlangıca kalan ms
export function festMsLeft(now = Date.now()) {
  const w = festWeek(now);
  return (w + 1) * WEEK - now;
}
export function festivalLevels(levels) {
  return TEMPLATES.map((src, i) => {
    const l = JSON.parse(JSON.stringify(levels[src - 1]));
    delete l.boss; delete l.wall; delete l.botWin;
    return { ...l, id: FEST_BASE + i + 1, name: `🌾 Hasat ${i + 1}`, festival: i + 1, moves: l.moves + FEST_EXTRA[i], seed: 7000 + i * 13 };
  });
}
