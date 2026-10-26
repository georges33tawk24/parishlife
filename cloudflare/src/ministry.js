import { need, NOW, tokenHex } from './py.js';
import { parishContext, suspended, history, requireModules } from './workspace.js';

const OPEN = ['requested','awaiting-priest','withdrawal-requested','leave-requested'];
function notify(c,pid,uid,title,body) {
  c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',tokenHex(12),pid,uid,'ministry',title,body,'ministryrequests',NOW());
}

export async function ministryHandle(c,u,path,method,q) {
  if(path!=='/api/ministry-requests')return null;
  const catalog=[],states=new Map();
  for(const p of await c.all('SELECT p.id,p.diocese,p.metadata,s.data,s.revision FROM parishes p JOIN states s ON s.parish_id=p.id')){
    const context=await parishContext(c,u,p.id),following=await c.first('SELECT 1 FROM pl_affiliations WHERE user_id=? AND parish_id=? AND following=1',u.id,p.id);
    if(await suspended(c,u.id,p.id)||(!context&&!following))continue;
    const state=JSON.parse(p.data);states.set(p.id,{parish:p,state});
    for(const g of state.GROUPS||[]){
      const detail=state.GROUP_DETAIL?.[g.id]||{},person=context?.person_id;
      const member=!!person&&(detail.roster||[]).some(r=>r.p===person);
      const leader=!!context&&!!person&&[g.leader,g.assistant].includes(person),priest=context?.role==='priest';
      if((g.vis||'public')!=='public'&&!member&&!leader&&!priest)continue;
      catalog.push({id:g.id,name:g.name,parish:p.id,parishName:JSON.parse(p.metadata).name,description:g.description||'',member,canReview:leader||priest,priest});
    }
  }
  const requests=[];
  for(const row of await c.all('SELECT r.*,u.name FROM pl_ministry_requests r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC')){
    const group=catalog.find(g=>g.id===row.group_id&&g.parish===row.parish_id),own=row.user_id===u.id;
    const canReview=!!group?.canReview&&(row.kind!=='leave'||group.priest);
    if(own||canReview)requests.push({...row,own,canReview,priest:!!group?.priest,groupName:group?.name||row.group_id,parishName:group?.parishName||row.parish_id});
  }
  if(method==='GET')return {ministries:catalog,requests};
  need(method==='POST','Method not allowed.',405);
  const action=q.action,stamp=NOW();
  if(['join','leave'].includes(action)){
    const pid=q.parish,gid=q.group,group=catalog.find(g=>g.id===gid&&g.parish===pid);
    need(group,'Follow this parish first or request access from the office.',403);
    if(action==='join')await requireModules(c,pid,['GROUP_DETAIL']);
    need(action==='leave'?group.member:!group.member,'This membership has already changed. Reload the page.',409);
    need(!await c.first("SELECT 1 FROM pl_ministry_requests WHERE user_id=? AND parish_id=? AND group_id=? AND status IN ('requested','awaiting-priest','withdrawal-requested','leave-requested')",u.id,pid,gid),'An open request already exists.',409);
    const reason=String(q.reason||'').trim();need(reason.length<=2000,'Keep the note within 2,000 characters.');
    const id='ministry-'+tokenHex(12),status=action==='leave'?'leave-requested':'requested';
    c.run('INSERT INTO pl_ministry_requests VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,u.id,pid,gid,action,status,reason,null,null,stamp,stamp);
    const detailGroup=states.get(pid).state.GROUPS.find(g=>g.id===gid);
    for(const target of await c.all('SELECT * FROM users')){
      const ctx=await parishContext(c,target,pid);
      if(target.id!==u.id&&ctx&&(ctx.role==='priest'||action==='join'&&ctx.person_id&&[detailGroup.leader,detailGroup.assistant].includes(ctx.person_id)))notify(c,pid,target.id,'Ministry request awaiting review',group.name);
    }
    history(c,u,pid,'ministry.request.created',{id});return {id,status};
  }
  const row=requests.find(r=>r.id===q.id);need(row,'Request not available.',404);
  need(row.updated_at===q.version,'The request changed. Reload before continuing.',409);
  need(OPEN.includes(row.status),'This request is already complete.',409);
  const pid=row.parish_id,gid=row.group_id;need(states.has(pid),'Access to this parish is inactive.',403);
  let status=row.status,leaderAt=row.leader_at,priestAt=row.priest_at;
  if(action==='withdraw'){
    need(row.own,'Only the applicant may withdraw a request.',403);
    status=!leaderAt&&!priestAt?'withdrawn':'withdrawal-requested';
  }else{
    need(['approve','decline'].includes(action)&&row.canReview&&!row.own,'Approval is outside your authority.',403);
    if(action==='decline')status=status==='withdrawal-requested'?'awaiting-priest':'declined';
    else if(status==='withdrawal-requested')status='withdrawn';
    else if(row.kind==='leave'){need(row.priest,'Only parish priests review departures.',403);status='ended';priestAt=stamp;}
    else if(row.priest){status='approved';priestAt=stamp;}
    else{need(status==='requested','This application is waiting for a priest.',409);status='awaiting-priest';leaderAt=stamp;}
  }
  if(['approved','ended'].includes(status)){
    const {state}=states.get(pid),target=await c.first('SELECT * FROM users WHERE id=?',row.user_id),context=await parishContext(c,target,pid),person=context?.person_id;
    need(person&&state.PEOPLE.some(p=>p.id===person),'The office must approve parish membership and link a person before completing this request.');
    const detail=(state.GROUP_DETAIL??={})[gid]??={},roster=detail.roster??=[];
    if(status==='approved'&&!roster.some(r=>r.p===person)){roster.push({p:person,role:'Member',since:stamp.slice(0,10)});c.run('INSERT OR IGNORE INTO group_members VALUES(?,?,?)',pid,gid,person);}
    else if(status==='ended'){detail.roster=roster.filter(r=>r.p!==person);c.run('DELETE FROM group_members WHERE parish_id=? AND group_id=? AND person_id=?',pid,gid,person);}
    state.GROUPS.find(g=>g.id===gid).members=detail.roster.length;
    c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',JSON.stringify(state),pid);
  }
  c.run('UPDATE pl_ministry_requests SET status=?,leader_at=?,priest_at=?,updated_at=? WHERE id=?',status,leaderAt,priestAt,stamp,row.id);
  notify(c,pid,row.user_id,'Ministry membership update',row.groupName+': '+status.replaceAll('-',' '));
  if(['awaiting-priest','withdrawal-requested'].includes(status))for(const target of await c.all('SELECT * FROM users')){
    const context=await parishContext(c,target,pid);
    if(target.id!==row.user_id&&context?.role==='priest')notify(c,pid,target.id,'Ministry request awaiting your decision',row.groupName);
  }
  if(status==='ended')for(const target of await c.all('SELECT * FROM users')){
    if(target.id===row.user_id)continue;
    const context=await parishContext(c,target,pid);
    if(['priest','bishop'].includes(context?.role))notify(c,pid,target.id,'Membership ended',row.name+' · '+row.groupName);
  }
  history(c,u,pid,'ministry.request.updated',{id:row.id,status});return {ok:true,status};
}
