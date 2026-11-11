/* Purpose: reads ParishLife.Api's anonymous public routes and shapes them into what the public site's
   pages read: the directory of parishes, and each parish's details.
   Main functions: loadDirectory, loadParish, toParish, toContent, toEvent, toMinistry.

   Routes: GET /api/public/parishes (the directory), and for one parish .../website (published
   sections), .../calendar (public events in a date range) and .../ministries.
   What the API does not publish stays empty instead of being invented: Arabic names, rite, phone,
   address, clergy, photos and news. Public requests stay off until the request form is connected. */

async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw Object.assign(new Error('Could not load parish information'), { status: response.status });
  return response.json();
}

/* PublicParishDto → a directory entry */
export const toParish = p => ({
  id: p.parishId,
  name: p.name || '',
  ar: '',
  town: p.locality || '',
  townAr: '',
  diocese: p.dioceseName || '',
  latitude: p.latitude ?? '',
  longitude: p.longitude ?? ''
});

/* Published website sections → the texts the parish page shows, by key and language. A section key
   is free text in the API, so "mass-times", "Mass times" and "massTimes" all count. */
const KEYS = {
  masstimes: 'massTimes',
  history: 'history',
  welcome: 'welcome',
  contact: 'contact',
  sacraments: 'sacraments'
};
export function toContent(sections = []) {
  const content = {};
  for (const s of sections) {
    const key =
        KEYS[
          String(s.key || '')
            .toLowerCase()
            .replace(/[^a-z]/g, '')
        ],
      lang = String(s.language || '')
        .slice(0, 2)
        .toLowerCase();
    if (key && (lang === 'en' || lang === 'ar')) (content[key] ||= { en: '', ar: '' })[lang] = s.body || '';
  }
  return content;
}

/* PublicCalendarEventDto → an event on the parish's own clock (date and 24-hour time). */
export function toEvent(e) {
  const at = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: e.timeZone || 'Asia/Beirut',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(new Date(e.startsAt))
      .map(part => [part.type, part.value])
  );
  return {
    id: e.id,
    d: `${at.year}-${at.month}-${at.day}`,
    t: `${at.hour}:${at.minute}`,
    title: e.title || '',
    titleAr: '',
    kind: String(e.kind || 'event').toLowerCase()
  };
}

/* PublicMinistryDto → a ministry card */
export const toMinistry = m => ({
  id: m.id,
  name: m.name || '',
  nameAr: '',
  description: m.publicInformation || m.purpose || '',
  responsible: ''
});

const days = n => new Date(Date.now() + n * 86400000).toISOString();
async function parts(p, withMinistries) {
  const base = '/api/public/parishes/' + encodeURIComponent(p.id);
  const [sections, calendar, ministries] = await Promise.all([
    json(base + '/website').catch(() => []),
    json(`${base}/calendar?start=${encodeURIComponent(days(-7))}&end=${encodeURIComponent(days(120))}&size=50`).catch(
      () => ({ items: [] })
    ),
    withMinistries ? json(base + '/ministries?size=50').catch(() => ({ items: [] })) : { items: [] }
  ]);
  return {
    parish: {
      name: p.name,
      nameAr: '',
      ar: '',
      town: p.town,
      townAr: '',
      rite: '',
      riteAr: '',
      phone: '',
      address: ''
    },
    content: toContent(sections),
    events: (calendar.items || []).filter(e => e.status !== 'Cancelled').map(toEvent),
    ministries: (ministries.items || []).map(toMinistry),
    posts: [],
    clergy: [],
    gallery: [],
    parishPhoto: '',
    publicRequests: false, // the request form still posts to the old server's route
    visit: { latitude: p.latitude, longitude: p.longitude, livestream: '' }
  };
}

/* The directory and, for the homepage's events and Mass times, each parish's website and calendar
   (the first `limit` parishes; ministries load with a parish's own page). */
export async function loadDirectory(limit = 40) {
  const page = await json('/api/public/parishes');
  const seen = new Set(),
    directory = [...(page.items || []), ...(page.distanceUnavailable || [])]
      .map(toParish)
      .filter(p => !seen.has(p.id) && seen.add(p.id));
  const details = new Map(await Promise.all(directory.slice(0, limit).map(async p => [p.id, await parts(p, false)])));
  return { directory, details };
}

export const loadParish = p => parts(p, true);
