/* Purpose: on My account, link a request made as a guest (before signing in) to the signed-in account.
   Main function: GuestLinks.

   A13: the account holder pastes the guest's private tracking link; the API records that this account asks
   to join the case (POST .../requests/{id}/claim, the token in X-ParishLife-Tracking). Nothing changes for
   the case until a different, authorized office reviewer verifies identity and approves (the review is in
   the office's request view). Once approved, the request appears under My requests and the tracking link
   stops working. The API does not list pending claims for the account, so this panel shows only the
   result of the claim just sent. */
import { useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { Panel } from '../../ui/ui.jsx';
import { parseTracking } from '../../model/guest-requests.js';
import { claimGuest } from '../../model/modules/requests.js';

export function GuestLinks() {
  const [error, setError] = useState(''),
    [sent, setSent] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const link = parseTracking(form.elements.tracking.value);
    setSent('');
    if (!link) return setError(t('That is not a tracking link.', 'هذا ليس رابط متابعة.'));
    setBusy(true);
    try {
      const request = await claimGuest(link);
      setError('');
      setSent(request.reference);
      form.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title={t('Requests made before signing in', 'طلبات قُدّمت قبل تسجيل الدخول')}>
      <p className="help">
        {t(
          'Paste the private tracking link for a request you made as a guest. The office verifies your identity before linking it. This does not enrol you in the parish.',
          'الصق رابط المتابعة الخاص بطلب قدّمته كزائر. يتحقق المكتب من هويتك قبل ربطه بحسابك. لا يمنحك ذلك عضوية في الرعية.'
        )}
      </p>
      <form data-link-request="" onSubmit={submit}>
        <label className="formrow">
          <span className="label">{t('Private tracking link', 'رابط المتابعة الخاص')}</span>
          <input className="input" name="tracking" required autoComplete="off" />
        </label>
        <p role="alert" className="help-error">
          {error}
        </p>
        {sent ? (
          <p role="status">
            {t(
              `Sent for office review (${sent}). When the office has verified you, the request appears under My requests.`,
              `أُرسل إلى المكتب للمراجعة (${sent}). بعد أن يتحقق منك المكتب يظهر الطلب في «طلباتي».`
            )}
          </p>
        ) : null}
        <button className="btn btn-secondary" disabled={busy}>
          {t('Request account link', 'طلب الربط بالحساب')}
        </button>
      </form>
    </Panel>
  );
}
