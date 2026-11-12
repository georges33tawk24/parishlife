/* Purpose: the Facilities module's connection to ParishLife.Api: rooms and spaces, buffered availability,
   room reservations and their decisions, equipment, facility issues and external rentals.
   Main members: keys, routes, load (fills the collections), save (every change here goes through the
   functions below, so a direct edit of the view model is reported as not saved), and the writes the screens
   call: saveFacility, setFacilityStatus, availability, requestRoom, decideReservation, requestableEvents,
   saveEquipment, equipmentBookings, bookEquipment, equipmentBookingAction, reportIssue, issueAction,
   rentalRenters, createRenter, proposeRental. Routes and shapes: docs/frontend-modules/facilities.md.

   Facts the API does not have are left empty, never invented: a room's Arabic name, step-free access and
   photos; a maintenance block's dates and reason (the API takes a room out of service, with a reason it
   records but does not return); who reported an issue (an account, not a person); a reservation's group,
   hold expiry and checklist. The parish has no time zone in the API, so times show on the clock of the
   calendar event the reservation belongs to (the viewer's own clock where there is none). */
import { api, parishAPI, newOperationId, session } from '../api.js';

export const keys = ['VENUES', 'EQUIPMENT', 'RESERVATIONS', 'MAINTENANCE', 'ISSUES', 'RENTALS'];
export const routes = ['facilities', 'reservations'];

/* Which areas this account may not read here (403 or 404): the screens say so instead of "nothing yet".
   An authenticator sign-in is required by the equipment, issue and rental routes. */
export const denied = new Set();

const KIND_AR = { Room: 'غرفة', Space: 'مساحة' };
const DAY = 86400000;

/* ---------- reading ---------- */

const here = parish => `parishes/${encodeURIComponent(parish.id)}/`;
/* the parish the portal is showing */
const mine = () => here({ id: session.parishId });

/* Every page of a Scheduling list (these routes page with size and cursor, up to 100 a page). */
async function pages(path, limit = 3000) {
  const items = [];
  let cursor = '';
  do {
    const page = await api(
      path + (path.includes('?') ? '&' : '?') + 'size=100' + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '')
    );
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}

/* Run a read; a refusal (not allowed here, or needs the authenticator) leaves that area empty. */
async function tolerant(area, read, fallback = []) {
  try {
    return await read();
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      denied.add(area);
      return fallback;
    }
    throw error;
  }
}

/* The API lists at most 31 days at a time: the 31 before today and the 31 after. */
function windows(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const at = n => new Date(start.getTime() + n * DAY).toISOString();
  return [
    [at(-31), at(0)],
    [at(0), at(31)]
  ];
}
const query = ([start, end]) => `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

/* A moment as the calendar date and time on a clock; `zone` empty means the viewer's own clock. */
export function clock(iso, zone) {
  const date = new Date(iso);
  if (Number.isNaN(+date)) return { date: '', time: '', minutes: 0 };
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      ...(zone ? { timeZone: zone } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);
  } catch {
    return clock(iso, '');
  }
  const get = type => parts.find(p => p.type === type)?.value || '00';
  const time = `${get('hour')}:${get('minute')}`;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time,
    minutes: Number(get('hour')) * 60 + Number(get('minute'))
  };
}

const toVenue = ({ value: f, version }) => ({
  id: f.id,
  name: f.name,
  ar: f.name,
  cap: f.capacity,
  kind: f.kind,
  kindAr: KIND_AR[f.kind] || f.kind,
  setup: f.setupMinutes,
  cleanup: f.cleanupMinutes,
  status: f.status,
  exclusions: f.exclusionResourceIds || [],
  desc: f.publicDescription || '',
  version
});

/* A room that is not serviceable is the portal's "blocked" room. */
const toBlock = v => ({ id: v.id, venue: v.id, from: '', to: '', why: '', by: null, status: v.status });

const condition = status =>
  status === 'Serviceable' ? 'good' : status === 'OutOfService' ? 'needs service' : 'retired';
const toEquipment = ({ value: e, version }) => ({
  id: e.id,
  name: e.name,
  ar: e.name,
  qty: e.quantity,
  out: 0,
  cond: condition(e.status),
  status: e.status,
  note: e.condition || '',
  storage: e.storage || '',
  custody: [],
  updatedAt: e.updatedAt,
  version
});

const toIssue = ({ value: i, version }) => ({
  id: i.id,
  venue: i.resourceId,
  kind: i.resourceKind,
  what: i.description,
  whatAr: i.description,
  urgency: i.urgency,
  evidence: i.evidence || '',
  status: i.status,
  by: null,
  reportedBy: i.reportedBy,
  at: String(i.reportedAt || '').slice(0, 10),
  reportedAt: i.reportedAt,
  assignedTo: i.assignedTo || '',
  triageNote: i.triageNote || '',
  resolvedAt: i.resolvedAt || '',
  resolutionEvidence: i.resolutionEvidence || '',
  costNote: i.costNote || '',
  version
});

/* The portal's three states for a request; the exact API status stays in `api`. */
const portalStatus = status =>
  status === 'Confirmed' || status === 'Cancelling'
    ? 'approved'
    : status === 'Declined' || status === 'Cancelled'
      ? 'rejected'
      : 'pending';

function toReservation({ value: r, version }, venues, events) {
  const event = events.get(r.eventId),
    zone = event?.timeZone || '',
    from = clock(r.startsAt, zone),
    to = clock(r.endsAt, zone),
    room = venues.get(r.resourceId);
  return {
    id: r.id,
    ref: `RES-${r.id.slice(0, 8).toUpperCase()}`,
    venue: r.resourceId,
    rooms: r.allocationResourceIds || [],
    by: null,
    requestedBy: r.requestedBy || '',
    group: null,
    title: r.redacted ? '' : event && !event.redacted ? event.title : '',
    titleAr: r.redacted ? '' : event && !event.redacted ? event.title : '',
    eventId: r.eventId || '',
    zone,
    date: from.date,
    from: from.time,
    to: to.time,
    endDate: to.date,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: portalStatus(r.status),
    api: r.status,
    stage: r.status === 'Confirmed' ? 'done' : 'secretary',
    setup: room?.setup || 0,
    cleanup: room?.cleanup || 0,
    customerId: r.customerId || '',
    terms: r.termsSnapshot || '',
    reason: r.lastActionReason || '',
    errorCode: r.errorCode || '',
    redacted: !!r.redacted,
    version
  };
}

const toRental = (agreement, renters, reservation) => {
  const renter = renters.get(agreement.renterId);
  const who = renter ? [renter.name, renter.organization].filter(Boolean).join(' · ') : '';
  return {
    id: reservation.id,
    reservation: reservation.id,
    renterId: agreement.renterId,
    who,
    whoAr: who,
    venue: reservation.venue,
    date: reservation.date,
    deposit: agreement.deposit,
    charge: agreement.fee,
    currency: agreement.currency,
    terms: agreement.terms,
    status: agreement.status,
    depositState: agreement.depositState,
    depositHeld: agreement.depositHeld,
    outstanding: agreement.feeOutstanding,
    version: agreement.version
  };
};

/* Run `job` over `list` a few at a time. */
async function each(list, job, width = 6) {
  const out = [];
  for (let i = 0; i < list.length; i += width) out.push(...(await Promise.all(list.slice(i, i + width).map(job))));
  return out;
}

export async function load(parish, d) {
  denied.clear();
  const base = here(parish);
  const facilities = await tolerant('facilities', () => pages(base + 'facilities'));
  d.VENUES = facilities.map(toVenue);
  d.MAINTENANCE = d.VENUES.filter(v => v.status !== 'Serviceable').map(toBlock);
  const venues = new Map(d.VENUES.map(v => [v.id, v]));

  /* reservations in the 62 days around today, with their event's title and clock */
  const rows = new Map();
  await tolerant('reservations', async () => {
    for (const w of windows())
      for (const row of await pages(`${base}reservations?${query(w)}`)) rows.set(row.value.id, row);
  });
  const events = new Map();
  if (rows.size)
    await tolerant('events', async () => {
      for (const w of windows())
        for (const e of await pages(`${base}calendar/events?${query(w)}`)) events.set(e.value.id, e.value);
    });
  d.RESERVATIONS = [...rows.values()]
    .map(r => toReservation(r, venues, events))
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));

  const equipment = await tolerant('equipment', () => pages(base + 'equipment'));
  d.EQUIPMENT = equipment.map(toEquipment);
  /* what is out on loan: units on a booking that was issued and not yet returned */
  if (d.EQUIPMENT.length)
    await each(d.EQUIPMENT, async item => {
      const bookings = await tolerant('equipment', () =>
        pages(`${base}equipment/${encodeURIComponent(item.id)}/bookings`)
      );
      for (const { value: b } of bookings)
        if (b.status === 'Issued') {
          item.out += b.quantity;
          item.custody.push({ to: b.issuedTo || '', until: b.endsAt, quantity: b.quantity });
        }
    });

  const issues = await tolerant('issues', () => pages(base + 'facility-issues'));
  d.ISSUES = issues.map(toIssue);

  /* rentals: the agreement of each reservation that has one (404 where there is none) */
  const renters = new Map((await tolerant('rentals', () => api(`${base}renters`))).map(r => [r.id, r]));
  if (!denied.has('rentals')) {
    const found = await each(
      d.RESERVATIONS.filter(r => r.status !== 'rejected' && !r.redacted),
      async r => {
        try {
          return toRental(await api(`${base}reservations/${encodeURIComponent(r.id)}/rental`), renters, r);
        } catch (error) {
          if (error.status === 404) return null;
          if (error.status === 403) {
            denied.add('rentals');
            return null;
          }
          throw error;
        }
      }
    );
    d.RENTALS = found.filter(Boolean);
  }
}

/* A change made to these collections on screen cannot be sent as a diff: each write has its own call. */
export async function save(before, now) {
  const changed = keys.some(k => JSON.stringify(before[k]) !== JSON.stringify(now[k]));
  return { unsupported: changed, saved: false };
}

/* ---------- writing ---------- */

const op = () => ({ operationId: newOperationId() });
const enc = encodeURIComponent;

/* A room or space: create, or update with the version it was read at. */
export const saveFacility = (id, form, version) =>
  parishAPI(id ? `facilities/${enc(id)}` : 'facilities', id ? 'PUT' : 'POST', {
    ...op(),
    ...(id ? { version } : {}),
    name: form.name,
    kind: form.kind,
    capacity: form.capacity,
    setupMinutes: form.setupMinutes,
    cleanupMinutes: form.cleanupMinutes,
    exclusionResourceIds: form.exclusionResourceIds || [],
    publicDescription: form.publicDescription || null
  });

/* Out of service (the portal's "blocked") or back in service; the API requires a reason. */
export const setFacilityStatus = (id, status, reason, version) =>
  parishAPI(`facilities/${enc(id)}/status`, 'POST', { ...op(), version, status, reason });

/* The busy intervals of a room between two moments (at most 31 days), buffers included. */
export const availability = (id, start, end) =>
  parishAPI(`facilities/${enc(id)}/availability?start=${enc(start.toISOString())}&end=${enc(end.toISOString())}`);

/* Calendar events in the next 62 days that are not cancelled (equipment is booked for any of them). */
export async function upcomingEvents() {
  const start = Date.parse(windows()[1][0]);
  const events = [];
  for (const n of [0, 31])
    events.push(
      ...(await pages(
        `${mine()}calendar/events?${query([new Date(start + n * DAY).toISOString(), new Date(start + (n + 31) * DAY).toISOString()])}`
      ))
    );
  return events
    .map(e => e.value)
    .filter(e => e.status !== 'Cancelled' && !e.redacted && Date.parse(e.endsAt) > Date.now());
}

/* The draft events among them: a room is requested for the exact period of a draft event. */
export async function requestableEvents(taken = []) {
  return (await upcomingEvents()).filter(
    e => e.status === 'Draft' && !taken.includes(e.id) && Date.parse(e.startsAt) > Date.now()
  );
}

/* Ask for a room for the exact period of a draft event. */
export const requestRoom = ({ event, venue, more = [], customerId, terms }) =>
  parishAPI('reservations', 'POST', {
    ...op(),
    resourceId: venue,
    eventId: event.id,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    additionalResourceIds: more,
    customerId: customerId || null,
    termsSnapshot: terms || null
  });

/* confirm (queued: the room is allocated by a worker, so the answer may be "Allocating"), decline or cancel; a reason is required */
export const decideReservation = (r, action, reason) =>
  parishAPI(`reservations/${enc(r.id)}/actions`, 'POST', { ...op(), version: r.version, action, reason });

export const saveEquipment = (id, form, version) =>
  parishAPI(id ? `equipment/${enc(id)}` : 'equipment', id ? 'PUT' : 'POST', {
    ...op(),
    ...(id ? { version } : {}),
    name: form.name,
    quantity: form.quantity,
    storage: form.storage || null,
    condition: form.condition || null,
    status: form.status
  });
export const equipmentBookings = id => pages(`${mine()}equipment/${enc(id)}/bookings`);
export const bookEquipment = (id, eventId, quantity) =>
  parishAPI(`equipment/${enc(id)}/bookings`, 'POST', { ...op(), eventId, quantity });
export const equipmentBookingAction = (booking, body) =>
  parishAPI(`equipment-bookings/${enc(booking.id)}/actions`, 'POST', { ...op(), version: booking.version, ...body });

export const reportIssue = form => parishAPI('facility-issues', 'POST', { ...op(), ...form });
export const issueAction = (issue, body) =>
  parishAPI(`facility-issues/${enc(issue.id)}/actions`, 'POST', { ...op(), version: issue.version, ...body });

export const rentalRenters = () => tolerant('rentals', () => api(`${mine()}renters`));
export const createRenter = form => parishAPI('renters', 'POST', { ...op(), ...form });
export const proposeRental = (reservation, form) =>
  parishAPI(`reservations/${enc(reservation)}/rental`, 'PUT', { ...op(), ...form });
