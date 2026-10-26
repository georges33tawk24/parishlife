import { api } from './api.js';
import { t, setLang, isAr } from './i18n.js';
import { esc } from './ui.js';
import { applyTheme } from './theme.js';

const state={tab:'',mode:'username',values:{}};
export function authentication(host,enter,error='') {
  applyTheme(null);
  state.tab ||= new URLSearchParams(location.search).has('signup')?'signup':'login';
  const up=state.tab==='signup',v=state.values;
  const field=(name,label,type='text',extra='')=>`<label class="formrow"><span class="label">${label}</span><input class="input" name="${name}" type="${type}" value="${type==='password'?'':esc(v[name]||'')}" ${extra}></label>`;
  host.className='account-auth';
  host.innerHTML=`<div class="auth-card"><div class="auth-top"><a href="public.html">ParishLife</a><button class="btn btn-ghost" data-lang>${t('العربية','English')}</button></div>
    <h1>${up?t('Create your account','إنشاء حساب'):t('Welcome back','أهلاً بعودتك')}</h1>
    <p>${t('Your account connects you to the parishes you choose.','حسابك يربطك بالرعايا التي تختارها.')}</p>
    <div class="seg auth-tabs"><button data-tab="login" aria-pressed="${!up}">${t('Sign in','دخول')}</button><button data-tab="signup" aria-pressed="${up}">${t('Sign up','حساب جديد')}</button></div>
    <form id="account-auth-form">
      ${up?`<div class="formgrid">${field('firstName',t('First name','الاسم'),'text','required maxlength="60" autocomplete="given-name"')}${field('lastName',t('Last name','الشهرة'),'text','required maxlength="60" autocomplete="family-name"')}</div>
        ${field('birthDate',t('Date of birth · ages 13+','تاريخ الولادة · ١٣ سنة وما فوق'),'date','required autocomplete="bday"')}
        <h2>${t('How would you like to sign in?','كيف تود تسجيل الدخول؟')}</h2><p class="help">${t('Add email, phone, or both. Verify each contact you choose when verification is configured.','أضف البريد أو الهاتف أو كليهما. تحقّق من وسائل الاتصال التي تختارها عندما تتوفر خدمة التحقّق.')}</p>
        ${field('email',t('Email','البريد الإلكتروني'),'email','autocomplete="email" maxlength="120"')}${field('phone',t('Mobile phone','الهاتف الخلوي'),'tel','autocomplete="tel" maxlength="40"')}
        ${field('password',t('Create password','إنشاء كلمة مرور'),'password','required minlength="8" maxlength="200" autocomplete="new-password"')}
        ${field('confirmPassword',t('Confirm password','تأكيد كلمة المرور'),'password','required minlength="8" maxlength="200" autocomplete="new-password"')}
        <div class="auth-honeypot" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>`:
        `<label class="formrow"><span class="label">${t('Sign in using','تسجيل الدخول باستخدام')}</span><select class="select" name="mode">${[['username','Username','اسم المستخدم'],['email','Email','البريد الإلكتروني'],['phone','Phone','الهاتف']].map(([key,en,ar])=>`<option value="${key}" ${state.mode===key?'selected':''}>${t(en,ar)}</option>`).join('')}</select></label>
        ${field('username',state.mode==='email'?t('Email address','البريد الإلكتروني'):state.mode==='phone'?t('Phone number','رقم الهاتف'):t('Username','اسم المستخدم'),state.mode==='email'?'email':state.mode==='phone'?'tel':'text','required autocomplete="username" maxlength="120"')}
        ${field('password',t('Password','كلمة المرور'),'password','required autocomplete="current-password" maxlength="200"')}`}
      <p class="help-error" role="alert" data-error ${error?'':'hidden'}>${esc(error)}</p>
      <button type="submit" class="btn btn-primary auth-submit">${up?t('Create account','إنشاء الحساب'):t('Sign in','تسجيل الدخول')}</button>
    </form>
    <section class="auth-providers"><h2>${t('Connected sign-in options','خيارات تسجيل الدخول المرتبطة')}</h2><div class="provider-grid">${['Google','Apple','Microsoft'].map(p=>`<button type="button" class="btn btn-secondary" disabled>${p}</button>`).join('')}</div>
    <p class="help">${t('Provider sign-in, email/SMS verification, and optional two-step authentication will be available after the parish platform configures these services. No verification has been sent.','تتوفر خدمات تسجيل الدخول الخارجي والتحقّق بالبريد والرسائل والمصادقة الثنائية بعد إعدادها. لم يُرسل رمز تحقق.')}</p></section>
    <a class="text-link" href="public.html">${t('Browse parishes or make a request without an account','تصفّح الرعايا أو قدّم طلباً دون حساب')}</a>
    </div>`;
  const form=host.querySelector('form'),remember=()=>{state.values=Object.fromEntries([...new FormData(form)].filter(([k])=>!['password','confirmPassword'].includes(k)));};
  host.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{remember();state.tab=b.dataset.tab;authentication(host,enter);});
  host.querySelector('[data-lang]').onclick=()=>{remember();setLang(isAr()?'en':'ar');authentication(host,enter);};
  form.elements.mode?.addEventListener('change',e=>{remember();state.mode=e.target.value;state.values.username='';authentication(host,enter);});
  form.onsubmit=async e=>{
    e.preventDefault();remember();
    const q=Object.fromEntries(new FormData(form)),button=form.querySelector('[type=submit]'),alert=form.querySelector('[data-error]');
    button.disabled=true;alert.hidden=true;
    try{
      if(up&&!q.email&&!q.phone)throw new Error(t('Add an email address, a phone number, or both.','أدخل بريداً أو رقم هاتف أو كليهما.'));
      if(up&&q.password!==q.confirmPassword)throw new Error(t('The passwords do not match.','كلمتا المرور غير متطابقتين.'));
      await api(up?'signup':'login','POST',q);
      state.values={};await enter();
    }catch(err){alert.textContent=err.message;alert.hidden=false;button.disabled=false;}
  };
}
