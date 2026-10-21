/* Sacrament and certificate requests from the member portal, ported from server.py
   (request_subjects, sacrament_conflict, request_subject_key, member_request_progress,
   member_request_item, member_request_options). */
import { truthy, eq, has, get, K, iter, len, set, add, sorted, next, keyed, casefold, isDict, or, str, ge, TODAY } from './py.js';

export const REQUEST_LABELS = { baptism: 'Baptism', communion: 'First Communion', confirmation: 'Confirmation',
  marriage: 'Marriage', funeral: 'Funeral', certificate: 'Certificate', booking: 'Booking', custom: 'General' };  // "General request not accepted"
export const OWN_REQUESTS = new Set(['booking', 'custom']); // asked by the member for themselves, not for a household member
const BOOKABLE = new Set(['Hall', 'Room', 'Outdoor']);
export const CLOCK = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const CERTIFICATE_OF = ['baptism', 'communion', 'confirmation', 'marriage'];
export const CERTIFICATE_LANGUAGES = ['bilingual', 'arabic', 'english'];
const ONCE_ONLY = new Set(['baptism', 'communion', 'confirmation', 'funeral']);
export const ACTIVE_ENTRY = new Set(['requested', 'office-reviewed', 'preparing', 'scheduled', 'draft', 'awaiting-signature']);
export const OFFICIAL_ENTRY = new Set(['registered', 'issued']);
const PROGRESS_EVENTS = { 'request accepted for preparation': 'priest-accepted', 'preparation completed': 'prepared',
  'sacrament celebrated': 'celebrated', approve: 'approved', issue: 'issued', 'bishop accepted': 'bishop-accepted',
  'request declined': 'declined', reject: 'declined',
  'preparation cancelled': 'cancelled', cancelled: 'cancelled' };
const CERTIFICATE_STAGES = { approved: 'signing', issued: 'ready', rejected: 'declined', cancelled: 'cancelled' };
const SACRAMENT_STAGES = { preparing: 'preparing', scheduled: 'scheduled', draft: 'celebrated', 'awaiting-signature': 'celebrated',
  registered: 'completed', issued: 'completed', rejected: 'declined', cancelled: 'cancelled' };

/* The member, then everyone who shares a household with them. */
export function request_subjects(d, person) {
  const people = keyed(K(d, 'PEOPLE'), p => K(p, 'id'));
  const ids = has(people, get(person, 'id')) ? [K(person, 'id')] : [];
  for (const household of iter(K(d, 'HOUSEHOLDS'))) {
    if (ids.length && has(get(household, 'members', []), ids[0])) {
      const extra = iter(K(household, 'members')).filter(m => has(people, m) && !has(ids, m));
      ids.push(...extra);
    }
  }
  return ids.map(i => K(people, i));
}

/* Why this sacrament cannot be requested for this person now, or ''. */
export function sacrament_conflict(d, personId, kind) {
  const records = iter(K(d, 'SACRAMENTS')).filter(s => eq(get(s, 'person'), personId) && eq(get(s, 'kind'), kind));
  if (has(ONCE_ONLY, kind) && records.some(s => has(OFFICIAL_ENTRY, get(s, 'status'))))
    return 'This is already recorded in the parish register.' + (kind === 'funeral' ? '' : ' You can request a certificate instead.');
  if (records.some(s => has(ACTIVE_ENTRY, get(s, 'status')))) return 'The parish office is already preparing this for this person.';
  return '';
}

export function request_subject_key(kind, details) {
  if (kind === 'booking') return ['booking', K(details, 'venue'), K(details, 'date'), K(details, 'from')].join(':');
  if (kind === 'custom') return 'custom:' + casefold(K(details, 'subject'));
  const child = get(details, 'child');
  const who = !truthy(child) ? K(details, 'personId') : 'child:' + casefold(K(child, 'lat')) + ':' + K(child, 'born');
  return kind + ':' + get(details, 'certificateOf', '') + ':' + who;
}

/* Where a parishioner's request stands, in terms the parishioner can follow. */
export function member_request_progress(d, row, details) {
  const s = truthy(row.sacrament_id) ? next(K(d, 'SACRAMENTS'), x => eq(K(x, 'id'), row.sacrament_id)) : null;
  const events = [{ key: 'submitted', at: row.created_at }];
  let logged = JSON.parse(row.log || '[]');
  if (!logged.length && row.status !== 'submitted') logged = [{ key: row.status, at: row.updated_at }]; // handled before steps were logged
  events.push(...logged.map(entry => ({ key: entry.key, at: entry.at })));
  let stage = 'received', reason = '', register = '', planned = '', plannedTime = '', preparation = [];
  if (row.status === 'declined') {
    stage = 'declined'; reason = row.response;
  } else if (row.status === 'withdrawn') {
    stage = 'withdrawn';
  } else if (row.status === 'completed') {
    stage = 'completed';
  } else if (row.status === 'accepted' && row.kind === 'custom') {
    stage = 'inprogress';
  } else if (row.status === 'accepted' && row.kind === 'booking') {
    const booking = next(K(d, 'RESERVATIONS'), x => eq(K(x, 'id'), row.sacrament_id));
    stage = booking === null ? 'cancelled' : get({ approved: 'confirmed', rejected: 'declined' }, get(booking, 'status'), 'review');
    for (const entry of iter(get(booking ?? {}, 'history', []))) {
      const key = get({ approve: 'confirmed', reject: 'declined' }, get(entry, 'action'));
      if (truthy(key)) events.push({ key, at: get(entry, 'at', '') });
      if (key === 'declined' && truthy(get(entry, 'reason'))) reason = K(entry, 'reason');
    }
  } else if (row.status === 'accepted') {
    stage = 'review';
    if (s !== null) {
      const status = get(s, 'status'), certificate = eq(get(s, 'kind'), 'certificate');
      if (certificate) {
        stage = get(CERTIFICATE_STAGES, status, 'review');
        const acceptance = get(get(s, 'acceptance') ?? {}, 'status');
        if (status === 'approved' && (acceptance === 'awaiting' || acceptance === 'accepted')) stage = acceptance === 'awaiting' ? 'acceptance' : 'accepted';
      } else {
        stage = get(SACRAMENT_STAGES, status, 'review');
        if (truthy(get(s, 'date')) && (has(set(['scheduled', 'celebrated', 'completed']), stage) || !eq(K(s, 'date'), get(details, 'date', ''))))
          { planned = K(s, 'date'); plannedTime = get(s, 'time', ''); }
        if (has(OFFICIAL_ENTRY, status)) register = get(s, 'reg', '');
        const requirements = get(get(d, 'PREP_REQUIREMENTS', {}), get(s, 'kind'), []);
        if (has(set(['preparing', 'scheduled']), status)) {
          const done = or(get(s, 'preparation'), []);
          preparation = iter(requirements).map((item, index) => ({ en: K(item, 0), ar: K(item, 1), required: truthy(K(item, 2)),
            done: index < len(done) && truthy(K(done, index)) }));
        }
      }
      for (const entry of iter(get(s, 'history', []))) {
        let key = get(PROGRESS_EVENTS, get(entry, 'action'));
        if (!truthy(key)) continue;
        if (key === 'approved' && !certificate) key = 'registered';
        events.push({ key, at: get(entry, 'at', '') });
        if (has(set(['declined', 'cancelled']), key) && truthy(get(entry, 'reason'))) reason = K(entry, 'reason');
      }
    }
  }
  return { stage, preferredDate: get(details, 'date', ''), plannedDate: planned, plannedTime, register, preparation, reason, events };
}

export function member_request_item(d, row) {
  const details = JSON.parse(row.details);
  let subject;
  if (truthy(get(details, 'child'))) {
    subject = { id: '', lat: K(K(details, 'child'), 'lat'), ar: K(K(details, 'child'), 'ar'), new: true };
  } else {
    const p = next(add(K(d, 'PEOPLE'), K(d, 'ARCHIVED')), x => eq(K(x, 'id'), K(details, 'personId'))) ?? {};
    subject = { id: K(details, 'personId'), lat: get(p, 'lat', ''), ar: get(p, 'ar', ''), new: false };
  }
  return { id: row.id, reference: row.reference, kind: row.kind, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at, response: row.response,
    subject, details, progress: member_request_progress(d, row, details), canWithdraw: row.status === 'submitted' };
}

export function member_request_options(d, person) {
  const subjects = [];
  for (const p of request_subjects(d, person)) {
    const entries = iter(K(d, 'SACRAMENTS')).filter(s => eq(get(s, 'person'), K(p, 'id')) && !eq(get(s, 'kind'), 'certificate'));
    subjects.push({ id: K(p, 'id'), lat: get(p, 'lat', ''), ar: get(p, 'ar', ''), self: eq(K(p, 'id'), K(person, 'id')),
      onRecord: sorted([...set(entries.filter(s => has(OFFICIAL_ENTRY, get(s, 'status'))).map(s => K(s, 'kind')))]),
      inProgress: sorted([...set(entries.filter(s => has(ACTIVE_ENTRY, get(s, 'status'))).map(s => K(s, 'kind')))]) });
  }
  const contact = get(get(d, 'CONTENT', {}), 'contact');
  const phone = isDict(contact) && truthy(get(contact, 'published', true)) ? get(K(d, 'PARISH'), 'phone', '') : '';
  const venues = bookable_venues(d).map(v => ({ id: K(v, 'id'), name: get(v, 'name', ''), ar: get(v, 'ar', ''), cap: get(v, 'cap', 0),
    kind: get(v, 'kind', ''), kindAr: get(v, 'kindAr', '') }));
  const busy = sorted(iter(K(d, 'RESERVATIONS')).filter(r => has(set(['pending', 'approved']), get(r, 'status')) && ge(str(get(r, 'date', '')), TODAY()))
    /* a booking holds its place from the start of its set-up time */
    .map(r => ({ venue: K(r, 'venue'), date: K(r, 'date'), from: clock(Math.max(0, minutes(K(r, 'from')) - Math.trunc(setup_minutes(r)))), to: K(r, 'to'), status: K(r, 'status') })),
  r => [r.date, r.from, r.venue]).slice(0, 400);
  return { subjects, preparation: get(d, 'PREP_REQUIREMENTS', {}), phone, venues, busy };
}

/* Halls, rooms and outdoor spaces a parishioner can ask to book; churches and service rooms are arranged with the office. */
export const bookable_venues = d => iter(K(d, 'VENUES')).filter(v => has(BOOKABLE, get(v, 'kind')));

export const minutes = clock => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
const clock = total => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
const setup_minutes = r => { const value = get(r, 'setup'); return typeof value === 'number' && value > 0 ? value : 0; };

/* The first reservation of this place that overlaps the time, counting its set-up buffer. */
export function booking_clash(d, venue, date, start, end, statuses = new Set(['approved'])) {
  return next(K(d, 'RESERVATIONS'), r => has(statuses, get(r, 'status')) && eq(get(r, 'venue'), venue) && eq(get(r, 'date'), date)
    && minutes(K(r, 'from')) - setup_minutes(r) < minutes(end) && minutes(start) < minutes(K(r, 'to')));
}
