/* What the people screens share: household and rite names, phone formatting, sign-in status, and
   the occupation and skill fields. */
import { t } from '../../../lib/i18n.js';
import { bus } from '../../model/store.js';
import { toast } from '../../ui/ui.jsx';
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

function importMapping(header) {
  const normalized = header.toLowerCase().replace(/[^a-z]/g, '');
  return (
    {
      englishname: 'lat',
      name: 'lat',
      arabicname: 'ar',
      phone: 'phone',
      phonenumber: 'phone',
      birthdate: 'born',
      dateofbirth: 'born',
      town: 'town',
      rite: 'rite',
      lineofwork: 'occupation',
      occupation: 'occupation'
    }[normalized] || ''
  );
}

export function importReview() {
  if (!importDraft) return [];
  const used = new Set();
  return importDraft.rows.map((row, index) => {
    const record = {};
    importDraft.map.forEach((field, col) => {
      if (field) record[field] = (row[col] || '').trim();
    });
    const errors = [];
    if (!record.lat || !record.ar) errors.push(t('Both names required', 'الاسمان مطلوبان'));
    if (record.born && !/^\d{4}-\d{2}-\d{2}$/.test(record.born))
      errors.push(t('Birth date must be YYYY-MM-DD', 'تاريخ الولادة يجب أن يكون YYYY-MM-DD'));
    const key = `${(record.lat || '').toLowerCase()}|${record.born || ''}`;
    if (
      used.has(key) ||
      PEOPLE.some(
        p => p.lat.toLowerCase() === (record.lat || '').toLowerCase() && (!record.born || p.born === record.born)
      )
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
        phone: r.phone || '—',
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
