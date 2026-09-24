/* Create, edit and delete for every kind of record, from one registry.
   Each entry says where the records live in data.js, which fields the form
   shows and what deleting one means. The drawer, the validation, the confirm
   step and the Undo toast are shared, so every record type behaves the same and
   every change is saved by persist.js on the re-render that follows. */
import { t } from './i18n.js';
import { bus, S, go } from './store.js';
import { icon, esc, toast, openDrawer, closeOverlays, openMenu } from './ui.js';
import * as C from './components.js';
import * as D from './data.js';
import { need, confirmAction } from './flows.js';

const L = (en, ar) => t(en, ar);
const refresh = () => bus.refresh();
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

/* option lists read the data when the form opens, so a room added a minute ago is offered */
const people = () => D.PEOPLE.map(p => [p.id, p.lat, p.ar]);
const venues = () => D.VENUES.map(v => [v.id, v.name, v.ar]);
const funds = () => D.FUNDS.map(f => [f.id, f.name, f.ar]);
const groupsOrNone = () => [['', 'None', 'بلا'], ...D.GROUPS.map(g => [g.id, g.name, g.ar])];
const yesNo = () => [['yes', 'Yes', 'نعم'], ['no', 'No', 'لا']];
const TOWNS = [['Hadath', 'الحدث'], ['Baabda', 'بعبدا'], ['Hazmieh', 'الحازمية'], ['Louaizeh', 'اللويزة'],
               ['Furn el Chebbak', 'فرن الشباك'], ['Ain el Remmaneh', 'عين الرمانة']];
const towns = () => TOWNS.map(([en, ar]) => [en, en, ar]);
const pairOf = (opts, v) => opts.find(o => o[0] === v) || opts[0];
const bool = { get: k => x => x[k] ? 'yes' : 'no', set: k => (x, v) => { x[k] = v === 'yes'; } };

/* a bilingual name: Latin (or English) first, Arabic second; the Arabic falls back to the first when left empty */
const pair = (k, ak, en, enAr, ar, arAr, { req = true, full = false } = {}) => [
  { k, label: L(en, enAr), req, full },
  { k: ak, label: L(ar, arAr), dir: 'rtl', ar: true, fallback: k, full, opt: true }
];

export const FIELD_TYPES = { text: ['Text', 'نص'], choice: ['Choice', 'اختيار'], person: ['Person', 'شخص'], date: ['Date', 'تاريخ'], file: ['File', 'ملف'] };

export const ENT = {
  field: {
    list: () => D.FORM_FIELDS, name: f => L(f.label, f.labelAr),
    nw: ['Add a field', 'إضافة حقل'], ed: ['Edit field', 'تعديل الحقل'], del: ['Remove this field?', 'إزالة هذا الحقل؟'],
    fields: () => [...pair('label', 'labelAr', 'Label', 'التسمية', 'Label (Arabic)', 'التسمية (عربي)'),
      { k: 'type', label: L('Type', 'النوع'), type: 'select', options: () => Object.entries(FIELD_TYPES).map(([k, [en, ar]]) => [k, en, ar]) },
      { k: 'req', label: L('Required', 'مطلوب'), type: 'select', options: yesNo, get: bool.get('req'), set: bool.set('req') },
      ...pair('note', 'noteAr', 'Help text', 'نص المساعدة', 'Help text (Arabic)', 'نص المساعدة (عربي)', { req: false, full: false })],
    blank: () => ({ id: uid('ff'), label: '', labelAr: '', type: 'text', req: false, note: '', noteAr: '' }),
    delNote: ['Answers already given to it are kept with those requests.', 'الأجوبة المعطاة سابقاً تبقى مع طلباتها.'],
    canDelete: f => D.FORM_RULES.some(r => r.show === f.id || r.when === f.id)
      ? L('A rule depends on this field. Remove the rule first.', 'تعتمد قاعدة على هذا الحقل. أزل القاعدة أولاً.') : true
  },

  household: {
    list: () => D.HOUSEHOLDS, name: h => L(h.name, h.ar),
    nw: ['New household', 'عائلة جديدة'], ed: ['Edit household', 'تعديل العائلة'], del: ['Delete this household?', 'حذف هذه العائلة؟'],
    sub: ['Linked by home and envelope number — no shape is assumed.', 'مرتبطة بالمنزل ورقم المظروف — بلا افتراض لشكلها.'],
    fields: () => [...pair('name', 'ar', 'Family name (Latin)', 'اسم العائلة (لاتيني)', 'Family name (Arabic)', 'اسم العائلة (عربي)'),
      { k: 'envelope', label: L('Envelope number', 'رقم المظروف'), dir: 'ltr' },
      { k: 'town', label: L('Town', 'البلدة'), type: 'select', options: towns, set: (x, v) => { x.town = v; x.townAr = pairOf(TOWNS, v)[1]; } },
      { k: 'head', label: L('Head of household', 'ربّ العائلة'), type: 'select', options: () => [['', 'Not set', 'غير محدّد'], ...people()],
        set: (x, v) => { x.head = v || null; if (v && !x.members.includes(v)) x.members.push(v); const p = D.person(v); if (p) p.hh = x.id; } },
      ...pair('address', 'addressAr', 'Address', 'العنوان', 'Address (Arabic)', 'العنوان (عربي)', { req: false })],
    blank: () => ({ id: uid('h'), name: '', ar: '', head: null, members: [], town: 'Hadath', townAr: 'الحدث',
      envelope: String(300 + D.HOUSEHOLDS.length).padStart(4, '0'), address: '', addressAr: '' }),
    check: (v, x) => v.envelope && D.HOUSEHOLDS.some(h => h !== x && h.envelope === v.envelope)
      ? ['envelope', L('Another household already has this envelope number', 'رقم المظروف مستعمل لعائلة أخرى')] : null,
    delNote: ['The people stay in the register; they are simply no longer grouped as a household.',
              'يبقى الأشخاص في السجل؛ لكنهم لا يعودون مجموعين كعائلة.'],
    onDelete: h => { const was = D.PEOPLE.filter(p => p.hh === h.id); was.forEach(p => { p.hh = null; });
      return () => was.forEach(p => { p.hh = h.id; }); }
  },

  group: {
    list: () => D.GROUPS, name: g => L(g.name, g.ar),
    nw: ['New group', 'مجموعة جديدة'], ed: ['Edit group', 'تعديل المجموعة'], del: ['Delete this group?', 'حذف هذه المجموعة؟'],
    fields: () => [...pair('name', 'ar', 'Name (English)', 'الاسم (إنكليزي)', 'Name (Arabic)', 'الاسم (عربي)'),
      { k: 'cat', label: L('Category', 'الفئة'), type: 'select',
        options: () => [['Worship', 'Worship', 'العبادة'], ['Formation', 'Formation', 'التنشئة'], ['Devotion', 'Devotion', 'التقوى'], ['Service', 'Service', 'الخدمة']],
        set: (x, v) => { x.cat = v; x.catAr = { Worship: 'العبادة', Formation: 'التنشئة', Devotion: 'التقوى', Service: 'الخدمة' }[v]; } },
      { k: 'vis', label: L('Visibility', 'الظهور'), type: 'select',
        options: () => [['public', 'Public', 'عام'], ['private', 'Private', 'خاص'], ['confidential', 'Confidential', 'سرّي']] },
      { k: 'leader', label: L('Leader', 'المسؤول'), type: 'select', options: people },
      ...pair('meets', 'meetsAr', 'Meets', 'يجتمع', 'Meets (Arabic)', 'يجتمع (عربي)', { req: false })],
    blank: () => ({ id: uid('g'), name: '', ar: '', cat: 'Worship', catAr: 'العبادة', leader: 'p3', members: 1, meets: '', meetsAr: '', vis: 'public' }),
    delNote: ['Members keep their records. The group’s posts and meetings go with it.', 'يحتفظ الأعضاء بسجلاتهم. وتُحذف منشورات المجموعة واجتماعاتها معها.'],
    onDelete: g => { const d = D.GROUP_DETAIL[g.id]; delete D.GROUP_DETAIL[g.id]; return () => { if (d) D.GROUP_DETAIL[g.id] = d; }; },
    home: 'groups'
  },

  venue: {
    list: () => D.VENUES, name: v => L(v.name, v.ar),
    nw: ['New room', 'قاعة جديدة'], ed: ['Edit room', 'تعديل القاعة'], del: ['Delete this room?', 'حذف هذه القاعة؟'],
    fields: () => [...pair('name', 'ar', 'Name (English)', 'الاسم (إنكليزي)', 'Name (Arabic)', 'الاسم (عربي)'),
      { k: 'cap', label: L('Capacity', 'السعة'), type: 'number', min: 1 },
      { k: 'kind', label: L('Kind', 'النوع'), type: 'select',
        options: () => [['Worship', 'Worship', 'عبادة'], ['Hall', 'Hall', 'قاعة'], ['Classroom', 'Classroom', 'صف'], ['Office', 'Office', 'مكتب'], ['Outdoor', 'Outdoor', 'خارجي']],
        set: (x, v) => { x.kind = v; x.kindAr = { Worship: 'عبادة', Hall: 'قاعة', Classroom: 'صف', Office: 'مكتب', Outdoor: 'خارجي' }[v]; } },
      { k: 'access', label: L('Step-free access', 'دخول بلا درج'), type: 'select', options: yesNo, get: bool.get('access'), set: bool.set('access') }],
    blank: () => ({ id: uid('v'), name: '', ar: '', cap: 40, kind: 'Hall', kindAr: 'قاعة', access: true }),
    canDelete: v => D.RESERVATIONS.some(r => r.venue === v.id && r.status !== 'rejected') || D.EVENTS.some(e => e.venue === v.id)
      ? L('This room has bookings or events. Move or cancel them first.', 'لهذه القاعة حجوزات أو أحداث. انقلها أو ألغها أولاً.') : true
  },

  equipment: {
    list: () => D.EQUIPMENT, name: e => L(e.name, e.ar),
    nw: ['New equipment', 'تجهيز جديد'], ed: ['Edit equipment', 'تعديل التجهيز'], del: ['Delete this equipment?', 'حذف هذا التجهيز؟'],
    fields: () => [...pair('name', 'ar', 'Name (English)', 'الاسم (إنكليزي)', 'Name (Arabic)', 'الاسم (عربي)'),
      { k: 'qty', label: L('How many', 'العدد'), type: 'number', min: 1 },
      { k: 'cond', label: L('Condition', 'الحالة'), type: 'select', options: () => [['good', 'Good', 'جيدة'], ['fair', 'Fair', 'مقبولة'], ['poor', 'Poor', 'سيئة']] }],
    blank: () => ({ id: uid('e'), name: '', ar: '', qty: 1, out: 0, cond: 'good' }),
    check: (v, x) => +v.qty < (x.out || 0) ? ['qty', L(`${x.out} are out on loan right now`, `${x.out} معارة حالياً`)] : null,
    canDelete: e => e.out > 0 ? L('Some are out on loan. Wait until they are back.', 'بعضها معار. انتظر حتى تعود.') : true
  },

  reservation: {
    list: () => D.RESERVATIONS, name: r => L(r.title, r.titleAr),
    nw: ['New room request', 'طلب قاعة جديد'], ed: ['Edit room request', 'تعديل طلب القاعة'], del: ['Cancel this reservation?', 'إلغاء هذا الحجز؟'],
    sub: ['Goes to the secretary first, then the priest. Conflicts are checked when it is saved.', 'يذهب إلى أمانة السرّ أولاً ثم الكاهن. ويُفحص التعارض عند الحفظ.'],
    fields: () => [...pair('title', 'titleAr', 'What it is for', 'الغرض', 'Arabic title', 'العنوان بالعربية', { full: false }),
      { k: 'venue', label: L('Room', 'القاعة'), type: 'select', options: venues },
      { k: 'date', label: L('Date', 'التاريخ'), type: 'date', req: true },
      { k: 'from', label: L('From', 'من'), type: 'time', req: true },
      { k: 'to', label: L('To', 'إلى'), type: 'time', req: true },
      { k: 'by', label: L('Requested by', 'مقدَّم من'), type: 'select', options: people },
      { k: 'group', label: L('For group', 'لمجموعة'), type: 'select', options: groupsOrNone, set: (x, v) => { x.group = v || null; } },
      { k: 'setup', label: L('Set-up time (minutes)', 'وقت التجهيز (دقائق)'), type: 'number', min: 0 }],
    blank: () => ({ id: uid('r'), ref: `RES-2026-${216 + D.RESERVATIONS.length}`, venue: 'v3', by: 'p4', group: null, title: '', titleAr: '',
      date: '2026-10-18', from: '10:00', to: '12:00', status: 'pending', stage: 'secretary', setup: 0 }),
    check: v => v.from >= v.to ? ['to', L('Ends before it starts', 'ينتهي قبل أن يبدأ')] : null,
    delNote: ['The slot is freed and the requester is told.', 'يتحرّر الوقت ويُبلَّغ مقدّم الطلب.']
  },

  fund: {
    list: () => D.FUNDS, name: f => L(f.name, f.ar),
    nw: ['New fund', 'صندوق جديد'], ed: ['Edit fund', 'تعديل الصندوق'], del: ['Delete this fund?', 'حذف هذا الصندوق؟'],
    fields: () => [...pair('name', 'ar', 'Name (English)', 'الاسم (إنكليزي)', 'Name (Arabic)', 'الاسم (عربي)'),
      { k: 'budget', label: L('Budget this year (USD)', 'موازنة هذه السنة (دولار)'), type: 'number', min: 0 },
      { k: 'restricted', label: L('Restricted', 'مقيّد'), type: 'select', options: yesNo, get: bool.get('restricted'), set: bool.set('restricted') }],
    blank: () => ({ id: uid('f'), name: '', ar: '', budget: 0, actual: 0, restricted: false }),
    canDelete: f => D.EXPENSES.some(x => x.fund === f.id) || D.PLEDGES.some(p => p.fund === f.id) || D.BATCH.lines.some(l => l.fund === f.id) || f.actual > 0
      ? L('Money has been posted to this fund. It can be closed at year end, not deleted.', 'قُيّدت أموال في هذا الصندوق. يُقفل في آخر السنة ولا يُحذف.') : true
  },

  expense: {
    list: () => D.EXPENSES, name: x => L(x.what, x.whatAr),
    nw: ['New expense', 'مصروف جديد'], ed: ['Edit expense', 'تعديل المصروف'], del: ['Delete this expense?', 'حذف هذا المصروف؟'],
    fields: () => [...pair('what', 'whatAr', 'What was bought', 'ما الذي اشتُري', 'Arabic description', 'الوصف بالعربية', { full: true }),
      { k: 'usd', label: L('Amount (USD)', 'المبلغ (دولار)'), type: 'number', min: 0.01, req: true },
      { k: 'fund', label: L('Fund', 'الصندوق'), type: 'select', options: funds },
      { k: 'd', label: L('Date', 'التاريخ'), type: 'date', req: true },
      { k: 'by', label: L('Submitted by', 'قدّمه'), type: 'select', options: people }],
    blank: () => ({ id: uid('x'), d: '2026-10-04', what: '', whatAr: '', fund: 'general', usd: '', status: 'awaiting-approval', by: 'p15' }),
    extra: () => `<div style="margin-top:16px"><label class="label">${L('Receipt', 'الإيصال')}</label>${C.dropzone('cf_rcpt')}</div>`,
    delNote: ['It is removed from the books and from the approval queue.', 'يُحذف من الدفاتر ومن قائمة الموافقات.']
  },

  pledge: {
    list: () => D.PLEDGES, name: p => L(D.person(p.p)?.lat || '—', D.person(p.p)?.ar || '—'),
    nw: ['New pledge', 'تعهّد جديد'], ed: ['Edit pledge', 'تعديل التعهّد'], del: ['Delete this pledge?', 'حذف هذا التعهّد؟'],
    fields: () => [{ k: 'p', label: L('Donor', 'المتبرّع'), type: 'select', options: people },
      { k: 'fund', label: L('Fund', 'الصندوق'), type: 'select', options: funds },
      { k: 'pledged', label: L('Pledged (USD)', 'المتعهَّد به (دولار)'), type: 'number', min: 1, req: true },
      { k: 'paid', label: L('Paid so far (USD)', 'المدفوع حتى الآن (دولار)'), type: 'number', min: 0 }],
    blank: () => ({ id: uid('pl'), p: 'p1', pledged: 500, paid: 0, fund: 'building' }),
    check: v => +v.paid > +v.pledged ? ['paid', L('More than was pledged', 'أكثر من المتعهَّد به')] : null
  },

  campaign: {
    list: () => D.CAMPAIGNS, name: c => L(c.name, c.ar),
    nw: ['New appeal', 'حملة جديدة'], ed: ['Edit appeal', 'تعديل الحملة'], del: ['Delete this appeal?', 'حذف هذه الحملة؟'],
    fields: () => [...pair('name', 'ar', 'Name (English)', 'الاسم (إنكليزي)', 'Name (Arabic)', 'الاسم (عربي)'),
      { k: 'goal', label: L('Goal (USD)', 'الهدف (دولار)'), type: 'number', min: 1, req: true },
      { k: 'ends', label: L('Ends', 'تنتهي'), type: 'date', req: true }],
    blank: () => ({ id: uid('ca'), name: '', ar: '', goal: 10000, raised: 0, donors: 0, ends: '2026-12-31' })
  },

  hymn: {
    list: () => D.MUSIC, name: m => L(m.title, m.ar),
    nw: ['New hymn', 'ترنيمة جديدة'], ed: ['Edit hymn', 'تعديل الترنيمة'], del: ['Delete this hymn?', 'حذف هذه الترنيمة؟'],
    fields: () => [...pair('title', 'ar', 'Title (Latin)', 'العنوان (لاتيني)', 'Title (Arabic)', 'العنوان (عربي)'),
      ...pair('occasion', 'occasionAr', 'Occasion', 'المناسبة', 'Occasion (Arabic)', 'المناسبة (عربي)', { req: false }),
      { k: 'part', label: L('Part of the liturgy', 'الجزء من الليتورجيا'), type: 'select',
        options: () => ['Entrance', 'Trisagion', 'Offertory', 'Communion', 'Veneration', 'Recessional'].map(x => [x, x]) },
      { k: 'key', label: L('Key', 'المقام'), ph: 'D minor', dir: 'ltr' },
      { k: 'lang', label: L('Language', 'اللغة'), type: 'select',
        options: () => [['Arabic', 'Arabic', 'عربي'], ['Syriac', 'Syriac', 'سرياني'], ['English', 'English', 'إنكليزي'], ['French', 'French', 'فرنسي']] }],
    blank: () => ({ id: uid('m'), title: '', ar: '', occasion: '', occasionAr: '', part: 'Entrance', key: '', lang: 'Arabic', sheet: false, audio: false }),
    delNote: ['It is taken out of every setlist too.', 'وتُزال من كل لائحة ترانيم أيضاً.'], home: 'music',
    onDelete: m => { const had = D.SETLISTS.filter(s => s.items.includes(m.id)).map(s => [s, s.items.indexOf(m.id)]);
      had.forEach(([s, i]) => s.items.splice(i, 1)); return () => had.forEach(([s, i]) => s.items.splice(i, 0, m.id)); }
  },

  setlist: {
    list: () => D.SETLISTS, name: s => L(s.name, s.ar),
    nw: ['New setlist', 'لائحة ترانيم جديدة'], ed: ['Edit setlist', 'تعديل لائحة الترانيم'], del: ['Delete this setlist?', 'حذف لائحة الترانيم؟'],
    fields: () => [...pair('name', 'ar', 'Name (English)', 'الاسم (إنكليزي)', 'Name (Arabic)', 'الاسم (عربي)'),
      { k: 'items', label: L('Hymns, in order', 'الترانيم بالترتيب'), type: 'multi', full: true, options: () => D.MUSIC.map(m => [m.id, m.title, m.ar]) }],
    blank: () => ({ id: uid('sl'), name: '', ar: '', items: [], service: null })
  },

  message: {
    list: () => D.MESSAGES, name: m => L(m.subject, m.subjectAr),
    nw: ['New message', 'رسالة جديدة'], ed: ['Edit message', 'تعديل الرسالة'], del: ['Delete this message?', 'حذف هذه الرسالة؟'],
    fields: () => [...pair('subject', 'subjectAr', 'Subject', 'الموضوع', 'Arabic subject', 'الموضوع بالعربية', { full: true }),
      ...pair('audience', 'audienceAr', 'Audience', 'الجمهور', 'Audience (Arabic)', 'الجمهور (عربي)'),
      { k: 'channel', label: L('Channel', 'القناة'), type: 'select',
        options: () => [['whatsapp', 'WhatsApp', 'واتساب'], ['email', 'Email', 'بريد'], ['sms', 'SMS', 'رسالة قصيرة'], ['app', 'In the app', 'داخل التطبيق']] },
      { k: 'date', label: L('Send on', 'يُرسل في'), type: 'date', get: x => (x.when || '').slice(0, 10), set: () => {} },
      { k: 'time', label: L('At', 'عند'), type: 'time', get: x => (x.when || '').slice(11, 16), set: () => {} }],
    blank: () => ({ id: uid('mg'), subject: '', subjectAr: '', audience: 'All households', audienceAr: 'كل العائلات', channel: 'whatsapp',
      status: 'scheduled', when: '2026-10-12 15:00', reach: 412 }),
    prepare: (x, v) => { if (v.date) x.when = `${v.date} ${v.time || '09:00'}`; },
    delNote: ['A scheduled message will not go out. A sent one is removed from this list only.', 'الرسالة المجدولة لن تُرسل. والمرسلة تُزال من هذه اللائحة فقط.']
  },

  notice: {
    list: () => D.NOTICES, name: n => L(n.title, n.ar),
    nw: ['New notice', 'إعلان جديد'], ed: ['Edit notice', 'تعديل الإعلان'], del: ['Delete this notice?', 'حذف هذا الإعلان؟'],
    fields: () => [...pair('title', 'ar', 'Title', 'العنوان', 'Arabic title', 'العنوان بالعربية', { full: true }),
      { k: 'pri', label: L('Priority', 'الأولوية'), type: 'select', options: () => [['normal', 'Normal', 'عادية'], ['urgent', 'Urgent', 'عاجلة']] },
      { k: 'audience', label: L('Audience', 'الجمهور'), type: 'select',
        options: () => [['Parish', 'Parish', 'الرعية'], ['Parents', 'Parents', 'الأهالي'], ['Youth', 'Youth', 'الشبيبة'], ['Volunteers', 'Volunteers', 'المتطوّعون']],
        set: (x, v) => { x.audience = v; x.audienceAr = { Parish: 'الرعية', Parents: 'الأهالي', Youth: 'الشبيبة', Volunteers: 'المتطوّعون' }[v]; } }],
    blank: () => ({ id: uid('n'), title: '', ar: '', pri: 'normal', by: 'p4', at: '2026-10-04', audience: 'Parish', audienceAr: 'الرعية' }),
    delNote: ['It comes off the board and out of this week’s bulletin.', 'يُزال عن اللوحة ومن نشرة هذا الأسبوع.']
  },

  prayer: {
    list: () => D.PRAYERS, name: p => L(p.body, p.bodyAr).slice(0, 60),
    ed: ['Edit prayer request', 'تعديل طلب الصلاة'], del: ['Remove this prayer request?', 'إزالة طلب الصلاة؟'],
    fields: () => [{ k: 'body', label: L('Request', 'الطلب'), type: 'textarea', req: true, full: true,
      set: (x, v) => { x.body = v; x.bodyAr = v; } }],
    blank: () => ({ id: uid('pr'), by: null, body: '', bodyAr: '', vis: 'moderated', status: 'pending', at: '2026-10-04' })
  },

  registration: {
    list: () => D.REGISTRATIONS, name: r => L(r.event, r.eventAr),
    nw: ['New registration form', 'استمارة تسجيل جديدة'], ed: ['Edit registration', 'تعديل التسجيل'], del: ['Delete this registration?', 'حذف هذا التسجيل؟'],
    fields: () => [...pair('event', 'eventAr', 'Event', 'الحدث', 'Arabic title', 'العنوان بالعربية', { full: true }),
      { k: 'cap', label: L('Places', 'المقاعد'), type: 'number', min: 1, req: true },
      { k: 'fee', label: L('Fee (USD)', 'الرسم (دولار)'), type: 'number', min: 0 },
      { k: 'deadline', label: L('Closes', 'يقفل'), type: 'date', req: true },
      { k: 'open', label: L('Open for registration', 'مفتوح للتسجيل'), type: 'select', options: yesNo, get: bool.get('open'), set: bool.set('open') }],
    blank: () => ({ id: uid('rg'), event: '', eventAr: '', open: true, cap: 40, taken: 0, fee: 0, deadline: '2026-10-31', waiting: 0 }),
    check: (v, x) => +v.cap < (x.taken || 0) ? ['cap', L(`${x.taken} people are already registered`, `${x.taken} مسجّلون أصلاً`)] : null,
    canDelete: r => r.taken > 0 ? L('People have registered. Close it instead, so their records and refunds stay traceable.',
      'هناك مسجّلون. أقفله بدل حذفه كي تبقى سجلاتهم والمبالغ المستردّة قابلة للتتبّع.') : true
  },

  sheet: {
    list: () => D.SIGNUP_SHEETS, name: s => L(s.what, s.whatAr),
    nw: ['New sign-up sheet', 'لائحة تطوّع جديدة'], ed: ['Edit sign-up sheet', 'تعديل لائحة التطوّع'], del: ['Delete this sign-up sheet?', 'حذف لائحة التطوّع؟'],
    fields: () => [...pair('what', 'whatAr', 'What people sign up for', 'ما يتطوّع له الناس', 'Arabic title', 'العنوان بالعربية', { full: true }),
      { k: 'slots', label: L('Places', 'المراكز'), type: 'number', min: 1, req: true },
      { k: 'deadline', label: L('Closes', 'يقفل'), type: 'date', req: true }],
    blank: () => ({ id: uid('ss'), what: '', whatAr: '', slots: 6, taken: 0, deadline: '2026-11-15' }),
    check: (v, x) => +v.slots < (x.taken || 0) ? ['slots', L(`${x.taken} places are already taken`, `${x.taken} مراكز مأخوذة`)] : null
  },

  workflow: {
    list: () => D.WORKFLOWS, name: w => L(w.name, w.ar),
    nw: ['New workflow', 'مسار جديد'], ed: ['Edit workflow', 'تعديل المسار'], del: ['Delete this workflow?', 'حذف هذا المسار؟'],
    fields: () => [...pair('name', 'ar', 'Name (English)', 'الاسم (إنكليزي)', 'Name (Arabic)', 'الاسم (عربي)'),
      { k: 'steps', label: L('Steps, one per line', 'الخطوات، واحدة في كل سطر'), type: 'textarea', full: true, req: true,
        get: x => (x.steps || []).join('\n'),
        set: (x, v) => { x.steps = v.split('\n').map(s => s.trim()).filter(Boolean); x.stepsAr = x.steps.slice(); } }],
    blank: () => ({ id: uid('w'), name: '', ar: '', open: 0, avg: '—', avgAr: '—',
      steps: ['Request', 'Review', 'Decision', 'Done'], stepsAr: ['الطلب', 'المراجعة', 'القرار', 'تمّ'] }),
    canDelete: w => w.open > 0 || D.RUNS.some(r => r.wf === w.id) ? L('Requests are still running through it. Pause it instead.', 'ما زالت طلبات تمرّ فيه. أوقفه مؤقتاً بدلاً من ذلك.') : true
  },

  issue: {
    list: () => D.ISSUES, name: i => L(i.what, i.whatAr),
    nw: ['Report an issue', 'الإبلاغ عن عطل'], ed: ['Edit issue', 'تعديل العطل'], del: ['Delete this issue?', 'حذف هذا العطل؟'],
    fields: () => [...pair('what', 'whatAr', 'What is wrong', 'ما العطل', 'Arabic description', 'الوصف بالعربية', { full: true }),
      { k: 'venue', label: L('Where', 'أين'), type: 'select', options: venues },
      { k: 'status', label: L('Status', 'الحالة'), type: 'select',
        options: () => [['awaiting-approval', 'Awaiting approval', 'بانتظار الموافقة'], ['approved', 'Assigned', 'مُسنَد'], ['closed', 'Fixed', 'أُصلح']] }],
    blank: () => ({ id: uid('is'), venue: 'v3', what: '', whatAr: '', by: 'p4', at: '2026-10-04', status: 'awaiting-approval' })
  },

  volunteer: {
    key: 'p', list: () => D.VOLUNTEERS, name: v => L(D.person(v.p)?.lat || '—', D.person(v.p)?.ar || '—'),
    nw: ['Add a volunteer', 'إضافة متطوّع'], ed: ['Edit volunteer', 'تعديل المتطوّع'], del: ['Remove this volunteer?', 'إزالة هذا المتطوّع؟'],
    sub: ['A volunteer does not need a login. Add them by hand and reach them on WhatsApp.', 'المتطوّع لا يحتاج حساباً. أضفه يدوياً وتواصل معه على واتساب.'],
    fields: (x, isNew) => [
      isNew ? { k: 'p', label: L('Parishioner', 'المؤمن'), type: 'select', full: true,
                options: () => people().filter(([id]) => !D.VOLUNTEERS.some(v => v.p === id)) }
            : { k: 'p', label: L('Parishioner', 'المؤمن'), type: 'select', full: true, options: people, disabled: true },
      { k: 'skills', label: L('Skills, separated by commas', 'المهارات، مفصولة بفواصل'), full: true,
        get: x => (x.skills || []).join(', '), set: (x, v) => { x.skills = list(v); x.skillsAr = x.skills.slice(); } },
      { k: 'avail', label: L('Available', 'التوفّر'), ph: 'Sun AM, Sat PM', dir: 'ltr', get: x => (x.avail || []).join(', '), set: (x, v) => { x.avail = list(v); } },
      { k: 'clearance', label: L('Safeguarding clearance', 'إفادة الحماية'), type: 'select',
        options: () => [['valid', 'Valid', 'سارية'], ['expiring', 'Expiring', 'تنتهي قريباً'], ['missing', 'Missing', 'ناقصة']] },
      { k: 'until', label: L('Clearance expires', 'انتهاء الإفادة'), type: 'date', set: (x, v) => { x.until = v || null; } },
      { k: 'training', label: L('Training completed', 'التدريب المُنجَز'), full: true, ph: 'Safeguarding 2026, First aid',
        get: x => (x.training || []).join(', '), set: (x, v) => { x.training = list(v); } }],
    blank: () => ({ p: people().find(([id]) => !D.VOLUNTEERS.some(v => v.p === id))?.[0] || 'p1', skills: [], skillsAr: [], clearance: 'missing', until: null,
      training: [], avail: ['Sun AM'], hours: 0, assignments: 0 }),
    check: (v, x) => v.clearance !== 'missing' && !v.until ? ['until', L('Add the expiry date of the clearance', 'أضف تاريخ انتهاء الإفادة')] : null,
    delNote: ['Their parish record stays. They are taken off the volunteer list and out of future rotas.', 'يبقى سجلهم في الرعية. ويُزالون من لائحة المتطوّعين ومن المناوبات القادمة.']
  }
};

/* ---------- the shared form ---------- */
function fieldHTML(f, x) {
  const id = 'cf_' + f.k, raw = f.get ? f.get(x) : x[f.k], v = raw ?? '';
  const span = f.full ? ' style="grid-column:1/-1"' : '';
  const label = `<label class="label" for="${id}">${esc(f.label)}${f.req ? '<span class="req">*</span>' : ''}${f.opt ? `<span class="opt">${L('(optional)', '(اختياري)')}</span>` : ''}</label>`;
  if (f.type === 'select') return `<div class="formrow"${span}>${label}
    <select class="select" id="${id}" ${f.disabled ? 'disabled' : ''}>${f.options().map(([ov, en, ar]) =>
      `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(L(en, ar ?? en))}</option>`).join('')}</select></div>`;
  if (f.type === 'textarea') return `<div class="formrow"${span}>${label}
    <textarea class="textarea" id="${id}" rows="5">${esc(v)}</textarea></div>`;
  if (f.type === 'multi') return `<div class="formrow"${span}>${label}<div class="stack cf-multi" id="${id}" style="gap:8px">
    ${f.options().map(([ov, en, ar]) => `<label class="check"><input type="checkbox" value="${esc(ov)}" ${(raw || []).includes(ov) ? 'checked' : ''}>
      <span>${esc(L(en, ar ?? en))}</span></label>`).join('') || `<span class="help">${L('Nothing to choose from yet.', 'لا شيء للاختيار بعد.')}</span>`}</div></div>`;
  return `<div class="formrow"${span}>${label}<div class="fieldwrap">
    <input class="input" id="${id}" type="${f.type || 'text'}" value="${esc(v)}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}
      ${f.dir ? `dir="${f.dir}"` : ''} ${f.ar ? 'style="font-family:var(--arabic)"' : ''}
      ${f.type === 'number' ? `inputmode="decimal" min="${f.min ?? 0}" step="any"` : ''} ${f.disabled ? 'disabled' : ''}></div></div>`;
}

function read(el, fields) {
  const out = {};
  for (const f of fields) {
    const node = el.querySelector('#cf_' + f.k);
    if (f.type === 'multi') out[f.k] = [...node.querySelectorAll('input:checked')].map(c => c.value);
    else if (f.type === 'number') out[f.k] = node.value === '' ? 0 : +node.value;
    else out[f.k] = node.value.trim();
  }
  for (const f of fields) if (f.fallback && !out[f.k]) out[f.k] = out[f.fallback];
  return out;
}

function valid(el, fields, ent, vals, x) {
  let ok = true;
  for (const f of fields) {
    if (f.disabled) continue;
    if (f.req && !need(el, '#cf_' + f.k, L('This is required', 'هذا الحقل مطلوب'), f.type === 'number' ? v => v !== '' && +v >= (f.min ?? 0) : undefined)) ok = false;
    else if (f.type === 'number' && !need(el, '#cf_' + f.k, f.min > 0 ? L(`At least ${f.min}`, `على الأقل ${f.min}`) : L('Cannot be negative', 'لا يمكن أن يكون سالباً'),
      v => v === '' || +v >= (f.min ?? 0))) ok = false;
  }
  const bad = ok && ent.check?.(vals, x);
  if (bad) { need(el, '#cf_' + bad[0], bad[1], () => false); ok = false; }
  if (!ok) el.querySelector('[aria-invalid=true]')?.focus();
  return ok;
}

function apply(ent, x, fields, vals) {
  for (const f of fields) {
    if (f.disabled) continue;
    if (f.set) f.set(x, vals[f.k]); else x[f.k] = vals[f.k];
  }
  ent.prepare?.(x, vals);
}

const keyOf = (ent, x) => String(x[ent.key || 'id']);

/** After a save, point at the record that changed: a brief highlight, scrolled into view if it is off screen. */
function flash(kind, id) {
  const el = document.querySelector(`#view [data-act="rec-menu:${kind}|${id}"]`)?.closest('tr, .listrow, .panel, .card');
  if (!el) return;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  const r = el.getBoundingClientRect();
  if (r.top < 64 || r.bottom > innerHeight) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
export const findRec = (kind, id) => ENT[kind].list().find(x => keyOf(ENT[kind], x) === String(id));

function form(kind, x, isNew) {
  const ent = ENT[kind], fields = ent.fields(x, isNew);
  const [title, titleAr] = isNew ? ent.nw : ent.ed;
  openDrawer({
    title: L(title, titleAr), sub: ent.sub ? L(...ent.sub) : (isNew ? '' : esc(ent.name(x))),
    body: `<div class="formgrid">${fields.map(f => fieldHTML(f, x)).join('')}</div>${ent.extra ? ent.extra(x, isNew) : ''}`,
    foot: `${isNew ? '' : `<button class="btn btn-danger-quiet" id="cf_del">${icon('trash', 16)}${L('Delete', 'حذف')}</button>`}
      <button class="btn btn-secondary" data-close style="margin-inline-start:auto">${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="cf_save">${isNew ? L('Create', 'إنشاء') : L('Save changes', 'حفظ التعديلات')}</button>`,
    onMount(el) {
      C.wire(el);
      const save = () => {
        const vals = read(el, fields);
        if (!valid(el, fields, ent, vals, x)) return;
        const before = structuredClone(x);
        apply(ent, x, fields, vals);
        closeOverlays();
        if (isNew) {
          ent.list().unshift(x); refresh(); flash(kind, keyOf(ent, x));
          toast(L('Created', 'تمّ الإنشاء'), ent.name(x), 'success',
            { action: { label: L('Undo', 'تراجع'), fn: () => { const i = ent.list().indexOf(x); if (i > -1) ent.list().splice(i, 1); refresh(); } } });
        } else {
          refresh(); flash(kind, keyOf(ent, x));
          toast(L('Changes saved', 'حُفظت التعديلات'), ent.name(x), 'success',
            { action: { label: L('Undo', 'تراجع'), fn: () => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, before); refresh(); } } });
        }
      };
      el.querySelector('#cf_save').addEventListener('click', save);
      el.querySelectorAll('input.input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }));
      el.querySelector('#cf_del')?.addEventListener('click', () => remove(kind, keyOf(ent, x)));
    }
  });
}

export const create = (kind, pre = {}) => form(kind, Object.assign(ENT[kind].blank(), pre), true);
export function edit(kind, id) { const x = findRec(kind, id); if (x) form(kind, x, false); }

export function remove(kind, id) {
  const ent = ENT[kind], x = findRec(kind, id); if (!x) return;
  const allowed = ent.canDelete ? ent.canDelete(x) : true;
  if (allowed !== true) { closeOverlays(); return toast(L('Cannot delete yet', 'لا يمكن الحذف بعد'), allowed, 'warning'); }
  confirmAction({
    title: L(...ent.del), danger: true, cta: L('Delete', 'حذف'),
    body: `${ent.name(x)}. ${ent.delNote ? L(...ent.delNote) : L('You can undo this straight after.', 'يمكنك التراجع فوراً بعد الحذف.')}`,
    then: () => {
      const arr = ent.list(), i = arr.indexOf(x); if (i < 0) return;
      arr.splice(i, 1);
      const undoSide = ent.onDelete?.(x);
      if (ent.home && S.route === ent.home && S.params[0] === String(id)) go(ent.home);   // it was open on its own page
      else refresh();
      toast(L('Deleted', 'حُذف'), ent.name(x), '',
        { action: { label: L('Undo', 'تراجع'), fn: () => { arr.splice(i, 0, x); undoSide?.(); refresh(); } } });
    }
  });
}

/** The ⋯ menu on a record: Edit, anything the view adds, Delete. */
export function menu(anchor, kind, id, extra = []) {
  openMenu(anchor, [
    ...(ENT[kind].fields ? [{ label: L('Edit', 'تعديل'), icon: 'edit', fn: () => edit(kind, id) }] : []),
    ...extra,
    { sep: true },
    { label: L('Delete', 'حذف'), icon: 'trash', danger: true, fn: () => remove(kind, id) }
  ], { width: 200 });
}

/** The ⋯ button a view puts on a row or card. */
export const recBtn = (kind, id, label = L('Actions', 'إجراءات')) =>
  `<button class="btn-icon dense rec" data-tip="${esc(label)}" aria-label="${esc(label)}" aria-haspopup="menu" data-act="rec-menu:${kind}|${id}">${icon('dots', 17)}</button>`;
