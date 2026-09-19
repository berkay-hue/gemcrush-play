// F12: görevler paneli — Günlük / Haftalık (+ sandık), Başarımlar, Albüm.
import { t, getLang } from '../i18n.js';
import { dailyTasks, weeklyTasks, claimTask, chestReady, openChest, CHEST, achList, claimAch, SETS, CARDS, hasCard, setState, claimSet, weekIdx } from '../meta/tasks.js';
import { track } from '../analytics.js';
import { shield } from './widgets.js';

const nm = (o) => (getLang() === 'tr' ? o.tr : o.en);
const fmtLeft = (ms) => { const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h >= 24 ? `${Math.floor(h / 24)}${t('dShort')} ${h % 24}${t('hShort')}` : `${h}${t('hShort')} ${m}${t('mShort')}`; };

export function tasksPanel(onChange, tab0 = 'd') {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.66);display:flex;align-items:center;justify-content:center;font-family:"Baloo 2",system-ui,-apple-system,sans-serif;padding:16px';
  const btn = 'border:0;border-radius:12px;font-family:inherit;font-weight:800;cursor:pointer';
  const TABS = [['d', '📅', 'tkDaily'], ['w', '🗓️', 'tkWeekly'], ['a', '🏅', 'tkAch'], ['c', '📒', 'tkAlbum']];
  wrap.innerHTML = `
  <div style="width:100%;max-width:380px;height:min(640px,88vh);display:flex;flex-direction:column;background:linear-gradient(#24463b,#0c1a15);border:3px solid #ffb71b;border-radius:24px;padding:18px;box-sizing:border-box;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.6);animation:gcpop .28s cubic-bezier(.34,1.56,.64,1)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:24px;font-weight:800;color:#ffb71b">📜 ${t('tasks')}</div>
      <button data-x style="${btn};background:transparent;color:#fff;font-size:22px;padding:4px 8px">✕</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px">${TABS.map(([k, i, l]) => `<button data-tab="${k}" style="${btn};flex:1;font-size:13px;padding:8px 2px;position:relative">${i}<br>${t(l)}<span data-dot="${k}" style="display:none;position:absolute;top:-4px;right:-4px;width:12px;height:12px;border-radius:6px;background:#ff4d5e;border:2px solid #fff"></span></button>`).join('')}</div>
    <div class="msg" style="min-height:20px;font-size:14px;margin:0 2px 6px;color:#8ff0b0"></div>
    <div class="body" style="overflow:auto;flex:1;display:flex;flex-direction:column;gap:8px"></div>
  </div>`;
  if (!document.getElementById('gcpop')) { const st = document.createElement('style'); st.id = 'gcpop'; st.textContent = '@keyframes gcpop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}'; document.head.appendChild(st); }
  document.body.appendChild(shield(wrap));
  const $ = (q) => wrap.querySelector(q);
  const msg = (s) => { $('.msg').textContent = s || ''; };
  const close = () => { wrap.remove(); clearInterval(tick); };
  $('[data-x]').addEventListener('click', close);
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
  let tab = tab0;
  const changed = () => { if (onChange) onChange(); };
  const bar = (p, n) => `<div style="height:8px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:4px"><div style="height:100%;width:${Math.round(100 * p / n)}%;background:linear-gradient(90deg,#6ff29a,#2ee06a)"></div></div>`;
  const card = (inner) => `<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.07);border-radius:14px;padding:10px 12px">${inner}</div>`;
  const claimBtn = (attr, label, on) => `<button ${attr} ${on ? '' : 'disabled'} style="${btn};font-size:14px;padding:8px 10px;white-space:nowrap;${on ? 'background:linear-gradient(#ffd45a,#ffb71b);color:#1a1200' : 'background:#2a333a;color:#7d8f86;cursor:default'}">${label}</button>`;
  const qLabel = (q) => t('tq_' + q.stat).replace('{n}', q.n);

  function dots() {
    const dr = dailyTasks(), wr = weeklyTasks();
    const any = { d: dr.some((r) => r.done && !r.claimed) || chestReady('d'), w: wr.some((r) => r.done && !r.claimed) || chestReady('w'),
      a: achList().some((a) => a.ready), c: SETS.some((s) => { const x = setState(s.id); return x.complete && !x.claimed; }) };
    wrap.querySelectorAll('[data-dot]').forEach((d) => { d.style.display = any[d.dataset.dot] ? 'block' : 'none'; });
  }
  function drawTasks(kind) {
    const list = kind === 'd' ? dailyTasks() : weeklyTasks();
    const now = Date.now(), end = kind === 'd' ? (Math.floor(now / 86400000) + 1) * 86400000 : ((weekIdx(now) + 1) * 7 - 3) * 86400000;
    const all = list.every((r) => r.claimed), ready = chestReady(kind), opened = all && !ready, c = CHEST[kind];
    let h = `<div style="font-size:13px;color:#9fb3a8">⏳ ${t('tkResets')} <b data-left>${fmtLeft(end - now)}</b></div>`;
    h += list.map((q) => card(`<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:700">${qLabel(q)}</div><div style="font-size:12px;color:#9fb3a8">${q.p}/${q.n} · 🪙 ${q.coins}</div>${bar(q.p, q.n)}</div>${q.claimed ? '<div style="font-size:22px">✅</div>' : claimBtn(`data-claim="${q.id}"`, t('claim'), q.done)}`)).join('');
    h += `<div style="text-align:center;margin-top:6px;background:rgba(255,183,27,.12);border:2px dashed ${ready ? '#ffb71b' : '#35574a'};border-radius:16px;padding:12px">
      <div style="font-size:44px;${ready ? 'animation:gcpop .6s infinite alternate' : ''}">${opened ? '📭' : kind === 'd' ? '🧰' : '👑'}</div>
      <div style="font-size:13px;color:#cfe0d6;margin:4px 0 8px">${t('tkChestHint')} · 🪙${c.coins} 💎${c.gems} 🃏×${c.cards}</div>
      ${opened ? `<div style="font-size:14px;color:#8ff0b0">${t('tkChestOpened')}</div>` : claimBtn('data-chest', `🎁 ${t('tkOpen')}`, ready)}</div>`;
    $('.body').innerHTML = h;
    wrap.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => {
      const n = claimTask(kind, b.dataset.claim); if (n) { track('task_claim', { kind, id: b.dataset.claim, coins: n }); msg(`+${n} 🪙`); changed(); draw(); }
    }));
    const cb = $('[data-chest]'); if (cb) cb.addEventListener('click', () => {
      const r = openChest(kind); if (!r) return;
      track('chest_open', { kind, cards: r.cards.map((x) => x.id) });
      msg(`+${r.coins} 🪙  +${r.gems} 💎  ${r.cards.map((x) => x.icon + (x.dup ? '♻️' : '🆕')).join(' ')}`); changed(); draw();
    });
  }
  function drawAch() {
    $('.body').innerHTML = achList().map((a) => card(`<div style="font-size:30px">${a.icon}</div><div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:700">${t('ach_' + a.id)} ${'★'.repeat(a.tier)}${'☆'.repeat(a.tiers.length - a.tier)}</div>
      <div style="font-size:12px;color:#9fb3a8">${a.max ? t('tkMax') : `${a.v}/${a.goal} · 💎 ${a.gem}`}</div>${a.max ? '' : bar(a.v, a.goal)}</div>${a.max ? '<div style="font-size:22px">🏆</div>' : claimBtn(`data-ach="${a.id}"`, t('claim'), a.ready)}`)).join('');
    wrap.querySelectorAll('[data-ach]').forEach((b) => b.addEventListener('click', () => {
      const g = claimAch(b.dataset.ach); if (g) { track('ach_claim', { id: b.dataset.ach, gems: g }); msg(`+${g} 💎`); changed(); draw(); }
    }));
  }
  function drawAlbum() {
    $('.body').innerHTML = `<div style="font-size:13px;color:#9fb3a8">${t('tkAlbumHint')}</div>` + SETS.map((s0) => {
      const s = setState(s0.id);
      const cells = CARDS.filter((c) => c.set === s.id).map((c) => { const h = hasCard(c.id);
        return `<div title="${nm(c)}" style="width:52px;text-align:center;background:${h ? 'linear-gradient(#fff6d8,#ffe08a)' : 'rgba(255,255,255,.06)'};border-radius:10px;padding:6px 2px;color:${h ? '#3a2a00' : '#5d7066'}"><div style="font-size:26px;${h ? '' : 'filter:grayscale(1) brightness(.35)'}">${c.icon}</div><div style="font-size:10px;line-height:1.1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${h ? nm(c) : '?'}</div></div>`; }).join('');
      return `<div style="background:rgba(255,255,255,.07);border-radius:14px;padding:10px 12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><div style="font-size:16px;font-weight:800">${s.icon} ${t('set_' + s.id)} <span style="font-size:13px;color:#9fb3a8">${s.got}/${s.total}</span></div>
        ${s.claimed ? '<div style="font-size:20px">✅</div>' : claimBtn(`data-set="${s.id}"`, `💎 ${s.gems}`, s.complete)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${cells}</div></div>`;
    }).join('');
    wrap.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
      const g = claimSet(b.dataset.set); if (g) { track('set_claim', { id: b.dataset.set, gems: g }); msg(`+${g} 💎`); changed(); draw(); }
    }));
  }
  function draw() {
    wrap.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === tab; b.style.background = on ? '#ffb71b' : '#2a333a'; b.style.color = on ? '#1a1200' : '#fff'; });
    if (tab === 'd' || tab === 'w') drawTasks(tab); else if (tab === 'a') drawAch(); else drawAlbum();
    dots();
  }
  wrap.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; msg(''); draw(); }));
  const tick = setInterval(() => { if (!document.body.contains(wrap)) return clearInterval(tick); if (tab === 'd' || tab === 'w') { const l = $('[data-left]'); if (l) draw(); } }, 30000);
  draw();
  track('tasks_view', {});
}
