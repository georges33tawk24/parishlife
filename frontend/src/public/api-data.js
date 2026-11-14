/* Purpose: reads ParishLife.Api's anonymous public routes and shapes them into what the public site's
   pages read: the directory of parishes, each parish's details, the homepage's published content, the
   liturgical calendar, the app's install information and the check of a signed document.
   Main functions: loadDirectory, loadParish, loadHomepage, loadHomeLiturgy, nearbyParishes, loadAppInfo,
   verifyDocument; shapers toParish, toContent, toEvent, toMinistry, toSite, toLiturgy; readers
   observanceOn, seasonOn.

   Routes: GET /api/public/parishes (the directory) and POST .../parishes/nearby (distances from the
   visitor's point); for one parish .../website (published sections), .../calendar (public events in a
   date range), .../ministries and .../liturgical-calendar (approved observances); GET
   /api/public/homepage (published platform content); GET /api/public/app/manifest and
   .../offline-policy; GET /api/public/document-verifications/{code}.
   Also .../profile (what the parish published: contacts, Arabic name, rite, times, links, photos,
   clergy; 404 until it publishes), .../announcements (public news) and .../calendar.ics (the feed).
   What a parish has not published stays empty instead of being invented. Public requests are on: the
   request form posts to the anonymous request route.
   Also exported: toProfile, toPost, feedURL. */
import { api } from '../portal/model/api.js';

async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw Object.assign(new Error('Could not load parish information'), { status: response.status });
  return response.json();
}

/* PublicParishDto → a directory entry */
export const toParish = p => ({
  id: p.parishId,
  name: p.name || '',
  ar: p.nameAr || '',
  town: p.locality || '',
  townAr: p.localityAr || '',
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

/* PublicParishProfileDto (or null when nothing is published) → the parish's facts, visit details,
   photographs and clergy. Each text keeps its Arabic twin (…Ar) exactly as typed; the page picks the
   visitor's language and falls back to the other one for display only. */
const VISIT_TEXTS = [
  'officeHours',
  'confessionTimes',
  'expect',
  'languages',
  'parking',
  'accessibility',
  'sacramentNotes',
  'feastName'
];
export function toProfile(dto) {
  const pr = dto?.profile || {};
  const visit = { email: pr.email || '', website: pr.website || '', feastDate: pr.feastDate || '' };
  for (const k of VISIT_TEXTS) {
    visit[k] = pr[k] || '';
    visit[k + 'Ar'] = pr[k + 'Ar'] || '';
  }
  return {
    parish: {
      nameAr: pr.nameAr || '',
      ar: pr.nameAr || '',
      townAr: pr.localityAr || '',
      rite: pr.rite || '',
      riteAr: pr.riteAr || '',
      phone: pr.phone || '',
      address: pr.address || '',
      addressAr: pr.addressAr || ''
    },
    massTimes: { en: pr.massTimes || '', ar: pr.massTimesAr || '' },
    visit: { ...visit, livestream: pr.livestreamUrl || '', whatsapp: pr.whatsAppUrl || '' },
    gallery: (dto?.photos || []).map(x => x.url).filter(Boolean),
    clergy: (dto?.clergy || []).map(m => ({ name: m.name || '', role: m.role || '' }))
  };
}

/* AnnouncementDto (public) → a news post; translations are separate announcements, each keeps its language. */
export const toPost = a => ({
  id: a.id,
  at: a.publishedAt || '',
  title: a.title || '',
  body: a.body || '',
  lang: String(a.language || '').slice(0, 2)
});

/* The public calendar feed of a parish, absolute, for calendar apps (webcal: when asked). */
export const feedURL = (parishId, scheme = '') => {
  if (!parishId) return '';
  const url = new URL('/api/public/parishes/' + encodeURIComponent(parishId) + '/calendar.ics', location.href).href;
  return scheme ? url.replace(/^https?:/, scheme) : url;
};

const days = n => new Date(Date.now() + n * 86400000).toISOString();
const dateOnly = n => {
  const d = new Date(Date.now() + n * 86400000);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
async function parts(p, withMinistries) {
  const base = '/api/public/parishes/' + encodeURIComponent(p.id);
  const [sections, calendar, ministries, liturgy, profile, news] = await Promise.all([
    json(base + '/website').catch(() => []),
    json(`${base}/calendar?start=${encodeURIComponent(days(-7))}&end=${encodeURIComponent(days(120))}&size=50`).catch(
      () => ({ items: [] })
    ),
    withMinistries ? json(base + '/ministries?size=50').catch(() => ({ items: [] })) : { items: [] },
    // approved observances for the same window as the calendar; the parish's own exceptions are its own
    withMinistries ? liturgyPages(p.id, dateOnly(-7), dateOnly(120)) : null,
    json(base + '/profile').catch(() => null), // 404 until the parish publishes its profile
    withMinistries ? json(base + '/announcements').catch(() => []) : []
  ]);
  const shaped = toProfile(profile),
    content = toContent(sections);
  // Mass times written in the website's own section win; otherwise the profile's
  if (!content.massTimes && (shaped.massTimes.en || shaped.massTimes.ar)) content.massTimes = shaped.massTimes;
  return {
    parish: { ...shaped.parish, name: p.name, town: p.town, ar: shaped.parish.ar || p.ar || '' },
    content,
    events: (calendar.items || []).filter(e => e.status !== 'Cancelled').map(toEvent),
    ministries: (ministries.items || []).map(toMinistry),
    liturgy: toLiturgy(liturgy || [], true),
    posts: (Array.isArray(news) ? news : []).map(toPost),
    clergy: shaped.clergy,
    gallery: shaped.gallery,
    parishPhoto: '',
    publicRequests: true, // the request form posts to the API's anonymous request route
    visit: { ...shaped.visit, latitude: p.latitude, longitude: p.longitude }
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

/* ---------- the liturgical calendar ---------- */

/* A parish's approved observances for a date range, in both languages the site speaks. Each page is a
   PublicLiturgicalCalendarDto, or null when the calendar could not be read. */
const liturgyPages = (parishId, from, to) =>
  Promise.all(
    ['en', 'ar'].map(lang =>
      json(
        `/api/public/parishes/${encodeURIComponent(parishId)}/liturgical-calendar?from=${from}&to=${to}&lang=${lang}`
      ).catch(() => null)
    )
  );

/* PublicLiturgicalCalendarDto pages (English, Arabic) → { published, byDate }. A day's entry keeps the
   title in the language the API actually served, so a title that exists in one language only is not
   passed off as the other. Status NotPublished means the competent authority has approved no calendar,
   never that there are no observances: nothing is shown then. A parish's own exceptions (flagged by the
   API) belong to that parish, so only its own pages keep them (withExceptions). */
export function toLiturgy(pages, withExceptions = false) {
  const byDate = {};
  let published = false;
  for (const page of pages) {
    if (page?.status !== 'Published') continue;
    published = true;
    const seen = {};
    for (const day of page.days || []) {
      if (day.parishException && !withExceptions) continue;
      const lang = day.language === 'ar' ? 'ar' : day.language === 'en' ? 'en' : 'other',
        base = [day.calendarId, day.rite, !!day.parishException].join('|'),
        key = base + '#' + (seen[base] = (seen[base] || 0) + 1);
      const list = (byDate[day.date] ||= []);
      let entry = list.find(e => e.key === key);
      if (!entry)
        list.push(
          (entry = {
            key,
            title: { en: '', ar: '', other: '' },
            rank: day.rank || '',
            season: day.season || '',
            seasonAr: day.seasonAr || '',
            rankAr: day.rankAr || '',
            color: day.displayColor || '',
            rite: day.rite || '',
            source: day.source || '',
            calendarVersion: day.calendarVersion || '',
            parishException: !!day.parishException
          })
        );
      entry.title[lang] = day.title || '';
    }
  }
  return published ? { published, byDate } : { published: false, byDate: {} };
}

/* The observance a day carries, as { en, ar, rank, season, color, rite, parishException }, or null when
   the approved calendar names none for that date (or there is none). */
export function observanceOn(liturgy, iso) {
  for (const e of liturgy?.byDate?.[iso] || []) {
    const t = e.title,
      any = t.en || t.ar || t.other;
    if (any)
      return {
        en: t.en || any,
        ar: t.ar || any,
        rank: e.rank,
        season: e.season,
        color: e.color,
        rite: e.rite,
        parishException: e.parishException
      };
  }
  return null;
}

/* The season the approved calendar attaches to a day, as { text, rite }, or null. The API's season is
   free text from the authority and a day without one has none: it is not worked out from other days. */
/* On the Arabic page (lang 'ar') it is the authority's Arabic label when it supplied one; otherwise the
   label as written, with lang saying which script it is in. Never translated here. → { text, lang, rite } */
export function seasonOn(liturgy, iso, lang = 'en') {
  const e = (liturgy?.byDate?.[iso] || []).find(x => x.season || x.seasonAr);
  if (!e) return null;
  if ((lang === 'ar' && e.seasonAr) || !e.season) return { text: e.seasonAr, lang: 'ar', rite: e.rite };
  return { text: e.season, lang: 'en', rite: e.rite };
}

/* The homepage has no parish of its own, so it reads the next seven days of the first listed parishes
   until one has an approved calendar (a parish takes its calendar from its archdiocese). */
export async function loadHomeLiturgy(directory, tries = 4) {
  const from = dateOnly(0),
    to = dateOnly(6);
  const probes = await Promise.all(
    directory
      .slice(0, tries)
      .map(async p => [
        p,
        await json(
          `/api/public/parishes/${encodeURIComponent(p.id)}/liturgical-calendar?from=${from}&to=${to}&lang=en`
        ).catch(() => null)
      ])
  );
  const hit = probes.find(([, page]) => page?.status === 'Published');
  if (!hit) return toLiturgy([]);
  const [p, english] = hit,
    arabic = await json(
      `/api/public/parishes/${encodeURIComponent(p.id)}/liturgical-calendar?from=${from}&to=${to}&lang=ar`
    ).catch(() => null);
  return toLiturgy([english, arabic]);
}

/* ---------- the homepage's published content ---------- */

/* GET /api/public/homepage?lang=en and ?lang=ar → what the homepage reads (see pages/Home.jsx):
   hero {title, subtitle}, announcement {text, detail, linkLabel, link}, stories [{id, title, body,
   linkLabel, link}], about {title, body}, join {title, body}; each text is {en, ar}. A block's text is
   filed under the language the API served it in, so a block with no Arabic text leaves the Arabic slot
   empty rather than repeating the English. null when nothing is published: the page then keeps its
   built-in wording. A section the editor left out is left out here, and the page hides it. */
export function toSite(pages) {
  const site = {},
    stories = new Map();
  let any = false;
  const text = (target, key, lang, value) => ((target[key] ||= { en: '', ar: '' })[lang] = value || '');
  for (const page of pages) {
    for (const b of page?.blocks || []) {
      const lang = b.language === 'ar' ? 'ar' : b.language === 'en' ? 'en' : '';
      if (!lang) continue;
      any = true;
      if (b.section === 'hero') {
        site.hero ||= {};
        text(site.hero, 'title', lang, b.title);
        text(site.hero, 'subtitle', lang, b.body);
      } else if (b.section === 'announcement') {
        site.announcement ||= { link: b.linkUrl || '' };
        text(site.announcement, 'text', lang, b.title);
        text(site.announcement, 'detail', lang, b.body);
        text(site.announcement, 'linkLabel', lang, b.linkLabel);
      } else if (b.section === 'about' || b.section === 'join') {
        site[b.section] ||= {};
        text(site[b.section], 'title', lang, b.title);
        text(site[b.section], 'body', lang, b.body);
      } else if (b.section === 'stories') {
        if (!stories.has(b.id)) stories.set(b.id, { id: b.id, link: b.linkUrl || '', image: '' });
        const story = stories.get(b.id);
        text(story, 'title', lang, b.title);
        text(story, 'body', lang, b.body);
        text(story, 'linkLabel', lang, b.linkLabel);
      }
    }
  }
  if (!any) return null;
  site.stories = [...stories.values()];
  return site;
}

export async function loadHomepage() {
  const pages = await Promise.all(
    ['en', 'ar'].map(lang => json('/api/public/homepage?lang=' + lang).catch(() => null))
  );
  return toSite(pages);
}

/* ---------- near me ---------- */

/* POST /api/public/parishes/nearby: the API measures from the visitor's point (sent in the body, never
   in the address, and not stored) and returns each located parish's approximate distance. → { id: km }.
   Parishes with no recorded location have no distance and are left out. */
export async function nearbyParishes([latitude, longitude]) {
  const page = await api('public/parishes/nearby', 'POST', { latitude, longitude });
  const km = {};
  for (const p of page?.items || []) if (typeof p.distanceKm === 'number') km[p.parishId] = p.distanceKm;
  return km;
}

/* ---------- app information ---------- */

/* GET /api/public/app/manifest (the install manifest; 404 when the deployment has none configured)
   and /offline-policy (which public reads may be kept for offline reading). */
export async function loadAppInfo() {
  const [manifest, policy] = await Promise.all([
    json('/api/public/app/manifest').catch(() => null),
    json('/api/public/app/offline-policy').catch(() => null)
  ]);
  return { manifest, policy };
}

/* ---------- checking a signed document ---------- */

/* GET /api/public/document-verifications/{code} → DocumentVerificationDto: code, status,
   statusMeaning, documentType, documentDetail, reference, documentVersion, issuingParish, authorizedBy,
   authorizedAt, electronicSignatureRecognized, officialStatement, checkedAt. */
export const verifyDocument = code => api('public/document-verifications/' + encodeURIComponent(String(code).trim()));

/* How an answer reads: a Valid status counts as official only where the issuing authority recorded an
   approved electronic-signature arrangement (electronicSignatureRecognized); otherwise the API says the
   code is for reference and the paper document is the official one. A document authorized but not yet
   issued is a note; every other status (replaced, withdrawn, revoked, failed check, no longer matching)
   is critical. → { tone: 'good' | 'note' | 'critical', key } */
export function verdictOf(d) {
  if (d.status === 'Valid')
    return d.electronicSignatureRecognized ? { tone: 'good', key: 'Valid' } : { tone: 'note', key: 'ReferenceOnly' };
  return { tone: d.status === 'NotYetIssued' ? 'note' : 'critical', key: d.status };
}
