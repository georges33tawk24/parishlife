/* Administrative access within a scope: who holds which role, assigning and revoking it, the
   optional secretaries, system accounts, and the history. The server supplies the roles that may
   be assigned; the browser never invents authority. */
import { useEffect, useState } from 'react';
import { api, session } from '../../model/api.js';
import { t, isAr } from '../../../lib/i18n.js';
import { Panel, openDrawer, toast } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { DrawerForm } from '../../ui/forms.jsx';

let selectedScope = '';

const administrativeLabels = {
  super_admin: ['Super Admin', 'المشرف العام'],
  diocesan_admin: ['Archdiocese Admin', 'مدير الأبرشية'],
  parish_admin: ['Parish Admin', 'مدير الرعية'],
  priest: ['Parish priest', 'كاهن الرعية'],
  secretary: ['Secretary', 'أمين السر'],
  treasurer: ['Treasurer', 'أمين الصندوق'],
  leader: ['Ministry leader', 'مسؤول الخدمة'],
  finance_view: ['Finance viewer', 'مشاهد المالية'],
  clergy_assigner: ['Delegated clergy appointments', 'تفويض تعيين الكهنة']
};

const label = role => (administrativeLabels[role] ? t(...administrativeLabels[role]) : role);

const Field = ({ name, title, type = 'text', ...extra }) => (
  <label className="formrow">
    <span className="label">{title}</span>
    <input className="input" name={name} type={type} required {...extra} />
  </label>
);

const editForm = (title, content, save, complete) =>
  openDrawer({
    title,
    body: (
      <DrawerForm
        data-access-form=""
        save={save}
        done={complete}
        saved={t('Access updated', 'تم تحديث الصلاحيات')}
        label={t('Save changes', 'حفظ التغييرات')}
      >
        {content}
      </DrawerForm>
    )
  });

export function AccessManagement({ workspace, parishId, refreshSession, parishPeople: people = [] }) {
  const scopes = [
    ...(workspace.isSuperAdmin
      ? [{ key: 'global:*', scopeType: 'global', name: t('Entire system', 'النظام كاملاً') }]
      : []),
    ...workspace.dioceses
      .filter(diocese => ['super_admin', 'bishop', 'diocesan_admin'].includes(diocese.authority))
      .map(diocese => ({
        key: 'diocese:' + diocese.id,
        scopeType: 'diocese',
        diocese: diocese.id,
        name: t('Archdiocese', 'الأبرشية') + ' · ' + diocese.name
      })),
    ...workspace.parishes.map(parish => ({
      key: 'parish:' + parish.id,
      scopeType: 'parish',
      parish: parish.id,
      name: t('Parish', 'الرعية') + ' · ' + (isAr() ? parish.metadata.ar || parish.metadata.name : parish.metadata.name)
    }))
  ];
  if (scopes.length && !scopes.some(scope => scope.key === selectedScope))
    selectedScope = scopes.find(scope => scope.parish === parishId)?.key || scopes[0].key;
  const [chosen, setChosen] = useState(selectedScope),
    [round, setRound] = useState(0);
  const [loaded, setLoaded] = useState(null),
    [failure, setFailure] = useState('');
  const [history, setHistory] = useState(null),
    [loadingMore, setLoadingMore] = useState(false);
  const scope = scopes.find(item => item.key === chosen);
  const query = scope
    ? new URLSearchParams(Object.entries(scope).filter(([key]) => ['scopeType', 'parish', 'diocese'].includes(key)))
    : null;
  useEffect(() => {
    if (!scope) return;
    setLoaded(null);
    setHistory(null);
    Promise.all([
      api('workspace/administration?' + query),
      scope.scopeType === 'parish' && scope.parish !== parishId
        ? api('workspace/people?parish=' + encodeURIComponent(scope.parish))
        : Promise.resolve({ people })
    ]).then(
      ([data, chosenPeople]) => setLoaded({ data, people: chosenPeople.people }),
      e => setFailure(e.message)
    );
  }, [chosen, round]);
  if (!scopes.length)
    return t('No administrative scope is assigned to this account.', 'لا يوجد نطاق إداري معيّن لهذا الحساب.');
  if (failure) return <span role="alert">{failure}</span>;
  if (!loaded) return <p role="status">{t('Loading access management…', 'جارٍ تحميل إدارة الصلاحيات…')}</p>;
  const { data } = loaded,
    parishPeople = loaded.people;
  const activeGrants = data.grants.filter(grant => grant.active);
  const secretaries = activeGrants.filter(grant => grant.role === 'secretary');
  const canAssign = data.assignableRoles.length > 0;
  const complete = async () => {
    await refreshSession();
  };
  const confirmPassword = (
    <Field
      name="currentPassword"
      title={t('Confirm your current password', 'تأكيد كلمة مرورك الحالية')}
      type="password"
      autoComplete="current-password"
    />
  );

  const accountAction = (user, recovery) =>
    editForm(
      recovery
        ? t('Recover account password', 'استعادة كلمة مرور الحساب')
        : user.inactive
          ? t('Reactivate account', 'إعادة تفعيل الحساب')
          : t('Deactivate account', 'تعطيل الحساب'),
      <>
        <p>
          {user.name} · {user.username}
        </p>
        <p className="help">
          {recovery
            ? t(
                'Existing sessions will be revoked. Share the new credential only through your approved identity-checked recovery process.',
                'تُلغى الجلسات القائمة. شارك بيانات الدخول الجديدة عبر آلية استعادة معتمدة بعد التحقّق من الهوية.'
              )
            : t('Account history and role assignments are retained.', 'يُحفظ سجل الحساب وتعيينات الأدوار.')}
        </p>
        <Field
          name="currentPassword"
          title={t('Your current password', 'كلمة مرورك الحالية')}
          type="password"
          autoComplete="current-password"
        />
        <Field name="reason" title={t('Reason', 'السبب')} minLength="3" maxLength="500" />
        {recovery ? (
          <>
            <Field
              name="newPassword"
              title={t('New password · 16–200 characters', 'كلمة مرور جديدة · من ١٦ إلى ٢٠٠ حرف')}
              type="password"
              minLength="16"
              maxLength="200"
              autoComplete="new-password"
            />
            <Field
              name="confirmPassword"
              title={t('Confirm new password', 'تأكيد كلمة المرور الجديدة')}
              type="password"
              minLength="16"
              maxLength="200"
              autoComplete="new-password"
            />
          </>
        ) : null}
      </>,
      values =>
        api(recovery ? 'workspace/password-reset' : 'workspace/suspension', 'POST', {
          ...values,
          scope: 'global',
          scopeType: 'global',
          userId: user.id,
          active: !user.inactive
        }),
      complete
    );
  const assign = () =>
    editForm(
      t('Assign scoped access', 'تعيين صلاحية ضمن النطاق'),
      <>
        <p>
          <b>{scope.name}</b>
        </p>
        <label className="formrow">
          <span className="label">{t('Existing account', 'الحساب الموجود')}</span>
          <Select name="userId">
            <option value="">
              {t('Choose an account or enter its username below', 'اختر حساباً أو أدخل اسم المستخدم أدناه')}
            </option>
            {data.users.map(user => (
              <option key={user.id} value={user.id}>{`${user.name} · ${user.username}`}</option>
            ))}
          </Select>
        </label>
        <label className="formrow">
          <span className="label">
            {t('Exact username for another account (optional)', 'اسم المستخدم الكامل لحساب آخر (اختياري)')}
          </span>
          <input className="input" name="username" maxLength="120" autoComplete="off" />
        </label>
        <label className="formrow">
          <span className="label">{t('Role', 'الدور')}</span>
          <Select name="role" required>
            {data.assignableRoles.map(role => (
              <option key={role.id} value={role.id}>
                {isAr() ? role.labelAr : role.label}
              </option>
            ))}
          </Select>
        </label>
        {scope.scopeType === 'parish' && data.assignableRoles.some(role => ['priest', 'leader'].includes(role.id)) ? (
          <label className="formrow">
            <span className="label">
              {t(
                'Parish person (required for a priest or ministry leader)',
                'شخص الرعية (إلزامي للكاهن أو مسؤول الخدمة)'
              )}
            </span>
            <Select name="personId">
              <option value="">{t('Keep the current person link', 'الإبقاء على ربط الشخص الحالي')}</option>
              {parishPeople.map(person => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        {scope.scopeType === 'global' ? confirmPassword : null}
      </>,
      async values => {
        let userId = values.userId;
        if (values.username.trim())
          userId = (await api('workspace/account-lookup', 'POST', { ...scope, username: values.username.trim() })).user
            .id;
        if (!userId)
          throw new Error(
            t('Choose an account or enter its exact username.', 'اختر حساباً أو أدخل اسم المستخدم الكامل.')
          );
        await api('workspace/grants', 'POST', {
          ...scope,
          role: values.role,
          userId,
          personId: values.personId || null,
          currentPassword: values.currentPassword
        });
      },
      complete
    );
  const revoke = grant =>
    editForm(
      t('Revoke access', 'سحب الصلاحية'),
      <>
        <p>
          {grant.name} · {label(grant.role)}
        </p>
        <p>{scope.name}</p>
        <p className="help">
          {t(
            'This removes this assignment only. The account, historical work, and unrelated roles remain.',
            'يُزال هذا التعيين فقط. يبقى الحساب والعمل السابق والأدوار الأخرى.'
          )}
        </p>
        {scope.scopeType === 'global' ? confirmPassword : null}
      </>,
      values =>
        api('workspace/grants', 'POST', {
          ...scope,
          userId: grant.user_id,
          role: grant.role,
          active: false,
          currentPassword: values.currentPassword
        }),
      complete
    );
  const manageSecretaries = () => {
    const currentIds = secretaries.map(secretary => secretary.user_id);
    const candidates = [...data.users];
    for (const secretary of secretaries)
      if (!candidates.some(user => user.id === secretary.user_id))
        candidates.push({
          id: secretary.user_id,
          name: secretary.name,
          username: t('Assigned secretary', 'أمين سر معيّن')
        });
    editForm(
      t('Manage optional secretaries', 'إدارة أمناء السر الاختياريين'),
      <>
        <p>{scope.name}</p>
        <p className="help">
          {t(
            'Select the accounts that should act as secretaries. Leave every box unchecked to operate without a secretary. Use Assign access to add someone from another account.',
            'اختر الحسابات التي ستتولى أمانة السر. اترك جميع الخانات فارغة للعمل دون أمين سر. استخدم تعيين صلاحية لإضافة حساب آخر.'
          )}
        </p>
        <fieldset>
          <legend>{t('Secretary accounts', 'حسابات أمناء السر')}</legend>
          {candidates.map(user => (
            <label key={user.id} className="check">
              <input type="checkbox" name="secretary" value={user.id} defaultChecked={currentIds.includes(user.id)} />
              {user.name} · {user.username}
            </label>
          ))}
        </fieldset>
      </>,
      (values, form) =>
        api('workspace/secretaries', 'POST', {
          parish: scope.parish,
          userIds: new FormData(form).getAll('secretary'),
          expectedUserIds: currentIds
        }),
      complete
    );
  };
  const moreUsers = async () => {
    setLoadingMore(true);
    try {
      const page = await api(
        'workspace/administration?' + query + '&afterUser=' + encodeURIComponent(data.nextUserCursor)
      );
      data.users.push(...page.users);
      data.nextUserCursor = page.nextUserCursor;
      setLoaded({ ...loaded });
      toast(
        t('Accounts loaded', 'تم تحميل الحسابات'),
        t('Open Assign access to select an account.', 'افتح تعيين صلاحية لاختيار حساب.'),
        'success'
      );
    } catch (e) {
      toast(t('Accounts unavailable', 'الحسابات غير متاحة'), e.message, 'danger');
    } finally {
      setLoadingMore(false);
    }
  };
  const loadHistory = async () => {
    if (history?.busy) return;
    setHistory(h => ({ events: [], cursor: '', ...h, busy: true }));
    try {
      const cursor = history?.cursor || '';
      const result = await api('workspace/history?' + query + (cursor ? '&before=' + encodeURIComponent(cursor) : ''));
      setHistory(h => ({
        events: [...(h?.events || []), ...result.events],
        cursor: result.nextCursor,
        done: !result.nextCursor,
        shown: true,
        busy: false
      }));
    } catch (e) {
      toast(t('History unavailable', 'السجل غير متاح'), e.message, 'danger');
      setHistory(h => ({ ...h, busy: false }));
    }
  };
  const systemAccount = user => (
    <article key={user.id}>
      <div>
        <b>{user.name}</b>
        <p>
          {user.username} · {user.inactive ? t('Inactive', 'غير نشط') : t('Active', 'نشط')}
        </p>
      </div>
      {user.id !== session.user.id ? (
        <div className="account-actions">
          <button
            type="button"
            className="btn btn-secondary"
            data-global-suspend={user.id}
            onClick={() => accountAction(user, false)}
          >
            {user.inactive ? t('Reactivate account', 'إعادة تفعيل الحساب') : t('Deactivate account', 'تعطيل الحساب')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-global-password={user.id}
            onClick={() => accountAction(user, true)}
          >
            {t('Recover password', 'استعادة كلمة المرور')}
          </button>
        </div>
      ) : null}
    </article>
  );
  return (
    <Panel title={t('Administrative access', 'الصلاحيات الإدارية')}>
      <label className="formrow">
        <span className="label">{t('Management scope', 'نطاق الإدارة')}</span>
        <Select
          data-access-scope=""
          value={chosen}
          onChange={e => {
            selectedScope = e.target.value;
            setChosen(e.target.value);
          }}
        >
          {scopes.map(item => (
            <option key={item.key} value={item.key}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <p className="help">
        {t(
          'Assignments apply only to the scope shown. Administrative roles do not grant clergy status. Each person uses their own account.',
          'تُطبّق التعيينات ضمن النطاق الظاهر فقط. لا تمنح الأدوار الإدارية صفة كهنوتية. يستخدم كل شخص حسابه الخاص.'
        )}
      </p>
      <div className="account-actions">
        {canAssign ? (
          <button type="button" className="btn btn-primary" data-access-assign="" onClick={assign}>
            {t('Assign access', 'تعيين صلاحية')}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary"
          data-access-history=""
          disabled={!!history?.busy || !!history?.done}
          onClick={loadHistory}
        >
          {history?.done
            ? t('History loaded', 'تم تحميل السجل')
            : history?.shown
              ? t('Load earlier history', 'تحميل السجل الأقدم')
              : t('Administrative history', 'سجل الإدارة')}
        </button>
        {data.nextUserCursor ? (
          <button
            type="button"
            className="btn btn-secondary"
            data-access-more-users=""
            disabled={loadingMore}
            onClick={moreUsers}
          >
            {t('Load more accounts for assignment', 'تحميل المزيد من الحسابات للتعيين')}
          </button>
        ) : null}
      </div>
      {scope.scopeType === 'parish' ? (
        <div className="card card-flat">
          <h3>{t('Secretary · optional', 'أمين السر · اختياري')}</h3>
          <p>
            {secretaries.length
              ? secretaries.map(secretary => secretary.name).join('، ')
              : t(
                  'No secretary assigned. The priest and authorized administrators can handle parish office work.',
                  'لم يُعيّن أمين سر. يستطيع الكاهن والمديرون المخوّلون إنجاز أعمال مكتب الرعية.'
                )}
          </p>
          <button type="button" className="btn btn-secondary" data-access-secretaries="" onClick={manageSecretaries}>
            {t('Manage secretaries', 'إدارة أمناء السر')}
          </button>
        </div>
      ) : null}
      <h3>{t('Active assignments', 'التعيينات النشطة')}</h3>
      <div className="account-parishes">
        {activeGrants.length ? (
          activeGrants.map(grant => (
            <article key={grant.id}>
              <div>
                <b>{grant.name}</b>
                <p>
                  {label(grant.role)} · {scope.name}
                </p>
              </div>
              {grant.canManage ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-access-revoke={grant.id}
                  onClick={() => revoke(grant)}
                >
                  {t('Revoke access', 'سحب الصلاحية')}
                </button>
              ) : null}
            </article>
          ))
        ) : (
          <p>
            {t('No explicit administrative assignments in this scope.', 'لا توجد تعيينات إدارية صريحة في هذا النطاق.')}
          </p>
        )}
      </div>
      <details>
        <summary>{t('Previous assignments', 'التعيينات السابقة')}</summary>
        <div className="account-parishes">
          {data.grants.some(grant => !grant.active) ? (
            data.grants
              .filter(grant => !grant.active)
              .map(grant => (
                <article key={grant.id}>
                  <div>
                    <b>{grant.name}</b>
                    <p>
                      {label(grant.role)} · {t('Revoked', 'مسحوبة')}
                    </p>
                  </div>
                </article>
              ))
          ) : (
            <p>{t('No revoked assignments.', 'لا توجد تعيينات مسحوبة.')}</p>
          )}
        </div>
      </details>
      {scope.scopeType === 'global' ? (
        <>
          <h3>{t('System accounts', 'حسابات النظام')}</h3>
          <div className="account-parishes" data-system-accounts="">
            {data.users.map(systemAccount)}
          </div>
        </>
      ) : null}
      <div data-access-history-list="" aria-live="polite">
        {history?.shown ? (
          <>
            <h3>{t('Administrative history', 'سجل الإدارة')}</h3>
            {history.events.length ? (
              history.events.map((entry, i) => (
                <article key={i} className="card card-flat">
                  <b>{entry.action}</b>
                  <p>
                    {entry.actorName || t('System operator', 'مشغّل النظام')} ·{' '}
                    <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>
                  </p>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {JSON.stringify(entry.detail, null, 2)}
                  </pre>
                </article>
              ))
            ) : (
              <p>{t('No administrative events.', 'لا توجد أحداث إدارية.')}</p>
            )}
          </>
        ) : null}
      </div>
    </Panel>
  );
}
