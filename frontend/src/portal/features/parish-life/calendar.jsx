/* The parish calendar: month, week and list views of every event, the event drawer (time, place,
   clashes, visibility) and event templates. */
import { Select } from '../../ui/components.jsx';
import { css, nodesOr, paint } from '../../ui/html.js';
import { CalendarView } from '../../ui/collection.jsx';
import { t, fmtDate, fmtLong, dayShort } from '../../../lib/i18n.js';
import { is, S, go, bus } from '../../model/store.js';
import {
  Icon,
  PageHead,
  Panel,
  Status,
  Pill,
  Table,
  openDrawer,
  openModal,
  closeOverlays,
  toast,
  Avatar,
  openMenu
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { need } from '../../shared/dialogs.jsx';
import { printWeekDialog, priestScheduleDialog } from './schedules.jsx';
import {
  EVENTS,
  EVENT_DETAIL,
  PEOPLE,
  FEASTS,
  GROUPS,
  eventInfo,
  REGISTRATIONS,
  VENUES,
  TODAY,
  EVENT_TEMPLATES,
  person,
  venue
} from '../../model/data.js';
import { addMin, byTime, iso } from './parish-life-shared.jsx';

/* Month shown on the calendar: October 2026 moved by the prev / next buttons. */
const calMonth = () => {
  const d = new Date(2026, 9 + S.ui.calOffset, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};

const L = (en, ar) => t(en, ar);

/* the kinds of entry the calendar can show; the chips switch each on and off */
const CAL_KINDS = [
  ['mass', 'Masses', 'القداديس'],
  ['event', 'Parish events', 'أحداث الرعية'],
  ['group', 'Groups', 'المجموعات'],
  ['sacr', 'Sacraments', 'الأسرار'],
  ['pending', 'Reservations', 'الحجوزات']
];

const calEvents = () => EVENTS.filter(e => !(S.ui.calOff || []).includes(e.kind));

export function calendar(tab = '') {
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Parish life', 'حياة الرعية') }, { label: L('Calendar', 'الرزنامة') }]}
        title={L('Calendar', 'الرزنامة')}
        sub={L(
          'One event system with filtered views — personal, group, parish, facility and eparchy. Pending reservations are shown only to those allowed to see them.',
          'نظام أحداث واحد بعروض مرشّحة — شخصي ومجموعة ورعية ومرفق وأبرشية. الحجوزات المعلّقة تظهر فقط لمن يحقّ له.'
        )}
        actions={
          <>
            {is('priest') ? (
              <button className="btn btn-secondary" id="priest-schedule">
                <Icon name="print" size={17} />
                {L('Priest schedule', 'جدول الكهنة')}
              </button>
            ) : (
              ''
            )}{' '}
            <button className="btn btn-secondary" id="printweek">
              <Icon name="print" size={17} />
              {L('Print my schedule', 'اطبع جدولي')}
            </button>{' '}
            <button className="btn btn-secondary" id="subscribe">
              <Icon name="link" size={17} />
              {L('Subscribe', 'اشتراك')}
            </button>{' '}
            {is('priest', 'secretary', 'bishop') ? <C.SplitBtn label={L('New event', 'حدث جديد')} id="newev" /> : ''}
          </>
        }
      />
      <div className="collection-toolbar">
        <a className="btn btn-secondary" href="#/calendar">
          {L('Calendar', 'الرزنامة')}
        </a>
        <a className="btn btn-secondary" href="#/calendar/templates">
          {L('Templates', 'القوالب')}
        </a>
      </div>
    </>
  );
  if (tab !== 'templates') {
    S.ui.sharedCalendar ||= { mode: tab === 'week' ? 'week' : tab === 'agenda' ? 'list' : 'month' };
    return (
      <>
        {head}
        <div data-unified-calendar="">
          <CalendarView
            events={calEvents().map(e => ({ ...e, date: e.d, time: e.t, title: L(e.title, e.titleAr) }))}
            state={S.ui.sharedCalendar}
            onOpen={id => eventDrawer(id)}
          />
        </div>
      </>
    );
  }
  const filters = (
    <div className="toolbar" style={{ margin: '20px 0 16px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <C.IconBtn ico="chevL" label={L('Previous month', 'الشهر السابق')} data-act="cal-prev" />{' '}
        <button className="btn btn-secondary btn-dense" data-act="cal-today">
          {L('Today', 'اليوم')}
        </button>{' '}
        <C.IconBtn ico="chevR" label={L('Next month', 'الشهر التالي')} data-act="cal-next" />
      </div>{' '}
      <div
        className="chipset"
        role="group"
        aria-label={L('Show on the calendar', 'اعرض على الرزنامة')}
        style={{ marginInlineStart: 'auto' }}
      >
        {CAL_KINDS.map(([k, en, ar], i) => {
          const on = !(S.ui.calOff || []).includes(k);
          return (
            <button key={i} className={`chip ${on ? 'chip-on' : ''}`} aria-pressed={on} data-act={`cal-kind:${k}`}>
              {on ? <Icon name="check" size={13} /> : ''}
              {L(en, ar)}
            </button>
          );
        })}
      </div>
    </div>
  );
  if (tab === 'templates')
    return (
      <>
        {head}
        <div className="toolbar" style={{ margin: '16px 0' }}>
          <p className="t-caption dim">
            {L(
              'Templates set defaults for new events. Existing events stay independent.',
              'تحدّد القوالب إعدادات الأحداث الجديدة. تبقى الأحداث الحالية مستقلة.'
            )}
          </p>{' '}
          {is('priest', 'secretary', 'bishop') ? (
            <button className="btn btn-primary btn-dense" data-event-template-new="">
              <Icon name="plus" size={15} />
              {L('New template', 'قالب جديد')}
            </button>
          ) : (
            ''
          )}
        </div>{' '}
        <Table
          cols={[
            { label: L('Template', 'القالب') },
            { label: L('Category', 'الفئة') },
            { label: L('Room / duration', 'القاعة / المدة') },
            { label: '', cls: 'shrink' }
          ]}
          rows={EVENT_TEMPLATES.map(tpl => ({
            cells: [
              <b>{L(tpl.name, tpl.nameAr)}</b>,
              tpl.kind,
              `${L(venue(tpl.venue)?.name || '', venue(tpl.venue)?.ar || '')} · ${Number(tpl.duration) || 60} ${L('min', 'د')}`,
              <span className="row" style={{ gap: '6px' }}>
                {is('priest', 'secretary', 'bishop') ? (
                  <>
                    <button className="btn btn-secondary btn-dense" data-tpl-use={tpl.id}>
                      {L('Use', 'استعمال')}
                    </button>{' '}
                    <C.IconBtn ico="edit" label={L('Edit template', 'تعديل القالب')} data-tpl-edit={tpl.id} />
                    <C.IconBtn ico="trash" label={L('Delete template', 'حذف القالب')} data-tpl-delete={tpl.id} />
                  </>
                ) : (
                  ''
                )}
              </span>
            ]
          }))}
        />
      </>
    );
  if (tab === 'agenda')
    return (
      <>
        {head}
        {filters}
        <Table
          cols={[
            { label: L('When', 'الموعد') },
            { label: L('Event', 'الحدث') },
            { label: L('Where', 'المكان'), cls: 'hide-sm' },
            { label: L('Kind', 'النوع'), cls: 'shrink' },
            { label: '', cls: 'shrink' }
          ]}
          rows={calEvents()
            .sort(byTime)
            .map(e => ({
              cells: [
                <span className="mono dim">
                  {fmtDate(e.d)} {e.t}
                </span>,
                <b>{L(e.title, e.titleAr)}</b>,
                <span className="dim">{L(venue(e.venue).name, venue(e.venue).ar)}</span>,
                e.kind === 'pending' ? <Status k="pending" /> : <Pill label={L(e.kind, e.kind)} />,
                <button className="btn btn-secondary btn-dense" data-ev={e.id}>
                  {L('Open', 'فتح')}
                </button>
              ]
            }))}
        />
      </>
    );

  /* day — the same event chip as the week, laid on an hour grid */
  if (tab === 'day') {
    const key = S.ui.calDay || iso(TODAY),
      evs = calEvents()
        .filter(e => e.d === key)
        .sort(byTime);
    const H0 = 7,
      ROW = 56,
      feast = FEASTS[key];
    const top = hm => {
      const [h, mi] = hm.split(':').map(Number);
      return (h - H0 + mi / 60) * ROW;
    };
    const mins = e => (e.kind === 'mass' ? 60 : e.kind === 'sacr' ? 90 : 75); // ponytail: events carry no end time yet; typical length by kind
    const rooms = [...new Set(evs.map(e => e.venue))].map(venue);
    return (
      <>
        {head}
        <div className="toolbar" style={{ margin: '20px 0 16px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <C.IconBtn ico="chevL" label={L('Previous day', 'اليوم السابق')} data-act="cal-day:-1" />{' '}
            <button className="btn btn-secondary btn-dense" data-act="cal-day:0">
              {L('Today', 'اليوم')}
            </button>{' '}
            <C.IconBtn ico="chevR" label={L('Next day', 'اليوم التالي')} data-act="cal-day:1" />
          </div>{' '}
          <b className="dv-title">{fmtLong(key)}</b>
        </div>{' '}
        <div className="splitview">
          <div className="cal dayview" style={css(`--row:${ROW}px`)}>
            {Array.from({ length: 15 }, (_, i) => (
              <div className="dv-h">
                <span>{String(H0 + i).padStart(2, '0')}:00</span>
              </div>
            ))}{' '}
            <div className="dv-track">
              {evs.map((e, i) => (
                <button
                  key={i}
                  className={`cal-ev dv-ev ${e.kind === 'mass' ? 'mass' : e.kind === 'pending' ? 'pending' : ''}`}
                  data-ev={e.id}
                  style={css(`top:${top(e.t) + 2}px;height:${(mins(e) / 60) * ROW - 4}px`)}
                >
                  <span className="row" style={{ gap: '6px' }}>
                    <span className="t">{e.t}</span>
                    <b>{L(e.title, e.titleAr)}</b>
                  </span>{' '}
                  <small>
                    {L(venue(e.venue).name, venue(e.venue).ar)} · {mins(e)} {L('min', 'د')}
                  </small>
                </button>
              ))}
            </div>
          </div>{' '}
          <div className="sidecol">
            <Panel title={L('This day', 'هذا اليوم')}>
              {feast ? (
                <div className="row" style={{ gap: '8px', marginBottom: '12px' }}>
                  <span className="feastdot" />
                  <b style={{ font: '500 14px/20px var(--sans)' }}>{L(...feast)}</b>
                </div>
              ) : (
                ''
              )}{' '}
              <dl className="dl">
                <dt>{L('Events', 'الأحداث')}</dt>
                <dd className="mono">{evs.length}</dd>
                <dt>{L('Awaiting approval', 'بانتظار الموافقة')}</dt>
                <dd className="mono">{evs.filter(e => e.kind === 'pending').length}</dd>
                <dt>{L('Rooms in use', 'القاعات المستخدمة')}</dt>
                <dd>{rooms.length ? rooms.map(v => L(v.name, v.ar)).join(', ') : '—'}</dd>
              </dl>{' '}
              <button className="btn btn-secondary" id="newday" style={{ width: '100%', marginTop: '16px' }}>
                <Icon name="plus" size={17} />
                {L('New event this day', 'حدث جديد في هذا اليوم')}
              </button>
            </Panel>
          </div>
        </div>
      </>
    );
  }
  if (tab === 'week') {
    const days = [4, 5, 6, 7, 8, 9, 10].map(d => new Date(2026, 9, d));
    return (
      <>
        {head}
        {filters}
        <div className="cal">
          <div className="cal-head">
            {days.map((d, i) => (
              <div key={i}>
                {dayShort(d.getDay())} {d.getDate()}
              </div>
            ))}
          </div>{' '}
          <div className="cal-grid">
            {days.map((d, i) => {
              const evs = calEvents()
                .filter(e => e.d === iso(d))
                .sort(byTime);
              return (
                <div key={i} className="cal-day" style={{ minHeight: '280px' }}>
                  {nodesOr(
                    evs.map((e, i) => (
                      <span
                        key={i}
                        className={`cal-ev ${e.kind === 'mass' ? 'mass' : e.kind === 'pending' ? 'pending' : ''}`}
                        data-ev={e.id}
                      >
                        <span className="t">{e.t}</span>
                        {L(e.title, e.titleAr)}
                      </span>
                    )),
                    <span className="t-caption dimmer">{L('Nothing', 'لا شيء')}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  /* month */
  const { y, m } = calMonth();
  const first = new Date(y, m, 1),
    days = new Date(y, m + 1, 0).getDate(),
    lead = first.getDay();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push({ d: new Date(y, m, -(lead - i - 1)), out: true });
  for (let i = 1; i <= days; i++) cells.push({ d: new Date(y, m, i), out: false });
  while (cells.length % 7) cells.push({ d: new Date(y, m + 1, cells.length - days - lead + 1), out: true });
  const grid = cells.map(({ d, out }, i) => {
    const key = iso(d),
      evs = calEvents()
        .filter(e => e.d === key)
        .sort(byTime),
      feast = FEASTS[key],
      today = key === iso(TODAY);
    return (
      <div key={i} className={`cal-day ${out ? 'out' : ''} ${today ? 'today' : ''}`}>
        <button className="dn" data-day={key} aria-label={fmtLong(key)}>
          {d.getDate()}
          {feast && !today ? <span className="feast" /> : ''}
        </button>{' '}
        {feast && !out ? (
          <span className="t-caption" style={{ color: 'var(--accent)', fontSize: '10px', lineHeight: '14px' }}>
            {L(...feast)}
          </span>
        ) : (
          ''
        )}{' '}
        {evs.slice(0, 3).map((e, i) => (
          <span
            key={i}
            className={`cal-ev ${e.kind === 'mass' ? 'mass' : e.kind === 'pending' ? 'pending' : ''}`}
            data-ev={e.id}
            title={L(e.title, e.titleAr)}
          >
            <span className="t">{e.t}</span>
            {L(e.title, e.titleAr)}
          </span>
        ))}{' '}
        {evs.length > 3 ? <span className="cal-more">+{evs.length - 3}</span> : ''}
      </div>
    );
  });
  return (
    <>
      {head}
      {filters}
      <div className="cal">
        <div className="cal-head">
          {[0, 1, 2, 3, 4, 5, 6].map((i, k) => (
            <div key={k}>{dayShort(i)}</div>
          ))}
        </div>{' '}
        <div className="cal-grid">{grid}</div>
      </div>{' '}
      <div className="row cal-legend" style={{ gap: '20px', marginTop: '16px', flexWrap: 'wrap' }}>
        {[
          ['mass', L('Mass', 'قدّاس')],
          ['', L('Parish event', 'حدث رعوي')],
          ['pending', L('Pending reservation — holds the slot', 'حجز معلّق — يحجز الوقت')]
        ].map(([cls, lbl], i) => (
          <span key={i} className="row" style={{ gap: '7px' }}>
            <span className={`cal-ev cal-sw ${cls}`} /> <span className="t-caption dim">{lbl}</span>
          </span>
        ))}{' '}
        <span className="row" style={{ gap: '7px' }}>
          <span className="feastdot" style={{ width: '7px', height: '7px' }} />{' '}
          <span className="t-caption dim">{L('Feast day (Maronite calendar)', 'يوم عيد (الرزنامة المارونية)')}</span>
        </span>
      </div>
    </>
  );
}

calendar.mount = host => {
  host.querySelector('#priest-schedule')?.addEventListener('click', priestScheduleDialog);
  host.querySelectorAll('[data-ev]').forEach(el => el.addEventListener('click', () => eventDrawer(el.dataset.ev)));
  host.querySelector('[data-split="newev"]')?.addEventListener('click', () => eventDrawer(null, true));
  host
    .querySelector('#newday')
    ?.addEventListener('click', () => eventDrawer(null, true, { d: S.ui.calDay || iso(TODAY) }));
  host.querySelectorAll('[data-day]').forEach(b =>
    b.addEventListener('click', () => {
      S.ui.calDay = b.dataset.day;
      go('calendar/day');
    })
  );
  host.querySelector('[data-event-template-new]')?.addEventListener('click', () => eventTemplateDrawer());
  host
    .querySelectorAll('[data-tpl-edit]')
    .forEach(b => b.addEventListener('click', () => eventTemplateDrawer(b.dataset.tplEdit)));
  host
    .querySelectorAll('[data-tpl-delete]')
    .forEach(b => b.addEventListener('click', () => deleteEventTemplate(b.dataset.tplDelete)));
  host
    .querySelectorAll('[data-tpl-use]')
    .forEach(b => b.addEventListener('click', () => useEventTemplate(b.dataset.tplUse)));
  host
    .querySelector('[data-splitmenu="newev"]')
    ?.addEventListener('click', e =>
      openMenu(
        e.currentTarget,
        [
          { head: L('Start from a template', 'ابدأ من قالب') },
          ...EVENT_TEMPLATES.map(tpl => ({
            label: L(tpl.name, tpl.nameAr),
            icon: tpl.icon,
            fn: () => useEventTemplate(tpl.id)
          })),
          { sep: true },
          { label: L('Manage templates', 'إدارة القوالب'), icon: 'settings', fn: () => go('calendar/templates') }
        ],
        { width: 240 }
      )
    );
  host.querySelector('#subscribe')?.addEventListener('click', () =>
    openModal({
      title: L('Subscribe to this calendar', 'الاشتراك بهذه الرزنامة'),
      sub: L(
        'Export or subscribe first; provider sync comes later, once update and cancellation behaviour is proven.',
        'التصدير والاشتراك أولاً؛ والمزامنة مع المزوّدين لاحقاً بعد إثبات سلوك التحديث والإلغاء.'
      ),
      body: (
        <>
          <div className="formrow">
            <label className="label" htmlFor="cal_ics">
              {L('Subscription link (iCal)', 'رابط الاشتراك (iCal)')}
            </label>{' '}
            <input
              id="cal_ics"
              className="input mono"
              readOnly
              dir="ltr"
              defaultValue="webcal://parishlife.app/saint-elias/cal.ics"
            />
          </div>{' '}
          <div className="stack" style={{ gap: '10px' }}>
            <C.CheckRow label={L('Masses and services', 'القداديس والخدم')} checked={true} />{' '}
            <C.CheckRow label={L('My volunteer assignments', 'مناوباتي')} checked={true} />{' '}
            <C.CheckRow label={L('Private group meetings', 'اجتماعات المجموعات الخاصة')} />
          </div>{' '}
          <div className="divider" />{' '}
          <div className="row" style={{ gap: '8px' }}>
            <button className="btn btn-secondary btn-dense" data-act="export">
              {L('Download .ics', 'تنزيل .ics')}
            </button>{' '}
            <button className="btn btn-secondary btn-dense" data-act="ics">
              {L('Google Calendar', 'رزنامة غوغل')}
            </button>{' '}
            <button className="btn btn-secondary btn-dense" data-act="ics">
              {L('Outlook', 'أوتلوك')}
            </button>
          </div>
        </>
      )
    })
  );
  host.querySelector('#printweek')?.addEventListener('click', printWeekDialog);
};

function useEventTemplate(id) {
  const tpl = EVENT_TEMPLATES.find(x => x.id === id);
  if (!tpl) return;
  const date = S.ui.calDay || iso(TODAY);
  eventDrawer(null, true, {
    title: tpl.name,
    titleAr: tpl.nameAr,
    kind: tpl.kind,
    venue: tpl.venue,
    d: date,
    t: '12:00',
    to: addMin('12:00', Number(tpl.duration) || 60),
    templateId: id
  });
}

function eventTemplateDrawer(id) {
  const tpl = EVENT_TEMPLATES.find(x => x.id === id);
  openDrawer({
    title: tpl ? L('Edit calendar template', 'تعديل قالب الرزنامة') : L('New calendar template', 'قالب رزنامة جديد'),
    sub: L('Changes affect future events only.', 'تؤثر التغييرات في الأحداث المستقبلية فقط.'),
    body: (
      <>
        <C.Field label={L('Name', 'الاسم')} req={true} id="ct_name" value={tpl?.name || ''} />{' '}
        <C.Field label={L('Arabic name', 'الاسم العربي')} id="ct_ar" value={tpl?.nameAr || ''} />{' '}
        <div className="formgrid">
          <div className="formrow">
            <label className="label" htmlFor="ct_kind">
              {L('Category', 'الفئة')}
            </label>
            <Select defaultValue={tpl?.kind} id="ct_kind">
              {[
                ['event', 'Parish event', 'حدث رعوي'],
                ['mass', 'Mass', 'قدّاس'],
                ['group', 'Group', 'مجموعة'],
                ['sacr', 'Sacrament', 'سرّ']
              ].map(([v, en, ar], i) => (
                <option key={i} value={v}>
                  {L(en, ar)}
                </option>
              ))}
            </Select>
          </div>{' '}
          <div className="formrow">
            <label className="label" htmlFor="ct_venue">
              {L('Default room', 'القاعة الافتراضية')}
            </label>
            <Select defaultValue={tpl?.venue} id="ct_venue">
              {VENUES.map((v, i) => (
                <option key={i} value={v.id}>
                  {L(v.name, v.ar)}
                </option>
              ))}
            </Select>
          </div>
        </div>{' '}
        <C.Stepper label={L('Duration in minutes', 'المدة بالدقائق')} value={tpl?.duration || 60} id="ct_duration" />{' '}
        <C.Textarea
          label={L('Default description', 'الوصف الافتراضي')}
          id="ct_desc"
          value={tpl?.description || ''}
          max={400}
        />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="ct_save" style={{ marginInlineStart: 'auto' }}>
          {L('Save template', 'حفظ القالب')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#ct_save').addEventListener('click', () => {
        if (!need(el, '#ct_name', L('Name the template', 'سمّ القالب'))) return;
        const kind = el.querySelector('#ct_kind').value,
          name = el.querySelector('#ct_name').value.trim();
        const fields = {
          name,
          nameAr: el.querySelector('#ct_ar').value.trim() || name,
          kind,
          icon: { mass: 'service', sacr: 'sacr', group: 'groups', event: 'events' }[kind],
          venue: el.querySelector('#ct_venue').value,
          duration: Math.max(1, Number(el.querySelector('#ct_duration').value) || 60),
          description: el.querySelector('#ct_desc').value.trim(),
          capacity: tpl?.capacity || 0
        };
        if (tpl) Object.assign(tpl, fields);
        else EVENT_TEMPLATES.push({ id: 'et' + Date.now().toString(36), ...fields });
        closeOverlays();
        bus.refresh();
        toast(L('Template saved', 'حُفظ القالب'), '', 'success');
      });
    }
  });
}

function deleteEventTemplate(id) {
  const tpl = EVENT_TEMPLATES.find(x => x.id === id);
  if (!tpl) return;
  openModal({
    title: L('Delete template?', 'حذف القالب؟'),
    body: (
      <>
        <p>{L(tpl.name, tpl.nameAr)}</p>
        <p className="t-caption dim">
          {L('Events already made from it will stay unchanged.', 'الأحداث المنشأة منه ستبقى بلا تغيير.')}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Keep template', 'إبقاء القالب')}
        </button>
        <button className="btn btn-danger" id="ct_confirm">
          {L('Delete template', 'حذف القالب')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#ct_confirm').addEventListener('click', () => {
        EVENT_TEMPLATES.splice(EVENT_TEMPLATES.indexOf(tpl), 1);
        closeOverlays();
        bus.refresh();
        toast(L('Template deleted', 'حُذف القالب'), '', 'success');
      });
    }
  });
}

function eventDrawer(id, isNew = false, pre = null) {
  const e = EVENTS.find(x => x.id === id);
  if (!isNew && !e) return;
  const d = e ? eventInfo(e) : null,
    ed = pre?.id ? eventInfo(pre) : null;
  const initialWedding =
    ed?.subtype === 'wedding' || /wedding/i.test(pre?.title || '') || /إكليل/.test(pre?.titleAr || '');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  if (isNew)
    return openDrawer({
      large: true,
      title: pre?.id ? L('Edit event', 'تعديل الحدث') : L('New event', 'حدث جديد'),
      sub: L(
        'Choose the date, time, room, and visibility. Room conflicts appear beside the time fields.',
        'اختر التاريخ والوقت والقاعة والظهور. تظهر تعارضات القاعة قرب حقول الوقت.'
      ),
      body: (
        <>
          <C.Field
            label={L('Title', 'العنوان')}
            req={true}
            id="ev_t"
            value={pre ? L(pre.title, pre.titleAr) : ''}
            ph={L('Parish lunch', 'غداء الرعية')}
          />{' '}
          <div className="formgrid">
            <div className="formrow">
              <label className="label" htmlFor="ev_template">
                {L('Template', 'القالب')}
              </label>{' '}
              <Select defaultValue={pre?.templateId} id="ev_template">
                <option value="">{L('None', 'بلا')}</option>
                {EVENT_TEMPLATES.map((x, i) => (
                  <option key={i} value={x.id}>
                    {L(x.name, x.nameAr)}
                  </option>
                ))}
              </Select>
            </div>{' '}
            <div className="formrow">
              <label htmlFor="ev_cat" className="label">
                {L('Category', 'الفئة')}
              </label>{' '}
              <Select defaultValue={pre?.kind || 'event'} id="ev_cat">
                {[
                  ['event', 'Parish life', 'حياة الرعية'],
                  ['mass', 'Worship', 'العبادة'],
                  ['group', 'Formation', 'التنشئة'],
                  ['sacr', 'Sacrament', 'سرّ']
                ].map(([v, en, ar], i) => (
                  <option key={i} value={v}>
                    {L(en, ar)}
                  </option>
                ))}
              </Select>
            </div>{' '}
            <C.Field label={L('Date', 'التاريخ')} type="date" value={pre?.d || nextDate} id="ev_d" />{' '}
            <C.Field label={L('From', 'من')} type="time" value={pre?.t || '12:00'} id="ev_from" />{' '}
            <C.Field label={L('To', 'إلى')} type="time" value={pre?.to || '14:00'} id="ev_to" />{' '}
            <div id="evclash" style={{ gridColumn: '1/-1' }} />{' '}
            <div className="formrow">
              <label className="label" htmlFor="ev_v">
                {L('Room', 'القاعة')}
              </label>{' '}
              <Select defaultValue={pre?.venue || 'v3'} id="ev_v">
                {VENUES.map((v, i) => (
                  <option key={i} value={v.id}>
                    {L(v.name, v.ar)}
                  </option>
                ))}
              </Select>
            </div>
          </div>{' '}
          <C.Textarea
            label={L('Description', 'الوصف')}
            id="evdesc"
            max={400}
            value={ed ? L(ed.desc, ed.descAr) : EVENT_TEMPLATES.find(x => x.id === pre?.templateId)?.description || ''}
          />{' '}
          <div id="ev-subtype" hidden={!((pre?.kind || 'event') === 'sacr')} className="formrow">
            <label className="label" htmlFor="ev_subtype">
              {L('Sacrament event type', 'نوع حدث السرّ')}
            </label>{' '}
            <Select id="ev_subtype" defaultValue={initialWedding ? 'wedding' : ''}>
              <option value="">{L('Other sacrament', 'سرّ آخر')}</option>
              <option value="wedding">{L('Wedding', 'إكليل')}</option>
            </Select>
          </div>{' '}
          <div id="ev-participants" hidden={!initialWedding}>
            <div className="formgrid">
              <C.Field
                label={L('Person getting married — first', 'المتزوّج الأول')}
                id="ev_partner1"
                value={ed?.participants?.[0] || ''}
              />{' '}
              <C.Field
                label={L('Person getting married — second', 'المتزوّج الثاني')}
                id="ev_partner2"
                value={ed?.participants?.[1] || ''}
              />
            </div>
          </div>{' '}
          <C.ChipField
            label={L('Required items', 'المستلزمات')}
            tags={(ed?.bring || []).map(([en, ar]) => L(en, ar))}
          />{' '}
          <div className="formgrid">
            <C.Stepper
              label={L('Capacity', 'السعة')}
              value={ed?.cap ?? EVENT_TEMPLATES.find(x => x.id === pre?.templateId)?.capacity ?? 60}
              id="evcap"
            />{' '}
            <div className="formrow">
              <label className="label" htmlFor="ev_visibility">
                {L('Visibility', 'الظهور')}
              </label>{' '}
              <Select id="ev_visibility" defaultValue={ed?.visibility || 'public'}>
                <option value="public">{L('Public — parish calendar', 'عام — رزنامة الرعية')}</option>
                <option value="groups">{L('Selected groups only', 'للمجموعات المحدّدة فقط')}</option>
                <option value="confidential">{L('Clergy and office only', 'للإكليروس والمكتب فقط')}</option>
              </Select>
            </div>
          </div>{' '}
          <div id="ev-visible-groups" hidden={!(ed?.visibility === 'groups')}>
            <label className="label">{L('Groups allowed to see this event', 'المجموعات المخوّلة رؤية الحدث')}</label>{' '}
            <div className="choice-grid">
              {GROUPS.map((g, i) => (
                <label key={i} className="row">
                  <input
                    type="checkbox"
                    data-ev-group=""
                    defaultValue={g.id}
                    defaultChecked={!!ed?.visibleGroupIds?.includes(g.id)}
                  />
                  <span>{L(g.name, g.ar)}</span>
                </label>
              ))}
            </div>
          </div>{' '}
          <div id="ev-priest-box" hidden={!((pre?.kind || 'event') === 'mass')}>
            <label className="label">{L('Assigned priests', 'الكهنة المكلّفون')}</label>{' '}
            <div className="choice-grid">
              {PEOPLE.filter(p => p.status === 'clergy').map((p, i) => (
                <label key={i} className="row">
                  <input
                    type="checkbox"
                    data-ev-priest=""
                    defaultValue={p.id}
                    defaultChecked={!!ed?.priestIds?.includes(p.id)}
                  />
                  <span>
                    {p.lat} · {p.ar}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>{' '}
          <button className="btn btn-primary" id="ok" style={{ marginInlineStart: 'auto' }}>
            {pre?.id ? L('Save changes', 'حفظ التعديلات') : L('Create event', 'إنشاء الحدث')}
          </button>
        </>
      ),
      onMount(el) {
        const v = sel => el.querySelector(sel).value;
        const updateFields = () => {
          const sacrament = v('#ev_cat') === 'sacr',
            wedding = sacrament && v('#ev_subtype') === 'wedding';
          el.querySelector('#ev-subtype').hidden = !sacrament;
          el.querySelector('#ev-participants').hidden = !wedding;
          el.querySelector('#ev-priest-box').hidden = v('#ev_cat') !== 'mass';
          el.querySelector('#ev-visible-groups').hidden = v('#ev_visibility') !== 'groups';
        };
        ['#ev_cat', '#ev_subtype', '#ev_visibility'].forEach(sel =>
          el.querySelector(sel).addEventListener('change', updateFields)
        );
        updateFields();
        el.querySelector('#ev_template').addEventListener('change', () => {
          const tpl = EVENT_TEMPLATES.find(x => x.id === v('#ev_template'));
          if (!tpl) return;
          el.querySelector('#ev_t').value = L(tpl.name, tpl.nameAr);
          el.querySelector('#ev_cat').value = tpl.kind;
          el.querySelector('#ev_v').value = tpl.venue;
          el.querySelector('#ev_to').value = addMin(v('#ev_from'), Number(tpl.duration) || 60);
          el.querySelector('#evdesc').value = tpl.description || '';
          el.querySelector('#evcap').value = tpl.capacity || 0;
          updateFields();
          showClash();
        });
        /* the room clash is checked as the date, times and room change, against every other event in that room */
        const clash = () =>
          EVENTS.find(
            x =>
              x.id !== pre?.id &&
              x.venue === v('#ev_v') &&
              x.d === v('#ev_d') &&
              x.t < v('#ev_to') &&
              v('#ev_from') < (x.to || addMin(x.t, x.kind === 'mass' ? 60 : 90))
          );
        const showClash = () => {
          const c = clash(),
            room = venue(v('#ev_v'));
          paint(
            el.querySelector('#evclash'),
            v('#ev_from') >= v('#ev_to') ? (
              <C.InlineAlert
                tone="warning"
                title={L('The event ends before it starts', 'ينتهي الحدث قبل أن يبدأ')}
                body={L('Check the two times.', 'تحقّق من الوقتين.')}
              />
            ) : c ? (
              <C.InlineAlert
                tone="warning"
                title={L(`${room ? room.name : 'The room'} is taken`, `${room ? room.ar : 'القاعة'} محجوزة`)}
                body={L(
                  `${c.title} is there from ${c.t}. Pick another room or time.`,
                  `${c.titleAr} فيها من ${c.t}. اختر قاعة أو وقتاً آخر.`
                )}
              />
            ) : (
              <C.InlineAlert
                tone="success"
                title={L('No clash', 'لا تعارض')}
                body={L(
                  `${room ? room.name : 'The room'} is free at that time.`,
                  `${room ? room.ar : 'القاعة'} متاحة في ذلك الوقت.`
                )}
              />
            )
          );
        };
        ['#ev_d', '#ev_from', '#ev_to', '#ev_v'].forEach(s2 =>
          el.querySelector(s2).addEventListener('change', showClash)
        );
        showClash();
        el.querySelector('#ok').addEventListener('click', () => {
          if (!need(el, '#ev_t', L('Give the event a title', 'أعطِ الحدث عنواناً'))) return;
          if (!need(el, '#ev_to', L('Ends before it starts', 'ينتهي قبل أن يبدأ'), to => to > v('#ev_from'))) return;
          const visibility = v('#ev_visibility'),
            visibleGroupIds = [...el.querySelectorAll('[data-ev-group]:checked')].map(x => x.value);
          if (visibility === 'groups' && !visibleGroupIds.length)
            return toast(L('Choose at least one group', 'اختر مجموعة واحدة على الأقل'), '', 'warning');
          const wedding = !el.querySelector('#ev-participants').hidden;
          const participants = wedding ? [v('#ev_partner1').trim(), v('#ev_partner2').trim()] : [];
          if (wedding && participants.some(x => !x))
            return toast(L('Enter both people getting married', 'أدخل اسمي المتزوّجين'), '', 'warning');
          const title = v('#ev_t').trim(),
            dte = v('#ev_d'),
            tme = v('#ev_from');
          const fields = {
            d: dte,
            t: tme,
            to: v('#ev_to'),
            venue: v('#ev_v'),
            kind: v('#ev_cat'),
            templateId: v('#ev_template') || null
          };
          const desc = v('#evdesc').trim(),
            cap = +v('#evcap') || 0;
          const bring = [...el.querySelectorAll('[data-chipfield] .tag')]
            .map(tag => tag.firstChild?.textContent?.trim())
            .filter(Boolean)
            .map(label => [label, label]);
          const category = {
            event: ['Parish life', 'حياة الرعية'],
            mass: ['Worship', 'العبادة'],
            group: ['Formation', 'التنشئة'],
            sacr: ['Sacrament', 'سرّ']
          }[fields.kind];
          let ev;
          if (pre?.id) {
            ev = EVENTS.find(x => x.id === pre.id);
            const same = title === L(ev.title, ev.titleAr);
            Object.assign(ev, fields, same ? {} : { title, titleAr: title });
          } else EVENTS.push((ev = { id: 'ev' + Date.now().toString(36), title, titleAr: title, ...fields }));
          EVENT_DETAIL[ev.id] ||= eventInfo(ev);
          Object.assign(EVENT_DETAIL[ev.id], {
            desc,
            descAr: desc,
            cat: category[0],
            catAr: category[1],
            cap,
            bring,
            visibility,
            visibleGroupIds: visibility === 'groups' ? visibleGroupIds : [],
            priestIds:
              fields.kind === 'mass' ? [...el.querySelectorAll('[data-ev-priest]:checked')].map(x => x.value) : [],
            subtype: wedding ? 'wedding' : '',
            participants
          });
          const target = new Date(dte);
          S.ui.calOffset = (target.getFullYear() - 2026) * 12 + target.getMonth() - 9;
          closeOverlays();
          bus.refresh();
          document.querySelectorAll(`#view [data-ev="${ev.id}"]`).forEach(x => x.classList.add('flash'));
          toast(
            pre?.id ? L('Event updated', 'حُدّث الحدث') : L('Event created', 'أُنشئ الحدث'),
            `${title} · ${fmtDate(dte)} ${tme}`,
            'success'
          );
        });
      }
    });
  openDrawer({
    large: true,
    title: L(e.title, e.titleAr),
    sub: `${fmtLong(new Date(e.d))} · ${e.t}${e.to ? `–${e.to}` : ''} · ${venue(e.venue) ? L(venue(e.venue).name, venue(e.venue).ar) : '—'}`,
    body: (
      <>
        <dl className="dl">
          <dt>{L('Organiser', 'المنظّم')}</dt>
          <dd>{d.organizer && person(d.organizer) ? L(person(d.organizer).lat, person(d.organizer).ar) : '—'}</dd>
          <dt>{L('Category', 'الفئة')}</dt>
          <dd>{L(d.cat, d.catAr)}</dd>
          <dt>{L('Time zone', 'المنطقة الزمنية')}</dt>
          <dd className="mono">{d.tz}</dd>
          <dt>{L('Visibility', 'الظهور')}</dt>
          <dd>
            {d.visibility === 'groups'
              ? L('Selected groups', 'مجموعات محدّدة')
              : d.visibility === 'confidential'
                ? L('Clergy and office', 'الإكليروس والمكتب')
                : L('Public', 'عام')}
          </dd>
          {d.subtype === 'wedding' ? (
            <>
              <dt>{L('Getting married', 'المتزوّجون')}</dt>
              <dd>{(d.participants || []).join(' & ') || L('Not recorded', 'غير مسجّل')}</dd>
            </>
          ) : (
            ''
          )}
          {e.kind === 'mass' ? (
            <>
              <dt>{L('Assigned priests', 'الكهنة المكلّفون')}</dt>
              <dd>
                {(d.priestIds || []).map(pid => person(pid)?.lat || pid).join(', ') || L('Unassigned', 'غير مسند')}
              </dd>
            </>
          ) : (
            ''
          )}
          {d.tags.length ? (
            <>
              <dt>{L('Tags', 'الوسوم')}</dt>
              <dd>
                {d.tags.map((x, i) => (
                  <span key={i} className="chip" style={{ marginInlineEnd: '6px' }}>
                    {x}
                  </span>
                ))}
              </dd>
            </>
          ) : (
            ''
          )}
        </dl>{' '}
        <h4 className="t-ui" style={{ marginTop: '14px' }}>
          {L('Purpose and details', 'الغاية والتفاصيل')}
        </h4>{' '}
        {d.desc ? (
          <p className="t-body dim" style={{ fontSize: '14px', marginTop: '6px' }}>
            {L(d.desc, d.descAr)}
          </p>
        ) : (
          <p className="help">{L('No purpose or details recorded.', 'لا غاية أو تفاصيل مسجّلة.')}</p>
        )}{' '}
        <div className="divider" />{' '}
        <h4 className="t-ui" style={{ marginBottom: '10px' }}>
          {L('RSVP', 'تأكيد الحضور')}
        </h4>{' '}
        <div className="grid g4" style={{ gap: '10px' }}>
          {[
            [L('Yes', 'نعم'), d.rsvp.yes],
            [L('No', 'لا'), d.rsvp.no],
            [L('Maybe', 'ربما'), d.rsvp.maybe],
            [L('No reply', 'بلا ردّ'), d.rsvp.none]
          ].map(([k, v], i) => (
            <div key={i} className="card card-flat" style={{ padding: '12px' }}>
              <div className="t-caption dim">{k}</div>{' '}
              <div style={{ font: '600 20px/26px var(--sans)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            </div>
          ))}
        </div>{' '}
        {d.cap ? (
          <>
            <span className="meter" style={{ marginTop: '12px' }}>
              <i style={css(`width:${Math.min(100, Math.round((d.rsvp.yes / d.cap) * 100))}%`)} />
            </span>{' '}
            <span className="t-caption dim" style={{ display: 'block', marginTop: '6px' }}>
              {d.rsvp.yes} / {d.cap} {L('places', 'مقعداً')} · {d.waiting}{' '}
              {L('on the waiting list', 'على لائحة الانتظار')}
            </span>
          </>
        ) : (
          ''
        )}{' '}
        {d.bring.length ? (
          <>
            <div className="divider" />{' '}
            <h4 className="t-ui" style={{ marginBottom: '10px' }}>
              {L('Required items', 'المستلزمات')}
            </h4>{' '}
            <div className="stack" style={{ gap: '8px' }}>
              {d.bring.map(([en, ar], i) => (
                <C.CheckRow key={i} label={L(en, ar)} />
              ))}
            </div>
          </>
        ) : (
          ''
        )}{' '}
        <div className="divider" />{' '}
        <h4 className="t-ui" style={{ marginBottom: '10px' }}>
          {L('Tasks', 'المهام')}
        </h4>{' '}
        {d.tasks.length ? '' : <p className="t-caption dim">{L('No tasks yet.', 'لا مهام بعد.')}</p>}{' '}
        {d.tasks.map(([en, ar, p, due, done], ti) => (
          <div key={ti} className={`listrow ${done ? 'is-done' : ''}`} style={{ paddingInline: 0 }}>
            <Avatar p={person(p)} cls="avatar-sm" />
            <span className="grow">
              <b>{L(en, ar)}</b>{' '}
              <small className="mono">{done ? L('done', 'أُنجزت') : `${L('due', 'حتى')} ${fmtDate(due)}`}</small>
            </span>{' '}
            <C.IconBtn
              ico="check"
              label={done ? L('Reopen', 'إعادة فتح') : L('Mark done', 'تعليم كمنجز')}
              data-act={`evtask-toggle:${e.id}|${ti}`}
              aria-pressed={!!done}
            />
          </div>
        ))}{' '}
        <div className="divider" />{' '}
        <h4 className="t-ui" style={{ marginBottom: '10px' }}>
          {L('Linked to', 'مرتبط بـ')}
        </h4>{' '}
        <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          {nodesOr(
            REGISTRATIONS.filter(form => form.eventId === e.id).map((form, i) => (
              <a key={i} className="chip" href="#/registrations">
                <Icon name="registr" size={14} /> {L(form.event, form.eventAr)}
              </a>
            )),
            <span className="help">
              {L('No linked registration forms are recorded.', 'لا توجد استمارات تسجيل مرتبطة مسجّلة.')}
            </span>
          )}
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        {is('priest', 'secretary') ? (
          <>
            <button className="btn btn-secondary" data-act={`event-dup:${e.id}`}>
              {L('Duplicate', 'نسخ')}
            </button>{' '}
            <button className="btn btn-danger-quiet" data-act={`event-cancel:${e.id}`}>
              {L('Cancel event', 'إلغاء الحدث')}
            </button>{' '}
            <button className="btn btn-primary" style={{ marginInlineStart: 'auto' }} id="evedit">
              {L('Edit', 'تعديل')}
            </button>
          </>
        ) : (
          ''
        )}
      </>
    ),
    onMount(el) {
      el.querySelector('#evedit')?.addEventListener('click', () => eventDrawer(e.id, true, e));
    }
  });
}
