/* Module 7 — sacramental registers, preparation, certificates, corrections. */
import { t, isAr, fmtDate, num } from '../i18n.js';
import { is, bus, S } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, pill, esc, table, wireTables, empty,
         searchField, openDrawer, openModal, closeOverlays, toast, stat, tabBar, avatar } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import { VERBS } from '../actions.js';
import { need } from '../flows.js';
import { SACRAMENTS, ANNIVERSARIES, PARISH, PREP_REQUIREMENTS, CORRECTIONS, NOTES, PEOPLE, person } from '../data.js';

const L = (en, ar) => t(en, ar);
const KIND = { baptism:['Baptism','معمودية'], communion:['First Communion','المناولة الأولى'],
  confirmation:['Confirmation (Chrismation)','الميرون'], marriage:['Marriage','إكليل'],
  funeral:['Funeral','جنّاز'], certificate:['Certificate request','طلب شهادة'] };
const kindLabel = k => L(...(KIND[k] || [k, k]));
/* B/2026/042 follows B/2026/041: the next number in that sacrament's register this year */
const PREFIX = { baptism: 'B', communion: 'C', confirmation: 'K', marriage: 'M', funeral: 'F', certificate: 'REQ' };
const nextReg = k => { const pre = `${PREFIX[k] || 'X'}/2026/`;
  const n = Math.max(0, ...SACRAMENTS.filter(x => x.reg.startsWith(pre)).map(x => parseInt(x.reg.slice(pre.length), 10) || 0)) + 1;
  return pre + String(n).padStart(3, '0'); };
const STABS = () => [['', 'Registers', 'السجلات'], ['preparation', 'Preparation', 'التحضير'],
               ['corrections', 'Corrections', 'التصحيحات', CORRECTIONS.filter(c => c.status === 'awaiting-approval').length],
               ['anniversaries', 'Anniversaries', 'الذكريات', ANNIVERSARIES.length]];

export function sacraments(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Records', 'السجلات') }, { label: L('Sacraments', 'الأسرار') }],
    title: L('Sacramental registers', 'سجلات الأسرار'),
    sub: L('Baptism, chrismation, communion, marriage and funeral — kept separately from event scheduling, with controlled corrections and a preserved original entry.',
           'معمودية وميرون ومناولة وإكليل وجنّاز — محفوظة بمعزل عن جدولة الأحداث، بتصحيحات مضبوطة وحفظ القيد الأصلي.'),
    actions: `<button class="btn btn-secondary" data-act="export">${icon('export', 17)}${L('Export register', 'تصدير السجل')}</button>
      <button class="btn btn-primary" id="newrec">${icon('plus', 17)}${L('New entry', 'قيد جديد')}</button>`
  }) + tabBar('sacraments', STABS(), tab);

  if (tab === 'preparation') return head + `<div style="margin-top:20px" class="grid g2">
      ${Object.entries(PREP_REQUIREMENTS).map(([k, reqs]) => `<section class="panel">
        <div class="panel-h"><h3>${esc(kindLabel(k))}</h3>
          <span class="badge badge-quiet" style="margin-inline-start:auto">${reqs.filter(r => r[2]).length}/${reqs.length}</span></div>
        <div class="panel-b"><div class="stack" style="gap:10px">
          ${reqs.map(([en, ar, done]) => C.checkRow(L(en, ar), { checked: done })).join('')}</div>
          <div class="divider"></div>
          <p class="t-caption dim">${L('A ceremony cannot be scheduled until every required document has been reviewed and marked.',
            'لا يمكن جدولة الاحتفال قبل مراجعة كل مستند مطلوب ووضع علامته.')}</p>
        </div></section>`).join('')}
    </div>
    <div class="tabbody">${panel(L('External parish references', 'مراجع من رعايا أخرى'), `
      <div class="listrow" style="padding-inline:0">${who(person('p12'))}
        <span class="grow"><b>${L('Baptism certificate requested from Saint Charbel, Louaizeh', 'طُلبت إفادة معمودية من مار شربل، اللويزة')}</b>
          <small class="mono">${L('sent 28 Sep 2026', 'أُرسل ٢٨ أيلول ٢٠٢٦')}</small></span>${status('pending')}</div>
      <p class="t-caption dim" style="margin-top:12px">${L(
        'When a record lives in another parish, ParishLife stores the reference and the request — never a copy of the other parish’s register.',
        'حين يكون السجل في رعية أخرى، يحفظ «حياة الرعية» المرجع والطلب — لا نسخة من سجل الرعية الأخرى.')}</p>`)}</div>`;

  if (tab === 'corrections') return head + `<div class="tabbody">
    ${C.inlineAlert('info', L('A correction never overwrites the original', 'التصحيح لا يمحو الأصل أبداً'),
      L('The original entry is preserved, the correction is a new line, and both need approval and appear in the audit trail.',
        'يُحفظ القيد الأصلي، ويكون التصحيح سطراً جديداً، وكلاهما يحتاج موافقة ويظهر في سجل التدقيق.'))}
    <div style="margin-top:16px">${table({
      cols: [{ label: L('Register', 'القيد'), cls: 'shrink' }, { label: L('Field', 'الحقل'), cls: 'hide-sm' }, { label: L('From', 'من'), cls: 'hide-sm' },
             { label: L('To', 'إلى') }, { label: L('Requested by', 'طلبها'), cls: 'hide-md' },
             { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows: CORRECTIONS.map(c => ({ cells: [
        `<span class="mono">${c.reg}</span>`, `<b>${esc(L(c.field, c.fieldAr))}</b>`,
        `<span class="dim" style="text-decoration:line-through">${esc(c.from)}</span>`, `<b>${esc(c.to)}</b>`,
        who(person(c.by)), status(c.status),
        c.status === 'awaiting-approval' && is('priest')
          ? `<button class="btn btn-primary btn-dense" data-act="corr-approve:${c.id}">${L('Approve', 'موافقة')}</button>`
          : `<span class="t-caption dim">${esc(isAr() ? person(c.approver).ar : person(c.approver).lat)}</span>`]}))
    })}</div></div>`;

  if (tab === 'anniversaries') return head + `<div class="tabbody">${table({
      cols: [{ label: L('Couple', 'الزوجان') }, { label: L('Years', 'السنوات'), cls: 'num' },
             { label: L('Date', 'التاريخ') }, { label: '', cls: 'shrink' }],
      rows: ANNIVERSARIES.map((a, ai) => ({ cells: [
        `<b>${esc(isAr() ? a.ar : a.couple)}</b>`,
        `<span class="num">${a.years}</span>`, `<span class="mono dim">${fmtDate(a.on)}</span>`,
        `<button class="btn btn-secondary btn-dense" data-act="greet:${ai}">${icon('msg', 15)}${L('Send greeting', 'إرسال تهنئة')}</button>`]}))
    })}
    <p class="t-caption dim" style="margin-top:16px">${L(
      'One, ten, twenty-five and fifty years are tracked from the marriage register itself, so nobody keeps a second list. A reminder can be automated in the communication centre.',
      'سنة وعشر وخمس وعشرون وخمسون سنة تُتابَع من سجل الإكليل نفسه، فلا لائحة ثانية. ويمكن أتمتة التذكير في مركز التواصل.')}</p></div>`;

  const fk = S.ui.sacKind || '', fy = S.ui.sacYear || '';
  const year = d => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 4);
  const years = [...new Set(SACRAMENTS.map(s => year(s.date)))].sort().reverse();
  const rows = SACRAMENTS.filter(s => (!fk || s.kind === fk) && (!fy || year(s.date) === fy)).map(s => ({ attrs: `data-sac="${s.id}" data-find-item`, cells: [
    `<span class="mono" dir="ltr">${s.reg}</span>`,
    `<b style="font:500 14px/20px var(--sans)">${esc(kindLabel(s.kind))}</b>`,
    who(person(s.person)),
    `<span class="dim">${fmtDate(s.date)}</span>`,
    `<span class="dim">${esc(isAr() ? person(s.celebrant).ar : person(s.celebrant).lat)}</span>`,
    status(s.status),
    `<a class="btn btn-secondary btn-dense" href="#/certificate/${s.id}">${icon('doc', 15)}${L('Certificate', 'الشهادة')}</a>`
  ]}));

  return head + `<div class="stats" style="margin:20px 0 24px">
      ${stat(L('Awaiting signature', 'بانتظار التوقيع'), SACRAMENTS.filter(s => s.status === 'awaiting-signature').length, L('the priest signs, no one else', 'الكاهن يوقّع لا غيره'))}
      ${stat(L('Registered this year', 'مسجَّل هذه السنة'), 41, L('B/2026 · 40 baptisms', 'ب/٢٠٢٦ · ٤٠ معمودية'))}
      ${stat(L('Scheduled', 'مجدوَل'), SACRAMENTS.filter(s => s.status === 'scheduled').length, L('next: 11 October', 'التالي: ١١ تشرين الأول'))}
      ${stat(L('Corrections this year', 'تصحيحات هذه السنة'), CORRECTIONS.length, L('all approved and logged', 'كلّها مُوافقة ومسجَّلة'))}
    </div>
    <div class="toolbar" style="margin-bottom:16px">
      <div class="grow" style="max-width:320px">${C.searchClear(L('Name or register number', 'الاسم أو رقم القيد'), 'sacsearch', 'data-find')}</div>
      <select class="select" style="width:auto" id="sackind" aria-label="${L('Sacrament', 'السرّ')}"><option value="">${L('All sacraments', 'كل الأسرار')}</option>
        ${Object.keys(KIND).map(k => `<option value="${k}" ${fk === k ? 'selected' : ''}>${esc(kindLabel(k))}</option>`).join('')}</select>
      <select class="select" style="width:auto" id="sacyear" aria-label="${L('Year', 'السنة')}"><option value="">${L('All years', 'كل السنوات')}</option>
        ${years.map(y => `<option ${fy === y ? 'selected' : ''}>${y}</option>`).join('')}</select>
      ${fk || fy ? `<button class="btn btn-ghost btn-dense" data-act="sac-clear">${L('Clear filters', 'مسح المرشّحات')}</button>` : ''}
    </div>
    ${table({
      cols: [{ label: L('Register', 'القيد'), cls: 'shrink', sort: true }, { label: L('Sacrament', 'السرّ'), sort: true },
             { label: L('Person', 'الشخص') }, { label: L('Date', 'التاريخ'), cls: 'hide-sm', sort: true },
             { label: L('Celebrant', 'المحتفل'), cls: 'hide-md' }, { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows,
      empty: empty('sacr', L('No entry matches', 'لا قيد يطابق'), L('Try another sacrament or year.', 'جرّب سرّاً أو سنة أخرى.'),
        `<button class="btn btn-secondary btn-dense" data-act="sac-clear">${L('Clear filters', 'مسح المرشّحات')}</button>`)
    })}
    <div class="find-empty" hidden>${empty('search', L('No entry matches', 'لا قيد يطابق'), L('Try the family name, or the register number.', 'جرّب اسم العائلة أو رقم القيد.'))}</div>`;
}

sacraments.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('#sackind')?.addEventListener('change', e => { S.ui.sacKind = e.target.value; bus.refresh(); });
  host.querySelector('#sacyear')?.addEventListener('change', e => { S.ui.sacYear = e.target.value; bus.refresh(); });
  host.querySelector('#newrec')?.addEventListener('click', () => openDrawer({
    large: true,
    title: L('New register entry', 'قيد جديد في السجل'),
    sub: L('A register entry is permanent. Corrections need approval and keep the original.', 'القيد دائم. والتصحيح يحتاج موافقة ويحتفظ بالأصل.'),
    body: `<div class="formrow"><label class="label" for="sr_kind">${L('Sacrament', 'السرّ')}<span class="req">*</span></label>
        <select class="select" id="sr_kind">${Object.entries(KIND).filter(([k]) => k !== 'certificate').map(([k, v]) => `<option value="${k}">${esc(L(v[0], v[1]))}</option>`).join('')}</select></div>
      <div class="formgrid">
        ${C.field({ label: L('Register reference', 'رقم القيد'), req: true, value: nextReg('baptism'), dir: 'ltr', id: 'sr_reg' })}
        ${C.field({ label: L('Date', 'التاريخ'), req: true, type: 'date', value: '2026-10-11', id: 'sr_date' })}
        ${C.field({ label: L('Book', 'الدفتر'), value: '12', dir: 'ltr' })}
        ${C.field({ label: L('Page', 'الصفحة'), value: '84', dir: 'ltr' })}
      </div>
      ${C.personPicker(L('Person', 'الشخص'), 'screc')}
      <div class="formgrid">
        ${C.field({ label: L('Father', 'الأب'), ar: true, dir: 'rtl' })}
        ${C.field({ label: L('Mother', 'الأم'), ar: true, dir: 'rtl' })}
        ${C.field({ label: L('Godparents / witnesses', 'الإشبين / الشهود'), id: 'sr_god' })}
        <div class="formrow"><label class="label" for="sr_cel">${L('Celebrant', 'المحتفل')}</label>
          <select class="select" id="sr_cel"><option value="p17">Fr. Antoine Khoury</option><option value="p18">Fr. Michel Rahmé</option></select></div>
      </div>
      ${C.field({ label: L('Place', 'المكان'), value: 'Saint Elias, Hadath' })}
      <div class="divider"></div>
      <h4 class="t-ui" style="margin-bottom:10px">${L('Supporting documents', 'المستندات الداعمة')}</h4>
      ${C.dropzone('sacrdoc')}
      <div class="formrow" style="margin-top:14px"><label class="label">${L('Retention', 'مدة الحفظ')}</label>
        <select class="select"><option>${L('Permanent — register document', 'دائم — مستند سجل')}</option>
          <option>${L('10 years', '١٠ سنوات')}</option></select>
        <span class="help">${L('Access to attachments is restricted separately from access to the entry.', 'الوصول إلى المرفقات مقيَّد بمعزل عن الوصول إلى القيد.')}</span></div>
      ${C.inlineAlert('warning', L('Validate before live use', 'تحقّق قبل الاستعمال الفعلي'),
        L('Official numbering, access and retention must be confirmed with the eparchy before this register is used for real documents.',
          'يجب تثبيت الترقيم الرسمي والوصول والحفظ مع الأبرشية قبل استعمال هذا السجل لمستندات فعلية.'))}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="saveentry" style="margin-inline-start:auto">${L('Save entry', 'حفظ القيد')}</button>`,
    onMount(el) {
      C.wire(el);
      const kind = el.querySelector('#sr_kind'), reg = el.querySelector('#sr_reg');
      kind.addEventListener('change', () => { reg.value = nextReg(kind.value); });   // the next free number in that register
      el.querySelector('#saveentry').addEventListener('click', () => {
        const typed = el.querySelector('#screc').value.trim().toLowerCase();
        const who2 = PEOPLE.find(x => typed && (x.lat.toLowerCase() === typed || x.ar === typed))
                  || PEOPLE.find(x => typed && (x.lat.toLowerCase().includes(typed) || x.ar.includes(typed)));
        const ok = [need(el, '#sr_reg', L('Give the register reference', 'أدخل رقم القيد')),
                    need(el, '#sr_reg', L('That reference is already in the register', 'هذا الرقم موجود في السجل'), v => !SACRAMENTS.some(x => x.reg === v)),
                    need(el, '#sr_date', L('Give the date', 'أدخل التاريخ')),
                    need(el, '#screc', L('Choose the person from the list', 'اختر الشخص من اللائحة'), () => !!who2)].every(Boolean);
        if (!ok) return el.querySelector('[aria-invalid=true]')?.focus();
        const k = kind.value, date = el.querySelector('#sr_date').value;
        const entry = { id: 'sc' + Date.now().toString(36), kind: k, kindAr: KIND[k][1], reg: reg.value.trim(), person: who2.id, date,
          celebrant: el.querySelector('#sr_cel').value, status: date > '2026-10-04' ? 'scheduled' : 'awaiting-signature',
          godparents: el.querySelector('#sr_god').value.trim() };
        SACRAMENTS.unshift(entry); closeOverlays(); bus.refresh();
        document.querySelector(`#view [data-sac="${entry.id}"]`)?.classList.add('flash');
        toast(L('Register entry saved', 'حُفظ القيد'), L(`${entry.reg} is now in the ${KIND[k][0].toLowerCase()} register.`, `${entry.reg} في سجل ${KIND[k][1]} الآن.`), 'success',
          { action: { label: L('Undo', 'تراجع'), fn: () => { SACRAMENTS.splice(SACRAMENTS.indexOf(entry), 1); bus.refresh(); } } });
      });
    }
  }));
};

/* ---------------- certificate ---------------- */
export function certificate(id, lang = 'bilingual') {
  const s = SACRAMENTS.find(x => x.id === id) || SACRAMENTS[0];
  const p = person(s.person), cel = person(s.celebrant);
  const signed = s.status === 'registered';
  const showAr = lang !== 'english', showEn = lang !== 'arabic';

  return `${pageHead({
      crumbs: [{ label: L('Records', 'السجلات') }, { label: L('Sacraments', 'الأسرار'), href: '#/sacraments' }, { label: s.reg }],
      title: kindLabel(s.kind),
      sub: `${esc(isAr() ? p.ar : p.lat)} · <span class="mono">${s.reg}</span> · ${fmtDate(s.date)}`,
      actions: `${is('priest') && !signed
        ? `<button class="btn btn-primary" id="sign">${icon('check', 17)}${L('Sign and issue', 'التوقيع والإصدار')}</button>`
        : `<button class="btn btn-secondary" data-act="compose:p17">${icon('msg', 17)}${L('Ask the priest to sign', 'اطلب توقيع الكاهن')}</button>`}
        <button class="btn btn-secondary" data-act="print">${icon('print', 17)}${L('Print', 'طباعة')}</button>
        <button class="btn btn-secondary" data-act="pdf">${icon('export', 17)}${L('Download PDF', 'تنزيل PDF')}</button>
        <button class="btn btn-secondary" data-act="share-cert">${icon('msg', 17)}${L('Send on WhatsApp', 'إرسال على واتساب')}</button>`
    })}
    <div class="splitview">
      <div class="a4frame">
        <div class="a4bar">
          <span class="bgroup" role="group">${[['arabic', L('Arabic', 'عربي')], ['english', L('English', 'إنكليزي')], ['bilingual', L('Bilingual', 'ثنائي اللغة')]]
            .map(([k, lab]) => `<button aria-pressed="${lang === k}" data-go="certificate/${s.id}/${k}">${esc(lab)}</button>`).join('')}</span>
          <span class="zoom">A4 210×297 · 100%</span>
        </div>
        <div style="display:flex;justify-content:center">
        <div class="a4">
          <div class="seal-lg">✚</div>
          ${showAr ? `<div class="ttl-ar">${esc(PARISH.eparchyAr)}</div>
            <div class="ttl-ar" style="font-size:16px">${esc(PARISH.nameAr)} — ${esc(PARISH.townAr)}</div>` : ''}
          ${showEn ? `<div class="ttl" style="margin-top:6px">${esc(PARISH.eparchy)}</div>
            <div class="t-caption dim">${esc(PARISH.name)} — ${esc(PARISH.town)}</div>` : ''}
          <div style="margin-top:16px">
            ${showAr ? `<div style="font:600 19px/28px var(--arabic)">${esc(KIND[s.kind]?.[1] || '')}</div>` : ''}
            ${showEn ? `<div style="font:600 13px/20px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--text-2)">
              ${esc(KIND[s.kind]?.[0] || '')}</div>` : ''}
          </div>
          <div class="nm">${esc(p.ar)}</div>
          ${showEn ? `<div class="nm-lat">${esc(p.lat)}</div>` : ''}
          <div class="lines">
            ${L('Celebrated on', 'احتُفل به في')} <b>${fmtDate(s.date)}</b><br>
            ${L('Celebrant', 'المحتفل')} <b>${esc(cel.lat)}</b>
            ${s.godparents ? `<br>${esc(s.godparents)}` : ''}
          </div>
          <div class="regbox">
            <div><div class="lbl">${L('Book No.', 'دفتر رقم')}</div><div class="val">12</div></div>
            <div><div class="lbl">${L('Page No.', 'صفحة رقم')}</div><div class="val">84</div></div>
          </div>
          <div class="sig">
            <div>${L('Parish priest', 'كاهن الرعية')}</div>
            <div style="border:0;display:grid;place-items:center"><span class="sealbox">${L('Seal & signature', 'ختم وتوقيع')}</span></div>
          </div>
        </div></div>
      </div>
      <div class="sidecol">
        ${panel(L('Issuance history', 'سجل الإصدار'), signed ? `
          <div class="timeline">
            <div class="tl-item accent"><div class="when">14 Mar 2024</div><div class="what">${L('Issued in Arabic — collected in person', 'صدرت بالعربية — استُلمت شخصياً')}</div></div>
            <div class="tl-item"><div class="when">2 Oct 2019</div><div class="what">${L('Issued bilingual — sent on WhatsApp', 'صدرت بلغتين — أُرسلت على واتساب')}</div></div></div>`
          : empty('doc', L('Not issued yet', 'لم تصدر بعد'), L('The first issuance will be recorded here.', 'سيُسجَّل الإصدار الأول هنا.')))}
        ${panel(L('Rules that apply', 'القواعد المطبَّقة'), `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px">
          ${[[L('Only the parish priest signs. A secretary can prepare but not issue.', 'الكاهن وحده يوقّع. أمانة السرّ تُحضّر ولا تُصدر.'), 'shield'],
             [L('Every issuance is logged with who, what and when.', 'كل إصدار يُسجَّل بمن وماذا ومتى.'), 'doc'],
             [L('Templates must be approved by the eparchy before real documents are printed.', 'يجب أن توافق الأبرشية على القوالب قبل طباعة مستندات فعلية.'), 'warn']]
            .map(([x, i]) => `<li class="row" style="gap:10px;align-items:flex-start">${icon(i, 17, 'dimmer')}<span class="t-caption">${esc(x)}</span></li>`).join('')}</ul>`)}
      </div></div>`;
}

certificate.mount = host => {
  C.wire(host);
  host.querySelector('#sign')?.addEventListener('click', () => openModal({
    title: L('Sign this certificate?', 'توقيع هذه الشهادة؟'),
    sub: L('Signing issues the document and writes an entry in the issuance history that cannot be removed.',
           'التوقيع يُصدر المستند ويكتب قيداً في سجل الإصدار لا يمكن حذفه.'),
    body: `<label class="check"><input type="checkbox" id="ack">
      <span>${L('I have checked the register entry against the bound book.', 'راجعتُ القيد مقابل الدفتر الأصلي.')}</span></label>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="confirm" disabled>${L('Sign and issue', 'التوقيع والإصدار')}</button>`,
    onMount(el) {
      const ack = el.querySelector('#ack'), ok = el.querySelector('#confirm');
      ack.addEventListener('change', () => { ok.disabled = !ack.checked; });
      ok.addEventListener('click', () => VERBS['sacr-sign'](ok, id));
    }
  }));
};

/* ---------------- pastoral notes ---------------- */
export function notes() {
  if (!is('priest')) return empty('shield', L('Not available for this role', 'غير متاح لهذا الدور'),
    L('Pastoral notes are visible to the parish priest only.', 'الملاحظات الرعوية للكاهن وحده.'));
  const items = NOTES.map(n => `<div class="listrow" style="align-items:flex-start">${who(person(n.p))}
      <span class="grow"><small class="mono dimmer">${n.at}</small>
        <span style="display:block;font:400 14px/22px var(--sans);margin-top:4px">${esc(L(n.body, n.bodyAr))}</span></span>
      ${C.iconBtn('edit', L('Edit', 'تعديل'), `data-act="note-edit:${n.id}"`)}</div>`).join('');

  return `${pageHead({
      crumbs: [{ label: L('Records', 'السجلات') }, { label: L('Pastoral notes', 'ملاحظات رعوية') }],
      title: L('Pastoral notes', 'ملاحظات رعوية'),
      sub: L('Restricted to the parish priest, and kept separate from staff notes and from the activity timeline.',
             'مقتصرة على كاهن الرعية، ومنفصلة عن ملاحظات الموظفين وعن سجل النشاط.'),
      actions: `<button class="btn btn-primary" data-act="note-new">${icon('plus', 17)}${L('New note', 'ملاحظة جديدة')}</button>`
    })}
    ${C.inlineAlert('info', L('Confession is never recorded', 'لا يُسجَّل الاعتراف أبداً'),
      L('ParishLife has no field, attachment or note type that can hold the content of a confession. This is a data-model decision, not a setting.',
        'لا يوجد في «حياة الرعية» حقل أو مرفق أو نوع ملاحظة يحمل مضمون الاعتراف. هذا قرار في نموذج البيانات لا إعداد قابل للتغيير.'))}
    <div class="tabbody">${panel('', items, { tight: true })}</div>`;
}
notes.mount = host => C.wire(host);
