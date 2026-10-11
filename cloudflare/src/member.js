/* Member portal logic ported from server.py (member_view, member_action and helpers). */
import {
  Problem, PyError, need, truthy, eq, has, get, K, setItem, iter, len, slice, strip, str, set, union, intersection,
  subset, intersects, any, all, items, add, ge, lt, sorted, isDict, isList, isStr, isBool, isdigit, fromisoformat,
  toOrdinal, casefold, NOW, TODAY, localToday, nowHM, tokenHex, sha256hex, b64decode, keyed, isoDate, le, pad3
} from './py.js';
import { access, audit, notify_member, memberPrivateRows, privateData, CONCERN_CATEGORIES, CONCERN_STATUSES } from './app.js';
import { REQUEST_LABELS, CERTIFICATE_OF, CERTIFICATE_LANGUAGES, request_subjects, sacrament_conflict, request_subject_key,
  member_request_item, member_request_options } from './requests.js';

const SENSITIVE_CONCERNS = new Set(['Leadership', 'Behaviour or conduct', 'Safety', 'Financial concerns',
  'Harassment or inappropriate behaviour']);
const CATEGORY_SET = new Set(CONCERN_CATEGORIES);

/* New categories are restricted until a category-specific policy is available. */
export const sensitive_concern = category => has(SENSITIVE_CONCERNS, category) || !has(CATEGORY_SET, category);

export function complaint_log(c, concernId, actorId, action, detail = '') {
  c.run('INSERT INTO complaint_audit(concern_id,actor_id,action,detail,created_at) VALUES(?,?,?,?,?)', concernId, actorId, action, detail, NOW());
}

export async function member_context(c, u, pid) {
  await access(c, u, pid);
  need(K(u, 'role') !== 'bishop', 'This portal is not available to a bishop account.', 403);
  const row = await c.first('SELECT data FROM states WHERE parish_id=?', pid);
  if (row === null) throw new PyError("'NoneType' object is not subscriptable");
  const d = JSON.parse(row.data);
  let person = truthy(K(u, 'person_id')) ? iter(K(d, 'PEOPLE')).find(p => eq(K(p, 'id'), K(u, 'person_id'))) ?? null : null;
  if (K(u, 'role') === 'member') need(person !== null, 'Your person record is not active in this parish.', 403);
  else person = truthy(person) ? person : { id: '', lat: K(u, 'name') };
  const gids = set(iter(K(d, 'GROUPS')).filter(g => any(get(get(K(d, 'GROUP_DETAIL'), K(g, 'id'), {}), 'roster', []),
    r => eq(get(r, 'p'), K(u, 'person_id')))).map(g => K(g, 'id')));
  return [d, person, gids];
}

export async function member_private(c, u, pid) {
  const row = await c.first('SELECT data FROM member_private WHERE parish_id=? AND user_id=?', pid, K(u, 'id'));
  return privateData(row ? row.data : null);
}

export function save_member_private(c, u, pid, data) {
  c.run('INSERT INTO member_private VALUES(?,?,?) ON CONFLICT(parish_id,user_id) DO UPDATE SET data=excluded.data', pid, K(u, 'id'), JSON.stringify(data));
}

function member_groups(d, gids) {
  const viewer = get(d, '_viewer');
  return iter(K(d, 'GROUPS')).filter(g => has(gids, K(g, 'id'))).map(g => {
    const match = iter(get(get(K(d, 'GROUP_DETAIL'), K(g, 'id'), {}), 'roster', [])).find(r => eq(get(r, 'p'), viewer));
    return { id: K(g, 'id'), name: K(g, 'name'), ar: get(g, 'ar', ''), category: get(g, 'cat', ''),
      position: match !== undefined ? get(match, 'role')
        : eq(get(g, 'leader'), viewer) ? 'Leader' : eq(get(g, 'assistant'), viewer) ? 'Assistant' : 'Member' };
  });
}

export function member_meetings(d, gids, personId, priv) {
  const people = new Map(iter(K(d, 'PEOPLE')).map(p => [K(p, 'id'), p]));
  const result = [];
  for (const g of iter(K(d, 'GROUPS'))) {
    if (!has(gids, K(g, 'id'))) continue;
    for (const m of iter(get(get(K(d, 'GROUP_DETAIL'), K(g, 'id'), {}), 'meetings', []))) {
      if (truthy(get(m, 'participants')) && !has(K(m, 'participants'), personId)) continue;
      let attendance = get(get(m, 'attendance', {}), personId);
      if (!truthy(attendance)) {
        attendance = any(get(m, 'absent', []), row => truthy(row) && eq(K(row, 0), personId)) ? 'excused'
          : truthy(get(m, 'done')) ? 'unrecorded' : 'upcoming';
      }
      const leader = get(g, 'leader');
      if (leader !== null && typeof leader === 'object') throw new PyError('unhashable type');
      result.push({ id: K(m, 'id'), groupId: K(g, 'id'), group: K(g, 'name'),
        title: truthy(get(m, 'title')) ? get(m, 'title') : add(K(g, 'name'), ' meeting'),
        date: get(m, 'd', ''), time: get(m, 't', ''),
        location: truthy(get(m, 'place')) ? get(m, 'place') : get(m, 'location', ''),
        description: get(m, 'description', ''), organizer: get(people.get(leader) ?? {}, 'lat', ''),
        attendance, rsvpEnabled: get(m, 'rsvpEnabled', true),
        rsvp: get(K(priv, 'rsvp'), K(m, 'id'), {}), resources: [] });
    }
  }
  return sorted(result, x => [x.date, x.time]);
}

/* ensure_member_reminders(): returns the notification rows it inserts so member_view
   can list them, as the same transaction does in server.py. */
async function ensure_member_reminders(c, pid, u, meetings, priv) {
  const prefs = K(priv, 'preferences');
  if (!truthy(get(prefs, 'inSystem', true)) || !truthy(get(prefs, 'meetings', true))) return [];
  const today = fromisoformat(localToday());
  const candidates = [];
  for (const meeting of meetings) {
    if (!has(new Set(['upcoming', 'unrecorded']), meeting.attendance) || eq(get(meeting.rsvp, 'status'), 'no')) continue;
    let meetingDate;
    try { meetingDate = fromisoformat(meeting.date); } catch (error) {
      if (error instanceof PyError) continue;
      throw error;
    }
    const days = meetingDate - today;
    if (!(days >= 0 && days <= 1)) continue;
    if (meetingDate === today && truthy(meeting.time) && lt(meeting.time, nowHM())) continue;
    const key = sha256hex(`${pid}:${K(u, 'id')}:${str(meeting.id)}:${str(meeting.date)}`).slice(0, 24);
    candidates.push(['reminder-' + key, pid, K(u, 'id'), 'meeting-reminder', add('Upcoming meeting: ', meeting.title),
      strip(add(add(add(add(meeting.group, ' · '), meeting.date), ' '), meeting.time)), 'mymeetings']);
  }
  if (!candidates.length) return [];
  const ids = [...new Set(candidates.map(row => row[0]))];
  const found = new Set((await c.all(`SELECT id FROM member_notifications WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids)).map(row => row.id));
  const inserted = [];
  for (const row of candidates) {
    const at = NOW();
    c.run('INSERT OR IGNORE INTO member_notifications VALUES(?,?,?,?,?,?,?,?,?)', ...row, at, null);
    if (!found.has(row[0])) {
      found.add(row[0]);
      inserted.push({ id: row[0], parish_id: row[1], user_id: row[2], kind: row[3], title: row[4], body: row[5], route: row[6], created_at: at, read_at: null });
    }
  }
  return inserted;
}

export function member_attachment(value) {
  if (!truthy(value)) return null;
  need(isDict(value), 'Invalid attachment.');
  const name = get(value, 'name'), mime = get(value, 'mime'), data = get(value, 'data');
  need(isStr(name) && len(name) > 0 && len(name) <= 120 &&
    has(new Set(['application/pdf', 'image/png', 'image/jpeg', 'text/plain']), mime) &&
    isStr(data) && len(data) <= 1500000 && data.startsWith('data:' + mime + ';base64,'),
    'Attachment must be a PDF, image or text file under 1 MB.');
  let raw;
  try { raw = b64decode(data.slice(data.indexOf(',') + 1)); } catch (error) {
    if (error instanceof PyError) throw new Problem(400, 'Invalid attachment data.');
    throw error;
  }
  need(raw.length <= 1000000, 'Attachment must be under 1 MB.');
  return JSON.stringify({ name, mime, data });
}

async function complaint_permissions(c, u, pid) {
  const row = await c.first('SELECT permissions FROM complaint_reviewers WHERE parish_id=? AND user_id=?', pid, K(u, 'id'));
  return row ? set(JSON.parse(row.permissions)) : new Set();
}

/* concern_public(); `updates` are that concern's member_concern_updates rows in created_at order. */
function concern_public(concern, updates, viewerId = null, reviewerPermissions = null) {
  const permissions = truthy(reviewerPermissions) ? reviewerPermissions : new Set();
  const own = truthy(viewerId) && eq(concern.user_id, viewerId);
  const result = {};
  for (const k of ['id', 'reference', 'category', 'group_id', 'event_id', 'subject', 'description', 'happened_at', 'people_involved', 'follow_up', 'status', 'created_at']) result[k] = concern[k];
  result.anonymous = concern.user_id === null;
  if (own || permissions.has('Review')) result.attachment = truthy(concern.attachment) ? JSON.parse(concern.attachment) : null;
  if (permissions.has('Review')) result.assignedTo = concern.assigned_to;
  if (truthy(concern.user_id) && permissions.has('ViewIdentity')) result.identity = concern.user_id;
  result.updates = updates.map(r => ({ status: r.status, text: r.public_text, at: r.created_at,
    ...(permissions.has('ViewSensitive') ? { internal: r.internal_text } : {}) }));
  return result;
}
const UPDATES_SQL = 'SELECT status,public_text,internal_text,created_at FROM member_concern_updates WHERE concern_id=? ORDER BY created_at';
async function concernUpdates(c, concerns) {
  if (!concerns.length) return [];
  return c.reads(concerns.map(concern => [UPDATES_SQL, [concern.id]]));
}

function reviewer_conflict(u, person, concern) {
  const involved = casefold(truthy(concern.people_involved) ? concern.people_involved : '');
  const names = new Set([K(u, 'name'), K(u, 'username'), get(person, 'lat', ''), get(person, 'ar', '')]);
  return [...names].some(name => truthy(name) && len(strip(name)) >= 4 && involved.includes(casefold(name)));
}

export async function member_view(c, u, pid) {
  const [d, person, gids] = await member_context(c, u, pid);
  const priv = await member_private(c, u, pid);
  d._viewer = K(person, 'id');
  const role = K(u, 'role');
  const managedGroups = set(iter(K(d, 'GROUPS')).filter(g => role === 'priest' || role === 'secretary' ||
    (role === 'leader' && has(set([get(g, 'leader'), get(g, 'assistant')]), K(u, 'person_id')))).map(g => K(g, 'id')));
  const visibleGroups = union(gids, managedGroups);
  const groups = member_groups(d, visibleGroups);
  const meetings = member_meetings(d, visibleGroups, K(person, 'id'), priv);
  const reminders = role === 'member' ? await ensure_member_reminders(c, pid, u, meetings, priv) : [];
  const visibleEvents = [];
  for (const e of iter(K(d, 'EVENTS'))) {
    const detail = get(K(d, 'EVENT_DETAIL'), K(e, 'id'), {});
    const visibility = get(detail, 'visibility', 'public');
    if (!eq(visibility, 'public') && !(eq(visibility, 'groups') && intersects(set(get(detail, 'visibleGroupIds', [])), gids))) continue;
    const event = {};
    for (const k of ['id', 'd', 't', 'title', 'titleAr', 'kind']) event[k] = get(e, k);
    event.description = get(detail, 'desc', '');
    const venue = iter(get(d, 'VENUES', [])).find(v => eq(get(v, 'id'), get(e, 'venue')));
    event.location = venue !== undefined ? get(venue, 'name', '') : '';
    visibleEvents.push(event);
  }
  const content = [];
  for (const notice of iter(get(d, 'NOTICES', []))) {
    const groupId = get(notice, 'groupId');
    if (truthy(groupId) && !has(visibleGroups, groupId)) continue;
    if (!truthy(groupId) && !eq(get(notice, 'audience'), 'Parish')) continue;
    content.push({ id: add('notice-', K(notice, 'id')), kind: 'announcement', groupId,
      recipientId: null, authorId: null, title: get(notice, 'title', ''), body: get(notice, 'ar', ''),
      category: 'Notice', eventId: null, attachment: null, pinned: eq(get(notice, 'pri'), 'urgent'),
      at: get(notice, 'at', ''), read: true, archived: false, replies: [] });
  }
  const groupIds = [...visibleGroups];
  const fileRows = groupIds.length ? await c.reads(groupIds.map(gid => [
    "SELECT id,name,created_at FROM uploaded_files WHERE parish_id=? AND scope='group' AND owner_id=? ORDER BY created_at DESC", [pid, gid]])) : [];
  groupIds.forEach((gid, i) => {
    const detail = get(K(d, 'GROUP_DETAIL'), gid, {});
    iter(get(detail, 'posts', [])).forEach((post, index) => {
      if (!isDict(post)) return;
      let title = get(post, 'title');
      if (!truthy(title)) {
        const group = iter(K(d, 'GROUPS')).find(g => eq(K(g, 'id'), gid));
        title = group !== undefined ? add(K(group, 'name'), ' update') : 'Ministry update';
      }
      content.push({ id: `group-post-${str(gid)}-${index}`, kind: 'post', groupId: gid,
        recipientId: null, authorId: null, title, body: get(post, 'body', ''), html: get(post, 'html', ''),
        category: '', eventId: null, attachment: null, pinned: false, at: get(post, 'at', ''), read: true, archived: false, replies: [] });
    });
    for (const resource of fileRows[i]) {
      content.push({ id: 'group-resource-' + resource.id, kind: 'resource', groupId: gid,
        recipientId: null, authorId: null, title: resource.name, body: '', category: '', eventId: null,
        attachment: { name: resource.name, data: `/api/parishes/${pid}/files/${resource.id}` },
        pinned: false, at: resource.created_at, read: true, archived: false, replies: [] });
    }
  });
  const contentRows = await c.all('SELECT * FROM member_content WHERE parish_id=? ORDER BY created_at DESC', pid);
  const shown = contentRows.filter(r => {
    if (truthy(r.group_id) && !has(visibleGroups, r.group_id)) return false;
    if (r.kind === 'message' && !(r.recipient_id === null || r.recipient_id === K(u, 'id')) && r.author_id !== K(u, 'id')) return false;
    if (r.kind === 'message' && !truthy(r.recipient_id) && r.author_id === K(u, 'id')) return false;
    return true;
  });
  const discussions = shown.filter(r => r.kind === 'discussion');
  const replyRows = discussions.length ? await c.reads(discussions.map(r => [
    'SELECT mr.id,mr.body,mr.created_at,u.name FROM member_replies mr JOIN users u ON u.id=mr.author_id WHERE mr.content_id=? ORDER BY mr.created_at', [r.id]])) : [];
  const replies = new Map(discussions.map((r, i) => [r.id, replyRows[i]]));
  for (const r of shown) {
    content.push({ id: r.id, kind: r.kind, groupId: r.group_id, recipientId: r.recipient_id,
      authorId: r.author_id, title: r.title, body: r.body, category: r.category,
      eventId: r.event_id, attachment: truthy(r.attachment) ? JSON.parse(r.attachment) : null,
      pinned: truthy(r.pinned), at: r.created_at,
      read: r.author_id === K(u, 'id') || has(K(priv, 'readIds'), r.id), archived: has(K(priv, 'archivedIds'), r.id),
      replies: r.kind === 'discussion' ? replies.get(r.id).map(reply => ({ id: reply.id, author: reply.name, body: reply.body, at: reply.created_at })) : [] });
  }
  for (const meeting of meetings) {
    meeting.resources = content.filter(x => x.kind === 'resource' && eq(x.eventId, meeting.id))
      .map(x => ({ id: x.id, title: x.title, attachment: x.attachment }));
  }
  const ownConcerns = await c.all('SELECT * FROM member_concerns WHERE parish_id=? AND user_id=? ORDER BY created_at DESC', pid, K(u, 'id'));
  const anonymousIds = iter(K(priv, 'concernIds'));
  const anonymousRows = anonymousIds.length ? await c.reads(anonymousIds.map(id => [
    'SELECT * FROM member_concerns WHERE id=? AND parish_id=? AND user_id IS NULL', [id, pid]])) : [];
  const anonymous = anonymousRows.map(rows => rows[0]).filter(Boolean);
  const ownUpdates = await concernUpdates(c, [...ownConcerns, ...anonymous]);
  const concerns = [
    ...ownConcerns.map((r, i) => concern_public(r, ownUpdates[i], K(u, 'id'))),
    ...anonymous.map((r, i) => concern_public(r, ownUpdates[ownConcerns.length + i]))
  ];
  const sortedConcerns = sorted(concerns, item => item.created_at, true);
  const perms = await complaint_permissions(c, u, pid);
  let review = [];
  if (perms.has('Review')) {
    const rows = (await c.all('SELECT * FROM member_concerns WHERE parish_id=? ORDER BY created_at DESC', pid)).filter(r =>
      !reviewer_conflict(u, person, r) && (!truthy(r.assigned_to) || r.assigned_to === K(u, 'id') || perms.has('Assign')) &&
      (!sensitive_concern(r.category) || perms.has('ViewSensitive')));
    const updates = await concernUpdates(c, rows);
    review = rows.map((r, i) => concern_public(r, updates[i], null, perms));
    if (perms.has('ViewIdentity')) {
      for (const item of review) {
        if (truthy(get(item, 'identity'))) {
          const account = await c.first('SELECT name,person_id FROM users WHERE id=?', item.identity);
          const owner = account ? iter(K(d, 'PEOPLE')).find(p => eq(K(p, 'id'), account.person_id)) ?? {} : {};
          item.identity = { name: account ? account.name : '', phone: get(owner, 'phone', '') };
        }
      }
    }
    for (const item of review) complaint_log(c, item.id, K(u, 'id'), 'view');
  }
  let leaderConcerns = [];
  if (role === 'leader') {
    const rows = (await c.all('SELECT * FROM member_concerns WHERE parish_id=? ORDER BY created_at DESC', pid)).filter(r =>
      has(managedGroups, r.group_id) && !sensitive_concern(r.category) && !reviewer_conflict(u, person, r));
    const updates = await concernUpdates(c, rows);
    leaderConcerns = rows.map((r, i) => concern_public(r, updates[i]));
    for (const item of leaderConcerns) complaint_log(c, item.id, K(u, 'id'), 'ministry-view');
  }
  const own = {};
  for (const k of ['id', 'lat', 'ar', 'phone', 'born', 'town', 'townAr', 'status']) own[k] = get(person, k, '');
  own.email = get(get(get(d, 'PERSON_EXTRA', {}), K(person, 'id'), {}), 'email', '');
  const household = iter(K(d, 'HOUSEHOLDS')).find(h => has(get(h, 'members', []), K(person, 'id')));
  own.address = household !== undefined ? get(household, 'address', '') : '';
  const formation = [];
  for (const gid of gids) {
    iter(get(get(K(d, 'GROUP_DETAIL'), gid, {}), 'milestones', [])).forEach((milestone, index) => {
      if (isDict(milestone)) {
        const completion = get(get(milestone, 'completions', {}), K(person, 'id'));
        formation.push({ id: get(milestone, 'id', `${str(gid)}-${index}`), groupId: gid,
          name: get(milestone, 'name', ''), description: get(milestone, 'description', ''), completion });
      } else if (isList(milestone) && milestone.length) {
        formation.push({ id: `${str(gid)}-${index}`, groupId: gid, name: milestone[0], description: '', completion: null });
      }
    });
  }
  const office = role === 'priest' || role === 'secretary';
  const [requests, notificationRows, volunteerRows, profileRows, reviewerRows, categoryRows, requestRows] = await c.reads([
    ['SELECT id,field,requested_value,status,created_at FROM member_profile_requests WHERE parish_id=? AND user_id=? ORDER BY created_at DESC', [pid, K(u, 'id')]],
    ['SELECT * FROM member_notifications WHERE parish_id=? AND user_id=? ORDER BY created_at DESC LIMIT 100', [pid, K(u, 'id')]],
    ['SELECT mc.content_id,mc.user_id,mc.status,mc.created_at,c.title,c.group_id,u.name FROM member_commitments mc JOIN member_content c ON c.id=mc.content_id JOIN users u ON u.id=mc.user_id WHERE mc.parish_id=? ORDER BY mc.created_at DESC', [pid]],
    office ? ['SELECT pr.*,u.name FROM member_profile_requests pr JOIN users u ON u.id=pr.user_id WHERE pr.parish_id=? ORDER BY pr.created_at DESC', [pid]] : ['SELECT 1 WHERE 0', []],
    perms.has('Assign') ? ['SELECT cr.user_id,cr.permissions,u.name FROM complaint_reviewers cr JOIN users u ON u.id=cr.user_id WHERE cr.parish_id=?', [pid]] : ['SELECT 1 WHERE 0', []],
    ['SELECT name,active FROM complaint_categories WHERE parish_id=? ORDER BY name', [pid]],
    ['SELECT * FROM member_requests WHERE parish_id=? AND user_id=? ORDER BY created_at DESC,reference DESC', [pid, K(u, 'id')]]
  ]);
  /* Reminders inserted above belong in this list, newest first, like the committed rows. */
  const allNotifications = [...[...reminders].reverse(), ...notificationRows];
  const ordered = sorted(allNotifications, r => r.created_at, true).slice(0, 100);
  const notifications = ordered.map(r => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, route: r.route,
    at: r.created_at, read: truthy(r.read_at) }));
  const site = {};
  for (const [key, item] of items(get(d, 'CONTENT', {}))) {
    if (isDict(item) && truthy(get(item, 'published', true))) setItem(site, key, { en: get(item, 'en', ''), ar: get(item, 'ar', '') });
  }
  const parish = {};
  for (const k of ['id', 'name', 'nameAr', 'town', 'townAr', 'rite', 'riteAr']) parish[k] = get(K(d, 'PARISH'), k, '');
  return {
    parish, site, person: own, groups, meetings, events: visibleEvents, content,
    notes: K(priv, 'notes'), todos: K(priv, 'todos'), commitments: K(priv, 'commitments'), preferences: K(priv, 'preferences'),
    concerns: sortedConcerns, review, leaderConcerns, complaintPermissions: sorted([...perms]), profileRequests: requests,
    volunteerReview: volunteerRows.filter(r => has(managedGroups, r.group_id)), profileReview: office ? profileRows : [],
    managedGroups: sorted([...managedGroups]), formation,
    reviewers: perms.has('Assign') ? reviewerRows.filter(r => has(set(JSON.parse(r.permissions)), 'Review')).map(r => ({ id: r.user_id, name: r.name })) : [],
    categories: categoryRows.map(r => ({ name: r.name, active: truthy(r.active) })), notifications,
    requests: requestRows.map(r => member_request_item(d, r)), requestOptions: member_request_options(d, person)
  };
}

/* member_action(): `members` holds each target's member_private row for notify_member. */
export async function member_action(c, u, pid, q) {
  const [d, person, gids] = await member_context(c, u, pid);
  const priv = await member_private(c, u, pid);
  const op = get(q, 'op');
  const groupId = get(q, 'groupId');
  const role = K(u, 'role');
  const notify = async (userId, kind, title, body, route) => {
    const rows = await memberPrivateRows(c, pid, [userId]);
    notify_member(c, pid, userId, kind, title, body, route, rows.get(userId));
  };
  const leads = g => role === 'priest' || role === 'secretary' || has(set([get(g, 'leader'), get(g, 'assistant')]), K(u, 'person_id'));
  if (op === 'note') {
    const noteId = get(q, 'id');
    if (truthy(get(q, 'delete'))) {
      priv.notes = iter(K(priv, 'notes')).filter(n => !eq(K(n, 'id'), noteId));
    } else {
      const fields = {};
      for (const k of ['title', 'body', 'category', 'reminder', 'meetingId']) fields[k] = get(q, k, '');
      need(Object.values(fields).every(v => isStr(v)) && len(strip(fields.title)) >= 1 && len(strip(fields.title)) <= 120
        && len(fields.body) <= 10000 && len(fields.category) <= 60, 'Invalid note.');
      const tags = get(q, 'tags', []);
      need(isList(tags) && tags.length <= 10 && tags.every(t => isStr(t) && len(t) <= 32), 'Invalid tags.');
      if (truthy(fields.meetingId)) {
        need(member_meetings(d, gids, K(person, 'id'), priv).some(m => eq(m.id, fields.meetingId)), 'Meeting not available.', 403);
      }
      const existing = truthy(noteId) ? iter(K(priv, 'notes')).find(n => eq(K(n, 'id'), noteId)) ?? null : null;
      const item = { id: truthy(existing) ? K(existing, 'id') : tokenHex(12), ...fields, tags, pinned: truthy(get(q, 'pinned')), updatedAt: NOW() };
      if (truthy(existing)) priv.notes[priv.notes.findIndex(n => eq(n, existing))] = item;
      else K(priv, 'notes').push(item);
    }
    save_member_private(c, u, pid, priv);
  } else if (op === 'todo') {
    const todoId = get(q, 'id');
    const existing = iter(K(priv, 'todos')).find(item => eq(K(item, 'id'), todoId)) ?? null;
    if (truthy(get(q, 'delete'))) {
      need(existing !== null, 'Task not found.', 404);
      priv.todos = iter(K(priv, 'todos')).filter(item => !eq(K(item, 'id'), todoId));
    } else if (has(q, 'done')) {
      need(existing !== null && isBool(K(q, 'done')), 'Invalid task.', 400);
      setItem(existing, 'done', K(q, 'done'));
    } else {
      const title = get(q, 'title'), due = get(q, 'due', '');
      const chars = isStr(due) ? Array.from(due) : [];
      need(isStr(title) && len(strip(title)) > 0 && len(strip(title)) <= 160 && isStr(due) &&
        (!truthy(due) || (chars.length === 10 && chars[4] === '-' && chars[7] === '-' &&
          [chars.slice(0, 4), chars.slice(5, 7), chars.slice(8)].every(part => isdigit(part.join(''))))), 'Invalid task.');
      if (truthy(due)) {
        try { fromisoformat(due); } catch (error) {
          if (error instanceof PyError) throw new PyError('Problem() missing 1 required positional argument');
          throw error;
        }
      }
      const item = { id: truthy(existing) ? K(existing, 'id') : tokenHex(12), title: strip(title), due,
        done: truthy(existing) ? K(existing, 'done') : false, createdAt: truthy(existing) ? K(existing, 'createdAt') : NOW() };
      if (truthy(existing)) priv.todos[priv.todos.findIndex(n => eq(n, existing))] = item;
      else K(priv, 'todos').push(item);
    }
    save_member_private(c, u, pid, priv);
  } else if (op === 'rsvp') {
    const meeting = member_meetings(d, gids, K(person, 'id'), priv).find(m => eq(m.id, get(q, 'meetingId'))) ?? null;
    need(truthy(meeting) && truthy(meeting.rsvpEnabled) && ge(meeting.date, TODAY()), 'RSVP is not available for this meeting.', 403);
    need(has(new Set(['yes', 'no']), get(q, 'status')), 'Choose attending or unable to attend.');
    const reason = get(q, 'reason', '');
    need(isStr(reason) && len(reason) <= 500, 'Reason is too long.');
    setItem(K(priv, 'rsvp'), meeting.id, { status: K(q, 'status'), reason, at: NOW() });
    save_member_private(c, u, pid, priv);
    c.run('INSERT INTO member_rsvp VALUES(?,?,?,?,?,?,?) ON CONFLICT(parish_id,user_id,meeting_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,created_at=excluded.created_at',
      pid, K(u, 'id'), meeting.groupId, meeting.id, K(q, 'status'), reason, NOW());
  } else if (op === 'preference') {
    need(has(new Set(['email', 'inSystem', 'meetings', 'announcements', 'messages']), get(q, 'key')) && isBool(get(q, 'value')), 'Invalid preference.');
    setItem(K(priv, 'preferences'), K(q, 'key'), K(q, 'value'));
    save_member_private(c, u, pid, priv);
  } else if (op === 'read' || op === 'archive' || op === 'unarchive') {
    const row = await c.first('SELECT * FROM member_content WHERE id=? AND parish_id=?', get(q, 'id'), pid);
    need(row && (!truthy(row.group_id) || has(gids, row.group_id)) &&
      (row.kind !== 'message' || row.recipient_id === null || row.recipient_id === K(u, 'id') || row.author_id === K(u, 'id')), 'Item not available.', 403);
    const key = op === 'read' ? 'readIds' : 'archivedIds';
    if (op === 'unarchive') priv[key] = iter(K(priv, key)).filter(item => !eq(item, row.id));
    else if (!has(K(priv, key), row.id)) K(priv, key).push(row.id);
    save_member_private(c, u, pid, priv);
  } else if (op === 'readAll') {
    for (const r of await c.all('SELECT id,group_id,kind,recipient_id,author_id FROM member_content WHERE parish_id=?', pid)) {
      if ((!truthy(r.group_id) || has(gids, r.group_id)) && (r.kind !== 'message' || r.recipient_id === null || r.recipient_id === K(u, 'id') || r.author_id === K(u, 'id'))) {
        if (!has(K(priv, 'readIds'), r.id)) K(priv, 'readIds').push(r.id);
      }
    }
    save_member_private(c, u, pid, priv);
  } else if (op === 'notificationRead') {
    c.run('UPDATE member_notifications SET read_at=? WHERE id=? AND parish_id=? AND user_id=?', NOW(), get(q, 'id'), pid, K(u, 'id'));
  } else if (op === 'notificationReadAll') {
    c.run('UPDATE member_notifications SET read_at=? WHERE parish_id=? AND user_id=? AND read_at IS NULL', NOW(), pid, K(u, 'id'));
  } else if (op === 'volunteer') {
    const row = await c.first("SELECT * FROM member_content WHERE id=? AND parish_id=? AND kind='opportunity'", get(q, 'id'), pid);
    need(row && (!truthy(row.group_id) || has(gids, row.group_id)), 'Opportunity not available.', 403);
    need(has(new Set(['interested', 'volunteer', 'withdrawn']), get(q, 'status')), 'Invalid choice.');
    setItem(K(priv, 'commitments'), row.id, { status: K(q, 'status'), at: NOW() });
    save_member_private(c, u, pid, priv);
    c.run('INSERT INTO member_commitments VALUES(?,?,?,?,?) ON CONFLICT(parish_id,user_id,content_id) DO UPDATE SET status=excluded.status,created_at=excluded.created_at',
      pid, K(u, 'id'), row.id, K(q, 'status'), NOW());
  } else if (op === 'confirmVolunteer') {
    const row = await c.first('SELECT mc.*,c.group_id FROM member_commitments mc JOIN member_content c ON c.id=mc.content_id WHERE mc.parish_id=? AND mc.user_id=? AND mc.content_id=?',
      pid, get(q, 'userId'), get(q, 'id'));
    need(row && any(K(d, 'GROUPS'), g => eq(K(g, 'id'), row.group_id) && leads(g)), 'Leadership permission required.', 403);
    need(has(new Set(['confirmed', 'declined']), get(q, 'status')), 'Invalid confirmation.');
    c.run('UPDATE member_commitments SET status=? WHERE parish_id=? AND user_id=? AND content_id=?', K(q, 'status'), pid, row.user_id, row.content_id);
    const targetRows = await memberPrivateRows(c, pid, [row.user_id]);
    notify_member(c, pid, row.user_id, 'volunteer', add('Volunteer assignment ', K(q, 'status')), '', 'mycommitments', targetRows.get(row.user_id));
    if (targetRows.has(row.user_id)) {
      const targetData = JSON.parse(targetRows.get(row.user_id));
      if (has(get(targetData, 'commitments', {}), row.content_id)) {
        setItem(K(K(targetData, 'commitments'), row.content_id), 'status', K(q, 'status'));
        c.run('UPDATE member_private SET data=? WHERE parish_id=? AND user_id=?', JSON.stringify(targetData), pid, row.user_id);
      }
    }
    audit(c, u, pid, 'volunteer.confirm', row.content_id);
  } else if (op === 'sacramentRequest') {
    const kind = get(q, 'kind');
    need(isStr(kind) && has(REQUEST_LABELS, kind), 'Choose what you would like to request.');
    const subjects = keyed(request_subjects(d, person), p => K(p, 'id'));
    need(subjects.size > 0, 'Your person record is not active in this parish.', 403);
    const year = TODAY().slice(0, 4), prefix = `WEB/${year}/`;
    const [[waitingRow], submitted, references] = await c.reads([
      ["SELECT COUNT(*) AS n FROM member_requests WHERE parish_id=? AND user_id=? AND status='submitted'", [pid, K(u, 'id')]],
      ["SELECT kind,details FROM member_requests WHERE parish_id=? AND status='submitted'", [pid]],
      ['SELECT reference FROM member_requests WHERE parish_id=? AND reference LIKE ?', [pid, prefix + '%']]
    ]);
    need(waitingRow.n < 10, 'You already have 10 requests waiting for the parish office.');
    const child = get(q, 'child'), details = {};
    if (child !== null) {
      need(kind === 'baptism' && isDict(child), 'Only a baptism can be requested for a child who is not registered yet.');
      const names = [get(child, 'lat'), get(child, 'ar')];
      need(names.every(x => isStr(x) && len(strip(x)) > 0 && len(strip(x)) <= 120), 'Enter the child’s full name in English and in Arabic.');
      const born = get(child, 'born');
      need(isoDate(born) && le(born, TODAY()), 'Enter the child’s date of birth.');
      const parents = [get(child, 'father', ''), get(child, 'mother', '')];
      need(parents.every(x => isStr(x) && len(strip(x)) <= 120), 'Parent names are too long.');
      details.child = { lat: strip(names[0]), ar: strip(names[1]), born, father: strip(parents[0]), mother: strip(parents[1]) };
    } else {
      const personId = get(q, 'personId');
      need(isStr(personId) && has(subjects, personId), 'Choose yourself or a member of your household.');
      need(kind !== 'funeral' || personId !== K(person, 'id'), 'Choose the family member the funeral is for.');
      details.personId = personId;
    }
    if (kind === 'certificate') {
      const certificateOf = get(q, 'certificateOf'), purpose = get(q, 'purpose'), language = get(q, 'language', 'bilingual');
      need(isStr(certificateOf) && CERTIFICATE_OF.includes(certificateOf), 'Choose the certificate you need.');
      need(isStr(purpose) && len(strip(purpose)) > 0 && len(strip(purpose)) <= 200, 'Tell the parish office what the certificate is for.');
      need(isStr(language) && CERTIFICATE_LANGUAGES.includes(language), 'Choose the certificate language.');
      Object.assign(details, { certificateOf, purpose: strip(purpose), language });
    } else {
      if (truthy(get(details, 'personId'))) {
        const conflict = sacrament_conflict(d, details.personId, kind);
        need(!conflict, conflict);
      }
      const date = get(q, 'date', '');
      need(isStr(date) && (!truthy(date) || isoDate(date) && ge(date, TODAY())), 'Choose a preferred date from today onwards.');
      details.date = date;
      if (kind === 'marriage') {
        const partner = get(q, 'partner'), partnerParish = get(q, 'partnerParish', '');
        need(isStr(partner) && len(strip(partner)) > 0 && len(strip(partner)) <= 120, 'Enter the full name of the future spouse.');
        need(isStr(partnerParish) && len(strip(partnerParish)) <= 120, 'The parish name is too long.');
        Object.assign(details, { partner: strip(partner), partnerParish: strip(partnerParish) });
      }
    }
    const notes = get(q, 'notes', ''), phone = get(q, 'phone', '');
    need(isStr(notes) && len(strip(notes)) <= 500, 'Keep your message within 500 characters.');
    need(isStr(phone) && len(strip(phone)) <= 40, 'Enter a shorter phone number.');
    Object.assign(details, { notes: strip(notes), phone: strip(phone) });
    const key = request_subject_key(kind, details);
    need(!submitted.some(r => request_subject_key(r.kind, JSON.parse(r.details)) === key),
      'The parish office already has this request and will reply soon.');
    const numbers = references.map(r => r.reference.slice(prefix.length)).filter(isdigit).map(Number);
    const reference = prefix + pad3(Math.max(0, ...numbers) + 1);
    const requestId = tokenHex(12), at = NOW();
    c.run('INSERT INTO member_requests VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      requestId, pid, reference, K(u, 'id'), kind, JSON.stringify(details), 'submitted', null, '', at, at);
    audit(c, u, pid, 'member.request', { id: requestId, kind, reference });
    return { id: requestId, reference };
  } else if (op === 'requestWithdraw') {
    const requestId = get(q, 'id');
    const row = isStr(requestId) ? await c.first('SELECT * FROM member_requests WHERE id=? AND parish_id=? AND user_id=?', requestId, pid, K(u, 'id')) : null;
    need(row !== null, 'Request not found.', 404);
    need(row.status === 'submitted', 'The parish office has already handled this request. Please contact the office to change it.');
    c.run("UPDATE member_requests SET status='withdrawn',updated_at=? WHERE id=?", NOW(), row.id);
    audit(c, u, pid, 'member.request-withdrawn', { id: row.id });
  } else if (op === 'profileRequest') {
    need(has(new Set(['name', 'phone', 'email', 'address', 'emergency contact', 'date of birth', 'ministry memberships', 'profile picture']), get(q, 'field')), 'Invalid field.');
    const value = get(q, 'value');
    need(isStr(value) && len(strip(value)) > 0 && len(strip(value)) <= 500, 'Enter the requested update.');
    c.run('INSERT INTO member_profile_requests VALUES(?,?,?,?,?,?,?)', tokenHex(12), pid, K(u, 'id'), K(q, 'field'), strip(value), 'Submitted', NOW());
    audit(c, u, pid, 'profile.update-request', K(q, 'field'));
  } else if (op === 'profileReview') {
    need(role === 'priest' || role === 'secretary', 'Parish office permission required.', 403);
    need(has(new Set(['Reviewed', 'Needs Information', 'Closed']), get(q, 'status')), 'Invalid request status.');
    const row = await c.first('SELECT id,user_id FROM member_profile_requests WHERE id=? AND parish_id=?', get(q, 'id'), pid);
    need(row !== null, 'Request not found.', 404);
    c.run('UPDATE member_profile_requests SET status=? WHERE id=?', K(q, 'status'), row.id);
    await notify(row.user_id, 'profile', add('Information request ', K(q, 'status')), '', 'myprofile');
    audit(c, u, pid, 'profile.request-reviewed', row.id);
  } else if (op === 'publish') {
    need(['priest', 'secretary', 'leader'].includes(role), 'Publishing permission required.', 403);
    need(has(new Set(['post', 'announcement', 'resource', 'opportunity', 'discussion']), get(q, 'kind')), 'Invalid content type.');
    if (eq(get(q, 'kind'), 'discussion')) need(groupId, 'Choose a ministry for a group conversation.');
    if (truthy(groupId)) need(any(K(d, 'GROUPS'), g => eq(K(g, 'id'), groupId) && leads(g)), 'Leadership of this ministry required.', 403);
    else need(role === 'priest' || role === 'secretary', 'Parish publishing permission required.', 403);
    const title = get(q, 'title'), body = get(q, 'body', '');
    need(isStr(title) && len(strip(title)) > 0 && len(strip(title)) <= 160 && isStr(body) && len(body) <= 10000, 'Invalid content.');
    const eventId = truthy(get(q, 'eventId')) ? get(q, 'eventId') : null;
    if (truthy(eventId)) {
      need(truthy(groupId) && any(get(get(K(d, 'GROUP_DETAIL'), groupId, {}), 'meetings', []), m => eq(get(m, 'id'), eventId)),
        'Linked meeting must belong to the selected ministry.');
    }
    const attachment = member_attachment(get(q, 'attachment'));
    const contentId = tokenHex(12);
    c.run('INSERT INTO member_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
      contentId, pid, groupId, K(q, 'kind'), K(u, 'id'), null, strip(title), body,
      slice(str(get(q, 'category', '')), 0, 60), eventId, attachment, truthy(get(q, 'pinned')) ? 1 : 0, NOW());
    const members = await c.all("SELECT u.id,u.person_id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.role='member'", pid);
    const rows = await memberPrivateRows(c, pid, members.map(m => m.id));
    const route = K(q, 'kind') === 'resource' ? 'myresources' : K(q, 'kind') === 'opportunity' ? 'mycommitments' : K(q, 'kind') === 'discussion' ? 'mymessages' : 'myfeed';
    for (const target of members) {
      if (truthy(groupId) && !any(get(get(K(d, 'GROUP_DETAIL'), groupId, {}), 'roster', []), r => eq(get(r, 'p'), target.person_id))) continue;
      notify_member(c, pid, target.id, K(q, 'kind'), strip(title), body, route, rows.get(target.id));
    }
    audit(c, u, pid, 'member.publish', K(q, 'kind'));
  } else if (op === 'staffMessage') {
    need(['priest', 'secretary', 'leader'].includes(role), 'Staff messaging permission required.', 403);
    const recipientPersonId = get(q, 'recipientPersonId');
    need(has(set(iter(K(d, 'PEOPLE')).map(item => K(item, 'id'))), recipientPersonId), 'Choose a person in this parish.');
    if (role === 'leader') {
      const mine = set(iter(K(d, 'GROUPS')).filter(group => has(set([get(group, 'leader'), get(group, 'assistant')]), K(u, 'person_id'))).map(group => K(group, 'id')));
      need(any(K(d, 'GROUPS'), g => has(mine, K(g, 'id')) &&
        has(set(iter(get(get(K(d, 'GROUP_DETAIL'), K(g, 'id'), {}), 'roster', [])).map(row => get(row, 'p'))), recipientPersonId)),
        'You may message members of your ministries only.', 403);
    }
    const recipient = await c.first('SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? LIMIT 1', pid, recipientPersonId);
    need(recipient !== null, 'This person does not have an active in-app account.', 404);
    const title = get(q, 'title'), body = get(q, 'body');
    need(isStr(title) && len(strip(title)) > 0 && len(strip(title)) <= 160 && isStr(body) && len(strip(body)) > 0 && len(strip(body)) <= 5000,
      'Enter a subject and message.');
    const contentId = tokenHex(12);
    c.run('INSERT INTO member_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', contentId, pid, null, 'message', K(u, 'id'), recipient.id,
      strip(title), strip(body), '', null, null, 0, NOW());
    await notify(recipient.id, 'message', strip(title), strip(body), 'mymessages');
    audit(c, u, pid, 'member.staff-message', { recipient: recipientPersonId, content: contentId });
  } else if (op === 'message') {
    need(has(gids, groupId), 'Ministry membership required.', 403);
    const group = iter(K(d, 'GROUPS')).find(g => eq(K(g, 'id'), groupId));
    if (group === undefined) throw new Error('StopIteration');
    const recipient = await c.first("SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id IN (?,?) AND u.role IN ('leader','priest','secretary') ORDER BY CASE WHEN u.person_id=? THEN 0 ELSE 1 END LIMIT 1",
      pid, get(group, 'leader'), get(group, 'assistant'), get(group, 'leader'));
    need(recipient !== null, 'This ministry has no available messaging contact.', 403);
    const body = get(q, 'body', '');
    need(isStr(body) && len(strip(body)) > 0 && len(strip(body)) <= 5000, 'Enter a message under 5000 characters.');
    c.run('INSERT INTO member_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', tokenHex(12), pid, groupId, 'message', K(u, 'id'), recipient.id,
      add('Message to ', K(group, 'name')), strip(body), '', null, null, 0, NOW());
    await notify(recipient.id, 'message', 'New ministry message', strip(body), 'memberhub');
  } else if (op === 'messageReply') {
    const original = await c.first("SELECT * FROM member_content WHERE id=? AND parish_id=? AND kind='message'", get(q, 'id'), pid);
    need(original && original.recipient_id === K(u, 'id') &&
      (role === 'priest' || role === 'secretary' || any(K(d, 'GROUPS'), g => eq(K(g, 'id'), original.group_id) &&
        has(set([get(g, 'leader'), get(g, 'assistant')]), K(u, 'person_id')))), 'Message not available for reply.', 403);
    need(['leader', 'priest', 'secretary'].includes(role), 'Ministry communication permission required.', 403);
    const body = get(q, 'body', '');
    need(isStr(body) && len(strip(body)) > 0 && len(strip(body)) <= 5000, 'Enter a message under 5000 characters.');
    c.run('INSERT INTO member_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', tokenHex(12), pid, original.group_id, 'message', K(u, 'id'), original.author_id,
      'Re: ' + original.title, strip(body), '', null, null, 0, NOW());
    await notify(original.author_id, 'message', 'Reply from your ministry', strip(body), 'mymessages');
  } else if (op === 'discussionReply') {
    const row = await c.first("SELECT * FROM member_content WHERE id=? AND parish_id=? AND kind='discussion'", get(q, 'id'), pid);
    need(row && has(gids, row.group_id), 'Conversation not available.', 403);
    const body = get(q, 'body', '');
    need(isStr(body) && len(strip(body)) > 0 && len(strip(body)) <= 3000, 'Enter a reply under 3000 characters.');
    c.run('INSERT INTO member_replies VALUES(?,?,?, ?,?)', tokenHex(12), row.id, K(u, 'id'), strip(body), NOW());
  } else if (op === 'concern') {
    need(await c.first('SELECT 1 FROM complaint_categories WHERE parish_id=? AND name=? AND active=1', pid, get(q, 'category')), 'Choose a concern category.');
    if (truthy(groupId)) need(has(gids, groupId), 'Ministry not available.', 403);
    const eventId = truthy(get(q, 'eventId')) ? get(q, 'eventId') : null;
    if (truthy(eventId)) {
      const permittedMeetings = set(member_meetings(d, gids, K(person, 'id'), priv).map(m => m.id));
      const permittedEvents = set(iter(K(d, 'EVENTS')).filter(e => {
        const detail = get(K(d, 'EVENT_DETAIL'), K(e, 'id'), {});
        return eq(get(detail, 'visibility', 'public'), 'public') ||
          (eq(get(detail, 'visibility'), 'groups') && intersects(set(get(detail, 'visibleGroupIds', [])), gids));
      }).map(e => K(e, 'id')));
      need(has(union(permittedMeetings, permittedEvents), eventId), 'Related event is not available.', 403);
    }
    const subject = get(q, 'subject'), description = get(q, 'description');
    need(isStr(subject) && len(strip(subject)) > 0 && len(strip(subject)) <= 160 &&
      isStr(description) && len(strip(description)) > 0 && len(strip(description)) <= 10000, 'Enter a subject and description.');
    const anonymous = get(q, 'anonymous') === true;
    const followUp = get(q, 'followUp', 'none');
    need(anonymous || has(new Set(['system', 'email', 'phone', 'none']), followUp), 'Invalid follow-up choice.');
    const ref = 'CMP-' + tokenHex(8).toUpperCase();
    const concernId = tokenHex(12);
    const happenedAt = slice(str(get(q, 'happenedAt', '')), 0, 40);
    const peopleInvolved = slice(str(get(q, 'peopleInvolved', '')), 0, 500);
    const attachment = member_attachment(get(q, 'attachment'));
    c.run('INSERT INTO member_concerns VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      concernId, pid, ref, anonymous ? null : K(u, 'id'), K(q, 'category'), groupId,
      eventId, strip(subject), strip(description), happenedAt, peopleInvolved, attachment,
      anonymous ? null : followUp, 'Submitted', NOW(), null);
    if (anonymous) {
      K(priv, 'concernIds').push(concernId);
      save_member_private(c, u, pid, priv);
    }
    complaint_log(c, concernId, anonymous ? null : K(u, 'id'), 'submitted');
    return { id: concernId };
  } else if (op === 'concernFollowUp') {
    const message = get(q, 'message', '');
    need(isStr(message) && len(strip(message)) > 0 && len(strip(message)) <= 5000, 'Enter a message.');
    const row = await c.first('SELECT * FROM member_concerns WHERE parish_id=? AND id=?', pid, get(q, 'id'));
    need(row !== null && (row.user_id === K(u, 'id') || (row.user_id === null && has(K(priv, 'concernIds'), row.id))), 'Case not available.', 403);
    c.run('INSERT INTO member_concern_updates VALUES(?,?,?,?,?,?,?)', tokenHex(12), row.id, null, row.status,
      'Submitted additional information: ' + strip(message), '', NOW());
    complaint_log(c, row.id, row.user_id === null ? null : K(u, 'id'), 'submitter-follow-up');
  } else if (op === 'concernUpdate') {
    const perms = await complaint_permissions(c, u, pid);
    need(perms.has('Review') && (perms.has('Respond') || perms.has('Resolve')), 'Complaint reviewer permission required.', 403);
    const row = await c.first('SELECT * FROM member_concerns WHERE id=? AND parish_id=?', get(q, 'id'), pid);
    need(row !== null, 'Case not found.', 404);
    need(!reviewer_conflict(u, person, row), 'A different reviewer must handle a case involving you.', 403);
    need(!truthy(row.assigned_to) || row.assigned_to === K(u, 'id') || perms.has('Assign'), 'Case is assigned to another reviewer.', 403);
    need(!sensitive_concern(row.category) || perms.has('ViewSensitive'), 'Sensitive complaint permission required.', 403);
    const status = get(q, 'status');
    need(has(CONCERN_STATUSES, status) && (!has(new Set(['Resolved', 'Closed']), status) || perms.has('Resolve')), 'Status permission required.', 403);
    const publicText = get(q, 'publicText', ''), internalText = get(q, 'internalText', '');
    need(isStr(publicText) && len(publicText) <= 5000 && isStr(internalText) && len(internalText) <= 5000, 'Update is too long.');
    c.run('UPDATE member_concerns SET status=? WHERE id=?', status, row.id);
    c.run('INSERT INTO member_concern_updates VALUES(?,?,?,?,?,?,?)', tokenHex(12), row.id, K(u, 'id'), status, publicText, internalText, NOW());
    if (truthy(row.user_id)) await notify(row.user_id, 'concern', add('Concern status: ', status), publicText, 'myconcerns');
    complaint_log(c, row.id, K(u, 'id'), 'updated', status);
  } else if (op === 'concernAssign') {
    const perms = await complaint_permissions(c, u, pid);
    need(perms.has('Review') && perms.has('Assign'), 'Complaint assignment permission required.', 403);
    const row = await c.first('SELECT * FROM member_concerns WHERE id=? AND parish_id=?', get(q, 'id'), pid);
    need(row !== null && !reviewer_conflict(u, person, row), 'Case not available for assignment.', 403);
    const target = await c.first('SELECT * FROM users WHERE id=?', get(q, 'reviewerId'));
    const targetPerson = target ? iter(K(d, 'PEOPLE')).find(p => eq(K(p, 'id'), target.person_id)) ?? {} : {};
    need(target !== null && !reviewer_conflict(target, targetPerson, row) &&
      (await complaint_permissions(c, target, pid)).has('Review'), 'Choose an independent authorized reviewer.', 403);
    if (sensitive_concern(row.category)) need((await complaint_permissions(c, target, pid)).has('ViewSensitive'), 'Reviewer needs sensitive-case permission.', 403);
    c.run('UPDATE member_concerns SET assigned_to=? WHERE id=?', target.id, row.id);
    complaint_log(c, row.id, K(u, 'id'), 'assigned', target.id);
  } else if (op === 'categoryManage') {
    need((await complaint_permissions(c, u, pid)).has('ManageCategories'), 'Complaint category permission required.', 403);
    const name = get(q, 'name', '');
    need(isStr(name) && len(strip(name)) > 0 && len(strip(name)) <= 80 && isBool(get(q, 'active')), 'Enter a category name and active state.');
    c.run('INSERT INTO complaint_categories VALUES(?,?,?) ON CONFLICT(parish_id,name) DO UPDATE SET active=excluded.active', pid, strip(name), K(q, 'active') ? 1 : 0);
  } else {
    throw new Problem(400, 'Unknown member action.');
  }
  return { ok: true };
}
