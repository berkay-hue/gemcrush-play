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

// F22: oyun içi isim kutusu — koyu yeşil degrade, altın çerçeve, kanvasın üstünde ortalı (tarayıcı prompt'u yerine)
export function nameBox({ title, value = '', placeholder = '', preview = null, onSave, onClose } = {}) {
  const cv = document.querySelector('canvas');
  const r = cv ? cv.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:9999;background:rgba(6,14,10,.62);display:flex;align-items:center;justify-content:center;font-family:"Baloo 2",system-ui,sans-serif;padding:16px;box-sizing:border-box`;
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  wrap.innerHTML = `<form style="position:relative;width:100%;max-width:340px;background:linear-gradient(#2c5a45,#143126);border:4px solid #f2c230;border-radius:22px;padding:22px 18px 18px;box-sizing:border-box;box-shadow:0 0 0 3px #7a4f14,0 18px 44px rgba(0,0,0,.6),inset 0 2px 0 rgba(255,255,255,.18);animation:gcpop .28s cubic-bezier(.34,1.56,.64,1)">
    <div style="position:absolute;top:-19px;left:50%;transform:translateX(-50%);background:linear-gradient(#ffd45a,#e79a12);color:#3a2206;font-weight:800;font-size:18px;padding:4px 20px;border-radius:14px;border:3px solid #7a4f14;white-space:nowrap;box-shadow:0 4px 0 #5a3a0c">✏️ ${esc(title)}</div>
    <button type="button" data-x aria-label="close" style="position:absolute;top:-14px;right:-14px;width:40px;height:40px;border-radius:50%;border:3px solid #ffd9a0;background:#7a1f1f;color:#fff;font-size:20px;font-weight:800;line-height:1;cursor:pointer">✕</button>
    <input name="n" maxlength="16" autocomplete="off" placeholder="${esc(placeholder)}" style="width:100%;box-sizing:border-box;margin-top:8px;font-size:21px;font-weight:700;text-align:center;padding:12px;border-radius:14px;border:3px solid #0c2219;background:#f5f4eb;font-family:inherit;color:#1f3a2e;box-shadow:inset 0 3px 6px rgba(0,0,0,.25);outline:none">
    <div class="pv" style="min-height:24px;font-size:16px;font-weight:700;color:#ffe58a;text-align:center;margin:10px 2px 14px"></div>
    <button style="width:100%;font-size:20px;padding:11px;border-radius:16px;border:0;background:linear-gradient(#5fd97a,#2e9e4f);color:#fff;font-family:inherit;font-weight:800;box-shadow:0 5px 0 #1b6533;text-shadow:0 2px 0 rgba(0,0,0,.3);cursor:pointer">✔ ${esc(t('saveBtn'))}</button></form>`;
  if (!document.getElementById('gcpop')) { const st = document.createElement('style'); st.id = 'gcpop'; st.textContent = '@keyframes gcpop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}'; document.head.appendChild(st); }
  document.body.appendChild(shield(wrap));
  const f = wrap.querySelector('form'), pv = wrap.querySelector('.pv');
  f.n.value = value || '';
  const show = () => { const v = f.n.value.trim(); pv.textContent = preview ? (v ? preview(v) : '') : ''; };
  f.n.addEventListener('input', show); show();
  const close = (ok) => { wrap.remove(); onClose && onClose(ok); };
  wrap.querySelector('[data-x]').addEventListener('click', () => close(false));
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(false); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = f.n.value.trim().replace(/[<>]/g, '').slice(0, 16);
    onSave && onSave(v); close(true);
  });
  setTimeout(() => { f.n.focus(); f.n.select(); }, 60);
}

export function renameBox(onDone) {
  nameBox({
    title: t('renameFarm'), value: playerName(), placeholder: t('setName'),
    preview: (v) => (getLang() === 'en' ? `${v}'s Farm` : `${possessive(v)} Çiftliği`),
    onSave: (v) => setProfile({ name: v }), onClose: onDone,
  });
}
