/* Purpose: the form pieces of a person's record (owner, 27 November 2026), shared by the new-person drawer, the edit drawer and the
   profile dialogs, each with the same checks the API applies (ParishLife.Api PersonRules):
   - names: separate first and last name in English and in Arabic, letters only (Latin letters for English, Arabic letters for Arabic);
   - phones: several numbers, Lebanese or foreign, with the country-code picker; Lebanese mobiles and landlines are recognised;
   - date of birth typed as dd/mm/yyyy, not in the future and not more than 110 years ago;
   - several languages, free-text skills added one at a time (no digits), and the consents a new person gives (all ticked by default).
   Main members: nameProblem, NameFields/readNames, PhoneList/readPhones, phonesText, BirthDateField/readBirthDate, isoToDmy,
   LANGUAGES/languageLabel, LanguagesField/readLanguages, SkillsEditor/readSkills, CONSENTS, ConsentChoices/readConsents. */
import { useState } from 'react';
import { t } from '../../../lib/i18n.js';
import * as C from '../../ui/components.jsx';
import { COUNTRIES, formatPhone, lebaneseKind, phoneProblem, splitPhone } from '../../ui/phone-input.jsx';

/* ---------- names ---------- */
const LATIN = /[A-Za-zÀ-ÖØ-öø-ɏḀ-ỿ̀-ͯ]/u;
const ARABIC = /[ؠ-ٟٮ-ۓە-ۜۺ-ۿݐ-ݿࢠ-ࣿﭐ-ﷻﹰ-ﻼ]/u;
const JOINERS = /[ '’.-]/u;

/* Why a typed name cannot be saved, or '' when it can (an empty name is the caller's concern). */
export function nameProblem(value, arabic) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length > 100) return t('At most 100 characters.', '١٠٠ حرف كحد أقصى.');
  let letters = 0;
  for (const ch of text) {
    if ((arabic ? ARABIC : LATIN).test(ch)) letters++;
    else if (!JOINERS.test(ch))
      return /\p{Nd}/u.test(ch)
        ? t('Letters only, no digits.', 'أحرف فقط، بلا أرقام.')
        : arabic
          ? t('Arabic letters only.', 'أحرف عربية فقط.')
          : t('English letters only.', 'أحرف إنكليزية فقط.');
  }
  return letters ? '' : t('Letters only.', 'أحرف فقط.');
}

const NAME_FIELDS = [
  ['given', 'First name', 'الاسم الأول', false, 'Georges'],
  ['family', 'Last name', 'اسم العائلة', false, 'Haddad'],
  ['givenAr', 'First name in Arabic', 'الاسم الأول بالعربية', true, 'جورج'],
  ['familyAr', 'Last name in Arabic', 'اسم العائلة بالعربية', true, 'حدّاد']
];

function NameInput({ id, label, arabic, value, required, placeholder }) {
  const [problem, setProblem] = useState('');
  return (
    <div className="formrow">
      <label className="label" htmlFor={id}>
        {label}
        {required ? <span className="req">*</span> : null}
      </label>
      <input
        className="input"
        id={id}
        dir={arabic ? 'rtl' : 'ltr'}
        lang={arabic ? 'ar' : 'en'}
        style={arabic ? { fontFamily: 'var(--arabic)' } : undefined}
        defaultValue={value || ''}
        maxLength={100}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={problem ? 'true' : undefined}
        onInput={e => {
          const why = nameProblem(e.currentTarget.value, arabic);
          e.currentTarget.setCustomValidity(why);
          setProblem(why);
        }}
      />
      {problem ? <span className="help help-error">{problem}</span> : null}
    </div>
  );
}

/* Four inputs: first and last name in English, then in Arabic. requireArabic marks the Arabic pair as required too. */
export function NameFields({ p = {}, requireArabic = true }) {
  return (
    <div className="formgrid">
      {NAME_FIELDS.map(([key, en, ar, arabic, ph]) => (
        <NameInput
          key={key}
          id={`pf_${key}`}
          label={t(en, ar)}
          arabic={arabic}
          value={p[key]}
          required={!arabic || requireArabic}
          placeholder={ph}
        />
      ))}
    </div>
  );
}

/* { given, family, givenAr, familyAr, lat, ar, problem }: problem names the first field to correct, or ''. */
export function readNames(el, { requireArabic = true } = {}) {
  const v = k => (el.querySelector(`#pf_${k}`)?.value || '').trim().replace(/\s+/g, ' ');
  const out = { given: v('given'), family: v('family'), givenAr: v('givenAr'), familyAr: v('familyAr') };
  out.lat = `${out.given} ${out.family}`.trim();
  out.ar = `${out.givenAr} ${out.familyAr}`.trim();
  out.problem = '';
  for (const [key, en, ar, arabic] of NAME_FIELDS) {
    const why =
      !out[key] && (!arabic || requireArabic || (key === 'familyAr' ? out.givenAr : out.familyAr))
        ? t('Required.', 'مطلوب.')
        : nameProblem(out[key], arabic);
    if (why) {
      out.problem = `${t(en, ar)}: ${why}`;
      el.querySelector(`#pf_${key}`)?.focus();
      break;
    }
  }
  return out;
}

/* ---------- phones ---------- */
const digitsOf = text => String(text || '').replace(/\D/g, '');

const rowFrom = stored => {
  const { country, number } = splitPhone(stored.number);
  return { country, number, kind: stored.kind || '' };
};

/* A row's international number and kind, or a problem. Lebanese kinds come from the prefix. */
function rowValue(row) {
  const national = digitsOf(row.number).replace(/^0/, '');
  if (!national) return { empty: true };
  const problem = phoneProblem(row.country, national);
  const c = COUNTRIES.find(x => x[0] === row.country) || COUNTRIES[0];
  return {
    number: `+${c[1]}${national}`,
    kind: row.country === 'LB' ? lebaneseKind(national) : row.kind || '',
    problem
  };
}

/* Several phone numbers, each with its country code; the first is the main one. phones: [{ number, kind }]. */
export function PhoneList({ phones = [], max = 5 }) {
  const [rows, setRows] = useState(() =>
    phones.length ? phones.map(rowFrom) : [{ country: 'LB', number: '', kind: '' }]
  );
  const set = (i, patch) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="formrow" data-phone-list="">
      <span className="label">{t('Phone numbers', 'أرقام الهاتف')}</span>
      <div className="stack" style={{ gap: '8px' }}>
        {rows.map((row, i) => {
          const value = rowValue(row);
          return (
            <div key={i} data-phone-row="" data-number={value.empty ? '' : value.number} data-kind={value.kind || ''}>
              <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
                <div
                  className="field grow"
                  dir="ltr"
                  style={value.problem ? { borderColor: 'var(--danger)', flex: 1 } : { flex: 1 }}
                >
                  <select
                    className="prefix"
                    aria-label={t('Country code', 'رمز البلد')}
                    value={row.country}
                    onChange={e => set(i, { country: e.target.value })}
                    style={{ border: 0, background: 'none', maxWidth: 110 }}
                  >
                    {COUNTRIES.map(x => (
                      <option key={x[0]} value={x[0]}>
                        +{x[1]} {t(x[2], x[3])}
                      </option>
                    ))}
                  </select>
                  <input
                    className="value"
                    inputMode="tel"
                    autoComplete="tel-national"
                    aria-label={`${t('Phone number', 'رقم الهاتف')} ${i + 1}`}
                    value={row.number}
                    placeholder={row.country === 'LB' ? '71 821 056' : ''}
                    onChange={e => set(i, { number: e.target.value })}
                    style={{ border: 0, background: 'none', width: '100%' }}
                  />
                </div>
                {row.country === 'LB' ? (
                  <span className={`pill ${value.kind ? 'pill-success' : ''}`} style={{ minWidth: 76 }}>
                    {value.kind === 'Mobile'
                      ? t('Mobile', 'خلوي')
                      : value.kind === 'Landline'
                        ? t('Landline', 'أرضي')
                        : t('Lebanon', 'لبنان')}
                  </span>
                ) : (
                  <select
                    className="select"
                    aria-label={t('Kind of number', 'نوع الرقم')}
                    value={row.kind}
                    onChange={e => set(i, { kind: e.target.value })}
                    style={{ width: 'auto' }}
                  >
                    <option value="">{t('Kind not stated', 'النوع غير محدد')}</option>
                    <option value="Mobile">{t('Mobile', 'خلوي')}</option>
                    <option value="Landline">{t('Landline', 'أرضي')}</option>
                  </select>
                )}
                {rows.length > 1 ? (
                  <C.IconBtn
                    ico="x"
                    type="button"
                    label={t('Remove this number', 'إزالة هذا الرقم')}
                    onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}
                  />
                ) : null}
              </div>
              {value.problem ? <span className="help help-error">{value.problem}</span> : null}
            </div>
          );
        })}
      </div>
      {rows.length < max ? (
        <button
          type="button"
          className="btn btn-ghost btn-dense"
          style={{ marginTop: '6px', alignSelf: 'flex-start' }}
          onClick={() => setRows(rs => [...rs, { country: 'LB', number: '', kind: '' }])}
        >
          {t('+ Add another number', '+ إضافة رقم آخر')}
        </button>
      ) : null}
      <span className="help">
        {t(
          'The leading 0 is dropped. 03, 70, 71, 76, 78, 79 and 81 are mobiles; choose another country for a number abroad.',
          'يُحذف الصفر في البداية. 03 و70 و71 و76 و78 و79 و81 أرقام خلوية؛ اختر بلداً آخر لرقم في الخارج.'
        )}
      </span>
    </div>
  );
}

/* { phones: [{ number, kind }], problem }: empty rows are skipped; the first invalid number is the problem. */
export function readPhones(el) {
  const rows = [...el.querySelectorAll('[data-phone-row]')];
  const phones = [];
  let problem = '';
  for (const row of rows) {
    const input = row.querySelector('input');
    const country = row.querySelector('select')?.value || 'LB';
    const national = digitsOf(input?.value).replace(/^0/, '');
    if (!national) continue;
    const why = phoneProblem(country, national);
    if (why && !problem) {
      problem = why;
      input?.focus();
    }
    if (row.dataset.number && !phones.some(p => p.number === row.dataset.number))
      phones.push({ number: row.dataset.number, kind: row.dataset.kind || '' });
  }
  return { phones, problem };
}

/* The numbers for display: "+961 71 821 056 · +961 1 234 567", or '—'. */
export const phonesText = (phones = []) => (phones.length ? phones.map(p => formatPhone(p.number)).join(' · ') : '—');

/* ---------- date of birth ---------- */
const pad = n => String(n).padStart(2, '0');
export const isoToDmy = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* A typed dd/mm/yyyy (or d-m-yyyy, d.m.yyyy, or yyyy-mm-dd) → { iso, problem }; empty gives { iso: '' }. */
export function parseBirthDate(text) {
  const value = String(text || '').trim();
  if (!value) return { iso: '', problem: '' };
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  let [day, month, year] = m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
  if (!m && (m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value))) [year, month, day] = [+m[1], +m[2], +m[3]];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!m || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return { iso: '', problem: t('Enter the date as dd/mm/yyyy.', 'أدخل التاريخ بصيغة يوم/شهر/سنة.') };
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  const today = todayIso();
  const oldest = `${+today.slice(0, 4) - 110}${today.slice(4)}`;
  if (iso > today)
    return { iso: '', problem: t('The date cannot be in the future.', 'لا يمكن أن يكون التاريخ في المستقبل.') };
  if (iso < oldest)
    return {
      iso: '',
      problem: t('The date cannot be more than 110 years ago.', 'لا يمكن أن يعود التاريخ لأكثر من ١١٠ سنوات.')
    };
  return { iso, problem: '' };
}

export function BirthDateField({ value = '', id = 'pf_born' }) {
  const [problem, setProblem] = useState('');
  return (
    <div className="formrow">
      <label className="label" htmlFor={id}>
        {t('Date of birth', 'تاريخ الولادة')}
      </label>
      <input
        className="input"
        id={id}
        dir="ltr"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        defaultValue={isoToDmy(value)}
        aria-invalid={problem ? 'true' : undefined}
        onBlur={e => {
          const why = parseBirthDate(e.currentTarget.value).problem;
          e.currentTarget.setCustomValidity(why);
          setProblem(why);
        }}
      />
      <span className={problem ? 'help help-error' : 'help'}>
        {problem || t('Day, month, year: for example 14/03/1968.', 'اليوم ثم الشهر ثم السنة: مثلاً 14/03/1968.')}
      </span>
    </div>
  );
}

export const readBirthDate = (el, id = 'pf_born') => parseBirthDate(el.querySelector(`#${id}`)?.value);

/* ---------- languages ---------- */
export const LANGUAGES = [
  ['ar', 'Arabic', 'العربية'],
  ['en', 'English', 'الإنكليزية'],
  ['fr', 'French', 'الفرنسية'],
  ['hy', 'Armenian', 'الأرمنية'],
  ['es', 'Spanish', 'الإسبانية'],
  ['pt', 'Portuguese', 'البرتغالية'],
  ['de', 'German', 'الألمانية'],
  ['it', 'Italian', 'الإيطالية']
];
export const languageLabel = code => {
  const l = LANGUAGES.find(x => x[0] === code);
  return l ? t(l[1], l[2]) : code;
};

export function LanguagesField({ value = [] }) {
  return (
    <div className="formrow">
      <span className="label">{t('Languages', 'اللغات')}</span>
      <div className="choice-grid" data-languages="">
        {LANGUAGES.map(([code, en, ar]) => (
          <C.CheckRow key={code} label={t(en, ar)} value={code} checked={value.includes(code)} />
        ))}
      </div>
      <span className="help">{t('Tick every language the person speaks.', 'اختر كل لغة يتكلّمها الشخص.')}</span>
    </div>
  );
}

export const readLanguages = el => [...el.querySelectorAll('[data-languages] input:checked')].map(i => i.value);

/* ---------- skills ---------- */
export function SkillsEditor({ value = [] }) {
  const [skills, setSkills] = useState(value);
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState('');
  const add = () => {
    const text = typed.trim().replace(/\s+/g, ' ');
    if (!text) return;
    if (/\p{Nd}/u.test(text)) return setProblem(t('A skill has no digits.', 'المهارة لا تحتوي أرقاماً.'));
    if (skills.length >= 20) return setProblem(t('Up to 20 skills.', 'حتى ٢٠ مهارة.'));
    setProblem('');
    setTyped('');
    if (!skills.some(s => s.toLocaleLowerCase() === text.toLocaleLowerCase())) setSkills([...skills, text]);
  };
  return (
    <div className="formrow" data-skills={JSON.stringify(skills)} data-skill-pending={typed.trim() ? '1' : ''}>
      <label className="label" htmlFor="pf_skill">
        {t('Skills', 'المهارات')}
      </label>
      <div className="row" style={{ gap: '8px' }}>
        <input
          className="input grow"
          id="pf_skill"
          maxLength={80}
          value={typed}
          placeholder={t('For example: first aid, choir singing', 'مثلاً: إسعافات أولية، ترتيل')}
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={add}>
          {t('Add', 'إضافة')}
        </button>
      </div>
      {problem ? <span className="help help-error">{problem}</span> : null}
      <div className="row" style={{ gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
        {skills.length ? (
          skills.map(s => (
            <span key={s} className="chip">
              {s}
              <button
                type="button"
                className="btn-icon dense"
                aria-label={`${t('Remove', 'إزالة')} ${s}`}
                onClick={() => setSkills(skills.filter(x => x !== s))}
                style={{ marginInlineStart: '4px', width: '20px', height: '20px' }}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="dim t-caption">{t('No skills added yet.', 'لم تُضف مهارات بعد.')}</span>
        )}
      </div>
    </div>
  );
}

/* { skills, pending }: pending is text typed but not added yet, so the caller can ask for Add first. */
export function readSkills(el) {
  const box = el.querySelector('[data-skills]');
  return { skills: box ? JSON.parse(box.dataset.skills || '[]') : [], pending: !!box?.dataset.skillPending };
}

/* ---------- consents of a new person ---------- */
/* [API kind, English, Arabic]. All are ticked by default (owner, 27 November 2026); the office unticks what the person refuses. */
export const CONSENTS = [
  ['Communications', 'Send parish announcements on WhatsApp', 'إرسال إعلانات الرعية على واتساب'],
  ['Directory', 'Include in the printed parish directory', 'إدراج في دليل الرعية المطبوع'],
  ['Photo', 'Photos in parish media', 'الصور في وسائل الرعية'],
  ['Event', 'Event registrations and reminders', 'التسجيل في الفعاليات والتذكير بها']
];

export function ConsentChoices() {
  return (
    <div className="stack" style={{ gap: '10px' }} data-consents="">
      {CONSENTS.map(([kind, en, ar]) => (
        <C.CheckRow key={kind} label={t(en, ar)} value={kind} checked={true} id={`consent-${kind.toLowerCase()}`} />
      ))}
      <p className="help">
        {t(
          'All are granted by default; untick what the person refuses. They can be withdrawn later on the Consent tab. The printed directory shows the name, phone, household and town.',
          'كلها ممنوحة افتراضياً؛ أزل ما يرفضه الشخص. يمكن سحبها لاحقاً من تبويب الموافقات. يُظهر الدليل المطبوع الاسم والهاتف والعائلة والبلدة.'
        )}
      </p>
    </div>
  );
}

export const readConsents = el => [...el.querySelectorAll('[data-consents] input:checked')].map(i => i.value);
