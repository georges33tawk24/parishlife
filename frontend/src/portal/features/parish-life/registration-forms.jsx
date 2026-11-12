/* What a registration records about a participant, and the dialogs that act on it through ParishLife.Api:
   register someone, decide the seat (reserve, offer, confirm, cancel, reinstate), amend answers and
   collectors, record cash received and request a refund.
   Main members: registrationMoney, statusLabel/statusPill, consentPill, paymentPill, canCheckIn, registrantName,
   fieldInputs/readAnswers (the form's typed questions), collectorsText/parseCollectors, participantForm
   (register), registrantDrawer (manage one registration), receiptDialog, refundDialog, ask (a small
   reason/amount dialog). Every change calls the API (model/modules/registrations.js) and then reloads. */
import { Select } from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { session } from '../../model/api.js';
import { bus } from '../../model/store.js';
import { Pill, openDrawer, openModal, closeOverlays, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import {
  act,
  registerParticipant,
  decideRegistration,
  amendRegistration,
  recordReceipt,
  requestRefund
} from '../../model/modules/registrations.js';

const L = (en, ar) => t(en, ar);
const today = () => new Date().toLocaleDateString('sv-SE');

export const registrationMoney = (value, form) => {
  const digits = form?.precision ?? 2;
  return `${new Intl.NumberFormat(isAr() ? 'ar-LB' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value) || 0)} ${form?.currency || ''}`.trim();
};

/* ---------- how a registration reads ---------- */

const STATUS = {
  Submitted: ['Awaiting review', 'بانتظار المراجعة', 'warning'],
  Reserved: ['Reserved', 'محجوز', 'info'],
  Confirmed: ['Confirmed', 'مؤكّد', 'success'],
  Waitlisted: ['Waiting list', 'لائحة الانتظار', 'warning'],
  OfferExpired: ['Offer expired', 'انتهى العرض', 'warning'],
  Cancelled: ['Cancelled', 'ملغى', '']
};
export const statusLabel = status => (STATUS[status] ? L(STATUS[status][0], STATUS[status][1]) : status || '—');
export const statusPill = status => <Pill label={statusLabel(status)} tone={STATUS[status]?.[2] || ''} />;

/* the participant as the people list knows them, else the name the door or cashier view gave */
export const registrantName = row => {
  const p = D.person(row.p);
  return p ? p : row.name ? { id: row.p, lat: row.name, ar: row.name } : null;
};

export const consentPill = (row, form) =>
  !form?.consentRequired ? (
    <Pill label={L('Not required', 'غير مطلوبة')} />
  ) : row.consentEvidence ? (
    <Pill label={L('Recorded', 'مسجّلة')} tone="success" />
  ) : row.full ? (
    <Pill label={L('Consent pending', 'بانتظار الموافقة')} tone="warning" />
  ) : (
    <span className="dimmer">—</span>
  );

export function paymentPill(row) {
  const fee = Number(row.fee || 0);
  return fee <= 0 ? (
    <Pill label={L('No fee', 'دون رسم')} />
  ) : Number(row.outstanding || 0) <= 0 ? (
    <Pill label={L('Paid', 'مدفوع')} tone="success" />
  ) : Number(row.received || 0) > 0 ? (
    <Pill label={L('Partially paid', 'مدفوع جزئياً')} tone="warning" />
  ) : (
    <Pill label={L('Unpaid', 'غير مدفوع')} tone="warning" />
  );
}

export const canCheckIn = row => row.status === 'Confirmed';

export const registrationNext = row =>
  row.status === 'Submitted'
    ? L('Review application', 'راجع الطلب')
    : row.status === 'Waitlisted' || row.status === 'OfferExpired'
      ? L('Offer a place', 'اعرض مقعداً')
      : row.status === 'Reserved'
        ? L('Confirm place', 'ثبّت المقعد')
        : Number(row.outstanding || 0) > 0
          ? L('Record payment', 'سجّل دفعة')
          : L('View / edit', 'عرض / تعديل');

/* ---------- the form's typed questions ---------- */

const FIELD_TYPES = ['Text', 'Choice', 'Boolean', 'Number', 'Date'];
export const fieldTypeLabel = type =>
  ({
    Text: L('Text', 'نص'),
    Choice: L('Choice', 'اختيار'),
    Boolean: L('Yes / no', 'نعم / لا'),
    Number: L('Number', 'رقم'),
    Date: L('Date', 'تاريخ')
  })[type] || type;
export { FIELD_TYPES };

/* inputs for each question; ids are `ans-<key>` and a conditional question shows with its trigger */
export const fieldInputs = (fields, answers = {}) =>
  (fields || []).map(f => {
    const id = 'ans-' + f.key,
      label = f.label + (f.required ? ' *' : '');
    const control =
      f.type === 'Choice' ? (
        <Select id={id} defaultValue={answers[f.key] || ''}>
          <option value="">{L('Choose', 'اختر')}</option>
          {f.options.map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      ) : f.type === 'Boolean' ? (
        <Select id={id} defaultValue={answers[f.key] || ''}>
          <option value="">{L('Not answered', 'دون جواب')}</option>
          <option value="true">{L('Yes', 'نعم')}</option>
          <option value="false">{L('No', 'لا')}</option>
        </Select>
      ) : (
        <input
          className="input"
          id={id}
          type={f.type === 'Number' ? 'number' : f.type === 'Date' ? 'date' : 'text'}
          step={f.type === 'Number' ? 'any' : undefined}
          defaultValue={answers[f.key] || ''}
        />
      );
    return (
      <div className="formrow" key={f.key} data-field={f.key}>
        <label className="label" htmlFor={id}>
          {label}
        </label>
        {control}
        {f.visibleWhenField ? (
          <span className="help">
            {L('Asked when', 'يُسأل عندما')} “{f.visibleWhenField}” = {f.visibleWhenValue}
          </span>
        ) : null}
      </div>
    );
  });

/* The answers to the questions that apply (a hidden question's answer is left out, as the API requires). */
export function readAnswers(el, fields) {
  const answers = {};
  for (const f of fields || []) {
    const input = el.querySelector('#ans-' + f.key);
    const value = (input?.value || '').trim();
    const shown = !f.visibleWhenField || answers[f.visibleWhenField] === f.visibleWhenValue;
    if (shown && value) answers[f.key] = value;
  }
  return answers;
}

/* ---------- authorised collectors: one per line, "Name | how their authority was checked" ---------- */

export const collectorsText = collectors =>
  (collectors || []).map(c => `${c.name} | ${c.authorityEvidence || ''}`).join('\n');

export function parseCollectors(text, existing = []) {
  const taken = new Set(existing.map(c => c.id));
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name, ...rest] = line.split('|');
      const old = existing.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
      let id = old?.id;
      if (!id) {
        do id = 'c-' + crypto.randomUUID().slice(0, 8);
        while (taken.has(id));
        taken.add(id);
      }
      return { id, name: name.trim(), authorityEvidence: rest.join('|').trim() };
    });
}

/* ---------- small dialogs ---------- */

/* One question dialog: `rows` are Field/Textarea elements; onGo(el) returns true to close. */
export function ask({ title, sub, rows, cta, onGo }) {
  openModal({
    title,
    sub,
    body: <>{rows}</>,
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="ask-go" style={{ marginInlineStart: 'auto' }}>
          {cta}
        </button>
      </>
    ),
    onMount(el) {
      const go = el.querySelector('#ask-go');
      go.addEventListener('click', async () => {
        go.disabled = true;
        const done = await onGo(el);
        go.disabled = false;
        if (done) {
          closeOverlays();
          bus.refresh();
        }
      });
    }
  });
}

const get = (el, sel) => (el.querySelector(sel)?.value || '').trim();
const warn = (title, body = '') => toast(title, body, 'warning');
const instant = date =>
  !date || date === today() ? new Date().toISOString() : new Date(`${date}T12:00:00Z`).toISOString();

/* Seat decisions need a reason; an offer also needs the time it stays open (before the event). */
export function decideDialog(row, action, form) {
  const names = {
    reserve: L('Reserve a place', 'احجز مقعداً'),
    offer: L('Offer a place', 'اعرض مقعداً'),
    confirm: L('Confirm the place', 'ثبّت المقعد'),
    cancel: L('Cancel this registration', 'إلغاء هذا التسجيل'),
    reinstate: L('Reinstate this registration', 'إعادة هذا التسجيل')
  };
  ask({
    title: names[action],
    sub: statusLabel(row.status),
    cta: names[action],
    rows: [
      action === 'offer' ? (
        <C.Field
          key="until"
          label={L('Offer stays open until (before the event)', 'يبقى العرض مفتوحاً حتى (قبل الحدث)')}
          type="datetime-local"
          id="dc-until"
          req={true}
        />
      ) : null,
      <C.Textarea key="why" label={L('Reason', 'السبب')} id="dc-why" max={2000} />,
      action === 'cancel' ? (
        <p key="note" className="help">
          {L(
            'Cancelling never refunds money. A refund is a separate request, approved by someone else.',
            'الإلغاء لا يسترجع المال. الاسترجاع طلب مستقل يوافق عليه شخص آخر.'
          )}
        </p>
      ) : null
    ],
    async onGo(el) {
      const reason = get(el, '#dc-why');
      if (!reason) return (warn(L('Give a reason', 'اذكر السبب')), false);
      let until = null;
      if (action === 'offer') {
        until = get(el, '#dc-until');
        if (!until || new Date(until) <= new Date())
          return (warn(L('Choose a future time for the offer', 'اختر وقتاً مستقبلياً للعرض')), false);
        until = new Date(until).toISOString();
      }
      return act(() => decideRegistration(row, action, reason, until)).then(ok => {
        if (ok) toast(names[action], '', 'success');
        return ok;
      });
    }
  });
}

export function receiptDialog(row, form) {
  ask({
    title: L('Record cash received', 'تسجيل مبلغ مستلم'),
    sub: `${registrantName(row)?.lat || ''} · ${L('balance', 'المتبقّي')} ${registrationMoney(row.outstanding, row)}`,
    cta: L('Record', 'سجّل'),
    rows: [
      <C.Field
        key="a"
        label={`${L('Amount received', 'المبلغ المستلم')} (${row.currency})`}
        id="rc-amount"
        type="number"
        req={true}
        min="0"
        step="any"
      />,
      <C.Field
        key="e"
        label={L('Receipt or payment reference', 'مرجع الإيصال أو الدفعة')}
        id="rc-ref"
        req={true}
        max={500}
      />,
      <C.Field
        key="d"
        label={L('Date received', 'تاريخ الاستلام')}
        id="rc-date"
        type="date"
        value={today()}
        max={today()}
      />,
      <p key="n" className="help">
        {L(
          'Only cash actually received, in the fee currency, up to the balance.',
          'النقد المستلم فعلاً فقط، بعملة الرسم، وبحدّ الرصيد المتبقّي.'
        )}
      </p>
    ],
    async onGo(el) {
      const amount = Number(get(el, '#rc-amount')),
        reference = get(el, '#rc-ref');
      if (!(amount > 0) || amount > Number(row.outstanding) + 1e-9 || !reference)
        return (warn(L('Check the amount and reference', 'راجع المبلغ والمرجع')), false);
      return act(() =>
        recordReceipt(row, {
          amount: Number(amount.toFixed(row.precision)),
          evidenceReference: reference,
          occurredAt: instant(get(el, '#rc-date'))
        })
      ).then(ok => {
        if (ok) toast(L('Payment recorded', 'سُجّلت الدفعة'), '', 'success');
        return ok;
      });
    }
  });
}

export function refundDialog(row) {
  const refundable = Math.max(0, Number(row.received) - Number(row.refunded));
  ask({
    title: L('Request a refund', 'طلب استرجاع'),
    sub: `${registrantName(row)?.lat || ''} · ${L('received', 'مستلم')} ${registrationMoney(row.received, row)}`,
    cta: L('Request refund', 'اطلب الاسترجاع'),
    rows: [
      <C.Field
        key="a"
        label={`${L('Amount', 'المبلغ')} (${row.currency})`}
        id="rf-amount"
        type="number"
        req={true}
        min="0"
        step="any"
        help={`${L('At most', 'الحد الأقصى')} ${registrationMoney(refundable, row)}`}
      />,
      <C.Textarea key="r" label={L('Reason', 'السبب')} id="rf-why" max={2000} />,
      <p key="n" className="help">
        {L(
          'Someone else approves it, and a third person (not the approver) records the actual repayment.',
          'يوافق عليه شخص آخر، ويسجّل شخص ثالث (ليس الموافق) الدفع الفعلي.'
        )}
      </p>
    ],
    async onGo(el) {
      const amount = Number(get(el, '#rf-amount')),
        reason = get(el, '#rf-why');
      if (!(amount > 0) || amount > refundable + 1e-9 || !reason)
        return (warn(L('Check the amount and reason', 'راجع المبلغ والسبب')), false);
      return act(() => requestRefund(row, { amount: Number(amount.toFixed(row.precision)), reason })).then(ok => {
        if (ok) toast(L('Refund requested', 'طُلب الاسترجاع'), '', 'success');
        return ok;
      });
    }
  });
}

/* ---------- register a participant ---------- */

export function participantForm(form) {
  if (!form || !form.known) return toast(L('Select a registration form', 'اختر استمارة تسجيل'), '', 'warning');
  if (!form.open) return toast(L('Registration is not open', 'التسجيل غير مفتوح'), '', 'warning');
  const registered = new Set(D.REGISTRANTS.filter(r => r.eventId === form.eventId).map(r => r.p));
  const people = D.PEOPLE.filter(p => !registered.has(p.id)).sort((a, b) => a.lat.localeCompare(b.lat));
  openDrawer({
    large: true,
    title: L('Register participant', 'تسجيل مشترك'),
    sub: `${L(form.event, form.eventAr)} · ${fmtDate(form.d)}`,
    body: (
      <form id="participant-form">
        <div className="formrow">
          <label className="label" htmlFor="rp-person">
            {L('Participant', 'المشترك')}
          </label>
          <Select id="rp-person" required>
            <option value="">{L('Choose a person', 'اختر شخصاً')}</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>
                {p.lat}
                {p.ar && p.ar !== p.lat ? ` · ${p.ar}` : ''}
              </option>
            ))}
          </Select>
          <span className="help">
            {L(
              'A date of birth must be on the person’s record: the API checks the age limits with it.',
              'يجب أن يكون تاريخ الولادة في سجل الشخص: يتحقّق الخادم من حدود العمر به.'
            )}
          </span>
        </div>{' '}
        {fieldInputs(form.fields)}
        <C.CheckRow label={L('Needs the parish transport', 'يحتاج إلى نقل الرعية')} id="rp-transport" />{' '}
        {form.consentRequired ? (
          <>
            <p className="help">{form.consentText}</p>
            <C.Field
              label={L('Consent evidence (how and when it was given)', 'دليل الموافقة (كيف ومتى أُعطيت)')}
              id="rp-consent"
              max={500}
            />
          </>
        ) : null}
        <C.Field
          label={L('Guardian authority (for a child)', 'سلطة وليّ الأمر (للقاصر)')}
          id="rp-guardian"
          max={500}
          opt={true}
        />{' '}
        <C.Textarea
          label={L(
            'Authorised to collect (one per line: name | how their authority was checked)',
            'المفوَّضون بالاستلام (سطر لكل شخص: الاسم | كيف تحقّقت صلاحيته)'
          )}
          id="rp-collectors"
          max={2000}
        />{' '}
        <C.CheckRow label={L('May leave on their own', 'يمكنه المغادرة بمفرده')} id="rp-independent" />
      </form>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="rp-save">
          {L('Register', 'سجّل')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('form').addEventListener('submit', e => e.preventDefault());
      const save = el.querySelector('#rp-save');
      save.onclick = async () => {
        const personId = get(el, '#rp-person');
        if (!personId) return warn(L('Choose a person', 'اختر شخصاً'));
        save.disabled = true;
        const ok = await act(() =>
          registerParticipant(form, {
            personId,
            answers: readAnswers(el, form.fields),
            transport: el.querySelector('#rp-transport').checked,
            consentEvidence: get(el, '#rp-consent') || null,
            guardianAuthorityEvidence: get(el, '#rp-guardian') || null,
            collectors: parseCollectors(el.querySelector('#rp-collectors').value),
            independentDeparture: el.querySelector('#rp-independent').checked
          })
        );
        save.disabled = false;
        if (!ok) return;
        closeOverlays();
        bus.refresh();
        toast(L('Participant registered', 'سُجّل المشترك'), '', 'success');
      };
    }
  });
}

/* ---------- one registration: seat decisions, amendments, money ---------- */

export function registrantDrawer(row, form) {
  const p = registrantName(row);
  const actions =
    {
      Submitted: ['reserve', 'offer', 'confirm', 'cancel'],
      Reserved: ['confirm', 'cancel'],
      Waitlisted: ['offer', 'confirm', 'cancel'],
      OfferExpired: ['offer', 'confirm', 'cancel'],
      Confirmed: ['cancel'],
      Cancelled: ['reinstate']
    }[row.status] || [];
  const label = {
    reserve: L('Reserve', 'احجز'),
    offer: L('Offer a place', 'اعرض مقعداً'),
    confirm: L('Confirm', 'ثبّت'),
    cancel: L('Cancel registration', 'إلغاء التسجيل'),
    reinstate: L('Reinstate', 'أعد')
  };
  openDrawer({
    large: true,
    title: p?.lat || L('Registration', 'التسجيل'),
    sub: `${L(form.event, form.eventAr)} · ${statusLabel(row.status)}`,
    body: (
      <>
        <dl className="dl">
          <dt>{L('Fee', 'الرسم')}</dt>
          <dd>{registrationMoney(row.fee, row)}</dd>
          <dt>{L('Received', 'المستلم')}</dt>
          <dd>{registrationMoney(row.received, row)}</dd>
          <dt>{L('Refunded', 'المسترجع')}</dt>
          <dd>{registrationMoney(row.refunded, row)}</dd>
          <dt>{L('Balance', 'المتبقّي')}</dt>
          <dd>{registrationMoney(row.outstanding, row)}</dd>
          {row.offerUntil ? (
            <>
              <dt>{L('Offer open until', 'العرض مفتوح حتى')}</dt>
              <dd>{new Date(row.offerUntil).toLocaleString()}</dd>
            </>
          ) : null}
        </dl>{' '}
        {row.full ? (
          <form id="amend-form">
            <h3 style={{ marginTop: '16px' }}>{L('Answers and arrangements', 'الأجوبة والترتيبات')}</h3>
            {fieldInputs(form.fields, row.answers)}
            <C.CheckRow
              label={L('Needs the parish transport', 'يحتاج إلى نقل الرعية')}
              id="am-transport"
              checked={row.transport}
            />{' '}
            {form.consentRequired ? (
              <C.Field
                label={L('Consent evidence', 'دليل الموافقة')}
                id="am-consent"
                value={row.consentEvidence}
                max={500}
              />
            ) : null}
            <C.Field
              label={L('Guardian authority', 'سلطة وليّ الأمر')}
              id="am-guardian"
              value={row.guardianAuthorityEvidence}
              max={500}
              opt={true}
            />{' '}
            <C.Textarea
              label={L('Authorised to collect (name | authority checked)', 'المفوَّضون بالاستلام (الاسم | الصلاحية)')}
              id="am-collectors"
              value={collectorsText(row.collectors)}
              max={2000}
            />{' '}
            <C.CheckRow
              label={L('May leave on their own', 'يمكنه المغادرة بمفرده')}
              id="am-independent"
              checked={row.independentDeparture}
            />{' '}
            <C.Field label={L('Reason for the change', 'سبب التعديل')} id="am-reason" max={2000} />
          </form>
        ) : (
          <p className="help">
            {L(
              'This account cannot read the registration’s answers; seat decisions and amendments need the registrations permission.',
              'لا يستطيع هذا الحساب قراءة أجوبة التسجيل؛ تحتاج القرارات والتعديلات إلى صلاحية التسجيلات.'
            )}
          </p>
        )}
      </>
    ),
    foot: (
      <>
        {actions.map(a => (
          <button key={a} className="btn btn-secondary" data-decide={a} disabled={!row.full}>
            {label[a]}
          </button>
        ))}
        <span style={{ marginInlineStart: 'auto' }} />
        {row.full && row.status !== 'Cancelled' && Number(row.outstanding) > 0 ? (
          <button className="btn btn-secondary" id="rd-receipt">
            {L('Record payment', 'سجّل دفعة')}
          </button>
        ) : null}
        {Number(row.received) - Number(row.refunded) > 0 ? (
          <button className="btn btn-secondary" id="rd-refund">
            {L('Request refund', 'اطلب استرجاعاً')}
          </button>
        ) : null}
        {row.full ? (
          <button className="btn btn-primary" id="am-save">
            {L('Save changes', 'احفظ التعديلات')}
          </button>
        ) : null}
      </>
    ),
    onMount(el) {
      el.querySelectorAll('[data-decide]').forEach(b =>
        b.addEventListener('click', () => decideDialog(row, b.dataset.decide, form))
      );
      el.querySelector('#rd-receipt')?.addEventListener('click', () => receiptDialog(row, form));
      el.querySelector('#rd-refund')?.addEventListener('click', () => refundDialog(row));
      const save = el.querySelector('#am-save');
      if (save)
        save.onclick = async () => {
          const reason = get(el, '#am-reason');
          if (!reason) return warn(L('Say why you are changing it', 'اذكر سبب التعديل'));
          save.disabled = true;
          const ok = await act(() =>
            amendRegistration(row, {
              reason,
              answers: readAnswers(el, form.fields),
              transport: el.querySelector('#am-transport').checked,
              consentEvidence: get(el, '#am-consent') || null,
              guardianAuthorityEvidence: get(el, '#am-guardian') || null,
              collectors: parseCollectors(el.querySelector('#am-collectors').value, row.collectors),
              independentDeparture: el.querySelector('#am-independent').checked
            })
          );
          save.disabled = false;
          if (!ok) return;
          closeOverlays();
          bus.refresh();
          toast(L('Registration updated', 'حُدّث التسجيل'), '', 'success');
        };
    }
  });
}
