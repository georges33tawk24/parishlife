/* Finance: funds with their balances and this year's budgets, expenses (draft, approval, payment), bank
   reconciliation, and the exchange rates the office recorded. Amounts stay in the currency they were
   recorded in: a recorded rate is shown for reference with its date and source and is never used to
   convert or add amounts. */
import { css } from '../../ui/html.js';
import { t, fmtDate } from '../../../lib/i18n.js';
import { Icon, PageHead, Panel, Pill, Table, Empty, Stat, TabBar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { FUNDS, EXPENSES, BANKLINES, RATES } from '../../model/data.js';
import { nameOf } from '../../model/names.js';
import { session } from '../../model/api.js';
import { applyFinanceAccess, fundName, fmt, amounts, can, State } from './money-shared.jsx';
import * as A from './money-actions.jsx';

const L = (en, ar) => t(en, ar);

/* ---------------- finance ---------------- */
const FTABS = () => [
  ['', 'Funds', 'الصناديق'],
  ['expenses', 'Expenses', 'المصاريف', EXPENSES.filter(x => x.apiStatus === 'Submitted').length],
  ['reconciliation', 'Reconciliation', 'المطابقة', BANKLINES.filter(b => b.status === 'Unmatched').length]
];

const sum = (key, fn = f => f) => {
  const totals = {};
  for (const f of FUNDS) for (const b of f.balances) totals[b.currency] = (totals[b.currency] || 0) + b[key];
  return fn(totals);
};

export function finance(tab = '') {
  const year = new Date().getFullYear();
  const waiting = EXPENSES.filter(x => x.apiStatus === 'Submitted');
  const unmatched = BANKLINES.filter(b => b.status === 'Unmatched');
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Money', 'المال') }, { label: L('Finance', 'المالية') }]}
        title={L('Funds, expenses and the bank', 'الصناديق والمصاريف والمصرف')}
        sub={L(
          'Restricted funds stay restricted. Every amount is in the currency it was paid in; currencies are never added together.',
          'الصناديق المقيّدة تبقى مقيّدة. وكل مبلغ بعملة الدفع؛ ولا تُجمع العملات معاً.'
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-act="export">
              <Icon name="export" size={17} />
              {L('Export to Excel', 'تصدير إلى Excel')}
            </button>{' '}
            {can('finance.enter') ? (
              <button className="btn btn-primary" data-act="exp-add">
                <Icon name="plus" size={17} />
                {L('Record expense', 'تسجيل مصروف')}
              </button>
            ) : null}
          </>
        }
      />
      <TabBar base="finance" items={FTABS()} active={tab} />
    </>
  );
  if (tab === 'expenses')
    return (
      <>
        {head}
        <div className="tabbody">
          <Table
            cols={[
              { label: L('Date', 'التاريخ'), cls: 'hide-sm', sort: true },
              { label: L('What', 'البيان'), sort: true },
              { label: L('Fund', 'الصندوق'), cls: 'hide-md' },
              { label: L('Amount', 'المبلغ'), cls: 'num', sort: true },
              { label: L('Status', 'الحالة'), cls: 'shrink' },
              { label: '', cls: 'shrink' }
            ]}
            rows={EXPENSES.map(x => ({
              detail: (
                <div className="grid g3" style={{ gap: '20px' }}>
                  <dl className="dl">
                    <dt>{L('Paid to', 'المدفوع له')}</dt>
                    <dd>{x.payee || '—'}</dd>
                    <dt>{L('Entered by', 'أدخله')}</dt>
                    <dd>{nameOf(session.parishId, x.createdBy) || '—'}</dd>
                    {x.approvedBy ? (
                      <>
                        <dt>{L('Approved by', 'اعتمده')}</dt>
                        <dd>{nameOf(session.parishId, x.approvedBy) || '—'}</dd>
                      </>
                    ) : null}
                    <dt>{L('Receipt', 'الإيصال')}</dt>
                    <dd>
                      {x.evidence
                        ? x.evidence
                        : x.missingEvidence
                          ? `${L('None: ', 'لا إيصال: ')}${x.missingEvidence}${x.missingEvidenceApproved ? L(' (accepted by the approver)', ' (قبله المعتمِد)') : ''}`
                          : '—'}
                    </dd>
                  </dl>{' '}
                  <dl className="dl">
                    {x.reason ? (
                      <>
                        <dt>{L('Reason given', 'السبب المذكور')}</dt>
                        <dd>{x.reason}</dd>
                      </>
                    ) : null}
                    {x.paidOn ? (
                      <>
                        <dt>{L('Paid on', 'دُفع في')}</dt>
                        <dd>
                          {fmtDate(x.paidOn)} · {x.paymentReference}
                        </dd>
                      </>
                    ) : null}
                  </dl>
                </div>
              ),
              cells: [
                <span className="mono dim">{fmtDate(x.d)}</span>,
                <span className="row" style={{ gap: '6px' }}>
                  <C.IconBtn ico="chevR" label={L('Expand', 'توسيع')} data-expand="" aria-expanded="false" />{' '}
                  <b style={{ font: '500 14px/20px var(--sans)' }}>{L(x.what, x.whatAr)}</b>
                </span>,
                <span className="dim">{fundName(x.fund)}</span>,
                <span className="num">{fmt(x.amount, x.currency)}</span>,
                <State k={x.status} />,
                <span className="row" style={{ gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {['Draft', 'Returned'].includes(x.apiStatus) && can('finance.enter') ? (
                    <>
                      <button className="btn btn-secondary btn-dense" data-money={`exp-edit:${x.id}`}>
                        {L('Edit', 'تعديل')}
                      </button>
                      <button className="btn btn-primary btn-dense" data-money={`exp:submit:${x.id}`}>
                        {L('Submit', 'إرسال')}
                      </button>
                    </>
                  ) : null}
                  {x.apiStatus === 'Submitted' && can('finance.approve') ? (
                    <>
                      <button className="btn btn-primary btn-dense" data-act={`exp-approve:${x.id}`}>
                        {L('Approve', 'موافقة')}
                      </button>
                      <button className="btn btn-secondary btn-dense" data-money={`exp:return:${x.id}`}>
                        {L('Return', 'إعادة')}
                      </button>
                      <button className="btn btn-secondary btn-dense" data-money={`exp:reject:${x.id}`}>
                        {L('Reject', 'رفض')}
                      </button>
                    </>
                  ) : null}
                  {x.apiStatus === 'Approved' && can('finance.post') ? (
                    <button className="btn btn-primary btn-dense" data-money={`exp:record-payment:${x.id}`}>
                      {L('Record payment', 'تسجيل الدفع')}
                    </button>
                  ) : null}
                  {['Draft', 'Submitted', 'Returned', 'Approved'].includes(x.apiStatus) && can('finance.enter') ? (
                    <button className="btn btn-ghost btn-dense" data-money={`exp:cancel:${x.id}`}>
                      {L('Cancel', 'إلغاء')}
                    </button>
                  ) : null}
                </span>
              ]
            }))}
            empty={
              <Empty
                glyph="fin"
                title={L('No expenses recorded', 'لا مصاريف مسجّلة')}
                body={L(
                  'Record the first one with its receipt reference, or the reason there is none.',
                  'سجّل الأول مع مرجع الإيصال، أو سبب غيابه.'
                )}
                action={
                  can('finance.enter') ? (
                    <button className="btn btn-primary btn-dense" data-act="exp-add">
                      {L('Record expense', 'تسجيل مصروف')}
                    </button>
                  ) : null
                }
              />
            }
          />
          <p className="t-caption dim" style={{ marginTop: '12px' }}>
            {L(
              'A different person from whoever entered or submitted an expense approves it. A receipt is a reference to the document; ParishLife does not store the photo here.',
              'يوافق على المصروف شخص غير من أدخله أو أرسله. والإيصال مرجع للمستند؛ ولا يحفظ «حياة الرعية» صورته هنا.'
            )}
          </p>
        </div>
      </>
    );
  if (tab === 'reconciliation') {
    const months = [
      ...new Map(
        BANKLINES.map(b => [`${b.account}\u0000${b.at.slice(0, 7)}`, { account: b.account, period: b.at.slice(0, 7) }])
      ).values()
    ];
    const reconciled = (account, period) =>
      BANKLINES.filter(b => b.account === account && b.at.slice(0, 7) === period).every(b => b.reconciled);
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="toolbar">
            {can('finance.enter') ? (
              <button className="btn btn-secondary" data-money="bank-import" style={{ marginInlineStart: 'auto' }}>
                <Icon name="plus" size={17} />
                {L('Import statement lines', 'استيراد قيود الكشف')}
              </button>
            ) : null}
          </div>{' '}
          {BANKLINES.length ? (
            unmatched.length ? (
              <C.InlineAlert
                tone="warning"
                title={L(
                  `${unmatched.length} bank line${unmatched.length === 1 ? ' is' : 's are'} not matched yet`,
                  `${unmatched.length} قيود مصرفية غير مطابَقة`
                )}
                body={L(
                  'Match each line to a posted gift, a paid expense or a fee, or mark it outstanding with a reason.',
                  'طابق كل قيد بتقدمة مقيّدة أو مصروف مدفوع أو رسم، أو علّمه معلّقاً مع السبب.'
                )}
              />
            ) : (
              <C.InlineAlert
                tone="success"
                title={L('Every bank line is matched or explained', 'كل القيود المصرفية مطابَقة أو مبرَّرة')}
                body={L(
                  'Close each month once a second person has reviewed it.',
                  'أقفل كل شهر بعد أن يراجعه شخص ثانٍ.'
                )}
              />
            )
          ) : null}{' '}
          <div style={{ marginTop: '16px' }}>
            <Table
              cols={[
                { label: L('Date', 'التاريخ') },
                { label: L('Bank reference', 'المرجع المصرفي') },
                { label: L('Amount', 'المبلغ'), cls: 'num' },
                { label: L('Matched to', 'مطابَق مع') },
                { label: '', cls: 'shrink' }
              ]}
              rows={BANKLINES.map(b => ({
                cells: [
                  <span className="mono dim">{fmtDate(b.at)}</span>,
                  <span className="mono">
                    {b.ref}
                    <small className="dim"> · {b.account}</small>
                  </span>,
                  <span className="num" style={css(b.amount < 0 ? 'color:var(--danger-ink)' : '')}>
                    {fmt(Math.abs(b.amount), b.currency)}
                    {b.amount < 0 ? ' −' : ''}
                  </span>,
                  b.status === 'Matched' ? (
                    <Pill label={b.allocations.map(a => a.kind).join(' + ') || L('Matched', 'مطابَق')} tone="success" />
                  ) : b.status === 'Outstanding' ? (
                    <Pill label={L('Outstanding', 'معلّق')} tone="warning" />
                  ) : (
                    <span className="dimmer">—</span>
                  ),
                  b.reconciled ? (
                    <Pill label={L('Month closed', 'الشهر مقفل')} />
                  ) : b.status === 'Unmatched' && can('finance.post') ? (
                    <button className="btn btn-secondary btn-dense" data-act={`bank-match:${b.id}`}>
                      {L('Match', 'مطابقة')}
                    </button>
                  ) : b.status !== 'Unmatched' && can('finance.approve') ? (
                    <button className="btn btn-ghost btn-dense" data-money={`bank-unmatch:${b.id}`}>
                      {L('Undo', 'تراجع')}
                    </button>
                  ) : (
                    ''
                  )
                ]
              }))}
              empty={
                <Empty
                  glyph="fin"
                  title={L('No bank lines yet', 'لا قيود مصرفية بعد')}
                  body={L(
                    'Import the bank statement as a CSV (Date, Reference, Amount, Currency).',
                    'استورد كشف المصرف بصيغة CSV (التاريخ، المرجع، المبلغ، العملة).'
                  )}
                />
              }
            />
          </div>{' '}
          {months.length ? (
            <div style={{ marginTop: '24px' }}>
              <Panel title={L('Months', 'الأشهر')}>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {months.map(m => (
                    <li key={m.account + m.period} className="row" style={{ gap: '10px' }}>
                      <span className="t-caption">
                        {m.account} · {m.period}
                      </span>
                      <span style={{ marginInlineStart: 'auto' }}>
                        {reconciled(m.account, m.period) ? (
                          can('finance.approve') ? (
                            <button className="btn btn-ghost btn-dense" data-money={`reopen:${m.account}|${m.period}`}>
                              {L('Reopen', 'إعادة فتح')}
                            </button>
                          ) : (
                            <Pill label={L('Closed', 'مقفل')} />
                          )
                        ) : can('finance.approve') ? (
                          <button
                            className="btn btn-secondary btn-dense"
                            data-money={`reconcile:${m.account}|${m.period}`}
                          >
                            {L('Close month', 'إقفال الشهر')}
                          </button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ) : null}
        </div>
      </>
    );
  }
  return (
    <>
      {head}
      <div className="stats" style={{ margin: '20px 0 24px' }}>
        <Stat
          k={L('Received', 'المقبوض')}
          v={amounts(sum('received'))}
          d={L('posted gifts, net', 'التقدمات المقيّدة، صافية')}
        />{' '}
        <Stat
          k={L('Spent so far', 'المصروف حتى الآن')}
          v={amounts(sum('paid'))}
          d={L('paid expenses', 'مصاريف مدفوعة')}
        />{' '}
        <Stat k={L('Awaiting approval', 'بانتظار الموافقة')} v={waiting.length} d={amounts(waitingTotals(waiting))} />{' '}
        <Stat k={L('Unreconciled', 'غير مطابَق')} v={unmatched.length} d={L('bank lines', 'قيود مصرفية')} />
      </div>{' '}
      <div className="tabbody">
        <Table
          cols={[
            { label: L('Fund', 'الصندوق'), sort: true },
            { label: L('Type', 'النوع'), cls: 'shrink hide-sm' },
            { label: L('Received', 'المقبوض'), cls: 'num hide-sm' },
            { label: L('Spent', 'المصروف'), cls: 'num' },
            { label: L('Balance', 'الرصيد'), cls: 'num' },
            { label: L(`Budget ${year}`, `موازنة ${year}`), cls: 'num hide-md' },
            { label: '', cls: 'shrink' }
          ]}
          rows={FUNDS.map(f => ({
            detail: f.purpose ? <p className="t-caption dim">{L(f.purpose, f.purposeAr || f.purpose)}</p> : null,
            cells: [
              <span className="row" style={{ gap: '6px' }}>
                {f.purpose ? (
                  <C.IconBtn ico="chevR" label={L('Expand', 'توسيع')} data-expand="" aria-expanded="false" />
                ) : null}
                <b>{L(f.name, f.ar)}</b>
                {f.status && f.status !== 'Active' ? <Pill label={f.status} /> : null}
              </span>,
              f.restricted ? (
                <Pill label={L('Restricted', 'مقيّد')} tone="info" mark="lock" />
              ) : (
                <span className="dim">{L('General', 'عام')}</span>
              ),
              <span className="num">{amounts(Object.fromEntries(f.balances.map(b => [b.currency, b.received])))}</span>,
              <span className="num">{amounts(Object.fromEntries(f.balances.map(b => [b.currency, b.paid])))}</span>,
              <span className="num">{amounts(Object.fromEntries(f.balances.map(b => [b.currency, b.balance])))}</span>,
              f.budgets.length ? (
                <span className="num">
                  {f.budgets.map(b => (
                    <span key={b.currency} style={{ display: 'block' }}>
                      {fmt(b.spent, b.currency)} / {fmt(b.amount, b.currency)}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="dimmer">—</span>
              ),
              can('finance.approve') ? (
                <span className="row" style={{ gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost btn-dense" data-money={`fund-edit:${f.id}`}>
                    {L('Edit names', 'تعديل الاسم')}
                  </button>
                  <button className="btn btn-secondary btn-dense" data-money={`budget:${f.id}`}>
                    {L('Budget', 'الموازنة')}
                  </button>
                </span>
              ) : (
                ''
              )
            ]
          }))}
          empty={
            <Empty
              glyph="fin"
              title={L('No funds yet', 'لا صناديق بعد')}
              body={L(
                'Create the funds gifts and expenses are recorded against.',
                'أنشئ الصناديق التي تُسجَّل عليها التقدمات والمصاريف.'
              )}
            />
          }
        />{' '}
        {can('finance.approve') ? (
          <button className="btn btn-secondary" style={{ marginTop: '16px' }} data-act="rec-new:fund">
            <Icon name="plus" size={17} />
            {L('New fund', 'صندوق جديد')}
          </button>
        ) : null}
        <p className="t-caption dim" style={{ marginTop: '12px' }}>
          {L(
            'Budget shows what was paid this year against the budget, in each currency. A fund keeps its restriction once created; its names can be corrected.',
            'تُظهر الموازنة ما دُفع هذه السنة مقابلها، بكل عملة. ويحتفظ الصندوق بتقييده بعد إنشائه؛ ويمكن تصحيح اسمه.'
          )}
        </p>
        <div style={{ marginTop: '24px' }}>
          <Panel
            title={L('Exchange rates recorded by the office', 'أسعار الصرف التي سجّلها المكتب')}
            more={
              can('finance.approve') ? (
                <button className="btn btn-secondary btn-dense" data-money="rate">
                  <Icon name="plus" size={15} />
                  {L('Record a rate', 'تسجيل سعر')}
                </button>
              ) : null
            }
          >
            {RATES.length ? (
              <Table
                cols={[
                  { label: L('Applied on', 'تاريخ السريان') },
                  { label: L('Rate', 'السعر'), cls: 'num' },
                  { label: L('Source', 'المصدر') },
                  { label: L('Recorded by', 'سجّله'), cls: 'hide-sm' }
                ]}
                rows={RATES.slice(0, 12).map(r => ({
                  cells: [
                    <span className="mono dim">{fmtDate(r.on)}</span>,
                    <span className="num">
                      1 {r.base} = {fmt(r.rate, r.quote)}
                    </span>,
                    <span className="dim">{r.source}</span>,
                    <span className="dim">{nameOf(session.parishId, r.recordedBy) || '—'}</span>
                  ]
                }))}
              />
            ) : (
              <p className="t-caption dim">{L('No rate recorded yet.', 'لم يُسجَّل سعر بعد.')}</p>
            )}
            <p className="t-caption dim" style={{ marginTop: '10px' }}>
              {L(
                'A rate is what the office read from the named source on that date. ParishLife never fetches one, never converts an amount with it and never adds currencies together.',
                'السعر هو ما قرأه المكتب من المصدر المذكور في ذلك التاريخ. لا يجلب «حياة الرعية» سعراً، ولا يحوّل به أي مبلغ، ولا يجمع العملات معاً.'
              )}
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

const waitingTotals = rows => {
  const totals = {};
  for (const x of rows) totals[x.currency] = (totals[x.currency] || 0) + x.amount;
  return totals;
};

finance.mount = host => {
  applyFinanceAccess(host);
  host.querySelectorAll('[data-money]').forEach(b =>
    b.addEventListener('click', () => {
      const [what, a, c] = b.dataset.money.split(':');
      if (what === 'exp') A.expenseDecision(c, a);
      else if (what === 'exp-edit') CR.edit('expense', a);
      else if (what === 'fund-edit') CR.edit('fund', a);
      else if (what === 'budget') A.budgetDialog(a);
      else if (what === 'rate') A.rateDialog();
      else if (what === 'bank-import') A.bankImportDialog();
      else if (what === 'bank-unmatch') A.bankUnmatchDialog(a);
      else if (what === 'reconcile' || what === 'reopen') A.reconcileDialog(...a.split('|'), what === 'reopen');
    })
  );
};
