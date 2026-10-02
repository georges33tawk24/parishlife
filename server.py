"""ParishLife's same-origin application server. Python 3.11+, standard library only.

Run: python server.py --create-user bishop --role bishop
Then: python server.py 4399
Passwords are prompted, never shipped in source. Database files are not web assets.
"""
import argparse
import copy
import datetime as dt
import getpass
import hashlib
import hmac
import http.cookies
import http.server
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DB = ROOT / 'var' / 'parishlife.sqlite3'
GEOGRAPHY = json.loads((ROOT / 'backend' / 'geography.json').read_text(encoding='utf-8'))['governorates']
ROLES = {'bishop', 'priest', 'secretary', 'treasurer', 'leader', 'volunteer'}
CLERGY = {'priest'}  # Bishops use the separate, read-only oversight API.
FINANCE = {'BATCH', 'FUNDS', 'EXPENSES', 'PLEDGES', 'CAMPAIGNS', 'RECURRING', 'RECEIPTS', 'BANKLINES', 'GIVING_SERIES', 'PAYMENT_MIX'}
OFFICE = {'PEOPLE', 'ARCHIVED', 'HOUSEHOLDS', 'FAMILIES', 'BRANCHES', 'PERSON_EXTRA', 'PHOTOS', 'GROUPS', 'GROUP_DETAIL', 'EVENTS', 'EVENT_DETAIL', 'EVENT_TEMPLATES', 'RESERVATIONS', 'VENUES', 'EQUIPMENT', 'MAINTENANCE', 'ISSUES', 'RENTALS', 'SERVICE', 'SERVICE_PLANS', 'SERVICE_TEMPLATES', 'SERVICE_REQUESTS', 'ROTA', 'VOLUNTEERS', 'SIGNUP_SHEETS', 'CHECKIN', 'PICKUP', 'INCIDENTS', 'EVACUATION', 'REGISTRATIONS', 'REG_FORM', 'REGISTRANTS', 'REFUNDS', 'MESSAGES', 'NOTICES', 'PRAYERS', 'PORTAL_REQUESTS', 'REQUEST_HISTORY', 'WORKFLOWS', 'RUNS', 'RUN_LOG', 'FORM_FIELDS', 'FORM_RULES', 'CONTENT', 'AUTOMATIONS', 'DUPLICATES', 'SACRAMENTS'}
READONLY = {'PARISHES', 'AUDIT', 'CORRECTIONS', 'ANNIVERSARIES', 'EPARCHY_NEWS', 'PERMISSIONS', 'EXCEPTIONS', 'TRANSFERS'}
PROTECTED = {'status', 'approvedBy', 'approvedAt', 'issuedBy', 'issuedAt', 'history', 'original', 'revision'}
NOW = lambda: dt.datetime.now(dt.timezone.utc).isoformat()
TODAY = lambda: dt.date.today().isoformat()


class Problem(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def require(ok, message, status=400):
    if not ok:
        raise Problem(status, message)


class Connection(sqlite3.Connection):
    def __exit__(self, exc_type, exc, trace):
        try:
            return super().__exit__(exc_type, exc, trace)
        finally:
            self.close()


def connect():
    c = sqlite3.connect(DB, factory=Connection)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c


def migrate_state(d):
    """Idempotent migration for parish records and working templates."""
    d.pop('TRANSFERS', None)
    chart_blues = ('#3D4161', '#8EC5F4', '#DCEEFF', '#9BC6EC')
    for index, item in enumerate(d.get('PAYMENT_MIX', [])):
        if isinstance(item, dict):
            item['color'] = chart_blues[index % len(chart_blues)]
    for key in ('FAMILIES', 'BRANCHES', 'REQUEST_HISTORY'):
        d.setdefault(key, [])
    d.setdefault('SERVICE_PLANS', [])
    seed_templates = None
    for key in ('EVENT_TEMPLATES', 'SERVICE_TEMPLATES'):
        d.setdefault(key, [])
        if not any(not isinstance(row, dict) for row in d[key]):
            continue
        if seed_templates is None:
            seed_templates = json.loads((ROOT / 'backend' / 'seed.json').read_text(encoding='utf-8'))
        converted = []
        for i, row in enumerate(d[key]):
            if isinstance(row, dict):
                converted.append(row)
                continue
            defaults = seed_templates.get(key, [])
            default = defaults[i] if i < len(defaults) and isinstance(defaults[i], dict) else None
            if default:
                item = copy.deepcopy(default)
                if key == 'EVENT_TEMPLATES':
                    item.update(name=row[0], nameAr=row[1])
                else:
                    item.update(name=row[0], ar=row[1])
            elif key == 'EVENT_TEMPLATES':
                item = dict(id=f'event-template-{i+1}', name=row[0], nameAr=row[1], icon=row[2],
                            kind='event', venue='v1', duration=60, description='', capacity=0)
            else:
                item = dict(id=f'service-template-{i+1}', name=row[0], ar=row[1], venue=d['SERVICE'].get('venue'),
                            language=d['SERVICE'].get('language', ''), languageAr=d['SERVICE'].get('languageAr', ''),
                            celebrant=d['SERVICE'].get('celebrant'), coordinator=d['SERVICE'].get('coordinator'),
                            order=copy.deepcopy(d['SERVICE'].get('order', [])) if 'Sunday' in row[0] else [])
            converted.append(item)
        d[key] = converted
    for gid, detail in d['GROUP_DETAIL'].items():
        for index, meeting in enumerate(detail.get('meetings', [])):
            meeting.setdefault('id', f'meeting-{gid}-{index+1}-{meeting.get("d", "date")}')
            meeting.setdefault('attendance', {entry[0]: 'excused' for entry in meeting.get('absent', []) if entry})
    hh = {h['id']: h for h in d['HOUSEHOLDS']}
    persons = {p['id']: p for p in d['PEOPLE'] + d['ARCHIVED']}
    families = {f['id']: f for f in d['FAMILIES']}
    branches = {b['id']: b for b in d['BRANCHES']}
    for h in hh.values():
        signature = (h.get('name', '') + '\0' + h.get('ar', '')).casefold()
        require(not h.get('family') or h['family'] in families, 'Choose an existing main family.')
        require(not h.get('branch') or h['branch'] in branches, 'Choose an existing family branch.')
        family_id = h.get('family') or 'fam-' + hashlib.sha256(signature.encode()).hexdigest()[:14]
        families.setdefault(family_id, dict(id=family_id, name=h.get('name', ''), ar=h.get('ar', ''), head=None))
        branch_id = h.get('branch') or 'branch-' + h['id'] + '-' + hashlib.sha256(family_id.encode()).hexdigest()[:8]
        branches.setdefault(branch_id, dict(id=branch_id, family=family_id, name=h.get('town', ''), ar=h.get('townAr', '')))
        require(branches[branch_id]['family'] == family_id, 'The selected branch belongs to another main family.')
        h.update(family=family_id, branch=branch_id)
    d['FAMILIES'], d['BRANCHES'] = list(families.values()), list(branches.values())
    for p in persons.values():
        if p.get('hh') not in hh:
            p['hh'] = None
    for h in hh.values():
        h['members'] = [p for p in h['members'] if p in persons]
        if h.get('head') not in h['members']:
            h['head'] = None
        for pid in h['members']:
            persons[pid]['hh'] = h['id']
    for n in d['NOTES']:
        n.setdefault('kind', 'note')
        n.setdefault('priority', 'ordinary')
        n.setdefault('pinned', False)
        n.setdefault('done', False)
        n.setdefault('due', '')
        n.setdefault('assignee', None)
    for p in persons.values():
        if p.get('rite') == 'Latin': p['rite'] = 'Roman Catholic'
        extra = d['PERSON_EXTRA'].setdefault(p['id'], {})
        legacy_pref = f"consent.{p['id']}.1"
        if legacy_pref in d.get('PREFS', {}):
            extra['legacyDirectoryPreference'] = d['PREFS'].pop(legacy_pref)
            extra['directory'] = bool(extra['legacyDirectoryPreference'])
        extra.setdefault('directory', False)
    for music in d.get('MUSIC', []):
        if music.get('lang') == 'Latin': music['lang'] = 'Roman liturgical'
    for event in d['EVENTS']:
        detail = d['EVENT_DETAIL'].setdefault(event['id'], dict(
            organizer=None, tz='Asia/Beirut', cat='', catAr='', tags=[], desc='', descAr='',
            bring=[], tasks=[], files=[], rsvp=dict(yes=0, no=0, maybe=0, none=0),
            cap=0, waiting=0, repeat='none', invited=[]))
        detail.setdefault('visibility', 'public')
        detail.setdefault('visibleGroupIds', [])
        detail.setdefault('priestIds', [])
        detail.setdefault('participants', [])
        detail.setdefault('subtype', 'wedding' if event['id'] == 'ev11' and 'Wedding' in event.get('title', '') else '')
    for form in d['REGISTRATIONS']:
        form.setdefault('eventId', None)
        form.setdefault('fields', copy.deepcopy(d['REG_FORM'].get('fields', [])) if form['id'] == d['REG_FORM'].get('id') else [])
        form.setdefault('discounts', copy.deepcopy(d['REG_FORM'].get('discounts', [])) if form['id'] == d['REG_FORM'].get('id') else [])
        form.setdefault('installments', copy.deepcopy(d['REG_FORM'].get('installments', [])) if form['id'] == d['REG_FORM'].get('id') else [])
    legacy_form = d.get('REG_FORM', {}).get('id')
    for index, row in enumerate(d['REGISTRANTS']):
        row.setdefault('id', f'legacy-registrant-{index+1}')
        row.setdefault('registrationId', legacy_form if any(r['id'] == legacy_form for r in d['REGISTRATIONS']) else None)
    d['CHECKIN'].setdefault('eventId', None)
    d['CHECKIN'].setdefault('sessions', {})
    for extra in d['PERSON_EXTRA'].values():
        extra.pop('preferred', None)
    for s in d['SACRAMENTS']:
        s.setdefault('history', [])
        s.setdefault('revision', 1)
        if s.get('kind') != 'certificate' and s.get('status') == 'awaiting-signature' and str(s.get('date', ''))[:10] > TODAY():
            s['status'] = 'scheduled'
        if s.get('kind') != 'certificate' and s.get('status') == 'approved':
            s['status'] = 'registered'
    return d


def init_db():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS dioceses(id TEXT PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS parishes(id TEXT PRIMARY KEY, diocese TEXT NOT NULL REFERENCES dioceses(id), metadata TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
          role TEXT NOT NULL, diocese TEXT NOT NULL REFERENCES dioceses(id), person_id TEXT, password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS assignments(user_id TEXT REFERENCES users(id), parish_id TEXT REFERENCES parishes(id),
          PRIMARY KEY(user_id,parish_id));
        CREATE TABLE IF NOT EXISTS states(parish_id TEXT PRIMARY KEY REFERENCES parishes(id), revision INTEGER NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), csrf TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, parish_id TEXT REFERENCES parishes(id), actor TEXT REFERENCES users(id),
          at TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS people(parish_id TEXT NOT NULL REFERENCES parishes(id), person_id TEXT NOT NULL,
          archived INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(parish_id,person_id));
        CREATE TABLE IF NOT EXISTS families(parish_id TEXT NOT NULL REFERENCES parishes(id), family_id TEXT NOT NULL,
          PRIMARY KEY(parish_id,family_id));
        CREATE TABLE IF NOT EXISTS family_branches(parish_id TEXT NOT NULL, branch_id TEXT NOT NULL, family_id TEXT NOT NULL,
          PRIMARY KEY(parish_id,branch_id), FOREIGN KEY(parish_id,family_id) REFERENCES families(parish_id,family_id));
        CREATE TABLE IF NOT EXISTS households(parish_id TEXT NOT NULL, household_id TEXT NOT NULL, family_id TEXT, branch_id TEXT, head_id TEXT,
          PRIMARY KEY(parish_id,household_id), FOREIGN KEY(parish_id,family_id) REFERENCES families(parish_id,family_id),
          FOREIGN KEY(parish_id,branch_id) REFERENCES family_branches(parish_id,branch_id),
          FOREIGN KEY(parish_id,head_id) REFERENCES people(parish_id,person_id));
        CREATE TABLE IF NOT EXISTS household_members(parish_id TEXT NOT NULL, household_id TEXT NOT NULL, person_id TEXT NOT NULL,
          relationship TEXT NOT NULL, relative_id TEXT, PRIMARY KEY(parish_id,person_id),
          UNIQUE(parish_id,household_id,person_id),
          FOREIGN KEY(parish_id,household_id) REFERENCES households(parish_id,household_id),
          FOREIGN KEY(parish_id,person_id) REFERENCES people(parish_id,person_id),
          FOREIGN KEY(parish_id,household_id,relative_id) REFERENCES household_members(parish_id,household_id,person_id));
        CREATE TABLE IF NOT EXISTS parish_groups(parish_id TEXT NOT NULL REFERENCES parishes(id), group_id TEXT NOT NULL, PRIMARY KEY(parish_id,group_id));
        CREATE TABLE IF NOT EXISTS group_members(parish_id TEXT NOT NULL, group_id TEXT NOT NULL, person_id TEXT NOT NULL,
          PRIMARY KEY(parish_id,group_id,person_id), FOREIGN KEY(parish_id,group_id) REFERENCES parish_groups(parish_id,group_id),
          FOREIGN KEY(parish_id,person_id) REFERENCES people(parish_id,person_id));
        CREATE TABLE IF NOT EXISTS sacramental_register(parish_id TEXT NOT NULL REFERENCES parishes(id), record_id TEXT NOT NULL,
          person_id TEXT NOT NULL, reference TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY(parish_id,record_id),
          UNIQUE(parish_id,reference), FOREIGN KEY(parish_id,person_id) REFERENCES people(parish_id,person_id));
        CREATE TABLE IF NOT EXISTS certificate_sources(parish_id TEXT NOT NULL, request_id TEXT NOT NULL, source_record_id TEXT NOT NULL,
          PRIMARY KEY(parish_id,request_id),
          FOREIGN KEY(parish_id,request_id) REFERENCES sacramental_register(parish_id,record_id),
          FOREIGN KEY(parish_id,source_record_id) REFERENCES sacramental_register(parish_id,record_id));
        CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
        ''')
        c.execute("INSERT OR IGNORE INTO dioceses VALUES('beirut','Archeparchy of Beirut')")
        seed = json.loads((ROOT / 'backend' / 'seed.json').read_text(encoding='utf-8'))
        for p in seed['PARISHES']:
            c.execute('INSERT OR IGNORE INTO parishes VALUES(?,?,?)', (p['id'], 'beirut', json.dumps(p)))
            d = copy.deepcopy(seed)
            if p['id'] != 'p-elias':
                # Independent empty records, with safe structural defaults for the existing views.
                for k, v in list(d.items()):
                    if isinstance(v, list): d[k] = []
                    elif isinstance(v, dict): d[k] = {}
                for k in ('RATE', 'SERVICE', 'ROTA', 'CHECKIN', 'BATCH', 'REG_FORM', 'EVACUATION'):
                    d[k] = copy.deepcopy(seed[k])
                d['SERVICE'].update(order=[], celebrant=None, coordinator=None, venue=None)
                d['ROTA']['teams'] = []
                d['CHECKIN'].update(rows=[], present=0, expected=0, awaitingGuardian=0, room=None)
                d['BATCH'].update(lines=[], counters=[])
                d['REG_FORM'].update(fields=[], discounts=[], installments=[])
                d['EVACUATION']['rooms'] = []
                d['PARISH'] = copy.deepcopy(seed['PARISH'])
            d['PARISH'].update(id=p['id'], name=p['name'], nameAr=p['ar'], town=p['town'], townAr=p['townAr'])
            d['PARISHES'] = []
            c.execute('INSERT OR IGNORE INTO states VALUES(?,1,?)', (p['id'], json.dumps(migrate_state(d))))
        for row in c.execute('SELECT * FROM states').fetchall():
            d = migrate_state(json.loads(row['data']))
            c.execute('UPDATE states SET data=? WHERE parish_id=?', (json.dumps(d), row['parish_id']))
            sync_relationships(c, row['parish_id'], d)
        c.execute('DELETE FROM schema_version')
        c.execute('INSERT INTO schema_version VALUES(5)')


def sync_relationships(c, pid, d):
    """Mirror key church relationships into normalized, foreign-keyed tables."""
    c.execute('PRAGMA defer_foreign_keys=ON')
    for table in ('certificate_sources', 'sacramental_register', 'group_members', 'household_members', 'households', 'family_branches', 'families', 'parish_groups', 'people'):
        c.execute(f'DELETE FROM {table} WHERE parish_id=?', (pid,))
    people = d['PEOPLE'] + d['ARCHIVED']
    for p in people: c.execute('INSERT INTO people VALUES(?,?,?)', (pid, p['id'], int(p in d['ARCHIVED'])))
    for f in d['FAMILIES']: c.execute('INSERT INTO families VALUES(?,?)', (pid, f['id']))
    for b in d['BRANCHES']: c.execute('INSERT INTO family_branches VALUES(?,?,?)', (pid, b['id'], b['family']))
    for h in d['HOUSEHOLDS']: c.execute('INSERT INTO households VALUES(?,?,?,?,?)', (pid, h['id'], h.get('family'), h.get('branch'), h.get('head')))
    for h in d['HOUSEHOLDS']:
        for person_id in h['members']:
            p = next(p for p in people if p['id'] == person_id)
            c.execute('INSERT INTO household_members VALUES(?,?,?,?,?)', (pid, h['id'], person_id, p.get('rel', 'relative'), p.get('relativeTo')))
    for g in d['GROUPS']: c.execute('INSERT INTO parish_groups VALUES(?,?)', (pid, g['id']))
    for gid, info in d['GROUP_DETAIL'].items():
        for member in info.get('roster', []): c.execute('INSERT INTO group_members VALUES(?,?,?)', (pid, gid, member['p']))
    for s in d['SACRAMENTS']: c.execute('INSERT INTO sacramental_register VALUES(?,?,?,?,?)', (pid, s['id'], s['person'], s['reg'], s['status']))
    for s in d['SACRAMENTS']:
        if s.get('kind') == 'certificate' and s.get('sourceRecordId'):
            c.execute('INSERT INTO certificate_sources VALUES(?,?,?)', (pid, s['id'], s['sourceRecordId']))


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    return salt + ':' + hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 600000).hex()


def access(c, u, pid):
    p = c.execute('SELECT * FROM parishes WHERE id=? AND diocese=?', (pid, u['diocese'])).fetchone()
    require(p is not None and (u['role'] == 'bishop' or c.execute('SELECT 1 FROM assignments WHERE user_id=? AND parish_id=?', (u['id'], pid)).fetchone()), 'This parish is not assigned to your account.', 403)


def parishes(c, u):
    rows = c.execute('SELECT * FROM parishes WHERE diocese=?', (u['diocese'],)).fetchall()
    assigned = {r[0] for r in c.execute('SELECT parish_id FROM assignments WHERE user_id=?', (u['id'],))}
    role_names = {'bishop': ('Archdiocese oversight', 'إشراف الأبرشية'), 'priest': ('Assigned parish priest', 'كاهن معيّن'),
                  'secretary': ('Parish secretary', 'أمانة سرّ الرعية'), 'treasurer': ('Parish treasurer', 'أمين صندوق الرعية'),
                  'leader': ('Ministry leader', 'مسؤول خدمة'), 'volunteer': ('Volunteer', 'متطوّع')}
    result = []
    for r in rows:
        if u['role'] != 'bishop' and r['id'] not in assigned: continue
        p = json.loads(r['metadata']); p['role'], p['roleAr'] = role_names[u['role']]
        state = c.execute('SELECT data FROM states WHERE parish_id=?', (r['id'],)).fetchone()
        if state:
            data = json.loads(state['data']); p['people'] = len(data['PEOPLE']); p['households'] = len(data['HOUSEHOLDS'])
            p['sacramentsYear'] = sum(1 for s in data['SACRAMENTS'] if str(s.get('date', '')).startswith(str(dt.date.today().year)) and s.get('kind') != 'certificate' and s.get('status') in {'registered', 'issued'})
        result.append(p)
    return result


def oversight(c, u, pid=None):
    """A separate projection: no private notes, contact data, or parish editing model."""
    require(u['role'] == 'bishop', 'Bishop oversight access required.', 403)
    result = []
    for parish in parishes(c, u):
        if pid and parish['id'] != pid: continue
        d = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (parish['id'],)).fetchone()['data'])
        counts = dict(people=len(d['PEOPLE']), households=len(d['HOUSEHOLDS']), groups=len(d['GROUPS']),
                      registers=sum(s.get('kind') != 'certificate' and s.get('status') in {'registered', 'issued'} for s in d['SACRAMENTS']),
                      pendingRequests=sum(s.get('status') in {'draft', 'scheduled', 'awaiting-signature', 'approved'} for s in d['SACRAMENTS']),
                      upcomingEvents=sum(str(e.get('d', e.get('date', '')))[:10] >= TODAY() for e in d['EVENTS']))
        item = dict(parish=parish, counts=counts)
        if pid:
            people = {p['id']: p for p in d['PEOPLE'] + d['ARCHIVED']}
            name = lambda person_id: {key: people.get(person_id, {}).get(key, '') for key in ('lat', 'ar')}
            item['people'] = [dict(id=p['id'], lat=p['lat'], ar=p['ar'], status=p.get('status', ''), household=p.get('hh')) for p in d['PEOPLE']]
            item['records'] = [dict(id=s['id'], reference=s['reg'], kind=s['kind'], status=s['status'], date=s['date'], person=name(s['person'])) for s in d['SACRAMENTS']]
            item['events'] = [dict(id=e['id'], title=e.get('title', ''), titleAr=e.get('titleAr', ''), date=e.get('d', e.get('date', '')), time=e.get('time', e.get('t', '')), kind=e.get('kind', ''), venue=e.get('venue', '')) for e in d['EVENTS']]
            item['groups'] = [dict(id=g['id'], name=g['name'], ar=g.get('ar', ''), members=len(d['GROUP_DETAIL'].get(g['id'], {}).get('roster', [])), meetings=len(d['GROUP_DETAIL'].get(g['id'], {}).get('meetings', []))) for g in d['GROUPS']]
            item['activity'] = [dict(at=r['at'], action=r['action']) for r in c.execute('SELECT at,action FROM audit WHERE parish_id=? ORDER BY id DESC LIMIT 50', (pid,))]
        result.append(item)
    require(not pid or result, 'Parish not found in your archdiocese.', 404)
    return result[0] if pid else result


def visible(c, u, pid, d):
    require(u['role'] != 'bishop', 'Use the read-only bishop oversight view.', 403)
    d = copy.deepcopy(d)
    all_people = d['PEOPLE']
    d['PARISH'].update(people=len(d['PEOPLE']), households=len(d['HOUSEHOLDS']), groups=len(d['GROUPS']))
    d['PARISHES'] = parishes(c, u)
    if u['role'] not in CLERGY:
        d['NOTES'] = []
        d['AUDIT'] = []
        for k in ('SESSIONS', 'SECURITY_ALERTS', 'WEBHOOKS', 'EXCEPTIONS'):
            d[k] = []
        d['PARISH'].pop('apiKey', None)
    else:
        actors = {row['id']: row for row in c.execute('SELECT id,name,person_id FROM users WHERE diocese=?', (u['diocese'],))}
        d['AUDIT'] = [dict(at=r['at'], who=actors[r['actor']]['person_id'] if r['actor'] in actors else None,
                           actorName=actors[r['actor']]['name'] if r['actor'] in actors else 'System',
                           what=r['action'], whatAr=r['action'], kind='approve' if 'approve' in r['action'] else 'create')
                      for r in c.execute('SELECT * FROM audit WHERE parish_id=? ORDER BY id DESC LIMIT 500', (pid,))]
    if u['role'] not in CLERGY | {'treasurer'}:
        for k in FINANCE:
            d[k] = [] if isinstance(d.get(k), list) else {'lines': [], 'status': 'unavailable', 'counters': []}
    if u['role'] == 'treasurer':
        for k in ('SACRAMENTS', 'CORRECTIONS', 'PORTAL_REQUESTS', 'REQUEST_HISTORY', 'PRAYERS', 'INCIDENTS', 'PICKUP'):
            d[k] = []
    if u['role'] in {'leader', 'volunteer'}:
        gs = {g['id'] for g in d['GROUPS'] if g.get('leader') == u['person_id'] or g.get('assistant') == u['person_id']}
        ids = ({u['person_id']}
               | {r['p'] for g in gs for r in d['GROUP_DETAIL'].get(g, {}).get('roster', [])}
               | {member for g in gs for meeting in d['GROUP_DETAIL'].get(g, {}).get('meetings', [])
                  for member in meeting.get('attendance', {})}
               | {u['person_id']})
        d['PEOPLE'] = [dict(id=p['id'], lat=p['lat'], ar=p['ar'], tags=[], hh=None, phone='—', born='', status=p['status']) for p in d['PEOPLE'] if p['id'] in ids]
        for k in ('ARCHIVED', 'HOUSEHOLDS', 'SACRAMENTS', 'CORRECTIONS', 'FAMILIES', 'BRANCHES', 'PORTAL_REQUESTS', 'REQUEST_HISTORY'):
            d[k] = []
        d['PERSON_EXTRA'] = {}
        d['GROUPS'] = [g for g in d['GROUPS'] if g['id'] in gs]
        d['GROUP_DETAIL'] = {g: v for g, v in d['GROUP_DETAIL'].items() if g in gs}
    if u['role'] not in {'priest', 'secretary'}:
        member_groups = {gid for gid, detail in d['GROUP_DETAIL'].items()
                         if any(member.get('p') == u['person_id'] for member in detail.get('roster', []))}
        allowed_groups = member_groups | ({g['id'] for g in d['GROUPS'] if g.get('leader') == u['person_id'] or g.get('assistant') == u['person_id']})
        allowed_events = {event['id'] for event in d['EVENTS'] if
                          d['EVENT_DETAIL'].get(event['id'], {}).get('visibility', 'public') == 'public' or
                          (d['EVENT_DETAIL'].get(event['id'], {}).get('visibility') == 'groups' and
                           allowed_groups.intersection(d['EVENT_DETAIL'].get(event['id'], {}).get('visibleGroupIds', [])))}
        d['EVENTS'] = [event for event in d['EVENTS'] if event['id'] in allowed_events]
        d['EVENT_DETAIL'] = {eid: detail for eid, detail in d['EVENT_DETAIL'].items() if eid in allowed_events}
        d['REGISTRATIONS'] = [form for form in d['REGISTRATIONS'] if form.get('eventId') in allowed_events]
        allowed_forms = {form['id'] for form in d['REGISTRATIONS']}
        d['REGISTRANTS'] = [row for row in d['REGISTRANTS'] if row.get('registrationId') in allowed_forms]
        if u['role'] in {'leader', 'volunteer'}:
            existing = {person['id'] for person in d['PEOPLE']}
            allowed_people = {row['p'] for row in d['REGISTRANTS']}
            d['PEOPLE'].extend(dict(id=person['id'], lat=person['lat'], ar=person['ar'], tags=[], hh=None,
                                    phone='—', born='', status=person['status'])
                               for person in all_people if person['id'] in allowed_people - existing)
        # Legacy unlinked form/check-in records remain in storage, but have no
        # event visibility rule and must not be sent to restricted users.
        d['REG_FORM'] = {}
        for key, value in {'rows': [], 'present': 0, 'expected': 0, 'awaitingGuardian': 0,
                           'room': None, 'session': '', 'sessionAr': ''}.items():
            d['CHECKIN'][key] = value
        d['CHECKIN']['sessions'] = {eid: session for eid, session in d['CHECKIN'].get('sessions', {}).items() if eid in allowed_events}
    return d


def validate(d):
    def index(key):
        rows = d[key]
        require(isinstance(rows, list) and all(isinstance(x, dict) and isinstance(x.get('id'), str) for x in rows), 'Invalid ' + key)
        result = {x['id']: x for x in rows}
        require(len(result) == len(rows), 'Duplicate IDs in ' + key)
        return result
    pp = {**index('PEOPLE'), **index('ARCHIVED')}
    hh, ff, bb, gg = index('HOUSEHOLDS'), index('FAMILIES'), index('BRANCHES'), index('GROUPS')
    for b in bb.values():
        require(b.get('family') in ff, 'A branch must belong to an existing family.')
    seen = set()
    for h in hh.values():
        members = h.get('members', [])
        require(len(set(members)) == len(members) and not seen.intersection(members), 'A person can belong to only one household.')
        seen.update(members)
        require(not h.get('head') or h['head'] in members, 'The designated head must be a household member.')
        require(h.get('family') in ff and h.get('branch') in bb and bb[h['branch']]['family'] == h['family'], 'Choose a branch of this main family.')
        for pid in members:
            require(pid in pp and pp[pid].get('hh') == h['id'], 'Household membership links must agree.')
    for p in pp.values():
        require(not p.get('hh') or p['hh'] in hh and p['id'] in hh[p['hh']]['members'], 'Invalid household link.')
        rel = p.get('relativeTo')
        require(not rel or rel != p['id'] and p.get('hh') and rel in hh[p['hh']]['members'], 'The related person must be another member of this household.')
    for pid, extra in d['PERSON_EXTRA'].items():
        require(pid in pp, 'Person details must belong to an existing person.')
        address = extra.get('address')
        if not isinstance(address, dict) or not any(address.get(k) for k in ('governorate', 'district', 'town', 'sector')):
            continue
        gov = next((g for g in GEOGRAPHY if g['id'] == address.get('governorate')), None)
        district = next((x for x in gov['districts'] if x['id'] == address.get('district')), None) if gov else None
        town = next((x for x in district['towns'] if x['id'] == address.get('town')), None) if district else None
        require(gov and district and town and (not address.get('sector') or
                address['sector'] in {x['id'] for x in town['sectors']}),
                'Choose a valid Governorate, District, Town, and Sector combination.')
    for gid, detail in d['GROUP_DETAIL'].items():
        require(gid in gg, 'Group assignments must use an existing parish group.')
        roster = detail.get('roster', [])
        require(all(r.get('p') in pp for r in roster) and len({r['p'] for r in roster}) == len(roster), 'Invalid or duplicate group membership.')
        meeting_ids = set()
        for meeting in detail.get('meetings', []):
            mid = meeting.get('id')
            require(isinstance(mid, str) and mid and mid not in meeting_ids, 'Group meetings need unique IDs.')
            meeting_ids.add(mid)
            attendance = meeting.get('attendance', {})
            require(isinstance(attendance, dict) and set(attendance) <= set(pp) and
                    all(value in {'present', 'excused', 'absent'} for value in attendance.values()),
                    'Attendance must reference people in this parish and valid statuses.')
    plans = index('SERVICE_PLANS')
    require(d['SERVICE'].get('id') not in plans, 'Service plan IDs must be unique.')
    for plan in [d['SERVICE'], *plans.values()]:
        require(isinstance(plan.get('title'), str) and bool(plan['title'].strip())
                and isinstance(plan.get('order'), list) and all(isinstance(item, dict) and item.get('t') for item in plan['order']),
                'A service plan needs a title and valid order of service.')
    for template in index('EVENT_TEMPLATES').values():
        require(isinstance(template.get('name'), str) and bool(template['name'].strip())
                and template.get('kind') in {'event', 'mass', 'group', 'sacr', 'pending'},
                'Calendar templates need a name and valid category.')
    for template in index('SERVICE_TEMPLATES').values():
        require(isinstance(template.get('name'), str) and bool(template['name'].strip())
                and isinstance(template.get('order'), list)
                and all(isinstance(item, dict) and item.get('t') for item in template['order']),
                'Service templates need a name and valid order of service.')
    for n in d['NOTES']:
        require(n.get('kind') in {'note', 'task'} and n.get('priority') in {'ordinary', 'attention', 'urgent'}
                and isinstance(n.get('pinned'), bool) and isinstance(n.get('done'), bool)
                and isinstance(n.get('body'), str) and bool(n['body'].strip())
                and (n.get('p') in pp or n['kind'] == 'task' and not n.get('p'))
                and isinstance(n.get('due'), str), 'A pastoral item needs valid content, priority, and person if it is a note.')
        require(not n.get('assignee') or n['kind'] == 'task' and n['assignee'] in pp and pp[n['assignee']].get('status') == 'clergy',
                'Task assignee must be clergy in this parish.')
    events = index('EVENTS')
    for eid, detail in d['EVENT_DETAIL'].items():
        require(eid in events and detail.get('visibility', 'public') in {'public', 'groups', 'confidential'}, 'Invalid event visibility.')
        group_ids = detail.get('visibleGroupIds', [])
        require(isinstance(group_ids, list) and set(group_ids) <= set(gg) and
                (detail.get('visibility') != 'groups' or bool(group_ids)), 'Select existing groups for restricted event visibility.')
        require(set(detail.get('priestIds', [])) <= {p['id'] for p in pp.values() if p.get('status') == 'clergy'},
                'Mass assignments must use clergy in this parish.')
    registration_ids = set()
    for form in d['REGISTRATIONS']:
        require(form.get('id') not in registration_ids, 'Duplicate registration form.')
        registration_ids.add(form['id'])
        event_id = form.get('eventId')
        require(not event_id or event_id in events and events[event_id].get('kind') != 'mass' and
                not events[event_id].get('feastLiturgy') and not events[event_id].get('liturgy'),
                'Registration requires an eligible event, not a Mass or feast liturgy.')
    for row in d['REGISTRANTS']:
        require(not row.get('registrationId') or row['registrationId'] in registration_ids,
                'Registrant must belong to an existing registration form.')
    for eid, session in d['CHECKIN'].get('sessions', {}).items():
        require(eid in events and events[eid].get('kind') != 'mass' and not events[eid].get('feastLiturgy') and
                not events[eid].get('liturgy') and
                session.get('eventId') == eid and any(f.get('eventId') == eid for f in d['REGISTRATIONS']),
                'Check-in requires a registered, eligible event.')
        eligible_people = {row.get('p') for row in d['REGISTRANTS'] if any(
            form['id'] == row.get('registrationId') and form.get('eventId') == eid for form in d['REGISTRATIONS'])}
        rows = session.get('rows', [])
        require(all(row.get('p') in eligible_people for row in rows) and len({row.get('p') for row in rows}) == len(rows),
                'Only registered participants may be checked in, once per event.')
    refs = set()
    for s in d['SACRAMENTS']:
        require(s.get('person') in pp and s.get('reg') and s['reg'] not in refs, 'Sacrament person/reference is invalid or duplicated.')
        refs.add(s['reg'])
    records = {s['id']: s for s in d['SACRAMENTS']}
    for s in d['SACRAMENTS']:
        if s.get('kind') != 'certificate' and s.get('status') in {'draft', 'awaiting-signature', 'registered', 'issued'}:
            require(str(s.get('date', ''))[:10] <= TODAY(), 'Future sacraments must remain scheduled until their date.')
        if s.get('kind') == 'certificate' and s.get('requestedSacramentId'):
            planned = records.get(s['requestedSacramentId'])
            require(planned is not None and planned.get('kind') != 'certificate' and planned.get('person') == s.get('person'),
                    'The planned sacrament must belong to the certificate subject.')
        if s.get('kind') == 'certificate' and s.get('sourceRecordId'):
            source = records.get(s['sourceRecordId'])
            require(source is not None and source['kind'] != 'certificate' and source['person'] == s['person']
                    and source['status'] in {'registered', 'issued'}, 'Certificate source must be an official register entry for the same person.')


def writable(role, key):
    if role == 'bishop': return False
    if key in READONLY: return False
    if role in CLERGY: return True
    if key in {'NOTIFICATIONS', 'PREFS'}: return True
    if role == 'secretary': return key in OFFICE
    if role == 'treasurer': return key in FINANCE | {'RATE'}
    if role == 'leader': return key in {'GROUP_DETAIL', 'MUSIC', 'MUSIC_DETAIL', 'SETLISTS'}
    return False


def save_patch(c, u, pid, payload):
    access(c, u, pid)
    require(u['role'] != 'bishop', 'Bishop oversight is read-only. Parish staff manage parish records.', 403)
    row = c.execute('SELECT * FROM states WHERE parish_id=?', (pid,)).fetchone()
    require(payload.get('revision') == row['revision'], 'Another user changed this parish. Reload before saving.', 409)
    old = json.loads(row['data']); d = copy.deepcopy(old)
    changes = payload.get('changes')
    require(isinstance(changes, dict), 'Expected changes.')
    for key, value in changes.items():
        require(key in d and writable(u['role'], key), 'Your role cannot change ' + key, 403)
        require(type(value) is type(d[key]), 'Invalid collection type: ' + key)
        if key == 'GROUP_DETAIL' and u['role'] == 'leader':
            permitted = {g['id'] for g in old['GROUPS'] if g.get('leader') == u['person_id'] or g.get('assistant') == u['person_id']}
            require(set(value) <= permitted, 'Group is outside your ministry.', 403)
            d[key].update(value)
        else: d[key] = value
    removed_people = ({person['id'] for person in old['PEOPLE'] + old['ARCHIVED']} -
                      {person['id'] for person in d['PEOPLE'] + d['ARCHIVED']})
    if removed_people:
        def references(value, person_id):
            if isinstance(value, dict):
                return any(key == person_id or references(item, person_id) for key, item in value.items())
            if isinstance(value, list):
                return any(references(item, person_id) for item in value)
            return value == person_id
        preserved = {key: value for key, value in old.items()
                     if key not in {'PEOPLE', 'ARCHIVED', 'PERSON_EXTRA', 'PHOTOS', 'PREFS'}}
        for person_id in removed_people:
            require(not any(references(value, person_id) for value in preserved.values()) and
                    not any(references(person, person_id) for person in old['PEOPLE'] + old['ARCHIVED']
                            if person['id'] != person_id),
                    'Archive a person with linked records instead of permanently deleting them.')
    old_forms = {form['id']: form for form in old['REGISTRATIONS']}
    for form in d['REGISTRATIONS']:
        if form['id'] not in old_forms or form != old_forms[form['id']]:
            event_id = form.get('eventId')
            require(event_id and event_id in {event['id'] for event in d['EVENTS']},
                    'Select an eligible event before saving a registration form.')
    previous_registrants = {registrant['id'] for registrant in old['REGISTRANTS']}
    current_forms = {form['id']: form for form in d['REGISTRATIONS']}
    added_by_form = {}
    for registrant in d['REGISTRANTS']:
        if registrant['id'] not in previous_registrants:
            require(registrant.get('registrationId'), 'Select a registration form before adding participants.')
            form = current_forms.get(registrant['registrationId'])
            require(form is not None and form.get('eventId') and form.get('open'),
                    'New participants require an open registration form linked to an event.')
            added_by_form[form['id']] = added_by_form.get(form['id'], 0) + 1
            require(not any(other is not registrant and other.get('p') == registrant.get('p') and
                            current_forms.get(other.get('registrationId'), {}).get('eventId') == form['eventId']
                            for other in d['REGISTRANTS']), 'This person is already registered for that event.')
    for form_id, count in added_by_form.items():
        form = current_forms[form_id]
        require(form.get('cap', 0) >= form.get('taken', 0) and
                form.get('taken', 0) >= old_forms.get(form_id, {}).get('taken', 0) + count,
                'Registration capacity or participant count is inconsistent.')
    if 'CHECKIN' in changes:
        for key in ('rows', 'present', 'expected', 'awaitingGuardian', 'room', 'session', 'sessionAr'):
            require(d['CHECKIN'].get(key) == old['CHECKIN'].get(key),
                    'Legacy check-in data is preserved; select an event for new check-ins.')
    if 'GROUP_DETAIL' in changes:
        for gid, detail in d['GROUP_DETAIL'].items():
            current_members = {member['p'] for member in detail.get('roster', [])}
            earlier = {meeting.get('id'): meeting for meeting in old['GROUP_DETAIL'].get(gid, {}).get('meetings', [])}
            for meeting in detail.get('meetings', []):
                previous_ids = set(earlier.get(meeting.get('id'), {}).get('attendance', {}))
                added_ids = set(meeting.get('attendance', {})) - previous_ids
                require(added_ids <= current_members, 'New attendance may be recorded only for current group members.')
    # Register lifecycle and immutable history only change through the workflow API.
    previous = {s['id']: s for s in old['SACRAMENTS']}
    current = {s['id']: s for s in d['SACRAMENTS']}
    require(previous.keys() <= current.keys(), 'Register entries cannot be deleted.')
    for sid, s in current.items():
        if sid in previous:
            require(s == previous[sid], 'Use the approval or correction workflow to change a register entry.')
        else:
            require(s.get('status') in {'draft', 'scheduled', 'awaiting-signature'}, 'New entries must await review.')
            require(not any(s.get(k) for k in PROTECTED - {'status', 'revision'}), 'Approval metadata is server-managed.')
            if s.get('kind') == 'certificate':
                source = previous.get(s.get('sourceRecordId'))
                require(source is not None and source['kind'] != 'certificate' and source['person'] == s.get('person')
                        and source['status'] in {'registered', 'issued'}, 'Choose an official register entry for the certificate request.')
            s.update(history=[], revision=1)
    if u['role'] not in CLERGY:
        for key in ('RESERVATIONS', 'EXPENSES', 'SERVICE_REQUESTS'):
            before = {x['id']: x for x in old[key]}
            for x in d[key]:
                if x.get('status') in {'approved', 'rejected'}:
                    require(x['id'] in before and before[x['id']].get('status') == x['status'], 'Priest approval is required.', 403)
    d = migrate_state(d)
    validate(d)
    sync_relationships(c, pid, d)
    c.execute('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', (json.dumps(d), pid))
    audit(c, u, pid, 'Records updated', {'collections': list(changes)})
    return row['revision'] + 1


def audit(c, u, pid, action, detail):
    c.execute('INSERT INTO audit(parish_id,actor,at,action,detail) VALUES(?,?,?,?,?)', (pid, u['id'], NOW(), action, json.dumps(detail)))


def workflow(c, u, pid, q):
    access(c, u, pid)
    require(u['role'] in CLERGY | {'secretary'}, 'Office access required.', 403)
    row = c.execute('SELECT * FROM states WHERE parish_id=?', (pid,)).fetchone()
    require(q.get('revision') == row['revision'], 'Record changed. Reload before continuing.', 409)
    d = json.loads(row['data']); action = q.get('action'); sid = q.get('id')
    s = next((s for s in d['SACRAMENTS'] if s['id'] == sid), None)
    at = NOW()
    if action == 'update-entry':
        require(s is not None and s.get('kind') != 'certificate' and s.get('status') in {'draft', 'scheduled'},
                'Only a planned or unsubmitted sacrament can be edited. Approved entries need a correction request.')
        fields = q.get('fields')
        allowed = {'date', 'celebrant', 'godparents', 'book', 'page', 'father', 'mother', 'place',
                   'externalParish', 'externalReference'}
        require(isinstance(fields, dict) and fields and set(fields) <= allowed, 'Choose editable sacrament details.')
        for key, value in fields.items():
            require(isinstance(value, str) and len(value) <= 500, 'Invalid sacrament detail.')
            if key == 'date':
                try: dt.date.fromisoformat(value)
                except ValueError: raise Problem(400, 'Enter a valid celebration date.')
            if key == 'celebrant' and value:
                require(any(p['id'] == value and p.get('status') == 'clergy' for p in d['PEOPLE']), 'Choose a parish celebrant.')
            s[key] = value.strip()
        s['status'] = 'scheduled' if str(s['date'])[:10] > TODAY() else 'draft'
        s['revision'] = s.get('revision', 1) + 1
        s.setdefault('history', []).append(dict(action='details updated', by=u['name'], at=at, fields=sorted(fields)))
    elif action == 'create-certificate-request':
        person_id = q.get('person')
        require(any(p['id'] == person_id for p in d['PEOPLE']), 'Choose a parishioner for the request.')
        purpose = str(q.get('purpose', '')).strip()
        require(0 < len(purpose) <= 500, 'Enter a purpose of 500 characters or less.')
        source_id = q.get('sourceRecordId') or None
        planned_id = q.get('requestedSacramentId') or None
        require(not (source_id and planned_id), 'Choose either an official entry or a scheduled sacrament.')
        source = next((x for x in d['SACRAMENTS'] if x['id'] == source_id), None) if source_id else None
        planned = next((x for x in d['SACRAMENTS'] if x['id'] == planned_id), None) if planned_id else None
        if source_id:
            require(source is not None and source['kind'] != 'certificate' and source['person'] == person_id
                    and source['status'] in {'registered', 'issued'}, 'Choose an official entry for this parishioner.')
        if planned_id:
            require(planned is not None and planned['kind'] != 'certificate' and planned['person'] == person_id
                    and planned['status'] in {'draft', 'scheduled', 'awaiting-signature'},
                    'Choose a pending sacrament for this parishioner.')
        request_id = str(q.get('requestId', ''))
        require(request_id == sid and request_id.startswith('sc') and len(request_id) <= 48
                and not any(x['id'] == request_id for x in d['SACRAMENTS']),
                'Invalid or duplicate request reference.')
        year = TODAY()[:4]
        prefix = f'REQ/{year}/'
        number = max([int(x['reg'][len(prefix):]) for x in d['SACRAMENTS']
                      if str(x.get('reg', '')).startswith(prefix) and str(x['reg'][len(prefix):]).isdigit()] or [0]) + 1
        request_history = [dict(action='request submitted', by=u['name'], at=at)]
        if source: request_history.append(dict(action='submitted for clergy review', by=u['name'], at=at))
        d['SACRAMENTS'].insert(0, dict(id=request_id, kind='certificate', kindAr='طلب شهادة',
            reg=f'{prefix}{number:03d}', person=person_id, date=TODAY(),
            celebrant=(source or planned or {}).get('celebrant') or u.get('person_id') or '',
            status='awaiting-signature' if source else 'draft', sourceRecordId=source_id, requestedSacramentId=planned_id,
            purpose=purpose, godparents='', history=request_history, revision=1))
    elif action in {'submit', 'approve', 'issue', 'reject', 'cancel'}:
        require(s is not None, 'Register entry not found.', 404)
        if action == 'cancel':
            require(s.get('kind') == 'certificate' and s['status'] in {'draft', 'awaiting-signature'},
                    'Only an open certificate request can be cancelled.')
            reason = str(q.get('reason', '')).strip()
            require(0 < len(reason) <= 500, 'Enter a cancellation reason of 500 characters or less.')
            s['status'] = 'cancelled'
            s.setdefault('history', []).append(dict(action='cancelled', by=u['name'], at=at, reason=reason))
        else:
            if action in {'approve', 'issue'} and s.get('kind') == 'certificate':
                source = next((x for x in d['SACRAMENTS'] if x['id'] == s.get('sourceRecordId')), None)
                require(source is not None and source['person'] == s['person'] and source['status'] in {'registered', 'issued'},
                        'Link an official register entry for this person before approving the certificate request.')
            if action == 'submit':
                require(s['status'] in {'draft', 'scheduled'}, 'This entry is already submitted.')
                was_scheduled = s['status'] == 'scheduled'
                if s.get('kind') == 'certificate':
                    source = next((x for x in d['SACRAMENTS'] if x['id'] == s.get('sourceRecordId')), None)
                    require(source is not None and source['person'] == s['person'] and source['status'] in {'registered', 'issued'},
                            'An official register entry must be linked before priest review.')
                else:
                    require(str(s['date'])[:10] <= TODAY(), 'Wait until the celebration date before submitting the register entry.')
                s['status'] = 'awaiting-signature'
                if s.get('kind') != 'certificate' and was_scheduled:
                    s.setdefault('history', []).append(dict(action='sacrament celebrated', by=u['name'], at=at))
            else:
                require(u['role'] in CLERGY, 'Only the assigned parish priest can approve and issue.', 403)
                require(q.get('verified') is True, 'Confirm that you checked the original register.')
                if action in {'approve', 'reject'}:
                    require(s['status'] == 'awaiting-signature', 'This entry is not awaiting approval.')
                    require(s.get('kind') == 'certificate' or str(s['date'])[:10] <= TODAY(), 'A future sacrament cannot yet be approved.')
                    if action == 'reject':
                        reason = str(q.get('reason', '')).strip()
                        require(0 < len(reason) <= 500, 'Enter a rejection reason of 500 characters or less.')
                    s['status'] = ('approved' if s.get('kind') == 'certificate' else 'registered') if action == 'approve' else 'rejected'
                    if action == 'approve': s.update(approvedBy=u['name'], approvedAt=at)
                    else: s.update(reviewedBy=u['name'], reviewedAt=at)
                    if action == 'approve' and s.get('kind') != 'certificate':
                        for request in d['SACRAMENTS']:
                            if request.get('kind') == 'certificate' and request.get('requestedSacramentId') == s['id'] and request.get('status') == 'draft' and not request.get('sourceRecordId'):
                                request['sourceRecordId'] = s['id']
                                request.setdefault('history', []).append(dict(action='source linked', by=u['name'], at=at, source=s['reg']))
                else:
                    require(s.get('kind') == 'certificate' and s['status'] == 'approved', 'Approve a certificate request before issuing it.')
                    s.update(status='issued', issuedBy=u['name'], issuedAt=at)
            h = dict(action=action, by=u['name'], at=at)
            if action == 'reject': h['reason'] = reason
            s.setdefault('history', []).append(h)
    elif action == 'link-source':
        require(s is not None and s.get('kind') == 'certificate' and s['status'] in {'draft', 'scheduled', 'awaiting-signature'}, 'Only an open certificate request can be linked.')
        source = next((x for x in d['SACRAMENTS'] if x['id'] == q.get('sourceRecordId')), None)
        require(source is not None and source['kind'] != 'certificate' and source['person'] == s['person'] and source['status'] in {'registered', 'issued'},
                'Choose an official register entry for this person.')
        prior = s.get('sourceRecordId')
        s['sourceRecordId'] = source['id']
        s.setdefault('history', []).append(dict(action='source linked', by=u['name'], at=at, source=source['reg'], priorSource=prior))
    elif action == 'correction-request':
        require(s is not None, 'Register entry not found.', 404)
        require(s.get('kind') != 'certificate' and s.get('status') in {'approved', 'registered', 'issued'},
                'Corrections apply to approved register entries. Edit or reject an entry before approval.')
        field = q.get('field')
        require(field in {'date', 'godparents', 'book', 'page', 'externalReference', 'externalParish', 'father', 'mother', 'place'}, 'Unsupported correction field.')
        require(bool(str(q.get('reason', '')).strip()) and bool(str(q.get('value', '')).strip()), 'A replacement and a reason are required.')
        d['CORRECTIONS'].append(dict(id=secrets.token_hex(12), sacrament=sid, reg=s['reg'], field=field, fieldAr=field,
            **{'from': s.get(field, ''), 'to': q['value']}, reason=q['reason'], by=u['name'], at=at, status='awaiting-approval', baseRevision=s.get('revision', 1)))
    elif action in {'correction-approve', 'correction-reject'}:
        require(u['role'] in CLERGY, 'Priest approval is required.', 403)
        cor = next((x for x in d['CORRECTIONS'] if x['id'] == sid), None)
        require(cor is not None and cor['status'] == 'awaiting-approval', 'Correction is not awaiting review.')
        s = next((x for x in d['SACRAMENTS'] if x['id'] == cor.get('sacrament')), None)
        require(s is not None, 'Legacy correction has no linked entry. Create a linked correction request first.')
        if action == 'correction-approve':
            require(cor['baseRevision'] == s.get('revision', 1) and s.get(cor['field'], '') == cor['from'], 'Entry changed since the correction request. Submit a new request.', 409)
            s.setdefault('original', copy.deepcopy(s))
            s[cor['field']] = cor['to']; s['revision'] = s.get('revision', 1) + 1
            s.setdefault('history', []).append(dict(action='correction', by=u['name'], at=at, correction=cor['id']))
        cor.update(status='approved' if action.endswith('approve') else 'rejected', approver=u['name'], reviewedAt=at)
    else: raise Problem(400, 'Unknown workflow action.')
    d = migrate_state(d)
    validate(d)
    sync_relationships(c, pid, d)
    c.execute('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', (json.dumps(d), pid))
    audit(c, u, pid, action, q)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('X-Frame-Options', 'DENY')
        super().end_headers()

    def reply(self, status, obj, cookie=None):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        if cookie: self.send_header('Set-Cookie', cookie)
        self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith('/api/'): return self.api()
        path = urlsplit(self.path).path
        allowed = path in {'/', '/index.html', '/landing.html'} or path.startswith('/assets/') and Path(path).suffix in {'.js', '.css'}
        target = (ROOT / path.lstrip('/')).resolve()
        if not allowed or not target.is_relative_to(ROOT) or '/..' in path:
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self): self.api()
    def do_PUT(self): self.api()

    def api(self):
        try:
            with connect() as c:
                # Serialize validation + revision check + write in the same transaction.
                c.execute('BEGIN IMMEDIATE')
                q = {}
                if self.command != 'GET':
                    origin = self.headers.get('Origin')
                    require(not origin or urlsplit(origin).netloc == self.headers.get('Host'), 'Cross-origin write rejected.', 403)
                    require(self.headers.get_content_type() == 'application/json', 'JSON required.', 415)
                    length = int(self.headers.get('Content-Length', 0))
                    require(0 < length <= 8_000_000, 'Request too large or empty.', 413)
                    q = json.loads(self.rfile.read(length))
                    require(isinstance(q, dict), 'Expected an object.')
                path = urlsplit(self.path).path
                if path == '/api/login' and self.command == 'POST':
                    u = c.execute('SELECT * FROM users WHERE username=?', (q.get('username'),)).fetchone()
                    require(u is not None and hmac.compare_digest(u['password'], password_hash(str(q.get('password', '')), u['password'].split(':')[0])), 'Incorrect username or password.', 401)
                    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
                    c.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
                    c.execute('INSERT INTO sessions VALUES(?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), u['id'], csrf, time.time()+28800))
                    c.commit()
                    secure = '; Secure' if os.environ.get('PARISHLIFE_SECURE_COOKIE') == '1' else ''
                    return self.reply(200, {'ok': True}, f'pl_session={token}; HttpOnly; SameSite=Strict; Path=/{secure}')
                cookie = http.cookies.SimpleCookie(self.headers.get('Cookie', ''))
                token = cookie.get('pl_session')
                session = c.execute('SELECT * FROM sessions WHERE token=? AND expires>?', (hashlib.sha256((token.value if token else '').encode()).hexdigest(), time.time())).fetchone()
                require(session is not None, 'Sign in to continue.', 401)
                u = c.execute('SELECT * FROM users WHERE id=?', (session['user_id'],)).fetchone()
                if self.command != 'GET': require(hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), session['csrf']), 'Invalid request token.', 403)
                if path == '/api/session' and self.command == 'GET':
                    return self.reply(200, dict(user={k: u[k] for k in ('id', 'username', 'name', 'role', 'person_id')}, csrf=session['csrf'], parishes=parishes(c, u)))
                if path == '/api/logout' and self.command == 'POST':
                    c.execute('DELETE FROM sessions WHERE token=?', (session['token'],)); c.commit()
                    return self.reply(200, {'ok': True}, 'pl_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/')
                require(u['role'] != 'bishop' or self.command == 'GET', 'Bishop oversight is read-only.', 403)
                if path == '/api/oversight' and self.command == 'GET':
                    return self.reply(200, {'parishes': oversight(c, u)})
                if path == '/api/assignments':
                    require(u['role'] == 'bishop', 'Archdiocese administration is restricted to the bishop.', 403)
                    require(self.command == 'GET', 'Bishop oversight is read-only.', 403)
                    priests = [dict(id=x['id'], name=x['name'], parishes=[r[0] for r in c.execute('SELECT parish_id FROM assignments WHERE user_id=?', (x['id'],))]) for x in c.execute("SELECT * FROM users WHERE role='priest' AND diocese=?", (u['diocese'],)).fetchall()]
                    return self.reply(200, {'priests': priests, 'parishes': parishes(c, u)})
                parts = path.strip('/').split('/')
                require(len(parts) == 4 and parts[:2] == ['api', 'parishes'], 'Endpoint not found.', 404)
                pid, endpoint = parts[2:]; access(c, u, pid)
                if endpoint == 'oversight' and self.command == 'GET':
                    return self.reply(200, oversight(c, u, pid))
                if endpoint == 'state' and self.command == 'GET':
                    row = c.execute('SELECT * FROM states WHERE parish_id=?', (pid,)).fetchone()
                    return self.reply(200, {'revision': row['revision'], 'd': visible(c, u, pid, json.loads(row['data']))})
                if endpoint == 'state' and self.command == 'PUT':
                    revision = save_patch(c, u, pid, q); c.commit()
                    row = c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()
                    return self.reply(200, {'revision': revision, 'd': visible(c, u, pid, json.loads(row['data']))})
                if endpoint == 'workflow' and self.command == 'POST':
                    workflow(c, u, pid, q); c.commit(); return self.reply(200, {'ok': True})
                raise Problem(405, 'Method not allowed.')
        except Problem as e: self.reply(e.status, {'error': e.message})
        except (ValueError, TypeError, KeyError, AttributeError): self.reply(400, {'error': 'Invalid request data.'})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('port', nargs='?', type=int, default=4399)
    parser.add_argument('--create-user')
    parser.add_argument('--assign-user', help='Assign an existing priest account to one or more parishes locally')
    parser.add_argument('--role', choices=sorted(ROLES), default='priest')
    parser.add_argument('--name')
    parser.add_argument('--person-id')
    parser.add_argument('--parish', action='append', default=[])
    args = parser.parse_args(); init_db()
    require(not (args.create_user and args.assign_user), 'Choose one account operation.')
    if args.assign_user:
        require(args.parish, 'Specify at least one --parish.')
        with connect() as c:
            user = c.execute('SELECT id,role,diocese FROM users WHERE username=?', (args.assign_user,)).fetchone()
            require(user is not None and user['role'] == 'priest', 'Choose an existing priest account.')
            for pid in args.parish:
                parish = c.execute('SELECT id FROM parishes WHERE id=? AND diocese=?', (pid, user['diocese'])).fetchone()
                require(parish is not None, 'Choose a parish in the priest’s diocese.')
                c.execute('INSERT OR IGNORE INTO assignments VALUES(?,?)', (user['id'], pid))
        print('Parish assignment saved.'); return
    if args.create_user:
        pw = getpass.getpass('New password (12+ characters): ')
        require(len(pw) >= 12, 'Use at least 12 characters.')
        require(pw == getpass.getpass('Repeat password: '), 'Passwords do not match.')
        with connect() as c:
            uid = secrets.token_hex(12)
            c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)', (uid, args.create_user, args.name or args.create_user, args.role, 'beirut', args.person_id, password_hash(pw)))
            for pid in args.parish: c.execute('INSERT INTO assignments VALUES(?,?)', (uid, pid))
        print('Account created.'); return
    print(f'ParishLife: http://127.0.0.1:{args.port} (Ctrl+C to stop)')
    http.server.ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()


if __name__ == '__main__': main()
