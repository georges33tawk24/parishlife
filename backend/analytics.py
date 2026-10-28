"""How the public site is used, for the Super Admin's Insights and CRM; the same as
cloudflare/src/analytics.js. Visits are counted without cookies and without keeping anyone's
address: each day a fresh random salt turns a visitor's address and browser into a hash that
cannot be followed from one day to the next, the salt is forgotten the next day, and the
hashes themselves are deleted after 95 days. A "visit" is one visitor on one day."""
import datetime as dt
import hashlib
import json
import re
import secrets
from statistics import median
from urllib.parse import urlsplit

from . import workspace as w
from .public_site import published_content, public_events

PAGES = {'home', 'parish', 'event', 'calendar', 'request', 'bundles', 'track', 'verify', 'error'}
ACTIONS = {'ics', 'ics-all', 'subscribe', 'google', 'share-whatsapp', 'share-copy', 'share-native', 'directions', 'call',
           'livestream', 'whatsapp-follow', 'search', 'request-sent', 'near-me'}
BOTS = re.compile(r'bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|curl|wget|python|httpclient|monitor|scan', re.I)
UPSERT = 'INSERT INTO pl_stats VALUES(?,?,?,?,1) ON CONFLICT(day,metric,key,parish_id) DO UPDATE SET n=n+1'
KEEP_DAYS = 95
STAGES = ('onboarding', 'active', 'attention', 'paused')
NOTE_KINDS = ('note', 'call', 'meeting', 'email', 'visit')
SAVES = ('ics', 'ics-all', 'subscribe', 'google')
SHARES = ('share-whatsapp', 'share-copy', 'share-native')


def today():
    return dt.date.today()


def stat(c, metric, key, parish=''):
    c.execute(UPSERT, (today().isoformat(), metric, key, parish))


def source(referrer, host):
    """Where a visit came from, by the referring site's name only."""
    name = (urlsplit(str(referrer or '')).hostname or '').lower()
    if not name:
        return 'direct'
    if name == (host or '').split(':')[0].lower():
        return 'internal'
    within = lambda *sites: any(name == s or name.endswith('.' + s) for s in sites)
    if 'whatsapp' in name or within('wa.me', 'l.wl.co'):
        return 'whatsapp'
    if within('facebook.com', 'fb.com', 'instagram.com', 't.co', 'twitter.com', 'x.com', 'tiktok.com', 'linkedin.com', 'youtube.com'):
        return 'social'
    if re.search(r'(^|\.)google\.', name):
        return 'google'
    if within('bing.com', 'duckduckgo.com', 'yahoo.com', 'yandex.ru', 'yandex.com', 'ecosia.org', 'baidu.com'):
        return 'search'
    return 'other'


def device(agent):
    a = agent.lower()
    if 'ipad' in a or 'tablet' in a or ('android' in a and 'mobile' not in a):
        return 'tablet'
    return 'phone' if 'mobi' in a or 'iphone' in a or 'android' in a else 'desktop'


def record(c, q, address, agent, host):
    """One page view or action, sent by a visitor's browser (assets/beacon.js)."""
    if not agent or BOTS.search(agent) or not isinstance(q, dict):
        return
    kind, page, action = q.get('t'), str(q.get('p') or ''), str(q.get('a') or '')
    if not (kind == 'view' and page in PAGES or kind == 'action' and action in ACTIONS):
        return
    day = today().isoformat()
    parish = str(q.get('parish') or '')[:80]
    if parish and not c.execute('SELECT 1 FROM parishes WHERE id=?', (parish,)).fetchone():
        parish = ''
    if c.execute('INSERT OR IGNORE INTO pl_stats_salt VALUES(?,?)', (day, secrets.token_hex(16))).rowcount:
        # A new day: the old salt is forgotten, so yesterday's hashes can never be matched again.
        c.execute('DELETE FROM pl_stats_salt WHERE day<>?', (day,))
        c.execute('DELETE FROM pl_visitors WHERE day<?', ((today() - dt.timedelta(days=KEEP_DAYS)).isoformat(),))
    salt = c.execute('SELECT salt FROM pl_stats_salt WHERE day=?', (day,)).fetchone()[0]
    visitor = hashlib.sha256(f'{salt}|{address}|{agent}'.encode()).hexdigest()[:32]
    seen = lambda scope, extra=('', '', ''): c.execute('INSERT OR IGNORE INTO pl_visitors VALUES(?,?,?,?,?,?)', (day, visitor, scope, *extra))
    if kind == 'view':
        origin = source(q.get('r'), host)
        seen('', (device(agent), 'ar' if q.get('lang') == 'ar' else 'en', 'direct' if origin == 'internal' else origin))
        seen('k:' + page)
        stat(c, 'view', page)
        if parish:
            stat(c, 'view', page, parish)
            seen('p:' + parish)
    else:
        seen('a:' + action)
        stat(c, 'action', action, parish)
        term = ' '.join(str(q.get('q') or '').lower().split())[:60]
        if action == 'search' and len(term) >= 2:
            stat(c, 'search', term)


# ---------- Insights ----------
def _when(value):
    try:
        moment = dt.datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return moment if moment.tzinfo else moment.replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def _span(days):
    days = days if days in (7, 30, 90) else 30
    end = today()
    start = end - dt.timedelta(days=days - 1)
    return days, start, end, start - dt.timedelta(days=days), start - dt.timedelta(days=1)


def _keyed(rows):
    return {row[0]: row[1] for row in rows}


def _totals(c, a, b):
    a, b = a.isoformat(), b.isoformat()
    one = lambda sql, *args: (c.execute(sql, args).fetchone()[0] or 0)
    actions = _keyed(c.execute("SELECT key,SUM(n) FROM pl_stats WHERE metric='action' AND day BETWEEN ? AND ? GROUP BY key", (a, b)))
    return {'visits': one("SELECT COUNT(*) FROM pl_visitors WHERE scope='' AND day BETWEEN ? AND ?", a, b),
            'views': one("SELECT SUM(n) FROM pl_stats WHERE metric='view' AND parish_id='' AND day BETWEEN ? AND ?", a, b),
            'requests': one('SELECT COUNT(*) FROM pl_guest_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', a, b)
                        + one('SELECT COUNT(*) FROM member_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', a, b),
            'signups': one('SELECT COUNT(*) FROM pl_accounts WHERE substr(created_at,1,10) BETWEEN ? AND ?', a, b),
            'saves': sum(actions.get(k, 0) for k in SAVES), 'shares': sum(actions.get(k, 0) for k in SHARES),
            'contacts': actions.get('directions', 0) + actions.get('call', 0)}


def _completeness(state, upcoming):
    parish, content, photos = state.get('PARISH', {}), published_content(state), state.get('PHOTOS', {})
    text = lambda key: any(str(v).strip() for v in content.get(key, {}).values())
    checks = {'story': text('history') or text('welcome'), 'massTimes': text('massTimes'), 'contact': bool(parish.get('phone') or parish.get('email')),
              'photo': bool(photos.get('parish') or parish.get('gallery')), 'map': bool(parish.get('latitude') and parish.get('longitude')),
              'hours': bool(str(parish.get('officeHours') or '').strip()), 'events': upcoming > 0,
              'visit': any(str(parish.get(k) or '').strip() for k in ('expect', 'languages', 'parking', 'accessibility'))}
    return checks


def _health(checks, idle_days, upcoming, posts, answered, total):
    profile = sum(checks.values()) / len(checks)
    activity = 0 if idle_days is None else max(0, min(1, (60 - max(idle_days, 7)) / 53))
    content = (.6 if upcoming else 0) + (.4 if posts else 0)
    responsive = answered / total if total else 1
    return round(100 * (.3 * profile + .25 * activity + .2 * content + .25 * responsive))


def insights(c, days, default_plan):
    days, start, end, pstart, pend = _span(days)
    S, E = start.isoformat(), end.isoformat()
    span = [(start + dt.timedelta(days=i)).isoformat() for i in range(days)]
    views = _keyed(c.execute("SELECT day,SUM(n) FROM pl_stats WHERE metric='view' AND parish_id='' AND day BETWEEN ? AND ? GROUP BY day", (S, E)))
    visits = _keyed(c.execute("SELECT day,COUNT(*) FROM pl_visitors WHERE scope='' AND day BETWEEN ? AND ? GROUP BY day", (S, E)))
    sent = _keyed(c.execute('SELECT d,COUNT(*) FROM (SELECT substr(created_at,1,10) AS d FROM pl_guest_requests UNION ALL SELECT substr(created_at,1,10) FROM member_requests) WHERE d BETWEEN ? AND ? GROUP BY d', (S, E)))
    group = lambda sql: [{'key': row[0], 'n': row[1]} for row in c.execute(sql, (S, E))]
    page_visits = _keyed(c.execute("SELECT substr(scope,3),COUNT(*) FROM pl_visitors WHERE scope LIKE 'k:%' AND day BETWEEN ? AND ? GROUP BY scope", (S, E)))
    pages = [{'key': row[0], 'n': row[1], 'visits': page_visits.get(row[0], 0)} for row in
             c.execute("SELECT key,SUM(n) AS n FROM pl_stats WHERE metric='view' AND parish_id='' AND day BETWEEN ? AND ? GROUP BY key ORDER BY n DESC", (S, E))]
    forms = {}
    for row in c.execute('SELECT details FROM pl_guest_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', (S, E)):
        kind = str(json.loads(row[0]).get('kind') or 'custom')
        forms.setdefault(kind, {'key': kind, 'guest': 0, 'member': 0})['guest'] += 1
    for row in c.execute('SELECT kind,COUNT(*) FROM member_requests WHERE substr(created_at,1,10) BETWEEN ? AND ? GROUP BY kind', (S, E)):
        forms.setdefault(row[0], {'key': row[0], 'guest': 0, 'member': 0})['member'] += row[1]
    signups = c.execute('SELECT COUNT(*) FROM pl_accounts WHERE substr(created_at,1,10) BETWEEN ? AND ?', (S, E)).fetchone()[0]
    ministry = c.execute('SELECT COUNT(*) FROM pl_ministry_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', (S, E)).fetchone()[0]
    form_rows = [{**f, 'n': f['guest'] + f['member']} for f in forms.values()]
    form_rows += [{'key': 'signup', 'guest': signups, 'member': 0, 'n': signups}, {'key': 'ministry-join', 'guest': 0, 'member': ministry, 'n': ministry}]
    funnel_counts = _keyed(c.execute("SELECT scope,COUNT(*) FROM pl_visitors WHERE scope IN ('','k:parish','k:request','a:request-sent') AND day BETWEEN ? AND ? GROUP BY scope", (S, E)))
    return {
        'range': {'from': S, 'to': E, 'days': days},
        'totals': _totals(c, start, end), 'previous': _totals(c, pstart, pend),
        'daily': [{'d': d, 'views': views.get(d, 0), 'visits': visits.get(d, 0), 'requests': sent.get(d, 0)} for d in span],
        'pages': pages,
        'forms': sorted([f for f in form_rows if f['n']], key=lambda f: -f['n']),
        'sources': group("SELECT source,COUNT(*) AS n FROM pl_visitors WHERE scope='' AND day BETWEEN ? AND ? GROUP BY source ORDER BY n DESC"),
        'devices': group("SELECT device,COUNT(*) AS n FROM pl_visitors WHERE scope='' AND day BETWEEN ? AND ? GROUP BY device ORDER BY n DESC"),
        'languages': group("SELECT lang,COUNT(*) AS n FROM pl_visitors WHERE scope='' AND day BETWEEN ? AND ? GROUP BY lang ORDER BY n DESC"),
        'actions': group("SELECT key,SUM(n) AS n FROM pl_stats WHERE metric='action' AND day BETWEEN ? AND ? GROUP BY key ORDER BY n DESC"),
        'searches': group("SELECT key,SUM(n) AS n FROM pl_stats WHERE metric='search' AND day BETWEEN ? AND ? GROUP BY key ORDER BY n DESC LIMIT 12"),
        'funnel': [{'key': k, 'n': funnel_counts.get(scope, 0)} for k, scope in (('visit', ''), ('parish', 'k:parish'), ('request', 'k:request'), ('sent', 'a:request-sent'))],
        'parishes': parish_rows(c, start, end, default_plan)}


def parish_rows(c, start, end, default_plan):
    """Each parish as the CRM sees it: reach, requests and how fast they are answered, what it has
    published, its people, when its office last did something, and a health score."""
    S, E, now = start.isoformat(), end.isoformat(), dt.datetime.now(dt.timezone.utc)
    soon = (today() + dt.timedelta(days=30)).isoformat()
    month = (now - dt.timedelta(days=30)).isoformat()
    views = _keyed(c.execute("SELECT parish_id,SUM(n) FROM pl_stats WHERE metric='view' AND parish_id<>'' AND day BETWEEN ? AND ? GROUP BY parish_id", (S, E)))
    visits = _keyed(c.execute("SELECT substr(scope,3),COUNT(*) FROM pl_visitors WHERE scope LIKE 'p:%' AND day BETWEEN ? AND ? GROUP BY scope", (S, E)))
    states = {row[0]: json.loads(row[1]) for row in c.execute('SELECT parish_id,data FROM states')}
    plans = {row[0]: json.loads(row[1]) for row in c.execute('SELECT parish_id,data FROM pl_plans')}
    crm = {row['parish_id']: dict(row) for row in c.execute('SELECT * FROM pl_crm')}
    notes = _keyed(c.execute('SELECT parish_id,COUNT(*) FROM pl_crm_notes GROUP BY parish_id'))
    members = _keyed(c.execute('SELECT parish_id,COUNT(*) FROM pl_affiliations WHERE following=1 GROUP BY parish_id'))
    staff = _keyed(c.execute("SELECT parish_id,COUNT(DISTINCT user_id) FROM (SELECT parish_id,user_id FROM assignments UNION SELECT scope_id,user_id FROM pl_grants WHERE scope_type='parish' AND active=1) GROUP BY parish_id"))
    posts = _keyed(c.execute("SELECT parish_id,COUNT(*) FROM member_content WHERE kind IN ('post','announcement') AND created_at>? GROUP BY parish_id", (month,)))
    last = {}
    for sql in ('SELECT parish_id,MAX(at) FROM audit GROUP BY parish_id', 'SELECT scope_id,MAX(created_at) FROM pl_history GROUP BY scope_id'):
        for pid, at in c.execute(sql):
            moment = _when(at)
            if pid and moment and (pid not in last or moment > last[pid]):
                last[pid] = moment
    requests = {}
    for row in c.execute('SELECT parish_id,status,created_at,updated_at FROM pl_guest_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', (S, E)):
        requests.setdefault(row[0], []).append(row)
    member_requests = _keyed(c.execute('SELECT parish_id,COUNT(*) FROM member_requests WHERE substr(created_at,1,10) BETWEEN ? AND ? GROUP BY parish_id', (S, E)))
    rows = []
    for p in c.execute('SELECT p.id,p.metadata,d.name AS diocese FROM parishes p JOIN dioceses d ON d.id=p.diocese'):
        meta, state = json.loads(p['metadata']), states.get(p['id'], {})
        upcoming = sum(1 for e in public_events(state) if isinstance(e['d'], str) and today().isoformat() <= e['d'] <= soon)
        checks = _completeness(state, upcoming)
        hours, answered, overdue = [], 0, 0
        for r in requests.get(p['id'], []):
            created, updated = _when(r['created_at']), _when(r['updated_at'])
            if r['status'] != 'submitted' and created and updated:
                hours.append((updated - created).total_seconds() / 3600)
                answered += (updated - created) <= dt.timedelta(hours=72)
            elif created and now - created > dt.timedelta(hours=72):
                overdue += 1
        total = len(requests.get(p['id'], []))
        idle = (now - last[p['id']]).days if p['id'] in last else None
        record = crm.get(p['id'], {})
        rows.append({'id': p['id'], 'name': meta.get('name', ''), 'ar': meta.get('ar', ''), 'town': meta.get('town', ''), 'townAr': meta.get('townAr', ''),
                     'diocese': p['diocese'], 'bundle': plans.get(p['id'], default_plan).get('bundle', ''),
                     'stage': record.get('stage') or 'active', 'nextFollowup': record.get('next_followup') or '', 'owner': record.get('owner_id') or '', 'notes': notes.get(p['id'], 0),
                     'views': views.get(p['id'], 0), 'visits': visits.get(p['id'], 0), 'requests': total + member_requests.get(p['id'], 0),
                     'open': sum(1 for r in requests.get(p['id'], []) if r['status'] == 'submitted'), 'overdue': overdue,
                     'responseHours': round(median(hours), 1) if hours else None, 'upcoming': upcoming, 'posts': posts.get(p['id'], 0),
                     'members': members.get(p['id'], 0), 'staff': staff.get(p['id'], 0),
                     'lastActivity': last[p['id']].isoformat() if p['id'] in last else '',
                     'checks': checks, 'health': _health(checks, idle, upcoming, posts.get(p['id'], 0), answered, total)})
    return sorted(rows, key=lambda r: (-r['views'], r['name']))


def parish_detail(c, pid, days):
    days, start, end, _, _ = _span(days)
    S, E = start.isoformat(), end.isoformat()
    span = [(start + dt.timedelta(days=i)).isoformat() for i in range(days)]
    views = _keyed(c.execute("SELECT day,SUM(n) FROM pl_stats WHERE metric='view' AND parish_id=? AND day BETWEEN ? AND ? GROUP BY day", (pid, S, E)))
    visits = _keyed(c.execute('SELECT day,COUNT(*) FROM pl_visitors WHERE scope=? AND day BETWEEN ? AND ? GROUP BY day', ('p:' + pid, S, E)))
    group = lambda sql: [{'key': row[0], 'n': row[1]} for row in c.execute(sql, (pid, S, E))]
    kinds = {}
    for row in c.execute('SELECT details FROM pl_guest_requests WHERE parish_id=? AND substr(created_at,1,10) BETWEEN ? AND ?', (pid, S, E)):
        kind = str(json.loads(row[0]).get('kind') or 'custom')
        kinds[kind] = kinds.get(kind, 0) + 1
    for row in c.execute('SELECT kind,COUNT(*) FROM member_requests WHERE parish_id=? AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY kind', (pid, S, E)):
        kinds[row[0]] = kinds.get(row[0], 0) + row[1]
    staff = [dict(name=row['name'], role=row['role']) for row in c.execute(
        "SELECT DISTINCT u.name,COALESCE(g.role,u.role) AS role FROM users u LEFT JOIN pl_grants g ON g.user_id=u.id AND g.scope_type='parish' AND g.scope_id=? AND g.active=1 "
        "LEFT JOIN assignments a ON a.user_id=u.id AND a.parish_id=? WHERE g.user_id IS NOT NULL OR a.user_id IS NOT NULL ORDER BY u.name", (pid, pid))]
    return {'daily': [{'d': d, 'views': views.get(d, 0), 'visits': visits.get(d, 0)} for d in span],
            'pages': group("SELECT key,SUM(n) AS n FROM pl_stats WHERE metric='view' AND parish_id=? AND day BETWEEN ? AND ? GROUP BY key ORDER BY n DESC"),
            'actions': group("SELECT key,SUM(n) AS n FROM pl_stats WHERE metric='action' AND parish_id=? AND day BETWEEN ? AND ? GROUP BY key ORDER BY n DESC"),
            'requests': sorted([{'key': k, 'n': n} for k, n in kinds.items()], key=lambda r: -r['n']),
            'staff': staff,
            'notes': [dict(row) for row in c.execute('SELECT n.id,n.kind,n.body,n.created_at,u.name AS author FROM pl_crm_notes n JOIN users u ON u.id=n.author_id WHERE n.parish_id=? ORDER BY n.created_at DESC LIMIT 100', (pid,))]}


def handle(c, user, path, method, q, require):
    if not (path.startswith('/api/workspace/insights') or path.startswith('/api/workspace/crm')):
        return None
    require(w.is_super_admin(c, user), 'Insights are for the Super Admin.', 403)
    days = int(q.get('days') or 30) if str(q.get('days') or '30').isdigit() else 30
    if path == '/api/workspace/insights' and method == 'GET':
        return insights(c, days, w.parish_plan(c, ''))
    pid = str(q.get('parish') or '')
    require(c.execute('SELECT 1 FROM parishes WHERE id=?', (pid,)).fetchone(), 'Parish not found.', 404)
    if path == '/api/workspace/insights/parish' and method == 'GET':
        return parish_detail(c, pid, days)
    if path == '/api/workspace/crm' and method == 'POST':
        stage, follow = str(q.get('stage') or 'active'), str(q.get('nextFollowup') or '')
        require(stage in STAGES, 'Choose a stage.')
        if follow:
            try:
                dt.date.fromisoformat(follow)
            except ValueError:
                require(False, 'Choose a follow-up date.')
        owner = user['id'] if q.get('owner') == 'me' else None
        c.execute('INSERT INTO pl_crm VALUES(?,?,?,?,?) ON CONFLICT(parish_id) DO UPDATE SET stage=excluded.stage,owner_id=excluded.owner_id,next_followup=excluded.next_followup,updated_at=excluded.updated_at',
                  (pid, stage, owner, follow or None, w.now()))
        w.history(c, user, pid, 'crm.updated', {'stage': stage, 'nextFollowup': follow})
        return {'ok': True}
    if path == '/api/workspace/crm/notes' and method == 'POST':
        kind, body = str(q.get('kind') or 'note'), str(q.get('body') or '').strip()
        require(kind in NOTE_KINDS, 'Choose what kind of note this is.')
        require(1 <= len(body) <= 2000, 'Write a note of up to 2,000 characters.')
        c.execute('INSERT INTO pl_crm_notes VALUES(?,?,?,?,?,?)', (secrets.token_hex(12), pid, user['id'], kind, body, w.now()))
        return {'ok': True}
    return None
