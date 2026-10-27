"""Additive account, affiliation and administration services; no seeded production credentials."""
import datetime as dt
import hashlib
import json
import re
import secrets
import copy
from pathlib import Path

SCHEMA = json.loads(Path(__file__).with_name('workspace-schema.json').read_text(encoding='utf-8'))
MODULES = json.loads(Path(__file__).with_name('modules.json').read_text(encoding='utf-8'))
EXTRA_ROLES = {'super_admin', 'diocesan_admin', 'parish_admin'}
POLICY = json.loads(Path(__file__).with_name('administration-policy.json').read_text(encoding='utf-8'))
ADMIN_ROLES = {'super_admin', 'bishop', 'diocesan_admin', 'parish_admin'}
OFFICE_ROLES = ADMIN_ROLES | {'priest', 'secretary'}
PARISH_ROLES = {'priest', 'parish_admin', 'secretary', 'treasurer', 'leader', 'finance_view', 'member'}
EMAIL = re.compile(r'[^@\s]+@[^@\s]+\.[^@\s]+')
PHONE = re.compile(r'\+[0-9]{8,15}')


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def initialize(c):
    for statement in SCHEMA:
        c.execute(statement)
    for statement in json.loads(Path(__file__).with_name('administration-schema.json').read_text(encoding='utf-8')):
        c.execute(statement)
    if not c.execute('SELECT 1 FROM pl_authorization_migrations WHERE version=1').fetchone():
        # An explicitly named legacy role and a real stored diocese provide an
        # unambiguous mapping. Generic "admin" values are never promoted.
        for user in c.execute("SELECT * FROM users WHERE role='diocesan_admin' AND diocese IN (SELECT id FROM dioceses WHERE id<>'pl-platform')").fetchall():
            c.execute("INSERT OR IGNORE INTO pl_grants VALUES(?,?, 'diocese',?,'diocesan_admin',1,NULL,?)",
                      (secrets.token_hex(12), user['id'], user['diocese'], now()))
        c.execute('INSERT INTO pl_authorization_migrations VALUES(1,?)', (now(),))


def history(c, user, scope, action, detail):
    c.execute('INSERT INTO pl_history VALUES(?,?,?,?,?,?)',
              (secrets.token_hex(16), user['id'] if user else None, scope, action, json.dumps(detail), now()))


def account(c, user):
    row = c.execute('SELECT data FROM pl_accounts WHERE user_id=?', (user['id'],)).fetchone()
    return json.loads(row['data']) if row else {'profile': {}, 'theme': {'scheme': 'forest', 'mode': 'light'}}


def suspended(c, user_id, pid=''):
    return bool(c.execute("SELECT 1 FROM pl_suspensions WHERE user_id=? AND active=1 AND scope_id IN ('*',?)",
                          (user_id, pid)).fetchone())


def login_user(c, q, normalize, require):
    value = str(q.get('username') or '').strip()
    mode = q.get('mode', 'legacy')
    require(mode in {'legacy', 'email', 'phone', 'username'}, 'Choose a sign-in method.')
    if mode == 'email':
        require(bool(EMAIL.fullmatch(value)), 'Enter an email address in the email field.')
    if mode == 'phone':
        require(bool(PHONE.fullmatch(normalize(value))), 'Enter a valid phone number.')
    if mode == 'username':
        require(bool(value) and '@' not in value and len(value) <= 120, 'Enter your username.')
    key = value if mode == 'username' else normalize(value)
    user = c.execute('SELECT * FROM users WHERE username=?', (key,)).fetchone()
    if user is None and mode in {'email', 'phone', 'legacy'}:
        user = c.execute('SELECT u.* FROM users u JOIN pl_identities i ON i.user_id=u.id WHERE i.value=?',
                         (key,)).fetchone()
    return user if user is not None and not suspended(c, user['id']) else None


def signup(c, q, normalize, hash_password, require):
    require(not q.get('website'), 'The account could not be created.')
    first, last = [str(q.get(k) or '').strip() for k in ('firstName', 'lastName')]
    require(1 <= len(first) <= 60 and 1 <= len(last) <= 60, 'Enter your first and last name.')
    email = str(q.get('email') or '').strip().lower()
    phone = normalize(q.get('phone')) if q.get('phone') else ''
    require(bool(email or phone), 'Provide an email address, a phone number, or both.')
    require(not email or len(email) <= 120 and EMAIL.fullmatch(email), 'Enter a valid email address.')
    require(not phone or PHONE.fullmatch(phone), 'Enter a valid phone number.')
    born = str(q.get('birthDate') or '')
    try:
        birth = dt.date.fromisoformat(born)
    except ValueError:
        require(False, 'Enter your date of birth.')
    today = dt.date.today()
    age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    require(age >= 13 and age <= 120, 'Accounts are available to people aged 13 and older.')
    password = q.get('password')
    require(isinstance(password, str) and 8 <= len(password) <= 200, 'Choose a password of at least 8 characters.')
    require(password == q.get('confirmPassword'), 'The passwords do not match.')
    for value in [email, phone]:
        if value:
            require(not c.execute('SELECT 1 FROM users WHERE username=?', (value,)).fetchone()
                    and not c.execute('SELECT 1 FROM pl_identities WHERE value=?', (value,)).fetchone(),
                    'This contact already has an account. Sign in to connect additional methods.', 409)
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)).isoformat()
    require(c.execute('SELECT COUNT(*) FROM pl_accounts WHERE created_at>?', (since,)).fetchone()[0] < 30,
            'Too many registrations. Please try again later.', 429)
    uid, stamp = 'u-' + secrets.token_hex(12), now()
    c.execute("INSERT OR IGNORE INTO dioceses VALUES('pl-platform','ParishLife accounts')")
    c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',
              (uid, email or phone, first+' '+last, 'member', 'pl-platform', None, hash_password(password)))
    data = {'profile': {'firstName': first, 'lastName': last, 'birthDate': born, 'email': email, 'phone': phone},
            'theme': {'scheme': 'forest', 'mode': 'light'}, 'profileComplete': False}
    c.execute('INSERT INTO pl_accounts VALUES(?,?,?)', (uid, json.dumps(data), stamp))
    for kind, value in [('email', email), ('phone', phone)]:
        if value:
            c.execute('INSERT INTO pl_identities VALUES(?,?,?,NULL)', (kind, value, uid))
    history(c, {'id': uid}, '*', 'account.created', {'verification': 'pending_configuration'})
    return uid


def platform_role(c, user):
    if is_super_admin(c, user):
        return 'super_admin'
    if user['role'] == 'bishop':
        return 'bishop'
    if c.execute("SELECT 1 FROM pl_grants g JOIN dioceses d ON d.id=g.scope_id WHERE g.user_id=? AND g.scope_type='diocese' AND g.role='diocesan_admin' AND g.active=1", (user['id'],)).fetchone():
        return 'diocesan_admin'
    return 'member' if user['role'] in EXTRA_ROLES else user['role']


def session_data(c, user):
    data = account(c, user)
    return {'preferences': {'theme': data.get('theme', {})}, 'profile': data.get('profile', {}),
            'platformRole': platform_role(c, user),
            'affiliations': [dict(r) for r in c.execute('SELECT * FROM pl_affiliations WHERE user_id=?', (user['id'],))]}


def is_super_admin(c, user):
    """Resolve current platform authority, including an explicit legacy revocation."""
    if not user:
        return False
    stored = c.execute('SELECT role FROM users WHERE id=?', (user['id'],)).fetchone()
    if not stored or stored['role'] == 'disabled' or suspended(c, user['id']):
        return False
    grant = c.execute("SELECT active FROM pl_grants WHERE user_id=? AND scope_type='global' AND scope_id='*' AND role='super_admin'", (user['id'],)).fetchone()
    return bool(grant['active']) if grant else stored['role'] == 'super_admin'


def authorization_snapshots(c, user_ids):
    """Load a bounded account page without per-account database round trips."""
    user_ids = list(dict.fromkeys(user_ids))
    if not user_ids:
        return {}
    if len(user_ids)>100:
        result={}
        for offset in range(0,len(user_ids),100):
            result.update(authorization_snapshots(c,user_ids[offset:offset+100]))
        return result
    placeholders = ','.join('?' for _ in user_ids)
    parishes = {row['id']:dict(row) for row in c.execute('SELECT * FROM parishes')}
    snapshots = {row['id']:{'user':dict(row),'grants':[],'suspensions':set(),'assignments':set(),'affiliations':{},'parishes':parishes}
                 for row in c.execute(f'SELECT * FROM users WHERE id IN ({placeholders})', user_ids)}
    for row in c.execute(f'SELECT * FROM pl_grants WHERE user_id IN ({placeholders})', user_ids):
        snapshots[row['user_id']]['grants'].append(dict(row))
    for row in c.execute(f'SELECT user_id,scope_id FROM pl_suspensions WHERE active=1 AND user_id IN ({placeholders})', user_ids):
        snapshots[row['user_id']]['suspensions'].add(row['scope_id'])
    for row in c.execute(f'SELECT * FROM assignments WHERE user_id IN ({placeholders})', user_ids):
        snapshots[row['user_id']]['assignments'].add(row['parish_id'])
    for row in c.execute(f"SELECT * FROM pl_affiliations WHERE membership='approved' AND user_id IN ({placeholders})", user_ids):
        snapshots[row['user_id']]['affiliations'][row['parish_id']]=dict(row)
    return snapshots


def authorization_snapshot(c, user):
    """Request-local data only; role revocation never waits for a cache TTL."""
    return authorization_snapshots(c,[user['id']]).get(user['id'],
        {'user':None,'grants':[],'suspensions':set(),'assignments':set(),'affiliations':{},'parishes':{}})


def scoped_roles(c, user, pid=None, diocese=None, snapshot=None):
    """Resolve each role together with its own scope, using one current snapshot."""
    snapshot = snapshot if snapshot is not None else authorization_snapshot(c, user)
    stored = snapshot['user']
    if not stored or stored['role'] == 'disabled' or '*' in snapshot['suspensions']:
        return set()
    if pid:
        parish = snapshot['parishes'].get(pid)
        if not parish:
            return set()
        diocese = parish['diocese']
    platform_grant = next((grant for grant in snapshot['grants'] if grant['scope_type']=='global' and grant['scope_id']=='*' and grant['role']=='super_admin'), None)
    is_super = bool(platform_grant['active']) if platform_grant else stored['role']=='super_admin'
    roles = {'super_admin'} if is_super else set()
    if pid and pid in snapshot['suspensions'] and not is_super:
        return set()
    if stored['role']=='bishop' and diocese and stored['diocese']==diocese:
        roles.add('bishop')
    for grant in snapshot['grants']:
        expected = POLICY['roles'].get(grant['role'], {}).get('scope')
        matches = grant['scope_type']=='parish' and pid and grant['scope_id']==pid or grant['scope_type']=='diocese' and diocese and grant['scope_id']==diocese
        if grant['active'] and matches and expected in {grant['scope_type'],'either'}:
            roles.add(grant['role'])
    if pid and stored['role'] in PARISH_ROLES and pid in snapshot['assignments']:
        overridden = next((grant for grant in snapshot['grants'] if grant['scope_type']=='parish' and grant['scope_id']==pid and grant['role']==stored['role']), None)
        if not overridden or overridden['active']:
            roles.add(stored['role'])
    if pid in snapshot['affiliations']:
        roles.add('member')
    return roles


def authority(c, user, pid=None, diocese=None, snapshot=None):
    roles = scoped_roles(c, user, pid, diocese, snapshot) & (ADMIN_ROLES | {'priest'})
    return max(roles, key=lambda role: POLICY['roles'][role]['rank']) if roles else None


def has_clergy(user):
    return user['role'] == 'priest' or 'priest' in dict(user).get('roles', [])


def protected_credentials(c, user):
    stored=c.execute('SELECT role FROM users WHERE id=?',(user['id'],)).fetchone()
    return bool(stored and (stored['role']!='member' or c.execute('SELECT 1 FROM pl_grants WHERE user_id=? AND active=1',(user['id'],)).fetchone()))


def account_summaries(c, parish_id):
    rows=c.execute("SELECT DISTINCT u.id,u.username,u.role,COALESCE(f.person_id,u.person_id) AS person_id FROM users u LEFT JOIN assignments a ON a.user_id=u.id LEFT JOIN pl_affiliations f ON f.user_id=u.id AND f.parish_id=? WHERE a.parish_id=? OR f.membership='approved'",(parish_id,parish_id)).fetchall()
    snapshots=authorization_snapshots(c,[row['id'] for row in rows if row['person_id']])
    result={}
    for row in rows:
        if not row['person_id']:
            continue
        snapshot=snapshots[row['id']]
        context=parish_context(c,row,parish_id,snapshot)
        protected=row['role']!='member' or any(grant['active'] for grant in snapshot['grants'])
        result[row['person_id']]={'id':row['id'],'username':row['username'],'role':context['role'] if context else 'member',
                                  'inactive':bool(snapshot['suspensions'] & {'*',parish_id}),
                                  'canResetPassword':not protected and context is not None}
    return result


def is_office(user):
    return user['role'] in OFFICE_ROLES or bool(set(dict(user).get('roles', [])) & OFFICE_ROLES)


def parish_plan(c,pid):
    row=c.execute('SELECT data FROM pl_plans WHERE parish_id=?',(pid,)).fetchone()
    return json.loads(row['data']) if row else {'bundle':'complete','sponsor':'parish','modules':list(MODULES),'billing':'manual','publicRequests':True}


def require_modules(c,pid,keys,require):
    enabled=parish_plan(c,pid).get('modules',[])
    for module,collections in MODULES.items():
        require(module in enabled or not set(keys).intersection(collections),
                'This module is read-only under the current parish bundle. Existing records are preserved; request a bundle change to edit them.',403)


def office_access(c,user,pid):
    context=parish_context(c,user,pid)
    return context is not None and context['role'] in {'super_admin','bishop','diocesan_admin','parish_admin','priest','secretary'}


def public_profile(c, pid, state):
    parish = state['PARISH']
    clergy=[]
    for r in c.execute("SELECT DISTINCT u.id,u.name FROM users u LEFT JOIN assignments a ON a.user_id=u.id LEFT JOIN pl_grants g ON g.user_id=u.id WHERE (a.parish_id=? AND u.role='priest') OR (g.scope_type='parish' AND g.scope_id=? AND g.role='priest' AND g.active=1)",(pid,pid)):
        context=parish_context(c,{'id':r['id']},pid)
        if not context or not has_clergy(context):continue
        title=c.execute('SELECT title FROM pl_clergy_titles WHERE user_id=? ORDER BY created_at DESC LIMIT 1',(r['id'],)).fetchone()
        clergy.append({'name':r['name'],'title':title['title'] if title else 'Priest'})
    people={p['id']:p for p in state.get('PEOPLE',[])}
    ministries = [dict(id=g['id'], name=g.get('name', ''), nameAr=g.get('ar',g.get('nameAr','')),
                       description=g.get('description', ''), responsible=g.get('leaderName') or people.get(g.get('leader'),{}).get('lat',''),
                       joining='Send an inquiry to the parish office.')
                  for g in state.get('GROUPS', []) if g.get('vis','public')=='public' and g.get('public',True)]
    return {'clergy': clergy, 'ministries': ministries, 'parishPhoto':state.get('PHOTOS',{}).get('parish',''), 'gallery':parish.get('gallery',[]),
            'publicRequests':parish_plan(c,pid).get('publicRequests',True), 'visit': {k: parish.get(k, '') for k in ('email','officeHours','confessionTimes','accessibility','latitude','longitude','website')}}


def parish_context(c, user, pid, snapshot=None):
    snapshot = snapshot if snapshot is not None else authorization_snapshot(c, user)
    stored, parish = snapshot['user'], snapshot['parishes'].get(pid)
    if not stored or not parish:
        return None
    roles = scoped_roles(c, user, pid, snapshot=snapshot)
    visible_roles = roles - {'clergy_assigner'}
    if not visible_roles:
        return None
    role = max(visible_roles, key=lambda value: POLICY['roles'].get(value, {}).get('rank',10))
    affiliation = snapshot['affiliations'].get(pid, {})
    person_id = affiliation.get('person_id') or (stored['person_id'] if pid in snapshot['assignments'] else None)
    return {**stored,'role':role,'roles':sorted(roles),'diocese':parish['diocese'],'person_id':person_id}


def accessible_parishes(c,user):
    snapshot = authorization_snapshot(c,user)
    plans = {row['parish_id']:json.loads(row['data']) for row in c.execute('SELECT parish_id,data FROM pl_plans')}
    default_plan = {'bundle':'complete','sponsor':'parish','modules':list(MODULES),'billing':'manual','publicRequests':True}
    result=[]
    for parish in snapshot['parishes'].values():
        context=parish_context(c,user,parish['id'],snapshot)
        if context:
            definition=POLICY['roles'].get(context['role'],{})
            result.append({**json.loads(parish['metadata']),'id':parish['id'],'effectiveRole':context['role'],
                           'roles':context['roles'],'personId':context['person_id'],
                           'canViewFinance':bool(set(context['roles']) & (ADMIN_ROLES | {'priest','treasurer','finance_view'})),
                           'plan':plans.get(parish['id'],default_plan),'role':definition.get('label',context['role']),
                           'roleAr':definition.get('labelAr',context['role'])})
    return result


def case_access(c,user_id,concern):
    return bool(concern['assigned_to']==user_id or c.execute(
        'SELECT 1 FROM pl_case_reviewers WHERE concern_id=? AND user_id=?',(concern['id'],user_id)).fetchone())


def reviewers(c,pid):
    result=[]
    for user in c.execute('SELECT * FROM users'):
        context=parish_context(c,user,pid)
        if context and (has_clergy(context) or context['role']=='leader' or c.execute('SELECT 1 FROM complaint_reviewers WHERE user_id=? AND parish_id=?',(user['id'],pid)).fetchone()):
            result.append(dict(id=user['id'],name=user['name'],person_id=context['person_id']))
    return result


def inbox(c,user,path,method,q,require):
    if path=='/api/inbox' and method=='GET':
        messages=[dict(r) for r in c.execute("SELECT m.id,m.parish_id,m.author_id,m.recipient_id,m.title,m.body,m.created_at,u.name AS author_name,v.name AS recipient_name,COALESCE(s.is_read,0) AS is_read,COALESCE(s.archived,0) AS archived FROM member_content m JOIN users u ON u.id=m.author_id JOIN users v ON v.id=m.recipient_id LEFT JOIN pl_message_state s ON s.message_id=m.id AND s.user_id=? WHERE m.kind='message' AND (m.author_id=? OR m.recipient_id=?) ORDER BY m.created_at DESC",(user['id'],user['id'],user['id']))]
        recipients=[]
        for parish in c.execute('SELECT id,metadata FROM parishes'):
            pid=parish['id']
            context=parish_context(c,user,pid)
            following=c.execute('SELECT 1 FROM pl_affiliations WHERE user_id=? AND parish_id=? AND following=1',(user['id'],pid)).fetchone()
            if not context and not following:
                continue
            if suspended(c,user['id'],pid):
                continue
            targets=c.execute('SELECT id,name,role FROM users')
            for target in targets:
                if target['id']==user['id'] or suspended(c,target['id'],pid):
                    continue
                target_context=parish_context(c,target,pid)
                if not target_context or not context and not is_office(target_context):
                    continue
                recipients.append({**dict(target),'role':target_context['role'],'parish':pid,'parishName':json.loads(parish['metadata'])['name']})
        return {'messages':messages,'recipients':recipients}
    if path=='/api/inbox' and method=='POST':
        action=q.get('action','send')
        if action in {'read','unread','archive','unarchive'}:
            row=c.execute("SELECT * FROM member_content WHERE id=? AND kind='message'",(q.get('id'),)).fetchone()
            require(row and user['id'] in {row['author_id'],row['recipient_id']},'Message not available.',403)
            old=c.execute('SELECT * FROM pl_message_state WHERE user_id=? AND message_id=?',(user['id'],row['id'])).fetchone()
            read,archived=(old['is_read'],old['archived']) if old else (0,0)
            if action in {'read','unread'}:read=int(action=='read')
            else:archived=int(action=='archive')
            c.execute('INSERT INTO pl_message_state VALUES(?,?,?,?) ON CONFLICT(user_id,message_id) DO UPDATE SET is_read=excluded.is_read,archived=excluded.archived',(user['id'],row['id'],read,archived))
            return {'ok':True}
        require(action in {'send','reply'},'Messages cannot be edited or deleted.')
        pid,recipient=q.get('parish'),q.get('recipient')
        title=str(q.get('title') or '').strip()
        if action=='reply':
            row=c.execute("SELECT * FROM member_content WHERE id=? AND kind='message'",(q.get('id'),)).fetchone()
            require(row and row['recipient_id']==user['id'],'Message not available for reply.',403)
            pid,recipient,title=row['parish_id'],row['author_id'],'Re: '+re.sub(r'^Re:\s*','',row['title'],flags=re.IGNORECASE)[:156]
        directory=inbox(c,user,'/api/inbox','GET',{},require)['recipients']
        require(any(r['id']==recipient and r['parish']==pid for r in directory),'Choose a recipient in your available parish directory.',403)
        body=str(q.get('body') or '').strip()
        require(1<=len(title)<=160 and 1<=len(body)<=5000,'Enter a subject and message.')
        mid=secrets.token_hex(12)
        c.execute('INSERT INTO member_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',(mid,pid,None,'message',user['id'],recipient,title,body,'',None,None,0,now()))
        c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',(secrets.token_hex(12),pid,recipient,'message','New private message','Open your inbox to read it.','inbox',now()))
        return {'id':mid}
    if path=='/api/workspace/emergency-message' and method=='POST':
        require(user['role']=='super_admin','Super administrator emergency access required.',403)
        reason=str(q.get('reason') or '').strip()
        require(20<=len(reason)<=1000,'Record the specific emergency or problem (at least 20 characters).')
        row=c.execute("SELECT id,parish_id,author_id,recipient_id,title,body,created_at FROM member_content WHERE id=? AND kind='message'",(q.get('id'),)).fetchone()
        require(row,'Message not found.',404)
        history(c,user,row['parish_id'],'emergency.message.opened',{'id':row['id'],'reason':reason})
        return dict(row)
    return None


def admin_handle(c,user,path,method,q,require):
    if not path.startswith('/api/workspace/'):
        return None
    from . import administration
    result = administration.handle(c, user, path, method, q, require)
    if result is not None:
        return result
    pid=q.get('parish')
    manager=authority(c,user,pid) if pid else None
    manage={'super_admin','bishop','diocesan_admin','parish_admin','priest'}
    if path=='/api/workspace/public-profile':
        require(manager in manage,'Parish management access required.',403)
        row=c.execute('SELECT revision,data FROM states WHERE parish_id=?',(pid,)).fetchone()
        state=json.loads(row['data'])
        keys=('phone','email','address','officeHours','confessionTimes','accessibility','website','latitude','longitude')
        if method=='GET':
            return {'revision':row['revision'],'profile':{**{k:state['PARISH'].get(k,'') for k in keys},'gallery':state['PARISH'].get('gallery',[]),'massTimes':state.get('CONTENT',{}).get('massTimes',{}).get('en',''),'massTimesAr':state.get('CONTENT',{}).get('massTimes',{}).get('ar','')}}
        require(method=='PUT','Method not allowed.',405)
        require(q.get('revision')==row['revision'],'Parish details changed. Reopen this form before saving.',409)
        values={k:str(q.get(k) or '').strip() for k in (*keys,'massTimes','massTimesAr')}
        require(all(len(v)<=2000 for v in values.values()),'Keep each field within 2,000 characters.')
        require(not values['email'] or EMAIL.fullmatch(values['email']),'Enter a valid parish email address.')
        require(not values['website'] or re.fullmatch(r'https://[^\s]+',values['website']),'Use an HTTPS website address.')
        gallery=q.get('gallery',[])
        require(isinstance(gallery,list) and len(gallery)<=12 and all(isinstance(v,str) and len(v)<=2000 and re.fullmatch(r'https://[^\s]+',v) for v in gallery),'Add up to twelve HTTPS image links.')
        require(bool(values['latitude'])==bool(values['longitude']),'Enter both coordinates or leave both empty.')
        if values['latitude']:
            try: lat,lon=float(values['latitude']),float(values['longitude'])
            except ValueError: require(False,'Enter valid coordinates.')
            require(-90<=lat<=90 and -180<=lon<=180,'Enter valid coordinates.')
        state['PARISH'].update({k:values[k] for k in keys},gallery=gallery)
        content=state.setdefault('CONTENT',{})
        content['massTimes']={'en':values['massTimes'],'ar':values['massTimesAr'],'published':True}
        contact='\n'.join(values[k] for k in ('address','phone','email') if values[k])
        content['contact']={**content.get('contact',{}),'en':contact,'published':True}
        c.execute('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',(json.dumps(state),pid))
        history(c,user,pid,'public-profile.updated',{})
        return {'ok':True}
    if path=='/api/workspace/certificate-resubmit' and method=='POST':
        context=parish_context(c,user,pid)
        require(context and has_clergy(context),'Only a parish priest may resubmit a certificate.',403)
        row=c.execute('SELECT revision,data FROM states WHERE parish_id=?',(pid,)).fetchone()
        require(row['revision']==q.get('revision'),'The parish changed. Reload before continuing.',409)
        state=json.loads(row['data']);record=next((r for r in state['SACRAMENTS'] if r['id']==q.get('id')),None)
        require(record and record.get('kind')=='certificate' and record.get('bishopReview')=='returned','Returned certificate not found.',409)
        note=str(q.get('note') or '').strip()
        require(q.get('verified') is True and 3<=len(note)<=1000,'Confirm the review and explain how the bishop’s note was addressed.')
        record.update(bishopReview='pending',resubmissionNote=note)
        record.setdefault('history',[]).append(dict(action='resubmitted to bishop',by=user['name'],at=now(),reason=note))
        c.execute('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',(json.dumps(state),pid))
        for bishop in c.execute("SELECT id FROM users WHERE role='bishop' AND diocese=?",(context['diocese'],)):
            c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',(secrets.token_hex(12),pid,bishop['id'],'certificate','Certificate resubmitted for acceptance',record['reg'],'workspace',now()))
        history(c,user,pid,'certificate.resubmitted',{'id':record['id']})
        return {'ok':True}
    if path=='/api/workspace/certificates' and method in {'GET','POST'}:
        require(user['role']=='bishop','Only the diocesan bishop reviews signed certificates.',403)
        rows=[]
        for parish in c.execute('SELECT p.id,p.metadata,s.revision,s.data FROM parishes p JOIN states s ON s.parish_id=p.id WHERE p.diocese=?',(user['diocese'],)):
            state=json.loads(parish['data'])
            for record in state.get('SACRAMENTS',[]):
                if record.get('kind')=='certificate' and record.get('bishopReview'):
                    person=next((p for p in state['PEOPLE']+state['ARCHIVED'] if p['id']==record['person']),{})
                    rows.append(dict(id=record['id'],parish=parish['id'],parishName=json.loads(parish['metadata'])['name'],person=person.get('lat',''),reference=record['reg'],signedBy=record.get('issuedBy',''),signedAt=record.get('issuedAt',''),status=record['bishopReview'],revision=parish['revision'],note=record.get('resubmissionNote',''),bishopNote=record.get('bishopReviewNote','')))
        if method=='GET':return {'certificates':rows}
        selected=next((r for r in rows if r['id']==q.get('id') and r['parish']==pid),None)
        require(selected and selected['status']=='pending','Pending certificate not found.',404)
        require(q.get('revision')==selected['revision'],'The parish changed. Reload before reviewing.',409)
        decision=q.get('decision')
        require(decision in {'accepted','returned'},'Choose accept or return.')
        note=str(q.get('note') or '').strip()
        require(len(note)<=1000 and (decision!='returned' or len(note)>=3),'Provide a reason when returning a certificate.')
        state=json.loads(c.execute('SELECT data FROM states WHERE parish_id=?',(pid,)).fetchone()['data'])
        record=next(r for r in state['SACRAMENTS'] if r['id']==selected['id'])
        record.update(bishopReview=decision,bishopReviewedBy=user['name'],bishopReviewedAt=now(),bishopReviewNote=note)
        record.setdefault('history',[]).append(dict(action='bishop '+decision,by=user['name'],at=now(),reason=note))
        c.execute('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',(json.dumps(state),pid))
        if record.get('signedByUserId'):
            c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',(secrets.token_hex(12),pid,record['signedByUserId'],'certificate','Certificate '+decision+' by the bishop',note,'certificate/'+record['id'],now()))
        if decision=='accepted' and record.get('memberRequestId'):
            owner=c.execute('SELECT user_id FROM member_requests WHERE id=? AND parish_id=?',(record['memberRequestId'],pid)).fetchone()
            if owner: c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',(secrets.token_hex(12),pid,owner['user_id'],'certificate','Certificate ready to collect','','myrequests/'+record['memberRequestId'],now()))
        history(c,user,pid,'certificate.bishop.'+decision,{'id':record['id']})
        return {'ok':True}
    if path=='/api/workspace/parishes' and method=='POST':
        did=q.get('diocese')
        auth=authority(c,user,diocese=did)
        require(auth in {'super_admin','bishop','diocesan_admin'},'Parish creation requires diocesan authority.',403)
        require(c.execute("SELECT 1 FROM dioceses WHERE id=? AND id<>'pl-platform'",(did,)).fetchone(),'Choose a diocese.')
        name,town=[str(q.get(k) or '').strip() for k in ('name','town')]
        require(2<=len(name)<=120 and 1<=len(town)<=120,'Enter a parish name and town.')
        secretary_id = q.get('secretaryUserId') or None
        if secretary_id:
            require(isinstance(secretary_id, str) and c.execute("SELECT 1 FROM users WHERE id=? AND role<>'disabled'", (secretary_id,)).fetchone(), 'Secretary account not found.', 404)
            require(not suspended(c,secretary_id), 'Reactivate the secretary account before assigning it.',409)
        parish_id='parish-'+secrets.token_hex(8)
        meta=dict(id=parish_id,name=name,ar=str(q.get('nameAr') or name)[:120],town=town,townAr=str(q.get('townAr') or town)[:120])
        seed=json.loads(Path(__file__).with_name('seed.json').read_text(encoding='utf-8'))
        state={k:[] if isinstance(v,list) else {} if isinstance(v,dict) else v for k,v in seed.items()}
        for key in ('RATE','SERVICE','ROTA','CHECKIN','BATCH','REG_FORM','EVACUATION','PREP_REQUIREMENTS'):
            state[key]=copy.deepcopy(seed[key])
        state['SERVICE'].update(title='New service or activity',titleAr='خدمة أو نشاط جديد',date=now()[:10],status='draft',order=[],celebrant=None,coordinator=None,venue=None)
        state['ROTA']['teams']=[]
        state['CHECKIN'].update(rows=[],sessions={},present=0,expected=0,awaitingGuardian=0,room=None)
        state['BATCH'].update(lines=[],counters=[])
        state['REG_FORM'].update(fields=[],discounts=[],installments=[])
        state['EVACUATION']['rooms']=[]
        state['PARISH']={**meta,'nameAr':meta['ar'],'rite':str(q.get('rite') or ''),'riteAr':str(q.get('rite') or ''),'phone':'','address':''}
        state['OFFICE_LEDGER']=[]
        state['IMPORT_PREVIEW']={'total':0,'ok':0,'warn':0,'err':0,'cols':[],'issues':[]}
        c.execute('INSERT INTO parishes VALUES(?,?,?)',(parish_id,did,json.dumps(meta)))
        for category in ('Ministry activities','Leadership','Meetings','Events','Facilities','Behaviour or conduct','Safety','Communication','Financial concerns','Harassment or inappropriate behaviour','Administrative issues','Suggestions','Other'):
            c.execute('INSERT INTO complaint_categories VALUES(?,?,1)',(parish_id,category))
        c.execute('INSERT INTO states VALUES(?,1,?)',(parish_id,json.dumps(state)))
        if secretary_id:
            administration.write_grant(c,user,secretary_id,'secretary','parish',parish_id,True)
            history(c,user,parish_id,'role.granted',{'user':secretary_id,'role':'secretary','scopeType':'parish','scopeId':parish_id})
        history(c,user,did,'parish.created',meta)
        return {'id':parish_id}
    if path=='/api/workspace/people' and method=='GET':
        require(manager in manage,'Management access required.',403)
        directory=administration.handle(c,user,'/api/workspace/administration','GET',{'parish':pid,'afterUser':q.get('afterUser','')},require)
        snapshots=authorization_snapshots(c,[target['id'] for target in directory['users']])
        users=[{key:snapshots[target['id']]['user'][key] for key in ('id','username','name','role','person_id')} for target in directory['users']]
        for target in users:
            effective=parish_context(c,target,pid,snapshots[target['id']])
            target['effectiveRole']=effective['role'] if effective else None
            target['inactive']=bool(snapshots[target['id']]['suspensions'] & {'*',pid})
            target_rank=max([POLICY['roles'].get(role,{}).get('rank',0) for role in (effective['roles'] if effective else [])],default=0)
            target['canSuspend']=target['id']!=user['id'] and (manager=='super_admin' or POLICY['roles'][manager]['rank']>target_rank)
            title=c.execute('SELECT title FROM pl_clergy_titles WHERE user_id=? ORDER BY created_at DESC LIMIT 1',(target['id'],)).fetchone()
            target['clergyTitle']=title['title'] if title else ('Priest' if target['role']=='priest' else '')
        memberships=[dict(r) for r in c.execute("SELECT a.*,u.name,u.username FROM pl_affiliations a JOIN users u ON u.id=a.user_id WHERE a.parish_id=? AND a.membership='pending'",(pid,))]
        state=json.loads(c.execute('SELECT data FROM states WHERE parish_id=?',(pid,)).fetchone()['data'])
        did=c.execute('SELECT diocese FROM parishes WHERE id=?',(pid,)).fetchone()['diocese']
        grants=[dict(r) for r in c.execute("SELECT g.*,u.name FROM pl_grants g JOIN users u ON u.id=g.user_id WHERE ((g.scope_type='parish' AND g.scope_id=?) OR (g.scope_type='diocese' AND g.scope_id=?)) AND g.active=1",(pid,did))]
        for r in c.execute("SELECT u.id,u.name,u.role FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.role IN ('priest','parish_admin','secretary','treasurer','leader')",(pid,)):
            if not c.execute("SELECT 1 FROM pl_grants WHERE user_id=? AND scope_type='parish' AND scope_id=? AND role=?",(r['id'],pid,r['role'])).fetchone():
                grants.append(dict(id='legacy-'+r['id'],user_id=r['id'],name=r['name'],role=r['role'],scope_type='parish',scope_id=pid,active=1))
        return {'users':users,'memberships':memberships,'people':[{'id':p['id'],'name':p['lat']} for p in state['PEOPLE']],'grants':grants,'nextUserCursor':directory['nextUserCursor']}
    if path=='/api/workspace/membership' and method=='GET':
        require(office_access(c,user,pid),'Office access required.',403)
        state=json.loads(c.execute('SELECT data FROM states WHERE parish_id=?',(pid,)).fetchone()['data'])
        memberships=[]
        for r in c.execute("SELECT a.*,u.name,u.username FROM pl_affiliations a JOIN users u ON u.id=a.user_id WHERE a.parish_id=? AND a.membership='pending'",(pid,)):
            memberships.append({**dict(r),'profile':account(c,{'id':r['user_id']}).get('profile',{})})
        return {'memberships':memberships,'people':[{'id':p['id'],'name':p['lat']} for p in state['PEOPLE']]}
    if path=='/api/workspace/membership' and method=='POST':
        require(office_access(c,user,pid),'Office access required.',403)
        target=q.get('userId')
        row=c.execute("SELECT * FROM pl_affiliations WHERE user_id=? AND parish_id=? AND membership='pending'",(target,pid)).fetchone()
        require(row,'Pending membership not found.',404)
        status=q.get('status')
        require(status in {'approved','declined'},'Choose approve or decline.')
        person_id=None
        if status=='approved':
            person_id=q.get('personId')
            state=json.loads(c.execute('SELECT data FROM states WHERE parish_id=?',(pid,)).fetchone()['data'])
            require(any(p['id']==person_id for p in state['PEOPLE']),'Link an existing person record after reviewing their identity.')
            require(not c.execute("SELECT 1 FROM pl_affiliations WHERE parish_id=? AND person_id=? AND membership='approved' AND user_id<>? UNION SELECT 1 FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? AND u.id<>?",(pid,person_id,target,pid,person_id,target)).fetchone(),'This person is already linked to another account.')
        c.execute('UPDATE pl_affiliations SET membership=?,person_id=?,updated_at=? WHERE user_id=? AND parish_id=?',(status,person_id,now(),target,pid))
        c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',(secrets.token_hex(12),pid,target,'membership','Parish membership '+status,'','account',now()))
        history(c,user,pid,'membership.'+status,{'user':target,'person':person_id})
        return {'ok':True}
    if path=='/api/workspace/suspension' and method=='POST':
        scope=q.get('scope','parish')
        require(scope in {'parish','global'},'Invalid suspension scope.')
        require(is_super_admin(c,user) if scope=='global' else manager in manage,'Account management is outside your scope.',403)
        target=q.get('userId')
        require(target!=user['id'],'You cannot deactivate your own account here.')
        target_user=c.execute('SELECT * FROM users WHERE id=?',(target,)).fetchone()
        require(target_user,'User not found.',404)
        if scope == 'global':
            require(q.get('_recentAuthentication') is True, 'Confirm your current password to deactivate an account globally.', 403)
            if q.get('active') is True:
                administration.protect_last_super_admin(c, target_user, require)
        if not is_super_admin(c,user):
            require(c.execute("SELECT 1 FROM assignments WHERE user_id=? AND parish_id=? UNION SELECT 1 FROM pl_affiliations WHERE user_id=? AND parish_id=? UNION SELECT 1 FROM pl_grants WHERE user_id=? AND scope_type='parish' AND scope_id=? AND active=1",(target,pid,target,pid,target,pid)).fetchone(),'User is outside your parish.',403)
            require(target_user['role'] not in {'super_admin','bishop','diocesan_admin'},'This account requires a higher authority.',403)
            previous=c.execute("SELECT actor_id FROM pl_suspensions WHERE user_id=? AND scope_id=? AND active=1",(target,pid)).fetchone()
            if previous and q.get('active') is False:
                actor=c.execute('SELECT * FROM users WHERE id=?',(previous['actor_id'],)).fetchone()
                rank={'super_admin':5,'bishop':4,'diocesan_admin':3,'priest':2,'parish_admin':1}
                last=c.execute("SELECT detail FROM pl_history WHERE scope_id=? AND action='account.deactivated' AND json_extract(detail,'$.user')=? ORDER BY created_at DESC LIMIT 1",(pid,target)).fetchone()
                actor_role=json.loads(last['detail']).get('actorRole') if last else None
                require(rank.get(manager,0)>=rank.get(actor_role or authority(c,actor,pid),0),'The authority that deactivated this account must approve its reactivation.',403)
        active=q.get('active')
        require(isinstance(active,bool),'Specify deactivate or reactivate.')
        if active and scope=='parish' and not is_super_admin(c,user):
            rank={'super_admin':5,'bishop':4,'diocesan_admin':3,'priest':2,'parish_admin':1}
            require(rank.get(manager,0)>rank.get(authority(c,target_user,pid),0),'This account requires a higher authority.',403)
        if not active and scope=='parish':
            require(not suspended(c,target),'A global deactivation can only be lifted by a super administrator.',403)
        reason=str(q.get('reason') or '').strip()
        require(3<=len(reason)<=500,'Record a reason.')
        scope_id='*' if scope=='global' else pid
        c.execute('INSERT INTO pl_suspensions VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,scope_id) DO UPDATE SET active=excluded.active,reason=excluded.reason,actor_id=excluded.actor_id,updated_at=excluded.updated_at',
                  (target,scope_id,int(active),reason,user['id'],now()))
        if scope=='global' and active:
            c.execute('DELETE FROM sessions WHERE user_id=?',(target,))
        history(c,user,scope_id,'account.deactivated' if active else 'account.reactivated',{'user':target,'reason':reason,'actorRole':'super_admin' if scope=='global' else manager})
        return {'ok':True}
    if path=='/api/workspace/clergy-title' and method=='POST':
        require(is_super_admin(c,user) or user['role']=='bishop','Bishop or Super Admin authority required.',403)
        target=c.execute('SELECT * FROM users WHERE id=?',(q.get('userId'),)).fetchone()
        belongs=target and (target['diocese']==user['diocese'] or target['diocese']=='pl-platform' and c.execute("SELECT 1 FROM pl_affiliations a JOIN parishes p ON p.id=a.parish_id WHERE a.user_id=? AND a.membership='approved' AND p.diocese=?",(target['id'],user['diocese'])).fetchone())
        require(target and (is_super_admin(c,user) or belongs),'Choose clergy within your archdiocese.',403)
        if target['diocese']=='pl-platform' and not is_super_admin(c,user): c.execute('UPDATE users SET diocese=? WHERE id=?',(user['diocese'],target['id']))
        title=q.get('title')
        require(title in {'Deacon','Priest','Monsignor','Archimandrite'},'Choose a clergy title.')
        if title=='Deacon':
            active_priest=c.execute("SELECT 1 FROM pl_grants WHERE user_id=? AND role='priest' AND active=1 UNION SELECT 1 FROM assignments a JOIN users u ON u.id=a.user_id WHERE u.id=? AND u.role='priest' AND NOT EXISTS (SELECT 1 FROM pl_grants g WHERE g.user_id=u.id AND g.scope_type='parish' AND g.scope_id=a.parish_id AND g.role='priest' AND g.active=0)",(target['id'],target['id'])).fetchone()
            require(not active_priest,'Revoke active priest assignments before changing the title to Deacon. Historical activity will remain.',409)
        c.execute('INSERT INTO pl_clergy_titles VALUES(?,?,?,?)',(target['id'],title,user['id'],now()))
        title_scope = ('*' if target['diocese']=='pl-platform' else target['diocese']) if is_super_admin(c,user) else user['diocese']
        history(c,user,title_scope,'clergy.title.changed',{'user':target['id'],'title':title})
        return {'ok':True}
    if path=='/api/workspace/plans' and method=='POST':
        pids=q.get('parishes')
        require(isinstance(pids,list) and 1<=len(pids)<=100 and len(pids)==len(set(pids)),'Choose one or more parishes.')
        reference=str(q.get('arrangement') or '').strip()
        require(2<=len(reference)<=100,'Name the shared arrangement.')
        dioceses=set()
        for target in pids:
            require(authority(c,user,target) in {'super_admin','bishop','diocesan_admin'},'Shared arrangements require diocesan authority for each parish.',403)
            dioceses.add(c.execute('SELECT diocese FROM parishes WHERE id=?',(target,)).fetchone()['diocese'])
        require(len(dioceses)==1,'A shared diocesan arrangement must stay within one diocese.')
        for target in pids:admin_handle(c,user,'/api/workspace/plan','POST',{**q,'parish':target,'sponsor':'diocese'},require)
        return {'ok':True,'count':len(pids)}
    if path=='/api/workspace/plan' and method in {'GET','POST'}:
        require(manager in manage,'Plan management is outside your scope.',403)
        row=c.execute('SELECT data FROM pl_plans WHERE parish_id=?',(pid,)).fetchone()
        plan=json.loads(row['data']) if row else {'bundle':'complete','sponsor':'parish','modules':['office','requests','sacraments','ministries','facilities','finance'],'billing':'manual'}
        if method=='GET':
            return plan
        bundle=q.get('bundle')
        require(bundle in {'presence','office','community','complete'},'Choose a bundle.')
        if plan.get('sponsor')=='diocese' and manager in {'priest','parish_admin'}:
            plan['requestedBundle']=bundle
        else:
            require(manager!='parish_admin','A priest or diocesan authority must activate a bundle.',403)
            plan.update(bundle=bundle,modules={'presence':[],'office':['office','requests','sacraments'],'community':['office','requests','ministries','facilities'],'complete':['office','requests','sacraments','ministries','facilities','finance']}[bundle])
            plan.pop('requestedBundle',None)
            if manager in {'super_admin','bishop','diocesan_admin'} and q.get('sponsor') in {'parish','diocese'}:
                plan['sponsor']=q['sponsor']
        if manager in {'super_admin','bishop','diocesan_admin'} and 'arrangement' in q:
            plan['arrangement']=str(q['arrangement']).strip()[:100]
        plan['billing']='manual'
        if not (plan.get('sponsor')=='diocese' and manager in {'priest','parish_admin'}):
            plan['publicRequests']=bool(q.get('publicRequests',plan.get('publicRequests',True)))
        c.execute('INSERT INTO pl_plans VALUES(?,?,?) ON CONFLICT(parish_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',(pid,json.dumps(plan),now()))
        history(c,user,pid,'plan.updated',plan)
        return {'ok':True,**plan}
    return None


def create_staff(c,user,q,hash_password,require):
    pid,did=q.get('parish'),q.get('diocese')
    if pid:
        parish=c.execute('SELECT diocese FROM parishes WHERE id=?',(pid,)).fetchone()
        require(parish,'Choose a parish.')
        did=parish['diocese']
    auth=authority(c,user,pid,did)
    require(auth in {'super_admin','bishop','diocesan_admin','priest','parish_admin'},'Account creation is outside your scope.',403)
    role=q.get('role')
    from .administration import permitted_roles, write_grant
    permitted={'member'} | set(permitted_roles(c,user,'parish',pid) if pid else [])
    if auth in {'super_admin','bishop'}:
        permitted.add('diocesan_admin')
    if is_super_admin(c,user):
        permitted.add('bishop')
    if auth in {'super_admin','bishop'}:
        permitted.add('priest')
    permitted.discard('super_admin')
    permitted.discard('clergy_assigner')
    require(role in permitted,'You cannot create this role.',403)
    username,name=[str(q.get(k) or '').strip() for k in ('username','name')]
    require(re.fullmatch(r'[A-Za-z0-9_.-]{3,80}',username),'Use a username of 3–80 letters, numbers, dots, underscores or dashes.')
    require(2<=len(name)<=120,'Enter a full name.')
    password=q.get('password')
    require(isinstance(password,str) and 12<=len(password)<=200,'Use a temporary password of at least 12 characters.')
    require(not c.execute('SELECT 1 FROM users WHERE username=?',(username,)).fetchone(),'Username is already in use.',409)
    require(c.execute('SELECT 1 FROM dioceses WHERE id=?',(did,)).fetchone(),'Choose a diocese.')
    require(role in {'bishop','diocesan_admin'} or pid,'Choose a parish for this role.')
    person_id=q.get('personId') or None
    if person_id:
        require(pid, 'Choose a parish before linking a person record.')
        state=json.loads(c.execute('SELECT data FROM states WHERE parish_id=?',(pid,)).fetchone()['data'])
        require(any(p['id']==person_id for p in state['PEOPLE']),'Choose a person in this parish.')
        require(not c.execute("SELECT 1 FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? UNION SELECT 1 FROM pl_affiliations WHERE parish_id=? AND person_id=? AND membership='approved'",(pid,person_id,pid,person_id)).fetchone(),'This person already has an account. Assign a role to the existing account.',409)
    require(role not in {'leader','priest'} or person_id,'Link this role to its person record.')
    uid='u-'+secrets.token_hex(12)
    # New scoped staff retain an ordinary account identity; authority lives in
    # grants. Keep legacy clergy identity for established appointment workflows.
    base_role = role if role in {'bishop','priest','member'} else 'member'
    c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',(uid,username,name,base_role,did,person_id,hash_password(password)))
    if pid:
        c.execute('INSERT INTO assignments VALUES(?,?)',(uid,pid))
    if role=='diocesan_admin':
        write_grant(c,user,uid,role,'diocese',did,True)
    elif role not in {'bishop','member'}:
        write_grant(c,user,uid,role,'parish',pid,True)
    history(c,user,pid or did,'account.created.by-office',{'user':uid,'role':role})
    return {'id':uid,'username':username}


def handle(c, user, path, method, q, require):
    """Return None for routes belonging to the established server."""
    from .site_content import handle as site_content
    result = site_content(c, user, path, method, q, require)
    if result is not None:
        return result
    if path == '/api/public/auth-options' and method == 'GET':
        return {'providers': [{'id': p, 'available': False} for p in ('google','apple','microsoft')],
                'verification': {'email': False, 'sms': False, 'authenticator': False}}
    if path == '/api/public/guest-requests' and method == 'POST':
        pid = q.get('parish')
        require(c.execute('SELECT 1 FROM parishes WHERE id=?', (pid,)).fetchone(), 'Choose a parish.')
        require(parish_plan(c,pid).get('publicRequests',True),'Please contact the parish office to make a request.',403)
        name, email, phone = [str(q.get(k) or '').strip() for k in ('name','email','phone')]
        require(2 <= len(name) <= 120, 'Enter your name.')
        require(bool(email or phone), 'Provide a phone number or email for the parish office.')
        require(not email or EMAIL.fullmatch(email), 'Enter a valid email address.')
        require(not phone or re.fullmatch(r'[\d +().-]{6,40}', phone), 'Enter a valid phone number.')
        require(q.get('responsibleAdult') is True, 'A responsible adult must submit and handle this request.')
        require(q.get('kind') in {'certificate','baptism','communion','confirmation','marriage','funeral','booking','custom','appointment','ministry'},
                'Choose a request type.')
        description = str(q.get('description') or '').strip()
        require(5 <= len(description) <= 4000, 'Describe your request (5–4000 characters).')
        require(c.execute("SELECT COUNT(*) FROM pl_guest_requests WHERE parish_id=? AND created_at>?",(pid,(dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=1)).isoformat())).fetchone()[0]<100,'The parish has received too many requests recently. Please try again later.',429)
        token, rid, stamp = secrets.token_urlsafe(32), 'guest-'+secrets.token_hex(10), now()
        details = dict(name=name,email=email,phone=phone,kind=q['kind'],description=description,
                       behalf=str(q.get('behalf') or '')[:120],delivery=q.get('delivery','collection'))
        c.execute('INSERT INTO pl_guest_requests VALUES(?,?,?,?,?,?,?,?)',
                  (rid,pid,hashlib.sha256(token.encode()).hexdigest(),json.dumps(details),'submitted','',stamp,stamp))
        return {'id':rid, 'trackingToken':token, 'status':'submitted'}
    if path.startswith('/api/public/track/') and method == 'GET':
        token = path.rsplit('/',1)[-1]
        row = c.execute('SELECT id,status,response,updated_at FROM pl_guest_requests WHERE token_hash=?',
                        (hashlib.sha256(token.encode()).hexdigest(),)).fetchone()
        require(row is not None, 'Tracking link not found.', 404)
        return {**dict(row),'files':[dict(f) for f in c.execute('SELECT f.id,f.name FROM pl_guest_releases r JOIN uploaded_files f ON f.id=r.file_id WHERE r.request_id=?',(row['id'],))] if row['status'] in {'ready-for-download','closed'} else []}
    if user is None:
        return None
    if path=='/api/workspace/release-document' and method=='POST':
        from .guest_delivery import release
        return release(c,user,q,require)
    from .guest_links import handle as guest_links
    result=guest_links(c,user,path,method,q,require)
    if result is not None: return result
    from .profile_services import handle as profile_services
    result=profile_services(c,user,path,method,q,require)
    if result is not None:
        return result
    from .account_services import handle as account_services
    result=account_services(c,user,path,method,q,require)
    if result is not None:
        return result
    from .ministry import handle as ministry_handle
    result=ministry_handle(c,user,path,method,q,require)
    if result is not None:
        return result
    result=inbox(c,user,path,method,q,require)
    if result is not None:
        return result
    result=admin_handle(c,user,path,method,q,require)
    if result is not None:
        return result
    if path == '/api/account' and method == 'GET':
        result = account(c, user)
        result.update(session_data(c,user))
        result['identities'] = [dict(r) for r in c.execute('SELECT kind,value,verified_at FROM pl_identities WHERE user_id=?',(user['id'],))]
        return result
    if path == '/api/account' and method == 'PUT':
        data = account(c,user)
        if 'theme' in q:
            theme = q['theme']
            require(isinstance(theme,dict) and theme.get('mode') in {'light','dark'}, 'Choose light or dark mode.')
            require(theme.get('scheme') in {'forest','navy','marian','burgundy','purple','teal','cedar','slate','custom'}, 'Choose a palette.')
            require(theme.get('scheme') != 'custom' or re.fullmatch(r'#[0-9a-fA-F]{6}',str(theme.get('primary',''))), 'Choose a valid colour.')
            data['theme'] = {k:theme[k] for k in ('scheme','mode','primary') if k in theme}
        if 'profile' in q:
            profile = q['profile']
            require(isinstance(profile,dict), 'Invalid profile.')
            editable = {'firstName','lastName','town','address','occupation','language','about'}
            data.setdefault('profile',{}).update({k:str(v).strip()[:500] for k,v in profile.items() if k in editable})
            data['profileComplete'] = bool(data['profile'].get('firstName') and data['profile'].get('lastName'))
        c.execute('INSERT INTO pl_accounts VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data',
                  (user['id'],json.dumps(data),now()))
        return {'ok':True, **data}
    if path == '/api/account/parishes' and method == 'POST':
        pid, action = q.get('parish'), q.get('action')
        require(c.execute('SELECT 1 FROM parishes WHERE id=?',(pid,)).fetchone(), 'Parish not found.',404)
        require(action in {'follow','unfollow','primary','request'}, 'Invalid parish action.')
        require(not suspended(c,user['id'],pid), 'Your access to this parish is inactive.',403)
        old = c.execute('SELECT * FROM pl_affiliations WHERE user_id=? AND parish_id=?',(user['id'],pid)).fetchone()
        following, membership, primary = (old['following'],old['membership'],old['is_primary']) if old else (1,'none',int(not c.execute('SELECT 1 FROM pl_affiliations WHERE user_id=? AND is_primary=1',(user['id'],)).fetchone()))
        if action=='unfollow':
            require(not primary, 'Choose a different primary parish before unfollowing.')
            following=0
        else:
            following=1
        if action=='primary':
            c.execute('UPDATE pl_affiliations SET is_primary=0 WHERE user_id=?',(user['id'],))
            primary=1
        if action=='request':
            require(membership not in {'pending','approved'}, 'A membership request already exists.')
            membership='pending'
        c.execute('INSERT INTO pl_affiliations VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,parish_id) DO UPDATE SET following=excluded.following,membership=excluded.membership,is_primary=excluded.is_primary,updated_at=excluded.updated_at',
                  (user['id'],pid,following,membership,old['person_id'] if old else None,primary,now()))
        if action=='request':
            for target in c.execute('SELECT * FROM users'):
                ctx=parish_context(c,target,pid)
                if ctx and is_office(ctx): c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',(secrets.token_hex(12),pid,target['id'],'membership','Parish membership awaiting review','','membershipreviews',now()))
        history(c,user,pid,'parish.'+action,{})
        return {'ok':True}
    if path == '/api/workspace' and method == 'GET':
        snapshot = authorization_snapshot(c,user)
        rows = snapshot['parishes'].values()
        managed = [{**r,'metadata':json.loads(r['metadata']),'authority':authority(c,user,r['id'],snapshot=snapshot)} for r in rows if authority(c,user,r['id'],snapshot=snapshot)]
        diocese_ids = {r['diocese'] for r in managed}
        dioceses = [{**dict(r),'authority':authority(c,user,diocese=r['id'],snapshot=snapshot)} for r in c.execute("SELECT * FROM dioceses WHERE id<>'pl-platform'")
                    if authority(c,user,diocese=r['id'],snapshot=snapshot) in {'super_admin','bishop','diocesan_admin'} or r['id'] in diocese_ids]
        return {'parishes':managed,'dioceses':dioceses,'canCreateDiocese':is_super_admin(c,user),'isSuperAdmin':is_super_admin(c,user)}
    if path == '/api/workspace/dioceses' and method == 'POST':
        require(is_super_admin(c,user),'Only the super administrator creates dioceses.',403)
        name=str(q.get('name') or '').strip()
        require(2<=len(name)<=120,'Enter a diocese name.')
        did='diocese-'+secrets.token_hex(8)
        c.execute('INSERT INTO dioceses VALUES(?,?)',(did,name))
        history(c,user,did,'diocese.created',{'name':name})
        return {'id':did}
    if path == '/api/workspace/request-counts' and method == 'GET':
        pid=q.get('parish');require(office_access(c,user,pid),'Office access required.',403)
        return {'membershipreviews':c.execute("SELECT COUNT(*) FROM pl_affiliations WHERE parish_id=? AND membership='pending'",(pid,)).fetchone()[0],
                'profilereviews':c.execute("SELECT COUNT(*) FROM pl_profile_reviews WHERE parish_id=? AND status='pending'",(pid,)).fetchone()[0],
                'guestrequests':c.execute("SELECT COUNT(*) FROM pl_guest_requests WHERE parish_id=? AND status NOT IN ('closed','ready-for-collection','ready-for-download')",(pid,)).fetchone()[0]}
    if path == '/api/workspace/guest-requests' and method == 'GET':
        pid=q.get('parish')
        require(office_access(c,user,pid),'Office access required.',403)
        return {'requests':[{**dict(r),'details':json.loads(r['details'])} for r in c.execute(
            "SELECT id,details,status,response,created_at,updated_at,(SELECT COUNT(*) FROM pl_guest_links l WHERE l.request_id=g.id AND l.status='pending') AS pendingLinks FROM pl_guest_requests g WHERE parish_id=? ORDER BY created_at DESC",(pid,))]}
    if path == '/api/workspace/guest-requests' and method == 'POST':
        row=c.execute('SELECT * FROM pl_guest_requests WHERE id=?',(q.get('id'),)).fetchone()
        require(row is not None,'Request not found.',404)
        pid=row['parish_id']
        require(office_access(c,user,pid),'Office access required.',403)
        status=q.get('status')
        require(status in {'submitted','office-review','missing-documents','ready-for-collection','ready-for-download','closed'}, 'Choose a request status.')
        if status=='ready-for-download':
            require(c.execute('SELECT 1 FROM pl_guest_releases r JOIN uploaded_files f ON f.id=r.file_id WHERE r.request_id=?',(row['id'],)).fetchone(),'Release a reviewed document before marking this request ready for download.')
        response=str(q.get('response') or '')[:2000]
        c.execute('UPDATE pl_guest_requests SET status=?,response=?,updated_at=? WHERE id=?',(status,response,now(),row['id']))
        history(c,user,pid,'guest-request.updated',{'id':row['id'],'status':status})
        return {'ok':True}
    return None
