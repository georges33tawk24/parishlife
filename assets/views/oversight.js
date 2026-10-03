/* Bishop-only reporting surface. It never receives the parish editing model. */
import { api, session } from '../api.js';
import { t, fmtDate } from '../i18n.js';
import { bus } from '../store.js';
import { pageHead, table, stat, esc, status } from '../ui.js';

const cache = new Map();
const L = (en, ar) => t(en, ar);
const key = id => `${session.user?.id}:${id || 'all'}`;
const name = p => `${esc(p?.lat || '—')}<small style="display:block" dir="rtl">${esc(p?.ar || '')}</small>`;
const eventType = kind => ({mass:L('Mass','قدّاس'),event:L('Parish event','حدث رعوي'),group:L('Group meeting','اجتماع مجموعة'),
  sacr:L('Sacrament','سرّ'),pending:L('Pending event','حدث قيد التحضير')})[kind] || kind;
export function oversight(id = '') {
  const entry = cache.get(key(id));
  const head = pageHead({ title: L('Parish oversight', 'الإشراف على الرعايا'),
    sub: L('Read-only parish activity and records. Parish staff remain responsible for all operational changes.', 'أنشطة الرعايا وسجلاتها للقراءة فقط. يتولّى موظفو الرعية كل التعديلات التشغيلية.'),
    actions: `<button class="btn btn-secondary" data-oversight-reload>${L('Refresh', 'تحديث')}</button>` });
  const filter = `<div class="toolbar" style="margin:18px 0"><label for="oversight-parish">${L('Parish','الرعية')}</label>
    <select class="select" id="oversight-parish"><option value="">${L('All parishes','كل الرعايا')}</option>${session.parishes.map(p=>`<option value="${esc(p.id)}" ${id===p.id?'selected':''}>${esc(p.name)} — ${esc(p.ar)}</option>`).join('')}</select></div>`;
  if (!entry || entry.loading) return head + filter + `<p role="status">${L('Loading oversight…','جارٍ تحميل بيانات الإشراف…')}</p>`;
  if (entry.error) return head + filter + `<p class="alert alert-danger">${esc(entry.error)}</p>`;
  if (!id) return head + filter + table({cols:[{label:L('Parish','الرعية')},{label:L('People / households','المؤمنون / العائلات')},{label:L('Official register entries','القيود الرسمية')},{label:L('Open requests','الطلبات المفتوحة')},{label:L('Upcoming events','الأحداث المقبلة')},{label:''}], rows:entry.parishes.map(x=>({cells:[
    `<b>${esc(x.parish.name)}</b><small style="display:block">${esc(x.parish.ar)}</small>`,`${x.counts.people} / ${x.counts.households}`,x.counts.registers,x.counts.pendingRequests,x.counts.upcomingEvents,
    `<a class="btn btn-secondary btn-dense" href="#/oversight/${esc(x.parish.id)}">${L('View oversight','عرض الإشراف')}</a>`]}))});
  const block = (title, rows, cols) => `<details class="panel" open style="margin-top:16px"><summary class="panel-h"><b>${title}</b></summary><div class="panel-b">${rows.length?
    table({cols:cols.map(label=>({label})),rows:rows.map(cells=>({cells}))}):`<p class="help">${L('No records to show for this parish.','لا سجلات لعرضها لهذه الرعية.')}</p>`}</div></details>`;
  return head + filter + `<h2>${esc(entry.parish.name)} <small dir="rtl">${esc(entry.parish.ar)}</small></h2>
    <div class="stats" style="margin:16px 0">${stat(L('People','المؤمنون'),entry.counts.people)}${stat(L('Groups','المجموعات'),entry.counts.groups)}${stat(L('Official entries','القيود الرسمية'),entry.counts.registers)}</div>
    ${block(L('People — names and membership only','المؤمنون — الأسماء والعضوية فقط'),entry.people.map(p=>[name(p),status(p.status)]),[L('English / Arabic name','الاسم الإنكليزي / العربي'),L('Status','الحالة')])}
    ${block(L('Sacraments and requests','الأسرار والطلبات'),entry.records.map(r=>[esc(r.reference),name(r.person),esc(r.kind),fmtDate(r.date),status(r.status)]),[L('Reference','المرجع'),L('Person','الشخص'),L('Type','النوع'),L('Date','التاريخ'),L('Status','الحالة')])}
    ${block(L('Calendar activities','أنشطة الرزنامة'),entry.events.map(e=>[`${esc(e.title)}<small style="display:block">${esc(e.titleAr)}</small>`,fmtDate(e.date),esc(e.time),esc(eventType(e.kind))]),[L('Event','الحدث'),L('Date','التاريخ'),L('Time','الوقت'),L('Type','النوع')])}
    ${block(L('Group activity','نشاط المجموعات'),entry.groups.map(g=>[`${esc(g.name)}<small style="display:block">${esc(g.ar)}</small>`,g.members,g.meetings]),[L('Group','المجموعة'),L('Members','الأعضاء'),L('Recorded meetings','الاجتماعات المسجلة')])}
    ${block(L('Recent administrative activity','النشاط الإداري الأخير'),entry.activity.map(a=>[fmtDate(a.at),esc(a.action)]),[L('Date','التاريخ'),L('Activity','النشاط')])}`;
}
oversight.mount = (host,id='') => {
  host.querySelector('#oversight-parish')?.addEventListener('change',e=>{location.hash='#/oversight'+(e.target.value?'/'+e.target.value:'');});
  host.querySelector('[data-oversight-reload]')?.addEventListener('click',()=>{cache.delete(key(id));bus.refresh();});
  if (cache.has(key(id))) return;
  const k=key(id); cache.set(k,{loading:true});
  api(id?`parishes/${encodeURIComponent(id)}/oversight`:'oversight').then(data=>cache.set(k,data)).catch(error=>cache.set(k,{error:error.message})).finally(()=>bus.refresh());
};
