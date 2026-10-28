import { api, loadSession } from './api.js';
import { t, setLang, isAr } from './i18n.js';
import { esc } from './ui.js';
import { applyTheme } from './theme.js';
import { passkeysSupported, signInWithPasskey, passkeyMessage } from './passkeys.js';
import { mountTurnstile } from './turnstile.js';

/* Sign in and sign up, beside the valley at dusk from the public site. Signing in takes one
   field (an email, a phone number or a username) or a passkey; signing up keeps every check
   of the account form on one screen, with the password rules shown before typing. */
const state={tab:'',values:{},shown:false,check:null};
const BRAND='<svg viewBox="0 0 28 34" fill="none" aria-hidden="true" focusable="false"><path d="M4 32V14a10 10 0 0 1 20 0v18" stroke="currentColor" stroke-width="1.8"/><path d="M1 32.5h26" stroke="currentColor" stroke-width="1.8"/><circle cx="14" cy="20" r="3.2" fill="#D7A548"/></svg>';
const EYE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const KEY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="8" cy="12" r="4"/><path d="M12 12h9m-3 0v3m-3-3v2"/></svg>';
const TICK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const MONTHS=[['January','كانون الثاني'],['February','شباط'],['March','آذار'],['April','نيسان'],['May','أيار'],['June','حزيران'],['July','تموز'],['August','آب'],['September','أيلول'],['October','تشرين الأول'],['November','تشرين الثاني'],['December','كانون الأول']];
const pad=n=>String(n).padStart(2,'0');

export function authentication(host,enter,error='') {
  applyTheme(null);
  state.tab ||= new URLSearchParams(location.search).has('signup')?'signup':'login';
  const up=state.tab==='signup',v=state.values,first=!state.shown,passkeys=passkeysSupported();
  state.shown=true;state.check=null;
  let n=0;
  const eye=`<button type="button" class="af-eye" data-reveal-pass aria-label="${t('Show password','إظهار كلمة المرور')}" aria-pressed="false">${EYE}</button>`;
  const field=(name,label,type='text',extra='',hint='',prefix='')=>`<label class="af" style="--i:${n++}"><span class="af-label">${label}${hint?` <small>${hint}</small>`:''}</span><span class="af-box${prefix?' has-prefix':''}">${prefix}<input name="${name}" type="${type}" value="${type==='password'?'':esc(v[name]||'')}" ${extra}>${type==='password'?eye:''}</span></label>`;
  const select=(name,label,options,extra)=>`<label class="af"><span class="sr-only">${label}</span><span class="af-box"><select name="${name}" ${extra}><option value="">${label}</option>${options.map(([value,text])=>`<option value="${value}" ${String(v[name]||'')===String(value)?'selected':''}>${text}</option>`).join('')}</select></span></label>`;
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
      <p class="auth-lede">${up?t('Your account connects you to the parishes you choose. It takes a minute.','حسابك يربطك بالرعايا التي تختارها. يستغرق دقيقة واحدة.'):t('Your account connects you to the parishes you choose.','حسابك يربطك بالرعايا التي تختارها.')}</p>
      <div class="auth-tabs" role="group" aria-label="${t('Account','الحساب')}"><button type="button" data-tab="login" aria-pressed="${!up}">${t('Sign in','دخول')}</button><button type="button" data-tab="signup" aria-pressed="${up}">${t('Sign up','حساب جديد')}</button><span class="auth-tabs-ink" aria-hidden="true"></span></div>
      <form id="account-auth-form" class="auth-form">
      ${up?`<div class="af-row">${field('firstName',t('First name','الاسم'),'text','required maxlength="60" autocomplete="given-name"')}${field('lastName',t('Last name','الشهرة'),'text','required maxlength="60" autocomplete="family-name"')}</div>
        <fieldset class="af-set af-born" style="--i:${n++}"><legend>${t('Date of birth','تاريخ الولادة')} <small>${t('ages 13+','١٣ سنة وما فوق')}</small></legend>
          <div class="af-date">${select('birthDay',t('Day','اليوم'),Array.from({length:31},(_,i)=>[i+1,isAr()?(i+1).toLocaleString('ar-LB'):i+1]),'required autocomplete="bday-day"')}
          ${select('birthMonth',t('Month','الشهر'),MONTHS.map((m,i)=>[i+1,t(...m)]),'required autocomplete="bday-month"')}
          <label class="af"><span class="sr-only">${t('Year','السنة')}</span><span class="af-box"><input name="birthYear" required inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="${t('Year','السنة')}" autocomplete="bday-year" dir="ltr" value="${esc(v.birthYear||'')}"></span></label></div></fieldset>
        <fieldset class="af-set" style="--i:${n++}"><legend>${t('How would you like to sign in?','كيف تودّ تسجيل الدخول؟')}</legend><p class="af-help">${t('Add an email, a phone number, or both. A Lebanese number can be typed as you dial it, like 03 123 456.','أضف بريداً إلكترونياً أو رقم هاتف أو كليهما. يمكن كتابة الرقم اللبناني كما تطلبه، مثل ٠٣ ١٢٣ ٤٥٦.')}</p>
          <div class="af-row">${field('email',t('Email','البريد الإلكتروني'),'email','autocomplete="email" maxlength="120" dir="ltr" autocapitalize="none" spellcheck="false"')}${field('phone',t('Mobile phone','الهاتف الخلوي'),'tel','autocomplete="tel" maxlength="40" dir="ltr" placeholder="03 123 456"','','<span class="af-prefix" aria-hidden="true" dir="ltr">+961</span>')}</div></fieldset>
        <div class="af-row">${field('password',t('Create password','إنشاء كلمة مرور'),'password','required minlength="8" maxlength="200" autocomplete="new-password" aria-describedby="af-rules"')}${field('confirmPassword',t('Confirm password','تأكيد كلمة المرور'),'password','required minlength="8" maxlength="200" autocomplete="new-password"')}</div>
        <ul class="af-rules" id="af-rules" style="--i:${n++}"><li data-rule="length">${TICK}${t('At least 8 characters','٨ أحرف على الأقل')}</li><li data-rule="match">${TICK}${t('Both passwords match','كلمتا المرور متطابقتان')}</li>
          <li class="af-rules-tip">${t('A short sentence is easy to remember and hard to guess. Common or leaked passwords are refused.','الجملة القصيرة سهلة التذكّر وصعبة التخمين. تُرفض كلمات المرور الشائعة أو المسرّبة.')}</li></ul>
        <div class="af-turnstile" data-turnstile hidden></div>
        <div class="auth-honeypot" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>`:
        `${field('username',t('Email, phone or username','البريد أو الهاتف أو اسم المستخدم'),'text',`required autocomplete="username${passkeys?' webauthn':''}" maxlength="120" dir="auto" autocapitalize="none" spellcheck="false"`)}
        ${field('password',t('Password','كلمة المرور'),'password','required autocomplete="current-password" maxlength="200"')}
        <div class="af-forgot-row" style="--i:${n++}"><button type="button" class="af-link" data-forgot aria-expanded="false" aria-controls="af-forgot">${t('Forgot your password?','نسيت كلمة المرور؟')}</button></div>
        <div class="af-forgot" id="af-forgot" hidden><p>${t('The office of the parish your account is with can reset it for you and give you a new password to change when you sign in. Call or visit the office.','يستطيع مكتب الرعية المرتبط بها حسابك إعادة تعيينها لك وإعطاءك كلمة مرور جديدة تغيّرها عند الدخول. اتصل بالمكتب أو زُره.')}</p>
          <a href="public.html#directory">${t('Find your parish office','ابحث عن مكتب رعيتك')}</a>${passkeys?`<p>${t('Added a passkey on this device? Sign in with it below.','أضفت مفتاح مرور على هذا الجهاز؟ ادخل به أدناه.')}</p>`:''}</div>`}
      <p class="auth-error" role="alert" data-error ${error?'':'hidden'}>${esc(error)}</p>
      <button type="submit" class="auth-submit" style="--i:${n++}">${up?t('Create account','إنشاء الحساب'):t('Sign in','تسجيل الدخول')}</button>
    </form>
    ${!up&&passkeys?`<div class="auth-or" style="--i:${n++}"><span>${t('or','أو')}</span></div><button type="button" class="auth-passkey" data-passkey style="--i:${n++}">${KEY}<span>${t('Sign in with a passkey','الدخول بمفتاح مرور')}</span></button>`:''}
    <a class="auth-back" href="public.html">${t('Browse parishes or make a request without an account','تصفّح الرعايا أو قدّم طلباً دون حساب')}</a>
    </div></main></div>`;
  const form=host.querySelector('form'),alert=form.querySelector('[data-error]'),submit=form.querySelector('[type=submit]');
  const remember=()=>{state.values=Object.fromEntries([...new FormData(form)].filter(([k])=>!['password','confirmPassword'].includes(k)));};
  const ink=host.querySelector('.auth-tabs-ink'),tabs=host.querySelector('.auth-tabs'),current=tabs.querySelector('[aria-pressed=true]');
  const place=()=>{const r=current.getBoundingClientRect(),b=tabs.getBoundingClientRect();ink.style.width=r.width+'px';ink.style.transform=`translateX(${r.left-b.left-4}px)`;};
  place();requestAnimationFrame(()=>tabs.classList.add('is-ready'));
  if(state.resize)removeEventListener('resize',state.resize);
  state.resize=place;addEventListener('resize',place,{passive:true});
  const leave=()=>{state.values={};removeEventListener('resize',place);state.resize=null;};
  host.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.tab===state.tab)return;remember();state.tab=b.dataset.tab;authentication(host,enter);});
  host.querySelector('[data-lang]').onclick=()=>{remember();setLang(isAr()?'en':'ar');authentication(host,enter);};
  host.querySelectorAll('[data-reveal-pass]').forEach(b=>b.onclick=()=>{const input=b.previousElementSibling,shown=input.type==='text';input.type=shown?'password':'text';b.setAttribute('aria-pressed',String(!shown));b.setAttribute('aria-label',shown?t('Show password','إظهار كلمة المرور'):t('Hide password','إخفاء كلمة المرور'));});
  const forgot=host.querySelector('[data-forgot]');
  if(forgot)forgot.onclick=()=>{const panel=host.querySelector('#af-forgot'),open=panel.hidden;panel.hidden=!open;forgot.setAttribute('aria-expanded',String(open));};
  /* A phone number with its own country code (+33…, 0033…) hides the +961 in front of the field. */
  const phone=form.querySelector('input[name=phone]');
  if(phone){const own=()=>phone.closest('.af-box').classList.toggle('has-code',/^\s*(\+|00)/.test(phone.value));phone.addEventListener('input',own);own();}
  /* The password rules tick themselves off as they are met. */
  const rules=form.querySelector('.af-rules');
  if(rules){
    const pass=form.querySelector('input[name=password]'),again=form.querySelector('input[name=confirmPassword]');
    const check=()=>{rules.querySelector('[data-rule=length]').classList.toggle('is-met',pass.value.length>=8);rules.querySelector('[data-rule=match]').classList.toggle('is-met',!!again.value&&again.value===pass.value);};
    pass.addEventListener('input',check);again.addEventListener('input',check);
  }
  const box=form.querySelector('[data-turnstile]');
  if(box)mountTurnstile(box,isAr()?'ar':'en').then(check=>{state.check=check;});
  const passkey=host.querySelector('[data-passkey]');
  if(passkey)passkey.onclick=async()=>{
    alert.hidden=true;passkey.disabled=true;
    try{await signInWithPasskey();leave();await enter();}
    catch(err){alert.textContent=passkeyMessage(err,t);alert.hidden=false;passkey.disabled=false;}
  };
  form.onsubmit=async e=>{
    e.preventDefault();remember();
    const q=Object.fromEntries(new FormData(form));
    submit.disabled=true;alert.hidden=true;
    try{
      if(up){
        for(const input of form.querySelectorAll('[required]'))if(!String(input.value).trim()){input.focus();throw new Error(t('Fill in every field marked as required.','املأ كل الحقول المطلوبة.'));}
        if(!q.email&&!q.phone)throw new Error(t('Add an email address, a phone number, or both.','أدخل بريداً أو رقم هاتف أو كليهما.'));
        const y=Number(q.birthYear),m=Number(q.birthMonth),d=Number(q.birthDay),born=new Date(Date.UTC(y,m-1,d));
        if(!(y>=1900)||born.getUTCMonth()!==m-1||born.getUTCDate()!==d)throw new Error(t('Enter a real date of birth.','أدخل تاريخ ولادة صحيحاً.'));
        q.birthDate=`${y}-${pad(m)}-${pad(d)}`;
        if(q.password.length<8)throw new Error(t('Choose a password of at least 8 characters.','اختر كلمة مرور من ٨ أحرف على الأقل.'));
        if(q.password!==q.confirmPassword)throw new Error(t('The passwords do not match.','كلمتا المرور غير متطابقتين.'));
        if(state.check)q.turnstile=state.check.token;
      }else q.mode='legacy';
      await api(up?'signup':'login','POST',q);
      leave();
      if(up)await welcome();
      await enter();
    }catch(err){
      alert.textContent=err.message;alert.hidden=false;submit.disabled=false;
      state.check?.reset();
    }
  };
}

/* A new account opens on My account, where the parish is chosen; a sign-up that started from a
   parish's page already follows that parish. */
async function welcome(){
  const parish=new URLSearchParams(location.search).get('parish');
  try{sessionStorage.setItem('pl-welcome','1');}catch{}
  if(parish){try{await loadSession();await api('account/parishes','POST',{parish,action:'follow'});}catch{}}
  history.replaceState(null,'',location.pathname+location.search+'#/account');
}
