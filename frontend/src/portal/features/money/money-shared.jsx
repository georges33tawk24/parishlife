/* What the giving and finance screens share: who may see amounts, fund names, amounts in the currency
   they were recorded in (never converted: the API keeps no exchange rate), and what the signed-in
   account may do in the parish's finance. */
import { t, num, usd } from '../../../lib/i18n.js';
import { is } from '../../model/store.js';
import { FUNDS } from '../../model/data.js';
import { session } from '../../model/api.js';
import { Pill } from '../../ui/ui.jsx';

const L = (en, ar) => t(en, ar);

export function applyFinanceAccess(host) {
  if (is('priest', 'treasurer', 'super_admin', 'bishop', 'diocesan_admin', 'parish_admin')) return;
  host.querySelectorAll('#addenv,#close,[data-act]').forEach(el => {
    const action = (el.dataset.act || '').split(':')[0];
    if (!['print', 'export', 'receipt', 'doc', 'statements-all'].includes(action)) el.remove();
  });
  const note = document.createElement('p');
  note.className = 'help';
  note.textContent = L(
    'You can view, print and export these financial records. Recording or changing transactions requires a priest or treasurer.',
    'يمكنك عرض السجلات المالية وطباعتها وتصديرها. يتطلب تسجيل المعاملات أو تعديلها كاهناً أو أمين صندوق.'
  );
  host.querySelector('.tabs')?.insertAdjacentElement('afterend', note);
}

export const fundName = id => {
  const f = FUNDS.find(x => x.id === id);
  return f ? L(f.name, f.ar) : id || '—';
};

/* An amount in the currency it was recorded in. */
export const fmt = (amount, currency) =>
  currency === 'USD'
    ? usd(amount)
    : currency === 'LBP'
      ? `L.L ${num(Math.round(amount))}`
      : `${num(amount)} ${currency}`;

/* {USD: 12, LBP: 5000} → "$12.00 · L.L 5,000" */
export const amounts = map => {
  const entries = Object.entries(map || {}).filter(([, v]) => v);
  return entries.length ? entries.map(([c, v]) => fmt(v, c)).join(' · ') : '—';
};

/* Totals of lines or records by currency. */
export const byCurrency = (rows, amount = r => r.amount) => {
  const totals = {};
  for (const r of rows) totals[r.currency] = Math.round(((totals[r.currency] || 0) + amount(r)) * 100) / 100;
  return totals;
};

/* What this account may do in the selected parish. The API checks each action again. */
export function can(capability) {
  const parish = session.parishes.find(p => p.id === session.parishId);
  return !!parish && (parish.roles?.includes('priest') || parish.capabilities?.includes(capability));
}

const STATES = {
  open: ['Open', 'مفتوحة', 'info', 'st-open'],
  verified: ['Verified by a second counter', 'تحقّق منها عدّاد ثانٍ', 'success', 'st-ok'],
  variance: ['Counts differ', 'العدّان مختلفان', 'danger', 'st-alert'],
  closed: ['Closed and posted', 'مقفلة ومقيّدة', 'success', 'st-ok'],
  draft: ['Draft', 'مسوّدة', 'info', 'st-open'],
  returned: ['Returned for changes', 'أُعيد للتعديل', 'warning', 'st-alert'],
  'awaiting-approval': ['Awaiting approval', 'بانتظار الموافقة', 'warning', 'st-review'],
  approved: ['Approved, not paid', 'موافَق عليه، غير مدفوع', 'success', 'st-ok'],
  paid: ['Paid', 'مدفوع', 'success', 'st-ok'],
  rejected: ['Rejected', 'مرفوض', 'danger', 'st-no'],
  cancelled: ['Cancelled', 'ملغى', 'danger', 'st-no']
};
export function State({ k }) {
  const s = STATES[k];
  return s ? <Pill label={L(s[0], s[1])} tone={s[2]} mark={s[3]} /> : <Pill label={k || '—'} />;
}
