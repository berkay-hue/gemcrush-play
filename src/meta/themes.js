// F4: satın alınabilir temalar — oyun sahnesinin gökyüzü/tepe renkleri + harita arka planı.
import { save, persist, spendCoins, spendGems } from './save.js';

export const THEMES = [
  { id: 'meadow', tr: 'Çayır', en: 'Meadow', icon: '🌼', price: 0,
    sky: [0x6ec6f0, 0xc8ecff], sun: 0xfff1a8, halo: 0xfff6c8, hills: [0x8fd16a, 0x6dbb4f, 0x55a23e, 0x4a9135], grass: [0x3f822c, 0x5cae43], mote: 0xfff6b0, map: ['#12332a', '#0b1a15', '#050a08'] },
  { id: 'forest', tr: 'Orman Kıyısı', en: 'Forest Edge', icon: '🌲', price: 1500,
    sky: [0x7fb7a4, 0xd9efe0], sun: 0xfff3c4, halo: 0xf4ffd8, hills: [0x3f7d4a, 0x2f6a3b, 0x245a30, 0x1d4c28], grass: [0x173f20, 0x2c6b37], mote: 0xd8ffb0, map: ['#0f2e1f', '#0a1f15', '#040b07'] },
  { id: 'river', tr: 'Dere Kenarı', en: 'Riverside', icon: '🏞️', price: 2500,
    sky: [0x4fb3e8, 0xbfe9ff], sun: 0xffffff, halo: 0xd9f4ff, hills: [0x9ad3a0, 0x5fb3b8, 0x3f95a3, 0x2f7f8a], grass: [0x256f79, 0x4aa6a8], mote: 0xe0fbff, map: ['#0d2d3a', '#081b24', '#03090c'] },
  { id: 'sunset', tr: 'Gün Batımı', en: 'Sunset', icon: '🌅', gems: 20,
    sky: [0xff8a5c, 0xffd59a], sun: 0xffe1a0, halo: 0xffb27a, hills: [0xc9785a, 0xa85f4a, 0x86483c, 0x6a3830], grass: [0x5a2e28, 0x8e4f3d], mote: 0xffd2a0, map: ['#3a1a22', '#1f0e14', '#0a0508'] },
  { id: 'winter', tr: 'Kış', en: 'Winter', icon: '❄️', gems: 30,
    sky: [0x9fc4e6, 0xeaf4ff], sun: 0xffffff, halo: 0xe8f2ff, hills: [0xf2f7fb, 0xdce9f3, 0xc5d9ea, 0xb4cde2], grass: [0xa9c3da, 0xffffff], mote: 0xffffff, map: ['#1d2c3f', '#101a26', '#05080c'] },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
export const currentTheme = () => themeById(save.theme);
export const ownsTheme = (id) => { const th = THEMES.find((t) => t.id === id); return !!th && ((th.price === 0 && !th.gems) || (save.themes || []).includes(id)); };

export function buyTheme(id) {
  const th = themeById(id);
  if (th.id !== id) return false;
  if (ownsTheme(id)) return true;
  const ok = th.gems ? spendGems(th.gems) : spendCoins(th.price);
  if (!ok) return false;
  save.themes = [...(save.themes || []), id]; persist(); return true;
}
export function setTheme(id) {
  if (!ownsTheme(id)) return false;
  save.theme = id; persist(); return true;
}
