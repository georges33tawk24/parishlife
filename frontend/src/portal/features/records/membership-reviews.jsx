/* Parish membership requests: the office confirms who is asking and links the account to one
   person already on the parish's records. */
import { Fragment, useEffect, useState } from 'react';
import { api, session, loadSession } from '../../model/api.js';
import { t } from '../../../lib/i18n.js';
import { PageHead, openDrawer, closeOverlays, Paged } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';

const FIELDS = [
  ['birthDate', 'Date of birth', 'تاريخ الميلاد'],
  ['email', 'Email', 'البريد'],
  ['phone', 'Phone', 'الهاتف'],
  ['address', 'Address', 'العنوان'],
  ['town', 'Town', 'البلدة'],
  ['occupation', 'Occupation', 'المهنة']
];

function Decision({ m, people, done }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('workspace/membership', 'POST', {
        ...Object.fromEntries(new FormData(e.currentTarget)),
        parish: session.parishId,
        userId: m.user_id
      });
      closeOverlays();
      await loadSession();
      done();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <label className="formrow">
        <span className="label">{t('Decision', 'القرار')}</span>
        <Select name="status">
          <option value="approved">{t('Approve membership', 'الموافقة على العضوية')}</option>
          <option value="declined">{t('Decline', 'رفض')}</option>
        </Select>
      </label>
      <label className="formrow">
        <span className="label">{t('Existing parish person', 'الشخص المسجّل في الرعية')}</span>
        <Select name="personId">
          <option value="">{t('Choose a person when approving', 'اختر شخصاً عند الموافقة')}</option>
          {people.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </label>
      <p role="alert" className="help-error">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {t('Save decision', 'حفظ القرار')}
      </button>
    </form>
  );
}

export function MembershipReviews() {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0);
  useEffect(() => {
    api('workspace/membership?parish=' + encodeURIComponent(session.parishId)).then(setData, e => setError(e.message));
  }, [round]);
  const review = m =>
    openDrawer({
      title: m.name,
      body: (
        <>
          <dl className="dl">
            {FIELDS.map(([key, en, ar]) => (
              <Fragment key={key}>
                <dt>{t(en, ar)}</dt>
                <dd>{m.profile[key] || '—'}</dd>
              </Fragment>
            ))}
          </dl>
          <p className="help">
            {t(
              'Information supplied by the applicant. Review it before linking an existing record; no person is created automatically.',
              'هذه المعلومات قدّمها صاحب الطلب. راجعها قبل الربط بسجل موجود؛ لا يُنشأ شخص تلقائياً.'
            )}
          </p>
          <Decision m={m} people={data.people} done={() => setRound(r => r + 1)} />
        </>
      )
    });
  return (
    <>
      <PageHead
        title={t('Parish membership requests', 'طلبات عضوية الرعية')}
        sub={t(
          'Confirm the applicant’s identity and link their account to one parish person record.',
          'تحقّق من هوية مقدّم الطلب واربط حسابه بسجل شخص واحد في الرعية.'
        )}
      />
      <div data-memberships="">
        {error ? (
          error
        ) : !data ? (
          t('Loading…', 'جارٍ التحميل…')
        ) : (
          <>
            <div className="account-actions">
              <a className="btn btn-secondary" href="#/requests">
                {t('All requests', 'كل الطلبات')}
              </a>
              <a className="btn btn-secondary" href="#/people">
                {t('People · add a record if needed', 'المؤمنون · إضافة سجل عند الحاجة')}
              </a>
            </div>
            <Paged className="account-parishes" data-paginate="">
              {data.memberships.length ? (
                data.memberships.map(m => (
                  <article key={m.user_id}>
                    <div>
                      <h3>{m.name}</h3>
                      <p>{m.username}</p>
                    </div>
                    <button className="btn btn-primary" data-review={m.user_id} onClick={() => review(m)}>
                      {t('Review', 'مراجعة')}
                    </button>
                  </article>
                ))
              ) : (
                <p>{t('No pending membership requests.', 'لا طلبات عضوية معلّقة.')}</p>
              )}
            </Paged>
          </>
        )}
      </div>
    </>
  );
}
