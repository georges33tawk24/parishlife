/* The parish's own public website: its sections and content, self-service settings and prayer
   requests. */
import { t, num, fmtDate } from '../../../lib/i18n.js';
import { Icon, PageHead, Panel, Who, Status, Pill, Table, Empty, TabBar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { PRAYERS, PARISH, PORTAL_REQUESTS, CONTENT, person } from '../../model/data.js';
import { waitingOnline } from '../records/online-requests.jsx';
import { session } from '../../model/api.js';

const L = (en, ar) => t(en, ar);

const portalSections = [
  [
    'welcome',
    'Welcome message',
    'رسالة الترحيب',
    'Introduce your parish in a few welcoming words.',
    'عرّف برعيتك بكلمات ترحيبية موجزة.'
  ],
  [
    'history',
    'History & patron saint',
    'التاريخ والشفيع',
    'Share the story and identity of your parish.',
    'شارك تاريخ رعيتك وهويتها.'
  ],
  [
    'massTimes',
    'Mass & confession',
    'القداديس والاعتراف',
    'Help visitors plan their next visit.',
    'ساعد الزوّار على التخطيط لزيارتهم المقبلة.'
  ],
  [
    'contact',
    'Contact & visiting',
    'التواصل والزيارة',
    'Make it easy to find and contact the parish.',
    'سهّل الوصول إلى الرعية والتواصل معها.'
  ],
  [
    'sacraments',
    'Sacraments & certificates',
    'الأسرار والشهادات',
    'Tell families what to know before they ask for a baptism, a wedding or a certificate.',
    'أخبر العائلات بما يجب معرفته قبل طلب معمودية أو إكليل أو شهادة.'
  ]
];

function portalContent() {
  const hasText = c => !!(c.en?.trim() || c.ar?.trim());
  const published = portalSections.filter(([key]) => {
    const c = CONTENT[key] || {};
    return hasText(c) && c.published !== false;
  }).length;
  const drafts = portalSections.filter(([key]) => {
    const c = CONTENT[key] || {};
    return hasText(c) && c.published === false;
  }).length;
  return (
    <div className="cms-content">
      <section className="cms-overview" aria-labelledby="cms-overview-title">
        <div className="cms-overview-copy">
          <span className="cms-eyebrow">{L('Your public presence', 'حضورك العام')}</span>{' '}
          <h2 id="cms-overview-title">{L(PARISH.name, PARISH.nameAr)}</h2>{' '}
          <p>
            {L(
              'A welcoming first visit starts here. Keep your parish story, service times and visiting details easy to find.',
              'تبدأ الزيارة الأولى هنا. اجعل تاريخ رعيتك ومواعيد الخدمات ومعلومات الزيارة سهلة الوصول.'
            )}
          </p>
        </div>{' '}
        <dl className="cms-summary">
          <div>
            <dt>{L('Published', 'منشور')}</dt>
            <dd>{num(published)}</dd>
          </div>
          <div>
            <dt>{L('Drafts', 'مسودات')}</dt>
            <dd>{num(drafts)}</dd>
          </div>
          <div>
            <dt>{L('Empty', 'فارغ')}</dt>
            <dd>{num(portalSections.length - published - drafts)}</dd>
          </div>
        </dl>
      </section>{' '}
      <div className="cms-section-heading">
        <div>
          <span className="cms-eyebrow">{L('01 / Website content', '01 / محتوى الموقع')}</span>
          <h2>{L('Make every section feel welcoming.', 'اجعل كل قسم يرحّب بالزوّار.')}</h2>
        </div>{' '}
        <p>
          {L(
            'Edit in English and Arabic. Only published sections are visible to visitors.',
            'حرّر بالإنكليزية والعربية. يرى الزوّار الأقسام المنشورة فقط.'
          )}
        </p>
      </div>{' '}
      <div className="cms-section-grid">
        {portalSections.map(([key, en, ar, desc, descAr], index) => {
          const c = CONTENT[key] || {},
            filled = hasText(c),
            state = !filled ? 'empty' : c.published === false ? 'draft' : 'published';
          const preview = L(c.en || '', c.ar || '') || c.en || c.ar || '';
          return (
            <article className="cms-section-card" aria-labelledby={`cms-${key}-title`}>
              <div className="cms-card-top">
                <span className="cms-section-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={`cms-state cms-state-${state}`}>
                  <span aria-hidden="true" />
                  {state === 'published'
                    ? L('Published', 'منشور')
                    : state === 'draft'
                      ? L('Draft · private', 'مسودة · خاصة')
                      : L('Not started', 'لم يبدأ بعد')}
                </span>
              </div>{' '}
              <h3 id={`cms-${key}-title`}>{L(en, ar)}</h3>
              <p className="cms-card-description">{L(desc, descAr)}</p>{' '}
              <p className={`cms-content-preview${filled ? '' : ' cms-content-empty'}`} dir="auto">
                {preview ||
                  (key === 'sacraments'
                    ? L(
                        'Until you add one, visitors see a short default introduction above the request buttons.',
                        'إلى أن تضيف نصاً، يرى الزوّار مقدّمة قصيرة افتراضية فوق أزرار الطلبات.'
                      )
                    : L('Add this section to welcome visitors to your parish.', 'أضف هذا القسم للترحيب بزوّار رعيتك.'))}
              </p>{' '}
              <div className="cms-card-footer">
                <div className="cms-languages" aria-label={L('Content languages', 'لغات المحتوى')}>
                  <span
                    className={c.en?.trim() ? 'is-ready' : ''}
                    title={
                      c.en?.trim()
                        ? L('English content ready', 'المحتوى الإنكليزي جاهز')
                        : L('English content missing', 'المحتوى الإنكليزي غير مضاف')
                    }
                  >
                    <Icon name={c.en?.trim() ? 'check' : 'plus'} size={12} />
                    English
                  </span>
                  <span
                    className={c.ar?.trim() ? 'is-ready' : ''}
                    lang="ar"
                    title={
                      c.ar?.trim()
                        ? L('Arabic content ready', 'المحتوى العربي جاهز')
                        : L('Arabic content missing', 'المحتوى العربي غير مضاف')
                    }
                  >
                    <Icon name={c.ar?.trim() ? 'check' : 'plus'} size={12} />
                    العربية
                  </span>
                </div>{' '}
                <button
                  className="cms-edit"
                  data-act={`content-edit:${key}`}
                  aria-label={L('Edit ' + en, 'تعديل ' + ar)}
                >
                  {filled ? L('Edit section', 'تعديل القسم') : L('Add content', 'إضافة محتوى')}
                  <Icon name="arrowR" size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>{' '}
      <aside className="cms-publishing-note">
        <Icon name="info" size={18} />
        <p>
          {L(
            'Save a draft while you work. A draft section stays off the public page until you publish it. Add both languages before publishing.',
            'احفظ مسودة أثناء العمل. يبقى القسم المسودة خارج الصفحة العامة حتى تنشره. أضف اللغتين قبل النشر.'
          )}
        </p>
      </aside>{' '}
      <section className="cms-related" aria-labelledby="cms-related-title">
        <div>
          <span className="cms-eyebrow">{L('02 / Parish updates', '02 / مستجدات الرعية')}</span>
          <h2 id="cms-related-title">{L('Keep your community up to date.', 'أبقِ جماعتك على اطّلاع.')}</h2>
          <p>
            {L(
              'Public events and announcements are managed in their own spaces.',
              'تُدار الأحداث العامة والإعلانات في أقسامها الخاصة.'
            )}
          </p>
        </div>{' '}
        <div className="cms-related-links">
          <a href="#/calendar">
            <Icon name="events" size={21} />
            <span>
              <strong>{L('Public calendar', 'الرزنامة العامة')}</strong>
              <small>{L('Service times and upcoming events', 'مواعيد الخدمات والأحداث المقبلة')}</small>
            </span>
            <Icon name="arrowR" size={18} />
          </a>{' '}
          <a href="#/memberhub">
            <Icon name="bell" size={21} />
            <span>
              <strong>{L('Announcements', 'الإعلانات')}</strong>
              <small>{L('News and updates for your community', 'أخبار ومستجدات جماعتك')}</small>
            </span>
            <Icon name="arrowR" size={18} />
          </a>{' '}
          {session.user?.platformRole === 'super_admin' ? (
            <a href="#/workspace" data-act="homepage-edit">
              <Icon name="globe" size={21} />
              <span>
                <strong>{L('ParishLife homepage', 'الصفحة الرئيسية لـ ParishLife')}</strong>
                <small>
                  {L(
                    'Opening lines, announcement, stories and sections shared by every parish',
                    'الافتتاح والإعلان والقصص والأقسام المشتركة بين جميع الرعايا'
                  )}
                </small>
              </span>
              <Icon name="arrowR" size={18} />
            </a>
          ) : (
            ''
          )}
        </div>
      </section>
    </div>
  );
}

const PTABS = () => [
  ['', 'Website content', 'محتوى الموقع'],
  ['requests', 'Self-service', 'الخدمة الذاتية', PORTAL_REQUESTS.length],
  ['prayers', 'Prayer requests', 'نوايا الصلاة', PRAYERS.filter(p => p.status === 'awaiting-approval').length]
];

export function portal(tab = '') {
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Communicate', 'التواصل') }, { label: L('Member portal', 'بوّابة المؤمنين') }]}
        title={
          tab
            ? L('Parish content and member portal', 'محتوى الرعية وبوّابة المؤمنين')
            : L('Your parish website', 'موقع رعيتك')
        }
        sub={L(
          'A clear, welcoming place for parish life. Manage your public content and member requests.',
          'مساحة واضحة ومرحّبة لحياة الرعية. أدر المحتوى العام وطلبات الأعضاء.'
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-act="portal-open">
              <Icon name="link" size={17} />
              {L('View public page', 'عرض الصفحة العامة')}
            </button>{' '}
            <button className="btn btn-primary" data-act="content-edit:welcome">
              <Icon name="edit" size={17} />
              {L('Edit welcome', 'تعديل الترحيب')}
            </button>
          </>
        }
      />
      <TabBar base="portal" items={PTABS()} active={tab} />
    </>
  );
  const online = waitingOnline().length;
  const onlineNote = online ? (
    <a className="listrow or-pointer" href="#/requests">
      <Icon name="sacr" size={17} cls="dimmer" />
      <span className="grow">
        <b>
          {L(
            online === 1
              ? '1 sacrament or certificate request is waiting'
              : `${online} sacrament or certificate requests are waiting`,
            online === 1 ? 'طلب سرّ أو شهادة واحد بالانتظار' : `${online} طلبات أسرار أو شهادات بالانتظار`
          )}
        </b>{' '}
        <small>{L('They are reviewed in Requests.', 'تُراجَع في صفحة الطلبات.')}</small>
      </span>
      <Icon name="chevR" size={16} cls="dimmer" />
    </a>
  ) : (
    ''
  );
  if (tab === 'requests')
    return (
      <>
        {head}
        <div style={{ marginTop: '20px' }} className="splitview">
          <Panel title={L('Waiting for review', 'بانتظار المراجعة')} tight={false}>
            {
              <>
                {onlineNote}
                {PORTAL_REQUESTS.length ? (
                  <>
                    {PORTAL_REQUESTS.map(r => (
                      <div className="listrow" style={{ paddingInline: 0 }}>
                        <span className="grow">
                          <b>{L(r.what, r.whatAr)}</b>{' '}
                          <small>
                            {L('submitted', 'قُدّم')} {fmtDate(r.at)}
                          </small>
                        </span>{' '}
                        <button className="btn btn-secondary btn-dense" data-act={`portal-compare:${r.id}`}>
                          {L('Compare', 'مقارنة')}
                        </button>{' '}
                        <button className="btn btn-primary btn-dense" data-act={`portal-accept:${r.id}`}>
                          {L('Accept', 'قبول')}
                        </button>
                      </div>
                    ))}{' '}
                    <p className="t-caption dim" style={{ marginTop: '12px' }}>
                      {L(
                        'Nothing a member submits lands in the record directly. The office reviews every change first.',
                        'لا شيء يقدّمه المؤمن يدخل السجل مباشرة. يراجع المكتب كل تعديل أولاً.'
                      )}
                    </p>
                  </>
                ) : online ? (
                  ''
                ) : (
                  <Empty
                    glyph="check"
                    title={L('Nothing waiting', 'لا شيء بالانتظار')}
                    body={L(
                      'Changes members submit from the portal appear here for review.',
                      'التعديلات التي يرسلها المؤمنون من البوّابة تظهر هنا للمراجعة.'
                    )}
                  />
                )}
              </>
            }
          </Panel>{' '}
          <div className="sidecol">
            <Panel title={L('What a member can do', 'ما يستطيع المؤمن فعله')}>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {[
                  [
                    L('Update their own address, phone and family members', 'تحديث عنوانه وهاتفه وأفراد عائلته'),
                    'edit'
                  ],
                  [L('Manage family registrations where authorised', 'إدارة تسجيلات العائلة حيث يُصرَّح له'), 'family'],
                  [
                    L('Request a sacrament or a certificate, and follow each step', 'طلب سرّ أو شهادة ومتابعة كل خطوة'),
                    'sacr'
                  ],
                  [L('See their own giving statement', 'الاطّلاع على كشف تقدماته'), 'give'],
                  [L('Discover groups and request membership', 'اكتشاف المجموعات وطلب الانتساب'), 'groups'],
                  [L('See their volunteer schedule and registrations', 'رؤية مناوباته وتسجيلاته'), 'vol'],
                  [L('Set their own notification preferences', 'ضبط تفضيلات إشعاراته'), 'bell']
                ].map(([x, i]) => (
                  <li className="row" style={{ gap: '10px', alignItems: 'flex-start' }}>
                    <Icon name={i} size={17} cls="dimmer" />
                    <span className="t-caption">{x}</span>
                  </li>
                ))}
              </ul>{' '}
              <div className="divider" />{' '}
              <p className="t-caption dim">
                {L(
                  'A member never reaches anyone else’s record, and directory visibility is opt-in per person.',
                  'لا يصل المؤمن إلى سجل أحد آخر، وظهوره في الدليل اختياري لكل شخص.'
                )}
              </p>
            </Panel>
          </div>
        </div>
      </>
    );
  if (tab === 'prayers')
    return (
      <>
        {head}
        <div className="tabbody">
          <C.InlineAlert
            tone="info"
            title={L('A clear handling policy', 'سياسة معالجة واضحة')}
            body={L(
              'A private request is seen by the priest only and never published. A request offered for the public list is moderated before it appears.',
              'النيّة الخاصة يراها الكاهن وحده ولا تُنشر أبداً. والنيّة المعروضة للائحة العامة تُراجَع قبل ظهورها.'
            )}
          />{' '}
          <div style={{ marginTop: '16px' }}>
            <Table
              cols={[
                { label: L('From', 'من') },
                { label: L('Intention', 'النيّة') },
                { label: L('Visibility', 'الظهور'), cls: 'shrink' },
                { label: L('Status', 'الحالة'), cls: 'shrink' },
                { label: '', cls: 'shrink' }
              ]}
              rows={PRAYERS.map(p => ({
                cells: [
                  p.by ? <Who p={person(p.by)} /> : <span className="dim">{L('Anonymous', 'مجهول')}</span>,
                  L(p.body, p.bodyAr),
                  p.vis === 'private' ? (
                    <Pill label={L('Private', 'خاصة')} tone="info" mark="lock" />
                  ) : (
                    <Pill label={L('For the public list', 'للائحة العامة')} />
                  ),
                  p.status === 'private' ? (
                    <Pill label={L('Priest only', 'للكاهن فقط')} tone="info" mark="lock" />
                  ) : (
                    <Status k={p.status} />
                  ),
                  <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
                    {p.status === 'awaiting-approval' ? (
                      <button className="btn btn-primary btn-dense" data-act={`prayer-publish:${p.id}`}>
                        {L('Publish', 'نشر')}
                      </button>
                    ) : (
                      ''
                    )}
                    {CR.recBtn('prayer', p.id)}
                  </span>
                ]
              }))}
              empty={
                <Empty
                  glyph="notes"
                  title={L('No prayer requests', 'لا طلبات صلاة')}
                  body={L(
                    'Requests members send from the portal appear here for moderation.',
                    'الطلبات المرسلة من البوّابة تظهر هنا للمراجعة.'
                  )}
                />
              }
            />
          </div>
        </div>
      </>
    );
  return (
    <div className="cms-page">
      {head}
      {portalContent()}
    </div>
  );
}

portal.mount = host => {};
