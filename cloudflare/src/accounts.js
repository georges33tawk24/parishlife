/* How accounts are found and phone numbers recorded, ported from server.py (login_name, record_phone).
   Registration and sign-in are in identity.js. */
import { str, or, strip } from './py.js';

const EASTERN_DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';

/* How an account is found: an email address in lower case, a phone number in international
   form (Lebanon unless another country code is given), any other username as typed. */
export function loginName(value) {
  const text = [...strip(str(or(value, '')))].map(ch => {
    const i = EASTERN_DIGITS.indexOf(ch);
    return i < 0 ? ch : String(i % 10);
  }).join('');
  if (text.includes('@')) return text.toLowerCase();
  const digits = text.replace(/[ \t \-().]/g, '');
  if (!/^(\+|00)?[0-9]{6,15}$/.test(digits)) return text;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('961') && digits.length >= 10) return '+' + digits;
  return '+961' + digits.replace(/^0+/, '');
}

/* A phone number as People records it: a Lebanese number without +961 in groups ('3 123 456', '76 220 415'),
   any other in full. */
export function recordPhone(number) {
  if (!number.startsWith('+961')) return number;
  const digits = number.slice(4);
  return [digits.slice(0, -6), digits.slice(-6, -3), digits.slice(-3)].filter(Boolean).join(' ');
}
