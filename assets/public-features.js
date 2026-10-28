import { calendarView, bindCalendar, paginateCollections } from './collection-ui.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=(en,ar)=>document.documentElement.lang==='ar'?ar:en;
export const photos=['assets/images/church-light.jpg','assets/images/church-interior.jpg'];
export const parishPhotos=d=>[d?.parishPhoto,...(Array.isArray(d?.gallery)?d.gallery:[])].filter(src=>typeof src==='string'&&/^(https:\/\/|\/?assets\/images\/|data:image\/(png|jpeg|webp);base64,)/i.test(src));
export function communitySlider() {
  const slides=[
    [L('A shared prayer. A familiar face.','صلاة مشتركة. وجه مألوف.'),L('Discover the everyday moments that make a parish a community.','اكتشف اللحظات اليومية التي تصنع جماعة الرعية.'),photos[0]],
    [L('There is a place for your gifts.','هناك مكان لمواهبك.'),L('Explore parish ministries, from music and service to learning together.','اكتشف خدمات الرعية، من الموسيقى والخدمة إلى التعلّم معاً.'),photos[1]],
    [L('Gather for what matters.','اجتمعوا لما يهمّ.'),L('Find celebrations and upcoming gatherings in your parish calendar.','اكتشف الاحتفالات واللقاءات القادمة في رزنامة رعيتك.'),photos[0]],
    [L('A community through every season.','جماعة في كل المواسم.'),L('Keep close to your village parish and the community where you live.','ابقَ قريباً من رعية قريتك والجماعة التي تعيش فيها.'),photos[1]]
  ];
  return `<section id="events" class="community-carousel" aria-roledescription="${L('carousel','عرض شرائح')}" aria-label="${L('More than a place','أكثر من مكان')}">
    <div class="carousel-heading site-wrap"><span class="eyebrow">${L('MORE THAN A PLACE','أكثر من مكان')}</span><h2>${L('Where faith finds its community.','حيث يجد الإيمان جماعته.')}</h2></div>
    <div class="carousel-slides">${slides.map(([title,body,image],i)=>`<article data-slide="${i}" ${i?'hidden':''}><img src="${image}" alt="${L('Illustrative parish photograph','صورة توضيحية للرعية')}" ${i?'loading="lazy"':''}><div class="site-wrap"><h3>${title}</h3><p>${body}</p></div></article>`).join('')}</div>
    <div class="carousel-controls site-wrap"><button data-carousel-prev aria-label="${L('Previous slide','الشريحة السابقة')}">‹</button><div class="carousel-indicators">${slides.map((_,i)=>`<button data-carousel-go="${i}" aria-label="${L('Slide','الشريحة')} ${i+1}" aria-current="${i===0}"></button>`).join('')}</div><button data-carousel-next aria-label="${L('Next slide','الشريحة التالية')}">›</button><button data-carousel-pause>${L('Pause','إيقاف')}</button></div></section>`;
}
let carouselCleanup;
export function bindSlider(host) {
  carouselCleanup?.();
  const el=host.querySelector('.community-carousel');if(!el)return;
  let index=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,hover=false,focus=false,startX=null;
  const slides=[...el.querySelectorAll('[data-slide]')],indicators=[...el.querySelectorAll('[data-carousel-go]')],pause=el.querySelector('[data-carousel-pause]');
  const show=i=>{index=(i+slides.length)%slides.length;slides.forEach((s,n)=>s.hidden=n!==index);indicators.forEach((b,n)=>b.setAttribute('aria-current',n===index));};
  const pauseLabel=()=>pause.textContent=paused?L('Play','تشغيل'):L('Pause','إيقاف');
  pauseLabel();
  indicators.forEach(b=>b.onclick=()=>{paused=true;pauseLabel();show(Number(b.dataset.carouselGo));});
  el.querySelector('[data-carousel-prev]').onclick=()=>show(index-1);
  el.querySelector('[data-carousel-next]').onclick=()=>show(index+1);
  pause.onclick=()=>{paused=!paused;pauseLabel();};
  el.onmouseenter=()=>hover=true;el.onmouseleave=()=>hover=false;
  el.onfocusin=()=>focus=true;el.onfocusout=e=>focus=el.contains(e.relatedTarget);
  el.addEventListener('touchstart',e=>startX=e.touches[0].clientX,{passive:true});
  el.addEventListener('touchend',e=>{if(startX!==null&&Math.abs(e.changedTouches[0].clientX-startX)>45){show(index+(e.changedTouches[0].clientX<startX?1:-1));paused=true;pauseLabel();}startX=null;},{passive:true});
  const timer=setInterval(()=>{if(el.isConnected&&!paused&&!hover&&!focus&&!document.hidden)show(index+1);},5000);
  carouselCleanup=()=>clearInterval(timer);
}
const calendarState={mode:'month'};
export function parishExtras(p,d,calendarOnly=false) {
  if(calendarOnly)return `<section class="section site-wrap"><a class="text-link" href="public.html?parish=${encodeURIComponent(p.id)}">${L('Back to parish','العودة إلى الرعية')}</a><h1>${L('Calendar','رزنامة')} ${esc(L(p.name,p.ar||p.name))}</h1><div data-public-calendar></div><div data-event-detail role="status"></div></section>`;
  const visit=d.visit||{};
  const custom=parishPhotos(d);
  const gallery=custom.length?custom:photos;
  return `<section class="section site-wrap"><div class="section-head"><h2>${L('Meet your parish','تعرّف على رعيتك')}</h2></div><div class="public-info-grid">
    <article class="contact-panel"><h3>${L('Clergy','الإكليروس')}</h3>${d.clergy?.length?d.clergy.map(c=>`<p><b>${esc(c.name)}</b> · ${esc(c.title)}</p>`).join(''):`<p>${L('The parish office can provide the current clergy details.','يمكن لمكتب الرعية تقديم معلومات الكهنة الحاليين.')}</p>`}<p>${L('Contact clergy and ministry leaders through the parish office.','تواصل مع الكهنة ومسؤولي الخدمات عبر مكتب الرعية.')}</p></article>
    <article class="contact-panel"><h3>${L('Plan your visit','خطّط لزيارتك')}</h3><dl>${[['officeHours','Office hours','ساعات المكتب'],['confessionTimes','Confession','الاعتراف'],['accessibility','Accessibility','إمكانية الوصول']].map(([key,en,ar])=>`<dt>${L(en,ar)}</dt><dd>${esc(visit[key]||L('Please confirm with the parish office.','يرجى التأكيد مع مكتب الرعية.'))}</dd>`).join('')}</dl>
    <a class="text-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name,d.parish.address,p.town,'Lebanon'].filter(Boolean).join(' '))}" target="_blank" rel="noopener">${L('Open directions in Google Maps','الاتجاهات في خرائط Google')}</a>${/^https:\/\/[^\s]+$/.test(visit.website||'')?`<p><a class="text-link" href="${esc(visit.website)}" target="_blank" rel="noopener">${L('Parish website','موقع الرعية')}</a></p>`:''}</article></div>
    <h2 class="public-subheading">${L('Ministries','الخدمات')}</h2><div class="public-info-grid" data-paginate>${(d.ministries||[]).map(g=>`<article class="contact-panel"><h3>${esc(g.name)}</h3><p>${esc(g.description||L('Contact the parish to learn about this ministry and how to participate.','تواصل مع الرعية للتعرّف على الخدمة وكيفية المشاركة.'))}</p>${g.responsible?`<p>${L('Responsible','المسؤول')}: ${esc(g.responsible)}</p>`:''}<a class="button" href="public.html?parish=${encodeURIComponent(p.id)}&request=ministry&ministry=${encodeURIComponent(g.name)}">${L('Ask about joining','استفسر عن الانضمام')}</a></article>`).join('')||`<p>${L('Ministry information will be published here.','تُنشر معلومات الخدمات هنا.')}</p>`}</div>
    <div class="section-head public-subheading"><h2>${L('Parish calendar','رزنامة الرعية')}</h2><a class="text-link" href="public.html?parish=${encodeURIComponent(p.id)}&view=calendar">${L('View more','عرض المزيد')}</a></div><div data-public-calendar></div><div data-event-detail role="status"></div>
    <h2 class="public-subheading">${L('Parish gallery','صور الرعية')}</h2><div class="public-gallery">${gallery.map((src,i)=>`<figure><img src="${esc(src)}" loading="lazy" alt="${custom.length?esc(p.name):L('Illustrative church interior','صورة توضيحية لكنيسة')} ${i+1}"><figcaption>${custom.length?L('Parish photograph','صورة الرعية'):L('Default illustrative photograph','صورة توضيحية افتراضية')}</figcaption></figure>`).join('')}</div></section>`;
}
export function bindPublicCalendar(host,d) {
  const el=host.querySelector('[data-public-calendar]');if(!el)return;
  const events=(d.events||[]).map(e=>({...e,date:e.d,time:e.t,title:document.documentElement.lang==='ar'?e.titleAr||e.title:e.title}));
  const render=()=>{el.innerHTML=calendarView(events,calendarState);bindCalendar(el,calendarState,render,id=>{
    const e=events.find(e=>String(e.id)===id),detail=host.querySelector('[data-event-detail]');
    if(e&&detail){detail.innerHTML=`<article class="contact-panel"><h3>${esc(e.title)}</h3><p>${esc(e.date)} · ${esc(e.time)}</p><p>${L('Contact the parish office for further details.','تواصل مع مكتب الرعية لمزيد من التفاصيل.')}</p></article>`;detail.scrollIntoView({block:'nearest'});}
  });};render();
}
const REQUEST_STATUS={submitted:['Sent to the parish office','أُرسل إلى مكتب الرعية'],'office-review':['The parish office is reviewing it','قيد المراجعة لدى مكتب الرعية'],'missing-documents':['Documents are missing','مستندات ناقصة'],'ready-for-collection':['Ready to collect from the parish','جاهز للاستلام من الرعية'],'ready-for-download':['Ready to download','جاهز للتنزيل'],closed:['Closed','مُغلق']};
const REQUEST_KINDS={certificate:['Certificate','شهادة'],baptism:['Baptism','المعمودية'],communion:['First Communion','المناولة الأولى'],confirmation:['Confirmation','الميرون'],marriage:['Marriage','الإكليل'],funeral:['Funeral','الجنّاز'],
  booking:['Book a hall or room','حجز قاعة أو مكان'],custom:['Something else','طلب آخر'],appointment:['Appointment with the parish office','موعد مع مكتب الرعية'],ministry:['Joining a ministry','الانضمام إلى خدمة']};
export function requestPage(p,kind) {
  const ministry=new URLSearchParams(location.search).get('ministry');
  return `<section class="section site-wrap guest-request"><a class="text-link" href="public.html?parish=${encodeURIComponent(p.id)}">${L('Back to parish','العودة إلى الرعية')}</a><h1>${L('Request from','طلب إلى رعية')} ${esc(L(p.name,p.ar||p.name))}</h1><p>${L('No account is required. Keep your private tracking link after submitting. The office will review the request.','لا حاجة لحساب. احتفظ برابط المتابعة الخاص بعد الإرسال. سيراجع المكتب طلبك.')}</p>
    <form data-guest-request><label>${L('Request type','نوع الطلب')}<select name="kind">${Object.entries(REQUEST_KINDS).map(([k,[en,ar]])=>`<option value="${k}" ${kind===k?'selected':''}>${esc(L(en,ar))}</option>`).join('')}</select></label>
    <div class="public-info-grid"><label>${L('Your full name','اسمك الكامل')}<input name="name" required maxlength="120" autocomplete="name"></label><label>${L('On behalf of (optional)','بالنيابة عن (اختياري)')}<input name="behalf" maxlength="120"></label><label>${L('Email','البريد الإلكتروني')}<input type="email" name="email" autocomplete="email" maxlength="120"></label><label>${L('Phone','الهاتف')}<input type="tel" name="phone" autocomplete="tel" maxlength="40"></label></div>
    <p>${L('Provide at least one contact method.','أدخل وسيلة تواصل واحدة على الأقل.')}</p><label>${L('Request details','تفاصيل الطلب')}<textarea name="description" required minlength="5" maxlength="4000" rows="5">${ministry?esc(L('I would like to learn about joining ','أود الاستفسار عن الانضمام إلى ')+ministry):''}</textarea></label>
    <label>${L('Document delivery preference','طريقة استلام المستند')}<select name="delivery"><option value="collection">${L('Collect from the parish','الاستلام من الرعية')}</option><option value="secure-download">${L('Secure download, when available','تنزيل آمن عند توفره')}</option></select></label>
    <label class="guest-confirm"><input name="responsibleAdult" type="checkbox" required>${L('I am the responsible adult submitting this request. A child will be accompanied by a parent or guardian.','أنا الشخص البالغ المسؤول عن هذا الطلب. سيكون الطفل برفقة أحد الوالدين أو ولي الأمر.')}</label>
    <p data-request-error role="alert"></p><button class="button" type="submit">${L('Send request','إرسال الطلب')}</button></form><div data-request-result aria-live="polite"></div></section>`;
}
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
      form.hidden=true;host.querySelector('[data-request-result]').innerHTML=`<div class="contact-panel"><h2>${L('Request received','تم استلام الطلب')}</h2><p>${L('Save this private link. Anyone with it can see this request’s status. No email or SMS has been sent.','احفظ هذا الرابط الخاص. يستطيع كل من يملكه الاطّلاع على حالة الطلب. لم تُرسل أي رسالة عبر البريد الإلكتروني أو الرسائل النصية.')}</p><a class="button" href="${esc(link.href)}">${L('Track my request','متابعة طلبي')}</a><label>${L('Private tracking link','رابط المتابعة الخاص')}<input readonly value="${esc(link.href)}"></label></div>`;
    }catch(err){error.textContent=err.message;b.disabled=false;}
  };
}
export async function trackingPage(host,token) {
  host.innerHTML=`<section class="section site-wrap"><h1>${L('Request tracking','متابعة الطلب')}</h1><p role="status">${L('Loading…','جارٍ التحميل…')}</p></section>`;
  try{
    const r=await fetch('/api/public/track/'+encodeURIComponent(token)),d=await r.json();if(!r.ok)throw new Error(d.error);
    const updated=new Date(d.updated_at);
    host.querySelector('section').innerHTML=`<h1>${L('Request tracking','متابعة الطلب')}</h1><article class="contact-panel"><h2>${esc(L(...(REQUEST_STATUS[d.status]||[d.status.replaceAll('-',' '),d.status.replaceAll('-',' ')])))}</h2><p>${esc(d.response||L('The parish office has received your request.','استلم مكتب الرعية طلبك.'))}</p><small>${Number.isNaN(updated.valueOf())?'':esc(L('Updated ','آخر تحديث: ')+new Intl.DateTimeFormat(document.documentElement.lang==='ar'?'ar-LB':'en-GB',{dateStyle:'long',timeStyle:'short'}).format(updated))}</small>${(d.files||[]).map(f=>`<p><a class="button" referrerpolicy="no-referrer" href="/api/public/guest-files/${encodeURIComponent(token)}/${encodeURIComponent(f.id)}" download>${L('Download','تنزيل')}: ${esc(f.name)}</a></p>`).join('')}</article>`;
  }catch(e){host.querySelector('p').textContent=e.message;}
}
export { paginateCollections };

export function bundlePage(){
  const bundles=[['Presence','التعريف بالرعية','Public parish profile, contact details, ministries and public calendar.','صفحة الرعية العامة والتواصل والخدمات والرزنامة.'],['Office','المكتب','People, households, office expenses, requests and sacramental records.','الأشخاص والعائلات ومصاريف المكتب والطلبات وسجلات الأسرار.'],['Community','المجتمع','Office records, requests, ministries, registrations, resources and facilities.','سجلات المكتب والطلبات والخدمات والتسجيل والموارد والمرافق.'],['Complete','الكاملة','All available modules, including sacraments and parish finance.','كل الوحدات المتاحة بما فيها الأسرار ومالية الرعية.']];
  return `<section class="section site-wrap"><span class="eyebrow">ParishLife</span><h1>${L('Choose what your parish needs','اختر ما تحتاجه رعيتك')}</h1><p>${L('Start with a public presence or add tools for your parish office and community. Arrangements can cover one parish or several parishes in a diocese.','ابدأ بحضور عام أو أضف أدوات للمكتب والمجتمع الرعوي. يمكن أن يشمل الترتيب رعية واحدة أو عدة رعايا في أبرشية.')}</p><div class="public-info-grid">${bundles.map(([en,ar,desc,descAr])=>`<article class="contact-panel"><h2>${L(en,ar)}</h2><p>${L(desc,descAr)}</p><a class="button" href="index.html#/workspace">${L('Manage or request this bundle','إدارة الباقة أو طلبها')}</a></article>`).join('')}</div><p>${L('Subscriptions are managed manually at present. No online payment or automatic billing is configured. Parish priests may activate parish-managed bundles; diocese-sponsored changes are requests for diocesan approval. Existing records remain available to read when a module is removed.','تُدار الاشتراكات يدوياً حالياً. لا توجد دفعات إلكترونية أو فوترة تلقائية. يستطيع الكاهن تفعيل باقات الرعية؛ وتتطلب الباقات برعاية الأبرشية طلب موافقتها. تبقى السجلات قابلة للقراءة عند إزالة وحدة.')}</p></section>`;
}
