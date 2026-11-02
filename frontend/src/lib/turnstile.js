/* Cloudflare Turnstile on the forms anyone can send (sign-up, requests to a parish), only when
   the platform has a Turnstile key; without one the forms work as they always have. */
let script = null;
const load = () => script ??= new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = ok; s.onerror = fail;
  document.head.append(s);
});
let siteKey = null;
const key = () => siteKey ??= fetch('/api/public/auth-options').then(r => r.json()).then(o => o.turnstile || '').catch(() => '');

/* Shows the check in `box`; the returned state carries its token for the request. */
export async function mountTurnstile(box, lang) {
  const sitekey = box ? await key() : '';
  if (!sitekey) return null;
  try { await load(); } catch { return null; }
  if (!box.isConnected) return null;
  box.hidden = false;
  const state = { token: '' };
  state.id = window.turnstile.render(box, { sitekey, language: lang, theme: 'light', callback: token => { state.token = token; }, 'expired-callback': () => { state.token = ''; } });
  state.reset = () => { window.turnstile.reset(state.id); state.token = ''; };
  return state;
}
