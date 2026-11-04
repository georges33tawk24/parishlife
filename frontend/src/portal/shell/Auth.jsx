/* Sign in and sign up, beside the church window of the public site. Signing in takes one field (an
   email, a phone number or a username) or a passkey; signing up keeps every check of the account
   form on one screen, with the password rules shown before typing. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, loadSession } from '../model/api.js';
import { t, isAr } from '../../lib/i18n.js';
import { applyTheme } from '../../lib/theme.js';
import { passkeysSupported, signInWithPasskey, passkeyMessage } from '../model/passkeys.js';
import { mountTurnstile } from '../../lib/turnstile.js';
import { Sanctuary } from '../../public/components/Sanctuary.jsx';
import { EasyReading } from '../../reading/EasyReading.jsx';

/* What was typed survives a switch of tab or language; passwords never do. */
const state = { tab: '', values: {}, shown: false };
const MONTHS = [
  ['January', 'كانون الثاني'],
  ['February', 'شباط'],
  ['March', 'آذار'],
  ['April', 'نيسان'],
  ['May', 'أيار'],
  ['June', 'حزيران'],
  ['July', 'تموز'],
  ['August', 'آب'],
  ['September', 'أيلول'],
  ['October', 'تشرين الأول'],
  ['November', 'تشرين الثاني'],
  ['December', 'كانون الأول']
];
const pad = n => String(n).padStart(2, '0');
const Brand = () => (
  <svg viewBox="0 0 28 34" fill="none" aria-hidden="true" focusable="false">
    <path d="M4 32V14a10 10 0 0 1 20 0v18" stroke="currentColor" strokeWidth="1.8" />
    <path d="M1 32.5h26" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="14" cy="20" r="3.2" fill="#D7A548" />
  </svg>
);
const Eye = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const Key = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="8" cy="12" r="4" />
    <path d="M12 12h9m-3 0v3m-3-3v2" />
  </svg>
);
const Tick = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/* A password field with its eye: pressing it shows what was typed. */
function Secret(props) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <input {...props} type={shown ? 'text' : 'password'} />
      <button
        type="button"
        className="af-eye"
        data-reveal-pass
        aria-label={shown ? t('Hide password', 'إخفاء كلمة المرور') : t('Show password', 'إظهار كلمة المرور')}
        aria-pressed={shown}
        onClick={() => setShown(!shown)}
      >
        <Eye />
      </button>
    </>
  );
}

export function Auth({ enter, error = '', onLanguage }) {
  state.tab ||= new URLSearchParams(location.search).has('signup') ? 'signup' : 'login';
  const [tab, setTab] = useState(state.tab);
  const [first] = useState(() => !state.shown);
  const [alert, setAlert] = useState(error);
  const [busy, setBusy] = useState({ submit: false, passkey: false });
  const [forgot, setForgot] = useState(false);
  const [pass, setPass] = useState({ password: '', again: '' });
  const [ownCode, setOwnCode] = useState(/^\s*(\+|00)/.test(state.values.phone || ''));
  const form = useRef(null),
    tabs = useRef(null),
    ink = useRef(null),
    box = useRef(null),
    check = useRef(null);
  const up = tab === 'signup',
    v = state.values,
    passkeys = passkeysSupported();
  state.shown = true;
  useLayoutEffect(() => {
    applyTheme(null);
  }, []);
  const remember = () => {
    if (form.current)
      state.values = Object.fromEntries(
        [...new FormData(form.current)].filter(([k]) => !['password', 'confirmPassword'].includes(k))
      );
  };
  /* the gold ink under the chosen tab */
  useLayoutEffect(() => {
    const place = () => {
      const current = tabs.current.querySelector('[aria-pressed=true]'),
        r = current.getBoundingClientRect(),
        b = tabs.current.getBoundingClientRect();
      ink.current.style.width = r.width + 'px';
      ink.current.style.transform = `translateX(${r.left - b.left - 4}px)`;
    };
    place();
    const ready = requestAnimationFrame(() => tabs.current?.classList.add('is-ready'));
    addEventListener('resize', place, { passive: true });
    return () => {
      cancelAnimationFrame(ready);
      removeEventListener('resize', place);
    };
  }, [tab, isAr()]);
  useEffect(() => {
    check.current = null;
    if (!up) return undefined;
    let live = true;
    mountTurnstile(box.current, isAr() ? 'ar' : 'en').then(state => {
      if (live) check.current = state;
    });
    return () => {
      live = false;
    };
  }, [up, isAr()]);
  const leave = () => {
    state.values = {};
  };
  const switchTab = next => {
    if (next === tab) return;
    remember();
    state.tab = next;
    setTab(next);
    setAlert('');
    setPass({ password: '', again: '' });
  };

  let n = 0;
  const field = (name, label, type = 'text', extra = {}, hint = '', prefix = null) => (
    <label className="af" style={{ '--i': n++ }}>
      <span className="af-label">
        {label}
        {hint ? (
          <>
            {' '}
            <small>{hint}</small>
          </>
        ) : null}
      </span>
      <span className={'af-box' + (prefix ? ' has-prefix' : '') + (name === 'phone' && ownCode ? ' has-code' : '')}>
        {prefix}
        {type === 'password' ? (
          <Secret
            name={name}
            {...extra}
            onInput={e => setPass(p => ({ ...p, [name === 'password' ? 'password' : 'again']: e.target.value }))}
          />
        ) : (
          <input
            name={name}
            type={type}
            defaultValue={v[name] || ''}
            {...extra}
            onInput={name === 'phone' ? e => setOwnCode(/^\s*(\+|00)/.test(e.target.value)) : undefined}
          />
        )}
      </span>
    </label>
  );
  const select = (name, label, options, extra) => (
    <label className="af">
      <span className="sr-only">{label}</span>
      <span className="af-box">
        <select name={name} defaultValue={String(v[name] || '')} {...extra}>
          <option value="">{label}</option>
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </span>
    </label>
  );

  const signInWithKey = async () => {
    setAlert('');
    setBusy({ ...busy, passkey: true });
    try {
      await signInWithPasskey();
      leave();
      await enter();
    } catch (err) {
      setAlert(passkeyMessage(err, t));
      setBusy({ ...busy, passkey: false });
    }
  };
  const submit = async e => {
    e.preventDefault();
    remember();
    const f = form.current,
      q = Object.fromEntries(new FormData(f));
    setBusy({ ...busy, submit: true });
    setAlert('');
    try {
      if (up) {
        for (const input of f.querySelectorAll('[required]'))
          if (!String(input.value).trim()) {
            input.focus();
            throw new Error(t('Fill in every field marked as required.', 'املأ كل الحقول المطلوبة.'));
          }
        if (!q.email && !q.phone)
          throw new Error(t('Add an email address, a phone number, or both.', 'أدخل بريداً أو رقم هاتف أو كليهما.'));
        const y = Number(q.birthYear),
          m = Number(q.birthMonth),
          d = Number(q.birthDay),
          born = new Date(Date.UTC(y, m - 1, d));
        if (!(y >= 1900) || born.getUTCMonth() !== m - 1 || born.getUTCDate() !== d)
          throw new Error(t('Enter a real date of birth.', 'أدخل تاريخ ولادة صحيحاً.'));
        q.birthDate = `${y}-${pad(m)}-${pad(d)}`;
        if (q.password.length < 8)
          throw new Error(t('Choose a password of at least 8 characters.', 'اختر كلمة مرور من ٨ أحرف على الأقل.'));
        if (q.password !== q.confirmPassword)
          throw new Error(t('The passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
        if (check.current) q.turnstile = check.current.token;
      } else q.mode = 'legacy';
      await api(up ? 'signup' : 'login', 'POST', q);
      leave();
      if (up) await welcome();
      await enter();
    } catch (err) {
      setAlert(err.message);
      setBusy({ ...busy, submit: false });
      check.current?.reset();
    }
  };

  return (
    <div id="app" className={'account-auth' + (first ? ' is-first' : '')}>
      <div className="auth-shell">
        <aside className="auth-art" aria-hidden="true">
          {/* the church window beside the form, with a few candles already lit and the rest for the visitor */}
          <Sanctuary lit={3} />
          <span className="auth-shade"></span>
          <blockquote className="auth-quote">
            <p>{t('“Let your light shine before others.”', '«فليُضِئ نورُكم هكذا قدّام الناس»')}</p>
            <cite>{t('Matthew 5:16', 'متّى ٥: ١٦')}</cite>
          </blockquote>
        </aside>
        <main className="auth-main" id="well" tabIndex="-1">
          <div className="auth-card">
            <div className="auth-top">
              <a className="auth-brand" href="public.html">
                <Brand />
                <span>ParishLife</span>
              </a>
              <div className="auth-actions">
                <EasyReading lang={isAr() ? 'ar' : 'en'} />
                <button
                  type="button"
                  className="auth-lang"
                  data-lang
                  lang={isAr() ? 'en' : 'ar'}
                  onClick={() => {
                    remember();
                    onLanguage();
                  }}
                >
                  {t('العربية', 'English')}
                </button>
              </div>
            </div>
            <h1>{up ? t('Create your account', 'إنشاء حساب') : t('Welcome back', 'أهلاً بعودتك')}</h1>
            <p className="auth-lede">
              {up
                ? t(
                    'Your account connects you to the parishes you choose. It takes a minute.',
                    'حسابك يربطك بالرعايا التي تختارها. يستغرق دقيقة واحدة.'
                  )
                : t('Your account connects you to the parishes you choose.', 'حسابك يربطك بالرعايا التي تختارها.')}
            </p>
            <div className="auth-tabs" role="group" aria-label={t('Account', 'الحساب')} ref={tabs}>
              <button type="button" data-tab="login" aria-pressed={!up} onClick={() => switchTab('login')}>
                {t('Sign in', 'دخول')}
              </button>
              <button type="button" data-tab="signup" aria-pressed={up} onClick={() => switchTab('signup')}>
                {t('Sign up', 'حساب جديد')}
              </button>
              <span className="auth-tabs-ink" aria-hidden="true" ref={ink}></span>
            </div>
            <form id="account-auth-form" className="auth-form" ref={form} onSubmit={submit} key={tab}>
              {up ? (
                <>
                  <div className="af-row">
                    {field('firstName', t('First name', 'الاسم'), 'text', {
                      required: true,
                      maxLength: 60,
                      autoComplete: 'given-name'
                    })}
                    {field('lastName', t('Last name', 'الشهرة'), 'text', {
                      required: true,
                      maxLength: 60,
                      autoComplete: 'family-name'
                    })}
                  </div>
                  <fieldset className="af-set af-born" style={{ '--i': n++ }}>
                    <legend>
                      {t('Date of birth', 'تاريخ الولادة')} <small>{t('ages 13+', '١٣ سنة وما فوق')}</small>
                    </legend>
                    <div className="af-date">
                      {select(
                        'birthDay',
                        t('Day', 'اليوم'),
                        Array.from({ length: 31 }, (_, i) => [i + 1, isAr() ? (i + 1).toLocaleString('ar-LB') : i + 1]),
                        { required: true, autoComplete: 'bday-day' }
                      )}
                      {select(
                        'birthMonth',
                        t('Month', 'الشهر'),
                        MONTHS.map((m, i) => [i + 1, t(...m)]),
                        { required: true, autoComplete: 'bday-month' }
                      )}
                      <label className="af">
                        <span className="sr-only">{t('Year', 'السنة')}</span>
                        <span className="af-box">
                          <input
                            name="birthYear"
                            required
                            inputMode="numeric"
                            pattern="[0-9]{4}"
                            maxLength="4"
                            placeholder={t('Year', 'السنة')}
                            autoComplete="bday-year"
                            dir="ltr"
                            defaultValue={v.birthYear || ''}
                          />
                        </span>
                      </label>
                    </div>
                  </fieldset>
                  <fieldset className="af-set" style={{ '--i': n++ }}>
                    <legend>{t('How would you like to sign in?', 'كيف تودّ تسجيل الدخول؟')}</legend>
                    <p className="af-help">
                      {t(
                        'Add an email, a phone number, or both. A Lebanese number can be typed as you dial it, like 03 123 456.',
                        'أضف بريداً إلكترونياً أو رقم هاتف أو كليهما. يمكن كتابة الرقم اللبناني كما تطلبه، مثل ٠٣ ١٢٣ ٤٥٦.'
                      )}
                    </p>
                    <div className="af-row">
                      {field('email', t('Email', 'البريد الإلكتروني'), 'email', {
                        autoComplete: 'email',
                        maxLength: 120,
                        dir: 'ltr',
                        autoCapitalize: 'none',
                        spellCheck: 'false'
                      })}
                      {field(
                        'phone',
                        t('Mobile phone', 'الهاتف الخلوي'),
                        'tel',
                        { autoComplete: 'tel', maxLength: 40, dir: 'ltr', placeholder: '03 123 456' },
                        '',
                        <span className="af-prefix" aria-hidden="true" dir="ltr">
                          +961
                        </span>
                      )}
                    </div>
                  </fieldset>
                  <div className="af-row">
                    {field('password', t('Create password', 'إنشاء كلمة مرور'), 'password', {
                      required: true,
                      minLength: 8,
                      maxLength: 200,
                      autoComplete: 'new-password',
                      'aria-describedby': 'af-rules'
                    })}
                    {field('confirmPassword', t('Confirm password', 'تأكيد كلمة المرور'), 'password', {
                      required: true,
                      minLength: 8,
                      maxLength: 200,
                      autoComplete: 'new-password'
                    })}
                  </div>
                  {/* The password rules tick themselves off as they are met. */}
                  <ul className="af-rules" id="af-rules" style={{ '--i': n++ }}>
                    <li data-rule="length" className={pass.password.length >= 8 ? 'is-met' : undefined}>
                      <Tick />
                      {t('At least 8 characters', '٨ أحرف على الأقل')}
                    </li>
                    <li data-rule="match" className={pass.again && pass.again === pass.password ? 'is-met' : undefined}>
                      <Tick />
                      {t('Both passwords match', 'كلمتا المرور متطابقتان')}
                    </li>
                    <li className="af-rules-tip">
                      {t(
                        'A short sentence is easy to remember and hard to guess. Common or leaked passwords are refused.',
                        'الجملة القصيرة سهلة التذكّر وصعبة التخمين. تُرفض كلمات المرور الشائعة أو المسرّبة.'
                      )}
                    </li>
                  </ul>
                  <div className="af-turnstile" data-turnstile hidden ref={box}></div>
                  <div className="auth-honeypot" aria-hidden="true">
                    <input name="website" tabIndex="-1" autoComplete="off" />
                  </div>
                </>
              ) : (
                <>
                  {field('username', t('Email, phone or username', 'البريد أو الهاتف أو اسم المستخدم'), 'text', {
                    required: true,
                    autoComplete: 'username' + (passkeys ? ' webauthn' : ''),
                    maxLength: 120,
                    dir: 'auto',
                    autoCapitalize: 'none',
                    spellCheck: 'false'
                  })}
                  {field('password', t('Password', 'كلمة المرور'), 'password', {
                    required: true,
                    autoComplete: 'current-password',
                    maxLength: 200
                  })}
                  <div className="af-forgot-row" style={{ '--i': n++ }}>
                    <button
                      type="button"
                      className="af-link"
                      data-forgot
                      aria-expanded={forgot}
                      aria-controls="af-forgot"
                      onClick={() => setForgot(!forgot)}
                    >
                      {t('Forgot your password?', 'نسيت كلمة المرور؟')}
                    </button>
                  </div>
                  <div className="af-forgot" id="af-forgot" hidden={!forgot}>
                    <p>
                      {t(
                        'The office of the parish your account is with can reset it for you and give you a new password to change when you sign in. Call or visit the office.',
                        'يستطيع مكتب الرعية المرتبط بها حسابك إعادة تعيينها لك وإعطاءك كلمة مرور جديدة تغيّرها عند الدخول. اتصل بالمكتب أو زُره.'
                      )}
                    </p>
                    <a href="public.html#directory">{t('Find your parish office', 'ابحث عن مكتب رعيتك')}</a>
                    {passkeys ? (
                      <p>
                        {t(
                          'Added a passkey on this device? Sign in with it below.',
                          'أضفت مفتاح مرور على هذا الجهاز؟ ادخل به أدناه.'
                        )}
                      </p>
                    ) : null}
                  </div>
                </>
              )}
              <p className="auth-error" role="alert" data-error hidden={!alert}>
                {alert}
              </p>
              <button type="submit" className="auth-submit" style={{ '--i': n++ }} disabled={busy.submit}>
                {up ? t('Create account', 'إنشاء الحساب') : t('Sign in', 'تسجيل الدخول')}
              </button>
            </form>
            {!up && passkeys ? (
              <>
                <div className="auth-or" style={{ '--i': n++ }}>
                  <span>{t('or', 'أو')}</span>
                </div>
                <button
                  type="button"
                  className="auth-passkey"
                  data-passkey
                  style={{ '--i': n++ }}
                  disabled={busy.passkey}
                  onClick={signInWithKey}
                >
                  <Key />
                  <span>{t('Sign in with a passkey', 'الدخول بمفتاح مرور')}</span>
                </button>
              </>
            ) : null}
            <a className="auth-back" href="public.html">
              {t('Browse parishes or make a request without an account', 'تصفّح الرعايا أو قدّم طلباً دون حساب')}
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}

/* A new account opens on My account, where the parish is chosen; a sign-up that started from a
   parish's page already follows that parish. */
async function welcome() {
  const parish = new URLSearchParams(location.search).get('parish');
  try {
    sessionStorage.setItem('pl-welcome', '1');
  } catch {
    /* private mode */
  }
  if (parish) {
    try {
      await loadSession();
      await api('account/parishes', 'POST', { parish, action: 'follow' });
    } catch {
      /* followed later from My account */
    }
  }
  history.replaceState(null, '', location.pathname + location.search + '#/account');
}
