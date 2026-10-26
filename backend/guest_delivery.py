import hashlib
import json
from . import workspace as w


def public_file(c,token,file_id,require):
    row=c.execute("SELECT f.* FROM uploaded_files f JOIN pl_guest_releases r ON r.file_id=f.id JOIN pl_guest_requests g ON g.id=r.request_id WHERE g.token_hash=? AND f.id=? AND g.status IN ('ready-for-download','closed')",(hashlib.sha256(token.encode()).hexdigest(),file_id)).fetchone()
    require(row,'Document is not available through this tracking link.',404)
    return row


def release(c,u,q,require):
    row=c.execute('SELECT * FROM pl_guest_requests WHERE id=?',(q.get('id'),)).fetchone()
    require(row,'Request not found.',404)
    pid=row['parish_id'];context=w.parish_context(c,u,pid)
    require(context and w.is_office(context),'The parish office must review a document before releasing it.',403)
    file=c.execute("SELECT * FROM uploaded_files WHERE id=? AND parish_id=? AND scope='guest-request' AND owner_id=?",(q.get('fileId'),pid,row['id'])).fetchone()
    require(file,'Choose a file attached to this request.')
    require(q.get('verified') is True,'Confirm the applicant’s identity and that this is the correct document.')
    details=json.loads(row['details'])
    if details['kind']=='certificate':
        state=json.loads(c.execute('SELECT data FROM states WHERE parish_id=?',(pid,)).fetchone()['data'])
        record=next((r for r in state['SACRAMENTS'] if r['id']==q.get('recordId')),None)
        require(record and record.get('kind')=='certificate' and record.get('status')=='issued','Choose the signed, issued certificate for this applicant.')
        require(record.get('bishopReview') in {None,'accepted'},'The signed certificate is awaiting bishop acceptance.')
        details['recordId']=record['id']
    c.execute('INSERT OR IGNORE INTO pl_guest_releases VALUES(?,?,?,?)',(row['id'],file['id'],u['id'],w.now()))
    c.execute("UPDATE pl_guest_requests SET status='ready-for-download',details=?,updated_at=? WHERE id=?",(json.dumps(details),w.now(),row['id']))
    w.history(c,u,pid,'guest.document.released',{'request':row['id'],'file':file['id']})
    return {'ok':True}
