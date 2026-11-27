/* Purpose: live updates (owner, 27 November 2026: when a new message or something new happens, show it without a
   reload). While the portal is open and visible, it asks the API every 30 seconds, and again when the tab comes back
   into view or the window gets focus (never more often than every 10 seconds): the first page of the account's
   notifications (GET notifications?size=50) and, with a parish open, that parish's conversations (GET
   parishes/{id}/inbox). That is two light requests every 30 seconds, well inside the API's limit of 200 a minute;
   a hidden tab asks nothing. What changed is put where the bell reads it (the NOTIFICATIONS collection for staff,
   M.notifications for members) as freshly loaded data, and every listener is told, so the bell and the inbox draw
   the news without reloading the page.
   Main members: startLive, stopLive, pollNow, subscribe and snapshot (for useSyncExternalStore), onLive
   (called after each poll with { changed }), live (the counts: unread notices, unread conversations). */
import { api, session } from './api.js';
import { replaceLoaded } from './persist.js';
import * as D from './data.js';
import { M, noticeOf } from './member-data.js';
import { toBell } from './modules/communications.js';

const EVERY = 30000,
  GAP = 10000;
export const live = { notices: 0, conversations: 0, round: 0, inbox: '' };
const listeners = new Set();
let timer = 0,
  last = 0,
  busy = false,
  feed = '';

export const subscribe = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const snapshot = () => live.round;
const hooks = new Set();
/* fn({ changed, inboxChanged }) after each poll */
export const onLive = fn => {
  hooks.add(fn);
  return () => hooks.delete(fn);
};

const visible = () => typeof document === 'undefined' || !document.hidden;

/* The newest notices replace their older copies; older ones the first page no longer carries are kept. */
function merge(previous, fresh, idOf) {
  const ids = new Set(fresh.map(idOf));
  return [...fresh, ...previous.filter(x => !ids.has(idOf(x)))];
}

export async function pollNow(force = false) {
  if (!session.user || busy || !visible()) return;
  if (!force && Date.now() - last < GAP) return;
  busy = true;
  last = Date.now();
  try {
    const parish = session.parishes.find(p => p.id === session.parishId);
    const [page, conversations] = await Promise.all([
      api('notifications?size=50'),
      parish ? api(`parishes/${encodeURIComponent(parish.id)}/inbox`).catch(() => null) : null
    ]);
    if (!session.user) return;
    const items = (page?.items || []).filter(n => n.status !== 'Archived');
    const signature = items.map(n => n.id + ':' + n.status).join('|');
    const inbox = (conversations || []).map(c => `${c.id}:${c.lastMessageAt}:${c.unread}`).join('|');
    const changed = signature !== feed,
      inboxChanged = inbox !== live.inbox;
    feed = signature;
    live.inbox = inbox;
    live.notices = items.filter(n => n.status === 'Unread').length;
    live.conversations = (conversations || []).filter(c => c.unread && !c.archived).length;
    if (changed) {
      if (parish)
        replaceLoaded(
          'NOTIFICATIONS',
          merge(
            D.NOTIFICATIONS,
            items.filter(n => !n.parishId || n.parishId === parish.id).map(n => toBell(n, parish)),
            n => n[5]
          )
        );
      M.notifications = merge(M.notifications, items.map(noticeOf), n => n.id);
    }
    live.round++;
    listeners.forEach(fn => fn());
    hooks.forEach(fn => fn({ changed, inboxChanged }));
  } catch (error) {
    if (error?.status === 401) stopLive(); // signed out elsewhere: the next action shows the sign-in page
  } finally {
    busy = false;
  }
}

const wake = () => {
  if (visible()) pollNow();
};

export function startLive() {
  stopLive();
  feed = '';
  live.inbox = '';
  timer = setInterval(() => pollNow(true), EVERY);
  document.addEventListener('visibilitychange', wake);
  addEventListener('focus', wake);
  pollNow(true);
}

export function stopLive() {
  clearInterval(timer);
  timer = 0;
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', wake);
    removeEventListener('focus', wake);
  }
  Object.assign(live, { notices: 0, conversations: 0, inbox: '' });
}
