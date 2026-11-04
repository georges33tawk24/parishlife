/* Check-in dialogs: scanning or finding a participant, authorised pickups, and incidents. */
import { Select } from '../../ui/components.jsx';
import { t } from '../../../lib/i18n.js';
import { S } from '../../model/store.js';
import { Icon, toast, openDrawer, openModal, closeOverlays } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { canCheckIn } from './registration-forms.jsx';
import { selectableCheckinEvents, selectedCheckin, ensureCheckinSession } from '../../model/event-workflows.js';
import { nameOf, ok, refresh, val } from '../../shared/dialog-helpers.jsx';
import { pickPerson } from '../records/people-dialogs.jsx';
import { need } from '../../shared/dialogs.jsx';

const L = (en, ar) => t(en, ar);

export function scan() {
  const event = selectableCheckinEvents().find(e => e.id === S.ui.checkinEventId);
  if (!event) return toast(L('Select an event first', 'اختر حدثاً أولاً'), '', 'warning');
  openModal({
    title: L('Check in by registration reference', 'التسجيل برقم الاشتراك'),
    sub: `${L(event.title, event.titleAr)} · ${event.d} ${event.t} · ${L(D.venue(event.venue)?.name || '', D.venue(event.venue)?.ar || '')}`,
    body: (
      <div className="formrow">
        <label className="label" htmlFor="sc_code">
          {L('Registrant reference', 'رقم المشترك')}
        </label>{' '}
        <input
          className="input mono"
          id="sc_code"
          placeholder={L('Enter the reference on the registration', 'أدخل الرقم على التسجيل')}
          dir="ltr"
        />
      </div>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="sc_go" style={{ marginInlineStart: 'auto' }}>
          {L('Check in', 'تسجيل الدخول')}
        </button>
      </>
    ),
    onMount(el) {
      const found = () => {
        const forms = D.REGISTRATIONS.filter(f => f.eventId === event.id).map(f => f.id);
        const registrant = D.REGISTRANTS.find(r => r.id === val(el, '#sc_code') && forms.includes(r.registrationId));
        if (!registrant)
          return toast(L('Reference not registered for this event', 'الرقم غير مسجّل لهذا الحدث'), '', 'warning');
        if (
          !canCheckIn(
            registrant,
            D.REGISTRATIONS.find(f => f.id === registrant.registrationId)
          )
        )
          return toast(
            L('Confirm the place and required consent first', 'ثبّت المقعد والموافقة المطلوبة أولاً'),
            '',
            'warning'
          );
        const session = ensureCheckinSession(event.id);
        if (session.rows.some(r => r.p === registrant.p))
          return toast(L('Already checked in', 'مسجّل مسبقاً'), '', 'warning');
        const pickup = D.PICKUP[registrant.p],
          required = pickup?.required !== false && !!pickup;
        const code = required ? String(1000 + Math.floor(Math.random() * 9000)) : '';
        session.rows.push({
          p: registrant.p,
          in: new Date().toTimeString().slice(0, 5),
          out: null,
          guardian: pickup?.approved?.[0]?.[0] || '—',
          pickupRequired: required,
          code,
          alert: ''
        });
        session.present = session.rows.length;
        closeOverlays();
        refresh();
        ok(L('Checked in', 'سُجّل الدخول'), `${nameOf(D.person(registrant.p))} · ${L(event.title, event.titleAr)}`);
      };
      el.querySelector('#sc_go').addEventListener('click', found);
    }
  });
}

export function checkinManual() {
  const event = selectableCheckinEvents().find(e => e.id === S.ui.checkinEventId);
  if (!event) return toast(L('Select an event first', 'اختر حدثاً أولاً'), '', 'warning');
  const forms = D.REGISTRATIONS.filter(f => f.eventId === event.id).map(f => f.id);
  const allowed = D.REGISTRANTS.filter(
    r =>
      forms.includes(r.registrationId) &&
      canCheckIn(
        r,
        D.REGISTRATIONS.find(f => f.id === r.registrationId)
      )
  ).map(r => r.p);
  pickPerson({
    title: L('Manual check-in', 'تسجيل يدوي'),
    sub: `${L(event.title, event.titleAr)} · ${event.d} ${event.t} · ${L(D.venue(event.venue)?.name || '', D.venue(event.venue)?.ar || '')}`,
    cta: L('Check in', 'تسجيل الدخول'),
    exclude: selectedCheckin()?.rows.map(r => r.p) || [],
    allow: allowed,
    onPick: p => {
      const pickup = D.PICKUP[p.id],
        required = pickup?.required !== false && !!pickup;
      const code = required ? String(1000 + Math.floor(Math.random() * 9000)) : '';
      const session = ensureCheckinSession(event.id);
      if (!session || session.rows.some(r => r.p === p.id)) return;
      session.rows.push({
        p: p.id,
        in: new Date().toTimeString().slice(0, 5),
        out: null,
        guardian: pickup?.approved?.[0]?.[0] || '—',
        pickupRequired: required,
        code,
        alert: ''
      });
      session.present = session.rows.length;
      refresh();
      ok(
        L('Checked in', 'سُجّل الدخول'),
        `${nameOf(p)}${required ? ` · ${L('pickup code', 'رمز الاستلام')} ${code}` : ` · ${L('No pickup required', 'لا حاجة إلى استلام')}`}`
      );
    }
  });
}

export function pickupAdd(pid) {
  openModal({
    title: L('Add an authorised person', 'إضافة شخص مفوَّض'),
    sub: nameOf(D.person(pid)),
    body: (
      <>
        <div className="formgrid">
          <C.Field label={L('Name (English)', 'الاسم (إنكليزي)')} req={true} id="pk_en" />{' '}
          <C.Field label={L('Name (Arabic)', 'الاسم (عربي)')} dir="rtl" ar={true} id="pk_ar" />
        </div>{' '}
        <div className="formrow">
          <label htmlFor="pk_r" className="label">
            {L('Relationship', 'الصلة')}
          </label>
          <Select id="pk_r">
            <option>grandparent</option>
            <option>aunt</option>
            <option>uncle</option>
            <option>family friend</option>
          </Select>
        </div>{' '}
        <C.CheckRow label={L('ID checked by a member of staff', 'تحقّق موظّف من الهوية')} checked={true} />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="pk_go" style={{ marginInlineStart: 'auto' }}>
          {L('Authorise', 'تفويض')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#pk_go').addEventListener('click', () => {
        if (!need(el, '#pk_en', L('Enter a name', 'أدخل اسماً'))) return;
        const en = val(el, '#pk_en');
        D.PICKUP[pid] ||= { approved: [], restricted: [], required: true };
        D.PICKUP[pid].approved.push([en, val(el, '#pk_ar') || en, el.querySelector('#pk_r').value]);
        closeOverlays();
        refresh();
        ok(L('Authorised to collect', 'مفوَّض بالاستلام'), en);
      });
    }
  });
}

export function pickupRemove(pid, i) {
  const list = D.PICKUP[pid].approved;
  const [x] = list.splice(+i, 1);
  refresh();
  ok(L('No longer authorised', 'لم يعد مفوَّضاً'), L(x[0], x[1]), {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        list.splice(+i, 0, x);
        refresh();
      }
    }
  });
}

export function incidentNew() {
  openDrawer({
    title: L('Record an incident', 'تسجيل حادث'),
    sub: L(
      'Restricted to the priest and the safeguarding lead. Opening it is logged.',
      'مقيّد للكاهن ومسؤول الحماية. وفتحه يُسجَّل.'
    ),
    body: (
      <>
        <C.PersonPicker label={L('Child involved', 'الطفل المعني')} id="in_p" />{' '}
        <div className="formrow">
          <label htmlFor="in_room" className="label">
            {L('Where', 'أين')}
          </label>
          <Select id="in_room">
            {D.VENUES.map((v, i) => (
              <option key={i} value={v.id}>
                {L(v.name, v.ar)}
              </option>
            ))}
          </Select>
        </div>{' '}
        <C.Textarea label={L('What happened', 'ما حدث')} id="in_what" max={600} />{' '}
        <C.CheckRow label={L('Guardian informed', 'أُبلغ وليّ الأمر')} checked={true} />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="in_go" style={{ marginInlineStart: 'auto' }}>
          {L('Save report', 'حفظ التقرير')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#in_go').addEventListener('click', () => {
        if (!need(el, '#in_what', L('Describe what happened', 'صف ما حدث'))) return;
        const w = val(el, '#in_what');
        D.INCIDENTS.unshift({
          id: 'in' + Date.now(),
          at: '2026-10-04 19:31',
          room: el.querySelector('#in_room').value,
          what: w,
          whatAr: w,
          by: 'p16',
          restricted: true
        });
        closeOverlays();
        refresh();
        ok(L('Report saved', 'حُفظ التقرير'), L('Restricted and logged.', 'مقيّد ومسجَّل.'));
      });
    }
  });
}

export function incidentOpen(id) {
  const i = D.INCIDENTS.find(x => x.id === id) || D.INCIDENTS[0];
  openDrawer({
    title: L('Incident report', 'تقرير حادث'),
    sub: (
      <>
        <span className="mono">{i.at}</span> · {L(D.venue(i.room).name, D.venue(i.room).ar)}
      </>
    ),
    body: (
      <>
        <C.InlineAlert
          tone="warning"
          title={L('Restricted record', 'سجل مقيّد')}
          body={L('Your access to this report has been logged.', 'سُجّل وصولك إلى هذا التقرير.')}
        />{' '}
        <dl className="dl" style={{ marginTop: '16px' }}>
          <dt>{L('Recorded by', 'سجّله')}</dt>
          <dd>{nameOf(D.person(i.by))}</dd>
          <dt>{L('When', 'متى')}</dt>
          <dd className="mono">{i.at}</dd>
        </dl>{' '}
        <p className="t-body" style={{ marginTop: '14px', fontSize: '14px' }}>
          {L(i.what, i.whatAr)}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-secondary" id="io_print" style={{ marginInlineStart: 'auto' }}>
          <Icon name="print" size={16} />
          {L('Print', 'طباعة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#io_print').addEventListener('click', () => {
        closeOverlays();
        setTimeout(() => window.print(), 250);
      });
    }
  });
}
