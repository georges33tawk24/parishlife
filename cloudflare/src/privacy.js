/* Privacy: private messages, their emergency review, and who receives a complaint. Ported from server.py.
   A conversation is private to the people in it. Writing to a parish office reaches the accounts that
   answer the office inbox there now; writing to a ministry reaches its current leader and assistant.
   Nobody else reads it, whatever their rank. Messages are never edited or deleted; archiving only tidies
   the archiving account's own inbox. A super admin can open one conversation for a recorded reason, as a
   separate, audited emergency review; that never reaches notes or the identity of an anonymous complaint.
   (The tables are in authority.js's PRIVACY_SCHEMA; pastoral-note visibility is in notes.js.) */
import { Problem, need, get, iter, str, strip, tokenHex, sha256hex, NOW, casefold } from './py.js';
import { authority, parishContext, systemPerms, ROLE_TITLES, clean } from './authority.js';
import { audit } from './app.js';
import { notifyAccount, groupLeaderAccounts, parishPriestAccounts } from './ministries.js';

export const MESSAGES_PER_PAGE = 10;
const placeholders = list => list.map(() => '?').join(',');
const stateOf = async (c, pid) => {
  const row = await c.first('SELECT data FROM states WHERE parish_id=?', pid);
  return row ? JSON.parse(row.data) : null;
};

/* Additive and run once each: earlier one-to-one portal messages are copied into conversations (the
   originals stay where they were), each earlier pastoral note gets the author it had in practice and
   stays personal, and each earlier complaint keeps exactly the people who could already see it. */
export async function migratePrivacy(c) {
  const [messagesDone, concernsDone, pendingNotes] = await c.reads([
    ["SELECT 1 AS x FROM schema_migrations WHERE name='v2-messages'", []],
    ["SELECT 1 AS x FROM schema_migrations WHERE name='v2-concerns'", []],
    ["SELECT parish_id,data FROM states WHERE 'v2-notes:'||parish_id NOT IN (SELECT name FROM schema_migrations)", []]
  ]);
  if (!messagesDone.length) {
    const threads = new Map();
    const rows = await c.all("SELECT * FROM member_content WHERE kind='message' AND recipient_id IS NOT NULL ORDER BY created_at,id");
    const privates = new Map();
    const privateOf = async (pid, userId) => {
      const key = pid + '|' + userId;
      if (!privates.has(key)) {
        const row = await c.first('SELECT data FROM member_private WHERE parish_id=? AND user_id=?', pid, userId);
        privates.set(key, row ? JSON.parse(row.data) : {});
      }
      return privates.get(key);
    };
    for (const r of rows) {
      let title = r.title;
      while (title.startsWith('Re: ')) title = title.slice(4);
      const key = JSON.stringify([r.parish_id, r.group_id || '', [r.author_id, r.recipient_id].sort(), title]);
      let convId = threads.get(key);
      if (convId === undefined) {
        convId = 'cv-' + sha256hex('legacy|' + r.id).slice(0, 20);
        threads.set(key, convId);
        c.run('INSERT OR IGNORE INTO conversations(id,reference,kind,subject,parish_id,group_id,context,created_by,created_at,last_at,legacy_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          convId, conversationReference(convId), 'direct', title || 'Message', r.parish_id, r.group_id,
          JSON.stringify(await conversationContext(c, r.parish_id, r.group_id)), r.author_id, r.created_at, r.created_at, r.id);
      }
      c.run('INSERT OR IGNORE INTO conversation_messages VALUES(?,?,?,?,?,?)', 'cm-' + sha256hex('legacy|' + r.id).slice(0, 20), convId, r.author_id, 'person', r.body, r.created_at);
      c.run('UPDATE conversations SET last_at=max(last_at,?) WHERE id=?', r.created_at, convId);
      for (const userId of [r.author_id, r.recipient_id]) {
        const priv = await privateOf(r.parish_id, userId);
        const read = userId === r.author_id || iter(get(priv, 'readIds', [])).includes(r.id);
        c.run('INSERT OR IGNORE INTO conversation_members VALUES(?,?,?,?,?)', convId, userId, 'person', '', 0);
        if (read) c.run('UPDATE conversation_members SET read_at=max(read_at,?) WHERE conversation_id=? AND user_id=?', r.created_at, convId, userId);
        c.run('UPDATE conversation_members SET archived=? WHERE conversation_id=? AND user_id=?',
          iter(get(priv, 'archivedIds', [])).includes(r.id) ? 1 : 0, convId, userId);
      }
    }
    c.run("INSERT OR IGNORE INTO schema_migrations VALUES('v2-messages',?)", NOW());
  }
  /* Each parish's earlier notes go to its priest once it has a priest account (until then nobody could read them). */
  for (const row of pendingNotes) {
    const d = JSON.parse(row.data);
    if (iter(d.NOTES).some(n => !n.authorId)) {
      const owner = await legacyNoteOwner(c, row.parish_id);
      if (owner === null) continue;
      for (const n of d.NOTES) {
        if (!n.authorId) {
          Object.assign(n, { authorId: owner.user_id, visibility: 'personal' });
          if (!Object.prototype.hasOwnProperty.call(n, 'by')) n.by = owner.person_id;
        }
      }
      c.run('UPDATE states SET data=? WHERE parish_id=?', JSON.stringify(d), row.parish_id);
    }
    c.run('INSERT OR IGNORE INTO schema_migrations VALUES(?,?)', 'v2-notes:' + row.parish_id, NOW());
  }
  if (!concernsDone.length) {
    const at = NOW();
    for (const r of await c.all('SELECT * FROM member_concerns')) {
      for (const userId of await existingConcernAccess(c, r)) c.run('INSERT OR IGNORE INTO concern_recipients VALUES(?,?,?,?)', r.id, userId, 'existing-access', at);
    }
    c.run("INSERT OR IGNORE INTO schema_migrations VALUES('v2-concerns',?)", NOW());
  }
}

/* Who wrote a parish's earlier pastoral notes: until now only its priests could, so its parish priest
   (or, without one on record, its first priest account). */
async function legacyNoteOwner(c, pid) {
  const [priests, lead] = await c.reads([
    ["SELECT user_id,person_id FROM parish_accounts WHERE parish_id=? AND role='priest' ORDER BY user_id", [pid]],
    ["SELECT cl.user_id FROM clergy_assignments a JOIN clergy cl ON cl.id=a.clergy_id WHERE a.parish_id=? AND a.office='parish-priest' AND a.end_date IS NULL AND cl.user_id IS NOT NULL ORDER BY a.start_date DESC", [pid]]
  ]);
  if (!priests.length) return null;
  return priests.find(p => lead.length && p.user_id === lead[0].user_id) ?? priests[0];
}

/* The accounts that could see an earlier complaint under the earlier rules: appointed reviewers (as the
   case's sensitivity and assignment allowed), the reviewer it was assigned to, and, for an ordinary
   complaint about a ministry, that ministry's leaders. */
async function existingConcernAccess(c, r) {
  const { sensitive_concern } = await import('./member.js');
  const users = new Set();
  if (r.assigned_to) users.add(r.assigned_to);
  for (const row of await c.all('SELECT user_id,permissions FROM complaint_reviewers WHERE parish_id=?', r.parish_id)) {
    const perms = new Set(JSON.parse(row.permissions));
    if (perms.has('Review') && (!sensitive_concern(r.category) || perms.has('ViewSensitive')) &&
      (!r.assigned_to || r.assigned_to === row.user_id || perms.has('Assign'))) users.add(row.user_id);
  }
  if (r.group_id && !sensitive_concern(r.category)) {
    const state = await stateOf(c, r.parish_id);
    const group = state ? iter(state.GROUPS).find(g => g.id === r.group_id) ?? null : null;
    if (group) {
      for (const x of await c.all("SELECT user_id FROM parish_accounts WHERE parish_id=? AND role='leader' AND person_id IN (?,?)",
        r.parish_id, group.leader || '', group.assistant || '')) users.add(x.user_id);
    }
  }
  return [...users].sort();
}

/* ---- messages ---- */
export const conversationReference = convId => 'MSG-' + sha256hex(convId).slice(0, 8).toUpperCase();

/* Names shown on a conversation card, kept as they were when it started. */
export async function conversationContext(c, pid, groupId = null) {
  if (!pid) return {};
  const row = await c.first('SELECT metadata FROM parishes WHERE id=?', pid);
  const meta = row ? JSON.parse(row.metadata) : {};
  const out = { parish: meta.name ?? '', parishAr: meta.ar ?? '' };
  if (groupId) {
    const state = await stateOf(c, pid);
    const group = state ? iter(state.GROUPS).find(g => g.id === groupId) ?? {} : {};
    Object.assign(out, { group: group.name ?? '', groupAr: group.ar ?? group.name ?? '' });
  }
  return out;
}

export async function blockedAccounts(c) {
  return (await c.all('SELECT user_id,scope,scope_id FROM access_blocks WHERE lifted_at IS NULL'))
    .map(r => [r.user_id, r.scope, r.scope_id]);
}

export const reachable = (blocked, userId, pid, diocese) => !blocked.some(([user, scope, scopeId]) => user === userId &&
  (scope === 'global' || (scope === 'diocese' && scopeId === diocese) || (scope === 'parish' && scopeId === pid)));

/* Each parish this account is connected to, with its role there and whether it answers the office inbox. */
async function messagePlaces(c, u, auth = null) {
  auth = auth ?? await authority(c, u);
  const out = [];
  for (const r of await c.all('SELECT * FROM parishes ORDER BY rowid')) {
    const ctx = await parishContext(c, u, r.id, auth, r);
    if (ctx === null) continue;
    const meta = JSON.parse(r.metadata);
    out.push({ id: r.id, diocese: r.diocese, name: meta.name ?? '', ar: meta.ar ?? '', ctx });
  }
  return out;
}

/* The ministries this account leads or assists in a parish, now. */
async function handledGroups(c, place) {
  const personId = place.ctx.person_id;
  if (!personId || ['follower', 'bishop'].includes(place.ctx.role)) return [];
  const state = await stateOf(c, place.id);
  return state ? iter(state.GROUPS).filter(g => [g.leader, g.assistant].includes(personId)) : [];
}

/* Who this account may start a conversation with: the office of each parish it belongs to, follows,
   serves or oversees; the ministries of each parish it belongs to or serves; and, there, the staff and
   the members who agreed to be listed in the parish directory. */
export async function messageDirectory(c, u) {
  const places = await messagePlaces(c, u);
  const blocked = await blockedAccounts(c);
  const offices = [], ministries = [], people = new Map();
  for (const place of places) {
    offices.push({ parish: place.id, name: place.name, ar: place.ar });
    if (['follower', 'bishop'].includes(place.ctx.role)) continue;
    const state = await stateOf(c, place.id);
    for (const g of iter(state.GROUPS)) {
      if ((await groupLeaderAccounts(c, place.id, g)).length)
        ministries.push({ parish: place.id, parishName: place.name, group: g.id, name: g.name ?? '', ar: g.ar ?? g.name ?? '' });
    }
    const extra = state.PERSON_EXTRA ?? {};
    const rows = await c.all('SELECT a.user_id,a.person_id,a.role,u.name,p.data FROM parish_accounts a JOIN users u ON u.id=a.user_id ' +
      'LEFT JOIN user_profiles p ON p.user_id=a.user_id WHERE a.parish_id=? ORDER BY u.name', place.id);
    for (const r of rows) {
      if (r.user_id === u.id || !reachable(blocked, r.user_id, place.id, place.diocese)) continue;
      const listed = r.role !== 'member' || (extra[r.person_id ?? ''] ?? {}).directory === true || JSON.parse(r.data || '{}').directory === true;
      if (!listed) continue;
      if (!people.has(r.user_id)) people.set(r.user_id, { id: r.user_id, name: r.name, places: [] });
      const entry = people.get(r.user_id);
      const role = ROLE_TITLES[r.role] ?? ['', ''];
      if (!entry.places.some(p => p.parish === place.id && p.role === role[0]))
        entry.places.push({ parish: place.id, name: place.name, role: role[0], roleAr: role[1] });
    }
  }
  return { offices, ministries, people: [...people.values()].sort((a, b) => casefold(a.name) < casefold(b.name) ? -1 : casefold(a.name) > casefold(b.name) ? 1 : 0) };
}

/* How this account takes part: 'person' (it is in the conversation), 'office' or 'ministry' (it answers
   for the parish office or the ministry today), or null. Rank never opens a conversation. */
export async function conversationSide(c, u, conv, places = null) {
  if (await c.first("SELECT 1 AS x FROM conversation_members WHERE conversation_id=? AND user_id=? AND side='person'", conv.id, u.id)) return 'person';
  if (!['office', 'ministry'].includes(conv.kind) || !conv.parish_id) return null;
  const place = (places ?? await messagePlaces(c, u)).find(p => p.id === conv.parish_id) ?? null;
  if (place === null) return null;
  if (conv.kind === 'office') return place.ctx.perms.has('messages.office') ? 'office' : null;
  return (await handledGroups(c, place)).some(g => g.id === conv.group_id) ? 'ministry' : null;
}

/* The accounts that answer for a conversation's office or ministry today. */
async function handlers(c, conv) {
  if (conv.kind === 'office') {
    const out = [];
    for (const r of await c.all("SELECT DISTINCT user_id FROM parish_accounts WHERE parish_id=? AND role<>'member'", conv.parish_id)) {
      const account = await c.first('SELECT * FROM users WHERE id=?', r.user_id);
      const ctx = account ? await parishContext(c, account, conv.parish_id) : null;
      if (ctx && ctx.perms.has('messages.office')) out.push(r.user_id);
    }
    return out;
  }
  if (conv.kind === 'ministry') {
    const state = await stateOf(c, conv.parish_id);
    const group = state ? iter(state.GROUPS).find(g => g.id === conv.group_id) ?? null : null;
    return group ? groupLeaderAccounts(c, conv.parish_id, group) : [];
  }
  return [];
}

const CARD_SQL = 'SELECT c.*,m.read_at AS my_read,m.archived AS my_archived,m.side AS my_side,' +
  '(SELECT COUNT(*) FROM conversation_messages x WHERE x.conversation_id=c.id) AS total,' +
  'l.body AS last_body,l.author_id AS last_author,l.side AS last_side,l.created_at AS last_created ' +
  'FROM conversations c LEFT JOIN conversation_members m ON m.conversation_id=c.id AND m.user_id=? ' +
  'LEFT JOIN conversation_messages l ON l.id=(SELECT x.id FROM conversation_messages x WHERE x.conversation_id=c.id ' +
  'ORDER BY x.created_at DESC,x.id DESC LIMIT 1) ';

export async function namesOf(c, ids) {
  const list = [...new Set(ids.filter(Boolean))].sort();
  if (!list.length) return new Map();
  return new Map((await c.all(`SELECT id,name FROM users WHERE id IN (${placeholders(list)})`, ...list)).map(r => [r.id, r.name]));
}

const cardUnread = (u, r) => Boolean(r.last_author && r.last_author !== u.id && r.last_created > (r.my_read || ''));

/* Cards for a page of conversations: who it is with, the latest message in brief, read and archived state. */
async function conversationCards(c, u, rows) {
  const ids = rows.map(r => r.id);
  const people = new Map();
  if (ids.length) {
    for (const r of await c.all(`SELECT conversation_id,user_id FROM conversation_members WHERE side='person' AND user_id<>? AND conversation_id IN (${placeholders(ids)}) ORDER BY user_id`, u.id, ...ids)) {
      if (!people.has(r.conversation_id)) people.set(r.conversation_id, []);
      people.get(r.conversation_id).push(r.user_id);
    }
  }
  const names = await namesOf(c, [...[...people.values()].flat(), ...rows.map(r => r.last_author)]);
  return rows.map(r => ({ id: r.id, reference: r.reference, kind: r.kind, subject: r.subject,
    side: r.my_side === 'person' ? 'person' : r.kind, parish: r.parish_id, group: r.group_id,
    context: JSON.parse(r.context || '{}'), people: (people.get(r.id) ?? []).map(x => names.get(x) ?? ''),
    lastAt: r.last_at, snippet: str(r.last_body || '').slice(0, 160), lastAuthor: names.get(r.last_author) ?? '',
    lastSide: r.last_side || '', lastMine: r.last_author === u.id, count: r.total,
    unread: cardUnread(u, r), archived: Boolean(r.my_archived) }));
}

/* One page of the account's conversations, newest first, after its search and box filters. */
export async function messagesList(c, u, q) {
  const box = get(q, 'box') || 'inbox';
  need(['inbox', 'unread', 'archived', 'all'].includes(box), 'Unknown mailbox.');
  const places = await messagePlaces(c, u);
  const officePids = places.filter(p => p.ctx.perms.has('messages.office')).map(p => p.id);
  const led = [];
  for (const p of places) for (const g of await handledGroups(c, p)) led.push([p.id, g.id]);
  const clauses = ["c.id IN (SELECT conversation_id FROM conversation_members WHERE user_id=? AND side='person')"];
  const args = [u.id, u.id];
  if (officePids.length) { clauses.push(`(c.kind='office' AND c.parish_id IN (${placeholders(officePids)}))`); args.push(...officePids); }
  for (const [pid, gid] of led) { clauses.push("(c.kind='ministry' AND c.parish_id=? AND c.group_id=?)"); args.push(pid, gid); }
  let where = '(' + clauses.join(' OR ') + ')';
  const term = str(get(q, 'q') ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, 100);
  if (term) {
    const pattern = '%' + term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_') + '%';
    where += " AND (c.subject LIKE ? ESCAPE '\\' OR c.reference LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM conversation_messages x " +
      "WHERE x.conversation_id=c.id AND x.body LIKE ? ESCAPE '\\'))";
    args.push(pattern, pattern, pattern);
  }
  let rows = await c.all(CARD_SQL + `WHERE ${where} ORDER BY c.last_at DESC,c.id`, ...args);
  const unread = rows.filter(r => cardUnread(u, r) && !r.my_archived).length;
  rows = rows.filter(r => box === 'all' || ((box === 'archived') === Boolean(r.my_archived) && (box !== 'unread' || cardUnread(u, r))));
  const pages = Math.max(1, Math.ceil(rows.length / MESSAGES_PER_PAGE));
  const asked = get(q, 'page');
  const page = Math.min(Number.isInteger(asked) && asked > 0 ? asked : 1, pages);
  return { conversations: await conversationCards(c, u, rows.slice((page - 1) * MESSAGES_PER_PAGE, page * MESSAGES_PER_PAGE)),
    page, pages, total: rows.length, unread, perPage: MESSAGES_PER_PAGE };
}

const messageView = (row, names, me = null) => ({ id: row.id, author: names.get(row.author_id) ?? '', mine: row.author_id === me,
  side: row.side, body: row.body, at: row.created_at });

async function conversationOpen(c, u, convId) {
  const conv = await c.first('SELECT * FROM conversations WHERE id=?', convId);
  const side = conv ? await conversationSide(c, u, conv) : null;
  need(side !== null, 'Conversation not found.', 404);
  const rows = await c.all('SELECT * FROM conversation_messages WHERE conversation_id=? ORDER BY created_at,id', conv.id);
  const names = await namesOf(c, rows.map(r => r.author_id));
  c.run('INSERT INTO conversation_members(conversation_id,user_id,side,read_at,archived) VALUES(?,?,?,?,0) ' +
    'ON CONFLICT(conversation_id,user_id) DO UPDATE SET read_at=excluded.read_at', conv.id, u.id, side, NOW());
  const card = { ...(await conversationCards(c, u, await c.all(CARD_SQL + 'WHERE c.id=?', u.id, conv.id)))[0], unread: false };
  const report = await c.first("SELECT 1 AS x FROM conversation_reports WHERE conversation_id=? AND reporter_id=? AND status='open'", conv.id, u.id);
  return { conversation: card, messages: rows.map(r => messageView(r, names, u.id)), reported: Boolean(report) };
}

/* Adds a message. `people` lists the other participants when the conversation is new in this request. */
export async function conversationPost(c, u, conv, side, body, at, people = null) {
  c.run('INSERT INTO conversation_messages VALUES(?,?,?,?,?,?)', 'cm-' + tokenHex(10), conv.id, u.id, side, body, at);
  c.run('UPDATE conversations SET last_at=? WHERE id=?', at, conv.id);
  c.run('INSERT INTO conversation_members(conversation_id,user_id,side,read_at,archived) VALUES(?,?,?,?,0) ' +
    'ON CONFLICT(conversation_id,user_id) DO UPDATE SET read_at=excluded.read_at,archived=0', conv.id, u.id, side, at);
  /* A new message brings the conversation back to the others' inboxes; they are told without its text. */
  c.run('UPDATE conversation_members SET archived=0 WHERE conversation_id=? AND user_id<>?', conv.id, u.id);
  if (people === null) {
    people = (await c.all("SELECT user_id FROM conversation_members WHERE conversation_id=? AND side='person' AND user_id<>?", conv.id, u.id)).map(r => r.user_id);
  }
  const targets = new Set(people);
  if (side === 'person') for (const x of await handlers(c, conv)) if (x !== u.id) targets.add(x);
  for (const userId of [...targets].sort()) notifyAccount(c, userId, conv.parish_id, 'message', 'New message: ' + conv.subject, '', 'inbox/' + conv.id);
}

async function newConversation(c, u, kind, subject, pid, groupId, at) {
  const conv = { id: 'cv-' + tokenHex(10), kind, subject, parish_id: pid, group_id: groupId };
  conv.reference = conversationReference(conv.id);
  c.run('INSERT INTO conversations(id,reference,kind,subject,parish_id,group_id,context,created_by,created_at,last_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    conv.id, conv.reference, kind, subject, pid, groupId, JSON.stringify(await conversationContext(c, pid, groupId)), u.id, at, at);
  return conv;
}

/* A new conversation with a parish office, a ministry or a person in this account's directory. */
export async function conversationStart(c, u, q, at = null) {
  at = at ?? NOW();
  const subject = clean(get(q, 'subject'), 160, 'Enter a subject of up to 160 characters.');
  const body = strip(str(get(q, 'body') ?? ''));
  need(body.length > 0 && body.length <= 5000, 'Write a message of up to 5000 characters.');
  const to = get(q, 'to') !== null && typeof get(q, 'to') === 'object' && !Array.isArray(get(q, 'to')) ? get(q, 'to') : {};
  const directory = await messageDirectory(c, u);
  let pid = null, groupId = null, people = [];
  const kind = to.kind;
  if (kind === 'office') {
    need(directory.offices.some(o => o.parish === to.parish), 'Choose a parish you are connected to.', 403);
    pid = to.parish;
  } else if (kind === 'ministry') {
    need(directory.ministries.some(m => m.parish === to.parish && m.group === to.group), 'Choose a ministry of a parish you belong to.', 403);
    pid = to.parish; groupId = to.group;
  } else if (kind === 'direct') {
    const ids = to.people;
    const reachableIds = new Map(directory.people.map(p => [p.id, p]));
    need(Array.isArray(ids) && ids.length > 0 && ids.length <= 10 && new Set(ids).size === ids.length && ids.every(i => reachableIds.has(i)),
      'Choose up to ten people from the directory.', 403);
    people = ids;
    const shared = reachableIds.get(ids[0]).places.map(p => p.parish);
    pid = shared.includes(to.parish) ? to.parish : (shared[0] ?? null);
  } else {
    throw new Problem(400, 'Choose who the message is for.');
  }
  const conv = await newConversation(c, u, kind, subject, pid, groupId, at);
  c.run('INSERT INTO conversation_members VALUES(?,?,?,?,0)', conv.id, u.id, 'person', at);
  for (const userId of people) c.run('INSERT INTO conversation_members VALUES(?,?,?,?,0)', conv.id, userId, 'person', '');
  await conversationPost(c, u, conv, 'person', body, at, people);
  return conv;
}

/* The parish office (or a ministry's leader) writing to a person in its records: the reply comes back
   to the office inbox (or the ministry's leaders), not to whoever happened to send it. */
export async function officeConversation(c, u, pid, personId, subject, body, groupId = null) {
  const account = await c.first('SELECT user_id FROM parish_accounts WHERE parish_id=? AND person_id=? LIMIT 1', pid, personId);
  need(account !== null, 'This person does not have an active in-app account.', 404);
  const at = NOW();
  const kind = groupId ? 'ministry' : 'office';
  const conv = await newConversation(c, u, kind, subject, pid, groupId, at);
  c.run('INSERT INTO conversation_members VALUES(?,?,?,?,0)', conv.id, account.user_id, 'person', '');
  await conversationPost(c, u, conv, kind, body, at, [account.user_id]);
  return conv;
}

async function systemReviewers(c) {
  const out = [];
  for (const r of await c.all("SELECT DISTINCT user_id FROM role_assignments WHERE scope='system' AND status='active'")) {
    const account = await c.first('SELECT * FROM users WHERE id=?', r.user_id);
    if (account && systemPerms(await authority(c, account)).has('messages.emergency')) out.push(r.user_id);
  }
  return out;
}

export async function messagesAction(c, u, q) {
  const op = get(q, 'op');
  if (op === 'list') return messagesList(c, u, q);
  if (op === 'directory') return messageDirectory(c, u);
  if (op === 'open') return conversationOpen(c, u, get(q, 'id'));
  if (op === 'start') {
    const conv = await conversationStart(c, u, q);
    return { id: conv.id, reference: conv.reference };
  }
  if (['emergencyOpen', 'reports', 'reportClose'].includes(op)) return emergencyAction(c, u, q);
  const conv = await c.first('SELECT * FROM conversations WHERE id=?', get(q, 'id'));
  const side = conv ? await conversationSide(c, u, conv) : null;
  need(side !== null, 'Conversation not found.', 404);
  const at = NOW();
  if (op === 'reply') {
    const body = strip(str(get(q, 'body') ?? ''));
    need(body.length > 0 && body.length <= 5000, 'Write a reply of up to 5000 characters.');
    await conversationPost(c, u, conv, side, body, at);
  } else if (['archive', 'unarchive', 'markUnread', 'markRead'].includes(op)) {
    c.run('INSERT INTO conversation_members(conversation_id,user_id,side,read_at,archived) VALUES(?,?,?,?,0) ON CONFLICT(conversation_id,user_id) DO NOTHING',
      conv.id, u.id, side, '');
    if (op === 'archive' || op === 'unarchive') c.run('UPDATE conversation_members SET archived=? WHERE conversation_id=? AND user_id=?', op === 'archive' ? 1 : 0, conv.id, u.id);
    else c.run('UPDATE conversation_members SET read_at=? WHERE conversation_id=? AND user_id=?', op === 'markUnread' ? '' : at, conv.id, u.id);
  } else if (op === 'report') {
    const reason = clean(get(q, 'reason'), 1000, 'Say in up to 1000 characters what the problem is.');
    need(reason.length >= 10, 'Say in a sentence what the problem is.');
    need(!(await c.first("SELECT 1 AS x FROM conversation_reports WHERE conversation_id=? AND reporter_id=? AND status='open'", conv.id, u.id)),
      'You have already reported this conversation.');
    c.run('INSERT INTO conversation_reports(id,conversation_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)', 'rp-' + tokenHex(10), conv.id, u.id, reason, at);
    for (const userId of await systemReviewers(c)) notifyAccount(c, userId, null, 'report', 'A conversation was reported for review', conv.reference, 'inbox');
  } else {
    throw new Problem(400, 'Unknown action.');
  }
  return {};
}

/* A super admin's problem review. Each opening names one conversation and records why; there is no
   browsing, and nothing else (notes, complaint identities) is reachable from here. */
async function emergencyAction(c, u, q) {
  need(systemPerms(await authority(c, u)).has('messages.emergency'), 'Emergency review is reserved for super admins.', 403);
  const op = get(q, 'op');
  if (op === 'reports') {
    const [reports, reviews] = await c.reads([
      ["SELECT r.*,c.reference FROM conversation_reports r JOIN conversations c ON c.id=r.conversation_id ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 200", []],
      ['SELECT e.*,c.reference FROM emergency_reviews e JOIN conversations c ON c.id=e.conversation_id ORDER BY e.created_at DESC LIMIT 200', []]
    ]);
    const names = await namesOf(c, [...reports.map(r => r.reporter_id), ...reviews.map(r => r.reviewer_id)]);
    return {
      reports: reports.map(r => ({ id: r.id, conversation: r.conversation_id, reference: r.reference, reason: r.reason,
        reporter: names.get(r.reporter_id) ?? '', at: r.created_at, status: r.status, closedAt: r.closed_at || '', closeNote: r.close_note })),
      reviews: reviews.map(r => ({ reference: r.reference, reviewer: names.get(r.reviewer_id) ?? '', reason: r.reason, at: r.created_at }))
    };
  }
  if (op === 'reportClose') {
    const report = await c.first("SELECT * FROM conversation_reports WHERE id=? AND status='open'", get(q, 'id'));
    need(report !== null, 'Report not found.', 404);
    const note = clean(get(q, 'note'), 1000, 'Keep the note within 1000 characters.', false);
    c.run("UPDATE conversation_reports SET status='closed',closed_at=?,closed_by=?,close_note=? WHERE id=?", NOW(), u.id, note, report.id);
    return {};
  }
  const reason = clean(get(q, 'reason'), 1000, 'Record the reason for this review in up to 1000 characters.');
  need(reason.length >= 20, 'Record the reason for this review in a full sentence (at least 20 characters).');
  const report = get(q, 'reportId') ? await c.first('SELECT * FROM conversation_reports WHERE id=?', get(q, 'reportId')) : null;
  const reference = strip(str(get(q, 'reference') ?? '')).toUpperCase();
  const conv = report ? await c.first('SELECT * FROM conversations WHERE id=?', report.conversation_id)
    : reference ? await c.first('SELECT * FROM conversations WHERE reference=?', reference) : null;
  need(conv !== null, 'Name the reported conversation or its reference.', 404);
  const at = NOW();
  c.run('INSERT INTO emergency_reviews VALUES(?,?,?,?,?,?)', 'er-' + tokenHex(10), conv.id, u.id, reason, report ? report.id : null, at);
  audit(c, u, conv.parish_id, 'messages.emergency-review', { conversation: conv.reference, reason });
  const [rows, members] = await c.reads([
    ['SELECT * FROM conversation_messages WHERE conversation_id=? ORDER BY created_at,id', [conv.id]],
    ["SELECT user_id FROM conversation_members WHERE conversation_id=? AND side='person'", [conv.id]]
  ]);
  const names = await namesOf(c, [...members.map(r => r.user_id), ...rows.map(r => r.author_id)]);
  return { conversation: { reference: conv.reference, subject: conv.subject, kind: conv.kind, context: JSON.parse(conv.context || '{}'),
    people: members.map(r => names.get(r.user_id) ?? ''), createdAt: conv.created_at }, messages: rows.map(r => messageView(r, names)), recordedAt: at };
}

/* ---- complaints ----
   The person raising one chooses who receives it from the people suggested for its context; only they
   (and nobody by rank) see it, its status or that it exists. Identity stays the submitter's choice. */

/* Who a complaint can go to: the parish's priests, the leaders of the submitter's ministries and the
   reviewers the parish appointed, each with the contexts it is suggested for. */
export async function concernRecipientOptions(c, u, pid, d, gids) {
  const blocked = await blockedAccounts(c);
  const diocese = (await c.first('SELECT diocese FROM parishes WHERE id=?', pid)).diocese;
  const options = new Map();
  const add = (userId, role, roleAr, suggest) => {
    if (userId === u.id || !reachable(blocked, userId, pid, diocese)) return;
    if (!options.has(userId)) options.set(userId, { id: userId, name: '', roles: [], suggested: [] });
    const item = options.get(userId);
    if (!item.roles.some(r => r.en === role)) item.roles.push({ en: role, ar: roleAr });
    for (const s of suggest) if (!item.suggested.includes(s)) item.suggested.push(s);
  };
  const groups = [...gids].sort();
  for (const userId of await parishPriestAccounts(c, pid)) add(userId, 'Priest of the parish', 'كاهن الرعية', ['parish', ...groups.map(g => 'group:' + g)]);
  for (const g of iter(d.GROUPS)) {
    if (!gids.has(g.id)) continue;
    for (const userId of await groupLeaderAccounts(c, pid, g)) add(userId, 'Leader of ' + (g.name ?? ''), 'مسؤول ' + (g.ar ?? g.name ?? ''), ['group:' + g.id]);
  }
  for (const r of await c.all('SELECT user_id,permissions FROM complaint_reviewers WHERE parish_id=?', pid)) {
    if (JSON.parse(r.permissions).includes('Review')) add(r.user_id, 'Appointed reviewer', 'مراجِع معيَّن', ['sensitive']);
  }
  const names = await namesOf(c, [...options.keys()]);
  for (const item of options.values()) item.name = names.get(item.id) ?? '';
  return [...options.values()].sort((a, b) => casefold(a.name) < casefold(b.name) ? -1 : casefold(a.name) > casefold(b.name) ? 1 : 0);
}

export const concernRecipientIds = async (c, concernId) =>
  (await c.all('SELECT user_id FROM concern_recipients WHERE concern_id=? ORDER BY added_at,user_id', concernId)).map(r => r.user_id);
