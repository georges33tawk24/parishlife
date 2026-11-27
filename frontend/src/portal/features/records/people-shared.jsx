/* What the people screens share: household and rite names, phone formatting, sign-in status, the
   occupation field, and the CSV import (IMPORT_FIELDS with the column names it recognises, importReview
   with the same name, date and phone checks as the forms and the API, and wireImport). */
import { t } from '../../../lib/i18n.js';
import { bus } from '../../model/store.js';
import { toast } from '../../ui/ui.jsx';
import { lebaneseKind } from '../../ui/phone-input.jsx';
import { nameProblem, parseBirthDate } from './people-fields.jsx';
import { RELS, relOf } from './people-dialogs.jsx';
import { persist } from '../../model/persist.js';
import * as D from '../../model/data.js';
import { PEOPLE, HOUSEHOLDS, PERSON_EXTRA } from '../../model/data.js';

export const label = p => p?.lat || p?.ar || '';

export const relLabel = (m, h) => t(...RELS.find(r => r[0] === relOf(m, h)).slice(1));

const occupationSuggestions = [
  'Accountant',
  'Carpenter',
  'Catechist',
  'Electrician',
  'Electrical engineer',
  'Electrical technician',
  'Healthcare worker',
  'Nurse',
  'Teacher',
  'Social worker',
  'Software engineer'
];

const occupationOptions = () =>
  [
    ...new Set([
      ...occupationSuggestions,
      ...Object.values(PERSON_EXTRA)
        .map(x => x.occupation)
        .filter(Boolean)
    ])
  ].sort();

export const occupationField = (id, value = '') => (
  <div className="formrow">
    <label className="label" htmlFor={id}>
      {t('Line of work', 'المهنة')}
    </label>{' '}
    <input
      className="input"
      id={id}
      list={`${id}-options`}
      defaultValue={value}
      maxLength="120"
      autoComplete="off"
      placeholder={t('Start typing or enter your own', 'ابدأ بالكتابة أو أدخل مهنتك')}
    />{' '}
    <datalist id={`${id}-options`}>
      {occupationOptions().map((x, i) => (
        <option key={i} value={x} />
      ))}
    </datalist>
  </div>
);

export const hh = id => HOUSEHOLDS.find(h => h.id === id);

/* People records keep Lebanese numbers without +961; a number from abroad is kept whole. */
export const phoneText = v => (!v || v === '—' ? '—' : String(v).startsWith('+') ? String(v) : '+961 ' + v);

export const unverified = p => !!p.registeredOnline && !p.registeredOnline.verified;

export const onlineNew = () => '';

const RITE_AR = {
  Maronite: 'ماروني',
  Melkite: 'روم كاثوليك',
  'Greek Orthodox': 'روم أرثوذكس',
  Armenian: 'أرمني',
  'Roman Catholic': 'لاتيني',
  Syriac: 'سرياني'
};

export const riteLabel = r => t(r, RITE_AR[r] || r);

/* ---------------- import ---------------- */
export let importDraft = null;

function parseCsv(source) {
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(x => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (quoted) throw new Error(t('Unclosed quotation mark in CSV', 'علامة اقتباس غير مغلقة في CSV'));
  row.push(cell);
  if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

/* [field, English, Arabic, column names recognised (compared without case, spaces or punctuation), example]. */
export const IMPORT_FIELDS = [
  ['given', 'First name', 'الاسم الأول', ['First name', 'Given name', 'FirstName', 'GivenName'], 'Georges'],
  ['family', 'Last name', 'اسم العائلة', ['Last name', 'Family name', 'Surname', 'LastName', 'FamilyName'], 'Haddad'],
  [
    'givenAr',
    'First name in Arabic',
    'الاسم الأول بالعربية',
    ['Arabic first name', 'First name Arabic', 'GivenNameAr'],
    'جورج'
  ],
  [
    'familyAr',
    'Last name in Arabic',
    'اسم العائلة بالعربية',
    ['Arabic last name', 'Last name Arabic', 'FamilyNameAr'],
    'حداد'
  ],
  ['phone', 'Phone numbers', 'أرقام الهاتف', ['Phone', 'Phones', 'Mobile', 'Phone number'], '71 821 056; 01 234 567'],
  ['born', 'Date of birth', 'تاريخ الولادة', ['Date of birth', 'Birth date', 'DOB', 'BirthDate'], '14/03/1968'],
  ['town', 'Town', 'البلدة', ['Town', 'Village', 'City'], 'Hadath'],
  ['rite', 'Rite', 'الطقس', ['Rite'], 'Maronite'],
  ['occupation', 'Line of work', 'المهنة', ['Line of work', 'Occupation', 'Job'], 'Teacher']
];

const squash = s =>
  String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '');

function importMapping(header) {
  const normalized = squash(header);
  return IMPORT_FIELDS.find(([, , , names]) => names.some(n => squash(n) === normalized))?.[0] || '';
}

/* One phone cell → { phones: [{ number, kind }] } or { problem }; several numbers are separated by ";" or "/". */
function importPhones(cell) {
  const phones = [];
  const parts = String(cell || '')
    .split(/[;/]/)
    .map(x => x.trim())
    .filter(Boolean);
  for (const part of parts) {
    const international = part.startsWith('+') || part.startsWith('00');
    const digits = part.replace(/\D/g, '').replace(/^00/, '');
    if (!international || digits.startsWith('961')) {
      const national = (international ? digits.slice(3) : digits).replace(/^0/, '');
      const kind = lebaneseKind(national);
      if (!kind) return { problem: `${t('Phone not valid', 'رقم هاتف غير صالح')}: ${part}` };
      phones.push({ number: `+961${national}`, kind });
    } else if (digits.length >= 8 && digits.length <= 15) phones.push({ number: `+${digits}`, kind: '' });
    else return { problem: `${t('Phone not valid', 'رقم هاتف غير صالح')}: ${part}` };
  }
  return { phones: phones.slice(0, 5) };
}

const IMPORT_NAMES = [
  ['given', 'First name', 'الاسم الأول', false],
  ['family', 'Last name', 'اسم العائلة', false],
  ['givenAr', 'Arabic first name', 'الاسم الأول بالعربية', true],
  ['familyAr', 'Arabic last name', 'اسم العائلة بالعربية', true]
];

export function importReview() {
  if (!importDraft) return [];
  const used = new Set();
  return importDraft.rows.map((row, index) => {
    const record = {};
    importDraft.map.forEach((field, col) => {
      if (field) record[field] = (row[col] || '').trim();
    });
    const errors = [];
    if (!record.given || !record.family)
      errors.push(t('First and last name required', 'الاسم الأول واسم العائلة مطلوبان'));
    for (const [key, en, ar, arabic] of IMPORT_NAMES) {
      const why = nameProblem(record[key], arabic);
      if (why) errors.push(`${t(en, ar)}: ${why}`);
    }
    if (record.born) {
      const born = parseBirthDate(record.born);
      if (born.problem) errors.push(born.problem);
      else record.born = born.iso;
    }
    const phones = importPhones(record.phone);
    if (phones.problem) errors.push(phones.problem);
    else record.phones = phones.phones;
    record.lat = `${record.given || ''} ${record.family || ''}`.trim();
    record.ar = `${record.givenAr || ''} ${record.familyAr || ''}`.trim();
    const key = `${record.lat.toLowerCase()}|${record.born || ''}`;
    if (
      used.has(key) ||
      PEOPLE.some(p => p.lat.toLowerCase() === record.lat.toLowerCase() && (!record.born || p.born === record.born))
    )
      errors.push(t('Possible duplicate', 'سجل محتمل مكرّر'));
    used.add(key);
    return { line: index + 2, record, errors };
  });
}

export function wireImport(host) {
  host.querySelector('#people-import-file')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) return toast(t('File exceeds 2 MB', 'الملف أكبر من ٢ ميغابايت'), '', 'warning');
    try {
      const [header, ...rows] = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
      if (!header?.length || !rows.length) throw new Error(t('CSV has no data rows', 'ملف CSV بلا صفوف بيانات'));
      if (rows.length > 2000)
        throw new Error(t('Import at most 2,000 people at a time', 'استورد حتى ٢٠٠٠ شخص في المرة'));
      importDraft = { name: file.name, header, rows, map: header.map(importMapping), result: '' };
      bus.refresh();
    } catch (error) {
      toast(t('Cannot read CSV', 'تعذّرت قراءة CSV'), error.message, 'danger');
    }
  });
  host.querySelectorAll('[data-import-map]').forEach(select =>
    select.addEventListener('change', () => {
      importDraft.map[Number(select.dataset.importMap)] = select.value;
      bus.refresh();
    })
  );
  host.querySelector('#people-import-save')?.addEventListener('click', async button => {
    const review = importReview();
    if (!review.length || review.some(x => x.errors.length)) return;
    if (new Set(importDraft.map.filter(Boolean)).size !== importDraft.map.filter(Boolean).length) return;
    const started = Date.now();
    review.forEach((item, i) => {
      const r = item.record,
        id = `p${(started + i).toString(36)}`;
      PEOPLE.push({
        id,
        lat: r.lat,
        ar: r.ar,
        given: r.given,
        family: r.family,
        givenAr: r.givenAr || '',
        familyAr: r.familyAr || '',
        phones: r.phones || [],
        phone: r.phones?.length ? r.phones[0].number : '—',
        contact: '',
        born: r.born || '',
        town: r.town || '',
        townAr: '',
        rite: r.rite || '',
        status: '',
        hh: null,
        tags: []
      });
      PERSON_EXTRA[id] = { occupation: r.occupation || '', skills: [], dates: [] };
    });
    if (!(await persist())) return;
    D.PARISH.people = PEOPLE.length;
    importDraft = { ...importDraft, rows: [], result: `${review.length} ${t('people imported', 'شخصاً استُوردوا')}` };
    bus.refresh();
    toast(t('Import complete', 'اكتمل الاستيراد'), `${review.length} ${t('records', 'سجلات')}`, 'success');
  });
}
