/* Check-in dialogs: arrival, checkout with a verified collector, re-entry, and the authorised collectors
   of a registration, evacuation roll calls and incident reports. Main members: presenceDialog, arriveNow, collectorsDialog,
   removeCollector, startRollCall, markRollCall, closeRollCall, incidentDialog. A checkout of a participant with an issued
   pickup code also needs that code (typed, sent once, never kept). Incident reports go to the restricted incidents area.
   Arrival and departure are recorded by ParishLife.Api for an account that holds the check-in permission
   and is a door operator of the event; a checkout without independent departure needs one of the
   registration's authorised collectors and a note of how their identity was checked. Collectors change
   through the registration's amend route, which needs the registrations permission and a reason. */
import { t } from '../../../lib/i18n.js';
import { bus } from '../../model/store.js';
import { toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { Select } from '../../ui/components.jsx';
import {
  act,
  recordPresence,
  amendRegistration,
  startEvacuation,
  evacuationAction,
  recordIncident
} from '../../model/modules/registrations.js';
import { ask, collectorsText, parseCollectors, registrantName } from './registration-forms.jsx';

const L = (en, ar) => t(en, ar);
const get = (el, sel) => (el.querySelector(sel)?.value || '').trim();
const warn = (title, body = '') => toast(title, body, 'warning');
const done = (title, ok) => (ok && toast(title, '', 'success'), ok);

/* Arrival is recorded as happening now. */
export async function arriveNow(row) {
  if (await act(() => recordPresence(row, 'arrive'))) {
    bus.refresh();
    toast(L('Arrival recorded', 'سُجّل الوصول'), registrantName(row)?.lat || '', 'success');
  }
}

/* checkout or reenter; a checkout names the collector and how their identity was checked. */
export function presenceDialog(row, action) {
  const checkout = action === 'checkout';
  const needsCollector = checkout && !row.independentDeparture;
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  ask({
    title: checkout ? L('Check out', 'تسجيل خروج') : L('Re-entry', 'إعادة دخول'),
    sub: registrantName(row)?.lat || '',
    cta: checkout ? L('Check out', 'تسجيل خروج') : L('Record re-entry', 'سجّل إعادة الدخول'),
    rows: [
      needsCollector ? (
        <div className="formrow" key="c">
          <label className="label" htmlFor="pr-collector">
            {L('Collected by', 'المستلِم')}
          </label>
          <Select id="pr-collector">
            <option value="">{L('Choose an authorised person', 'اختر شخصاً مفوَّضاً')}</option>
            {row.collectors.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null,
      needsCollector ? (
        <C.Field
          key="v"
          label={L('How their identity was checked', 'كيف تحقّقت من هويته')}
          id="pr-verify"
          max={500}
          req={true}
        />
      ) : null,
      needsCollector && row.pickupCodeRequired ? (
        <C.Field
          key="code"
          label={L('Pickup code given by the collector', 'رمز الاستلام من المستلِم')}
          id="pr-code"
          max={32}
          req={true}
        />
      ) : null,
      checkout && row.independentDeparture ? (
        <p key="i" className="help">
          {L('This participant may leave on their own.', 'يمكن لهذا المشترك المغادرة بمفرده.')}
        </p>
      ) : null,
      <C.Field key="t" label={L('When it happened', 'متى حدث')} id="pr-time" type="datetime-local" value={local} />,
      <C.Field
        key="p"
        label={L(
          'Reason, if entered on paper later (needed after 15 minutes)',
          'السبب إن سُجّل لاحقاً على الورق (مطلوب بعد ١٥ دقيقة)'
        )}
        id="pr-paper"
        max={500}
        opt={true}
      />
    ],
    async onGo(el) {
      const collectorId = get(el, '#pr-collector'),
        verify = get(el, '#pr-verify'),
        when = get(el, '#pr-time');
      if (needsCollector && (!collectorId || !verify))
        return (warn(L('Name the collector and how they were checked', 'سمِّ المستلِم وكيف تحقّقت منه')), false);
      const code = get(el, '#pr-code');
      if (needsCollector && row.pickupCodeRequired && !code)
        return (warn(L('Enter the pickup code', 'أدخل رمز الاستلام')), false);
      if (!when) return (warn(L('Say when it happened', 'اذكر متى حدث')), false);
      return done(
        checkout ? L('Checked out', 'سُجّل الخروج') : L('Re-entry recorded', 'سُجّلت إعادة الدخول'),
        await act(() =>
          recordPresence(row, action, {
            occurredAt: new Date(when).toISOString(),
            collectorId: collectorId || null,
            verificationEvidence: verify || null,
            paperReason: get(el, '#pr-paper') || null,
            pickupCode: code || null
          })
        )
      );
    }
  });
}

/* Start a roll call from the participants recorded present (drill or emergency). */
export function startRollCall(eventId) {
  ask({
    title: L('Start a roll call', 'بدء تفقّد الحضور'),
    sub: L('Lists everyone recorded present now', 'يضمّ كل من سُجّل حضوره الآن'),
    cta: L('Start', 'ابدأ'),
    rows: [
      <div className="formrow" key="k">
        <label className="label" htmlFor="ev-kind">
          {L('Kind', 'النوع')}
        </label>
        <Select id="ev-kind">
          <option value="Drill">{L('Drill', 'تمرين')}</option>
          <option value="Emergency">{L('Emergency', 'طارئ')}</option>
        </Select>
      </div>,
      <C.Field key="n" label={L('Note', 'ملاحظة')} id="ev-note" max={2000} opt={true} />
    ],
    async onGo(el) {
      return done(
        L('Roll call started', 'بدأ التفقّد'),
        await act(() => startEvacuation(eventId, get(el, '#ev-kind'), get(el, '#ev-note')))
      );
    }
  });
}

export const markRollCall = async (eventId, rollCall, registrationId, accounted) =>
  act(() => evacuationAction(eventId, rollCall, accounted ? 'account' : 'unaccount', registrationId)).then(() =>
    bus.refresh()
  );

export function closeRollCall(eventId, rollCall) {
  ask({
    title: L('Close the roll call', 'إنهاء التفقّد'),
    sub: `${rollCall.accounted} / ${rollCall.total}`,
    cta: L('Close', 'أنهِ'),
    rows: [<C.Field key="n" label={L('Note', 'ملاحظة')} id="ev-close-note" max={2000} opt={true} />],
    async onGo(el) {
      return done(
        L('Roll call closed', 'انتهى التفقّد'),
        await act(() => evacuationAction(eventId, rollCall, 'close', null, get(el, '#ev-close-note')))
      );
    }
  });
}

/* A factual incident report linked to this event; it is protected and only incident handlers can read it. */
export function incidentDialog(eventId, people) {
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  ask({
    title: L('Report an incident', 'الإبلاغ عن حادث'),
    sub: L('Restricted: only incident handlers can read it', 'مقيّد: لا يقرؤه إلا المكلّفون بالحوادث'),
    cta: L('Record', 'سجّل'),
    rows: [
      <C.Field key="t" label={L('When it happened', 'متى حدث')} id="in-time" type="datetime-local" value={local} />,
      <C.Field key="l" label={L('Where', 'أين')} id="in-where" max={300} opt={true} />,
      <div className="formrow" key="p">
        <label className="label" htmlFor="in-person">
          {L('Participant involved (optional)', 'المشترك المعني (اختياري)')}
        </label>
        <Select id="in-person">
          <option value="">—</option>
          {people.map(r => (
            <option key={r.id} value={r.p}>
              {registrantName(r)?.lat || r.name || '—'}
            </option>
          ))}
        </Select>
      </div>,
      <C.Textarea key="d" label={L('What happened (facts only)', 'ماذا حدث (الوقائع فقط)')} id="in-what" max={8000} />,
      <C.Textarea key="a" label={L('Immediate actions taken', 'الإجراءات الفورية')} id="in-actions" max={4000} />,
      <C.Field key="w" label={L('Witnesses', 'الشهود')} id="in-witnesses" max={2000} opt={true} />,
      <C.CheckRow key="u" label={L('Urgent', 'عاجل')} id="in-urgent" />
    ],
    async onGo(el) {
      const description = get(el, '#in-what'),
        when = get(el, '#in-time');
      if (!description || !when) return (warn(L('Say what happened and when', 'اذكر ما حدث ومتى')), false);
      const person = get(el, '#in-person');
      return done(
        L('Incident recorded', 'سُجّل الحادث'),
        await act(() =>
          recordIncident(eventId, {
            occurredAt: new Date(when).toISOString(),
            location: get(el, '#in-where'),
            personIds: person ? [person] : [],
            description,
            immediateActions: get(el, '#in-actions'),
            witnesses: get(el, '#in-witnesses'),
            urgent: el.querySelector('#in-urgent').checked
          })
        )
      );
    }
  });
}

/* Replace the authorised collectors and whether the participant may leave alone. */
export function collectorsDialog(row) {
  ask({
    title: L('Authorised to collect', 'المفوَّضون بالاستلام'),
    sub: registrantName(row)?.lat || '',
    cta: L('Save', 'احفظ'),
    rows: [
      <C.Textarea
        key="c"
        label={L('One per line: name | how their authority was checked', 'سطر لكل شخص: الاسم | كيف تحقّقت صلاحيته')}
        id="cd-list"
        value={collectorsText(row.collectors)}
        max={2000}
      />,
      <C.CheckRow
        key="i"
        label={L('May leave on their own', 'يمكنه المغادرة بمفرده')}
        id="cd-alone"
        checked={row.independentDeparture}
      />,
      <C.Field key="r" label={L('Reason for the change', 'سبب التعديل')} id="cd-why" max={2000} />
    ],
    async onGo(el) {
      const reason = get(el, '#cd-why');
      if (!reason) return (warn(L('Say why you are changing it', 'اذكر سبب التعديل')), false);
      return done(
        L('Saved', 'تم الحفظ'),
        await act(() =>
          amendRegistration(row, {
            ...row,
            reason,
            collectors: parseCollectors(el.querySelector('#cd-list').value, row.collectors),
            independentDeparture: el.querySelector('#cd-alone').checked
          })
        )
      );
    }
  });
}

export function removeCollector(row, collectorId) {
  const gone = row.collectors.find(c => c.id === collectorId);
  if (!gone) return;
  ask({
    title: L('Remove authorisation', 'إلغاء التفويض'),
    sub: gone.name,
    cta: L('Remove', 'إزالة'),
    rows: [<C.Field key="r" label={L('Reason', 'السبب')} id="rc-why" max={2000} />],
    async onGo(el) {
      const reason = get(el, '#rc-why');
      if (!reason) return (warn(L('Give a reason', 'اذكر السبب')), false);
      return done(
        L('No longer authorised', 'لم يعد مفوَّضاً'),
        await act(() =>
          amendRegistration(row, { ...row, reason, collectors: row.collectors.filter(c => c.id !== collectorId) })
        )
      );
    }
  });
}
