/* Money documents and corrections: receipts and giving statements, and editing or reversing a
   counted line. */
import { Fragment } from 'react';
import { markup } from '../../ui/html.js';
import { t, isAr, num, usd, fmtDate } from '../../../lib/i18n.js';
import { Icon, toast, openDrawer, openModal, closeOverlays } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { download } from '../../shell/actions.jsx';
import { nameOf, ok, refresh, today, val } from '../../shared/dialog-helpers.jsx';
import { share } from '../../shared/dialogs.jsx';

const L = (en, ar) => t(en, ar);

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

function receiptHTML(no, p, amount, at) {
  return (
    <div className="page">
      <h1>
        {L('Receipt', 'إيصال')} {no}
      </h1>{' '}
      <p className="muted">
        {L(D.PARISH.name, D.PARISH.nameAr)} · {L(D.PARISH.eparchy, D.PARISH.eparchyAr)}
      </p>
      <div className="rule" />{' '}
      <table>
        <tr>
          <th>{L('Received from', 'استُلم من')}</th>
          <td>{p ? p.ar + ' · ' + p.lat : L('Anonymous', 'مجهول')}</td>
        </tr>
        <tr>
          <th>{L('Date', 'التاريخ')}</th>
          <td>{fmtDate(at)}</td>
        </tr>
        <tr>
          <th>USD</th>
          <td className="num">{usd(amount)}</td>
        </tr>
        <tr>
          <th>L.L</th>
          <td className="num">
            {num(amount * D.RATE.value)} {L('at', 'على سعر')} {num(D.RATE.value)}
          </td>
        </tr>
      </table>{' '}
      <p className="muted" style={{ marginTop: '18px', fontSize: '12px' }}>
        {L('A record of a gift to the parish. Not a tax document.', 'سجلّ تقدمة للرعية. ليس مستنداً ضريبياً.')}
      </p>
    </div>
  );
}

export function receipt(no, pid, amount, at = today) {
  const p = D.person(pid);
  openDrawer({
    title: L('Receipt', 'إيصال') + ' ' + no,
    sub: `${nameOf(p) || L('Anonymous', 'مجهول')} · ${usd(amount)}`,
    body: (
      <div className="a4frame">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            className="a4"
            style={{
              aspectRatio: 'auto',
              maxWidth: '380px',
              padding: '28px',
              alignItems: 'stretch',
              textAlign: 'start'
            }}
          >
            <div className="row" style={{ gap: '10px' }}>
              <span className="seal-lg" style={{ width: '36px', height: '36px', margin: 0 }} aria-hidden="true">
                <Icon name="cross" size={18} />
              </span>{' '}
              <div>
                <b style={{ font: '600 14px/18px var(--sans)' }}>{L(D.PARISH.name, D.PARISH.nameAr)}</b>{' '}
                <div className="t-caption dim">
                  {L('Receipt', 'إيصال')} <span className="mono">{no}</span>
                </div>
              </div>
            </div>{' '}
            <div className="divider" />{' '}
            <dl className="dl" style={{ fontSize: '13px' }}>
              <dt>{L('Received from', 'استُلم من')}</dt>
              <dd>{nameOf(p) || L('Anonymous', 'مجهول')}</dd>
              <dt>{L('Date', 'التاريخ')}</dt>
              <dd className="mono">{fmtDate(at)}</dd>
            </dl>{' '}
            <div className="divider" />{' '}
            <div className="amount" dir="ltr">
              <span className="usd">{usd(amount)}</span> <span className="lbp">L.L {num(amount * D.RATE.value)}</span>{' '}
              <span className="rate">
                at {num(D.RATE.value)} · {fmtDate(D.RATE.setOn)}
              </span>
            </div>{' '}
            <p className="t-caption dim" style={{ marginTop: '16px' }}>
              {L('A record of a gift to the parish. Not a tax document.', 'سجلّ تقدمة للرعية. ليس مستنداً ضريبياً.')}
            </p>
          </div>
        </div>
      </div>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-secondary" id="rcshare">
          <Icon name="msg" size={16} />
          {L('Send', 'إرسال')}
        </button>{' '}
        <button className="btn btn-secondary" id="rcprint">
          <Icon name="print" size={16} />
          {L('Print', 'طباعة')}
        </button>{' '}
        <button className="btn btn-primary" id="rcdl" style={{ marginInlineStart: 'auto' }}>
          <Icon name="export" size={16} />
          {L('Download', 'تنزيل')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#rcprint').addEventListener('click', () => {
        closeOverlays();
        setTimeout(() => window.print(), 250);
      });
      el.querySelector('#rcdl').addEventListener('click', () => {
        download(`receipt-${no}.html`, docShell('Receipt ' + no, receiptHTML(no, p, amount, at)), 'text/html');
        ok(L('Receipt downloaded', 'نُزّل الإيصال'), `receipt-${no}.html`);
      });
      el.querySelector('#rcshare').addEventListener('click', () => {
        closeOverlays();
        share({
          title: L('Receipt', 'إيصال') + ' ' + no,
          text: L('Your receipt from Saint Elias', 'إيصالك من مار الياس')
        });
      });
    }
  });
}

function statementRows(pid) {
  return D.BATCH.lines.filter(line => line.p === pid);
}

function statementHTML(pid) {
  const p = D.person(pid),
    rows = statementRows(pid),
    totalUsd = rows.reduce((a, r) => a + (r.usd || 0), 0),
    totalLbp = rows.reduce((a, r) => a + (r.lbp || 0), 0);
  return (
    <div className="page">
      <h1>{L('Current counting-session statement', 'كشف جلسة العدّ الحالية')}</h1>{' '}
      <p className="muted">
        {p ? p.lat + ' · ' + p.ar : ''} · {L(D.PARISH.name, D.PARISH.nameAr)} · {D.BATCH.date}
      </p>
      <div className="rule" />{' '}
      <table>
        <thead>
          <tr>
            <th>{L('Fund', 'الصندوق')}</th>
            <th className="num">USD</th>
            <th className="num">L.L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const f = D.FUNDS.find(x => x.id === r.fund);
            return (
              <tr key={i}>
                <td>{f ? L(f.name, f.ar) : r.fund}</td>
                <td className="num">{r.usd ? usd(r.usd) : '—'}</td>
                <td className="num">{r.lbp ? num(r.lbp) : '—'}</td>
              </tr>
            );
          })}
          <tr>
            <th>{L('Total', 'المجموع')}</th>
            <th className="num">{usd(totalUsd)}</th>
            <th className="num">{num(totalLbp)}</th>
          </tr>
        </tbody>
      </table>{' '}
      <p className="muted" style={{ marginTop: '18px', fontSize: '12px' }}>
        {L(
          'Only recorded gifts from this counting session are shown. Not a full-year or tax statement.',
          'تظهر فقط التقدمات المسجّلة في جلسة العدّ الحالية. ليس كشف سنة كاملة ولا مستنداً ضريبياً.'
        )}
      </p>
    </div>
  );
}

export function statement(pid) {
  const p = D.person(pid);
  download(
    `statement-${D.BATCH.id}-${(p?.lat || 'household').toLowerCase().replace(/\s+/g, '-')}.html`,
    docShell('Statement', statementHTML(pid)),
    'text/html'
  );
  ok(L('Statement downloaded', 'نُزّل الكشف'), `${nameOf(p)} · ${D.BATCH.date}`);
}

export function statementsAll() {
  const heads = D.HOUSEHOLDS.map(h => h.head);
  let n = 0;
  openModal({
    title: L('Generating statements', 'إصدار الكشوفات'),
    sub: L(
      'One page per household contact, showing only their recorded gifts in the current counting session.',
      'صفحة لكل مسؤول عائلة تعرض فقط تقدماته المسجّلة في جلسة العدّ الحالية.'
    ),
    body: (
      <>
        <div className="row" style={{ gap: '10px' }}>
          <span className="spinner" />
          <span className="t-ui" id="sgtext">
            0 / {heads.length}
          </span>
        </div>{' '}
        <span className="progress" style={{ marginTop: '12px' }}>
          <i id="sgbar" style={{ width: '0%' }} />
        </span>
      </>
    ),
    onMount(el) {
      const text = el.querySelector('#sgtext'),
        bar = el.querySelector('#sgbar');
      const tick = setInterval(() => {
        /* closing the dialog cancels the run — nothing half-generated is downloaded */
        if (!text.isConnected) return clearInterval(tick);
        n += 1;
        text.textContent = `${n} / ${heads.length}`;
        bar.style.width = `${Math.round((n / heads.length) * 100)}%`;
        if (n >= heads.length) {
          clearInterval(tick);
          download(
            'statements-2026-saint-elias.html',
            docShell(
              'Statements 2026',
              heads.map((item, i, all) => <Fragment key={i}>{statementHTML(item, i, all)}</Fragment>)
            ),
            'text/html'
          );
          closeOverlays();
          ok(
            L('Statements ready', 'الكشوفات جاهزة'),
            `${heads.length} ${L('households', 'عائلات')} · statements-2026-saint-elias.html`
          );
        }
      }, 260);
    }
  });
}

export function lineEdit(i) {
  const l = D.BATCH.lines[+i];
  if (!l) return;
  openModal({
    title: L('Edit envelope', 'تعديل المظروف'),
    sub: l.env ? <span className="mono">{l.env}</span> : L('Unattributed', 'غير مسمّى'),
    body: (
      <C.CurrencyField label={L('Amount', 'المبلغ')} value={(l.usd || l.lbp / D.RATE.value).toFixed(2)} id="le_amt" />
    ),
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
          v = parseFloat(val(el, '#le_amt').replace(/,/g, '')) || 0;
        if (l.usd != null) l.usd = v;
        else l.lbp = Math.round(v * D.RATE.value);
        closeOverlays();
        refresh();
        ok(L('Envelope corrected', 'صُحّح المظروف'), usd(v), {
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
  refresh();
  toast(
    L('Line reversed', 'عُكس البند'),
    L('A reversing entry stays in the history.', 'يبقى القيد العكسي في السجل.'),
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
