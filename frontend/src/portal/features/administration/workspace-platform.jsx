/* Purpose: the workspace's Platform tab for platform operators (MFA): the lists of every parish,
   archdiocese and sign-in account, account suspension and reinstatement with their history, and the
   operator-kept list of clergy titles with the title assigned to an account.
   Every list read is audited by the API. Suspending an account keeps all its records; it ends the
   account's sessions and stops sign-in until it is reinstated. Operator accounts, and your own, are not
   suspended here. The clergy title list starts empty: only titles an operator types in exist.
   Main members: Platform (the tab), accountStatus (the suspend/reinstate form, also used by the people
   list), PlatformParishes, PlatformArchdioceses, PlatformAccounts, ClergyTitles. */
import { useState } from 'react';
import { Pill, openDrawer, toast } from '../../ui/ui.jsx';
import { session } from '../../model/api.js';
import * as A from '../../model/modules/administration-api.js';
import { useLoad } from './use-load.js';
import { L, Row, Section, openForm, shortDay } from './workspace-forms.jsx';

const ACCOUNT_STATUS = {
  Active: [L('Active', 'فعّال'), 'success'],
  Suspended: [L('Suspended', 'معلّق'), 'danger'],
  Pending: [L('Registration not finished', 'التسجيل غير مكتمل'), 'warning']
};
const PARISH_STATUS = {
  PendingVerification: L('Pending verification', 'بانتظار التوثيق'),
  Verified: L('Verified', 'موثّقة'),
  Suspended: L('Suspended', 'معلّقة'),
  Closed: L('Closed', 'مقفلة')
};

/* A search box and an optional status select; the list reloads when either changes. */
function Filter({ value, onChange, statuses }) {
  return (
    <form className="toolbar" onSubmit={e => e.preventDefault()}>
      <input
        className="input"
        type="search"
        value={value.q}
        onChange={e => onChange({ ...value, q: e.target.value })}
        placeholder={L('Search', 'بحث')}
        aria-label={L('Search', 'بحث')}
      />
      {statuses ? (
        <select
          className="select"
          value={value.status}
          onChange={e => onChange({ ...value, status: e.target.value })}
          aria-label={L('Status', 'الحالة')}
        >
          <option value="">{L('Any status', 'أي حالة')}</option>
          {Object.entries(statuses).map(([k, label]) => (
            <option key={k} value={k}>
              {Array.isArray(label) ? label[0] : label}
            </option>
          ))}
        </select>
      ) : null}
    </form>
  );
}

const Loading = ({ state }) =>
  state.error ? (
    <p className="alert alert-danger">{state.error}</p>
  ) : !state.data ? (
    <p role="status">{L('Loading…', 'جارٍ التحميل…')}</p>
  ) : null;

function PlatformParishes({ open }) {
  const [filter, setFilter] = useState({ q: '', status: '' });
  const state = useLoad(() => A.platformParishes(filter), [filter.q, filter.status]);
  return (
    <Section title={L('All parishes', 'كل الرعايا')}>
      <Filter value={filter} onChange={setFilter} statuses={PARISH_STATUS} />
      <Loading state={state} />
      {state.data && !state.data.length ? <p>{L('No parish matches.', 'لا رعية مطابقة.')}</p> : null}
      {(state.data || []).map(p => (
        <Row
          key={p.id}
          data-platform-parish={p.id}
          title={
            <>
              {p.name} <Pill label={PARISH_STATUS[p.status] || p.status} />
            </>
          }
          lines={[
            [p.locality, p.declaredArchdiocese].filter(Boolean).join(' · '),
            `${L('Reference', 'المرجع')}: ${p.id}`
          ]}
          actions={
            <button
              className="btn btn-secondary btn-dense"
              data-open-parish={p.id}
              onClick={() => open('parish', p.id)}
            >
              {L('Open in Organizations', 'فتح في المؤسسات')}
            </button>
          }
        />
      ))}
    </Section>
  );
}

function PlatformArchdioceses({ open }) {
  const [filter, setFilter] = useState({ q: '', status: '' });
  const state = useLoad(() => A.platformArchdioceses({ q: filter.q }), [filter.q]);
  return (
    <Section title={L('All archdioceses', 'كل الأبرشيات')}>
      <Filter value={filter} onChange={setFilter} />
      <Loading state={state} />
      {state.data && !state.data.length ? <p>{L('No archdiocese matches.', 'لا أبرشية مطابقة.')}</p> : null}
      {(state.data || []).map(a => (
        <Row
          key={a.id}
          data-platform-archdiocese={a.id}
          title={a.name}
          lines={[
            a.locality,
            a.verified ? L('Verified', 'موثّقة') : L('Not verified yet', 'غير موثّقة بعد'),
            `${L('Reference', 'المرجع')}: ${a.id}`
          ]}
          actions={
            <button
              className="btn btn-secondary btn-dense"
              data-open-archdiocese={a.id}
              onClick={() => open('archdiocese', a.id)}
            >
              {L('Open in Organizations', 'فتح في المؤسسات')}
            </button>
          }
        />
      ))}
    </Section>
  );
}

/* Suspend or reinstate one account. The account is read first, for its current status and version. */
export async function accountStatus(accountId, done) {
  const { value: account, version } = await A.platformAccount(accountId);
  const suspend = account.status === 'Active';
  openForm({
    title: suspend ? L('Suspend the account', 'تعليق الحساب') : L('Reinstate the account', 'إعادة تفعيل الحساب'),
    sub: account.displayName || account.userName,
    intro: suspend
      ? L(
          'Every record is kept. The account is signed out everywhere and cannot sign in, in any parish, until it is reinstated.',
          'تبقى جميع السجلات محفوظة. يُسجَّل خروج الحساب من كل مكان ولا يمكنه الدخول في أي رعية حتى تُعاد تفعيله.'
        )
      : L(
          'The account can sign in again. Its earlier sessions stay ended.',
          'يمكن للحساب الدخول مجدداً. تبقى جلساته السابقة منتهية.'
        ),
    fields: [{ name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' }],
    label: suspend ? L('Suspend', 'تعليق') : L('Reinstate', 'إعادة التفعيل'),
    save: v =>
      suspend
        ? A.suspendAccount(accountId, version, v.reason)
        : account.status === 'Suspended'
          ? A.reinstateAccount(accountId, version, v.reason)
          : Promise.reject(new Error(L('This account has not finished registering.', 'لم يُكمل هذا الحساب التسجيل.'))),
    done
  });
}

function historyDrawer(account, names) {
  const Body = () => {
    const state = useLoad(() => A.accountStatusHistory(account.accountId), []);
    return (
      <>
        <Loading state={state} />
        {state.data && !state.data.length ? <p>{L('No status change yet.', 'لا تغيير في الحالة بعد.')}</p> : null}
        {(state.data || []).map(c => (
          <Row
            key={c.id}
            title={`${c.action} · ${shortDay(c.at)}`}
            lines={[c.reason, `${L('By', 'بواسطة')}: ${names.get(c.by) || c.by}`]}
          />
        ))}
      </>
    );
  };
  openDrawer({ title: L('Account status history', 'سجل حالة الحساب'), sub: account.userName, body: <Body /> });
}

async function clergyTitleForm(account) {
  const [titles, current] = await Promise.all([A.listClergyTitles(), A.clergyTitleOf(account.accountId)]);
  openForm({
    title: L('Clergy title', 'اللقب الكنسي'),
    sub: account.displayName || account.userName,
    intro: titles.length
      ? L('A title is shown with the name; it gives no authority.', 'يظهر اللقب مع الاسم ولا يمنح أي صلاحية.')
      : L('The title list is empty. Add titles in Clergy titles first.', 'قائمة الألقاب فارغة. أضف الألقاب أولاً.'),
    fields: [
      {
        name: 'clergyTitleId',
        label: L('Title', 'اللقب'),
        type: 'select',
        required: false,
        value: current.value.clergyTitleId || '',
        options: [
          ['', L('No title', 'بلا لقب')],
          ...titles.map(({ value: x }) => [x.id, [x.title, x.titleAr].filter(Boolean).join(' / ')])
        ]
      }
    ],
    save: v => A.assignClergyTitle(account.accountId, current.version, v.clergyTitleId || null)
  });
}

function PlatformAccounts() {
  const [filter, setFilter] = useState({ q: '', status: '' });
  const state = useLoad(() => A.platformAccounts(filter), [filter.q, filter.status]);
  const me = session.accountUser?.id;
  const names = new Map((state.data || []).map(({ value: a }) => [a.accountId, a.displayName || a.userName]));
  return (
    <Section title={L('Accounts', 'الحسابات')}>
      <Filter
        value={filter}
        onChange={setFilter}
        statuses={Object.fromEntries(Object.entries(ACCOUNT_STATUS).map(([k, v]) => [k, v[0]]))}
      />
      <Loading state={state} />
      {state.data && !state.data.length ? <p>{L('No account matches.', 'لا حساب مطابق.')}</p> : null}
      {(state.data || []).map(({ value: a }) => {
        const [label, tone] = ACCOUNT_STATUS[a.status] || [a.status, ''];
        const changeable = !a.platformOperator && a.accountId !== me && a.status !== 'Pending';
        return (
          <Row
            key={a.accountId}
            data-account={a.accountId}
            title={
              <>
                {a.displayName || a.userName} <Pill label={label} tone={tone} />
                {a.platformOperator ? <Pill label={L('Platform operator', 'مشغّل المنصة')} /> : null}
              </>
            }
            lines={[
              [a.userName, a.email].filter(Boolean).join(' · '),
              [
                a.emailConfirmed || a.identityVerified ? L('Verified', 'موثّق') : L('Not verified', 'غير موثّق'),
                a.twoFactorEnabled ? L('Authenticator on', 'المصادقة مفعّلة') : L('No authenticator', 'بلا مصادقة'),
                `${L('Since', 'منذ')} ${shortDay(a.createdAt)}`
              ].join(' · '),
              `${L('Reference', 'المرجع')}: ${a.accountId}`
            ]}
            actions={
              <>
                {changeable ? (
                  <button
                    className="btn btn-secondary btn-dense"
                    data-account-status={a.accountId}
                    onClick={() =>
                      accountStatus(a.accountId, state.reload).catch(err =>
                        toast(L('Could not open', 'تعذّر الفتح'), err.message, 'danger')
                      )
                    }
                  >
                    {a.status === 'Active' ? L('Suspend', 'تعليق') : L('Reinstate', 'إعادة التفعيل')}
                  </button>
                ) : null}
                <button className="btn btn-secondary btn-dense" onClick={() => historyDrawer(a, names)}>
                  {L('Status history', 'سجل الحالة')}
                </button>
                <button
                  className="btn btn-secondary btn-dense"
                  data-clergy-title={a.accountId}
                  onClick={() =>
                    clergyTitleForm(a).catch(err => toast(L('Could not open', 'تعذّر الفتح'), err.message, 'danger'))
                  }
                >
                  {L('Clergy title', 'اللقب الكنسي')}
                </button>
              </>
            }
          />
        );
      })}
    </Section>
  );
}

function ClergyTitles() {
  const state = useLoad(() => A.listClergyTitles(true), []);
  const edit = row =>
    openForm({
      title: row ? L('Change the title', 'تعديل اللقب') : L('Add a title', 'إضافة لقب'),
      intro: L(
        'Type the title in English, Arabic or both. Neither is filled in from the other.',
        'اكتب اللقب بالإنكليزية أو العربية أو كليهما. لا يُملأ أحدهما من الآخر.'
      ),
      fields: [
        { name: 'title', label: L('Title (English)', 'اللقب (إنكليزي)'), required: false, value: row?.value.title },
        { name: 'titleAr', label: L('Title (Arabic)', 'اللقب (عربي)'), required: false, value: row?.value.titleAr },
        ...(row ? [{ name: 'retired', label: L('Retired', 'متوقف'), type: 'check', value: row.value.retired }] : [])
      ],
      save: v => {
        const body = { title: v.title || null, titleAr: v.titleAr || null, retired: !!v.retired };
        return row ? A.updateClergyTitle(row.value.id, { ...body, version: row.version }) : A.createClergyTitle(body);
      },
      done: state.reload
    });
  return (
    <Section
      title={L('Clergy titles', 'الألقاب الكنسية')}
      actions={
        <button className="btn btn-secondary btn-dense" data-new-clergy-title="" onClick={() => edit(null)}>
          {L('Add a title', 'إضافة لقب')}
        </button>
      }
    >
      <Loading state={state} />
      {state.data && !state.data.length ? (
        <p>
          {L(
            'No title yet. The list holds only the titles you add.',
            'لا لقب بعد. لا تضم القائمة إلا الألقاب التي تضيفها.'
          )}
        </p>
      ) : null}
      {(state.data || []).map(row => (
        <Row
          key={row.value.id}
          data-clergy-title-row={row.value.id}
          title={[row.value.title, row.value.titleAr].filter(Boolean).join(' / ')}
          lines={[row.value.retired ? L('Retired', 'متوقف') : L('In use', 'مستخدم')]}
          actions={
            <button className="btn btn-secondary btn-dense" onClick={() => edit(row)}>
              {L('Change', 'تعديل')}
            </button>
          }
        />
      ))}
    </Section>
  );
}

export function Platform({ data, open }) {
  if (!data.scopes.operator)
    return <p>{L('Only platform operators see the platform lists.', 'لا يرى قوائم المنصة إلا مشغّلو المنصة.')}</p>;
  return (
    <>
      <PlatformAccounts />
      <PlatformParishes open={open} />
      <PlatformArchdioceses open={open} />
      <ClergyTitles />
    </>
  );
}
