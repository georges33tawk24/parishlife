/* A ministry's applications, guest inquiries and (for the parish priest only) requests to leave.
   The leader approves an application first and the priest last; the priest may also approve
   straight away. The server checks every decision again. */
import * as D from '../data.js';
import { parishAPI } from '../api.js';
import { hydrate } from '../persist.js';
import { t, fmtDate } from '../i18n.js';
import { bus, S, me } from '../store.js';
import { panel, esc, pill, openModal, closeOverlays, toast } from '../ui.js';
import { icon } from '../icons.js';

const L = (en, ar) => t(en, ar);
const nameOf = id => { const p = D.person(id); return p ? L(p.lat, p.ar || p.lat) : ''; };
/* The open workspace's own role: only the parish priest sees requests to leave. */
const isPriest = () => S.role === 'priest';
const leadsGroup = g => !!g && [g.leader, g.assistant].includes(me()?.id);

async function decide(body, done) {
  await parishAPI('ministries', 'POST', body);
  await hydrate();
  closeOverlays(); toast(done, '', 'success'); bus.refresh();
}

/* A short note with each decision, optional. */
function noteDialog({ title, body, cta, danger = false, run }) {
  openModal({
    title, body: `<form id="mnote" class="stack" novalidate><p>${esc(body)}</p>
      <div class="formrow"><label class="label" for="mnote-text">${L('Note (optional)', 'ملاحظة (اختيارية)')}</label>
      <textarea class="input" id="mnote-text" rows="3" maxlength="500"></textarea></div><p class="si-error" id="mnote-error" role="alert" hidden></p></form>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" form="mnote" type="submit" style="margin-inline-start:auto">${esc(cta)}</button>`,
    onMount(el) {
      el.querySelector('#mnote').addEventListener('submit', async e => {
        e.preventDefault();
        try { await run(el.querySelector('#mnote-text').value); }
        catch (err) { const box = el.querySelector('#mnote-error'); box.textContent = err.message; box.hidden = false; }
      });
    }
  });
}

const STAGE = a => a.withdrawRequested ? pill(L('Asks to withdraw', 'يطلب السحب'), 'warning')
  : a.status === 'leader-approved' ? pill(L('Leader approved · waiting for the priest', 'وافق المسؤول · بانتظار الكاهن'), 'info', false)
  : pill(L('Waiting for the leader', 'بانتظار المسؤول'), 'warning');

export function ministryPanels(g) {
  const apps = D.MINISTRY_APPLICATIONS.filter(a => a.groupId === g.id && ['pending', 'leader-approved'].includes(a.status));
  const inquiries = D.MINISTRY_INQUIRIES.filter(i => i.groupId === g.id && i.status !== 'closed');
  const departures = isPriest() ? D.MINISTRY_DEPARTURES.filter(x => x.groupId === g.id && x.status === 'pending') : [];
  const leads = leadsGroup(g), priest = isPriest();
  const appRow = a => {
    const acts = [];
    if (a.withdrawRequested && (priest || leads)) acts.push(`<button class="btn btn-secondary btn-dense" data-mapp-withdraw="${esc(a.id)}">${L('Accept withdrawal', 'قبول السحب')}</button>
      <button class="btn btn-ghost btn-dense" data-mapp-keep="${esc(a.id)}">${L('Keep it open', 'إبقاؤه مفتوحاً')}</button>`);
    else if (priest) acts.push(`<button class="btn btn-ghost btn-dense" data-mapp-decline="${esc(a.id)}">${L('Decline', 'رفض')}</button>
      <button class="btn btn-primary btn-dense" data-mapp-approve="${esc(a.id)}">${a.status === 'pending' ? L('Approve now', 'موافقة الآن') : L('Approve', 'موافقة')}</button>`);
    else if (leads && a.status === 'pending') acts.push(`<button class="btn btn-ghost btn-dense" data-mapp-decline="${esc(a.id)}">${L('Decline', 'رفض')}</button>
      <button class="btn btn-primary btn-dense" data-mapp-approve="${esc(a.id)}">${L('Approve and send to the priest', 'موافقة وإرسال إلى الكاهن')}</button>`);
    return `<li>${icon('people', 16, 'dimmer')}<span class="grow"><b>${esc(nameOf(a.personId) || a.account)}</b> ${STAGE(a)}
      <small>${esc(L(`Applied ${fmtDate(a.createdAt)}`, `قُدّم في ${fmtDate(a.createdAt)}`))}${a.leaderBy ? esc(L(` · approved by ${a.leaderBy}`, ` · وافق ${a.leaderBy}`)) : ''}</small>
      ${a.message ? `<small>“${esc(a.message)}”</small>` : ''}${a.withdrawNote ? `<small>${esc(L('Withdrawal note: ', 'ملاحظة السحب: ') + a.withdrawNote)}</small>` : ''}</span>
      <span class="acct-acts">${acts.join('')}</span></li>`;
  };
  const inquiryRow = i => `<li>${icon('mail', 16, 'dimmer')}<span class="grow"><b>${esc(i.name)}</b> ${i.status === 'new' ? pill(L('New', 'جديد'), 'warning') : pill(L('Answered', 'تمّ الرد'), 'success')}
      <small><bdi dir="ltr">${esc([i.phone, i.email].filter(Boolean).join(' · '))}</bdi> · ${esc(fmtDate(i.createdAt))}</small>
      ${i.message ? `<small>“${esc(i.message)}”</small>` : ''}${i.note ? `<small>${esc(L('Note: ', 'ملاحظة: ') + i.note)}</small>` : ''}</span>
      <span class="acct-acts">${i.status === 'new' ? `<button class="btn btn-secondary btn-dense" data-minq="${esc(i.id)}:answered">${L('Mark answered', 'تمّ الرد')}</button>` : ''}
        <button class="btn btn-ghost btn-dense" data-minq="${esc(i.id)}:closed">${L('Close', 'إغلاق')}</button></span></li>`;
  const departureRow = x => `<li>${icon('lock', 16, 'dimmer')}<span class="grow"><b>${esc(nameOf(x.personId))}</b>
      <small>${esc(L(`Asked ${fmtDate(x.createdAt)}`, `طُلب في ${fmtDate(x.createdAt)}`))}</small>
      ${x.reason ? `<small>${esc(L('Reason: ', 'السبب: ') + x.reason)}</small>` : `<small class="dim">${L('No reason given.', 'لم يُذكر سبب.')}</small>`}</span>
      <span class="acct-acts"><button class="btn btn-ghost btn-dense" data-mdep-decline="${esc(x.id)}">${L('Talk first', 'التحدث أولاً')}</button>
        <button class="btn btn-primary btn-dense" data-mdep-approve="${esc(x.id)}">${L('End membership', 'إنهاء العضوية')}</button></span></li>`;
  return [
    panel(L('Applications', 'طلبات الانضمام'), (apps.length ? `<ul class="admin-list" data-paginate>${apps.map(appRow).join('')}</ul>`
      : `<p class="dim">${L('No application is waiting.', 'لا طلب بانتظار القرار.')}</p>`) +
      `<p class="t-caption dim" style="margin-top:10px">${L('The ministry’s leader approves first, then the parish priest. The priest may approve without waiting.',
        'يوافق مسؤول الخدمة أولاً ثم كاهن الرعية. ويمكن للكاهن الموافقة دون انتظار.')}</p>`),
    inquiries.length ? panel(L('Guests who are interested', 'ضيوف مهتمّون'), `<ul class="admin-list" data-paginate>${inquiries.map(inquiryRow).join('')}</ul>
      <p class="t-caption dim" style="margin-top:10px">${L('Sent from the public parish page. A message makes nobody a member.', 'أُرسلت من صفحة الرعية العامة. الرسالة لا تجعل أحداً عضواً.')}</p>`) : '',
    priest ? panel(L('Requests to leave', 'طلبات المغادرة'), (departures.length ? `<ul class="admin-list" data-paginate>${departures.map(departureRow).join('')}</ul>`
      : `<p class="dim">${L('No request to leave.', 'لا طلب مغادرة.')}</p>`) +
      `<p class="t-caption dim" style="margin-top:10px">${icon('lock', 13)} ${L('Only the parish’s priests see these requests and their reasons. The leader sees only that the roster changed.',
        'لا يرى هذه الطلبات وأسبابها إلا كهنة الرعية. ولا يرى المسؤول إلا تغيّر اللائحة.')}</p>`) : ''
  ].join('');
}

export function wireMinistryPanels(host) {
  const app = id => D.MINISTRY_APPLICATIONS.find(a => a.id === id);
  const fail = e => toast(L('Not done', 'لم يتمّ'), e.message, 'danger');
  host.querySelectorAll('[data-mapp-approve]').forEach(b => b.addEventListener('click', () => {
    const a = app(b.dataset.mappApprove), priest = isPriest();
    noteDialog({ title: priest ? L('Approve this application?', 'الموافقة على هذا الطلب؟') : L('Approve and send to the priest?', 'الموافقة والإرسال إلى الكاهن؟'),
      body: priest ? L(`${nameOf(a.personId)} joins the ministry and is told so.`, `ينضمّ ${nameOf(a.personId)} إلى الخدمة ويُبلَّغ بذلك.`)
        : L('The parish priest makes the final decision.', 'القرار الأخير لكاهن الرعية.'),
      cta: L('Approve', 'موافقة'), run: note => decide({ op: 'applicationDecide', id: a.id, approve: true, note },
        priest ? L('Welcome sent; they are on the roster', 'أُرسل الترحيب وأُضيف إلى اللائحة') : L('Sent to the parish priest', 'أُرسل إلى كاهن الرعية')) });
  }));
  host.querySelectorAll('[data-mapp-decline]').forEach(b => b.addEventListener('click', () => noteDialog({
    title: L('Decline this application?', 'رفض هذا الطلب؟'), body: L('They are told it was not accepted, with your note if you write one.', 'يُبلَّغ بأنه لم يُقبل، مع ملاحظتك إن كتبتها.'),
    cta: L('Decline', 'رفض'), danger: true, run: note => decide({ op: 'applicationDecide', id: b.dataset.mappDecline, approve: false, note }, L('Application declined', 'رُفض الطلب')) })));
  host.querySelectorAll('[data-mapp-withdraw]').forEach(b => b.addEventListener('click', () =>
    decide({ op: 'withdrawalDecide', id: b.dataset.mappWithdraw, accept: true }, L('Application withdrawn', 'سُحب الطلب')).catch(fail)));
  host.querySelectorAll('[data-mapp-keep]').forEach(b => b.addEventListener('click', () => noteDialog({
    title: L('Keep the application open?', 'إبقاء الطلب مفتوحاً؟'), body: L('Tell them why, so they know what happens next.', 'أخبره بالسبب ليعرف ما سيحدث.'),
    cta: L('Keep it open', 'إبقاؤه مفتوحاً'), run: note => decide({ op: 'withdrawalDecide', id: b.dataset.mappKeep, accept: false, note }, L('Application kept open', 'بقي الطلب مفتوحاً')) })));
  host.querySelectorAll('[data-minq]').forEach(b => b.addEventListener('click', () => {
    const [id, status] = b.dataset.minq.split(':');
    decide({ op: 'inquiryUpdate', id, status }, status === 'closed' ? L('Message closed', 'أُغلقت الرسالة') : L('Marked answered', 'عُلّمت كمُجابة')).catch(fail);
  }));
  host.querySelectorAll('[data-mdep-approve]').forEach(b => b.addEventListener('click', () => noteDialog({
    title: L('End this membership?', 'إنهاء هذه العضوية؟'),
    body: L('They leave the roster; their membership and attendance stay in the ministry’s history. They, the parish priests and the bishop are told the membership ended — never the reason.',
      'يُزال من اللائحة، ويبقى تاريخ عضويته وحضوره محفوظاً. ويُبلَّغ هو وكهنة الرعية والمطران بانتهاء العضوية — دون السبب أبداً.'),
    cta: L('End membership', 'إنهاء العضوية'), danger: true, run: note => decide({ op: 'departureDecide', id: b.dataset.mdepApprove, approve: true, note }, L('Membership ended', 'انتهت العضوية')) })));
  host.querySelectorAll('[data-mdep-decline]').forEach(b => b.addEventListener('click', () => noteDialog({
    title: L('Talk with them first?', 'التحدث معه أولاً؟'), body: L('The request is closed and they stay in the ministry. Your note is sent to them.', 'يُغلق الطلب ويبقى في الخدمة. وتُرسل إليه ملاحظتك.'),
    cta: L('Send', 'إرسال'), run: note => decide({ op: 'departureDecide', id: b.dataset.mdepDecline, approve: false, note }, L('They have been told', 'أُبلغ')) })));
}

/* Office-managed join requests (people who may have no account): the leader's approval sends them on to the priest. */
export function joinRequestStage(r) {
  return r.leaderApproved ? pill(L('Leader approved · waiting for the priest', 'وافق المسؤول · بانتظار الكاهن'), 'info', false) : '';
}
export const canApproveJoin = (g, r) => isPriest() || (leadsGroup(g) && !r.leaderApproved);
export const isLeaderStage = g => !isPriest() && leadsGroup(g);
