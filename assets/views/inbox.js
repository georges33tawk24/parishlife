/* Messages: private conversations shown as cards. A conversation belongs to the people in it; writing to
   a parish office reaches whoever answers that office's inbox, writing to a ministry reaches its leaders.
   There is no editing or deleting; archiving only tidies this account's inbox. Super admins have a
   separate problem-review tab: each opening names one conversation, records a reason and is audited. */
import { api, session } from '../api.js';
import { t, fmtDate } from '../i18n.js';
import { bus, go } from '../store.js';
import { pageHead, panel, esc, pill, openModal, closeOverlays, toast } from '../ui.js';
import { icon } from '../icons.js';

const L = (en, ar) => t(en, ar);
const state = { box: 'inbox', q: '', page: 1, list: null, loading: false, error: '', open: null, openId: '', openError: '', directory: null, reports: null };
let unreadCount = 0;
export const inboxUnread = () => unreadCount;
const isReviewer = () => (session.authority?.system || []).includes('messages.emergency');
const when = at => { const d = at ? new Date(at) : null; return d && !Number.isNaN(d.getTime()) ? `${fmtDate(d)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''; };
const lines = text => esc(text).replace(/\n/g, '<br>');

async function loadList() {
  if (state.loading) return;
  state.loading = true;
  try {
    state.list = await api('messages', 'POST', { op: 'list', box: state.box, q: state.q, page: state.page });
    state.page = state.list.page; state.error = '';
    if (state.list.unread !== null && state.list.unread !== undefined) unreadCount = state.list.unread;
  } catch (e) { state.error = e.message; }
  finally { state.loading = false; bus.refresh(); }
}
async function loadConversation(id) {
  if (state.loading) return;
  state.loading = true; state.openId = id;
  try { state.open = await api('messages', 'POST', { op: 'open', id }); state.openError = ''; }
  catch (e) { state.open = null; state.openError = e.message; }
  finally { state.loading = false; state.list = null; bus.refresh(); }
}
export const reloadInbox = () => { state.list = null; state.open = null; state.openId = ''; state.openError = ''; };

/* Who a conversation is with, from this account's side of it. */
function counterpart(x) {
  const ctx = x.context || {}, parish = L(ctx.parish || '', ctx.parishAr || ctx.parish || '');
  const group = L(ctx.group || '', ctx.groupAr || ctx.group || '');
  const people = x.people.filter(Boolean).join(', ');
  if (x.kind === 'office') return x.side === 'person' ? L('Parish office', 'مكتب الرعية') + (parish ? ' · ' + parish : '') : (people || '—') + ' · ' + L('to the parish office', 'إلى مكتب الرعية');
  if (x.kind === 'ministry') return x.side === 'person' ? (group || L('Ministry', 'خدمة')) + (parish ? ' · ' + parish : '') : (people || '—') + ' · ' + (group || L('your ministry', 'خدمتك'));
  return people || L('Only you', 'أنت فقط');
}
const kindPill = x => x.kind === 'office' ? pill(L('Parish office', 'مكتب الرعية'), 'info', false)
  : x.kind === 'ministry' ? pill(L('Ministry', 'خدمة'), 'info', false) : pill(L('Direct', 'مباشرة'), '', false);

function card(x) {
  return `<a class="inbox-card ${x.unread ? 'unread' : ''}" href="#/inbox/${esc(x.id)}">
    <div class="inbox-card-top"><b class="inbox-who">${x.unread ? `<span class="inbox-dot" aria-hidden="true"></span><span class="sr-only">${L('Unread', 'غير مقروءة')}: </span>` : ''}${esc(counterpart(x))}</b>
      <time>${esc(when(x.lastAt))}</time></div>
    <div class="inbox-subject">${esc(x.subject)}</div>
    <p class="inbox-snippet">${x.lastMine ? `<span class="dim">${L('You', 'أنت')}:</span> ` : x.lastAuthor ? `<span class="dim">${esc(x.lastAuthor)}:</span> ` : ''}${esc(x.snippet)}</p>
    <div class="inbox-card-foot">${kindPill(x)}${x.archived ? pill(L('Archived', 'مؤرشفة'), '', false) : ''}<small class="dim">${esc(x.reference)} · ${x.count} ${x.count === 1 ? L('message', 'رسالة') : L('messages', 'رسائل')}</small></div></a>`;
}

function pager(d) {
  if (d.pages <= 1) return '';
  return `<nav class="pager" aria-label="${L('Pages', 'الصفحات')}"><button class="btn btn-secondary btn-dense" data-inbox-page="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>${icon('chevL', 16)}${L('Previous', 'السابق')}</button>
    <span>${L(`Page ${d.page} of ${d.pages}`, `الصفحة ${d.page} من ${d.pages}`)}</span>
    <button class="btn btn-secondary btn-dense" data-inbox-page="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>${L('Next', 'التالي')}${icon('chevR', 16)}</button></nav>`;
}

export function inbox(id) {
  const head = pageHead({ title: L('Messages', 'الرسائل'),
    sub: L('Private to the people in each conversation. Messages cannot be edited or deleted; archiving only tidies your own inbox.',
      'خاصة بالأشخاص المشاركين في كل محادثة. لا تُعدَّل الرسائل ولا تُحذف؛ والأرشفة ترتّب صندوقك أنت فقط.'),
    actions: `<button class="btn btn-primary" data-inbox-new>${icon('plus', 17)}${L('New message', 'رسالة جديدة')}</button>` });
  if (id) return head + conversation(id);
  if (state.box === 'reports') return head + tabs() + reports();
  if (!state.list && !state.loading && !state.error) loadList();
  if (state.error) return head + tabs() + `<div class="alert alert-danger" role="alert">${icon('warn', 18)}<span>${esc(state.error)}</span></div>`;
  if (!state.list) return head + tabs() + `<p class="dim">${L('Loading your messages…', 'جارٍ تحميل رسائلك…')}</p>`;
  const d = state.list;
  return head + tabs() + `<div class="inbox-list">${d.conversations.map(card).join('') ||
    `<div class="empty-state"><p>${state.q ? L('No conversations match this search.', 'لا محادثات تطابق هذا البحث.') : state.box === 'archived' ? L('Nothing archived.', 'لا شيء مؤرشف.') : L('No messages here yet.', 'لا رسائل هنا بعد.')}</p></div>`}</div>
    <p class="help">${L(`${d.total} conversation${d.total === 1 ? '' : 's'} · ${d.perPage} per page`, `${d.total} محادثة · ${d.perPage} في الصفحة`)}</p>${pager(d)}`;
}

function tabs() {
  const items = [['inbox', 'Inbox', 'الوارد'], ['unread', 'Unread', 'غير المقروءة'], ['archived', 'Archived', 'المؤرشفة'], ['all', 'All', 'الكل'],
    ...(isReviewer() ? [['reports', 'Problem reports', 'البلاغات']] : [])];
  return `<div class="toolbar inbox-tools"><div class="seg" role="group" aria-label="${L('Mailbox', 'الصندوق')}">${items.map(([k, en, ar]) =>
    `<button data-inbox-box="${k}" aria-pressed="${state.box === k}">${L(en, ar)}${k === 'inbox' && unreadCount ? ` <span class="tnum">${unreadCount}</span>` : ''}</button>`).join('')}</div>
    ${state.box === 'reports' ? '' : `<form class="inbox-search" data-inbox-search role="search"><input class="input" type="search" id="inbox-q" value="${esc(state.q)}" placeholder="${L('Search subject, reference or text', 'ابحث في الموضوع أو المرجع أو النص')}" aria-label="${L('Search messages', 'البحث في الرسائل')}"><button class="btn btn-secondary">${icon('search', 16)}${L('Search', 'بحث')}</button></form>`}</div>`;
}

function conversation(id) {
  if (state.openId !== id && !state.loading) { state.openError = ''; loadConversation(id); }
  if (state.openError && state.openId === id) return `<div class="alert alert-danger" role="alert">${icon('warn', 18)}<span>${esc(state.openError)}</span></div><a class="btn btn-secondary" href="#/inbox">${L('Back to messages', 'العودة إلى الرسائل')}</a>`;
  if (!state.open || state.open.conversation.id !== id) return `<p class="dim">${L('Opening the conversation…', 'جارٍ فتح المحادثة…')}</p>`;
  const { conversation: x, messages, reported } = state.open;
  const ctx = x.context || {};
  const author = m => m.mine ? L('You', 'أنت') : m.side === 'office' ? `${esc(m.author)} · ${L('Parish office', 'مكتب الرعية')}`
    : m.side === 'ministry' ? `${esc(m.author)} · ${esc(L(ctx.group || '', ctx.groupAr || ctx.group || '') || L('Ministry', 'خدمة'))}` : esc(m.author);
  return `<div class="inbox-thread-head"><a class="btn btn-secondary btn-dense" href="#/inbox">${icon('chevL', 16)}${L('Messages', 'الرسائل')}</a>
      <div><h2>${esc(x.subject)}</h2><p class="dim">${esc(counterpart(x))} · ${esc(x.reference)}</p></div>
      <div class="inbox-thread-actions">${kindPill(x)}
        <button class="btn btn-secondary btn-dense" data-inbox-op="${x.archived ? 'unarchive' : 'archive'}">${x.archived ? L('Move to inbox', 'نقل إلى الوارد') : L('Archive', 'أرشفة')}</button>
        <button class="btn btn-secondary btn-dense" data-inbox-op="markUnread">${L('Mark unread', 'تعليم كغير مقروءة')}</button>
        ${reported ? pill(L('Reported', 'مُبلَّغ عنها'), 'warning') : `<button class="btn btn-secondary btn-dense" data-inbox-report>${icon('warn', 15)}${L('Report a problem', 'الإبلاغ عن مشكلة')}</button>`}</div></div>
    <ol class="inbox-thread">${messages.map(m => `<li class="inbox-message ${m.mine ? 'mine' : ''}"><div class="inbox-message-head"><b>${author(m)}</b><time>${esc(when(m.at))}</time></div><p>${lines(m.body)}</p></li>`).join('')}</ol>
    ${panel(L('Reply', 'الرد'), `<div class="formrow"><label class="label" for="inbox-reply">${L('Your reply', 'ردّك')}</label><textarea class="textarea" id="inbox-reply" rows="4" maxlength="5000"></textarea></div>
      <p class="help">${L('Sent messages cannot be edited or deleted.', 'لا يمكن تعديل الرسائل المرسلة ولا حذفها.')}</p>
      <button class="btn btn-primary" data-inbox-send>${L('Send reply', 'إرسال الرد')}</button>`)}`;
}

function reports() {
  if (!state.reports && !state.loading) {
    state.loading = true;
    api('messages', 'POST', { op: 'reports' }).then(r => { state.reports = r; }).catch(e => { state.reports = { error: e.message, reports: [], reviews: [] }; })
      .finally(() => { state.loading = false; bus.refresh(); });
  }
  if (!state.reports) return `<p class="dim">${L('Loading reports…', 'جارٍ تحميل البلاغات…')}</p>`;
  const r = state.reports;
  return `<div class="alert alert-warning" role="note">${icon('shield', 18)}<span>${L('Opening a conversation here is an emergency problem review: it names one conversation, needs a recorded reason and is written to the audit trail. It never shows notes, pastoral notes or who sent an anonymous complaint.',
    'فتح محادثة هنا مراجعة طارئة لمشكلة: تخصّ محادثة واحدة وتحتاج سبباً مسجَّلاً وتُدوَّن في سجل التدقيق. ولا تُظهر الملاحظات ولا الملاحظات الرعوية ولا هوية مقدّم شكوى مجهولة.')}</span></div>
    ${r.error ? `<div class="alert alert-danger" role="alert">${esc(r.error)}</div>` : ''}
    ${panel(L('Reported conversations', 'المحادثات المُبلَّغ عنها'), r.reports.length ? `<div class="inbox-list">${r.reports.map(x => `<div class="inbox-card static"><div class="inbox-card-top"><b>${esc(x.reference)}</b><time>${esc(when(x.at))}</time></div>
      <p>${esc(x.reason)}</p><div class="inbox-card-foot">${x.status === 'open' ? pill(L('Open', 'مفتوح'), 'warning') : pill(L('Closed', 'مغلق'), 'success')}<small class="dim">${L('Reported by', 'أبلغ عنها')} ${esc(x.reporter)}</small>
      ${x.status === 'open' ? `<button class="btn btn-secondary btn-dense" data-inbox-review="${esc(x.id)}">${L('Review conversation', 'مراجعة المحادثة')}</button><button class="btn btn-secondary btn-dense" data-inbox-close="${esc(x.id)}">${L('Close report', 'إغلاق البلاغ')}</button>` : x.closeNote ? `<small>${esc(x.closeNote)}</small>` : ''}</div></div>`).join('')}</div>`
      : `<p class="dim">${L('No conversation has been reported.', 'لم يُبلَّغ عن أي محادثة.')}</p>`)}
    ${panel(L('Review by reference', 'مراجعة بحسب المرجع'), `<p class="help">${L('Only for a specific, documented problem, for example when a participant gives you the reference.', 'فقط لمشكلة محددة وموثّقة، مثلاً عندما يعطيك أحد المشاركين المرجع.')}</p>
      <div class="formrow"><label class="label" for="inbox-ref">${L('Conversation reference', 'مرجع المحادثة')}</label><input class="input" id="inbox-ref" placeholder="MSG-…" autocomplete="off"></div>
      <button class="btn btn-secondary" data-inbox-review-ref>${L('Continue', 'متابعة')}</button>`)}
    ${panel(L('Emergency reviews recorded', 'المراجعات الطارئة المسجّلة'), r.reviews.length ? `<ul class="inbox-log">${r.reviews.map(x => `<li><b>${esc(x.reference)}</b> · ${esc(x.reviewer)} · ${esc(when(x.at))}<br><span class="dim">${esc(x.reason)}</span></li>`).join('')}</ul>`
      : `<p class="dim">${L('None yet.', 'لا شيء بعد.')}</p>`)}`;
}

/* The reason comes first; only then is the one conversation shown, read-only. */
function emergencyDialog(target) {
  openModal({ title: L('Emergency problem review', 'مراجعة طارئة لمشكلة'),
    sub: L('Record why you need to read this conversation. The reason and your access are kept in the audit trail.', 'سجّل سبب حاجتك إلى قراءة هذه المحادثة. يُحفظ السبب ووصولك في سجل التدقيق.'),
    body: `<div class="formrow"><label class="label" for="inbox-reason">${L('Reason', 'السبب')} <span class="req">*</span></label><textarea class="textarea" id="inbox-reason" rows="4" maxlength="1000" aria-describedby="inbox-reason-error"></textarea>
      <p class="field-error" id="inbox-reason-error" hidden></p></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="inbox-reason-go">${L('Record and open', 'تسجيل وفتح')}</button>`,
    onMount(el) {
      el.querySelector('#inbox-reason-go').addEventListener('click', async () => {
        const reason = el.querySelector('#inbox-reason').value.trim(), error = el.querySelector('#inbox-reason-error');
        if (reason.length < 20) { error.textContent = L('Write the reason as a full sentence (at least 20 characters).', 'اكتب السبب جملةً كاملة (٢٠ حرفاً على الأقل).'); error.hidden = false; el.querySelector('#inbox-reason').focus(); return; }
        try {
          const r = await api('messages', 'POST', { op: 'emergencyOpen', reason, ...target });
          state.reports = null; closeOverlays();
          openModal({ title: `${r.conversation.reference} · ${r.conversation.subject}`, sub: L('Read-only. This access was recorded.', 'للقراءة فقط. سُجّل هذا الوصول.'),
            body: `<p class="dim">${esc(r.conversation.people.join(', '))}</p><ol class="inbox-thread">${r.messages.map(m => `<li class="inbox-message"><div class="inbox-message-head"><b>${esc(m.author)}</b><time>${esc(when(m.at))}</time></div><p>${lines(m.body)}</p></li>`).join('')}</ol>`,
            foot: `<button class="btn btn-primary" data-close>${L('Close', 'إغلاق')}</button>` });
          bus.refresh();
        } catch (e) { error.textContent = e.message; error.hidden = false; }
      });
    } });
}

/* New message: a parish office, a ministry, or people from the directory. */
async function composer(preset = {}) {
  let dir = state.directory;
  try { if (!dir) dir = state.directory = await api('messages', 'POST', { op: 'directory' }); }
  catch (e) { toast(L('Could not load the directory', 'تعذّر تحميل الدليل'), e.message, 'danger'); return; }
  const kinds = [['office', 'A parish office', 'مكتب رعية', dir.offices.length], ['ministry', 'A ministry', 'خدمة', dir.ministries.length], ['direct', 'People', 'أشخاص', dir.people.length]].filter(k => k[3]);
  if (!kinds.length) { toast(L('No one to write to yet', 'لا أحد لمراسلته بعد'), L('Follow or join a parish first.', 'تابع رعية أو انتسب إليها أولاً.'), 'warning'); return; }
  const start = kinds.some(k => k[0] === preset.kind) ? preset.kind : kinds[0][0];
  openModal({ title: L('New message', 'رسالة جديدة'), sub: L('Only the people you write to can read it.', 'لا يقرؤها إلا من تراسلهم.'),
    body: `<fieldset class="formrow"><legend class="label">${L('To', 'إلى')}</legend><div class="seg" role="radiogroup">${kinds.map(([k, en, ar]) => `<label class="seg-radio"><input type="radio" name="inbox-kind" value="${k}" ${k === start ? 'checked' : ''}><span>${L(en, ar)}</span></label>`).join('')}</div></fieldset>
      <div class="formrow" data-to="office"><label class="label" for="inbox-office">${L('Parish office', 'مكتب الرعية')}</label><select class="select" id="inbox-office">${dir.offices.map(o => `<option value="${esc(o.parish)}" ${preset.parish === o.parish ? 'selected' : ''}>${esc(L(o.name, o.ar || o.name))}</option>`).join('')}</select>
        <p class="help">${L('Read and answered by the people who handle that parish’s office inbox.', 'يقرؤها ويجيب عنها من يتولّون بريد مكتب تلك الرعية.')}</p></div>
      <div class="formrow" data-to="ministry"><label class="label" for="inbox-ministry">${L('Ministry', 'الخدمة')}</label><select class="select" id="inbox-ministry">${dir.ministries.map(m => `<option value="${esc(m.parish + '|' + m.group)}" ${preset.group === m.group ? 'selected' : ''}>${esc(L(m.name, m.ar || m.name))} · ${esc(m.parishName)}</option>`).join('')}</select>
        <p class="help">${L('Reaches the ministry’s leader and assistant.', 'تصل إلى مسؤول الخدمة ومساعده.')}</p></div>
      <div class="formrow" data-to="direct"><label class="label" for="inbox-people-find">${L('People', 'الأشخاص')}</label><input class="input" id="inbox-people-find" type="search" placeholder="${L('Filter the directory', 'تصفية الدليل')}">
        <div class="inbox-people" role="group" aria-label="${L('Choose up to ten people', 'اختر حتى عشرة أشخاص')}">${dir.people.map(p => `<label class="check" data-person-name="${esc(p.name.toLowerCase())}"><input type="checkbox" value="${esc(p.id)}"><span>${esc(p.name)} <small class="dim">${esc(p.places.map(x => L(x.role, x.roleAr) + ' · ' + x.name).join('; '))}</small></span></label>`).join('')}</div>
        <p class="help">${L('Parish staff, and members who agreed to be listed in their parish directory.', 'العاملون في الرعية، والأعضاء الذين وافقوا على إدراجهم في دليل رعيتهم.')}</p></div>
      <div class="formrow"><label class="label" for="inbox-subject">${L('Subject', 'الموضوع')} <span class="req">*</span></label><input class="input" id="inbox-subject" maxlength="160" value="${esc(preset.subject || '')}"></div>
      <div class="formrow"><label class="label" for="inbox-body">${L('Message', 'الرسالة')} <span class="req">*</span></label><textarea class="textarea" id="inbox-body" rows="6" maxlength="5000"></textarea></div>
      <p class="field-error" id="inbox-new-error" role="alert" hidden></p>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="inbox-new-send">${L('Send', 'إرسال')}</button>`,
    onMount(el) {
      const kind = () => el.querySelector('input[name=inbox-kind]:checked')?.value;
      const sync = () => el.querySelectorAll('[data-to]').forEach(row => { row.hidden = row.dataset.to !== kind(); });
      el.querySelectorAll('input[name=inbox-kind]').forEach(r => r.addEventListener('change', sync)); sync();
      el.querySelector('#inbox-people-find')?.addEventListener('input', e => {
        const q = e.target.value.trim().toLowerCase();
        el.querySelectorAll('[data-person-name]').forEach(row => { row.hidden = !!q && !row.dataset.personName.includes(q); });
      });
      el.querySelector('#inbox-new-send').addEventListener('click', async e => {
        const error = el.querySelector('#inbox-new-error'), say = m => { error.textContent = m; error.hidden = !m; };
        const subject = el.querySelector('#inbox-subject').value.trim(), body = el.querySelector('#inbox-body').value.trim();
        let to;
        if (kind() === 'office') to = { kind: 'office', parish: el.querySelector('#inbox-office').value };
        else if (kind() === 'ministry') { const [parish, group] = el.querySelector('#inbox-ministry').value.split('|'); to = { kind: 'ministry', parish, group }; }
        else to = { kind: 'direct', people: [...el.querySelectorAll('.inbox-people input:checked')].map(x => x.value) };
        if (to.kind === 'direct' && (!to.people.length || to.people.length > 10)) return say(L('Choose between one and ten people.', 'اختر من شخص واحد إلى عشرة أشخاص.'));
        if (!subject) { el.querySelector('#inbox-subject').focus(); return say(L('Enter a subject.', 'أدخل الموضوع.')); }
        if (!body) { el.querySelector('#inbox-body').focus(); return say(L('Write your message.', 'اكتب رسالتك.')); }
        e.currentTarget.disabled = true;
        try {
          const r = await api('messages', 'POST', { op: 'start', to, subject, body });
          closeOverlays(); state.list = null; toast(L('Message sent', 'أُرسلت الرسالة'), '', 'success'); go('inbox/' + r.id);
        } catch (err) { e.currentTarget.disabled = false; say(err.message); }
      });
    } });
}
export const composeMessage = preset => composer(preset);

inbox.mount = (host, id) => {
  const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(L('Not done', 'لم يتمّ'), e.message, 'danger'); } };
  host.querySelector('[data-inbox-new]')?.addEventListener('click', () => composer());
  host.querySelectorAll('[data-inbox-box]').forEach(b => b.addEventListener('click', () => {
    state.box = b.dataset.inboxBox; state.page = 1; state.list = null; state.error = '';
    if (state.box === 'reports') state.reports = null;
    if (id) go('inbox'); else bus.refresh();
  }));
  host.querySelector('[data-inbox-search]')?.addEventListener('submit', e => {
    e.preventDefault(); state.q = host.querySelector('#inbox-q').value.trim(); state.page = 1; state.list = null; bus.refresh();
  });
  host.querySelectorAll('[data-inbox-page]').forEach(b => b.addEventListener('click', () => { state.page = Number(b.dataset.inboxPage); state.list = null; bus.refresh(); }));
  host.querySelectorAll('[data-inbox-op]').forEach(b => b.addEventListener('click', guard(async () => {
    const op = b.dataset.inboxOp;
    await api('messages', 'POST', { op, id });
    state.list = null;
    if (op === 'markUnread' || op === 'archive') { state.open = null; state.openId = ''; go('inbox'); toast(op === 'archive' ? L('Archived', 'أُرشفت') : L('Marked unread', 'عُلّمت كغير مقروءة'), '', 'success'); }
    else { state.open = null; state.openId = ''; bus.refresh(); }
  })));
  host.querySelector('[data-inbox-send]')?.addEventListener('click', guard(async () => {
    const box = host.querySelector('#inbox-reply'), body = box.value.trim();
    if (!body) { box.focus(); return; }
    await api('messages', 'POST', { op: 'reply', id, body });
    state.open = null; state.openId = ''; state.list = null; toast(L('Reply sent', 'أُرسل الرد'), '', 'success'); bus.refresh();
  }));
  host.querySelector('[data-inbox-report]')?.addEventListener('click', () => openModal({ title: L('Report a problem', 'الإبلاغ عن مشكلة'),
    sub: L('A super admin may then open this one conversation for review, recording why. Nobody else is told.', 'قد يفتح المدير العام هذه المحادثة وحدها للمراجعة مع تسجيل السبب. ولا يُبلَّغ أحد غيره.'),
    body: `<div class="formrow"><label class="label" for="inbox-report-reason">${L('What is the problem?', 'ما المشكلة؟')}</label><textarea class="textarea" id="inbox-report-reason" rows="4" maxlength="1000"></textarea></div><p class="field-error" id="inbox-report-error" role="alert" hidden></p>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="inbox-report-send">${L('Send report', 'إرسال البلاغ')}</button>`,
    onMount(el) { el.querySelector('#inbox-report-send').addEventListener('click', async () => {
      const reason = el.querySelector('#inbox-report-reason').value.trim(), error = el.querySelector('#inbox-report-error');
      if (reason.length < 10) { error.textContent = L('Say in a sentence what the problem is.', 'قل في جملة ما المشكلة.'); error.hidden = false; return; }
      try { await api('messages', 'POST', { op: 'report', id, reason }); closeOverlays(); state.open = null; state.openId = ''; toast(L('Report sent', 'أُرسل البلاغ'), '', 'success'); bus.refresh(); }
      catch (e) { error.textContent = e.message; error.hidden = false; }
    }); } }));
  host.querySelectorAll('[data-inbox-review]').forEach(b => b.addEventListener('click', () => emergencyDialog({ reportId: b.dataset.inboxReview })));
  host.querySelector('[data-inbox-review-ref]')?.addEventListener('click', () => {
    const reference = host.querySelector('#inbox-ref').value.trim();
    if (!/^MSG-[0-9A-F]{8}$/i.test(reference)) { host.querySelector('#inbox-ref').focus(); toast(L('Enter a reference like MSG-1A2B3C4D', 'أدخل مرجعاً مثل MSG-1A2B3C4D'), '', 'warning'); return; }
    emergencyDialog({ reference });
  });
  host.querySelectorAll('[data-inbox-close]').forEach(b => b.addEventListener('click', () => openModal({ title: L('Close this report?', 'إغلاق هذا البلاغ؟'),
    body: `<div class="formrow"><label class="label" for="inbox-close-note">${L('Note (optional)', 'ملاحظة (اختياري)')}</label><textarea class="textarea" id="inbox-close-note" rows="3" maxlength="1000"></textarea></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="inbox-close-go">${L('Close report', 'إغلاق البلاغ')}</button>`,
    onMount(el) { el.querySelector('#inbox-close-go').addEventListener('click', guard(async () => {
      await api('messages', 'POST', { op: 'reportClose', id: b.dataset.inboxClose, note: el.querySelector('#inbox-close-note').value.trim() });
      closeOverlays(); state.reports = null; bus.refresh();
    })); } })));
};
