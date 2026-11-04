/* Administration dialogs: workflow rules, permission exceptions, webhooks, tags, and permanently
   deleting a record. */
import { Select } from '../../ui/components.jsx';
import { t } from '../../../lib/i18n.js';
import { toast, openModal, closeOverlays } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { ok, refresh, val } from '../../shared/dialog-helpers.jsx';
import { need } from '../../shared/dialogs.jsx';

const L = (en, ar) => t(en, ar);

export function ruleAdd() {
  const opts = D.FORM_FIELDS.map((f, i) => (
    <option key={i} value={f.id}>
      {L(f.label, f.labelAr)}
    </option>
  ));
  openModal({
    title: L('Add a rule', 'إضافة قاعدة'),
    body: (
      <div className="formgrid">
        <div className="formrow">
          <label className="label" htmlFor="ru_a">
            {L('Show', 'أظهر')}
          </label>{' '}
          <Select id="ru_a">{opts}</Select>
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="ru_b">
            {L('When', 'حين')}
          </label>
          <Select id="ru_b">{opts}</Select>
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="ru_op">
            {L('Is', 'يكون')}
          </label>
          <Select id="ru_op">
            <option value="=">{L('equal to', 'مساوياً لـ')}</option>
            <option value="≠">{L('not equal to', 'غير مساوٍ لـ')}</option>
          </Select>
        </div>{' '}
        <C.Field label={L('Value', 'القيمة')} req={true} id="ru_v" ph={L('the person signed in', 'الشخص المسجَّل')} />
      </div>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="ru_go" style={{ marginInlineStart: 'auto' }}>
          {L('Add rule', 'إضافة القاعدة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#ru_go').addEventListener('click', () => {
        if (!need(el, '#ru_v', L('Give the value', 'أدخل القيمة'))) return;
        if (
          !need(
            el,
            '#ru_b',
            L('A field cannot depend on itself', 'لا يعتمد الحقل على نفسه'),
            v => v !== val(el, '#ru_a')
          )
        )
          return;
        const r = {
          id: 'fr' + Date.now().toString(36),
          show: val(el, '#ru_a'),
          when: val(el, '#ru_b'),
          op: val(el, '#ru_op'),
          value: val(el, '#ru_v'),
          valueAr: val(el, '#ru_v')
        };
        D.FORM_RULES.push(r);
        closeOverlays();
        refresh();
        ok(L('Rule added', 'أُضيفت القاعدة'), '', {
          action: {
            label: L('Undo', 'تراجع'),
            fn: () => {
              D.FORM_RULES.splice(D.FORM_RULES.indexOf(r), 1);
              refresh();
            }
          }
        });
      });
    }
  });
}

export function webhookAdd() {
  openModal({
    title: L('Add a webhook', 'إضافة خطّاف'),
    body: (
      <>
        <C.Field label={L('Endpoint', 'الوجهة')} req={true} id="wh_u" dir="ltr" ph="https://" />{' '}
        <div className="ac-group" style={{ paddingInline: 0 }}>
          {L('Events', 'الأحداث')}
        </div>{' '}
        <div className="stack" style={{ gap: '8px' }}>
          {['sacrament.registered', 'report.published', 'message.failed', 'reservation.approved'].map((ev, i) => (
            <label key={i} className="check">
              <input type="checkbox" defaultValue={ev} />
              <span className="mono" style={{ fontSize: '13px' }}>
                {ev}
              </span>
            </label>
          ))}
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="wh_go" style={{ marginInlineStart: 'auto' }}>
          {L('Add webhook', 'إضافة الخطّاف')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#wh_go').addEventListener('click', () => {
        if (
          !need(el, '#wh_u', L('Use an https:// address', 'استعمل عنواناً يبدأ بـ https://'), v =>
            /^https:\/\/\S+\.\S+/.test(v)
          )
        )
          return;
        const url = val(el, '#wh_u');
        const events = [...el.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
        D.WEBHOOKS.push({ url, events: events.length ? events : ['report.published'], scope: 'read', active: true });
        closeOverlays();
        refresh();
        ok(L('Webhook added', 'أُضيف الخطّاف'), url);
      });
    }
  });
}

export function deleteSpecimen() {
  openModal({
    title: L('Permanently delete this record?', 'حذف هذا السجل نهائياً؟'),
    sub: L('This cannot be undone.', 'لا يمكن التراجع.'),
    body: (
      <div className="formrow">
        <label htmlFor="ds_in" className="label">
          {L('Type', 'اكتب')} <b>Georges Haddad</b> {L('to confirm', 'للتأكيد')}
        </label>{' '}
        <input className="input" id="ds_in" autoComplete="off" />
      </div>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Keep record', 'الاحتفاظ بالسجل')}
        </button>{' '}
        <button className="btn btn-danger" id="ds_go" disabled style={{ marginInlineStart: 'auto' }}>
          {L('Delete permanently', 'حذف نهائي')}
        </button>
      </>
    ),
    onMount(el) {
      const b = el.querySelector('#ds_go');
      el.querySelector('#ds_in').addEventListener('input', e => {
        b.disabled = e.target.value.trim() !== 'Georges Haddad';
      });
      b.addEventListener('click', () => {
        closeOverlays();
        toast(
          L('Deleted', 'حُذف'),
          L('Specimen only — no record was touched.', 'نموذج فقط — لم يُمسّ أي سجل.'),
          'danger'
        );
      });
    }
  });
}

export function tagAdd(btn) {
  const inp = document.createElement('input');
  inp.className = 'input';
  inp.style.cssText = 'width:140px;min-height:30px;font-size:13px';
  inp.placeholder = L('New tag', 'وسم جديد');
  btn.replaceWith(inp);
  inp.focus();
  const done = () => {
    const v = inp.value.trim();
    if (v) inp.insertAdjacentHTML('beforebegin', <span className="chip">{v}</span>);
    inp.replaceWith(btn);
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') done();
    if (e.key === 'Escape') inp.replaceWith(btn);
  });
  inp.addEventListener('blur', done);
}
