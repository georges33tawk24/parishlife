/* Check-in at the door for an event: who is expected and present, authorised pickup, and the present
   roster for an evacuation. Arrival, checkout and re-entry are recorded by ParishLife.Api; the door list
   only shows to an account assigned to the event. */
import { Select } from '../../ui/components.jsx';
import { t, fmtDate } from '../../../lib/i18n.js';
import { S, bus } from '../../model/store.js';
import { Icon, PageHead, Panel, Who, Pill, Table, Empty, Stat, TabBar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import {
  selectableCheckinEvents,
  selectCheckinEvent,
  selectedCheckin,
  eventVenue
} from '../../model/event-workflows.js';
import { REGISTRANTS, PICKUP, CHECKIN } from '../../model/data.js';
import { registrantName, statusLabel } from './registration-forms.jsx';
import { arriveNow, presenceDialog, collectorsDialog, removeCollector } from './checkin-dialogs.jsx';

const L = (en, ar) => t(en, ar);

const CTABS = () => [
  ['', 'Room', 'الصف'],
  ['pickup', 'Pickup', 'الاستلام'],
  ['incidents', 'Incidents', 'الحوادث'],
  ['evacuation', 'Evacuation', 'الإخلاء']
];

const PRESENCE = {
  NotArrived: ['Not arrived', 'لم يصل', ''],
  Present: ['Present', 'حاضر', 'success'],
  Departed: ['Left', 'غادر', 'info']
};

export function checkin(tab = '') {
  const chosenEvent = selectableCheckinEvents().find(e => e.id === S.ui.checkinEventId);
  const session = selectedCheckin();
  const people = chosenEvent ? REGISTRANTS.filter(r => r.eventId === chosenEvent.id && r.status === 'Confirmed') : [];
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Parish life', 'حياة الرعية') }, { label: L('Check-in', 'التسجيل عند الباب') }]}
        title={chosenEvent ? chosenEvent.title : L('Check-in', 'تسجيل الوصول')}
        sub={
          chosenEvent ? (
            <>
              {fmtDate(chosenEvent.d)} {chosenEvent.t}
              {eventVenue(chosenEvent)
                ? ` · ${L(eventVenue(chosenEvent).name, eventVenue(chosenEvent).ar)}`
                : ''} · <span className="tnum">{session ? session.present : '—'}</span> {L('present of', 'حاضر من')}{' '}
              <span className="tnum">{people.length}</span>
            </>
          ) : (
            L(
              'Select the event whose registered participants are arriving. No event is selected by default.',
              'اختر الحدث الذي يصل إليه المشتركون. لا يُحدّد حدث افتراضياً.'
            )
          )
        }
      />
      <div className="toolbar" style={{ margin: '18px 0' }}>
        <label className="label" htmlFor="checkin-event">
          {L('Check-in event', 'حدث تسجيل الوصول')}
        </label>{' '}
        <Select defaultValue={chosenEvent?.id} id="checkin-event" style={{ maxWidth: '380px' }}>
          <option value="">{L('Select event', 'اختر حدثاً')}</option>
          {selectableCheckinEvents().map(e => (
            <option key={e.id} value={e.id}>
              {e.title} · {e.d} {e.t}
            </option>
          ))}
        </Select>
      </div>
      <TabBar base="checkin" items={CTABS()} active={tab} />
    </>
  );
  if (!chosenEvent)
    return (
      <>
        {head}
        <div className="tabbody">
          <Empty
            glyph="registr"
            title={L('Select an event to check in', 'اختر حدثاً لتسجيل الوصول')}
            body={L('Only events with a registration form appear above.', 'تظهر فقط الأحداث التي لها استمارة تسجيل.')}
          />
        </div>
      </>
    );
  if (!session)
    return (
      <>
        {head}
        <div className="tabbody">
          <C.InlineAlert
            tone="info"
            title={L('This account is not a door operator for this event', 'هذا الحساب ليس مشغّل باب لهذا الحدث')}
            body={L(
              'Arrival is recorded by an account with the check-in permission that the event’s registration form lists as a door operator.',
              'يسجّل الوصول حساب يملك صلاحية التسجيل عند الباب ومدرج في استمارة الحدث كمشغّل باب.'
            )}
          />
        </div>
      </>
    );
  if (tab === 'pickup')
    return (
      <>
        {head}
        <div className="tabbody">
          <C.InlineAlert
            tone="warning"
            title={L(
              'Check-in and release are separate, recorded actions',
              'التسجيل والتسليم إجراءان منفصلان مسجَّلان'
            )}
            body={L(
              'A child who may not leave alone is released only to a person on this list, after their identity is checked.',
              'لا يُسلَّم من لا يغادر بمفرده إلا لشخص من هذه اللائحة بعد التحقّق من هويته.'
            )}
          />{' '}
          <div className="stack" style={{ gap: '16px', marginTop: '16px' }}>
            {people.length ? (
              people.map(r => {
                const v = PICKUP[r.id] || { approved: [], independent: false, canEdit: false };
                return (
                  <section key={r.id} className="panel">
                    <div className="panel-h">
                      <Who p={registrantName(r)} />
                      <span style={{ marginInlineStart: 'auto' }} />{' '}
                      {v.independent ? (
                        <Pill label={L('May leave alone', 'يغادر بمفرده')} tone="success" />
                      ) : v.approved.length ? (
                        <Pill label={L('Pickup required', 'يتطلب الاستلام')} tone="warning" />
                      ) : (
                        <Pill label={L('No collector named', 'لم يُسمَّ مستلِم')} tone="danger" />
                      )}
                    </div>{' '}
                    <div className="panel-b">
                      <div className="ac-group" style={{ paddingInline: 0 }}>
                        {L('Approved to collect', 'مفوَّضون بالاستلام')}
                      </div>{' '}
                      {v.approved.map(c => (
                        <div key={c.id} className="listrow" style={{ paddingInline: 0 }}>
                          <span className="grow">
                            <b>{c.name}</b>
                            {c.evidence ? <small>{c.evidence}</small> : null}
                          </span>{' '}
                          {v.canEdit ? (
                            <C.IconBtn
                              ico="trash"
                              label={L('Remove', 'إزالة')}
                              data-remove-collector={`${r.id}|${c.id}`}
                            />
                          ) : null}
                        </div>
                      ))}{' '}
                      {v.canEdit ? (
                        <button
                          className="btn btn-secondary btn-dense"
                          style={{ marginTop: '12px' }}
                          data-collectors={r.id}
                        >
                          <Icon name="plus" size={15} />
                          {L('Edit authorised people', 'تعديل المفوَّضين')}
                        </button>
                      ) : null}
                    </div>
                  </section>
                );
              })
            ) : (
              <p className="help">
                {L('No confirmed participants at this event.', 'لا مشتركون مؤكّدون في هذا الحدث.')}
              </p>
            )}
          </div>{' '}
          <p className="t-caption dim" style={{ marginTop: '14px' }}>
            {L(
              'The API has no do-not-release entries and no pickup codes, so none are shown.',
              'لا يوفّر الخادم قيوداً بعدم التسليم ولا رموز استلام، لذلك لا تُعرض.'
            )}
          </p>
        </div>
      </>
    );
  if (tab === 'incidents')
    return (
      <>
        {head}
        <div className="tabbody">
          <C.InlineAlert
            tone="info"
            title={L('Incident reports are not connected', 'تقارير الحوادث غير موصولة')}
            body={L(
              'Incident records are a separate restricted area of the API and this page does not read or write them yet. Nothing is saved here.',
              'سجلات الحوادث منطقة مقيّدة منفصلة في الخادم ولا تقرأها هذه الصفحة ولا تكتب فيها بعد. لا يُحفظ شيء هنا.'
            )}
          />
        </div>
      </>
    );
  if (tab === 'evacuation')
    return (
      <>
        {head}
        <div className="tabbody">
          <C.InlineAlert
            tone="info"
            title={L('Selected event roster', 'لائحة الحدث المحدّد')}
            body={
              session.coverage ||
              L('Recorded present participants for this event only.', 'المشتركون المسجَّل حضورهم في هذا الحدث فقط.')
            }
          />{' '}
          <div style={{ marginTop: '16px' }}>
            <Panel title={L('Present participants', 'المشتركون الحاضرون')} tight={true}>
              <Table
                cols={[{ label: L('Participant', 'المشترك') }, { label: L('Arrived', 'وقت الوصول'), cls: 'shrink' }]}
                rows={session.rows.map(row => ({
                  cells: [<Who p={registrantName(row)} />, <span className="mono">{row.in}</span>]
                }))}
                empty={<Empty glyph="people" title={L('No participants checked in', 'لا مشتركون حاضرون')} body="" />}
              />
            </Panel>
          </div>
          <p className="t-caption dim" style={{ marginTop: '12px' }}>
            {session.asOf ? `${L('As of', 'حتى')} ${new Date(session.asOf).toLocaleTimeString()} · ` : ''}
            {L('The muster point and emergency messages are not connected.', 'نقطة التجمّع ورسائل الطوارئ غير موصولة.')}
          </p>
          <button className="btn btn-secondary" style={{ marginTop: '14px' }} data-act="print">
            <Icon name="print" size={17} />
            {L('Print event roster', 'طباعة لائحة الحدث')}
          </button>
        </div>
      </>
    );

  /* room roster: everyone confirmed for the event with where they are now */
  const present = people.filter(r => r.presence === 'Present').length,
    left = people.filter(r => r.presence === 'Departed').length;
  return (
    <>
      {head}
      <div className="stats" style={{ margin: '20px 0 24px' }}>
        <Stat k={L('Present now', 'الحاضرون الآن')} v={present} d={`${L('confirmed', 'مؤكّد')} ${people.length}`} />{' '}
        <Stat k={L('Not arrived', 'لم يصلوا')} v={people.filter(r => r.presence === 'NotArrived').length} d="" />{' '}
        <Stat k={L('Left', 'غادروا')} v={left} d="" />
      </div>{' '}
      <Panel title={L('Confirmed participants', 'المشتركون المؤكَّدون')} tight={true}>
        {people.length ? (
          people.map(r => {
            const [en, ar, tone] = PRESENCE[r.presence] || [r.presence || '—', r.presence || '—', ''];
            return (
              <div key={r.id} className="listrow">
                <Who p={registrantName(r)} />{' '}
                <span className="grow">
                  <Pill label={L(en, ar)} tone={tone} />
                </span>{' '}
                <span className="t-caption dim">
                  {r.independentDeparture
                    ? L('May leave alone', 'يغادر بمفرده')
                    : r.collectors.length
                      ? `${L('Pickup', 'الاستلام')}: ${r.collectors.map(c => c.name).join(', ')}`
                      : L('No collector named', 'لم يُسمَّ مستلِم')}
                </span>{' '}
                {r.presence === 'NotArrived' ? (
                  <button className="btn btn-primary btn-dense" data-arrive={r.id}>
                    {L('Arrived', 'وصل')}
                  </button>
                ) : r.presence === 'Present' ? (
                  <button className="btn btn-secondary btn-dense" data-presence={`${r.id}|checkout`}>
                    {L('Check out', 'تسجيل خروج')}
                  </button>
                ) : (
                  <button className="btn btn-secondary btn-dense" data-presence={`${r.id}|reenter`}>
                    {L('Re-enter', 'إعادة دخول')}
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <p className="help">{L('No confirmed participants yet.', 'لا مشتركون مؤكّدون بعد.')}</p>
        )}
      </Panel>{' '}
      <C.InlineAlert
        tone="warning"
        title={L('Confirm identity before releasing a participant', 'تحقّق من الهوية قبل تسليم المشترك')}
        body={L(
          'Every arrival, release and re-entry is recorded with the name of whoever entered it.',
          'كل وصول وتسليم وإعادة دخول يُسجَّل باسم من أدخله.'
        )}
      />
    </>
  );
}

checkin.mount = host => {
  const row = id => REGISTRANTS.find(r => r.id === id);
  host.querySelector('#checkin-event')?.addEventListener('change', e => {
    selectCheckinEvent(e.target.value);
    bus.refresh();
  });
  host
    .querySelectorAll('[data-arrive]')
    .forEach(b => b.addEventListener('click', () => arriveNow(row(b.dataset.arrive))));
  host.querySelectorAll('[data-presence]').forEach(b =>
    b.addEventListener('click', () => {
      const [id, action] = b.dataset.presence.split('|');
      presenceDialog(row(id), action);
    })
  );
  host
    .querySelectorAll('[data-collectors]')
    .forEach(b => b.addEventListener('click', () => collectorsDialog(row(b.dataset.collectors))));
  host.querySelectorAll('[data-remove-collector]').forEach(b =>
    b.addEventListener('click', () => {
      const [id, collector] = b.dataset.removeCollector.split('|');
      removeCollector(row(id), collector);
    })
  );
};
