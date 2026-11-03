/* Administration: dioceses, parishes, accounts, bundles and access, within the authority assigned
   to the account. */
import { useEffect, useRef, useState } from 'react';
import { AccessManagement } from './administration-access.jsx';
import { api, session, loadSession } from '../../model/api.js';
import { hydrate } from '../../model/persist.js';
import { S, bus, canSee, role } from '../../model/store.js';
import { editPublicProfile } from '../communicate/public-profile.jsx';
import { editHomepage } from '../communicate/homepage-editor.jsx';
import { t } from '../../../lib/i18n.js';
import { PageHead, Panel, openDrawer, Paged } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { DrawerForm } from '../../ui/forms.jsx';

let parishId = '';

const L = t,
  roleLabel = r =>
    ({
      super_admin: L('Super Admin', 'المشرف العام'),
      bishop: L('Bishop', 'المطران'),
      diocesan_admin: L('Archdiocese Admin', 'مدير الأبرشية'),
      parish_admin: L('Parish Admin', 'مدير الرعية'),
      priest: L('Priest', 'كاهن'),
      secretary: L('Secretary', 'أمانة السر'),
      treasurer: L('Treasurer', 'أمين الصندوق'),
      leader: L('Ministry leader', 'مسؤول خدمة'),
      member: L('User', 'مستخدم'),
      finance_view: L('Finance viewer', 'مشاهد المالية'),
      clergy_assigner: L('Delegated clergy appointments', 'تفويض تعيين الكهنة')
    })[r] || r;

const Field = ({ name, label, type = 'text', value = '' }) => (
  <label className="formrow">
    <span className="label">{label}</span>
    <input className="input" name={name} type={type} defaultValue={value} required />
  </label>
);

/* options: [[value, label, chosen?]] */
const Choice = ({ name, label, options }) => (
  <label className="formrow">
    <span className="label">{label}</span>
    <Select name={name} required={name !== 'personId'} defaultValue={options.find(o => o[2])?.[0]}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </Select>
  </label>
);

/* A role that only makes sense across a diocese moves the scope there by itself. */
function ScopedForm(props) {
  const box = useRef(null);
  useEffect(() => {
    const f = box.current?.querySelector('form');
    if (!f?.elements.role || !f.elements.scopeType) return undefined;
    const sync = () => {
      if (['diocesan_admin', 'clergy_assigner'].includes(f.elements.role.value)) f.elements.scopeType.value = 'diocese';
    };
    f.elements.role.addEventListener('change', sync);
    sync();
    return () => f.elements.role.removeEventListener('change', sync);
  }, []);
  return (
    <div ref={box} style={{ display: 'contents' }}>
      <DrawerForm id="workspace-form" {...props} />
    </div>
  );
}

const form = (title, body, save, done) =>
  openDrawer({
    title,
    body: (
      <ScopedForm save={save} done={done} saved={L('Saved', 'حُفظ')}>
        {body}
      </ScopedForm>
    )
  });

export function WorkspacePage() {
  const [loaded, setLoaded] = useState(null),
    [error, setError] = useState(''),
    [, setParish] = useState(parishId),
    [query, setQuery] = useState('');
  useEffect(() => {
    let live = true;
    (async () => {
      const scope = await api('workspace');
      if (!scope.parishes.some(p => p.id === parishId))
        parishId = scope.parishes.some(p => p.id === session.parishId) ? session.parishId : scope.parishes[0]?.id || '';
      const current = scope.parishes.find(p => p.id === parishId),
        auth =
          current?.authority ||
          scope.dioceses.find(d => d.authority)?.authority ||
          session.user.platformRole ||
          session.user.role;
      const [people, plan, guest] = parishId
        ? await Promise.all([
            api('workspace/people?parish=' + encodeURIComponent(parishId)),
            api('workspace/plan?parish=' + encodeURIComponent(parishId)),
            api('workspace/guest-requests?parish=' + encodeURIComponent(parishId))
          ])
        : [{ users: [], memberships: [], people: [], grants: [] }, null, { requests: [] }];
      const certificates = auth === 'bishop' ? (await api('workspace/certificates')).certificates : [];
      if (live) setLoaded({ scope, auth, people, plan, guest, certificates, parish: parishId });
    })().catch(e => {
      if (live) setError(e.message);
    });
    return () => {
      live = false;
    };
  }, [loaded?.parish !== parishId ? parishId : loaded?.parish]);
  const head = (
    <PageHead
      title={L('Administration', 'الإدارة')}
      sub={L(
        'Manage dioceses, parishes, accounts and bundles within your assigned authority.',
        'إدارة الأبرشيات والرعايا والحسابات والباقات ضمن صلاحياتك.'
      )}
    />
  );
  if (error || !loaded || loaded.parish !== parishId)
    return (
      <>
        {head}
        <div data-workspace="" aria-live="polite">
          {error || L('Loading administration…', 'جارٍ تحميل الإدارة…')}
        </div>
      </>
    );
  const { scope, auth, people, plan, guest, certificates } = loaded;
  const diocesan = ['super_admin', 'bishop', 'diocesan_admin'].includes(auth);
  const refresh = async () => {
    await loadSession();
    S.role = session.user.role;
    await hydrate();
    if (!canSee(S.route)) S.route = role().nav.find(n => n[0] === 'l')[1];
    bus.renderAll();
  };
  const dioceses = scope.dioceses.map(d => [d.id, d.name]);
  const BUNDLES = ['presence', 'office', 'community', 'complete'];
  const emergency = () => {
    let found = null;
    form(
      L('Emergency message access', 'الوصول إلى رسالة في حالة طارئة'),
      <>
        <p className="help">
          {L(
            'Open one specific message using its reference. Your reason and access are recorded.',
            'افتح رسالة محددة بواسطة مرجعها. يُسجّل سببك ووصولك.'
          )}
        </p>
        <Field name="id" label={L('Message reference', 'مرجع الرسالة')} />
        <label className="formrow">
          <span className="label">
            {L('Specific emergency or reported problem', 'الحالة الطارئة أو المشكلة المبلّغ عنها')}
          </span>
          <textarea className="textarea" name="reason" required minLength="20" maxLength="1000" />
        </label>
      </>,
      async q => {
        found = await api('workspace/emergency-message', 'POST', q);
      },
      async () => {
        const m = found;
        openDrawer({
          title: m.title,
          body: (
            <>
              <p>
                {m.id} · {m.created_at}
              </p>
              <div className="message-body">{m.body}</div>
            </>
          )
        });
      }
    );
  };
  const bishopReview = r =>
    form(
      L('Bishop acceptance', 'قبول المطران'),
      <>
        <p>
          {r.reference} · {r.person}
        </p>
        <p>
          {L('Signed by', 'موقّعة من')}: {r.signedBy}
        </p>
        {r.note ? (
          <p>
            {L('Priest’s resubmission note', 'ملاحظة الكاهن عند إعادة التقديم')}: {r.note}
          </p>
        ) : null}
        <Choice
          name="decision"
          label={L('Decision', 'القرار')}
          options={[
            ['accepted', L('Accept', 'قبول')],
            ['returned', L('Return to priest', 'إعادة للكاهن')]
          ]}
        />
        <label className="formrow">
          <span className="label">{L('Note (required when returning)', 'ملاحظة (إلزامية عند الإعادة)')}</span>
          <textarea className="textarea" name="note" maxLength="1000" />
        </label>
      </>,
      q => api('workspace/certificates', 'POST', { ...q, id: r.id, parish: r.parish, revision: r.revision }),
      refresh
    );
  const sharedPlan = () => {
    const choices = scope.parishes.filter(p => ['super_admin', 'bishop', 'diocesan_admin'].includes(p.authority));
    form(
      L('Shared diocesan arrangement', 'ترتيب مشترك في الأبرشية'),
      <>
        <Field name="arrangement" label={L('Arrangement name', 'اسم الترتيب')} />
        <Choice name="bundle" label={L('Bundle', 'الباقة')} options={BUNDLES.map(v => [v, v])} />
        <fieldset>
          <legend>{L('Choose parishes from one diocese', 'اختر رعايا من أبرشية واحدة')}</legend>
          {choices.map(p => (
            <label key={p.id} className="check">
              <input type="checkbox" name={`parish-${p.id}`} value={p.id} />
              {p.metadata.name}
            </label>
          ))}
        </fieldset>
      </>,
      q =>
        api('workspace/plans', 'POST', {
          arrangement: q.arrangement,
          bundle: q.bundle,
          parishes: Object.entries(q)
            .filter(([k]) => k.startsWith('parish-'))
            .map(([, v]) => v)
        }),
      refresh
    );
  };
  const newDiocese = () =>
    form(
      L('Create diocese', 'إنشاء أبرشية'),
      <Field name="name" label={L('Diocese name', 'اسم الأبرشية')} />,
      q => api('workspace/dioceses', 'POST', q),
      refresh
    );
  const newParish = () =>
    form(
      L('Create parish', 'إنشاء رعية'),
      <>
        <Choice name="diocese" label={L('Diocese', 'الأبرشية')} options={dioceses} />
        <Field name="name" label={L('Parish name', 'اسم الرعية')} />
        <Field name="nameAr" label={L('Arabic name', 'الاسم العربي')} />
        <Field name="town" label={L('Town', 'البلدة')} />
        <Field name="rite" label={L('Rite', 'الطقس')} />
        <p className="help">
          {L(
            'A secretary is optional. Leave this blank to appoint one later.',
            'تعيين أمين سر اختياري. اترك الحقل فارغاً لتعيينه لاحقاً.'
          )}
        </p>
        <label className="formrow">
          <span className="label">{L('Secretary username (optional)', 'اسم مستخدم أمين السر (اختياري)')}</span>
          <input className="input" name="secretaryUsername" maxLength="120" />
        </label>
      </>,
      async q => {
        let secretaryUserId = null;
        if (q.secretaryUsername.trim())
          secretaryUserId = (
            await api('workspace/account-lookup', 'POST', {
              scopeType: 'diocese',
              diocese: q.diocese,
              username: q.secretaryUsername.trim()
            })
          ).user.id;
        await api('workspace/parishes', 'POST', { ...q, secretaryUserId });
      },
      refresh
    );
  const newAccount = () => {
    const roles = [
      'member',
      'secretary',
      'treasurer',
      'leader',
      ...(auth !== 'parish_admin' ? ['parish_admin'] : []),
      ...(['super_admin', 'bishop'].includes(auth) ? ['diocesan_admin'] : []),
      ...(auth === 'super_admin' ? ['bishop'] : []),
      ...(auth === 'bishop' ? ['priest'] : [])
    ];
    form(
      L('Create account', 'إنشاء حساب'),
      <>
        <Field name="name" label={L('Full name', 'الاسم الكامل')} />
        <Field name="username" label={L('Username', 'اسم المستخدم')} />
        <Field
          name="password"
          label={L('Temporary password · 12+ characters', 'كلمة مرور مؤقتة · ١٢ حرفاً على الأقل')}
          type="password"
        />
        <Choice name="diocese" label={L('Diocese', 'الأبرشية')} options={dioceses} />
        <Choice name="role" label={L('Role', 'الدور')} options={roles.map(r => [r, roleLabel(r)])} />
        <Choice
          name="personId"
          label={L('Link person (required for clergy and leaders)', 'ربط شخص (إلزامي للكهنة والمسؤولين)')}
          options={[['', L('No person link yet', 'دون ربط حالياً')], ...people.people.map(p => [p.id, p.name])]}
        />
      </>,
      q => api('workspace/users', 'POST', { ...q, parish: parishId || null }),
      refresh
    );
  };
  const title = u =>
    form(
      L('Change clergy title', 'تغيير اللقب الكهنوتي'),
      <Choice
        name="title"
        label={L('Title', 'اللقب')}
        options={['Deacon', 'Priest', 'Monsignor', 'Archimandrite'].map(v => [v, v])}
      />,
      q => api('workspace/clergy-title', 'POST', { ...q, userId: u.id }),
      refresh
    );
  const suspend = u =>
    form(
      u.inactive ? L('Reactivate access', 'إعادة تفعيل الوصول') : L('Deactivate access', 'تعطيل الوصول'),
      <>
        <p>{L('Records and activity are preserved.', 'تبقى السجلات والأنشطة محفوظة.')}</p>
        <Field name="reason" label={L('Reason', 'السبب')} />
        <Choice
          name="scope"
          label={L('Scope', 'النطاق')}
          options={[
            ['parish', L('This parish only', 'هذه الرعية فقط')],
            ...(auth === 'super_admin' ? [['global', L('All parishes', 'كل الرعايا')]] : [])
          ]}
        />
        {auth === 'super_admin' ? (
          <Field
            name="currentPassword"
            label={L(
              'Current password (required for system-wide changes)',
              'كلمة المرور الحالية (إلزامية للتغييرات العامة)'
            )}
            type="password"
          />
        ) : null}
      </>,
      q => api('workspace/suspension', 'POST', { ...q, parish: parishId, userId: u.id, active: !u.inactive }),
      refresh
    );
  const membership = m =>
    form(
      L('Review membership', 'مراجعة العضوية'),
      <>
        <p>
          {L(
            'Confirm the identity before linking an existing person record.',
            'تأكّد من الهوية قبل ربط سجل شخص موجود.'
          )}
        </p>
        <Choice
          name="status"
          label={L('Decision', 'القرار')}
          options={[
            ['approved', L('Approve', 'موافقة')],
            ['declined', L('Decline', 'رفض')]
          ]}
        />
        <Choice
          name="personId"
          label={L('Existing person', 'الشخص الموجود')}
          options={[['', L('Choose a person', 'اختر شخصاً')], ...people.people.map(p => [p.id, p.name])]}
        />
      </>,
      q => api('workspace/membership', 'POST', { ...q, parish: parishId, userId: m.user_id }),
      refresh
    );
  const guestReview = r =>
    form(
      L('Review guest request', 'مراجعة طلب زائر'),
      <>
        <p>{r.details.description}</p>
        <Choice
          name="status"
          label={L('Status', 'الحالة')}
          options={['submitted', 'office-review', 'missing-documents', 'ready-for-collection', 'closed'].map(v => [
            v,
            v,
            r.status === v
          ])}
        />
        <label className="formrow">
          <span className="label">
            {L('Response visible on the private tracking link', 'الرد الظاهر في رابط المتابعة الخاص')}
          </span>
          <textarea className="textarea" name="response" maxLength="2000" defaultValue={r.response} />
        </label>
      </>,
      q => api('workspace/guest-requests', 'POST', { ...q, id: r.id }),
      refresh
    );
  const managePlan = () =>
    form(
      L('Parish bundle', 'باقة الرعية'),
      <>
        <Choice name="bundle" label={L('Bundle', 'الباقة')} options={BUNDLES.map(v => [v, v, v === plan.bundle])} />
        {diocesan ? (
          <Choice
            name="sponsor"
            label={L('Arrangement', 'الترتيب')}
            options={[
              ['parish', L('Parish managed', 'إدارة الرعية'), plan.sponsor === 'parish'],
              ['diocese', L('Diocese sponsored', 'برعاية الأبرشية'), plan.sponsor === 'diocese']
            ]}
          />
        ) : null}
        <Choice
          name="publicRequests"
          label={L('Guest requests on the public profile', 'طلبات الزوّار في الموقع العام')}
          options={[
            ['true', L('Available', 'متاحة'), plan.publicRequests !== false],
            ['false', L('Contact office instead', 'التواصل مع المكتب'), plan.publicRequests === false]
          ]}
        />
      </>,
      q => api('workspace/plan', 'POST', { ...q, parish: parishId, publicRequests: q.publicRequests === 'true' }),
      refresh
    );
  const q = query.toLowerCase().trim();
  return (
    <>
      {head}
      <div data-workspace="" aria-live="polite">
        <div className="collection-toolbar">
          {scope.canCreateDiocese ? (
            <button className="btn btn-secondary" data-new-diocese="" onClick={newDiocese}>
              {L('New diocese', 'أبرشية جديدة')}
            </button>
          ) : null}
          {diocesan ? (
            <button className="btn btn-secondary" data-shared-plan="" onClick={sharedPlan}>
              {L('Shared parish bundle', 'باقة مشتركة للرعايا')}
            </button>
          ) : null}
          {diocesan ? (
            <button className="btn btn-secondary" data-new-parish="" onClick={newParish}>
              {L('New parish', 'رعية جديدة')}
            </button>
          ) : null}
          {scope.isSuperAdmin ? (
            <button className="btn btn-secondary" data-homepage="" onClick={() => editHomepage()}>
              {L('Homepage', 'الصفحة الرئيسية')}
            </button>
          ) : null}
          {auth === 'super_admin' ? (
            <button className="btn btn-secondary" data-emergency="" onClick={emergency}>
              {L('Emergency message review', 'مراجعة رسالة في حالة طارئة')}
            </button>
          ) : null}
          <button className="btn btn-primary" data-new-account="" onClick={newAccount}>
            {L('Create account', 'إنشاء حساب')}
          </button>
          {parishId ? (
            <button
              className="btn btn-secondary"
              data-public-profile=""
              onClick={() => editPublicProfile(parishId, refresh)}
            >
              {L('Edit public parish profile', 'تعديل صفحة الرعية العامة')}
            </button>
          ) : null}
          {scope.parishes.length ? (
            <label>
              {L('Parish', 'الرعية')}{' '}
              <Select
                data-workspace-parish=""
                value={parishId}
                onChange={e => {
                  parishId = e.target.value;
                  setParish(parishId);
                }}
              >
                {scope.parishes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.metadata.name}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </div>
        {auth === 'bishop' ? (
          <Panel title={L('Signed certificates for acceptance', 'شهادات موقّعة للقبول')}>
            <Paged className="account-parishes" data-paginate="">
              {certificates.length ? (
                certificates.map(r => (
                  <article key={r.parish + r.id}>
                    <div>
                      <h3>
                        {r.person} · {r.reference}
                      </h3>
                      <p>
                        {r.parishName} · {r.signedBy}
                      </p>
                      <span className="pill">{r.status}</span>
                    </div>
                    {r.status === 'pending' ? (
                      <button
                        className="btn btn-primary"
                        data-bishop-review={r.id}
                        data-parish={r.parish}
                        onClick={() => bishopReview(r)}
                      >
                        {L('Review', 'مراجعة')}
                      </button>
                    ) : null}
                  </article>
                ))
              ) : (
                <p>{L('No signed certificates awaiting acceptance.', 'لا شهادات موقّعة بانتظار القبول.')}</p>
              )}
            </Paged>
          </Panel>
        ) : null}
        <section data-access-management="">
          <AccessManagement
            workspace={scope}
            parishId={parishId}
            refreshSession={refresh}
            parishPeople={people.people}
          />
        </section>
        {!parishId ? (
          <p>
            {L(
              'Create a diocese and parish to begin, or assign this account a scope.',
              'أنشئ أبرشية ورعية للبدء أو عيّن نطاقاً لهذا الحساب.'
            )}
          </p>
        ) : (
          <>
            <Panel title={L('Accounts and access', 'الحسابات والصلاحيات')}>
              <input
                className="input"
                type="search"
                data-user-search=""
                placeholder={L('Search accounts', 'ابحث عن حساب')}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <Paged className="account-parishes" data-paginate="">
                {people.users.length ? (
                  people.users.map(u => {
                    const text = (u.name + ' ' + u.username).toLowerCase();
                    return (
                      <article key={u.id} data-search={text} hidden={!text.includes(q)}>
                        <div>
                          <h3>{u.name}</h3>
                          <p>
                            {u.username} · {roleLabel(u.effectiveRole || u.role)}
                            {u.clergyTitle ? ' · ' + u.clergyTitle : ''}
                          </p>
                          <small>
                            {u.inactive ? L('Inactive in this context', 'غير نشط في هذا النطاق') : L('Active', 'نشط')}
                          </small>
                        </div>
                        <div className="account-actions">
                          {auth === 'bishop' ? (
                            <button className="btn btn-secondary" data-title={u.id} onClick={() => title(u)}>
                              {L('Clergy title', 'اللقب الكهنوتي')}
                            </button>
                          ) : null}
                          {u.canSuspend ? (
                            <button className="btn btn-secondary" data-suspend={u.id} onClick={() => suspend(u)}>
                              {u.inactive ? L('Reactivate', 'إعادة تفعيل') : L('Deactivate', 'تعطيل')}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p>{L('No accounts in this parish yet.', 'لا حسابات في هذه الرعية بعد.')}</p>
                )}
              </Paged>
            </Panel>
            <Panel title={L('Membership review', 'مراجعة العضوية')}>
              <Paged className="account-parishes" data-paginate="">
                {people.memberships.length ? (
                  people.memberships.map(m => (
                    <article key={m.user_id}>
                      <div>
                        <b>{m.name}</b>
                        <p>{m.username}</p>
                      </div>
                      <button className="btn btn-primary" data-membership={m.user_id} onClick={() => membership(m)}>
                        {L('Review and link person', 'مراجعة وربط الشخص')}
                      </button>
                    </article>
                  ))
                ) : (
                  <p>{L('No pending membership requests.', 'لا طلبات عضوية معلّقة.')}</p>
                )}
              </Paged>
            </Panel>
            <Panel title={L('Guest requests', 'طلبات الزوّار')}>
              <p className="help">
                {L(
                  'Office review begins here. Sacraments retain their existing priest approval and preparation process.',
                  'تبدأ مراجعة المكتب هنا. تحتفظ الأسرار بمسار موافقة الكاهن والتحضير.'
                )}
              </p>
              <Paged className="account-parishes" data-paginate="">
                {guest.requests.length ? (
                  guest.requests.map(r => (
                    <article key={r.id}>
                      <div>
                        <h3>
                          {r.details.name} · {r.details.kind}
                        </h3>
                        <p>{r.details.description}</p>
                        <small>
                          {r.status} · {r.details.email || r.details.phone}
                        </small>
                      </div>
                      <button className="btn btn-secondary" data-guest={r.id} onClick={() => guestReview(r)}>
                        {L('Review', 'مراجعة')}
                      </button>
                    </article>
                  ))
                ) : (
                  <p>{L('No guest requests yet.', 'لا طلبات زوّار بعد.')}</p>
                )}
              </Paged>
            </Panel>
            <Panel title={L('Parish bundle', 'باقة الرعية')}>
              <p>
                {L('Current bundle', 'الباقة الحالية')}: <b>{plan.bundle}</b> · {L('Arrangement', 'الترتيب')}:{' '}
                {plan.sponsor}
                {plan.arrangement ? ' · ' + plan.arrangement : ''}
              </p>
              {plan.requestedBundle ? (
                <p>
                  {L('Change requested', 'طلب تغيير')}: {plan.requestedBundle}
                </p>
              ) : null}
              <p className="help">
                {L(
                  'Manual subscription management. No payment is charged here. Records remain preserved when a bundle changes.',
                  'إدارة اشتراك يدوية. لا تُحصّل دفعات هنا. تبقى السجلات محفوظة عند تغيير الباقة.'
                )}
              </p>
              <button className="btn btn-primary" data-plan="" onClick={managePlan}>
                {plan.sponsor === 'diocese' && !diocesan
                  ? L('Request a bundle change', 'طلب تغيير الباقة')
                  : L('Manage bundle', 'إدارة الباقة')}
              </button>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
