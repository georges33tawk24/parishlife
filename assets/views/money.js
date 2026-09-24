/* Module 12 — giving, funds, expenses, receipts, campaigns, reconciliation. */
import { t, isAr, num, usd, lbp, fmtDate } from '../i18n.js';
import { is } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, pill, esc, table, wireTables, empty, amount, stat,
         searchField, openDrawer, openModal, closeOverlays, toast, tabBar, avatar } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import { VERBS } from '../actions.js';
import { BATCH, FUNDS, EXPENSES, PLEDGES, RATE, CAMPAIGNS, RECURRING, RECEIPTS, BANKLINES,
         GIVING_SERIES, PAYMENT_MIX, person } from '../data.js';

const L = (en, ar) => t(en, ar);
const fundName = id => { const f = FUNDS.find(x => x.id === id); return f ? L(f.name, f.ar) : id; };
const GTABS = () => [['', 'Counting session', 'جلسة العدّ'], ['contributions', 'Contributions', 'المساهمات'],
               ['pledges', 'Pledges', 'التعهّدات', PLEDGES.length], ['recurring', 'Recurring', 'الدائمة', RECURRING.length],
               ['campaigns', 'Campaigns', 'الحملات', CAMPAIGNS.length], ['receipts', 'Receipts & statements', 'الإيصالات والكشوفات']];

export function giving(tab = '') {
  const usdTotal = BATCH.lines.reduce((a, l) => a + (l.usd || 0), 0);
  const lbpTotal = BATCH.lines.reduce((a, l) => a + (l.lbp || 0), 0);
  const head = pageHead({
    crumbs: [{ label: L('Money', 'المال') }, { label: L('Giving', 'التقدمات') }],
    title: tab ? L('Giving', 'التقدمات') : L(BATCH.ref, BATCH.refAr),
    sub: tab ? L('Funds, campaigns, pledges, recurring giving and donor history — donor details stay restricted.',
                 'الصناديق والحملات والتعهّدات والعطاء الدائم وتاريخ المتبرّعين — وتبقى تفاصيل المتبرّعين مقيّدة.')
             : `${fmtDate(BATCH.date)} · ${status('open')} · ${L('counted by Nabil Saade and Joseph Sfeir', 'عدّها نبيل سعادة وجوزيف صفير')}`,
    actions: `<button class="btn btn-secondary" data-act="print">${icon('print', 17)}${L('Print sheet', 'طباعة الورقة')}</button>
      <button class="btn btn-secondary" id="addenv">${icon('plus', 17)}${L('Add envelope', 'إضافة مظروف')}</button>
      <button class="btn btn-primary" id="close">${icon('check', 17)}${L('Close session', 'إقفال الجلسة')}</button>`
  }) + tabBar('giving', GTABS(), tab);

  if (tab === 'contributions') return head + `<div class="tabbody">
    <div class="grid g2" style="margin-bottom:20px">
      ${C.kpi({ k: L('Given this month', 'المعطى هذا الشهر'), v: usd(8420), sub: `L.L ${num(8420 * RATE.value)}`,
                delta: L('+12% vs September', '+١٢٪ عن أيلول'), spark: GIVING_SERIES })}
      ${panel(L('How people give', 'كيف يُعطي الناس'), C.donut(PAYMENT_MIX.map(p => ({ ...p, label: isAr() ? p.labelAr : p.label }))))}
    </div>
    ${table({
      pick: true,
      cols: [{ label: L('Date', 'التاريخ'), sort: true }, { label: L('Giver', 'المتبرّع') }, { label: L('Fund', 'الصندوق'), cls: 'hide-sm' },
             { label: L('Method', 'الطريقة'), cls: 'hide-md' }, { label: 'USD', cls: 'num', sort: true }, { label: '', cls: 'shrink' }],
      rows: BATCH.lines.filter(l => l.p).map(l => ({ cells: [
        `<span class="mono dim">${fmtDate(BATCH.date)}</span>`, who(person(l.p)),
        `<span class="dim">${esc(fundName(l.fund))}</span>`, `<span class="chip">${L('Envelope', 'مظروف')}</span>`,
        `<span class="num">${usd(l.usd)}</span>`,
        C.iconBtn('info', L('Rate used for this gift', 'السعر المعتمد لهذه التقدمة'), 'data-rate-pop')]}))
    })}</div>`;

  if (tab === 'pledges') return head + `<div class="tabbody">${table({
      cols: [{ label: L('Donor', 'المتبرّع') }, { label: L('Fund', 'الصندوق'), cls: 'hide-sm' },
             { label: L('Pledged', 'تعهّد'), cls: 'num' }, { label: L('Paid', 'دفع'), cls: 'num' }, { label: L('Progress', 'التقدّم') }, { label: '', cls: 'shrink' }],
      rows: PLEDGES.map(p => { const pct = p.pledged ? Math.min(100, Math.round(p.paid / p.pledged * 100)) : 0;
        return { cells: [who(person(p.p)), `<span class="dim">${esc(fundName(p.fund))}</span>`,
          `<span class="num">${usd(p.pledged)}</span>`, `<span class="num">${usd(p.paid)}</span>`,
          `<span style="display:block;min-width:130px"><span class="t-caption dim tnum">${pct}%</span>
            <span class="meter" style="margin-top:6px"><i style="width:${pct}%"></i></span></span>`, CR.recBtn('pledge', p.id)]}; }),
      empty: empty('give', L('No pledges yet', 'لا تعهّدات بعد'), L('Record what a family has promised to a fund, and what has come in.', 'سجّل ما تعهّدت به عائلة لصندوق، وما وصل منه.'))
    })}
    <button class="btn btn-secondary" style="margin-top:16px" data-act="rec-new:pledge">${icon('plus', 17)}${L('New pledge', 'تعهّد جديد')}</button></div>`;

  if (tab === 'recurring') return head + `<div class="tabbody">${table({
      cols: [{ label: L('Donor', 'المتبرّع') }, { label: L('Amount', 'المبلغ'), cls: 'num' }, { label: L('Every', 'كل') },
             { label: L('Fund', 'الصندوق'), cls: 'hide-sm' }, { label: L('Next', 'التالي') }, { label: '', cls: 'shrink' }],
      rows: RECURRING.map((r, ri) => ({ cells: [who(person(r.p)), `<span class="num">${usd(r.amount)}</span>`,
        `<span class="dim">${esc(L(r.every, r.everyAr))}</span>`, `<span class="dim">${esc(fundName(r.fund))}</span>`,
        r.paused ? pill(L('Paused', 'متوقّف'), 'warning', 'st-pause') : `<span class="mono dim">${fmtDate(r.next)}</span>`,
        `<button class="btn btn-secondary btn-dense" data-act="recurring-toggle:${ri}">${r.paused ? L('Resume', 'استئناف') : L('Pause', 'إيقاف مؤقّت')}</button>`]}))
    })}
    <p class="t-caption dim" style="margin-top:16px">${L(
      'A standing envelope is recorded when it arrives, not charged automatically. Nothing is taken from anyone without a person recording it.',
      'المظروف الدائم يُسجَّل عند وصوله ولا يُقتطع تلقائياً. ولا يُؤخذ شيء من أحد من دون أن يسجّله إنسان.')}</p></div>`;

  if (tab === 'campaigns') return head + `<div class="tabbody">
    <div class="toolbar"><button class="btn btn-secondary" data-act="rec-new:campaign" style="margin-inline-start:auto">${icon('plus', 17)}${L('New appeal', 'حملة جديدة')}</button></div>
    ${CAMPAIGNS.length ? '' : empty('give', L('No appeals running', 'لا حملات جارية'), L('Start one for a restoration, a feast or a family in need.', 'ابدأ واحدة لترميم أو عيد أو عائلة محتاجة.'))}
    <div class="grid g2">
    ${CAMPAIGNS.map(c => { const pct = c.goal ? Math.min(100, Math.round(c.raised / c.goal * 100)) : 0;
      return `<section class="panel"><div class="panel-b">
        <div class="row" style="gap:10px;align-items:flex-start"><b style="font:600 16px/22px var(--sans);flex:1;min-width:0">${esc(L(c.name, c.ar))}</b>${CR.recBtn('campaign', c.id)}</div>
        <div class="amount" style="margin-top:10px" dir="ltr"><span class="usd">${usd(c.raised)}</span>
          <span class="lbp">${L('of', 'من')} ${usd(c.goal)} · L.L ${num(c.raised * RATE.value)}</span></div>
        <span class="meter" style="margin-top:12px;height:8px"><i style="width:${pct}%"></i></span>
        <div class="row" style="gap:12px;margin-top:10px">
          <span class="t-caption dim">${pct}% · ${c.donors} ${L('donors', 'متبرّعاً')}</span>
          <span class="t-caption dim" style="margin-inline-start:auto">${L('ends', 'تنتهي')} ${fmtDate(c.ends)}</span></div>
        <div class="row" style="gap:6px;margin-top:14px">
          <button class="btn btn-secondary btn-dense" style="flex:1" data-go="giving/contributions">${L('Donors', 'المتبرّعون')}</button>
          <button class="btn btn-secondary btn-dense" style="flex:1" data-act="compose:all">${L('Appeal', 'نداء')}</button></div>
      </div></section>`; }).join('')}</div></div>`;

  if (tab === 'receipts') return head + `<div style="margin-top:20px" class="splitview">
    <div>${panel(L('Receipts issued', 'الإيصالات الصادرة'), table({
      cols: [{ label: L('No.', 'الرقم'), cls: 'shrink' }, { label: L('Donor', 'المتبرّع') },
             { label: L('Amount', 'المبلغ'), cls: 'num' }, { label: L('Sent', 'أُرسل'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows: RECEIPTS.map(r => ({ cells: [`<span class="mono">${r.no}</span>`, who(person(r.p)),
        `<span class="num">${usd(r.amount)}</span>`,
        r.sent === 'none' ? pill(L('Not sent', 'لم يُرسل'), 'warning') : `<span class="chip">${esc(r.sent)}</span>`,
        `<button class="btn btn-secondary btn-dense" data-act="receipt:${r.no}|${r.p}|${r.amount}">${L('Open', 'فتح')}</button>`]}))
    }), { tight: true })}</div>
    <div class="sidecol">
      ${panel(L('Annual statements', 'الكشوفات السنوية'), `
        <p class="t-body dim" style="font-size:14px">${L(
          'A statement lists what a household gave in a year, in both currencies, at the rate that applied to each gift.',
          'يُظهر الكشف ما أعطته العائلة في السنة، بالعملتين، وبالسعر الذي طُبّق على كل تقدمة.')}</p>
        ${C.inlineAlert('warning', L('Not a tax document', 'ليس مستنداً ضريبياً'),
          L('ParishLife does not assume a parish receipt qualifies as a tax document in any jurisdiction.',
            'لا يفترض «حياة الرعية» أن إيصال الرعية يصلح مستنداً ضريبياً في أي بلد.'))}
        <button class="btn btn-primary" style="width:100%;margin-top:12px" data-act="statements-all">${icon('doc', 17)}${L('Generate for every household', 'إصدار لكل العائلات')}</button>`)}
    </div></div>`;

  /* counting session */
  const rows = BATCH.lines.map((l, li) => ({ cells: [
    l.env ? `<span class="mono">${l.env}</span>` : `<span class="dimmer">—</span>`,
    l.p ? who(person(l.p)) : `<span class="dim">${esc(L(l.note, l.noteAr || l.note))}</span>`,
    `<span class="dim">${esc(fundName(l.fund))}</span>`,
    l.usd ? `<span class="num">${usd(l.usd)}</span>` : `<span class="num dimmer">—</span>`,
    l.usd ? `<span class="num dim">${num(l.usd * RATE.value)}</span>` : `<span class="num">${num(l.lbp)}</span>`,
    `<span class="rowacts">${C.iconBtn('edit', L('Edit', 'تعديل'), `data-act="line-edit:${li}"`)}${C.iconBtn('trash', L('Reverse', 'عكس'), `data-act="line-reverse:${li}"`)}</span>`
  ]}));

  return head + `<div class="grid g2" style="margin:20px 0 24px;align-items:start">
      ${panel(L('Counted so far', 'المعدود حتى الآن'), `
        ${amount(usdTotal, { showRate: true, cls: 'amount-lg' })}
        <div class="divider"></div>
        <dl class="dl">
          <dt>${L('Given in dollars', 'مُعطى بالدولار')}</dt><dd class="mono tnum">${usd(usdTotal)}</dd>
          <dt>${L('Given in lira', 'مُعطى بالليرة')}</dt><dd class="mono tnum">${num(lbpTotal)}</dd>
          <dt>${L('Envelopes', 'المظاريف')}</dt><dd class="tnum">${BATCH.lines.filter(l => l.env).length}</dd>
          <dt>${L('Unattributed', 'غير مسمّى')}</dt><dd class="tnum">${BATCH.lines.filter(l => !l.env).length}</dd></dl>
        <p class="t-caption dim" style="margin-top:14px">${L(
          'Lira given as lira is kept as lira. It sits next to the dollar total for reading, never silently added into it.',
          'ما يُعطى بالليرة يبقى ليرة. يُعرض إلى جانب مجموع الدولار للقراءة، ولا يُضاف إليه بصمت.')}</p>`)}
      ${panel(L('Second count', 'العدّ الثاني'), `
        ${C.inlineAlert('success', L('Second person has verified this batch', 'تحقّق شخص ثانٍ من هذه الدفعة'),
          L('Rita Nassar counted the same totals at 19:32. Ready to close.', 'عدّت ريتا نصّار المجاميع نفسها الساعة ١٩:٣٢. جاهزة للإقفال.'))}
        <div class="divider"></div>
        <div class="row" style="gap:10px">${avatar(person('p15'), 'avatar-sm')}${avatar(person('p7'), 'avatar-sm')}
          <span class="t-caption dim">${L('Two counters signed in', 'عدّادان مسجّلان')}</span></div>`)}
    </div>
    ${table({
      cols: [{ label: L('Envelope', 'المظروف'), cls: 'shrink' }, { label: L('Giver', 'المتبرّع') },
             { label: L('Fund', 'الصندوق'), cls: 'hide-sm' }, { label: 'USD', cls: 'num' },
             { label: 'L.L', cls: 'num hide-sm' }, { label: '', cls: 'shrink' }],
      rows,
      foot: `<b>${L('Total', 'المجموع')}</b>
        <span style="margin-inline-start:auto;display:flex;gap:28px">
          <span class="mono tnum">${usd(usdTotal)}</span>
          <span class="mono tnum dim">${num(usdTotal * RATE.value + lbpTotal)} L.L</span></span>`
    })}
    ${C.inlineAlert('info', L('A session cannot be closed by one person', 'لا تُقفل الجلسة بشخص واحد'),
      L('Two counters sign a session. Once closed, a line can only be corrected by a reversing entry that stays in the history.',
        'يوقّع الجلسة عدّادان. وبعد الإقفال لا يُصحَّح البند إلا بقيد عكسي يبقى في السجل.'))}`;
}

giving.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelectorAll('[data-rate-pop]').forEach(b => b.addEventListener('click', () =>
    openModal({ title: L('Rate applied', 'السعر المطبَّق'), body: C.ratePopover(50) })));
  host.querySelector('#addenv')?.addEventListener('click', () => openDrawer({
    title: L('New contribution', 'مساهمة جديدة'),
    sub: L('Session 214 · envelope entry', 'الجلسة ٢١٤ · إدخال مظروف'),
    body: `<div class="formgrid">
        ${C.field({ label: L('Envelope no.', 'رقم المظروف'), ph: '0142', dir: 'ltr', id: 'envno' })}
        <div class="formrow"><label class="label">${L('Fund', 'الصندوق')}</label>
          <select class="select">${FUNDS.map(f => `<option>${esc(L(f.name, f.ar))}</option>`).join('')}</select></div>
      </div>
      ${C.personPicker(L('Given by', 'المتبرّع'), 'givep')}
      ${C.currencyField({ label: L('Amount', 'المبلغ'), value: '50.00', stale: false, id: 'giveamt' })}
      ${C.splitCurrency()}
      <div class="stack" style="gap:10px">
        <label class="check"><input type="checkbox" id="aslira"><span>${L('Given in lira, keep it as lira', 'أُعطي بالليرة، احفظه ليرة')}</span></label>
        ${C.checkRow(L('Anonymous — record the amount, not the giver', 'مجهول — سجّل المبلغ لا المتبرّع'))}
      </div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <span class="t-caption dim" style="margin-inline-start:auto">${L('Draft saved', 'حُفظت المسوّدة')}</span>
      <button class="btn btn-primary" data-act="env-add">${L('Save & add next', 'حفظ وإضافة التالي')}</button>`,
    onMount(el) { C.wire(el); /* wired by data-act */ }
  }));
  host.querySelector('#close')?.addEventListener('click', () => openModal({
    title: L('Close counting session 214?', 'إقفال جلسة العدّ ٢١٤؟'),
    sub: L('Closing locks the lines and posts them to the fund balances. Corrections after this point need a reversing entry.',
           'الإقفال يقفل البنود ويقيّدها في أرصدة الصناديق. والتصحيح بعده يحتاج قيداً عكسياً.'),
    body: `<dl class="dl">
        <dt>${L('Dollars', 'الدولار')}</dt><dd class="mono tnum">${usd(BATCH.lines.reduce((a, l) => a + (l.usd || 0), 0))}</dd>
        <dt>${L('Lira', 'الليرة')}</dt><dd class="mono tnum">${num(BATCH.lines.reduce((a, l) => a + (l.lbp || 0), 0))}</dd>
        <dt>${L('Rate applied', 'السعر المطبَّق')}</dt><dd class="mono tnum">${num(RATE.value)}</dd></dl>
      <label class="check" style="margin-top:16px"><input type="checkbox" id="ack2">
        <span>${L('Both counters have checked the cash against this sheet.', 'راجع العدّادان النقد مقابل هذه الورقة.')}</span></label>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="ok" disabled>${L('Close session', 'إقفال الجلسة')}</button>`,
    onMount(el) {
      const c = el.querySelector('#ack2'), ok = el.querySelector('#ok');
      c.addEventListener('change', () => { ok.disabled = !c.checked; });
      ok.addEventListener('click', () => VERBS['batch-close'](ok));
    }
  }));
};

/* ---------------- finance ---------------- */
const FTABS = () => [['', 'Funds & budget', 'الصناديق والموازنة'], ['expenses', 'Expenses', 'المصاريف'],
               ['reconciliation', 'Reconciliation', 'المطابقة', BANKLINES.filter(b => !b.matched).length]];

export function finance(tab = '') {
  const totalBudget = FUNDS.reduce((a, f) => a + f.budget, 0);
  const totalActual = FUNDS.reduce((a, f) => a + f.actual, 0);
  const head = pageHead({
    crumbs: [{ label: L('Money', 'المال') }, { label: L('Finance', 'المالية') }],
    title: L('Funds, budget and expenses', 'الصناديق والموازنة والمصاريف'),
    sub: L('Restricted funds stay restricted. Every line carries the currency it was paid in and the rate, if one was applied.',
           'الصناديق المقيّدة تبقى مقيّدة. وكل بند يحمل عملة الدفع والسعر إن استُعمل.'),
    actions: `<button class="btn btn-secondary" data-act="export">${icon('export', 17)}${L('Export to Excel', 'تصدير إلى Excel')}</button>
      <button class="btn btn-primary" data-act="exp-add">${icon('plus', 17)}${L('Record expense', 'تسجيل مصروف')}</button>`
  }) + tabBar('finance', FTABS(), tab);

  if (tab === 'expenses') return head + `<div class="tabbody">${table({
      cols: [{ label: L('Date', 'التاريخ'), cls: 'hide-sm', sort: true }, { label: L('What', 'البيان'), sort: true },
             { label: L('Fund', 'الصندوق'), cls: 'hide-md' }, { label: 'USD', cls: 'num', sort: true },
             { label: 'L.L', cls: 'num hide-sm' }, { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows: EXPENSES.map(x => ({
        detail: `<div class="grid g3" style="gap:20px">
          <dl class="dl"><dt>${L('Submitted by', 'قدّمه')}</dt><dd>${esc(person(x.by) ? (isAr() ? person(x.by).ar : person(x.by).lat) : '—')}</dd>
            <dt>${L('Approval limit', 'حدّ الموافقة')}</dt><dd>${x.usd > 1000 ? L('Priest', 'الكاهن') : L('Treasurer', 'أمين الصندوق')}</dd></dl>
          <dl class="dl"><dt>${L('Receipt', 'الإيصال')}</dt><dd>${L('Attached', 'مرفق')}</dd>
            <dt>${L('Reimbursement', 'استرداد')}</dt><dd>${L('Not requested', 'غير مطلوب')}</dd></dl>
          <div><button class="btn btn-secondary btn-dense" data-act="doc:receipt-${x.id}.pdf">${icon('doc', 15)}${L('View receipt', 'عرض الإيصال')}</button></div></div>`,
        cells: [
        `<span class="mono dim">${fmtDate(x.d)}</span>`,
        `<span class="row" style="gap:6px">${C.iconBtn('chevR', L('Expand', 'توسيع'), 'data-expand aria-expanded="false"')}
          <b style="font:500 14px/20px var(--sans)">${esc(L(x.what, x.whatAr))}</b></span>`,
        `<span class="dim">${esc(fundName(x.fund))}</span>`,
        `<span class="num">${usd(x.usd)}</span>`, `<span class="num dim">${num(x.usd * RATE.value)}</span>`,
        status(x.status),
        `<span class="row" style="gap:6px;justify-content:flex-end">${x.status === 'awaiting-approval' && is('priest', 'treasurer')
          ? `<button class="btn btn-primary btn-dense" data-act="exp-approve:${x.id}">${L('Approve', 'موافقة')}</button>` : ''}${CR.recBtn('expense', x.id)}</span>`
      ]})),
      empty: empty('fin', L('No expenses recorded', 'لا مصاريف مسجّلة'), L('Record the first one — a receipt photo is enough.', 'سجّل الأول — تكفي صورة الإيصال.'),
        `<button class="btn btn-primary btn-dense" data-act="exp-add">${L('Record expense', 'تسجيل مصروف')}</button>`)
    })}</div>`;

  if (tab === 'reconciliation') return head + `<div class="tabbody">
    ${(n => n ? C.inlineAlert('warning', L(`${n} bank line${n === 1 ? ' is' : 's are'} not matched yet`, `${n} قيود مصرفية غير مطابَقة`),
      L('Match each line to a counting session, an expense or a fee. Nothing is written until you confirm.',
        'طابق كل قيد بجلسة عدّ أو مصروف أو رسم. ولا يُكتب شيء قبل تأكيدك.'))
      : C.inlineAlert('success', L('Every bank line is matched', 'كل القيود المصرفية مطابَقة'), L('The books agree with the bank.', 'الدفاتر متطابقة مع المصرف.')))(BANKLINES.filter(b => !b.matched).length)}
    <div style="margin-top:16px">${table({
      cols: [{ label: L('Date', 'التاريخ') }, { label: L('Bank reference', 'المرجع المصرفي') },
             { label: L('Amount', 'المبلغ'), cls: 'num' }, { label: L('Matched to', 'مطابَق مع') }, { label: '', cls: 'shrink' }],
      rows: BANKLINES.map(b => ({ cells: [
        `<span class="mono dim">${fmtDate(b.at)}</span>`, `<span class="mono">${b.ref}</span>`,
        `<span class="num" style="${b.amount < 0 ? 'color:var(--danger-ink)' : ''}">${usd(Math.abs(b.amount))}${b.amount < 0 ? ' −' : ''}</span>`,
        b.matched ? pill(b.matched === 'fee' ? L('Bank fee', 'رسم مصرفي') : L('Session 213', 'الجلسة ٢١٣'), 'success')
                  : `<span class="dimmer">—</span>`,
        b.matched ? '' : `<button class="btn btn-secondary btn-dense" data-act="bank-match:${b.id}">${L('Match', 'مطابقة')}</button>`]}))
    })}</div>
    <div class="grid g2" style="margin-top:24px">
      ${panel(L('Handled consistently', 'تُعالَج باتّساق'), `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px">
        ${[L('Deposits and bank fees', 'الإيداعات والرسوم المصرفية'), L('Refunds and failed payments', 'الاسترجاعات والدفعات الفاشلة'),
           L('Duplicate payment notifications', 'إشعارات الدفع المكرَّر'), L('A full audit history on every change', 'سجل تدقيق كامل لكل تغيير')]
          .map(x => `<li class="row" style="gap:10px">${icon('check', 16, 'dimmer')}<span class="t-caption">${esc(x)}</span></li>`).join('')}</ul>`)}
      ${panel(L('Out of scope, on purpose', 'خارج النطاق، عن قصد'), `<p class="t-body dim" style="font-size:14px;line-height:22px">${L(
        'ParishLife records giving and basic expenses. Full ledger, payroll and tax functionality belong in accounting software; an integration comes after the parish workflows are reliable.',
        'يسجّل «حياة الرعية» التقدمات والمصاريف الأساسية. أمّا الدفتر الكامل والرواتب والضرائب فمكانها برامج المحاسبة؛ والتكامل بعد أن تستقرّ مسارات الرعية.')}</p>`)}
    </div></div>`;

  return head + `<div class="stats" style="margin:20px 0 24px">
      ${stat(L('Budgeted this year', 'موازنة السنة'), usd(totalBudget), `L.L ${num(totalBudget * RATE.value)}`)}
      ${stat(L('Spent so far', 'المصروف حتى الآن'), usd(totalActual), `${totalBudget ? Math.round(totalActual / totalBudget * 100) : 0}% ${L('of budget', 'من الموازنة')}`)}
      ${stat(L('Awaiting approval', 'بانتظار الموافقة'), EXPENSES.filter(x => x.status === 'awaiting-approval').length,
             usd(EXPENSES.filter(x => x.status === 'awaiting-approval').reduce((a, x) => a + x.usd, 0)))}
      ${stat(L('Unreconciled', 'غير مطابَق'), BANKLINES.filter(b => !b.matched).length, L('bank lines', 'قيود مصرفية'))}
    </div>
    ${panel(L('Budget against actual, by fund', 'الموازنة مقابل الفعلي، حسب الصندوق'),
      C.barChart(FUNDS.map(f => ({ label: L(f.name, f.ar), v: f.actual, max: f.budget }))))}
    <div class="tabbody">${table({
      cols: [{ label: L('Fund', 'الصندوق'), sort: true }, { label: L('Type', 'النوع'), cls: 'shrink hide-sm' },
             { label: L('Budget', 'الموازنة'), cls: 'num hide-sm' }, { label: L('Actual', 'الفعلي'), cls: 'num', sort: true },
             { label: L('Remaining', 'المتبقّي'), cls: 'num' }, { label: '', cls: 'shrink' }],
      rows: FUNDS.map(f => ({ cells: [
        `<b>${esc(L(f.name, f.ar))}</b>`,
        f.restricted ? pill(L('Restricted', 'مقيّد'), 'info', 'lock') : `<span class="dim">${L('General', 'عام')}</span>`,
        `<span class="num">${usd(f.budget)}</span>`, `<span class="num">${usd(f.actual)}</span>`,
        `<span class="num" ${f.budget - f.actual < 0 ? 'style="color:var(--danger-ink)"' : ''}>${usd(f.budget - f.actual)}</span>`, CR.recBtn('fund', f.id)]}))
    })}
    <button class="btn btn-secondary" style="margin-top:16px" data-act="rec-new:fund">${icon('plus', 17)}${L('New fund', 'صندوق جديد')}</button></div>`;
}

finance.mount = host => {
  C.wire(host); wireTables(host);

};
