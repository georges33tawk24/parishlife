/* How the public site is used, for the Super Admin's Insights and CRM; the same as
   backend/analytics.py. Visits are counted without cookies and without keeping anyone's
   address: each day a fresh random salt turns a visitor's address and browser into a hash that
   cannot be followed from one day to the next, the salt is forgotten the next day, and the
   hashes themselves are deleted after 95 days. A "visit" is one visitor on one day. */
import { need, sha256hex, tokenHex, NOW, localToday } from './py.js';
import { isSuperAdmin, parishPlan, history } from './workspace.js';
import { publishedContent, publicEvents } from './public-site.js';

const PAGES = new Set(['home', 'parish', 'event', 'calendar', 'request', 'bundles', 'track', 'verify', 'error']);
const ACTIONS = new Set(['ics', 'ics-all', 'subscribe', 'google', 'share-whatsapp', 'share-copy', 'share-native', 'directions', 'call',
  'livestream', 'whatsapp-follow', 'search', 'request-sent', 'near-me']);
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|curl|wget|python|httpclient|monitor|scan/i;
const UPSERT = 'INSERT INTO pl_stats VALUES(?,?,?,?,1) ON CONFLICT(day,metric,key,parish_id) DO UPDATE SET n=n+1';
const KEEP_DAYS = 95, STAGES = ['onboarding', 'active', 'attention', 'paused'], NOTE_KINDS = ['note', 'call', 'meeting', 'email', 'visit'];
const SAVES = ['ics', 'ics-all', 'subscribe', 'google'], SHARES = ['share-whatsapp', 'share-copy', 'share-native'];
const shift = (day, n) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* Counted inside a request's transaction (a sign-in, for instance). */
export const stat = (c, metric, key, parish = '') => c.run(UPSERT, localToday(), metric, key, parish);

export function source(referrer, host) {
  let name = '';
  try { name = new URL(String(referrer || '')).hostname.toLowerCase(); } catch { name = ''; }
  if (!name) return 'direct';
  if (name === String(host || '').split(':')[0].toLowerCase()) return 'internal';
  const within = (...sites) => sites.some(s => name === s || name.endsWith('.' + s));
  if (name.includes('whatsapp') || within('wa.me', 'l.wl.co')) return 'whatsapp';
  if (within('facebook.com', 'fb.com', 'instagram.com', 't.co', 'twitter.com', 'x.com', 'tiktok.com', 'linkedin.com', 'youtube.com')) return 'social';
  if (/(^|\.)google\./.test(name)) return 'google';
  if (within('bing.com', 'duckduckgo.com', 'yahoo.com', 'yandex.ru', 'yandex.com', 'ecosia.org', 'baidu.com')) return 'search';
  return 'other';
}
export function device(agent) {
  const a = agent.toLowerCase();
  if (a.includes('ipad') || a.includes('tablet') || (a.includes('android') && !a.includes('mobile'))) return 'tablet';
  return a.includes('mobi') || a.includes('iphone') || a.includes('android') ? 'phone' : 'desktop';
}

/* One page view or action, sent by a visitor's browser (assets/beacon.js). Written straight to
   D1, outside the transaction guard, so visits never hold up the office's own changes. */
export async function record(db, q, address, agent, host) {
  if (!agent || BOTS.test(agent) || !q || typeof q !== 'object' || Array.isArray(q)) return;
  const kind = q.t, page = String(q.p || ''), action = String(q.a || '');
  if (!(kind === 'view' && PAGES.has(page) || kind === 'action' && ACTIONS.has(action))) return;
  const day = localToday();
  let parish = String(q.parish || '').slice(0, 80);
  if (parish && !await db.prepare('SELECT 1 FROM parishes WHERE id=?').bind(parish).first()) parish = '';
  const [made, found] = await db.batch([db.prepare('INSERT OR IGNORE INTO pl_stats_salt VALUES(?,?)').bind(day, tokenHex(16)), db.prepare('SELECT salt FROM pl_stats_salt WHERE day=?').bind(day)]);
  const writes = [];
  // A new day: the old salt is forgotten, so yesterday's hashes can never be matched again.
  if (made.meta?.changes) writes.push(db.prepare('DELETE FROM pl_stats_salt WHERE day<>?').bind(day), db.prepare('DELETE FROM pl_visitors WHERE day<?').bind(shift(day, -KEEP_DAYS)));
  const visitor = sha256hex(`${found.results[0].salt}|${address}|${agent}`).slice(0, 32);
  const seen = (scope, extra = ['', '', '']) => writes.push(db.prepare('INSERT OR IGNORE INTO pl_visitors VALUES(?,?,?,?,?,?)').bind(day, visitor, scope, ...extra));
  const count = (metric, key, at = '') => writes.push(db.prepare(UPSERT).bind(day, metric, key, at));
  if (kind === 'view') {
    const origin = source(q.r, host);
    seen('', [device(agent), q.lang === 'ar' ? 'ar' : 'en', origin === 'internal' ? 'direct' : origin]);
    seen('k:' + page);
    count('view', page);
    if (parish) { count('view', page, parish); seen('p:' + parish); }
  } else {
    seen('a:' + action);
    count('action', action, parish);
    const term = String(q.q || '').toLowerCase().split(/\s+/).filter(Boolean).join(' ').slice(0, 60);
    if (action === 'search' && term.length >= 2) count('search', term);
  }
  await db.batch(writes);
}

/* ---------- Insights ---------- */
const when = value => { const t = Date.parse(String(value || '').replace(/(\.\d{3})\d+/, '$1')); return Number.isFinite(t) ? t : null; };
const keyed = rows => new Map(rows.map(row => [row.k, row.n]));
function span(days) {
  days = [7, 30, 90].includes(days) ? days : 30;
  const end = localToday(), start = shift(end, -(days - 1));
  return { days, start, end, pstart: shift(start, -days), pend: shift(start, -1) };
}

async function totals(c, a, b) {
  const [[v], [p], [g], [m], [s], actions] = await c.reads([
    ["SELECT COUNT(*) AS n FROM pl_visitors WHERE scope='' AND day BETWEEN ? AND ?", [a, b]],
    ["SELECT SUM(n) AS n FROM pl_stats WHERE metric='view' AND parish_id='' AND day BETWEEN ? AND ?", [a, b]],
    ['SELECT COUNT(*) AS n FROM pl_guest_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', [a, b]],
    ['SELECT COUNT(*) AS n FROM member_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', [a, b]],
    ['SELECT COUNT(*) AS n FROM pl_accounts WHERE substr(created_at,1,10) BETWEEN ? AND ?', [a, b]],
    ["SELECT key AS k,SUM(n) AS n FROM pl_stats WHERE metric='action' AND day BETWEEN ? AND ? GROUP BY key", [a, b]]
  ]);
  const act = keyed(actions), sum = keys => keys.reduce((t, k) => t + (act.get(k) || 0), 0);
  return { visits: v.n || 0, views: p.n || 0, requests: (g.n || 0) + (m.n || 0), signups: s.n || 0, saves: sum(SAVES), shares: sum(SHARES), contacts: sum(['directions', 'call']) };
}

function completeness(state, upcoming) {
  const parish = state.PARISH || {}, content = publishedContent(state), photos = state.PHOTOS || {};
  const text = key => Object.values(content[key] || {}).some(v => String(v).trim());
  return { story: text('history') || text('welcome'), massTimes: text('massTimes'), contact: !!(parish.phone || parish.email),
    photo: !!(photos.parish || (parish.gallery || []).length), map: !!(parish.latitude && parish.longitude),
    hours: !!String(parish.officeHours || '').trim(), events: upcoming > 0,
    visit: ['expect', 'languages', 'parking', 'accessibility'].some(k => String(parish[k] || '').trim()) };
}
function health(checks, idle, upcoming, posts, answered, total) {
  const values = Object.values(checks), profile = values.filter(Boolean).length / values.length;
  const activity = idle === null ? 0 : Math.max(0, Math.min(1, (60 - Math.max(idle, 7)) / 53));
  const content = (upcoming ? .6 : 0) + (posts ? .4 : 0), responsive = total ? answered / total : 1;
  return Math.round(100 * (.3 * profile + .25 * activity + .2 * content + .25 * responsive));
}
const median = list => { if (!list.length) return null; const s = [...list].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export async function insights(c, days, defaultPlan) {
  const r = span(days), S = r.start, E = r.end, both = [S, E];
  const dates = Array.from({ length: r.days }, (_, i) => shift(S, i));
  const [views, visits, sent, pageVisits, pageViews, guests, memberKinds, [signups], [ministry], sources, devices, languages, actions, searches, funnel] = await c.reads([
    ["SELECT day AS k,SUM(n) AS n FROM pl_stats WHERE metric='view' AND parish_id='' AND day BETWEEN ? AND ? GROUP BY day", both],
    ["SELECT day AS k,COUNT(*) AS n FROM pl_visitors WHERE scope='' AND day BETWEEN ? AND ? GROUP BY day", both],
    ['SELECT d AS k,COUNT(*) AS n FROM (SELECT substr(created_at,1,10) AS d FROM pl_guest_requests UNION ALL SELECT substr(created_at,1,10) FROM member_requests) WHERE d BETWEEN ? AND ? GROUP BY d', both],
    ["SELECT substr(scope,3) AS k,COUNT(*) AS n FROM pl_visitors WHERE scope LIKE 'k:%' AND day BETWEEN ? AND ? GROUP BY scope", both],
    ["SELECT key AS k,SUM(n) AS n FROM pl_stats WHERE metric='view' AND parish_id='' AND day BETWEEN ? AND ? GROUP BY key ORDER BY n DESC", both],
    ['SELECT details FROM pl_guest_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', both],
    ['SELECT kind AS k,COUNT(*) AS n FROM member_requests WHERE substr(created_at,1,10) BETWEEN ? AND ? GROUP BY kind', both],
    ['SELECT COUNT(*) AS n FROM pl_accounts WHERE substr(created_at,1,10) BETWEEN ? AND ?', both],
    ['SELECT COUNT(*) AS n FROM pl_ministry_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', both],
    ["SELECT source AS k,COUNT(*) AS n FROM pl_visitors WHERE scope='' AND day BETWEEN ? AND ? GROUP BY source ORDER BY n DESC", both],
    ["SELECT device AS k,COUNT(*) AS n FROM pl_visitors WHERE scope='' AND day BETWEEN ? AND ? GROUP BY device ORDER BY n DESC", both],
    ["SELECT lang AS k,COUNT(*) AS n FROM pl_visitors WHERE scope='' AND day BETWEEN ? AND ? GROUP BY lang ORDER BY n DESC", both],
    ["SELECT key AS k,SUM(n) AS n FROM pl_stats WHERE metric='action' AND day BETWEEN ? AND ? GROUP BY key ORDER BY n DESC", both],
    ["SELECT key AS k,SUM(n) AS n FROM pl_stats WHERE metric='search' AND day BETWEEN ? AND ? GROUP BY key ORDER BY n DESC LIMIT 12", both],
    ["SELECT scope AS k,COUNT(*) AS n FROM pl_visitors WHERE scope IN ('','k:parish','k:request','a:request-sent') AND day BETWEEN ? AND ? GROUP BY scope", both]
  ]);
  const v = keyed(views), u = keyed(visits), q = keyed(sent), pv = keyed(pageVisits), fun = keyed(funnel);
  const forms = new Map();
  const form = k => { if (!forms.has(k)) forms.set(k, { key: k, guest: 0, member: 0 }); return forms.get(k); };
  for (const row of guests) form(String(JSON.parse(row.details).kind || 'custom')).guest += 1;
  for (const row of memberKinds) form(row.k).member += row.n;
  const formRows = [...forms.values()].map(f => ({ ...f, n: f.guest + f.member }))
    .concat([{ key: 'signup', guest: signups.n, member: 0, n: signups.n }, { key: 'ministry-join', guest: 0, member: ministry.n, n: ministry.n }]);
  const list = rows => rows.map(row => ({ key: row.k, n: row.n }));
  return {
    range: { from: S, to: E, days: r.days },
    totals: await totals(c, S, E), previous: await totals(c, r.pstart, r.pend),
    daily: dates.map(d => ({ d, views: v.get(d) || 0, visits: u.get(d) || 0, requests: q.get(d) || 0 })),
    pages: pageViews.map(row => ({ key: row.k, n: row.n, visits: pv.get(row.k) || 0 })),
    forms: formRows.filter(f => f.n).sort((a, b) => b.n - a.n),
    sources: list(sources), devices: list(devices), languages: list(languages), actions: list(actions), searches: list(searches),
    funnel: [['visit', ''], ['parish', 'k:parish'], ['request', 'k:request'], ['sent', 'a:request-sent']].map(([key, scope]) => ({ key, n: fun.get(scope) || 0 })),
    parishes: await parishRows(c, S, E, defaultPlan)
  };
}

/* Each parish as the CRM sees it: reach, requests and how fast they are answered, what it has
   published, its people, when its office last did something, and a health score. */
export async function parishRows(c, S, E, defaultPlan) {
  const now = Date.now(), today = localToday(), soon = shift(today, 30), month = new Date(now - 30 * 86400000).toISOString();
  const [views, visits, stateRows, planRows, crmRows, notes, members, staff, posts, audits, histories, requestRows, memberRequests, parishes] = await c.reads([
    ["SELECT parish_id AS k,SUM(n) AS n FROM pl_stats WHERE metric='view' AND parish_id<>'' AND day BETWEEN ? AND ? GROUP BY parish_id", [S, E]],
    ["SELECT substr(scope,3) AS k,COUNT(*) AS n FROM pl_visitors WHERE scope LIKE 'p:%' AND day BETWEEN ? AND ? GROUP BY scope", [S, E]],
    ['SELECT parish_id,data FROM states', []],
    ['SELECT parish_id,data FROM pl_plans', []],
    ['SELECT * FROM pl_crm', []],
    ['SELECT parish_id AS k,COUNT(*) AS n FROM pl_crm_notes GROUP BY parish_id', []],
    ['SELECT parish_id AS k,COUNT(*) AS n FROM pl_affiliations WHERE following=1 GROUP BY parish_id', []],
    ["SELECT parish_id AS k,COUNT(DISTINCT user_id) AS n FROM (SELECT parish_id,user_id FROM assignments UNION SELECT scope_id,user_id FROM pl_grants WHERE scope_type='parish' AND active=1) GROUP BY parish_id", []],
    ["SELECT parish_id AS k,COUNT(*) AS n FROM member_content WHERE kind IN ('post','announcement') AND created_at>? GROUP BY parish_id", [month]],
    ['SELECT parish_id AS k,MAX(at) AS n FROM audit GROUP BY parish_id', []],
    ['SELECT scope_id AS k,MAX(created_at) AS n FROM pl_history GROUP BY scope_id', []],
    ['SELECT parish_id,status,created_at,updated_at FROM pl_guest_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', [S, E]],
    ['SELECT parish_id AS k,COUNT(*) AS n FROM member_requests WHERE substr(created_at,1,10) BETWEEN ? AND ? GROUP BY parish_id', [S, E]],
    ['SELECT p.id,p.metadata,d.name AS diocese FROM parishes p JOIN dioceses d ON d.id=p.diocese', []]
  ]);
  const V = keyed(views), U = keyed(visits), N = keyed(notes), M = keyed(members), T = keyed(staff), P = keyed(posts), MR = keyed(memberRequests);
  const states = new Map(stateRows.map(row => [row.parish_id, JSON.parse(row.data)])), plans = new Map(planRows.map(row => [row.parish_id, JSON.parse(row.data)]));
  const crm = new Map(crmRows.map(row => [row.parish_id, row])), last = new Map(), requests = new Map();
  for (const row of [...audits, ...histories]) { const t = when(row.n); if (row.k && t !== null && (!last.has(row.k) || t > last.get(row.k))) last.set(row.k, t); }
  for (const row of requestRows) { if (!requests.has(row.parish_id)) requests.set(row.parish_id, []); requests.get(row.parish_id).push(row); }
  const rows = parishes.map(p => {
    const meta = JSON.parse(p.metadata), state = states.get(p.id) || {};
    const upcoming = publicEvents(state).filter(e => typeof e.d === 'string' && today <= e.d && e.d <= soon).length;
    const checks = completeness(state, upcoming), own = requests.get(p.id) || [];
    const hours = [];
    let answered = 0, overdue = 0;
    for (const r of own) {
      const created = when(r.created_at), updated = when(r.updated_at);
      if (r.status !== 'submitted' && created !== null && updated !== null) { hours.push((updated - created) / 3600000); answered += updated - created <= 72 * 3600000 ? 1 : 0; }
      else if (created !== null && now - created > 72 * 3600000) overdue += 1;
    }
    const idle = last.has(p.id) ? Math.floor((now - last.get(p.id)) / 86400000) : null, record = crm.get(p.id) || {}, middle = median(hours);
    return { id: p.id, name: meta.name ?? '', ar: meta.ar ?? '', town: meta.town ?? '', townAr: meta.townAr ?? '', diocese: p.diocese,
      bundle: (plans.get(p.id) || defaultPlan).bundle ?? '', stage: record.stage || 'active', nextFollowup: record.next_followup || '', owner: record.owner_id || '', notes: N.get(p.id) || 0,
      views: V.get(p.id) || 0, visits: U.get(p.id) || 0, requests: own.length + (MR.get(p.id) || 0),
      open: own.filter(r => r.status === 'submitted').length, overdue, responseHours: middle === null ? null : Math.round(middle * 10) / 10,
      upcoming, posts: P.get(p.id) || 0, members: M.get(p.id) || 0, staff: T.get(p.id) || 0,
      lastActivity: last.has(p.id) ? new Date(last.get(p.id)).toISOString() : '', checks, health: health(checks, idle, upcoming, P.get(p.id) || 0, answered, own.length) };
  });
  return rows.sort((a, b) => b.views - a.views || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export async function parishDetail(c, pid, days) {
  const r = span(days), S = r.start, E = r.end, args = [pid, S, E];
  const dates = Array.from({ length: r.days }, (_, i) => shift(S, i));
  const [views, visits, pages, actions, guests, memberKinds, staff, notes] = await c.reads([
    ["SELECT day AS k,SUM(n) AS n FROM pl_stats WHERE metric='view' AND parish_id=? AND day BETWEEN ? AND ? GROUP BY day", args],
    ['SELECT day AS k,COUNT(*) AS n FROM pl_visitors WHERE scope=? AND day BETWEEN ? AND ? GROUP BY day', ['p:' + pid, S, E]],
    ["SELECT key AS k,SUM(n) AS n FROM pl_stats WHERE metric='view' AND parish_id=? AND day BETWEEN ? AND ? GROUP BY key ORDER BY n DESC", args],
    ["SELECT key AS k,SUM(n) AS n FROM pl_stats WHERE metric='action' AND parish_id=? AND day BETWEEN ? AND ? GROUP BY key ORDER BY n DESC", args],
    ['SELECT details FROM pl_guest_requests WHERE parish_id=? AND substr(created_at,1,10) BETWEEN ? AND ?', args],
    ['SELECT kind AS k,COUNT(*) AS n FROM member_requests WHERE parish_id=? AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY kind', args],
    ["SELECT DISTINCT u.name,COALESCE(g.role,u.role) AS role FROM users u LEFT JOIN pl_grants g ON g.user_id=u.id AND g.scope_type='parish' AND g.scope_id=? AND g.active=1 LEFT JOIN assignments a ON a.user_id=u.id AND a.parish_id=? WHERE g.user_id IS NOT NULL OR a.user_id IS NOT NULL ORDER BY u.name", [pid, pid]],
    ['SELECT n.id,n.kind,n.body,n.created_at,u.name AS author FROM pl_crm_notes n JOIN users u ON u.id=n.author_id WHERE n.parish_id=? ORDER BY n.created_at DESC LIMIT 100', [pid]]
  ]);
  const v = keyed(views), u = keyed(visits), kinds = new Map();
  for (const row of guests) { const k = String(JSON.parse(row.details).kind || 'custom'); kinds.set(k, (kinds.get(k) || 0) + 1); }
  for (const row of memberKinds) kinds.set(row.k, (kinds.get(row.k) || 0) + row.n);
  const list = rows => rows.map(row => ({ key: row.k, n: row.n }));
  return { daily: dates.map(d => ({ d, views: v.get(d) || 0, visits: u.get(d) || 0 })), pages: list(pages), actions: list(actions),
    requests: [...kinds].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n), staff, notes };
}

export async function analyticsHandle(c, u, path, method, q) {
  if (!path.startsWith('/api/workspace/insights') && !path.startsWith('/api/workspace/crm')) return null;
  need(await isSuperAdmin(c, u), 'Insights are for the Super Admin.', 403);
  const days = /^\d+$/.test(String(q.days ?? '30')) ? Number(q.days ?? 30) : 30;
  if (path === '/api/workspace/insights' && method === 'GET') return insights(c, days, await parishPlan(c, ''));
  const pid = String(q.parish || '');
  need(await c.first('SELECT 1 FROM parishes WHERE id=?', pid), 'Parish not found.', 404);
  if (path === '/api/workspace/insights/parish' && method === 'GET') return parishDetail(c, pid, days);
  if (path === '/api/workspace/crm' && method === 'POST') {
    const stage = String(q.stage || 'active'), follow = String(q.nextFollowup || '');
    need(STAGES.includes(stage), 'Choose a stage.');
    if (follow) need(/^\d{4}-\d{2}-\d{2}$/.test(follow) && new Date(follow + 'T00:00:00Z').toISOString().slice(0, 10) === follow, 'Choose a follow-up date.');
    c.run('INSERT INTO pl_crm VALUES(?,?,?,?,?) ON CONFLICT(parish_id) DO UPDATE SET stage=excluded.stage,owner_id=excluded.owner_id,next_followup=excluded.next_followup,updated_at=excluded.updated_at',
      pid, stage, q.owner === 'me' ? u.id : null, follow || null, NOW());
    history(c, u, pid, 'crm.updated', { stage, nextFollowup: follow });
    return { ok: true };
  }
  if (path === '/api/workspace/crm/notes' && method === 'POST') {
    const kind = String(q.kind || 'note'), body = String(q.body || '').trim();
    need(NOTE_KINDS.includes(kind), 'Choose what kind of note this is.');
    need(body.length >= 1 && body.length <= 2000, 'Write a note of up to 2,000 characters.');
    c.run('INSERT INTO pl_crm_notes VALUES(?,?,?,?,?,?)', tokenHex(12), pid, u.id, kind, body, NOW());
    return { ok: true };
  }
  return null;
}
