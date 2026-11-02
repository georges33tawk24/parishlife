/* Explicit event selection shared by registration and check-in workflows. */
import { S } from './store.js';
import { EVENTS, REGISTRATIONS, REGISTRANTS, CHECKIN, VENUES } from './data.js';

export const eventById = id => EVENTS.find(event => event.id === id) || null;
export const eligibleEvent = event => !!event && event.kind !== 'mass' && !event.feastLiturgy && !event.liturgy;
export const eligibleEvents = () => EVENTS.filter(eligibleEvent);
export const registrationById = id => REGISTRATIONS.find(form => form.id === id) || null;
export const selectedRegistration = () => registrationById(S.ui.registrationId);
export const selectRegistration = id => { S.ui.registrationId = registrationById(id)?.id || null; return selectedRegistration(); };
export const registrantsFor = form => form ? REGISTRANTS.filter(row => row.registrationId === form.id) : [];
export const linkedEvent = form => eventById(form?.eventId);
export const eventVenue = event => VENUES.find(place => place.id === event?.venue) || null;
export const selectableCheckinEvents = () => [...new Map(REGISTRATIONS.filter(form => linkedEvent(form) && eligibleEvent(linkedEvent(form)))
  .map(form => [form.eventId, linkedEvent(form)])).values()];
export const selectCheckinEvent = id => {
  S.ui.checkinEventId = selectableCheckinEvents().some(event => event.id === id) ? id : null;
  return selectedCheckin();
};
export const selectedCheckin = () => {
  const id = S.ui.checkinEventId;
  return id && selectableCheckinEvents().some(event => event.id === id) ? CHECKIN.sessions?.[id] || null : null;
};
export function ensureCheckinSession(id = S.ui.checkinEventId) {
  const event = selectableCheckinEvents().find(event => event.id === id);
  if (!event) return null;
  CHECKIN.sessions ||= {};
  CHECKIN.sessions[id] ||= { eventId:id, rows:[], expected:REGISTRANTS.filter(row =>
    REGISTRATIONS.some(form => form.id === row.registrationId && form.eventId === id)).length,
    present:0, awaitingGuardian:0, room:event.venue };
  return CHECKIN.sessions[id];
}
