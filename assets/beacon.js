/* Counts visits to the public site for the Super Admin's Insights: the kind of page, the parish,
   the language and where the visitor came from. Nothing is stored on the device and no cookie
   is set; a browser asking not to be tracked (Do Not Track, Global Privacy Control) is not counted. */
const quiet = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
function send(body) {
  if (quiet) return;
  const data = JSON.stringify(body);
  try { if (navigator.sendBeacon?.('/api/public/hit', new Blob([data], { type: 'application/json' }))) return; } catch {}
  fetch('/api/public/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true }).catch(() => {});
}
let last = '';
export function trackView(page, parish = '') {
  const key = `${page}|${parish}|${location.search}`;
  if (key === last) return;   // a page drawn again (a language switch, a retry) is not a new view
  last = key;
  send({ t: 'view', p: page, parish, lang: document.documentElement.lang, r: document.referrer });
}
export const trackAction = (action, parish = '', q = '') => send({ t: 'action', a: action, parish, q });

/* What visitors do, read from the links themselves: saving to a calendar, sharing, directions,
   calling the office, the livestream and the parish's WhatsApp channel. */
const ACTION = [['[data-track]', el => el.dataset.track], ['a[download][href^="data:text/calendar"]', el => el.closest('.ph-up-head') ? 'ics-all' : 'ics'],
  ['a[href^="webcal:"]', () => 'subscribe'], ['a[href*="calendar.google.com"]', () => 'google'], ['a[href^="https://wa.me/"]', () => 'share-whatsapp'],
  ['[data-copy-link]', () => 'share-copy'], ['[data-native-share]', () => 'share-native'], ['a[href*="google.com/maps"]', () => 'directions'],
  ['a[href^="tel:"]', () => 'call'], ['[data-near]', () => 'near-me']];
export function watchActions(parishOf) {
  document.addEventListener('click', event => {
    const el = event.target.closest?.('a,button');
    const match = el && ACTION.find(([selector]) => el.matches(selector));
    if (match) trackAction(match[1](el), el.closest('[data-parish]')?.dataset.parish || parishOf() || '');
  }, true);
}
