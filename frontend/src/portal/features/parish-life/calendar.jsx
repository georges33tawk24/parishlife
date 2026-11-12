/* The parish calendar: month, week and list views of the parish's events and the approved liturgical days,
   and the event drawer (when, status, audience, publication) with new, edit, repeat and the lifecycle steps.
   The API stores a title, kind, start and end with a time zone, an audience (public, parish, private), a
   description and a status; rooms, capacity, RSVPs, tasks and event templates have no API route, so the
   drawer does not offer them. */
import { Select } from '../../ui/components.jsx';
import { CalendarView } from '../../ui/collection.jsx';
import { t, fmtDate, fmtLong } from '../../../lib/i18n.js';
import { is, S, bus } from '../../model/store.js';
import { Icon, PageHead, Pill, Empty, openDrawer, closeOverlays, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { need } from '../../shared/dialogs.jsx';
import { printWeekDialog, priestScheduleDialog } from './schedules.jsx';
import { EVENTS, EVENT_DETAIL, FEASTS } from '../../model/data.js';
import { hydrate, persist } from '../../model/persist.js';
import { defaultZone, wantMonth } from '../../model/modules/calendar.js';
import { eventStep } from './calendar-dialogs.jsx';

const L = (en, ar) => t(en, ar);

const today = () => new Date().toLocaleDateString('sv-SE');

/* The API's audiences. A private event shows other people only as "Busy". */
const AUDIENCES = () => [
  ['public', L('Public — parish calendar', 'عام — رزنامة الرعية')],
  ['parish', L('Parish members', 'أعضاء الرعية')],
  ['private', L('Private — only me; others see “Busy”', 'خاص — أنا فقط؛ والآخرون يرون «مشغول»')]
];
const STATUS = {
  Draft: ['Draft', 'مسودة'],
  Confirmed: ['Confirmed', 'مثبّت'],
  Cancelled: ['Cancelled', 'ملغى'],
  Busy: ['Busy', 'مشغول'],
  Tentative: ['Tentative', 'مبدئي'],
  Restricted: ['Restricted', 'مقيّد']
};
const canEdit = () => is('priest', 'secretary');

/* The events, then the liturgical days (a feast has no time and opens nothing). */
const calendarItems = () => [
  ...EVENTS.map(e => ({
    ...e,
    date: e.d,
    time: e.t,
    title: e.title,
    subtitle: e.status === 'Cancelled' ? L('Cancelled', 'ملغى') : ''
  })),
  ...Object.entries(FEASTS).map(([date, titles]) => ({
    id: `feast:${date}`,
    date,
    time: '',
    title: L(...titles),
    subtitle: L('Liturgical calendar', 'الرزنامة الطقسية')
  }))
];

export function calendar(tab = '') {
  const head = (
    <PageHead
      crumbs={[{ label: L('Parish life', 'حياة الرعية') }, { label: L('Calendar', 'الرزنامة') }]}
      title={L('Calendar', 'الرزنامة')}
      sub={L(
        'The parish’s events with the approved liturgical calendar. Private events show to others only as “Busy”.',
        'أحداث الرعية مع الرزنامة الطقسية المعتمدة. الأحداث الخاصة تظهر للآخرين «مشغول» فقط.'
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
            {L('My schedule', 'جدولي')}
          </button>{' '}
          {canEdit() ? (
            <button className="btn btn-primary" id="newev">
              <Icon name="plus" size={17} />
              {L('New event', 'حدث جديد')}
            </button>
          ) : (
            ''
          )}
        </>
      }
    />
  );
  if (tab === 'templates')
    return (
      <>
        {head}
        <Empty
          glyph="events"
          title={L('Event templates are not connected', 'قوالب الأحداث غير مربوطة')}
          body={L(
            'The new backend has no event templates yet. Create an event, or duplicate an earlier one.',
            'لا قوالب أحداث في الواجهة الخلفية الجديدة بعد. أنشئ حدثاً أو انسخ حدثاً سابقاً.'
          )}
          action={
            <a className="btn btn-primary btn-dense" href="#/calendar">
              {L('Calendar', 'الرزنامة')}
            </a>
          }
        />
      </>
    );
  S.ui.sharedCalendar ||= { mode: tab === 'week' ? 'week' : tab === 'agenda' ? 'list' : 'month' };
  /* Events are loaded a few months at a time; moving the calendar beyond them loads that month. */
  const moved = () =>
    wantMonth(S.ui.sharedCalendar.date || today(), async () => {
      await hydrate();
      bus.refresh();
    });
  return (
    <>
      {head}
      <div data-unified-calendar="">
        <CalendarView
          events={calendarItems()}
          state={S.ui.sharedCalendar}
          onOpen={id => eventDrawer(id)}
          onChange={moved}
        />
      </div>
    </>
  );
}

calendar.mount = host => {
  host.querySelector('#priest-schedule')?.addEventListener('click', priestScheduleDialog);
  host.querySelector('#newev')?.addEventListener('click', () => eventDrawer(null, true));
  host.querySelector('#printweek')?.addEventListener('click', printWeekDialog);
};

function eventForm(pre) {
  const zone = pre?.tz || defaultZone(EVENTS);
  const kind = pre?.apiKind || 'ParishActivity';
  return (
    <>
      <C.Field
        label={L('Title', 'العنوان')}
        req={true}
        id="ev_t"
        value={pre?.title || ''}
        ph={L('Parish lunch', 'غداء الرعية')}
      />{' '}
      <div className="formgrid">
        <div className="formrow">
          <label htmlFor="ev_cat" className="label">
            {L('Kind', 'النوع')}
          </label>{' '}
          <Select defaultValue={kind} id="ev_cat">
            <option value="ParishActivity">{L('Parish activity', 'نشاط رعوي')}</option>
            <option value="Appointment">{L('Appointment (private)', 'موعد (خاص)')}</option>
          </Select>
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="ev_visibility">
            {L('Who can see it', 'من يراه')}
          </label>{' '}
          <Select id="ev_visibility" defaultValue={pre?.visibility || 'public'}>
            {AUDIENCES().map(([v, label], i) => (
              <option key={i} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </div>{' '}
        <C.Field label={L('Date', 'التاريخ')} type="date" req={true} value={pre?.d || today()} id="ev_d" />{' '}
        <C.Field label={L('From', 'من')} type="time" value={pre?.t || '12:00'} id="ev_from" />{' '}
        <C.Field label={L('To', 'إلى')} type="time" value={pre?.to || '14:00'} id="ev_to" />{' '}
        <C.Field
          label={L('Time zone', 'المنطقة الزمنية')}
          id="ev_tz"
          value={zone}
          ph="Asia/Beirut"
          help={L('The parish’s clock, for example Asia/Beirut.', 'توقيت الرعية، مثل Asia/Beirut.')}
        />
      </div>{' '}
      <C.Textarea label={L('Description', 'الوصف')} id="evdesc" max={2000} value={pre?.description || ''} />{' '}
      {pre?.id ? (
        ''
      ) : (
        <div className="formgrid">
          <C.Stepper label={L('Repeat — times in all', 'التكرار — عدد المرات')} value={1} id="ev_count" />{' '}
          <C.Stepper label={L('Days between repeats', 'الأيام بين المرات')} value={7} id="ev_every" />
        </div>
      )}
    </>
  );
}

function eventDrawer(id, isNew = false, pre = null) {
  const e = EVENTS.find(x => x.id === id);
  if (!isNew && !e) return;
  if (isNew)
    return openDrawer({
      large: true,
      title: pre?.id ? L('Edit event', 'تعديل الحدث') : L('New event', 'حدث جديد'),
      sub: pre?.id
        ? L('Only a draft can be changed.', 'يمكن تعديل المسودة فقط.')
        : L(
            'It is saved as a draft. Confirm it, then publish it to the public calendar.',
            'يُحفظ كمسودة. ثبّته ثم انشره على الرزنامة العامة.'
          ),
      body: eventForm(pre),
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
        const v = sel => el.querySelector(sel)?.value ?? '';
        const kindChanged = () => {
          // appointments are private in the API
          if (v('#ev_cat') === 'Appointment') el.querySelector('#ev_visibility').value = 'private';
        };
        el.querySelector('#ev_cat').addEventListener('change', kindChanged);
        el.querySelector('#ok').addEventListener('click', async () => {
          if (!need(el, '#ev_t', L('Give the event a title', 'أعطِ الحدث عنواناً'))) return;
          if (!need(el, '#ev_to', L('Ends before it starts', 'ينتهي قبل أن يبدأ'), to => to > v('#ev_from'))) return;
          if (!need(el, '#ev_tz', L('Enter a time zone', 'أدخل المنطقة الزمنية'))) return;
          const fields = {
            title: v('#ev_t').trim(),
            titleAr: v('#ev_t').trim(),
            apiKind: v('#ev_cat'),
            kind: 'event',
            d: v('#ev_d'),
            endsOn: v('#ev_d'),
            t: v('#ev_from'),
            to: v('#ev_to'),
            tz: v('#ev_tz').trim(),
            visibility: v('#ev_cat') === 'Appointment' ? 'private' : v('#ev_visibility'),
            description: v('#evdesc').trim()
          };
          const copies = Math.max(1, Math.min(52, Number(v('#ev_count')) || 1)),
            every = Math.max(1, Math.min(366, Number(v('#ev_every')) || 7));
          if (pre?.id) {
            const ev = EVENTS.find(x => x.id === pre.id);
            Object.assign(ev, fields);
            if (EVENT_DETAIL[ev.id]) EVENT_DETAIL[ev.id].desc = EVENT_DETAIL[ev.id].descAr = fields.description;
          } else
            EVENTS.push({
              id: 'draft-' + Date.now().toString(36),
              status: 'Draft',
              published: false,
              version: '',
              venue: null,
              ...fields,
              ...(copies > 1 ? { repeat: { count: copies, intervalDays: every } } : {})
            });
          const button = el.querySelector('#ok');
          button.disabled = true;
          if (await persist()) {
            closeOverlays();
            S.ui.sharedCalendar = { ...(S.ui.sharedCalendar || { mode: 'month' }), date: fields.d };
            bus.refresh();
            toast(
              pre?.id ? L('Event updated', 'حُدّث الحدث') : L('Event created', 'أُنشئ الحدث'),
              `${fields.title} · ${fmtDate(fields.d)} ${fields.t}`,
              'success'
            );
          } else button.disabled = false;
        });
      }
    });
  const editable = canEdit() && !e.redacted;
  const [stEn, stAr] = STATUS[e.status] || [e.status, e.status];
  const audience = AUDIENCES().find(([v]) => v === e.visibility)?.[1] || '';
  openDrawer({
    large: true,
    title: e.title,
    sub: `${fmtLong(new Date(e.d))} · ${e.t}${e.to ? `–${e.to}` : ''}`,
    body: e.redacted ? (
      <p className="help">
        {L(
          'This time is taken by an event you cannot see. Only the time is shown.',
          'هذا الوقت محجوز بحدث لا يمكنك رؤيته. يظهر الوقت فقط.'
        )}
      </p>
    ) : (
      <>
        <dl className="dl">
          <dt>{L('Status', 'الحالة')}</dt>
          <dd>
            <Pill label={L(stEn, stAr)} /> {e.published ? <Pill label={L('Published', 'منشور')} tone="success" /> : ''}
          </dd>
          <dt>{L('Who can see it', 'من يراه')}</dt>
          <dd>{audience}</dd>
          <dt>{L('Time zone', 'المنطقة الزمنية')}</dt>
          <dd className="mono">{e.tz}</dd>
          {e.seriesId ? (
            <>
              <dt>{L('Repeats', 'التكرار')}</dt>
              <dd>{L('One of a series', 'من سلسلة')}</dd>
            </>
          ) : (
            ''
          )}
          {e.reason ? (
            <>
              <dt>{L('Last reason', 'آخر سبب')}</dt>
              <dd>{e.reason}</dd>
            </>
          ) : (
            ''
          )}
        </dl>{' '}
        <h4 className="t-ui" style={{ marginTop: '14px' }}>
          {L('Details', 'التفاصيل')}
        </h4>{' '}
        {e.description ? (
          <p className="t-body dim" style={{ fontSize: '14px', marginTop: '6px' }}>
            {e.description}
          </p>
        ) : (
          <p className="help">{L('No details recorded.', 'لا تفاصيل مسجّلة.')}</p>
        )}
        {e.status === 'Draft' && e.visibility !== 'public' ? (
          ''
        ) : e.status === 'Confirmed' && e.visibility !== 'public' ? (
          <p className="help">{L('Only public events can be published.', 'الأحداث العامة فقط يمكن نشرها.')}</p>
        ) : (
          ''
        )}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        {editable ? (
          <>
            <button className="btn btn-secondary" data-act={`event-dup:${e.id}`}>
              {L('Duplicate', 'نسخ')}
            </button>{' '}
            {e.status !== 'Cancelled' ? (
              <button className="btn btn-danger-quiet" data-act={`event-cancel:${e.id}`}>
                {L('Cancel event', 'إلغاء الحدث')}
              </button>
            ) : (
              ''
            )}{' '}
            {e.published ? (
              <button className="btn btn-secondary" id="evunpub">
                {L('Unpublish', 'إلغاء النشر')}
              </button>
            ) : e.status === 'Confirmed' && e.visibility === 'public' ? (
              <button className="btn btn-secondary" id="evpub">
                {L('Publish', 'نشر')}
              </button>
            ) : (
              ''
            )}{' '}
            {e.status === 'Draft' ? (
              <>
                <button className="btn btn-secondary" id="evconfirm">
                  {L('Confirm', 'تثبيت')}
                </button>{' '}
                <button className="btn btn-primary" style={{ marginInlineStart: 'auto' }} id="evedit">
                  {L('Edit', 'تعديل')}
                </button>
              </>
            ) : (
              ''
            )}
          </>
        ) : (
          ''
        )}
      </>
    ),
    onMount(el) {
      el.querySelector('#evedit')?.addEventListener('click', () => eventDrawer(e.id, true, e));
      el.querySelector('#evconfirm')?.addEventListener('click', () => eventStep(e.id, 'confirm'));
      el.querySelector('#evpub')?.addEventListener('click', () => eventStep(e.id, 'publish'));
      el.querySelector('#evunpub')?.addEventListener('click', () => eventStep(e.id, 'unpublish'));
    }
  });
}
