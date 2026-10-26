import { api } from '../api.js';
import { t } from '../i18n.js';
import { esc, pageHead, panel, openDrawer, closeOverlays, toast } from '../ui.js';
import { paginateCollections } from '../collection-ui.js';

const L=t, open=['requested','awaiting-priest','withdrawal-requested','leave-requested'];
const statuses={requested:['Awaiting leader or priest','بانتظار المسؤول أو الكاهن'],'awaiting-priest':['Awaiting priest','بانتظار الكاهن'],'withdrawal-requested':['Withdrawal awaiting approval','سحب الطلب بانتظار الموافقة'],'leave-requested':['Private departure review','مراجعة مغادرة خاصة'],approved:['Membership approved','تمّت الموافقة على العضوية'],ended:['Membership ended','انتهت العضوية'],withdrawn:['Request withdrawn','تمّ سحب الطلب'],declined:['Request declined','تمّ رفض الطلب']};
const label=s=>statuses[s]?L(...statuses[s]):s;
let filter='all',query='';

export function ministryRequests(){
  return pageHead({title:L('Ministries and membership','الخدمات والعضوية'),sub:L('Explore ministries, follow applications and review requests within your role.','استكشف الخدمات وتابع طلباتك وراجع الطلبات ضمن صلاحياتك.')})+'<div data-ministry-requests aria-live="polite"></div>';
}
ministryRequests.mount=async host=>{
  const body=host.querySelector('[data-ministry-requests]');body.textContent=L('Loading…','جارٍ التحميل…');
  try{
    const data=await api('ministry-requests');if(!body.isConnected)return;
    const refresh=()=>ministryRequests.mount(host);
    const requestCard=r=>`<article class="ministry-request"><div><h3>${esc(r.groupName)} · ${esc(r.name)}</h3><p>${esc(r.parishName)}</p><span class="pill">${esc(label(r.status))}</span>${r.kind==='leave'?`<p class="help">${L('Private to the applicant and parish priests.','خاص بمقدّم الطلب وكهنة الرعية.')}</p>`:''}<p class="message-body">${esc(r.reason)}</p></div><div class="account-actions">${r.own&&open.includes(r.status)&&r.status!=='withdrawal-requested'?`<button class="btn btn-secondary" data-action="withdraw" data-id="${esc(r.id)}">${r.leader_at?L('Request withdrawal','طلب سحب الطلب'):L('Withdraw request','سحب الطلب')}</button>`:''}${!r.own&&r.canReview&&open.includes(r.status)?`${r.status!=='awaiting-priest'||r.priest?`<button class="btn btn-primary" data-action="approve" data-id="${esc(r.id)}">${r.status==='withdrawal-requested'?L('Approve withdrawal','الموافقة على السحب'):r.kind==='leave'?L('Approve departure','الموافقة على المغادرة'):r.priest?L('Approve membership','الموافقة على العضوية'):L('Approve and send to priest','موافقة وإرسال للكاهن')}</button>`:''}<button class="btn btn-secondary" data-action="decline" data-id="${esc(r.id)}">${L('Decline','رفض')}</button>`:''}</div></article>`;
    body.innerHTML=`<div class="collection-toolbar"><input class="input" type="search" data-search aria-label="${L('Search ministries','البحث في الخدمات')}" placeholder="${L('Search ministries','البحث في الخدمات')}" value="${esc(query)}"><select class="select" data-filter aria-label="${L('Request view','عرض الطلبات')}">${[['all',L('All requests','كل الطلبات')],['own',L('My requests','طلباتي')],['review',L('Needs my review','تحتاج مراجعتي')]].map(([v,s])=>`<option value="${v}">${s}</option>`).join('')}</select></div><div data-request-list></div>${panel(L('Explore your parishes’ ministries','استكشف خدمات رعاياك'),`<div class="inbox-grid" data-catalog data-paginate>${data.ministries.map(g=>{const pending=data.requests.some(r=>r.own&&r.group_id===g.id&&r.parish_id===g.parish&&open.includes(r.status));return `<article class="inbox-card" data-name="${esc((g.name+' '+g.parishName).toLowerCase())}"><h3>${esc(g.name)}</h3><p>${esc(g.parishName)}</p><p>${esc(g.description)}</p><button class="btn btn-secondary" data-group="${esc(g.id)}" data-parish="${esc(g.parish)}" ${pending?'disabled':''}>${pending?L('Request in progress','الطلب قيد المعالجة'):g.member?L('Request to leave','طلب مغادرة'):L('Request to join','طلب انضمام')}</button></article>`;}).join('')||`<p>${L('Follow a parish in Complete Profile to discover its ministries.','تابع رعية في إكمال الملف لاكتشاف خدماتها.')}</p>`}</div>`)}`;
    const render=()=>{
      const rows=data.requests.filter(r=>(filter!=='own'||r.own)&&(filter!=='review'||r.canReview&&!r.own&&open.includes(r.status))&&[r.groupName,r.name,r.parishName].join(' ').toLowerCase().includes(query.toLowerCase().trim()));
      body.querySelector('[data-request-list]').innerHTML=panel(L('Requests','الطلبات'),`<div class="account-parishes" data-paginate>${rows.map(requestCard).join('')||`<p>${L('No matching requests.','لا طلبات مطابقة.')}</p>`}</div>`);
      body.querySelectorAll('[data-name]').forEach(el=>el.hidden=!el.dataset.name.includes(query.toLowerCase().trim()));
      body.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
        const r=data.requests.find(r=>r.id===b.dataset.id);
        submit(L('Confirm decision','تأكيد القرار'),`<p>${esc(r.groupName)} · ${esc(r.name)}</p><p>${esc(b.textContent)}</p>`,()=>api('ministry-requests','POST',{action:b.dataset.action,id:r.id,version:r.updated_at}),refresh);
      });paginateCollections(body);
    };
    body.querySelector('[data-filter]').value=filter;body.querySelector('[data-filter]').onchange=e=>{filter=e.target.value;render();};
    body.querySelector('[data-search]').oninput=e=>{query=e.target.value;render();};
    body.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{
      const g=data.ministries.find(g=>g.id===b.dataset.group&&g.parish===b.dataset.parish);
      submit(g.member?L('Request to leave ministry','طلب مغادرة الخدمة'):L('Request to join ministry','طلب الانضمام للخدمة'),`<p>${esc(g.name)} · ${esc(g.parishName)}</p><p class="help">${g.member?L('Only you and the parish priests can see this request and its note. Your membership remains active until a priest approves.','فقط أنت وكهنة الرعية يمكنكم رؤية هذا الطلب وملاحظته. تبقى عضويتك نشطة حتى موافقة الكاهن.'):L('The leader reviews your application, followed by a priest. A priest may approve directly.','يراجع المسؤول طلبك ثم الكاهن. يستطيع الكاهن الموافقة مباشرة.')}</p><label class="formrow"><span class="label">${L('Optional note','ملاحظة اختيارية')}</span><textarea class="textarea" name="reason" maxlength="2000" rows="5"></textarea></label>`,q=>api('ministry-requests','POST',{...q,action:g.member?'leave':'join',parish:g.parish,group:g.id}),refresh);
    });render();
  }catch(e){if(body.isConnected)body.textContent=e.message;}
};
function submit(title,body,save,refresh){
  openDrawer({title,body:`<form>${body}<p class="help-error" role="alert"></p><button class="btn btn-primary">${L('Confirm','تأكيد')}</button></form>`,onMount(el){const f=el.querySelector('form');f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('button');b.disabled=true;try{await save(Object.fromEntries(new FormData(f)));closeOverlays();await refresh();toast(L('Saved','تم الحفظ'),'','success');}catch(err){f.querySelector('[role=alert]').textContent=err.message;b.disabled=false;}};}});
}
