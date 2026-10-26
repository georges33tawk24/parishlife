import { api,session,loadSession } from '../api.js';
import { t } from '../i18n.js';
import { esc,pageHead,openDrawer,closeOverlays } from '../ui.js';
import { paginateCollections } from '../collection-ui.js';

export function membershipReviews(){return pageHead({title:t('Parish membership requests','طلبات عضوية الرعية'),sub:t('Confirm the applicant’s identity and link their account to one parish person record.','تحقّق من هوية مقدّم الطلب واربط حسابه بسجل شخص واحد في الرعية.')})+'<div data-memberships></div>';}
membershipReviews.mount=async host=>{
  const body=host.querySelector('[data-memberships]');body.textContent=t('Loading…','جارٍ التحميل…');
  try{
    const data=await api('workspace/membership?parish='+encodeURIComponent(session.parishId));if(!body.isConnected)return;
    body.innerHTML=`<div class="account-actions"><a class="btn btn-secondary" href="#/requests">${t('All requests','كل الطلبات')}</a><a class="btn btn-secondary" href="#/people">${t('People · add a record if needed','المؤمنون · إضافة سجل عند الحاجة')}</a></div><div class="account-parishes" data-paginate>${data.memberships.map(m=>`<article><div><h3>${esc(m.name)}</h3><p>${esc(m.username)}</p></div><button class="btn btn-primary" data-review="${esc(m.user_id)}">${t('Review','مراجعة')}</button></article>`).join('')||`<p>${t('No pending membership requests.','لا طلبات عضوية معلّقة.')}</p>`}</div>`;
    body.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{
      const m=data.memberships.find(m=>m.user_id===b.dataset.review),p=m.profile;
      openDrawer({title:m.name,body:`<dl class="dl">${[['birthDate','Date of birth','تاريخ الميلاد'],['email','Email','البريد'],['phone','Phone','الهاتف'],['address','Address','العنوان'],['town','Town','البلدة'],['occupation','Occupation','المهنة']].map(([key,en,ar])=>`<dt>${t(en,ar)}</dt><dd>${esc(p[key]||'—')}</dd>`).join('')}</dl><p class="help">${t('Information supplied by the applicant. Review it before linking an existing record; no person is created automatically.','هذه المعلومات قدّمها صاحب الطلب. راجعها قبل الربط بسجل موجود؛ لا يُنشأ شخص تلقائياً.')}</p><form><label class="formrow"><span class="label">${t('Decision','القرار')}</span><select class="select" name="status"><option value="approved">${t('Approve membership','الموافقة على العضوية')}</option><option value="declined">${t('Decline','رفض')}</option></select></label><label class="formrow"><span class="label">${t('Existing parish person','الشخص المسجّل في الرعية')}</span><select class="select" name="personId"><option value="">${t('Choose a person when approving','اختر شخصاً عند الموافقة')}</option>${data.people.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><p role="alert" class="help-error"></p><button class="btn btn-primary">${t('Save decision','حفظ القرار')}</button></form>`,onMount(el){const f=el.querySelector('form');f.onsubmit=async e=>{e.preventDefault();const button=f.querySelector('button');button.disabled=true;try{await api('workspace/membership','POST',{...Object.fromEntries(new FormData(f)),parish:session.parishId,userId:m.user_id});closeOverlays();await loadSession();await membershipReviews.mount(host);}catch(err){f.querySelector('[role=alert]').textContent=err.message;button.disabled=false;}};}});
    });paginateCollections(body);
  }catch(e){if(body.isConnected)body.textContent=e.message;}
};
