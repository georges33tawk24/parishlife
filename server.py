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
from urllib.parse import urlsplit, parse_qs, quote, urlencode
import urllib.request

ROOT = Path(__file__).resolve().parent
DB = ROOT / 'var' / 'parishlife.sqlite3'
GEOGRAPHY = json.loads((ROOT / 'backend' / 'geography.json').read_text(encoding='utf-8'))['governorates']
ROLES = {'bishop', 'priest', 'secretary', 'treasurer', 'leader', 'member'}
CLERGY = {'priest'}  # Bishops use the separate, read-only oversight API.
FINANCE = {'BATCH', 'FUNDS', 'EXPENSES', 'PLEDGES', 'CAMPAIGNS', 'RECURRING', 'RECEIPTS', 'BANKLINES', 'GIVING_SERIES', 'PAYMENT_MIX'}
OFFICE = {'PEOPLE', 'ARCHIVED', 'HOUSEHOLDS', 'FAMILIES', 'BRANCHES', 'PERSON_EXTRA', 'PHOTOS', 'GROUPS', 'GROUP_DETAIL', 'EVENTS', 'EVENT_DETAIL', 'EVENT_TEMPLATES', 'RESERVATIONS', 'VENUES', 'EQUIPMENT', 'MAINTENANCE', 'ISSUES', 'RENTALS', 'SERVICE', 'SERVICE_PLANS', 'SERVICE_TEMPLATES', 'SERVICE_REQUESTS', 'ROTA', 'VOLUNTEERS', 'SIGNUP_SHEETS', 'CHECKIN', 'PICKUP', 'INCIDENTS', 'EVACUATION', 'REGISTRATIONS', 'REG_FORM', 'REGISTRANTS', 'REFUNDS', 'MESSAGES', 'NOTICES', 'PRAYERS', 'PORTAL_REQUESTS', 'REQUEST_HISTORY', 'WORKFLOWS', 'RUNS', 'RUN_LOG', 'FORM_FIELDS', 'FORM_RULES', 'CONTENT', 'AUTOMATIONS', 'DUPLICATES', 'SACRAMENTS'}
READONLY = {'PARISHES', 'AUDIT', 'CORRECTIONS', 'ANNIVERSARIES', 'EPARCHY_NEWS', 'PERMISSIONS', 'EXCEPTIONS', 'TRANSFERS', 'MEMBER_REQUESTS', 'ACCOUNTS',
            'MEMBERSHIP_REQUESTS', 'INVITATIONS', 'MINISTRY_APPLICATIONS', 'MINISTRY_INQUIRIES', 'MINISTRY_DEPARTURES', 'GUEST_REQUESTS', 'POLICIES'}
PROTECTED = {'status', 'approvedBy', 'approvedAt', 'issuedBy', 'issuedAt', 'history', 'original', 'revision', 'memberRequestId', 'memberReference',
             'acceptance', 'guestRequest'}
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
        CREATE TABLE IF NOT EXISTS member_requests(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id),
          reference TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, details TEXT NOT NULL,
          status TEXT NOT NULL, sacrament_id TEXT, response TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL, log TEXT NOT NULL DEFAULT '[]', UNIQUE(parish_id,reference));
        CREATE INDEX IF NOT EXISTS member_requests_parish ON member_requests(parish_id,created_at);
        ''')
        # Databases made before requests kept a log of their steps gain the column.
        if 'log' not in {r[1] for r in c.execute('PRAGMA table_info(member_requests)')}:
            c.execute("ALTER TABLE member_requests ADD COLUMN log TEXT NOT NULL DEFAULT '[]'")
        # Keep legacy account IDs for audit/history, but remove the old
        # volunteer-only login and revoke any sessions it already opened.
        c.execute("UPDATE users SET role='disabled' WHERE role='volunteer'")
        c.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role='disabled')")
        if 'assigned_to' not in {row['name'] for row in c.execute('PRAGMA table_info(member_concerns)')}:
            c.execute('ALTER TABLE member_concerns ADD COLUMN assigned_to TEXT REFERENCES users(id)')
        c.execute("INSERT OR IGNORE INTO dioceses(id,name) VALUES('beirut','Archeparchy of Beirut')")
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
        migrate_v2(c)
        c.execute('DELETE FROM schema_version')
        c.execute('INSERT INTO schema_version VALUES(6)')


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


def password_matches(stored, password):
    """server.py stores salt:hex (600,000 rounds); accounts made on Cloudflare store pbkdf2_sha256$rounds$salt$hex."""
    stored = str(stored or '')
    if stored.startswith('pbkdf2_sha256$'):
        parts = stored.split('$')
        if len(parts) != 4 or not re.fullmatch(r'[0-9]{1,8}', parts[1]) or not 1 <= int(parts[1]) <= 10_000_000 or not parts[2]: return False
        digest = hashlib.pbkdf2_hmac('sha256', password.encode(), parts[2].encode(), int(parts[1])).hex()
        return hmac.compare_digest(stored, f'pbkdf2_sha256${int(parts[1])}${parts[2]}${digest}')
    return hmac.compare_digest(stored, password_hash(password, stored.split(':')[0]))


EASTERN_DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')


def login_name(value):
    """How an account is found: an email address in lower case, a phone number in international
    form (Lebanon unless another country code is given), any other username as typed."""
    text = str(value or '').strip().translate(EASTERN_DIGITS)
    if '@' in text: return text.lower()
    digits = re.sub(r'[ \t\u00a0\-().]', '', text)
    if not re.fullmatch(r'(\+|00)?[0-9]{6,15}', digits): return text
    if digits.startswith('00'): return '+' + digits[2:]
    if digits.startswith('+'): return digits
    if digits.startswith('961') and len(digits) >= 10: return '+' + digits
    return '+961' + digits.lstrip('0')


EMAIL_ADDRESS = re.compile(r'[^@\s]+@[^@\s]+\.[^@\s]+')
PHONE_KEY = re.compile(r'\+[0-9]{8,15}')
SIGNUPS_PER_HOUR = 30
MINIMUM_AGE = 13


def record_phone(number):
    """A phone number as People records it: a Lebanese number without +961 in groups ('3 123 456', '76 220 415'),
    any other in full."""
    if not number.startswith('+961'): return number
    digits = number[4:]
    return ' '.join(part for part in (digits[:-6], digits[-6:-3], digits[-3:]) if part)


# ───────────── Accounts: registration, sign-in methods, verification, two-step, providers ─────────────
# An account belongs to a person, not to a parish; parishes are joined or followed afterwards.
# It signs in with an email address or phone number it registered, or its username, and a password,
# or with a linked Google, Apple or Microsoft identity once that provider is configured. A code is
# only reported as sent when a delivery service accepted it; nothing is ever marked verified that
# was not checked.
ACCOUNTS_SCHEMA = '''
CREATE TABLE IF NOT EXISTS user_contacts(user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, value TEXT NOT NULL,
  verified_at TEXT, created_at TEXT NOT NULL, PRIMARY KEY(kind,value));
CREATE INDEX IF NOT EXISTS user_contacts_user ON user_contacts(user_id);
CREATE TABLE IF NOT EXISTS user_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id), first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '', birth_date TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS verification_codes(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), purpose TEXT NOT NULL,
  channel TEXT NOT NULL, target TEXT NOT NULL, code_hash TEXT NOT NULL, created REAL NOT NULL, expires REAL NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, delivery TEXT NOT NULL, used_at TEXT);
CREATE INDEX IF NOT EXISTS verification_codes_target ON verification_codes(target,purpose,created);
CREATE TABLE IF NOT EXISTS user_mfa(user_id TEXT NOT NULL REFERENCES users(id), method TEXT NOT NULL, secret TEXT NOT NULL DEFAULT '',
  enabled_at TEXT, last_step INTEGER NOT NULL DEFAULT 0, recovery TEXT NOT NULL DEFAULT '[]', PRIMARY KEY(user_id,method));
CREATE TABLE IF NOT EXISTS login_challenges(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), methods TEXT NOT NULL,
  expires REAL NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS user_identities(provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
  email TEXT NOT NULL DEFAULT '', linked_at TEXT NOT NULL, PRIMARY KEY(provider,subject));
CREATE INDEX IF NOT EXISTS user_identities_user ON user_identities(user_id);
CREATE TABLE IF NOT EXISTS oauth_states(state TEXT PRIMARY KEY, provider TEXT NOT NULL, intent TEXT NOT NULL, user_id TEXT,
  verifier TEXT NOT NULL DEFAULT '', nonce TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '{}', created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS login_failures(key TEXT PRIMARY KEY, count INTEGER NOT NULL, since REAL NOT NULL);
'''
CONTACT_KINDS = ('email', 'phone')
CHANNEL = {'email': 'email', 'phone': 'sms'}
KIND_OF = {'email': 'email', 'sms': 'phone'}
DELIVERY_ENV = {'email': 'PARISHLIFE_EMAIL_WEBHOOK', 'sms': 'PARISHLIFE_SMS_WEBHOOK'}
DEV_OUTBOX = False   # --dev-outbox: codes are printed in this server's console instead of sent (local development only)
CODE_TTL = 900
sha = lambda text: hashlib.sha256(str(text).encode()).hexdigest()


def migrate_accounts(c):
    """Additive: the account tables, and (once) the email address or phone number an account was opened
    with recorded as its first sign-in contact — unverified, because nothing ever checked it."""
    c.executescript(ACCOUNTS_SCHEMA)
    if c.execute("SELECT 1 FROM schema_migrations WHERE name='v2-contacts'").fetchone() is None:
        for user in c.execute('SELECT id,username FROM users').fetchall():
            kind = contact_kind(user['username'])
            if kind: c.execute('INSERT OR IGNORE INTO user_contacts VALUES(?,?,?,?,?)', (user['id'], kind, user['username'], None, NOW()))
        c.execute("INSERT INTO schema_migrations VALUES('v2-contacts',?)", (NOW(),))


def contact_kind(value):
    value = str(value or '')
    if len(value) <= 120 and EMAIL_ADDRESS.fullmatch(value) and value == value.lower(): return 'email'
    if PHONE_KEY.fullmatch(value): return 'phone'
    return None


def contact_value(kind, raw):
    """An email address in lower case, or a phone number in international form."""
    text = str(raw or '').strip()
    if kind == 'email':
        value = text.lower()
        require(len(value) <= 120 and EMAIL_ADDRESS.fullmatch(value) is not None, 'Enter a valid email address.')
        return value
    value = login_name(text)
    require(len(text) <= 40 and PHONE_KEY.fullmatch(value) is not None, 'Enter a valid phone number.')
    return value


def contact_owner(c, kind, value):
    """The account already using this email address or phone number, as a contact or as its username."""
    row = c.execute('SELECT user_id FROM user_contacts WHERE kind=? AND value=?', (kind, value)).fetchone()
    if row: return row['user_id']
    row = c.execute('SELECT id FROM users WHERE username=?', (value,)).fetchone()
    return row['id'] if row else None


def verified_contact(c, user_id, kind):
    row = c.execute('SELECT value FROM user_contacts WHERE user_id=? AND kind=? AND verified_at IS NOT NULL ORDER BY verified_at',
                    (user_id, kind)).fetchone()
    return row['value'] if row else None


def masked(kind, value):
    if kind == 'email':
        name, _, domain = value.partition('@')
        return name[:1] + '•••@' + domain
    return value[:4] + ' ••• ' + value[-3:]


def delivery_mode(channel):
    """How codes reach people from this server: 'service' (a configured delivery webhook), 'console'
    (--dev-outbox, local development only: printed, never sent) or 'none'."""
    if os.environ.get(DELIVERY_ENV[channel], '').startswith(('https://', 'http://')): return 'service'
    return 'console' if DEV_OUTBOX else 'none'


def code_hash(cid, code): return sha(f'{cid}:{code}')


def issue_code(c, user_id, purpose, kind, target, outbox):
    """A six-digit code for `target`, valid 15 minutes, queued in `outbox` to be sent after the commit.
    Without a delivery service nothing is stored or sent, and the caller is told so."""
    channel = CHANNEL[kind]
    mode = delivery_mode(channel)
    if mode == 'none': return 'not-configured'
    now = time.time()
    last = c.execute('SELECT MAX(created) FROM verification_codes WHERE target=? AND purpose=?', (target, purpose)).fetchone()[0]
    require(last is None or now - last >= 60, 'A code was sent a moment ago. Wait a minute before asking for another.', 429)
    require(c.execute('SELECT COUNT(*) FROM verification_codes WHERE target=? AND created>?', (target, now - 86400)).fetchone()[0] < 10,
            'Too many codes were asked for today. Try again tomorrow.', 429)
    c.execute("UPDATE verification_codes SET used_at='replaced' WHERE target=? AND purpose=? AND used_at IS NULL", (target, purpose))
    cid, code = secrets.token_hex(12), f'{secrets.randbelow(1_000_000):06d}'
    status = 'sending' if mode == 'service' else 'console'
    c.execute('INSERT INTO verification_codes VALUES(?,?,?,?,?,?,?,?,?,?,?)',
              (cid, user_id, purpose, channel, target, code_hash(cid, code), now, now + CODE_TTL, 0, status, None))
    outbox.append(dict(id=cid, table='verification_codes', channel=channel, target=target, mode=mode, status=status,
                       subject='Your ParishLife code',
                       text=f'Your ParishLife code is {code}. It expires in 15 minutes. If you did not ask for it, ignore this message.\n'
                            f'رمز ParishLife الخاص بك هو {code}. تنتهي صلاحيته بعد ١٥ دقيقة.'))
    return status


def send_outbox(c, outbox):
    """After the commit: hand each message (a code, an invitation) to the delivery service and record whether it accepted it."""
    for item in outbox:
        if item['mode'] == 'console':
            print(f"[dev outbox, NOT SENT] {item['channel']} to {item['target']}: {item['text'].splitlines()[0]}", flush=True)
            continue
        headers = {'Content-Type': 'application/json'}
        if os.environ.get('PARISHLIFE_DELIVERY_TOKEN'): headers['Authorization'] = 'Bearer ' + os.environ['PARISHLIFE_DELIVERY_TOKEN']
        body = json.dumps(dict(channel=item['channel'], to=item['target'], subject=item['subject'], text=item['text'])).encode()
        try:
            with urllib.request.urlopen(urllib.request.Request(os.environ[DELIVERY_ENV[item['channel']]], data=body, headers=headers,
                                                               method='POST'), timeout=10) as r:
                item['status'] = 'sent' if 200 <= r.status < 300 else 'failed'
        except (OSError, ValueError):
            item['status'] = 'failed'
        table, column = {'verification_codes': ('verification_codes', 'delivery'), 'invitations': ('invitations', 'delivery'),
                         'guest_requests': ('guest_requests', 'link_delivery')}[item['table']]
        c.execute(f'UPDATE {table} SET {column}=? WHERE id=?', (item['status'], item['id'])); c.commit()
    return [dict(channel=item['channel'], to=item['target'], delivery=item['status']) for item in outbox]


def consume_code(c, user_id, purpose, target, code):
    """Uses up the latest code sent to `target`; a wrong one counts against it (five tries)."""
    row = c.execute('SELECT * FROM verification_codes WHERE target=? AND purpose=? AND user_id=? AND used_at IS NULL ORDER BY created DESC LIMIT 1',
                    (target, purpose, user_id)).fetchone()
    require(row is not None and row['expires'] > time.time(), 'This code has expired or was replaced. Ask for a new one.')
    require(row['attempts'] < 5, 'Too many wrong codes. Ask for a new one.', 429)
    if not hmac.compare_digest(row['code_hash'], code_hash(row['id'], re.sub(r'\s', '', str(code or '')))):
        c.execute('UPDATE verification_codes SET attempts=attempts+1 WHERE id=?', (row['id'],)); c.commit()
        raise Problem(400, 'That code is not right. Check it and try again.')
    c.execute('UPDATE verification_codes SET used_at=? WHERE id=?', (NOW(), row['id']))


def totp_code(secret, step):
    """RFC 6238: HMAC-SHA1, 30-second steps, six digits — what authenticator apps use."""
    digest = hmac.new(base64.b32decode(secret), step.to_bytes(8, 'big'), hashlib.sha1).digest()
    offset = digest[-1] & 15
    return f'{(int.from_bytes(digest[offset:offset + 4], "big") & 0x7FFFFFFF) % 1_000_000:06d}'


def totp_step(secret, code, last_step):
    """The time step (now, or 30 seconds either side) a code belongs to, if that step has not been used yet."""
    code = re.sub(r'\s', '', str(code or ''))
    if not re.fullmatch(r'[0-9]{6}', code): return None
    now = int(time.time() // 30)
    return next((step for step in (now - 1, now, now + 1) if step > last_step and hmac.compare_digest(totp_code(secret, step), code)), None)


def new_recovery_codes(c, user_id):
    codes = [f'{secrets.token_hex(3)}-{secrets.token_hex(3)}' for _ in range(10)]
    c.execute('INSERT INTO user_mfa VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,method) DO UPDATE SET recovery=excluded.recovery,enabled_at=excluded.enabled_at',
              (user_id, 'recovery', '', NOW(), 0, json.dumps([sha(code.replace('-', '')) for code in codes])))
    return codes


def mfa_rows(c, user_id):
    return {r['method']: r for r in c.execute('SELECT * FROM user_mfa WHERE user_id=?', (user_id,))}


def login_methods(c, user_id):
    """The second steps this account turned on that this server can still carry out, and whether any is on."""
    rows = {m: r for m, r in mfa_rows(c, user_id).items() if r['enabled_at']}
    turned_on = [m for m in ('totp', 'email', 'sms') if m in rows]
    usable = [m for m in turned_on if m == 'totp' or (delivery_mode(m) != 'none' and verified_contact(c, user_id, KIND_OF[m]))]
    if turned_on and 'recovery' in rows and json.loads(rows['recovery']['recovery']): usable.append('recovery')
    return usable, bool(turned_on)


def mfa_check(c, user_id, method, code):
    """Whether `code` completes the second step by `method`; a used code or time step cannot be used again."""
    rows = mfa_rows(c, user_id)
    if method == 'totp' and rows.get('totp') and rows['totp']['enabled_at']:
        step = totp_step(rows['totp']['secret'], code, rows['totp']['last_step'])
        if step is None: return False
        c.execute("UPDATE user_mfa SET last_step=? WHERE user_id=? AND method='totp'", (step, user_id))
        return True
    if method == 'recovery' and rows.get('recovery'):
        hashes, given = json.loads(rows['recovery']['recovery']), sha(re.sub(r'[^0-9a-f]', '', str(code or '').lower()))
        if given not in hashes: return False
        hashes.remove(given)
        c.execute("UPDATE user_mfa SET recovery=? WHERE user_id=? AND method='recovery'", (json.dumps(hashes), user_id))
        return True
    if method in {'email', 'sms'}:
        consume_code(c, user_id, 'login', verified_contact(c, user_id, KIND_OF[method]) or '', code)
        return True
    return False


def mfa_challenge(c, user_id):
    """After the password: a short-lived ticket for the second step, instead of a session."""
    methods, _ = login_methods(c, user_id)
    require(methods, 'Two-step verification is on for this account, but none of its methods can be used on this server '
                     'right now. Contact your parish office or the ParishLife administrator.', 403)
    token = secrets.token_urlsafe(32)
    c.execute('DELETE FROM login_challenges WHERE expires<?', (time.time(),))
    c.execute('INSERT INTO login_challenges VALUES(?,?,?,?,?)', (sha(token), user_id, json.dumps(methods), time.time() + 600, 0))
    return token


def challenge_info(c, token):
    row = c.execute('SELECT * FROM login_challenges WHERE token=? AND expires>?', (sha(str(token or '')), time.time())).fetchone()
    require(row is not None, 'This sign-in has expired. Sign in again.', 401)
    methods = json.loads(row['methods'])
    hints = {m: masked(KIND_OF[m], verified_contact(c, row['user_id'], KIND_OF[m]) or '') for m in methods if m in KIND_OF}
    return row, dict(mfa='required', challenge=token, methods=methods, hints=hints)


def mfa_send(c, q, outbox):
    row, _ = challenge_info(c, q.get('challenge'))
    method = q.get('method')
    require(method in {'email', 'sms'} and method in json.loads(row['methods']), 'Choose how to receive the code.')
    return dict(delivery=issue_code(c, row['user_id'], 'login', KIND_OF[method], verified_contact(c, row['user_id'], KIND_OF[method]), outbox))


def mfa_verify(c, q):
    """The second step; returns the account to sign in."""
    row, _ = challenge_info(c, q.get('challenge'))
    require(row['attempts'] < 5, 'Too many wrong codes. Sign in again.', 429)
    method = q.get('method')
    require(method in json.loads(row['methods']), 'Choose a way to confirm it is you.')
    if not mfa_check(c, row['user_id'], method, q.get('code')):
        c.execute('UPDATE login_challenges SET attempts=attempts+1 WHERE token=?', (row['token'],)); c.commit()
        raise Problem(401, 'That code is not right. Check it and try again.')
    c.execute('DELETE FROM login_challenges WHERE token=?', (row['token'],))
    u = c.execute('SELECT * FROM users WHERE id=?', (row['user_id'],)).fetchone()
    require(login_allowed(c, u), 'Sign in to continue.', 401)
    return u


SIGN_IN_ERRORS = {'email': 'Incorrect email address or password.', 'phone': 'Incorrect phone number or password.'}
LOGIN_ATTEMPTS, LOGIN_WINDOW = 10, 900


def find_account(c, method, identifier):
    """Email and Phone look in the account's registered contacts (and, for accounts made by the operator tools,
    a username that is that address or number); Username looks in usernames. Requests without a method
    (older pages) accept any of them."""
    key = login_name(identifier)
    kind = contact_kind(key)
    if method in {'email', 'phone'} and method != kind: return None
    if kind and method in {'email', 'phone', None}:
        row = c.execute('SELECT u.* FROM user_contacts k JOIN users u ON u.id=k.user_id WHERE k.kind=? AND k.value=?', (kind, key)).fetchone()
        if row: return row
    return c.execute('SELECT * FROM users WHERE username=?', (key,)).fetchone()


def sign_in(c, q):
    method = q.get('method')
    require(method in {'email', 'phone', 'username', None}, 'Choose how you sign in.')
    identifier = q.get('identifier', q.get('username'))
    key, now = sha(login_name(identifier)), time.time()
    failures = c.execute('SELECT * FROM login_failures WHERE key=? AND since>?', (key, now - LOGIN_WINDOW)).fetchone()
    require(failures is None or failures['count'] < LOGIN_ATTEMPTS, 'Too many attempts to sign in to this account. Wait 15 minutes, then try again.', 429)
    u = find_account(c, method, identifier)
    ok = login_allowed(c, u) and bool(u['password']) and password_matches(u['password'], str(q.get('password', '')))
    if not ok:   # counted per name typed, so guessing one account's password is slowed down
        c.execute('INSERT INTO login_failures VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET '
                  'count=CASE WHEN since>? THEN count+1 ELSE 1 END, since=CASE WHEN since>? THEN since ELSE excluded.since END',
                  (key, now, now - LOGIN_WINDOW, now - LOGIN_WINDOW))
        c.commit()
        raise Problem(401, SIGN_IN_ERRORS.get(method, 'Incorrect username or password.'))
    c.execute('DELETE FROM login_failures WHERE key=?', (key,))
    return u


def birth_date(value):
    text = str(value or '')
    require(re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', text) is not None, 'Enter your date of birth.')
    try: born = dt.date.fromisoformat(text)
    except ValueError: raise Problem(400, 'Enter your date of birth.')
    today = dt.date.today()
    require(dt.date(1900, 1, 1) <= born <= today, 'Enter your date of birth.')
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    require(age >= MINIMUM_AGE, f'You need to be {MINIMUM_AGE} or older to open an account. A parent or guardian can make requests for you.')
    return born.isoformat()


def new_password(q):
    password = q.get('password')
    require(isinstance(password, str) and 8 <= len(password) <= 200, 'Choose a password of at least 8 characters.')
    require(password == q.get('confirm'), 'The two passwords do not match.')
    return password


def registration_contacts(q):
    contacts = [(kind, contact_value(kind, q.get(kind))) for kind in CONTACT_KINDS if str(q.get(kind) or '').strip()]
    require(contacts, 'Enter an email address, a phone number, or both.')
    return contacts


def create_account(c, first, last, born, contacts, password, outbox, verified=()):
    """The account, its profile and its contacts; a code goes to each contact not already verified."""
    for kind, value in contacts:
        require(contact_owner(c, kind, value) is None,
                ('This email address' if kind == 'email' else 'This phone number') + ' already has an account. Sign in instead.', 409)
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)).isoformat()
    recent = c.execute("SELECT COUNT(*) FROM audit WHERE action='account.signup' AND at>?", (since,)).fetchone()[0]
    require(recent < SIGNUPS_PER_HOUR, 'Many accounts were opened in the last hour. Please try again later.', 429)
    user_id, at = 'u-' + secrets.token_hex(8), NOW()
    c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)', (user_id, contacts[0][1], f'{first} {last}', 'user', '', None,
                                                          password_hash(password) if password else ''))
    c.execute('INSERT INTO user_profiles VALUES(?,?,?,?,?,?)', (user_id, first, last, born, '{}', at))
    delivery = []
    for kind, value in contacts:
        done = (kind, value) in verified
        c.execute('INSERT INTO user_contacts VALUES(?,?,?,?,?)', (user_id, kind, value, at if done else None, at))
        delivery.append(dict(kind=kind, value=value, delivery='verified' if done else issue_code(c, user_id, 'verify', kind, value, outbox)))
    audit(c, {'id': user_id}, None, 'account.signup', {'via': [kind for kind, _ in contacts]})
    return user_id, delivery


def register(c, q, outbox):
    """Anyone 13 or older opens an account: a first and last name, an email address and/or a phone number,
    a password. No parish is chosen here."""
    require(not q.get('website'), 'The account could not be created.')  # a field only robots fill in
    first = clean(q.get('firstName'), 60, 'Enter your first name.')
    last = clean(q.get('lastName'), 60, 'Enter your last name.')
    contacts = registration_contacts(q)
    born = birth_date(q.get('birthDate'))
    return create_account(c, first, last, born, contacts, new_password(q), outbox)


# Sign-in providers. Each is unavailable until its client ID and secret and the site's public address are configured.
PROVIDERS = {
    'google': dict(name='Google', authorize='https://accounts.google.com/o/oauth2/v2/auth', token='https://oauth2.googleapis.com/token',
                   scope='openid email profile', pkce=True, issuers=('https://accounts.google.com', 'accounts.google.com')),
    'microsoft': dict(name='Microsoft', authorize='https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
                      token='https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token', scope='openid email profile', pkce=True, issuers=()),
    'apple': dict(name='Apple', authorize='https://appleid.apple.com/auth/authorize', token='https://appleid.apple.com/auth/token',
                  scope='openid email name', pkce=False, issuers=('https://appleid.apple.com',)),
}


def provider_settings(name, env=os.environ):
    if name not in PROVIDERS: return None
    key, base = name.upper(), env.get('PARISHLIFE_PUBLIC_URL', '').rstrip('/')
    cid, secret = env.get(f'PARISHLIFE_{key}_CLIENT_ID', ''), env.get(f'PARISHLIFE_{key}_CLIENT_SECRET', '')
    if not (cid and secret and re.match(r'https://|http://(localhost|127\.0\.0\.1)(:|$)', base)): return None
    tenant = env.get('PARISHLIFE_MICROSOFT_TENANT', 'common') or 'common'
    p = PROVIDERS[name]
    return dict(p, client_id=cid, secret=secret, tenant=tenant, redirect=f'{base}/api/auth/{name}/callback',
                authorize=p['authorize'].format(tenant=tenant), token=p['token'].format(tenant=tenant))


def auth_config():
    """What the sign-in page may offer on this server."""
    return dict(providers={n: dict(name=p['name'], configured=provider_settings(n) is not None) for n, p in PROVIDERS.items()},
                delivery={ch: delivery_mode(ch) for ch in DELIVERY_ENV}, minimumAge=MINIMUM_AGE)


def b64url(data): return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def oauth_start(c, provider, intent, user_id):
    p = provider_settings(provider)
    state, verifier, nonce = secrets.token_urlsafe(24), secrets.token_urlsafe(48), secrets.token_urlsafe(24)
    c.execute('DELETE FROM oauth_states WHERE created<?', (time.time() - 1800,))
    c.execute('INSERT INTO oauth_states VALUES(?,?,?,?,?,?,?,?)', (sha(state), provider, intent, user_id, verifier, nonce, '{}', time.time()))
    params = dict(client_id=p['client_id'], redirect_uri=p['redirect'], response_type='code', scope=p['scope'], state=state, nonce=nonce)
    if p['pkce']: params.update(code_challenge=b64url(hashlib.sha256(verifier.encode()).digest()), code_challenge_method='S256')
    if provider == 'apple': params['response_mode'] = 'form_post'
    if provider == 'google': params['prompt'] = 'select_account'
    return p['authorize'] + '?' + urlencode(params), state


def checked_claims(p, provider, claims, nonce):
    """The ID token came straight from the provider's token endpoint over TLS, so (as OpenID Connect allows)
    its signature is not re-checked here; issuer, audience, expiry and nonce are."""
    aud = claims.get('aud')
    if p['client_id'] not in (aud if isinstance(aud, list) else [aud]): return None
    if not isinstance(claims.get('exp'), (int, float)) or claims['exp'] < time.time() - 60: return None
    if not hmac.compare_digest(str(claims.get('nonce') or ''), nonce): return None
    iss = str(claims.get('iss') or '')
    if provider == 'microsoft':
        tid = str(claims.get('tid') or '')
        if not tid or iss != f'https://login.microsoftonline.com/{tid}/v2.0' or p['tenant'] not in {'common', 'organizations', 'consumers', tid}: return None
    elif iss not in p['issuers']: return None
    sub = str(claims.get('sub') or '')
    if not sub or len(sub) > 255: return None
    email = str(claims.get('email') or '').strip().lower()
    email = email if len(email) <= 120 and EMAIL_ADDRESS.fullmatch(email) else ''
    # Microsoft does not say whether an address was checked, so it is never treated as verified.
    verified = bool(email) and provider in {'google', 'apple'} and claims.get('email_verified') in (True, 'true')
    return dict(sub=sub, email=email, verified=verified,
                firstName=' '.join(str(claims.get('given_name') or '').split())[:60], lastName=' '.join(str(claims.get('family_name') or '').split())[:60])


def oauth_exchange(p, provider, code, verifier, nonce):
    form = dict(grant_type='authorization_code', code=code, redirect_uri=p['redirect'], client_id=p['client_id'], client_secret=p['secret'])
    if p['pkce']: form['code_verifier'] = verifier
    try:
        request = urllib.request.Request(p['token'], data=urlencode(form).encode(), method='POST',
                                         headers={'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'})
        with urllib.request.urlopen(request, timeout=10) as r: token = json.loads(r.read())
        payload = token['id_token'].split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        require(isinstance(claims, dict), 'Invalid token.')
    except (OSError, ValueError, KeyError, IndexError, TypeError, AttributeError, Problem):
        return None
    return checked_claims(p, provider, claims, nonce)


def oauth_finish(c, provider, params, cookie_state):
    """The provider sent the browser back. Returns (where to send it next, the account to sign in or None).
    An identity signs in only the account it was linked to; a matching email address is never merged."""
    state = str(params.get('state') or '')
    row = c.execute('SELECT * FROM oauth_states WHERE state=? AND provider=? AND created>? AND intent<>?',
                    (sha(state), provider, time.time() - 600, 'complete')).fetchone() if state else None
    if row: c.execute('DELETE FROM oauth_states WHERE state=?', (row['state'],))
    c.commit()   # the provider's token endpoint is asked next; nothing is held while waiting for it
    back = '/index.html#/account' if row and row['intent'] == 'link' else '/index.html'
    if row is None or not hmac.compare_digest(str(cookie_state or ''), state): return '/index.html?auth_error=expired', None
    if params.get('error'): return f'/index.html?auth_error=cancelled{back[11:]}', None
    p = provider_settings(provider)
    if p is None: return '/index.html?auth_error=unavailable', None
    claims = oauth_exchange(p, provider, str(params.get('code') or ''), row['verifier'], row['nonce'])
    if claims is None: return f'/index.html?auth_error=failed{back[11:]}', None
    if provider == 'apple' and params.get('user'):   # Apple sends the name once, beside the token
        try:
            name = json.loads(params['user']).get('name') or {}
            claims['firstName'] = claims['firstName'] or ' '.join(str(name.get('firstName') or '').split())[:60]
            claims['lastName'] = claims['lastName'] or ' '.join(str(name.get('lastName') or '').split())[:60]
        except (ValueError, AttributeError): pass
    identity = c.execute('SELECT * FROM user_identities WHERE provider=? AND subject=?', (provider, claims['sub'])).fetchone()
    if row['intent'] == 'link':
        owner = c.execute('SELECT * FROM users WHERE id=?', (row['user_id'],)).fetchone()
        if not login_allowed(c, owner): return '/index.html?auth_error=expired', None
        if identity and identity['user_id'] != owner['id']: return '/index.html?auth_error=linked-elsewhere#/account', None
        if identity is None:
            c.execute('INSERT INTO user_identities VALUES(?,?,?,?,?)', (provider, claims['sub'], owner['id'], claims['email'], NOW()))
            if claims['verified']:   # the provider checked this address, so the same address on this account is verified too
                c.execute('UPDATE user_contacts SET verified_at=? WHERE user_id=? AND kind=? AND value=? AND verified_at IS NULL',
                          (NOW(), owner['id'], 'email', claims['email']))
            audit(c, owner, None, 'account.provider-linked', {'provider': provider})
        return f'/index.html?linked={provider}#/account', None
    if identity: return '/index.html', identity['user_id']
    if claims['email'] and contact_owner(c, 'email', claims['email']):
        return f'/index.html?auth_error=email-in-use&provider={provider}', None
    ticket = secrets.token_urlsafe(24)
    c.execute('INSERT INTO oauth_states VALUES(?,?,?,?,?,?,?,?)', (sha(ticket), provider, 'complete', None, '', '', json.dumps(claims), time.time()))
    return f'/index.html?provider_signup={ticket}&provider={provider}', None


def provider_ticket(c, ticket):
    row = c.execute("SELECT * FROM oauth_states WHERE state=? AND intent='complete' AND created>?",
                    (sha(str(ticket or '')), time.time() - 1800)).fetchone()
    require(row is not None, 'This sign-up has expired. Start again with the same button.', 400)
    claims = json.loads(row['data'])
    return row, claims, dict(provider=row['provider'], providerName=PROVIDERS[row['provider']]['name'], email=claims['email'],
                             emailVerified=claims['verified'], firstName=claims['firstName'], lastName=claims['lastName'])


def provider_complete(c, q, outbox):
    """Finishes an account opened with a provider: the same name, age and contact rules; no password needed."""
    row, claims, _ = provider_ticket(c, q.get('ticket'))
    require(not q.get('website'), 'The account could not be created.')
    first = clean(q.get('firstName'), 60, 'Enter your first name.')
    last = clean(q.get('lastName'), 60, 'Enter your last name.')
    born = birth_date(q.get('birthDate'))
    contacts = ([('email', claims['email'])] if claims['email'] else []) + \
               ([('phone', contact_value('phone', q.get('phone')))] if str(q.get('phone') or '').strip() else [])
    require(contacts, 'Enter a phone number. Your provider did not share an email address.')
    require(c.execute('SELECT 1 FROM user_identities WHERE provider=? AND subject=?', (row['provider'], claims['sub'])).fetchone() is None,
            'This account is already linked. Sign in instead.', 409)
    user_id, delivery = create_account(c, first, last, born, contacts, None, outbox,
                                       verified={('email', claims['email'])} if claims['verified'] else set())
    c.execute('INSERT INTO user_identities VALUES(?,?,?,?,?)', (row['provider'], claims['sub'], user_id, claims['email'], NOW()))
    c.execute('DELETE FROM oauth_states WHERE state=?', (row['state'],))
    return user_id, delivery


def settle(delivery, outbox):
    """What happened to each code once the delivery service answered."""
    status = {item['target']: item['status'] for item in outbox}
    return [dict(item, delivery=status.get(item['value'], item['delivery'])) for item in delivery]


def account_view(c, u):
    """The person's own account: name, sign-in methods and their verification, two-step verification, providers."""
    profile = c.execute('SELECT * FROM user_profiles WHERE user_id=?', (u['id'],)).fetchone()
    names = u['name'].split(' ', 1)
    now, contacts = time.time(), []
    for k in c.execute('SELECT * FROM user_contacts WHERE user_id=? ORDER BY kind,created_at', (u['id'],)).fetchall():
        code = None if k['verified_at'] else c.execute(
            "SELECT delivery,created,expires,used_at FROM verification_codes WHERE user_id=? AND target=? AND purpose='verify' ORDER BY created DESC LIMIT 1",
            (u['id'], k['value'])).fetchone()
        contacts.append(dict(kind=k['kind'], value=k['value'], verified=bool(k['verified_at']), verifiedAt=k['verified_at'] or '',
                             username=k['value'] == u['username'],
                             code=dict(delivery=code['delivery'], sentAt=dt.datetime.fromtimestamp(code['created'], dt.timezone.utc).isoformat(),
                                       open=code['used_at'] is None and code['expires'] > now) if code else None))
    rows = mfa_rows(c, u['id'])
    on = lambda m: bool(rows.get(m) and rows[m]['enabled_at'])
    mfa = dict(totp=dict(enabled=on('totp'), pending=bool(rows.get('totp')) and not on('totp')),
               recoveryLeft=len(json.loads(rows['recovery']['recovery'])) if on('recovery') else 0)
    for m in ('email', 'sms'):
        mfa[m] = dict(enabled=on(m), delivery=delivery_mode(m), contact=bool(verified_contact(c, u['id'], KIND_OF[m])))
    identities = [dict(provider=r['provider'], name=PROVIDERS.get(r['provider'], {}).get('name', r['provider']), email=r['email'], linkedAt=r['linked_at'])
                  for r in c.execute('SELECT * FROM user_identities WHERE user_id=? ORDER BY linked_at', (u['id'],))]
    members = [parish_brief(r) for r in c.execute("SELECT p.* FROM parishes p JOIN parish_links l ON l.parish_id=p.id WHERE l.user_id=? "
                                                   "AND l.kind='member' AND l.status='active' ORDER BY p.rowid", (u['id'],))]
    return dict(username=u['username'], name=u['name'], firstName=profile['first_name'] if profile else names[0],
                lastName=profile['last_name'] if profile else (names[1] if len(names) > 1 else ''), birthDate=profile['birth_date'] if profile else '',
                details=json.loads(profile['data']) if profile else {}, memberParishes=members,
                hasPassword=bool(u['password']), contacts=contacts, mfa=mfa, identities=identities, config=auth_config())


def confirm_identity(c, u, q):
    """Before turning off a safeguard: the password, or for an account without one, a current authenticator code."""
    if u['password']:
        require(password_matches(u['password'], str(q.get('password') or '')), 'Your password is not right.', 403)
        return
    totp = mfa_rows(c, u['id']).get('totp')
    if totp and totp['enabled_at']:
        require(mfa_check(c, u['id'], 'totp', q.get('code')), 'Enter a current code from your authenticator app.', 403)


def account_action(c, u, session, q, outbox):
    op, at = q.get('op'), NOW()
    if op == 'updateProfile':
        first, last = clean(q.get('firstName'), 60, 'Enter your first name.'), clean(q.get('lastName'), 60, 'Enter your last name.')
        c.execute('INSERT INTO user_profiles(user_id,first_name,last_name,updated_at) VALUES(?,?,?,?) '
                  'ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,updated_at=excluded.updated_at',
                  (u['id'], first, last, at))
        c.execute('UPDATE users SET name=? WHERE id=?', (f'{first} {last}', u['id']))
        audit(c, u, None, 'account.name-changed', {})
        return {}
    if op == 'saveProfile':
        before = account_profile(c, u)
        first, last = clean(q.get('firstName'), 60, 'Enter your first name.'), clean(q.get('lastName'), 60, 'Enter your last name.')
        born = birth_date(q.get('birthDate')) if q.get('birthDate') else before['birthDate']
        details = clean_profile(q)
        c.execute('INSERT INTO user_profiles VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name,'
                  'last_name=excluded.last_name,birth_date=excluded.birth_date,data=excluded.data,updated_at=excluded.updated_at',
                  (u['id'], first, last, born, json.dumps(details), at))
        c.execute('UPDATE users SET name=? WHERE id=?', (f'{first} {last}', u['id']))
        # What changed, by the field names the parish office already uses for update requests
        shown = lambda v: ', '.join(v) if isinstance(v, list) else ('Listed' if v else 'Not listed') if isinstance(v, bool) else (v or '(removed)')
        changes = {}
        if (first, last) != (before['firstName'], before['lastName']): changes.setdefault('name', []).append(f'{first} {last}')
        if born != before['birthDate']: changes.setdefault('date of birth', []).append(born)
        for key, value in details.items():
            if value != before['details'].get(key, [] if key == 'skills' else False if key == 'directory' else ''):
                changes.setdefault(PROFILE_LABELS[key], []).append(f'{key}: {shown(value)}' if PROFILE_LABELS[key] in {'address', 'emergency contact'} else shown(value))
        send_to = q.get('sendTo') or []
        require(isinstance(send_to, list), 'Choose parishes.')
        members = {l['parish_id'] for l in authority(c, u)['links'] if l['kind'] == 'member' and l['status'] == 'active'}
        sent = 0
        for pid in sorted(set(send_to)):
            require(pid in members, 'You can only send updates to parishes you are a member of.', 403)
            for field, values in changes.items():
                c.execute('INSERT INTO member_profile_requests VALUES(?,?,?,?,?,?,?)',
                          (secrets.token_hex(12), pid, u['id'], field, '; '.join(values)[:500], 'Submitted', at))
                audit(c, u, pid, 'profile.update-request', field)
                sent += 1
        audit(c, u, None, 'account.profile-saved', {'fields': sorted(changes)})
        return dict(sent=sent, changed=sorted(changes))
    if op in {'addContact', 'sendCode', 'verifyContact', 'removeContact'}:
        kind = q.get('kind')
        require(kind in CONTACT_KINDS, 'Choose an email address or a phone number.')
        value = contact_value(kind, q.get('value'))
        row = c.execute('SELECT * FROM user_contacts WHERE user_id=? AND kind=? AND value=?', (u['id'], kind, value)).fetchone()
        noun = 'email address' if kind == 'email' else 'phone number'
        if op == 'addContact':
            require(row is None, f'This {noun} is already on your account.', 409)
            require(contact_owner(c, kind, value) is None, f'This {noun} belongs to another account.', 409)
            require(c.execute('SELECT COUNT(*) FROM user_contacts WHERE user_id=? AND kind=?', (u['id'], kind)).fetchone()[0] < 3,
                    f'An account can have up to three of each. Remove one first.')
            c.execute('INSERT INTO user_contacts VALUES(?,?,?,?,?)', (u['id'], kind, value, None, at))
            audit(c, u, None, 'account.contact-added', {'kind': kind})
            return dict(delivery=issue_code(c, u['id'], 'verify', kind, value, outbox))
        require(row is not None, f'This {noun} is not on your account.', 404)
        if op == 'sendCode':
            require(not row['verified_at'], f'This {noun} is already verified.')
            return dict(delivery=issue_code(c, u['id'], 'verify', kind, value, outbox))
        if op == 'verifyContact':
            require(not row['verified_at'], f'This {noun} is already verified.')
            consume_code(c, u['id'], 'verify', value, q.get('code'))
            c.execute('UPDATE user_contacts SET verified_at=? WHERE user_id=? AND kind=? AND value=?', (at, u['id'], kind, value))
            audit(c, u, None, 'account.contact-verified', {'kind': kind})
            return {}
        require(value != u['username'], f'This {noun} is also your username, so it stays on your account.')
        method = CHANNEL[kind]
        rows = mfa_rows(c, u['id'])
        if rows.get(method) and rows[method]['enabled_at'] and row['verified_at']:
            others = c.execute('SELECT COUNT(*) FROM user_contacts WHERE user_id=? AND kind=? AND verified_at IS NOT NULL AND value<>?',
                               (u['id'], kind, value)).fetchone()[0]
            require(others, f'Two-step verification sends codes to this {noun}. Turn that off first, or verify another one.')
        c.execute('DELETE FROM user_contacts WHERE user_id=? AND kind=? AND value=?', (u['id'], kind, value))
        audit(c, u, None, 'account.contact-removed', {'kind': kind})
        return {}
    if op == 'changePassword':
        if u['password']:
            require(password_matches(u['password'], str(q.get('current') or '')), 'Your current password is not right.', 403)
        c.execute('UPDATE users SET password=? WHERE id=?', (password_hash(new_password(q)), u['id']))
        c.execute('DELETE FROM sessions WHERE user_id=? AND token<>?', (u['id'], session['token']))   # signed out everywhere else
        audit(c, u, None, 'account.password-changed', {})
        return {}
    if op == 'totpBegin':
        rows = mfa_rows(c, u['id'])
        require(not (rows.get('totp') and rows['totp']['enabled_at']), 'The authenticator app is already set up.')
        secret = base64.b32encode(secrets.token_bytes(20)).decode()
        c.execute('INSERT INTO user_mfa VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,method) DO UPDATE SET secret=excluded.secret,enabled_at=NULL,last_step=0',
                  (u['id'], 'totp', secret, None, 0, '[]'))
        label = quote(f'ParishLife:{u["username"]}')
        return dict(secret=secret, uri=f'otpauth://totp/{label}?secret={secret}&issuer=ParishLife&algorithm=SHA1&digits=6&period=30')
    if op == 'totpConfirm':
        row = mfa_rows(c, u['id']).get('totp')
        require(row is not None and not row['enabled_at'], 'Start the authenticator set-up again.')
        step = totp_step(row['secret'], q.get('code'), 0)
        require(step is not None, 'That code is not right. Check that the time on your phone is correct, then try the newest code.')
        c.execute("UPDATE user_mfa SET enabled_at=?,last_step=? WHERE user_id=? AND method='totp'", (at, step, u['id']))
        first_method = not any(r['enabled_at'] for m, r in mfa_rows(c, u['id']).items() if m in {'email', 'sms', 'recovery'})
        audit(c, u, None, 'account.mfa-on', {'method': 'totp'})
        return dict(recovery=new_recovery_codes(c, u['id']) if first_method else None)
    if op == 'mfaEnable':
        method = q.get('method')
        require(method in {'email', 'sms'}, 'Choose how to receive codes.')
        require(delivery_mode(method) != 'none', ('Email' if method == 'email' else 'Text message') +
                ' codes are not available: this server has no delivery service set up for them yet.')
        require(verified_contact(c, u['id'], KIND_OF[method]), 'Verify ' + ('an email address' if method == 'email' else 'a phone number') + ' first.')
        rows = mfa_rows(c, u['id'])
        first_method = not any(r['enabled_at'] for m, r in rows.items() if m in {'totp', 'email', 'sms', 'recovery'})
        c.execute('INSERT INTO user_mfa VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,method) DO UPDATE SET enabled_at=excluded.enabled_at',
                  (u['id'], method, '', at, 0, '[]'))
        audit(c, u, None, 'account.mfa-on', {'method': method})
        return dict(recovery=new_recovery_codes(c, u['id']) if first_method else None)
    if op == 'mfaDisable':
        method = q.get('method')
        require(method in {'totp', 'email', 'sms'}, 'Choose a method.')
        confirm_identity(c, u, q)
        c.execute('DELETE FROM user_mfa WHERE user_id=? AND method=?', (u['id'], method))
        if not any(r['enabled_at'] for m, r in mfa_rows(c, u['id']).items() if m in {'totp', 'email', 'sms'}):
            c.execute("DELETE FROM user_mfa WHERE user_id=? AND method='recovery'", (u['id'],))
        audit(c, u, None, 'account.mfa-off', {'method': method})
        return {}
    if op == 'recoveryCodes':
        require(login_methods(c, u['id'])[1], 'Turn on two-step verification first.')
        confirm_identity(c, u, q)
        audit(c, u, None, 'account.recovery-codes', {})
        return dict(recovery=new_recovery_codes(c, u['id']))
    if op == 'unlinkProvider':
        provider = q.get('provider')
        row = c.execute('SELECT * FROM user_identities WHERE user_id=? AND provider=?', (u['id'], provider)).fetchone()
        require(row is not None, 'This sign-in provider is not linked.', 404)
        others = c.execute('SELECT COUNT(*) FROM user_identities WHERE user_id=? AND provider<>?', (u['id'], provider)).fetchone()[0]
        require(u['password'] or others, 'Set a password first, so you can still sign in afterwards.')
        c.execute('DELETE FROM user_identities WHERE user_id=? AND provider=?', (u['id'], provider))
        audit(c, u, None, 'account.provider-unlinked', {'provider': provider})
        return {}
    raise Problem(400, 'Unknown account action.')


# ───────────── Parish connections: following, membership, invitations, the profile ─────────────
# An account is an ordinary user. Following a parish, being a formal member of it, belonging to a
# ministry and holding a staff role are separate relationships; one account can have several, in
# several parishes. Membership is asked for and the parish office decides, linking the account to
# an existing person record or creating one; nothing is linked or changed in parish records without it.
CONNECTIONS_SCHEMA = '''
CREATE TABLE IF NOT EXISTS membership_requests(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  parish_id TEXT NOT NULL REFERENCES parishes(id), status TEXT NOT NULL, message TEXT NOT NULL DEFAULT '',
  profile TEXT NOT NULL DEFAULT '{}', person_id TEXT, invitation_id TEXT, created_at TEXT NOT NULL,
  decided_at TEXT, decided_by TEXT, decision_note TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS membership_requests_parish ON membership_requests(parish_id,status);
CREATE INDEX IF NOT EXISTS membership_requests_user ON membership_requests(user_id,status);
CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), person_id TEXT NOT NULL,
  channel TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, created_by TEXT,
  expires REAL NOT NULL, delivery TEXT NOT NULL, accepted_at TEXT, accepted_by TEXT, revoked_at TEXT, revoked_by TEXT);
CREATE INDEX IF NOT EXISTS invitations_person ON invitations(parish_id,person_id);
CREATE VIEW IF NOT EXISTS parish_accounts AS
  SELECT l.user_id AS user_id, l.parish_id AS parish_id, l.person_id AS person_id, 'member' AS role
    FROM parish_links l JOIN users u ON u.id=l.user_id WHERE l.kind='member' AND l.status='active' AND u.role<>'disabled'
  UNION
  SELECT r.user_id, r.scope_id, COALESCE((SELECT l.person_id FROM parish_links l WHERE l.user_id=r.user_id AND l.parish_id=r.scope_id
      AND l.status='active'), u.person_id), r.role
    FROM role_assignments r JOIN users u ON u.id=r.user_id WHERE r.scope='parish' AND r.status='active' AND u.role<>'disabled'
  UNION
  SELECT u.id, a.parish_id, u.person_id, u.role FROM users u JOIN assignments a ON a.user_id=u.id
    WHERE u.role<>'disabled' AND NOT EXISTS (SELECT 1 FROM role_assignments r WHERE r.user_id=u.id)
      AND NOT EXISTS (SELECT 1 FROM parish_links l WHERE l.user_id=u.id);
'''
INVITATION_DAYS = 14
# The person-profile fields a parishioner may fill in themselves; status, tags, households, notes and
# sacramental records stay with the office.
PROFILE_TEXT = {'arabicName': 120, 'town': 120, 'address': 300, 'rite': 40, 'occupation': 120, 'emergencyName': 120, 'emergencyPhone': 40}
PROFILE_CHOICES = {'language': {'', 'en', 'ar'}, 'channel': {'', 'whatsapp', 'sms', 'email'},
                   'bloodType': {'', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'}}
PROFILE_LABELS = {'arabicName': 'arabic name', 'town': 'address', 'address': 'address', 'rite': 'rite', 'occupation': 'line of work',
                  'emergencyName': 'emergency contact', 'emergencyPhone': 'emergency contact', 'language': 'language',
                  'channel': 'contact preference', 'bloodType': 'blood type', 'directory': 'directory listing', 'skills': 'skills',
                  'birthDate': 'date of birth', 'name': 'name'}
PROFILE_REQUEST_FIELDS = {'name', 'phone', 'email', 'address', 'emergency contact', 'date of birth', 'ministry memberships', 'profile picture',
                          'arabic name', 'rite', 'line of work', 'language', 'contact preference', 'blood type', 'directory listing', 'skills'}


def account_profile(c, u):
    """The account's own details, as a membership request carries them to a parish office."""
    p = c.execute('SELECT * FROM user_profiles WHERE user_id=?', (u['id'],)).fetchone()
    names = u['name'].split(' ', 1)
    contacts = [dict(kind=k['kind'], value=k['value'], verified=bool(k['verified_at']))
                for k in c.execute('SELECT * FROM user_contacts WHERE user_id=? ORDER BY kind,created_at', (u['id'],))]
    return dict(firstName=p['first_name'] if p else names[0], lastName=p['last_name'] if p else (names[1] if len(names) > 1 else ''),
                birthDate=p['birth_date'] if p else '', details=json.loads(p['data']) if p else {}, contacts=contacts)


def clean_profile(q):
    """The self-service profile fields; anything left out stays empty rather than invented."""
    out = {}
    for key, limit in PROFILE_TEXT.items():
        out[key] = clean(q.get(key), limit, 'Check the ' + PROFILE_LABELS[key] + '.', required=False)
    for key, allowed in PROFILE_CHOICES.items():
        value = str(q.get(key) or '')
        require(value in allowed, 'Check the ' + PROFILE_LABELS[key] + '.')
        out[key] = value
    out['directory'] = bool(q.get('directory'))
    skills = q.get('skills') or []
    require(isinstance(skills, list) and len(skills) <= 30 and all(isinstance(s, str) and 0 < len(s.strip()) <= 80 for s in skills), 'Check your skills.')
    out['skills'] = sorted({' '.join(s.split()) for s in skills})
    if out['emergencyPhone']: out['emergencyPhone'] = contact_value('phone', out['emergencyPhone'])
    return out


def public_parish(c, pid):
    """What a parish's public page shows, and what its followers see."""
    row = c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()
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
             for item in c.execute("SELECT title,body,created_at FROM member_content WHERE parish_id=? AND group_id IS NULL AND kind IN ('post','announcement') ORDER BY created_at DESC LIMIT 50", (pid,))]
    posts.extend(dict(title=n.get('title', ''), body=n.get('ar', ''), at=n.get('at', ''))
                 for n in public_state.get('NOTICES', []) if n.get('audience') == 'Parish' and not n.get('groupId'))
    posts.sort(key=lambda item: item['at'], reverse=True)
    public = {key: parish.get(key, '') for key in ('name', 'nameAr', 'town', 'townAr', 'rite', 'riteAr', 'address', 'addressAr', 'phone')}
    # Every parish page wears the one shared website theme; a parish's own colours are not published.
    if not content.get('contact'):
        public.update(address='', addressAr='', phone='')
    public.update(public_place(c, pid, public_state))
    modules = parish_plan(c, pid)['modules']
    return {'parish': public, 'content': content, 'events': events, 'posts': posts,
            'ministries': public_ministries(public_state) if 'ministries' in modules else [],
            'clergy': public_clergy(c, pid), 'gallery': public_gallery(c, pid),
            'modules': modules, 'documentsOpen': documents_open(c, pid)}


def public_place(c, pid, state):
    """Where a parish is, for the directory's filters and map: its diocese, rite, published coordinates
    (only when the parish entered them) and whether it is demonstration data."""
    row = c.execute('SELECT p.diocese,p.metadata,d.name,d.metadata AS dmeta FROM parishes p LEFT JOIN dioceses d ON d.id=p.diocese WHERE p.id=?', (pid,)).fetchone()
    meta, dmeta = json.loads(row['metadata']), json.loads(row['dmeta'] or '{}')
    loc = state['PARISH'].get('location')
    return dict(diocese=row['diocese'], dioceseName=row['name'] or '', dioceseAr=dmeta.get('ar', ''),
                rite=state['PARISH'].get('rite', ''), riteAr=state['PARISH'].get('riteAr', ''),
                location=dict(lat=loc['lat'], lng=loc['lng']) if isinstance(loc, dict) else None, demo=bool(meta.get('demo')))


def public_clergy(c, pid):
    """The clergy serving a parish now: name, current title, responsibility and the photo the parish published."""
    order = {'parish-priest': 0, 'assistant-priest': 1, 'deacon': 2}
    out = []
    for r in c.execute('SELECT cl.id,cl.name,cl.name_ar,a.office FROM clergy_assignments a JOIN clergy cl ON cl.id=a.clergy_id '
                       'WHERE a.parish_id=? AND a.end_date IS NULL', (pid,)).fetchall():
        title = c.execute('SELECT title FROM clergy_titles WHERE clergy_id=? AND effective_from<=? ORDER BY effective_from DESC,set_at DESC LIMIT 1',
                          (r['id'], TODAY())).fetchone()
        photo = c.execute("SELECT id FROM uploaded_files WHERE parish_id=? AND scope='clergy' AND owner_id=? ORDER BY created_at DESC LIMIT 1", (pid, r['id'])).fetchone()
        office = CLERGY_OFFICES.get(r['office'], CLERGY_OFFICES['other'])
        out.append(dict(id=r['id'], name=r['name'], nameAr=r['name_ar'], title=title['title'] if title else '', office=r['office'],
                        officeEn=office[0], officeAr=office[1], photo=f'/api/public/parishes/{pid}/images/{photo["id"]}' if photo else None))
    out.sort(key=lambda x: (order.get(x['office'], 3), x['name']))
    return out


def public_gallery(c, pid):
    return [dict(id=r['id'], name=r['name'], url=f'/api/public/parishes/{pid}/images/{r["id"]}', at=r['created_at'])
            for r in c.execute("SELECT id,name,created_at FROM uploaded_files WHERE parish_id=? AND scope='gallery' AND owner_id=? "
                               "AND mime LIKE 'image/%' ORDER BY created_at DESC LIMIT 60", (pid, pid))]


def public_image(c, pid, file_id):
    row = c.execute("SELECT * FROM uploaded_files WHERE parish_id=? AND id=? AND scope IN ('gallery','clergy') AND mime LIKE 'image/%'", (pid, file_id)).fetchone()
    require(row is not None, 'Image not found.', 404)
    return row


def public_directory(c):
    """Every parish registered in ParishLife, with what the directory filters and the map need."""
    out = []
    for row in c.execute('SELECT id,metadata FROM parishes ORDER BY rowid').fetchall():
        meta = json.loads(row['metadata'])
        state = c.execute('SELECT data FROM states WHERE parish_id=?', (row['id'],)).fetchone()
        place = public_place(c, row['id'], json.loads(state['data'])) if state else {}
        out.append(dict(id=row['id'], name=meta.get('name', ''), ar=meta.get('ar', ''), town=meta.get('town', ''), townAr=meta.get('townAr', ''), **place))
    return out


def public_config():
    """What the public pages may use. The map provider is offered only once a browser key is configured."""
    key = os.environ.get('PARISHLIFE_GOOGLE_MAPS_KEY', '').strip()
    return dict(maps=dict(provider='google', key=key) if key else None)


def parish_brief(row):
    meta = json.loads(row['metadata'])
    return dict(id=row['id'], name=meta.get('name', ''), ar=meta.get('ar', ''), town=meta.get('town', ''), townAr=meta.get('townAr', ''),
                diocese=row['diocese'])


def connections_view(c, u):
    """The account's parishes — staff roles, membership, following and requests — and what is new in them."""
    auth = authority(c, u)
    links = {l['parish_id']: l for l in auth['links']}
    requests = [dict(r) for r in c.execute('SELECT * FROM membership_requests WHERE user_id=? ORDER BY created_at DESC', (u['id'],))]
    pending = {r['parish_id']: r for r in requests if r['status'] == 'pending'}
    today, out, feed = TODAY(), [], dict(events=[], posts=[])
    rows = c.execute('SELECT * FROM parishes ORDER BY rowid').fetchall()
    for r in rows:
        link = links.get(r['id']) if links.get(r['id'], {}).get('status') == 'active' else None
        ctx = parish_context(c, u, r['id'], auth, r)
        if not (ctx or link or r['id'] in pending): continue
        item = parish_brief(r)
        role = ctx['role'] if ctx else None
        item.update(kind=link['kind'] if link else None, role=role, roleTitle=ROLE_TITLES[role] if role else None,
                    primary=bool(link and link['is_primary']), request=dict(id=pending[r['id']]['id'], at=pending[r['id']]['created_at'])
                    if r['id'] in pending else None)
        out.append(item)
        if link:   # the news of parishes followed or belonged to; staff see their own parish in its workspace
            public = public_parish(c, r['id'])
            for e in sorted((e for e in public['events'] if str(e.get('d', '')) >= today), key=lambda e: (str(e.get('d', '')), str(e.get('t', ''))))[:6]:
                feed['events'].append(dict(e, parish=r['id']))
            for p in public['posts'][:4]:
                feed['posts'].append(dict(p, parish=r['id']))
    feed['events'].sort(key=lambda e: (str(e.get('d', '')), str(e.get('t', ''))))
    feed['posts'].sort(key=lambda p: p['at'], reverse=True)
    names = {r['id']: parish_brief(r) for r in rows}
    return dict(parishes=out, directory=[parish_brief(r) for r in rows], feed=feed,
                requests=[dict(id=r['id'], parish=r['parish_id'], parishName=names.get(r['parish_id'], {}).get('name', ''),
                               parishAr=names.get(r['parish_id'], {}).get('ar', ''), status=r['status'], message=r['message'],
                               createdAt=r['created_at'], decidedAt=r['decided_at'] or '', note=r['decision_note'],
                               invited=bool(r['invitation_id'])) for r in requests])


def invitation_row(c, token):
    row = c.execute('SELECT * FROM invitations WHERE token=?', (sha(str(token or '')),)).fetchone()
    require(row is not None and not row['revoked_at'] and not row['accepted_at'] and row['expires'] > time.time(),
            'This invitation is no longer valid. Ask the parish office for a new one.', 404)
    return row


def invitation_info(c, token):
    """What the sign-in page says about an invitation link: which parish sent it, and to whom."""
    row = invitation_row(c, token)
    parish = c.execute('SELECT * FROM parishes WHERE id=?', (row['parish_id'],)).fetchone()
    state = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (row['parish_id'],)).fetchone()['data'])
    person = next((p for p in state['PEOPLE'] if p['id'] == row['person_id']), None)
    return dict(parish=parish_brief(parish), firstName=(person or {}).get('lat', '').split(' ')[0])


def follow(c, u, pid, at):
    link = c.execute('SELECT * FROM parish_links WHERE user_id=? AND parish_id=?', (u['id'], pid)).fetchone()
    if link and link['status'] == 'active': return
    primary = 0 if c.execute("SELECT 1 FROM parish_links WHERE user_id=? AND status='active' AND is_primary=1", (u['id'],)).fetchone() else 1
    c.execute("INSERT INTO parish_links(user_id,parish_id,kind,status,person_id,is_primary,note,created_at) VALUES(?,?,'follow','active',NULL,?,'',?) "
              "ON CONFLICT(user_id,parish_id) DO UPDATE SET kind='follow',status='active',person_id=NULL,is_primary=excluded.is_primary,created_at=excluded.created_at",
              (u['id'], pid, primary, at))


def connections_action(c, u, q):
    op, at = q.get('op'), NOW()
    auth = authority(c, u)
    if op == 'acceptInvite':
        row = invitation_row(c, q.get('token'))
        pid = row['parish_id']
    else:
        pid = q.get('parish')
    parish = c.execute('SELECT * FROM parishes WHERE id=?', (pid,)).fetchone() if isinstance(pid, str) else None
    require(parish is not None, 'Choose a parish.', 404)
    require(not is_blocked(auth, parish['diocese'], pid), 'Your access to this parish has been deactivated.', 403)
    materialize_legacy(c, u)
    link = c.execute('SELECT * FROM parish_links WHERE user_id=? AND parish_id=?', (u['id'], pid)).fetchone()
    active = link if link and link['status'] == 'active' else None
    pending = c.execute("SELECT * FROM membership_requests WHERE user_id=? AND parish_id=? AND status='pending'", (u['id'], pid)).fetchone()
    if op == 'follow':
        require(not active, 'You are already connected to this parish.')
        follow(c, u, pid, at)
        audit(c, u, pid, 'parish.followed', {})
        return {}
    if op == 'unfollow':
        require(active and active['kind'] == 'follow', 'You are not following this parish.')
        require(not pending, 'Withdraw your membership request first.')
        c.execute("UPDATE parish_links SET status='ended',is_primary=0,decided_at=? WHERE user_id=? AND parish_id=?", (at, u['id'], pid))
        audit(c, u, pid, 'parish.unfollowed', {})
        return {}
    if op == 'setPrimary':
        require(active, 'Follow or join this parish first.')
        c.execute('UPDATE parish_links SET is_primary=0 WHERE user_id=?', (u['id'],))
        c.execute('UPDATE parish_links SET is_primary=1 WHERE user_id=? AND parish_id=?', (u['id'], pid))
        return {}
    if op in {'requestMembership', 'acceptInvite'}:
        require_module(c, pid, 'members', 'membership through ParishLife')
        require(not (active and active['kind'] == 'member'), 'You are already a member of this parish.')
        require(not pending, 'Your request is already with the parish office.', 409)
        message = clean(q.get('message'), 500, 'Keep your message within 500 characters.', required=False)
        invitation = row if op == 'acceptInvite' else None
        if invitation:
            require(not c.execute("SELECT 1 FROM parish_links WHERE parish_id=? AND person_id=? AND kind='member' AND status='active'",
                                  (pid, invitation['person_id'])).fetchone(), 'This parish record is already linked to an account.', 409)
            c.execute('UPDATE invitations SET accepted_at=?,accepted_by=? WHERE id=?', (at, u['id'], invitation['id']))
        rid = 'mr-' + secrets.token_hex(8)
        c.execute('INSERT INTO membership_requests(id,user_id,parish_id,status,message,profile,person_id,invitation_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
                  (rid, u['id'], pid, 'pending', message, json.dumps(account_profile(c, u)), invitation['person_id'] if invitation else None,
                   invitation['id'] if invitation else None, at))
        follow(c, u, pid, at)   # while the office decides, the parish's public news reaches the account
        audit(c, u, pid, 'membership.requested', {'request': rid, 'invited': bool(invitation)})
        return dict(id=rid, parish=pid)
    if op == 'withdrawRequest':
        require(pending is not None and pending['id'] == q.get('id'), 'There is no open request to withdraw.', 404)
        c.execute("UPDATE membership_requests SET status='withdrawn',decided_at=?,decided_by=? WHERE id=?", (at, u['id'], pending['id']))
        audit(c, u, pid, 'membership.withdrawn', {'request': pending['id']})
        return {}
    raise Problem(400, 'Unknown action.')


def office_connections(c, pid):
    """Membership requests and invitations, for staff who manage people."""
    users = {}
    requests = []
    for r in c.execute("SELECT * FROM membership_requests WHERE parish_id=? AND (status='pending' OR decided_at>?) ORDER BY created_at DESC",
                       (pid, (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=60)).isoformat())).fetchall():
        account = users.get(r['user_id']) or c.execute('SELECT id,username,name FROM users WHERE id=?', (r['user_id'],)).fetchone()
        users[r['user_id']] = account
        requests.append(dict(id=r['id'], status=r['status'], message=r['message'], profile=json.loads(r['profile']), personId=r['person_id'],
                             invited=bool(r['invitation_id']), createdAt=r['created_at'], decidedAt=r['decided_at'] or '', note=r['decision_note'],
                             account=dict(name=account['name'], username=account['username'])))
    invitations = [dict(id=r['id'], personId=r['person_id'], channel=r['channel'], target=r['target'], delivery=r['delivery'],
                        createdAt=r['created_at'], expiresAt=dt.datetime.fromtimestamp(r['expires'], dt.timezone.utc).isoformat(),
                        accepted=bool(r['accepted_at']), revoked=bool(r['revoked_at']))
                   for r in c.execute('SELECT * FROM invitations WHERE parish_id=? ORDER BY created_at DESC LIMIT 200', (pid,))]
    return requests, invitations


def person_from_profile(profile, at):
    """A new person record made from what the account holder entered; empty where they left it empty."""
    details = profile.get('details', {})
    phone = next((k['value'] for k in profile.get('contacts', []) if k['kind'] == 'phone'), '')
    email = next((k['value'] for k in profile.get('contacts', []) if k['kind'] == 'email'), '')
    name = f"{profile.get('firstName', '')} {profile.get('lastName', '')}".strip()
    person = dict(id='p' + secrets.token_hex(8), lat=name, ar=details.get('arabicName') or name, town=details.get('town', ''),
                  townAr='', rite=details.get('rite', ''), status='member', phone=record_phone(phone) if phone else '—', email=email,
                  born=profile.get('birthDate', ''), hh=None, tags=[],
                  registeredOnline=dict(at=at, via='account', verified=any(k['verified'] for k in profile.get('contacts', []))))
    extra = dict(skills=details.get('skills', []), dates=[], occupation=details.get('occupation', ''), directory=bool(details.get('directory')))
    for key, target in (('language', 'lang'), ('channel', 'channel'), ('bloodType', 'blood')):
        if details.get(key): extra[target] = details[key]
    if email: extra['email'] = email
    return person, extra


def office_connection_action(c, u, pid, q, outbox, base_url):
    u = parish_user(c, u, pid)
    require('people.manage' in perms_of(u), 'Permission to manage people is required.', 403)
    op, at = q.get('op'), NOW()
    if op in {'approveMembership', 'declineMembership'}:
        r = c.execute("SELECT * FROM membership_requests WHERE id=? AND parish_id=? AND status='pending'", (q.get('id'), pid)).fetchone()
        require(r is not None, 'This request has already been decided or withdrawn.', 404)
        if op == 'declineMembership':
            note = clean(q.get('note'), 500, 'Say briefly why, so the person knows what to do next.')
            c.execute("UPDATE membership_requests SET status='declined',decided_at=?,decided_by=?,decision_note=? WHERE id=?", (at, u['id'], note, r['id']))
            audit(c, u, pid, 'membership.declined', {'request': r['id']})
            return {}
        row = c.execute('SELECT * FROM states WHERE parish_id=?', (pid,)).fetchone()
        d = json.loads(row['data'])
        revision = row['revision']
        if q.get('create'):
            person, extra = person_from_profile(json.loads(r['profile']), at)
            d['PEOPLE'].append(person); d['PERSON_EXTRA'][person['id']] = extra
            d = migrate_state(d); validate(d); sync_relationships(c, pid, d)
            c.execute('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', (json.dumps(d), pid))
            person_id, revision = person['id'], revision + 1
        else:
            person_id = q.get('personId')
            require(any(p['id'] == person_id for p in d['PEOPLE']), 'Choose the person record to link.')
        require(not c.execute("SELECT 1 FROM parish_links WHERE parish_id=? AND person_id=? AND kind='member' AND status='active' AND user_id<>?",
                              (pid, person_id, r['user_id'])).fetchone(), 'This person record is already linked to another account.', 409)
        primary = 0 if c.execute("SELECT 1 FROM parish_links WHERE user_id=? AND status='active' AND is_primary=1 AND parish_id<>?",
                                 (r['user_id'], pid)).fetchone() else 1
        c.execute("INSERT INTO parish_links(user_id,parish_id,kind,status,person_id,is_primary,note,created_at,decided_at,decided_by) "
                  "VALUES(?,?,'member','active',?,?,'',?,?,?) ON CONFLICT(user_id,parish_id) DO UPDATE SET kind='member',status='active',"
                  "person_id=excluded.person_id,is_primary=MAX(parish_links.is_primary,excluded.is_primary),decided_at=excluded.decided_at,decided_by=excluded.decided_by",
                  (r['user_id'], pid, person_id, primary, at, at, u['id']))
        c.execute("UPDATE membership_requests SET status='approved',person_id=?,decided_at=?,decided_by=? WHERE id=?", (person_id, at, u['id'], r['id']))
        notify_member(c, pid, r['user_id'], 'membership', 'You are now a member of the parish', 'Your parish office approved your membership.', 'memberhome')
        audit(c, u, pid, 'membership.approved', {'request': r['id'], 'person': person_id, 'created': bool(q.get('create'))})
        return dict(personId=person_id, revision=revision)
    if op == 'invite':
        state = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()['data'])
        person = next((p for p in state['PEOPLE'] if p['id'] == q.get('personId')), None)
        require(person is not None, 'Choose a person.', 404)
        require(not c.execute("SELECT 1 FROM parish_links WHERE parish_id=? AND person_id=? AND kind='member' AND status='active'",
                              (pid, person['id'])).fetchone(), 'This person already has an account linked.', 409)
        channel = q.get('channel')
        require(channel in {'email', 'sms', 'link'}, 'Choose how to send the invitation.')
        target = '' if channel == 'link' else contact_value('email' if channel == 'email' else 'phone', q.get('target'))
        c.execute('UPDATE invitations SET revoked_at=?,revoked_by=? WHERE parish_id=? AND person_id=? AND revoked_at IS NULL AND accepted_at IS NULL',
                  (at, u['id'], pid, person['id']))
        token, iid = secrets.token_urlsafe(24), 'inv-' + secrets.token_hex(8)
        link = f'{base_url}/index.html?invite={token}'
        mode = 'none' if channel == 'link' else delivery_mode(channel)
        delivery = 'link-only' if channel == 'link' else {'none': 'not-configured', 'service': 'sending', 'console': 'console'}[mode]
        c.execute('INSERT INTO invitations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                  (iid, pid, person['id'], channel, target, sha(token), at, u['id'], time.time() + INVITATION_DAYS * 86400, delivery, None, None, None, None))
        if mode in {'service', 'console'}:
            parish_name = state['PARISH'].get('name', 'Your parish')
            outbox.append(dict(id=iid, table='invitations', channel=channel, target=target, mode=mode, status=delivery,
                               subject=f'{parish_name} invites you to ParishLife',
                               text=f'{parish_name} invites you to ParishLife, to see parish news and send requests to the office. '
                                    f'Open this link within {INVITATION_DAYS} days: {link}'))
        audit(c, u, pid, 'person.invited', {'person': person['id'], 'channel': channel})
        return dict(id=iid, link=link, delivery=delivery)
    if op == 'revokeInvite':
        inv = c.execute('SELECT * FROM invitations WHERE id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
        require(inv is not None and not inv['revoked_at'] and not inv['accepted_at'], 'This invitation is no longer open.', 404)
        c.execute('UPDATE invitations SET revoked_at=?,revoked_by=? WHERE id=?', (at, u['id'], inv['id']))
        audit(c, u, pid, 'person.invitation-revoked', {'invitation': inv['id']})
        return {}
    raise Problem(400, 'Unknown action.')


def sync_ministry_leaders(c, actor, pid, d, people):
    """Someone who leads or assists a ministry works in the leader workspace of that parish; when they no
    longer do, that ends. Staff appointments made by an administrator are left alone."""
    leading = {g.get(f) for g in d['GROUPS'] for f in ('leader', 'assistant')} - {None, ''}
    for person_id in people:
        for row in c.execute('SELECT DISTINCT user_id FROM parish_accounts WHERE parish_id=? AND person_id=?', (pid, person_id)).fetchall():
            user = c.execute('SELECT * FROM users WHERE id=?', (row['user_id'],)).fetchone()
            materialize_legacy(c, user)
            current = c.execute("SELECT 1 FROM role_assignments WHERE user_id=? AND role='leader' AND scope='parish' AND scope_id=? AND status='active'",
                                (user['id'], pid)).fetchone()
            if person_id in leading and not current:
                c.execute('INSERT INTO role_assignments(id,user_id,role,scope,scope_id,note,source,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
                          ('ra-' + secrets.token_hex(10), user['id'], 'leader', 'parish', pid, 'Leads or assists a ministry', 'ministry', NOW(), actor['id']))
            elif person_id not in leading and current:
                c.execute("UPDATE role_assignments SET status='ended',ended_at=?,ended_by=? WHERE user_id=? AND role='leader' AND scope='parish' "
                          "AND scope_id=? AND status='active' AND source IN ('ministry','migrated')", (NOW(), actor['id'], user['id'], pid))


# ───────────── Ministries: public profiles, inquiries, applications, departures ─────────────
# A public ministry is described on the parish page with its leader's name only; the parish's own
# published contact details are the way in. Guests can say they are interested without an account,
# which grants nothing. Members apply: the ministry leader approves, then the parish priest (who may
# also approve straight away). Leaving is a private request only the parish's priests see.
MINISTRY_SCHEMA = '''
CREATE TABLE IF NOT EXISTS ministry_applications(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), group_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id), person_id TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, leader_by TEXT, leader_at TEXT, priest_by TEXT, priest_at TEXT, decision_note TEXT NOT NULL DEFAULT '',
  withdraw_requested_at TEXT, withdraw_note TEXT NOT NULL DEFAULT '', closed_at TEXT, closed_by TEXT);
CREATE INDEX IF NOT EXISTS ministry_applications_group ON ministry_applications(parish_id,group_id,status);
CREATE TABLE IF NOT EXISTS ministry_departures(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), group_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id), person_id TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
  created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT, note TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ministry_inquiries(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), group_id TEXT NOT NULL,
  name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
  created_at TEXT NOT NULL, handled_by TEXT, handled_at TEXT, note TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS ministry_inquiries_parish ON ministry_inquiries(parish_id,status);
CREATE TABLE IF NOT EXISTS account_notifications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), parish_id TEXT,
  kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', route TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, read_at TEXT);
CREATE INDEX IF NOT EXISTS account_notifications_user ON account_notifications(user_id,created_at);
'''
GROUP_PROFILE = ('about', 'aboutAr', 'duties', 'dutiesAr', 'howToJoin', 'howToJoinAr')
OPEN_APPLICATION = ('pending', 'leader-approved')
INQUIRIES_PER_HOUR = 20


def public_ministries(d):
    """What the public page says about each public ministry. Leaders are named; their phone numbers and
    email addresses are never published — the parish's own contact details are the way in."""
    people = {p['id']: p for p in d['PEOPLE']}
    out = []
    for g in d['GROUPS']:
        if g.get('vis', 'public') != 'public': continue
        leader = people.get(g.get('leader'))
        out.append(dict({k: g.get(k, '') for k in ('id', 'name', 'ar', 'cat', 'catAr', 'meets', 'meetsAr') + GROUP_PROFILE},
                        leader=dict(name=leader.get('lat', ''), ar=leader.get('ar', '')) if leader else None))
    return out


def notify_account(c, user_id, pid, kind, title, body='', route=''):
    c.execute('INSERT INTO account_notifications VALUES(?,?,?,?,?,?,?,?,?)',
              (secrets.token_hex(12), user_id, pid, kind, title, body[:300], route, NOW(), None))


def parish_priest_accounts(c, pid):
    return [r['user_id'] for r in c.execute("SELECT DISTINCT user_id FROM parish_accounts WHERE parish_id=? AND role='priest'", (pid,))]


def bishop_accounts(c, diocese):
    rows = c.execute("SELECT DISTINCT user_id FROM role_assignments WHERE role='bishop' AND scope='diocese' AND scope_id=? AND status='active' "
                     "UNION SELECT u.id FROM users u WHERE u.role='bishop' AND u.diocese=? AND NOT EXISTS "
                     "(SELECT 1 FROM role_assignments r WHERE r.user_id=u.id)", (diocese, diocese))
    return [r[0] for r in rows]


def group_leader_accounts(c, pid, group):
    people = [p for p in (group.get('leader'), group.get('assistant')) if p]
    if not people: return []
    return [r['user_id'] for r in c.execute(f"SELECT DISTINCT user_id FROM parish_accounts WHERE parish_id=? AND person_id IN ({','.join('?' * len(people))})",
                                            (pid, *people))]


def ministry_inquiry(c, pid, q):
    """A guest says they are interested in a ministry. It reaches the office and the ministry's leaders; it
    makes nobody a member and opens nothing private."""
    require(not q.get('website'), 'The message could not be sent.')  # a field only robots fill in
    row = c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()
    require(row is not None, 'Parish not found.', 404)
    d = json.loads(row['data'])
    require_module(c, pid, 'ministries', 'ministry inquiries')
    group = next((g for g in d['GROUPS'] if g['id'] == q.get('groupId') and g.get('vis', 'public') == 'public'), None)
    require(group is not None, 'Choose a ministry.', 404)
    name = clean(q.get('name'), 120, 'Enter your name.')
    email = contact_value('email', q.get('email')) if str(q.get('email') or '').strip() else ''
    phone = contact_value('phone', q.get('phone')) if str(q.get('phone') or '').strip() else ''
    require(email or phone, 'Give a phone number or an email address, so the parish can reply.')
    message = clean(q.get('message'), 1000, 'Keep your message within 1000 characters.', required=False)
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)).isoformat()
    require(c.execute('SELECT COUNT(*) FROM ministry_inquiries WHERE parish_id=? AND created_at>?', (pid, since)).fetchone()[0] < INQUIRIES_PER_HOUR,
            'Many messages reached this parish in the last hour. Please try again later or call the parish office.', 429)
    iid = 'mi-' + secrets.token_hex(8)
    c.execute('INSERT INTO ministry_inquiries(id,parish_id,group_id,name,email,phone,message,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
              (iid, pid, group['id'], name, email, phone, message, 'new', NOW()))
    for user_id in group_leader_accounts(c, pid, group):
        notify_account(c, user_id, pid, 'ministry-inquiry', f"Someone is interested in {group['name']}", '', f"groups/{group['id']}")
    audit(c, {'id': None}, pid, 'ministry.inquiry', {'group': group['id'], 'inquiry': iid})
    return {}


def ministry_scope(u, d):
    """Which ministries' applications and inquiries this account handles: a priest and the office see every
    ministry; a leader sees the ministries they lead or assist."""
    if u['roleCode'] == 'priest' or 'ministries.manage' in perms_of(u): return {g['id'] for g in d['GROUPS']}
    return {g['id'] for g in d['GROUPS'] if u['person_id'] and u['person_id'] in {g.get('leader'), g.get('assistant')}}


def ministry_lists(c, u, pid, d):
    """For the parish workspace. Departure requests and their reasons go to the parish's priests only."""
    scope = ministry_scope(u, d)
    names = {}
    def name_of(user_id):
        if user_id and user_id not in names:
            row = c.execute('SELECT name FROM users WHERE id=?', (user_id,)).fetchone()
            names[user_id] = row['name'] if row else ''
        return names.get(user_id, '')
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=90)).isoformat()
    apps = [dict(id=a['id'], groupId=a['group_id'], personId=a['person_id'], account=name_of(a['user_id']), status=a['status'],
                 message=a['message'], createdAt=a['created_at'], leaderBy=name_of(a['leader_by']), leaderAt=a['leader_at'] or '',
                 priestBy=name_of(a['priest_by']), priestAt=a['priest_at'] or '', note=a['decision_note'],
                 withdrawRequested=a['withdraw_requested_at'] or '', withdrawNote=a['withdraw_note'])
            for a in c.execute("SELECT * FROM ministry_applications WHERE parish_id=? AND (status IN ('pending','leader-approved') OR created_at>?) "
                               "ORDER BY created_at DESC", (pid, since)) if a['group_id'] in scope]
    inquiries = [dict(id=i['id'], groupId=i['group_id'], name=i['name'], email=i['email'], phone=i['phone'], message=i['message'],
                      status=i['status'], createdAt=i['created_at'], note=i['note'], handledBy=name_of(i['handled_by']))
                 for i in c.execute("SELECT * FROM ministry_inquiries WHERE parish_id=? AND (status='new' OR created_at>?) ORDER BY created_at DESC",
                                    (pid, since)) if i['group_id'] in scope]
    departures = [dict(id=x['id'], groupId=x['group_id'], personId=x['person_id'], reason=x['reason'], status=x['status'],
                       createdAt=x['created_at'], decidedAt=x['decided_at'] or '', note=x['note'])
                  for x in c.execute("SELECT * FROM ministry_departures WHERE parish_id=? AND (status='pending' OR created_at>?) ORDER BY created_at DESC",
                                     (pid, since))] if u['roleCode'] == 'priest' else []
    return apps, inquiries, departures


def roster_add(d, gid, person_id, at):
    group = next(g for g in d['GROUPS'] if g['id'] == gid)
    detail = d['GROUP_DETAIL'].setdefault(gid, {})
    roster = detail.setdefault('roster', [])
    person = next((p for p in d['PEOPLE'] if p['id'] == person_id), {})
    if not any(r.get('p') == person_id for r in roster):
        roster.append(dict(p=person_id, role='Member', roleAr='عضو', joined=at[:4], att=0))
        group['members'] = int(group.get('members') or 0) + 1
        detail.setdefault('history', []).append([f"{person.get('lat', '')} joined", f"انضمّ {person.get('ar') or person.get('lat', '')}", at[:10]])
    detail['requests'] = [r for r in detail.get('requests', []) if r.get('p') != person_id]


def roster_remove(d, gid, person_id, at):
    """The person leaves the roster; their membership stays in the ministry's history (without any reason)."""
    group = next(g for g in d['GROUPS'] if g['id'] == gid)
    detail = d['GROUP_DETAIL'].setdefault(gid, {})
    entry = next((r for r in detail.get('roster', []) if r.get('p') == person_id), None)
    if entry is None: return
    detail['roster'] = [r for r in detail['roster'] if r.get('p') != person_id]
    detail.setdefault('former', []).append(dict(entry, left=at[:10]))
    group['members'] = max(0, int(group.get('members') or 0) - 1)
    person = next((p for p in d['PEOPLE'] if p['id'] == person_id), {})
    detail.setdefault('history', []).append([f"{person.get('lat', '')} is no longer a member", f"لم يعد {person.get('ar') or person.get('lat', '')} عضواً", at[:10]])


def save_state(c, pid, d):
    d = migrate_state(d); validate(d); sync_relationships(c, pid, d)
    c.execute('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', (json.dumps(d), pid))
    return c.execute('SELECT revision FROM states WHERE parish_id=?', (pid,)).fetchone()['revision']


def ministry_member_action(c, u, pid, d, person, q):
    """The member's side: apply, withdraw an application, ask to leave."""
    op, at = q.get('op'), NOW()
    require(person.get('id'), 'Your account is not linked to a person record in this parish.', 403)
    group = next((g for g in d['GROUPS'] if g['id'] == q.get('groupId')), None)
    if op == 'ministryApply':
        require_module(c, pid, 'ministries', 'ministry applications')
        require(group is not None and group.get('vis', 'public') != 'confidential', 'Choose a ministry.', 404)
        require(not any(r.get('p') == person['id'] for r in d['GROUP_DETAIL'].get(group['id'], {}).get('roster', [])), 'You already belong to this ministry.')
        require(not c.execute(f"SELECT 1 FROM ministry_applications WHERE parish_id=? AND group_id=? AND person_id=? AND status IN {OPEN_APPLICATION}",
                              (pid, group['id'], person['id'])).fetchone(), 'Your application is already being considered.', 409)
        message = clean(q.get('message'), 500, 'Keep your message within 500 characters.', required=False)
        aid = 'ma-' + secrets.token_hex(8)
        c.execute('INSERT INTO ministry_applications(id,parish_id,group_id,user_id,person_id,status,message,created_at) VALUES(?,?,?,?,?,?,?,?)',
                  (aid, pid, group['id'], u['id'], person['id'], 'pending', message, at))
        for user_id in group_leader_accounts(c, pid, group):
            notify_account(c, user_id, pid, 'ministry-application', f"New application to {group['name']}", '', f"groups/{group['id']}")
        audit(c, u, pid, 'ministry.applied', {'group': group['id'], 'application': aid})
        return dict(id=aid)
    if op == 'ministryWithdraw':
        a = c.execute('SELECT * FROM ministry_applications WHERE id=? AND parish_id=? AND user_id=?', (q.get('id'), pid, u['id'])).fetchone()
        require(a is not None and a['status'] in OPEN_APPLICATION, 'This application is no longer open.', 404)
        if a['status'] == 'pending':   # nobody has approved it yet: it ends now
            c.execute("UPDATE ministry_applications SET status='withdrawn',closed_at=?,closed_by=? WHERE id=?", (at, u['id'], a['id']))
            audit(c, u, pid, 'ministry.application-withdrawn', {'application': a['id']})
            return dict(status='withdrawn')
        require(not a['withdraw_requested_at'], 'You have already asked to withdraw it.')
        note = clean(q.get('note'), 500, 'Keep your note within 500 characters.', required=False)
        c.execute('UPDATE ministry_applications SET withdraw_requested_at=?,withdraw_note=? WHERE id=?', (at, note, a['id']))
        g = next((x for x in d['GROUPS'] if x['id'] == a['group_id']), {})
        for user_id in set(group_leader_accounts(c, pid, g)) | set(parish_priest_accounts(c, pid)):
            notify_account(c, user_id, pid, 'ministry-application', f"Request to withdraw an application to {g.get('name', '')}", '', f"groups/{a['group_id']}")
        audit(c, u, pid, 'ministry.withdrawal-requested', {'application': a['id']})
        return dict(status='withdrawal-requested')
    if op == 'ministryLeave':
        require(group is not None and any(r.get('p') == person['id'] for r in d['GROUP_DETAIL'].get(group['id'], {}).get('roster', [])),
                'You do not belong to this ministry.', 404)
        require(person['id'] not in {group.get('leader'), group.get('assistant')},
                'You lead this ministry. Speak with the parish priest about handing it over first.')
        require(not c.execute("SELECT 1 FROM ministry_departures WHERE parish_id=? AND group_id=? AND person_id=? AND status='pending'",
                              (pid, group['id'], person['id'])).fetchone(), 'Your request is already with the parish priest.', 409)
        reason = clean(q.get('reason'), 1000, 'Keep the reason within 1000 characters.', required=False)
        did = 'md-' + secrets.token_hex(8)
        c.execute('INSERT INTO ministry_departures(id,parish_id,group_id,user_id,person_id,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?)',
                  (did, pid, group['id'], u['id'], person['id'], reason, 'pending', at))
        for user_id in parish_priest_accounts(c, pid):   # the reason stays in the request, for the priest to read there
            notify_account(c, user_id, pid, 'ministry-departure', 'A request to leave a ministry is waiting for you', '', f"groups/{group['id']}")
        audit(c, u, pid, 'ministry.departure-requested', {'request': did})
        return dict(id=did)
    raise Problem(400, 'Unknown action.')


def ministry_member_view(c, u, pid, d, person):
    roster_of = lambda gid: d['GROUP_DETAIL'].get(gid, {}).get('roster', [])
    apps = [dict(id=a['id'], groupId=a['group_id'], status=a['status'], message=a['message'], createdAt=a['created_at'],
                 leaderAt=a['leader_at'] or '', priestAt=a['priest_at'] or '', note=a['decision_note'],
                 withdrawRequested=a['withdraw_requested_at'] or '')
            for a in c.execute('SELECT * FROM ministry_applications WHERE parish_id=? AND user_id=? ORDER BY created_at DESC', (pid, u['id']))]
    departures = [dict(id=x['id'], groupId=x['group_id'], status=x['status'], createdAt=x['created_at'], decidedAt=x['decided_at'] or '', note=x['note'])
                  for x in c.execute('SELECT * FROM ministry_departures WHERE parish_id=? AND user_id=? ORDER BY created_at DESC', (pid, u['id']))]
    open_groups = [dict({k: g.get(k, '') for k in ('id', 'name', 'ar', 'cat', 'catAr', 'meets', 'meetsAr', 'vis') + GROUP_PROFILE})
                   for g in d['GROUPS'] if g.get('vis', 'public') != 'confidential' and not any(r.get('p') == person['id'] for r in roster_of(g['id']))]
    return dict(ministryApplications=apps, ministryDepartures=departures, openMinistries=open_groups)


def ministry_action(c, u, pid, q):
    """The leader's and the priest's side. A leader approves an application first; the priest approves it
    (and may do so without waiting). Departures are the priest's alone."""
    u = parish_user(c, u, pid)
    row = c.execute('SELECT * FROM states WHERE parish_id=?', (pid,)).fetchone()
    d = json.loads(row['data'])
    op, at = q.get('op'), NOW()
    priest = u['roleCode'] == 'priest'
    leads = lambda gid: bool(u['person_id']) and any(g['id'] == gid and u['person_id'] in {g.get('leader'), g.get('assistant')} for g in d['GROUPS'])
    revision = row['revision']
    if op in {'applicationDecide', 'withdrawalDecide'}:
        a = c.execute('SELECT * FROM ministry_applications WHERE id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
        require(a is not None and a['status'] in OPEN_APPLICATION, 'This application is no longer open.', 404)
        group = next((g for g in d['GROUPS'] if g['id'] == a['group_id']), None)
        require(group is not None, 'This ministry no longer exists.', 404)
        require(priest or (leads(group['id']) and (a['status'] == 'pending' or op == 'withdrawalDecide')),
                'The ministry’s leader and then the parish priest decide applications.', 403)
        note = clean(q.get('note'), 500, 'Keep the note within 500 characters.', required=False)
        if op == 'withdrawalDecide':
            require(a['withdraw_requested_at'], 'Nobody asked to withdraw this application.')
            if q.get('accept'):
                c.execute("UPDATE ministry_applications SET status='withdrawn',closed_at=?,closed_by=?,decision_note=? WHERE id=?", (at, u['id'], note, a['id']))
                notify_member(c, pid, a['user_id'], 'ministry', f"Your application to {group['name']} is withdrawn", note, 'myministries')
            else:
                c.execute("UPDATE ministry_applications SET withdraw_requested_at=NULL,decision_note=? WHERE id=?", (note, a['id']))
                notify_member(c, pid, a['user_id'], 'ministry', f"Your application to {group['name']} stays open", note, 'myministries')
            audit(c, u, pid, 'ministry.withdrawal-decided', {'application': a['id'], 'accepted': bool(q.get('accept'))})
            return dict(revision=revision)
        if not q.get('approve'):
            c.execute("UPDATE ministry_applications SET status='declined',closed_at=?,closed_by=?,decision_note=? WHERE id=?", (at, u['id'], note, a['id']))
            notify_member(c, pid, a['user_id'], 'ministry', f"Your application to {group['name']} was not accepted", note, 'myministries')
            audit(c, u, pid, 'ministry.application-declined', {'application': a['id']})
            return dict(revision=revision)
        if not priest:   # the leader's approval: on to the priest
            c.execute("UPDATE ministry_applications SET status='leader-approved',leader_by=?,leader_at=?,decision_note=? WHERE id=?", (u['id'], at, note, a['id']))
            for user_id in parish_priest_accounts(c, pid):
                notify_account(c, user_id, pid, 'ministry-application', f"An application to {group['name']} awaits your approval", '', f"groups/{group['id']}")
            audit(c, u, pid, 'ministry.application-leader-approved', {'application': a['id']})
            return dict(revision=revision)
        require(any(p['id'] == a['person_id'] for p in d['PEOPLE']), 'The applicant’s parish record is no longer active.')
        roster_add(d, group['id'], a['person_id'], at)
        revision = save_state(c, pid, d)
        c.execute("UPDATE ministry_applications SET status='approved',priest_by=?,priest_at=?,decision_note=?,closed_at=?,closed_by=? WHERE id=?",
                  (u['id'], at, note, at, u['id'], a['id']))
        notify_member(c, pid, a['user_id'], 'ministry', f"Welcome to {group['name']}", note, 'myministries')
        audit(c, u, pid, 'ministry.application-approved', {'application': a['id'], 'leaderApproved': bool(a['leader_at'])})
        return dict(revision=revision)
    if op == 'departureDecide':
        require(priest, 'Only the parish priest handles requests to leave a ministry.', 403)
        x = c.execute("SELECT * FROM ministry_departures WHERE id=? AND parish_id=? AND status='pending'", (q.get('id'), pid)).fetchone()
        require(x is not None, 'This request has already been handled.', 404)
        group = next((g for g in d['GROUPS'] if g['id'] == x['group_id']), None)
        note = clean(q.get('note'), 500, 'Keep the note within 500 characters.', required=False)
        if not q.get('approve'):
            c.execute("UPDATE ministry_departures SET status='declined',decided_by=?,decided_at=?,note=? WHERE id=?", (u['id'], at, note, x['id']))
            notify_member(c, pid, x['user_id'], 'ministry', 'Your request to leave a ministry', note or 'The parish priest would like to talk with you first.', 'myministries')
            audit(c, u, pid, 'ministry.departure-declined', {'request': x['id']})
            return dict(revision=revision)
        if group is not None:
            roster_remove(d, group['id'], x['person_id'], at)
            revision = save_state(c, pid, d)
        c.execute("UPDATE ministry_departures SET status='approved',decided_by=?,decided_at=?,note=? WHERE id=?", (u['id'], at, note, x['id']))
        name = (group or {}).get('name', 'the ministry')
        notify_member(c, pid, x['user_id'], 'ministry', f'Your membership of {name} has ended', note, 'myministries')
        parish = c.execute('SELECT diocese FROM parishes WHERE id=?', (pid,)).fetchone()
        person = next((p for p in d['PEOPLE'] + d['ARCHIVED'] if p['id'] == x['person_id']), {})
        ended = f"{person.get('lat', 'A member')} is no longer a member of {name}"
        for user_id in set(parish_priest_accounts(c, pid)) | set(bishop_accounts(c, parish['diocese'])):
            notify_account(c, user_id, pid, 'ministry-ended', ended, '', f"groups/{x['group_id']}")
        audit(c, u, pid, 'ministry.departure-approved', {'request': x['id']})
        return dict(revision=revision)
    if op == 'inquiryUpdate':
        i = c.execute('SELECT * FROM ministry_inquiries WHERE id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
        require(i is not None, 'Message not found.', 404)
        require(i['group_id'] in ministry_scope(u, d), 'This ministry is outside your responsibility.', 403)
        require(q.get('status') in {'new', 'answered', 'closed'}, 'Choose a status.')
        note = clean(q.get('note'), 500, 'Keep the note within 500 characters.', required=False)
        c.execute('UPDATE ministry_inquiries SET status=?,note=?,handled_by=?,handled_at=? WHERE id=?', (q['status'], note, u['id'], at, i['id']))
        audit(c, u, pid, 'ministry.inquiry-updated', {'inquiry': i['id'], 'status': q['status']})
        return dict(revision=revision)
    raise Problem(400, 'Unknown action.')


def account_notifications_view(c, u):
    rows = c.execute('SELECT * FROM account_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', (u['id'],)).fetchall()
    return dict(notifications=[dict(id=r['id'], parish=r['parish_id'], kind=r['kind'], title=r['title'], body=r['body'], route=r['route'],
                                    at=r['created_at'], read=bool(r['read_at'])) for r in rows])


def account_notifications_action(c, u, q):
    if q.get('op') == 'readAll':
        c.execute('UPDATE account_notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', (NOW(), u['id']))
    elif q.get('op') == 'read':
        c.execute('UPDATE account_notifications SET read_at=? WHERE user_id=? AND id=? AND read_at IS NULL', (NOW(), u['id'], q.get('id')))
    else: raise Problem(400, 'Unknown action.')
    return {}


# ───────────── Documents: guest requests, the priest's signature, the bishop's acceptance, release ─────────────
# Anyone can ask a parish for a certificate without an account, for themselves or a family member (a
# child's is asked for by a parent or guardian). They get a private tracking link. The priest signs the
# document; it then goes to the bishop, whose acceptance is a separate step with its own history. Whether
# a document is released before the bishop accepts it is a diocesan policy: until the bishop sets one,
# nothing is released automatically and a priest releasing early says so explicitly.
DOCUMENT_SCHEMA = '''
CREATE TABLE IF NOT EXISTS guest_requests(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), reference TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, subject TEXT NOT NULL, requester TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '',
  delivery TEXT NOT NULL, status TEXT NOT NULL, certificate_id TEXT, response TEXT NOT NULL DEFAULT '', link_delivery TEXT NOT NULL,
  claim_user_id TEXT, claim_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, log TEXT NOT NULL DEFAULT '[]',
  UNIQUE(parish_id,reference));
CREATE INDEX IF NOT EXISTS guest_requests_parish ON guest_requests(parish_id,status);
'''
GUEST_KINDS = {'baptism': 'Baptism certificate', 'communion': 'First Communion certificate', 'confirmation': 'Confirmation certificate',
               'marriage': 'Marriage certificate'}
RELATIONSHIPS = {'self', 'parent', 'guardian', 'spouse', 'child', 'sibling', 'other'}
RELEASE_POLICIES = ('unset', 'after-signature', 'after-acceptance')
GUEST_REQUESTS_PER_HOUR = 20


def release_policy(c, pid):
    """The diocese's rule for releasing signed documents; 'unset' until its bishop decides."""
    parish = c.execute('SELECT diocese FROM parishes WHERE id=?', (pid,)).fetchone()
    value = setting(c, 'diocese', parish['diocese'], 'documentRelease', 'unset') if parish else 'unset'
    return value if value in RELEASE_POLICIES else 'unset'


def adult(born):
    if not born: return True
    b = dt.date.fromisoformat(born); t = dt.date.today()
    return t.year - b.year - ((t.month, t.day) < (b.month, b.day)) >= 18


def guest_request_create(c, pid, q, outbox, base_url):
    """A certificate asked for without an account. The private tracking link is shown once and, when a
    delivery service is configured, also sent to the contact given."""
    require(not q.get('website'), 'The request could not be sent.')  # a field only robots fill in
    parish = c.execute('SELECT * FROM parishes WHERE id=?', (pid,)).fetchone()
    require(parish is not None, 'Parish not found.', 404)
    require(documents_open(c, pid), 'This parish does not take certificate requests on ParishLife at the moment. Please contact the parish office.', 403)
    kind = q.get('kind')
    require(kind in GUEST_KINDS, 'Choose the document you need.')
    s, r = q.get('subject') or {}, q.get('requester') or {}
    require(isinstance(s, dict) and isinstance(r, dict), 'Invalid request data.')
    born = str(s.get('birthDate') or '')
    if born:
        require(re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', born) is not None, 'Check the date of birth.')
        try: require(dt.date.fromisoformat(born) <= dt.date.today(), 'Check the date of birth.')
        except ValueError: raise Problem(400, 'Check the date of birth.')
    subject = dict(name=clean(s.get('name'), 120, 'Enter the full name of the person the document is about.'), birthDate=born,
                   father=clean(s.get('father'), 120, 'Check the father’s name.', required=False),
                   mother=clean(s.get('mother'), 120, 'Check the mother’s name.', required=False),
                   when=clean(s.get('when'), 120, 'Check the date or year of the sacrament.', required=False))
    relationship = r.get('relationship')
    require(relationship in RELATIONSHIPS, 'Say how you are related to this person.')
    if not adult(born):
        require(relationship in {'parent', 'guardian'}, 'A document about a child is asked for by a parent or legal guardian.')
    requester = dict(name=clean(r.get('name'), 120, 'Enter your name.'), relationship=relationship,
                     email=contact_value('email', r.get('email')) if str(r.get('email') or '').strip() else '',
                     phone=contact_value('phone', r.get('phone')) if str(r.get('phone') or '').strip() else '')
    require(requester['email'] or requester['phone'], 'Give a phone number or an email address.')
    delivery = q.get('delivery')
    require(delivery in {'download', 'collect'}, 'Choose how you will receive the document.')
    purpose = clean(q.get('purpose'), 500, 'Keep the purpose within 500 characters.', required=False)
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)).isoformat()
    require(c.execute('SELECT COUNT(*) FROM guest_requests WHERE parish_id=? AND created_at>?', (pid, since)).fetchone()[0] < GUEST_REQUESTS_PER_HOUR,
            'Many requests reached this parish in the last hour. Please try again later or call the parish office.', 429)
    at, year = NOW(), TODAY()[:4]
    number = c.execute('SELECT COUNT(*) FROM guest_requests WHERE parish_id=? AND reference LIKE ?', (pid, f'GR-{year}-%')).fetchone()[0] + 1
    rid, token, reference = 'gr-' + secrets.token_hex(8), secrets.token_urlsafe(24), f'GR-{year}-{number:04d}'
    link = f'{base_url}/public.html?track={token}'
    channel = 'email' if requester['email'] else 'sms'
    mode = delivery_mode(channel)
    link_delivery = {'none': 'not-configured', 'service': 'sending', 'console': 'console'}[mode]
    c.execute('INSERT INTO guest_requests(id,parish_id,reference,token,kind,subject,requester,purpose,delivery,status,link_delivery,created_at,updated_at,log) '
              'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (rid, pid, reference, sha(token), kind, json.dumps(subject), json.dumps(requester), purpose,
                                                      delivery, 'submitted', link_delivery, at, at, json.dumps([dict(key='submitted', at=at)])))
    if mode != 'none':
        name = json.loads(parish['metadata']).get('name', 'Your parish')
        outbox.append(dict(id=rid, table='guest_requests', channel=channel, target=requester['email'] or requester['phone'], mode=mode,
                           status=link_delivery, subject=f'Your request to {name} ({reference})',
                           text=f'{name} received your request {reference}. Follow it with this private link: {link}'))
    audit(c, {'id': None}, pid, 'guest-request.created', {'request': rid, 'kind': kind})
    return dict(reference=reference, link=link, linkDelivery=link_delivery, channel=channel)


def certificate_stage(s, row):
    """Where a certificate stands, in words a requester can follow."""
    if row['status'] == 'declined': return 'declined'
    if row['status'] == 'collected': return 'collected'
    if row['status'] == 'submitted' or s is None: return 'received'
    status, acceptance = s.get('status'), (s.get('acceptance') or {}).get('status')
    if status in {'rejected', 'cancelled'}: return 'cancelled'
    if status == 'issued': return 'ready'
    if status == 'approved': return 'accepted' if acceptance == 'accepted' else 'signed'
    return 'review'


def guest_files(c, pid, rid):
    return c.execute("SELECT id,name,mime,size,created_at FROM uploaded_files WHERE parish_id=? AND scope='guest-request' AND owner_id=? ORDER BY created_at DESC",
                     (pid, rid)).fetchall()


def guest_request_view(c, row):
    d = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (row['parish_id'],)).fetchone()['data'])
    s = next((x for x in d['SACRAMENTS'] if x['id'] == row['certificate_id']), None) if row['certificate_id'] else None
    stage = certificate_stage(s, row)
    events = json.loads(row['log'] or '[]')
    for h in (s or {}).get('history', []):
        key = {'approve': 'signed', 'bishop accepted': 'bishop-accepted', 'bishop returned': 'review', 'issue': 'ready',
               'reject': 'cancelled', 'cancelled': 'cancelled'}.get(h.get('action'))
        if key: events.append(dict(key=key, at=h.get('at', '')))
    events.sort(key=lambda e: e['at'])
    subject, parish = json.loads(row['subject']), c.execute('SELECT metadata FROM parishes WHERE id=?', (row['parish_id'],)).fetchone()
    meta = json.loads(parish['metadata'])
    return dict(reference=row['reference'], parish=dict(id=row['parish_id'], name=meta.get('name', ''), ar=meta.get('ar', '')),
                kind=row['kind'], subject=subject['name'], minor=not adult(subject.get('birthDate')), delivery=row['delivery'], stage=stage,
                events=events, message=row['response'], createdAt=row['created_at'],
                download=stage == 'ready' and row['delivery'] == 'download' and bool(guest_files(c, row['parish_id'], row['id'])))


def guest_request_row(c, token):
    row = c.execute('SELECT * FROM guest_requests WHERE token=?', (sha(str(token or '')),)).fetchone()
    require(row is not None, 'This tracking link is not valid. Check that you copied all of it.', 404)
    return row


def guest_document(c, token):
    """The signed document, once released, for a request that asked to download it."""
    row = guest_request_row(c, token)
    view = guest_request_view(c, row)
    require(view['download'], 'This document is not available to download.', 403)
    file_id = guest_files(c, row['parish_id'], row['id'])[0]['id']
    audit(c, {'id': None}, row['parish_id'], 'guest-request.downloaded', {'request': row['id']})
    return c.execute('SELECT * FROM uploaded_files WHERE id=?', (file_id,)).fetchone()


def office_guest_requests(c, pid, d):
    certs = {s['id']: s for s in d['SACRAMENTS'] if s.get('kind') == 'certificate'}
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=120)).isoformat()
    out = []
    for r in c.execute("SELECT * FROM guest_requests WHERE parish_id=? AND (status IN ('submitted','accepted') OR updated_at>? OR claim_status='pending') "
                       "ORDER BY created_at DESC", (pid, since)).fetchall():
        claimant = c.execute('SELECT name,username FROM users WHERE id=?', (r['claim_user_id'],)).fetchone() if r['claim_user_id'] else None
        out.append(dict(id=r['id'], reference=r['reference'], kind=r['kind'], subject=json.loads(r['subject']), requester=json.loads(r['requester']),
                        purpose=r['purpose'], delivery=r['delivery'], status=r['status'], certificateId=r['certificate_id'], response=r['response'],
                        linkDelivery=r['link_delivery'], createdAt=r['created_at'], stage=certificate_stage(certs.get(r['certificate_id']), r),
                        files=[dict(f) for f in guest_files(c, pid, r['id'])],
                        claim=dict(status=r['claim_status'], name=claimant['name'], username=claimant['username']) if claimant else None))
    return out


def guest_request_action(c, u, pid, q):
    u = parish_user(c, u, pid)
    require('requests.manage' in perms_of(u), 'Permission to handle requests is required.', 403)
    r = c.execute('SELECT * FROM guest_requests WHERE id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
    require(r is not None, 'Request not found.', 404)
    op, at = q.get('op'), NOW()
    log = json.loads(r['log'] or '[]')
    row = c.execute('SELECT * FROM states WHERE parish_id=?', (pid,)).fetchone()
    d, revision = json.loads(row['data']), row['revision']
    if op == 'accept':
        require(r['status'] == 'submitted', 'This request was already handled.')
        person_id, source_id = q.get('personId'), q.get('sourceRecordId') or None
        require(any(p['id'] == person_id for p in d['PEOPLE'] + d['ARCHIVED']), 'Choose the person’s record in your registers.')
        source = next((x for x in d['SACRAMENTS'] if x['id'] == source_id), None) if source_id else None
        if source_id:
            require(source is not None and source['kind'] == r['kind'] and source['person'] == person_id and source['status'] in {'registered', 'issued'},
                    'Choose the official register entry for this person.')
        year, prefix = TODAY()[:4], f'REQ/{TODAY()[:4]}/'
        number = max([int(x['reg'][len(prefix):]) for x in d['SACRAMENTS']
                      if str(x.get('reg', '')).startswith(prefix) and str(x['reg'][len(prefix):]).isdigit()] or [0]) + 1
        cid = 'sc' + secrets.token_hex(10)
        history = [dict(action='request submitted', by=u['name'], at=at, guestRequest=r['reference'])]
        if source: history.append(dict(action='submitted for clergy review', by=u['name'], at=at))
        d['SACRAMENTS'].insert(0, dict(id=cid, kind='certificate', kindAr='طلب شهادة', reg=f'{prefix}{number:03d}', person=person_id, date=TODAY(),
                                       celebrant=(source or {}).get('celebrant') or '', status='awaiting-signature' if source else 'draft',
                                       sourceRecordId=source_id, requestedSacramentId=None, purpose=r['purpose'] or GUEST_KINDS[r['kind']],
                                       godparents='', history=history, revision=1, guestRequest=r['reference']))
        revision = save_state(c, pid, d)
        c.execute("UPDATE guest_requests SET status='accepted',certificate_id=?,updated_at=?,log=? WHERE id=?",
                  (cid, at, json.dumps(log + [dict(key='accepted', at=at)]), r['id']))
        audit(c, u, pid, 'guest-request.accepted', {'request': r['id'], 'certificate': cid})
        return dict(revision=revision, certificateId=cid)
    if op == 'decline':
        require(r['status'] in {'submitted', 'accepted'}, 'This request was already closed.')
        note = clean(q.get('note'), 500, 'Tell them why, in 500 characters or fewer.')
        c.execute("UPDATE guest_requests SET status='declined',response=?,updated_at=?,log=? WHERE id=?",
                  (note, at, json.dumps(log + [dict(key='declined', at=at)]), r['id']))
        audit(c, u, pid, 'guest-request.declined', {'request': r['id']})
        return dict(revision=revision)
    if op == 'collected':
        s = next((x for x in d['SACRAMENTS'] if x['id'] == r['certificate_id']), None)
        require(r['status'] == 'accepted' and s is not None and s.get('status') == 'issued', 'Release the document before marking it collected.')
        c.execute("UPDATE guest_requests SET status='collected',updated_at=?,log=? WHERE id=?", (at, json.dumps(log + [dict(key='collected', at=at)]), r['id']))
        audit(c, u, pid, 'guest-request.collected', {'request': r['id']})
        return dict(revision=revision)
    if op in {'approveClaim', 'declineClaim'}:
        require(r['claim_status'] == 'pending', 'Nobody is waiting to link this request.')
        c.execute('UPDATE guest_requests SET claim_status=?,updated_at=? WHERE id=?', ('approved' if op == 'approveClaim' else 'declined', at, r['id']))
        notify_member(c, pid, r['claim_user_id'], 'request', f"Request {r['reference']} " + ('is now linked to your account' if op == 'approveClaim' else 'was not linked to your account'), '', 'myrequests')
        audit(c, u, pid, 'guest-request.claim-' + ('approved' if op == 'approveClaim' else 'declined'), {'request': r['id']})
        return dict(revision=revision)
    raise Problem(400, 'Unknown action.')


def guest_request_claim(c, u, pid, q):
    """An account asks to see a request it made as a guest. Holding the private link is the proof, and the
    office still confirms; a matching name, phone or email never links anything by itself."""
    r = guest_request_row(c, q.get('token'))
    require(r['parish_id'] == pid, 'This request belongs to another parish.', 404)
    require(r['claim_status'] not in {'pending', 'approved'} or r['claim_user_id'] == u['id'], 'This request is already linked to another account.', 409)
    require(r['claim_status'] != 'approved', 'This request is already linked to your account.')
    c.execute("UPDATE guest_requests SET claim_user_id=?,claim_status='pending',updated_at=? WHERE id=?", (u['id'], NOW(), r['id']))
    audit(c, u, pid, 'guest-request.claimed', {'request': r['id']})
    return dict(reference=r['reference'])


def claimed_guest_requests(c, u, pid):
    return [dict(guest_request_view(c, r), id=r['id'], claim=r['claim_status'])
            for r in c.execute("SELECT * FROM guest_requests WHERE parish_id=? AND claim_user_id=? AND claim_status IN ('pending','approved') "
                               "ORDER BY created_at DESC", (pid, u['id'])).fetchall()]


def diocese_documents(c, u):
    """Certificates signed by priests in the bishop's dioceses, waiting for (or recently given) the bishop's acceptance."""
    auth = authority(c, u)
    dioceses = [r['id'] for r in c.execute("SELECT id FROM dioceses WHERE id<>''") if 'documents.accept' in diocese_perms(auth, r['id'])]
    require(dioceses, 'Accepting signed documents belongs to the bishop.', 403)
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=60)).isoformat()
    out = []
    for p in c.execute(f'SELECT * FROM parishes WHERE diocese IN ({",".join("?" * len(dioceses))}) ORDER BY rowid', dioceses).fetchall():
        d = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (p['id'],)).fetchone()['data'])
        people = {x['id']: x for x in d['PEOPLE'] + d['ARCHIVED']}
        regs = {x['id']: x for x in d['SACRAMENTS']}
        meta = json.loads(p['metadata'])
        for s in d['SACRAMENTS']:
            a = s.get('acceptance') or {}
            if s.get('kind') != 'certificate' or not a or (a.get('status') != 'awaiting' and str(a.get('at', '')) < since): continue
            source = regs.get(s.get('sourceRecordId')) or {}
            out.append(dict(parish=p['id'], parishName=meta.get('name', ''), parishAr=meta.get('ar', ''), id=s['id'], reg=s.get('reg', ''),
                            person=people.get(s.get('person'), {}).get('lat', ''), source=dict(kind=source.get('kind', ''), reg=source.get('reg', '')),
                            purpose=s.get('purpose', ''), signedBy=s.get('approvedBy', ''), signedAt=s.get('approvedAt', ''), status=s.get('status'),
                            acceptance=a))
    return dict(documents=out, policies={did: setting(c, 'diocese', did, 'documentRelease', 'unset') for did in dioceses})


def diocese_document_action(c, u, q):
    pid = q.get('parish')
    parish = c.execute('SELECT * FROM parishes WHERE id=?', (pid,)).fetchone() if isinstance(pid, str) else None
    require(parish is not None, 'Parish not found.', 404)
    require('documents.accept' in diocese_perms(authority(c, u), parish['diocese']), 'Accepting signed documents belongs to the bishop.', 403)
    row = c.execute('SELECT * FROM states WHERE parish_id=?', (pid,)).fetchone()
    d, at = json.loads(row['data']), NOW()
    s = next((x for x in d['SACRAMENTS'] if x['id'] == q.get('id') and x.get('kind') == 'certificate'), None)
    # A document the diocesan policy already released on signature is still accepted (or returned) by the bishop.
    require(s is not None and (s.get('acceptance') or {}).get('status') == 'awaiting' and s.get('status') in {'approved', 'issued'},
            'This document is not waiting for your acceptance.', 409)
    decision = q.get('decision')
    require(decision in {'accept', 'return'}, 'Accept the document or return it to the priest.')
    note = clean(q.get('note'), 500, 'Say why you are returning it, in 500 characters or fewer.', required=decision == 'return')
    s['acceptance'] = dict(status='accepted' if decision == 'accept' else 'returned', by=u['name'], at=at, note=note)
    s.setdefault('history', []).append(dict(action='bishop accepted' if decision == 'accept' else 'bishop returned', by=u['name'], at=at, note=note))
    if decision == 'return':
        if s['status'] == 'approved': s['status'] = 'awaiting-signature'   # back to the priest, who reviews and signs again
    elif s['status'] == 'approved' and release_policy(c, pid) == 'after-acceptance':
        s.update(status='issued', issuedBy='Released by the diocesan policy', issuedAt=at)
        s['history'].append(dict(action='issue', by='Diocesan policy: release after the bishop’s acceptance', at=at, automatic=True))
    save_state(c, pid, d)
    for user_id in parish_priest_accounts(c, pid):
        notify_account(c, user_id, pid, 'document', f"{s.get('reg', '')} " + ('accepted by the bishop' if decision == 'accept' else 'returned by the bishop'),
                       note, 'requests')
    audit(c, u, pid, 'document.bishop-' + ('accepted' if decision == 'accept' else 'returned'), {'certificate': s['id']})
    return {}


def finance_overview(c, auth, parish_rows):
    """Read-only totals for the parishes whose finances this account may see from the diocese or the system."""
    out = []
    for p in parish_rows:
        if 'finance.view' not in diocese_perms(auth, p['diocese']): continue
        d = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (p['id'],)).fetchone()['data'])
        meta = json.loads(p['metadata'])
        expenses = d.get('EXPENSES', [])
        out.append(dict(parish=p['id'], name=meta.get('name', ''), ar=meta.get('ar', ''), diocese=p['diocese'],
                        funds=[dict(name=f.get('name', ''), ar=f.get('ar', ''), budget=f.get('budget', 0), actual=f.get('actual', 0),
                                    restricted=bool(f.get('restricted'))) for f in d.get('FUNDS', [])],
                        expensesApproved=sum(float(x.get('usd') or 0) for x in expenses if x.get('status') == 'approved'),
                        expensesWaiting=sum(1 for x in expenses if x.get('status') == 'awaiting-approval'),
                        giving=list(d.get('GIVING_SERIES', []))[-12:],
                        pledged=sum(float(x.get('pledged') or 0) for x in d.get('PLEDGES', [])),
                        paid=sum(float(x.get('paid') or 0) for x in d.get('PLEDGES', []))))
    return out


# ───────────── Privacy: private messages, pastoral-note visibility, complaint recipients ─────────────
# A conversation is private to the people in it. Writing to a parish office reaches the accounts that
# answer the office inbox there now; writing to a ministry reaches its current leader and assistant.
# Nobody else reads it, whatever their rank. Messages are never edited or deleted; archiving only tidies
# the archiving account's own inbox. A super admin can open one conversation for a recorded reason, as a
# separate, audited emergency review; that never reaches notes or the identity of an anonymous complaint.
PRIVACY_SCHEMA = '''
CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, kind TEXT NOT NULL,
  subject TEXT NOT NULL, parish_id TEXT REFERENCES parishes(id), group_id TEXT, context TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, last_at TEXT NOT NULL, legacy_id TEXT UNIQUE);
CREATE INDEX IF NOT EXISTS conversations_place ON conversations(kind,parish_id,group_id);
CREATE TABLE IF NOT EXISTS conversation_members(conversation_id TEXT NOT NULL REFERENCES conversations(id),
  user_id TEXT NOT NULL REFERENCES users(id), side TEXT NOT NULL DEFAULT 'person', read_at TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(conversation_id,user_id));
CREATE INDEX IF NOT EXISTS conversation_members_user ON conversation_members(user_id,side);
CREATE TABLE IF NOT EXISTS conversation_messages(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id),
  author_id TEXT NOT NULL REFERENCES users(id), side TEXT NOT NULL DEFAULT 'person', body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS conversation_messages_thread ON conversation_messages(conversation_id,created_at);
CREATE TABLE IF NOT EXISTS conversation_reports(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id),
  reporter_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL, closed_at TEXT, closed_by TEXT, close_note TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS emergency_reviews(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id),
  reviewer_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, report_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS concern_recipients(concern_id TEXT NOT NULL REFERENCES member_concerns(id),
  user_id TEXT NOT NULL REFERENCES users(id), source TEXT NOT NULL, added_at TEXT NOT NULL, PRIMARY KEY(concern_id,user_id));
CREATE INDEX IF NOT EXISTS concern_recipients_user ON concern_recipients(user_id);
'''
MESSAGES_PER_PAGE = 10
NOTE_VISIBILITY = ('personal', 'shared')


def migrate_privacy(c):
    """Additive and run once each: earlier one-to-one portal messages are copied into conversations
    (the originals stay where they were), each earlier pastoral note gets the author it had in practice
    and stays personal, and each earlier complaint keeps exactly the people who could already see it."""
    c.executescript(PRIVACY_SCHEMA)
    if c.execute("SELECT 1 FROM schema_migrations WHERE name='v2-messages'").fetchone() is None:
        threads = {}
        for r in c.execute("SELECT * FROM member_content WHERE kind='message' AND recipient_id IS NOT NULL ORDER BY created_at,id").fetchall():
            title = r['title']
            while title.startswith('Re: '): title = title[4:]
            key = (r['parish_id'], r['group_id'] or '', tuple(sorted((r['author_id'], r['recipient_id']))), title)
            conv_id = threads.get(key)
            if conv_id is None:
                conv_id = threads[key] = 'cv-' + hashlib.sha256(('legacy|' + r['id']).encode()).hexdigest()[:20]
                c.execute('INSERT OR IGNORE INTO conversations(id,reference,kind,subject,parish_id,group_id,context,created_by,created_at,last_at,legacy_id) '
                          'VALUES(?,?,?,?,?,?,?,?,?,?,?)', (conv_id, conversation_reference(conv_id), 'direct', title or 'Message', r['parish_id'], r['group_id'],
                                                        json.dumps(conversation_context(c, r['parish_id'], r['group_id'])), r['author_id'], r['created_at'], r['created_at'], r['id']))
            c.execute('INSERT OR IGNORE INTO conversation_messages VALUES(?,?,?,?,?,?)',
                      ('cm-' + hashlib.sha256(('legacy|' + r['id']).encode()).hexdigest()[:20], conv_id, r['author_id'], 'person', r['body'], r['created_at']))
            c.execute('UPDATE conversations SET last_at=max(last_at,?) WHERE id=?', (r['created_at'], conv_id))
            for user_id in (r['author_id'], r['recipient_id']):
                own = c.execute('SELECT data FROM member_private WHERE parish_id=? AND user_id=?', (r['parish_id'], user_id)).fetchone()
                private = json.loads(own['data']) if own else {}
                read = user_id == r['author_id'] or r['id'] in private.get('readIds', [])
                c.execute('INSERT OR IGNORE INTO conversation_members VALUES(?,?,?,?,?)', (conv_id, user_id, 'person', '', 0))
                if read: c.execute('UPDATE conversation_members SET read_at=max(read_at,?) WHERE conversation_id=? AND user_id=?', (r['created_at'], conv_id, user_id))
                c.execute('UPDATE conversation_members SET archived=? WHERE conversation_id=? AND user_id=?',
                          (int(r['id'] in private.get('archivedIds', [])), conv_id, user_id))
        c.execute("INSERT INTO schema_migrations VALUES('v2-messages',?)", (NOW(),))
    # Each parish's earlier notes go to its priest once it has a priest account (until then nobody could read them).
    for row in c.execute("SELECT parish_id,data FROM states WHERE 'v2-notes:'||parish_id NOT IN (SELECT name FROM schema_migrations)").fetchall():
        d = json.loads(row['data'])
        if any(not n.get('authorId') for n in d.get('NOTES', [])):
            owner = legacy_note_owner(c, row['parish_id'])
            if owner is None: continue
            for n in d['NOTES']:
                if not n.get('authorId'):
                    n.update(authorId=owner['user_id'], visibility='personal')
                    n.setdefault('by', owner['person_id'])
            c.execute('UPDATE states SET data=? WHERE parish_id=?', (json.dumps(d), row['parish_id']))
        c.execute('INSERT INTO schema_migrations VALUES(?,?)', ('v2-notes:' + row['parish_id'], NOW()))
    if c.execute("SELECT 1 FROM schema_migrations WHERE name='v2-concerns'").fetchone() is None:
        at = NOW()
        for r in c.execute('SELECT * FROM member_concerns').fetchall():
            for user_id in existing_concern_access(c, r):
                c.execute('INSERT OR IGNORE INTO concern_recipients VALUES(?,?,?,?)', (r['id'], user_id, 'existing-access', at))
        c.execute("INSERT INTO schema_migrations VALUES('v2-concerns',?)", (NOW(),))


def legacy_note_owner(c, pid):
    """Who wrote a parish's earlier pastoral notes: until now only its priests could, so its parish priest
    (or, without one on record, its first priest account)."""
    priests = c.execute("SELECT user_id,person_id FROM parish_accounts WHERE parish_id=? AND role='priest' ORDER BY user_id", (pid,)).fetchall()
    if not priests: return None
    lead = c.execute("SELECT cl.user_id FROM clergy_assignments a JOIN clergy cl ON cl.id=a.clergy_id WHERE a.parish_id=? "
                     "AND a.office='parish-priest' AND a.end_date IS NULL AND cl.user_id IS NOT NULL ORDER BY a.start_date DESC", (pid,)).fetchone()
    return next((p for p in priests if lead and p['user_id'] == lead['user_id']), priests[0])


def existing_concern_access(c, r):
    """The accounts that could see an earlier complaint under the earlier rules: appointed reviewers
    (as the case's sensitivity and assignment allowed), the reviewer it was assigned to, and, for an
    ordinary complaint about a ministry, that ministry's leaders."""
    users = set()
    if r['assigned_to']: users.add(r['assigned_to'])
    for row in c.execute('SELECT user_id,permissions FROM complaint_reviewers WHERE parish_id=?', (r['parish_id'],)):
        perms = set(json.loads(row['permissions']))
        if 'Review' in perms and (not sensitive_concern(r['category']) or 'ViewSensitive' in perms) and \
                (not r['assigned_to'] or r['assigned_to'] == row['user_id'] or 'Assign' in perms):
            users.add(row['user_id'])
    if r['group_id'] and not sensitive_concern(r['category']):
        state = c.execute('SELECT data FROM states WHERE parish_id=?', (r['parish_id'],)).fetchone()
        group = next((g for g in json.loads(state['data']).get('GROUPS', []) if g.get('id') == r['group_id']), None) if state else None
        if group:
            users.update(x['user_id'] for x in c.execute("SELECT user_id FROM parish_accounts WHERE parish_id=? AND role='leader' AND person_id IN (?,?)",
                                                         (r['parish_id'], group.get('leader') or '', group.get('assistant') or '')))
    return sorted(users)


# Pastoral notes. A note is its author's alone unless they share it with the parish's priests; a shared
# note is read by whoever is a priest of that parish now. Nothing is ever shared on anyone's behalf.
def note_visible(u, n):
    if 'notes.pastoral' not in perms_of(u) or not n.get('authorId'): return False
    return n['authorId'] == u['id'] or n.get('visibility') == 'shared'


def merge_notes(u, old, incoming):
    """The notes a priest saves replace only what they may see: their own notes, and (to mark a task
    done that was shared and assigned to them) the shared ones. Everything else stays as it was."""
    require(isinstance(incoming, list) and all(isinstance(n, dict) and isinstance(n.get('id'), str) for n in incoming), 'Invalid notes.')
    before = {n['id']: n for n in old}
    seen, out = set(), []
    for n in incoming:
        require(n['id'] not in seen, 'Invalid notes.')
        seen.add(n['id'])
        prior = before.get(n['id'])
        visibility = n.get('visibility', 'personal')
        require(visibility in NOTE_VISIBILITY, 'Choose who can see this note.')
        if prior is None:
            out.append(dict(n, authorId=u['id'], by=u.get('person_id'), visibility=visibility))
        elif prior.get('authorId') == u['id']:
            out.append(dict(n, authorId=u['id'], by=prior.get('by') or u.get('person_id'), visibility=visibility))
        else:
            require(note_visible(u, prior), 'Note not available.', 403)
            changed = {k for k in set(n) | set(prior) if n.get(k) != prior.get(k)}
            require(not changed or changed == {'done'} and prior.get('kind') == 'task' and prior.get('assignee') == u.get('person_id'),
                    'Only the author can change this note.', 403)
            out.append(dict(prior, done=n.get('done', prior.get('done'))))
    for n in old:
        if n['id'] in seen: continue
        require(not note_visible(u, n) or n.get('authorId') == u['id'], 'Only the author can delete this note.', 403)
        if not note_visible(u, n): out.append(n)
    return out


# Messages.
def conversation_reference(conv_id):
    return 'MSG-' + hashlib.sha256(conv_id.encode()).hexdigest()[:8].upper()


def conversation_context(c, pid, group_id=None):
    """Names shown on a conversation card, kept as they were when it started."""
    if not pid: return {}
    row = c.execute('SELECT metadata FROM parishes WHERE id=?', (pid,)).fetchone()
    meta = json.loads(row['metadata']) if row else {}
    out = dict(parish=meta.get('name', ''), parishAr=meta.get('ar', ''))
    if group_id:
        state = c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()
        group = next((g for g in json.loads(state['data']).get('GROUPS', []) if g.get('id') == group_id), {}) if state else {}
        out.update(group=group.get('name', ''), groupAr=group.get('ar', group.get('name', '')))
    return out


def blocked_accounts(c):
    return {(r['user_id'], r['scope'], r['scope_id']) for r in c.execute('SELECT user_id,scope,scope_id FROM access_blocks WHERE lifted_at IS NULL')}


def reachable(blocked, user_id, pid, diocese):
    return not ({(user_id, 'global', ''), (user_id, 'diocese', diocese), (user_id, 'parish', pid)} & blocked or
                any(b[0] == user_id and b[1] == 'global' for b in blocked))


def message_places(c, u, auth=None):
    """Each parish this account is connected to, with its role there and whether it answers the office inbox."""
    auth = auth or authority(c, u)
    out = []
    for r in c.execute('SELECT * FROM parishes ORDER BY rowid').fetchall():
        ctx = parish_context(c, u, r['id'], auth, r)
        if ctx is None: continue
        meta = json.loads(r['metadata'])
        out.append(dict(id=r['id'], diocese=r['diocese'], name=meta.get('name', ''), ar=meta.get('ar', ''), ctx=ctx))
    return out


def handled_groups(c, place):
    """The ministries this account leads or assists in a parish, now."""
    person_id = place['ctx'].get('person_id')
    if not person_id or place['ctx']['role'] in {'follower', 'bishop'}: return []
    state = c.execute('SELECT data FROM states WHERE parish_id=?', (place['id'],)).fetchone()
    return [g for g in json.loads(state['data']).get('GROUPS', []) if person_id in {g.get('leader'), g.get('assistant')}] if state else []


def message_directory(c, u):
    """Who this account may start a conversation with: the office of each parish it belongs to, follows,
    serves or oversees; the ministries of each parish it belongs to or serves; and, there, the staff and
    the members who agreed to be listed in the parish directory."""
    places = message_places(c, u)
    blocked = blocked_accounts(c)
    offices, ministries, people = [], [], {}
    for place in places:
        offices.append(dict(parish=place['id'], name=place['name'], ar=place['ar']))
        if place['ctx']['role'] in {'follower', 'bishop'}: continue
        state = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (place['id'],)).fetchone()['data'])
        for g in state.get('GROUPS', []):
            if group_leader_accounts(c, place['id'], g):
                ministries.append(dict(parish=place['id'], parishName=place['name'], group=g['id'], name=g.get('name', ''), ar=g.get('ar', g.get('name', ''))))
        extra = state.get('PERSON_EXTRA', {})
        for r in c.execute('SELECT a.user_id,a.person_id,a.role,u.name,p.data FROM parish_accounts a JOIN users u ON u.id=a.user_id '
                           'LEFT JOIN user_profiles p ON p.user_id=a.user_id WHERE a.parish_id=? ORDER BY u.name', (place['id'],)):
            if r['user_id'] == u['id'] or not reachable(blocked, r['user_id'], place['id'], place['diocese']): continue
            listed = r['role'] != 'member' or extra.get(r['person_id'] or '', {}).get('directory') is True or \
                json.loads(r['data'] or '{}').get('directory') is True
            if not listed: continue
            entry = people.setdefault(r['user_id'], dict(id=r['user_id'], name=r['name'], places=[]))
            role = ROLE_TITLES.get(r['role'], ('', ''))
            if not any(p['parish'] == place['id'] and p['role'] == role[0] for p in entry['places']):
                entry['places'].append(dict(parish=place['id'], name=place['name'], role=role[0], roleAr=role[1]))
    return dict(offices=offices, ministries=ministries, people=sorted(people.values(), key=lambda p: p['name'].casefold()))


def conversation_side(c, u, conv, places=None):
    """How this account takes part: 'person' (it is in the conversation), 'office' or 'ministry' (it answers
    for the parish office or the ministry today), or None. Rank never opens a conversation."""
    row = c.execute("SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=? AND side='person'", (conv['id'], u['id'])).fetchone()
    if row: return 'person'
    if conv['kind'] not in {'office', 'ministry'} or not conv['parish_id']: return None
    place = next((p for p in (places if places is not None else message_places(c, u)) if p['id'] == conv['parish_id']), None)
    if place is None: return None
    if conv['kind'] == 'office':
        return 'office' if 'messages.office' in place['ctx']['perms'] else None
    return 'ministry' if any(g['id'] == conv['group_id'] for g in handled_groups(c, place)) else None


def handlers(c, conv):
    """The accounts that answer for a conversation's office or ministry today."""
    if conv['kind'] == 'office':
        out = []
        for r in c.execute("SELECT DISTINCT user_id FROM parish_accounts WHERE parish_id=? AND role<>'member'", (conv['parish_id'],)).fetchall():
            account = c.execute('SELECT * FROM users WHERE id=?', (r['user_id'],)).fetchone()
            ctx = parish_context(c, account, conv['parish_id']) if account else None
            if ctx and 'messages.office' in ctx['perms']: out.append(r['user_id'])
        return out
    if conv['kind'] == 'ministry':
        state = c.execute('SELECT data FROM states WHERE parish_id=?', (conv['parish_id'],)).fetchone()
        group = next((g for g in json.loads(state['data']).get('GROUPS', []) if g.get('id') == conv['group_id']), None) if state else None
        return group_leader_accounts(c, conv['parish_id'], group) if group else []
    return []


CARD_SQL = ("SELECT c.*,m.read_at AS my_read,m.archived AS my_archived,m.side AS my_side,"
            "(SELECT COUNT(*) FROM conversation_messages x WHERE x.conversation_id=c.id) AS total,"
            "l.body AS last_body,l.author_id AS last_author,l.side AS last_side,l.created_at AS last_created "
            "FROM conversations c LEFT JOIN conversation_members m ON m.conversation_id=c.id AND m.user_id=? "
            "LEFT JOIN conversation_messages l ON l.id=(SELECT x.id FROM conversation_messages x WHERE x.conversation_id=c.id "
            "ORDER BY x.created_at DESC,x.id DESC LIMIT 1) ")


def names_of(c, ids):
    ids = sorted({i for i in ids if i})
    if not ids: return {}
    return {r['id']: r['name'] for r in c.execute(f"SELECT id,name FROM users WHERE id IN ({','.join('?' * len(ids))})", ids)}


def conversation_cards(c, u, rows):
    """Cards for a page of conversations: who it is with, the latest message in brief, read and archived state."""
    ids = [r['id'] for r in rows]
    people = {}
    if ids:
        for r in c.execute(f"SELECT conversation_id,user_id FROM conversation_members WHERE side='person' AND user_id<>? "
                           f"AND conversation_id IN ({','.join('?' * len(ids))}) ORDER BY user_id", (u['id'], *ids)):
            people.setdefault(r['conversation_id'], []).append(r['user_id'])
    names = names_of(c, [x for v in people.values() for x in v] + [r['last_author'] for r in rows])
    return [dict(id=r['id'], reference=r['reference'], kind=r['kind'], subject=r['subject'],
                 side='person' if r['my_side'] == 'person' else r['kind'], parish=r['parish_id'], group=r['group_id'],
                 context=json.loads(r['context'] or '{}'), people=[names.get(x, '') for x in people.get(r['id'], [])],
                 lastAt=r['last_at'], snippet=(r['last_body'] or '')[:160], lastAuthor=names.get(r['last_author'], ''),
                 lastSide=r['last_side'] or '', lastMine=r['last_author'] == u['id'], count=r['total'],
                 unread=card_unread(u, r), archived=bool(r['my_archived'])) for r in rows]


def card_unread(u, r):
    return bool(r['last_author'] and r['last_author'] != u['id'] and r['last_created'] > (r['my_read'] or ''))


def messages_list(c, u, q):
    """One page of the account's conversations, newest first, after its search and box filters."""
    box = q.get('box') or 'inbox'
    require(box in {'inbox', 'unread', 'archived', 'all'}, 'Unknown mailbox.')
    places = message_places(c, u)
    office_pids = [p['id'] for p in places if 'messages.office' in p['ctx']['perms']]
    led = [(p['id'], g['id']) for p in places for g in handled_groups(c, p)]
    clauses, args = ["c.id IN (SELECT conversation_id FROM conversation_members WHERE user_id=? AND side='person')"], [u['id'], u['id']]
    if office_pids:
        clauses.append(f"(c.kind='office' AND c.parish_id IN ({','.join('?' * len(office_pids))}))"); args += office_pids
    for pid, gid in led:
        clauses.append("(c.kind='ministry' AND c.parish_id=? AND c.group_id=?)"); args += [pid, gid]
    where = '(' + ' OR '.join(clauses) + ')'
    term = ' '.join(str(q.get('q') or '').split())[:100]
    if term:
        pattern = '%' + term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        where += (" AND (c.subject LIKE ? ESCAPE '\\' OR c.reference LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM conversation_messages x "
                  "WHERE x.conversation_id=c.id AND x.body LIKE ? ESCAPE '\\'))")
        args += [pattern] * 3
    rows = c.execute(CARD_SQL + f'WHERE {where} ORDER BY c.last_at DESC,c.id', args).fetchall()
    unread = sum(1 for r in rows if card_unread(u, r) and not r['my_archived'])
    rows = [r for r in rows if box == 'all' or (box == 'archived') == bool(r['my_archived']) and (box != 'unread' or card_unread(u, r))]
    pages = max(1, -(-len(rows) // MESSAGES_PER_PAGE))
    page = min(q.get('page') if type(q.get('page')) is int and q.get('page') > 0 else 1, pages)
    return dict(conversations=conversation_cards(c, u, rows[(page - 1) * MESSAGES_PER_PAGE: page * MESSAGES_PER_PAGE]),
                page=page, pages=pages, total=len(rows), unread=unread, perPage=MESSAGES_PER_PAGE)


def conversation_open(c, u, conv_id):
    conv = c.execute('SELECT * FROM conversations WHERE id=?', (conv_id,)).fetchone()
    side = conversation_side(c, u, conv) if conv else None
    require(side is not None, 'Conversation not found.', 404)
    rows = c.execute('SELECT * FROM conversation_messages WHERE conversation_id=? ORDER BY created_at,id', (conv['id'],)).fetchall()
    names = names_of(c, [r['author_id'] for r in rows])
    c.execute('INSERT INTO conversation_members(conversation_id,user_id,side,read_at,archived) VALUES(?,?,?,?,0) '
              'ON CONFLICT(conversation_id,user_id) DO UPDATE SET read_at=excluded.read_at', (conv['id'], u['id'], side, NOW()))
    card = dict(conversation_cards(c, u, c.execute(CARD_SQL + 'WHERE c.id=?', (u['id'], conv['id'])).fetchall())[0], unread=False)
    report = c.execute("SELECT 1 FROM conversation_reports WHERE conversation_id=? AND reporter_id=? AND status='open'", (conv['id'], u['id'])).fetchone()
    return dict(conversation=card, messages=[message_view(r, names, u['id']) for r in rows], reported=bool(report))


def message_view(row, names, me=None):
    return dict(id=row['id'], author=names.get(row['author_id'], ''), mine=row['author_id'] == me, side=row['side'], body=row['body'], at=row['created_at'])


def conversation_post(c, u, conv, side, body, at, people=None):
    """Adds a message. `people` lists the other participants when the conversation is new in this request."""
    c.execute('INSERT INTO conversation_messages VALUES(?,?,?,?,?,?)', ('cm-' + secrets.token_hex(10), conv['id'], u['id'], side, body, at))
    c.execute('UPDATE conversations SET last_at=? WHERE id=?', (at, conv['id']))
    c.execute('INSERT INTO conversation_members(conversation_id,user_id,side,read_at,archived) VALUES(?,?,?,?,0) '
              'ON CONFLICT(conversation_id,user_id) DO UPDATE SET read_at=excluded.read_at,archived=0', (conv['id'], u['id'], side, at))
    # A new message brings the conversation back to the others' inboxes; they are told without its text.
    c.execute('UPDATE conversation_members SET archived=0 WHERE conversation_id=? AND user_id<>?', (conv['id'], u['id']))
    if people is None:
        people = [r['user_id'] for r in c.execute("SELECT user_id FROM conversation_members WHERE conversation_id=? AND side='person' AND user_id<>?",
                                                  (conv['id'], u['id']))]
    targets = set(people) | ({x for x in handlers(c, conv) if x != u['id']} if side == 'person' else set())
    for user_id in sorted(targets):
        notify_account(c, user_id, conv['parish_id'], 'message', 'New message: ' + conv['subject'], '', 'inbox/' + conv['id'])


def conversation_start(c, u, q, at=None):
    """A new conversation with a parish office, a ministry or a person in this account's directory."""
    at = at or NOW()
    subject = clean(q.get('subject'), 160, 'Enter a subject of up to 160 characters.')
    body = str(q.get('body') or '').strip()
    require(0 < len(body) <= 5000, 'Write a message of up to 5000 characters.')
    to = q.get('to') if isinstance(q.get('to'), dict) else {}
    directory = message_directory(c, u)
    pid, group_id, kind, people = None, None, to.get('kind'), []
    if kind == 'office':
        require(any(o['parish'] == to.get('parish') for o in directory['offices']), 'Choose a parish you are connected to.', 403)
        pid = to['parish']
    elif kind == 'ministry':
        require(any(m['parish'] == to.get('parish') and m['group'] == to.get('group') for m in directory['ministries']),
                'Choose a ministry of a parish you belong to.', 403)
        pid, group_id = to['parish'], to['group']
    elif kind == 'direct':
        ids = to.get('people')
        reachable_ids = {p['id']: p for p in directory['people']}
        require(isinstance(ids, list) and 0 < len(ids) <= 10 and len(set(ids)) == len(ids) and all(i in reachable_ids for i in ids),
                'Choose up to ten people from the directory.', 403)
        people = ids
        shared = [p['parish'] for p in reachable_ids[ids[0]]['places']]
        pid = to.get('parish') if to.get('parish') in shared else (shared[0] if shared else None)
    else:
        raise Problem(400, 'Choose who the message is for.')
    conv = new_conversation(c, u, kind, subject, pid, group_id, at)
    c.execute('INSERT INTO conversation_members VALUES(?,?,?,?,0)', (conv['id'], u['id'], 'person', at))
    for user_id in people:
        c.execute('INSERT INTO conversation_members VALUES(?,?,?,?,0)', (conv['id'], user_id, 'person', ''))
    conversation_post(c, u, conv, 'person', body, at, people)
    return conv


def new_conversation(c, u, kind, subject, pid, group_id, at):
    conv = dict(id='cv-' + secrets.token_hex(10), kind=kind, subject=subject, parish_id=pid, group_id=group_id)
    conv['reference'] = conversation_reference(conv['id'])
    c.execute('INSERT INTO conversations(id,reference,kind,subject,parish_id,group_id,context,created_by,created_at,last_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
              (conv['id'], conv['reference'], kind, subject, pid, group_id, json.dumps(conversation_context(c, pid, group_id)), u['id'], at, at))
    return conv


def office_conversation(c, u, pid, person_id, subject, body, group_id=None):
    """The parish office (or a ministry's leader) writing to a person in its records: the reply comes back to
    the office inbox (or the ministry's leaders), not to whoever happened to send it."""
    account = c.execute('SELECT user_id FROM parish_accounts WHERE parish_id=? AND person_id=? LIMIT 1', (pid, person_id)).fetchone()
    require(account is not None, 'This person does not have an active in-app account.', 404)
    at = NOW()
    kind = 'ministry' if group_id else 'office'
    conv = new_conversation(c, u, kind, subject, pid, group_id, at)
    c.execute('INSERT INTO conversation_members VALUES(?,?,?,?,0)', (conv['id'], account['user_id'], 'person', ''))
    conversation_post(c, u, conv, kind, body, at, [account['user_id']])
    return conv


def system_reviewers(c):
    out = []
    for r in c.execute("SELECT DISTINCT user_id FROM role_assignments WHERE scope='system' AND status='active'").fetchall():
        account = c.execute('SELECT * FROM users WHERE id=?', (r['user_id'],)).fetchone()
        if account and 'messages.emergency' in system_perms(authority(c, account)): out.append(r['user_id'])
    return out


def messages_action(c, u, q):
    op = q.get('op')
    if op == 'list': return messages_list(c, u, q)
    if op == 'directory': return message_directory(c, u)
    if op == 'open': return conversation_open(c, u, q.get('id'))
    if op == 'start':
        conv = conversation_start(c, u, q)
        return dict(id=conv['id'], reference=conv['reference'])
    if op in {'emergencyOpen', 'reports', 'reportClose'}: return emergency_action(c, u, q)
    conv = c.execute('SELECT * FROM conversations WHERE id=?', (q.get('id'),)).fetchone()
    side = conversation_side(c, u, conv) if conv else None
    require(side is not None, 'Conversation not found.', 404)
    at = NOW()
    if op == 'reply':
        body = str(q.get('body') or '').strip()
        require(0 < len(body) <= 5000, 'Write a reply of up to 5000 characters.')
        conversation_post(c, u, conv, side, body, at)
    elif op in {'archive', 'unarchive', 'markUnread', 'markRead'}:
        c.execute('INSERT INTO conversation_members(conversation_id,user_id,side,read_at,archived) VALUES(?,?,?,?,0) '
                  'ON CONFLICT(conversation_id,user_id) DO NOTHING', (conv['id'], u['id'], side, ''))
        if op in {'archive', 'unarchive'}:
            c.execute('UPDATE conversation_members SET archived=? WHERE conversation_id=? AND user_id=?', (int(op == 'archive'), conv['id'], u['id']))
        else:
            c.execute('UPDATE conversation_members SET read_at=? WHERE conversation_id=? AND user_id=?', ('' if op == 'markUnread' else at, conv['id'], u['id']))
    elif op == 'report':
        reason = clean(q.get('reason'), 1000, 'Say in up to 1000 characters what the problem is.')
        require(len(reason) >= 10, 'Say in a sentence what the problem is.')
        require(c.execute("SELECT 1 FROM conversation_reports WHERE conversation_id=? AND reporter_id=? AND status='open'",
                          (conv['id'], u['id'])).fetchone() is None, 'You have already reported this conversation.')
        c.execute('INSERT INTO conversation_reports(id,conversation_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)',
                  ('rp-' + secrets.token_hex(10), conv['id'], u['id'], reason, at))
        for user_id in system_reviewers(c):
            notify_account(c, user_id, None, 'report', 'A conversation was reported for review', conv['reference'], 'inbox')
    else:
        raise Problem(400, 'Unknown action.')
    return {}


def emergency_action(c, u, q):
    """A super admin's problem review. Each opening names one conversation and records why; there is no
    browsing, and nothing else (notes, complaint identities) is reachable from here."""
    require('messages.emergency' in system_perms(authority(c, u)), 'Emergency review is reserved for super admins.', 403)
    op = q.get('op')
    if op == 'reports':
        reports = c.execute('SELECT r.*,c.reference FROM conversation_reports r JOIN conversations c ON c.id=r.conversation_id '
                            "ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 200").fetchall()
        reviews = c.execute('SELECT e.*,c.reference FROM emergency_reviews e JOIN conversations c ON c.id=e.conversation_id '
                            'ORDER BY e.created_at DESC LIMIT 200').fetchall()
        names = names_of(c, [r['reporter_id'] for r in reports] + [r['reviewer_id'] for r in reviews])
        return dict(reports=[dict(id=r['id'], conversation=r['conversation_id'], reference=r['reference'], reason=r['reason'],
                                  reporter=names.get(r['reporter_id'], ''), at=r['created_at'], status=r['status'],
                                  closedAt=r['closed_at'] or '', closeNote=r['close_note'])
                             for r in reports],
                    reviews=[dict(reference=r['reference'], reviewer=names.get(r['reviewer_id'], ''), reason=r['reason'], at=r['created_at'])
                             for r in reviews])
    if op == 'reportClose':
        report = c.execute("SELECT * FROM conversation_reports WHERE id=? AND status='open'", (q.get('id'),)).fetchone()
        require(report is not None, 'Report not found.', 404)
        note = clean(q.get('note'), 1000, 'Keep the note within 1000 characters.', required=False)
        c.execute("UPDATE conversation_reports SET status='closed',closed_at=?,closed_by=?,close_note=? WHERE id=?", (NOW(), u['id'], note, report['id']))
        return {}
    reason = clean(q.get('reason'), 1000, 'Record the reason for this review in up to 1000 characters.')
    require(len(reason) >= 20, 'Record the reason for this review in a full sentence (at least 20 characters).')
    report = c.execute('SELECT * FROM conversation_reports WHERE id=?', (q.get('reportId'),)).fetchone() if q.get('reportId') else None
    reference = str(q.get('reference') or '').strip().upper()
    conv = (c.execute('SELECT * FROM conversations WHERE id=?', (report['conversation_id'],)).fetchone() if report else
            c.execute('SELECT * FROM conversations WHERE reference=?', (reference,)).fetchone() if reference else None)
    require(conv is not None, 'Name the reported conversation or its reference.', 404)
    at = NOW()
    c.execute('INSERT INTO emergency_reviews VALUES(?,?,?,?,?,?)', ('er-' + secrets.token_hex(10), conv['id'], u['id'], reason, report['id'] if report else None, at))
    audit(c, u, conv['parish_id'], 'messages.emergency-review', {'conversation': conv['reference'], 'reason': reason})
    rows = c.execute('SELECT * FROM conversation_messages WHERE conversation_id=? ORDER BY created_at,id', (conv['id'],)).fetchall()
    members = [r['user_id'] for r in c.execute("SELECT user_id FROM conversation_members WHERE conversation_id=? AND side='person'", (conv['id'],))]
    names = names_of(c, members + [r['author_id'] for r in rows])
    messages, people = [message_view(r, names) for r in rows], [names.get(x, '') for x in members]
    return dict(conversation=dict(reference=conv['reference'], subject=conv['subject'], kind=conv['kind'], context=json.loads(conv['context'] or '{}'),
                                  people=people, createdAt=conv['created_at']), messages=messages, recordedAt=at)


# Complaints. The person raising one chooses who receives it from the people suggested for its context;
# only they (and nobody by rank) see it, its status or that it exists. Identity stays the submitter's choice.
def concern_recipient_options(c, u, pid, d, person, gids):
    """Who a complaint can go to: the parish's priests, the leaders of the submitter's ministries and the
    reviewers the parish appointed, each with the contexts it is suggested for."""
    blocked = blocked_accounts(c)
    diocese = c.execute('SELECT diocese FROM parishes WHERE id=?', (pid,)).fetchone()['diocese']
    options = {}

    def add(user_id, role, roleAr, suggest):
        if user_id == u['id'] or not reachable(blocked, user_id, pid, diocese): return
        item = options.setdefault(user_id, dict(id=user_id, name='', roles=[], suggested=[]))
        if role not in [r['en'] for r in item['roles']]: item['roles'].append(dict(en=role, ar=roleAr))
        for s in suggest:
            if s not in item['suggested']: item['suggested'].append(s)
    for user_id in parish_priest_accounts(c, pid):
        add(user_id, 'Priest of the parish', 'كاهن الرعية', ['parish'] + ['group:' + g for g in sorted(gids)])
    for g in d['GROUPS']:
        if g['id'] not in gids: continue
        for user_id in group_leader_accounts(c, pid, g):
            add(user_id, 'Leader of ' + g.get('name', ''), 'مسؤول ' + g.get('ar', g.get('name', '')), ['group:' + g['id']])
    for r in c.execute('SELECT user_id,permissions FROM complaint_reviewers WHERE parish_id=?', (pid,)):
        if 'Review' in json.loads(r['permissions']):
            add(r['user_id'], 'Appointed reviewer', 'مراجِع معيَّن', ['sensitive'])
    names = names_of(c, options)
    for item in options.values(): item['name'] = names.get(item['id'], '')
    return sorted(options.values(), key=lambda x: x['name'].casefold())


def concern_identity(c, pid, d, r):
    """An identified submitter as their recipients see them: their name, and the contact they asked to be followed up on."""
    account = c.execute('SELECT name FROM users WHERE id=?', (r['user_id'],)).fetchone()
    link = c.execute('SELECT person_id FROM parish_accounts WHERE parish_id=? AND user_id=? AND person_id IS NOT NULL LIMIT 1',
                     (pid, r['user_id'])).fetchone()
    person = next((p for p in d['PEOPLE'] if link and p['id'] == link['person_id']), {})
    out = dict(name=account['name'] if account else '')
    if r['follow_up'] == 'phone': out['phone'] = person.get('phone', '')
    if r['follow_up'] == 'email': out['email'] = d.get('PERSON_EXTRA', {}).get(person.get('id', ''), {}).get('email', '')
    return out


def concerns_received(c, u, pid, d, person):
    """The complaints whose submitters chose this account, except any that name it."""
    out = []
    for r in c.execute('SELECT m.* FROM member_concerns m JOIN concern_recipients x ON x.concern_id=m.id '
                       'WHERE m.parish_id=? AND x.user_id=? ORDER BY m.created_at DESC', (pid, u['id'])).fetchall():
        if reviewer_conflict(u, person, r): continue
        item = concern_public(c, r, reviewer_permissions={'Review', 'ViewSensitive'})
        ids = concern_recipient_ids(c, r['id'])
        names = names_of(c, ids)
        item.update(sensitive=sensitive_concern(r['category']), recipients=[dict(id=i, name=names.get(i, '')) for i in ids])
        if r['user_id']: item['identity'] = concern_identity(c, pid, d, r)
        out.append(item)
        complaint_log(c, r['id'], u['id'], 'view')
    return out


def concern_recipient_ids(c, concern_id):
    return [r['user_id'] for r in c.execute('SELECT user_id FROM concern_recipients WHERE concern_id=? ORDER BY added_at,user_id', (concern_id,))]


def concern_recipients_check(c, u, pid, d, person, gids, ids, people_involved):
    options = {o['id']: o for o in concern_recipient_options(c, u, pid, d, person, gids)}
    require(isinstance(ids, list) and 0 < len(ids) <= 10 and len(set(ids)) == len(ids) and all(i in options for i in ids),
            'Choose who should receive this concern.')
    involved = (people_involved or '').casefold()
    for i in ids:
        account = c.execute('SELECT name,username,person_id FROM users WHERE id=?', (i,)).fetchone()
        named = next((p for p in d['PEOPLE'] if p['id'] == account['person_id']), {}) if account else {}
        require(not reviewer_conflict(account, named, {'people_involved': involved}),
                options[i]['name'] + ' is named in this concern, so they cannot receive it. Choose someone else.')
    return ids


# ───────────── Plans: modules a parish uses, bundles, diocesan arrangements, change requests ─────────────
# A plan says which modules a parish has switched on; it never grants anyone access — people still need
# the role permissions for each part. No prices, limits or billing periods are set and nothing is charged:
# this is configuration only. Every parish that had no plan keeps every module it had (all of them), and
# changing a plan never deletes records, cancels bookings or drops requests that are already waiting.
PLAN_MODULES = [
    ('presence', 'Public presence', 'الحضور العام', 'The public parish page, published information, news and following. Always included.',
     'صفحة الرعية العامة والمعلومات المنشورة والأخبار والمتابعة. مشمولة دائماً.'),
    ('members', 'Members and member portal', 'الأعضاء وبوّابتهم', 'Membership requests, invitations and the member portal.', 'طلبات الانتساب والدعوات وبوّابة الأعضاء.'),
    ('office', 'Parish office and records', 'مكتب الرعية والسجلات', 'People, households, pastoral notes and reports.', 'المؤمنون والعائلات والملاحظات الرعوية والتقارير.'),
    ('sacraments', 'Sacraments and certificates', 'الأسرار والشهادات', 'Sacrament requests and preparation, the register and certificates.', 'طلبات الأسرار والتحضير والسجل والشهادات.'),
    ('requests', 'Requests, forms and workflows', 'الطلبات والاستمارات والمسارات', 'General requests from members, forms and workflows.', 'الطلبات العامة من الأعضاء والاستمارات والمسارات.'),
    ('documents', 'Document requests without an account', 'طلب الوثائق دون حساب', 'Certificates asked for from the public page, with a private tracking link.', 'شهادات تُطلب من الصفحة العامة مع رابط متابعة خاص.'),
    ('ministries', 'Ministries and volunteers', 'الخدمات والمتطوّعون', 'Ministries, applications, attendance, volunteers and rotas.', 'الخدمات والطلبات والحضور والمتطوّعون وجداول الخدمة.'),
    ('events', 'Calendar, services and registrations', 'الرزنامة والخدم والتسجيلات', 'The calendar, service planning, the music library, registrations and check-in.', 'الرزنامة وتخطيط الخدم ومكتبة الألحان والتسجيلات والحضور.'),
    ('reservations', 'Reservations', 'الحجوزات', 'Hall and room booking requests and their approval.', 'طلبات حجز القاعات والغرف والموافقة عليها.'),
    ('resources', 'Facilities and resources', 'المرافق والموارد', 'Rooms, equipment and maintenance.', 'القاعات والمعدّات والصيانة.'),
    ('communications', 'Communications', 'التواصل', 'Notices, broadcasts, prayer requests and member communication.', 'الإعلانات والرسائل الجماعية ونوايا الصلاة والتواصل مع الأعضاء.'),
    ('finance', 'Giving and finance', 'التقدمات والمالية', 'Gifts, counting sessions, funds and expenses.', 'التقدمات وجلسات العدّ والصناديق والمصاريف.'),
]
ALL_MODULES = [m[0] for m in PLAN_MODULES]
PRESENCE_DOCUMENTS = ('undecided', 'included', 'separate')
PLAN_SCHEMA = '''
CREATE TABLE IF NOT EXISTS plan_bundles(id TEXT PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '', description_ar TEXT NOT NULL DEFAULT '', modules TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, created_by TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS plan_arrangements(id TEXT PRIMARY KEY, diocese TEXT NOT NULL REFERENCES dioceses(id), name TEXT NOT NULL,
  bundle_id TEXT, modules TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, created_by TEXT, ended_at TEXT, ended_by TEXT);
CREATE TABLE IF NOT EXISTS parish_plans(parish_id TEXT PRIMARY KEY REFERENCES parishes(id), mode TEXT NOT NULL, bundle_id TEXT,
  modules TEXT NOT NULL, arrangement_id TEXT, updated_at TEXT NOT NULL, updated_by TEXT);
CREATE TABLE IF NOT EXISTS plan_requests(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id),
  requested_by TEXT NOT NULL REFERENCES users(id), bundle_id TEXT, modules TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL, created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT, decision_note TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS plan_requests_parish ON plan_requests(parish_id,status);
CREATE TABLE IF NOT EXISTS plan_history(id TEXT PRIMARY KEY, parish_id TEXT, arrangement_id TEXT, action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}', actor TEXT, at TEXT NOT NULL);
'''
# Starting options. Public Presence is the option the requirements name; the other two only show how
# bundles look and are marked as demonstration configuration, not approved packages.
SEED_BUNDLES = [
    ('public-presence', 'Public Presence', 'الحضور العام', 'Appearing on ParishLife with the parish’s public profile and published information, without operational modules.',
     'الظهور على ParishLife بملف الرعية العام ومعلوماتها المنشورة، دون الوحدات التشغيلية.', ['presence'], 0),
    ('demo-office', 'Example: parish office (demonstration)', 'مثال: مكتب الرعية (للعرض)', 'Demonstration configuration only — not an approved package.',
     'إعداد للعرض فقط — ليس باقة معتمدة.', ['presence', 'members', 'office', 'sacraments', 'requests', 'documents', 'communications'], 1),
    ('demo-complete', 'Example: every module (demonstration)', 'مثال: كل الوحدات (للعرض)', 'Demonstration configuration only — not an approved package.',
     'إعداد للعرض فقط — ليس باقة معتمدة.', ALL_MODULES, 1),
]


def migrate_plans(c):
    c.executescript(PLAN_SCHEMA)
    if c.execute("SELECT 1 FROM schema_migrations WHERE name='v2-demo-parishes'").fetchone() is None:
        # The parishes the seed created are demonstration data; say so, unless someone already said otherwise.
        seed_ids = {p['id'] for p in json.loads((ROOT / 'backend' / 'seed.json').read_text(encoding='utf-8'))['PARISHES']}
        for row in c.execute('SELECT id,metadata FROM parishes').fetchall():
            meta = json.loads(row['metadata'])
            if row['id'] in seed_ids and 'demo' not in meta:
                meta['demo'] = True
                c.execute('UPDATE parishes SET metadata=? WHERE id=?', (json.dumps(meta), row['id']))
        c.execute("INSERT INTO schema_migrations VALUES('v2-demo-parishes',?)", (NOW(),))
    if c.execute("SELECT 1 FROM schema_migrations WHERE name='v2-plans'").fetchone() is None:
        at = NOW()
        for bid, name, name_ar, desc, desc_ar, modules, demo in SEED_BUNDLES:
            c.execute('INSERT OR IGNORE INTO plan_bundles VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                      (bid, name, name_ar, desc, desc_ar, json.dumps(modules), demo, 'active', at, None, at))
        c.execute("INSERT INTO schema_migrations VALUES('v2-plans',?)", (at,))


def clean_modules(modules):
    require(isinstance(modules, list) and all(m in ALL_MODULES for m in modules), 'Choose modules from the list.')
    return [m for m in ALL_MODULES if m in set(modules) | {'presence'}]


def parish_plan(c, pid):
    """A parish's plan. Without one (every parish before plans existed), every module stays on."""
    row = c.execute('SELECT * FROM parish_plans WHERE parish_id=?', (pid,)).fetchone()
    if row is None: return dict(parish=pid, mode='unchosen', bundle=None, modules=list(ALL_MODULES), arrangement=None, updatedAt='')
    return dict(parish=pid, mode=row['mode'], bundle=row['bundle_id'], modules=json.loads(row['modules']), arrangement=row['arrangement_id'],
                updatedAt=row['updated_at'])


def module_on(c, pid, module):
    return module in parish_plan(c, pid)['modules']


def presence_documents(c):
    row = c.execute("SELECT value FROM settings WHERE scope='system' AND scope_id='' AND key='presenceDocuments'").fetchone()
    return json.loads(row['value']) if row else 'undecided'


def documents_open(c, pid):
    """Whether a parish takes certificate requests from its public page. Until the operator decides whether
    Public Presence includes them, they stay available to every parish, as they were."""
    return module_on(c, pid, 'documents') or presence_documents(c) != 'separate'


def require_module(c, pid, module, what):
    require(module_on(c, pid, module), f'This parish does not offer {what} on ParishLife at the moment.', 403)


def plan_catalog(c, all_bundles=False):
    bundles = [dict(id=r['id'], name=r['name'], nameAr=r['name_ar'], description=r['description'], descriptionAr=r['description_ar'],
                    modules=json.loads(r['modules']), demo=bool(r['demo']), status=r['status'])
               for r in c.execute('SELECT * FROM plan_bundles ORDER BY demo,created_at,id') if all_bundles or r['status'] == 'active']
    return dict(modules=[dict(id=m[0], en=m[1], ar=m[2], about=m[3], aboutAr=m[4], always=m[0] == 'presence') for m in PLAN_MODULES],
                bundles=bundles, presenceDocuments=presence_documents(c), billing='not-live')


def plans_public(c):
    """The public "Plans for parishes" page: what can be switched on, the bundles on offer, and nothing about prices."""
    return plan_catalog(c)


def plan_pending_work(c, pid, removed):
    """What is still waiting in modules a change would switch off. It all stays, and can still be finished."""
    if not removed: return {}
    d = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()['data'])
    count = lambda sql, *a: c.execute(sql, (pid, *a)).fetchone()[0]
    out = {}
    if 'reservations' in removed:
        out['reservations'] = sum(1 for r in d.get('RESERVATIONS', []) if r.get('status') == 'pending') + \
            count("SELECT COUNT(*) FROM member_requests WHERE parish_id=? AND kind='booking' AND status='submitted'")
    if 'sacraments' in removed:
        out['sacraments'] = sum(1 for s in d.get('SACRAMENTS', []) if s.get('status') in {'requested', 'office-reviewed', 'awaiting-signature', 'preparing', 'scheduled', 'draft', 'approved'}) + \
            count("SELECT COUNT(*) FROM member_requests WHERE parish_id=? AND kind NOT IN ('booking','custom') AND status IN ('submitted','accepted')")
    if 'requests' in removed:
        out['requests'] = count("SELECT COUNT(*) FROM member_requests WHERE parish_id=? AND kind='custom' AND status IN ('submitted','accepted')") + len(d.get('PORTAL_REQUESTS', []))
    if 'documents' in removed:
        out['documents'] = count("SELECT COUNT(*) FROM guest_requests WHERE parish_id=? AND status IN ('submitted','accepted')")
    if 'ministries' in removed:
        out['ministries'] = count("SELECT COUNT(*) FROM ministry_applications WHERE parish_id=? AND status IN ('pending','leader-approved')") + \
            count("SELECT COUNT(*) FROM ministry_inquiries WHERE parish_id=? AND status='new'")
    if 'members' in removed:
        out['members'] = count("SELECT COUNT(*) FROM membership_requests WHERE parish_id=? AND status='pending'")
    return {k: v for k, v in out.items() if v}


def plan_record(c, u, pid, arrangement, action, detail):
    c.execute('INSERT INTO plan_history VALUES(?,?,?,?,?,?,?)', ('ph-' + secrets.token_hex(8), pid, arrangement, action, json.dumps(detail),
                                                                u['id'] if u else None, NOW()))


def set_parish_plan(c, u, pid, mode, bundle_id, modules, arrangement_id, action):
    before = parish_plan(c, pid)
    at = NOW()
    c.execute('INSERT INTO parish_plans VALUES(?,?,?,?,?,?,?) ON CONFLICT(parish_id) DO UPDATE SET mode=excluded.mode,bundle_id=excluded.bundle_id,'
              'modules=excluded.modules,arrangement_id=excluded.arrangement_id,updated_at=excluded.updated_at,updated_by=excluded.updated_by',
              (pid, mode, bundle_id, json.dumps(modules), arrangement_id, at, u['id']))
    removed = [m for m in before['modules'] if m not in modules]
    plan_record(c, u, pid, arrangement_id, action, dict(mode=mode, bundle=bundle_id, modules=modules, removed=removed,
                                                         added=[m for m in modules if m not in before['modules']]))
    audit(c, u, pid, 'plan.' + action, dict(mode=mode, bundle=bundle_id, removed=removed))
    for user_id in parish_priest_accounts(c, pid):
        if user_id != u['id']:
            notify_account(c, user_id, pid, 'plan', 'The parish plan changed', ', '.join(m for m in modules), 'administration/plans')


def bundle_modules(c, bundle_id):
    row = c.execute("SELECT modules FROM plan_bundles WHERE id=? AND status='active'", (bundle_id,)).fetchone()
    require(row is not None, 'Choose a bundle that is on offer.')
    return json.loads(row['modules'])


def chosen_modules(c, q):
    """A bundle and any modules added to it, or a list of modules alone."""
    bundle_id = q.get('bundle') or None
    base = bundle_modules(c, bundle_id) if bundle_id else []
    return bundle_id, clean_modules(base + list(q.get('modules') or []))


def diocese_sponsors(c, did):
    out = []
    for r in c.execute("SELECT DISTINCT user_id FROM role_assignments WHERE scope='diocese' AND scope_id=? AND status='active'", (did,)).fetchall():
        account = c.execute('SELECT * FROM users WHERE id=?', (r['user_id'],)).fetchone()
        if account and 'plans.sponsor' in diocese_perms(authority(c, account), did): out.append(r['user_id'])
    return out


def plans_view(c, u):
    """Plan management within this account's authority: its parishes (as their priest), its dioceses'
    arrangements and change requests (as bishop or diocesan admin), and the options on offer (super admin)."""
    auth = authority(c, u)
    system = system_perms(auth)
    out = dict(plan_catalog(c, all_bundles='plans.configure' in system), configure='plans.configure' in system, parishes=[], dioceses=[])
    for r in c.execute('SELECT * FROM parishes ORDER BY rowid').fetchall():
        meta = json.loads(r['metadata'])
        ctx = parish_context(c, u, r['id'], auth, r)
        manage = bool(ctx and 'plans.manage' in ctx['perms'])
        sponsor = 'plans.sponsor' in diocese_perms(auth, r['diocese'])
        if not (manage or sponsor): continue
        plan = parish_plan(c, r['id'])
        requests = [dict(id=x['id'], bundle=x['bundle_id'], modules=json.loads(x['modules']), note=x['note'], status=x['status'],
                         createdAt=x['created_at'], requestedBy=x['requested_by'], decidedAt=x['decided_at'] or '', decisionNote=x['decision_note'])
                    for x in c.execute('SELECT * FROM plan_requests WHERE parish_id=? ORDER BY created_at DESC LIMIT 20', (r['id'],))]
        history = [dict(action=x['action'], detail=json.loads(x['detail']), at=x['at']) for x in c.execute(
            'SELECT * FROM plan_history WHERE parish_id=? ORDER BY at DESC LIMIT 10', (r['id'],))]
        out['parishes'].append(dict(id=r['id'], name=meta.get('name', ''), ar=meta.get('ar', ''), diocese=r['diocese'], plan=plan,
                                    manage=manage, sponsor=sponsor, requests=requests, history=history))
    names = names_of(c, [r['requestedBy'] for p in out['parishes'] for r in p['requests']])
    for p in out['parishes']:
        for r in p['requests']: r['requestedByName'] = names.get(r['requestedBy'], '')
    for d in c.execute("SELECT * FROM dioceses WHERE id<>'' ORDER BY name").fetchall():
        if 'plans.sponsor' not in diocese_perms(auth, d['id']): continue
        arrangements = [dict(id=a['id'], name=a['name'], bundle=a['bundle_id'], modules=json.loads(a['modules']), status=a['status'], note=a['note'],
                             createdAt=a['created_at'], endedAt=a['ended_at'] or '',
                             parishes=[x['parish_id'] for x in c.execute('SELECT parish_id FROM parish_plans WHERE arrangement_id=?', (a['id'],))])
                        for a in c.execute('SELECT * FROM plan_arrangements WHERE diocese=? ORDER BY created_at DESC', (d['id'],))]
        out['dioceses'].append(dict(id=d['id'], name=d['name'], arrangements=arrangements))
    return out


def plans_action(c, u, q):
    auth = authority(c, u)
    op, at = q.get('op'), NOW()
    if op in {'bundleSave', 'bundleRetire', 'setPresenceDocuments'}:
        require('plans.configure' in system_perms(auth), 'Only a super admin configures the plan options.', 403)
        if op == 'setPresenceDocuments':
            value = q.get('value')
            require(value in PRESENCE_DOCUMENTS, 'Choose whether Public Presence includes document requests.')
            c.execute("INSERT INTO settings VALUES('system','','presenceDocuments',?,?,?) ON CONFLICT(scope,scope_id,key) DO UPDATE SET "
                      "value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by", (json.dumps(value), at, u['id']))
            plan_record(c, u, None, None, 'presence-documents', dict(value=value))
            return {}
        if op == 'bundleRetire':
            row = c.execute('SELECT * FROM plan_bundles WHERE id=?', (q.get('id'),)).fetchone()
            require(row is not None, 'Bundle not found.', 404)
            # Parishes on it keep their modules; it is simply no longer offered.
            c.execute("UPDATE plan_bundles SET status=?,updated_at=? WHERE id=?", ('retired' if q.get('retire', True) else 'active', at, row['id']))
            plan_record(c, u, None, None, 'bundle-retired' if q.get('retire', True) else 'bundle-offered', dict(bundle=row['id']))
            return {}
        name = clean(q.get('name'), 80, 'Give the bundle a name of up to 80 characters.')
        name_ar = clean(q.get('nameAr'), 80, 'Keep the Arabic name within 80 characters.', required=False)
        desc = clean(q.get('description'), 400, 'Keep the description within 400 characters.', required=False)
        desc_ar = clean(q.get('descriptionAr'), 400, 'Keep the Arabic description within 400 characters.', required=False)
        modules = clean_modules(q.get('modules'))
        demo = 1 if q.get('demo') is not False else 0   # a new bundle is a demonstration until someone says it is not
        bid = q.get('id')
        if bid:
            require(c.execute('SELECT 1 FROM plan_bundles WHERE id=?', (bid,)).fetchone() is not None, 'Bundle not found.', 404)
            c.execute('UPDATE plan_bundles SET name=?,name_ar=?,description=?,description_ar=?,modules=?,demo=?,updated_at=? WHERE id=?',
                      (name, name_ar, desc, desc_ar, json.dumps(modules), demo, at, bid))
        else:
            bid = 'pb-' + secrets.token_hex(6)
            c.execute('INSERT INTO plan_bundles VALUES(?,?,?,?,?,?,?,?,?,?,?)', (bid, name, name_ar, desc, desc_ar, json.dumps(modules), demo, 'active', at, u['id'], at))
        plan_record(c, u, None, None, 'bundle-saved', dict(bundle=bid, modules=modules, demo=bool(demo)))
        return dict(id=bid)
    if op in {'arrangementSave', 'arrangementEnd'}:
        if op == 'arrangementEnd':
            a = c.execute("SELECT * FROM plan_arrangements WHERE id=? AND status='active'", (q.get('id'),)).fetchone()
            require(a is not None, 'Arrangement not found.', 404)
            require('plans.sponsor' in diocese_perms(auth, a['diocese']), 'Diocesan plan permission required.', 403)
            for p in c.execute('SELECT parish_id FROM parish_plans WHERE arrangement_id=?', (a['id'],)).fetchall():
                plan = parish_plan(c, p['parish_id'])   # each parish keeps its modules and manages them itself from now on
                set_parish_plan(c, u, p['parish_id'], 'independent', plan['bundle'], plan['modules'], None, 'arrangement-ended')
            c.execute("UPDATE plan_arrangements SET status='ended',ended_at=?,ended_by=? WHERE id=?", (at, u['id'], a['id']))
            return {}
        did = q.get('diocese')
        require('plans.sponsor' in diocese_perms(auth, did or ''), 'Diocesan plan permission required.', 403)
        name = clean(q.get('name'), 120, 'Name the arrangement in up to 120 characters.')
        note = clean(q.get('note'), 500, 'Keep the note within 500 characters.', required=False)
        bundle_id, modules = chosen_modules(c, q)
        parishes_in = q.get('parishes')
        diocese_parishes = {r['id'] for r in c.execute('SELECT id FROM parishes WHERE diocese=?', (did,))}
        require(isinstance(parishes_in, list) and parishes_in and set(parishes_in) <= diocese_parishes, 'Choose parishes of this diocese.')
        aid = q.get('id')
        if aid:
            a = c.execute("SELECT * FROM plan_arrangements WHERE id=? AND diocese=? AND status='active'", (aid, did)).fetchone()
            require(a is not None, 'Arrangement not found.', 404)
            c.execute('UPDATE plan_arrangements SET name=?,bundle_id=?,modules=?,note=? WHERE id=?', (name, bundle_id, json.dumps(modules), note, aid))
        else:
            aid = 'pa-' + secrets.token_hex(6)
            c.execute('INSERT INTO plan_arrangements VALUES(?,?,?,?,?,?,?,?,?,?,?)', (aid, did, name, bundle_id, json.dumps(modules), 'active', note, at, u['id'], None, None))
        current = {r['parish_id'] for r in c.execute('SELECT parish_id FROM parish_plans WHERE arrangement_id=?', (aid,))}
        losing = sorted(pid for pid in set(parishes_in) if set(parish_plan(c, pid)['modules']) - set(modules))
        require(not losing or q.get('confirmRemoval') is True, 'Confirm switching modules off for some of these parishes. Their records are kept.')
        for pid in sorted(set(parishes_in)):
            other = parish_plan(c, pid)['arrangement']
            require(other in (None, aid), 'A parish can be covered by one arrangement at a time; end or edit the other one first.', 409)
            set_parish_plan(c, u, pid, 'sponsored', bundle_id, modules, aid, 'arrangement-joined' if pid not in current else 'arrangement-updated')
        for pid in sorted(current - set(parishes_in)):
            plan = parish_plan(c, pid)
            set_parish_plan(c, u, pid, 'independent', plan['bundle'], plan['modules'], None, 'arrangement-left')
        return dict(id=aid)
    pid = q.get('parish')
    parish = c.execute('SELECT * FROM parishes WHERE id=?', (pid,)).fetchone()
    require(parish is not None, 'Parish not found.', 404)
    ctx = parish_context(c, u, pid, auth, parish)
    manage = bool(ctx and 'plans.manage' in ctx['perms'])
    sponsor = 'plans.sponsor' in diocese_perms(auth, parish['diocese'])
    plan = parish_plan(c, pid)
    if op == 'preview':
        require(manage or sponsor, 'Plan permission required.', 403)
        _, modules = chosen_modules(c, q)
        removed = [m for m in plan['modules'] if m not in modules]
        return dict(modules=modules, removed=removed, added=[m for m in modules if m not in plan['modules']], pending=plan_pending_work(c, pid, removed))
    if op == 'activate':
        require(manage, 'The parish priest manages the parish plan.', 403)
        require(plan['mode'] != 'sponsored', 'The diocese manages this parish’s plan. Send a change request instead.', 409)
        bundle_id, modules = chosen_modules(c, q)
        removed = [m for m in plan['modules'] if m not in modules]
        require(not removed or q.get('confirmRemoval') is True, 'Confirm switching off ' + ', '.join(removed) + '. Their records are kept.')
        set_parish_plan(c, u, pid, 'independent', bundle_id, modules, None, 'activated')
        return dict(plan=parish_plan(c, pid))
    if op == 'request':
        require(manage, 'The parish priest asks for plan changes.', 403)
        require(plan['mode'] == 'sponsored', 'This parish manages its own plan; activate the change directly.', 409)
        require(c.execute("SELECT 1 FROM plan_requests WHERE parish_id=? AND status='pending'", (pid,)).fetchone() is None,
                'A change request is already waiting for the diocese.', 409)
        bundle_id, modules = chosen_modules(c, q)
        note = clean(q.get('note'), 500, 'Keep the note within 500 characters.', required=False)
        rid = 'pr-' + secrets.token_hex(8)
        c.execute('INSERT INTO plan_requests(id,parish_id,requested_by,bundle_id,modules,note,status,created_at) VALUES(?,?,?,?,?,?,?,?)',
                  (rid, pid, u['id'], bundle_id, json.dumps(modules), note, 'pending', at))
        plan_record(c, u, pid, plan['arrangement'], 'change-requested', dict(request=rid, modules=modules))
        for user_id in diocese_sponsors(c, parish['diocese']):
            notify_account(c, user_id, pid, 'plan', 'A parish asked to change its plan', json.loads(parish['metadata']).get('name', ''), 'administration/plans')
        return dict(id=rid)
    if op in {'withdrawRequest', 'decideRequest'}:
        r = c.execute("SELECT * FROM plan_requests WHERE id=? AND parish_id=? AND status='pending'", (q.get('id'), pid)).fetchone()
        require(r is not None, 'There is no waiting request.', 404)
        if op == 'withdrawRequest':
            require(manage, 'The parish priest manages the parish plan.', 403)
            c.execute("UPDATE plan_requests SET status='withdrawn',decided_by=?,decided_at=? WHERE id=?", (u['id'], at, r['id']))
            plan_record(c, u, pid, plan['arrangement'], 'change-withdrawn', dict(request=r['id']))
            return {}
        require(sponsor, 'Diocesan plan permission required.', 403)
        decision = q.get('decision')
        require(decision in {'approve', 'decline'}, 'Approve or decline the request.')
        note = clean(q.get('note'), 500, 'Keep the note within 500 characters.', required=False)
        c.execute('UPDATE plan_requests SET status=?,decided_by=?,decided_at=?,decision_note=? WHERE id=?',
                  ('approved' if decision == 'approve' else 'declined', u['id'], at, note, r['id']))
        if decision == 'approve':
            set_parish_plan(c, u, pid, plan['mode'] if plan['mode'] == 'sponsored' else 'independent', r['bundle_id'], json.loads(r['modules']),
                            plan['arrangement'], 'change-approved')
        else:
            plan_record(c, u, pid, plan['arrangement'], 'change-declined', dict(request=r['id'], note=note))
        notify_account(c, r['requested_by'], pid, 'plan', 'Your plan change request was ' + ('approved' if decision == 'approve' else 'declined'),
                       note, 'administration/plans')
        return {}
    raise Problem(400, 'Unknown action.')


# ───────────── Organisation, roles and permissions ─────────────
# Diocese → parishes → ministries. Access comes from role assignments scoped to the whole
# system, one diocese or one parish; one account can hold several, in different places.
# Accounts made before this (or by the operator tools) keep their old access until something
# new is recorded for them, when it is first copied into the new tables (materialize_legacy).
STAFF_ROLES = ('priest', 'parishadmin', 'secretary', 'treasurer', 'leader')   # strongest first
DIOCESE_ROLES = ('bishop', 'diocesanadmin')
RANK = {'superadmin': 0, 'bishop': 1, 'diocesanadmin': 2, 'priest': 3, 'parishadmin': 4,
        'secretary': 5, 'treasurer': 5, 'leader': 6}
# The parish workspace a role opens; a parish admin works in the office workspace.
WORKSPACE_ROLE = {'priest': 'priest', 'parishadmin': 'secretary', 'secretary': 'secretary',
                  'treasurer': 'treasurer', 'leader': 'leader'}
ROLE_TITLES = {'superadmin': ('Super admin', 'المدير العام'), 'bishop': ('Bishop', 'المطران'),
               'diocesanadmin': ('Diocesan admin', 'إداري الأبرشية'), 'priest': ('Parish priest', 'كاهن الرعية'),
               'parishadmin': ('Parish admin', 'إداري الرعية'), 'secretary': ('Parish secretary', 'أمانة سرّ الرعية'),
               'treasurer': ('Parish treasurer', 'أمين صندوق الرعية'), 'leader': ('Ministry leader', 'مسؤول خدمة'),
               'member': ('Parish member', 'عضو في الرعية'), 'follower': ('Following', 'متابِع للرعية')}
# code, level, English, Arabic. Fixed permissions belong to one role and are never delegated.
PERMISSIONS = [
    ('people.manage', 'parish', 'People, households and person records', 'المؤمنون والعائلات وسجلات الأشخاص'),
    ('sacraments.manage', 'parish', 'Sacrament requests and preparation', 'طلبات الأسرار والتحضير'),
    ('sacraments.sign', 'parish', 'Sign official sacramental documents', 'توقيع وثائق الأسرار الرسمية'),
    ('requests.manage', 'parish', 'Online requests, forms and workflows', 'الطلبات الإلكترونية والاستمارات والمسارات'),
    ('events.manage', 'parish', 'Calendar, services, registrations and check-in', 'الرزنامة والخدم والتسجيلات والحضور'),
    ('ministries.manage', 'parish', 'Ministries, volunteers and rotas', 'الخدمات والمتطوّعون وجداول الخدمة'),
    ('facilities.manage', 'parish', 'Rooms, bookings and equipment', 'القاعات والحجوزات والمعدّات'),
    ('communications.manage', 'parish', 'Notices, broadcasts and prayer requests', 'الإعلانات والرسائل الجماعية ونوايا الصلاة'),
    ('messages.office', 'parish', 'Read and answer the parish office inbox', 'قراءة بريد مكتب الرعية والردّ عليه'),
    ('website.publish', 'parish', 'Public website content', 'محتوى الموقع العام'),
    ('finance.view', 'parish', 'See giving and finance', 'الاطّلاع على التقدمات والمالية'),
    ('finance.edit', 'parish', 'Record gifts, expenses and the exchange rate', 'تسجيل التقدمات والمصاريف وسعر الصرف'),
    ('settings.manage', 'parish', 'Parish settings and profile', 'إعدادات الرعية وملفّها'),
    ('staff.manage', 'parish', 'Appoint staff and adjust their permissions', 'تعيين العاملين وتعديل صلاحياتهم'),
    ('access.manage', 'parish', 'Deactivate and reactivate access', 'إيقاف الوصول وإعادته'),
    ('audit.view', 'parish', 'Audit trail', 'سجل التدقيق'),
    ('notes.pastoral', 'parish', 'Pastoral notes (author-private unless shared)', 'الملاحظات الرعوية (خاصة بكاتبها ما لم تُشارك)'),
    ('plans.manage', 'parish', 'The parish plan and its modules', 'خطة الرعية ووحداتها'),
    ('parishes.create', 'diocese', 'Create parishes in the diocese', 'إنشاء رعايا في الأبرشية'),
    ('clergy.assign', 'diocese', 'Clergy service assignments', 'تعيينات خدمة الإكليروس'),
    ('clergy.title', 'diocese', 'Change clergy titles', 'تغيير ألقاب الإكليروس'),
    ('diocese.staff', 'diocese', 'Appoint diocesan and parish admins', 'تعيين إداريي الأبرشية والرعايا'),
    ('documents.accept', 'diocese', 'Accept documents signed by priests', 'قبول الوثائق التي وقّعها الكهنة'),
    ('diocese.policies', 'diocese', 'Diocesan policies', 'سياسات الأبرشية'),
    ('plans.sponsor', 'diocese', 'Diocesan plan arrangements and plan change requests', 'ترتيبات الخطط الأبرشية وطلبات تغيير الخطط'),
    ('dioceses.manage', 'system', 'Create dioceses and provision bishops', 'إنشاء الأبرشيات وتجهيز حسابات المطارنة'),
    ('accounts.global', 'system', 'Deactivate accounts everywhere', 'إيقاف الحسابات في كل مكان'),
    ('messages.emergency', 'system', 'Emergency review of a reported conversation', 'المراجعة الطارئة لمحادثة مُبلَّغ عنها'),
    ('plans.configure', 'system', 'Plan options offered to parishes', 'خيارات الخطط المعروضة على الرعايا'),
]
PERMISSION_CODES = {p[0] for p in PERMISSIONS}
PERMISSION_LEVEL = {p[0]: p[1] for p in PERMISSIONS}
# Never granted through an adjustment, and never part of a "full access" shortcut.
FIXED_PERMISSIONS = {'sacraments.sign': 'priest', 'notes.pastoral': 'priest', 'clergy.title': 'bishop',
                     'documents.accept': 'bishop', 'diocese.policies': 'bishop', 'messages.emergency': 'superadmin'}
PARISH_OFFICE = ['people.manage', 'sacraments.manage', 'requests.manage', 'events.manage', 'ministries.manage',
                 'facilities.manage', 'communications.manage', 'messages.office', 'website.publish']
# Diocesan and system roles also carry parish permissions: they never open a parish's records with
# them, but they are what such an administrator may hand on when appointing a parish admin.
PARISH_ADMIN = PARISH_OFFICE + ['settings.manage', 'staff.manage', 'access.manage', 'audit.view']
ROLE_TEMPLATES = {
    'superadmin': ['dioceses.manage', 'accounts.global', 'messages.emergency', 'plans.configure', 'parishes.create', 'clergy.assign',
                   'diocese.staff', 'plans.sponsor', 'finance.view'] + PARISH_ADMIN,
    'bishop': ['parishes.create', 'clergy.assign', 'clergy.title', 'diocese.staff', 'documents.accept', 'diocese.policies',
               'plans.sponsor', 'finance.view'] + PARISH_ADMIN,
    'diocesanadmin': ['parishes.create', 'clergy.assign', 'diocese.staff', 'plans.sponsor'] + PARISH_ADMIN,
    'priest': [p[0] for p in PERMISSIONS if p[1] == 'parish'],
    'parishadmin': list(PARISH_ADMIN),
    'secretary': list(PARISH_OFFICE),
    'treasurer': ['finance.view', 'finance.edit'],
    'leader': [],
}
# What changing each part of the parish workspace needs. Parts not listed need settings.manage.
KEY_PERMS = dict(
    **{k: 'people.manage' for k in ('PEOPLE', 'ARCHIVED', 'HOUSEHOLDS', 'FAMILIES', 'BRANCHES', 'PERSON_EXTRA', 'PHOTOS',
                                    'DUPLICATES', 'INCIDENTS', 'EVACUATION')},
    SACRAMENTS='sacraments.manage',
    **{k: 'requests.manage' for k in ('PORTAL_REQUESTS', 'REQUEST_HISTORY', 'WORKFLOWS', 'RUNS', 'RUN_LOG', 'FORM_FIELDS',
                                      'FORM_RULES', 'AUTOMATIONS')},
    **{k: 'events.manage' for k in ('EVENTS', 'EVENT_DETAIL', 'EVENT_TEMPLATES', 'SERVICE', 'SERVICE_PLANS', 'SERVICE_TEMPLATES',
                                    'SERVICE_REQUESTS', 'CHECKIN', 'PICKUP', 'REGISTRATIONS', 'REG_FORM', 'REGISTRANTS', 'REFUNDS')},
    **{k: 'ministries.manage' for k in ('GROUPS', 'GROUP_DETAIL', 'VOLUNTEERS', 'ROTA', 'SIGNUP_SHEETS')},
    **{k: 'facilities.manage' for k in ('RESERVATIONS', 'VENUES', 'EQUIPMENT', 'MAINTENANCE', 'ISSUES', 'RENTALS')},
    **{k: 'communications.manage' for k in ('MESSAGES', 'NOTICES', 'PRAYERS')},
    CONTENT='website.publish',
    **{k: 'finance.edit' for k in sorted(FINANCE | {'RATE'})},
    NOTES='notes.pastoral')
CLERGY_TITLES = ('Deacon', 'Priest', 'Monsignor', 'Archimandrite', 'Chorbishop', 'Bishop', 'Archbishop', 'Patriarch')
CLERGY_OFFICES = {'parish-priest': ('Parish priest', 'كاهن الرعية'), 'assistant-priest': ('Assistant priest', 'كاهن مساعد'),
                  'deacon': ('Deacon', 'شمّاس'), 'other': ('Other service', 'خدمة أخرى')}
PRIESTLY_OFFICES = {'parish-priest', 'assistant-priest'}

V2_SCHEMA = '''
CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS role_assignments(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL, scope TEXT NOT NULL, scope_id TEXT NOT NULL, grants TEXT NOT NULL DEFAULT '[]',
  revokes TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active', note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, created_by TEXT, ended_at TEXT, ended_by TEXT);
CREATE INDEX IF NOT EXISTS role_assignments_user ON role_assignments(user_id,status);
CREATE INDEX IF NOT EXISTS role_assignments_scope ON role_assignments(scope,scope_id,status);
CREATE TABLE IF NOT EXISTS parish_links(user_id TEXT NOT NULL REFERENCES users(id), parish_id TEXT NOT NULL REFERENCES parishes(id),
  kind TEXT NOT NULL, status TEXT NOT NULL, person_id TEXT, is_primary INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, decided_at TEXT, decided_by TEXT, PRIMARY KEY(user_id,parish_id));
CREATE INDEX IF NOT EXISTS parish_links_parish ON parish_links(parish_id,status);
CREATE TABLE IF NOT EXISTS access_blocks(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), scope TEXT NOT NULL,
  scope_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT NOT NULL,
  lifted_at TEXT, lifted_by TEXT, lift_note TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS access_blocks_user ON access_blocks(user_id,lifted_at);
CREATE TABLE IF NOT EXISTS clergy(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), name TEXT NOT NULL,
  name_ar TEXT NOT NULL DEFAULT '', diocese TEXT NOT NULL REFERENCES dioceses(id), created_at TEXT NOT NULL, created_by TEXT);
CREATE TABLE IF NOT EXISTS clergy_titles(id TEXT PRIMARY KEY, clergy_id TEXT NOT NULL REFERENCES clergy(id), title TEXT NOT NULL,
  effective_from TEXT NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', set_by TEXT, set_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clergy_assignments(id TEXT PRIMARY KEY, clergy_id TEXT NOT NULL REFERENCES clergy(id),
  parish_id TEXT NOT NULL REFERENCES parishes(id), office TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT,
  exception TEXT, note TEXT NOT NULL DEFAULT '', created_by TEXT, created_at TEXT NOT NULL, ended_by TEXT, ended_at TEXT);
CREATE TABLE IF NOT EXISTS settings(scope TEXT NOT NULL, scope_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  updated_at TEXT NOT NULL, updated_by TEXT, PRIMARY KEY(scope,scope_id,key));
'''


def migrate_v2(c):
    """Additive: new tables, a diocese row for accounts that belong to none, then (once) the
    existing roles and parish links copied into the scoped model. Nothing is deleted."""
    c.executescript(V2_SCHEMA)
    if 'metadata' not in {r['name'] for r in c.execute('PRAGMA table_info(dioceses)')}:
        c.execute("ALTER TABLE dioceses ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'")
    c.execute("INSERT OR IGNORE INTO dioceses(id,name) VALUES('','No diocese')")
    if c.execute("SELECT 1 FROM schema_migrations WHERE name='v2-roles'").fetchone() is None:
        for user in c.execute("SELECT * FROM users WHERE role IN ('bishop','priest','secretary','treasurer','leader','member')").fetchall():
            materialize_legacy(c, user, note='Copied from the account’s earlier role')
        c.execute("INSERT INTO schema_migrations VALUES('v2-roles',?)", (NOW(),))
    migrate_accounts(c)
    c.executescript(CONNECTIONS_SCHEMA)
    c.executescript(MINISTRY_SCHEMA)
    c.executescript(DOCUMENT_SCHEMA)
    migrate_privacy(c)
    migrate_plans(c)


def legacy_access(c, u):
    """The access an account had before scoped roles: one role, the parishes in `assignments`."""
    role = u['role']
    pids = [r[0] for r in c.execute('SELECT parish_id FROM assignments WHERE user_id=? ORDER BY parish_id', (u['id'],))]
    assignments, links = [], []
    if role == 'bishop':
        assignments.append(dict(id='legacy:' + u['id'], user_id=u['id'], role='bishop', scope='diocese', scope_id=u['diocese'],
                                grants='[]', revokes='[]', status='active', created_at='', note=''))
    elif role in WORKSPACE_ROLE:
        assignments += [dict(id=f'legacy:{u["id"]}:{pid}', user_id=u['id'], role=role, scope='parish', scope_id=pid,
                             grants='[]', revokes='[]', status='active', created_at='', note='') for pid in pids]
    elif role == 'member':
        links += [dict(user_id=u['id'], parish_id=pid, kind='member', status='active', person_id=u['person_id'],
                       is_primary=int(i == 0), created_at='') for i, pid in enumerate(pids)]
    return assignments, links


def materialize_legacy(c, u, note='Copied from the account’s earlier role'):
    """Before anything new is recorded for an account still on its earlier access, copy that access."""
    if c.execute('SELECT 1 FROM role_assignments WHERE user_id=? UNION SELECT 1 FROM parish_links WHERE user_id=?',
                 (u['id'], u['id'])).fetchone():
        return
    assignments, links = legacy_access(c, u)
    at = NOW()
    for a in assignments:
        c.execute('INSERT OR IGNORE INTO role_assignments(id,user_id,role,scope,scope_id,note,source,created_at) VALUES(?,?,?,?,?,?,?,?)',
                  ('ra-' + hashlib.sha256(f'{u["id"]}|{a["role"]}|{a["scope_id"]}'.encode()).hexdigest()[:20], u['id'], a['role'],
                   a['scope'], a['scope_id'], note, 'migrated', at))
    for link in links:
        c.execute('INSERT OR IGNORE INTO parish_links(user_id,parish_id,kind,status,person_id,is_primary,note,created_at) VALUES(?,?,?,?,?,?,?,?)',
                  (u['id'], link['parish_id'], 'member', 'active', link['person_id'], link['is_primary'], note, at))
    if u['role'] in {'bishop', 'priest'} and not c.execute('SELECT 1 FROM clergy WHERE user_id=?', (u['id'],)).fetchone():
        cid = 'cl-' + hashlib.sha256(u['id'].encode()).hexdigest()[:16]
        c.execute('INSERT OR IGNORE INTO clergy VALUES(?,?,?,?,?,?,?)', (cid, u['id'], u['name'], '', u['diocese'], at, None))
        c.execute('INSERT OR IGNORE INTO clergy_titles VALUES(?,?,?,?,?,?,?,?)',
                  (cid + '-t0', cid, 'Bishop' if u['role'] == 'bishop' else 'Priest', '', 'recorded',
                   'Recorded when titles were introduced; the earlier history was not kept.', None, at))
        for a in assignments:
            if a['scope'] == 'parish':
                c.execute('INSERT OR IGNORE INTO clergy_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                          (cid + '-a-' + a['scope_id'], cid, a['scope_id'], 'parish-priest', '', None, None,
                           'Recorded when assignments were introduced; the start date was not kept.', None, at, None, None))


def authority(c, u):
    """Everything that decides what this account may reach: role assignments, parish links and access blocks."""
    assignments = [dict(r) for r in c.execute('SELECT * FROM role_assignments WHERE user_id=? ORDER BY created_at,id', (u['id'],))]
    links = [dict(r) for r in c.execute('SELECT * FROM parish_links WHERE user_id=? ORDER BY created_at,parish_id', (u['id'],))]
    if not assignments and not links:
        assignments, links = legacy_access(c, u)
    blocks = [dict(r) for r in c.execute('SELECT * FROM access_blocks WHERE user_id=? AND lifted_at IS NULL ORDER BY created_at,id', (u['id'],))]
    return dict(assignments=[a for a in assignments if a['status'] == 'active'], links=links, blocks=blocks)


def assignment_perms(a):
    """A role's template, with this assignment's own additions and removals. Fixed permissions stay with their role."""
    template = set(ROLE_TEMPLATES.get(a['role'], ()))
    grants = {p for p in json.loads(a.get('grants') or '[]') if p in PERMISSION_CODES and p not in FIXED_PERMISSIONS}
    revokes = set(json.loads(a.get('revokes') or '[]'))
    return (template | grants) - revokes


def is_blocked(auth, diocese, pid=None):
    return any(b['scope'] == 'global' or (b['scope'] == 'diocese' and b['scope_id'] == diocese) or
               (pid is not None and b['scope'] == 'parish' and b['scope_id'] == pid) for b in auth['blocks'])


def system_perms(auth):
    perms = set()
    for a in auth['assignments']:
        if a['scope'] == 'system': perms |= assignment_perms(a)
    return perms


def diocese_perms(auth, did):
    """Diocesan authority: the super admin's, apart from what belongs to the bishop alone, and this diocese's roles."""
    perms = {p for p in system_perms(auth) if p not in FIXED_PERMISSIONS or FIXED_PERMISSIONS[p] == 'superadmin'}
    for a in auth['assignments']:
        if a['scope'] == 'diocese' and a['scope_id'] == did: perms |= assignment_perms(a)
    return perms


def admin_perms(auth, pid, did):
    """Administrative authority over one parish: from the system, its diocese, or the parish itself."""
    perms = diocese_perms(auth, did)
    for a in auth['assignments']:
        if a['scope'] == 'parish' and a['scope_id'] == pid: perms |= assignment_perms(a)
    return perms


def top_rank(auth, pid=None, did=None):
    """The strongest role this account holds over a place (lower is stronger)."""
    ranks = [RANK[a['role']] for a in auth['assignments'] if a['role'] in RANK and (
        a['scope'] == 'system' or (a['scope'] == 'diocese' and a['scope_id'] == did) or
        (pid is not None and a['scope'] == 'parish' and a['scope_id'] == pid))]
    return min(ranks) if ranks else 99


def parish_context(c, u, pid, auth=None, parish=None):
    """This account's role in one parish, or None. Staff roles first, then the bishop's oversight,
    then a parish connection (member or follower)."""
    parish = parish or c.execute('SELECT * FROM parishes WHERE id=?', (pid,)).fetchone()
    if parish is None: return None
    auth = auth or authority(c, u)
    if is_blocked(auth, parish['diocese'], pid): return None
    staff = [a for a in auth['assignments'] if a['scope'] == 'parish' and a['scope_id'] == pid]
    link = next((l for l in auth['links'] if l['parish_id'] == pid and l['status'] == 'active'), None)
    person_id = (link or {}).get('person_id') or u['person_id']
    if staff:
        roles = {a['role'] for a in staff}
        role = next(r for r in STAFF_ROLES if r in roles)
        perms = set()
        for a in staff: perms |= assignment_perms(a)
        return dict(role=role, workspace=WORKSPACE_ROLE[role], perms=perms, person_id=person_id, diocese=parish['diocese'])
    if any(a['scope'] == 'diocese' and a['scope_id'] == parish['diocese'] and a['role'] == 'bishop' for a in auth['assignments']):
        return dict(role='bishop', workspace='bishop', perms=set(), person_id=u['person_id'], diocese=parish['diocese'])
    if link and link['kind'] == 'member':
        return dict(role='member', workspace='member', perms=set(), person_id=link.get('person_id'), diocese=parish['diocese'])
    if link and link['kind'] == 'follow':
        return dict(role='follower', workspace='follower', perms=set(), person_id=None, diocese=parish['diocese'])
    return None


def parish_user(c, u, pid):
    """The account as it acts in one parish: its role there, its permissions and its person record."""
    if isinstance(u, dict) and u.get('scope_pid') == pid: return u
    ctx = parish_context(c, u, pid)
    require(ctx is not None, 'This parish is not assigned to your account.', 403)
    e = dict(u)
    e.update(role=ctx['workspace'], roleCode=ctx['role'], perms=ctx['perms'], person_id=ctx['person_id'], scope_pid=pid)
    return e


def access(c, u, pid):
    parish_user(c, u, pid)


def perms_of(u):
    """Workspace permissions of an account acting in a parish (or its role template when acting outside one)."""
    if isinstance(u, dict) and 'perms' in u: return u['perms']
    return set(ROLE_TEMPLATES.get(u['role'], ()))



def file_access(c, u, pid, scope, owner_id, write=False):
    require(scope in {'group', 'person', 'guest-request', 'gallery', 'clergy'}, 'Invalid file owner.')
    if scope in {'gallery', 'clergy'}:   # pictures for the public page: whoever publishes the website
        require('website.publish' in perms_of(u), 'Publishing permission is needed for the public page’s pictures.', 403)
        require(owner_id == pid if scope == 'gallery' else c.execute(
            'SELECT 1 FROM clergy_assignments WHERE parish_id=? AND clergy_id=? AND end_date IS NULL', (pid, owner_id)).fetchone() is not None,
            'Not found.', 404)
        return
    if scope == 'guest-request':   # the signed document for a guest's request: the office only
        require('requests.manage' in perms_of(u), 'Guest request documents are restricted to the parish office.', 403)
        require(c.execute('SELECT 1 FROM guest_requests WHERE id=? AND parish_id=?', (owner_id, pid)).fetchone(), 'Request not found.', 404)
        return
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


def parishes(c, u, auth=None):
    """The parishes this account works in, oversees, belongs to or follows, with its role in each."""
    auth = auth or authority(c, u)
    result = []
    for r in c.execute('SELECT * FROM parishes ORDER BY rowid').fetchall():
        ctx = parish_context(c, u, r['id'], auth, r)
        if ctx is None: continue
        p = json.loads(r['metadata'])
        p['role'], p['roleAr'] = ROLE_TITLES[ctx['role']]
        link = next((l for l in auth['links'] if l['parish_id'] == r['id'] and l['status'] == 'active'), None)
        p.update(roleCode=ctx['role'], perms=sorted(ctx['perms']), diocese=r['diocese'], primary=bool(link and link['is_primary']),
                 kind=link['kind'] if link else None, modules=parish_plan(c, r['id'])['modules'])
        state = c.execute('SELECT data FROM states WHERE parish_id=?', (r['id'],)).fetchone() if ctx['workspace'] not in {'member', 'follower'} else None
        if state:
            data = json.loads(state['data']); p['people'] = len(data['PEOPLE']); p['households'] = len(data['HOUSEHOLDS'])
            p['sacramentsYear'] = sum(1 for s in data['SACRAMENTS'] if str(s.get('date', '')).startswith(str(dt.date.today().year)) and s.get('kind') != 'certificate' and s.get('status') in {'registered', 'issued'})
        result.append(p)
    return result


def session_authority(c, u, auth=None):
    """What the browser needs to build the account's workspaces: system and diocesan roles, and whether it administers anything."""
    auth = auth or authority(c, u)
    names = {r['id']: (r['name'], json.loads(r['metadata'] or '{}').get('ar', '')) for r in c.execute("SELECT * FROM dioceses WHERE id<>''")}
    dioceses = [dict(id=a['scope_id'], name=names.get(a['scope_id'], ('', ''))[0], nameAr=names.get(a['scope_id'], ('', ''))[1],
                     role=a['role'], perms=sorted(assignment_perms(a)))
                for a in auth['assignments'] if a['scope'] == 'diocese' and a['scope_id'] in names]
    system = sorted(system_perms(auth))
    admin = bool(system or dioceses or any(a['scope'] == 'parish' and assignment_perms(a) & {'staff.manage', 'access.manage'}
                                           for a in auth['assignments']))
    return dict(superadmin='dioceses.manage' in system, system=system, dioceses=dioceses, admin=admin,
                blocked=any(b['scope'] == 'global' for b in auth['blocks']))


def login_allowed(c, u):
    return u is not None and u['role'] != 'disabled' and not c.execute(
        "SELECT 1 FROM access_blocks WHERE user_id=? AND scope='global' AND lifted_at IS NULL", (u['id'],)).fetchone()


# ───────────── Administration: dioceses, parishes, staff, clergy, access ─────────────
def slug(text, prefix):
    base = re.sub(r'[^a-z0-9]+', '-', str(text).lower()).strip('-')[:40] or prefix
    return f'{prefix}-{base}' if not base.startswith(prefix + '-') else base


def user_brief(c, ids):
    ids = sorted({i for i in ids if i})
    rows = c.execute(f'SELECT id,username,name FROM users WHERE id IN ({",".join("?" * len(ids))})', ids).fetchall() if ids else []
    return {r['id']: dict(name=r['name'], username=r['username']) for r in rows}


def admin_scope(c, auth):
    """Every place this account administers, with its authority there."""
    dioceses = {r['id']: dict(r) for r in c.execute("SELECT * FROM dioceses WHERE id<>'' ORDER BY name")}
    parishes_rows = {r['id']: dict(r) for r in c.execute('SELECT * FROM parishes ORDER BY rowid')}
    system = system_perms(auth)
    scope = dict(system=system, dioceses={}, parishes={})
    for did in dioceses:
        perms = diocese_perms(auth, did)
        if perms: scope['dioceses'][did] = perms
    for pid, p in parishes_rows.items():
        perms = admin_perms(auth, pid, p['diocese'])
        if perms & {'staff.manage', 'access.manage', 'finance.view', 'settings.manage'}: scope['parishes'][pid] = perms
    return scope, dioceses, parishes_rows


def admin_view(c, u):
    auth = authority(c, u)
    scope, dioceses, parish_rows = admin_scope(c, auth)
    require(scope['system'] or scope['dioceses'] or scope['parishes'], 'Administration is not part of your account.', 403)
    parish_ids = set(scope['parishes'])
    out_dioceses = []
    for did, d in dioceses.items():
        if did not in scope['dioceses']: continue
        meta = json.loads(d.get('metadata') or '{}')
        bishops = [dict(r) for r in c.execute("SELECT * FROM role_assignments WHERE role='bishop' AND scope='diocese' AND scope_id=? AND status='active'", (did,))]
        out_dioceses.append(dict(id=did, name=d['name'], nameAr=meta.get('ar', ''), bishops=[b['user_id'] for b in bishops],
                                 perms=sorted(scope['dioceses'][did]),
                                 releasePolicy=setting(c, 'diocese', did, 'documentRelease', 'unset')))
    out_parishes = []
    for pid in parish_ids:
        p = parish_rows[pid]; meta = json.loads(p['metadata'])
        out_parishes.append(dict(id=pid, diocese=p['diocese'], name=meta.get('name', ''), nameAr=meta.get('ar', ''),
                                 town=meta.get('town', ''), townAr=meta.get('townAr', ''), perms=sorted(scope['parishes'][pid]),
                                 demo=bool(meta.get('demo'))))
    out_parishes.sort(key=lambda p: (p['diocese'], p['name']))
    # Appointments the account may see: in its parishes, its dioceses and (super admin) the system.
    rows = c.execute("SELECT * FROM role_assignments ORDER BY created_at DESC,id").fetchall()
    def assignment_visible(a):
        if a['scope'] == 'parish': return a['scope_id'] in parish_ids and 'staff.manage' in scope['parishes'][a['scope_id']]
        if a['scope'] == 'diocese': return a['scope_id'] in scope['dioceses']
        return 'dioceses.manage' in scope['system']
    assignments = [dict(id=a['id'], userId=a['user_id'], role=a['role'], scope=a['scope'], scopeId=a['scope_id'],
                        grants=json.loads(a['grants']), revokes=json.loads(a['revokes']), status=a['status'], note=a['note'],
                        source=a['source'], createdAt=a['created_at'], createdBy=a['created_by'], endedAt=a['ended_at'],
                        perms=sorted(assignment_perms(dict(a))))
                   for a in rows if assignment_visible(a)]
    clergy = []
    for row in c.execute('SELECT * FROM clergy ORDER BY name').fetchall():
        if row['diocese'] not in scope['dioceses'] and not any(
                ca['parish_id'] in parish_ids for ca in c.execute('SELECT parish_id FROM clergy_assignments WHERE clergy_id=?', (row['id'],))):
            continue
        titles = [dict(id=t['id'], title=t['title'], effectiveFrom=t['effective_from'], kind=t['kind'], note=t['note'],
                       setBy=t['set_by'], setAt=t['set_at'])
                  for t in c.execute('SELECT * FROM clergy_titles WHERE clergy_id=? ORDER BY set_at,id', (row['id'],))]
        services = [dict(id=s['id'], parishId=s['parish_id'], office=s['office'], startDate=s['start_date'], endDate=s['end_date'],
                         exception=json.loads(s['exception']) if s['exception'] else None, note=s['note'], createdAt=s['created_at'],
                         createdBy=s['created_by'], endedBy=s['ended_by'])
                    for s in c.execute('SELECT * FROM clergy_assignments WHERE clergy_id=? ORDER BY created_at,id', (row['id'],))]
        clergy.append(dict(id=row['id'], userId=row['user_id'], name=row['name'], nameAr=row['name_ar'], diocese=row['diocese'],
                           title=titles[-1]['title'] if titles else '', titles=titles, services=services))
    def block_visible(b):
        if b['scope'] == 'global': return 'accounts.global' in scope['system']
        if b['scope'] == 'diocese': return b['scope_id'] in scope['dioceses']
        return b['scope_id'] in parish_ids and 'access.manage' in scope['parishes'][b['scope_id']]
    blocks = [dict(id=b['id'], userId=b['user_id'], scope=b['scope'], scopeId=b['scope_id'], reason=b['reason'], createdAt=b['created_at'],
                   createdBy=b['created_by'], liftedAt=b['lifted_at'], liftedBy=b['lifted_by'], liftNote=b['lift_note'])
              for b in c.execute('SELECT * FROM access_blocks ORDER BY created_at DESC,id').fetchall() if block_visible(b)]
    people = user_brief(c, [a['userId'] for a in assignments] + [a['createdBy'] for a in assignments] +
                        [b['userId'] for b in blocks] + [b['createdBy'] for b in blocks] + [b['liftedBy'] for b in blocks] +
                        [x['userId'] for x in clergy] + [i for d in out_dioceses for i in d['bishops']] +
                        [t['setBy'] for x in clergy for t in x['titles']])
    return dict(system=sorted(scope['system']), dioceses=out_dioceses, parishes=out_parishes, assignments=assignments,
                clergy=clergy, blocks=blocks, users=people, finance=finance_overview(c, auth, list(parish_rows.values())),
                catalog=dict(permissions=[dict(code=p[0], level=p[1], en=p[2], ar=p[3], fixed=FIXED_PERMISSIONS.get(p[0], ''))
                                          for p in PERMISSIONS],
                             templates={k: sorted(v) for k, v in ROLE_TEMPLATES.items()},
                             titles=list(CLERGY_TITLES), offices={k: list(v) for k, v in CLERGY_OFFICES.items()},
                             roles={k: list(v) for k, v in ROLE_TITLES.items()}))


def setting(c, scope, scope_id, key, default):
    row = c.execute('SELECT value FROM settings WHERE scope=? AND scope_id=? AND key=?', (scope, scope_id, key)).fetchone()
    return row['value'] if row else default


def empty_parish_state(seed, pid, meta, diocese_name='', diocese_ar=''):
    """A new parish's records: empty lists and safe structural defaults for the existing views."""
    d = copy.deepcopy(seed)
    for k, v in list(d.items()):
        if isinstance(v, list): d[k] = []
        elif isinstance(v, dict): d[k] = {}
    for k in ('RATE', 'SERVICE', 'ROTA', 'CHECKIN', 'BATCH', 'REG_FORM', 'EVACUATION', 'PREP_REQUIREMENTS'):
        d[k] = copy.deepcopy(seed[k])
    d['SERVICE'].update(order=[], celebrant=None, coordinator=None, venue=None)
    d['ROTA']['teams'] = []
    d['CHECKIN'].update(rows=[], present=0, expected=0, awaitingGuardian=0, room=None)
    d['BATCH'].update(lines=[], counters=[])
    d['REG_FORM'].update(fields=[], discounts=[], installments=[])
    d['EVACUATION']['rooms'] = []
    d['PARISH'] = copy.deepcopy(seed['PARISH'])
    d['PARISH'].update(id=pid, name=meta['name'], nameAr=meta['ar'], town=meta['town'], townAr=meta['townAr'],
                       rite=meta.get('rite', ''), riteAr=meta.get('riteAr', ''), eparchy=diocese_name, eparchyAr=diocese_ar,
                       address='', addressAr='', phone='', people=0, households=0, groups=0, volunteers=0)
    d['PARISHES'] = []
    return d


def clean(value, limit, message, required=True):
    text = ' '.join(str(value or '').split())
    require((not required or text) and len(text) <= limit, message)
    return text


def assign_role(c, actor, auth, user_id, role, scope, scope_id, grants=(), revokes=(), note='', source=''):
    """Appoint someone, checking the appointer's authority: no one appoints at or above their own rank in a
    parish, and no one hands on a permission they do not hold themselves or one fixed to another role."""
    target = c.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
    require(target is not None and target['role'] != 'disabled', 'Choose an existing account.')
    grants = sorted({str(p) for p in grants}); revokes = sorted({str(p) for p in revokes})
    require(all(p in PERMISSION_CODES for p in grants + revokes), 'Unknown permission.')
    require(not any(p in FIXED_PERMISSIONS for p in grants), 'That permission belongs to one role and cannot be granted.')
    if scope == 'parish':
        parish = c.execute('SELECT * FROM parishes WHERE id=?', (scope_id,)).fetchone()
        require(parish is not None, 'Parish not found.', 404)
        require(role in {'parishadmin', 'secretary', 'treasurer', 'leader'},
                'Choose a parish role. A priest’s access follows their clergy assignment.')
        held = admin_perms(auth, scope_id, parish['diocese'])
        require('staff.manage' in held, 'You cannot appoint staff in this parish.', 403)
        require(RANK[role] > top_rank(auth, scope_id, parish['diocese']), 'You cannot appoint someone at or above your own role.', 403)
    elif scope == 'diocese':
        require(c.execute("SELECT 1 FROM dioceses WHERE id=? AND id<>''", (scope_id,)).fetchone(), 'Diocese not found.', 404)
        require(role == 'diocesanadmin', 'Choose a diocesan role. The first bishop is provisioned by the super admin.')
        held = diocese_perms(auth, scope_id)
        require('diocese.staff' in held and top_rank(auth, did=scope_id) <= RANK['bishop'],
                'Only the bishop or the super admin appoints diocesan admins.', 403)
    else:
        raise Problem(403, 'System roles are created by the setup process.')
    final = assignment_perms(dict(role=role, grants=json.dumps(grants), revokes=json.dumps(revokes)))
    beyond = final - {p for p in held if p not in FIXED_PERMISSIONS}
    require(not beyond, 'You cannot give permissions you do not hold yourself: ' + ', '.join(sorted(beyond)), 403)
    materialize_legacy(c, target)
    require(not c.execute("SELECT 1 FROM role_assignments WHERE user_id=? AND role=? AND scope=? AND scope_id=? AND status='active'",
                          (user_id, role, scope, scope_id)).fetchone(), 'This person already holds that role there.', 409)
    aid = 'ra-' + secrets.token_hex(10)
    c.execute('INSERT INTO role_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
              (aid, user_id, role, scope, scope_id, json.dumps(grants), json.dumps(revokes), 'active', note, source, NOW(), actor['id'], None, None))
    return aid


def can_manage_assignment(c, auth, a):
    if a['scope'] == 'parish':
        parish = c.execute('SELECT * FROM parishes WHERE id=?', (a['scope_id'],)).fetchone()
        held = admin_perms(auth, a['scope_id'], parish['diocese'])
        return 'staff.manage' in held and RANK.get(a['role'], 99) > top_rank(auth, a['scope_id'], parish['diocese']), held
    if a['scope'] == 'diocese':
        held = diocese_perms(auth, a['scope_id'])
        return 'diocese.staff' in held and RANK.get(a['role'], 99) > top_rank(auth, did=a['scope_id']) and a['role'] != 'bishop', held
    return False, set()


def block_authority(c, auth, scope, scope_id):
    """May this account deactivate or reactivate access at this scope?"""
    if scope == 'global': return 'accounts.global' in system_perms(auth)
    if scope == 'diocese': return 'access.manage' in diocese_perms(auth, scope_id) and top_rank(auth, did=scope_id) <= RANK['diocesanadmin']
    parish = c.execute('SELECT * FROM parishes WHERE id=?', (scope_id,)).fetchone()
    return parish is not None and 'access.manage' in admin_perms(auth, scope_id, parish['diocese'])


def admin_action(c, u, q):
    auth = authority(c, u)
    op, at = q.get('op'), NOW()
    if op == 'findUser':
        scope, _, _ = admin_scope(c, auth)
        require(scope['system'] or scope['dioceses'] or scope['parishes'], 'Administration is not part of your account.', 403)
        needle = str(q.get('query') or '').strip()
        require(3 <= len(needle) <= 120, 'Enter the person’s exact username, email address or phone number.')
        key = login_name(needle)
        row = (c.execute('SELECT id,username,name FROM users WHERE username=? AND role<>?', (key, 'disabled')).fetchone()
               or c.execute('SELECT u.id,u.username,u.name FROM user_contacts k JOIN users u ON u.id=k.user_id WHERE k.value=? AND u.role<>?',
                            (key, 'disabled')).fetchone())
        return dict(user=dict(id=row['id'], username=row['username'], name=row['name']) if row else None)
    if op == 'setPolicy':
        did = q.get('diocese')
        require(c.execute("SELECT 1 FROM dioceses WHERE id=? AND id<>''", (did,)).fetchone(), 'Diocese not found.', 404)
        require('diocese.policies' in diocese_perms(auth, did), 'Diocesan policies are set by the bishop.', 403)
        require(q.get('key') == 'documentRelease' and q.get('value') in RELEASE_POLICIES, 'Choose a policy.')
        c.execute('INSERT INTO settings VALUES(?,?,?,?,?,?) ON CONFLICT(scope,scope_id,key) DO UPDATE SET value=excluded.value,'
                  'updated_at=excluded.updated_at,updated_by=excluded.updated_by', ('diocese', did, 'documentRelease', q['value'], at, u['id']))
        audit(c, u, None, 'diocese.policy', {'diocese': did, 'documentRelease': q['value']})
        return {}
    if op == 'createDiocese':
        require('dioceses.manage' in system_perms(auth), 'Only the super admin creates dioceses.', 403)
        name = clean(q.get('name'), 120, 'Enter the diocese’s name.')
        name_ar = clean(q.get('nameAr'), 120, 'Enter the Arabic name.', required=False)
        did = slug(name, 'dio')
        require(not c.execute('SELECT 1 FROM dioceses WHERE id=?', (did,)).fetchone(), 'A diocese with this name already exists.', 409)
        c.execute('INSERT INTO dioceses(id,name,metadata) VALUES(?,?,?)', (did, name, json.dumps(dict(ar=name_ar, createdAt=at, createdBy=u['id']))))
        audit(c, u, None, 'diocese.created', {'diocese': did})
        return dict(id=did)
    if op == 'provisionBishop':
        require('dioceses.manage' in system_perms(auth), 'Only the super admin provisions a bishop account.', 403)
        did = q.get('diocese')
        require(c.execute("SELECT 1 FROM dioceses WHERE id=? AND id<>''", (did,)).fetchone(), 'Diocese not found.', 404)
        require(not c.execute("SELECT 1 FROM role_assignments WHERE role='bishop' AND scope='diocese' AND scope_id=? AND status='active'", (did,)).fetchone(),
                'This diocese already has a bishop. Provisioning is for the first bishop account only.', 409)
        name = clean(q.get('name'), 120, 'Enter the bishop’s name.')
        name_ar = clean(q.get('nameAr'), 120, 'Enter the Arabic name.', required=False)
        username = str(q.get('username') or '').strip()
        require(re.fullmatch(r'[a-z0-9][a-z0-9._-]{2,40}', username) is not None, 'Choose a username of 3–40 lowercase letters, digits, dots or dashes.')
        require(not c.execute('SELECT 1 FROM users WHERE username=?', (username,)).fetchone(), 'This username is taken.', 409)
        password = secrets.token_urlsafe(12)
        user_id = 'u-' + secrets.token_hex(8)
        c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)', (user_id, username, name, 'user', did, None, password_hash(password)))
        cid = 'cl-' + secrets.token_hex(8)
        c.execute('INSERT INTO clergy VALUES(?,?,?,?,?,?,?)', (cid, user_id, name, name_ar, did, at, u['id']))
        c.execute('INSERT INTO clergy_titles VALUES(?,?,?,?,?,?,?,?)',
                  (cid + '-t0', cid, 'Bishop', at[:10], 'initial', 'Set when the account was provisioned.', u['id'], at))
        c.execute('INSERT INTO role_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                  ('ra-' + secrets.token_hex(10), user_id, 'bishop', 'diocese', did, '[]', '[]', 'active', '', 'provision', at, u['id'], None, None))
        audit(c, u, None, 'bishop.provisioned', {'diocese': did, 'user': user_id})
        return dict(userId=user_id, username=username, temporaryPassword=password)
    if op == 'createParish':
        did = q.get('diocese')
        require(isinstance(did, str) and c.execute("SELECT 1 FROM dioceses WHERE id=? AND id<>''", (did,)).fetchone(), 'Choose a diocese.', 404)
        require('parishes.create' in diocese_perms(auth, did), 'You cannot create parishes in this diocese.', 403)
        meta = dict(name=clean(q.get('name'), 120, 'Enter the parish’s name.'),
                    ar=clean(q.get('nameAr'), 120, 'Enter the Arabic name.', required=False),
                    town=clean(q.get('town'), 80, 'Enter the town.'),
                    townAr=clean(q.get('townAr'), 80, 'Enter the town in Arabic.', required=False),
                    rite=clean(q.get('rite'), 60, 'Enter the rite.', required=False),
                    riteAr=clean(q.get('riteAr'), 60, 'Enter the rite in Arabic.', required=False))
        pid = slug(meta['name'] + ' ' + meta['town'], 'p')
        require(not c.execute('SELECT 1 FROM parishes WHERE id=?', (pid,)).fetchone(), 'A parish with this name already exists in this town.', 409)
        meta['id'] = pid
        c.execute('INSERT INTO parishes VALUES(?,?,?)', (pid, did, json.dumps(meta, ensure_ascii=False)))
        for category in CONCERN_CATEGORIES:
            c.execute('INSERT OR IGNORE INTO complaint_categories VALUES(?,?,1)', (pid, category))
        seed = json.loads((ROOT / 'backend' / 'seed.json').read_text(encoding='utf-8'))
        drow = c.execute('SELECT * FROM dioceses WHERE id=?', (did,)).fetchone()
        d = migrate_state(empty_parish_state(seed, pid, meta, drow['name'], json.loads(drow['metadata'] or '{}').get('ar', '')))
        validate(d)
        c.execute('INSERT INTO states VALUES(?,1,?)', (pid, json.dumps(d)))
        sync_relationships(c, pid, d)
        audit(c, u, pid, 'parish.created', {'diocese': did})
        return dict(id=pid)
    if op == 'setDemo':   # whether a parish's information is demonstration data, shown as such on its public page
        require('dioceses.manage' in system_perms(auth), 'Only a super admin marks demonstration data.', 403)
        row = c.execute('SELECT * FROM parishes WHERE id=?', (q.get('parish'),)).fetchone()
        require(row is not None and type(q.get('demo')) is bool, 'Choose a parish.', 404)
        meta = json.loads(row['metadata']); meta['demo'] = q['demo']
        c.execute('UPDATE parishes SET metadata=? WHERE id=?', (json.dumps(meta, ensure_ascii=False), row['id']))
        audit(c, u, row['id'], 'parish.demo-' + ('on' if q['demo'] else 'off'), {})
        return {}
    if op == 'assign':
        aid = assign_role(c, u, auth, q.get('userId'), q.get('role'), q.get('scope'), q.get('scopeId'),
                          q.get('grants') or [], q.get('revokes') or [], clean(q.get('note'), 300, '', required=False))
        audit(c, u, q.get('scopeId') if q.get('scope') == 'parish' else None, 'role.assigned',
              {'assignment': aid, 'user': q.get('userId'), 'role': q.get('role'), 'scope': q.get('scope'), 'scopeId': q.get('scopeId')})
        return dict(id=aid)
    if op in {'adjust', 'endAssignment'}:
        a = c.execute("SELECT * FROM role_assignments WHERE id=? AND status='active'", (q.get('id'),)).fetchone()
        require(a is not None, 'Appointment not found.', 404)
        allowed, held = can_manage_assignment(c, auth, a)
        require(allowed, 'This appointment is outside your authority.', 403)
        require(a['user_id'] != u['id'], 'You cannot change your own appointment.', 403)
        if op == 'endAssignment':
            require(a['role'] != 'priest', 'End the clergy assignment instead; the priest’s access follows it.')
            c.execute("UPDATE role_assignments SET status='ended',ended_at=?,ended_by=? WHERE id=?", (at, u['id'], a['id']))
            audit(c, u, a['scope_id'] if a['scope'] == 'parish' else None, 'role.ended', {'assignment': a['id']})
            return dict(ok=True)
        grants = sorted({str(p) for p in q.get('grants') or []}); revokes = sorted({str(p) for p in q.get('revokes') or []})
        require(all(p in PERMISSION_CODES for p in grants + revokes), 'Unknown permission.')
        require(not any(p in FIXED_PERMISSIONS for p in grants + revokes), 'Fixed permissions stay with their role and cannot be changed.')
        final = assignment_perms(dict(role=a['role'], grants=json.dumps(grants), revokes=json.dumps(revokes)))
        changed = final ^ assignment_perms(dict(a))
        beyond = changed - {p for p in held if p not in FIXED_PERMISSIONS}
        require(not beyond, 'You cannot change permissions you do not hold yourself: ' + ', '.join(sorted(beyond)), 403)
        c.execute('UPDATE role_assignments SET grants=?,revokes=? WHERE id=?', (json.dumps(grants), json.dumps(revokes), a['id']))
        audit(c, u, a['scope_id'] if a['scope'] == 'parish' else None, 'role.permissions', {'assignment': a['id'], 'grants': grants, 'revokes': revokes})
        return dict(ok=True)
    if op == 'addClergy':
        did = q.get('diocese')
        require(isinstance(did, str) and 'clergy.assign' in diocese_perms(auth, did), 'You cannot register clergy in this diocese.', 403)
        title = q.get('title')
        require(title in CLERGY_TITLES, 'Choose a title.')
        user_id = q.get('userId') or None
        if user_id:
            require(c.execute('SELECT 1 FROM users WHERE id=?', (user_id,)).fetchone(), 'Account not found.', 404)
            require(not c.execute('SELECT 1 FROM clergy WHERE user_id=?', (user_id,)).fetchone(), 'This account is already linked to a clergy record.', 409)
        cid = 'cl-' + secrets.token_hex(8)
        c.execute('INSERT INTO clergy VALUES(?,?,?,?,?,?,?)', (cid, user_id, clean(q.get('name'), 120, 'Enter the name.'),
                                                             clean(q.get('nameAr'), 120, '', required=False), did, at, u['id']))
        c.execute('INSERT INTO clergy_titles VALUES(?,?,?,?,?,?,?,?)',
                  (cid + '-t0', cid, title, str(q.get('effectiveFrom') or at[:10])[:10], 'initial', 'Recorded when the clergy record was created.', u['id'], at))
        audit(c, u, None, 'clergy.added', {'clergy': cid, 'diocese': did})
        return dict(id=cid)
    if op == 'setClergyTitle':
        row = c.execute('SELECT * FROM clergy WHERE id=?', (q.get('clergyId'),)).fetchone()
        require(row is not None, 'Clergy record not found.', 404)
        require(any(a['role'] == 'bishop' and a['scope'] == 'diocese' and a['scope_id'] == row['diocese'] for a in auth['assignments']),
                'Only the bishop of this diocese changes a clergy title.', 403)
        title = q.get('title')
        require(title in CLERGY_TITLES, 'Choose a title.')
        effective = str(q.get('effectiveFrom') or '')[:10]
        require(iso_date(effective), 'Enter the date the title takes effect.')
        c.execute('INSERT INTO clergy_titles VALUES(?,?,?,?,?,?,?,?)', ('ct-' + secrets.token_hex(8), row['id'], title, effective, 'change',
                                                                      clean(q.get('note'), 300, '', required=False), u['id'], at))
        audit(c, u, None, 'clergy.title', {'clergy': row['id'], 'title': title})
        return dict(ok=True)
    if op == 'linkClergyAccount':
        row = c.execute('SELECT * FROM clergy WHERE id=?', (q.get('clergyId'),)).fetchone()
        require(row is not None and 'clergy.assign' in diocese_perms(auth, row['diocese']), 'Clergy record outside your authority.', 403)
        require(not row['user_id'], 'This clergy record already has an account.', 409)
        user = c.execute('SELECT * FROM users WHERE id=?', (q.get('userId'),)).fetchone()
        require(user is not None and not c.execute('SELECT 1 FROM clergy WHERE user_id=?', (user['id'],)).fetchone(), 'Choose an account not linked to clergy.')
        c.execute('UPDATE clergy SET user_id=? WHERE id=?', (user['id'], row['id']))
        audit(c, u, None, 'clergy.account', {'clergy': row['id'], 'user': user['id']})
        return dict(ok=True)
    if op == 'assignClergy':
        row = c.execute('SELECT * FROM clergy WHERE id=?', (q.get('clergyId'),)).fetchone()
        parish = c.execute('SELECT * FROM parishes WHERE id=?', (q.get('parishId'),)).fetchone()
        require(row is not None and parish is not None, 'Choose a clergy member and a parish.', 404)
        require('clergy.assign' in diocese_perms(auth, parish['diocese']), 'You cannot assign clergy to this parish.', 403)
        office = q.get('office')
        require(office in CLERGY_OFFICES, 'Choose the office.')
        start = str(q.get('startDate') or '')[:10]
        require(iso_date(start), 'Enter the start date.')
        exception = None
        if row['diocese'] != parish['diocese']:
            reason = clean(q.get('exceptionReason'), 500, 'A clergy member from another diocese needs a recorded exception: give the reason.')
            require(any(a['role'] == 'bishop' and a['scope'] == 'diocese' and a['scope_id'] == parish['diocese'] for a in auth['assignments'])
                    or 'dioceses.manage' in system_perms(auth),
                    'Only the receiving diocese’s bishop or the super admin authorises service across dioceses.', 403)
            exception = json.dumps(dict(reason=reason, homeDiocese=row['diocese'], authorizedBy=u['id'], authorizedAt=at))
        titles = c.execute('SELECT title FROM clergy_titles WHERE clergy_id=? ORDER BY set_at DESC,id DESC LIMIT 1', (row['id'],)).fetchone()
        if office in PRIESTLY_OFFICES:
            require(titles and titles['title'] not in {'Deacon'}, 'A priestly office needs a clergy member ordained a priest.')
        sid = 'ca-' + secrets.token_hex(8)
        c.execute('INSERT INTO clergy_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                  (sid, row['id'], parish['id'], office, start, None, exception, clean(q.get('note'), 300, '', required=False), u['id'], at, None, None))
        if row['user_id'] and office in PRIESTLY_OFFICES:
            target = c.execute('SELECT * FROM users WHERE id=?', (row['user_id'],)).fetchone()
            materialize_legacy(c, target)
            if not c.execute("SELECT 1 FROM role_assignments WHERE user_id=? AND role='priest' AND scope='parish' AND scope_id=? AND status='active'",
                             (row['user_id'], parish['id'])).fetchone():
                c.execute('INSERT INTO role_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                          ('ra-' + secrets.token_hex(10), row['user_id'], 'priest', 'parish', parish['id'], '[]', '[]', 'active',
                           'Follows clergy assignment ' + sid, 'clergy', at, u['id'], None, None))
        audit(c, u, parish['id'], 'clergy.assigned', {'clergy': row['id'], 'assignment': sid, 'office': office})
        return dict(id=sid)
    if op == 'endClergyAssignment':
        s = c.execute('SELECT * FROM clergy_assignments WHERE id=? AND end_date IS NULL', (q.get('id'),)).fetchone()
        require(s is not None, 'Assignment not found.', 404)
        parish = c.execute('SELECT * FROM parishes WHERE id=?', (s['parish_id'],)).fetchone()
        require('clergy.assign' in diocese_perms(auth, parish['diocese']), 'This assignment is outside your authority.', 403)
        end = str(q.get('endDate') or '')[:10]
        require(iso_date(end) and end >= (s['start_date'] or '0000'), 'Enter an end date after the start.')
        c.execute('UPDATE clergy_assignments SET end_date=?,ended_by=?,ended_at=? WHERE id=?', (end, u['id'], at, s['id']))
        row = c.execute('SELECT * FROM clergy WHERE id=?', (s['clergy_id'],)).fetchone()
        if row['user_id'] and s['office'] in PRIESTLY_OFFICES and not c.execute(
                "SELECT 1 FROM clergy_assignments WHERE clergy_id=? AND parish_id=? AND end_date IS NULL AND id<>? AND office IN ('parish-priest','assistant-priest')",
                (row['id'], s['parish_id'], s['id'])).fetchone():
            c.execute("UPDATE role_assignments SET status='ended',ended_at=?,ended_by=? WHERE user_id=? AND role='priest' AND scope='parish' AND scope_id=? AND status='active'",
                      (at, u['id'], row['user_id'], s['parish_id']))
        audit(c, u, s['parish_id'], 'clergy.assignment-ended', {'assignment': s['id']})
        return dict(ok=True)
    if op == 'block':
        scope, scope_id = q.get('scope'), q.get('scopeId') or ''
        require(scope in {'parish', 'diocese', 'global'}, 'Choose where to deactivate access.')
        require(block_authority(c, auth, scope, scope_id), 'Deactivating access there is outside your authority.', 403)
        target = c.execute('SELECT * FROM users WHERE id=?', (q.get('userId'),)).fetchone()
        require(target is not None, 'Account not found.', 404)
        require(target['id'] != u['id'], 'You cannot deactivate your own access.', 403)
        target_auth = authority(c, target)
        if scope == 'global':
            require('dioceses.manage' not in system_perms(target_auth), 'Another super admin’s account cannot be deactivated here.', 403)
        else:
            did = scope_id if scope == 'diocese' else c.execute('SELECT diocese FROM parishes WHERE id=?', (scope_id,)).fetchone()['diocese']
            mine = top_rank(auth, scope_id if scope == 'parish' else None, did)
            require(top_rank(target_auth, scope_id if scope == 'parish' else None, did) > mine,
                    'You cannot deactivate someone at or above your own role.', 403)
        reason = clean(q.get('reason'), 500, 'Give the reason for deactivating access.')
        bid = 'blk-' + secrets.token_hex(8)
        c.execute('INSERT INTO access_blocks VALUES(?,?,?,?,?,?,?,?,?,?)', (bid, target['id'], scope, scope_id, reason, at, u['id'], None, None, ''))
        if scope == 'global': c.execute('DELETE FROM sessions WHERE user_id=?', (target['id'],))
        audit(c, u, scope_id if scope == 'parish' else None, 'access.deactivated', {'user': target['id'], 'scope': scope, 'scopeId': scope_id})
        return dict(id=bid)
    if op == 'unblock':
        b = c.execute('SELECT * FROM access_blocks WHERE id=? AND lifted_at IS NULL', (q.get('id'),)).fetchone()
        require(b is not None, 'Deactivation not found.', 404)
        require(block_authority(c, auth, b['scope'], b['scope_id']), 'This deactivation was made above your authority; only that level can lift it.', 403)
        c.execute('UPDATE access_blocks SET lifted_at=?,lifted_by=?,lift_note=? WHERE id=?',
                  (at, u['id'], clean(q.get('note'), 300, '', required=False), b['id']))
        audit(c, u, b['scope_id'] if b['scope'] == 'parish' else None, 'access.reactivated', {'block': b['id']})
        return dict(ok=True)
    raise Problem(400, 'Unknown administration action.')


def provision_demo_super_admin(c):
    """Local demonstration only (python3 server.py --demo-super-admin): a publicly known password."""
    row = c.execute("SELECT * FROM users WHERE username='super-admin'").fetchone()
    user_id = row['id'] if row else 'u-superadmin-demo'
    if row is None:
        c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)', (user_id, 'super-admin', 'Super admin (demo)', 'user', '', None, password_hash('123456789')))
    if not c.execute("SELECT 1 FROM role_assignments WHERE user_id=? AND role='superadmin' AND status='active'", (user_id,)).fetchone():
        c.execute('INSERT INTO role_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                  ('ra-superadmin-demo', user_id, 'superadmin', 'system', '', '[]', '[]', 'active', 'Local demonstration setup', 'setup', NOW(), None, None, None))


def oversight(c, u, pid=None):
    """A separate projection: no private notes, contact data, or parish editing model."""
    auth = authority(c, u)
    require(any(a['role'] == 'bishop' and a['scope'] == 'diocese' for a in auth['assignments']), 'Bishop oversight access required.', 403)
    result = []
    for parish in parishes(c, u, auth):
        if parish['roleCode'] != 'bishop' and not any(a['role'] == 'bishop' and a['scope'] == 'diocese' and a['scope_id'] == parish['diocese']
                                                      for a in auth['assignments']):
            continue
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
            actors = {r['id']: r['name'] for r in c.execute('SELECT id,name FROM users WHERE id IN (SELECT actor FROM audit WHERE parish_id=?)', (pid,))}
            item['activity'] = [dict(at=r['at'], action=r['action'], actor=actors.get(r['actor'], 'System'))
                                for r in c.execute('SELECT at,action,actor FROM audit WHERE parish_id=? ORDER BY id DESC LIMIT 50', (pid,))]
        result.append(item)
    require(not pid or result, 'Parish not found in your archdiocese.', 404)
    return result[0] if pid else result


def visible(c, u, pid, d):
    u = parish_user(c, u, pid)
    require(u['role'] not in {'bishop', 'member', 'follower'}, 'Use your dedicated portal.', 403)
    perms = perms_of(u)
    d = copy.deepcopy(d)
    all_people = d['PEOPLE']
    d['PARISH'].update(people=len(d['PEOPLE']), households=len(d['HOUSEHOLDS']), groups=len(d['GROUPS']))
    d['PARISHES'] = parishes(c, u)
    d['MEMBER_REQUESTS'] = office_member_requests(c, pid, d) if 'requests.manage' in perms else []
    d['ACCOUNTS'] = {}
    if 'people.manage' in perms:
        # a person's account and its strongest role here (a staff role is listed after membership, so it wins)
        d['ACCOUNTS'] = {r['person_id']: dict(username=r['username'], role=r['role']) for r in c.execute(
            "SELECT u.username,a.role,a.person_id FROM parish_accounts a JOIN users u ON u.id=a.user_id "
            "WHERE a.parish_id=? AND a.person_id IS NOT NULL ORDER BY u.username,CASE a.role WHEN 'member' THEN 0 ELSE 1 END", (pid,))}
    d['MEMBERSHIP_REQUESTS'], d['INVITATIONS'] = office_connections(c, pid) if 'people.manage' in perms else ([], [])
    d['MINISTRY_APPLICATIONS'], d['MINISTRY_INQUIRIES'], d['MINISTRY_DEPARTURES'] = ministry_lists(c, u, pid, d)
    d['GUEST_REQUESTS'] = office_guest_requests(c, pid, d) if 'requests.manage' in perms else []
    d['POLICIES'] = dict(documentRelease=release_policy(c, pid))
    d['NOTES'] = [n for n in d['NOTES'] if note_visible(u, n)]   # personal notes: their author; shared: the parish's priests
    if 'settings.manage' not in perms:
        for k in ('SESSIONS', 'SECURITY_ALERTS', 'WEBHOOKS', 'EXCEPTIONS'):
            d[k] = []
        d['PARISH'].pop('apiKey', None)
    if 'audit.view' not in perms:
        d['AUDIT'] = []
    else:
        actors = {row['id']: row for row in c.execute('SELECT id,name,person_id FROM users WHERE id IN (SELECT actor FROM audit WHERE parish_id=?)', (pid,))}
        d['AUDIT'] = [dict(at=r['at'], who=actors[r['actor']]['person_id'] if r['actor'] in actors else None,
                           actorName=actors[r['actor']]['name'] if r['actor'] in actors else 'System',
                           what=r['action'], whatAr=r['action'], kind='approve' if 'approve' in r['action'] else 'create')
                      for r in c.execute('SELECT * FROM audit WHERE parish_id=? ORDER BY id DESC LIMIT 500', (pid,))]
    if 'finance.view' not in perms:
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


def iso_date(value):
    if not isinstance(value, str): return False
    try: return dt.date.fromisoformat(value).isoformat() == value
    except ValueError: return False


THEME_SCHEMES = {'forest', 'navy', 'marian', 'burgundy', 'purple', 'teal', 'cedar', 'slate', 'custom'}
HEX_COLOUR = re.compile(r'#[0-9A-Fa-f]{6}')


def parish_theme(parish):
    theme = parish.get('theme')
    return dict(scheme=theme['scheme'], primary=theme['primary']) if isinstance(theme, dict) else None


def validate(d):
    theme = d['PARISH'].get('theme')
    require(theme is None or (isinstance(theme, dict) and set(theme) == {'scheme', 'primary'}
            and isinstance(theme['scheme'], str) and theme['scheme'] in THEME_SCHEMES and isinstance(theme['primary'], str)
            and HEX_COLOUR.fullmatch(theme['primary']) is not None), 'Invalid colour scheme.')
    def index(key):
        rows = d[key]
        require(isinstance(rows, list) and all(isinstance(x, dict) and isinstance(x.get('id'), str) for x in rows), 'Invalid ' + key)
        result = {x['id']: x for x in rows}
        require(len(result) == len(rows), 'Duplicate IDs in ' + key)
        return result
    loc = d['PARISH'].get('location')
    require(loc is None or (isinstance(loc, dict) and set(loc) == {'lat', 'lng'} and all(type(loc[k]) in (int, float) for k in loc)
            and -90 <= loc['lat'] <= 90 and -180 <= loc['lng'] <= 180), 'Check the parish coordinates.')
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
        require(n.get('visibility', 'personal') in NOTE_VISIBILITY, 'Choose who can see this pastoral item.')
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


def writable(u, key):
    """May this account change one part of the parish workspace? Each part needs one permission;
    a ministry leader changes only their own ministry's parts, checked again in save_patch."""
    role = u['role']
    if role in {'bishop', 'member', 'follower'}: return False
    if key in READONLY: return False
    if key in {'NOTIFICATIONS', 'PREFS'}: return True
    if role == 'leader' and key in {'GROUP_DETAIL', 'MUSIC', 'MUSIC_DETAIL', 'SETLISTS', 'CHECKIN', 'PICKUP'}: return True
    return KEY_PERMS.get(key, 'settings.manage') in perms_of(u)


def save_patch(c, u, pid, payload):
    u = parish_user(c, u, pid)
    require(u['role'] not in {'bishop', 'member', 'follower'}, 'Parish staff access required.', 403)
    row = c.execute('SELECT * FROM states WHERE parish_id=?', (pid,)).fetchone()
    require(payload.get('revision') == row['revision'], 'Another user changed this parish. Reload before saving.', 409)
    old = json.loads(row['data']); d = copy.deepcopy(old)
    changes = payload.get('changes')
    require(isinstance(changes, dict), 'Expected changes.')
    for key, value in changes.items():
        require(key in d and writable(u, key), 'Your role cannot change ' + key, 403)
        require(type(value) is type(d[key]), 'Invalid collection type: ' + key)
        if key == 'GROUP_DETAIL' and u['role'] == 'leader':
            permitted = {g['id'] for g in old['GROUPS'] if g.get('leader') == u['person_id'] or g.get('assistant') == u['person_id']}
            require(set(value) <= permitted, 'Group is outside your ministry.', 403)
            for gid, detail in value.items():   # new members join with the parish priest's approval
                before = {r.get('p') for r in old['GROUP_DETAIL'].get(gid, {}).get('roster', [])}
                require({r.get('p') for r in detail.get('roster', [])} <= before,
                        'New members join with the parish priest’s approval. Send the request on to the priest instead.', 403)
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
        elif key == 'NOTES':
            d[key] = merge_notes(u, old['NOTES'], value)
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
                    and history[-1].get('by') == u['person_id'], 'Service transition requires an audit entry.')
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
    if 'RESERVATIONS' in changes:
        booking_decisions(c, u, pid, old, d)
    d = migrate_state(d)
    validate(d)
    sync_relationships(c, pid, d)
    sync_ministry_leaders(c, u, pid, d, {p for _, _, outgoing, incoming in role_changes for p in (outgoing, incoming) if p})
    for field, group_id, outgoing, incoming in role_changes:
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
    u = parish_user(c, u, pid)
    require(u['role'] in CLERGY | {'secretary'} and perms_of(u) & {'sacraments.manage', 'requests.manage', 'facilities.manage'},
            'Office access required.', 403)
    row = c.execute('SELECT * FROM states WHERE parish_id=?', (pid,)).fetchone()
    require(q.get('revision') == row['revision'], 'Record changed. Reload before continuing.', 409)
    d = json.loads(row['data']); action = q.get('action'); sid = q.get('id')
    s = next((s for s in d['SACRAMENTS'] if s['id'] == sid), None)
    before = (s.get('status'), s.get('date', ''), s.get('time', '')) if s is not None else None
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
        time = str(q.get('time') or '').strip()
        require(not time or date, 'Set the celebration date before its time.')
        require(not time or CLOCK.fullmatch(time) is not None, 'Enter a valid celebration time.')
        s['date'], s['time'] = date, time
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
        allowed = {'date', 'time', 'celebrant', 'godparents', 'book', 'page', 'father', 'mother', 'place',
                   'externalParish', 'externalReference'}
        require(isinstance(fields, dict) and fields and set(fields) <= allowed, 'Choose editable sacrament details.')
        for key, value in fields.items():
            require(isinstance(value, str) and len(value) <= 500, 'Invalid sacrament detail.')
            if key == 'date':
                try: dt.date.fromisoformat(value)
                except ValueError: raise Problem(400, 'Enter a valid celebration date.')
            if key == 'time':
                require(not value.strip() or CLOCK.fullmatch(value.strip()) is not None, 'Enter a valid celebration time.')
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
            celebrant=(source or planned or {}).get('celebrant') or u['person_id'] or '',
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
                    # Releasing follows the diocese's policy; with none set, releasing before the bishop's acceptance is said out loud.
                    policy, accepted = release_policy(c, pid), (s.get('acceptance') or {}).get('status') == 'accepted'
                    require(policy != 'after-acceptance' or accepted, 'This diocese releases documents only after the bishop has accepted them.', 409)
                    require(accepted or policy == 'after-signature' or q.get('beforeAcceptance') is True,
                            'The bishop has not accepted this document yet, and the diocese has not decided whether documents wait for that. '
                            'Confirm that you are releasing it before the bishop’s acceptance.', 409)
                    s.update(status='issued', issuedBy=u['name'], issuedAt=at)
            h = dict(action=action, by=u['name'], at=at)
            if action == 'reject': h['reason'] = reason
            if action == 'issue' and not accepted: h['beforeAcceptance'] = True
            s.setdefault('history', []).append(h)
            if action == 'approve' and s.get('kind') == 'certificate':   # the priest's signature: on to the bishop
                s['acceptance'] = dict(status='awaiting', sentAt=at)
                s['history'].append(dict(action='sent to the bishop', by=u['name'], at=at))
                if release_policy(c, pid) == 'after-signature':
                    s.update(status='issued', issuedBy='Released by the diocesan policy', issuedAt=at)
                    s['history'].append(dict(action='issue', by='Diocesan policy: release after the priest’s signature', at=at, automatic=True))
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
    elif action in {'accept-member-request', 'decline-member-request', 'complete-member-request'}:
        request_id = q.get('requestId')
        request = c.execute('SELECT * FROM member_requests WHERE id=? AND parish_id=?',
                            (request_id, pid)).fetchone() if isinstance(request_id, str) else None
        require(request is not None, 'Online request not found.', 404)
        open_states = {'submitted', 'accepted'} if action == 'complete-member-request' and request['kind'] == 'custom' else {'submitted'}
        require(request['status'] in open_states, 'This online request was already handled.')
        details, route = json.loads(request['details']), 'myrequests/' + request['id']
        label = REQUEST_LABELS[request['kind']]
        log = json.loads(request['log'] or '[]')
        if action == 'decline-member-request':
            message = str(q.get('reason') or '').strip()
            require(0 < len(message) <= 500, 'Enter a message for the parishioner.')
            c.execute("UPDATE member_requests SET status='declined',response=?,updated_at=?,log=? WHERE id=?",
                      (message, at, json.dumps(log + [dict(key='declined', at=at)]), request['id']))
            notify_member(c, pid, request['user_id'], 'request-declined', label + ' request not accepted', message, route)
        elif action == 'complete-member-request':
            require(request['kind'] == 'custom', 'Only a general request is marked as done this way.')
            note = str(q.get('note') or '').strip()
            require(len(note) <= 500, 'Keep the message within 500 characters.')
            c.execute("UPDATE member_requests SET status='completed',response=?,updated_at=?,log=? WHERE id=?",
                      (note or request['response'], at, json.dumps(log + [dict(key='completed', at=at)]), request['id']))
            notify_member(c, pid, request['user_id'], 'request-completed', 'Request completed', note, route)
        elif request['kind'] == 'custom':
            note = str(q.get('note') or '').strip()
            require(len(note) <= 500, 'Keep the message within 500 characters.')
            c.execute("UPDATE member_requests SET status='accepted',response=?,updated_at=?,log=? WHERE id=?",
                      (note, at, json.dumps(log + [dict(key='accepted', at=at)]), request['id']))
            notify_member(c, pid, request['user_id'], 'request-accepted', 'Request accepted', note, route)
        elif request['kind'] == 'booking':
            require(isinstance(sid, str) and re.fullmatch(r'r[0-9a-z]{4,40}', sid) is not None
                    and not any(x['id'] == sid for x in d['RESERVATIONS']), 'Choose a unique booking reference.')
            note = str(q.get('note') or '').strip()
            require(len(note) <= 500, 'Keep the message within 500 characters.')
            person_id = details['personId']
            require(any(p['id'] == person_id for p in d['PEOPLE']), 'The person on this request is no longer active in People.')
            require(any(v['id'] == details['venue'] for v in d['VENUES']), 'This place is no longer in the parish list.')
            require(booking_clash(d, details['venue'], details['date'], details['from'], details['to']) is None,
                    'This place is already booked at that time. Decline the request or agree another time with the parishioner.')
            owner = c.execute('SELECT name FROM users WHERE id=?', (request['user_id'],)).fetchone()
            prefix = f'RES-{TODAY()[:4]}-'
            number = max([int(x['ref'][len(prefix):]) for x in d['RESERVATIONS']
                          if str(x.get('ref', '')).startswith(prefix) and str(x['ref'][len(prefix):]).isdigit()] or [0]) + 1
            history = [dict(action='request submitted', by=owner['name'] if owner else 'Parishioner', at=request['created_at'], via='portal'),
                       dict(action='office review completed', by=u['name'], at=at)]
            if u['role'] in CLERGY: history.append(dict(action='approve', by=u['name'], at=at))
            d['RESERVATIONS'].insert(0, dict(id=sid, ref=f'{prefix}{number:03d}', venue=details['venue'], by=person_id, group=None,
                title=details['occasion'], titleAr=details['occasion'], date=details['date'], **{'from': details['from'], 'to': details['to']},
                status='approved' if u['role'] in CLERGY else 'pending', stage='done' if u['role'] in CLERGY else 'priest', setup=0,
                guests=details['guests'], notes=details.get('notes', ''), history=history,
                memberRequestId=request['id'], memberReference=request['reference'], contactPhone=details.get('phone', '')))
            c.execute("UPDATE member_requests SET status='accepted',sacrament_id=?,response=?,updated_at=?,log=? WHERE id=?",
                      (sid, note, at, json.dumps(log + [dict(key='accepted', at=at)]), request['id']))
            event, title = ('confirmed', 'Booking confirmed') if u['role'] in CLERGY else ('review', 'Booking request sent to the priest')
            notify_member(c, pid, request['user_id'], 'request-' + event, title, note, route)
        else:
            require(s is None and isinstance(sid, str) and sid.startswith('sc') and len(sid) <= 48, 'Choose a unique request reference.')
            note = str(q.get('note') or '').strip()
            require(len(note) <= 500, 'Keep the message within 500 characters.')
            owner = c.execute('SELECT name,person_id FROM users WHERE id=?', (request['user_id'],)).fetchone()
            requester = owner['name'] if owner else 'Parishioner'
            people = {p['id']: p for p in d['PEOPLE']}
            child = details.get('child')
            history = [dict(action='sacrament requested' if request['kind'] != 'certificate' else 'request submitted',
                            by=requester, at=request['created_at'], via='portal'),
                       dict(action='office review completed', by=u['name'], at=at)]
            link = dict(memberRequestId=request['id'], memberReference=request['reference'], contactPhone=details.get('phone', ''))
            if request['kind'] == 'certificate':
                person_id = details['personId']
                require(person_id in people, 'The person on this request is no longer active in People.')
                source_id = q.get('sourceRecordId') or None
                planned_id = q.get('requestedSacramentId') or None
                require(not (source_id and planned_id), 'Choose either an official entry or a scheduled sacrament.')
                source = next((x for x in d['SACRAMENTS'] if x['id'] == source_id), None) if source_id else None
                planned = next((x for x in d['SACRAMENTS'] if x['id'] == planned_id), None) if planned_id else None
                if source_id:
                    require(source is not None and source['kind'] == details['certificateOf'] and source['person'] == person_id
                            and source['status'] in OFFICIAL_ENTRY, 'Choose this parishioner’s official entry for the requested certificate.')
                    history.append(dict(action='submitted for clergy review', by=u['name'], at=at))
                if planned_id:
                    require(planned is not None and planned['kind'] == details['certificateOf'] and planned['person'] == person_id
                            and planned['status'] in ACTIVE_ENTRY, 'Choose this parishioner’s pending sacrament for the requested certificate.')
                prefix = f'REQ/{TODAY()[:4]}/'
                number = max([int(x['reg'][len(prefix):]) for x in d['SACRAMENTS']
                              if str(x.get('reg', '')).startswith(prefix) and str(x['reg'][len(prefix):]).isdigit()] or [0]) + 1
                d['SACRAMENTS'].insert(0, dict(id=sid, kind='certificate', kindAr='طلب شهادة', reg=f'{prefix}{number:03d}',
                    person=person_id, date=TODAY(), celebrant=(source or planned or {}).get('celebrant') or u['person_id'] or '',
                    status='awaiting-signature' if source else 'draft', sourceRecordId=source_id, requestedSacramentId=planned_id,
                    purpose=details['purpose'], certificateOf=details['certificateOf'], language=details['language'],
                    godparents='', history=history, revision=1, **link))
                event, title = 'accepted', 'Certificate request accepted'
            else:
                kind, chosen = request['kind'], q.get('personId') or None
                if child is None:
                    person_id = details['personId']
                    require(person_id in people, 'The person on this request is no longer active in People.')
                elif chosen is not None:
                    require(isinstance(chosen, str) and chosen in people, 'Choose a parishioner.')
                    person_id = chosen
                else:
                    require(not any(p['lat'].strip().casefold() == child['lat'].casefold() and p.get('born') == child['born']
                                    for p in d['PEOPLE'] + d['ARCHIVED']),
                            'A person with this name and birth date already exists. Choose the existing record.')
                    person_id = 'p' + secrets.token_hex(8)
                    d['PEOPLE'].append(dict(id=person_id, lat=child['lat'], ar=child['ar'], born=child['born'],
                                            phone='—', town='', townAr='', rite='Maronite', status='member', hh=None, tags=[]))
                    d['PERSON_EXTRA'][person_id] = dict(skills=[], dates=[], occupation='')
                    people[person_id] = d['PEOPLE'][-1]
                if child is not None and q.get('household') is True:
                    household = next((h for h in d['HOUSEHOLDS'] if owner and owner['person_id']
                                      and owner['person_id'] in h.get('members', [])), None)
                    require(household is not None, 'The parishioner is not part of a household yet.')
                    member = people[person_id]
                    require(not member.get('hh') or member['hh'] == household['id'], 'This person already belongs to another household.')
                    if person_id not in household['members']:
                        household['members'].append(person_id)
                        member.update(hh=household['id'], rel='child')
                conflict = sacrament_conflict(d, person_id, kind)
                require(not conflict, conflict)
                prefix = f'SRQ/{TODAY()[:4]}/'
                number = max([int(x['reg'][len(prefix):]) for x in d['SACRAMENTS']
                              if str(x.get('reg', '')).startswith(prefix) and str(x['reg'][len(prefix):]).isdigit()] or [0]) + 1
                entry = dict(id=sid, kind=kind, reg=f'{prefix}{number:03d}', person=person_id,
                             father=child.get('father', '') if child else '', mother=child.get('mother', '') if child else '',
                             date=details.get('date', ''), requestedDate=details.get('date', ''), requestedAt=request['created_at'],
                             requestNotes=details.get('notes', ''), status='office-reviewed', preparation=[], history=history,
                             revision=1, **link)
                if kind == 'marriage': entry.update(partner=details.get('partner', ''), partnerParish=details.get('partnerParish', ''))
                if u['role'] in CLERGY:
                    entry.update(status='preparing', requestApprovedBy=u['name'], requestApprovedAt=at)
                    history.append(dict(action='request accepted for preparation', by=u['name'], at=at))
                    event, title = 'accepted', label + ' request accepted'
                else:
                    event, title = 'review', label + ' request sent to the priest'
                d['SACRAMENTS'].insert(0, entry)
            c.execute("UPDATE member_requests SET status='accepted',sacrament_id=?,response=?,updated_at=?,log=? WHERE id=?",
                      (sid, note, at, json.dumps(log + [dict(key='accepted', at=at)]), request['id']))
            notify_member(c, pid, request['user_id'], 'request-' + event, title, note, route)
    else: raise Problem(400, 'Unknown workflow action.')
    if before is not None and s.get('memberRequestId'):
        notify_request_progress(c, pid, s, before, action)
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
    u = parish_user(c, u, pid)
    require(u['role'] not in {'bishop', 'follower'}, 'This portal is not available to a bishop account.' if u['role'] == 'bishop'
            else 'Ask to become a member of this parish to use its member portal.', 403)
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
    for row in c.execute("SELECT DISTINCT user_id AS id,person_id FROM parish_accounts WHERE parish_id=? AND role='member'", (pid,)):
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


# Sacrament and certificate requests a parishioner sends from the member portal. They
# wait in member_requests (not in the parish record) until the office accepts them into
# the sacrament workflow, so a parishioner never changes the record the office edits.
REQUEST_LABELS = {'baptism': 'Baptism', 'communion': 'First Communion', 'confirmation': 'Confirmation',
                  'marriage': 'Marriage', 'funeral': 'Funeral', 'certificate': 'Certificate',
                  'booking': 'Booking', 'custom': 'General'}  # "General request not accepted"
OWN_REQUESTS = {'booking', 'custom'}
REQUEST_MODULE = {'booking': 'reservations', 'custom': 'requests'}   # every other kind belongs to sacraments and certificates  # asked by the member for themselves, not for a household member
BOOKABLE = {'Hall', 'Room', 'Outdoor'}
CLOCK = re.compile(r'([01][0-9]|2[0-3]):[0-5][0-9]')
CERTIFICATE_OF = ('baptism', 'communion', 'confirmation', 'marriage')
CERTIFICATE_LANGUAGES = ('bilingual', 'arabic', 'english')
ONCE_ONLY = {'baptism', 'communion', 'confirmation', 'funeral'}
ACTIVE_ENTRY = {'requested', 'office-reviewed', 'preparing', 'scheduled', 'draft', 'awaiting-signature'}
OFFICIAL_ENTRY = {'registered', 'issued'}
PROGRESS_EVENTS = {'request accepted for preparation': 'priest-accepted', 'preparation completed': 'prepared',
                   'sacrament celebrated': 'celebrated', 'approve': 'approved', 'issue': 'issued', 'bishop accepted': 'bishop-accepted',
                   'request declined': 'declined', 'reject': 'declined',
                   'preparation cancelled': 'cancelled', 'cancelled': 'cancelled'}


def request_subjects(d, person):
    """The member, then everyone who shares a household with them."""
    people = {p['id']: p for p in d['PEOPLE']}
    ids = [person['id']] if person.get('id') in people else []
    for household in d['HOUSEHOLDS']:
        if ids and ids[0] in household.get('members', []):
            ids += [m for m in household['members'] if m in people and m not in ids]
    return [people[i] for i in ids]


def sacrament_conflict(d, person_id, kind):
    """Why this sacrament cannot be requested for this person now, or ''."""
    records = [s for s in d['SACRAMENTS'] if s.get('person') == person_id and s.get('kind') == kind]
    if kind in ONCE_ONLY and any(s.get('status') in OFFICIAL_ENTRY for s in records):
        return 'This is already recorded in the parish register.' + ('' if kind == 'funeral' else ' You can request a certificate instead.')
    if any(s.get('status') in ACTIVE_ENTRY for s in records):
        return 'The parish office is already preparing this for this person.'
    return ''


def request_subject_key(kind, details):
    if kind == 'booking': return ':'.join(('booking', details['venue'], details['date'], details['from']))
    if kind == 'custom': return 'custom:' + details['subject'].casefold()
    child = details.get('child')
    who = details['personId'] if not child else 'child:' + child['lat'].casefold() + ':' + child['born']
    return kind + ':' + details.get('certificateOf', '') + ':' + who


def member_request_progress(d, row, details):
    """Where a parishioner's request stands, in terms the parishioner can follow."""
    s = next((x for x in d['SACRAMENTS'] if x['id'] == row['sacrament_id']), None) if row['sacrament_id'] else None
    events = [dict(key='submitted', at=row['created_at'])]
    logged = json.loads(row['log'] or '[]')
    if not logged and row['status'] != 'submitted':  # a request handled before steps were logged
        logged = [dict(key=row['status'], at=row['updated_at'])]
    events += [dict(key=entry['key'], at=entry['at']) for entry in logged]
    stage, reason, register, planned, planned_time, preparation = 'received', '', '', '', '', []
    if row['status'] == 'declined':
        stage, reason = 'declined', row['response']
    elif row['status'] == 'withdrawn':
        stage = 'withdrawn'
    elif row['status'] == 'completed':
        stage = 'completed'
    elif row['status'] == 'accepted' and row['kind'] == 'custom':
        stage = 'inprogress'
    elif row['status'] == 'accepted' and row['kind'] == 'booking':
        booking = next((x for x in d['RESERVATIONS'] if x['id'] == row['sacrament_id']), None)
        stage = 'cancelled' if booking is None else {'approved': 'confirmed', 'rejected': 'declined'}.get(booking.get('status'), 'review')
        for entry in (booking or {}).get('history', []):
            key = {'approve': 'confirmed', 'reject': 'declined'}.get(entry.get('action'))
            if key: events.append(dict(key=key, at=entry.get('at', '')))
            if key == 'declined' and entry.get('reason'): reason = entry['reason']
    elif row['status'] == 'accepted':
        stage = 'review'
        if s is not None:
            status, certificate = s.get('status'), s.get('kind') == 'certificate'
            if certificate:
                stage = {'approved': 'signing', 'issued': 'ready', 'rejected': 'declined', 'cancelled': 'cancelled'}.get(status, 'review')
                acceptance = (s.get('acceptance') or {}).get('status')
                if status == 'approved' and acceptance in {'awaiting', 'accepted'}: stage = 'acceptance' if acceptance == 'awaiting' else 'accepted'
            else:
                stage = {'preparing': 'preparing', 'scheduled': 'scheduled', 'draft': 'celebrated', 'awaiting-signature': 'celebrated',
                         'registered': 'completed', 'issued': 'completed', 'rejected': 'declined', 'cancelled': 'cancelled'}.get(status, 'review')
                if s.get('date') and (stage in {'scheduled', 'celebrated', 'completed'} or s['date'] != details.get('date', '')):
                    planned, planned_time = s['date'], s.get('time', '')
                if status in OFFICIAL_ENTRY: register = s.get('reg', '')
                requirements = d.get('PREP_REQUIREMENTS', {}).get(s.get('kind'), [])
                if status in {'preparing', 'scheduled'}:
                    done = s.get('preparation') or []
                    preparation = [dict(en=item[0], ar=item[1], required=bool(item[2]), done=index < len(done) and bool(done[index]))
                                   for index, item in enumerate(requirements)]
            for entry in s.get('history', []):
                key = PROGRESS_EVENTS.get(entry.get('action'))
                if not key: continue
                if key == 'approved' and not certificate: key = 'registered'
                events.append(dict(key=key, at=entry.get('at', '')))
                if key in {'declined', 'cancelled'} and entry.get('reason'): reason = entry['reason']
    return dict(stage=stage, preferredDate=details.get('date', ''), plannedDate=planned, plannedTime=planned_time, register=register,
                preparation=preparation, reason=reason, events=events)


def member_request_item(d, row):
    details = json.loads(row['details'])
    if details.get('child'):
        subject = dict(id='', lat=details['child']['lat'], ar=details['child']['ar'], new=True)
    else:
        p = next((p for p in d['PEOPLE'] + d['ARCHIVED'] if p['id'] == details['personId']), {})
        subject = dict(id=details['personId'], lat=p.get('lat', ''), ar=p.get('ar', ''), new=False)
    return dict(id=row['id'], reference=row['reference'], kind=row['kind'], status=row['status'],
                createdAt=row['created_at'], updatedAt=row['updated_at'], response=row['response'],
                subject=subject, details=details, progress=member_request_progress(d, row, details),
                canWithdraw=row['status'] == 'submitted')


def member_request_options(d, person):
    subjects = []
    for p in request_subjects(d, person):
        entries = [s for s in d['SACRAMENTS'] if s.get('person') == p['id'] and s.get('kind') != 'certificate']
        subjects.append(dict(id=p['id'], lat=p.get('lat', ''), ar=p.get('ar', ''), self=p['id'] == person['id'],
                             onRecord=sorted({s['kind'] for s in entries if s.get('status') in OFFICIAL_ENTRY}),
                             inProgress=sorted({s['kind'] for s in entries if s.get('status') in ACTIVE_ENTRY})))
    contact = d.get('CONTENT', {}).get('contact')
    phone = d['PARISH'].get('phone', '') if isinstance(contact, dict) and contact.get('published', True) else ''
    venues = [dict(id=v['id'], name=v.get('name', ''), ar=v.get('ar', ''), cap=v.get('cap', 0), kind=v.get('kind', ''), kindAr=v.get('kindAr', ''))
              for v in bookable_venues(d)]
    # a booking holds its place from the start of its set-up time
    busy = sorted((dict(venue=r['venue'], date=r['date'], **{'from': clock(max(0, minutes(r['from']) - int(setup_minutes(r)))), 'to': r['to']}, status=r['status'])
                   for r in d['RESERVATIONS'] if r.get('status') in {'pending', 'approved'} and str(r.get('date', '')) >= TODAY()),
                  key=lambda r: (r['date'], r['from'], r['venue']))[:400]
    return dict(subjects=subjects, preparation=d.get('PREP_REQUIREMENTS', {}), phone=phone, venues=venues, busy=busy)


def bookable_venues(d):
    """Halls, rooms and outdoor spaces a parishioner can ask to book; churches and service rooms are arranged with the office."""
    return [v for v in d['VENUES'] if v.get('kind') in BOOKABLE]


def minutes(clock):
    return int(clock[:2]) * 60 + int(clock[3:5])


def clock(total):
    return f'{total // 60:02d}:{total % 60:02d}'


def setup_minutes(r):
    value = r.get('setup')
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0 else 0


def booking_clash(d, venue, date, start, end, statuses=frozenset({'approved'})):
    """The first reservation of this place that overlaps the time, counting its set-up buffer."""
    return next((r for r in d['RESERVATIONS'] if r.get('status') in statuses and r.get('venue') == venue and r.get('date') == date
                 and minutes(r['from']) - setup_minutes(r) < minutes(end) and minutes(start) < minutes(r['to'])), None)


def office_member_requests(c, pid, d):
    people = {p['id']: p for p in d['PEOPLE'] + d['ARCHIVED']}
    households = {m: h['id'] for h in d['HOUSEHOLDS'] for m in h.get('members', [])}
    rows = []
    for r in c.execute('SELECT mr.*,u.name AS requester,u.person_id AS requester_person FROM member_requests mr '
                       'JOIN users u ON u.id=mr.user_id WHERE mr.parish_id=? ORDER BY mr.created_at DESC,mr.reference DESC LIMIT 300', (pid,)):
        owner = r['requester_person'] or ''
        rows.append(dict(id=r['id'], reference=r['reference'], kind=r['kind'], status=r['status'],
                         details=json.loads(r['details']), sacramentId=r['sacrament_id'], response=r['response'],
                         createdAt=r['created_at'], updatedAt=r['updated_at'], log=json.loads(r['log'] or '[]'),
                         requester=dict(name=r['requester'], personId=owner, phone=people.get(owner, {}).get('phone', ''),
                                        household=households.get(owner))))
    return rows


def booking_decisions(c, u, pid, old, d):
    """A booking that began as an online request: record when it is approved, refused or removed,
    and tell the parishioner."""
    before = {r['id']: r for r in old['RESERVATIONS'] if r.get('memberRequestId')}
    current = {r['id']: r for r in d['RESERVATIONS']}
    at = NOW()
    for rid, prior in before.items():
        r = current.get(rid)
        status = r.get('status') if r is not None else 'removed'
        if status == prior.get('status'): continue
        row = c.execute('SELECT * FROM member_requests WHERE id=? AND parish_id=? AND sacrament_id=?',
                        (prior['memberRequestId'], pid, rid)).fetchone()
        if row is None: continue
        reason = str((r or {}).get('reason') or '').strip()[:500] if status == 'rejected' else ''
        if r is not None and status in {'approved', 'rejected'}:
            entry = dict(action='approve' if status == 'approved' else 'reject', by=u['name'], at=at)
            if reason: entry['reason'] = reason  # the parishioner reads it on their request page
            r['history'] = list(r.get('history') or []) + [entry]
        event = {'approved': ('confirmed', 'Booking confirmed', ''), 'rejected': ('declined', 'Booking request not accepted', reason),
                 'removed': ('cancelled', 'Booking cancelled', '')}.get(status)
        if event:
            notify_member(c, pid, row['user_id'], 'request-' + event[0], event[1], event[2], 'myrequests/' + row['id'])


def notify_request_progress(c, pid, s, before, action):
    """Tell the parishioner when the office or the priest moves their request on."""
    row = c.execute('SELECT * FROM member_requests WHERE id=? AND parish_id=? AND sacrament_id=?',
                    (s['memberRequestId'], pid, s['id'])).fetchone()
    if row is None: return
    label = REQUEST_LABELS.get(s.get('kind'), 'Request')
    status, date = s.get('status'), s.get('date', '')
    when = date + (' ' + s['time'] if date and s.get('time') else '')
    reason = (s.get('history') or [{}])[-1].get('reason', '')
    event = None
    if status != before[0]:
        if status == 'preparing' and action == 'approve-sacrament-request': event = ('accepted', label + ' request accepted', '')
        elif status == 'rejected': event = ('declined', label + ' request not accepted', reason)
        elif status == 'scheduled' and action == 'complete-preparation': event = ('scheduled', label + ' preparation complete', when)
        elif status == 'cancelled': event = ('cancelled', label + ' request cancelled', reason)
        elif status == 'registered': event = ('registered', label + ' recorded in the parish register', s.get('reg', ''))
        elif status == 'issued': event = ('ready', 'Certificate ready to collect', '')
    if event is None and action == 'update-preparation' and date and (date, s.get('time', '')) != before[1:]:
        event = ('date', label + ' date set', when)
    if event:
        notify_member(c, pid, row['user_id'], 'request-' + event[0], event[1], event[2], 'myrequests/' + row['id'])


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
    u = parish_user(c, u, pid)
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
    # One-to-one messages live in the account's private inbox (conversations), copied there from here.
    for r in c.execute("SELECT * FROM member_content WHERE parish_id=? AND kind<>'message' ORDER BY created_at DESC", (pid,)):
        if r['group_id'] and r['group_id'] not in gids | managed_groups: continue
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
    for item in concerns:   # the submitter sees who received their concern
        ids = concern_recipient_ids(c, item['id'])
        names = names_of(c, ids)
        item.update(recipients=[names[i] for i in ids if i in names], recipientIds=ids)
    perms = complaint_permissions(c, u, pid)
    review = concerns_received(c, u, pid, d, person)
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
    categories = [dict(name=r['name'], active=bool(r['active']), sensitive=sensitive_concern(r['name'])) for r in c.execute(
        'SELECT name,active FROM complaint_categories WHERE parish_id=? ORDER BY name', (pid,))]
    site = {key: {'en': item.get('en', ''), 'ar': item.get('ar', '')} for key, item in d.get('CONTENT', {}).items()
            if isinstance(item, dict) and item.get('published', True)}
    parish_requests = [member_request_item(d, r) for r in c.execute(
        'SELECT * FROM member_requests WHERE parish_id=? AND user_id=? ORDER BY created_at DESC,reference DESC', (pid, u['id']))]
    return dict(parish={**{k: d['PARISH'].get(k, '') for k in ('id', 'name', 'nameAr', 'town', 'townAr', 'rite', 'riteAr')},
                        'theme': parish_theme(d['PARISH']), 'modules': parish_plan(c, pid)['modules']},
                site=site,
                person=own, groups=groups, meetings=meetings, events=visible_events, content=content,
                notes=private['notes'], todos=private['todos'], commitments=private['commitments'], preferences=private['preferences'],
                concerns=concerns, review=review, complaintPermissions=sorted(perms), profileRequests=requests,
                volunteerReview=volunteer_review, profileReview=profile_review, managedGroups=sorted(managed_groups),
                formation=formation, categories=categories, notifications=notifications,
                concernRecipients=concern_recipient_options(c, u, pid, d, person, gids),
                requests=parish_requests, requestOptions=member_request_options(d, person),
                **(ministry_member_view(c, u, pid, d, person) if person.get('id') else dict(ministryApplications=[], ministryDepartures=[], openMinistries=[])),
                guestRequests=claimed_guest_requests(c, u, pid))


def member_action(c, u, pid, q):
    u = parish_user(c, u, pid)
    d, person, gids = member_context(c, u, pid)
    private = member_private(c, u, pid)
    op = q.get('op')
    group_id = q.get('groupId')
    if op in {'ministryApply', 'ministryWithdraw', 'ministryLeave'}:
        return ministry_member_action(c, u, pid, d, person, q)
    if op == 'claimGuestRequest':
        return guest_request_claim(c, u, pid, q)
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
    elif op == 'sacramentRequest':
        kind = q.get('kind')
        require(isinstance(kind, str) and kind in REQUEST_LABELS, 'Choose what you would like to request.')
        require_module(c, pid, REQUEST_MODULE.get(kind, 'sacraments'), 'this kind of request')
        subjects = {p['id']: p for p in request_subjects(d, person)}
        require(subjects, 'Your person record is not active in this parish.', 403)
        waiting = c.execute("SELECT COUNT(*) FROM member_requests WHERE parish_id=? AND user_id=? AND status='submitted'",
                            (pid, u['id'])).fetchone()[0]
        require(waiting < 10, 'You already have 10 requests waiting for the parish office.')
        child, details = q.get('child'), {}
        if kind in OWN_REQUESTS:
            details['personId'] = person['id']
        elif child is not None:
            require(kind == 'baptism' and isinstance(child, dict),
                    'Only a baptism can be requested for a child who is not registered yet.')
            names = [child.get('lat'), child.get('ar')]
            require(all(isinstance(x, str) and 0 < len(x.strip()) <= 120 for x in names),
                    'Enter the child’s full name in English and in Arabic.')
            born = child.get('born')
            require(iso_date(born) and born <= TODAY(), 'Enter the child’s date of birth.')
            parents = [child.get('father', ''), child.get('mother', '')]
            require(all(isinstance(x, str) and len(x.strip()) <= 120 for x in parents), 'Parent names are too long.')
            details['child'] = dict(lat=names[0].strip(), ar=names[1].strip(), born=born,
                                    father=parents[0].strip(), mother=parents[1].strip())
        else:
            person_id = q.get('personId')
            require(isinstance(person_id, str) and person_id in subjects, 'Choose yourself or a member of your household.')
            require(kind != 'funeral' or person_id != person['id'], 'Choose the family member the funeral is for.')
            details['personId'] = person_id
        if kind == 'booking':
            venues = {v['id']: v for v in bookable_venues(d)}
            venue, date, start, end = q.get('venue'), q.get('date'), q.get('from'), q.get('to')
            require(isinstance(venue, str) and venue in venues, 'Choose the place you would like to book.')
            require(isinstance(date, str) and iso_date(date) and TODAY() <= date and date[:4] <= str(int(TODAY()[:4]) + 2),
                    'Choose a date from today onwards.')
            require(all(isinstance(x, str) and CLOCK.fullmatch(x) for x in (start, end)) and start < end,
                    'Choose a start time before the end time.')
            occasion, guests = q.get('occasion'), q.get('guests')
            require(isinstance(occasion, str) and 2 <= len(occasion.strip()) <= 120, 'Tell the parish what the booking is for.')
            require(isinstance(guests, int) and not isinstance(guests, bool) and guests >= 1, 'Enter how many people are expected.')
            capacity = venues[venue].get('cap') or 0
            require(not capacity or guests <= capacity, f'This place holds up to {capacity} people.')
            require(booking_clash(d, venue, date, start, end) is None, 'This place is already booked at that time. Choose another time or place.')
            details.update(venue=venue, date=date, occasion=occasion.strip(), guests=guests, **{'from': start, 'to': end})
        elif kind == 'custom':
            subject, message, date = q.get('subject'), q.get('message'), q.get('date', '')
            require(isinstance(subject, str) and 2 <= len(subject.strip()) <= 120, 'Say in a few words what you are asking for.')
            require(isinstance(message, str) and 2 <= len(message.strip()) <= 1000, 'Describe your request.')
            require(isinstance(date, str) and (not date or iso_date(date) and date >= TODAY()), 'Choose a date from today onwards.')
            details.update(subject=subject.strip(), message=message.strip(), date=date)
        elif kind == 'certificate':
            certificate_of, purpose, language = q.get('certificateOf'), q.get('purpose'), q.get('language', 'bilingual')
            require(isinstance(certificate_of, str) and certificate_of in CERTIFICATE_OF, 'Choose the certificate you need.')
            require(isinstance(purpose, str) and 0 < len(purpose.strip()) <= 200, 'Tell the parish office what the certificate is for.')
            require(isinstance(language, str) and language in CERTIFICATE_LANGUAGES, 'Choose the certificate language.')
            details.update(certificateOf=certificate_of, purpose=purpose.strip(), language=language)
        else:
            if details.get('personId'):
                conflict = sacrament_conflict(d, details['personId'], kind)
                require(not conflict, conflict)
            date = q.get('date', '')
            require(isinstance(date, str) and (not date or iso_date(date) and date >= TODAY()),
                    'Choose a preferred date from today onwards.')
            details['date'] = date
            if kind == 'marriage':
                partner, partner_parish = q.get('partner'), q.get('partnerParish', '')
                require(isinstance(partner, str) and 0 < len(partner.strip()) <= 120, 'Enter the full name of the future spouse.')
                require(isinstance(partner_parish, str) and len(partner_parish.strip()) <= 120, 'The parish name is too long.')
                details.update(partner=partner.strip(), partnerParish=partner_parish.strip())
        notes, phone = q.get('notes', ''), q.get('phone', '')
        require(isinstance(notes, str) and len(notes.strip()) <= 500, 'Keep your message within 500 characters.')
        require(isinstance(phone, str) and len(phone.strip()) <= 40, 'Enter a shorter phone number.')
        details.update(notes=notes.strip(), phone=phone.strip())
        key = request_subject_key(kind, details)
        require(not any(request_subject_key(r['kind'], json.loads(r['details'])) == key and (kind not in OWN_REQUESTS or r['user_id'] == u['id'])
                        for r in c.execute("SELECT kind,details,user_id FROM member_requests WHERE parish_id=? AND status='submitted'", (pid,))),
            'The parish office already has this request and will reply soon.')
        prefix = f'WEB/{TODAY()[:4]}/'
        numbers = [int(r['reference'][len(prefix):]) for r in c.execute(
            'SELECT reference FROM member_requests WHERE parish_id=? AND reference LIKE ?', (pid, prefix + '%'))
            if r['reference'][len(prefix):].isdigit()]
        reference = f'{prefix}{max(numbers or [0]) + 1:03d}'
        request_id, at = secrets.token_hex(12), NOW()
        c.execute('INSERT INTO member_requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                  (request_id, pid, reference, u['id'], kind, json.dumps(details, ensure_ascii=False), 'submitted', None, '', at, at, '[]'))
        audit(c, u, pid, 'member.request', {'id': request_id, 'kind': kind, 'reference': reference})
        return {'id': request_id, 'reference': reference}
    elif op == 'requestWithdraw':
        request_id = q.get('id')
        row = c.execute('SELECT * FROM member_requests WHERE id=? AND parish_id=? AND user_id=?',
                        (request_id, pid, u['id'])).fetchone() if isinstance(request_id, str) else None
        require(row is not None, 'Request not found.', 404)
        require(row['status'] == 'submitted', 'The parish office has already handled this request. Please contact the office to change it.')
        at = NOW()
        c.execute("UPDATE member_requests SET status='withdrawn',updated_at=?,log=? WHERE id=?",
                  (at, json.dumps(json.loads(row['log'] or '[]') + [dict(key='withdrawn', at=at)]), row['id']))
        audit(c, u, pid, 'member.request-withdrawn', {'id': row['id']})
    elif op == 'changePassword':
        require(password_matches(u['password'], str(q.get('current', ''))), 'Your current password is not correct.')
        password = q.get('password')
        require(isinstance(password, str) and 8 <= len(password) <= 200, 'Choose a password of at least 8 characters.')
        c.execute('UPDATE users SET password=? WHERE id=?', (password_hash(password), u['id']))
        audit(c, u, pid, 'member.password', {})
    elif op == 'accountReset':
        require(u['role'] in CLERGY | {'secretary'}, 'Parish office access required.', 403)
        person_id = q.get('personId')
        target = c.execute("SELECT u.* FROM parish_accounts a JOIN users u ON u.id=a.user_id WHERE a.parish_id=? AND a.person_id=? "
                           "AND a.role IN ('member','leader') ORDER BY a.role DESC", (pid, person_id)).fetchone() if isinstance(person_id, str) else None
        require(target is not None, 'This person has no online account to reset.', 404)
        require(all(a['role'] == 'leader' and a['scope'] == 'parish' for a in authority(c, target)['assignments']),
                'This account holds a staff role. Only an administrator with authority over that role can reset it.', 403)
        temporary = ''.join(secrets.choice('23456789') for _ in range(8))
        c.execute('UPDATE users SET password=? WHERE id=?', (password_hash(temporary), target['id']))
        c.execute('DELETE FROM sessions WHERE user_id=?', (target['id'],))
        audit(c, u, pid, 'member.password-reset', {'person': person_id})
        return {'username': target['username'], 'password': temporary}
    elif op == 'profileRequest':
        require(q.get('field') in PROFILE_REQUEST_FIELDS, 'Invalid field.')
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
        members = c.execute("SELECT DISTINCT user_id AS id,person_id FROM parish_accounts WHERE parish_id=? AND role='member'", (pid,))
        for target in members:
            if group_id and not any(r.get('p') == target['person_id'] for r in d['GROUP_DETAIL'].get(group_id, {}).get('roster', [])):
                continue
            notify_member(c, pid, target['id'], q['kind'], title.strip(), body, 'myresources' if q['kind'] == 'resource' else 'mycommitments' if q['kind'] == 'opportunity' else 'mymessages' if q['kind'] == 'discussion' else 'myfeed')
        audit(c, u, pid, 'member.publish', q['kind'])
    elif op == 'staffMessage':
        require(u['role'] in {'priest', 'secretary', 'leader'}, 'Staff messaging permission required.', 403)
        recipient_person_id = q.get('recipientPersonId')
        require(recipient_person_id in {item['id'] for item in d['PEOPLE']}, 'Choose a person in this parish.')
        led = [g for g in d['GROUPS'] if u['person_id'] in {g.get('leader'), g.get('assistant')} and
               recipient_person_id in {row.get('p') for row in d['GROUP_DETAIL'].get(g['id'], {}).get('roster', [])}]
        if u['role'] == 'leader':
            require(bool(led), 'You may message members of your ministries only.', 403)
        else:
            require('messages.office' in perms_of(u), 'The parish office inbox permission is needed to write for the office.', 403)
        title, body = q.get('title'), q.get('body')
        require(isinstance(title, str) and 0 < len(title.strip()) <= 160 and
                isinstance(body, str) and 0 < len(body.strip()) <= 5000, 'Enter a subject and message.')
        conv = office_conversation(c, u, pid, recipient_person_id, title.strip(), body.strip(), led[0]['id'] if u['role'] == 'leader' else None)
        audit(c, u, pid, 'member.staff-message', {'recipient': recipient_person_id, 'conversation': conv['reference']})
        return {'id': conv['id']}
    elif op == 'message':
        require(group_id in gids, 'Ministry membership required.', 403)
        group = next(g for g in d['GROUPS'] if g['id'] == group_id)
        require(bool(group_leader_accounts(c, pid, group)), 'This ministry has no available messaging contact.', 403)
        body = q.get('body', '')
        require(isinstance(body, str) and 0 < len(body.strip()) <= 5000, 'Enter a message under 5000 characters.')
        account = c.execute('SELECT * FROM users WHERE id=?', (u['id'],)).fetchone()   # the account, not its role in this parish
        conv = conversation_start(c, account, {'subject': 'Message to ' + group['name'], 'body': body,
                                               'to': {'kind': 'ministry', 'parish': pid, 'group': group_id}})
        return {'id': conv['id']}
    elif op == 'messageReply':   # an earlier portal message, now a conversation in the inbox
        account = c.execute('SELECT * FROM users WHERE id=?', (u['id'],)).fetchone()
        conv = c.execute('SELECT * FROM conversations WHERE legacy_id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
        side = conversation_side(c, account, conv) if conv else None
        require(side is not None, 'Message not available for reply.', 403)
        body = q.get('body', '')
        require(isinstance(body, str) and 0 < len(body.strip()) <= 5000, 'Enter a message under 5000 characters.')
        conversation_post(c, account, conv, side, body.strip(), NOW())
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
        recipients = concern_recipients_check(c, u, pid, d, person, gids, q.get('recipients'), str(q.get('peopleInvolved', ''))[:500])
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
        at = NOW()
        for user_id in recipients:   # only the people the submitter chose are told, and without who sent it
            c.execute('INSERT INTO concern_recipients VALUES(?,?,?,?)', (concern_id, user_id, 'chosen', at))
            notify_account(c, user_id, pid, 'concern', 'A concern was sent to you', ref, 'memberhub')
        complaint_log(c, concern_id, None, 'recipients', str(len(recipients)))
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
        for user_id in concern_recipient_ids(c, row['id']):
            notify_account(c, user_id, pid, 'concern', 'New information on a concern sent to you', row['reference'], 'memberhub')
    elif op == 'concernAddRecipients':
        row = c.execute('SELECT * FROM member_concerns WHERE parish_id=? AND id=?', (pid, q.get('id'))).fetchone()
        require(row is not None and (row['user_id'] == u['id'] or
                row['user_id'] is None and row['id'] in private['concernIds']), 'Case not available.', 403)
        current = concern_recipient_ids(c, row['id'])
        added = concern_recipients_check(c, u, pid, d, person, gids, [i for i in (q.get('recipients') or []) if i not in current], row['people_involved'])
        require(len(current) + len(added) <= 10, 'A concern can go to ten people at most.')
        at = NOW()
        for user_id in added:
            c.execute('INSERT INTO concern_recipients VALUES(?,?,?,?)', (row['id'], user_id, 'chosen', at))
            notify_account(c, user_id, pid, 'concern', 'A concern was sent to you', row['reference'], 'memberhub')
        complaint_log(c, row['id'], None if row['user_id'] is None else u['id'], 'recipients-added', str(len(added)))
    elif op == 'concernUpdate':
        row = c.execute('SELECT * FROM member_concerns WHERE id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
        # Only the people the submitter chose; for anyone else the case does not exist.
        require(row is not None and u['id'] in concern_recipient_ids(c, row['id']), 'Case not found.', 404)
        require(not reviewer_conflict(u, person, row), 'A different reviewer must handle a case involving you.', 403)
        status = q.get('status')
        require(status in CONCERN_STATUSES, 'Choose a status.')
        public_text, internal_text = q.get('publicText', ''), q.get('internalText', '')
        require(isinstance(public_text, str) and len(public_text) <= 5000 and isinstance(internal_text, str) and len(internal_text) <= 5000, 'Update is too long.')
        c.execute('UPDATE member_concerns SET status=? WHERE id=?', (status, row['id']))
        c.execute('INSERT INTO member_concern_updates VALUES(?,?,?,?,?,?,?)',
                  (secrets.token_hex(12), row['id'], u['id'], status, public_text, internal_text, NOW()))
        if row['user_id']:
            notify_member(c, pid, row['user_id'], 'concern', 'Concern status: ' + status, public_text, 'myconcerns')
        complaint_log(c, row['id'], u['id'], 'updated', status)
    elif op == 'concernAssign':   # which of the chosen recipients takes the lead
        row = c.execute('SELECT * FROM member_concerns WHERE id=? AND parish_id=?', (q.get('id'), pid)).fetchone()
        recipients = concern_recipient_ids(c, row['id']) if row else []
        require(row is not None and u['id'] in recipients and not reviewer_conflict(u, person, row), 'Case not found.', 404)
        target = c.execute('SELECT * FROM users WHERE id=?', (q.get('reviewerId'),)).fetchone()
        require(target is not None and target['id'] in recipients and
                not reviewer_conflict(target, next((p for p in d['PEOPLE'] if p['id'] == target['person_id']), {}), row),
                'Choose one of the people the submitter sent this concern to.', 403)
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
                or target.is_relative_to(ROOT / 'assets' / 'images') and target.suffix in {'.jpg', '.jpeg', '.png', '.webp', '.svg'}
                or target.is_relative_to(ROOT / 'assets' / 'fonts') and target.suffix == '.woff2')

    def home_page(self):
        """The site's address opens the public homepage; the system itself is index.html."""
        parts = urlsplit(self.path)
        if parts.path == '/': self.path = '/public.html' + ('?' + parts.query if parts.query else '')

    def new_session(self, c, user_id):
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        c.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
        c.execute('INSERT INTO sessions VALUES(?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), user_id, csrf, time.time()+28800))
        secure = '; Secure' if os.environ.get('PARISHLIFE_SECURE_COOKIE') == '1' else ''
        return f'pl_session={token}; HttpOnly; SameSite=Strict; Path=/{secure}'

    def start_session(self, c, user_id, outbox=(), delivery=None):
        cookie = self.new_session(c, user_id)
        c.commit()
        body = {'ok': True}
        if delivery is not None:
            send_outbox(c, outbox); body['delivery'] = settle(delivery, outbox)
        return self.reply(200, body, cookie)

    def session_user(self, c):
        cookie = http.cookies.SimpleCookie(self.headers.get('Cookie', ''))
        token = cookie.get('pl_session')
        session = c.execute('SELECT * FROM sessions WHERE token=? AND expires>?', (hashlib.sha256((token.value if token else '').encode()).hexdigest(), time.time())).fetchone()
        u = c.execute('SELECT * FROM users WHERE id=?', (session['user_id'],)).fetchone() if session else None
        return (session, u) if login_allowed(c, u) else (None, None)

    def public_base(self):
        """The address links in messages point to: PARISHLIFE_PUBLIC_URL, else the address this request came to."""
        return os.environ.get('PARISHLIFE_PUBLIC_URL', '').rstrip('/') or \
            ('https://' if os.environ.get('PARISHLIFE_SECURE_COOKIE') == '1' else 'http://') + self.headers.get('Host', '127.0.0.1')

    def redirect(self, location, cookies=()):
        self.send_response(302)
        self.send_header('Location', location)
        for cookie in cookies: self.send_header('Set-Cookie', cookie)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def oauth(self, path):
        """Google, Apple and Microsoft send the browser here; every outcome is a redirect back to the sign-in page."""
        provider, step = path.split('/')[3:5]
        clear = 'pl_oauth=; Max-Age=0; HttpOnly; Secure; SameSite=None; Path=/api/auth/'
        try:
            with connect() as c:
                c.execute('BEGIN IMMEDIATE')
                if step == 'start':
                    require(self.command == 'GET', 'Method not allowed.', 405)
                    intent = parse_qs(urlsplit(self.path).query).get('intent', ['signin'])[0]
                    if provider_settings(provider) is None or intent not in {'signin', 'signup', 'link'}:
                        return self.redirect('/index.html?auth_error=unavailable')
                    user_id = None
                    if intent == 'link':
                        _, u = self.session_user(c)
                        if u is None: return self.redirect('/index.html?auth_error=expired')
                        user_id = u['id']
                    url, state = oauth_start(c, provider, intent, user_id); c.commit()
                    return self.redirect(url, [f'pl_oauth={state}; Max-Age=600; HttpOnly; Secure; SameSite=None; Path=/api/auth/'])
                if self.command == 'POST':   # Apple posts its answer as a form
                    require(provider == 'apple' and self.headers.get_content_type() == 'application/x-www-form-urlencoded', 'Method not allowed.', 405)
                    length = int(self.headers.get('Content-Length', 0))
                    require(0 < length <= 20000, 'Request too large or empty.', 413)
                    params = {k: v[0] for k, v in parse_qs(self.rfile.read(length).decode()).items()}
                else:
                    require(self.command == 'GET', 'Method not allowed.', 405)
                    params = {k: v[0] for k, v in parse_qs(urlsplit(self.path).query).items()}
                state = http.cookies.SimpleCookie(self.headers.get('Cookie', '')).get('pl_oauth')
                location, user_id = oauth_finish(c, provider, params, state.value if state else '')
                if user_id is None:
                    c.commit(); return self.redirect(location, [clear])
                u = c.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
                if not login_allowed(c, u):
                    c.commit(); return self.redirect('/index.html?auth_error=blocked', [clear])
                if login_methods(c, user_id)[1]:
                    token = mfa_challenge(c, user_id); c.commit()
                    return self.redirect('/index.html?mfa=' + token, [clear])
                cookie = self.new_session(c, user_id); c.commit()
                return self.redirect(location, [clear, cookie])
        except (Problem, ValueError, TypeError, KeyError, AttributeError):
            return self.redirect('/index.html?auth_error=failed', [clear])

    def do_GET(self):
        if self.path.startswith('/api/'): return self.api()
        if not self.public_asset_allowed():
            return self.send_error(404)
        self.home_page()
        return super().do_GET()

    def do_HEAD(self):
        if not self.public_asset_allowed():
            return self.send_error(404)
        self.home_page()
        return super().do_HEAD()

    def do_POST(self): self.api()
    def do_PUT(self): self.api()
    def do_DELETE(self): self.api()

    def api(self):
        if re.fullmatch(r'/api/auth/[a-z]+/(start|callback)', urlsplit(self.path).path): return self.oauth(urlsplit(self.path).path)
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
                    return self.reply(200, {'parishes': public_directory(c)})
                if path == '/api/public/config' and self.command == 'GET':
                    return self.reply(200, public_config())
                if re.fullmatch(r'/api/public/parishes/[^/]+/images/[^/]+', path) and self.command == 'GET':
                    return self.reply_file(public_image(c, path.split('/')[4], path.split('/')[6]))
                if path == '/api/public/plans' and self.command == 'GET':
                    return self.reply(200, plans_public(c))
                if path.startswith('/api/public/parishes/') and self.command == 'GET':
                    return self.reply(200, public_parish(c, path.rsplit('/', 1)[-1]))
                if path.startswith('/api/public/parishes/') and path.endswith('/inquiries') and self.command == 'POST':
                    result = ministry_inquiry(c, path.split('/')[4], q); c.commit(); return self.reply(200, result)
                if path.startswith('/api/public/parishes/') and path.endswith('/document-requests') and self.command == 'POST':
                    outbox = []; result = guest_request_create(c, path.split('/')[4], q, outbox, self.public_base()); c.commit()
                    if outbox: send_outbox(c, outbox); result['linkDelivery'] = outbox[0]['status']
                    return self.reply(200, result)
                if path == '/api/public/requests/track' and self.command == 'POST':
                    return self.reply(200, guest_request_view(c, guest_request_row(c, q.get('token'))))
                if path == '/api/public/requests/document' and self.command == 'POST':
                    row = guest_document(c, q.get('token')); c.commit()
                    return self.reply_file(row)
                if path == '/api/invitations/info' and self.command == 'POST':
                    return self.reply(200, invitation_info(c, q.get('token')))
                if path == '/api/auth/config' and self.command == 'GET':
                    return self.reply(200, auth_config())
                if path == '/api/login' and self.command == 'POST':
                    u = sign_in(c, q)
                    if login_methods(c, u['id'])[1]:   # two-step verification: a challenge instead of a session
                        token = mfa_challenge(c, u['id']); c.commit()
                        return self.reply(200, challenge_info(c, token)[1])
                    return self.start_session(c, u['id'])
                if path == '/api/login/challenge' and self.command == 'POST':
                    return self.reply(200, challenge_info(c, q.get('challenge'))[1])
                if path == '/api/login/send' and self.command == 'POST':
                    outbox = []; result = mfa_send(c, q, outbox); c.commit(); send_outbox(c, outbox)
                    return self.reply(200, dict(result, delivery=outbox[0]['status'] if outbox else result['delivery']))
                if path == '/api/login/verify' and self.command == 'POST':
                    return self.start_session(c, mfa_verify(c, q)['id'])
                if path == '/api/signup' and self.command == 'POST':
                    outbox = []; user_id, delivery = register(c, q, outbox)
                    return self.start_session(c, user_id, outbox, delivery)
                if path == '/api/auth/ticket' and self.command == 'POST':
                    return self.reply(200, provider_ticket(c, q.get('ticket'))[2])
                if path == '/api/auth/complete' and self.command == 'POST':
                    outbox = []; user_id, delivery = provider_complete(c, q, outbox)
                    return self.start_session(c, user_id, outbox, delivery)
                session, u = self.session_user(c)
                require(session is not None, 'Sign in to continue.', 401)
                if self.command != 'GET': require(hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), session['csrf']), 'Invalid request token.', 403)
                if path == '/api/session' and self.command == 'GET':
                    auth = authority(c, u)
                    return self.reply(200, dict(user={k: u[k] for k in ('id', 'username', 'name', 'role', 'person_id')}, csrf=session['csrf'],
                                                parishes=parishes(c, u, auth), authority=session_authority(c, u, auth)))
                if path == '/api/logout' and self.command == 'POST':
                    c.execute('DELETE FROM sessions WHERE token=?', (session['token'],)); c.commit()
                    return self.reply(200, {'ok': True}, 'pl_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/')
                if path == '/api/account':
                    if self.command == 'GET': return self.reply(200, account_view(c, u))
                    if self.command == 'POST':
                        outbox = []; result = account_action(c, u, session, q, outbox); c.commit()
                        if outbox: send_outbox(c, outbox); result['delivery'] = outbox[-1]['status']
                        return self.reply(200, result)
                    raise Problem(405, 'Method not allowed.')
                if path == '/api/diocese/documents':
                    if self.command == 'GET': return self.reply(200, diocese_documents(c, u))
                    if self.command == 'POST':
                        result = diocese_document_action(c, u, q); c.commit(); return self.reply(200, result)
                    raise Problem(405, 'Method not allowed.')
                if path == '/api/plans':
                    if self.command == 'GET': return self.reply(200, plans_view(c, u))
                    if self.command == 'POST':
                        result = plans_action(c, u, q); c.commit(); return self.reply(200, result)
                    raise Problem(405, 'Method not allowed.')
                if path == '/api/messages':
                    if self.command == 'GET': return self.reply(200, messages_list(c, u, {}))
                    if self.command == 'POST':
                        result = messages_action(c, u, q); c.commit(); return self.reply(200, result)
                    raise Problem(405, 'Method not allowed.')
                if path == '/api/notifications':
                    if self.command == 'GET': return self.reply(200, account_notifications_view(c, u))
                    if self.command == 'POST':
                        result = account_notifications_action(c, u, q); c.commit(); return self.reply(200, result)
                    raise Problem(405, 'Method not allowed.')
                if path == '/api/connections':
                    if self.command == 'GET': return self.reply(200, connections_view(c, u))
                    if self.command == 'POST':
                        result = connections_action(c, u, q); c.commit(); return self.reply(200, result)
                    raise Problem(405, 'Method not allowed.')
                if path == '/api/oversight' and self.command == 'GET':
                    return self.reply(200, {'parishes': oversight(c, u)})
                if path == '/api/admin':
                    if self.command == 'GET': return self.reply(200, admin_view(c, u))
                    if self.command == 'POST':
                        result = admin_action(c, u, q); c.commit(); return self.reply(200, result)
                    raise Problem(405, 'Method not allowed.')
                if path == '/api/assignments':
                    require(self.command == 'GET', 'Method not allowed.', 405)
                    auth = authority(c, u)
                    dioceses = [a['scope_id'] for a in auth['assignments'] if a['role'] == 'bishop' and a['scope'] == 'diocese']
                    require(dioceses, 'Archdiocese administration is restricted to the bishop.', 403)
                    in_diocese = {r['id'] for r in c.execute(f'SELECT id FROM parishes WHERE diocese IN ({",".join("?" * len(dioceses))})', dioceses)}
                    priests = {}
                    for a in c.execute("SELECT r.user_id,r.scope_id,u.name FROM role_assignments r JOIN users u ON u.id=r.user_id "
                                       "WHERE r.role='priest' AND r.scope='parish' AND r.status='active' ORDER BY u.name,r.scope_id").fetchall():
                        if a['scope_id'] in in_diocese:
                            priests.setdefault(a['user_id'], dict(id=a['user_id'], name=a['name'], parishes=[]))['parishes'].append(a['scope_id'])
                    return self.reply(200, {'priests': list(priests.values()), 'parishes': parishes(c, u, auth)})
                parts = path.strip('/').split('/')
                if len(parts) == 5 and parts[:2] == ['api', 'parishes'] and parts[3] == 'files':
                    pid, file_id = parts[2], parts[4]
                    u = parish_user(c, u, pid)
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
                pid, endpoint = parts[2:]; u = parish_user(c, u, pid)
                require(u['role'] != 'bishop' or (endpoint == 'oversight' and self.command == 'GET'),
                        'Bishop oversight of a parish is read-only.', 403)
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
                        require(scope not in {'gallery', 'clergy'} or mime.startswith('image/'), 'Use a JPG or PNG picture.')
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
                if endpoint == 'guest-requests' and self.command == 'POST':
                    result = guest_request_action(c, u, pid, q); c.commit(); return self.reply(200, result)
                if endpoint == 'ministries' and self.command == 'POST':
                    result = ministry_action(c, u, pid, q); c.commit(); return self.reply(200, result)
                if endpoint == 'connections' and self.command == 'POST':
                    outbox = []
                    result = office_connection_action(c, u, pid, q, outbox, self.public_base()); c.commit()
                    if outbox: send_outbox(c, outbox); result['delivery'] = outbox[0]['status']
                    return self.reply(200, result)
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
    parser.add_argument('--dev-outbox', action='store_true',
                        help='LOCAL DEVELOPMENT ONLY: print verification codes in this console instead of sending them')
    parser.add_argument('--demo-super-admin', action='store_true',
                        help='LOCAL DEMONSTRATION ONLY: create the super-admin account with the publicly known password 123456789')
    args = parser.parse_args(); init_db()
    if args.dev_outbox:
        global DEV_OUTBOX
        DEV_OUTBOX = True
        print('Development outbox: verification codes are printed here and are NOT sent to anyone.')
    if args.demo_super_admin:
        with connect() as c: provision_demo_super_admin(c)
        print('Demonstration super admin ready: username super-admin, password 123456789.')
        print('This password is public. Never use --demo-super-admin on a server other people can reach.')
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
