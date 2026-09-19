// F9: arkadaşlar paneli — kendi kodun + kopyala, kodla ekle, liste (ziyaret / çıkar). Hesap gerekir.
// F11: ❤ can gönder / 🙏 can iste (arkadaş başına günde 1), 📬 gelen kutusu, 🎁 günlük kutu, 🏆 haftalık arkadaş sıralaması
import { t } from '../i18n.js';
import { account, myFriendCode, friendList, friendAdd, friendRemove, giftSend, inbox, claimInbox, friendLb, giftBoxReady, openGiftBox } from '../meta/save.js';
import { track } from '../analytics.js';
import { authForm } from './authForm.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ERR = { bulunamadi: 'frNotFound', kendin: 'frSelf', limit: 'frLimit' };

export function friendsPanel(onVisit, onAuth, onChange) {
  if (!account()) {
    authForm((ok) => { if (ok && onAuth) onAuth(); });
    return;
  }
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.66);display:flex;align-items:center;justify-content:center;font-family:"Baloo 2",system-ui,-apple-system,sans-serif;padding:16px';
  const btn = 'border:0;border-radius:12px;font-family:inherit;font-weight:800;cursor:pointer';
  wrap.innerHTML = `
  <div style="width:100%;max-width:360px;max-height:88vh;display:flex;flex-direction:column;background:linear-gradient(#24463b,#0c1a15);border:3px solid #ffb71b;border-radius:24px;padding:20px;box-sizing:border-box;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.6);animation:gcpop .28s cubic-bezier(.34,1.56,.64,1)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:24px;font-weight:800;color:#ffb71b">👥 ${t('friends')}</div>
      <button data-x style="${btn};background:transparent;color:#fff;font-size:22px;padding:4px 8px">✕</button>
    </div>
    <div style="font-size:13px;color:#9fb3a8">${t('frMyCode')}</div>
    <div style="display:flex;gap:8px;align-items:center;margin:4px 0 14px">
      <div class="code" style="flex:1;font-size:24px;font-weight:800;letter-spacing:3px;background:rgba(255,255,255,.08);border-radius:12px;padding:6px 12px;color:#ffe58a">…</div>
      <button data-copy style="${btn};background:#2a333a;color:#fff;font-size:15px;padding:10px 12px">📋 ${t('frCopy')}</button>
    </div>
    <form style="display:flex;gap:8px;margin-bottom:4px">
      <input name="c" autocapitalize="characters" autocomplete="off" maxlength="20" placeholder="${t('frAddHint')}" style="flex:1;min-width:0;box-sizing:border-box;font-size:17px;padding:10px 12px;border-radius:12px;border:2px solid #35574a;background:#f5f4eb;font-family:inherit">
      <button style="${btn};background:linear-gradient(#6ff29a,#2ee06a);color:#04220e;font-size:16px;padding:10px 14px">+ ${t('frAdd')}</button>
    </form>
    <div class="msg" style="min-height:20px;font-size:14px;margin:4px 2px 6px;color:#ff8a80"></div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <button data-box style="${btn};flex:1;font-size:15px;padding:10px 6px"></button>
      <button data-tab="lb" style="${btn};flex:1;background:#2a333a;color:#fff;font-size:15px;padding:10px 6px">🏆 ${t('frWeekly')}</button>
    </div>
    <div class="inbox" style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px"></div>
    <div class="list" style="overflow:auto;flex:1;display:flex;flex-direction:column;gap:8px"></div>
  </div>`;
  if (!document.getElementById('gcpop')) { const st = document.createElement('style'); st.id = 'gcpop'; st.textContent = '@keyframes gcpop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}'; document.head.appendChild(st); }
  document.body.appendChild(wrap);
  const $ = (q) => wrap.querySelector(q);
  const msg = (s, ok) => { $('.msg').textContent = s || ''; $('.msg').style.color = ok ? '#8ff0b0' : '#ff8a80'; };
  const close = () => wrap.remove();
  $('[data-x]').addEventListener('click', close);
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });

  let code = '';
  myFriendCode().then((r) => { code = (r && r.code) || ''; $('.code').textContent = code || '—'; }).catch(() => { $('.code').textContent = '—'; msg(t('rkOffline')); });
  $('[data-copy]').addEventListener('click', async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); msg(t('copied'), true); } catch { msg(code, true); }
  });

  const changed = () => { if (onChange) onChange(); };
  const drawBox = () => {
    const b = $('[data-box]'), ok = giftBoxReady();
    b.textContent = ok ? `🎁 ${t('frBox')}` : `🎁 ${t('frBoxTomorrow')}`;
    b.style.background = ok ? 'linear-gradient(#ff9ad5,#e0569f)' : '#2a333a';
    b.style.color = ok ? '#2a0016' : '#889';
  };
  $('[data-box]').addEventListener('click', () => {
    const r = openGiftBox();
    if (!r) return;
    track('gift_box', r);
    msg(`🎁 ${r.gems ? `+💎${r.gems}` : r.life ? `+❤${r.life}` : `+🪙${r.coins}`}`, true);
    drawBox(); changed();
  });
  drawBox();
  let sent = [], tab = 'fr';
  const didSend = (code, kind) => sent.some((x) => x.code === code && x.kind === kind);
  const drawInbox = async () => {
    const box = $('.inbox');
    let r;
    try { r = await inbox(); } catch { box.innerHTML = ''; return; }
    if (!wrap.isConnected) return;
    sent = r.sent || [];
    const items = r.inbox || [];
    const gifts = items.filter((x) => x.kind !== 'req'), reqs = items.filter((x) => x.kind === 'req');
    const nl = gifts.filter((x) => x.kind === 'life').length, nh = gifts.length - nl;
    let h = '';
    if (gifts.length) h += `<div style="display:flex;align-items:center;gap:8px;background:#3a2f12;border:2px solid #ffb71b;border-radius:12px;padding:8px 10px">
      <div style="flex:1;font-size:15px;font-weight:700">📬 ${nl ? `❤×${nl} ` : ''}${nh ? `🤝×${nh}` : ''} <span style="font-size:12px;color:#ffe7a3">${esc(gifts.slice(0, 3).map((x) => x.name).join(', '))}</span></div>
      <button data-claim style="${btn};background:linear-gradient(#6ff29a,#2ee06a);color:#04220e;font-size:15px;padding:8px 12px">${t('frCollect')}</button></div>`;
    h += reqs.map((x) => `<div style="display:flex;align-items:center;gap:8px;background:#2a2238;border-radius:12px;padding:6px 10px">
      <div style="flex:1;font-size:14px">${esc(x.avatar)} <b>${esc(x.name)}</b> ${t('frAsksLife')}</div>
      <button data-give="${esc(x.code)}" style="${btn};background:linear-gradient(#ff8a9a,#e8475f);color:#fff;font-size:14px;padding:7px 10px">❤ ${t('frSend')}</button></div>`).join('');
    box.innerHTML = h;
    const cl = box.querySelector('[data-claim]');
    if (cl) cl.addEventListener('click', async () => {
      try { const g = await claimInbox(); track('inbox_claim', g); msg(`${g.life ? `+❤${g.life} ` : ''}${g.coins ? `+🪙${g.coins}` : ''}`, true); changed(); drawInbox(); } catch { msg(t('rkOffline')); }
    });
    box.querySelectorAll('[data-give]').forEach((b) => b.addEventListener('click', () => gift(b.dataset.give, 'life')));
    if (tab === 'fr') draw(true);
  };
  const gift = async (code, kind) => {
    try { await giftSend(code, kind); track('gift_send', { kind }); msg(kind === 'life' ? t('frLifeSent') : t('frReqSent'), true); }
    catch (er) { msg(String(er.message).includes('bugun') ? t('frToday') : t('rkOffline')); }
    drawInbox();
  };
  const drawLb = async () => {
    const box = $('.list');
    box.innerHTML = `<div style="text-align:center;color:#9fb3a8;padding:12px">…</div>`;
    let r;
    try { r = await friendLb(); } catch { box.innerHTML = `<div style="text-align:center;color:#ff8a80;padding:12px">${t('rkOffline')}</div>`; return; }
    if (!wrap.isConnected || tab !== 'lb') return;
    const left = Math.max(0, (r.ends || 0) - Date.now()), dd = Math.floor(left / 86400000), hh = Math.floor(left / 3600000) % 24;
    box.innerHTML = `<div style="text-align:center;font-size:13px;color:#9fb3a8">⭐ ${t('frWeekHint')} · ⏳ ${dd}${t('dayShort')} ${hh}${t('hourShort')}</div>` + (r.list || []).map((f, i) => `
      <div style="display:flex;align-items:center;gap:8px;background:${f.me ? '#3a3212' : i % 2 ? '#1b2420' : '#222d28'};border-radius:12px;padding:8px 10px">
        <div style="width:28px;text-align:center;font-weight:800;font-size:18px;color:#ffb71b">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>
        <div style="font-size:24px">${esc(f.avatar)}</div>
        <div style="flex:1;min-width:0;font-weight:800;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}${f.champ ? ` <span title="${t('frChamp')}">👑</span>` : ''}${f.me ? ` <span style="font-size:12px;color:#ffe7a3">(${t('you')})</span>` : ''}</div>
        <div style="font-weight:800;font-size:17px;color:#ffe58a">⭐${esc(f.val)}</div>
      </div>`).join('') + ((r.list || []).some((f) => f.champ) ? `<div style="text-align:center;font-size:12px;color:#9fb3a8">👑 ${t('frChamp')}</div>` : '');
  };
  $('[data-tab]').addEventListener('click', (e) => {
    tab = tab === 'fr' ? 'lb' : 'fr';
    e.currentTarget.textContent = tab === 'lb' ? `👥 ${t('friends')}` : `🏆 ${t('frWeekly')}`;
    tab === 'lb' ? drawLb() : draw();
  });

  const draw = async (quiet) => {
    const box = $('.list');
    if (!quiet || !draw.list) box.innerHTML = `<div style="text-align:center;color:#9fb3a8;padding:12px">…</div>`;
    let list;
    try { list = (quiet && draw.list) || (draw.list = await friendList()); } catch { box.innerHTML = `<div style="text-align:center;color:#ff8a80;padding:12px">${t('rkOffline')}</div>`; return; }
    if (!wrap.isConnected || tab !== 'fr') return;
    if (!list || !list.length) { box.innerHTML = `<div style="text-align:center;color:#cfe3d8;padding:14px;font-size:15px">${t('frEmpty')}</div>`; return; }
    box.innerHTML = list.map((f, i) => `
      <div style="display:flex;align-items:center;gap:8px;background:${i % 2 ? '#1b2420' : '#222d28'};border-radius:12px;padding:8px 10px">
        <div style="font-size:26px">${esc(f.avatar || '🧑‍🌾')}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:800;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div>
          <div style="font-size:12px;color:#9fb3a8">${t('level')} ${esc(f.level)} · ${esc(f.code)}</div></div>
        <button data-l="${esc(f.code)}" title="${t('frSendLife')}" ${didSend(f.code, 'life') ? 'disabled' : ''} style="${btn};background:${didSend(f.code, 'life') ? '#2a333a' : 'linear-gradient(#ff8a9a,#e8475f)'};color:#fff;font-size:15px;padding:8px 8px">${didSend(f.code, 'life') ? '✓' : '❤'}</button>
        <button data-q="${esc(f.code)}" title="${t('frAskLife')}" ${didSend(f.code, 'req') ? 'disabled' : ''} style="${btn};background:#2a333a;color:${didSend(f.code, 'req') ? '#667' : '#fff'};font-size:15px;padding:8px 8px">🙏</button>
        <button data-v="${esc(f.code)}" style="${btn};background:linear-gradient(#ffd46b,#ffb71b);color:#1a1200;font-size:14px;padding:8px 10px">🏡</button>
        <button data-r="${esc(f.code)}" data-n="${esc(f.name)}" style="${btn};background:#2a333a;color:#ff8a80;font-size:14px;padding:8px 9px">✕</button>
      </div>`).join('');
    box.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => gift(b.dataset.l, 'life')));
    box.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => gift(b.dataset.q, 'req')));
    box.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { close(); onVisit(b.dataset.v); }));
    box.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(`${b.dataset.n} — ${t('frRemoveQ')}`)) return;
      try { await friendRemove(b.dataset.r); draw.list = null; draw(); } catch { msg(t('rkOffline')); }
    }));
  };
  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = e.target.c.value.trim();
    if (!v) return;
    msg('…', true);
    try { await friendAdd(v); e.target.c.value = ''; msg(t('frAdded'), true); draw.list = null; draw(); }
    catch (er) { const k = Object.keys(ERR).find((x) => String(er.message).includes(x)); msg(t(k ? ERR[k] : 'rkOffline')); }
  });
  draw(); drawInbox();
}
