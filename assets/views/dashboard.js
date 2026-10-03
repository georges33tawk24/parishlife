/* Dashboard — one per role. The priest lands on what needs a signature, the
   treasurer on what is open in the safe, the volunteer on the door. */
import { t, isAr, num, usd, fmtLong, fmtDate } from '../i18n.js';
import { S, role, me, is, bus } from '../store.js';
import { session } from '../api.js';
import { M, loadMember } from '../member-data.js';
import { icon, pageHead, sectionH, stat, panel, who, status, amount, pill, esc, table, empty } from '../ui.js';
import { PARISH, TODAY, RATE, EVENTS, SACRAMENTS, RESERVATIONS, BATCH, EXPENSES, FUNDS, PEOPLE, HOUSEHOLDS, PORTAL_REQUESTS,
         GROUPS, GROUP_DETAIL, ROTA, AUDIT, NOTICES, anniversaryItems, CHECKIN, person, venue, group, resStatus, resClash } from '../data.js';

const greet = () => {
  const p = me(), name = isAr() ? p.ar.split(' ')[0] : p.lat.split(' ')[0];
  return t(`Good evening, ${name}`, `مساء الخير يا ${name}`);
};
const sundayLine = () => `${esc(fmtLong(new Date()))} · ${esc(t(PARISH.name, PARISH.nameAr))}`;

const todayEvents = () => EVENTS.filter(e => e.d === new Date().toISOString().slice(0, 10)).sort((a, b) => a.t.localeCompare(b.t));
const awaitingSig = () => SACRAMENTS.filter(s => s.status === 'awaiting-signature' &&
  (s.kind !== 'certificate' || SACRAMENTS.some(source => source.id === s.sourceRecordId &&
    source.person === s.person && ['registered','issued'].includes(source.status))));
const pendingRes  = () => RESERVATIONS.filter(r => r.status === 'pending');
/* "2 baptisms, 1 marriage" from whatever is waiting, in both languages */
const kinds = list => { const m = new Map(); list.forEach(s => m.set(s.kind, [(m.get(s.kind)?.[0] || 0) + 1, s.kindAr]));
  return [...m].map(([k, [n, ar]]) => t(`${n} ${k}${n > 1 ? 's' : ''}`, `${n} ${ar}`)).join(t(', ', '، ')); };
const clashNote = () => { const n = pendingRes().filter(resClash).length;
  return n ? `<span class="down">${t(n === 1 ? '1 has a clash' : `${n} have a clash`, n === 1 ? 'واحد فيه تعارض' : `${n} فيها تعارض`)}</span>` : t('no clashes', 'بلا تعارض'); };

/* ---------- shared blocks ---------- */
function todayPanel() {
  const rows = todayEvents().map(e => `<a class="listrow" href="#/calendar">
      <span class="mono dim" style="width:46px;flex:none">${e.t}</span>
      <span class="grow"><b>${esc(t(e.title, e.titleAr))}</b>
        <small>${esc(t(venue(e.venue)?.name || '', venue(e.venue)?.ar || ''))}</small></span>
      ${e.kind === 'pending' ? status('pending') : ''}
    </a>`).join('');
  return panel(t(`Today at ${PARISH.name}`, `اليوم في ${PARISH.nameAr}`), rows,
    { more: `<a href="#/calendar">${t('Whole week', 'الأسبوع كلّه')}</a>`, tight: true });
}

function activityPanel(limit = 5) {
  const rows = AUDIT.slice(0, limit).map(a => {
    const p = person(a.who);
    return `<div class="tl-item ${a.kind === 'error' || a.kind === 'sensitive' ? 'accent' : ''}">
      <div class="when">${esc(a.at?.slice(11) || '')} · ${esc(a.actorName || (p ? (isAr() ? p.ar : p.lat) : 'System'))}</div>
      <div class="what">${esc(t(a.what, a.whatAr))}</div></div>`;
  }).join('');
  return panel(t('Recent activity', 'النشاط الأخير'), `<div class="timeline">${rows}</div>`,
    { more: is('priest') ? `<a href="#/audit">${t('Audit trail', 'سجل التدقيق')}</a>` : '' });
}

function rotaGaps() {
  const gaps = ROTA.teams.flatMap((tm,ti) => tm.filled
    .map((f,si) => ({ tm, f, at:`${ti}|${si}` }))
    .filter(x => x.f.s === 'open' || x.f.s === 'declined'));
  if (!gaps.length) return panel(t('This Sunday’s rota', 'مناوبة هذا الأحد'),
    empty('check', t('Every place is filled', 'كل المراكز مملوءة'), t('No substitutes needed.', 'لا حاجة إلى بدلاء.')));
  const rows = gaps.map(({ tm, f, at }) => `<div class="listrow">
      <span class="grow"><b>${esc(t(tm.team, tm.teamAr))}</b>
        <small>${f.s === 'declined'
          ? t(`${person(f.p).lat} declined`, `${person(f.p).ar} اعتذر`)
          : t('No one assigned', 'لا أحد مُسند')}</small></span>
      ${status(f.s === 'declined' ? 'declined' : 'unfilled')}
      <button class="btn btn-secondary btn-dense" data-act="rota-fill:${at}">
        ${t('Find substitute', 'ابحث عن بديل')}</button>
    </div>`).join('');
  return panel(t('This Sunday’s rota needs people', 'مناوبة هذا الأحد تحتاج أشخاصاً'), rows,
    { more: `<a href="#/volunteers">${t('Open rota', 'فتح المناوبات')}</a>`, tight: true });
}

/* ---------- role dashboards ---------- */
function priest() {
  const sigRows = awaitingSig().map(s => {
    const p = person(s.person);
    return `<a class="listrow sigrow" href="#/certificate/${s.id}">
      ${who(p)}
      <span class="grow"><b>${esc(t(s.kind[0].toUpperCase() + s.kind.slice(1), s.kindAr))}</b>
        <small class="mono">${s.reg}</small></span>
      ${status('awaiting-signature')}${icon('chevR', 16, 'dimmer')}</a>`;
  }).join('');

  const resRows = pendingRes().map(r => `<a class="listrow" href="#/reservations">
      <span class="grow"><b>${esc(t(r.title, r.titleAr))}</b>
        <small>${esc(t(venue(r.venue)?.name || '', venue(r.venue)?.ar || ''))} · ${fmtDate(r.date)} · ${r.from}–${r.to}</small></span>
      ${status(resStatus(r))}</a>`).join('');

  const annRows = anniversaryItems().slice(0, 6).map(a => `<div class="listrow">
      <span class="grow"><b>${esc(isAr() ? a.ar : a.couple)}</b>
        <small>${t(`${a.kind} · ${a.years} years · ${fmtDate(a.on)}`, `${a.kind} · ${a.years} سنة · ${fmtDate(a.on)}`)}</small></span>
      <span class="pill">${a.years}</span></div>`).join('');

  return `
    ${pageHead({
      crumbs: [{ label: t('Home', 'الرئيسية') }, { label: t('Dashboard', 'لوحة القيادة') }],
      title: greet(), sub: sundayLine(),
      actions: `<button class="btn btn-secondary" data-act="print-week">${icon('print', 17)}${t('Print my week', 'اطبع أسبوعي')}</button>
        <button class="btn btn-primary" data-act="record-new">${icon('plus', 17)}${t('New record', 'سجل جديد')}</button>`
    })}
    <div class="stats">
      ${stat(t('Parishioners', 'المؤمنون'), num(PEOPLE.length), t(`${HOUSEHOLDS.length} households`, `${HOUSEHOLDS.length} عائلة`))}
      ${stat(t('Awaiting your signature', 'بانتظار توقيعك'), awaitingSig().length, awaitingSig().length ? kinds(awaitingSig()) : t('nothing to sign', 'لا شيء للتوقيع'))}
      ${stat(t('Reservations to decide', 'حجوزات بانتظار القرار'), pendingRes().length, clashNote())}
      ${stat(t('Sunday collection', 'تقدمة الأحد'), usd(BATCH.lines.reduce((a, l) => a + (l.usd || 0), 0)), BATCH.status === 'closed' ? t('session closed', 'الجلسة مقفلة') : t('session still open', 'الجلسة ما زالت مفتوحة'))}
    </div>
    <div class="grid g2">
      ${panel(t('Awaiting your signature', 'بانتظار توقيعك'), sigRows,
        { more: `<a href="#/sacraments">${t('All sacraments', 'كل الأسرار')}</a>`, tight: true })}
      ${todayPanel()}
      ${panel(t('Reservations to decide', 'حجوزات بانتظار قرارك'), resRows,
        { more: `<a href="#/reservations">${t('All reservations', 'كل الحجوزات')}</a>`, tight: true })}
      ${panel(t('Sacramental anniversaries', 'ذكريات الأسرار'), annRows,
        { more: `<a href="#/sacraments/anniversaries">${t('All', 'الكل')}</a>`, tight: true })}
      ${rotaGaps()}
      ${activityPanel(4)}
    </div>`;
}

function secretary() {
  const certs = SACRAMENTS.filter(s => s.kind === 'certificate' && s.status !== 'issued');
  const rows = certs.map(s => {
    const p = person(s.person);
    return `<a class="listrow" href="#/certificate/${esc(s.id)}">${who(p)}
      <span class="grow"><b>${esc(t(s.kind[0].toUpperCase() + s.kind.slice(1), s.kindAr))}</b>
      <small class="mono">${s.reg}</small></span>${!s.sourceRecordId&&!['rejected','cancelled'].includes(s.status)
        ?pill(t('Waiting for official entry','بانتظار قيد رسمي'),'warning'):status(s.status)}</a>`;
  }).join('');
  const noticeRows = NOTICES.map(n => `<a class="listrow" href="#/notices">
      <span class="grow"><b>${esc(t(n.title, n.ar))}</b><small>${fmtDate(n.at)} · ${esc(t(n.audience, n.audienceAr))}</small></span>
      ${n.pri === 'urgent' ? status('conflict') : ''}</a>`).join('');

  return `
    ${pageHead({
      crumbs: [{ label: t('Home', 'الرئيسية') }, { label: t('Dashboard', 'لوحة القيادة') }],
      title: greet(),
      sub: t(`${certs.length} certificate requests · ${PORTAL_REQUESTS.length} requests from the portal`, `${certs.length} طلبات شهادات · ${PORTAL_REQUESTS.length} طلبات من البوّابة`),
      actions: `<button class="btn btn-secondary" data-act="export">${icon('export', 17)}${t('Export', 'تصدير')}</button>
        <button class="btn btn-primary" data-go="people">${icon('plus', 17)}${t('New parishioner', 'مؤمن جديد')}</button>`
    })}
    <div class="stats">
      ${stat(t('Parishioners', 'المؤمنون'), num(PEOPLE.length), t('updated today', 'حُدّثت اليوم'))}
      ${stat(t('Households', 'العائلات'), num(HOUSEHOLDS.length), (n => n ? t(`${n} need an address`, `${n} بحاجة إلى عنوان`) : t('every one has an address', 'لكلٍّ عنوان'))(HOUSEHOLDS.filter(h => !h.address).length))}
      ${stat(t('Certificate requests', 'طلبات الشهادات'), certs.length, t(`${awaitingSig().length} waiting on the priest`, `${awaitingSig().length} بانتظار الكاهن`))}
      ${stat(t('Portal requests', 'طلبات البوّابة'), PORTAL_REQUESTS.length, PORTAL_REQUESTS.length ? t('to review', 'للمراجعة') : t('nothing waiting', 'لا شيء بالانتظار'))}
    </div>
    <div class="grid g2">
      ${panel(t('Requests in your queue', 'طلبات في صندوقك'), rows, { tight: true })}
      ${todayPanel()}
      ${panel(t('Notices', 'الإعلانات'), noticeRows, { more: `<a href="#/notices">${t('All notices', 'كل الإعلانات')}</a>`, tight: true })}
      ${activityPanel(4)}
    </div>`;
}

function treasurer() {
  const total = BATCH.lines.reduce((a, l) => a + (l.usd || 0), 0);
  const liraOnly = BATCH.lines.reduce((a, l) => a + (l.lbp || 0), 0);
  const pendingX = EXPENSES.filter(x => x.status === 'awaiting-approval');
  const fundRows = FUNDS.map(f => {
    const pct = Math.min(100, Math.round(f.actual / f.budget * 100));
    return `<div class="listrow" style="align-items:flex-start">
      <span class="grow"><b>${esc(t(f.name, f.ar))}</b>
        <small dir="ltr" style="text-align:start">${usd(f.actual)} ${t('of', 'من')} ${usd(f.budget)} · ${pct}%</small>
        <span class="meter" style="margin-top:8px"><i style="width:${pct}%"></i></span></span>
      ${f.restricted ? pill(t('Restricted', 'مقيّد'), 'info', 'lock') : ''}</div>`;
  }).join('');
  const xRows = pendingX.map(x => `<div class="listrow">
      <span class="grow"><b>${esc(t(x.what, x.whatAr))}</b><small>${fmtDate(x.d)}</small></span>
      ${amount(x.usd, { cls: 'amount-sm' })}${status(x.status)}</div>`).join('');

  return `
    ${pageHead({
      crumbs: [{ label: t('Home', 'الرئيسية') }, { label: t('Giving overview', 'نظرة على التقدمات') }],
      title: t('Giving overview', 'نظرة على التقدمات'),
      sub: `${esc(t(BATCH.ref, BATCH.refAr))} · ${status(BATCH.status)} · ${t('rate set', 'ضُبط السعر')} ${fmtDate(RATE.setOn)}`,
      actions: `<button class="btn btn-secondary" data-go="finance">${icon('fin', 17)}${t('Finance', 'المالية')}</button>
        <button class="btn btn-primary" data-go="giving">${icon('plus', 17)}${t('Open counting session', 'فتح جلسة عدّ')}</button>`
    })}
    <div class="stats">
      ${stat(t('Counted so far', 'المعدود حتى الآن'), usd(total), `L.L ${num(total * RATE.value)}`)}
      ${stat(t('Lira envelopes', 'مظاريف بالليرة'), `L.L ${num(liraOnly)}`, t('kept as lira, not converted', 'تبقى ليرة، بلا تحويل'))}
      ${stat(t('Expenses awaiting you', 'مصاريف بانتظارك'), pendingX.length, usd(pendingX.reduce((a, x) => a + x.usd, 0)))}
      ${stat(t('Parish rate', 'سعر الرعية'), num(RATE.value), t(`set ${fmtDate(RATE.setOn)}`, `ضُبط ${fmtDate(RATE.setOn)}`))}
    </div>
    <div class="grid g2">
      ${panel(t('Counting session 214', 'جلسة العدّ ٢١٤'), `
          <div class="row" style="gap:24px;flex-wrap:wrap">
            <div>${amount(total, { showRate: true, cls: 'amount-lg' })}</div>
            <div style="margin-inline-start:auto;display:flex;gap:8px">
              <button class="btn btn-secondary" data-go="giving">${t('Add envelope', 'إضافة مظروف')}</button>
              <button class="btn btn-primary" data-go="giving">${t('Close session', 'إقفال الجلسة')}</button>
            </div>
          </div>
          <p class="t-caption dim" style="margin-top:14px">${t(
            'Two counters signed in: Nabil Saade and Joseph Sfeir. A session cannot be closed by the person who opened it alone.',
            'عدّادان مسجّلان: نبيل سعادة وجوزيف صفير. لا يُقفل الجلسة من فتحها وحده.')}</p>`)}
      ${panel(t('Budget against actual', 'الموازنة مقابل الفعلي'), fundRows,
        { more: `<a href="#/finance">${t('Finance', 'المالية')}</a>`, tight: true })}
      ${panel(t('Expenses awaiting approval', 'مصاريف بانتظار الموافقة'), xRows, { tight: true })}
      ${activityPanel(4)}
    </div>`;
}

function leader() {
  const mine = GROUPS.filter(g => g.leader === me().id || g.assistant === me().id);
  const meetings = mine.flatMap(g => GROUP_DETAIL[g.id]?.meetings || []);
  const upcoming = mine.flatMap(g => (GROUP_DETAIL[g.id]?.meetings || []).filter(m => !m.done && m.d >= new Date().toISOString().slice(0,10)).map(m => ({g,m})))
    .sort((a,b) => (a.m.d+a.m.t).localeCompare(b.m.d+b.m.t));
  const recorded = meetings.reduce((count,meeting)=>count+Object.keys(meeting.attendance||{}).length,0);
  const cards = mine.map(g => `<a class="panel card-link" href="#/groups/${g.id}" style="display:block">
      <div class="panel-b">
        <div class="row" style="gap:10px">
          <span class="avatar">${icon('groups', 17)}</span>
          <span><b style="display:block;font:600 15px/22px var(--sans)">${esc(t(g.name, g.ar))}</b>
          <small class="dim t-caption">${esc(t(g.meets, g.meetsAr))}</small></span>
          <span class="badge badge-quiet" style="margin-inline-start:auto">${g.members}</span>
        </div>
      </div></a>`).join('');
  return `
    ${pageHead({
      crumbs: [{ label: t('My ministry', 'خدمتي') }, { label: t('Dashboard', 'لوحة القيادة') }],
      title: t('My groups', 'مجموعاتي'),
      sub: t(`${mine.reduce((a, g) => a + g.members, 0)} members · ${upcoming.length} upcoming meetings`, `${mine.reduce((a, g) => a + g.members, 0)} عضواً · ${upcoming.length} اجتماعات قادمة`),
      actions: `<button class="btn btn-secondary" data-go="messaging">${icon('msg', 17)}${t('Message my group', 'مراسلة مجموعتي')}</button>
        <a class="btn btn-primary" href="#/groups${mine[0]?`/${esc(mine[0].id)}/attendance`:''}">${icon('attend', 17)}${t('Group attendance', 'حضور المجموعة')}</a>`
    })}
    <div class="stats">
      ${mine.slice(0, 2).map(g => stat(t(g.name, g.ar), g.members, g.meets ? t(g.meets, g.meetsAr) : t('no fixed meeting', 'بلا اجتماع ثابت'))).join('')}
      ${stat(t('Upcoming meetings', 'الاجتماعات القادمة'), upcoming.length, t('in my groups', 'في مجموعاتي'))}
      ${stat(t('Recorded group attendance', 'حضور المجموعات المسجّل'), recorded, `${meetings.length} ${t('meetings','اجتماعات')}`)}
      ${stat(t('Complaints received','الشكاوى الواردة'),M.loadedFor===`${session.user?.id}:${session.parishId}`?M.leaderConcerns.length:'…',`<a href="#/memberhub">${t('View group complaints','عرض شكاوى المجموعة')}</a>`)}
    </div>
    ${sectionH(t('My groups', 'مجموعاتي'))}
    <div class="gridcards">${cards}</div>
    <div class="grid g2">${panel(t('Next ministry meetings','اجتماعات الخدمة القادمة'),upcoming.slice(0,5).map(({g,m})=>
      `<a class="listrow" href="#/groups/${esc(g.id)}/meetings"><span class="grow"><b>${esc(m.title||t('Ministry meeting','اجتماع الخدمة'))}</b>
      <small>${esc(t(g.name,g.ar))} · ${fmtDate(m.d)} ${esc(m.t)}</small></span>${icon('chevR',16)}</a>`).join('')||
      `<p class="t-caption dim">${t('No meetings scheduled yet.','لا اجتماعات مجدولة بعد.')}</p>`)}${todayPanel()}</div>
    <p class="t-caption dim" style="margin-top:20px">${t(
      'A ministry leader sees only the people in the groups they lead. The parish list, giving and other groups are not in the rail at all.',
      'مسؤول الخدمة يرى فقط أفراد مجموعاته. لائحة الرعية والتقدمات والمجموعات الأخرى ليست في الشريط إطلاقاً.')}</p>`;
}

export function dashboard() {
  if (is('priest')) return priest();
  if (is('secretary')) return secretary();
  if (is('treasurer')) return treasurer();
  if (is('leader')) return leader();
  return '';
}
dashboard.mount = host => {
  if(is('leader')&&M.loadedFor!==`${session.user?.id}:${session.parishId}`)
    loadMember().then(()=>{if(S.route==='dashboard')bus.refresh();}).catch(()=>{});
};
