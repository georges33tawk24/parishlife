/* Certificates asked for without an account, as the parish office handles them: find the person in the
   registers (or decline), then the certificate follows the usual path — the priest signs, the bishop
   accepts — and the office attaches the signed scan for download or hands it over at the office. */
import * as D from '../data.js';
import { parishAPI } from '../api.js';
import { hydrate } from '../persist.js';
import { t, fmtDate } from '../i18n.js';
import { bus } from '../store.js';
import { esc, pill, openDrawer, closeOverlays, toast } from '../ui.js';
import { icon } from '../icons.js';
import * as C from '../components.js';

const L = (en, ar) => t(en, ar);
export const GUEST_KIND = {
  baptism: ['Baptism certificate', 'إفادة معمودية'], communion: ['First Communion certificate', 'إفادة مناولة أولى'],
  confirmation: ['Confirmation certificate', 'إفادة تثبيت'], marriage: ['Marriage certificate', 'إفادة زواج']
};
const RELATION = { self: ['themselves', 'لنفسه'], parent: ['a parent', 'أحد الوالدين'], guardian: ['the legal guardian', 'الوصي القانوني'],
  spouse: ['the spouse', 'الزوج أو الزوجة'], child: ['a son or daughter', 'الابن أو الابنة'], sibling: ['a brother or sister', 'الأخ أو الأخت'], other: ['another relative', 'قريب آخر'] };
export const STAGE = {
  received: [['Waiting for the office', 'بانتظار المكتب'], 'pending', 'warning'], review: [['Being prepared', 'قيد التحضير'], 'awaiting-signature', 'info'],
  signed: [['Signed · with the bishop', 'موقّعة · لدى المطران'], 'approved', 'info'], accepted: [['Accepted by the bishop', 'قبلها المطران'], 'approved', 'info'],
  ready: [['Released', 'سُلّمت'], 'issued', 'success'], collected: [['Collected', 'استُلمت'], 'closed', 'success'],
  declined: [['Declined', 'مرفوض'], 'rejected', 'danger'], cancelled: [['Cancelled', 'ملغى'], 'cancelled', 'danger']
};
const LINK_DELIVERY = {
  'not-configured': ['The tracking link was shown to them once; it was not sent (no delivery service is set up).', 'عُرض رابط المتابعة عليه مرة واحدة ولم يُرسل (لا خدمة إرسال مُعدّة).'],
  sending: ['The tracking link was handed to the delivery service, which has not confirmed it.', 'سُلّم رابط المتابعة إلى خدمة الإرسال التي لم تؤكّده.'],
  sent: ['The tracking link was sent to them.', 'أُرسل إليه رابط المتابعة.'],
  failed: ['Sending the tracking link failed; they saw it once on screen.', 'فشل إرسال رابط المتابعة؛ رآه مرة واحدة على الشاشة.'],
  console: ['Development server: the tracking link was printed in the console, not sent.', 'خادم تطوير: طُبع رابط المتابعة في النافذة ولم يُرسل.']
};

/* Rows for the Requests table. */
export const guestItems = () => D.GUEST_REQUESTS.map(r => {
  const [label, state] = STAGE[r.stage] || STAGE.received;
  const open = !['collected', 'declined', 'cancelled'].includes(r.stage) && !(r.stage === 'ready' && r.delivery === 'download' && r.files.length);
  return { category: 'guest', online: true, title: `${L(...GUEST_KIND[r.kind])} · ${r.subject.name}`, who: null, state, open, date: r.createdAt, priority: '',
    owner: r.stage === 'signed' ? L('Bishop', 'المطران') : r.stage === 'review' ? L('Priest', 'الكاهن') : L('Parish office', 'مكتب الرعية'),
    next: r.claim?.status === 'pending' ? L('Confirm the account link', 'تأكيد ربط الحساب') : r.stage === 'received' ? L('Find the person in the registers', 'ابحث عن الشخص في السجلات')
      : r.stage === 'ready' ? (r.delivery === 'download' ? (r.files.length ? L('Available to download', 'متاح للتنزيل') : L('Attach the signed scan', 'أرفق النسخة الموقّعة')) : L('Hand it over at the office', 'سلّمها في المكتب'))
      : L(...label), href: `#/requests/guest/${r.id}`, ref: r.reference };
});

async function act(body, done) {
  const result = await parishAPI('guest-requests', 'POST', body);
  await hydrate(); toast(done, '', 'success'); bus.refresh();
  return result;
}

export function openGuestRequest(id) {
  const r = D.GUEST_REQUESTS.find(x => x.id === id);
  if (!r) return toast(L('Request not found', 'الطلب غير موجود'), '', 'warning');
  const s = r.subject, q = r.requester, [label, , tone] = STAGE[r.stage] || STAGE.received;
  const minor = s.birthDate && (Date.now() - new Date(s.birthDate)) / 31557600000 < 18;
  const people = [...D.PEOPLE, ...D.ARCHIVED].sort((a, b) => (a.lat || '').localeCompare(b.lat || ''));
  const cert = r.certificateId && D.SACRAMENTS.find(x => x.id === r.certificateId);
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  openDrawer({
    title: `${L(...GUEST_KIND[r.kind])} · ${r.reference}`, sub: `${pill(L(...label), tone)}`,
    body: `<div class="stack" style="gap:16px">
      <p class="dim">${L('Asked for without a ParishLife account. They follow it with a private tracking link.', 'طُلبت دون حساب ParishLife. ويتابعها صاحبها برابط متابعة خاص.')}</p>
      <dl class="dl">${row(L('About', 'عن'), s.name)}${row(L('Born', 'الولادة'), s.birthDate)}${row(L('Father', 'الأب'), s.father)}${row(L('Mother', 'الأم'), s.mother)}
        ${row(L('Sacrament date or year', 'تاريخ السرّ أو سنته'), s.when)}${row(L('Purpose', 'الغاية'), r.purpose)}
        ${row(L('Asked by', 'طلبها'), `${q.name} (${L(...(RELATION[q.relationship] || RELATION.other))})`)}
        ${q.phone ? `<dt>${L('Phone', 'الهاتف')}</dt><dd><bdi dir="ltr">${esc(q.phone)}</bdi></dd>` : ''}${q.email ? `<dt>${L('Email', 'البريد الإلكتروني')}</dt><dd><bdi dir="ltr">${esc(q.email)}</bdi></dd>` : ''}
        ${row(L('Receives it by', 'يستلمها عبر'), r.delivery === 'download' ? L('Download from the tracking link', 'التنزيل من رابط المتابعة') : L('Collecting it at the parish office', 'الاستلام من مكتب الرعية'))}
        ${row(L('Submitted', 'التقديم'), fmtDate(r.createdAt))}</dl>
      <p class="t-caption dim">${esc(L(...(LINK_DELIVERY[r.linkDelivery] || LINK_DELIVERY['not-configured'])))}</p>
      ${minor ? `<div class="alert alert-info">${icon('info', 18)}<span>${L('This document is about a child. It is asked for by a parent or guardian; hand it only to them, with the usual identity check.', 'هذه الوثيقة عن طفل، ويطلبها أحد الوالدين أو الوصي؛ لا تُسلَّم إلا له، بعد التحقّق المعتاد من الهوية.')}</span></div>` : ''}
      ${r.claim?.status === 'pending' ? `<div class="alert alert-warning">${icon('people', 18)}<span><b>${esc(L(`${r.claim.name} asks to link this request to their account`, `يطلب ${r.claim.name} ربط هذا الطلب بحسابه`))}</b>
        ${L('They hold its private tracking link. Link it only if you are satisfied it is theirs.', 'يملك رابط المتابعة الخاص به. لا تربطه إلا إذا تأكّدت أنه له.')}
        <span class="row" style="gap:8px;margin-top:8px"><button class="btn btn-primary btn-dense" type="button" data-gclaim="approve">${L('Link it', 'ربطه')}</button>
        <button class="btn btn-ghost btn-dense" type="button" data-gclaim="decline">${L('Do not link', 'عدم الربط')}</button></span></span></div>` : ''}
      ${r.status === 'submitted' ? `<form id="gaccept" class="stack" novalidate><div class="ac-group" style="padding-inline:0">${L('Find the person in your registers', 'ابحث عن الشخص في سجلّاتك')}</div>
        <div class="formrow"><label class="label" for="g-person">${L('Person record', 'سجلّ الشخص')}</label><select class="select" id="g-person"><option value="">${L('Choose…', 'اختر…')}</option>
          ${people.map(p => `<option value="${esc(p.id)}">${esc(p.lat)}${p.born ? ' · ' + esc(p.born) : ''}</option>`).join('')}</select></div>
        <div class="formrow"><label class="label" for="g-source">${L('Register entry (optional)', 'القيد (اختياري)')}</label><select class="select" id="g-source"><option value="">${L('Link it later', 'اربطه لاحقاً')}</option></select></div>
        <div><button class="btn btn-primary" type="submit">${L('Start the certificate', 'ابدأ الشهادة')}</button></div></form>
        <form id="gdecline" class="stack" novalidate><label class="label" for="g-note">${L('Or decline, and tell them why', 'أو ارفض واذكر السبب')}</label>
          <textarea class="input" id="g-note" rows="2" maxlength="500" placeholder="${esc(L('For example: no entry under this name in our registers.', 'مثلاً: لا قيد بهذا الاسم في سجلاتنا.'))}"></textarea>
          <div><button class="btn btn-danger-quiet" type="submit">${L('Decline', 'رفض')}</button></div></form>` : ''}
      ${cert ? `<a class="btn btn-secondary" href="#/certificate/${esc(cert.id)}">${icon('doc', 16)}${L('Open the certificate record', 'فتح سجلّ الشهادة')} · ${esc(cert.reg)}</a>` : ''}
      ${r.status === 'accepted' && r.delivery === 'download' ? `<div class="ac-group" style="padding-inline:0">${L('Signed document for download', 'الوثيقة الموقّعة للتنزيل')}</div>
        <p class="t-caption dim">${L('Attach the signed scan (PDF, JPG or PNG). They can download it from their tracking link only once the certificate is released.', 'أرفق النسخة الموقّعة (PDF أو JPG أو PNG). لا يمكنه تنزيلها من رابط المتابعة إلا بعد تسليم الشهادة.')}</p>
        <div class="filelist" data-files="guest" data-upload-scope="guest-request" data-upload-owner="${esc(r.id)}"></div>
        <label class="btn btn-secondary" style="align-self:flex-start">${icon('plus', 16)}${L('Attach a file', 'إرفاق ملف')}<input type="file" data-pick="guest" accept=".pdf,.jpg,.jpeg,.png" hidden></label>` : ''}
      ${r.status === 'accepted' && r.stage === 'ready' && r.delivery === 'collect' ? `<button class="btn btn-primary" type="button" data-gcollected>${L('Mark as collected', 'تعليم كمُستلَمة')}</button>` : ''}
      ${r.response ? `<p><b>${L('Message to them', 'الرسالة إليه')}</b><br>${esc(r.response)}</p>` : ''}
      <p class="si-error" id="g-error" role="alert" hidden></p></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>`,
    onMount(el) {
      C.wire(el);
      const fail = e => { const box = el.querySelector('#g-error'); box.textContent = e.message; box.hidden = false; };
      const person = el.querySelector('#g-person'), source = el.querySelector('#g-source');
      person?.addEventListener('change', () => {
        const entries = D.SACRAMENTS.filter(x => x.person === person.value && x.kind === r.kind && ['registered', 'issued'].includes(x.status));
        source.innerHTML = `<option value="">${L('Link it later', 'اربطه لاحقاً')}</option>` + entries.map(x => `<option value="${esc(x.id)}">${esc(x.reg)} · ${esc(fmtDate(x.date))}</option>`).join('');
        if (entries.length === 1) source.value = entries[0].id;
      });
      el.querySelector('#gaccept')?.addEventListener('submit', async e => {
        e.preventDefault();
        if (!person.value) return fail(new Error(L('Choose the person’s record.', 'اختر سجلّ الشخص.')));
        try { const res = await act({ op: 'accept', id, personId: person.value, sourceRecordId: source.value || null }, L('Certificate started', 'بدأت الشهادة'));
          closeOverlays(); location.hash = `#/certificate/${res.certificateId}`; } catch (err) { fail(err); }
      });
      el.querySelector('#gdecline')?.addEventListener('submit', async e => {
        e.preventDefault();
        try { await act({ op: 'decline', id, note: el.querySelector('#g-note').value }, L('Request declined', 'رُفض الطلب')); closeOverlays(); } catch (err) { fail(err); }
      });
      el.querySelector('[data-gcollected]')?.addEventListener('click', async () => {
        try { await act({ op: 'collected', id }, L('Marked as collected', 'عُلّمت كمُستلَمة')); closeOverlays(); } catch (err) { fail(err); }
      });
      el.querySelectorAll('[data-gclaim]').forEach(b => b.addEventListener('click', async () => {
        try { await act({ op: b.dataset.gclaim === 'approve' ? 'approveClaim' : 'declineClaim', id }, b.dataset.gclaim === 'approve' ? L('Linked to their account', 'رُبط بحسابه') : L('Not linked', 'لم يُربط')); closeOverlays(); }
        catch (err) { fail(err); }
      }));
    }
  });
}
