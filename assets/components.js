/* Interactive components from sheet 03 (controls) and sheet 04 (patterns).
   Everything here renders to an HTML string and, where it needs behaviour,
   exposes a wire(host) that the view calls once after insertion. */
import { icon } from './icons.js';
import { t, isAr, num, usd, lbp, fmtDate, month, dayShort, matches } from './i18n.js';
import { RATE, FEASTS, PEOPLE, PHOTOS, PREFS, person, initials } from './data.js';
import { persist } from './persist.js';
import { esc, avatar, who, toast, openPopover, closeMenu } from './ui.js';

/* ---------------- buttons ---------------- */
export const splitBtn = (label, id, { kind = 'primary', ico = 'plus' } = {}) =>
  `<span class="split"><button class="btn btn-${kind}" data-split="${id}">${icon(ico, 17)}${esc(label)}</button>
   <button class="btn btn-${kind}" data-splitmenu="${id}" aria-label="${t('More actions', 'إجراءات أخرى')}">${icon('chevD', 16)}</button></span>`;

const finds = new Map(), findKey = inp => location.hash.split('?')[0] + '|' + inp.id;
/* With `key`, the group is a real filter: a press stores its index in S.ui[key] and re-renders. */
export const bgroup = (items, sel = 0, key = '') =>
  `<span class="bgroup" role="group">${items.map((l, i) =>
    `<button aria-pressed="${i === sel}" ${key ? `data-act="view:${key}|${i}"` : ''}>${esc(l)}</button>`).join('')}</span>`;

export const iconBtn = (ico, label, attrs = '') =>
  `<button class="btn-icon dense" data-tip="${esc(label)}" aria-label="${esc(label)}" ${attrs}>${icon(ico, 17)}</button>`;

/* ---------------- fields ---------------- */
export function field({ label, req, opt, help, helpTone = '', value = '', ph = '', type = 'text',
                        dir = '', ar = false, state = '', tail = '', id = '' }) {
  const cls = state === 'error' ? 'input' : state === 'ok' ? 'input ok' : 'input';
  if (state === 'loading') tail = tail || '<span class="spinner" style="width:15px;height:15px;border-width:2px"></span>';
  return `<div class="formrow">
    ${label ? `<label class="label" ${id ? `for="${id}"` : ''}>${esc(label)}
      ${req ? '<span class="req">*</span>' : ''}${opt ? `<span class="opt">${t('(optional)', '(اختياري)')}</span>` : ''}</label>` : ''}
    <div class="fieldwrap">
      <input ${id ? `id="${id}"` : ''} class="${cls}" type="${type}" value="${esc(value)}" placeholder="${esc(ph)}"
        ${dir ? `dir="${dir}"` : ''} ${ar ? 'style="font-family:var(--arabic)"' : ''}
        ${state === 'error' ? 'aria-invalid="true"' : ''} ${state === 'disabled' ? 'disabled' : ''}>
      ${tail ? `<span class="tail">${tail}</span>` : ''}
    </div>
    ${help ? `<span class="help ${helpTone}">${help}</span>` : ''}
  </div>`;
}

export const textarea = ({ label, value = '', ph = '', max = 500, help = '', ar = false, id = 'ta' }) =>
  `<div class="formrow">
    <label class="label" for="${id}">${esc(label)}</label>
    <textarea class="textarea" id="${id}" data-max="${max}" placeholder="${esc(ph)}"
      ${ar ? 'dir="rtl" style="font-family:var(--arabic)"' : ''}>${esc(value)}</textarea>
    ${help ? `<span class="help">${help}</span>` : ''}
    <span class="counter" data-for="${id}">${value.length} / ${max}</span>
  </div>`;

export const stepper = ({ label, value = 0, help = '', id = 'st' }) =>
  `<div class="formrow"><label class="label" for="${id}">${esc(label)}</label>
    <div class="stepper"><button type="button" data-step="-1" aria-label="${t('Less', 'أقل')}">−</button>
      <input id="${id}" value="${value}" inputmode="numeric" dir="ltr">
      <button type="button" data-step="1" aria-label="${t('More', 'أكثر')}">+</button></div>
    ${help ? `<span class="help">${help}</span>` : ''}</div>`;

export const searchClear = (ph, id = 'sc', attrs = '') =>
  `<div class="search fieldwrap"><span class="lead">${icon('search', 17)}</span>
    <input class="input" id="${id}" type="search" placeholder="${esc(ph)}" style="padding-inline:36px 34px" ${attrs}>
    <span class="tail"><button class="iconbtn" style="width:22px;height:22px" data-clear="${id}"
      aria-label="${t('Clear', 'مسح')}">${icon('close', 14)}</button></span></div>`;

/* ---------------- Lebanon compound fields ---------------- */
export function currencyField({ label = t('Amount', 'المبلغ'), value = '1,250.00', stale = false, id = 'cur' } = {}) {
  return `<div class="formrow">
    <label class="label" for="${id}">${esc(label)}<span class="req">*</span></label>
    <div class="field"><span class="prefix">USD</span>
      <input id="${id}" class="value" data-usd style="border:0;background:none;width:100%" value="${esc(value)}" dir="ltr"></div>
    <div class="row" style="gap:10px;margin-top:6px;flex-wrap:wrap">
      <span class="help mono" data-conv>L.L ${num(Math.round(parseFloat(value.replace(/,/g, '')) * RATE.value))}
        ${t('at', 'على سعر')} ${num(RATE.value)}</span>
      <button class="btn btn-ghost btn-dense" data-swap style="margin-inline-start:auto">${t('Switch to LBP', 'التحويل إلى الليرة')}</button>
    </div>
    ${stale ? `<div class="alert alert-warning" style="margin-top:10px">${icon('warn', 18)}
      <span>${t('The parish rate was last set 6 days ago.', 'آخر ضبط لسعر الرعية قبل ٦ أيام.')}
      <span class="act"><button data-rate>${t('Update it', 'حدّثه')}</button></span></span></div>` : ''}
  </div>`;
}

export const splitCurrency = () => `<div class="formrow">
  <label class="label">${t('Given in both currencies', 'مُعطى بالعملتين')}</label>
  <div class="formgrid" style="gap:10px">
    <div class="field"><span class="prefix">$</span><input class="value" value="900.00" dir="ltr" style="border:0;background:none;width:100%"></div>
    <div class="field"><span class="prefix">L.L</span><input class="value" value="31,325,000" dir="ltr" style="border:0;background:none;width:100%"></div>
  </div>
  <span class="help">${t('Total recorded:', 'المسجَّل إجمالاً:')} <b class="mono">$1,250.00</b> ${t('equivalent.', 'ما يعادل.')}</span></div>`;

export function phoneField({ label = t('Mobile', 'الخلوي'), value = '3 421 887', state = '', id = 'ph' } = {}) {
  const ok = state !== 'error';
  return `<div class="formrow">
    <label class="label" for="${id}">${esc(label)}<span class="req">*</span></label>
    <div class="field" style="${ok ? '' : 'border-color:var(--danger)'}"><span class="prefix">+961</span>
      <input id="${id}" class="value" value="${esc(value)}" dir="ltr" style="border:0;background:none;width:100%" data-phone>
      ${ok ? `<span style="display:flex;align-items:center;padding-inline-end:10px">
        <span class="pill pill-success"><span class="dot"></span>${t('on WhatsApp', 'على واتساب')}</span></span>` : ''}</div>
    <span class="help ${ok ? '' : 'help-error'}" data-phonehelp>${ok
      ? t('Leading zero is dropped automatically. 03, 70, 71, 76, 78, 79, 81 are recognised as mobile.',
          'يُحذف الصفر تلقائياً. 03 و70 و71 و76 و78 و79 و81 تُعرَف كخلوي.')
      : t('A Lebanese mobile has 7 digits after the prefix.', 'الخلوي اللبناني ٧ أرقام بعد المقدّمة.')}</span></div>`;
}

export const addressCascade = () => `
  <div class="formgrid">
    <div class="formrow"><label class="label">${t('Governorate', 'المحافظة')}<span class="req">*</span></label>
      <select class="select"><option>${t('Mount Lebanon', 'جبل لبنان')}</option><option>${t('Beirut', 'بيروت')}</option>
        <option>${t('North', 'الشمال')}</option><option>${t('South', 'الجنوب')}</option><option>${t('Bekaa', 'البقاع')}</option>
        <option>${t('Nabatieh', 'النبطية')}</option><option>${t('Baalbek-Hermel', 'بعلبك-الهرمل')}</option>
        <option>${t('Akkar', 'عكار')}</option></select></div>
    <div class="formrow"><label class="label">${t('District', 'القضاء')}<span class="req">*</span></label>
      <select class="select"><option>${t('Baabda', 'بعبدا')}</option><option>${t('Metn', 'المتن')}</option>
        <option>${t('Aley', 'عاليه')}</option><option>${t('Kesrouan', 'كسروان')}</option></select></div>
    <div class="formrow"><label class="label">${t('Town', 'البلدة')}<span class="req">*</span></label>
      <select class="select"><option>${t('Hadath', 'الحدث')}</option><option>${t('Hazmieh', 'الحازمية')}</option>
        <option>${t('Louaizeh', 'اللويزة')}</option></select></div>
    <div class="formrow"><label class="label">${t('Sector', 'المنطقة')}<span class="opt">${t('(optional)', '(اختياري)')}</span></label>
      <select class="select"><option>${t('Pick a town first', 'اختر البلدة أولاً')}</option></select></div>
  </div>
  ${field({ label: t('Building', 'البناية'), ph: t('Imm. Khoury, 3rd floor', 'بناية خوري، الطابق الثالث') })}
  ${field({ label: t('Landmark', 'مَعلَم'), ph: t('Behind the municipality', 'خلف البلدية'),
            help: t('How a visitor would actually find the house. There is no postal code field.',
                    'كيف يجد الزائر البيت فعلاً. لا حقل رمز بريدي.') })}`;

export const namePair = () => `
  <div class="formgrid">
    <div class="formrow"><label class="label">${t('Arabic name', 'الاسم العربي')}<span class="req">*</span></label>
      <input class="input" id="arname" dir="rtl" style="font-family:var(--arabic)" placeholder="جورج حدّاد"></div>
    <div class="formrow"><label class="label">${t('Transliteration', 'الحرف اللاتيني')}<span class="req">*</span>
      <span class="pill" style="margin-inline-start:6px">auto</span></label>
      <input class="input" id="latname" dir="ltr" placeholder="Georges Haddad"></div>
  </div>
  <span class="help" style="margin:-8px 0 16px;display:block">${t(
    'Typing Arabic proposes a transliteration; the secretary can always override it.',
    'الكتابة بالعربية تقترح تحويلاً بالحروف اللاتينية، ويمكن لأمانة السرّ تعديله دائماً.')}</span>`;

export const riteSelect = () => `<div class="formrow">
  <label class="label">${t('Rite', 'الطقس')}<span class="req">*</span></label>
  <select class="select">${[['Maronite','ماروني'],['Greek Orthodox','روم أرثوذكس'],['Melkite','روم كاثوليك'],
    ['Armenian','أرمني'],['Syriac','سرياني'],['Latin','لاتيني'],['Evangelical','إنجيلي']]
    .map(r => `<option>${esc(t(...r))}</option>`).join('')}</select>
  <span class="help">${t('Changing the rite changes the sacraments available and the feast calendar. Existing records keep the rite they were entered under.',
    'تغيير الطقس يغيّر الأسرار المتاحة ورزنامة الأعياد. والسجلات القائمة تحتفظ بالطقس الذي أُدخلت به.')}</span></div>`;

/* ---------------- choosing ---------------- */
export const chipField = (label, tags, help = '') => `<div class="formrow">
  <label class="label">${esc(label)}</label>
  <div class="chipfield" data-chipfield>
    ${tags.map(x => `<span class="tag">${esc(x)}<button aria-label="${t('Remove', 'إزالة')}">${icon('close', 12)}</button></span>`).join('')}
    <input placeholder="${t('Add…', 'أضف…')}">
  </div>
  <span class="help">${help || t('Backspace on an empty field removes the last chip.', 'مسافة للخلف في حقل فارغ تحذف آخر وسم.')}</span></div>`;

export const personPicker = (label = t('Person', 'الشخص'), id = 'pp') => `<div class="formrow">
  <label class="label" for="${id}">${esc(label)}</label>
  <div class="ac" data-ac="${id}">
    <input class="input" id="${id}" autocomplete="off" placeholder="${t('Type a name in either script', 'اكتب الاسم بأي حرف')}">
    <div class="ac-list" hidden></div>
  </div></div>`;

export const checkRow = (label, { type = 'checkbox', checked = false, indet = false, note = '', id = '', pref = '' } = {}) =>
  `<label class="check"><input type="${type}" ${id ? `id="${id}"` : ''} ${(pref && pref in PREFS ? PREFS[pref] : checked) ? 'checked' : ''} ${indet ? 'data-indeterminate' : ''} ${pref ? `data-pref="${pref}"` : ''}>
    <span>${esc(label)}${note ? ` <span class="dimmer">— ${esc(note)}</span>` : ''}</span></label>`;

/** pref: a key in PREFS, so the switch remembers its state after a reload. */
export const switchRow = (label, { checked = false, note = '', pref = '' } = {}) =>
  `<label class="switch"><input type="checkbox" ${(pref && pref in PREFS ? PREFS[pref] : checked) ? 'checked' : ''} ${pref ? `data-pref="${pref}"` : ''}>
    <span>${esc(label)}${note ? ` <span class="dimmer">— ${esc(note)}</span>` : ''}</span></label>`;

/* ---------------- date & time ---------------- */
export function datePicker(y = 2026, m = 9, sel = 4) {
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = first.getDay();
  let cells = '';
  for (let i = 0; i < lead; i++) cells += `<button class="out" tabindex="-1">${new Date(y, m, -(lead - i - 1)).getDate()}</button>`;
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells += `<button class="${d === sel ? 'sel' : ''} ${FEASTS[key] ? 'feast' : ''} ${d === 4 && m === 9 && y === 2026 ? 'today' : ''}"
      ${FEASTS[key] ? `title="${esc(t(...FEASTS[key]))}"` : ''}>${d}</button>`;
  }
  return `<div class="dp" data-y="${y}" data-m="${m}" data-sel="${sel}">
    <div class="dp-head">${iconBtn('chevL', t('Previous month', 'الشهر السابق'), 'data-dpnav="-1"')}
      <b>${month(m)} ${y}</b>${iconBtn('chevR', t('Next month', 'الشهر التالي'), 'data-dpnav="1"')}</div>
    <div class="dp-grid">${[0,1,2,3,4,5,6].map(i => `<span class="dow">${esc(dayShort(i))}</span>`).join('')}${cells}</div>
    <div class="dp-foot"><span class="dot"></span>${t('Feast day', 'يوم عيد')}
      <span style="margin-inline-start:auto">7 Oct — ${t('Our Lady of the Rosary', 'سيدة الورديّة')}</span></div>
  </div>`;
}

export const timeField = () => `<div class="formrow"><label class="label">${t('Service time', 'وقت الخدمة')}</label>
  <div class="row" style="gap:8px"><input class="input mono" value="10:30" style="max-width:110px" dir="ltr">
  ${bgroup(['AM', 'PM'], 0)}</div>
  <span class="help">${t('The clock icon never mirrors in RTL.', 'أيقونة الساعة لا تنعكس في العربية أبداً.')}</span></div>`;

export const dateRange = () => `<div class="formrow"><label class="label">${t('Date range', 'المدى الزمني')}</label>
  <input class="input mono" value="1 Jan – 30 Sep 2026" dir="ltr" style="max-width:260px">
  <div class="presets" style="margin-top:10px">
    ${[[t('This week','هذا الأسبوع'),0],[t('This month','هذا الشهر'),0],[t('Last month','الشهر الماضي'),0],
       [t('Year to date','منذ بداية السنة'),1],[t('Since Easter','منذ الفصح'),0],[t('Custom…','مخصّص…'),0]]
      .map(([l, on]) => `<button aria-pressed="${!!on}">${esc(l)}</button>`).join('')}
  </div></div>`;

/* ---------------- uploads ---------------- */
export const dropzone = (id = 'dz', { specimen = false } = {}) => `
  <div class="drop" data-drop="${id}">${icon('export', 26)}
    <b style="margin-top:8px">${t('Drop the file here, or', 'أفلت الملف هنا، أو')}
      <label class="linkbtn">${t('choose a file', 'اختر ملفاً')}<input type="file" multiple hidden data-pick="${id}"
        accept=".jpg,.jpeg,.png,.pdf,image/*,application/pdf"></label></b>
    <span class="hint">${t('JPG, PNG or PDF up to 10 MB. A photo from the phone is fine.',
      'JPG أو PNG أو PDF حتى ١٠ ميغابايت. صورة من الهاتف تكفي.')}</span></div>
  <div class="files" data-files="${id}">${specimen ? `
  <div class="filerow">${icon('doc', 18, 'dimmer')}
    <span class="grow"><b>receipt-electricity-sept.jpg</b><small>1.2 MB ${t('of', 'من')} 1.9 MB · 64%</small>
      <span class="progress" style="margin-top:6px"><i style="width:64%"></i></span></span>
    <button class="iconbtn" data-rmfile aria-label="${t('Cancel', 'إلغاء')}">${icon('close', 16)}</button></div>
  <div class="filerow err">${icon('warn', 18)}
    <span class="grow"><b>scan-002.tiff</b><small>${t('TIFF is not supported. Try JPG or PDF.', 'صيغة TIFF غير مدعومة. جرّب JPG أو PDF.')}</small></span>
    <button class="btn btn-ghost btn-dense" data-rmfile>${t('Remove', 'إزالة')}</button></div>` : ''}</div>`;

export const avatarUpload = (key = 'specimen') => {
  const ph = PHOTOS[key], label = key === 'parish' ? 'P' : key === 'new' || key === 'specimen' ? 'GH' : initials(person(key));
  return `<div class="row" style="gap:16px;align-items:flex-start" data-photo="${key}">
  <span class="avatar avatar-xl ${ph ? 'has-photo' : ''}" ${ph ? `style="background-image:url(${ph})"` : ''}>${ph ? '' : esc(label)}</span>
  <div><div class="row" style="gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-dense" data-act="avatar-upload:${key}">${icon('export', 16)}${ph ? t('Change photo', 'تغيير الصورة') : t('Upload photo', 'رفع صورة')}</button>
      ${ph ? `<button class="btn btn-ghost btn-dense" data-act="avatar-remove:${key}">${t('Remove', 'إزالة')}</button>` : ''}</div>
    <p class="help" style="margin-top:8px;max-width:38ch">${t(
      'Initials are the fallback and are generated from the Latin name. Square crop, 1:1, minimum 200px.',
      'الأحرف الأولى هي البديل وتُولَّد من الاسم اللاتيني. قصّ مربّع ١:١، ٢٠٠ بكسل كحدّ أدنى.')}</p></div></div>`;
};

/* ---------------- rich text ---------------- */
export const richText = (body = '') => `<div class="rte">
  <div class="rte-bar">
    <button data-rte="bold"><b>B</b></button><button data-rte="underline"><u>U</u></button>
    <span class="sep"></span><button data-rte="link">${t('Link', 'رابط')}</button>
    <button data-rte="list">${t('List', 'لائحة')}</button>
    <span class="sep"></span>${bgroup(['EN', 'ع'], isAr() ? 1 : 0)}
  </div>
  <div class="rte-body" contenteditable="true">${body || `<b>${t('Feast of Our Lady of the Rosary.', 'عيد سيدة الورديّة.')}</b>
    ${t('Mass at 10:30 followed by the procession from the upper church. Families are asked to bring flowers for the shrine.',
        'القدّاس الساعة ١٠:٣٠ يليه الزيّاح من الكنيسة العليا. يُرجى من العائلات إحضار الزهور للمزار.')}`}</div>
  <div class="rte-foot">${t('Draft saved 14 seconds ago', 'حُفظت المسوّدة قبل ١٤ ثانية')} ·
    ${t('Bold, underline, link and list only — nothing that can break a printed bulletin.',
        'غامق وتسطير ورابط ولائحة فقط — لا شيء يكسر نشرة مطبوعة.')}</div></div>`;

/* ---------------- menus ---------------- */
export const filterMenu = (title, opts) => `<div class="menu" style="position:static;width:260px">
  <div class="head">${esc(title)}</div>
  <div style="padding:0 4px 6px">${searchClear(t('Search status', 'ابحث في الحالات'), 'fm')}</div>
  ${opts.map(([l, n, on]) => `<label class="opt"><input type="checkbox" ${on ? 'checked' : ''}
    style="appearance:none;width:16px;height:16px;border:1.5px solid var(--border-strong);border-radius:4px">
    ${esc(l)}<span class="n">${num(n)}</span></label>`).join('')}
  <div class="foot"><button class="btn btn-ghost btn-dense" data-act="filter-clear">${t('Clear', 'مسح')}</button>
    <button class="btn btn-primary btn-dense" data-act="filter-apply" style="margin-inline-start:auto">${t('Apply', 'تطبيق')}</button></div></div>`;

export const kebabMenu = () => `<div class="menu" style="position:static;width:230px">
  <button data-act="person-edit:p1">${icon('edit', 16)}${t('Edit record', 'تعديل السجل')}</button>
  <button data-go="people/duplicates">${icon('family', 16)}${t('Find duplicates', 'البحث عن تكرار')}</button>
  <div class="sub"><button data-go="certificate/sc6/bilingual">${icon('doc', 16)}${t('Certificate', 'شهادة')}
    <span style="margin-inline-start:auto">${icon('chevR', 14)}</span></button></div>
  <button data-act="archive-specimen">${icon('trash', 16)}${t('Archive', 'أرشفة')}</button>
  <div class="sep"></div>
  <button class="danger" data-act="spec-delete">${icon('trash', 16)}${t('Delete permanently', 'حذف نهائي')}</button></div>`;

export const bulkBar = n => `<div class="bulkbar">
  <b>${num(n)} ${t('selected', 'محدَّد')}</b>
  <button class="btn btn-secondary" data-act="bulk-message">${icon('msg', 16)}${t('Message', 'مراسلة')}</button>
  <button class="btn btn-secondary" data-act="bulk-group">${icon('groups', 16)}${t('Add to group', 'إضافة إلى مجموعة')}</button>
  <button class="btn btn-secondary" data-act="bulk-export">${icon('export', 16)}${t('Export', 'تصدير')}</button>
  <button class="btn btn-secondary last" data-act="bulk-archive">${icon('trash', 16)}${t('Archive', 'أرشفة')}</button></div>`;

export const ratePopover = (amount = 50) => `<div class="popover" style="position:static;width:auto;padding:14px 16px">
  <b style="display:block;font:600 13px/18px var(--sans);margin-bottom:10px">${t('How the LBP figure is worked out', 'كيف يُحتسب المبلغ بالليرة')}</b>
  <dl class="dl" style="font-size:13px"><dt>${t('Amount', 'المبلغ')}</dt><dd class="mono">${usd(amount)}</dd>
    <dt>${t('Parish rate', 'سعر الرعية')}</dt><dd class="mono">${num(RATE.value)}</dd>
    <dt>${t('In LBP', 'بالليرة')}</dt><dd class="mono">${num(amount * RATE.value)}</dd></dl>
  <p class="t-caption dim" style="margin-top:10px">${t('Set by Fr. Antoine on 4 Oct 2026.', 'ضبطه الأب أنطوان في ٤ تشرين الأول ٢٠٢٦.')}
    <a href="#/settings">${t('Rate history', 'سجل الأسعار')}</a></p></div>`;

/* ---------------- feedback ---------------- */
export const inlineAlert = (tone, title, body, actions = '') =>
  `<div class="alert alert-${tone}">${icon(tone === 'success' ? 'check' : tone === 'info' ? 'info' : 'warn', 18)}
    <span><b>${esc(title)}</b>${esc(body)}${actions ? `<span class="act">${actions}</span>` : ''}</span></div>`;

export const skeletonRows = (n = 4) => Array.from({ length: n }, () => `<div class="skel-row">
  <span class="skel" style="width:28px;height:28px;border-radius:99px"></span>
  <span class="skel" style="width:32%;height:12px"></span>
  <span class="skel" style="width:18%;height:12px"></span>
  <span class="skel" style="width:14%;height:12px;margin-inline-start:auto"></span></div>`).join('');

/* ---------------- charts ---------------- */
export function sparkline(values, { w = 240, h = 40, tone = 'var(--primary)' } = {}) {
  const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => [i / (values.length - 1) * w, h - ((v - min) / span) * (h - 6) - 3]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${w} ${h} L0 ${h} Z`;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${area}" fill="${tone}" opacity=".10"/><path d="${d}" fill="none" stroke="${tone}" stroke-width="1.75"
      stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export const kpi = ({ k, v, sub = '', delta = '', dir = 'up', spark = null }) => `<div class="kpi">
  <div class="k">${esc(k)}</div><div class="v">${v}</div>${sub ? `<div class="sub">${sub}</div>` : ''}
  ${delta ? `<div class="delta ${dir}">${icon(dir === 'up' ? 'arrowR' : 'arrowR', 13)}${esc(delta)}</div>` : ''}
  ${spark ? sparkline(spark) : ''}</div>`;

export const barChart = rows => `<div class="barchart">${rows.map(r => {
  const pct = Math.min(140, Math.round(r.v / r.max * 100));
  return `<div class="row"><div class="top"><span>${esc(r.label)}</span>
      <span class="v" dir="ltr">${r.text ?? `${usd(r.v)} / ${usd(r.max)}`}</span></div>
    <div class="track"><i class="${pct > 100 ? 'over' : ''}" style="width:${Math.min(100, pct)}%"></i>
      ${pct > 100 ? '<span class="goal" style="inset-inline-start:100%"></span>' : ''}</div>
    ${pct > 100 ? `<div class="t-caption" style="color:var(--danger-ink);margin-top:4px">${pct}% — ${t('over budget', 'تجاوز الموازنة')}</div>` : ''}
  </div>`;
}).join('')}</div>`;

export function donut(segments, { size = 132 } = {}) {
  const total = segments.reduce((a, s) => a + s.v, 0);
  const r = size / 2 - 11, c = 2 * Math.PI * r;
  let off = 0;
  const rings = segments.map(s => {
    const len = s.v / total * c;
    const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}"
      stroke-width="18" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}"
      stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    off += len; return el;
  }).join('');
  return `<div class="donut"><svg width="${size}" height="${size}" aria-hidden="true">${rings}</svg>
    <div class="legend">${segments.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)}
      <b class="v">${Math.round(s.v / total * 100)}%</b></span>`).join('')}</div></div>`;
}

/* ---------------- wiring ---------------- */
function wireDp(dp) {
  const y = +dp.dataset.y, m = +dp.dataset.m;
  const go = d => {
    const nm = (m + d + 12) % 12, ny = y + Math.floor((m + d) / 12);
    const tmp = document.createElement('div'); tmp.innerHTML = datePicker(ny, nm, 0);
    const fresh = tmp.firstElementChild; dp.replaceWith(fresh); wireDp(fresh);
  };
  dp.querySelector('[data-dpnav="-1"]')?.addEventListener('click', () => go(-1));
  dp.querySelector('[data-dpnav="1"]')?.addEventListener('click', () => go(1));
  dp.querySelectorAll('.dp-grid button:not(.out)').forEach(b => b.addEventListener('click', () => {
    dp.querySelectorAll('.dp-grid .sel').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel'); dp.dataset.sel = b.textContent;
  }));
}

export function wire(host) {
  /* switches with a pref key are saved the moment they change */
  const saved = (key, v, what) => { PREFS[key] = v; persist(); toast(t('Setting saved', 'حُفظ الإعداد'), what.trim().replace(/\s+/g, ' '), 'success'); };
  host.querySelectorAll('select[data-pref]').forEach(sel => {
    if (sel.dataset.pref in PREFS) sel.value = PREFS[sel.dataset.pref];
    sel.addEventListener('change', () => saved(sel.dataset.pref, sel.value, sel.selectedOptions[0]?.textContent || ''));
  });
  host.querySelectorAll('[data-pref-group]').forEach(g => g.querySelectorAll('button').forEach((b, i) =>
    b.addEventListener('click', () => saved(g.dataset.prefGroup, i, b.textContent))));
  host.querySelectorAll('input[data-pref]').forEach(inp => inp.addEventListener('change', () =>
    saved(inp.dataset.pref, inp.checked, inp.closest('label')?.textContent || '')));
  /* live search: an input with data-find narrows the [data-find-item] rows and cards on its page */
  host.querySelectorAll('input[data-find]').forEach(inp => { inp.addEventListener('input', () => {
    const q = inp.value.trim(), scope = inp.closest('#view') || host;
    finds.set(findKey(inp), inp.value);
    let shown = 0;
    scope.querySelectorAll('[data-find-item]').forEach(el => {
      const on = matches(el.textContent, q);
      el.hidden = !on; shown += on;
      const detail = el.nextElementSibling;                 // an expanded table row follows its parent
      if (detail?.classList.contains('detail') && !on) detail.hidden = true;
    });
    scope.querySelector('.find-empty')?.toggleAttribute('hidden', shown > 0 || !q);
  });
  /* a re-render (a filter pressed, a record saved) keeps what was typed */
  if (finds.get(findKey(inp))) { inp.value = finds.get(findKey(inp)); inp.dispatchEvent(new Event('input')); } });
  /* textarea counters */
  host.querySelectorAll('textarea[data-max]').forEach(ta => {
    const c = host.querySelector(`.counter[data-for="${ta.id}"]`);
    const upd = () => { if (!c) return; const max = +ta.dataset.max;
      c.textContent = `${ta.value.length} / ${max}`; c.classList.toggle('over', ta.value.length > max); };
    ta.addEventListener('input', upd); upd();
  });

  /* number steppers */
  host.querySelectorAll('.stepper').forEach(s => {
    const inp = s.querySelector('input');
    s.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
      inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) + (+b.dataset.step));
    }));
  });

  /* search clear */
  host.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
    const inp = host.querySelector('#' + b.dataset.clear); if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); }
  }));

  /* indeterminate checkboxes */
  host.querySelectorAll('[data-indeterminate]').forEach(c => { c.indeterminate = true; });

  /* chip fields */
  host.querySelectorAll('[data-chipfield]').forEach(f => {
    const inp = f.querySelector('input');
    f.addEventListener('click', e => { if (e.target === f) inp.focus(); });
    f.querySelectorAll('.tag button').forEach(b =>
      b.addEventListener('click', () => b.closest('.tag').remove()));
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && inp.value.trim()) {
        e.preventDefault();
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.innerHTML = `${esc(inp.value.trim())}<button aria-label="x">${icon('close', 12)}</button>`;
        tag.querySelector('button').addEventListener('click', () => tag.remove());
        f.insertBefore(tag, inp); inp.value = '';
      } else if (e.key === 'Backspace' && !inp.value) {
        f.querySelector('.tag:last-of-type')?.remove();
      }
    });
  });

  /* currency conversion + swap */
  host.querySelectorAll('.formrow').forEach(row => {
    const usdIn = row.querySelector('[data-usd]'), conv = row.querySelector('[data-conv]');
    if (!usdIn || !conv) return;
    const upd = () => { const v = parseFloat(usdIn.value.replace(/,/g, '')) || 0;
      conv.textContent = `L.L ${num(Math.round(v * RATE.value))} ${t('at', 'على سعر')} ${num(RATE.value)}`; };
    usdIn.addEventListener('input', upd);
    const swap = row.querySelector('[data-swap]'), prefix = row.querySelector('.prefix');
    swap?.addEventListener('click', () => {
      const toLira = prefix.textContent.trim() === 'USD';
      const v = parseFloat(usdIn.value.replace(/,/g, '')) || 0;
      prefix.textContent = toLira ? 'L.L' : 'USD';
      usdIn.value = toLira ? num(Math.round(v * RATE.value)) : (v / RATE.value).toFixed(2);
      swap.textContent = toLira ? t('Switch to USD', 'التحويل إلى الدولار') : t('Switch to LBP', 'التحويل إلى الليرة');
      conv.textContent = toLira ? `$${(v).toFixed(2)} ${t('at', 'على سعر')} ${num(RATE.value)} · ${t('stored as lira', 'يُخزَّن بالليرة')}`
                                : `L.L ${num(Math.round((v / RATE.value) * RATE.value))} ${t('at', 'على سعر')} ${num(RATE.value)}`;
    });
    row.querySelector('[data-rate]')?.addEventListener('click', () => document.getElementById('userbtn')?.click());
  });

  /* phone validation */
  host.querySelectorAll('[data-phone]').forEach(p => p.addEventListener('input', () => {
    const digits = p.value.replace(/\D/g, '').replace(/^0/, '');
    const help = p.closest('.formrow')?.querySelector('[data-phonehelp]');
    const ok = digits.length === 7 || digits.length === 0;
    p.closest('.field').style.borderColor = ok ? '' : 'var(--danger)';
    if (help) { help.classList.toggle('help-error', !ok);
      help.textContent = ok ? t('Leading zero is dropped automatically.', 'يُحذف الصفر تلقائياً.')
                            : t('A Lebanese mobile has 7 digits after the prefix.', 'الخلوي اللبناني ٧ أرقام بعد المقدّمة.'); }
  }));

  /* transliteration proposal — deliberately naive, the office always overrides */
  const ar2lat = { 'ا':'a','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh','د':'d','ذ':'dh','ر':'r','ز':'z',
    'س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m',
    'ن':'n','ه':'h','و':'ou','ي':'i','ى':'a','ة':'e','أ':'a','إ':'i','آ':'a','ؤ':'o','ئ':'i',' ':' ' };
  const arn = host.querySelector('#arname'), latn = host.querySelector('#latname');
  if (arn && latn) arn.addEventListener('input', () => {
    if (latn.dataset.touched) return;
    latn.value = [...arn.value].map(ch => ar2lat[ch] ?? '').join('')
      .replace(/\b\w/g, m => m.toUpperCase());
  });
  latn?.addEventListener('input', () => { latn.dataset.touched = '1'; });

  /* person autocomplete */
  host.querySelectorAll('[data-ac]').forEach(ac => {
    const inp = ac.querySelector('input'), list = ac.querySelector('.ac-list');
    const render = q => {
      const hits = PEOPLE.filter(p => matches(`${p.lat} ${p.ar} ${p.phone}`, q)).slice(0, 6);
      list.hidden = !q;
      if (!q) return;
      list.innerHTML = hits.length ? hits.map(p => `<button class="ac-opt" data-pid="${p.id}">
          ${avatar(p, 'avatar-sm')}<span><b>${esc(isAr() ? p.ar : p.lat)}</b>
          <small>${esc(isAr() ? p.lat : p.ar)} · ${esc(t(p.town, p.townAr))}</small></span></button>`).join('')
        : `<div class="ac-none">${t('No match.', 'لا نتيجة.')}
           <button class="btn btn-ghost btn-dense" data-create>${t('Create', 'إنشاء')} “${esc(q)}”</button></div>`;
      list.querySelector('[data-create]')?.addEventListener('mousedown', e => {
        e.preventDefault();
        const np = { id: 'p' + Date.now(), lat: q, ar: q, town: 'Hadath', townAr: 'الحدث', rite: 'Maronite',
          status: 'visitor', phone: '—', born: '1990-01-01', hh: null, tags: [] };
        PEOPLE.unshift(np); inp.value = q; list.hidden = true;
        toast(t('Added as a visitor', 'أُضيف كزائر'), t('Complete the record from People when you can.', 'أكمل السجل من صفحة المؤمنين لاحقاً.'), 'success');
      });
      list.querySelectorAll('[data-pid]').forEach(b => b.addEventListener('click', () => {
        const p = person(b.dataset.pid);
        inp.value = isAr() ? p.ar : p.lat; list.hidden = true;
      }));
    };
    inp.addEventListener('input', () => render(inp.value));
    inp.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 160));
  });

  /* tooltips */
  host.querySelectorAll('[data-tip]').forEach(el => {
    let tip;
    const show = () => {
      tip = document.createElement('span');
      tip.className = 'tip'; tip.textContent = el.dataset.tip;
      document.body.append(tip);
      const r = el.getBoundingClientRect();
      tip.style.top = `${r.top - tip.offsetHeight - 8 + scrollY}px`;
      tip.style.left = `${r.left + r.width / 2 - tip.offsetWidth / 2}px`;
      requestAnimationFrame(() => tip.classList.add('on'));
    };
    const hide = () => { tip?.remove(); tip = null; };
    el.addEventListener('mouseenter', () => setTimeout(() => { if (el.matches(':hover')) show(); }, 400));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', show); el.addEventListener('blur', hide);
  });

  /* dropzone: real files, validated, with progress to completion */
  const takeFiles = (id, files) => {
    const list = host.querySelector(`[data-files="${id}"]`); if (!list) return;
    [...files].forEach(f => {
      const okType = /\.(jpe?g|png|pdf)$/i.test(f.name) || /^image\/|pdf$/.test(f.type);
      const tooBig = f.size > 10 * 1024 * 1024, mb = (f.size / 1048576).toFixed(1);
      const row = document.createElement('div');
      row.className = 'filerow' + (okType && !tooBig ? '' : ' err');
      row.innerHTML = okType && !tooBig
        ? `${icon('doc', 18, 'dimmer')}<span class="grow"><b>${esc(f.name)}</b><small>${mb} MB · <span data-pct>0%</span></small>
            <span class="progress" style="margin-top:6px"><i style="width:0%"></i></span></span>
           <button class="iconbtn" data-rmfile aria-label="${t('Remove', 'إزالة')}">${icon('close', 16)}</button>`
        : `${icon('warn', 18)}<span class="grow"><b>${esc(f.name)}</b><small>${tooBig
            ? t('Larger than 10 MB. Try a smaller photo.', 'أكبر من ١٠ ميغابايت. جرّب صورة أصغر.')
            : t('This type is not supported. Try JPG or PDF.', 'هذا النوع غير مدعوم. جرّب JPG أو PDF.')}</small></span>
           <button class="btn btn-ghost btn-dense" data-rmfile>${t('Remove', 'إزالة')}</button>`;
      list.append(row);
      row.querySelector('[data-rmfile]').addEventListener('click', () => row.remove());
      if (!okType || tooBig) return;
      let pct = 0; const bar = row.querySelector('.progress i'), lab = row.querySelector('[data-pct]');
      const timer = setInterval(() => {
        pct = Math.min(100, pct + 12 + Math.random() * 18);
        bar.style.width = pct + '%'; lab.textContent = Math.round(pct) + '%';
        if (pct >= 100) { clearInterval(timer); lab.textContent = t('Uploaded', 'رُفع'); bar.parentElement.remove(); }
      }, 160);
    });
  };
  host.querySelectorAll('[data-drop]').forEach(d => {
    ['dragenter', 'dragover'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.remove('over'); }));
    d.addEventListener('drop', e => takeFiles(d.dataset.drop, e.dataTransfer.files));
  });
  host.querySelectorAll('[data-pick]').forEach(inp => inp.addEventListener('change', () => { takeFiles(inp.dataset.pick, inp.files); inp.value = ''; }));
  host.querySelectorAll('[data-rmfile]').forEach(b => b.addEventListener('click', () => b.closest('.filerow')?.remove()));

  /* date picker: prev / next really change the month */
  host.querySelectorAll('.dp').forEach(wireDp);

  /* rich text */
  /* mousedown only keeps the selection in the text; the command runs on click, so Enter and Space work too */
  host.querySelectorAll('[data-rte]').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
  host.querySelectorAll('[data-rte]').forEach(b => b.addEventListener('click', () => {
    const body = b.closest('.rte')?.querySelector('[contenteditable]');
    const cmd = { bold: 'bold', underline: 'underline', list: 'insertUnorderedList' }[b.dataset.rte];
    if (cmd) {
      if (body && !body.contains(getSelection().anchorNode)) {   // nothing selected in this editor yet: work at its end
        body.focus(); getSelection().selectAllChildren(body); getSelection().collapseToEnd();
      }
      return document.execCommand(cmd);
    }
    const sel = getSelection(), range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    openPopover(b, `<div style="padding:12px"><label class="label" for="rtel">${t('Link address', 'عنوان الرابط')}</label>
      <input class="input" id="rtel" dir="ltr" placeholder="https://"><div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn btn-primary btn-dense" id="rtego" style="margin-inline-start:auto">${t('Add link', 'إضافة رابط')}</button></div></div>`,
      { width: 300, onMount(pop) {
        const inp = pop.querySelector('#rtel'); inp.focus();
        const apply = () => { const url = inp.value.trim(); closeMenu(); if (!url || !range) return;
          sel.removeAllRanges(); sel.addRange(range); document.execCommand('createLink', false, url); };
        pop.querySelector('#rtego').addEventListener('click', apply);
        inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); apply(); } });
      } });
  }));

  /* segmented / button groups toggle visually */
  host.querySelectorAll('.bgroup,.seg,.presets').forEach(g =>
    g.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
    })));
}

/* ---------------- designed dropdowns ----------------
   Every <select class="select"> gets the design system's own list: a trigger that looks like the
   field and a listbox drawn like the menus. Arrow keys, Home/End, type-ahead, Enter and Esc work,
   long lists get a filter box, and it mirrors in Arabic. The native select stays underneath and
   keeps the value, so forms, change handlers and reads of .value are untouched. Touch screens keep
   the phone's own picker, which is the better control there. */
let ddOpen = null, ddN = 0;
const ddText = sel => sel.selectedOptions[0]?.textContent.trim() || '';
function ddSync(sel, btn) { btn.querySelector('.dd-value').textContent = ddText(sel); btn.disabled = sel.disabled; }

export function closeDropdown(focusBack = false) {
  if (!ddOpen) return;
  const { list, btn, cleanup } = ddOpen; ddOpen = null;
  cleanup(); list.remove();
  btn.setAttribute('aria-expanded', 'false'); btn.removeAttribute('aria-activedescendant');
  if (focusBack && btn.isConnected) btn.focus({ preventScroll: true });
}

function ddShow(sel, btn) {
  if (ddOpen?.sel === sel) return closeDropdown(true);
  closeDropdown();
  const opts = [...sel.options], searchable = opts.length > 8, rtl = document.documentElement.dir === 'rtl';
  const list = document.createElement('div');
  list.className = 'dd'; list.dir = rtl ? 'rtl' : 'ltr';
  list.innerHTML = `${searchable ? `<div class="dd-search">${icon('search', 15)}<input class="dd-q" type="text" autocomplete="off"
      placeholder="${esc(t('Type to filter', 'اكتب للتصفية'))}" aria-label="${esc(t('Filter the list', 'تصفية اللائحة'))}" aria-controls="${btn.id}-list"></div>` : ''}
    <div class="dd-opts" role="listbox" id="${btn.id}-list">${opts.map((o, i) => `<div class="dd-opt" role="option" id="${btn.id}-o${i}" data-i="${i}"
      aria-selected="${o.selected}" ${o.disabled ? 'aria-disabled="true"' : ''}><span>${esc(o.textContent.trim())}</span>${icon('check', 16, 'dd-tick')}</div>`).join('')}</div>
    <div class="dd-none" hidden>${esc(t('Nothing matches', 'لا شيء يطابق'))}</div>`;
  document.body.append(list);
  const box = list.querySelector('.dd-opts'), q = list.querySelector('.dd-q');
  const place = () => {
    if (!btn.isConnected) return closeDropdown();
    const r = btn.getBoundingClientRect();
    list.style.minWidth = `${Math.max(r.width, 180)}px`;
    const h = list.offsetHeight, w = list.offsetWidth, below = innerHeight - r.bottom - 12;
    list.style.top = `${below < h && r.top - 12 > below ? r.top - h - 6 : r.bottom + 6}px`;   // flip up near the bottom
    list.style.left = `${Math.max(8, Math.min(rtl ? r.right - w : r.left, innerWidth - w - 8))}px`;
  };
  place();
  let raf = requestAnimationFrame(function follow() { place(); raf = requestAnimationFrame(follow); });  // keeps up with a drawer still sliding in
  let active = 0;
  const items = () => [...box.querySelectorAll('.dd-opt:not([hidden])')];
  const focusEl = q || btn;
  const setActive = i => {
    const it = items(); if (!it.length) return;
    active = (i + it.length) % it.length;
    it.forEach((x, k) => x.classList.toggle('active', k === active));
    it[active].scrollIntoView({ block: 'nearest' });
    focusEl.setAttribute('aria-activedescendant', it[active].id);
  };
  const pick = el => {
    if (!el || el.getAttribute('aria-disabled')) return;
    sel.selectedIndex = +el.dataset.i;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    ddSync(sel, btn); closeDropdown(true);
  };
  box.addEventListener('mousemove', e => { const el = e.target.closest('.dd-opt'); if (el && !el.classList.contains('active')) setActive(items().indexOf(el)); });
  box.addEventListener('click', e => pick(e.target.closest('.dd-opt')));
  let typed = '', typedAt = 0;
  const onKey = e => {
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); setActive(active + (k === 'ArrowDown' ? 1 : -1)); }
    else if (k === 'Home' && !q) { e.preventDefault(); setActive(0); }
    else if (k === 'End' && !q) { e.preventDefault(); setActive(items().length - 1); }
    else if (k === 'Enter') { e.preventDefault(); pick(items()[active]); }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDropdown(true); }
    else if (k === 'Tab') closeDropdown();
    else if (!q && k.length === 1 && !e.metaKey && !e.ctrlKey) {        // type-ahead jumps to the first match
      const now = Date.now(); typed = (now - typedAt > 700 ? '' : typed) + k.toLowerCase(); typedAt = now;
      const i = items().findIndex(x => x.textContent.trim().toLowerCase().startsWith(typed));
      if (i > -1) setActive(i);
    }
  };
  q?.addEventListener('input', () => {
    box.querySelectorAll('.dd-opt').forEach(o => { o.hidden = !matches(o.textContent, q.value); });
    list.querySelector('.dd-none').hidden = items().length > 0;
    setActive(0);
  });
  const outside = e => { if (!list.contains(e.target) && !btn.contains(e.target)) closeDropdown(); };
  const onScroll = e => { if (!list.contains(e.target)) closeDropdown(); };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', outside, true);
  addEventListener('scroll', onScroll, true); addEventListener('resize', place);
  btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-controls', `${btn.id}-list`);
  ddOpen = { list, sel, btn, cleanup: () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', outside, true);
    removeEventListener('scroll', onScroll, true); removeEventListener('resize', place); } };
  setActive(Math.max(0, items().findIndex(x => x.getAttribute('aria-selected') === 'true')));
  q?.focus();
}

export function enhanceSelects(host) {
  if (!matchMedia('(pointer: fine)').matches) return;
  host.querySelectorAll('select.select:not([data-dd])').forEach(sel => {
    sel.dataset.dd = '1';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'select dd-trigger'; btn.id = sel.id ? `${sel.id}-dd` : `dd${++ddN}`;
    btn.setAttribute('role', 'combobox'); btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    btn.style.cssText = sel.style.cssText;
    btn.innerHTML = '<span class="dd-value"></span>';
    const lab = (sel.id && document.querySelector(`label[for="${CSS.escape(sel.id)}"]`)) || sel.closest('.formrow')?.querySelector(':scope > .label');
    if (lab) { lab.id ||= `${btn.id}-l`; if (lab.htmlFor) lab.htmlFor = btn.id; btn.setAttribute('aria-labelledby', lab.id); }
    else if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
    sel.classList.add('dd-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    sel.after(btn); ddSync(sel, btn);
    sel.addEventListener('change', () => ddSync(sel, btn));
    btn.addEventListener('click', () => ddShow(sel, btn));
    btn.addEventListener('keydown', e => {
      if (!ddOpen && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); ddShow(sel, btn); }
    });
  });
}
