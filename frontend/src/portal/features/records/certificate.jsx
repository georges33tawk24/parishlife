/* One sacrament record or certificate request: its progress, next step, celebration, history,
   documents and signatures. */
import { Fragment } from 'react';
import { Select } from '../../ui/components.jsx';
import { paint } from '../../ui/html.js';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { is, bus, S } from '../../model/store.js';
import { session, api } from '../../model/api.js';
import { RequestDocuments } from './request-documents.jsx';
import {
  Icon,
  PageHead,
  Panel,
  Status,
  Pill,
  Empty,
  openDrawer,
  openModal,
  closeOverlays,
  toast
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { need } from '../../shared/dialogs.jsx';
import { workflow as serverWorkflow, hydrate } from '../../model/persist.js';
import { sign } from '../../model/signing.js';
import { Drawing } from '../../ui/signature.jsx';
import { passkeyMessage } from '../../model/passkeys.js';
import { SACRAMENTS, PEOPLE, PREP_REQUIREMENTS, person } from '../../model/data.js';
import { onlineMark, sharedNote } from './online-requests.jsx';
import { certificateName, languageName } from '../../model/sacrament-requests.js';
import {
  DOC_LANGS,
  celebrationText,
  eligibleSources,
  kindLabel,
  nameIn,
  nextStep,
  official,
  sourceFor,
  timeSelect,
  today,
  zoned
} from './records-shared.jsx';
import { certificateSVG, docCard, downloadMenu, printDoc, viewDoc } from './certificate-document.jsx';

const L = (en, ar) => t(en, ar);

const sacramentStatus = s =>
  s.kind === 'certificate' && !sourceFor(s) && !['cancelled', 'rejected'].includes(s.status) ? (
    <Pill label={L('Waiting for official entry', 'بانتظار قيد رسمي')} tone="warning" />
  ) : s.status === 'draft' ? (
    <Pill
      label={
        s.kind === 'certificate'
          ? L('Request received', 'استُلم الطلب')
          : L('Celebrated · not submitted', 'تمّ الاحتفال · لم يُرسل')
      }
      tone="info"
    />
  ) : (
    <Status k={s.status} />
  );

/* ---------------- record page: progress, the document, details ---------------- */
/* When a step happened, from the record's own history (the newest matching entry). */
const stepAt = (s, ...actions) => [...(s.history || [])].reverse().find(h => actions.includes(h.action))?.at || '';

const workflowStages = s =>
  s.kind === 'certificate'
    ? [
        [L('Requested', 'طُلبت'), true, s.requestedAt || s.history?.[0]?.at || ''],
        [L('Register entry linked', 'رُبط القيد'), !!sourceFor(s), stepAt(s, 'source linked')],
        [
          L('Approved by the priest', 'اعتمدها الكاهن'),
          ['approved', 'issued'].includes(s.status),
          s.approvedAt || stepAt(s, 'approve')
        ],
        [L('Issued', 'صدرت'), s.status === 'issued', s.issuedAt || stepAt(s, 'issue')]
      ]
    : [
        [L('Requested', 'طُلب'), true, s.requestedAt || stepAt(s, 'sacrament requested', 'request submitted')],
        [
          L('Accepted by the priest', 'قبله الكاهن'),
          !!s.requestApprovedAt ||
            (['preparing', 'scheduled', 'draft', 'awaiting-signature', 'registered', 'issued'].includes(s.status) &&
              !String(s.reg).startsWith('SRQ/')),
          s.requestApprovedAt || stepAt(s, 'request accepted for preparation')
        ],
        [
          L('Prepared', 'اكتمل التحضير'),
          ['scheduled', 'draft', 'awaiting-signature', 'registered', 'issued'].includes(s.status),
          stepAt(s, 'preparation completed')
        ],
        [
          L('Celebrated', 'احتُفل به'),
          ['draft', 'awaiting-signature', 'registered', 'issued'].includes(s.status),
          '',
          'celebration'
        ],
        [
          L('Entered in the register', 'دُوّن في السجل'),
          ['registered', 'issued'].includes(s.status),
          s.approvedAt || stepAt(s, 'approve')
        ]
      ];

/* What each step says under its name: when it happened, how long the current one has waited, or when the celebration is planned. */
function stepWhen(s, stages, i, now) {
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
const progressPanel = s => {
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

const HIST = {
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
  'documents updated': ['Documents updated', 'حُدّثت المستندات']
};

/* A history reason that names a required document is shown in the reader's language. */
const REQUIREMENT_AR = Object.fromEntries(
  Object.values(PREP_REQUIREMENTS)
    .flat()
    .map(([en, ar]) => [en, ar])
);
const histReason = h =>
  h.action === 'documents updated' && REQUIREMENT_AR[h.reason] ? L(h.reason, REQUIREMENT_AR[h.reason]) : h.reason;

const histLabel = a =>
  HIST[a]
    ? L(...HIST[a])
    : String(a || '')
        .charAt(0)
        .toUpperCase() + String(a || '').slice(1);

const when = at => {
  if (!at) return '';
  const d = zoned(at),
    v = String(at);
  return d
    ? `${fmtDate(d)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : `${fmtDate(v.slice(0, 10))}${v.length > 10 ? ` · ${v.slice(11, 16)}` : ''}`;
};

/* The document opens in the language the parishioner asked for, when they asked online. */
const docLang = (s, lang) =>
  DOC_LANGS().some(([k]) => k === lang)
    ? lang
    : DOC_LANGS().some(([k]) => k === s?.language)
      ? s.language
      : 'bilingual';

const telLink = v => (
  <a href={`tel:${String(v).replace(/[^\d+]/g, '')}`}>
    <bdi dir="ltr">{v}</bdi>
  </a>
);

export function certificate(id, lang = '') {
  const s = SACRAMENTS.find(x => x.id === id);
  if (!s)
    return (
      <Empty
        glyph="doc"
        title={L('Record not found', 'لم يُعثر على القيد')}
        body={L(
          'Open a record from Requests or from a person’s Sacraments tab.',
          'افتح قيداً من الطلبات أو من تبويب الأسرار في سجل الشخص.'
        )}
      />
    );
  lang = docLang(s, lang);
  const source = s.kind === 'certificate' ? SACRAMENTS.find(x => x.id === s.sourceRecordId) : s;
  const record = source || s;
  const p = person(record.person) || { lat: '', ar: '' },
    cel = person(record.celebrant);
  const asRequest =
    s.kind === 'certificate' || ['requested', 'office-reviewed', 'rejected', 'cancelled'].includes(s.status);
  const hasDoc = !!source && (s.kind === 'certificate' || official(s));
  const proposed =
    s.kind !== 'certificate' &&
    !hasDoc &&
    !!s.date &&
    ['preparing', 'scheduled', 'draft', 'awaiting-signature'].includes(s.status);
  const purpose = s.kind === 'certificate' ? s.purpose || s.godparents : '';
  const planned =
    s.kind === 'certificate' && s.requestedSacramentId ? SACRAMENTS.find(x => x.id === s.requestedSacramentId) : null;
  const dlRows =
    s.kind === 'certificate'
      ? [
          [
            L('Person', 'الشخص'),
            <>
              <a href={`#/person/${p.id || ''}`}>{p.lat}</a>
              <small className="dim" style={{ display: 'block', fontFamily: 'var(--arabic)' }}>
                {p.ar}
              </small>
            </>
          ],
          [
            L('Certificate of', 'شهادة'),
            source ? (
              kindLabel(source.kind)
            ) : planned ? (
              <>
                {kindLabel(planned.kind)} <small className="dim">· {L('not celebrated yet', 'لم يُحتفل به بعد')}</small>
              </>
            ) : s.certificateOf ? (
              <>
                {certificateName(s.certificateOf)}{' '}
                <small className="dim">· {L('not linked to an entry yet', 'لم تُربط بقيد بعد')}</small>
              </>
            ) : (
              <span className="dim">{L('Not linked to an entry yet', 'لم تُربط بقيد بعد')}</span>
            )
          ],
          [L('Requested on', 'تاريخ الطلب'), fmtDate(s.date)],
          purpose ? [L('Purpose', 'الغاية'), purpose] : null,
          s.language ? [L('Language asked for', 'اللغة المطلوبة'), languageName(s.language)] : null,
          [
            L('Request reference', 'مرجع الطلب'),
            <span className="mono" dir="ltr">
              {s.reg}
            </span>
          ],
          source
            ? [
                L('Register entry', 'القيد'),
                <a className="mono" dir="ltr" href={`#/certificate/${source.id}`}>
                  {source.reg}
                </a>
              ]
            : planned
              ? [
                  L('Planned sacrament', 'السرّ المخطّط'),
                  <a className="mono" dir="ltr" href={`#/certificate/${planned.id}`}>
                    {planned.reg}
                  </a>
                ]
              : null
        ]
      : [
          [
            L('Person', 'الشخص'),
            <>
              <a href={`#/person/${p.id || ''}`}>{p.lat}</a>
              <small className="dim" style={{ display: 'block', fontFamily: 'var(--arabic)' }}>
                {p.ar}
              </small>
            </>
          ],
          [L('Sacrament', 'السرّ'), kindLabel(record.kind)],
          [
            record.date > today() ? L('Planned for', 'الموعد المقرّر') : L('Date', 'التاريخ'),
            record.date ? celebrationText(record) : L('Not set yet', 'لم يُحدَّد بعد')
          ],
          [L('Celebrant', 'المحتفل'), nameIn(cel) || L('To be assigned', 'يُحدَّد لاحقاً')],
          record.godparents ? [L('Godparents / witnesses', 'الإشبين / الشهود'), record.godparents] : null,
          [L('Book / page', 'الدفتر / الصفحة'), `${record.book || '—'} / ${record.page || '—'}`],
          [
            official(s) ? L('Register entry', 'رقم القيد') : L('Reference', 'المرجع'),
            <span className="mono" dir="ltr">
              {s.reg}
            </span>
          ],
          s.requestReference && s.requestReference !== s.reg
            ? [
                L('Request reference', 'مرجع الطلب'),
                <span className="mono" dir="ltr">
                  {s.requestReference}
                </span>
              ]
            : null,
          record.externalParish ? [L('Other parish', 'رعية أخرى'), record.externalParish] : null,
          record.externalReference ? [L('Their reference', 'مرجعها'), record.externalReference] : null,
          s.partner
            ? [
                L('Future spouse', 'الشريك'),
                <>
                  {s.partner}
                  {s.partnerParish ? <small className="dim">· {s.partnerParish}</small> : ''}
                </>
              ]
            : null
        ];
  if (s.memberReference)
    dlRows.push(
      [
        L('Sent online', 'أُرسل إلكترونياً'),
        <>
          <span className="mono" dir="ltr">
            {s.memberReference}
          </span>{' '}
          <small className="dim">· {L('member portal', 'بوّابة المؤمنين')}</small>
        </>
      ],
      s.contactPhone ? [L('Phone for this request', 'هاتف هذا الطلب'), telLink(s.contactPhone)] : null
    );
  if (s.bishopReview)
    dlRows.push([
      L('Bishop acceptance', 'قبول المطران'),
      s.bishopReview === 'pending'
        ? L('Awaiting bishop', 'بانتظار المطران')
        : s.bishopReview === 'accepted'
          ? L('Accepted', 'مقبولة')
          : L('Returned to priest', 'أُعيدت للكاهن')
    ]);
  const details = (
    <Panel title={L('Details', 'التفاصيل')}>
      <dl className="dl">
        {dlRows.filter(Boolean).map(([k, v], i) => (
          <Fragment key={i}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
      </dl>{' '}
      {s.requestNotes ? (
        <p className="t-caption" style={{ marginTop: '14px' }}>
          <b>{L('From the family', 'من العائلة')}:</b> {s.requestNotes}
        </p>
      ) : (
        ''
      )}{' '}
      {s.pendingAmendment ? (
        <div className="alert alert-warning" style={{ marginTop: '14px' }}>
          <b>{L('Amendment awaiting priest decision', 'تعديل بانتظار قرار الكاهن')}</b>
          <br />
          {s.pendingAmendment.reason}
          <br />
          {L('Requested date', 'التاريخ المطلوب')}: {s.pendingAmendment.date || '—'} · {L('Notes', 'ملاحظات')}:{' '}
          {s.pendingAmendment.notes || '—'}
        </div>
      ) : (
        ''
      )}
    </Panel>
  );
  const people = [
    [L('Request accepted by', 'قبل الطلب'), s.requestApprovedBy, s.requestApprovedAt],
    [L('Approved by', 'اعتمده'), s.approvedBy, s.approvedAt],
    [L('Issued by', 'أصدره'), s.issuedBy, s.issuedAt]
  ].filter(([, by]) => by);
  const activity = (
    <Panel title={L('Activity', 'النشاط')}>
      {
        <>
          {people.length ? (
            <dl className="dl" style={{ marginBottom: '14px' }}>
              {people.map(([k, by, at], i) => (
                <Fragment key={i}>
                  <dt>{k}</dt>
                  <dd>
                    {by}
                    <small className="dim" style={{ display: 'block' }}>
                      {when(at)}
                    </small>
                  </dd>
                </Fragment>
              ))}
            </dl>
          ) : (
            ''
          )}{' '}
          {(s.history || []).length ? (
            <div className="timeline">
              {s.history
                .slice()
                .reverse()
                .map((h, i) => (
                  <div key={i} className="tl-item">
                    <div className="when">{when(h.at)}</div>{' '}
                    <div className="what">
                      {histLabel(h.action)}
                      {h.by ? ` · ${h.by}` : ''}
                      {h.via === 'portal' ? ` · ${L('online', 'إلكترونياً')}` : ''}
                      {h.source ? (
                        <>
                          {' '}
                          ·{' '}
                          <span className="mono" dir="ltr">
                            {h.source}
                          </span>
                        </>
                      ) : (
                        ''
                      )}
                      {h.reason ? (
                        <small className="dim" style={{ display: 'block' }}>
                          {histReason(h)}
                        </small>
                      ) : (
                        ''
                      )}
                      {h.before && h.after ? (
                        <small className="dim" style={{ display: 'block' }}>
                          {L('Date', 'التاريخ')}: {h.before.date || '—'} → {h.after.date || '—'} ·{' '}
                          {L('Notes', 'ملاحظات')}: {h.before.notes || '—'} → {h.after.notes || '—'}
                        </small>
                      ) : (
                        ''
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="t-caption dim">{L('Nothing recorded yet.', 'لا شيء مسجَّل بعد.')}</p>
          )}
        </>
      }
    </Panel>
  );
  return (
    <>
      <PageHead
        crumbs={[
          { label: L('Records', 'السجلات') },
          {
            label: asRequest ? L('Requests', 'الطلبات') : L('Sacraments', 'الأسرار'),
            href: asRequest ? '#/requests' : '#/sacraments'
          },
          { label: s.reg }
        ]}
        title={kindLabel(s.kind)}
        sub={
          <>
            <bdi>{nameIn(p)}</bdi> ·{' '}
            <bdi className="mono" dir="ltr">
              {s.reg}
            </bdi>
            {s.date ? (
              <>
                {' '}
                · <bdi>{s.kind === 'certificate' ? fmtDate(s.date) : celebrationText(s)}</bdi>
              </>
            ) : (
              ''
            )}
            {onlineMark(s)}
          </>
        }
        actions={
          <>
            {s.kind !== 'certificate' && ['requested', 'office-reviewed'].includes(s.status) && is('priest') ? (
              <>
                <button className="btn btn-primary" id="acceptrequest">
                  <Icon name="check" size={17} />
                  {L('Accept request', 'قبول الطلب')}
                </button>
                <button className="btn btn-secondary" id="declinerequest">
                  {L('Decline', 'رفض')}
                </button>
              </>
            ) : s.kind !== 'certificate' &&
              s.status === 'requested' &&
              is('secretary', 'super_admin', 'bishop', 'diocesan_admin', 'parish_admin') ? (
              <button className="btn btn-primary" id="officereview">
                <Icon name="check" size={17} />
                {L('Mark as reviewed by the office', 'تعليم كمراجَع من المكتب')}
              </button>
            ) : s.kind !== 'certificate' && s.status === 'preparing' ? (
              <a className="btn btn-primary" href="#/sacraments">
                {L('Continue preparation', 'متابعة التحضير')}
              </a>
            ) : s.kind === 'certificate' &&
              !source &&
              s.requestedSacramentId &&
              ['draft', 'awaiting-signature'].includes(s.status) ? (
              <a className="btn btn-primary" href={`#/certificate/${s.requestedSacramentId}`}>
                <Icon name="sacr" size={17} />
                {L('Open the planned sacrament', 'افتح السرّ المخطّط له')}
              </a>
            ) : s.kind === 'certificate' &&
              !source &&
              ['draft', 'awaiting-signature'].includes(s.status) &&
              eligibleSources(s.person).length &&
              is('priest', 'secretary') ? (
              <button className="btn btn-primary" id="linksource">
                <Icon name="link" size={17} />
                {L('Link register entry', 'ربط القيد')}
              </button>
            ) : s.kind === 'certificate' &&
              !source &&
              ['draft', 'awaiting-signature'].includes(s.status) &&
              is('priest', 'secretary') ? (
              <a className="btn btn-secondary" href={`#/person/${s.person}/sacraments`}>
                <Icon name="sacr" size={17} />
                {L('See this person’s sacraments', 'عرض أسرار هذا الشخص')}
              </a>
            ) : is('priest') &&
              s.status === 'awaiting-signature' &&
              (s.kind === 'certificate' ? !!source : s.date <= today()) ? (
              <button className="btn btn-primary" id="approve">
                <Icon name="check" size={17} />
                {s.kind === 'certificate' ? L('Approve request', 'اعتماد الطلب') : L('Approve entry', 'اعتماد القيد')}
              </button>
            ) : is('priest') && s.kind === 'certificate' && s.status === 'approved' ? (
              <button className="btn btn-primary" id="sign">
                <Icon name="check" size={17} />
                {L('Sign and issue', 'التوقيع والإصدار')}
              </button>
            ) : s.kind !== 'certificate' && s.status === 'registered' ? (
              <button className="btn btn-secondary" id="startcertreq">
                <Icon name="doc" size={17} />
                {L('Request a certificate', 'طلب شهادة')}
              </button>
            ) : is('secretary', 'priest') &&
              ['draft', 'scheduled'].includes(s.status) &&
              (s.kind === 'certificate' ? !!source : s.date <= today()) ? (
              <button className="btn btn-primary" id="submit">
                <Icon name="send" size={17} />
                {s.status === 'scheduled'
                  ? L('Confirm celebrated and send for approval', 'تأكيد الاحتفال وإرساله للاعتماد')
                  : L('Send to the priest', 'إرسال إلى الكاهن')}
              </button>
            ) : (
              ''
            )}{' '}
            {s.kind !== 'certificate' && ['draft', 'scheduled'].includes(s.status) && is('secretary', 'priest') ? (
              <button className="btn btn-secondary" id="editentry">
                <Icon name="edit" size={17} />
                {L('Edit details', 'تعديل التفاصيل')}
              </button>
            ) : (
              ''
            )}{' '}
            {s.kind !== 'certificate' &&
            s.requestApprovedAt &&
            ['preparing', 'scheduled', 'draft', 'awaiting-signature'].includes(s.status) &&
            is('secretary', 'priest') &&
            !s.pendingAmendment ? (
              <button className="btn btn-secondary" id="amendrequest">
                {L('Propose request amendment', 'اقتراح تعديل الطلب')}
              </button>
            ) : (
              ''
            )}{' '}
            {s.pendingAmendment && is('priest') ? (
              <>
                <button className="btn btn-primary" id="approveamend">
                  {L('Approve amendment', 'اعتماد التعديل')}
                </button>
                <button className="btn btn-secondary" id="rejectamend">
                  {L('Reject amendment', 'رفض التعديل')}
                </button>
              </>
            ) : (
              ''
            )}{' '}
            {s.status === 'awaiting-signature' && is('priest') ? (
              <button className="btn btn-secondary" id="reject">
                {L('Reject', 'رفض')}
              </button>
            ) : (
              ''
            )}{' '}
            {s.kind === 'certificate' &&
            ['draft', 'awaiting-signature'].includes(s.status) &&
            is('secretary', 'priest') ? (
              <button className="btn btn-ghost" id="cancelrequest">
                {L('Cancel request', 'إلغاء الطلب')}
              </button>
            ) : (
              ''
            )}
          </>
        }
      />{' '}
      {s.bishopReview === 'returned' ? (
        <div className="alert alert-warning">
          <b>{L('Returned by the bishop', 'أعادها المطران')}</b>
          <p>{s.bishopReviewNote || ''}</p>
          {is('priest') ? (
            <button className="btn btn-primary" id="resubmit-bishop">
              {L('Review and resubmit', 'مراجعة وإعادة تقديم')}
            </button>
          ) : (
            ''
          )}
        </div>
      ) : (
        ''
      )}{' '}
      {progressPanel(s)}{' '}
      {s.kind !== 'certificate' && s.status === 'scheduled' && s.date > today() ? (
        <C.InlineAlert
          tone="info"
          title={L('Scheduled, not celebrated yet', 'مجدول ولم يُحتفل به بعد')}
          body={L(
            `On or after ${fmtDate(s.date)}, confirm it was celebrated and send it to the priest for approval.`,
            `في ${fmtDate(s.date)} أو بعده، أكّد الاحتفال وأرسله إلى الكاهن للاعتماد.`
          )}
        />
      ) : (
        ''
      )}{' '}
      <div className="recordview">
        <div className="recordmain">
          {hasDoc ? (
            docCard(s, lang)
          ) : proposed ? (
            <Panel title={L('Proposed register preview · not official', 'معاينة القيد المقترح · غير رسمي')}>
              <div className="doccard-b">
                <div className="docthumb" aria-label={L('Proposed register entry', 'القيد المقترح')}>
                  {certificateSVG(s, lang)}
                </div>
                <div className="docmeta">
                  <p className="alert alert-warning">
                    {L(
                      'For checking details before celebration only. This is not an official register entry or certificate. The priest must approve the celebrated sacrament before it becomes official.',
                      'لمراجعة التفاصيل قبل الاحتفال فقط. هذا ليس قيداً رسمياً أو شهادة. يجب أن يعتمد الكاهن السر المحتفل به ليصبح رسمياً.'
                    )}
                  </p>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel title={s.kind === 'certificate' ? L('Certificate', 'الشهادة') : L('Register entry', 'قيد السجل')}>
              <div className="docempty">
                <Icon name="doc" size={22} />
                <p>
                  {s.kind === 'certificate' && ['cancelled', 'rejected'].includes(s.status)
                    ? L('This request was closed, so no certificate was made.', 'أُغلق هذا الطلب، فلم تُنشأ شهادة.')
                    : s.kind === 'certificate'
                      ? s.requestedSacramentId
                        ? L(
                            'This certificate is for a sacrament that has not been celebrated and approved yet. It links itself as soon as the priest approves that entry; the certificate can then be previewed here.',
                            'هذه الشهادة لسرّ لم يُحتفل به ولم يُعتمد بعد. ترتبط به تلقائياً حين يعتمد الكاهن قيده، ثم يمكن معاينتها هنا.'
                          )
                        : eligibleSources(s.person).length
                          ? L(
                              'Link the approved entry this certificate is taken from; it can then be previewed here and the priest can approve it.',
                              'اربط القيد المعتمد الذي تؤخذ منه هذه الشهادة؛ ثم يمكن معاينتها هنا ويعتمدها الكاهن.'
                            )
                          : L(
                              'There is no approved entry for this person yet. Record the sacrament and have it approved first; the certificate is then linked to it and can be previewed here.',
                              'لا قيد معتمداً لهذا الشخص بعد. سجّل السرّ واعتمده أولاً، ثم تُربط الشهادة به ويمكن معاينتها هنا.'
                            )
                      : ['cancelled', 'rejected'].includes(s.status)
                        ? L('This request was closed, so there is no register entry.', 'أُغلق هذا الطلب، فلا قيد له.')
                        : L(
                            'The register entry can be previewed once the sacrament is celebrated and approved by the priest.',
                            'يمكن معاينة القيد بعد الاحتفال بالسرّ واعتماد الكاهن له.'
                          )}
                </p>
              </div>
            </Panel>
          )}{' '}
          {details} <RequestDocuments record={s} scope="sacrament-request" onChange={() => bus.refresh()} />
        </div>{' '}
        <aside className="sidecol">{activity}</aside>
      </div>
    </>
  );
}

certificate.mount = (host, id, lang = '') => {
  const doc = SACRAMENTS.find(x => x.id === id);
  lang = docLang(doc, lang);
  host.querySelectorAll('[data-docview]').forEach(b => b.addEventListener('click', () => viewDoc(doc, lang)));
  host.querySelector('[data-docdl]')?.addEventListener('click', e => downloadMenu(e.currentTarget, doc, () => lang));
  host.querySelector('[data-docprint]')?.addEventListener('click', () => printDoc(doc, lang));
  host.querySelector('#amendrequest')?.addEventListener('click', () =>
    openDrawer({
      title: L('Propose a request amendment', 'اقتراح تعديل الطلب'),
      sub: L(
        'The accepted request stays unchanged until a priest approves this amendment. The reason and decision remain in its history.',
        'يبقى الطلب المقبول بلا تغيير حتى يعتمد الكاهن التعديل. يبقى السبب والقرار في السجل.'
      ),
      body: (
        <>
          {
            <C.Field
              label={L('Requested date', 'التاريخ المطلوب')}
              id="amend_date"
              type="date"
              value={doc.requestedDate || ''}
            />
          }{' '}
          {
            <C.Textarea
              label={L('Family request / notes', 'طلب العائلة / ملاحظات')}
              id="amend_notes"
              value={doc.requestNotes || ''}
              max={500}
            />
          }{' '}
          {<C.Textarea label={L('Reason for amendment', 'سبب التعديل')} id="amend_reason" max={500} />}
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="amend_save">
            {L('Send for priest decision', 'إرسال لقرار الكاهن')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#amend_save').addEventListener('click', async () => {
          if (!need(el, '#amend_reason', L('Enter a reason', 'أدخل السبب'))) return;
          try {
            await serverWorkflow('propose-request-amendment', id, {
              date: el.querySelector('#amend_date').value,
              notes: el.querySelector('#amend_notes').value.trim(),
              reason: el.querySelector('#amend_reason').value.trim()
            });
            closeOverlays();
            bus.refresh();
            toast(L('Amendment proposed', 'اقتُرح التعديل'), '', 'success');
          } catch (e) {
            toast(L('Could not propose amendment', 'تعذّر اقتراح التعديل'), e.message, 'danger');
          }
        });
      }
    })
  );
  host.querySelector('#approveamend')?.addEventListener('click', async () => {
    try {
      await serverWorkflow('approve-request-amendment', id);
      bus.refresh();
      toast(L('Amendment approved', 'اعتُمد التعديل'), '', 'success');
    } catch (e) {
      toast(L('Could not approve amendment', 'تعذّر اعتماد التعديل'), e.message, 'danger');
    }
  });
  host.querySelector('#rejectamend')?.addEventListener('click', () =>
    openModal({
      title: L('Reject request amendment?', 'رفض تعديل الطلب؟'),
      body: <C.Textarea label={L('Reason (optional)', 'السبب (اختياري)')} id="amend_reject_reason" max={500} />,
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Keep pending', 'إبقاء معلقاً')}
          </button>
          <button className="btn btn-primary" id="amend_reject_confirm">
            {L('Reject amendment', 'رفض التعديل')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#amend_reject_confirm').addEventListener('click', async () => {
          try {
            await serverWorkflow('reject-request-amendment', id, {
              reason: el.querySelector('#amend_reject_reason').value.trim()
            });
            closeOverlays();
            bus.refresh();
          } catch (e) {
            toast(L('Could not reject amendment', 'تعذّر رفض التعديل'), e.message, 'danger');
          }
        });
      }
    })
  );
  host.querySelector('#officereview')?.addEventListener('click', async () => {
    try {
      await serverWorkflow('review-sacrament-request', id);
      bus.refresh();
      toast(
        L('Office review completed', 'اكتملت مراجعة المكتب'),
        L('The priest can now decide.', 'يمكن للكاهن اتخاذ القرار الآن.'),
        'success'
      );
    } catch (e) {
      toast(L('Review could not be saved', 'تعذّر حفظ المراجعة'), e.message, 'danger');
    }
  });
  host.querySelector('#acceptrequest')?.addEventListener('click', () =>
    openModal({
      title: L('Accept this sacrament request?', 'قبول طلب السرّ؟'),
      sub: L(
        'The request will move to Preparation. The priest may accept it without a secretary review.',
        'سينتقل الطلب إلى التحضير. يمكن للكاهن قبوله من دون مراجعة الأمينة.'
      ),
      body: (
        <>
          <p>{L('Confirm the person and sacrament before accepting.', 'تأكّد من الشخص والسرّ قبل القبول.')}</p>
          {doc?.memberRequestId ? (
            <p className="or-shared">
              <Icon name="info" size={15} />
              <span>
                {L(
                  'The parishioner sent this request online and will be notified.',
                  'أرسل المؤمن هذا الطلب إلكترونياً وسيُبلَّغ بالقرار.'
                )}
              </span>
            </p>
          ) : (
            ''
          )}
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Back', 'رجوع')}
          </button>
          <button className="btn btn-primary" id="accept_confirm">
            {L('Accept request', 'قبول الطلب')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#accept_confirm').addEventListener('click', async () => {
          try {
            await serverWorkflow('approve-sacrament-request', id);
            closeOverlays();
            bus.refresh();
            toast(L('Request accepted', 'قُبل الطلب'), L('Preparation can begin.', 'يمكن بدء التحضير.'), 'success');
          } catch (e) {
            toast(L('Could not accept request', 'تعذّر قبول الطلب'), e.message, 'danger');
          }
        });
      }
    })
  );
  host.querySelector('#declinerequest')?.addEventListener('click', () =>
    openModal({
      title: L('Decline this sacrament request?', 'رفض طلب السرّ؟'),
      sub: L('The declined request stays in the completed history.', 'يبقى الطلب المرفوض في سجل الطلبات المكتملة.'),
      body: (
        <>
          <C.Textarea label={L('Reason', 'السبب')} id="decline_reason" max={500} />
          {sharedNote(doc)}
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Back', 'رجوع')}
          </button>
          <button className="btn btn-primary" id="decline_confirm">
            {L('Decline request', 'رفض الطلب')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#decline_confirm').addEventListener('click', async () => {
          if (!need(el, '#decline_reason', L('Enter a reason', 'أدخل السبب'))) return;
          try {
            await serverWorkflow('decline-sacrament-request', id, {
              reason: el.querySelector('#decline_reason').value.trim()
            });
            closeOverlays();
            bus.refresh();
          } catch (e) {
            toast(L('Could not decline request', 'تعذّر رفض الطلب'), e.message, 'danger');
          }
        });
      }
    })
  );
  host.querySelector('#startcertreq')?.addEventListener('click', () => {
    S.ui.newCertificateSource = id;
    location.hash = '#/requests';
  });
  host.querySelector('#editentry')?.addEventListener('click', () => {
    const record = SACRAMENTS.find(s => s.id === id);
    if (!record || !['draft', 'scheduled'].includes(record.status)) return;
    openDrawer({
      title: L('Edit sacrament details', 'تعديل تفاصيل السرّ'),
      sub: L(
        'Changes are kept in the record’s history. Once the priest approves the entry it can no longer be edited here.',
        'تُحفظ التعديلات في سجل القيد. بعد أن يعتمد الكاهن القيد لا يمكن تعديله من هنا.'
      ),
      body: (
        <>
          <div className="formgrid">
            <C.Field
              label={L('Celebration date', 'تاريخ الاحتفال')}
              id="edit_date"
              type="date"
              value={record.date}
              req={true}
            />
            {timeSelect('edit_time', record.time || '')}
          </div>
          <div className="formgrid">
            <div className="formrow">
              <label className="label" htmlFor="edit_celebrant">
                {L('Celebrant', 'المحتفل')}
              </label>
              <Select defaultValue={record.celebrant} id="edit_celebrant">
                <option value="">{L('To be assigned', 'يُحدّد لاحقاً')}</option>
                {PEOPLE.filter(p => p.status === 'clergy' || p.id === record.celebrant).map((p, i) => (
                  <option key={i} value={p.id}>
                    {isAr() ? p.ar : p.lat}
                  </option>
                ))}
              </Select>
            </div>
          </div>{' '}
          <div className="formgrid">
            <C.Field label={L('Book', 'الدفتر')} id="edit_book" value={record.book || ''} />
            <C.Field label={L('Page', 'الصفحة')} id="edit_page" value={record.page || ''} />
          </div>{' '}
          <C.Field
            label={L('Godparents / witnesses', 'الإشبين / الشهود')}
            id="edit_godparents"
            value={record.godparents || ''}
          />{' '}
          <div className="formgrid">
            <C.Field label={L('Father', 'الأب')} id="edit_father" value={record.father || ''} />
            <C.Field label={L('Mother', 'الأم')} id="edit_mother" value={record.mother || ''} />
          </div>{' '}
          <C.Field label={L('Place', 'المكان')} id="edit_place" value={record.place || ''} />{' '}
          <div className="formgrid">
            <C.Field
              label={L('External parish', 'الرعية الخارجية')}
              id="edit_externalParish"
              value={record.externalParish || ''}
            />
            <C.Field
              label={L('External reference', 'المرجع الخارجي')}
              id="edit_externalReference"
              value={record.externalReference || ''}
            />
          </div>
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="edit_save">
            {L('Save changes', 'حفظ التعديلات')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#edit_save').addEventListener('click', async () => {
          if (!need(el, '#edit_date', L('Enter a date', 'أدخل التاريخ'))) return;
          const fields = Object.fromEntries(
            [
              'date',
              'time',
              'celebrant',
              'book',
              'page',
              'godparents',
              'father',
              'mother',
              'place',
              'externalParish',
              'externalReference'
            ].map(k => [k, el.querySelector('#edit_' + k).value.trim()])
          );
          try {
            await serverWorkflow('update-entry', id, { fields });
            closeOverlays();
            bus.refresh();
            toast(
              L('Details updated', 'حُدّثت التفاصيل'),
              L('The workflow and activity history were updated.', 'حُدّث المسار وسجل النشاط.'),
              'success'
            );
          } catch (e) {
            toast(L('Could not update entry', 'تعذّر تعديل القيد'), e.message, 'danger');
          }
        });
      }
    });
  });
  host.querySelector('#linksource')?.addEventListener('click', () => {
    const request = SACRAMENTS.find(s => s.id === id);
    const sources = SACRAMENTS.filter(
      s => s.person === request?.person && s.kind !== 'certificate' && ['registered', 'issued'].includes(s.status)
    );
    openDrawer({
      title: L('Link the register entry', 'ربط القيد'),
      sub: L(
        'Choose the approved entry this certificate is taken from. The link is kept in the request’s history.',
        'اختر القيد المعتمد الذي تؤخذ منه هذه الشهادة. يُحفظ الربط في سجل الطلب.'
      ),
      body: sources.length ? (
        <div className="formrow">
          <label className="label" htmlFor="link_source">
            {L('Approved entry', 'القيد المعتمد')}
          </label>
          <Select id="link_source">
            {sources.map((s, i) => (
              <option key={i} value={s.id}>
                {s.reg} · {kindLabel(s.kind)}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <C.InlineAlert
          tone="warning"
          title={L('No eligible register entry', 'لا قيد مؤهّل')}
          body={L(
            'Register and approve the sacrament before linking this request.',
            'سجّل السرّ واعتمده قبل ربط هذا الطلب.'
          )}
        />
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="link_save" disabled={!sources.length}>
            {L('Link entry', 'ربط القيد')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#link_save')?.addEventListener('click', async () => {
          try {
            await serverWorkflow('link-source', id, { sourceRecordId: el.querySelector('#link_source').value });
            closeOverlays();
            bus.refresh();
            toast(
              L('Entry linked', 'رُبط القيد'),
              L(
                'The certificate can now be previewed and sent to the priest.',
                'يمكن الآن معاينة الشهادة وإرسالها إلى الكاهن.'
              ),
              'success'
            );
          } catch (e) {
            toast(L('Could not link source', 'تعذّر ربط المصدر'), e.message, 'danger');
          }
        });
      }
    });
  });
  const confirm = (button, action) =>
    button?.addEventListener('click', () =>
      openModal({
        title:
          action === 'approve'
            ? SACRAMENTS.find(s => s.id === id)?.kind === 'certificate'
              ? L('Approve this certificate request?', 'اعتماد طلب الشهادة؟')
              : L('Approve this register entry?', 'اعتماد هذا القيد؟')
            : L('Sign and issue this certificate?', 'توقيع هذه الشهادة وإصدارها؟'),
        sub: L(
          'This action is recorded with your account and the time. Check the original register before confirming.',
          'يُسجّل هذا الإجراء باسم حسابك ووقته. راجع السجل الأصلي قبل التأكيد.'
        ),
        body: (
          <>
            {action === 'issue'
              ? '<div class="sig-issue" data-sig-issue><p class="help">' +
                L('Loading your signature…', 'جارٍ تحميل توقيعك…') +
                '</p></div>'
              : ''}
            <label className="check">
              <input type="checkbox" id="ack" />{' '}
              <span>
                {L('I have checked the register entry against the bound book.', 'راجعتُ القيد مقابل الدفتر الأصلي.')}
              </span>
            </label>
          </>
        ),
        foot: (
          <>
            <button className="btn btn-secondary" data-close="">
              {L('Cancel', 'إلغاء')}
            </button>{' '}
            <button className="btn btn-primary" id="confirm" disabled>
              {action === 'approve'
                ? SACRAMENTS.find(s => s.id === id)?.kind === 'certificate'
                  ? L('Approve request', 'اعتماد الطلب')
                  : L('Approve entry', 'اعتماد القيد')
                : L('Sign and issue', 'التوقيع والإصدار')}
            </button>
          </>
        ),
        onMount(el) {
          const ack = el.querySelector('#ack'),
            ok = el.querySelector('#confirm');
          let ready = action !== 'issue';
          ack.addEventListener('change', () => {
            ok.disabled = !ack.checked || !ready;
          });
          /* Issuing is signing: the priest's own signature, unlocked with their passkey over this certificate. */
          if (action === 'issue')
            api('account/signature')
              .then(data => {
                const box = el.querySelector('[data-sig-issue]');
                if (!box) return;
                ready = !!data.signer;
                paint(
                  box,
                  data.signer ? (
                    <>
                      <figure className="sig-card is-small">
                        <Drawing path={data.signer.drawing} />
                        <figcaption>
                          <b>{session.user.name}</b>
                          {data.signer.title ? <span>{data.signer.title}</span> : ''}
                        </figcaption>
                      </figure>{' '}
                      <p className="help">
                        <Icon name="lock" size={15} />
                        {L(
                          'You will be asked for your face, fingerprint or PIN. The certificate then carries your signature and a code anyone can check.',
                          'سيُطلب وجهك أو بصمتك أو رمزك. ثم تحمل الشهادة توقيعك ورمزاً يمكن لأي شخص التحقّق منه.'
                        )}
                      </p>
                    </>
                  ) : (
                    <C.InlineAlert
                      tone="warning"
                      title={L('Set up your signature first', 'أعدّ توقيعك أولاً')}
                      body={
                        <>
                          {L(
                            'Certificates are signed with your own signature, kept with your passkey. Set it up under My account, then come back.',
                            'تُوقَّع الشهادات بتوقيعك الخاص المحفوظ مع مفتاح المرور. أعدّه في «حسابي» ثم عُد.'
                          )}
                          <a href="#/account">{L('Open My account', 'فتح حسابي')}</a>
                        </>
                      }
                    />
                  )
                );
                ok.disabled = !ack.checked || !ready;
              })
              .catch(() => {});
          ok.addEventListener('click', async () => {
            try {
              const signature =
                action === 'issue' ? await sign({ type: 'certificate', parish: session.parishId, id }) : null;
              await serverWorkflow(action, id, { verified: true, ...(signature ? { signature } : {}) });
              closeOverlays();
              bus.refresh();
              const cert = SACRAMENTS.find(s => s.id === id)?.kind === 'certificate';
              toast(
                action === 'issue'
                  ? L('Certificate issued', 'صدرت الشهادة')
                  : cert
                    ? L('Request approved', 'اعتُمد الطلب')
                    : L('Entry approved', 'اعتُمد القيد'),
                action === 'issue'
                  ? L(
                      'It is signed and has been sent for bishop acceptance before release.',
                      'تم توقيعها وإرسالها لقبول المطران قبل تسليمها.'
                    )
                  : cert
                    ? L('Next: sign and issue the certificate.', 'التالي: توقيع الشهادة وإصدارها.')
                    : L('It now has its official register number.', 'صار له رقم القيد الرسمي.'),
                'success'
              );
            } catch (e) {
              toast(
                L('Action could not be completed', 'تعذّر إتمام الإجراء'),
                action === 'issue' ? passkeyMessage(e, L) : e.message,
                'danger'
              );
            }
          });
        }
      })
    );
  host.querySelector('#resubmit-bishop')?.addEventListener('click', () =>
    openDrawer({
      title: L('Resubmit to the bishop', 'إعادة تقديم للمطران'),
      body: (
        <form>
          <label className="formrow">
            <span className="label">{L('How was the bishop’s note addressed?', 'كيف تمت معالجة ملاحظة المطران؟')}</span>
            <textarea className="textarea" name="note" required minLength="3" maxLength="1000" />
          </label>
          <label className="check">
            <input type="checkbox" required name="verified" />
            {L('I reviewed the certificate and its source register entry.', 'راجعت الشهادة وقيدها الأصلي.')}
          </label>
          <p role="alert" className="help-error" />
          <button className="btn btn-primary">{L('Resubmit', 'إعادة تقديم')}</button>
        </form>
      ),
      onMount(el) {
        const f = el.querySelector('form');
        f.onsubmit = async e => {
          e.preventDefault();
          const b = f.querySelector('button');
          b.disabled = true;
          try {
            await api('workspace/certificate-resubmit', 'POST', {
              parish: session.parishId,
              id,
              revision: session.revision,
              note: f.elements.note.value,
              verified: f.elements.verified.checked
            });
            await hydrate();
            closeOverlays();
            bus.refresh();
          } catch (err) {
            f.querySelector('[role=alert]').textContent = err.message;
            b.disabled = false;
          }
        };
      }
    })
  );
  confirm(host.querySelector('#approve'), 'approve');
  confirm(host.querySelector('#sign'), 'issue');
  const decision = (selector, action) =>
    host.querySelector(selector)?.addEventListener('click', () =>
      openModal({
        title:
          action === 'reject'
            ? L('Reject this request or entry?', 'رفض هذا الطلب أو القيد؟')
            : L('Cancel this certificate request?', 'إلغاء طلب الشهادة؟'),
        sub: L('The decision and reason will remain in the activity history.', 'سيبقى القرار وسببه في سجل النشاط.'),
        body: (
          <>
            <C.Textarea label={L('Reason', 'السبب')} id="decision_reason" max={500} />
            {sharedNote(doc)}
          </>
        ),
        foot: (
          <>
            <button className="btn btn-secondary" data-close="">
              {L('Keep open', 'إبقاؤه مفتوحاً')}
            </button>
            <button className="btn btn-primary" id="decision_confirm">
              {action === 'reject' ? L('Reject', 'رفض') : L('Cancel request', 'إلغاء الطلب')}
            </button>
          </>
        ),
        onMount(el) {
          el.querySelector('#decision_confirm').addEventListener('click', async () => {
            if (!need(el, '#decision_reason', L('Enter a reason', 'أدخل السبب'))) return;
            try {
              await serverWorkflow(action, id, {
                verified: action === 'reject',
                reason: el.querySelector('#decision_reason').value.trim()
              });
              closeOverlays();
              bus.refresh();
              toast(
                L('Decision saved', 'حُفظ القرار'),
                L('The activity history was updated.', 'حُدّث سجل النشاط.'),
                'success'
              );
            } catch (e) {
              toast(L('Decision could not be saved', 'تعذّر حفظ القرار'), e.message, 'danger');
            }
          });
        }
      })
    );
  decision('#reject', 'reject');
  decision('#cancelrequest', 'cancel');
  host.querySelector('#submit')?.addEventListener('click', async () => {
    try {
      await serverWorkflow('submit', id);
      bus.refresh();
    } catch (e) {
      toast(L('Could not submit entry', 'تعذّر إرسال القيد'), e.message, 'danger');
    }
  });
};
