/* Modules 1, 15, 16, 17 — eparchy, workflows, reporting, audit, security. */
import { t, isAr, num, usd, fmtDate } from '../i18n.js';
import { S, ROLES, is, go, bus } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, pill, esc, table, wireTables, empty, stat,
         searchField, openDrawer, openModal, closeOverlays, toast, tabBar, avatar, amount, openMenu } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import { deleteGuard, newPersonDrawer } from './people.js';
import { savedAt, savedSize } from '../persist.js';
import { api } from '../api.js';
import { WORKFLOWS, RUNS, RUN_LOG, AUDIT, FUNDS, RATE, PARISH, PARISHES, EPARCHY_NEWS, GROUPS, BATCH,
         SESSIONS, SECURITY_ALERTS, RETENTION, WEBHOOKS, PERMISSIONS, ATTENDANCE_SERIES,
         GIVING_SERIES, PAYMENT_MIX, VOLUNTEERS, ARCHIVED, PHOTOS, FORM_FIELDS, FORM_RULES, EXCEPTIONS, TODAY, PREFS, GROUP_DETAIL, REGISTRATIONS, REGISTRANTS, CHECKIN, EVENTS, person } from '../data.js';
import { FIELD_TYPES } from '../crud.js';

const L = (en, ar) => t(en, ar);

/* ═══════════ 1 · eparchy ═══════════ */
export function eparchy(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Administration', 'الإدارة') }, { label: L('Eparchy', 'الأبرشية') }],
    title: L(PARISH.eparchy, PARISH.eparchyAr),
    sub: L('Aggregated across the parishes you hold a role in. Restricted parish records are never exposed here by default.',
           'مجمَّع عبر الرعايا التي لك دور فيها. ولا تُكشف السجلات المقيّدة هنا افتراضياً.'),
    actions: `<button class="btn btn-secondary" data-act="export">${icon('export', 17)}${L('Export', 'تصدير')}</button>`
  }) + tabBar('eparchy', [['', 'Parishes', 'الرعايا'], ['news', 'Announcements', 'الإعلانات'], ['aggregate', 'Aggregates', 'التجميعات']], tab);

  if (tab === 'news') return head + table({
    cols: [{ label: L('Announcement', 'الإعلان') }, { label: L('Date', 'التاريخ') },
           { label: L('Shared with parishes', 'مشترك مع الرعايا'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
    rows: EPARCHY_NEWS.map(n => ({ cells: [
      `<b>${esc(L(n.title, n.ar))}</b>`, `<span class="mono dim">${fmtDate(n.at)}</span>`,
      n.shared ? pill(L('Shared', 'مشترك'), 'success') : pill(L('Clergy only', 'للإكليروس فقط'), 'info'),
      `<button class="btn btn-secondary btn-dense" data-act="doc:${L(n.title, n.ar)}">${L('Open', 'فتح')}</button>`]}))
  });

  if (tab === 'aggregate') return head + `<div class="grid g2">
      ${C.kpi({ k: L('People across accessible parishes', 'المؤمنون في الرعايا المتاحة'), v: num(PARISHES.reduce((a, p) => a + p.people, 0)),
                sub: `${PARISHES.length} ${L('parishes', 'رعايا')}` })}
      ${C.kpi({ k: L(`Sacraments registered, ${new Date().getFullYear()}`, `الأسرار المسجَّلة ${new Date().getFullYear()}`), v: num(PARISHES.reduce((a, p) => a + (p.sacramentsYear || 0), 0)), sub: L('across accessible registers', 'في السجلات المتاحة') })}
    </div>
    ${panel(L('Parishioners by parish', 'المؤمنون حسب الرعية'), C.barChart(
      PARISHES.map(p => ({ label: L(p.name, p.ar), v: p.people, max: 2200, text: num(p.people) }))))}
    ${C.inlineAlert('info', L('Small groups are not broken out', 'لا تُفصَّل المجموعات الصغيرة'),
      L('An aggregate never splits a figure so far that an individual could be identified by elimination.',
        'لا يقسّم التجميع رقماً إلى حدّ يسمح بتحديد شخص بالاستبعاد.'))}`;

  return head + `${table({
      cols: [{ label: L('Parish', 'الرعية'), sort: true }, { label: L('Town', 'البلدة'), cls: 'hide-sm' },
             { label: L('Your role there', 'دورك فيها'), cls: 'hide-sm' }, { label: L('People', 'المؤمنون'), cls: 'num', sort: true },
             { label: L('Households', 'العائلات'), cls: 'num hide-sm' }, { label: '', cls: 'shrink' }],
      rows: PARISHES.map(p => ({ cells: [
        `<span class="row" style="gap:10px"><span class="avatar">${esc(L(p.name, p.ar).slice(0, 1))}</span>
          <b>${esc(L(p.name, p.ar))}</b></span>`,
        `<span class="dim">${esc(L(p.town, p.townAr))}</span>`,
        `<span class="chip">${esc(L(p.role, p.roleAr))}</span>`,
        `<span class="num">${num(p.people)}</span>`, `<span class="num dim">${num(p.households)}</span>`,
        L(p.name, p.ar) === L(PARISH.name, PARISH.nameAr) ? pill(L('Current', 'الحالية'), 'success')
          : `<button class="btn btn-secondary btn-dense" data-act="parish-switch:${p.id}">${L('Switch to', 'التبديل إليها')}</button>`]}))
    })}
    ${C.inlineAlert('info', L('Every record belongs to one parish', 'كل سجل يخصّ رعية واحدة'),
      L('Groups, facilities, events and financial records are all owned by a parish, and a person’s memberships are recorded explicitly rather than inferred.',
        'المجموعات والمرافق والأحداث والسجلات المالية كلها مملوكة لرعية، وانتساب الشخص يُسجَّل صراحةً لا استنتاجاً.'))}`;
}
eparchy.mount = host => { C.wire(host); wireTables(host); };

export function assignments() {
  if (!is('bishop')) return empty('shield', L('Bishop access required', 'تتطلّب صلاحية المطران'), L('Only the bishop can assign parish priests.', 'المطران وحده يعيّن كهنة الرعايا.'));
  return pageHead({ crumbs: [{ label: L('Archdiocese', 'الأبرشية') }, { label: L('Priest assignments', 'تعيينات الكهنة') }],
    title: L('Priest assignments', 'تعيينات الكهنة'),
    sub: L('Assign, replace, or reassign priests to parishes within this archdiocese. A removed assignment ends access immediately.', 'عيّن الكهنة أو استبدلهم أو أعد تعيينهم في رعايا هذه الأبرشية. وينتهي الوصول فور إزالة التعيين.') }) +
    `<div id="assignment-body" class="tabbody"><p class="dim">${L('Loading assignments…', 'جارٍ تحميل التعيينات…')}</p></div>`;
}
assignments.mount = async host => {
  const body = host.querySelector('#assignment-body'); if (!body) return;
  try {
    const data = await api('assignments');
    body.innerHTML = data.priests.length ? data.priests.map(priest => `<section class="panel" style="margin-bottom:16px" data-priest="${esc(priest.id)}">
      <div class="panel-h"><h3>${esc(priest.name)}</h3></div><div class="panel-b"><div class="stack" style="gap:10px">${data.parishes.map(p =>
        `<label class="check"><input type="checkbox" value="${esc(p.id)}" ${priest.parishes.includes(p.id) ? 'checked' : ''}><span>${esc(L(p.name, p.ar))} · ${esc(L(p.town, p.townAr))}</span></label>`).join('')}</div>
        <button class="btn btn-primary" style="margin-top:16px" data-save-priest="${esc(priest.id)}">${L('Save assignments', 'حفظ التعيينات')}</button></div></section>`).join('')
      : empty('people', L('No priest accounts yet', 'لا حسابات كهنة بعد'), L('Create a priest account on the server, then assign its parishes here.', 'أنشئ حساب كاهن على الخادم ثم عيّن رعاياه هنا.'));
    body.querySelectorAll('[data-save-priest]').forEach(button => button.addEventListener('click', async () => {
      const priest = button.dataset.savePriest, section = button.closest('[data-priest]');
      const parishes = [...section.querySelectorAll('input:checked')].map(input => input.value);
      button.disabled = true;
      try { await api('assignments', 'PUT', { priest, parishes });
        toast(L('Priest assignments saved', 'حُفظت تعيينات الكاهن'), L('Access now follows this list.', 'يتبع الوصول هذه القائمة الآن.'), 'success');
      } catch (e) { toast(L('Could not save assignments', 'تعذّر حفظ التعيينات'), e.message, 'danger'); }
      finally { button.disabled = false; }
    }));
  } catch (e) { body.innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`; }
};

/* ═══════════ 15 · forms & workflows ═══════════ */
const WTABS = () => [['', 'Workflows', 'المسارات'], ['runs', 'Open tasks', 'المهام المفتوحة', RUNS.length],
               ['builder', 'Form builder', 'بناء الاستمارة'], ['log', 'Activity log', 'سجل النشاط']];
const wfSteps = w => (w && (isAr() ? w.stepsAr : w.steps)) || w?.steps || [];
const nameIn = p => p ? L(p.lat, p.ar || p.lat) : '';
const RULE_OPS = { '=': ['is', 'هو'], '≠': ['is not', 'ليس'] };

export function forms(tab = '') {
  if (tab !== 'runs') S.ui.runWf = '';          // the queue filter belongs to the visit that set it
  const head = pageHead({
    crumbs: [{ label: L('Administration', 'الإدارة') }, { label: L('Forms & workflows', 'الاستمارات والمسارات') }],
    title: L('Forms and workflows', 'الاستمارات ومسارات العمل'),
    sub: L('Each request moves through set steps. Every step has a person responsible and a due date, so nothing is forgotten.',
           'يمرّ كل طلب بخطوات محدّدة، ولكل خطوة شخص مسؤول وموعد، فلا يُنسى شيء.'),
    actions: `${tab === 'builder' ? '' : `<button class="btn btn-secondary" data-go="forms/builder">${icon('doc', 17)}${L('Form templates', 'قوالب الاستمارات')}</button>`}
      <button class="btn btn-primary" data-act="wf-new">${icon('plus', 17)}${L('New workflow', 'مسار جديد')}</button>`
  }) + tabBar('forms', WTABS(), tab);

  if (tab === 'runs') {
    const only = WORKFLOWS.find(w => w.id === S.ui.runWf), runs = RUNS.filter(r => WORKFLOWS.some(w => w.id === r.wf) && (!only || r.wf === only.id));
    const late = runs.filter(r => r.overdue).length;
    return head + `${only ? `<div class="toolbar" style="margin-bottom:14px">
        <span class="chip chip-on" style="gap:6px">${icon('filter', 14)}${esc(L(only.name, only.ar))}</span>
        <span class="t-caption dim">${runs.length} ${L('open', 'مفتوحة')}</span>
        <button class="btn btn-ghost btn-dense" data-act="wf-queue:">${L('Show every workflow', 'عرض كل المسارات')}</button></div>` : ''}
      ${table({
        cols: [{ label: L('Workflow', 'المسار'), sort: true }, { label: L('For', 'لـ') },
               { label: L('Current step', 'الخطوة الحالية') }, { label: L('Responsible', 'المسؤول'), cls: 'hide-sm' },
               { label: L('Due', 'الموعد'), sort: true }, { label: '', cls: 'shrink' }],
        rows: runs.map(r => { const w = WORKFLOWS.find(x => x.id === r.wf), steps = wfSteps(w);
          return { cls: 'clickable', attrs: `data-run="${r.id}" tabindex="0"`, cells: [
            `<b>${esc(L(w.name, w.ar))}</b>`,
            r.subject ? who(person(r.subject)) : `<span class="dim">${L('Parish expense', 'مصروف الرعية')}</span>`,
            `<span style="display:block;min-width:150px"><b style="font-weight:500">${esc(steps[r.step] || '')}</b>
              <span class="t-caption dim tnum" style="display:block">${L(`Step ${Math.min(r.step + 1, r.total)} of ${r.total}`, `الخطوة ${Math.min(r.step + 1, r.total)} من ${r.total}`)}</span>
              <span class="meter" style="margin-top:6px"><i style="width:${Math.round(r.step / r.total * 100)}%"></i></span></span>`,
            who(person(r.owner)),
            r.overdue ? pill(`${fmtDate(r.due)} · ${L('late', 'متأخرة')}`, 'danger') : `<span class="mono dim">${fmtDate(r.due)}</span>`,
            `<span class="btn btn-secondary btn-dense" aria-hidden="true">${L('Open', 'فتح')}</span>`]}; }),   /* the whole row opens the task */
        empty: empty('check', L('No open tasks', 'لا مهام مفتوحة'), only ? L('Nothing is waiting in this workflow.', 'لا شيء ينتظر في هذا المسار.') : L('Every request has been dealt with.', 'عولجت كل الطلبات.'))
      })}
      ${late ? C.inlineAlert('warning', late === 1 ? L('One task is late', 'مهمّة واحدة متأخرة') : L(`${late} tasks are late`, `${late} مهام متأخرة`),
        L('The person responsible is reminded. Nothing is ever decided automatically.', 'يُذكَّر الشخص المسؤول. ولا يُتّخذ أي قرار تلقائياً.')) : ''}`;
  }

  if (tab === 'builder') return head + `<div class="splitview">
      <div>${panel(L('Certificate request form', 'استمارة طلب شهادة'), `
        ${FORM_FIELDS.map(f => `<div class="listrow" style="padding-inline:0;align-items:flex-start">
            <span style="color:var(--text-3);margin-top:2px">${icon(f.type === 'file' ? 'doc' : f.type === 'person' ? 'people' : f.type === 'date' ? 'events' : 'forms', 17)}</span>
            <span class="grow"><b>${esc(L(f.label, f.labelAr))}${f.req ? ' <span style="color:var(--danger)">*</span>' : ''}</b>
              ${f.note ? `<small style="white-space:normal">${esc(L(f.note, f.noteAr))}</small>` : ''}</span>
            <span class="chip">${esc(L(...(FIELD_TYPES[f.type] || [f.type, f.type])))}</span>${CR.recBtn('field', f.id, L('Field options', 'خيارات الحقل'))}</div>`).join('')
          || `<p class="t-caption dim">${L('No fields yet — add the first one.', 'لا حقول بعد — أضف الأول.')}</p>`}
        <button class="btn btn-secondary btn-dense" style="margin-top:14px" data-act="dom-add-field">${icon('plus', 15)}${L('Add field', 'إضافة حقل')}</button>
        <p class="t-caption dim" style="margin-top:12px">${L('Fields marked * must be filled in before the request can be sent.', 'يجب ملء الحقول المعلَّمة بـ* قبل إرسال الطلب.')}</p>`)}
      </div>
      <div class="sidecol">
        ${panel(L('Show a field only when…', 'أظهر الحقل فقط حين…'), `${FORM_RULES.map(r => { const a = FORM_FIELDS.find(f => f.id === r.show), b = FORM_FIELDS.find(f => f.id === r.when);
          return `<div class="rulecard"><span class="grow">${L('Show', 'أظهر')} <b>${esc(a ? L(a.label, a.labelAr) : '—')}</b>
            ${L('only when', 'فقط حين يكون')} <b>${esc(b ? L(b.label, b.labelAr) : '—')}</b> ${esc(L(...(RULE_OPS[r.op] || [r.op, r.op])))} <b>${esc(L(r.value, r.valueAr))}</b></span>
            ${C.iconBtn('close', L('Remove rule', 'إزالة القاعدة'), `data-act="rule-del:${r.id}"`)}</div>`; }).join('')
          || `<p class="t-caption dim">${L('No rules — every field always shows.', 'لا قواعد — كل الحقول تظهر دائماً.')}</p>`}
          <button class="btn btn-secondary btn-dense" style="margin-top:4px" data-act="dom-add-rule">${icon('plus', 15)}${L('Add rule', 'إضافة قاعدة')}</button>`)}
        ${panel(L('Checks before sending', 'تحقّق قبل الإرسال'), `<div class="stack" style="gap:10px">
          ${C.checkRow(L('Required fields must be filled', 'الحقول المطلوبة إلزامية'), { checked: true })}
          ${C.checkRow(L('Attachments limited to 10 MB', 'المرفقات حتى ١٠ ميغابايت'), { checked: true })}
          ${C.checkRow(L('Refuse the same request twice within 7 days', 'رفض الطلب نفسه مرّتين خلال ٧ أيام'), { checked: true })}</div>`)}
      </div></div>`;

  if (tab === 'log') return head + `${panel(L('What happened, newest first', 'ما جرى، الأحدث أولاً'), `
      <div class="timeline">${RUN_LOG.map(([when, en, ar, kind]) => `<div class="tl-item ${kind === 'err' ? 'accent' : ''}">
        <div class="when">${esc(when)}</div>
        <div class="what">${esc(L(en, ar))}${kind === 'err' && /retry|محاولة/i.test(en + ar) ? ` ${pill(L('Retried', 'أُعيدت'), 'warning')}` : ''}</div></div>`).join('')}</div>`)}
    <div class="grid g2">
      ${panel(L('Pause or resume a workflow', 'إيقاف مسار أو استئنافه'), `${WORKFLOWS.map(w => `<div class="listrow" style="padding-inline:0">
          <span class="grow"><b>${esc(L(w.name, w.ar))}</b><small>${w.paused ? L('Paused — no new requests start', 'متوقّف — لا تبدأ طلبات جديدة') : L('Running', 'يعمل')}</small></span>
          <button class="btn btn-secondary btn-dense" data-act="wf-pause:${w.id}">${w.paused ? L('Resume', 'استئناف') : L('Pause', 'إيقاف مؤقّت')}</button></div>`).join('')}
        <div class="row" style="gap:8px;margin-top:14px"><button class="btn btn-secondary btn-dense" data-act="wf-retry">${L('Retry messages that failed', 'إعادة إرسال الرسائل الفاشلة')}</button></div>
        <p class="t-caption dim" style="margin-top:12px">${L(
          'Retrying never sends a message twice: anything already delivered is skipped.',
          'إعادة المحاولة لا تُرسل رسالة مرّتين: ما وصل سابقاً يُتخطّى.')}</p>`)}
      ${panel(L('When something goes wrong', 'حين يتعطّل شيء'), `<dl class="dl">
        <dt>${L('A message fails', 'فشل رسالة')}</dt><dd>${L('Tried again up to 3 times, a little later each time', 'تُعاد حتى ٣ مرّات، بفاصل أطول كل مرّة')}</dd>
        <dt>${L('It still fails', 'إن استمرّ الفشل')}</dt><dd>${L('The workflow stops and tells the person responsible', 'يتوقّف المسار ويُبلغ المسؤول')}</dd>
        <dt>${L('Sensitive steps', 'الخطوات الحسّاسة')}</dt><dd>${L('Always wait for a person', 'تنتظر شخصاً دائماً')}</dd></dl>`)}
    </div>`;

  const cards = WORKFLOWS.map(w => {
    const steps = wfSteps(w), open = RUNS.filter(r => r.wf === w.id).length;
    return `<section class="panel"><div class="panel-b">
      <div class="row" style="gap:10px;align-items:flex-start">
        <span class="avatar avatar-lg">${icon('forms', 20)}</span>
        <div style="flex:1;min-width:0"><b style="display:block;font:600 16px/22px var(--sans)">${esc(L(w.name, w.ar))}</b>
          <small class="t-caption dim">${L('usually takes', 'يستغرق عادةً')} ${esc(L(w.avg, w.avgAr))}</small></div>
        ${w.paused ? pill(L('Paused', 'متوقّف'), 'warning', 'st-pause') : ''}<span class="badge ${open ? '' : 'badge-quiet'}" title="${L('Open tasks', 'مهام مفتوحة')}">${open}</span>${CR.recBtn('workflow', w.id)}</div>
      <div class="divider"></div>
      <ol class="wfsteps">${steps.map((st, i) => `<li><span class="n">${i + 1}</span>${esc(st)}</li>`).join('')}</ol>
      <button class="btn btn-secondary" style="width:100%;margin-top:14px;min-height:34px;font-size:13px" data-act="wf-queue:${w.id}">
        ${open ? L(`See ${open} open task${open === 1 ? '' : 's'}`, `عرض المهام المفتوحة (${open})`) : L('No open tasks', 'لا مهام مفتوحة')}</button>
    </div></section>`;
  }).join('');
  const late = RUNS.filter(r => r.overdue), lateW = late[0] && WORKFLOWS.find(w => w.id === late[0].wf);

  return head + `<div class="stats">
      ${stat(L('Open tasks', 'مهام مفتوحة'), RUNS.length, L(`in ${new Set(RUNS.map(r => r.wf)).size} workflows`, `في ${new Set(RUNS.map(r => r.wf)).size} مسارات`))}
      ${stat(L('Late', 'متأخرة'), late.length, late.length ? `<span class="down">${esc(L(lateW?.name || '', lateW?.ar || ''))} · ${fmtDate(late[0].due)}</span>` : L('nothing is late', 'لا شيء متأخر'))}
      ${stat(L('Finished this month', 'أُنجزت هذا الشهر'), 27, L('usually within 2 days', 'عادةً خلال يومين'))}
      ${stat(L('Automatic steps', 'خطوات تلقائية'), 4, L('a person always checks the result', 'يراجع شخصٌ النتيجة دائماً'))}
    </div>
    <div class="gridcards">${cards}</div>
    ${C.inlineAlert('info', L('Sensitive decisions always stop for a person', 'القرارات الحسّاسة تتوقّف دائماً عند شخص'),
      L('Pastoral, safeguarding, financial and disciplinary steps are never completed automatically, however routine they look. Automation may prepare the work; it never decides it.',
        'لا تُنجَز الخطوات الرعوية والحمائية والمالية والتأديبية تلقائياً مهما بدت روتينية. للأتمتة أن تُحضّر العمل لا أن تقرّره.'))}`;
}

/* One open task: its steps, who is responsible, and the next action. Also reopened after
   "Keep the task" in the cancel confirmation. */
export function openRun(id) {
  const r = RUNS.find(x => x.id === id), w = r && WORKFLOWS.find(x => x.id === r.wf);
  if (!w) return;
  const steps = wfSteps(w), owner = person(r.owner);
  openDrawer({
    title: L(w.name, w.ar),
    sub: r.subject ? esc(nameIn(person(r.subject))) : L('Parish expense', 'مصروف الرعية'),
    body: `<ol class="runsteps">${steps.map((st, i) => `<li class="${i < r.step ? 'done' : i === r.step ? 'now' : ''}">
        <span class="dot" aria-hidden="true">${i < r.step ? icon('check', 13) : i + 1}</span>
        <span class="grow"><b>${esc(st)}</b><small>${i < r.step ? L('Done', 'أُنجزت') : i === r.step ? L('Current step', 'الخطوة الحالية') : L('Still to come', 'لاحقاً')}</small></span></li>`).join('')}</ol>
      <div class="divider"></div>
      <dl class="dl"><dt>${L('Responsible', 'المسؤول')}</dt><dd>${esc(nameIn(owner) || '—')}</dd>
        <dt>${L('Due', 'الموعد')}</dt><dd>${fmtDate(r.due)}${r.overdue ? ` · <span style="color:var(--danger-ink);font-weight:600">${L('late', 'متأخرة')}</span>` : ''}</dd>
        <dt>${L('If it runs late', 'إن تأخّرت')}</dt><dd>${L('Fr. Antoine Khoury is reminded after 2 days', 'يُذكَّر الأب أنطوان خوري بعد يومين')}</dd></dl>
      <div style="margin-top:18px">${C.textarea({ label: L('Note for the next person (optional)', 'ملاحظة لمن يتابع (اختياري)'), id: 'runnote', max: 300 })}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-danger-quiet" data-act="wf-cancel:${r.id}">${L('Cancel task', 'إلغاء المهمّة')}</button>
      <button class="btn btn-primary" id="run_go" style="margin-inline-start:auto" data-act="run-step:${r.id}">${icon('check', 16)}${r.step + 1 >= r.total ? L('Finish task', 'إنهاء المهمّة') : L('Mark step done', 'إنجاز الخطوة')}</button>`,
    onMount(el) {
      C.wire(el);
      /* start on the steps, not in the note: on a phone, focusing the note would scroll past them and
         open the keyboard. Focus rests on the dialog itself, so no key press completes a step by accident. */
      el.querySelector('.drawer-body').scrollTop = 0;
      el.tabIndex = -1; el.focus({ preventScroll: true });
    }
  });
}

forms.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelectorAll('tr[data-run]').forEach(tr => {
    tr.addEventListener('click', () => openRun(tr.dataset.run));
    tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRun(tr.dataset.run); } });
  });
};

/* ═══════════ 16 · reporting ═══════════ */
const REPORTS = [
  ['attendance', 'attend', 'Group meeting attendance', 'حضور اجتماعات المجموعات', 'Recorded attendance at group meetings and activities only', 'حضور مسجّل في اجتماعات المجموعات وأنشطتها فقط'],
  ['membership', 'people', 'Membership records', 'سجلات الانتساب', 'Current and archived parish records', 'سجلات الرعية الحالية والمؤرشفة'],
  ['groups', 'groups', 'Group participation', 'مشاركة المجموعات', 'Roster size, attendance rate, course completion', 'حجم اللائحة ونسبة الحضور وإتمام الدورات'],
  ['volunteers', 'vol', 'Volunteer workload', 'عبء المتطوّعين', 'Availability, conflicts, who is serving too often', 'التوفّر والتعارضات ومن يخدم كثيراً'],
  ['facilities', 'rooms', 'Facility utilisation', 'استخدام المرافق', 'Hours booked, refusals, equipment loans', 'ساعات الحجز والرفض وإعارات التجهيزات'],
  ['giving', 'give', 'Giving trends', 'اتجاهات التقدمات', 'By fund, by currency, with the rate applied', 'حسب الصندوق والعملة، مع السعر المطبَّق'],
  ['budget', 'fin', 'Budget and expenses', 'الموازنة والمصاريف', 'Budget against actual, approvals, reconciliation', 'الموازنة مقابل الفعلي والموافقات والمطابقة'],
  ['capacity', 'registr', 'Registration versus attendance', 'التسجيل مقابل الحضور', 'Unused capacity on events people signed up for', 'السعة غير المستعملة في الأحداث المسجَّل لها']
];

export function reports(id = '') {
  if (id) return reportDetail(id);
  return `${pageHead({
      crumbs: [{ label: L('Administration', 'الإدارة') }, { label: L('Reports', 'التقارير') }],
      title: L('Reporting and analytics', 'التقارير والتحليلات'),
      sub: L('Every report is filtered to what you are allowed to see, and says which period and which definition it used.',
             'كل تقرير مرشَّح بحسب ما يحقّ لك الاطّلاع عليه، ويذكر الفترة والتعريف المستعملين.'),
      actions: `<button class="btn btn-secondary" data-act="export">${icon('export', 17)}${L('Export PDF / Excel / CSV', 'تصدير PDF / Excel / CSV')}</button>
        <button class="btn btn-primary" id="sched">${icon('clock', 17)}${L('Scheduled delivery', 'إرسال مجدول')}</button>`
    })}
    <div class="gridcards">${REPORTS.map(([slug, ic, en, ar, se, sa]) =>
      `<a class="panel" href="#/reports/${slug}" style="display:block"><div class="panel-b">
        <div class="row" style="gap:10px;align-items:flex-start">
          <span class="avatar avatar-lg">${icon(ic, 20)}</span>
          <span style="flex:1;min-width:0"><b style="display:block;font:600 15px/21px var(--sans)">${esc(L(en, ar))}</b>
            <small class="t-caption dim" style="display:block;margin-top:3px">${esc(L(se, sa))}</small></span>
          <span class="dimmer">${icon('chevR', 16)}</span></div></div></a>`).join('')}</div>
    ${C.inlineAlert('info', L('What these numbers are, and are not', 'ما هي هذه الأرقام وما ليست'),
      L('Individual attendance reports cover group meetings and activities. Event check-in requires a selected eligible event. Individual attendance at Masses and feast-day liturgies is not recorded.',
        'تشمل تقارير الحضور اجتماعات المجموعات وأنشطتها. يتطلّب تسجيل الوصول حدثاً مؤهّلاً محدداً. لا يُسجّل حضور الأفراد في القداديس وليتورجيات الأعياد.'))}`;
}

/* The period scales what is counted over time (visitors, gifts, hours, joins); averages move a little.
   Group rosters and event registrations are a snapshot, so those two reports have no period. */
const PERIODS = [['This month', 'هذا الشهر', '2026-10-01', 0.11, 1.03], ['This year', 'هذه السنة', '2026-01-01', 1, 1],
                 ['Since Easter', 'منذ الفصح', '2026-04-05', 0.66, 0.98]];
const SNAPSHOT = ['groups', 'capacity'], MONEY = ['giving', 'budget'];

function reportDetail(slug) {
  const r = REPORTS.find(x => x[0] === slug) || REPORTS[0];
  const pi = S.ui.repPeriod ?? 1, [pen, par, from, k, a] = PERIODS[pi];
  const fund = MONEY.includes(r[0]) && FUNDS.find(f => f.id === S.ui.repFund) || null;
  const funds = fund ? [fund] : FUNDS;
  const sc = n => Math.round(n * k), av = n => Math.round(n * a);
  const bars = (items, max) => C.barChart(items.map(([label, v]) => ({ label, v: sc(v), max: sc(max), text: num(sc(v)) })));
  const filters = `<div class="toolbar">
      ${SNAPSHOT.includes(r[0]) ? `<span class="chip">${icon('clock', 14)}${L('As of', 'حتى')} ${fmtDate(TODAY)}</span>`
        : C.bgroup(PERIODS.map(p => L(p[0], p[1])), pi, 'repPeriod')}
      ${MONEY.includes(r[0]) ? `<select class="select" style="width:auto" id="repfund" aria-label="${L('Fund', 'الصندوق')}"><option value="">${L('All funds', 'كل الصناديق')}</option>
        ${FUNDS.map(f => `<option value="${f.id}" ${fund === f ? 'selected' : ''}>${esc(L(f.name, f.ar))}</option>`).join('')}</select>` : ''}
      <div style="margin-inline-start:auto;display:flex;gap:6px">
        <button class="btn btn-secondary btn-dense" data-act="pdf">${icon('export', 15)}PDF</button>
        <button class="btn btn-secondary btn-dense" data-act="export">${icon('export', 15)}Excel</button>
        <button class="btn btn-secondary btn-dense" data-act="export">${icon('export', 15)}CSV</button></div>
    </div>`;
  const inPeriod = L(['this month', 'this year', 'since Easter'][pi], ['هذا الشهر', 'هذه السنة', 'منذ الفصح'][pi]);
  const given = funds.reduce((n, f) => n + f.actual, 0);

  const body = {
    attendance: () => panel(L('Group meetings and activities', 'اجتماعات المجموعات وأنشطتها'), table({
      cols:[{label:L('Group','المجموعة')},{label:L('Meeting','الاجتماع')},{label:L('Present','حاضر')},{label:L('Excused','معذور')},{label:L('Absent','غائب')}],
      rows:GROUPS.flatMap(g=>(GROUP_DETAIL[g.id]?.meetings||[]).filter(m=>m.d>=from&&m.d<=new Date().toISOString().slice(0,10)).map(m=>{const values=Object.values(m.attendance||{});return {cells:[esc(L(g.name,g.ar)),fmtDate(m.d),values.filter(v=>v==='present').length,values.filter(v=>v==='excused').length,values.filter(v=>v==='absent').length]};}))
    })),
    giving: () => `<div class="grid g2">
        ${C.kpi({ k: `${L('Given', 'المعطى')} ${inPeriod}`, v: usd(sc(given)), sub: `L.L ${num(sc(given) * RATE.value)}`,
                  delta: fund ? L(fund.name, fund.ar) : L('All funds', 'كل الصناديق'), spark: GIVING_SERIES })}
        ${panel(L('How people give', 'كيف يُعطي الناس'), C.donut(PAYMENT_MIX.map(p => ({ ...p, label: isAr() ? p.labelAr : p.label }))))}
      </div>
      ${panel(L('By fund', 'حسب الصندوق'), C.barChart(funds.map(f => ({ label: L(f.name, f.ar), v: sc(f.actual), max: sc(f.budget), text: usd(sc(f.actual)) }))))}`,
    volunteers: () => panel(`${L('Service hours', 'ساعات الخدمة')} · ${inPeriod}`,
      bars(VOLUNTEERS.map(v => [isAr() ? person(v.p).ar : person(v.p).lat, v.hours]), 140)),
    groups: () => panel(L('Participation by group', 'المشاركة حسب المجموعة'), C.barChart(
      GROUPS.slice(0, 6).map(g => ({ label: L(g.name, g.ar), v: g.members, max: 45, text: String(g.members) })))),
    budget: () => panel(`${L('Budget against actual', 'الموازنة مقابل الفعلي')} · ${inPeriod}`,
      C.barChart(funds.map(f => ({ label: L(f.name, f.ar), v: sc(f.actual), max: sc(f.budget), text: `${usd(sc(f.actual))} / ${usd(sc(f.budget))}` })))),
    capacity: () => panel(L('Event registration and check-in','التسجيل في الأحداث والوصول إليها'), table({
      cols:[{label:L('Event','الحدث')},{label:L('Registered','مسجّل')},{label:L('Checked in','سجّل وصوله')}],
      rows:REGISTRATIONS.filter(r=>EVENTS.some(e=>e.id===r.eventId&&e.kind!=='mass'&&!e.liturgy&&!e.feastLiturgy)).map(r=>({cells:[esc(L(r.event,r.eventAr)),REGISTRANTS.filter(p=>p.registrationId===r.id).length,(CHECKIN.sessions?.[r.eventId]?.rows||[]).length]}))
    })),
    membership: () => panel(`${L('Membership records', 'سجلات الانتساب')} · ${inPeriod}`, bars([
      [L('Current records', 'السجلات الحالية'), PARISH.people], [L('Archived records', 'السجلات المؤرشفة'), ARCHIVED.length]], Math.max(1, PARISH.people, ARCHIVED.length))),
    facilities: () => panel(`${L('Room utilisation', 'استخدام القاعات')} · ${inPeriod}`, C.barChart([
      [L('Parish Hall', 'قاعة الرعية'), 68], [L('Meeting Room 1', 'قاعة اجتماعات ١'), 41], [L('Catechism Room A', 'صف التعليم أ'), 88], [L('Courtyard', 'ساحة الكنيسة'), 22]]
      .map(([label, v]) => ({ label, v: Math.min(av(v), 100), max: 100, text: `${Math.min(av(v), 100)}%` }))))
  }[slug] || (() => panel(L('Report', 'تقرير'), empty('reports', L('Nothing for this period', 'لا شيء لهذه الفترة'), '')));

  return `${pageHead({
      crumbs: [{ label: L('Reports', 'التقارير'), href: '#/reports' }, { label: L(r[2], r[3]) }],
      title: L(r[2], r[3]), sub: L(r[4], r[5]),
      actions: `<button class="btn btn-secondary" data-go="reports">${icon('chevL', 17)}${L('All reports', 'كل التقارير')}</button>
        <button class="btn btn-primary" id="sched">${icon('clock', 17)}${L('Schedule', 'جدولة')}</button>`
    })}
    ${filters}
    ${body()}
    ${panel(L('Definitions and period', 'التعاريف والفترة'), `<dl class="dl">
      <dt>${L('Period', 'الفترة')}</dt><dd>${SNAPSHOT.includes(r[0]) ? `${L('As of', 'حتى')} ${fmtDate(TODAY)}` : `${fmtDate(from)} – ${fmtDate(TODAY)}`}</dd>
      ${fund ? `<dt>${L('Fund', 'الصندوق')}</dt><dd>${esc(L(fund.name, fund.ar))}</dd>` : ''}
      <dt>${L('Counted by', 'من يعدّ')}</dt><dd>${L('An usher, at the offertory', 'مُرشد، عند التقدمة')}</dd>
      <dt>${L('Excludes', 'يستثني')}</dt><dd>${L('Groups smaller than five, so no individual can be identified', 'المجموعات الأصغر من خمسة، كي لا يُعرَّف شخص')}</dd>
      <dt>${L('Your scope', 'نطاقك')}</dt><dd>${esc(L(PARISH.name, PARISH.nameAr))} ${L('only', 'فقط')}</dd></dl>`)}`;
}

reports.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('#repfund')?.addEventListener('change', e => { S.ui.repFund = e.target.value; bus.refresh(); });
  host.querySelector('#sched')?.addEventListener('click', () => openModal({
    title: L('Scheduled delivery', 'إرسال مجدول'),
    sub: L('The report is generated and sent on a schedule, filtered to each recipient’s own permissions.',
           'يُولَّد التقرير ويُرسَل وفق جدول، مرشَّحاً بحسب صلاحيات كل مستلم.'),
    body: `<div class="formgrid">
        <div class="formrow"><label class="label">${L('Every', 'كل')}</label>
          <select class="select"><option>${L('Month', 'شهر')}</option><option>${L('Quarter', 'فصل')}</option>
            <option>${L('Week', 'أسبوع')}</option></select></div>
        <div class="formrow"><label class="label">${L('Format', 'الصيغة')}</label>
          <select class="select"><option>PDF</option><option>Excel</option><option>CSV</option></select></div>
      </div>
      ${C.personPicker(L('Send to', 'إرسال إلى'), 'schedp')}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" data-act="report-schedule">${L('Schedule', 'جدولة')}</button>`,
    onMount(el) { C.wire(el); }
  }));
};

/* ═══════════ audit ═══════════ */
export function audit() {
  const KINDS = { approve: [L('Approval', 'موافقة'), 'success'], create: [L('Created', 'إنشاء'), 'info'],
    publish: [L('Published', 'نشر'), 'info'], settings: [L('Setting', 'إعداد'), 'info'],
    error: [L('Failure', 'فشل'), 'danger'], sensitive: [L('Sensitive access', 'وصول حسّاس'), 'warning'] };
  const ONLY = [null, 'approve', 'sensitive', 'error'], kind = S.ui.auditKind || 0;
  return `${pageHead({
      crumbs: [{ label: L('Administration', 'الإدارة') }, { label: L('Audit trail', 'سجل التدقيق') }],
      title: L('Audit trail', 'سجل التدقيق'),
      sub: L('Who did what, and when. Visible to the parish priest only, and it cannot be edited from inside the application.',
             'من فعل ماذا ومتى. يظهر لكاهن الرعية وحده، ولا يمكن تعديله من داخل التطبيق.'),
      actions: `<button class="btn btn-secondary" data-act="export">${icon('export', 17)}${L('Export', 'تصدير')}</button>`
    })}
    <div class="toolbar">
      <div class="grow" style="max-width:300px">${C.searchClear(L('Person or action', 'الشخص أو الإجراء'), 'asearch', 'data-find')}</div>
      ${C.bgroup([L('All', 'الكل'), L('Approvals', 'الموافقات'), L('Sensitive access', 'وصول حسّاس'), L('Failures', 'الإخفاقات')], kind, 'auditKind')}
    </div>
    ${table({
      cols: [{ label: L('When', 'الوقت'), cls: 'hide-sm', sort: true }, { label: L('Who', 'من'), cls: 'hide-md' },
             { label: L('What', 'ماذا') }, { label: L('Kind', 'النوع'), cls: 'shrink' }],
      rows: AUDIT.filter(a => !kind || a.kind === ONLY[kind]).map(a => ({ attrs: 'data-find-item', cells: [
        `<span class="mono dim" dir="ltr">${a.at}</span>`, a.who && person(a.who) ? who(person(a.who)) : esc(a.actorName || '—'), esc(L(a.what, a.whatAr)),
        pill(KINDS[a.kind][0], KINDS[a.kind][1])]})),
      empty: empty('shield', L('Nothing of this kind was recorded', 'لم يُسجَّل شيء من هذا النوع'), L('Choose All to see every event.', 'اختر «الكل» لرؤية كل الأحداث.'))
    })}
    <div class="find-empty" hidden>${empty('search', L('No event matches', 'لا حدث يطابق'), L('Try a name, or part of the action.', 'جرّب اسماً أو جزءاً من الإجراء.'))}</div>
    ${C.inlineAlert('info', L('Opening a restricted record is itself an event', 'فتح سجل مقيّد هو بحدّ ذاته حدث'),
      L('Staff are told this when the permission is granted, not discovered afterwards.',
        'يُبلَّغ الموظّفون بذلك عند منح الصلاحية، لا يكتشفونه لاحقاً.'))}`;
}
audit.mount = host => { C.wire(host); wireTables(host); };

/* ═══════════ 17 · settings & security ═══════════ */
const SETTABS = () => [['', 'Parish', 'الرعية'], ['currency', 'Currency', 'العملة'], ['languages', 'Languages', 'اللغات'],
                 ['modules', 'Modules', 'الوحدات'], ['roles', 'Roles & permissions', 'الأدوار والصلاحيات'],
                 ['security', 'Security', 'الأمان'], ['data', 'Data & retention', 'البيانات والحفظ'],
                 ['api', 'API & webhooks', 'الواجهة البرمجية']];

export function settings(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Administration', 'الإدارة') }, { label: L('Settings', 'الإعدادات') }],
    title: L('Parish settings', 'إعدادات الرعية'),
    sub: L('Branding, enabled modules, languages, currency, permissions and local workflow rules.',
           'الهوية والوحدات المفعّلة واللغات والعملة والصلاحيات وقواعد العمل المحلية.'),
    actions: `<button class="btn btn-primary" data-act="settings-save">${icon('check', 17)}${L('Save changes', 'حفظ التعديلات')}</button>`
  }) + tabBar('settings', SETTABS(), tab);

  const T = {
    '': () => `<div class="splitview">
      <div class="stack" style="gap:16px">
        ${panel(L('Parish', 'الرعية'), `<div class="formgrid">
          ${C.field({ label: L('Name (English)', 'الاسم (إنكليزي)'), value: PARISH.name })}
          ${C.field({ label: L('Name (Arabic)', 'الاسم (عربي)'), value: PARISH.nameAr, dir: 'rtl', ar: true })}
          ${C.field({ label: L('Eparchy', 'الأبرشية'), value: L(PARISH.eparchy, PARISH.eparchyAr) })}
          ${C.field({ label: L('Patron saint', 'الشفيع'), value: L('Saint Elias the Prophet', 'مار الياس النبي') })}</div>
          ${C.riteSelect()}
          ${C.field({ label: L('Phone', 'الهاتف'), value: PARISH.phone, dir: 'ltr' })}
          ${C.field({ label: L('Address', 'العنوان'), value: L(PARISH.address, PARISH.addressAr) })}`)}
        ${panel(L('Branding', 'الهوية'), C.avatarUpload('parish'))}
      </div>
      <div class="sidecol">${panel(L('Clergy and staff', 'الإكليروس والموظّفون'),
        ['p17', 'p18', 'p4', 'p15'].map(id => `<div class="listrow" style="padding-inline:0">${who(person(id))}
          <span class="grow"></span>${C.iconBtn('edit', L('Edit', 'تعديل'), `data-act="person-edit:${id}"`)}</div>`).join(''), { tight: true })}</div></div>`,

    currency: () => `<div class="splitview">
      <div>${panel(L('Currency and rate', 'العملة والسعر'), `<div class="formgrid">
        <div class="formrow"><label class="label">${L('Leading currency', 'العملة الأساسية')}</label>
          <select class="select" data-pref="cur.lead" aria-label="${L('Leading currency', 'العملة الأساسية')}"><option>USD</option><option>L.L</option></select></div>
        ${C.field({ label: L('Rate (lira to the dollar)', 'السعر (ليرة للدولار)'), value: num(RATE.value), dir: 'ltr',
                    state: is('priest', 'treasurer') ? '' : 'disabled' })}</div>
        <p class="help">${L('Changing the rate applies to new records only. Everything already recorded keeps the rate it was created with.',
          'تغيير السعر يسري على السجلات الجديدة فقط. وما سُجّل يحتفظ بالسعر الذي أُنشئ به.')}</p>
        <div class="stack" style="gap:12px;margin-top:16px">
          ${C.switchRow(L('Warn when the rate is more than 7 days old', 'نبّهني حين يتجاوز عمر السعر ٧ أيام'), { checked: true, pref: 'cur.warn' })}
          ${C.switchRow(L('Show both currencies on every amount', 'إظهار العملتين على كل مبلغ'), { checked: true, pref: 'cur.both' })}
          ${C.switchRow(L('Keep lira gifts as lira, never convert on entry', 'إبقاء تقدمات الليرة ليرة، بلا تحويل عند الإدخال'), { checked: true, pref: 'cur.keepLira' })}</div>`)}
      </div>
      <div class="sidecol">${panel(L('Rate history', 'سجل الأسعار'), `<div class="timeline">
        ${[['89,500', '4 Oct 2026', 'p17'], ['89,200', '12 Sep 2026', 'p15'], ['90,100', '3 Aug 2026', 'p15']]
          .map(([v, d, p], i) => `<div class="tl-item ${i === 0 ? 'accent' : ''}">
            <div class="when">${d} · ${esc(isAr() ? person(p).ar : person(p).lat)}</div>
            <div class="what"><b class="mono">${v}</b> L.L / $</div></div>`).join('')}</div>`)}</div></div>`,

    languages: () => `<div class="splitview">
      <div>${panel(L('Interface languages', 'لغات الواجهة'), `<div class="stack" style="gap:12px">
        ${C.checkRow(L('English', 'الإنكليزية'), { checked: true, pref: 'lang.en' })}
        ${C.checkRow(L('Arabic — with full right-to-left mirroring', 'العربية — مع انعكاس كامل من اليمين إلى اليسار'), { checked: true, pref: 'lang.ar' })}
        ${C.checkRow(L('French', 'الفرنسية'), { note: L('interface strings not yet translated', 'نصوص الواجهة غير مترجمة بعد'), pref: 'lang.fr' })}</div>
        <div class="divider"></div>
        <h4 class="t-ui" style="margin-bottom:10px">${L('Certificates', 'الشهادات')}</h4>
        <p class="help" style="margin-bottom:12px">${L('Certificates can be issued bilingual or trilingual independently of the interface language.',
          'يمكن إصدار الشهادات بلغتين أو ثلاث بمعزل عن لغة الواجهة.')}</p>
        <span data-pref-group="cert.langs">${C.bgroup([L('Arabic', 'عربي'), L('Bilingual', 'ثنائي'), L('Trilingual', 'ثلاثي')], PREFS['cert.langs'] ?? 1)}</span>`)}</div>
      <div class="sidecol">${panel(L('Liturgical calendar', 'الرزنامة الطقسية'), `
        <select class="select" data-pref="cal.rite" aria-label="${L('Liturgical calendar', 'الرزنامة الطقسية')}"><option value="maronite">${L('Maronite', 'مارونية')}</option><option value="melkite">${L('Melkite', 'روم كاثوليك')}</option>
          <option value="orthodox">${L('Greek Orthodox', 'روم أرثوذكس')}</option><option value="armenian">${L('Armenian', 'أرمنية')}</option></select>
        <p class="help" style="margin-top:10px">${L('The calendar in use must be approved by the parish. Feast days drive the gold markers everywhere in the product.',
          'يجب أن توافق الرعية على الرزنامة المستعملة. والأعياد تقود العلامات الذهبية في كل المنتج.')}</p>`)}</div></div>`,

    modules: () => `<div style="max-width:760px">${panel(L('Enabled modules', 'الوحدات المفعّلة'), `
      <div class="stack" style="gap:12px">
        ${[[L('Sacramental registers', 'سجلات الأسرار'), true], [L('Giving and finance', 'التقدمات والمالية'), true],
           [L('Child check-in and safeguarding', 'تسجيل الأطفال والحماية'), true], [L('Music library', 'مكتبة الألحان'), true],
           [L('Member portal', 'بوّابة المؤمنين'), true], [L('Facilities and reservations', 'المرافق والحجوزات'), true],
           [L('Volunteer scheduling', 'جدولة المتطوّعين'), true], [L('Online payments', 'الدفع الإلكتروني'), false],
           [L('AI assistance', 'مساعدة الذكاء الاصطناعي'), false]]
          .map(([l, on], i) => C.switchRow(l, { checked: on, pref: `mod.${i}` })).join('')}</div>
      <p class="help" style="margin-top:14px">${L('A module that is switched off disappears from every rail, for every role.',
        'الوحدة المعطَّلة تختفي من كل شريط ولكل دور.')}</p>`)}</div>`,

    roles: () => `<div class="splitview">
      <div>${panel(L('Permission matrix', 'مصفوفة الصلاحيات'), `<div class="tablescroll"><table class="tbl">
        <thead><tr><th>${L('Action', 'الإجراء')}</th>
          ${Object.values(ROLES).map(r => `<th style="text-align:center">${esc(L(r.en, r.ar))}</th>`).join('')}</tr></thead>
        <tbody>${PERMISSIONS.map(([code, en, ar, roles]) => `<tr>
          <td><b style="font:500 13px/18px var(--sans)">${esc(L(en, ar))}</b>
            <small class="t-caption mono dimmer" style="display:block">${code}</small></td>
          ${Object.keys(ROLES).map(k => `<td style="text-align:center">${roles.includes(k)
            ? `<span style="color:var(--success)">${icon('check', 17)}</span>`
            : '<span class="dimmer">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`, { tight: true })}
      </div>
      <div class="sidecol">
        ${panel(L('Roles', 'الأدوار'), Object.entries(ROLES).map(([k, r]) => `<div class="listrow" style="padding-inline:0;align-items:flex-start">
          <span class="grow"><b>${esc(L(r.en, r.ar))}</b><small style="white-space:normal">${esc(L(r.noteEn, r.noteAr))}</small></span>
          <span class="badge badge-quiet">${r.nav.filter(n => n[0] === 'l').length}</span></div>`).join(''), { tight: true })}
        ${panel(L('Exceptions', 'الاستثناءات'), `<p class="t-body dim" style="font-size:14px">${L(
          'A named person can be granted or denied a single action. An explicit deny always beats a role grant, and every exception carries a reason and a review date.',
          'يمكن منح شخص مسمّى إجراءً واحداً أو حرمانه منه. والمنع الصريح يتقدّم دائماً على منح الدور، ولكل استثناء سبب وتاريخ مراجعة.')}</p>
          ${EXCEPTIONS.map(x => `<div class="listrow" style="padding-inline:0;margin-top:10px">${who(person(x.p))}
            <span class="grow"></span>${pill(`${x.effect} ${x.action}`, x.effect === '+' ? 'success' : 'danger')}
            ${C.iconBtn('close', L('Remove exception', 'إزالة الاستثناء'), `data-act="exception-del:${x.id}"`)}</div>`).join('')}
          <button class="btn btn-secondary btn-dense" style="margin-top:10px" data-act="perm-exception">${icon('plus', 15)}${L('Add exception', 'إضافة استثناء')}</button>`)}
      </div></div>`,

    security: () => `<div class="splitview">
      <div class="stack" style="gap:16px">
        ${panel(L('Authentication', 'المصادقة'), `<div class="stack" style="gap:12px">
          ${C.switchRow(L('Two-factor for administrators', 'تحقّق بخطوتين للمدراء'), { checked: true, pref: 'sec.2fa' })}
          ${C.switchRow(L('Sign out after 30 minutes idle', 'تسجيل الخروج بعد ٣٠ دقيقة خمول'), { checked: true, pref: 'sec.idle' })}
          ${C.switchRow(L('Alert on sign-in from a new device', 'تنبيه عند الدخول من جهاز جديد'), { checked: true, pref: 'sec.newdevice' })}</div>`)}
        ${panel(L('Active sessions and devices', 'الجلسات والأجهزة النشطة'),
          SESSIONS.map((s, si) => `<div class="listrow" style="padding-inline:0">
            ${icon('card', 17, 'dimmer')}<span class="grow"><b>${esc(L(s.device, s.deviceAr))}</b>
              <small>${esc(s.where)} · ${esc(s.at)}</small></span>
            ${s.current ? pill(L('This device', 'هذا الجهاز'), 'success')
              : `<button class="btn btn-danger-quiet btn-dense" data-act="session-revoke:${si}">${L('Revoke', 'إنهاء')}</button>`}</div>`).join(''), { tight: true })}
        ${panel(L('Security alerts', 'تنبيهات الأمان'), SECURITY_ALERTS.map(a =>
          C.inlineAlert(a.level === 'warning' ? 'warning' : 'info', L(a.what, a.whatAr), a.at)).join(''))}
        ${panel(L('Boundaries that are tested, not assumed', 'حدود تُختبَر لا تُفترَض'), `
          <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px">
            ${[[L('Every import and upload is validated before a byte is written', 'يُتحقَّق من كل استيراد ورفع قبل كتابة أي بايت'), 'shield'],
               [L('Rate limits on every endpoint, with failures monitored', 'حدود معدّل على كل وجهة، مع مراقبة الإخفاقات'), 'clock'],
               [L('Two people editing one record: the second is told, and neither silently overwrites the other', 'شخصان يعدّلان سجلاً واحداً: يُبلَّغ الثاني، ولا يمحو أحدهما الآخر بصمت'), 'people'],
               [L('Authorisation boundaries are covered by the test suite, including cross-parish isolation', 'حدود الصلاحيات مغطّاة باختبارات، بما فيها عزل الرعايا')  , 'check']]
              .map(([x, i]) => `<li class="row" style="gap:10px;align-items:flex-start">${icon(i, 17, 'dimmer')}
                <span class="t-caption">${esc(x)}</span></li>`).join('')}</ul>`)}
      </div>
      <div class="sidecol">${panel(L('Field-level protection', 'حماية على مستوى الحقل'), `
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px">
          ${[[L('Medical and allergy alerts', 'التنبيهات الطبية والحساسية'), 'shield'],
             [L('Safeguarding and incident reports', 'تقارير الحماية والحوادث'), 'shield'],
             [L('Donor details and amounts', 'تفاصيل المتبرّعين والمبالغ'), 'give'],
             [L('Pastoral notes', 'الملاحظات الرعوية'), 'notes']]
            .map(([x, i]) => `<li class="row" style="gap:10px;align-items:flex-start">${icon(i, 17, 'dimmer')}
              <span class="t-caption">${esc(x)}</span></li>`).join('')}</ul>
        <div class="divider"></div>
        <p class="t-caption dim">${L('Permissions are checked on the server and again on every export — hiding a screen is never treated as security.',
          'تُفحص الصلاحيات على الخادم ومجدداً عند كل تصدير — ولا يُعتبر إخفاء الشاشة أماناً.')}</p>`)}</div></div>`,

    data: () => `<div class="splitview">
      <div>${panel(L('Retention schedule', 'جدول الحفظ'), table({
        cols: [{ label: L('Record type', 'نوع السجل') }, { label: L('Kept for', 'يُحفظ') }],
        rows: RETENTION.map(([en, ar, ke, ka]) => ({ cells: [`<b>${esc(L(en, ar))}</b>`, `<span class="dim">${esc(L(ke, ka))}</span>`]}))
      }), { tight: true })}</div>
      <div class="sidecol">
        ${panel(L('Where this parish is saved', 'أين تُحفظ هذه الرعية'), `<p class="t-body dim" style="font-size:14px;line-height:22px">${L(
          'Changes are saved to the parish database on the server and are available to authorized accounts after a reload or from another computer.',
          'تُحفظ التغييرات في قاعدة بيانات الرعية على الخادم، وتبقى متاحة للحسابات المخوّلة بعد إعادة التحميل أو من حاسوب آخر.')}</p>
          <dl class="dl" style="margin-top:12px">
            <dt>${L('Last saved', 'آخر حفظ')}</dt><dd class="mono">${savedAt() ? new Date(savedAt()).toLocaleString(isAr() ? 'ar-LB' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : L('Not yet — nothing has changed', 'ليس بعد — لم يتغيّر شيء')}</dd>
            <dt>${L('Size', 'الحجم')}</dt><dd class="mono">${Math.max(1, Math.round(savedSize() / 1024))} KB</dd></dl>
          <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-dense" data-act="data-export">${icon('export', 15)}${L('Download data snapshot', 'تنزيل صورة من البيانات')}</button>
          </div>
          <div class="divider"></div>
          <p class="help">${L('Restoring a database backup requires a reviewed administrator operation.', 'استعادة نسخة قاعدة البيانات تتطلب إجراءً إدارياً مُراجعاً.')}</p>`)}
        ${panel(L('Permanent deletion', 'الحذف النهائي'), `<p class="t-body dim" style="font-size:14px">${L(
          'Permanent deletion is a reviewed request, not a button. The reviewer is shown exactly what would be lost before they can confirm, and sacramental records are never deletable.',
          'الحذف النهائي طلب يُراجَع لا زرّ. ويُعرَض على المراجع ما سيُفقَد قبل التأكيد، وسجلات الأسرار غير قابلة للحذف أبداً.')}</p>
          <button class="btn btn-danger-quiet" style="margin-top:12px;width:100%" id="perm">${icon('trash', 16)}${L('Review deletion requests', 'مراجعة طلبات الحذف')}</button>`)}
      </div></div>`,

    api: () => `<div class="splitview">
      <div>${panel(L('Webhooks', 'الخطّافات'), table({
        cols: [{ label: L('Endpoint', 'الوجهة') }, { label: L('Events', 'الأحداث'), cls: 'hide-sm' },
               { label: L('Scope', 'النطاق'), cls: 'shrink' }, { label: L('Active', 'مفعّل'), cls: 'shrink' }],
        rows: WEBHOOKS.map((w, wi) => ({ cells: [`<span class="mono" style="font-size:12px">${esc(w.url)}</span>`,
          `<span class="row" style="gap:4px;flex-wrap:wrap">${w.events.map(e => `<span class="chip">${esc(e)}</span>`).join('')}</span>`,
          pill(w.scope, 'info'),
          `<label class="switch"><input type="checkbox" ${w.active ? 'checked' : ''} data-act="wh-toggle:${wi}"><span class="sr">${L('Active', 'مفعّل')}</span></label>`]}))
      }), { tight: true })}
      <button class="btn btn-secondary" style="margin-top:16px" data-act="webhook-add">${icon('plus', 17)}${L('Add webhook', 'إضافة خطّاف')}</button></div>
      <div class="sidecol">${panel(L('API credentials', 'بيانات الاعتماد'), `
        ${PARISH.apiKeyRevoked
          ? C.inlineAlert('warning', L('The reporting key is revoked', 'مفتاح التقارير ملغى'), L('The eparchy link is stopped until a new key is issued.', 'رابط الأبرشية متوقّف حتى إصدار مفتاح جديد.'))
          : C.field({ label: L('Eparchy reporting key', 'مفتاح تقارير الأبرشية'), value: 'pl_live_••••••••••••' + (PARISH.apiKey || '7a21'), state: 'disabled', dir: 'ltr' })}
        <div class="row" style="gap:8px;margin-top:12px"><button class="btn btn-secondary btn-dense" data-act="key-rotate">${PARISH.apiKeyRevoked ? L('Issue a new key', 'إصدار مفتاح جديد') : L('Rotate', 'تدوير')}</button>
          ${PARISH.apiKeyRevoked ? '' : `<button class="btn btn-danger-quiet btn-dense" data-act="key-revoke">${L('Revoke', 'إلغاء')}</button>`}</div>
        <p class="t-caption dim" style="margin-top:12px">${L(
          'Credentials are scoped to named events and are auditable like any other access. Rate limits apply to every endpoint.',
          'بيانات الاعتماد محصورة بأحداث مسمّاة وقابلة للتدقيق كأي وصول آخر. وتُطبَّق حدود المعدّل على كل وجهة.')}</p>`)}</div></div>`
  };

  return head + (T[tab] || T[''])();
}

settings.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('#perm')?.addEventListener('click', reviewDeletions);
};

/* Deletion requests made from People → Archived. Approving is permanent and typed; declining keeps the archived record. */
function reviewDeletions() {
  const reqs = ARCHIVED.filter(p => p.deletionRequested);
  openModal({
    title: L('Deletion requests', 'طلبات الحذف'),
    sub: reqs.length ? L('Each record was archived first. Deleting removes it for good; sacramental entries stay in the registers.',
                         'أُرشف كل سجل أولاً. والحذف يزيله نهائياً؛ وتبقى قيود الأسرار في السجلات.') : '',
    body: reqs.length ? reqs.map(p => `<div class="listrow" style="padding-inline:0">${who(p)}<span class="grow"></span>
        <button class="btn btn-secondary btn-dense" data-del-no="${p.id}">${L('Decline', 'رفض')}</button>
        <button class="btn btn-danger btn-dense" data-del-yes="${p.id}">${L('Delete', 'حذف')}</button></div>`).join('')
      : empty('check', L('No deletion requests', 'لا طلبات حذف'), L('They are made from People → Archived, after a record has been archived.', 'تُقدَّم من المؤمنون ← المؤرشفون، بعد أرشفة السجل.'),
          `<a class="btn btn-secondary btn-dense" href="#/people/archived">${L('Open archived records', 'فتح السجلات المؤرشفة')}</a>`),
    foot: `<button class="btn btn-secondary" data-close style="margin-inline-start:auto">${L('Close', 'إغلاق')}</button>`,
    onMount(el) {
      el.querySelectorAll('[data-del-no]').forEach(b => b.addEventListener('click', () => {
        const p = ARCHIVED.find(x => x.id === b.dataset.delNo); if (!p) return;
        delete p.deletionRequested; bus.refresh(); reviewDeletions();
        toast(L('Request declined', 'رُفض الطلب'), L(`${p.lat} stays archived.`, `يبقى ${p.ar} مؤرشفاً.`));
      }));
      el.querySelectorAll('[data-del-yes]').forEach(b => b.addEventListener('click', () => confirmDeletion(ARCHIVED.find(x => x.id === b.dataset.delYes))));
    }
  });
}

function confirmDeletion(p) {
  if (!p) return;
  openModal({
    title: L('Permanently delete this record?', 'حذف هذا السجل نهائياً؟'),
    sub: L('This cannot be undone.', 'لا يمكن التراجع.'),
    body: `<div class="formrow"><label class="label" for="typed">${L('Type', 'اكتب')} <b>${esc(p.lat)}</b> ${L('to confirm', 'للتأكيد')}</label>
        <input class="input" id="typed" autocomplete="off" placeholder="${esc(p.lat)}"></div>
      <span class="help help-error" id="typedhelp">${L('The name does not match yet.', 'الاسم لا يطابق بعد.')}</span>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Keep record', 'الاحتفاظ بالسجل')}</button>
      <button class="btn btn-danger" id="del" disabled style="margin-inline-start:auto">${L('Delete permanently', 'حذف نهائي')}</button>`,
    onMount(el) {
      const inp = el.querySelector('#typed'), btn = el.querySelector('#del'), help = el.querySelector('#typedhelp');
      inp.addEventListener('input', () => {
        const okk = inp.value.trim() === p.lat;
        btn.disabled = !okk; help.classList.toggle('help-error', !okk); help.classList.toggle('help-ok', okk);
        help.textContent = okk ? L('Match.', 'مطابق.') : L('The name does not match yet.', 'الاسم لا يطابق بعد.');
      });
      btn.addEventListener('click', () => {
        ARCHIVED.splice(ARCHIVED.indexOf(p), 1); delete PHOTOS[p.id];
        closeOverlays(); bus.refresh();
        toast(L('Record deleted permanently', 'حُذف السجل نهائياً'), p.lat, 'success');
      });
    }
  });
}

/* ═══════════ the living design system ═══════════
   Sheets 02 (tokens), 03 (controls) and 04 (patterns) rendered from the same
   CSS and components the product uses, so the library cannot drift from the app. */
const SGTABS = () => [['', 'Tokens', 'الرموز'], ['controls', 'Controls', 'الضوابط'],
                ['lebanon', 'Lebanon fields', 'حقول لبنان'], ['patterns', 'Patterns', 'الأنماط'],
                ['data', 'Data & charts', 'البيانات والرسوم']];

export function styleguide(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Administration', 'الإدارة') }, { label: L('Design system', 'نظام التصميم') }],
    title: L('ParishLife design system', 'نظام تصميم «حياة الرعية»'),
    sub: L('Every token, control and pattern from the library, rendered by the same CSS the product uses. If a specimen here is wrong, the product is wrong too.',
           'كل رمز وضابط ونمط من المكتبة، مرسوماً بالـCSS نفسه الذي يستعمله المنتج. وإن كان النموذج هنا خاطئاً فالمنتج خاطئ أيضاً.'),
    actions: `<button class="btn btn-secondary" data-act="print">${icon('print', 17)}${L('Print sheet', 'طباعة الورقة')}</button>`
  }) + tabBar('styleguide', SGTABS(), tab);

  const spec = (title, note, body) => `<section class="panel"><div class="panel-h">
      <h3>${esc(title)}</h3>${note ? `<span class="t-caption dim" style="margin-inline-start:auto">${esc(note)}</span>` : ''}</div>
    <div class="panel-b">${body}</div></section>`;

  const swatch = (name, hex, use) => `<div class="card card-flat" style="padding:0;overflow:hidden">
      <div style="height:64px;background:${hex};border-bottom:1px solid var(--border)"></div>
      <div style="padding:12px 14px"><b style="font:500 13px/18px var(--sans)">${esc(name)}</b>
        <div class="mono t-caption dim" dir="ltr">${hex}</div>
        <div class="t-caption dimmer" style="margin-top:4px">${esc(use)}</div></div></div>`;

  const T = {
    '': () => `
      ${spec(L('Colour', 'اللون'), L('Shades of blue, brown and yellow throughout the product', 'درجات الأزرق والبني والأصفر في جميع أجزاء التطبيق'), `
        <div class="gridcards" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">
          ${swatch(L('Navy', 'كحلي'), '#3D4161', L('Actions, rail and body text', 'الأفعال والشريط ونص المتن'))}
          ${swatch(L('Light blue', 'أزرق فاتح'), '#DCEEFF', L('Soft fills and blue accents', 'التعبئة الناعمة واللمسات الزرقاء'))}
          ${swatch(L('White', 'أبيض'), '#FFFFFF', L('Cards, forms and print', 'البطاقات والاستمارات والطباعة'))}
          ${swatch(L('Yellow', 'أصفر'), '#F4CF56', L('Buttons, selected navigation and highlights', 'الأزرار والتنقّل المحدّد والإبراز'))}
          ${swatch(L('Brown', 'بني'), '#765039', L('Secondary text, accents and charts', 'النص الثانوي واللمسات والرسوم'))}
        </div>
        <div class="divider"></div>
        <div class="gridcards" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">
          ${swatch(L('Page blue', 'أزرق الصفحة'), '#EAF4FF', L('Page background', 'خلفية الصفحة'))}
          ${swatch(L('Soft yellow', 'أصفر ناعم'), '#FFF5CC', L('Table headers and summary cards', 'رؤوس الجداول وبطاقات الملخّص'))}
          ${swatch(L('Blue accent', 'أزرق بارز'), '#8EC5F4', L('Charts and small marks', 'الرسوم والعلامات الصغيرة'))}
          ${swatch(L('Blue border', 'حدّ أزرق'), '#9BC6EC', L('Control outlines', 'حدود الضوابط'))}
        </div>
        <div class="divider"></div>
        <div class="row" style="gap:10px;flex-wrap:wrap">
          ${status('approved')}${status('failed')}${status('pending')}${status('awaiting-approval')}${status('open')}${status('sent')}${status('scheduled')}${pill(L('Paused', 'متوقّف'), 'warning', 'st-pause')}</div>
        <p class="t-caption dim" style="margin-top:14px">${L(
          'Status is never carried by colour alone: every status pill pairs an icon with a word, every alert pairs a tint with an icon and a heading.',
          'الحالة لا تُحمَل باللون وحده أبداً: كل شارة حالة تجمع أيقونة وكلمة، وكل تنبيه يجمع لوناً وأيقونة وعنواناً.')}</p>`)}

      ${spec(L('Type', 'الخطّ'), L('Six sizes, two families', 'ستة أحجام وعائلتان'), `
        <div class="tablescroll"><table class="tbl">
          <thead><tr><th>${L('Token', 'الرمز')}</th><th>${L('Inter / English', 'إنتر / إنكليزي')}</th>
            <th>${L('Plex Arabic', 'بلكس عربي')}</th><th>${L('Spec', 'المواصفة')}</th></tr></thead>
          <tbody>${[['t-display', 'Saint Elias', 'مار الياس', '32 / 40 / 600'],
                    ['t-heading', 'Baptism register', 'سجل المعمودية', '24 / 32 / 600'],
                    ['t-sub', 'Counting session 214', 'جلسة العدّ ٢١٤', '20 / 28 / 600'],
                    ['t-body', 'Sunday 10:30 Mass, in the upper church.', 'قدّاس الأحد ١٠:٣٠ في الكنيسة العليا.', '16 / 26 / 400'],
                    ['t-ui', 'Buttons, table cells, nav, inputs', 'الأزرار وخلايا الجدول والتنقل', '14 / 20 / 500'],
                    ['t-caption', 'Helper text, timestamps, hints.', 'نص مساعد وطوابع زمنية', '12 / 18 / 400']]
            .map(([cls, en, ar, sp]) => `<tr><td><span class="mono t-caption">${cls}</span></td>
              <td><span class="${cls}">${esc(en)}</span></td>
              <td><span class="${cls}" style="font-family:var(--arabic)">${esc(ar)}</span></td>
              <td><span class="mono t-caption dim">${sp}</span></td></tr>`).join('')}</tbody></table></div>
        <div class="divider"></div>
        <div class="row" style="gap:28px;flex-wrap:wrap">
          <div><div class="t-caption dim">${L('Numerals', 'الأرقام')}</div>
            <div class="mono tnum" style="font-size:20px" dir="ltr">1,240,000 · 04/10/2026</div></div>
          <div><div class="t-caption dim">${L('Weights in use', 'الأوزان المستعملة')}</div>
            <div style="font-size:16px"><span style="font-weight:400">400</span> · <span style="font-weight:500">500</span> · <span style="font-weight:600">600</span></div></div>
        </div>
        <p class="t-caption dim" style="margin-top:12px">${L(
          'Tabular figures in every table, amount and register number, in both languages. Western digits throughout. No italics anywhere — italic Arabic does not exist.',
          'أرقام جدولية في كل جدول ومبلغ ورقم قيد، وباللغتين. أرقام غربية في كل مكان. ولا مائل في أي موضع — فالمائل العربي غير موجود.')}</p>`)}

      ${spec(L('Space, radius, elevation', 'المسافة والاستدارة والارتفاع'), L('Everything lands on 8', 'كل شيء على مضاعفات ٨'), `
        <div class="grid g3" style="gap:24px">
          <div><div class="t-caption dim" style="margin-bottom:10px">${L('Spacing scale', 'سلّم المسافات')}</div>
            ${[[4, 'icon→label'], [8, 'field→helper'], [16, 'between fields'], [24, 'card padding'],
               [32, 'page gutter'], [48, 'between sections'], [64, 'page top/bottom']]
              .map(([n, u]) => `<div class="row" style="gap:10px;margin-bottom:6px">
                <span class="mono t-caption" style="width:26px">${n}</span>
                <span style="height:8px;width:${n * 1.6}px;background:var(--primary);border-radius:2px"></span>
                <span class="t-caption dimmer">${u}</span></div>`).join('')}</div>
          <div><div class="t-caption dim" style="margin-bottom:10px">${L('Radius', 'الاستدارة')}</div>
            ${[['6px', 'inputs'], ['10px', 'cards, buttons'], ['14px', 'modals, drawers'], ['999px', 'pills, avatars']]
              .map(([r, u]) => `<div class="row" style="gap:10px;margin-bottom:8px">
                <span style="width:34px;height:26px;border:1px solid var(--border-strong);border-radius:${r};background:var(--surface)"></span>
                <span class="mono t-caption">${r}</span><span class="t-caption dimmer">${u}</span></div>`).join('')}</div>
          <div><div class="t-caption dim" style="margin-bottom:10px">${L('Elevation', 'الارتفاع')}</div>
            ${[['0 · line', 'none', '1px border'], ['1 · card', 'var(--e1)', 'cards'],
               ['2 · menu', 'var(--e2)', 'menus, popovers'], ['3 · modal', 'var(--e3)', 'modals']]
              .map(([n, sh, u]) => `<div class="row" style="gap:10px;margin-bottom:10px">
                <span style="width:34px;height:26px;border:1px solid var(--border);border-radius:6px;background:var(--surface);box-shadow:${sh}"></span>
                <span class="t-caption">${n}</span><span class="t-caption dimmer">${u}</span></div>`).join('')}</div>
        </div>
        <div class="divider"></div>
        <div class="row" style="gap:28px;flex-wrap:wrap">
          ${[[40, L('button height', 'ارتفاع الزرّ')], [40, L('input height', 'ارتفاع الحقل')],
             [44, L('min touch target', 'أصغر هدف لمس')], [48, L('table row', 'صف الجدول')],
             [64, L('top bar', 'الشريط العلوي')], [264, L('sidebar expanded', 'الشريط الموسّع')],
             [72, L('sidebar collapsed', 'الشريط المطوي')], [20, L('icon, 1.5 stroke', 'أيقونة، سماكة ١٫٥')]]
            .map(([n, u]) => `<div><div class="mono" style="font-size:19px;font-variant-numeric:tabular-nums">${n}</div>
              <div class="t-caption dim">${esc(u)}</div></div>`).join('')}</div>`)}`,

    controls: () => `
      ${spec(L('Buttons', 'الأزرار'), '40px · 10px radius · 14/500', `
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" data-act="spec-save">${L('Save record', 'حفظ السجل')}</button>
          <button class="btn btn-secondary" data-act="spec-cancel">${L('Cancel', 'إلغاء')}</button>
          <button class="btn btn-ghost" data-go="people">${L('View all', 'عرض الكل')}</button>
          <button class="btn btn-danger" data-act="spec-delete">${L('Delete', 'حذف')}</button>
          <button class="btn btn-danger-quiet" data-act="archive-specimen">${L('Archive', 'أرشفة')}</button>
          <button class="btn btn-primary" disabled>${L('Disabled', 'معطّل')}</button>
          <button class="btn btn-primary" disabled aria-busy="true" style="opacity:1"><span class="spin"></span>${L('Saving…', 'يُحفظ…')}</button>
        </div>
        <div class="divider"></div>
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
          ${C.splitBtn(L('New parishioner', 'مؤمن جديد'), 'sg1')}
          ${C.bgroup([L('Month', 'شهر'), L('Week', 'أسبوع'), L('Day', 'يوم')], 0)}
          ${C.iconBtn('print', L('Print certificate', 'طباعة الشهادة'), 'data-act="print"')}
          ${C.iconBtn('trash', L('Archive', 'أرشفة'), 'data-act="archive-specimen"')}
        </div>
        <div class="divider"></div>
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-secondary btn-dense" data-act="spec-save">32 ${L('dense', 'كثيف')}</button>
          <button class="btn btn-secondary" data-act="spec-save">40 ${L('default', 'افتراضي')}</button>
          <button class="btn btn-secondary btn-touch" data-act="spec-save">48 ${L('touch', 'لمس')}</button>
        </div>`)}

      ${spec(L('Text fields', 'الحقول النصّية'), L('40px · 6px radius · label above, helper below', '٤٠ بكسل · استدارة ٦ · التسمية فوق والمساعدة تحت'), `
        <div class="formgrid">
          ${C.field({ label: L('English name', 'الاسم الإنكليزي'), req: true, value: 'Georges Haddad',
                      help: L('As it appears on the ID card.', 'كما يظهر على الهوية.') })}
          ${C.field({ label: L('English name', 'الاسم الإنكليزي'), req: true, value: 'G', state: 'error',
                      help: L('Enter at least 2 characters.', 'أدخل حرفين على الأقل.'), helpTone: 'help-error' })}
          ${C.field({ label: L('Envelope number', 'رقم المظروف'), value: '0142', state: 'ok',
                      help: L('Available.', 'متاح.'), helpTone: 'help-ok', tail: `<span style="color:var(--success)">${icon('check', 16)}</span>` })}
          ${C.field({ label: L('English name', 'الاسم الإنكليزي'), value: 'Georges Haddad', state: 'disabled',
                      help: L('Locked while the record is archived.', 'مقفل ما دام السجل مؤرشفاً.') })}
          ${C.field({ label: L('Envelope number', 'رقم المظروف'), value: '0142', state: 'loading',
                      help: L('Checking if this envelope is free…', 'يجري التحقّق من توفّر المظروف…') })}
        </div>
        ${C.textarea({ label: L('Pastoral note', 'ملاحظة رعوية'), id: 'sgta', max: 500,
          value: 'Visited at home after the hospital stay. Asked for the parish to remember his mother at Sunday Mass.',
          help: L('Visible to the priest only.', 'تظهر للكاهن وحده.') })}
        <div class="formgrid">
          ${C.stepper({ label: L('Seats in the hall', 'المقاعد في القاعة'), value: 120, id: 'sgst',
            help: L('Steppers are 38px wide so a thumb can hit them.', 'أزرار الزيادة ٣٨ بكسل ليصلها الإبهام.') })}
          <div class="formrow"><label class="label">${L('Find a parishioner', 'ابحث عن مؤمن')}</label>
            ${C.searchClear(L('Searches Arabic and English name at once', 'يبحث في الاسمين معاً'), 'sgsc')}</div>
        </div>`)}

      ${spec(L('Choosing', 'الاختيار'), L('Every option row is 44px', 'كل صف خيار ٤٤ بكسل'), `
        <div class="formgrid">
          <div class="formrow"><label class="label">${L('Fund', 'الصندوق')}</label>
            <select class="select">${FUNDS.map(f => `<option>${esc(L(f.name, f.ar))}</option>`).join('')}</select></div>
          ${C.personPicker(L('Person — autocomplete with avatar', 'شخص — إكمال تلقائي مع صورة'), 'sgpp')}
        </div>
        ${C.chipField(L('Groups', 'المجموعات'), [L('Choir', 'الجوقة'), L('Youth', 'الشبيبة'), L('Catechism G4', 'تعليم ٤')])}
        <div class="divider"></div>
        <div class="grid g3" style="gap:20px">
          <div><div class="t-caption dim" style="margin-bottom:10px">${L('Marital status', 'الحالة الاجتماعية')}</div>
            <div class="stack" style="gap:8px">
              ${C.checkRow(L('Married', 'متزوّج'), { type: 'radio', checked: true })}
              ${C.checkRow(L('Single', 'أعزب'), { type: 'radio' })}
              ${C.checkRow(L('Widowed', 'أرمل'), { type: 'radio' })}
              ${C.checkRow(L('Annulled', 'مُبطَل'), { type: 'radio', note: L('needs a chancery record', 'يحتاج قيد المطرانية') })}</div></div>
          <div><div class="t-caption dim" style="margin-bottom:10px">${L('Consent', 'الموافقة')}</div>
            <div class="stack" style="gap:8px">
              ${C.checkRow(L('Announcements on WhatsApp', 'الإعلانات على واتساب'), { checked: true })}
              ${C.checkRow(L('Printed parish directory', 'الدليل المطبوع'))}
              ${C.checkRow(L('Some family members opted in', 'وافق بعض أفراد العائلة'), { indet: true })}</div></div>
          <div><div class="t-caption dim" style="margin-bottom:10px">${L('Toggles', 'المفاتيح')}</div>
            <div class="stack" style="gap:10px">
              ${C.switchRow(L('Show in member portal', 'الظهور في البوّابة'), { checked: true })}
              ${C.switchRow(L('Weekly giving digest', 'ملخّص التقدمات'), { checked: true })}
              ${C.switchRow(L('Card gateway', 'بوابة البطاقات'), { note: L('not connected', 'غير موصولة') })}</div></div>
        </div>`)}

      ${spec(L('Dates, time and uploads', 'التواريخ والوقت والرفع'), L('Gregorian, feast days marked', 'ميلادية، مع علامات الأعياد'), `
        <div class="grid g2" style="gap:24px;align-items:start">
          <div>${C.datePicker(2026, 9, 4)}</div>
          <div>${C.timeField()}${C.dateRange()}</div>
        </div>
        <div class="divider"></div>${C.dropzone('sgdz', { specimen: true })}
        <div class="divider"></div>${C.avatarUpload()}
        <div class="divider"></div>${C.richText()}`)}

      ${spec(L('Dropdowns and menus', 'القوائم المنسدلة'), L('8px offset · 10px radius · elevation 2', 'إزاحة ٨ · استدارة ١٠ · ارتفاع ٢'), `
        <div class="grid g3" style="gap:20px;align-items:start">
          ${C.filterMenu(L('Status', 'الحالة'), [[L('Active', 'نشط'), 1284, true], [L('Visitor', 'زائر'), 96, true],
            [L('Moved away', 'انتقل'), 41, false], [L('Deceased', 'متوفّى'), 218, false], [L('Archived', 'مؤرشف'), 7, false]])}
          ${C.kebabMenu()}
          ${C.ratePopover(50)}
        </div>
        <div class="divider"></div>${C.bulkBar(14)}
        <div class="divider"></div>
        <div class="grid g2" style="gap:20px;align-items:start">
          <div><div class="t-caption dim" style="margin-bottom:10px">${L('Searchable combobox — grouped, keyboard-driven', 'صندوق بحث — مجمَّع، بالكيبورد')}</div>
            <div class="ac-list" style="position:static;max-height:none">
              <div class="ac-group">${L('Sacraments', 'الأسرار')}</div>
              <button class="ac-opt" aria-selected="true" data-go="sacraments">${icon('sacr', 17)}
                <span><b>${L('Baptism register', 'سجل المعمودية')}</b></span><span class="kbd" style="margin-inline-start:auto">↵</span></button>
              <button class="ac-opt" data-go="sacraments">${icon('plus', 17)}<span><b>${L('New baptism record', 'قيد معمودية جديد')}</b></span></button>
              <div class="ac-group">${L('Certificates', 'الشهادات')}</div>
              <button class="ac-opt" data-go="certificate/sc1">${icon('doc', 17)}
                <span><b>${L('Baptism certificate — Arabic', 'إفادة معمودية — عربي')}</b></span></button>
            </div>
            <p class="t-caption dimmer" style="margin-top:8px">↑↓ ${L('move', 'تنقّل')} · ↵ ${L('open', 'فتح')} · esc ${L('close', 'إغلاق')}</p></div>
          <div><div class="t-caption dim" style="margin-bottom:10px">${L('Command palette', 'لوحة الأوامر')}</div>
            <button class="btn btn-secondary" id="sgcmd">${icon('search', 17)}${L('Open it', 'افتحها')}
              <span class="kbd" style="margin-inline-start:6px">⌘K</span></button>
            <p class="t-caption dimmer" style="margin-top:8px">${L('Searches people, records, pages and actions.', 'تبحث في الأشخاص والسجلات والصفحات والإجراءات.')}</p></div>
        </div>`)}`,

    lebanon: () => `
      ${spec(L('Currency — dual USD / LBP', 'العملة — دولار/ليرة'), L('The rate travels with the amount', 'السعر يسافر مع المبلغ'), `
        ${C.currencyField({ label: L('Amount', 'المبلغ'), value: '1,250.00', stale: true, id: 'sgcur' })}
        ${C.splitCurrency()}
        <div class="divider"></div>
        <div class="row" style="gap:28px;flex-wrap:wrap">
          ${amount(1250, { showRate: true, cls: 'amount-lg' })}
          ${amount(50, { showRate: true })}
          ${amount(50, { cls: 'amount-sm' })}
        </div>`)}
      ${spec(L('Phone — +961 prefix control', 'الهاتف — مقدّمة ‎+961'), '', `
        <div class="formgrid">
          ${C.phoneField({ label: L('Mobile', 'الخلوي'), value: '3 421 887' })}
          ${C.phoneField({ label: L('Mobile', 'الخلوي'), value: '3 421', state: 'error', id: 'sgph2' })}
        </div>`)}
      ${spec(L('Address — cascading select', 'العنوان — اختيار متسلسل'), L('No postal code field exists', 'لا حقل رمز بريدي'), C.addressCascade())}
      ${spec(L('Bilingual name pair and rite', 'ثنائي الاسم والطقس'), L('Arabic is the record of truth', 'العربي هو سجل الحقيقة'),
        C.namePair() + C.riteSelect())}
      ${spec(L('Channel order and direction', 'ترتيب القنوات والاتجاه'), '', `
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <span class="chip chip-on">WhatsApp <span class="t-caption" style="margin-inline-start:6px;opacity:.75">${L('default', 'افتراضي')}</span></span>
          ${icon('arrowR', 16, 'dimmer')}<span class="chip">SMS <span class="t-caption" style="margin-inline-start:6px;opacity:.75">${L('fallback', 'احتياط')}</span></span>
          ${icon('arrowR', 16, 'dimmer')}<span class="chip">${L('Email — last', 'بريد — أخيراً')}</span></div>
        <div class="divider"></div>
        <div class="row" style="gap:10px"><span class="chip mono" dir="ltr">dir=ltr</span><span class="chip chip-on mono" dir="ltr">dir=rtl</span></div>
        <p class="t-caption dim" style="margin-top:12px">${L(
          'Arabic mirrors the sidebar side, table column order, chart axis, drawer entry edge, chevrons and progress fill. Clocks, logos, media controls and the play triangle never flip. Numerals and amounts stay left-to-right in both.',
          'العربية تعكس جهة الشريط وترتيب الأعمدة ومحور الرسم وحافة الدرج والأسهم وامتلاء التقدّم. الساعات والشعارات وأزرار الوسائط ومثلّث التشغيل لا تنعكس أبداً. والأرقام والمبالغ تبقى من اليسار إلى اليمين.')}</p>`)}`,

    patterns: () => `
      ${spec(L('Toasts and alerts', 'التنبيهات'), L('Every mutation toasts; reversible ones carry Undo', 'كل تعديل يُنبّه؛ والقابل للتراجع يحمل «تراجع»'), `
        <div class="stack" style="gap:10px">
          ${C.inlineAlert('warning', L('This family has two records', 'لهذه العائلة سجلّان'),
            L('Haddad (Hadath) and Hadad (Hadath) look like the same household.', 'يبدو أن «حدّاد» و«حداد» في الحدث العائلة نفسها.'),
            `<button data-go="people/duplicates">${L('Compare and merge', 'قارن وادمج')}</button>`)}
          ${C.inlineAlert('warning', L('The hall is already booked at this time', 'القاعة محجوزة في هذا الوقت'),
            L('Catechism grade 4, Saturday 15:00–16:30. You can still save and let the two overlap.', 'تعليم مسيحي ٤، السبت ١٥:٠٠–١٦:٣٠. يمكنك الحفظ والسماح بالتداخل.'))}
          ${C.inlineAlert('danger', L('4 fields need attention before saving', '٤ حقول تحتاج انتباهاً قبل الحفظ'),
            L('Arabic name, date of birth, rite and the register page number.', 'الاسم العربي وتاريخ الولادة والطقس ورقم صفحة السجل.'))}
          ${C.inlineAlert('success', L('Second person has verified this batch', 'تحقّق شخص ثانٍ من هذه الدفعة'),
            L('Rita Nassar counted the same totals at 19:32. Ready to close.', 'عدّت ريتا نصّار المجاميع نفسها الساعة ١٩:٣٢.'))}
        </div>
        <div class="divider"></div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-dense" id="tst1">${L('Toast — archived, with Undo', 'تنبيه — أُرشف، مع تراجع')}</button>
          <button class="btn btn-secondary btn-dense" id="tst2">${L('Toast — queued', 'تنبيه — في الانتظار')}</button>
          <button class="btn btn-secondary btn-dense" id="tst3">${L('Toast — saved locally', 'تنبيه — حُفظ محلياً')}</button>
          <button class="btn btn-secondary btn-dense" id="tst4">${L('Toast — send failed', 'تنبيه — فشل الإرسال')}</button></div>`)}

      ${spec(L('Modals, drawers, guards', 'النوافذ والأدراج والحواجز'), '', `
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" id="sgm1">${L('Confirmation modal', 'نافذة تأكيد')}</button>
          <button class="btn btn-secondary" id="sgm2">${L('Destructive — typed confirmation', 'حذف — تأكيد بالكتابة')}</button>
          <button class="btn btn-secondary" id="sgm3">${L('Side drawer — 420', 'درج جانبي — ٤٢٠')}</button>
          <button class="btn btn-secondary" id="sgm4">${L('Side drawer — 720', 'درج جانبي — ٧٢٠')}</button>
          <button class="btn btn-secondary" id="sgm5">${L('Unsaved-changes guard', 'حاجز التغييرات غير المحفوظة')}</button>
        </div>
        <div class="divider"></div>
        <div class="row" style="gap:20px;flex-wrap:wrap;align-items:center">
          ${C.iconBtn('print', L('Print certificate', 'طباعة الشهادة'), 'data-act="print"')}
          <span class="t-caption dim">${L('Every icon-only button has a tooltip. 400ms delay.', 'كل زرّ أيقونة له تلميح. تأخير ٤٠٠ مللي ثانية.')}</span>
        </div>`)}

      ${spec(L('Progress, spinner, skeleton', 'التقدّم والدوران والهيكل'), L('Skeletons mirror the real 48px row height', 'الهياكل تطابق ارتفاع الصف ٤٨ بكسل'), `
        <div class="grid g3" style="gap:20px;align-items:start">
          <div><div class="t-caption dim" style="margin-bottom:8px">${L('Importing — step 3 of 4', 'الاستيراد — الخطوة ٣ من ٤')}</div>
            <span class="progress"><i style="width:60%"></i></span>
            <div class="mono t-caption dim" style="margin-top:6px">248 / 412</div></div>
          <div><div class="t-caption dim" style="margin-bottom:8px">${L('Budget consumed', 'الموازنة المستهلكة')}</div>
            <span class="progress accent"><i style="width:86%"></i></span></div>
          <div><div class="t-caption dim" style="margin-bottom:8px">${L('Loading', 'جارٍ التحميل')}</div>
            <span class="spinner"></span></div>
        </div>
        <div class="divider"></div>
        <div class="tablewrap">${C.skeletonRows(4)}</div>`)}

      ${spec(L('Empty, error, denied, offline', 'فارغ وخطأ وممنوع وبلا اتصال'), L('Four different problems, four different answers', 'أربع مشكلات وأربع إجابات'), `
        <div class="grid g2" style="gap:16px">
          <div class="card card-flat">${empty('people', L('No parishioners yet', 'لا مؤمنين بعد'),
            L('Add the first household by hand, or bring in the existing list from a spreadsheet.', 'أضف العائلة الأولى يدوياً أو استورد اللائحة من جدول.'),
            `<button class="btn btn-primary btn-dense" data-act="record-new">${L('New parishioner', 'مؤمن جديد')}</button>
             <button class="btn btn-secondary btn-dense" data-go="people/import">${L('Import CSV', 'استيراد CSV')}</button>`)}</div>
          <div class="card card-flat">${empty('search', L('Nothing matches those filters', 'لا شيء يطابق المرشّحات'),
            L('Status “Visitor”, town “Hadath” and last 30 days together return no one.', 'الحالة «زائر» والبلدة «الحدث» وآخر ٣٠ يوماً معاً لا تُرجع أحداً.'),
            `<button class="btn btn-secondary btn-dense" data-act="spec-clear">${L('Clear all filters', 'مسح كل المرشّحات')}</button>`)}</div>
          <div class="card card-flat">${empty('warn', L('This list could not be loaded', 'تعذّر تحميل اللائحة'),
            L('The server did not answer. Nothing you did caused it and nothing was lost.', 'لم يستجب الخادم. لم يتسبّب بذلك شيء فعلته ولم يضع شيء.'),
            `<button class="btn btn-secondary btn-dense" data-act="spec-retry">${L('Try again', 'إعادة المحاولة')}</button>
             <span class="mono t-caption dimmer" style="display:block;margin-top:8px">ref 8f21c4 · 09:41</span>`)}</div>
          <div class="card card-flat">${empty('shield', L('Giving is not part of your role', 'التقدمات ليست ضمن دورك'),
            L('Only the treasurer and the parish priest can open financial records. Ask Fr. Antoine if you need access.', 'أمين الصندوق والكاهن وحدهما يفتحان السجلات المالية.'),
            `<button class="btn btn-secondary btn-dense" data-go="dashboard">${L('Back to dashboard', 'العودة إلى اللوحة')}</button>`)}</div>
        </div>`)}

      ${spec(L('Page furniture', 'أثاث الصفحة'), L('Breadcrumbs, entity header, tabs with counts', 'مسار وعنوان كيان وتبويبات بعدّاد'), `
        <nav class="crumbs" style="display:flex;gap:7px;font:400 12px/16px var(--sans);color:var(--text-2)">
          <a href="#/people">${L('People', 'المؤمنون')}</a><span class="sep">/</span>
          <a href="#/people">${L('Parishioners', 'المؤمنون')}</a><span class="sep">/</span><span>Georges Haddad</span></nav>
        <div class="entityhead" style="margin-top:12px">
          <span class="avatar avatar-lg">GH</span>
          <div class="id"><h1 style="font:600 24px/32px var(--sans);letter-spacing:-.02em">Georges Haddad
            ${status('member')}<span class="pill">${L('Maronite', 'ماروني')}</span></h1>
            <div class="meta" style="font-family:var(--arabic)">جورج حدّاد · ${L('Envelope', 'مظروف')} <span class="mono">0142</span> · ${L('Hadath', 'الحدث')}</div></div>
          <div class="acts"><button class="btn btn-secondary" data-act="person-edit:p1">${L('Edit', 'تعديل')}</button>
            <button class="btn btn-primary" data-act="compose:p1">${L('Message', 'رسالة')}</button></div></div>
        <div style="margin-top:16px">${tabBar('styleguide/patterns', [['', 'Profile', 'الملف'], ['x1', 'Family', 'العائلة'],
          ['x2', 'Sacraments', 'الأسرار', 4], ['x3', 'Giving', 'التقدمات'], ['x4', 'Notes', 'ملاحظات']], '')}</div>`)}`,

    data: () => `
      ${spec(L('Data table', 'جدول البيانات'), L('48px rows · sticky header · sortable · expandable · hover actions', '٤٨ بكسل · رأس ثابت · قابل للفرز والتوسيع'), `
        ${table({
          pick: true,
          cols: [{ label: L('Name', 'الاسم'), sort: true }, { label: L('Town', 'البلدة'), sort: true },
                 { label: L('Envelope', 'المظروف'), cls: 'shrink' }, { label: L('Status', 'الحالة'), cls: 'shrink' },
                 { label: L('Last gift', 'آخر تقدمة'), cls: 'num' }, { label: '', cls: 'shrink' }],
          rows: [['p1', 'Hadath', '0142', 'member', 50], ['p3', 'Hadath', '—', 'visitor', 0], ['p4', 'Baabda', '0088', 'member', 120]]
            .map(([pid, town, env, st, gift]) => ({
              detail: `<div class="grid g4" style="gap:20px">
                <dl class="dl"><dt>${L('Household', 'العائلة')}</dt><dd>Nassar — 4 ${L('members', 'أفراد')}</dd></dl>
                <dl class="dl"><dt>${L('Phone', 'الهاتف')}</dt><dd class="mono">+961 3 887 210</dd></dl>
                <dl class="dl"><dt>${L('Groups', 'المجموعات')}</dt><dd>${L('Choir, Counting team', 'الجوقة، فريق العدّ')}</dd></dl>
                <dl class="dl"><dt>${L('Attendance 12 mo', 'الحضور ١٢ شهراً')}</dt><dd>41 / 52</dd></dl></div>`,
              cells: [
                `<span class="row" style="gap:6px">${C.iconBtn('chevR', L('Expand', 'توسيع'), 'data-expand aria-expanded="false"')}${who(person(pid))}</span>`,
                `<span class="dim">${esc(town)}</span>`, `<span class="mono">${env}</span>`, status(st),
                gift ? `<span class="num">${usd(gift)}</span><br><span class="num t-caption dim">${num(gift * RATE.value)}</span>` : '<span class="num dimmer">—</span>',
                `<span class="rowacts">${C.iconBtn('msg', L('Message', 'مراسلة'), `data-act="compose:${pid}"`)}${C.iconBtn('dots', L('More', 'المزيد'), `data-act="person-menu:${pid}"`)}</span>`]})),
          foot: `<span>1–3 ${L('of', 'من')} 1,380</span>
            <span class="savedview" style="margin-inline-start:auto">${icon('check', 14)}${L('Saved: Envelope holders', 'محفوظ: أصحاب المظاريف')}</span>`
        })}`)}

      ${spec(L('Display parts', 'أجزاء العرض'), '', `
        <div class="row" style="gap:8px;flex-wrap:wrap">
          ${status('member')}${status('visitor')}${status('pending')}${status('failed')}
          <span class="pill">${L('Archived', 'مؤرشف')}</span></div>
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px">
          <span class="chip">${L('Maronite', 'ماروني')}</span><span class="chip">${L('Choir', 'الجوقة')}</span>
          <span class="chip">${L('Envelope holder', 'صاحب مظروف')}</span>
          <button class="btn btn-ghost btn-dense" data-act="tag-add">+ ${L('Add tag', 'إضافة وسم')}</button></div>
        <div class="divider"></div>
        <div class="row" style="gap:20px;align-items:center;flex-wrap:wrap">
          <span class="avatar-stack">${['p1', 'p4', 'p3'].map(i => `<span class="avatar">${esc(person(i).lat.split(' ').map(x => x[0]).slice(0, 2).join(''))}</span>`).join('')}
            <span class="avatar" style="background:var(--muted);color:var(--text-2)">+9</span></span>
          ${['avatar-sm', '', 'avatar-lg', 'avatar-xl'].map(c => `<span class="avatar ${c}">GH</span>`).join('')}
        </div>`)}

      ${spec(L('KPI, sparkline, bar and donut', 'المؤشرات والرسوم'), L('RTL flips the axis', 'العربية تعكس المحور'), `
        <div class="grid g3" style="gap:16px">
          ${C.kpi({ k: L('Given this month', 'المعطى هذا الشهر'), v: usd(8420), sub: `L.L ${num(8420 * RATE.value)}`,
                    delta: L('+12% vs Sept', '+١٢٪ عن أيلول'), spark: GIVING_SERIES })}
          ${C.kpi({ k: L('Group meeting attendance', 'حضور اجتماعات المجموعات'), v: '86%', sub: L('illustrative component data', 'بيانات توضيحية للمكوّن'), spark: ATTENDANCE_SERIES })}
          ${C.kpi({ k: L('Volunteers active', 'متطوّعون نشطون'), v: '96', sub: L('this quarter', 'هذا الفصل'),
                    delta: L('−4 on last quarter', '−٤ عن الفصل الماضي'), dir: 'down' })}
        </div>
        <div class="divider"></div>
        <div class="grid g2" style="gap:24px;align-items:start">
          <div><div class="t-caption dim" style="margin-bottom:12px">${L('Budget vs actual, by fund', 'الموازنة مقابل الفعلي')}</div>
            ${C.barChart(FUNDS.map(f => ({ label: L(f.name, f.ar), v: f.actual, max: f.budget })))}</div>
          <div><div class="t-caption dim" style="margin-bottom:12px">${L('How people give', 'كيف يُعطي الناس')}</div>
            ${C.donut(PAYMENT_MIX.map(p => ({ ...p, label: isAr() ? p.labelAr : p.label })))}</div>
        </div>`)}

      ${spec(L('Key-value list and activity timeline', 'قائمة مفتاح-قيمة وسجل النشاط'), '', `
        <div class="grid g2" style="gap:24px;align-items:start">
          <dl class="dl"><dt>${L('Arabic name', 'الاسم العربي')}</dt><dd style="font-family:var(--arabic)">جورج حدّاد</dd>
            <dt>${L('Rite', 'الطقس')}</dt><dd>${L('Maronite', 'ماروني')}</dd>
            <dt>${L('Born', 'الولادة')}</dt><dd class="mono">12 / 03 / 1958</dd>
            <dt>${L('Phone', 'الهاتف')}</dt><dd class="mono">+961 3 421 887</dd>
            <dt>${L('Envelope', 'المظروف')}</dt><dd class="mono">0142</dd></dl>
          <div class="timeline">
            <div class="tl-item accent"><div class="when">${L('Today, 19:12', 'اليوم ١٩:١٢')}</div>
              <div class="what"><b>Rita Nassar</b> ${L('recorded $50.00 in session 214', 'سجّلت 50.00$ في الجلسة ٢١٤')}</div></div>
            <div class="tl-item"><div class="when">2 Oct 2026, 11:40</div>
              <div class="what">${L('Baptism certificate printed in Arabic · Book 12, page 84', 'طُبعت إفادة المعمودية بالعربية · دفتر ١٢، صفحة ٨٤')}</div></div>
            <div class="tl-item"><div class="when">28 Sep 2026</div>
              <div class="what">${L('Phone number changed from 03 421 880 · by the secretary', 'تغيّر رقم الهاتف · بواسطة أمانة السرّ')}</div></div>
          </div></div>`)}`
  };

  return head + (T[tab] || T[''])();
}

styleguide.mount = host => {
  C.wire(host); wireTables(host);
  const T = {
    tst1: () => toast(L('Georges Haddad was archived', 'أُرشف جورج حدّاد'),
      L('Removed from lists and messaging. Records kept.', 'أُزيل من اللوائح والمراسلة. والسجلات محفوظة.')),
    tst2: () => toast(L('Statement queued for 412 households', 'كشف في الانتظار لـ٤١٢ عائلة'),
      L('You will be told when the PDFs are ready.', 'ستُبلَّغ عندما تجهز الملفات.'), 'success'),
    tst3: () => toast(L('Saved on this computer only', 'حُفظ على هذا الحاسوب فقط'),
      L('It will sync when the connection returns.', 'سيُزامَن عند عودة الاتصال.'), 'warning'),
    tst4: () => toast(L('18 of 412 WhatsApp messages failed', 'فشل ١٨ من ٤١٢ رسالة'),
      L('Numbers not registered on WhatsApp.', 'أرقام غير مسجّلة على واتساب.'), 'danger')
  };
  Object.entries(T).forEach(([id, fn]) => host.querySelector('#' + id)?.addEventListener('click', fn));

  host.querySelector('#sgm1')?.addEventListener('click', () => openModal({
    title: L('Archive Georges Haddad?', 'أرشفة جورج حدّاد؟'),
    body: `<p class="t-body dim" style="font-size:14px;line-height:22px">${L(
      'He will disappear from lists, groups and messaging. Sacrament records, giving history and certificates are all kept and can be restored at any time.',
      'سيختفي من اللوائح والمجموعات والمراسلة. وتبقى سجلات الأسرار وتاريخ التقدمات والشهادات محفوظة وقابلة للاسترجاع في أي وقت.')}</p>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-danger" style="margin-inline-start:auto" data-act="archive-specimen">${L('Archive', 'أرشفة')}</button>`
  }));
  host.querySelector('#sgm2')?.addEventListener('click', () => deleteGuard(person('p1'), { dry: true }));
  host.querySelector('[data-split="sg1"]')?.addEventListener('click', newPersonDrawer);
  host.querySelector('[data-splitmenu="sg1"]')?.addEventListener('click', e => openMenu(e.currentTarget, [
    { label: L('New parishioner', 'مؤمن جديد'), icon: 'people', fn: newPersonDrawer },
    { label: L('New household', 'عائلة جديدة'), icon: 'family', fn: () => CR.create('household') },
    { label: L('Import CSV', 'استيراد CSV'), icon: 'export', fn: () => go('people/import') }
  ], { width: 220 }));
  host.querySelector('#sgm3')?.addEventListener('click', () => openDrawer({
    title: L('New contribution', 'مساهمة جديدة'), sub: L('Session 214 · envelope entry', 'الجلسة ٢١٤ · إدخال مظروف'),
    body: `${C.field({ label: L('Envelope no.', 'رقم المظروف'), value: '0142', dir: 'ltr' })}
      ${C.personPicker(L('Given by', 'المتبرّع'), 'sgd3')}
      ${C.currencyField({ label: L('Amount', 'المبلغ'), value: '50.00', id: 'sgd3c' })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <span class="t-caption dim" style="margin-inline-start:auto">${L('Draft saved', 'حُفظت المسوّدة')}</span>
      <button class="btn btn-primary" data-act="env-add">${L('Save & add next', 'حفظ وإضافة التالي')}</button>`,
    onMount(el) { C.wire(el); }
  }));
  host.querySelector('#sgm4')?.addEventListener('click', () => openDrawer({
    large: true, title: L('Large drawer — 720', 'درج كبير — ٧٢٠'),
    sub: L('Used where a form needs two columns or a preview sits beside the fields.', 'يُستعمل حين تحتاج الاستمارة عمودين أو معاينة إلى جانب الحقول.'),
    body: `<div class="formgrid">${C.field({ label: L('Arabic name', 'الاسم العربي'), ar: true, dir: 'rtl' })}
      ${C.field({ label: L('English name', 'الاسم الإنكليزي') })}</div>${C.addressCascade()}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>`,
    onMount(el) { C.wire(el); }
  }));
  host.querySelector('#sgm5')?.addEventListener('click', () => openModal({
    title: L('Leave without saving?', 'المغادرة بلا حفظ؟'),
    body: `<p class="t-body dim" style="font-size:14px;line-height:22px">${L(
      'You changed the Arabic name and the rite. A draft is kept on this computer for 7 days.',
      'غيّرتَ الاسم العربي والطقس. وتُحفظ مسوّدة على هذا الحاسوب ٧ أيام.')}</p>`,
    foot: `<button class="btn btn-danger-quiet" data-close>${L('Discard', 'تجاهل')}</button>
      <button class="btn btn-secondary" data-close>${L('Keep editing', 'متابعة التعديل')}</button>
      <button class="btn btn-primary" style="margin-inline-start:auto" data-act="save">${L('Save & leave', 'حفظ ومغادرة')}</button>`
  }));
  host.querySelector('#sgcmd')?.addEventListener('click', () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })));
};
