import { api } from './api.js';
import { t, setLang, isAr } from './i18n.js';
import { esc } from './ui.js';
import { applyTheme } from './theme.js';

/* Sign in and sign up, beside the valley at dusk from the public site. Every field and check
   of the account form is here; paired fields keep sign-up to one screen. */
const state={tab:'',mode:'username',values:{},shown:false};
const BRAND='<svg viewBox="0 0 28 34" fill="none" aria-hidden="true" focusable="false"><path d="M4 32V14a10 10 0 0 1 20 0v18" stroke="currentColor" stroke-width="1.8"/><path d="M1 32.5h26" stroke="currentColor" stroke-width="1.8"/><circle cx="14" cy="20" r="3.2" fill="#D7A548"/></svg>';
const EYE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
export function authentication(host,enter,error='') {
  applyTheme(null);
  state.tab ||= new URLSearchParams(location.search).has('signup')?'signup':'login';
  const up=state.tab==='signup',v=state.values,first=!state.shown;
  state.shown=true;
  let n=0;
  const field=(name,label,type='text',extra='',hint='')=>`<label class="af" style="--i:${n++}"><span class="af-label">${label}${hint?` <small>${hint}</small>`:''}</span><span class="af-box"><input name="${name}" type="${type}" value="${type==='password'?'':esc(v[name]||'')}" ${extra}>${type==='password'?`<button type="button" class="af-eye" data-reveal-pass aria-label="${t('Show password','إظهار كلمة المرور')}" aria-pressed="false">${EYE}</button>`:''}</span></label>`;
  host.className='account-auth'+(first?' is-first':'');
  host.innerHTML=`<div class="auth-shell">
    <aside class="auth-art" aria-hidden="true">
      ${['sky','far','near','glow'].map(part=>`<img src="assets/images/valley/valley-tall-dusk-${part}.webp" alt="" class="art-${part}">`).join('')}
      <span class="auth-stars"></span><span class="auth-shade"></span>
      <blockquote class="auth-quote"><p>${t('“Let your light shine before others.”','«فليُضِئ نورُكم هكذا قدّام الناس»')}</p><cite>${t('Matthew 5:16','متّى ٥: ١٦')}</cite></blockquote>
    </aside>
    <main class="auth-main"><div class="auth-card">
      <div class="auth-top"><a class="auth-brand" href="public.html">${BRAND}<span>ParishLife</span></a><button type="button" class="auth-lang" data-lang lang="${isAr()?'en':'ar'}">${t('العربية','English')}</button></div>
      <h1>${up?t('Create your account','إنشاء حساب'):t('Welcome back','أهلاً بعودتك')}</h1>
      <p class="auth-lede">${t('Your account connects you to the parishes you choose.','حسابك يربطك بالرعايا التي تختارها.')}</p>
      <div class="auth-tabs" role="group" aria-label="${t('Account','الحساب')}"><button type="button" data-tab="login" aria-pressed="${!up}">${t('Sign in','دخول')}</button><button type="button" data-tab="signup" aria-pressed="${up}">${t('Sign up','حساب جديد')}</button><span class="auth-tabs-ink" aria-hidden="true"></span></div>
      <form id="account-auth-form" class="auth-form">
      ${up?`<div class="af-row">${field('firstName',t('First name','الاسم'),'text','required maxlength="60" autocomplete="given-name"')}${field('lastName',t('Last name','الشهرة'),'text','required maxlength="60" autocomplete="family-name"')}</div>
        ${field('birthDate',t('Date of birth','تاريخ الولادة'),'date','required autocomplete="bday"',t('ages 13+','١٣ سنة وما فوق'))}
        <fieldset class="af-set" style="--i:${n++}"><legend>${t('How would you like to sign in?','كيف تود تسجيل الدخول؟')}</legend><p class="af-help">${t('Add email, phone, or both. Verify each contact you choose when verification is configured.','أضف البريد أو الهاتف أو كليهما. تحقّق من وسائل الاتصال التي تختارها عندما تتوفر خدمة التحقّق.')}</p>
          <div class="af-row">${field('email',t('Email','البريد الإلكتروني'),'email','autocomplete="email" maxlength="120" dir="ltr"')}${field('phone',t('Mobile phone','الهاتف الخلوي'),'tel','autocomplete="tel" maxlength="40" dir="ltr"')}</div></fieldset>
        <div class="af-row">${field('password',t('Create password','إنشاء كلمة مرور'),'password','required minlength="8" maxlength="200" autocomplete="new-password"')}${field('confirmPassword',t('Confirm password','تأكيد كلمة المرور'),'password','required minlength="8" maxlength="200" autocomplete="new-password"')}</div>
        <div class="auth-honeypot" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>`:
        `<fieldset class="af-modes" style="--i:${n++}"><legend>${t('Sign in using','تسجيل الدخول باستخدام')}</legend>${[['username','Username','اسم المستخدم'],['email','Email','البريد الإلكتروني'],['phone','Phone','الهاتف']].map(([key,en,ar])=>`<label><input type="radio" name="mode" value="${key}" ${state.mode===key?'checked':''}><span>${t(en,ar)}</span></label>`).join('')}</fieldset>
        ${field('username',state.mode==='email'?t('Email address','البريد الإلكتروني'):state.mode==='phone'?t('Phone number','رقم الهاتف'):t('Username','اسم المستخدم'),state.mode==='email'?'email':state.mode==='phone'?'tel':'text',`required autocomplete="username" maxlength="120"${state.mode==='username'?'':' dir="ltr"'}`)}
        ${field('password',t('Password','كلمة المرور'),'password','required autocomplete="current-password" maxlength="200"')}`}
      <p class="auth-error" role="alert" data-error ${error?'':'hidden'}>${esc(error)}</p>
      <button type="submit" class="auth-submit" style="--i:${n++}">${up?t('Create account','إنشاء الحساب'):t('Sign in','تسجيل الدخول')}</button>
    </form>
    <section class="auth-providers" style="--i:${n++}"><h2>${t('Connected sign-in options','خيارات تسجيل الدخول المرتبطة')}</h2><div class="provider-grid">${['Google','Apple','Microsoft'].map(p=>`<button type="button" disabled>${p}</button>`).join('')}</div>
    <p>${t('Provider sign-in, email/SMS verification, and optional two-step authentication will be available after the parish platform configures these services. No verification has been sent.','تتوفر خدمات تسجيل الدخول الخارجي والتحقّق بالبريد والرسائل والمصادقة الثنائية بعد إعدادها. لم يُرسل رمز تحقق.')}</p></section>
    <a class="auth-back" href="public.html">${t('Browse parishes or make a request without an account','تصفّح الرعايا أو قدّم طلباً دون حساب')}</a>
    </div></main></div>`;
  const form=host.querySelector('form'),remember=()=>{state.values=Object.fromEntries([...new FormData(form)].filter(([k])=>!['password','confirmPassword'].includes(k)));};
  const ink=host.querySelector('.auth-tabs-ink'),tabs=host.querySelector('.auth-tabs'),current=tabs.querySelector('[aria-pressed=true]');
  const place=()=>{const r=current.getBoundingClientRect(),b=tabs.getBoundingClientRect();ink.style.width=r.width+'px';ink.style.transform=`translateX(${r.left-b.left-4}px)`;};
  place();requestAnimationFrame(()=>tabs.classList.add('is-ready'));
  if(state.resize)removeEventListener('resize',state.resize);
  state.resize=place;addEventListener('resize',place,{passive:true});
  host.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.tab===state.tab)return;remember();state.tab=b.dataset.tab;authentication(host,enter);});
  host.querySelector('[data-lang]').onclick=()=>{remember();setLang(isAr()?'en':'ar');authentication(host,enter);};
  form.querySelectorAll('input[name=mode]').forEach(r=>r.addEventListener('change',e=>{remember();state.mode=e.target.value;state.values.username='';authentication(host,enter);host.querySelector('input[name=username]')?.focus();}));
  host.querySelectorAll('[data-reveal-pass]').forEach(b=>b.onclick=()=>{const input=b.previousElementSibling,shown=input.type==='text';input.type=shown?'password':'text';b.setAttribute('aria-pressed',String(!shown));b.setAttribute('aria-label',shown?t('Show password','إظهار كلمة المرور'):t('Hide password','إخفاء كلمة المرور'));});
  form.onsubmit=async e=>{
    e.preventDefault();remember();
    const q=Object.fromEntries(new FormData(form)),button=form.querySelector('[type=submit]'),alert=form.querySelector('[data-error]');
    button.disabled=true;alert.hidden=true;
    try{
      if(up&&!q.email&&!q.phone)throw new Error(t('Add an email address, a phone number, or both.','أدخل بريداً أو رقم هاتف أو كليهما.'));
      if(up&&q.password!==q.confirmPassword)throw new Error(t('The passwords do not match.','كلمتا المرور غير متطابقتين.'));
      await api(up?'signup':'login','POST',q);
      state.values={};removeEventListener('resize',place);state.resize=null;await enter();
    }catch(err){alert.textContent=err.message;alert.hidden=false;button.disabled=false;}
  };
}
