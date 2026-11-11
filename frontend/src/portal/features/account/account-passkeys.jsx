/* Purpose: the signed-in account's passkeys on My account: the list, adding one on this device, removing one.
   Main members: Passkeys (shown only when the API reports passkeys), AddForm, RemoveForm.

   Routes: GET auth/passkeys, POST auth/passkeys/registration/options and /registration, POST
   auth/passkeys/{credentialId}/remove (model/passkeys.js). Adding or removing asks for the current password
   (and an authenticator code with two-factor). Removing ends every session, so it ends in sign-in. */
import { useEffect, useState } from 'react';
import { listPasskeys, addPasskey, removePasskey, passkeysSupported, passkeyMessage } from '../../model/passkeys.js';
import { ProofFields, proofOf, endSession } from './account-security.jsx';
import { t, isAr } from '../../../lib/i18n.js';
import { openDrawer, closeOverlays, toast } from '../../ui/ui.jsx';

const deviceName = () => {
  const ua = navigator.userAgent;
  return /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : t('This device', 'هذا الجهاز');
};
const day = value => {
  const d = new Date(value);
  return Number.isNaN(+d) ? '' : new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-GB', { dateStyle: 'medium' }).format(d);
};

function AddForm({ mfa, done }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError('');
    try {
      await addPasskey(String(new FormData(form).get('name') || ''), proofOf(form));
      closeOverlays();
      toast(
        t('Passkey added', 'أُضيف مفتاح المرور'),
        t('Next time, choose “Sign in with a passkey”.', 'في المرة المقبلة، اختر «الدخول بمفتاح مرور».'),
        'success'
      );
      done();
    } catch (err) {
      setError(passkeyMessage(err, t));
      setBusy(false);
    }
  };
  return (
    <form data-passkey-add="" onSubmit={submit}>
      <p className="help">
        {t(
          'Your device will ask for your face, fingerprint or PIN. Each device keeps its own passkey.',
          'سيطلب جهازك وجهك أو بصمتك أو رمزك. لكل جهاز مفتاح مروره.'
        )}
      </p>
      <label className="formrow">
        <span className="label">{t('Name', 'الاسم')}</span>
        <input className="input" name="name" maxLength="100" defaultValue={deviceName()} />
      </label>
      <ProofFields mfa={mfa} />
      <p className="help-error" role="alert">
        {error}
      </p>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t('Add passkey', 'إضافة مفتاح مرور')}
      </button>
    </form>
  );
}

function RemoveForm({ mfa, passkey }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await removePasskey(passkey.id, proofOf(e.currentTarget));
      endSession(
        t(
          'The passkey was removed and every session was signed out. Sign in again.',
          'أُزيل مفتاح المرور وانتهت كل الجلسات. ادخل من جديد.'
        )
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form data-passkey-remove="" onSubmit={submit}>
      <p className="help">
        {t(
          `Remove “${passkey.name}”? Every session is signed out afterwards.`,
          `إزالة «${passkey.name}»؟ تنتهي كل الجلسات بعد ذلك.`
        )}
      </p>
      <ProofFields mfa={mfa} />
      <p className="help-error" role="alert">
        {error}
      </p>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t('Remove passkey', 'إزالة مفتاح المرور')}
      </button>
    </form>
  );
}

export function Passkeys({ mfa }) {
  const [list, setList] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0);
  const supported = passkeysSupported();
  useEffect(() => {
    listPasskeys().then(setList, e => setError(e.message));
  }, [round]);
  return (
    <div className="account-passkeys" data-passkeys="">
      <h4>{t('Passkeys', 'مفاتيح المرور')}</h4>
      <p className="help">
        {t(
          'Sign in with this device’s face, fingerprint or PIN instead of your password. Each device keeps its own passkey.',
          'ادخل بوجهك أو ببصمتك أو برمز جهازك بدلاً من كلمة المرور. لكل جهاز مفتاح مروره.'
        )}
      </p>
      {error ? <p className="help-error">{error}</p> : null}
      {list?.length ? (
        <ul className="passkey-list">
          {list.map(k => (
            <li key={k.id}>
              <span>
                <b>{k.name}</b>
                <small>
                  {t('Added', 'أُضيف')} {day(k.createdAt)}
                  {k.lastUsedAt ? ` · ${t('last used', 'آخر استخدام')} ${day(k.lastUsedAt)}` : ''}
                  {k.isBackedUp ? ` · ${t('backed up across devices', 'نسخة احتياطية عبر الأجهزة')}` : ''}
                </small>
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                data-remove-passkey={k.id}
                onClick={() =>
                  openDrawer({
                    title: t('Remove passkey', 'إزالة مفتاح المرور'),
                    body: <RemoveForm mfa={mfa} passkey={k} />
                  })
                }
              >
                {t('Remove', 'إزالة')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {supported ? (
        <button
          type="button"
          className="btn btn-secondary"
          data-add-passkey=""
          onClick={() =>
            openDrawer({
              title: t('Add a passkey', 'إضافة مفتاح مرور'),
              body: <AddForm mfa={mfa} done={() => setRound(n => n + 1)} />
            })
          }
        >
          {t('Add a passkey on this device', 'أضف مفتاح مرور على هذا الجهاز')}
        </button>
      ) : (
        <p className="help">{t('This browser cannot use passkeys.', 'لا يدعم هذا المتصفح مفاتيح المرور.')}</p>
      )}
    </div>
  );
}
