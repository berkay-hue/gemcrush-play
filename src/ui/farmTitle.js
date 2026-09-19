// F8: üst bar başlığı — "<isim>'ın Çiftliği" (Türkçe iyelik eki ünlü uyumuyla) + isim değiştirme kutusu.
import { save, account, setProfile } from '../meta/save.js';
import { getLang, t } from '../i18n.js';
import { shield } from './widgets.js';

export function playerName() {
  const p = save.profile && save.profile.name;
  if (p) return p;
  const a = account();
  return a && a.user ? a.user.charAt(0).toUpperCase() + a.user.slice(1) : '';
}

// Berkay → Berkay'ın, Ayşe → Ayşe'nin, Onur → Onur'un, Gül → Gül'ün
export function possessive(name) {
  const low = name.toLocaleLowerCase('tr');
  const vs = low.match(/[aeıioöuü]/g);
  const v = vs ? vs[vs.length - 1] : 'e';
  const suf = { a: 'ın', ı: 'ın', e: 'in', i: 'in', o: 'un', u: 'un', ö: 'ün', ü: 'ün' }[v];
  return `${name}'${/[aeıioöuü]$/.test(low) ? 'n' : ''}${suf}`;
}

export function farmTitle() {
  const n = playerName();
  if (getLang() === 'en') return n ? `${n}'s Farm` : t('farm');
  return n ? `${possessive(n)} Çiftliği` : t('farm');
}

export function renameBox(onDone) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font-family:"Baloo 2",system-ui,sans-serif;padding:16px';
  wrap.innerHTML = `<form style="width:100%;max-width:320px;background:#f5f4eb;border-radius:20px;padding:20px;box-sizing:border-box;box-shadow:0 14px 40px rgba(0,0,0,.45);animation:gcpop .25s cubic-bezier(.34,1.56,.64,1)">
    <div style="font-size:20px;font-weight:800;color:#1f3a2e;margin-bottom:10px">${t('renameFarm')}</div>
    <input name="n" maxlength="16" autocomplete="nickname" placeholder="${t('setName')}" style="width:100%;box-sizing:border-box;font-size:18px;padding:11px 12px;border-radius:12px;border:2px solid #cfc9b0;background:#fff;font-family:inherit;color:#1f3a2e">
    <div class="pv" style="min-height:22px;font-size:14px;color:#6b7a70;margin:8px 2px 12px"></div>
    <div style="display:flex;gap:8px"><button type="button" data-x style="flex:1;font-size:16px;padding:10px;border-radius:12px;border:0;background:#e4e0cc;color:#1f3a2e;font-family:inherit;font-weight:700">${t('cancel')}</button>
    <button style="flex:1;font-size:16px;padding:10px;border-radius:12px;border:0;background:#2e7d4f;color:#fff;font-family:inherit;font-weight:800">${t('saveBtn')}</button></div></form>`;
  if (!document.getElementById('gcpop')) { const st = document.createElement('style'); st.id = 'gcpop'; st.textContent = '@keyframes gcpop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}'; document.head.appendChild(st); }
  document.body.appendChild(shield(wrap));
  const f = wrap.querySelector('form'), pv = wrap.querySelector('.pv');
  f.n.value = playerName();
  const show = () => { const v = f.n.value.trim(); pv.textContent = v ? (getLang() === 'en' ? `${v}'s Farm` : `${possessive(v)} Çiftliği`) : ''; };
  f.n.addEventListener('input', show); show();
  const close = (ok) => { wrap.remove(); onDone && onDone(ok); };
  wrap.querySelector('[data-x]').addEventListener('click', () => close(false));
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(false); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = f.n.value.trim().replace(/[<>]/g, '').slice(0, 16);
    setProfile({ name: v });
    close(true);
  });
  setTimeout(() => { f.n.focus(); f.n.select(); }, 50);
}
