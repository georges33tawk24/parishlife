/* Purpose: "Your data" on My account: download a copy of your own data, and close your account yourself.
   Main members: AccountData (the section), CloseForm (the drawer that asks for fresh proof and the word CLOSE).

   ParishLife.Api (AccountClosureController) builds the copy and does the closing: it removes the sign-in identity,
   every sign-in method and session, the personal profile, signature and notes, and keeps what parishes hold under
   their own retention. The wording of what is removed and kept comes from the API's answer. Agent 06 owns the copy. */
import { useState } from 'react';
import { closeAccount } from '../../model/api.js';
import { t } from '../../../lib/i18n.js';
import { openDrawer, toast } from '../../ui/ui.jsx';
import { saveBlob } from '../../shared/print.js';
import { ProofFields, proofOf, endSession } from './account-security.jsx';

async function download() {
  const response = await fetch('/api/auth/account/data', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(t('The copy could not be prepared. Try again.', 'تعذّر تجهيز النسخة. حاول مجدداً.'));
  const name =
    /filename="?([^";]+)/.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'parishlife-my-data.json';
  saveBlob(name, await response.blob());
}

function CloseForm({ mfa, hasPassword }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    const form = e.currentTarget,
      proof = proofOf(form),
      confirmation = String(new FormData(form).get('confirmation') || '').trim();
    setBusy(true);
    setError('');
    try {
      await closeAccount({ currentPassword: proof.password, currentCode: proof.code, confirmation });
      endSession(
        t(
          'Your account is closed and every session was signed out. Records your parish keeps stay with the parish.',
          'أُغلق حسابك وخرجت كل الجلسات. السجلات التي تحتفظ بها رعيتك تبقى لدى الرعية.'
        )
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form data-account-close="" onSubmit={submit}>
      <p className="help">
        {t(
          'Closing removes your sign-in email and username, password, authenticator, passkeys, Google or Microsoft links, every session, and your personal profile, signature and notes. It cannot be undone. ParishLife keeps only a marker that the account existed and was closed (its number and the closing time, without your name or email) and its security and audit records. Records a parish keeps about you (your person record, sacraments, gifts and receipts, registrations, ministry and safeguarding history) stay with that parish under its retention; ask the parish office to close optional parish data.',
          'يزيل الإغلاق بريد الدخول واسم المستخدم وكلمة المرور والمصادقة ومفاتيح المرور وربط Google أو Microsoft وكل الجلسات، وملفك الشخصي وتوقيعك وملاحظاتك. لا يمكن التراجع عنه. لا يحتفظ ParishLife إلا بإشارة إلى أن الحساب كان موجوداً وأُغلق (رقمه ووقت إغلاقه، من دون اسمك أو بريدك) وبسجلات الأمان والتدقيق الخاصة به. السجلات التي تحتفظ بها رعية عنك (سجلك الشخصي والأسرار والتقدمات والإيصالات والتسجيلات وتاريخ الخدمة والحماية) تبقى لدى تلك الرعية وفق مدة حفظها؛ اطلب من مكتب الرعية إغلاق البيانات الاختيارية.'
        )}
      </p>
      {hasPassword ? (
        <ProofFields mfa={mfa} />
      ) : (
        <p className="help">
          {t(
            'This account has no password: sign out, sign in again with Google or Microsoft, then close it within 10 minutes.',
            'لا كلمة مرور لهذا الحساب: اخرج ثم ادخل مجدداً عبر Google أو Microsoft، ثم أغلقه خلال ١٠ دقائق.'
          )}
        </p>
      )}
      <label className="formrow">
        <span className="label">{t('Type CLOSE to confirm', 'اكتب CLOSE للتأكيد')}</span>
        <input className="input" name="confirmation" required autoComplete="off" dir="ltr" maxLength="10" />
      </label>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button type="submit" className="btn btn-danger" disabled={busy} aria-busy={busy || undefined}>
        {t('Close my account', 'إغلاق حسابي')}
      </button>
    </form>
  );
}

/* mfa: the account's two-factor status; hasPassword: false for an account made by Google or Microsoft sign-up. */
export function AccountData({ mfa, hasPassword }) {
  const [busy, setBusy] = useState(false);
  const copy = async () => {
    setBusy(true);
    try {
      await download();
    } catch (err) {
      toast(t('No copy yet', 'لا نسخة بعد'), err.message, 'danger');
    }
    setBusy(false);
  };
  return (
    <div className="account-sessions" data-account-data="">
      <h3>{t('Your data', 'بياناتك')}</h3>
      <p className="help">
        {t(
          'Download a copy of what your account holds and, for each parish where you are linked, your own record there.',
          'نزّل نسخة مما يحفظه حسابك، ولكل رعية أنت مرتبط بها، سجلك الخاص فيها.'
        )}
      </p>
      <button
        type="button"
        className="btn btn-secondary"
        data-download-data=""
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={copy}
      >
        {t('Download my data', 'تنزيل بياناتي')}
      </button>{' '}
      <button
        type="button"
        className="btn btn-secondary"
        data-close-account=""
        onClick={() =>
          openDrawer({
            title: t('Close my account', 'إغلاق حسابي'),
            body: <CloseForm mfa={mfa} hasPassword={hasPassword} />
          })
        }
      >
        {t('Close my account', 'إغلاق حسابي')}
      </button>
    </div>
  );
}
