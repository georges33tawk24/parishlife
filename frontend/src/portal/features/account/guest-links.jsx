/* Purpose: on My account, link a request made as a guest (before signing in) to the signed-in account, and
   list the links already asked for.
   Main function: GuestLinks.

   A13: the account holder pastes the guest's private tracking link; the API records that this account asks
   to join the case (POST .../requests/{id}/claim, the token in X-ParishLife-Tracking). Nothing changes for
   the case until a different, authorized office reviewer verifies identity and approves (the review is in
   the office's request view). Once approved, the request appears under My requests and the tracking link
   stops working. GET /api/me/request-claims lists this account's claims by reference and parish with their
   state (waiting for review, linked, or no longer waiting: declined, replaced or closed), never the case. */
import { useEffect, useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { Panel } from '../../ui/ui.jsx';
import { parseTracking } from '../../model/guest-requests.js';
import { claimGuest, myClaims } from '../../model/modules/requests.js';

const STATE = {
  Pending: ['Waiting for office review', 'بانتظار مراجعة المكتب'],
  Linked: ['Linked: see My requests', 'مربوط: راجع «طلباتي»'],
  NotPending: ['No longer waiting: contact the parish office', 'لم يعد بانتظار المراجعة: تواصل مع مكتب الرعية']
};

export function GuestLinks() {
  const [error, setError] = useState(''),
    [sent, setSent] = useState(''),
    [busy, setBusy] = useState(false),
    [claims, setClaims] = useState([]),
    [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    myClaims().then(
      rows => live && setClaims(rows || []),
      () => live && setClaims([])
    );
    return () => {
      live = false;
    };
  }, [round]);
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
      setRound(n => n + 1);
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
      {claims.length ? (
        <ul className="help" data-request-claims="">
          {claims.map(c => (
            <li key={c.parishId + c.requestId} data-claim-state={c.state}>
              <bdi dir="ltr">{c.reference}</bdi>
              {c.parishName ? (
                <>
                  {' '}
                  · <bdi>{c.parishName}</bdi>
                </>
              ) : null}{' '}
              · {t(...(STATE[c.state] || [c.state, c.state]))}
            </li>
          ))}
        </ul>
      ) : null}
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
