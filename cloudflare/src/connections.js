/* Parish connections: following, membership, invitations, the profile. Ported from server.py.
   An account is an ordinary user. Following a parish, being a formal member of it, belonging to a
   ministry and holding a staff role are separate relationships; one account can have several, in
   several parishes. Membership is asked for and the parish office decides, linking the account to
   an existing person record or creating one; nothing is linked or changed in parish records without it. */
import {
  Problem, need, get, K, isStr, iter, items, str, or, truthy, eq, has, sorted, tokenHex, tokenUrlsafe, NOW, TODAY, time, dumps
} from './py.js';
import { migrate_state, validate, parish_theme } from './state.js';
import { audit, sync_relationships, notify_member } from './app.js';
import { authority, parishContext, parishUser, permsOf, materializeLegacy, isBlocked, clean, ROLE_TITLES, CLERGY_OFFICES } from './authority.js';
import { contactValue, deliveryMode, sha, birthDate } from './identity.js';
import { recordPhone } from './accounts.js';
import { publicMinistries } from './ministries.js';
import { parishPlan, documentsOpen, requireModule } from './plans.js';

const INVITATION_DAYS = 14;
/* The person-profile fields a parishioner may fill in themselves; status, tags, households, notes and
   sacramental records stay with the office. */
const PROFILE_TEXT = { arabicName: 120, town: 120, address: 300, rite: 40, occupation: 120, emergencyName: 120, emergencyPhone: 40 };
const PROFILE_CHOICES = { language: ['', 'en', 'ar'], channel: ['', 'whatsapp', 'sms', 'email'], bloodType: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] };
export const PROFILE_LABELS = {
  arabicName: 'arabic name', town: 'address', address: 'address', rite: 'rite', occupation: 'line of work', emergencyName: 'emergency contact',
  emergencyPhone: 'emergency contact', language: 'language', channel: 'contact preference', bloodType: 'blood type', directory: 'directory listing',
  skills: 'skills', birthDate: 'date of birth', name: 'name'
};
export const PROFILE_REQUEST_FIELDS = new Set(['name', 'phone', 'email', 'address', 'emergency contact', 'date of birth', 'ministry memberships', 'profile picture',
  'arabic name', 'rite', 'line of work', 'language', 'contact preference', 'blood type', 'directory listing', 'skills']);

/* The account's own details, as a membership request carries them to a parish office. */
export async function accountProfile(c, u) {
  const [profiles, contacts] = await c.reads([
    ['SELECT * FROM user_profiles WHERE user_id=?', [u.id]],
    ['SELECT * FROM user_contacts WHERE user_id=? ORDER BY kind,created_at', [u.id]]
  ]);
  const p = profiles[0] ?? null, space = u.name.indexOf(' ');
  return {
    firstName: p ? p.first_name : space < 0 ? u.name : u.name.slice(0, space),
    lastName: p ? p.last_name : space < 0 ? '' : u.name.slice(space + 1),
    birthDate: p ? p.birth_date : '', details: p ? JSON.parse(p.data) : {},
    contacts: contacts.map(k => ({ kind: k.kind, value: k.value, verified: Boolean(k.verified_at) }))
  };
}

/* The self-service profile fields; anything left out stays empty rather than invented. */
export function cleanProfile(q) {
  const out = {};
  for (const [key, limit] of Object.entries(PROFILE_TEXT)) out[key] = clean(get(q, key), limit, 'Check the ' + PROFILE_LABELS[key] + '.', false);
  for (const [key, allowed] of Object.entries(PROFILE_CHOICES)) {
    const value = str(or(get(q, key), ''));
    need(allowed.includes(value), 'Check the ' + PROFILE_LABELS[key] + '.');
    out[key] = value;
  }
  out.directory = Boolean(get(q, 'directory'));
  const skills = or(get(q, 'skills'), []);
  need(Array.isArray(skills) && skills.length <= 30 && skills.every(s => isStr(s) && s.trim().length > 0 && s.trim().length <= 80), 'Check your skills.');
  out.skills = sorted([...new Set(skills.map(s => s.split(/\s+/).filter(Boolean).join(' ')))]);
  if (out.emergencyPhone) out.emergencyPhone = contactValue('phone', out.emergencyPhone);
  return out;
}

/* What a parish's public page shows, and what its followers see. */
export async function publicParish(c, pid) {
  const [stateRows, postRows] = await c.reads([
    ['SELECT data FROM states WHERE parish_id=?', [pid]],
    ["SELECT title,body,created_at FROM member_content WHERE parish_id=? AND group_id IS NULL AND kind IN ('post','announcement') ORDER BY created_at DESC LIMIT 50", [pid]]
  ]);
  need(stateRows.length, 'Parish not found.', 404);
  const state = JSON.parse(stateRows[0].data), parish = K(state, 'PARISH');
  const content = {};
  for (const [key, item] of items(get(state, 'CONTENT', {}))) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item) && truthy(get(item, 'published', true)))
      content[key] = { en: get(item, 'en', ''), ar: get(item, 'ar', '') };
  }
  const events = [];
  for (const event of iter(get(state, 'EVENTS', []))) {
    const detail = get(get(state, 'EVENT_DETAIL', {}), get(event, 'id'), {});
    if (eq(get(event, 'kind'), 'pending') || (!eq(get(detail, 'visibility'), 'public') &&
      !(!truthy(detail) && has(new Set(['mass', 'event']), get(event, 'kind'))))) continue;
    const item = {};
    for (const key of ['id', 'd', 't', 'title', 'titleAr', 'kind']) item[key] = get(event, key, '');
    events.push(item);
  }
  const posts = postRows.map(item => ({ title: item.title, body: item.body, at: item.created_at }));
  for (const n of iter(get(state, 'NOTICES', []))) {
    if (get(n, 'audience') === 'Parish' && !get(n, 'groupId')) posts.push({ title: get(n, 'title', ''), body: get(n, 'ar', ''), at: get(n, 'at', '') });
  }
  const ordered = sorted(posts, item => item.at, true);
  const pub = {};
  for (const key of ['name', 'nameAr', 'town', 'townAr', 'rite', 'riteAr', 'address', 'addressAr', 'phone']) pub[key] = get(parish, key, '');
  /* Every parish page wears the one shared website theme; a parish's own colours are not published. */
  if (!truthy(get(content, 'contact'))) Object.assign(pub, { address: '', addressAr: '', phone: '' });
  Object.assign(pub, await publicPlace(c, pid, state));
  const { modules } = await parishPlan(c, pid);
  return { parish: pub, content, events, posts: ordered, ministries: modules.includes('ministries') ? publicMinistries(state) : [],
    clergy: await publicClergy(c, pid), gallery: await publicGallery(c, pid), modules, documentsOpen: await documentsOpen(c, pid) };
}

/* Where a parish is, for the directory's filters and map: its diocese, rite, published coordinates (only
   when the parish entered them) and whether it is demonstration data. */
async function publicPlace(c, pid, state) {
  const row = await c.first('SELECT p.diocese,p.metadata,d.name,d.metadata AS dmeta FROM parishes p LEFT JOIN dioceses d ON d.id=p.diocese WHERE p.id=?', pid);
  const meta = JSON.parse(row.metadata), dmeta = JSON.parse(row.dmeta || '{}'), parish = K(state, 'PARISH');
  const loc = get(parish, 'location');
  return { diocese: row.diocese, dioceseName: row.name ?? '', dioceseAr: dmeta.ar ?? '', rite: get(parish, 'rite', ''), riteAr: get(parish, 'riteAr', ''),
    location: loc !== null && typeof loc === 'object' ? { lat: loc.lat, lng: loc.lng } : null, demo: Boolean(meta.demo) };
}

/* The clergy serving a parish now: name, current title, responsibility and the photo the parish published. */
async function publicClergy(c, pid) {
  const order = { 'parish-priest': 0, 'assistant-priest': 1, deacon: 2 };
  const out = [];
  for (const r of await c.all('SELECT cl.id,cl.name,cl.name_ar,a.office FROM clergy_assignments a JOIN clergy cl ON cl.id=a.clergy_id WHERE a.parish_id=? AND a.end_date IS NULL', pid)) {
    const [titles, photos] = await c.reads([
      ['SELECT title FROM clergy_titles WHERE clergy_id=? AND effective_from<=? ORDER BY effective_from DESC,set_at DESC LIMIT 1', [r.id, TODAY()]],
      ["SELECT id FROM uploaded_files WHERE parish_id=? AND scope='clergy' AND owner_id=? ORDER BY created_at DESC LIMIT 1", [pid, r.id]]
    ]);
    const office = CLERGY_OFFICES[r.office] ?? CLERGY_OFFICES.other;
    out.push({ id: r.id, name: r.name, nameAr: r.name_ar, title: titles.length ? titles[0].title : '', office: r.office, officeEn: office[0], officeAr: office[1],
      photo: photos.length ? `/api/public/parishes/${pid}/images/${photos[0].id}` : null });
  }
  return out.sort((a, b) => ((order[a.office] ?? 3) - (order[b.office] ?? 3)) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

async function publicGallery(c, pid) {
  return (await c.all("SELECT id,name,created_at FROM uploaded_files WHERE parish_id=? AND scope='gallery' AND owner_id=? AND mime LIKE 'image/%' ORDER BY created_at DESC LIMIT 60", pid, pid))
    .map(r => ({ id: r.id, name: r.name, url: `/api/public/parishes/${pid}/images/${r.id}`, at: r.created_at }));
}

export async function publicImage(c, pid, fileId) {
  const row = await c.first("SELECT * FROM uploaded_files WHERE parish_id=? AND id=? AND scope IN ('gallery','clergy') AND mime LIKE 'image/%'", pid, fileId);
  need(row !== null, 'Image not found.', 404);
  return row;
}

/* Every parish registered in ParishLife, with what the directory filters and the map need. */
export async function publicDirectory(c) {
  const out = [];
  for (const row of await c.all('SELECT id,metadata FROM parishes ORDER BY rowid')) {
    const meta = JSON.parse(row.metadata);
    const state = await c.first('SELECT data FROM states WHERE parish_id=?', row.id);
    out.push({ id: row.id, name: meta.name ?? '', ar: meta.ar ?? '', town: meta.town ?? '', townAr: meta.townAr ?? '',
      ...(state ? await publicPlace(c, row.id, JSON.parse(state.data)) : {}) });
  }
  return out;
}

/* What the public pages may use. The map provider is offered only once a browser key is configured. */
export function publicConfig(env) {
  const key = String(env.PARISHLIFE_GOOGLE_MAPS_KEY ?? '').trim();
  return { maps: key ? { provider: 'google', key } : null };
}

export function parishBrief(row) {
  const meta = JSON.parse(row.metadata);
  return { id: row.id, name: get(meta, 'name', ''), ar: get(meta, 'ar', ''), town: get(meta, 'town', ''), townAr: get(meta, 'townAr', ''), diocese: row.diocese };
}

/* The account's parishes — staff roles, membership, following and requests — and what is new in them. */
export async function connectionsView(c, u) {
  const auth = await authority(c, u);
  const links = new Map(auth.links.map(l => [l.parish_id, l]));
  const [requests, rows] = await c.reads([
    ['SELECT * FROM membership_requests WHERE user_id=? ORDER BY created_at DESC', [u.id]],
    ['SELECT * FROM parishes ORDER BY rowid', []]
  ]);
  const pending = new Map(requests.filter(r => r.status === 'pending').map(r => [r.parish_id, r]));
  const today = TODAY(), out = [], feed = { events: [], posts: [] };
  for (const r of rows) {
    const link = links.get(r.id)?.status === 'active' ? links.get(r.id) : null;
    const ctx = await parishContext(c, u, r.id, auth, r);
    if (!(ctx || link || pending.has(r.id))) continue;
    const role = ctx ? ctx.role : null, open = pending.get(r.id);
    out.push({ ...parishBrief(r), kind: link ? link.kind : null, role, roleTitle: role ? ROLE_TITLES[role] : null,
      primary: Boolean(link && link.is_primary), request: open ? { id: open.id, at: open.created_at } : null });
    if (link) {   // the news of parishes followed or belonged to; staff see their own parish in its workspace
      const pub = await publicParish(c, r.id);
      const upcoming = sorted(pub.events.filter(e => str(or(e.d, '')) >= today), e => [str(or(e.d, '')), str(or(e.t, ''))]).slice(0, 6);
      for (const e of upcoming) feed.events.push({ ...e, parish: r.id });
      for (const p of pub.posts.slice(0, 4)) feed.posts.push({ ...p, parish: r.id });
    }
  }
  feed.events = sorted(feed.events, e => [str(or(e.d, '')), str(or(e.t, ''))]);
  feed.posts = sorted(feed.posts, p => p.at, true);
  const names = new Map(rows.map(r => [r.id, parishBrief(r)]));
  return {
    parishes: out, directory: rows.map(parishBrief), feed,
    requests: requests.map(r => ({ id: r.id, parish: r.parish_id, parishName: names.get(r.parish_id)?.name ?? '', parishAr: names.get(r.parish_id)?.ar ?? '',
      status: r.status, message: r.message, createdAt: r.created_at, decidedAt: r.decided_at || '', note: r.decision_note, invited: Boolean(r.invitation_id) }))
  };
}

async function invitationRow(c, token) {
  const row = await c.first('SELECT * FROM invitations WHERE token=?', sha(str(or(token, ''))));
  need(row !== null && !row.revoked_at && !row.accepted_at && row.expires > time(), 'This invitation is no longer valid. Ask the parish office for a new one.', 404);
  return row;
}

/* What the sign-in page says about an invitation link: which parish sent it, and to whom. */
export async function invitationInfo(c, token) {
  const row = await invitationRow(c, token);
  const [parishes, states] = await c.reads([
    ['SELECT * FROM parishes WHERE id=?', [row.parish_id]], ['SELECT data FROM states WHERE parish_id=?', [row.parish_id]]
  ]);
  const person = iter(K(JSON.parse(states[0].data), 'PEOPLE')).find(p => p.id === row.person_id) ?? null;
  return { parish: parishBrief(parishes[0]), firstName: str(or(person?.lat, '')).split(' ')[0] };
}

/* `auth` is the account's authority as read in this request (with any links still to be copied from its earlier access). */
function follow(c, u, pid, at, auth) {
  const existing = auth.links.find(l => l.parish_id === pid);
  if (existing && existing.status === 'active') return;
  const primary = auth.links.some(l => l.status === 'active' && l.is_primary) ? 0 : 1;
  c.run("INSERT INTO parish_links(user_id,parish_id,kind,status,person_id,is_primary,note,created_at) VALUES(?,?,'follow','active',NULL,?,'',?) " +
    "ON CONFLICT(user_id,parish_id) DO UPDATE SET kind='follow',status='active',person_id=NULL,is_primary=excluded.is_primary,created_at=excluded.created_at",
    u.id, pid, primary, at);
}

export async function connectionsAction(c, u, q) {
  const op = get(q, 'op'), at = NOW();
  const auth = await authority(c, u);
  let invitation = null, pid;
  if (op === 'acceptInvite') {
    invitation = await invitationRow(c, get(q, 'token'));
    pid = invitation.parish_id;
  } else pid = get(q, 'parish');
  const parish = isStr(pid) ? await c.first('SELECT * FROM parishes WHERE id=?', pid) : null;
  need(parish !== null, 'Choose a parish.', 404);
  need(!isBlocked(auth, parish.diocese, pid), 'Your access to this parish has been deactivated.', 403);
  /* An account still on its earlier access has its links copied first; they are what auth.links already shows. */
  await materializeLegacy(c, u);
  const link = auth.links.find(l => l.parish_id === pid) ?? null;
  const active = link && link.status === 'active' ? link : null;
  const pending = await c.first("SELECT * FROM membership_requests WHERE user_id=? AND parish_id=? AND status='pending'", u.id, pid);
  if (op === 'follow') {
    need(!active, 'You are already connected to this parish.');
    follow(c, u, pid, at, auth);
    audit(c, u, pid, 'parish.followed', {});
    return {};
  }
  if (op === 'unfollow') {
    need(active && active.kind === 'follow', 'You are not following this parish.');
    need(!pending, 'Withdraw your membership request first.');
    c.run("UPDATE parish_links SET status='ended',is_primary=0,decided_at=? WHERE user_id=? AND parish_id=?", at, u.id, pid);
    audit(c, u, pid, 'parish.unfollowed', {});
    return {};
  }
  if (op === 'setPrimary') {
    need(active, 'Follow or join this parish first.');
    c.run('UPDATE parish_links SET is_primary=0 WHERE user_id=?', u.id);
    c.run('UPDATE parish_links SET is_primary=1 WHERE user_id=? AND parish_id=?', u.id, pid);
    return {};
  }
  if (op === 'requestMembership' || op === 'acceptInvite') {
    await requireModule(c, pid, 'members', 'membership through ParishLife');
    need(!(active && active.kind === 'member'), 'You are already a member of this parish.');
    need(!pending, 'Your request is already with the parish office.', 409);
    const message = clean(get(q, 'message'), 500, 'Keep your message within 500 characters.', false);
    if (invitation) {
      need(!(await c.first("SELECT 1 AS x FROM parish_links WHERE parish_id=? AND person_id=? AND kind='member' AND status='active'", pid, invitation.person_id)),
        'This parish record is already linked to an account.', 409);
      c.run('UPDATE invitations SET accepted_at=?,accepted_by=? WHERE id=?', at, u.id, invitation.id);
    }
    const rid = 'mr-' + tokenHex(8);
    c.run('INSERT INTO membership_requests(id,user_id,parish_id,status,message,profile,person_id,invitation_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
      rid, u.id, pid, 'pending', message, dumps(await accountProfile(c, u)), invitation ? invitation.person_id : null, invitation ? invitation.id : null, at);
    follow(c, u, pid, at, auth);   // while the office decides, the parish's public news reaches the account
    audit(c, u, pid, 'membership.requested', { request: rid, invited: Boolean(invitation) });
    return { id: rid, parish: pid };
  }
  if (op === 'withdrawRequest') {
    need(pending !== null && pending.id === get(q, 'id'), 'There is no open request to withdraw.', 404);
    c.run("UPDATE membership_requests SET status='withdrawn',decided_at=?,decided_by=? WHERE id=?", at, u.id, pending.id);
    audit(c, u, pid, 'membership.withdrawn', { request: pending.id });
    return {};
  }
  throw new Problem(400, 'Unknown action.');
}

/* datetime.fromtimestamp(seconds, timezone.utc).isoformat() */
function isoFromEpoch(seconds) {
  const micros = Math.round(seconds * 1e6), fraction = micros % 1000000;
  return new Date(Math.floor(micros / 1000)).toISOString().slice(0, 19) + (fraction ? '.' + String(fraction).padStart(6, '0') : '') + '+00:00';
}

/* Membership requests and invitations, for staff who manage people. */
export async function officeConnections(c, pid) {
  const since = new Date(Date.now() - 60 * 86400 * 1000).toISOString().slice(0, 19);
  const [requests, invitations] = await c.reads([
    ["SELECT m.*,u.name AS account_name,u.username AS account_username FROM membership_requests m JOIN users u ON u.id=m.user_id " +
      "WHERE m.parish_id=? AND (m.status='pending' OR m.decided_at>?) ORDER BY m.created_at DESC", [pid, since]],
    ['SELECT * FROM invitations WHERE parish_id=? ORDER BY created_at DESC LIMIT 200', [pid]]
  ]);
  return [
    requests.map(r => ({ id: r.id, status: r.status, message: r.message, profile: JSON.parse(r.profile), personId: r.person_id, invited: Boolean(r.invitation_id),
      createdAt: r.created_at, decidedAt: r.decided_at || '', note: r.decision_note, account: { name: r.account_name, username: r.account_username } })),
    invitations.map(r => ({ id: r.id, personId: r.person_id, channel: r.channel, target: r.target, delivery: r.delivery, createdAt: r.created_at,
      expiresAt: isoFromEpoch(r.expires), accepted: Boolean(r.accepted_at), revoked: Boolean(r.revoked_at) }))
  ];
}

/* A new person record made from what the account holder entered; empty where they left it empty. */
function personFromProfile(profile, at) {
  const details = profile.details ?? {}, contacts = profile.contacts ?? [];
  const phone = contacts.find(k => k.kind === 'phone')?.value ?? '', email = contacts.find(k => k.kind === 'email')?.value ?? '';
  const name = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
  const person = { id: 'p' + tokenHex(8), lat: name, ar: details.arabicName || name, town: details.town ?? '', townAr: '', rite: details.rite ?? '',
    status: 'member', phone: phone ? recordPhone(phone) : '—', email, born: profile.birthDate ?? '', hh: null, tags: [],
    registeredOnline: { at, via: 'account', verified: contacts.some(k => k.verified) } };
  const extra = { skills: details.skills ?? [], dates: [], occupation: details.occupation ?? '', directory: Boolean(details.directory) };
  for (const [key, target] of [['language', 'lang'], ['channel', 'channel'], ['bloodType', 'blood']]) if (details[key]) extra[target] = details[key];
  if (email) extra.email = email;
  return [person, extra];
}

export async function officeConnectionAction(c, ctx, u, pid, q, outbox, baseUrl) {
  u = await parishUser(c, u, pid);
  need(permsOf(u).has('people.manage'), 'Permission to manage people is required.', 403);
  const op = get(q, 'op'), at = NOW();
  if (op === 'approveMembership' || op === 'declineMembership') {
    const r = await c.first("SELECT * FROM membership_requests WHERE id=? AND parish_id=? AND status='pending'", get(q, 'id'), pid);
    need(r !== null, 'This request has already been decided or withdrawn.', 404);
    if (op === 'declineMembership') {
      const note = clean(get(q, 'note'), 500, 'Say briefly why, so the person knows what to do next.');
      c.run("UPDATE membership_requests SET status='declined',decided_at=?,decided_by=?,decision_note=? WHERE id=?", at, u.id, note, r.id);
      audit(c, u, pid, 'membership.declined', { request: r.id });
      return {};
    }
    const row = await c.first('SELECT * FROM states WHERE parish_id=?', pid);
    let d = JSON.parse(row.data), revision = row.revision, personId;
    if (get(q, 'create')) {
      const [person, extra] = personFromProfile(JSON.parse(r.profile), at);
      K(d, 'PEOPLE').push(person);
      K(d, 'PERSON_EXTRA')[person.id] = extra;
      d = migrate_state(d);
      validate(d);
      await sync_relationships(c, pid, d);
      c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', dumps(d), pid);
      personId = person.id;
      revision += 1;
    } else {
      personId = get(q, 'personId');
      need(iter(K(d, 'PEOPLE')).some(p => p.id === personId), 'Choose the person record to link.');
    }
    const [taken, primaryElsewhere] = await c.reads([
      ["SELECT 1 AS x FROM parish_links WHERE parish_id=? AND person_id=? AND kind='member' AND status='active' AND user_id<>?", [pid, personId, r.user_id]],
      ["SELECT 1 AS x FROM parish_links WHERE user_id=? AND status='active' AND is_primary=1 AND parish_id<>?", [r.user_id, pid]]
    ]);
    need(!taken.length, 'This person record is already linked to another account.', 409);
    c.run("INSERT INTO parish_links(user_id,parish_id,kind,status,person_id,is_primary,note,created_at,decided_at,decided_by) " +
      "VALUES(?,?,'member','active',?,?,'',?,?,?) ON CONFLICT(user_id,parish_id) DO UPDATE SET kind='member',status='active'," +
      "person_id=excluded.person_id,is_primary=MAX(parish_links.is_primary,excluded.is_primary),decided_at=excluded.decided_at,decided_by=excluded.decided_by",
      r.user_id, pid, personId, primaryElsewhere.length ? 0 : 1, at, at, u.id);
    c.run("UPDATE membership_requests SET status='approved',person_id=?,decided_at=?,decided_by=? WHERE id=?", personId, at, u.id, r.id);
    const priv = await c.first('SELECT data FROM member_private WHERE parish_id=? AND user_id=?', pid, r.user_id);
    notify_member(c, pid, r.user_id, 'membership', 'You are now a member of the parish', 'Your parish office approved your membership.', 'memberhome', priv?.data);
    audit(c, u, pid, 'membership.approved', { request: r.id, person: personId, created: Boolean(get(q, 'create')) });
    return { personId, revision };
  }
  if (op === 'invite') {
    const state = JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?', pid)).data);
    const person = iter(K(state, 'PEOPLE')).find(p => p.id === get(q, 'personId')) ?? null;
    need(person !== null, 'Choose a person.', 404);
    need(!(await c.first("SELECT 1 AS x FROM parish_links WHERE parish_id=? AND person_id=? AND kind='member' AND status='active'", pid, person.id)),
      'This person already has an account linked.', 409);
    const channel = get(q, 'channel');
    need(['email', 'sms', 'link'].includes(channel), 'Choose how to send the invitation.');
    const target = channel === 'link' ? '' : contactValue(channel === 'email' ? 'email' : 'phone', get(q, 'target'));
    c.run('UPDATE invitations SET revoked_at=?,revoked_by=? WHERE parish_id=? AND person_id=? AND revoked_at IS NULL AND accepted_at IS NULL', at, u.id, pid, person.id);
    const token = tokenUrlsafe(24), iid = 'inv-' + tokenHex(8);
    const link = `${baseUrl}/index.html?invite=${token}`;
    const mode = channel === 'link' ? 'none' : deliveryMode(ctx, channel);
    const delivery = channel === 'link' ? 'link-only' : { none: 'not-configured', service: 'sending', console: 'console' }[mode];
    c.run('INSERT INTO invitations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', iid, pid, person.id, channel, target, sha(token), at, u.id,
      time() + INVITATION_DAYS * 86400, delivery, null, null, null, null);
    if (mode === 'service' || mode === 'console') {
      const parishName = get(K(state, 'PARISH'), 'name') || 'Your parish';
      outbox.push({ id: iid, table: 'invitations', channel, target, mode, status: delivery, subject: `${parishName} invites you to ParishLife`,
        text: `${parishName} invites you to ParishLife, to see parish news and send requests to the office. Open this link within ${INVITATION_DAYS} days: ${link}` });
    }
    audit(c, u, pid, 'person.invited', { person: person.id, channel });
    return { id: iid, link, delivery };
  }
  if (op === 'revokeInvite') {
    const inv = await c.first('SELECT * FROM invitations WHERE id=? AND parish_id=?', get(q, 'id'), pid);
    need(inv !== null && !inv.revoked_at && !inv.accepted_at, 'This invitation is no longer open.', 404);
    c.run('UPDATE invitations SET revoked_at=?,revoked_by=? WHERE id=?', at, u.id, inv.id);
    audit(c, u, pid, 'person.invitation-revoked', { invitation: inv.id });
    return {};
  }
  throw new Problem(400, 'Unknown action.');
}

/* Someone who leads or assists a ministry works in the leader workspace of that parish; when they no
   longer do, that ends. Staff appointments made by an administrator are left alone. */
export async function syncMinistryLeaders(c, actor, pid, d, people) {
  const leading = new Set();
  for (const g of iter(K(d, 'GROUPS'))) for (const f of ['leader', 'assistant']) if (g[f]) leading.add(g[f]);
  const seen = new Set();
  for (const personId of people) {
    for (const row of await c.all('SELECT DISTINCT user_id FROM parish_accounts WHERE parish_id=? AND person_id=?', pid, personId)) {
      if (seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      const user = await c.first('SELECT * FROM users WHERE id=?', row.user_id);
      const queued = await materializeLegacy(c, user);
      const current = queued.some(a => a.role === 'leader' && a.scope === 'parish' && a.scope_id === pid) ||
        Boolean(await c.first("SELECT 1 AS x FROM role_assignments WHERE user_id=? AND role='leader' AND scope='parish' AND scope_id=? AND status='active'", user.id, pid));
      if (leading.has(personId) && !current) {
        c.run('INSERT INTO role_assignments(id,user_id,role,scope,scope_id,note,source,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
          'ra-' + tokenHex(10), user.id, 'leader', 'parish', pid, 'Leads or assists a ministry', 'ministry', NOW(), actor.id);
      } else if (!leading.has(personId) && current) {
        c.run("UPDATE role_assignments SET status='ended',ended_at=?,ended_by=? WHERE user_id=? AND role='leader' AND scope='parish' " +
          "AND scope_id=? AND status='active' AND source IN ('ministry','migrated')", NOW(), actor.id, user.id, pid);
      }
    }
  }
}

/* The account's own profile, and (when it asks) an update request to each parish it belongs to. */
export async function saveProfile(c, u, q, at) {
  const before = await accountProfile(c, u);
  const first = clean(get(q, 'firstName'), 60, 'Enter your first name.'), last = clean(get(q, 'lastName'), 60, 'Enter your last name.');
  const born = get(q, 'birthDate') ? birthDate(get(q, 'birthDate')) : before.birthDate;
  const details = cleanProfile(q);
  c.run('INSERT INTO user_profiles VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name,' +
    'last_name=excluded.last_name,birth_date=excluded.birth_date,data=excluded.data,updated_at=excluded.updated_at',
    u.id, first, last, born, dumps(details), at);
  c.run('UPDATE users SET name=? WHERE id=?', `${first} ${last}`, u.id);
  /* What changed, by the field names the parish office already uses for update requests */
  const shown = v => Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Listed' : 'Not listed') : (v || '(removed)');
  const changes = new Map();
  const add = (field, text) => { if (!changes.has(field)) changes.set(field, []); changes.get(field).push(text); };
  if (first !== before.firstName || last !== before.lastName) add('name', `${first} ${last}`);
  if (born !== before.birthDate) add('date of birth', born);
  for (const [key, value] of Object.entries(details)) {
    const old = before.details[key] ?? (key === 'skills' ? [] : key === 'directory' ? false : '');
    if (JSON.stringify(value) !== JSON.stringify(old)) {
      const field = PROFILE_LABELS[key];
      add(field, field === 'address' || field === 'emergency contact' ? `${key}: ${shown(value)}` : shown(value));
    }
  }
  const sendTo = or(get(q, 'sendTo'), []);
  need(Array.isArray(sendTo), 'Choose parishes.');
  const auth = await authority(c, u);
  const members = new Set(auth.links.filter(l => l.kind === 'member' && l.status === 'active').map(l => l.parish_id));
  let sent = 0;
  for (const pid of sorted([...new Set(sendTo)])) {
    need(members.has(pid), 'You can only send updates to parishes you are a member of.', 403);
    for (const [field, values] of changes) {
      c.run('INSERT INTO member_profile_requests VALUES(?,?,?,?,?,?,?)', tokenHex(12), pid, u.id, field, values.join('; ').slice(0, 500), 'Submitted', at);
      audit(c, u, pid, 'profile.update-request', field);
      sent += 1;
    }
  }
  const fields = sorted([...changes.keys()]);
  audit(c, u, null, 'account.profile-saved', { fields });
  return { sent, changed: fields };
}
