export const CONFIG = {
  width: 540,
  height: 960,
  gemTypes: 6,
  gemNames: ['elmas', 'yakut', 'zumrut', 'safir', 'altin', 'gumus'],
  gemColors: [0x9ff3ff, 0xff3b5c, 0x2ee06a, 0x3f7bff, 0xffc21a, 0xd9dde6],
  lives: { max: 5, regenMs: 30 * 60 * 1000 },
  coins: { start: 100, winReward: 15, threeStar: 30, perMoveLeft: 3 },
  boosters: { hammer: 150, moves5: 200, shuffle: 80, prism: 250 },
  preBoosters: { bomb: 120, moves5: 200 }, // seviye öncesi (F13)
  ads: {
    interstitialEvery: 3,          // every N level ends (win or lose)
    rewardedExtraMoves: 5,
    rewardedLife: 1,
    rewardedCoins: 50,
    // AdMob gerçek kimlikleri (yayıncı 1914780566231762)
    android: { app: 'ca-app-pub-1914780566231762~1255048904', rewarded: 'ca-app-pub-1914780566231762/8582874582', interstitial: 'ca-app-pub-1914780566231762/5475338828' },
    ios: { app: 'ca-app-pub-1914780566231762~1093151393', rewarded: 'ca-app-pub-1914780566231762/3338286762', interstitial: 'ca-app-pub-1914780566231762/8101502167' },
  },
  iap: {
    products: [
      { id: 'co.saascorner.farmtastic.iap.starter_pack', coins: 1500, gems: 80, lives: 5, priceLabel: '$1.99', was: '$6.99', starter: true },
      { id: 'co.saascorner.farmtastic.iap.gold_500', coins: 500, priceLabel: '$1.99' },
      { id: 'co.saascorner.farmtastic.iap.gold_1500', coins: 1500, priceLabel: '$4.99', badge: 'popular' },
      { id: 'co.saascorner.farmtastic.iap.gold_4000', coins: 4000, priceLabel: '$9.99', badge: 'best' },
      { id: 'co.saascorner.farmtastic.iap.gems_60', gems: 60, coins: 0, priceLabel: '$0.99' },
      { id: 'co.saascorner.farmtastic.iap.gems_300', gems: 300, coins: 0, priceLabel: '$3.99', badge: 'best' },
      { id: 'co.saascorner.farmtastic.iap.remove_ads', coins: 300, priceLabel: '$2.99', removeAds: true },
    ],
  },
  privacyUrl: 'https://berkay-hue.github.io/gemcrush-privacy/',
  cloud: { url: 'https://mzecvuabehfajktynept.supabase.co', key: 'sb_publishable_UKCXr-kSFrUniEOQMOjahQ_KBkT5jwh' }, // hesap + bulut kayıt (gc_* RPC)
  supabase: { url: '', anonKey: '' }, // fill to enable cloud save + analytics
  dailyRewards: [25, 40, 60, 80, 100, 150, 300],
};
