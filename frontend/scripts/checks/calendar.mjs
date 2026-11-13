/* Purpose: checks the Calendar module (model/modules/calendar.js) against an in-memory stand-in for the
   Scheduling routes: what load fills (events on the parish's own clock, feasts from the approved liturgical
   calendar and parish exceptions, plans, plan templates, music, setlists), what save sends (create, edit,
   recurring series, plan items, a hymn revision), what stays unsaved, and the direct calls (event and plan
   actions, schedules). Run by `npm run check`. */
import assert from 'node:assert/strict';
import { mockApi, json, signedIn } from '../mock-api.mjs';

const day = n => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(7, 0, 0, 0);
  return d;
};
const iso = d => d.toISOString();
const ymd = d => iso(d).slice(0, 10);
const zone = 'Asia/Beirut';
const local = d => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(d)
      .map(x => [x.type, x.value])
  );
  return [`${p.year}-${p.month}-${p.day}`, `${p.hour}:${p.minute}`];
};

const mass = day(3),
  lunch = day(5);
const events = [
  {
    value: {
      id: 'e1',
      parishId: 'P',
      title: 'Sunday Mass',
      titleAr: 'قداس الأحد',
      kind: 'ParishActivity',
      startsAt: iso(mass),
      endsAt: iso(new Date(+mass + 3600000)),
      timeZone: zone,
      visibility: 'Public',
      status: 'Confirmed',
      published: true,
      redacted: false,
      description: 'Arabic and Syriac',
      descriptionAr: 'بالعربية والسريانية'
    },
    version: 'v-e1'
  },
  {
    value: {
      id: 'e2',
      parishId: 'P',
      title: 'Parish lunch',
      kind: 'ParishActivity',
      startsAt: iso(lunch),
      endsAt: iso(new Date(+lunch + 7200000)),
      timeZone: zone,
      visibility: 'Parish',
      status: 'Draft',
      published: false,
      redacted: false
    },
    version: 'v-e2'
  },
  {
    value: {
      id: 'e3',
      parishId: 'P',
      title: 'Busy',
      kind: 'Busy',
      startsAt: iso(day(6)),
      endsAt: iso(new Date(+day(6) + 3600000)),
      timeZone: zone,
      visibility: 'Private',
      status: 'Busy',
      published: false,
      redacted: true
    },
    version: ''
  }
];
const plan = {
  id: 'pl1',
  kind: 'Plan',
  eventId: 'e1',
  title: 'Sunday Mass plan',
  titleAr: 'خطة قداس الأحد',
  language: 'ar',
  planType: 'Liturgy',
  coordinatorAccountId: 'acct-1',
  celebrantAccountId: 'acct-2',
  status: 'Draft',
  issues: ['CelebrantRequired'],
  items: [
    {
      key: 'entrance',
      title: 'Entrance hymn',
      titleAr: 'ترنيمة الدخول',
      minutes: 5,
      startsAt: iso(mass),
      instructions: 'Organ only',
      instructionsAr: 'الأرغن فقط',
      instructionAudience: 'Team',
      required: true,
      musicVersionId: 'm1'
    },
    {
      key: 'gospel',
      title: 'Gospel',
      minutes: 6,
      startsAt: iso(new Date(+mass + 300000)),
      instructionAudience: 'Clergy'
    }
  ]
};
const template = {
  id: 'tp1',
  kind: 'Template',
  eventId: null,
  title: 'Wedding',
  titleAr: 'إكليل',
  planType: 'Liturgy',
  coordinatorAccountId: 'acct-1',
  status: 'Approved',
  items: [{ key: 'rite', title: 'Marriage rite', minutes: 20, instructionAudience: 'Clergy' }]
};
const music = [
  {
    id: 'm1',
    workId: 'w1',
    title: 'Qadishat Aloho',
    alternateTitles: ['قاديشات آلوهو'],
    language: 'syr',
    season: 'Trisagion',
    category: 'Entrance',
    musicalKey: 'D minor',
    composer: 'Traditional',
    lyrics: 'ܩܰܕܺܝܫܰܬ | قاديشات | Holy\nline two | سطر',
    chords: 'Dm  Gm',
    notes: 'Organ: pedal only',
    mediaLinks: ['https://www.youtube.com/watch?v=abc', 'https://example.org/rec'],
    rightsBasis: 'Public domain',
    printAllowed: true,
    projectionAllowed: true,
    downloadAllowed: false,
    status: 'Active',
    supersedesId: 'm0',
    createdBy: 'acct-1',
    createdAt: iso(day(-2))
  },
  // the earlier version of the same work: in the history, not in the library
  {
    id: 'm0',
    workId: 'w1',
    title: 'Qadishat',
    titleAr: 'قديشات',
    alternateTitles: [],
    language: 'syr',
    rightsBasis: 'Public domain',
    lyrics: 'old',
    mediaLinks: [],
    status: 'Superseded',
    createdBy: 'acct-2',
    createdAt: iso(day(-30))
  },
  {
    id: 'm2',
    workId: 'w2',
    title: 'Ya Oum Allah',
    titleAr: 'يا أمّ الله',
    alternateTitles: [],
    language: 'ar',
    season: 'Marian',
    seasonAr: 'مريمي',
    rightsBasis: 'Composer permission',
    mediaLinks: [],
    status: 'Active',
    createdBy: 'acct-1',
    createdAt: iso(day(-1))
  }
];
const eventTemplates = [
  {
    value: {
      id: 'et1',
      name: 'Youth night',
      nameAr: 'سهرة الشبيبة',
      kind: 'ParishActivity',
      visibility: 'Parish',
      startTime: '19:00',
      durationMinutes: 120,
      description: 'Games',
      status: 'Active'
    },
    version: 'v-et1'
  }
];

const liturgical = lang => ({
  parishId: 'P',
  status: 'Published',
  days: [
    {
      date: ymd(day(4)),
      title: lang === 'ar' ? 'سيدة الورديّة' : 'Our Lady of the Rosary',
      language: lang,
      calendarId: 'c1',
      parishException: false
    },
    // the parish's own observance replaces the approved one on that day; only English is supplied
    { date: ymd(day(8)), title: 'Saint Luke', language: 'en', calendarId: 'c1', parishException: false },
    { date: ymd(day(8)), title: 'Parish patron', language: 'en', calendarId: 'c1', parishException: true }
  ]
});

let denyMusic = false;
const NAMES = { 'acct-1': 'Test Account', 'acct-2': 'Fr. Test Priest' };
const { sent } = mockApi((method, path, body) => {
  const [route, query = ''] = path.split('?');
  const q = new URLSearchParams(query);
  if (route === 'parishes/P/people') return json(200, { items: [], continuationToken: null }); // the People module loads too
  if (route === 'parishes/P/calendar/events' && method === 'GET') {
    const start = Date.parse(q.get('start')),
      end = Date.parse(q.get('end'));
    assert.ok(end - start <= 31 * 86400000, 'the API lists at most 31 days at a time');
    return json(200, {
      items: events.filter(e => Date.parse(e.value.startsAt) < end && Date.parse(e.value.endsAt) > start),
      continuationToken: null
    });
  }
  if (route === 'parishes/P/calendar/events' && method === 'POST') return json(200, { ...body, id: 'e9' });
  if (/^parishes\/P\/calendar\/events\/\w+$/.test(route) && method === 'PUT') return json(200, body);
  if (route === 'parishes/P/calendar/series') return json(200, []);
  if (/^parishes\/P\/calendar\/events\/\w+\/actions$/.test(route)) return json(200, {});
  if (route === 'parishes/P/account-names')
    return json(
      200,
      q
        .get('ids')
        .split(',')
        .filter(id => NAMES[id])
        .map(id => ({ accountId: id, displayName: NAMES[id] }))
    );
  if (route === 'parishes/P/calendar/templates' && method === 'GET')
    return json(200, { items: eventTemplates, continuationToken: null });
  if (route === 'parishes/P/calendar/templates') return json(200, { value: { ...body, id: 'et9' }, version: 'v-et9' });
  if (/^parishes\/P\/calendar\/templates\/[\w-]+(\/actions)?$/.test(route))
    return json(200, { value: body, version: 'v2' });
  if (route === 'parishes/P/plans/celebrants') return json(200, [{ accountId: 'acct-2' }]);
  if (route === 'public/parishes/P/liturgical-calendar') return json(200, liturgical(q.get('lang')));
  if (route === 'parishes/P/plans' && method === 'GET')
    return json(200, {
      items:
        q.get('eventId') === 'e1'
          ? [{ value: plan, version: 'v-pl1' }]
          : q.get('eventId')
            ? []
            : [{ value: template, version: 'v-tp1' }],
      continuationToken: null
    });
  if (route === 'parishes/P/plans') return json(200, plan);
  if (/^parishes\/P\/plans\/\w+(\/actions)?$/.test(route)) return json(200, plan);
  if (route === 'parishes/P/music' && method === 'GET')
    return denyMusic
      ? json(403, {
          status: 403,
          title: 'mfa_required',
          detail: 'Sign in with your authenticator before performing this action.'
        })
      : json(200, {
          items: Number(q.get('offset'))
            ? []
            : music.filter(m => q.get('includeInactive') === 'true' || m.status === 'Active'),
          continuationToken: null
        });
  if (route === 'parishes/P/music') return json(200, {});
  if (route === 'parishes/P/music/m1') return json(200, { value: music[0], version: 'v-m1' });
  if (route === 'parishes/P/music/m1/withdraw') return json(200, {});
  if (route === 'me/schedule') {
    return q.get('format') === 'ics'
      ? new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { headers: { 'Content-Type': 'text/calendar' } })
      : json(200, [
          {
            parishId: 'P',
            parishName: 'Saint Test',
            kind: 'Volunteering',
            sourceId: 'v1',
            title: 'Reader',
            startsAt: iso(mass)
          }
        ]);
  }
  if (route === 'parishes/P/clergy/schedule')
    return json(403, {
      status: 403,
      title: 'mfa_required',
      detail: 'Sign in with your authenticator before performing this action.'
    });
  return undefined;
});

const { session } = await import('../../src/portal/model/api.js');
const D = await import('../../src/portal/model/data.js');
const { hydrate, persist } = await import('../../src/portal/model/persist.js');
const M = await import('../../src/portal/model/modules/calendar.js');
signedIn(session, { roles: ['priest'] });
session.accountUser = { id: 'acct-1', name: 'Test Account' };

// ---- load
await hydrate();
assert.deepEqual(
  D.EVENTS.map(e => [e.id, e.title, e.d, e.t, e.to, e.visibility, e.status, e.published]),
  [
    ['e1', 'Sunday Mass', ...local(mass), local(new Date(+mass + 3600000))[1], 'public', 'Confirmed', true],
    ['e2', 'Parish lunch', ...local(lunch), local(new Date(+lunch + 7200000))[1], 'parish', 'Draft', false],
    ['e3', 'Busy', ...local(day(6)), local(new Date(+day(6) + 3600000))[1], 'private', 'Busy', false]
  ],
  "events on the parish's own clock; no demo event is left"
);
assert.equal(D.EVENTS[0].venue, null, 'the API has no room for an event');
assert.equal(D.EVENT_DETAIL.e1.desc, 'Arabic and Syriac');
assert.deepEqual(
  [D.EVENTS[0].titleAr, D.EVENTS[0].descriptionAr, D.EVENT_DETAIL.e1.descAr],
  ['قداس الأحد', 'بالعربية والسريانية', 'بالعربية والسريانية'],
  'the Arabic twins come from the API'
);
assert.equal(D.EVENTS[1].titleAr, null, 'no Arabic title: null, so the screens show the English one; never a copy');
assert.deepEqual(
  D.EVENT_TEMPLATES.map(x => [x.id, x.name, x.nameAr, x.apiKind, x.visibility, x.startTime, x.duration, x.version]),
  [['et1', 'Youth night', 'سهرة الشبيبة', 'ParishActivity', 'parish', '19:00', 120, 'v-et1']]
);
assert.deepEqual(D.ROTA, { date: '', service: '', serviceAr: '', teams: [] }, 'the rota has no API route');
assert.deepEqual(D.FEASTS[ymd(day(4))], ['Our Lady of the Rosary', 'سيدة الورديّة']);
assert.deepEqual(
  D.FEASTS[ymd(day(8))],
  ['Parish patron', 'Parish patron'],
  'a parish exception replaces the approved day; an untranslated title is not shown as Arabic'
);
assert.equal(D.SERVICE.id, 'pl1', 'the nearest plan is the one the services page opens');
assert.deepEqual(
  D.SERVICE.order.map(i => [i.key, i.t, i.dur, i.note, i.musicId]),
  [
    ['entrance', 'Entrance hymn', '5', 'Organ only', 'm1'],
    ['gospel', 'Gospel', '6', '', null]
  ]
);
assert.equal(D.SERVICE.celebrant, null, 'an account is not a person; no celebrant is invented');
assert.deepEqual(
  [D.SERVICE.titleAr, D.SERVICE.language, D.SERVICE.order[0].ar, D.SERVICE.order[0].noteAr, D.SERVICE.order[1].ar],
  ['خطة قداس الأحد', 'ar', 'ترنيمة الدخول', 'الأرغن فقط', null]
);
assert.deepEqual(
  [D.SERVICE.celebrantName, D.SERVICE.coordinatorName],
  ['Fr. Test Priest', 'Test Account'],
  'names of plan accounts come from the account-names lookup'
);
assert.deepEqual(
  D.SERVICE_TEMPLATES.map(t => [t.id, t.name, t.order.length]),
  [['tp1', 'Wedding', 1]]
);
assert.equal(D.SERVICE_TEMPLATES[0].ar, 'إكليل');
assert.deepEqual(
  D.SETLISTS.map(s => [s.id, s.items]),
  [['pl1', ['m1']]]
);
assert.deepEqual(
  D.MUSIC.map(m => m.id),
  ['m1', 'm2'],
  'the library lists active versions only'
);
assert.deepEqual(
  D.MUSIC_DETAIL.m1.versions.map(v => [v[0], v[2], v[3], v[4], v[5]]),
  [
    ['Qadishat Aloho', ymd(day(-2)), 'acct-1', 'm1', 'Active'],
    ['Qadishat', ymd(day(-30)), 'acct-2', 'm0', 'Superseded']
  ],
  "a hymn's history is every version of its work, newest first"
);
assert.deepEqual([D.MUSIC[1].ar, D.MUSIC[1].occasionAr], ['يا أمّ الله', 'مريمي']);
const hymn = D.MUSIC[0];
assert.deepEqual(
  [hymn.title, hymn.ar, hymn.occasion, hymn.part, hymn.key, hymn.lang, hymn.youtubeUrl, hymn.otherUrl, hymn.rights],
  [
    'Qadishat Aloho',
    'قاديشات آلوهو',
    'Trisagion',
    'Entrance',
    'D minor',
    'Syriac',
    'https://www.youtube.com/watch?v=abc',
    'https://example.org/rec',
    'Public domain'
  ]
);
assert.deepEqual(D.MUSIC_DETAIL.m1.lyrics, [
  ['ܩܰܕܺܝܫܰܬ', 'قاديشات', 'Holy'],
  ['line two', 'سطر', '']
]);
assert.deepEqual(D.MUSIC_DETAIL.m1.notes, [['Organ', 'Organ', 'pedal only', 'pedal only']]);
assert.deepEqual(D.MUSIC_DETAIL.m1.uses, ['Print', 'Project']);

// ---- time zones
assert.equal(M.zonedInstant('2026-11-15', '09:00', 'Asia/Beirut'), '2026-11-15T07:00:00.000Z');
assert.equal(M.zonedInstant('2026-07-15', '09:00', 'Asia/Beirut'), '2026-07-15T06:00:00.000Z', 'summer time');

// ---- a new event: a draft, sent in UTC with its time zone, an operation id and the audience
const when = ymd(day(10));
D.EVENTS.push({
  id: 'draft',
  title: 'Youth night',
  apiKind: 'ParishActivity',
  kind: 'event',
  d: when,
  t: '19:00',
  to: '21:00',
  tz: zone,
  visibility: 'parish',
  titleAr: ' سهرة الشبيبة ',
  description: 'Bring a friend'
});
assert.equal(await persist(), true);
let [method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/calendar/events');
assert.match(body.operationId, /^[0-9a-f-]{36}$/);
assert.deepEqual(
  [body.title, body.kind, body.timeZone, body.visibility, body.description],
  ['Youth night', 'ParishActivity', zone, 'Parish', 'Bring a friend']
);
assert.deepEqual([body.titleAr, body.descriptionAr], ['سهرة الشبيبة', null], 'twins trimmed; none is never a copy');
assert.equal(body.startsAt, M.zonedInstant(when, '19:00', zone));
assert.equal(body.endsAt, M.zonedInstant(when, '21:00', zone));
assert.ok(!D.EVENTS.some(e => e.id === 'draft'), 'the screen shows what the API stored');

// ---- a recurring event: one request for the series
D.EVENTS.push({
  id: 'draft2',
  title: 'Choir',
  apiKind: 'ParishActivity',
  kind: 'event',
  d: when,
  t: '19:00',
  to: '20:00',
  tz: zone,
  visibility: 'public',
  titleAr: 'الجوقة',
  repeat: { count: 4, intervalDays: 7 }
});
assert.equal(await persist(), true);
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/calendar/series');
assert.deepEqual([body.count, body.intervalDays, body.visibility, body.titleAr], [4, 7, 'Public', 'الجوقة']);

// ---- editing a draft sends its version; the lifecycle goes through the action route
D.EVENTS.find(e => e.id === 'e2').title = 'Parish lunch (moved)';
assert.equal(await persist(), true);
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'PUT parishes/P/calendar/events/e2');
assert.equal(body.version, 'v-e2');
await M.eventAction(
  D.EVENTS.find(e => e.id === 'e1'),
  'unpublish',
  'Wrong time'
);
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/calendar/events/e1/actions');
assert.deepEqual([body.action, body.version, body.reason], ['unpublish', 'v-e1', 'Wrong time']);

// ---- what has no route is undone and reported, never saved
const writes = sent.length;
D.ROTA.teams.push({ team: 'Lectors', filled: [] });
D.EVENTS.splice(1, 1);
assert.equal(await persist(), false);
assert.equal(sent.length, writes, 'nothing was sent');
assert.equal(D.ROTA.teams.length, 0);
assert.ok(
  D.EVENTS.some(e => e.id === 'e2'),
  'a removed event comes back: events are cancelled, not deleted'
);
// ---- event templates: created, edited with their version, archived when removed
D.EVENT_TEMPLATES.push({
  id: 'tpl-new',
  name: 'Choir practice',
  nameAr: 'تمرين الجوقة',
  apiKind: 'ParishActivity',
  visibility: 'public',
  startTime: '18:00',
  duration: 90,
  description: ''
});
assert.equal(await persist(), true);
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/calendar/templates');
assert.deepEqual(
  [body.name, body.nameAr, body.kind, body.visibility, body.startTime, body.durationMinutes, body.description],
  ['Choir practice', 'تمرين الجوقة', 'ParishActivity', 'Public', '18:00', 90, null]
);
assert.match(body.operationId, /^[0-9a-f-]{36}$/);
D.EVENT_TEMPLATES[0].nameAr = '';
D.EVENT_TEMPLATES[0].apiKind = 'Appointment';
assert.equal(await persist(), true);
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'PUT parishes/P/calendar/templates/et1');
assert.deepEqual([body.version, body.nameAr, body.visibility], ['v-et1', null, 'Private'], 'appointments stay private');
D.EVENT_TEMPLATES.splice(0, 1);
assert.equal(await persist(), true);
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/calendar/templates/et1/actions');
assert.deepEqual([body.action, body.version], ['archive', 'v-et1']);

// ---- a plan: its items go with its version
const planNow = D.SERVICE;
planNow.order.push({ t: 'Announcements', dur: '3', note: '', audience: 'Everyone', role: 'Secretary' });
assert.equal(await persist(), true);
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'PUT parishes/P/plans/pl1');
assert.equal(body.version, 'v-pl1');
assert.equal(body.coordinatorAccountId, 'acct-1');
assert.deepEqual(
  [
    body.titleAr,
    body.language,
    body.celebrantAccountId,
    body.items[0].titleAr,
    body.items[0].instructionsAr,
    body.items[2].titleAr
  ],
  ['خطة قداس الأحد', 'ar', 'acct-2', 'ترنيمة الدخول', 'الأرغن فقط', null]
);
assert.deepEqual(
  body.items.map(i => [i.key, i.title, i.minutes, i.instructionAudience, i.musicVersionId]),
  [
    ['entrance', 'Entrance hymn', 5, 'Team', 'm1'],
    ['gospel', 'Gospel', 6, 'Clergy', null],
    ['item-3', 'Announcements', 3, 'Everyone', null]
  ]
);
await M.planAction(D.SERVICE, 'submit');
assert.deepEqual(
  [sent.at(-1)[1], sent.at(-1)[2].action, sent.at(-1)[2].version],
  ['parishes/P/plans/pl1/actions', 'submit', 'v-pl1']
);

// ---- music: a new hymn needs its rights; an edit publishes a revision that supersedes the version
D.MUSIC.push({
  id: 'new',
  title: 'Ya Oummal Ilah',
  ar: '',
  lang: 'Arabic',
  part: 'Offertory',
  key: '',
  occasion: '',
  rights: ''
});
assert.equal(await persist(), false, 'no rights, no save');
assert.equal(D.MUSIC.length, 2);
D.MUSIC[0].key = 'A minor';
D.MUSIC_DETAIL.m1.lyrics.push(['third', '', '']);
assert.equal(await persist(), true);
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/music');
assert.equal(body.supersedesId, 'm1');
assert.deepEqual(
  [
    body.language,
    body.musicalKey,
    body.season,
    body.category,
    body.rightsBasis,
    body.printAllowed,
    body.downloadAllowed
  ],
  ['syr', 'A minor', 'Trisagion', 'Entrance', 'Public domain', true, false]
);
assert.deepEqual(body.alternateTitles, ['قاديشات آلوهو']);
assert.equal(body.titleAr, 'قاديشات آلوهو', 'an older Arabic alternate title becomes the Arabic title');
assert.deepEqual(body.mediaLinks, ['https://www.youtube.com/watch?v=abc', 'https://example.org/rec']);
assert.equal(body.lyrics, 'ܩܰܕܺܝܫܰܬ | قاديشات | Holy\nline two | سطر\nthird');
assert.equal(body.notes, 'Organ: pedal only');
D.MUSIC.push({
  id: 'new',
  title: 'Ya Oummal Ilah',
  ar: '',
  lang: 'Arabic',
  part: 'Offertory',
  key: '',
  occasion: 'Marian',
  occasionAr: 'مريمي',
  rights: 'Composer permission, 2026',
  ar: 'يا أمّ الإله'
});
assert.equal(await persist(), true);
[method, path, body] = sent.at(-1);
assert.equal(body.supersedesId, null);
assert.equal(body.language, 'ar');
assert.deepEqual([body.titleAr, body.seasonAr, body.alternateTitles], ['يا أمّ الإله', 'مريمي', []]);
await M.restoreMusicVersion('m1', 'm0');
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/music');
assert.deepEqual([body.supersedesId, body.title, body.titleAr, body.lyrics], ['m1', 'Qadishat', 'قديشات', 'old']);
assert.deepEqual(
  await M.planCelebrants('P'),
  [{ accountId: 'acct-2', name: 'Fr. Test Priest' }],
  'celebrant choices are the current priests from the API, named by the shared lookup'
);
await M.withdrawMusic('m1', 'Rights lapsed');
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/music/m1/withdraw');
assert.deepEqual([body.version, body.reason], ['v-m1', 'Rights lapsed']);

// ---- schedules
const items = await M.loadSchedule(new Date(), day(7));
assert.deepEqual(
  items.map(i => [i.kind, i.title]),
  [['Volunteering', 'Reader']]
);
assert.match(await M.downloadSchedule(new Date(), day(7)), /^BEGIN:VCALENDAR/);
await assert.rejects(M.loadSchedule(new Date(), day(7), { priest: true }), { status: 403 });

// ---- not allowed: a 403 leaves a collection empty instead of failing the load
denyMusic = true;
await hydrate();
assert.equal(D.MUSIC.length, 0, 'music needs an authenticator session; without it the library is empty');
assert.equal(D.EVENTS.length >= 3, true);

// ---- a member without schedule.read: events are not asked for, feasts still show
const asked = [];
signedIn(session, { roles: [], capabilities: [] });
const realFetch = globalThis.fetch;
globalThis.fetch = (url, options) => (asked.push(String(url)), realFetch(url, options));
await hydrate();
assert.equal(D.EVENTS.length, 0);
assert.ok(asked.every(u => !u.includes('/calendar/events')));
assert.ok(Object.keys(D.FEASTS).length > 0, 'the liturgical calendar is public');

console.log('calendar: all assertions passed');
