/* Online requests: what parishioners send from the member portal for a sacrament or a certificate.
   The parish office or the priest reviews each one here; accepting it opens the usual entry in
   Requests, and the parishioner follows that entry, step by step, from the portal. */
import { t, isAr, fmtDate } from '../i18n.js';
import { is, bus, S } from '../store.js';
import { icon, who, pill, esc, openDrawer, closeOverlays, toast } from '../ui.js';
import * as C from '../components.js';
import { need } from '../flows.js';
import { workflow as serverWorkflow } from '../persist.js';
import { MEMBER_REQUESTS, SACRAMENTS, PEOPLE, ARCHIVED, HOUSEHOLDS, person } from '../data.js';
import { kindOf, certificateName, purposeText, languageName, fmtDay } from '../sacrament-requests.js';

const L = (en, ar) => t(en, ar);
const ONCE = new Set(['baptism', 'communion', 'confirmation', 'funeral']);
const ACTIVE = new Set(['requested', 'office-reviewed', 'preparing', 'scheduled', 'draft', 'awaiting-signature']);
const OFFICIAL = new Set(['registered', 'issued']);
const nameOf = p => p ? (isAr() ? p.ar || p.lat : p.lat || p.ar) || '' : '';
const fold = v => String(v || '').trim().toLowerCase();
const familyName = v => fold(v).split(/\s+/).pop();
const kindLabel = k => L(kindOf(k).en, kindOf(k).ar);

export const waitingOnline = () => MEMBER_REQUESTS.filter(r => r.status === 'submitted');
export const onlineTitle = r => r.kind === 'certificate' ? certificateName(r.details.certificateOf) : kindLabel(r.kind);
/* Who the request is about: someone in People, or a child the parish has not registered yet. */
export const subjectOf = r => r.details.child
  ? { id: '', lat: r.details.child.lat, ar: r.details.child.ar, born: r.details.child.born, child: true }
  : person(r.details.personId) || { id: r.details.personId, lat: L('Person no longer in People', 'شخص لم يعد في المؤمنين'), ar: '' };
/* Marks an entry that started as an online request, wherever the office sees it. */
export const onlineMark = s => s?.memberRequestId ? `<span class="or-mark" title="${esc(L(`Sent online as ${s.memberReference}`, `أُرسل إلكترونياً برقم ${s.memberReference}`))}">${icon('globe', 12)}${L('Online', 'إلكتروني')}</span>` : '';
export const sharedNote = s => s?.memberRequestId
  ? `<p class="or-shared">${icon('info', 15)}<span>${L('The parishioner sent this request online. They will see this reason in the member portal.', 'أرسل المؤمن هذا الطلب إلكترونياً، وسيرى هذا السبب في بوّابة المؤمنين.')}</span></p>` : '';

/* The same checks the server makes, so the office sees the problem before pressing a button. */
function conflict(personId, kind) {
  const records = SACRAMENTS.filter(s => s.person === personId && s.kind === kind);
  if (ONCE.has(kind) && records.some(s => OFFICIAL.has(s.status))) return L('This sacrament is already recorded in the register for this person. Decline the request, or ask the family to request a certificate.', 'هذا السرّ مدوَّن في السجل لهذا الشخص. ارفض الطلب، أو اطلب من العائلة طلب شهادة.');
  if (records.some(s => ACTIVE.has(s.status))) return L('This person already has an open request or preparation for this sacrament.', 'لهذا الشخص طلب مفتوح أو تحضير جارٍ لهذا السرّ.');
  return '';
}
const matchesFor = child => PEOPLE.filter(p => fold(p.lat) === fold(child.lat) || (p.born === child.born && familyName(p.lat) === familyName(child.lat)))
  .map(p => ({ p, exact: fold(p.lat) === fold(child.lat) && p.born === child.born }));
const archivedTwin = child => ARCHIVED.some(p => fold(p.lat) === fold(child.lat) && p.born === child.born);
const sourcesFor = r => SACRAMENTS.filter(s => s.kind === r.details.certificateOf && s.person === r.details.personId && OFFICIAL.has(s.status));
const plannedFor = r => SACRAMENTS.filter(s => s.kind === r.details.certificateOf && s.person === r.details.personId && ACTIVE.has(s.status));
const householdOf = id => HOUSEHOLDS.find(h => h.id === id);

/* Rows for the Requests page. Accepted requests are left out: their entry carries them on. */
export const onlineItems = () => MEMBER_REQUESTS.filter(r => r.status !== 'accepted').map(r => ({
  category: 'online', title: onlineTitle(r), who: subjectOf(r), state: r.status === 'declined' ? 'rejected' : r.status,
  open: r.status === 'submitted', date: r.createdAt, priority: '', online: true,
  owner: r.status === 'submitted' ? L('Priest or parish office', 'الكاهن أو مكتب الرعية') : '',
  next: r.status === 'submitted' ? L('Review the online request', 'مراجعة الطلب الإلكتروني')
    : r.status === 'withdrawn' ? L('Nothing to do — the parishioner withdrew it', 'لا شيء — سحبه المؤمن') : L('Nothing more to do — the parishioner was told why', 'لا شيء آخر — أُبلغ المؤمن بالسبب'),
  href: `#/requests/online/${r.id}`, ref: r.reference }));

/* ---- the review drawer ------------------------------------------------------------- */
const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
const phoneLink = v => v && v !== '—' ? `<a href="tel:${esc(String(v).replace(/[^\d+]/g, ''))}"><bdi dir="ltr">${esc(v)}</bdi></a>` : '';

function subjectBlock(r) {
  const d = r.details;
  if (!d.child) {
    const p = person(d.personId);
    return `<div class="or-who">${who(subjectOf(r))}${p ? `<a class="btn btn-ghost btn-dense" href="#/person/${esc(p.id)}">${L('Open record', 'فتح السجل')}</a>` : ''}</div>`;
  }
  const c = d.child;
  return `<div class="or-who">${who({ lat: c.lat, ar: c.ar })}${pill(L('Not in People yet', 'غير مسجّل بعد'), 'info', 'st-open')}</div>
    <dl class="dl or-dl">${row(L('Date of birth', 'تاريخ الولادة'), esc(fmtDay(c.born)))}${row(L('Father', 'الأب'), esc(c.father))}${row(L('Mother', 'الأم'), esc(c.mother))}</dl>`;
}

function matchBlock(r) {
  const c = r.details.child;
  if (!c) return '';
  const matches = matchesFor(c), exact = matches.find(m => m.exact), requester = person(r.requester.personId);
  const home = householdOf(r.requester.household);
  const option = (value, title, sub, { checked = false, disabled = false } = {}) => `<label class="or-option${disabled ? ' is-disabled' : ''}">
    <input type="radio" name="or-person" value="${esc(value)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
    <span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;
  return `<section class="or-section or-accept-only" aria-labelledby="or-match-title"><h4 id="or-match-title">${L('Person record', 'سجل الشخص')}</h4>
    ${archivedTwin(c) && !exact ? C.inlineAlert('warning', L('An archived record has this name and birth date. ', 'يوجد سجل مؤرشف بالاسم وتاريخ الولادة نفسيهما. '), L('Restore it from People before accepting, so the child is not recorded twice.', 'استعِده من المؤمنين قبل القبول، كي لا يُسجَّل الطفل مرّتين.')) : ''}
    <div class="or-options" role="radiogroup" aria-labelledby="or-match-title">
      ${option('', L('Create a new person record for the child', 'إنشاء سجل جديد للطفل'), exact ? L('A person with this name and birth date already exists', 'يوجد شخص بالاسم وتاريخ الولادة نفسيهما') : L('Recommended when the child is not listed below', 'مستحسن إذا لم يكن الطفل مدرجاً أدناه'), { checked: !exact, disabled: !!exact })}
      ${matches.map(({ p, exact: same }) => option(p.id, `${p.lat} · ${p.ar}`, `${L('Born', 'مواليد')} ${p.born ? fmtDay(p.born) : '—'}${same ? ` · ${L('Same name and birth date', 'الاسم وتاريخ الولادة نفسيهما')}` : ` · ${L('Similar name', 'اسم مشابه')}`}`, { checked: exact?.p.id === p.id })).join('')}
    </div>
    ${home ? `<label class="check or-household"><input type="checkbox" id="or-household" ${exact?.p.hh ? '' : 'checked'}>
      <span>${L(`Add the child to the ${home.name} household`, `إضافة الطفل إلى عائلة ${home.ar}`)}<small>${L(`${nameOf(requester)} belongs to this household.`, `${nameOf(requester)} من هذه العائلة.`)}</small></span></label>` : ''}
  </section>`;
}

function sourceBlock(r) {
  if (r.kind !== 'certificate') return '';
  const sources = sourcesFor(r), planned = plannedFor(r);
  return `<section class="or-section or-accept-only" aria-labelledby="or-source-title"><h4 id="or-source-title">${L('Register entry', 'قيد السجل')}</h4>
    <div class="formrow"><label class="label" for="or-source">${L('Take the certificate from', 'تؤخذ الشهادة من')}</label>
      <select class="select" id="or-source">
        ${sources.map(s => `<option value="official:${esc(s.id)}">${esc(s.reg)} · ${esc(kindLabel(s.kind))} · ${esc(s.date ? fmtDate(s.date) : '')} (${L('official', 'رسمي')})</option>`).join('')}
        ${planned.map(s => `<option value="pending:${esc(s.id)}">${esc(s.reg)} · ${esc(kindLabel(s.kind))} (${L('not approved yet', 'لم يُعتمد بعد')})</option>`).join('')}
        <option value="">${L('No entry yet — the request waits for one', 'لا قيد بعد — ينتظر الطلب قيداً')}</option>
      </select>
      <span class="help">${sources.length ? L('With an official entry, the request goes straight to the priest for approval.', 'مع قيد رسمي، يذهب الطلب مباشرة إلى الكاهن للاعتماد.')
        : L('There is no approved entry for this person in this parish. The request can wait for one, or be declined if the sacrament was celebrated elsewhere.', 'لا قيد معتمداً لهذا الشخص في هذه الرعية. يمكن أن ينتظر الطلب قيداً، أو يُرفض إذا احتُفل بالسرّ في رعية أخرى.')}</span></div>
  </section>`;
}

function detailsBlock(r) {
  const d = r.details;
  const rows = r.kind === 'certificate'
    ? row(L('Certificate', 'الشهادة'), esc(certificateName(d.certificateOf))) + row(L('Purpose', 'الغرض'), esc(purposeText(d.purpose))) + row(L('Language', 'اللغة'), esc(languageName(d.language)))
    : row(L('Sacrament', 'السرّ'), esc(kindLabel(r.kind))) + row(L('Preferred date', 'التاريخ المفضّل'), d.date ? esc(fmtDay(d.date)) : `<span class="dim">${L('No preference', 'بلا تفضيل')}</span>`)
      + (r.kind === 'marriage' ? row(L('Future spouse', 'الشريك'), esc(d.partner)) + row(L('Their parish', 'رعيّته'), esc(d.partnerParish)) : '');
  return `<section class="or-section" aria-labelledby="or-details-title"><h4 id="or-details-title">${L('The request', 'الطلب')}</h4>
    <dl class="dl or-dl">${rows}</dl>
    ${d.notes ? `<blockquote class="or-quote"><span>${L('Message from the parishioner', 'رسالة من المؤمن')}</span><p><bdi>${esc(d.notes)}</bdi></p></blockquote>` : ''}</section>`;
}

function fromBlock(r) {
  const q = r.requester, p = person(q.personId), home = householdOf(q.household);
  const contact = r.details.phone, profile = q.phone && q.phone !== '—' && q.phone !== contact ? q.phone : '';
  return `<section class="or-section" aria-labelledby="or-from-title"><h4 id="or-from-title">${L('Sent by', 'أرسله')}</h4>
    <dl class="dl or-dl">${row(L('Parishioner', 'المؤمن'), p ? `<a href="#/person/${esc(p.id)}">${esc(nameOf(p))}</a>` : esc(q.name))}
      ${row(L('Phone for this request', 'هاتف هذا الطلب'), phoneLink(contact))}${row(L('Phone on record', 'الهاتف في السجل'), phoneLink(profile))}
      ${row(L('Household', 'العائلة'), home ? `<a href="#/household/${esc(home.id)}">${esc(L(home.name, home.ar))}</a>` : '')}
      ${row(L('Sent', 'أُرسل'), `${esc(fmtDate(r.createdAt))} · ${L('member portal', 'بوّابة المؤمنين')}`)}</dl></section>`;
}

function outcomeBlock(r) {
  if (r.status === 'withdrawn') return C.inlineAlert('info', L('Withdrawn. ', 'مسحوب. '), L(`The parishioner withdrew this request on ${fmtDate(r.updatedAt)}.`, `سحب المؤمن هذا الطلب في ${fmtDate(r.updatedAt)}.`));
  if (r.status === 'declined') return `${C.inlineAlert('warning', L('Not accepted. ', 'لم يُقبل. '), L(`Declined on ${fmtDate(r.updatedAt)}. The parishioner saw this message:`, `رُفض في ${fmtDate(r.updatedAt)}. رأى المؤمن هذه الرسالة:`))}
    <blockquote class="or-quote"><p><bdi>${esc(r.response)}</bdi></p></blockquote>`;
  if (r.status === 'accepted') {
    const s = SACRAMENTS.find(x => x.id === r.sacramentId);
    return C.inlineAlert('success', L('Accepted. ', 'مقبول. '), L(`Accepted on ${fmtDate(r.updatedAt)}.`, `قُبل في ${fmtDate(r.updatedAt)}.`),
      s ? `<a class="btn btn-secondary btn-dense" href="#/certificate/${esc(s.id)}">${L('Open the entry', 'فتح القيد')} · <bdi class="mono" dir="ltr">${esc(s.reg)}</bdi></a>` : '');
  }
  return '';
}

const acceptLabel = r => {
  if (r.kind === 'certificate') return L('Accept request', 'قبول الطلب');
  return is('priest') ? L('Accept for preparation', 'القبول للتحضير') : L('Accept and send to the priest', 'القبول والإرسال إلى الكاهن');
};

export function openOnlineRequest(id) {
  const r = MEMBER_REQUESTS.find(x => x.id === id);
  if (!r) {
    toast(L('Online request not found', 'لم يُعثر على الطلب الإلكتروني'), L('It may have been handled from another screen.', 'ربما عولج من شاشة أخرى.'), 'warning');
    return;
  }
  const canAct = r.status === 'submitted' && is('priest', 'secretary');
  const blocked = canAct && r.kind !== 'certificate' && !r.details.child ? conflict(r.details.personId, r.kind) : '';
  const missing = canAct && !r.details.child && !person(r.details.personId);
  openDrawer({
    large: true,
    title: `${onlineTitle(r)} · ${L('online request', 'طلب إلكتروني')}`,
    sub: `<bdi class="mono" dir="ltr">${esc(r.reference)}</bdi> · ${L('Sent', 'أُرسل')} ${esc(fmtDate(r.createdAt))}`,
    body: `<div class="or-body">
      ${outcomeBlock(r)}
      ${missing ? C.inlineAlert('warning', L('Person not found. ', 'الشخص غير موجود. '), L('The person on this request is no longer active in People. Decline it, or restore the record first.', 'لم يعد صاحب الطلب ناشطاً في المؤمنين. ارفضه، أو استعِد السجل أولاً.')) : ''}
      ${blocked ? C.inlineAlert('warning', L('Cannot be accepted. ', 'لا يمكن قبوله. '), blocked) : ''}
      <section class="or-section" aria-labelledby="or-subject-title"><h4 id="or-subject-title">${L('For', 'لـ')}</h4>${subjectBlock(r)}</section>
      ${canAct ? matchBlock(r) : ''}
      ${detailsBlock(r)}
      ${fromBlock(r)}
      ${canAct ? sourceBlock(r) : ''}
      ${canAct ? `<section class="or-section or-reply" id="or-reply" aria-labelledby="or-reply-title"><h4 id="or-reply-title">${L('Reply to the parishioner', 'الردّ على المؤمن')}</h4>
        <div class="formrow"><label class="label" for="or-note"><span data-or-label="accept">${L('Message', 'الرسالة')}<span class="opt">${L('(optional)', '(اختياري)')}</span></span><span data-or-label="decline" hidden>${L('Why it cannot be accepted', 'لماذا تعذّر قبوله')}<span class="req">*</span></span></label>
          <textarea class="textarea" id="or-note" rows="3" maxlength="500" aria-describedby="or-note-help"></textarea>
          <span class="help" id="or-note-help">${L('The parishioner sees this on their request page and in their notification.', 'يرى المؤمن هذه الرسالة في صفحة طلبه وفي الإشعار.')}</span></div></section>` : ''}
    </div>`,
    foot: canAct
      ? `<button class="btn btn-secondary" id="or-decline">${L('Decline…', 'رفض…')}</button>
         <button class="btn btn-secondary" id="or-back" hidden>${L('Back', 'رجوع')}</button>
         <button class="btn btn-danger" id="or-decline-yes" hidden style="margin-inline-start:auto">${L('Decline request', 'رفض الطلب')}</button>
         <button class="btn btn-primary" id="or-accept" style="margin-inline-start:auto" ${blocked || missing ? 'disabled' : ''}>${icon('check', 16)}${acceptLabel(r)}</button>`
      : `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>`,
    onMount(el) {
      if (!canAct) return;
      const note = el.querySelector('#or-note'), accept = el.querySelector('#or-accept');
      const declineMode = on => {
        el.querySelectorAll('.or-accept-only').forEach(x => { x.hidden = on; });
        el.querySelector('[data-or-label="accept"]').hidden = on; el.querySelector('[data-or-label="decline"]').hidden = !on;
        el.querySelector('#or-decline').hidden = on; accept.hidden = on;
        el.querySelector('#or-back').hidden = !on; el.querySelector('#or-decline-yes').hidden = !on;
        el.querySelector('#or-reply').classList.toggle('is-decline', on);
        if (on) { note.focus(); note.closest('.or-section').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      };
      /* Choosing an existing person for a child re-checks for a clash, and whether they already have a household. */
      const refresh = () => {
        const chosen = el.querySelector('input[name="or-person"]:checked')?.value || '';
        const household = el.querySelector('#or-household'), match = chosen && PEOPLE.find(p => p.id === chosen);
        /* someone already in a household stays there; anyone else joins the requester's household by default */
        if (household) { const was = household.disabled; household.disabled = !!(match && match.hh); if (household.disabled) household.checked = false; else if (was) household.checked = true; }
        const clash = chosen ? conflict(chosen, r.kind) : '';
        let warn = el.querySelector('#or-clash');
        if (clash && !warn) { warn = document.createElement('div'); warn.id = 'or-clash'; el.querySelector('.or-options').after(warn); }
        if (warn) warn.innerHTML = clash ? C.inlineAlert('warning', L('Cannot be accepted for this person. ', 'لا يمكن قبوله لهذا الشخص. '), clash) : '';
        accept.disabled = !!clash || (!chosen && archivedTwin(r.details.child || {}));
      };
      el.querySelectorAll('input[name="or-person"]').forEach(x => x.addEventListener('change', refresh));
      if (r.details.child) refresh();
      el.querySelector('#or-decline').addEventListener('click', () => declineMode(true));
      el.querySelector('#or-back').addEventListener('click', () => declineMode(false));
      el.querySelector('#or-decline-yes').addEventListener('click', async e => {
        if (!need(el, '#or-note', L('Tell the parishioner why the request cannot be accepted.', 'أخبر المؤمن لماذا تعذّر قبول الطلب.'))) return;
        const button = e.currentTarget; button.disabled = true;
        try {
          await serverWorkflow('decline-member-request', r.id, { requestId: r.id, reason: note.value.trim() });
          closeOverlays(); S.params = []; history.replaceState(null, '', '#/requests'); bus.refresh();
          toast(L('Request declined', 'رُفض الطلب'), L('The parishioner was notified with your message.', 'أُبلغ المؤمن برسالتك.'), 'success');
        } catch (error) { button.disabled = false; toast(L('Could not decline the request', 'تعذّر رفض الطلب'), error.message, 'danger'); }
      });
      accept.addEventListener('click', async () => {
        const extra = { requestId: r.id, note: note.value.trim() };
        const chosen = el.querySelector('input[name="or-person"]:checked');
        if (chosen?.value) extra.personId = chosen.value;
        const household = el.querySelector('#or-household');
        if (household) extra.household = household.checked && !household.disabled;
        const [type, recordId] = (el.querySelector('#or-source')?.value || '').split(':');
        if (type === 'official') extra.sourceRecordId = recordId;
        if (type === 'pending') extra.requestedSacramentId = recordId;
        const entry = 'sc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        accept.disabled = true; accept.setAttribute('aria-busy', 'true');
        try {
          await serverWorkflow('accept-member-request', entry, extra);
          closeOverlays(); location.hash = `#/certificate/${entry}`;
          toast(L('Request accepted', 'قُبل الطلب'), r.kind === 'certificate'
            ? (type === 'official' ? L('It is with the priest for approval. The parishioner was notified.', 'هو لدى الكاهن للاعتماد. أُبلغ المؤمن.') : L('It waits for an official register entry. The parishioner was notified.', 'ينتظر قيداً رسمياً. أُبلغ المؤمن.'))
            : is('priest') ? L('Preparation can begin. The parishioner was notified.', 'يمكن بدء التحضير. أُبلغ المؤمن.') : L('The priest can now decide. The parishioner was notified.', 'يمكن للكاهن اتخاذ القرار الآن. أُبلغ المؤمن.'), 'success');
        } catch (error) {
          accept.disabled = false; accept.removeAttribute('aria-busy');
          toast(L('Could not accept the request', 'تعذّر قبول الطلب'), error.message, 'danger');
        }
      });
    }
  });
}
