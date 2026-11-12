/* Purpose: the forms that change how the signed-in account signs in: password and email, and the pieces the
   other security forms share.
   Main members: ProofFields (the current password and, with two-factor, an authenticator code), proofOf,
   endSession (these changes sign every session out, this one included), changeAccountPassword, changeAccountEmail.

   ParishLife.Api asks for fresh proof before it changes a sign-in method, and ends all sessions afterwards
   (RequiresSignIn). endSession leaves a notice for the sign-in page and reloads, so the person lands there. */
import { useState } from 'react';
import { changePassword, beginEmailChange, confirmEmailChange } from '../../model/account.js';
import { t } from '../../../lib/i18n.js';
import { openDrawer } from '../../ui/ui.jsx';

/* After a change that signed every session out: say why on the sign-in page. */
export function endSession(message) {
  try {
    sessionStorage.setItem('pl-notice', message);
  } catch {
    /* the notice is a courtesy */
  }
  location.reload();
}

/* mfa: the account's two-factor status (GET auth/mfa/status), or null when it could not be read. */
export function ProofFields({ mfa, prefix = '' }) {
  const needsCode = mfa === null || mfa?.enabled;
  return (
    <>
      <label className="formrow">
        <span className="label">{t('Current password', 'كلمة المرور الحالية')}</span>
        <input className="input" name={prefix + 'password'} type="password" required autoComplete="current-password" />
      </label>
      {needsCode ? (
        <label className="formrow">
          <span className="label">
            {t('Authenticator code', 'رمز المصادقة')}
            {mfa ? '' : ' ' + t('(if two-factor is on)', '(إن كانت المصادقة الثنائية مفعّلة)')}
          </span>
          <input
            className="input"
            name={prefix + 'code'}
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength="6"
            maxLength="12"
            dir="ltr"
            required={!!mfa}
          />
        </label>
      ) : null}
    </>
  );
}
export const proofOf = (form, prefix = '') => {
  const data = new FormData(form);
  return {
    password: String(data.get(prefix + 'password') || ''),
    code: String(data.get(prefix + 'code') || '').trim()
  };
};

const Problem = ({ children }) => (
  <p className="help-error" role="alert">
    {children}
  </p>
);

function PasswordForm({ mfa }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form),
      next = String(data.get('newPassword') || '');
    if (next !== data.get('confirmPassword'))
      return setError(t('The passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
    setBusy(true);
    setError('');
    try {
      await changePassword(proofOf(form), next);
      endSession(
        t(
          'Your password was changed and every session was signed out. Sign in with the new password.',
          'تم تغيير كلمة المرور وإنهاء كل الجلسات. ادخل بكلمة المرور الجديدة.'
        )
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form data-account-password="" onSubmit={submit}>
      <p className="help">
        {t(
          'Use 16–200 characters. Every session is signed out when the password changes, this one included, so you sign in again with the new password.',
          'استخدم كلمة مرور من ١٦ إلى ٢٠٠ حرف. تنتهي كل الجلسات عند تغيير كلمة المرور، ومنها هذه، فتدخل من جديد بكلمة المرور الجديدة.'
        )}
      </p>
      <ProofFields mfa={mfa} />
      <label className="formrow">
        <span className="label">{t('New password', 'كلمة المرور الجديدة')}</span>
        <input
          className="input"
          name="newPassword"
          type="password"
          required
          minLength="16"
          maxLength="200"
          autoComplete="new-password"
        />
      </label>
      <label className="formrow">
        <span className="label">{t('Confirm new password', 'تأكيد كلمة المرور الجديدة')}</span>
        <input
          className="input"
          name="confirmPassword"
          type="password"
          required
          minLength="16"
          maxLength="200"
          autoComplete="new-password"
        />
      </label>
      <Problem>{error}</Problem>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t('Change password', 'تغيير كلمة المرور')}
      </button>
    </form>
  );
}

export const changeAccountPassword = mfa =>
  openDrawer({ title: t('Change password', 'تغيير كلمة المرور'), body: <PasswordForm mfa={mfa} /> });

/* Changing the sign-in email takes two steps: a code goes to the new address, then the code and the password
   prove it. The old address keeps working until then. */
function EmailForm({ mfa }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [change, setChange] = useState(null), // EmailChangeDto once the code has been sent
    [proof, setProof] = useState(null); // kept in this form only, for the second step
  const first = async e => {
    e.preventDefault();
    const form = e.currentTarget,
      credentials = proofOf(form);
    setBusy(true);
    setError('');
    try {
      const result = await beginEmailChange(credentials, String(new FormData(form).get('email') || '').trim());
      setProof(credentials);
      setChange(result);
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
      await confirmEmailChange(proof, change.changeId, String(new FormData(e.currentTarget).get('code') || ''));
      endSession(
        t(
          'Your email was changed and every session was signed out. Sign in with the new email address.',
          'تم تغيير البريد الإلكتروني وإنهاء كل الجلسات. ادخل بالبريد الجديد.'
        )
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  if (change)
    return (
      <form data-account-email-code="" onSubmit={second}>
        <p className="help">
          {t(
            `A code was sent to ${change.newEmail}. It works for 15 minutes. Your current email keeps working until you enter it.`,
            `أُرسل رمز إلى ${change.newEmail}. يصلح ١٥ دقيقة. يبقى بريدك الحالي يعمل حتى تدخل الرمز.`
          )}
        </p>
        <label className="formrow">
          <span className="label">{t('Code from the email', 'الرمز الذي وصلك بالبريد')}</span>
          <input
            className="input"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength="6"
            maxLength="12"
            dir="ltr"
          />
        </label>
        <Problem>{error}</Problem>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {t('Change email', 'تغيير البريد')}
        </button>
      </form>
    );
  return (
    <form data-account-email="" onSubmit={first}>
      <p className="help">
        {t(
          'We send a code to the new address to prove it is yours. Every session is signed out when the change is complete.',
          'نرسل رمزاً إلى العنوان الجديد للتأكد أنه لك. تنتهي كل الجلسات عند اكتمال التغيير.'
        )}
      </p>
      <label className="formrow">
        <span className="label">{t('New email address', 'البريد الإلكتروني الجديد')}</span>
        <input
          className="input"
          name="email"
          type="email"
          required
          maxLength="254"
          autoComplete="email"
          dir="ltr"
          autoCapitalize="none"
          spellCheck="false"
        />
      </label>
      <ProofFields mfa={mfa} />
      <Problem>{error}</Problem>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t('Send code', 'إرسال الرمز')}
      </button>
    </form>
  );
}

export const changeAccountEmail = mfa =>
  openDrawer({ title: t('Change email', 'تغيير البريد الإلكتروني'), body: <EmailForm mfa={mfa} /> });
