/* Purpose: the Sacraments module's connection to ParishLife.Api: the sacrament register (cases from the
   family's request to the priest's registration), sacramental anniversaries taken only from registered
   dates (card S11), certificate requests (preparation, the priest's signature, the bishop's acceptance,
   issue, handover, withdrawal), document authorization and printing from the certificate's frozen snapshot.
   Main members: keys, routes, load (fills SACRAMENTS and ANNIVERSARIES), save (every direct edit is
   unsupported: the workflow goes through the actions), actions (one function per API step; each ends with
   hydrate() so the screens show what the API stored), docRecord (the facts a printed certificate shows).

   SACRAMENTS keeps the portal's single list, so the people, requests and dashboard screens keep working:
   a sacrament case is { kind: 'baptism' | 'communion' | ... } and a certificate request is
   { kind: 'certificate', certificateOf }. Each carries the API's own status in apiStatus and the version
   (ETag) the next write must send in version. The portal's status words are a reading of the API's:
     sacrament  Received requested · Preparation preparing · Scheduled scheduled · Celebrated awaiting-signature
                (draft once the priest returned it) · Registered registered · Declined rejected · Cancelled cancelled
     certificate  WaitingForSource, Received, Prepared, Returned draft · AwaitingSignature awaiting-signature ·
                AwaitingBishop awaiting-approval · AuthorizedForIssuance approved · Issued, Released issued ·
                Withdrawn withdrawn · Cancelled cancelled
   The API stores instants in UTC and has no parish time zone, so dates and times are read and written on
   the office browser's clock. */
import { api, parishAPI, session, newOperationId } from '../api.js';
import { hydrate } from '../persist.js';
import * as D from '../data.js';

export const keys = ['SACRAMENTS', 'ANNIVERSARIES'];
export const routes = ['sacraments', 'certificate'];

/* API sacrament name ↔ the portal's kind */
const KINDS = [
  ['Baptism', 'baptism', 'معمودية'],
  ['FirstCommunion', 'communion', 'مناولة أولى'],
  ['Confirmation', 'confirmation', 'ميرون'],
  ['Marriage', 'marriage', 'إكليل'],
  ['Funeral', 'funeral', 'جنّاز'],
  ['Anointing', 'anointing', 'مسحة المرضى'],
  ['Other', 'other', 'آخر']
];
const toKind = name => KINDS.find(k => k[0] === name)?.[1] || String(name || '').toLowerCase();
export const apiKind = kind => KINDS.find(k => k[1] === kind)?.[0] || '';
const kindAr = kind => KINDS.find(k => k[1] === kind)?.[2] || '';

const SACRAMENT_STATUS = {
  Received: 'requested',
  Preparation: 'preparing',
  Scheduled: 'scheduled',
  Celebrated: 'awaiting-signature',
  Registered: 'registered',
  Declined: 'rejected',
  Cancelled: 'cancelled'
};
const CERTIFICATE_STATUS = {
  WaitingForSource: 'draft',
  Received: 'draft',
  Prepared: 'draft',
  Returned: 'draft',
  AwaitingSignature: 'awaiting-signature',
  AwaitingBishop: 'awaiting-approval',
  AuthorizedForIssuance: 'approved',
  Issued: 'issued',
  Released: 'issued',
  Withdrawn: 'withdrawn',
  Cancelled: 'cancelled'
};

/* ---------- instants: UTC in the API, the office's clock on screen ---------- */
const two = n => String(n).padStart(2, '0');
export const localDate = d => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const localTime = d => `${two(d.getHours())}:${two(d.getMinutes())}`;
const instant = iso => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
/* '2026-10-25' and '10:30' on the office's clock → the explicit UTC instant the API requires. Without a time it is
   noon, so the calendar date cannot slip across midnight in UTC (anniversaries use the recorded date). */
export const toUtc = (date, time = '') =>
  new Date(`${date}T${/^\d{2}:\d{2}$/.test(time) ? time : '12:00'}:00`).toISOString();
const isoDay = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '');

/* ---------- API → the portal's records ---------- */
function toSacrament(row) {
  const x = row.value,
    facts = { ...x.facts, ...x.currentFacts },
    at = instant(x.celebratedAt) || instant(x.scheduledAt),
    kind = toKind(x.sacrament),
    timeline = x.timeline || [];
  return {
    id: x.id,
    kind,
    kindAr: kindAr(kind),
    // an open case has no official number; this handle comes from the record's own id and is not one
    reg: x.officialNumber || `SRQ/${String(x.id).slice(0, 8).toUpperCase()}`,
    officialNumber: x.officialNumber || '',
    person: x.subjectPersonId,
    requestId: x.requestId || '',
    date: at ? localDate(at) : isoDay(x.tentativeDate),
    time: at ? localTime(at) : '',
    requestedDate: isoDay(x.tentativeDate),
    requestNotes: facts.requestNotes || '',
    requestedAt: timeline.find(step => step.action === 'open')?.at || '',
    celebrant: null,
    celebrantName: x.celebrantName || '',
    status: x.status === 'Celebrated' && x.returnReason ? 'draft' : SACRAMENT_STATUS[x.status] || 'requested',
    apiStatus: x.status,
    returnReason: x.returnReason || '',
    godparents: x.witnesses || facts.godparents || '',
    father: facts.father || '',
    mother: facts.mother || '',
    place: x.place || '',
    book: x.bookReference || '',
    page: '',
    externalParish: facts.externalParish || '',
    externalReference: facts.externalReference || '',
    partner: facts.partner || '',
    partnerParish: facts.partnerParish || '',
    celebratedAt: x.celebratedAt || '',
    scheduledAt: x.scheduledAt || '',
    registeredAt: x.registeredAt || '',
    approvedAt: x.registeredAt || '',
    requestApprovedAt: timeline.find(step => step.action === 'accept')?.at || '',
    amendments: (x.amendments || []).map(a => ({
      field: a.field,
      from: a.oldValue || '',
      to: a.newValue,
      reason: a.reason
    })),
    history: timeline.map(step => ({ action: step.action, at: step.at, reason: step.note || '' })),
    pendingCorrections: [],
    facts: x.facts || {},
    version: row.version
  };
}

function toCertificate(row) {
  const x = row.value,
    kind = toKind(x.sacrament),
    snapshot = x.snapshot || {},
    history = [
      ['sign', x.signedAt],
      ['accept', x.acceptedAt],
      ['issue', x.issuedAt],
      ['release', x.releasedAt]
    ]
      .filter(([, at]) => at)
      .map(([action, at]) => ({ action, at, reason: '' }));
  return {
    id: x.id,
    kind: 'certificate',
    kindAr: 'طلب شهادة',
    certificateOf: kind,
    reg: x.reference,
    person: x.subjectPersonId,
    requestId: x.requestId || '',
    sourceRecordId: x.sourceRecordId || '',
    date: '', // the API does not return when a request was made
    celebrant: null,
    status: CERTIFICATE_STATUS[x.status] || 'draft',
    apiStatus: x.status,
    godparents: '',
    purpose: x.purpose || '',
    language: x.language,
    quantity: x.quantity,
    certificateVersion: x.version,
    replacesId: x.replacesId || '',
    supersededById: x.supersededById || '',
    officialNumber: x.officialNumber || '',
    snapshot,
    bishopReviewRequired: !!x.bishopReviewRequired,
    bishopReview: x.status === 'AwaitingBishop' ? 'pending' : x.acceptedAt ? 'accepted' : '',
    returnReason: x.returnReason || '',
    withdrawalReason: x.withdrawalReason || '',
    signedBy: x.signedBy || '',
    signedAt: x.signedAt || '',
    approvedAt: x.signedAt || '',
    acceptedAt: x.acceptedAt || '',
    issuedAt: x.issuedAt || '',
    releasedAt: x.releasedAt || '',
    recipientName: x.recipientName || '',
    recipientRelationship: x.recipientRelationship || '',
    verificationMethod: x.verificationMethod || '',
    authorizationCode: x.authorizationCode || '',
    authorizationCodes: x.authorizationCodes || [],
    copyStatement: x.copyStatement || '',
    notificationOutcome: x.notificationOutcome || null,
    history,
    version: row.version
  };
}

/* A page of a list that pages with `cursor` (the register search), up to a limit. */
async function everything(path, limit = 5000) {
  const items = [];
  let cursor = '';
  do {
    const page = await api(path + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''));
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}
/* 403 means "not allowed here" (no records permission, or no two-factor proof yet); 404 a module that is switched off */
const allowed = error => (error.status === 403 || error.status === 404 ? [] : Promise.reject(error));

export async function load(parish, d) {
  if (!parish.roles?.includes('priest') && !parish.capabilities?.includes('sacraments.record')) return;
  const base = `parishes/${encodeURIComponent(parish.id)}`;
  const today = localDate(new Date());
  const [registers, certificates, corrections, anniversaries] = await Promise.all([
    Promise.all(KINDS.map(([name]) => everything(`${base}/sacraments?sacrament=${name}&size=100`).catch(allowed))),
    api(`${base}/certificates`).catch(allowed),
    api(`${base}/sacraments/corrections`).catch(allowed),
    // the API's longest window is 92 days
    api(`${base}/sacraments/anniversaries?from=${today}&days=92`).catch(allowed)
  ]);
  const records = registers.flat().map(toSacrament);
  for (const c of corrections || []) {
    const record = records.find(r => r.id === c.value.recordId);
    if (record)
      record.pendingCorrections.push({
        id: c.value.id,
        field: c.value.field,
        to: c.value.newValue,
        reason: c.value.reason,
        evidence: c.value.evidence,
        at: c.value.proposedAt,
        version: c.version
      });
  }
  d.SACRAMENTS = [...records, ...(certificates || []).map(toCertificate)];
  // Anniversaries come only from registered entries with a recorded celebration date; nothing is guessed.
  d.ANNIVERSARIES = (anniversaries || []).map(a => ({
    couple: a.personName,
    ar: a.personName,
    years: a.years,
    on: a.nextOn,
    kind: toKind(a.sacrament),
    reg: '',
    source: 'register',
    person: a.personId,
    recordId: a.recordId
  }));
}

/* Every change reaches the API through an action below, never through an edit of the list. */
export async function save() {
  return { unsupported: true, saved: false };
}

/* ---------- what a printed certificate shows ---------- */
/* The certificate's own frozen snapshot (taken when it was prepared), so a later change to the register
   never alters a prepared certificate; before preparation, the linked entry as it is now. */
export function docRecord(s) {
  if (s.kind !== 'certificate') return s;
  const source = D.SACRAMENTS.find(x => x.id === s.sourceRecordId);
  const f = s.snapshot || {};
  if (!Object.keys(f).length) return source || null;
  const at = instant(f.celebratedAt);
  return {
    id: s.id,
    kind: s.certificateOf,
    person: s.person,
    reg: s.officialNumber || s.reg,
    date: at ? localDate(at) : '',
    time: at ? localTime(at) : '',
    celebrant: null,
    celebrantName: f.celebrantName || '',
    place: f.place || '',
    godparents: f.witnesses || f.godparents || '',
    father: f.father || '',
    mother: f.mother || '',
    book: f.bookReference || ''
  };
}

/* The case's facts with some changed; a fact left empty is dropped (the API replaces the whole set on amend-facts). */
export function mergedFacts(record, changes) {
  return clean({ ...record.facts, ...changes });
}

/* What an official correction may change on a registered entry (API: place, celebrantName, witnesses,
   bookReference, celebratedAt or facts.<key>). */
export const CORRECTABLE = [
  ['place', 'Place', 'المكان'],
  ['celebrantName', 'Celebrant', 'المحتفل'],
  ['witnesses', 'Godparents / witnesses', 'الإشبين / الشهود'],
  ['bookReference', 'Book / page', 'الدفتر / الصفحة'],
  ['celebratedAt', 'Celebration date and time (YYYY-MM-DD)', 'تاريخ الاحتفال (YYYY-MM-DD)'],
  ['facts.father', 'Father', 'الأب'],
  ['facts.mother', 'Mother', 'الأم']
];

/* ---------- actions: one API step each, then the screens reload ---------- */
const find = id => D.SACRAMENTS.find(x => x.id === id);
const found = id =>
  find(id) || Promise.reject(new Error('That record is no longer in the list. Reload and try again.'));
const clean = fields =>
  Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const done = async result => {
  await hydrate();
  return result;
};

/* A new sacrament case (the family's request). Facts are the case's own details, by short keys. */
export async function createSacrament({ kind, person, requestedDate, facts = {} }) {
  return done(
    await parishAPI('sacraments', 'POST', {
      operationId: newOperationId(),
      sacrament: apiKind(kind),
      subjectPersonId: person,
      facts: clean(facts),
      tentativeDate: requestedDate || null
    })
  );
}

/* A new person who is not in People yet (a baptism of a child), then the case for them. */
export async function createChildAndSacrament({ given, family, born, father, mother, requestedDate, requestNotes }) {
  const created = await parishAPI('people', 'POST', {
    operationId: newOperationId(),
    givenName: given,
    familyName: family,
    birthDate: isoDay(born) || null,
    contact: null
  });
  return createSacrament({
    kind: 'baptism',
    person: created.id,
    requestedDate,
    facts: { father, mother, requestNotes }
  });
}

/* accept | decline | cancel | reschedule | schedule | record-celebration | amend-facts | return-entry | register */
export async function sacramentAction(id, action, fields = {}) {
  const record = await found(id);
  return done(
    await parishAPI(`sacraments/${encodeURIComponent(id)}/actions`, 'POST', {
      operationId: newOperationId(),
      version: record.version,
      action,
      ...clean(fields)
    })
  );
}

export async function proposeCorrection(id, { field, newValue, reason, evidence }) {
  return done(
    await parishAPI(`sacraments/${encodeURIComponent(id)}/corrections`, 'POST', {
      operationId: newOperationId(),
      field,
      newValue,
      reason,
      evidence
    })
  );
}
export async function decideCorrection(correction, approve, note) {
  return done(
    await parishAPI(`sacraments/corrections/${encodeURIComponent(correction.id)}/decision`, 'POST', {
      operationId: newOperationId(),
      version: correction.version,
      approve,
      note
    })
  );
}

/* A certificate request for a person: the entry it is taken from (if registered), the language of the
   bishop-approved wording, the number of copies and what it is for. */
export async function createCertificate({ kind, person, sourceRecordId, language = 'en', quantity = 1, purpose }) {
  return done(
    await parishAPI('certificates', 'POST', {
      operationId: newOperationId(),
      sacrament: apiKind(kind),
      subjectPersonId: person,
      sourceRecordId: sourceRecordId || null,
      language,
      quantity,
      purpose: purpose || null
    })
  );
}

const certificateStep = async (id, action, fields = {}, version) => {
  const certificate = await found(id);
  return parishAPI(`certificates/${encodeURIComponent(id)}/actions`, 'POST', {
    operationId: newOperationId(),
    version: version || certificate.version,
    action,
    ...clean(fields)
  });
};
/* link-source | prepare | submit | sign | accept | return | issue | release | withdraw | cancel */
export async function certificateAction(id, action, fields = {}) {
  return done(await certificateStep(id, action, fields));
}
/* "Send to the priest": prepare the certificate (freezing its snapshot) when that has not been done, then submit it.
   Each step is a new version of the record, so the second step reads it again. */
export async function sendCertificate(id) {
  const certificate = await found(id);
  if (['Received', 'Returned'].includes(certificate.apiStatus)) {
    await certificateStep(id, 'prepare');
    const fresh = await parishAPI(`certificates/${encodeURIComponent(id)}`);
    return done(await certificateStep(id, 'submit', {}, fresh.version));
  }
  return done(await certificateStep(id, 'submit'));
}

/* The exact content the priest authorizes electronically, with the hash the authorization is bound to. */
export const authorizationPreview = id => parishAPI(`certificates/${encodeURIComponent(id)}/authorization-preview`);
/* The priest who signed adds an electronic authorization with a current authenticator code. */
export async function authorizeCertificate(id, code) {
  const certificate = await found(id);
  const preview = await authorizationPreview(id);
  return done(
    await parishAPI(`certificates/${encodeURIComponent(id)}/authorization`, 'POST', {
      operationId: newOperationId(),
      version: certificate.version,
      expectedContentHash: preview.contentHash,
      authenticatorCode: String(code || '').replace(/\s+/g, '')
    })
  );
}

/* The parish sheet: the bishop-approved wording filled from the certificate's snapshot, as the API renders it. */
export async function certificateSheet(id) {
  const response = await fetch(
    `/api/parishes/${encodeURIComponent(session.parishId)}/certificates/${encodeURIComponent(id)}/sheet`,
    { credentials: 'same-origin', cache: 'no-store' }
  );
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.detail || 'The sheet could not be made.');
  }
  return response.blob();
}
