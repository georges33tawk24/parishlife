/* A group's resources and formation: items it lends and their loans, and formation sessions with
   who completed them. */
import { Select } from '../../ui/components.jsx';
import { t } from '../../../lib/i18n.js';
import { S, bus } from '../../model/store.js';
import { openDrawer, openModal, closeOverlays, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { persist } from '../../model/persist.js';
import { need } from '../../shared/dialogs.jsx';
import { groupInfo, person } from '../../model/data.js';
import { iso } from './parish-life-shared.jsx';

const L = (en, ar) => t(en, ar);

export function resourceForm(id = '') {
  const d = groupInfo(S.params[0]),
    r = d.belongings.find(x => x.id === id),
    lent = id ? d.resourceLoans.filter(l => l.resourceId === id && !l.returnedAt).reduce((n, l) => n + l.qty, 0) : 0;
  openDrawer({
    title: r ? L('Edit item', 'تعديل الصنف') : L('Add item', 'إضافة صنف'),
    body: (
      <>
        <C.Field label={L('Name', 'الاسم')} id="rs_name" value={r?.name || ''} req={true} />{' '}
        <C.Field label={L('Arabic name', 'الاسم العربي')} id="rs_ar" value={r?.ar || ''} />{' '}
        <div className="formgrid">
          <C.Field label={L('Inventory code', 'رمز الجرد')} id="rs_code" value={r?.code || ''} />{' '}
          <div className="formrow">
            <label className="label" htmlFor="rs_condition">
              {L('Condition', 'الحالة')}
            </label>
            <Select defaultValue={r?.condition} id="rs_condition">
              {[
                ['good', 'Good', 'جيد'],
                ['fair', 'Fair', 'مقبول'],
                ['repair', 'Needs repair', 'يحتاج تصليح'],
                ['damaged', 'Damaged', 'تالف']
              ].map(([v, en, ar], i) => (
                <option key={i} value={v}>
                  {L(en, ar)}
                </option>
              ))}
            </Select>
          </div>
        </div>{' '}
        <C.Textarea
          label={L('Description / care notes', 'الوصف / ملاحظات العناية')}
          id="rs_description"
          value={r?.description || ''}
          max={500}
        />{' '}
        <div className="formgrid">
          <C.Field label={L('Total quantity', 'العدد الكلي')} id="rs_qty" type="number" value={r?.qty ?? 1} />{' '}
          <C.Field label={L('Stored at', 'محفوظ في')} id="rs_location" value={r?.location || ''} />
        </div>{' '}
        <C.Field label={L('Location (Arabic)', 'المكان بالعربي')} id="rs_location_ar" value={r?.locationAr || ''} />{' '}
        {lent ? (
          <p className="help">
            {lent}{' '}
            {L(
              'currently on loan; total quantity cannot be lower.',
              'معار حالياً؛ لا يمكن تقليل العدد الكلي إلى أقل من ذلك.'
            )}
          </p>
        ) : (
          ''
        )}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="rs_save">
          {L('Save item', 'حفظ الصنف')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#rs_save').addEventListener('click', async () => {
        if (!need(el, '#rs_name', L('Enter an item name', 'أدخل اسم الصنف'))) return;
        const qty = Number(el.querySelector('#rs_qty').value);
        if (!Number.isInteger(qty) || qty < lent || qty < 0)
          return toast(
            L('Invalid quantity', 'عدد غير صالح'),
            L(
              `At least ${lent} items are needed to cover active loans.`,
              `يلزم ${lent} صنفاً لتغطية الإعارات الحالية.`
            ),
            'warning'
          );
        const target = r || { id: `res-${Date.now().toString(36)}` };
        Object.assign(target, {
          name: el.querySelector('#rs_name').value.trim(),
          ar: el.querySelector('#rs_ar').value.trim(),
          code: el.querySelector('#rs_code').value.trim(),
          condition: el.querySelector('#rs_condition').value,
          description: el.querySelector('#rs_description').value.trim(),
          qty,
          location: el.querySelector('#rs_location').value.trim(),
          locationAr: el.querySelector('#rs_location_ar').value.trim()
        });
        if (!r) d.belongings.push(target);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Item saved', 'حُفظ الصنف'), '', 'success');
      });
    }
  });
}

export function resourceDelete(id) {
  const d = groupInfo(S.params[0]),
    r = d.belongings.find(x => x.id === id);
  if (!r) return;
  if (d.resourceLoans.some(l => l.resourceId === id))
    return toast(
      L('Item has loan history', 'للصنف سجل إعارات'),
      L('Keep the item so its loan history stays attached.', 'أبق الصنف كي يظل سجل الإعارات مرتبطاً به.'),
      'warning'
    );
  openModal({
    title: L('Delete item?', 'حذف الصنف؟'),
    body: <p>{L(r.name, r.ar)}</p>,
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-danger" id="rs_delete">
          {L('Delete', 'حذف')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#rs_delete').addEventListener('click', async () => {
        d.belongings.splice(d.belongings.indexOf(r), 1);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
      });
    }
  });
}

export function resourceLend(id) {
  const d = groupInfo(S.params[0]),
    r = d.belongings.find(x => x.id === id);
  if (!r) return;
  const available =
    r.qty - d.resourceLoans.filter(l => l.resourceId === id && !l.returnedAt).reduce((n, l) => n + l.qty, 0);
  openDrawer({
    title: L('Lend item', 'إعارة صنف'),
    sub: L(r.name, r.ar),
    body: (
      <>
        <C.Field label={L('Borrower name', 'اسم المستعير')} id="loan_name" req={true} />{' '}
        <div className="formgrid">
          <C.Field label={L('Quantity', 'العدد')} id="loan_qty" type="number" value={1} />{' '}
          <C.Field
            label={L('Due date', 'تاريخ الإرجاع')}
            id="loan_due"
            type="date"
            value={iso(new Date())}
            req={true}
          />
        </div>{' '}
        <p className="help">
          {available} {L('available', 'متاح')}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="loan_save">
          {L('Record loan', 'تسجيل الإعارة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#loan_save').addEventListener('click', async () => {
        if (
          !need(el, '#loan_name', L('Enter the borrower', 'أدخل اسم المستعير')) ||
          !need(el, '#loan_due', L('Choose a due date', 'اختر تاريخ الإرجاع'))
        )
          return;
        const qty = Number(el.querySelector('#loan_qty').value),
          due = el.querySelector('#loan_due').value;
        if (!Number.isInteger(qty) || qty < 1 || qty > available || due < iso(new Date()))
          return toast(L('Check quantity and due date', 'تحقّق من العدد والتاريخ'), '', 'warning');
        d.resourceLoans.push({
          id: `loan-${Date.now().toString(36)}`,
          resourceId: id,
          borrower: el.querySelector('#loan_name').value.trim(),
          qty,
          checkedOutAt: iso(new Date()),
          due,
          returnedAt: ''
        });
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Loan recorded', 'سُجّلت الإعارة'), '', 'success');
      });
    }
  });
}

export function resourceLoanEdit(id) {
  const d = groupInfo(S.params[0]),
    loan = d.resourceLoans.find(item => item.id === id);
  if (!loan) return;
  const resource = d.belongings.find(item => item.id === loan.resourceId);
  if (!resource) return;
  const otherLoans = d.resourceLoans
    .filter(item => item.resourceId === resource.id && !item.returnedAt && item.id !== id)
    .reduce((count, item) => count + item.qty, 0);
  const limit = loan.returnedAt ? loan.qty : resource.qty - otherLoans;
  openDrawer({
    title: L('Edit loan', 'تعديل الإعارة'),
    sub: L(resource.name, resource.ar),
    body: (
      <>
        <C.Field label={L('Borrower name', 'اسم المستعير')} id="loan_name" value={loan.borrower} req={true} />{' '}
        <div className="formgrid">
          <C.Field label={L('Quantity', 'العدد')} id="loan_qty" type="number" value={loan.qty} />{' '}
          <C.Field label={L('Due date', 'تاريخ الإرجاع')} id="loan_due" type="date" value={loan.due} req={true} />
        </div>{' '}
        <p className="help">
          {loan.returnedAt
            ? L(
                'This loan was returned; its quantity is retained for the record.',
                'أُعيدت هذه الإعارة؛ يبقى عددها محفوظاً في السجل.'
              )
            : `${limit} ${L('items available to this loan', 'أصناف متاحة لهذه الإعارة')}`}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="loan_save">
          {L('Save loan', 'حفظ الإعارة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#loan_save').addEventListener('click', async () => {
        if (
          !need(el, '#loan_name', L('Enter the borrower', 'أدخل اسم المستعير')) ||
          !need(el, '#loan_due', L('Choose a due date', 'اختر تاريخ الإرجاع'))
        )
          return;
        const qty = Number(el.querySelector('#loan_qty').value),
          due = el.querySelector('#loan_due').value;
        if (
          !Number.isInteger(qty) ||
          qty < 1 ||
          qty > limit ||
          due < loan.checkedOutAt ||
          (loan.returnedAt && qty !== loan.qty)
        )
          return toast(L('Check quantity and due date', 'تحقّق من العدد والتاريخ'), '', 'warning');
        Object.assign(loan, { borrower: el.querySelector('#loan_name').value.trim(), qty, due });
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Loan updated', 'حُدّثت الإعارة'), '', 'success');
      });
    }
  });
}

export function formationForm(id = '') {
  const d = groupInfo(S.params[0]),
    m = d.milestones.find(x => x.id === id);
  openDrawer({
    title: m ? L('Edit milestone', 'تعديل المحطة') : L('Add milestone', 'إضافة محطة'),
    body: (
      <>
        {<C.Field label={L('Milestone name', 'اسم المحطة')} id="fm_name" value={m?.name || ''} req={true} />}{' '}
        {<C.Field label={L('Arabic name', 'الاسم العربي')} id="fm_ar" value={m?.ar || ''} />}{' '}
        {
          <C.Textarea
            label={L('Description or learning goal', 'الوصف أو هدف التعلم')}
            id="fm_description"
            value={m?.description || ''}
            max={500}
          />
        }
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="fm_save">
          {L('Save milestone', 'حفظ المحطة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#fm_save').addEventListener('click', async () => {
        if (!need(el, '#fm_name', L('Name the milestone', 'سمّ المحطة'))) return;
        const target = m || { id: `fm-${Date.now().toString(36)}`, legacyCount: 0, completions: {} };
        Object.assign(target, {
          name: el.querySelector('#fm_name').value.trim(),
          ar: el.querySelector('#fm_ar').value.trim(),
          description: el.querySelector('#fm_description').value.trim()
        });
        if (!m) d.milestones.push(target);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Milestone saved', 'حُفظت المحطة'), '', 'success');
      });
    }
  });
}

export function formationDelete(id) {
  const d = groupInfo(S.params[0]),
    m = d.milestones.find(x => x.id === id);
  if (!m) return;
  if (m.legacyCount || Object.keys(m.completions || {}).length)
    return toast(
      L('Milestone has history', 'للمحطة سجل'),
      L(
        'Remove individual completions first. Historical totals are preserved.',
        'احذف الإنجازات الفردية أولاً. وتبقى المجاميع التاريخية محفوظة.'
      ),
      'warning'
    );
  openModal({
    title: L('Delete milestone?', 'حذف المحطة؟'),
    body: <p>{L(m.name, m.ar)}</p>,
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-danger" id="fm_delete">
          {L('Delete', 'حذف')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#fm_delete').addEventListener('click', async () => {
        d.milestones.splice(d.milestones.indexOf(m), 1);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
      });
    }
  });
}

export function formationRecord(id, pid = '') {
  const d = groupInfo(S.params[0]),
    m = d.milestones.find(x => x.id === id);
  if (!m) return;
  const saved = m.completions?.[pid];
  openDrawer({
    title: L('Record completion', 'تسجيل إنجاز'),
    sub: L(m.name, m.ar),
    body: (
      <>
        <fieldset className="formrow">
          <legend className="label">{L('Members', 'الأعضاء')}</legend>
          <div className="formation-member-choices">
            {d.roster
              .filter(r => !pid || r.p === pid)
              .map((r, i) => (
                <label key={i} className="check">
                  <input
                    type="checkbox"
                    name="fr_person"
                    defaultValue={r.p}
                    defaultChecked={!!(r.p === pid)}
                    disabled={!!(!pid && m.completions?.[r.p])}
                  />
                  <span>
                    {L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p)}
                    {!pid && m.completions?.[r.p] ? ` · ${L('Already completed', 'مكتمل سابقاً')}` : ''}
                  </span>
                </label>
              ))}
          </div>
        </fieldset>{' '}
        <C.Field
          label={L('Completed on', 'تاريخ الإنجاز')}
          id="fr_date"
          type="date"
          value={saved?.date || iso(new Date())}
          req={true}
        />{' '}
        <C.Textarea
          label={L('Notes (optional)', 'ملاحظات (اختياري)')}
          id="fr_notes"
          value={saved?.notes || ''}
          max={500}
        />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="fr_save">
          {L('Save completion', 'حفظ الإنجاز')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#fr_save').addEventListener('click', async () => {
        const members = [...el.querySelectorAll('[name="fr_person"]:checked')].map(box => box.value),
          date = el.querySelector('#fr_date').value;
        if (!members.length || !date)
          return toast(L('Choose members and date', 'اختر الأعضاء والتاريخ'), '', 'warning');
        if (members.some(member => m.completions?.[member] && member !== pid))
          return toast(
            L('Already recorded', 'مسجّل سابقاً'),
            L('Edit an existing completion instead.', 'عدّل الإنجاز الموجود بدلاً من ذلك.'),
            'warning'
          );
        for (const member of members)
          m.completions[member] = { date, notes: el.querySelector('#fr_notes').value.trim() };
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Completion saved', 'حُفظ الإنجاز'), '', 'success');
      });
    }
  });
}
