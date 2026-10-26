import { need,NOW,tokenHex,tokenUrlsafe,sha256hex } from './py.js';
import { parishContext,suspended,history,isOffice } from './workspace.js';

export async function accountServices(c,u,path,method,q){
  if(path==='/api/account/activity'&&method==='GET'){
    const parishes=[],events=[];
    for(const p of await c.all('SELECT p.id,p.metadata,s.data FROM parishes p JOIN states s ON s.parish_id=p.id')){
      const context=await parishContext(c,u,p.id),followed=await c.first('SELECT 1 FROM pl_affiliations WHERE user_id=? AND parish_id=? AND following=1',u.id,p.id);
      if(await suspended(c,u.id,p.id)||(!context&&!followed))continue;
      const meta=JSON.parse(p.metadata),state=JSON.parse(p.data);parishes.push({id:p.id,name:meta.name});
      for(const e of state.EVENTS){
        const detail=state.EVENT_DETAIL?.[e.id];
        if(e.kind==='pending'||!(detail?.visibility==='public'||(!detail||!Object.keys(detail).length)&&['mass','event'].includes(e.kind)))continue;
        events.push({id:p.id+':'+e.id,parish:p.id,title:e.title,titleAr:e.titleAr||'',date:e.d,time:e.t||'',subtitle:meta.name});
      }
    }
    return {parishes,events,notifications:await c.all('SELECT id,parish_id,title,body,route,created_at,read_at FROM member_notifications WHERE user_id=? ORDER BY created_at DESC',u.id)};
  }
  if(path==='/api/workspace/invitations'&&method==='POST'){
    const pid=q.parish,context=await parishContext(c,u,pid);
    need(context&&isOffice(context),'Parish office access required.',403);
    const state=JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?',pid)).data),person=state.PEOPLE.find(p=>p.id===q.personId);
    need(person,'Choose a person in this parish.');
    need(!await c.first("SELECT 1 FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? UNION SELECT 1 FROM pl_affiliations WHERE parish_id=? AND person_id=? AND membership='approved'",pid,person.id,pid,person.id),'This person already has a linked account. Use the existing account.',409);
    const token=tokenUrlsafe(32),id=tokenHex(12),expires=new Date(Date.now()+7*86400000).toISOString();
    c.run('UPDATE pl_invitations SET revoked=1 WHERE parish_id=? AND person_id=? AND claimed_by IS NULL',pid,person.id);
    c.run('INSERT INTO pl_invitations VALUES(?,?,?,?,?,?,NULL,0)',id,pid,person.id,sha256hex(token),u.id,expires);
    history(c,u,pid,'account.invitation.created',{id,person:person.id});return {token,expires,delivery:'manual'};
  }
  if(path==='/api/account/claim-invitation'&&method==='POST'){
    const row=await c.first('SELECT * FROM pl_invitations WHERE token_hash=?',sha256hex(String(q.token||'')));
    need(row&&!row.revoked&&!row.claimed_by&&row.expires_at>NOW(),'This invitation has expired or was already used.',410);
    const pid=row.parish_id,person=row.person_id;
    const inviter=await parishContext(c,{id:row.created_by},pid);
    need(inviter&&isOffice(inviter),'The inviting office no longer has authority. Request a new invitation.',410);
    const state=JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?',pid)).data);
    need(state.PEOPLE.some(record=>record.id===person),'This person record is no longer active. Contact the parish office.',410);
    need(!await suspended(c,u.id,pid),'Your parish access is inactive.',403);
    need(!await c.first("SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? AND u.id<>? UNION SELECT user_id FROM pl_affiliations WHERE parish_id=? AND person_id=? AND membership='approved' AND user_id<>?",pid,person,u.id,pid,person,u.id),'This person is linked to another account. Contact the parish office.',409);
    const existing=await c.first('SELECT person_id FROM pl_affiliations WHERE user_id=? AND parish_id=?',u.id,pid);
    need(!existing?.person_id||existing.person_id===person,'Your account already has a different person record in this parish.',409);
    const legacy=await c.first('SELECT u.person_id FROM users u JOIN assignments a ON a.user_id=u.id WHERE u.id=? AND a.parish_id=?',u.id,pid);
    need(!legacy?.person_id||legacy.person_id===person,'Your account already has a different person record in this parish.',409);
    const primary=!await c.first('SELECT 1 FROM pl_affiliations WHERE user_id=? AND is_primary=1',u.id);
    c.run("INSERT INTO pl_affiliations VALUES(?,?,1,'approved',?,?,?) ON CONFLICT(user_id,parish_id) DO UPDATE SET following=1,membership='approved',person_id=excluded.person_id,updated_at=excluded.updated_at",u.id,pid,person,Number(primary),NOW());
    c.run('UPDATE pl_invitations SET claimed_by=? WHERE id=?',u.id,row.id);history(c,u,pid,'account.invitation.accepted',{id:row.id});return {ok:true,parish:pid};
  }
  return null;
}
