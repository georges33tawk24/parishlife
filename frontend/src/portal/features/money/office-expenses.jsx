/* Office expenses: the monthly allowance, office purchases with receipt references, and the running
   balance in each currency, from ParishLife.Api's office ledger. USD and LBP are kept apart.
   An entry is a receipt reference (or the reason there is none); the API stores no category and no
   receipt file. A removed or reversed entry stays in the ledger's history with its reason. */
import { Select } from '../../ui/components.jsx';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { S, is, bus } from '../../model/store.js';
import { OFFICE_LEDGER, PARISH } from '../../model/data.js';
import { can } from './money-shared.jsx';
import * as A from './money-actions.jsx';
import { persist } from '../../model/persist.js';
import { PageHead, Table, Empty, Icon, Pill, openDrawer, closeOverlays, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { printSheet } from '../../shared/print.js';
import { needAll } from '../../shared/dialogs.jsx';

const L = (en, ar) => t(en, ar);

const today = () => new Date().toLocaleDateString('sv-SE');

const money = (value, currency) =>
  `${new Intl.NumberFormat(isAr() ? 'ar-LB' : 'en-US', {
    maximumFractionDigits: currency === 'LBP' ? 0 : 2,
    minimumFractionDigits: currency === 'LBP' ? 0 : 2
  }).format(value)} ${currency}`;

const typeLabel = kind =>
  kind === 'expense'
    ? L('Expense', 'مصروف')
    : kind === 'opening'
      ? L('Initial opening balance', 'الرصيد الافتتاحي الأول')
      : kind === 'reversal'
        ? L('Reversal', 'قيد عكسي')
        : L('Allowance received', 'مخصّص مستلم');

/* what the entry did to the balance, worked out by the loader from the API's entries */
const signed = row => row.effect || 0;

const monthRows = (month, currency) =>
  OFFICE_LEDGER.filter(
    row => row.currency === currency && row.status !== 'Removed' && row.date.slice(0, 7) === month
  ).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

function totals(month, currency) {
  const rows = monthRows(month, currency),
    before = OFFICE_LEDGER.filter(row => row.currency === currency && row.date.slice(0, 7) < month);
  const opening = before.reduce((sum, row) => sum + signed(row), 0);
  const received = rows.reduce((sum, row) => sum + Math.max(signed(row), 0), 0);
  const spent = rows.reduce((sum, row) => sum - Math.min(signed(row), 0), 0);
  return { opening, received, spent, balance: opening + received - spent };
}

export function officeExpenses() {
  if (!is('secretary', 'priest', 'treasurer') && !can('finance.read'))
    return <Empty glyph="shield" title={L('Office access required', 'صلاحية المكتب مطلوبة')} body="" />;
  const month = S.ui.officeMonth || today().slice(0, 7),
    currency = S.ui.officeCurrency || 'USD',
    filter = S.ui.officeKind || 'all',
    query = (S.ui.officeQuery || '').toLocaleLowerCase();
  const summary = totals(month, currency),
    rows = monthRows(month, currency).filter(
      row =>
        (filter === 'all' || row.kind === filter) &&
        `${row.description} ${row.payee} ${row.reference} ${row.category}`.toLocaleLowerCase().includes(query)
    );
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Office', 'المكتب') }, { label: L('Office Expenses', 'مصاريف المكتب') }]}
        title={L('Office Expenses', 'مصاريف المكتب')}
        sub={L(
          'Record the monthly allowance and office purchases, with receipts and a running balance.',
          'سجّل المخصّص الشهري ومشتريات المكتب مع الإيصالات والرصيد المتبقّي.'
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-office-new="allowance">
              <Icon name="plus" size={16} />
              {L('Add allowance', 'إضافة مخصّص')}
            </button>
            <button className="btn btn-primary" data-office-new="expense">
              <Icon name="plus" size={16} />
              {L('Add expense', 'إضافة مصروف')}
            </button>
          </>
        }
      />
      <div className="office-toolbar">
        <div className="formrow">
          <label className="label" htmlFor="office-month">
            {L('Month', 'الشهر')}
          </label>
          <input className="input" id="office-month" type="month" defaultValue={month} />
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="office-currency">
            {L('Currency', 'العملة')}
          </label>
          <Select defaultValue={currency} id="office-currency">
            <option>USD</option>
            <option>LBP</option>
          </Select>
        </div>{' '}
        <button className="btn btn-secondary" data-office-print-month="">
          <Icon name="print" size={16} />
          {L('Print monthly summary', 'طباعة ملخّص الشهر')}
        </button>{' '}
        {can('finance.approve') ? (
          <>
            <button className="btn btn-ghost" data-office-new="opening">
              {L('Initial opening balance', 'الرصيد الافتتاحي الأول')}
            </button>
            <button className="btn btn-ghost" data-office-close="">
              {L('Close this month', 'إقفال هذا الشهر')}
            </button>
          </>
        ) : null}
      </div>{' '}
      <div className="office-summary">
        {[
          ['opening', 'Opening balance', 'الرصيد الافتتاحي'],
          ['received', 'Allowance received', 'المخصّص المستلم'],
          ['spent', 'Office expenses', 'مصاريف المكتب'],
          ['balance', 'Remaining balance', 'الرصيد المتبقّي']
        ].map(([key, en, ar], i) => (
          <div key={i} className="stat">
            <span className="k">{L(en, ar)}</span>
            <strong className="v" dir="ltr">
              {money(summary[key], currency)}
            </strong>
          </div>
        ))}
      </div>{' '}
      <p className="help">
        {L(
          'Previous balances carry forward automatically. USD and LBP are tracked separately. Record an initial balance only once per currency; the ledger shows it inside the opening balance, not as a row.',
          'تُنقل الأرصدة السابقة تلقائياً. يُتابع الدولار والليرة بشكل منفصل. سجّل الرصيد الأول مرة واحدة لكل عملة؛ ويظهر ضمن الرصيد الافتتاحي لا كسطر.'
        )}
      </p>{' '}
      <div className="office-toolbar">
        <input
          className="input"
          id="office-search"
          type="search"
          defaultValue={S.ui.officeQuery || ''}
          placeholder={L('Description, supplier or reference', 'الوصف أو المورّد أو المرجع')}
          aria-label={L('Search transactions', 'البحث في العمليات')}
        />{' '}
        <Select defaultValue={filter} id="office-kind" aria-label={L('Transaction type', 'نوع العملية')}>
          {[
            ['all', 'All transactions', 'كل العمليات'],
            ['expense', 'Expenses', 'المصاريف'],
            ['allowance', 'Allowances', 'المخصّصات'],
            ['opening', 'Opening balance', 'الرصيد الافتتاحي']
          ].map(([key, en, ar], i) => (
            <option key={i} value={key}>
              {L(en, ar)}
            </option>
          ))}
        </Select>
        <span className="dim">
          {rows.length} {L('transactions', 'عمليات')}
        </span>
      </div>{' '}
      <div className="office-ledger">
        <Table
          cols={[
            { label: L('Date', 'التاريخ') },
            { label: L('Type', 'النوع') },
            { label: L('Description', 'الوصف') },
            { label: L('Supplier / reference', 'المورّد / المرجع') },
            { label: L('Amount', 'المبلغ'), cls: 'num' },
            { label: L('Actions', 'الإجراءات') }
          ]}
          rows={rows.map(row => ({
            cells: [
              <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(row.date)}</span>,
              <Pill label={typeLabel(row.kind)} tone={row.kind === 'expense' ? 'warning' : 'info'} />,
              <>
                <b>{row.description}</b>
                <small>{row.monthClosed ? L('Month closed', 'الشهر مقفل') : ''}</small>
              </>,
              <>
                <b>{row.payee || '—'}</b>
                <small>{row.reference || ''}</small>
              </>,
              money(row.amount, row.currency),
              <span className="rowacts">
                <button className="btn btn-secondary btn-dense" data-office-view={row.id}>
                  {L('View', 'عرض')}
                </button>
                {!row.monthClosed && row.kind !== 'reversal' && can('finance.enter') ? (
                  <button className="btn btn-secondary btn-dense" data-office-edit={row.id}>
                    {L('Edit', 'تعديل')}
                  </button>
                ) : null}
                <button className="btn btn-ghost btn-dense" data-office-print={row.id}>
                  {L('Print', 'طباعة')}
                </button>
                {row.kind !== 'reversal' && can('finance.enter') ? (
                  <button className="btn btn-danger-quiet btn-dense" data-office-delete={row.id}>
                    {row.monthClosed ? L('Reverse', 'عكس') : L('Remove', 'إزالة')}
                  </button>
                ) : null}
              </span>
            ]
          }))}
          empty={
            <Empty
              glyph="fin"
              title={L('No transactions match', 'لا عمليات مطابقة')}
              body={L(
                'Add an allowance or record your first office purchase.',
                'أضف مخصّصاً أو سجّل أول مشتريات المكتب.'
              )}
            />
          }
        />
      </div>
    </>
  );
}

function entryForm(record = null, kind = 'expense') {
  kind = record?.kind || kind;
  const currency = record?.currency || S.ui.officeCurrency || 'USD';
  const date =
    record?.date || (S.ui.officeMonth && S.ui.officeMonth !== today().slice(0, 7) ? S.ui.officeMonth + '-01' : today());
  const label = {
    expense: [
      L('Supplier / payee', 'المورّد / المستفيد'),
      L('Receipt / invoice reference', 'رقم الإيصال / الفاتورة'),
      L('Reason there is no receipt (when no reference)', 'سبب غياب الإيصال (عند عدم وجود مرجع)')
    ],
    allowance: [
      L('Received from', 'مستلم من'),
      L('Finance record of the transfer', 'السجل المالي للتحويل'),
      L('Notes (optional)', 'ملاحظات (اختياري)')
    ],
    opening: [
      L('Held by', 'محفوظ لدى'),
      L('Reference (optional)', 'مرجع (اختياري)'),
      L('Where this balance comes from', 'مصدر هذا الرصيد')
    ]
  }[kind];
  openDrawer({
    title: record ? L('Edit transaction', 'تعديل العملية') : typeLabel(kind),
    body: (
      <form id="office-entry-form">
        <div className="formgrid">
          <C.Field label={L('Date', 'التاريخ')} id="oe-date" type="date" value={date} req={true} />{' '}
          <div className="formrow">
            <label className="label" htmlFor="oe-currency">
              {L('Currency', 'العملة')}
            </label>
            <Select defaultValue={currency} id="oe-currency">
              <option>USD</option>
              <option>LBP</option>
            </Select>
          </div>
        </div>{' '}
        <C.Field label={L('Amount', 'المبلغ')} id="oe-amount" type="number" value={record?.amount ?? ''} req={true} />{' '}
        {kind !== 'opening' ? (
          <C.Field
            label={L('Description', 'الوصف')}
            id="oe-description"
            value={record?.description || ''}
            req={true}
            max={300}
          />
        ) : null}{' '}
        {kind === 'expense' ? (
          <C.Field label={label[0]} id="oe-payee" value={record?.payee || ''} req={true} max={200} />
        ) : null}{' '}
        {kind !== 'opening' ? (
          <C.Field
            label={label[1]}
            id="oe-reference"
            value={record?.reference || ''}
            req={kind === 'allowance'}
            max={300}
          />
        ) : null}{' '}
        {kind !== 'allowance' ? (
          <div className="formrow">
            <label className="label" htmlFor="oe-notes">
              {label[2]}
            </label>
            <textarea className="textarea" id="oe-notes" maxLength="500" defaultValue={record?.notes || ''} />
          </div>
        ) : null}{' '}
        {kind === 'opening' ? (
          <p className="help">
            {L(
              'Use the balance held before your first transaction. It can be recorded once per currency; future months carry it forward.',
              'استعمل الرصيد المتوفّر قبل أول عملية. يُسجَّل مرة واحدة لكل عملة؛ وتنقله الأشهر المقبلة.'
            )}
          </p>
        ) : (
          <p className="help">
            {L(
              'Receipts are kept as a reference to the document. The ledger stores no category and no receipt file.',
              'تُحفظ الإيصالات كمرجع للمستند. ولا يحفظ الدفتر فئة ولا ملف إيصال.'
            )}
          </p>
        )}
      </form>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="oe-save">
          {L('Save transaction', 'حفظ العملية')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('form').addEventListener('submit', e => e.preventDefault());
      el.querySelector('#oe-amount').min = '0.01';
      el.querySelector('#oe-amount').step = 'any';
      el.querySelector('#oe-save').addEventListener('click', async e => {
        const value = id => el.querySelector('#oe-' + id)?.value.trim() || '';
        const needs =
          kind === 'opening'
            ? [['#oe-notes', L('Say where this balance comes from', 'اذكر مصدر هذا الرصيد')]]
            : kind === 'allowance'
              ? [['#oe-reference', L('Give the finance record of the transfer', 'أدخل السجل المالي للتحويل')]]
              : [['#oe-payee', L('Enter the supplier', 'أدخل المورّد')]];
        if (
          !needAll(el, [
            ['#oe-date', L('Enter the date', 'أدخل التاريخ')],
            ['#oe-amount', L('Enter an amount above zero', 'أدخل مبلغاً أكبر من صفر'), v => Number(v) > 0],
            ...(kind === 'opening' ? [] : [['#oe-description', L('Describe the transaction', 'صِف العملية')]]),
            ...needs
          ])
        )
          return;
        if (kind === 'expense' && !value('reference') && !value('notes'))
          return toast(
            L('Give the receipt reference, or the reason there is none', 'أدخل مرجع الإيصال أو سبب غيابه'),
            '',
            'warning'
          );
        const amount = Number(value('amount')),
          date = value('date'),
          currency = value('currency');
        e.currentTarget.disabled = true;
        const entry = {
          id: record?.id || 'office-' + crypto.randomUUID(),
          kind,
          date,
          currency,
          amount,
          description: value('description'),
          category: '',
          payee: value('payee'),
          reference: value('reference'),
          notes: value('notes')
        };
        if (record) Object.assign(record, entry);
        else OFFICE_LEDGER.push(entry);
        if (!(await persist())) {
          el.querySelector('#oe-save').disabled = false;
          return;
        }
        S.ui.officeMonth = date.slice(0, 7);
        S.ui.officeCurrency = currency;
        closeOverlays();
        bus.refresh();
        toast(L('Transaction saved', 'حُفظت العملية'), '', 'success');
      });
    }
  });
}

function viewEntry(row) {
  openDrawer({
    title: typeLabel(row.kind),
    sub: row.description,
    body: (
      <dl className="dl">
        <dt>{L('Date', 'التاريخ')}</dt>
        <dd>{fmtDate(row.date)}</dd>
        <dt>{L('Amount', 'المبلغ')}</dt>
        <dd>{money(row.amount, row.currency)}</dd>
        <dt>{L('Supplier / source', 'المورّد / المصدر')}</dt>
        <dd>{row.payee || '—'}</dd>
        <dt>{L('Reference', 'المرجع')}</dt>
        <dd>{row.reference || '—'}</dd>
        <dt>{L('Notes', 'الملاحظات')}</dt>
        <dd>{row.notes || '—'}</dd>
        <dt>{L('Month', 'الشهر')}</dt>
        <dd>{row.monthClosed ? L('Closed', 'مقفل') : L('Open', 'مفتوح')}</dd>
      </dl>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>
        <button className="btn btn-secondary" id="oe-view-print">
          {L('Print voucher', 'طباعة السند')}
        </button>
        {!row.monthClosed && row.kind !== 'reversal' && can('finance.enter') ? (
          <button className="btn btn-primary" id="oe-view-edit">
            {L('Edit', 'تعديل')}
          </button>
        ) : null}
      </>
    ),
    onMount(el) {
      const edit = el.querySelector('#oe-view-edit');
      if (edit) edit.onclick = () => entryForm(row);
      el.querySelector('#oe-view-print').onclick = () => printEntry(row);
    }
  });
}

const printCSS =
  'body{color:#3D4161}h1{font-size:22px}h2{font-size:17px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:start;border-bottom:1px solid #AACDE8;padding:9px;vertical-align:top}th{background:#FFF5C9;color:#735039}dl{display:grid;grid-template-columns:150px 1fr;gap:12px}dt{font-weight:600}dd{margin:0}small{display:block}footer{margin-top:35px;border-top:1px solid #AACDE8;padding-top:12px}tr{break-inside:avoid}';

function printEntry(row) {
  printSheet({
    title: L('Office transaction voucher', 'سند عملية مكتبية'),
    css: printCSS,
    body: (
      <>
        <h1>{L(PARISH.name, PARISH.nameAr)}</h1>
        <h2>
          {L('Office transaction voucher', 'سند عملية مكتبية')} · {typeLabel(row.kind)}
        </h2>
        <p>
          {L(
            'Internal record — supplier receipts are attached separately.',
            'سند داخلي — تُرفق إيصالات المورّد بشكل منفصل.'
          )}
        </p>
        <dl>
          <dt>{L('Voucher ID', 'رقم السند')}</dt>
          <dd>{row.id}</dd>
          <dt>{L('Date', 'التاريخ')}</dt>
          <dd>{fmtDate(row.date)}</dd>
          <dt>{L('Description', 'الوصف')}</dt>
          <dd>{row.description}</dd>
          <dt>{L('Amount', 'المبلغ')}</dt>
          <dd>{money(row.amount, row.currency)}</dd>
          <dt>{L('Supplier / source', 'المورّد / المصدر')}</dt>
          <dd>{row.payee || '—'}</dd>
          <dt>{L('Reference', 'المرجع')}</dt>
          <dd>{row.reference || '—'}</dd>
          <dt>{L('Notes', 'الملاحظات')}</dt>
          <dd>{row.notes || '—'}</dd>
        </dl>
        <footer>{L('Recorded by / signature', 'المسجّل / التوقيع')}: ____________________</footer>
      </>
    )
  });
}

function printMonth() {
  const month = S.ui.officeMonth || today().slice(0, 7),
    currency = S.ui.officeCurrency || 'USD',
    s = totals(month, currency),
    rows = monthRows(month, currency).reverse();
  printSheet({
    title: L('Monthly office expenses', 'مصاريف المكتب الشهرية') + ' ' + month,
    css: printCSS,
    body: (
      <>
        <h1>{L(PARISH.name, PARISH.nameAr)}</h1>
        <h2>
          {L('Office account', 'حساب المكتب')} · {month} · {currency}
        </h2>
        <p>
          {L('Opening', 'افتتاحي')}: {money(s.opening, currency)} · {L('Received', 'مستلم')}:{' '}
          {money(s.received, currency)} · {L('Expenses', 'مصاريف')}: {money(s.spent, currency)}
        </p>
        <h3>
          {L('Remaining balance', 'الرصيد المتبقّي')}: {money(s.balance, currency)}
        </h3>
        <table>
          <thead>
            <tr>
              {[
                'Date|التاريخ',
                'Type|النوع',
                'Description|الوصف',
                'Supplier / reference|المورّد / المرجع',
                'Amount|المبلغ'
              ].map((x, i) => (
                <th key={i}>{L(...x.split('|'))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{fmtDate(row.date)}</td>
                <td>{typeLabel(row.kind)}</td>
                <td>{row.description}</td>
                <td>
                  {row.payee || '—'}
                  <small>{row.reference || ''}</small>
                </td>
                <td>{money(row.amount, row.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer>
          {L(
            'Balances carry forward automatically. This summary includes all transactions for the selected month and currency.',
            'تُنقل الأرصدة تلقائياً. يشمل الملخّص كل العمليات للشهر والعملة المحدّدين.'
          )}
        </footer>
      </>
    )
  });
}

officeExpenses.mount = host => {
  [
    ['office-month', 'officeMonth'],
    ['office-currency', 'officeCurrency'],
    ['office-kind', 'officeKind']
  ].forEach(([id, key]) =>
    host.querySelector('#' + id)?.addEventListener('change', e => {
      if (!e.target.value) return;
      S.ui[key] = e.target.value;
      bus.refresh();
    })
  );
  host.querySelector('#office-search')?.addEventListener('input', e => {
    const pos = e.target.selectionStart;
    S.ui.officeQuery = e.target.value;
    bus.refresh();
    const replacement = document.querySelector('#office-search');
    replacement?.focus();
    replacement?.setSelectionRange(pos, pos);
  });
  host.querySelectorAll('[data-office-new]').forEach(b => (b.onclick = () => entryForm(null, b.dataset.officeNew)));
  [
    ['view', viewEntry],
    ['edit', entryForm],
    ['delete', A.officeDeleteDialog],
    ['print', printEntry]
  ].forEach(([action, fn]) =>
    host.querySelectorAll(`[data-office-${action}]`).forEach(
      b =>
        (b.onclick = () => {
          const row = OFFICE_LEDGER.find(x => x.id === b.dataset['office' + action[0].toUpperCase() + action.slice(1)]);
          if (row) fn(row);
        })
    )
  );
  host.querySelector('[data-office-print-month]')?.addEventListener('click', printMonth);
  host
    .querySelector('[data-office-close]')
    ?.addEventListener('click', () => A.officeCloseMonth(S.ui.officeMonth || today().slice(0, 7)));
};
