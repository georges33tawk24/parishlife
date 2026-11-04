/* Parish settings: the parish, colours, currency, languages, modules, roles and permissions,
   security, data deletion and integrations. */
import { Select } from '../../ui/components.jsx';
import { t, isAr, num } from '../../../lib/i18n.js';
import { ROLES, is, bus } from '../../model/store.js';
import {
  Icon,
  PageHead,
  Panel,
  Who,
  Pill,
  Table,
  Empty,
  openModal,
  closeOverlays,
  toast,
  TabBar
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { savedAt, savedSize } from '../../model/persist.js';
import {
  RATE,
  PARISH,
  SESSIONS,
  SECURITY_ALERTS,
  RETENTION,
  WEBHOOKS,
  PERMISSIONS,
  ARCHIVED,
  PHOTOS,
  EXCEPTIONS,
  PREFS,
  person
} from '../../model/data.js';

const L = (en, ar) => t(en, ar);

const SETTABS = () => [
  ['', 'Parish', 'الرعية'],
  ['appearance', 'Colours', 'الألوان'],
  ['currency', 'Currency', 'العملة'],
  ['languages', 'Languages', 'اللغات'],
  ['modules', 'Modules', 'الوحدات'],
  ['roles', 'Roles & permissions', 'الأدوار والصلاحيات'],
  ['security', 'Security', 'الأمان'],
  ['data', 'Data & retention', 'البيانات والحفظ'],
  ['api', 'API & webhooks', 'الواجهة البرمجية']
];

export function settings(tab = '') {
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Administration', 'الإدارة') }, { label: L('Settings', 'الإعدادات') }]}
        title={L('Parish settings', 'إعدادات الرعية')}
        sub={L(
          'Branding, enabled modules, languages, currency, permissions and local workflow rules.',
          'الهوية والوحدات المفعّلة واللغات والعملة والصلاحيات وقواعد العمل المحلية.'
        )}
        actions={
          tab === 'appearance' ? (
            ''
          ) : (
            <button className="btn btn-primary" data-act="settings-save">
              <Icon name="check" size={17} />
              {L('Save changes', 'حفظ التعديلات')}
            </button>
          )
        }
      />
      <TabBar base="settings" items={SETTABS()} active={tab} />
    </>
  );
  const T = {
    '': () => (
      <div className="splitview">
        <div className="stack" style={{ gap: '16px' }}>
          <Panel title={L('Parish', 'الرعية')}>
            <div className="formgrid">
              <C.Field label={L('Name (English)', 'الاسم (إنكليزي)')} value={PARISH.name} />{' '}
              <C.Field label={L('Name (Arabic)', 'الاسم (عربي)')} value={PARISH.nameAr} dir="rtl" ar={true} />{' '}
              <C.Field label={L('Eparchy', 'الأبرشية')} value={L(PARISH.eparchy, PARISH.eparchyAr)} />{' '}
              <C.Field label={L('Patron saint', 'الشفيع')} value={L('Saint Elias the Prophet', 'مار الياس النبي')} />
            </div>{' '}
            <C.RiteSelect /> <C.Field label={L('Phone', 'الهاتف')} value={PARISH.phone} dir="ltr" />{' '}
            <C.Field label={L('Address', 'العنوان')} value={L(PARISH.address, PARISH.addressAr)} />
          </Panel>{' '}
          <Panel title={L('Branding', 'الهوية')}>
            <C.AvatarUpload k="parish" />{' '}
            <div className="scheme-current">
              <span className="scheme-dot" aria-hidden="true" />{' '}
              <span className="grow">
                <b>{L('Personal appearance', 'المظهر الشخصي')}</b>
                <small>
                  {L(
                    'Choose your own dashboard palette in My account. Public websites share one theme.',
                    'اختر ألوان حسابك في حسابي. للمواقع العامة مظهر موحّد.'
                  )}
                </small>
              </span>{' '}
              <a className="btn btn-secondary btn-dense" href="#/account">
                {L('Change colours', 'تغيير الألوان')}
              </a>
            </div>
          </Panel>
        </div>{' '}
        <div className="sidecol">
          <Panel title={L('Clergy and staff', 'الإكليروس والموظّفون')} tight={true}>
            {['p17', 'p18', 'p4', 'p15'].map((id, i) => (
              <div key={i} className="listrow" style={{ paddingInline: 0 }}>
                <Who p={person(id)} /> <span className="grow" />
                <C.IconBtn ico="edit" label={L('Edit', 'تعديل')} data-act={`person-edit:${id}`} />
              </div>
            ))}
          </Panel>
        </div>
      </div>
    ),
    appearance: () => (
      <Panel title={L('Personal appearance', 'المظهر الشخصي')}>
        <p>
          {L(
            'Each user chooses their own dashboard colors and light or dark mode.',
            'يختار كل مستخدم ألوان حسابه والوضع الفاتح أو الداكن.'
          )}
        </p>
        <a className="btn btn-primary" href="#/account">
          {L('Open my account', 'افتح حسابي')}
        </a>
      </Panel>
    ),
    currency: () => (
      <div className="splitview">
        <div>
          <Panel title={L('Currency and rate', 'العملة والسعر')}>
            <div className="formgrid">
              <div className="formrow">
                <label className="label">{L('Leading currency', 'العملة الأساسية')}</label>{' '}
                <Select data-pref="cur.lead" aria-label={L('Leading currency', 'العملة الأساسية')}>
                  <option>USD</option>
                  <option>L.L</option>
                </Select>
              </div>{' '}
              <C.Field
                label={L('Rate (lira to the dollar)', 'السعر (ليرة للدولار)')}
                value={num(RATE.value)}
                dir="ltr"
                state={
                  is('priest', 'treasurer', 'super_admin', 'bishop', 'diocesan_admin', 'parish_admin') ? '' : 'disabled'
                }
              />
            </div>{' '}
            <p className="help">
              {L(
                'Changing the rate applies to new records only. Everything already recorded keeps the rate it was created with.',
                'تغيير السعر يسري على السجلات الجديدة فقط. وما سُجّل يحتفظ بالسعر الذي أُنشئ به.'
              )}
            </p>{' '}
            <div className="stack" style={{ gap: '12px', marginTop: '16px' }}>
              <C.SwitchRow
                label={L('Warn when the rate is more than 7 days old', 'نبّهني حين يتجاوز عمر السعر ٧ أيام')}
                checked={true}
                pref="cur.warn"
              />{' '}
              <C.SwitchRow
                label={L('Show both currencies on every amount', 'إظهار العملتين على كل مبلغ')}
                checked={true}
                pref="cur.both"
              />{' '}
              <C.SwitchRow
                label={L(
                  'Keep lira gifts as lira, never convert on entry',
                  'إبقاء تقدمات الليرة ليرة، بلا تحويل عند الإدخال'
                )}
                checked={true}
                pref="cur.keepLira"
              />
            </div>
          </Panel>
        </div>{' '}
        <div className="sidecol">
          <Panel title={L('Rate history', 'سجل الأسعار')}>
            <div className="timeline">
              {[
                ['89,500', '4 Oct 2026', 'p17'],
                ['89,200', '12 Sep 2026', 'p15'],
                ['90,100', '3 Aug 2026', 'p15']
              ].map(([v, d, p], i) => (
                <div key={i} className={`tl-item ${i === 0 ? 'accent' : ''}`}>
                  <div className="when">
                    {d} · {isAr() ? person(p).ar : person(p).lat}
                  </div>{' '}
                  <div className="what">
                    <b className="mono">{v}</b> L.L / $
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    ),
    languages: () => (
      <div className="splitview">
        <div>
          <Panel title={L('Interface languages', 'لغات الواجهة')}>
            <div className="stack" style={{ gap: '12px' }}>
              <C.CheckRow label={L('English', 'الإنكليزية')} checked={true} pref="lang.en" />{' '}
              <C.CheckRow
                label={L('Arabic — with full right-to-left mirroring', 'العربية — مع انعكاس كامل من اليمين إلى اليسار')}
                checked={true}
                pref="lang.ar"
              />{' '}
              <C.CheckRow
                label={L('French', 'الفرنسية')}
                note={L('interface strings not yet translated', 'نصوص الواجهة غير مترجمة بعد')}
                pref="lang.fr"
              />
            </div>{' '}
            <div className="divider" />{' '}
            <h4 className="t-ui" style={{ marginBottom: '10px' }}>
              {L('Certificates', 'الشهادات')}
            </h4>{' '}
            <p className="help" style={{ marginBottom: '12px' }}>
              {L(
                'Certificates can be issued bilingual or trilingual independently of the interface language.',
                'يمكن إصدار الشهادات بلغتين أو ثلاث بمعزل عن لغة الواجهة.'
              )}
            </p>{' '}
            <span data-pref-group="cert.langs">
              <C.BGroup
                items={[L('Arabic', 'عربي'), L('Bilingual', 'ثنائي'), L('Trilingual', 'ثلاثي')]}
                sel={PREFS['cert.langs'] ?? 1}
              />
            </span>
          </Panel>
        </div>{' '}
        <div className="sidecol">
          <Panel title={L('Liturgical calendar', 'الرزنامة الطقسية')}>
            <Select data-pref="cal.rite" aria-label={L('Liturgical calendar', 'الرزنامة الطقسية')}>
              <option value="maronite">{L('Maronite', 'مارونية')}</option>
              <option value="melkite">{L('Melkite', 'روم كاثوليك')}</option>
              <option value="orthodox">{L('Greek Orthodox', 'روم أرثوذكس')}</option>
              <option value="armenian">{L('Armenian', 'أرمنية')}</option>
            </Select>{' '}
            <p className="help" style={{ marginTop: '10px' }}>
              {L(
                'The calendar in use must be approved by the parish. Feast days drive the gold markers everywhere in the product.',
                'يجب أن توافق الرعية على الرزنامة المستعملة. والأعياد تقود العلامات الذهبية في كل المنتج.'
              )}
            </p>
          </Panel>
        </div>
      </div>
    ),
    modules: () => (
      <div style={{ maxWidth: '760px' }}>
        <Panel title={L('Enabled modules', 'الوحدات المفعّلة')}>
          <div className="stack" style={{ gap: '12px' }}>
            {[
              [L('Sacramental registers', 'سجلات الأسرار'), true],
              [L('Giving and finance', 'التقدمات والمالية'), true],
              [L('Child check-in and safeguarding', 'تسجيل الأطفال والحماية'), true],
              [L('Music library', 'مكتبة الألحان'), true],
              [L('Member portal', 'بوّابة المؤمنين'), true],
              [L('Facilities and reservations', 'المرافق والحجوزات'), true],
              [L('Volunteer scheduling', 'جدولة المتطوّعين'), true],
              [L('Online payments', 'الدفع الإلكتروني'), false],
              [L('AI assistance', 'مساعدة الذكاء الاصطناعي'), false]
            ].map(([l, on], i) => (
              <C.SwitchRow key={i} label={l} checked={on} pref={`mod.${i}`} />
            ))}
          </div>{' '}
          <p className="help" style={{ marginTop: '14px' }}>
            {L(
              'A module that is switched off disappears from every rail, for every role.',
              'الوحدة المعطَّلة تختفي من كل شريط ولكل دور.'
            )}
          </p>
        </Panel>
      </div>
    ),
    roles: () => (
      <div className="splitview">
        <div>
          <Panel title={L('Permission matrix', 'مصفوفة الصلاحيات')} tight={true}>
            <div className="tablescroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{L('Action', 'الإجراء')}</th>
                    {Object.values(ROLES).map((r, i) => (
                      <th key={i} style={{ textAlign: 'center' }}>
                        {L(r.en, r.ar)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map(([code, en, ar, roles], i) => (
                    <tr key={i}>
                      <td>
                        <b style={{ font: '500 13px/18px var(--sans)' }}>{L(en, ar)}</b>{' '}
                        <small className="t-caption mono dimmer" style={{ display: 'block' }}>
                          {code}
                        </small>
                      </td>
                      {Object.keys(ROLES).map((k, i) => (
                        <td key={i} style={{ textAlign: 'center' }}>
                          {roles.includes(k) ? (
                            <span style={{ color: 'var(--success)' }}>
                              <Icon name="check" size={17} />
                            </span>
                          ) : (
                            <span className="dimmer">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>{' '}
        <div className="sidecol">
          <Panel title={L('Roles', 'الأدوار')} tight={true}>
            {Object.entries(ROLES).map(([k, r], i) => (
              <div key={i} className="listrow" style={{ paddingInline: 0, alignItems: 'flex-start' }}>
                <span className="grow">
                  <b>{L(r.en, r.ar)}</b>
                  <small style={{ whiteSpace: 'normal' }}>{L(r.noteEn, r.noteAr)}</small>
                </span>{' '}
                <span className="badge badge-quiet">{r.nav.filter(n => n[0] === 'l').length}</span>
              </div>
            ))}
          </Panel>{' '}
          <Panel title={L('Exceptions', 'الاستثناءات')}>
            <p className="t-body dim" style={{ fontSize: '14px' }}>
              {L(
                'A named person can be granted or denied a single action. An explicit deny always beats a role grant, and every exception carries a reason and a review date.',
                'يمكن منح شخص مسمّى إجراءً واحداً أو حرمانه منه. والمنع الصريح يتقدّم دائماً على منح الدور، ولكل استثناء سبب وتاريخ مراجعة.'
              )}
            </p>{' '}
            {EXCEPTIONS.length ? (
              EXCEPTIONS.map((x, i) => (
                <div key={i} className="listrow" style={{ paddingInline: 0, marginTop: '10px' }}>
                  <Who p={person(x.p)} /> <span className="grow" />
                  <Pill label={`${x.effect} ${x.action}`} tone={x.effect === '+' ? 'success' : 'danger'} />
                </div>
              ))
            ) : (
              <p className="t-caption dim">{L('No exceptions are recorded.', 'لا استثناءات مسجّلة.')}</p>
            )}{' '}
            <p className="help" style={{ marginTop: '10px' }}>
              {L(
                'Exceptions are kept by the platform administrators: the parish sees them here but does not change them.',
                'يحفظ مسؤولو المنصّة الاستثناءات: تراها الرعية هنا ولا تغيّرها.'
              )}
            </p>
          </Panel>
        </div>
      </div>
    ),
    security: () => (
      <div className="splitview">
        <div className="stack" style={{ gap: '16px' }}>
          <Panel title={L('Authentication', 'المصادقة')}>
            <div className="stack" style={{ gap: '12px' }}>
              <C.SwitchRow
                label={L('Two-factor for administrators', 'تحقّق بخطوتين للمدراء')}
                checked={true}
                pref="sec.2fa"
              />{' '}
              <C.SwitchRow
                label={L('Sign out after 30 minutes idle', 'تسجيل الخروج بعد ٣٠ دقيقة خمول')}
                checked={true}
                pref="sec.idle"
              />{' '}
              <C.SwitchRow
                label={L('Alert on sign-in from a new device', 'تنبيه عند الدخول من جهاز جديد')}
                checked={true}
                pref="sec.newdevice"
              />
            </div>
          </Panel>{' '}
          <Panel title={L('Active sessions and devices', 'الجلسات والأجهزة النشطة')} tight={true}>
            {SESSIONS.map((s, si) => (
              <div key={si} className="listrow" style={{ paddingInline: 0 }}>
                <Icon name="card" size={17} cls="dimmer" />
                <span className="grow">
                  <b>{L(s.device, s.deviceAr)}</b>{' '}
                  <small>
                    {s.where} · {s.at}
                  </small>
                </span>{' '}
                {s.current ? (
                  <Pill label={L('This device', 'هذا الجهاز')} tone="success" />
                ) : (
                  <button className="btn btn-danger-quiet btn-dense" data-act={`session-revoke:${si}`}>
                    {L('Revoke', 'إنهاء')}
                  </button>
                )}
              </div>
            ))}
          </Panel>{' '}
          <Panel title={L('Security alerts', 'تنبيهات الأمان')}>
            {SECURITY_ALERTS.map((a, i) => (
              <C.InlineAlert
                key={i}
                tone={a.level === 'warning' ? 'warning' : 'info'}
                title={L(a.what, a.whatAr)}
                body={a.at}
              />
            ))}
          </Panel>{' '}
          <Panel title={L('Boundaries that are tested, not assumed', 'حدود تُختبَر لا تُفترَض')}>
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
                  L(
                    'Every import and upload is validated before a byte is written',
                    'يُتحقَّق من كل استيراد ورفع قبل كتابة أي بايت'
                  ),
                  'shield'
                ],
                [
                  L(
                    'Rate limits on every endpoint, with failures monitored',
                    'حدود معدّل على كل وجهة، مع مراقبة الإخفاقات'
                  ),
                  'clock'
                ],
                [
                  L(
                    'Two people editing one record: the second is told, and neither silently overwrites the other',
                    'شخصان يعدّلان سجلاً واحداً: يُبلَّغ الثاني، ولا يمحو أحدهما الآخر بصمت'
                  ),
                  'people'
                ],
                [
                  L(
                    'Authorisation boundaries are covered by the test suite, including cross-parish isolation',
                    'حدود الصلاحيات مغطّاة باختبارات، بما فيها عزل الرعايا'
                  ),
                  'check'
                ]
              ].map(([x, i], k) => (
                <li key={k} className="row" style={{ gap: '10px', alignItems: 'flex-start' }}>
                  <Icon name={i} size={17} cls="dimmer" /> <span className="t-caption">{x}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>{' '}
        <div className="sidecol">
          <Panel title={L('Field-level protection', 'حماية على مستوى الحقل')}>
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
                [L('Medical and allergy alerts', 'التنبيهات الطبية والحساسية'), 'shield'],
                [L('Safeguarding and incident reports', 'تقارير الحماية والحوادث'), 'shield'],
                [L('Donor details and amounts', 'تفاصيل المتبرّعين والمبالغ'), 'give'],
                [L('Notes & Tasks', 'الملاحظات والمهام'), 'notes']
              ].map(([x, i], k) => (
                <li key={k} className="row" style={{ gap: '10px', alignItems: 'flex-start' }}>
                  <Icon name={i} size={17} cls="dimmer" /> <span className="t-caption">{x}</span>
                </li>
              ))}
            </ul>{' '}
            <div className="divider" />{' '}
            <p className="t-caption dim">
              {L(
                'Permissions are checked on the server and again on every export — hiding a screen is never treated as security.',
                'تُفحص الصلاحيات على الخادم ومجدداً عند كل تصدير — ولا يُعتبر إخفاء الشاشة أماناً.'
              )}
            </p>
          </Panel>
        </div>
      </div>
    ),
    data: () => (
      <div className="splitview">
        <div>
          <Panel title={L('Retention schedule', 'جدول الحفظ')} tight={true}>
            <Table
              cols={[{ label: L('Record type', 'نوع السجل') }, { label: L('Kept for', 'يُحفظ') }]}
              rows={RETENTION.map(([en, ar, ke, ka]) => ({
                cells: [<b>{L(en, ar)}</b>, <span className="dim">{L(ke, ka)}</span>]
              }))}
            />
          </Panel>
        </div>{' '}
        <div className="sidecol">
          <Panel title={L('Where this parish is saved', 'أين تُحفظ هذه الرعية')}>
            <p className="t-body dim" style={{ fontSize: '14px', lineHeight: '22px' }}>
              {L(
                'Changes are saved to the parish database on the server and are available to authorized accounts after a reload or from another computer.',
                'تُحفظ التغييرات في قاعدة بيانات الرعية على الخادم، وتبقى متاحة للحسابات المخوّلة بعد إعادة التحميل أو من حاسوب آخر.'
              )}
            </p>{' '}
            <dl className="dl" style={{ marginTop: '12px' }}>
              <dt>{L('Last saved', 'آخر حفظ')}</dt>
              <dd className="mono">
                {savedAt()
                  ? new Date(savedAt()).toLocaleString(isAr() ? 'ar-LB' : 'en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })
                  : L('Not yet — nothing has changed', 'ليس بعد — لم يتغيّر شيء')}
              </dd>
              <dt>{L('Size', 'الحجم')}</dt>
              <dd className="mono">{Math.max(1, Math.round(savedSize() / 1024))} KB</dd>
            </dl>{' '}
            <div className="row" style={{ gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-dense" data-act="data-export">
                <Icon name="export" size={15} />
                {L('Download data snapshot', 'تنزيل صورة من البيانات')}
              </button>
            </div>{' '}
            <div className="divider" />{' '}
            <p className="help">
              {L(
                'Restoring a database backup requires a reviewed administrator operation.',
                'استعادة نسخة قاعدة البيانات تتطلب إجراءً إدارياً مُراجعاً.'
              )}
            </p>
          </Panel>{' '}
          <Panel title={L('Permanent deletion', 'الحذف النهائي')}>
            <p className="t-body dim" style={{ fontSize: '14px' }}>
              {L(
                'Permanent deletion is a reviewed request, not a button. The reviewer is shown exactly what would be lost before they can confirm, and sacramental records are never deletable.',
                'الحذف النهائي طلب يُراجَع لا زرّ. ويُعرَض على المراجع ما سيُفقَد قبل التأكيد، وسجلات الأسرار غير قابلة للحذف أبداً.'
              )}
            </p>{' '}
            <button className="btn btn-danger-quiet" style={{ marginTop: '12px', width: '100%' }} id="perm">
              <Icon name="trash" size={16} />
              {L('Review deletion requests', 'مراجعة طلبات الحذف')}
            </button>
          </Panel>
        </div>
      </div>
    ),
    api: () => (
      <div className="splitview">
        <div>
          <Panel title={L('Webhooks', 'الخطّافات')} tight={true}>
            <Table
              cols={[
                { label: L('Endpoint', 'الوجهة') },
                { label: L('Events', 'الأحداث'), cls: 'hide-sm' },
                { label: L('Scope', 'النطاق'), cls: 'shrink' },
                { label: L('Active', 'مفعّل'), cls: 'shrink' }
              ]}
              rows={WEBHOOKS.map((w, wi) => ({
                cells: [
                  <span className="mono" style={{ fontSize: '12px' }}>
                    {w.url}
                  </span>,
                  <span className="row" style={{ gap: '4px', flexWrap: 'wrap' }}>
                    {w.events.map((e, i) => (
                      <span key={i} className="chip">
                        {e}
                      </span>
                    ))}
                  </span>,
                  <Pill label={w.scope} tone="info" />,
                  <label className="switch">
                    <input type="checkbox" defaultChecked={!!w.active} data-act={`wh-toggle:${wi}`} />
                    <span className="sr">{L('Active', 'مفعّل')}</span>
                  </label>
                ]
              }))}
            />
          </Panel>{' '}
          <button className="btn btn-secondary" style={{ marginTop: '16px' }} data-act="webhook-add">
            <Icon name="plus" size={17} />
            {L('Add webhook', 'إضافة خطّاف')}
          </button>
        </div>{' '}
        <div className="sidecol">
          <Panel title={L('API credentials', 'بيانات الاعتماد')}>
            {PARISH.apiKeyRevoked ? (
              <C.InlineAlert
                tone="warning"
                title={L('The reporting key is revoked', 'مفتاح التقارير ملغى')}
                body={L(
                  'The eparchy link is stopped until a new key is issued.',
                  'رابط الأبرشية متوقّف حتى إصدار مفتاح جديد.'
                )}
              />
            ) : (
              <C.Field
                label={L('Eparchy reporting key', 'مفتاح تقارير الأبرشية')}
                value={'pl_live_••••••••••••' + (PARISH.apiKey || '7a21')}
                state="disabled"
                dir="ltr"
              />
            )}{' '}
            <div className="row" style={{ gap: '8px', marginTop: '12px' }}>
              <button className="btn btn-secondary btn-dense" data-act="key-rotate">
                {PARISH.apiKeyRevoked ? L('Issue a new key', 'إصدار مفتاح جديد') : L('Rotate', 'تدوير')}
              </button>{' '}
              {PARISH.apiKeyRevoked ? (
                ''
              ) : (
                <button className="btn btn-danger-quiet btn-dense" data-act="key-revoke">
                  {L('Revoke', 'إلغاء')}
                </button>
              )}
            </div>{' '}
            <p className="t-caption dim" style={{ marginTop: '12px' }}>
              {L(
                'Credentials are scoped to named events and are auditable like any other access. Rate limits apply to every endpoint.',
                'بيانات الاعتماد محصورة بأحداث مسمّاة وقابلة للتدقيق كأي وصول آخر. وتُطبَّق حدود المعدّل على كل وجهة.'
              )}
            </p>
          </Panel>
        </div>
      </div>
    )
  };
  return (
    <>
      {head}
      {(T[tab] || T[''])()}
    </>
  );
}

settings.mount = (host, tab = '') => {
  host.querySelector('#perm')?.addEventListener('click', reviewDeletions);
  // Appearance is managed per account through My account.
};

/* Deletion requests made from People → Archived. Approving is permanent and typed; declining keeps the archived record. */
function reviewDeletions() {
  const reqs = ARCHIVED.filter(p => p.deletionRequested);
  openModal({
    title: L('Deletion requests', 'طلبات الحذف'),
    sub: reqs.length
      ? L(
          'Each record was archived first. Deleting removes it for good; sacramental entries stay in the registers.',
          'أُرشف كل سجل أولاً. والحذف يزيله نهائياً؛ وتبقى قيود الأسرار في السجلات.'
        )
      : '',
    body: reqs.length ? (
      reqs.map((p, i) => (
        <div key={i} className="listrow" style={{ paddingInline: 0 }}>
          <Who p={p} />
          <span className="grow" />{' '}
          <button className="btn btn-secondary btn-dense" data-del-no={p.id}>
            {L('Decline', 'رفض')}
          </button>{' '}
          <button className="btn btn-danger btn-dense" data-del-yes={p.id}>
            {L('Delete', 'حذف')}
          </button>
        </div>
      ))
    ) : (
      <Empty
        glyph="check"
        title={L('No deletion requests', 'لا طلبات حذف')}
        body={L(
          'They are made from People → Archived, after a record has been archived.',
          'تُقدَّم من المؤمنون ← المؤرشفون، بعد أرشفة السجل.'
        )}
        action={
          <a className="btn btn-secondary btn-dense" href="#/people/archived">
            {L('Open archived records', 'فتح السجلات المؤرشفة')}
          </a>
        }
      />
    ),
    foot: (
      <button className="btn btn-secondary" data-close="" style={{ marginInlineStart: 'auto' }}>
        {L('Close', 'إغلاق')}
      </button>
    ),
    onMount(el) {
      el.querySelectorAll('[data-del-no]').forEach(b =>
        b.addEventListener('click', () => {
          const p = ARCHIVED.find(x => x.id === b.dataset.delNo);
          if (!p) return;
          delete p.deletionRequested;
          bus.refresh();
          reviewDeletions();
          toast(L('Request declined', 'رُفض الطلب'), L(`${p.lat} stays archived.`, `يبقى ${p.ar} مؤرشفاً.`));
        })
      );
      el.querySelectorAll('[data-del-yes]').forEach(b =>
        b.addEventListener('click', () => confirmDeletion(ARCHIVED.find(x => x.id === b.dataset.delYes)))
      );
    }
  });
}

function confirmDeletion(p) {
  if (!p) return;
  openModal({
    title: L('Permanently delete this record?', 'حذف هذا السجل نهائياً؟'),
    sub: L('This cannot be undone.', 'لا يمكن التراجع.'),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="typed">
            {L('Type', 'اكتب')} <b>{p.lat}</b> {L('to confirm', 'للتأكيد')}
          </label>{' '}
          <input className="input" id="typed" autoComplete="off" placeholder={p.lat} />
        </div>{' '}
        <span className="help help-error" id="typedhelp">
          {L('The name does not match yet.', 'الاسم لا يطابق بعد.')}
        </span>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Keep record', 'الاحتفاظ بالسجل')}
        </button>{' '}
        <button className="btn btn-danger" id="del" disabled style={{ marginInlineStart: 'auto' }}>
          {L('Delete permanently', 'حذف نهائي')}
        </button>
      </>
    ),
    onMount(el) {
      const inp = el.querySelector('#typed'),
        btn = el.querySelector('#del'),
        help = el.querySelector('#typedhelp');
      inp.addEventListener('input', () => {
        const okk = inp.value.trim() === p.lat;
        btn.disabled = !okk;
        help.classList.toggle('help-error', !okk);
        help.classList.toggle('help-ok', okk);
        help.textContent = okk ? L('Match.', 'مطابق.') : L('The name does not match yet.', 'الاسم لا يطابق بعد.');
      });
      btn.addEventListener('click', () => {
        ARCHIVED.splice(ARCHIVED.indexOf(p), 1);
        delete PHOTOS[p.id];
        closeOverlays();
        bus.refresh();
        toast(L('Record deleted permanently', 'حُذف السجل نهائياً'), p.lat, 'success');
      });
    }
  });
}
