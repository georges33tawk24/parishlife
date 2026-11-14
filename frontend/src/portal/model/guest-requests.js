/* Purpose: the browser's side of requests made without an account: sending one to a parish, following it
   with its private tracking link, and the link itself.
   Main functions: guestSubmit, guestCase, guestMessages, guestPostMessage, guestLetters, guestFiles,
   guestUpload, trackingLink, parseTracking, publicKind.

   Routes (ParishLife.Api, anonymous and rate-limited):
     POST /api/public/parishes/{parishId}/requests                    send a request; answers its tracking token once
     GET  /api/public/parishes/{parishId}/requests/{requestId}        status, with the token in X-ParishLife-Tracking
     GET/POST .../{requestId}/messages                                 messages the office shows the applicant, and replies
     GET  .../{requestId}/letters                                      released or withdrawn letters: title and status only,
                                                                       never the text or code (collect in person or link an account)
     GET/POST .../{requestId}/files                                    the guest's own uploads (metadata only; nothing downloads
                                                                       through the bearer link), multipart with the CSRF token
     (POST .../{requestId}/actions, to respond or withdraw, needs the record's version, which the guest route
      does not return, so a guest can message the office but not withdraw: see docs/frontend-modules/requests.md)
   The token never goes in a URL the server sees: the private link keeps it after the # (which browsers do
   not send), as `public.html#track=<parishId>.<requestId>.<token>`. The API needs the parish and the request
   as well as the token, so the link carries all three. When the platform has Turnstile on, the bot-check
   token goes in X-Turnstile-Token. */
import { api, newOperationId } from './api.js';
import { multipart } from './modules/requests.js';

const TRACKING = 'X-ParishLife-Tracking';
const path = (parishId, requestId = '') =>
  `public/parishes/${encodeURIComponent(parishId)}/requests${requestId ? '/' + encodeURIComponent(requestId) : ''}`;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* What the public form offers → the API's request kind and the sacrament or topic kept in the details. */
const KINDS = {
  baptism: ['SacramentInquiry', 'Baptism'],
  communion: ['SacramentInquiry', 'First Communion'],
  confirmation: ['SacramentInquiry', 'Confirmation'],
  marriage: ['SacramentInquiry', 'Marriage'],
  funeral: ['SacramentInquiry', 'Funeral'],
  certificate: ['Certificate', 'Certificate'],
  booking: ['Facility', 'Booking of a hall or room'],
  appointment: ['PriestAppointment', 'Appointment with the parish office'],
  ministry: ['MinistryInquiry', 'Joining a ministry'],
  custom: ['General', 'Request']
};
export const publicKind = kind => KINDS[kind] || KINDS.custom;

/* The private link for a request, as a full address on the public site. */
export function trackingLink(receipt, parishId) {
  const url = new URL('public.html', location.href);
  url.search = '';
  url.hash = `track=${parishId}.${receipt.requestId}.${receipt.trackingToken}`;
  return url.href;
}

/* A link, its fragment or the bare `parish.request.token`, as pasted. Returns null when it is none of them. */
export function parseTracking(value) {
  let text = String(value || '').trim();
  const at = text.indexOf('track=');
  if (at >= 0) text = text.slice(at + 6);
  const [parishId, requestId, ...rest] = text.split('.');
  const token = rest.join('.');
  return GUID.test(parishId || '') && GUID.test(requestId || '') && /^[A-Za-z0-9_-]{16,}$/.test(token)
    ? { parishId, requestId, token }
    : null;
}

const checked = turnstile => (turnstile ? { 'X-Turnstile-Token': turnstile } : {});
const tracking = token => ({ [TRACKING]: token });

/* body: { kind, summary, details, requesterName, requesterContact, subjectDescription, relationship, authorityBasis, preferredDates }
   → { reference, requestId, trackingToken } */
export const guestSubmit = (parishId, body, turnstile) =>
  api(path(parishId), 'POST', { operationId: newOperationId(), ...body }, checked(turnstile));

export const guestCase = ({ parishId, requestId, token }) =>
  api(path(parishId, requestId), 'GET', undefined, tracking(token));
export const guestMessages = ({ parishId, requestId, token }) =>
  api(path(parishId, requestId) + '/messages', 'GET', undefined, tracking(token));
export const guestPostMessage = ({ parishId, requestId, token }, body) =>
  api(
    path(parishId, requestId) + '/messages',
    'POST',
    { operationId: newOperationId(), audience: 'Applicant', body },
    tracking(token)
  );

export const guestLetters = ({ parishId, requestId, token }) =>
  api(path(parishId, requestId) + '/letters', 'GET', undefined, tracking(token));
export const guestFiles = ({ parishId, requestId, token }) =>
  api(path(parishId, requestId) + '/files', 'GET', undefined, tracking(token));
/* options: { checklistKey, replacesId, reason } */
export const guestUpload = ({ parishId, requestId, token }, file, options = {}) =>
  multipart('/api/' + path(parishId, requestId) + '/files', file, options, tracking(token));
