/* Purpose: two-factor sign-in on My account: whether an authenticator app is on, setting one up or replacing it,
   and replacing the recovery codes.
   Main members: Mfa (the panel section), SetupForm, CodesForm, RecoveryCodes.

   Routes: GET auth/mfa/status, POST auth/mfa/enrollment (stage a new authenticator), POST
   auth/mfa/enrollment/complete (prove it with a code from it), POST auth/mfa/recovery-codes. The API shows the
   recovery codes once and signs every session out when a method changes, so the codes screen ends in sign-in.
   The authenticator is added by typing the key or opening the otpauth link; there is no QR image. */
import { useState } from 'react';
import { beginMfa, completeMfa, replaceRecoveryCodes } from '../../model/account.js';
import { ProofFields, proofOf, endSession } from './account-security.jsx';
import { t } from '../../../lib/i18n.js';
import { openDrawer, toast } from '../../ui/ui.jsx';

const day = value => {
  const d = new Date(value);
  return Number.isNaN(+d) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/* The new recovery codes, shown once. Continuing ends the session, as the API has already done. */
function RecoveryCodes({ codes }) {
  return (
    <div data-recovery-codes="">
      <p className="help">
        {t(
          'Keep these recovery codes somewhere safe. Each works once if you lose your authenticator app. They are shown only now, and any earlier codes no longer work.',
          'احتفظ برموز الاسترداد هذه في مكان آمن. يصلح كل رمز مرة واحدة إن فقدت تطبيق المصادقة. تظهر الآن فقط، والرموز السابقة لم تعد صالحة.'
        )}
      </p>
      <ul className="recovery-codes" dir="ltr">
        {codes.map(c => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ul>
      <p className="help">
        {t('Every session was signed out. Sign in again to continue.', 'تم إنهاء كل الجلسات. ادخل من جديد للمتابعة.')}
      </p>
      <div className="account-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            navigator.clipboard?.writeText(codes.join('\n')).then(
              () => toast(t('Copied', 'تم النسخ'), '', 'success'),
              () => {}
            )
          }
        >
          {t('Copy codes', 'نسخ الرموز')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          data-codes-saved=""
          onClick={() =>
            endSession(t('Sign in again with your password and a code.', 'ادخل من جديد بكلمة المرور ورمز المصادقة.'))
          }
        >
          {t('I have saved them', 'حفظتها')}
        </button>
      </div>
    </div>
  );
}

function SetupForm({ mfa }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [staged, setStaged] = useState(null), // MfaEnrollmentDto, and the proof for the second step
    [codes, setCodes] = useState(null);
  const first = async e => {
    e.preventDefault();
    const credentials = proofOf(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      setStaged({ ...(await beginMfa(credentials)), credentials });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  const second = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await completeMfa(
        staged.credentials,
        staged.enrollmentId,
        String(new FormData(e.currentTarget).get('authenticator') || '')
      );
      setCodes(result.recoveryCodes || []);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  if (codes) return <RecoveryCodes codes={codes} />;
  if (staged)
    return (
      <form data-mfa-complete="" onSubmit={second}>
        <p className="help">
          {t(
            'Add ParishLife to your authenticator app with this key, then enter the 6-digit code the app shows. Nothing changes until you do.',
            'أضف ParishLife إلى تطبيق المصادقة بهذا المفتاح، ثم أدخل الرمز المؤلّف من ٦ أرقام الذي يعرضه التطبيق. لا يتغيّر شيء قبل ذلك.'
          )}
        </p>
        <p>
          <code dir="ltr" data-shared-key="">
            {staged.sharedKey}
          </code>
        </p>
        <p className="help">
          <a href={staged.authenticatorUri}>
            {t('Open in an authenticator app on this device', 'فتح في تطبيق مصادقة على هذا الجهاز')}
          </a>
          {' · '}
          {t(`Valid until ${day(staged.expiresAt)}`, `صالح حتى ${day(staged.expiresAt)}`)}
        </p>
        <label className="formrow">
          <span className="label">{t('Code from the app', 'الرمز من التطبيق')}</span>
          <input
            className="input"
            name="authenticator"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength="6"
            maxLength="12"
            dir="ltr"
          />
        </label>
        <p className="help-error" role="alert">
          {error}
        </p>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {t('Turn on two-factor', 'تفعيل المصادقة الثنائية')}
        </button>
      </form>
    );
  return (
    <form data-mfa-begin="" onSubmit={first}>
      <p className="help">
        {mfa?.enabled
          ? t(
              'Enter your password and a code from your current authenticator to start replacing it.',
              'أدخل كلمة المرور ورمزاً من تطبيق المصادقة الحالي لبدء استبداله.'
            )
          : t(
              'Enter your password to start. You will get recovery codes at the end, and every session will be signed out.',
              'أدخل كلمة المرور للبدء. ستحصل على رموز استرداد في النهاية وتنتهي كل الجلسات.'
            )}
      </p>
      <ProofFields mfa={mfa} />
      <p className="help-error" role="alert">
        {error}
      </p>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t('Continue', 'متابعة')}
      </button>
    </form>
  );
}

function CodesForm({ mfa }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [codes, setCodes] = useState(null);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setCodes((await replaceRecoveryCodes(proofOf(e.currentTarget))).recoveryCodes || []);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  if (codes) return <RecoveryCodes codes={codes} />;
  return (
    <form data-mfa-codes="" onSubmit={submit}>
      <p className="help">
        {t(
          'New recovery codes replace the old ones. Every session is signed out afterwards.',
          'تحلّ رموز الاسترداد الجديدة محل القديمة. تنتهي كل الجلسات بعد ذلك.'
        )}
      </p>
      <ProofFields mfa={mfa} />
      <p className="help-error" role="alert">
        {error}
      </p>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t('Get new recovery codes', 'الحصول على رموز استرداد جديدة')}
      </button>
    </form>
  );
}

export function Mfa({ mfa }) {
  return (
    <div className="account-mfa" data-mfa="">
      <h4>{t('Two-factor sign-in', 'تسجيل الدخول بخطوتين')}</h4>
      {mfa ? (
        <p className="help">
          {mfa.enabled
            ? t(
                `On. ${mfa.recoveryCodesRemaining} recovery codes left.`,
                `مفعّلة. بقي ${mfa.recoveryCodesRemaining} من رموز الاسترداد.`
              )
            : t(
                'Off. An authenticator app adds a second step to signing in.',
                'غير مفعّلة. يضيف تطبيق المصادقة خطوة ثانية لتسجيل الدخول.'
              )}
          {mfa.recoverySession
            ? ' ' + t('This is a restricted recovery sign-in.', 'هذا دخول استرداد محدود الصلاحيات.')
            : ''}
        </p>
      ) : (
        <p className="help">{t('Two-factor status could not be read.', 'تعذّرت قراءة حالة المصادقة الثنائية.')}</p>
      )}
      <div className="account-actions">
        <button
          type="button"
          className="btn btn-secondary"
          data-mfa-setup=""
          onClick={() =>
            openDrawer({
              title: mfa?.enabled
                ? t('Replace authenticator', 'استبدال تطبيق المصادقة')
                : t('Set up two-factor', 'إعداد المصادقة الثنائية'),
              body: <SetupForm mfa={mfa} />
            })
          }
        >
          {mfa?.enabled
            ? t('Replace authenticator', 'استبدال تطبيق المصادقة')
            : t('Set up two-factor', 'إعداد المصادقة الثنائية')}
        </button>
        {mfa?.enabled ? (
          <button
            type="button"
            className="btn btn-secondary"
            data-mfa-recovery=""
            onClick={() => openDrawer({ title: t('Recovery codes', 'رموز الاسترداد'), body: <CodesForm mfa={mfa} /> })}
          >
            {t('New recovery codes', 'رموز استرداد جديدة')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
