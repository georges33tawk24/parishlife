import { api } from '../api.js';
import { t, isAr } from '../i18n.js';
import { esc, pageHead, tabBar, openDrawer, toast, icon } from '../ui.js';
import { number, percent, shortDate, sparkline, trend, bars, stacked, funnel, meter, healthOf, HEALTH, wireTips, dataTable } from './insight-charts.js';

/* Insights and the parish CRM, for the Super Admin: how people use the public site (visits,
   pages, forms, where visits come from, what visitors do) and how each parish is doing, with
   its stage, follow-ups and notes. The numbers come from backend/analytics.py. */
const LABELS = {
  pages: { home: ['Homepage', 'الصفحة الرئيسية'], parish: ['Parish pages', 'صفحات الرعايا'], event: ['Event pages', 'صفحات المناسبات'], calendar: ['Calendars', 'الرزنامات'],
    request: ['Request forms', 'استمارات الطلبات'], bundles: ['For parishes', 'للرعايا'], track: ['Request tracking', 'متابعة الطلبات'], verify: ['Document checks', 'التحقّق من الوثائق'], error: ['Pages not found', 'صفحات غير موجودة'] },
  forms: { baptism: ['Baptism', 'المعمودية'], communion: ['First Communion', 'المناولة الأولى'], confirmation: ['Confirmation', 'الميرون'], marriage: ['Marriage', 'الإكليل'],
    funeral: ['Funeral', 'الجنّاز'], certificate: ['Certificate', 'شهادة'], booking: ['Hall booking', 'حجز قاعة'], custom: ['Other request', 'طلب آخر'], appointment: ['Appointment', 'موعد'],
    ministry: ['Joining a ministry (guest)', 'الانضمام إلى خدمة (زائر)'], signup: ['New account', 'حساب جديد'], 'ministry-join': ['Joining a ministry (member)', 'الانضمام إلى خدمة (عضو)'] },
  sources: { whatsapp: ['WhatsApp', 'واتساب'], google: ['Google', 'Google'], social: ['Social media', 'وسائل التواصل'], search: ['Other search engines', 'محرّكات بحث أخرى'],
    direct: ['Direct or the app', 'مباشرة أو من التطبيق'], other: ['Other websites', 'مواقع أخرى'] },
  devices: { phone: ['Phones', 'الهواتف'], desktop: ['Computers', 'الحواسيب'], tablet: ['Tablets', 'الأجهزة اللوحية'] },
  languages: { ar: ['Arabic', 'العربية'], en: ['English', 'الإنكليزية'] },
  actions: { ics: ['Saved an event', 'حفظ مناسبة'], 'ics-all': ['Saved all events', 'حفظ كل المناسبات'], subscribe: ['Subscribed to a calendar', 'اشترك في رزنامة'],
    google: ['Added to Google Calendar', 'أضاف إلى رزنامة Google'], 'share-whatsapp': ['Shared on WhatsApp', 'شارك على واتساب'], 'share-copy': ['Copied a link', 'نسخ رابطاً'],
    'share-native': ['Shared from the phone', 'شارك من الهاتف'], directions: ['Asked for directions', 'طلب الاتجاهات'], call: ['Called a parish', 'اتصل برعية'],
    livestream: ['Opened a livestream', 'فتح بثّاً مباشراً'], 'whatsapp-follow': ['Followed on WhatsApp', 'تابع عبر واتساب'], search: ['Searched', 'بحث'],
    'request-sent': ['Sent a request', 'أرسل طلباً'], 'near-me': ['Used Near me', 'استعمل «بالقرب مني»'] },
  funnel: { visit: ['Visited', 'زار الموقع'], parish: ['Opened a parish page', 'فتح صفحة رعية'], request: ['Opened a request form', 'فتح استمارة طلب'], sent: ['Sent a request', 'أرسل طلباً'] },
  checks: { story: ['Story or welcome', 'الحكاية أو الترحيب'], massTimes: ['Mass times', 'مواعيد القداديس'], contact: ['Phone or email', 'هاتف أو بريد'], photo: ['A photograph', 'صورة'],
    map: ['Position on the map', 'الموقع على الخريطة'], hours: ['Office hours', 'ساعات المكتب'], events: ['Events in the next 30 days', 'مناسبات في الأيام الثلاثين المقبلة'], visit: ['Plan your visit', 'خطّط لزيارتك'] },
  stages: { onboarding: ['Onboarding', 'قيد الانضمام'], active: ['Active', 'ناشطة'], attention: ['Needs attention', 'تحتاج متابعة'], paused: ['Paused', 'متوقّفة'] },
  notes: { note: ['Note', 'ملاحظة'], call: ['Call', 'اتصال'], meeting: ['Meeting', 'اجتماع'], email: ['Email', 'بريد'], visit: ['Visit', 'زيارة'] },
  roles: { priest: ['Priest', 'كاهن'], secretary: ['Secretary', 'أمانة السر'], parish_admin: ['Parish admin', 'مدير الرعية'], treasurer: ['Treasurer', 'أمين الصندوق'], leader: ['Ministry leader', 'مسؤول خدمة'], member: ['Member', 'عضو'] }
};
const label = (group, key) => LABELS[group][key] ? t(...LABELS[group][key]) : key;
const STAGE_TONE = { onboarding: 'info', active: 'success', attention: 'warning', paused: '' };
const KPIS = [['visits', 'Visits', 'زيارات', 'visits'], ['views', 'Page views', 'مشاهدات الصفحات', 'views'], ['requests', 'Requests sent', 'طلبات مُرسلة', 'requests'],
  ['signups', 'New accounts', 'حسابات جديدة'], ['saves', 'Calendar saves', 'حفظ في الرزنامة'], ['shares', 'Shares', 'مشاركات'], ['contacts', 'Directions and calls', 'اتجاهات واتصالات']];
let days = (() => { try { return [7, 30, 90].includes(Number(localStorage.getItem('pl-insights-days'))) ? Number(localStorage.getItem('pl-insights-days')) : 30; } catch { return 30; } })();
let stops = [], last = null;
const sortKey = { visits: r => -r.visits, health: r => r.health, requests: r => -r.requests, activity: r => r.lastActivity ? -Date.parse(r.lastActivity) : 0, name: () => 0 };
let parishView = { stage: '', q: '', sort: 'visits' };

const parishName = r => (isAr() ? r.ar || r.name : r.name || r.ar) || r.id;
const town = r => isAr() ? r.townAr || r.town : r.town || r.townAr;
const ago = iso => {
  if (!iso) return t('No activity recorded', 'لا نشاط مسجّل');
  const days = Math.round((Date.now() - Date.parse(iso)) / 86400000), rtf = new Intl.RelativeTimeFormat(isAr() ? 'ar' : 'en', { numeric: 'auto' });
  return days < 1 ? t('Today', 'اليوم') : days < 45 ? rtf.format(-days, 'day') : rtf.format(-Math.round(days / 30), 'month');
};
const hours = h => h === null || h === undefined ? '—' : h < 1 ? t('under an hour', 'أقل من ساعة') : h < 48 ? t(`${number(Math.round(h))} h`, `${number(Math.round(h))} س`) : t(`${number(Math.round(h / 24))} days`, `${number(Math.round(h / 24))} يوم`);
const today = () => new Date().toISOString().slice(0, 10);

export function insightsPage(tab = '') {
  return pageHead({ title: t('Insights', 'المؤشرات'), sub: t('How people use ParishLife, and how each parish is doing.', 'كيف يستعمل الناس ParishLife، وكيف حال كل رعية.') }) +
    `<div class="ins" data-insights data-tab="${tab === 'parishes' ? 'parishes' : ''}"></div>`;
}
insightsPage.mount = async (host, tab = '') => {
  stops.forEach(stop => stop()); stops = [];
  const root = host.querySelector('[data-insights]');
  if (!root) return;
  tab = tab === 'parishes' ? 'parishes' : '';
  const load = async () => {
    root.classList.add('is-loading');
    if (!last) root.innerHTML = `<p class="ins-loading" role="status">${t('Counting…', 'جارٍ العدّ…')}</p>`;
    try {
      const data = await api('workspace/insights?days=' + days);
      if (!root.isConnected) return;
      last = data;
      render(root, data, tab, load);
    } catch (error) { if (root.isConnected) root.innerHTML = `<p class="help-error" role="alert">${esc(error.message)}</p>`; }
    finally { root.classList.remove('is-loading'); }
  };
  if (last && last.range.days === days) render(root, last, tab, load);
  await load();
};

function bar(data, tab) {
  return `<div class="ins-bar">${tabBar('insights', [['', 'Overview', 'نظرة عامة'], ['parishes', 'Parishes', 'الرعايا', data.parishes.length]], tab)}
    <div class="ins-period"><span class="seg" role="group" aria-label="${esc(t('Period', 'الفترة'))}">${[7, 30, 90].map(n => `<button type="button" data-days="${n}" aria-pressed="${n === days}">${esc(t(`${n} days`, `${number(n)} يوماً`))}</button>`).join('')}</span>
    <span class="ins-range">${esc(shortDate(data.range.from, { day: 'numeric', month: 'short' }))} – ${esc(shortDate(data.range.to, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></div></div>`;
}

function render(root, data, tab, reload) {
  stops.forEach(stop => stop()); stops = [];
  root.innerHTML = bar(data, tab) + (tab === 'parishes' ? parishesView(data) : overview(data));
  root.querySelectorAll('[data-days]').forEach(b => b.addEventListener('click', () => {
    days = Number(b.dataset.days);
    try { localStorage.setItem('pl-insights-days', String(days)); } catch {}
    root.querySelectorAll('[data-days]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    reload();
  }));
  wireTips(root);
  if (tab === 'parishes') mountParishes(root, data, reload);
  else {
    const host = root.querySelector('[data-trend]');
    if (host) stops.push(trend(host, { dates: data.daily.map(d => d.d), label: t('Visits and page views by day', 'الزيارات ومشاهدات الصفحات يومياً'),
      series: [{ label: t('Page views', 'مشاهدات الصفحات'), values: data.daily.map(d => d.views), area: true }, { label: t('Visits', 'الزيارات'), values: data.daily.map(d => d.visits) }] }));
    root.querySelectorAll('[data-open-parish]').forEach(b => b.addEventListener('click', () => openParish(data.parishes.find(p => p.id === b.dataset.openParish), reload)));
  }
}

/* ---------- overview ---------- */
function delta(now, before) {
  const period = t(`vs the ${number(days)} days before`, `مقارنة بالأيام الـ${number(days)} السابقة`);
  if (!before) return now ? `<span class="ins-delta is-new">${icon('plus', 13)}${t('New', 'جديد')} <small>${period}</small></span>` : `<span class="ins-delta"><small>${period}</small></span>`;
  const change = (now - before) / before, up = change > 0;
  if (Math.abs(change) < .005) return `<span class="ins-delta">${t('No change', 'لا تغيير')} <small>${period}</small></span>`;
  return `<span class="ins-delta ${up ? 'is-up' : 'is-down'}"><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="${up ? 'M6 2.5 10 8H2z' : 'M6 9.5 2 4h8z'}" fill="currentColor"/></svg>${esc((up ? '+' : '') + percent(now - before, before))} <small>${period}</small></span>`;
}
function kpi([key, en, ar, series], data, i) {
  const values = series ? data.daily.map(d => d[series]) : [];
  return `<article class="ins-kpi${i === 0 ? ' is-hero' : ''}"><span class="ins-kpi-label">${esc(t(en, ar))}</span><b class="ins-kpi-value">${esc(number(data.totals[key]))}</b>
    ${delta(data.totals[key], data.previous[key])}${series ? sparkline(values, i === 0 ? { width: 180, height: 44 } : {}) : ''}</article>`;
}
function card(title, sub, body, extra = '') {
  return `<section class="ins-card${extra}"><header><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</header>${body}</section>`;
}
function overview(data) {
  const none = t('Nothing counted in this period yet.', 'لم يُحتسب شيء في هذه الفترة بعد.');
  const rows = (list, group, extra = r => '') => list.map(r => ({ label: label(group, r.key), value: r.n, note: extra(r) }));
  const pages = rows(data.pages, 'pages', r => r.visits ? t(`${number(r.visits)} visits`, `${number(r.visits)} زيارة`) : '');
  const forms = rows(data.forms, 'forms', r => r.guest && r.member ? t(`${number(r.guest)} guests · ${number(r.member)} members`, `${number(r.guest)} زائر · ${number(r.member)} عضو`) : '');
  const funnelRows = data.funnel.map(r => ({ label: label('funnel', r.key), value: r.n }));
  const top = [...data.parishes].sort((a, b) => b.visits - a.visits).slice(0, 6);
  return `<section class="ins-kpis" aria-label="${esc(t('Headline numbers', 'الأرقام الرئيسية'))}">${KPIS.map((k, i) => kpi(k, data, i)).join('')}</section>
    ${card(t('Visits and page views', 'الزيارات ومشاهدات الصفحات'), t('A visit is one visitor on one day; nobody is followed from one day to the next.', 'الزيارة هي زائر واحد في يوم واحد؛ لا يُتتبّع أحد من يوم إلى آخر.'),
      `<ul class="viz-key"><li><i class="is-area" style="--c:var(--series-1)"></i>${t('Page views', 'مشاهدات الصفحات')}</li><li><i style="--c:var(--series-2)"></i>${t('Visits', 'الزيارات')}</li></ul>
      <div class="ins-trend" data-trend></div>${dataTable(t('Visits and page views by day', 'الزيارات والمشاهدات يومياً'), [t('Day', 'اليوم'), t('Page views', 'المشاهدات'), t('Visits', 'الزيارات'), t('Requests', 'الطلبات')],
        data.daily.map(d => [shortDate(d.d, { weekday: 'short', day: 'numeric', month: 'short' }), number(d.views), number(d.visits), number(d.requests)]))}`, ' ins-wide')}
    <div class="ins-grid">
      ${card(t('Most viewed pages', 'الصفحات الأكثر مشاهدة'), t('Page views, with the visits that saw them', 'مشاهدات الصفحات، مع عدد الزيارات'), bars(pages, { empty: none }))}
      ${card(t('Forms filled the most', 'الاستمارات الأكثر تعبئة'), t('Requests to parish offices, and new accounts', 'الطلبات إلى مكاتب الرعايا، والحسابات الجديدة'), bars(forms, { empty: none }))}
    </div>
    <div class="ins-grid is-three">
      ${card(t('Where visits come from', 'من أين تأتي الزيارات'), '', bars(rows(data.sources, 'sources'), { empty: none }))}
      ${card(t('Devices', 'الأجهزة'), '', stacked(rows(data.devices, 'devices'), { empty: none }))}
      ${card(t('Languages', 'اللغات'), '', stacked(rows(data.languages, 'languages'), { empty: none }))}
    </div>
    <div class="ins-grid">
      ${card(t('From a visit to a request', 'من الزيارة إلى الطلب'), t('Visits that reached each step; each step’s share of the one before', 'الزيارات التي بلغت كل خطوة؛ ونسبتها من الخطوة السابقة'), data.funnel[0].n ? funnel(funnelRows) : `<p class="viz-empty">${none}</p>`)}
      ${card(t('What visitors do', 'ماذا يفعل الزوّار'), '', bars(rows(data.actions, 'actions'), { empty: none }))}
    </div>
    <div class="ins-grid">
      ${card(t('What people search for', 'عمّا يبحث الناس'), '', data.searches.length ? `<ul class="ins-searches">${data.searches.map(s => `<li><span dir="auto">${esc(s.key)}</span><b>${esc(number(s.n))}</b></li>`).join('')}</ul>` : `<p class="viz-empty">${none}</p>`)}
      ${card(t('Parishes with the most visits', 'الرعايا الأكثر زيارة'), '', top.length ? `<ol class="ins-top">${top.map(p => `<li><button type="button" data-open-parish="${esc(p.id)}"><span><b dir="auto">${esc(parishName(p))}</b><small>${esc(town(p) || '')}</small></span>
          <span class="ins-top-n">${esc(number(p.visits))}<small>${t('visits', 'زيارة')}</small></span>${meter(p.health, icon)}</button></li>`).join('')}</ol><a class="btn btn-secondary btn-dense" href="#/insights/parishes">${t('All parishes', 'كل الرعايا')}</a>` : `<p class="viz-empty">${none}</p>`)}
    </div>`;
}

/* ---------- parishes (CRM) ---------- */
function parishesView(data) {
  const counts = Object.fromEntries(Object.keys(LABELS.stages).map(k => [k, data.parishes.filter(p => p.stage === k).length]));
  const due = data.parishes.filter(p => p.nextFollowup && p.nextFollowup <= today()).length;
  const tones = HEALTH.map(([min, tone, glyph, en, ar], i) => [tone, glyph, t(en, ar), data.parishes.filter(p => healthOf(p.health)[1] === tone).length]);
  return `<div class="ins-crm-head">
      <div class="ins-chips" role="group" aria-label="${esc(t('Stage', 'المرحلة'))}">
        <button type="button" data-stage="" aria-pressed="${!parishView.stage}">${t('All', 'الكل')}<b>${number(data.parishes.length)}</b></button>
        ${Object.keys(LABELS.stages).map(k => `<button type="button" data-stage="${k}" aria-pressed="${parishView.stage === k}">${esc(label('stages', k))}<b>${number(counts[k])}</b></button>`).join('')}
        <button type="button" data-stage="due" aria-pressed="${parishView.stage === 'due'}">${icon('clock', 14)}${t('Follow-ups due', 'متابعات مستحقة')}<b>${number(due)}</b></button>
      </div>
      <ul class="ins-health-sum">${tones.map(([tone, glyph, name, n]) => `<li class="is-${tone}">${icon(glyph, 14)}<span>${esc(name)}</span><b>${esc(number(n))}</b></li>`).join('')}</ul>
    </div>
    <div class="collection-toolbar ins-toolbar"><input class="input" type="search" data-parish-q value="${esc(parishView.q)}" placeholder="${esc(t('Search parishes or towns', 'ابحث عن رعية أو بلدة'))}" aria-label="${esc(t('Search parishes', 'ابحث عن رعية'))}">
      <label class="ins-sort">${t('Sort by', 'ترتيب حسب')} <select class="select" data-parish-sort>${[['visits', 'Most visits', 'الأكثر زيارة'], ['health', 'Lowest health first', 'الأقل صحة أولاً'], ['requests', 'Most requests', 'الأكثر طلبات'], ['activity', 'Most recent activity', 'الأحدث نشاطاً'], ['name', 'Name', 'الاسم']]
        .map(([v, en, ar]) => `<option value="${v}" ${parishView.sort === v ? 'selected' : ''}>${esc(t(en, ar))}</option>`).join('')}</select></label>
      <button type="button" class="btn btn-secondary btn-dense" data-export>${icon('export', 15)}${t('Download CSV', 'تنزيل CSV')}</button></div>
    <div class="tablewrap ins-tablewrap"><table class="tbl ins-table"><thead><tr>
      ${[t('Parish', 'الرعية'), t('Stage', 'المرحلة'), t('Health', 'الصحة'), t('Visits', 'الزيارات'), t('Requests', 'الطلبات'), t('Typical reply', 'الردّ المعتاد'), t('Coming up', 'القادم'), t('Following', 'المتابعون'), t('Office last active', 'آخر نشاط للمكتب'), t('Follow-up', 'المتابعة')].map(h => `<th scope="col">${esc(h)}</th>`).join('')}
    </tr></thead><tbody data-parish-rows></tbody></table></div>`;
}
function parishRows(rows) {
  if (!rows.length) return `<tr><td colspan="10" class="viz-empty">${t('No parish matches.', 'لا رعية مطابقة.')}</td></tr>`;
  return rows.map(p => `<tr data-parish-row="${esc(p.id)}" tabindex="0">
    <th scope="row"><b dir="auto">${esc(parishName(p))}</b><small>${esc([town(p), p.bundle].filter(Boolean).join(' · '))}</small></th>
    <td><span class="pill ${STAGE_TONE[p.stage] ? 'pill-' + STAGE_TONE[p.stage] : ''}">${esc(label('stages', p.stage))}</span></td>
    <td>${meter(p.health, icon)}</td>
    <td class="num">${esc(number(p.visits))}<small>${esc(t(`${number(p.views)} views`, `${number(p.views)} مشاهدة`))}</small></td>
    <td class="num">${esc(number(p.requests))}${p.overdue ? `<small class="is-critical">${icon('warn', 12)}${esc(t(`${number(p.overdue)} waiting 3+ days`, `${number(p.overdue)} بانتظار ٣ أيام+`))}</small>` : p.open ? `<small>${esc(t(`${number(p.open)} open`, `${number(p.open)} مفتوح`))}</small>` : ''}</td>
    <td class="num">${esc(hours(p.responseHours))}</td>
    <td class="num">${esc(number(p.upcoming))}</td>
    <td class="num">${esc(number(p.members))}</td>
    <td>${esc(ago(p.lastActivity))}</td>
    <td>${p.nextFollowup ? `<span class="${p.nextFollowup <= today() ? 'is-due' : ''}">${p.nextFollowup <= today() ? icon('clock', 13) : ''}${esc(shortDate(p.nextFollowup))}</span>` : '<span class="dim">—</span>'}</td></tr>`).join('');
}
function mountParishes(root, data, reload) {
  const body = root.querySelector('[data-parish-rows]');
  const paint = () => {
    const q = parishView.q.toLowerCase().trim();
    const rows = data.parishes.filter(p => (!parishView.stage || (parishView.stage === 'due' ? p.nextFollowup && p.nextFollowup <= today() : p.stage === parishView.stage))
      && (!q || [p.name, p.ar, p.town, p.townAr, p.diocese].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => (sortKey[parishView.sort](a) - sortKey[parishView.sort](b)) || parishName(a).localeCompare(parishName(b), isAr() ? 'ar' : 'en'));
    body.innerHTML = parishRows(rows);
    body.querySelectorAll('[data-parish-row]').forEach(row => {
      const open = () => openParish(data.parishes.find(p => p.id === row.dataset.parishRow), reload);
      row.addEventListener('click', open);
      row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  };
  root.querySelectorAll('[data-stage]').forEach(b => b.addEventListener('click', () => {
    parishView.stage = b.dataset.stage;
    root.querySelectorAll('[data-stage]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    paint();
  }));
  root.querySelector('[data-parish-q]').addEventListener('input', e => { parishView.q = e.target.value; paint(); });
  root.querySelector('[data-parish-sort]').addEventListener('change', e => { parishView.sort = e.target.value; paint(); });
  root.querySelector('[data-export]').addEventListener('click', () => {
    const head = ['Parish', 'Town', 'Diocese', 'Bundle', 'Stage', 'Health', 'Visits', 'Page views', 'Requests', 'Open', 'Waiting 3+ days', 'Typical reply (hours)', 'Events next 30 days', 'Posts last 30 days', 'Following', 'Staff', 'Office last active', 'Next follow-up', 'Notes'];
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [head, ...data.parishes.map(p => [p.name, p.town, p.diocese, p.bundle, p.stage, p.health, p.visits, p.views, p.requests, p.open, p.overdue, p.responseHours ?? '', p.upcoming, p.posts, p.members, p.staff, p.lastActivity, p.nextFollowup, p.notes])]
      .map(r => r.map(cell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `parishlife-parishes-${data.range.from}-to-${data.range.to}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  paint();
}

/* One parish in the CRM: its numbers, what it has published, its people, and the Super Admin's
   stage, follow-up and notes. */
function openParish(p, reload) {
  if (!p) return;
  openDrawer({ large: true, title: parishName(p), body: `<div class="ins ins-drawer" data-parish-detail><p class="ins-loading" role="status">${t('Counting…', 'جارٍ العدّ…')}</p></div>`, async onMount(el) {
    const box = el.querySelector('[data-parish-detail]');
    let detail;
    try { detail = await api(`workspace/insights/parish?parish=${encodeURIComponent(p.id)}&days=${days}`); }
    catch (error) { box.innerHTML = `<p class="help-error" role="alert">${esc(error.message)}</p>`; return; }
    if (!box.isConnected) return;
    const checks = Object.entries(p.checks), done = checks.filter(([, ok]) => ok).length;
    const total = detail.daily.reduce((s, d) => s + d.views, 0);
    box.innerHTML = `<div class="ins-detail-head"><p>${esc([town(p), p.diocese, p.bundle].filter(Boolean).join(' · '))}</p>${meter(p.health, icon)}
        <a class="btn btn-secondary btn-dense" href="public.html?parish=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${icon('ext', 14)}${t('Public page', 'الصفحة العامة')}</a></div>
      <div class="ins-mini">${[[t('Visits', 'الزيارات'), number(p.visits)], [t('Page views', 'المشاهدات'), number(total)], [t('Requests', 'الطلبات'), number(p.requests)], [t('Typical reply', 'الردّ المعتاد'), hours(p.responseHours)], [t('Following', 'المتابعون'), number(p.members)], [t('Staff', 'الفريق'), number(p.staff)]]
        .map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
      ${card(t('Visits to this parish', 'زيارات هذه الرعية'), '', `<div class="ins-trend is-small" data-detail-trend></div>${dataTable(t('Visits by day', 'الزيارات يومياً'), [t('Day', 'اليوم'), t('Visits', 'الزيارات'), t('Page views', 'المشاهدات')], detail.daily.map(d => [shortDate(d.d), number(d.visits), number(d.views)]))}`)}
      <div class="ins-grid">
        ${card(t('What it has published', 'ما نشرته'), t(`${number(done)} of ${number(checks.length)}`, `${number(done)} من ${number(checks.length)}`), `<ul class="ins-checks">${checks.map(([k, ok]) => `<li class="${ok ? 'is-done' : 'is-missing'}">${icon(ok ? 'check' : 'close', 14)}<span>${esc(label('checks', k))}</span></li>`).join('')}</ul>`)}
        ${card(t('Requests by kind', 'الطلبات حسب النوع'), '', bars(detail.requests.map(r => ({ label: label('forms', r.key), value: r.n })), { empty: t('No requests in this period.', 'لا طلبات في هذه الفترة.') }))}
      </div>
      <div class="ins-grid">
        ${card(t('What visitors do here', 'ماذا يفعل الزوّار هنا'), '', bars(detail.actions.map(r => ({ label: label('actions', r.key), value: r.n })), { empty: t('Nothing counted yet.', 'لم يُحتسب شيء بعد.') }))}
        ${card(t('The parish team', 'فريق الرعية'), '', detail.staff.length ? `<ul class="ins-staff">${detail.staff.map(s => `<li><b dir="auto">${esc(s.name)}</b><span>${esc(label('roles', s.role))}</span></li>`).join('')}</ul>` : `<p class="viz-empty">${t('No staff assigned yet.', 'لا فريق معيّن بعد.')}</p>`)}
      </div>
      ${card(t('Relationship', 'العلاقة'), '', `<form class="ins-crm-form" data-crm>
          <label class="formrow"><span class="label">${t('Stage', 'المرحلة')}</span><select class="select" name="stage">${Object.keys(LABELS.stages).map(k => `<option value="${k}" ${p.stage === k ? 'selected' : ''}>${esc(label('stages', k))}</option>`).join('')}</select></label>
          <label class="formrow"><span class="label">${t('Next follow-up', 'المتابعة التالية')}</span><input class="input" type="date" name="nextFollowup" value="${esc(p.nextFollowup)}"></label>
          <label class="check"><input type="checkbox" name="owner" value="me" ${p.owner ? 'checked' : ''}>${t('I follow this parish', 'أتابع هذه الرعية')}</label>
          <button class="btn btn-primary btn-dense">${t('Save', 'حفظ')}</button></form>`)}
      ${card(t('Notes', 'الملاحظات'), '', `<form class="ins-note-form" data-note><select class="select" name="kind" aria-label="${esc(t('Kind', 'النوع'))}">${Object.keys(LABELS.notes).map(k => `<option value="${k}">${esc(label('notes', k))}</option>`).join('')}</select>
          <textarea class="textarea" name="body" rows="3" maxlength="2000" required placeholder="${esc(t('What was said or agreed', 'ما قيل أو اتُّفق عليه'))}"></textarea><button class="btn btn-primary btn-dense">${t('Add note', 'إضافة ملاحظة')}</button></form>
        <ol class="ins-notes">${detail.notes.map(n => `<li><span class="ins-note-kind">${esc(label('notes', n.kind))}</span><p dir="auto">${esc(n.body)}</p><small>${esc(n.author)} · ${esc(new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(n.created_at)))}</small></li>`).join('') || `<li class="viz-empty">${t('No notes yet.', 'لا ملاحظات بعد.')}</li>`}</ol>`)}`;
    wireTips(box);
    const stop = trend(box.querySelector('[data-detail-trend]'), { dates: detail.daily.map(d => d.d), height: 200, label: t('Visits to this parish by day', 'زيارات هذه الرعية يومياً'), series: [{ label: t('Visits', 'الزيارات'), values: detail.daily.map(d => d.visits), area: true }] });
    stops.push(stop);
    const send = async (form, path, extra = {}) => {
      const button = form.querySelector('button'); button.disabled = true;
      try { await api(path, 'POST', { ...Object.fromEntries(new FormData(form)), parish: p.id, ...extra }); toast(t('Saved', 'حُفظ'), '', 'success'); last = null; await reload(); openParish((last?.parishes || []).find(x => x.id === p.id) || p, reload); }
      catch (error) { toast(t('Could not save', 'تعذّر الحفظ'), error.message, 'danger'); button.disabled = false; }
    };
    box.querySelector('[data-crm]').addEventListener('submit', e => { e.preventDefault(); send(e.target, 'workspace/crm', { owner: e.target.owner.checked ? 'me' : '' }); });
    box.querySelector('[data-note]').addEventListener('submit', e => { e.preventDefault(); send(e.target, 'workspace/crm/notes'); });
  } });
}
