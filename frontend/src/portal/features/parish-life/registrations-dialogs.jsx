/* Registration-form dialogs: configure a policy for a calendar event, add, require, move and remove the
   form's questions (each change is a new form version), and open or close registration.
   Main members: formNew, fieldAdd, fieldMenu, toggleOpen, registerParticipant (opens the register drawer).
   Every change calls ParishLife.Api through model/modules/registrations.js and then reloads. A policy is
   configured once per event (capacity, fee, ages and consent cannot be edited afterwards); only the
   questions (a new version) and open/closed can change. */
import { Select } from '../../ui/components.jsx';
import { t, fmtDate } from '../../../lib/i18n.js';
import { session } from '../../model/api.js';
import { toast, openDrawer, openModal, closeOverlays, openMenu } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import {
  act,
  availableEvents,
  configureRegistration,
  reviseRegistrationForm,
  setRegistrationOpen
} from '../../model/modules/registrations.js';
import { participantForm, FIELD_TYPES, fieldTypeLabel } from './registration-forms.jsx';
import { selectedRegistration, selectRegistration } from '../../model/event-workflows.js';
import { ok, refresh, val } from '../../shared/dialog-helpers.jsx';

const L = (en, ar) => t(en, ar);
const warn = (title, body = '') => toast(title, body, 'warning');
const number = (el, sel) => {
  const v = val(el, sel);
  return v === '' ? null : Number(v);
};

export function formNew() {
  if (!availableEvents.length)
    return warn(
      L('No calendar activity is waiting for a form', 'لا نشاط في الرزنامة ينتظر استمارة'),
      L(
        'Create the parish activity in the Calendar first (Masses and private appointments cannot take registrations).',
        'أنشئ نشاط الرعية في الرزنامة أولاً (القداديس والمواعيد الخاصة لا تقبل تسجيلاً).'
      )
    );
  openDrawer({
    title: L('New registration form', 'استمارة تسجيل جديدة'),
    sub: L(
      'Set the event’s terms once. They are saved as a draft; open registration when ready.',
      'حدّد شروط الحدث مرة واحدة. تُحفظ كمسودة؛ افتح التسجيل عند الجاهزية.'
    ),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="rf_e">
            {L('Calendar activity', 'نشاط الرزنامة')}
            <span className="req">*</span>
          </label>
          <Select id="rf_e">
            <option value="">{L('Select an event', 'اختر حدثاً')}</option>
            {availableEvents.map(e => (
              <option key={e.id} value={e.id}>
                {e.title} · {fmtDate(String(e.startsAt).slice(0, 10))}
              </option>
            ))}
          </Select>
        </div>{' '}
        <div className="formgrid">
          <C.Field label={L('Capacity', 'السعة')} id="rf_cap" type="number" req={true} min="1" />{' '}
          <C.Field
            label={L('Parish transport seats', 'مقاعد نقل الرعية')}
            id="rf_tcap"
            type="number"
            value="0"
            min="0"
          />
        </div>{' '}
        <div className="formgrid">
          <C.Field
            label={L('Fee (0 for free)', 'الرسم (0 للمجاني)')}
            id="rf_fee"
            type="number"
            value="0"
            min="0"
            step="any"
          />{' '}
          <C.Field label={L('Currency (3 letters)', 'العملة (3 أحرف)')} id="rf_cur" req={true} ph="USD" max={3} />{' '}
          <C.Field
            label={L('Decimal places', 'المنازل العشرية')}
            id="rf_prec"
            type="number"
            req={true}
            min="0"
            max="4"
          />
        </div>{' '}
        <div className="formgrid">
          <C.Field label={L('Youngest age', 'أصغر عمر')} id="rf_min" type="number" min="0" opt={true} />{' '}
          <C.Field label={L('Oldest age', 'أكبر عمر')} id="rf_max" type="number" min="0" opt={true} />{' '}
          <C.Field
            label={L('Child below age (guardian needed)', 'قاصر دون عمر (يلزم وليّ)')}
            id="rf_child"
            type="number"
            req={true}
            min="1"
            max="25"
          />
        </div>{' '}
        <div className="stack" style={{ gap: '10px' }}>
          <C.CheckRow label={L('Waiting list once full', 'لائحة انتظار عند الامتلاء')} id="rf_waitlist" />{' '}
          <C.CheckRow label={L('Consent required', 'الموافقة مطلوبة')} id="rf_consent" />
        </div>{' '}
        <C.Textarea
          label={L('Consent wording (if required)', 'نص الموافقة (إن كانت مطلوبة)')}
          id="rf_ctext"
          max={10000}
        />{' '}
        <div className="stack" style={{ gap: '10px', marginTop: '8px' }}>
          <C.CheckRow label={L('I will operate the door', 'سأتولّى الباب')} id="rf_me" checked={true} />
        </div>
        <C.Textarea
          label={L(
            'Other door operators (account ids, one per line)',
            'مشغّلو الباب الآخرون (معرّفات الحسابات، سطر لكل واحد)'
          )}
          id="rf_doors"
          max={2000}
        />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="rf_go" style={{ marginInlineStart: 'auto' }}>
          {L('Create form', 'إنشاء الاستمارة')}
        </button>
      </>
    ),
    onMount(el) {
      const go = el.querySelector('#rf_go');
      go.addEventListener('click', async () => {
        const eventId = val(el, '#rf_e'),
          capacity = number(el, '#rf_cap'),
          currency = val(el, '#rf_cur').toUpperCase(),
          precision = number(el, '#rf_prec'),
          child = number(el, '#rf_child'),
          consentRequired = el.querySelector('#rf_consent').checked;
        if (!eventId || !capacity || !/^[A-Z]{3}$/.test(currency) || precision === null || !child)
          return warn(
            L('Complete the required terms', 'أكمل الشروط المطلوبة'),
            L(
              'Event, capacity, a 3-letter currency, decimal places and the child age.',
              'الحدث والسعة والعملة والمنازل وعمر القاصر.'
            )
          );
        if (consentRequired && !val(el, '#rf_ctext')) return warn(L('Write the consent wording', 'اكتب نص الموافقة'));
        const doors = new Set(val(el, '#rf_doors').split(/\s+/).filter(Boolean));
        if (el.querySelector('#rf_me').checked && session.accountUser?.id) doors.add(session.accountUser.id);
        go.disabled = true;
        const done = await act(() =>
          configureRegistration(eventId, {
            capacity,
            transportCapacity: number(el, '#rf_tcap') || 0,
            fee: number(el, '#rf_fee') || 0,
            currency,
            precision,
            waitlistAllowed: el.querySelector('#rf_waitlist').checked,
            minimumAge: number(el, '#rf_min'),
            maximumAge: number(el, '#rf_max'),
            childAgeThreshold: child,
            consentRequired,
            consentText: val(el, '#rf_ctext'),
            doorAccountIds: [...doors],
            fields: []
          })
        );
        go.disabled = false;
        if (!done) return;
        selectRegistration(eventId);
        closeOverlays();
        refresh();
        ok(
          L('Form created as a draft', 'أُنشئت الاستمارة كمسودة'),
          L('Add questions, then open registration.', 'أضف الأسئلة ثم افتح التسجيل.')
        );
      });
    }
  });
}

export function registerParticipant() {
  participantForm(selectedRegistration());
}

/* Open or close registration (opening needs a confirmed future event). */
export async function toggleOpen(form) {
  if (!form?.known) return;
  if (await act(() => setRegistrationOpen(form, !form.open))) {
    refresh();
    ok(form.open ? L('Registration closed', 'أُغلق التسجيل') : L('Registration is open', 'فُتح التسجيل'));
  }
}

const slug = (label, taken) => {
  const base =
    String(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'question';
  let key = base,
    n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  return key;
};

/* A new version of the form with `fields`; people who already registered keep the version they answered. */
async function revise(form, fields, message) {
  if (await act(() => reviseRegistrationForm(form, fields))) {
    refresh();
    ok(message, L('A new form version was saved.', 'حُفظت نسخة جديدة من الاستمارة.'));
  }
}

export function fieldAdd() {
  const form = selectedRegistration();
  if (!form?.known) return warn(L('Select a registration form', 'اختر استمارة تسجيل'));
  openModal({
    title: L('Add a question', 'إضافة سؤال'),
    body: (
      <>
        <C.Field label={L('Question', 'السؤال')} req={true} id="ff_label" max={200} />{' '}
        <div className="formrow">
          <label htmlFor="ff_t" className="label">
            {L('Answer type', 'نوع الجواب')}
          </label>
          <Select id="ff_t">
            {FIELD_TYPES.map(type => (
              <option key={type} value={type}>
                {fieldTypeLabel(type)}
              </option>
            ))}
          </Select>
        </div>{' '}
        <C.Textarea
          label={L('Choices (one per line, for a Choice)', 'الخيارات (سطر لكل خيار، للاختيار)')}
          id="ff_opts"
          max={2000}
        />{' '}
        <C.CheckRow label={L('Required', 'إلزامي')} id="ff_req" />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="ff_go" style={{ marginInlineStart: 'auto' }}>
          {L('Add question', 'إضافة السؤال')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#ff_go').addEventListener('click', async () => {
        const label = val(el, '#ff_label'),
          type = el.querySelector('#ff_t').value;
        const options = [
          ...new Set(
            el
              .querySelector('#ff_opts')
              .value.split('\n')
              .map(x => x.trim())
              .filter(Boolean)
          )
        ];
        if (!label) return warn(L('Write the question', 'اكتب السؤال'));
        if (type === 'Choice' && !options.length)
          return warn(L('Give at least one choice', 'أعطِ خياراً واحداً على الأقل'));
        const key = slug(label, new Set(form.fields.map(f => f.key)));
        closeOverlays();
        await revise(
          form,
          [
            ...form.fields,
            {
              key,
              label,
              type,
              required: el.querySelector('#ff_req').checked,
              options: type === 'Choice' ? options : []
            }
          ],
          L('Question added', 'أُضيف السؤال')
        );
      });
    }
  });
}

export function fieldMenu(btn, i) {
  const form = selectedRegistration();
  if (!form?.known) return;
  i = +i;
  const f = form.fields;
  openMenu(btn, [
    {
      label: f[i]?.required ? L('Make optional', 'اجعله اختيارياً') : L('Make required', 'اجعله إلزامياً'),
      icon: 'check',
      fn: () =>
        revise(
          form,
          f.map((x, n) => (n === i ? { ...x, required: !x.required } : x)),
          L('Question updated', 'حُدّث السؤال')
        )
    },
    {
      label: L('Move up', 'نقل للأعلى'),
      icon: 'chevL',
      fn: () => {
        if (i === 0) return;
        const next = [...f];
        [next[i - 1], next[i]] = [next[i], next[i - 1]];
        return revise(form, next, L('Question moved', 'نُقل السؤال'));
      }
    },
    { sep: true },
    {
      label: L('Remove question', 'إزالة السؤال'),
      icon: 'trash',
      danger: true,
      fn: () =>
        revise(
          form,
          f.filter((x, n) => n !== i),
          L('Question removed', 'أُزيل السؤال')
        )
    }
  ]);
}
