/* Changing one's own password: the other sessions are signed out, this one stays. */
import { useState } from 'react';
import { api } from '../../model/api.js';
import { t } from '../../../lib/i18n.js';
import { openDrawer, closeOverlays, toast } from '../../ui/ui.jsx';

const Field = ({ name, title, autoComplete }) => (
  <label className="formrow">
    <span className="label">{title}</span>
    <input
      className="input"
      name={name}
      type="password"
      required
      {...(autoComplete === 'new-password' ? { minLength: 16, maxLength: 200 } : {})}
      autoComplete={autoComplete}
    />
  </label>
);

function PasswordForm() {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('account/password', 'POST', Object.fromEntries(new FormData(e.currentTarget)));
      closeOverlays();
      toast(t('Password changed', 'تم تغيير كلمة المرور'), '', 'success');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form data-account-password="" onSubmit={submit}>
      <p className="help">
        {t(
          'Use 16–200 characters. Other sessions will be signed out; this session remains active.',
          'استخدم كلمة مرور من ١٦ إلى ٢٠٠ حرف. تُسجّل الجلسات الأخرى خروجها وتبقى هذه الجلسة نشطة.'
        )}
      </p>
      <Field
        name="currentPassword"
        title={t('Current password', 'كلمة المرور الحالية')}
        autoComplete="current-password"
      />
      <Field name="newPassword" title={t('New password', 'كلمة المرور الجديدة')} autoComplete="new-password" />
      <Field
        name="confirmPassword"
        title={t('Confirm new password', 'تأكيد كلمة المرور الجديدة')}
        autoComplete="new-password"
      />
      <p className="help-error" role="alert">
        {error}
      </p>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t('Change password', 'تغيير كلمة المرور')}
      </button>
    </form>
  );
}

export const changeAccountPassword = () =>
  openDrawer({ title: t('Change password', 'تغيير كلمة المرور'), body: <PasswordForm /> });
