/* What the giving and finance screens share: who may see amounts, and fund names. */
import { t } from '../../../lib/i18n.js';
import { is } from '../../model/store.js';
import { FUNDS } from '../../model/data.js';

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
  return f ? L(f.name, f.ar) : id;
};
