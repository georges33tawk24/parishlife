/* Purpose: the finance steps that are decisions rather than edits, each one a call to ParishLife.Api
   followed by a reload: opening, verifying and closing a counting session; expense decisions;
   matching and reconciling bank lines; pledge allocations; correcting a posted gift; office entry
   removal and month close; recording an exchange rate, setting a budget, recurring gifts and receipts.
   Main functions: openSessionDialog, viewSessionDialog, verifyDialog, closeSessionDialog,
   expenseDecision, bankMatchDialog, bankImportDialog, reconcileDialog, allocateDialog,
   correctGiftDialog, officeDeleteDialog, officeCloseMonth, rateDialog, budgetDialog, recurringDialog,
   recurringActionDialog, issueReceiptDialog and voidReceiptDialog. Each shows a small form and reports
   the API's own message when it refuses (for example, the same person cannot verify their own count). */
import { Select } from '../../ui/components.jsx';
import { t, fmtDate } from '../../../lib/i18n.js';
import { toast, openModal, closeOverlays } from '../../ui/ui.jsx';
import { bus } from '../../model/store.js';
import { session } from '../../model/api.js';
import { hydrate } from '../../model/persist.js';
import * as D from '../../model/data.js';
import * as F from '../../model/modules/finance.js';
import { fmt, fundName } from './money-shared.jsx';

const L = (en, ar) => t(en, ar);
const today = () => new Date().toLocaleDateString('sv-SE');
const parish = () => session.parishes.find(p => p.id === session.parishId);

/* Runs an API call from a dialog button, then reloads what the API now holds. */
async function run(button, work, done) {
  button.disabled = true;
  try {
    await work();
    await hydrate();
    closeOverlays();
    bus.refresh();
    if (done) toast(done[0], done[1] || '', 'success');
  } catch (error) {
    button.disabled = false;
    toast(L('Not saved', 'لم يُحفظ'), error.message, 'danger');
  }
}

/* A small form dialog. fields: { id, label, type: text | textarea | select | date | number | file, options,
   value, req, help }. onSubmit receives the values by id and the dialog; it returns the API work. */
function form({ title, sub, intro, fields = [], cta, danger, onSubmit, done, extra }) {
  openModal({
    title,
    sub,
    body: (
      <>
        {intro}
        {fields.map(f => (
          <div className="formrow" key={f.id}>
            <label className="label" htmlFor={'mf-' + f.id}>
              {f.label}
            </label>
            {f.type === 'select' ? (
              <Select id={'mf-' + f.id} defaultValue={f.value}>
                {(f.options || []).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            ) : f.type === 'textarea' ? (
              <textarea className="textarea" id={'mf-' + f.id} defaultValue={f.value || ''} />
            ) : f.type === 'file' ? (
              <input className="input" id={'mf-' + f.id} type="file" accept={f.accept} />
            ) : (
              <input
                className="input"
                id={'mf-' + f.id}
                type={f.type || 'text'}
                defaultValue={f.value ?? ''}
                {...(f.type === 'number' ? { step: 'any', min: '0' } : {})}
              />
            )}
            {f.help ? <p className="help">{f.help}</p> : null}
          </div>
        ))}
        {extra}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className={'btn ' + (danger ? 'btn-danger' : 'btn-primary')} id="mf-go">
          {cta}
        </button>
      </>
    ),
    onMount(el) {
      const go = el.querySelector('#mf-go');
      go.addEventListener('click', async () => {
        const values = {};
        for (const f of fields) {
          const input = el.querySelector('#mf-' + f.id);
          values[f.id] = f.type === 'file' ? input.files?.[0] : String(input.value ?? '').trim();
          if (f.req && !values[f.id]) {
            input.focus();
            return toast(L('Fill in', 'أكمل'), f.label, 'warning');
          }
        }
        await run(go, () => onSubmit(values, el), done);
      });
    }
  });
}

/* ---------- counting sessions ---------- */
export function openSessionDialog() {
  form({
    title: L('Open a counting session', 'فتح جلسة عدّ'),
    sub: L(
      'One session for one collection: a Sunday Mass, a feast or a campaign.',
      'جلسة لكل جمع: قدّاس أحد أو عيد أو حملة.'
    ),
    fields: [
      {
        id: 'source',
        label: L('What was collected', 'ما الذي جُمع'),
        req: true,
        help: L('For example: Sunday Mass collection.', 'مثلاً: جمع قدّاس الأحد.')
      },
      { id: 'date', label: L('Collected on', 'تاريخ الجمع'), type: 'date', value: today(), req: true }
    ],
    cta: L('Open session', 'فتح الجلسة'),
    onSubmit: v => F.openSession(parish(), { source: v.source, collectedOn: v.date }),
    done: [L('Counting session opened', 'فُتحت جلسة العدّ')]
  });
}
export function viewSessionDialog() {
  const sessions = D.SESSIONS;
  form({
    title: L('Choose a counting session', 'اختيار جلسة عدّ'),
    sub: L(
      'Every session of this parish, newest collection first. Open the one you are counting or verifying.',
      'كل جلسات هذه الرعية، الأحدث أولاً. افتح التي تعدّها أو تتحقّق منها.'
    ),
    fields: [
      {
        id: 'id',
        label: L('Session', 'الجلسة'),
        type: 'select',
        value: D.BATCH.id || sessions[0]?.id,
        options: sessions.map(s => [s.id, `${s.ref} · ${fmtDate(s.date)} · ${s.source} · ${s.apiStatus}`]),
        req: true
      }
    ],
    cta: L('Open', 'فتح'),
    onSubmit: v => F.viewSession(parish(), v.id)
  });
}

/* The second counter enters their own count, without being shown the first. */
export function verifyDialog() {
  const batch = D.BATCH;
  const combos = (batch.totals || []).map(x => [x.currency, x.method]);
  form({
    title: L('Verify this count', 'التحقق من هذا العدّ'),
    sub: L(
      'Count the cash yourself and enter what you counted. You are not shown the first count. A different person from whoever counted or edited the lines verifies.',
      'عُدّ النقد بنفسك وأدخل ما عددته. لا يظهر لك العدّ الأول. يتحقّق شخص غير من عدّ البنود أو عدّلها.'
    ),
    fields: [
      ...combos.map(([currency, method]) => ({
        id: `t-${currency}-${method}`,
        label: `${currency} · ${method}`,
        type: 'number'
      })),
      {
        id: 'note',
        label: L('Note, if the counts differ (optional)', 'ملاحظة إن اختلف العدّان (اختياري)'),
        type: 'textarea'
      }
    ],
    cta: L('Submit my count', 'إرسال عدّي'),
    onSubmit: v =>
      F.verifySession(
        parish(),
        batch,
        combos
          .map(([currency, method]) => ({ currency, method, amount: Number(v[`t-${currency}-${method}`] || 0) }))
          .filter(x => x.amount > 0),
        v.note
      ).then(session =>
        toast(
          session.status === 'Verified' ? L('Counts agree', 'العدّان متطابقان') : L('Counts differ', 'العدّان مختلفان'),
          session.status === 'Verified'
            ? L('The session can be closed.', 'يمكن إقفال الجلسة.')
            : L(
                'Both counts are kept. Recount and correct the lines, then verify again.',
                'يُحفظ العدّان. أعد العدّ وصحّح البنود ثم تحقّق من جديد.'
              ),
          session.status === 'Verified' ? 'success' : 'warning'
        )
      )
  });
}

export function closeSessionDialog() {
  const batch = D.BATCH;
  form({
    title: L('Close this counting session?', 'إقفال جلسة العدّ هذه؟'),
    sub: L(
      'Closing posts every line as a gift to its fund. Corrections after this point are made by a reversing entry.',
      'الإقفال يقيّد كل بند تقدمةً في صندوقه. والتصحيح بعده يكون بقيد عكسي.'
    ),
    intro: (
      <dl className="dl" style={{ marginBottom: '16px' }}>
        {(batch.totals || []).map((x, i) => (
          <span key={i} style={{ display: 'contents' }}>
            <dt>
              {x.currency} · {x.method}
            </dt>
            <dd className="mono tnum">{fmt(x.amount, x.currency)}</dd>
          </span>
        ))}
      </dl>
    ),
    cta: L('Close session', 'إقفال الجلسة'),
    onSubmit: () => F.postSession(parish(), batch),
    done: [L('Counting session closed', 'أُقفلت جلسة العدّ'), L('Posted to the funds.', 'قُيّدت في الصناديق.')]
  });
}

/* ---------- gifts and pledges ---------- */
export function correctGiftDialog(id) {
  const gift = D.CONTRIBUTIONS.find(c => c.id === id);
  if (!gift) return;
  form({
    title: L('Correct this gift', 'تصحيح هذه التقدمة'),
    sub: `${fmt(gift.amount, gift.currency)} · ${fundName(gift.fund)} · ${fmtDate(gift.date)}`,
    fields: [
      {
        id: 'action',
        label: L('What to do', 'ما المطلوب'),
        type: 'select',
        options: [
          ['reverse', L('Reverse it', 'عكسها')],
          ['reclassify', L('Move it to another fund', 'نقلها إلى صندوق آخر')]
        ]
      },
      {
        id: 'fund',
        label: L('Fund (to move it)', 'الصندوق (للنقل)'),
        type: 'select',
        value: gift.fund,
        options: D.FUNDS.map(f => [f.id, L(f.name, f.ar)])
      },
      { id: 'reason', label: L('Reason', 'السبب'), type: 'textarea', req: true }
    ],
    cta: L('Correct', 'تصحيح'),
    onSubmit: v =>
      F.correctContribution(parish(), gift, {
        action: v.action,
        reason: v.reason,
        ...(v.action === 'reclassify' ? { fundId: v.fund } : {})
      }),
    done: [
      L('Gift corrected', 'صُحّحت التقدمة'),
      L('The reversal stays in the history.', 'يبقى القيد العكسي في السجل.')
    ]
  });
}

export function allocateDialog(id) {
  const pledge = D.PLEDGES.find(p => p.id === id);
  if (!pledge) return;
  const gifts = D.CONTRIBUTIONS.filter(
    c =>
      c.status === 'Posted' && c.currency === pledge.currency && (c.p === pledge.p || (pledge.hh && c.hh === pledge.hh))
  );
  if (!gifts.length)
    return toast(
      L('No gift to count against this pledge', 'لا تقدمة تُحتسب على هذا التعهّد'),
      L(
        `Posted gifts in ${pledge.currency} from the same giver appear here.`,
        `تظهر هنا التقدمات المقيّدة بعملة ${pledge.currency} من المتبرّع نفسه.`
      ),
      'warning'
    );
  form({
    title: L('Count a gift against this pledge', 'احتساب تقدمة على هذا التعهّد'),
    sub: `${fmt(pledge.pledged, pledge.currency)} ${L('pledged', 'متعهَّد به')} · ${fmt(pledge.paid, pledge.currency)} ${L('counted', 'محتسب')}`,
    fields: [
      {
        id: 'gift',
        label: L('Gift', 'التقدمة'),
        type: 'select',
        options: gifts.map(c => [c.id, `${fmtDate(c.date)} · ${fmt(c.amount, c.currency)}`])
      },
      { id: 'amount', label: L('Amount to count', 'المبلغ المحتسب'), type: 'number', req: true }
    ],
    cta: L('Count it', 'احتسابها'),
    onSubmit: v => F.allocatePledge(parish(), pledge, v.gift, v.amount),
    done: [L('Counted against the pledge', 'احتُسبت على التعهّد')]
  });
}

/* ---------- expenses ---------- */
const EXPENSE_ACTIONS = {
  submit: ['Submit for approval', 'إرسال للموافقة', false],
  approve: ['Approve this expense', 'اعتماد هذا المصروف', false],
  return: ['Return for changes', 'إعادة للتعديل', true],
  reject: ['Reject this expense', 'رفض هذا المصروف', true],
  cancel: ['Cancel this expense', 'إلغاء هذا المصروف', true],
  'record-payment': ['Record the payment', 'تسجيل الدفع', false]
};
export function expenseDecision(id, action) {
  const expense = D.EXPENSES.find(x => x.id === id);
  const [en, ar, needsReason] = EXPENSE_ACTIONS[action] || [];
  if (!expense || !en) return;
  const paying = action === 'record-payment';
  form({
    title: L(en, ar),
    sub: `${expense.what} · ${fmt(expense.amount, expense.currency)}`,
    intro:
      action === 'approve' && expense.missingEvidence ? (
        <p className="help" style={{ marginBottom: '12px' }}>
          {L(
            'This expense has no receipt. Approving accepts that exception: ',
            'لا إيصال لهذا المصروف. الموافقة تقبل هذا الاستثناء: '
          )}
          {expense.missingEvidence}
        </p>
      ) : null,
    fields: [
      ...(needsReason ? [{ id: 'reason', label: L('Reason', 'السبب'), type: 'textarea', req: true }] : []),
      ...(paying
        ? [
            { id: 'paidOn', label: L('Paid on', 'تاريخ الدفع'), type: 'date', value: today(), req: true },
            { id: 'ref', label: L('Payment reference', 'مرجع الدفع'), req: true }
          ]
        : [])
    ],
    cta: L(en, ar),
    danger: needsReason && action !== 'return',
    onSubmit: v =>
      F.expenseAction(parish(), expense, action, {
        ...(needsReason ? { reason: v.reason } : {}),
        ...(paying ? { paidOn: v.paidOn, paymentReference: v.ref } : {})
      }),
    done: [L('Done', 'تمّ'), expense.what]
  });
}

/* ---------- bank ---------- */
export function bankImportDialog() {
  const accounts = [...new Set(D.BANKLINES.map(b => b.account))];
  form({
    title: L('Import bank statement lines', 'استيراد قيود كشف المصرف'),
    sub: L(
      'A CSV with the header Date,Reference,Amount,Currency. Dates are yyyy-mm-dd; deposits are positive, withdrawals negative. Lines already imported are skipped.',
      'ملف CSV برأس Date,Reference,Amount,Currency. التواريخ yyyy-mm-dd؛ الإيداعات موجبة والسحوبات سالبة. تُتخطّى القيود المستوردة سابقاً.'
    ),
    fields: [
      { id: 'account', label: L('Bank account name', 'اسم الحساب المصرفي'), value: accounts[0] || '', req: true },
      { id: 'file', label: L('CSV file', 'ملف CSV'), type: 'file', accept: '.csv,text/csv', req: true }
    ],
    cta: L('Import', 'استيراد'),
    onSubmit: async v => {
      const result = await F.importBank(parish(), v.account, await v.file.text());
      toast(
        L('Imported', 'تمّ الاستيراد'),
        L(
          `${result.imported} new, ${result.duplicates} already there.`,
          `${result.imported} جديد، ${result.duplicates} موجود سابقاً.`
        ),
        'success'
      );
    }
  });
}

export function bankMatchDialog(id) {
  const line = D.BANKLINES.find(b => b.id === id);
  if (!line) return;
  const deposit = line.amount > 0;
  const gifts = D.CONTRIBUTIONS.filter(c => c.status === 'Posted' && c.currency === line.currency);
  const paid = D.EXPENSES.filter(x => x.apiStatus === 'Paid' && x.currency === line.currency);
  const kinds = deposit
    ? [
        ['Contribution', L('A posted gift', 'تقدمة مقيّدة')],
        ['Other', L('Something else (explain)', 'شيء آخر (اشرح)')]
      ]
    : [
        ['Expense', L('A paid expense', 'مصروف مدفوع')],
        ['Fee', L('A bank fee', 'رسم مصرفي')],
        ['Other', L('Something else (explain)', 'شيء آخر (اشرح)')]
      ];
  const head = `${fmtDate(line.at)} · ${line.ref} · ${fmt(line.amount, line.currency)}`;
  const recordOptions = kind =>
    kind === 'Contribution'
      ? gifts.map(c => [c.id, `${fmtDate(c.date)} · ${fmt(c.amount, c.currency)} · ${fundName(c.fund)}`])
      : paid.map(x => [x.id, `${x.what} · ${fmt(x.amount, x.currency)}`]);
  form({
    title: L('Match this bank line', 'مطابقة هذا القيد المصرفي'),
    sub: head,
    fields: [
      { id: 'kind', label: L('It is', 'هو'), type: 'select', options: kinds },
      {
        id: 'record',
        label: L('Which one (gift or expense)', 'أيّ واحد (تقدمة أو مصروف)'),
        type: 'select',
        options: [...recordOptions('Contribution'), ...recordOptions('Expense')],
        help: L(
          'Used for a gift or an expense. The line is matched in full.',
          'للتقدمة أو المصروف. يُطابَق القيد كاملاً.'
        )
      },
      { id: 'note', label: L('Note (needed for "something else")', 'ملاحظة (مطلوبة لـ«شيء آخر»)') }
    ],
    cta: L('Match', 'مطابقة'),
    onSubmit: v =>
      F.bankLineAction(parish(), line, 'match', {
        allocations: [
          {
            kind: v.kind,
            amount: line.amount,
            ...(v.kind === 'Contribution' || v.kind === 'Expense' ? { recordId: v.record } : {}),
            ...(v.note ? { note: v.note } : {})
          }
        ]
      }),
    done: [L('Matched', 'تمّت المطابقة')],
    extra: line.status === 'Unmatched' ? <OutstandingLink line={line} /> : null
  });
}
function OutstandingLink({ line }) {
  return (
    <p className="help" style={{ marginTop: '12px' }}>
      <button
        className="btn btn-ghost btn-dense"
        onClick={() => {
          closeOverlays();
          form({
            title: L('Mark as outstanding', 'تعليم كمعلّق'),
            sub: `${line.ref}`,
            fields: [
              { id: 'reason', label: L('Why, and who follows it up', 'السبب ومن يتابعه'), type: 'textarea', req: true }
            ],
            cta: L('Mark outstanding', 'تعليم كمعلّق'),
            onSubmit: v => F.bankLineAction(parish(), line, 'outstanding', { reason: v.reason })
          });
        }}
      >
        {L('Not matched yet — mark it outstanding instead', 'غير مطابَق بعد — علّمه معلّقاً')}
      </button>
    </p>
  );
}
export function bankUnmatchDialog(id) {
  const line = D.BANKLINES.find(b => b.id === id);
  if (!line) return;
  form({
    title: L('Undo this match', 'التراجع عن هذه المطابقة'),
    sub: `${line.ref} · ${fmt(line.amount, line.currency)}`,
    fields: [{ id: 'reason', label: L('Reason', 'السبب'), type: 'textarea', req: true }],
    cta: L('Undo match', 'تراجع عن المطابقة'),
    danger: true,
    onSubmit: v => F.bankLineAction(parish(), line, 'unmatch', { reason: v.reason })
  });
}
/* Closing a month: a reviewer who matched none of its lines. Reopening needs a reason. */
export function reconcileDialog(account, period, reopen = false) {
  form({
    title: reopen
      ? L('Reopen this month', 'إعادة فتح هذا الشهر')
      : L('Close this bank month', 'إقفال هذا الشهر المصرفي'),
    sub: `${account} · ${period}`,
    intro: reopen ? null : (
      <p className="help" style={{ marginBottom: '12px' }}>
        {L(
          'Every line must be matched or marked outstanding, and the person closing it must not have matched any of them.',
          'يجب أن يكون كل قيد مطابَقاً أو معلّقاً، وألّا يكون من يقفل الشهر قد طابق أيّاً منها.'
        )}
      </p>
    ),
    fields: reopen ? [{ id: 'reason', label: L('Reason', 'السبب'), type: 'textarea', req: true }] : [],
    cta: reopen ? L('Reopen', 'إعادة فتح') : L('Close month', 'إقفال الشهر'),
    onSubmit: v => F.reconcileMonth(parish(), account, period, reopen ? v.reason : undefined),
    done: [reopen ? L('Month reopened', 'أُعيد فتح الشهر') : L('Month reconciled', 'طوبق الشهر')]
  });
}

/* ---------- office ledger ---------- */
export function officeDeleteDialog(row) {
  const reverse = row.monthClosed;
  form({
    title: reverse
      ? L('Reverse this transaction?', 'عكس هذه العملية؟')
      : L('Remove this transaction?', 'إزالة هذه العملية؟'),
    sub: row.description,
    intro: (
      <p style={{ marginBottom: '12px' }}>
        {reverse
          ? L(
              'Its month is closed, so a reversing entry is added in an open month. Both stay in the history.',
              'شهرها مقفل، فيُضاف قيد عكسي في شهر مفتوح. ويبقى القيدان في السجل.'
            )
          : L(
              'The monthly balance is recalculated. The entry stays in the history with your reason.',
              'يُعاد حساب الرصيد الشهري. ويبقى القيد في السجل مع سببك.'
            )}
      </p>
    ),
    fields: [
      { id: 'reason', label: L('Reason', 'السبب'), type: 'textarea', req: true },
      ...(reverse ? [{ id: 'on', label: L('Reversal date', 'تاريخ القيد العكسي'), type: 'date', value: today() }] : [])
    ],
    cta: reverse ? L('Reverse', 'عكس') : L('Remove', 'إزالة'),
    danger: true,
    onSubmit: v =>
      F.officeEntryAction(parish(), row, reverse ? 'reverse' : 'remove', v.reason, reverse ? v.on : undefined),
    done: [reverse ? L('Transaction reversed', 'عُكست العملية') : L('Transaction removed', 'أُزيلت العملية')]
  });
}
export function officeCloseMonth(period) {
  form({
    title: L('Close this office month?', 'إقفال شهر المكتب هذا؟'),
    sub: period,
    intro: (
      <p style={{ marginBottom: '12px' }}>
        {L(
          'A reviewer who entered none of the month’s lines closes it. After that, a line is corrected by a reversal.',
          'يقفله مراجع لم يُدخل أيّاً من بنود الشهر. وبعد ذلك يُصحَّح البند بقيد عكسي.'
        )}
      </p>
    ),
    cta: L('Close month', 'إقفال الشهر'),
    onSubmit: () => F.closeOfficeMonth(parish(), period),
    done: [L('Month closed', 'أُقفل الشهر'), period]
  });
}

/* ---------- exchange rates, budgets, recurring gifts and receipts ---------- */
const CURRENCIES = [
  ['USD', 'USD'],
  ['LBP', 'LBP'],
  ['EUR', 'EUR']
];

/* The office records a rate it read from a named source for a date. ParishLife never fetches one and
   never converts amounts with it. */
export function rateDialog() {
  form({
    title: L('Record an exchange rate', 'تسجيل سعر صرف'),
    sub: L(
      'Enter the rate as you read it, with the date it applied and where it came from. Amounts are never converted with it.',
      'أدخل السعر كما قرأته، مع تاريخ سريانه ومصدره. ولا تُحوَّل المبالغ به.'
    ),
    fields: [
      { id: 'base', label: L('One unit of', 'وحدة واحدة من'), type: 'select', value: 'USD', options: CURRENCIES },
      { id: 'quote', label: L('Is worth, in', 'تساوي، بعملة'), type: 'select', value: 'LBP', options: CURRENCIES },
      { id: 'rate', label: L('Rate', 'السعر'), type: 'number', req: true },
      { id: 'on', label: L('Applied on', 'تاريخ السريان'), type: 'date', value: today(), req: true },
      {
        id: 'source',
        label: L('Source', 'المصدر'),
        req: true,
        help: L('For example: the published bank rate that morning.', 'مثلاً: سعر المصرف المعلن صباح ذلك اليوم.')
      },
      { id: 'note', label: L('Note (optional)', 'ملاحظة (اختياري)'), type: 'textarea' }
    ],
    cta: L('Record rate', 'تسجيل السعر'),
    onSubmit: v => F.recordRate(parish(), v),
    done: [L('Exchange rate recorded', 'سُجّل سعر الصرف')]
  });
}

/* A fund budget for a year and currency. */
export function budgetDialog(fundId) {
  const fund = D.FUNDS.find(f => f.id === fundId);
  if (!fund) return;
  const year = new Date().getFullYear();
  form({
    title: L('Set a budget', 'تحديد موازنة'),
    sub: fundName(fund.id),
    fields: [
      { id: 'year', label: L('Year', 'السنة'), type: 'number', value: year, req: true },
      { id: 'currency', label: L('Currency', 'العملة'), type: 'select', value: 'USD', options: CURRENCIES },
      { id: 'amount', label: L('Budget', 'الموازنة'), type: 'number', req: true },
      { id: 'note', label: L('Note (optional)', 'ملاحظة (اختياري)'), type: 'textarea' }
    ],
    cta: L('Save budget', 'حفظ الموازنة'),
    onSubmit: v => {
      const existing = D.BUDGETS.find(
        b => b.fund === fund.id && b.year === Number(v.year) && b.currency === v.currency
      );
      return F.saveBudget(parish(), { fund: fund.id, ...v }, existing);
    },
    done: [L('Budget saved', 'حُفظت الموازنة')]
  });
}

const FREQUENCIES = () => [
  ['Weekly', L('Every week', 'كل أسبوع')],
  ['Monthly', L('Every month', 'كل شهر')],
  ['Quarterly', L('Every three months', 'كل ثلاثة أشهر')],
  ['Yearly', L('Every year', 'كل سنة')]
];
const METHODS = () => [
  ['Cash', L('Cash', 'نقداً')],
  ['Bank', L('Bank transfer', 'تحويل مصرفي')],
  ['Cheque', L('Cheque', 'شيك')],
  ['Card', L('Card', 'بطاقة')],
  ['Other', L('Other', 'أخرى')]
];
export const frequencyLabel = f => (FREQUENCIES().find(([k]) => k === f) || [f, f])[1];

/* A standing intention to give, for a person or a household. Saving it charges no one. */
export function recurringDialog(id) {
  const gift = id ? D.RECURRING.find(r => r.id === id) : null;
  const people = (D.PEOPLE || []).map(p => [p.id, L(p.lat || p.id, p.ar || p.lat || p.id)]);
  const households = (D.HOUSEHOLDS || []).map(h => [h.id, L(h.name, h.ar || h.name)]);
  form({
    title: gift ? L('Edit recurring gift', 'تعديل العطاء الدائم') : L('New recurring gift', 'عطاء دائم جديد'),
    sub: L(
      'A record of what a giver intends to give. Nothing is charged; each gift counts once it is received and posted.',
      'سجلّ لما ينوي المتبرّع إعطاءه. لا يُقتطع شيء؛ وتُحتسب كل تقدمة عند استلامها وقيدها.'
    ),
    fields: [
      {
        id: 'p',
        label: L('Person', 'الشخص'),
        type: 'select',
        value: gift?.p || '',
        options: [['', L('None', 'لا أحد')], ...people]
      },
      {
        id: 'hh',
        label: L('Or household', 'أو العائلة'),
        type: 'select',
        value: gift?.hh || '',
        options: [['', L('None', 'لا أحد')], ...households]
      },
      {
        id: 'fund',
        label: L('Fund', 'الصندوق'),
        type: 'select',
        value: gift?.fund || D.FUNDS[0]?.id,
        options: D.FUNDS.map(f => [f.id, L(f.name, f.ar)])
      },
      { id: 'amount', label: L('Amount', 'المبلغ'), type: 'number', value: gift?.amount ?? '', req: true },
      {
        id: 'currency',
        label: L('Currency', 'العملة'),
        type: 'select',
        value: gift?.currency || 'USD',
        options: CURRENCIES
      },
      {
        id: 'frequency',
        label: L('How often', 'كم مرة'),
        type: 'select',
        value: gift?.frequency || 'Monthly',
        options: FREQUENCIES()
      },
      {
        id: 'method',
        label: L('How they give', 'طريقة العطاء'),
        type: 'select',
        value: gift?.method || 'Cash',
        options: METHODS()
      },
      { id: 'starts', label: L('Starts', 'يبدأ'), type: 'date', value: gift?.starts || today(), req: true },
      { id: 'ends', label: L('Ends (optional)', 'ينتهي (اختياري)'), type: 'date', value: gift?.ends || '' },
      { id: 'note', label: L('Note (optional)', 'ملاحظة (اختياري)'), type: 'textarea', value: gift?.note || '' }
    ],
    cta: L('Save', 'حفظ'),
    onSubmit: v => {
      if (!v.p && !v.hh) throw new Error(L('Choose a person or a household.', 'اختر شخصاً أو عائلة.'));
      return F.saveRecurring(parish(), v, gift);
    },
    done: [L('Recurring gift saved', 'حُفظ العطاء الدائم'), L('Nothing was charged.', 'لم يُقتطع شيء.')]
  });
}

const RECURRING_ACTIONS = {
  pause: ['Pause this recurring gift', 'إيقاف هذا العطاء مؤقتاً', false],
  resume: ['Resume this recurring gift', 'استئناف هذا العطاء', false],
  end: ['End this recurring gift', 'إنهاء هذا العطاء', true]
};
export function recurringActionDialog(id, action) {
  const gift = D.RECURRING.find(r => r.id === id);
  const [en, ar, needsReason] = RECURRING_ACTIONS[action] || [];
  if (!gift || !en) return;
  form({
    title: L(en, ar),
    sub: `${fmt(gift.amount, gift.currency)} · ${frequencyLabel(gift.frequency)} · ${fundName(gift.fund)}`,
    fields:
      action === 'resume'
        ? []
        : [
            {
              id: 'reason',
              label: needsReason ? L('Reason', 'السبب') : L('Reason (optional)', 'السبب (اختياري)'),
              type: 'textarea',
              req: needsReason
            }
          ],
    cta: L(en, ar),
    danger: action === 'end',
    onSubmit: v => F.recurringAction(parish(), gift, action, v.reason),
    done: [L('Saved', 'حُفظ')]
  });
}

/* Issues the next receipt number for a posted gift with a named giver. */
export function issueReceiptDialog(contributionId) {
  const gift = D.CONTRIBUTIONS.find(c => c.id === contributionId);
  if (!gift) return;
  form({
    title: L('Issue a numbered receipt?', 'إصدار إيصال مرقّم؟'),
    sub: `${fmt(gift.amount, gift.currency)} · ${fundName(gift.fund)} · ${fmtDate(gift.date)}`,
    intro: (
      <p className="help" style={{ marginBottom: '12px' }}>
        {L(
          'The receipt takes the next parish number. A gift gets one receipt; a voided receipt keeps its number. It records a gift received and is not a tax document.',
          'يأخذ الإيصال الرقم التالي للرعية. لكل تقدمة إيصال واحد؛ والإيصال الملغى يحتفظ برقمه. وهو سجلّ تقدمة مستلمة وليس مستنداً ضريبياً.'
        )}
      </p>
    ),
    cta: L('Issue receipt', 'إصدار الإيصال'),
    onSubmit: () =>
      F.issueReceipt(parish(), gift.id).then(r =>
        toast(L(`Receipt No. ${r.number} issued`, `صدر الإيصال رقم ${r.number}`), '', 'success')
      )
  });
}

export function voidReceiptDialog(id) {
  const receipt = D.RECEIPTS.find(r => r.id === id);
  if (!receipt) return;
  form({
    title: L(`Void receipt No. ${receipt.no}?`, `إلغاء الإيصال رقم ${receipt.no}؟`),
    sub: `${fmt(receipt.amount, receipt.currency)} · ${fmtDate(receipt.date)}`,
    fields: [{ id: 'reason', label: L('Reason', 'السبب'), type: 'textarea', req: true }],
    cta: L('Void receipt', 'إلغاء الإيصال'),
    danger: true,
    onSubmit: v => F.voidReceipt(parish(), receipt, v.reason),
    done: [
      L('Receipt voided', 'أُلغي الإيصال'),
      L('Its number stays used and is not reissued.', 'يبقى رقمه مستعملاً ولا يُعاد إصداره.')
    ]
  });
}
