const DICT = {
  tr: {
    play: 'OYNA', chapter: 'Bölüm', hard: 'ZOR', hardLevel: 'ZOR SEVİYE', level: 'Seviye', moves: 'Hamle', score: 'Puan', goal: 'Hedef',
    win: 'Seviye Tamamlandı!', lose: 'Hamle Bitti', retry: 'Tekrar', next: 'Sonraki', map: 'Harita', farm: 'Çiftliğim', farmOwned: 'Senin! 🎉', farmNeeds: 'Önce gerekli', farmHave: 'sende', farmBuy: 'Satın al', collect: 'Topla', market: 'Pazar', nestEmpty: 'Kuluçka için yumurta topla.', nestReady: 'Civciv çıkmak üzere!', nestWins: 'bölüm kazan', hatch: 'Çıkar', incubate: 'Kuluçkaya koy', rush: 'Hızlandır', book: 'Koleksiyon', seasonOnly: 'Yalnız bu mevsim satışta!', questClaim: 'Al', questAll: 'Tüm görevler bitti! 🎉', questNext: 'Görev', plant: 'Ek', planted: 'ekildi', minShort: 'dk', cropTip: 'Her kazandığın bölüm ekinleri 5 dk hızlandırır!', cropFaster: 'Ekinler hızlandı',
    farmEarn: 'Yeterli yıldız yok. Seviye geç, yıldız kazan!',
    extraMoves: '+5 Hamle', watchAd: 'Reklam izle', buy: 'Satın al', coins: 'altın',
    noLives: 'Canın kalmadı', nextLife: 'Sonraki can', lifeAd: 'Reklam izle, 1 can kazan',
    ranks: 'Sıralama', rkLevel: 'Bölüm', rkStars: 'Yıldız', rkSpent: 'Harcanan', rkWeek: 'Hafta', rkHint: 'Tüm zamanların en iyileri', rkSpentHint: 'Çiftliğe en çok yıldız harcayanlar', rkWeekHint: 'Bu hafta kazanılan yıldız (pazartesi sıfırlanır)', rkOffline: 'Bağlantı yok, sonra dene', rkEmpty: 'Henüz kimse yok — ilk sen ol!', rkYou: 'Senin sıran', rkNotYet: 'Listeye girmek için oynamaya devam et', rkGuest: 'Sıralamaya girmek için hesap aç — ilerlemen de bulutta saklanır.', shop: 'Mağaza', land: 'Arazi', landHint: 'Genişlet, daha çok yer aç', expand: 'Genişlet', upgrade: 'Yükselt', needCoins: 'Yeterli altın yok', themes: 'Temalar', themeHint: 'Oyun ve harita görünümünü değiştir', owned: 'Sende', use: 'Kullan', needGems: 'Yeterli elmas yok', sellTab: 'Sat', tradeTab: 'Takas', tradeHint: 'Buğday, mısır ve ürünleri güçlendiriciye çevir', tradeNeed: 'Malzeme yetmiyor', ambarFull: 'Ambar dolu! Sat ya da yükselt', edit: 'Düzenle', editHint: 'Taşımak için bir yapıya dokun', done: 'Bitti', placeHint: 'Yerleştirmek için zemine dokun', place: 'Yerleştir', placeBad: 'Buraya sığmıyor', free: 'Bedava', removeAds: 'Reklamları kaldır', restore: 'Satın alımları geri yükle',
    daily: 'Günlük Ödül', claim: 'AL', day: 'Gün', streak: 'seri',
    hammer: 'Çekiç', moves5: '+5 Hamle', shuffle: 'Karıştır', prism: 'Prizma ile başla',
    objScore: 'puan topla', objCollect: 'topla', objJelly: 'jöleyi temizle', objRock: 'kayayı kır', objLock: 'zinciri kır',
    splashTag: 'Taşları eşle, çiftliğini büyüt', account: 'Hesap', accountHint: 'Giriş yap, ilerlemen her cihazda kalsın.', username: 'Kullanıcı adı', password: 'Şifre (en az 6)', login: 'Giriş yap', register: 'Yeni hesap aç', cancel: 'Vazgeç', guest: 'Hesapsız devam et', quitQ: 'Bölümden çıkılsın mı?', quitWarn: 'Çıkarsan 1 ❤ kaybedersin', quitYes: 'Çık (−1 ❤)', keepPlaying: 'Oynamaya devam', movesBonus: 'Kalan hamle', lifeSafe: 'Kazanırsan can gitmez ❤', logout: 'Çıkış yap', loggedAs: 'Giriş yapıldı:', saveCloud: 'Kaydet / Giriş yap', welcomeBack: 'Hoş geldin!', authErr_kullanici_adi: 'Kullanıcı adı 3-20 harf/rakam/_ olmalı', authErr_sifre_kisa: 'Şifre en az 6 karakter', authErr_alinmis: 'Bu kullanıcı adı alınmış', authErr_hatali: 'Kullanıcı adı veya şifre yanlış', authErr_ag: 'Bağlantı hatası, tekrar dene',
    tapToContinue: 'Devam etmek için dokun', settings: 'Ayarlar', profile: 'Profil', tapAvatar: 'Değiştirmek için avatara dokun', setName: 'Adını yaz', codeHint: 'Kayıt kodu ile ilerlemeni başka cihaza taşıyabilirsin.', copyCode: 'Kayıt kodunu kopyala', loadCode: 'Kodla ilerleme yükle', copied: 'Kopyalandı!', badCode: 'Geçersiz kod', wipe: 'Hesabımı ve verilerimi sil', wipeConfirm: 'Tüm ilerlemen kalıcı olarak silinecek. Emin misin?', privacy: 'Gizlilik politikası', sound: 'Ses', lang: 'Dil',
    stars: 'yıldız', bonus: 'Kalan hamle bonusu', combo: 'KOMBO!', chain: 'Zincir', great: 'Harika!', amazing: 'Muhteşem!', legendary: 'Efsane!',
    tut1: 'Yan yana 3 mücevheri eşle', tut2: '4\'lü = Işın, L/T = Bomba, 5\'li = Prizma', tut3: 'İki özeli takas et: KOMBO',
    outOfMoves: 'Hamle kalmadı. Devam et?', continueFor: 'Devam et', notEnoughCoins: 'Yeterli altın yok',
    lives: 'Can', full: 'DOLU', farmStars: 'çiftlik yıldızı',
  },
  en: {
    play: 'PLAY', chapter: 'Chapter', hard: 'HARD', hardLevel: 'HARD LEVEL', level: 'Level', moves: 'Moves', score: 'Score', goal: 'Goal',
    win: 'Level Complete!', lose: 'Out of Moves', retry: 'Retry', next: 'Next', map: 'Map', farm: 'My Farm', farmOwned: 'Yours! 🎉', farmNeeds: 'Requires', farmHave: 'you have', farmBuy: 'Buy', collect: 'Collect', market: 'Market', nestEmpty: 'Collect an egg to incubate.', nestReady: 'A chick is about to hatch!', nestWins: 'levels won', hatch: 'Hatch', incubate: 'Incubate', rush: 'Rush', book: 'Collection', seasonOnly: 'On sale this season only!', questClaim: 'Claim', questAll: 'All quests done! 🎉', questNext: 'Quest', plant: 'Plant', planted: 'planted', minShort: 'min', cropTip: 'Every level you win makes crops grow 5 min faster!', cropFaster: 'Crops sped up',
    farmEarn: 'Not enough stars. Beat levels to earn more!',
    extraMoves: '+5 Moves', watchAd: 'Watch ad', buy: 'Buy', coins: 'coins',
    noLives: 'No lives left', nextLife: 'Next life in', lifeAd: 'Watch ad, get 1 life',
    ranks: 'Leaderboard', rkLevel: 'Level', rkStars: 'Stars', rkSpent: 'Spent', rkWeek: 'Week', rkHint: 'All-time best', rkSpentHint: 'Most stars spent on the farm', rkWeekHint: 'Stars earned this week (resets Monday)', rkOffline: 'No connection, try later', rkEmpty: 'Nobody yet — be the first!', rkYou: 'Your rank', rkNotYet: 'Keep playing to enter the list', rkGuest: 'Create an account to join the leaderboard — your progress is saved in the cloud too.', shop: 'Shop', land: 'Land', landHint: 'Expand to get more room', expand: 'Expand', upgrade: 'Upgrade', needCoins: 'Not enough coins', themes: 'Themes', themeHint: 'Change the look of the game and map', owned: 'Owned', use: 'Use', needGems: 'Not enough gems', sellTab: 'Sell', tradeTab: 'Trade', tradeHint: 'Turn wheat, corn and goods into boosters', tradeNeed: 'Not enough goods', ambarFull: 'Barn full! Sell or upgrade', edit: 'Edit', editHint: 'Tap a building to move it', done: 'Done', placeHint: 'Tap the ground to place', place: 'Place', placeBad: 'Does not fit here', free: 'Free', removeAds: 'Remove ads', restore: 'Restore purchases',
    daily: 'Daily Reward', claim: 'CLAIM', day: 'Day', streak: 'streak',
    hammer: 'Hammer', moves5: '+5 Moves', shuffle: 'Shuffle', prism: 'Start with Prism',
    objScore: 'score', objCollect: 'collect', objJelly: 'clear jelly', objRock: 'break rocks', objLock: 'break chains',
    splashTag: 'Match gems, grow your farm', account: 'Account', accountHint: 'Sign in to keep your progress on every device.', username: 'Username', password: 'Password (min 6)', login: 'Sign in', register: 'Create account', cancel: 'Cancel', guest: 'Continue without account', quitQ: 'Quit the level?', quitWarn: 'Quitting costs 1 ❤', quitYes: 'Quit (−1 ❤)', keepPlaying: 'Keep playing', movesBonus: 'Moves left', lifeSafe: 'Win and keep your ❤', logout: 'Sign out', loggedAs: 'Signed in:', saveCloud: 'Save / Sign in', welcomeBack: 'Welcome back!', authErr_kullanici_adi: 'Username: 3-20 letters/digits/_', authErr_sifre_kisa: 'Password needs 6+ characters', authErr_alinmis: 'Username is taken', authErr_hatali: 'Wrong username or password', authErr_ag: 'Connection error, try again',
    tapToContinue: 'Tap to continue', settings: 'Settings', profile: 'Profile', tapAvatar: 'Tap the avatar to change it', setName: 'Enter your name', codeHint: 'Use your save code to move progress to another device.', copyCode: 'Copy save code', loadCode: 'Load progress from code', copied: 'Copied!', badCode: 'Invalid code', wipe: 'Delete my account & data', wipeConfirm: 'All progress will be permanently deleted. Are you sure?', privacy: 'Privacy policy', sound: 'Sound', lang: 'Language',
    stars: 'stars', bonus: 'Leftover moves bonus', combo: 'COMBO!', chain: 'Chain', great: 'Great!', amazing: 'Amazing!', legendary: 'Legendary!',
    tut1: 'Match 3 gems in a row', tut2: '4 = Beam, L/T = Bomb, 5 = Prism', tut3: 'Swap two specials: COMBO',
    outOfMoves: 'Out of moves. Continue?', continueFor: 'Continue for', notEnoughCoins: 'Not enough coins',
    lives: 'Lives', full: 'FULL', farmStars: 'farm stars',
  },
};
let lang = 'en';
export function setLang(l) { lang = DICT[l] ? l : 'en'; }
export function getLang() { return lang; }
export function detectLang() {
  const n = (navigator.language || 'en').toLowerCase();
  return n.startsWith('tr') ? 'tr' : 'en';
}
export const t = (k) => DICT[lang][k] ?? DICT.en[k] ?? k;
