/* Sign in and sign up, beside the church window of the public site. Signing in takes one field (an
   email or a username) or a passkey, or Google or Microsoft where this deployment has them; signing up keeps
   every check of the account form on one screen, with the password rules shown before typing.
   An account whose email is not confirmed yet can confirm it here with a code, once the API has a delivery
   provider (GET auth/capabilities). Passkeys, email codes and external providers appear only when the
   capabilities report them. With a delivery provider, a forgotten password is reset here with an emailed code
   (plus the authenticator code for an account that has one); nobody is signed in by it. Signing up, by form or
   with a provider, needs the "13 or older" box (owner decision, 21 November 2026). */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { signIn, completeTwoFactor, register, requestPasswordReset, confirmPasswordReset } from '../model/api.js';
import { t, isAr } from '../../lib/i18n.js';
import { applyTheme } from '../../lib/theme.js';
import { signInWithPasskey, passkeyMessage, passkeysSupported } from '../model/passkeys.js';
import {
  loadCapabilities,
  featuresOf,
  requestVerificationCode,
  confirmVerificationCode,
  externalSignInPath,
  externalSignUpPath,
  pendingExternalChallenge,
  takeExternalStatus,
  postToProvider
} from '../model/account.js';
import { mountTurnstile } from '../../lib/turnstile.js';
import { Sanctuary } from '../../public/components/Sanctuary.jsx';
import { EasyReading } from '../../reading/EasyReading.jsx';

/* What a provider round trip that did not sign anyone in came back with (ExternalSignInController.Complete). */
export const externalMessage = status =>
  ({
    'not-linked': t(
      'No ParishLife account uses that sign-in yet. Choose “Sign up” to make one with it, or sign in another way and link it under My account.',
      'لا يستخدم أي حساب في ParishLife هذا الدخول بعد. اختر «إنشاء حساب» لتنشئ حساباً به، أو ادخل بطريقة أخرى واربطه من «حسابي».'
    ),
    'email-in-use': t(
      'An account already uses that email address, so no new account was made. Sign in to it normally, then link Google or Microsoft under My account.',
      'يستخدم حسابٌ هذا البريد الإلكتروني، فلم يُنشأ حساب جديد. ادخل إليه كالمعتاد ثم اربط Google أو Microsoft من «حسابي».'
    ),
    'not-verified': t(
      'That provider did not confirm an email address for the account, so no account was made. Sign up with an email and password instead.',
      'لم يؤكّد هذا المزوّد بريداً إلكترونياً للحساب، فلم يُنشأ حساب. أنشئ حساباً ببريد وكلمة مرور بدلاً من ذلك.'
    ),
    'in-use': t(
      'That Google or Microsoft account is already linked to another ParishLife account.',
      'حساب Google أو Microsoft هذا مربوط بحساب آخر في ParishLife.'
    ),
    'check-failed': t(
      'The security check did not go through. Complete the check again, then press the button once.',
      'لم ينجح فحص الأمان. أكمل الفحص من جديد، ثم اضغط الزر مرّة واحدة.'
    ),
    'age-required': t(
      'Accounts are for people aged 13 or older. Tick the box to confirm your age, then press the button again.',
      'الحسابات لمن بلغوا ١٣ سنة أو أكثر. أشِر إلى المربّع لتأكيد عمرك، ثم اضغط الزر مجدداً.'
    ),
    'check-unavailable': t(
      'The security check is not available right now. Try again in a few minutes.',
      'فحص الأمان غير متاح حالياً. حاول مجدداً بعد بضع دقائق.'
    )
  })[status] ||
  t('Signing in with that provider did not work. Try again.', 'لم ينجح الدخول عبر هذا المزوّد. حاول مجدداً.');

/* What was typed survives a switch of tab or language; passwords never do. */
const state = { tab: '', values: {}, shown: false };
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
  const [busy, setBusy] = useState({ submit: false, passkey: false, code: false, provider: false });
  const [forgot, setForgot] = useState(false);
  const [challenge, setChallenge] = useState(null); // set when the API asks for an authenticator code
  const [verify, setVerify] = useState(null); // set while confirming an email with a code
  const [reset, setReset] = useState(null); // set while resetting a forgotten password with an emailed code
  const [features, setFeatures] = useState(() => featuresOf(null));
  const [note, setNote] = useState(() => {
    /* A security change that ended every session leaves its explanation here for the next sign-in. */
    try {
      const saved = sessionStorage.getItem('pl-notice') || '';
      sessionStorage.removeItem('pl-notice');
      return saved;
    } catch {
      return '';
    }
  });
  const [pass, setPass] = useState({ password: '', again: '' });
  const form = useRef(null),
    tabs = useRef(null),
    ink = useRef(null),
    box = useRef(null),
    check = useRef(null);
  const up = tab === 'signup',
    v = state.values,
    passkeys = features.passkeys && passkeysSupported();
  state.shown = true;
  useEffect(() => {
    let live = true;
    loadCapabilities().then(c => live && setFeatures(featuresOf(c)));
    /* back from Google or Microsoft: the API put a status word in the address (never a secret) */
    const back = takeExternalStatus();
    if (back === 'two-factor')
      pendingExternalChallenge().then(
        c => live && setChallenge(c),
        () => live && setAlert(t('Sign in again.', 'سجّل الدخول مجدداً.'))
      );
    else if (back && !['signed-in', 'signed-up', 'linked'].includes(back)) setAlert(externalMessage(back));
    return () => {
      live = false;
    };
  }, []);
  useLayoutEffect(() => {
    applyTheme(null);
  }, []);
  const remember = () => {
    if (form.current)
      state.values = Object.fromEntries(
        [...new FormData(form.current)].filter(
          ([k]) => !['password', 'confirmPassword', 'code', 'authenticator', 'ageConfirmed'].includes(k)
        )
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
      <span className={'af-box' + (prefix ? ' has-prefix' : '')}>
        {prefix}
        {type === 'password' ? (
          <Secret
            name={name}
            {...extra}
            onInput={e => setPass(p => ({ ...p, [name === 'password' ? 'password' : 'again']: e.target.value }))}
          />
        ) : (
          <input name={name} type={type} defaultValue={v[name] || ''} {...extra} />
        )}
      </span>
    </label>
  );
  /* When Turnstile is on, its check must have finished before a bot-checked request is sent: the API
     refuses one without a token, and each token works once. */
  const pending = () => !!check.current && !check.current.token;
  const notChecked = () => t('Complete the check first.', 'أكمل التحقّق أولاً.');
  const ageNeeded = () =>
    t('Confirm that you are 13 or older to create an account.', 'أكّد أن عمرك ١٣ سنة أو أكثر لإنشاء حساب.');
  const ageTicked = () => !!form.current?.querySelector('[data-age]')?.checked;
  const signInWithKey = async () => {
    if (pending()) return setAlert(notChecked());
    setAlert('');
    setBusy({ ...busy, passkey: true });
    try {
      const result = await signInWithPasskey(check.current?.token);
      check.current?.reset(); // spent, whatever comes next
      if (result.twoFactor) {
        setChallenge(result.twoFactor);
        return setBusy({ ...busy, passkey: false });
      }
      leave();
      await enter();
    } catch (err) {
      setAlert(passkeyMessage(err, t));
      setBusy({ ...busy, passkey: false });
      check.current?.reset();
    }
  };
  /* Google or Microsoft, to sign in or (on the sign-up tab) to make an account: a real form post the browser
     follows to the provider, which sends the person back here (?external=...). The bot-check token rides in the form. */
  /* One press only: the buttons stay disabled while the browser leaves (the check's token works once). */
  const continueWithProvider = async provider => {
    if (busy.provider) return;
    if (up && !ageTicked()) return setAlert(ageNeeded());
    if (pending()) return setAlert(notChecked());
    setAlert('');
    setBusy(b => ({ ...b, provider: true }));
    try {
      await postToProvider(up ? externalSignUpPath(provider) : externalSignInPath(provider), [
        ...(check.current?.token ? [['turnstileToken', check.current.token]] : []),
        ...(up ? [['ageConfirmed', 'true']] : [])
      ]);
    } catch (err) {
      setAlert(err.message);
      setBusy(b => ({ ...b, provider: false }));
      check.current?.reset();
    }
  };
  /* Back from Google or Microsoft with the browser's restored copy of this page: the token was spent, so the check
     starts again and the buttons work again. */
  useEffect(() => {
    const restored = event => {
      if (!event.persisted) return;
      setBusy(b => ({ ...b, provider: false }));
      check.current?.reset();
    };
    addEventListener('pageshow', restored);
    return () => removeEventListener('pageshow', restored);
  }, []);
  /* Ask for an email code. The reply is the same whether or not the address belongs to an account waiting for one. */
  const sendCode = async () => {
    const email = String(new FormData(form.current).get('email') || '').trim();
    if (!email) return setAlert(t('Enter the email address of your account.', 'أدخل البريد الإلكتروني لحسابك.'));
    if (pending()) return setAlert(notChecked());
    setBusy({ ...busy, code: true });
    setAlert('');
    try {
      await requestVerificationCode(email, check.current?.token);
      setVerify({ sent: true });
      setNote(
        t(
          'If an account with this email is waiting to be verified, a code is on its way. It works for 15 minutes.',
          'إن كان لهذا البريد حساب ينتظر التحقّق فقد أُرسل إليه رمز. يصلح الرمز ١٥ دقيقة.'
        )
      );
    } catch (err) {
      setAlert(err.message);
    }
    setBusy({ ...busy, code: false });
    check.current?.reset();
  };
  /* Forgotten password: the reply is the same whether or not the address belongs to an account. */
  const sendResetCode = async () => {
    const email = String(new FormData(form.current).get('email') || '').trim();
    if (!email) return setAlert(t('Enter the email address of your account.', 'أدخل البريد الإلكتروني لحسابك.'));
    if (pending()) return setAlert(notChecked());
    setBusy({ ...busy, code: true });
    setAlert('');
    try {
      await requestPasswordReset(email, check.current?.token);
      setReset({ sent: true });
      setNote(
        t(
          'If this email belongs to an account, a code is on its way. It works for 15 minutes.',
          'إن كان هذا البريد لحساب، فقد أُرسل إليه رمز. يصلح الرمز ١٥ دقيقة.'
        )
      );
    } catch (err) {
      setAlert(err.message);
    }
    setBusy({ ...busy, code: false });
    check.current?.reset();
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
        if (q.password.length < 16)
          throw new Error(t('Choose a password of at least 16 characters.', 'اختر كلمة مرور من ١٦ حرفاً على الأقل.'));
        if (q.password !== q.confirmPassword)
          throw new Error(t('The passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
        if (!q.ageConfirmed) throw new Error(ageNeeded());
        if (pending()) throw new Error(notChecked());
        await register({
          email: q.email.trim(),
          password: q.password,
          displayName: `${q.firstName.trim()} ${q.lastName.trim()}`,
          ageConfirmed: true,
          turnstile: check.current?.token
        });
        setBusy({ ...busy, submit: false });
        check.current?.reset();
        if (features.verification) {
          /* the code is asked for on the next screen, with a fresh bot check: a check token works once */
          setVerify({ sent: false });
          setNote(
            t(
              'Your account is created. Press “Send code” to get a code by email, then enter it here to verify your email.',
              'تم إنشاء حسابك. اضغط «إرسال الرمز» ليصلك رمز بالبريد، ثم أدخله هنا للتحقّق من بريدك.'
            )
          );
        } else
          setNote(
            t(
              'Thank you. Once this account is verified, sign in here with your email and password.',
              'شكراً. بعد التحقّق من الحساب، ادخل هنا ببريدك وكلمة المرور.'
            )
          );
        return switchTab('login');
      }
      if (reset) {
        if (String(q.password || '').length < 16)
          throw new Error(t('Choose a password of at least 16 characters.', 'اختر كلمة مرور من ١٦ حرفاً على الأقل.'));
        await confirmPasswordReset({
          email: q.email.trim(),
          code: q.code.trim(),
          newPassword: q.password,
          currentCode: q.authenticator
        });
        setReset(null);
        setForgot(false);
        setNote(
          t(
            'Your password is changed and every signed-in device was signed out. Sign in with the new password.',
            'تغيّرت كلمة المرور وخرجت كل الأجهزة. ادخل بكلمة المرور الجديدة.'
          )
        );
        return setBusy({ ...busy, submit: false });
      }
      if (verify) {
        await confirmVerificationCode(q.email.trim(), q.code);
        setVerify(null);
        setNote(
          t(
            'Your email is verified. Sign in with your email and password.',
            'تم التحقّق من بريدك. ادخل ببريدك وكلمة المرور.'
          )
        );
        return setBusy({ ...busy, submit: false });
      }
      if (challenge) await completeTwoFactor(challenge, q.code);
      else {
        if (pending()) throw new Error(notChecked());
        const result = await signIn(q.username, q.password, check.current?.token);
        check.current?.reset(); // spent: "Use another account" after the code step needs a fresh check
        if (result.twoFactor) {
          setChallenge(result.twoFactor);
          return setBusy({ ...busy, submit: false });
        }
      }
      leave();
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
                  <div className="af-row">
                    {field('email', t('Email', 'البريد الإلكتروني'), 'email', {
                      required: true,
                      autoComplete: 'email',
                      maxLength: 254,
                      dir: 'ltr',
                      autoCapitalize: 'none',
                      spellCheck: 'false'
                    })}
                  </div>
                  <div className="af-row">
                    {field('password', t('Create password', 'إنشاء كلمة مرور'), 'password', {
                      required: true,
                      minLength: 16,
                      maxLength: 200,
                      autoComplete: 'new-password',
                      'aria-describedby': 'af-rules'
                    })}
                    {field('confirmPassword', t('Confirm password', 'تأكيد كلمة المرور'), 'password', {
                      required: true,
                      minLength: 16,
                      maxLength: 200,
                      autoComplete: 'new-password'
                    })}
                  </div>
                  {/* The password rules tick themselves off as they are met. */}
                  <ul className="af-rules" id="af-rules" style={{ '--i': n++ }}>
                    <li data-rule="length" className={pass.password.length >= 16 ? 'is-met' : undefined}>
                      <Tick />
                      {t('At least 16 characters', '١٦ حرفاً على الأقل')}
                    </li>
                    <li data-rule="match" className={pass.again && pass.again === pass.password ? 'is-met' : undefined}>
                      <Tick />
                      {t('Both passwords match', 'كلمتا المرور متطابقتان')}
                    </li>
                    <li className="af-rules-tip">
                      {t(
                        'A short sentence is easy to remember and hard to guess.',
                        'الجملة القصيرة سهلة التذكّر وصعبة التخمين.'
                      )}
                    </li>
                  </ul>
                  <div className="auth-honeypot" aria-hidden="true">
                    <input name="website" tabIndex="-1" autoComplete="off" />
                  </div>
                  <label className="af-check" style={{ '--i': n++ }}>
                    <input type="checkbox" name="ageConfirmed" value="true" required data-age />{' '}
                    <span>{t('I am 13 or older.', 'عمري ١٣ سنة أو أكثر.')}</span>
                  </label>
                </>
              ) : (
                <>
                  {reset ? (
                    <>
                      {field('email', t('Email', 'البريد الإلكتروني'), 'email', {
                        required: true,
                        autoComplete: 'email',
                        maxLength: 254,
                        dir: 'ltr',
                        autoCapitalize: 'none',
                        spellCheck: 'false'
                      })}
                      <p className="af-help">
                        <button
                          type="button"
                          className="af-link"
                          data-send-reset
                          disabled={busy.code}
                          onClick={sendResetCode}
                        >
                          {reset.sent ? t('Send a new code', 'إرسال رمز جديد') : t('Send code', 'إرسال الرمز')}
                        </button>
                      </p>
                      {field('code', t('Code from your email', 'الرمز الذي وصلك بالبريد'), 'text', {
                        required: true,
                        inputMode: 'numeric',
                        autoComplete: 'one-time-code',
                        maxLength: 12,
                        dir: 'ltr'
                      })}
                      {field('password', t('New password', 'كلمة المرور الجديدة'), 'password', {
                        required: true,
                        minLength: 16,
                        maxLength: 200,
                        autoComplete: 'new-password'
                      })}
                      {field(
                        'authenticator',
                        t('Authenticator code', 'رمز المصادقة'),
                        'text',
                        { inputMode: 'numeric', autoComplete: 'off', maxLength: 12, dir: 'ltr' },
                        t('only if your account uses an authenticator app', 'فقط إن كان حسابك يستخدم تطبيق مصادقة')
                      )}
                      <p className="af-help">
                        <button type="button" className="af-link" onClick={() => setReset(null)}>
                          {t('Back to sign in', 'العودة إلى الدخول')}
                        </button>
                      </p>
                    </>
                  ) : verify ? (
                    <>
                      {field('email', t('Email', 'البريد الإلكتروني'), 'email', {
                        required: true,
                        autoComplete: 'email',
                        maxLength: 254,
                        dir: 'ltr',
                        autoCapitalize: 'none',
                        spellCheck: 'false'
                      })}
                      <p className="af-help">
                        <button
                          type="button"
                          className="af-link"
                          data-send-code
                          disabled={busy.code}
                          onClick={sendCode}
                        >
                          {verify.sent ? t('Send a new code', 'إرسال رمز جديد') : t('Send code', 'إرسال الرمز')}
                        </button>
                      </p>
                      {field('code', t('Code from your email', 'الرمز الذي وصلك بالبريد'), 'text', {
                        required: true,
                        inputMode: 'numeric',
                        autoComplete: 'one-time-code',
                        minLength: 6,
                        maxLength: 12,
                        dir: 'ltr'
                      })}
                      <p className="af-help">
                        <button type="button" className="af-link" onClick={() => setVerify(null)}>
                          {t('Back to sign in', 'العودة إلى الدخول')}
                        </button>
                      </p>
                    </>
                  ) : challenge ? (
                    <>
                      {field('code', t('Authenticator code', 'رمز المصادقة'), 'text', {
                        required: true,
                        inputMode: 'numeric',
                        autoComplete: 'one-time-code',
                        maxLength: 12,
                        dir: 'ltr'
                      })}
                      <p className="af-help">
                        {t(
                          'Enter the 6-digit code your authenticator app shows for ParishLife.',
                          'أدخل الرمز المؤلّف من ٦ أرقام الذي يعرضه تطبيق المصادقة لحياة الرعية.'
                        )}{' '}
                        <button type="button" className="af-link" onClick={() => setChallenge(null)}>
                          {t('Use another account', 'استخدم حساباً آخر')}
                        </button>
                      </p>
                    </>
                  ) : (
                    <>
                      {field('username', t('Email or username', 'البريد أو اسم المستخدم'), 'text', {
                        required: true,
                        autoComplete: 'username',
                        maxLength: 254,
                        dir: 'auto',
                        autoCapitalize: 'none',
                        spellCheck: 'false'
                      })}
                      {field('password', t('Password', 'كلمة المرور'), 'password', {
                        required: true,
                        autoComplete: 'current-password',
                        maxLength: 200
                      })}
                    </>
                  )}
                  <div className="af-forgot-row" style={{ '--i': n++ }}>
                    {features.verification && !verify && !challenge && !reset ? (
                      <button
                        type="button"
                        className="af-link"
                        data-verify-email
                        onClick={() => {
                          remember();
                          const id = String(state.values.username || '').trim();
                          state.values = { ...state.values, email: id.includes('@') ? id : '' };
                          setAlert('');
                          setNote('');
                          setVerify({ sent: false });
                        }}
                      >
                        {t('Verify my email with a code', 'التحقّق من بريدي برمز')}
                      </button>
                    ) : null}
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
                    {/* no office can reset a password: the emailed code is the way, and the privacy address otherwise */}
                    <p>
                      {features.verification ? (
                        <>
                          <button
                            type="button"
                            className="af-link"
                            data-reset-password
                            onClick={() => {
                              remember();
                              const id = String(state.values.username || '').trim();
                              state.values = { ...state.values, email: id.includes('@') ? id : '' };
                              setAlert('');
                              setNote('');
                              setVerify(null);
                              setReset({ sent: false });
                            }}
                          >
                            {t('Reset it with a code sent to your email.', 'أعد تعيينها برمز يُرسَل إلى بريدك.')}
                          </button>{' '}
                        </>
                      ) : null}
                      {t('If you cannot receive email, write to ', 'وإذا لم يصلك البريد، راسلنا على ')}
                      <a href="mailto:privacy@parish-life.org" dir="ltr">
                        privacy@parish-life.org
                      </a>
                      .
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
              <div className="af-turnstile" data-turnstile hidden ref={box}></div>
              <p className="af-help" role="status" hidden={!note || up}>
                {note}
              </p>
              <p className="auth-error" role="alert" data-error hidden={!alert}>
                {alert}
              </p>
              <button
                type="submit"
                className="auth-submit"
                style={{ '--i': n++ }}
                disabled={busy.submit || busy.provider}
              >
                {up
                  ? t('Create account', 'إنشاء الحساب')
                  : reset
                    ? t('Set new password', 'تعيين كلمة المرور الجديدة')
                    : verify
                      ? t('Verify email', 'تحقّق من البريد')
                      : t('Sign in', 'تسجيل الدخول')}
              </button>
            </form>
            {!verify && !challenge && !reset && ((!up && passkeys) || features.external.length) ? (
              <>
                <div className="auth-or" style={{ '--i': n++ }}>
                  <span>{t('or', 'أو')}</span>
                </div>
                {!up && passkeys ? (
                  <button
                    type="button"
                    className="auth-passkey"
                    data-passkey
                    style={{ '--i': n++ }}
                    disabled={busy.passkey || busy.provider}
                    onClick={signInWithKey}
                  >
                    <Key />
                    <span>{t('Sign in with a passkey', 'الدخول بمفتاح مرور')}</span>
                  </button>
                ) : null}
                {features.external.map(provider => (
                  <button
                    type="button"
                    className="auth-passkey"
                    data-external={provider}
                    key={provider}
                    style={{ '--i': n++ }}
                    disabled={busy.provider}
                    aria-busy={busy.provider}
                    onClick={() => continueWithProvider(provider)}
                  >
                    <span>
                      {provider === 'google'
                        ? up
                          ? t('Sign up with Google', 'إنشاء حساب عبر Google')
                          : t('Continue with Google', 'المتابعة عبر Google')
                        : provider === 'microsoft'
                          ? up
                            ? t('Sign up with Microsoft', 'إنشاء حساب عبر Microsoft')
                            : t('Continue with Microsoft', 'المتابعة عبر Microsoft')
                          : provider}
                    </span>
                  </button>
                ))}
                {features.external.length ? (
                  <p className="af-help">
                    {up
                      ? t(
                          'Makes an account with the email address Google or Microsoft has confirmed, without a password. You can add one later under My account. If an account already uses that email, sign in to it and link the provider instead.',
                          'يُنشئ حساباً بالبريد الذي أكّدته Google أو Microsoft، دون كلمة مرور. يمكنك إضافتها لاحقاً من «حسابي». وإن كان حسابٌ يستخدم هذا البريد، فادخل إليه واربط المزوّد بدلاً من ذلك.'
                        )
                      : t(
                          'Works for an account made with that provider or linked to it.',
                          'يعمل للحساب الذي أُنشئ عبر هذا المزوّد أو رُبط به.'
                        )}
                  </p>
                ) : null}
              </>
            ) : null}
            <a className="auth-back" href="public.html">
              {t('Browse parishes or make a request without an account', 'تصفّح الرعايا أو قدّم طلباً دون حساب')}
            </a>
            <p className="af-help auth-legal">
              {up ? t('By creating an account you accept the ', 'بإنشاء حساب توافق على ') : t('Read the ', 'اقرأ ')}
              <a href={isAr() ? 'terms.html?lang=ar' : 'terms.html?lang=en'}>{t('terms of use', 'شروط الاستخدام')}</a>
              {t(' and the ', ' و')}
              <a href={isAr() ? 'privacy.html?lang=ar' : 'privacy.html?lang=en'}>
                {t('privacy policy', 'سياسة الخصوصية')}
              </a>
              .
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
