"""ParishLife's same-origin application server. Python 3.11+, standard library only.

Run: python server.py --create-user bishop --role bishop
Then: python server.py 4399
Passwords are prompted, never shipped in source. Database files are not web assets.
"""
import argparse
import base64
import binascii
import copy
import datetime as dt
import getpass
import hashlib
import hmac
import http.cookies
import http.server
import io
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
import zipfile
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit, parse_qs, quote

ROOT = Path(__file__).resolve().parent
DB = ROOT / 'var' / 'parishlife.sqlite3'
GEOGRAPHY = json.loads((ROOT / 'backend' / 'geography.json').read_text(encoding='utf-8'))['governorates']
ROLES = {'bishop', 'priest', 'secretary', 'treasurer', 'leader', 'member'}
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
        detail['belongings'] = [dict(id=f'resource-{gid}-{index+1}', name=item[0], ar=item[1], qty=item[2],
            location=item[3], locationAr=item[4]) if isinstance(item, list) else item
            for index, item in enumerate(detail.get('belongings', []))]
        detail.setdefault('resourceLoans', [])
        detail['milestones'] = [dict(id=f'formation-{gid}-{index+1}', name=item[0], ar=item[1],
            description='', legacyCount=item[2], completions={}) if isinstance(item, list) else item
            for index, item in enumerate(detail.get('milestones', []))]
        for milestone in detail['milestones']:
            milestone.setdefault('completions', {})
            milestone.setdefault('legacyCount', 0)
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
        if s.get('kind') != 'certificate' and not isinstance(s.get('preparation', []), list):
            s['preparation'] = []
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
        CREATE TABLE IF NOT EXISTS member_private(parish_id TEXT NOT NULL REFERENCES parishes(id),
          user_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL, PRIMARY KEY(parish_id,user_id));
        CREATE TABLE IF NOT EXISTS member_content(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id),
          group_id TEXT, kind TEXT NOT NULL, author_id TEXT NOT NULL REFERENCES users(id),
          recipient_id TEXT REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
          event_id TEXT, attachment TEXT, pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS member_replies(id TEXT PRIMARY KEY, content_id TEXT NOT NULL REFERENCES member_content(id),
          author_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS member_concerns(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id),
          reference TEXT UNIQUE NOT NULL, user_id TEXT REFERENCES users(id), category TEXT NOT NULL,
          group_id TEXT, event_id TEXT, subject TEXT NOT NULL, description TEXT NOT NULL,
          happened_at TEXT, people_involved TEXT, attachment TEXT, follow_up TEXT,
          status TEXT NOT NULL, created_at TEXT NOT NULL, assigned_to TEXT REFERENCES users(id));
        CREATE TABLE IF NOT EXISTS member_concern_updates(id TEXT PRIMARY KEY,
          concern_id TEXT NOT NULL REFERENCES member_concerns(id), actor_id TEXT REFERENCES users(id),
          status TEXT NOT NULL, public_text TEXT NOT NULL DEFAULT '', internal_text TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS complaint_audit(id INTEGER PRIMARY KEY,
          concern_id TEXT NOT NULL REFERENCES member_concerns(id), actor_id TEXT REFERENCES users(id),
          action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS complaint_reviewers(parish_id TEXT NOT NULL REFERENCES parishes(id),
          user_id TEXT NOT NULL REFERENCES users(id), permissions TEXT NOT NULL,
          PRIMARY KEY(parish_id,user_id));
        CREATE TABLE IF NOT EXISTS complaint_categories(parish_id TEXT NOT NULL REFERENCES parishes(id),
          name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(parish_id,name));
        CREATE TABLE IF NOT EXISTS member_profile_requests(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id),
          user_id TEXT NOT NULL REFERENCES users(id), field TEXT NOT NULL, requested_value TEXT NOT NULL,
          status TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS member_commitments(parish_id TEXT NOT NULL REFERENCES parishes(id),
          user_id TEXT NOT NULL REFERENCES users(id), content_id TEXT NOT NULL REFERENCES member_content(id),
          status TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(parish_id,user_id,content_id));
        CREATE TABLE IF NOT EXISTS member_rsvp(parish_id TEXT NOT NULL REFERENCES parishes(id),
          user_id TEXT NOT NULL REFERENCES users(id), group_id TEXT NOT NULL, meeting_id TEXT NOT NULL,
          status TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
          PRIMARY KEY(parish_id,user_id,meeting_id));
        CREATE TABLE IF NOT EXISTS member_notifications(id TEXT PRIMARY KEY,
          parish_id TEXT NOT NULL REFERENCES parishes(id), user_id TEXT NOT NULL REFERENCES users(id),
          kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, route TEXT NOT NULL,
          created_at TEXT NOT NULL, read_at TEXT);
        CREATE TABLE IF NOT EXISTS uploaded_files(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id),
          scope TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL,
          size INTEGER NOT NULL, data BLOB NOT NULL, uploaded_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS uploaded_files_owner ON uploaded_files(parish_id,scope,owner_id);
        ''')
        # Keep legacy account IDs for audit/history, but remove the old
        # volunteer-only login and revoke any sessions it already opened.
        c.execute("UPDATE users SET role='disabled' WHERE role='volunteer'")
        c.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role='disabled')")
        if 'assigned_to' not in {row['name'] for row in c.execute('PRAGMA table_info(member_concerns)')}:
            c.execute('ALTER TABLE member_concerns ADD COLUMN assigned_to TEXT REFERENCES users(id)')
        c.execute("INSERT OR IGNORE INTO dioceses VALUES('beirut','Archeparchy of Beirut')")
        seed = json.loads((ROOT / 'backend' / 'seed.json').read_text(encoding='utf-8'))
        for p in seed['PARISHES']:
            c.execute('INSERT OR IGNORE INTO parishes VALUES(?,?,?)', (p['id'], 'beirut', json.dumps(p)))
            for category in CONCERN_CATEGORIES:
                c.execute('INSERT OR IGNORE INTO complaint_categories VALUES(?,?,1)', (p['id'], category))
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


def file_access(c, u, pid, scope, owner_id, write=False):
    require(scope in {'group', 'person'}, 'Invalid file owner.')
    row = c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()
    require(row is not None, 'Parish not found.', 404)
    state = json.loads(row['data'])
    if scope == 'person':
        require(any(person['id'] == owner_id for person in state['PEOPLE'] + state['ARCHIVED']), 'Person not found.', 404)
        require(u['role'] in {'priest', 'secretary'} or not write and u['role'] == 'member' and u['person_id'] == owner_id,
                'Person attachments are restricted.', 403)
    else:
        group = next((item for item in state['GROUPS'] if item['id'] == owner_id), None)
        require(group is not None, 'Group not found.', 404)
        permitted = u['role'] in {'priest', 'secretary'} or u['role'] == 'leader' and u['person_id'] in {group.get('leader'), group.get('assistant')}
        if not write and u['role'] == 'member':
            permitted = any(item.get('p') == u['person_id'] for item in state['GROUP_DETAIL'].get(owner_id, {}).get('roster', []))
        require(permitted, 'Group files are outside your scope.', 403)


def parishes(c, u):
    rows = c.execute('SELECT * FROM parishes WHERE diocese=?', (u['diocese'],)).fetchall()
    assigned = {r[0] for r in c.execute('SELECT parish_id FROM assignments WHERE user_id=?', (u['id'],))}
    role_names = {'bishop': ('Archdiocese oversight', 'إشراف الأبرشية'), 'priest': ('Assigned parish priest', 'كاهن معيّن'),
                  'secretary': ('Parish secretary', 'أمانة سرّ الرعية'), 'treasurer': ('Parish treasurer', 'أمين صندوق الرعية'),
                  'leader': ('Ministry leader', 'مسؤول خدمة'),
                  'member': ('Ministry member', 'عضو خدمة')}
    result = []
    for r in rows:
        if u['role'] != 'bishop' and r['id'] not in assigned: continue
        p = json.loads(r['metadata']); p['role'], p['roleAr'] = role_names[u['role']]
        state = c.execute('SELECT data FROM states WHERE parish_id=?', (r['id'],)).fetchone()
        if state and u['role'] != 'member':
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
            households = {h['id']: h for h in d['HOUSEHOLDS']}
            item['people'] = [dict(id=p['id'], lat=p['lat'], ar=p['ar'], status=p.get('status', ''),
                                   town=p.get('town', ''), townAr=p.get('townAr', ''), rite=p.get('rite', ''),
                                   household={k: households.get(p.get('hh'), {}).get(k, '') for k in ('name', 'ar')},
                                   groups=[dict(id=g['id'], name=g['name'], ar=g.get('ar', '')) for g in d['GROUPS']
                                           if any(r.get('p') == p['id'] for r in d['GROUP_DETAIL'].get(g['id'], {}).get('roster', []))])
                              for p in d['PEOPLE']]
            item['records'] = [dict(id=s['id'], reference=s.get('reg', ''), kind=s['kind'], status=s['status'],
                                    date=s.get('date', ''), personId=s['person'], person=name(s['person']))
                               for s in d['SACRAMENTS']]
            item['events'] = [dict(id=e['id'], title=e.get('title', ''), titleAr=e.get('titleAr', ''), date=e.get('d', e.get('date', '')), time=e.get('time', e.get('t', '')), kind=e.get('kind', ''), venue=e.get('venue', '')) for e in d['EVENTS']]
            item['groups'] = []
            for g in d['GROUPS']:
                detail = d['GROUP_DETAIL'].get(g['id'], {})
                meetings, present, recorded = [], 0, 0
                for m in detail.get('meetings', []):
                    marks = list(m.get('attendance', {}).values())
                    if marks:
                        came = sum(mark == 'present' for mark in marks)
                        marked = sum(mark in {'present', 'absent', 'excused'} for mark in marks)
                    elif m.get('done'):
                        came = int(m.get('present') or 0)
                        marked = came + len(m.get('absent', []))
                    else:
                        came = marked = 0
                    present += came; recorded += marked
                    meetings.append(dict(id=m.get('id', ''), title=m.get('title') or m.get('topic') or g['name'],
                                         date=m.get('d', ''), time=m.get('t', ''), present=came, recorded=marked))
                item['groups'].append(dict(id=g['id'], name=g['name'], ar=g.get('ar', ''),
                                           members=len(detail.get('roster', [])), meetings=meetings,
                                           attendance=dict(present=present, recorded=recorded,
                                                           percentage=round(100 * present / recorded) if recorded else None),
                                           roster=[dict(id=r['p'], **name(r['p'])) for r in detail.get('roster', [])]))
            actors = {r['id']: r['name'] for r in c.execute('SELECT id,name FROM users WHERE diocese=?', (u['diocese'],))}
            item['activity'] = [dict(at=r['at'], action=r['action'], actor=actors.get(r['actor'], 'System'))
                                for r in c.execute('SELECT at,action,actor FROM audit WHERE parish_id=? ORDER BY id DESC LIMIT 50', (pid,))]
        result.append(item)
    require(not pid or result, 'Parish not found in your archdiocese.', 404)
    return result[0] if pid else result


def visible(c, u, pid, d):
    require(u['role'] not in {'bishop', 'member'}, 'Use your dedicated portal.', 403)
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
    if u['role'] == 'leader':
        gs = {g['id'] for g in d['GROUPS'] if g.get('leader') == u['person_id'] or g.get('assistant') == u['person_id']}
        ids = ({u['person_id']}
               | {r['p'] for g in gs for r in d['GROUP_DETAIL'].get(g, {}).get('roster', [])}
               | {member for g in gs for meeting in d['GROUP_DETAIL'].get(g, {}).get('meetings', [])
                   for member in meeting.get('attendance', {})}
               | {member for g in gs for milestone in d['GROUP_DETAIL'].get(g, {}).get('milestones', [])
                   for member in milestone.get('completions', {})}
               | {u['person_id']})
        d['PEOPLE'] = [dict(id=p['id'], lat=p['lat'], ar=p['ar'], tags=[], hh=None, phone='—', born='', status=p['status']) for p in d['PEOPLE'] if p['id'] in ids]
        for k in ('ARCHIVED', 'HOUSEHOLDS', 'SACRAMENTS', 'CORRECTIONS', 'FAMILIES', 'BRANCHES', 'PORTAL_REQUESTS', 'REQUEST_HISTORY'):
            d[k] = []
        d['PERSON_EXTRA'] = {}
        d['GROUPS'] = [g for g in d['GROUPS'] if g['id'] in gs]
        d['GROUP_DETAIL'] = {g: v for g, v in d['GROUP_DETAIL'].items() if g in gs}
        d['VOLUNTEERS'] = [v for v in d['VOLUNTEERS'] if v.get('p') in ids]
        d['ROTA']['teams'] = []
        d['SIGNUP_SHEETS'] = []
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
        if u['role'] == 'leader':
            participant_ids = {row.get('p') for row in d['REGISTRANTS']}
            d['PICKUP'] = {person_id: info for person_id, info in d['PICKUP'].items() if person_id in participant_ids}
        if u['role'] == 'leader':
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
    def iso_date(value):
        if not isinstance(value, str): return False
        try: return dt.date.fromisoformat(value).isoformat() == value
        except ValueError: return False
    def index(key):
        rows = d[key]
        require(isinstance(rows, list) and all(isinstance(x, dict) and isinstance(x.get('id'), str) for x in rows), 'Invalid ' + key)
        result = {x['id']: x for x in rows}
        require(len(result) == len(rows), 'Duplicate IDs in ' + key)
        return result
    pp = {**index('PEOPLE'), **index('ARCHIVED')}
    content = d.get('CONTENT', {})
    require(isinstance(content, dict), 'Invalid parish content.')
    for key, item in content.items():
        require(isinstance(key, str) and len(key) <= 60 and isinstance(item, dict)
                and all(isinstance(item.get(lang, ''), str) and len(item.get(lang, '')) <= 10000 for lang in ('en', 'ar'))
                and isinstance(item.get('published', True), bool), 'Invalid parish content.')
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
        require(isinstance(extra.get('occupation', ''), str) and len(extra.get('occupation', '')) <= 120,
                'Invalid line of work.')
        require(isinstance(extra.get('skills', []), list) and len(extra.get('skills', [])) <= 60 and
                all(isinstance(skill, str) and 0 < len(skill) <= 80 for skill in extra.get('skills', [])),
                'Invalid skills.')
        address = extra.get('address')
        if not isinstance(address, dict) or not any(address.get(k) for k in ('governorate', 'district', 'town', 'sector')):
            continue
        gov = next((g for g in GEOGRAPHY if g['id'] == address.get('governorate')), None)
        district = next((x for x in gov['districts'] if x['id'] == address.get('district')), None) if gov else None
        town = next((x for x in district['towns'] if x['id'] == address.get('town')), None) if district else None
        require(gov and district and town and (not address.get('sector') or
                address['sector'] in {x['id'] for x in town['sectors']}),
                'Choose a valid Governorate, District, Town, and Sector combination.')
    service_ids = set()
    service_stages = {'pending', 'approved', 'preparing', 'ready', 'celebrated', 'rejected'}
    for request in d['SERVICE_REQUESTS']:
        rid = request.get('id')
        require(isinstance(rid, str) and rid and rid not in service_ids, 'Service requests need unique IDs.')
        service_ids.add(rid)
        require(request.get('by') in pp and iso_date(request.get('date'))
                and request.get('status') in service_stages, 'Invalid service request.')
        if request.get('time'):
            require(isinstance(request['time'], str) and re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', request['time']), 'Invalid service time.')
        require(not request.get('venue') or any(v['id'] == request['venue'] for v in d['VENUES']), 'Invalid service venue.')
        require(all(isinstance(request.get(field, ''), str) and len(request.get(field, '')) <= limit
                    for field, limit in (('contact', 160), ('purpose', 240), ('notes', 1000))), 'Invalid service details.')
        documents = request.get('documents', {})
        require(isinstance(documents, dict) and all(isinstance(k, str) and len(k) <= 120 and isinstance(v, bool)
                    for k, v in documents.items()), 'Invalid service documents.')
    for gid, detail in d['GROUP_DETAIL'].items():
        require(gid in gg, 'Group assignments must use an existing parish group.')
        roster = detail.get('roster', [])
        require(all(r.get('p') in pp for r in roster) and len({r['p'] for r in roster}) == len(roster), 'Invalid or duplicate group membership.')
        require(all(isinstance(post, dict) and post.get('by') in pp and
                    isinstance(post.get('body', ''), str) and len(post.get('body', '')) <= 12000 and
                    isinstance(post.get('html', ''), str) and len(post.get('html', '')) <= 12000
                    for post in detail.get('posts', [])), 'Invalid group post.')
        meeting_ids = set()
        for meeting in detail.get('meetings', []):
            mid = meeting.get('id')
            require(isinstance(mid, str) and mid and mid not in meeting_ids, 'Group meetings need unique IDs.')
            meeting_ids.add(mid)
            participants = meeting.get('participants', [])
            require(isinstance(participants, list) and len(participants) == len(set(participants))
                    and set(participants) <= set(pp), 'Meeting participants must be people in this parish.')
            attendance = meeting.get('attendance', {})
            require(isinstance(attendance, dict) and set(attendance) <= set(pp) and
                    all(value in {'present', 'excused', 'absent'} for value in attendance.values()),
                    'Attendance must reference people in this parish and valid statuses.')
        resources = detail.get('belongings', [])
        require(isinstance(resources, list) and all(isinstance(r, dict) and isinstance(r.get('id'), str)
                and r.get('id') and isinstance(r.get('name'), str) and r['name'].strip()
                and isinstance(r.get('qty'), int) and r['qty'] >= 0
                and all(isinstance(r.get(field, ''), str) and len(r.get(field, '')) <= limit
                        for field, limit in (('ar', 200), ('code', 80), ('description', 500),
                                             ('location', 200), ('locationAr', 200)))
                and r.get('condition', 'good') in {'good', 'fair', 'repair', 'damaged'} for r in resources)
                and len({r['id'] for r in resources}) == len(resources), 'Invalid ministry resources.')
        resource_ids = {r['id'] for r in resources}
        loans = detail.get('resourceLoans', [])
        require(isinstance(loans, list) and all(isinstance(l, dict) and isinstance(l.get('id'), str) and l['id']
                and l.get('resourceId') in resource_ids
                and isinstance(l.get('borrower'), str) and l['borrower'].strip()
                and isinstance(l.get('qty'), int) and l['qty'] > 0
                and iso_date(l.get('due')) and iso_date(l.get('checkedOutAt'))
                and l['due'] >= l['checkedOutAt'] and (not l.get('returnedAt') or iso_date(l['returnedAt']))
                for l in loans) and len({l['id'] for l in loans}) == len(loans),
                'Invalid ministry resource loan.')
        for resource in resources:
            require(sum(l['qty'] for l in loans if l['resourceId'] == resource['id'] and not l.get('returnedAt'))
                    <= resource['qty'], 'A ministry resource cannot be loaned beyond its quantity.')
        milestones = detail.get('milestones', [])
        require(isinstance(milestones, list) and all(isinstance(m, dict) and isinstance(m.get('id'), str)
                and m.get('id') and isinstance(m.get('name'), str) and m['name'].strip()
                and isinstance(m.get('completions'), dict) and set(m['completions']) <= set(pp)
                and all(isinstance(record, dict) and iso_date(record.get('date'))
                        and isinstance(record.get('notes', ''), str) for record in m['completions'].values())
                and isinstance(m.get('legacyCount', 0), int) and m.get('legacyCount', 0) >= 0
                for m in milestones) and len({m['id'] for m in milestones}) == len(milestones),
                'Invalid ministry formation milestone.')
        for meeting in detail.get('meetings', []):
            hymn_ids = meeting.get('hymns', [])
            require(isinstance(hymn_ids, list) and all(isinstance(mid, str) for mid in hymn_ids)
                    and len(set(hymn_ids)) == len(hymn_ids)
                    and set(hymn_ids) <= {item['id'] for item in d['MUSIC']}, 'Meeting music must use hymns in the library.')
    for hymn in d['MUSIC']:
        for field, hosts in (('youtubeUrl', {'youtube.com', 'youtu.be'}),
                             ('anghamiUrl', {'anghami.com'}), ('otherUrl', None)):
            value = hymn.get(field, '')
            if not value: continue
            require(isinstance(value, str), 'Invalid music link.')
            try: url = urlsplit(value)
            except ValueError: raise Problem('Invalid music link.')
            hostname = (url.hostname or '').lower()
            require(url.scheme == 'https' and hostname and not url.username and not url.password
                    and (hosts is None or any(hostname == host or hostname.endswith('.' + host) for host in hosts)),
                    'Music links must use HTTPS and the selected provider.')
    volunteer_ids = {v.get('p') for v in d['VOLUNTEERS']}
    for notice in d['NOTICES']:
        require(not notice.get('groupId') or notice['groupId'] in gg, 'Notice group must exist in this parish.')
    for sheet in d['SIGNUP_SHEETS']:
        participants = sheet.get('people', [])
        require(isinstance(participants, list) and len(participants) == len(set(participants))
                and set(participants) <= volunteer_ids
                and isinstance(sheet.get('slots'), int) and sheet['slots'] > 0
                and isinstance(sheet.get('taken'), int) and len(participants) <= sheet['taken'] <= sheet['slots'],
                'Sign-up sheet participants and capacity are invalid.')
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
    registrant_ids = set()
    for row in d['REGISTRANTS']:
        require(isinstance(row.get('id'), str) and row['id'] not in registrant_ids and row.get('p') in pp
                and isinstance(row.get('paid', 0), (int, float)) and not isinstance(row.get('paid', 0), bool)
                and 0 <= row.get('paid', 0) <= 1_000_000 and isinstance(row.get('consent', False), bool)
                and row.get('status') in {'awaiting-approval', 'pending', 'paid', 'registered', 'cancelled'},
                'Invalid participant registration.')
        registrant_ids.add(row['id'])
        payments = row.get('payments', [])
        require(isinstance(payments, list) and all(isinstance(payment, dict)
                and isinstance(payment.get('amount'), (int, float)) and not isinstance(payment.get('amount'), bool)
                and 0 < payment['amount'] <= 1_000_000 and payment.get('method') in {'cash', 'bank', 'omt'}
                and isinstance(payment.get('at'), str) and isinstance(payment.get('by'), str)
                for payment in payments), 'Invalid registration payment history.')
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
    if role in {'bishop', 'member'}: return False
    if key in READONLY: return False
    if role in CLERGY: return True
    if key in {'NOTIFICATIONS', 'PREFS'}: return True
    if role == 'secretary': return key in OFFICE
    if role == 'treasurer': return key in FINANCE | {'RATE'}
    if role == 'leader': return key in {'GROUP_DETAIL', 'MUSIC', 'MUSIC_DETAIL', 'SETLISTS', 'CHECKIN', 'PICKUP'}
    return False


def save_patch(c, u, pid, payload):
    access(c, u, pid)
    require(u['role'] not in {'bishop', 'member'}, 'Parish staff access required.', 403)
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
        elif key == 'CHECKIN' and u['role'] == 'leader':
            scoped = visible(c, u, pid, old)
            permitted = set(scoped['CHECKIN'].get('sessions', {})) | {form.get('eventId') for form in scoped['REGISTRATIONS']}
            require(set(value.get('sessions', {})) <= permitted, 'Event is outside your check-in scope.', 403)
            for event_id, event_session in value.get('sessions', {}).items():
                d['CHECKIN']['sessions'][event_id] = event_session
        elif key == 'PICKUP' and u['role'] == 'leader':
            scoped = visible(c, u, pid, old)
            permitted = {row.get('p') for row in scoped['REGISTRANTS']}
            require(set(value) <= permitted, 'Person is outside your check-in scope.', 403)
            for person_id, info in value.items():
                previous = old['PICKUP'].get(person_id, {})
                require(info.get('restricted', []) == previous.get('restricted', []), 'A leader cannot change pickup restrictions.', 403)
                require(not info.get('restricted') or info.get('required') is not False, 'Restricted pickup remains required.', 403)
                d['PICKUP'][person_id] = info
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
    previous_registrants = {registrant['id']: registrant for registrant in old['REGISTRANTS']}
    current_forms = {form['id']: form for form in d['REGISTRATIONS']}
    added_by_form = {}
    for registrant in d['REGISTRANTS']:
        before_registrant = previous_registrants.get(registrant['id'])
        if before_registrant is None:
            require(registrant.get('registrationId'), 'Select a registration form before adding participants.')
            form = current_forms.get(registrant['registrationId'])
            require(form is not None and form.get('eventId') and form.get('open'),
                    'New participants require an open registration form linked to an event.')
            require(registrant.get('paid', 0) == 0 and registrant.get('status') in {'pending', 'registered'}
                    and (registrant.get('status') != 'registered' or registrant.get('consent'))
                    and not registrant.get('payments'), 'New participant status is inconsistent.')
            added_by_form[form['id']] = added_by_form.get(form['id'], 0) + 1
            require(not any(other is not registrant and other.get('p') == registrant.get('p') and
                            current_forms.get(other.get('registrationId'), {}).get('eventId') == form['eventId']
                            for other in d['REGISTRANTS']), 'This person is already registered for that event.')
        else:
            require(registrant.get('p') == before_registrant.get('p') and
                    registrant.get('registrationId') == before_registrant.get('registrationId'),
                    'An existing registration cannot change its person or event.')
            previous_status, current_status = before_registrant.get('status'), registrant.get('status')
            if current_status != previous_status:
                allowed = {'awaiting-approval': {'pending'}, 'pending': {'registered'}, 'paid': {'registered'}}
                require(current_status in allowed.get(previous_status, set()), 'Invalid registration progression.')
                require(current_status != 'registered' or registrant.get('consent'),
                        'Consent is required before confirming a place.')
            require(not before_registrant.get('consent') or registrant.get('consent'),
                    'Received consent cannot be silently removed.')
            old_payments, payments = before_registrant.get('payments', []), registrant.get('payments', [])
            require(isinstance(payments, list) and payments[:len(old_payments)] == old_payments,
                    'Registration payment history is immutable.')
            added_payments = payments[len(old_payments):]
            require(len(added_payments) <= 1 and all(item.get('by') == u['id'] for item in added_payments)
                    and abs(float(registrant.get('paid', 0)) - float(before_registrant.get('paid', 0))
                            - sum(item['amount'] for item in added_payments)) < 0.001,
                    'Payment changes require a matching audit entry.')
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
                previous_participants = set(earlier.get(meeting.get('id'), {}).get('participants', []))
                added_participants = set(meeting.get('participants', [])) - previous_participants
                require(added_participants <= current_members, 'New meeting participants must be current group members.')
            earlier_milestones = {item.get('id'): item for item in old['GROUP_DETAIL'].get(gid, {}).get('milestones', [])}
            for item in detail.get('milestones', []):
                previous_ids = set(earlier_milestones.get(item.get('id'), {}).get('completions', {}))
                added_ids = set(item.get('completions', {})) - previous_ids
                require(added_ids <= current_members, 'New formation completions require current group members.')
    # Register lifecycle and immutable history only change through the workflow API.
    previous = {s['id']: s for s in old['SACRAMENTS']}
    current = {s['id']: s for s in d['SACRAMENTS']}
    require(previous.keys() <= current.keys(), 'Register entries cannot be deleted.')
    for sid, s in current.items():
        if sid in previous:
            require(s == previous[sid], 'Use the approval or correction workflow to change a register entry.')
        else:
            require(s.get('kind') == 'certificate' and s.get('status') in {'draft', 'scheduled', 'awaiting-signature'},
                    'Create sacrament requests through the review process.')
            require(not any(s.get(k) for k in PROTECTED - {'status', 'revision'}), 'Approval metadata is server-managed.')
            if s.get('kind') == 'certificate':
                source = previous.get(s.get('sourceRecordId'))
                require(source is not None and source['kind'] != 'certificate' and source['person'] == s.get('person')
                        and source['status'] in {'registered', 'issued'}, 'Choose an official register entry for the certificate request.')
            s.update(history=[], revision=1)
    earlier_services = {item['id']: item for item in old['SERVICE_REQUESTS']}
    next_service = {'pending': {'approved', 'rejected'}, 'approved': {'preparing'},
                    'preparing': {'ready'}, 'ready': {'celebrated'}}
    for request in d['SERVICE_REQUESTS']:
        before = earlier_services.get(request['id'])
        if before is None:
            require(request['status'] == 'pending' and request.get('by') and request.get('time')
                    and request.get('contact', '').strip() and request.get('purpose', '').strip(),
                    'New service requests need a requester, date, time, contact, and purpose.')
            require(not request.get('history'), 'New service requests cannot contain approval history.')
        else:
            require(request.get('history', []) == before.get('history', []) or
                    before.get('status') != request.get('status'), 'Service approval history is immutable.')
        if before and before.get('status') != request.get('status'):
            require(request['status'] in next_service.get(before['status'], set()), 'Invalid service request progression.')
            require(u['role'] in CLERGY, 'Priest approval is required.', 403)
            history = request.get('history', [])
            require(isinstance(history, list) and len(history) == len(before.get('history', [])) + 1
                    and history[:-1] == before.get('history', []) and history[-1].get('status') == request['status']
                    and history[-1].get('by') == u.get('person_id'), 'Service transition requires an audit entry.')
            if request['status'] == 'ready' and request.get('kind', '').lower() in {'baptism', 'wedding'}:
                required = ('Parents’ marriage certificate', 'Godparent baptism certificate', 'Preparation session attended') if request['kind'].lower() == 'baptism' else ('Baptism certificates, both', 'Freedom-to-marry declaration', 'Pre-marriage course', 'Civil file reference')
                require(all(request.get('documents', {}).get(item) for item in required), 'Complete the missing preparation requirements first.')
            if request['status'] == 'celebrated':
                require(iso_date(request.get('celebratedAt')) and request['celebratedAt'] <= TODAY(),
                        'Record the actual celebration date, today or earlier.')
    if u['role'] == 'leader' and 'GROUP_DETAIL' in changes:
        for group in d['GROUPS']:
            gid = group['id']
            if gid in changes['GROUP_DETAIL']:
                before_count = len(old['GROUP_DETAIL'].get(gid, {}).get('roster', []))
                after_count = len(d['GROUP_DETAIL'].get(gid, {}).get('roster', []))
                group['members'] = max(0, int(group.get('members', 0)) + after_count - before_count)
    former_groups = {item['id']: item for item in old['GROUPS']}
    role_changes = []
    for group in d['GROUPS']:
        former = former_groups.get(group['id'])
        if not former: continue
        for field in ('leader', 'assistant'):
            if former.get(field) == group.get(field): continue
            require(u['role'] in CLERGY | {'secretary'}, 'Parish office approval is required for leadership changes.', 403)
            detail = d['GROUP_DETAIL'].get(group['id'], {})
            require(not group.get(field) or group[field] in {row.get('p') for row in detail.get('roster', [])},
                    'Leader and assistant must be in the group roster.')
            if field == 'leader':
                require(group.get('leader'), 'A group needs a leader.')
                require(detail.get('history', []) != old['GROUP_DETAIL'].get(group['id'], {}).get('history', []),
                        'Record a leadership handover in the group history.')
            role_changes.append((field, group['id'], former.get(field), group.get(field)))
    if u['role'] not in CLERGY:
        for key in ('RESERVATIONS', 'EXPENSES', 'SERVICE_REQUESTS'):
            before = {x['id']: x for x in old[key]}
            for x in d[key]:
                if x.get('status') in {'approved', 'preparing', 'ready', 'celebrated', 'rejected'}:
                    require(x['id'] in before and before[x['id']].get('status') == x['status'], 'Priest approval is required.', 403)
    d = migrate_state(d)
    validate(d)
    sync_relationships(c, pid, d)
    for field, group_id, outgoing, incoming in role_changes:
        if incoming:
            c.execute("UPDATE users SET role='leader' WHERE role='member' AND person_id=? AND id IN (SELECT user_id FROM assignments WHERE parish_id=?)", (incoming, pid))
        for account in c.execute("SELECT * FROM users WHERE role='leader' AND person_id=? AND id IN (SELECT user_id FROM assignments WHERE parish_id=?)", (outgoing, pid)).fetchall():
            other_leadership = False
            for parish_row in c.execute('SELECT parish_id FROM assignments WHERE user_id=?', (account['id'],)):
                state = d if parish_row['parish_id'] == pid else json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (parish_row['parish_id'],)).fetchone()['data'])
                if any(account['person_id'] in {item.get('leader'), item.get('assistant')} for item in state['GROUPS']):
                    other_leadership = True; break
            if not other_leadership: c.execute("UPDATE users SET role='member' WHERE id=?", (account['id'],))
        audit(c, u, pid, 'Leadership handover' if field == 'leader' else 'Group assistant changed',
              {'group': group_id, 'from': outgoing, 'to': incoming})
    c.execute('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', (json.dumps(d), pid))
    if 'GROUP_DETAIL' in changes:
        notify_meeting_changes(c, pid, old, d)
    audit(c, u, pid, 'Records updated', {'collections': list(changes)})
    return row['revision'] + 1


def audit(c, u, pid, action, detail):
    c.execute('INSERT INTO audit(parish_id,actor,at,action,detail) VALUES(?,?,?,?,?)', (pid, u['id'], NOW(), action, json.dumps(detail)))


def xlsx_preview(encoded):
    """Read cells from the first worksheet; never store uploaded workbook bytes."""
    require(isinstance(encoded, str) and len(encoded) <= 3_000_000, 'Workbook is too large.', 413)
    try:
        raw = base64.b64decode(encoded, validate=True)
        require(len(raw) <= 2_000_000, 'Workbook is too large.', 413)
        with zipfile.ZipFile(io.BytesIO(raw)) as workbook:
            names = workbook.namelist()
            require(len(names) <= 150 and all(info.file_size <= 4_000_000 for info in workbook.infolist()),
                    'Workbook is too large.', 413)
            sheets = sorted(name for name in names if re.fullmatch(r'xl/worksheets/sheet\d+\.xml', name))
            require(sheets, 'No worksheet found.')
            ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
            shared = []
            if 'xl/sharedStrings.xml' in names:
                root = ET.fromstring(workbook.read('xl/sharedStrings.xml'))
                shared = [''.join(node.itertext()) for node in root.findall(f'{ns}si')]
            root = ET.fromstring(workbook.read(sheets[0]))
            rows = []
            for node in root.findall(f'.//{ns}sheetData/{ns}row')[:2001]:
                cells = {}
                for cell in node.findall(f'{ns}c'):
                    match = re.match(r'([A-Z]+)', cell.get('r', ''))
                    if not match: continue
                    col = 0
                    for char in match.group(1): col = col * 26 + ord(char) - 64
                    if col > 32: continue
                    value = cell.find(f'{ns}v')
                    if cell.get('t') == 'inlineStr':
                        inline = cell.find(f'{ns}is')
                        text = ''.join(inline.itertext()) if inline is not None else ''
                    elif value is None: text = ''
                    elif cell.get('t') == 's':
                        index = int(value.text or '-1')
                        text = shared[index] if 0 <= index < len(shared) else ''
                    else: text = value.text or ''
                    cells[col - 1] = text.strip()[:500]
                if cells: rows.append([cells.get(i, '') for i in range(max(cells) + 1)])
            require(rows, 'The worksheet is empty.')
            return rows
    except (binascii.Error, zipfile.BadZipFile, ET.ParseError, IndexError, ValueError):
        raise Problem(400, 'Invalid .xlsx workbook.')


def workflow(c, u, pid, q):
    access(c, u, pid)
    require(u['role'] in CLERGY | {'secretary'}, 'Office access required.', 403)
    row = c.execute('SELECT * FROM states WHERE parish_id=?', (pid,)).fetchone()
    require(q.get('revision') == row['revision'], 'Record changed. Reload before continuing.', 409)
    d = json.loads(row['data']); action = q.get('action'); sid = q.get('id')
    s = next((s for s in d['SACRAMENTS'] if s['id'] == sid), None)
    at = NOW()
    if action == 'create-sacrament-request':
        require(s is None and isinstance(sid, str) and sid.startswith('sc') and len(sid) <= 48,
                'Choose a unique request reference.')
        require(q.get('kind') in {'baptism', 'confirmation', 'communion', 'marriage', 'funeral'},
                'Choose a sacrament.')
        child = q.get('child')
        if child is not None:
            require(q['kind'] == 'baptism' and isinstance(child, dict), 'Manual child details are for baptism requests only.')
            require(all(isinstance(child.get(k), str) and 0 < len(child[k].strip()) <= 120 for k in ('lat', 'ar')),
                    'Enter the child’s English and Arabic names.')
            born = child.get('born')
            try: require(isinstance(born, str) and dt.date.fromisoformat(born) <= dt.date.today(), 'Enter a valid birth date.')
            except ValueError: raise Problem(400, 'Enter a valid birth date.')
            for key in ('father', 'mother'):
                require(isinstance(child.get(key, ''), str) and len(child.get(key, '')) <= 120, 'Parent name is too long.')
            require(not any(p['lat'].strip().casefold() == child['lat'].strip().casefold() and p.get('born') == born
                            for p in d['PEOPLE'] + d['ARCHIVED']), 'A person with this name and birth date already exists. Choose the existing record.')
            person_id = 'p' + secrets.token_hex(8)
            d['PEOPLE'].append(dict(id=person_id, lat=child['lat'].strip(), ar=child['ar'].strip(), born=born,
                                    phone='—', town='', townAr='', rite='Maronite', status='member', hh=None, tags=[]))
            d['PERSON_EXTRA'][person_id] = dict(skills=[], dates=[], occupation='')
        else:
            person_id = q.get('person')
            require(any(p['id'] == person_id for p in d['PEOPLE']), 'Choose a parishioner.')
        require(not any(x['id'] == sid for x in d['SACRAMENTS']), 'Request already exists.')
        requested_date = str(q.get('date') or '').strip()
        if requested_date:
            try: dt.date.fromisoformat(requested_date)
            except ValueError: raise Problem(400, 'Enter a valid preferred date.')
        notes = str(q.get('notes') or '').strip()
        require(len(notes) <= 500, 'Keep request notes within 500 characters.')
        prefix = f'SRQ/{TODAY()[:4]}/'
        number = max([int(x['reg'][len(prefix):]) for x in d['SACRAMENTS']
                      if str(x.get('reg', '')).startswith(prefix) and str(x['reg'][len(prefix):]).isdigit()] or [0]) + 1
        d['SACRAMENTS'].insert(0, dict(id=sid, kind=q['kind'], reg=f'{prefix}{number:03d}',
            person=person_id, father=child.get('father', '').strip() if child else '', mother=child.get('mother', '').strip() if child else '',
            date=requested_date, requestedDate=requested_date, requestedAt=at, requestNotes=notes,
            status='requested', preparation=[], history=[dict(action='sacrament requested', by=u['name'], at=at)], revision=1))
    elif action == 'review-sacrament-request':
        require(s is not None and s.get('kind') != 'certificate' and s['status'] == 'requested',
                'Only a new sacrament request can be reviewed by the office.')
        s['status'] = 'office-reviewed'
        s.setdefault('history', []).append(dict(action='office review completed', by=u['name'], at=at))
    elif action == 'approve-sacrament-request':
        require(u['role'] in CLERGY, 'Only a priest can accept a sacrament request.', 403)
        require(s is not None and s.get('kind') != 'certificate' and s['status'] in {'requested', 'office-reviewed'},
                'This request is no longer awaiting priest approval.')
        s['status'] = 'preparing'
        s.update(requestApprovedBy=u['name'], requestApprovedAt=at)
        s.setdefault('history', []).append(dict(action='request accepted for preparation', by=u['name'], at=at))
    elif action == 'decline-sacrament-request':
        require(u['role'] in CLERGY, 'Only a priest can decline a sacrament request.', 403)
        require(s is not None and s.get('kind') != 'certificate' and s['status'] in {'requested', 'office-reviewed'},
                'This request is no longer awaiting priest approval.')
        reason = str(q.get('reason') or '').strip()
        require(0 < len(reason) <= 500, 'Enter a reason for declining this request.')
        s['status'] = 'rejected'
        s.setdefault('history', []).append(dict(action='request declined', by=u['name'], at=at, reason=reason))
    elif action == 'propose-request-amendment':
        require(s is not None and s.get('kind') != 'certificate' and s.get('requestApprovedAt')
                and s['status'] in {'preparing', 'scheduled', 'draft', 'awaiting-signature'},
                'Only an accepted sacrament request can be amended.')
        require(not s.get('pendingAmendment'), 'Review the pending amendment first.')
        date = q.get('date', '')
        require(isinstance(date, str), 'Invalid requested date.')
        if date:
            try: dt.date.fromisoformat(date)
            except ValueError: raise Problem(400, 'Enter a valid requested date.')
        notes, reason = q.get('notes', ''), q.get('reason', '')
        require(isinstance(notes, str) and len(notes) <= 500 and isinstance(reason, str)
                and 0 < len(reason.strip()) <= 500, 'Enter an amendment reason and keep notes within 500 characters.')
        require(date != s.get('requestedDate', '') or notes.strip() != s.get('requestNotes', ''), 'No request details changed.')
        s['pendingAmendment'] = dict(date=date, notes=notes.strip(), reason=reason.strip(), by=u['name'], at=at)
        s.setdefault('history', []).append(dict(action='request amendment proposed', by=u['name'], at=at, reason=reason.strip()))
    elif action in {'approve-request-amendment', 'reject-request-amendment'}:
        require(u['role'] in CLERGY, 'Only a priest can decide a request amendment.', 403)
        require(s is not None and s.get('pendingAmendment'), 'There is no pending amendment.')
        amendment = s.pop('pendingAmendment')
        if action == 'approve-request-amendment':
            before = dict(date=s.get('requestedDate', ''), notes=s.get('requestNotes', ''))
            s.update(requestedDate=amendment['date'], requestNotes=amendment['notes'])
            s.setdefault('history', []).append(dict(action='request amendment approved', by=u['name'], at=at,
                                                      reason=amendment['reason'], before=before,
                                                      after=dict(date=amendment['date'], notes=amendment['notes'])))
        else:
            s.setdefault('history', []).append(dict(action='request amendment rejected', by=u['name'], at=at,
                                                      reason=str(q.get('reason') or '')[:500]))
    elif action == 'update-preparation':
        require(s is not None and s.get('kind') != 'certificate' and s['status'] in {'preparing', 'scheduled'},
                'Only accepted preparations can be edited.')
        checklist = q.get('checklist')
        requirements = d.get('PREP_REQUIREMENTS', {}).get(s['kind'], [])
        require(isinstance(checklist, list) and len(checklist) == len(requirements)
                and all(type(value) is bool for value in checklist), 'Complete the preparation checklist.')
        date = str(q.get('date') or '').strip()
        if date:
            try: dt.date.fromisoformat(date)
            except ValueError: raise Problem(400, 'Enter a valid celebration date.')
        s['date'] = date
        s['preparation'] = checklist
        if s['status'] == 'scheduled' and (not date or any(not checklist[index] for index, item in enumerate(requirements) if item[2])):
            s['status'] = 'preparing'
        s['revision'] = s.get('revision', 1) + 1
        s.setdefault('history', []).append(dict(action='preparation updated', by=u['name'], at=at))
    elif action == 'complete-preparation':
        require(s is not None and s.get('kind') != 'certificate' and s['status'] == 'preparing',
                'Only active preparation can be completed.')
        requirements = d.get('PREP_REQUIREMENTS', {}).get(s['kind'], [])
        require(bool(s.get('date')) and len(s.get('preparation', [])) == len(requirements)
                and all(s['preparation'][index] for index, item in enumerate(requirements) if item[2]),
                'Set a celebration date and complete every required preparation item.')
        s['status'] = 'scheduled'
        s.setdefault('history', []).append(dict(action='preparation completed', by=u['name'], at=at))
    elif action == 'cancel-preparation':
        require(s is not None and s.get('kind') != 'certificate' and s['status'] in {'preparing', 'scheduled'},
                'Only active preparation can be cancelled.')
        reason = str(q.get('reason') or '').strip()
        require(0 < len(reason) <= 500, 'Enter a cancellation reason.')
        s['status'] = 'cancelled'
        s.setdefault('history', []).append(dict(action='preparation cancelled', by=u['name'], at=at, reason=reason))
    elif action == 'update-entry':
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
        # Editing the plan must not silently mark an uncelebrated sacrament as celebrated.
        s['status'] = 'scheduled' if s['status'] == 'scheduled' or str(s['date'])[:10] > TODAY() else 'draft'
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
                    and planned['status'] in {'requested', 'office-reviewed', 'preparing', 'draft', 'scheduled', 'awaiting-signature'},
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
                    if action == 'approve' and s.get('kind') != 'certificate' and s['reg'].startswith('SRQ/'):
                        prefixes = {'baptism': 'B', 'confirmation': 'K', 'communion': 'C', 'marriage': 'M', 'funeral': 'F'}
                        prefix = f"{prefixes[s['kind']]}/{str(s['date'])[:4]}/"
                        number = max([int(x['reg'][len(prefix):]) for x in d['SACRAMENTS']
                                      if str(x.get('reg', '')).startswith(prefix) and str(x['reg'][len(prefix):]).isdigit()] or [0]) + 1
                        s['requestReference'] = s['reg']
                        s['reg'] = f'{prefix}{number:03d}'
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


CONCERN_CATEGORIES = {'Ministry activities', 'Leadership', 'Meetings', 'Events', 'Facilities',
    'Behaviour or conduct', 'Safety', 'Communication', 'Financial concerns',
    'Harassment or inappropriate behaviour', 'Administrative issues', 'Suggestions', 'Other'}
CONCERN_STATUSES = {'Submitted', 'Under Review', 'Additional Information Requested', 'Referred', 'Resolved', 'Closed'}
SENSITIVE_CONCERNS = {'Leadership', 'Behaviour or conduct', 'Safety', 'Financial concerns',
                      'Harassment or inappropriate behaviour'}


def sensitive_concern(category):
    # New categories are restricted until a category-specific policy is available.
    return category in SENSITIVE_CONCERNS or category not in CONCERN_CATEGORIES


def complaint_log(c, concern_id, actor_id, action, detail=''):
    c.execute('INSERT INTO complaint_audit(concern_id,actor_id,action,detail,created_at) VALUES(?,?,?,?,?)',
              (concern_id, actor_id, action, detail, NOW()))


def member_context(c, u, pid):
    access(c, u, pid)
    require(u['role'] != 'bishop', 'This portal is not available to a bishop account.', 403)
    d = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()['data'])
    person = next((p for p in d['PEOPLE'] if p['id'] == u['person_id']), None) if u['person_id'] else None
    if u['role'] == 'member':
        require(person is not None, 'Your person record is not active in this parish.', 403)
    else:
        person = person or {'id': '', 'lat': u['name']}
    gids = {g['id'] for g in d['GROUPS'] if any(r.get('p') == u['person_id']
            for r in d['GROUP_DETAIL'].get(g['id'], {}).get('roster', []))}
    return d, person, gids


def member_private(c, u, pid):
    row = c.execute('SELECT data FROM member_private WHERE parish_id=? AND user_id=?', (pid, u['id'])).fetchone()
    data = json.loads(row['data']) if row else {}
    for key, default in (('notes', []), ('todos', []), ('concernIds', []), ('rsvp', {}), ('commitments', {}), ('readIds', []), ('archivedIds', []),
                         ('preferences', {'email': True, 'inSystem': True, 'meetings': True,
                                          'announcements': True, 'messages': True})):
        data.setdefault(key, default)
    return data


def save_member_private(c, u, pid, data):
    c.execute('INSERT INTO member_private VALUES(?,?,?) ON CONFLICT(parish_id,user_id) DO UPDATE SET data=excluded.data',
              (pid, u['id'], json.dumps(data, ensure_ascii=False)))


def notify_member(c, pid, user_id, kind, title, body, route):
    row = c.execute('SELECT data FROM member_private WHERE parish_id=? AND user_id=?', (pid, user_id)).fetchone()
    prefs = json.loads(row['data']).get('preferences', {}) if row else {}
    if prefs.get('inSystem', True) is False: return
    if kind == 'announcement' and prefs.get('announcements', True) is False: return
    if kind == 'message' and prefs.get('messages', True) is False: return
    c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,?)',
              (secrets.token_hex(12), pid, user_id, kind, title, body[:300], route, NOW(), None))


def notify_meeting_changes(c, pid, old, current):
    accounts = {}
    for row in c.execute(
        "SELECT u.id,u.person_id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.role='member'",
        (pid,)):
        if row['person_id']: accounts.setdefault(row['person_id'], []).append(row['id'])
    if not accounts: return
    for group in current['GROUPS']:
        gid = group['id']
        before = {m['id']: m for m in old['GROUP_DETAIL'].get(gid, {}).get('meetings', [])}
        after = {m['id']: m for m in current['GROUP_DETAIL'].get(gid, {}).get('meetings', [])}
        members = {r.get('p') for r in current['GROUP_DETAIL'].get(gid, {}).get('roster', [])}
        for mid in before.keys() | after.keys():
            previous, meeting = before.get(mid), after.get(mid)
            if previous == meeting: continue
            subject = meeting or previous
            if not subject: continue
            title = subject.get('title') or group['name'] + ' meeting'
            details = (subject.get('d', '') + ' ' + subject.get('t', '')).strip()
            invitees = set(subject.get('participants') or members) & members
            for person_id in invitees:
                for user_id in accounts.get(person_id, []):
                    preferences = member_private(c, {'id': user_id}, pid)['preferences']
                    if subject.get('d', '') >= TODAY() and preferences.get('meetings', True):
                        if meeting is None:
                            notify_member(c, pid, user_id, 'meeting', 'Meeting cancelled: ' + title, details, 'mymeetings')
                        elif previous is None:
                            notify_member(c, pid, user_id, 'meeting', 'New meeting: ' + title, details, 'mymeetings')
                        elif any(previous.get(k) != meeting.get(k) for k in ('title', 'd', 't', 'place', 'location', 'description')):
                            notify_member(c, pid, user_id, 'meeting', 'Meeting changed: ' + title, details, 'mymeetings')
                    old_attendance = (previous or {}).get('attendance', {}).get(person_id)
                    new_attendance = (meeting or {}).get('attendance', {}).get(person_id)
                    if old_attendance != new_attendance and new_attendance:
                        notify_member(c, pid, user_id, 'attendance', 'Attendance recorded: ' + title,
                                      str(new_attendance), 'myattendance')


def ensure_member_reminders(c, pid, u, meetings, private):
    prefs = private['preferences']
    if not prefs.get('inSystem', True) or not prefs.get('meetings', True): return
    today = dt.date.today()
    for meeting in meetings:
        if meeting['attendance'] not in {'upcoming', 'unrecorded'} or meeting['rsvp'].get('status') == 'no': continue
        try: meeting_date = dt.date.fromisoformat(meeting['date'])
        except (ValueError, TypeError): continue
        if not 0 <= (meeting_date - today).days <= 1: continue
        if meeting_date == today and meeting['time'] and meeting['time'] < dt.datetime.now().strftime('%H:%M'): continue
        key = hashlib.sha256(f"{pid}:{u['id']}:{meeting['id']}:{meeting['date']}".encode()).hexdigest()[:24]
        c.execute('INSERT OR IGNORE INTO member_notifications VALUES(?,?,?,?,?,?,?,?,?)',
                  ('reminder-' + key, pid, u['id'], 'meeting-reminder',
                   'Upcoming meeting: ' + meeting['title'],
                   (meeting['group'] + ' · ' + meeting['date'] + ' ' + meeting['time']).strip(),
                   'mymeetings', NOW(), None))


def member_groups(d, gids):
    return [dict(id=g['id'], name=g['name'], ar=g.get('ar', ''), category=g.get('cat', ''),
                 position=next((r.get('role') for r in d['GROUP_DETAIL'].get(g['id'], {}).get('roster', [])
                                if r.get('p') == d.get('_viewer')),
                               'Leader' if g.get('leader') == d.get('_viewer') else
                               'Assistant' if g.get('assistant') == d.get('_viewer') else 'Member'))
            for g in d['GROUPS'] if g['id'] in gids]


def member_meetings(d, gids, person_id, private):
    people = {p['id']: p for p in d['PEOPLE']}
    result = []
    for g in d['GROUPS']:
        if g['id'] not in gids: continue
        for m in d['GROUP_DETAIL'].get(g['id'], {}).get('meetings', []):
            if m.get('participants') and person_id not in m['participants']: continue
            attendance = m.get('attendance', {}).get(person_id)
            if not attendance:
                attendance = 'excused' if any(row and row[0] == person_id for row in m.get('absent', [])) else ('unrecorded' if m.get('done') else 'upcoming')
            result.append(dict(id=m['id'], groupId=g['id'], group=g['name'], title=m.get('title') or g['name'] + ' meeting',
                               date=m.get('d', ''), time=m.get('t', ''), location=m.get('place') or m.get('location', ''),
                               description=m.get('description', ''), organizer=people.get(g.get('leader'), {}).get('lat', ''),
                               attendance=attendance, rsvpEnabled=m.get('rsvpEnabled', True),
                               rsvp=private['rsvp'].get(m['id'], {}), resources=[]))
    return sorted(result, key=lambda x: (x['date'], x['time']))


def member_attachment(value):
    if not value: return None
    require(isinstance(value, dict), 'Invalid attachment.')
    name, mime, data = value.get('name'), value.get('mime'), value.get('data')
    require(isinstance(name, str) and 0 < len(name) <= 120 and mime in
            {'application/pdf', 'image/png', 'image/jpeg', 'text/plain'} and
            isinstance(data, str) and len(data) <= 1_500_000 and data.startswith('data:' + mime + ';base64,'),
            'Attachment must be a PDF, image or text file under 1 MB.')
    try:
        raw = base64.b64decode(data.split(',', 1)[1], validate=True)
    except (ValueError, binascii.Error):
        raise Problem(400, 'Invalid attachment data.')
    require(len(raw) <= 1_000_000, 'Attachment must be under 1 MB.')
    return json.dumps({'name': name, 'mime': mime, 'data': data})


def complaint_permissions(c, u, pid):
    row = c.execute('SELECT permissions FROM complaint_reviewers WHERE parish_id=? AND user_id=?',
                    (pid, u['id'])).fetchone()
    return set(json.loads(row['permissions'])) if row else set()


def concern_public(c, concern, viewer_id=None, reviewer_permissions=None):
    permissions = reviewer_permissions or set()
    own = viewer_id and concern['user_id'] == viewer_id
    result = {k: concern[k] for k in ('id', 'reference', 'category', 'group_id', 'event_id', 'subject',
              'description', 'happened_at', 'people_involved', 'follow_up', 'status', 'created_at')}
    result['anonymous'] = concern['user_id'] is None
    if own or 'Review' in permissions:
        result['attachment'] = json.loads(concern['attachment']) if concern['attachment'] else None
    if 'Review' in permissions:
        result['assignedTo'] = concern['assigned_to']
    if concern['user_id'] and 'ViewIdentity' in permissions:
        result['identity'] = concern['user_id']
    updates = c.execute('SELECT status,public_text,internal_text,created_at FROM member_concern_updates WHERE concern_id=? ORDER BY created_at',
                        (concern['id'],)).fetchall()
    result['updates'] = [dict(status=r['status'], text=r['public_text'], at=r['created_at'],
                              **({'internal': r['internal_text']} if 'ViewSensitive' in permissions else {})) for r in updates]
    return result


def reviewer_conflict(u, person, concern):
    involved = (concern['people_involved'] or '').casefold()
    names = {u['name'], u['username'], person.get('lat', ''), person.get('ar', '')}
    return any(len(name.strip()) >= 4 and name.casefold() in involved for name in names if name)


def member_view(c, u, pid):
    d, person, gids = member_context(c, u, pid)
    private = member_private(c, u, pid)
    d['_viewer'] = person['id']
    managed_groups = {g['id'] for g in d['GROUPS'] if u['role'] in {'priest', 'secretary'} or
                      (u['role'] == 'leader' and u['person_id'] in {g.get('leader'), g.get('assistant')})}
    groups = member_groups(d, gids | managed_groups)
    meetings = member_meetings(d, gids | managed_groups, person['id'], private)
    if u['role'] == 'member': ensure_member_reminders(c, pid, u, meetings, private)
    visible_events = []
    for e in d['EVENTS']:
        detail = d['EVENT_DETAIL'].get(e['id'], {})
        visibility = detail.get('visibility', 'public')
        if visibility != 'public' and not (visibility == 'groups' and gids.intersection(detail.get('visibleGroupIds', []))): continue
        visible_events.append({**{k: e.get(k) for k in ('id', 'd', 't', 'title', 'titleAr', 'kind')},
                               'description': detail.get('desc', ''), 'location': next((v.get('name', '') for v in d.get('VENUES', []) if v.get('id') == e.get('venue')), '')})
    content = []
    for notice in d.get('NOTICES', []):
        group_id = notice.get('groupId')
        if group_id and group_id not in gids | managed_groups: continue
        if not group_id and notice.get('audience') != 'Parish': continue
        content.append(dict(id='notice-' + notice['id'], kind='announcement', groupId=group_id,
                            recipientId=None, authorId=None, title=notice.get('title', ''), body=notice.get('ar', ''),
                            category='Notice', eventId=None, attachment=None, pinned=notice.get('pri') == 'urgent',
                            at=notice.get('at', ''), read=True, archived=False, replies=[]))
    for gid in gids | managed_groups:
        detail = d['GROUP_DETAIL'].get(gid, {})
        for index, post in enumerate(detail.get('posts', [])):
            if not isinstance(post, dict): continue
            content.append(dict(id=f'group-post-{gid}-{index}', kind='post', groupId=gid,
                                recipientId=None, authorId=None, title=post.get('title') or next((g['name'] + ' update' for g in d['GROUPS'] if g['id'] == gid), 'Ministry update'),
                                body=post.get('body', ''), html=post.get('html', ''), category='', eventId=None, attachment=None,
                                pinned=False, at=post.get('at', ''), read=True, archived=False, replies=[]))
        for resource in c.execute("SELECT id,name,created_at FROM uploaded_files WHERE parish_id=? AND scope='group' AND owner_id=? ORDER BY created_at DESC", (pid, gid)):
            content.append(dict(id='group-resource-' + resource['id'], kind='resource', groupId=gid,
                                recipientId=None, authorId=None, title=resource['name'], body='', category='', eventId=None,
                                attachment={'name': resource['name'], 'data': f"/api/parishes/{pid}/files/{resource['id']}"},
                                pinned=False, at=resource['created_at'], read=True, archived=False, replies=[]))
    for r in c.execute('SELECT * FROM member_content WHERE parish_id=? ORDER BY created_at DESC', (pid,)):
        if r['group_id'] and r['group_id'] not in gids | managed_groups: continue
        if r['kind'] == 'message' and r['recipient_id'] not in (None, u['id']) and r['author_id'] != u['id']: continue
        if r['kind'] == 'message' and not r['recipient_id'] and r['author_id'] == u['id']: continue
        content.append(dict(id=r['id'], kind=r['kind'], groupId=r['group_id'], recipientId=r['recipient_id'],
                            authorId=r['author_id'], title=r['title'], body=r['body'], category=r['category'],
                            eventId=r['event_id'], attachment=json.loads(r['attachment']) if r['attachment'] else None,
                            pinned=bool(r['pinned']), at=r['created_at'],
                            read=r['author_id'] == u['id'] or r['id'] in private['readIds'], archived=r['id'] in private['archivedIds'],
                            replies=[dict(id=reply['id'], author=reply['name'], body=reply['body'], at=reply['created_at'])
                                     for reply in c.execute('SELECT mr.id,mr.body,mr.created_at,u.name FROM member_replies mr JOIN users u ON u.id=mr.author_id WHERE mr.content_id=? ORDER BY mr.created_at', (r['id'],))]
                                    if r['kind'] == 'discussion' else []))
    for meeting in meetings:
        meeting['resources'] = [dict(id=x['id'], title=x['title'], attachment=x['attachment']) for x in content
                                if x['kind'] == 'resource' and x['eventId'] == meeting['id']]
    concerns = [concern_public(c, r, u['id']) for r in c.execute(
        'SELECT * FROM member_concerns WHERE parish_id=? AND user_id=? ORDER BY created_at DESC', (pid, u['id']))]
    # Anonymous cases stay anonymous to reviewers. Only the submitter's private
    # account data remembers their case IDs so the portal can show follow-up.
    for concern_id in private['concernIds']:
        row = c.execute('SELECT * FROM member_concerns WHERE id=? AND parish_id=? AND user_id IS NULL',
                        (concern_id, pid)).fetchone()
        if row: concerns.append(concern_public(c, row))
    concerns.sort(key=lambda item: item['created_at'], reverse=True)
    perms = complaint_permissions(c, u, pid)
    review = []
    if 'Review' in perms:
        review = [concern_public(c, r, reviewer_permissions=perms) for r in c.execute(
            'SELECT * FROM member_concerns WHERE parish_id=? ORDER BY created_at DESC', (pid,))
                  if not reviewer_conflict(u, person, r) and
                  (not r['assigned_to'] or r['assigned_to'] == u['id'] or 'Assign' in perms) and
                  (not sensitive_concern(r['category']) or 'ViewSensitive' in perms)]
        if 'ViewIdentity' in perms:
            for item in review:
                if item.get('identity'):
                    account = c.execute('SELECT name,person_id FROM users WHERE id=?', (item['identity'],)).fetchone()
                    owner = next((p for p in d['PEOPLE'] if p['id'] == account['person_id']), {}) if account else {}
                    item['identity'] = {'name': account['name'] if account else '', 'phone': owner.get('phone', '')}
        for item in review: complaint_log(c, item['id'], u['id'], 'view')
    leader_concerns = []
    if u['role'] == 'leader':
        leader_concerns = [concern_public(c, r) for r in c.execute(
            'SELECT * FROM member_concerns WHERE parish_id=? ORDER BY created_at DESC', (pid,))
            if r['group_id'] in managed_groups and not sensitive_concern(r['category'])
            and not reviewer_conflict(u, person, r)]
        for item in leader_concerns: complaint_log(c, item['id'], u['id'], 'ministry-view')
    own = {k: person.get(k, '') for k in ('id', 'lat', 'ar', 'phone', 'born', 'town', 'townAr', 'status')}
    own['email'] = d.get('PERSON_EXTRA', {}).get(person['id'], {}).get('email', '')
    own['address'] = next((h.get('address', '') for h in d['HOUSEHOLDS'] if person['id'] in h.get('members', [])), '')
    formation = []
    for gid in gids:
        for index, milestone in enumerate(d['GROUP_DETAIL'].get(gid, {}).get('milestones', [])):
            if isinstance(milestone, dict):
                completion = milestone.get('completions', {}).get(person['id'])
                formation.append(dict(id=milestone.get('id', f'{gid}-{index}'), groupId=gid,
                                      name=milestone.get('name', ''), description=milestone.get('description', ''),
                                      completion=completion))
            elif isinstance(milestone, list) and milestone:
                formation.append(dict(id=f'{gid}-{index}', groupId=gid, name=milestone[0],
                                      description='', completion=None))
    requests = [dict(r) for r in c.execute('SELECT id,field,requested_value,status,created_at FROM member_profile_requests WHERE parish_id=? AND user_id=? ORDER BY created_at DESC', (pid, u['id']))]
    notifications = [dict(id=r['id'], kind=r['kind'], title=r['title'], body=r['body'], route=r['route'],
                          at=r['created_at'], read=bool(r['read_at'])) for r in c.execute(
        'SELECT * FROM member_notifications WHERE parish_id=? AND user_id=? ORDER BY created_at DESC LIMIT 100', (pid, u['id']))]
    volunteer_review = [dict(r) for r in c.execute('SELECT mc.content_id,mc.user_id,mc.status,mc.created_at,c.title,c.group_id,u.name FROM member_commitments mc JOIN member_content c ON c.id=mc.content_id JOIN users u ON u.id=mc.user_id WHERE mc.parish_id=? ORDER BY mc.created_at DESC', (pid,))
                        if r['group_id'] in managed_groups]
    profile_review = [dict(r) for r in c.execute('SELECT pr.*,u.name FROM member_profile_requests pr JOIN users u ON u.id=pr.user_id WHERE pr.parish_id=? ORDER BY pr.created_at DESC', (pid,))] if u['role'] in {'priest', 'secretary'} else []
    reviewers = [dict(id=r['user_id'], name=r['name']) for r in c.execute(
        'SELECT cr.user_id,cr.permissions,u.name FROM complaint_reviewers cr JOIN users u ON u.id=cr.user_id WHERE cr.parish_id=?', (pid,))
        if 'Review' in json.loads(r['permissions'])] if 'Assign' in perms else []
    categories = [dict(name=r['name'], active=bool(r['active'])) for r in c.execute(
        'SELECT name,active FROM complaint_categories WHERE parish_id=? ORDER BY name', (pid,))]
    site = {key: {'en': item.get('en', ''), 'ar': item.get('ar', '')} for key, item in d.get('CONTENT', {}).items()
            if isinstance(item, dict) and item.get('published', True)}
    return dict(parish={k: d['PARISH'].get(k, '') for k in ('id', 'name', 'nameAr', 'town', 'townAr', 'rite', 'riteAr')},
                site=site,
                person=own, groups=groups, meetings=meetings, events=visible_events, content=content,
                notes=private['notes'], todos=private['todos'], commitments=private['commitments'], preferences=private['preferences'],
                concerns=concerns, review=review, leaderConcerns=leader_concerns, complaintPermissions=sorted(perms), profileRequests=requests,
                volunteerReview=volunteer_review, profileReview=profile_review, managedGroups=sorted(managed_groups),
                formation=formation, reviewers=reviewers, categories=categories, notifications=notifications)


def member_action(c, u, pid, q):
    d, person, gids = member_context(c, u, pid)
    private = member_private(c, u, pid)
    op = q.get('op')
    group_id = q.get('groupId')
    if op == 'note':
        note_id = q.get('id')
        if q.get('delete'):
            private['notes'] = [n for n in private['notes'] if n['id'] != note_id]
        else:
            fields = {k: q.get(k, '') for k in ('title', 'body', 'category', 'reminder', 'meetingId')}
            require(all(isinstance(v, str) for v in fields.values()) and len(fields['title'].strip()) in range(1, 121)
                    and len(fields['body']) <= 10000 and len(fields['category']) <= 60, 'Invalid note.')
            tags = q.get('tags', [])
            require(isinstance(tags, list) and len(tags) <= 10 and all(isinstance(t, str) and len(t) <= 32 for t in tags), 'Invalid tags.')
            if fields['meetingId']:
                require(any(m['id'] == fields['meetingId'] for m in member_meetings(d, gids, person['id'], private)), 'Meeting not available.', 403)
            existing = next((n for n in private['notes'] if n['id'] == note_id), None) if note_id else None
            item = dict(id=existing['id'] if existing else secrets.token_hex(12), **fields, tags=tags,
                        pinned=bool(q.get('pinned')), updatedAt=NOW())
            if existing: private['notes'][private['notes'].index(existing)] = item
            else: private['notes'].append(item)
        save_member_private(c, u, pid, private)
    elif op == 'todo':
        todo_id = q.get('id')
        existing = next((item for item in private['todos'] if item['id'] == todo_id), None)
        if q.get('delete'):
            require(existing is not None, 'Task not found.', 404)
            private['todos'] = [item for item in private['todos'] if item['id'] != todo_id]
        elif 'done' in q:
            require(existing is not None and type(q['done']) is bool, 'Invalid task.', 400)
            existing['done'] = q['done']
        else:
            title, due = q.get('title'), q.get('due', '')
            require(isinstance(title, str) and 0 < len(title.strip()) <= 160 and isinstance(due, str) and
                    (not due or len(due) == 10 and due[4] == '-' and due[7] == '-' and
                     all(part.isdigit() for part in (due[:4], due[5:7], due[8:]))), 'Invalid task.')
            if due:
                try: dt.date.fromisoformat(due)
                except ValueError: raise Problem('Invalid task date.')
            item = dict(id=existing['id'] if existing else secrets.token_hex(12), title=title.strip(),
                        due=due, done=existing['done'] if existing else False,
                        createdAt=existing['createdAt'] if existing else NOW())
            if existing: private['todos'][private['todos'].index(existing)] = item
            else: private['todos'].append(item)
        save_member_private(c, u, pid, private)
    elif op == 'rsvp':
        meeting = next((m for m in member_meetings(d, gids, person['id'], private) if m['id'] == q.get('meetingId')), None)
        require(meeting and meeting['rsvpEnabled'] and meeting['date'] >= TODAY(), 'RSVP is not available for this meeting.', 403)
        require(q.get('status') in {'yes', 'no'}, 'Choose attending or unable to attend.')
        reason = q.get('reason', '')
        require(isinstance(reason, str) and len(reason) <= 500, 'Reason is too long.')
        private['rsvp'][meeting['id']] = dict(status=q['status'], reason=reason, at=NOW())
        save_member_private(c, u, pid, private)
        c.execute('INSERT INTO member_rsvp VALUES(?,?,?,?,?,?,?) ON CONFLICT(parish_id,user_id,meeting_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,created_at=excluded.created_at',
                  (pid, u['id'], meeting['groupId'], meeting['id'], q['status'], reason, NOW()))
    elif op == 'preference':
        require(q.get('key') in {'email', 'inSystem', 'meetings', 'announcements', 'messages'} and type(q.get('value')) is bool, 'Invalid preference.')
        private['preferences'][q['key']] = q['value']; save_member_private(c, u, pid, private)
    elif op in {'read', 'archive', 'unarchive'}:
        row = c.execute('SELECT * FROM member_content WHERE id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
        require(row and (not row['group_id'] or row['group_id'] in gids) and
                (row['kind'] != 'message' or row['recipient_id'] in (None, u['id']) or row['author_id'] == u['id']), 'Item not available.', 403)
        key = 'readIds' if op == 'read' else 'archivedIds'
        if op == 'unarchive': private[key] = [item for item in private[key] if item != row['id']]
        elif row['id'] not in private[key]: private[key].append(row['id'])
        save_member_private(c, u, pid, private)
    elif op == 'readAll':
        for r in c.execute('SELECT id,group_id,kind,recipient_id,author_id FROM member_content WHERE parish_id=?', (pid,)):
            if (not r['group_id'] or r['group_id'] in gids) and (r['kind'] != 'message' or r['recipient_id'] in (None, u['id']) or r['author_id'] == u['id']):
                if r['id'] not in private['readIds']: private['readIds'].append(r['id'])
        save_member_private(c, u, pid, private)
    elif op == 'notificationRead':
        c.execute('UPDATE member_notifications SET read_at=? WHERE id=? AND parish_id=? AND user_id=?',
                  (NOW(), q.get('id'), pid, u['id']))
    elif op == 'notificationReadAll':
        c.execute('UPDATE member_notifications SET read_at=? WHERE parish_id=? AND user_id=? AND read_at IS NULL',
                  (NOW(), pid, u['id']))
    elif op == 'volunteer':
        row = c.execute("SELECT * FROM member_content WHERE id=? AND parish_id=? AND kind='opportunity'", (q.get('id'), pid)).fetchone()
        require(row and (not row['group_id'] or row['group_id'] in gids), 'Opportunity not available.', 403)
        require(q.get('status') in {'interested', 'volunteer', 'withdrawn'}, 'Invalid choice.')
        private['commitments'][row['id']] = dict(status=q['status'], at=NOW())
        save_member_private(c, u, pid, private)
        c.execute('INSERT INTO member_commitments VALUES(?,?,?,?,?) ON CONFLICT(parish_id,user_id,content_id) DO UPDATE SET status=excluded.status,created_at=excluded.created_at',
                  (pid, u['id'], row['id'], q['status'], NOW()))
    elif op == 'confirmVolunteer':
        row = c.execute('SELECT mc.*,c.group_id FROM member_commitments mc JOIN member_content c ON c.id=mc.content_id WHERE mc.parish_id=? AND mc.user_id=? AND mc.content_id=?',
                        (pid, q.get('userId'), q.get('id'))).fetchone()
        require(row and any(g['id'] == row['group_id'] and (u['role'] in {'priest', 'secretary'} or
                u['person_id'] in {g.get('leader'), g.get('assistant')}) for g in d['GROUPS']), 'Leadership permission required.', 403)
        require(q.get('status') in {'confirmed', 'declined'}, 'Invalid confirmation.')
        c.execute('UPDATE member_commitments SET status=? WHERE parish_id=? AND user_id=? AND content_id=?',
                  (q['status'], pid, row['user_id'], row['content_id']))
        notify_member(c, pid, row['user_id'], 'volunteer', 'Volunteer assignment ' + q['status'], '', 'mycommitments')
        target = c.execute('SELECT data FROM member_private WHERE parish_id=? AND user_id=?', (pid, row['user_id'])).fetchone()
        if target:
            target_data = json.loads(target['data'])
            if row['content_id'] in target_data.get('commitments', {}):
                target_data['commitments'][row['content_id']]['status'] = q['status']
                c.execute('UPDATE member_private SET data=? WHERE parish_id=? AND user_id=?',
                          (json.dumps(target_data, ensure_ascii=False), pid, row['user_id']))
        audit(c, u, pid, 'volunteer.confirm', row['content_id'])
    elif op == 'profileRequest':
        require(q.get('field') in {'name', 'phone', 'email', 'address', 'emergency contact', 'date of birth', 'ministry memberships', 'profile picture'}, 'Invalid field.')
        value = q.get('value')
        require(isinstance(value, str) and 0 < len(value.strip()) <= 500, 'Enter the requested update.')
        c.execute('INSERT INTO member_profile_requests VALUES(?,?,?,?,?,?,?)',
                  (secrets.token_hex(12), pid, u['id'], q['field'], value.strip(), 'Submitted', NOW()))
        audit(c, u, pid, 'profile.update-request', q['field'])
    elif op == 'profileReview':
        require(u['role'] in {'priest', 'secretary'}, 'Parish office permission required.', 403)
        require(q.get('status') in {'Reviewed', 'Needs Information', 'Closed'}, 'Invalid request status.')
        row = c.execute('SELECT id FROM member_profile_requests WHERE id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
        require(row is not None, 'Request not found.', 404)
        c.execute('UPDATE member_profile_requests SET status=? WHERE id=?', (q['status'], row['id']))
        owner = c.execute('SELECT user_id FROM member_profile_requests WHERE id=?', (row['id'],)).fetchone()
        notify_member(c, pid, owner['user_id'], 'profile', 'Information request ' + q['status'], '', 'myprofile')
        audit(c, u, pid, 'profile.request-reviewed', row['id'])
    elif op == 'publish':
        require(u['role'] in {'priest', 'secretary', 'leader'}, 'Publishing permission required.', 403)
        require(q.get('kind') in {'post', 'announcement', 'resource', 'opportunity', 'discussion'}, 'Invalid content type.')
        if q.get('kind') == 'discussion': require(group_id, 'Choose a ministry for a group conversation.')
        if group_id:
            require(any(g['id'] == group_id and (u['role'] in {'priest', 'secretary'} or
                    u['person_id'] in {g.get('leader'), g.get('assistant')}) for g in d['GROUPS']), 'Leadership of this ministry required.', 403)
        else: require(u['role'] in {'priest', 'secretary'}, 'Parish publishing permission required.', 403)
        title, body = q.get('title'), q.get('body', '')
        require(isinstance(title, str) and 0 < len(title.strip()) <= 160 and isinstance(body, str) and len(body) <= 10000, 'Invalid content.')
        event_id = q.get('eventId') or None
        if event_id:
            require(bool(group_id) and any(m.get('id') == event_id for m in d['GROUP_DETAIL'].get(group_id, {}).get('meetings', [])),
                    'Linked meeting must belong to the selected ministry.')
        attachment = member_attachment(q.get('attachment'))
        content_id = secrets.token_hex(12)
        c.execute('INSERT INTO member_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                  (content_id, pid, group_id, q['kind'], u['id'], None, title.strip(), body,
                   str(q.get('category', ''))[:60], event_id, attachment, int(bool(q.get('pinned'))), NOW()))
        members = c.execute("SELECT u.id,u.person_id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.role='member'", (pid,))
        for target in members:
            if group_id and not any(r.get('p') == target['person_id'] for r in d['GROUP_DETAIL'].get(group_id, {}).get('roster', [])):
                continue
            notify_member(c, pid, target['id'], q['kind'], title.strip(), body, 'myresources' if q['kind'] == 'resource' else 'mycommitments' if q['kind'] == 'opportunity' else 'mymessages' if q['kind'] == 'discussion' else 'myfeed')
        audit(c, u, pid, 'member.publish', q['kind'])
    elif op == 'staffMessage':
        require(u['role'] in {'priest', 'secretary', 'leader'}, 'Staff messaging permission required.', 403)
        recipient_person_id = q.get('recipientPersonId')
        require(recipient_person_id in {item['id'] for item in d['PEOPLE']}, 'Choose a person in this parish.')
        if u['role'] == 'leader':
            require(any(g['id'] in {group['id'] for group in d['GROUPS']
                                      if u['person_id'] in {group.get('leader'), group.get('assistant')}}
                        and recipient_person_id in {row.get('p') for row in d['GROUP_DETAIL'].get(g['id'], {}).get('roster', [])}
                        for g in d['GROUPS']), 'You may message members of your ministries only.', 403)
        recipient = c.execute('SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id '
                              'WHERE a.parish_id=? AND u.person_id=? LIMIT 1',
                              (pid, recipient_person_id)).fetchone()
        require(recipient is not None, 'This person does not have an active in-app account.', 404)
        title, body = q.get('title'), q.get('body')
        require(isinstance(title, str) and 0 < len(title.strip()) <= 160 and
                isinstance(body, str) and 0 < len(body.strip()) <= 5000, 'Enter a subject and message.')
        content_id = secrets.token_hex(12)
        c.execute('INSERT INTO member_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                  (content_id, pid, None, 'message', u['id'], recipient['id'],
                   title.strip(), body.strip(), '', None, None, 0, NOW()))
        notify_member(c, pid, recipient['id'], 'message', title.strip(), body.strip(), 'mymessages')
        audit(c, u, pid, 'member.staff-message', {'recipient': recipient_person_id, 'content': content_id})
    elif op == 'message':
        require(group_id in gids, 'Ministry membership required.', 403)
        group = next(g for g in d['GROUPS'] if g['id'] == group_id)
        recipient = c.execute('SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? '
                              'AND u.person_id IN (?,?) AND u.role IN (\'leader\',\'priest\',\'secretary\') '
                              'ORDER BY CASE WHEN u.person_id=? THEN 0 ELSE 1 END LIMIT 1',
                              (pid, group.get('leader'), group.get('assistant'), group.get('leader'))).fetchone()
        require(recipient is not None, 'This ministry has no available messaging contact.', 403)
        body = q.get('body', '')
        require(isinstance(body, str) and 0 < len(body.strip()) <= 5000, 'Enter a message under 5000 characters.')
        c.execute('INSERT INTO member_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                  (secrets.token_hex(12), pid, group_id, 'message', u['id'], recipient['id'],
                   'Message to ' + group['name'], body.strip(), '', None, None, 0, NOW()))
        notify_member(c, pid, recipient['id'], 'message', 'New ministry message', body.strip(), 'memberhub')
    elif op == 'messageReply':
        original = c.execute("SELECT * FROM member_content WHERE id=? AND parish_id=? AND kind='message'", (q.get('id'), pid)).fetchone()
        require(original and original['recipient_id'] == u['id'] and
                (u['role'] in {'priest', 'secretary'} or any(g['id'] == original['group_id'] and
                 u['person_id'] in {g.get('leader'), g.get('assistant')} for g in d['GROUPS'])),
                'Message not available for reply.', 403)
        require(u['role'] in {'leader', 'priest', 'secretary'}, 'Ministry communication permission required.', 403)
        body = q.get('body', '')
        require(isinstance(body, str) and 0 < len(body.strip()) <= 5000, 'Enter a message under 5000 characters.')
        c.execute('INSERT INTO member_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                  (secrets.token_hex(12), pid, original['group_id'], 'message', u['id'], original['author_id'],
                   'Re: ' + original['title'], body.strip(), '', None, None, 0, NOW()))
        notify_member(c, pid, original['author_id'], 'message', 'Reply from your ministry', body.strip(), 'mymessages')
    elif op == 'discussionReply':
        row = c.execute("SELECT * FROM member_content WHERE id=? AND parish_id=? AND kind='discussion'", (q.get('id'), pid)).fetchone()
        require(row and row['group_id'] in gids, 'Conversation not available.', 403)
        body = q.get('body', '')
        require(isinstance(body, str) and 0 < len(body.strip()) <= 3000, 'Enter a reply under 3000 characters.')
        c.execute('INSERT INTO member_replies VALUES(?,?,?, ?,?)',
                  (secrets.token_hex(12), row['id'], u['id'], body.strip(), NOW()))
    elif op == 'concern':
        require(c.execute('SELECT 1 FROM complaint_categories WHERE parish_id=? AND name=? AND active=1',
                          (pid, q.get('category'))).fetchone() is not None, 'Choose a concern category.')
        if group_id: require(group_id in gids, 'Ministry not available.', 403)
        event_id = q.get('eventId') or None
        if event_id:
            permitted_meetings = {m['id'] for m in member_meetings(d, gids, person['id'], private)}
            permitted_events = {e['id'] for e in d['EVENTS'] if
                d['EVENT_DETAIL'].get(e['id'], {}).get('visibility', 'public') == 'public' or
                (d['EVENT_DETAIL'].get(e['id'], {}).get('visibility') == 'groups' and
                 gids.intersection(d['EVENT_DETAIL'].get(e['id'], {}).get('visibleGroupIds', [])))}
            require(event_id in permitted_meetings | permitted_events, 'Related event is not available.', 403)
        subject, description = q.get('subject'), q.get('description')
        require(isinstance(subject, str) and 0 < len(subject.strip()) <= 160 and
                isinstance(description, str) and 0 < len(description.strip()) <= 10000, 'Enter a subject and description.')
        anonymous = q.get('anonymous') is True
        follow_up = q.get('followUp', 'none')
        require(anonymous or follow_up in {'system', 'email', 'phone', 'none'}, 'Invalid follow-up choice.')
        ref = 'CMP-' + secrets.token_hex(8).upper()
        concern_id = secrets.token_hex(12)
        c.execute('INSERT INTO member_concerns VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                  (concern_id, pid, ref, None if anonymous else u['id'], q['category'], group_id,
                   event_id, subject.strip(), description.strip(), str(q.get('happenedAt', ''))[:40],
                   str(q.get('peopleInvolved', ''))[:500], member_attachment(q.get('attachment')),
                   None if anonymous else follow_up, 'Submitted', NOW(), None))
        if anonymous:
            private['concernIds'].append(concern_id)
            save_member_private(c, u, pid, private)
        complaint_log(c, concern_id, None if anonymous else u['id'], 'submitted')
        return {'id': concern_id}
    elif op == 'concernFollowUp':
        message = q.get('message', '')
        require(isinstance(message, str) and 0 < len(message.strip()) <= 5000, 'Enter a message.')
        row = c.execute('SELECT * FROM member_concerns WHERE parish_id=? AND id=?', (pid, q.get('id'))).fetchone()
        require(row is not None and (row['user_id'] == u['id'] or
                row['user_id'] is None and row['id'] in private['concernIds']), 'Case not available.', 403)
        c.execute('INSERT INTO member_concern_updates VALUES(?,?,?,?,?,?,?)',
                  (secrets.token_hex(12), row['id'], None, row['status'], 'Submitted additional information: ' + message.strip(), '', NOW()))
        complaint_log(c, row['id'], None if row['user_id'] is None else u['id'], 'submitter-follow-up')
    elif op == 'concernUpdate':
        perms = complaint_permissions(c, u, pid)
        require('Review' in perms and ('Respond' in perms or 'Resolve' in perms), 'Complaint reviewer permission required.', 403)
        row = c.execute('SELECT * FROM member_concerns WHERE id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
        require(row is not None, 'Case not found.', 404)
        require(not reviewer_conflict(u, person, row), 'A different reviewer must handle a case involving you.', 403)
        require(not row['assigned_to'] or row['assigned_to'] == u['id'] or 'Assign' in perms,
                'Case is assigned to another reviewer.', 403)
        require(not sensitive_concern(row['category']) or 'ViewSensitive' in perms,
                'Sensitive complaint permission required.', 403)
        status = q.get('status')
        require(status in CONCERN_STATUSES and (status not in {'Resolved', 'Closed'} or 'Resolve' in perms), 'Status permission required.', 403)
        public_text, internal_text = q.get('publicText', ''), q.get('internalText', '')
        require(isinstance(public_text, str) and len(public_text) <= 5000 and isinstance(internal_text, str) and len(internal_text) <= 5000, 'Update is too long.')
        c.execute('UPDATE member_concerns SET status=? WHERE id=?', (status, row['id']))
        c.execute('INSERT INTO member_concern_updates VALUES(?,?,?,?,?,?,?)',
                  (secrets.token_hex(12), row['id'], u['id'], status, public_text, internal_text, NOW()))
        if row['user_id']:
            notify_member(c, pid, row['user_id'], 'concern', 'Concern status: ' + status, public_text, 'myconcerns')
        complaint_log(c, row['id'], u['id'], 'updated', status)
    elif op == 'concernAssign':
        perms = complaint_permissions(c, u, pid)
        require({'Review', 'Assign'} <= perms, 'Complaint assignment permission required.', 403)
        row = c.execute('SELECT * FROM member_concerns WHERE id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
        require(row is not None and not reviewer_conflict(u, person, row), 'Case not available for assignment.', 403)
        target = c.execute('SELECT * FROM users WHERE id=?', (q.get('reviewerId'),)).fetchone()
        require(target is not None and not reviewer_conflict(target, next((p for p in d['PEOPLE'] if p['id'] == target['person_id']), {}), row) and
                'Review' in complaint_permissions(c, target, pid), 'Choose an independent authorized reviewer.', 403)
        if sensitive_concern(row['category']):
            require('ViewSensitive' in complaint_permissions(c, target, pid), 'Reviewer needs sensitive-case permission.', 403)
        c.execute('UPDATE member_concerns SET assigned_to=? WHERE id=?', (target['id'], row['id']))
        complaint_log(c, row['id'], u['id'], 'assigned', target['id'])
    elif op == 'categoryManage':
        require('ManageCategories' in complaint_permissions(c, u, pid), 'Complaint category permission required.', 403)
        name = q.get('name', '')
        require(isinstance(name, str) and 0 < len(name.strip()) <= 80 and type(q.get('active')) is bool,
                'Enter a category name and active state.')
        c.execute('INSERT INTO complaint_categories VALUES(?,?,?) ON CONFLICT(parish_id,name) DO UPDATE SET active=excluded.active',
                  (pid, name.strip(), int(q['active'])))
    else:
        raise Problem(400, 'Unknown member action.')
    return {'ok': True}


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

    def reply_file(self, row):
        self.send_response(200)
        self.send_header('Content-Type', row['mime'])
        self.send_header('Content-Length', str(row['size']))
        self.send_header('Content-Disposition', "inline; filename*=UTF-8''" + quote(row['name']))
        self.end_headers(); self.wfile.write(row['data'])

    def public_asset_allowed(self):
        path = urlsplit(self.path).path
        target = Path(self.translate_path(self.path)).resolve()
        if not target.is_relative_to(ROOT) or '/..' in path:
            return False
        if path in {'/', '/index.html', '/landing.html', '/public.html'}:
            return True
        if not path.startswith('/assets/') or not target.is_relative_to(ROOT / 'assets'):
            return False
        return (target.suffix in {'.js', '.css'}
                or target.is_relative_to(ROOT / 'assets' / 'images') and target.suffix in {'.jpg', '.jpeg', '.png', '.webp'}
                or target.is_relative_to(ROOT / 'assets' / 'fonts') and target.suffix == '.woff2')

    def do_GET(self):
        if self.path.startswith('/api/'): return self.api()
        if not self.public_asset_allowed():
            return self.send_error(404)
        return super().do_GET()

    def do_HEAD(self):
        if not self.public_asset_allowed():
            return self.send_error(404)
        return super().do_HEAD()

    def do_POST(self): self.api()
    def do_PUT(self): self.api()
    def do_DELETE(self): self.api()

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
                    limit = 14_000_000 if urlsplit(self.path).path.endswith('/files') else 8_000_000
                    require(0 < length <= limit, 'Request too large or empty.', 413)
                    q = json.loads(self.rfile.read(length))
                    require(isinstance(q, dict), 'Expected an object.')
                path = urlsplit(self.path).path
                if path == '/api/public/parishes' and self.command == 'GET':
                    return self.reply(200, {'parishes': [dict(id=row['id'], name=meta.get('name', ''), ar=meta.get('ar', ''),
                                                            town=meta.get('town', ''), townAr=meta.get('townAr', ''))
                                           for row in c.execute('SELECT id,metadata FROM parishes')
                                           for meta in [json.loads(row['metadata'])]]})
                if path.startswith('/api/public/parishes/') and self.command == 'GET':
                    public_id = path.rsplit('/', 1)[-1]
                    row = c.execute('SELECT data FROM states WHERE parish_id=?', (public_id,)).fetchone()
                    require(row is not None, 'Parish not found.', 404)
                    public_state = json.loads(row['data'])
                    parish = public_state['PARISH']
                    content = {key: {'en': item.get('en', ''), 'ar': item.get('ar', '')}
                               for key, item in public_state.get('CONTENT', {}).items()
                               if isinstance(item, dict) and item.get('published', True)}
                    events = []
                    for event in public_state.get('EVENTS', []):
                        detail = public_state.get('EVENT_DETAIL', {}).get(event.get('id'), {})
                        if event.get('kind') == 'pending' or (detail.get('visibility') != 'public'
                            and not (not detail and event.get('kind') in {'mass', 'event'})): continue
                        events.append({key: event.get(key, '') for key in ('id', 'd', 't', 'title', 'titleAr', 'kind')})
                    posts = [dict(title=item['title'], body=item['body'], at=item['created_at'])
                             for item in c.execute("SELECT title,body,created_at FROM member_content WHERE parish_id=? AND group_id IS NULL AND kind IN ('post','announcement') ORDER BY created_at DESC LIMIT 8", (public_id,))]
                    posts.extend(dict(title=n.get('title', ''), body=n.get('ar', ''), at=n.get('at', ''))
                                 for n in public_state.get('NOTICES', []) if n.get('audience') == 'Parish' and not n.get('groupId'))
                    posts.sort(key=lambda item: item['at'], reverse=True)
                    public_parish = {key: parish.get(key, '') for key in
                                     ('name', 'nameAr', 'town', 'townAr', 'rite', 'riteAr', 'address', 'addressAr', 'phone')}
                    if not content.get('contact'):
                        public_parish.update(address='', addressAr='', phone='')
                    return self.reply(200, {'parish': public_parish,
                                             'content': content, 'events': events, 'posts': posts})
                if path == '/api/login' and self.command == 'POST':
                    u = c.execute('SELECT * FROM users WHERE username=?', (q.get('username'),)).fetchone()
                    require(u is not None and u['role'] in ROLES and hmac.compare_digest(u['password'], password_hash(str(q.get('password', '')), u['password'].split(':')[0])), 'Incorrect username or password.', 401)
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
                require(u is not None and u['role'] in ROLES, 'Sign in to continue.', 401)
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
                if len(parts) == 5 and parts[:2] == ['api', 'parishes'] and parts[3] == 'files':
                    pid, file_id = parts[2], parts[4]
                    access(c, u, pid)
                    row = c.execute('SELECT * FROM uploaded_files WHERE parish_id=? AND id=?', (pid, file_id)).fetchone()
                    require(row is not None, 'File not found.', 404)
                    file_access(c, u, pid, row['scope'], row['owner_id'], self.command == 'DELETE')
                    if self.command == 'GET':
                        audit(c, u, pid, 'File opened', {'file': file_id}); c.commit()
                        return self.reply_file(row)
                    if self.command == 'DELETE':
                        c.execute('DELETE FROM uploaded_files WHERE id=? AND parish_id=?', (file_id, pid))
                        audit(c, u, pid, 'File deleted', {'file': file_id, 'scope': row['scope'], 'owner': row['owner_id']})
                        c.commit(); return self.reply(200, {'ok': True})
                    raise Problem(405, 'Method not allowed.')
                require(len(parts) == 4 and parts[:2] == ['api', 'parishes'], 'Endpoint not found.', 404)
                pid, endpoint = parts[2:]; access(c, u, pid)
                if endpoint == 'files':
                    if self.command == 'GET':
                        query = parse_qs(urlsplit(self.path).query)
                        scope, owner_id = query.get('scope', [''])[0], query.get('id', [''])[0]
                        file_access(c, u, pid, scope, owner_id)
                        rows = c.execute('SELECT id,name,mime,size,created_at FROM uploaded_files WHERE parish_id=? AND scope=? AND owner_id=? ORDER BY created_at DESC',
                                         (pid, scope, owner_id)).fetchall()
                        return self.reply(200, {'files': [dict(row) for row in rows]})
                    if self.command == 'POST':
                        scope, owner_id = q.get('scope'), q.get('id')
                        file_access(c, u, pid, scope, owner_id, True)
                        filename = str(q.get('name', '')).replace('\\', '/').split('/')[-1].strip()
                        require(filename and len(filename) <= 180 and not any(ord(ch) < 32 for ch in filename), 'Invalid filename.')
                        mime = {'pdf': 'application/pdf', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png'}.get(filename.rsplit('.', 1)[-1].lower())
                        require(mime is not None, 'Only PDF, JPG, and PNG files are supported.')
                        encoded = q.get('data')
                        require(isinstance(encoded, str) and len(encoded) <= 13_500_000, 'File is too large.', 413)
                        try: data = base64.b64decode(encoded, validate=True)
                        except binascii.Error: raise Problem(400, 'Invalid file data.')
                        require(0 < len(data) <= 10_000_000, 'File is too large.', 413)
                        valid = data.startswith(b'%PDF-') if mime == 'application/pdf' else data.startswith(b'\xff\xd8\xff') if mime == 'image/jpeg' else data.startswith(b'\x89PNG\r\n\x1a\n')
                        require(valid, 'File contents do not match the filename.')
                        file_id = secrets.token_urlsafe(18)
                        c.execute('INSERT INTO uploaded_files VALUES(?,?,?,?,?,?,?,?,?,?)',
                                  (file_id, pid, scope, owner_id, filename, mime, len(data), data, u['id'], NOW()))
                        audit(c, u, pid, 'File uploaded', {'file': file_id, 'scope': scope, 'owner': owner_id})
                        c.commit(); return self.reply(200, {'id': file_id, 'name': filename})
                    raise Problem(405, 'Method not allowed.')
                if endpoint == 'attendance-preview' and self.command == 'POST':
                    require(u['role'] in {'priest', 'secretary', 'leader'}, 'Group access required.', 403)
                    row = c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()
                    state = json.loads(row['data'])
                    gid = q.get('groupId')
                    group = next((item for item in state['GROUPS'] if item['id'] == gid), None)
                    require(group is not None, 'Group not found.', 404)
                    if u['role'] == 'leader':
                        require(u['person_id'] in {group.get('leader'), group.get('assistant')}, 'Group is outside your ministry.', 403)
                    return self.reply(200, {'rows': xlsx_preview(q.get('data'))})
                if endpoint == 'oversight' and self.command == 'GET':
                    return self.reply(200, oversight(c, u, pid))
                if endpoint == 'member':
                    if self.command == 'GET': return self.reply(200, member_view(c, u, pid))
                    if self.command == 'POST':
                        result = member_action(c, u, pid, q); c.commit(); return self.reply(200, result)
                    raise Problem(405, 'Method not allowed.')
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
    parser.add_argument('--grant-complaints', help='Username to grant explicit complaint reviewer permissions')
    parser.add_argument('--complaint-permission', action='append', default=[],
                        help='Review, Assign, Respond, Resolve, ViewIdentity, ViewSensitive or ManageCategories')
    args = parser.parse_args(); init_db()
    require(sum(bool(x) for x in (args.create_user, args.assign_user, args.grant_complaints)) <= 1, 'Choose one account operation.')
    if args.grant_complaints:
        require(args.parish and args.complaint_permission, 'Specify a parish and at least one complaint permission.')
        permitted = {'Review', 'Assign', 'Respond', 'Resolve', 'ViewIdentity', 'ViewSensitive', 'ManageCategories'}
        require(set(args.complaint_permission) <= permitted, 'Unknown complaint permission.')
        with connect() as c:
            user = c.execute('SELECT * FROM users WHERE username=?', (args.grant_complaints,)).fetchone()
            require(user is not None, 'Account not found.')
            for pid in args.parish:
                access(c, user, pid)
                c.execute('INSERT INTO complaint_reviewers VALUES(?,?,?) ON CONFLICT(parish_id,user_id) DO UPDATE SET permissions=excluded.permissions',
                          (pid, user['id'], json.dumps(sorted(set(args.complaint_permission)))))
        print('Complaint reviewer permissions saved.'); return
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
        if args.role == 'member':
            require(args.person_id and args.parish, 'Member accounts need --person-id and at least one --parish.')
            with connect() as c:
                for pid in args.parish:
                    row = c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()
                    require(row is not None and any(p['id'] == args.person_id for p in json.loads(row['data'])['PEOPLE']),
                            'The member must have an active person record in every assigned parish.')
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
