/* Documents: guest requests, the priest's signature, the bishop's acceptance, release. Ported from server.py.
   Anyone can ask a parish for a certificate without an account, for themselves or a family member (a
   child's is asked for by a parent or guardian). They get a private tracking link. The priest signs the
   document; it then goes to the bishop, whose acceptance is a separate step with its own history. Whether
   a document is released before the bishop accepts it is a diocesan policy: until the bishop sets one,
   nothing is released automatically and a priest releasing early says so explicitly. */
import { Problem, need, get, K, iter, str, or, strip, truthy, tokenHex, tokenUrlsafe, NOW, TODAY, localToday, dumps, pad3 } from './py.js';
import { migrate_state, validate } from './state.js';
import { audit, sync_relationships, notify_member } from './app.js';
import { authority, diocesePerms, parishUser, permsOf, clean, setting } from './authority.js';
import { contactValue, deliveryMode, sha } from './identity.js';
import { notifyAccount } from './ministries.js';

export const GUEST_KINDS = { baptism: 'Baptism certificate', communion: 'First Communion certificate', confirmation: 'Confirmation certificate', marriage: 'Marriage certificate' };
const RELATIONSHIPS = ['self', 'parent', 'guardian', 'spouse', 'child', 'sibling', 'other'];
export const RELEASE_POLICIES = ['unset', 'after-signature', 'after-acceptance'];
const GUEST_REQUESTS_PER_HOUR = 20;
const isoAgo = ms => {
  const micros = (Date.now() - ms) * 1000, fraction = micros % 1000000;
  return new Date(Math.floor(micros / 1000)).toISOString().slice(0, 19) + (fraction ? '.' + String(fraction).padStart(6, '0') : '') + '+00:00';
};

/* The diocese's rule for releasing signed documents; 'unset' until its bishop decides. */
export async function releasePolicy(c, pid) {
  const parish = await c.first('SELECT diocese FROM parishes WHERE id=?', pid);
  const value = parish ? await setting(c, 'diocese', parish.diocese, 'documentRelease', 'unset') : 'unset';
  return RELEASE_POLICIES.includes(value) ? value : 'unset';
}

function adult(born) {
  if (!born) return true;
  const [y, m, d] = born.split('-').map(Number), [ty, tm, td] = localToday().split('-').map(Number);
  return ty - y - ((tm < m || (tm === m && td < d)) ? 1 : 0) >= 18;
}

/* A certificate asked for without an account. The private tracking link is shown once and, when a
   delivery service is configured, also sent to the contact given. */
export async function guestRequestCreate(c, ctx, pid, q, outbox, baseUrl) {
  need(!truthy(get(q, 'website')), 'The request could not be sent.');  // a field only robots fill in
  const parish = await c.first('SELECT * FROM parishes WHERE id=?', pid);
  need(parish !== null, 'Parish not found.', 404);
  const kind = get(q, 'kind');
  need(Object.prototype.hasOwnProperty.call(GUEST_KINDS, kind), 'Choose the document you need.');
  const s = or(get(q, 'subject'), {}), r = or(get(q, 'requester'), {});
  need(s && typeof s === 'object' && !Array.isArray(s) && r && typeof r === 'object' && !Array.isArray(r), 'Invalid request data.');
  const born = str(or(get(s, 'birthDate'), ''));
  if (born) {
    need(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(born), 'Check the date of birth.');
    const [y, m, dd] = born.split('-').map(Number), date = new Date(Date.UTC(y, m - 1, dd));
    need(date.getUTCMonth() === m - 1 && date.getUTCDate() === dd && born <= localToday(), 'Check the date of birth.');
  }
  const subject = { name: clean(get(s, 'name'), 120, 'Enter the full name of the person the document is about.'), birthDate: born,
    father: clean(get(s, 'father'), 120, 'Check the father’s name.', false), mother: clean(get(s, 'mother'), 120, 'Check the mother’s name.', false),
    when: clean(get(s, 'when'), 120, 'Check the date or year of the sacrament.', false) };
  const relationship = get(r, 'relationship');
  need(RELATIONSHIPS.includes(relationship), 'Say how you are related to this person.');
  if (!adult(born)) need(relationship === 'parent' || relationship === 'guardian', 'A document about a child is asked for by a parent or legal guardian.');
  const requester = { name: clean(get(r, 'name'), 120, 'Enter your name.'), relationship,
    email: strip(str(or(get(r, 'email'), ''))) ? contactValue('email', get(r, 'email')) : '',
    phone: strip(str(or(get(r, 'phone'), ''))) ? contactValue('phone', get(r, 'phone')) : '' };
  need(requester.email || requester.phone, 'Give a phone number or an email address.');
  const delivery = get(q, 'delivery');
  need(delivery === 'download' || delivery === 'collect', 'Choose how you will receive the document.');
  const purpose = clean(get(q, 'purpose'), 500, 'Keep the purpose within 500 characters.', false);
  const year = TODAY().slice(0, 4);
  const [recent, count] = await c.reads([
    ['SELECT COUNT(*) AS n FROM guest_requests WHERE parish_id=? AND created_at>?', [pid, isoAgo(3600 * 1000)]],
    ['SELECT COUNT(*) AS n FROM guest_requests WHERE parish_id=? AND reference LIKE ?', [pid, `GR-${year}-%`]]
  ]);
  need(recent[0].n < GUEST_REQUESTS_PER_HOUR, 'Many requests reached this parish in the last hour. Please try again later or call the parish office.', 429);
  const at = NOW(), rid = 'gr-' + tokenHex(8), token = tokenUrlsafe(24), reference = `GR-${year}-${String(count[0].n + 1).padStart(4, '0')}`;
  const link = `${baseUrl}/public.html?track=${token}`;
  const channel = requester.email ? 'email' : 'sms', mode = deliveryMode(ctx, channel);
  const linkDelivery = { none: 'not-configured', service: 'sending', console: 'console' }[mode];
  c.run('INSERT INTO guest_requests(id,parish_id,reference,token,kind,subject,requester,purpose,delivery,status,link_delivery,created_at,updated_at,log) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    rid, pid, reference, sha(token), kind, dumps(subject), dumps(requester), purpose, delivery, 'submitted', linkDelivery, at, at, dumps([{ key: 'submitted', at }]));
  if (mode !== 'none') {
    const name = get(JSON.parse(parish.metadata), 'name') || 'Your parish';
    outbox.push({ id: rid, table: 'guest_requests', channel, target: requester.email || requester.phone, mode, status: linkDelivery,
      subject: `Your request to ${name} (${reference})`, text: `${name} received your request ${reference}. Follow it with this private link: ${link}` });
  }
  audit(c, { id: null }, pid, 'guest-request.created', { request: rid, kind });
  return { reference, link, linkDelivery, channel };
}

/* Where a certificate stands, in words a requester can follow. */
function certificateStage(s, row) {
  if (row.status === 'declined') return 'declined';
  if (row.status === 'collected') return 'collected';
  if (row.status === 'submitted' || s === null) return 'received';
  const status = get(s, 'status'), acceptance = get(get(s, 'acceptance') ?? {}, 'status');
  if (status === 'rejected' || status === 'cancelled') return 'cancelled';
  if (status === 'issued') return 'ready';
  if (status === 'approved') return acceptance === 'accepted' ? 'accepted' : 'signed';
  return 'review';
}

const guestFiles = (c, pid, rid) => c.all("SELECT id,name,mime,size,created_at FROM uploaded_files WHERE parish_id=? AND scope='guest-request' AND owner_id=? ORDER BY created_at DESC", pid, rid);

export async function guestRequestView(c, row) {
  const [states, parishes, files] = await c.reads([
    ['SELECT data FROM states WHERE parish_id=?', [row.parish_id]], ['SELECT metadata FROM parishes WHERE id=?', [row.parish_id]],
    ["SELECT id FROM uploaded_files WHERE parish_id=? AND scope='guest-request' AND owner_id=?", [row.parish_id, row.id]]
  ]);
  const d = JSON.parse(states[0].data);
  const s = row.certificate_id ? iter(K(d, 'SACRAMENTS')).find(x => x.id === row.certificate_id) ?? null : null;
  const stage = certificateStage(s, row);
  const events = JSON.parse(row.log || '[]');
  const keys = { approve: 'signed', 'bishop accepted': 'bishop-accepted', 'bishop returned': 'review', issue: 'ready', reject: 'cancelled', cancelled: 'cancelled' };
  for (const h of iter(get(s ?? {}, 'history', []))) if (keys[get(h, 'action')]) events.push({ key: keys[h.action], at: get(h, 'at', '') });
  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const subject = JSON.parse(row.subject), meta = JSON.parse(parishes[0].metadata);
  return { reference: row.reference, parish: { id: row.parish_id, name: get(meta, 'name', ''), ar: get(meta, 'ar', '') }, kind: row.kind,
    subject: subject.name, minor: !adult(subject.birthDate), delivery: row.delivery, stage, events, message: row.response, createdAt: row.created_at,
    download: stage === 'ready' && row.delivery === 'download' && files.length > 0 };
}

export async function guestRequestRow(c, token) {
  const row = await c.first('SELECT * FROM guest_requests WHERE token=?', sha(str(or(token, ''))));
  need(row !== null, 'This tracking link is not valid. Check that you copied all of it.', 404);
  return row;
}

/* The signed document, once released, for a request that asked to download it. Returns the file row. */
export async function guestDocument(c, token) {
  const row = await guestRequestRow(c, token);
  const view = await guestRequestView(c, row);
  need(view.download, 'This document is not available to download.', 403);
  const [file] = await guestFiles(c, row.parish_id, row.id);
  audit(c, { id: null }, row.parish_id, 'guest-request.downloaded', { request: row.id });
  return c.first('SELECT id,parish_id,scope,owner_id,name,mime,size,uploaded_by,created_at FROM uploaded_files WHERE id=?', file.id);
}

export async function officeGuestRequests(c, pid, d) {
  const certs = new Map(iter(K(d, 'SACRAMENTS')).filter(s => s.kind === 'certificate').map(s => [s.id, s]));
  const [rows, files, claimants] = await c.reads([
    ["SELECT * FROM guest_requests WHERE parish_id=? AND (status IN ('submitted','accepted') OR updated_at>? OR claim_status='pending') ORDER BY created_at DESC", [pid, isoAgo(120 * 86400 * 1000)]],
    ["SELECT id,owner_id,name,mime,size,created_at FROM uploaded_files WHERE parish_id=? AND scope='guest-request' ORDER BY created_at DESC", [pid]],
    ['SELECT id,name,username FROM users WHERE id IN (SELECT claim_user_id FROM guest_requests WHERE parish_id=?)', [pid]]
  ]);
  const people = new Map(claimants.map(r => [r.id, r]));
  return rows.map(r => {
    const claimant = r.claim_user_id ? people.get(r.claim_user_id) : null;
    return { id: r.id, reference: r.reference, kind: r.kind, subject: JSON.parse(r.subject), requester: JSON.parse(r.requester), purpose: r.purpose,
      delivery: r.delivery, status: r.status, certificateId: r.certificate_id, response: r.response, linkDelivery: r.link_delivery, createdAt: r.created_at,
      stage: certificateStage(certs.get(r.certificate_id) ?? null, r),
      files: files.filter(f => f.owner_id === r.id).map(({ owner_id, ...f }) => f),
      claim: claimant ? { status: r.claim_status, name: claimant.name, username: claimant.username } : null };
  });
}

async function saveState(c, pid, d, revision) {
  d = migrate_state(d);
  validate(d);
  await sync_relationships(c, pid, d);
  c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', dumps(d), pid);
  return revision + 1;
}

function nextNumber(entries, prefix) {
  const numbers = iter(entries).map(x => str(get(x, 'reg', ''))).filter(reg => reg.startsWith(prefix) && /^[0-9]+$/.test(reg.slice(prefix.length)))
    .map(reg => Number(reg.slice(prefix.length)));
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

export async function guestRequestAction(c, u, pid, q) {
  u = await parishUser(c, u, pid);
  need(permsOf(u).has('requests.manage'), 'Permission to handle requests is required.', 403);
  const r = await c.first('SELECT * FROM guest_requests WHERE id=? AND parish_id=?', get(q, 'id'), pid);
  need(r !== null, 'Request not found.', 404);
  const op = get(q, 'op'), at = NOW(), log = JSON.parse(r.log || '[]');
  const row = await c.first('SELECT * FROM states WHERE parish_id=?', pid);
  const d = JSON.parse(row.data);
  let revision = row.revision;
  if (op === 'accept') {
    need(r.status === 'submitted', 'This request was already handled.');
    const personId = get(q, 'personId'), sourceId = get(q, 'sourceRecordId') || null;
    need([...iter(K(d, 'PEOPLE')), ...iter(K(d, 'ARCHIVED'))].some(p => p.id === personId), 'Choose the person’s record in your registers.');
    const source = sourceId ? iter(K(d, 'SACRAMENTS')).find(x => x.id === sourceId) ?? null : null;
    if (sourceId) need(source !== null && source.kind === r.kind && source.person === personId && ['registered', 'issued'].includes(source.status),
      'Choose the official register entry for this person.');
    const prefix = `REQ/${TODAY().slice(0, 4)}/`, cid = 'sc' + tokenHex(10);
    const history = [{ action: 'request submitted', by: u.name, at, guestRequest: r.reference }];
    if (source) history.push({ action: 'submitted for clergy review', by: u.name, at });
    K(d, 'SACRAMENTS').unshift({ id: cid, kind: 'certificate', kindAr: 'طلب شهادة', reg: `${prefix}${pad3(nextNumber(K(d, 'SACRAMENTS'), prefix))}`,
      person: personId, date: TODAY(), celebrant: get(source ?? {}, 'celebrant') || '', status: source ? 'awaiting-signature' : 'draft',
      sourceRecordId: sourceId, requestedSacramentId: null, purpose: r.purpose || GUEST_KINDS[r.kind], godparents: '', history, revision: 1, guestRequest: r.reference });
    revision = await saveState(c, pid, d, revision);
    c.run("UPDATE guest_requests SET status='accepted',certificate_id=?,updated_at=?,log=? WHERE id=?", cid, at, dumps([...log, { key: 'accepted', at }]), r.id);
    audit(c, u, pid, 'guest-request.accepted', { request: r.id, certificate: cid });
    return { revision, certificateId: cid };
  }
  if (op === 'decline') {
    need(r.status === 'submitted' || r.status === 'accepted', 'This request was already closed.');
    const note = clean(get(q, 'note'), 500, 'Tell them why, in 500 characters or fewer.');
    c.run("UPDATE guest_requests SET status='declined',response=?,updated_at=?,log=? WHERE id=?", note, at, dumps([...log, { key: 'declined', at }]), r.id);
    audit(c, u, pid, 'guest-request.declined', { request: r.id });
    return { revision };
  }
  if (op === 'collected') {
    const s = iter(K(d, 'SACRAMENTS')).find(x => x.id === r.certificate_id) ?? null;
    need(r.status === 'accepted' && s !== null && s.status === 'issued', 'Release the document before marking it collected.');
    c.run("UPDATE guest_requests SET status='collected',updated_at=?,log=? WHERE id=?", at, dumps([...log, { key: 'collected', at }]), r.id);
    audit(c, u, pid, 'guest-request.collected', { request: r.id });
    return { revision };
  }
  if (op === 'approveClaim' || op === 'declineClaim') {
    need(r.claim_status === 'pending', 'Nobody is waiting to link this request.');
    const approve = op === 'approveClaim';
    c.run('UPDATE guest_requests SET claim_status=?,updated_at=? WHERE id=?', approve ? 'approved' : 'declined', at, r.id);
    const priv = await c.first('SELECT data FROM member_private WHERE parish_id=? AND user_id=?', pid, r.claim_user_id);
    notify_member(c, pid, r.claim_user_id, 'request', `Request ${r.reference} ` + (approve ? 'is now linked to your account' : 'was not linked to your account'), '', 'myrequests', priv?.data);
    audit(c, u, pid, 'guest-request.claim-' + (approve ? 'approved' : 'declined'), { request: r.id });
    return { revision };
  }
  throw new Problem(400, 'Unknown action.');
}

/* An account asks to see a request it made as a guest. Holding the private link is the proof, and the
   office still confirms; a matching name, phone or email never links anything by itself. */
export async function guestRequestClaim(c, u, pid, q) {
  const r = await guestRequestRow(c, get(q, 'token'));
  need(r.parish_id === pid, 'This request belongs to another parish.', 404);
  need(!['pending', 'approved'].includes(r.claim_status) || r.claim_user_id === u.id, 'This request is already linked to another account.', 409);
  need(r.claim_status !== 'approved', 'This request is already linked to your account.');
  c.run("UPDATE guest_requests SET claim_user_id=?,claim_status='pending',updated_at=? WHERE id=?", u.id, NOW(), r.id);
  audit(c, u, pid, 'guest-request.claimed', { request: r.id });
  return { reference: r.reference };
}

export async function claimedGuestRequests(c, u, pid) {
  const rows = await c.all("SELECT * FROM guest_requests WHERE parish_id=? AND claim_user_id=? AND claim_status IN ('pending','approved') ORDER BY created_at DESC", pid, u.id);
  const out = [];
  for (const r of rows) out.push({ ...await guestRequestView(c, r), id: r.id, claim: r.claim_status });
  return out;
}

/* Certificates signed by priests in the bishop's dioceses, waiting for (or recently given) the bishop's acceptance. */
export async function dioceseDocuments(c, u) {
  const auth = await authority(c, u);
  const dioceses = (await c.all("SELECT id FROM dioceses WHERE id<>''")).map(r => r.id).filter(did => diocesePerms(auth, did).has('documents.accept'));
  need(dioceses.length, 'Accepting signed documents belongs to the bishop.', 403);
  const since = isoAgo(60 * 86400 * 1000), out = [];
  const parishes = await c.all(`SELECT * FROM parishes WHERE diocese IN (${dioceses.map(() => '?').join(',')}) ORDER BY rowid`, ...dioceses);
  const states = parishes.length ? await c.reads(parishes.map(p => ['SELECT data FROM states WHERE parish_id=?', [p.id]])) : [];
  parishes.forEach((p, i) => {
    const d = JSON.parse(states[i][0].data), meta = JSON.parse(p.metadata);
    const people = new Map([...iter(K(d, 'PEOPLE')), ...iter(K(d, 'ARCHIVED'))].map(x => [x.id, x]));
    const regs = new Map(iter(K(d, 'SACRAMENTS')).map(x => [x.id, x]));
    for (const s of iter(K(d, 'SACRAMENTS'))) {
      const a = get(s, 'acceptance');
      if (s.kind !== 'certificate' || !a || (a.status !== 'awaiting' && str(or(a.at, '')) < since)) continue;
      const source = regs.get(s.sourceRecordId) ?? {};
      out.push({ parish: p.id, parishName: get(meta, 'name', ''), parishAr: get(meta, 'ar', ''), id: s.id, reg: s.reg ?? '',
        person: people.get(s.person)?.lat ?? '', source: { kind: source.kind ?? '', reg: source.reg ?? '' }, purpose: s.purpose ?? '',
        signedBy: s.approvedBy ?? '', signedAt: s.approvedAt ?? '', status: s.status, acceptance: a });
    }
  });
  const policies = {};
  for (const did of dioceses) policies[did] = await setting(c, 'diocese', did, 'documentRelease', 'unset');
  return { documents: out, policies };
}

export async function dioceseDocumentAction(c, u, q) {
  const pid = get(q, 'parish');
  const parish = typeof pid === 'string' ? await c.first('SELECT * FROM parishes WHERE id=?', pid) : null;
  need(parish !== null, 'Parish not found.', 404);
  need(diocesePerms(await authority(c, u), parish.diocese).has('documents.accept'), 'Accepting signed documents belongs to the bishop.', 403);
  const row = await c.first('SELECT * FROM states WHERE parish_id=?', pid);
  const d = JSON.parse(row.data), at = NOW();
  const s = iter(K(d, 'SACRAMENTS')).find(x => x.id === get(q, 'id') && x.kind === 'certificate') ?? null;
  /* A document the diocesan policy already released on signature is still accepted (or returned) by the bishop. */
  need(s !== null && get(get(s, 'acceptance') ?? {}, 'status') === 'awaiting' && ['approved', 'issued'].includes(s.status), 'This document is not waiting for your acceptance.', 409);
  const decision = get(q, 'decision');
  need(decision === 'accept' || decision === 'return', 'Accept the document or return it to the priest.');
  const note = clean(get(q, 'note'), 500, 'Say why you are returning it, in 500 characters or fewer.', decision === 'return');
  const accept = decision === 'accept';
  s.acceptance = { status: accept ? 'accepted' : 'returned', by: u.name, at, note };
  (s.history ??= []).push({ action: accept ? 'bishop accepted' : 'bishop returned', by: u.name, at, note });
  if (!accept) { if (s.status === 'approved') s.status = 'awaiting-signature'; }   // back to the priest, who reviews and signs again
  else if (s.status === 'approved' && await releasePolicy(c, pid) === 'after-acceptance') {
    Object.assign(s, { status: 'issued', issuedBy: 'Released by the diocesan policy', issuedAt: at });
    s.history.push({ action: 'issue', by: 'Diocesan policy: release after the bishop’s acceptance', at, automatic: true });
  }
  await saveState(c, pid, d, row.revision);
  for (const r of await c.all("SELECT DISTINCT user_id FROM parish_accounts WHERE parish_id=? AND role='priest'", pid))
    notifyAccount(c, r.user_id, pid, 'document', `${s.reg ?? ''} ` + (accept ? 'accepted by the bishop' : 'returned by the bishop'), note, 'requests');
  audit(c, u, pid, 'document.bishop-' + (accept ? 'accepted' : 'returned'), { certificate: s.id });
  return {};
}

/* Read-only totals for the parishes whose finances this account may see from the diocese or the system. */
export async function financeOverview(c, auth, parishRows) {
  const visible = parishRows.filter(p => diocesePerms(auth, p.diocese).has('finance.view'));
  const states = visible.length ? await c.reads(visible.map(p => ['SELECT data FROM states WHERE parish_id=?', [p.id]])) : [];
  return visible.map((p, i) => {
    const d = JSON.parse(states[i][0].data), meta = JSON.parse(p.metadata), expenses = iter(get(d, 'EXPENSES', []));
    const num = v => Number(v) || 0;
    return { parish: p.id, name: get(meta, 'name', ''), ar: get(meta, 'ar', ''), diocese: p.diocese,
      funds: iter(get(d, 'FUNDS', [])).map(f => ({ name: f.name ?? '', ar: f.ar ?? '', budget: f.budget ?? 0, actual: f.actual ?? 0, restricted: Boolean(f.restricted) })),
      expensesApproved: expenses.filter(x => x.status === 'approved').reduce((t, x) => t + num(x.usd), 0),
      expensesWaiting: expenses.filter(x => x.status === 'awaiting-approval').length,
      giving: iter(get(d, 'GIVING_SERIES', [])).slice(-12),
      pledged: iter(get(d, 'PLEDGES', [])).reduce((t, x) => t + num(x.pledged), 0),
      paid: iter(get(d, 'PLEDGES', [])).reduce((t, x) => t + num(x.paid), 0) };
  });
}
