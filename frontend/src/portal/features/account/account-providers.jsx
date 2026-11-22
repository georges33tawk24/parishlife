/* Purpose: Google and Microsoft on My account: which providers this account signs in with, linking one, unlinking one,
   and "Add a password" for an account made by provider sign-up.
   Main members: Providers (shown only when the API has a provider configured), LinkForm, UnlinkForm, addAccountPassword.

   Routes (model/account.js): GET auth/external; POST auth/external/{provider}/link/ticket then a form post to
   /link/redirect (the browser goes to the provider and comes back to ?external=linked); POST auth/external/{provider}/unlink;
   POST auth/password/add. Linking needs two-factor plus the current password and code. Unlinking needs the current
   password, and the API refuses to remove the last way to sign in. Adding a password needs a provider sign-in of this
   session within ten minutes. Unlinking and adding a password end every session. */
import { useEffect, useState } from 'react';
import { loadExternalLogins, linkProvider, unlinkProvider, addPassword } from '../../model/account.js';
import { ProofFields, proofOf, endSession } from './account-security.jsx';
import { t, isAr } from '../../../lib/i18n.js';
import { openDrawer } from '../../ui/ui.jsx';

const NAMES = { google: 'Google', microsoft: 'Microsoft' };
const day = value => {
  const d = new Date(value);
  return Number.isNaN(+d) ? '' : new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-GB', { dateStyle: 'medium' }).format(d);
};

function LinkForm({ mfa, provider }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await linkProvider(provider, proofOf(e.currentTarget)); // the browser leaves for the provider here
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form data-provider-link={provider} onSubmit={submit}>
      <p className="help">
        {t(
          `You will go to ${NAMES[provider]} to choose the account, then come back here. Afterwards “Continue with ${NAMES[provider]}” signs you in, and your authenticator code is still asked for.`,
          `ستنتقل إلى ${NAMES[provider]} لتختار الحساب ثم تعود إلى هنا. بعدها يُدخلك «المتابعة عبر ${NAMES[provider]}»، ويبقى رمز المصادقة مطلوباً.`
        )}
      </p>
      <ProofFields mfa={mfa} />
      <p className="help-error" role="alert">
        {error}
      </p>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t(`Link ${NAMES[provider]}`, `ربط ${NAMES[provider]}`)}
      </button>
    </form>
  );
}

function UnlinkForm({ mfa, provider }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await unlinkProvider(provider, proofOf(e.currentTarget));
      endSession(
        t(
          `${NAMES[provider]} was unlinked and every session was signed out. Sign in again.`,
          `أُلغي ربط ${NAMES[provider]} وأُنهيت كل الجلسات. ادخل من جديد.`
        )
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form data-provider-unlink={provider} onSubmit={submit}>
      <p className="help">
        {t('Every session is signed out afterwards, this one included.', 'تنتهي كل الجلسات بعد ذلك، ومنها هذه.')}
      </p>
      <ProofFields mfa={mfa} />
      <p className="help-error" role="alert">
        {error}
      </p>
      <button type="submit" className="btn btn-danger" disabled={busy}>
        {t(`Unlink ${NAMES[provider]}`, `إلغاء ربط ${NAMES[provider]}`)}
      </button>
    </form>
  );
}

function AddPasswordForm({ mfa }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    const data = new FormData(e.currentTarget),
      next = String(data.get('newPassword') || '');
    if (next !== data.get('confirmPassword'))
      return setError(t('The passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
    setBusy(true);
    setError('');
    try {
      await addPassword(next, String(data.get('code') || '').trim());
      endSession(
        t(
          'Your password was added and every session was signed out. Sign in with your email and the new password, or with Google or Microsoft as before.',
          'أُضيفت كلمة المرور وأُنهيت كل الجلسات. ادخل ببريدك وكلمة المرور الجديدة، أو عبر Google أو Microsoft كما من قبل.'
        )
      );
    } catch (err) {
      setError(
        err.code === 'fresh_external_sign_in_required'
          ? t(
              'For your safety, sign out, sign in again with Google or Microsoft, then add the password within 10 minutes.',
              'حفاظاً على أمانك، اخرج ثم ادخل من جديد عبر Google أو Microsoft، ثم أضف كلمة المرور خلال ١٠ دقائق.'
            )
          : err.message
      );
      setBusy(false);
    }
  };
  return (
    <form data-account-add-password="" onSubmit={submit}>
      <p className="help">
        {t(
          'Your account was made with Google or Microsoft and has no password yet. Use 16–200 characters. Every session is signed out afterwards, this one included.',
          'أُنشئ حسابك عبر Google أو Microsoft ولا كلمة مرور له بعد. استخدم من ١٦ إلى ٢٠٠ حرف. تنتهي كل الجلسات بعد ذلك، ومنها هذه.'
        )}
      </p>
      {mfa?.enabled ? (
        <label className="formrow">
          <span className="label">{t('Authenticator code', 'رمز المصادقة')}</span>
          <input
            className="input"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength="6"
            maxLength="12"
            dir="ltr"
            required
          />
        </label>
      ) : null}
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
      <p className="help-error" role="alert">
        {error}
      </p>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t('Add password', 'إضافة كلمة المرور')}
      </button>
    </form>
  );
}

export const addAccountPassword = mfa =>
  openDrawer({ title: t('Add a password', 'إضافة كلمة مرور'), body: <AddPasswordForm mfa={mfa} /> });

/* available: the providers this deployment has (featuresOf(capabilities).external). */
export function Providers({ mfa, available, hasPassword }) {
  const [list, setList] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    loadExternalLogins().then(setList, e => setError(e.message));
  }, []);
  const linked = new Set((list || []).map(l => l.provider));
  return (
    <div className="account-passkeys" data-providers="">
      <h3>{t('Google and Microsoft', 'Google وMicrosoft')}</h3>
      <p className="help">
        {t(
          'Sign in with a Google or Microsoft account you link here. With two-factor on, your authenticator code is still asked for.',
          'ادخل بحساب Google أو Microsoft تربطه هنا. ومع تفعيل المصادقة الثنائية يبقى رمز المصادقة مطلوباً.'
        )}
      </p>
      {error ? <p className="help-error">{error}</p> : null}
      {list?.length ? (
        <ul className="passkey-list">
          {list.map(l => (
            <li key={l.provider}>
              <span>
                <b>{NAMES[l.provider] || l.provider}</b>
                <small>
                  {t('Linked', 'رُبط')} {day(l.linkedAt)}
                </small>
              </span>
              {/* The only way to sign in cannot be removed: add a password first. */}
              {hasPassword || list.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-unlink-provider={l.provider}
                  onClick={() =>
                    openDrawer({
                      title: t(`Unlink ${NAMES[l.provider]}`, `إلغاء ربط ${NAMES[l.provider]}`),
                      body: <UnlinkForm mfa={mfa} provider={l.provider} />
                    })
                  }
                >
                  {t('Unlink', 'إلغاء الربط')}
                </button>
              ) : (
                <small className="help">{t('Your only way to sign in', 'طريقتك الوحيدة للدخول')}</small>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {list
        ? available
            .filter(p => !linked.has(p))
            .map(p =>
              mfa?.enabled ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  key={p}
                  data-link-provider={p}
                  onClick={() =>
                    openDrawer({
                      title: t(`Link ${NAMES[p]}`, `ربط ${NAMES[p]}`),
                      body: <LinkForm mfa={mfa} provider={p} />
                    })
                  }
                >
                  {t(`Link ${NAMES[p] || p}`, `ربط ${NAMES[p] || p}`)}
                </button>
              ) : null
            )
        : null}
      {list && !mfa?.enabled && available.some(p => !linked.has(p)) ? (
        <p className="help">
          {hasPassword
            ? t(
                'To link Google or Microsoft, first turn on two-factor sign-in above.',
                'لربط Google أو Microsoft، فعّل أولاً الدخول بخطوتين أعلاه.'
              )
            : t(
                'To link another provider, first add a password and turn on two-factor sign-in.',
                'لربط مزوّد آخر، أضف أولاً كلمة مرور وفعّل الدخول بخطوتين.'
              )}
        </p>
      ) : null}
    </div>
  );
}
