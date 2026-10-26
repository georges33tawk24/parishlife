import { api } from './api.js';
import { t } from './i18n.js';
import { openDrawer,closeOverlays,toast } from './ui.js';

export function changeAccountPassword(){
  const field=(name,title,autocomplete)=>`<label class="formrow"><span class="label">${title}</span><input class="input" name="${name}" type="password" required ${autocomplete==='new-password'?'minlength="16" maxlength="200"':''} autocomplete="${autocomplete}"></label>`;
  openDrawer({title:t('Change password','تغيير كلمة المرور'),body:`<form data-account-password>
    <p class="help">${t('Use 16–200 characters. Other sessions will be signed out; this session remains active.','استخدم كلمة مرور من ١٦ إلى ٢٠٠ حرف. تُسجّل الجلسات الأخرى خروجها وتبقى هذه الجلسة نشطة.')}</p>
    ${field('currentPassword',t('Current password','كلمة المرور الحالية'),'current-password')}
    ${field('newPassword',t('New password','كلمة المرور الجديدة'),'new-password')}
    ${field('confirmPassword',t('Confirm new password','تأكيد كلمة المرور الجديدة'),'new-password')}
    <p class="help-error" role="alert"></p><button type="submit" class="btn btn-primary">${t('Change password','تغيير كلمة المرور')}</button></form>`,
    onMount(container){
      const form=container.querySelector('[data-account-password]');
      form.onsubmit=async event=>{
        event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
        try{await api('account/password','POST',Object.fromEntries(new FormData(form)));closeOverlays();toast(t('Password changed','تم تغيير كلمة المرور'),'','success');}
        catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
      };
    }
  });
}
