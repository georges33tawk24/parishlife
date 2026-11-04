/* Check-in at the door for an event: rooms, pickup, incidents and evacuation. */
import { Select } from '../../ui/components.jsx';
import { nodesOr } from '../../ui/html.js';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { S, bus } from '../../model/store.js';
import { Icon, PageHead, Panel, Who, Pill, Table, Empty, openModal, Stat, TabBar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import {
  selectableCheckinEvents,
  selectCheckinEvent,
  selectedCheckin,
  eventVenue
} from '../../model/event-workflows.js';
import { REGISTRATIONS, REGISTRANTS, PICKUP, INCIDENTS, person, venue } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

const CTABS = () => [
  ['', 'Room', 'الصف'],
  ['pickup', 'Pickup', 'الاستلام'],
  ['incidents', 'Incidents', 'الحوادث', INCIDENTS.length],
  ['evacuation', 'Evacuation', 'الإخلاء']
];

export function checkin(tab = '') {
  const chosenEvent = selectableCheckinEvents().find(e => e.id === S.ui.checkinEventId);
  const session = selectedCheckin() || {
    rows: [],
    present: 0,
    expected: chosenEvent
      ? REGISTRANTS.filter(r => REGISTRATIONS.some(f => f.id === r.registrationId && f.eventId === chosenEvent.id))
          .length
      : 0,
    awaitingGuardian: 0,
    room: chosenEvent?.venue
  };
  const eventParticipants = new Set(
    chosenEvent
      ? REGISTRANTS.filter(r => REGISTRATIONS.some(f => f.id === r.registrationId && f.eventId === chosenEvent.id)).map(
          r => r.p
        )
      : []
  );
  const expected = eventParticipants.size;
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Parish life', 'حياة الرعية') }, { label: L('Check-in', 'التسجيل عند الباب') }]}
        title={chosenEvent ? L(chosenEvent.title, chosenEvent.titleAr) : L('Check-in', 'تسجيل الوصول')}
        sub={
          chosenEvent ? (
            <>
              {fmtDate(chosenEvent.d)} {chosenEvent.t} ·{' '}
              {L(eventVenue(chosenEvent)?.name || '', eventVenue(chosenEvent)?.ar || '')} ·{' '}
              <span className="tnum">{session.present}</span> {L('present of', 'حاضر من')}{' '}
              <span className="tnum">{expected}</span>
            </>
          ) : (
            L(
              'Select the event whose registered participants are arriving. No event is selected by default.',
              'اختر الحدث الذي يصل إليه المشتركون. لا يُحدّد حدث افتراضياً.'
            )
          )
        }
        actions={
          chosenEvent ? (
            <>
              <button className="btn btn-secondary" data-act="scan">
                <Icon name="qr" size={17} />
                {L('Enter reference', 'إدخال الرقم')}
              </button>{' '}
              <button className="btn btn-secondary" id="tags">
                <Icon name="print" size={17} />
                {L('Name tags', 'بطاقات الأسماء')}
              </button>{' '}
              <button className="btn btn-primary" data-act="checkin-manual">
                <Icon name="plus" size={17} />
                {L('Manual check-in', 'تسجيل يدوي')}
              </button>
            </>
          ) : (
            ''
          )
        }
      />
      <div className="toolbar" style={{ margin: '18px 0' }}>
        <label className="label" htmlFor="checkin-event">
          {L('Check-in event', 'حدث تسجيل الوصول')}
        </label>{' '}
        <Select defaultValue={chosenEvent?.id} id="checkin-event" style={{ maxWidth: '380px' }}>
          <option value="">{L('Select event', 'اختر حدثاً')}</option>
          {selectableCheckinEvents().map((e, i) => (
            <option key={i} value={e.id}>
              {L(e.title, e.titleAr)} · {e.d} {e.t} · {eventVenue(e)?.name || ''}
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
            body={L(
              'Only events with linked registration forms appear above. Mass and feast liturgies are not eligible.',
              'تظهر فقط الأحداث المرتبطة باستمارات تسجيل. القداديس واحتفالات الأعياد غير مشمولة.'
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
              'Check-in and release are separate, auditable actions',
              'التسجيل والتسليم إجراءان منفصلان قابلان للتدقيق'
            )}
            body={L(
              'A restricted entry means do not release, whatever code is presented. Call a member of staff.',
              'القيد المقيَّد يعني عدم التسليم مهما كان الرمز المقدَّم. نادِ أحد الموظّفين.'
            )}
          />{' '}
          <div className="stack" style={{ gap: '16px', marginTop: '16px' }}>
            {nodesOr(
              [...eventParticipants].map((pid, i) => {
                const v = PICKUP[pid] || { approved: [], restricted: [], required: false };
                return (
                  <section key={i} className="panel">
                    <div className="panel-h">
                      <Who p={person(pid)} />
                      <span style={{ marginInlineStart: 'auto' }} />{' '}
                      {v.restricted.length ? (
                        <Pill label={L('Restricted', 'مقيّد')} tone="danger" mark="lock" />
                      ) : v.required === false || !PICKUP[pid] ? (
                        <Pill label={L('No pickup needed', 'لا حاجة إلى استلام')} tone="success" />
                      ) : (
                        <Pill label={L('Pickup required', 'يتطلب الاستلام')} tone="warning" />
                      )}
                    </div>{' '}
                    <div className="panel-b">
                      <label className="check">
                        <input
                          type="checkbox"
                          data-pickup-required={pid}
                          defaultChecked={!!(v.required !== false && !!PICKUP[pid])}
                          disabled={!!v.restricted.length}
                        />
                        <span>{L('Requires an authorised pickup', 'يتطلب استلاماً من شخص مفوّض')}</span>
                      </label>{' '}
                      {v.required === false || !PICKUP[pid] ? (
                        <p className="help">
                          {L(
                            'This participant can check out without a pickup code.',
                            'يمكن لهذا المشترك تسجيل الخروج بلا رمز استلام.'
                          )}
                        </p>
                      ) : (
                        ''
                      )}{' '}
                      <div className="ac-group" style={{ paddingInline: 0 }}>
                        {L('Approved to collect', 'مفوَّضون بالاستلام')}
                      </div>{' '}
                      {v.approved.map(([en, ar, rel], ai) => (
                        <div key={ai} className="listrow" style={{ paddingInline: 0 }}>
                          <span className="grow">
                            <b>{isAr() ? ar : en}</b>
                            <small>{rel}</small>
                          </span>{' '}
                          <C.IconBtn ico="trash" label={L('Remove', 'إزالة')} data-act={`pickup-remove:${pid}|${ai}`} />
                        </div>
                      ))}{' '}
                      {v.restricted.length ? (
                        <>
                          <div className="divider" />{' '}
                          {v.restricted.map(([en, ar], i) => (
                            <C.InlineAlert
                              key={i}
                              tone="danger"
                              title={L('Do not release', 'لا تُسلّم')}
                              body={L(en, ar)}
                            />
                          ))}
                        </>
                      ) : (
                        ''
                      )}{' '}
                      <button
                        className="btn btn-secondary btn-dense"
                        style={{ marginTop: '12px' }}
                        data-act={`pickup-add:${pid}`}
                      >
                        <Icon name="plus" size={15} />
                        {L('Add an authorised person', 'إضافة شخص مفوَّض')}
                      </button>
                    </div>
                  </section>
                );
              }),
              <p className="help">
                {L('No registered participants at this event.', 'لا مشتركون مسجّلون في هذا الحدث.')}
              </p>
            )}
          </div>
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
            title={L('Parish-wide incident log', 'سجل حوادث الرعية')}
            body={L(
              'Existing incident reports are parish-wide and are not linked to the selected event. The log is restricted to authorised staff.',
              'تقارير الحوادث الحالية على مستوى الرعية وغير مرتبطة بالحدث المحدّد. يقتصر السجل على الموظفين المخوّلين.'
            )}
          />{' '}
          <div style={{ marginTop: '16px' }}>
            <Table
              cols={[
                { label: L('When', 'الوقت') },
                { label: L('Room', 'المكان'), cls: 'hide-sm' },
                { label: L('What happened', 'ما حدث') },
                { label: L('Recorded by', 'سجّله'), cls: 'hide-md' },
                { label: '', cls: 'shrink' }
              ]}
              rows={INCIDENTS.map(i => ({
                cells: [
                  <span className="mono dim">{i.at}</span>,
                  <span className="dim">{L(venue(i.room).name, venue(i.room).ar)}</span>,
                  L(i.what, i.whatAr),
                  <Who p={person(i.by)} />,
                  <button className="btn btn-secondary btn-dense" data-act={`incident-open:${i.id}`}>
                    {L('Open', 'فتح')}
                  </button>
                ]
              }))}
            />
          </div>{' '}
          <button className="btn btn-secondary" style={{ marginTop: '16px' }} data-act="incident-new">
            <Icon name="plus" size={17} />
            {L('Record an incident', 'تسجيل حادث')}
          </button>
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
            body={L(
              'This list shows the people currently checked in to this event. It does not count everyone in the building. Emergency message delivery is not connected.',
              'تُظهر هذه اللائحة الموجودين حالياً في هذا الحدث فقط، ولا تشمل كل الموجودين في المبنى. إرسال رسائل الطوارئ غير موصول.'
            )}
          />{' '}
          <div style={{ marginTop: '16px' }}>
            <Panel title={L('Present participants', 'المشتركون الحاضرون')} tight={true}>
              <Table
                cols={[
                  { label: L('Participant', 'المشترك') },
                  { label: L('Location', 'المكان') },
                  { label: L('Arrived', 'وقت الوصول') }
                ]}
                rows={session.rows.map(row => ({
                  cells: [
                    <Who p={person(row.p)} />,
                    L(eventVenue(chosenEvent)?.name || '', eventVenue(chosenEvent)?.ar || ''),
                    <span className="mono">{row.in || ''}</span>
                  ]
                }))}
                empty={
                  <Empty
                    glyph="people"
                    title={L('No participants checked in', 'لا مشتركون حاضرون')}
                    body={L(
                      'The event roster updates as participants arrive.',
                      'تتحدّث لائحة الحدث عند وصول المشتركين.'
                    )}
                  />
                }
              />
            </Panel>
          </div>{' '}
          <button className="btn btn-secondary" style={{ marginTop: '14px' }} data-act="print">
            <Icon name="print" size={17} />
            {L('Print event roster', 'طباعة لائحة الحدث')}
          </button>
        </div>
      </>
    );

  /* room roster */
  const rows = session.rows.map((r, i) => {
    const p = person(r.p);
    return (
      <div key={i} className="listrow">
        <Who p={p} />{' '}
        <span className="grow">
          {r.alert ? (
            <span className="pill pill-danger">
              <span className="dot" />
              {r.alert}
            </span>
          ) : (
            ''
          )}
        </span>{' '}
        <span className="mono dim" dir="ltr">
          {L('in', 'دخول')} {r.in}
        </span>{' '}
        <span className="t-caption dim">
          {r.code ? (
            <>
              {r.guardian && r.guardian !== '—' ? `${L('Pickup', 'الاستلام')}: ${r.guardian} · ` : ''}
              <b className="mono">{r.code}</b>
            </>
          ) : (
            L('No pickup needed', 'لا حاجة إلى استلام')
          )}
        </span>{' '}
        <button className="btn btn-secondary btn-dense" data-act={`checkout:${r.p}`}>
          {L('Check out', 'تسجيل خروج')}
        </button>
      </div>
    );
  });
  return (
    <>
      {head}
      <div className="stats" style={{ margin: '20px 0 24px' }}>
        <Stat
          k={L('Present now', 'الحاضرون الآن')}
          v={session.rows.length}
          d={`${L('registered', 'مسجّل')} ${expected}`}
        />{' '}
        <Stat
          k={L('Awaiting pickup', 'بانتظار الاستلام')}
          v={session.rows.filter(r => !!r.code).length}
          d={L('pickup code issued', 'صدر رمز استلام')}
        />{' '}
        <Stat
          k={L('No pickup needed', 'لا حاجة إلى استلام')}
          v={session.rows.filter(r => !r.code).length}
          d={L('may check out normally', 'يمكنهم تسجيل الخروج مباشرةً')}
        />
      </div>{' '}
      <Panel title={L('Participants checked in', 'المشتركون الحاضرون')} tight={true}>
        {rows || <p className="help">{L('No one has checked in yet.', 'لم يسجّل أحد وصوله بعد.')}</p>}
      </Panel>{' '}
      <C.InlineAlert
        tone="warning"
        title={L('Confirm identity before releasing a participant', 'تحقّق من الهوية قبل تسليم المشترك')}
        body={L(
          'Every release, exception and override is recorded with the name of whoever approved it.',
          'كل تسليم واستثناء وتجاوز يُسجَّل باسم من وافق عليه.'
        )}
      />
    </>
  );
}

checkin.mount = host => {
  host.querySelectorAll('[data-pickup-required]').forEach(box =>
    box.addEventListener('change', () => {
      const pid = box.dataset.pickupRequired;
      PICKUP[pid] ||= { approved: [], restricted: [], required: false };
      if (PICKUP[pid].restricted?.length && !box.checked) {
        box.checked = true;
        return;
      }
      PICKUP[pid].required = box.checked;
      const row = selectedCheckin()?.rows.find(r => r.p === pid);
      if (row) {
        row.pickupRequired = box.checked;
        row.code = box.checked ? row.code || String(1000 + Math.floor(Math.random() * 9000)) : '';
      }
      bus.refresh();
    })
  );
  host.querySelector('#checkin-event')?.addEventListener('change', e => {
    selectCheckinEvent(e.target.value);
    bus.refresh();
  });
  host.querySelector('#tags')?.addEventListener('click', () =>
    openModal({
      title: L('Print name tags', 'طباعة بطاقات الأسماء'),
      sub: L(
        'Choose what goes on the label. Nothing beyond what the room needs.',
        'اختر ما يظهر على البطاقة. لا شيء يتجاوز حاجة الصف.'
      ),
      body: (
        <div className="stack" style={{ gap: '10px' }}>
          <C.CheckRow label={L('First name', 'الاسم الأول')} checked={true} />{' '}
          <C.CheckRow label={L('Room', 'الصف')} checked={true} />{' '}
          <C.CheckRow label={L('Guardian code', 'رمز وليّ الأمر')} checked={true} />{' '}
          <C.CheckRow label={L('Medical alert symbol (no detail)', 'رمز تنبيه طبي (بلا تفاصيل)')} checked={true} />{' '}
          <C.CheckRow
            label={L('Full name and phone', 'الاسم الكامل والهاتف')}
            note={L('not recommended', 'غير مستحسن')}
          />
        </div>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>{' '}
          <button className="btn btn-primary" data-act="print">
            {L('Print', 'طباعة')}
          </button>
        </>
      ),
      onMount(el) {}
    })
  );
};
