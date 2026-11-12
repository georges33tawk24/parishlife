/* Requests from the member portal (sacraments, certificates, bookings and anything else): the
   words the portal, the parish office and the notifications share. Every label is a function of the interface
   language, so a switch to Arabic re-renders in Arabic. */
import { t, fmtDate } from '../../lib/i18n.js';
import { M } from './member-data.js';

/* `the` is the Arabic definite form used inside sentences ("طلب المعمودية"). */
export const REQUEST_KINDS = [
  {
    id: 'baptism',
    icon: 'water',
    en: 'Baptism',
    ar: 'معمودية',
    the: 'المعمودية',
    descEn: 'For a child or an adult',
    descAr: 'لطفل أو لشخص بالغ'
  },
  {
    id: 'communion',
    icon: 'chalice',
    en: 'First Communion',
    ar: 'المناولة الأولى',
    the: 'المناولة الأولى',
    descEn: 'For a child getting ready to receive',
    descAr: 'لطفل يستعدّ للمناولة'
  },
  {
    id: 'confirmation',
    icon: 'flame',
    en: 'Confirmation',
    ar: 'الميرون',
    the: 'الميرون',
    descEn: 'Chrismation, the seal of the Holy Spirit',
    descAr: 'مسحة الميرون، ختم الروح القدس'
  },
  {
    id: 'marriage',
    icon: 'rings',
    en: 'Marriage',
    ar: 'إكليل',
    the: 'الإكليل',
    descEn: 'Open your marriage file with the parish',
    descAr: 'افتح ملف الزواج مع الرعية'
  },
  {
    id: 'funeral',
    icon: 'candle',
    en: 'Funeral',
    ar: 'جنّاز',
    the: 'الجنّاز',
    descEn: 'For a family member who has died',
    descAr: 'لأحد أفراد العائلة المتوفّين'
  },
  {
    id: 'certificate',
    icon: 'cert',
    en: 'Certificate',
    ar: 'شهادة',
    the: 'الشهادة',
    descEn: 'A copy of an entry in the parish register',
    descAr: 'إفادة عن قيد في سجلّ الرعية'
  },
  {
    id: 'booking',
    icon: 'rooms',
    en: 'Book a hall or room',
    ar: 'حجز قاعة أو مكان',
    the: 'الحجز',
    other: true,
    descEn: 'For a reception, a gathering or a meeting',
    descAr: 'لاستقبال أو لقاء أو اجتماع'
  },
  {
    id: 'custom',
    icon: 'msg',
    en: 'Something else',
    ar: 'طلب آخر',
    the: 'الطلب',
    other: true,
    descEn: 'A blessing, a visit, a Mass intention or any other request',
    descAr: 'تبريك أو زيارة أو نيّة قدّاس أو أي طلب آخر'
  }
];
/* Short names for lists and notifications */
const SHORT = { booking: ['Booking', 'حجز'], custom: ['Request', 'طلب'] };
export const kindOf = id =>
  REQUEST_KINDS.find(k => k.id === id) || { id, icon: 'doc', en: id, ar: id, the: id, descEn: '', descAr: '' };
export const kindName = id => (SHORT[id] ? t(...SHORT[id]) : t(kindOf(id).en, kindOf(id).ar));

/* What a booking is usually for, and the requests people most often make. Sent in English,
   shown back in either language. */
export const OCCASIONS = [
  ['Baptism reception', 'استقبال معمودية'],
  ['First Communion party', 'حفلة مناولة أولى'],
  ['Wedding reception', 'استقبال إكليل'],
  ['Condolences', 'تقبّل التعازي'],
  ['Birthday', 'عيد ميلاد'],
  ['Family gathering', 'لقاء عائلي'],
  ['Meeting', 'اجتماع']
];
export const occasionText = value => {
  const o = OCCASIONS.find(x => x[0] === value);
  return o ? t(o[0], o[1]) : value;
};
export const TOPICS = [
  ['House blessing', 'تبريك منزل'],
  ['Mass intention', 'نيّة قدّاس'],
  ['Visit to a sick person', 'زيارة مريض'],
  ['Meeting with the priest', 'لقاء مع الكاهن'],
  ['Confession at home', 'اعتراف في المنزل']
];
export const topicText = value => {
  const o = TOPICS.find(x => x[0] === value);
  return o ? t(o[0], o[1]) : value;
};

/* Which certificate, and the usual reasons for asking. Purposes are sent in English so the
   office reads the same words whichever language the parishioner used; officeText()
   shows them back in the office's language. */
export const CERTIFICATE_OF = [
  ['baptism', 'Baptism certificate', 'شهادة معمودية'],
  ['communion', 'First Communion certificate', 'شهادة مناولة أولى'],
  ['confirmation', 'Confirmation certificate', 'شهادة ميرون'],
  ['marriage', 'Marriage certificate', 'شهادة إكليل']
];
export const certificateName = id => {
  const c = CERTIFICATE_OF.find(x => x[0] === id);
  return c ? t(c[1], c[2]) : id;
};
export const PURPOSES = [
  ['Civil registry or mukhtar', 'معاملة رسمية أو مختار'],
  ['Marriage file', 'ملف زواج'],
  ['Godparent or sponsor', 'إشبين أو عرّاب'],
  ['School registration', 'تسجيل مدرسي'],
  ['Travel or visa', 'سفر أو تأشيرة']
];
export const purposeText = value => {
  const p = PURPOSES.find(x => x[0] === value);
  return p ? t(p[0], p[1]) : value;
};
export const LANGUAGES = [
  ['bilingual', 'Arabic and English', 'عربي وإنكليزي'],
  ['arabic', 'Arabic', 'عربي'],
  ['english', 'English', 'إنكليزي']
];
export const languageName = id => {
  const l = LANGUAGES.find(x => x[0] === id);
  return l ? t(l[1], l[2]) : id;
};

/* A YYYY-MM-DD string is a calendar day, not a UTC instant. */
export const dayDate = value => {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(value || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : value;
};
export const fmtDay = value => fmtDate(dayDate(value));
/* A moment the parish recorded, in the reader's own time: 11 Oct 2026 · 14:32 */
export const fmtStamp = at => {
  const d = new Date(at || '');
  if (Number.isNaN(d.getTime())) return fmtDate(at);
  return `${fmtDate(d)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/* The planned celebration: 25 Oct 2026 · 10:30, or the day alone until a time is set. */
export const plannedText = p =>
  p.plannedDate ? `${fmtDay(p.plannedDate)}${p.plannedTime ? ` · ${p.plannedTime}` : ''}` : '';
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ---- where a request stands ---------------------------------------------- */
/* The API's case has one status and separate facts (accepted, approved by a priest, date confirmed,
   completed); the member sees those and nothing else. */
const STAGES = {
  received: ['Sent to the parish office', 'أُرسل إلى مكتب الرعية', 'info', 'st-sent'],
  needsinfo: ['The parish needs more information', 'تحتاج الرعية إلى معلومات إضافية', 'warning', 'st-review'],
  inprogress: ['Accepted by the parish', 'قبلته الرعية', 'info', 'st-wait'],
  scheduled: ['Date confirmed', 'الموعد مؤكَّد', 'success', 'st-ok'],
  cancelreq: ['Cancellation requested', 'طُلب الإلغاء', 'warning', 'st-review'],
  completed: ['Completed', 'مكتمل', 'success', 'st-ok'],
  declined: ['Not accepted', 'لم يُقبل', 'danger', 'st-no'],
  cancelled: ['Cancelled', 'أُلغي', 'danger', 'st-no'],
  withdrawn: ['Withdrawn', 'مسحوب', '', 'st-pause']
};
/* [label, tone, status icon] for the stage pill */
export const stageInfo = r => {
  const s = STAGES[r.progress.stage] || STAGES.received;
  return [t(s[0], s[1]), s[2], s[3]];
};
export const CLOSED = new Set(['declined', 'cancelled', 'withdrawn']);
export const isActive = r => !CLOSED.has(r.progress.stage) && r.progress.stage !== 'completed';

/* The steps a parishioner sees, and how many are behind them. A sacrament also waits for the priest. */
const SACRAMENT = new Set(['baptism', 'communion', 'confirmation', 'marriage', 'funeral']);
export const stepsFor = r =>
  SACRAMENT.has(r.kind)
    ? [
        t('Request sent', 'أُرسل الطلب'),
        t('Accepted by the parish', 'قبلته الرعية'),
        t('Approved by the priest', 'وافق الكاهن'),
        t('Date confirmed', 'تأكيد الموعد'),
        t('Completed', 'اكتمل')
      ]
    : [t('Request sent', 'أُرسل الطلب'), t('Accepted by the parish', 'قبلته الرعية'), t('Completed', 'اكتمل')];
/* The moments the API recorded for each step; a step with no recorded moment stays empty. */
export const stepTimes = r => {
  const dto = r.api?.dto || {},
    times = stepsFor(r).map(() => '');
  times[0] = dto.receivedAt || '';
  times[1] = dto.acceptedAt || '';
  if (SACRAMENT.has(r.kind)) times[2] = dto.clergyApprovedAt || '';
  times[times.length - 1] = dto.completedAt || '';
  return times;
};
/* How many steps are complete; for a closed request, how far it got before it closed. */
export const stepsDone = r => {
  const dto = r.api?.dto || {},
    total = stepsFor(r).length;
  if (r.progress.stage === 'completed') return total;
  let done = 1;
  if (dto.acceptedAt) done++;
  if (SACRAMENT.has(r.kind)) {
    if (dto.clergyApprovedAt) done++;
    if (dto.confirmedDate) done++;
  }
  return Math.min(done, total - 1);
};

/* What happens next, in one or two sentences, for the parishioner. */
export function nextText(r) {
  const p = r.progress,
    date = p.plannedDate;
  switch (p.stage) {
    case 'received':
      return t(
        'The parish office will review your request and contact you if anything is missing.',
        'سيراجع مكتب الرعية طلبك ويتواصل معك إذا نقص أي شيء.'
      );
    case 'needsinfo':
      return t(
        'The parish asked for more information. Answer below; the request is not declined.',
        'طلبت الرعية معلومات إضافية. أجب أدناه؛ لم يُرفض الطلب.'
      );
    case 'inprogress':
      return p.approved
        ? t(
            'The priest approved your request. No date is confirmed yet; the parish will contact you.',
            'وافق الكاهن على طلبك. لم يُؤكَّد موعد بعد، وستتواصل معك الرعية.'
          )
        : t(
            'The parish accepted your request for processing and will contact you to arrange it.',
            'قبلت الرعية طلبك للمعالجة وستتواصل معك لترتيبه.'
          );
    case 'scheduled':
      return t(
        `The date is confirmed for ${fmtDay(date)}${p.plannedTime ? ` at ${p.plannedTime}` : ''}.`,
        `الموعد مؤكَّد في ${fmtDay(date)}${p.plannedTime ? ` الساعة ${p.plannedTime}` : ''}.`
      );
    case 'cancelreq':
      return t(
        'You asked to cancel this request. The parish will review it.',
        'طلبتَ إلغاء هذا الطلب، وستراجعه الرعية.'
      );
    case 'completed':
      return t('The parish has completed your request.', 'أنجزت الرعية طلبك.');
    case 'declined':
      return t('The parish could not accept this request.', 'تعذّر على الرعية قبول هذا الطلب.');
    case 'cancelled':
      return t('This request was cancelled.', 'أُلغي هذا الطلب.');
    case 'withdrawn':
      return t(
        'You withdrew this request. You can send a new one at any time.',
        'سحبتَ هذا الطلب، ويمكنك إرسال طلب جديد في أي وقت.'
      );
    default:
      return '';
  }
}

/* The request's history, one line per step that happened. */
const EVENTS = {
  submitted: ['Request sent', 'أُرسل الطلب'],
  accepted: ['Accepted by the parish', 'قبلته الرعية'],
  approved: ['Approved by the priest', 'وافق عليه الكاهن'],
  completed: ['Completed', 'اكتمل'],
  declined: ['Not accepted', 'لم يُقبل'],
  cancelled: ['Cancelled', 'أُلغي'],
  withdrawn: ['You withdrew the request', 'سحبتَ الطلب']
};
export const eventLabel = key => (EVENTS[key] ? t(...EVENTS[key]) : key);

/* Notification titles: the server stores English; the portal shows them in either language. */
export function noticeText(n, request) {
  const event = String(n.kind || '').replace(/^request-/, '');
  const k = kindOf(request?.kind || ''),
    en = SHORT[k.id]?.[0] || k.en,
    the = k.the;
  const titles = {
    review: [`${en} request sent to the priest`, `أُرسل طلب ${the} إلى الكاهن`],
    accepted:
      request?.kind === 'certificate'
        ? ['Certificate request accepted', 'قُبل طلب الشهادة']
        : [`${en} request accepted`, `قُبل طلب ${the}`],
    declined: [`${en} request not accepted`, `لم يُقبل طلب ${the}`],
    date: [`${en} date set`, `حُدّد موعد ${the}`],
    scheduled: [`${en} preparation complete`, `اكتمل تحضير ${the}`],
    cancelled: [`${en} request cancelled`, `أُلغي طلب ${the}`],
    registered: [`${en} recorded in the parish register`, `قيد ${the} في سجلّ الرعية`],
    ready: ['Certificate ready to collect', 'الشهادة جاهزة للاستلام'],
    confirmed: ['Booking confirmed', 'أُكّد الحجز'],
    completed: ['Request completed', 'أُنجز الطلب']
  };
  if (request?.kind === 'booking')
    Object.assign(titles, {
      review: ['Booking request sent to the priest', 'أُرسل طلب الحجز إلى الكاهن'],
      declined: ['Booking request not accepted', 'لم يُقبل طلب الحجز'],
      cancelled: ['Booking cancelled', 'أُلغي الحجز']
    });
  if (request?.kind === 'custom') {
    const what = topicText(request.details.subject);
    Object.assign(titles, {
      accepted: [`${what}: request accepted`, `${what}: قُبل الطلب`],
      declined: [`${what}: request not accepted`, `${what}: لم يُقبل الطلب`],
      completed: [`${what}: done`, `${what}: أُنجز`]
    });
  }
  const title = request && titles[event] ? t(...titles[event]) : n.title;
  const dated = ['date', 'scheduled'].includes(event) && /^(\d{4}-\d\d-\d\d)(?: (\d\d:\d\d))?$/.exec(n.body || '');
  let body = dated ? fmtDay(dated[1]) + (dated[2] ? ` · ${dated[2]}` : '') : n.body;
  /* a booking notice always says which place and when */
  if (request?.kind === 'booking' && !body) {
    const v = (M.requestOptions?.venues || []).find(x => x.id === request.details.venue);
    body = `${v ? t(v.name, v.ar || v.name) : ''}${v ? ', ' : ''}${fmtDay(request.details.date)}, ${request.details.from}–${request.details.to}`;
  }
  return { title, body };
}

/* A phone number as people say it: Lebanese numbers with +961 and their groups, others as given. */
export const phoneShow = v => {
  const text = String(v || '').trim();
  if (!text || text === '—') return '—';
  const local = text.startsWith('+961')
    ? text.slice(4).replace(/\D/g, '')
    : text.startsWith('+')
      ? ''
      : text.replace(/\D/g, '').replace(/^0+/, '');
  if (!local) return text;
  return '+961 ' + [local.slice(0, -6), local.slice(-6, -3), local.slice(-3)].filter(Boolean).join(' ');
};
