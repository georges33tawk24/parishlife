/* The parish office's side of parish connections: membership requests from accounts (link to an
   existing person record, create one, or decline), and invitations that let someone the office
   already records create or link an account. The server decides; these screens ask it. */
import * as D from '../data.js';
import { api, parishAPI } from '../api.js';
import { hydrate } from '../persist.js';
import { t, fmtDate } from '../i18n.js';
import { bus } from '../store.js';
import { esc, pill, openDrawer, openModal, closeOverlays, toast, empty } from '../ui.js';
import { icon } from '../icons.js';

const L = (en, ar) => t(en, ar);
let config = null;
const loadConfig = async () => (config ||= await api('auth/config').catch(() => null));

export const pendingMembership = () => D.MEMBERSHIP_REQUESTS.filter(r => r.status === 'pending');
const fullName = prof => `${prof.firstName || ''} ${prof.lastName || ''}`.trim();
const digits = s => String(s || '').replace(/\D/g, '').slice(-8);

/* Records that may be the same person: a shared phone number or email address weighs most, then the
   date of birth and the name. The office decides; nothing is linked automatically. */
function candidates(r) {
  const prof = r.profile, phones = prof.contacts.filter(k => k.kind === 'phone').map(k => digits(k.value)).filter(Boolean);
  const emails = prof.contacts.filter(k => k.kind === 'email').map(k => k.value.toLowerCase());
  const first = (prof.firstName || '').toLowerCase(), last = (prof.lastName || '').toLowerCase();
  return D.PEOPLE.map(p => {
    const why = [];
    if (phones.length && phones.includes(digits(p.phone))) why.push(L('same phone number', 'رقم الهاتف نفسه'));
    const email = (p.email || D.PERSON_EXTRA[p.id]?.email || '').toLowerCase();
    if (email && emails.includes(email)) why.push(L('same email address', 'البريد الإلكتروني نفسه'));
    if (prof.birthDate && p.born === prof.birthDate) why.push(L('same date of birth', 'تاريخ الولادة نفسه'));
    const name = (p.lat || '').toLowerCase();
    if (first && last && name.includes(first) && name.includes(last)) why.push(L('same name', 'الاسم نفسه'));
    return { p, why, score: why.length + (why.length && phones.includes(digits(p.phone)) ? 2 : 0) };
  }).filter(x => x.score > 0 && !D.ACCOUNTS[x.p.id]).sort((a, b) => b.score - a.score).slice(0, 6);
}

const contactLine = k => `<li>${icon(k.kind === 'email' ? 'mail' : 'phone', 15, 'dimmer')}<span><bdi dir="ltr">${esc(k.value)}</bdi>
  ${k.verified ? pill(L('Verified', 'مُتحقَّق منه'), 'success') : pill(L('Not verified', 'غير مُتحقَّق منه'), 'warning')}</span></li>`;

/* People → Account requests */
export function membershipRequests() {
  const open = pendingMembership(), done = D.MEMBERSHIP_REQUESTS.filter(r => r.status !== 'pending');
  if (!open.length && !done.length) return `<div style="margin-top:20px">${empty('people', L('No account requests', 'لا طلبات حسابات'),
    L('When someone with a ParishLife account asks to become a member, the request appears here for you to link to their record.',
      'عندما يطلب صاحب حساب في ParishLife الانتساب، يظهر طلبه هنا لتربطه بسجلّه.'))}</div>`;
  const words = { approved: [L('Approved', 'مقبول'), 'success'], declined: [L('Not accepted', 'غير مقبول'), 'danger'], withdrawn: [L('Withdrawn by them', 'سحبه صاحبه'), ''] };
  const row = r => `<li>${icon('people', 18, 'dimmer')}<span class="grow"><b>${esc(fullName(r.profile) || r.account.name)}</b>
      ${r.status === 'pending' ? (r.invited ? pill(L('Invited by the office', 'بدعوة من المكتب'), 'info', false) : pill(L('Waiting for you', 'بانتظارك'), 'warning')) : pill(...(words[r.status] || [r.status, '']))}
      <small>${esc(L(`Asked ${fmtDate(r.createdAt)}`, `طُلب في ${fmtDate(r.createdAt)}`))}${r.profile.birthDate ? ' · ' + esc(L('born ', 'مواليد ') + r.profile.birthDate) : ''}</small>
      ${r.message ? `<small>“${esc(r.message)}”</small>` : ''}</span>
    <span class="acct-acts">${r.status === 'pending' ? `<button class="btn btn-primary btn-dense" type="button" data-mreq="${esc(r.id)}">${L('Review', 'مراجعة')}</button>` : ''}</span></li>`;
  return `<div class="stack" style="margin-top:20px;gap:16px">
    <section class="panel"><div class="panel-h"><h3>${L('Waiting for review', 'بانتظار المراجعة')}</h3></div><div class="panel-b">
      ${open.length ? `<ul class="admin-list" data-paginate>${open.map(row).join('')}</ul>` : `<p class="dim">${L('Nothing is waiting.', 'لا شيء بانتظارك.')}</p>`}</div></section>
    ${done.length ? `<section class="panel"><div class="panel-h"><h3>${L('Decided in the last 60 days', 'ما بُتّ فيه خلال آخر ٦٠ يوماً')}</h3></div><div class="panel-b">
      <ul class="admin-list" data-paginate>${done.map(row).join('')}</ul></div></section>` : ''}</div>`;
}

async function decide(body, done) {
  const result = await parishAPI('connections', 'POST', body);
  await hydrate();
  closeOverlays(); toast(done, '', 'success'); bus.refresh();
  return result;
}

export function reviewMembership(id) {
  const r = D.MEMBERSHIP_REQUESTS.find(x => x.id === id);
  if (!r) return;
  const prof = r.profile, x = prof.details || {}, invited = r.personId && D.PEOPLE.find(p => p.id === r.personId);
  const list = candidates(r).filter(c => c.p.id !== r.personId);
  const detail = (label, value) => value ? `<dt>${label}</dt><dd>${esc(value)}</dd>` : '';
  openDrawer({
    title: L('Membership request', 'طلب انتساب'), sub: esc(fullName(prof) || r.account.name),
    body: `<div class="stack" style="gap:16px">
      <p class="dim">${L('Link this account to the person’s record in your parish, or create a record from what they entered. Nothing in your records changes until you choose.',
        'اربط هذا الحساب بسجلّ الشخص في رعيتك، أو أنشئ سجلاً ممّا أدخله. لا يتغيّر شيء في سجلّاتك قبل أن تختار.')}</p>
      <dl class="dl">${detail(L('Name', 'الاسم'), fullName(prof))}${detail(L('Name in Arabic', 'الاسم بالعربية'), x.arabicName)}
        ${detail(L('Date of birth', 'تاريخ الولادة'), prof.birthDate)}${detail(L('Town', 'البلدة'), x.town)}${detail(L('Address', 'العنوان'), x.address)}
        ${detail(L('Rite', 'الطقس'), x.rite)}${detail(L('Line of work', 'المهنة'), x.occupation)}
        ${detail(L('Account', 'الحساب'), r.account.username)}</dl>
      <ul class="admin-list">${prof.contacts.map(contactLine).join('')}</ul>
      ${r.message ? `<div class="alert alert-info">${icon('msg', 18)}<span><b>${L('Their message', 'رسالته')}</b>${esc(r.message)}</span></div>` : ''}
      ${invited ? `<div class="ac-group" style="padding-inline:0">${L('They accepted your invitation for', 'قبل دعوتك الموجّهة إلى')}</div>
        <ul class="admin-list"><li>${icon('people', 16, 'dimmer')}<span class="grow"><b>${esc(invited.lat)}</b><small>${esc(invited.born || '')}</small></span>
          <span class="acct-acts"><button class="btn btn-primary btn-dense" type="button" data-link="${esc(invited.id)}">${L('Link to this record', 'اربط بهذا السجل')}</button></span></li></ul>` : ''}
      <div class="ac-group" style="padding-inline:0">${L('Possible matches in your records', 'تطابقات محتملة في سجلّاتك')}</div>
      ${list.length ? `<ul class="admin-list">${list.map(c => `<li>${icon('people', 16, 'dimmer')}<span class="grow"><b>${esc(c.p.lat)}</b>
          <small>${esc(c.why.join(' · '))}</small></span>
          <span class="acct-acts"><a class="btn btn-ghost btn-dense" href="#/person/${esc(c.p.id)}" target="_blank" rel="noopener">${L('Open', 'فتح')}</a>
          <button class="btn btn-secondary btn-dense" type="button" data-link="${esc(c.p.id)}">${L('Link to this record', 'اربط بهذا السجل')}</button></span></li>`).join('')}</ul>`
        : `<p class="dim">${L('No record shares their phone number, email address, date of birth or name.', 'لا سجلّ يشاركه رقم الهاتف أو البريد أو تاريخ الولادة أو الاسم.')}</p>`}
      <button class="btn btn-secondary" type="button" data-create>${icon('plus', 16)}${L('Create a new person record from these details', 'أنشئ سجلاً جديداً من هذه المعلومات')}</button>
      <div class="divider"></div>
      <form id="mdecline" class="stack" novalidate><label class="label" for="mdecline-note">${L('Or decline, and tell them why', 'أو ارفض واذكر السبب')}</label>
        <textarea class="input" id="mdecline-note" rows="2" maxlength="500" placeholder="${esc(L('For example: please visit the office with your baptism certificate.', 'مثلاً: يُرجى زيارة المكتب مع شهادة العماد.'))}"></textarea>
        <div><button class="btn btn-danger-quiet" type="submit">${L('Decline', 'رفض')}</button></div>
        <p class="si-error" id="mreq-error" role="alert" hidden></p></form></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>`,
    onMount(el) {
      const fail = e => { const box = el.querySelector('#mreq-error'); box.textContent = e.message; box.hidden = false; };
      el.querySelectorAll('[data-link]').forEach(b => b.addEventListener('click', () => decide({ op: 'approveMembership', id, personId: b.dataset.link },
        L('Account linked. They are now a member.', 'رُبط الحساب. أصبح عضواً الآن.')).catch(fail)));
      el.querySelector('[data-create]').addEventListener('click', () => decide({ op: 'approveMembership', id, create: true },
        L('Record created and account linked', 'أُنشئ السجل ورُبط الحساب')).catch(fail));
      el.querySelector('#mdecline').addEventListener('submit', e => {
        e.preventDefault();
        decide({ op: 'declineMembership', id, note: el.querySelector('#mdecline-note').value }, L('Request declined', 'رُفض الطلب')).catch(fail);
      });
    }
  });
}

/* ---------- invitations ---------- */
const INVITE_WORDS = {
  'link-only': () => L('Link created. ParishLife did not send it: copy it and share it yourself.', 'أُنشئ الرابط. لم يرسله ParishLife: انسخه وشاركه بنفسك.'),
  'not-configured': ch => L(`Not sent: ${ch === 'email' ? 'email' : 'text message'} delivery is not set up on this server. Copy the link and share it yourself.`,
    `لم يُرسل: خدمة ${ch === 'email' ? 'البريد الإلكتروني' : 'الرسائل النصية'} غير مفعّلة على هذا الخادم. انسخ الرابط وشاركه بنفسك.`),
  sending: () => L('Handed to the delivery service, which has not confirmed it.', 'سُلّم إلى خدمة الإرسال التي لم تؤكّده.'),
  sent: () => L('Sent.', 'أُرسل.'),
  failed: () => L('Could not be sent. Copy the link and share it yourself, or try again.', 'تعذّر الإرسال. انسخ الرابط وشاركه بنفسك، أو حاول مجدداً.'),
  console: () => L('Development server: printed in the server console, not sent.', 'خادم تطوير: طُبع في نافذة الخادم ولم يُرسل.')
};
export const inviteWords = (delivery, channel) => (INVITE_WORDS[delivery] || (() => delivery))(channel);

export function invitationsFor(personId) {
  const list = D.INVITATIONS.filter(i => i.personId === personId);
  if (!list.length) return '';
  const now = new Date().toISOString();
  return `<div class="ac-group" style="padding-inline:0;margin-top:12px">${L('Invitations', 'الدعوات')}</div><ul class="admin-list">${list.slice(0, 5).map(i => {
    const state = i.accepted ? pill(L('Accepted', 'مقبولة'), 'success') : i.revoked ? pill(L('Withdrawn', 'مسحوبة'), '', false)
      : i.expiresAt < now ? pill(L('Expired', 'منتهية'), '', false) : pill(L('Open', 'مفتوحة'), 'info', false);
    const via = i.channel === 'link' ? L('Link to share', 'رابط للمشاركة') : `${i.channel === 'email' ? L('Email', 'بريد') : L('Text message', 'رسالة نصية')} · ${i.target}`;
    const open = !i.accepted && !i.revoked && i.expiresAt >= now;
    return `<li>${icon(i.channel === 'email' ? 'mail' : i.channel === 'sms' ? 'phone' : 'link', 15, 'dimmer')}<span class="grow"><b>${esc(via)}</b> ${state}
      <small>${esc(fmtDate(i.createdAt))} · ${esc(inviteWords(i.delivery, i.channel))}</small></span>
      ${open ? `<span class="acct-acts"><button class="btn btn-ghost btn-dense" type="button" data-revoke-invite="${esc(i.id)}">${L('Withdraw', 'سحب')}</button></span>` : ''}</li>`;
  }).join('')}</ul>`;
}

export async function inviteDialog(personId) {
  const p = D.PEOPLE.find(x => x.id === personId);
  if (!p) return;
  const cfg = await loadConfig();
  const mode = ch => cfg?.delivery?.[ch] || 'none';
  const email = p.email || D.PERSON_EXTRA[p.id]?.email || '', phone = p.phone && p.phone !== '—' ? p.phone : '';
  const way = (value, label, note) => `<label class="signin-way"><input type="radio" name="inv-channel" value="${value}" ${value === (email ? 'email' : phone ? 'sms' : 'link') ? 'checked' : ''}>
    <span><b>${label}</b><small class="dim">${note}</small></span></label>`;
  const unavailable = ch => mode(ch) === 'none' ? L('Not set up on this server: you will get a link to share yourself.', 'غير مُعدّ على هذا الخادم: ستحصل على رابط تشاركه بنفسك.')
    : mode(ch) === 'console' ? L('Development server: printed, not sent.', 'خادم تطوير: يُطبع ولا يُرسل.') : L('Sent by ParishLife.', 'يرسله ParishLife.');
  openModal({
    title: L(`Invite ${p.lat} to ParishLife`, `دعوة ${p.ar || p.lat} إلى ParishLife`),
    sub: L('They create an account (or sign in to theirs) and the link brings their request to you to confirm. Valid for 14 days.',
      'ينشئ حساباً (أو يدخل إلى حسابه) ويحمل الرابط طلبه إليك لتأكيده. صالح لمدة ١٤ يوماً.'),
    body: `<form id="invform" class="stack" novalidate>
      <fieldset class="signin-method"><legend class="label">${L('How to send it', 'طريقة الإرسال')}</legend><div class="invite-ways">
        ${way('email', L('Email', 'البريد الإلكتروني'), unavailable('email'))}
        ${way('sms', L('Text message', 'رسالة نصية'), unavailable('sms'))}
        ${way('link', L('A link I share myself', 'رابط أشاركه بنفسي'), L('Nothing is sent by ParishLife.', 'لا يرسل ParishLife شيئاً.'))}</div></fieldset>
      <div class="formrow" id="inv-target-row"><label class="label" for="inv-target">${L('Send to', 'أرسل إلى')}</label>
        <input class="input" id="inv-target" dir="ltr" maxlength="120" value="${esc(email || phone)}"></div>
      <div id="inv-result" hidden></div>
      <p class="si-error" id="inv-error" role="alert" hidden></p></form>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-primary" form="invform" type="submit" id="inv-send" style="margin-inline-start:auto">${L('Create invitation', 'إنشاء الدعوة')}</button>`,
    onMount(el) {
      const target = el.querySelector('#inv-target'), row = el.querySelector('#inv-target-row');
      const sync = () => {
        const ch = el.querySelector('input[name="inv-channel"]:checked').value;
        row.hidden = ch === 'link';
        target.value = ch === 'email' ? email : ch === 'sms' ? phone : '';
        target.type = ch === 'email' ? 'email' : 'tel';
      };
      el.querySelectorAll('input[name="inv-channel"]').forEach(r => r.addEventListener('change', sync)); sync();
      el.querySelector('#invform').addEventListener('submit', async e => {
        e.preventDefault();
        const channel = el.querySelector('input[name="inv-channel"]:checked').value, error = el.querySelector('#inv-error');
        error.hidden = true;
        try {
          const result = await parishAPI('connections', 'POST', { op: 'invite', personId, channel, target: target.value });
          await hydrate(); bus.refresh();
          const box = el.querySelector('#inv-result');
          box.hidden = false;
          box.innerHTML = `<div class="alert ${result.delivery === 'sent' ? 'alert-success' : 'alert-info'}">${icon(result.delivery === 'sent' ? 'check' : 'info', 18)}
            <span><b>${esc(inviteWords(result.delivery, channel))}</b>
            <span class="totp-key mono" dir="ltr" style="display:block">${esc(result.link)}</span>
            <button class="btn btn-secondary btn-dense" type="button" id="inv-copy">${L('Copy link', 'نسخ الرابط')}</button></span></div>`;
          box.querySelector('#inv-copy').addEventListener('click', () => navigator.clipboard?.writeText(result.link)
            .then(() => toast(L('Link copied', 'نُسخ الرابط'), '', 'success'), () => toast(L('Copy it by hand', 'انسخه يدوياً'), '', 'warning')));
          el.querySelector('#inv-send').hidden = true;
        } catch (err) { error.textContent = err.message; error.hidden = false; }
      });
    }
  });
}

/* Buttons rendered by the People screens. */
export function wireConnections(host) {
  host.querySelectorAll('[data-mreq]').forEach(b => b.addEventListener('click', () => reviewMembership(b.dataset.mreq)));
  host.querySelectorAll('[data-invite]').forEach(b => b.addEventListener('click', () => inviteDialog(b.dataset.invite)));
  host.querySelectorAll('[data-revoke-invite]').forEach(b => b.addEventListener('click', async () => {
    try { await decide({ op: 'revokeInvite', id: b.dataset.revokeInvite }, L('Invitation withdrawn', 'سُحبت الدعوة')); }
    catch (e) { toast(L('Not done', 'لم يتمّ'), e.message, 'danger'); }
  }));
}
