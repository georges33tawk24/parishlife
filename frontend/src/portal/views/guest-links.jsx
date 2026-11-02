/* A request made as a guest, before signing in, linked to an account once the office has checked
   that the account holder is the person who asked. */
import { useEffect, useState } from 'react';
import { api, session } from '../model/api.js';
import { t } from '../../lib/i18n.js';
import { Panel, openDrawer, closeOverlays, Paged } from '../ui/ui.jsx';

const status = s => ({ pending: t('Office review pending', 'بانتظار مراجعة المكتب'), approved: t('Account linked', 'تم ربط الحساب'), declined: t('Link declined', 'رُفض الربط') })[s] || s;

/* ---------- on My account ---------- */
export function GuestLinks() {
  const [data, setData] = useState(null), [round, setRound] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api('account/guest-requests').then(setData, () => {}); }, [round]);
  if (!data) return null;
  const submit = async e => {
    e.preventDefault(); setBusy(true);
    try {
      const value = e.currentTarget.elements.tracking.value.trim();
      let token = value;
      try { token = new URLSearchParams(new URL(value).hash.slice(1)).get('track') || value; } catch { /* a bare token */ }
      await api('account/guest-requests', 'POST', { token });
      setError(''); setBusy(false); setRound(r => r + 1);
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return <Panel title={t('Requests made before signing in', 'طلبات قُدّمت قبل تسجيل الدخول')}>
    <p className="help">{t('Paste the private tracking link for a request you made as a guest. The office verifies your identity before linking it. This does not enrol you in the parish.', 'الصق رابط المتابعة الخاص بطلب قدّمته كزائر. يتحقق المكتب من هويتك قبل ربطه بحسابك. لا يمنحك ذلك عضوية في الرعية.')}</p>
    <form data-link-request="" onSubmit={submit} key={round}><label className="formrow"><span className="label">{t('Private tracking link', 'رابط المتابعة الخاص')}</span><input className="input" name="tracking" required autoComplete="off" /></label>
      <p role="alert" className="help-error">{error}</p><button className="btn btn-secondary" disabled={busy}>{t('Request account link', 'طلب الربط بالحساب')}</button></form>
    <Paged className="account-parishes" data-paginate="">{data.requests.map((r, i) => <article key={i}><div><h3>{r.parishName}</h3><p>{status(r.status)}</p>
      {r.details ? <><p>{r.details.description}</p><p>{r.requestStatus.replaceAll('-', ' ')}</p><p>{r.response}</p>
        {r.files.map(f => <p key={f.id}><a href={`/api/account/guest-files/${encodeURIComponent(r.requestId)}/${encodeURIComponent(f.id)}`} download="">{t('Download', 'تنزيل')}: {f.name}</a></p>)}</> : null}</div></article>)}</Paged>
  </Panel>;
}

/* ---------- the office's review of who asked to link a guest request ---------- */
function LinkReview({ request }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState('');
  useEffect(() => { api('workspace/guest-links?parish=' + encodeURIComponent(session.parishId) + '&id=' + encodeURIComponent(request.id)).then(setData, e => setError(e.message)); }, []);
  const decide = async (e, l, value) => {
    setBusy(l.user_id + value);
    const box = e.currentTarget.closest('.drawer-body').querySelector(`[data-identity="${CSS.escape(l.user_id)}"]`);
    try {
      await api('workspace/guest-links', 'POST', { parish: session.parishId, id: request.id, userId: l.user_id, status: value, verified: box?.checked === true });
      closeOverlays(); reviewGuestLinks(request);
    } catch (err) { setError(err.message); setBusy(''); }
  };
  return <><div data-links="">{data ? <><p>{t('Compare the account holder’s identity with the original applicant before approving.', 'قارن هوية صاحب الحساب بمقدّم الطلب الأصلي قبل الموافقة.')}</p>
    <Paged className="account-parishes" data-paginate="">{data.links.length ? data.links.map(l => <article key={l.user_id}><div><h3>{l.name}</h3><p>{l.username} · {status(l.status)}</p>
      {l.status === 'pending' ? <><label className="check"><input type="checkbox" data-identity={l.user_id} />{t('I verified this is the applicant’s account.', 'تحققت من أن هذا حساب مقدّم الطلب.')}</label>
        <div className="account-actions"><button className="btn btn-primary" data-user={l.user_id} data-decision="approved" disabled={busy === l.user_id + 'approved'} onClick={e => decide(e, l, 'approved')}>{t('Approve link', 'الموافقة على الربط')}</button>
          <button className="btn btn-secondary" data-user={l.user_id} data-decision="declined" disabled={busy === l.user_id + 'declined'} onClick={e => decide(e, l, 'declined')}>{t('Decline', 'رفض')}</button></div></> : null}</div></article>)
      : <p>{t('No account-link requests.', 'لا طلبات ربط حسابات.')}</p>}</Paged></> : null}</div>
    <p role="alert" className="help-error">{error}</p></>;
}
export function reviewGuestLinks(request) {
  openDrawer({ title: t('Requested account links', 'طلبات ربط الحسابات'), body: <LinkReview key={Date.now()} request={request} /> });
}
