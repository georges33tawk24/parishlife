/* Purpose: the Calendar module's connection to ParishLife.Api (Scheduling): the parish calendar and its
   events, the bishop-approved liturgical calendar with parish exceptions, service plans and plan templates,
   the music library, and the member's and priest's schedules.
   Main members: keys (the view-model collections this module owns), routes (the portal pages it feeds),
   load (fills those collections), save (sends what changed), and the direct calls the screens make for
   workflows a snapshot diff cannot express: eventAction, planAction, planCelebrants, withdrawMusic,
   restoreMusicVersion, loadSchedule, downloadSchedule, wantMonth, zonedInstant, localParts.

   Arabic twins (titleAr, descriptionAr, nameAr, ar, noteAr, occasionAr) are stored as typed and are null
   when absent, so t() falls back to the other language for display. People on plans are accounts; their
   names come from the shared account-names lookup (names.js).

   What the API does not have stays empty or unsaved, and is listed in docs/frontend-modules/calendar.md:
   rooms on events, RSVP counts, capacity, tasks, the volunteer rota and swaps, setlists of their own,
   personal annotations on hymns, and choosing plan coordinators or item assignees. */
import { api, parishAPI, newOperationId, session } from '../api.js';
import { loadNames, nameOf } from '../names.js';

export const keys = [
  'EVENTS',
  'EVENT_DETAIL',
  'EVENT_TEMPLATES',
  'FEASTS',
  'SERVICE',
  'SERVICE_PLANS',
  'SERVICE_TEMPLATES',
  'ROTA',
  'MUSIC',
  'MUSIC_DETAIL',
  'SETLISTS'
];
export const routes = ['calendar', 'services', 'music'];

const pad = n => String(n).padStart(2, '0');
const DAY = 86400000;
const enc = encodeURIComponent;

/* ---------- time on the parish's own clock ---------- */

/* An instant → the date and 24-hour time in a time zone. */
export function localParts(instant, zone) {
  const at = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(new Date(instant))
      .map(part => [part.type, part.value])
  );
  return { d: `${at.year}-${at.month}-${at.day}`, t: `${at.hour}:${at.minute}` };
}

/* A date ("2026-11-15") and time ("09:00") on a time zone's clock → an ISO instant in UTC. */
export function zonedInstant(date, time, zone) {
  const [y, m, d] = date.split('-').map(Number),
    [h, mi] = (time || '00:00').split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const offset = at => {
    const p = localParts(at, zone),
      [py, pm, pd] = p.d.split('-').map(Number),
      [ph, pmi] = p.t.split(':').map(Number);
    return Date.UTC(py, pm - 1, pd, ph, pmi) - at;
  };
  let at = wall - offset(wall);
  at = wall - offset(at); // once more: the offset can differ at the other side of a clock change
  return new Date(at).toISOString();
}

/* The time zone for a new event. The API has no parish time zone, so it is the one the parish's existing
   events use, else this browser's. The drawer shows it so it can be corrected. */
export function defaultZone(events = []) {
  return (
    events.find(e => e.tz)?.tz ||
    (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
    'UTC'
  );
}

/* ---------- paging ---------- */

/* The calendar and plan routes page with `size` and `cursor` and answer { items, continuationToken }. */
async function pages(path, limit = 2000) {
  const items = [];
  let cursor = '';
  do {
    const page = await api(path + (cursor ? `&cursor=${enc(cursor)}` : ''));
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}

/* A 403 means "not allowed here" (no schedule.read, or no authenticator session for plans and music). */
const allowed = error => (error?.status === 403 ? null : Promise.reject(error));

/* ---------- events ---------- */

const KIND = { ParishActivity: 'event', Appointment: 'event', ResourceBlock: 'event', Busy: 'event' };
const kindOf = apiKind =>
  KIND[apiKind] ||
  (/mass|liturg/i.test(apiKind)
    ? 'mass'
    : /sacrament/i.test(apiKind)
      ? 'sacr'
      : /ministry|meeting/i.test(apiKind)
        ? 'group'
        : 'event');
const AUDIENCE = { Public: 'public', Parish: 'parish', Private: 'private' };

/* Versioned<CalendarEventDto> → the portal's event, on the event's own clock. */
function toEvent(row) {
  const e = row.value,
    start = localParts(e.startsAt, e.timeZone),
    end = localParts(e.endsAt, e.timeZone);
  return {
    id: e.id,
    d: start.d,
    t: start.t,
    to: end.t,
    endsOn: end.d,
    title: e.title,
    // the Arabic twin as stored; null when none, so t() shows the other language
    titleAr: e.titleAr || null,
    kind: kindOf(e.kind),
    apiKind: e.kind,
    venue: null,
    status: e.status,
    published: !!e.published,
    visibility: AUDIENCE[e.visibility] || 'private',
    tz: e.timeZone,
    description: e.description || '',
    descriptionAr: e.descriptionAr || null,
    seriesId: e.seriesId || null,
    redacted: !!e.redacted,
    reason: e.lastActionReason || '',
    version: row.version || ''
  };
}

function eventDetail(e) {
  return {
    organizer: null,
    tz: e.tz,
    cat: e.apiKind === 'Appointment' ? 'Appointment' : 'Parish life',
    catAr: e.apiKind === 'Appointment' ? 'موعد' : 'حياة الرعية',
    tags: [],
    desc: e.description,
    descAr: e.descriptionAr,
    bring: [],
    tasks: [],
    files: [],
    rsvp: { yes: 0, no: 0, maybe: 0, none: 0 },
    cap: 0,
    waiting: 0,
    repeat: 'none',
    invited: [],
    visibility: e.visibility,
    visibleGroupIds: [],
    priestIds: [],
    participants: [],
    subtype: ''
  };
}

/* The months the calendar has loaded. The API lists at most 31 days at a time, so each month is its own
   request. Moving the calendar outside this range widens it (wantMonth). */
let range = null;
const monthStart = (y, m) => Date.UTC(y, m, 1);
const defaultRange = () => {
  const now = new Date();
  return {
    from: monthStart(now.getFullYear(), now.getMonth() - 1),
    to: monthStart(now.getFullYear(), now.getMonth() + 4)
  };
};
export const loadedRange = () => range;

/* Called when the calendar moves to a date; reloads with that month included if it is outside the range. */
export function wantMonth(dateKey, reload) {
  const [y, m] = dateKey.split('-').map(Number);
  const from = monthStart(y, m - 1),
    to = monthStart(y, m);
  range ||= defaultRange();
  if (from >= range.from && to <= range.to) return false;
  range = { from: Math.min(range.from, from), to: Math.max(range.to, to + 32 * DAY) };
  reload?.();
  return true;
}

async function loadEvents(parish) {
  range ||= defaultRange();
  const windows = [];
  for (let at = range.from; at < range.to;) {
    const d = new Date(at),
      next = monthStart(d.getUTCFullYear(), d.getUTCMonth() + 1);
    windows.push([at, Math.min(next, range.to)]);
    at = next;
  }
  const chunks = await Promise.all(
    windows.map(([from, to]) =>
      pages(
        `parishes/${enc(parish.id)}/calendar/events?size=100&start=${enc(new Date(from).toISOString())}&end=${enc(new Date(to).toISOString())}`
      ).catch(allowed)
    )
  );
  const byId = new Map();
  for (const row of chunks.flat().filter(Boolean)) byId.set(row.value.id, row);
  return [...byId.values()].map(toEvent).sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
}

/* ---------- event templates ---------- */

/* Versioned<EventTemplateDto> → the portal's event template. A template only prefills the new-event
   drawer; it never creates or changes an event by itself. Archived templates are not listed. */
function toEventTemplate(row) {
  const x = row.value;
  return {
    id: x.id,
    name: x.name,
    nameAr: x.nameAr || null,
    icon: 'events',
    kind: 'event',
    apiKind: x.kind,
    visibility: AUDIENCE[x.visibility] || 'private',
    startTime: x.startTime || '',
    duration: x.durationMinutes,
    description: x.description || '',
    descriptionAr: x.descriptionAr || null,
    venue: null,
    capacity: 0,
    version: row.version
  };
}

const templateFields = x => [
  x.name,
  x.nameAr || '',
  x.apiKind,
  x.visibility,
  x.startTime || '',
  Number(x.duration) || 0,
  x.description || '',
  x.descriptionAr || ''
];

const templateBody = (x, version) => ({
  operationId: newOperationId(),
  version: version || null,
  name: String(x.name || '').trim(),
  nameAr: twin(x.nameAr),
  kind: x.apiKind || 'ParishActivity',
  visibility: x.apiKind && x.apiKind !== 'ParishActivity' ? 'Private' : AUDIENCE_OUT[x.visibility] || 'Parish',
  startTime: x.startTime || null,
  durationMinutes: Math.max(1, Math.min(44640, Math.round(Number(x.duration) || 60))),
  description: twin(x.description),
  descriptionAr: twin(x.descriptionAr)
});

/* New templates are created, changed ones saved with their version, removed ones archived (kept, restorable). */
async function saveEventTemplates(before, now) {
  const was = byId(before.EVENT_TEMPLATES),
    is = byId(now.EVENT_TEMPLATES);
  let saved = false;
  for (const x of now.EVENT_TEMPLATES || []) {
    const old = was.get(x.id);
    if (!old) {
      await parishAPI('calendar/templates', 'POST', templateBody(x));
      saved = true;
    } else if (!same(templateFields(x), templateFields(old))) {
      await parishAPI(`calendar/templates/${enc(x.id)}`, 'PUT', templateBody(x, old.version));
      saved = true;
    }
  }
  for (const [id, old] of was)
    if (!is.has(id)) {
      await parishAPI(`calendar/templates/${enc(id)}/actions`, 'POST', {
        operationId: newOperationId(),
        version: old.version,
        action: 'archive'
      });
      saved = true;
    }
  return { saved, unsupported: false };
}

/* ---------- liturgical calendar and feasts ---------- */

/* The parish's approved liturgical days for the loaded range, with its own exceptions already applied
   (the anonymous read flags them). One request per language: a title is served in one language. */
async function loadFeasts(parish) {
  range ||= defaultRange();
  const from = new Date(range.from).toISOString().slice(0, 10),
    to = new Date(Math.min(range.to, range.from + 365 * DAY) - DAY).toISOString().slice(0, 10);
  const read = lang =>
    api(`public/parishes/${enc(parish.id)}/liturgical-calendar?from=${from}&to=${to}&lang=${lang}`).catch(e =>
      e.status === 404 ? null : Promise.reject(e)
    );
  const [en, ar] = await Promise.all([read('en'), read('ar')]);
  if (en?.status !== 'Published') return {};
  const titles = (calendar, lang) => {
    const found = new Map();
    for (const day of calendar?.days || []) {
      if (day.language !== lang && lang === 'ar') continue; // not translated: do not show another language as Arabic
      const list = found.get(day.date) || [];
      // a parish exception replaces the approved calendar's observance for that day
      found.set(
        day.date,
        day.parishException
          ? [...list.filter(x => x.exception), { text: day.title, exception: true }]
          : list.some(x => x.exception)
            ? list
            : [...list, { text: day.title }]
      );
    }
    return found;
  };
  const english = titles(en, 'en'),
    arabic = titles(ar, 'ar'),
    feasts = {};
  for (const [date, list] of english) {
    const text = list.map(x => x.text).join(' · ');
    feasts[date] = [text, (arabic.get(date) || []).map(x => x.text).join(' · ') || text];
  }
  return feasts;
}

/* ---------- service plans ---------- */

const PLAN_STATUS = {
  Draft: 'draft',
  Returned: 'draft',
  ReadyForReview: 'scheduled',
  Approved: 'ready',
  Completed: 'completed',
  Cancelled: 'cancelled'
};

/* Versioned<ServicePlanDto> → the portal's plan. People are accounts in the API and people in the portal,
   so `celebrant`, `coordinator` and each item's `who` stay empty and the account ids ride along. */
function toPlan(row, event) {
  const p = row.value,
    zone = event?.tz || defaultZone();
  return {
    id: p.id,
    kind: p.kind,
    eventId: p.eventId || null,
    title: p.title,
    titleAr: p.titleAr || null,
    date: event?.d || '',
    time: event?.t || '',
    venue: null,
    celebrant: null,
    coordinator: null,
    celebrantAccountId: p.celebrantAccountId || null,
    coordinatorAccountId: p.coordinatorAccountId,
    approvedBy: p.approvedBy || null,
    language: p.language || '',
    languageAr: null,
    planType: p.planType,
    status: PLAN_STATUS[p.status] || 'draft',
    apiStatus: p.status,
    issues: p.issues || [],
    returnReason: p.returnReason || '',
    templateId: p.templateId || null,
    version: row.version,
    tz: zone,
    order: (p.items || []).map(i => ({
      key: i.key,
      t: i.title,
      ar: i.titleAr || null,
      dur: String(i.minutes),
      start: i.startsAt ? localParts(i.startsAt, zone).t : '',
      note: i.instructions || '',
      noteAr: i.instructionsAr || null,
      who: null,
      role: i.responsibleRole || '',
      required: !!i.required,
      audience: i.instructionAudience || 'Clergy',
      assignedAccountId: i.assignedAccountId || null,
      fixedStart: i.fixedStart || null,
      musicId: i.musicVersionId || null
    }))
  };
}

const toTemplate = row => {
  const plan = toPlan(row, null);
  return {
    id: plan.id,
    name: plan.title,
    ar: plan.titleAr,
    venue: null,
    language: plan.language,
    languageAr: null,
    celebrant: null,
    coordinator: null,
    planType: plan.planType,
    status: plan.status,
    apiStatus: plan.apiStatus,
    version: plan.version,
    order: plan.order
  };
};

/* The plans of the events that are close in time: a plan is listed by its event, so the nearest events
   are asked (at most 40 requests) instead of every event in the range. */
async function loadPlans(parish, events) {
  const now = Date.now(),
    near = events
      .filter(e => !e.redacted && e.status !== 'Cancelled')
      .filter(e => {
        const at = Date.parse(e.d + 'T12:00:00Z');
        return at > now - 7 * DAY && at < now + 60 * DAY;
      })
      .slice(0, 40);
  const base = `parishes/${enc(parish.id)}/plans?size=100`;
  const [templates, perEvent] = await Promise.all([
    pages(base).catch(allowed),
    Promise.all(near.map(e => pages(`${base}&eventId=${enc(e.id)}`).catch(allowed)))
  ]);
  const byEvent = new Map(events.map(e => [e.id, e]));
  const plans = perEvent
    .flat()
    .filter(Boolean)
    .map(row => toPlan(row, byEvent.get(row.value.eventId)))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { plans, templates: (templates || []).map(toTemplate).filter(t => t.apiStatus !== 'Cancelled') };
}

/* ---------- music ---------- */

const LANG_NAME = { ar: 'Arabic', syr: 'Syriac', syc: 'Syriac', en: 'English', fr: 'French' };
const LANG_CODE = { Arabic: 'ar', Syriac: 'syr', English: 'en', French: 'fr' };
const ARABIC = /[؀-ۿ]/;
const linkOf = (links, host) => links.find(l => host.test(safeHost(l))) || '';
function safeHost(link) {
  try {
    return new URL(link).hostname.toLowerCase();
  } catch {
    return '';
  }
}
const YOUTUBE = /(^|\.)(youtube\.com|youtu\.be)$/,
  ANGHAMI = /(^|\.)anghami\.com$/;

/* MusicVersionDto → the portal's hymn (a row in the library) and its working detail. The occasion is the
   API's season, the part of the liturgy its category. */
function toHymn(m) {
  const links = m.mediaLinks || [],
    other = links.find(l => !YOUTUBE.test(safeHost(l)) && !ANGHAMI.test(safeHost(l))) || '';
  const hymn = {
    id: m.id,
    workId: m.workId,
    title: m.title,
    // the Arabic twin; versions saved before it existed kept their Arabic title among the alternate titles
    ar: m.titleAr || (m.alternateTitles || []).find(x => ARABIC.test(x)) || null,
    alternateTitles: m.alternateTitles || [],
    occasion: m.season || '',
    occasionAr: m.seasonAr || null,
    part: m.category || '',
    key: m.musicalKey || '',
    lang: LANG_NAME[m.language] || m.language,
    rite: m.rite || '',
    sheet: !!(m.chords || m.lyrics),
    audio: links.length > 0,
    youtubeUrl: linkOf(links, YOUTUBE),
    anghamiUrl: linkOf(links, ANGHAMI),
    otherUrl: other,
    rights: m.rightsBasis
  };
  const detail = {
    composer: m.composer || '',
    composerAr: m.composer || '',
    copyright: m.rightsBasis,
    copyrightAr: m.rightsBasis,
    attribution: m.attribution || '',
    instrumentation: m.instrumentation || '',
    uses: [m.printAllowed && 'Print', m.projectionAllowed && 'Project', m.downloadAllowed && 'Download'].filter(
      Boolean
    ),
    versions: [],
    lyrics: (m.lyrics || '')
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const c = line.split('|').map(x => x.trim());
        return [c[0] || '', c[1] || '', c[2] || ''];
      }),
    chords: m.chords || '',
    notes: (m.notes || '')
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const at = line.indexOf(': ');
        return at > 0
          ? [line.slice(0, at), line.slice(0, at), line.slice(at + 2), line.slice(at + 2)]
          : ['Note', 'ملاحظة', line, line];
      }),
    annotations: [],
    supersedes: m.supersedesId || null
  };
  return { hymn, detail };
}

/* Every version the API keeps (active, superseded and withdrawn), by id, for the history and for restoring. */
const musicVersions = new Map();

/* One version in a hymn's history: [title, Arabic title, date, account id, version id, status]. */
const historyRow = m => [
  m.title,
  m.titleAr || null,
  String(m.createdAt || '').slice(0, 10),
  m.createdBy,
  m.id,
  m.status
];

/* The library lists the active version of each work; its history is every version of that work, newest first. */
async function loadMusic(parish) {
  const found = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const page = await api(`parishes/${enc(parish.id)}/music?size=100&offset=${offset}&includeInactive=true`).catch(
      allowed
    );
    if (!page) return null;
    found.push(...(page.items || []));
    if ((page.items || []).length < 100) break;
  }
  musicVersions.clear();
  for (const m of found) musicVersions.set(m.id, m);
  await loadNames(parish.id, [...new Set(found.map(m => m.createdBy))]);
  const byWork = new Map();
  for (const m of found) byWork.set(m.workId, [...(byWork.get(m.workId) || []), m]);
  return found
    .filter(m => m.status === 'Active')
    .map(m => {
      const x = toHymn(m);
      x.detail.versions = (byWork.get(m.workId) || [])
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map(historyRow);
      return x;
    });
}

/* Restoring an earlier version publishes its content again as a new revision of the current version, so the
   history is never rewritten. A withdrawn version's materials are gone, so it cannot be restored. */
export async function restoreMusicVersion(currentId, versionId) {
  const old = musicVersions.get(versionId);
  if (!old) throw new Error('That version is not loaded.');
  if (old.status === 'Withdrawn')
    throw new Error('A withdrawn version cannot be restored: its materials were removed.');
  const keep = [
    'title',
    'titleAr',
    'alternateTitles',
    'language',
    'rite',
    'season',
    'seasonAr',
    'composer',
    'musicalKey',
    'instrumentation',
    'category',
    'lyrics',
    'chords',
    'notes',
    'mediaLinks',
    'rightsBasis',
    'attribution',
    'downloadAllowed',
    'printAllowed',
    'projectionAllowed'
  ];
  return parishAPI('music', 'POST', {
    operationId: newOperationId(),
    supersedesId: currentId,
    ...Object.fromEntries(keep.map(k => [k, old[k] ?? null])),
    alternateTitles: old.alternateTitles || [],
    mediaLinks: old.mediaLinks || []
  });
}

/* The setlists are the hymns a service plan's items name, in running order. They belong to the plan. */
const setlistsOf = plans =>
  plans
    .map(p => ({
      id: p.id,
      name: p.title,
      ar: p.titleAr,
      items: p.order.map(i => i.musicId).filter(Boolean),
      service: p.id
    }))
    .filter(s => s.items.length);

/* ---------- load ---------- */

const blankService = () => ({
  id: '',
  title: '',
  titleAr: '',
  date: '',
  time: '',
  venue: null,
  celebrant: null,
  coordinator: null,
  language: '',
  languageAr: '',
  status: '',
  order: []
});

export async function load(parish, d) {
  d.ROTA = { date: '', service: '', serviceAr: '', teams: [] };
  d.SERVICE = blankService();
  // the liturgical calendar is public: everyone signed in sees the feasts
  d.FEASTS = await loadFeasts(parish).catch(() => ({}));
  if (!parish.roles?.includes('priest') && !parish.capabilities?.includes('schedule.read')) return;
  const events = await loadEvents(parish);
  d.EVENTS = events;
  d.EVENT_DETAIL = Object.fromEntries(events.map(e => [e.id, eventDetail(e)]));
  d.EVENT_TEMPLATES = (
    (await pages(`parishes/${enc(parish.id)}/calendar/templates?size=100`).catch(allowed)) || []
  ).map(toEventTemplate);
  const { plans, templates } = await loadPlans(parish, events);
  // people on plans are accounts: their names come from the shared lookup
  await loadNames(
    parish.id,
    plans.flatMap(p => [
      p.coordinatorAccountId,
      p.celebrantAccountId,
      p.approvedBy,
      ...p.order.map(i => i.assignedAccountId)
    ])
  );
  for (const p of plans) {
    p.celebrantName = nameOf(parish.id, p.celebrantAccountId);
    p.coordinatorName = nameOf(parish.id, p.coordinatorAccountId);
    for (const i of p.order) i.whoName = nameOf(parish.id, i.assignedAccountId);
  }
  const [first, ...rest] = plans.filter(p => p.apiStatus !== 'Cancelled' || true);
  if (first) d.SERVICE = first;
  d.SERVICE_PLANS = rest;
  d.SERVICE_TEMPLATES = templates;
  d.SETLISTS = setlistsOf(plans);
  const music = await loadMusic(parish);
  if (music) {
    d.MUSIC = music.map(x => x.hymn);
    d.MUSIC_DETAIL = Object.fromEntries(music.map(x => [x.hymn.id, x.detail]));
  }
}

/* ---------- save ---------- */

const byId = list => new Map((list || []).map(x => [x.id, x]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* The fields of an event the API stores; everything else on the object is display. */
const eventFields = e => [
  e.title,
  e.titleAr || '',
  e.apiKind,
  e.d,
  e.t,
  e.to,
  e.tz,
  e.visibility,
  e.description || '',
  e.descriptionAr || ''
];
/* An optional twin: trimmed, or null. One language is never filled from the other. */
const twin = value => String(value ?? '').trim() || null;
const AUDIENCE_OUT = { public: 'Public', parish: 'Parish', private: 'Private' };

function eventBody(e, zone) {
  const tz = e.tz || zone,
    endDate = e.endsOn && e.endsOn > e.d ? e.endsOn : e.d;
  return {
    title: String(e.title || '').trim(),
    titleAr: twin(e.titleAr),
    kind: e.apiKind || 'ParishActivity',
    startsAt: zonedInstant(e.d, e.t, tz),
    endsAt: zonedInstant(endDate, e.to || e.t, tz),
    timeZone: tz,
    visibility: AUDIENCE_OUT[e.visibility] || 'Private',
    description: (e.description ?? '').trim() || null,
    descriptionAr: twin(e.descriptionAr)
  };
}

async function saveEvents(before, now) {
  const was = byId(before.EVENTS),
    is = byId(now.EVENTS);
  let saved = false,
    unsupported = [...was.keys()].some(id => !is.has(id)); // cancelling goes through eventAction, never by removing
  const zone = defaultZone(before.EVENTS);
  for (const e of now.EVENTS) {
    const old = was.get(e.id);
    if (!old) {
      const { repeat } = e;
      if (repeat?.count > 1) {
        const { title, titleAr, kind, startsAt, endsAt, timeZone, visibility, description, descriptionAr } = eventBody(
          e,
          zone
        );
        await parishAPI('calendar/series', 'POST', {
          operationId: newOperationId(),
          title,
          titleAr,
          descriptionAr,
          kind,
          startsAt,
          endsAt,
          timeZone,
          visibility,
          description,
          count: repeat.count,
          intervalDays: repeat.intervalDays
        });
      } else await parishAPI('calendar/events', 'POST', { operationId: newOperationId(), ...eventBody(e, zone) });
      saved = true;
    } else if (!same(eventFields(e), eventFields(old))) {
      if (!old.version) {
        unsupported = true; // a busy interval: the details are private
        continue;
      }
      await parishAPI(`calendar/events/${enc(e.id)}`, 'PUT', {
        operationId: newOperationId(),
        version: old.version,
        ...eventBody(e, zone)
      });
      saved = true;
    }
  }
  return { saved, unsupported };
}

/* Move, confirm, publish, unpublish or cancel an event: a state change, not an edit. The screens call
   this and then reload. action is confirm | publish | unpublish | cancel; cancel and unpublish need a reason. */
export function eventAction(event, action, reason) {
  return parishAPI(`calendar/events/${enc(event.id)}/actions`, 'POST', {
    operationId: newOperationId(),
    version: event.version,
    action,
    reason: reason || null
  });
}

/* A plan's order and header. Only drafts and returned plans can change; the API says so otherwise. */
const planFields = p => [
  p.title,
  p.titleAr || '',
  p.language || '',
  p.planType,
  p.celebrantAccountId || null,
  p.order.map(i => [
    i.key,
    i.t,
    i.ar || '',
    i.dur,
    i.note,
    i.noteAr || '',
    i.role,
    i.required,
    i.audience,
    i.musicId,
    i.assignedAccountId
  ])
];
/* New items have no key yet; one that no other item of the plan uses (set by itemsOf). */
let usedKeys = new Set();
const freshKey = n => {
  let k = n + 1;
  while (usedKeys.has(`item-${k}`)) k++;
  usedKeys.add(`item-${k}`);
  return `item-${k}`;
};
const itemsOf = order => {
  usedKeys = new Set(order.map(i => i.key).filter(Boolean));
  return order.map(itemBody);
};
const itemBody = (i, n) => ({
  key: i.key || freshKey(n),
  title: String(i.t || '').trim(),
  titleAr: twin(i.ar),
  minutes: Math.max(0, Math.min(1440, Number(i.dur) || 0)),
  fixedStart: i.fixedStart || null,
  responsibleRole: i.role || null,
  required: !!i.required,
  assignedAccountId: i.assignedAccountId || null,
  instructions: (i.note || '').trim() || null,
  instructionsAr: twin(i.noteAr),
  instructionAudience: i.audience || 'Clergy',
  musicVersionId: i.musicId || null
});
function planBody(p, version) {
  return {
    operationId: newOperationId(),
    version,
    eventId: p.eventId || null,
    templateId: p.templateId && !p.order.length ? p.templateId : null,
    title: String(p.title || '').trim(),
    titleAr: twin(p.titleAr),
    language: twin(p.language),
    planType: p.planType || 'Liturgy',
    coordinatorAccountId: p.coordinatorAccountId || session.accountUser?.id,
    celebrantAccountId: p.celebrantAccountId || null,
    items: itemsOf(p.order)
  };
}

export const planAction = (plan, action, reason) =>
  parishAPI(`plans/${enc(plan.id)}/actions`, 'POST', {
    operationId: newOperationId(),
    version: plan.version,
    action,
    reason: reason || null
  });

/* A plan's printable outputs by audience (clergy, team, everyone, ...), as the API serves them. */
export const planOutput = (plan, audience) => parishAPI(`plans/${enc(plan.id)}/outputs/${enc(audience)}`);

/* The accounts that may be chosen as a Liturgy's celebrant (the parish's current priests), with their names
   from the shared lookup. Needs schedule management and the authenticator session. */
export async function planCelebrants(parishId) {
  const rows = (await parishAPI('plans/celebrants')) || [];
  await loadNames(
    parishId,
    rows.map(r => r.accountId)
  );
  return rows.map(r => ({ accountId: r.accountId, name: nameOf(parishId, r.accountId) }));
}

async function savePlans(before, now) {
  const all = x => [x.SERVICE, ...(x.SERVICE_PLANS || [])].filter(p => p?.id),
    was = byId(all(before)),
    is = byId(all(now));
  let saved = false,
    unsupported = [...was.keys()].some(id => !is.has(id));
  for (const p of all(now)) {
    const old = was.get(p.id);
    if (!old) {
      await parishAPI('plans', 'POST', planBody(p));
      saved = true;
    } else if (!same(planFields(p), planFields(old))) {
      await parishAPI(`plans/${enc(p.id)}`, 'PUT', planBody(p, old.version));
      saved = true;
    }
  }
  // plan templates are structure only: no people, no fixed times
  const wasT = byId(before.SERVICE_TEMPLATES),
    isT = byId(now.SERVICE_TEMPLATES);
  unsupported ||= [...wasT.keys()].some(id => !isT.has(id));
  for (const tpl of now.SERVICE_TEMPLATES || []) {
    const old = wasT.get(tpl.id),
      body = {
        ...planBody(
          {
            ...tpl,
            title: tpl.name,
            titleAr: tpl.ar,
            celebrantAccountId: null,
            order: tpl.order.map(i => ({ ...i, assignedAccountId: null, fixedStart: null }))
          },
          old?.version
        ),
        eventId: null
      };
    if (!old) {
      await parishAPI('plans', 'POST', body);
      saved = true;
    } else if (
      !same(
        [tpl.name, tpl.ar || '', tpl.language || '', tpl.order],
        [old.name, old.ar || '', old.language || '', old.order]
      )
    ) {
      await parishAPI(`plans/${enc(tpl.id)}`, 'PUT', body);
      saved = true;
    }
  }
  return { saved, unsupported };
}

/* ---------- music ---------- */

const linksOf = h => [h.youtubeUrl, h.anghamiUrl, h.otherUrl].filter(Boolean);
const hymnFields = (h, d) => [
  h.title,
  h.ar || '',
  h.occasion,
  h.occasionAr || '',
  h.part,
  h.key,
  h.lang,
  linksOf(h),
  h.rights,
  d?.composer,
  d?.attribution,
  d?.uses,
  d?.lyrics,
  d?.chords,
  d?.notes
];

function musicBody(h, d, supersedes) {
  const uses = d?.uses || ['Project'];
  return {
    operationId: newOperationId(),
    supersedesId: supersedes || null,
    title: String(h.title || '').trim(),
    titleAr: twin(h.ar),
    // other titles are kept as they were; the Arabic title is its own field now
    alternateTitles: (h.alternateTitles || [])
      .map(x => (x || '').trim())
      .filter(Boolean)
      .slice(0, 10),
    language:
      LANG_CODE[h.lang] ||
      String(h.lang || 'ar')
        .toLowerCase()
        .slice(0, 10),
    rite: h.rite || null,
    season: (h.occasion || '').trim() || null,
    seasonAr: twin(h.occasionAr),
    composer: (d?.composer || '').trim() || null,
    musicalKey: (h.key || '').trim() || null,
    instrumentation: (d?.instrumentation || '').trim() || null,
    category: (h.part || '').trim() || null,
    lyrics: (d?.lyrics || []).map(r => r.join(' | ').replace(/( \| )+$/, '')).join('\n') || null,
    chords: (d?.chords || '').trim() || null,
    notes: (d?.notes || []).map(n => `${n[0]}: ${n[2]}`).join('\n') || null,
    mediaLinks: linksOf(h).slice(0, 10),
    rightsBasis: String(h.rights || d?.copyright || '').trim(),
    attribution: (d?.attribution || '').trim() || null,
    downloadAllowed: uses.includes('Download'),
    printAllowed: uses.includes('Print'),
    projectionAllowed: uses.includes('Project')
  };
}

async function saveMusic(before, now) {
  const was = byId(before.MUSIC),
    is = byId(now.MUSIC);
  let saved = false,
    unsupported = [...was.keys()].some(id => !is.has(id)); // withdrawing goes through withdrawMusic
  for (const h of now.MUSIC || []) {
    const old = was.get(h.id),
      detail = now.MUSIC_DETAIL?.[h.id];
    if (!old) {
      if (!String(h.rights || '').trim())
        throw new Error('Say on what basis the parish may use this hymn (its rights) before saving it.');
      await parishAPI('music', 'POST', musicBody(h, detail));
      saved = true;
    } else if (!same(hymnFields(h, detail), hymnFields(old, before.MUSIC_DETAIL?.[h.id]))) {
      await parishAPI('music', 'POST', musicBody(h, detail, h.id)); // a revision supersedes the version it came from
      saved = true;
    }
  }
  return { saved, unsupported };
}

/* Taking a hymn out of the library withdraws that version (its rights no longer hold, so plans stop offering it). */
export async function withdrawMusic(id, reason) {
  const row = await parishAPI(`music/${enc(id)}`);
  return parishAPI(`music/${enc(id)}/withdraw`, 'POST', {
    operationId: newOperationId(),
    version: row.version,
    reason
  });
}

/* ---------- the two together ---------- */

export async function save(before, now, parish) {
  const parts = [];
  const changed = k => !same(before[k], now[k]);
  if (changed('EVENTS')) parts.push(await saveEvents(before, now, parish));
  if (changed('EVENT_TEMPLATES')) parts.push(await saveEventTemplates(before, now));
  if (['SERVICE', 'SERVICE_PLANS', 'SERVICE_TEMPLATES'].some(changed)) parts.push(await savePlans(before, now, parish));
  if (changed('MUSIC') || changed('MUSIC_DETAIL')) parts.push(await saveMusic(before, now, parish));
  // these have no API route (see docs/frontend-modules/calendar.md)
  const unsupported =
    ['ROTA', 'SETLISTS', 'FEASTS'].some(changed) ||
    (changed('EVENT_DETAIL') && !changed('EVENTS') && detailChangedBeyondDescription(before, now)) ||
    parts.some(p => p.unsupported);
  return { unsupported, saved: parts.some(p => p.saved) };
}

/* A change to an event's detail that is not its description (RSVP, tasks, rooms, ...) has nowhere to go. */
function detailChangedBeyondDescription(before, now) {
  const strip = x => Object.fromEntries(Object.entries(x || {}).map(([id, v]) => [id, { ...v, desc: '', descAr: '' }]));
  return !same(strip(before.EVENT_DETAIL), strip(now.EVENT_DETAIL));
}

/* ---------- schedules ---------- */

/* The signed-in member's own schedule across their parishes (GET /api/me/schedule), or the priest's duty
   schedule in this parish (GET /api/parishes/{id}/clergy/schedule, needs the authenticator session). */
export function loadSchedule(from, to, { priest = false } = {}) {
  const query = `from=${enc(from.toISOString())}&to=${enc(to.toISOString())}`;
  return priest ? parishAPI(`clergy/schedule?${query}`) : api(`me/schedule?${query}`);
}

/* The same schedule as an iCalendar file the API builds, saved by the browser. */
export async function downloadSchedule(from, to, { priest = false } = {}) {
  const query = `from=${enc(from.toISOString())}&to=${enc(to.toISOString())}&format=ics`;
  const path = priest ? `parishes/${enc(session.parishId)}/clergy/schedule?${query}` : `me/schedule?${query}`;
  const response = await fetch('/api/' + path, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.detail || 'The schedule could not be downloaded.');
  }
  return response.text();
}
