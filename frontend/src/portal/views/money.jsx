import { Select } from "../ui/components.jsx";
import { css } from "../ui/html.js";
/* Module 12 — giving, funds, expenses, receipts, campaigns, reconciliation. */
import { t, isAr, num, usd, lbp, fmtDate } from "../../lib/i18n.js";
import { is } from "../model/store.js";
import { Icon, PageHead, Panel, Who, Status, Pill, Table, Empty, Amount, Stat, openDrawer, openModal, closeOverlays, toast, TabBar, Avatar } from "../ui/ui.jsx";
import * as C from "../ui/components.jsx";
import * as CR from "../flows/crud.jsx";
import { VERBS } from "../actions.jsx";
import { BATCH, FUNDS, EXPENSES, PLEDGES, RATE, CAMPAIGNS, RECURRING, RECEIPTS, BANKLINES, GIVING_SERIES, PAYMENT_MIX, person } from "../model/data.js";
const L = (en, ar) => t(en, ar);
function applyFinanceAccess(host) {
  if (is('priest', 'treasurer', 'super_admin', 'bishop', 'diocesan_admin', 'parish_admin')) return;
  host.querySelectorAll('#addenv,#close,[data-act]').forEach(el => {
    const action = (el.dataset.act || '').split(':')[0];
    if (!['print', 'export', 'receipt', 'doc', 'statements-all'].includes(action)) el.remove();
  });
  const note = document.createElement('p');
  note.className = 'help';
  note.textContent = L('You can view, print and export these financial records. Recording or changing transactions requires a priest or treasurer.', 'يمكنك عرض السجلات المالية وطباعتها وتصديرها. يتطلب تسجيل المعاملات أو تعديلها كاهناً أو أمين صندوق.');
  host.querySelector('.tabs')?.insertAdjacentElement('afterend', note);
}
const fundName = id => {
  const f = FUNDS.find(x => x.id === id);
  return f ? L(f.name, f.ar) : id;
};
const GTABS = () => [['', 'Counting session', 'جلسة العدّ'], ['contributions', 'Contributions', 'المساهمات'], ['pledges', 'Pledges', 'التعهّدات', PLEDGES.length], ['recurring', 'Recurring', 'الدائمة', RECURRING.length], ['campaigns', 'Campaigns', 'الحملات', CAMPAIGNS.length], ['receipts', 'Receipts & statements', 'الإيصالات والكشوفات']];
export function giving(tab = '') {
  const usdTotal = BATCH.lines.reduce((a, l) => a + (l.usd || 0), 0);
  const lbpTotal = BATCH.lines.reduce((a, l) => a + (l.lbp || 0), 0);
  const head = <><PageHead crumbs={[{
      label: L('Money', 'المال')
    }, {
      label: L('Giving', 'التقدمات')
    }]} title={tab ? L('Giving', 'التقدمات') : L(BATCH.ref, BATCH.refAr)} sub={tab ? L('Funds, campaigns, pledges, recurring giving and donor history — donor details stay restricted.', 'الصناديق والحملات والتعهّدات والعطاء الدائم وتاريخ المتبرّعين — وتبقى تفاصيل المتبرّعين مقيّدة.') : <>{fmtDate(BATCH.date)}{" · "}{<Status k='open' />}{" · "}{L('counted by Nabil Saade and Joseph Sfeir', 'عدّها نبيل سعادة وجوزيف صفير')}</>} actions={<><button className="btn btn-secondary" data-act="print"><Icon name='print' size={17} />{L('Print sheet', 'طباعة الورقة')}</button>{" "}<button className="btn btn-secondary" id="addenv"><Icon name='plus' size={17} />{L('Add envelope', 'إضافة مظروف')}</button>{" "}<button className="btn btn-primary" id="close"><Icon name='check' size={17} />{L('Close session', 'إقفال الجلسة')}</button></>} /><TabBar base='giving' items={GTABS()} active={tab} /></>;
  if (tab === 'contributions') return <>{head}<div className="tabbody"><div className="grid g2" style={{
        marginBottom: "20px"
      }}><C.Kpi k={L('Given this month', 'المعطى هذا الشهر')} v={usd(8420)} sub={`L.L ${num(8420 * RATE.value)}`} delta={L('+12% vs September', '+١٢٪ عن أيلول')} spark={GIVING_SERIES} />{" "}<Panel title={L('How people give', 'كيف يُعطي الناس')}><C.Donut segments={PAYMENT_MIX.map(p => ({
            ...p,
            label: isAr() ? p.labelAr : p.label
          }))} /></Panel></div>{" "}<Table pick={true} cols={[{
        label: L('Date', 'التاريخ'),
        sort: true
      }, {
        label: L('Giver', 'المتبرّع')
      }, {
        label: L('Fund', 'الصندوق'),
        cls: 'hide-sm'
      }, {
        label: L('Method', 'الطريقة'),
        cls: 'hide-md'
      }, {
        label: 'USD',
        cls: 'num',
        sort: true
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={BATCH.lines.filter(l => l.p).map(l => ({
        cells: [<span className="mono dim">{fmtDate(BATCH.date)}</span>, <Who p={person(l.p)} />, <span className="dim">{fundName(l.fund)}</span>, <span className="chip">{L('Envelope', 'مظروف')}</span>, <span className="num">{usd(l.usd)}</span>, <C.IconBtn ico='info' label={L('Rate used for this gift', 'السعر المعتمد لهذه التقدمة')} data-rate-pop="" />]
      }))} /></div></>;
  if (tab === 'pledges') return <>{head}<div className="tabbody"><Table cols={[{
        label: L('Donor', 'المتبرّع')
      }, {
        label: L('Fund', 'الصندوق'),
        cls: 'hide-sm'
      }, {
        label: L('Pledged', 'تعهّد'),
        cls: 'num'
      }, {
        label: L('Paid', 'دفع'),
        cls: 'num'
      }, {
        label: L('Progress', 'التقدّم')
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={PLEDGES.map(p => {
        const pct = p.pledged ? Math.min(100, Math.round(p.paid / p.pledged * 100)) : 0;
        return {
          cells: [<Who p={person(p.p)} />, <span className="dim">{fundName(p.fund)}</span>, <span className="num">{usd(p.pledged)}</span>, <span className="num">{usd(p.paid)}</span>, <span style={{
            display: "block",
            minWidth: "130px"
          }}><span className="t-caption dim tnum">{pct}%</span>{" "}<span className="meter" style={{
              marginTop: "6px"
            }}><i style={css(`width:${pct}%`)} /></span></span>, CR.recBtn('pledge', p.id)]
        };
      })} empty={<Empty glyph='give' title={L('No pledges yet', 'لا تعهّدات بعد')} body={L('Record what a family has promised to a fund, and what has come in.', 'سجّل ما تعهّدت به عائلة لصندوق، وما وصل منه.')} />} />{" "}<button className="btn btn-secondary" style={{
        marginTop: "16px"
      }} data-act="rec-new:pledge"><Icon name='plus' size={17} />{L('New pledge', 'تعهّد جديد')}</button></div></>;
  if (tab === 'recurring') return <>{head}<div className="tabbody"><Table cols={[{
        label: L('Donor', 'المتبرّع')
      }, {
        label: L('Amount', 'المبلغ'),
        cls: 'num'
      }, {
        label: L('Every', 'كل')
      }, {
        label: L('Fund', 'الصندوق'),
        cls: 'hide-sm'
      }, {
        label: L('Next', 'التالي')
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={RECURRING.map((r, ri) => ({
        cells: [<Who p={person(r.p)} />, <span className="num">{usd(r.amount)}</span>, <span className="dim">{L(r.every, r.everyAr)}</span>, <span className="dim">{fundName(r.fund)}</span>, r.paused ? <Pill label={L('Paused', 'متوقّف')} tone='warning' mark='st-pause' /> : <span className="mono dim">{fmtDate(r.next)}</span>, <button className="btn btn-secondary btn-dense" data-act={`recurring-toggle:${ri}`}>{r.paused ? L('Resume', 'استئناف') : L('Pause', 'إيقاف مؤقّت')}</button>]
      }))} />{" "}<p className="t-caption dim" style={{
        marginTop: "16px"
      }}>{L('A standing envelope is recorded when it arrives, not charged automatically. Nothing is taken from anyone without a person recording it.', 'المظروف الدائم يُسجَّل عند وصوله ولا يُقتطع تلقائياً. ولا يُؤخذ شيء من أحد من دون أن يسجّله إنسان.')}</p></div></>;
  if (tab === 'campaigns') return <>{head}<div className="tabbody"><div className="toolbar"><button className="btn btn-secondary" data-act="rec-new:campaign" style={{
          marginInlineStart: "auto"
        }}><Icon name='plus' size={17} />{L('New appeal', 'حملة جديدة')}</button></div>{" "}{CAMPAIGNS.length ? '' : <Empty glyph='give' title={L('No appeals running', 'لا حملات جارية')} body={L('Start one for a restoration, a feast or a family in need.', 'ابدأ واحدة لترميم أو عيد أو عائلة محتاجة.')} />}{" "}<div className="grid g2">{CAMPAIGNS.map(c => {
          const pct = c.goal ? Math.min(100, Math.round(c.raised / c.goal * 100)) : 0;
          return <section className="panel"><div className="panel-b"><div className="row" style={{
                gap: "10px",
                alignItems: "flex-start"
              }}><b style={{
                  font: "600 16px/22px var(--sans)",
                  flex: 1,
                  minWidth: 0
                }}>{L(c.name, c.ar)}</b>{CR.recBtn('campaign', c.id)}</div>{" "}<div className="amount" style={{
                marginTop: "10px"
              }} dir="ltr"><span className="usd">{usd(c.raised)}</span>{" "}<span className="lbp">{L('of', 'من')}{" "}{usd(c.goal)} · L.L {num(c.raised * RATE.value)}</span></div>{" "}<span className="meter" style={{
                marginTop: "12px",
                height: "8px"
              }}><i style={css(`width:${pct}%`)} /></span>{" "}<div className="row" style={{
                gap: "12px",
                marginTop: "10px"
              }}><span className="t-caption dim">{pct}% · {c.donors}{" "}{L('donors', 'متبرّعاً')}</span>{" "}<span className="t-caption dim" style={{
                  marginInlineStart: "auto"
                }}>{L('ends', 'تنتهي')}{" "}{fmtDate(c.ends)}</span></div>{" "}<div className="row" style={{
                gap: "6px",
                marginTop: "14px"
              }}><button className="btn btn-secondary btn-dense" style={{
                  flex: 1
                }} data-go="giving/contributions">{L('Donors', 'المتبرّعون')}</button>{" "}<button className="btn btn-secondary btn-dense" style={{
                  flex: 1
                }} data-act="compose:all">{L('Appeal', 'نداء')}</button></div></div></section>;
        })}</div></div></>;
  if (tab === 'receipts') return <>{head}<div style={{
      marginTop: "20px"
    }} className="splitview"><div><Panel title={L('Receipts issued', 'الإيصالات الصادرة')} tight={true}><Table cols={[{
            label: L('No.', 'الرقم'),
            cls: 'shrink'
          }, {
            label: L('Donor', 'المتبرّع')
          }, {
            label: L('Amount', 'المبلغ'),
            cls: 'num'
          }, {
            label: L('Sent', 'أُرسل'),
            cls: 'shrink'
          }, {
            label: '',
            cls: 'shrink'
          }]} rows={RECEIPTS.map(r => ({
            cells: [<span className="mono">{r.no}</span>, <Who p={person(r.p)} />, <span className="num">{usd(r.amount)}</span>, r.sent === 'none' ? <Pill label={L('Not sent', 'لم يُرسل')} tone='warning' /> : <span className="chip">{r.sent}</span>, <button className="btn btn-secondary btn-dense" data-act={`receipt:${r.no}|${r.p}|${r.amount}`}>{L('Open', 'فتح')}</button>]
          }))} /></Panel></div>{" "}<div className="sidecol"><Panel title={L('Annual statements', 'الكشوفات السنوية')}><p className="t-body dim" style={{
            fontSize: "14px"
          }}>{L('A statement lists what a household gave in a year, in both currencies, at the rate that applied to each gift.', 'يُظهر الكشف ما أعطته العائلة في السنة، بالعملتين، وبالسعر الذي طُبّق على كل تقدمة.')}</p>{" "}<C.InlineAlert tone='warning' title={L('Not a tax document', 'ليس مستنداً ضريبياً')} body={L('ParishLife does not assume a parish receipt qualifies as a tax document in any jurisdiction.', 'لا يفترض «حياة الرعية» أن إيصال الرعية يصلح مستنداً ضريبياً في أي بلد.')} />{" "}<button className="btn btn-primary" style={{
            width: "100%",
            marginTop: "12px"
          }} data-act="statements-all"><Icon name='doc' size={17} />{L('Generate for every household', 'إصدار لكل العائلات')}</button></Panel></div></div></>;

  /* counting session */
  const rows = BATCH.lines.map((l, li) => ({
    cells: [l.env ? <span className="mono">{l.env}</span> : <span className="dimmer">—</span>, l.p ? <Who p={person(l.p)} /> : <span className="dim">{L(l.note, l.noteAr || l.note)}</span>, <span className="dim">{fundName(l.fund)}</span>, l.usd ? <span className="num">{usd(l.usd)}</span> : <span className="num dimmer">—</span>, l.usd ? <span className="num dim">{num(l.usd * RATE.value)}</span> : <span className="num">{num(l.lbp)}</span>, <span className="rowacts"><C.IconBtn ico='edit' label={L('Edit', 'تعديل')} data-act={`line-edit:${li}`} /><C.IconBtn ico='trash' label={L('Reverse', 'عكس')} data-act={`line-reverse:${li}`} /></span>]
  }));
  return <>{head}<div className="grid g2" style={{
      margin: "20px 0 24px",
      alignItems: "start"
    }}><Panel title={L('Counted so far', 'المعدود حتى الآن')}><Amount dollars={usdTotal} showRate={true} cls='amount-lg' />{" "}<div className="divider" />{" "}<dl className="dl"><dt>{L('Given in dollars', 'مُعطى بالدولار')}</dt><dd className="mono tnum">{usd(usdTotal)}</dd><dt>{L('Given in lira', 'مُعطى بالليرة')}</dt><dd className="mono tnum">{num(lbpTotal)}</dd><dt>{L('Envelopes', 'المظاريف')}</dt><dd className="tnum">{BATCH.lines.filter(l => l.env).length}</dd><dt>{L('Unattributed', 'غير مسمّى')}</dt><dd className="tnum">{BATCH.lines.filter(l => !l.env).length}</dd></dl>{" "}<p className="t-caption dim" style={{
          marginTop: "14px"
        }}>{L('Lira given as lira is kept as lira. It sits next to the dollar total for reading, never silently added into it.', 'ما يُعطى بالليرة يبقى ليرة. يُعرض إلى جانب مجموع الدولار للقراءة، ولا يُضاف إليه بصمت.')}</p></Panel>{" "}<Panel title={L('Second count', 'العدّ الثاني')}><C.InlineAlert tone='success' title={L('Second person has verified this batch', 'تحقّق شخص ثانٍ من هذه الدفعة')} body={L('Rita Nassar counted the same totals at 19:32. Ready to close.', 'عدّت ريتا نصّار المجاميع نفسها الساعة ١٩:٣٢. جاهزة للإقفال.')} />{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "10px"
        }}><Avatar p={person('p15')} cls='avatar-sm' /><Avatar p={person('p7')} cls='avatar-sm' />{" "}<span className="t-caption dim">{L('Two counters signed in', 'عدّادان مسجّلان')}</span></div></Panel></div>{" "}<Table cols={[{
      label: L('Envelope', 'المظروف'),
      cls: 'shrink'
    }, {
      label: L('Giver', 'المتبرّع')
    }, {
      label: L('Fund', 'الصندوق'),
      cls: 'hide-sm'
    }, {
      label: 'USD',
      cls: 'num'
    }, {
      label: 'L.L',
      cls: 'num hide-sm'
    }, {
      label: '',
      cls: 'shrink'
    }]} rows={rows} foot={<><b>{L('Total', 'المجموع')}</b>{" "}<span style={{
        marginInlineStart: "auto",
        display: "flex",
        gap: "28px"
      }}><span className="mono tnum">{usd(usdTotal)}</span>{" "}<span className="mono tnum dim">{num(usdTotal * RATE.value + lbpTotal)} L.L</span></span></>} />{" "}<C.InlineAlert tone='info' title={L('A session cannot be closed by one person', 'لا تُقفل الجلسة بشخص واحد')} body={L('Two counters sign a session. Once closed, a line can only be corrected by a reversing entry that stays in the history.', 'يوقّع الجلسة عدّادان. وبعد الإقفال لا يُصحَّح البند إلا بقيد عكسي يبقى في السجل.')} /></>;
}
giving.mount = host => {
  applyFinanceAccess(host);
  host.querySelectorAll('[data-rate-pop]').forEach(b => b.addEventListener('click', () => openModal({
    title: L('Rate applied', 'السعر المطبَّق'),
    body: <C.RatePopover amount={50} />
  })));
  host.querySelector('#addenv')?.addEventListener('click', () => openDrawer({
    title: L('New contribution', 'مساهمة جديدة'),
    sub: L('Session 214 · envelope entry', 'الجلسة ٢١٤ · إدخال مظروف'),
    body: <><div className="formgrid"><C.Field label={L('Envelope no.', 'رقم المظروف')} ph='0142' dir='ltr' id='envno' />{" "}<div className="formrow"><label className="label">{L('Fund', 'الصندوق')}</label>{" "}<Select>{FUNDS.map(f => <option>{L(f.name, f.ar)}</option>)}</Select></div></div>{" "}<C.PersonPicker label={L('Given by', 'المتبرّع')} id='givep' />{" "}<C.CurrencyField label={L('Amount', 'المبلغ')} value='50.00' stale={false} id='giveamt' />{" "}<C.SplitCurrency />{" "}<div className="stack" style={{
        gap: "10px"
      }}><label className="check"><input type="checkbox" id="aslira" /><span>{L('Given in lira, keep it as lira', 'أُعطي بالليرة، احفظه ليرة')}</span></label>{" "}<C.CheckRow label={L('Anonymous — record the amount, not the giver', 'مجهول — سجّل المبلغ لا المتبرّع')} /></div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<span className="t-caption dim" style={{
        marginInlineStart: "auto"
      }}>{L('Draft saved', 'حُفظت المسوّدة')}</span>{" "}<button className="btn btn-primary" data-act="env-add">{L('Save & add next', 'حفظ وإضافة التالي')}</button></>,
    onMount(el) {}
  }));
  host.querySelector('#close')?.addEventListener('click', () => openModal({
    title: L('Close counting session 214?', 'إقفال جلسة العدّ ٢١٤؟'),
    sub: L('Closing locks the lines and posts them to the fund balances. Corrections after this point need a reversing entry.', 'الإقفال يقفل البنود ويقيّدها في أرصدة الصناديق. والتصحيح بعده يحتاج قيداً عكسياً.'),
    body: <><dl className="dl"><dt>{L('Dollars', 'الدولار')}</dt><dd className="mono tnum">{usd(BATCH.lines.reduce((a, l) => a + (l.usd || 0), 0))}</dd><dt>{L('Lira', 'الليرة')}</dt><dd className="mono tnum">{num(BATCH.lines.reduce((a, l) => a + (l.lbp || 0), 0))}</dd><dt>{L('Rate applied', 'السعر المطبَّق')}</dt><dd className="mono tnum">{num(RATE.value)}</dd></dl>{" "}<label className="check" style={{
        marginTop: "16px"
      }}><input type="checkbox" id="ack2" />{" "}<span>{L('Both counters have checked the cash against this sheet.', 'راجع العدّادان النقد مقابل هذه الورقة.')}</span></label></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="ok" disabled>{L('Close session', 'إقفال الجلسة')}</button></>,
    onMount(el) {
      const c = el.querySelector('#ack2'),
        ok = el.querySelector('#ok');
      c.addEventListener('change', () => {
        ok.disabled = !c.checked;
      });
      ok.addEventListener('click', () => VERBS['batch-close'](ok));
    }
  }));
};

/* ---------------- finance ---------------- */
const FTABS = () => [['', 'Funds & budget', 'الصناديق والموازنة'], ['expenses', 'Expenses', 'المصاريف'], ['reconciliation', 'Reconciliation', 'المطابقة', BANKLINES.filter(b => !b.matched).length]];
export function finance(tab = '') {
  const totalBudget = FUNDS.reduce((a, f) => a + f.budget, 0);
  const totalActual = FUNDS.reduce((a, f) => a + f.actual, 0);
  const head = <><PageHead crumbs={[{
      label: L('Money', 'المال')
    }, {
      label: L('Finance', 'المالية')
    }]} title={L('Funds, budget and expenses', 'الصناديق والموازنة والمصاريف')} sub={L('Restricted funds stay restricted. Every line carries the currency it was paid in and the rate, if one was applied.', 'الصناديق المقيّدة تبقى مقيّدة. وكل بند يحمل عملة الدفع والسعر إن استُعمل.')} actions={<><button className="btn btn-secondary" data-act="export"><Icon name='export' size={17} />{L('Export to Excel', 'تصدير إلى Excel')}</button>{" "}<button className="btn btn-primary" data-act="exp-add"><Icon name='plus' size={17} />{L('Record expense', 'تسجيل مصروف')}</button></>} /><TabBar base='finance' items={FTABS()} active={tab} /></>;
  if (tab === 'expenses') return <>{head}<div className="tabbody"><Table cols={[{
        label: L('Date', 'التاريخ'),
        cls: 'hide-sm',
        sort: true
      }, {
        label: L('What', 'البيان'),
        sort: true
      }, {
        label: L('Fund', 'الصندوق'),
        cls: 'hide-md'
      }, {
        label: 'USD',
        cls: 'num',
        sort: true
      }, {
        label: 'L.L',
        cls: 'num hide-sm'
      }, {
        label: L('Status', 'الحالة'),
        cls: 'shrink'
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={EXPENSES.map(x => ({
        detail: <div className="grid g3" style={{
          gap: "20px"
        }}><dl className="dl"><dt>{L('Submitted by', 'قدّمه')}</dt><dd>{person(x.by) ? isAr() ? person(x.by).ar : person(x.by).lat : '—'}</dd><dt>{L('Approval limit', 'حدّ الموافقة')}</dt><dd>{x.usd > 1000 ? L('Priest', 'الكاهن') : L('Treasurer', 'أمين الصندوق')}</dd></dl>{" "}<dl className="dl"><dt>{L('Receipt', 'الإيصال')}</dt><dd>{L('Attached', 'مرفق')}</dd><dt>{L('Reimbursement', 'استرداد')}</dt><dd>{L('Not requested', 'غير مطلوب')}</dd></dl>{" "}<div><button className="btn btn-secondary btn-dense" data-act={`doc:receipt-${x.id}.pdf`}><Icon name='doc' size={15} />{L('View receipt', 'عرض الإيصال')}</button></div></div>,
        cells: [<span className="mono dim">{fmtDate(x.d)}</span>, <span className="row" style={{
          gap: "6px"
        }}><C.IconBtn ico='chevR' label={L('Expand', 'توسيع')} data-expand="" aria-expanded="false" />{" "}<b style={{
            font: "500 14px/20px var(--sans)"
          }}>{L(x.what, x.whatAr)}</b></span>, <span className="dim">{fundName(x.fund)}</span>, <span className="num">{usd(x.usd)}</span>, <span className="num dim">{num(x.usd * RATE.value)}</span>, <Status k={x.status} />, <span className="row" style={{
          gap: "6px",
          justifyContent: "flex-end"
        }}>{x.status === 'awaiting-approval' && is('priest', 'treasurer', 'super_admin', 'bishop', 'diocesan_admin', 'parish_admin') ? <button className="btn btn-primary btn-dense" data-act={`exp-approve:${x.id}`}>{L('Approve', 'موافقة')}</button> : ''}{CR.recBtn('expense', x.id)}</span>]
      }))} empty={<Empty glyph='fin' title={L('No expenses recorded', 'لا مصاريف مسجّلة')} body={L('Record the first one — a receipt photo is enough.', 'سجّل الأول — تكفي صورة الإيصال.')} action={<button className="btn btn-primary btn-dense" data-act="exp-add">{L('Record expense', 'تسجيل مصروف')}</button>} />} /></div></>;
  if (tab === 'reconciliation') return <>{head}<div className="tabbody">{(n => n ? <C.InlineAlert tone='warning' title={L(`${n} bank line${n === 1 ? ' is' : 's are'} not matched yet`, `${n} قيود مصرفية غير مطابَقة`)} body={L('Match each line to a counting session, an expense or a fee. Nothing is written until you confirm.', 'طابق كل قيد بجلسة عدّ أو مصروف أو رسم. ولا يُكتب شيء قبل تأكيدك.')} /> : <C.InlineAlert tone='success' title={L('Every bank line is matched', 'كل القيود المصرفية مطابَقة')} body={L('The books agree with the bank.', 'الدفاتر متطابقة مع المصرف.')} />)(BANKLINES.filter(b => !b.matched).length)}{" "}<div style={{
        marginTop: "16px"
      }}><Table cols={[{
          label: L('Date', 'التاريخ')
        }, {
          label: L('Bank reference', 'المرجع المصرفي')
        }, {
          label: L('Amount', 'المبلغ'),
          cls: 'num'
        }, {
          label: L('Matched to', 'مطابَق مع')
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={BANKLINES.map(b => ({
          cells: [<span className="mono dim">{fmtDate(b.at)}</span>, <span className="mono">{b.ref}</span>, <span className="num" style={css(b.amount < 0 ? 'color:var(--danger-ink)' : '')}>{usd(Math.abs(b.amount))}{b.amount < 0 ? ' −' : ''}</span>, b.matched ? <Pill label={b.matched === 'fee' ? L('Bank fee', 'رسم مصرفي') : L('Session 213', 'الجلسة ٢١٣')} tone='success' /> : <span className="dimmer">—</span>, b.matched ? '' : <button className="btn btn-secondary btn-dense" data-act={`bank-match:${b.id}`}>{L('Match', 'مطابقة')}</button>]
        }))} /></div>{" "}<div className="grid g2" style={{
        marginTop: "24px"
      }}><Panel title={L('Handled consistently', 'تُعالَج باتّساق')}><ul style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>{[L('Deposits and bank fees', 'الإيداعات والرسوم المصرفية'), L('Refunds and failed payments', 'الاسترجاعات والدفعات الفاشلة'), L('Duplicate payment notifications', 'إشعارات الدفع المكرَّر'), L('A full audit history on every change', 'سجل تدقيق كامل لكل تغيير')].map(x => <li className="row" style={{
              gap: "10px"
            }}><Icon name='check' size={16} cls='dimmer' /><span className="t-caption">{x}</span></li>)}</ul></Panel>{" "}<Panel title={L('Out of scope, on purpose', 'خارج النطاق، عن قصد')}><p className="t-body dim" style={{
            fontSize: "14px",
            lineHeight: "22px"
          }}>{L('ParishLife records giving and basic expenses. Full ledger, payroll and tax functionality belong in accounting software; an integration comes after the parish workflows are reliable.', 'يسجّل «حياة الرعية» التقدمات والمصاريف الأساسية. أمّا الدفتر الكامل والرواتب والضرائب فمكانها برامج المحاسبة؛ والتكامل بعد أن تستقرّ مسارات الرعية.')}</p></Panel></div></div></>;
  return <>{head}<div className="stats" style={{
      margin: "20px 0 24px"
    }}><Stat k={L('Budgeted this year', 'موازنة السنة')} v={usd(totalBudget)} d={`L.L ${num(totalBudget * RATE.value)}`} />{" "}<Stat k={L('Spent so far', 'المصروف حتى الآن')} v={usd(totalActual)} d={`${totalBudget ? Math.round(totalActual / totalBudget * 100) : 0}% ${L('of budget', 'من الموازنة')}`} />{" "}<Stat k={L('Awaiting approval', 'بانتظار الموافقة')} v={EXPENSES.filter(x => x.status === 'awaiting-approval').length} d={usd(EXPENSES.filter(x => x.status === 'awaiting-approval').reduce((a, x) => a + x.usd, 0))} />{" "}<Stat k={L('Unreconciled', 'غير مطابَق')} v={BANKLINES.filter(b => !b.matched).length} d={L('bank lines', 'قيود مصرفية')} /></div>{" "}<Panel title={L('Budget against actual, by fund', 'الموازنة مقابل الفعلي، حسب الصندوق')}><C.BarChart rows={FUNDS.map(f => ({
        label: L(f.name, f.ar),
        v: f.actual,
        max: f.budget
      }))} /></Panel>{" "}<div className="tabbody"><Table cols={[{
        label: L('Fund', 'الصندوق'),
        sort: true
      }, {
        label: L('Type', 'النوع'),
        cls: 'shrink hide-sm'
      }, {
        label: L('Budget', 'الموازنة'),
        cls: 'num hide-sm'
      }, {
        label: L('Actual', 'الفعلي'),
        cls: 'num',
        sort: true
      }, {
        label: L('Remaining', 'المتبقّي'),
        cls: 'num'
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={FUNDS.map(f => ({
        cells: [<b>{L(f.name, f.ar)}</b>, f.restricted ? <Pill label={L('Restricted', 'مقيّد')} tone='info' mark='lock' /> : <span className="dim">{L('General', 'عام')}</span>, <span className="num">{usd(f.budget)}</span>, <span className="num">{usd(f.actual)}</span>, <span className="num" style={css(f.budget - f.actual < 0 ? "color:var(--danger-ink)" : undefined)}>{usd(f.budget - f.actual)}</span>, CR.recBtn('fund', f.id)]
      }))} />{" "}<button className="btn btn-secondary" style={{
        marginTop: "16px"
      }} data-act="rec-new:fund"><Icon name='plus' size={17} />{L('New fund', 'صندوق جديد')}</button></div></>;
}
finance.mount = host => {
  applyFinanceAccess(host);
};