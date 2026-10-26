// F392 (uygulamadaki F251): levels.json bölüm adları Türkçe; Türkçe dışında İngilizce tablodan, tabloda yoksa ham ad
import { getLang } from './i18n.js';

const CHAPTER_EN = new Map(Object.entries({
  Kalp: 'Heart', Adalar: 'Islands', Koridor: 'Corridor', 'Çerçeve': 'Frame', Spiral: 'Spiral', 'Kum Saati': 'Hourglass',
  Kafes: 'Cage', Kale: 'Castle', Dama: 'Checkers', 'Taç': 'Crown', 'Yosunlu Vadi': 'Mossy Valley', Elmas: 'Diamond',
  'Köprü': 'Bridge', Merdiven: 'Staircase', 'Çiçek': 'Flower', Kuyu: 'Well', 'Şimşek': 'Lightning', Ambar: 'Barn', Labirent: 'Maze',
  'Yosun Tapınağı': 'Moss Temple', 'Kuzu Ağılı': 'Lamb Pen', 'Su Kanalı': 'Water Canal', 'Hasat Yolu': 'Harvest Road',
  'Değirmen Deresi': 'Mill Creek', 'Altın Tarlalar': 'Golden Fields', 'Arı Bahçesi': 'Bee Garden', 'Elma Bahçesi': 'Apple Orchard',
  'Göl Kıyısı': 'Lakeshore', 'Mantar Ormanı': 'Mushroom Wood', 'Rüzgâr Tepesi': 'Windy Hill', 'Kiraz Vadisi': 'Cherry Valley',
  'Bal Yaylası': 'Honey Highland', 'Çam Korusu': 'Pine Grove', 'Lavanta Tarlası': 'Lavender Field', 'Kayalık Koy': 'Rocky Cove',
  'Nar Bahçesi': 'Pomegranate Grove', 'Kavak Yolu': 'Poplar Lane', 'Papatya Çayırı': 'Daisy Meadow', 'Bambu Ormanı': 'Bamboo Forest',
  'Mercan Kıyısı': 'Coral Coast', 'Sis Vadisi': 'Misty Valley', 'Kekik Yamacı': 'Thyme Slope', 'Söğüt Gölü': 'Willow Lake',
  'Ayçiçeği Ovası': 'Sunflower Plain', 'Kristal Mağara': 'Crystal Cave', 'Buğday Denizi': 'Sea of Wheat', Zeytinlik: 'Olive Grove',
  'Kuğu Gölü': 'Swan Lake', 'Karpuz Bostanı': 'Melon Patch', 'Yıldız Tepesi': 'Star Hill', 'Portakal Bahçesi': 'Orange Grove',
  'Sarmaşık Köprü': 'Ivy Bridge', 'Kaz Göleti': 'Goose Pond', 'Mısır Labirenti': 'Corn Maze', 'Şelale Yolu': 'Waterfall Trail',
  'Çilek Tarlası': 'Strawberry Field', 'Meşe Ormanı': 'Oak Forest', 'Nilüfer Gölü': 'Lily Pond', 'Tavşan Çayırı': 'Rabbit Meadow',
  'Gün Batımı Tepesi': 'Sunset Hill', 'Üzüm Bağı': 'Vineyard', 'Karlı Zirve': 'Snowy Peak', 'Kurbağa Deresi': 'Frog Creek',
  'Kabak Tarlası': 'Pumpkin Patch', 'Gökkuşağı Vadisi': 'Rainbow Valley', 'Fındık Bahçesi': 'Hazelnut Grove',
  'Kelebek Bahçesi': 'Butterfly Garden', 'Balıkçı Köyü': 'Fishing Village', 'Pamuk Tarlası': 'Cotton Field',
  'Ay Işığı Koyu': 'Moonlight Bay', 'Kayısı Yolu': 'Apricot Lane', 'Sedir Ormanı': 'Cedar Forest',
  'Yaban Mersini': 'Blueberry Patch', 'Leylek Yuvası': "Stork's Nest", 'Kum Tepeleri': 'Sand Dunes', 'Limon Bahçesi': 'Lemon Grove',
  'Ördek Göleti': 'Duck Pond', 'Gelincik Tarlası': 'Poppy Field', 'Fener Burnu': 'Lighthouse Point', 'Armut Bahçesi': 'Pear Orchard',
  'Kestane Ormanı': 'Chestnut Forest', 'Kamış Gölü': 'Reed Lake', 'Lale Bahçesi': 'Tulip Garden', 'Altın Vadi': 'Golden Valley',
}));

export const chapterName = (raw) => (getLang() === 'tr' ? raw : CHAPTER_EN.get(raw) ?? raw);
