import { t, isAr, fmtDate } from '../i18n.js';
import { S, is, bus } from '../store.js';
import { OFFICE_LEDGER, PARISH } from '../data.js';
import { persist } from '../persist.js';
import { pageHead, panel, table, esc, empty, icon, pill, openDrawer, openModal, closeOverlays, toast } from '../ui.js';
import * as C from '../components.js';
import { printSheet } from '../print.js';

const L = (en, ar) => t(en, ar);
const today = () => new Date().toLocaleDateString('sv-SE');
const money = (value, currency) => `${new Intl.NumberFormat(isAr()?'ar-LB':'en-US',{maximumFractionDigits:currency==='LBP'?0:2,minimumFractionDigits:currency==='LBP'?0:2}).format(value)} ${currency}`;
const typeLabel = kind => kind==='expense'?L('Expense','مصروف'):kind==='opening'?L('Initial opening balance','الرصيد الافتتاحي الأول'):L('Allowance received','مخصّص مستلم');
const signed = row => row.kind==='expense'?-row.amount:row.amount;
const categories = [['Stationery','قرطاسية'],['Printing','طباعة'],['Office supplies','لوازم مكتبية'],['Postage','بريد'],['Maintenance','صيانة'],['Other','أخرى']];
const categoryLabel = value => { const item=categories.find(([en])=>en===value);return item?L(...item):value; };
const monthRows = (month, currency) => OFFICE_LEDGER.filter(row=>row.currency===currency&&row.date.slice(0,7)===month).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
function totals(month, currency) {
  const rows=monthRows(month,currency),before=OFFICE_LEDGER.filter(row=>row.currency===currency&&row.date.slice(0,7)<month);
  const opening=before.reduce((sum,row)=>sum+signed(row),0)+rows.filter(row=>row.kind==='opening').reduce((sum,row)=>sum+row.amount,0);
  const received=rows.filter(row=>row.kind==='allowance').reduce((sum,row)=>sum+row.amount,0);
  const spent=rows.filter(row=>row.kind==='expense').reduce((sum,row)=>sum+row.amount,0);
  return {opening,received,spent,balance:opening+received-spent};
}

export function officeExpenses() {
  if (!is('secretary','priest')) return empty('shield',L('Office access required','صلاحية المكتب مطلوبة'),'');
  const month=S.ui.officeMonth||today().slice(0,7),currency=S.ui.officeCurrency||'USD',filter=S.ui.officeKind||'all',query=(S.ui.officeQuery||'').toLocaleLowerCase();
  const summary=totals(month,currency),rows=monthRows(month,currency).filter(row=>(filter==='all'||row.kind===filter)&&`${row.description} ${row.payee} ${row.reference} ${row.category}`.toLocaleLowerCase().includes(query));
  return pageHead({crumbs:[{label:L('Office','المكتب')},{label:L('Office Expenses','مصاريف المكتب')}],title:L('Office Expenses','مصاريف المكتب'),
    sub:L('Record the monthly allowance and office purchases, with receipts and a running balance.','سجّل المخصّص الشهري ومشتريات المكتب مع الإيصالات والرصيد المتبقّي.'),
    actions:`<button class="btn btn-secondary" data-office-new="allowance">${icon('plus',16)}${L('Add allowance','إضافة مخصّص')}</button><button class="btn btn-primary" data-office-new="expense">${icon('plus',16)}${L('Add expense','إضافة مصروف')}</button>`})+
    `<div class="office-toolbar"><div class="formrow"><label class="label" for="office-month">${L('Month','الشهر')}</label><input class="input" id="office-month" type="month" value="${esc(month)}"></div>
    <div class="formrow"><label class="label" for="office-currency">${L('Currency','العملة')}</label><select class="select" id="office-currency"><option ${currency==='USD'?'selected':''}>USD</option><option ${currency==='LBP'?'selected':''}>LBP</option></select></div>
    <button class="btn btn-secondary" data-office-print-month>${icon('print',16)}${L('Print monthly summary','طباعة ملخّص الشهر')}</button>
    <button class="btn btn-ghost" data-office-new="opening">${L('Initial opening balance','الرصيد الافتتاحي الأول')}</button></div>
    <div class="office-summary">${[['opening','Opening balance','الرصيد الافتتاحي'],['received','Allowance received','المخصّص المستلم'],['spent','Office expenses','مصاريف المكتب'],['balance','Remaining balance','الرصيد المتبقّي']].map(([key,en,ar])=>`<div class="stat"><span class="k">${L(en,ar)}</span><strong class="v" dir="ltr">${money(summary[key],currency)}</strong></div>`).join('')}</div>
    <p class="help">${L('Previous balances carry forward automatically. USD and LBP are tracked separately. Record an initial balance only once per currency.','تُنقل الأرصدة السابقة تلقائياً. يُتابع الدولار والليرة بشكل منفصل. سجّل الرصيد الأول مرة واحدة لكل عملة.')}</p>
    <div class="office-toolbar"><input class="input" id="office-search" type="search" value="${esc(S.ui.officeQuery||'')}" placeholder="${L('Description, supplier or reference','الوصف أو المورّد أو المرجع')}" aria-label="${L('Search transactions','البحث في العمليات')}">
    <select class="select" id="office-kind" aria-label="${L('Transaction type','نوع العملية')}">${[['all','All transactions','كل العمليات'],['expense','Expenses','المصاريف'],['allowance','Allowances','المخصّصات'],['opening','Opening balance','الرصيد الافتتاحي']].map(([key,en,ar])=>`<option value="${key}" ${filter===key?'selected':''}>${L(en,ar)}</option>`).join('')}</select><span class="dim">${rows.length} ${L('transactions','عمليات')}</span></div>
    <div class="office-ledger">${table({cols:[{label:L('Date','التاريخ')},{label:L('Type','النوع')},{label:L('Description / category','الوصف / الفئة')},{label:L('Supplier / reference','المورّد / المرجع')},{label:L('Amount','المبلغ'),cls:'num'},{label:L('Actions','الإجراءات')}],rows:rows.map(row=>({cells:[fmtDate(row.date),pill(typeLabel(row.kind),row.kind==='expense'?'warning':'info'),`<b>${esc(row.description)}</b><small>${esc(categoryLabel(row.category||''))}</small>`,`<b>${esc(row.payee||'—')}</b><small>${esc(row.reference||'')}</small>`,money(row.amount,row.currency),`<span class="rowacts"><button class="btn btn-secondary btn-dense" data-office-view="${esc(row.id)}">${L('View','عرض')}</button><button class="btn btn-secondary btn-dense" data-office-edit="${esc(row.id)}">${L('Edit','تعديل')}</button><button class="btn btn-ghost btn-dense" data-office-print="${esc(row.id)}">${L('Print','طباعة')}</button><button class="btn btn-danger-quiet btn-dense" data-office-delete="${esc(row.id)}">${L('Delete','حذف')}</button></span>`]})),empty:empty('fin',L('No transactions match','لا عمليات مطابقة'),L('Add an allowance or record your first office purchase.','أضف مخصّصاً أو سجّل أول مشتريات المكتب.'))})}</div>`;
}

function entryForm(record=null, kind='expense') {
  kind=record?.kind||kind;
  const currency=record?.currency||S.ui.officeCurrency||'USD';
  const date=record?.date||(S.ui.officeMonth&&S.ui.officeMonth!==today().slice(0,7)?S.ui.officeMonth+'-01':today());
  openDrawer({title:record?L('Edit transaction','تعديل العملية'):typeLabel(kind),
    body:`<form id="office-entry-form"><div class="formgrid">${C.field({label:L('Date','التاريخ'),id:'oe-date',type:'date',value:date,req:true})}
      <div class="formrow"><label class="label" for="oe-currency">${L('Currency','العملة')}</label><select class="select" id="oe-currency"><option ${currency==='USD'?'selected':''}>USD</option><option ${currency==='LBP'?'selected':''}>LBP</option></select></div></div>
      ${C.field({label:L('Amount','المبلغ'),id:'oe-amount',type:'number',value:record?.amount??'',req:true})}
      ${C.field({label:L('Description','الوصف'),id:'oe-description',value:record?.description||'',req:true,max:240})}
      ${kind==='expense'?`<div class="formrow"><label class="label" for="oe-category">${L('Category','الفئة')}</label><select class="select" id="oe-category">${categories.map(([en,ar])=>`<option value="${en}" ${record?.category===en?'selected':''}>${L(en,ar)}</option>`).join('')}</select></div>`:''}
      ${C.field({label:kind==='expense'?L('Supplier / payee','المورّد / المستفيد'):L('Received from','مستلم من'),id:'oe-payee',value:record?.payee||'',max:160})}
      ${C.field({label:L('Receipt / reference number (optional)','رقم الإيصال / المرجع (اختياري)'),id:'oe-reference',value:record?.reference||'',max:100})}
      <div class="formrow"><label class="label" for="oe-notes">${L('Notes (optional)','ملاحظات (اختياري)')}</label><textarea class="textarea" id="oe-notes" maxlength="2000">${esc(record?.notes||'')}</textarea></div>
      ${kind==='opening'?`<p class="help">${L('Use the balance held before your first transaction. Future months calculate their opening balance automatically.','استعمل الرصيد المتوفّر قبل أول عملية. تُحسب الأرصدة الافتتاحية للأشهر المقبلة تلقائياً.')}</p>`:''}
      ${record?`<h3 class="t-ui">${L('Receipt attachments','مرفقات الإيصال')}</h3>${C.dropzone('office-receipts',{scope:'office-expense',ownerId:record.id})}`:`<div class="formrow"><label class="label" for="oe-receipt">${L('Receipt attachment (optional)','مرفق الإيصال (اختياري)')}</label><input class="input" type="file" id="oe-receipt" accept=".pdf,.png,.jpg,.jpeg"><p class="help">${L('PDF, JPG or PNG up to 10 MB.','PDF أو JPG أو PNG حتى ١٠ ميغابايت.')}</p></div>`}</form>`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="oe-save">${L('Save transaction','حفظ العملية')}</button>`,
    onMount(el){C.wire(el);el.querySelector('form').addEventListener('submit',e=>e.preventDefault());el.querySelector('#oe-amount').min='0.01';el.querySelector('#oe-amount').step='any';el.querySelector('#oe-save').addEventListener('click',async e=>{
      const value=id=>el.querySelector('#oe-'+id)?.value.trim()||'';
      if(!el.querySelector('form').reportValidity())return;
      const amount=Number(value('amount')),date=value('date'),currency=value('currency');
      if(!Number.isFinite(amount)||amount<=0||!date||!value('description'))return toast(L('Enter a date, description and positive amount','أدخل تاريخاً ووصفاً ومبلغاً موجباً'),'','warning');
      const receipt=el.querySelector('#oe-receipt')?.files?.[0];
      if(receipt&&(!/\.(pdf|png|jpe?g)$/i.test(receipt.name)||receipt.size>10_000_000))return toast(L('Choose a PDF, JPG or PNG up to 10 MB','اختر PDF أو JPG أو PNG حتى ١٠ ميغابايت'),'','warning');
      e.currentTarget.disabled=true;
      const entry={id:record?.id||'office-'+crypto.randomUUID(),kind,date,currency,amount,description:value('description'),category:kind==='expense'?value('category'):'',payee:value('payee'),reference:value('reference'),notes:value('notes')};
      if(record)Object.assign(record,entry);else OFFICE_LEDGER.push(entry);
      if(!await persist()){el.querySelector('#oe-save').disabled=false;return;}
      if(receipt){try{const {uploadFile}=await import('../request-documents.js');await uploadFile('office-expense',entry.id,receipt);}catch(error){toast(L('Transaction saved; receipt upload failed','حُفظت العملية؛ تعذّر رفع الإيصال'),error.message,'warning');closeOverlays();bus.refresh();entryForm(OFFICE_LEDGER.find(x=>x.id===entry.id));return;}}
      S.ui.officeMonth=date.slice(0,7);S.ui.officeCurrency=currency;closeOverlays();bus.refresh();toast(L('Transaction saved','حُفظت العملية'),'','success');
    });}
  });
}

function viewEntry(row) {
  openDrawer({title:typeLabel(row.kind),sub:esc(row.description),body:`<dl class="dl"><dt>${L('Date','التاريخ')}</dt><dd>${fmtDate(row.date)}</dd><dt>${L('Amount','المبلغ')}</dt><dd>${money(row.amount,row.currency)}</dd><dt>${L('Category','الفئة')}</dt><dd>${esc(categoryLabel(row.category||''))}</dd><dt>${L('Supplier / source','المورّد / المصدر')}</dt><dd>${esc(row.payee||'—')}</dd><dt>${L('Reference','المرجع')}</dt><dd>${esc(row.reference||'—')}</dd><dt>${L('Notes','الملاحظات')}</dt><dd>${esc(row.notes||'—')}</dd></dl><div class="divider"></div><h3 class="t-ui">${L('Receipt attachments','مرفقات الإيصال')}</h3>${C.dropzone('office-view-receipts',{scope:'office-expense',ownerId:row.id,readOnly:true})}`,
    foot:`<button class="btn btn-secondary" data-close>${L('Close','إغلاق')}</button><button class="btn btn-secondary" id="oe-view-print">${L('Print voucher','طباعة السند')}</button><button class="btn btn-primary" id="oe-view-edit">${L('Edit','تعديل')}</button>`,onMount(el){C.wire(el);el.querySelector('#oe-view-edit').onclick=()=>entryForm(row);el.querySelector('#oe-view-print').onclick=()=>printEntry(row);}});
}

function deleteEntry(row) {
  openModal({title:L('Delete this transaction?','حذف هذه العملية؟'),sub:esc(row.description),body:`<p>${L('The monthly balance will be recalculated. Its receipt attachments will be removed; the change remains in the audit history.','سيُعاد حساب الرصيد الشهري وتُحذف مرفقات الإيصال. يبقى التغيير في سجل التدقيق.')}</p>`,foot:`<button class="btn btn-secondary" data-close>${L('Keep','إبقاء')}</button><button class="btn btn-danger" id="oe-confirm-delete">${L('Delete','حذف')}</button>`,onMount(el){el.querySelector('#oe-confirm-delete').onclick=async e=>{e.currentTarget.disabled=true;OFFICE_LEDGER.splice(OFFICE_LEDGER.findIndex(x=>x.id===row.id),1);if(!await persist()){closeOverlays();bus.refresh();return;}closeOverlays();bus.refresh();toast(L('Transaction deleted','حُذفت العملية'),'','success');};}});
}

const printCSS='body{color:#3D4161}h1{font-size:22px}h2{font-size:17px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:start;border-bottom:1px solid #AACDE8;padding:9px;vertical-align:top}th{background:#FFF5C9;color:#735039}dl{display:grid;grid-template-columns:150px 1fr;gap:12px}dt{font-weight:600}dd{margin:0}small{display:block}footer{margin-top:35px;border-top:1px solid #AACDE8;padding-top:12px}tr{break-inside:avoid}';
function printEntry(row) {
  printSheet({title:L('Office transaction voucher','سند عملية مكتبية'),css:printCSS,body:`<h1>${esc(L(PARISH.name,PARISH.nameAr))}</h1><h2>${L('Office transaction voucher','سند عملية مكتبية')} · ${typeLabel(row.kind)}</h2><p>${L('Internal record — supplier receipts are attached separately.','سند داخلي — تُرفق إيصالات المورّد بشكل منفصل.')}</p><dl><dt>${L('Voucher ID','رقم السند')}</dt><dd>${esc(row.id)}</dd><dt>${L('Date','التاريخ')}</dt><dd>${fmtDate(row.date)}</dd><dt>${L('Description','الوصف')}</dt><dd>${esc(row.description)}</dd><dt>${L('Amount','المبلغ')}</dt><dd>${money(row.amount,row.currency)}</dd><dt>${L('Category','الفئة')}</dt><dd>${esc(categoryLabel(row.category||''))}</dd><dt>${L('Supplier / source','المورّد / المصدر')}</dt><dd>${esc(row.payee||'—')}</dd><dt>${L('Reference','المرجع')}</dt><dd>${esc(row.reference||'—')}</dd><dt>${L('Notes','الملاحظات')}</dt><dd>${esc(row.notes||'—')}</dd></dl><footer>${L('Recorded by / signature','المسجّل / التوقيع')}: ____________________</footer>`});
}
function printMonth() {
  const month=S.ui.officeMonth||today().slice(0,7),currency=S.ui.officeCurrency||'USD',s=totals(month,currency),rows=monthRows(month,currency).reverse();
  printSheet({title:L('Monthly office expenses','مصاريف المكتب الشهرية')+' '+month,css:printCSS,body:`<h1>${esc(L(PARISH.name,PARISH.nameAr))}</h1><h2>${L('Office account','حساب المكتب')} · ${esc(month)} · ${currency}</h2><p>${L('Opening','افتتاحي')}: ${money(s.opening,currency)} · ${L('Received','مستلم')}: ${money(s.received,currency)} · ${L('Expenses','مصاريف')}: ${money(s.spent,currency)}</p><h3>${L('Remaining balance','الرصيد المتبقّي')}: ${money(s.balance,currency)}</h3><table><thead><tr>${['Date|التاريخ','Type|النوع','Description|الوصف','Supplier / reference|المورّد / المرجع','Amount|المبلغ'].map(x=>`<th>${L(...x.split('|'))}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><td>${fmtDate(row.date)}</td><td>${typeLabel(row.kind)}</td><td>${esc(row.description)}</td><td>${esc(row.payee||'—')}<small>${esc(row.reference||'')}</small></td><td>${money(row.amount,row.currency)}</td></tr>`).join('')}</tbody></table><footer>${L('Balances carry forward automatically. This summary includes all transactions for the selected month and currency.','تُنقل الأرصدة تلقائياً. يشمل الملخّص كل العمليات للشهر والعملة المحدّدين.')}</footer>`});
}

officeExpenses.mount=host=>{
  C.wire(host);
  [['office-month','officeMonth'],['office-currency','officeCurrency'],['office-kind','officeKind']].forEach(([id,key])=>host.querySelector('#'+id)?.addEventListener('change',e=>{if(!e.target.value)return;S.ui[key]=e.target.value;bus.refresh();}));
  host.querySelector('#office-search')?.addEventListener('input',e=>{const pos=e.target.selectionStart;S.ui.officeQuery=e.target.value;bus.refresh();const replacement=document.querySelector('#office-search');replacement?.focus();replacement?.setSelectionRange(pos,pos);});
  host.querySelectorAll('[data-office-new]').forEach(b=>b.onclick=()=>entryForm(null,b.dataset.officeNew));
  [['view',viewEntry],['edit',entryForm],['delete',deleteEntry],['print',printEntry]].forEach(([action,fn])=>host.querySelectorAll(`[data-office-${action}]`).forEach(b=>b.onclick=()=>{const row=OFFICE_LEDGER.find(x=>x.id===b.dataset['office'+action[0].toUpperCase()+action.slice(1)]);if(row)fn(row);}));
  host.querySelector('[data-office-print-month]')?.addEventListener('click',printMonth);
};
