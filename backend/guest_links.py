"""A tracking link can be associated with an account only after office review."""
import hashlib
import json
import secrets
from . import workspace as w


def handle(c,u,path,method,q,require):
    if path not in {'/api/account/guest-requests','/api/workspace/guest-links'}: return None
    office=path.startswith('/api/workspace/')
    if method=='GET' and not office:
        rows=[]
        for r in c.execute('SELECT l.*,g.status AS request_status,g.response,g.details,g.parish_id,p.metadata FROM pl_guest_links l JOIN pl_guest_requests g ON g.id=l.request_id JOIN parishes p ON p.id=g.parish_id WHERE l.user_id=? ORDER BY l.created_at DESC',(u['id'],)):
            if w.suspended(c,u['id'],r['parish_id']):continue
            row=dict(requestId=r['request_id'],parishName=json.loads(r['metadata'])['name'],status=r['status'])
            if r['status']=='approved':
                row.update(requestStatus=r['request_status'],response=r['response'],details=json.loads(r['details']),files=[])
                if r['request_status'] in {'ready-for-download','closed'}: row['files']=[dict(f) for f in c.execute('SELECT f.id,f.name FROM pl_guest_releases r JOIN uploaded_files f ON f.id=r.file_id WHERE r.request_id=?',(r['request_id'],))]
            rows.append(row)
        return {'requests':rows}
    if office:
        pid=q.get('parish');require(w.office_access(c,u,pid),'Parish office access required.',403)
        if method=='GET':
            return {'links':[dict(r) for r in c.execute('SELECT l.*,u.name,u.username FROM pl_guest_links l JOIN pl_guest_requests g ON g.id=l.request_id JOIN users u ON u.id=l.user_id WHERE g.parish_id=? AND g.id=? ORDER BY l.created_at DESC',(pid,q.get('id')))]}
        require(method=='POST' and q.get('status') in {'approved','declined'},'Choose approve or decline.')
        row=c.execute("SELECT l.* FROM pl_guest_links l JOIN pl_guest_requests g ON g.id=l.request_id WHERE l.request_id=? AND l.user_id=? AND g.parish_id=? AND l.status='pending'",(q.get('id'),q.get('userId'),pid)).fetchone()
        require(row,'Pending account link not found.',409)
        if q['status']=='approved':
            require(q.get('verified') is True,'Confirm that the account belongs to the applicant.')
            require(not c.execute("SELECT 1 FROM pl_guest_links WHERE request_id=? AND status='approved'",(row['request_id'],)).fetchone(),'This request is already linked to an account.',409)
        c.execute('UPDATE pl_guest_links SET status=?,reviewed_by=?,reviewed_at=? WHERE request_id=? AND user_id=?',(q['status'],u['id'],w.now(),row['request_id'],row['user_id']))
        c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',(secrets.token_hex(12),pid,row['user_id'],'guest-link','Guest request account link '+q['status'],'Open My account to view the outcome.','account',w.now()))
        w.history(c,u,pid,'guest.account-link.'+q['status'],{'request':row['request_id'],'user':row['user_id']})
        return {'ok':True}
    require(method=='POST','Method not allowed.',405)
    token=str(q.get('token') or '').strip()
    row=c.execute('SELECT id,parish_id FROM pl_guest_requests WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),)).fetchone()
    require(row,'Tracking link not found.',404)
    require(not w.suspended(c,u['id'],row['parish_id']),'Your access to this parish is inactive.',403)
    require(not c.execute("SELECT 1 FROM pl_guest_links WHERE request_id=? AND (status='approved' OR user_id=?)",(row['id'],u['id'])).fetchone(),'This link already has an account or a review request.',409)
    c.execute('INSERT INTO pl_guest_links VALUES(?,?,?,?,NULL,NULL)',(row['id'],u['id'],'pending',w.now()))
    for target in c.execute('SELECT * FROM users'):
        context=w.parish_context(c,target,row['parish_id'])
        if context and w.is_office(context):
            c.execute('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',(secrets.token_hex(12),row['parish_id'],target['id'],'guest-link','Guest request account link awaiting review','','guestrequests',w.now()))
    w.history(c,u,row['parish_id'],'guest.account-link.requested',{'request':row['id']})
    return {'ok':True}


def account_file(c,u,request_id,file_id,require):
    row=c.execute("SELECT f.* FROM uploaded_files f JOIN pl_guest_releases r ON r.file_id=f.id JOIN pl_guest_requests g ON g.id=r.request_id JOIN pl_guest_links l ON l.request_id=g.id WHERE l.user_id=? AND l.status='approved' AND g.id=? AND f.id=? AND g.status IN ('ready-for-download','closed')",(u['id'],request_id,file_id)).fetchone()
    require(row and not w.suspended(c,u['id'],row['parish_id']),'Document is not available for this account.',404)
    return row
