/* Plans: modules a parish uses, bundles, diocesan arrangements, change requests. Ported from server.py.
   A plan says which modules a parish has switched on; it never grants anyone access — people still need
   the role permissions for each part. No prices, limits or billing periods are set and nothing is charged:
   this is configuration only. Every parish that had no plan keeps every module it had (all of them), and
   changing a plan never deletes records, cancels bookings or drops requests that are already waiting.
   (The tables and the module list are in authority.js.) */
import { Problem, need, get, iter, tokenHex, NOW } from './py.js';
import { authority, parishContext, systemPerms, diocesePerms, clean, PLAN_MODULES, ALL_MODULES } from './authority.js';
import { audit } from './app.js';
import { notifyAccount, parishPriestAccounts } from './ministries.js';
import { namesOf } from './privacy.js';

export const PRESENCE_DOCUMENTS = ['undecided', 'included', 'separate'];
/* Starting options. Public Presence is the option the requirements name; the other two only show how
   bundles look and are marked as demonstration configuration, not approved packages. */
const SEED_BUNDLES = [
  ['public-presence', 'Public Presence', 'الحضور العام', 'Appearing on ParishLife with the parish’s public profile and published information, without operational modules.',
    'الظهور على ParishLife بملف الرعية العام ومعلوماتها المنشورة، دون الوحدات التشغيلية.', ['presence'], 0],
  ['demo-office', 'Example: parish office (demonstration)', 'مثال: مكتب الرعية (للعرض)', 'Demonstration configuration only — not an approved package.',
    'إعداد للعرض فقط — ليس باقة معتمدة.', ['presence', 'members', 'office', 'sacraments', 'requests', 'documents', 'communications'], 1],
  ['demo-complete', 'Example: every module (demonstration)', 'مثال: كل الوحدات (للعرض)', 'Demonstration configuration only — not an approved package.',
    'إعداد للعرض فقط — ليس باقة معتمدة.', ALL_MODULES, 1]
];
/* What each kind of member request needs; every other kind belongs to sacraments and certificates. */
export const REQUEST_MODULE = { booking: 'reservations', custom: 'requests' };

export async function migratePlans(c) {
  if (!(await c.all("SELECT 1 AS x FROM schema_migrations WHERE name='v2-plans'")).length) {
    const at = NOW();
    for (const [bid, name, nameAr, desc, descAr, modules, demo] of SEED_BUNDLES)
      c.run('INSERT OR IGNORE INTO plan_bundles VALUES(?,?,?,?,?,?,?,?,?,?,?)', bid, name, nameAr, desc, descAr, JSON.stringify(modules), demo, 'active', at, null, at);
    c.run("INSERT OR IGNORE INTO schema_migrations VALUES('v2-plans',?)", at);
  }
}

function cleanModules(modules) {
  need(Array.isArray(modules) && modules.every(m => ALL_MODULES.includes(m)), 'Choose modules from the list.');
  const chosen = new Set([...modules, 'presence']);
  return ALL_MODULES.filter(m => chosen.has(m));
}

/* A parish's plan. Without one (every parish before plans existed), every module stays on. */
export async function parishPlan(c, pid) {
  const row = await c.first('SELECT * FROM parish_plans WHERE parish_id=?', pid);
  if (row === null) return { parish: pid, mode: 'unchosen', bundle: null, modules: [...ALL_MODULES], arrangement: null, updatedAt: '' };
  return { parish: pid, mode: row.mode, bundle: row.bundle_id, modules: JSON.parse(row.modules), arrangement: row.arrangement_id, updatedAt: row.updated_at };
}

export const moduleOn = async (c, pid, module) => (await parishPlan(c, pid)).modules.includes(module);

export async function presenceDocuments(c) {
  const row = await c.first("SELECT value FROM settings WHERE scope='system' AND scope_id='' AND key='presenceDocuments'");
  return row ? JSON.parse(row.value) : 'undecided';
}

/* Whether a parish takes certificate requests from its public page. Until the operator decides whether
   Public Presence includes them, they stay available to every parish, as they were. */
export async function documentsOpen(c, pid) {
  return (await moduleOn(c, pid, 'documents')) || (await presenceDocuments(c)) !== 'separate';
}

export async function requireModule(c, pid, module, what) {
  need(await moduleOn(c, pid, module), `This parish does not offer ${what} on ParishLife at the moment.`, 403);
}

async function planCatalog(c, allBundles = false) {
  const rows = await c.all('SELECT * FROM plan_bundles ORDER BY demo,created_at,id');
  return {
    modules: PLAN_MODULES.map(m => ({ id: m[0], en: m[1], ar: m[2], about: m[3], aboutAr: m[4], always: m[0] === 'presence' })),
    bundles: rows.filter(r => allBundles || r.status === 'active').map(r => ({ id: r.id, name: r.name, nameAr: r.name_ar, description: r.description,
      descriptionAr: r.description_ar, modules: JSON.parse(r.modules), demo: Boolean(r.demo), status: r.status })),
    presenceDocuments: await presenceDocuments(c), billing: 'not-live'
  };
}

/* The public "Plans for parishes" page: what can be switched on, the bundles on offer, and nothing about prices. */
export const plansPublic = c => planCatalog(c);

/* What is still waiting in modules a change would switch off. It all stays, and can still be finished. */
async function planPendingWork(c, pid, removed) {
  if (!removed.length) return {};
  const d = JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?', pid)).data);
  const count = async (sql, ...a) => Object.values(await c.first(sql, pid, ...a))[0];
  const out = {};
  if (removed.includes('reservations')) out.reservations = iter(d.RESERVATIONS).filter(r => r.status === 'pending').length +
    await count("SELECT COUNT(*) AS n FROM member_requests WHERE parish_id=? AND kind='booking' AND status='submitted'");
  if (removed.includes('sacraments')) out.sacraments = iter(d.SACRAMENTS).filter(s => ['requested', 'office-reviewed', 'awaiting-signature', 'preparing', 'scheduled', 'draft', 'approved'].includes(s.status)).length +
    await count("SELECT COUNT(*) AS n FROM member_requests WHERE parish_id=? AND kind NOT IN ('booking','custom') AND status IN ('submitted','accepted')");
  if (removed.includes('requests')) out.requests = await count("SELECT COUNT(*) AS n FROM member_requests WHERE parish_id=? AND kind='custom' AND status IN ('submitted','accepted')") + iter(d.PORTAL_REQUESTS).length;
  if (removed.includes('documents')) out.documents = await count("SELECT COUNT(*) AS n FROM guest_requests WHERE parish_id=? AND status IN ('submitted','accepted')");
  if (removed.includes('ministries')) out.ministries = await count("SELECT COUNT(*) AS n FROM ministry_applications WHERE parish_id=? AND status IN ('pending','leader-approved')") +
    await count("SELECT COUNT(*) AS n FROM ministry_inquiries WHERE parish_id=? AND status='new'");
  if (removed.includes('members')) out.members = await count("SELECT COUNT(*) AS n FROM membership_requests WHERE parish_id=? AND status='pending'");
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v));
}

function planRecord(c, u, pid, arrangement, action, detail) {
  c.run('INSERT INTO plan_history VALUES(?,?,?,?,?,?,?)', 'ph-' + tokenHex(8), pid, arrangement, action, JSON.stringify(detail), u ? u.id : null, NOW());
}

async function setParishPlan(c, u, pid, mode, bundleId, modules, arrangementId, action) {
  const before = await parishPlan(c, pid);
  const at = NOW();
  c.run('INSERT INTO parish_plans VALUES(?,?,?,?,?,?,?) ON CONFLICT(parish_id) DO UPDATE SET mode=excluded.mode,bundle_id=excluded.bundle_id,' +
    'modules=excluded.modules,arrangement_id=excluded.arrangement_id,updated_at=excluded.updated_at,updated_by=excluded.updated_by',
    pid, mode, bundleId, JSON.stringify(modules), arrangementId, at, u.id);
  const removed = before.modules.filter(m => !modules.includes(m));
  planRecord(c, u, pid, arrangementId, action, { mode, bundle: bundleId, modules, removed, added: modules.filter(m => !before.modules.includes(m)) });
  audit(c, u, pid, 'plan.' + action, { mode, bundle: bundleId, removed });
  for (const userId of await parishPriestAccounts(c, pid))
    if (userId !== u.id) notifyAccount(c, userId, pid, 'plan', 'The parish plan changed', modules.join(', '), 'administration/plans');
}

async function bundleModules(c, bundleId) {
  const row = await c.first("SELECT modules FROM plan_bundles WHERE id=? AND status='active'", bundleId);
  need(row !== null, 'Choose a bundle that is on offer.');
  return JSON.parse(row.modules);
}

/* A bundle and any modules added to it, or a list of modules alone. */
async function chosenModules(c, q) {
  const bundleId = get(q, 'bundle') || null;
  const base = bundleId ? await bundleModules(c, bundleId) : [];
  const extra = get(q, 'modules') ?? [];
  need(Array.isArray(extra), 'Choose modules from the list.');
  return [bundleId, cleanModules([...base, ...extra])];
}

async function dioceseSponsors(c, did) {
  const out = [];
  for (const r of await c.all("SELECT DISTINCT user_id FROM role_assignments WHERE scope='diocese' AND scope_id=? AND status='active'", did)) {
    const account = await c.first('SELECT * FROM users WHERE id=?', r.user_id);
    if (account && diocesePerms(await authority(c, account), did).has('plans.sponsor')) out.push(r.user_id);
  }
  return out;
}

/* Plan management within this account's authority: its parishes (as their priest), its dioceses'
   arrangements and change requests (as bishop or diocesan admin), and the options on offer (super admin). */
export async function plansView(c, u) {
  const auth = await authority(c, u);
  const system = systemPerms(auth);
  const out = { ...(await planCatalog(c, system.has('plans.configure'))), configure: system.has('plans.configure'), parishes: [], dioceses: [] };
  for (const r of await c.all('SELECT * FROM parishes ORDER BY rowid')) {
    const meta = JSON.parse(r.metadata);
    const ctx = await parishContext(c, u, r.id, auth, r);
    const manage = Boolean(ctx && ctx.perms.has('plans.manage'));
    const sponsor = diocesePerms(auth, r.diocese).has('plans.sponsor');
    if (!manage && !sponsor) continue;
    const [requestRows, historyRows] = await c.reads([
      ['SELECT * FROM plan_requests WHERE parish_id=? ORDER BY created_at DESC LIMIT 20', [r.id]],
      ['SELECT * FROM plan_history WHERE parish_id=? ORDER BY at DESC LIMIT 10', [r.id]]
    ]);
    out.parishes.push({ id: r.id, name: meta.name ?? '', ar: meta.ar ?? '', diocese: r.diocese, plan: await parishPlan(c, r.id), manage, sponsor,
      requests: requestRows.map(x => ({ id: x.id, bundle: x.bundle_id, modules: JSON.parse(x.modules), note: x.note, status: x.status,
        createdAt: x.created_at, requestedBy: x.requested_by, decidedAt: x.decided_at || '', decisionNote: x.decision_note })),
      history: historyRows.map(x => ({ action: x.action, detail: JSON.parse(x.detail), at: x.at })) });
  }
  const names = await namesOf(c, out.parishes.flatMap(p => p.requests.map(r => r.requestedBy)));
  for (const p of out.parishes) for (const r of p.requests) r.requestedByName = names.get(r.requestedBy) ?? '';
  for (const d of await c.all("SELECT * FROM dioceses WHERE id<>'' ORDER BY name")) {
    if (!diocesePerms(auth, d.id).has('plans.sponsor')) continue;
    const arrangements = [];
    for (const a of await c.all('SELECT * FROM plan_arrangements WHERE diocese=? ORDER BY created_at DESC', d.id)) {
      arrangements.push({ id: a.id, name: a.name, bundle: a.bundle_id, modules: JSON.parse(a.modules), status: a.status, note: a.note,
        createdAt: a.created_at, endedAt: a.ended_at || '',
        parishes: (await c.all('SELECT parish_id FROM parish_plans WHERE arrangement_id=?', a.id)).map(x => x.parish_id) });
    }
    out.dioceses.push({ id: d.id, name: d.name, arrangements });
  }
  return out;
}

export async function plansAction(c, u, q) {
  const auth = await authority(c, u);
  const op = get(q, 'op'), at = NOW();
  if (['bundleSave', 'bundleRetire', 'setPresenceDocuments'].includes(op)) {
    need(systemPerms(auth).has('plans.configure'), 'Only a super admin configures the plan options.', 403);
    if (op === 'setPresenceDocuments') {
      const value = get(q, 'value');
      need(PRESENCE_DOCUMENTS.includes(value), 'Choose whether Public Presence includes document requests.');
      c.run("INSERT INTO settings VALUES('system','','presenceDocuments',?,?,?) ON CONFLICT(scope,scope_id,key) DO UPDATE SET " +
        'value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by', JSON.stringify(value), at, u.id);
      planRecord(c, u, null, null, 'presence-documents', { value });
      return {};
    }
    if (op === 'bundleRetire') {
      const row = await c.first('SELECT * FROM plan_bundles WHERE id=?', get(q, 'id'));
      need(row !== null, 'Bundle not found.', 404);
      /* Parishes on it keep their modules; it is simply no longer offered. */
      const retire = get(q, 'retire', true) !== false;
      c.run('UPDATE plan_bundles SET status=?,updated_at=? WHERE id=?', retire ? 'retired' : 'active', at, row.id);
      planRecord(c, u, null, null, retire ? 'bundle-retired' : 'bundle-offered', { bundle: row.id });
      return {};
    }
    const name = clean(get(q, 'name'), 80, 'Give the bundle a name of up to 80 characters.');
    const nameAr = clean(get(q, 'nameAr'), 80, 'Keep the Arabic name within 80 characters.', false);
    const desc = clean(get(q, 'description'), 400, 'Keep the description within 400 characters.', false);
    const descAr = clean(get(q, 'descriptionAr'), 400, 'Keep the Arabic description within 400 characters.', false);
    const modules = cleanModules(get(q, 'modules'));
    const demo = get(q, 'demo') !== false ? 1 : 0;   // a new bundle is a demonstration until someone says it is not
    let bid = get(q, 'id');
    if (bid) {
      need(await c.first('SELECT 1 AS x FROM plan_bundles WHERE id=?', bid), 'Bundle not found.', 404);
      c.run('UPDATE plan_bundles SET name=?,name_ar=?,description=?,description_ar=?,modules=?,demo=?,updated_at=? WHERE id=?',
        name, nameAr, desc, descAr, JSON.stringify(modules), demo, at, bid);
    } else {
      bid = 'pb-' + tokenHex(6);
      c.run('INSERT INTO plan_bundles VALUES(?,?,?,?,?,?,?,?,?,?,?)', bid, name, nameAr, desc, descAr, JSON.stringify(modules), demo, 'active', at, u.id, at);
    }
    planRecord(c, u, null, null, 'bundle-saved', { bundle: bid, modules, demo: Boolean(demo) });
    return { id: bid };
  }
  if (op === 'arrangementEnd') {
    const a = await c.first("SELECT * FROM plan_arrangements WHERE id=? AND status='active'", get(q, 'id'));
    need(a !== null, 'Arrangement not found.', 404);
    need(diocesePerms(auth, a.diocese).has('plans.sponsor'), 'Diocesan plan permission required.', 403);
    for (const p of await c.all('SELECT parish_id FROM parish_plans WHERE arrangement_id=?', a.id)) {
      const plan = await parishPlan(c, p.parish_id);   // each parish keeps its modules and manages them itself from now on
      await setParishPlan(c, u, p.parish_id, 'independent', plan.bundle, plan.modules, null, 'arrangement-ended');
    }
    c.run("UPDATE plan_arrangements SET status='ended',ended_at=?,ended_by=? WHERE id=?", at, u.id, a.id);
    return {};
  }
  if (op === 'arrangementSave') {
    const did = get(q, 'diocese');
    need(diocesePerms(auth, did || '').has('plans.sponsor'), 'Diocesan plan permission required.', 403);
    const name = clean(get(q, 'name'), 120, 'Name the arrangement in up to 120 characters.');
    const note = clean(get(q, 'note'), 500, 'Keep the note within 500 characters.', false);
    const [bundleId, modules] = await chosenModules(c, q);
    const parishesIn = get(q, 'parishes');
    const dioceseParishes = new Set((await c.all('SELECT id FROM parishes WHERE diocese=?', did)).map(r => r.id));
    need(Array.isArray(parishesIn) && parishesIn.length && parishesIn.every(p => dioceseParishes.has(p)), 'Choose parishes of this diocese.');
    let aid = get(q, 'id');
    if (aid) {
      need(await c.first("SELECT 1 AS x FROM plan_arrangements WHERE id=? AND diocese=? AND status='active'", aid, did), 'Arrangement not found.', 404);
      c.run('UPDATE plan_arrangements SET name=?,bundle_id=?,modules=?,note=? WHERE id=?', name, bundleId, JSON.stringify(modules), note, aid);
    } else {
      aid = 'pa-' + tokenHex(6);
      c.run('INSERT INTO plan_arrangements VALUES(?,?,?,?,?,?,?,?,?,?,?)', aid, did, name, bundleId, JSON.stringify(modules), 'active', note, at, u.id, null, null);
    }
    const current = new Set((await c.all('SELECT parish_id FROM parish_plans WHERE arrangement_id=?', aid)).map(r => r.parish_id));
    const wanted = [...new Set(parishesIn)].sort();
    const plans = new Map();
    for (const pid of [...new Set([...wanted, ...current])]) plans.set(pid, await parishPlan(c, pid));
    const losing = wanted.filter(pid => plans.get(pid).modules.some(m => !modules.includes(m)));
    need(!losing.length || get(q, 'confirmRemoval') === true, 'Confirm switching modules off for some of these parishes. Their records are kept.');
    for (const pid of wanted) {
      const other = plans.get(pid).arrangement;
      need(other === null || other === aid, 'A parish can be covered by one arrangement at a time; end or edit the other one first.', 409);
      await setParishPlan(c, u, pid, 'sponsored', bundleId, modules, aid, current.has(pid) ? 'arrangement-updated' : 'arrangement-joined');
    }
    for (const pid of [...current].filter(p => !wanted.includes(p)).sort()) {
      const plan = plans.get(pid);
      await setParishPlan(c, u, pid, 'independent', plan.bundle, plan.modules, null, 'arrangement-left');
    }
    return { id: aid };
  }
  const pid = get(q, 'parish');
  const parish = await c.first('SELECT * FROM parishes WHERE id=?', pid);
  need(parish !== null, 'Parish not found.', 404);
  const ctx = await parishContext(c, u, pid, auth, parish);
  const manage = Boolean(ctx && ctx.perms.has('plans.manage'));
  const sponsor = diocesePerms(auth, parish.diocese).has('plans.sponsor');
  const plan = await parishPlan(c, pid);
  if (op === 'preview') {
    need(manage || sponsor, 'Plan permission required.', 403);
    const [, modules] = await chosenModules(c, q);
    const removed = plan.modules.filter(m => !modules.includes(m));
    return { modules, removed, added: modules.filter(m => !plan.modules.includes(m)), pending: await planPendingWork(c, pid, removed) };
  }
  if (op === 'activate') {
    need(manage, 'The parish priest manages the parish plan.', 403);
    need(plan.mode !== 'sponsored', 'The diocese manages this parish’s plan. Send a change request instead.', 409);
    const [bundleId, modules] = await chosenModules(c, q);
    const removed = plan.modules.filter(m => !modules.includes(m));
    need(!removed.length || get(q, 'confirmRemoval') === true, 'Confirm switching off ' + removed.join(', ') + '. Their records are kept.');
    await setParishPlan(c, u, pid, 'independent', bundleId, modules, null, 'activated');
    return { plan: { ...plan, mode: 'independent', bundle: bundleId, modules, arrangement: null, updatedAt: at } };
  }
  if (op === 'request') {
    need(manage, 'The parish priest asks for plan changes.', 403);
    need(plan.mode === 'sponsored', 'This parish manages its own plan; activate the change directly.', 409);
    need(!(await c.first("SELECT 1 AS x FROM plan_requests WHERE parish_id=? AND status='pending'", pid)), 'A change request is already waiting for the diocese.', 409);
    const [bundleId, modules] = await chosenModules(c, q);
    const note = clean(get(q, 'note'), 500, 'Keep the note within 500 characters.', false);
    const rid = 'pr-' + tokenHex(8);
    c.run('INSERT INTO plan_requests(id,parish_id,requested_by,bundle_id,modules,note,status,created_at) VALUES(?,?,?,?,?,?,?,?)',
      rid, pid, u.id, bundleId, JSON.stringify(modules), note, 'pending', at);
    planRecord(c, u, pid, plan.arrangement, 'change-requested', { request: rid, modules });
    for (const userId of await dioceseSponsors(c, parish.diocese))
      notifyAccount(c, userId, pid, 'plan', 'A parish asked to change its plan', JSON.parse(parish.metadata).name ?? '', 'administration/plans');
    return { id: rid };
  }
  if (op === 'withdrawRequest' || op === 'decideRequest') {
    const r = await c.first("SELECT * FROM plan_requests WHERE id=? AND parish_id=? AND status='pending'", get(q, 'id'), pid);
    need(r !== null, 'There is no waiting request.', 404);
    if (op === 'withdrawRequest') {
      need(manage, 'The parish priest manages the parish plan.', 403);
      c.run("UPDATE plan_requests SET status='withdrawn',decided_by=?,decided_at=? WHERE id=?", u.id, at, r.id);
      planRecord(c, u, pid, plan.arrangement, 'change-withdrawn', { request: r.id });
      return {};
    }
    need(sponsor, 'Diocesan plan permission required.', 403);
    const decision = get(q, 'decision');
    need(decision === 'approve' || decision === 'decline', 'Approve or decline the request.');
    const note = clean(get(q, 'note'), 500, 'Keep the note within 500 characters.', false);
    c.run('UPDATE plan_requests SET status=?,decided_by=?,decided_at=?,decision_note=? WHERE id=?', decision === 'approve' ? 'approved' : 'declined', u.id, at, note, r.id);
    if (decision === 'approve') {
      await setParishPlan(c, u, pid, plan.mode === 'sponsored' ? 'sponsored' : 'independent', r.bundle_id, JSON.parse(r.modules), plan.arrangement, 'change-approved');
    } else {
      planRecord(c, u, pid, plan.arrangement, 'change-declined', { request: r.id, note });
    }
    notifyAccount(c, r.requested_by, pid, 'plan', 'Your plan change request was ' + (decision === 'approve' ? 'approved' : 'declined'), note, 'administration/plans');
    return {};
  }
  throw new Problem(400, 'Unknown action.');
}
