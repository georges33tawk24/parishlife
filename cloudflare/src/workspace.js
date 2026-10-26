import { administrationHandle, permittedRoles, writeGrant, protectLastSuperAdmin, policy } from './administration.js';
import administrationSchema from '../../backend/administration-schema.json' with { type: 'json' };
import { guestLinks } from './guest-links.js';
import { profileServices } from './profile-services.js';
import { releaseGuestDocument } from './guest-delivery.js';
import { accountServices } from './account-services.js';
/* Account-level data is separate from parish records and ministry rosters. */
import { ministryHandle } from './ministry.js';
import modules from '../../backend/modules.json' with { type: 'json' };
import schema from '../../backend/workspace-schema.json' with { type: 'json' };
import { need, NOW, tokenHex, tokenUrlsafe, sha256hex, passwordHash } from './py.js';
import { loginName } from './accounts.js';
import { ROUNDS } from './member.js';
import { CONCERN_CATEGORIES } from './concern-policy.js';
import { SEED } from './state.js';

export const EXTRA_ROLES = ['super_admin','diocesan_admin','parish_admin'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/, PHONE = /^\+[0-9]{8,15}$/;
const initializedDatabases = new WeakMap();
export function initializeWorkspace(db) {
  let ready=initializedDatabases.get(db);
  if(ready)return ready;
  ready = (async()=>{
    await db.batch([...schema, ...administrationSchema].map(sql=>db.prepare(sql)));
    if (!await db.prepare('SELECT 1 FROM pl_authorization_migrations WHERE version=1').first()) {
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO pl_grants SELECT 'migration-diocese-'||id,id,'diocese',diocese,'diocesan_admin',1,NULL,? FROM users WHERE role='diocesan_admin' AND diocese IN (SELECT id FROM dioceses WHERE id<>'pl-platform')").bind(NOW()),
        db.prepare('INSERT OR IGNORE INTO pl_authorization_migrations VALUES(1,?)').bind(NOW())
      ]);
    }
    const columns=await db.prepare("SELECT name FROM pragma_table_info('uploaded_files')").all();
    if(!columns.results.some(c=>c.name==='requirement')){
      try{await db.prepare("ALTER TABLE uploaded_files ADD COLUMN requirement TEXT NOT NULL DEFAULT ''").run();}
      catch(error){const check=await db.prepare("SELECT name FROM pragma_table_info('uploaded_files')").all();if(!check.results.some(c=>c.name==='requirement'))throw error;}
    }
  })().catch(error=>{initializedDatabases.delete(db);throw error;});
  initializedDatabases.set(db,ready);
  return ready;
}
export function history(c,u,scope,action,detail={}) {
  c.run('INSERT INTO pl_history VALUES(?,?,?,?,?,?)',tokenHex(16),u?.id??null,scope,action,JSON.stringify(detail),NOW());
}
export async function account(c,u) {
  const row=await c.first('SELECT data FROM pl_accounts WHERE user_id=?',u.id);
  return row?JSON.parse(row.data):{profile:{},theme:{scheme:'forest',mode:'light'}};
}
export async function suspended(c,uid,pid='') {
  return !!await c.first("SELECT 1 FROM pl_suspensions WHERE user_id=? AND active=1 AND scope_id IN ('*',?)",uid,pid);
}
export async function loginUser(c,q) {
  const value=String(q.username||'').trim(),mode=q.mode||'legacy';
  need(['legacy','email','phone','username'].includes(mode),'Choose a sign-in method.');
  if(mode==='email')need(EMAIL.test(value),'Enter an email address in the email field.');
  if(mode==='phone')need(PHONE.test(loginName(value)),'Enter a valid phone number.');
  if(mode==='username')need(value&&value.length<=120&&!value.includes('@'),'Enter your username.');
  const key=mode==='username'?value:loginName(value);
  let u=await c.first('SELECT * FROM users WHERE username=?',key);
  if(!u&&mode!=='username')u=await c.first('SELECT u.* FROM users u JOIN pl_identities i ON i.user_id=u.id WHERE i.value=?',key);
  return u&&!await suspended(c,u.id)?u:null;
}
export async function workspaceSignup(c,q) {
  need(!q.website,'The account could not be created.');
  const first=String(q.firstName||'').trim(),last=String(q.lastName||'').trim();
  need(first.length>=1&&first.length<=60&&last.length>=1&&last.length<=60,'Enter your first and last name.');
  const email=String(q.email||'').trim().toLowerCase(),phone=q.phone?loginName(q.phone):'';
  need(email||phone,'Provide an email address, a phone number, or both.');
  need(!email||(email.length<=120&&EMAIL.test(email)),'Enter a valid email address.');
  need(!phone||PHONE.test(phone),'Enter a valid phone number.');
  const born=String(q.birthDate||''),birth=new Date(born+'T12:00:00Z'),today=new Date();
  need(/^\d{4}-\d{2}-\d{2}$/.test(born)&&Number.isFinite(+birth)&&birth.toISOString().slice(0,10)===born,'Enter your date of birth.');
  const age=today.getUTCFullYear()-birth.getUTCFullYear()-((today.getUTCMonth()<birth.getUTCMonth()||(today.getUTCMonth()===birth.getUTCMonth()&&today.getUTCDate()<birth.getUTCDate()))?1:0);
  need(age>=13&&age<=120,'Accounts are available to people aged 13 and older.');
  need(typeof q.password==='string'&&q.password.length>=8&&q.password.length<=200,'Choose a password of at least 8 characters.');
  need(q.password===q.confirmPassword,'The passwords do not match.');
  for(const value of [email,phone].filter(Boolean)){
    need(!await c.first('SELECT 1 FROM users WHERE username=?',value)&&!await c.first('SELECT 1 FROM pl_identities WHERE value=?',value),
      'This contact already has an account. Sign in to connect additional methods.',409);
  }
  const recent=await c.first('SELECT COUNT(*) AS n FROM pl_accounts WHERE created_at>?',new Date(Date.now()-3600000).toISOString());
  need(recent.n<30,'Too many registrations. Please try again later.',429);
  const uid='u-'+tokenHex(12),stamp=NOW();
  c.run("INSERT OR IGNORE INTO dioceses VALUES('pl-platform','ParishLife accounts')");
  c.run('INSERT INTO users VALUES(?,?,?,?,?,?,?)',uid,email||phone,first+' '+last,'member','pl-platform',null,passwordHash(q.password,tokenHex(16),ROUNDS));
  const data={profile:{firstName:first,lastName:last,birthDate:born,email,phone},theme:{scheme:'forest',mode:'light'},profileComplete:false};
  c.run('INSERT INTO pl_accounts VALUES(?,?,?)',uid,JSON.stringify(data),stamp);
  for(const [kind,value]of [['email',email],['phone',phone]])if(value)c.run('INSERT INTO pl_identities VALUES(?,?,?,NULL)',kind,value,uid);
  history(c,{id:uid},'*','account.created',{verification:'pending_configuration'});
  return uid;
}
export async function platformRole(c,u) {
  if(await isSuperAdmin(c,u))return 'super_admin';
  if(u.role==='bishop')return 'bishop';
  if(await c.first("SELECT 1 FROM pl_grants g JOIN dioceses d ON d.id=g.scope_id WHERE g.user_id=? AND g.scope_type='diocese' AND g.role='diocesan_admin' AND g.active=1",u.id))return 'diocesan_admin';
  return EXTRA_ROLES.includes(u.role)?'member':u.role;
}
export async function sessionData(c,u) {
  const data=await account(c,u);
  return {platformRole:await platformRole(c,u),preferences:{theme:data.theme||{}},profile:data.profile||{},affiliations:await c.all('SELECT * FROM pl_affiliations WHERE user_id=?',u.id)};
}
export const ADMIN_ROLES = ['super_admin','bishop','diocesan_admin','parish_admin'];
export const OFFICE_ROLES = [...ADMIN_ROLES,'priest','secretary'];
const PARISH_ROLES = ['priest','parish_admin','secretary','treasurer','leader','finance_view','member'];
export const hasClergy = user => user.role === 'priest' || (user.roles || []).includes('priest');
export const isOffice = user => OFFICE_ROLES.includes(user.role) || (user.roles || []).some(role => OFFICE_ROLES.includes(role));
export async function protectedCredentials(c,user){
  const stored=await c.first('SELECT role FROM users WHERE id=?',user.id);
  return !!stored&&(stored.role!=='member'||!!await c.first('SELECT 1 FROM pl_grants WHERE user_id=? AND active=1',user.id));
}
export async function accountSummaries(c,parishId){
  const rows=await c.all("SELECT DISTINCT u.id,u.username,u.role,COALESCE(f.person_id,u.person_id) AS person_id FROM users u LEFT JOIN assignments a ON a.user_id=u.id LEFT JOIN pl_affiliations f ON f.user_id=u.id AND f.parish_id=? WHERE a.parish_id=? OR f.membership='approved'",parishId,parishId);
  const snapshots=await authorizationSnapshots(c,rows.filter(row=>row.person_id).map(row=>row.id));
  const result={};
  for(const row of rows){
    if(!row.person_id)continue;
    const snapshot=snapshots.get(row.id),context=await parishContext(c,row,parishId,snapshot);
    const protectedAccount=row.role!=='member'||snapshot.grants.some(grant=>grant.active);
    result[row.person_id]={id:row.id,username:row.username,role:context?.role||'member',inactive:snapshot.suspensions.has('*')||snapshot.suspensions.has(parishId),canResetPassword:!protectedAccount&&!!context};
  }
  return result;
}

export async function isSuperAdmin(c, user) {
  if (!user) return false;
  const stored = await c.first('SELECT role FROM users WHERE id=?', user.id);
  if (!stored || stored.role === 'disabled' || await suspended(c, user.id)) return false;
  const grant = await c.first("SELECT active FROM pl_grants WHERE user_id=? AND scope_type='global' AND scope_id='*' AND role='super_admin'", user.id);
  return grant ? Boolean(grant.active) : stored.role === 'super_admin';
}

export async function authorizationSnapshots(c,userIds) {
  userIds=[...new Set(userIds)];
  if(!userIds.length)return new Map();
  if(userIds.length>100){const result=new Map();for(let offset=0;offset<userIds.length;offset+=100)for(const [id,snapshot] of await authorizationSnapshots(c,userIds.slice(offset,offset+100)))result.set(id,snapshot);return result;}
  const placeholders=userIds.map(()=>'?').join(',');
  const [users,grants,suspensions,assignments,affiliations,parishes]=await c.reads([
    [`SELECT * FROM users WHERE id IN (${placeholders})`,userIds],
    [`SELECT * FROM pl_grants WHERE user_id IN (${placeholders})`,userIds],
    [`SELECT user_id,scope_id FROM pl_suspensions WHERE active=1 AND user_id IN (${placeholders})`,userIds],
    [`SELECT * FROM assignments WHERE user_id IN (${placeholders})`,userIds],
    [`SELECT * FROM pl_affiliations WHERE membership='approved' AND user_id IN (${placeholders})`,userIds],
    ['SELECT * FROM parishes',[]]
  ]);
  const parishMap=new Map(parishes.map(row=>[row.id,row]));
  const snapshots=new Map(users.map(user=>[user.id,{user,grants:[],suspensions:new Set(),assignments:new Set(),affiliations:new Map(),parishes:parishMap}]));
  for(const grant of grants)snapshots.get(grant.user_id).grants.push(grant);
  for(const row of suspensions)snapshots.get(row.user_id).suspensions.add(row.scope_id);
  for(const row of assignments)snapshots.get(row.user_id).assignments.add(row.parish_id);
  for(const row of affiliations)snapshots.get(row.user_id).affiliations.set(row.parish_id,row);
  return snapshots;
}
export async function authorizationSnapshot(c,user) {
  return (await authorizationSnapshots(c,[user.id])).get(user.id)||{user:null,grants:[],suspensions:new Set(),assignments:new Set(),affiliations:new Map(),parishes:new Map()};
}
export async function scopedRoles(c,user,pid=null,diocese=null,snapshot=null) {
  snapshot??=await authorizationSnapshot(c,user);
  const stored=snapshot.user;
  if(!stored||stored.role==='disabled'||snapshot.suspensions.has('*'))return [];
  if(pid){const parish=snapshot.parishes.get(pid);if(!parish)return [];diocese=parish.diocese;}
  const platformGrant=snapshot.grants.find(grant=>grant.scope_type==='global'&&grant.scope_id==='*'&&grant.role==='super_admin');
  const isSuper=platformGrant?Boolean(platformGrant.active):stored.role==='super_admin';
  const roles=new Set(isSuper?['super_admin']:[]);
  if(pid&&snapshot.suspensions.has(pid)&&!isSuper)return [];
  if(stored.role==='bishop'&&diocese&&stored.diocese===diocese)roles.add('bishop');
  for(const grant of snapshot.grants){
    const expected=policy.roles[grant.role]?.scope;
    const matches=grant.scope_type==='parish'&&pid&&grant.scope_id===pid||grant.scope_type==='diocese'&&diocese&&grant.scope_id===diocese;
    if(grant.active&&matches&&[grant.scope_type,'either'].includes(expected))roles.add(grant.role);
  }
  if(pid&&PARISH_ROLES.includes(stored.role)&&snapshot.assignments.has(pid)){
    const overridden=snapshot.grants.find(grant=>grant.scope_type==='parish'&&grant.scope_id===pid&&grant.role===stored.role);
    if(!overridden||overridden.active)roles.add(stored.role);
  }
  if(snapshot.affiliations.has(pid))roles.add('member');
  return [...roles].sort();
}

export async function authority(c, user, pid=null, diocese=null,snapshot=null) {
  const roles = (await scopedRoles(c,user,pid,diocese,snapshot)).filter(role => [...ADMIN_ROLES,'priest'].includes(role));
  return roles.sort((left,right) => policy.roles[right].rank-policy.roles[left].rank)[0] || null;
}
export async function parishPlan(c,pid){
  const row=await c.first('SELECT data FROM pl_plans WHERE parish_id=?',pid);
  return row?JSON.parse(row.data):{bundle:'complete',sponsor:'parish',modules:Object.keys(modules),billing:'manual',publicRequests:true};
}
export async function requireModules(c,pid,keys){
  const enabled=(await parishPlan(c,pid)).modules||[];
  for(const [module,collections] of Object.entries(modules))need(enabled.includes(module)||!keys.some(k=>collections.includes(k)),
    'This module is read-only under the current parish bundle. Existing records are preserved; request a bundle change to edit them.',403);
}
async function officeAccess(c,u,pid){
  const context=await parishContext(c,u,pid);
  return context&&['super_admin','bishop','diocesan_admin','parish_admin','priest','secretary'].includes(context.role);
}
export async function publicProfile(c,pid,state) {
  const clergy=[];
  for(const r of await c.all("SELECT DISTINCT u.id,u.name FROM users u LEFT JOIN assignments a ON a.user_id=u.id LEFT JOIN pl_grants g ON g.user_id=u.id WHERE (a.parish_id=? AND u.role='priest') OR (g.scope_type='parish' AND g.scope_id=? AND g.role='priest' AND g.active=1)",pid,pid)){
    const context=await parishContext(c,{id:r.id},pid);if(!context||!hasClergy(context))continue;
    const title=await c.first('SELECT title FROM pl_clergy_titles WHERE user_id=? ORDER BY created_at DESC LIMIT 1',r.id);clergy.push({name:r.name,title:title?.title||'Priest'});
  }
  return {clergy,parishPhoto:state.PHOTOS?.parish||'',gallery:state.PARISH.gallery||[],ministries:(state.GROUPS||[]).filter(g=>(g.vis||'public')==='public'&&g.public!==false).map(g=>({id:g.id,name:g.name||'',nameAr:g.ar||g.nameAr||'',description:g.description||'',responsible:g.leaderName||state.PEOPLE.find(p=>p.id===g.leader)?.lat||'',joining:'Send an inquiry to the parish office.'})),
    publicRequests:(await parishPlan(c,pid)).publicRequests!==false,visit:Object.fromEntries(['email','officeHours','confessionTimes','accessibility','latitude','longitude','website'].map(k=>[k,state.PARISH[k]||'']))};
}
export async function parishContext(c,user,pid,snapshot=null) {
  snapshot??=await authorizationSnapshot(c,user);
  const stored=snapshot.user,parish=snapshot.parishes.get(pid);
  if(!stored||!parish)return null;
  const roles=await scopedRoles(c,user,pid,null,snapshot);
  const role=roles.filter(value=>value!=='clergy_assigner').sort((left,right)=>(policy.roles[right]?.rank||10)-(policy.roles[left]?.rank||10))[0];
  if(!role)return null;
  const affiliation=snapshot.affiliations.get(pid);
  return {...stored,role,roles,diocese:parish.diocese,person_id:affiliation?.person_id||(snapshot.assignments.has(pid)?stored.person_id:null)};
}
export async function accessibleParishes(c,user) {
  const snapshot=await authorizationSnapshot(c,user);
  const plans=new Map((await c.all('SELECT parish_id,data FROM pl_plans')).map(row=>[row.parish_id,JSON.parse(row.data)]));
  const defaultPlan={bundle:'complete',sponsor:'parish',modules:Object.keys(modules),billing:'manual',publicRequests:true};
  const result=[];
  for(const parish of snapshot.parishes.values()){
    const context=await parishContext(c,user,parish.id,snapshot);
    if(!context)continue;
    const definition=policy.roles[context.role]||{};
    result.push({...JSON.parse(parish.metadata),id:parish.id,effectiveRole:context.role,roles:context.roles,personId:context.person_id,
      canViewFinance:context.roles.some(role=>[...ADMIN_ROLES,'priest','treasurer','finance_view'].includes(role)),
      plan:plans.get(parish.id)||defaultPlan,role:definition.label||context.role,roleAr:definition.labelAr||context.role});
  }
  return result;
}
export async function caseAccess(c,uid,concern) {
  return concern.assigned_to===uid||!!await c.first('SELECT 1 FROM pl_case_reviewers WHERE concern_id=? AND user_id=?',concern.id,uid);
}
export async function reviewers(c,pid) {
  const result=[];
  for(const user of await c.all('SELECT * FROM users')){
    const context=await parishContext(c,user,pid);
    if(context&&(hasClergy(context)||context.role==='leader'||await c.first('SELECT 1 FROM complaint_reviewers WHERE user_id=? AND parish_id=?',user.id,pid)))result.push({id:user.id,name:user.name,person_id:context.person_id});
  }
  return result;
}

async function inbox(c,u,path,method,q){
  if(path==='/api/inbox'&&method==='GET'){
    const messages=await c.all("SELECT m.id,m.parish_id,m.author_id,m.recipient_id,m.title,m.body,m.created_at,u.name AS author_name,v.name AS recipient_name,COALESCE(s.is_read,0) AS is_read,COALESCE(s.archived,0) AS archived FROM member_content m JOIN users u ON u.id=m.author_id JOIN users v ON v.id=m.recipient_id LEFT JOIN pl_message_state s ON s.message_id=m.id AND s.user_id=? WHERE m.kind='message' AND (m.author_id=? OR m.recipient_id=?) ORDER BY m.created_at DESC",u.id,u.id,u.id);
    const recipients=[];
    for(const p of await c.all('SELECT id,metadata FROM parishes')){
      const context=await parishContext(c,u,p.id),following=await c.first('SELECT 1 FROM pl_affiliations WHERE user_id=? AND parish_id=? AND following=1',u.id,p.id);
      if((!context&&!following)||await suspended(c,u.id,p.id))continue;
      for(const target of await c.all('SELECT id,name,role FROM users')){
        const targetContext=await parishContext(c,target,p.id);
        if(target.id===u.id||!targetContext||(!context&&!isOffice(targetContext)))continue;
        recipients.push({...target,role:targetContext.role,parish:p.id,parishName:JSON.parse(p.metadata).name});
      }
    }
    return {messages,recipients};
  }
  if(path==='/api/inbox'&&method==='POST'){
    const action=q.action||'send';
    if(['read','unread','archive','unarchive'].includes(action)){
      const row=await c.first("SELECT * FROM member_content WHERE id=? AND kind='message'",q.id);
      need(row&&[row.author_id,row.recipient_id].includes(u.id),'Message not available.',403);
      const old=await c.first('SELECT * FROM pl_message_state WHERE user_id=? AND message_id=?',u.id,row.id);
      let read=old?.is_read||0,archived=old?.archived||0;
      if(['read','unread'].includes(action))read=Number(action==='read');else archived=Number(action==='archive');
      c.run('INSERT INTO pl_message_state VALUES(?,?,?,?) ON CONFLICT(user_id,message_id) DO UPDATE SET is_read=excluded.is_read,archived=excluded.archived',u.id,row.id,read,archived);return {ok:true};
    }
    need(['send','reply'].includes(action),'Messages cannot be edited or deleted.');
    let pid=q.parish,recipient=q.recipient,title=String(q.title||'').trim();
    if(action==='reply'){const row=await c.first("SELECT * FROM member_content WHERE id=? AND kind='message'",q.id);need(row&&row.recipient_id===u.id,'Message not available for reply.',403);pid=row.parish_id;recipient=row.author_id;title='Re: '+row.title.replace(/^Re:\s*/i,'').slice(0,156);}
    const directory=(await inbox(c,u,'/api/inbox','GET',{})).recipients;
    need(directory.some(r=>r.id===recipient&&r.parish===pid),'Choose a recipient in your available parish directory.',403);
    const body=String(q.body||'').trim();need(title.length>=1&&title.length<=160&&body.length>=1&&body.length<=5000,'Enter a subject and message.');
    const id=tokenHex(12);c.run('INSERT INTO member_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',id,pid,null,'message',u.id,recipient,title,body,'',null,null,0,NOW());
    c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',tokenHex(12),pid,recipient,'message','New private message','Open your inbox to read it.','inbox',NOW());return {id};
  }
  if(path==='/api/workspace/emergency-message'&&method==='POST'){
    need((await isSuperAdmin(c,u)),'Super administrator emergency access required.',403);
    const reason=String(q.reason||'').trim();need(reason.length>=20&&reason.length<=1000,'Record the specific emergency or problem (at least 20 characters).');
    const row=await c.first("SELECT id,parish_id,author_id,recipient_id,title,body,created_at FROM member_content WHERE id=? AND kind='message'",q.id);need(row,'Message not found.',404);
    history(c,u,row.parish_id,'emergency.message.opened',{id:row.id,reason});return row;
  }
  return null;
}
async function adminHandle(c,u,path,method,q) {
  if(!path.startsWith('/api/workspace/'))return null;
  const administration = await administrationHandle(c,u,path,method,q);
  if (administration !== null) return administration;
  const pid=q.parish,manager=pid?await authority(c,u,pid):null,manage=['super_admin','bishop','diocesan_admin','parish_admin','priest'];
  if(path==='/api/workspace/public-profile'){
    need(manage.includes(manager),'Parish management access required.',403);
    const row=await c.first('SELECT revision,data FROM states WHERE parish_id=?',pid),state=JSON.parse(row.data);
    const keys=['phone','email','address','officeHours','confessionTimes','accessibility','website','latitude','longitude'];
    if(method==='GET')return {revision:row.revision,profile:{...Object.fromEntries(keys.map(k=>[k,state.PARISH[k]??''])),gallery:state.PARISH.gallery||[],massTimes:state.CONTENT?.massTimes?.en||'',massTimesAr:state.CONTENT?.massTimes?.ar||''}};
    need(method==='PUT','Method not allowed.',405);need(q.revision===row.revision,'Parish details changed. Reopen this form before saving.',409);
    const values=Object.fromEntries([...keys,'massTimes','massTimesAr'].map(k=>[k,String(q[k]??'').trim()]));
    need(Object.values(values).every(v=>v.length<=2000),'Keep each field within 2,000 characters.');
    need(!values.email||EMAIL.test(values.email),'Enter a valid parish email address.');
    need(!values.website||/^https:\/\/[^\s]+$/.test(values.website),'Use an HTTPS website address.');
    const gallery=q.gallery||[];need(Array.isArray(gallery)&&gallery.length<=12&&gallery.every(v=>typeof v==='string'&&v.length<=2000&&/^https:\/\/[^\s]+$/.test(v)),'Add up to twelve HTTPS image links.');
    need(!!values.latitude===!!values.longitude,'Enter both coordinates or leave both empty.');
    if(values.latitude)need(Number.isFinite(Number(values.latitude))&&Math.abs(Number(values.latitude))<=90&&Number.isFinite(Number(values.longitude))&&Math.abs(Number(values.longitude))<=180,'Enter valid coordinates.');
    Object.assign(state.PARISH,Object.fromEntries(keys.map(k=>[k,values[k]])),{gallery});state.CONTENT??={};
    state.CONTENT.massTimes={en:values.massTimes,ar:values.massTimesAr,published:true};
    state.CONTENT.contact={...state.CONTENT.contact,en:['address','phone','email'].map(k=>values[k]).filter(Boolean).join('\n'),published:true};
    c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',JSON.stringify(state),pid);history(c,u,pid,'public-profile.updated');return {ok:true};
  }
  if(path==='/api/workspace/certificate-resubmit'&&method==='POST'){
    const context=await parishContext(c,u,pid);need(context&&hasClergy(context),'Only a parish priest may resubmit a certificate.',403);
    const row=await c.first('SELECT revision,data FROM states WHERE parish_id=?',pid);need(row.revision===q.revision,'The parish changed. Reload before continuing.',409);
    const state=JSON.parse(row.data),record=state.SACRAMENTS.find(r=>r.id===q.id);
    need(record?.kind==='certificate'&&record.bishopReview==='returned','Returned certificate not found.',409);
    const note=String(q.note||'').trim();need(q.verified===true&&note.length>=3&&note.length<=1000,'Confirm the review and explain how the bishop’s note was addressed.');
    Object.assign(record,{bishopReview:'pending',resubmissionNote:note});(record.history??=[]).push({action:'resubmitted to bishop',by:u.name,at:NOW(),reason:note});
    c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',JSON.stringify(state),pid);
    for(const bishop of await c.all("SELECT id FROM users WHERE role='bishop' AND diocese=?",context.diocese))c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',tokenHex(12),pid,bishop.id,'certificate','Certificate resubmitted for acceptance',record.reg,'workspace',NOW());
    history(c,u,pid,'certificate.resubmitted',{id:record.id});return {ok:true};
  }
  if(path==='/api/workspace/certificates'&&['GET','POST'].includes(method)){
    need(u.role==='bishop','Only the diocesan bishop reviews signed certificates.',403);
    const certificates=[];
    for(const p of await c.all('SELECT p.id,p.metadata,s.revision,s.data FROM parishes p JOIN states s ON s.parish_id=p.id WHERE p.diocese=?',u.diocese)){
      const state=JSON.parse(p.data);
      for(const r of state.SACRAMENTS||[])if(r.kind==='certificate'&&r.bishopReview){
        const person=[...state.PEOPLE,...state.ARCHIVED].find(p=>p.id===r.person)||{};
        certificates.push({id:r.id,parish:p.id,parishName:JSON.parse(p.metadata).name,person:person.lat||'',reference:r.reg,signedBy:r.issuedBy||'',signedAt:r.issuedAt||'',status:r.bishopReview,revision:p.revision,note:r.resubmissionNote||'',bishopNote:r.bishopReviewNote||''});
      }
    }
    if(method==='GET')return {certificates};
    const selected=certificates.find(r=>r.id===q.id&&r.parish===pid);need(selected?.status==='pending','Pending certificate not found.',404);
    need(q.revision===selected.revision,'The parish changed. Reload before reviewing.',409);
    need(['accepted','returned'].includes(q.decision),'Choose accept or return.');
    const note=String(q.note||'').trim();need(note.length<=1000&&(q.decision!=='returned'||note.length>=3),'Provide a reason when returning a certificate.');
    const state=JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?',pid)).data),record=state.SACRAMENTS.find(r=>r.id===q.id);
    Object.assign(record,{bishopReview:q.decision,bishopReviewedBy:u.name,bishopReviewedAt:NOW(),bishopReviewNote:note});
    (record.history??=[]).push({action:'bishop '+q.decision,by:u.name,at:NOW(),reason:note});
    c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',JSON.stringify(state),pid);
    if(record.signedByUserId)c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',tokenHex(12),pid,record.signedByUserId,'certificate','Certificate '+q.decision+' by the bishop',note,'certificate/'+record.id,NOW());
    if(q.decision==='accepted'&&record.memberRequestId){const owner=await c.first('SELECT user_id FROM member_requests WHERE id=? AND parish_id=?',record.memberRequestId,pid);if(owner)c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',tokenHex(12),pid,owner.user_id,'certificate','Certificate ready to collect','','myrequests/'+record.memberRequestId,NOW());}
    history(c,u,pid,'certificate.bishop.'+q.decision,{id:record.id});return {ok:true};
  }
  if(path==='/api/workspace/parishes'&&method==='POST'){
    const did=q.diocese,auth=await authority(c,u,null,did);
    need(['super_admin','bishop','diocesan_admin'].includes(auth),'Parish creation requires diocesan authority.',403);
    need(await c.first("SELECT 1 FROM dioceses WHERE id=? AND id<>'pl-platform'",did),'Choose a diocese.');
    const name=String(q.name||'').trim(),town=String(q.town||'').trim();need(name.length>=2&&name.length<=120&&town.length>=1&&town.length<=120,'Enter a parish name and town.');
    const secretaryId=q.secretaryUserId||null;
    if(secretaryId){need(typeof secretaryId==='string'&&await c.first("SELECT 1 FROM users WHERE id=? AND role<>'disabled'",secretaryId),'Secretary account not found.',404);need(!await suspended(c,secretaryId),'Reactivate the secretary account before assigning it.',409);}
    const id='parish-'+tokenHex(8),meta={id,name,ar:String(q.nameAr||name).slice(0,120),town,townAr:String(q.townAr||town).slice(0,120)};
    const state=Object.fromEntries(Object.entries(SEED).map(([k,v])=>[k,Array.isArray(v)?[]:v&&typeof v==='object'?{}:v]));
    for(const k of ['RATE','SERVICE','ROTA','CHECKIN','BATCH','REG_FORM','EVACUATION','PREP_REQUIREMENTS'])state[k]=structuredClone(SEED[k]);
    Object.assign(state.SERVICE,{title:'New service or activity',titleAr:'خدمة أو نشاط جديد',date:NOW().slice(0,10),status:'draft',order:[],celebrant:null,coordinator:null,venue:null});state.ROTA.teams=[];
    Object.assign(state.CHECKIN,{rows:[],sessions:{},present:0,expected:0,awaitingGuardian:0,room:null});
    Object.assign(state.BATCH,{lines:[],counters:[]});Object.assign(state.REG_FORM,{fields:[],discounts:[],installments:[]});state.EVACUATION.rooms=[];
    state.PARISH={...meta,nameAr:meta.ar,rite:String(q.rite||''),riteAr:String(q.rite||''),phone:'',address:''};state.OFFICE_LEDGER=[];
    state.IMPORT_PREVIEW={total:0,ok:0,warn:0,err:0,cols:[],issues:[]};
    c.run('INSERT INTO parishes VALUES(?,?,?)',id,did,JSON.stringify(meta));
    for(const category of CONCERN_CATEGORIES)c.run('INSERT INTO complaint_categories VALUES(?,?,1)',id,category);
    c.run('INSERT INTO states VALUES(?,1,?)',id,JSON.stringify(state));
    if(secretaryId){writeGrant(c,u,secretaryId,'secretary','parish',id,true);history(c,u,id,'role.granted',{user:secretaryId,role:'secretary',scopeType:'parish',scopeId:id});}
    history(c,u,did,'parish.created',meta);return {id};
  }
  if(path==='/api/workspace/users'&&method==='POST'){
    let did=q.diocese;
    if(pid){const parish=await c.first('SELECT diocese FROM parishes WHERE id=?',pid);need(parish,'Choose a parish.');did=parish.diocese;}
    const auth=await authority(c,u,pid,did);need(manage.includes(auth),'Account creation is outside your scope.',403);
    const permitted=['member',...(pid?await permittedRoles(c,u,'parish',pid):[])];
    if(['super_admin','bishop'].includes(auth))permitted.push('diocesan_admin');
    if((await isSuperAdmin(c,u)))permitted.push('bishop');if(['super_admin','bishop'].includes(auth))permitted.push('priest');
    need(permitted.includes(q.role),'You cannot create this role.',403);
    const username=String(q.username||'').trim(),name=String(q.name||'').trim();
    need(/^[A-Za-z0-9_.-]{3,80}$/.test(username),'Use a username of 3–80 letters, numbers, dots, underscores or dashes.');
    need(name.length>=2&&name.length<=120,'Enter a full name.');
    need(typeof q.password==='string'&&q.password.length>=12&&q.password.length<=200,'Use a temporary password of at least 12 characters.');
    need(!await c.first('SELECT 1 FROM users WHERE username=?',username),'Username is already in use.',409);
    need(await c.first('SELECT 1 FROM dioceses WHERE id=?',did),'Choose a diocese.');
    need(['bishop','diocesan_admin'].includes(q.role)||pid,'Choose a parish for this role.');
    const personId=q.personId||null;
    if(personId){need(pid,'Choose a parish before linking a person record.');const state=JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?',pid)).data);need(state.PEOPLE.some(p=>p.id===personId),'Choose a person in this parish.');need(!await c.first("SELECT 1 FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? UNION SELECT 1 FROM pl_affiliations WHERE parish_id=? AND person_id=? AND membership='approved'",pid,personId,pid,personId),'This person already has an account. Assign a role to the existing account.',409);}
    need(!['leader','priest'].includes(q.role)||personId,'Link this role to its person record.');
    const id='u-'+tokenHex(12);c.run('INSERT INTO users VALUES(?,?,?,?,?,?,?)',id,username,name,['bishop','priest','member'].includes(q.role)?q.role:'member',did,personId,passwordHash(q.password,tokenHex(16),ROUNDS));
    if(pid)c.run('INSERT INTO assignments VALUES(?,?)',id,pid);
    if(q.role==='diocesan_admin')writeGrant(c,u,id,q.role,'diocese',did,true);
    else if(!['bishop','member'].includes(q.role))writeGrant(c,u,id,q.role,'parish',pid,true);
    history(c,u,pid||did,'account.created.by-office',{user:id,role:q.role});return {id,username};
  }
  if(path==='/api/workspace/people'&&method==='GET'){
    need(manage.includes(manager),'Management access required.',403);
    const directory=await administrationHandle(c,u,'/api/workspace/administration','GET',{parish:pid,afterUser:q.afterUser||''});
    const snapshots=await authorizationSnapshots(c,directory.users.map(target=>target.id));
    const users=directory.users.map(target=>Object.fromEntries(['id','username','name','role','person_id'].map(key=>[key,snapshots.get(target.id).user[key]])));
    for(const target of users){const effective=await parishContext(c,target,pid,snapshots.get(target.id));target.effectiveRole=effective?.role||null;target.inactive=snapshots.get(target.id).suspensions.has('*')||snapshots.get(target.id).suspensions.has(pid);
      const targetRank=Math.max(0,...(effective?.roles||[]).map(role=>policy.roles[role]?.rank||0));
      target.canSuspend=target.id!==u.id&&(manager==='super_admin'||policy.roles[manager].rank>targetRank);const title=await c.first('SELECT title FROM pl_clergy_titles WHERE user_id=? ORDER BY created_at DESC LIMIT 1',target.id);target.clergyTitle=title?.title||(target.role==='priest'?'Priest':'');}
    const memberships=await c.all("SELECT a.*,u.name,u.username FROM pl_affiliations a JOIN users u ON u.id=a.user_id WHERE a.parish_id=? AND a.membership='pending'",pid);
    const state=JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?',pid)).data);
    const did=(await c.first('SELECT diocese FROM parishes WHERE id=?',pid)).diocese;
    const grants=await c.all("SELECT g.*,u.name FROM pl_grants g JOIN users u ON u.id=g.user_id WHERE ((g.scope_type='parish' AND g.scope_id=?) OR (g.scope_type='diocese' AND g.scope_id=?)) AND g.active=1",pid,did);
    for(const r of await c.all("SELECT u.id,u.name,u.role FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.role IN ('priest','parish_admin','secretary','treasurer','leader')",pid)){
      if(!await c.first("SELECT 1 FROM pl_grants WHERE user_id=? AND scope_type='parish' AND scope_id=? AND role=?",r.id,pid,r.role))grants.push({id:'legacy-'+r.id,user_id:r.id,name:r.name,role:r.role,scope_type:'parish',scope_id:pid,active:1});
    }
    return {users,memberships,people:state.PEOPLE.map(p=>({id:p.id,name:p.lat})),grants,nextUserCursor:directory.nextUserCursor};
  }
  if(path==='/api/workspace/membership'&&method==='GET'){
    need(await officeAccess(c,u,pid),'Office access required.',403);
    const state=JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?',pid)).data),memberships=[];
    for(const r of await c.all("SELECT a.*,u.name,u.username FROM pl_affiliations a JOIN users u ON u.id=a.user_id WHERE a.parish_id=? AND a.membership='pending'",pid))memberships.push({...r,profile:(await account(c,{id:r.user_id})).profile||{}});
    return {memberships,people:state.PEOPLE.map(p=>({id:p.id,name:p.lat}))};
  }
  if(path==='/api/workspace/membership'&&method==='POST'){
    need(await officeAccess(c,u,pid),'Office access required.',403);
    const target=q.userId,row=await c.first("SELECT * FROM pl_affiliations WHERE user_id=? AND parish_id=? AND membership='pending'",target,pid);
    need(row,'Pending membership not found.',404);
    need(['approved','declined'].includes(q.status),'Choose approve or decline.');
    let personId=null;
    if(q.status==='approved'){
      personId=q.personId;const state=JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?',pid)).data);
      need(state.PEOPLE.some(p=>p.id===personId),'Link an existing person record after reviewing their identity.');
      need(!await c.first("SELECT 1 FROM pl_affiliations WHERE parish_id=? AND person_id=? AND membership='approved' AND user_id<>? UNION SELECT 1 FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? AND u.id<>?",pid,personId,target,pid,personId,target),'This person is already linked to another account.');
    }
    c.run('UPDATE pl_affiliations SET membership=?,person_id=?,updated_at=? WHERE user_id=? AND parish_id=?',q.status,personId,NOW(),target,pid);
    c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',tokenHex(12),pid,q.userId,'membership','Parish membership '+q.status,'','account',NOW());
    history(c,u,pid,'membership.'+q.status,{user:target,person:personId});return {ok:true};
  }
  if(path==='/api/workspace/suspension'&&method==='POST'){
    const scope=q.scope||'parish';need(['parish','global'].includes(scope),'Invalid suspension scope.');
    need(scope==='global'?(await isSuperAdmin(c,u)):manage.includes(manager),'Account management is outside your scope.',403);
    const target=q.userId;need(target!==u.id,'You cannot deactivate your own account here.');
    const targetUser=await c.first('SELECT * FROM users WHERE id=?',target);need(targetUser,'User not found.',404);
    if(scope==='global'){need(q._recentAuthentication===true,'Confirm your current password to deactivate an account globally.',403);if(q.active===true)await protectLastSuperAdmin(c,targetUser);}
    if(!(await isSuperAdmin(c,u))){
      need(await c.first("SELECT 1 FROM assignments WHERE user_id=? AND parish_id=? UNION SELECT 1 FROM pl_affiliations WHERE user_id=? AND parish_id=? UNION SELECT 1 FROM pl_grants WHERE user_id=? AND scope_type='parish' AND scope_id=? AND active=1",target,pid,target,pid,target,pid),'User is outside your parish.',403);
      const previous=await c.first('SELECT actor_id FROM pl_suspensions WHERE user_id=? AND scope_id=? AND active=1',target,pid);
      if(previous&&q.active===false){const actor=await c.first('SELECT * FROM users WHERE id=?',previous.actor_id),rank={super_admin:5,bishop:4,diocesan_admin:3,priest:2,parish_admin:1},last=await c.first("SELECT detail FROM pl_history WHERE scope_id=? AND action='account.deactivated' AND json_extract(detail,'$.user')=? ORDER BY created_at DESC LIMIT 1",pid,target),actorRole=last?JSON.parse(last.detail).actorRole:null;need((rank[manager]||0)>=(rank[actorRole||await authority(c,actor,pid)]||0),'The authority that deactivated this account must approve its reactivation.',403);}
      need(!['super_admin','bishop','diocesan_admin'].includes(targetUser.role),'This account requires a higher authority.',403);
    }
    need(typeof q.active==='boolean','Specify deactivate or reactivate.');
    if(q.active&&scope==='parish'&&!(await isSuperAdmin(c,u))){const rank={super_admin:5,bishop:4,diocesan_admin:3,priest:2,parish_admin:1};need((rank[manager]||0)>(rank[await authority(c,targetUser,pid)]||0),'This account requires a higher authority.',403);}
    if(!q.active&&scope==='parish')need(!await suspended(c,target),'A global deactivation can only be lifted by a super administrator.',403);
    const reason=String(q.reason||'').trim();need(reason.length>=3&&reason.length<=500,'Record a reason.');
    const scopeId=scope==='global'?'*':pid;
    c.run('INSERT INTO pl_suspensions VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,scope_id) DO UPDATE SET active=excluded.active,reason=excluded.reason,actor_id=excluded.actor_id,updated_at=excluded.updated_at',target,scopeId,Number(q.active),reason,u.id,NOW());
    if(scope==='global'&&q.active)c.run('DELETE FROM sessions WHERE user_id=?',target);
    history(c,u,scopeId,q.active?'account.deactivated':'account.reactivated',{user:target,reason,actorRole:scope==='global'?'super_admin':manager});return {ok:true};
  }
  if(path==='/api/workspace/clergy-title'&&method==='POST'){
    const superAdmin=await isSuperAdmin(c,u);
    need(superAdmin||u.role==='bishop','Bishop or Super Admin authority required.',403);
    const target=await c.first('SELECT * FROM users WHERE id=?',q.userId);
    need(target&&(superAdmin||target.diocese===u.diocese||target.diocese==='pl-platform'&&await c.first("SELECT 1 FROM pl_affiliations a JOIN parishes p ON p.id=a.parish_id WHERE a.user_id=? AND a.membership='approved' AND p.diocese=?",target.id,u.diocese)),'Choose clergy within your archdiocese.',403);
    if(target.diocese==='pl-platform'&&!superAdmin)c.run('UPDATE users SET diocese=? WHERE id=?',u.diocese,target.id);
    need(['Deacon','Priest','Monsignor','Archimandrite'].includes(q.title),'Choose a clergy title.');
    if(q.title==='Deacon')need(!await c.first("SELECT 1 FROM pl_grants WHERE user_id=? AND role='priest' AND active=1 UNION SELECT 1 FROM assignments a JOIN users u ON u.id=a.user_id WHERE u.id=? AND u.role='priest' AND NOT EXISTS (SELECT 1 FROM pl_grants g WHERE g.user_id=u.id AND g.scope_type='parish' AND g.scope_id=a.parish_id AND g.role='priest' AND g.active=0)",target.id,target.id),'Revoke active priest assignments before changing the title to Deacon. Historical activity will remain.',409);
    c.run('INSERT INTO pl_clergy_titles VALUES(?,?,?,?)',target.id,q.title,u.id,NOW());
    history(c,u,superAdmin?(target.diocese==='pl-platform'?'*':target.diocese):u.diocese,'clergy.title.changed',{user:target.id,title:q.title});return {ok:true};
  }
  if(path==='/api/workspace/plans'&&method==='POST'){
    const pids=q.parishes;need(Array.isArray(pids)&&pids.length>=1&&pids.length<=100&&new Set(pids).size===pids.length,'Choose one or more parishes.');
    const reference=String(q.arrangement||'').trim();need(reference.length>=2&&reference.length<=100,'Name the shared arrangement.');
    const dioceses=new Set();
    for(const target of pids){need(['super_admin','bishop','diocesan_admin'].includes(await authority(c,u,target)),'Shared arrangements require diocesan authority for each parish.',403);dioceses.add((await c.first('SELECT diocese FROM parishes WHERE id=?',target)).diocese);}
    need(dioceses.size===1,'A shared diocesan arrangement must stay within one diocese.');
    for(const target of pids)await adminHandle(c,u,'/api/workspace/plan','POST',{...q,parish:target,sponsor:'diocese'});
    return {ok:true,count:pids.length};
  }
  if(path==='/api/workspace/plan'&&['GET','POST'].includes(method)){
    need(manage.includes(manager),'Plan management is outside your scope.',403);
    const row=await c.first('SELECT data FROM pl_plans WHERE parish_id=?',pid),plan=row?JSON.parse(row.data):{bundle:'complete',sponsor:'parish',modules:['office','requests','sacraments','ministries','facilities','finance'],billing:'manual'};
    if(method==='GET')return plan;
    need(['presence','office','community','complete'].includes(q.bundle),'Choose a bundle.');
    if(plan.sponsor==='diocese'&&['priest','parish_admin'].includes(manager))plan.requestedBundle=q.bundle;
    else{
      need(manager!=='parish_admin','A priest or diocesan authority must activate a bundle.',403);
      Object.assign(plan,{bundle:q.bundle,modules:{presence:[],office:['office','requests','sacraments'],community:['office','requests','ministries','facilities'],complete:['office','requests','sacraments','ministries','facilities','finance']}[q.bundle]});
      delete plan.requestedBundle;
      if(['super_admin','bishop','diocesan_admin'].includes(manager)&&['parish','diocese'].includes(q.sponsor))plan.sponsor=q.sponsor;
    }
    if(['super_admin','bishop','diocesan_admin'].includes(manager)&&'arrangement' in q)plan.arrangement=String(q.arrangement).trim().slice(0,100);
    plan.billing='manual';if(!(plan.sponsor==='diocese'&&['priest','parish_admin'].includes(manager)))plan.publicRequests=q.publicRequests??plan.publicRequests??true;
    c.run('INSERT INTO pl_plans VALUES(?,?,?) ON CONFLICT(parish_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',pid,JSON.stringify(plan),NOW());
    history(c,u,pid,'plan.updated',plan);return {ok:true,...plan};
  }
  return null;
}
export async function workspaceHandle(c,u,path,method,q) {
  if(path==='/api/public/auth-options'&&method==='GET')return {providers:['google','apple','microsoft'].map(id=>({id,available:false})),verification:{email:false,sms:false,authenticator:false}};
  if(path==='/api/public/guest-requests'&&method==='POST'){
    const pid=q.parish;
    need(await c.first('SELECT 1 FROM parishes WHERE id=?',pid),'Choose a parish.');
    need((await parishPlan(c,pid)).publicRequests!==false,'Please contact the parish office to make a request.',403);
    const name=String(q.name||'').trim(),email=String(q.email||'').trim(),phone=String(q.phone||'').trim();
    need(name.length>=2&&name.length<=120,'Enter your name.');
    need(email||phone,'Provide a phone number or email for the parish office.');
    need(!email||EMAIL.test(email),'Enter a valid email address.');
    need(!phone||/^[\d +().-]{6,40}$/.test(phone),'Enter a valid phone number.');
    need(q.responsibleAdult===true,'A responsible adult must submit and handle this request.');
    need(['certificate','baptism','communion','confirmation','marriage','funeral','booking','custom','appointment','ministry'].includes(q.kind),'Choose a request type.');
    const description=String(q.description||'').trim();
    need(description.length>=5&&description.length<=4000,'Describe your request (5–4000 characters).');
    need((await c.first('SELECT COUNT(*) AS count FROM pl_guest_requests WHERE parish_id=? AND created_at>?',pid,new Date(Date.now()-3600000).toISOString())).count<100,'The parish has received too many requests recently. Please try again later.',429);
    const token=tokenUrlsafe(32),id='guest-'+tokenHex(10),stamp=NOW();
    const details={name,email,phone,kind:q.kind,description,behalf:String(q.behalf||'').slice(0,120),delivery:q.delivery||'collection'};
    c.run('INSERT INTO pl_guest_requests VALUES(?,?,?,?,?,?,?,?)',id,pid,sha256hex(token),JSON.stringify(details),'submitted','',stamp,stamp);
    return {id,trackingToken:token,status:'submitted'};
  }
  if(path.startsWith('/api/public/track/')&&method==='GET'){
    const row=await c.first('SELECT id,status,response,updated_at FROM pl_guest_requests WHERE token_hash=?',sha256hex(path.split('/').pop()));
    need(row,'Tracking link not found.',404);return {...row,files:['ready-for-download','closed'].includes(row.status)?await c.all('SELECT f.id,f.name FROM pl_guest_releases r JOIN uploaded_files f ON f.id=r.file_id WHERE r.request_id=?',row.id):[]};
  }
  if(!u)return null;
  if(path==='/api/workspace/release-document'&&method==='POST')return releaseGuestDocument(c,u,q);
  const guestLinkResult=await guestLinks(c,u,path,method,q);if(guestLinkResult!==null)return guestLinkResult;
  const profileResult=await profileServices(c,u,path,method,q);if(profileResult!==null)return profileResult;
  const accountResult=await accountServices(c,u,path,method,q);if(accountResult!==null)return accountResult;
  const ministry=await ministryHandle(c,u,path,method,q);if(ministry!==null)return ministry;
  const messages=await inbox(c,u,path,method,q);if(messages!==null)return messages;
  const managed=await adminHandle(c,u,path,method,q);
  if(managed!==null)return managed;
  if(path==='/api/account'&&method==='GET'){
    return {...await account(c,u),...await sessionData(c,u),identities:await c.all('SELECT kind,value,verified_at FROM pl_identities WHERE user_id=?',u.id)};
  }
  if(path==='/api/account'&&method==='PUT'){
    const data=await account(c,u);
    if(q.theme){
      const theme=q.theme;
      need(['light','dark'].includes(theme.mode),'Choose light or dark mode.');
      need(['forest','navy','marian','burgundy','purple','teal','cedar','slate','custom'].includes(theme.scheme),'Choose a palette.');
      need(theme.scheme!=='custom'||/^#[0-9a-fA-F]{6}$/.test(theme.primary||''),'Choose a valid colour.');
      data.theme=Object.fromEntries(['scheme','mode','primary'].filter(k=>k in theme).map(k=>[k,theme[k]]));
    }
    if(q.profile){
      need(typeof q.profile==='object'&&!Array.isArray(q.profile),'Invalid profile.');
      const editable=['firstName','lastName','town','address','occupation','language','about'];
      data.profile={...data.profile,...Object.fromEntries(Object.entries(q.profile).filter(([k])=>editable.includes(k)).map(([k,v])=>[k,String(v).trim().slice(0,500)]))};
      data.profileComplete=!!(data.profile.firstName&&data.profile.lastName);
    }
    c.run('INSERT INTO pl_accounts VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data',u.id,JSON.stringify(data),NOW());
    return {ok:true,...data};
  }
  if(path==='/api/account/parishes'&&method==='POST'){
    const pid=q.parish,action=q.action;
    need(await c.first('SELECT 1 FROM parishes WHERE id=?',pid),'Parish not found.',404);
    need(['follow','unfollow','primary','request'].includes(action),'Invalid parish action.');
    need(!await suspended(c,u.id,pid),'Your access to this parish is inactive.',403);
    const old=await c.first('SELECT * FROM pl_affiliations WHERE user_id=? AND parish_id=?',u.id,pid);
    let following=old?.following??1,membership=old?.membership??'none',primary=old?.is_primary??Number(!await c.first('SELECT 1 FROM pl_affiliations WHERE user_id=? AND is_primary=1',u.id));
    if(action==='unfollow'){need(!primary,'Choose a different primary parish before unfollowing.');following=0;}else following=1;
    if(action==='primary'){c.run('UPDATE pl_affiliations SET is_primary=0 WHERE user_id=?',u.id);primary=1;}
    if(action==='request'){need(!['pending','approved'].includes(membership),'A membership request already exists.');membership='pending';}
    c.run('INSERT INTO pl_affiliations VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,parish_id) DO UPDATE SET following=excluded.following,membership=excluded.membership,is_primary=excluded.is_primary,updated_at=excluded.updated_at',u.id,pid,following,membership,old?.person_id??null,primary,NOW());
    if(action==='request')for(const target of await c.all('SELECT * FROM users')){
      const context=await parishContext(c,target,pid);
      if(context&&isOffice(context))c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,NULL)',tokenHex(12),pid,target.id,'membership','Parish membership awaiting review','','membershipreviews',NOW());
    }
    history(c,u,pid,'parish.'+action);
    return {ok:true};
  }
  if(path==='/api/workspace'&&method==='GET'){
    const managed=[];
    const snapshot=await authorizationSnapshot(c,u);
    for(const r of snapshot.parishes.values()){
      const a=await authority(c,u,r.id,null,snapshot);if(a)managed.push({...r,metadata:JSON.parse(r.metadata),authority:a});
    }
    const ids=new Set(managed.map(p=>p.diocese));
    const dioceses=[];for(const r of await c.all("SELECT * FROM dioceses WHERE id<>'pl-platform'"))if(ids.has(r.id)||['super_admin','bishop','diocesan_admin'].includes(await authority(c,u,null,r.id,snapshot)))dioceses.push({...r,authority:await authority(c,u,null,r.id,snapshot)});
    return {parishes:managed,dioceses,canCreateDiocese:await isSuperAdmin(c,u),isSuperAdmin:await isSuperAdmin(c,u)};
  }
  if(path==='/api/workspace/dioceses'&&method==='POST'){
    need((await isSuperAdmin(c,u)),'Only the super administrator creates dioceses.',403);
    const name=String(q.name||'').trim();need(name.length>=2&&name.length<=120,'Enter a diocese name.');
    const id='diocese-'+tokenHex(8);c.run('INSERT INTO dioceses VALUES(?,?)',id,name);history(c,u,id,'diocese.created',{name});return {id};
  }
  if(path==='/api/workspace/request-counts'&&method==='GET'){
    const pid=q.parish;need(await officeAccess(c,u,pid),'Office access required.',403);
    return {
      membershipreviews:(await c.first("SELECT COUNT(*) AS total FROM pl_affiliations WHERE parish_id=? AND membership='pending'",pid)).total,
      profilereviews:(await c.first("SELECT COUNT(*) AS total FROM pl_profile_reviews WHERE parish_id=? AND status='pending'",pid)).total,
      guestrequests:(await c.first("SELECT COUNT(*) AS total FROM pl_guest_requests WHERE parish_id=? AND status NOT IN ('closed','ready-for-collection','ready-for-download')",pid)).total
    };
  }
  if(path==='/api/workspace/guest-requests'&&['GET','POST'].includes(method)){
    const row=method==='POST'?await c.first('SELECT * FROM pl_guest_requests WHERE id=?',q.id):null;
    if(method==='POST')need(row,'Request not found.',404);
    const pid=method==='POST'?row.parish_id:q.parish;
    need(await officeAccess(c,u,pid),'Office access required.',403);
    if(method==='GET')return {requests:(await c.all("SELECT id,details,status,response,created_at,updated_at,(SELECT COUNT(*) FROM pl_guest_links l WHERE l.request_id=g.id AND l.status='pending') AS pendingLinks FROM pl_guest_requests g WHERE parish_id=? ORDER BY created_at DESC",pid)).map(r=>({...r,details:JSON.parse(r.details)}))};
    need(['submitted','office-review','missing-documents','ready-for-collection','ready-for-download','closed'].includes(q.status),'Choose a request status.');
    if(q.status==='ready-for-download')need(await c.first('SELECT 1 FROM pl_guest_releases r JOIN uploaded_files f ON f.id=r.file_id WHERE r.request_id=?',row.id),'Release a reviewed document before marking this request ready for download.');
    c.run('UPDATE pl_guest_requests SET status=?,response=?,updated_at=? WHERE id=?',q.status,String(q.response||'').slice(0,2000),NOW(),row.id);
    history(c,u,pid,'guest-request.updated',{id:row.id,status:q.status});return {ok:true};
  }
  return null;
}
