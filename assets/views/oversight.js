/* Bishop-only reporting. The API supplies a limited read-only projection. */
import { api, session } from '../api.js';
import { t, fmtDate } from '../i18n.js';
import { S, bus } from '../store.js';
import { pageHead, table, stat, esc, status } from '../ui.js';

const cache = new Map();
const L = (en, ar) => t(en, ar);
const key = id => `${session.user?.id}:${id || 'all'}`;
const personName = p => `${esc(p?.lat || '—')}<small style="display:block" dir="rtl">${esc(p?.ar || '')}</small>`;
const link = (url, label) => `<a href="${url}" class="text-link">${label}</a>`;
const rows = (items, cols) => items.length ? table({cols:cols.map(label=>({label})),rows:items.map(cells=>({cells}))}) :
  `<p class="help" style="padding:18px">${L('No records to show.','لا سجلات لعرضها.')}</p>`;
const block = (id, title, body) => `<details class="panel oversight-section" id="oversight-${id}" open>
  <summary class="panel-h"><b>${title}</b><span class="oversight-chevron" aria-hidden="true">⌄</span></summary><div class="panel-b tight">${body}</div></details>`;
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const monthKey = () => S.ui.oversightMonth || dateKey(new Date()).slice(0,7);

function calendar(events) {
  const [year, month] = monthKey().split('-').map(Number);
  const first = new Date(year, month-1, 1), start = new Date(year, month-1, 1-first.getDay());
  const cells = Math.ceil((first.getDay()+new Date(year,month,0).getDate())/7)*7;
  const weekdays = Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(document.documentElement.lang==='ar'?'ar-LB':'en-US',{weekday:'short'}).format(new Date(2026,9,4+i)));
  const byDate = new Map();
  for (const event of events) if(event.date) byDate.set(event.date,[...(byDate.get(event.date)||[]),event]);
  return `<div class="toolbar" style="justify-content:center;padding:14px"><button class="btn btn-secondary btn-dense" data-oversight-month="-1" aria-label="${L('Previous month','الشهر السابق')}">‹</button>
    <b>${esc(new Intl.DateTimeFormat(document.documentElement.lang==='ar'?'ar-LB':'en-US',{month:'long',year:'numeric'}).format(first))}</b>
    <button class="btn btn-secondary btn-dense" data-oversight-month="1" aria-label="${L('Next month','الشهر التالي')}">›</button></div>
    <div class="oversight-calendar-scroll"><div class="cal oversight-calendar"><div class="cal-head">${weekdays.map(day=>`<div>${esc(day)}</div>`).join('')}</div><div class="cal-grid">
    ${Array.from({length:cells},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return `<div class="cal-day${d.getMonth()===first.getMonth()?'':' out'}"><span class="dn">${d.getDate()}</span>
      ${(byDate.get(dateKey(d))||[]).map(e=>`<div class="cal-ev" title="${esc(e.title)}"><span class="t">${esc(e.time||'')}</span>${esc(L(e.title,e.titleAr||e.title))}</div>`).join('')}</div>`;}).join('')}</div></div></div>`;
}

function personDetail(entry, parishId, personId) {
  const p=entry.people.find(x=>x.id===personId);
  if(!p)return `<p class="alert alert-danger">${L('Person not found.','الشخص غير موجود.')}</p>`;
  const records=entry.records.filter(r=>r.personId===personId);
  return `${link(`#/oversight/${esc(parishId)}`,L('← Back to parish','← العودة إلى الرعية'))}<h2 style="margin:18px 0 8px">${personName(p)}</h2>
    <p class="help">${L('Read-only profile. Private member and pastoral records are excluded.','ملف للقراءة فقط. لا يشمل بيانات الأعضاء الخاصة أو السجلات الرعوية السرية.')}</p>
    <div class="stats" style="margin:18px 0">${stat(L('Status','الحالة'),esc(p.status))}${stat(L('Town','البلدة'),esc(L(p.town,p.townAr||p.town)))}${stat(L('Rite','الطقس'),esc(p.rite||'—'))}</div>
    ${block('household',L('Household and groups','العائلة والمجموعات'),`<div style="padding:18px"><p>${L('Household','العائلة')}: <b>${esc(L(p.household?.name||'—',p.household?.ar||p.household?.name||'—'))}</b></p>
      <p style="margin-top:10px">${L('Groups','المجموعات')}: ${p.groups.map(g=>link(`#/oversight/${esc(parishId)}/group/${esc(g.id)}`,esc(L(g.name,g.ar||g.name)))).join(', ')||'—'}</p></div>`)}
    ${block('records',L('Sacraments and requests','الأسرار والطلبات'),rows(records.map(r=>[esc(r.reference||'—'),esc(r.kind),fmtDate(r.date),status(r.status)]),
      [L('Reference','المرجع'),L('Type','النوع'),L('Date','التاريخ'),L('Status','الحالة')]))}`;
}

function groupDetail(entry, parishId, groupId) {
  const g=entry.groups.find(x=>x.id===groupId);
  if(!g)return `<p class="alert alert-danger">${L('Group not found.','المجموعة غير موجودة.')}</p>`;
  return `${link(`#/oversight/${esc(parishId)}`,L('← Back to parish','← العودة إلى الرعية'))}<h2 style="margin:18px 0 8px">${esc(L(g.name,g.ar||g.name))}</h2>
    <p class="help">${L('Read-only group activity based on recorded meetings.','نشاط المجموعة للقراءة فقط، وفق الاجتماعات المسجلة.')}</p>
    <div class="stats" style="margin:18px 0">${stat(L('Members','الأعضاء'),g.members)}${stat(L('Meetings','الاجتماعات'),g.meetings.length)}
      ${stat(L('Attendance','الحضور'),g.attendance.percentage===null?'—':`${g.attendance.percentage}%`,`${g.attendance.present} / ${g.attendance.recorded} ${L('recorded','مسجّل')}`)}</div>
    ${block('roster',L('Members','الأعضاء'),rows(g.roster.map(p=>[link(`#/oversight/${esc(parishId)}/person/${esc(p.id)}`,personName(p))]),[L('Person','الشخص')]))}
    ${block('meetings',L('Meetings','الاجتماعات'),rows(g.meetings.map(m=>[esc(m.title),fmtDate(m.date),esc(m.time||'—'),m.recorded?`${m.present} / ${m.recorded}`:'—']),
      [L('Meeting','الاجتماع'),L('Date','التاريخ'),L('Time','الوقت'),L('Present / recorded','حاضر / مسجّل')]))}`;
}

export function oversight(id='', detail='', detailId='') {
  const entry=cache.get(key(id));
  const head=pageHead({title:L('Parish oversight','الإشراف على الرعايا'),sub:L('Read-only parish activity and records. Parish staff make operational changes.','أنشطة الرعايا وسجلاتها للقراءة فقط. يتولّى موظفو الرعية التغييرات التشغيلية.')});
  const picker=`<div class="toolbar" style="margin:18px 0"><label for="oversight-parish">${L('Parish','الرعية')}</label><select class="select" id="oversight-parish"><option value="">${L('All parishes','كل الرعايا')}</option>
    ${session.parishes.map(p=>`<option value="${esc(p.id)}" ${id===p.id?'selected':''}>${esc(p.name)} — ${esc(p.ar)}</option>`).join('')}</select></div>`;
  if(!entry||entry.loading)return head+picker+`<p role="status">${L('Loading oversight…','جارٍ تحميل بيانات الإشراف…')}</p>`;
  if(entry.error)return head+picker+`<p class="alert alert-danger">${esc(entry.error)}</p>`;
  if(!id)return head+picker+rows(entry.parishes.map(x=>[`${esc(x.parish.name)}<small style="display:block">${esc(x.parish.ar)}</small>`,`${x.counts.people} / ${x.counts.households}`,
    String(x.counts.registers),String(x.counts.pendingRequests),String(x.counts.upcomingEvents),link(`#/oversight/${esc(x.parish.id)}`,L('View parish','عرض الرعية'))]),
    [L('Parish','الرعية'),L('People / households','المؤمنون / العائلات'),L('Official entries','القيود الرسمية'),L('Open requests','الطلبات المفتوحة'),L('Upcoming events','الأحداث المقبلة'),'']);
  if(detail==='person')return head+picker+personDetail(entry,id,detailId);
  if(detail==='group')return head+picker+groupDetail(entry,id,detailId);
  const q=(S.ui.oversightRecordQ||'').toLocaleLowerCase(),kind=S.ui.oversightRecordKind||'',state=S.ui.oversightRecordStatus||'';
  const filtered=entry.records.filter(r=>(!kind||r.kind===kind)&&(!state||r.status===state)&&(!q||`${r.reference} ${r.kind} ${r.person?.lat} ${r.person?.ar}`.toLocaleLowerCase().includes(q)));
  const eventsView=S.ui.oversightEventsView||'list';
  const titles=[['people',L('People','المؤمنون')],['records',L('Sacraments & requests','الأسرار والطلبات')],['events',L('Calendar','الرزنامة')],['groups',L('Groups','المجموعات')],['activity',L('Activity','النشاط')]];
  return head+picker+`<h2>${esc(entry.parish.name)} <small dir="rtl">${esc(entry.parish.ar)}</small></h2><div class="stats" style="margin:16px 0">${stat(L('People','المؤمنون'),entry.counts.people)}
    ${stat(L('Groups','المجموعات'),entry.counts.groups)}${stat(L('Official entries','القيود الرسمية'),entry.counts.registers)}</div>
    <nav class="toolbar oversight-jump" aria-label="${L('Oversight sections','أقسام الإشراف')}">${titles.map(([section,title])=>`<button class="btn btn-secondary btn-dense" data-oversight-jump="${section}">${title}</button>`).join('')}</nav>
    ${block('people',L('People','المؤمنون'),rows(entry.people.map(p=>[link(`#/oversight/${esc(id)}/person/${esc(p.id)}`,personName(p)),status(p.status),esc(L(p.town,p.townAr||p.town))]),
      [L('English / Arabic name','الاسم الإنكليزي / العربي'),L('Status','الحالة'),L('Town','البلدة')]))}
    ${block('records',L('Sacraments and requests','الأسرار والطلبات'),`<div class="toolbar" style="padding:14px;gap:8px"><input class="input" id="oversight-record-q" type="search" placeholder="${L('Search reference or person','ابحث عن المرجع أو الشخص')}" value="${esc(S.ui.oversightRecordQ||'')}">
      <select class="select" id="oversight-record-kind" aria-label="${L('Type','النوع')}"><option value="">${L('All types','كل الأنواع')}</option>${[...new Set(entry.records.map(r=>r.kind))].sort().map(x=>`<option value="${esc(x)}" ${kind===x?'selected':''}>${esc(x)}</option>`).join('')}</select>
      <select class="select" id="oversight-record-status" aria-label="${L('Status','الحالة')}"><option value="">${L('All statuses','كل الحالات')}</option>${[...new Set(entry.records.map(r=>r.status))].sort().map(x=>`<option value="${esc(x)}" ${state===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      ${rows(filtered.map(r=>[esc(r.reference||'—'),r.personId?link(`#/oversight/${esc(id)}/person/${esc(r.personId)}`,personName(r.person)):personName(r.person),esc(r.kind),fmtDate(r.date),status(r.status)]),
        [L('Reference','المرجع'),L('Person','الشخص'),L('Type','النوع'),L('Date','التاريخ'),L('Status','الحالة')])}`)}
    ${block('events',L('Calendar activities','أنشطة الرزنامة'),`<div class="toolbar" style="padding:14px"><div class="seg" role="group" aria-label="${L('View','العرض')}">
      <button data-oversight-view="list" aria-pressed="${eventsView==='list'}">${L('List','قائمة')}</button><button data-oversight-view="calendar" aria-pressed="${eventsView==='calendar'}">${L('Calendar','رزنامة')}</button></div></div>
      ${eventsView==='calendar'?calendar(entry.events):rows(entry.events.map(e=>[`<b>${esc(L(e.title,e.titleAr||e.title))}</b>`,fmtDate(e.date),esc(e.time||'—'),esc(e.kind)]),
        [L('Event','الحدث'),L('Date','التاريخ'),L('Time','الوقت'),L('Type','النوع')])}`)}
    ${block('groups',L('Group activity','نشاط المجموعات'),rows(entry.groups.map(g=>[link(`#/oversight/${esc(id)}/group/${esc(g.id)}`,`${esc(L(g.name,g.ar||g.name))} ↗`),String(g.members),String(g.meetings.length),
      g.attendance.percentage===null?'—':`${g.attendance.percentage}%`]),[L('Group','المجموعة'),L('Members','الأعضاء'),L('Meetings','الاجتماعات'),L('Recorded attendance','الحضور المسجل')]))}
    ${block('activity',L('Recent administrative activity','النشاط الإداري الأخير'),rows(entry.activity.map(a=>[esc(new Date(a.at).toLocaleString(document.documentElement.lang==='ar'?'ar-LB':'en-GB')),
      esc(a.actor),esc(a.action.replaceAll('.',' '))]),[L('When','الوقت'),L('By','بواسطة'),L('Activity','النشاط')]))}`;
}

oversight.mount=(host,id='')=>{
  host.querySelector('#oversight-parish')?.addEventListener('change',e=>{location.hash='#/oversight'+(e.target.value?'/'+e.target.value:'');});
  host.querySelectorAll('[data-oversight-jump]').forEach(b=>b.addEventListener('click',()=>host.querySelector(`#oversight-${b.dataset.oversightJump}`)?.scrollIntoView({behavior:'smooth',block:'start'})));
  for(const [selector,field] of [['#oversight-record-q','oversightRecordQ'],['#oversight-record-kind','oversightRecordKind'],['#oversight-record-status','oversightRecordStatus']])
    host.querySelector(selector)?.addEventListener(selector.includes('-q')?'input':'change',e=>{
      S.ui[field]=e.target.value;
      const selection=selector.includes('-q')?e.target.selectionStart:null;
      bus.refresh();
      if(selection!==null){const replacement=document.querySelector(selector);replacement?.focus();replacement?.setSelectionRange(selection,selection);}
    });
  host.querySelectorAll('[data-oversight-view]').forEach(b=>b.addEventListener('click',()=>{S.ui.oversightEventsView=b.dataset.oversightView;bus.refresh();}));
  host.querySelectorAll('[data-oversight-month]').forEach(b=>b.addEventListener('click',()=>{const [y,m]=monthKey().split('-').map(Number);S.ui.oversightMonth=dateKey(new Date(y,m-1+Number(b.dataset.oversightMonth),1)).slice(0,7);bus.refresh();}));
  const k=key(id),old=cache.get(k);
  if(old&&(old.loading||Date.now()-(old.loadedAt||0)<60_000))return;
  if(!old)cache.set(k,{loading:true});
  api(id?`parishes/${encodeURIComponent(id)}/oversight`:'oversight').then(data=>cache.set(k,{...data,loadedAt:Date.now()}))
    .catch(error=>cache.set(k,{error:error.message,loadedAt:Date.now()})).finally(()=>bus.refresh());
};

export function eparchy(){const parishes=session.parishes||[];return pageHead({title:L('Eparchy','الأبرشية'),sub:L('Read-only overview of parishes in your archdiocese.','نظرة عامة للقراءة فقط على رعايا الأبرشية.')})+
  `<div class="stats" style="margin:18px 0">${stat(L('Parishes','الرعايا'),parishes.length)}${stat(L('People','المؤمنون'),parishes.reduce((n,p)=>n+(p.people||0),0))}</div>`+
  rows(parishes.map(p=>[`${esc(p.name)}<small style="display:block">${esc(p.ar)}</small>`,esc(L(p.town,p.townAr||p.town)),link(`#/oversight/${esc(p.id)}`,L('View oversight','عرض الإشراف'))]),
    [L('Parish','الرعية'),L('Town','البلدة'),''])+`<p style="margin-top:18px">${link('#/assignments',L('View priest assignments','عرض تعيينات الكهنة'))}</p>`;}

export function mapView(){const parishes=session.parishes||[];return pageHead({title:L('Parish map','خريطة الرعايا'),sub:L('Find parishes in the eparchy.','تعرّف إلى رعايا الأبرشية.')})+
  `<p class="alert alert-info">${L('Exact parish coordinates have not been recorded. This list gives the known town without placing inaccurate map markers.',
    'لم تُسجّل الإحداثيات الدقيقة للرعايا بعد. تعرض هذه القائمة البلدات المعروفة دون وضع علامات غير دقيقة على الخريطة.')}</p><div style="margin-top:18px">`+
  rows(parishes.map(p=>[`${esc(p.name)}<small style="display:block">${esc(p.ar)}</small>`,esc(L(p.town,p.townAr||p.town)),link(`#/oversight/${esc(p.id)}`,L('View parish','عرض الرعية'))]),
    [L('Parish','الرعية'),L('Town','البلدة'),''])+'</div>';}
