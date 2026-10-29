import { reviewGuestLinks } from './guest-links.js';
import { api,session,parishAPI } from '../api.js';
import { SACRAMENTS, person } from '../data.js';
import { uploadFile } from '../request-documents.js';
import { t } from '../i18n.js';
import { esc,pageHead,openDrawer,closeOverlays,toast,icon } from '../ui.js';
import { sign, drawingSVG } from '../signing.js';
import { passkeyMessage } from '../passkeys.js';
import { paginateCollections } from '../collection-ui.js';
const names={submitted:['Submitted','مُرسل'],'office-review':['Office review','مراجعة المكتب'],'missing-documents':['Missing documents','مستندات ناقصة'],'ready-for-collection':['Ready for collection','جاهز للاستلام'],closed:['Closed','مغلق']};
names['ready-for-download']=['Ready for secure download','جاهز للتنزيل الآمن'];
export function guestRequests(){return pageHead({title:t('Guest requests','طلبات الزوّار'),sub:t('Requests submitted without an account. Responses appear on the applicant’s private tracking link.','طلبات مرسلة دون حساب. تظهر الردود على رابط المتابعة الخاص بمقدّم الطلب.')})+'<div data-guests aria-live="polite"></div>';}
guestRequests.mount=async host=>{
  const body=host.querySelector('[data-guests]');body.textContent=t('Loading…','جارٍ التحميل…');
  try{
    const data=await api('workspace/guest-requests?parish='+encodeURIComponent(session.parishId));if(!body.isConnected)return;
    body.innerHTML=`<a class="btn btn-secondary" href="#/requests">${t('All parish requests','كل طلبات الرعية')}</a><div class="collection-toolbar"><input class="input" type="search" data-search placeholder="${t('Search guest requests','ابحث في طلبات الزوّار')}" aria-label="${t('Search requests','البحث في الطلبات')}"><select class="select" data-status aria-label="${t('Status','الحالة')}"><option value="">${t('All statuses','كل الحالات')}</option>${Object.entries(names).map(([v,l])=>`<option value="${v}">${t(...l)}</option>`).join('')}</select></div><div class="tablewrap"><table class="tbl"><thead><tr>${[t('Applicant','مقدّم الطلب'),t('Type','النوع'),t('Contact','التواصل'),t('Status','الحالة'),t('Received','الاستلام'),t('Review','مراجعة')].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${data.requests.map(r=>`<tr data-search-text="${esc([r.details.name,r.details.description,r.details.email,r.details.phone].join(' ').toLowerCase())}" data-request-status="${esc(r.status)}"><td>${esc(r.details.name)}</td><td>${esc(r.details.kind)}</td><td>${esc(r.details.email||r.details.phone)}</td><td>${esc(names[r.status]?t(...names[r.status]):r.status)}</td><td>${esc(r.created_at.slice(0,10))}</td><td><button class="btn btn-secondary btn-dense" data-review="${esc(r.id)}">${t('Review','مراجعة')}${r.pendingLinks?' · '+r.pendingLinks+' '+t('account links','ربط حسابات'):''}</button></td></tr>`).join('')}</tbody></table></div>${data.requests.length?'':`<p>${t('No guest requests yet.','لا طلبات زوّار بعد.')}</p>`}`;
    const filter=()=>{const q=body.querySelector('[data-search]').value.toLowerCase().trim(),status=body.querySelector('[data-status]').value;body.querySelectorAll('[data-search-text]').forEach(r=>r.hidden=!r.dataset.searchText.includes(q)||!!status&&r.dataset.requestStatus!==status);};
    body.querySelector('[data-search]').oninput=filter;body.querySelector('[data-status]').onchange=filter;
    body.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{const r=data.requests.find(r=>r.id===b.dataset.review);openDrawer({title:r.details.name,body:`<p class="message-body">${esc(r.details.description)}</p><dl class="dl"><dt>${t('Email','البريد')}</dt><dd>${esc(r.details.email||'—')}</dd><dt>${t('Phone','الهاتف')}</dt><dd>${esc(r.details.phone||'—')}</dd><dt>${t('On behalf of','بالنيابة عن')}</dt><dd>${esc(r.details.behalf||'—')}</dd></dl><button class="btn btn-secondary" type="button" data-account-links>${t('Review account links','مراجعة ربط الحسابات')}</button>${['priest','secretary'].includes(session.user.role)?`<button class="btn btn-secondary" type="button" data-documents>${t('Documents and secure delivery','المستندات والتسليم الآمن')}</button>`:''}<button class="btn btn-secondary" type="button" data-letter>${icon('edit',15)}${t('Write a signed letter','كتابة رسالة موقّعة')}</button><form><label class="formrow"><span class="label">${t('Status','الحالة')}</span><select class="select" name="status">${Object.entries(names).map(([v,l])=>`<option value="${v}" ${r.status===v?'selected':''}>${t(...l)}</option>`).join('')}</select></label><label class="formrow"><span class="label">${t('Response for the applicant','ردّ لمقدّم الطلب')}</span><textarea class="textarea" name="response" maxlength="2000" rows="6">${esc(r.response)}</textarea></label><p role="alert" class="help-error"></p><button class="btn btn-primary">${t('Save response','حفظ الرد')}</button></form>`,onMount(el){el.querySelector('[data-account-links]')?.addEventListener('click',()=>reviewGuestLinks(r));el.querySelector('[data-documents]')?.addEventListener('click',()=>guestFiles(r,()=>guestRequests.mount(host)));el.querySelector('[data-letter]')?.addEventListener('click',()=>signedLetter(r,()=>guestRequests.mount(host)));const form=el.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await api('workspace/guest-requests','POST',{...Object.fromEntries(new FormData(form)),id:r.id});closeOverlays();await guestRequests.mount(host);toast(t('Saved','تم الحفظ'),'','success');}catch(err){form.querySelector('[role=alert]').textContent=err.message;button.disabled=false;}};}});});paginateCollections(body);
  }catch(e){if(body.isConnected)body.textContent=e.message;}
};

/* A letter to the applicant, signed with the writer's own signature and sent at once: it appears
   on the applicant's private tracking page with a code that checks it. */
async function signedLetter(request,refresh){
  let mine=null;try{mine=(await api('account/signature')).signer;}catch{}
  openDrawer({title:t('Signed letter','رسالة موقّعة'),large:true,body:`<form class="sig-letter">
    <p class="help">${t('To','إلى')}: <b>${esc(request.details.name)}</b> · ${t('It appears on their private tracking page as soon as you sign it.','تظهر على صفحة المتابعة الخاصة به فور توقيعها.')}</p>
    <label class="formrow"><span class="label">${t('Subject','الموضوع')}</span><input class="input" name="title" required minlength="3" maxlength="160" dir="auto"></label>
    <label class="formrow"><span class="label">${t('Letter','الرسالة')}</span><textarea class="textarea" name="body" rows="12" required minlength="10" maxlength="6000" dir="auto"></textarea></label>
    ${mine?`<figure class="sig-card is-small">${drawingSVG(mine.drawing)}<figcaption><b>${esc(session.user.name)}</b>${mine.title?`<span>${esc(mine.title)}</span>`:''}</figcaption></figure>
      <p class="help">${icon('lock',15)}${t('Signing asks for your face, fingerprint or PIN.','يطلب التوقيع وجهك أو بصمتك أو رمزك.')}</p>`
      :`<p class="help-error">${t('Set up your signature under My account before signing letters.','أعدّ توقيعك في «حسابي» قبل توقيع الرسائل.')} <a href="#/account">${t('Open My account','فتح حسابي')}</a></p>`}
    <p role="alert" class="help-error"></p><button class="btn btn-primary" ${mine?'':'disabled'}>${t('Sign and send','التوقيع والإرسال')}</button></form>`,onMount(el){
    const form=el.querySelector('form');
    form.onsubmit=async e=>{
      e.preventDefault();const button=form.querySelector('button'),alert=form.querySelector('[role=alert]');button.disabled=true;alert.textContent='';
      const letter={parish:request.parish_id||session.parishId,request:request.id,title:form.elements.title.value.trim(),body:form.elements.body.value.trim()};
      try{const result=await api('sign/letter','POST',{...letter,signature:await sign({type:'letter',...letter})});closeOverlays();await refresh();
        toast(t('Letter signed and sent','وُقّعت الرسالة وأُرسلت'),t(`Check code ${result.code}`,`رمز التحقّق ${result.code}`),'success');}
      catch(err){alert.textContent=passkeyMessage(err,t);button.disabled=false;}
    };
  }});
}

function guestFiles(request,refresh){
  openDrawer({title:t('Request documents','مستندات الطلب'),body:`<p>${esc(request.details.name)}</p><p class="help">${t('Uploads stay private to the office until you explicitly release a file to the applicant.','تبقى الملفات خاصة بالمكتب حتى تسمح بإرسال ملف محدّد لمقدّم الطلب.')}</p><label class="formrow"><span class="label">${t('Attach PDF, JPG or PNG (up to 10 MB)','إرفاق PDF أو JPG أو PNG (حتى ١٠ ميغابايت)')}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" data-upload></label><div data-files></div><p role="alert" class="help-error"></p>`,onMount(el){
    const load=async()=>{
      try{
        const {files}=await parishAPI('files?scope=guest-request&id='+encodeURIComponent(request.id));
        if(!el.isConnected)return;
        el.querySelector('[data-files]').innerHTML=files.map(f=>`<article class="ministry-request"><h3>${esc(f.name)}</h3><div class="account-actions"><a class="btn btn-secondary" target="_blank" rel="noopener" href="/api/parishes/${encodeURIComponent(session.parishId)}/files/${encodeURIComponent(f.id)}">${t('Review file','مراجعة الملف')}</a><button class="btn btn-primary" data-release="${esc(f.id)}">${t('Release to applicant','إتاحة لمقدّم الطلب')}</button><button class="btn btn-secondary" data-remove="${esc(f.id)}">${t('Remove file','إزالة الملف')}</button></div></article>`).join('')||`<p>${t('No documents attached.','لا مستندات مرفقة.')}</p>`;
        el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await parishAPI('files/'+encodeURIComponent(b.dataset.remove),'DELETE',{});await load();}catch(e){el.querySelector('[role=alert]').textContent=e.message;b.disabled=false;}});
        el.querySelectorAll('[data-release]').forEach(b=>b.onclick=()=>{
          const issued=SACRAMENTS.filter(s=>s.kind==='certificate'&&s.status==='issued'&&(!s.bishopReview||s.bishopReview==='accepted'));
          openDrawer({title:t('Release a reviewed document','إتاحة مستند تمت مراجعته'),body:`<form>${request.details.kind==='certificate'?`<label class="formrow"><span class="label">${t('Signed certificate accepted by the bishop','شهادة موقّعة ومقبولة من المطران')}</span><select class="select" name="recordId" required><option value="">${t('Choose matching certificate','اختر الشهادة المطابقة')}</option>${issued.map(s=>`<option value="${esc(s.id)}">${esc(s.reg)} · ${esc(person(s.person)?.lat||'')}</option>`).join('')}</select></label>`:''}<label class="check"><input type="checkbox" name="verified" required>${t('I verified the applicant’s identity and checked that this is the correct document.','تحققت من هوية مقدّم الطلب ومن أن هذا المستند هو المطلوب.')}</label><p class="help">${t('Anyone with the private tracking link will be able to download this file.','سيتمكن حامل رابط المتابعة الخاص من تنزيل هذا الملف.')}</p><p role="alert" class="help-error"></p><button class="btn btn-primary">${t('Release document','إتاحة المستند')}</button></form>`,onMount(drawer){const form=drawer.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await api('workspace/release-document','POST',{...Object.fromEntries(new FormData(form)),id:request.id,fileId:b.dataset.release,verified:form.elements.verified.checked});closeOverlays();await refresh();}catch(err){form.querySelector('[role=alert]').textContent=err.message;button.disabled=false;}};}});
        });
      }catch(e){if(el.isConnected)el.querySelector('[role=alert]').textContent=e.message;}
    };
    el.querySelector('[data-upload]').onchange=async e=>{const input=e.target,file=input.files[0];if(!file)return;input.disabled=true;try{await uploadFile('guest-request',request.id,file);await load();}catch(err){el.querySelector('[role=alert]').textContent=err.message;}finally{input.disabled=false;input.value='';}};load();
  }});
}
