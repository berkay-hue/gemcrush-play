// F9: ground/grassTint/leafTint/trees → tema TÜM çiftliği boyar (çimen, yaprak, orman halkası).
// F4/F7: satın alınabilir temalar (yalnız 💎) — gökyüzü/tepe renkleri + çiftlik arka plan dekoru (dress: [model,x,z,h,ry]) — oyun sahnesinin gökyüzü/tepe renkleri + harita arka planı.
import { save, persist, spendGems } from './save.js';

export const THEMES = [
  { id: 'meadow', ground: 0x5f9e3c, tr: 'Çayır', en: 'Meadow', icon: '🌼', price: 0, skyBase: 0xa8dcf2, dress: [],
    sky: [0x6ec6f0, 0xc8ecff], sun: 0xfff1a8, halo: 0xfff6c8, hills: [0x8fd16a, 0x6dbb4f, 0x55a23e, 0x4a9135], grass: [0x3f822c, 0x5cae43], mote: 0xfff6b0, map: ['#12332a', '#0b1a15', '#050a08'] },
  { id: 'forest', fx: 'pollen', ground: 0x3f6f35, grassTint: [0x2f6b35, 0.35], leafTint: [0x1f4d2a, 0.25], trees: ['tree_pineTallA', 'tree_pineRoundA', 'tree_pineRoundC', 'tree_pineTallA', 'tree_detailed'], tr: 'Orman Kıyısı', en: 'Forest Edge', icon: '🌲', gems: 25, skyBase: 0x9fd0bc,
    dress: [['tree_pineTallA', -8, -13, 4.5], ['tree_pineRoundA', -4, -14, 3.5], ['tree_pineTallA', 0, -15, 5], ['tree_pineRoundC', 5, -13.5, 3.8], ['tree_pineTallA', 9, -14, 4.6], ['tree_detailed', 13, -12, 3.2], ['tree_detailed', -13, -12, 3.2]],
    sky: [0x7fb7a4, 0xd9efe0], sun: 0xfff3c4, halo: 0xf4ffd8, hills: [0x3f7d4a, 0x2f6a3b, 0x245a30, 0x1d4c28], grass: [0x173f20, 0x2c6b37], mote: 0xd8ffb0, map: ['#0f2e1f', '#0a1f15', '#040b07'] },
  { id: 'river', ground: 0x4f9a5a, grassTint: [0x3fae8a, 0.2], trees: ['tree_oak', 'tree_default', 'tree_detailed', 'tree_pineRoundA'], tr: 'Dere Kenarı', en: 'Riverside', icon: '🏞️', gems: 30, skyBase: 0x8fd4f5,
    dress: [['kaykit/hex_river_A', -6, -13, 0.4], ['kaykit/hex_water', -2, -13.5, 0.4], ['kaykit/hex_river_A', 2, -13, 0.4, 1], ['bridge_wood', 0, -12.5, 0.8], ['tree_oak', -10, -13, 3.2], ['tree_oak', 10, -13, 3.2], ['kaykit/rock_single_A', 6, -12.5, 0.8]],
    sky: [0x4fb3e8, 0xbfe9ff], sun: 0xffffff, halo: 0xd9f4ff, hills: [0x9ad3a0, 0x5fb3b8, 0x3f95a3, 0x2f7f8a], grass: [0x256f79, 0x4aa6a8], mote: 0xe0fbff, map: ['#0d2d3a', '#081b24', '#03090c'] },
  { id: 'sunset', fx: 'leaf', ground: 0x9a7a3a, grassTint: [0xd29a45, 0.45], leafTint: [0xe0823a, 0.55], trees: ['tree_fat_fall', 'tree_oak', 'tree_fat', 'tree_default'], tr: 'Gün Batımı', en: 'Sunset', icon: '🌅', gems: 10, skyBase: 0xffc49a,
    dress: [['tree_fat_fall', -9, -13, 3], ['tree_fat_fall', 9, -13, 3], ['kaykit/cloud_big', 0, -16, 1.4]],
    sky: [0xff8a5c, 0xffd59a], sun: 0xffe1a0, halo: 0xffb27a, hills: [0xc9785a, 0xa85f4a, 0x86483c, 0x6a3830], grass: [0x5a2e28, 0x8e4f3d], mote: 0xffd2a0, map: ['#3a1a22', '#1f0e14', '#0a0508'] },
  { id: 'winter', fx: 'snow', ground: 0xe6eef5, grassTint: [0xf4f8fc, 0.82], leafTint: [0xeef5fb, 0.6], trees: ['tree_cone', 'tree_pineTallA', 'tree_pineRoundA', 'tree_cone'], tr: 'Kış', en: 'Winter', icon: '❄️', gems: 20, skyBase: 0xd6e8f7,
    dress: [['tree_cone', -9, -13, 3.6], ['tree_cone', -3, -14, 4.2], ['tree_cone', 3, -14, 4], ['tree_cone', 9, -13, 3.6], ['kaykit/rock_single_A', 12, -12, 1]],
    sky: [0x9fc4e6, 0xeaf4ff], sun: 0xffffff, halo: 0xe8f2ff, hills: [0xf2f7fb, 0xdce9f3, 0xc5d9ea, 0xb4cde2], grass: [0xa9c3da, 0xffffff], mote: 0xffffff, map: ['#1d2c3f', '#101a26', '#05080c'] },
  // F7: ücretsiz CC0 model setleriyle "demo" temalar (Quaternius / KayKit) — daha zengin, daha pahalı
  { id: 'quaternius', ground: 0x6aae45, grassTint: [0x8fd35a, 0.25], tr: 'Quaternius Çiftliği', en: 'Quaternius Farm', icon: '🐑', gems: 35, skyBase: 0xb5e2f5,
    sky: [0x78c8ee, 0xd4f0ff], sun: 0xfff4b8, halo: 0xfff8d4, hills: [0xa3d977, 0x86c65c, 0x6aad47, 0x57983a], grass: [0x4c8f33, 0x6bbd4c], mote: 0xfffbd0, map: ['#163a26', '#0d2217', '#050c08'],
    dress: [['q_barn', -7, -14, 3.6, 0.3], ['q_coop', 6, -13.5, 2.2, -0.3], ['q_cow', -2, -12.5, 1.1, 0.8], ['q_sheep', 2, -12.8, 0.9, -0.6], ['q_sheep', 3.2, -13.6, 0.9, 2], ['tree_oak', -12, -13, 3.2], ['tree_oak', 11, -13, 3.2]] },
  { id: 'kaykit', ground: 0x5a9e3e, trees: ['tree_default', 'tree_blocks', 'tree_oak', 'tree_fat'], tr: 'KayKit Köyü', en: 'KayKit Village', icon: '🏘️', gems: 45, skyBase: 0xa6d8f7,
    sky: [0x62b8ec, 0xcbeeff], sun: 0xfff0a0, halo: 0xfff4cc, hills: [0x92cf72, 0x74bb58, 0x5ca446, 0x4a8f38], grass: [0x3d7f2c, 0x5fae45], mote: 0xfff4b0, map: ['#12352a', '#0a1e17', '#040a07'],
    dress: [['kaykit/hills_A_trees', -11, -15, 2.4], ['kaykit/building_windmill_green', -6, -13.5, 4.2], ['kaykit/building_home_A_green', -1.5, -14, 2.6], ['kaykit/building_market_green', 3, -13.5, 2.4], ['kaykit/building_well_green', 7, -12.5, 1.6], ['kaykit/building_grain', 10.5, -13.5, 2.4], ['kaykit/trees_B_large', 14, -14, 3], ['kaykit/trees_A_medium', -14, -12.5, 2.4], ['kaykit/cloud_big', 4, -18, 1.4]] },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
export const currentTheme = () => themeById(save.theme);
export const ownsTheme = (id) => { const th = THEMES.find((t) => t.id === id); return !!th && ((th.price === 0 && !th.gems) || (save.themes || []).includes(id)); };

export function buyTheme(id) {
  const th = themeById(id);
  if (th.id !== id) return false;
  if (ownsTheme(id)) return true;
  if (!spendGems(th.gems || 0)) return false;
  save.themes = [...(save.themes || []), id]; persist(); return true;
}
export function setTheme(id) {
  if (!ownsTheme(id)) return false;
  save.theme = id; persist(); return true;
}
