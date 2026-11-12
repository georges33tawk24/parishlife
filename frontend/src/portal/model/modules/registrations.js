/* Purpose: the Registrations module's connection to ParishLife.Api: event registration policies and forms,
   office registrations, seat decisions, receipts, independently decided refunds, assigned door arrival,
   authorised collectors and the present roster. It also exports the member's own-registration calls
   (applicantForm, ownRegistration, registerOwn, cancelOwn) for the member screens.
   Main members: keys, routes, load, save, the action functions (configureRegistration, setRegistrationOpen,
   reviseRegistrationForm, registerParticipant, decideRegistration, amendRegistration, recordReceipt,
   requestRefund, decideRefund, recordPresence), act (runs one action, then reloads), availableEvents.

   Event registration is per calendar event (ParishLife.Api: /calendar/events/{event}/registration...). The API
   has no list of policies, so load reads the parish's manual calendar activities (31-day windows) and asks each
   for its policy; an event with none (404) or one the account may not read (403) is left out. The policy id is
   the event id. Seats, money and presence come from the registration lists the account is allowed to read:
   registrations.manage (full), finance.enter (cashier balances) and registrations.checkin plus an explicit
   door assignment (door list and present roster). A 403 only leaves that part empty.

   Nothing the API does not return is shown: deadlines, discounts, instalments, bus fees, the Arabic names,
   pickup reference codes, restricted-pickup entries, the muster point and venues are left empty. The screens
   change nothing locally: every change calls the API through an action below and then reloads, so save()
   only undoes a local edit to these collections. */
import { parishAPI, newOperationId } from '../api.js';
import { hydrate } from '../persist.js';

export const keys = ['REGISTRATIONS', 'REG_FORM', 'REGISTRANTS', 'REFUNDS', 'PICKUP', 'CHECKIN', 'EVACUATION'];
export const routes = ['registrations', 'checkin'];

const enc = encodeURIComponent;
const DAY = 24 * 3600 * 1000;
const WINDOW_BEFORE = 30,
  WINDOW_AFTER = 120,
  WINDOW_STEP = 30; // the API allows at most 31 days per calendar request

/* Calendar activities seen by the last load, for the "new form" list: activities with no policy yet. */
export const availableEvents = [];
let noPolicy = new Map(); // eventId → time a 404 was seen, so a reload does not ask the API again at once
const NO_POLICY_FOR = 5 * 60 * 1000;

/* ---------- reading ---------- */

/* A page of a list that pages by `cursor` (the registration routes; People pages by `continuation`). */
async function pages(path, limit = 3000) {
  const items = [];
  let cursor = '';
  do {
    const page = await parishAPI(
      `${path}${path.includes('?') ? '&' : '?'}size=100${cursor ? `&cursor=${enc(cursor)}` : ''}`
    );
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}

/* The result of `read`, or `fallback` when this account may not read it (403) or it does not exist (404). */
const soft = async (read, fallback) => {
  try {
    return await read();
  } catch (error) {
    if (error.status === 403 || error.status === 404) return fallback;
    throw error;
  }
};

async function inBatches(items, size, work) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  return out;
}

/* The date and time an instant has in a time zone, as the portal shows them. */
function localParts(iso, zone) {
  try {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(iso));
    const p = Object.fromEntries(f.map(x => [x.type, x.value]));
    return { d: `${p.year}-${p.month}-${p.day}`, t: `${p.hour}:${p.minute}` };
  } catch {
    return { d: '', t: '' };
  }
}

const can = parish => {
  const priest = !!parish.roles?.includes('priest'),
    has = c => priest || !!parish.capabilities?.includes(c);
  return {
    manage: has('registrations.manage'),
    door: has('registrations.checkin'),
    enter: has('finance.enter'),
    finance: has('finance.read')
  };
};

/* The parish's manual calendar activities that are not cancelled, soonest first. */
async function calendarActivities() {
  const now = Date.now(),
    events = new Map();
  for (let from = -WINDOW_BEFORE; from < WINDOW_AFTER; from += WINDOW_STEP) {
    const start = new Date(now + from * DAY).toISOString(),
      end = new Date(now + (from + WINDOW_STEP) * DAY).toISOString();
    const found = await soft(() => pages(`calendar/events?start=${enc(start)}&end=${enc(end)}`), null);
    if (found === null) return []; // this account may not read the calendar
    for (const row of found) {
      const e = row.value || row;
      if (e.kind === 'ParishActivity' && e.status !== 'Cancelled' && !e.redacted) events.set(e.id, e);
    }
  }
  return [...events.values()].sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
}

const emptyRegistrant = (eventId, id) => ({
  id,
  registrationId: eventId,
  eventId,
  p: '',
  name: '',
  status: '',
  version: '',
  transport: false,
  answers: {},
  consentEvidence: '',
  guardianAuthorityEvidence: '',
  collectors: [],
  independentDeparture: false,
  fee: 0,
  currency: '',
  precision: 2,
  received: 0,
  refunded: 0,
  paid: 0,
  outstanding: 0,
  origin: '',
  createdAt: '',
  offerUntil: '',
  presence: '',
  lastPresenceAt: '',
  formVersionId: '',
  consent: false,
  payments: [],
  full: false // the registration-management view (answers and evidence) was readable
});

/* EventRegistrationDto → the portal's registrant */
const fromStaff = (eventId, { value: r, version }) =>
  Object.assign(emptyRegistrant(eventId, r.id), {
    p: r.personId,
    version,
    status: r.status,
    origin: r.origin,
    formVersionId: r.formVersionId,
    transport: !!r.transport,
    answers: r.answers || {},
    consentEvidence: r.consentEvidence || '',
    guardianAuthorityEvidence: r.guardianAuthorityEvidence || '',
    collectors: r.collectors || [],
    independentDeparture: !!r.independentDeparture,
    fee: r.fee,
    currency: r.currency,
    received: r.received,
    refunded: r.refunded,
    paid: r.received,
    outstanding: Math.max(0, r.fee - r.received + r.refunded),
    createdAt: r.createdAt,
    offerUntil: r.offerUntil || '',
    presence: r.presence,
    lastPresenceAt: r.lastPresenceAt || '',
    consent: !!r.consentEvidence,
    full: true
  });

/* The registrant's row from the cashier or door view when the management view is not readable. */
function mergeNarrow(rows, eventId, { value: r, version }, patch) {
  const row = rows.get(r.id) || emptyRegistrant(eventId, r.id);
  row.name = r.displayName || row.name;
  if (!row.full) {
    row.version = version;
    row.status = r.status;
    Object.assign(row, patch(r));
  }
  rows.set(r.id, row);
  return row;
}

const refundRow = (reg, { value: x, version }) => ({
  id: x.id,
  registrationId: reg.id,
  formId: reg.eventId,
  p: reg.p,
  name: reg.name,
  version,
  amount: x.amount,
  currency: x.currency,
  precision: reg.precision,
  why: x.reason,
  whyAr: x.reason,
  status: x.status,
  at: x.requestedAt,
  requestedBy: x.requestedBy,
  approvedBy: x.approvedBy || '',
  recordedBy: x.recordedBy || ''
});

const paymentRow = ({ value: m }) => ({
  id: m.id,
  kind: m.kind,
  amount: m.amount,
  currency: m.currency,
  reference: m.evidenceReference,
  at: m.occurredAt,
  recordedAt: m.recordedAt,
  by: m.recordedBy,
  approvedBy: m.approvedBy || '',
  refundId: m.refundRequestId || ''
});

export async function load(parish, d) {
  /* the starting shapes carry the old demo's text: empty them so none of it shows */
  d.REG_FORM = { id: '', title: '', titleAr: '', fields: [], fee: 0, discounts: [], installments: [] };
  d.CHECKIN = {
    session: '',
    sessionAr: '',
    room: null,
    present: 0,
    expected: 0,
    awaitingGuardian: 0,
    rows: [],
    sessions: {}
  };
  d.EVACUATION = { rooms: [], muster: '', musterAr: '', events: {} };
  d.PICKUP = {};
  availableEvents.length = 0;
  const rights = can(parish);
  if (!rights.manage && !rights.door && !rights.enter) return;

  const events = await calendarActivities();
  const now = Date.now();
  for (const [id, at] of noPolicy) if (now - at > NO_POLICY_FOR) noPolicy.delete(id);

  const loaded = await inBatches(events, 4, async event => {
    if (rights.manage) {
      if (noPolicy.has(event.id)) return { event, none: true };
      const policy = await soft(() => parishAPI(`calendar/events/${enc(event.id)}/registration`), null);
      if (!policy) {
        noPolicy.set(event.id, now);
        return { event, none: true };
      }
      return { event, policy };
    }
    return { event, policy: null };
  });

  const bundles = [];
  for (const { event, policy, none } of loaded) {
    if (none) {
      availableEvents.push(event);
      continue;
    }
    const path = `calendar/events/${enc(event.id)}`;
    const rows = new Map();
    const staff = rights.manage ? await soft(() => pages(`${path}/registrations`), []) : [];
    for (const r of staff) rows.set(r.value.id, fromStaff(event.id, r));
    if (rights.enter)
      for (const r of await soft(() => pages(`${path}/registrations/cashier`), []))
        mergeNarrow(rows, event.id, r, c => ({
          fee: c.fee,
          currency: c.currency,
          precision: c.precision,
          received: c.received,
          refunded: c.refunded,
          paid: c.received,
          outstanding: c.outstanding
        }));
    const door = rights.door ? await soft(() => pages(`${path}/registrations/door`), null) : null;
    if (door)
      for (const r of door)
        mergeNarrow(rows, event.id, r, x => ({
          presence: x.presence,
          lastPresenceAt: x.lastPresenceAt || '',
          independentDeparture: x.independentDeparture,
          collectors: x.collectors.map(c => ({ id: c.id, name: c.name }))
        }));
    const present = door ? await soft(() => parishAPI(`${path}/present`), null) : null;
    const form = policy
      ? await soft(() => parishAPI(`${path}/registration/forms/${enc(policy.value.formVersionId)}`), null)
      : null;
    if (!policy && !rows.size && !door) continue; // nothing here this account may see
    bundles.push({ event, policy, form, rows: [...rows.values()], door, present, path });
  }

  /* money movements and refunds, for registrations that took money, if this account may read them */
  if (rights.finance)
    await inBatches(
      bundles.flatMap(b => b.rows.filter(r => r.received > 0 || r.refunded > 0).map(r => [b, r])),
      4,
      async ([b, r]) => {
        const base = `${b.path}/registrations/${enc(r.id)}`;
        r.payments = (await soft(() => pages(`${base}/movements`), [])).map(paymentRow);
        r.refundRows = (await soft(() => pages(`${base}/refunds`), [])).map(x => refundRow(r, x));
      }
    );

  for (const b of bundles) {
    const { event, policy, form, rows } = b;
    const when = localParts(event.startsAt, event.timeZone),
      until = localParts(event.endsAt, event.timeZone);
    const p = policy?.value;
    const taken = rows.filter(r => r.full && ['Confirmed', 'Reserved'].includes(r.status)).length,
      waiting = rows.filter(r => r.full && r.status === 'Waitlisted').length;
    d.REGISTRATIONS.push({
      id: event.id,
      eventId: event.id,
      event: event.title,
      eventAr: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timeZone: event.timeZone,
      d: when.d,
      t: when.t,
      to: until.t,
      known: !!p, // false when this account may not read the policy (door or cashier only)
      version: policy?.version || '',
      formVersionId: p?.formVersionId || '',
      policyStatus: p?.status || '',
      open: p?.status === 'Open',
      cap: p?.capacity ?? null,
      transportCap: p?.transportCapacity ?? null,
      taken: p ? taken : null,
      waiting: p ? waiting : null,
      fee: p?.fee ?? null,
      currency: p?.currency || '',
      precision: p?.precision ?? 2,
      waitlistAllowed: !!p?.waitlistAllowed,
      minAge: p?.minimumAge ?? null,
      maxAge: p?.maximumAge ?? null,
      childAgeThreshold: p?.childAgeThreshold ?? null,
      consentRequired: !!p?.consentRequired,
      consentText: p?.consentText || '',
      doorAccountIds: p?.doorAccountIds || [],
      fields: form?.fields || [],
      deadline: '' // the API has no registration deadline
    });
    for (const r of rows) {
      const { refundRows, ...row } = r;
      d.REGISTRANTS.push(row);
      d.REFUNDS.push(...(refundRows || []));
    }
    if (b.door) {
      const byId = new Map(rows.map(r => [r.id, r]));
      const present = (b.present?.entries || []).map(e => ({
        id: e.registrationId,
        p: e.personId,
        name: e.displayName,
        in: e.lastPresenceAt ? localParts(e.lastPresenceAt, event.timeZone).t : '',
        at: e.lastPresenceAt || '',
        version: byId.get(e.registrationId)?.version || ''
      }));
      d.CHECKIN.sessions[event.id] = {
        eventId: event.id,
        rows: present,
        present: present.length,
        expected: b.door.length,
        awaitingGuardian: 0,
        room: null,
        asOf: b.present?.asOf || '',
        coverage: b.present?.coverage || ''
      };
      d.EVACUATION.events[event.id] = { asOf: b.present?.asOf || '', coverage: b.present?.coverage || '' };
    }
    for (const r of rows.filter(x => x.status === 'Confirmed' || x.full || x.collectors.length)) {
      d.PICKUP[r.id] = {
        eventId: event.id,
        p: r.p,
        name: r.name,
        approved: r.collectors.map(c => ({ id: c.id, name: c.name, evidence: c.authorityEvidence || '' })),
        restricted: [], // the API has no do-not-release entries
        independent: r.independentDeparture,
        canEdit: r.full
      };
    }
  }
}

/* The screens call the API through the actions below and then reload, so a local edit to these
   collections is never what gets saved: it is undone and reported. */
export async function save(before, now) {
  const changed = keys.some(k => JSON.stringify(before[k]) !== JSON.stringify(now[k]));
  return { unsupported: changed, saved: false };
}

/* Runs one API action, then reloads the portal's data. Resolves true; a failure is shown through the
   portal's save-error banner and resolves false. */
export async function act(run) {
  try {
    await run();
  } catch (error) {
    document.dispatchEvent(new CustomEvent('parish-save-error', { detail: error.message }));
    return false;
  }
  noPolicy = new Map();
  await hydrate().catch(error =>
    document.dispatchEvent(new CustomEvent('parish-save-error', { detail: error.message }))
  );
  return true;
}

/* ---------- writing ---------- */

const eventPath = eventId => `calendar/events/${enc(eventId)}`;
const regPath = (eventId, id) => `${eventPath(eventId)}/registrations/${enc(id)}`;
const op = () => ({ operationId: newOperationId() });

/* A field of the form as the API stores it. */
export const apiField = f => ({
  key: f.key,
  label: f.label,
  type: f.type,
  required: !!f.required,
  options: f.type === 'Choice' ? f.options || [] : [],
  visibleWhenField: f.visibleWhenField || null,
  visibleWhenValue: f.visibleWhenValue || null,
  ...(f.requiredWhenField ? { requiredWhenField: f.requiredWhenField, requiredWhenValue: f.requiredWhenValue } : {})
});

/* A new policy (it can be configured once per event) and its first form version, in Draft. */
export const configureRegistration = (eventId, s) =>
  parishAPI(`${eventPath(eventId)}/registration`, 'POST', {
    ...op(),
    capacity: s.capacity,
    transportCapacity: s.transportCapacity ?? 0,
    fee: s.fee ?? 0,
    currency: s.currency,
    precision: s.precision ?? 2,
    waitlistAllowed: !!s.waitlistAllowed,
    minimumAge: s.minimumAge ?? null,
    maximumAge: s.maximumAge ?? null,
    childAgeThreshold: s.childAgeThreshold ?? 18,
    consentRequired: !!s.consentRequired,
    consentText: s.consentText || '',
    doorAccountIds: s.doorAccountIds || [],
    fields: (s.fields || []).map(apiField)
  });

export const setRegistrationOpen = (form, open) =>
  parishAPI(`${eventPath(form.eventId)}/registration/actions`, 'POST', {
    ...op(),
    version: form.version,
    action: open ? 'open' : 'close'
  });

export const reviseRegistrationForm = (form, fields) =>
  parishAPI(`${eventPath(form.eventId)}/registration/forms`, 'POST', {
    ...op(),
    version: form.version,
    fields: fields.map(apiField)
  });

export const registerParticipant = (form, s) =>
  parishAPI(`${eventPath(form.eventId)}/registrations`, 'POST', {
    ...op(),
    personId: s.personId,
    formVersionId: form.formVersionId,
    transport: !!s.transport,
    answers: s.answers || {},
    consentEvidence: s.consentEvidence || null,
    guardianAuthorityEvidence: s.guardianAuthorityEvidence || null,
    collectors: s.collectors || [],
    independentDeparture: !!s.independentDeparture
  });

/* reserve, offer (needs offerUntil), confirm, cancel or reinstate */
export const decideRegistration = (r, action, reason, offerUntil) =>
  parishAPI(`${regPath(r.eventId, r.id)}/actions`, 'POST', {
    ...op(),
    version: r.version,
    action,
    reason,
    offerUntil: action === 'offer' ? offerUntil : null
  });

export const amendRegistration = (r, s) =>
  parishAPI(`${regPath(r.eventId, r.id)}/amend`, 'POST', {
    ...op(),
    version: r.version,
    transport: !!s.transport,
    answers: s.answers || {},
    consentEvidence: s.consentEvidence || null,
    guardianAuthorityEvidence: s.guardianAuthorityEvidence || null,
    collectors: s.collectors || [],
    independentDeparture: !!s.independentDeparture,
    reason: s.reason
  });

/* cash actually received, in the fee currency */
export const recordReceipt = (r, s) =>
  parishAPI(`${regPath(r.eventId, r.id)}/receipts`, 'POST', {
    ...op(),
    version: r.version,
    amount: s.amount,
    currency: r.currency,
    evidenceReference: s.evidenceReference,
    occurredAt: s.occurredAt
  });

export const requestRefund = (r, s) =>
  parishAPI(`${regPath(r.eventId, r.id)}/refunds`, 'POST', {
    ...op(),
    version: r.version,
    amount: s.amount,
    reason: s.reason
  });

/* approve or reject (finance.approve, not the requester); record (finance.enter, not the approver) */
export const decideRefund = (refund, reg, action, s) =>
  parishAPI(`${regPath(reg.eventId, reg.id)}/refunds/${enc(refund.id)}/actions`, 'POST', {
    ...op(),
    version: refund.version,
    action,
    reason: s.reason,
    evidenceReference: action === 'record' ? s.evidenceReference || null : null,
    occurredAt: action === 'record' ? s.occurredAt : null
  });

/* arrive, checkout (collector and verification note unless the child may leave alone) or reenter */
export const recordPresence = (r, action, s = {}) =>
  parishAPI(`${regPath(r.eventId, r.id)}/presence`, 'POST', {
    ...op(),
    version: r.version,
    action,
    occurredAt: s.occurredAt || new Date().toISOString(),
    collectorId: s.collectorId || null,
    verificationEvidence: s.verificationEvidence || null,
    paperReason: s.paperReason || null
  });

/* ---------- a member's own registration (for the member screens) ---------- */

export const applicantForm = eventId => parishAPI(`${eventPath(eventId)}/registration/applicant-form`);
export const ownRegistration = eventId => parishAPI(`${eventPath(eventId)}/registrations/mine`);
export const registerOwn = (eventId, s) =>
  parishAPI(`${eventPath(eventId)}/registrations/mine`, 'POST', {
    ...op(),
    formVersionId: s.formVersionId,
    transport: !!s.transport,
    answers: s.answers || {},
    consentEvidence: s.consentEvidence || null
  });
export const cancelOwn = (eventId, version, reason) =>
  parishAPI(`${eventPath(eventId)}/registrations/mine/cancel`, 'POST', { ...op(), version, reason });
