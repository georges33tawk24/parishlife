import { Select } from "../ui/components.jsx";
/* Registration facts remain independent: a seat, applicable consent, transport, and actual payments. */
import * as D from "../model/data.js";
import { t, isAr, fmtDate } from "../../lib/i18n.js";
import { session } from "../model/api.js";
import { persist } from "../model/persist.js";
import { bus } from "../model/store.js";
import { Pill, openDrawer, closeOverlays, toast } from "../ui/ui.jsx";
import * as C from "../ui/components.jsx";
const L = (en, ar) => t(en, ar);
const today = () => new Date().toLocaleDateString('sv-SE');
export const registrationCurrency = form => form?.currency || 'USD';
export const registrationMoney = (value, form) => `${new Intl.NumberFormat(isAr() ? 'ar-LB' : 'en-US', {
  minimumFractionDigits: registrationCurrency(form) === 'LBP' ? 0 : 2,
  maximumFractionDigits: registrationCurrency(form) === 'LBP' ? 0 : 2
}).format(Number(value) || 0)} ${registrationCurrency(form)}`;
export function consentInfo(form, personId) {
  if (form?.consentRequired || (form?.fields || []).some(field => field[2] === 'consent' && field[3])) return {
    required: true,
    unknown: false
  };
  if (!form?.parentalConsent) return {
    required: false,
    unknown: false
  };
  const born = D.person(personId)?.born,
    date = D.EVENTS.find(e => e.id === form.eventId)?.d;
  const birthday = new Date(`${born}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(born || '') || !Number.isFinite(birthday.getTime()) || birthday.toISOString().slice(0, 10) !== born || !date || born > date) return {
    required: true,
    unknown: true
  };
  const age = Number(date.slice(0, 4)) - Number(born.slice(0, 4)) - (date.slice(5) < born.slice(5) ? 1 : 0);
  return {
    required: age < 18,
    unknown: false
  };
}
export const transportOptions = form => form?.transportOptions || [];
export const transportLabel = (row, form) => {
  if (!row.transport) return L('Not specified', 'غير محدّد');
  const option = transportOptions(form).find(x => x.id === row.transport);
  const label = option ? L(option.name, option.nameAr || option.name) : row.transport === 'own' ? L('Own transport', 'نقل خاص') : row.transport === 'bus' ? L('Bus', 'باص') : row.transport;
  const fee = Number(row.transportFee ?? option?.fee ?? 0);
  return label + (fee ? ` (+${registrationMoney(fee, form)})` : '');
};
export const registrationDue = (row, form) => Number(row.baseFee ?? form?.fee ?? 0) + Number(row.transportFee ?? transportOptions(form).find(x => x.id === row.transport)?.fee ?? 0);
export const placeLabel = row => row.status === 'registered' ? L('Confirmed', 'مؤكّد') : row.status === 'awaiting-approval' ? L('Awaiting review', 'بانتظار المراجعة') : row.status === 'cancelled' ? L('Cancelled', 'ملغى') : L('Reserved', 'محجوز');
export const consentPill = (row, form) => !consentInfo(form, row.p).required ? <Pill label={L('Not required', 'غير مطلوبة')} /> : row.consent ? <Pill label={L('Received', 'مستلمة')} tone='success' /> : <Pill label={consentInfo(form, row.p).unknown ? L('Age / consent to review', 'مراجعة العمر / الموافقة') : L('Consent pending', 'بانتظار الموافقة')} tone='warning' />;
export function paymentPill(row, form) {
  const due = registrationDue(row, form),
    paid = Number(row.paid || 0);
  return due <= 0 ? <Pill label={L('No fee', 'دون رسم')} /> : paid >= due ? <Pill label={L('Paid', 'مدفوع')} tone='success' /> : paid > 0 ? <Pill label={L('Partially paid', 'مدفوع جزئياً')} tone='warning' /> : <Pill label={L('Unpaid', 'غير مدفوع')} tone='warning' />;
}
export const canCheckIn = (row, form) => row.status === 'registered' && (!(row.consentRequired ?? consentInfo(form, row.p).required) || row.consent);
export function participantForm(form, record = null) {
  const event = D.EVENTS.find(e => e.id === form?.eventId);
  if (!form || !event) return toast(L('Select a form linked to an event', 'اختر استمارة مرتبطة بحدث'), '', 'warning');
  if (!record && (!form.open || form.taken >= form.cap)) return toast(L('Registration is closed or full', 'التسجيل مغلق أو مكتمل'), '', 'warning');
  const registered = new Set(D.REGISTRANTS.filter(row => D.REGISTRATIONS.some(other => other.id === row.registrationId && other.eventId === event.id)).map(row => row.p));
  const people = D.PEOPLE.filter(p => p.id === record?.p || !registered.has(p.id)).sort((a, b) => a.lat.localeCompare(b.lat));
  const options = [...transportOptions(form)];
  if (record?.transport && !options.some(x => x.id === record.transport)) options.push({
    id: record.transport,
    name: transportLabel(record, form),
    nameAr: transportLabel(record, form),
    fee: record.transportFee || 0
  });
  openDrawer({
    large: true,
    title: record ? L('Edit participant', 'تعديل المشترك') : L('Register participant', 'تسجيل مشترك'),
    sub: `${L(event.title, event.titleAr)} · ${fmtDate(event.d)}`,
    body: <form id="participant-form"><div className="formrow"><label className="label" htmlFor="rp-person">{L('Participant', 'المشترك')}</label><Select id="rp-person" required disabled={!!record}><option value="">{L('Choose a person', 'اختر شخصاً')}</option>{people.map(p => <option value={p.id} selected={!!(p.id === record?.p)}>{p.lat} · {p.ar}</option>)}</Select></div>{" "}<section className="registration-section"><h3>{L('Place and consent', 'المقعد والموافقة')}</h3><p className="help">{L('Reserve a place now, or confirm it when the required information is complete. Payment is recorded separately below.', 'احجز مقعداً الآن أو ثبّته عند اكتمال المعلومات المطلوبة. تُسجّل الدفعة بصورة مستقلة أدناه.')}</p>{" "}<div className="formrow"><label className="label" htmlFor="rp-status">{L('Place status', 'حالة المقعد')}</label><Select id="rp-status" disabled={!!(record?.status === 'cancelled')}>{record?.status === 'awaiting-approval' ? <option value="awaiting-approval">{L('Awaiting review', 'بانتظار المراجعة')}</option> : ''}{record?.status === 'cancelled' ? <option value="cancelled">{L('Cancelled', 'ملغى')}</option> : ''}<option value="pending" selected={!!(!record || ['pending', 'paid'].includes(record.status))}>{L('Reserved', 'محجوز')}</option><option value="registered" selected={!!(record?.status === 'registered')}>{L('Confirmed', 'مؤكّد')}</option></Select></div>{" "}<div id="rp-consent-area"><label className="check"><input id="rp-consent" type="checkbox" defaultChecked={!!record?.consent} disabled={!!record?.consent} /><span>{L('Required consent has actually been received', 'استُلمت الموافقة المطلوبة فعلياً')}</span></label></div><p className="help" id="rp-consent-help" /></section>{" "}<section className="registration-section"><h3>{L('Transport', 'النقل')}</h3><label className="label" htmlFor="rp-transport">{L('Transport choice', 'اختيار النقل')}</label><Select id="rp-transport"><option value="">{L('Not specified', 'غير محدّد')}</option>{options.map(option => <option value={option.id} selected={!!(record?.transport === option.id)}>{L(option.name, option.nameAr || option.name)}{option.fee ? ` (+${registrationMoney(option.fee, form)})` : ''}</option>)}</Select>{options.length ? '' : <p className="help">{L('No transport options are configured for this event. Edit the event registration form to add them.', 'لم تُضبط خيارات النقل لهذا الحدث. عدّل استمارة التسجيل لإضافتها.')}</p>}</section>{" "}<section className="registration-section"><h3>{L('Payment received', 'الدفعة المستلمة')}</h3><p id="rp-balance" className="help" /><p className="help">{L('Leave the amount empty unless a payment has been received. Payments use the event currency; they do not confirm a place.', 'اترك المبلغ فارغاً إذا لم تُستلم دفعة. تُسجّل الدفعات بعملة الحدث ولا تؤكّد المقعد.')}</p><div className="formgrid"><C.Field label={L('Amount received', 'المبلغ المستلم') + ' (' + registrationCurrency(form) + ')'} id='rp-amount' type='number' value='' />{" "}<div className="formrow"><label className="label" htmlFor="rp-currency">{L('Currency', 'العملة')}</label><input className="input" id="rp-currency" defaultValue={registrationCurrency(form)} readOnly /></div>{" "}<div className="formrow"><label className="label" htmlFor="rp-method">{L('Method', 'الطريقة')}</label><Select id="rp-method"><option value="">{L('Select method', 'اختر الطريقة')}</option><option value="cash">{L('Cash', 'نقداً')}</option><option value="bank">{L('Bank transfer', 'تحويل مصرفي')}</option><option value="omt">OMT</option></Select></div>{" "}<C.Field label={L('Payment date', 'تاريخ الدفعة')} id='rp-date' type='date' value={today()} /></div><C.Field label={L('Payment reference (optional)', 'مرجع الدفعة (اختياري)')} id='rp-reference' max={120} />{" "}{record?.payments?.length ? <details><summary>{L('Payment history', 'سجل الدفعات')} ({record.payments.length})</summary>{record.payments.map(payment => <div className="listrow"><span>{fmtDate(payment.at)} · {payment.method} · {payment.reference || ''}</span><b>{registrationMoney(payment.amount, form)}</b></div>)}</details> : ''}</section></form>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="rp-save">{L('Save participant', 'حفظ المشترك')}</button></>,
    onMount(el) {
      el.querySelector('form').addEventListener('submit', e => e.preventDefault());
      let saving = false;
      const get = id => el.querySelector('#rp-' + id),
        value = id => get(id).value.trim();
      get('amount').min = '0';
      get('amount').step = 'any';
      get('date').max = today();
      const chosenFee = () => record?.transport === value('transport') && record?.transportFee != null ? record.transportFee : Number(options.find(x => x.id === value('transport'))?.fee || 0);
      const update = () => {
        const info = consentInfo(form, value('person'));
        get('consent-area').hidden = !info.required;
        get('consent-help').textContent = info.unknown ? L('Date of birth is missing or invalid. Review age, or record parental consent before confirming. A seat can be reserved now.', 'تاريخ الولادة غير متوفّر أو غير صالح. راجع العمر أو سجّل موافقة الأهل قبل التثبيت. يمكن حجز مقعد الآن.') : info.required ? L('A place can be reserved while consent is pending. Receive consent before final confirmation and check-in.', 'يمكن حجز مقعد بانتظار الموافقة. استلمها قبل التثبيت والوصول.') : L('Consent is not required for this participant under this event’s settings.', 'لا تتطلّب إعدادات هذا الحدث موافقة لهذا المشترك.');
        const due = Number(record?.baseFee ?? form.fee ?? 0) + chosenFee();
        get('balance').textContent = `${L('Total fee', 'الرسم الإجمالي')}: ${registrationMoney(due, form)} · ${L('Already paid', 'المدفوع سابقاً')}: ${registrationMoney(record?.paid || 0, form)} · ${L('Balance', 'المتبقّي')}: ${registrationMoney(Math.max(0, due - Number(record?.paid || 0)), form)}`;
      };
      ['person', 'transport', 'consent'].forEach(id => get(id).addEventListener('change', update));
      update();
      get('save').onclick = async () => {
        if (saving || !el.querySelector('form').reportValidity()) return;
        const personId = value('person'),
          info = consentInfo(form, personId),
          consent = !!get('consent').checked,
          status = value('status');
        if (!personId) return;
        if (status === 'registered' && info.required && !consent) return toast(L('Consent is pending', 'الموافقة معلّقة'), L('Record received consent here, or save the place as Reserved.', 'سجّل الموافقة المستلمة هنا أو احفظ المقعد كمحجوز.'), 'warning');
        const amount = Number(value('amount') || 0),
          due = Number(record?.baseFee ?? form.fee ?? 0) + chosenFee(),
          balance = Math.max(0, due - Number(record?.paid || 0));
        if (!Number.isFinite(amount) || amount < 0 || amount > balance + 0.001 || amount > 0 && (!value('method') || !value('date') || value('date') > today())) return toast(L('Check payment details', 'راجع تفاصيل الدفعة'), L('Enter a received amount within the balance, its method and date.', 'أدخل مبلغاً مستلماً لا يتجاوز الرصيد مع الطريقة والتاريخ.'), 'warning');
        saving = true;
        get('save').disabled = true;
        const row = record || {
          id: 'rgr-' + crypto.randomUUID(),
          registrationId: form.id,
          p: personId,
          paid: 0,
          payments: []
        };
        Object.assign(row, {
          status,
          consent,
          transport: value('transport'),
          transportFee: chosenFee(),
          baseFee: Number(row.baseFee ?? form.fee ?? 0)
        });
        if (amount > 0) {
          row.payments ||= [];
          row.payments.push({
            amount,
            currency: registrationCurrency(form),
            method: value('method'),
            at: value('date'),
            reference: value('reference'),
            by: session.user.id
          });
          row.paid = Number((Number(row.paid || 0) + amount).toFixed(2));
        }
        if (!record) {
          D.REGISTRANTS.push(row);
          form.taken = Number(form.taken || 0) + 1;
        }
        if (!(await persist())) {
          closeOverlays();
          bus.refresh();
          return;
        }
        closeOverlays();
        bus.refresh();
        toast(L('Participant saved', 'حُفظ المشترك'), '', 'success');
      };
    }
  });
}