export const CONFIG = {
  width: 540,
  height: 960,
  gemTypes: 6,
  gemNames: ['elmas', 'yakut', 'zumrut', 'safir', 'altin', 'gumus'],
  gemColors: [0x9ff3ff, 0xff3b5c, 0x2ee06a, 0x3f7bff, 0xffc21a, 0xd9dde6],
  lives: { max: 5, regenMs: 30 * 60 * 1000 },
  coins: { start: 100, winReward: 15, threeStar: 30 },
  boosters: { hammer: 150, moves5: 200, shuffle: 80, prism: 250 },
  ads: {
    interstitialEvery: 3,          // every N level ends (win or lose)
    rewardedExtraMoves: 5,
    rewardedLife: 1,
    rewardedCoins: 50,
    // AdMob ids: replace with yours (these are Google's TEST ids)
    android: { app: 'ca-app-pub-3940256099942544~3347511713', rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' },
    ios: { app: 'ca-app-pub-3940256099942544~1458002511', rewarded: 'ca-app-pub-3940256099942544/1712485313', interstitial: 'ca-app-pub-3940256099942544/4411468910' },
  },
  iap: {
    products: [
      { id: 'coins_500', coins: 500, priceLabel: '$1.99' },
      { id: 'coins_1500', coins: 1500, priceLabel: '$4.99', badge: 'popular' },
      { id: 'coins_4000', coins: 4000, priceLabel: '$9.99', badge: 'best' },
      { id: 'gems_60', gems: 60, coins: 0, priceLabel: '$0.99' },
      { id: 'gems_300', gems: 300, coins: 0, priceLabel: '$3.99', badge: 'best' },
      { id: 'remove_ads', coins: 300, priceLabel: '$2.99', removeAds: true },
    ],
  },
  privacyUrl: 'https://berkay-hue.github.io/gemcrush-privacy/',
  supabase: { url: '', anonKey: '' }, // fill to enable cloud save + analytics
  dailyRewards: [25, 40, 60, 80, 100, 150, 300],
};
