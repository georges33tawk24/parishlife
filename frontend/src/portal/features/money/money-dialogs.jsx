/* Money documents and counted-line corrections: a giver's yearly statement (one person, or every giver),
   and editing or removing a line of the open counting session.
   Main functions: statement (a person's statement as a download), statementFromPage (the giver and year
   chosen on the Receipts page), statementsAll, lineEdit, lineReverse.
   A statement comes from ParishLife.Api (finance/statements): every gift in the currency it was given
   in. It is a record of gifts, not a tax receipt, and there is no exchange rate in it. */
import { Fragment } from 'react';
import { markup } from '../../ui/html.js';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { toast, openModal, closeOverlays } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { session } from '../../model/api.js';
import { statement as fetchStatement } from '../../model/modules/finance.js';
import { download } from '../../shell/actions.jsx';
import { nameOf, ok, refresh, val } from '../../shared/dialog-helpers.jsx';
import { fmt, amounts, fundName } from './money-shared.jsx';

const L = (en, ar) => t(en, ar);
const parish = () => session.parishes.find(p => p.id === session.parishId);

const docShell = (
  title,
  inner
) => `<!doctype html><html lang="${isAr() ? 'ar' : 'en'}" dir="${isAr() ? 'rtl' : 'ltr'}"><head>
  <meta charset="utf-8"><title>${title}</title>
  <style>body{font:14px/1.6 Inter,system-ui,sans-serif;color:#233B32;background:#FFFFFF;margin:0;padding:32px}
  .page{max-width:720px;margin:0 auto 24px;background:#FFFFFF;border:1px solid #EDF0E8;padding:40px;page-break-after:always}
  h1{font-size:20px;margin:0 0 4px} .muted{color:#233B32} table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{padding:8px 10px;border-bottom:1px solid #EDF0E8;text-align:start} th{background:#F7F7F2;font-size:11px;
  text-transform:uppercase;letter-spacing:.06em} .num{text-align:end;font-family:ui-monospace,monospace}
  .rule{border-top:2px solid #233B32;margin:14px 0} @media print{body{background:#FFFFFF;padding:0}.page{border:0}}</style>
  </head><body>${markup(inner)}</body></html>`;

/* One giver's year, as the API returned it. */
function statementHTML(result, name) {
  const gifts = result.contributions || [];
  return (
    <div className="page">
      <h1>
        {L('Giving statement', 'كشف التقدمات')} {result.year}
      </h1>{' '}
      <p className="muted">
        {name || L('Household', 'عائلة')} · {D.PARISH.name}
      </p>
      <div className="rule" />{' '}
      <table>
        <thead>
          <tr>
            <th>{L('Date', 'التاريخ')}</th>
            <th>{L('Fund', 'الصندوق')}</th>
            <th>{L('Method', 'الطريقة')}</th>
            <th className="num">{L('Amount', 'المبلغ')}</th>
          </tr>
        </thead>
        <tbody>
          {gifts.map((g, i) => (
            <tr key={i}>
              <td>{fmtDate(g.receivedOn)}</td>
              <td>{fundName(g.fundId)}</td>
              <td>{g.method}</td>
              <td className="num">
                {fmt(g.amount, g.currency)}
                {g.status === 'Reversed'
                  ? ` (${L('reversed', 'معكوسة')})`
                  : g.status === 'Reversal'
                    ? ` (${L('reversal', 'قيد عكسي')})`
                    : ''}
              </td>
            </tr>
          ))}
          <tr>
            <th colSpan="3">{L('Total', 'المجموع')}</th>
            <th className="num">{amounts(result.totals)}</th>
          </tr>
        </tbody>
      </table>{' '}
      <p className="muted" style={{ marginTop: '18px', fontSize: '12px' }}>
        {result.notice}
      </p>
    </div>
  );
}

async function loadStatement(key, year) {
  return fetchStatement(parish(), { ...key, year });
}

/* A person's statement for a year, as a download. */
export async function statement(pid, year = new Date().getFullYear()) {
  try {
    const result = await loadStatement({ personId: pid }, year);
    const p = D.person(pid);
    download(
      `statement-${year}-${(p?.lat || 'giver').toLowerCase().replace(/\s+/g, '-')}.html`,
      docShell('Statement', statementHTML(result, nameOf(p))),
      'text/html'
    );
    ok(L('Statement downloaded', 'نُزّل الكشف'), `${nameOf(p)} · ${year}`);
  } catch (error) {
    toast(L('No statement', 'لا كشف'), error.message, 'danger');
  }
}

/* The giver and year chosen on the Receipts page. */
export function statementFromPage(host) {
  const pid = host.querySelector('#stmtp')?.dataset.pid;
  const year = parseInt(host.querySelector('#stmty')?.value, 10);
  if (!pid || !(year > 1900)) return toast(L('Choose a giver and a year', 'اختر متبرّعاً وسنة'), '', 'warning');
  return statement(pid, year);
}

/* Every giver who has a gift in the year: one API statement each, in one file. */
export function statementsAll() {
  const year = parseInt(document.querySelector('#stmty')?.value, 10) || new Date().getFullYear();
  const givers = [
    ...new Map(
      D.CONTRIBUTIONS.filter(c => !c.anonymous && (c.p || c.hh) && (c.date || '').startsWith(String(year))).map(c => [
        c.p ? 'p:' + c.p : 'h:' + c.hh,
        c.p ? { personId: c.p } : { householdId: c.hh }
      ])
    ).values()
  ];
  if (!givers.length)
    return toast(
      L('No gifts to list', 'لا تقدمات'),
      L(`No attributed gifts in ${year}.`, `لا تقدمات مسنَدة في ${year}.`),
      'warning'
    );
  openModal({
    title: L('Generating statements', 'إصدار الكشوفات'),
    sub: L(
      `One page per giver for ${year}, from the gifts ParishLife recorded.`,
      `صفحة لكل متبرّع لسنة ${year}، من التقدمات المسجّلة في «حياة الرعية».`
    ),
    body: (
      <>
        <div className="row" style={{ gap: '10px' }}>
          <span className="spinner" />
          <span className="t-ui" id="sgtext">
            0 / {givers.length}
          </span>
        </div>{' '}
        <span className="progress" style={{ marginTop: '12px' }}>
          <i id="sgbar" style={{ width: '0%' }} />
        </span>
      </>
    ),
    async onMount(el) {
      const text = el.querySelector('#sgtext'),
        bar = el.querySelector('#sgbar');
      const pages = [];
      try {
        for (const key of givers) {
          if (!text.isConnected) return; // closing the dialog cancels the run
          const result = await loadStatement(key, year);
          pages.push(statementHTML(result, key.personId ? nameOf(D.person(key.personId)) : ''));
          text.textContent = `${pages.length} / ${givers.length}`;
          bar.style.width = `${Math.round((pages.length / givers.length) * 100)}%`;
        }
        download(
          `statements-${year}.html`,
          docShell(
            'Statements ' + year,
            pages.map((page, i) => <Fragment key={i}>{page}</Fragment>)
          ),
          'text/html'
        );
        closeOverlays();
        ok(L('Statements ready', 'الكشوفات جاهزة'), `${pages.length} · statements-${year}.html`);
      } catch (error) {
        closeOverlays();
        toast(L('Statements stopped', 'توقّف إصدار الكشوفات'), error.message, 'danger');
      }
    }
  });
}

/* ---------- the open counting session's lines ---------- */
const setAmount = (line, value) => {
  line.amount = value;
  delete line.usd;
  delete line.lbp;
  if (line.currency === 'USD') line.usd = value;
  if (line.currency === 'LBP') line.lbp = value;
};

export function lineEdit(i) {
  const l = D.BATCH.lines[+i];
  if (!l) return;
  openModal({
    title: L('Edit this line', 'تعديل هذا البند'),
    sub: l.env ? <span className="mono">{l.env}</span> : L('Unattributed', 'غير مسمّى'),
    body: <C.Field label={`${L('Amount', 'المبلغ')} (${l.currency})`} type="number" value={l.amount} id="le_amt" />,
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="le_go" style={{ marginInlineStart: 'auto' }}>
          {L('Save', 'حفظ')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#le_go').addEventListener('click', () => {
        const before = { ...l },
          v = Math.round(parseFloat(val(el, '#le_amt').replace(/,/g, '')) * 100) / 100;
        if (!(v > 0)) return el.querySelector('#le_amt').focus();
        setAmount(l, v);
        closeOverlays();
        refresh(); // saves the lines; a counted session is edited until it is verified and closed
        ok(L('Line corrected', 'صُحّح البند'), fmt(v, l.currency), {
          action: {
            label: L('Undo', 'تراجع'),
            fn: () => {
              Object.assign(l, before);
              refresh();
            }
          }
        });
      });
    }
  });
}

export function lineReverse(i) {
  const lines = D.BATCH.lines;
  const [l] = lines.splice(+i, 1);
  if (!l) return;
  refresh();
  toast(
    L('Line removed', 'أُزيل البند'),
    L(
      'Lines can be changed until the session is verified and closed.',
      'يمكن تغيير البنود حتى يُتحقَّق من الجلسة وتُقفل.'
    ),
    'warning',
    {
      action: {
        label: L('Undo', 'تراجع'),
        fn: () => {
          lines.splice(+i, 0, l);
          refresh();
        }
      }
    }
  );
}
