/* Purpose: the pieces the sacrament record / certificate screen (certificate.jsx) and its actions
   (certificate-actions.jsx) share: bilingual twins and field pairs, the celebrant choice, the status and workflow
   stages with the progress panel, the history labels, the document language and telephone links.
   Main members: L, twin, twinFields, celebrantPick, sacramentStatus, workflowStages, progressPanel, HIST, histLabel,
   when, docLang, telLink. Split out of certificate.jsx without changing behaviour. */

import { Select } from '../../ui/components.jsx';
import { t, fmtDate } from '../../../lib/i18n.js';

import { Icon, Status, Pill } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';

import { PEOPLE } from '../../model/data.js';

import { DOC_LANGS, celebrationText, nameIn, nextStep, zoned } from './records-shared.jsx';

export const L = (en, ar) => t(en, ar);
/* Both spellings as typed: the one present first, the Arabic under the Latin when there are two. Never copied across. */
export const twin = (lat, ar) =>
  lat || ar ? (
    <>
      {lat || ar}
      {lat && ar ? (
        <small className="dim" dir="rtl" style={{ display: 'block', fontFamily: 'var(--arabic)' }}>
          {ar}
        </small>
      ) : (
        ''
      )}
    </>
  ) : null;
/* A checklist label in the reader's language, the other one when that is all the parish typed. */
export const labelOf = r => L(r.label || r.labelAr, r.labelAr || r.label);
/* A Latin field and its Arabic twin side by side; ids are `${id}` and `${id}Ar`. */
export const twinFields = (id, label, lat, ar) => (
  <div className="formgrid">
    <C.Field label={label} id={id} value={lat || ''} />
    <C.Field label={`${label} · ${L('Arabic', 'بالعربية')}`} id={`${id}Ar`} value={ar || ''} ar={true} dir="rtl" />
  </div>
);
/* Optionally links the celebrant to a person record of this parish; the names above stay as typed. */
export const celebrantPick = (id, value) => (
  <div className="formrow">
    <label className="label" htmlFor={id}>
      {L('Celebrant in People (optional)', 'المحتفل في سجل المؤمنين (اختياري)')}
    </label>
    <Select id={id} defaultValue={value || ''}>
      <option value="">{L('Not linked', 'غير مرتبط')}</option>
      {PEOPLE.map((p, i) => (
        <option key={i} value={p.id}>
          {nameIn(p)}
        </option>
      ))}
    </Select>
  </div>
);

export const sacramentStatus = s =>
  s.apiStatus === 'WaitingForSource' ? (
    <Pill label={L('Waiting for official entry', 'بانتظار قيد رسمي')} tone="warning" />
  ) : s.status === 'draft' ? (
    <Pill
      label={
        s.kind === 'certificate'
          ? s.apiStatus === 'Returned'
            ? L('Returned · prepare again', 'أُعيدت · حضّرها من جديد')
            : L('Request received', 'استُلم الطلب')
          : L('Returned by the priest', 'أعاده الكاهن')
      }
      tone="info"
    />
  ) : (
    <Status k={s.status} />
  );

/* ---------------- record page: progress, the document, details ---------------- */
/* When a step happened, from the record's own history (the newest matching entry). */
export const stepAt = (s, ...actions) =>
  [...(s.history || [])].reverse().find(h => actions.includes(h.action))?.at || '';

export const workflowStages = s =>
  s.kind === 'certificate'
    ? [
        [L('Requested', 'طُلبت'), true, ''],
        [L('Register entry linked', 'رُبط القيد'), !!s.sourceRecordId, ''],
        [L('Approved by the priest', 'اعتمدها الكاهن'), !!s.signedAt, s.signedAt],
        ...(s.bishopReviewRequired
          ? [[L('Accepted by the bishop', 'قبلها المطران'), !!s.acceptedAt, s.acceptedAt]]
          : []),
        [L('Issued', 'صدرت'), !!s.issuedAt, s.issuedAt]
      ]
    : [
        [L('Requested', 'طُلب'), true, s.requestedAt],
        [L('Accepted by the priest', 'قبله الكاهن'), !!s.requestApprovedAt, s.requestApprovedAt],
        [
          L('Prepared', 'اكتمل التحضير'),
          ['scheduled', 'draft', 'awaiting-signature', 'registered'].includes(s.status),
          stepAt(s, 'schedule')
        ],
        [
          L('Celebrated', 'احتُفل به'),
          ['draft', 'awaiting-signature', 'registered'].includes(s.status),
          '',
          'celebration'
        ],
        [L('Entered in the register', 'دُوّن في السجل'), s.status === 'registered', s.registeredAt]
      ];

/* What each step says under its name: when it happened, how long the current one has waited, or when the celebration is planned. */
export function stepWhen(s, stages, i, now) {
  const [, done, at, kind] = stages[i];
  if (kind === 'celebration') {
    if (!s.date) return '';
    return done ? celebrationText(s) : `${L('Planned for', 'مقرّر في')} ${celebrationText(s)}`;
  }
  if (done) return at ? when(at) : '';
  if (i !== now) return '';
  const since = [...stages.slice(0, i)].reverse().find(([, ok, stamp]) => ok && stamp)?.[2];
  return since ? `${L('Waiting since', 'بانتظار منذ')} ${when(since)}` : '';
}

/* Where the request stands, one numbered step at a time, and the single next thing to do. */
export const progressPanel = s => {
  const stages = workflowStages(s),
    closed = ['cancelled', 'rejected'].includes(s.status);
  const now = closed ? -1 : stages.findIndex(([, done]) => !done);
  const [next, owner] = nextStep(s);
  return (
    <section className="panel progresspanel">
      <div className="panel-b">
        <div className="progress-top">
          <h3>{s.kind === 'certificate' ? L('Request progress', 'مراحل الطلب') : L('Progress', 'المراحل')}</h3>
          {sacramentStatus(s)}
        </div>{' '}
        <p className="nextstep">
          <span className="lbl">{now < 0 ? L('Status', 'الحالة') : L('Next step', 'الخطوة التالية')}</span>{' '}
          <b>{next}</b>
          {owner ? (
            <span className="owner">
              <Icon name="people" size={14} />
              {owner}
            </span>
          ) : (
            ''
          )}
        </p>{' '}
        <ol className={`steps${closed ? ' closed' : ''}`}>
          {stages.map(([label, done], i) => {
            const at = stepWhen(s, stages, i, now);
            return (
              <li key={i} className={done ? 'done' : i === now ? 'now' : ''}>
                <span className="dot" aria-hidden="true">
                  {done ? <Icon name="check" size={13} /> : i + 1}
                </span>
                <span className="step-text">
                  <span className="lbl">{label}</span>
                  {at ? <span className="when">{at}</span> : ''}
                </span>{' '}
                <span className="sr-only">
                  {done
                    ? L('done', 'منجز')
                    : i === now
                      ? L('current step', 'الخطوة الحالية')
                      : L('not yet', 'لم يحن بعد')}
                </span>
              </li>
            );
          })}
        </ol>{' '}
        {s.kind === 'certificate' && (s.purpose || s.godparents) ? (
          <p className="t-caption dim" style={{ marginTop: '12px' }}>
            {L('Purpose of the request', 'غاية الطلب')}: {s.purpose || s.godparents}
          </p>
        ) : (
          ''
        )}
      </div>
    </section>
  );
};

export const HIST = {
  open: ['Request received', 'استُلم الطلب'],
  accept: ['Accepted by the priest', 'قبله الكاهن'],
  schedule: ['Celebration date set', 'حُدّد موعد الاحتفال'],
  reschedule: ['Date withdrawn for changing', 'سُحب الموعد للتغيير'],
  decline: ['Declined', 'رُفض'],
  cancel: ['Cancelled', 'أُلغي'],
  'record-celebration': ['Celebration recorded', 'سُجّل الاحتفال'],
  'amend-facts': ['Details corrected', 'صُحّحت التفاصيل'],
  'return-entry': ['Returned to the office', 'أُعيد إلى المكتب'],
  register: ['Registered', 'سُجّل في الدفتر'],
  sign: ['Approved by the priest', 'اعتمده الكاهن'],
  release: ['Handed over', 'سُلّمت'],
  'sacrament requested': ['Request received', 'استُلم الطلب'],
  'request submitted': ['Request received', 'استُلم الطلب'],
  'office review completed': ['Reviewed by the office', 'راجعه المكتب'],
  'request accepted for preparation': ['Accepted by the priest', 'قبله الكاهن'],
  'request declined': ['Declined', 'رُفض'],
  'preparation updated': ['Preparation updated', 'حُدّث التحضير'],
  'preparation completed': ['Preparation completed', 'اكتمل التحضير'],
  'preparation cancelled': ['Preparation cancelled', 'أُلغي التحضير'],
  'details updated': ['Details updated', 'حُدّثت التفاصيل'],
  'request amendment proposed': ['Request amendment proposed', 'اقتُرح تعديل الطلب'],
  'request amendment approved': ['Request amendment approved', 'اعتُمد تعديل الطلب'],
  'request amendment rejected': ['Request amendment rejected', 'رُفض تعديل الطلب'],
  'submitted for clergy review': ['Sent to the priest', 'أُرسل إلى الكاهن'],
  submit: ['Sent to the priest for approval', 'أُرسل إلى الكاهن للاعتماد'],
  'sacrament celebrated': ['Celebrated', 'احتُفل به'],
  approve: ['Approved', 'اعتُمد'],
  issue: ['Signed and issued', 'وُقّع وصدر'],
  reject: ['Rejected', 'رُفض'],
  cancelled: ['Cancelled', 'أُلغي'],
  'source linked': ['Register entry linked', 'رُبط القيد'],
  correction: ['Corrected', 'صُحّح'],
  'documents updated': ['Documents updated', 'حُدّثت المستندات'],
  'office-review': ['Reviewed by the office', 'راجعه المكتب'],
  requirement: ['Preparation checklist updated', 'حُدّثت لائحة التحضير'],
  'sync-requirements': ['Checklist updated to the parish list', 'حُدّثت اللائحة وفق لائحة الرعية'],
  'propose-amendment': ['Change to the request proposed', 'اقتُرح تعديل على الطلب'],
  'approve-amendment': ['Change to the request approved', 'اعتُمد تعديل الطلب'],
  'reject-amendment': ['Change to the request rejected', 'رُفض تعديل الطلب']
};

export const histReason = h => h.reason;

export const histLabel = a =>
  HIST[a]
    ? L(...HIST[a])
    : String(a || '')
        .charAt(0)
        .toUpperCase() + String(a || '').slice(1);

export const when = at => {
  if (!at) return '';
  const d = zoned(at),
    v = String(at);
  return d
    ? `${fmtDate(d)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : `${fmtDate(v.slice(0, 10))}${v.length > 10 ? ` · ${v.slice(11, 16)}` : ''}`;
};

/* The document opens in the language the parishioner asked for, when they asked online. */
export const docLang = (s, lang) =>
  DOC_LANGS().some(([k]) => k === lang)
    ? lang
    : DOC_LANGS().some(([k]) => k === s?.language)
      ? s.language
      : 'bilingual';

export const telLink = v => (
  <a href={`tel:${String(v).replace(/[^\d+]/g, '')}`}>
    <bdi dir="ltr">{v}</bdi>
  </a>
);
