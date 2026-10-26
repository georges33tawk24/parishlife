import { isOffice } from './workspace.js';
import { need,sha256hex,NOW } from './py.js';
import { parishContext,history } from './workspace.js';

export async function publicGuestFile(c,token,fileId){
  const row=await c.first("SELECT f.* FROM uploaded_files f JOIN pl_guest_releases r ON r.file_id=f.id JOIN pl_guest_requests g ON g.id=r.request_id WHERE g.token_hash=? AND f.id=? AND g.status IN ('ready-for-download','closed')",sha256hex(token),fileId);
  need(row,'Document is not available through this tracking link.',404);return row;
}
export async function releaseGuestDocument(c,u,q){
  const row=await c.first('SELECT * FROM pl_guest_requests WHERE id=?',q.id);need(row,'Request not found.',404);
  const pid=row.parish_id,context=await parishContext(c,u,pid);
  need(context&&isOffice(context),'The parish office must review a document before releasing it.',403);
  const file=await c.first("SELECT * FROM uploaded_files WHERE id=? AND parish_id=? AND scope='guest-request' AND owner_id=?",q.fileId,pid,row.id);
  need(file,'Choose a file attached to this request.');need(q.verified===true,'Confirm the applicant’s identity and that this is the correct document.');
  const details=JSON.parse(row.details);
  if(details.kind==='certificate'){
    const state=JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?',pid)).data),record=state.SACRAMENTS.find(r=>r.id===q.recordId);
    need(record?.kind==='certificate'&&record.status==='issued','Choose the signed, issued certificate for this applicant.');
    need(!record.bishopReview||record.bishopReview==='accepted','The signed certificate is awaiting bishop acceptance.');details.recordId=record.id;
  }
  c.run('INSERT OR IGNORE INTO pl_guest_releases VALUES(?,?,?,?)',row.id,file.id,u.id,NOW());
  c.run("UPDATE pl_guest_requests SET status='ready-for-download',details=?,updated_at=? WHERE id=?",JSON.stringify(details),NOW(),row.id);
  history(c,u,pid,'guest.document.released',{request:row.id,file:file.id});return {ok:true};
}
