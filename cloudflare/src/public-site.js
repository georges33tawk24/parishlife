/* The public site's shared data, the same as backend/public_site.py: which events and posts a
   parish has made public, one overview of every parish for the homepage, the parish calendar
   as a feed calendars can subscribe to, and the link previews of public pages. */
import { need, localToday, get, eq, truthy, has, iter, items, sorted } from './py.js';

// The public parish profile: contact, visit and follow details edited by the parish office.
export const VISIT_KEYS = ['email', 'officeHours', 'confessionTimes', 'accessibility', 'latitude', 'longitude', 'website',
  'parking', 'languages', 'expect', 'feastName', 'feastDate', 'livestream', 'whatsapp', 'sacramentNotes'];
export const PROFILE_KEYS = ['phone', 'email', 'address', 'officeHours', 'confessionTimes', 'accessibility', 'website', 'latitude', 'longitude',
  'parking', 'languages', 'expect', 'feastName', 'feastDate', 'livestream', 'whatsapp', 'sacramentNotes'];
const KINDS = { mass: ['Mass', 'قدّاس'], sacr: ['Sacrament', 'سرّ'], group: ['Group', 'لقاء جماعة'], event: ['Parish event', 'حدث رعوي'],
  wedding: ['Wedding', 'إكليل'], baptism: ['Baptism', 'معمودية'], funeral: ['Funeral', 'جنّاز'] };
const MONTHS = [['January', 'كانون الثاني'], ['February', 'شباط'], ['March', 'آذار'], ['April', 'نيسان'], ['May', 'أيار'], ['June', 'حزيران'],
  ['July', 'تموز'], ['August', 'آب'], ['September', 'أيلول'], ['October', 'تشرين الأول'], ['November', 'تشرين الثاني'], ['December', 'كانون الأول']];
const DAYS = [['Sunday', 'الأحد'], ['Monday', 'الإثنين'], ['Tuesday', 'الثلاثاء'], ['Wednesday', 'الأربعاء'], ['Thursday', 'الخميس'], ['Friday', 'الجمعة'], ['Saturday', 'السبت']];
const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^\d{2}:\d{2}$/;
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const shift = (day, n) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const enc = encodeURIComponent;

/* The follow and visit details that are links or dates must be well formed. */
export function checkProfile(values) {
  for (const key of ['livestream', 'whatsapp']) need(!values[key] || /^https:\/\/[^\s]+$/.test(values[key]), 'Use HTTPS links for the livestream and WhatsApp.');
  need(!values.whatsapp || /^https:\/\/(chat\.whatsapp\.com|whatsapp\.com|www\.whatsapp\.com|wa\.me)\/[^\s]+$/.test(values.whatsapp), 'Use a WhatsApp channel, group or wa.me link.');
  if (values.feastDate) {
    const day = '2024-' + values.feastDate, parsed = new Date(day + 'T00:00:00Z');
    need(/^\d{2}-\d{2}$/.test(values.feastDate) && Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === day, 'Write the feast day as month and day, for example 07-20.');
  }
}

export function publishedContent(state) {
  const content = {};
  for (const [key, item] of items(get(state, 'CONTENT', {})))
    if (isObject(item) && truthy(get(item, 'published', true))) content[key] = { en: get(item, 'en', ''), ar: get(item, 'ar', '') };
  return content;
}
export function publicEvents(state) {
  const events = [];
  for (const event of iter(get(state, 'EVENTS', []))) {
    const detail = get(get(state, 'EVENT_DETAIL', {}), get(event, 'id'), {});
    if (eq(get(event, 'kind'), 'pending') || (!eq(get(detail, 'visibility'), 'public') &&
      !(!truthy(detail) && has(new Set(['mass', 'event']), get(event, 'kind'))))) continue;
    const item = {};
    for (const key of ['id', 'd', 't', 'title', 'titleAr', 'kind']) item[key] = get(event, key, '');
    events.push(item);
  }
  return events;
}
export const notices = state => iter(get(state, 'NOTICES', [])).filter(n => eq(get(n, 'audience'), 'Parish') && !truthy(get(n, 'groupId')))
  .map(n => ({ title: get(n, 'title', ''), body: get(n, 'ar', ''), at: get(n, 'at', '') }));

/* What the homepage shows of every parish, in one answer: no clergy, ministries or galleries. */
export async function overview(c, defaultPlan) {
  const today = localToday(), first = shift(today, -7), last = shift(today, 120);
  const [rows, stateRows, planRows, postRows] = await c.reads([
    ['SELECT p.id,p.metadata,d.name AS diocese FROM parishes p JOIN dioceses d ON d.id=p.diocese', []],
    ['SELECT parish_id,data FROM states', []],
    ['SELECT parish_id,data FROM pl_plans', []],
    ["SELECT parish_id,title,body,created_at FROM (SELECT parish_id,title,body,created_at,ROW_NUMBER() OVER (PARTITION BY parish_id ORDER BY created_at DESC) AS n FROM member_content WHERE group_id IS NULL AND kind IN ('post','announcement')) WHERE n<=8 ORDER BY created_at DESC", []]
  ]);
  const parishes = rows.map(row => { const meta = JSON.parse(row.metadata); return { id: row.id, name: meta.name ?? '', ar: meta.ar ?? '', town: meta.town ?? '', townAr: meta.townAr ?? '', diocese: row.diocese }; });
  const states = new Map(stateRows.map(row => [row.parish_id, JSON.parse(row.data)])), plans = new Map(planRows.map(row => [row.parish_id, JSON.parse(row.data)]));
  const posts = new Map();
  for (const row of postRows) { if (!posts.has(row.parish_id)) posts.set(row.parish_id, []); posts.get(row.parish_id).push({ title: row.title, body: row.body, at: row.created_at }); }
  const details = {};
  for (const p of parishes) {
    const state = states.get(p.id);
    if (!state) continue;
    const parish = state.PARISH || {}, content = publishedContent(state);
    details[p.id] = {
      parish: Object.fromEntries(['name', 'nameAr', 'town', 'townAr', 'rite', 'riteAr'].map(k => [k, parish[k] ?? ''])),
      content: content.massTimes ? { massTimes: content.massTimes } : {},
      events: publicEvents(state).filter(e => typeof e.d === 'string' && first <= e.d && e.d <= last),
      posts: sorted([...(posts.get(p.id) || []), ...notices(state)], item => item.at, true).slice(0, 8),
      parishPhoto: state.PHOTOS?.parish ?? '', gallery: (parish.gallery || []).slice(0, 1),
      publicRequests: (plans.get(p.id) || defaultPlan).publicRequests ?? true,
      visit: Object.fromEntries(['latitude', 'longitude', 'livestream'].map(k => [k, parish[k] ?? '']))
    };
  }
  return { parishes, details };
}

/* ---------- calendar feed ---------- */
const TIMEZONE = ['BEGIN:VTIMEZONE', 'TZID:Asia/Beirut', 'X-LIC-LOCATION:Asia/Beirut',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'TZNAME:EET', 'DTSTART:19701025T000000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'TZNAME:EEST', 'DTSTART:19700329T000000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'END:VTIMEZONE'];
const text = value => String(value).replace(/[\\,;]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
/* Lines of at most 75 octets, continued with a space (RFC 5545). */
function fold(line) {
  const out = [], encoder = new TextEncoder();
  let current = '', size = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(current); current = ''; size = 0; }
    current += ch; size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}
const eventTitle = (event, ar) => (ar ? event.titleAr || event.title : event.title || event.titleAr) || (KINDS[event.kind] || KINDS.event)[ar ? 1 : 0];
const compact = value => value.replace(/[-:]/g, '');

export async function calendarFeed(c, pid, origin, ar) {
  const row = await c.first('SELECT data FROM states WHERE parish_id=?', pid);
  need(row !== null, 'Parish not found.', 404);
  const state = JSON.parse(row.data), parish = state.PARISH || {};
  const name = ar ? parish.nameAr || parish.name : parish.name || parish.nameAr, town = ar ? parish.townAr || parish.town : parish.town || parish.townAr;
  const place = [name, town].filter(Boolean).join(ar ? '، ' : ', '), since = shift(localToday(), -60);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ParishLife//Parish calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + text(name || 'ParishLife'), 'X-WR-TIMEZONE:Asia/Beirut', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H', ...TIMEZONE];
  for (const event of publicEvents(state)) {
    const day = String(event.d || ''), clock = String(event.t || '');
    if (!DATE.test(day) || day < since || !Number.isFinite(+new Date(day + 'T00:00:00Z'))) continue;
    let when;
    if (TIME.test(clock)) {
      const end = new Date(`${day}T${clock}:00Z`);
      if (!Number.isFinite(+end)) continue;
      end.setUTCHours(end.getUTCHours() + 1);
      when = [`DTSTART;TZID=Asia/Beirut:${compact(day)}T${compact(clock)}00`, `DTEND;TZID=Asia/Beirut:${compact(end.toISOString().slice(0, 16))}00`];
    } else when = [`DTSTART;VALUE=DATE:${compact(day)}`, `DTEND;VALUE=DATE:${compact(shift(day, 1))}`];
    lines.push('BEGIN:VEVENT', `UID:${event.id || day + clock}@parishlife`, 'DTSTAMP:' + stamp, ...when, 'SUMMARY:' + text(eventTitle(event, ar)),
      ...(place ? ['LOCATION:' + text(place)] : []), `URL:${origin}/public.html?parish=${enc(pid)}&event=${enc(String(event.id || ''))}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/* ---------- link previews ---------- */
const decode = value => value.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' })[k]);
function plain(value, limit = 180) {
  const t = decode(String(value || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (t.length <= limit) return t;
  const cut = t.slice(0, limit - 1);
  return (cut.includes(' ') ? cut.slice(0, cut.lastIndexOf(' ')) : cut) + '…';
}
function dayText(day, clock, ar) {
  const d = new Date(day + 'T00:00:00Z'), name = DAYS[d.getUTCDay()], month = MONTHS[d.getUTCMonth()];
  if (ar) return `${name[1]} ${d.getUTCDate()} ${month[1]} ${d.getUTCFullYear()}` + (clock ? `، الساعة ${clock}` : '');
  return `${name[0]} ${d.getUTCDate()} ${month[0]} ${d.getUTCFullYear()}` + (clock ? `, ${clock}` : '');
}

/* The title, description, picture and structured data a shared parish or event link shows. */
export async function shareMeta(c, params, origin) {
  const pid = params.get('parish') || '', ar = params.get('lang') === 'ar';
  const row = pid ? await c.first('SELECT data FROM states WHERE parish_id=?', pid) : null;
  if (!row) return null;
  const state = JSON.parse(row.data), parish = state.PARISH || {};
  const pick = (en, other) => ar ? parish[other] || parish[en] : parish[en] || parish[other];
  const name = pick('name', 'nameAr') || pid, town = pick('town', 'townAr');
  const photos = [state.PHOTOS?.parish || '', ...(parish.gallery || [])];
  const image = photos.find(p => typeof p === 'string' && p.startsWith('https://')) || origin + '/assets/images/og-home.jpg';
  const url = `${origin}/public.html?parish=${enc(pid)}`;
  const address = { '@type': 'PostalAddress', addressCountry: 'LB', ...(town ? { addressLocality: town } : {}), ...(parish.address ? { streetAddress: parish.address } : {}) };
  const eventId = params.get('event') || '';
  const event = eventId ? publicEvents(state).find(e => e.id && e.id === eventId && DATE.test(String(e.d))) : null;
  if (event) {
    const title = eventTitle(event, ar), clock = TIME.test(String(event.t)) ? String(event.t) : '', place = [name, town].filter(Boolean).join(ar ? '، ' : ', ');
    const description = ar ? `${dayText(event.d, clock, ar)} في ${place}. أضفها إلى رزنامتك على ParishLife.` : `${dayText(event.d, clock, ar)} at ${place}. Add it to your calendar on ParishLife.`;
    const data = { '@context': 'https://schema.org', '@type': 'Event', name: title, startDate: event.d + (clock ? `T${clock}:00` : ''),
      eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name, address }, image: [image], description, organizer: { '@type': 'Organization', name, url }, url: `${url}&event=${enc(eventId)}` };
    return { title: `${title} · ${name}`, description, image, url: data.url, type: 'article', data };
  }
  const welcome = publishedContent(state).welcome || {};
  const lede = plain(ar ? welcome.ar || welcome.en : welcome.en || welcome.ar);
  const description = lede || (ar ? `مواعيد القداديس والمناسبات والأخبار في رعية ${name}${town ? ` في ${town}` : ''}، وطلبات إلى مكتب الرعية.`
    : `Mass times, events and news from ${name}${town ? ` in ${town}` : ''}, and requests to the parish office.`);
  const data = { '@context': 'https://schema.org', '@type': 'Church', name, url, image, address, ...(parish.phone ? { telephone: parish.phone } : {}) };
  if (parish.latitude && parish.longitude) data.geo = { '@type': 'GeoCoordinates', latitude: parish.latitude, longitude: parish.longitude };
  return { title: `${name}${town ? (ar ? `، ${town}` : `, ${town}`) : ''} · ParishLife`, description, image, url, type: 'website', data };
}

/* public.html with the preview tags of the link, every address absolute. */
export function sharePage(page, meta, origin, analytics = '') {
  const attr = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  const content = (pattern, value) => { page = page.replace(new RegExp(`(<meta ${pattern} content=")[^"]*(")`), (m, a, b) => a + attr(value) + b); };
  if (meta) {
    page = page.replace(/<title>[^<]*<\/title>/, () => `<title>${attr(meta.title)}</title>`);
    content('name="description"', meta.description);
    content('property="og:type"', meta.type);
    content('property="og:title"', meta.title);
    content('property="og:description"', meta.description);
    content('property="og:image"', meta.image);
  } else content('property="og:image"', origin + '/assets/images/og-home.jpg');
  let extra = `  <meta property="og:url" content="${attr(meta ? meta.url : origin + '/')}">\n`;
  if (meta) extra += '  <script type="application/ld+json">' + JSON.stringify(meta.data).replace(/</g, '\\u003c') + '</script>\n';
  if (analytics) extra += `  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${attr(analytics)}"}'></script>\n`;
  return page.replace('</head>', () => extra + '</head>');
}
