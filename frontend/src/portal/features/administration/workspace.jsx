/* Administration workspace for platform operators, bishops and archdiocese administrators, on
   ParishLife.Api. Tabs: Organizations (archdioceses and parishes: register, verify, operating status,
   location, association, jurisdiction, handing control to the priest, homepage), Appointments (workspace-appointments.jsx),
   Access and billing (workspace-billing.jsx), and for platform operators Platform (workspace-platform.jsx:
   every parish, archdiocese and account, account status, clergy titles).
   Organizations shows what the account reaches through its capacities (GET /api/me/capacities), plus any
   parish or archdiocese opened by its reference or from the Platform lists (kept for this browser
   session). Main member: WorkspacePage. */
import { useState } from 'react';
import { PageHead, TabBar, Pill, Empty, openDrawer, toast } from '../../ui/ui.jsx';
import { S } from '../../model/store.js';
import * as A from '../../model/modules/administration-api.js';
import { editHomepage } from '../communicate/homepage-editor.jsx';
import { useLoad } from './use-load.js';
import { L, Row, Section, ReferenceBox, openForm, shortDay } from './workspace-forms.jsx';
import { Appointments } from './workspace-appointments.jsx';
import { AccessAndBilling } from './workspace-billing.jsx';
import { Platform } from './workspace-platform.jsx';

/* References opened by hand, kept for this browser session only. */
const opened = (() => {
  try {
    const stored = JSON.parse(sessionStorage.getItem('pl-admin-opened') || '{}');
    return { parishes: new Set(stored.parishes || []), archdioceses: new Set(stored.archdioceses || []) };
  } catch {
    return { parishes: new Set(), archdioceses: new Set() };
  }
})();
const remember = () => {
  try {
    sessionStorage.setItem(
      'pl-admin-opened',
      JSON.stringify({ parishes: [...opened.parishes], archdioceses: [...opened.archdioceses] })
    );
  } catch {
    /* private mode */
  }
};

const STATUS = {
  PendingVerification: [L('Pending verification', 'بانتظار التوثيق'), 'warning'],
  Verified: [L('Verified', 'موثّقة'), 'success'],
  Suspended: [L('Suspended', 'معلّقة'), 'danger'],
  Closed: [L('Closed', 'مقفلة'), '']
};
const StatusPill = ({ status }) => (
  <Pill label={(STATUS[status] || [status])[0]} tone={(STATUS[status] || [])[1] || ''} />
);

/* The organizations in reach: from capacities, then any opened by reference. Each is read with its version. */
async function loadOrganizations() {
  const scopes = await A.myScopes();
  const archIds = new Set([...scopes.archdioceses.map(a => a.id), ...opened.archdioceses]),
    parishIds = new Set([...scopes.parishes.map(p => p.id), ...opened.parishes]);
  const read = (ids, get) =>
    Promise.all(
      [...ids].map(id =>
        get(id).then(
          r => ({ ...r.value, version: r.version }),
          () => null
        )
      )
    ).then(list => list.filter(Boolean));
  const [archdioceses, parishes] = await Promise.all([read(archIds, A.getArchdiocese), read(parishIds, A.getParish)]);
  return { scopes, archdioceses, parishes };
}

function historyDrawer(parish) {
  A.parishStatusHistory(parish.id).then(
    list =>
      openDrawer({
        title: L('Operating status history', 'سجل الحالة التشغيلية'),
        sub: parish.name,
        body: list.length ? (
          <ol className="ins-notes">
            {list.map(c => (
              <li key={c.id}>
                <span className="ins-note-kind">
                  {c.from} → {c.to}
                </span>
                <p>{c.reason}</p>
                <small>{new Date(c.at).toLocaleString()}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p>{L('No status changes yet.', 'لا تغييرات في الحالة بعد.')}</p>
        )
      }),
    e => toast(L('Could not load the history', 'تعذّر تحميل السجل'), e.message, 'danger')
  );
}

function Organizations({ data, reload }) {
  const { scopes, archdioceses, parishes } = data;
  const bishopOf = new Set(scopes.archdioceses.filter(a => a.kinds.includes('Bishop')).map(a => a.id));
  const archOptions = scopes.archdioceses.map(a => [a.id, a.name || a.id]);

  const registerArchdiocese = () =>
    openForm({
      title: L('Register an archdiocese', 'تسجيل أبرشية'),
      intro: L('A platform operator verifies it afterwards.', 'يوثّقها مشغّل المنصة بعد ذلك.'),
      fields: [
        { name: 'name', label: L('Name', 'الاسم') },
        { name: 'locality', label: L('Locality', 'البلدة') }
      ],
      save: A.registerArchdiocese,
      done: reload
    });
  const registerParish = () =>
    openForm({
      title: L('Register a parish', 'تسجيل رعية'),
      intro: L(
        'Only ParishLife administrators, the bishop or his archdiocese administrators register a church. A church registered under its archdiocese is verified at once; then appoint its priest and hand him control.',
        'لا يسجّل الكنيسة إلا مشرفو ParishLife أو المطران أو مشرفو أبرشيته. الكنيسة المسجّلة تحت أبرشيتها موثّقة فوراً؛ ثم عيّن كاهنها وسلّمه الإدارة.'
      ),
      fields: [
        {
          name: 'archdioceseId',
          label: L('Archdiocese', 'الأبرشية'),
          type: 'select',
          required: false,
          value: archdioceses[0]?.id || '',
          options: [
            ...archdioceses.map(a => [a.id, a.name || a.id]),
            ['', L('None (ParishLife administrators only)', 'بلا أبرشية (لمشرفي ParishLife فقط)')]
          ]
        },
        { name: 'name', label: L('Name', 'الاسم') },
        { name: 'locality', label: L('Locality', 'البلدة') },
        { name: 'contact', label: L('Contact (email or phone)', 'جهة الاتصال (بريد أو هاتف)') },
        {
          name: 'declaredArchdiocese',
          label: L('Archdiocese, as declared (optional)', 'الأبرشية كما أُعلنت (اختياري)'),
          required: false
        }
      ],
      save: A.registerParish,
      done: reload
    });
  const verify = async (org, kind) => {
    try {
      const inspected = await (kind === 'parish'
        ? A.inspectParishVerification(org.id)
        : A.inspectArchdioceseVerification(org.id));
      openForm({
        title: L('Verify', 'توثيق') + ' · ' + org.name,
        intro: L(
          'Record the evidence you checked. Verification is recorded with your name.',
          'سجّل الإثبات الذي راجعته. يُسجَّل التوثيق باسمك.'
        ),
        fields: [{ name: 'evidenceReference', label: L('Evidence reference', 'مرجع الإثبات') }],
        save: v =>
          (kind === 'parish' ? A.verifyParish : A.verifyArchdiocese)(org.id, inspected.version, v.evidenceReference),
        done: reload
      });
    } catch (e) {
      toast(L('Could not open verification', 'تعذّر فتح التوثيق'), e.message, 'danger');
    }
  };
  const changeStatus = p =>
    openForm({
      title: L('Operating status', 'الحالة التشغيلية') + ' · ' + p.name,
      fields: [
        {
          name: 'action',
          label: L('Change', 'التغيير'),
          type: 'select',
          options: [
            ['suspend', L('Suspend', 'تعليق')],
            ['reinstate', L('Reinstate', 'إعادة تفعيل')],
            ['close', L('Close', 'إقفال')]
          ]
        },
        { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' }
      ],
      save: async v => A.changeParishStatus(p.id, (await A.getParish(p.id)).version, v.action, v.reason),
      done: reload
    });
  const location = async p => {
    const current = await A.getParishLocation(p.id).catch(e => (e.status === 404 ? null : Promise.reject(e)));
    const loc = current?.value;
    openForm({
      title: L('Location', 'الموقع') + ' · ' + p.name,
      fields: [
        {
          name: 'latitude',
          label: L('Latitude', 'خط العرض'),
          type: 'number',
          value: loc?.latitude ?? '',
          required: false
        },
        {
          name: 'longitude',
          label: L('Longitude', 'خط الطول'),
          type: 'number',
          value: loc?.longitude ?? '',
          required: false
        },
        {
          name: 'sourceReference',
          label: L('Source of the coordinates', 'مصدر الإحداثيات'),
          value: loc?.sourceReference || '',
          required: false
        }
      ],
      save: v =>
        A.setParishLocation(p.id, {
          version: current?.version || null,
          latitude: v.latitude === '' ? null : Number(v.latitude),
          longitude: v.longitude === '' ? null : Number(v.longitude),
          sourceReference: v.sourceReference || null
        }),
      done: reload
    });
  };
  const handControl = p =>
    openForm({
      title: L('Hand control to the priest', 'تسليم الإدارة للكاهن') + ' · ' + p.name,
      intro: L(
        'The priest must already be appointed to this parish. Your own access to the parish ends.',
        'يجب أن يكون الكاهن معيّناً في هذه الرعية. ينتهي وصولك أنت إلى الرعية.'
      ),
      fields: [{ name: 'account', label: L("Priest's username or email", 'اسم مستخدم الكاهن أو بريده') }],
      save: async v => A.handOverControl(p.id, (await A.getParish(p.id)).version, v.account.trim()),
      done: reload
    });
  const associate = p =>
    openForm({
      title: L('Associate with an archdiocese', 'ربط بأبرشية') + ' · ' + p.name,
      intro: L('The archdiocese then accepts or declines.', 'تقبل الأبرشية بعد ذلك أو ترفض.'),
      fields: [
        { name: 'archdioceseId', label: L('Archdiocese reference', 'مرجع الأبرشية'), value: archOptions[0]?.[0] || '' }
      ],
      save: async v => A.proposeAssociation(p.id, (await A.getParish(p.id)).version, v.archdioceseId.trim()),
      done: reload
    });
  const jurisdiction = p =>
    openForm({
      title: L('Propose jurisdiction', 'اقتراح الولاية') + ' · ' + p.name,
      fields: [
        { name: 'archdioceseId', label: L('Archdiocese reference', 'مرجع الأبرشية'), value: archOptions[0]?.[0] || '' },
        { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' },
        { name: 'evidenceReference', label: L('Evidence reference', 'مرجع الإثبات') }
      ],
      save: async v => {
        const r = await A.proposeJurisdiction(p.id, {
          version: (await A.getParish(p.id)).version,
          archdioceseId: v.archdioceseId.trim(),
          reason: v.reason,
          evidenceReference: v.evidenceReference
        });
        toast(L('Proposal recorded', 'سُجّل الاقتراح'), `${L('Reference', 'المرجع')}: ${r.id}`, 'success');
      },
      done: reload
    });
  const decideJurisdiction = p => {
    openForm({
      title: L('Decide a jurisdiction proposal', 'البتّ في اقتراح ولاية') + ' · ' + p.name,
      intro: L(
        'Open the proposal by its reference. Deciding needs your password and authenticator code.',
        'افتح الاقتراح بمرجعه. يتطلّب البتّ كلمة مرورك ورمز المصادقة.'
      ),
      fields: [
        { name: 'proposalId', label: L('Proposal reference', 'مرجع الاقتراح') },
        {
          name: 'accept',
          label: L('Decision', 'القرار'),
          type: 'select',
          options: [
            ['true', L('Accept', 'قبول')],
            ['false', L('Decline', 'رفض')]
          ]
        },
        { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' },
        { name: 'currentPassword', label: L('Your password', 'كلمة مرورك'), type: 'password' },
        { name: 'currentCode', label: L('Authenticator code', 'رمز المصادقة') }
      ],
      save: async v => {
        const fresh = await A.getJurisdiction(p.id, v.proposalId.trim());
        return A.decideJurisdiction(p.id, v.proposalId.trim(), {
          version: fresh.version,
          accept: v.accept === 'true',
          reason: v.reason,
          currentPassword: v.currentPassword,
          currentCode: v.currentCode
        });
      },
      done: reload
    });
  };
  const open = (kind, id) => {
    (kind === 'parish' ? opened.parishes : opened.archdioceses).add(id);
    remember();
    return reload();
  };
  const operator = scopes.operator;
  return (
    <>
      <div className="collection-toolbar">
        <button className="btn btn-secondary" data-new-archdiocese="" onClick={registerArchdiocese}>
          {L('Register an archdiocese', 'تسجيل أبرشية')}
        </button>
        <button className="btn btn-primary" data-new-parish="" onClick={registerParish}>
          {L('Register a parish', 'تسجيل رعية')}
        </button>
        {operator ? (
          <button className="btn btn-secondary" data-homepage="" onClick={() => editHomepage()}>
            {L('Homepage', 'الصفحة الرئيسية')}
          </button>
        ) : null}
      </div>
      <Section title={L('Archdioceses', 'الأبرشيات')}>
        {archdioceses.length ? (
          archdioceses.map(a => (
            <Row
              key={a.id}
              data-archdiocese={a.id}
              title={a.name}
              lines={[
                a.locality,
                a.verified ? L('Verified', 'موثّقة') : L('Not verified yet', 'غير موثّقة بعد'),
                `${L('Reference', 'المرجع')}: ${a.id}`
              ]}
              actions={
                operator && !a.verified ? (
                  <button
                    className="btn btn-primary btn-dense"
                    data-verify={a.id}
                    onClick={() => verify(a, 'archdiocese')}
                  >
                    {L('Verify', 'توثيق')}
                  </button>
                ) : null
              }
            />
          ))
        ) : (
          <p>{L('No archdiocese in reach.', 'لا أبرشية في النطاق.')}</p>
        )}
        <ReferenceBox
          label={L('Open an archdiocese by reference', 'فتح أبرشية بمرجعها')}
          onOpen={id => open('archdiocese', id)}
        />
      </Section>
      <Section title={L('Parishes', 'الرعايا')}>
        {parishes.length ? (
          parishes.map(p => {
            const bishop = bishopOf.has(p.jurisdictionArchdioceseId);
            return (
              <Row
                key={p.id}
                data-parish={p.id}
                title={
                  <>
                    {p.name} <StatusPill status={p.status} />
                    {p.ownershipContested ? (
                      <Pill
                        label={L('Under ownership review · read-only', 'قيد مراجعة الملكية · للقراءة فقط')}
                        tone="warning"
                      />
                    ) : null}
                  </>
                }
                lines={[
                  `${p.locality} · ${p.contact}`,
                  p.declaredArchdiocese && `${L('Declared archdiocese', 'الأبرشية المعلنة')}: ${p.declaredArchdiocese}`,
                  `${L('Reference', 'المرجع')}: ${p.id}`
                ]}
                actions={
                  <>
                    {operator && p.status === 'PendingVerification' ? (
                      <button
                        className="btn btn-primary btn-dense"
                        data-verify={p.id}
                        onClick={() => verify(p, 'parish')}
                      >
                        {L('Verify', 'توثيق')}
                      </button>
                    ) : null}
                    {bishop ? (
                      <button
                        className="btn btn-secondary btn-dense"
                        data-status={p.id}
                        onClick={() => changeStatus(p)}
                      >
                        {L('Operating status', 'الحالة التشغيلية')}
                      </button>
                    ) : null}
                    <button className="btn btn-secondary btn-dense" onClick={() => location(p)}>
                      {L('Location', 'الموقع')}
                    </button>
                    <button className="btn btn-secondary btn-dense" onClick={() => associate(p)}>
                      {L('Associate', 'ربط')}
                    </button>
                    <button className="btn btn-secondary btn-dense" onClick={() => jurisdiction(p)}>
                      {L('Propose jurisdiction', 'اقتراح الولاية')}
                    </button>
                    <button className="btn btn-secondary btn-dense" onClick={() => decideJurisdiction(p)}>
                      {L('Decide proposal', 'البتّ في اقتراح')}
                    </button>
                    <button className="btn btn-secondary btn-dense" onClick={() => handControl(p)}>
                      {L('Hand control to the priest', 'تسليم الإدارة للكاهن')}
                    </button>
                    <button className="btn btn-secondary btn-dense" onClick={() => historyDrawer(p)}>
                      {L('Status history', 'سجل الحالة')}
                    </button>
                  </>
                }
              />
            );
          })
        ) : (
          <p>
            {L(
              'No parish in reach. Register one, or open a parish by its reference.',
              'لا رعية في النطاق. سجّل رعية أو افتح رعية بمرجعها.'
            )}
          </p>
        )}
        <ReferenceBox label={L('Open a parish by reference', 'فتح رعية بمرجعها')} onOpen={id => open('parish', id)} />
      </Section>
      {operator ? <Identity /> : null}
    </>
  );
}

/* Identity: an MFA recovery request is reviewed by an operator, by account and request reference. */
function Identity() {
  const review = (accountId, requestId, request) =>
    openForm({
      title: L('Review a recovery request', 'مراجعة طلب استرداد'),
      intro: `${request.value?.status || ''} · ${request.value?.reason || ''}`,
      fields: [
        {
          name: 'approve',
          label: L('Decision', 'القرار'),
          type: 'select',
          options: [
            ['true', L('Approve', 'موافقة')],
            ['false', L('Decline', 'رفض')]
          ]
        },
        { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' },
        { name: 'verificationReference', label: L('Identity check reference', 'مرجع التحقق من الهوية') },
        { name: 'currentPassword', label: L('Your password', 'كلمة مرورك'), type: 'password' },
        { name: 'currentCode', label: L('Authenticator code', 'رمز المصادقة') }
      ],
      save: v =>
        A.reviewMfaRecovery(accountId, requestId, {
          version: request.version,
          approve: v.approve === 'true',
          reason: v.reason,
          verificationReference: v.verificationReference,
          currentPassword: v.currentPassword,
          currentCode: v.currentCode
        })
    });
  const [account, setAccount] = useState('');
  return (
    <Section title={L('Accounts and identity review', 'الحسابات ومراجعة الهوية')}>
      <p className="help">
        {L(
          'Accounts and their status are in the Platform tab. Open a sign-in recovery request by the account and request references.',
          'الحسابات وحالتها في تبويب المنصة. افتح طلب استرداد الدخول بمرجع الحساب ومرجع الطلب.'
        )}
      </p>
      <ReferenceBox
        label={L('Request reference', 'مرجع الطلب')}
        extra={
          <input
            className="input"
            value={account}
            onChange={e => setAccount(e.target.value)}
            placeholder={L('Account reference', 'مرجع الحساب')}
            aria-label={L('Account reference', 'مرجع الحساب')}
            required
          />
        }
        onOpen={async id => review(account.trim(), id, await A.getMfaRecoveryRequest(account.trim(), id))}
      />
    </Section>
  );
}

const TABS = operator => [
  ['', 'Organizations', 'المؤسسات'],
  ['appointments', 'Appointments', 'التعيينات'],
  ['access', 'Access and billing', 'الصلاحيات والاشتراك'],
  ...(operator ? [['platform', 'Platform', 'المنصة']] : [])
];

/* Open a parish or archdiocese from the Platform lists: it then shows, with its actions, under Organizations. */
const openFromPlatform = reload => async (kind, id) => {
  (kind === 'parish' ? opened.parishes : opened.archdioceses).add(id);
  remember();
  await reload();
  toast(L('Opened', 'فُتح'), L('It now shows under Organizations.', 'يظهر الآن في المؤسسات.'), 'success');
};

export function WorkspacePage({ params: [tab = ''] = [] }) {
  if (S.route === 'assignments') tab = 'appointments';
  tab = ['appointments', 'access', 'platform'].includes(tab) ? tab : '';
  const orgs = useLoad(loadOrganizations, []);
  return (
    <>
      <PageHead
        title={L('Administration', 'الإدارة')}
        sub={L(
          'Parishes, archdioceses, appointments, access and billing, within the authority you hold.',
          'الرعايا والأبرشيات والتعيينات والصلاحيات والاشتراك ضمن الصلاحيات التي تملكها.'
        )}
      />
      <TabBar base="workspace" items={TABS(orgs.data?.scopes.operator)} active={tab} />
      <div data-workspace="" aria-live="polite">
        {orgs.error ? <p className="alert alert-danger">{orgs.error}</p> : null}
        {!orgs.data && !orgs.error ? <p role="status">{L('Loading administration…', 'جارٍ تحميل الإدارة…')}</p> : null}
        {orgs.data ? (
          tab === 'appointments' ? (
            <Appointments data={orgs.data} reload={orgs.reload} />
          ) : tab === 'access' ? (
            <AccessAndBilling data={orgs.data} reload={orgs.reload} />
          ) : tab === 'platform' ? (
            <Platform data={orgs.data} open={openFromPlatform(orgs.reload)} />
          ) : (
            <Organizations data={orgs.data} reload={orgs.reload} />
          )
        ) : null}
        {orgs.data && !orgs.data.parishes.length && !orgs.data.archdioceses.length && tab === '' ? (
          <Empty
            glyph="shield"
            title={L('Nothing in reach yet', 'لا شيء في النطاق بعد')}
            body={L('Register a parish or open one by its reference.', 'سجّل رعية أو افتح واحدة بمرجعها.')}
          />
        ) : null}
      </div>
    </>
  );
}
