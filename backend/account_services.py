import datetime as dt
import hashlib
import json
import secrets
from . import workspace as w


def handle(c,u,path,method,q,require):
    if path=='/api/account/activity' and method=='GET':
        parishes,events=[],[]
        for p in c.execute('SELECT p.id,p.metadata,s.data FROM parishes p JOIN states s ON s.parish_id=p.id'):
            context=w.parish_context(c,u,p['id'])
            followed=c.execute('SELECT 1 FROM pl_affiliations WHERE user_id=? AND parish_id=? AND following=1',(u['id'],p['id'])).fetchone()
            if w.suspended(c,u['id'],p['id']) or not(context or followed): continue
            meta=json.loads(p['metadata']);parishes.append({'id':p['id'],'name':meta['name']})
            state=json.loads(p['data'])
            for e in state['EVENTS']:
                detail=state.get('EVENT_DETAIL',{}).get(e['id'],{})
                # Private calendars remain in their authorized ministry/parish views.
                if e.get('kind')=='pending' or not (detail.get('visibility')=='public' or not detail and e.get('kind') in {'mass','event'}):continue
                events.append(dict(id=p['id']+':'+e['id'],parish=p['id'],title=e['title'],titleAr=e.get('titleAr',''),date=e['d'],time=e.get('t',''),subtitle=meta['name']))
        notices=[dict(r) for r in c.execute('SELECT id,parish_id,title,body,route,created_at,read_at FROM member_notifications WHERE user_id=? ORDER BY created_at DESC',(u['id'],))]
        return {'parishes':parishes,'events':events,'notifications':notices}
    if path=='/api/workspace/invitations' and method=='POST':
        pid=q.get('parish');context=w.parish_context(c,u,pid)
        require(context and w.is_office(context),'Parish office access required.',403)
        state=json.loads(c.execute('SELECT data FROM states WHERE parish_id=?',(pid,)).fetchone()['data'])
        person=next((p for p in state['PEOPLE'] if p['id']==q.get('personId')),None)
        require(person,'Choose a person in this parish.')
        linked=c.execute("SELECT 1 FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? UNION SELECT 1 FROM pl_affiliations WHERE parish_id=? AND person_id=? AND membership='approved'",(pid,person['id'],pid,person['id'])).fetchone()
        require(not linked,'This person already has a linked account. Use the existing account.',409)
        token=secrets.token_urlsafe(32);rid=secrets.token_hex(12)
        expires=(dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=7)).isoformat()
        c.execute('UPDATE pl_invitations SET revoked=1 WHERE parish_id=? AND person_id=? AND claimed_by IS NULL',(pid,person['id']))
        c.execute('INSERT INTO pl_invitations VALUES(?,?,?,?,?,?,NULL,0)',(rid,pid,person['id'],hashlib.sha256(token.encode()).hexdigest(),u['id'],expires))
        w.history(c,u,pid,'account.invitation.created',{'id':rid,'person':person['id']})
        return {'token':token,'expires':expires,'delivery':'manual'}
    if path=='/api/account/claim-invitation' and method=='POST':
        token=str(q.get('token') or '')
        row=c.execute('SELECT * FROM pl_invitations WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),)).fetchone()
        require(row and not row['revoked'] and row['claimed_by'] is None and row['expires_at']>w.now(),'This invitation has expired or was already used.',410)
        pid,person=row['parish_id'],row['person_id']
        require(w.office_access(c, {'id': row['created_by']}, pid), 'The inviting office no longer has authority. Request a new invitation.', 410)
        state = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()['data'])
        require(any(record['id'] == person for record in state['PEOPLE']), 'This person record is no longer active. Contact the parish office.', 410)
        require(not w.suspended(c,u['id'],pid),'Your parish access is inactive.',403)
        linked=c.execute("SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? AND u.id<>? UNION SELECT user_id FROM pl_affiliations WHERE parish_id=? AND person_id=? AND membership='approved' AND user_id<>?",(pid,person,u['id'],pid,person,u['id'])).fetchone()
        require(not linked,'This person is linked to another account. Contact the parish office.',409)
        existing=c.execute('SELECT person_id FROM pl_affiliations WHERE user_id=? AND parish_id=?',(u['id'],pid)).fetchone()
        require(not existing or not existing['person_id'] or existing['person_id']==person,'Your account already has a different person record in this parish.',409)
        legacy=c.execute('SELECT u.person_id FROM users u JOIN assignments a ON a.user_id=u.id WHERE u.id=? AND a.parish_id=?',(u['id'],pid)).fetchone()
        require(not legacy or not legacy['person_id'] or legacy['person_id']==person,'Your account already has a different person record in this parish.',409)
        primary=not c.execute('SELECT 1 FROM pl_affiliations WHERE user_id=? AND is_primary=1',(u['id'],)).fetchone()
        c.execute("INSERT INTO pl_affiliations VALUES(?,?,1,'approved',?,?,?) ON CONFLICT(user_id,parish_id) DO UPDATE SET following=1,membership='approved',person_id=excluded.person_id,updated_at=excluded.updated_at",(u['id'],pid,person,int(primary),w.now()))
        c.execute('UPDATE pl_invitations SET claimed_by=? WHERE id=?',(u['id'],row['id']))
        w.history(c,u,pid,'account.invitation.accepted',{'id':row['id']})
        return {'ok':True,'parish':pid}
    return None
