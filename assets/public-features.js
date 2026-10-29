import { sanctuaryMarkup } from './home-sanctuary.js';
import { mountTurnstile } from './turnstile.js';
import { trackAction } from './beacon.js';
import { paginateCollections } from './collection-ui.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=(en,ar)=>document.documentElement.lang==='ar'?ar:en;
export const photos=['assets/images/church-light.jpg','assets/images/church-interior.jpg'];
export const parishPhotos=d=>[d?.parishPhoto,...(Array.isArray(d?.gallery)?d.gallery:[])].filter(src=>typeof src==='string'&&/^(https:\/\/|\/?assets\/images\/|data:image\/(png|jpeg|webp);base64,)/i.test(src));
const REQUEST_STATUS={submitted:['Sent to the parish office','أُرسل إلى مكتب الرعية'],'office-review':['The parish office is reviewing it','قيد المراجعة لدى مكتب الرعية'],'missing-documents':['Documents are missing','مستندات ناقصة'],'ready-for-collection':['Ready to collect from the parish','جاهز للاستلام من الرعية'],'ready-for-download':['Ready to download','جاهز للتنزيل'],closed:['Closed','مُغلق']};
export function bindRequest(host,p) {
  const form=host.querySelector('[data-guest-request]');if(!form)return;
  let check=null;
  mountTurnstile(form.querySelector('[data-turnstile]'),document.documentElement.lang==='ar'?'ar':'en').then(state=>{check=state;});
  form.onsubmit=async e=>{
    e.preventDefault();const b=form.querySelector('button[type=submit]'),error=form.querySelector('[data-request-error]');
    b.disabled=true;error.textContent='';
    try{
      const q={...Object.fromEntries(new FormData(form)),parish:p.id,responsibleAdult:form.elements.responsibleAdult.checked,...(check?{turnstile:check.token}:{})};
      const response=await fetch('/api/public/guest-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not send request.');
      trackAction('request-sent',p.id);
      const link=new URL('public.html',location.href);link.hash='track='+data.trackingToken;
      form.hidden=true;
      const result=host.querySelector('[data-request-result]');
      result.innerHTML=`<div class="rq-done"><svg class="rq-tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27.5l7 7 15-16"/></svg><h2>${L('Request received','تم استلام الطلب')}</h2><p>${L('Save this private link. Anyone with it can see this request’s status. No email or SMS has been sent.','احفظ هذا الرابط الخاص. يستطيع كل من يملكه الاطّلاع على حالة الطلب. لم تُرسل أي رسالة عبر البريد الإلكتروني أو الرسائل النصية.')}</p>
        <label class="rq-link"><span>${L('Private tracking link','رابط المتابعة الخاص')}</span><span class="rq-link-row"><input readonly dir="ltr" value="${esc(link.href)}"><button type="button" class="btn btn-small btn-ink-line" data-copy>${L('Copy','نسخ')}</button></span></label>
        <a class="btn btn-gilt" href="${esc(link.href)}">${L('Track my request','متابعة طلبي')}</a></div>`;
      const copy=result.querySelector('[data-copy]'),field=result.querySelector('input');
      copy.onclick=async()=>{try{await navigator.clipboard.writeText(field.value);copy.textContent=L('Copied','تم النسخ');}catch{field.select();}};
      result.scrollIntoView({block:'center',behavior:(matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-simple'))?'auto':'smooth'});
    }catch(err){error.textContent=err.message;b.disabled=false;check?.reset();}
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
    if((d.letters||[]).length)host.querySelector('.track').insertAdjacentHTML('beforeend',d.letters.map(letterSheet).join(''));
    host.querySelectorAll('[data-print-letter]').forEach(b=>b.onclick=()=>{document.body.classList.add('is-printing-letter');b.closest('.letter').classList.add('is-printing');print();setTimeout(()=>{document.body.classList.remove('is-printing-letter');b.closest('.letter').classList.remove('is-printing');},500);});
  }catch(e){host.querySelector('.track-card [role=status]').textContent=e.message;}
}

/* A letter from the parish office, with the writer's own signature and the code that checks it. */
const longDate=v=>{const d=new Date(v);return Number.isNaN(d.valueOf())?'':new Intl.DateTimeFormat(document.documentElement.lang==='ar'?'ar-LB':'en-GB',{dateStyle:'long'}).format(d);};
const drawing=path=>`<svg class="letter-sign" viewBox="0 0 400 140" aria-hidden="true" focusable="false"><path d="${String(path||'').replace(/[^MLQCZmlqcz0-9 .,-]/g,'')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function letterSheet(l){
  return `<article class="letter" aria-labelledby="letter-${esc(l.code)}"><header><span class="letter-mark" aria-hidden="true"><svg viewBox="0 0 28 34" fill="none" focusable="false"><path d="M4 32V14a10 10 0 0 1 20 0v18" stroke="currentColor" stroke-width="1.6"/><path d="M1 32.5h26" stroke="currentColor" stroke-width="1.6"/><circle cx="14" cy="20" r="3.2" fill="#D7A548"/></svg></span>
      ${l.parish?.name?`<span class="letter-from"><b>${esc(document.documentElement.lang==='ar'&&l.parish.ar?l.parish.ar:l.parish.name)}</b>${l.parish.town?`<small>${esc(l.parish.town)}</small>`:''}</span>`:''}<time>${esc(longDate(l.createdAt))}</time></header>
    <h2 id="letter-${esc(l.code)}" dir="auto">${esc(l.title)}</h2><div class="letter-body" dir="auto">${esc(l.body).replace(/\n/g,'<br>')}</div>
    <footer><div class="letter-signed">${l.drawing?drawing(l.drawing):''}<b>${esc(l.name)}</b>${l.role?`<span>${esc(l.role)}</span>`:''}</div>
      <div class="letter-check"><span>${L('Digitally signed','موقّعة رقمياً')}</span><a href="public.html?verify=${encodeURIComponent(l.code)}"><bdi>${esc(l.code)}</bdi></a><small>${L('Anyone can check this code on ParishLife.','يمكن لأي شخص التحقّق من هذا الرمز على ParishLife.')}</small></div></footer>
    <button type="button" class="btn btn-ink-line btn-small letter-print" data-print-letter>${L('Print or save as PDF','طباعة أو حفظ كـPDF')}</button></article>`;
}

/* Checking a signature: who signed which document, when, and whether it still matches. */
export async function verifyPage(host,code=''){
  const form=`<form class="verify-form" data-verify-form><label><span>${L('Signature code','رمز التوقيع')}</span><input name="code" value="${esc(code)}" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" dir="ltr" required></label><button class="btn btn-gilt">${L('Check','تحقّق')}</button></form>`;
  host.innerHTML=`<section class="verify site-wrap" data-plain-page><div class="verify-card"><span class="verify-seal" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" focusable="false"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2.4"/><circle cx="24" cy="24" r="14.5" stroke="currentColor" stroke-width="1.4"/><path d="M24 15v18M18 21h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
    <h1>${L('Check a signed document','التحقّق من وثيقة موقّعة')}</h1><p>${L('Certificates and letters signed on ParishLife carry a code. Enter it to see who signed, when, and whether the document is unchanged.','تحمل الشهادات والرسائل الموقّعة على ParishLife رمزاً. أدخله لترى من وقّع، ومتى، وهل بقيت الوثيقة كما هي.')}</p>
    ${form}<div class="verify-result" data-verify-result aria-live="polite"></div></div></section>`;
  const box=host.querySelector('[data-verify-result]');
  const check=async value=>{
    if(!value.trim())return;
    box.innerHTML=`<p role="status">${L('Checking…','جارٍ التحقّق…')}</p>`;
    try{
      const r=await fetch('/api/public/verify/'+encodeURIComponent(value.trim())),d=await r.json();if(!r.ok)throw new Error(d.error);
      if(!d.found){box.innerHTML=`<div class="verify-state is-critical">${L('No signature has this code. Check the code on the document.','لا توقيع بهذا الرمز. تحقّق من الرمز على الوثيقة.')}</div>`;return;}
      const ok=d.signatureValid&&!d.revokedAt&&d.contentMatches!==false;
      const state=d.revokedAt?['critical',L('This signature was withdrawn','سُحب هذا التوقيع')]:!d.signatureValid?['critical',L('This signature does not check out','هذا التوقيع غير صالح')]:d.contentMatches===false?['critical',L('The document was changed after it was signed','عُدّلت الوثيقة بعد توقيعها')]:['good',L('Valid signature','توقيع صالح')];
      const parish=document.documentElement.lang==='ar'?d.parish.ar||d.parish.name:d.parish.name||d.parish.ar;
      const kind=d.type==='certificate'?L('Certificate','شهادة'):L('Letter from the parish office','رسالة من مكتب الرعية');
      const when=new Intl.DateTimeFormat(document.documentElement.lang==='ar'?'ar-LB':'en-GB',{dateStyle:'long',timeStyle:'short'}).format(new Date(d.signedAt));
      box.innerHTML=`<div class="verify-state is-${state[0]}"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="${ok?'M4.2 10.4 8 14.2l7.8-8':'M10 3.2 17.4 16H2.6zM10 8.2v3.4M10 13.6v.9'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(state[1])}</div>
        <dl class="verify-facts"><div><dt>${L('Document','الوثيقة')}</dt><dd>${esc(kind)}${d.reference?` · <bdi>${esc(d.reference)}</bdi>`:''}${d.subject?` · ${esc(d.subject)}`:''}${d.type==='letter'?` · <span dir="auto">${esc(d.title)}</span>`:''}</dd></div>
          <div><dt>${L('Parish','الرعية')}</dt><dd>${esc(parish)}${d.parish.town?`, ${esc(d.parish.town)}`:''}</dd></div>
          <div><dt>${L('Signed by','وقّعها')}</dt><dd>${esc(d.signer)}${d.role?` · ${esc(d.role)}`:''}</dd></div>
          <div><dt>${L('Signed on','وُقّعت في')}</dt><dd>${esc(when)}</dd></div>
          <div><dt>${L('Fingerprint','البصمة')}</dt><dd><bdi class="verify-mono">${esc(d.fingerprint)}</bdi></dd></div></dl>
        <p class="verify-how">${L('The signature was made with the signer’s own passkey, unlocked with their face, fingerprint or PIN, over a fingerprint of this exact document.','صُنع التوقيع بمفتاح مرور الموقِّع، بعد فتحه بوجهه أو بصمته أو رمزه، على بصمة هذه الوثيقة بعينها.')}</p>`;
    }catch(e){box.innerHTML=`<div class="verify-state is-critical">${esc(e.message)}</div>`;}
  };
  host.querySelector('[data-verify-form]').addEventListener('submit',e=>{e.preventDefault();const v=e.target.elements.code.value;history.replaceState(null,'','public.html?verify='+encodeURIComponent(v.trim()));check(v);});
  if(code)check(code);
}
export { paginateCollections };

/* For parishes: the four bundles as arches (one gold light for each step up), how a parish
   joins, and the practical notes, in the words the bundles have always used. */
export function bundlePage(){
  const bundles=[
    ['presence','Presence','التعريف بالرعية',['Public parish page','Contact details','Ministries','Public calendar'],['صفحة الرعية العامة','معلومات التواصل','الخدمات','الرزنامة العامة']],
    ['office','Office','المكتب',['People and households','Requests','Sacramental records','Office expenses'],['الأشخاص والعائلات','الطلبات','سجلات الأسرار','مصاريف المكتب']],
    ['community','Community','المجتمع',['Office records and requests','Ministries and registrations','Resources and facilities'],['سجلات المكتب والطلبات','الخدمات والتسجيل','الموارد والمرافق']],
    ['complete','Complete','الكاملة',['Every available module','Sacraments','Parish finance'],['كل الوحدات المتاحة','الأسرار','مالية الرعية']]];
  const check='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const lights=n=>`<span class="fp-mark" aria-hidden="true"><svg viewBox="0 0 64 80" fill="none"><path d="M6 78V32a26 26 0 0 1 52 0v46" stroke="currentColor" stroke-width="1.5"/><path d="M1 78.5h62" stroke="currentColor" stroke-width="1.5"/>${Array.from({length:n},(_,i)=>`<circle cx="${32+(i-(n-1)/2)*11}" cy="${n>2&&i%2?50:56}" r="3.6" fill="#F1C77A"/>`).join('')}</svg></span>`;
  const notes=[[L('Ask through the members portal','اطلب عبر بوّابة المؤمنين'),L('A parish priest or the parish office opens the bundles in the portal and asks for the one that fits.','يفتح كاهن الرعية أو مكتبها الباقات في البوّابة ويطلب ما يناسب.')],
    [L('The parish or the diocese decides','الرعية أو الأبرشية تقرّر'),L('Parish priests may activate parish-managed bundles; diocese-sponsored changes are requests for diocesan approval.','يستطيع الكاهن تفعيل باقات الرعية؛ وتتطلب الباقات برعاية الأبرشية طلب موافقتها.')],
    [L('No online payment','لا دفع إلكتروني'),L('Subscriptions are managed manually at present. No online payment or automatic billing is configured.','تُدار الاشتراكات يدوياً حالياً. لا توجد دفعات إلكترونية أو فوترة تلقائية.')],
    [L('Records stay readable','تبقى السجلات قابلة للقراءة'),L('Existing records remain available to read when a module is removed.','تبقى السجلات قابلة للقراءة عند إزالة وحدة.')]];
  return `<div class="parish-sub fp" data-plain-page>
    <section class="sub-hero is-sanctuary" data-hero aria-labelledby="sub-title"><div class="sub-art sub-sanctuary" aria-hidden="true">${sanctuaryMarkup()}</div>
      <div class="site-wrap sub-inner"><nav class="ph-crumbs" aria-label="${L('Breadcrumb','مسار التنقّل')}" data-hero-rise><a href="public.html">ParishLife</a><span aria-hidden="true">/</span><span aria-current="page">${L('For parishes','للرعايا')}</span></nav>
        <h1 class="hero-title" id="sub-title">${L('Choose what your parish needs','اختر ما تحتاجه رعيتك')}</h1>
        <p data-hero-rise>${L('Start with a public presence or add tools for your parish office and community. Arrangements can cover one parish or several parishes in a diocese.','ابدأ بحضور عام أو أضف أدوات للمكتب والمجتمع الرعوي. يمكن أن يشمل الترتيب رعية واحدة أو عدة رعايا في أبرشية.')}</p></div></section>
    <section class="fp-bundles"><div class="site-wrap"><ol class="fp-grid">${bundles.map(([key,en,ar,items,itemsAr],i)=>`<li data-reveal-item><article class="fp-card${key==='complete'?' is-complete':''}" data-tilt>
      ${lights(i+1)}<h2>${L(en,ar)}</h2><p class="fp-other" lang="${document.documentElement.lang==='ar'?'en':'ar'}">${document.documentElement.lang==='ar'?en:ar}</p>
      <ul>${(document.documentElement.lang==='ar'?itemsAr:items).map(item=>`<li>${check}<span>${item}</span></li>`).join('')}</ul>
      <a class="btn ${key==='complete'?'btn-gilt':'btn-ink-line'}" href="index.html#/workspace">${L('Manage or request this bundle','إدارة الباقة أو طلبها')}</a></article></li>`).join('')}</ol></div></section>
    <section class="fp-how"><div class="site-wrap"><header class="sec-head" data-reveal><h2>${L('How a parish joins','كيف تنضمّ الرعية')}</h2><p>${L('Parish priests and offices join through their diocese. Parishioners sign in to the members portal to follow their parish.','ينضمّ كهنة الرعايا ومكاتبها عبر أبرشيتهم. ويدخل أبناء الرعية إلى بوّابة المؤمنين لمتابعة رعيتهم.')}</p></header>
      <ol class="fp-steps">${notes.map(([b,t])=>`<li data-reveal-item><b>${b}</b><span>${t}</span></li>`).join('')}</ol></div></section>
    <section class="join fp-join"><div class="join-art" aria-hidden="true">${['sky','far','near'].map(part=>`<img src="assets/images/valley/valley-wide-dusk-${part}.webp" alt="" loading="lazy" decoding="async">`).join('')}</div>
      <div class="site-wrap join-inner" data-reveal><h2>${L('Light your parish on the map','أضئ رعيتك على الخريطة')}</h2><p>${L('Every parish on ParishLife is a gold light on the map of Lebanon, with its own page, calendar and requests.','كل رعية على ParishLife نورٌ ذهبي على خريطة لبنان، ولها صفحتها ورزنامتها وطلباتها.')}</p>
      <div class="join-actions"><a class="btn btn-gilt" href="index.html#/workspace">${L('Open the members portal','ادخل إلى بوّابة المؤمنين')}</a><a class="btn btn-line" href="public.html#directory">${L('See the parishes','تصفّح الرعايا')}</a></div></div></section>
  </div>`;
}

/* A page that could not be shown: an unlit candle in an arch (the visitor may light it), what
   happened, and the way back. */
export function errorPage(title,body,actions){
  return `<div class="parish-sub" data-plain-page><section class="lost site-wrap"><div class="lost-card" data-reveal><button type="button" class="lost-arch" aria-pressed="false" aria-label="${L('Light a candle','أضئ شمعة')}"><span class="lost-candle"><i></i></span></button><h1>${title}</h1><p>${body}</p><div class="lost-actions">${actions}</div></div></section></div>`;
}
