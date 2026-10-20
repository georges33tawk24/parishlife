/* My parishes: one home across every parish the account follows or belongs to, with a selector
   for one parish, and the connections themselves — follow, ask to become a member, choose the
   primary parish. Following shows public news only; membership is decided by the parish office. */
import { api, session } from '../api.js';
import { t, isAr, fmtDate, matches } from '../i18n.js';
import { bus } from '../store.js';
import { pageHead, panel, esc, pill, openModal, closeOverlays, toast } from '../ui.js';
import { icon } from '../icons.js';

const L = (en, ar) => t(en, ar);
const state = { data: null, loading: false, error: '', parish: '', find: '' };
const storage = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

async function load() {
  if (state.loading) return;
  state.loading = true;
  try { state.data = await api('connections'); state.error = ''; }
  catch (e) { state.error = e.message; }
  finally { state.loading = false; bus.refresh(); }
}
export const reloadHome = () => { state.data = null; };

/* After a change the session is read again, so the workspace switcher and roles follow. */
async function act(body, done = '') {
  const result = await api('connections', 'POST', body);
  state.data = await api('connections');
  await bus.reloadSession?.();
  if (done) toast(done, '', 'success');
  bus.refresh();
  return result;
}

const nameOf = p => L(p.name || p.parishName, p.ar || p.parishAr || p.name || p.parishName);
function relation(p) {
  if (p.role && !['member', 'follower'].includes(p.role)) return pill(L(p.roleTitle?.[0] || p.role, p.roleTitle?.[1] || p.role), 'info', false);
  if (p.kind === 'member') return pill(L('Member', 'عضو'), 'success');
  if (p.request) return pill(L('Membership requested', 'طُلب الانتساب'), 'warning');
  if (p.kind === 'follow') return pill(L('Following', 'متابَعة'), '', false);
  return '';
}

export function home() {
  if (!state.data && !state.loading && !state.error) load();
  const head = pageHead({ title: L('My parishes', 'رعاياي'),
    sub: L('News and services from the parishes you follow or belong to. Following shows public news; membership is approved by the parish office.',
      'أخبار وخدمات الرعايا التي تتابعها أو تنتمي إليها. المتابعة تُظهر الأخبار العامة؛ والانتساب يوافق عليه مكتب الرعية.') });
  if (state.error) return head + `<div class="alert alert-danger" role="alert">${icon('warn', 18)}<span>${esc(state.error)}</span></div>`;
  if (!state.data) return head + `<p class="dim">${L('Loading your parishes…', 'جارٍ تحميل رعاياك…')}</p>`;
  const d = state.data, connected = d.parishes;
  const followed = connected.filter(p => p.kind);
  if (state.parish && !followed.some(p => p.id === state.parish)) state.parish = '';
  return head + prompts(d) + (followed.length ? feed(d, followed) : '') +
    panel(L('Your parishes', 'رعاياك'), connected.length ? connections(connected) : `<p class="dim">${L('You are not connected to a parish yet. Find yours below and follow it, or ask to become a member.',
      'لست مرتبطاً برعية بعد. ابحث عن رعيتك أدناه وتابعها أو اطلب الانتساب إليها.')}</p>`) +
    panel(L('Find a parish', 'ابحث عن رعية'), finder(d)) + history(d);
}

/* Skippable prompts: complete the profile, and connect to the parish a public page sent the person from. */
function prompts(d) {
  const out = [], uid = session.user?.id;
  if (storage.get('pl-profile-later:' + uid) !== '1' && !storage.get('pl-profile-done:' + uid)) {
    out.push(`<div class="alert alert-info home-prompt">${icon('people', 18)}<span><b>${L('Complete your profile', 'أكمل ملفك')}</b>
      ${L('Add the details a parish office usually asks for. You can do it now or later; nothing is required.', 'أضف المعلومات التي يطلبها مكتب الرعية عادةً. يمكنك ذلك الآن أو لاحقاً؛ لا شيء إلزامي.')}
      <span class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><a class="btn btn-primary btn-dense" href="#/account/profile">${L('Complete now', 'أكمل الآن')}</a>
      <button class="btn btn-secondary btn-dense" type="button" data-home-later>${L('Later', 'لاحقاً')}</button></span></span></div>`);
  }
  const hint = storage.get('pl-parish-hint');
  const hinted = hint && d.directory.find(p => p.id === hint);
  if (hinted && !d.parishes.some(p => p.id === hint)) {
    out.push(`<div class="alert alert-info home-prompt">${icon('portal', 18)}<span><b>${esc(L(`Connect with ${hinted.name}`, `ارتبط بـ${hinted.ar || hinted.name}`))}</b>
      ${L('You came from this parish’s page. Follow it to see its news, or ask to become a member to send requests.', 'جئت من صفحة هذه الرعية. تابعها لترى أخبارها، أو اطلب الانتساب لترسل الطلبات.')}
      <span class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-dense" type="button" data-home-follow="${esc(hint)}">${L('Follow', 'متابعة')}</button>
        <button class="btn btn-secondary btn-dense" type="button" data-home-join="${esc(hint)}">${L('Ask to become a member', 'اطلب الانتساب')}</button>
        <button class="btn btn-ghost btn-dense" type="button" data-home-hint-off>${L('Not now', 'ليس الآن')}</button></span></span></div>`);
  }
  return out.join('');
}

function feed(d, followed) {
  const pick = state.parish, names = Object.fromEntries(d.directory.map(p => [p.id, p]));
  const events = d.feed.events.filter(e => !pick || e.parish === pick).slice(0, 10);
  const posts = d.feed.posts.filter(e => !pick || e.parish === pick).slice(0, 10);
  const tag = id => followed.length > 1 && !pick ? `<small class="dim">${esc(nameOf(names[id] || { name: id }))}</small>` : '';
  return `<div class="home-selector" role="group" aria-label="${L('Show news from', 'عرض الأخبار من')}">
      <button type="button" class="chip-toggle" data-home-parish="" aria-pressed="${!pick}">${L('All my parishes', 'كل رعاياي')}</button>
      ${followed.map(p => `<button type="button" class="chip-toggle" data-home-parish="${esc(p.id)}" aria-pressed="${pick === p.id}">${p.primary ? icon('check', 14) : ''}${esc(nameOf(p))}</button>`).join('')}
    </div>
    <div class="grid g2 home-feed">
      ${panel(L('Coming up', 'القادم'), events.length ? `<ul class="admin-list">${events.map(e => `<li>${icon(e.kind === 'mass' ? 'chalice' : 'events', 16, 'dimmer')}
        <span><b>${esc(L(e.title, e.titleAr || e.title))}</b><small>${esc(fmtDate(e.d))}${e.t ? ' · ' + esc(e.t) : ''}</small>${tag(e.parish)}</span></li>`).join('')}</ul>`
        : `<p class="dim">${L('Nothing published for the coming days.', 'لا شيء منشور للأيام القادمة.')}</p>`)}
      ${panel(L('News', 'الأخبار'), posts.length ? `<ul class="admin-list">${posts.map(p => `<li>${icon('bell', 16, 'dimmer')}
        <span><b>${esc(p.title)}</b><small>${esc(fmtDate(p.at))}</small>${tag(p.parish)}${p.body ? `<small class="home-post">${esc(String(p.body).slice(0, 220))}</small>` : ''}</span></li>`).join('')}</ul>`
        : `<p class="dim">${L('No news yet.', 'لا أخبار بعد.')}</p>`)}
    </div>`;
}

function connections(list) {
  return `<ul class="admin-list home-parishes">${list.map(p => {
    const open = p.role && p.role !== 'follower';
    return `<li>${icon('portal', 18, 'dimmer')}<span class="grow"><b>${esc(nameOf(p))}</b> ${relation(p)} ${p.primary ? pill(L('Primary', 'الرئيسية'), 'success', 'check') : ''}
        <small>${esc(L(p.town, p.townAr || p.town))}</small></span>
      <span class="acct-acts">
        ${open ? `<button class="btn btn-secondary btn-dense" type="button" data-home-open="${esc(p.id)}">${L('Open', 'فتح')}</button>` : ''}
        ${p.kind && !p.primary ? `<button class="btn btn-ghost btn-dense" type="button" data-home-primary="${esc(p.id)}">${L('Make primary', 'اجعلها الرئيسية')}</button>` : ''}
        ${p.kind === 'follow' && !p.request ? `<button class="btn btn-secondary btn-dense" type="button" data-home-join="${esc(p.id)}">${L('Ask to become a member', 'اطلب الانتساب')}</button>` : ''}
        ${p.request ? `<button class="btn btn-ghost btn-dense" type="button" data-home-withdraw="${esc(p.id)}:${esc(p.request.id)}">${L('Withdraw request', 'سحب الطلب')}</button>` : ''}
        ${p.kind === 'follow' && !p.request ? `<button class="btn btn-ghost btn-dense" type="button" data-home-unfollow="${esc(p.id)}">${L('Stop following', 'إيقاف المتابعة')}</button>` : ''}
      </span></li>`;
  }).join('')}</ul>`;
}

function finder(d) {
  const mine = new Set(d.parishes.map(p => p.id));
  const found = d.directory.filter(p => !mine.has(p.id) && (!state.find || matches(`${p.name} ${p.ar} ${p.town} ${p.townAr}`, state.find)))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), isAr() ? 'ar' : 'en'));
  return `<div class="toolbar" style="margin-bottom:12px"><div class="grow" style="max-width:360px"><div class="search">${icon('search', 17)}
      <input class="input" type="search" id="home-find" value="${esc(state.find)}" placeholder="${esc(L('Parish name or town', 'اسم الرعية أو البلدة'))}" aria-label="${esc(L('Find a parish', 'ابحث عن رعية'))}"></div></div>
      <a class="btn btn-ghost" href="./#directory">${L('Open the parish directory', 'فتح دليل الرعايا')}${icon('ext', 15)}</a></div>
    ${found.length ? `<ul class="admin-list" id="home-found">${found.slice(0, 10).map(p => `<li>${icon('portal', 16, 'dimmer')}<span class="grow"><b>${esc(nameOf(p))}</b><small>${esc(L(p.town, p.townAr || p.town))}</small></span>
      <span class="acct-acts"><button class="btn btn-secondary btn-dense" type="button" data-home-follow="${esc(p.id)}">${L('Follow', 'متابعة')}</button>
        <button class="btn btn-ghost btn-dense" type="button" data-home-join="${esc(p.id)}">${L('Ask to become a member', 'اطلب الانتساب')}</button></span></li>`).join('')}</ul>
      ${found.length > 10 ? `<p class="dim" style="margin-top:8px">${esc(L(`${found.length - 10} more — type part of a name or town to narrow the list.`, `${found.length - 10} أخرى — اكتب جزءاً من اسم أو بلدة لتضييق اللائحة.`))}</p>` : ''}`
      : `<p class="dim">${L('No other parish matches.', 'لا رعية أخرى مطابقة.')}</p>`}`;
}

function history(d) {
  const done = d.requests.filter(r => r.status !== 'pending');
  if (!done.length) return '';
  const words = { approved: [L('Approved', 'مقبول'), 'success'], declined: [L('Not accepted', 'غير مقبول'), 'danger'], withdrawn: [L('Withdrawn', 'مسحوب'), ''] };
  return panel(L('Your membership requests', 'طلبات انتسابك'), `<ul class="admin-list">${done.slice(0, 10).map(r => `<li>${icon('doc', 16, 'dimmer')}
    <span><b>${esc(L(r.parishName, r.parishAr || r.parishName))}</b> ${pill(...(words[r.status] || [r.status, '']))}
      <small>${esc(fmtDate(r.createdAt))}${r.decidedAt ? ' → ' + esc(fmtDate(r.decidedAt)) : ''}</small>
      ${r.note ? `<small>${esc(L('Office note: ', 'ملاحظة المكتب: ') + r.note)}</small>` : ''}</span></li>`).join('')}</ul>`);
}

/* What a membership request shares with the office, said before it is sent. */
function joinDialog(pid) {
  const p = state.data.directory.find(x => x.id === pid);
  openModal({
    title: L(`Ask to become a member of ${p?.name || 'this parish'}`, `طلب الانتساب إلى ${p?.ar || p?.name || 'هذه الرعية'}`),
    body: `<form id="joinform" class="stack" novalidate>
      <p>${L('Your request goes to the parish office. They link it to your record in the parish, or create one, and then you can use the member portal there.',
        'يصل طلبك إلى مكتب الرعية، فيربطه بسجلّك فيها أو ينشئ واحداً، وبعدها تستعمل بوابة الأعضاء هناك.')}</p>
      <p class="dim">${L('The office will see your name, date of birth, email addresses and phone numbers (and whether each is verified), and the profile details you filled in.',
        'سيرى المكتب اسمك وتاريخ ولادتك وبريدك الإلكتروني وأرقام هاتفك (وهل تمّ التحقّق من كلّ منها)، وتفاصيل الملف التي أدخلتها.')}
        <a href="#/account/profile">${L('Review your profile', 'راجع ملفك')}</a></p>
      <div class="formrow"><label class="label" for="join-msg">${L('Message to the office (optional)', 'رسالة إلى المكتب (اختيارية)')}</label>
        <textarea class="input" id="join-msg" rows="3" maxlength="500" placeholder="${esc(L('For example: my family is registered under my father’s name.', 'مثلاً: عائلتي مسجّلة باسم والدي.'))}"></textarea></div>
      <p class="si-error" id="join-error" role="alert" hidden></p></form>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" form="joinform" type="submit" style="margin-inline-start:auto">${L('Send request', 'إرسال الطلب')}</button>`,
    onMount(el) {
      el.querySelector('#joinform').addEventListener('submit', async e => {
        e.preventDefault();
        try {
          await act({ op: 'requestMembership', parish: pid, message: el.querySelector('#join-msg').value }, L('Request sent to the parish office', 'أُرسل الطلب إلى مكتب الرعية'));
          closeOverlays();
        } catch (err) { const box = el.querySelector('#join-error'); box.textContent = err.message; box.hidden = false; }
      });
    }
  });
}

home.mount = host => {
  const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(L('Not done', 'لم يتمّ'), e.message, 'danger'); } };
  const uid = session.user?.id;
  host.querySelector('[data-home-later]')?.addEventListener('click', () => { storage.set('pl-profile-later:' + uid, '1'); bus.refresh(); });
  host.querySelector('[data-home-hint-off]')?.addEventListener('click', () => { storage.set('pl-parish-hint', ''); bus.refresh(); });
  host.querySelectorAll('[data-home-parish]').forEach(b => b.addEventListener('click', () => { state.parish = b.dataset.homeParish; bus.refresh(); }));
  host.querySelectorAll('[data-home-follow]').forEach(b => b.addEventListener('click', guard(async () => {
    await act({ op: 'follow', parish: b.dataset.homeFollow }, L('Following', 'تتابع الرعية الآن'));
  })));
  host.querySelectorAll('[data-home-join]').forEach(b => b.addEventListener('click', () => joinDialog(b.dataset.homeJoin)));
  host.querySelectorAll('[data-home-primary]').forEach(b => b.addEventListener('click', guard(async () => {
    await act({ op: 'setPrimary', parish: b.dataset.homePrimary }, L('Primary parish saved', 'حُفظت الرعية الرئيسية'));
  })));
  host.querySelectorAll('[data-home-withdraw]').forEach(b => b.addEventListener('click', guard(async () => {
    const [parish, id] = b.dataset.homeWithdraw.split(':');
    await act({ op: 'withdrawRequest', parish, id }, L('Request withdrawn', 'سُحب الطلب'));
  })));
  host.querySelectorAll('[data-home-unfollow]').forEach(b => b.addEventListener('click', guard(async () => {
    await act({ op: 'unfollow', parish: b.dataset.homeUnfollow }, L('No longer following', 'لم تعد تتابع'));
  })));
  host.querySelectorAll('[data-home-open]').forEach(b => b.addEventListener('click', () => bus.switchParish?.(b.dataset.homeOpen)));
  const find = host.querySelector('#home-find');
  find?.addEventListener('input', () => {
    state.find = find.value;
    const at = find.selectionStart;
    bus.refresh();
    const again = document.getElementById('home-find');
    again?.focus(); again?.setSelectionRange(at, at);
  });
};
