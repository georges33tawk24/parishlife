import { changeAccountPassword } from '../account-security.js';
import { mountGuestLinks } from './guest-links.js';
import { mountRecordCorrections } from './profile-reviews.js';
import { api, session, loadSession } from '../api.js';
import { t, isAr } from '../i18n.js';
import { passkeysSupported, addPasskey, listPasskeys, removePasskey, passkeyMessage } from '../passkeys.js';
import { sign, drawingSVG, signaturePad } from '../signing.js';
import { esc, pageHead, panel, toast, openDrawer, closeOverlays, icon } from '../ui.js';
import { SCHEMES, schemeOf, applyTheme } from '../theme.js';
import { paginateCollections } from '../collection-ui.js';

export function accountPage() {
  return pageHead({title:t('My account','حسابي'),sub:t('Your profile, parishes and personal appearance.','ملفك ورعاياك ومظهر حسابك.')})+
    '<div data-account-content aria-live="polite"></div>';
}
accountPage.mount=async host=>{
  const body=host.querySelector('[data-account-content]');
  body.textContent=t('Loading your account…','جارٍ تحميل الحساب…');
  try{
    const [data,directory]=await Promise.all([api('account'),api('public/parishes')]);
    if(!body.isConnected)return;
    const profile=data.profile||{},theme={scheme:'forest',mode:'light',...data.theme};
    const input=(key,en,ar)=>`<label class="formrow"><span class="label">${t(en,ar)}</span><input class="input" name="${key}" value="${esc(profile[key]||'')}" maxlength="500"></label>`;
    let welcome=false;try{welcome=sessionStorage.getItem('pl-welcome')==='1';sessionStorage.removeItem('pl-welcome');}catch{}
    body.innerHTML=`${welcome?`<div class="account-welcome" role="status"><h2>${t('Welcome to ParishLife','أهلاً بك في ParishLife')}</h2><p>${t('Now choose your parish under My parishes: follow it for its news and events, make it your primary parish, and ask to become a member when you are ready.','اختر الآن رعيتك في «رعاياي»: تابعها لتصلك أخبارها ومناسباتها، واجعلها رعيتك الأساسية، واطلب العضوية عندما تكون مستعداً.')}</p><button type="button" class="btn btn-primary" data-to-parishes>${t('Choose my parish','اختر رعيتي')}</button></div>`:''}<div class="account-grid">
      ${panel(t('Complete Profile','أكمل ملفك'),`<p class="help">${t('Save your account details here. To correct an official record, use My parish records below and submit it for office review. You can return later.','احفظ معلومات حسابك هنا. لتصحيح سجل رسمي، استخدم سجلاتي الرعوية أدناه وأرسله لمراجعة المكتب. يمكنك العودة لاحقاً.')}</p><form data-profile><div class="formgrid">${input('firstName','First name','الاسم')}${input('lastName','Last name','الشهرة')}${input('town','Town','البلدة')}${input('address','Address','العنوان')}${input('occupation','Occupation','المهنة')}${input('language','Preferred language','اللغة المفضلة')}</div><label class="formrow"><span class="label">${t('About me','نبذة عني')}</span><textarea class="textarea" name="about" maxlength="500">${esc(profile.about||'')}</textarea></label><button class="btn btn-primary">${t('Save profile','حفظ الملف')}</button></form>`)}
      ${panel(t('My appearance','المظهر الشخصي'),`<p class="help">${t('These colors apply only to your dashboard. Parish websites share one public theme.','تُطبّق هذه الألوان على حسابك فقط. للمواقع العامة مظهر موحّد.')}</p><form data-theme><div class="palette-options">${SCHEMES.map(s=>`<label><input type="radio" name="scheme" value="${s.id}" ${theme.scheme===s.id?'checked':''}><span class="palette-dot" style="background:${s.primary}"></span>${esc(t(s.en,s.ar))}</label>`).join('')}<label><input type="radio" name="scheme" value="custom" ${theme.scheme==='custom'?'checked':''}>${t('Custom','مخصّص')}<input type="color" name="primary" value="${esc(schemeOf(theme).primary)}" aria-label="${t('Choose color','اختر اللون')}"></label></div><label class="formrow"><span class="label">${t('Mode','الوضع')}</span><select class="select" name="mode"><option value="light" ${theme.mode==='light'?'selected':''}>${t('Light','فاتح')}</option><option value="dark" ${theme.mode==='dark'?'selected':''}>${t('Dark','داكن')}</option></select></label><button class="btn btn-primary">${t('Save appearance','حفظ المظهر')}</button></form>`)}
      ${panel(t('Sign-in and security','الدخول والأمان'),`<button type="button" class="btn btn-secondary" data-change-password>${t('Change password','تغيير كلمة المرور')}</button><p>${t('Username','اسم المستخدم')}: <b>${esc(session.user.username)}</b></p><div>${data.identities.map(i=>`<p>${esc(i.kind)} · ${esc(i.value)} <span class="help">${i.verified_at?t('Verified','مُتحقّق'):t('Verification pending setup','التحقّق بانتظار الإعداد')}</span></p>`).join('')}</div><div class="account-passkeys" data-passkeys></div>`)}
      </div><div data-signature></div><div data-record-corrections></div><div data-guest-links></div>
      ${panel(t('My parishes','رعاياي'),`<p class="help">${t('Follow parishes for updates, choose your primary parish, and separately request parish membership for office review.','تابع الرعايا واختر رعيتك الأساسية وقدّم طلب عضوية مستقلاً ليراجعه المكتب.')}</p><input class="input" type="search" data-parish-search placeholder="${t('Search parishes','ابحث عن رعية')}"><div class="account-parishes" data-paginate>${directory.parishes.map(p=>{
        const a=data.affiliations.find(a=>a.parish_id===p.id);
        return `<article data-name="${esc((p.name+' '+p.ar+' '+p.town).toLowerCase())}"><div><h3><a href="public.html?parish=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3><p>${esc(p.town)}${a?.is_primary?' · '+t('Primary parish','الرعية الأساسية'):''}</p><small>${t('Membership','العضوية')}: ${esc(({none:t('Not requested','لم تُطلب'),pending:t('Office review pending','بانتظار مراجعة المكتب'),approved:t('Approved','مقبولة')})[a?.membership||'none']||a.membership)}</small></div><div class="account-actions"><button class="btn btn-secondary" data-parish="${esc(p.id)}" data-affiliation="${a?.following?'unfollow':'follow'}" ${a?.is_primary?'disabled':''}>${a?.following?t('Unfollow','إلغاء المتابعة'):t('Follow','متابعة')}</button><button class="btn btn-secondary" data-parish="${esc(p.id)}" data-affiliation="primary" ${a?.is_primary?'disabled':''}>${t('Make primary','اختيار كأساسية')}</button><button class="btn btn-primary" data-parish="${esc(p.id)}" data-affiliation="request" ${['pending','approved'].includes(a?.membership)?'disabled':''}>${t('Request membership','طلب العضوية')}</button></div></article>`;
      }).join('')}</div>`)}`;
    body.querySelector('[data-change-password]').onclick=changeAccountPassword;
    const parishes=body.querySelector('[data-parish-search]');
    body.querySelector('[data-to-parishes]')?.addEventListener('click',()=>{parishes.closest('.panel')?.scrollIntoView({behavior:'smooth',block:'start'});parishes.focus({preventScroll:true});});
    const signature=body.querySelector('[data-signature]');
    mountPasskeys(body.querySelector('[data-passkeys]'),()=>mountSignature(signature));
    mountSignature(signature);
    body.querySelector('[data-profile]').onsubmit=async e=>{
      e.preventDefault();await save(e.currentTarget,{profile:Object.fromEntries(new FormData(e.currentTarget))});
    };
    const themeForm=body.querySelector('[data-theme]');
    themeForm.onsubmit=async e=>{
      e.preventDefault();const next=Object.fromEntries(new FormData(themeForm));
      if(await save(themeForm,{theme:next})){session.preferences={theme:next};applyTheme(next);}
    };
    body.querySelector('[data-parish-search]').oninput=e=>{
      body.querySelectorAll('[data-name]').forEach(row=>row.hidden=!row.dataset.name.includes(e.target.value.toLowerCase().trim()));
    };
    body.querySelectorAll('[data-affiliation]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      try{await api('account/parishes','POST',{parish:b.dataset.parish,action:b.dataset.affiliation});await loadSession();await accountPage.mount(host);}
      catch(e){b.disabled=false;toast(t('Could not save','تعذّر الحفظ'),e.message,'danger');}
    });
    await mountGuestLinks(body.querySelector('[data-guest-links]'));
    await mountRecordCorrections(body.querySelector('[data-record-corrections]'));
    paginateCollections(body);
  }catch(e){if(body.isConnected)body.textContent=e.message;}
};
/* My signature (parish staff): drawn once, kept with one of my passkeys, and used only when I
   unlock that passkey to sign a certificate or a letter. */
async function mountSignature(box){
  if(!box)return;
  let data;
  try{data=await api('account/signature');}catch{return;}
  if(!data.eligible||!box.isConnected)return;
  const me=data.signer;
  box.innerHTML=panel(t('My signature','توقيعي'),`<div class="sig-panel">
    ${me?`<figure class="sig-card">${drawingSVG(me.drawing)}<figcaption><b>${esc(session.user.name)}</b>${me.title?`<span>${esc(me.title)}</span>`:''}</figcaption></figure>
      <div class="sig-facts"><p>${icon('lock',16)}${t('Kept with your passkey','محفوظ مع مفتاح المرور')} <b>${esc(me.passkey)}</b>. ${t('Nothing is signed unless you unlock it with your face, fingerprint or PIN, over the exact document being signed.','لا يُوقَّع شيء إلا إذا فتحته بوجهك أو بصمتك أو رمزك، على الوثيقة نفسها التي تُوقَّع.')}</p>
      <p class="help">${t('Each signed document carries a code anyone can check on ParishLife: who signed, when, and whether it was changed since.','تحمل كل وثيقة موقّعة رمزاً يمكن لأي شخص التحقّق منه على ParishLife: من وقّع، ومتى، وهل عُدّلت بعد ذلك.')}</p>
      <div class="account-actions"><button type="button" class="btn btn-secondary" data-sig-edit>${t('Change my signature','تغيير توقيعي')}</button><button type="button" class="btn btn-ghost" data-sig-remove>${t('Remove','إزالة')}</button></div></div>`
    :`<div class="sig-facts"><p>${t('Sign certificates and letters with your own handwritten signature. It is kept with one of your passkeys, so only you can use it: each signature needs your face, fingerprint or PIN.','وقّع الشهادات والرسائل بتوقيعك اليدوي. يُحفظ مع أحد مفاتيح المرور الخاصة بك فلا يستعمله أحد غيرك: كل توقيع يحتاج إلى وجهك أو بصمتك أو رمزك.')}</p>
      ${data.passkeys?'':`<p class="help">${icon('info',15)}${t('First add a passkey on this device under Sign-in and security.','أضف أولاً مفتاح مرور على هذا الجهاز ضمن «الدخول والأمان».')}</p>`}
      <button type="button" class="btn btn-primary" data-sig-edit ${data.passkeys&&passkeysSupported()?'':'disabled'}>${t('Set up my signature','إعداد توقيعي')}</button></div>`}</div>`);
  box.querySelector('[data-sig-edit]')?.addEventListener('click',()=>signatureDrawer(me,()=>mountSignature(box)));
  box.querySelector('[data-sig-remove]')?.addEventListener('click',async e=>{e.target.disabled=true;try{await api('account/signature/remove','POST',{});toast(t('Signature removed','أُزيل التوقيع'),'','success');await mountSignature(box);}catch(err){toast(t('Could not remove','تعذّرت الإزالة'),err.message,'danger');e.target.disabled=false;}});
}
function signatureDrawer(me,done){
  openDrawer({title:t('My signature','توقيعي'),body:`<form class="sig-form" data-sig-form>
    <p class="help">${t('Sign inside the box with your finger, a pen or the mouse, as you sign on paper.','وقّع داخل الإطار بإصبعك أو بقلم أو بالفأرة، كما توقّع على الورق.')}</p>
    <div class="sig-pad-wrap"><svg class="sig-pad" viewBox="0 0 400 140" role="img" aria-label="${esc(t('Signature pad','لوحة التوقيع'))}"><line x1="24" x2="376" y1="112" y2="112"/><path d="" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <button type="button" class="btn btn-ghost btn-dense" data-sig-clear>${t('Clear','مسح')}</button></div>
    <label class="formrow"><span class="label">${t('Title under your name','الصفة تحت اسمك')}</span><input class="input" name="title" maxlength="80" value="${esc(me?.title||'')}" placeholder="${esc(t('Parish priest','كاهن الرعية'))}"></label>
    <p class="help">${icon('lock',15)}${t('Saving asks for your face, fingerprint or PIN: the signature is then kept with that passkey.','يطلب الحفظ وجهك أو بصمتك أو رمزك: ثم يُحفظ التوقيع مع مفتاح المرور هذا.')}</p>
    <p class="help-error" role="alert"></p><button class="btn btn-primary" disabled>${t('Save my signature','حفظ توقيعي')}</button></form>`,onMount(el){
      const form=el.querySelector('form'),pad=signaturePad(form.querySelector('.sig-pad')),save=form.querySelector('button.btn-primary'),alert=form.querySelector('[role=alert]');
      form.addEventListener('signature',()=>{save.disabled=pad.empty();});
      form.querySelector('[data-sig-clear]').onclick=()=>pad.clear();
      form.onsubmit=async e=>{
        e.preventDefault();save.disabled=true;alert.textContent='';
        try{const drawing=pad.path();await api('account/signature','POST',{drawing,title:form.elements.title.value,signature:await sign({type:'setup',drawing})});closeOverlays();toast(t('Signature saved','حُفظ التوقيع'),t('You can now sign certificates and letters.','يمكنك الآن توقيع الشهادات والرسائل.'),'success');done();}
        catch(err){alert.textContent=passkeyMessage(err,t);save.disabled=pad.empty();}
      };
    }});
}

/* Passkeys on this account: added from the device being used, each removable. */
const deviceName=()=>{const ua=navigator.userAgent;return /iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android':/Mac/.test(ua)?'Mac':/Windows/.test(ua)?'Windows':t('This device','هذا الجهاز');};
const day=value=>{const d=new Date(value);return Number.isNaN(+d)?'':new Intl.DateTimeFormat(isAr()?'ar-LB':'en-GB',{dateStyle:'medium'}).format(d);};
async function mountPasskeys(box,changed=()=>{}){
  if(!box)return;
  const intro=`<h4>${t('Passkeys','مفاتيح المرور')}</h4><p class="help">${t('Sign in with this device’s face, fingerprint or PIN instead of your password. Each device keeps its own passkey.','ادخل بوجهك أو ببصمتك أو برمز جهازك بدلاً من كلمة المرور. لكل جهاز مفتاح مروره.')}</p>`;
  if(!passkeysSupported()){box.innerHTML=intro+`<p class="help">${t('This browser cannot use passkeys.','لا يدعم هذا المتصفح مفاتيح المرور.')}</p>`;return;}
  const paint=async()=>{
    let list=[];
    try{list=(await listPasskeys()).passkeys;}catch(e){box.innerHTML=intro+`<p class="help-error">${esc(e.message)}</p>`;return;}
    if(!box.isConnected)return;
    box.innerHTML=intro+(list.length?`<ul class="passkey-list">${list.map(k=>`<li><span><b>${esc(k.name)}</b><small>${t('Added','أُضيف')} ${esc(day(k.created_at))}${k.last_used_at?` · ${t('last used','آخر استخدام')} ${esc(day(k.last_used_at))}`:''}</small></span><button type="button" class="btn btn-secondary" data-remove-passkey="${esc(k.id)}">${t('Remove','إزالة')}</button></li>`).join('')}</ul>`:'')+
      `<button type="button" class="btn btn-secondary" data-add-passkey>${t('Add a passkey on this device','أضف مفتاح مرور على هذا الجهاز')}</button>`;
    const add=box.querySelector('[data-add-passkey]');
    add.onclick=async()=>{add.disabled=true;try{await addPasskey(deviceName());toast(t('Passkey added','أُضيف مفتاح المرور'),t('Next time, choose “Sign in with a passkey”.','في المرة المقبلة، اختر «الدخول بمفتاح مرور».'),'success');await paint();changed();}catch(e){toast(t('Could not add the passkey','تعذّرت إضافة مفتاح المرور'),passkeyMessage(e,t),'danger');add.disabled=false;}};
    box.querySelectorAll('[data-remove-passkey]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await removePasskey(b.dataset.removePasskey);await paint();changed();}catch(e){toast(t('Could not remove the passkey','تعذّرت إزالة مفتاح المرور'),e.message,'danger');b.disabled=false;}});
  };
  await paint();
}
async function save(form,body) {
  const button=form.querySelector('button');button.disabled=true;
  try{await api('account','PUT',body);toast(t('Saved','حُفظ'),'','success');return true;}
  catch(e){toast(t('Could not save','تعذّر الحفظ'),e.message,'danger');return false;}
  finally{button.disabled=false;}
}
