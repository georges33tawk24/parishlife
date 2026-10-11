/* Member portal: ask the parish for a sacrament or a certificate, follow it step by step,
   withdraw it while it waits. Requests reach the parish office's Requests page. */
import { t, isAr, fmtDate } from '../i18n.js';
import { M, memberAction, loadMember } from '../member-data.js';
import { session } from '../api.js';
import { hydrate } from '../persist.js';
import { bus, go, S } from '../store.js';
import { esc, icon, pill, openModal, closeOverlays, toast } from '../ui.js';
import { REQUEST_KINDS, kindOf, kindName, CERTIFICATE_OF, certificateName, PURPOSES, purposeText, LANGUAGES, languageName,
         fmtDay, todayKey, stageInfo, isActive, CLOSED, stepsFor, stepsDone, nextText, eventLabel } from '../sacrament-requests.js';

const L = (en, ar) => t(en, ar);
const txt = value => esc(String(value ?? ''));
const nameOf = x => (isAr() ? x.ar || x.lat : x.lat || x.ar) || '';
const otherName = x => { const other = isAr() ? x.lat : x.ar; return other && other !== nameOf(x) ? other : ''; };
const ONCE = new Set(['baptism', 'communion', 'confirmation', 'funeral']);
const titleOf = r => r.kind === 'certificate' ? certificateName(r.details.certificateOf) : kindName(r.kind);
const phoneLink = phone => phone ? `<a class="mr-phone" href="tel:${txt(String(phone).replace(/[^\d+]/g, ''))}">${icon('msg', 16)}<bdi dir="ltr">${txt(phone)}</bdi></a>` : '';
const back = () => `<a class="mr-back" href="#/myrequests">${icon('chevL', 16)}${L('Sacraments & certificates', 'الأسرار والشهادات')}</a>`;
async function reload() { if (session.user?.role === 'member') await hydrate(); else await loadMember(); }
const redraw = () => { if (session.user?.role === 'member') bus.renderAll(); else bus.refresh(); };

/* ---- the list -------------------------------------------------------------- */
function kindGrid() {
  return `<div class="mr-kinds">${REQUEST_KINDS.map(k => `<a class="mr-kind" href="#/myrequests/new/${k.id}">
    <span class="mr-kind-icon" aria-hidden="true">${icon(k.icon, 22)}</span>
    <span class="mr-kind-text"><b>${txt(t(k.en, k.ar))}</b><small>${txt(t(k.descEn, k.descAr))}</small></span>
    ${icon('arrowR', 18, 'mr-kind-go')}</a>`).join('')}</div>`;
}
const meter = r => {
  const total = stepsFor(r).length, done = stepsDone(r);
  return `<span class="mr-meter${CLOSED.has(r.progress.stage) ? ' is-closed' : ''}" role="img" aria-label="${txt(L(`${done} of ${total} steps done`, `${done} من ${total} خطوات منجزة`))}">${
    Array.from({ length: total }, (_, i) => `<i${i < done ? ' class="on"' : ''}></i>`).join('')}</span>`;
};
const dateNote = r => {
  const p = r.progress;
  if (p.plannedDate && !CLOSED.has(p.stage)) return ` · ${L('Planned for', 'مقرّر في')} ${fmtDay(p.plannedDate)}`;
  if (p.preferredDate && isActive(r)) return ` · ${L('Preferred date', 'التاريخ المفضّل')} ${fmtDay(p.preferredDate)}`;
  return '';
};
function requestCard(r) {
  const [label, tone, mark] = stageInfo(r);
  return `<a class="mr-card${CLOSED.has(r.progress.stage) ? ' is-closed' : ''}" href="#/myrequests/${txt(r.id)}">
    <span class="mr-card-icon" aria-hidden="true">${icon(kindOf(r.kind).icon, 22)}</span>
    <span class="mr-card-main">
      <span class="mr-card-title"><b>${txt(titleOf(r))}</b><span> · ${txt(nameOf(r.subject))}</span></span>
      <span class="mr-card-next">${txt(nextText(r))}</span>
      ${meter(r)}
      <span class="mr-card-meta"><bdi class="mono" dir="ltr">${txt(r.reference)}</bdi> · ${L('Sent', 'أُرسل')} ${fmtDate(r.createdAt)}${dateNote(r)}</span>
    </span>
    <span class="mr-card-side">${pill(label, tone, mark)}${icon('chevR', 18, 'mr-card-go')}</span></a>`;
}
const howItWorks = () => `<section class="mr-how" aria-labelledby="mr-how-title"><h2 id="mr-how-title">${L('How it works', 'كيف يجري الطلب')}</h2><ol>
  <li><b>${L('Send your request', 'أرسل طلبك')}</b><span>${L('Choose what you need and who it is for. It takes about two minutes.', 'اختر ما تحتاج إليه ولمن. يستغرق ذلك دقيقتين تقريباً.')}</span></li>
  <li><b>${L('The parish reviews it', 'تراجعه الرعية')}</b><span>${L('The parish office checks the details, and the priest accepts the request.', 'يتحقّق مكتب الرعية من التفاصيل، ويقبل الكاهن الطلب.')}</span></li>
  <li><b>${L('Follow every step', 'تابع كل خطوة')}</b><span>${L('Preparation, dates and certificates appear here, with a notification at each step.', 'يظهر التحضير والمواعيد والشهادات هنا، مع إشعار عند كل خطوة.')}</span></li>
</ol></section>`;
const unlinked = () => `<div class="alert alert-info mr-alert">${icon('info', 18)}<span><b>${L('Your account is not linked to a parishioner record yet.', 'حسابك غير مرتبط بسجل أحد المؤمنين بعد.')}</b>${L(' Ask the parish office to link it, then you can send requests here.', ' اطلب من مكتب الرعية ربطه، ثم يمكنك إرسال الطلبات من هنا.')}</span></div>`;

function listPage() {
  const active = M.requests.filter(isActive), earlier = M.requests.filter(r => !isActive(r));
  const linked = (M.requestOptions?.subjects || []).length > 0;
  const section = (id, title, body, extra = '') => `<section class="mr-section" aria-labelledby="mr-${id}"><div class="member-section-head"><h2 id="mr-${id}">${title}</h2>${extra}</div>${body}</section>`;
  return `<div class="member-page mr-page">
    <header class="member-head"><h1>${L('Sacraments & certificates', 'الأسرار والشهادات')}</h1>
      <p>${L('Ask the parish for a sacrament or a certificate, then follow every step here.', 'اطلب من الرعية سرّاً أو شهادة، ثم تابع كل خطوة هنا.')}</p></header>
    ${linked ? '' : unlinked()}
    ${active.length ? section('active', L('In progress', 'قيد المتابعة'), `<div class="mr-cards">${active.map(requestCard).join('')}</div>`) : ''}
    ${section('start', M.requests.length ? L('Start a new request', 'ابدأ طلباً جديداً') : L('What would you like to ask for?', 'ماذا تودّ أن تطلب؟'), kindGrid())}
    ${M.requests.length ? '' : howItWorks()}
    ${earlier.length ? section('earlier', L('Completed and closed', 'المنجزة والمغلقة'), `<div class="mr-cards">${earlier.map(requestCard).join('')}</div>`) : ''}
  </div>`;
}

/* ---- a new request ------------------------------------------------------------ */
const LEGEND = { baptism: ['Who is to be baptized?', 'من سيُعمَّد؟'], communion: ['Who will receive First Communion?', 'من سيتناول القربان للمرّة الأولى؟'],
  confirmation: ['Who will receive confirmation?', 'من سيقبل سرّ الميرون؟'], marriage: ['Who is getting married?', 'من المُقبل على الزواج؟'],
  funeral: ['Who is the funeral for?', 'الجنّاز لراحة نفس من؟'], certificate: ['Whose certificate do you need?', 'لمن الشهادة؟'] };
const HEADING = { baptism: ['Request a baptism', 'طلب معمودية'], communion: ['Request First Communion', 'طلب المناولة الأولى'],
  confirmation: ['Request confirmation', 'طلب سرّ الميرون'], marriage: ['Request a marriage', 'طلب إكليل'],
  funeral: ['Request a funeral', 'طلب جنّاز'], certificate: ['Request a certificate', 'طلب شهادة'] };
const DATE_LABEL = { marriage: ['Preferred wedding date', 'تاريخ الإكليل المفضّل'], funeral: ['Preferred date for the funeral', 'التاريخ المفضّل للجنّاز'] };
const NOTE_HINT = { baptism: ['For example: the godparents’ names or a time that suits you', 'مثلاً: أسماء العرّابين أو وقت يناسبكم'],
  marriage: ['For example: the church you would like, or a time that suits you', 'مثلاً: الكنيسة التي تفضّلونها أو وقت يناسبكم'],
  funeral: ['For example: the family’s wishes or who the priest should call', 'مثلاً: رغبات العائلة أو من يتّصل به الكاهن'],
  certificate: ['For example: how many copies you need', 'مثلاً: عدد النسخ التي تحتاج إليها'] };
const STEP_NAMES = () => [L('Who it is for', 'لمن الطلب'), L('Details', 'التفاصيل'), L('Review and send', 'المراجعة والإرسال')];

function draftFor(kind) {
  if (S.ui.mrDraft?.kind === kind) return S.ui.mrDraft;
  const phone = M.person?.phone && M.person.phone !== '—' ? M.person.phone : '';
  const prefill = S.ui.mrPrefill?.kind === kind ? S.ui.mrPrefill : {};
  S.ui.mrPrefill = null;
  return (S.ui.mrDraft = { kind, step: 1, subject: '', child: { lat: '', ar: '', born: '', father: '', mother: '' }, date: '', partner: '',
    partnerParish: '', certificateOf: '', purpose: '', purposeOther: '', language: 'bilingual', phone, notes: '', ...prefill });
}
/* Who a request can be for: the member and their household, with the reason any of them is not available. */
function subjectChoices(kind) {
  return (M.requestOptions?.subjects || []).filter(s => !(kind === 'funeral' && s.self)).map(s => {
    let blocked = '';
    if (kind !== 'certificate') {
      if (ONCE.has(kind) && s.onRecord.includes(kind)) blocked = L('Already recorded in the parish register', 'مدوَّن في سجلّ الرعية');
      else if (s.inProgress.includes(kind)) blocked = L('Already being prepared with the parish', 'قيد التحضير مع الرعية');
      else if (M.requests.some(r => r.status === 'submitted' && r.kind === kind && r.subject.id === s.id)) blocked = L('You have already sent this request', 'أرسلتَ هذا الطلب مسبقاً');
    }
    return { ...s, blocked };
  });
}
const fieldError = id => `<span class="mr-error" id="${id}-error" hidden></span>`;
const input = (id, label, value, { type = 'text', req = false, help = '', attrs = '', ar = false } = {}) => `<div class="formrow mr-field">
  <label class="label" for="${id}">${txt(label)}${req ? '<span class="req" aria-hidden="true">*</span>' : `<span class="opt">${L('(optional)', '(اختياري)')}</span>`}</label>
  <input class="input" id="${id}" type="${type}" value="${txt(value)}" ${req ? 'aria-required="true"' : ''} aria-describedby="${help ? `${id}-help ` : ''}${id}-error" ${ar ? 'dir="rtl" lang="ar"' : ''} ${attrs}>
  ${help ? `<span class="help" id="${id}-help">${txt(help)}</span>` : ''}${fieldError(id)}</div>`;

function stepWho(d) {
  const choices = subjectChoices(d.kind);
  const option = (value, title, sub, { disabled = false, checked = false } = {}) => `<label class="mr-choice${disabled ? ' is-disabled' : ''}">
    <input type="radio" name="mr-subject" value="${txt(value)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
    <span class="mr-choice-body"><b>${txt(title)}</b>${sub ? `<small>${txt(sub)}</small>` : ''}</span></label>`;
  const phone = M.requestOptions?.phone;
  const childFields = `<div class="mr-child" id="mr-child" ${d.subject === 'child' ? '' : 'hidden'}>
    <p class="mr-child-intro">${L('Write the names as they should appear on the baptism certificate.', 'اكتب الاسمين كما يجب أن يظهرا في شهادة المعمودية.')}</p>
    <div class="formgrid">${input('mr-child-lat', L('Child’s full name in English', 'اسم الطفل الكامل بالإنكليزية'), d.child.lat, { req: true, attrs: 'autocomplete="off" maxlength="120"' })}
    ${input('mr-child-ar', L('Child’s full name in Arabic', 'اسم الطفل الكامل بالعربية'), d.child.ar, { req: true, ar: true, attrs: 'autocomplete="off" maxlength="120"' })}</div>
    ${input('mr-child-born', L('Date of birth', 'تاريخ الولادة'), d.child.born, { type: 'date', req: true, attrs: `max="${todayKey()}"` })}
    <div class="formgrid">${input('mr-child-father', L('Father’s full name', 'اسم الأب الكامل'), d.child.father, { attrs: 'maxlength="120"' })}
    ${input('mr-child-mother', L('Mother’s full name', 'اسم الأم الكامل'), d.child.mother, { attrs: 'maxlength="120"' })}</div></div>`;
  const people = choices.map(s => option(s.id, s.self ? L('You', 'أنت') + ' — ' + nameOf(s) : nameOf(s), s.blocked || (s.self ? otherName(s) : otherName(s)),
    { disabled: !!s.blocked, checked: d.subject === s.id && !s.blocked })).join('');
  const none = !choices.length && d.kind !== 'baptism';
  return `<fieldset class="mr-fieldset" id="mr-subject-group" aria-describedby="mr-subject-help mr-subject-error">
    <legend class="mr-legend">${L(...LEGEND[d.kind])}</legend>
    <div class="mr-choices">${people}${d.kind === 'baptism' ? option('child', L('A child who is not registered in the parish yet', 'طفل غير مسجّل في الرعية بعد'),
      L('You will add the child’s details below', 'ستضيف تفاصيل الطفل أدناه'), { checked: d.subject === 'child' }) : ''}</div>
    ${fieldError('mr-subject')}
    <p class="help" id="mr-subject-help">${none
      ? L('There is no one in your household to choose. Please contact the parish office directly.', 'لا أحد في عائلتك يمكن اختياره. يُرجى التواصل مع مكتب الرعية مباشرة.')
      : L('You and the people registered in your household are listed. If someone is missing, ask the parish office to add them.', 'تظهر أنت والأشخاص المسجّلون في عائلتك. إذا كان أحدهم غير موجود، اطلب من مكتب الرعية إضافته.')}
      ${phone && (none || d.kind === 'funeral') ? phoneLink(phone) : ''}</p>
  </fieldset>${d.kind === 'baptism' ? childFields : ''}`;
}

function stepDetails(d) {
  const subject = (M.requestOptions?.subjects || []).find(s => s.id === d.subject);
  let body = '';
  if (d.kind === 'certificate') {
    body += `<fieldset class="mr-fieldset" id="mr-of-group" aria-describedby="mr-of-error"><legend class="mr-legend mr-legend-sm">${L('Which certificate?', 'أي شهادة؟')}</legend>
      <div class="mr-choices mr-choices-2">${CERTIFICATE_OF.map(([id]) => {
        const onRecord = subject?.onRecord.includes(id);
        return `<label class="mr-choice"><input type="radio" name="mr-of" value="${id}" ${d.certificateOf === id ? 'checked' : ''}>
          <span class="mr-choice-body"><b>${txt(certificateName(id))}</b><small>${onRecord ? L('Recorded in this parish', 'مدوَّن في هذه الرعية') : L('The parish office will check the register', 'سيتحقّق مكتب الرعية من السجل')}</small></span></label>`;
      }).join('')}</div>${fieldError('mr-of')}</fieldset>
      <fieldset class="mr-fieldset" id="mr-purpose-group" aria-describedby="mr-purpose-error"><legend class="mr-legend mr-legend-sm">${L('What is it for?', 'لأي غرض؟')}</legend>
      <div class="mr-pills">${PURPOSES.map(([en, ar]) => `<label class="mr-pill"><input type="radio" name="mr-purpose" value="${txt(en)}" ${d.purpose === en ? 'checked' : ''}><span>${txt(t(en, ar))}</span></label>`).join('')}
        <label class="mr-pill"><input type="radio" name="mr-purpose" value="other" ${d.purpose === 'other' ? 'checked' : ''}><span>${L('Something else', 'غرض آخر')}</span></label></div>
      ${fieldError('mr-purpose')}
      <div id="mr-purpose-other-wrap" ${d.purpose === 'other' ? '' : 'hidden'}>${input('mr-purpose-other', L('Describe the purpose', 'صِف الغرض'), d.purposeOther, { req: true, attrs: 'maxlength="200"' })}</div></fieldset>
      <fieldset class="mr-fieldset"><legend class="mr-legend mr-legend-sm">${L('Language of the certificate', 'لغة الشهادة')}</legend>
      <div class="mr-pills">${LANGUAGES.map(([id]) => `<label class="mr-pill"><input type="radio" name="mr-language" value="${id}" ${d.language === id ? 'checked' : ''}><span>${txt(languageName(id))}</span></label>`).join('')}</div></fieldset>`;
  } else {
    body += `<h2 class="mr-legend">${L('A few details', 'بعض التفاصيل')}</h2>`;
    body += input('mr-date', L(...(DATE_LABEL[d.kind] || ['Preferred date', 'التاريخ المفضّل'])), d.date,
      { type: 'date', help: L('The parish office will confirm the date with you.', 'سيؤكّد مكتب الرعية الموعد معك.'), attrs: `min="${todayKey()}"` });
    if (d.kind === 'marriage') body += `<div class="formgrid">${input('mr-partner', L('Future spouse’s full name', 'اسم الشريك الكامل'), d.partner, { req: true, attrs: 'maxlength="120"' })}
      ${input('mr-partner-parish', L('Their parish', 'رعيّته'), d.partnerParish, { help: L('If they belong to another parish', 'إذا كان من رعية أخرى'), attrs: 'maxlength="120"' })}</div>`;
  }
  body += input('mr-phone', L('Phone number', 'رقم الهاتف'), d.phone, { type: 'tel', help: L('So the parish office can call you if needed.', 'ليتمكّن مكتب الرعية من الاتصال بك عند الحاجة.'), attrs: 'autocomplete="tel" maxlength="40" dir="ltr"' });
  body += `<div class="formrow mr-field"><label class="label" for="mr-notes">${L('Anything the parish office should know?', 'هل من أمر يجب أن يعرفه مكتب الرعية؟')}<span class="opt">${L('(optional)', '(اختياري)')}</span></label>
    <textarea class="textarea" id="mr-notes" rows="4" maxlength="500" placeholder="${txt(t(...(NOTE_HINT[d.kind] || ['', ''])))}" aria-describedby="mr-notes-count mr-notes-error">${txt(d.notes)}</textarea>
    <span class="counter" id="mr-notes-count">${d.notes.length} / 500</span>${fieldError('mr-notes')}</div>`;
  return body;
}

function summaryRows(d) {
  const subject = (M.requestOptions?.subjects || []).find(s => s.id === d.subject);
  const rows = [[L('Request', 'الطلب'), d.kind === 'certificate' ? certificateName(d.certificateOf) : kindName(d.kind)]];
  if (d.subject === 'child') {
    rows.push([L('For', 'لـ'), [nameOf(d.child), otherName(d.child)].filter(Boolean).join(' · ')], [L('Date of birth', 'تاريخ الولادة'), fmtDay(d.child.born)]);
    if (d.child.father || d.child.mother) rows.push([L('Parents', 'الوالدان'), [d.child.father, d.child.mother].filter(Boolean).join(' · ')]);
  } else if (subject) rows.push([L('For', 'لـ'), subject.self ? `${L('You', 'أنت')} — ${nameOf(subject)}` : nameOf(subject)]);
  if (d.kind === 'certificate') rows.push([L('Purpose', 'الغرض'), d.purpose === 'other' ? d.purposeOther : purposeText(d.purpose)], [L('Language', 'اللغة'), languageName(d.language)]);
  else rows.push([L('Preferred date', 'التاريخ المفضّل'), d.date ? fmtDay(d.date) : L('No preference — the office will propose one', 'لا تفضيل — سيقترح المكتب موعداً')]);
  if (d.kind === 'marriage') rows.push([L('Future spouse', 'الشريك'), d.partner + (d.partnerParish ? ` · ${d.partnerParish}` : '')]);
  rows.push([L('Phone', 'الهاتف'), d.phone || '—', 'ltr'], [L('Message', 'رسالة'), d.notes || '—']);
  return rows;
}
/* Each value is isolated, so an English note or a phone number reads in its own direction inside Arabic. */
const summaryList = (rows, cls = '') => `<dl class="mr-summary${cls}">${rows.map(([k, v, dir]) => `<dt>${txt(k)}</dt><dd><bdi${dir ? ` dir="${dir}"` : ''}>${txt(v)}</bdi></dd>`).join('')}</dl>`;
function stepReview(d) {
  return `<h2 class="mr-legend">${L('Check your request', 'راجع طلبك')}</h2>
    ${summaryList(summaryRows(d))}
    <p class="mr-edit-links"><button type="button" class="btn btn-ghost btn-dense" data-mr-step="1">${icon('edit', 15)}${L('Change who it is for', 'تغيير صاحب الطلب')}</button>
      <button type="button" class="btn btn-ghost btn-dense" data-mr-step="2">${icon('edit', 15)}${L('Change the details', 'تغيير التفاصيل')}</button></p>
    <div class="mr-next-note">${icon('info', 18)}<p>${L('When you send it, the parish office receives your request. You can follow it on this page and you will get a notification at each step.', 'عند الإرسال، يصل طلبك إلى مكتب الرعية. يمكنك متابعته من هذه الصفحة، وستصلك إشعارات عند كل خطوة.')}</p></div>`;
}

function prepareAside(kind) {
  const list = (M.requestOptions?.preparation || {})[kind] || [];
  const generic = { communion: ['The parish will tell you about the First Communion preparation classes and the date of the celebration.', 'ستُعلمك الرعية بلقاءات التحضير للمناولة الأولى وبموعد الاحتفال.'],
    confirmation: ['The parish will tell you how to prepare and when confirmation is celebrated.', 'ستُعلمك الرعية بكيفية التحضير وبموعد الاحتفال بالميرون.'],
    funeral: ['Please also call the parish office so the priest can be reached quickly.', 'يُرجى أيضاً الاتصال بمكتب الرعية ليتمكّن الكاهن من التواصل معكم سريعاً.'],
    certificate: ['Certificates are signed by the priest. You will get a notification when yours is ready to collect.', 'يوقّع الكاهن الشهادات، وسيصلك إشعار عندما تصبح شهادتك جاهزة للاستلام.'] };
  const body = list.length
    ? `<ul class="mr-checklist">${list.map(([en, ar, required]) => `<li>${icon('doc', 16)}<span>${txt(t(en, ar))}</span><small>${required ? L('Required', 'مطلوب') : L('Optional', 'اختياري')}</small></li>`).join('')}</ul>
       <p class="help">${L('Bring these to the parish office. They are not needed to send the request.', 'أحضرها إلى مكتب الرعية. لا حاجة إليها لإرسال الطلب.')}</p>`
    : `<p class="mr-aside-text">${txt(t(...(generic[kind] || ['The parish office will tell you what is needed.', 'سيُعلمك مكتب الرعية بما يلزم.'])))}</p>`;
  const phone = M.requestOptions?.phone;
  return `<aside class="mr-aside">
    <section class="member-card"><h2>${list.length ? L('What to prepare', 'ما يجب تحضيره') : L('Good to know', 'معلومات مفيدة')}</h2>${body}${phone ? phoneLink(phone) : ''}</section>
    <section class="member-card"><h2>${L('After you send it', 'بعد الإرسال')}</h2><ol class="mr-mini-steps">
      <li>${L('The parish office reviews your request', 'يراجع مكتب الرعية طلبك')}</li>
      <li>${kind === 'certificate' ? L('The priest checks the register and signs', 'يتحقّق الكاهن من السجل ويوقّع') : L('The priest accepts it', 'يقبله الكاهن')}</li>
      <li>${kind === 'certificate' ? L('You collect it from the parish office', 'تستلمها من مكتب الرعية') : L('You follow preparation and dates here', 'تتابع التحضير والمواعيد من هنا')}</li></ol></section>
  </aside>`;
}

function newPage(kind) {
  if (!REQUEST_KINDS.some(k => k.id === kind)) return `<div class="member-page mr-page">${back()}
    <header class="member-head"><h1>${L('What would you like to ask for?', 'ماذا تودّ أن تطلب؟')}</h1></header>${kindGrid()}</div>`;
  if (!(M.requestOptions?.subjects || []).length) return `<div class="member-page mr-page">${back()}<header class="member-head"><h1>${L(...HEADING[kind])}</h1></header>${unlinked()}</div>`;
  const d = draftFor(kind), steps = STEP_NAMES();
  return `<div class="member-page mr-page">${back()}
    <header class="member-head mr-form-head"><span class="mr-head-icon" aria-hidden="true">${icon(kindOf(kind).icon, 26)}</span>
      <div><h1>${L(...HEADING[kind])}</h1><p>${L('Tell the parish office who it is for. They will review your request and guide you through every step.', 'أخبر مكتب الرعية لمن الطلب. سيراجع طلبك ويرافقك في كل خطوة.')}</p></div></header>
    <div class="mr-layout">
      <form class="member-card mr-form" id="mr-form" novalidate>
        <ol class="mr-progress" aria-label="${L('Steps', 'الخطوات')}">${steps.map((label, i) => `<li data-step-mark="${i + 1}" ${d.step === i + 1 ? 'aria-current="step"' : ''} class="${d.step > i + 1 ? 'done' : ''}"><span class="n" aria-hidden="true">${d.step > i + 1 ? icon('check', 13) : i + 1}</span><span>${txt(label)}</span></li>`).join('')}</ol>
        <div class="alert alert-warning mr-error-summary" id="mr-errors" role="alert" tabindex="-1" hidden></div>
        <div class="mr-step" data-step="1" ${d.step === 1 ? '' : 'hidden'}>${stepWho(d)}</div>
        <div class="mr-step" data-step="2" ${d.step === 2 ? '' : 'hidden'}>${stepDetails(d)}</div>
        <div class="mr-step" data-step="3" ${d.step === 3 ? '' : 'hidden'} id="mr-review">${d.step === 3 ? stepReview(d) : ''}</div>
        <div class="mr-actions">
          <button type="button" class="btn btn-secondary" id="mr-back" ${d.step === 1 ? 'hidden' : ''}>${L('Back', 'رجوع')}</button>
          <button type="button" class="btn btn-primary" id="mr-continue" ${d.step === 3 ? 'hidden' : ''}>${L('Continue', 'متابعة')}${icon('arrowR', 16)}</button>
          <button type="submit" class="btn btn-primary" id="mr-send" ${d.step === 3 ? '' : 'hidden'}>${icon('check', 16)}${L('Send request', 'إرسال الطلب')}</button>
        </div>
      </form>
      ${prepareAside(kind)}
    </div></div>`;
}

/* ---- one request --------------------------------------------------------------- */
function detailPage(id) {
  const r = M.requests.find(x => x.id === id);
  if (!r) return `<div class="member-page mr-page">${back()}<div class="member-empty"><p>${L('This request could not be found.', 'تعذّر العثور على هذا الطلب.')}</p>
    <a class="btn btn-secondary btn-dense" href="#/myrequests">${L('See all your requests', 'عرض كل طلباتك')}</a></div></div>`;
  const p = r.progress, closed = CLOSED.has(p.stage), [label, tone, mark] = stageInfo(r);
  const steps = stepsFor(r), done = stepsDone(r), phone = M.requestOptions?.phone;
  const quote = (title, text) => text ? `<blockquote class="mr-quote"><span class="lbl">${title}</span><p>${txt(text)}</p></blockquote>` : '';
  const dates = [p.preferredDate && [L('Preferred date', 'التاريخ المفضّل'), fmtDay(p.preferredDate)], p.plannedDate && [L('Planned date', 'الموعد المقرّر'), fmtDay(p.plannedDate)],
    p.register && [L('Register entry', 'رقم القيد'), `<bdi class="mono" dir="ltr">${txt(p.register)}</bdi>`]].filter(Boolean);
  const required = p.preparation.filter(x => x.required);
  const certificateFor = p.stage === 'completed' && ['baptism', 'communion', 'confirmation', 'marriage'].includes(r.kind);
  const details = summaryRows({ ...r.details, kind: r.kind, subject: r.subject.new ? 'child' : r.subject.id, child: r.details.child || {},
    purpose: PURPOSES.some(x => x[0] === r.details.purpose) ? r.details.purpose : r.details.purpose ? 'other' : '', purposeOther: r.details.purpose,
    date: r.details.date || '', phone: r.details.phone || '', notes: r.details.notes || '', partner: r.details.partner || '', partnerParish: r.details.partnerParish || '' })
    .filter(([k]) => k !== L('Request', 'الطلب'));
  if (!r.subject.new && !(M.requestOptions?.subjects || []).some(s => s.id === r.subject.id)) details.unshift([L('For', 'لـ'), nameOf(r.subject)]);
  return `<div class="member-page mr-page">${back()}
    ${S.ui.mrJustSent === r.id ? `<div class="mr-sent" role="status">${icon('check', 20)}<div><b>${L('Your request was sent', 'أُرسل طلبك')}</b>
      <p>${L(`The parish office has received it as ${r.reference}. You will see each update here and in your notifications.`, `استلمه مكتب الرعية برقم ${r.reference}. ستظهر كل التحديثات هنا وفي إشعاراتك.`)}</p></div></div>` : ''}
    <header class="mr-detail-head"><span class="mr-head-icon" aria-hidden="true">${icon(kindOf(r.kind).icon, 26)}</span>
      <div class="mr-detail-title"><h1>${txt(titleOf(r))}</h1>
        <p><span>${txt(nameOf(r.subject))}</span>${otherName(r.subject) ? ` <span class="dim">· ${txt(otherName(r.subject))}</span>` : ''}</p>
        <p class="mr-detail-meta"><bdi class="mono" dir="ltr">${txt(r.reference)}</bdi> · ${L('Sent', 'أُرسل')} ${fmtDate(r.createdAt)}</p></div>
      ${pill(label, tone, mark)}</header>
    <div class="mr-layout">
      <div class="mr-main">
        <section class="member-card mr-status" aria-labelledby="mr-status-title">
          <h2 id="mr-status-title">${L('Where your request stands', 'أين أصبح طلبك')}</h2>
          <ol class="steps${closed ? ' closed' : ''}">${steps.map((s, i) => `<li class="${i < done ? 'done' : i === done && !closed ? 'now' : ''}">
            <span class="dot" aria-hidden="true">${i < done ? icon('check', 13) : i + 1}</span><span class="lbl">${txt(s)}</span>
            <span class="sr-only">${i < done ? L('done', 'منجز') : i === done && !closed ? L('current step', 'الخطوة الحالية') : L('not yet', 'لم يحن بعد')}</span></li>`).join('')}</ol>
          <div class="mr-next${closed ? ' is-closed' : ''}"><span class="lbl">${closed ? L('Status', 'الحالة') : L('What happens next', 'ما الخطوة التالية')}</span><p>${txt(nextText(r))}</p></div>
          ${closed ? quote(L('Message from the parish office', 'رسالة من مكتب الرعية'), p.reason) : quote(L('Message from the parish office', 'رسالة من مكتب الرعية'), r.response)}
          ${dates.length ? `<dl class="mr-dates">${dates.map(([k, v]) => `<div><dt>${txt(k)}</dt><dd>${v.startsWith('<bdi') ? v : txt(v)}</dd></div>`).join('')}</dl>` : ''}
          ${certificateFor ? `<button type="button" class="btn btn-primary" data-mr-certificate="${txt(r.kind)}">${icon('cert', 16)}${L('Request a certificate', 'طلب شهادة')}</button>` : ''}
        </section>
        ${p.preparation.length ? `<section class="member-card mr-prep" aria-labelledby="mr-prep-title"><div class="mr-card-head"><h2 id="mr-prep-title">${L('Preparation', 'التحضير')}</h2>
          <span class="dim">${L(`${required.filter(x => x.done).length} of ${required.length} required done`, `${required.filter(x => x.done).length} من ${required.length} من المطلوب منجز`)}</span></div>
          <ul class="mr-checklist">${p.preparation.map(x => `<li class="${x.done ? 'done' : ''}">${icon(x.done ? 'check' : 'doc', 16)}<span>${txt(t(x.en, x.ar))}</span>
            <small>${x.done ? L('Done', 'منجز') : x.required ? L('Required', 'مطلوب') : L('Optional', 'اختياري')}</small></li>`).join('')}</ul>
          <p class="help">${L('The parish office ticks each item once it has what it needs. Bring documents to the office.', 'يؤشّر مكتب الرعية على كل بند عند استلام ما يلزم. أحضر المستندات إلى المكتب.')}</p></section>` : ''}
        <section class="member-card mr-history" aria-labelledby="mr-history-title"><h2 id="mr-history-title">${L('History', 'السجلّ')}</h2>
          <ol class="mr-timeline">${p.events.slice().reverse().map(e => `<li><span class="mr-timeline-dot" aria-hidden="true"></span><span class="mr-timeline-what">${txt(eventLabel(e.key))}</span><time datetime="${txt(e.at)}">${fmtDate(e.at)}</time></li>`).join('')}</ol></section>
      </div>
      <aside class="mr-aside">
        <section class="member-card"><h2>${L('Your request', 'طلبك')}</h2>${summaryList(details, ' mr-summary-compact')}</section>
        <section class="member-card"><h2>${L('Questions?', 'أسئلة؟')}</h2><p class="mr-aside-text">${L(`Quote ${r.reference} when you contact the parish office.`, `اذكر الرقم ${r.reference} عند تواصلك مع مكتب الرعية.`)}</p>${phone ? phoneLink(phone) : ''}
          ${r.canWithdraw ? `<div class="mr-withdraw"><p class="help">${L('You can withdraw this request until the parish office reviews it.', 'يمكنك سحب هذا الطلب ما دام مكتب الرعية لم يراجعه بعد.')}</p>
            <button type="button" class="btn btn-secondary btn-dense" data-mr-withdraw="${txt(r.id)}">${L('Withdraw request', 'سحب الطلب')}</button></div>` : ''}</section>
      </aside>
    </div></div>`;
}

/* ---- the route ---------------------------------------------------------------- */
export function requestsPage(first = '', second = '') {
  if (first === 'new') return newPage(second);
  if (first) return detailPage(first);
  return listPage();
}

const read = (el, id) => el.querySelector('#' + id)?.value.trim() ?? '';
function collect(host, d) {
  const radio = name => host.querySelector(`input[name="${name}"]:checked`)?.value || '';
  if (host.querySelector('[data-step="1"]:not([hidden])')) {
    d.subject = radio('mr-subject') || d.subject;
    if (d.kind === 'baptism') d.child = { lat: read(host, 'mr-child-lat'), ar: read(host, 'mr-child-ar'), born: read(host, 'mr-child-born'), father: read(host, 'mr-child-father'), mother: read(host, 'mr-child-mother') };
  }
  if (host.querySelector('[data-step="2"]:not([hidden])')) {
    if (d.kind === 'certificate') {
      d.certificateOf = radio('mr-of'); d.purpose = radio('mr-purpose'); d.purposeOther = read(host, 'mr-purpose-other'); d.language = radio('mr-language') || 'bilingual';
    } else {
      d.date = read(host, 'mr-date');
      if (d.kind === 'marriage') { d.partner = read(host, 'mr-partner'); d.partnerParish = read(host, 'mr-partner-parish'); }
    }
    d.phone = read(host, 'mr-phone'); d.notes = host.querySelector('#mr-notes')?.value.trim() ?? d.notes;
  }
}
function problems(d, step) {
  const out = [];
  if (step === 1) {
    if (!d.subject) out.push(['mr-subject', L('Choose who the request is for.', 'اختر لمن الطلب.')]);
    if (d.subject === 'child') {
      if (!d.child.lat) out.push(['mr-child-lat', L('Enter the child’s full name in English.', 'أدخل اسم الطفل الكامل بالإنكليزية.')]);
      if (!d.child.ar) out.push(['mr-child-ar', L('Enter the child’s full name in Arabic.', 'أدخل اسم الطفل الكامل بالعربية.')]);
      if (!d.child.born) out.push(['mr-child-born', L('Enter the child’s date of birth.', 'أدخل تاريخ ولادة الطفل.')]);
      else if (d.child.born > todayKey()) out.push(['mr-child-born', L('The date of birth cannot be in the future.', 'لا يمكن أن يكون تاريخ الولادة في المستقبل.')]);
    }
  }
  if (step === 2) {
    if (d.kind === 'certificate') {
      if (!d.certificateOf) out.push(['mr-of', L('Choose which certificate you need.', 'اختر الشهادة التي تحتاج إليها.')]);
      if (!d.purpose) out.push(['mr-purpose', L('Choose what the certificate is for.', 'اختر غرض الشهادة.')]);
      else if (d.purpose === 'other' && !d.purposeOther) out.push(['mr-purpose-other', L('Describe what the certificate is for.', 'صِف غرض الشهادة.')]);
    } else {
      if (d.date && d.date < todayKey()) out.push(['mr-date', L('Choose a date from today onwards.', 'اختر تاريخاً ابتداءً من اليوم.')]);
      if (d.kind === 'marriage' && !d.partner) out.push(['mr-partner', L('Enter the full name of your future spouse.', 'أدخل اسم الشريك الكامل.')]);
    }
    if (d.notes.length > 500) out.push(['mr-notes', L('Keep your message within 500 characters.', 'اجعل رسالتك ضمن ٥٠٠ حرف.')]);
  }
  return out;
}
function showProblems(host, list) {
  host.querySelectorAll('.mr-error').forEach(e => { e.hidden = true; e.textContent = ''; });
  host.querySelectorAll('[aria-invalid="true"]').forEach(e => e.removeAttribute('aria-invalid'));
  const summary = host.querySelector('#mr-errors');
  if (!list.length) { summary.hidden = true; summary.innerHTML = ''; return true; }
  for (const [id, message] of list) {
    const error = host.querySelector(`#${id}-error`);
    if (error) { error.innerHTML = icon('warn', 14) + `<span>${txt(message)}</span>`; error.hidden = false; }
    (host.querySelector('#' + id) || host.querySelector(`#${id}-group`))?.setAttribute('aria-invalid', 'true');
  }
  summary.innerHTML = `${icon('warn', 18)}<span><b>${L('Please check the following:', 'يُرجى التحقّق مما يلي:')}</b><ul>${list.map(([id, message]) =>
    `<li><a href="#${id}" data-focus="${id}">${txt(message)}</a></li>`).join('')}</ul></span>`;
  summary.hidden = false;
  summary.querySelectorAll('[data-focus]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const target = host.querySelector('#' + a.dataset.focus) || host.querySelector(`#${a.dataset.focus}-group input:not([disabled])`);
    target?.focus();
  }));
  summary.focus();
  return false;
}
/* As the parishioner corrects a field, its message goes; nothing new is flagged until they continue. */
function clearFixed(host, d) {
  const summary = host.querySelector('#mr-errors');
  if (summary.hidden) return;
  const still = new Map(problems(d, d.step));
  host.querySelectorAll('.mr-error:not([hidden])').forEach(error => {
    const id = error.id.replace(/-error$/, ''), message = still.get(id), link = summary.querySelector(`[data-focus="${id}"]`);
    if (message) {
      if (link && link.textContent !== message) { link.textContent = message; error.querySelector('span').textContent = message; }
      return;
    }
    error.hidden = true; error.textContent = '';
    (host.querySelector('#' + id) || host.querySelector(`#${id}-group`))?.removeAttribute('aria-invalid');
    link?.closest('li')?.remove();
  });
  if (!summary.querySelector('li')) { summary.hidden = true; summary.innerHTML = ''; }
}
function showStep(host, d, step) {
  d.step = step;
  host.querySelectorAll('.mr-step').forEach(s => { s.hidden = Number(s.dataset.step) !== step; });
  if (step === 3) host.querySelector('#mr-review').innerHTML = stepReview(d);
  host.querySelectorAll('[data-step-mark]').forEach(li => {
    const n = Number(li.dataset.stepMark);
    li.classList.toggle('done', n < step);
    n === step ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current');
    li.querySelector('.n').innerHTML = n < step ? icon('check', 13) : String(n);
  });
  host.querySelector('#mr-back').hidden = step === 1;
  host.querySelector('#mr-continue').hidden = step === 3;
  host.querySelector('#mr-send').hidden = step !== 3;
  showProblems(host, []);
  wireReview(host, d);
  host.querySelector('#mr-form').scrollIntoView({ block: 'start', behavior: 'smooth' });
  const heading = host.querySelector(`.mr-step[data-step="${step}"] .mr-legend`);
  if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
}
function wireReview(host, d) {
  host.querySelectorAll('[data-mr-step]').forEach(b => b.addEventListener('click', () => showStep(host, d, Number(b.dataset.mrStep))));
}

function mountForm(host) {
  const form = host.querySelector('#mr-form');
  if (!form) return;
  const d = S.ui.mrDraft;
  const toggleChild = () => { const child = host.querySelector('#mr-child'); if (child) child.hidden = host.querySelector('input[name="mr-subject"]:checked')?.value !== 'child'; };
  host.querySelectorAll('input[name="mr-subject"]').forEach(r => r.addEventListener('change', () => { toggleChild(); collect(host, d); }));
  host.querySelectorAll('input[name="mr-purpose"]').forEach(r => r.addEventListener('change', () => {
    const wrap = host.querySelector('#mr-purpose-other-wrap'); wrap.hidden = r.value !== 'other';
    if (r.value === 'other') host.querySelector('#mr-purpose-other').focus();
  }));
  const notes = host.querySelector('#mr-notes'), count = host.querySelector('#mr-notes-count');
  notes?.addEventListener('input', () => { count.textContent = `${notes.value.length} / 500`; });
  form.addEventListener('input', () => { collect(host, d); clearFixed(host, d); });
  form.addEventListener('change', () => { collect(host, d); clearFixed(host, d); });
  host.querySelector('#mr-continue').addEventListener('click', () => {
    collect(host, d);
    if (showProblems(host, problems(d, d.step))) showStep(host, d, d.step + 1);
  });
  host.querySelector('#mr-back').addEventListener('click', () => { collect(host, d); showStep(host, d, d.step - 1); });
  wireReview(host, d);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (d.step !== 3) { host.querySelector('#mr-continue').click(); return; }
    const send = host.querySelector('#mr-send');
    send.disabled = true; send.setAttribute('aria-busy', 'true');
    const values = { kind: d.kind, notes: d.notes, phone: d.phone,
      ...(d.subject === 'child' ? { child: d.child } : { personId: d.subject }),
      ...(d.kind === 'certificate' ? { certificateOf: d.certificateOf, purpose: d.purpose === 'other' ? d.purposeOther : d.purpose, language: d.language }
        : { date: d.date, ...(d.kind === 'marriage' ? { partner: d.partner, partnerParish: d.partnerParish } : {}) }) };
    try {
      const result = await memberAction('sacramentRequest', values);
      S.ui.mrDraft = null; S.ui.mrJustSent = result.id;
      await reload();
      go('myrequests/' + result.id);
    } catch (error) {
      send.disabled = false; send.removeAttribute('aria-busy');
      showProblems(host, [['mr-send', error.message]]);
      toast(L('Your request was not sent', 'لم يُرسل طلبك'), error.message, 'danger');
    }
  });
}

requestsPage.mount = host => {
  mountForm(host);
  host.querySelectorAll('[data-mr-withdraw]').forEach(b => b.addEventListener('click', () => {
    const r = M.requests.find(x => x.id === b.dataset.mrWithdraw);
    if (!r) return;
    openModal({
      title: L('Withdraw this request?', 'سحب هذا الطلب؟'),
      body: `<div class="mr-withdraw-what"><span class="mr-card-icon" aria-hidden="true">${icon(kindOf(r.kind).icon, 20)}</span><div><b>${txt(titleOf(r))}</b>
        <span>${txt(nameOf(r.subject))} · <bdi class="mono" dir="ltr">${txt(r.reference)}</bdi></span></div></div>
        <p class="mr-withdraw-note">${L('The parish office will no longer see it as waiting. You can send a new request at any time.', 'لن يظهر لمكتب الرعية كطلب منتظر بعد الآن. يمكنك إرسال طلب جديد في أي وقت.')}</p>`,
      foot: `<button class="btn btn-secondary" data-close>${L('Keep the request', 'إبقاء الطلب')}</button><button class="btn btn-danger" id="mr-withdraw-yes">${L('Withdraw request', 'سحب الطلب')}</button>`,
      onMount(el) {
        const yes = el.querySelector('#mr-withdraw-yes');
        yes.addEventListener('click', async () => {
          yes.disabled = true; yes.setAttribute('aria-busy', 'true');
          try {
            await memberAction('requestWithdraw', { id: r.id });
            await reload(); closeOverlays(); redraw();
            toast(L('Request withdrawn', 'سُحب الطلب'), '', 'success');
          } catch (error) {
            yes.disabled = false; yes.removeAttribute('aria-busy');
            toast(L('Could not withdraw the request', 'تعذّر سحب الطلب'), error.message, 'danger');
          }
        });
      }
    });
  }));
  host.querySelectorAll('[data-mr-certificate]').forEach(b => b.addEventListener('click', () => {
    const r = M.requests.find(x => location.hash.endsWith(x.id));
    S.ui.mrDraft = null;
    S.ui.mrPrefill = { kind: 'certificate', certificateOf: b.dataset.mrCertificate, subject: r && !r.subject.new ? r.subject.id : '' };
    go('myrequests/new/certificate');
  }));
  if (S.ui.mrJustSent && location.hash.endsWith(S.ui.mrJustSent)) setTimeout(() => { S.ui.mrJustSent = null; }, 0);
};

/* The home page's view of requests: what is moving, or how to start. */
export function homeCard() {
  const active = M.requests.filter(isActive);
  if (active.length) return `<section class="member-card mr-home"><div class="mr-card-head"><h2>${L('Sacraments & certificates', 'الأسرار والشهادات')}</h2>
      <a class="btn btn-ghost btn-dense" href="#/myrequests">${L('View all', 'عرض الكل')}</a></div>
    <div class="mr-cards">${active.slice(0, 2).map(requestCard).join('')}</div></section>`;
  return `<section class="member-card mr-home mr-home-cta"><div class="mr-home-icons" aria-hidden="true">${['water', 'rings', 'cert'].map(i => `<span>${icon(i, 20)}</span>`).join('')}</div>
    <div><h2>${L('Planning a baptism or a wedding, or need a certificate?', 'تخطّط لمعمودية أو إكليل، أو تحتاج إلى شهادة؟')}</h2>
      <p>${L('Ask your parish online and follow every step here.', 'اطلب من رعيتك عبر الإنترنت وتابع كل خطوة من هنا.')}</p></div>
    <a class="btn btn-primary" href="#/myrequests">${L('Start a request', 'ابدأ طلباً')}</a></section>`;
}
