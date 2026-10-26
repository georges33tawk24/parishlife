import { isOffice } from './workspace.js';
import geography from '../../backend/geography.json' with { type: 'json' };
import {need,NOW,TODAY,tokenHex,isoDate} from './py.js';
import {accessibleParishes,parishContext,history} from './workspace.js';

const fields=['name','nameAr','birthDate','phone','email','occupation','language','governorate','district','town','townAr','sector'];
const officeRoles=['super_admin','bishop','diocesan_admin','parish_admin','priest','secretary'];
function snapshot(state,p){
  const x=state.PERSON_EXTRA?.[p.id]||{},a=x.address&&typeof x.address==='object'?x.address:{};
  return {name:p.lat||'',nameAr:p.ar||'',birthDate:p.born||'',phone:p.phone||'',email:p.email||'',occupation:x.occupation||'',language:x.lang||'',...Object.fromEntries(['governorate','district','town','townAr','sector'].map(k=>[k,a[k]??p[k]??'']))};
}
function notify(c,pid,uid,title,route){c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',tokenHex(12),pid,uid,'profile',title,'',route,NOW());}
export async function profileServices(c,u,path,method,q){
  if(!['/api/account/records','/api/workspace/profile-reviews'].includes(path))return null;
  const office=path.startsWith('/api/workspace/');
  if(method==='GET'&&!office){
    const records=[];
    for(const p of await accessibleParishes(c,u)){
      const state=JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?',p.id)).data),person=state.PEOPLE.find(x=>x.id===p.personId);
      if(person)records.push({parish:p.id,parishName:p.name,profile:snapshot(state,person)});
    }
    const requests=(await c.all('SELECT * FROM pl_profile_reviews WHERE user_id=? ORDER BY created_at DESC',u.id)).map(r=>({...r,data:JSON.parse(r.data)}));
    return {records,requests};
  }
  const pid=q.parish,context=await parishContext(c,u,pid);need(context,'Parish access required.',403);
  if(office){
    need(officeRoles.includes(context.role),'Parish office access required.',403);
    if(method==='GET')return {requests:(await c.all('SELECT r.*,u.name FROM pl_profile_reviews r JOIN users u ON u.id=r.user_id WHERE r.parish_id=? ORDER BY r.created_at DESC',pid)).map(r=>({...r,data:JSON.parse(r.data)}))};
  }
  need(method==='POST','Method not allowed.',405);
  const row=await c.first('SELECT revision,data FROM states WHERE parish_id=?',pid),state=JSON.parse(row.data);
  if(!office){
    const person=state.PEOPLE.find(p=>p.id===context.person_id);need(person,'The office must first link your parish person record.',409);
    need(!await c.first("SELECT 1 FROM pl_profile_reviews WHERE user_id=? AND parish_id=? AND status='pending'",u.id,pid),'Your previous changes are still with the office.',409);
    need(q.profile&&typeof q.profile==='object'&&!Array.isArray(q.profile)&&Object.keys(q.profile).every(k=>fields.includes(k)),'Invalid profile fields.');
    need(Object.values(q.profile).every(v=>typeof v==='string'&&v.length<=500),'Keep each field within 500 characters.');
    const values=Object.fromEntries(Object.entries(q.profile).map(([k,v])=>[k,v.trim()])),before=snapshot(state,person),merged={...before,...values};
    need(merged.name.length>=1&&merged.name.length<=120&&merged.nameAr.length<=120,'Enter a name of up to 120 characters.');
    need(!merged.email||/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(merged.email),'Enter a valid email.');
    need(!merged.birthDate||isoDate(merged.birthDate)&&merged.birthDate<=TODAY(),'Enter a valid date of birth that is not in the future.');
    const address=['governorate','district','town'];need(!address.some(k=>merged[k])||address.every(k=>merged[k]),'Complete governorate, district and town together.');
    need(merged.occupation.length<=120,'Keep the occupation within 120 characters.');
    const locationFields=['governorate','district','town','sector'];
    if(locationFields.some(k=>merged[k]!==before[k])&&locationFields.some(k=>merged[k])){
      const gov=geography.governorates.find(g=>g.id===merged.governorate),district=gov?.districts.find(d=>d.id===merged.district),town=district?.towns.find(t=>t.id===merged.town);
      need(town&&(!merged.sector||town.sectors?.some(x=>x.id===merged.sector)),'Choose a valid Governorate, District, Town and Sector combination.');values.townAr=town.ar;
    }
    const changes=Object.fromEntries(Object.entries(values).filter(([k,v])=>v!==before[k]));need(Object.keys(changes).length,'No changes to submit.');
    const id=tokenHex(12),data={before:Object.fromEntries(Object.keys(changes).map(k=>[k,before[k]])),changes};
    c.run('INSERT INTO pl_profile_reviews VALUES(?,?,?,?,?,?,?,?,?)',id,pid,u.id,person.id,JSON.stringify(data),'pending',NOW(),null,null);
    for(const target of await c.all('SELECT * FROM users')){const ctx=await parishContext(c,target,pid);if(ctx&&isOffice(ctx))notify(c,pid,target.id,'Parish profile changes awaiting review','profilereviews');}
    history(c,u,pid,'profile.review.requested',{id});return {ok:true,id};
  }
  const request=await c.first('SELECT * FROM pl_profile_reviews WHERE id=? AND parish_id=?',q.id,pid);need(request?.status==='pending','Pending changes not found.',409);
  need(request.user_id!==u.id,'Another office user must review your own record changes.',403);
  need(['approved','declined'].includes(q.status),'Choose approve or decline.');
  if(q.status==='approved'){
    const p=state.PEOPLE.find(p=>p.id===request.person_id);need(p,'Person record no longer available.',409);
    const data=JSON.parse(request.data),current=snapshot(state,p);need(Object.entries(data.before).every(([k,v])=>current[k]===v),'These fields changed after submission. Decline this request and ask for updated information.',409);
    state.PERSON_EXTRA??={};const x=state.PERSON_EXTRA[p.id]??={};
    for(const [k,v] of Object.entries(data.changes)){
      if(['name','nameAr','birthDate','phone','email'].includes(k))p[({name:'lat',nameAr:'ar',birthDate:'born'})[k]||k]=v;
      else if(['occupation','language'].includes(k))x[k==='language'?'lang':k]=v;
      else{if(!x.address||typeof x.address!=='object')x.address={};x.address[k]=v;if(['town','townAr'].includes(k))p[k]=v;}
    }
    c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',JSON.stringify(state),pid);
  }
  c.run('UPDATE pl_profile_reviews SET status=?,reviewed_by=?,reviewed_at=? WHERE id=?',q.status,u.id,NOW(),request.id);
  notify(c,pid,request.user_id,'Parish profile changes '+q.status,'account');history(c,u,pid,'profile.review.'+q.status,{id:request.id});return {ok:true};
}
