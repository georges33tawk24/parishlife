/* Parish membership requests: the office confirms who is asking and either links the account to one
   person already on the parish's records, creates the person from the request, asks the applicant for
   more information, or declines. Connected to GET membership-requests and its decision route. */
import { Fragment, useEffect, useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { hydrate } from '../../model/persist.js';
import { decideMembership, membershipQueue, searchPeople } from '../../model/modules/people-workflows.js';
import { PageHead, openDrawer, closeOverlays, Paged, toast } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';

const OPEN = ['Submitted', 'NeedsInformation'];
const STATUS = s =>
  ({
    Submitted: t('Waiting for office review', 'بانتظار مراجعة المكتب'),
    NeedsInformation: t('Returned to the applicant', 'أُعيد إلى مقدّم الطلب'),
    Linked: t('Linked to a person', 'رُبط بشخص'),
    Declined: t('Declined', 'مرفوض'),
    Withdrawn: t('Withdrawn by the applicant', 'سحبه مقدّم الطلب')
  })[s] || s;
const nameOf = r => `${r.givenName} ${r.familyName}`.trim();
const day = v => (v ? String(v).slice(0, 10) : '—');

const FIELDS = r => [
  [t('Date of birth', 'تاريخ الميلاد'), r.birthDate],
  [t('Contact', 'جهة الاتصال'), r.contact],
  [t('Town or locality', 'البلدة أو المنطقة'), r.locality],
  [t('Note from the applicant', 'ملاحظة مقدّم الطلب'), r.note],
  [t('Submitted', 'قُدّم في'), day(r.submittedAt)],
  [t('Reason given to the applicant', 'السبب المعروض لمقدّم الطلب'), r.applicantReason]
];

function Decision({ row, done }) {
  const r = row.value,
    [action, setAction] = useState('link'),
    [matches, setMatches] = useState([]),
    [query, setQuery] = useState(nameOf(r)),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const search = async () => {
    try {
      setMatches(query.trim() ? await searchPeople(query.trim()) : []);
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => {
    search();
  }, []);
  const submit = async e => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      await decideMembership(row, {
        ...form,
        action,
        allowPossibleDuplicate: e.currentTarget.elements.allowPossibleDuplicate?.checked
      });
      closeOverlays();
      toast(t('Decision saved', 'حُفظ القرار'), nameOf(r), 'success');
      await hydrate();
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
        <Select value={action} onChange={e => setAction(e.target.value)}>
          <option value="link">{t('Link to an existing person', 'ربط بشخص مسجّل')}</option>
          <option value="create-person">{t('Create the person from this request', 'إنشاء الشخص من هذا الطلب')}</option>
          <option value="return">{t('Ask the applicant for more information', 'طلب معلومات إضافية')}</option>
          <option value="decline">{t('Decline', 'رفض')}</option>
        </Select>
      </label>
      {action === 'link' ? (
        <>
          <div className="formrow">
            <label className="label" htmlFor="mr-search">
              {t('Find the person', 'ابحث عن الشخص')}
            </label>
            <div className="row" style={{ gap: '8px' }}>
              <input
                id="mr-search"
                className="input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    search();
                  }
                }}
              />
              <button type="button" className="btn btn-secondary" onClick={search}>
                {t('Search', 'بحث')}
              </button>
            </div>
          </div>
          <label className="formrow">
            <span className="label">{t('Existing parish person', 'الشخص المسجّل في الرعية')}</span>
            <Select name="personId" required>
              <option value="">{t('Choose a person', 'اختر شخصاً')}</option>
              {matches.map(p => (
                <option key={p.id} value={p.id}>
                  {`${p.givenName} ${p.familyName}`.trim()} {p.birthDate ? `· ${p.birthDate}` : ''}
                  {p.archived ? ` · ${t('archived', 'مؤرشف')}` : ''}
                </option>
              ))}
            </Select>
          </label>
        </>
      ) : null}
      {action === 'link' || action === 'create-person' ? (
        <label className="formrow">
          <span className="label">{t('Evidence of identity (reference)', 'مرجع إثبات الهوية')}</span>
          <input className="input" name="evidenceReference" maxLength={500} required />
        </label>
      ) : null}
      {action === 'create-person' ? (
        <label className="check">
          <input type="checkbox" name="allowPossibleDuplicate" />
          <span>
            {t(
              'A person with the same names and birth date may already exist; this is a different person.',
              'قد يوجد شخص بالاسم وتاريخ الميلاد نفسيهما؛ هذا شخص مختلف.'
            )}
          </span>
        </label>
      ) : null}
      {action === 'return' || action === 'decline' ? (
        <label className="formrow">
          <span className="label">{t('Reason shown to the applicant', 'السبب الذي يراه مقدّم الطلب')}</span>
          <textarea className="input" name="reason" maxLength={2000} required />
        </label>
      ) : null}
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
  const [rows, setRows] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0),
    [shown, setShown] = useState('open');
  useEffect(() => {
    membershipQueue().then(setRows, e => setError(e.message));
  }, [round]);
  const review = row =>
    openDrawer({
      title: nameOf(row.value),
      body: (
        <>
          <p className="help">{STATUS(row.value.status)}</p>
          <dl className="dl">
            {FIELDS(row.value).map(([label, value]) => (
              <Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </Fragment>
            ))}
          </dl>
          <p className="help">
            {t(
              'Information supplied by the applicant. Review it before linking an existing record.',
              'هذه المعلومات قدّمها صاحب الطلب. راجعها قبل الربط بسجل موجود.'
            )}
          </p>
          {OPEN.includes(row.value.status) ? <Decision row={row} done={() => setRound(r => r + 1)} /> : null}
        </>
      )
    });
  const list = (rows || []).filter(r => shown === 'all' || OPEN.includes(r.value.status));
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
        ) : !rows ? (
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
              <Select aria-label={t('Show', 'عرض')} value={shown} onChange={e => setShown(e.target.value)}>
                <option value="open">{t('Waiting for a decision', 'بانتظار قرار')}</option>
                <option value="all">{t('All requests', 'كل الطلبات')}</option>
              </Select>
            </div>
            <Paged className="account-parishes" data-paginate="">
              {list.length ? (
                list.map(row => (
                  <article key={row.value.id}>
                    <div>
                      <h3>{nameOf(row.value)}</h3>
                      <p>
                        {STATUS(row.value.status)} · {day(row.value.submittedAt)}
                      </p>
                    </div>
                    <button className="btn btn-primary" data-review={row.value.id} onClick={() => review(row)}>
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
