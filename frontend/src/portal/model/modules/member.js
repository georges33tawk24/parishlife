/* Purpose: the Member module's connection to ParishLife.Api for the shared view model: the account's linked
   person in this parish (which opens the member pages) and the clergy's Notes & Tasks.
   Main members: keys (NOTES), routes (the portal pages this module feeds), load, save.

   The member pages themselves read their own view model (model/member-data.js, loaded when a member page
   opens). Notes & Tasks (records/notes.jsx) is the priest's pastoral notes and follow-up tasks, so it uses
   the Care pastoral-notes routes; the account-private "My notes" on the member pages use the personal
   workspace (member-data.js). The API has no pin, no Arabic text and no clergy assignee picker for a pastoral
   note: those stay as they were, and a change to them is reported as not saved. */
import { api, parishAPI, newOperationId, session } from '../api.js';

export const keys = ['NOTES'];
export const routes = [
  'activity',
  'memberhome',
  'myministries',
  'mymeetings',
  'mycalendar',
  'myattendance',
  'myfeed',
  'myformation',
  'mycommitments',
  'mynotes',
  'myprofile',
  'myconcerns',
  'membernotifications',
  'memberhub',
  'notes'
];

const PRIORITY = { Low: 'ordinary', Normal: 'attention', High: 'urgent' };
const API_PRIORITY = { ordinary: 'Low', attention: 'Normal', urgent: 'High' };
const VISIBILITY = { Author: 'personal', ParishPriests: 'parish-priests', NamedPriest: 'named-priest' };
const API_VISIBILITY = { personal: 'Author', 'parish-priests': 'ParishPriests' };
const enc = encodeURIComponent;

/* PastoralNoteDto (with its version) → the portal's note or task. The underscore fields are what the
   screen does not edit but a save must send back unchanged. */
const toNote = row => {
  const n = row.value;
  const text = n.body || n.title;
  return {
    id: n.id,
    kind: n.kind === 'Task' ? 'task' : 'note',
    p: n.personId || null,
    at: n.createdAt.slice(0, 10),
    body: text,
    bodyAr: text,
    priority: PRIORITY[n.priority] || 'ordinary',
    due: n.dueAt ? n.dueAt.slice(0, 10) : '',
    done: n.status === 'Done',
    assignee: null,
    pinned: false,
    visibility: VISIBILITY[n.visibility] || 'personal',
    authorUserId: n.authorAccountId,
    _version: row.version,
    _title: n.title,
    _assigneeAccountId: n.assigneeAccountId || null,
    _sharedWithAccountId: n.sharedWithAccountId || null,
    _category: n.category || null
  };
};

export async function load(parish, d) {
  /* The linked person is what opens the member pages. */
  const link = await api(`parishes/${enc(parish.id)}/person-account-links/mine`).catch(e =>
    [400, 403, 404, 409].includes(e.status) ? null : Promise.reject(e)
  );
  parish.personId = link?.value?.personId || null;
  if (session.parishId === parish.id && session.user) session.user.person_id = parish.personId;

  if (!parish.roles?.includes('priest')) return;
  const rows = await api(`parishes/${enc(parish.id)}/pastoral-notes`).catch(e =>
    [400, 403, 404, 409].includes(e.status) ? [] : Promise.reject(e)
  );
  d.NOTES = (rows || []).filter(r => r.value.status !== 'Archived').map(toNote);
}

const title = body => String(body).split('\n')[0].trim().slice(0, 300) || 'Note';

function body(n, version) {
  return {
    operationId: newOperationId(),
    ...(version ? { version } : {}),
    kind: n.kind === 'task' ? 'Task' : 'Note',
    title: n._title && n._title !== title(n._body ?? '') ? n._title : title(n.body),
    body: n.body,
    category: n._category || null,
    personId: n.p || null,
    visibility: API_VISIBILITY[n.visibility] || 'Author',
    sharedWithAccountId: n._sharedWithAccountId || null,
    assigneeAccountId: n._assigneeAccountId || null,
    priority: API_PRIORITY[n.priority] || null,
    dueAt: n.kind === 'task' && n.due ? `${n.due}T00:00:00Z` : null
  };
}

const COPIED = ['body', 'p', 'priority', 'due', 'visibility'];

export async function save(before, now) {
  const was = new Map((before.NOTES || []).map(n => [n.id, n]));
  const is = new Map((now.NOTES || []).map(n => [n.id, n]));
  let unsupported = false,
    saved = false;
  for (const n of is.values()) {
    const old = was.get(n.id);
    if (!old) {
      if (n.pinned) unsupported = true;
      await parishAPI('pastoral-notes', 'POST', body(n));
      saved = true;
      continue;
    }
    if (JSON.stringify(n) === JSON.stringify(old)) continue;
    if (n.pinned !== old.pinned || n.assignee !== old.assignee || (n.bodyAr !== old.bodyAr && n.bodyAr !== n.body))
      unsupported = true; // no pin, assignee picker or Arabic text in the API
    let version = old._version;
    const path = `pastoral-notes/${enc(n.id)}`;
    if (n.done !== old.done) {
      await parishAPI(`${path}/actions`, 'POST', {
        operationId: newOperationId(),
        version,
        action: n.done ? 'complete' : 'reopen'
      });
      version = (await parishAPI(path)).version;
      saved = true;
    }
    if (COPIED.some(k => n[k] !== old[k])) {
      await parishAPI(path, 'PUT', body({ ...n, _title: old._title, _body: old.body }, version));
      saved = true;
    }
  }
  for (const old of was.values()) {
    if (is.has(old.id)) continue;
    await parishAPI(`pastoral-notes/${enc(old.id)}/actions`, 'POST', {
      operationId: newOperationId(),
      version: old._version,
      action: 'archive'
    });
    saved = true;
  }
  return { unsupported, saved };
}
