/* Purpose: a phone number with a country-code picker (owner, 23 November 2026): Lebanon by default and the countries where Lebanese
   families commonly live, with the number's length checked for the chosen country. The full international number ("+961 71 821 056")
   is what the form submits, through a hidden input carrying the field's name.
   Lebanese numbers follow their prefix (owner, 27 November 2026): 03 and landlines (01, 04 to 09) have 7 digits after the dropped
   leading 0, and 70, 71, 76, 78, 79 and 81 have 8, so "71 821 056" is a valid mobile.
   Main members: COUNTRIES (code, dial code, name, allowed national lengths), lebaneseKind (Mobile, Landline or '' for a national
   number), phoneProblem (why a number is not valid for its country), splitPhone (reads a stored number back), formatPhone (a stored
   number for display) and PhoneInput. */
import { useState } from 'react';
import { t } from '../../lib/i18n.js';

// [ISO code, dial code, English, Arabic, allowed digit counts of the national number (without the trunk 0)]
export const COUNTRIES = [
  ['LB', '961', 'Lebanon', 'لبنان', [7, 8]],
  ['SY', '963', 'Syria', 'سوريا', [8, 9]],
  ['JO', '962', 'Jordan', 'الأردن', [8, 9]],
  ['CY', '357', 'Cyprus', 'قبرص', [8]],
  ['AE', '971', 'United Arab Emirates', 'الإمارات', [8, 9]],
  ['SA', '966', 'Saudi Arabia', 'السعودية', [8, 9]],
  ['QA', '974', 'Qatar', 'قطر', [8]],
  ['KW', '965', 'Kuwait', 'الكويت', [8]],
  ['FR', '33', 'France', 'فرنسا', [9]],
  ['DE', '49', 'Germany', 'ألمانيا', [10, 11]],
  ['GB', '44', 'United Kingdom', 'المملكة المتحدة', [10]],
  ['US', '1', 'United States / Canada', 'الولايات المتحدة / كندا', [10]],
  ['BR', '55', 'Brazil', 'البرازيل', [10, 11]],
  ['AU', '61', 'Australia', 'أستراليا', [9]]
];

const digitsOf = text => String(text || '').replace(/\D/g, '');

/* A stored "+961 71 821 056" back into its country and national number; anything unknown stays as typed under Lebanon. */
export function splitPhone(stored) {
  const all = digitsOf(stored);
  if (
    String(stored || '')
      .trim()
      .startsWith('+')
  )
    for (const c of [...COUNTRIES].sort((a, b) => b[1].length - a[1].length))
      if (all.startsWith(c[1])) return { country: c[0], number: all.slice(c[1].length) };
  return { country: 'LB', number: all.replace(/^0/, '') };
}

/* Mobile or Landline for a Lebanese national number without its leading 0, or '' when it is not a valid one. */
export function lebaneseKind(national) {
  if (/^3\d{6}$/.test(national) || /^(70|71|76|78|79|81)\d{6}$/.test(national)) return 'Mobile';
  return /^[1456789]\d{6}$/.test(national) ? 'Landline' : '';
}

/* Why the national number (digits, leading 0 dropped) is not valid for the country, or '' when it is. */
export function phoneProblem(country, national) {
  const c = COUNTRIES.find(x => x[0] === country) || COUNTRIES[0];
  if (country === 'LB')
    return lebaneseKind(national)
      ? ''
      : t(
          'A Lebanese number: 03 and landlines have 7 digits after the 0; 70, 71, 76, 78, 79 and 81 have 8.',
          'رقم لبناني: 03 والأرضي ٧ أرقام بعد الصفر؛ و70 و71 و76 و78 و79 و81 لها ٨ أرقام.'
        );
  return c[4].includes(national.length)
    ? ''
    : t(
        `Enter a valid number for ${c[2]} (${c[4].join(' or ')} digits).`,
        `أدخل رقماً صحيحاً لـ${c[3]} (${c[4].join(' أو ')} أرقام).`
      );
}

const group = (digits, country) =>
  country === 'LB' && digits.length === 7
    ? `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`
    : digits.length > 6
      ? `${digits.slice(0, digits.length - 6)} ${digits.slice(-6, -3)} ${digits.slice(-3)}`
      : digits;

/* A stored number ("+96171821056", or an older "03 421 887") as "+961 71 821 056". */
export function formatPhone(stored) {
  if (!stored || stored === '—') return '—';
  const { country, number } = splitPhone(stored);
  const c = COUNTRIES.find(x => x[0] === country) || COUNTRIES[0];
  return `+${c[1]} ${group(number, country)}`;
}

export function PhoneInput({ name, label, value = '', required = true, help }) {
  const start = splitPhone(value);
  const [country, setCountry] = useState(start.country);
  const [number, setNumber] = useState(start.number);
  const c = COUNTRIES.find(x => x[0] === country) || COUNTRIES[0];
  const national = digitsOf(number).replace(/^0/, '');
  const empty = national.length === 0;
  const problem = empty ? '' : phoneProblem(country, national);
  const valid = empty ? !required : !problem;
  const full = empty ? '' : `+${c[1]} ${group(national, country)}`;
  return (
    <div className="formrow">
      <label className="label">
        {label}
        {required ? <span className="req">*</span> : null}
      </label>
      <div className="field" dir="ltr" style={valid || empty ? undefined : { borderColor: 'var(--danger)' }}>
        <select
          className="prefix"
          aria-label={t('Country code', 'رمز البلد')}
          value={country}
          onChange={e => setCountry(e.target.value)}
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
          value={number}
          onChange={e => setNumber(e.target.value)}
          required={required}
          ref={el => el?.setCustomValidity(valid ? '' : problem || t('Enter a phone number.', 'أدخل رقم الهاتف.'))}
          style={{ border: 0, background: 'none', width: '100%' }}
        />
      </div>
      <input type="hidden" name={name} value={full} />
      {help ? <span className="help">{help}</span> : null}
    </div>
  );
}
