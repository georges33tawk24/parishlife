/* Giving: the counting session (numbered envelopes, unattributed cash, the second count, closing),
   posted contributions, pledges, campaigns, recurring gifts (stored schedules, never charged) and
   numbered receipts. Amounts are shown in the currency they were counted in and never converted. */
import { Select } from '../../ui/components.jsx';
import { css } from '../../ui/html.js';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { Icon, PageHead, Panel, Who, Pill, Table, Empty, openDrawer, TabBar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { bus } from '../../model/store.js';
import {
  BATCH,
  FUNDS,
  PLEDGES,
  CAMPAIGNS,
  RECURRING,
  RECEIPTS,
  CONTRIBUTIONS,
  GIVING_SERIES,
  PAYMENT_MIX,
  HOUSEHOLDS,
  COUNT_SESSIONS,
  person
} from '../../model/data.js';
import { applyFinanceAccess, fundName, fmt, amounts, byCurrency, can, State } from './money-shared.jsx';
import { nameOf } from '../../model/names.js';
import { session } from '../../model/api.js';
import * as A from './money-actions.jsx';

const L = (en, ar) => t(en, ar);
const sessionOpen = () => ['Open', 'Variance'].includes(BATCH.apiStatus);
const monthOf = d => (d || '').slice(0, 7);

const GTABS = () => [
  ['', 'Counting session', 'جلسة العدّ'],
  ['contributions', 'Contributions', 'المساهمات'],
  ['pledges', 'Pledges', 'التعهّدات', PLEDGES.length],
  ['recurring', 'Recurring', 'الدائمة', RECURRING.filter(r => r.status === 'Active').length],
  ['campaigns', 'Campaigns', 'الحملات', CAMPAIGNS.length],
  ['receipts', 'Receipts & statements', 'الإيصالات والكشوفات']
];

const giverName = l => {
  if (l.anonymous) return <span className="dim">{L('Anonymous', 'مجهول')}</span>;
  if (l.p && person(l.p)) return <Who p={person(l.p)} />;
  const household = l.hh && HOUSEHOLDS.find(h => h.id === l.hh);
  if (household) return <span>{L(household.name, household.ar)}</span>;
  if (l.env)
    return (
      <span className="dim">
        {l.unattributed
          ? L('Envelope not assigned to a household', 'مظروف غير مسند لعائلة')
          : L('Household envelope', 'مظروف عائلة')}
      </span>
    );
  return <span className="dim">{l.ref || L('Unattributed cash', 'نقد غير مسمّى')}</span>;
};

/* The receipt issued for a posted gift (a gift has at most one). */
const receiptOf = id => RECEIPTS.find(r => r.contribution === id);

export function giving(tab = '') {
  const open = sessionOpen();
  const totals = byCurrency(BATCH.lines);
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Money', 'المال') }, { label: L('Giving', 'التقدمات') }]}
        title={tab ? L('Giving', 'التقدمات') : BATCH.id ? BATCH.ref : L('Counting session', 'جلسة العدّ')}
        sub={
          tab ? (
            L(
              'Funds, campaigns, pledges and donor history — donor details stay restricted.',
              'الصناديق والحملات والتعهّدات وتاريخ المتبرّعين — وتبقى تفاصيل المتبرّعين مقيّدة.'
            )
          ) : BATCH.id ? (
            <>
              {fmtDate(BATCH.date)}
              {' · '}
              {BATCH.source}
              {' · '}
              <State k={BATCH.status} />
            </>
          ) : (
            L('No counting session is open.', 'لا جلسة عدّ مفتوحة.')
          )
        }
        actions={
          <>
            {BATCH.id ? (
              <button className="btn btn-secondary" data-act="print">
                <Icon name="print" size={17} />
                {L('Print sheet', 'طباعة الورقة')}
              </button>
            ) : null}{' '}
            {!tab && BATCH.id && COUNT_SESSIONS.length > 1 ? (
              <button className="btn btn-secondary" data-money="session-view">
                {L('Other sessions', 'جلسات أخرى')}
              </button>
            ) : null}{' '}
            {!tab && (!BATCH.id || BATCH.apiStatus === 'Posted') && can('finance.enter') ? (
              <button className="btn btn-primary" data-money="session-open">
                <Icon name="plus" size={17} />
                {L('Open a session', 'فتح جلسة')}
              </button>
            ) : null}
            {!tab && open && can('finance.enter') ? (
              <button className="btn btn-secondary" id="addenv">
                <Icon name="plus" size={17} />
                {L('Add envelope', 'إضافة مظروف')}
              </button>
            ) : null}{' '}
            {!tab && BATCH.apiStatus === 'Verified' && can('finance.post') ? (
              <button className="btn btn-primary" id="close" data-money="session-close">
                <Icon name="check" size={17} />
                {L('Close session', 'إقفال الجلسة')}
              </button>
            ) : null}
          </>
        }
      />
      <TabBar base="giving" items={GTABS()} active={tab} />
    </>
  );

  if (tab === 'contributions') {
    const month = new Date().toISOString().slice(0, 7);
    const thisMonth = CONTRIBUTIONS.filter(c => monthOf(c.date) === month);
    const given = byCurrency(thisMonth);
    const { USD: dollars = 0, ...others } = given;
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="grid g2" style={{ marginBottom: '20px' }}>
            <C.Kpi
              k={L('Given this month', 'المعطى هذا الشهر')}
              v={fmt(dollars, 'USD')}
              sub={Object.keys(others).length ? amounts(others) : ''}
              spark={GIVING_SERIES.some(v => v > 0) ? GIVING_SERIES : null}
            />{' '}
            <Panel title={L('How people give (dollars)', 'كيف يُعطي الناس (بالدولار)')}>
              {PAYMENT_MIX.length ? (
                <C.Donut segments={PAYMENT_MIX.map(p => ({ ...p, label: isAr() ? p.labelAr : p.label }))} />
              ) : (
                <p className="t-caption dim">{L('No dollar gifts posted yet.', 'لا تقدمات بالدولار مقيّدة بعد.')}</p>
              )}
            </Panel>
          </div>{' '}
          <Table
            cols={[
              { label: L('Date', 'التاريخ'), sort: true },
              { label: L('Giver', 'المتبرّع') },
              { label: L('Fund', 'الصندوق'), cls: 'hide-sm' },
              { label: L('Method', 'الطريقة'), cls: 'hide-md' },
              { label: L('Amount', 'المبلغ'), cls: 'num' },
              { label: '', cls: 'shrink' }
            ]}
            rows={CONTRIBUTIONS.map(c => ({
              cells: [
                <span className="mono dim">{fmtDate(c.date)}</span>,
                giverName(c),
                <span className="dim">{fundName(c.fund)}</span>,
                <span className="chip">{c.method}</span>,
                <span className="num">
                  {fmt(c.amount, c.currency)}
                  {c.status === 'Reversed'
                    ? ` · ${L('reversed', 'معكوسة')}`
                    : c.status === 'Reversal'
                      ? ` · ${L('reversal', 'قيد عكسي')}`
                      : ''}
                </span>,
                <span className="row" style={{ gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {receiptOf(c.id) ? (
                    <span className="chip mono">
                      {L('No.', 'رقم')} {receiptOf(c.id).no}
                    </span>
                  ) : c.status === 'Posted' && !c.anonymous && (c.p || c.hh) && can('finance.post') ? (
                    <button className="btn btn-secondary btn-dense" data-money={`receipt-issue:${c.id}`}>
                      {L('Receipt', 'إيصال')}
                    </button>
                  ) : null}
                  {c.status === 'Posted' && can('finance.approve') ? (
                    <button className="btn btn-secondary btn-dense" data-money={`gift-correct:${c.id}`}>
                      {L('Correct', 'تصحيح')}
                    </button>
                  ) : null}
                </span>
              ]
            }))}
            empty={
              <Empty
                glyph="give"
                title={L('No gifts posted yet', 'لا تقدمات مقيّدة بعد')}
                body={L(
                  'Gifts appear here once a counting session is verified and closed.',
                  'تظهر التقدمات هنا بعد التحقق من جلسة العدّ وإقفالها.'
                )}
              />
            }
          />
        </div>
      </>
    );
  }
  if (tab === 'pledges')
    return (
      <>
        {head}
        <div className="tabbody">
          <Table
            cols={[
              { label: L('Donor', 'المتبرّع') },
              { label: L('Fund', 'الصندوق'), cls: 'hide-sm' },
              { label: L('Pledged', 'تعهّد'), cls: 'num' },
              { label: L('Counted so far', 'المحتسب'), cls: 'num' },
              { label: L('Progress', 'التقدّم') },
              { label: '', cls: 'shrink' }
            ]}
            rows={PLEDGES.map(p => {
              const pct = p.pledged ? Math.min(100, Math.round((p.paid / p.pledged) * 100)) : 0;
              return {
                cells: [
                  giverName(p),
                  <span className="dim">{fundName(p.fund)}</span>,
                  <span className="num">{fmt(p.pledged, p.currency)}</span>,
                  <span className="num">{fmt(p.paid, p.currency)}</span>,
                  <span style={{ display: 'block', minWidth: '130px' }}>
                    <span className="t-caption dim tnum">{pct}%</span>{' '}
                    <span className="meter" style={{ marginTop: '6px' }}>
                      <i style={css(`width:${pct}%`)} />
                    </span>
                  </span>,
                  <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
                    {can('finance.enter') ? (
                      <button className="btn btn-secondary btn-dense" data-money={`pledge-allocate:${p.id}`}>
                        {L('Count a gift', 'احتساب تقدمة')}
                      </button>
                    ) : null}
                  </span>
                ]
              };
            })}
            empty={
              <Empty
                glyph="give"
                title={L('No pledges yet', 'لا تعهّدات بعد')}
                body={L(
                  'Record what a family has promised to a fund, then count the gifts that fulfil it.',
                  'سجّل ما تعهّدت به عائلة لصندوق، ثم احتسب التقدمات التي تفي به.'
                )}
              />
            }
          />{' '}
          {can('finance.enter') ? (
            <button className="btn btn-secondary" style={{ marginTop: '16px' }} data-act="rec-new:pledge">
              <Icon name="plus" size={17} />
              {L('New pledge', 'تعهّد جديد')}
            </button>
          ) : null}
          <p className="t-caption dim" style={{ marginTop: '12px' }}>
            {L(
              'A pledge cannot be edited after it is recorded; a gift counts toward it only when you allocate it.',
              'لا يُعدَّل التعهّد بعد تسجيله؛ ولا تُحتسب تقدمة عليه إلا بتخصيصها.'
            )}
          </p>
        </div>
      </>
    );
  if (tab === 'recurring')
    return (
      <>
        {head}
        <div className="tabbody">
          <Table
            cols={[
              { label: L('Giver', 'المتبرّع') },
              { label: L('Amount', 'المبلغ'), cls: 'num' },
              { label: L('Every', 'كل') },
              { label: L('Fund', 'الصندوق'), cls: 'hide-sm' },
              { label: L('Next expected', 'الموعد المتوقَّع') },
              { label: L('Status', 'الحالة'), cls: 'shrink' },
              { label: '', cls: 'shrink' }
            ]}
            rows={RECURRING.map(r => ({
              detail:
                r.note || r.reason ? (
                  <dl className="dl">
                    {r.note ? (
                      <>
                        <dt>{L('Note', 'ملاحظة')}</dt>
                        <dd>{r.note}</dd>
                      </>
                    ) : null}
                    {r.reason ? (
                      <>
                        <dt>{L('Reason given', 'السبب المذكور')}</dt>
                        <dd>{r.reason}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : null,
              cells: [
                giverName(r),
                <span className="num">{fmt(r.amount, r.currency)}</span>,
                <span className="dim">{A.frequencyLabel(r.frequency)}</span>,
                <span className="dim">{fundName(r.fund)}</span>,
                r.next ? <span className="mono dim">{fmtDate(r.next)}</span> : <span className="dimmer">—</span>,
                <Pill
                  label={
                    r.status === 'Active'
                      ? L('Active', 'جارٍ')
                      : r.status === 'Paused'
                        ? L('Paused', 'موقوف مؤقتاً')
                        : L('Ended', 'منتهٍ')
                  }
                  tone={r.status === 'Active' ? 'success' : r.status === 'Paused' ? 'warning' : undefined}
                />,
                can('finance.enter') && r.status !== 'Ended' ? (
                  <span className="row" style={{ gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-dense" data-money={`recurring-edit:${r.id}`}>
                      {L('Edit', 'تعديل')}
                    </button>
                    <button
                      className="btn btn-ghost btn-dense"
                      data-money={`recurring:${r.id}|${r.status === 'Active' ? 'pause' : 'resume'}`}
                    >
                      {r.status === 'Active' ? L('Pause', 'إيقاف مؤقت') : L('Resume', 'استئناف')}
                    </button>
                    <button className="btn btn-ghost btn-dense" data-money={`recurring:${r.id}|end`}>
                      {L('End', 'إنهاء')}
                    </button>
                  </span>
                ) : (
                  ''
                )
              ]
            }))}
            empty={
              <Empty
                glyph="give"
                title={L('No recurring gifts recorded', 'لا عطاء دائم مسجّل')}
                body={L(
                  'Record what a giver intends to give regularly. Each gift is still counted when it arrives, in a counting session.',
                  'سجّل ما ينوي المتبرّع إعطاءه بانتظام. وتُعدّ كل تقدمة عند وصولها في جلسة عدّ.'
                )}
              />
            }
          />{' '}
          {can('finance.enter') ? (
            <button className="btn btn-secondary" style={{ marginTop: '16px' }} data-money="recurring-new">
              <Icon name="plus" size={17} />
              {L('New recurring gift', 'عطاء دائم جديد')}
            </button>
          ) : null}
          <p className="t-caption dim" style={{ marginTop: '16px' }}>
            {L(
              'A recurring gift is a record of intention. ParishLife never charges anyone: nothing is taken from anyone without a person recording it, and an expected date is not a debt.',
              'العطاء الدائم سجلّ نيّة. لا يقتطع «حياة الرعية» من أحد: لا يُؤخذ شيء من دون أن يسجّله إنسان، والموعد المتوقَّع ليس ديناً.'
            )}
          </p>
        </div>
      </>
    );
  if (tab === 'campaigns')
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="toolbar">
            {can('finance.approve') ? (
              <button className="btn btn-secondary" data-act="rec-new:campaign" style={{ marginInlineStart: 'auto' }}>
                <Icon name="plus" size={17} />
                {L('New appeal', 'حملة جديدة')}
              </button>
            ) : null}
          </div>{' '}
          {CAMPAIGNS.length ? (
            ''
          ) : (
            <Empty
              glyph="give"
              title={L('No appeals running', 'لا حملات جارية')}
              body={L(
                'Start one for a restoration, a feast or a family in need.',
                'ابدأ واحدة لترميم أو عيد أو عائلة محتاجة.'
              )}
            />
          )}{' '}
          <div className="grid g2">
            {CAMPAIGNS.map((c, i) => {
              const goalCurrency = Object.keys(c.targets)[0];
              const goal = c.targets[goalCurrency] || 0;
              const raised = c.received[goalCurrency] || 0;
              const pct = goal ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
              return (
                <section key={i} className="panel">
                  <div className="panel-b">
                    <div className="row" style={{ gap: '10px', alignItems: 'flex-start' }}>
                      <b style={{ font: '600 16px/22px var(--sans)', flex: 1, minWidth: 0 }}>{L(c.name, c.ar)}</b>
                      {can('finance.approve') ? (
                        <button className="btn btn-ghost btn-dense" data-money={`campaign-edit:${c.id}`}>
                          {L('Edit', 'تعديل')}
                        </button>
                      ) : null}
                    </div>{' '}
                    <p className="t-caption dim">{fundName(c.fund)}</p>
                    <div className="amount" style={{ marginTop: '10px' }} dir="ltr">
                      <span className="usd">{amounts(c.received)}</span>{' '}
                      <span className="lbp">
                        {L('of', 'من')} {amounts(c.targets)}
                      </span>
                    </div>{' '}
                    <span className="meter" style={{ marginTop: '12px', height: '8px' }}>
                      <i style={css(`width:${pct}%`)} />
                    </span>{' '}
                    <div className="row" style={{ gap: '12px', marginTop: '10px' }}>
                      <span className="t-caption dim">
                        {pct}% · {L('pledged', 'متعهَّد')} {amounts(c.pledged)}
                      </span>{' '}
                      {c.ends ? (
                        <span className="t-caption dim" style={{ marginInlineStart: 'auto' }}>
                          {L('ends', 'تنتهي')} {fmtDate(c.ends)}
                        </span>
                      ) : null}
                    </div>{' '}
                    <div className="row" style={{ gap: '6px', marginTop: '14px' }}>
                      <button
                        className="btn btn-secondary btn-dense"
                        style={{ flex: 1 }}
                        data-go="giving/contributions"
                      >
                        {L('Gifts', 'التقدمات')}
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </>
    );
  if (tab === 'receipts')
    return (
      <>
        {head}
        <div style={{ marginTop: '20px' }} className="splitview">
          <div>
            <Panel title={L('Receipts issued', 'الإيصالات الصادرة')} tight={true}>
              <Table
                cols={[
                  { label: L('No.', 'الرقم'), cls: 'shrink' },
                  { label: L('Giver', 'المتبرّع') },
                  { label: L('Date', 'التاريخ'), cls: 'hide-sm' },
                  { label: L('Amount', 'المبلغ'), cls: 'num' },
                  { label: L('Issued by', 'أصدره'), cls: 'hide-md' },
                  { label: '', cls: 'shrink' }
                ]}
                rows={RECEIPTS.map(r => ({
                  cells: [
                    <span className="mono">{r.no}</span>,
                    giverName(r),
                    <span className="mono dim">{fmtDate(r.date)}</span>,
                    <span className="num">
                      {fmt(r.amount, r.currency)}
                      {r.status === 'Voided' ? ` · ${L('void', 'ملغى')}` : ''}
                    </span>,
                    <span className="dim">{nameOf(session.parishId, r.issuedBy) || '—'}</span>,
                    r.status === 'Issued' && can('finance.approve') ? (
                      <button
                        className={'btn btn-dense ' + (r.giftStatus === 'Reversed' ? 'btn-secondary' : 'btn-ghost')}
                        data-money={`receipt-void:${r.id}`}
                        title={
                          r.giftStatus === 'Reversed'
                            ? L('The gift was reversed', 'عُكست التقدمة')
                            : L('Void this receipt', 'إلغاء هذا الإيصال')
                        }
                      >
                        {L('Void', 'إلغاء')}
                      </button>
                    ) : r.status === 'Voided' ? (
                      <Pill label={L('Voided', 'ملغى')} />
                    ) : (
                      ''
                    )
                  ]
                }))}
                empty={
                  <Empty
                    glyph="doc"
                    title={L('No receipts issued yet', 'لا إيصالات صادرة بعد')}
                    body={L(
                      'Issue a numbered receipt from a posted gift in Contributions. Numbers follow each other with no gap; a voided receipt keeps its number.',
                      'أصدر إيصالاً مرقّماً من تقدمة مقيّدة في «المساهمات». تتتابع الأرقام بلا فجوة؛ والإيصال الملغى يحتفظ برقمه.'
                    )}
                  />
                }
              />
            </Panel>
          </div>{' '}
          <div className="sidecol">
            <Panel title={L('Annual statements', 'الكشوفات السنوية')}>
              <p className="t-body dim" style={{ fontSize: '14px' }}>
                {L(
                  'A statement lists the gifts a person gave in a year, each in the currency it was given in. Anonymous gifts are left out.',
                  'يسرد الكشف التقدمات التي أعطاها الشخص في سنة، كلاً بعملتها. وتُستثنى التقدمات المجهولة.'
                )}
              </p>{' '}
              <C.PersonPicker label={L('Giver', 'المتبرّع')} id="stmtp" />{' '}
              <div className="formrow">
                <label className="label" htmlFor="stmty">
                  {L('Year', 'السنة')}
                </label>
                <input className="input" id="stmty" type="number" defaultValue={new Date().getFullYear()} />
              </div>{' '}
              <button className="btn btn-secondary" style={{ width: '100%' }} data-money="statement">
                <Icon name="doc" size={17} />
                {L('Statement for this giver', 'كشف لهذا المتبرّع')}
              </button>{' '}
              <C.InlineAlert
                tone="warning"
                title={L('Not a tax document', 'ليس مستنداً ضريبياً')}
                body={L(
                  'ParishLife does not assume a parish receipt qualifies as a tax document in any jurisdiction.',
                  'لا يفترض «حياة الرعية» أن إيصال الرعية يصلح مستنداً ضريبياً في أي بلد.'
                )}
              />{' '}
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '12px' }}
                data-act="statements-all"
              >
                <Icon name="doc" size={17} />
                {L('Generate for every giver', 'إصدار لكل متبرّع')}
              </button>
            </Panel>
          </div>
        </div>
      </>
    );

  /* counting session */
  if (!BATCH.id)
    return (
      <>
        {head}
        <div style={{ marginTop: '20px' }}>
          <Empty
            glyph="give"
            title={L('No counting session in view', 'لا جلسة عدّ معروضة')}
            body={L(
              'Open a session for the collection you are counting, or choose one someone else opened.',
              'افتح جلسة للجمع الذي تعدّه، أو اختر جلسة فتحها شخص آخر.'
            )}
            action={
              COUNT_SESSIONS.length ? (
                <button className="btn btn-secondary btn-dense" data-money="session-view">
                  {L('Choose a session', 'اختيار جلسة')}
                </button>
              ) : null
            }
          />
        </div>
      </>
    );
  const rows = BATCH.lines.map((l, li) => ({
    cells: [
      l.env ? <span className="mono">{l.env}</span> : <span className="dimmer">—</span>,
      giverName(l),
      <span className="dim">{fundName(l.fund)}</span>,
      <span className="chip">{l.method}</span>,
      <span className="num">{fmt(l.amount, l.currency)}</span>,
      open && can('finance.enter') ? (
        <span className="rowacts">
          <C.IconBtn ico="edit" label={L('Edit', 'تعديل')} data-act={`line-edit:${li}`} />
          <C.IconBtn ico="trash" label={L('Remove', 'إزالة')} data-act={`line-reverse:${li}`} />
        </span>
      ) : (
        ''
      )
    ]
  }));
  return (
    <>
      {head}
      <p className="t-caption dim" style={{ marginTop: '8px' }}>
        {L('Counted by', 'عدّها')}: {BATCH.counters.map(id => nameOf(session.parishId, id) || '—').join(', ') || '—'}
        {BATCH.verifiedBy
          ? ` · ${L('verified by', 'تحقّق منها')} ${nameOf(session.parishId, BATCH.verifiedBy) || '—'}`
          : ''}
        {BATCH.postedBy ? ` · ${L('posted by', 'قيّدها')} ${nameOf(session.parishId, BATCH.postedBy) || '—'}` : ''}
      </p>
      <div className="grid g2" style={{ margin: '20px 0 24px', alignItems: 'start' }}>
        <Panel title={L('Counted so far', 'المعدود حتى الآن')}>
          <dl className="dl">
            {Object.entries(totals).map(([currency, value]) => (
              <span key={currency} style={{ display: 'contents' }}>
                <dt>{currency}</dt>
                <dd className="mono tnum">{fmt(value, currency)}</dd>
              </span>
            ))}
            <dt>{L('Envelopes', 'المظاريف')}</dt>
            <dd className="tnum">{BATCH.lines.filter(l => l.env).length}</dd>
            <dt>{L('Unattributed', 'غير مسمّى')}</dt>
            <dd className="tnum">{BATCH.lines.filter(l => !l.env && !l.p && !l.anonymous).length}</dd>
          </dl>{' '}
          <p className="t-caption dim" style={{ marginTop: '14px' }}>
            {L(
              'Each currency is kept as counted. ParishLife never adds lira into the dollar total.',
              'تبقى كل عملة كما عُدّت. ولا يضيف «حياة الرعية» الليرة إلى مجموع الدولار.'
            )}
          </p>
        </Panel>{' '}
        <Panel title={L('Second count', 'العدّ الثاني')}>
          {BATCH.apiStatus === 'Verified' ? (
            <C.InlineAlert
              tone="success"
              title={L('A second person has verified this count', 'تحقّق شخص ثانٍ من هذا العدّ')}
              body={L('The totals agree. The session can be closed.', 'المجاميع متطابقة. يمكن إقفال الجلسة.')}
            />
          ) : BATCH.apiStatus === 'Variance' ? (
            <>
              <C.InlineAlert
                tone="danger"
                title={L('The second count differs', 'العدّ الثاني مختلف')}
                body={
                  (BATCH.varianceNote ? BATCH.varianceNote + ' · ' : '') +
                  BATCH.variance.map(v => `${v.currency} ${v.method}: ${fmt(v.amount, v.currency)}`).join(' · ')
                }
              />
              <p className="t-caption dim" style={{ marginTop: '10px' }}>
                {L(
                  'Both counts are kept. Recount, correct the lines, then verify again.',
                  'يُحفظ العدّان. أعد العدّ وصحّح البنود ثم تحقّق من جديد.'
                )}
              </p>
            </>
          ) : BATCH.apiStatus === 'Posted' ? (
            <C.InlineAlert
              tone="info"
              title={L('Closed and posted', 'مقفلة ومقيّدة')}
              body={L(
                'Its lines are now gifts. Correct one by a reversing entry from Contributions.',
                'صارت بنودها تقدمات. صحّح أيّاً منها بقيد عكسي من «المساهمات».'
              )}
            />
          ) : (
            <C.InlineAlert
              tone="info"
              title={L('Waiting for a second counter', 'بانتظار عدّاد ثانٍ')}
              body={L(
                'A different person counts the cash and enters their own totals. A session cannot be closed by one person.',
                'يعدّ شخص آخر النقد ويُدخل مجاميعه. ولا تُقفل الجلسة بشخص واحد.'
              )}
            />
          )}
          {BATCH.apiStatus === 'Open' || BATCH.apiStatus === 'Variance' ? (
            BATCH.lines.length && can('finance.enter') ? (
              <button className="btn btn-secondary" style={{ marginTop: '14px' }} data-money="session-verify">
                {L('I am the second counter', 'أنا العدّاد الثاني')}
              </button>
            ) : null
          ) : null}
        </Panel>
      </div>{' '}
      <Table
        cols={[
          { label: L('Envelope', 'المظروف'), cls: 'shrink' },
          { label: L('Giver', 'المتبرّع') },
          { label: L('Fund', 'الصندوق'), cls: 'hide-sm' },
          { label: L('Method', 'الطريقة'), cls: 'hide-sm' },
          { label: L('Amount', 'المبلغ'), cls: 'num' },
          { label: '', cls: 'shrink' }
        ]}
        rows={rows}
        empty={
          <Empty
            glyph="give"
            title={L('No lines yet', 'لا بنود بعد')}
            body={L(
              'Add each envelope, and the loose cash, as it is counted.',
              'أضف كل مظروف، والنقد غير المسمّى، أثناء العدّ.'
            )}
          />
        }
        foot={
          <>
            <b>{L('Total', 'المجموع')}</b>{' '}
            <span style={{ marginInlineStart: 'auto', display: 'flex', gap: '28px' }}>
              <span className="mono tnum">{amounts(totals)}</span>
            </span>
          </>
        }
      />{' '}
      <C.InlineAlert
        tone="info"
        title={L('A session cannot be closed by one person', 'لا تُقفل الجلسة بشخص واحد')}
        body={L(
          'A second person verifies the exact count before it is closed. Once closed, a line can only be corrected by a reversing entry that stays in the history.',
          'يتحقّق شخص ثانٍ من العدّ نفسه قبل الإقفال. وبعد الإقفال لا يُصحَّح البند إلا بقيد عكسي يبقى في السجل.'
        )}
      />
    </>
  );
}

const newKey = () => 'l' + crypto.randomUUID().replaceAll('-', '');

giving.mount = host => {
  applyFinanceAccess(host);
  host.querySelectorAll('[data-money]').forEach(b =>
    b.addEventListener('click', async () => {
      const [what, arg] = b.dataset.money.split(':');
      if (what === 'session-open') A.openSessionDialog();
      else if (what === 'session-view') A.viewSessionDialog();
      else if (what === 'session-verify') A.verifyDialog();
      else if (what === 'session-close') A.closeSessionDialog();
      else if (what === 'gift-correct') A.correctGiftDialog(arg);
      else if (what === 'pledge-allocate') A.allocateDialog(arg);
      else if (what === 'receipt-issue') A.issueReceiptDialog(arg);
      else if (what === 'receipt-void') A.voidReceiptDialog(arg);
      else if (what === 'recurring-new') A.recurringDialog();
      else if (what === 'recurring-edit') A.recurringDialog(arg);
      else if (what === 'recurring') A.recurringActionDialog(...arg.split('|'));
      else if (what === 'campaign-edit') CR.edit('campaign', arg);
      else if (what === 'statement') (await import('./money-dialogs.jsx')).statementFromPage(host);
    })
  );
  host.querySelector('#addenv')?.addEventListener('click', () =>
    openDrawer({
      title: L('New envelope or cash line', 'مظروف أو نقد جديد'),
      sub: BATCH.ref,
      body: (
        <>
          <div className="formgrid">
            <C.Field label={L('Envelope no. (if numbered)', 'رقم المظروف (إن وُجد)')} ph="0142" dir="ltr" id="envno" />{' '}
            <div className="formrow">
              <label className="label" htmlFor="envfund">
                {L('Fund', 'الصندوق')}
              </label>{' '}
              <Select id="envfund">
                {FUNDS.map((f, i) => (
                  <option key={i} value={f.id}>
                    {L(f.name, f.ar)}
                  </option>
                ))}
              </Select>
            </div>
          </div>{' '}
          <C.PersonPicker label={L('Given by (optional)', 'المتبرّع (اختياري)')} id="givep" />{' '}
          <div className="formgrid">
            <C.Field label={L('Amount', 'المبلغ')} type="number" id="giveamt" ph="0" />
            <div className="formrow">
              <label className="label" htmlFor="givecur">
                {L('Currency', 'العملة')}
              </label>
              <Select id="givecur">
                <option value="USD">USD</option>
                <option value="LBP">LBP</option>
                <option value="EUR">EUR</option>
              </Select>
            </div>
          </div>{' '}
          <div className="formgrid">
            <div className="formrow">
              <label className="label" htmlFor="givemethod">
                {L('Method', 'الطريقة')}
              </label>
              <Select id="givemethod">
                <option value="Cash">{L('Cash', 'نقداً')}</option>
                <option value="Cheque">{L('Cheque', 'شيك')}</option>
                <option value="Bank">{L('Bank transfer', 'تحويل مصرفي')}</option>
                <option value="Card">{L('Card', 'بطاقة')}</option>
                <option value="Other">{L('Other', 'أخرى')}</option>
              </Select>
            </div>
            <C.Field
              label={L('Note (optional)', 'ملاحظة (اختياري)')}
              id="giveref"
              ph={L('Loose cash', 'نقد غير مسمّى')}
            />
          </div>{' '}
          <div className="stack" style={{ gap: '10px' }}>
            <C.CheckRow
              id="envanon"
              label={L('Anonymous — record the amount, not the giver', 'مجهول — سجّل المبلغ لا المتبرّع')}
            />
          </div>
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Close', 'إغلاق')}
          </button>{' '}
          <button className="btn btn-primary" id="env-save" style={{ marginInlineStart: 'auto' }}>
            {L('Save & add next', 'حفظ وإضافة التالي')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#env-save').addEventListener('click', () => {
          const value = id => el.querySelector('#' + id)?.value.trim() || '';
          const amount = Math.round(parseFloat(value('giveamt').replace(/,/g, '')) * 100) / 100;
          if (!(amount > 0)) return el.querySelector('#giveamt').focus();
          const currency = value('givecur') || 'USD';
          const anonymous = !!el.querySelector('#envanon')?.checked;
          BATCH.lines.push({
            key: newKey(),
            env: anonymous ? null : value('envno') || null,
            p: anonymous ? null : el.querySelector('#givep')?.dataset.pid || null,
            fund: value('envfund') || FUNDS[0]?.id,
            campaign: null,
            amount,
            currency,
            method: value('givemethod') || 'Cash',
            anonymous,
            ref: value('giveref'),
            ...(currency === 'USD' ? { usd: amount } : {}),
            ...(currency === 'LBP' ? { lbp: amount } : {})
          });
          bus.refresh(); // saves the lines and shows what the API stored
          for (const id of ['envno', 'giveamt', 'giveref', 'givep']) {
            const input = el.querySelector('#' + id);
            if (input) {
              input.value = '';
              delete input.dataset.pid;
            }
          }
          el.querySelector('#envno')?.focus();
        });
      }
    })
  );
};
