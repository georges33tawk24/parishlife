/* Modules 11, 13, 14 — communication centre, notices & bulletin, music, portal. */
import { t, isAr, num, fmtDate } from '../i18n.js';
import { is, S, bus } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, pill, esc, table, wireTables, empty, stat,
         searchField, openDrawer, openModal, closeOverlays, toast, tabBar, avatar } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import { MESSAGES, TEMPLATES, NOTICES, MUSIC, MUSIC_DETAIL, SETLISTS, AUTOMATIONS, PRAYERS,
         PARISH, EVENTS, PORTAL_REQUESTS, HOUSEHOLDS, musicInfo, person, venue } from '../data.js';

const L = (en, ar) => t(en, ar);
const CHANNEL = { whatsapp: ['WhatsApp', 'واتساب'], sms: ['SMS', 'رسالة قصيرة'], email: ['Email', 'بريد إلكتروني'] };
const MTABS = () => [['', 'Messages', 'الرسائل'], ['automations', 'Automations', 'الأتمتة', AUTOMATIONS.filter(a => a.active).length],
               ['templates', 'Designs', 'التصاميم'], ['preferences', 'Rules', 'القواعد']];

/* ═══════════ 11 · communication ═══════════ */
export function messaging(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Communicate', 'التواصل') }, { label: L('Messaging', 'المراسلة') }],
    title: L('Communication centre', 'مركز التواصل'),
    sub: L('One service for every module. In-app and email first, WhatsApp where the parish already uses it, SMS as the fallback.',
           'خدمة واحدة لكل الوحدات. داخل التطبيق والبريد أولاً، وواتساب حيث تستعمله الرعية، والرسالة القصيرة احتياطاً.'),
    actions: `${tab === 'templates' ? '' : `<button class="btn btn-secondary" data-go="messaging/templates">${icon('doc', 17)}${L('Ready-made designs', 'تصاميم جاهزة')}</button>`}
      ${C.splitBtn(L('New message', 'رسالة جديدة'), 'newmsg')}`
  }) + tabBar('messaging', MTABS(), tab);

  if (tab === 'automations') return head + `<div class="tabbody">${table({
      cols: [{ label: L('Automation', 'الأتمتة') }, { label: L('Runs', 'تعمل'), cls: 'hide-sm' },
             { label: L('Sent', 'أُرسلت'), cls: 'num' }, { label: L('Active', 'مفعّلة'), cls: 'shrink' }],
      rows: AUTOMATIONS.map((a, ai) => ({ cells: [
        `<b>${esc(L(a.what, a.whatAr))}</b>`, `<span class="dim">${esc(L(a.on, a.onAr))}</span>`,
        `<span class="num">${num(a.sent)}</span>`,
        `<label class="switch"><input type="checkbox" ${a.active ? 'checked' : ''} data-act="auto-toggle:${ai}"><span class="sr">${L('Active', 'مفعّل')}</span></label>`]}))
    })}
    ${C.inlineAlert('info', L('Birthdays only where consent was given', 'أعياد الميلاد بموافقة فقط'),
      L('A greeting is never sent to someone who has not agreed to it, and every automation stops at a human before anything sensitive is decided.',
        'لا تُرسَل تهنئة لمن لم يوافق، وكل أتمتة تتوقّف عند إنسان قبل أي قرار حسّاس.'))}
    <p class="t-caption dim" style="margin-top:14px">${L(
      'Repeated sends are prevented by the run history: a confirmation that has already gone out is not sent twice when a record is edited.',
      'يمنع سجل التنفيذ الإرسال المكرّر: التأكيد الذي أُرسل لا يُرسَل مرّتين عند تعديل السجل.')}</p></div>`;

  if (tab === 'templates') return head + `<div class="tabbody">
    <div class="gridcards">${TEMPLATES.map((tp, ti) => `<button class="panel" style="cursor:pointer;text-align:start;border:1px solid var(--border)" data-act="design:${ti}">
      <div style="height:110px;background:var(--ink);display:grid;place-items:center;color:var(--sand);
        font:600 14px/1 var(--sans);text-align:center;padding:10px">
        <span><span style="display:block;font-size:11px;opacity:.7;letter-spacing:.1em;text-transform:uppercase">${esc(L(PARISH.name, PARISH.nameAr))}</span>
        ${esc(L(tp.name, tp.ar))}</span></div>
      <div class="panel-b" style="padding:12px"><b style="font:500 13px/18px var(--sans)">${esc(L(tp.name, tp.ar))}</b>
        <small class="t-caption dim" style="display:block;margin-top:2px">${L('Fill the date and location', 'املأ التاريخ والمكان')}</small></div>
    </button>`).join('')}</div>
    <p class="t-caption dim" style="margin-top:16px">${L(
      'Each design already carries the parish name and logo. Fill in the date and location and download a finished announcement for printing or sharing.',
      'كل تصميم يحمل اسم الرعية وشعارها. املأ التاريخ والمكان ونزّل إعلاناً جاهزاً للطباعة أو المشاركة.')}</p></div>`;

  if (tab === 'preferences') return head + `<div style="margin-top:20px" class="grid g2">
    ${panel(L('Channel order', 'ترتيب القنوات'), `
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <span class="chip chip-on">${L('In-app', 'داخل التطبيق')}</span>${icon('arrowR', 16, 'dimmer')}
        <span class="chip chip-on">${L('Email', 'بريد')}</span>${icon('arrowR', 16, 'dimmer')}
        <span class="chip chip-on">WhatsApp</span>${icon('arrowR', 16, 'dimmer')}
        <span class="chip">SMS</span></div>
      <p class="t-caption dim" style="margin-top:14px">${L(
        'Each person’s own preference overrides the default order. A delivery failure retries once on the next channel down, then stops and reports.',
        'تفضيل كل شخص يتقدّم على الترتيب الافتراضي. وعند الفشل تُعاد المحاولة مرّة على القناة التالية ثم تتوقّف وتُبلّغ.')}</p>`)}
    ${panel(L('Quiet hours and urgency', 'ساعات الهدوء والإلحاح'), `
      <div class="stack" style="gap:12px">
        ${C.switchRow(L('Quiet hours 21:00 – 07:00', 'ساعات هدوء ٢١:٠٠ – ٠٧:٠٠'), { checked: true, pref: 'msg.quiet' })}
        ${C.switchRow(L('Urgent broadcasts ignore quiet hours', 'البثّ العاجل يتجاوز ساعات الهدوء'), { checked: true, pref: 'msg.urgent' })}
        ${C.switchRow(L('Parish-wide sends need approval', 'الإرسال العام يحتاج موافقة'), { checked: true, pref: 'msg.approval' })}</div>`)}
    ${panel(L('Safeguarding', 'الحماية'), `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px">
      ${[[L('No unrestricted adult-to-child private messaging', 'لا مراسلة خاصة غير مقيّدة بين بالغ وقاصر'), 'shield'],
         [L('Group discussions are moderated, with a named moderator', 'نقاشات المجموعات مُدارة بمشرف مسمّى'), 'groups'],
         [L('Messages to a minor copy their guardian', 'الرسائل إلى قاصر تُنسَخ إلى وليّ أمره'), 'family']]
        .map(([x, i]) => `<li class="row" style="gap:10px;align-items:flex-start">${icon(i, 17, 'dimmer')}<span class="t-caption">${esc(x)}</span></li>`).join('')}</ul>`)}
    ${panel(L('Opt-outs', 'طلبات الإيقاف'), `${stat(L('People who opted out', 'من أوقفوا الاستلام'), 7, L('respected on every send', 'يُحترم في كل إرسال'))}
      <p class="t-caption dim" style="margin-top:12px">${L('An opt-out is honoured even when a leader sends to a whole group.',
        'يُحترم طلب الإيقاف حتى حين يرسل مسؤول إلى مجموعة كاملة.')}</p>`)}
  </div>`;

  const rows = MESSAGES.map(m => ({ cells: [
    `<b style="font:500 14px/20px var(--sans)">${esc(L(m.subject, m.subjectAr))}</b>`,
    `<span class="dim">${esc(L(m.audience, m.audienceAr))}</span>`,
    `<span class="chip">${esc(L(...CHANNEL[m.channel]))}</span>`,
    `<span class="num dim">${num(m.reach)}</span>`,
    `<span class="dim mono" dir="ltr">${m.when}</span>`,
    status(m.status),
    `<span class="row" style="gap:6px;justify-content:flex-end">${m.status === 'failed' ? `<button class="btn btn-secondary btn-dense" data-fail="${m.id}">${L('See list', 'اللائحة')}</button>` : ''}${CR.recBtn('message', m.id)}</span>`
  ]}));
  const next = MESSAGES.filter(m => m.status === 'scheduled').sort((a, b) => a.when.localeCompare(b.when))[0];
  const failed = MESSAGES.filter(m => m.status === 'failed');

  return head + `<div class="stats" style="margin:20px 0 24px">
      ${stat(L('Sent this month', 'أُرسلت هذا الشهر'), MESSAGES.filter(m => m.status === 'sent').length,
        L(`across ${new Set(MESSAGES.filter(m => m.status === 'sent').map(m => m.channel)).size} channels`, `عبر ${new Set(MESSAGES.filter(m => m.status === 'sent').map(m => m.channel)).size} قنوات`))}
      ${stat(L('Scheduled', 'مجدولة'), MESSAGES.filter(m => m.status === 'scheduled').length, next ? L(`next: ${next.when}`, `التالية: ${next.when}`) : L('nothing scheduled', 'لا شيء مجدوَل'))}
      ${stat(L('Delivery failures', 'حالات فشل'), failed.length, failed.length ? `<span class="down">${L('retry them on SMS', 'أعد إرسالها عبر SMS')}</span>` : L('everything delivered', 'وصل كل شيء'))}
      ${stat(L('Opted out', 'أوقفوا الاستلام'), 7, L('respected on every send', 'يُحترم في كل إرسال'))}
    </div>
    ${table({
      cols: [{ label: L('Subject', 'الموضوع'), sort: true }, { label: L('Audience', 'الجمهور'), cls: 'hide-sm' },
             { label: L('Channel', 'القناة'), cls: 'shrink hide-sm' }, { label: L('Reach', 'العدد'), cls: 'num hide-md' },
             { label: L('When', 'الموعد'), cls: 'hide-md' }, { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows
    })}`;
}

messaging.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelectorAll('[data-fail]').forEach(b => b.addEventListener('click', () => {
    const m = MESSAGES.find(x => x.id === b.dataset.fail); if (!m) return;
    openDrawer({
      title: L(`“${m.subject}” did not reach everyone`, `«${m.subjectAr}» لم تصل إلى الجميع`),
      sub: L('These numbers are not reachable on that channel. SMS can be tried next.', 'هذه الأرقام غير متاحة على تلك القناة. ويمكن تجربة الرسالة القصيرة.'),
      body: ['p1', 'p13', 'p5', 'p7'].map(id => `<div class="listrow">${who(person(id))}
        <span class="grow"></span>${pill(L('Not reachable', 'غير متاح'), 'warning')}</div>`).join(''),
      foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
        <button class="btn btn-primary" data-act="msg-retry:${m.id}" style="margin-inline-start:auto">${L('Retry all on SMS', 'إعادة الكل عبر SMS')}</button>`
    });
  }));
  const compose = () => openDrawer({
    large: true,
    title: L('New message', 'رسالة جديدة'),
    sub: L('Recipients are filtered by what you are allowed to see.', 'يُرشَّح المستلمون بحسب ما يحقّ لك الاطّلاع عليه.'),
    body: `<div class="formrow"><label class="label">${L('Send to', 'إرسال إلى')}<span class="req">*</span></label>
        <select class="select"><option>${L('All households', 'كل العائلات')}</option>
          <option>${L('Saint Elias Choir', 'جوقة مار الياس')}</option>
          <option>${L('Catechism parents', 'أهالي التعليم المسيحي')}</option>
          <option>${L('Volunteers on this Sunday’s rota', 'متطوّعو مناوبة هذا الأحد')}</option>
          <option>${L('Participants in an event', 'المشتركون في حدث')}</option>
          <option>${L('One person', 'شخص واحد')}</option></select></div>
      <div class="formgrid">
        <div class="formrow"><label class="label">${L('Channel', 'القناة')}</label>
          <select class="select"><option>${L('Follow each person’s preference', 'اتّبع تفضيل كل شخص')}</option>
            <option>${L('In-app only', 'داخل التطبيق فقط')}</option><option>WhatsApp</option><option>SMS</option>
            <option>${L('Email', 'بريد إلكتروني')}</option></select></div>
        ${C.field({ label: L('When', 'الموعد'), type: 'datetime-local', value: '2026-10-12T15:00' })}
      </div>
      ${C.textarea({ label: L('Message — English', 'الرسالة — إنكليزي'), id: 'msgen', max: 480,
        ph: 'Parish lunch this Sunday after the 10:30 Mass.' })}
      ${C.textarea({ label: L('Message — Arabic', 'الرسالة — عربي'), id: 'msgar', max: 480, ar: true,
        ph: 'غداء الرعية هذا الأحد بعد قدّاس ١٠:٣٠.',
        help: L('Each person receives the version matching their recorded language.', 'يتلقّى كل شخص النسخة الموافقة للغته المسجّلة.') })}
      ${C.inlineAlert('info', L(`${HOUSEHOLDS.length} households, 7 opted out`, `${HOUSEHOLDS.length} عائلة، ٧ أوقفوا الاستلام`),
        L('A parish-wide send needs the priest to approve it before it leaves.', 'الإرسال العام يحتاج موافقة الكاهن قبل مغادرته.'))}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Save draft', 'حفظ كمسوّدة')}</button>
      <button class="btn btn-primary" data-act="msg-send" style="margin-inline-start:auto">${L('Request approval', 'طلب الموافقة')}</button>`,
    onMount(el) { C.wire(el); /* wired by data-act */ }
  });
  host.querySelector('[data-split="newmsg"]')?.addEventListener('click', compose);
  host.querySelector('[data-splitmenu="newmsg"]')?.addEventListener('click', () =>
    openModal({ title: L('Send', 'إرسال'), body: `<div class="menu" style="position:static;box-shadow:none;border:0;padding:0">
      <button data-act="compose-person">${icon('msg', 16)}${L('Message a person', 'مراسلة شخص')}</button>
      <button data-act="compose:group">${icon('groups', 16)}${L('Message a group', 'مراسلة مجموعة')}</button>
      <button data-act="broadcast">${icon('bell', 16)}${L('Emergency broadcast', 'بثّ طارئ')}</button></div>` }));
};

/* ═══════════ notices & bulletin ═══════════ */
export function notices() {
  const rows = NOTICES.map(n => `<div class="listrow" style="align-items:flex-start">
    <span class="grow"><b>${esc(L(n.title, n.ar))}</b>
      <small>${fmtDate(n.at)} · ${esc(person(n.by) ? (isAr() ? person(n.by).ar : person(n.by).lat) : '—')} · ${esc(L(n.audience, n.audienceAr))}</small></span>
    ${n.pri === 'urgent' ? pill(L('Urgent', 'عاجل'), 'danger', 'st-alert') : pill(L('Normal', 'عادي'))}
    ${CR.recBtn('notice', n.id)}</div>`).join('') || empty('bell', L('No notices', 'لا إعلانات'), L('Publish one and it appears on the board and in the bulletin.', 'انشر واحداً فيظهر على اللوحة وفي النشرة.'));

  return `${pageHead({
      crumbs: [{ label: L('Communicate', 'التواصل') }, { label: L('Notices', 'الإعلانات') }],
      title: L('Notices and the weekly bulletin', 'الإعلانات والنشرة الأسبوعية'),
      sub: L('Enter Mass times, intentions, announcements and events once. ParishLife turns them into a printable bulletin and a phone-friendly version.',
             'أدخل مواعيد القداديس والنوايا والإعلانات والأحداث مرّة واحدة. يحوّلها «حياة الرعية» إلى نشرة للطباعة ونسخة للهاتف.'),
      actions: `<button class="btn btn-secondary" id="bulletin">${icon('doc', 17)}${L('Build bulletin', 'بناء النشرة')}</button>
        <button class="btn btn-primary" data-act="notice-add">${icon('plus', 17)}${L('New notice', 'إعلان جديد')}</button>`
    })}
    <div class="splitview">
      ${panel(L('Published notices', 'الإعلانات المنشورة'), rows, { tight: true })}
      <div class="sidecol">
        ${panel(L('This week’s Masses', 'قداديس هذا الأسبوع'), EVENTS.filter(m => m.kind === 'mass').map(m => `
          <div class="listrow" style="padding-inline:0"><span class="mono dim" style="width:46px;flex:none">${m.t}</span>
            <span class="grow"><b>${esc(L(m.title, m.titleAr))}</b><small>${esc(L(venue(m.venue).name, venue(m.venue).ar))}</small></span></div>`).join('')
          + `<div class="divider"></div><div class="listrow" style="padding-inline:0;border-bottom:0">
             <span class="mono dim" style="width:46px;flex:none">17:00</span>
             <span class="grow"><b>${L('Confessions', 'الاعترافات')}</b><small>${L('Saturday, crypt chapel', 'السبت، الكنيسة السفلى')}</small></span></div>`,
          { tight: true })}
        ${panel(L('The permanent parish QR', 'رمز الرعية الدائم'), `
          <div style="display:grid;place-items:center;padding:8px 0">
            <div style="width:128px;height:128px;border:1px solid var(--border);border-radius:var(--r-card);
              display:grid;place-items:center;background:var(--muted);color:var(--text-3)">${icon('qr', 56)}</div></div>
          <p class="t-caption dim" style="margin-top:10px">${L(
            'Print it once and put it at the church door. It always opens the latest Mass schedule, announcements, readings and events — staff update the information without reprinting the code.',
            'اطبعه مرّة واحدة وضعه عند باب الكنيسة. يفتح دائماً أحدث مواعيد القداديس والإعلانات والقراءات والأحداث — ويحدّث الموظّفون المعلومات من دون إعادة طباعة الرمز.')}</p>
          <button class="btn btn-secondary" style="width:100%;margin-top:12px" data-act="print">${icon('print', 17)}${L('Print the code', 'طباعة الرمز')}</button>`)}
      </div></div>`;
}

notices.mount = host => {
  C.wire(host);

  host.querySelector('#bulletin')?.addEventListener('click', () => openDrawer({
    large: true,
    title: L('Weekly bulletin', 'النشرة الأسبوعية'),
    sub: L('Built from what is already in the calendar and the notice board.', 'مبنيّة مما هو أصلاً في الرزنامة ولوحة الإعلانات.'),
    body: `<div class="a4bar">${C.bgroup([L('Print A4', 'طباعة A4'), L('Phone version', 'نسخة للهاتف')], 0)}</div>
      <div class="a4" style="max-width:none;aspect-ratio:auto;padding:32px;align-items:stretch;text-align:start">
        <div style="text-align:center">
          <div class="ttl">${esc(L(PARISH.name, PARISH.nameAr))} — ${esc(L(PARISH.town, PARISH.townAr))}</div>
          <div class="ttl-ar">النشرة الأسبوعية · 4–11 October 2026</div></div>
        <div style="margin-top:24px">
          <h4 style="font:600 12px/18px var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--text-2)">${L('Masses', 'القداديس')}</h4>
          ${EVENTS.filter(e => e.kind === 'mass').map(m => `<div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid var(--border)">
            <span class="mono" style="width:52px">${m.t}</span><span>${esc(L(m.title, m.titleAr))}</span></div>`).join('')}
          <h4 style="margin-top:20px;font:600 12px/18px var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--text-2)">${L('Mass intentions', 'نوايا القداديس')}</h4>
          <div style="padding:6px 0;border-bottom:1px solid var(--border)">${L('For the repose of Sarkis Yammine', 'لراحة نفس سركيس يمين')}</div>
          <div style="padding:6px 0;border-bottom:1px solid var(--border)">${L('In thanksgiving — Haddad family', 'شكراً — عائلة حدّاد')}</div>
          <h4 style="margin-top:20px;font:600 12px/18px var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--text-2)">${L('Announcements', 'الإعلانات')}</h4>
          ${NOTICES.map(n => `<div style="padding:6px 0;border-bottom:1px solid var(--border)">${esc(L(n.title, n.ar))}</div>`).join('')}
        </div></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-secondary" data-act="share:Weekly bulletin">${L('Share phone version', 'مشاركة نسخة الهاتف')}</button>
      <button class="btn btn-primary" data-act="print" style="margin-inline-start:auto">${L('Print', 'طباعة')}</button>`,
    onMount(el) {
      C.wire(el);
      const page = el.querySelector('.a4');   // the same bulletin, laid out for a phone screen
      el.querySelectorAll('.a4bar button').forEach((b, i) => b.addEventListener('click', () => page.classList.toggle('phone', i === 1)));
    }
  }));
};

/* ═══════════ 13 · music ═══════════ */
const LANG_AR = { Arabic: 'عربي', Syriac: 'سرياني', English: 'إنكليزي', French: 'فرنسي', Latin: 'لاتيني' };
const PART_AR = { Entrance: 'الدخول', Trisagion: 'التقديسات', Offertory: 'التقدمة', Communion: 'المناولة', Veneration: 'السجود للصليب', Recessional: 'الختام' };

export function music(id, tab = '') {
  if (id) return hymn(id, tab);
  const f = S.ui.music || {};
  const shown = MUSIC.filter(m => (!f.occ || m.occasion === f.occ) && (!f.part || m.part === f.part) && (!f.lang || m.lang === f.lang));
  const choice = (key, all, allAr, values) => `<select class="select" style="width:auto" data-mfilter="${key}" aria-label="${esc(L(all, allAr))}">
      <option value="">${esc(L(all, allAr))}</option>${values.map(([v, en, ar]) => `<option value="${esc(v)}" ${f[key] === v ? 'selected' : ''}>${esc(L(en, ar))}</option>`).join('')}</select>`;
  const uniq = pick => [...new Map(MUSIC.map(m => pick(m)).filter(x => x[0]).map(x => [x[0], x])).values()].sort((a, b) => a[1].localeCompare(b[1]));
  const rows = shown.map(m => ({ cls: 'clickable', attrs: `data-hymn="${m.id}" data-find-item`, cells: [
    `<b style="font:500 14px/20px var(--sans)">${esc(m.title)}</b>
     <small class="t-caption dim" style="display:block;font-family:var(--arabic)">${esc(m.ar)}</small>`,
    `<span class="dim">${esc(L(m.occasion, m.occasionAr))}</span>`,
    `<span class="dim">${esc(L(m.part, PART_AR[m.part] || m.part))}</span>`,
    `<span class="mono">${esc(m.key)}</span>`,
    `<span class="chip">${esc(L(m.lang, LANG_AR[m.lang] || m.lang))}</span>`,
    `<span class="row" style="gap:6px">${m.sheet ? icon('doc', 17, 'dimmer') : ''}${m.audio ? icon('music', 17, 'dimmer') : ''}</span>`,
    `<span class="row" style="gap:6px;justify-content:flex-end"><button class="btn btn-secondary btn-dense" data-act="to-service:${m.id}">${L('Add to service', 'أضف إلى الخدمة')}</button>${CR.recBtn('hymn', m.id)}</span>`
  ]}));

  return `${pageHead({
      crumbs: [{ label: L('Communicate', 'التواصل') }, { label: L('Music library', 'مكتبة الألحان') }],
      title: L('Music and worship resources', 'الألحان وموارد العبادة'),
      sub: L('Catalogued by title, language, composer, occasion, Mass part, feast and season, with the key, the arrangement and the instrument notes attached.',
             'مفهرسة بالعنوان واللغة والملحّن والمناسبة وجزء القدّاس والعيد والزمن، مع المقام والتوزيع وملاحظات الآلات.'),
      actions: `<button class="btn btn-secondary" id="setlist">${icon('doc', 17)}${L('Setlists', 'لوائح الألحان')}</button>
        <button class="btn btn-primary" data-act="hymn-new">${icon('plus', 17)}${L('Add hymn', 'إضافة لحن')}</button>`
    })}
    <div class="toolbar" style="margin-bottom:16px">
      <div class="grow" style="max-width:320px">${C.searchClear(L('Title, occasion or first line', 'العنوان أو المناسبة أو المطلع'), 'msearch', 'data-find')}</div>
      ${choice('occ', 'All occasions', 'كل المناسبات', uniq(m => [m.occasion, m.occasion, m.occasionAr]))}
      ${choice('part', 'All Mass parts', 'كل أجزاء القدّاس', uniq(m => [m.part, m.part, PART_AR[m.part] || m.part]))}
      ${choice('lang', 'All languages', 'كل اللغات', uniq(m => [m.lang, m.lang, LANG_AR[m.lang] || m.lang]))}
      ${f.occ || f.part || f.lang ? `<button class="btn btn-ghost btn-dense" data-act="music-clear">${L('Clear filters', 'مسح المرشّحات')}</button>` : ''}
    </div>
    ${table({
      cols: [{ label: L('Hymn', 'اللحن'), sort: true }, { label: L('Occasion', 'المناسبة'), cls: 'hide-sm', sort: true },
             { label: L('Mass part', 'جزء القدّاس'), cls: 'hide-md' }, { label: L('Key', 'المقام'), cls: 'shrink' },
             { label: L('Language', 'اللغة'), cls: 'shrink hide-md' }, { label: L('Files', 'الملفات'), cls: 'shrink hide-sm' },
             { label: '', cls: 'shrink' }],
      rows,
      empty: empty('music', L('No hymn matches', 'لا لحن يطابق'), L('Try another occasion, part or language.', 'جرّب مناسبة أو جزءاً أو لغة أخرى.'),
        `<button class="btn btn-secondary btn-dense" data-act="music-clear">${L('Clear filters', 'مسح المرشّحات')}</button>`)
    })}
    <div class="find-empty" hidden>${empty('search', L('No hymn matches', 'لا لحن يطابق'), L('Try part of the title or the occasion.', 'جرّب جزءاً من العنوان أو المناسبة.'))}</div>`;
}

/* Transposition moves every chord on a chord line by semitones; lyric lines are left alone. */
const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
const moveNote = (n, by) => { const i = NOTES_SHARP.indexOf(FLAT[n] || n); return i < 0 ? n : NOTES_SHARP[(i + by + 120) % 12]; };
const CHORD = /^([A-G][b#]?)(m|maj7|m7|7|sus2|sus4|dim|aug|add9)?(\/[A-G][b#]?)?$/;
function transpose(text, by) {
  if (!by) return text;
  return text.split('\n').map(line => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (!words.length || !words.every(w => CHORD.test(w))) return line;
    return line.replace(/[A-G][b#]?(?:maj7|m7|m|7|sus2|sus4|dim|aug|add9)?(?:\/[A-G][b#]?)?/g, c => {
      const [, root, rest = '', bass = ''] = c.match(CHORD);
      return moveNote(root, by) + rest + (bass ? '/' + moveNote(bass.slice(1), by) : '');
    });
  }).join('\n');
}
const transposeKey = (key, by) => { const m = String(key || '').match(/^([A-G][b#]?)(.*)$/); return m ? moveNote(m[1], by) + m[2] : key; };

const HTABS = () => [['', 'Lyrics', 'الكلمات'], ['chords', 'Chords', 'الأوتار'], ['notes', 'Instrument notes', 'ملاحظات الآلات'],
               ['versions', 'Versions', 'الإصدارات'], ['rights', 'Rights', 'الحقوق']];

function hymn(id, tab) {
  const m = MUSIC.find(x => x.id === id);
  if (!m) return `${pageHead({ crumbs: [{ label: L('Music library', 'مكتبة الألحان'), href: '#/music' }], title: L('Hymn not found', 'اللحن غير موجود') })}
    ${empty('music', L('This hymn is no longer in the library', 'هذا اللحن لم يعد في المكتبة'), L('It may have been deleted.', 'ربما حُذف.'),
      `<a class="btn btn-primary btn-dense" href="#/music">${L('Music library', 'مكتبة الألحان')}</a>`)}`;
  const d = musicInfo(m), shift = (S.ui.transpose || {})[m.id] || 0;
  const head = `<div class="pagehead"><div class="entityhead" style="width:100%"><div class="id">
      <nav class="crumbs"><a href="#/music">${L('Music library', 'مكتبة الألحان')}</a><span class="sep">/</span><span>${esc(m.title)}</span></nav>
      <h1 style="font:600 26px/34px var(--sans);letter-spacing:-.02em">${esc(m.title)}
        ${m.key ? `<span class="pill">${esc(m.key)}</span>` : ''}<span class="pill">${esc(L(m.lang, LANG_AR[m.lang] || m.lang))}</span></h1>
      <div class="meta" style="font-family:var(--arabic)">${[m.ar, L(m.occasion, m.occasionAr), L(m.part, PART_AR[m.part] || m.part)].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div class="acts"><button class="btn btn-secondary" data-act="play:${m.id}">${icon('play', 17)}${L('Play', 'استماع')}</button>
        <button class="btn btn-secondary" data-act="print">${icon('print', 17)}${L('Print sheet', 'طباعة النوتة')}</button>
        <button class="btn btn-primary" data-act="to-service:${m.id}">${icon('plus', 17)}${L('Add to service', 'أضف إلى الخدمة')}</button></div>
    </div></div>${tabBar('music/' + m.id, HTABS(), tab)}`;

  const T = {
    '': () => `<div class="splitview">${panel(L('Lyrics', 'الكلمات'), `
      <table class="tbl" style="width:100%"><thead><tr><th>${L('Syriac', 'سرياني')}</th><th>${L('Arabic', 'عربي')}</th><th>${L('English', 'إنكليزي')}</th></tr></thead>
        <tbody>${d.lyrics.length ? '' : `<tr><td colspan="3" class="dim">${L('No lyrics entered yet.', 'لا كلمات بعد.')}</td></tr>`}${d.lyrics.map(r => `<tr><td style="font-size:16px">${esc(r[0])}</td>
          <td style="font-family:var(--arabic);font-size:16px">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table>`,
        { tight: true, more: `<button class="btn btn-ghost btn-dense" data-act="hymn-text:${m.id}|lyrics">${icon(d.lyrics.length ? 'edit' : 'plus', 15)}${d.lyrics.length ? L('Edit', 'تعديل') : L('Add lyrics', 'إضافة الكلمات')}</button>` })}
      <div class="sidecol">${panel(L('Personal annotations', 'ملاحظات شخصية'),
        d.annotations.map(([p, en, ar]) => `<div class="listrow" style="padding-inline:0;align-items:flex-start">
          ${avatar(person(p), 'avatar-sm')}<span class="grow t-caption">${esc(L(en, ar))}</span></div>`).join('')
        + `<div class="divider"></div>${C.textarea({ label: L('Add your own', 'أضف ملاحظتك'), id: 'hann', max: 200 })}`)}
      </div></div>`,

    chords: () => `<div class="splitview">
      ${panel(L('Chord chart', 'جدول الأوتار') + (shift ? ` · ${shift > 0 ? '+' : ''}${shift}` : ''), d.chords ? `<pre class="mono" style="font-size:13px;line-height:24px;white-space:pre-wrap;margin:0">${esc(transpose(d.chords, shift))}</pre>` : `<p class="dim">${L('No chord chart yet.', 'لا جدول أوتار بعد.')}</p>`,
        { more: `<button class="btn btn-ghost btn-dense" data-act="hymn-text:${m.id}|chords">${icon(d.chords ? 'edit' : 'plus', 15)}${d.chords ? L('Edit', 'تعديل') : L('Add chords', 'إضافة الأوتار')}</button>` })}
      <div class="sidecol">${panel(L('Transpose', 'النقل'), `
        <div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip">${esc(m.key || '—')}</span>${icon('arrowR', 16, 'dimmer')}
          <span class="chip chip-on">${esc(transposeKey(m.key, shift) || '—')}</span></div>
        <div class="presets" style="margin-top:12px">${[-2, -1, 0, 1, 2].map(n =>
          `<button aria-pressed="${n === shift}" data-act="transpose:${m.id}|${n}">${n > 0 ? '+' + n : n === 0 ? '0' : '−' + -n}</button>`).join('')}</div>
        ${C.inlineAlert('warning', L('A scanned PDF cannot be transposed', 'الـPDF الممسوح لا يُنقَل'),
          L('Structured chord text transposes cleanly. ParishLife says so rather than producing a wrong sheet.',
            'النصّ الوتري المنظَّم يُنقَل بلا مشاكل. ويقول «حياة الرعية» ذلك بدل إنتاج نوتة خاطئة.'))}`)}
      </div></div>`,

    notes: () => `<div style="max-width:760px">${panel(L('Instrument notes', 'ملاحظات الآلات'),
      d.notes.map(([inst, instAr, en, ar], ni) => `<div class="listrow" style="padding-inline:0;align-items:flex-start">
        <span class="chip" style="flex:none">${esc(L(inst, instAr))}</span>
        <span class="grow">${esc(L(en, ar))}</span>${C.iconBtn('edit', L('Edit', 'تعديل'), `data-act="inst-edit:${m.id}|${ni}"`)}</div>`).join('')
      || `<p class="dim" style="padding:18px;margin:0">${L('No instrument notes yet.', 'لا ملاحظات آلات بعد.')}</p>`, { tight: true })}
      <div class="tabbody">${panel(L('Arrangements', 'التوزيعات'), `
        ${['SATB with organ', 'Unison with oud', 'Solo'].map((a, i) => `<div class="listrow" style="padding-inline:0">
          ${icon('doc', 17, 'dimmer')}<span class="grow"><b>${esc(a)}</b><small class="mono">PDF · ${[180, 96, 64][i]} KB</small></span>
          ${C.iconBtn('export', L('Download', 'تنزيل'), `data-act="doc:${a}.pdf"`)}</div>`).join('')}`, { tight: true })}</div></div>`,

    versions: () => `<div style="max-width:760px">${panel(L('Version history', 'سجل الإصدارات'), `
      ${d.versions.length ? '' : `<p class="dim" style="margin:0">${L('No earlier versions.', 'لا إصدارات سابقة.')}</p>`}<div class="timeline">${d.versions.map(([en, ar, when, by], i) => `<div class="tl-item ${i === 0 ? 'accent' : ''}">
        <div class="when">${fmtDate(when)} · ${esc(isAr() ? person(by).ar : person(by).lat)}</div>
        <div class="what">${esc(L(en, ar))}${i === 0 ? ` <span class="pill pill-success"><span class="dot"></span>${L('current', 'الحالي')}</span>` : ''}</div>
        ${i ? `<button class="btn btn-secondary btn-dense" style="margin-top:8px" data-act="hymn-restore:${m.id}|${i}">${L('Restore', 'استرجاع')}</button>` : ''}</div>`).join('')}</div>`)}</div>`,

    rights: () => `<div class="splitview">
      ${panel(L('Copyright and permitted uses', 'الحقوق والاستعمالات المسموحة'), `<dl class="dl">
        <dt>${L('Composer', 'الملحّن')}</dt><dd>${esc(L(d.composer, d.composerAr))}</dd>
        <dt>${L('Copyright', 'الحقوق')}</dt><dd>${esc(L(d.copyright, d.copyrightAr))}</dd>
        <dt>${L('Attribution', 'الإسناد')}</dt><dd>${L('Not required', 'غير مطلوب')}</dd></dl>
        <div class="divider"></div>
        <div class="row" style="gap:8px;flex-wrap:wrap">${d.uses.map(u => `<span class="chip chip-on">${icon('check', 13)} ${esc(u)}</span>`).join('')}
          <span class="chip">${L('Sell', 'بيع')}</span></div>`)}
      <div class="sidecol">${panel(L('Instrument tuning', 'دوزان الآلات'), `
        <p class="t-body dim" style="font-size:14px;line-height:22px">${L(
          'A built-in tuner is deliberately not part of ParishLife. Choirs already use a phone app for it, and building one would take time away from the library, the setlists and the service plans that only a parish system can do.',
          'الدوزان المدمج ليس جزءاً من «حياة الرعية» عن قصد. الجوقات تستعمل تطبيقاً على الهاتف أصلاً، وبناء واحد يأخذ وقتاً من المكتبة واللوائح وخطط الخدمة التي لا يقوم بها سوى نظام الرعية.')}</p>
        <span class="pill">${L('Deferred — external tool', 'مؤجَّل — أداة خارجية')}</span>`)}
      ${panel(L('Offline copies', 'نسخ للعمل بلا إنترنت'), `
        <p class="t-body dim" style="font-size:14px">${L(
          'Downloadable and offline copies are offered only where the licence allows it. Where it does not, the item can still be projected but not distributed.',
          'النسخ القابلة للتنزيل والعمل بلا إنترنت تُتاح فقط حيث يسمح الترخيص. وحيث لا يسمح يبقى العرض ممكناً لا التوزيع.')}</p>
        ${C.switchRow(L('Allow choir members to download', 'السماح لأعضاء الجوقة بالتنزيل'), { checked: true, pref: 'music.download' })}`)}
      </div></div>`
  };
  return head + (T[tab] || T[''])();
}

music.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelectorAll('[data-mfilter]').forEach(sel => sel.addEventListener('change', () => {
    S.ui.music = { ...(S.ui.music || {}), [sel.dataset.mfilter]: sel.value }; bus.refresh();
  }));
  host.querySelectorAll('[data-hymn]').forEach(tr => tr.addEventListener('click', e => {
    if (e.target.closest('button,a,input')) return;
    location.hash = '#/music/' + tr.dataset.hymn;
  }));
  host.querySelector('#setlist')?.addEventListener('click', () => openDrawer({
    title: L('Setlists', 'لوائح الألحان'),
    sub: L('A setlist links to a service plan, so the order of service and the choir folder never drift apart.',
           'ترتبط اللائحة بخطة الخدمة، فلا يفترق ترتيب الخدمة عن ملف الجوقة.'),
    body: SETLISTS.map(s => `<div class="listrow"><span class="grow"><b>${esc(L(s.name, s.ar))}</b>
        <small>${s.items.length} ${L('hymns', 'ألحان')}${s.service ? ` · ${L('linked to a service', 'مرتبطة بخدمة')}` : ''}</small></span>
      <button class="btn btn-secondary btn-dense" data-act="setlist-open:${s.id}">${L('Open', 'فتح')}</button>${CR.recBtn('setlist', s.id)}</div>`).join('')
      || empty('music', L('No setlists yet', 'لا لوائح بعد'), L('Put hymns in order for a Mass or a feast.', 'رتّب الألحان لقدّاس أو عيد.')),
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-primary" data-act="setlist-new" style="margin-inline-start:auto">${L('New setlist', 'لائحة جديدة')}</button>`
  }));
};

/* ═══════════ 14 · portal ═══════════ */
const PTABS = () => [['', 'Content', 'المحتوى'], ['requests', 'Self-service', 'الخدمة الذاتية', PORTAL_REQUESTS.length],
               ['prayers', 'Prayer requests', 'نوايا الصلاة', PRAYERS.filter(p => p.status === 'awaiting-approval').length]];

export function portal(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Communicate', 'التواصل') }, { label: L('Member portal', 'بوّابة المؤمنين') }],
    title: L('Parish content and member portal', 'محتوى الرعية وبوّابة المؤمنين'),
    sub: L('What a family sees when they open the parish link — and what they may change themselves.',
           'ما تراه العائلة عند فتح رابط الرعية — وما يمكنها تعديله بنفسها.'),
    actions: `<button class="btn btn-secondary" data-act="portal-open">${icon('link', 17)}${L('Open public page', 'فتح الصفحة العامة')}</button>
      <button class="btn btn-primary" data-act="content-edit">${icon('edit', 17)}${L('Edit content', 'تعديل المحتوى')}</button>`
  }) + tabBar('portal', PTABS(), tab);

  if (tab === 'requests') return head + `<div style="margin-top:20px" class="splitview">
    ${panel(L('Waiting for review', 'بانتظار المراجعة'), PORTAL_REQUESTS.length ? `
      ${PORTAL_REQUESTS.map(r => `<div class="listrow" style="padding-inline:0"><span class="grow"><b>${esc(L(r.what, r.whatAr))}</b>
          <small>${L('submitted', 'قُدّم')} ${fmtDate(r.at)}</small></span>
          <button class="btn btn-secondary btn-dense" data-act="portal-compare:${r.id}">${L('Compare', 'مقارنة')}</button>
          <button class="btn btn-primary btn-dense" data-act="portal-accept:${r.id}">${L('Accept', 'قبول')}</button></div>`).join('')}
      <p class="t-caption dim" style="margin-top:12px">${L(
        'Nothing a member submits lands in the record directly. The office reviews every change first.',
        'لا شيء يقدّمه المؤمن يدخل السجل مباشرة. يراجع المكتب كل تعديل أولاً.')}</p>`
      : empty('check', L('Nothing waiting', 'لا شيء بالانتظار'), L('Changes members submit from the portal appear here for review.', 'التعديلات التي يرسلها المؤمنون من البوّابة تظهر هنا للمراجعة.')),
      { tight: false })}
    <div class="sidecol">${panel(L('What a member can do', 'ما يستطيع المؤمن فعله'), `
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px">
        ${[[L('Update their own address, phone and family members', 'تحديث عنوانه وهاتفه وأفراد عائلته'), 'edit'],
           [L('Manage family registrations where authorised', 'إدارة تسجيلات العائلة حيث يُصرَّح له'), 'family'],
           [L('Request a certificate', 'طلب شهادة'), 'doc'],
           [L('See their own giving statement', 'الاطّلاع على كشف تقدماته'), 'give'],
           [L('Discover groups and request membership', 'اكتشاف المجموعات وطلب الانتساب'), 'groups'],
           [L('See their volunteer schedule and registrations', 'رؤية مناوباته وتسجيلاته'), 'vol'],
           [L('Set their own notification preferences', 'ضبط تفضيلات إشعاراته'), 'bell']]
          .map(([x, i]) => `<li class="row" style="gap:10px;align-items:flex-start">${icon(i, 17, 'dimmer')}<span class="t-caption">${esc(x)}</span></li>`).join('')}</ul>
      <div class="divider"></div>
      <p class="t-caption dim">${L('A member never reaches anyone else’s record, and directory visibility is opt-in per person.',
        'لا يصل المؤمن إلى سجل أحد آخر، وظهوره في الدليل اختياري لكل شخص.')}</p>`)}</div></div>`;

  if (tab === 'prayers') return head + `<div class="tabbody">
    ${C.inlineAlert('info', L('A clear handling policy', 'سياسة معالجة واضحة'),
      L('A private request is seen by the priest only and never published. A request offered for the public list is moderated before it appears.',
        'النيّة الخاصة يراها الكاهن وحده ولا تُنشر أبداً. والنيّة المعروضة للائحة العامة تُراجَع قبل ظهورها.'))}
    <div style="margin-top:16px">${table({
      cols: [{ label: L('From', 'من') }, { label: L('Intention', 'النيّة') }, { label: L('Visibility', 'الظهور'), cls: 'shrink' },
             { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows: PRAYERS.map(p => ({ cells: [
        p.by ? who(person(p.by)) : `<span class="dim">${L('Anonymous', 'مجهول')}</span>`,
        esc(L(p.body, p.bodyAr)),
        p.vis === 'private' ? pill(L('Private', 'خاصة'), 'info', 'lock') : pill(L('For the public list', 'للائحة العامة')),
        p.status === 'private' ? pill(L('Priest only', 'للكاهن فقط'), 'info', 'lock') : status(p.status),
        `<span class="row" style="gap:6px;justify-content:flex-end">${p.status === 'awaiting-approval'
          ? `<button class="btn btn-primary btn-dense" data-act="prayer-publish:${p.id}">${L('Publish', 'نشر')}</button>` : ''}${CR.recBtn('prayer', p.id)}</span>`]})),
      empty: empty('notes', L('No prayer requests', 'لا طلبات صلاة'), L('Requests members send from the portal appear here for moderation.', 'الطلبات المرسلة من البوّابة تظهر هنا للمراجعة.'))
    })}</div></div>`;

  return head + `<div style="margin-top:20px" class="splitview">
    <div class="stack" style="gap:16px">
      ${panel(L('Published', 'منشور'), `<div class="stack" style="gap:0">
        ${[[L('Parish history and the patron saint story', 'تاريخ الرعية وقصة الشفيع'), L('updated 12 Aug 2026', 'حُدّث ١٢ آب ٢٠٢٦')],
           [L('Clergy and staff', 'الإكليروس والموظّفون'), L('4 entries', '٤ مدخلات')],
           [L('Mass and confession times, with locations', 'مواعيد القداديس والاعتراف مع الأماكن'), L('synced from the calendar', 'متزامنة مع الرزنامة')],
           [L('Public events and livestream links', 'الأحداث العامة وروابط البثّ'), L('3 upcoming', '٣ قادمة')],
           [L('Homily recordings', 'تسجيلات العظات'), L('18 recordings', '١٨ تسجيلاً')],
           [L('Approved parish documents and reusable slides', 'مستندات الرعية والعروض القابلة لإعادة الاستعمال'), L('11 files', '١١ ملفاً')],
           [L('Bible and missal — licensed or linked', 'الكتاب المقدس والقدّاس — مرخّص أو بالرابط'), L('linked only', 'بالرابط فقط')],
           [L('Contact details', 'معلومات التواصل'), esc(PARISH.phone)]]
          .map(([a, b]) => `<div class="listrow" style="padding-inline:0">
            <span class="grow"><b>${esc(a)}</b><small>${esc(b)}</small></span>
            <span class="pill pill-success"><span class="dot"></span>${L('Live', 'منشور')}</span>
            ${C.iconBtn('edit', L('Edit', 'تعديل'), 'data-act="content-edit"')}</div>`).join('')}</div>`)}
    </div>
    <div class="sidecol">
      ${panel(L('Phone preview', 'معاينة على الهاتف'), `
        <div style="border:8px solid var(--ink);border-radius:26px;overflow:hidden;background:var(--bg)">
          <div style="background:var(--ink);color:var(--sand);padding:14px;text-align:center">
            <div style="font:600 15px/20px var(--arabic)">${esc(PARISH.nameAr)}</div>
            <div style="font:400 10px/14px var(--sans);opacity:.7">${esc(PARISH.town)}</div></div>
          <div style="padding:12px;display:flex;flex-direction:column;gap:8px">
            ${[[L('Mass times', 'مواعيد القداديس'), 'events'], [L('Announcements', 'الإعلانات'), 'bell'],
               [L('Request a certificate', 'طلب شهادة'), 'doc'], [L('My family', 'عائلتي'), 'family'],
               [L('Prayer request', 'نيّة صلاة'), 'msg']]
              .map(([x, i]) => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;
                padding:9px 10px;display:flex;gap:8px;align-items:center;font:500 11px/16px var(--sans)">
                ${icon(i, 14)}${esc(x)}</div>`).join('')}</div></div>`)}
    </div></div>`;
}
portal.mount = host => { C.wire(host); wireTables(host); };
