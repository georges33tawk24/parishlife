/* A member sees a server-built projection, never the parish administration state. */
import { t, fmtDate } from '../i18n.js';
import { M, memberAction, loadMember } from '../member-data.js';
import { session } from '../api.js';
import { hydrate } from '../persist.js';
import { bus, go, S } from '../store.js';
import { esc, openDrawer, closeOverlays, toast } from '../ui.js';

const L = (en, ar) => t(en, ar);
const date = value => value ? fmtDate(value) : '—';
const txt = value => esc(String(value ?? ''));
const title = (name, sub = '') => `<header class="member-head"><h1>${txt(name)}</h1>${sub ? `<p>${txt(sub)}</p>` : ''}</header>`;
const blank = (message, action = '') => `<div class="member-empty"><p>${txt(message)}</p>${action}</div>`;
const card = (body, cls = '') => `<section class="member-card ${cls}">${body}</section>`;
const link = (route, label) => `<a class="btn btn-secondary btn-dense" href="#/${route}">${txt(label)}</a>`;
const groupName = id => M.groups.find(g => g.id === id)?.name || M.parish.name || '';
const sorted = rows => [...rows].sort((a, b) => (a.date || a.d || a.at || '').localeCompare(b.date || b.d || b.at || ''));
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayKey = () => dayKey(new Date());
const upcoming = () => M.meetings.filter(m => m.date >= todayKey());
const attendance = () => {
  const past = M.meetings.filter(m => m.date < todayKey() && !['upcoming','unrecorded'].includes(m.attendance));
  const attended = past.filter(m => ['present', 'attended', 'late'].includes(m.attendance)).length;
  const counted = past.filter(m => m.attendance !== 'excused');
  return { past, attended, percent: counted.length ? Math.round(attended / counted.length * 100) : null };
};
const status = value => `<span class="member-badge">${txt(value)}</span>`;
const contentRows = (kind, filter = () => true) => M.content.filter(x => x.kind === kind && filter(x));

export function home() {
  const next = upcoming()[0], stats = attendance();
  const unread = M.content.filter(x => !x.read && !x.archived && ['message', 'announcement', 'discussion'].includes(x.kind)).length;
  const commitments = Object.values(M.commitments).filter(x => ['confirmed', 'volunteer', 'interested'].includes(x.status)).length;
  const nextBody = next
    ? `<strong>${txt(next.title)}</strong><p>${txt(next.group)} · ${date(next.date)} · ${txt(next.time)} · ${txt(next.location || 'Location to be confirmed')}</p>${link('mymeetings', L('View meeting', 'عرض الاجتماع'))}`
    : blank(L('No upcoming ministry meetings yet.', 'لا اجتماعات خدمة مقبلة حالياً.'), link('mycalendar', L('View calendar', 'عرض الرزنامة')));
  return `<div class="member-page">${title(L('Welcome,', 'أهلاً،') + ' ' + (M.person.lat || '').split(' ')[0],
    L('Here is what is happening in your parish life.', 'إليك ما يجري في حياتك الرعوية.'))}
    <div class="member-grid member-home-grid">
      ${card(`<h2>${L('Next meeting', 'الاجتماع المقبل')}</h2>${nextBody}`)}
      ${card(`<h2>${L('My ministries', 'خدماتي')}</h2>${M.groups.length ? M.groups.map(g => `<div class="member-simple-row"><b>${txt(g.name)}</b>${status(g.position || L('Member', 'عضو'))}</div>`).join('') : blank(L('You are not currently in a ministry.', 'لست منضمّاً إلى خدمة حالياً.'))}${link('myministries', L('View ministries', 'عرض الخدمات'))}`)}
      ${card(`<h2>${L('Upcoming', 'القادم')}</h2>${sorted([...upcoming(), ...M.events.filter(e => e.d >= todayKey())]).slice(0, 4).map(e => `<div class="member-simple-row"><span>${txt(e.title)}</span><small>${date(e.date || e.d)}</small></div>`).join('') || blank(L('Nothing on your calendar yet.', 'لا مواعيد في رزنامتك حالياً.'))}${link('mycalendar', L('Open calendar', 'فتح الرزنامة'))}`)}
      ${card(`<h2>${L('Announcements', 'الإعلانات')}</h2>${M.content.filter(x=>['announcement','post'].includes(x.kind)).slice(0, 2).map(x => `<p><b>${txt(x.title)}</b><br><small>${txt(groupName(x.groupId))}</small></p>`).join('') || blank(L('No new announcements.', 'لا إعلانات جديدة.'))}${link('myfeed', L('Read updates', 'قراءة المستجدات'))}`)}
      ${card(`<h2>${L('My attendance', 'حضوري')}</h2><strong>${stats.percent === null ? '—' : stats.percent + '%'}</strong><p>${stats.attended} ${L('attended', 'حضور')} · ${stats.past.filter(x => x.attendance === 'excused').length} ${L('excused', 'غياب معذور')}</p>${link('myattendance', L('View history', 'عرض السجل'))}`)}
      ${card(`<h2>${L('Messages & commitments', 'الرسائل والالتزامات')}</h2><p>${unread} ${L('unread communications', 'رسائل غير مقروءة')} · ${commitments} ${L('active commitments', 'التزامات حالية')}</p>${link('mymessages', L('Messages', 'الرسائل'))} ${link('mycommitments', L('Commitments', 'الالتزامات'))}`)}
    </div><div class="member-actions">${link('mynotes', L('My Notes', 'ملاحظاتي'))}${link('myresources', L('Resources', 'الموارد'))}${link('membernotifications', L('Notifications', 'الإشعارات'))}${link('myconcerns', L('Submit a Concern', 'تقديم ملاحظة أو قلق'))}${link('myprofile', L('Update my information', 'تحديث معلوماتي'))}</div></div>`;
}

export function ministries() {
  return `<div class="member-page">${title(L('My ministries', 'خدماتي'), L('Your membership is separate from a leadership position.', 'عضويتك منفصلة عن أي منصب قيادي.'))}
    <div class="member-grid">${M.groups.map(g => card(`<h2>${txt(g.name)}</h2><p>${txt(g.category)}</p><p>${status(g.position || L('Member', 'عضو'))}</p><div class="member-actions">${link('mymeetings', L('Meetings', 'الاجتماعات'))}${link('myresources', L('Resources', 'الموارد'))}</div>`)).join('') || blank(L('No ministry membership is recorded for your account.', 'لا توجد عضوية خدمة مسجّلة لحسابك.'))}</div></div>`;
}

export function meetings() {
  const rows = [...M.meetings].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return `<div class="member-page">${title(L('Meetings', 'الاجتماعات'), L('Meetings for the ministries you belong to.', 'اجتماعات الخدمات التي تنتمي إليها.'))}
    <div class="member-toolbar"><select class="select" data-filter="group"><option value="">${L('All ministries', 'كل الخدمات')}</option>${M.groups.map(g => `<option value="${txt(g.id)}">${txt(g.name)}</option>`).join('')}</select></div>
    <div class="member-list">${rows.map(m => card(`<div class="member-row"><div><h2>${txt(m.title)}</h2><p>${txt(m.group)} · ${date(m.date)} · ${txt(m.time)} · ${txt(m.location || L('Location to be confirmed', 'المكان يحدّد لاحقاً'))}</p></div>${status(m.attendance)}</div><button class="btn btn-secondary btn-dense" data-meeting="${txt(m.id)}">${L('View details', 'عرض التفاصيل')}</button>`, 'member-filter-row') .replace('member-filter-row"', `member-filter-row" data-group="${txt(m.groupId)}"`)).join('') || blank(L('No meetings are recorded for your ministries.', 'لا اجتماعات مسجّلة لخدماتك.'))}</div></div>`;
}

export function attendancePage() {
  const stats = attendance();
  return `<div class="member-page">${title(L('My attendance', 'حضوري'), L('A personal record to help you stay informed.', 'سجل شخصي لمساعدتك على المتابعة.'))}
    <div class="member-grid">${card(`<h2>${L('Attendance', 'الحضور')}</h2><strong>${stats.percent === null ? '—' : stats.percent + '%'}</strong><p>${stats.attended} ${L('attended', 'حضور')} · ${stats.past.filter(m => m.attendance === 'absent').length} ${L('absent', 'غياب')} · ${stats.past.filter(m => m.attendance === 'excused').length} ${L('excused', 'غياب معذور')} · ${stats.past.filter(m => m.attendance === 'late').length} ${L('late', 'تأخير')}</p>`)}</div>
    <div class="member-toolbar"><select class="select" data-filter="group"><option value="">${L('All ministries', 'كل الخدمات')}</option>${M.groups.map(g => `<option value="${txt(g.id)}">${txt(g.name)}</option>`).join('')}</select><select class="select" data-filter="status"><option value="">${L('All statuses', 'كل الحالات')}</option>${['present','absent','excused','late','unrecorded','upcoming'].map(x => `<option>${x}</option>`).join('')}</select><input class="input" type="date" data-filter="from" aria-label="${L('From date', 'من تاريخ')}"><input class="input" type="date" data-filter="to" aria-label="${L('To date', 'حتى تاريخ')}"></div>
    <div class="member-list">${[...M.meetings].reverse().map(m => `<div class="member-card member-filter-row" data-group="${txt(m.groupId)}" data-status="${txt(m.attendance)}" data-date="${txt(m.date)}"><div class="member-row"><div><h2>${txt(m.title)}</h2><p>${txt(m.group)} · ${date(m.date)} · ${txt(m.time)}</p></div>${status(m.attendance)}</div></div>`).join('') || blank(L('Attendance will appear after your first ministry meeting.', 'يظهر سجل الحضور بعد أول اجتماع لخدمتك.'))}</div></div>`;
}

export function calendar() {
  const mode = S.ui.memberCalendarMode || 'agenda';
  const items = sorted([...M.events.map(e => ({ ...e, date:e.d, source:e.kind === 'mass' ? 'Liturgy' : 'Parish' })),
    ...M.meetings.map(m => ({ ...m, source:'Meetings' })),
    ...M.notes.filter(n => n.reminder).map(n => ({ id:n.id, title:n.title, date:n.reminder, source:'Reminder' }))]);
  const today = new Date(), offset = S.ui.memberCalendarOffset || 0;
  const start = mode === 'week' ? new Date(today.getFullYear(),today.getMonth(),today.getDate()-((today.getDay()+6)%7)+offset*7)
    : new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const end = mode === 'week' ? new Date(start.getFullYear(),start.getMonth(),start.getDate()+7)
    : new Date(start.getFullYear(), start.getMonth()+1, 1);
  const shown = mode === 'agenda' ? items.filter(x => x.date >= dayKey(today)).slice(0, 30)
    : items.filter(x => x.date >= dayKey(start) && x.date < dayKey(end));
  return `<div class="member-page">${title(L('My calendar', 'رزنامتي'), L('Ministry meetings, parish events and personal reminders.', 'اجتماعات الخدمة والمناسبات الرعوية والتذكيرات الشخصية.'))}
    <div class="member-toolbar"><div class="seg" role="group" aria-label="${L('Calendar view', 'عرض الرزنامة')}">${[['agenda','Agenda','قائمة'],['week','Week','أسبوع'],['month','Month','شهر']].map(([id,en,ar]) => `<button data-calendar-mode="${id}" aria-pressed="${mode === id}">${L(en,ar)}</button>`).join('')}</div>${mode === 'agenda' ? '' : `<button class="btn btn-secondary btn-dense" data-calendar-offset="-1">‹</button><span>${txt(mode === 'week' ? date(dayKey(start)) + ' – ' + date(dayKey(new Date(end.getTime()-86400000))) : start.toLocaleDateString(undefined,{month:'long',year:'numeric'}))}</span><button class="btn btn-secondary btn-dense" data-calendar-offset="1">›</button>`}<select class="select" data-filter="source"><option value="">${L('All activities', 'كل الأنشطة')}</option><option>Meetings</option><option>Parish</option><option>Liturgy</option><option>Reminder</option></select></div>
    <div class="member-list">${shown.map(x => `<div class="member-card member-filter-row" data-source="${txt(x.source)}"><div class="member-row"><div><h2>${txt(x.title)}</h2><p>${date(x.date)} · ${txt(x.time || x.t || '')} · ${txt(x.location || '')}</p></div>${status(x.source)}</div></div>`).join('') || blank(L('No activities in this view.', 'لا أنشطة في هذا العرض.'))}</div></div>`;
}

export function messages() {
  const rows = M.content.filter(x => ['message', 'announcement', 'discussion'].includes(x.kind));
  const filter = S.ui.memberMessageFilter || 'inbox';
  const selected = rows.filter(x => filter === 'archived' ? x.archived : !x.archived &&
    (filter === 'all' || filter === 'sent' && x.authorId === session.user?.id ||
     filter === 'announcements' && x.kind === 'announcement' || filter === 'inbox' && x.authorId !== session.user?.id));
  return `<div class="member-page">${title(L('Messages', 'الرسائل'), L('Announcements are one-way; conversations can receive replies.', 'الإعلانات باتجاه واحد، ويمكن الرد على المحادثات.'))}
    ${M.groups.length ? `<div class="member-actions"><button class="btn btn-primary" data-member-compose>${L('Message my ministry', 'مراسلة خدمتي')}</button></div>` : ''}
    <div class="member-toolbar"><div class="seg" role="group">${[['inbox','Inbox','الوارد'],['sent','Sent','المرسل'],['announcements','Announcements','الإعلانات'],['archived','Archived','الأرشيف'],['all','All','الكل']].map(([id,en,ar]) => `<button data-message-filter="${id}" aria-pressed="${filter === id}">${L(en,ar)}</button>`).join('')}</div><input class="input" type="search" data-member-search placeholder="${L('Search communications', 'البحث في الرسائل')}"></div>
    <div class="member-list">${selected.map(x => `<div class="member-card member-search-row" data-search="${txt(x.title + ' ' + x.body)}"><div class="member-row"><div><h2>${txt(x.title)} ${!x.read ? status(L('Unread', 'غير مقروء')) : ''}</h2><p>${txt(groupName(x.groupId))} · ${date(x.at)}</p></div>${status(x.kind === 'announcement' ? L('Announcement', 'إعلان') : x.kind === 'discussion' ? L('Group conversation', 'محادثة جماعية') : L('Message', 'رسالة'))}</div><p>${txt(x.body)}</p>${x.attachment ? `<a class="btn btn-secondary btn-dense" download="${txt(x.attachment.name)}" href="${txt(x.attachment.data)}">${L('Download attachment', 'تنزيل المرفق')}</a>` : ''}<div class="member-actions">${x.kind === 'discussion' ? `<button class="btn btn-primary btn-dense" data-discussion="${txt(x.id)}">${L('Open conversation', 'فتح المحادثة')}</button>` : ''}${x.read ? '' : `<button class="btn btn-secondary btn-dense" data-member-read="${txt(x.id)}">${L('Mark read', 'تعليم كمقروء')}</button>`}<button class="btn btn-secondary btn-dense" data-member-archive="${txt(x.id)}" data-archive-op="${x.archived ? 'unarchive' : 'archive'}">${x.archived ? L('Restore', 'استعادة') : L('Archive', 'أرشفة')}</button></div></div>`).join('') || blank(L('No communications in this view.', 'لا رسائل في هذا العرض.'))}</div></div>`;
}

export function feed() {
  const rows = M.content.filter(x => ['post','announcement'].includes(x.kind)).sort((a,b) => Number(b.pinned)-Number(a.pinned) || b.at.localeCompare(a.at));
  return `<div class="member-page">${title(L('Ministry updates', 'مستجدات الخدمة'), L('Posts and announcements from your ministries and parish.', 'منشورات وإعلانات خدماتك والرعية.'))}<div class="member-toolbar"><input class="input" type="search" data-member-search placeholder="${L('Search updates', 'البحث في المستجدات')}"></div><div class="member-list">${rows.map(x => card(`<h2>${txt(x.title)} ${x.pinned ? status(L('Pinned', 'مثبّت')) : ''}</h2><p class="dim">${txt(groupName(x.groupId))} · ${date(x.at)} · ${txt(x.category)}</p><p>${txt(x.body)}</p>${x.attachment ? `<a class="btn btn-secondary btn-dense" download="${txt(x.attachment.name)}" href="${txt(x.attachment.data)}">${L('Download attachment', 'تنزيل المرفق')}</a>` : ''}`, 'member-search-row') .replace('member-search-row"', `member-search-row" data-search="${txt(x.title + ' ' + x.body)}"`)).join('') || blank(L('No updates have been published yet.', 'لم تُنشر مستجدات بعد.'))}</div></div>`;
}

export function resources() {
  const rows = contentRows('resource');
  return `<div class="member-page">${title(L('Resources', 'الموارد'), L('Documents and materials shared with your ministries.', 'ملفات ومواد مشتركة مع خدماتك.'))}<div class="member-toolbar"><select class="select" data-filter="group"><option value="">${L('All ministries', 'كل الخدمات')}</option>${M.groups.map(g => `<option value="${txt(g.id)}">${txt(g.name)}</option>`).join('')}</select><input class="input" type="search" data-member-search placeholder="${L('Search resources', 'البحث في الموارد')}"></div><div class="member-list">${rows.map(x => `<div class="member-card member-filter-row member-search-row" data-group="${txt(x.groupId)}" data-search="${txt(x.title + ' ' + x.body + ' ' + x.category)}"><h2>${txt(x.title)}</h2><p>${txt(groupName(x.groupId))} · ${txt(x.category)} · ${date(x.at)}</p><p>${txt(x.body)}</p>${x.attachment ? `<a class="btn btn-secondary btn-dense" download="${txt(x.attachment.name)}" href="${txt(x.attachment.data)}">${L('Download', 'تنزيل')}</a>` : ''}</div>`).join('') || blank(L('No resources have been shared yet.', 'لا موارد مشتركة حالياً.'))}</div></div>`;
}

export function formation() {
  return `<div class="member-page">${title(L('Formation', 'التنشئة'), L('Training and faith-development materials from your ministries.', 'مواد التدريب والتنشئة من خدماتك.'))}
    <div class="member-list">${M.formation.map(x=>card(`<h2>${txt(x.name)}</h2><p>${txt(groupName(x.groupId))}</p><p>${txt(x.description)}</p>${status(x.completion?.date ? L('Completed', 'مكتمل') + ' · ' + date(x.completion.date) : L('Available', 'متاح'))}`)).join('') || blank(L('No formation material is assigned to your ministries.', 'لا مواد تنشئة مخصصة لخدماتك حالياً.'))}</div></div>`;
}

export function commitments() {
  const rows = contentRows('opportunity');
  return `<div class="member-page">${title(L('Volunteer opportunities', 'فرص التطوع'), L('Express interest; a leader can confirm the assignment.', 'أبدِ اهتمامك، ثم يؤكد المسؤول المهمة.'))}<div class="member-list">${rows.map(x => `<div class="member-card"><h2>${txt(x.title)}</h2><p>${txt(groupName(x.groupId))} · ${txt(x.category)}</p><p>${txt(x.body)}</p><p>${status(M.commitments[x.id]?.status || L('Open', 'متاحة'))}</p><div class="member-actions"><button class="btn btn-primary btn-dense" data-volunteer="${txt(x.id)}" data-status="volunteer">${L('Volunteer', 'أتطوّع')}</button><button class="btn btn-secondary btn-dense" data-volunteer="${txt(x.id)}" data-status="interested">${L("I'm interested", 'أنا مهتم')}</button>${M.commitments[x.id] ? `<button class="btn btn-secondary btn-dense" data-volunteer="${txt(x.id)}" data-status="withdrawn">${L('Withdraw', 'انسحاب')}</button>` : ''}</div></div>`).join('') || blank(L('No volunteer opportunities are open yet.', 'لا فرص تطوع متاحة حالياً.'))}</div></div>`;
}

export function notes() {
  const query = S.ui.memberNoteQuery || '';
  const rows = [...M.notes].sort((a,b) => Number(b.pinned)-Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  return `<div class="member-page">${title(L('My Notes', 'ملاحظاتي'), L('Private to you. Leaders and parish staff do not automatically see these notes.', 'خاصة بك. لا يطّلع المسؤولون والعاملون في الرعية عليها تلقائياً.'))}<div class="member-actions"><button class="btn btn-primary" data-note-new>${L('New note', 'ملاحظة جديدة')}</button></div><div class="member-toolbar"><input class="input" type="search" data-note-search value="${txt(query)}" placeholder="${L('Search notes', 'البحث في الملاحظات')}"><select class="select" data-filter="category"><option value="">${L('All categories', 'كل الفئات')}</option>${[...new Set(rows.map(n=>n.category).filter(Boolean))].map(x => `<option>${txt(x)}</option>`).join('')}</select></div><div class="member-list">${rows.map(n => `<div class="member-card member-filter-row member-search-row" data-category="${txt(n.category)}" data-search="${txt(n.title + ' ' + n.body + ' ' + n.tags.join(' '))}"><div class="member-row"><h2>${txt(n.title)} ${n.pinned ? status(L('Pinned', 'مثبّتة')) : ''}</h2><small>${date(n.updatedAt)}</small></div><p>${txt(n.body)}</p><p class="dim">${txt(n.category)} ${n.tags.map(tag=>`#${txt(tag)}`).join(' ')} ${n.reminder ? '· ' + date(n.reminder) : ''}</p><button class="btn btn-secondary btn-dense" data-note-edit="${txt(n.id)}">${L('Edit', 'تعديل')}</button><button class="btn btn-secondary btn-dense" data-note-delete="${txt(n.id)}">${L('Delete', 'حذف')}</button></div>`).join('') || blank(L('Your private notes will appear here.', 'تظهر ملاحظاتك الخاصة هنا.'))}</div></div>`;
}

export function profile() {
  const p = M.person;
  return `<div class="member-page">${title(L('My profile', 'ملفي'), L('Your official record is maintained by the parish office.', 'يحتفظ مكتب الرعية بسجلك الرسمي.'))}${card(`<h2>${txt(p.lat)}</h2><p>${txt(p.ar)}</p><dl class="member-profile"><dt>${L('Parish membership', 'العضوية الرعوية')}</dt><dd>${txt(p.status)}</dd><dt>${L('Phone', 'الهاتف')}</dt><dd>${txt(p.phone || '—')}</dd><dt>${L('Email', 'البريد الإلكتروني')}</dt><dd>${txt(p.email || '—')}</dd><dt>${L('Address', 'العنوان')}</dt><dd>${txt(p.address || '—')}</dd><dt>${L('Date of birth', 'تاريخ الميلاد')}</dt><dd>${date(p.born)}</dd><dt>${L('Ministries', 'الخدمات')}</dt><dd>${M.groups.map(g=>txt(g.name)).join(', ') || '—'}</dd></dl><button class="btn btn-primary" data-profile-request>${L('Request information update', 'طلب تحديث المعلومات')}</button>`)}
    ${card(`<h2>${L('Notification preferences', 'تفضيلات الإشعارات')}</h2>${[['email','Email notifications','إشعارات البريد'],['inSystem','In-system notifications','إشعارات النظام'],['meetings','Meeting updates and reminders','تحديثات وتذكيرات الاجتماعات'],['announcements','Announcements','الإعلانات'],['messages','Ministry messages','رسائل الخدمة']].map(([key,en,ar]) => `<label class="member-toggle"><span>${L(en,ar)}</span><input type="checkbox" data-preference="${key}" ${M.preferences[key] ? 'checked' : ''}></label>`).join('')}<p class="help">${L('Email delivery is not connected yet. Your email choice is saved for future use; in-system reminders appear when you open the portal.', 'لم يُربط إرسال البريد بعد. يُحفظ اختيارك للمستقبل؛ وتظهر التذكيرات داخل النظام عند فتح البوابة.')}</p>`)}
    ${M.profileRequests.length ? card(`<h2>${L('Update requests', 'طلبات التحديث')}</h2>${M.profileRequests.map(x=>`<div class="member-simple-row"><span>${txt(x.field)} · ${txt(x.requested_value)}</span>${status(x.status)}</div>`).join('')}`) : ''}</div>`;
}

export function concerns() {
  return `<div class="member-page">${title(L('Submit a Concern', 'تقديم ملاحظة أو قلق'), L('A confidential way to share concerns, feedback and suggestions.', 'وسيلة سرية لطرح المخاوف والملاحظات والاقتراحات.'))}<div class="member-actions"><button class="btn btn-primary" data-concern-new>${L('Submit a concern', 'تقديم ملاحظة')}</button></div>
    ${card(`<h2>${L('Check an anonymous reference', 'متابعة مرجع مجهول')}</h2><p>${L('Keep the code shown after submission. Anyone with that code can see the public status, so store it safely.', 'احتفظ بالرمز المعروض بعد الإرسال. يمكن لأي شخص يملكه رؤية الحالة العامة، فاحفظه بأمان.')}</p><div class="member-actions"><input class="input" id="anonymous-reference" placeholder="CMP-…" aria-label="${L('Anonymous reference code', 'الرمز المرجعي المجهول')}"><button class="btn btn-secondary" data-concern-lookup>${L('Check status', 'عرض الحالة')}</button></div><div id="anonymous-result"></div>`)}
    <h2>${L('My identified submissions', 'طلباتي المعرّفة')}</h2><div class="member-list">${M.concerns.map(x => card(`<div class="member-row"><h2>${txt(x.subject)}</h2>${status(x.status)}</div><p>${txt(x.reference)} · ${date(x.created_at)}</p>${x.updates.map(y=>`<p>${date(y.at)} · ${txt(y.status)} ${txt(y.text)}</p>`).join('')}`)).join('') || blank(L('You have no identified submissions.', 'ليس لديك طلبات معرّفة.'))}</div></div>`;
}

export function notificationsPage() {
  const rows = M.notifications;
  return `<div class="member-page">${title(L('Notifications', 'الإشعارات'), L('Recent updates that matter to you.', 'آخر المستجدات التي تهمك.'))}<div class="member-actions">${rows.some(x=>!x.read) ? `<button class="btn btn-secondary" data-notification-read-all>${L('Mark all as read', 'تعليم الكل كمقروء')}</button>` : ''}${link('myprofile', L('Notification preferences', 'تفضيلات الإشعارات'))}</div><div class="member-list">${rows.map(x => card(`<div class="member-row"><h2>${txt(x.title)} ${!x.read ? status(L('New', 'جديد')) : ''}</h2><small>${date(x.at)}</small></div><p>${txt(x.body)}</p><div class="member-actions">${x.read ? '' : `<button class="btn btn-secondary btn-dense" data-notification-read="${txt(x.id)}">${L('Mark read', 'تعليم كمقروء')}</button>`}${link(x.route, L('Open', 'فتح'))}</div>`)).join('') || blank(L('You are all caught up.', 'لا إشعارات جديدة.'))}</div></div>`;
}

export function hub() {
  return `<div class="member-page">${title(L('Member communication', 'التواصل مع الأعضاء'), L('Publish to your ministries and review permitted member requests.', 'انشر لخدماتك وراجع طلبات الأعضاء المسموح بها.'))}${session.user?.role !== 'member' ? `<div class="member-actions"><button class="btn btn-primary" data-publish>${L('Publish update', 'نشر مستجد')}</button></div>` : ''}
    ${card(`<h2>${L('Member messages', 'رسائل الأعضاء')}</h2>${M.content.filter(x=>x.kind==='message' && x.recipientId===session.user?.id).map(x=>`<div class="member-simple-row"><span>${txt(groupName(x.groupId))} · ${txt(x.body)}</span><button class="btn btn-secondary btn-dense" data-reply-message="${txt(x.id)}">${L('Reply', 'رد')}</button></div>`).join('') || blank(L('No member messages yet.', 'لا رسائل من الأعضاء بعد.'))}`)}
    ${card(`<h2>${L('Volunteer responses', 'ردود المتطوعين')}</h2>${M.volunteerReview.map(x=>`<div class="member-simple-row"><span>${txt(x.name)} · ${txt(x.title)} · ${txt(x.status)}</span><button class="btn btn-secondary btn-dense" data-confirm-volunteer="${txt(x.content_id)}" data-user="${txt(x.user_id)}">${L('Confirm', 'تأكيد')}</button></div>`).join('') || blank(L('No volunteer responses yet.', 'لا ردود تطوع بعد.'))}`)}
    ${M.profileReview.length ? card(`<h2>${L('Profile update requests', 'طلبات تحديث الملفات')}</h2>${M.profileReview.map(x=>`<div class="member-simple-row"><span>${txt(x.name)} · ${txt(x.field)}: ${txt(x.requested_value)} · ${txt(x.status)}</span><button class="btn btn-secondary btn-dense" data-profile-review="${txt(x.id)}">${L('Mark reviewed', 'تعليم كمراجَع')}</button></div>`).join('')}`) : ''}
    ${M.complaintPermissions.includes('Review') ? card(`<h2>${L('Concern review', 'مراجعة الطلبات السرية')}</h2><p>${L('Only explicitly appointed reviewers can see these cases.', 'هذه الحالات متاحة فقط للمراجعين المعيّنين صراحةً.')}</p>${M.review.map(x=>`<div class="member-simple-row"><span>${txt(x.reference)} · ${txt(x.subject)} · ${txt(x.status)} ${x.anonymous ? L('(anonymous)','(مجهول)') : ''}</span><button class="btn btn-secondary btn-dense" data-review-concern="${txt(x.id)}">${L('Review', 'مراجعة')}</button></div>`).join('') || blank(L('No cases assigned to this parish.', 'لا حالات مسجّلة في هذه الرعية.'))}`) : ''}
    ${M.complaintPermissions.includes('ManageCategories') ? card(`<h2>${L('Concern categories', 'فئات الملاحظات')}</h2><button class="btn btn-secondary btn-dense" data-category-add>${L('Add category', 'إضافة فئة')}</button>${M.categories.map(x=>`<div class="member-simple-row"><span>${txt(x.name)} ${status(x.active ? L('Active', 'نشطة') : L('Hidden', 'مخفية'))}</span><button class="btn btn-secondary btn-dense" data-category-toggle="${txt(x.name)}" data-active="${!x.active}">${x.active ? L('Hide', 'إخفاء') : L('Activate', 'تفعيل')}</button></div>`).join('')}`) : ''}</div>`;
}

async function run(op, values, success = L('Saved', 'حُفظ')) {
  try {
    const result = await memberAction(op, values);
    if (session.user?.role === 'member') await hydrate(); else await loadMember();
    closeOverlays();
    if (session.user?.role === 'member') bus.renderAll(); else bus.refresh();
    if (success) toast(success, '', 'success');
    return result;
  } catch (error) { toast(L('Could not save', 'تعذّر الحفظ'), error.message, 'danger'); return null; }
}

const field = (label, id, value = '', type = 'text') => `<div class="formrow"><label class="label" for="${id}">${txt(label)}</label><input class="input" id="${id}" type="${type}" value="${txt(value)}"></div>`;
const area = (label, id, value = '') => `<div class="formrow"><label class="label" for="${id}">${txt(label)}</label><textarea class="textarea" id="${id}" rows="5">${txt(value)}</textarea></div>`;
const val = (el, id) => el.querySelector('#' + id)?.value.trim() || '';
const footer = label => `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" type="button" id="member-save">${txt(label)}</button>`;
async function attachment(el) {
  const file = el.querySelector('input[type=file]')?.files?.[0];
  if (!file) return null;
  if (file.size > 1_000_000) throw new Error(L('Attachment must be under 1 MB.', 'يجب أن يكون المرفق أصغر من ١ ميغابايت.'));
  if (!['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(file.type)) throw new Error(L('Choose a PDF, image or text file.', 'اختر ملف PDF أو صورة أو نصاً.'));
  return { name:file.name, mime:file.type, data:await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }) };
}

function meetingDrawer(m) {
  openDrawer({ title:m.title, sub:`${m.group} · ${date(m.date)} · ${m.time}`, body:`
    <p>${txt(m.description || L('No additional details yet.', 'لا تفاصيل إضافية حالياً.'))}</p>
    <dl class="member-profile"><dt>${L('Location', 'المكان')}</dt><dd>${txt(m.location || '—')}</dd><dt>${L('Organizer', 'المنظّم')}</dt><dd>${txt(m.organizer || '—')}</dd><dt>${L('Attendance', 'الحضور')}</dt><dd>${txt(m.attendance)}</dd><dt>${L('My reply', 'ردّي')}</dt><dd>${txt(m.rsvp?.status || '—')}</dd></dl>
    ${m.resources?.length ? `<h3>${L('Meeting resources', 'موارد الاجتماع')}</h3>${m.resources.map(r=>`<p>${txt(r.title)} ${r.attachment ? `<a download="${txt(r.attachment.name)}" href="${txt(r.attachment.data)}">${L('Download', 'تنزيل')}</a>` : ''}</p>`).join('')}` : ''}
    ${m.rsvpEnabled && m.date >= todayKey() ? `${area(L('Optional absence reason', 'سبب الغياب الاختياري'), 'absence-reason', m.rsvp?.reason || '')}<div class="member-actions"><button class="btn btn-primary" data-rsvp="yes">${L('I will attend', 'سأحضر')}</button><button class="btn btn-secondary" data-rsvp="no">${L('Cannot attend', 'لا أستطيع الحضور')}</button></div>` : ''}`,
    foot:`<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>`,
    onMount(el) { el.querySelectorAll('[data-rsvp]').forEach(b => b.addEventListener('click', () => run('rsvp', { meetingId:m.id, status:b.dataset.rsvp, reason:val(el,'absence-reason') }))); }
  });
}

function noteDrawer(n = null) {
  openDrawer({ title:n ? L('Edit note', 'تعديل ملاحظة') : L('New private note', 'ملاحظة خاصة جديدة'),
    sub:L('Only you can read this note.', 'يمكنك أنت فقط قراءة هذه الملاحظة.'),
    body:`${field(L('Title', 'العنوان'),'note-title',n?.title || '')}${area(L('Note', 'الملاحظة'),'note-body',n?.body || '')}
      <div class="formrow"><label class="label" for="note-category">${L('Category', 'الفئة')}</label><select class="select" id="note-category">${['Personal','Meeting Notes','Spiritual','Ministry','Tasks','Ideas'].map(x=>`<option ${n?.category===x?'selected':''}>${x}</option>`).join('')}</select></div>
      ${field(L('Tags, comma separated', 'الوسوم، مفصولة بفواصل'),'note-tags',n?.tags?.join(', ') || '')}
      ${field(L('Reminder', 'تذكير'),'note-reminder',n?.reminder || '','date')}
      <div class="formrow"><label class="label" for="note-meeting">${L('Linked meeting (optional)', 'الاجتماع المرتبط (اختياري)')}</label><select class="select" id="note-meeting"><option value="">—</option>${M.meetings.map(m=>`<option value="${txt(m.id)}" ${n?.meetingId===m.id?'selected':''}>${txt(m.title)} · ${date(m.date)}</option>`).join('')}</select></div>
      <label class="member-toggle"><span>${L('Pin this note', 'تثبيت الملاحظة')}</span><input type="checkbox" id="note-pinned" ${n?.pinned?'checked':''}></label>`, foot:footer(L('Save note', 'حفظ الملاحظة')),
    onMount(el) { el.querySelector('#member-save').addEventListener('click', () => {
      const title = val(el,'note-title'); if (!title) { el.querySelector('#note-title').focus(); return; }
      run('note', { id:n?.id, title, body:val(el,'note-body'), category:val(el,'note-category'),
        tags:val(el,'note-tags').split(',').map(x=>x.trim()).filter(Boolean), reminder:val(el,'note-reminder'),
        meetingId:val(el,'note-meeting'), pinned:el.querySelector('#note-pinned').checked });
    }); }
  });
}

function profileDrawer() {
  openDrawer({ title:L('Request information update', 'طلب تحديث المعلومات'),
    sub:L('The parish office will review changes to your official record.', 'يراجع مكتب الرعية التغييرات على سجلك الرسمي.'),
    body:`<div class="formrow"><label class="label" for="profile-field">${L('Information to update', 'المعلومة المطلوب تحديثها')}</label><select class="select" id="profile-field">${['name','phone','email','address','emergency contact','date of birth','ministry memberships','profile picture'].map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div>${area(L('Requested information', 'المعلومة المطلوبة'),'profile-value')}`,
    foot:footer(L('Send request', 'إرسال الطلب')), onMount(el) { el.querySelector('#member-save').addEventListener('click', () => {
      if (!val(el,'profile-value')) { el.querySelector('#profile-value').focus(); return; }
      run('profileRequest', { field:val(el,'profile-field'), value:val(el,'profile-value') });
    }); }
  });
}

function messageDrawer() {
  openDrawer({ title:L('Message my ministry', 'مراسلة خدمتي'),
    sub:L('Your message goes to the ministry leader if they have a linked account.', 'تصل رسالتك إلى مسؤول الخدمة إذا كان له حساب مرتبط.'),
    body:`<div class="formrow"><label class="label" for="message-group">${L('Ministry', 'الخدمة')}</label><select class="select" id="message-group">${M.groups.map(g=>`<option value="${txt(g.id)}">${txt(g.name)}</option>`).join('')}</select></div>${area(L('Message', 'الرسالة'),'message-body')}`,
    foot:footer(L('Send message', 'إرسال الرسالة')), onMount(el) { el.querySelector('#member-save').addEventListener('click', () => {
      if (!val(el,'message-body')) { el.querySelector('#message-body').focus(); return; }
      run('message',{groupId:val(el,'message-group'),body:val(el,'message-body')});
    }); }
  });
}

function concernDrawer() {
  openDrawer({ title:L('Submit a Concern', 'تقديم ملاحظة أو قلق'),
    sub:L('Your concern is visible only to explicitly authorized reviewers.', 'تُعرض ملاحظتك فقط على المراجعين المخوّلين صراحةً.'),
    body:`<div class="formrow"><label class="label" for="concern-category">${L('Category', 'الفئة')}</label><select class="select" id="concern-category">${M.categories.filter(x=>x.active).map(x=>`<option>${txt(x.name)}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label" for="concern-group">${L('Related ministry (optional)', 'الخدمة المرتبطة (اختياري)')}</label><select class="select" id="concern-group"><option value="">—</option>${M.groups.map(g=>`<option value="${txt(g.id)}">${txt(g.name)}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label" for="concern-event">${L('Related event or meeting (optional)', 'المناسبة أو الاجتماع المرتبط (اختياري)')}</label><select class="select" id="concern-event"><option value="">—</option>${[...M.events,...M.meetings].map(x=>`<option value="${txt(x.id)}">${txt(x.title)}</option>`).join('')}</select></div>
      ${field(L('Subject', 'الموضوع'),'concern-subject')}${area(L('Description', 'الوصف'),'concern-description')}
      ${field(L('When did this happen? (optional)', 'متى حصل هذا؟ (اختياري)'),'concern-when','','datetime-local')}${field(L('People involved (optional)', 'الأشخاص المعنيون (اختياري)'),'concern-people')}
      <div class="formrow"><label class="label" for="concern-attachment">${L('Attachment (optional, max 1 MB)', 'مرفق (اختياري، بحد أقصى ١ ميغابايت)')}</label><input class="input" id="concern-attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt"></div>
      <label class="member-toggle"><span>${L('Submit anonymously', 'إرسال دون إظهار الهوية')}</span><input type="checkbox" id="concern-anonymous"></label>
      <p class="help">${L('Anonymous means normal reviewers do not see your account identity. Technical administrators may still have access to server logs or metadata. Keep your reference code to check status later.', 'تعني السرية أن المراجعين العاديين لا يرون هوية حسابك. قد يستطيع المسؤولون التقنيون الاطلاع على السجلات أو البيانات التقنية. احتفظ بالرمز المرجعي للمتابعة.')}</p>
      <div class="formrow"><label class="label" for="concern-follow">${L('Preferred follow-up (identified submissions)', 'طريقة المتابعة للطلبات المعرّفة')}</label><select class="select" id="concern-follow"><option value="system">${L('In-system message', 'رسالة في النظام')}</option><option value="email">${L('Email', 'البريد الإلكتروني')}</option><option value="phone">${L('Phone', 'الهاتف')}</option><option value="none">${L('No response required', 'لا حاجة للرد')}</option></select></div>`,
    foot:footer(L('Submit concern', 'إرسال الملاحظة')), onMount(el) { el.querySelector('#member-save').addEventListener('click', async () => {
      if (!val(el,'concern-subject') || !val(el,'concern-description')) { el.querySelector(!val(el,'concern-subject')?'#concern-subject':'#concern-description').focus(); return; }
      try {
        const values = { category:val(el,'concern-category'), groupId:val(el,'concern-group') || null,
          eventId:val(el,'concern-event') || null, subject:val(el,'concern-subject'), description:val(el,'concern-description'),
          happenedAt:val(el,'concern-when'), peopleInvolved:val(el,'concern-people'),
          anonymous:el.querySelector('#concern-anonymous').checked, followUp:val(el,'concern-follow'), attachment:await attachment(el) };
        const result = await run('concern', values, '');
        if (result?.reference) openDrawer({title:L('Concern received', 'تم استلام الملاحظة'),
          body:`<p>${L('Save this reference code. Anonymous submissions can be tracked with it.', 'احفظ الرمز المرجعي. يمكنك متابعة الطلب المجهول بواسطته.')}</p><p class="member-code">${txt(result.reference)}</p>`,
          foot:`<button class="btn btn-primary" data-close>${L('Done', 'تم')}</button>`});
      } catch (error) { toast(L('Could not submit', 'تعذّر الإرسال'), error.message, 'danger'); }
    }); }
  });
}

function publishDrawer() {
  openDrawer({ title:L('Publish to members', 'النشر للأعضاء'),
    body:`<div class="formrow"><label class="label" for="publish-kind">${L('Type', 'النوع')}</label><select class="select" id="publish-kind">${[['post','Post'],['announcement','Announcement'],['resource','Resource'],['opportunity','Volunteer opportunity'],['discussion','Group conversation']].map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label" for="publish-group">${L('Audience', 'الجمهور')}</label><select class="select" id="publish-group">${session.user?.role === 'priest' || session.user?.role === 'secretary' ? `<option value="">${L('Parish', 'الرعية')}</option>` : ''}${M.groups.filter(g=>M.managedGroups.includes(g.id)).map(g=>`<option value="${txt(g.id)}">${txt(g.name)}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label" for="publish-meeting">${L('Linked meeting (optional)', 'اجتماع مرتبط (اختياري)')}</label><select class="select" id="publish-meeting"><option value="">—</option>${M.meetings.map(m=>`<option value="${txt(m.id)}" data-group="${txt(m.groupId)}">${txt(m.title)} · ${date(m.date)}</option>`).join('')}</select></div>
      ${field(L('Title', 'العنوان'),'publish-title')}${area(L('Content', 'المحتوى'),'publish-body')}${field(L('Category or tags', 'الفئة أو الوسوم'),'publish-category')}
      <div class="formrow"><label class="label" for="publish-attachment">${L('Attachment (optional, max 1 MB)', 'مرفق اختياري بحد ١ ميغابايت')}</label><input class="input" id="publish-attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt"></div><label class="member-toggle"><span>${L('Pin post', 'تثبيت المنشور')}</span><input type="checkbox" id="publish-pinned"></label>`,
    foot:footer(L('Publish', 'نشر')), onMount(el) {
      const group = el.querySelector('#publish-group'), meeting = el.querySelector('#publish-meeting');
      const sync = () => { meeting.value = ''; meeting.querySelectorAll('option[data-group]').forEach(option => { option.hidden = option.dataset.group !== group.value; }); };
      group.addEventListener('change', sync); sync();
      el.querySelector('#member-save').addEventListener('click', async () => {
      try { await run('publish',{kind:val(el,'publish-kind'),groupId:val(el,'publish-group') || null,
        title:val(el,'publish-title'),body:val(el,'publish-body'),category:val(el,'publish-category'),eventId:val(el,'publish-meeting') || null,
        pinned:el.querySelector('#publish-pinned').checked,attachment:await attachment(el)}); }
      catch(error) { toast(L('Could not publish', 'تعذّر النشر'), error.message, 'danger'); }
      }); }
  });
}

function reviewDrawer(x) {
  const canResolve = M.complaintPermissions.includes('Resolve');
  const canRespond = (M.complaintPermissions.includes('Respond') || canResolve) &&
    (canResolve || !['Resolved','Closed'].includes(x.status));
  const statuses = ['Submitted','Under Review','Additional Information Requested','Referred',
    ...(canResolve ? ['Resolved','Closed'] : [])];
  openDrawer({title:x.reference, sub:`${x.status} · ${x.category}`,
    body:`<h3>${txt(x.subject)}</h3><p>${txt(x.description)}</p><p>${L('People involved', 'الأشخاص المعنيون')}: ${txt(x.people_involved || '—')}</p>${x.identity ? `<p>${L('Identity', 'الهوية')}: ${txt(x.identity.name)} · ${txt(x.identity.phone)}</p>` : ''}${x.attachment ? `<a class="btn btn-secondary" download="${txt(x.attachment.name)}" href="${txt(x.attachment.data)}">${L('Download evidence', 'تنزيل المرفق')}</a>` : ''}
      ${x.updates.map(y=>`<p>${date(y.at)} · ${txt(y.status)} · ${txt(y.text)}${y.internal ? `<br><small>${L('Internal note', 'ملاحظة داخلية')}: ${txt(y.internal)}</small>` : ''}</p>`).join('')}
      ${M.complaintPermissions.includes('Assign') ? `<div class="formrow"><label class="label" for="review-assignee">${L('Assign to independent reviewer', 'تعيين مراجع مستقل')}</label><select class="select" id="review-assignee"><option value="">${L('Choose reviewer', 'اختر مراجعاً')}</option>${M.reviewers.map(r=>`<option value="${txt(r.id)}" ${x.assignedTo===r.id?'selected':''}>${txt(r.name)}</option>`).join('')}</select><button class="btn btn-secondary btn-dense" id="assign-reviewer">${L('Assign', 'تعيين')}</button></div>` : ''}
      ${canRespond ? `<div class="formrow"><label class="label" for="review-status">${L('Public status', 'الحالة العامة')}</label><select class="select" id="review-status">${statuses.map(s=>`<option ${x.status===s?'selected':''}>${s}</option>`).join('')}</select></div>${area(L('Public response', 'الرد العام'),'review-public')}${area(L('Internal note', 'ملاحظة داخلية'),'review-internal')}` : ''}`,
    foot:canRespond ? footer(L('Save update', 'حفظ التحديث')) : `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>`, onMount(el) {
      el.querySelector('#member-save')?.addEventListener('click',()=>run('concernUpdate',{id:x.id,status:val(el,'review-status'),publicText:val(el,'review-public'),internalText:val(el,'review-internal')}));
      el.querySelector('#assign-reviewer')?.addEventListener('click',()=>run('concernAssign',{id:x.id,reviewerId:val(el,'review-assignee')}));
    }
  });
}

function discussionDrawer(x) {
  openDrawer({title:x.title, sub:groupName(x.groupId), body:`<p>${txt(x.body)}</p>
    <div class="member-list">${x.replies.map(r=>`<div class="member-card"><b>${txt(r.author)}</b><small> · ${date(r.at)}</small><p>${txt(r.body)}</p></div>`).join('') || blank(L('No replies yet.', 'لا ردود بعد.'))}</div>${area(L('Your reply', 'ردّك'),'discussion-body')}`,
    foot:footer(L('Reply', 'رد')),onMount(el){el.querySelector('#member-save').addEventListener('click',()=>run('discussionReply',{id:x.id,body:val(el,'discussion-body')}));}});
}

export function mount(host) {
  host.querySelectorAll('[data-meeting]').forEach(b=>b.addEventListener('click',()=>{ const m=M.meetings.find(x=>x.id===b.dataset.meeting); if(m) meetingDrawer(m); }));
  host.querySelectorAll('[data-note-edit]').forEach(b=>b.addEventListener('click',()=>noteDrawer(M.notes.find(x=>x.id===b.dataset.noteEdit))));
  host.querySelector('[data-note-new]')?.addEventListener('click',()=>noteDrawer());
  host.querySelectorAll('[data-note-delete]').forEach(b=>b.addEventListener('click',()=>{ if(confirm(L('Delete this private note?', 'حذف هذه الملاحظة الخاصة؟'))) run('note',{id:b.dataset.noteDelete,delete:true}); }));
  host.querySelector('[data-profile-request]')?.addEventListener('click',profileDrawer);
  host.querySelector('[data-member-compose]')?.addEventListener('click',messageDrawer);
  host.querySelector('[data-concern-new]')?.addEventListener('click',concernDrawer);
  host.querySelector('[data-publish]')?.addEventListener('click',publishDrawer);
  host.querySelectorAll('[data-preference]').forEach(b=>b.addEventListener('change',()=>run('preference',{key:b.dataset.preference,value:b.checked},'')));
  host.querySelectorAll('[data-member-read]').forEach(b=>b.addEventListener('click',()=>run('read',{id:b.dataset.memberRead},'')));
  host.querySelectorAll('[data-member-archive]').forEach(b=>b.addEventListener('click',()=>run(b.dataset.archiveOp,{id:b.dataset.memberArchive},'')));
  host.querySelector('[data-member-read-all]')?.addEventListener('click',()=>run('readAll',{},''));
  host.querySelector('[data-notification-read-all]')?.addEventListener('click',()=>run('notificationReadAll',{},''));
  host.querySelectorAll('[data-notification-read]').forEach(b=>b.addEventListener('click',()=>run('notificationRead',{id:b.dataset.notificationRead},'')));
  host.querySelectorAll('[data-volunteer]').forEach(b=>b.addEventListener('click',()=>run('volunteer',{id:b.dataset.volunteer,status:b.dataset.status})));
  host.querySelectorAll('[data-confirm-volunteer]').forEach(b=>b.addEventListener('click',()=>run('confirmVolunteer',{id:b.dataset.confirmVolunteer,userId:b.dataset.user,status:'confirmed'})));
  host.querySelectorAll('[data-profile-review]').forEach(b=>b.addEventListener('click',()=>run('profileReview',{id:b.dataset.profileReview,status:'Reviewed'})));
  host.querySelectorAll('[data-review-concern]').forEach(b=>b.addEventListener('click',()=>{ const x=M.review.find(x=>x.id===b.dataset.reviewConcern); if(x) reviewDrawer(x); }));
  host.querySelector('[data-category-add]')?.addEventListener('click',()=>openDrawer({title:L('Add concern category', 'إضافة فئة للملاحظات'),body:field(L('Category name', 'اسم الفئة'),'category-name'),foot:footer(L('Add category', 'إضافة فئة')),
    onMount(el){el.querySelector('#member-save').addEventListener('click',()=>run('categoryManage',{name:val(el,'category-name'),active:true}));}}));
  host.querySelectorAll('[data-category-toggle]').forEach(b=>b.addEventListener('click',()=>run('categoryManage',{name:b.dataset.categoryToggle,active:b.dataset.active==='true'})));
  host.querySelectorAll('[data-reply-message]').forEach(b=>b.addEventListener('click',()=>{
    const x=M.content.find(x=>x.id===b.dataset.replyMessage); if(!x) return;
    openDrawer({title:L('Reply to member', 'الرد على العضو'),body:`<p>${txt(x.body)}</p>${area(L('Reply', 'الرد'),'reply-body')}`,
      foot:footer(L('Send reply', 'إرسال الرد')),onMount(el){el.querySelector('#member-save').addEventListener('click',()=>run('messageReply',{id:x.id,body:val(el,'reply-body')}));}});
  }));
  host.querySelectorAll('[data-discussion]').forEach(b=>b.addEventListener('click',()=>{ const x=M.content.find(x=>x.id===b.dataset.discussion); if(x) discussionDrawer(x); }));
  host.querySelector('[data-concern-lookup]')?.addEventListener('click',async()=>{
    const box=host.querySelector('#anonymous-result');
    try { const result=await memberAction('concernLookup',{reference:host.querySelector('#anonymous-reference').value.trim()}); const x=result.concern;
      box.innerHTML=`<div class="member-card"><h3>${txt(x.subject)}</h3><p>${txt(x.reference)} · ${txt(x.status)}</p>${x.updates.map(y=>`<p>${date(y.at)} · ${txt(y.status)} · ${txt(y.text)}</p>`).join('')}${area(L('Provide additional information', 'إضافة معلومات'),'anonymous-follow-up')}<button class="btn btn-secondary" data-anonymous-follow-up>${L('Send update', 'إرسال التحديث')}</button></div>`;
      box.querySelector('[data-anonymous-follow-up]').addEventListener('click',async()=>{
        const message=val(box,'anonymous-follow-up'); if(!message) return;
        try { await memberAction('concernFollowUp',{reference:x.reference,message}); box.querySelector('#anonymous-follow-up').value=''; toast(L('Update sent', 'أُرسل التحديث'),'','success'); }
        catch(error){toast(L('Could not send update', 'تعذّر إرسال التحديث'),error.message,'danger');}
      });
    } catch(error) { box.textContent=error.message; }
  });
  host.querySelectorAll('[data-message-filter]').forEach(b=>b.addEventListener('click',()=>{ S.ui.memberMessageFilter=b.dataset.messageFilter; bus.refresh(); }));
  host.querySelectorAll('[data-calendar-mode]').forEach(b=>b.addEventListener('click',()=>{ S.ui.memberCalendarMode=b.dataset.calendarMode; S.ui.memberCalendarOffset=0; bus.refresh(); }));
  host.querySelectorAll('[data-calendar-offset]').forEach(b=>b.addEventListener('click',()=>{ S.ui.memberCalendarOffset=(S.ui.memberCalendarOffset||0)+Number(b.dataset.calendarOffset); bus.refresh(); }));
  const filter=()=>{
    const filters=Object.fromEntries([...host.querySelectorAll('[data-filter]')].map(x=>[x.dataset.filter,x.value]));
    const query=(host.querySelector('[data-member-search], [data-note-search]')?.value||'').toLowerCase();
    host.querySelectorAll('.member-filter-row, .member-search-row').forEach(row=>{
      row.hidden=!!(filters.group && row.dataset.group!==filters.group || filters.status && row.dataset.status!==filters.status ||
        filters.category && row.dataset.category!==filters.category || filters.source && row.dataset.source!==filters.source ||
        filters.from && row.dataset.date<filters.from || filters.to && row.dataset.date>filters.to ||
        query && !row.dataset.search?.toLowerCase().includes(query));
    });
  };
  host.querySelectorAll('[data-filter]').forEach(x=>x.addEventListener('change',filter));
  host.querySelectorAll('[data-member-search], [data-note-search]').forEach(x=>x.addEventListener('input',filter));
}

for (const view of [home,ministries,meetings,attendancePage,calendar,messages,feed,resources,formation,commitments,notes,profile,concerns,notificationsPage,hub]) view.mount=mount;
