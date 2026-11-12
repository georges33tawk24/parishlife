/* Purpose: the account's sessions on My account: where it is signed in, and ending the others.
   Main member: Sessions.

   Routes: GET auth/sessions (a list: id, createdAt, expiresAt, revoked, isCurrent, authenticationMethod, status),
   POST auth/sessions/{sessionId}/revoke. This session is marked and has no revoke button (sign out is in the menu). */
import { useEffect, useState } from 'react';
import { loadSessions, revokeSession } from '../../model/account.js';
import { t, isAr } from '../../../lib/i18n.js';
import { toast } from '../../ui/ui.jsx';

const when = value => {
  const d = new Date(value);
  return Number.isNaN(+d)
    ? ''
    : new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};
const METHOD = () => ({
  pwd: t('Password', 'كلمة المرور'),
  mfa: t('Password and authenticator', 'كلمة المرور وتطبيق المصادقة'),
  passkey: t('Passkey', 'مفتاح مرور'),
  external: t('Google or Microsoft', 'Google أو Microsoft'),
  recovery: t('Recovery code', 'رمز استرداد'),
  unknown: t('Unknown', 'غير معروف')
});
const STATUS = () => ({
  Active: t('Active', 'نشطة'),
  Revoked: t('Signed out', 'أُنهيت'),
  Expired: t('Expired', 'منتهية'),
  Invalidated: t('Ended by a security change', 'أنهاها تغيير أمني')
});

export function Sessions() {
  const [list, setList] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0),
    [busy, setBusy] = useState('');
  useEffect(() => {
    loadSessions().then(
      r => {
        setList(r);
        setBusy('');
      },
      e => setError(e.message)
    );
  }, [round]);
  const revoke = async id => {
    setBusy(id);
    try {
      await revokeSession(id);
      setRound(n => n + 1);
    } catch (e) {
      toast(t('Could not sign that session out', 'تعذّر إنهاء الجلسة'), e.message, 'danger');
      setBusy('');
    }
  };
  const shown = (list || []).filter(s => s.status === 'Active' || s.isCurrent);
  return (
    <div className="account-sessions" data-sessions="">
      <h4>{t('Where you are signed in', 'أين سجّلت الدخول')}</h4>
      {error ? <p className="help-error">{error}</p> : null}
      {list && !shown.length ? <p className="help">{t('No active sessions.', 'لا جلسات نشطة.')}</p> : null}
      {shown.length ? (
        <ul className="passkey-list">
          {shown.map(s => (
            <li key={s.id} data-session={s.id}>
              <span>
                <b>
                  {METHOD()[s.authenticationMethod] || s.authenticationMethod}
                  {s.isCurrent ? ` · ${t('this session', 'هذه الجلسة')}` : ''}
                </b>
                <small>
                  {t('Signed in', 'دخول')} {when(s.createdAt)} · {t('expires', 'تنتهي')} {when(s.expiresAt)} ·{' '}
                  {STATUS()[s.status] || s.status}
                </small>
              </span>
              {!s.isCurrent && s.status === 'Active' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-revoke-session={s.id}
                  disabled={busy === s.id}
                  onClick={() => revoke(s.id)}
                >
                  {t('Sign out', 'إنهاء')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
