import { paginateCollections } from './collection-ui.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=(en,ar)=>document.documentElement.lang==='ar'?ar:en;
export const photos=['assets/images/church-light.jpg','assets/images/church-interior.jpg'];
export const parishPhotos=d=>[d?.parishPhoto,...(Array.isArray(d?.gallery)?d.gallery:[])].filter(src=>typeof src==='string'&&/^(https:\/\/|\/?assets\/images\/|data:image\/(png|jpeg|webp);base64,)/i.test(src));
const REQUEST_STATUS={submitted:['Sent to the parish office','أُرسل إلى مكتب الرعية'],'office-review':['The parish office is reviewing it','قيد المراجعة لدى مكتب الرعية'],'missing-documents':['Documents are missing','مستندات ناقصة'],'ready-for-collection':['Ready to collect from the parish','جاهز للاستلام من الرعية'],'ready-for-download':['Ready to download','جاهز للتنزيل'],closed:['Closed','مُغلق']};
export function bindRequest(host,p) {
  const form=host.querySelector('[data-guest-request]');if(!form)return;
  form.onsubmit=async e=>{
    e.preventDefault();const b=form.querySelector('button[type=submit]'),error=form.querySelector('[data-request-error]');
    b.disabled=true;error.textContent='';
    try{
      const q={...Object.fromEntries(new FormData(form)),parish:p.id,responsibleAdult:form.elements.responsibleAdult.checked};
      const response=await fetch('/api/public/guest-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not send request.');
      const link=new URL('public.html',location.href);link.hash='track='+data.trackingToken;
      form.hidden=true;
      const result=host.querySelector('[data-request-result]');
      result.innerHTML=`<div class="rq-done"><svg class="rq-tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27.5l7 7 15-16"/></svg><h2>${L('Request received','تم استلام الطلب')}</h2><p>${L('Save this private link. Anyone with it can see this request’s status. No email or SMS has been sent.','احفظ هذا الرابط الخاص. يستطيع كل من يملكه الاطّلاع على حالة الطلب. لم تُرسل أي رسالة عبر البريد الإلكتروني أو الرسائل النصية.')}</p>
        <label class="rq-link"><span>${L('Private tracking link','رابط المتابعة الخاص')}</span><span class="rq-link-row"><input readonly dir="ltr" value="${esc(link.href)}"><button type="button" class="btn btn-small btn-ink-line" data-copy>${L('Copy','نسخ')}</button></span></label>
        <a class="btn btn-gilt" href="${esc(link.href)}">${L('Track my request','متابعة طلبي')}</a></div>`;
      const copy=result.querySelector('[data-copy]'),field=result.querySelector('input');
      copy.onclick=async()=>{try{await navigator.clipboard.writeText(field.value);copy.textContent=L('Copied','تم النسخ');}catch{field.select();}};
      result.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }catch(err){error.textContent=err.message;b.disabled=false;}
  };
}
/* The private tracking page: where the request stands, as four steps, and any documents. */
const TRACK_STEPS=[['submitted','Sent','أُرسل'],['office-review','Under review','قيد المراجعة'],['ready','Ready','جاهز'],['closed','Closed','مُغلق']];
export async function trackingPage(host,token) {
  host.innerHTML=`<section class="track site-wrap"><div class="track-card"><span class="track-lamp" aria-hidden="true"></span><h1>${L('Your request','طلبك')}</h1><p role="status">${L('Loading…','جارٍ التحميل…')}</p></div></section>`;
  try{
    const r=await fetch('/api/public/track/'+encodeURIComponent(token)),d=await r.json();if(!r.ok)throw new Error(d.error);
    const updated=new Date(d.updated_at),status=String(d.status||'submitted');
    const at=status==='closed'?3:/^ready/.test(status)?2:status==='submitted'?0:1,warn=status==='missing-documents';
    host.querySelector('.track-card').innerHTML=`<span class="track-lamp" aria-hidden="true"></span><h1>${L('Your request','طلبك')}</h1>
      <ol class="track-steps">${TRACK_STEPS.map(([k,en,ar],i)=>`<li class="${i<at?'is-done':i===at?'is-current'+(warn?' is-warn':''):''}"${i===at?' aria-current="step"':''}><span aria-hidden="true"></span>${L(en,ar)}</li>`).join('')}</ol>
      <h2>${esc(L(...(REQUEST_STATUS[status]||[status.replaceAll('-',' '),status.replaceAll('-',' ')])))}</h2><p dir="auto">${esc(d.response||L('The parish office has received your request.','استلم مكتب الرعية طلبك.'))}</p>
      ${Number.isNaN(updated.valueOf())?'':`<small>${esc(L('Updated ','آخر تحديث: ')+new Intl.DateTimeFormat(document.documentElement.lang==='ar'?'ar-LB':'en-GB',{dateStyle:'long',timeStyle:'short'}).format(updated))}</small>`}
      ${(d.files||[]).length?`<div class="track-files">${d.files.map(f=>`<a class="btn btn-gilt" referrerpolicy="no-referrer" href="/api/public/guest-files/${encodeURIComponent(token)}/${encodeURIComponent(f.id)}" download>${L('Download','تنزيل')}: ${esc(f.name)}</a>`).join('')}</div>`:''}
      <p class="track-note">${L('Keep this page’s link private: anyone who has it can see this request.','احتفظ برابط هذه الصفحة لنفسك: يستطيع كل من يملكه رؤية هذا الطلب.')}</p>`;
  }catch(e){host.querySelector('.track-card [role=status]').textContent=e.message;}
}
export { paginateCollections };

export function bundlePage(){
  const bundles=[['Presence','التعريف بالرعية','Public parish profile, contact details, ministries and public calendar.','صفحة الرعية العامة والتواصل والخدمات والرزنامة.'],['Office','المكتب','People, households, office expenses, requests and sacramental records.','الأشخاص والعائلات ومصاريف المكتب والطلبات وسجلات الأسرار.'],['Community','المجتمع','Office records, requests, ministries, registrations, resources and facilities.','سجلات المكتب والطلبات والخدمات والتسجيل والموارد والمرافق.'],['Complete','الكاملة','All available modules, including sacraments and parish finance.','كل الوحدات المتاحة بما فيها الأسرار ومالية الرعية.']];
  return `<section class="section site-wrap"><span class="eyebrow">ParishLife</span><h1>${L('Choose what your parish needs','اختر ما تحتاجه رعيتك')}</h1><p>${L('Start with a public presence or add tools for your parish office and community. Arrangements can cover one parish or several parishes in a diocese.','ابدأ بحضور عام أو أضف أدوات للمكتب والمجتمع الرعوي. يمكن أن يشمل الترتيب رعية واحدة أو عدة رعايا في أبرشية.')}</p><div class="public-info-grid">${bundles.map(([en,ar,desc,descAr])=>`<article class="contact-panel"><h2>${L(en,ar)}</h2><p>${L(desc,descAr)}</p><a class="button" href="index.html#/workspace">${L('Manage or request this bundle','إدارة الباقة أو طلبها')}</a></article>`).join('')}</div><p>${L('Subscriptions are managed manually at present. No online payment or automatic billing is configured. Parish priests may activate parish-managed bundles; diocese-sponsored changes are requests for diocesan approval. Existing records remain available to read when a module is removed.','تُدار الاشتراكات يدوياً حالياً. لا توجد دفعات إلكترونية أو فوترة تلقائية. يستطيع الكاهن تفعيل باقات الرعية؛ وتتطلب الباقات برعاية الأبرشية طلب موافقتها. تبقى السجلات قابلة للقراءة عند إزالة وحدة.')}</p></section>`;
}
