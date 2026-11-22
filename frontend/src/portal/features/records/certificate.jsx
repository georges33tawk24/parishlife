/* One sacrament record or certificate request: its progress, next step, celebration, history,
   documents and signatures. The screen is drawn here; what it wires once drawn is certificate-actions.jsx, and the
   pieces both use are certificate-parts.jsx. */
import { Fragment } from 'react';

import { fmtDate } from '../../../lib/i18n.js';
import { is, bus } from '../../model/store.js';
import { session } from '../../model/api.js';
import { RequestDocuments } from './request-documents.jsx';
import { Icon, PageHead, Panel, Empty } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';

import * as API from '../../model/modules/sacraments.js';
import { SACRAMENTS, person } from '../../model/data.js';
import { onlineMark } from './online-requests.jsx';
import { languageName } from '../../model/sacrament-requests.js';
import { celebrationText, eligibleSources, kindLabel, nameIn, official, today } from './records-shared.jsx';
import { certificateSVG, docCard } from './certificate-document.jsx';

import {
  L,
  twin,
  labelOf,
  progressPanel,
  histReason,
  histLabel,
  when,
  docLang,
  telLink
} from './certificate-parts.jsx';
import { mountCertificate } from './certificate-actions.jsx';

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
          s.requestedAt
            ? [L('Requested', 'تاريخ الطلب'), `${when(s.requestedAt)}${s.requestedBy ? ` · ${s.requestedBy}` : ''}`]
            : null,
          s.signedAt
            ? [
                L('Priest’s signature image', 'صورة توقيع الكاهن'),
                s.hasSignatureImage
                  ? L(
                      'Attached at approval, for the printed paper only (not an electronic signature)',
                      'أُرفقت عند الاعتماد للورقة المطبوعة فقط (ليست توقيعاً إلكترونياً)'
                    )
                  : L('None — the priest signs the paper by hand', 'لا صورة — يوقّع الكاهن الورقة بيده')
              ]
            : null,
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
          [
            L('Celebrant', 'المحتفل'),
            <>
              {twin(record.celebrantName, record.celebrantNameAr) || L('To be assigned', 'يُحدَّد لاحقاً')}
              {record.celebrant && person(record.celebrant) ? (
                <small className="dim" style={{ display: 'block' }}>
                  <a href={`#/person/${record.celebrant}`}>{nameIn(person(record.celebrant))}</a>
                </small>
              ) : (
                ''
              )}
            </>
          ],
          record.place || record.placeAr ? [L('Place', 'المكان'), twin(record.place, record.placeAr)] : null,
          record.godparents || record.godparentsAr
            ? [L('Godparents / witnesses', 'الإشبين / الشهود'), twin(record.godparents, record.godparentsAr)]
            : null,
          record.father || record.fatherAr ? [L('Father', 'الأب'), twin(record.father, record.fatherAr)] : null,
          record.mother || record.motherAr ? [L('Mother', 'الأم'), twin(record.mother, record.motherAr)] : null,
          [L('Book', 'الدفتر'), record.book || '—'],
          [L('Page', 'الصفحة'), record.page || '—'],
          s.requestedAt
            ? [L('Requested', 'تاريخ الطلب'), `${when(s.requestedAt)}${s.requestedBy ? ` · ${s.requestedBy}` : ''}`]
            : null,
          s.officeReviewedAt
            ? [
                L('Reviewed by the office', 'راجعه المكتب'),
                <>
                  {when(s.officeReviewedAt)}
                  {s.officeReviewedBy ? ` · ${s.officeReviewedBy}` : ''}
                  {s.officeReviewNote ? (
                    <small className="dim" style={{ display: 'block' }}>
                      {s.officeReviewNote}
                    </small>
                  ) : (
                    ''
                  )}
                </>
              ]
            : null,
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
      {s.pendingAmendment ? (
        <div className="alert alert-warning" style={{ marginTop: '14px' }}>
          <b>{L('Change to the request awaiting the priest', 'تعديل على الطلب بانتظار الكاهن')}</b>
          <br />
          {s.pendingAmendment.reason}
          {s.pendingAmendment.proposedBy ? ` · ${s.pendingAmendment.proposedBy}` : ''}
          <br />
          {s.pendingAmendment.date ? (
            <>
              {L('Requested date', 'التاريخ المطلوب')}: {s.requestedDate || '—'} → {s.pendingAmendment.date}
              <br />
            </>
          ) : (
            ''
          )}
          {Object.entries(s.pendingAmendment.facts).map(([k, v], i) => (
            <span key={i} style={{ display: 'block' }}>
              {k}: {s.facts?.[k] || '—'} → {v || L('(removed)', '(حُذف)')}
            </span>
          ))}
          {is('priest') ? (
            <span className="row" style={{ gap: '6px', marginTop: '8px' }}>
              <button className="btn btn-primary btn-dense" id="amend_approve">
                {L('Approve change', 'اعتماد التعديل')}
              </button>
              <button className="btn btn-secondary btn-dense" id="amend_reject">
                {L('Reject change', 'رفض التعديل')}
              </button>
            </span>
          ) : (
            ''
          )}
        </div>
      ) : (
        ''
      )}{' '}
      {(s.requestAmendments || []).filter(a => a.status !== 'Pending').length ? (
        <div style={{ marginTop: '14px' }}>
          <b className="t-caption">{L('Changes to the request', 'تعديلات الطلب')}</b>
          {s.requestAmendments
            .filter(a => a.status !== 'Pending')
            .map((a, i) => (
              <p key={i} className="t-caption dim">
                {a.status === 'Approved' ? L('Approved', 'اعتُمد') : L('Rejected', 'رُفض')} · {when(a.decidedAt)}
                {a.decidedBy ? ` · ${a.decidedBy}` : ''} · {a.reason}
                {a.date ? ` · ${a.previousDate || '—'} → ${a.date}` : ''}
                {a.decisionNote ? ` · ${a.decisionNote}` : ''}
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
  /* The case's preparation checklist: the parish's own list as copied onto this case; the office ticks each item. */
  const parishList = !isCertificate ? API.requirementSetFor(s.kind) : null;
  const checklistOpen = !isCertificate && ['preparing', 'scheduled'].includes(s.status);
  const listChanged =
    checklistOpen &&
    !!parishList &&
    parishList.items.map(i => `${i.key}|${i.label}|${i.labelAr}`).join('\n') !==
      (s.requirements || []).map(r => `${r.key}|${r.label}|${r.labelAr}`).join('\n');
  const checklist =
    !isCertificate && ((s.requirements || []).length > 0 || listChanged) ? (
      <Panel title={L('Preparation checklist', 'لائحة التحضير')}>
        {(s.requirements || []).map((r, i) => (
          <label key={i} className="check" style={{ display: 'flex', marginBottom: '8px' }}>
            <input
              type="checkbox"
              data-req-key={r.key}
              defaultChecked={r.met}
              disabled={!checklistOpen || !is('secretary', 'priest')}
            />{' '}
            <span>
              {labelOf(r)}
              {r.recordedAt ? (
                <small className="dim" style={{ display: 'block' }}>
                  {r.met ? L('Met', 'مستوفى') : L('Not met', 'غير مستوفى')} · {when(r.recordedAt)}
                  {r.recordedBy ? ` · ${r.recordedBy}` : ''}
                  {r.note ? ` · ${r.note}` : ''}
                </small>
              ) : (
                ''
              )}
            </span>
          </label>
        ))}
        {s.requirementsBlockScheduling ? (
          <p className="t-caption dim">
            {L(
              'The parish confirms a date only when every item is met.',
              'لا تؤكّد الرعية الموعد إلا بعد استيفاء كل البنود.'
            )}
          </p>
        ) : (
          ''
        )}
        {listChanged && is('secretary', 'priest') ? (
          <button className="btn btn-secondary btn-dense" id="reqsync">
            {L('Update to the parish’s current list', 'التحديث إلى لائحة الرعية الحالية')}
          </button>
        ) : (
          ''
        )}
      </Panel>
    ) : (
      ''
    );
  // what happened, when, and who did it (names come from the account-names lookup; empty when not revealed)
  const people = (
    s.kind === 'certificate'
      ? [
          [L('Approved by the priest', 'اعتمده الكاهن'), s.signedByName, s.signedAt],
          [L('Accepted by the bishop', 'قبله المطران'), s.acceptedByName, s.acceptedAt],
          [L('Issued', 'صدرت'), s.issuedByName, s.issuedAt],
          [
            L('Handed over to', 'سُلّمت إلى'),
            [s.recipientName, s.recipientRelationship].filter(Boolean).join(' · '),
            s.releasedAt
          ]
        ]
      : [
          [
            L('Request accepted', 'قُبل الطلب'),
            s.history?.find(h => h.action === 'accept')?.by || '',
            s.requestApprovedAt
          ],
          [L('Registered', 'سُجّل'), s.history?.find(h => h.action === 'register')?.by || '', s.registeredAt]
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
                {['requested', 'office-reviewed'].includes(s.status) && is('priest') ? (
                  <>
                    <button className="btn btn-primary" id="acceptrequest">
                      <Icon name="check" size={17} />
                      {L('Accept request', 'قبول الطلب')}
                    </button>
                    <button className="btn btn-secondary" id="declinerequest">
                      {L('Decline', 'رفض')}
                    </button>
                  </>
                ) : s.status === 'requested' && is('secretary') ? (
                  <button className="btn btn-primary" id="officereview">
                    <Icon name="check" size={17} />
                    {L('Mark reviewed by the office', 'تأشير مراجعة المكتب')}
                  </button>
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
                {['preparing', 'scheduled'].includes(s.status) && !s.pendingAmendment && is('secretary', 'priest') ? (
                  <button className="btn btn-ghost" id="proposeamend">
                    {L('Propose a change to the request', 'اقتراح تعديل على الطلب')}
                  </button>
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
          {details} {checklist} <RequestDocuments record={s} scope="sacrament-request" onChange={() => bus.refresh()} />
        </div>{' '}
        <aside className="sidecol">{activity}</aside>
      </div>
    </>
  );
}

certificate.mount = mountCertificate;
