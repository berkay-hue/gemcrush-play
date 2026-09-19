// Ads abstraction. Native: @capacitor-community/admob (loaded dynamically if present).
// Web / dev: simulated ad overlay so the whole funnel is testable in a browser.
import { CONFIG } from '../config.js';
import { save } from '../meta/save.js';
import { track } from '../analytics.js';

let AdMob = null;
let ready = false;

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
      const { RewardAdPluginEvents } = await import('@capacitor-community/admob');
      earned = await new Promise(async (res) => {
        const h = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { res(true); h.remove(); });
        const d = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => { setTimeout(() => res(false), 300); d.remove(); });
        await AdMob.showRewardVideoAd();
      });
      preload();
    } catch (e) { console.warn(e); earned = await webAd('rewarded'); }
  } else earned = await webAd('rewarded');
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
  await webAd('interstitial');
}

// ---- web fallback: 3s fake ad so you can test the loop in a browser ----
function webAd(kind) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#111;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99;font:20px system-ui';
    let left = kind === 'rewarded' ? 3 : 2;
    el.innerHTML = `<div style="font-size:14px;opacity:.6;margin-bottom:12px">TEST AD (${kind})</div><div id="adc" style="font-size:48px">${left}</div><button id="adx" style="margin-top:24px;padding:10px 24px;display:none">Close</button>`;
    document.body.appendChild(el);
    const iv = setInterval(() => {
      left--; el.querySelector('#adc').textContent = left;
      if (left <= 0) { clearInterval(iv); el.querySelector('#adx').style.display = 'block'; }
    }, 1000);
    el.querySelector('#adx').onclick = () => { el.remove(); resolve(true); };
  });
}
