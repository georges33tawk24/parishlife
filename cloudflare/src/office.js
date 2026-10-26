import { need, NOW, eq } from './py.js';
import { file_access, audit } from './app.js';

const date = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function registrationConsent(d,form,personId){
  if(form.consentRequired||(form.fields||[]).some(f=>Array.isArray(f)&&f[2]==='consent'&&f[3]))return true;
  if(!form.parentalConsent)return false;
  const person=[...d.PEOPLE,...d.ARCHIVED].find(p=>p.id===personId)||{},event=d.EVENTS.find(e=>e.id===form.eventId)||{};
  if(!date(person.born)||!date(event.d)||person.born>event.d)return true;
  return Number(event.d.slice(0,4))-Number(person.born.slice(0,4))-Number(event.d.slice(5)<person.born.slice(5))<18;
}
export function validateLedger(d){
  const rows=d.OFFICE_LEDGER||[];
  need(Array.isArray(rows)&&new Set(rows.map(r=>r.id)).size===rows.length,'Invalid or duplicate office transaction.');
  for(const r of rows){
    need(typeof r.id==='string'&&['allowance','expense','opening'].includes(r.kind)&&date(r.date),'Choose a valid office transaction type and date.');
    need(typeof r.amount==='number'&&Number.isFinite(r.amount)&&r.amount>0&&r.amount<=1e12&&['USD','LBP'].includes(r.currency),'Enter a positive amount and choose USD or LBP.');
    need(typeof r.description==='string'&&r.description.trim().length>0&&r.description.length<=240,'Enter an office transaction description.');
    for(const [k,max] of Object.entries({category:80,payee:160,reference:100,notes:2000}))need(typeof(r[k]??'')==='string'&&(r[k]||'').length<=max,'Office transaction details are too long.');
  }
  for(const currency of ['USD','LBP']){
    const opening=rows.filter(r=>r.kind==='opening'&&r.currency===currency);
    need(opening.length<=1,'Record only one initial opening balance per currency; later balances carry forward automatically.');
    if(opening.length)need(rows.filter(r=>r.currency===currency).every(r=>r.date>=opening[0].date),'The initial opening balance must precede the other transactions in that currency.');
  }
}
export function registrationChanges(c,u,pid,old,d,changes){
  const forms=new Map(d.REGISTRATIONS.map(f=>[f.id,f])),oldForms=new Map(old.REGISTRATIONS.map(f=>[f.id,f]));
  const previous=new Map(old.REGISTRANTS.map(r=>[r.id,r])),added=new Map();
  for(const form of forms.values()){
    need(['USD','LBP'].includes(form.currency||'USD')&&typeof(form.fee??0)==='number'&&Number.isFinite(form.fee??0)&&(form.fee??0)>=0&&(form.fee??0)<=1e12,'Choose USD or LBP and a valid non-negative event fee.');
    const options=form.transportOptions||[];
    need(Array.isArray(options)&&options.length<=20,'Choose up to twenty transport options.');
    need(options.every(o=>o&&typeof o==='object'&&typeof o.id==='string'&&o.id.length>=1&&o.id.length<=80&&typeof o.name==='string'&&o.name.length>=1&&o.name.length<=120&&typeof(o.fee??0)==='number'&&Number.isFinite(o.fee??0)&&(o.fee??0)>=0&&(o.fee??0)<=1e12),'Each transport option needs an identifier, name and valid fee.');
    need(new Set(options.map(o=>o.id)).size===options.length,'Transport option identifiers must be unique.');
    const prior=oldForms.get(form.id);
    if(prior&&old.REGISTRANTS.some(r=>r.registrationId===form.id))need((form.currency||'USD')===(prior.currency||'USD')&&form.eventId===prior.eventId,'A form with participants must keep its event and currency.');
  }
  for(const r of d.REGISTRANTS){
    const before=previous.get(r.id),form=forms.get(r.registrationId);
    if(!before){
      need(form&&form.eventId&&form.open,'New participants require an open registration form linked to an event.');
      need(['pending','registered'].includes(r.status),'Choose Reserved or Confirmed.');added.set(form.id,(added.get(form.id)||0)+1);
      need(!d.REGISTRANTS.some(x=>x!==r&&x.p===r.p&&forms.get(x.registrationId)?.eventId===form.eventId),'This person is already registered for that event.');
    }else{
      need(r.p===before.p&&r.registrationId===before.registrationId,'An existing registration cannot change its person or event.');
      if(r.status!==before.status)need(({'awaiting-approval':['pending','registered'],pending:['registered'],paid:['pending','registered'],registered:['pending']}[before.status]||[]).includes(r.status),'Invalid registration progression.');
      need(!before.consent||r.consent,'Received consent cannot be silently removed.');
    }
    if(form&&(!before||!eq(before,r))){
      if(r.status==='registered')need(!registrationConsent(d,form,r.p)||r.consent,'Record the required consent or save the place as Reserved.');
      const options=new Map((form.transportOptions||[]).map(o=>[o.id,o])),transport=r.transport||'',same=!!before&&transport===(before.transport||'');
      need(typeof transport==='string'&&(!transport||options.has(transport)||same),'Choose a transport option offered for this event.');
      const prior=oldForms.get(form.id)||form,base=before?(before.baseFee??prior.fee??0):(form.fee||0),fee=same?(before.transportFee??options.get(transport)?.fee??0):(options.get(transport)?.fee||0);
      need((r.baseFee??base)===base&&(r.transportFee??fee)===fee,'Participant fees must match the recorded event and transport charges.');
      r.baseFee=base;r.transportFee=fee;
      const oldPayments=before?.payments||[],payments=r.payments||[];
      need(Array.isArray(payments)&&eq(payments.slice(0,oldPayments.length),oldPayments),'Registration payment history is immutable.');
      const newPayments=payments.slice(oldPayments.length);
      need(newPayments.length<=1&&newPayments.every(p=>typeof p.amount==='number'&&Number.isFinite(p.amount)&&p.amount>0&&['cash','bank','omt'].includes(p.method)&&p.by===u.id&&p.currency===(form.currency||'USD')&&date(p.at)&&p.at<=NOW().slice(0,10)&&typeof(p.reference??'')==='string'&&(p.reference||'').length<=120),'Enter a payment amount, method, date and the event currency.');
      const paid=r.paid||0;
      need(typeof paid==='number'&&Number.isFinite(paid)&&Math.abs(paid-(before?.paid||0)-newPayments.reduce((sum,p)=>sum+p.amount,0))<0.001,'Payment changes require a matching audit entry.');
      need(!newPayments.length||paid<=base+fee+0.001,'The received payment exceeds the remaining balance.');
      audit(c,u,pid,before?'Participant registration updated':'Participant registered',{id:r.id,before:before||null,after:r});
    }
  }
  for(const [id,count] of added){const form=forms.get(id);need(form.cap>=form.taken&&form.taken>=(oldForms.get(id)?.taken||0)+count,'Registration capacity or participant count is inconsistent.');}
  if(changes.CHECKIN)for(const [eventId,session] of Object.entries(d.CHECKIN.sessions||{})){
    const before=new Set((old.CHECKIN.sessions?.[eventId]?.rows||[]).map(r=>r.p));
    for(const entry of session.rows||[])if(!before.has(entry.p)){
      const r=d.REGISTRANTS.find(r=>r.p===entry.p&&forms.get(r.registrationId)?.eventId===eventId);
      need(r?.status==='registered','Confirm the participant place before check-in.');
      need(!registrationConsent(d,forms.get(r.registrationId),entry.p)||r.consent,'Required consent is still pending for this participant.');
    }
  }
}
export async function officeChanges(c,u,pid,old,d,changes){
  validateLedger(d);
  if(u.role==='secretary'&&changes.GROUP_DETAIL){
    for(const [gid,detail] of Object.entries(d.GROUP_DETAIL)){
      const before=old.GROUP_DETAIL[gid]||{};
      for(const key of ['posts','files','tasks','milestones'])need(eq(detail[key]||[],before[key]||[]),'This group section is outside the secretary workspace.',403);
      for(const meeting of detail.meetings||[]){
        const previous=(before.meetings||[]).find(m=>m.id===meeting.id)||{};
        for(const [key,fallback] of Object.entries({attendance:{},absent:[],present:0}))need(eq(meeting[key]??fallback,previous[key]??fallback),'The secretary does not record group attendance.',403);
      }
    }
  }
  if(changes.OFFICE_LEDGER){
    const before=new Map((old.OFFICE_LEDGER||[]).map(r=>[r.id,r])),after=new Map(d.OFFICE_LEDGER.map(r=>[r.id,r]));
    for(const id of new Set([...before.keys(),...after.keys()]))if(!eq(before.get(id)??null,after.get(id)??null)){
      audit(c,u,pid,'Office transaction '+(!before.has(id)?'created':!after.has(id)?'deleted':'updated'),{id,before:before.get(id)??null,after:after.get(id)??null});
      if(!after.has(id)){
        c.run("DELETE FROM cf_file_chunks WHERE file_id IN (SELECT id FROM uploaded_files WHERE parish_id=? AND scope='office-expense' AND owner_id=?)",pid,id);
        c.run("DELETE FROM uploaded_files WHERE parish_id=? AND scope='office-expense' AND owner_id=?",pid,id);
      }
    }
  }
}

// D1 reads do not see queued file writes. Include the pending upload/deletion explicitly.
export async function requestDocuments(c,u,pid,q,{added=false,removed=null}={}){
  const {scope,id,requirement='',received,revision}=q;
  need(['service-request','sacrament-request'].includes(scope),'Invalid request type.');
  await file_access(c,u,pid,scope,id,true);
  const row=await c.first('SELECT * FROM states WHERE parish_id=?',pid);
  need(revision===row.revision,'The request changed. Reload before updating documents.',409);
  const d=JSON.parse(row.data),key=scope==='service-request'?'SERVICE_REQUESTS':'SACRAMENTS',record=d[key].find(r=>r.id===id);
  const kind=(record.kind||'').toLowerCase(),requirements=d.PREP_REQUIREMENTS?.[kind==='wedding'?'marriage':kind]||[];
  need(typeof requirement==='string'&&(!requirement||requirements.some(r=>r[0]===requirement)),'Choose a document requirement.');
  if(received!==undefined&&received!==null){need(typeof received==='boolean'&&requirement,'Choose a requirement and receipt status.');(record.paperDocuments??={})[requirement]=received;}
  if(requirement){
    const stored=await c.first('SELECT 1 FROM uploaded_files WHERE parish_id=? AND scope=? AND owner_id=? AND requirement=? AND id<>?',pid,scope,id,requirement,removed||'');
    (record.documents??={})[requirement]=!!(added||stored||record.paperDocuments?.[requirement]);
  }
  if(scope==='service-request')record.prep=requirements.filter(r=>r[2]).every(r=>record.documents?.[r[0]])?'complete':'documents missing';
  else{record.revision=(record.revision||1)+1;(record.history??=[]).push({at:NOW(),by:u.name,action:'documents updated',reason:requirement});}
  c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?',JSON.stringify(d),pid);
  audit(c,u,pid,'Request documents updated',{scope,id,requirement,receivedOnPaper:received??null});
}
