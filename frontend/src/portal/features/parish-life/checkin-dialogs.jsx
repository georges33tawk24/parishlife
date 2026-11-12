/* Check-in dialogs: arrival, checkout with a verified collector, re-entry, and the authorised collectors
   of a registration. Main members: presenceDialog, arriveNow, collectorsDialog, removeCollector.
   Arrival and departure are recorded by ParishLife.Api for an account that holds the check-in permission
   and is a door operator of the event; a checkout without independent departure needs one of the
   registration's authorised collectors and a note of how their identity was checked. Collectors change
   through the registration's amend route, which needs the registrations permission and a reason. */
import { t } from '../../../lib/i18n.js';
import { bus } from '../../model/store.js';
import { toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { Select } from '../../ui/components.jsx';
import { act, recordPresence, amendRegistration } from '../../model/modules/registrations.js';
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
      if (!when) return (warn(L('Say when it happened', 'اذكر متى حدث')), false);
      return done(
        checkout ? L('Checked out', 'سُجّل الخروج') : L('Re-entry recorded', 'سُجّلت إعادة الدخول'),
        await act(() =>
          recordPresence(row, action, {
            occurredAt: new Date(when).toISOString(),
            collectorId: collectorId || null,
            verificationEvidence: verify || null,
            paperReason: get(el, '#pr-paper') || null
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
