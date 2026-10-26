"""Ministry applications and private departures, separate from parish membership."""
import json
import secrets
from . import workspace as w

OPEN = {'requested', 'awaiting-priest', 'withdrawal-requested', 'leave-requested'}


def notify(c, pid, uid, title, body):
    c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',
              (secrets.token_hex(12), pid, uid, 'ministry', title, body, 'ministryrequests', w.now()))


def handle(c, user, path, method, q, require):
    if path != '/api/ministry-requests':
        return None
    catalog, contexts, states = [], {}, {}
    for parish in c.execute('SELECT p.id,p.diocese,p.metadata,s.data,s.revision FROM parishes p JOIN states s ON s.parish_id=p.id'):
        pid = parish['id']
        context = w.parish_context(c, user, pid)
        following = c.execute('SELECT 1 FROM pl_affiliations WHERE user_id=? AND parish_id=? AND following=1', (user['id'],pid)).fetchone()
        if w.suspended(c,user['id'],pid) or not (context or following):
            continue
        contexts[pid] = context
        state = json.loads(parish['data'])
        states[pid] = (parish, state)
        for group in state.get('GROUPS', []):
            details = state.get('GROUP_DETAIL', {}).get(group['id'], {})
            person = context['person_id'] if context else None
            belongs = bool(person and any(r['p']==person for r in details.get('roster',[])))
            leader = bool(context and person and person in {group.get('leader'),group.get('assistant')})
            priest = bool(context and context['role']=='priest')
            if group.get('vis','public') != 'public' and not (belongs or leader or priest):
                continue
            catalog.append(dict(id=group['id'],name=group['name'],parish=pid,parishName=json.loads(parish['metadata'])['name'],
                                description=group.get('description',''),member=belongs,canReview=leader or priest,priest=priest))
    requests=[]
    for row in c.execute('SELECT r.*,u.name FROM pl_ministry_requests r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC'):
        group=next((g for g in catalog if g['id']==row['group_id'] and g['parish']==row['parish_id']),None)
        own=row['user_id']==user['id']
        review=bool(group and group['canReview'] and (row['kind']!='leave' or group['priest']))
        if own or review:
            requests.append({**dict(row),'own':own,'canReview':review,'priest':bool(group and group['priest']),
                             'groupName':group['name'] if group else row['group_id'],
                             'parishName':group['parishName'] if group else row['parish_id']})
    if method=='GET':
        return {'ministries':catalog,'requests':requests}
    require(method=='POST','Method not allowed.',405)
    action=q.get('action')
    stamp=w.now()
    if action in {'join','leave'}:
        pid,gid=q.get('parish'),q.get('group')
        group=next((g for g in catalog if g['id']==gid and g['parish']==pid),None)
        require(group,'Follow this parish first or request access from the office.',403)
        if action=='join':w.require_modules(c,pid,['GROUP_DETAIL'],require)
        require(group['member'] if action=='leave' else not group['member'], 'This membership has already changed. Reload the page.',409)
        require(not c.execute("SELECT 1 FROM pl_ministry_requests WHERE user_id=? AND parish_id=? AND group_id=? AND status IN ('requested','awaiting-priest','withdrawal-requested','leave-requested')",(user['id'],pid,gid)).fetchone(),'An open request already exists.',409)
        reason=str(q.get('reason') or '').strip()
        require(len(reason)<=2000,'Keep the note within 2,000 characters.')
        rid='ministry-'+secrets.token_hex(12)
        status='leave-requested' if action=='leave' else 'requested'
        c.execute('INSERT INTO pl_ministry_requests VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                  (rid,user['id'],pid,gid,action,status,reason,None,None,stamp,stamp))
        detail_group=next(g for g in states[pid][1]['GROUPS'] if g['id']==gid)
        for target in c.execute('SELECT * FROM users'):
            ctx=w.parish_context(c,target,pid)
            if target['id']!=user['id'] and ctx and (ctx['role']=='priest' or action=='join' and ctx['person_id'] and ctx['person_id'] in {detail_group.get('leader'),detail_group.get('assistant')}):
                notify(c,pid,target['id'],'Ministry request awaiting review',group['name'])
        # Departure reasons never enter a general parish audit or a leader inbox.
        w.history(c,user,pid,'ministry.request.created',{'id':rid})
        return {'id':rid,'status':status}
    row=next((r for r in requests if r['id']==q.get('id')),None)
    require(row,'Request not available.',404)
    require(row['updated_at']==q.get('version'),'The request changed. Reload before continuing.',409)
    require(row['status'] in OPEN,'This request is already complete.',409)
    pid,gid=row['parish_id'],row['group_id']
    require(pid in states,'Access to this parish is inactive.',403)
    status,leader_at,priest_at=row['status'],row['leader_at'],row['priest_at']
    if action=='withdraw':
        require(row['own'],'Only the applicant may withdraw a request.',403)
        status='withdrawn' if not leader_at and not priest_at else 'withdrawal-requested'
    else:
        require(action in {'approve','decline'} and row['canReview'] and not row['own'],'Approval is outside your authority.',403)
        if action=='decline':
            status='awaiting-priest' if status=='withdrawal-requested' else 'declined'
        elif status=='withdrawal-requested':
            status='withdrawn'
        elif row['kind']=='leave':
            require(row['priest'],'Only parish priests review departures.',403)
            status,priest_at='ended',stamp
        elif row['priest']:
            status,priest_at='approved',stamp
        else:
            require(status=='requested','This application is waiting for a priest.',409)
            status,leader_at='awaiting-priest',stamp
    if status in {'approved','ended'}:
        parish,state=states[pid]
        target=c.execute('SELECT * FROM users WHERE id=?',(row['user_id'],)).fetchone()
        target_context=w.parish_context(c,target,pid)
        person=target_context['person_id'] if target_context else None
        require(person and any(p['id']==person for p in state['PEOPLE']), 'The office must approve parish membership and link a person before completing this request.')
        detail=state.setdefault('GROUP_DETAIL',{}).setdefault(gid,{})
        roster=detail.setdefault('roster',[])
        if status=='approved' and not any(r['p']==person for r in roster):
            roster.append({'p':person,'role':'Member','since':stamp[:10]})
            c.execute('INSERT OR IGNORE INTO group_members VALUES(?,?,?)',(pid,gid,person))
        elif status=='ended':
            detail['roster']=[r for r in roster if r['p']!=person]
            c.execute('DELETE FROM group_members WHERE parish_id=? AND group_id=? AND person_id=?',(pid,gid,person))
        next(g for g in state['GROUPS'] if g['id']==gid)['members']=len(detail['roster'])
        c.execute('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',(json.dumps(state),pid))
    c.execute('UPDATE pl_ministry_requests SET status=?,leader_at=?,priest_at=?,updated_at=? WHERE id=?',
              (status,leader_at,priest_at,stamp,row['id']))
    notify(c,pid,row['user_id'],'Ministry membership update',row['groupName']+': '+status.replace('-',' '))
    if status in {'awaiting-priest','withdrawal-requested'}:
        for target in c.execute('SELECT * FROM users'):
            context=w.parish_context(c,target,pid)
            if target['id']!=row['user_id'] and context and context['role']=='priest':
                notify(c,pid,target['id'],'Ministry request awaiting your decision',row['groupName'])
    if status=='ended':
        # Priests and the diocesan bishop receive the outcome, never the reason.
        for target in c.execute('SELECT * FROM users'):
            if target['id']==row['user_id']: continue
            context=w.parish_context(c,target,pid)
            if context and context['role'] in {'priest','bishop'}:
                notify(c,pid,target['id'],'Membership ended',row['name']+' · '+row['groupName'])
    w.history(c,user,pid,'ministry.request.updated',{'id':row['id'],'status':status})
    return {'ok':True,'status':status}
