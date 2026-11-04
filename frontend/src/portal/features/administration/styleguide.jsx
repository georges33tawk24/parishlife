/* The design system: every token, control and pattern of the portal, drawn with the same CSS the
   product uses. */
import { Select } from '../../ui/components.jsx';
import { css } from '../../ui/html.js';
import { t, isAr, num, usd } from '../../../lib/i18n.js';
import { go } from '../../model/store.js';
import {
  Icon,
  PageHead,
  Who,
  Status,
  Pill,
  Table,
  Empty,
  openDrawer,
  openModal,
  toast,
  TabBar,
  Amount,
  openMenu,
  Paged
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { deleteGuard, newPersonDrawer } from '../records/people.jsx';
import { FUNDS, RATE, ATTENDANCE_SERIES, GIVING_SERIES, PAYMENT_MIX, person } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

/* ═══════════ the living design system ═══════════
   Sheets 02 (tokens), 03 (controls) and 04 (patterns) rendered from the same
   CSS and components the product uses, so the library cannot drift from the app. */
const SGTABS = () => [
  ['', 'Tokens', 'الرموز'],
  ['controls', 'Controls', 'الضوابط'],
  ['lebanon', 'Lebanon fields', 'حقول لبنان'],
  ['patterns', 'Patterns', 'الأنماط'],
  ['data', 'Data & charts', 'البيانات والرسوم']
];

export function styleguide(tab = '') {
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Administration', 'الإدارة') }, { label: L('Design system', 'نظام التصميم') }]}
        title={L('ParishLife design system', 'نظام تصميم «حياة الرعية»')}
        sub={L(
          'Every token, control and pattern from the library, rendered by the same CSS the product uses. If a specimen here is wrong, the product is wrong too.',
          'كل رمز وضابط ونمط من المكتبة، مرسوماً بالـCSS نفسه الذي يستعمله المنتج. وإن كان النموذج هنا خاطئاً فالمنتج خاطئ أيضاً.'
        )}
        actions={
          <button className="btn btn-secondary" data-act="print">
            <Icon name="print" size={17} />
            {L('Print sheet', 'طباعة الورقة')}
          </button>
        }
      />
      <TabBar base="styleguide" items={SGTABS()} active={tab} />
    </>
  );
  const spec = (title, note, body) => (
    <section className="panel">
      <div className="panel-h">
        <h3>{title}</h3>
        {note ? (
          <span className="t-caption dim" style={{ marginInlineStart: 'auto' }}>
            {note}
          </span>
        ) : (
          ''
        )}
      </div>{' '}
      <div className="panel-b">{body}</div>
    </section>
  );
  const swatch = (name, hex, use) => (
    <div className="card card-flat" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={css(`height:64px;background:${hex};border-bottom:1px solid var(--border)`)} />{' '}
      <div style={{ padding: '12px 14px' }}>
        <b style={{ font: '500 13px/18px var(--sans)' }}>{name}</b>{' '}
        <div className="mono t-caption dim" dir="ltr">
          {hex}
        </div>{' '}
        <div className="t-caption dimmer" style={{ marginTop: '4px' }}>
          {use}
        </div>
      </div>
    </div>
  );
  const T = {
    '': () => (
      <>
        {spec(
          L('Colour', 'اللون'),
          L(
            'Forest green, sage and warm white throughout the product',
            'الأخضر الداكن والمريمي والأبيض الدافئ في جميع أجزاء التطبيق'
          ),
          <>
            <Paged className="gridcards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))' }}>
              {swatch(
                L('Forest green', 'أخضر داكن'),
                '#233B32',
                L('Actions, rail and body text', 'الأفعال والشريط ونص المتن')
              )}{' '}
              {swatch(
                L('Soft sage', 'مريمي فاتح'),
                '#EDF0E8',
                L('Soft fills and selected states', 'الخلفيات الناعمة وحالات التحديد')
              )}{' '}
              {swatch(L('White', 'أبيض'), '#FFFFFF', L('Cards, forms and print', 'البطاقات والاستمارات والطباعة'))}{' '}
              {swatch(
                L('Selection sage', 'مريمي التحديد'),
                '#D6E1D0',
                L('Selected navigation and quiet highlights', 'التنقّل المحدّد والإبراز الهادئ')
              )}{' '}
              {swatch(
                L('Muted sage gray', 'رمادي مريمي'),
                '#607068',
                L('Secondary text, accents and charts', 'النص الثانوي واللمسات والرسوم')
              )}
            </Paged>{' '}
            <div className="divider" />{' '}
            <Paged className="gridcards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))' }}>
              {swatch(L('Warm white', 'أبيض دافئ'), '#F7F7F2', L('Page background', 'خلفية الصفحة'))}{' '}
              {swatch(
                L('Paper', 'لون الورق'),
                '#F7F7F2',
                L('Table headers and summary cards', 'رؤوس الجداول وبطاقات الملخّص')
              )}{' '}
              {swatch(
                L('Sage accent', 'لمسة مريمية'),
                '#9BAC9F',
                L('Charts and small marks', 'الرسوم والعلامات الصغيرة')
              )}{' '}
              {swatch(L('Sage border', 'حدّ مريمي'), '#9BAC9F', L('Control outlines', 'حدود الضوابط'))}
            </Paged>{' '}
            <div className="divider" />{' '}
            <div className="row" style={{ gap: '10px', flexWrap: 'wrap' }}>
              <Status k="approved" />
              <Status k="failed" />
              <Status k="pending" />
              <Status k="awaiting-approval" />
              <Status k="open" />
              <Status k="sent" />
              <Status k="scheduled" />
              <Pill label={L('Paused', 'متوقّف')} tone="warning" mark="st-pause" />
            </div>{' '}
            <p className="t-caption dim" style={{ marginTop: '14px' }}>
              {L(
                'Status is never carried by colour alone: every status pill pairs an icon with a word, every alert pairs a tint with an icon and a heading.',
                'الحالة لا تُحمَل باللون وحده أبداً: كل شارة حالة تجمع أيقونة وكلمة، وكل تنبيه يجمع لوناً وأيقونة وعنواناً.'
              )}
            </p>
          </>
        )}
        {spec(
          L('Type', 'الخطّ'),
          L('Six sizes, two families', 'ستة أحجام وعائلتان'),
          <>
            <div className="tablescroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{L('Token', 'الرمز')}</th>
                    <th>{L('Inter / English', 'إنتر / إنكليزي')}</th>
                    <th>{L('Plex Arabic', 'بلكس عربي')}</th>
                    <th>{L('Spec', 'المواصفة')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['t-display', 'Saint Elias', 'مار الياس', '32 / 40 / 600'],
                    ['t-heading', 'Baptism register', 'سجل المعمودية', '24 / 32 / 600'],
                    ['t-sub', 'Counting session 214', 'جلسة العدّ ٢١٤', '20 / 28 / 600'],
                    [
                      't-body',
                      'Sunday 10:30 Mass, in the upper church.',
                      'قدّاس الأحد ١٠:٣٠ في الكنيسة العليا.',
                      '16 / 26 / 400'
                    ],
                    ['t-ui', 'Buttons, table cells, nav, inputs', 'الأزرار وخلايا الجدول والتنقل', '14 / 20 / 500'],
                    ['t-caption', 'Helper text, timestamps, hints.', 'نص مساعد وطوابع زمنية', '12 / 18 / 400']
                  ].map(([cls, en, ar, sp], i) => (
                    <tr key={i}>
                      <td>
                        <span className="mono t-caption">{cls}</span>
                      </td>
                      <td>
                        <span className={cls}>{en}</span>
                      </td>
                      <td>
                        <span className={cls} style={{ fontFamily: 'var(--arabic)' }}>
                          {ar}
                        </span>
                      </td>
                      <td>
                        <span className="mono t-caption dim">{sp}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>{' '}
            <div className="divider" />{' '}
            <div className="row" style={{ gap: '28px', flexWrap: 'wrap' }}>
              <div>
                <div className="t-caption dim">{L('Numerals', 'الأرقام')}</div>{' '}
                <div className="mono tnum" style={{ fontSize: '20px' }} dir="ltr">
                  1,240,000 · 04/10/2026
                </div>
              </div>{' '}
              <div>
                <div className="t-caption dim">{L('Weights in use', 'الأوزان المستعملة')}</div>{' '}
                <div style={{ fontSize: '16px' }}>
                  <span style={{ fontWeight: 400 }}>400</span> · <span style={{ fontWeight: 500 }}>500</span> ·{' '}
                  <span style={{ fontWeight: 600 }}>600</span>
                </div>
              </div>
            </div>{' '}
            <p className="t-caption dim" style={{ marginTop: '12px' }}>
              {L(
                'Tabular figures in every table, amount and register number, in both languages. Western digits throughout. No italics anywhere — italic Arabic does not exist.',
                'أرقام جدولية في كل جدول ومبلغ ورقم قيد، وباللغتين. أرقام غربية في كل مكان. ولا مائل في أي موضع — فالمائل العربي غير موجود.'
              )}
            </p>
          </>
        )}
        {spec(
          L('Space, radius, elevation', 'المسافة والاستدارة والارتفاع'),
          L('Everything lands on 8', 'كل شيء على مضاعفات ٨'),
          <>
            <div className="grid g3" style={{ gap: '24px' }}>
              <div>
                <div className="t-caption dim" style={{ marginBottom: '10px' }}>
                  {L('Spacing scale', 'سلّم المسافات')}
                </div>{' '}
                {[
                  [4, 'icon→label'],
                  [8, 'field→helper'],
                  [16, 'between fields'],
                  [24, 'card padding'],
                  [32, 'page gutter'],
                  [48, 'between sections'],
                  [64, 'page top/bottom']
                ].map(([n, u], i) => (
                  <div key={i} className="row" style={{ gap: '10px', marginBottom: '6px' }}>
                    <span className="mono t-caption" style={{ width: '26px' }}>
                      {n}
                    </span>{' '}
                    <span style={css(`height:8px;width:${n * 1.6}px;background:var(--primary);border-radius:2px`)} />{' '}
                    <span className="t-caption dimmer">{u}</span>
                  </div>
                ))}
              </div>{' '}
              <div>
                <div className="t-caption dim" style={{ marginBottom: '10px' }}>
                  {L('Radius', 'الاستدارة')}
                </div>{' '}
                {[
                  ['6px', 'inputs'],
                  ['10px', 'cards, buttons'],
                  ['14px', 'modals, drawers'],
                  ['999px', 'pills, avatars']
                ].map(([r, u], i) => (
                  <div key={i} className="row" style={{ gap: '10px', marginBottom: '8px' }}>
                    <span
                      style={css(
                        `width:34px;height:26px;border:1px solid var(--border-strong);border-radius:${r};background:var(--surface)`
                      )}
                    />{' '}
                    <span className="mono t-caption">{r}</span>
                    <span className="t-caption dimmer">{u}</span>
                  </div>
                ))}
              </div>{' '}
              <div>
                <div className="t-caption dim" style={{ marginBottom: '10px' }}>
                  {L('Elevation', 'الارتفاع')}
                </div>{' '}
                {[
                  ['0 · line', 'none', '1px border'],
                  ['1 · card', 'var(--e1)', 'cards'],
                  ['2 · menu', 'var(--e2)', 'menus, popovers'],
                  ['3 · modal', 'var(--e3)', 'modals']
                ].map(([n, sh, u], i) => (
                  <div key={i} className="row" style={{ gap: '10px', marginBottom: '10px' }}>
                    <span
                      style={css(
                        `width:34px;height:26px;border:1px solid var(--border);border-radius:6px;background:var(--surface);box-shadow:${sh}`
                      )}
                    />{' '}
                    <span className="t-caption">{n}</span>
                    <span className="t-caption dimmer">{u}</span>
                  </div>
                ))}
              </div>
            </div>{' '}
            <div className="divider" />{' '}
            <div className="row" style={{ gap: '28px', flexWrap: 'wrap' }}>
              {[
                [40, L('button height', 'ارتفاع الزرّ')],
                [40, L('input height', 'ارتفاع الحقل')],
                [44, L('min touch target', 'أصغر هدف لمس')],
                [48, L('table row', 'صف الجدول')],
                [64, L('top bar', 'الشريط العلوي')],
                [264, L('sidebar expanded', 'الشريط الموسّع')],
                [72, L('sidebar collapsed', 'الشريط المطوي')],
                [20, L('icon, 1.5 stroke', 'أيقونة، سماكة ١٫٥')]
              ].map(([n, u], i) => (
                <div key={i}>
                  <div className="mono" style={{ fontSize: '19px', fontVariantNumeric: 'tabular-nums' }}>
                    {n}
                  </div>{' '}
                  <div className="t-caption dim">{u}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    ),
    controls: () => (
      <>
        {spec(
          L('Buttons', 'الأزرار'),
          '40px · 10px radius · 14/500',
          <>
            <div className="row" style={{ gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" data-act="spec-save">
                {L('Save record', 'حفظ السجل')}
              </button>{' '}
              <button className="btn btn-secondary" data-act="spec-cancel">
                {L('Cancel', 'إلغاء')}
              </button>{' '}
              <button className="btn btn-ghost" data-go="people">
                {L('View all', 'عرض الكل')}
              </button>{' '}
              <button className="btn btn-danger" data-act="spec-delete">
                {L('Delete', 'حذف')}
              </button>{' '}
              <button className="btn btn-danger-quiet" data-act="archive-specimen">
                {L('Archive', 'أرشفة')}
              </button>{' '}
              <button className="btn btn-primary" disabled>
                {L('Disabled', 'معطّل')}
              </button>{' '}
              <button className="btn btn-primary" disabled aria-busy="true" style={{ opacity: 1 }}>
                <span className="spin" />
                {L('Saving…', 'يُحفظ…')}
              </button>
            </div>{' '}
            <div className="divider" />{' '}
            <div className="row" style={{ gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <C.SplitBtn label={L('New parishioner', 'مؤمن جديد')} id="sg1" />{' '}
              <C.BGroup items={[L('Month', 'شهر'), L('Week', 'أسبوع'), L('Day', 'يوم')]} sel={0} />{' '}
              <C.IconBtn ico="print" label={L('Print certificate', 'طباعة الشهادة')} data-act="print" />{' '}
              <C.IconBtn ico="trash" label={L('Archive', 'أرشفة')} data-act="archive-specimen" />
            </div>{' '}
            <div className="divider" />{' '}
            <div className="row" style={{ gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-secondary btn-dense" data-act="spec-save">
                32 {L('dense', 'كثيف')}
              </button>{' '}
              <button className="btn btn-secondary" data-act="spec-save">
                40 {L('default', 'افتراضي')}
              </button>{' '}
              <button className="btn btn-secondary btn-touch" data-act="spec-save">
                48 {L('touch', 'لمس')}
              </button>
            </div>
          </>
        )}
        {spec(
          L('Text fields', 'الحقول النصّية'),
          L('40px · 6px radius · label above, helper below', '٤٠ بكسل · استدارة ٦ · التسمية فوق والمساعدة تحت'),
          <>
            <div className="formgrid">
              <C.Field
                label={L('English name', 'الاسم الإنكليزي')}
                req={true}
                value="Georges Haddad"
                help={L('As it appears on the ID card.', 'كما يظهر على الهوية.')}
              />{' '}
              <C.Field
                label={L('English name', 'الاسم الإنكليزي')}
                req={true}
                value="G"
                state="error"
                help={L('Enter at least 2 characters.', 'أدخل حرفين على الأقل.')}
                helpTone="help-error"
              />{' '}
              <C.Field
                label={L('Envelope number', 'رقم المظروف')}
                value="0142"
                state="ok"
                help={L('Available.', 'متاح.')}
                helpTone="help-ok"
                tail={
                  <span style={{ color: 'var(--success)' }}>
                    <Icon name="check" size={16} />
                  </span>
                }
              />{' '}
              <C.Field
                label={L('English name', 'الاسم الإنكليزي')}
                value="Georges Haddad"
                state="disabled"
                help={L('Locked while the record is archived.', 'مقفل ما دام السجل مؤرشفاً.')}
              />{' '}
              <C.Field
                label={L('Envelope number', 'رقم المظروف')}
                value="0142"
                state="loading"
                help={L('Checking if this envelope is free…', 'يجري التحقّق من توفّر المظروف…')}
              />
            </div>{' '}
            <C.Textarea
              label={L('Pastoral note', 'ملاحظة رعوية')}
              id="sgta"
              max={500}
              value="Visited at home after the hospital stay. Asked for the parish to remember his mother at Sunday Mass."
              help={L('Visible to the priest only.', 'تظهر للكاهن وحده.')}
            />{' '}
            <div className="formgrid">
              <C.Stepper
                label={L('Seats in the hall', 'المقاعد في القاعة')}
                value={120}
                id="sgst"
                help={L('Steppers are 38px wide so a thumb can hit them.', 'أزرار الزيادة ٣٨ بكسل ليصلها الإبهام.')}
              />{' '}
              <div className="formrow">
                <label className="label">{L('Find a parishioner', 'ابحث عن مؤمن')}</label>{' '}
                <C.SearchClear ph={L('Searches Arabic and English name at once', 'يبحث في الاسمين معاً')} id="sgsc" />
              </div>
            </div>
          </>
        )}
        {spec(
          L('Choosing', 'الاختيار'),
          L('Every option row is 44px', 'كل صف خيار ٤٤ بكسل'),
          <>
            <div className="formgrid">
              <div className="formrow">
                <label className="label" htmlFor="sg_fund">
                  {L('Fund', 'الصندوق')}
                </label>{' '}
                <Select id="sg_fund">
                  {FUNDS.map((f, i) => (
                    <option key={i}>{L(f.name, f.ar)}</option>
                  ))}
                </Select>
              </div>{' '}
              <C.PersonPicker label={L('Person — autocomplete with avatar', 'شخص — إكمال تلقائي مع صورة')} id="sgpp" />
            </div>{' '}
            <C.ChipField
              label={L('Groups', 'المجموعات')}
              tags={[L('Choir', 'الجوقة'), L('Youth', 'الشبيبة'), L('Catechism G4', 'تعليم ٤')]}
            />{' '}
            <div className="divider" />{' '}
            <div className="grid g3" style={{ gap: '20px' }}>
              <div>
                <div className="t-caption dim" style={{ marginBottom: '10px' }}>
                  {L('Marital status', 'الحالة الاجتماعية')}
                </div>{' '}
                <div className="stack" style={{ gap: '8px' }}>
                  <C.CheckRow label={L('Married', 'متزوّج')} type="radio" checked={true} />{' '}
                  <C.CheckRow label={L('Single', 'أعزب')} type="radio" />{' '}
                  <C.CheckRow label={L('Widowed', 'أرمل')} type="radio" />{' '}
                  <C.CheckRow
                    label={L('Annulled', 'مُبطَل')}
                    type="radio"
                    note={L('needs a chancery record', 'يحتاج قيد المطرانية')}
                  />
                </div>
              </div>{' '}
              <div>
                <div className="t-caption dim" style={{ marginBottom: '10px' }}>
                  {L('Consent', 'الموافقة')}
                </div>{' '}
                <div className="stack" style={{ gap: '8px' }}>
                  <C.CheckRow label={L('Announcements on WhatsApp', 'الإعلانات على واتساب')} checked={true} />{' '}
                  <C.CheckRow label={L('Printed parish directory', 'الدليل المطبوع')} />{' '}
                  <C.CheckRow label={L('Some family members opted in', 'وافق بعض أفراد العائلة')} indet={true} />
                </div>
              </div>{' '}
              <div>
                <div className="t-caption dim" style={{ marginBottom: '10px' }}>
                  {L('Toggles', 'المفاتيح')}
                </div>{' '}
                <div className="stack" style={{ gap: '10px' }}>
                  <C.SwitchRow label={L('Show in member portal', 'الظهور في البوّابة')} checked={true} />{' '}
                  <C.SwitchRow label={L('Weekly giving digest', 'ملخّص التقدمات')} checked={true} />{' '}
                  <C.SwitchRow label={L('Card gateway', 'بوابة البطاقات')} note={L('not connected', 'غير موصولة')} />
                </div>
              </div>
            </div>
          </>
        )}
        {spec(
          L('Dates, time and uploads', 'التواريخ والوقت والرفع'),
          L('Gregorian, feast days marked', 'ميلادية، مع علامات الأعياد'),
          <>
            <div className="grid g2" style={{ gap: '24px', alignItems: 'start' }}>
              <div>
                <C.DatePicker y={2026} m={9} sel={4} />
              </div>{' '}
              <div>
                <C.TimeField />
                <C.DateRange />
              </div>
            </div>{' '}
            <div className="divider" />
            <C.Dropzone id="sgdz" specimen={true} /> <div className="divider" />
            <C.AvatarUpload /> <div className="divider" />
            <C.RichText />
          </>
        )}
        {spec(
          L('Dropdowns and menus', 'القوائم المنسدلة'),
          L('8px offset · 10px radius · elevation 2', 'إزاحة ٨ · استدارة ١٠ · ارتفاع ٢'),
          <>
            <div className="grid g3" style={{ gap: '20px', alignItems: 'start' }}>
              <C.FilterMenu
                title={L('Status', 'الحالة')}
                opts={[
                  [L('Active', 'نشط'), 1284, true],
                  [L('Visitor', 'زائر'), 96, true],
                  [L('Moved away', 'انتقل'), 41, false],
                  [L('Deceased', 'متوفّى'), 218, false],
                  [L('Archived', 'مؤرشف'), 7, false]
                ]}
              />{' '}
              <C.KebabMenu /> <C.RatePopover amount={50} />
            </div>{' '}
            <div className="divider" />
            <C.BulkBar n={14} /> <div className="divider" />{' '}
            <div className="grid g2" style={{ gap: '20px', alignItems: 'start' }}>
              <div>
                <div className="t-caption dim" style={{ marginBottom: '10px' }}>
                  {L('Searchable combobox — grouped, keyboard-driven', 'صندوق بحث — مجمَّع، بالكيبورد')}
                </div>{' '}
                <div className="ac-list" style={{ position: 'static', maxHeight: 'none' }}>
                  <div className="ac-group">{L('Sacraments', 'الأسرار')}</div>{' '}
                  <button className="ac-opt" aria-selected="true" data-go="sacraments">
                    <Icon name="sacr" size={17} />{' '}
                    <span>
                      <b>{L('Baptism register', 'سجل المعمودية')}</b>
                    </span>
                    <span className="kbd" style={{ marginInlineStart: 'auto' }}>
                      ↵
                    </span>
                  </button>{' '}
                  <button className="ac-opt" data-go="sacraments">
                    <Icon name="plus" size={17} />
                    <span>
                      <b>{L('New baptism record', 'قيد معمودية جديد')}</b>
                    </span>
                  </button>{' '}
                  <div className="ac-group">{L('Certificates', 'الشهادات')}</div>{' '}
                  <button className="ac-opt" data-go="certificate/sc1">
                    <Icon name="doc" size={17} />{' '}
                    <span>
                      <b>{L('Baptism certificate — Arabic', 'إفادة معمودية — عربي')}</b>
                    </span>
                  </button>
                </div>{' '}
                <p className="t-caption dimmer" style={{ marginTop: '8px' }}>
                  ↑↓ {L('move', 'تنقّل')} · ↵ {L('open', 'فتح')} · esc {L('close', 'إغلاق')}
                </p>
              </div>{' '}
              <div>
                <div className="t-caption dim" style={{ marginBottom: '10px' }}>
                  {L('Command palette', 'لوحة الأوامر')}
                </div>{' '}
                <button className="btn btn-secondary" id="sgcmd">
                  <Icon name="search" size={17} />
                  {L('Open it', 'افتحها')}{' '}
                  <span className="kbd" style={{ marginInlineStart: '6px' }}>
                    ⌘K
                  </span>
                </button>{' '}
                <p className="t-caption dimmer" style={{ marginTop: '8px' }}>
                  {L('Searches people, records, pages and actions.', 'تبحث في الأشخاص والسجلات والصفحات والإجراءات.')}
                </p>
              </div>
            </div>
          </>
        )}
      </>
    ),
    lebanon: () => (
      <>
        {spec(
          L('Currency — dual USD / LBP', 'العملة — دولار/ليرة'),
          L('The rate travels with the amount', 'السعر يسافر مع المبلغ'),
          <>
            <C.CurrencyField label={L('Amount', 'المبلغ')} value="1,250.00" stale={true} id="sgcur" />{' '}
            <C.SplitCurrency /> <div className="divider" />{' '}
            <div className="row" style={{ gap: '28px', flexWrap: 'wrap' }}>
              <Amount dollars={1250} showRate={true} cls="amount-lg" /> <Amount dollars={50} showRate={true} />{' '}
              <Amount dollars={50} cls="amount-sm" />
            </div>
          </>
        )}
        {spec(
          L('Phone — +961 prefix control', 'الهاتف — مقدّمة ‎+961'),
          '',
          <div className="formgrid">
            <C.PhoneField label={L('Mobile', 'الخلوي')} value="3 421 887" />{' '}
            <C.PhoneField label={L('Mobile', 'الخلوي')} value="3 421" state="error" id="sgph2" />
          </div>
        )}
        {spec(
          L('Address — cascading select', 'العنوان — اختيار متسلسل'),
          L('No postal code field exists', 'لا حقل رمز بريدي'),
          <C.AddressCascade />
        )}
        {spec(
          L('Bilingual name pair and rite', 'ثنائي الاسم والطقس'),
          L('Arabic is the record of truth', 'العربي هو سجل الحقيقة'),
          <>
            <C.NamePair />
            <C.RiteSelect />
          </>
        )}
        {spec(
          L('Channel order and direction', 'ترتيب القنوات والاتجاه'),
          '',
          <>
            <div className="row" style={{ gap: '10px', flexWrap: 'wrap' }}>
              <span className="chip chip-on">
                WhatsApp{' '}
                <span className="t-caption" style={{ marginInlineStart: '6px', opacity: '.75' }}>
                  {L('default', 'افتراضي')}
                </span>
              </span>{' '}
              <Icon name="arrowR" size={16} cls="dimmer" />
              <span className="chip">
                SMS{' '}
                <span className="t-caption" style={{ marginInlineStart: '6px', opacity: '.75' }}>
                  {L('fallback', 'احتياط')}
                </span>
              </span>{' '}
              <Icon name="arrowR" size={16} cls="dimmer" />
              <span className="chip">{L('Email — last', 'بريد — أخيراً')}</span>
            </div>{' '}
            <div className="divider" />{' '}
            <div className="row" style={{ gap: '10px' }}>
              <span className="chip mono" dir="ltr">
                dir=ltr
              </span>
              <span className="chip chip-on mono" dir="ltr">
                dir=rtl
              </span>
            </div>{' '}
            <p className="t-caption dim" style={{ marginTop: '12px' }}>
              {L(
                'Arabic mirrors the sidebar side, table column order, chart axis, drawer entry edge, chevrons and progress fill. Clocks, logos, media controls and the play triangle never flip. Numerals and amounts stay left-to-right in both.',
                'العربية تعكس جهة الشريط وترتيب الأعمدة ومحور الرسم وحافة الدرج والأسهم وامتلاء التقدّم. الساعات والشعارات وأزرار الوسائط ومثلّث التشغيل لا تنعكس أبداً. والأرقام والمبالغ تبقى من اليسار إلى اليمين.'
              )}
            </p>
          </>
        )}
      </>
    ),
    patterns: () => (
      <>
        {spec(
          L('Toasts and alerts', 'التنبيهات'),
          L('Every mutation toasts; reversible ones carry Undo', 'كل تعديل يُنبّه؛ والقابل للتراجع يحمل «تراجع»'),
          <>
            <div className="stack" style={{ gap: '10px' }}>
              <C.InlineAlert
                tone="warning"
                title={L('This family has two records', 'لهذه العائلة سجلّان')}
                body={L(
                  'Haddad (Hadath) and Hadad (Hadath) look like the same household.',
                  'يبدو أن «حدّاد» و«حداد» في الحدث العائلة نفسها.'
                )}
                actions={<button data-go="people/duplicates">{L('Compare and merge', 'قارن وادمج')}</button>}
              />{' '}
              <C.InlineAlert
                tone="warning"
                title={L('The hall is already booked at this time', 'القاعة محجوزة في هذا الوقت')}
                body={L(
                  'Catechism grade 4, Saturday 15:00–16:30. You can still save and let the two overlap.',
                  'تعليم مسيحي ٤، السبت ١٥:٠٠–١٦:٣٠. يمكنك الحفظ والسماح بالتداخل.'
                )}
              />{' '}
              <C.InlineAlert
                tone="danger"
                title={L('4 fields need attention before saving', '٤ حقول تحتاج انتباهاً قبل الحفظ')}
                body={L(
                  'Arabic name, date of birth, rite and the register page number.',
                  'الاسم العربي وتاريخ الولادة والطقس ورقم صفحة السجل.'
                )}
              />{' '}
              <C.InlineAlert
                tone="success"
                title={L('Second person has verified this batch', 'تحقّق شخص ثانٍ من هذه الدفعة')}
                body={L(
                  'Rita Nassar counted the same totals at 19:32. Ready to close.',
                  'عدّت ريتا نصّار المجاميع نفسها الساعة ١٩:٣٢.'
                )}
              />
            </div>{' '}
            <div className="divider" />{' '}
            <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-dense" id="tst1">
                {L('Toast — archived, with Undo', 'تنبيه — أُرشف، مع تراجع')}
              </button>{' '}
              <button className="btn btn-secondary btn-dense" id="tst2">
                {L('Toast — queued', 'تنبيه — في الانتظار')}
              </button>{' '}
              <button className="btn btn-secondary btn-dense" id="tst3">
                {L('Toast — saved locally', 'تنبيه — حُفظ محلياً')}
              </button>{' '}
              <button className="btn btn-secondary btn-dense" id="tst4">
                {L('Toast — send failed', 'تنبيه — فشل الإرسال')}
              </button>
            </div>
          </>
        )}
        {spec(
          L('Modals, drawers, guards', 'النوافذ والأدراج والحواجز'),
          '',
          <>
            <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" id="sgm1">
                {L('Confirmation modal', 'نافذة تأكيد')}
              </button>{' '}
              <button className="btn btn-secondary" id="sgm2">
                {L('Destructive — typed confirmation', 'حذف — تأكيد بالكتابة')}
              </button>{' '}
              <button className="btn btn-secondary" id="sgm3">
                {L('Side drawer — 420', 'درج جانبي — ٤٢٠')}
              </button>{' '}
              <button className="btn btn-secondary" id="sgm4">
                {L('Side drawer — 720', 'درج جانبي — ٧٢٠')}
              </button>{' '}
              <button className="btn btn-secondary" id="sgm5">
                {L('Unsaved-changes guard', 'حاجز التغييرات غير المحفوظة')}
              </button>
            </div>{' '}
            <div className="divider" />{' '}
            <div className="row" style={{ gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <C.IconBtn ico="print" label={L('Print certificate', 'طباعة الشهادة')} data-act="print" />{' '}
              <span className="t-caption dim">
                {L(
                  'Every icon-only button has a tooltip. 400ms delay.',
                  'كل زرّ أيقونة له تلميح. تأخير ٤٠٠ مللي ثانية.'
                )}
              </span>
            </div>
          </>
        )}
        {spec(
          L('Progress, spinner, skeleton', 'التقدّم والدوران والهيكل'),
          L('Skeletons mirror the real 48px row height', 'الهياكل تطابق ارتفاع الصف ٤٨ بكسل'),
          <>
            <div className="grid g3" style={{ gap: '20px', alignItems: 'start' }}>
              <div>
                <div className="t-caption dim" style={{ marginBottom: '8px' }}>
                  {L('Importing — step 3 of 4', 'الاستيراد — الخطوة ٣ من ٤')}
                </div>{' '}
                <span className="progress">
                  <i style={{ width: '60%' }} />
                </span>{' '}
                <div className="mono t-caption dim" style={{ marginTop: '6px' }}>
                  248 / 412
                </div>
              </div>{' '}
              <div>
                <div className="t-caption dim" style={{ marginBottom: '8px' }}>
                  {L('Budget consumed', 'الموازنة المستهلكة')}
                </div>{' '}
                <span className="progress accent">
                  <i style={{ width: '86%' }} />
                </span>
              </div>{' '}
              <div>
                <div className="t-caption dim" style={{ marginBottom: '8px' }}>
                  {L('Loading', 'جارٍ التحميل')}
                </div>{' '}
                <span className="spinner" />
              </div>
            </div>{' '}
            <div className="divider" />{' '}
            <div className="tablewrap">
              <C.SkeletonRows n={4} />
            </div>
          </>
        )}
        {spec(
          L('Empty, error, denied, offline', 'فارغ وخطأ وممنوع وبلا اتصال'),
          L('Four different problems, four different answers', 'أربع مشكلات وأربع إجابات'),
          <div className="grid g2" style={{ gap: '16px' }}>
            <div className="card card-flat">
              <Empty
                glyph="people"
                title={L('No parishioners yet', 'لا مؤمنين بعد')}
                body={L(
                  'Add the first household by hand, or bring in the existing list from a spreadsheet.',
                  'أضف العائلة الأولى يدوياً أو استورد اللائحة من جدول.'
                )}
                action={
                  <>
                    <button className="btn btn-primary btn-dense" data-act="record-new">
                      {L('New parishioner', 'مؤمن جديد')}
                    </button>{' '}
                    <button className="btn btn-secondary btn-dense" data-go="people/import">
                      {L('Import CSV', 'استيراد CSV')}
                    </button>
                  </>
                }
              />
            </div>{' '}
            <div className="card card-flat">
              <Empty
                glyph="search"
                title={L('Nothing matches those filters', 'لا شيء يطابق المرشّحات')}
                body={L(
                  'Status “Visitor”, town “Hadath” and last 30 days together return no one.',
                  'الحالة «زائر» والبلدة «الحدث» وآخر ٣٠ يوماً معاً لا تُرجع أحداً.'
                )}
                action={
                  <button className="btn btn-secondary btn-dense" data-act="spec-clear">
                    {L('Clear all filters', 'مسح كل المرشّحات')}
                  </button>
                }
              />
            </div>{' '}
            <div className="card card-flat">
              <Empty
                glyph="warn"
                title={L('This list could not be loaded', 'تعذّر تحميل اللائحة')}
                body={L(
                  'The server did not answer. Nothing you did caused it and nothing was lost.',
                  'لم يستجب الخادم. لم يتسبّب بذلك شيء فعلته ولم يضع شيء.'
                )}
                action={
                  <>
                    <button className="btn btn-secondary btn-dense" data-act="spec-retry">
                      {L('Try again', 'إعادة المحاولة')}
                    </button>{' '}
                    <span className="mono t-caption dimmer" style={{ display: 'block', marginTop: '8px' }}>
                      ref 8f21c4 · 09:41
                    </span>
                  </>
                }
              />
            </div>{' '}
            <div className="card card-flat">
              <Empty
                glyph="shield"
                title={L('Giving is not part of your role', 'التقدمات ليست ضمن دورك')}
                body={L(
                  'Only the treasurer and the parish priest can open financial records. Ask Fr. Antoine if you need access.',
                  'أمين الصندوق والكاهن وحدهما يفتحان السجلات المالية.'
                )}
                action={
                  <button className="btn btn-secondary btn-dense" data-go="dashboard">
                    {L('Back to dashboard', 'العودة إلى اللوحة')}
                  </button>
                }
              />
            </div>
          </div>
        )}
        {spec(
          L('Page furniture', 'أثاث الصفحة'),
          L('Breadcrumbs, entity header, tabs with counts', 'مسار وعنوان كيان وتبويبات بعدّاد'),
          <>
            <nav
              className="crumbs"
              style={{ display: 'flex', gap: '7px', font: '400 12px/16px var(--sans)', color: 'var(--text-2)' }}
            >
              <a href="#/people">{L('People', 'المؤمنون')}</a>
              <span className="sep">/</span> <a href="#/people">{L('Parishioners', 'المؤمنون')}</a>
              <span className="sep">/</span>
              <span>Georges Haddad</span>
            </nav>{' '}
            <div className="entityhead" style={{ marginTop: '12px' }}>
              <span className="avatar avatar-lg">GH</span>{' '}
              <div className="id">
                <h1 style={{ font: '600 24px/32px var(--sans)', letterSpacing: '-.02em' }}>
                  Georges Haddad <Status k="member" />
                  <span className="pill">{L('Maronite', 'ماروني')}</span>
                </h1>{' '}
                <div className="meta" style={{ fontFamily: 'var(--arabic)' }}>
                  جورج حدّاد · {L('Envelope', 'مظروف')} <span className="mono">0142</span> · {L('Hadath', 'الحدث')}
                </div>
              </div>{' '}
              <div className="acts">
                <button className="btn btn-secondary" data-act="person-edit:p1">
                  {L('Edit', 'تعديل')}
                </button>{' '}
                <button className="btn btn-primary" data-act="compose:p1">
                  {L('Message', 'رسالة')}
                </button>
              </div>
            </div>{' '}
            <div style={{ marginTop: '16px' }}>
              <TabBar
                base="styleguide/patterns"
                items={[
                  ['', 'Profile', 'الملف'],
                  ['x1', 'Family', 'العائلة'],
                  ['x2', 'Sacraments', 'الأسرار', 4],
                  ['x3', 'Giving', 'التقدمات'],
                  ['x4', 'Notes', 'ملاحظات']
                ]}
                active=""
              />
            </div>
          </>
        )}
      </>
    ),
    data: () => (
      <>
        {spec(
          L('Data table', 'جدول البيانات'),
          L(
            '48px rows · sticky header · sortable · expandable · hover actions',
            '٤٨ بكسل · رأس ثابت · قابل للفرز والتوسيع'
          ),
          <>
            {
              <Table
                pick={true}
                cols={[
                  { label: L('Name', 'الاسم'), sort: true },
                  { label: L('Town', 'البلدة'), sort: true },
                  { label: L('Envelope', 'المظروف'), cls: 'shrink' },
                  { label: L('Status', 'الحالة'), cls: 'shrink' },
                  { label: L('Last gift', 'آخر تقدمة'), cls: 'num' },
                  { label: '', cls: 'shrink' }
                ]}
                rows={[
                  ['p1', 'Hadath', '0142', 'member', 50],
                  ['p3', 'Hadath', '—', 'visitor', 0],
                  ['p4', 'Baabda', '0088', 'member', 120]
                ].map(([pid, town, env, st, gift]) => ({
                  detail: (
                    <div className="grid g4" style={{ gap: '20px' }}>
                      <dl className="dl">
                        <dt>{L('Household', 'العائلة')}</dt>
                        <dd>Nassar — 4 {L('members', 'أفراد')}</dd>
                      </dl>{' '}
                      <dl className="dl">
                        <dt>{L('Phone', 'الهاتف')}</dt>
                        <dd className="mono">+961 3 887 210</dd>
                      </dl>{' '}
                      <dl className="dl">
                        <dt>{L('Groups', 'المجموعات')}</dt>
                        <dd>{L('Choir, Counting team', 'الجوقة، فريق العدّ')}</dd>
                      </dl>{' '}
                      <dl className="dl">
                        <dt>{L('Attendance 12 mo', 'الحضور ١٢ شهراً')}</dt>
                        <dd>41 / 52</dd>
                      </dl>
                    </div>
                  ),
                  cells: [
                    <span className="row" style={{ gap: '6px' }}>
                      <C.IconBtn ico="chevR" label={L('Expand', 'توسيع')} data-expand="" aria-expanded="false" />
                      <Who p={person(pid)} />
                    </span>,
                    <span className="dim">{town}</span>,
                    <span className="mono">{env}</span>,
                    <Status k={st} />,
                    gift ? (
                      <>
                        <span className="num">{usd(gift)}</span>
                        <br />
                        <span className="num t-caption dim">{num(gift * RATE.value)}</span>
                      </>
                    ) : (
                      <span className="num dimmer">—</span>
                    ),
                    <span className="rowacts">
                      <C.IconBtn ico="msg" label={L('Message', 'مراسلة')} data-act={`compose:${pid}`} />
                      <C.IconBtn ico="dots" label={L('More', 'المزيد')} data-act={`person-menu:${pid}`} />
                    </span>
                  ]
                }))}
                foot={
                  <>
                    <span>1–3 {L('of', 'من')} 1,380</span>{' '}
                    <span className="savedview" style={{ marginInlineStart: 'auto' }}>
                      <Icon name="check" size={14} />
                      {L('Saved: Envelope holders', 'محفوظ: أصحاب المظاريف')}
                    </span>
                  </>
                }
              />
            }
          </>
        )}
        {spec(
          L('Display parts', 'أجزاء العرض'),
          '',
          <>
            <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <Status k="member" />
              <Status k="visitor" />
              <Status k="pending" />
              <Status k="failed" /> <span className="pill">{L('Archived', 'مؤرشف')}</span>
            </div>{' '}
            <div className="row" style={{ gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
              <span className="chip">{L('Maronite', 'ماروني')}</span>
              <span className="chip">{L('Choir', 'الجوقة')}</span>{' '}
              <span className="chip">{L('Envelope holder', 'صاحب مظروف')}</span>{' '}
              <button className="btn btn-ghost btn-dense" data-act="tag-add">
                + {L('Add tag', 'إضافة وسم')}
              </button>
            </div>{' '}
            <div className="divider" />{' '}
            <div className="row" style={{ gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="avatar-stack">
                {['p1', 'p4', 'p3'].map((i, k) => (
                  <span key={k} className="avatar">
                    {person(i)
                      .lat.split(' ')
                      .map(x => x[0])
                      .slice(0, 2)}
                  </span>
                ))}{' '}
                <span className="avatar" style={{ background: 'var(--muted)', color: 'var(--text-2)' }}>
                  +9
                </span>
              </span>{' '}
              {['avatar-sm', '', 'avatar-lg', 'avatar-xl'].map((c, i) => (
                <span key={i} className={`avatar ${c}`}>
                  GH
                </span>
              ))}
            </div>
          </>
        )}
        {spec(
          L('KPI, sparkline, bar and donut', 'المؤشرات والرسوم'),
          L('RTL flips the axis', 'العربية تعكس المحور'),
          <>
            <div className="grid g3" style={{ gap: '16px' }}>
              <C.Kpi
                k={L('Given this month', 'المعطى هذا الشهر')}
                v={usd(8420)}
                sub={`L.L ${num(8420 * RATE.value)}`}
                delta={L('+12% vs Sept', '+١٢٪ عن أيلول')}
                spark={GIVING_SERIES}
              />{' '}
              <C.Kpi
                k={L('Group meeting attendance', 'حضور اجتماعات المجموعات')}
                v="86%"
                sub={L('illustrative component data', 'بيانات توضيحية للمكوّن')}
                spark={ATTENDANCE_SERIES}
              />{' '}
              <C.Kpi
                k={L('Volunteers active', 'متطوّعون نشطون')}
                v="96"
                sub={L('this quarter', 'هذا الفصل')}
                delta={L('−4 on last quarter', '−٤ عن الفصل الماضي')}
                dir="down"
              />
            </div>{' '}
            <div className="divider" />{' '}
            <div className="grid g2" style={{ gap: '24px', alignItems: 'start' }}>
              <div>
                <div className="t-caption dim" style={{ marginBottom: '12px' }}>
                  {L('Budget vs actual, by fund', 'الموازنة مقابل الفعلي')}
                </div>{' '}
                <C.BarChart rows={FUNDS.map(f => ({ label: L(f.name, f.ar), v: f.actual, max: f.budget }))} />
              </div>{' '}
              <div>
                <div className="t-caption dim" style={{ marginBottom: '12px' }}>
                  {L('How people give', 'كيف يُعطي الناس')}
                </div>{' '}
                <C.Donut segments={PAYMENT_MIX.map(p => ({ ...p, label: isAr() ? p.labelAr : p.label }))} />
              </div>
            </div>
          </>
        )}
        {spec(
          L('Key-value list and activity timeline', 'قائمة مفتاح-قيمة وسجل النشاط'),
          '',
          <div className="grid g2" style={{ gap: '24px', alignItems: 'start' }}>
            <dl className="dl">
              <dt>{L('Arabic name', 'الاسم العربي')}</dt>
              <dd style={{ fontFamily: 'var(--arabic)' }}>جورج حدّاد</dd>
              <dt>{L('Rite', 'الطقس')}</dt>
              <dd>{L('Maronite', 'ماروني')}</dd>
              <dt>{L('Born', 'الولادة')}</dt>
              <dd className="mono">12 / 03 / 1958</dd>
              <dt>{L('Phone', 'الهاتف')}</dt>
              <dd className="mono">+961 3 421 887</dd>
              <dt>{L('Envelope', 'المظروف')}</dt>
              <dd className="mono">0142</dd>
            </dl>{' '}
            <div className="timeline">
              <div className="tl-item accent">
                <div className="when">{L('Today, 19:12', 'اليوم ١٩:١٢')}</div>{' '}
                <div className="what">
                  <b>Rita Nassar</b> {L('recorded $50.00 in session 214', 'سجّلت 50.00$ في الجلسة ٢١٤')}
                </div>
              </div>{' '}
              <div className="tl-item">
                <div className="when">2 Oct 2026, 11:40</div>{' '}
                <div className="what">
                  {L(
                    'Baptism certificate printed in Arabic · Book 12, page 84',
                    'طُبعت إفادة المعمودية بالعربية · دفتر ١٢، صفحة ٨٤'
                  )}
                </div>
              </div>{' '}
              <div className="tl-item">
                <div className="when">28 Sep 2026</div>{' '}
                <div className="what">
                  {L(
                    'Phone number changed from 03 421 880 · by the secretary',
                    'تغيّر رقم الهاتف · بواسطة أمانة السرّ'
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )
  };
  return (
    <>
      {head}
      {(T[tab] || T[''])()}
    </>
  );
}

styleguide.mount = host => {
  const T = {
    tst1: () =>
      toast(
        L('Georges Haddad was archived', 'أُرشف جورج حدّاد'),
        L('Removed from lists and messaging. Records kept.', 'أُزيل من اللوائح والمراسلة. والسجلات محفوظة.')
      ),
    tst2: () =>
      toast(
        L('Statement queued for 412 households', 'كشف في الانتظار لـ٤١٢ عائلة'),
        L('You will be told when the PDFs are ready.', 'ستُبلَّغ عندما تجهز الملفات.'),
        'success'
      ),
    tst3: () =>
      toast(
        L('Saved on this computer only', 'حُفظ على هذا الحاسوب فقط'),
        L('It will sync when the connection returns.', 'سيُزامَن عند عودة الاتصال.'),
        'warning'
      ),
    tst4: () =>
      toast(
        L('18 of 412 WhatsApp messages failed', 'فشل ١٨ من ٤١٢ رسالة'),
        L('Numbers not registered on WhatsApp.', 'أرقام غير مسجّلة على واتساب.'),
        'danger'
      )
  };
  Object.entries(T).forEach(([id, fn]) => host.querySelector('#' + id)?.addEventListener('click', fn));
  host.querySelector('#sgm1')?.addEventListener('click', () =>
    openModal({
      title: L('Archive Georges Haddad?', 'أرشفة جورج حدّاد؟'),
      body: (
        <p className="t-body dim" style={{ fontSize: '14px', lineHeight: '22px' }}>
          {L(
            'He will disappear from lists, groups and messaging. Sacrament records, giving history and certificates are all kept and can be restored at any time.',
            'سيختفي من اللوائح والمجموعات والمراسلة. وتبقى سجلات الأسرار وتاريخ التقدمات والشهادات محفوظة وقابلة للاسترجاع في أي وقت.'
          )}
        </p>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>{' '}
          <button className="btn btn-danger" style={{ marginInlineStart: 'auto' }} data-act="archive-specimen">
            {L('Archive', 'أرشفة')}
          </button>
        </>
      )
    })
  );
  host.querySelector('#sgm2')?.addEventListener('click', () => deleteGuard(person('p1'), { dry: true }));
  host.querySelector('[data-split="sg1"]')?.addEventListener('click', newPersonDrawer);
  host.querySelector('[data-splitmenu="sg1"]')?.addEventListener('click', e =>
    openMenu(
      e.currentTarget,
      [
        { label: L('New parishioner', 'مؤمن جديد'), icon: 'people', fn: newPersonDrawer },
        { label: L('New household', 'عائلة جديدة'), icon: 'family', fn: () => CR.create('household') },
        { label: L('Import CSV', 'استيراد CSV'), icon: 'export', fn: () => go('people/import') }
      ],
      { width: 220 }
    )
  );
  host.querySelector('#sgm3')?.addEventListener('click', () =>
    openDrawer({
      title: L('New contribution', 'مساهمة جديدة'),
      sub: L('Session 214 · envelope entry', 'الجلسة ٢١٤ · إدخال مظروف'),
      body: (
        <>
          {<C.Field label={L('Envelope no.', 'رقم المظروف')} value="0142" dir="ltr" />}{' '}
          {<C.PersonPicker label={L('Given by', 'المتبرّع')} id="sgd3" />}{' '}
          {<C.CurrencyField label={L('Amount', 'المبلغ')} value="50.00" id="sgd3c" />}
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>{' '}
          <span className="t-caption dim" style={{ marginInlineStart: 'auto' }}>
            {L('Draft saved', 'حُفظت المسوّدة')}
          </span>{' '}
          <button className="btn btn-primary" data-act="env-add">
            {L('Save & add next', 'حفظ وإضافة التالي')}
          </button>
        </>
      ),
      onMount(el) {}
    })
  );
  host.querySelector('#sgm4')?.addEventListener('click', () =>
    openDrawer({
      large: true,
      title: L('Large drawer — 720', 'درج كبير — ٧٢٠'),
      sub: L(
        'Used where a form needs two columns or a preview sits beside the fields.',
        'يُستعمل حين تحتاج الاستمارة عمودين أو معاينة إلى جانب الحقول.'
      ),
      body: (
        <>
          <div className="formgrid">
            <C.Field label={L('Arabic name', 'الاسم العربي')} ar={true} dir="rtl" />{' '}
            <C.Field label={L('English name', 'الاسم الإنكليزي')} />
          </div>
          <C.AddressCascade />
        </>
      ),
      foot: (
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>
      ),
      onMount(el) {}
    })
  );
  host.querySelector('#sgm5')?.addEventListener('click', () =>
    openModal({
      title: L('Leave without saving?', 'المغادرة بلا حفظ؟'),
      body: (
        <p className="t-body dim" style={{ fontSize: '14px', lineHeight: '22px' }}>
          {L(
            'You changed the Arabic name and the rite. A draft is kept on this computer for 7 days.',
            'غيّرتَ الاسم العربي والطقس. وتُحفظ مسوّدة على هذا الحاسوب ٧ أيام.'
          )}
        </p>
      ),
      foot: (
        <>
          <button className="btn btn-danger-quiet" data-close="">
            {L('Discard', 'تجاهل')}
          </button>{' '}
          <button className="btn btn-secondary" data-close="">
            {L('Keep editing', 'متابعة التعديل')}
          </button>{' '}
          <button className="btn btn-primary" style={{ marginInlineStart: 'auto' }} data-act="save">
            {L('Save & leave', 'حفظ ومغادرة')}
          </button>
        </>
      )
    })
  );
  host
    .querySelector('#sgcmd')
    ?.addEventListener('click', () =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
    );
};
