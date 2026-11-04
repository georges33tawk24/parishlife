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

export const nextStep = s =>
  s.status === 'cancelled'
    ? [L('Nothing more to do — the request was cancelled', 'لا شيء آخر — أُلغي الطلب'), '']
    : s.status === 'rejected'
      ? [L('Nothing more to do — the request was declined', 'لا شيء آخر — رُفض الطلب'), '']
      : s.kind === 'certificate' && !s.sourceRecordId
        ? [
            s.requestedSacramentId
              ? L('Wait until the sacrament is celebrated and approved', 'انتظار الاحتفال بالسرّ واعتماده')
              : eligibleSources(s.person).length
                ? L('Link the approved register entry', 'ربط القيد المعتمد')
                : L(
                    'Record the sacrament first — there is no approved entry yet',
                    'سجّل السرّ أولاً — لا قيد معتمد بعد'
                  ),
            OFFICE()
          ]
        : {
            requested: [
              L('Accept or decline the request', 'قبول الطلب أو رفضه'),
              L('Priest or parish office', 'الكاهن أو مكتب الرعية')
            ],
            'office-reviewed': [L('Accept or decline the request', 'قبول الطلب أو رفضه'), PRIEST()],
            preparing: [
              L('Finish the preparation checklist and set the date', 'إكمال لائحة التحضير وتحديد الموعد'),
              OFFICE()
            ],
            draft: [
              s.kind === 'certificate'
                ? L('Send the request to the priest', 'إرسال الطلب إلى الكاهن')
                : L(
                    'Send the celebrated sacrament to the priest for approval',
                    'إرسال السرّ المحتفل به إلى الكاهن للاعتماد'
                  ),
              OFFICE()
            ],
            scheduled: [
              s.date > today()
                ? L(`Wait for the celebration on ${celebrationText(s)}`, `انتظار الاحتفال في ${celebrationText(s)}`)
                : L('Confirm it was celebrated and send it for approval', 'تأكيد الاحتفال وإرساله للاعتماد'),
              OFFICE()
            ],
            'awaiting-signature': [
              s.kind === 'certificate'
                ? L('Check the request and approve it', 'مراجعة الطلب واعتماده')
                : L('Check against the register book and approve', 'المطابقة مع دفتر السجل والاعتماد'),
              PRIEST()
            ],
            approved: [L('Sign and issue the certificate', 'توقيع الشهادة وإصدارها'), PRIEST()],
            registered: [
              L('Done — request a certificate whenever one is needed', 'منجز — اطلب شهادة متى احتجت إليها'),
              ''
            ],
            issued: [L('Done — the certificate was issued', 'منجز — صدرت الشهادة'), '']
          }[s.status] || [L('Review the record', 'مراجعة القيد'), OFFICE()];

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
