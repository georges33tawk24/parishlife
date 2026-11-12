/* Ministries and membership: explore the ministries of the parishes someone follows, ask to join or
   leave one, and review requests within one's role. */

import { useEffect, useState } from 'react';
import { session } from '../../model/api.js';
import { GROUPS, PARISH, PEOPLE } from '../../model/data.js';
import { ministryRequests, requestDecision, requestMembership } from '../../model/modules/ministries.js';
import { t } from '../../../lib/i18n.js';
import { PageHead, Panel, openDrawer, closeOverlays, toast, Paged } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';

const L = t,
  open = ['requested', 'awaiting-priest', 'withdrawal-requested', 'leave-requested', 'returned'];

/* The server names groups and parishes in English; those of the open parish are shown in the
   reader's language from the parish's own records. */
const groupLabel = (id, parish, fallback) => {
  const g = parish === session.parishId ? GROUPS.find(x => x.id === id) : null;
  return g ? L(g.name, g.ar || g.name) : fallback;
};
const parishLabel = (parish, fallback) =>
  parish === session.parishId && PARISH.nameAr ? L(fallback, PARISH.nameAr) : fallback;

const statuses = {
  requested: ['Awaiting leader or priest', 'بانتظار المسؤول أو الكاهن'],
  'awaiting-priest': ['Awaiting priest', 'بانتظار الكاهن'],
  'withdrawal-requested': ['Withdrawal awaiting approval', 'سحب الطلب بانتظار الموافقة'],
  'leave-requested': ['Private departure review', 'مراجعة مغادرة خاصة'],
  returned: ['Returned for more information', 'أُعيد لاستكمال المعلومات'],
  approved: ['Membership approved', 'تمّت الموافقة على العضوية'],
  ended: ['Membership ended', 'انتهت العضوية'],
  withdrawn: ['Request withdrawn', 'تمّ سحب الطلب'],
  declined: ['Request declined', 'تمّ رفض الطلب']
};

const label = s => (statuses[s] ? L(...statuses[s]) : s);

let filter = 'all',
  query = '';

/** A drawer that asks to confirm, with whatever the form holds sent to save(). */
function Confirm({ children, save, done }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await save(Object.fromEntries(new FormData(e.currentTarget)));
      closeOverlays();
      await done();
      toast(L('Saved', 'تم الحفظ'), '', 'success');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      {children}
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {L('Confirm', 'تأكيد')}
      </button>
    </form>
  );
}

const submit = (title, body, save, done) =>
  openDrawer({
    title,
    body: (
      <Confirm save={save} done={done}>
        {body}
      </Confirm>
    )
  });

export function MinistryRequests() {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0);
  const [, redraw] = useState(0);
  useEffect(() => {
    ministryRequests(Object.fromEntries(PEOPLE.map(p => [p.id, L(p.lat, p.ar)]))).then(setData, e =>
      setError(e.message)
    );
  }, [round]);
  const refresh = () => setRound(n => n + 1);
  const q = query.toLowerCase().trim();
  const decide = (r, action, text) => {
    const needsReference =
      !r.own && action === 'approve' && r.kind === 'join' && r.priest && r.status !== 'withdrawal-requested';
    const needsReason = !r.own && action === 'decline';
    return submit(
      L('Confirm decision', 'تأكيد القرار'),
      <>
        <p>
          {groupLabel(r.group_id, r.parish_id, r.groupName)} · {r.name}
        </p>
        <p>{text}</p>
        {needsReference ? (
          <label className="formrow">
            <span className="label">
              {L('Eligibility and consent review reference', 'مرجع مراجعة الأهلية والموافقة')}
            </span>
            <input className="input" name="reference" maxLength="1000" required />
          </label>
        ) : null}
        {r.own || action === 'approve' ? null : (
          <label className="formrow">
            <span className="label">
              {r.priest
                ? L('Reason shown to the applicant', 'السبب الظاهر لمقدّم الطلب')
                : L('What the applicant needs to add', 'ما يحتاج مقدّم الطلب إلى إضافته')}
            </span>
            <textarea
              className="textarea"
              name="reason"
              maxLength="2000"
              rows="4"
              required={needsReason || !r.priest}
            />
          </label>
        )}
      </>,
      values => requestDecision(r, action, values),
      refresh
    );
  };
  const requestCard = r => {
    const withdraw = r.leader_at ? L('Request withdrawal', 'طلب سحب الطلب') : L('Withdraw request', 'سحب الطلب');
    const approve =
      r.status === 'withdrawal-requested'
        ? L('Approve withdrawal', 'الموافقة على السحب')
        : r.kind === 'leave'
          ? L('Approve departure', 'الموافقة على المغادرة')
          : r.priest
            ? L('Approve membership', 'الموافقة على العضوية')
            : L('Recommend to the priest', 'التوصية للكاهن');
    return (
      <article key={r.id} className="ministry-request">
        <div>
          <h3>
            {groupLabel(r.group_id, r.parish_id, r.groupName)} · {r.name}
          </h3>
          <p>{parishLabel(r.parish_id, r.parishName)}</p>
          <span className="pill">{label(r.status)}</span>
          {r.kind === 'leave' ? (
            <p className="help">
              {L('Private to the applicant and parish priests.', 'خاص بمقدّم الطلب وكهنة الرعية.')}
            </p>
          ) : null}
          <p className="message-body">{r.reason}</p>
        </div>
        <div className="account-actions">
          {r.own && open.includes(r.status) && r.status !== 'withdrawal-requested' ? (
            <button
              className="btn btn-secondary"
              data-action="withdraw"
              data-id={r.id}
              onClick={() => decide(r, 'withdraw', withdraw)}
            >
              {withdraw}
            </button>
          ) : null}
          {!r.own && r.canReview && open.includes(r.status) ? (
            <>
              {r.status !== 'awaiting-priest' || r.priest ? (
                <button
                  className="btn btn-primary"
                  data-action="approve"
                  data-id={r.id}
                  onClick={() => decide(r, 'approve', approve)}
                >
                  {approve}
                </button>
              ) : null}
              <button
                className="btn btn-secondary"
                data-action="decline"
                data-id={r.id}
                onClick={() =>
                  decide(
                    r,
                    'decline',
                    r.priest ? L('Decline', 'رفض') : L('Return for more information', 'إعادة لاستكمال المعلومات')
                  )
                }
              >
                {r.priest ? L('Decline', 'رفض') : L('Return', 'إعادة')}
              </button>
            </>
          ) : null}
        </div>
      </article>
    );
  };
  const join = g =>
    submit(
      g.member
        ? L('Request to leave ministry', 'طلب مغادرة الخدمة')
        : L('Request to join ministry', 'طلب الانضمام للخدمة'),
      <>
        <p>
          {groupLabel(g.id, g.parish, g.name)} · {parishLabel(g.parish, g.parishName)}
        </p>
        <p className="help">
          {g.member
            ? L(
                'Only you and the parish priests can see this request and its note. Your membership remains active until a priest approves.',
                'فقط أنت وكهنة الرعية يمكنكم رؤية هذا الطلب وملاحظته. تبقى عضويتك نشطة حتى موافقة الكاهن.'
              )
            : L(
                'The leader reviews your application, followed by a priest. A priest may approve directly.',
                'يراجع المسؤول طلبك ثم الكاهن. يستطيع الكاهن الموافقة مباشرة.'
              )}
        </p>
        {g.member ? (
          <label className="formrow">
            <span className="label">{L('Optional note', 'ملاحظة اختيارية')}</span>
            <textarea className="textarea" name="reason" maxLength="2000" rows="5" />
          </label>
        ) : null}
      </>,
      values => requestMembership(g, values),
      refresh
    );
  const rows = data
    ? data.requests.filter(
        r =>
          (filter !== 'own' || r.own) &&
          (filter !== 'review' || (r.canReview && !r.own && open.includes(r.status))) &&
          [r.groupName, r.name, r.parishName, groupLabel(r.group_id, r.parish_id, ''), parishLabel(r.parish_id, '')]
            .join(' ')
            .toLowerCase()
            .includes(q)
      )
    : [];
  return (
    <>
      <PageHead
        title={L('Ministries and membership', 'الخدمات والعضوية')}
        sub={L(
          'Explore ministries, follow applications and review requests within your role.',
          'استكشف الخدمات وتابع طلباتك وراجع الطلبات ضمن صلاحياتك.'
        )}
      />
      <div data-ministry-requests="" aria-live="polite">
        {error ? (
          error
        ) : !data ? (
          L('Loading…', 'جارٍ التحميل…')
        ) : (
          <>
            <div className="collection-toolbar">
              <input
                className="input"
                type="search"
                data-search=""
                aria-label={L('Search ministries', 'البحث في الخدمات')}
                placeholder={L('Search ministries', 'البحث في الخدمات')}
                defaultValue={query}
                onChange={e => {
                  query = e.target.value;
                  redraw(n => n + 1);
                }}
              />
              <Select
                data-filter=""
                aria-label={L('Request view', 'عرض الطلبات')}
                value={filter}
                onChange={e => {
                  filter = e.target.value;
                  redraw(n => n + 1);
                }}
              >
                {[
                  ['all', L('All requests', 'كل الطلبات')],
                  ['own', L('My requests', 'طلباتي')],
                  ['review', L('Needs my review', 'تحتاج مراجعتي')]
                ].map(([v, s]) => (
                  <option key={v} value={v}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div data-request-list="">
              <Panel title={L('Requests', 'الطلبات')}>
                <Paged className="account-parishes" data-paginate="">
                  {rows.length ? rows.map(requestCard) : <p>{L('No matching requests.', 'لا طلبات مطابقة.')}</p>}
                </Paged>
              </Panel>
            </div>
            <Panel title={L('Explore your parishes’ ministries', 'استكشف خدمات رعاياك')}>
              <Paged className="inbox-grid" data-catalog="" data-paginate="">
                {data.ministries.length ? (
                  data.ministries.map(g => {
                    const pending = data.requests.some(
                        r => r.own && r.group_id === g.id && r.parish_id === g.parish && open.includes(r.status)
                      ),
                      name = [g.name, g.parishName, groupLabel(g.id, g.parish, ''), parishLabel(g.parish, '')]
                        .join(' ')
                        .toLowerCase();
                    return (
                      <article key={g.parish + g.id} className="inbox-card" data-name={name} hidden={!name.includes(q)}>
                        <h3>{groupLabel(g.id, g.parish, g.name)}</h3>
                        <p>{parishLabel(g.parish, g.parishName)}</p>
                        <p>{g.description}</p>
                        <button
                          className="btn btn-secondary"
                          data-group={g.id}
                          data-parish={g.parish}
                          disabled={pending}
                          onClick={() => join(g)}
                        >
                          {pending
                            ? L('Request in progress', 'الطلب قيد المعالجة')
                            : g.member
                              ? L('Request to leave', 'طلب مغادرة')
                              : L('Request to join', 'طلب انضمام')}
                        </button>
                      </article>
                    );
                  })
                ) : (
                  <p>
                    {L(
                      'Follow a parish in Complete Profile to discover its ministries.',
                      'تابع رعية في إكمال الملف لاكتشاف خدماتها.'
                    )}
                  </p>
                )}
              </Paged>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
