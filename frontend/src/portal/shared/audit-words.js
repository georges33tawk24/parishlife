/* The audit trail in words, wherever it shows (the audit screen, the dashboard's recent activity).
   The server records an English phrase or an internal code, repeated where the Arabic would be,
   and its time as an ISO stamp in UTC with microseconds; the sample rows use "YYYY-MM-DD HH:MM". */
import { t } from '../../lib/i18n.js';

const ACTIONS = {
  'Records updated': ['Records updated', 'تحديث السجلات'],
  'File opened': ['File opened', 'فتح ملف'],
  'File deleted': ['File deleted', 'حذف ملف'],
  'File replaced': ['File replaced', 'استبدال ملف'],
  'Leadership handover': ['Leadership handover', 'تسليم القيادة'],
  'Office transaction created': ['Office transaction created', 'إنشاء معاملة مكتب'],
  'Office transaction updated': ['Office transaction updated', 'تعديل معاملة مكتب'],
  'Office transaction deleted': ['Office transaction deleted', 'حذف معاملة مكتب'],
  'Participant registration updated': ['Participant registration updated', 'تحديث تسجيل مشترك'],
  'Request documents updated': ['Request documents updated', 'تحديث مستندات الطلب'],
  'member.signup': ['Account created', 'إنشاء حساب'],
  'member.password': ['Password changed', 'تغيير كلمة المرور'],
  'member.password-reset': ['Password reset by the office', 'إعادة تعيين كلمة المرور من المكتب'],
  'member.publish': ['Update published by a member', 'نشر تحديث من عضو'],
  'member.request': ['Request sent by a member', 'طلب مُرسل من عضو'],
  'member.request-withdrawn': ['Request withdrawn by a member', 'سحب عضو لطلبه'],
  'member.staff-message': ['Message from the office to a member', 'رسالة من المكتب إلى عضو'],
  'profile.update-request': ['Profile correction requested', 'طلب تصحيح الملف'],
  'profile.request-reviewed': ['Profile correction reviewed', 'مراجعة تصحيح الملف'],
  'volunteer.confirm': ['Volunteer place confirmed', 'تأكيد مكان متطوّع']
};

export const auditAction = a => (ACTIONS[a.what] ? t(...ACTIONS[a.what]) : t(a.what, a.whatAr || a.what));

/** "YYYY-MM-DD HH:MM" in local time. */
export function auditTime(at) {
  if (!at || !String(at).includes('T')) return at || '';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  const two = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
