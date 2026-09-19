// Giriş / kayıt formu: gerçek HTML input (şifre gizli, mobil klavye) — Phaser tuvalinin üstünde.
import { t } from '../i18n.js';
import { register, login, authError } from '../meta/save.js';

export function authForm(onDone, cancelLabel) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;padding:16px';
  wrap.innerHTML = `
  <form style="width:100%;max-width:340px;background:linear-gradient(#1e3a31,#0c1a15);border:3px solid #ffb71b;border-radius:22px;padding:22px;color:#fff;box-sizing:border-box">
    <div style="font-size:24px;font-weight:800;color:#ffb71b;text-align:center;margin-bottom:6px">☁️ ${t('account')}</div>
    <div style="font-size:13px;color:#9fb3a8;text-align:center;margin-bottom:14px">${t('accountHint')}</div>
    <input name="u" autocomplete="username" autocapitalize="none" placeholder="${t('username')}" maxlength="20" style="width:100%;box-sizing:border-box;font-size:18px;padding:12px;border-radius:12px;border:0;margin-bottom:10px">
    <input name="p" type="password" autocomplete="current-password" placeholder="${t('password')}" style="width:100%;box-sizing:border-box;font-size:18px;padding:12px;border-radius:12px;border:0">
    <div class="err" style="min-height:20px;color:#ff8a80;font-size:14px;text-align:center;margin:8px 0"></div>
    <button data-m="login" style="width:100%;font-size:19px;font-weight:800;padding:12px;border-radius:14px;border:0;background:#ffb71b;color:#1a1200;margin-bottom:8px">${t('login')}</button>
    <button data-m="register" style="width:100%;font-size:17px;font-weight:700;padding:11px;border-radius:14px;border:0;background:#2ee06a;color:#04220e;margin-bottom:8px">${t('register')}</button>
    <button data-m="close" type="button" style="width:100%;font-size:15px;padding:9px;border-radius:14px;border:0;background:transparent;color:#9fb3a8">${cancelLabel || t('cancel')}</button>
  </form>`;
  document.body.appendChild(wrap);
  const f = wrap.querySelector('form'), err = wrap.querySelector('.err');
  const done = (ok) => { wrap.remove(); onDone && onDone(ok); };
  let mode = 'login', busy = false;
  f.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.m; if (mode === 'close') done(false); }));
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault(); if (busy) return;
    const u = f.u.value.trim(), p = f.p.value;
    busy = true; err.textContent = '…';
    try { await (mode === 'register' ? register(u, p) : login(u, p)); done(true); }
    catch (e) { err.textContent = t('authErr_' + authError(e)); busy = false; }
  });
  setTimeout(() => f.u.focus(), 50);
}
