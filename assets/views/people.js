/* Module 2 — People and households, plus the register hygiene tools the
   roadmap asks for: duplicates, import, transfers and controlled archival. */
import { t, isAr, num, fmtDate, usd, matches } from '../i18n.js';
import { is, canSee, go, S, bus } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, amount, pill, esc, table, wireTables, empty,
         searchField, openDrawer, openModal, closeOverlays, toast, stat, tabBar, avatar,
         openMenu, openPopover, closeMenu } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import * as F from '../flows.js';
import { download, wireActions } from '../actions.js';
import { PEOPLE, ARCHIVED, PHOTOS, HOUSEHOLDS, GROUPS, SACRAMENTS, PLEDGES, BATCH, PERSON_EXTRA, DUPLICATES,
         IMPORT_PREVIEW, TRANSFERS, VOLUNTEERS, TODAY, person, initials } from '../data.js';

const label = p => isAr() ? p.ar : p.lat;
const relLabel = (m, h) => t(...F.RELS.find(r => r[0] === F.relOf(m, h)).slice(1));

/* The household drawn as a family tree: parents above the couple, brothers and sisters beside
   them, children and grandchildren below on connecting lines, anyone else alongside. */
function familyTree(h, focus) {
  const ms = h.members.map(person).filter(Boolean), by = r => ms.filter(m => F.relOf(m, h) === r);
  if (!ms.length) return empty('family', t('No one in this household yet', 'لا أحد في هذه العائلة بعد'), t('Add the first member.', 'أضف الفرد الأول.'));
  const head = by('head')[0], spouses = by('spouse'), spouse = spouses[0];
  const parents = by('parent'), sibs = by('sibling'), kids = by('child'), grand = by('grandchild');
  const side = [...by('guardian'), ...by('relative'), ...spouses.slice(1)];
  const short = m => ({ head: t('Head', 'ربّ العائلة') })[F.relOf(m, h)] || relLabel(m, h);
  const node = m => `<a class="ft-node ${m.id === focus ? 'me' : ''}" href="#/person/${m.id}/family">
      ${avatar(m, 'avatar-lg')}<b>${esc(label(m))}</b><small class="${isAr() ? '' : 'ar'}">${esc(isAr() ? m.lat : m.ar)}</small>
      <span class="ft-role">${esc(short(m))}${/^\d{4}/.test(m.born || '') ? ` · <span class="mono">${m.born.slice(0, 4)}</span>` : ''}</span>
      ${m.id === focus ? `<span class="ft-here">${t('This record', 'هذا السجل')}</span>` : ''}</a>`;
  const couple = (a, b, down) => `<div class="ft-couple ${down ? 'has-kids' : ''}">${a ? node(a) : ''}${a && b
    ? `<span class="ft-bond" role="img" aria-label="${t('married', 'متزوّجان')}">${icon('rings', 16)}</span>` : ''}${b ? node(b) : ''}</div>`;
  const branch = (cells, cls = '') => `<div class="ft-branch ${cls}"><div class="ft-row">${cells.join('')}</div></div>`;
  const cell = (html, cls = '') => `<div class="ft-cell ${cls}">${html}</div>`;
  /* the couple, with its children and grandchildren hanging beneath it */
  const lead = head || spouse || ms.find(m => !side.includes(m));
  const family = `<div class="ft-family">${head || spouse ? couple(head, spouse, kids.length || grand.length) : node(lead)}
      ${kids.length ? branch(kids.map(m => cell(node(m)))) : ''}${grand.length ? branch(grand.map(m => cell(node(m)))) : ''}</div>`;
  const core = sibs.length
    ? branch([cell(family, head && spouse ? 'ft-pair' : ''), ...sibs.map(m => cell(node(m)))], parents.length ? '' : 'ft-nostem')
    : family;
  return `<div class="ftree"><div class="ft-canvas">
      ${parents.length ? `<div class="ft-up">${parents.length === 2 ? couple(parents[0], parents[1], true) : `<div class="ft-row">${parents.map(node).join('')}</div>`}</div>` : ''}
      ${core}
    </div>
    ${side.length ? `<div class="ft-side"><span class="overline">${t('Also in the household', 'أيضاً في العائلة')}</span>
      <div class="ft-row">${side.map(node).join('')}</div></div>` : ''}</div>`;
}
const hh = id => HOUSEHOLDS.find(h => h.id === id);
const RITE_AR = { Maronite: 'ماروني', Melkite: 'روم كاثوليك', 'Greek Orthodox': 'روم أرثوذكس', Armenian: 'أرمني', Latin: 'لاتيني', Syriac: 'سرياني' };
const riteLabel = r => t(r, RITE_AR[r] || r);
const TABS = () => [['', 'All people', 'كل المؤمنين'], ['duplicates', 'Duplicates', 'التكرارات', DUPLICATES.length],
              ['import', 'Import', 'استيراد'], ['transfers', 'Transfers', 'الانتقالات', TRANSFERS.length],
              ['archived', 'Archived', 'المؤرشفون', ARCHIVED.length]];

/* ---------------- list ---------------- */
export function people(tab = '') {
  const head = pageHead({
    crumbs: [{ label: t('Records', 'السجلات'), href: '#/people' }, { label: t('People', 'المؤمنون') }],
    title: t('Parishioners', 'المؤمنون'),
    sub: `<span dir="ltr" class="tnum">${num(PEOPLE.length)}</span> ${t(`records · ${HOUSEHOLDS.length} households · updated today`, `سجلاً · ${HOUSEHOLDS.length} عائلة · حُدّثت اليوم`)}`,
    actions: `<button class="btn btn-secondary" data-act="export">${icon('export', 17)}${t('Export', 'تصدير')}</button>
      ${C.splitBtn(t('New parishioner', 'مؤمن جديد'), 'newp')}`
  }) + tabBar('people', TABS(), tab);

  if (tab === 'duplicates') return head + duplicates();
  if (tab === 'import') return head + importView();
  if (tab === 'transfers') return head + transfers();
  if (tab === 'archived') return head + archived();

  /* Real pagination over what is loaded — ten rows a page, as a secretary scans a page at a time. */
  const q = S.ui.peopleQ || '', town = S.ui.peopleTown || '', rite = S.ui.peopleRite || '';
  const visible = PEOPLE.filter(x => (!S.ui.peopleStatus || S.ui.peopleStatus.includes(x.status)) && (!town || x.town === town) && (!rite || x.rite === rite)
    && (!S.ui.peopleEnv || hh(x.hh)?.envelope) && matches(`${x.lat} ${x.ar} ${x.phone} ${hh(x.hh)?.envelope || ''}`, q));
  const PER = 10, pages = Math.max(1, Math.ceil(visible.length / PER));
  S.ui.peoplePage = Math.min(S.ui.peoplePage, pages - 1);
  const from = S.ui.peoplePage * PER, pageRows = visible.slice(from, from + PER);
  const rows = pageRows.map(p => ({
    cls: 'clickable', attrs: `data-ri-p="${p.id}"`,
    detail: `<div class="grid g3" style="gap:20px">
        <dl class="dl"><dt>${t('Household', 'العائلة')}</dt><dd>${hh(p.hh) ? esc(t(hh(p.hh).name, hh(p.hh).ar)) : '—'}</dd>
          <dt>${t('Phone', 'الهاتف')}</dt><dd class="mono">+961 ${p.phone}</dd></dl>
        <dl class="dl"><dt>${t('Groups', 'المجموعات')}</dt><dd>${p.tags.slice(0, 2).join(', ') || '—'}</dd>
          <dt>${t('Born', 'الولادة')}</dt><dd class="mono">${p.born}</dd></dl>
        <div><a class="btn btn-secondary btn-dense" href="#/person/${p.id}">${t('Open record', 'فتح السجل')}</a></div>
      </div>`,
    cells: [
      `<span class="row" style="gap:6px">${C.iconBtn('chevR', t('Expand', 'توسيع'), 'data-expand aria-expanded="false"')}${who(p)}</span>`,
      `<span class="dim">${esc(hh(p.hh) ? t(hh(p.hh).name, hh(p.hh).ar) : '—')}</span>`,
      `<span class="dim">${esc(t(p.town, p.townAr))}</span>`,
      `<span class="dim">${esc(riteLabel(p.rite))}</span>`,
      `<span class="mono dim" dir="ltr">${p.phone === '—' ? '<span class="dimmer">—</span>' : '+961 ' + p.phone}</span>`,
      status(p.status),
      `<span class="rowacts">${C.iconBtn('msg', t('Message', 'مراسلة'), `data-act="compose:${p.id}"`)}${C.iconBtn('dots', t('More', 'المزيد'), `data-kebab="${p.id}"`)}</span>`
    ]
  }));

  return `${head}
    <div class="toolbar" style="margin:20px 0 16px">
      <div class="grow" style="max-width:320px">${C.searchClear(t('Name, phone or envelope number', 'الاسم أو الهاتف أو رقم المظروف'), 'psearch')}</div>
      <button class="btn btn-secondary" data-filter aria-haspopup="true">${icon('filter', 17)}${t('Status', 'الحالة')}<span class="badge" style="margin-inline-start:6px">${(S.ui.peopleStatus || ['member', 'visitor']).length}</span></button>
      <select class="select" style="width:auto" id="ptown" aria-label="${t('Town', 'البلدة')}"><option value="">${t('All towns', 'كل البلدات')}</option>
        ${[...new Map(PEOPLE.map(x => [x.town, x.townAr])).entries()].sort().map(([en, ar]) => `<option value="${esc(en)}" ${town === en ? 'selected' : ''}>${esc(t(en, ar))}</option>`).join('')}</select>
      <select class="select" style="width:auto" id="prite" aria-label="${t('Rite', 'الطقس')}"><option value="">${t('All rites', 'كل الطقوس')}</option>
        ${[...new Set(PEOPLE.map(x => x.rite))].sort().map(r => `<option value="${esc(r)}" ${rite === r ? 'selected' : ''}>${esc(riteLabel(r))}</option>`).join('')}</select>
      <button class="savedview" data-act="people-env" aria-pressed="${!!S.ui.peopleEnv}" style="margin-inline-start:auto">${icon(S.ui.peopleEnv ? 'check' : 'filter', 14)}${t('Envelope holders', 'أصحاب المظاريف')}</button>
    </div>
    ${table({
      pick: true,
      cols: [{ label: t('Name', 'الاسم'), sort: true }, { label: t('Household', 'العائلة'), cls: 'hide-md', sort: true },
             { label: t('Town', 'البلدة'), cls: 'hide-sm', sort: true }, { label: t('Rite', 'الطقس'), cls: 'hide-md' },
             { label: t('Phone', 'الهاتف'), cls: 'hide-sm' }, { label: t('Status', 'الحالة'), cls: 'shrink' },
             { label: '', cls: 'shrink' }],
      rows,
      foot: `<span class="tnum">${pageRows.length ? from + 1 : 0}–${from + pageRows.length} ${t('of', 'من')} ${visible.length}</span>
        <span style="margin-inline-start:auto;display:flex;gap:6px;align-items:center">
          <button class="btn-icon dense" data-act="page:prev" aria-label="${t('Previous page', 'الصفحة السابقة')}"
            ${S.ui.peoplePage === 0 ? 'disabled' : ''}>${icon('chevL', 15)}</button>
          <span class="mono t-caption" style="min-width:44px;text-align:center">${S.ui.peoplePage + 1} / ${pages}</span>
          <button class="btn-icon dense" data-act="page:next" aria-label="${t('Next page', 'الصفحة التالية')}"
            ${S.ui.peoplePage >= pages - 1 ? 'disabled' : ''}>${icon('chevR', 15)}</button></span>`
    })}
    <div id="bulkhost"></div>`;
}

/* The row menu from sheet 03: edit, find duplicates, certificate with a
   language submenu, archive — and permanent deletion last and apart. */
export function personMenu(anchor, pid) {
  const p = person(pid); if (!p) return;
  const sac = SACRAMENTS.find(s => s.person === pid);
  const cert = lang => sac ? go(`certificate/${sac.id}/${lang}`)
    : toast(t('No register entry yet', 'لا قيد في السجل بعد'), t('Record the sacrament first.', 'سجّل السرّ أولاً.'), 'warning');
  openMenu(anchor, [
    { label: t('Edit record', 'تعديل السجل'), icon: 'edit', fn: () => F.personEdit(pid) },
    { label: t('Message', 'مراسلة'), icon: 'msg', fn: () => F.compose(pid) },
    { label: t('Find duplicates', 'البحث عن تكرار'), icon: 'family', fn: () => go('people/duplicates') },
    { label: t('Certificate', 'شهادة'), icon: 'doc', sub: [
      { label: t('Arabic — A4', 'عربي — A4'), fn: () => cert('arabic') },
      { label: t('English — A4', 'إنكليزي — A4'), fn: () => cert('english') },
      { label: t('Bilingual — A4', 'ثنائي — A4'), fn: () => cert('bilingual') }] },
    { label: t('Archive', 'أرشفة'), icon: 'trash', fn: () => { F.archivePeople([pid]); if (S.route === 'person') go('people'); } },
    { sep: true },
    { label: t('Delete permanently', 'حذف نهائي'), icon: 'trash', danger: true, fn: () => deleteGuard(p) }
  ], { width: 230 });
}

/* Destructive — typed confirmation, exactly as sheet 04 draws it. */
/** Typed confirmation before a permanent delete. dry: the style-guide specimen, which
    shows the whole flow but leaves the register untouched. */
export function deleteGuard(p, { dry = false } = {}) {
  openModal({
    title: t('Permanently delete this record?', 'حذف هذا السجل نهائياً؟'),
    sub: t('This cannot be undone. You will lose:', 'لا يمكن التراجع. ستفقد:'),
    body: `<div class="stack">${[[t('Sacrament records', 'سجلات الأسرار'), String(SACRAMENTS.filter(s => s.person === p.id).length)],
        [t('Contributions since 2019', 'المساهمات منذ ٢٠١٩'), '148 · $3,420'], [t('Attendance entries', 'قيود الحضور'), '211'],
        [t('Pastoral notes', 'ملاحظات رعوية'), '6']].map(([a, b]) => `<div class="listrow" style="padding-inline:0">
        <span class="grow">${esc(a)}</span><b class="mono">${esc(b)}</b></div>`).join('')}</div>
      <div class="formrow" style="margin-top:16px"><label class="label">${t('Type', 'اكتب')} <b>${esc(p.lat)}</b> ${t('to confirm', 'للتأكيد')}</label>
        <input class="input" id="dg_in" autocomplete="off"></div>
      <span class="help help-error" id="dg_help">${t('The name does not match yet.', 'الاسم لا يطابق بعد.')}</span>`,
    foot: `<button class="btn btn-secondary" data-close>${t('Keep record', 'الاحتفاظ بالسجل')}</button>
      <button class="btn btn-danger" id="dg_go" disabled style="margin-inline-start:auto">${t('Delete permanently', 'حذف نهائي')}</button>`,
    onMount(el) {
      const inp = el.querySelector('#dg_in'), b = el.querySelector('#dg_go'), h = el.querySelector('#dg_help');
      inp.addEventListener('input', () => {
        const okk = inp.value.trim() === p.lat; b.disabled = !okk;
        h.classList.toggle('help-error', !okk); h.classList.toggle('help-ok', okk);
        h.textContent = okk ? t('Match.', 'مطابق.') : t('The name does not match yet.', 'الاسم لا يطابق بعد.');
      });
      b.addEventListener('click', () => {
        closeOverlays();
        if (dry) return toast(t('Confirmed', 'تمّ التأكيد'), t('Style-guide specimen — the register is untouched.', 'نموذج من دليل التصميم — السجل لم يُمَسّ.'));
        PEOPLE.splice(PEOPLE.indexOf(p), 1);
        if (S.route === 'person') go('people'); else bus.refresh();
        toast(t('Record deleted', 'حُذف السجل'), p.lat, 'danger');
      });
    }
  });
}

people.mount = host => {
  C.wire(host);
  host.querySelector('#perm')?.addEventListener('click', permDeletion);
  wireTables(host, {
    onBulk(n) {
      const h = host.querySelector('#bulkhost');
      if (!h) return;
      h.innerHTML = n ? C.bulkBar(n) : '';
      if (n) wireActions(h);
    }
  });
  host.querySelectorAll('[data-ri-p]').forEach(tr => tr.addEventListener('click', e => {
    if (e.target.closest('button,input,a,label')) return;
    go('person/' + tr.dataset.riP);
  }));
  host.querySelector('[data-split="newp"]')?.addEventListener('click', newPersonDrawer);
  host.querySelector('[data-splitmenu="newp"]')?.addEventListener('click', e => openMenu(e.currentTarget, [
    { label: t('New parishioner', 'مؤمن جديد'), icon: 'people', fn: newPersonDrawer },
    { label: t('New household', 'عائلة جديدة'), icon: 'family', fn: () => CR.create('household') },
    { label: t('Import CSV', 'استيراد CSV'), icon: 'export', fn: () => go('people/import') },
    { label: t('New certificate request', 'طلب شهادة جديد'), icon: 'doc', fn: () => go('forms/runs') }
  ], { width: 240 }));
  host.querySelector('[data-filter]')?.addEventListener('click', e => {
    const btn = e.currentTarget, current = S.ui.peopleStatus || ['member', 'visitor'];
    const opts = [['member', t('Active', 'نشط')], ['visitor', t('Visitor', 'زائر')], ['clergy', t('Clergy', 'إكليروس')]];
    openPopover(btn, `<div style="padding:6px">
      <div class="head" style="padding:8px 10px 4px;font:500 10px/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--text-3)">
        ${t('Status', 'الحالة')}</div>
      ${opts.map(([k, lab]) => `<label class="opt" style="display:flex;align-items:center;gap:10px;min-height:40px;padding:6px 10px;border-radius:6px;cursor:pointer">
        <input type="checkbox" value="${k}" ${current.includes(k) ? 'checked' : ''} style="accent-color:var(--primary);width:16px;height:16px">
        <span style="flex:1">${esc(lab)}</span><span class="mono t-caption dimmer">${PEOPLE.filter(x => x.status === k).length}</span></label>`).join('')}
      <div style="display:flex;gap:8px;padding:8px 6px 4px;border-top:1px solid var(--border);margin-top:6px">
        <button class="btn btn-ghost btn-dense" id="fclear">${t('Clear', 'مسح')}</button>
        <button class="btn btn-primary btn-dense" id="fapply" style="margin-inline-start:auto">${t('Apply', 'تطبيق')}</button></div></div>`,
      { width: 260, onMount(el) {
        el.querySelector('#fclear').addEventListener('click', () => { S.ui.peopleStatus = null; closeMenu(); bus.refresh(); });
        el.querySelector('#fapply').addEventListener('click', () => {
          S.ui.peopleStatus = [...el.querySelectorAll('input:checked')].map(c => c.value);
          S.ui.peoplePage = 0; closeMenu(); bus.refresh();
          toast(t('Filter applied', 'طُبّق المرشّح'), `${PEOPLE.filter(x => S.ui.peopleStatus.includes(x.status)).length} ${t('people', 'شخصاً')}`, 'success');
        });
      } });
  });
  /* search, town and rite filter the whole register (not just this page), then paging starts again */
  const ps = host.querySelector('#psearch');
  if (ps) {
    ps.value = S.ui.peopleQ || '';
    let timer;
    const apply = () => { S.ui.peopleQ = ps.value.trim(); S.ui.peoplePage = 0; bus.refresh();
      const again = document.getElementById('psearch'); again?.focus(); again?.setSelectionRange(again.value.length, again.value.length); };
    ps.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(apply, 180); });
  }
  host.querySelector('#ptown')?.addEventListener('change', e => { S.ui.peopleTown = e.target.value; S.ui.peoplePage = 0; bus.refresh(); });
  host.querySelector('#prite')?.addEventListener('change', e => { S.ui.peopleRite = e.target.value; S.ui.peoplePage = 0; bus.refresh(); });
  host.querySelectorAll('[data-kebab]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); personMenu(b, b.dataset.kebab);
  }));
};

/* ---------------- duplicates ---------------- */
function duplicates() {
  return `<div class="tabbody">
    ${C.inlineAlert('warning', t('2 possible duplicates', 'تكراران محتملان'),
      t('Suggested for review only. ParishLife never merges login identities automatically.',
        'مقترحة للمراجعة فقط. لا يدمج «حياة الرعية» هويات الدخول تلقائياً أبداً.'))}
    <div class="stack" style="gap:16px;margin-top:20px">
      ${DUPLICATES.map((d, i) => `<section class="panel"><div class="panel-h">
        <h3>${t('Possible match', 'تطابق محتمل')}</h3>
        <span class="pill pill-warning" style="margin-inline-start:auto"><span class="dot"></span>${d.score}% ${t('similar', 'تشابه')}</span></div>
        <div class="panel-b">
          <div class="grid g2" style="gap:16px">
            ${[d.a, d.b].map((r, j) => `<div class="card card-flat">
              <div class="row" style="gap:10px"><span class="avatar">${esc(r.lat.split(' ').map(x => x[0]).slice(0, 2).join(''))}</span>
                <span><b style="display:block">${esc(isAr() ? r.ar : r.lat)}</b>
                  <small class="t-caption dim">${esc(isAr() ? r.lat : r.ar)}</small></span></div>
              <dl class="dl" style="margin-top:12px;font-size:13px">
                <dt>${t('Town', 'البلدة')}</dt><dd>${esc(r.town)}</dd>
                <dt>${t('Envelope', 'المظروف')}</dt><dd class="mono">${esc(r.env)}</dd>
                <dt>${t('Born', 'الولادة')}</dt><dd class="mono">${esc(r.born)}</dd></dl>
              <label class="check" style="margin-top:12px"><input type="radio" name="keep${i}" ${j === 0 ? 'checked' : ''}>
                <span>${t('Keep this one', 'احتفظ بهذا')}</span></label></div>`).join('')}
          </div>
          <div class="row" style="gap:8px;margin-top:16px">
            <button class="btn btn-secondary" data-act="dup-dismiss:${i}">${t('Not a duplicate', 'ليسا مكرَّرين')}</button>
            <button class="btn btn-primary" style="margin-inline-start:auto" data-act="dup-merge:${i}">${t('Compare and merge', 'قارن وادمج')}</button>
          </div>
        </div></section>`).join('')}
    </div></div>`;
}

/* ---------------- import ---------------- */
function importView() {
  const I = IMPORT_PREVIEW;
  return `<div style="margin-top:20px" class="splitview">
    <div class="stack" style="gap:16px">
      ${panel(t('1 · Choose the file', '١ · اختر الملف'), C.dropzone('imp'))}
      ${panel(t('2 · Map the columns', '٢ · طابِق الأعمدة'), `
        ${table({
          cols: [{ label: t('Column in your file', 'العمود في ملفك') }, { label: t('Maps to', 'يقابل') }, { label: '', cls: 'shrink' }],
          rows: I.cols.map(([en, ar, st]) => ({ cells: [
            `<span class="mono">${esc(en)}</span>`,
            st === 'skip' ? `<span class="dim">${t('Not imported — ParishLife has no postal code field', 'لا يُستورَد — لا حقل رمز بريدي')}</span>`
                          : `<select class="select" style="min-height:32px;font-size:13px"><option>${esc(t(en, ar))}</option></select>`,
            st === 'ok' ? pill(t('Ready', 'جاهز'), 'success') : st === 'warn' ? pill(t('Check', 'تحقّق'), 'warning') : pill(t('Skip', 'تخطّي'))
          ]}))
        })}`)}
      ${panel(t('3 · Review what will happen', '٣ · راجع ما سيحدث'), `
        <div class="stats" style="grid-template-columns:repeat(3,1fr)">
          ${stat(t('Will import', 'سيُستورَد'), I.ok, t('new records', 'سجلاً جديداً'))}
          ${stat(t('Need a look', 'يحتاج مراجعة'), I.warn, t('imported with a flag', 'يُستورَد مع علامة'))}
          ${stat(t('Blocked', 'موقوف'), I.err, t('fix the file and retry', 'أصلح الملف وأعد المحاولة'))}
        </div>
        <div class="divider"></div>
        ${I.issues.map(([r, ra, w, wa]) => `<div class="listrow" style="padding-inline:0">
          <span class="mono dim" style="width:64px;flex:none">${esc(t(r, ra))}</span>
          <span class="grow">${esc(t(w, wa))}</span></div>`).join('')}`)}
    </div>
    <div class="sidecol">
      ${panel(t('Progress', 'التقدّم'), `
        <div class="row" style="gap:10px"><span class="spinner"></span>
          <span class="t-ui">${t('Importing members — step 3 of 4', 'استيراد الأعضاء — الخطوة ٣ من ٤')}</span></div>
        <span class="progress" style="margin-top:12px"><i style="width:60%"></i></span>
        <span class="t-caption dim mono" style="display:block;margin-top:6px">248 / 412</span>`)}
      ${panel(t('Rules', 'القواعد'), `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px">
        ${[[t('Every row is validated before anything is written.', 'يُتحقَّق من كل صف قبل الكتابة.'), 'shield'],
           [t('Rows that look like an existing record are flagged, never merged.', 'الصفوف الشبيهة بسجل قائم تُعلَّم ولا تُدمج.'), 'people'],
           [t('The whole import can be rolled back for 24 hours.', 'يمكن التراجع عن الاستيراد كاملاً خلال ٢٤ ساعة.'), 'clock']]
          .map(([x, i]) => `<li class="row" style="gap:10px;align-items:flex-start">${icon(i, 17, 'dimmer')}<span class="t-caption">${esc(x)}</span></li>`).join('')}</ul>`)}
    </div></div>`;
}

/* ---------------- transfers ---------------- */
function transfers() {
  return `<div class="tabbody">
    ${table({
      cols: [{ label: t('Person', 'الشخص') }, { label: t('From', 'من'), cls: 'hide-sm' }, { label: t('To', 'إلى'), cls: 'hide-sm' },
             { label: t('Effective', 'اعتباراً من'), cls: 'hide-md' }, { label: t('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows: TRANSFERS.map(tr => ({ cells: [
        who(person(tr.p)),
        `<span class="dim">${esc(t(tr.from, tr.fromAr))}</span>`,
        `<span class="dim">${esc(t(tr.to, tr.toAr))}</span>`,
        `<span class="mono">${fmtDate(tr.effective)}</span>`,
        status(tr.status),
        tr.status === 'awaiting-approval'
          ? `<button class="btn btn-primary btn-dense" data-act="transfer-approve:${tr.id}">${t('Approve', 'موافقة')}</button>` : ''
      ]}))
    })}
    <p class="t-caption dim" style="margin-top:16px">${t(
      'A transfer keeps the historical link to the old parish, so a certificate issued there still resolves. Sacramental records never move; a reference does.',
      'الانتقال يحفظ الرابط التاريخي بالرعية السابقة، فتبقى الشهادة الصادرة عنها صالحة. سجلات الأسرار لا تنتقل، بل ينتقل مرجع إليها.')}</p></div>`;
}

/* ---------------- archived ---------------- */
function archived() {
  const until = d => { const x = new Date(d); x.setDate(x.getDate() + 30); return x.toISOString().slice(0, 10); };
  return `<div class="tabbody">
    ${C.inlineAlert('info', t('Archived records are restorable for 30 days', 'السجلات المؤرشفة قابلة للاسترجاع ٣٠ يوماً'),
      t('After that a permanent deletion has to be requested and reviewed. Sacramental records are never deleted.',
        'بعدها يجب طلب حذف نهائي ومراجعته. سجلات الأسرار لا تُحذف أبداً.'))}
    ${table({
      cols: [{ label: t('Name', 'الاسم') }, { label: t('Archived', 'أُرشف') }, { label: t('By', 'بواسطة'), cls: 'hide-sm' },
             { label: t('Restorable until', 'قابل للاسترجاع حتى'), cls: 'hide-sm' }, { label: '', cls: 'shrink' }],
      rows: ARCHIVED.map(p => ({ cells: [
        `<b>${esc(isAr() ? p.ar : p.lat)}</b>${p.deletionRequested ? ` ${pill(t('Deletion requested', 'طُلب الحذف'), 'danger')}` : ''}`,
        `<span class="mono dim">${fmtDate(p.archived)}</span>`,
        `<span class="dim">${esc(isAr() ? person(p.archivedBy)?.ar || '—' : person(p.archivedBy)?.lat || '—')}</span>`,
        `<span class="mono">${fmtDate(until(p.archived))}</span>`,
        `<button class="btn btn-secondary btn-dense" data-act="restore:${p.id}">${t('Restore', 'استرجاع')}</button>`
      ]})),
      empty: empty('people', t('Nobody is archived', 'لا أحد مؤرشف'), t('Archive someone from their row menu; they can be restored here for 30 days.', 'أرشف شخصاً من قائمة صفّه؛ ويمكن استرجاعه هنا خلال ٣٠ يوماً.'))
    })}
    ${ARCHIVED.length ? panel(t('Permanent deletion', 'الحذف النهائي'), `
      <p class="t-body dim" style="font-size:14px;line-height:22px">${t(
        'Permanent deletion is a reviewed request, not a button. The reviewer is shown exactly what would be lost before they can confirm.',
        'الحذف النهائي طلب يُراجَع، لا زرّ. ويُعرَض على المراجع بالضبط ما سيُفقَد قبل أن يؤكّد.')}</p>
      <button class="btn btn-danger-quiet" style="margin-top:14px" id="perm">${icon('trash', 17)}${t('See what a deletion would remove', 'اعرض ما سيحذفه')}</button>`) : ''}</div>`;
}

/* Permanent deletion of an archived record is a reviewed request: show what would go,
   what the registers keep, and send it to the priest rather than deleting on the spot. */
function permDeletion() {
  const who = ARCHIVED.filter(p => !p.deletionRequested);
  if (!who.length) return toast(t('Every archived record already has a request', 'لكل سجل مؤرشف طلب أصلاً'), t('The priest reviews them.', 'يراجعها الكاهن.'));
  openModal({
    title: t('What a deletion would remove', 'ما سيحذفه الحذف النهائي'),
    sub: t('Nothing is removed from here. The request goes to the parish priest, who sees this same list.',
           'لا يُحذف شيء من هنا. يذهب الطلب إلى كاهن الرعية ويرى اللائحة نفسها.'),
    body: `<div class="formrow"><label class="label" for="pd_who">${t('Archived record', 'السجل المؤرشف')}</label>
        <select class="select" id="pd_who">${who.map((p, i) => `<option value="${i}">${esc(isAr() ? p.ar : p.lat)}</option>`).join('')}</select></div>
      <div class="stack">${[
        [t('Profile, contact details and household link', 'الملف وبيانات الاتصال والرابط العائلي'), t('Removed', 'يُحذف'), 'danger'],
        [t('Group memberships and attendance', 'الانتساب للمجموعات والحضور'), t('Removed', 'يُحذف'), 'danger'],
        [t('Giving history', 'سجل التقدمات'), t('Kept, anonymised', 'يُحفظ بلا اسم'), 'warning'],
        [t('Sacramental records', 'سجلات الأسرار'), t('Kept — never deleted', 'تُحفظ — لا تُحذف أبداً'), 'success']]
        .map(([a, b, tone]) => `<div class="listrow" style="padding-inline:0"><span class="grow">${esc(a)}</span>${pill(b, tone)}</div>`).join('')}</div>
      <p class="help" style="margin-top:12px">${t('Giving stays in the accounts so the books still balance; only the name is removed.',
        'تبقى التقدمات في الحسابات كي يبقى الميزان صحيحاً؛ يُزال الاسم فقط.')}</p>
      <div style="margin-top:16px">${C.checkRow(t('The person, or their family, asked for this in writing', 'طلب الشخص أو عائلته ذلك كتابةً'), { id: 'pd_ok' })}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${t('Cancel', 'إلغاء')}</button>
      <button class="btn btn-danger" id="pd_go" disabled style="margin-inline-start:auto">${t('Request deletion', 'طلب الحذف')}</button>`,
    onMount(el) {
      const ok = el.querySelector('#pd_ok'), go_ = el.querySelector('#pd_go');
      ok.addEventListener('change', () => { go_.disabled = !ok.checked; });
      go_.addEventListener('click', () => {
        const p = who[+el.querySelector('#pd_who').value];
        p.deletionRequested = true;
        closeOverlays(); bus.refresh();
        toast(t('Deletion requested', 'طُلب الحذف'), t(`${p.lat} · sent to Fr. Antoine for review`, `${p.ar} · أُرسل إلى الأب أنطوان للمراجعة`), 'success',
          { action: { label: t('Undo', 'تراجع'), fn: () => { delete p.deletionRequested; bus.refresh(); } } });
      });
    }
  });
}

/* ---------------- person detail ---------------- */
const PTABS = pid => [['', 'Profile', 'الملف'], ['family', 'Family', 'العائلة'], ['sacraments', 'Sacraments', 'الأسرار', SACRAMENTS.filter(x => x.person === pid).length],
               ['attendance', 'Attendance', 'الحضور'], ['giving', 'Giving', 'التقدمات'],
               ['notes', 'Notes', 'ملاحظات'], ['files', 'Files', 'ملفات'], ['consent', 'Consent', 'الموافقات']];

export function personView(id, tab = '') {
  const p = person(id);
  if (!p) return empty('people', t('No such record', 'لا سجلّ بهذا الرقم'),
    t('The link may be stale.', 'قد يكون الرابط قديماً.'),
    `<a class="btn btn-primary" href="#/people">${t('Back to people', 'العودة إلى المؤمنين')}</a>`);

  const house = hh(p.hh), x = PERSON_EXTRA[p.id] || {};
  const tabs = PTABS(p.id).filter(tb => (tb[0] !== 'giving' || canSee('giving')) && (tb[0] !== 'notes' || is('priest')));

  const head = `<div class="pagehead"><div class="entityhead" style="width:100%">
      <span style="margin-top:22px;display:flex">${avatar(p, 'avatar-xl')}</span>
      <div class="id">
        <nav class="crumbs"><a href="#/people">${t('People', 'المؤمنون')}</a><span class="sep">/</span><span>${esc(label(p))}</span></nav>
        <h1 style="font:600 26px/34px var(--sans);letter-spacing:-.02em">${esc(label(p))}
          ${status(p.status)}<span class="pill">${esc(riteLabel(p.rite))}</span></h1>
        <div class="meta"><span style="font-family:${isAr() ? 'var(--sans)' : 'var(--arabic)'}">${esc(isAr() ? p.lat : p.ar)}</span>
          ${house ? ` · ${t('Envelope', 'مظروف')} <span class="mono">${house.envelope}</span>` : ''} · ${esc(t(p.town, p.townAr))}</div>
      </div>
      <div class="acts"><button class="btn btn-secondary" data-act="compose:${p.id}">${icon('msg', 17)}${t('Message', 'مراسلة')}</button>
        <button class="btn btn-secondary" data-act="print">${icon('print', 17)}${t('Print card', 'طباعة بطاقة')}</button>
        <button class="btn btn-primary" data-act="person-edit:${p.id}">${icon('edit', 17)}${t('Edit record', 'تعديل السجل')}</button>
        ${C.iconBtn('dots', t('More actions', 'إجراءات أخرى'), 'data-pkebab')}</div>
    </div></div>
    ${tabBar('person/' + id, tabs, tab)}`;

  const T = {
    '': () => `<div class="splitview">
      <div class="stack" style="gap:16px">
        ${panel(t('Record', 'السجل'), `<dl class="dl">
          <dt>${t('Arabic name', 'الاسم العربي')}</dt><dd style="font-family:var(--arabic);font-size:16px">${esc(p.ar)}</dd>
          <dt>${t('Transliteration', 'الحرف اللاتيني')}</dt><dd>${esc(p.lat)}</dd>
          <dt>${t('Preferred name', 'الاسم المفضّل')}</dt><dd>${esc(x.preferred || p.lat.split(' ')[0])}</dd>
          <dt>${t('Born', 'الولادة')}</dt><dd class="mono" dir="ltr">${p.born}</dd>
          <dt>${t('Rite', 'الطقس')}</dt><dd>${esc(riteLabel(p.rite))}</dd>
          <dt>${t('Phone', 'الهاتف')}</dt><dd class="mono" dir="ltr">${p.phone === '—' ? '—' : '+961 ' + p.phone}</dd>
          <dt>${t('Address', 'العنوان')}</dt><dd>${house ? esc(t(house.address, house.addressAr)) : '—'}</dd>
          <dt>${t('Language', 'اللغة')}</dt><dd>${x.lang === 'ar' ? t('Arabic', 'العربية') : t('English', 'الإنكليزية')}</dd>
          <dt>${t('Reach them on', 'التواصل عبر')}</dt><dd>${esc({ whatsapp: 'WhatsApp', sms: 'SMS', email: t('Email', 'بريد إلكتروني') }[x.channel] || 'WhatsApp')}</dd>
          <dt>${t('Blood type', 'زمرة الدم')}</dt><dd class="mono">${esc(x.blood || '—')}</dd>
          <dt>${t('Directory', 'الدليل')}</dt><dd>${x.directory ? t('Listed, by consent', 'مدرَج بموافقته') : t('Not listed', 'غير مدرَج')}</dd>
        </dl>`)}
        ${panel(t('Skills and important dates', 'المهارات والتواريخ المهمّة'), `
          <div class="row" style="gap:6px;flex-wrap:wrap">${(x.skills || ['—']).map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div>
          <div class="divider"></div>
          ${(x.dates || []).map(([en, ar, d]) => `<div class="listrow" style="padding-inline:0">
            <span class="grow"><b>${esc(t(en, ar))}</b></span><span class="mono dim">${fmtDate(d)}</span></div>`).join('')
            || `<p class="t-caption dim">${t('No dates recorded.', 'لا تواريخ مسجّلة.')}</p>`}
          ${(x.fields || []).length ? `<div class="divider"></div><div class="ac-group" style="padding-inline:0">${t('Parish fields', 'حقول الرعية')}</div>
            ${x.fields.map(([en, ar, v]) => `<div class="listrow" style="padding-inline:0"><span class="grow">${esc(t(en, ar))}</span><b>${esc(v)}</b></div>`).join('')}` : ''}`)}
      </div>
      <div class="sidecol">
        ${panel(t('Household', 'العائلة'), house ? house.members.map(person).filter(Boolean).map(m =>
          `<a class="listrow" href="#/person/${m.id}">${who(m)}<span class="grow"></span>
            ${m.id === house.head ? pill(t('Head', 'ربّ العائلة'), 'info') : ''}</a>`).join('')
          : empty('family', t('No household', 'لا عائلة'), t('Recorded on their own.', 'مسجّل بمفرده.')), { tight: !!house })}
        ${panel(t('Activity', 'النشاط'), `<div class="timeline">
          <div class="tl-item accent"><div class="when">4 Oct 2026 · 19:12</div>
            <div class="what">${t('Rita Nassar recorded $50.00 in session 214', 'سجّلت ريتا نصّار 50.00$ في الجلسة ٢١٤')}</div></div>
          <div class="tl-item"><div class="when">2 Oct 2026 · 11:40</div>
            <div class="what">${t('Baptism certificate printed in Arabic — Book 12, page 84', 'طُبعت إفادة المعمودية بالعربية — دفتر ١٢، صفحة ٨٤')}</div></div>
          <div class="tl-item"><div class="when">28 Sep 2026</div>
            <div class="what">${t('Phone number changed from 03 421 880 · by the secretary', 'تغيّر رقم الهاتف من 03 421 880 · بواسطة أمانة السرّ')}</div></div>
        </div>`)}
      </div></div>`,

    family: () => house ? `<div class="splitview"><div>
        ${panel(t('Family tree', 'شجرة العائلة') + ' — ' + t(house.name, house.ar), familyTree(house, p.id),
          { more: `<button class="btn btn-secondary btn-dense" data-act="family-add:${house.id}">${icon('plus', 15)}${t('Add family member', 'إضافة فرد')}</button>` })}
        ${panel(t('Members and relationships', 'الأفراد والصلات'), house.members.map(person).filter(Boolean).map(m => `
          <div class="listrow">${who(m)}<span class="grow"></span>
            <span class="dim t-caption">${esc(relLabel(m, house))}${m.emergency ? ` · ${t('emergency contact', 'جهة طوارئ')}` : ''}</span>
            ${C.iconBtn('edit', t('Edit relationship', 'تعديل الصلة'), `data-act="relation-edit:${m.id}"`)}</div>`).join(''), { tight: true })}
      </div>
      <div class="sidecol">${panel(t('Emergency contacts', 'جهات الطوارئ'), (() => {
        /* the people in the same household marked as emergency contacts, or its adults until someone is marked — never a child by default */
        const mates = (house?.members || []).filter(id => id !== p.id).map(person).filter(Boolean);
        const adult = m => !m.born || new Date(m.born) <= new Date(TODAY.getFullYear() - 18, TODAY.getMonth(), TODAY.getDate());
        const marked = mates.filter(m => m.emergency), list = marked.length ? marked : mates.filter(adult);
        return list.length ? list.map(m => `<div class="listrow">${who(m)}<span class="grow"></span>
            <span class="t-caption dim">${esc(relLabel(m, house))}</span>
            ${C.iconBtn('edit', t('Edit relationship', 'تعديل الصلة'), `data-act="relation-edit:${m.id}"`)}</div>`).join('')
          : `<div class="panel-pad">${house
            ? empty('family', t('No adult to call yet', 'لا راشد للاتصال بعد'), t('Add a parent or another adult relative, or mark someone in the household as an emergency contact.', 'أضف والداً أو قريباً راشداً، أو حدّد أحد أفراد العائلة جهة طوارئ.'),
                `<button class="btn btn-secondary btn-dense" data-act="family-add:${house.id}">${icon('plus', 15)}${t('Add family member', 'إضافة فرد')}</button>`)
            : empty('family', t('No one to call yet', 'لا أحد للاتصال بعد'), t('Link this person to a household to choose their emergency contacts.', 'اربط هذا الشخص بعائلة لاختيار جهات الطوارئ.'))}</div>`;
      })(), { tight: true })}
      ${panel(t('Authorised to collect children', 'المفوَّضون باستلام الأطفال'), `
        <p class="t-caption dim">${t('Managed on the check-in screen so the door team is the one that maintains it.',
          'تُدار من شاشة التسجيل ليحافظ عليها فريق الباب نفسه.')}</p>
        <a class="btn btn-secondary btn-dense" style="margin-top:10px" href="#/checkin/pickup">${t('Open pickup list', 'فتح لائحة الاستلام')}</a>`)}
      </div></div>`
      : `<div class="tabbody">${empty('family', t('Not linked to a household', 'غير مرتبط بعائلة'), t('This person is recorded on their own. Link them to a household to draw their family and choose emergency contacts.', 'هذا الشخص مسجّل بمفرده. اربطه بعائلة لرسم عائلته واختيار جهات الطوارئ.'),
          `<button class="btn btn-primary btn-dense" data-act="family-link:${p.id}">${icon('family', 15)}${t('Link to a household', 'ربط بعائلة')}</button>`)}</div>`,

    sacraments: () => {
      const sacr = SACRAMENTS.filter(s => s.person === p.id);
      return sacr.length ? table({
        cols: [{ label: t('Sacrament', 'السرّ') }, { label: t('Register', 'القيد'), cls: 'shrink' },
               { label: t('Date', 'التاريخ') }, { label: t('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
        rows: sacr.map(s => ({ cells: [
          `<b>${esc(s.kind)}</b>`, `<span class="mono">${s.reg}</span>`, `<span class="dim">${fmtDate(s.date)}</span>`,
          status(s.status), `<a class="btn btn-secondary btn-dense" href="#/certificate/${s.id}">${t('Certificate', 'الشهادة')}</a>`]}))
      }) : empty('sacr', t('No sacramental record', 'لا سجل أسرار'), t('Nothing registered in this parish.', 'لا شيء مسجّل في هذه الرعية.'));
    },

    attendance: () => `<div class="splitview">
      ${panel(t('Attendance, last 12 months', 'الحضور، آخر ١٢ شهراً'), C.barChart([
        { label: t('Sunday Mass', 'قدّاس الأحد'), v: 41, max: 52, text: '41 / 52' },
        { label: t('Feast days', 'الأعياد'), v: 7, max: 9, text: '7 / 9' },
        { label: t('Parish events', 'أحداث الرعية'), v: 5, max: 11, text: '5 / 11' }]))}
      <div class="sidecol">${panel(t('Recent', 'الأخيرة'), `
        ${['4 Oct 2026 · Mass 10:30', '27 Sep 2026 · Mass 10:30', '20 Sep 2026 · Mass 08:00'].map(d =>
          `<div class="listrow" style="padding-inline:0"><span class="grow mono t-caption">${d}</span>${icon('check', 15, 'dimmer')}</div>`).join('')}`, { tight: true })}</div></div>`,

    giving: () => {
      const pledge = PLEDGES.find(z => z.p === p.id), gift = BATCH.lines.find(l => l.p === p.id);
      return `<div class="splitview"><div class="stack" style="gap:16px">
        ${panel(t('This year', 'هذه السنة'), `<div class="grid g2" style="gap:16px">
          ${C.kpi({ k: t('Given this year', 'المعطى هذه السنة'), v: usd(1240), sub: 'L.L 110,980,000',
                    delta: t('+12% vs 2025', '+١٢٪ عن ٢٠٢٥'), spark: [40, 55, 38, 62, 58, 71, 60, 68, 52, 64, 79, 70] })}
          ${C.kpi({ k: t('Envelope', 'المظروف'), v: house?.envelope ?? '—', sub: t('since 2019', 'منذ ٢٠١٩') })}
        </div>`)}
        ${panel(t('Contributions', 'المساهمات'), table({
          cols: [{ label: t('Date', 'التاريخ') }, { label: t('Fund', 'الصندوق') }, { label: 'USD', cls: 'num' }, { label: '', cls: 'shrink' }],
          rows: [['2026-10-04', t('General fund', 'الصندوق العام'), 50], ['2026-09-27', t('General fund', 'الصندوق العام'), 50],
                 ['2026-09-20', t('Church restoration', 'ترميم الكنيسة'), 300]].map(r => ({ cells: [
            `<span class="mono dim">${fmtDate(r[0])}</span>`, `<span class="dim">${esc(r[1])}</span>`,
            `<span class="num">${usd(r[2])}</span>`,
            `<button class="btn btn-secondary btn-dense" data-act="receipt:R-2026-${String(880 + r[2]).slice(-4)}|${p.id}|${r[2]}">${t('Receipt', 'إيصال')}</button>`]}))
        }), { tight: true })}
      </div>
      <div class="sidecol">
        ${pledge ? panel(t('Pledge', 'التعهّد'), `<div class="amount" dir="ltr"><span class="usd">${usd(pledge.paid)}</span>
          <span class="lbp">${t('of', 'من')} ${usd(pledge.pledged)}</span></div>
          <span class="meter" style="margin-top:10px"><i style="width:${Math.round(pledge.paid / pledge.pledged * 100)}%"></i></span>`) : ''}
        ${panel(t('Statement', 'الكشف'), `<p class="t-caption dim">${t(
          'A yearly statement can be produced in either language. It is a record of what was given, not a tax document.',
          'يمكن إصدار كشف سنوي بأيّ من اللغتين. وهو سجل بما أُعطي، لا مستند ضريبي.')}</p>
          <button class="btn btn-secondary btn-dense" style="margin-top:10px" data-act="statement:${p.id}">${icon('doc', 15)}${t('Generate statement', 'إصدار كشف')}</button>`)}
      </div></div>`;
    },

    notes: () => `${C.inlineAlert('info', t('Priest only', 'للكاهن فقط'),
      t('Pastoral notes are separate from staff notes, and the content of a confession is never recorded anywhere in ParishLife.',
        'الملاحظات الرعوية منفصلة عن ملاحظات الموظفين، ولا يُسجَّل مضمون الاعتراف في أي مكان من «حياة الرعية».'))}
      <div style="margin-top:16px">${panel(t('Notes', 'الملاحظات'), `
        <div class="timeline"><div class="tl-item accent"><div class="when">12 Sep 2026</div>
          <div class="what">${t('Visited at home after the hospital stay. Asked for the parish to remember his mother at Sunday Mass.',
            'زيارة منزلية بعد الخروج من المستشفى. طلب ذكر والدته في قدّاس الأحد.')}</div></div>
        <div class="tl-item"><div class="when">3 Jun 2026</div>
          <div class="what">${t('Council seat renewed for two years.', 'جُدّد مقعده في المجلس سنتين.')}</div></div></div>
        <div class="divider"></div>
        ${C.textarea({ label: t('Add a note', 'إضافة ملاحظة'), max: 500, id: 'pnote',
          help: t('Visible to the priest only.', 'تظهر للكاهن وحده.') })}
        <button class="btn btn-primary btn-dense" data-act="note-save:${p.id}">${t('Save note', 'حفظ الملاحظة')}</button>`)}</div>`,

    files: () => `<div style="max-width:720px">${panel(t('Attachments', 'المرفقات'), `
      ${['Baptism extract 2019.pdf', 'ID card scan.jpg', 'Consent form 2026.pdf'].map((f, i) => `
        <div class="listrow" style="padding-inline:0">${icon('doc', 17, 'dimmer')}
          <span class="grow"><b>${esc(f)}</b><small class="mono">${['240 KB', '1.1 MB', '86 KB'][i]} · ${['2019-06-12', '2024-02-08', '2026-03-30'][i]}</small></span>
          ${i === 2 ? pill(t('Restricted', 'مقيّد'), 'warning', 'lock') : ''}
          ${C.iconBtn('export', t('Open', 'فتح'), `data-act="doc:${f}"`)}</div>`).join('')}
      <div class="divider"></div>${C.dropzone('pfiles')}`)}</div>`,

    consent: () => `<div style="max-width:720px">${panel(t('Consent', 'الموافقات'), `
      <div class="stack" style="gap:12px">
        ${(x.consent || [['Parish announcements on WhatsApp', 'إعلانات الرعية على واتساب', true],
                          ['Printed parish directory', 'الدليل المطبوع', true],
                          ['Photos in parish media', 'الصور في وسائل الرعية', false]])
          .map(([en, ar, on], i) => C.switchRow(t(en, ar), { checked: on, pref: `consent.${p.id}.${i}` })).join('')}
      </div>
      <div class="divider"></div>
      <div class="ac-group" style="padding-inline:0">${t('Consent history', 'سجل الموافقات')}</div>
      <div class="timeline">
        <div class="tl-item"><div class="when">30 Mar 2026</div><div class="what">${t('Signed the 2026 consent form in the office.', 'وقّع استمارة موافقة ٢٠٢٦ في المكتب.')}</div></div>
        <div class="tl-item"><div class="when">14 Jan 2025</div><div class="what">${t('Withdrew consent for photos.', 'سحب الموافقة على الصور.')}</div></div>
      </div>
      <p class="t-caption dim" style="margin-top:12px">${t(
        'Every change of consent is kept with its date, so the parish can always show what was agreed and when.',
        'كل تغيير في الموافقة يُحفظ بتاريخه، فتستطيع الرعية دائماً أن تُظهر ما اتُّفق عليه ومتى.')}</p>`)}</div>`
  };

  return head + (T[tab] || T[''])();
}

personView.mount = (host, id) => {
  C.wire(host); wireTables(host);
  host.querySelector('[data-pkebab]')?.addEventListener('click', e => personMenu(e.currentTarget, id));
};

/* ---------------- households ---------------- */
export function households() {
  const open = h => h.head
    ? `<a class="btn btn-ghost btn-dense" href="#/person/${h.head}/family">${t('Open', 'فتح')}</a>`
    : `<button class="btn btn-ghost btn-dense" data-act="rec-edit:household|${h.id}">${t('Set the head', 'حدّد ربّ العائلة')}</button>`;
  const cards = HOUSEHOLDS.map(h => {
    const members = h.members.map(person).filter(Boolean);
    return `<section class="panel" data-find-item><div class="panel-b">
      <div class="row" style="gap:12px;align-items:flex-start">
        <span class="avatar avatar-lg">${esc(t(h.name, h.ar).slice(0, 2))}</span>
        <div style="flex:1;min-width:0">
          <b style="display:block;font:600 16px/22px var(--sans)">${esc(t(h.name, h.ar))}</b>
          <small class="t-caption dim">${esc(t(h.town, h.townAr))} · ${t('envelope', 'مظروف')} <span class="mono">${esc(h.envelope || '—')}</span></small>
        </div>${CR.recBtn('household', h.id)}</div>
      <p class="t-caption dim" style="margin-top:12px">${esc(t(h.address, h.addressAr) || t('No address yet', 'لا عنوان بعد'))}</p>
      <div class="divider"></div>
      <div class="row" style="gap:8px">
        <span class="avatar-stack">${members.map(m => avatar(m, 'avatar-sm')).join('')}</span>
        <span class="t-caption dim">${members.length} ${t(members.length === 1 ? 'member' : 'members', 'أفراد')}</span>
        <span style="margin-inline-start:auto">${open(h)}</span>
      </div></div></section>`;
  }).join('');
  const tableView = table({
    cols: [{ label: t('Family', 'العائلة'), sort: true }, { label: t('Town', 'البلدة'), cls: 'hide-sm' }, { label: t('Envelope', 'المظروف'), cls: 'shrink' },
           { label: t('Members', 'الأفراد'), cls: 'num' }, { label: '', cls: 'shrink' }],
    rows: HOUSEHOLDS.map(h => ({ attrs: 'data-find-item', cells: [`<b>${esc(t(h.name, h.ar))}</b>`, `<span class="dim">${esc(t(h.town, h.townAr))}</span>`,
      `<span class="mono">${esc(h.envelope || '—')}</span>`, `<span class="num">${h.members.length}</span>`,
      `<span class="row" style="gap:6px;justify-content:flex-end">${open(h)}${CR.recBtn('household', h.id)}</span>`] })),
    empty: empty('family', t('No households yet', 'لا عائلات بعد'), t('Add the first one — a household is linked by home and envelope number.', 'أضف الأولى — العائلة مرتبطة بالمنزل ورقم المظروف.'),
      `<button class="btn btn-primary btn-dense" data-act="household-new">${t('New household', 'عائلة جديدة')}</button>`)
  });

  return `${pageHead({
      crumbs: [{ label: t('Records', 'السجلات') }, { label: t('Households', 'العائلات') }],
      title: t('Households', 'العائلات'),
      sub: t(`${HOUSEHOLDS.length} households · linked by home and envelope number, not by an assumption about family shape`,
             `${HOUSEHOLDS.length} عائلة · مرتبطة بالمنزل ورقم المظروف، لا بافتراض شكل العائلة`),
      actions: `<button class="btn btn-secondary" data-act="export">${icon('export', 17)}${t('Export', 'تصدير')}</button>
        <button class="btn btn-primary" data-act="household-new">${icon('plus', 17)}${t('New household', 'عائلة جديدة')}</button>`
    })}
    <div class="toolbar" style="margin-bottom:16px">
      <div class="grow" style="max-width:320px">${searchField(t('Family name or envelope', 'اسم العائلة أو المظروف'), 'data-find')}</div>
      <span class="seg" role="group" aria-label="${t('View', 'العرض')}">
        <button aria-pressed="${S.ui.hhView !== 'table'}" data-act="hh-view:cards">${t('Cards', 'بطاقات')}</button>
        <button aria-pressed="${S.ui.hhView === 'table'}" data-act="hh-view:table">${t('Table', 'جدول')}</button></span>
    </div>
    ${S.ui.hhView === 'table' ? tableView : HOUSEHOLDS.length ? `<div class="gridcards">${cards}</div>` : tableView}
    <div class="find-empty" hidden>${empty('search', t('No household matches', 'لا عائلة مطابقة'), t('Try part of the family name or the envelope number.', 'جرّب جزءاً من اسم العائلة أو رقم المظروف.'))}</div>`;
}
households.mount = host => { C.wire(host); wireTables(host); };

/* ---------------- new-person drawer ---------------- */
export function newPersonDrawer() {
  delete PHOTOS.new;                                     // a photo left from a cancelled drawer does not carry over
  openDrawer({
    large: true,
    title: t('New parishioner', 'مؤمن جديد'),
    sub: t('Both names are required. The Arabic name is what a certificate prints.',
           'الاسمان مطلوبان. الاسم العربي هو ما تطبعه الشهادة.'),
    body: `${C.namePair()}${C.riteSelect()}${C.phoneField({ id: 'newphone' })}
      <div class="formgrid">
        ${C.field({ label: t('Preferred name', 'الاسم المفضّل'), opt: true, ph: 'Georges' })}
        ${C.field({ label: t('Date of birth', 'تاريخ الولادة'), type: 'date', value: '1968-03-14' })}
      </div>
      <div class="divider"></div>
      <h4 class="t-ui" style="margin-bottom:12px">${t('Address', 'العنوان')}</h4>
      ${C.addressCascade()}
      <div class="divider"></div>
      <div class="formgrid">
        <div class="formrow"><label class="label">${t('Blood type', 'زمرة الدم')}<span class="opt">${t('(for emergencies)', '(للطوارئ)')}</span></label>
          <select class="select"><option>—</option><option>O+</option><option>O−</option><option>A+</option><option>B+</option><option>AB+</option></select></div>
        <div class="formrow"><label class="label">${t('Language', 'اللغة')}</label>
          <select class="select"><option>${t('Arabic', 'العربية')}</option><option>${t('English', 'الإنكليزية')}</option><option>${t('French', 'الفرنسية')}</option></select></div>
      </div>
      ${C.chipField(t('Groups', 'المجموعات'), [t('Choir', 'الجوقة')])}
      ${C.avatarUpload('new')}
      <div class="divider"></div>
      <div class="stack" style="gap:10px">
        ${C.checkRow(t('Send parish announcements on WhatsApp', 'إرسال إعلانات الرعية على واتساب'), { checked: true })}
        ${C.checkRow(t('Include in the printed parish directory', 'إدراج في الدليل المطبوع'))}
      </div>`,
    foot: `<button class="btn btn-secondary" data-close>${t('Cancel', 'إلغاء')}</button>
      <button class="btn btn-secondary" data-act="person-add">${t('Save & add next', 'حفظ وإضافة التالي')}</button>
      <button class="btn btn-primary" data-act="person-add" style="margin-inline-start:auto">${t('Save parishioner', 'حفظ المؤمن')}</button>`,
    onMount(el) {
      C.wire(el);
      /* wired by data-act */
    }
  });
}
