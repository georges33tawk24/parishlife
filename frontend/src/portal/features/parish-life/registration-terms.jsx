/* Editing a registration policy after it was created, and registering several members of one household together.
   Main members: termsDialog (capacity, fee, ages, consent, door operators, deadline, discounts, instalments, payment
   methods, muster point, with a reason) and householdDialog (choose a household and its members; every chosen member
   gets the same answers and arrangements, which can be amended one by one afterwards). Both call ParishLife.Api through
   model/modules/registrations.js and reload; the API enforces seats, the currency lock, the deadline and membership.
   Values are typed by the parish; nothing here suggests a fee, age or discount. */
import { Select } from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { t } from '../../../lib/i18n.js';
import { toast, openDrawer, closeOverlays } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { bus } from '../../model/store.js';
import { act, reviseTerms, registerHousehold } from '../../model/modules/registrations.js';
import { METHOD_LABELS, fieldInputs, readAnswers, parseCollectors } from './registration-forms.jsx';
import { val } from '../../shared/dialog-helpers.jsx';

const L = (en, ar) => t(en, ar);
const warn = (title, body = '') => toast(title, body, 'warning');
const num = (el, sel) => {
  const v = val(el, sel);
  return v === '' ? null : Number(v);
};
const localInput = iso =>
  iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

/* "key | name | Arabic name | amount" per line */
const discountsText = list => list.map(x => [x.key, x.name, x.nameAr || '', x.amount].join(' | ')).join('\n');
function parseDiscounts(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [key, name, nameAr, amount] = l.split('|').map(s => s.trim());
      return { key, name, nameAr: nameAr || null, amount: Number(amount) };
    });
}
/* "YYYY-MM-DD | amount" per line */
const instalmentsText = list => list.map(x => `${x.dueOn} | ${x.amount}`).join('\n');
function parseInstalments(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [dueOn, amount] = l.split('|').map(s => s.trim());
      return { dueOn, amount: Number(amount) };
    });
}

export function termsDialog(form) {
  if (!form?.known) return;
  openDrawer({
    title: L('Edit registration terms', 'تعديل شروط التسجيل'),
    sub: L(form.event, form.eventAr),
    body: (
      <>
        <div className="grid-2">
          <C.Field label={L('Capacity', 'السعة')} id="rt_cap" type="number" req={true} min="1" value={form.cap} />{' '}
          <C.Field
            label={L('Transport places', 'مقاعد النقل')}
            id="rt_tcap"
            type="number"
            min="0"
            value={form.transportCap}
          />{' '}
          <C.Field label={L('Fee', 'الرسم')} id="rt_fee" type="number" min="0" step="any" value={form.fee} />{' '}
          <C.Field
            label={L('Currency (3 letters)', 'العملة (3 أحرف)')}
            id="rt_cur"
            req={true}
            max={3}
            value={form.currency}
          />{' '}
          <C.Field label={L('Decimals', 'الخانات العشرية')} id="rt_prec" type="number" min="0" value={form.precision} />{' '}
          <C.Field
            label={L('Youngest age', 'أصغر عمر')}
            id="rt_min"
            type="number"
            min="0"
            opt={true}
            value={form.minAge ?? ''}
          />{' '}
          <C.Field
            label={L('Oldest age', 'أكبر عمر')}
            id="rt_max"
            type="number"
            min="0"
            opt={true}
            value={form.maxAge ?? ''}
          />{' '}
          <C.Field
            label={L('Guardian needed below age', 'وليّ الأمر مطلوب دون عمر')}
            id="rt_child"
            type="number"
            req={true}
            value={form.childAgeThreshold ?? ''}
          />
        </div>{' '}
        <C.CheckRow
          label={L('Waiting list once full', 'لائحة انتظار عند الامتلاء')}
          id="rt_waitlist"
          checked={form.waitlistAllowed}
        />{' '}
        <C.CheckRow label={L('Consent required', 'الموافقة مطلوبة')} id="rt_consent" checked={form.consentRequired} />{' '}
        <C.Textarea label={L('Consent wording', 'نص الموافقة')} id="rt_ctext" max={10000} value={form.consentText} />{' '}
        <C.Textarea
          label={L('Door operators (account ids, one per line)', 'مشغّلو الباب (معرّفات الحسابات، سطر لكل منها)')}
          id="rt_doors"
          max={4000}
          value={form.doorAccountIds.join('\n')}
        />{' '}
        <C.Field
          label={L('Registration closes (before the event)', 'يُغلق التسجيل (قبل الحدث)')}
          id="rt_closes"
          type="datetime-local"
          opt={true}
          value={localInput(form.deadline)}
        />{' '}
        <C.Textarea
          label={L(
            'Discounts: key | name | Arabic name | amount, one per line',
            'الحسومات: المفتاح | الاسم | الاسم بالعربية | المبلغ، سطر لكل منها'
          )}
          id="rt_discounts"
          max={4000}
          value={discountsText(form.discounts || [])}
        />{' '}
        <C.Textarea
          label={L(
            'Instalments: YYYY-MM-DD | amount, one per line (must add up to the fee)',
            'الأقساط: YYYY-MM-DD | المبلغ، سطر لكل قسط (مجموعها يساوي الرسم)'
          )}
          id="rt_instalments"
          max={2000}
          value={instalmentsText(form.installments || [])}
        />{' '}
        <div className="ac-group" style={{ paddingInline: 0 }}>
          {L(
            'Accepted payment methods (recorded only; nothing is charged)',
            'طرق الدفع المقبولة (تسجيل فقط؛ لا يُقتطع شيء)'
          )}
        </div>
        {Object.entries(METHOD_LABELS).map(([m, [en, ar]]) => (
          <C.CheckRow key={m} label={L(en, ar)} id={`rt_m_${m}`} checked={(form.paymentMethods || []).includes(m)} />
        ))}{' '}
        <C.Field
          label={L('Muster point', 'نقطة التجمّع')}
          id="rt_muster"
          max={300}
          opt={true}
          value={form.musterPoint}
        />{' '}
        <C.Field
          label={L('Muster point (Arabic)', 'نقطة التجمّع (بالعربية)')}
          id="rt_musterAr"
          max={300}
          opt={true}
          value={form.musterPointAr}
        />{' '}
        <C.Field label={L('Reason for the change', 'سبب التعديل')} id="rt_reason" req={true} max={2000} />
        <p className="help">
          {L(
            'Capacity cannot go below the places already held, and the currency is fixed once anyone is registered. Existing registrations keep the fee they were submitted with.',
            'لا تنزل السعة عن المقاعد المحجوزة، وتثبت العملة بعد أول تسجيل. تحتفظ التسجيلات القائمة بالرسم الذي قُدّمت به.'
          )}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="rt_go" style={{ marginInlineStart: 'auto' }}>
          {L('Save terms', 'احفظ الشروط')}
        </button>
      </>
    ),
    onMount(el) {
      const go = el.querySelector('#rt_go');
      go.addEventListener('click', async () => {
        const reason = val(el, '#rt_reason'),
          capacity = num(el, '#rt_cap'),
          child = num(el, '#rt_child'),
          currency = val(el, '#rt_cur').toUpperCase(),
          closes = val(el, '#rt_closes');
        if (!reason) return warn(L('Say why you are changing the terms', 'اذكر سبب تعديل الشروط'));
        if (!(capacity >= 1) || child == null || currency.length !== 3)
          return warn(L('Check capacity, guardian age and currency', 'راجع السعة وعمر وليّ الأمر والعملة'));
        go.disabled = true;
        const ok = await act(() =>
          reviseTerms(form, {
            capacity,
            transportCapacity: num(el, '#rt_tcap') || 0,
            fee: num(el, '#rt_fee') || 0,
            currency,
            precision: num(el, '#rt_prec') ?? 2,
            waitlistAllowed: el.querySelector('#rt_waitlist').checked,
            minimumAge: num(el, '#rt_min'),
            maximumAge: num(el, '#rt_max'),
            childAgeThreshold: child,
            consentRequired: el.querySelector('#rt_consent').checked,
            consentText: val(el, '#rt_ctext'),
            doorAccountIds: val(el, '#rt_doors').split(/\s+/).filter(Boolean),
            closesAt: closes ? new Date(closes).toISOString() : null,
            discounts: parseDiscounts(el.querySelector('#rt_discounts').value),
            instalments: parseInstalments(el.querySelector('#rt_instalments').value),
            paymentMethods: Object.keys(METHOD_LABELS).filter(m => el.querySelector(`#rt_m_${m}`)?.checked),
            musterPoint: val(el, '#rt_muster'),
            musterPointAr: val(el, '#rt_musterAr'),
            reason
          })
        );
        go.disabled = false;
        if (!ok) return;
        closeOverlays();
        bus.refresh();
        toast(L('Terms saved', 'حُفظت الشروط'), '', 'success');
      });
    }
  });
}

export function householdDialog(form) {
  if (!form?.open) return;
  const households = D.HOUSEHOLDS.filter(h => h.members?.length);
  if (!households.length)
    return warn(
      L('No household is available', 'لا عائلة متاحة'),
      L(
        'Households come from People; this account may not read them.',
        'تأتي العائلات من الأشخاص؛ قد لا يستطيع هذا الحساب قراءتها.'
      )
    );
  const memberRows = h =>
    h.members.map(id => (
      <C.CheckRow key={id} label={D.person(id)?.lat || D.person(id)?.name || id} id={`hh_p_${id}`} checked={true} />
    ));
  openDrawer({
    large: true,
    title: L('Register a household', 'تسجيل عائلة'),
    sub: L(form.event, form.eventAr),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="hh_id">
            {L('Household', 'العائلة')}
          </label>
          <Select id="hh_id">
            {households.map(h => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </div>
        {households.map(h => (
          <div key={h.id} data-hh={h.id} hidden={h.id !== households[0].id}>
            {memberRows(h)}
          </div>
        ))}
        <h3 style={{ marginTop: '16px' }}>{L('Answers for every chosen member', 'الأجوبة لكل عضو مختار')}</h3>
        {fieldInputs(form.fields, {})}
        <C.CheckRow label={L('Needs the parish transport', 'يحتاج إلى نقل الرعية')} id="hh-transport" />{' '}
        {form.consentRequired ? (
          <C.Field label={L('Consent evidence', 'دليل الموافقة')} id="hh-consent" max={500} />
        ) : null}
        <C.Field label={L('Guardian authority', 'سلطة وليّ الأمر')} id="hh-guardian" max={500} opt={true} />{' '}
        <C.Textarea
          label={L('Authorised to collect (name | authority checked)', 'المفوَّضون بالاستلام (الاسم | الصلاحية)')}
          id="hh-collectors"
          max={2000}
        />
        <p className="help">
          {L(
            'Each member is registered separately and can be amended one by one. Only current household members can be registered together.',
            'يُسجَّل كل عضو منفرداً ويمكن تعديله وحده. لا يُسجَّل معاً إلا أعضاء العائلة الحاليون.'
          )}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="hh_go" style={{ marginInlineStart: 'auto' }}>
          {L('Register', 'سجّل')}
        </button>
      </>
    ),
    onMount(el) {
      const pick = el.querySelector('#hh_id');
      pick.addEventListener('change', () =>
        el.querySelectorAll('[data-hh]').forEach(d => (d.hidden = d.dataset.hh !== pick.value))
      );
      const go = el.querySelector('#hh_go');
      go.addEventListener('click', async () => {
        const household = households.find(h => h.id === pick.value);
        const chosen = household.members.filter(id => el.querySelector(`#hh_p_${id}`)?.checked);
        if (!chosen.length) return warn(L('Choose at least one member', 'اختر عضواً واحداً على الأقل'));
        const shared = {
          answers: readAnswers(el, form.fields),
          transport: el.querySelector('#hh-transport').checked,
          consentEvidence: val(el, '#hh-consent') || null,
          guardianAuthorityEvidence: val(el, '#hh-guardian') || null,
          collectors: parseCollectors(el.querySelector('#hh-collectors').value, [])
        };
        go.disabled = true;
        const ok = await act(() =>
          registerHousehold(
            form,
            household.id,
            chosen.map(personId => ({ personId, ...shared }))
          )
        );
        go.disabled = false;
        if (!ok) return;
        closeOverlays();
        bus.refresh();
        toast(L('Household registered', 'سُجّلت العائلة'), '', 'success');
      });
    }
  });
}
