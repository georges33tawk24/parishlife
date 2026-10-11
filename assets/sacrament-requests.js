/* Sacrament and certificate requests from the member portal: the words the portal, the
   parish office and the notifications share. Every label is a function of the interface
   language, so a switch to Arabic re-renders in Arabic. */
import { t, fmtDate } from './i18n.js';

/* `the` is the Arabic definite form used inside sentences ("طلب المعمودية"). */
export const REQUEST_KINDS = [
  { id: 'baptism', icon: 'water', en: 'Baptism', ar: 'معمودية', the: 'المعمودية',
    descEn: 'For a child or an adult', descAr: 'لطفل أو لشخص بالغ' },
  { id: 'communion', icon: 'chalice', en: 'First Communion', ar: 'المناولة الأولى', the: 'المناولة الأولى',
    descEn: 'For a child getting ready to receive', descAr: 'لطفل يستعدّ للمناولة' },
  { id: 'confirmation', icon: 'flame', en: 'Confirmation', ar: 'الميرون', the: 'الميرون',
    descEn: 'Chrismation, the seal of the Holy Spirit', descAr: 'مسحة الميرون، ختم الروح القدس' },
  { id: 'marriage', icon: 'rings', en: 'Marriage', ar: 'إكليل', the: 'الإكليل',
    descEn: 'Open your marriage file with the parish', descAr: 'افتح ملف الزواج مع الرعية' },
  { id: 'funeral', icon: 'candle', en: 'Funeral', ar: 'جنّاز', the: 'الجنّاز',
    descEn: 'For a family member who has died', descAr: 'لأحد أفراد العائلة المتوفّين' },
  { id: 'certificate', icon: 'cert', en: 'Certificate', ar: 'شهادة', the: 'الشهادة',
    descEn: 'A copy of an entry in the parish register', descAr: 'إفادة عن قيد في سجلّ الرعية' }
];
export const kindOf = id => REQUEST_KINDS.find(k => k.id === id) || { id, icon: 'doc', en: id, ar: id, the: id, descEn: '', descAr: '' };
export const kindName = id => t(kindOf(id).en, kindOf(id).ar);

/* Which certificate, and the usual reasons for asking. Purposes are sent in English so the
   office reads the same words whichever language the parishioner used; officeText()
   shows them back in the office's language. */
export const CERTIFICATE_OF = [['baptism', 'Baptism certificate', 'شهادة معمودية'], ['communion', 'First Communion certificate', 'شهادة مناولة أولى'],
  ['confirmation', 'Confirmation certificate', 'شهادة ميرون'], ['marriage', 'Marriage certificate', 'شهادة إكليل']];
export const certificateName = id => { const c = CERTIFICATE_OF.find(x => x[0] === id); return c ? t(c[1], c[2]) : id; };
export const PURPOSES = [
  ['Civil registry or mukhtar', 'معاملة رسمية أو مختار'],
  ['Marriage file', 'ملف زواج'],
  ['Godparent or sponsor', 'إشبين أو عرّاب'],
  ['School registration', 'تسجيل مدرسي'],
  ['Travel or visa', 'سفر أو تأشيرة']
];
export const purposeText = value => { const p = PURPOSES.find(x => x[0] === value); return p ? t(p[0], p[1]) : value; };
export const LANGUAGES = [['bilingual', 'Arabic and English', 'عربي وإنكليزي'], ['arabic', 'Arabic', 'عربي'], ['english', 'English', 'إنكليزي']];
export const languageName = id => { const l = LANGUAGES.find(x => x[0] === id); return l ? t(l[1], l[2]) : id; };

/* A YYYY-MM-DD string is a calendar day, not a UTC instant. */
export const dayDate = value => {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(value || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : value;
};
export const fmtDay = value => fmtDate(dayDate(value));
export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ---- where a request stands ---------------------------------------------- */
const STAGES = {
  received:   ['Sent to the parish office', 'أُرسل إلى مكتب الرعية', 'info', 'st-sent'],
  review:     ['With the priest', 'لدى الكاهن', 'warning', 'st-review'],
  preparing:  ['In preparation', 'قيد التحضير', 'info', 'st-wait'],
  scheduled:  ['Date confirmed', 'الموعد مؤكَّد', 'success', 'st-ok'],
  celebrated: ['Being recorded', 'قيد التدوين', 'info', 'st-wait'],
  completed:  ['Completed', 'مكتمل', 'success', 'st-ok'],
  signing:    ['Being signed', 'قيد التوقيع', 'info', 'st-wait'],
  ready:      ['Ready to collect', 'جاهزة للاستلام', 'success', 'st-ok'],
  declined:   ['Not accepted', 'لم يُقبل', 'danger', 'st-no'],
  cancelled:  ['Cancelled', 'أُلغي', 'danger', 'st-no'],
  withdrawn:  ['Withdrawn', 'مسحوب', '', 'st-pause']
};
const CERTIFICATE_REVIEW = ['Being checked', 'قيد التدقيق', 'warning', 'st-review'];
/* [label, tone, status icon] for the stage pill */
export const stageInfo = r => {
  const s = r.kind === 'certificate' && r.progress.stage === 'review' ? CERTIFICATE_REVIEW : STAGES[r.progress.stage] || STAGES.received;
  return [t(s[0], s[1]), s[2], s[3]];
};
export const CLOSED = new Set(['declined', 'cancelled', 'withdrawn']);
export const isActive = r => !CLOSED.has(r.progress.stage) && !['completed', 'ready'].includes(r.progress.stage);

/* The steps a parishioner sees, and how many are behind them. */
export const stepsFor = r => r.kind === 'certificate'
  ? [t('Request sent', 'أُرسل الطلب'), t('Register checked', 'التحقّق من السجل'), t('Signed by the priest', 'توقيع الكاهن'), t('Ready to collect', 'جاهزة للاستلام')]
  : [t('Request sent', 'أُرسل الطلب'), t('Parish office', 'مكتب الرعية'), t('Priest’s decision', 'قرار الكاهن'), t('Preparation', 'التحضير'), t('Celebration', 'الاحتفال'), t('Parish register', 'سجلّ الرعية')];
const DONE_SACRAMENT = { received: 1, review: 2, preparing: 3, scheduled: 4, celebrated: 5, completed: 6 };
const DONE_CERTIFICATE = { received: 1, review: 1, signing: 2, ready: 4 };
const REACHED_SACRAMENT = { submitted: 1, accepted: 2, 'priest-accepted': 3, prepared: 4, celebrated: 5 };
const REACHED_CERTIFICATE = { submitted: 1, approved: 2 };
/* How many steps are complete; for a closed request, how far it got before it closed. */
export const stepsDone = r => {
  const certificate = r.kind === 'certificate';
  if (!CLOSED.has(r.progress.stage)) return (certificate ? DONE_CERTIFICATE : DONE_SACRAMENT)[r.progress.stage] ?? 1;
  const reached = r.progress.events.map(e => (certificate ? REACHED_CERTIFICATE : REACHED_SACRAMENT)[e.key] || 0);
  return Math.min(Math.max(1, ...reached), (certificate ? 4 : 6) - 1);
};

/* What happens next, in one or two sentences, for the parishioner. */
export function nextText(r) {
  const p = r.progress, date = p.plannedDate || p.preferredDate;
  switch (p.stage) {
    case 'received': return t('The parish office will review your request and contact you if anything is missing.', 'سيراجع مكتب الرعية طلبك ويتواصل معك إذا نقص أي شيء.');
    case 'review': return r.kind === 'certificate'
      ? t('The parish office is finding the entry in the parish register.', 'يبحث مكتب الرعية عن القيد في سجلّ الرعية.')
      : t('The parish office has reviewed your request. The priest will now decide.', 'راجع مكتب الرعية طلبك، وسيقرّر الكاهن الآن.');
    case 'preparing': return t('The priest accepted your request. Work through the preparation below; the parish office will confirm the date.', 'قبل الكاهن طلبك. أكمِل التحضير أدناه، وسيؤكّد مكتب الرعية الموعد.');
    case 'scheduled': return t(`Everything is ready. The celebration is planned for ${fmtDay(date)}.`, `كل شيء جاهز. الاحتفال مقرّر في ${fmtDay(date)}.`);
    case 'celebrated': return t('The celebration took place. The parish office is entering it in the register.', 'تمّ الاحتفال، ويدوّنه مكتب الرعية الآن في السجل.');
    case 'completed': return t(`Recorded in the parish register as ${p.register}. You can ask for a certificate at any time.`, `دُوّن في سجلّ الرعية برقم ${p.register}. يمكنك طلب شهادة في أي وقت.`);
    case 'signing': return t('Approved by the priest. Your certificate is being signed.', 'وافق الكاهن، والشهادة قيد التوقيع.');
    case 'ready': return t('Your certificate is signed and ready. Collect it from the parish office.', 'شهادتك موقّعة وجاهزة. استلمها من مكتب الرعية.');
    case 'declined': return t('The parish could not accept this request.', 'تعذّر على الرعية قبول هذا الطلب.');
    case 'cancelled': return t('This request was cancelled.', 'أُلغي هذا الطلب.');
    case 'withdrawn': return t('You withdrew this request. You can send a new one at any time.', 'سحبتَ هذا الطلب، ويمكنك إرسال طلب جديد في أي وقت.');
    default: return '';
  }
}

/* The request's history, one line per step that happened. */
const EVENTS = {
  submitted: ['Request sent', 'أُرسل الطلب'], accepted: ['Reviewed by the parish office', 'راجعه مكتب الرعية'],
  'priest-accepted': ['Accepted by the priest', 'قبله الكاهن'], prepared: ['Preparation completed', 'اكتمل التحضير'],
  celebrated: ['Celebrated', 'تمّ الاحتفال'], registered: ['Recorded in the parish register', 'دُوّن في سجلّ الرعية'],
  approved: ['Approved by the priest', 'وافق عليه الكاهن'], issued: ['Signed and ready to collect', 'وُقّعت وهي جاهزة للاستلام'],
  declined: ['Not accepted', 'لم يُقبل'], cancelled: ['Cancelled', 'أُلغي'], withdrawn: ['You withdrew the request', 'سحبتَ الطلب']
};
export const eventLabel = key => EVENTS[key] ? t(...EVENTS[key]) : key;

/* Notification titles: the server stores English; the portal shows them in either language. */
export function noticeText(n, request) {
  const event = String(n.kind || '').replace(/^request-/, '');
  const k = kindOf(request?.kind || ''), en = k.en, the = k.the;
  const titles = {
    review: [`${en} request sent to the priest`, `أُرسل طلب ${the} إلى الكاهن`],
    accepted: request?.kind === 'certificate' ? ['Certificate request accepted', 'قُبل طلب الشهادة'] : [`${en} request accepted`, `قُبل طلب ${the}`],
    declined: [`${en} request not accepted`, `لم يُقبل طلب ${the}`],
    date: [`${en} date set`, `حُدّد موعد ${the}`],
    scheduled: [`${en} preparation complete`, `اكتمل تحضير ${the}`],
    cancelled: [`${en} request cancelled`, `أُلغي طلب ${the}`],
    registered: [`${en} recorded in the parish register`, `قيد ${the} في سجلّ الرعية`],
    ready: ['Certificate ready to collect', 'الشهادة جاهزة للاستلام']
  };
  const title = request && titles[event] ? t(...titles[event]) : n.title;
  const body = ['date', 'scheduled'].includes(event) && /^\d{4}-\d\d-\d\d$/.test(n.body || '') ? fmtDay(n.body) : n.body;
  return { title, body };
}
