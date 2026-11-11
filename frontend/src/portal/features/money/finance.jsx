/* Finance: funds against budget, expenses and bank reconciliation. */
import { css } from '../../ui/html.js';
import { t, isAr, num, usd, fmtDate } from '../../../lib/i18n.js';
import { is } from '../../model/store.js';
import { Icon, PageHead, Panel, Status, Pill, Table, Empty, Stat, TabBar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { FUNDS, EXPENSES, RATE, BANKLINES, person } from '../../model/data.js';
import { applyFinanceAccess, fundName } from './money-shared.jsx';

const L = (en, ar) => t(en, ar);

/* ---------------- finance ---------------- */
const FTABS = () => [
  ['', 'Funds & budget', 'الصناديق والموازنة'],
  ['expenses', 'Expenses', 'المصاريف'],
  ['reconciliation', 'Reconciliation', 'المطابقة', BANKLINES.filter(b => !b.matched).length]
];

export function finance(tab = '') {
  const totalBudget = FUNDS.reduce((a, f) => a + f.budget, 0);
  const totalActual = FUNDS.reduce((a, f) => a + f.actual, 0);
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Money', 'المال') }, { label: L('Finance', 'المالية') }]}
        title={L('Funds, budget and expenses', 'الصناديق والموازنة والمصاريف')}
        sub={L(
          'Restricted funds stay restricted. Every line carries the currency it was paid in and the rate, if one was applied.',
          'الصناديق المقيّدة تبقى مقيّدة. وكل بند يحمل عملة الدفع والسعر إن استُعمل.'
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-act="export">
              <Icon name="export" size={17} />
              {L('Export to Excel', 'تصدير إلى Excel')}
            </button>{' '}
            <button className="btn btn-primary" data-act="exp-add">
              <Icon name="plus" size={17} />
              {L('Record expense', 'تسجيل مصروف')}
            </button>
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
              { label: 'USD', cls: 'num', sort: true },
              { label: 'L.L', cls: 'num hide-sm' },
              { label: L('Status', 'الحالة'), cls: 'shrink' },
              { label: '', cls: 'shrink' }
            ]}
            rows={EXPENSES.map(x => ({
              detail: (
                <div className="grid g3" style={{ gap: '20px' }}>
                  <dl className="dl">
                    <dt>{L('Submitted by', 'قدّمه')}</dt>
                    <dd>{person(x.by) ? (isAr() ? person(x.by).ar : person(x.by).lat) : '—'}</dd>
                    <dt>{L('Approval limit', 'حدّ الموافقة')}</dt>
                    <dd>{x.usd > 1000 ? L('Priest', 'الكاهن') : L('Treasurer', 'أمين الصندوق')}</dd>
                  </dl>{' '}
                  <dl className="dl">
                    <dt>{L('Receipt', 'الإيصال')}</dt>
                    <dd>{L('Attached', 'مرفق')}</dd>
                    <dt>{L('Reimbursement', 'استرداد')}</dt>
                    <dd>{L('Not requested', 'غير مطلوب')}</dd>
                  </dl>{' '}
                  <div>
                    <button className="btn btn-secondary btn-dense" data-act={`doc:receipt-${x.id}.pdf`}>
                      <Icon name="doc" size={15} />
                      {L('View receipt', 'عرض الإيصال')}
                    </button>
                  </div>
                </div>
              ),
              cells: [
                <span className="mono dim">{fmtDate(x.d)}</span>,
                <span className="row" style={{ gap: '6px' }}>
                  <C.IconBtn ico="chevR" label={L('Expand', 'توسيع')} data-expand="" aria-expanded="false" />{' '}
                  <b style={{ font: '500 14px/20px var(--sans)' }}>{L(x.what, x.whatAr)}</b>
                </span>,
                <span className="dim">{fundName(x.fund)}</span>,
                <span className="num">{usd(x.usd)}</span>,
                <span className="num dim">{num(x.usd * RATE.value)}</span>,
                <Status k={x.status} />,
                <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
                  {x.status === 'awaiting-approval' &&
                  is('priest', 'treasurer', 'super_admin', 'bishop', 'diocesan_admin', 'parish_admin') ? (
                    <button className="btn btn-primary btn-dense" data-act={`exp-approve:${x.id}`}>
                      {L('Approve', 'موافقة')}
                    </button>
                  ) : (
                    ''
                  )}
                  {CR.recBtn('expense', x.id)}
                </span>
              ]
            }))}
            empty={
              <Empty
                glyph="fin"
                title={L('No expenses recorded', 'لا مصاريف مسجّلة')}
                body={L('Record the first one — a receipt photo is enough.', 'سجّل الأول — تكفي صورة الإيصال.')}
                action={
                  <button className="btn btn-primary btn-dense" data-act="exp-add">
                    {L('Record expense', 'تسجيل مصروف')}
                  </button>
                }
              />
            }
          />
        </div>
      </>
    );
  if (tab === 'reconciliation')
    return (
      <>
        {head}
        <div className="tabbody">
          {(n =>
            n ? (
              <C.InlineAlert
                tone="warning"
                title={L(`${n} bank line${n === 1 ? ' is' : 's are'} not matched yet`, `${n} قيود مصرفية غير مطابَقة`)}
                body={L(
                  'Match each line to a counting session, an expense or a fee. Nothing is written until you confirm.',
                  'طابق كل قيد بجلسة عدّ أو مصروف أو رسم. ولا يُكتب شيء قبل تأكيدك.'
                )}
              />
            ) : (
              <C.InlineAlert
                tone="success"
                title={L('Every bank line is matched', 'كل القيود المصرفية مطابَقة')}
                body={L('The books agree with the bank.', 'الدفاتر متطابقة مع المصرف.')}
              />
            ))(BANKLINES.filter(b => !b.matched).length)}{' '}
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
                  <span className="mono">{b.ref}</span>,
                  <span className="num" style={css(b.amount < 0 ? 'color:var(--danger-ink)' : '')}>
                    {usd(Math.abs(b.amount))}
                    {b.amount < 0 ? ' −' : ''}
                  </span>,
                  b.matched ? (
                    <Pill
                      label={b.matched === 'fee' ? L('Bank fee', 'رسم مصرفي') : L('Session 213', 'الجلسة ٢١٣')}
                      tone="success"
                    />
                  ) : (
                    <span className="dimmer">—</span>
                  ),
                  b.matched ? (
                    ''
                  ) : (
                    <button className="btn btn-secondary btn-dense" data-act={`bank-match:${b.id}`}>
                      {L('Match', 'مطابقة')}
                    </button>
                  )
                ]
              }))}
            />
          </div>{' '}
          <div className="grid g2" style={{ marginTop: '24px' }}>
            <Panel title={L('Handled consistently', 'تُعالَج باتّساق')}>
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
                {[
                  L('Deposits and bank fees', 'الإيداعات والرسوم المصرفية'),
                  L('Refunds and failed payments', 'الاسترجاعات والدفعات الفاشلة'),
                  L('Duplicate payment notifications', 'إشعارات الدفع المكرَّر'),
                  L('A full audit history on every change', 'سجل تدقيق كامل لكل تغيير')
                ].map((x, i) => (
                  <li key={i} className="row" style={{ gap: '10px' }}>
                    <Icon name="check" size={16} cls="dimmer" />
                    <span className="t-caption">{x}</span>
                  </li>
                ))}
              </ul>
            </Panel>{' '}
            <Panel title={L('Out of scope, on purpose', 'خارج النطاق، عن قصد')}>
              <p className="t-body dim" style={{ fontSize: '14px', lineHeight: '22px' }}>
                {L(
                  'ParishLife records giving and basic expenses. Full ledger, payroll and tax functionality belong in accounting software; an integration comes after the parish workflows are reliable.',
                  'يسجّل «حياة الرعية» التقدمات والمصاريف الأساسية. أمّا الدفتر الكامل والرواتب والضرائب فمكانها برامج المحاسبة؛ والتكامل بعد أن تستقرّ مسارات الرعية.'
                )}
              </p>
            </Panel>
          </div>
        </div>
      </>
    );
  return (
    <>
      {head}
      <div className="stats" style={{ margin: '20px 0 24px' }}>
        <Stat
          k={L('Budgeted this year', 'موازنة السنة')}
          v={usd(totalBudget)}
          d={`L.L ${num(totalBudget * RATE.value)}`}
        />{' '}
        <Stat
          k={L('Spent so far', 'المصروف حتى الآن')}
          v={usd(totalActual)}
          d={`${totalBudget ? Math.round((totalActual / totalBudget) * 100) : 0}% ${L('of budget', 'من الموازنة')}`}
        />{' '}
        <Stat
          k={L('Awaiting approval', 'بانتظار الموافقة')}
          v={EXPENSES.filter(x => x.status === 'awaiting-approval').length}
          d={usd(EXPENSES.filter(x => x.status === 'awaiting-approval').reduce((a, x) => a + x.usd, 0))}
        />{' '}
        <Stat
          k={L('Unreconciled', 'غير مطابَق')}
          v={BANKLINES.filter(b => !b.matched).length}
          d={L('bank lines', 'قيود مصرفية')}
        />
      </div>{' '}
      <Panel title={L('Budget against actual, by fund', 'الموازنة مقابل الفعلي، حسب الصندوق')}>
        <C.BarChart rows={FUNDS.map(f => ({ label: L(f.name, f.ar), v: f.actual, max: f.budget }))} />
      </Panel>{' '}
      <div className="tabbody">
        <Table
          cols={[
            { label: L('Fund', 'الصندوق'), sort: true },
            { label: L('Type', 'النوع'), cls: 'shrink hide-sm' },
            { label: L('Budget', 'الموازنة'), cls: 'num hide-sm' },
            { label: L('Actual', 'الفعلي'), cls: 'num', sort: true },
            { label: L('Remaining', 'المتبقّي'), cls: 'num' },
            { label: '', cls: 'shrink' }
          ]}
          rows={FUNDS.map(f => ({
            cells: [
              <b>{L(f.name, f.ar)}</b>,
              f.restricted ? (
                <Pill label={L('Restricted', 'مقيّد')} tone="info" mark="lock" />
              ) : (
                <span className="dim">{L('General', 'عام')}</span>
              ),
              <span className="num">{usd(f.budget)}</span>,
              <span className="num">{usd(f.actual)}</span>,
              <span className="num" style={css(f.budget - f.actual < 0 ? 'color:var(--danger-ink)' : undefined)}>
                {usd(f.budget - f.actual)}
              </span>,
              CR.recBtn('fund', f.id)
            ]
          }))}
        />{' '}
        <button className="btn btn-secondary" style={{ marginTop: '16px' }} data-act="rec-new:fund">
          <Icon name="plus" size={17} />
          {L('New fund', 'صندوق جديد')}
        </button>
      </div>
    </>
  );
}

finance.mount = host => {
  applyFinanceAccess(host);
};
