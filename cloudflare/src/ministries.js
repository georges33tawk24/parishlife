/* Ministries: public profiles, inquiries, applications, departures. Ported from server.py.
   A public ministry is described on the parish page with its leader's name only; the parish's own
   published contact details are the way in. Guests can say they are interested without an account,
   which grants nothing. Members apply: the ministry leader approves, then the parish priest (who may
   also approve straight away). Leaving is a private request only the parish's priests see. */
import { Problem, need, get, K, iter, str, or, strip, truthy, tokenHex, NOW, dumps } from './py.js';
import { migrate_state, validate } from './state.js';
import { audit, sync_relationships, notify_member } from './app.js';
import { parishUser, permsOf, clean } from './authority.js';
import { contactValue } from './identity.js';
import { requireModule } from './plans.js';

const GROUP_PROFILE = ['about', 'aboutAr', 'duties', 'dutiesAr', 'howToJoin', 'howToJoinAr'];
const OPEN_APPLICATION = ['pending', 'leader-approved'];
const INQUIRIES_PER_HOUR = 20;
const pick = (g, keys) => Object.fromEntries(keys.map(k => [k, get(g, k, '') ?? '']));
const isoAgo = ms => {
  const micros = (Date.now() - ms) * 1000, fraction = micros % 1000000;
  return new Date(Math.floor(micros / 1000)).toISOString().slice(0, 19) + (fraction ? '.' + String(fraction).padStart(6, '0') : '') + '+00:00';
};

/* What the public page says about each public ministry. Leaders are named; their phone numbers and
   email addresses are never published — the parish's own contact details are the way in. */
export function publicMinistries(d) {
  const people = new Map(iter(K(d, 'PEOPLE')).map(p => [p.id, p]));
  return iter(K(d, 'GROUPS')).filter(g => (get(g, 'vis', 'public') ?? 'public') === 'public').map(g => {
    const leader = people.get(get(g, 'leader')) ?? null;
    return { ...pick(g, ['id', 'name', 'ar', 'cat', 'catAr', 'meets', 'meetsAr', ...GROUP_PROFILE]),
      leader: leader ? { name: get(leader, 'lat', ''), ar: get(leader, 'ar', '') } : null };
  });
}

export function notifyAccount(c, userId, pid, kind, title, body = '', route = '') {
  c.run('INSERT INTO account_notifications VALUES(?,?,?,?,?,?,?,?,?)', tokenHex(12), userId, pid, kind, title, str(body).slice(0, 300), route, NOW(), null);
}

export const parishPriestAccounts = async (c, pid) =>
  (await c.all("SELECT DISTINCT user_id FROM parish_accounts WHERE parish_id=? AND role='priest'", pid)).map(r => r.user_id);

async function bishopAccounts(c, diocese) {
  return (await c.all("SELECT DISTINCT user_id AS id FROM role_assignments WHERE role='bishop' AND scope='diocese' AND scope_id=? AND status='active' " +
    "UNION SELECT u.id FROM users u WHERE u.role='bishop' AND u.diocese=? AND NOT EXISTS (SELECT 1 FROM role_assignments r WHERE r.user_id=u.id)", diocese, diocese)).map(r => r.id);
}

export async function groupLeaderAccounts(c, pid, group) {
  const people = [get(group, 'leader'), get(group, 'assistant')].filter(Boolean);
  if (!people.length) return [];
  return (await c.all(`SELECT DISTINCT user_id FROM parish_accounts WHERE parish_id=? AND person_id IN (${people.map(() => '?').join(',')})`, pid, ...people)).map(r => r.user_id);
}

const privateOf = async (c, pid, userId) => (await c.first('SELECT data FROM member_private WHERE parish_id=? AND user_id=?', pid, userId))?.data;

/* A guest says they are interested in a ministry. It reaches the office and the ministry's leaders; it
   makes nobody a member and opens nothing private. */
export async function ministryInquiry(c, pid, q) {
  need(!truthy(get(q, 'website')), 'The message could not be sent.');  // a field only robots fill in
  const row = await c.first('SELECT data FROM states WHERE parish_id=?', pid);
  need(row !== null, 'Parish not found.', 404);
  const d = JSON.parse(row.data);
  await requireModule(c, pid, 'ministries', 'ministry inquiries');
  const group = iter(K(d, 'GROUPS')).find(g => g.id === get(q, 'groupId') && (get(g, 'vis', 'public') ?? 'public') === 'public') ?? null;
  need(group !== null, 'Choose a ministry.', 404);
  const name = clean(get(q, 'name'), 120, 'Enter your name.');
  const email = strip(str(or(get(q, 'email'), ''))) ? contactValue('email', get(q, 'email')) : '';
  const phone = strip(str(or(get(q, 'phone'), ''))) ? contactValue('phone', get(q, 'phone')) : '';
  need(email || phone, 'Give a phone number or an email address, so the parish can reply.');
  const message = clean(get(q, 'message'), 1000, 'Keep your message within 1000 characters.', false);
  const recent = await c.first('SELECT COUNT(*) AS n FROM ministry_inquiries WHERE parish_id=? AND created_at>?', pid, isoAgo(3600 * 1000));
  need(recent.n < INQUIRIES_PER_HOUR, 'Many messages reached this parish in the last hour. Please try again later or call the parish office.', 429);
  const iid = 'mi-' + tokenHex(8);
  c.run('INSERT INTO ministry_inquiries(id,parish_id,group_id,name,email,phone,message,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    iid, pid, group.id, name, email, phone, message, 'new', NOW());
  for (const userId of await groupLeaderAccounts(c, pid, group)) notifyAccount(c, userId, pid, 'ministry-inquiry', `Someone is interested in ${group.name}`, '', `groups/${group.id}`);
  audit(c, { id: null }, pid, 'ministry.inquiry', { group: group.id, inquiry: iid });
  return {};
}

/* Which ministries' applications and inquiries this account handles: a priest and the office see every
   ministry; a leader sees the ministries they lead or assist. */
function ministryScope(u, d) {
  const groups = iter(K(d, 'GROUPS'));
  if (u.roleCode === 'priest' || permsOf(u).has('ministries.manage')) return new Set(groups.map(g => g.id));
  return new Set(groups.filter(g => u.person_id && [get(g, 'leader'), get(g, 'assistant')].includes(u.person_id)).map(g => g.id));
}

/* For the parish workspace. Departure requests and their reasons go to the parish's priests only. */
export async function ministryLists(c, u, pid, d) {
  const scope = ministryScope(u, d), since = isoAgo(90 * 86400 * 1000);
  const [apps, inquiries, departures, users] = await c.reads([
    ["SELECT * FROM ministry_applications WHERE parish_id=? AND (status IN ('pending','leader-approved') OR created_at>?) ORDER BY created_at DESC", [pid, since]],
    ["SELECT * FROM ministry_inquiries WHERE parish_id=? AND (status='new' OR created_at>?) ORDER BY created_at DESC", [pid, since]],
    ["SELECT * FROM ministry_departures WHERE parish_id=? AND (status='pending' OR created_at>?) ORDER BY created_at DESC", [pid, since]],
    ['SELECT id,name FROM users WHERE id IN (SELECT user_id FROM ministry_applications WHERE parish_id=? UNION SELECT leader_by FROM ministry_applications WHERE parish_id=? ' +
      'UNION SELECT priest_by FROM ministry_applications WHERE parish_id=? UNION SELECT handled_by FROM ministry_inquiries WHERE parish_id=?)', [pid, pid, pid, pid]]
  ]);
  const names = new Map(users.map(r => [r.id, r.name]));
  const nameOf = id => (id ? names.get(id) ?? '' : '');
  return [
    apps.filter(a => scope.has(a.group_id)).map(a => ({ id: a.id, groupId: a.group_id, personId: a.person_id, account: nameOf(a.user_id), status: a.status,
      message: a.message, createdAt: a.created_at, leaderBy: nameOf(a.leader_by), leaderAt: a.leader_at || '', priestBy: nameOf(a.priest_by),
      priestAt: a.priest_at || '', note: a.decision_note, withdrawRequested: a.withdraw_requested_at || '', withdrawNote: a.withdraw_note })),
    inquiries.filter(i => scope.has(i.group_id)).map(i => ({ id: i.id, groupId: i.group_id, name: i.name, email: i.email, phone: i.phone, message: i.message,
      status: i.status, createdAt: i.created_at, note: i.note, handledBy: nameOf(i.handled_by) })),
    u.roleCode === 'priest' ? departures.map(x => ({ id: x.id, groupId: x.group_id, personId: x.person_id, reason: x.reason, status: x.status,
      createdAt: x.created_at, decidedAt: x.decided_at || '', note: x.note })) : []
  ];
}

function rosterAdd(d, gid, personId, at) {
  const group = iter(K(d, 'GROUPS')).find(g => g.id === gid);
  const details = K(d, 'GROUP_DETAIL');
  const detail = details[gid] ??= {};
  const roster = detail.roster ??= [];
  const person = iter(K(d, 'PEOPLE')).find(p => p.id === personId) ?? {};
  if (!roster.some(r => get(r, 'p') === personId)) {
    roster.push({ p: personId, role: 'Member', roleAr: 'عضو', joined: at.slice(0, 4), att: 0 });
    group.members = (Number(get(group, 'members')) || 0) + 1;
    (detail.history ??= []).push([`${person.lat ?? ''} joined`, `انضمّ ${person.ar || person.lat || ''}`, at.slice(0, 10)]);
  }
  detail.requests = iter(get(detail, 'requests', [])).filter(r => get(r, 'p') !== personId);
}

/* The person leaves the roster; their membership stays in the ministry's history (without any reason). */
function rosterRemove(d, gid, personId, at) {
  const group = iter(K(d, 'GROUPS')).find(g => g.id === gid);
  const detail = K(d, 'GROUP_DETAIL')[gid] ??= {};
  const entry = iter(get(detail, 'roster', [])).find(r => get(r, 'p') === personId);
  if (!entry) return;
  detail.roster = detail.roster.filter(r => get(r, 'p') !== personId);
  (detail.former ??= []).push({ ...entry, left: at.slice(0, 10) });
  group.members = Math.max(0, (Number(get(group, 'members')) || 0) - 1);
  const person = iter(K(d, 'PEOPLE')).find(p => p.id === personId) ?? {};
  (detail.history ??= []).push([`${person.lat ?? ''} is no longer a member`, `لم يعد ${person.ar || person.lat || ''} عضواً`, at.slice(0, 10)]);
}

async function saveState(c, pid, d, revision) {
  d = migrate_state(d);
  validate(d);
  await sync_relationships(c, pid, d);
  c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', dumps(d), pid);
  return revision + 1;
}

/* The member's side: apply, withdraw an application, ask to leave. */
export async function ministryMemberAction(c, u, pid, d, person, q) {
  const op = get(q, 'op'), at = NOW();
  need(person.id, 'Your account is not linked to a person record in this parish.', 403);
  const group = iter(K(d, 'GROUPS')).find(g => g.id === get(q, 'groupId')) ?? null;
  const rosterOf = gid => iter(get(get(K(d, 'GROUP_DETAIL'), gid, {}) ?? {}, 'roster', []));
  if (op === 'ministryApply') {
    await requireModule(c, pid, 'ministries', 'ministry applications');
    need(group !== null && get(group, 'vis', 'public') !== 'confidential', 'Choose a ministry.', 404);
    need(!rosterOf(group.id).some(r => get(r, 'p') === person.id), 'You already belong to this ministry.');
    need(!(await c.first("SELECT 1 AS x FROM ministry_applications WHERE parish_id=? AND group_id=? AND person_id=? AND status IN ('pending','leader-approved')",
      pid, group.id, person.id)), 'Your application is already being considered.', 409);
    const message = clean(get(q, 'message'), 500, 'Keep your message within 500 characters.', false);
    const aid = 'ma-' + tokenHex(8);
    c.run('INSERT INTO ministry_applications(id,parish_id,group_id,user_id,person_id,status,message,created_at) VALUES(?,?,?,?,?,?,?,?)',
      aid, pid, group.id, u.id, person.id, 'pending', message, at);
    for (const userId of await groupLeaderAccounts(c, pid, group)) notifyAccount(c, userId, pid, 'ministry-application', `New application to ${group.name}`, '', `groups/${group.id}`);
    audit(c, u, pid, 'ministry.applied', { group: group.id, application: aid });
    return { id: aid };
  }
  if (op === 'ministryWithdraw') {
    const a = await c.first('SELECT * FROM ministry_applications WHERE id=? AND parish_id=? AND user_id=?', get(q, 'id'), pid, u.id);
    need(a !== null && OPEN_APPLICATION.includes(a.status), 'This application is no longer open.', 404);
    if (a.status === 'pending') {   // nobody has approved it yet: it ends now
      c.run("UPDATE ministry_applications SET status='withdrawn',closed_at=?,closed_by=? WHERE id=?", at, u.id, a.id);
      audit(c, u, pid, 'ministry.application-withdrawn', { application: a.id });
      return { status: 'withdrawn' };
    }
    need(!a.withdraw_requested_at, 'You have already asked to withdraw it.');
    const note = clean(get(q, 'note'), 500, 'Keep your note within 500 characters.', false);
    c.run('UPDATE ministry_applications SET withdraw_requested_at=?,withdraw_note=? WHERE id=?', at, note, a.id);
    const g = iter(K(d, 'GROUPS')).find(x => x.id === a.group_id) ?? {};
    for (const userId of new Set([...await groupLeaderAccounts(c, pid, g), ...await parishPriestAccounts(c, pid)]))
      notifyAccount(c, userId, pid, 'ministry-application', `Request to withdraw an application to ${g.name ?? ''}`, '', `groups/${a.group_id}`);
    audit(c, u, pid, 'ministry.withdrawal-requested', { application: a.id });
    return { status: 'withdrawal-requested' };
  }
  if (op === 'ministryLeave') {
    need(group !== null && rosterOf(group.id).some(r => get(r, 'p') === person.id), 'You do not belong to this ministry.', 404);
    need(![get(group, 'leader'), get(group, 'assistant')].includes(person.id), 'You lead this ministry. Speak with the parish priest about handing it over first.');
    need(!(await c.first("SELECT 1 AS x FROM ministry_departures WHERE parish_id=? AND group_id=? AND person_id=? AND status='pending'", pid, group.id, person.id)),
      'Your request is already with the parish priest.', 409);
    const reason = clean(get(q, 'reason'), 1000, 'Keep the reason within 1000 characters.', false);
    const did = 'md-' + tokenHex(8);
    c.run('INSERT INTO ministry_departures(id,parish_id,group_id,user_id,person_id,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?)',
      did, pid, group.id, u.id, person.id, reason, 'pending', at);
    for (const userId of await parishPriestAccounts(c, pid))   // the reason stays in the request, for the priest to read there
      notifyAccount(c, userId, pid, 'ministry-departure', 'A request to leave a ministry is waiting for you', '', `groups/${group.id}`);
    audit(c, u, pid, 'ministry.departure-requested', { request: did });
    return { id: did };
  }
  throw new Problem(400, 'Unknown action.');
}

export async function ministryMemberView(c, u, pid, d, person) {
  const [apps, departures] = await c.reads([
    ['SELECT * FROM ministry_applications WHERE parish_id=? AND user_id=? ORDER BY created_at DESC', [pid, u.id]],
    ['SELECT * FROM ministry_departures WHERE parish_id=? AND user_id=? ORDER BY created_at DESC', [pid, u.id]]
  ]);
  const rosterOf = gid => iter(get(get(K(d, 'GROUP_DETAIL'), gid, {}) ?? {}, 'roster', []));
  return {
    ministryApplications: apps.map(a => ({ id: a.id, groupId: a.group_id, status: a.status, message: a.message, createdAt: a.created_at,
      leaderAt: a.leader_at || '', priestAt: a.priest_at || '', note: a.decision_note, withdrawRequested: a.withdraw_requested_at || '' })),
    ministryDepartures: departures.map(x => ({ id: x.id, groupId: x.group_id, status: x.status, createdAt: x.created_at, decidedAt: x.decided_at || '', note: x.note })),
    openMinistries: iter(K(d, 'GROUPS')).filter(g => get(g, 'vis', 'public') !== 'confidential' && !rosterOf(g.id).some(r => get(r, 'p') === person.id))
      .map(g => pick(g, ['id', 'name', 'ar', 'cat', 'catAr', 'meets', 'meetsAr', 'vis', ...GROUP_PROFILE]))
  };
}

/* The leader's and the priest's side. A leader approves an application first; the priest approves it
   (and may do so without waiting). Departures are the priest's alone. */
export async function ministryAction(c, u, pid, q) {
  u = await parishUser(c, u, pid);
  const row = await c.first('SELECT * FROM states WHERE parish_id=?', pid);
  const d = JSON.parse(row.data);
  const op = get(q, 'op'), at = NOW(), priest = u.roleCode === 'priest';
  const leads = gid => Boolean(u.person_id) && iter(K(d, 'GROUPS')).some(g => g.id === gid && [get(g, 'leader'), get(g, 'assistant')].includes(u.person_id));
  let revision = row.revision;
  if (op === 'applicationDecide' || op === 'withdrawalDecide') {
    const a = await c.first('SELECT * FROM ministry_applications WHERE id=? AND parish_id=?', get(q, 'id'), pid);
    need(a !== null && OPEN_APPLICATION.includes(a.status), 'This application is no longer open.', 404);
    const group = iter(K(d, 'GROUPS')).find(g => g.id === a.group_id) ?? null;
    need(group !== null, 'This ministry no longer exists.', 404);
    need(priest || (leads(group.id) && (a.status === 'pending' || op === 'withdrawalDecide')), 'The ministry’s leader and then the parish priest decide applications.', 403);
    const note = clean(get(q, 'note'), 500, 'Keep the note within 500 characters.', false);
    const priv = await privateOf(c, pid, a.user_id);
    if (op === 'withdrawalDecide') {
      need(a.withdraw_requested_at, 'Nobody asked to withdraw this application.');
      if (truthy(get(q, 'accept'))) {
        c.run("UPDATE ministry_applications SET status='withdrawn',closed_at=?,closed_by=?,decision_note=? WHERE id=?", at, u.id, note, a.id);
        notify_member(c, pid, a.user_id, 'ministry', `Your application to ${group.name} is withdrawn`, note, 'myministries', priv);
      } else {
        c.run('UPDATE ministry_applications SET withdraw_requested_at=NULL,decision_note=? WHERE id=?', note, a.id);
        notify_member(c, pid, a.user_id, 'ministry', `Your application to ${group.name} stays open`, note, 'myministries', priv);
      }
      audit(c, u, pid, 'ministry.withdrawal-decided', { application: a.id, accepted: truthy(get(q, 'accept')) });
      return { revision };
    }
    if (!truthy(get(q, 'approve'))) {
      c.run("UPDATE ministry_applications SET status='declined',closed_at=?,closed_by=?,decision_note=? WHERE id=?", at, u.id, note, a.id);
      notify_member(c, pid, a.user_id, 'ministry', `Your application to ${group.name} was not accepted`, note, 'myministries', priv);
      audit(c, u, pid, 'ministry.application-declined', { application: a.id });
      return { revision };
    }
    if (!priest) {   // the leader's approval: on to the priest
      c.run("UPDATE ministry_applications SET status='leader-approved',leader_by=?,leader_at=?,decision_note=? WHERE id=?", u.id, at, note, a.id);
      for (const userId of await parishPriestAccounts(c, pid)) notifyAccount(c, userId, pid, 'ministry-application', `An application to ${group.name} awaits your approval`, '', `groups/${group.id}`);
      audit(c, u, pid, 'ministry.application-leader-approved', { application: a.id });
      return { revision };
    }
    need(iter(K(d, 'PEOPLE')).some(p => p.id === a.person_id), 'The applicant’s parish record is no longer active.');
    rosterAdd(d, group.id, a.person_id, at);
    revision = await saveState(c, pid, d, revision);
    c.run("UPDATE ministry_applications SET status='approved',priest_by=?,priest_at=?,decision_note=?,closed_at=?,closed_by=? WHERE id=?", u.id, at, note, at, u.id, a.id);
    notify_member(c, pid, a.user_id, 'ministry', `Welcome to ${group.name}`, note, 'myministries', priv);
    audit(c, u, pid, 'ministry.application-approved', { application: a.id, leaderApproved: Boolean(a.leader_at) });
    return { revision };
  }
  if (op === 'departureDecide') {
    need(priest, 'Only the parish priest handles requests to leave a ministry.', 403);
    const x = await c.first("SELECT * FROM ministry_departures WHERE id=? AND parish_id=? AND status='pending'", get(q, 'id'), pid);
    need(x !== null, 'This request has already been handled.', 404);
    const group = iter(K(d, 'GROUPS')).find(g => g.id === x.group_id) ?? null;
    const note = clean(get(q, 'note'), 500, 'Keep the note within 500 characters.', false);
    const priv = await privateOf(c, pid, x.user_id);
    if (!truthy(get(q, 'approve'))) {
      c.run("UPDATE ministry_departures SET status='declined',decided_by=?,decided_at=?,note=? WHERE id=?", u.id, at, note, x.id);
      notify_member(c, pid, x.user_id, 'ministry', 'Your request to leave a ministry', note || 'The parish priest would like to talk with you first.', 'myministries', priv);
      audit(c, u, pid, 'ministry.departure-declined', { request: x.id });
      return { revision };
    }
    if (group !== null) {
      rosterRemove(d, group.id, x.person_id, at);
      revision = await saveState(c, pid, d, revision);
    }
    c.run("UPDATE ministry_departures SET status='approved',decided_by=?,decided_at=?,note=? WHERE id=?", u.id, at, note, x.id);
    const name = group?.name ?? 'the ministry';
    notify_member(c, pid, x.user_id, 'ministry', `Your membership of ${name} has ended`, note, 'myministries', priv);
    const parish = await c.first('SELECT diocese FROM parishes WHERE id=?', pid);
    const person = [...iter(K(d, 'PEOPLE')), ...iter(K(d, 'ARCHIVED'))].find(p => p.id === x.person_id) ?? {};
    const ended = `${person.lat || 'A member'} is no longer a member of ${name}`;
    for (const userId of new Set([...await parishPriestAccounts(c, pid), ...await bishopAccounts(c, parish.diocese)]))
      notifyAccount(c, userId, pid, 'ministry-ended', ended, '', `groups/${x.group_id}`);
    audit(c, u, pid, 'ministry.departure-approved', { request: x.id });
    return { revision };
  }
  if (op === 'inquiryUpdate') {
    const i = await c.first('SELECT * FROM ministry_inquiries WHERE id=? AND parish_id=?', get(q, 'id'), pid);
    need(i !== null, 'Message not found.', 404);
    need(ministryScope(u, d).has(i.group_id), 'This ministry is outside your responsibility.', 403);
    need(['new', 'answered', 'closed'].includes(get(q, 'status')), 'Choose a status.');
    const note = clean(get(q, 'note'), 500, 'Keep the note within 500 characters.', false);
    c.run('UPDATE ministry_inquiries SET status=?,note=?,handled_by=?,handled_at=? WHERE id=?', get(q, 'status'), note, u.id, at, i.id);
    audit(c, u, pid, 'ministry.inquiry-updated', { inquiry: i.id, status: get(q, 'status') });
    return { revision };
  }
  throw new Problem(400, 'Unknown action.');
}

export async function accountNotificationsView(c, u) {
  const rows = await c.all('SELECT * FROM account_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', u.id);
  return { notifications: rows.map(r => ({ id: r.id, parish: r.parish_id, kind: r.kind, title: r.title, body: r.body, route: r.route, at: r.created_at, read: Boolean(r.read_at) })) };
}

export function accountNotificationsAction(c, u, q) {
  const op = get(q, 'op');
  if (op === 'readAll') c.run('UPDATE account_notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', NOW(), u.id);
  else if (op === 'read') c.run('UPDATE account_notifications SET read_at=? WHERE user_id=? AND id=? AND read_at IS NULL', NOW(), u.id, get(q, 'id'));
  else throw new Problem(400, 'Unknown action.');
  return {};
}
