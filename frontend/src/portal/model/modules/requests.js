/* Purpose: the Requests module's connection to ParishLife.Api: the parish office's queue, the signed-in
   person's own requests, and every action on a case (decisions, messages, history, the checklist, private
   files, account links and replaced tracking links).
   Main members: keys, routes, load, save (the module contract), plus the calls the screens make:
   getCase, act, submitOwn, getMessages, postMessage, getHistory, setChecklist, listFiles, uploadFile,
   removeFile, fileURL, decideAssociation, rotateTracking, claimGuest.

   The API's request is a case with a status (Received, NeedsInformation, AcceptedForProcessing,
   CancellationRequested, Completed, Declined, Withdrawn, Cancelled) and separate facts: accepted,
   approved by a priest, date confirmed, completed. The screens were written for member requests that
   created a sacrament entry or a booking when accepted; the API does not do that (it only records the
   case, and its links to records), so those side effects are gone and the screens show the API's own
   facts. The office queue becomes MEMBER_REQUESTS (every case, guest cases included, kept apart by
   `origin`), and the person's own cases become MY_REQUESTS. Both are read-only on screen: every change is
   an action sent straight to the API, after which the portal reloads. */
import { api, parishAPI, session, newOperationId } from '../api.js';

export const keys = ['MEMBER_REQUESTS', 'MY_REQUESTS'];
export const routes = ['requests', 'guestrequests', 'myrequests'];

/* ---- kinds ---------------------------------------------------------------- */
const SACRAMENTS = ['baptism', 'communion', 'confirmation', 'marriage', 'funeral'];
/* The portal's kind → the API's kind. A general request's topic picks the closest kind. */
const TOPICS = {
  'House blessing': 'Blessing',
  'Mass intention': 'MassIntention',
  'Visit to a sick person': 'Visit',
  'Meeting with the priest': 'PriestAppointment',
  'Confession at home': 'Visit'
};
export const toApiKind = (kind, details = {}) =>
  SACRAMENTS.includes(kind)
    ? 'SacramentInquiry'
    : kind === 'certificate'
      ? 'Certificate'
      : kind === 'booking'
        ? 'Facility'
        : TOPICS[details.subject] || 'General';
/* The API's kind → the portal's kind (the sacrament or certificate is kept in the details). */
const toKind = (dto, details) =>
  dto.kind === 'SacramentInquiry' && SACRAMENTS.includes(details.sacrament)
    ? details.sacrament
    : dto.kind === 'Certificate'
      ? 'certificate'
      : dto.kind === 'Facility'
        ? 'booking'
        : 'custom';

/* ---- details: the portal's object ↔ the API's string dictionary ------------- */
const CHILD = { childLat: 'lat', childAr: 'ar', childBorn: 'born', childFather: 'father', childMother: 'mother' };
export function toDict(details = {}) {
  const out = {},
    put = (key, value) => {
      if (value === undefined || value === null || value === '' || !/^[A-Za-z0-9_]{1,60}$/.test(key)) return;
      out[key] = String(value).slice(0, 2000);
    };
  for (const [key, value] of Object.entries(details))
    if (key === 'child' && value && typeof value === 'object')
      for (const [k, field] of Object.entries(CHILD)) put(k, value[field]);
    else put(key, value);
  return out;
}
export function fromDict(dict = {}) {
  const out = { ...dict };
  if (out.childLat || out.childAr) {
    out.child = Object.fromEntries(Object.entries(CHILD).map(([k, field]) => [field, out[k] || '']));
    for (const k of Object.keys(CHILD)) delete out[k];
  }
  if (/^\d+$/.test(out.guests || '')) out.guests = Number(out.guests);
  return out;
}

/* ---- where a case stands ----------------------------------------------------- */
export const TERMINAL = ['Completed', 'Declined', 'Withdrawn', 'Cancelled'];
const STATUS = {
  Received: 'submitted',
  NeedsInformation: 'needs-information',
  AcceptedForProcessing: 'accepted',
  CancellationRequested: 'cancellation-requested',
  Completed: 'completed',
  Declined: 'declined',
  Withdrawn: 'withdrawn',
  Cancelled: 'cancelled'
};
const STAGE = {
  Received: 'received',
  NeedsInformation: 'needsinfo',
  AcceptedForProcessing: 'inprogress',
  CancellationRequested: 'cancelreq',
  Completed: 'completed',
  Declined: 'declined',
  Withdrawn: 'withdrawn',
  Cancelled: 'cancelled'
};
/* A moment in the reader's own day and time, as the screens' date helpers expect. */
const pad = n => String(n).padStart(2, '0');
const dayOf = iso => {
  const d = new Date(iso || '');
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const timeOf = iso => {
  const d = new Date(iso || '');
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* Only moments the API recorded: nothing is invented for a step with no timestamp. */
function events(dto) {
  const list = [{ key: 'submitted', at: dto.receivedAt }];
  if (dto.acceptedAt) list.push({ key: 'accepted', at: dto.acceptedAt });
  if (dto.clergyApprovedAt) list.push({ key: 'approved', at: dto.clergyApprovedAt });
  if (dto.completedAt) list.push({ key: 'completed', at: dto.completedAt });
  if (['Declined', 'Withdrawn', 'Cancelled'].includes(dto.status))
    list.push({ key: dto.status.toLowerCase(), at: dto.updatedAt });
  return list;
}

/* ParishRequestDto (+ its version) → the shape the office screens read. */
export function toOffice(dto, version) {
  const details = fromDict(dto.details);
  return {
    id: dto.id,
    reference: dto.reference,
    kind: toKind(dto, details),
    origin: dto.origin,
    status: STATUS[dto.status] || String(dto.status || '').toLowerCase(),
    details,
    requester: { name: dto.requesterName || '', contact: dto.requesterContact || '' },
    createdAt: dto.receivedAt,
    updatedAt: dto.updatedAt,
    response: dto.applicantExplanation || '',
    api: { version, dto }
  };
}

/* The same case as its applicant sees it. */
export function toMine(dto, version) {
  const r = toOffice(dto, version);
  const self = dto.relationship === 'Self';
  return {
    ...r,
    subject: {
      id: dto.subjectPersonId || '',
      new: !self && !dto.subjectPersonId,
      lat: self ? session.user?.name || '' : dto.subjectDescription || '',
      ar: ''
    },
    progress: {
      stage:
        dto.status === 'AcceptedForProcessing' && dto.confirmedDate ? 'scheduled' : STAGE[dto.status] || 'received',
      events: events(dto),
      plannedDate: dayOf(dto.confirmedDate),
      plannedTime: timeOf(dto.confirmedDate),
      preferredDate: dto.preferredDates || r.details.date || '',
      register: '',
      preparation: [],
      reason: dto.applicantExplanation || '',
      meaning: dto.statusMeaning || '',
      approved: !!dto.clergyApprovedAt
    },
    canWithdraw: dto.status === 'Received',
    canReply: dto.status === 'NeedsInformation',
    canRequestCancel: dto.status === 'AcceptedForProcessing'
  };
}

/* ---- loading ------------------------------------------------------------------ */
/* Every page of a paged list (these routes page with size and cursor). */
async function pages(path, limit = 2000) {
  const items = [];
  let cursor = '';
  do {
    const page = await api(`${path}?size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}
/* "Not allowed here", or the parish has not switched requests on: nothing to show, not a failure. */
const none = e => ([401, 403, 404, 409].includes(e.status) ? [] : Promise.reject(e));

export async function load(parish, d) {
  const base = `parishes/${encodeURIComponent(parish.id)}/requests`;
  const office = parish.roles?.includes('priest') || parish.capabilities?.includes('requests.manage');
  const [queue, mine] = await Promise.all([office ? pages(base).catch(none) : [], pages(base + '/mine').catch(none)]);
  d.MEMBER_REQUESTS = queue.map(r => toOffice(r.value, r.version));
  d.MY_REQUESTS = mine.map(r => toMine(r.value, r.version));
}

/* Both collections are read-only on screen: a change to them is not saved. */
export async function save(before, now) {
  const changed = key => JSON.stringify(before[key]) !== JSON.stringify(now[key]);
  return { unsupported: keys.some(changed), saved: false };
}

/* ---- calls the screens make ------------------------------------------------------ */
const base = id => `requests${id ? '/' + encodeURIComponent(id) : ''}`;
const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

/* The case as the API holds it now: { value: ParishRequestDto, version }. */
export const getCase = id => parishAPI(base(id));

/* An action on a case: the office's (triage, accept, return, decline, clergy-approve, confirm-date,
   complete, cancel, match-subject, review-authority, link) or the applicant's (edit, withdraw, respond,
   request-cancel). `version` is the one getCase returned. Answers the changed case. */
export const act = (id, version, action, fields = {}) =>
  parishAPI(base(id) + '/actions', 'POST', { operationId: newOperationId(), version, action, ...clean(fields) });

/* The signed-in person's own request. `p` is the form's answers: its kind, the relationship fields
   (relationship, subjectDescription, authorityBasis) and everything else as the case's details. */
const NAMES = {
  baptism: 'Baptism',
  communion: 'First Communion',
  confirmation: 'Confirmation',
  marriage: 'Marriage',
  funeral: 'Funeral',
  certificate: 'Certificate',
  booking: 'Booking',
  custom: 'Request'
};
export function submitOwn({ kind, relationship, subjectDescription, authorityBasis, ...rest }) {
  const details = { ...rest, ...(SACRAMENTS.includes(kind) ? { sacrament: kind } : {}) };
  const what = kind === 'custom' ? details.subject : kind === 'booking' ? details.venue : details.certificateOf;
  const dates =
    kind === 'booking' && details.date
      ? `${details.date} ${details.from || ''}-${details.to || ''}`.trim()
      : details.date;
  return parishAPI('requests', 'POST', {
    operationId: newOperationId(),
    kind: toApiKind(kind, details),
    summary: [NAMES[kind] || 'Request', what].filter(Boolean).join(': ').slice(0, 300),
    details: toDict(details),
    preferredDates: dates || null,
    relationship: relationship || 'Self',
    subjectDescription: subjectDescription || null,
    authorityBasis: authorityBasis || null
  });
}

/* Messages the applicant can read (Applicant) and the office's own notes (Internal). */
export const getMessages = id => parishAPI(base(id) + '/messages');
export const postMessage = (id, audience, body) =>
  parishAPI(base(id) + '/messages', 'POST', { operationId: newOperationId(), audience, body });
/* What happened to a case, newest last (office only). */
export const getHistory = id => parishAPI(base(id) + '/history');
/* The checklist is replaced as a whole: items are { key, label, required, status, paperReference }. */
export const setChecklist = (id, version, items) =>
  parishAPI(base(id) + '/checklist', 'PUT', {
    operationId: newOperationId(),
    version,
    items: items.map(i => ({
      key: i.key,
      label: i.label,
      required: !!i.required,
      status: i.status,
      paperReference: i.paperReference || null
    }))
  });

/* Private files on a case. Uploads are multipart, so they bypass the JSON client but keep its token. */
export const listFiles = id => parishAPI(base(id) + '/files');
export const fileURL = (id, fileId) =>
  `/api/parishes/${encodeURIComponent(session.parishId)}/${base(id)}/files/${encodeURIComponent(fileId)}`;
export async function uploadFile(id, file, { replacesId, reason } = {}) {
  const { token } = await api('auth/csrf');
  const form = new FormData();
  form.append('operationId', newOperationId());
  form.append('file', file);
  if (replacesId) {
    form.append('replacesId', replacesId);
    form.append('reason', reason || '');
  }
  let response;
  try {
    response = await fetch(`/api/parishes/${encodeURIComponent(session.parishId)}/${base(id)}/files`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': token },
      body: form
    });
  } catch {
    throw new Error('ParishLife cannot reach its API. Try again in a moment.');
  }
  const data = await response.json().catch(() => null);
  if (response.ok) return data;
  const errors = data?.errors && Object.values(data.errors).flat().filter(Boolean);
  throw new Error(errors?.length ? errors.join(' ') : data?.detail || 'The file was not uploaded.');
}
export const removeFile = (id, fileId, version, reason) =>
  parishAPI(base(id) + `/files/${encodeURIComponent(fileId)}/remove`, 'POST', {
    operationId: newOperationId(),
    version,
    reason
  });

/* A13 account links and replaced tracking links. */
export const claimGuest = ({ parishId, requestId, token }) =>
  api(`parishes/${encodeURIComponent(parishId)}/requests/${encodeURIComponent(requestId)}/claim`, 'POST', undefined, {
    'X-ParishLife-Tracking': token
  });
export const decideAssociation = (id, version, approve, text) =>
  parishAPI(base(id) + '/association', 'POST', {
    operationId: newOperationId(),
    version,
    approve,
    ...(approve ? { evidenceReference: text } : { reason: text })
  });
export const rotateTracking = (id, version, reason) =>
  parishAPI(base(id) + '/rotate-tracking', 'POST', { operationId: newOperationId(), version, reason });
