/* What the sacrament screens share: kinds of sacrament, official sources, the next step of a
   request and celebration times. */
import { Select } from '../../ui/components.jsx';
import { t, fmtDate } from '../../../lib/i18n.js';
import { SACRAMENTS } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

export const KIND = {
  baptism: ['Baptism', 'معمودية'],
  communion: ['First Communion', 'المناولة الأولى'],
  confirmation: ['Confirmation (Chrismation)', 'الميرون'],
  marriage: ['Marriage', 'إكليل'],
  funeral: ['Funeral', 'جنّاز'],
  anointing: ['Anointing of the sick', 'مسحة المرضى'],
  other: ['Other sacramental record', 'قيد آخر'],
  certificate: ['Certificate request', 'طلب شهادة']
};

export const kindLabel = k => L(...(KIND[k] || [k, k]));

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const official = s => s && s.kind !== 'certificate' && ['registered', 'issued'].includes(s.status);

export const eligibleSources = personId => SACRAMENTS.filter(s => official(s) && (!personId || s.person === personId));

export const sourceFor = s => SACRAMENTS.find(x => x.id === s.sourceRecordId);

/* What happens next and who does it, in the words the office uses. */
const OFFICE = () => L('Parish office', 'مكتب الرعية'),
  PRIEST = () => L('Priest', 'الكاهن');

export const nameIn = p => (p ? L(p.lat || '', p.ar || p.lat || '') : '');

const BISHOP = () => L('Bishop', 'المطران');

/* The next step in the API's own states (modules/sacraments.js keeps the API status in apiStatus). */
export const nextStep = s => {
  if (s.status === 'cancelled')
    return [L('Nothing more to do — the request was cancelled', 'لا شيء آخر — أُلغي الطلب'), ''];
  if (s.status === 'rejected')
    return [L('Nothing more to do — the request was declined', 'لا شيء آخر — رُفض الطلب'), ''];
  if (s.kind === 'certificate')
    return (
      {
        WaitingForSource: [
          eligibleSources(s.person).length
            ? L('Link the registered entry', 'ربط القيد المسجَّل')
            : L(
                'Record the sacrament first — there is no registered entry yet',
                'سجّل السرّ أولاً — لا قيد مسجَّل بعد'
              ),
          OFFICE()
        ],
        Received: [
          L('Prepare the certificate and send it to the priest', 'تحضير الشهادة وإرسالها إلى الكاهن'),
          OFFICE()
        ],
        Prepared: [L('Send the certificate to the priest', 'إرسال الشهادة إلى الكاهن'), OFFICE()],
        Returned: [
          s.returnReason
            ? L(`Returned: ${s.returnReason}. Prepare it again`, `أُعيدت: ${s.returnReason}. حضّرها من جديد`)
            : L('Returned. Prepare it again', 'أُعيدت. حضّرها من جديد'),
          OFFICE()
        ],
        AwaitingSignature: [L('Check the request and approve it', 'مراجعة الطلب واعتماده'), PRIEST()],
        AwaitingBishop: [L('Waiting for the bishop’s acceptance', 'بانتظار قبول المطران'), BISHOP()],
        AuthorizedForIssuance: [
          L('Issue the certificate', 'إصدار الشهادة'),
          L('Priest or parish office', 'الكاهن أو مكتب الرعية')
        ],
        Issued: [L('Hand it over and record who received it', 'تسليمها وتسجيل المستلم'), OFFICE()],
        Released: [L('Done — the certificate was handed over', 'منجز — سُلّمت الشهادة'), ''],
        Withdrawn: [L('Nothing more to do — the certificate was withdrawn', 'لا شيء آخر — سُحبت الشهادة'), '']
      }[s.apiStatus] || [L('Review the request', 'مراجعة الطلب'), OFFICE()]
    );
  return (
    {
      requested: [L('Accept or decline the request', 'قبول الطلب أو رفضه'), PRIEST()],
      preparing: [L('Set the date and the celebrant', 'تحديد الموعد والمحتفل'), OFFICE()],
      scheduled: [
        s.date > today()
          ? L(`Wait for the celebration on ${celebrationText(s)}`, `انتظار الاحتفال في ${celebrationText(s)}`)
          : L('Record that it was celebrated and send it for approval', 'تسجيل الاحتفال وإرساله للاعتماد'),
        OFFICE()
      ],
      draft: [
        s.returnReason
          ? L(`Returned: ${s.returnReason}. Correct the details`, `أُعيد: ${s.returnReason}. صحّح التفاصيل`)
          : L('Correct the details', 'تصحيح التفاصيل'),
        OFFICE()
      ],
      'awaiting-signature': [
        L('Check against the register book and register', 'المطابقة مع دفتر السجل والتسجيل'),
        PRIEST()
      ],
      registered: [L('Done — request a certificate whenever one is needed', 'منجز — اطلب شهادة متى احتجت إليها'), '']
    }[s.status] || [L('Review the record', 'مراجعة القيد'), OFFICE()]
  );
};

/* The celebration as people say it: 25 Oct 2026 · 10:30 */
export const celebrationText = s => (s?.date ? `${fmtDate(s.date)}${s.time ? ` · ${s.time}` : ''}` : '');

/* Half-hour steps for the celebration time: a list is easier than a clock to set on any phone. */
const CELEBRATION_TIMES = Array.from(
  { length: 32 },
  (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
);

export const timeSelect = (id, value = '') => (
  <div className="formrow">
    <label className="label" htmlFor={id}>
      {L('Celebration time', 'وقت الاحتفال')}
    </label>{' '}
    <Select defaultValue={value} id={id} dir="ltr">
      <option value="">{L('Not set yet', 'لم يُحدَّد بعد')}</option>
      {[...new Set([...CELEBRATION_TIMES, ...(value ? [value] : [])])].sort().map((x, i) => (
        <option key={i} value={x}>
          {x}
        </option>
      ))}
    </Select>
  </div>
);

export const DOC_LANGS = () => [
  ['arabic', L('Arabic', 'عربي')],
  ['english', L('English', 'إنكليزي')],
  ['bilingual', L('Bilingual', 'ثنائي اللغة')]
];

export const zoned = at => {
  const v = String(at || '');
  if (!/T.*(Z|[+-]\d\d:?\d\d)$/.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
