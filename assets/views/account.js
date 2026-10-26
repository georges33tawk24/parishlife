import { changeAccountPassword } from '../account-security.js';
import { mountGuestLinks } from './guest-links.js';
import { mountRecordCorrections } from './profile-reviews.js';
import { api, session, loadSession } from '../api.js';
import { t } from '../i18n.js';
import { esc, pageHead, panel, toast } from '../ui.js';
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
    body.innerHTML=`<div class="account-grid">
      ${panel(t('Complete Profile','أكمل ملفك'),`<p class="help">${t('Save your account details here. To correct an official record, use My parish records below and submit it for office review. You can return later.','احفظ معلومات حسابك هنا. لتصحيح سجل رسمي، استخدم سجلاتي الرعوية أدناه وأرسله لمراجعة المكتب. يمكنك العودة لاحقاً.')}</p><form data-profile><div class="formgrid">${input('firstName','First name','الاسم')}${input('lastName','Last name','الشهرة')}${input('town','Town','البلدة')}${input('address','Address','العنوان')}${input('occupation','Occupation','المهنة')}${input('language','Preferred language','اللغة المفضلة')}</div><label class="formrow"><span class="label">${t('About me','نبذة عني')}</span><textarea class="textarea" name="about" maxlength="500">${esc(profile.about||'')}</textarea></label><button class="btn btn-primary">${t('Save profile','حفظ الملف')}</button></form>`)}
      ${panel(t('My appearance','المظهر الشخصي'),`<p class="help">${t('These colors apply only to your dashboard. Parish websites share one public theme.','تُطبّق هذه الألوان على حسابك فقط. للمواقع العامة مظهر موحّد.')}</p><form data-theme><div class="palette-options">${SCHEMES.map(s=>`<label><input type="radio" name="scheme" value="${s.id}" ${theme.scheme===s.id?'checked':''}><span class="palette-dot" style="background:${s.primary}"></span>${esc(t(s.en,s.ar))}</label>`).join('')}<label><input type="radio" name="scheme" value="custom" ${theme.scheme==='custom'?'checked':''}>${t('Custom','مخصّص')}<input type="color" name="primary" value="${esc(schemeOf(theme).primary)}" aria-label="${t('Choose color','اختر اللون')}"></label></div><label class="formrow"><span class="label">${t('Mode','الوضع')}</span><select class="select" name="mode"><option value="light" ${theme.mode==='light'?'selected':''}>${t('Light','فاتح')}</option><option value="dark" ${theme.mode==='dark'?'selected':''}>${t('Dark','داكن')}</option></select></label><button class="btn btn-primary">${t('Save appearance','حفظ المظهر')}</button></form>`)}
      ${panel(t('Sign-in and security','الدخول والأمان'),`<button type="button" class="btn btn-secondary" data-change-password>${t('Change password','تغيير كلمة المرور')}</button><p>${t('Username','اسم المستخدم')}: <b>${esc(session.user.username)}</b></p><div>${data.identities.map(i=>`<p>${esc(i.kind)} · ${esc(i.value)} <span class="help">${i.verified_at?t('Verified','مُتحقّق'):t('Verification pending setup','التحقّق بانتظار الإعداد')}</span></p>`).join('')}</div><p class="help">${t('Google, Apple, Microsoft and optional two-step authentication require external configuration. Existing usernames and passwords continue to work.','تتطلب خدمات الدخول الخارجي والمصادقة الثنائية إعداداً خارجياً. تبقى أسماء المستخدمين وكلمات المرور الحالية صالحة.')}</p>`)}
      </div><div data-record-corrections></div><div data-guest-links></div>
      ${panel(t('My parishes','رعاياي'),`<p class="help">${t('Follow parishes for updates, choose your primary parish, and separately request parish membership for office review.','تابع الرعايا واختر رعيتك الأساسية وقدّم طلب عضوية مستقلاً ليراجعه المكتب.')}</p><input class="input" type="search" data-parish-search placeholder="${t('Search parishes','ابحث عن رعية')}"><div class="account-parishes" data-paginate>${directory.parishes.map(p=>{
        const a=data.affiliations.find(a=>a.parish_id===p.id);
        return `<article data-name="${esc((p.name+' '+p.ar+' '+p.town).toLowerCase())}"><div><h3><a href="public.html?parish=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3><p>${esc(p.town)}${a?.is_primary?' · '+t('Primary parish','الرعية الأساسية'):''}</p><small>${t('Membership','العضوية')}: ${esc(({none:t('Not requested','لم تُطلب'),pending:t('Office review pending','بانتظار مراجعة المكتب'),approved:t('Approved','مقبولة')})[a?.membership||'none']||a.membership)}</small></div><div class="account-actions"><button class="btn btn-secondary" data-parish="${esc(p.id)}" data-affiliation="${a?.following?'unfollow':'follow'}" ${a?.is_primary?'disabled':''}>${a?.following?t('Unfollow','إلغاء المتابعة'):t('Follow','متابعة')}</button><button class="btn btn-secondary" data-parish="${esc(p.id)}" data-affiliation="primary" ${a?.is_primary?'disabled':''}>${t('Make primary','اختيار كأساسية')}</button><button class="btn btn-primary" data-parish="${esc(p.id)}" data-affiliation="request" ${['pending','approved'].includes(a?.membership)?'disabled':''}>${t('Request membership','طلب العضوية')}</button></div></article>`;
      }).join('')}</div>`)}`;
    body.querySelector('[data-change-password]').onclick=changeAccountPassword;
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
async function save(form,body) {
  const button=form.querySelector('button');button.disabled=true;
  try{await api('account','PUT',body);toast(t('Saved','حُفظ'),'','success');return true;}
  catch(e){toast(t('Could not save','تعذّر الحفظ'),e.message,'danger');return false;}
  finally{button.disabled=false;}
}
