/* Clergy-only pastoral notes and follow-up tasks share one parish-scoped collection. */
import { t, isAr, fmtDate } from '../i18n.js';
import { S, is, bus } from '../store.js';
import { NOTES, PEOPLE, person } from '../data.js';
import { icon } from '../icons.js';
import { persist } from '../persist.js';
import { pageHead, panel, table, pill, who, esc, empty, openDrawer, openModal, closeOverlays, toast } from '../ui.js';

const L = (en, ar) => t(en, ar);
const priorities = [
  ['ordinary', 'Low', 'منخفضة'], ['attention', 'Medium', 'متوسطة'], ['urgent', 'High', 'عالية']
];
const rank = { urgent: 0, attention: 1, ordinary: 2 };
const today = () => new Date().toISOString().slice(0, 10);
const recent = (a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0);
const label = n => L(n.body, n.bodyAr || n.body);
const kind = n => n.kind === 'task' ? L('Task', 'مهمة') : L('Note', 'ملاحظة');

export function notes() {
  if (!is('priest')) return empty('shield', L('Not available for this role', 'غير متاح لهذا الدور'),
    L('Pastoral notes and tasks are restricted to clergy.', 'الملاحظات والمهام الرعوية محصورة بالإكليروس.'));
  const filter = S.ui.noteFilter || 'all', sort = S.ui.noteSort || 'recent';
  const counts = { all: NOTES.length, pinned: NOTES.filter(n => n.pinned).length,
    pending: NOTES.filter(n => n.kind === 'task' && !n.done).length,
    completed: NOTES.filter(n => n.kind === 'task' && n.done).length,
    high: NOTES.filter(n => n.priority === 'urgent').length };
  const allowed = n => filter === 'all' || filter === 'pinned' && n.pinned ||
    filter === 'pending' && n.kind === 'task' && !n.done ||
    filter === 'completed' && n.kind === 'task' && n.done ||
    filter === 'high' && n.priority === 'urgent';
  const rows = NOTES.filter(allowed).slice().sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return Number(!!b.pinned) - Number(!!a.pinned);
    if (sort === 'priority') return (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2) || recent(a, b);
    if (sort === 'due') return (a.due || '9999').localeCompare(b.due || '9999') || (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);
    return recent(a, b);
  });
  const row = n => {
    const p = n.p ? person(n.p) : null;
    const search = `${n.body} ${n.bodyAr || ''} ${p?.lat || ''} ${p?.ar || ''}`.toLocaleLowerCase();
    return {attrs:`data-note="${esc(n.id)}" data-search="${esc(search)}"`,cells:[
      p?`<a href="#/person/${esc(p.id)}">${esc(p.lat)}</a>`:'—',
      `<b>${esc(label(n))}</b>${n.kind==='task'&&n.assignee?`<small>${L('Assigned to','المكلّف')} ${esc(person(n.assignee)?.lat||'—')}</small>`:''}`,
      n.priority==='urgent'?pill(L('High','عالية'),'danger'):n.priority==='attention'?pill(L('Medium','متوسطة'),'warning'):pill(L('Low','منخفضة')),
      n.kind==='task'?n.due?fmtDate(n.due):'—':n.at?fmtDate(n.at):'—',
      n.kind==='task'?pill(n.done?L('Completed','مكتملة'):L('Pending','معلّقة'),n.done?'success':'warning'):'—',
      `<span class="rowacts">${n.kind==='task'?`<button class="btn-icon" data-note-done="${esc(n.id)}" aria-label="${n.done?L('Reopen task','إعادة فتح المهمة'):L('Complete task','إكمال المهمة')}">${icon('check',17)}</button>`:''}
        <button class="btn-icon" data-note-pin="${esc(n.id)}" aria-label="${n.pinned?L('Unpin','إلغاء التثبيت'):L('Pin','تثبيت')}" aria-pressed="${!!n.pinned}">${icon('pin',17)}</button>
        <button class="btn btn-secondary btn-dense" data-note-edit="${esc(n.id)}">${L('Edit','تعديل')}</button></span>`]};
  };
  const columns=[{label:L('Person','الشخص')},{label:L('Content','المحتوى')},{label:L('Priority','الأولوية')},{label:L('Due or recorded','الاستحقاق أو التسجيل')},{label:L('Status','الحالة')},{label:''}];
  return `${pageHead({
    crumbs: [{ label: L('Records', 'السجلات') }, { label: L('Pastoral notes', 'ملاحظات رعوية') }],
    title: L('Pastoral notes & tasks', 'الملاحظات والمهام الرعوية'),
    sub: L('Tasks are work to complete, with an optional clergy assignee and due date. Notes are reference information and observations, without a deadline.',
      'المهام أعمال تُنجز مع كاهن مكلّف وموعد اختياريين. الملاحظات معلومات مرجعية ومشاهدات دون موعد إنجاز.'),
    actions: `<button class="btn btn-secondary" data-note-new="note">${icon('notes', 17)}${L('New note', 'ملاحظة جديدة')}</button>
      <button class="btn btn-primary" data-note-new="task">${icon('plus', 17)}${L('New task', 'مهمة جديدة')}</button>`
  })}
  <div class="stats pastoral-stats" style="margin:20px 0 16px">
    <div class="stat"><span class="k">${L('Pending tasks', 'مهام معلّقة')}</span><span class="v">${counts.pending}</span></div>
    <div class="stat"><span class="k">${L('High priority', 'أولوية عالية')}</span><span class="v">${counts.high}</span></div>
    <div class="stat"><span class="k">${L('Pinned', 'مثبّتة')}</span><span class="v">${counts.pinned}</span></div>
  </div>
  <div class="toolbar pastoral-tools" style="margin-bottom:14px">
    <div class="seg" role="group" aria-label="${L('Filter notes and tasks', 'تصفية الملاحظات والمهام')}">
      ${[['all','All','الكل'],['pinned','Pinned','مثبّتة'],['pending','Pending','معلّقة'],['completed','Completed','مكتملة'],['high','High priority','عالية الأولوية']]
        .map(([key,en,ar]) => `<button data-note-filter="${key}" aria-pressed="${filter === key}">${L(en,ar)} <span class="tnum">${counts[key]}</span></button>`).join('')}
    </div>
    <input class="input" id="note-search" type="search" placeholder="${L('Search notes, tasks, people', 'ابحث في الملاحظات والمهام والأشخاص')}" aria-label="${L('Search notes and tasks', 'البحث في الملاحظات والمهام')}" value="${esc(S.ui.noteQuery || '')}">
    <select class="select" id="note-sort" aria-label="${L('Sort notes and tasks', 'ترتيب الملاحظات والمهام')}">
      ${[['recent','Newest','الأحدث'],['priority','Priority','الأولوية'],['due','Due date','تاريخ الاستحقاق']]
        .map(([key,en,ar]) => `<option value="${key}" ${sort === key ? 'selected' : ''}>${L(en,ar)}</option>`).join('')}
    </select>
  </div>
  ${panel(L('Notes','الملاحظات'),table({cols:columns,rows:rows.filter(n=>n.kind!=='task').map(row),empty:empty('notes',L('No notes in this view','لا ملاحظات في هذا العرض'),L('Create a note or change the filter.','أنشئ ملاحظة أو غيّر المرشّح.'))}),{tight:true})}
  ${panel(L('Tasks','المهام'),table({cols:columns,rows:rows.filter(n=>n.kind==='task').map(row),empty:empty('notes',L('No tasks in this view','لا مهام في هذا العرض'),L('Create a task or change the filter.','أنشئ مهمة أو غيّر المرشّح.'))}),{tight:true})}
  <p class="help" id="note-no-search" hidden>${L('No matching items.', 'لا عناصر مطابقة.')}</p>`;
}

export function openPastoralForm(item = null, type = 'note', initialPerson = null) {
  if (!is('priest')) return;
  const editing = !!item, itemKind = item?.kind || type;
  openDrawer({
    title: editing ? (itemKind==='task'?L('Edit task','تعديل مهمة'):L('Edit note','تعديل ملاحظة')) : itemKind === 'task' ? L('New follow-up task', 'مهمة متابعة جديدة') : L('New pastoral note', 'ملاحظة رعوية جديدة'),
    sub: itemKind==='task' ? L('Actionable work. Assign only to clergy who may access these confidential records.','عمل قابل للإنجاز. يُكلّف به فقط الإكليروس المخوّل بالاطلاع على هذه السجلات السرية.') : L('Reference information or an observation. Notes have no completion status or deadline.','معلومة مرجعية أو مشاهدة. الملاحظات دون حالة إنجاز أو موعد نهائي.'),
    body: `<div class="formrow"><label class="label" for="pastoral-person">${L('Person', 'الشخص')} ${itemKind === 'task' ? L('(optional)', '(اختياري)') : ''}</label>
      <select class="select" id="pastoral-person"><option value="">${L(itemKind === 'task' ? 'General parish task' : 'Select a person', itemKind === 'task' ? 'مهمة عامة للرعية' : 'اختر شخصاً')}</option>
      ${PEOPLE.map(p => `<option value="${esc(p.id)}" ${(item?.p || initialPerson) === p.id ? 'selected' : ''}>${esc(p.lat)} · ${esc(p.ar)}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label" for="pastoral-body">${itemKind === 'task' ? L('Task', 'المهمة') : L('Note', 'الملاحظة')} <span class="req">*</span></label>
        <textarea class="textarea" id="pastoral-body" rows="4" maxlength="500">${esc(item?.body || '')}</textarea></div>
      <details class="pastoral-translation" ${item?.bodyAr && item.bodyAr !== item.body ? 'open' : ''}><summary>${L('Arabic text (optional)', 'النص العربي (اختياري)')}</summary>
        <div class="formrow"><label class="label" for="pastoral-body-ar">${L('Arabic text', 'النص العربي')}</label>
          <textarea class="textarea" id="pastoral-body-ar" rows="3" maxlength="500" dir="rtl">${esc(item?.bodyAr && item.bodyAr !== item.body ? item.bodyAr : '')}</textarea></div></details>
      <div class="formgrid"><div class="formrow"><label class="label" for="pastoral-priority">${L('Priority', 'الأولوية')}</label>
        <select class="select" id="pastoral-priority">${priorities.map(([key,en,ar]) => `<option value="${key}" ${(item?.priority || 'ordinary') === key ? 'selected' : ''}>${L(en,ar)}</option>`).join('')}</select></div>
        ${itemKind === 'task' ? `<div class="formrow"><label class="label" for="pastoral-due">${L('Due date', 'تاريخ الاستحقاق')}</label><input class="input" id="pastoral-due" type="date" value="${esc(item?.due || '')}"></div>` : ''}</div>
      ${itemKind==='task'?`<div class="formrow"><label class="label" for="pastoral-assignee">${L('Assigned clergy (optional)','الكاهن المكلّف (اختياري)')}</label><select class="select" id="pastoral-assignee"><option value="">${L('Unassigned','دون تكليف')}</option>${PEOPLE.filter(p=>p.status==='clergy').map(p=>`<option value="${esc(p.id)}" ${item?.assignee===p.id?'selected':''}>${esc(p.lat)} · ${esc(p.ar)}</option>`).join('')}</select></div>`:''}
      <label class="check"><input type="checkbox" id="pastoral-pinned" ${item?.pinned ? 'checked' : ''}><span>${L('Keep this pinned', 'تثبيت هذا العنصر')}</span></label>`,
    foot: `${editing ? `<button class="btn btn-danger-quiet" id="pastoral-delete">${icon('trash', 16)}${L('Delete', 'حذف')}</button>` : ''}
      <button class="btn btn-secondary" data-close style="margin-inline-start:auto">${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="pastoral-save">${editing ? L('Save changes', 'حفظ التعديلات') : itemKind === 'task' ? L('Add task', 'إضافة المهمة') : L('Save note', 'حفظ الملاحظة')}</button>`,
    onMount(el) {
      el.querySelector('#pastoral-save').addEventListener('click', async e => {
        const body = el.querySelector('#pastoral-body').value.trim(), p = el.querySelector('#pastoral-person').value;
        if (!body) { el.querySelector('#pastoral-body').focus(); return; }
        if (itemKind === 'note' && !p) { el.querySelector('#pastoral-person').focus(); return; }
        e.currentTarget.disabled=true;
        const values = { kind: itemKind, p: p || null, body, bodyAr: el.querySelector('#pastoral-body-ar').value.trim() || body,
          priority: el.querySelector('#pastoral-priority').value, due: el.querySelector('#pastoral-due')?.value || '',
          assignee: itemKind==='task' ? el.querySelector('#pastoral-assignee').value || null : null,
          pinned: el.querySelector('#pastoral-pinned').checked };
        if (editing) Object.assign(item, values);
        else NOTES.unshift({ id: 'nt' + crypto.randomUUID(), at: today(), done: false, ...values });
        if (!await persist()) { el.querySelector('#pastoral-save').disabled=false; return; }
        closeOverlays(); bus.refresh(); toast(editing ? L('Updated', 'حُدّث') : L('Saved', 'حُفظ'), body, 'success');
      });
      el.querySelector('#pastoral-delete')?.addEventListener('click', () => openModal({
        title: L('Delete this pastoral item?', 'حذف هذا العنصر الرعوي؟'),
        sub: L('This removes it from the parish record.', 'سيُحذف من سجل الرعية.'),
        foot: `<button class="btn btn-secondary" data-close>${L('Keep', 'إبقاء')}</button><button class="btn btn-danger" id="pastoral-confirm-delete">${L('Delete', 'حذف')}</button>`,
        onMount(dialog) { dialog.querySelector('#pastoral-confirm-delete').addEventListener('click', async () => {
          const index = NOTES.findIndex(n => n.id === item.id);
          if (index >= 0) NOTES.splice(index, 1);
          if(!await persist())return;
          closeOverlays(); bus.refresh(); toast(L('Deleted', 'حُذف'), '', 'success');
        }); }
      }));
    }
  });
}

notes.mount = host => {
  host.querySelectorAll('[data-note-new]').forEach(b => b.addEventListener('click', () => openPastoralForm(null, b.dataset.noteNew)));
  host.querySelectorAll('[data-note-filter]').forEach(b => b.addEventListener('click', () => { S.ui.noteFilter = b.dataset.noteFilter; bus.refresh(); }));
  host.querySelector('#note-sort')?.addEventListener('change', e => { S.ui.noteSort = e.target.value; bus.refresh(); });
  host.querySelector('#note-search')?.addEventListener('input', e => {
    const query = e.target.value.trim().toLocaleLowerCase(); S.ui.noteQuery = e.target.value;
    let shown = 0;
    host.querySelectorAll('[data-note]').forEach(row => { row.hidden = !row.dataset.search.includes(query); if (!row.hidden) shown++; });
    const none = host.querySelector('#note-no-search'); if (none) none.hidden = shown > 0;
  });
  host.querySelectorAll('[data-note-done]').forEach(b => b.addEventListener('click', async () => {
    const item = NOTES.find(n => n.id === b.dataset.noteDone); if (!item || item.kind !== 'task') return;
    item.done = !item.done;if(!await persist())return; bus.refresh(); toast(item.done ? L('Task completed', 'أُنجزت المهمة') : L('Task reopened', 'أُعيد فتح المهمة'), '', 'success');
  }));
  host.querySelectorAll('[data-note-pin]').forEach(b => b.addEventListener('click', async () => {
    const item = NOTES.find(n => n.id === b.dataset.notePin); if (!item) return;
    item.pinned = !item.pinned;if(!await persist())return;bus.refresh();
  }));
  host.querySelectorAll('[data-note-edit]').forEach(b => b.addEventListener('click', () => {
    const item = NOTES.find(n => n.id === b.dataset.noteEdit); if (item) openPastoralForm(item);
  }));
  host.querySelector('#note-search')?.dispatchEvent(new Event('input'));
};
