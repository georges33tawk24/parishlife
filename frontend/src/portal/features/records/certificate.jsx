/* One sacrament record or certificate request: its progress, next step, celebration, history,
   documents and signatures. */
import { Fragment } from 'react';
import { Select } from '../../ui/components.jsx';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { is, bus, S } from '../../model/store.js';
import { session } from '../../model/api.js';
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
import { need, needAll } from '../../shared/dialogs.jsx';
import * as API from '../../model/modules/sacraments.js';
import { SACRAMENTS, person } from '../../model/data.js';
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
  timeSelect,
  today,
  zoned
} from './records-shared.jsx';
import { certificateSVG, docCard, downloadMenu, printDoc, viewDoc } from './certificate-document.jsx';

const L = (en, ar) => t(en, ar);

const sacramentStatus = s =>
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
const stepAt = (s, ...actions) => [...(s.history || [])].reverse().find(h => actions.includes(h.action))?.at || '';

const workflowStages = s =>
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
  'documents updated': ['Documents updated', 'حُدّثت المستندات']
};

const histReason = h => h.reason;

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
  const isCertificate = s.kind === 'certificate',
    api = s.apiStatus;
  const source = s.kind === 'certificate' ? SACRAMENTS.find(x => x.id === s.sourceRecordId) : s;
  // a prepared certificate shows its own frozen snapshot, not the register entry as it is now
  const record = (s.kind === 'certificate' ? API.docRecord(s) : s) || s;
  const p = person(s.person) || { lat: '', ar: '' };
  const asRequest = s.kind === 'certificate' || ['requested', 'rejected', 'cancelled'].includes(s.status);
  const hasDoc = s.kind === 'certificate' ? !!API.docRecord(s) : official(s);
  const proposed =
    s.kind !== 'certificate' &&
    !hasDoc &&
    !!s.date &&
    ['preparing', 'scheduled', 'draft', 'awaiting-signature'].includes(s.status);
  const purpose = s.kind === 'certificate' ? s.purpose || s.godparents : '';
  const planned = null;
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
            ) : (
              <>
                {kindLabel(s.certificateOf)}{' '}
                <small className="dim">· {L('not linked to an entry yet', 'لم تُربط بقيد بعد')}</small>
              </>
            )
          ],
          purpose ? [L('Purpose', 'الغاية'), purpose] : null,
          s.language ? [L('Language of the wording', 'لغة النص'), languageName(s.language)] : null,
          [L('Copies', 'عدد النسخ'), s.quantity],
          s.replacesId
            ? [
                L('Replaces', 'تحلّ محل'),
                <a className="mono" dir="ltr" href={`#/certificate/${s.replacesId}`}>
                  {SACRAMENTS.find(x => x.id === s.replacesId)?.reg || s.replacesId}
                </a>
              ]
            : null,
          s.authorizationCode
            ? [
                L('Verification code', 'رمز التحقق'),
                <span className="mono" dir="ltr">
                  {s.authorizationCode}
                </span>
              ]
            : null,
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
          [L('Celebrant', 'المحتفل'), record.celebrantName || L('To be assigned', 'يُحدَّد لاحقاً')],
          record.godparents ? [L('Godparents / witnesses', 'الإشبين / الشهود'), record.godparents] : null,
          [L('Book / page', 'الدفتر / الصفحة'), record.book || '—'],
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
      {(s.amendments || []).length ? (
        <div style={{ marginTop: '14px' }}>
          <b className="t-caption">{L('Official corrections', 'التصحيحات الرسمية')}</b>
          {s.amendments.map((a, i) => (
            <p key={i} className="t-caption dim">
              {a.field}: {a.from || '—'} → {a.to} · {a.reason}
            </p>
          ))}
        </div>
      ) : (
        ''
      )}{' '}
      {(s.pendingCorrections || []).map((c, i) => (
        <div key={i} className="alert alert-warning" style={{ marginTop: '14px' }}>
          <b>{L('Correction awaiting the priest', 'تصحيح بانتظار الكاهن')}</b>
          <br />
          {c.field} → {c.to}
          <br />
          {c.reason} · {c.evidence}
          {is('priest') ? (
            <span className="row" style={{ gap: '6px', marginTop: '8px' }}>
              <button className="btn btn-primary btn-dense" data-corr-approve={c.id}>
                {L('Approve correction', 'اعتماد التصحيح')}
              </button>
              <button className="btn btn-secondary btn-dense" data-corr-reject={c.id}>
                {L('Reject', 'رفض')}
              </button>
            </span>
          ) : (
            ''
          )}
        </div>
      ))}
    </Panel>
  );
  // the API names the account that acted by id only, so what is shown is what happened and when
  const people = (
    s.kind === 'certificate'
      ? [
          [L('Approved by the priest', 'اعتمده الكاهن'), '', s.signedAt],
          [L('Accepted by the bishop', 'قبله المطران'), '', s.acceptedAt],
          [L('Issued', 'صدرت'), '', s.issuedAt],
          [
            L('Handed over to', 'سُلّمت إلى'),
            [s.recipientName, s.recipientRelationship].filter(Boolean).join(' · '),
            s.releasedAt
          ]
        ]
      : [
          [L('Request accepted', 'قُبل الطلب'), '', s.requestApprovedAt],
          [L('Registered', 'سُجّل'), '', s.registeredAt]
        ]
  ).filter(([, , at]) => at);
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
            {isCertificate ? (
              <>
                {api === 'WaitingForSource' && is('priest', 'secretary') ? (
                  eligibleSources(s.person).length ? (
                    <button className="btn btn-primary" id="linksource">
                      <Icon name="link" size={17} />
                      {L('Link register entry', 'ربط القيد')}
                    </button>
                  ) : (
                    <a className="btn btn-secondary" href={`#/person/${s.person}/sacraments`}>
                      <Icon name="sacr" size={17} />
                      {L('See this person’s sacraments', 'عرض أسرار هذا الشخص')}
                    </a>
                  )
                ) : (
                  ''
                )}
                {['Received', 'Prepared', 'Returned'].includes(api) && is('secretary', 'priest') ? (
                  <button className="btn btn-primary" id="submit">
                    <Icon name="check" size={17} />
                    {api === 'Prepared'
                      ? L('Send to the priest', 'إرسال إلى الكاهن')
                      : L('Prepare and send to the priest', 'تحضير وإرسال إلى الكاهن')}
                  </button>
                ) : (
                  ''
                )}
                {api === 'AwaitingSignature' && is('priest') ? (
                  <button className="btn btn-primary" id="approve">
                    <Icon name="check" size={17} />
                    {L('Approve request', 'اعتماد الطلب')}
                  </button>
                ) : (
                  ''
                )}
                {api === 'AwaitingBishop' && is('bishop') ? (
                  <button className="btn btn-primary" id="bishopaccept">
                    <Icon name="check" size={17} />
                    {L('Accept as bishop', 'القبول كمطران')}
                  </button>
                ) : (
                  ''
                )}
                {['AwaitingSignature', 'AuthorizedForIssuance'].includes(api) && is('priest') ? (
                  <button className="btn btn-secondary" id="reject">
                    {L('Return', 'إعادة')}
                  </button>
                ) : api === 'AwaitingBishop' && is('bishop') ? (
                  <button className="btn btn-secondary" id="reject">
                    {L('Return to the priest', 'إعادة إلى الكاهن')}
                  </button>
                ) : (
                  ''
                )}
                {['AwaitingBishop', 'AuthorizedForIssuance', 'Issued'].includes(api) &&
                !s.authorizationCode &&
                s.signedBy &&
                s.signedBy === session.accountUser?.id ? (
                  <button className="btn btn-secondary" id="authorize">
                    <Icon name="lock" size={17} />
                    {L('Authorize electronically', 'التفويض إلكترونياً')}
                  </button>
                ) : (
                  ''
                )}
                {api === 'AuthorizedForIssuance' && is('priest', 'secretary') ? (
                  <button className="btn btn-primary" id="sign">
                    <Icon name="check" size={17} />
                    {L('Issue the certificate', 'إصدار الشهادة')}
                  </button>
                ) : (
                  ''
                )}
                {api === 'Issued' && is('priest', 'secretary') ? (
                  <button className="btn btn-primary" id="release">
                    <Icon name="check" size={17} />
                    {L('Record the handover', 'تسجيل التسليم')}
                  </button>
                ) : (
                  ''
                )}
                {['Issued', 'Released'].includes(api) && is('priest', 'secretary') ? (
                  <button className="btn btn-ghost" id="withdraw">
                    {L('Withdraw', 'سحب')}
                  </button>
                ) : (
                  ''
                )}
                {['WaitingForSource', 'Received', 'Prepared', 'Returned', 'AwaitingSignature'].includes(api) &&
                is('secretary', 'priest') ? (
                  <button className="btn btn-ghost" id="cancelrequest">
                    {L('Cancel request', 'إلغاء الطلب')}
                  </button>
                ) : (
                  ''
                )}
              </>
            ) : (
              <>
                {s.status === 'requested' && is('priest') ? (
                  <>
                    <button className="btn btn-primary" id="acceptrequest">
                      <Icon name="check" size={17} />
                      {L('Accept request', 'قبول الطلب')}
                    </button>
                    <button className="btn btn-secondary" id="declinerequest">
                      {L('Decline', 'رفض')}
                    </button>
                  </>
                ) : s.status === 'preparing' ? (
                  <a className="btn btn-primary" href="#/sacraments">
                    {L('Continue preparation', 'متابعة التحضير')}
                  </a>
                ) : s.status === 'scheduled' && s.date <= today() && is('secretary', 'priest') ? (
                  <button className="btn btn-primary" id="submit">
                    <Icon name="check" size={17} />
                    {L('Record the celebration and send for approval', 'تسجيل الاحتفال وإرساله للاعتماد')}
                  </button>
                ) : s.status === 'awaiting-signature' && is('priest') ? (
                  <>
                    <button className="btn btn-primary" id="approve">
                      <Icon name="check" size={17} />
                      {L('Register entry', 'تسجيل القيد')}
                    </button>
                    <button className="btn btn-secondary" id="reject">
                      {L('Return to the office', 'إعادة إلى المكتب')}
                    </button>
                  </>
                ) : s.status === 'registered' ? (
                  <>
                    <button className="btn btn-secondary" id="startcertreq">
                      <Icon name="doc" size={17} />
                      {L('Request a certificate', 'طلب شهادة')}
                    </button>
                    {is('secretary', 'priest') ? (
                      <button className="btn btn-ghost" id="proposecorrection">
                        {L('Propose a correction', 'اقتراح تصحيح')}
                      </button>
                    ) : (
                      ''
                    )}
                  </>
                ) : (
                  ''
                )}
                {['scheduled', 'draft', 'awaiting-signature'].includes(s.status) && is('secretary', 'priest') ? (
                  <button className="btn btn-secondary" id="editentry">
                    <Icon name="edit" size={17} />
                    {L('Edit details', 'تعديل التفاصيل')}
                  </button>
                ) : (
                  ''
                )}
              </>
            )}
          </>
        }
      />{' '}
      {api === 'Returned' ? (
        <div className="alert alert-warning">
          <b>{L('Returned for another look', 'أُعيدت للمراجعة')}</b>
          <p>{s.returnReason}</p>
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
  const isCertificate = doc?.kind === 'certificate';
  host.querySelectorAll('[data-docview]').forEach(b => b.addEventListener('click', () => viewDoc(doc, lang)));
  host.querySelector('[data-docdl]')?.addEventListener('click', e => downloadMenu(e.currentTarget, doc, () => lang));
  host.querySelector('[data-docprint]')?.addEventListener('click', () => printDoc(doc, lang));

  /* Every step is one call to the API (model/modules/sacraments.js), which then reloads the lists. */
  const run = async (step, done, failed, close = true) => {
    try {
      await step();
      if (close) closeOverlays();
      bus.refresh();
      if (done) toast(done[0], done[1] || '', 'success');
      return true;
    } catch (e) {
      toast(failed, e.message, 'danger');
      return false;
    }
  };
  /* A reason is asked for, then the step runs. */
  const withReason = (selector, { title, sub, confirm, keep, failed, done, optional = false, step }) =>
    host.querySelector(selector)?.addEventListener('click', () =>
      openModal({
        title,
        sub,
        body: (
          <>
            <C.Textarea label={L('Reason', 'السبب')} id="decision_reason" max={500} />
            {sharedNote(doc)}
          </>
        ),
        foot: (
          <>
            <button className="btn btn-secondary" data-close="">
              {keep}
            </button>
            <button className="btn btn-primary" id="decision_confirm">
              {confirm}
            </button>
          </>
        ),
        onMount(el) {
          el.querySelector('#decision_confirm').addEventListener('click', async () => {
            if (!optional && !need(el, '#decision_reason', L('Enter a reason', 'أدخل السبب'))) return;
            await run(() => step(el.querySelector('#decision_reason').value.trim()), done, failed);
          });
        }
      })
    );

  host.querySelector('#acceptrequest')?.addEventListener('click', () =>
    openModal({
      title: L('Accept this sacrament request?', 'قبول طلب السرّ؟'),
      sub: L('The request will move to Preparation.', 'سينتقل الطلب إلى التحضير.'),
      body: <p>{L('Confirm the person and sacrament before accepting.', 'تأكّد من الشخص والسرّ قبل القبول.')}</p>,
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
        el.querySelector('#accept_confirm').addEventListener('click', () =>
          run(
            () => API.sacramentAction(id, 'accept'),
            [L('Request accepted', 'قُبل الطلب'), L('Preparation can begin.', 'يمكن بدء التحضير.')],
            L('Could not accept request', 'تعذّر قبول الطلب')
          )
        );
      }
    })
  );
  withReason('#declinerequest', {
    title: L('Decline this sacrament request?', 'رفض طلب السرّ؟'),
    sub: L('The reason is shown to the applicant.', 'يظهر السبب لصاحب الطلب.'),
    confirm: L('Decline request', 'رفض الطلب'),
    keep: L('Back', 'رجوع'),
    failed: L('Could not decline request', 'تعذّر رفض الطلب'),
    step: reason => API.sacramentAction(id, 'decline', { reason })
  });
  host.querySelector('#startcertreq')?.addEventListener('click', () => {
    S.ui.newCertificateSource = id;
    location.hash = '#/requests';
  });

  /* The case's own details (father, mother, place, witnesses and so on). Date, celebrant and book are set where the API sets them: scheduling and registering. */
  host.querySelector('#editentry')?.addEventListener('click', () => {
    const record = SACRAMENTS.find(s => s.id === id);
    if (!record || !['scheduled', 'draft', 'awaiting-signature'].includes(record.status)) return;
    openDrawer({
      title: L('Edit sacrament details', 'تعديل تفاصيل السرّ'),
      sub: L(
        'Changes are kept in the record’s history. Once the entry is registered it can only be corrected by a priest-approved correction.',
        'تُحفظ التعديلات في سجل القيد. بعد تسجيل القيد لا يُصحَّح إلا بتصحيح يعتمده الكاهن.'
      ),
      body: (
        <>
          <C.Field label={L('Place', 'المكان')} id="edit_place" value={record.place || ''} />{' '}
          <C.Field
            label={L('Godparents / witnesses', 'الإشبين / الشهود')}
            id="edit_godparents"
            value={record.godparents || ''}
          />{' '}
          <div className="formgrid">
            <C.Field label={L('Father', 'الأب')} id="edit_father" value={record.father || ''} />
            <C.Field label={L('Mother', 'الأم')} id="edit_mother" value={record.mother || ''} />
          </div>{' '}
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
        const value = k => el.querySelector('#edit_' + k).value.trim();
        el.querySelector('#edit_save').addEventListener('click', () =>
          run(
            () =>
              API.sacramentAction(id, 'amend-facts', {
                facts: API.mergedFacts(record, {
                  father: value('father'),
                  mother: value('mother'),
                  externalParish: value('externalParish'),
                  externalReference: value('externalReference')
                }),
                place: value('place'),
                witnesses: value('godparents')
              }),
            [L('Details updated', 'حُدّثت التفاصيل'), L('The history was updated.', 'حُدّث السجل.')],
            L('Could not update entry', 'تعذّر تعديل القيد')
          )
        );
      }
    });
  });

  host.querySelector('#linksource')?.addEventListener('click', () => {
    const request = SACRAMENTS.find(s => s.id === id);
    const sources = SACRAMENTS.filter(
      s => s.person === request?.person && s.kind === request?.certificateOf && official(s)
    );
    openDrawer({
      title: L('Link the register entry', 'ربط القيد'),
      sub: L(
        'Choose the registered entry this certificate is taken from. It must be this person’s entry for the same sacrament.',
        'اختر القيد المسجَّل الذي تؤخذ منه الشهادة. يجب أن يكون قيد هذا الشخص للسرّ نفسه.'
      ),
      body: sources.length ? (
        <div className="formrow">
          <label className="label" htmlFor="link_source">
            {L('Registered entry', 'القيد المسجَّل')}
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
            'Register the sacrament for this person before linking this request.',
            'سجّل السرّ لهذا الشخص قبل ربط هذا الطلب.'
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
        el.querySelector('#link_save')?.addEventListener('click', () =>
          run(
            () => API.certificateAction(id, 'link-source', { sourceRecordId: el.querySelector('#link_source').value }),
            [
              L('Entry linked', 'رُبط القيد'),
              L('Prepare the certificate and send it to the priest.', 'حضّر الشهادة وأرسلها إلى الكاهن.')
            ],
            L('Could not link source', 'تعذّر ربط المصدر')
          )
        );
      }
    });
  });

  /* Certificates: prepare (freezes the snapshot) and send. Sacraments: record that it was celebrated. */
  host.querySelector('#submit')?.addEventListener('click', () => {
    if (isCertificate)
      return run(
        () => API.sendCertificate(id),
        [L('Sent to the priest', 'أُرسلت إلى الكاهن')],
        L('Could not send the certificate', 'تعذّر إرسال الشهادة'),
        false
      );
    const record = SACRAMENTS.find(s => s.id === id);
    openDrawer({
      title: L('Record the celebration', 'تسجيل الاحتفال'),
      sub: L(
        'Enter what actually took place. The priest then checks it against the register book and registers it.',
        'أدخل ما جرى فعلاً. ثم يطابقه الكاهن مع دفتر السجل ويسجّله.'
      ),
      body: (
        <>
          <div className="formgrid">
            <C.Field
              label={L('Celebration date', 'تاريخ الاحتفال')}
              id="cel_date"
              type="date"
              value={record.date || ''}
              req={true}
            />
            {timeSelect('cel_time', record.time || '')}
          </div>
          <C.Field label={L('Place', 'المكان')} id="cel_place" value={record.place || ''} req={true} />
          <C.Field label={L('Celebrant', 'المحتفل')} id="cel_celebrant" value={record.celebrantName || ''} req={true} />
          <C.Field
            label={L('Godparents / witnesses', 'الإشبين / الشهود')}
            id="cel_witnesses"
            value={record.godparents || ''}
          />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="cel_save">
            {L('Record and send for approval', 'تسجيل وإرسال للاعتماد')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#cel_save').addEventListener('click', async () => {
          if (
            !needAll(el, [
              ['#cel_date', L('Enter the date', 'أدخل التاريخ')],
              ['#cel_place', L('Enter the place', 'أدخل المكان')],
              ['#cel_celebrant', L('Name the celebrant', 'اذكر المحتفل')]
            ])
          )
            return;
          await run(
            () =>
              API.sacramentAction(id, 'record-celebration', {
                celebratedAt: API.toUtc(el.querySelector('#cel_date').value, el.querySelector('#cel_time').value),
                place: el.querySelector('#cel_place').value.trim(),
                celebrantName: el.querySelector('#cel_celebrant').value.trim(),
                witnesses: el.querySelector('#cel_witnesses').value.trim()
              }),
            [
              L('Celebration recorded', 'سُجّل الاحتفال'),
              L('The priest can now register it.', 'يمكن للكاهن تسجيله الآن.')
            ],
            L('Could not record the celebration', 'تعذّر تسجيل الاحتفال')
          );
        });
      }
    });
  });

  /* The priest's approval: a certificate request is signed for; a celebrated sacrament is registered in the book. */
  host.querySelector('#approve')?.addEventListener('click', () =>
    openModal({
      title: isCertificate
        ? L('Approve this certificate request?', 'اعتماد طلب الشهادة؟')
        : L('Register this entry?', 'تسجيل هذا القيد؟'),
      sub: L(
        'This action is recorded with your account and the time. Check the original register before confirming.',
        'يُسجّل هذا الإجراء باسم حسابك ووقته. راجع السجل الأصلي قبل التأكيد.'
      ),
      body: (
        <>
          {isCertificate ? (
            ''
          ) : (
            <C.Field
              label={L('Book and page (optional)', 'الدفتر والصفحة (اختياري)')}
              id="reg_book"
              value={doc.book || ''}
            />
          )}
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
            {isCertificate ? L('Approve request', 'اعتماد الطلب') : L('Register entry', 'تسجيل القيد')}
          </button>
        </>
      ),
      onMount(el) {
        const ack = el.querySelector('#ack'),
          ok = el.querySelector('#confirm');
        ack.addEventListener('change', () => (ok.disabled = !ack.checked));
        ok.addEventListener('click', () =>
          run(
            () =>
              isCertificate
                ? API.certificateAction(id, 'sign')
                : API.sacramentAction(id, 'register', { bookReference: el.querySelector('#reg_book')?.value.trim() }),
            isCertificate
              ? [
                  L('Request approved', 'اعتُمد الطلب'),
                  L(
                    'It goes to the bishop if his review is required, then it can be issued.',
                    'يذهب إلى المطران إن كانت مراجعته مطلوبة، ثم يمكن إصدارها.'
                  )
                ]
              : [
                  L('Entry registered', 'سُجّل القيد'),
                  L('It now has its official register number.', 'صار له رقم القيد الرسمي.')
                ],
            L('Action could not be completed', 'تعذّر إتمام الإجراء')
          )
        );
      }
    })
  );
  host
    .querySelector('#bishopaccept')
    ?.addEventListener('click', () =>
      run(
        () => API.certificateAction(id, 'accept'),
        [L('Accepted', 'قُبلت'), L('The certificate can now be issued.', 'يمكن الآن إصدار الشهادة.')],
        L('Could not accept', 'تعذّر القبول'),
        false
      )
    );

  host.querySelector('#sign')?.addEventListener('click', () =>
    openModal({
      title: L('Issue this certificate?', 'إصدار هذه الشهادة؟'),
      sub: L(
        'Issuing records who issued it and when. The wet-signed and sealed paper is the official document; this is not a signature.',
        'يسجّل الإصدار من أصدرها ومتى. الورقة الموقَّعة بخط اليد والمختومة هي الوثيقة الرسمية؛ وهذا ليس توقيعاً.'
      ),
      body: (
        <label className="check">
          <input type="checkbox" id="ack" />{' '}
          <span>{L('I have checked the prepared certificate.', 'راجعتُ الشهادة المحضَّرة.')}</span>
        </label>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>{' '}
          <button className="btn btn-primary" id="confirm" disabled>
            {L('Issue certificate', 'إصدار الشهادة')}
          </button>
        </>
      ),
      onMount(el) {
        const ack = el.querySelector('#ack'),
          ok = el.querySelector('#confirm');
        ack.addEventListener('change', () => (ok.disabled = !ack.checked));
        ok.addEventListener('click', () =>
          run(
            () => API.certificateAction(id, 'issue'),
            [
              L('Certificate issued', 'صدرت الشهادة'),
              L('Print it, then record the handover.', 'اطبعها ثم سجّل التسليم.')
            ],
            L('Could not issue the certificate', 'تعذّر إصدار الشهادة')
          )
        );
      }
    })
  );

  /* Electronic authorization: the priest who approved binds the exact prepared content with an authenticator code. */
  host.querySelector('#authorize')?.addEventListener('click', async () => {
    let preview;
    try {
      preview = await API.authorizationPreview(id);
    } catch (e) {
      return toast(L('Nothing to authorize yet', 'لا ما يُفوَّض بعد'), e.message, 'danger');
    }
    openModal({
      title: L('Authorize this certificate electronically?', 'تفويض هذه الشهادة إلكترونياً؟'),
      sub: preview.statement,
      body: (
        <>
          <dl className="dl">
            {Object.entries(preview.content).map(([k, v], i) => (
              <Fragment key={i}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </Fragment>
            ))}
            <dt>{L('Content fingerprint', 'بصمة المحتوى')}</dt>
            <dd className="mono" dir="ltr">
              {preview.contentHash}
            </dd>
          </dl>
          <C.Field
            label={L('Authenticator code', 'رمز المصادقة')}
            id="auth_code"
            req={true}
            dir="ltr"
            autoComplete="one-time-code"
          />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="auth_confirm">
            {L('Authorize', 'تفويض')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#auth_confirm').addEventListener('click', async () => {
          if (!need(el, '#auth_code', L('Enter your authenticator code', 'أدخل رمز المصادقة'))) return;
          await run(
            () => API.authorizeCertificate(id, el.querySelector('#auth_code').value),
            [
              L('Authorized', 'فُوِّضت'),
              L('The certificate now carries a verification code.', 'تحمل الشهادة الآن رمز تحقق.')
            ],
            L('Could not authorize', 'تعذّر التفويض')
          );
        });
      }
    });
  });

  host.querySelector('#release')?.addEventListener('click', () =>
    openDrawer({
      title: L('Record the handover', 'تسجيل التسليم'),
      sub: L(
        'Who received the certificate, how they relate to the person, and how they were identified.',
        'من استلم الشهادة، وصلته بالشخص، وكيف تم التحقق من هويته.'
      ),
      body: (
        <>
          <C.Field label={L('Received by', 'المستلم')} id="rel_name" req={true} />
          <C.Field label={L('Relationship to the person', 'الصلة بالشخص')} id="rel_relation" req={true} />
          <div className="formrow">
            <label className="label" htmlFor="rel_method">
              {L('How they were identified', 'طريقة التحقق')}
            </label>
            <Select id="rel_method">
              <option value="InPerson">{L('In person', 'حضورياً')}</option>
              <option value="VerifiedAccount">{L('Verified account', 'حساب موثَّق')}</option>
              <option value="Representative">{L('Representative', 'وكيل')}</option>
            </Select>
          </div>
          <C.Field label={L('Evidence seen', 'ما اطُّلع عليه')} id="rel_evidence" req={true} />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="rel_save">
            {L('Record handover', 'تسجيل التسليم')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#rel_save').addEventListener('click', async () => {
          if (
            !needAll(el, [
              ['#rel_name', L('Enter who received it', 'أدخل اسم المستلم')],
              ['#rel_relation', L('Enter the relationship', 'أدخل الصلة')],
              ['#rel_evidence', L('Enter the evidence seen', 'أدخل ما اطُّلع عليه')]
            ])
          )
            return;
          await run(
            () =>
              API.certificateAction(id, 'release', {
                recipientName: el.querySelector('#rel_name').value.trim(),
                recipientRelationship: el.querySelector('#rel_relation').value.trim(),
                verificationMethod: el.querySelector('#rel_method').value,
                verificationEvidence: el.querySelector('#rel_evidence').value.trim()
              }),
            [L('Handover recorded', 'سُجّل التسليم')],
            L('Could not record the handover', 'تعذّر تسجيل التسليم')
          );
        });
      }
    })
  );
  withReason('#withdraw', {
    title: L('Withdraw this certificate?', 'سحب هذه الشهادة؟'),
    sub: L('The reason stays in the record.', 'يبقى السبب في السجل.'),
    confirm: L('Withdraw', 'سحب'),
    keep: L('Keep it', 'إبقاؤها'),
    failed: L('Could not withdraw', 'تعذّر السحب'),
    step: reason => API.certificateAction(id, 'withdraw', { reason })
  });
  withReason('#reject', {
    title: isCertificate
      ? L('Return this certificate request?', 'إعادة طلب الشهادة؟')
      : L('Return this entry to the office?', 'إعادة هذا القيد إلى المكتب؟'),
    sub: L('The reason is shown to the office.', 'يظهر السبب للمكتب.'),
    confirm: L('Return', 'إعادة'),
    keep: L('Keep open', 'إبقاؤه مفتوحاً'),
    failed: L('Decision could not be saved', 'تعذّر حفظ القرار'),
    done: [L('Returned', 'أُعيد')],
    step: reason =>
      isCertificate
        ? API.certificateAction(id, 'return', { reason })
        : API.sacramentAction(id, 'return-entry', { reason })
  });
  withReason('#cancelrequest', {
    title: L('Cancel this certificate request?', 'إلغاء طلب الشهادة؟'),
    sub: L('The reason will remain in the record.', 'سيبقى السبب في السجل.'),
    confirm: L('Cancel request', 'إلغاء الطلب'),
    keep: L('Keep open', 'إبقاؤه مفتوحاً'),
    failed: L('Decision could not be saved', 'تعذّر حفظ القرار'),
    done: [L('Request cancelled', 'أُلغي الطلب')],
    step: reason => API.certificateAction(id, 'cancel', { reason })
  });

  /* Corrections to a registered entry: proposed by the office, decided by the priest, appended to its history. */
  host.querySelector('#proposecorrection')?.addEventListener('click', () =>
    openDrawer({
      title: L('Propose a correction', 'اقتراح تصحيح'),
      sub: L(
        'The registered entry stays as it is until the priest approves. The old value, reason and evidence are kept.',
        'يبقى القيد المسجَّل كما هو حتى يعتمد الكاهن. تُحفظ القيمة القديمة والسبب والدليل.'
      ),
      body: (
        <>
          <div className="formrow">
            <label className="label" htmlFor="corr_field">
              {L('What to correct', 'ما يُصحَّح')}
            </label>
            <Select id="corr_field">
              {API.CORRECTABLE.map(([k, en, ar], i) => (
                <option key={i} value={k}>
                  {L(en, ar)}
                </option>
              ))}
            </Select>
          </div>
          <C.Field label={L('Correct value', 'القيمة الصحيحة')} id="corr_value" req={true} />
          <C.Textarea label={L('Reason', 'السبب')} id="corr_reason" max={500} />
          <C.Field label={L('Evidence seen', 'الدليل')} id="corr_evidence" req={true} />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="corr_save">
            {L('Send to the priest', 'إرسال إلى الكاهن')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#corr_save').addEventListener('click', async () => {
          if (
            !needAll(el, [
              ['#corr_value', L('Enter the correct value', 'أدخل القيمة الصحيحة')],
              ['#corr_reason', L('Enter a reason', 'أدخل السبب')],
              ['#corr_evidence', L('Enter the evidence', 'أدخل الدليل')]
            ])
          )
            return;
          const field = el.querySelector('#corr_field').value,
            value = el.querySelector('#corr_value').value.trim();
          await run(
            () =>
              API.proposeCorrection(id, {
                field,
                newValue: field === 'celebratedAt' ? API.toUtc(value) : value,
                reason: el.querySelector('#corr_reason').value.trim(),
                evidence: el.querySelector('#corr_evidence').value.trim()
              }),
            [L('Correction proposed', 'اقتُرح التصحيح')],
            L('Could not propose the correction', 'تعذّر اقتراح التصحيح')
          );
        });
      }
    })
  );
  for (const [attr, approve] of [
    ['corr-approve', true],
    ['corr-reject', false]
  ])
    host.querySelectorAll(`[data-${attr}]`).forEach(button =>
      button.addEventListener('click', () => {
        const correction = SACRAMENTS.find(s => s.id === id)?.pendingCorrections.find(
          c => c.id === button.dataset[attr === 'corr-approve' ? 'corrApprove' : 'corrReject']
        );
        if (!correction) return;
        openModal({
          title: approve
            ? L('Approve this correction?', 'اعتماد هذا التصحيح؟')
            : L('Reject this correction?', 'رفض هذا التصحيح؟'),
          body: <C.Textarea label={L('Note', 'ملاحظة')} id="corr_note" max={500} />,
          foot: (
            <>
              <button className="btn btn-secondary" data-close="">
                {L('Back', 'رجوع')}
              </button>
              <button className="btn btn-primary" id="corr_confirm">
                {approve ? L('Approve', 'اعتماد') : L('Reject', 'رفض')}
              </button>
            </>
          ),
          onMount(el) {
            el.querySelector('#corr_confirm').addEventListener('click', async () => {
              if (!need(el, '#corr_note', L('Enter a note', 'أدخل ملاحظة'))) return;
              await run(
                () => API.decideCorrection(correction, approve, el.querySelector('#corr_note').value.trim()),
                [approve ? L('Correction approved', 'اعتُمد التصحيح') : L('Correction rejected', 'رُفض التصحيح')],
                L('Could not save the decision', 'تعذّر حفظ القرار')
              );
            });
          }
        });
      })
    );
};
