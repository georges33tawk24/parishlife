/* Module 2 — people, households, duplicates, import and controlled archival. */
import { t, isAr, num, fmtDate, usd, matches } from '../i18n.js';
import { is, canSee, go, S, bus } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, amount, pill, esc, table, wireTables, empty,
         searchField, openDrawer, openModal, closeOverlays, toast, stat, tabBar, avatar,
         openMenu, openPopover, closeMenu } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import * as F from '../flows.js';
import { download, wireActions } from '../actions.js';
import { persist } from '../persist.js';
import { printSheet } from '../print.js';
import { readAddressCascade } from '../geography.js';
import * as D from '../data.js';
import { PEOPLE, ARCHIVED, PHOTOS, HOUSEHOLDS, GROUPS, SACRAMENTS, PLEDGES, BATCH, PERSON_EXTRA, DUPLICATES,
         IMPORT_PREVIEW, VOLUNTEERS, TODAY, FAMILIES, BRANCHES, GROUP_DETAIL, NOTES, FUNDS, person, initials } from '../data.js';

const label = p => p?.lat || p?.ar || '';
const relLabel = (m, h) => t(...F.RELS.find(r => r[0] === F.relOf(m, h)).slice(1));
const occupationSuggestions = ['Accountant','Carpenter','Catechist','Electrician','Electrical engineer','Electrical technician',
  'Healthcare worker','Nurse','Teacher','Social worker','Software engineer'];
const occupationOptions = () => [...new Set([...occupationSuggestions,...Object.values(PERSON_EXTRA).map(x=>x.occupation).filter(Boolean)])].sort();
const occupationField = (id,value='') => `<div class="formrow"><label class="label" for="${id}">${t('Line of work','المهنة')}</label>
  <input class="input" id="${id}" list="${id}-options" value="${esc(value)}" maxlength="120" autocomplete="off" placeholder="${t('Start typing or enter your own','ابدأ بالكتابة أو أدخل مهنتك')}">
  <datalist id="${id}-options">${occupationOptions().map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></div>`;
const skillOptions = () => [...new Set([...Object.values(PERSON_EXTRA).flatMap(x=>x.skills||[]),...VOLUNTEERS.flatMap(v=>v.skills||[])])].filter(Boolean).sort();
function skillPicker(selected=[]) {
  const options=[...new Set([...skillOptions(),...selected])].sort();
  return `<div class="formrow"><label class="label" for="skill-search">${t('Skills','المهارات')}</label>
    <input class="input" type="search" id="skill-search" placeholder="${t('Search existing skills','ابحث عن مهارة موجودة')}">
    <div class="choice-grid skill-choices" style="max-height:180px;overflow:auto;margin-top:8px">${options.map(s=>`<label class="check" data-skill-choice><input type="checkbox" value="${esc(s)}" ${selected.includes(s)?'checked':''}><span>${esc(s)}</span></label>`).join('')}</div>
    <label class="check" style="margin-top:10px"><input type="checkbox" id="skill-other"><span>${t('Other skill','مهارة أخرى')}</span></label>
    <input class="input" id="skill-custom" maxlength="80" placeholder="${t('Enter another skill','أدخل مهارة أخرى')}" style="margin-top:7px" disabled></div>`;
}
function wireSkillPicker(el) {
  el.querySelector('#skill-search')?.addEventListener('input',e=>{
    const q=e.target.value.trim().toLocaleLowerCase();
    el.querySelectorAll('[data-skill-choice]').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase().includes(q);});
  });
  el.querySelector('#skill-other')?.addEventListener('change',e=>{const custom=el.querySelector('#skill-custom');custom.disabled=!e.target.checked;if(e.target.checked)custom.focus();});
}
function selectedSkills(el) {
  const selected=[...el.querySelectorAll('[data-skill-choice] input:checked')].map(x=>x.value);
  const other=el.querySelector('#skill-other')?.checked?el.querySelector('#skill-custom').value.trim():'';
  return [...new Set([...selected,...(other?[other]:[])])];
}

/* The household drawn as a family tree. Every member's relationship is read relative to the person
   it names ("Related to"), or to the head when it names no one, and turned into parent and partner
   links. The tree is then drawn from the head's oldest recorded ancestor down: couples side by side
   on a ring, children beneath them, grandchildren beneath their own parent. Brothers and sisters
   whose parents are not in the household hang from a marker that says so, rather than from nothing.
   Guardians and other relatives, and anyone a link cannot place, stand alongside — nobody is dropped. */
function familyTree(h, focus) {
  const ms = h.members.map(person).filter(Boolean);
  if (!ms.length) return empty('family', t('No one in this household yet', 'لا أحد في هذه العائلة بعد'), t('Add the first member.', 'أضف الفرد الأول.'));
  const byId = new Map(ms.map(m => [m.id, m]));
  const anchor = byId.get(h.head) || ms.find(m => m.rel === 'head') || ms[0];
  const NORM = { son: 'child', daughter: 'child', father: 'parent', mother: 'parent' };
  const relOf = m => m === anchor ? 'head' : NORM[m.rel] || (!m.rel || m.rel === 'head' ? 'relative' : m.rel);
  const baseOf = m => byId.has(m.relativeTo) && m.relativeTo !== m.id ? m.relativeTo : anchor.id;
  const parents = new Map(), kidsOf = new Map(), partner = new Map(), ghosts = new Map(), side = [];
  const isGhost = id => ghosts.has(id), realParents = id => (parents.get(id) || []).filter(x => !isGhost(x));
  const link = (parent, kid) => {
    if (!kidsOf.has(parent)) kidsOf.set(parent, []);
    if (!parents.has(kid)) parents.set(kid, []);
    if (!kidsOf.get(parent).includes(kid)) kidsOf.get(parent).push(kid);
    if (!parents.get(kid).includes(parent)) parents.get(kid).push(parent);
  };
  const pair = (x, y) => { partner.set(x, y); partner.set(y, x); };
  const ghost = (kind, base) => { const id = `ghost:${kind}:${base}`; ghosts.set(id, kind); return id; };
  const others = ms.filter(m => m !== anchor);
  /* first the direct links: partners, children, parents */
  for (const m of others) {
    const r = relOf(m), b = baseOf(m);
    if (r === 'spouse') partner.has(b) || partner.has(m.id) ? side.push(m) : pair(b, m.id);
    else if (r === 'child') link(b, m.id);
    else if (r === 'parent') realParents(b).length < 2 ? link(m.id, b) : side.push(m);
  }
  for (const ps of parents.values()) if (ps.length === 2 && !partner.has(ps[0]) && !partner.has(ps[1])) pair(ps[0], ps[1]);
  /* then the links that hang off those: brothers and sisters, grandchildren */
  for (const m of others) {
    const r = relOf(m), b = baseOf(m);
    if (r === 'sibling') {
      if (realParents(b).length) link(realParents(b)[0], m.id);
      else if (b === anchor.id || !partner.has(b)) { const g = ghost('parents', b); link(g, b); link(g, m.id); }
      else side.push(m);
    } else if (r === 'grandchild') {
      const kids = (kidsOf.get(b) || []).filter(k => !isGhost(k));
      if (kids.length === 1) link(kids[0], m.id); else { const g = ghost('child', b); link(b, g); link(g, m.id); }
    } else if (!['spouse', 'child', 'parent'].includes(r)) side.push(m);
  }
  /* lay the tree out from the head's oldest recorded ancestor, then anyone not reached yet */
  const born = id => byId.get(id)?.born || '9999';
  const placed = new Set();
  const unit = id => {
    placed.add(id);
    const pt = partner.has(id) && !placed.has(partner.get(id)) ? partner.get(id) : null;
    if (pt) placed.add(pt);
    const kids = [...new Set([...(kidsOf.get(id) || []), ...(pt ? kidsOf.get(pt) || [] : [])])]
      .filter(k => !placed.has(k)).sort((x, y) => born(x).localeCompare(born(y)));
    kids.forEach(k => placed.add(k));
    return { id, pt, kids: kids.map(k => { placed.delete(k); return unit(k); }) };
  };
  let top = anchor.id;
  for (const seen = new Set(); (parents.get(top) || []).length && !seen.has(top); ) { seen.add(top); top = parents.get(top)[0]; }
  const sideIds = new Set(side.map(m => m.id));
  const forest = [unit(top)];
  for (const id of [...byId.keys(), ...ghosts.keys()]) {
    if (placed.has(id) || sideIds.has(id) || (parents.get(id) || []).length || realParents(partner.get(id) || '').length) continue;
    const u = unit(id);
    if (u.kids.length || u.pt) forest.push(u);                 /* a second family line of its own */
    else if (!isGhost(id)) { side.push(byId.get(id)); sideIds.add(id); }   /* linked to no one drawn: stand alongside */
  }
  for (const m of ms) if (!placed.has(m.id) && !sideIds.has(m.id)) { side.push(m); sideIds.add(m.id); }

  const first = id => ((isAr() ? byId.get(id)?.ar : byId.get(id)?.lat) || byId.get(id)?.lat || '').split(' ')[0];
  const roleOf = m => {
    if (m === anchor) return h.head === m.id ? t('Head', 'ربّ العائلة') : relLabel(m, h);
    const lab = t(...(F.RELS.find(r => r[0] === (m.rel && m.rel !== 'head' ? m.rel : 'relative')) || F.RELS.at(-1)).slice(1));
    return baseOf(m) !== anchor.id ? `${lab} · ${first(baseOf(m))}` : lab;
  };
  const node = m => `<a class="ft-node ${m.id === focus ? 'me' : ''}" href="#/person/${m.id}/family">
      ${avatar(m, 'avatar-lg')}<b dir="auto">${esc(label(m))}</b><small class="ar" dir="auto">${esc(m.ar || '')}</small>
      <span class="ft-role">${esc(roleOf(m))}${/^\d{4}/.test(m.born || '') ? ` · <span class="mono">${m.born.slice(0, 4)}</span>` : ''}</span>
      ${m.id === focus ? `<span class="ft-here">${t('This record', 'هذا السجل')}</span>` : ''}</a>`;
  const cellOf = id => isGhost(id)
    ? `<span class="ft-ghost">${ghosts.get(id) === 'parents' ? t('Parents not recorded in this household', 'الوالدان غير مسجّلين في هذه العائلة') : t('Parent not recorded in this household', 'الوالد غير مسجّل في هذه العائلة')}</span>`
    : node(byId.get(id));
  const draw = u => `<div class="ft-family">
      <div class="ft-couple ${u.kids.length ? 'has-kids' : ''}">${cellOf(u.id)}${u.pt ? `<span class="ft-bond" role="img" aria-label="${t('married', 'متزوّجان')}">${icon('rings', 16)}</span>${cellOf(u.pt)}` : ''}</div>
      ${u.kids.length ? `<div class="ft-branch"><div class="ft-row">${u.kids.map(k => `<div class="ft-cell ${k.pt ? 'ft-pair' : ''}">${draw(k)}</div>`).join('')}</div></div>` : ''}
    </div>`;
  return `<div class="ftree"><div class="ft-canvas"><div class="ft-forest">${forest.map(draw).join('')}</div></div>
    ${side.length ? `<div class="ft-side"><span class="overline">${t('Also in the household', 'أيضاً في العائلة')}</span>
      <div class="ft-row">${side.map(node).join('')}</div></div>` : ''}</div>`;
}
const hh = id => HOUSEHOLDS.find(h => h.id === id);
const RITE_AR = { Maronite: 'ماروني', Melkite: 'روم كاثوليك', 'Greek Orthodox': 'روم أرثوذكس', Armenian: 'أرمني', 'Roman Catholic': 'لاتيني', Syriac: 'سرياني' };
const riteLabel = r => t(r, RITE_AR[r] || r);
const filteredPeople = () => PEOPLE.filter(x => (!S.ui.peopleStatus || S.ui.peopleStatus.includes(x.status))
  && (!S.ui.peopleTown || x.town === S.ui.peopleTown) && (!S.ui.peopleRite || x.rite === S.ui.peopleRite)
  && (!S.ui.peopleEnv || hh(x.hh)?.envelope)
  && matches(`${x.lat} ${x.ar} ${x.phone} ${hh(x.hh)?.envelope || ''}`, S.ui.peopleQ || ''));
const csvCell = value => `"${String(value ?? '').replace(/"/g,'""')}"`;
function peopleExport() {
  const selected = [...document.querySelectorAll('#view tr[data-ri-p] [data-row]:checked')].map(c=>c.closest('tr').dataset.riP);
  const options = [['english','English name','الاسم الإنكليزي'],['arabic','Arabic name','الاسم العربي'],['phone','Phone','الهاتف'],
    ['town','Town','البلدة'],['rite','Rite','الطقس'],['status','Status','الحالة'],['household','Household','العائلة'],
    ['envelope','Offering-envelope identifier','رمز مظروف العطاء'],['birth','Date of birth','تاريخ الولادة']];
  openModal({title:t('Export people','تصدير المؤمنين'),sub:t('Choose the records and fields in this CSV file.','اختر السجلات والحقول لهذا الملف.'),
    body:`<div class="formrow"><label class="label" for="ex_scope">${t('Scope','النطاق')}</label><select class="select" id="ex_scope">
      ${selected.length ? `<option value="selected">${t(`Selected people on this page (${selected.length})`,`المحدّدون في هذه الصفحة (${selected.length})`)}</option>` : ''}
      <option value="filtered">${t(`Current filtered results (${filteredPeople().length})`,`نتائج المرشّح الحالي (${filteredPeople().length})`)}</option>
      <option value="all">${t(`All active people (${PEOPLE.length})`,`جميع المؤمنين النشطين (${PEOPLE.length})`)}</option></select></div>
      <div class="label" style="margin:16px 0 8px">${t('Fields to include','الحقول المطلوبة')}</div>
      <div class="choice-grid">${options.map(([key,en,ar],i)=>`<label class="row"><input type="checkbox" data-export-field="${key}" ${i<6?'checked':''}><span>${t(en,ar)}</span></label>`).join('')}</div>`,
    foot:`<button class="btn btn-secondary" data-close>${t('Cancel','إلغاء')}</button><button class="btn btn-primary" id="export-confirm">${t('Download CSV','تنزيل CSV')}</button>`,
    onMount(el){el.querySelector('#export-confirm').addEventListener('click',()=>{
      const chosen=[...el.querySelectorAll('[data-export-field]:checked')].map(c=>c.dataset.exportField);
      if (!chosen.length) return toast(t('Choose at least one field','اختر حقلاً واحداً على الأقل'),'','warning');
      const scope=el.querySelector('#ex_scope').value;
      const rows=(scope==='all'?PEOPLE:scope==='filtered'?filteredPeople():PEOPLE.filter(p=>selected.includes(p.id)));
      const values={english:p=>p.lat,arabic:p=>p.ar,phone:p=>p.phone,town:p=>p.town,rite:p=>p.rite,status:p=>p.status,
        household:p=>hh(p.hh)?.name||'',envelope:p=>hh(p.hh)?.envelope||'',birth:p=>p.born};
      download(`parishlife-people-${scope}.csv`,[chosen.map(k=>csvCell(options.find(x=>x[0]===k)[1])).join(','),
        ...rows.map(p=>chosen.map(k=>csvCell(values[k](p))).join(','))].join('\r\n'));
      closeOverlays();toast(t('People exported','صُدّر المؤمنون'),`${rows.length} ${t('records','سجلّاً')}`,'success');
    });}
  });
}
const TABS = () => [['', 'All people', 'كل المؤمنين'], ['duplicates', 'Duplicates', 'التكرارات', DUPLICATES.length],
              ['import', 'Import', 'استيراد'],
              ['archived', 'Archived', 'المؤرشفون', ARCHIVED.length]];

/* ---------------- list ---------------- */
export function people(tab = '') {
  const head = pageHead({
    crumbs: [{ label: t('Records', 'السجلات'), href: '#/people' }, { label: t('People', 'المؤمنون') }],
    title: t('Parishioners', 'المؤمنون'),
    sub: `<span dir="ltr" class="tnum">${num(PEOPLE.length)}</span> ${t(`records · ${HOUSEHOLDS.length} households · updated today`, `سجلاً · ${HOUSEHOLDS.length} عائلة · حُدّثت اليوم`)}`,
    actions: `<button class="btn btn-secondary" id="people-directory">${icon('print',17)}${t('Print directory','طباعة الدليل')}</button>
      <button class="btn btn-secondary" id="people-export">${icon('export', 17)}${t('Export people', 'تصدير المؤمنين')}</button>
      ${C.splitBtn(t('New parishioner', 'مؤمن جديد'), 'newp')}`
  }) + tabBar('people', TABS(), tab);

  if (tab === 'duplicates') return head + duplicates();
  if (tab === 'import') return head + importView();
  if (tab === 'archived') return head + archived();

  /* Real pagination over what is loaded — ten rows a page, as a secretary scans a page at a time. */
  const q = S.ui.peopleQ || '', town = S.ui.peopleTown || '', rite = S.ui.peopleRite || '';
  const visible = filteredPeople();
  const PER = 10, pages = Math.max(1, Math.ceil(visible.length / PER));
  S.ui.peoplePage = Math.min(S.ui.peoplePage, pages - 1);
  const from = S.ui.peoplePage * PER, pageRows = visible.slice(from, from + PER);
  const rows = pageRows.map(p => ({
    cls: 'clickable', attrs: `data-ri-p="${p.id}"`,
    detail: `<div class="grid g3" style="gap:20px">
        <dl class="dl"><dt>${t('Household', 'العائلة')}</dt><dd>${hh(p.hh) ? esc(t(hh(p.hh).name, hh(p.hh).ar)) : '—'}</dd>
          <dt>${t('Phone', 'الهاتف')}</dt><dd class="mono">+961 ${p.phone}</dd></dl>
        <dl class="dl"><dt>${t('Groups', 'المجموعات')}</dt><dd>${GROUPS.filter(g => GROUP_DETAIL[g.id]?.roster?.some(r => r.p === p.id)).map(g => esc(t(g.name, g.ar))).join(', ') || '—'}</dd>
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
      <button class="savedview" data-act="people-env" aria-pressed="${!!S.ui.peopleEnv}" style="margin-inline-start:auto">${icon(S.ui.peopleEnv ? 'check' : 'filter', 14)}${t('Household envelopes', 'مظاريف العائلات')}</button>
    </div>
    ${S.ui.peopleEnv ? `<p class="help" style="margin-bottom:12px">${t('A numbered giving envelope belongs to a household. It connects counted gifts and statements to that household; its members are listed for lookup, not as individual donors.', 'المظروف المرقّم للعطاء يتبع العائلة المنزلية. يربط التقدمات وكشوفها بها؛ ويظهر أفرادها للبحث لا لأن كل فرد متبرّع.')}</p>` : ''}
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
    ...(canSee('sacraments') ? [{ label: t('Certificate', 'شهادة'), icon: 'doc', sub: [
      { label: t('Arabic — A4', 'عربي — A4'), fn: () => cert('arabic') },
      { label: t('English — A4', 'إنكليزي — A4'), fn: () => cert('english') },
      { label: t('Bilingual — A4', 'ثنائي — A4'), fn: () => cert('bilingual') }] }] : []),
    ...(ARCHIVED.includes(p)?[{ label:t('Restore to active list','استرجاع إلى اللائحة النشطة'),icon:'box',fn:()=>F.restorePerson(pid) }]:
      [{ label: t('Archive — hide from active list', 'أرشفة — إخفاء من اللائحة النشطة'), icon: 'box', fn: () => { F.archivePeople([pid]); if (S.route === 'person') go('people'); } }]),
    { sep: true },
    { label: t('Delete permanently — cannot be undone', 'حذف نهائي — لا تراجع'), icon: 'trash', danger: true, fn: () => deleteGuard(p) }
  ], { width: 230 });
}

/* Destructive — typed confirmation, exactly as sheet 04 draws it. */
/** Typed confirmation before a permanent delete. dry: the style-guide specimen, which
    shows the whole flow but leaves the register untouched. */
export function deleteGuard(p, { dry = false } = {}) {
  const mentions = (value, id) => value === id || (Array.isArray(value) && value.some(x=>mentions(x,id))) ||
    (value && typeof value === 'object' && Object.entries(value).some(([key, item])=>key===id||mentions(item,id)));
  const excluded=new Set(['PEOPLE','ARCHIVED','PERSON_EXTRA','PHOTOS','PREFS','HOUSEHOLDS','GROUP_DETAIL','NOTES','SACRAMENTS','PLEDGES','BATCH']);
  const otherLinks=Object.entries(D).filter(([key,value])=>!excluded.has(key)&&typeof value==='object'&&value!==null&&mentions(value,p.id)).length+
    PEOPLE.concat(ARCHIVED).filter(other=>other.id!==p.id&&mentions(other,p.id)).length;
  const links=[
    [t('Sacrament records','سجلات الأسرار'),SACRAMENTS.filter(s=>s.person===p.id).length],
    [t('Households','العائلات'),HOUSEHOLDS.filter(h=>h.members.includes(p.id)).length],
    [t('Group memberships','عضويات المجموعات'),Object.values(GROUP_DETAIL).filter(d=>d.roster?.some(r=>r.p===p.id)).length],
    [t('Pastoral items','بنود رعوية'),NOTES.filter(n=>n.p===p.id).length],
    [t('Offering and pledge records','سجلات العطاء والتعهد'),PLEDGES.filter(x=>x.p===p.id).length+BATCH.lines.filter(x=>x.p===p.id).length],
    [t('Other linked records','سجلات مرتبطة أخرى'),otherLinks]
  ];
  const blocked=!dry&&links.some(([,count])=>count);
  openModal({
    title: blocked?t('Cannot permanently delete this linked record','لا يمكن حذف هذا السجل المرتبط نهائياً'):t('Permanently delete this record?', 'حذف هذا السجل نهائياً؟'),
    sub: blocked?t('Archive it to remove it from active lists while preserving its history.','أرشفه لإزالته من اللوائح النشطة مع الحفاظ على تاريخه.'):
      t('This cannot be undone. Review the record before deleting.','لا يمكن التراجع. راجع السجل قبل حذفه.'),
    body: `<div class="stack">${links.map(([a, b]) => `<div class="listrow" style="padding-inline:0">
        <span class="grow">${esc(a)}</span><b class="mono">${esc(b)}</b></div>`).join('')}</div>
      ${blocked?'':`<div class="formrow" style="margin-top:16px"><label class="label">${t('Type', 'اكتب')} <b>${esc(p.lat)}</b> ${t('to confirm', 'للتأكيد')}</label>
        <input class="input" id="dg_in" autocomplete="off"></div>
      <span class="help help-error" id="dg_help">${t('The name does not match yet.', 'الاسم لا يطابق بعد.')}</span>`}`,
    foot: `<button class="btn btn-secondary" data-close>${t('Keep record', 'الاحتفاظ بالسجل')}</button>
      ${blocked?'':`<button class="btn btn-danger" id="dg_go" disabled style="margin-inline-start:auto">${t('Delete permanently', 'حذف نهائي')}</button>`}`,
    onMount(el) {
      if(blocked)return;
      const inp = el.querySelector('#dg_in'), b = el.querySelector('#dg_go'), h = el.querySelector('#dg_help');
      inp.addEventListener('input', () => {
        const okk = inp.value.trim() === p.lat; b.disabled = !okk;
        h.classList.toggle('help-error', !okk); h.classList.toggle('help-ok', okk);
        h.textContent = okk ? t('Match.', 'مطابق.') : t('The name does not match yet.', 'الاسم لا يطابق بعد.');
      });
      b.addEventListener('click', async () => {
        b.disabled=true;
        closeOverlays();
        if (dry) return toast(t('Confirmed', 'تمّ التأكيد'), t('Style-guide specimen — the register is untouched.', 'نموذج من دليل التصميم — السجل لم يُمَسّ.'));
        const source=PEOPLE.includes(p)?PEOPLE:ARCHIVED;
        const index=source.indexOf(p);
        if(index<0)return toast(t('Record changed','تغيّر السجل'),t('Reload and review the current record before deleting.','أعد التحميل وراجع السجل الحالي قبل الحذف.'),'warning');
        source.splice(index, 1);
        delete PERSON_EXTRA[p.id];delete PHOTOS[p.id];
        if(!await persist())return;
        if (S.route === 'person') go('people'); else bus.refresh();
        toast(t('Record deleted', 'حُذف السجل'), p.lat, 'danger');
      });
    }
  });
}

people.mount = host => {
  C.wire(host);
  wireImport(host);
  host.querySelector('#people-export')?.addEventListener('click', peopleExport);
  host.querySelector('#people-directory')?.addEventListener('click', printPeopleDirectory);
  host.querySelectorAll('[data-delete-archived]').forEach(button=>button.addEventListener('click',()=>{
    const archived=ARCHIVED.find(person=>person.id===button.dataset.deleteArchived);
    if(archived)deleteGuard(archived);
  }));
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
    ...(canSee('requests') ? [{ label: t('New certificate request', 'طلب شهادة جديد'), icon: 'doc', fn: () => go('requests') }] : [])
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
let importDraft = null;
const importFields = [['lat','English name'],['ar','Arabic name'],['phone','Phone'],['born','Birth date'],['town','Town'],['rite','Rite'],['occupation','Line of work']];
function parseCsv(source) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(ch==='"') {if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted)throw new Error(t('Unclosed quotation mark in CSV','علامة اقتباس غير مغلقة في CSV'));
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
function importMapping(header){
  const normalized=header.toLowerCase().replace(/[^a-z]/g,'');
  return ({englishname:'lat',name:'lat',arabicname:'ar',phone:'phone',phonenumber:'phone',birthdate:'born',dateofbirth:'born',town:'town',rite:'rite',lineofwork:'occupation',occupation:'occupation'})[normalized]||'';
}
function importReview(){
  if(!importDraft)return [];
  const used=new Set();
  return importDraft.rows.map((row,index)=>{
    const record={};importDraft.map.forEach((field,col)=>{if(field)record[field]=(row[col]||'').trim();});
    const errors=[];
    if(!record.lat||!record.ar)errors.push(t('Both names required','الاسمان مطلوبان'));
    if(record.born&&!/^\d{4}-\d{2}-\d{2}$/.test(record.born))errors.push(t('Birth date must be YYYY-MM-DD','تاريخ الولادة يجب أن يكون YYYY-MM-DD'));
    const key=`${(record.lat||'').toLowerCase()}|${record.born||''}`;
    if(used.has(key)||PEOPLE.some(p=>p.lat.toLowerCase()===(record.lat||'').toLowerCase()&&(!record.born||p.born===record.born)))errors.push(t('Possible duplicate','سجل محتمل مكرّر'));
    used.add(key);
    return {line:index+2,record,errors};
  });
}
function importView() {
  const review=importReview(),valid=review.filter(x=>!x.errors.length),invalid=review.filter(x=>x.errors.length);
  const duplicates=importDraft?.map.filter(Boolean).filter((x,i,a)=>a.indexOf(x)!==i)||[];
  return `<div class="stack" style="margin-top:20px;gap:16px">
    ${panel(t('1 · Choose a CSV file','١ · اختر ملف CSV'),`<input class="input" type="file" id="people-import-file" accept=".csv,text/csv" aria-label="${t('Choose CSV file','اختر ملف CSV')}">
      ${importDraft?`<p class="help">${esc(importDraft.name)} · ${importDraft.rows.length} ${t('data rows','صفوف بيانات')}</p>`:`<p class="help">${t('Use a CSV file with column headings. Nothing is saved until you review and confirm.','استخدم ملف CSV بعناوين أعمدة. لا يُحفظ شيء قبل المراجعة والتأكيد.')}</p>`}`)}
    ${importDraft?panel(t('2 · Map columns','٢ · طابق الأعمدة'),table({cols:[{label:t('File column','عمود الملف')},{label:t('Save as','احفظ باسم')}],rows:importDraft.header.map((name,i)=>({cells:[esc(name),`<select class="select" data-import-map="${i}" aria-label="${t('Map column','طابق العمود')} ${esc(name)}"><option value="">${t('Skip','تخطّ')}</option>${importFields.map(([key,label])=>`<option value="${key}" ${importDraft.map[i]===key?'selected':''}>${t(label,label)}</option>`).join('')}</select>`]}))}),{tight:true}):''}
    ${importDraft?panel(t('3 · Review and save','٣ · راجع واحفظ'),`${duplicates.length?`<p class="alert alert-warning">${t('A destination field is mapped more than once. Choose each field once.','حقل الهدف محدّد أكثر من مرة. اختر كل حقل مرة واحدة.')}</p>`:''}
      <div class="stats">${stat(t('Ready','جاهز'),valid.length)}${stat(t('Needs correction','يحتاج تصحيحاً'),invalid.length)}</div>
      ${table({cols:[{label:t('Row','الصف')},{label:t('English name','الاسم الإنكليزي')},{label:t('Arabic name','الاسم العربي')},{label:t('Result','النتيجة')}],rows:review.slice(0,100).map(item=>({cells:[String(item.line),esc(item.record.lat||'—'),esc(item.record.ar||'—'),item.errors.length?esc(item.errors.join(' · ')):pill(t('Ready','جاهز'),'success')]}))})}
      ${review.length>100?`<p class="help">${t('Showing the first 100 rows; every row is validated before save.','تظهر أول ١٠٠ صف؛ يُفحص كل صف قبل الحفظ.')}</p>`:''}
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" id="people-import-save" ${!valid.length||invalid.length||duplicates.length?'disabled':''}>${t('Import reviewed records','استيراد السجلات المراجعة')}</button></div>`,{tight:true}):''}
    ${importDraft?.result?`<p class="alert alert-success">${esc(importDraft.result)}</p>`:''}
  </div>`;
}
function wireImport(host){
  host.querySelector('#people-import-file')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(file.size>2_000_000)return toast(t('File exceeds 2 MB','الملف أكبر من ٢ ميغابايت'),'','warning');
    try {const [header,...rows]=parseCsv((await file.text()).replace(/^\uFEFF/,''));
      if(!header?.length||!rows.length)throw new Error(t('CSV has no data rows','ملف CSV بلا صفوف بيانات'));
      if(rows.length>2000)throw new Error(t('Import at most 2,000 people at a time','استورد حتى ٢٠٠٠ شخص في المرة'));
      importDraft={name:file.name,header,rows,map:header.map(importMapping),result:''};bus.refresh();
    }catch(error){toast(t('Cannot read CSV','تعذّرت قراءة CSV'),error.message,'danger');}
  });
  host.querySelectorAll('[data-import-map]').forEach(select=>select.addEventListener('change',()=>{importDraft.map[Number(select.dataset.importMap)]=select.value;bus.refresh();}));
  host.querySelector('#people-import-save')?.addEventListener('click',async button=>{
    const review=importReview();if(!review.length||review.some(x=>x.errors.length))return;
    if(new Set(importDraft.map.filter(Boolean)).size!==importDraft.map.filter(Boolean).length)return;
    const started=Date.now();
    review.forEach((item,i)=>{const r=item.record,id=`p${(started+i).toString(36)}`;
      PEOPLE.push({id,lat:r.lat,ar:r.ar,phone:r.phone||'—',born:r.born||'',town:r.town||'',townAr:'',rite:r.rite||'Maronite',status:'member',hh:null,tags:[]});
      PERSON_EXTRA[id]={occupation:r.occupation||'',skills:[],dates:[]};
    });
    if(!await persist())return;
    D.PARISH.people=PEOPLE.length;importDraft={...importDraft,rows:[],result:`${review.length} ${t('people imported','شخصاً استُوردوا')}`};
    bus.refresh();toast(t('Import complete','اكتمل الاستيراد'),`${review.length} ${t('records','سجلات')}`,'success');
  });
}

/* ---------------- archived ---------------- */
function archived() {
  return `<div class="tabbody">
    ${C.inlineAlert('info', t('Archived records remain restorable', 'تبقى السجلات المؤرشفة قابلة للاسترجاع'),
      t('Archive removes a person from active lists and preserves linked history. Permanent deletion requires an unlinked record and typed confirmation.',
        'تزيل الأرشفة الشخص من اللوائح النشطة وتحفظ السجلات المرتبطة به. يتطلّب الحذف النهائي سجلاً بلا روابط وتأكيداً بكتابة الاسم.'))}
    ${table({
      cols: [{ label: t('Name', 'الاسم') }, { label: t('Archived', 'أُرشف') }, { label: t('By', 'بواسطة'), cls: 'hide-sm' },
             { label: '', cls: 'shrink' }],
      rows: ARCHIVED.map(p => ({ cells: [
        `<a href="#/person/${esc(p.id)}"><b>${esc(isAr() ? p.ar : p.lat)}</b></a>`,
        `<span class="mono dim">${fmtDate(p.archived)}</span>`,
        `<span class="dim">${esc(isAr() ? person(p.archivedBy)?.ar || '—' : person(p.archivedBy)?.lat || '—')}</span>`,
        `<span class="row" style="gap:6px"><button class="btn btn-secondary btn-dense" data-act="restore:${p.id}">${t('Restore', 'استرجاع')}</button>
          <button class="btn btn-danger-quiet btn-dense" data-delete-archived="${esc(p.id)}">${t('Review deletion', 'مراجعة الحذف')}</button></span>`
      ]})),
      empty: empty('people', t('Nobody is archived', 'لا أحد مؤرشف'), t('Archive someone from their row menu; they can be restored here.', 'أرشف شخصاً من قائمة صفّه؛ ويمكن استرجاعه هنا.'))
    })}
    </div>`;
}

/* ---------------- person detail ---------------- */
const PTABS = pid => [['', 'Profile', 'الملف'], ['family', 'Family', 'العائلة'], ['groups', 'Groups', 'المجموعات'], ['sacraments', 'Sacraments', 'الأسرار', SACRAMENTS.filter(x => x.person === pid).length],
               ['attendance', 'Group attendance', 'حضور المجموعات'], ['giving', 'Giving', 'التقدمات'],
               ['activity', 'Activity', 'النشاط'], ['notes', 'Notes', 'ملاحظات'], ['files', 'Files', 'ملفات'], ['consent', 'Consent', 'الموافقات']];

export function personView(id, tab = '') {
  const p = person(id);
  if (!p) return empty('people', t('No such record', 'لا سجلّ بهذا الرقم'),
    t('The link may be stale.', 'قد يكون الرابط قديماً.'),
    `<a class="btn btn-primary" href="#/people">${t('Back to people', 'العودة إلى المؤمنين')}</a>`);

  const house = hh(p.hh), x = PERSON_EXTRA[p.id] || {};
  const tabs = PTABS(p.id).filter(tb => (tb[0] !== 'giving' || canSee('giving')) && (tb[0] !== 'notes' || is('priest')) && (tb[0] !== 'groups' || canSee('groups')) && (tb[0] !== 'sacraments' || canSee('sacraments')));

  const head = `<div class="pagehead"><div class="entityhead" style="width:100%">
      <span style="margin-top:22px;display:flex">${avatar(p, 'avatar-xl')}</span>
      <div class="id">
        <nav class="crumbs"><a href="#/people">${t('People', 'المؤمنون')}</a><span class="sep">/</span><span>${esc(label(p))}</span></nav>
        <h1 style="font:600 26px/34px var(--sans);letter-spacing:-.02em">${esc(label(p))}
          ${status(p.status)}<span class="pill">${esc(riteLabel(p.rite))}</span></h1>
        <div class="meta"><span style="font-family:var(--arabic)" dir="auto">${esc(p.ar || '')}</span>
          ${house?.envelope ? ` · ${t('Offering-envelope identifier', 'رمز مظروف العطاء')} <span class="mono">${esc(house.envelope)}</span>` : ''} · ${esc(t(p.town, p.townAr))}</div>
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
          <dt>${t('English name', 'الاسم الإنكليزي')}</dt><dd>${esc(p.lat)}</dd>
          <dt>${t('Arabic name', 'الاسم العربي')}</dt><dd style="font-family:var(--arabic);font-size:16px">${esc(p.ar)}</dd>
          <dt>${t('Born', 'الولادة')}</dt><dd class="mono" dir="ltr">${p.born}</dd>
          <dt>${t('Rite', 'الطقس')}</dt><dd>${esc(riteLabel(p.rite))}</dd>
          <dt>${t('Phone', 'الهاتف')}</dt><dd class="mono" dir="ltr">${p.phone === '—' ? '—' : '+961 ' + p.phone}</dd>
          <dt>${t('Address', 'العنوان')}</dt><dd>${house ? esc(t(house.address, house.addressAr)) : '—'}</dd>
          <dt>${t('Line of work','المهنة')}</dt><dd>${esc(x.occupation||'—')}</dd>
          <dt>${t('Language', 'اللغة')}</dt><dd>${x.lang === 'ar' ? t('Arabic', 'العربية') : t('English', 'الإنكليزية')}</dd>
          <dt>${t('Reach them on', 'التواصل عبر')}</dt><dd>${esc({ whatsapp: 'WhatsApp', sms: 'SMS', email: t('Email', 'بريد إلكتروني') }[x.channel] || 'WhatsApp')}</dd>
          <dt>${t('Blood type', 'زمرة الدم')}</dt><dd class="mono">${esc(x.blood || '—')}</dd>
          <dt>${t('Directory', 'الدليل')}</dt><dd>${x.directory ? t('Listed, by consent', 'مدرَج بموافقته') : t('Not listed', 'غير مدرَج')}</dd>
        </dl>`)}
        ${panel(t('Skills and important dates', 'المهارات والتواريخ المهمّة'), `
          <div class="row" style="justify-content:flex-end"><button class="btn btn-secondary btn-dense" id="edit-profile-extra">${icon('edit',15)}${t('Edit skills and dates','تعديل المهارات والتواريخ')}</button></div>
          <h4 class="t-ui">${t('Skills','المهارات')}</h4>
          <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${(x.skills || []).length ? x.skills.map(s => `<span class="chip">${esc(s)}</span>`).join('') : `<span class="dim">${t('No skills recorded.','لا مهارات مسجّلة.')}</span>`}</div>
          <div class="divider"></div>
          <h4 class="t-ui">${t('Important dates','التواريخ المهمّة')}</h4>
          ${(x.dates || []).map(([en, ar, d]) => `<div class="listrow" style="padding-inline:0">
            <span class="grow"><b>${esc(t(en, ar))}</b></span><span class="mono dim">${d ? fmtDate(d) : '—'}</span></div>`).join('')
            || `<p class="t-caption dim">${t('No dates recorded.', 'لا تواريخ مسجّلة.')}</p>`}
          ${(x.fields || []).length ? `<div class="divider"></div><div class="ac-group" style="padding-inline:0">${t('Parish fields', 'حقول الرعية')}</div>
            ${x.fields.map(([en, ar, v]) => `<div class="listrow" style="padding-inline:0"><span class="grow">${esc(t(en, ar))}</span><b>${esc(v)}</b></div>`).join('')}` : ''}`)}
      </div>
      <div class="sidecol">
        ${panel(t('Household', 'العائلة'), house ? house.members.map(person).filter(Boolean).map(m =>
          `<a class="listrow" href="#/person/${m.id}">${who(m)}<span class="grow"></span>
            ${m.id === house.head ? pill(t('Head', 'ربّ العائلة'), 'info') : ''}</a>`).join('')
          : empty('family', t('No household', 'لا عائلة'), t('Recorded on their own.', 'مسجّل بمفرده.')), { tight: !!house })}
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

    groups: () => {
      const memberships = new Set(Object.entries(GROUP_DETAIL).filter(([, d]) => d.roster?.some(r => r.p === p.id)).map(([gid]) => gid));
      return panel(t('Parish groups', 'مجموعات الرعية'),
        GROUPS.filter(g=>memberships.has(g.id)).map(g=>`<a class="listrow" href="#/groups/${esc(g.id)}"><b class="grow">${esc(t(g.name,g.ar))}</b><span class="dim">${esc(t(g.cat,g.catAr))}</span></a>`).join('') || `<p class="dim">${t('No group memberships.','لا عضوية في مجموعات.')}</p>`,
        {tight:true,more:`<button class="btn btn-secondary btn-dense" id="edit-person-groups">${icon('edit',15)}${t('Edit memberships','تعديل العضويات')}</button>`});
    },

    attendance: () => {
      const entries=GROUPS.flatMap(g=>(GROUP_DETAIL[g.id]?.meetings||[]).filter(m=>m.attendance?.[p.id]).map(m=>({group:g,meeting:m,mark:m.attendance[p.id]})));
      return panel(t('Group meeting attendance','حضور اجتماعات المجموعات'), entries.length ? table({cols:[{label:t('Group','المجموعة')},{label:t('Meeting','الاجتماع')},{label:t('Date','التاريخ')},{label:t('Attendance','الحضور')}],
        rows:entries.map(({group,meeting,mark})=>({cells:[`<a href="#/groups/${esc(group.id)}">${esc(t(group.name,group.ar))}</a>`,`<a href="#/groups/${esc(group.id)}/meetings">${esc(t(meeting.title||meeting.topic||'Meeting',meeting.titleAr||meeting.topicAr||'اجتماع'))}</a>`,fmtDate(meeting.date||meeting.d),status(mark)]}))})
        : empty('groups',t('No group attendance recorded','لا حضور مجموعات مسجّلاً'),t('Attendance is recorded only at group meetings and activities.','يسجّل الحضور فقط في اجتماعات المجموعات وأنشطتها.')),{tight:true});
    },

    activity: () => {
      const entries=[
        ...SACRAMENTS.filter(s=>s.person===p.id).map(s=>({date:s.date,label:t('Sacrament recorded','سُجّل سرّ'),detail:`${s.kind} · ${s.reg}`})),
        ...GROUPS.flatMap(g=>(GROUP_DETAIL[g.id]?.meetings||[]).filter(m=>m.attendance?.[p.id]).map(m=>({date:m.date||m.d,label:t('Meeting attendance','حضور اجتماع'),detail:`${t(g.name,g.ar)} · ${m.attendance[p.id]}`})))
      ].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      return panel(t('Recorded activity','النشاط المسجّل'),entries.length?table({cols:[{label:t('Date','التاريخ')},{label:t('Activity','النشاط')},{label:t('Detail','التفاصيل')}],rows:entries.map(e=>({cells:[fmtDate(e.date),esc(e.label),esc(e.detail)]}))}):empty('notes',t('No linked activity yet','لا نشاط مرتبط بعد'),t('Sacraments and recorded group attendance appear here.','تظهر هنا الأسرار وحضور المجموعات المسجّل.')),{tight:true});
    },

    giving: () => {
      const pledge = PLEDGES.find(z => z.p === p.id), gifts = BATCH.lines.filter(l => l.p === p.id);
      return `<div class="splitview"><div class="stack" style="gap:16px">
        ${panel(t('Offering-envelope identifier', 'رمز مظروف العطاء'), `<b class="mono">${esc(house?.envelope||'—')}</b>
          <p class="help">${t('This optional identifier belongs to the household. Membership does not make each person a donor.','هذا الرمز الاختياري يتبع العائلة. انتماء الشخص إليها لا يجعله متبرّعاً.')}</p>`)}
        ${panel(t('Contributions', 'المساهمات'), table({
          cols: [{ label: t('Date', 'التاريخ') }, { label: t('Fund', 'الصندوق') }, { label: 'USD', cls: 'num' }, { label: 'L.L', cls: 'num' }],
          rows: gifts.map(line => ({ cells: [
            `<span class="mono dim">${fmtDate(BATCH.date)}</span>`, `<span class="dim">${esc(t(FUNDS.find(f=>f.id===line.fund)?.name||line.fund,FUNDS.find(f=>f.id===line.fund)?.ar||line.fund))}</span>`,
            `<span class="num">${line.usd?usd(line.usd):'—'}</span>`, `<span class="num">${line.lbp?num(line.lbp):'—'}</span>`]})),
          empty:empty('giving',t('No attributed gifts in the current counting session','لا تقدمات منسوبة في جلسة العدّ الحالية'),
            t('Only gifts explicitly attributed to this person appear here.','تظهر هنا فقط التقدمات المنسوبة إلى هذا الشخص صراحةً.'))
        }), { tight: true })}
      </div>
      <div class="sidecol">
        ${pledge ? panel(t('Pledge', 'التعهّد'), `<div class="amount" dir="ltr"><span class="usd">${usd(pledge.paid)}</span>
          <span class="lbp">${t('of', 'من')} ${usd(pledge.pledged)}</span></div>
          <span class="meter" style="margin-top:10px"><i style="width:${Math.round(pledge.paid / pledge.pledged * 100)}%"></i></span>`) : ''}
        ${panel(t('Counting-session statement', 'كشف جلسة العدّ'), `<p class="t-caption dim">${t(
          'Shows only gifts recorded for this person in the current counting session. It is not a full-year or tax statement.',
          'يعرض فقط التقدمات المسجّلة لهذا الشخص في جلسة العدّ الحالية. ليس كشف سنة كاملة ولا مستنداً ضريبياً.')}</p>
          <button class="btn btn-secondary btn-dense" style="margin-top:10px" data-act="statement:${p.id}">${icon('doc', 15)}${t('Download statement', 'تنزيل الكشف')}</button>`)}
      </div></div>`;
    },

    notes: () => `<div class="tabbody">${panel(t('Pastoral notes', 'الملاحظات الرعوية'),
      NOTES.filter(n => n.p === p.id).map(n => `<div class="listrow" style="align-items:flex-start"><span class="grow"><small class="mono dim">${esc(n.at)}</small><span style="display:block">${esc(t(n.body, n.bodyAr))}</span></span>${n.priority !== 'ordinary' ? pill(t(n.priority === 'urgent' ? 'Urgent' : 'Needs attention', n.priority === 'urgent' ? 'عاجل' : 'تحتاج متابعة'), n.priority === 'urgent' ? 'danger' : 'warning') : ''}${C.iconBtn('edit', t('Edit', 'تعديل'), `data-act="note-edit:${n.id}"`)}</div>`).join('') || empty('notes', t('No pastoral notes yet', 'لا ملاحظات رعوية بعد'), t('A new note will appear here and in Pastoral Notes.', 'ستظهر الملاحظة الجديدة هنا وفي قسم الملاحظات الرعوية.')), { tight: true })}<button class="btn btn-primary" style="margin-top:16px" data-act="note-new:${p.id}">${icon('plus',16)}${t('Add pastoral note', 'إضافة ملاحظة رعوية')}</button></div>`,

    files: () => `<div style="max-width:720px">${panel(t('Attachments', 'المرفقات'), `
      <p class="help" style="margin-bottom:12px">${t('Only real uploaded files appear here. Access and deletion are logged.','تظهر هنا الملفات المرفوعة فعلياً فقط. يُسجّل فتحها وحذفها.')}</p>
      ${C.dropzone('pfiles',{scope:'person',ownerId:p.id})}`)}</div>`,

    consent: () => `<div style="max-width:720px">${panel(t('Consent', 'الموافقات'), `
      <div class="stack" style="gap:12px">
        ${C.switchRow(t('Parish announcements on WhatsApp','إعلانات الرعية على واتساب'),{checked:x.consent?.[0]?.[2]??false,pref:`consent.${p.id}.0`})}
        <label class="switch"><input type="checkbox" id="directory-consent" ${x.directory?'checked':''}><span>${t('Printed parish people directory','دليل مؤمني الرعية المطبوع')}</span></label>
        <p class="help">${t('Includes names in English and Arabic, household, town, and phone only. Changes affect the next printed directory.','يشمل الاسمين الإنكليزي والعربي والعائلة والبلدة والهاتف فقط. تسري التغييرات على الدليل المطبوع التالي.')}</p>
        ${C.switchRow(t('Photos in parish media','الصور في وسائل الرعية'),{checked:x.consent?.[2]?.[2]??false,pref:`consent.${p.id}.2`})}
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
  host.querySelector('#edit-person-groups')?.addEventListener('click',()=>editPersonGroups(id));
  host.querySelector('#edit-profile-extra')?.addEventListener('click',()=>editProfileExtra(id));
  host.querySelector('#directory-consent')?.addEventListener('change',async e=>{
    const x=PERSON_EXTRA[id] ||= {};x.directory=e.target.checked;
    if(x.consent?.[1])x.consent[1][2]=x.directory;
    if(await persist())toast(t('Directory preference saved','حُفظ خيار الدليل'),'','success');
    else e.target.checked=!!PERSON_EXTRA[id]?.directory;
  });
};

function printPeopleDirectory() {
  const listed=PEOPLE.filter(p=>PERSON_EXTRA[p.id]?.directory).sort((a,b)=>a.lat.localeCompare(b.lat));
  if(!listed.length)return toast(t('Nobody to print yet','لا أحد للطباعة بعد'),t('Only people who opted in to the directory are printed.','لا يُطبع إلا من وافق على الإدراج في الدليل.'),'warning');
  /* printed from a hidden frame, so the page stays where it is and no new tab opens */
  printSheet({ title:t('Parish people directory','دليل مؤمني الرعية'), margin:'14mm',
    css:'h1{font:600 20px/28px Inter,sans-serif;margin:0 0 4px}p{margin:0 0 14px;color:#607068}table{width:100%;border-collapse:collapse}th,td{text-align:start;padding:7px 9px;border-bottom:1px solid #EDF0E8}th{background:#F7F7F2;font:600 10px/14px Inter,sans-serif;text-transform:uppercase;letter-spacing:.05em}',
    body:`<h1>${t('Parish people directory','دليل مؤمني الرعية')}</h1><p>${t('Only people who opted in are included.','يشمل فقط من وافقوا على الإدراج.')} · ${listed.length}</p>
    <table><thead><tr>${[t('English name','الاسم بالإنكليزية'),t('Arabic name','الاسم بالعربية'),t('Household','العائلة'),t('Town','البلدة'),t('Phone','الهاتف')].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>
    ${listed.map(p=>{const h=hh(p.hh);return `<tr><td dir="auto">${esc(p.lat)}</td><td dir="auto">${esc(p.ar)}</td><td>${esc(h?t(h.name,h.ar||h.name):'')}</td><td>${esc(t(p.town||'',p.townAr||p.town||''))}</td><td dir="ltr">${esc(p.phone==='—'?'':p.phone)}</td></tr>`;}).join('')}</tbody></table>` });
}

function editPersonGroups(id) {
  const before=new Set(Object.entries(GROUP_DETAIL).filter(([,d])=>d.roster?.some(r=>r.p===id)).map(([gid])=>gid));
  openModal({title:t('Edit group memberships','تعديل عضويات المجموعات'),
    sub:t('Choose groups, then review the changes before saving.','اختر المجموعات ثم راجع التغييرات قبل الحفظ.'),
    body:`<div class="choice-grid">${GROUPS.map(g=>`<label class="row"><input type="checkbox" value="${g.id}" data-group-choice ${before.has(g.id)?'checked':''}><span>${esc(t(g.name,g.ar))}</span></label>`).join('')}</div>`,
    foot:`<button class="btn btn-secondary" data-close>${t('Cancel','إلغاء')}</button><button class="btn btn-primary" id="group-review">${t('Review changes','مراجعة التغييرات')}</button>`,
    onMount(el){el.querySelector('#group-review').addEventListener('click',()=>{
      const after=new Set([...el.querySelectorAll('[data-group-choice]:checked')].map(x=>x.value));
      const added=GROUPS.filter(g=>after.has(g.id)&&!before.has(g.id));
      const removed=GROUPS.filter(g=>before.has(g.id)&&!after.has(g.id));
      if (!added.length&&!removed.length) {closeOverlays();return;}
      openModal({title:t('Confirm membership changes','تأكيد تغييرات العضوية'),body:`<p>${t('Add','إضافة')}: ${added.map(g=>esc(t(g.name,g.ar))).join(', ')||'—'}</p>
        <p>${t('Remove','إزالة')}: ${removed.map(g=>esc(t(g.name,g.ar))).join(', ')||'—'}</p>
        <p class="help">${t('This changes group rosters; earlier meeting attendance is preserved.','تتغيّر لوائح المجموعات وتبقى سجلات الحضور السابقة محفوظة.')}</p>`,
        foot:`<button class="btn btn-secondary" data-close>${t('Keep memberships','إبقاء العضويات')}</button><button class="btn btn-primary" id="group-confirm">${t('Save memberships','حفظ العضويات')}</button>`,
        onMount(confirm){confirm.querySelector('#group-confirm').addEventListener('click',async()=>{
          for(const g of added){const d=GROUP_DETAIL[g.id] ||= {roster:[],assistant:null,roles:[],requests:[],meetings:[],posts:[],files:[]};d.roster ||= [];
            if(!d.roster.some(r=>r.p===id))d.roster.push({p:id,role:'Member',roleAr:'عضو',joined:new Date().getFullYear().toString(),att:0});g.members=d.roster.length;}
          for(const g of removed){const d=GROUP_DETAIL[g.id];if(d){d.roster=d.roster.filter(r=>r.p!==id);g.members=d.roster.length;}}
          if(!await persist())return;
          closeOverlays();bus.refresh();toast(t('Memberships saved','حُفظت العضويات'),'','success');
        });}
      });
    });}
  });
}

function editProfileExtra(id) {
  const x=PERSON_EXTRA[id]||{};
  const dates=x.dates||[];
  openModal({title:t('Skills and important dates','المهارات والتواريخ المهمّة'),
    body:`${skillPicker(x.skills||[])}${occupationField('extra-occupation',x.occupation||'')}
      <div class="stack" id="extra-dates">${[...dates, ['', '', '']].map(([en,ar,d],i)=>`<div class="formgrid" data-date-row>
      ${C.field({label:t('Date label (English)','تسمية التاريخ (إنكليزي)'),value:en||'',id:`extra-en-${i}`})}
      ${C.field({label:t('Date label (Arabic)','تسمية التاريخ (عربي)'),value:ar||'',id:`extra-ar-${i}`})}
      ${C.field({label:t('Date','التاريخ'),type:'date',value:d||'',id:`extra-date-${i}`})}</div>`).join('')}</div>`,
    foot:`<button class="btn btn-secondary" data-close>${t('Cancel','إلغاء')}</button><button class="btn btn-primary" id="extra-save">${t('Save','حفظ')}</button>`,
    onMount(el){wireSkillPicker(el);el.querySelector('#extra-save').addEventListener('click',async()=>{
      const skills=selectedSkills(el);
      const occupation=el.querySelector('#extra-occupation').value.trim();
      const nextDates=[...el.querySelectorAll('[data-date-row]')].map(row=>[...row.querySelectorAll('input')].map(i=>i.value.trim())).filter(([en,ar,d])=>en||ar||d);
      if(nextDates.some(([en,ar,d])=>!en||!d))return toast(t('Complete each date label and date','أكمل تسمية كل تاريخ وتاريخه'),'','warning');
      PERSON_EXTRA[id]={...x,skills,occupation,dates:nextDates};
      if(!await persist())return;
      closeOverlays();bus.refresh();toast(t('Profile details saved','حُفظت تفاصيل الملف'),'','success');
    });}
  });
}

/* ---------------- households ---------------- */
export function households() {
  const open = h => `<a class="btn btn-ghost btn-dense" href="#/household/${h.id}">${t('Open household', 'فتح العائلة')}</a>`;
  const cards = HOUSEHOLDS.map(h => {
    const members = h.members.map(person).filter(Boolean);
    return `<section class="panel" data-find-item><div class="panel-b">
      <div class="row" style="gap:12px;align-items:flex-start">
        <span class="avatar avatar-lg">${esc(t(h.name, h.ar).slice(0, 2))}</span>
        <div style="flex:1;min-width:0">
          <b style="display:block;font:600 16px/22px var(--sans)">${esc(t(h.name, h.ar))}</b>
          <small class="t-caption dim">${esc(t(h.town, h.townAr))}${h.envelope ? ` · ${t('Offering envelope', 'مظروف العطاء')} <span class="mono">${esc(h.envelope)}</span>` : ''}</small>
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
    cols: [{ label: t('Family', 'العائلة'), sort: true }, { label: t('Town', 'البلدة'), cls: 'hide-sm' }, { label: t('Offering envelope', 'مظروف العطاء'), cls: 'shrink' },
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
      sub: t(`${HOUSEHOLDS.length} households · select existing people and enter their shared address once`,
             `${HOUSEHOLDS.length} عائلة · اختر الأشخاص المسجّلين وأدخل عنوانهم المشترك مرة واحدة`),
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
    <p class="help" style="margin-top:18px">${t('New households reuse existing people. Review suggested surname matches, select several members, and enter one shared address. No people or households are merged automatically. An offering-envelope identifier is optional.','تستخدم العائلات الجديدة أشخاصاً مسجّلين. راجع اقتراحات اسم العائلة، واختر عدة أفراد، وأدخل عنواناً مشتركاً واحداً. لا تُدمج السجلات تلقائياً. رمز مظروف العطاء اختياري.')}</p>
    <div class="find-empty" hidden>${empty('search', t('No household matches', 'لا عائلة مطابقة'), t('Try part of the family name or the envelope number.', 'جرّب جزءاً من اسم العائلة أو رقم المظروف.'))}</div>`;
}
households.mount = host => { C.wire(host); wireTables(host); };

export function householdView(id = '') {
  const h = HOUSEHOLDS.find(x => x.id === id);
  if (!h) return empty('family', t('Household not found', 'العائلة غير موجودة'),
    t('This household may have been removed.', 'ربما أزيلت هذه العائلة.'),
    `<a class="btn btn-primary" href="#/households">${t('Back to households', 'العودة إلى العائلات')}</a>`);
  const members = h.members.map(person).filter(Boolean);
  const view = S.ui.householdDetailView || 'both';
  return pageHead({
    crumbs: [{ label: t('Households', 'العائلات'), href: '#/households' }, { label: t(h.name, h.ar) }],
    title: t(h.name, h.ar),
    sub: t(`${members.length} household members`, `${members.length} أفراد`),
    actions: CR.recBtn('household', h.id)
  }) + `<div class="toolbar" style="margin:18px 0"><span class="seg" role="group" aria-label="${t('Household view','عرض العائلة')}">
    ${[['list','List','قائمة'],['tree','Tree','شجرة'],['both','Both','كلاهما']].map(([key,en,ar])=>`<button data-hh-detail-view="${key}" aria-pressed="${view===key}">${t(en,ar)}</button>`).join('')}</span></div>
    <div class="splitview"><div class="stack" style="gap:16px">
    ${view==='list'?'':panel(t('Family tree','شجرة العائلة'),familyTree(h,h.head))}
    ${view==='tree'?'':panel(t('Members and relationships', 'الأفراد وصلاتهم'), members.map(m =>
      `<a class="listrow" href="#/person/${m.id}">${who(m)}<span class="grow"></span><span class="dim">${esc(relLabel(m, h))}</span></a>`).join('') ||
      empty('family', t('No members', 'لا أفراد'), t('Add a member from a person record.', 'أضف فرداً من سجلّه.')), { tight: true })}
    </div>
    <div class="sidecol">${panel(t('Household details', 'تفاصيل العائلة'), `<dl class="dl">
      <dt>${t('Head', 'ربّ العائلة')}</dt><dd>${h.head ? `<a href="#/person/${h.head}">${esc(label(person(h.head)))}</a>` : '—'}</dd>
      <dt>${t('Giving envelope number', 'رقم مظروف العطاء')}</dt><dd>${esc(h.envelope || '—')}</dd>
      <dt>${t('Address', 'العنوان')}</dt><dd>${esc(t(h.address, h.addressAr))}</dd>
      <dt>${t('Town', 'البلدة')}</dt><dd>${esc(t(h.town, h.townAr))}</dd></dl>`)}</div></div>`;
}
householdView.mount = host => { C.wire(host);host.querySelectorAll('[data-hh-detail-view]').forEach(button=>button.addEventListener('click',()=>{S.ui.householdDetailView=button.dataset.hhDetailView;bus.refresh();})); };

/* ---------------- new-person drawer ---------------- */
export function newPersonDrawer() {
  delete PHOTOS.new;                                     // a photo left from a cancelled drawer does not carry over
  openDrawer({
    large: true,
    title: t('New parishioner', 'مؤمن جديد'),
    sub: t('Both names are required. The Arabic name is what a certificate prints.',
           'الاسمان مطلوبان. الاسم العربي هو ما تطبعه الشهادة.'),
    body: `${C.namePair()}${C.riteSelect()}${C.phoneField({ id: 'newphone', value:'', required:false })}
      <div class="formgrid">${C.field({ label: t('Date of birth', 'تاريخ الولادة'), type: 'date', id:'newborn' })}</div>
      ${occupationField('newoccupation')}
      <div class="divider"></div>
      <h4 class="t-ui" style="margin-bottom:12px">${t('Address', 'العنوان')}</h4>
      ${C.addressCascade()}
      <div class="divider"></div>
      <div class="formgrid">
        <div class="formrow"><label class="label" for="newblood">${t('Blood type', 'زمرة الدم')}<span class="opt">${t('(for emergencies)', '(للطوارئ)')}</span></label>
          <select class="select" id="newblood"><option value="">—</option><option>O+</option><option>O−</option><option>A+</option><option>B+</option><option>AB+</option></select></div>
        <div class="formrow"><label class="label">${t('Language', 'اللغة')}</label>
          <select class="select" id="newlang"><option value="ar">${t('Arabic', 'العربية')}</option><option value="en">${t('English', 'الإنكليزية')}</option><option value="fr">${t('French', 'الفرنسية')}</option></select></div>
      </div>
      <div class="formrow"><label class="label">${t('Assign to existing groups', 'إسناد إلى مجموعات قائمة')}</label><div class="choice-grid">${GROUPS.map(g => `<label class="row"><input type="checkbox" id="newgroup-${g.id}"><span>${esc(t(g.name, g.ar))}</span></label>`).join('')}</div><span class="help">${t('Only existing groups can be assigned during registration.', 'يمكن الإسناد إلى المجموعات القائمة فقط عند التسجيل.')}</span></div>
      ${C.avatarUpload('new')}
      <div class="divider"></div>
      <div class="stack" style="gap:10px">
        ${C.checkRow(t('Send parish announcements on WhatsApp', 'إرسال إعلانات الرعية على واتساب'), { id:'announce-optin' })}
        <label class="row"><input type="checkbox" id="directory-optin"><span>${t('Include in the printed parish directory', 'إدراج في دليل الرعية المطبوع')}</span></label>
        <p class="help">${t('This controls the printed parish people directory: English and Arabic names, household, town, and phone. It does not change private records or other exports.','يتحكّم هذا بدليل مؤمني الرعية المطبوع: الاسمان الإنكليزي والعربي والعائلة والبلدة والهاتف. لا يغيّر السجلات الخاصة أو الصادرات الأخرى.')}</p>
      </div>`,
    foot: `<button class="btn btn-secondary" data-close>${t('Cancel', 'إلغاء')}</button>
      <button class="btn btn-secondary" id="person-save-next">${t('Save & add next', 'حفظ وإضافة التالي')}</button>
      <button class="btn btn-primary" id="person-save" style="margin-inline-start:auto">${t('Save parishioner', 'حفظ المؤمن')}</button>`,
    onMount(el) {
      C.wire(el);
      let saving=false;
      async function save(addNext){
        if(saving)return;
        const lat=el.querySelector('#latname')?.value.trim(),ar=el.querySelector('#arname')?.value.trim();
        if(!lat||!ar)return toast(t('Both names are required','الاسمان مطلوبان'),'','warning');
        const address=readAddressCascade(el);
        if((address.governorate||address.district||address.town)&&(!address.governorate||!address.district||!address.town))
          return toast(t('Complete the address hierarchy','أكمل تسلسل العنوان'),'','warning');
        saving=true;el.querySelectorAll('#person-save,#person-save-next').forEach(b=>b.disabled=true);
        const id='p'+Date.now().toString(36);
        const rec={id,lat,ar,town:address.town||'',townAr:address.townAr||'',rite:el.querySelector('#newrite')?.value||'Maronite',
          status:'member',phone:el.querySelector('#newphone')?.value.trim()||'—',born:el.querySelector('#newborn')?.value||'',hh:null,tags:[]};
        PEOPLE.unshift(rec);
        const announcement=!!el.querySelector('#announce-optin')?.checked,directory=!!el.querySelector('#directory-optin')?.checked;
        PERSON_EXTRA[id]={address,directory,blood:el.querySelector('#newblood')?.value||'',lang:el.querySelector('#newlang')?.value||'ar',
          occupation:el.querySelector('#newoccupation')?.value.trim()||'',
          channel:announcement?'whatsapp':'',skills:[],dates:[],consent:[
            ['Parish announcements on WhatsApp','إعلانات الرعية على واتساب',announcement],
            ['Printed parish directory','الدليل المطبوع',directory],
            ['Photos in parish media','الصور في وسائل الرعية',false]]};
        el.querySelectorAll('input[id^="newgroup-"]:checked').forEach(input=>{
          const gid=input.id.slice(9),g=GROUPS.find(x=>x.id===gid);
          const detail=GROUP_DETAIL[gid] ||= {roster:[],assistant:null,roles:[],requests:[],meetings:[],posts:[],files:[]};
          detail.roster ||= [];if(!detail.roster.some(r=>r.p===id))detail.roster.push({p:id,role:'Member',roleAr:'عضو',joined:new Date().getFullYear().toString(),att:0});
          if(g)g.members=detail.roster.length;
        });
        if(PHOTOS.new){PHOTOS[id]=PHOTOS.new;delete PHOTOS.new;}
        if(!await persist()){saving=false;el.querySelectorAll('#person-save,#person-save-next').forEach(b=>b.disabled=false);return;}
        D.PARISH.people=PEOPLE.length;
        closeOverlays();toast(t('Parishioner saved','حُفظ المؤمن'),`${lat} · ${ar}`,'success');
        if(addNext){bus.refresh();newPersonDrawer();}else go('person/'+id);
      }
      el.querySelector('#person-save').addEventListener('click',()=>save(false));
      el.querySelector('#person-save-next').addEventListener('click',()=>save(true));
    }
  });
}
