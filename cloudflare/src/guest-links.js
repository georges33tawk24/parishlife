import { isOffice } from './workspace.js';
import {need,NOW,sha256hex,tokenHex} from './py.js';
import {parishContext,suspended,history} from './workspace.js';

export async function guestLinks(c,u,path,method,q){
  if(!['/api/account/guest-requests','/api/workspace/guest-links'].includes(path))return null;
  const office=path.startsWith('/api/workspace/');
  if(method==='GET'&&!office){
    const requests=[];
    for(const r of await c.all('SELECT l.*,g.status AS request_status,g.response,g.details,g.parish_id,p.metadata FROM pl_guest_links l JOIN pl_guest_requests g ON g.id=l.request_id JOIN parishes p ON p.id=g.parish_id WHERE l.user_id=? ORDER BY l.created_at DESC',u.id)){
      if(await suspended(c,u.id,r.parish_id))continue;
      const row={requestId:r.request_id,parishName:JSON.parse(r.metadata).name,status:r.status};
      if(r.status==='approved'){Object.assign(row,{requestStatus:r.request_status,response:r.response,details:JSON.parse(r.details),files:[]});if(['ready-for-download','closed'].includes(r.request_status))row.files=await c.all('SELECT f.id,f.name FROM pl_guest_releases r JOIN uploaded_files f ON f.id=r.file_id WHERE r.request_id=?',r.request_id);}
      requests.push(row);
    }
    return {requests};
  }
  if(office){
    const pid=q.parish,context=await parishContext(c,u,pid);need(context&&['super_admin','bishop','diocesan_admin','parish_admin','priest','secretary'].includes(context.role),'Parish office access required.',403);
    if(method==='GET')return {links:await c.all('SELECT l.*,u.name,u.username FROM pl_guest_links l JOIN pl_guest_requests g ON g.id=l.request_id JOIN users u ON u.id=l.user_id WHERE g.parish_id=? AND g.id=? ORDER BY l.created_at DESC',pid,q.id)};
    need(method==='POST'&&['approved','declined'].includes(q.status),'Choose approve or decline.');
    const row=await c.first("SELECT l.* FROM pl_guest_links l JOIN pl_guest_requests g ON g.id=l.request_id WHERE l.request_id=? AND l.user_id=? AND g.parish_id=? AND l.status='pending'",q.id,q.userId,pid);need(row,'Pending account link not found.',409);
    if(q.status==='approved'){need(q.verified===true,'Confirm that the account belongs to the applicant.');need(!await c.first("SELECT 1 FROM pl_guest_links WHERE request_id=? AND status='approved'",row.request_id),'This request is already linked to an account.',409);}
    c.run('UPDATE pl_guest_links SET status=?,reviewed_by=?,reviewed_at=? WHERE request_id=? AND user_id=?',q.status,u.id,NOW(),row.request_id,row.user_id);
    c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',tokenHex(12),pid,row.user_id,'guest-link','Guest request account link '+q.status,'Open My account to view the outcome.','account',NOW());
    history(c,u,pid,'guest.account-link.'+q.status,{request:row.request_id,user:row.user_id});return {ok:true};
  }
  need(method==='POST','Method not allowed.',405);
  const row=await c.first('SELECT id,parish_id FROM pl_guest_requests WHERE token_hash=?',sha256hex(String(q.token||'').trim()));need(row,'Tracking link not found.',404);
  need(!await suspended(c,u.id,row.parish_id),'Your access to this parish is inactive.',403);
  need(!await c.first("SELECT 1 FROM pl_guest_links WHERE request_id=? AND (status='approved' OR user_id=?)",row.id,u.id),'This link already has an account or a review request.',409);
  c.run('INSERT INTO pl_guest_links VALUES(?,?,?,?,NULL,NULL)',row.id,u.id,'pending',NOW());
  for(const target of await c.all('SELECT * FROM users')){
    const context=await parishContext(c,target,row.parish_id);
    if(context&&isOffice(context))c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',tokenHex(12),row.parish_id,target.id,'guest-link','Guest request account link awaiting review','','guestrequests',NOW());
  }
  history(c,u,row.parish_id,'guest.account-link.requested',{request:row.id});return {ok:true};
}
export async function accountGuestFile(c,u,requestId,fileId){
  const row=await c.first("SELECT f.* FROM uploaded_files f JOIN pl_guest_releases r ON r.file_id=f.id JOIN pl_guest_requests g ON g.id=r.request_id JOIN pl_guest_links l ON l.request_id=g.id WHERE l.user_id=? AND l.status='approved' AND g.id=? AND f.id=? AND g.status IN ('ready-for-download','closed')",u.id,requestId,fileId);
  need(row&&!await suspended(c,u.id,row.parish_id),'Document is not available for this account.',404);return row;
}
