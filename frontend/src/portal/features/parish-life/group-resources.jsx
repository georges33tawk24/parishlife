/* A group's resources and formation: items it lends and their loans (request, issue, return, condition
   check, close), and the formation program's milestones with recorded evidence, review and completion.
   Main functions: resourceForm, resourceDelete, resourceLend, resourceLoanEdit, loanSteps, formationForm,
   formationDelete, formationApprove, formationRecord, formationReview. */
import { Select } from '../../ui/components.jsx';
import { t } from '../../../lib/i18n.js';
import { S, bus } from '../../model/store.js';
import { openDrawer, openModal, closeOverlays, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { persist, hydrate } from '../../model/persist.js';
import {
  approveFormation,
  lendItem,
  loanAction,
  recordCompletion,
  reopenCompletion,
  reviewCompletion,
  saveFormation,
  zonedInstant
} from '../../model/modules/ministries.js';
import { need } from '../../shared/dialogs.jsx';
import { groupInfo, person } from '../../model/data.js';
import { iso } from './parish-life-shared.jsx';

/* Display only: an empty twin falls back to the other language (never when saving). */
const L = (en, ar) => t(en || ar, ar || en);

export function resourceForm(id = '') {
  const d = groupInfo(S.params[0]),
    r = d.belongings.find(x => x.id === id),
    lent = r?.lent || 0;
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
  if (r.lent)
    return toast(
      L('Item is on loan', 'الصنف مُعار'),
      L('Wait until every unit is returned before retiring it.', 'انتظر إرجاع كل الوحدات قبل سحبه.'),
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

/* Runs a workflow call, reloads from the API and closes the drawer; an API refusal shows its message. */
async function run(fn, done) {
  try {
    await fn();
  } catch (error) {
    return toast(L('Not done', 'لم يتم'), error.message, 'danger');
  }
  await hydrate();
  closeOverlays();
  bus.refresh();
  toast(done, '', 'success');
}
const memberName = pid => L(person(pid)?.lat || '—', person(pid)?.ar || person(pid)?.lat || '—');

/* Lending: a custodian lends to a current member (request, approve and issue in one step). */
export function resourceLend(id) {
  const gid = S.params[0],
    d = groupInfo(gid),
    r = d.belongings.find(x => x.id === id);
  if (!r) return;
  const available = r.qty - (r.lent || 0);
  openDrawer({
    title: L('Lend item', 'إعارة صنف'),
    sub: L(r.name, r.ar),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="loan_person">
            {L('Borrower (a current member)', 'المستعير (عضو حالي)')}
          </label>
          <Select id="loan_person">
            <option value="">—</option>
            {d.roster.map((m, i) => (
              <option key={i} value={m.p}>
                {memberName(m.p)}
              </option>
            ))}
          </Select>
        </div>{' '}
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
        <C.Field label={L('Condition at issue', 'الحالة عند التسليم')} id="loan_condition" req={true} />{' '}
        <C.Field label={L('Purpose (optional)', 'الغاية (اختياري)')} id="loan_purpose" />{' '}
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
        const pid = el.querySelector('#loan_person').value,
          qty = Number(el.querySelector('#loan_qty').value),
          due = el.querySelector('#loan_due').value,
          condition = el.querySelector('#loan_condition').value.trim();
        if (!pid) return toast(L('Choose the borrower', 'اختر المستعير'), '', 'warning');
        if (!condition) return toast(L('Describe the condition at issue', 'صف الحالة عند التسليم'), '', 'warning');
        if (!Number.isInteger(qty) || qty < 1 || qty > available || !due || due < iso(new Date()))
          return toast(L('Check quantity and due date', 'تحقّق من العدد والتاريخ'), '', 'warning');
        await run(
          () => lendItem(gid, id, pid, { qty, due, condition, purpose: el.querySelector('#loan_purpose').value }),
          L('Loan recorded', 'سُجّلت الإعارة')
        );
      });
    }
  });
}

/* The next step of a loan, as the API allows it: approve or decline a request, return an issued item (or report
   it missing), record the condition check, then close. */
const LOAN_STEPS = {
  Requested: [
    ['approve', 'Approve', 'موافقة'],
    ['decline', 'Decline', 'رفض']
  ],
  Approved: [
    ['issue', 'Issue', 'تسليم'],
    ['decline', 'Decline', 'رفض']
  ],
  Issued: [
    ['return', 'Mark returned', 'تسجيل الإرجاع'],
    ['report-missing', 'Report missing', 'الإبلاغ عن فقدان']
  ],
  Returned: [['check', 'Record condition check', 'تسجيل فحص الحالة']],
  ConditionChecked: [['close', 'Close loan', 'إغلاق الإعارة']]
};
export const loanSteps = loan => LOAN_STEPS[loan.status] || [];

export function resourceLoanEdit(id, action = '') {
  const gid = S.params[0],
    d = groupInfo(gid),
    loan = d.resourceLoans.find(item => item.id === id);
  if (!loan) return;
  const steps = loanSteps(loan);
  const chosen = action || steps[0]?.[0];
  if (!chosen) return;
  const resource = d.belongings.find(item => item.id === loan.resourceId);
  const needs =
    {
      issue: ['due', 'condition'],
      return: ['condition'],
      check: ['outcome', 'evidence'],
      'report-missing': ['evidence', 'reason'],
      decline: ['reason'],
      close: loan.followUp ? ['reason'] : []
    }[chosen] || [];
  const label = steps.find(s => s[0] === chosen) || [chosen, chosen, chosen];
  openDrawer({
    title: L(label[1], label[2]),
    sub: `${L(resource?.name || '—', resource?.ar)} · ${memberName(loan.personId)} · ${loan.qty}`,
    body: (
      <>
        {needs.includes('due') ? (
          <C.Field label={L('Due date', 'تاريخ الإرجاع')} id="la_due" type="date" value={iso(new Date())} req={true} />
        ) : (
          ''
        )}
        {needs.includes('condition') ? <C.Field label={L('Condition', 'الحالة')} id="la_condition" req={true} /> : ''}
        {needs.includes('outcome') ? (
          <div className="formrow">
            <label className="label" htmlFor="la_outcome">
              {L('Outcome', 'النتيجة')}
            </label>
            <Select id="la_outcome">
              <option value="Good">{L('Good', 'جيد')}</option>
              <option value="Damaged">{L('Damaged', 'تالف')}</option>
            </Select>
          </div>
        ) : (
          ''
        )}
        {needs.includes('evidence') ? (
          <C.Field label={L('Evidence (needed for damage or loss)', 'الإثبات (للتلف أو الفقدان)')} id="la_evidence" />
        ) : (
          ''
        )}
        {needs.includes('reason') ? (
          <C.Textarea label={L('Reason or resolution', 'السبب أو المعالجة')} id="la_reason" max={2000} />
        ) : (
          ''
        )}
        {needs.length ? '' : <p className="help">{L('Confirm this step.', 'أكّد هذه الخطوة.')}</p>}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="la_go">
          {L('Confirm', 'تأكيد')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#la_go').addEventListener('click', async () => {
        const value = sel => el.querySelector(sel)?.value?.trim() || null;
        const fields = {};
        if (needs.includes('due')) {
          const due = value('#la_due');
          if (!due || due < iso(new Date())) return toast(L('Choose a due date', 'اختر تاريخ الإرجاع'), '', 'warning');
          fields.dueAt = zonedInstant(
            due,
            '23:59',
            Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
          ).toISOString();
        }
        if (needs.includes('condition')) fields.condition = value('#la_condition');
        if (needs.includes('outcome')) fields.outcome = value('#la_outcome');
        if (needs.includes('evidence')) fields.evidence = value('#la_evidence');
        if (needs.includes('reason')) fields.reason = value('#la_reason');
        await run(() => loanAction(gid, loan, chosen, fields), L('Loan updated', 'حُدّثت الإعارة'));
      });
    }
  });
}

/* Formation: milestones are edited as the program draft; a priest approves it before new work uses it. */
export function formationForm(id = '') {
  const gid = S.params[0],
    d = groupInfo(gid),
    m = d.milestones.find(x => x.id === id);
  openDrawer({
    title: m ? L('Edit milestone', 'تعديل المحطة') : L('Add milestone', 'إضافة محطة'),
    sub: L(
      'Changes are saved as a draft program that a priest approves.',
      'تُحفظ التغييرات كمسودة برنامج يعتمدها كاهن.'
    ),
    body: (
      <>
        <C.Field label={L('Milestone name', 'اسم المحطة')} id="fm_name" value={m?.name || ''} req={true} />{' '}
        <C.Field label={L('Arabic name', 'الاسم العربي')} id="fm_ar" value={m?.ar || ''} />{' '}
        <C.Textarea
          label={L('Description or learning goal', 'الوصف أو هدف التعلم')}
          id="fm_description"
          value={m?.description || ''}
          max={1000}
        />{' '}
        <C.Textarea
          label={L('Description (Arabic)', 'الوصف بالعربية')}
          id="fm_description_ar"
          value={m?.descriptionAr || ''}
          max={1000}
        />{' '}
        <label className="check">
          <input type="checkbox" id="fm_clergy" defaultChecked={!!m?.clergyApproval} />
          <span>{L('A priest records completion', 'يسجّل الكاهن الإنجاز')}</span>
        </label>
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
        const edited = {
          ...(m || { key: `m-${Date.now().toString(36)}`, prerequisiteKeys: [] }),
          name: el.querySelector('#fm_name').value.trim(),
          ar: el.querySelector('#fm_ar').value.trim(),
          description: el.querySelector('#fm_description').value.trim(),
          descriptionAr: el.querySelector('#fm_description_ar').value.trim(),
          clergyApproval: el.querySelector('#fm_clergy').checked
        };
        const list = m ? d.milestones.map(x => (x === m ? edited : x)) : [...d.milestones, edited];
        await run(() => saveFormation(gid, d.formation, list), L('Milestone saved', 'حُفظت المحطة'));
      });
    }
  });
}

export function formationDelete(id) {
  const gid = S.params[0],
    d = groupInfo(gid),
    m = d.milestones.find(x => x.id === id);
  if (!m) return;
  if (Object.keys(m.completions || {}).length || Object.keys(m.progress || {}).length)
    return toast(
      L('Milestone has history', 'للمحطة سجل'),
      L('Members already have progress on it; it stays in the program.', 'للأعضاء تقدّم فيها؛ تبقى في البرنامج.'),
      'warning'
    );
  openModal({
    title: L('Remove milestone from the draft?', 'إزالة المحطة من المسودة؟'),
    body: <p>{L(m.name, m.ar)}</p>,
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-danger" id="fm_delete">
          {L('Remove', 'إزالة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#fm_delete').addEventListener('click', () =>
        run(
          () =>
            saveFormation(
              gid,
              d.formation,
              d.milestones.filter(x => x !== m)
            ),
          L('Milestone removed', 'أُزيلت المحطة')
        )
      );
    }
  });
}

/* A priest approves the formation draft with the reference of the review actually done. */
export function formationApprove() {
  const gid = S.params[0],
    d = groupInfo(gid);
  if (!d.formation?.draft) return;
  openDrawer({
    title: L('Approve formation program', 'اعتماد برنامج التنشئة'),
    body: <C.Field label={L('Approval reference', 'مرجع الاعتماد')} id="fa_ref" req={true} />,
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="fa_go">
          {L('Approve', 'اعتماد')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#fa_go').addEventListener('click', async () => {
        if (!need(el, '#fa_ref', L('Enter the approval reference', 'أدخل مرجع الاعتماد'))) return;
        await run(
          () => approveFormation(gid, d.formation.draft, el.querySelector('#fa_ref').value),
          L('Program approved', 'اعتُمد البرنامج')
        );
      });
    }
  });
}

/* Recording: evidence that members reached a milestone; a different reviewer completes it. */
export function formationRecord(id, pid = '') {
  const gid = S.params[0],
    d = groupInfo(gid),
    m = d.milestones.find(x => x.id === id);
  if (!m) return;
  if (!m.approved)
    return toast(
      L('Not approved yet', 'غير معتمدة بعد'),
      L('A priest must approve this milestone first.', 'يجب أن يعتمد الكاهن هذه المحطة أولاً.'),
      'warning'
    );
  openDrawer({
    title: L('Record evidence', 'تسجيل الإثبات'),
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
                    disabled={
                      !!(m.completions?.[r.p] || ['EvidenceSubmitted', 'Reviewed'].includes(m.progress?.[r.p]?.status))
                    }
                  />
                  <span>
                    {memberName(r.p)}
                    {m.completions?.[r.p] ? ` · ${L('Completed', 'مكتمل')}` : ''}
                  </span>
                </label>
              ))}
          </div>
        </fieldset>{' '}
        <C.Field
          label={L('Achieved on', 'تاريخ الإنجاز')}
          id="fr_date"
          type="date"
          value={iso(new Date())}
          req={true}
        />{' '}
        <C.Field label={L('Evidence reference', 'مرجع الإثبات')} id="fr_evidence" req={true} />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="fr_save">
          {L('Submit evidence', 'تقديم الإثبات')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#fr_save').addEventListener('click', async () => {
        const members = [...el.querySelectorAll('[name="fr_person"]:checked')].map(box => box.value),
          date = el.querySelector('#fr_date').value,
          evidence = el.querySelector('#fr_evidence').value.trim();
        if (!members.length || !date || !evidence)
          return toast(L('Choose members, date and evidence', 'اختر الأعضاء والتاريخ والإثبات'), '', 'warning');
        await run(
          () => recordCompletion(gid, d.formation, m.key, members, { date, evidence }),
          L('Evidence submitted for review', 'قُدّم الإثبات للمراجعة')
        );
      });
    }
  });
}

/* Review: a different qualified reviewer reviews and completes; a priest reopens a completion. */
export function formationReview(id, pid, reopen = false) {
  const gid = S.params[0],
    d = groupInfo(gid),
    m = d.milestones.find(x => x.id === id);
  if (!m) return;
  openDrawer({
    title: reopen ? L('Reopen completion', 'إعادة فتح الإنجاز') : L('Review and complete', 'مراجعة وإكمال'),
    sub: `${L(m.name, m.ar)} · ${memberName(pid)}`,
    body: reopen ? (
      <C.Textarea label={L('Reason', 'السبب')} id="fv_text" max={2000} />
    ) : (
      <C.Field label={L('Review reference', 'مرجع المراجعة')} id="fv_text" req={true} />
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="fv_go">
          {L('Confirm', 'تأكيد')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#fv_go').addEventListener('click', async () => {
        const text = el.querySelector('#fv_text').value.trim();
        if (!text) return toast(L('This field is required', 'هذا الحقل مطلوب'), '', 'warning');
        await run(
          () =>
            reopen
              ? reopenCompletion(gid, d.formation, m.key, pid, text)
              : reviewCompletion(gid, d.formation, m.key, pid, text),
          L('Done', 'تمّ')
        );
      });
    }
  });
}
