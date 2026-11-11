/* Purpose: counts public-site visits for Insights through ParishLife.Api (POST /api/public/site-metrics).
   Main functions: trackView, trackAction, watchActions.

   The API counts four kinds only (home.view, directory.view, parish.view, request.start), with the
   display language and the parish: no referrer, search text, device or visitor data, and no actions
   such as sharing or calling, so trackAction and watchActions do nothing. A browser asking not to be
   tracked (Do Not Track, Global Privacy Control) is not counted. Like every write to the API, the
   count carries the anti-forgery token. */
const quiet = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
const KIND = {
  home: 'home.view',
  parish: 'parish.view',
  calendar: 'parish.view',
  event: 'parish.view',
  request: 'request.start'
};
let token;
async function csrf() {
  token ??= fetch('/api/auth/csrf', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(o => o.token);
  try {
    return await token;
  } catch {
    token = undefined;
    return '';
  }
}
let last = '';
export async function trackView(page, parish = '') {
  const kind = KIND[page];
  if (quiet || !kind || (kind !== 'home.view' && !parish)) return;
  const key = `${page}|${parish}|${location.search}`;
  if (key === last) return; // a page drawn again (a language switch, a retry) is not a new view
  last = key;
  const language = (document.documentElement.lang || '').slice(0, 2);
  try {
    await fetch('/api/public/site-metrics', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': await csrf() },
      body: JSON.stringify({
        kind,
        language: ['en', 'fr', 'ar'].includes(language) ? language : null,
        ...(kind === 'home.view' ? {} : { parishId: parish })
      })
    });
  } catch {
    /* a count that cannot be sent is simply not counted */
  }
}
export const trackAction = () => {};
export const watchActions = () => {};
