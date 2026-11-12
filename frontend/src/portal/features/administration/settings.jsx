/* Parish settings, from what ParishLife.Api holds: the parish profile (name, locality, contact, the
   archdiocese it declared, operating status, recorded location) from GET /api/parishes/{id} and
   .../location, and which product modules the parish has through its billing coverage
   (GET /api/parishes/{id}/billing/coverage). The API has no route to edit the profile or to switch a
   module on or off: modules follow the plan the parish pays for (Administration > Access and billing).
   Colours, currency, languages, roles, security, retention and webhooks have no parish API yet.
   Main member: settings. */
import { PageHead, Panel, Pill, TabBar, Empty } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { PARISH } from '../../model/data.js';
import { session } from '../../model/api.js';
import * as A from '../../model/modules/administration-api.js';
import { useLoad } from './use-load.js';
import { L, shortDay } from './workspace-forms.jsx';

const MODULES = [
  ['core', 'Core', 'الأساس'],
  ['office', 'Office', 'المكتب'],
  ['requests', 'Requests', 'الطلبات'],
  ['sacraments', 'Sacraments', 'الأسرار'],
  ['ministries', 'Ministries', 'الخدمات'],
  ['facilities', 'Facilities', 'المرافق'],
  ['finance', 'Finance', 'المالية']
];
const STATUS = {
  Verified: L('Verified', 'موثّقة'),
  PendingVerification: L('Pending verification', 'بانتظار التوثيق'),
  Suspended: L('Suspended', 'معلّقة'),
  Closed: L('Closed', 'مقفلة')
};

const Profile = () => {
  const { data } = useLoad(
    () =>
      A.getParishLocation(session.parishId).then(
        r => r.value,
        () => null
      ),
    [session.parishId]
  );
  return (
    <Panel title={L('Parish', 'الرعية')}>
      <dl className="dl">
        <dt>{L('Name', 'الاسم')}</dt>
        <dd>{PARISH.name}</dd>
        <dt>{L('Locality', 'البلدة')}</dt>
        <dd>{PARISH.town || '—'}</dd>
        <dt>{L('Contact', 'الاتصال')}</dt>
        <dd>{PARISH.contact || '—'}</dd>
        <dt>{L('Archdiocese, as declared', 'الأبرشية كما أُعلنت')}</dt>
        <dd>{PARISH.eparchy || '—'}</dd>
        <dt>{L('Operating status', 'الحالة التشغيلية')}</dt>
        <dd>{PARISH.status ? <Pill label={STATUS[PARISH.status] || PARISH.status} /> : '—'}</dd>
        <dt>{L('Location', 'الموقع')}</dt>
        <dd>{data?.latitude != null ? `${data.latitude}, ${data.longitude}` : L('Not recorded', 'غير مسجّل')}</dd>
      </dl>
      <p className="help">
        {L(
          'The profile is read-only here: ParishLife.Api has no route to edit it yet. The public page’s wording is edited under Member portal.',
          'الملف للقراءة فقط هنا: ليست في الواجهة طريقة لتعديله بعد. يُعدَّل نص الصفحة العامة من بوابة المؤمنين.'
        )}
      </p>
    </Panel>
  );
};

const Modules = () => {
  const { data, error } = useLoad(() => A.orEmpty(A.parishCoverage(session.parishId)), [session.parishId]);
  if (error) return <p className="alert alert-danger">{error}</p>;
  const now = Date.now();
  const active = new Set(
    (data || []).filter(c => new Date(c.startsAt) <= now && new Date(c.endsAt) > now).flatMap(c => c.modules)
  );
  return (
    <Panel title={L('Modules', 'الوحدات')}>
      {MODULES.map(([key, en, ar]) => (
        <div key={key} className="listrow" style={{ paddingInline: 0 }}>
          <span className="grow">{L(en, ar)}</span>
          <Pill
            label={active.has(key) ? L('On', 'مفعّلة') : L('Off', 'متوقفة')}
            tone={active.has(key) ? 'success' : ''}
          />
        </div>
      ))}
      {(data || []).map(c => (
        <p key={c.id} className="help">
          {c.modules.join(', ')}: {shortDay(c.startsAt)} → {shortDay(c.endsAt)}
        </p>
      ))}
      <p className="help">
        {L(
          'Modules follow the plan this parish pays for. Change them under Administration > Access and billing.',
          'تتبع الوحدات الباقة التي تدفعها الرعية. غيّرها من الإدارة > الصلاحيات والاشتراك.'
        )}{' '}
        <a href="#/workspace/access" className="text-link">
          {L('Open', 'فتح')}
        </a>
      </p>
    </Panel>
  );
};

const NotConnected = () => (
  <Panel title={L('Not connected yet', 'غير موصول بعد')}>
    <Empty
      glyph="settings"
      title={L('These settings have no home in the new backend yet', 'ليس لهذه الإعدادات مكان في الخادم الجديد بعد')}
      body={L(
        'Parish colours, currency and exchange rate, languages, role permissions and exceptions, sessions and security alerts, data retention, and API keys and webhooks. Nothing is shown or saved for them.',
        'ألوان الرعية، والعملة وسعر الصرف، واللغات، وصلاحيات الأدوار واستثناءاتها، والجلسات وتنبيهات الأمان، والاحتفاظ بالبيانات، ومفاتيح الواجهة والخطافات. لا يُعرض شيء ولا يُحفظ.'
      )}
    />
  </Panel>
);

export function settings(tab = '') {
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Administration', 'الإدارة') }, { label: L('Settings', 'الإعدادات') }]}
        title={L('Parish settings', 'إعدادات الرعية')}
        sub={L('The parish profile and which modules it has.', 'ملف الرعية والوحدات المتاحة لها.')}
      />
      <TabBar
        base="settings"
        items={[
          ['', 'Parish', 'الرعية'],
          ['modules', 'Modules', 'الوحدات'],
          ['other', 'Other settings', 'إعدادات أخرى']
        ]}
        active={tab}
      />
      {!session.parishId ? (
        <C.InlineAlert tone="info" title={L('Choose a parish', 'اختر رعية')} body="" />
      ) : tab === 'modules' ? (
        <Modules />
      ) : tab === 'other' ? (
        <NotConnected />
      ) : (
        <Profile />
      )}
    </>
  );
}

settings.mount = () => {};
