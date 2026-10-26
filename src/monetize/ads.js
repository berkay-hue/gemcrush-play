// Ads abstraction. Native: @capacitor-community/admob (loaded dynamically if present).
// Local dev (localhost): simulated ad overlay so the whole funnel is testable in a browser.
// F354: yayındaki web sayfasında gerçek reklam yok — sahte reklam ödül (altın/can/hamle) vermez.
import { CONFIG } from '../config.js';
import { t } from '../i18n.js';
import { save } from '../meta/save.js';
import { track } from '../analytics.js';
import { shield } from '../ui/widgets.js';

let AdMob = null;
let ready = false;
const local = () => typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

export async function initAds() {
  try {
    const cap = window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
      // Bundler-free: the native bridge registers the plugin on Capacitor.Plugins.
      AdMob = cap.Plugins?.AdMob || cap.registerPlugin?.('AdMob');
      if (!AdMob) throw new Error('AdMob plugin not registered');
      await AdMob.initialize({ requestTrackingAuthorization: true });
      ready = true;
      preload();
    }
  } catch (e) { console.warn('AdMob not available, using web fallback', e); }
}

function ids() {
  const p = window.Capacitor?.getPlatform?.() === 'ios' ? CONFIG.ads.ios : CONFIG.ads.android;
  return p;
}
async function preload() {
  if (!AdMob) return;
  try { await AdMob.prepareRewardVideoAd({ adId: ids().rewarded }); } catch {}
  try { await AdMob.prepareInterstitial({ adId: ids().interstitial }); } catch {}
}

// Resolves true if the user earned the reward.
export async function showRewarded(placement) {
  track('ad_request', { kind: 'rewarded', placement });
  let earned = false;
  if (AdMob && ready) {
    try {
      // F354: paketleyicisiz derlemede '@capacitor-community/admob' içe aktarılamıyor — olay adları (RewardAdPluginEvents) sabit
      earned = await new Promise(async (res) => {
        const h = await AdMob.addListener('onRewardedVideoAdReward', () => { res(true); h.remove(); });
        const d = await AdMob.addListener('onRewardedVideoAdDismissed', () => { setTimeout(() => res(false), 300); d.remove(); });
        try { await AdMob.showRewardVideoAd(); } catch (e) { console.warn(e); h.remove(); d.remove(); res(false); }
      });
      preload();
    } catch (e) { console.warn(e); earned = false; } // F354: reklam gösterilemediyse ödül yok
  } else earned = local() ? await webAd('rewarded') : await noAd();
  track(earned ? 'ad_watched' : 'ad_skipped', { kind: 'rewarded', placement });
  return earned;
}

let sinceInterstitial = 0;
export async function maybeInterstitial(placement) {
  if (save.removeAds) return;
  sinceInterstitial++;
  if (sinceInterstitial < CONFIG.ads.interstitialEvery) return;
  sinceInterstitial = 0;
  track('ad_request', { kind: 'interstitial', placement });
  if (AdMob && ready) {
    try { await AdMob.showInterstitial(); preload(); return; } catch {}
  }
  // web'de gerçek reklam yok: sahte geçiş reklamı oyunu donmuş gibi gösteriyordu
}

// F354: yayındaki web — reklam yok, ödül de yok; oyuncuya nedenini söyle
function noAd() {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99;font:20px system-ui;padding:24px;text-align:center';
    el.innerHTML = `<div id="adm" style="max-width:360px"></div><button id="adx" style="margin-top:24px;padding:10px 24px">OK</button>`;
    el.querySelector('#adm').textContent = t('adApp');
    document.body.appendChild(shield(el));
    el.querySelector('#adx').onclick = () => { el.remove(); resolve(false); };
  });
}

// ---- local dev: 3s fake ad so you can test the loop in a browser ----
function webAd(kind) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#111;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99;font:20px system-ui';
    let left = kind === 'rewarded' ? 3 : 2;
    el.innerHTML = `<div style="font-size:14px;opacity:.6;margin-bottom:12px">TEST AD (${kind})</div><div id="adc" style="font-size:48px">${left}</div><button id="adx" style="margin-top:24px;padding:10px 24px;display:none">Close</button>`;
    document.body.appendChild(shield(el));
    const iv = setInterval(() => {
      left--; el.querySelector('#adc').textContent = left;
      if (left <= 0) { clearInterval(iv); el.querySelector('#adx').style.display = 'block'; }
    }, 1000);
    el.querySelector('#adx').onclick = () => { el.remove(); resolve(true); };
  });
}
