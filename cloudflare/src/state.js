/* Parish working-state rules ported from server.py: migrate_state(), validate(), writable(). */
import seed from '../../backend/seed.json' with { type: 'json' };
import geography from '../../backend/geography.json' with { type: 'json' };
import {
  PyDict, PyError, Problem, need, truthy, eq, has, get, K, setdefault, setItem, pop, iter, len, slice,
  strip, str, set, subset, intersects, any, all, next, keyed, items, values, add, sum, gt, ge, le,
  isDict, isList, isStr, isBool, isInt, isNumber, isoDate, casefold, sha256hex, deepcopy, or, TODAY
} from './py.js';

export const SEED = seed;
const GEOGRAPHY = geography.governorates;
export const ROLES = new Set(['bishop', 'priest', 'secretary', 'treasurer', 'leader', 'member']);
export const CLERGY = new Set(['priest']); // Bishops use the separate, read-only oversight API.
export const FINANCE = new Set(['BATCH', 'FUNDS', 'EXPENSES', 'PLEDGES', 'CAMPAIGNS', 'RECURRING', 'RECEIPTS', 'BANKLINES', 'GIVING_SERIES', 'PAYMENT_MIX']);
export const OFFICE = new Set(['PEOPLE', 'ARCHIVED', 'HOUSEHOLDS', 'FAMILIES', 'BRANCHES', 'PERSON_EXTRA', 'PHOTOS', 'GROUPS', 'GROUP_DETAIL', 'EVENTS', 'EVENT_DETAIL', 'EVENT_TEMPLATES', 'RESERVATIONS', 'VENUES', 'EQUIPMENT', 'MAINTENANCE', 'ISSUES', 'RENTALS', 'SERVICE', 'SERVICE_PLANS', 'SERVICE_TEMPLATES', 'SERVICE_REQUESTS', 'ROTA', 'VOLUNTEERS', 'SIGNUP_SHEETS', 'CHECKIN', 'PICKUP', 'INCIDENTS', 'EVACUATION', 'REGISTRATIONS', 'REG_FORM', 'REGISTRANTS', 'REFUNDS', 'MESSAGES', 'NOTICES', 'PRAYERS', 'PORTAL_REQUESTS', 'REQUEST_HISTORY', 'WORKFLOWS', 'RUNS', 'RUN_LOG', 'FORM_FIELDS', 'FORM_RULES', 'CONTENT', 'AUTOMATIONS', 'DUPLICATES', 'SACRAMENTS']);
export const READONLY = new Set(['PARISHES', 'AUDIT', 'CORRECTIONS', 'ANNIVERSARIES', 'EPARCHY_NEWS', 'PERMISSIONS', 'EXCEPTIONS', 'TRANSFERS']);
export const PROTECTED = new Set(['status', 'approvedBy', 'approvedAt', 'issuedBy', 'issuedAt', 'history', 'original', 'revision']);

/* Idempotent migration for parish records and working templates. */
export function migrate_state(d) {
  pop(d, 'TRANSFERS', null);
  const chartBlues = ['#3D4161', '#8EC5F4', '#DCEEFF', '#9BC6EC'];
  iter(get(d, 'PAYMENT_MIX', [])).forEach((item, index) => {
    if (isDict(item)) item.color = chartBlues[index % chartBlues.length];
  });
  for (const key of ['FAMILIES', 'BRANCHES', 'REQUEST_HISTORY']) setdefault(d, key, []);
  setdefault(d, 'SERVICE_PLANS', []);
  for (const key of ['EVENT_TEMPLATES', 'SERVICE_TEMPLATES']) {
    setdefault(d, key, []);
    if (!any(K(d, key), row => !isDict(row))) continue;
    const seedTemplates = deepcopy(SEED);
    const converted = [];
    iter(K(d, key)).forEach((row, i) => {
      if (isDict(row)) { converted.push(row); return; }
      const defaults = get(seedTemplates, key, []);
      const dflt = i < len(defaults) && isDict(defaults[i]) ? defaults[i] : null;
      let item;
      if (truthy(dflt)) {
        item = deepcopy(dflt);
        if (key === 'EVENT_TEMPLATES') Object.assign(item, { name: K(row, 0), nameAr: K(row, 1) });
        else Object.assign(item, { name: K(row, 0), ar: K(row, 1) });
      } else if (key === 'EVENT_TEMPLATES') {
        item = { id: `event-template-${i + 1}`, name: K(row, 0), nameAr: K(row, 1), icon: K(row, 2),
          kind: 'event', venue: 'v1', duration: 60, description: '', capacity: 0 };
      } else {
        const service = K(d, 'SERVICE');
        item = { id: `service-template-${i + 1}`, name: K(row, 0), ar: K(row, 1), venue: get(service, 'venue'),
          language: get(service, 'language', ''), languageAr: get(service, 'languageAr', ''),
          celebrant: get(service, 'celebrant'), coordinator: get(service, 'coordinator'),
          order: has(K(row, 0), 'Sunday') ? deepcopy(get(service, 'order', [])) : [] };
      }
      converted.push(item);
    });
    d[key] = converted;
  }
  for (const [gid, detail] of items(K(d, 'GROUP_DETAIL'))) {
    iter(get(detail, 'meetings', [])).forEach((meeting, index) => {
      setdefault(meeting, 'id', `meeting-${gid}-${index + 1}-${str(get(meeting, 'd', 'date'))}`);
      const absent = {};
      for (const entry of iter(get(meeting, 'absent', []))) if (truthy(entry)) setItem(absent, K(entry, 0), 'excused');
      setdefault(meeting, 'attendance', absent);
    });
    detail.belongings = iter(get(detail, 'belongings', [])).map((item, index) => isList(item)
      ? { id: `resource-${gid}-${index + 1}`, name: K(item, 0), ar: K(item, 1), qty: K(item, 2), location: K(item, 3), locationAr: K(item, 4) }
      : item);
    setdefault(detail, 'resourceLoans', []);
    detail.milestones = iter(get(detail, 'milestones', [])).map((item, index) => isList(item)
      ? { id: `formation-${gid}-${index + 1}`, name: K(item, 0), ar: K(item, 1), description: '', legacyCount: K(item, 2), completions: {} }
      : item);
    for (const milestone of detail.milestones) {
      setdefault(milestone, 'completions', {});
      setdefault(milestone, 'legacyCount', 0);
    }
  }
  const hh = keyed(K(d, 'HOUSEHOLDS'), h => K(h, 'id'));
  const persons = keyed(add(K(d, 'PEOPLE'), K(d, 'ARCHIVED')), p => K(p, 'id'));
  const families = keyed(K(d, 'FAMILIES'), f => K(f, 'id'));
  const branches = keyed(K(d, 'BRANCHES'), b => K(b, 'id'));
  for (const h of hh.values()) {
    const signature = casefold(add(add(get(h, 'name', ''), '\0'), get(h, 'ar', '')));
    need(!truthy(get(h, 'family')) || families.has(K(h, 'family')), 'Choose an existing main family.');
    need(!truthy(get(h, 'branch')) || branches.has(K(h, 'branch')), 'Choose an existing family branch.');
    const familyId = or(get(h, 'family'), 'fam-' + sha256hex(signature).slice(0, 14));
    setdefault(families, familyId, { id: familyId, name: get(h, 'name', ''), ar: get(h, 'ar', ''), head: null });
    let branchId = get(h, 'branch');
    if (!truthy(branchId)) branchId = add(add(add('branch-', K(h, 'id')), '-'), sha256hex(encodable(familyId)).slice(0, 8));
    setdefault(branches, branchId, { id: branchId, family: familyId, name: get(h, 'town', ''), ar: get(h, 'townAr', '') });
    need(eq(K(branches.get(branchId), 'family'), familyId), 'The selected branch belongs to another main family.');
    Object.assign(h, { family: familyId, branch: branchId });
  }
  d.FAMILIES = families.values();
  d.BRANCHES = branches.values();
  for (const p of persons.values()) {
    if (!hh.has(get(p, 'hh'))) p.hh = null;
  }
  for (const h of hh.values()) {
    h.members = iter(K(h, 'members')).filter(p => persons.has(p));
    if (!has(h.members, get(h, 'head'))) h.head = null;
    for (const pid of h.members) persons.get(pid).hh = K(h, 'id');
  }
  for (const n of iter(K(d, 'NOTES'))) {
    setdefault(n, 'kind', 'note');
    setdefault(n, 'priority', 'ordinary');
    setdefault(n, 'pinned', false);
    setdefault(n, 'done', false);
    setdefault(n, 'due', '');
    setdefault(n, 'assignee', null);
  }
  for (const p of persons.values()) {
    if (eq(get(p, 'rite'), 'Latin')) p.rite = 'Roman Catholic';
    const extra = setdefault(K(d, 'PERSON_EXTRA'), K(p, 'id'), {});
    const legacyPref = `consent.${str(K(p, 'id'))}.1`;
    if (has(get(d, 'PREFS', {}), legacyPref)) {
      const prefs = K(d, 'PREFS');
      if (!isDict(prefs)) throw new PyError('list.pop() takes an integer');
      setItem(extra, 'legacyDirectoryPreference', pop(prefs, legacyPref));
      setItem(extra, 'directory', truthy(K(extra, 'legacyDirectoryPreference')));
    }
    setdefault(extra, 'directory', false);
  }
  for (const music of iter(get(d, 'MUSIC', []))) {
    if (eq(get(music, 'lang'), 'Latin')) music.lang = 'Roman liturgical';
  }
  for (const event of iter(K(d, 'EVENTS'))) {
    const detail = setdefault(K(d, 'EVENT_DETAIL'), K(event, 'id'), {
      organizer: null, tz: 'Asia/Beirut', cat: '', catAr: '', tags: [], desc: '', descAr: '',
      bring: [], tasks: [], files: [], rsvp: { yes: 0, no: 0, maybe: 0, none: 0 },
      cap: 0, waiting: 0, repeat: 'none', invited: [] });
    setdefault(detail, 'visibility', 'public');
    setdefault(detail, 'visibleGroupIds', []);
    setdefault(detail, 'priestIds', []);
    setdefault(detail, 'participants', []);
    setdefault(detail, 'subtype', eq(K(event, 'id'), 'ev11') && has(get(event, 'title', ''), 'Wedding') ? 'wedding' : '');
  }
  for (const form of iter(K(d, 'REGISTRATIONS'))) {
    setdefault(form, 'eventId', null);
    for (const key of ['fields', 'discounts', 'installments']) {
      const regForm = K(d, 'REG_FORM');
      setdefault(form, key, eq(K(form, 'id'), get(regForm, 'id')) ? deepcopy(get(regForm, key, [])) : []);
    }
  }
  const legacyForm = get(get(d, 'REG_FORM', {}), 'id');
  iter(K(d, 'REGISTRANTS')).forEach((row, index) => {
    setdefault(row, 'id', `legacy-registrant-${index + 1}`);
    setdefault(row, 'registrationId', any(K(d, 'REGISTRATIONS'), r => eq(K(r, 'id'), legacyForm)) ? legacyForm : null);
  });
  setdefault(K(d, 'CHECKIN'), 'eventId', null);
  setdefault(K(d, 'CHECKIN'), 'sessions', {});
  for (const extra of values(K(d, 'PERSON_EXTRA'))) pop(extra, 'preferred', null);
  const today = TODAY();
  for (const s of iter(K(d, 'SACRAMENTS'))) {
    setdefault(s, 'history', []);
    setdefault(s, 'revision', 1);
    if (!eq(get(s, 'kind'), 'certificate') && !isList(get(s, 'preparation', []))) s.preparation = [];
    if (!eq(get(s, 'kind'), 'certificate') && eq(get(s, 'status'), 'awaiting-signature') && gt(slice(str(get(s, 'date', '')), 0, 10), today))
      s.status = 'scheduled';
    if (!eq(get(s, 'kind'), 'certificate') && eq(get(s, 'status'), 'approved')) s.status = 'registered';
  }
  return d;
}

/* family_id.encode(): only str has .encode() */
function encodable(value) {
  if (typeof value !== 'string') throw new PyError("object has no attribute 'encode'");
  return value;
}

/* ---- urllib.parse.urlsplit, enough for validate()'s music links ------------- */
const C0_OR_SPACE = /^[\x00-\x20]+/;
const SCHEME_CHARS = /^[A-Za-z0-9+\-.]+$/;
function checkBracketedHost(host) {
  if (host.startsWith('v')) {
    if (!/^v[a-fA-F0-9]+\..+$/s.test(host)) throw new PyError('IPvFuture address is invalid');
    return;
  }
  if (!isIPv6(host.split('%')[0]) || (host.includes('%') && !host.split('%')[1])) throw new PyError('does not appear to be an IPv4 or IPv6 address');
}
function isIPv4(text) {
  const parts = text.split('.');
  return parts.length === 4 && parts.every(p => /^[0-9]{1,3}$/.test(p) && Number(p) <= 255 && (p === '0' || !p.startsWith('0')));
}
function isIPv6(text) {
  if (!text || !/^[0-9A-Fa-f:.]+$/.test(text)) return false;
  let tail = 0, body = text;
  const lastColon = text.lastIndexOf(':');
  if (text.slice(lastColon + 1).includes('.')) {
    if (!isIPv4(text.slice(lastColon + 1))) return false;
    tail = 2;
    body = text.slice(0, lastColon + 1) + '0';
  }
  const halves = body.split('::');
  if (halves.length > 2) return false;
  const groups = h => (h === '' ? [] : h.split(':'));
  const head = groups(halves[0]), rest = halves.length === 2 ? groups(halves[1]) : [];
  const all = [...head, ...rest];
  if (!all.every(g => /^[0-9A-Fa-f]{1,4}$/.test(g))) return false;
  const count = all.length + tail - (tail ? 1 : 0);
  return halves.length === 2 ? count < 8 : count === 8;
}
export function urlsplit(url) {
  url = url.replace(C0_OR_SPACE, '').replace(/[\t\r\n]/g, '');
  let scheme = '';
  const i = url.indexOf(':');
  if (i > 0 && /^[A-Za-z]$/.test(url[0]) && SCHEME_CHARS.test(url.slice(0, i))) {
    scheme = url.slice(0, i).toLowerCase();
    url = url.slice(i + 1);
  }
  let netloc = '';
  if (url.startsWith('//')) {
    let end = url.length;
    for (const ch of '/?#') {
      const at = url.indexOf(ch, 2);
      if (at >= 0) end = Math.min(end, at);
    }
    netloc = url.slice(2, end);
    if ((netloc.includes('[') && !netloc.includes(']')) || (netloc.includes(']') && !netloc.includes('['))) throw new PyError('Invalid IPv6 URL');
    if (netloc.includes('[') && netloc.includes(']')) {
      const bracketed = netloc.split('[').slice(1).join('[').split(']')[0];
      checkBracketedHost(bracketed);
    }
  }
  const at = netloc.lastIndexOf('@');
  let username = null, password = null;
  if (at >= 0) {
    const userinfo = netloc.slice(0, at), colon = userinfo.indexOf(':');
    username = colon >= 0 ? userinfo.slice(0, colon) : userinfo;
    password = colon >= 0 ? userinfo.slice(colon + 1) : null;
  }
  const hostinfo = at >= 0 ? netloc.slice(at + 1) : netloc;
  let host;
  const open = hostinfo.indexOf('[');
  if (open >= 0) host = hostinfo.slice(open + 1).split(']')[0];
  else host = hostinfo.split(':')[0];
  let hostname = null;
  if (host) {
    const pct = host.indexOf('%');
    hostname = pct >= 0 ? host.slice(0, pct).toLowerCase() + host.slice(pct) : host.toLowerCase();
  }
  return { scheme, netloc, hostname, username, password };
}

function index(d, key) {
  const rows = K(d, key);
  need(isList(rows) && all(rows, x => isDict(x) && isStr(get(x, 'id'))), 'Invalid ' + key);
  const result = keyed(rows, x => K(x, 'id'));
  need(result.size === rows.length, 'Duplicate IDs in ' + key);
  return result;
}

const TIME = /^(?:[01]\p{Nd}|2[0-3]):[0-5]\p{Nd}$/u;

export function validate(d) {
  const pp = index(d, 'PEOPLE');
  for (const [k, v] of index(d, 'ARCHIVED').entries()) pp.set(k, v);
  const content = get(d, 'CONTENT', {});
  need(isDict(content), 'Invalid parish content.');
  for (const [key, item] of items(content)) {
    need(isStr(key) && len(key) <= 60 && isDict(item)
      && all(['en', 'ar'], lang => isStr(get(item, lang, '')) && len(get(item, lang, '')) <= 10000)
      && isBool(get(item, 'published', true)), 'Invalid parish content.');
  }
  const hh = index(d, 'HOUSEHOLDS'), ff = index(d, 'FAMILIES'), bb = index(d, 'BRANCHES'), gg = index(d, 'GROUPS');
  for (const b of bb.values()) need(ff.has(get(b, 'family')), 'A branch must belong to an existing family.');
  const seen = new Set();
  for (const h of hh.values()) {
    const members = get(h, 'members', []);
    need(len(set(members)) === len(members) && !intersects(set(members), seen), 'A person can belong to only one household.');
    for (const m of set(members)) seen.add(m);
    need(!truthy(get(h, 'head')) || has(members, K(h, 'head')), 'The designated head must be a household member.');
    need(ff.has(get(h, 'family')) && bb.has(get(h, 'branch')) && eq(K(bb.get(K(h, 'branch')), 'family'), K(h, 'family')), 'Choose a branch of this main family.');
    for (const pid of iter(members)) need(pp.has(pid) && eq(get(pp.get(pid), 'hh'), K(h, 'id')), 'Household membership links must agree.');
  }
  for (const p of pp.values()) {
    need(!truthy(get(p, 'hh')) || (hh.has(K(p, 'hh')) && has(K(hh.get(K(p, 'hh')), 'members'), K(p, 'id'))), 'Invalid household link.');
    const rel = get(p, 'relativeTo');
    need(!truthy(rel) || (!eq(rel, K(p, 'id')) && truthy(get(p, 'hh')) && has(K(K(hh, K(p, 'hh')), 'members'), rel)),
      'The related person must be another member of this household.');
  }
  for (const [pid, extra] of items(K(d, 'PERSON_EXTRA'))) {
    need(pp.has(pid), 'Person details must belong to an existing person.');
    need(isStr(get(extra, 'occupation', '')) && len(get(extra, 'occupation', '')) <= 120, 'Invalid line of work.');
    need(isList(get(extra, 'skills', [])) && len(get(extra, 'skills', [])) <= 60 &&
      all(get(extra, 'skills', []), skill => isStr(skill) && len(skill) > 0 && len(skill) <= 80), 'Invalid skills.');
    const address = get(extra, 'address');
    if (!isDict(address) || !any(['governorate', 'district', 'town', 'sector'], k => get(address, k))) continue;
    const gov = next(GEOGRAPHY, g => eq(g.id, get(address, 'governorate')));
    const district = gov ? next(gov.districts, x => eq(x.id, get(address, 'district'))) : null;
    const town = district ? next(district.towns, x => eq(x.id, get(address, 'town'))) : null;
    need(gov && district && town && (!truthy(get(address, 'sector')) || has(set(town.sectors.map(x => x.id)), K(address, 'sector'))),
      'Choose a valid Governorate, District, Town, and Sector combination.');
  }
  const serviceIds = new Set();
  const serviceStages = new Set(['pending', 'approved', 'preparing', 'ready', 'celebrated', 'rejected']);
  for (const request of iter(K(d, 'SERVICE_REQUESTS'))) {
    const rid = get(request, 'id');
    need(isStr(rid) && truthy(rid) && !serviceIds.has(rid), 'Service requests need unique IDs.');
    serviceIds.add(rid);
    need(pp.has(get(request, 'by')) && isoDate(get(request, 'date')) && has(serviceStages, get(request, 'status')), 'Invalid service request.');
    if (truthy(get(request, 'time'))) need(isStr(K(request, 'time')) && TIME.test(K(request, 'time')), 'Invalid service time.');
    need(!truthy(get(request, 'venue')) || any(K(d, 'VENUES'), v => eq(K(v, 'id'), K(request, 'venue'))), 'Invalid service venue.');
    need(all([['contact', 160], ['purpose', 240], ['notes', 1000]], ([field, limit]) => isStr(get(request, field, '')) && len(get(request, field, '')) <= limit),
      'Invalid service details.');
    const documents = get(request, 'documents', {});
    need(isDict(documents) && all(items(documents), ([k, v]) => isStr(k) && len(k) <= 120 && isBool(v)), 'Invalid service documents.');
  }
  const music = K(d, 'MUSIC');
  for (const [gid, detail] of items(K(d, 'GROUP_DETAIL'))) {
    need(gg.has(gid), 'Group assignments must use an existing parish group.');
    const roster = get(detail, 'roster', []);
    need(all(roster, r => pp.has(get(r, 'p'))) && len(set(iter(roster).map(r => K(r, 'p')))) === len(roster), 'Invalid or duplicate group membership.');
    need(all(get(detail, 'posts', []), post => isDict(post) && pp.has(get(post, 'by')) &&
      isStr(get(post, 'body', '')) && len(get(post, 'body', '')) <= 12000 &&
      isStr(get(post, 'html', '')) && len(get(post, 'html', '')) <= 12000), 'Invalid group post.');
    const meetingIds = new Set();
    for (const meeting of iter(get(detail, 'meetings', []))) {
      const mid = get(meeting, 'id');
      need(isStr(mid) && truthy(mid) && !meetingIds.has(mid), 'Group meetings need unique IDs.');
      meetingIds.add(mid);
      const participants = get(meeting, 'participants', []);
      need(isList(participants) && participants.length === len(set(participants)) && subset(set(participants), pp),
        'Meeting participants must be people in this parish.');
      const attendance = get(meeting, 'attendance', {});
      need(isDict(attendance) && subset(set(attendance), pp) &&
        all(values(attendance), value => has(new Set(['present', 'excused', 'absent']), value)),
        'Attendance must reference people in this parish and valid statuses.');
    }
    const resources = get(detail, 'belongings', []);
    need(isList(resources) && all(resources, r => isDict(r) && isStr(get(r, 'id')) && truthy(get(r, 'id'))
      && isStr(get(r, 'name')) && truthy(strip(K(r, 'name'))) && isInt(get(r, 'qty')) && ge(K(r, 'qty'), 0)
      && all([['ar', 200], ['code', 80], ['description', 500], ['location', 200], ['locationAr', 200]],
        ([field, limit]) => isStr(get(r, field, '')) && len(get(r, field, '')) <= limit)
      && has(new Set(['good', 'fair', 'repair', 'damaged']), get(r, 'condition', 'good')))
      && len(set(resources.map(r => K(r, 'id')))) === resources.length, 'Invalid ministry resources.');
    const resourceIds = set(resources.map(r => K(r, 'id')));
    const loans = get(detail, 'resourceLoans', []);
    need(isList(loans) && all(loans, l => isDict(l) && isStr(get(l, 'id')) && truthy(K(l, 'id'))
      && has(resourceIds, get(l, 'resourceId'))
      && isStr(get(l, 'borrower')) && truthy(strip(K(l, 'borrower')))
      && isInt(get(l, 'qty')) && gt(K(l, 'qty'), 0)
      && isoDate(get(l, 'due')) && isoDate(get(l, 'checkedOutAt'))
      && ge(K(l, 'due'), K(l, 'checkedOutAt')) && (!truthy(get(l, 'returnedAt')) || isoDate(K(l, 'returnedAt'))))
      && len(set(loans.map(l => K(l, 'id')))) === loans.length, 'Invalid ministry resource loan.');
    for (const resource of resources) {
      need(le(sum(loans.filter(l => eq(K(l, 'resourceId'), K(resource, 'id')) && !truthy(get(l, 'returnedAt'))).map(l => K(l, 'qty'))),
        K(resource, 'qty')), 'A ministry resource cannot be loaned beyond its quantity.');
    }
    const milestones = get(detail, 'milestones', []);
    need(isList(milestones) && all(milestones, m => isDict(m) && isStr(get(m, 'id')) && truthy(get(m, 'id'))
      && isStr(get(m, 'name')) && truthy(strip(K(m, 'name'))) && isDict(get(m, 'completions'))
      && subset(set(K(m, 'completions')), pp)
      && all(values(K(m, 'completions')), record => isDict(record) && isoDate(get(record, 'date')) && isStr(get(record, 'notes', '')))
      && isInt(get(m, 'legacyCount', 0)) && ge(get(m, 'legacyCount', 0), 0))
      && len(set(milestones.map(m => K(m, 'id')))) === milestones.length, 'Invalid ministry formation milestone.');
    for (const meeting of iter(get(detail, 'meetings', []))) {
      const hymnIds = get(meeting, 'hymns', []);
      need(isList(hymnIds) && all(hymnIds, mid => isStr(mid)) && len(set(hymnIds)) === hymnIds.length
        && subset(set(hymnIds), set(iter(music).map(item => K(item, 'id')))), 'Meeting music must use hymns in the library.');
    }
  }
  for (const hymn of iter(music)) {
    for (const [field, hosts] of [['youtubeUrl', ['youtube.com', 'youtu.be']], ['anghamiUrl', ['anghami.com']], ['otherUrl', null]]) {
      const value = get(hymn, field, '');
      if (!truthy(value)) continue;
      need(isStr(value), 'Invalid music link.');
      let url;
      try { url = urlsplit(value); }
      catch { throw new PyError('Problem() missing 1 required positional argument'); }
      const hostname = (url.hostname || '').toLowerCase();
      need(url.scheme === 'https' && hostname && !truthy(url.username) && !truthy(url.password)
        && (hosts === null || hosts.some(host => hostname === host || hostname.endsWith('.' + host))),
        'Music links must use HTTPS and the selected provider.');
    }
  }
  const volunteerIds = set(iter(K(d, 'VOLUNTEERS')).map(v => get(v, 'p')));
  for (const notice of iter(K(d, 'NOTICES'))) {
    need(!truthy(get(notice, 'groupId')) || gg.has(K(notice, 'groupId')), 'Notice group must exist in this parish.');
  }
  for (const sheet of iter(K(d, 'SIGNUP_SHEETS'))) {
    const participants = get(sheet, 'people', []);
    need(isList(participants) && participants.length === len(set(participants))
      && subset(set(participants), volunteerIds)
      && isInt(get(sheet, 'slots')) && gt(K(sheet, 'slots'), 0)
      && isInt(get(sheet, 'taken')) && le(participants.length, K(sheet, 'taken')) && le(K(sheet, 'taken'), K(sheet, 'slots')),
      'Sign-up sheet participants and capacity are invalid.');
  }
  const plans = index(d, 'SERVICE_PLANS');
  need(!plans.has(get(K(d, 'SERVICE'), 'id')), 'Service plan IDs must be unique.');
  for (const plan of [K(d, 'SERVICE'), ...plans.values()]) {
    need(isStr(get(plan, 'title')) && truthy(strip(K(plan, 'title')))
      && isList(get(plan, 'order')) && all(K(plan, 'order'), item => isDict(item) && truthy(get(item, 't'))),
      'A service plan needs a title and valid order of service.');
  }
  for (const template of index(d, 'EVENT_TEMPLATES').values()) {
    need(isStr(get(template, 'name')) && truthy(strip(K(template, 'name')))
      && has(new Set(['event', 'mass', 'group', 'sacr', 'pending']), get(template, 'kind')),
      'Calendar templates need a name and valid category.');
  }
  for (const template of index(d, 'SERVICE_TEMPLATES').values()) {
    need(isStr(get(template, 'name')) && truthy(strip(K(template, 'name')))
      && isList(get(template, 'order')) && all(K(template, 'order'), item => isDict(item) && truthy(get(item, 't'))),
      'Service templates need a name and valid order of service.');
  }
  for (const n of iter(K(d, 'NOTES'))) {
    need(has(new Set(['note', 'task']), get(n, 'kind')) && has(new Set(['ordinary', 'attention', 'urgent']), get(n, 'priority'))
      && isBool(get(n, 'pinned')) && isBool(get(n, 'done'))
      && isStr(get(n, 'body')) && truthy(strip(K(n, 'body')))
      && (pp.has(get(n, 'p')) || (eq(K(n, 'kind'), 'task') && !truthy(get(n, 'p'))))
      && isStr(get(n, 'due')), 'A pastoral item needs valid content, priority, and person if it is a note.');
    need(!truthy(get(n, 'assignee')) || (eq(K(n, 'kind'), 'task') && pp.has(K(n, 'assignee')) && eq(get(pp.get(K(n, 'assignee')), 'status'), 'clergy')),
      'Task assignee must be clergy in this parish.');
  }
  const events = index(d, 'EVENTS');
  const clergy = set(pp.values().filter(p => eq(get(p, 'status'), 'clergy')).map(p => K(p, 'id')));
  for (const [eid, detail] of items(K(d, 'EVENT_DETAIL'))) {
    need(events.has(eid) && has(new Set(['public', 'groups', 'confidential']), get(detail, 'visibility', 'public')), 'Invalid event visibility.');
    const groupIds = get(detail, 'visibleGroupIds', []);
    need(isList(groupIds) && subset(set(groupIds), gg) && (!eq(get(detail, 'visibility'), 'groups') || truthy(groupIds)),
      'Select existing groups for restricted event visibility.');
    need(subset(set(get(detail, 'priestIds', [])), clergy), 'Mass assignments must use clergy in this parish.');
  }
  const registrationIds = new Set();
  for (const form of iter(K(d, 'REGISTRATIONS'))) {
    need(!has(registrationIds, get(form, 'id')), 'Duplicate registration form.');
    registrationIds.add(K(form, 'id'));
    const eventId = get(form, 'eventId');
    need(!truthy(eventId) || (events.has(eventId) && !eq(get(events.get(eventId), 'kind'), 'mass')
      && !truthy(get(events.get(eventId), 'feastLiturgy')) && !truthy(get(events.get(eventId), 'liturgy'))),
      'Registration requires an eligible event, not a Mass or feast liturgy.');
  }
  const registrantIds = new Set();
  for (const row of iter(K(d, 'REGISTRANTS'))) {
    need(isStr(get(row, 'id')) && !registrantIds.has(K(row, 'id')) && pp.has(get(row, 'p'))
      && isNumber(get(row, 'paid', 0)) && le(0, get(row, 'paid', 0)) && le(get(row, 'paid', 0), 1000000)
      && isBool(get(row, 'consent', false))
      && has(new Set(['awaiting-approval', 'pending', 'paid', 'registered', 'cancelled']), get(row, 'status')),
      'Invalid participant registration.');
    registrantIds.add(K(row, 'id'));
    const payments = get(row, 'payments', []);
    need(isList(payments) && all(payments, payment => isDict(payment)
      && isNumber(get(payment, 'amount')) && gt(K(payment, 'amount'), 0) && le(K(payment, 'amount'), 1000000)
      && has(new Set(['cash', 'bank', 'omt']), get(payment, 'method'))
      && isStr(get(payment, 'at')) && isStr(get(payment, 'by'))), 'Invalid registration payment history.');
    need(!truthy(get(row, 'registrationId')) || has(registrationIds, K(row, 'registrationId')),
      'Registrant must belong to an existing registration form.');
  }
  for (const [eid, session] of items(get(K(d, 'CHECKIN'), 'sessions', {}))) {
    need(events.has(eid) && !eq(get(events.get(eid), 'kind'), 'mass') && !truthy(get(events.get(eid), 'feastLiturgy'))
      && !truthy(get(events.get(eid), 'liturgy'))
      && eq(get(session, 'eventId'), eid) && any(K(d, 'REGISTRATIONS'), f => eq(get(f, 'eventId'), eid)),
      'Check-in requires a registered, eligible event.');
    const eligible = set(iter(K(d, 'REGISTRANTS')).filter(row => any(K(d, 'REGISTRATIONS'),
      form => eq(K(form, 'id'), get(row, 'registrationId')) && eq(get(form, 'eventId'), eid))).map(row => get(row, 'p')));
    const rows = get(session, 'rows', []);
    need(all(rows, row => has(eligible, get(row, 'p'))) && len(set(iter(rows).map(row => get(row, 'p')))) === len(rows),
      'Only registered participants may be checked in, once per event.');
  }
  const refs = new Set();
  for (const s of iter(K(d, 'SACRAMENTS'))) {
    need(pp.has(get(s, 'person')) && truthy(get(s, 'reg')) && !has(refs, K(s, 'reg')), 'Sacrament person/reference is invalid or duplicated.');
    refs.add(K(s, 'reg'));
  }
  const records = keyed(K(d, 'SACRAMENTS'), s => K(s, 'id'));
  const today = TODAY();
  for (const s of iter(K(d, 'SACRAMENTS'))) {
    if (!eq(get(s, 'kind'), 'certificate') && has(new Set(['draft', 'awaiting-signature', 'registered', 'issued']), get(s, 'status')))
      need(le(slice(str(get(s, 'date', '')), 0, 10), today), 'Future sacraments must remain scheduled until their date.');
    if (eq(get(s, 'kind'), 'certificate') && truthy(get(s, 'requestedSacramentId'))) {
      const planned = records.get(K(s, 'requestedSacramentId'));
      need(planned !== null && !eq(get(planned, 'kind'), 'certificate') && eq(get(planned, 'person'), get(s, 'person')),
        'The planned sacrament must belong to the certificate subject.');
    }
    if (eq(get(s, 'kind'), 'certificate') && truthy(get(s, 'sourceRecordId'))) {
      const source = records.get(K(s, 'sourceRecordId'));
      need(source !== null && !eq(K(source, 'kind'), 'certificate') && eq(K(source, 'person'), K(s, 'person'))
        && has(new Set(['registered', 'issued']), K(source, 'status')),
        'Certificate source must be an official register entry for the same person.');
    }
  }
}

export function writable(role, key) {
  if (role === 'bishop' || role === 'member') return false;
  if (READONLY.has(key)) return false;
  if (CLERGY.has(role)) return true;
  if (key === 'NOTIFICATIONS' || key === 'PREFS') return true;
  if (role === 'secretary') return OFFICE.has(key);
  if (role === 'treasurer') return FINANCE.has(key) || key === 'RATE';
  if (role === 'leader') return ['GROUP_DETAIL', 'MUSIC', 'MUSIC_DETAIL', 'SETLISTS', 'CHECKIN', 'PICKUP'].includes(key);
  return false;
}

export { Problem };
