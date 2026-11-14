/* Purpose: the parish office's view of one request case, for online and guest requests alike: who asked
   and for whom, what they said, the decision buttons, the checklist and private files, the messages and
   the history, (once accepted) opening the sacramental case or certificate it needs, the office's letters,
   and (for a guest request) the account-link review and the replacement of a leaked tracking link.
   People are named through the shared account-name lookup (model/names.js); an id it may not reveal shows
   a neutral label.
   Main functions: RequestCase (the drawer's content), openRequestCase, caseStatus.

   Every button is one API action on ParishLife.Api (docs/frontend-modules/requests.md): the screen
   reads the case again afterwards and tells the list to reload, so it only ever shows what is stored. */
import { useEffect, useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { Select } from '../../ui/components.jsx';
import { Pill, openDrawer, closeOverlays, toast } from '../../ui/ui.jsx';
import { is } from '../../model/store.js';
import { session } from '../../model/api.js';
import { loadNames, nameOf } from '../../model/names.js';
import { PEOPLE, person } from '../../model/data.js';
import { hydrate } from '../../model/persist.js';
import { trackingLink } from '../../model/guest-requests.js';
import {
  getCase,
  getMessages,
  getHistory,
  act,
  postMessage,
  decideAssociation,
  rotateTracking,
  toOffice,
  TERMINAL
} from '../../model/modules/requests.js';
import {
  fmtStamp,
  fmtDay,
  certificateName,
  purposeText,
  languageName,
  occasionText
} from '../../model/sacrament-requests.js';
import { RequestDocuments } from './request-documents.jsx';
import { OpenRecord, LinkedRecords } from './request-record.jsx';
import { RequestLetters } from './request-letters.jsx';

const L = (en, ar) => t(en, ar);

const STATUS = {
  Received: ['Received', 'استُلم', 'warning'],
  NeedsInformation: ['Needs information', 'يحتاج معلومات', 'warning'],
  AcceptedForProcessing: ['Accepted for processing', 'مقبول للمعالجة', 'info'],
  CancellationRequested: ['Cancellation requested', 'طُلب الإلغاء', 'warning'],
  Completed: ['Completed', 'مكتمل', 'success'],
  Declined: ['Declined', 'مرفوض', 'danger'],
  Withdrawn: ['Withdrawn', 'مسحوب', ''],
  Cancelled: ['Cancelled', 'ملغى', 'danger']
};
export const caseStatus = status => (STATUS[status] ? L(STATUS[status][0], STATUS[status][1]) : status);
const ORIGIN = {
  Online: ['Online', 'إلكتروني'],
  Guest: ['Guest, no account', 'زائر دون حساب'],
  Telephone: ['Telephone', 'هاتف'],
  Paper: ['Paper', 'ورقي'],
  InPerson: ['In person', 'شخصياً']
};
const RELATIONSHIP = {
  Self: ['Themselves', 'لنفسه'],
  Parent: ['Parent', 'أحد الوالدين'],
  Guardian: ['Guardian', 'ولي أمر'],
  Spouse: ['Spouse', 'الزوج/الزوجة'],
  Child: ['Child', 'ابن/ابنة'],
  Relative: ['Relative', 'قريب'],
  Representative: ['Representative', 'وكيل'],
  Other: ['Other', 'آخر']
};
const KIND = {
  SacramentInquiry: ['Sacrament', 'سرّ'],
  Certificate: ['Certificate', 'شهادة'],
  Facility: ['Hall or room', 'قاعة أو مكان'],
  PriestAppointment: ['Appointment with the priest', 'موعد مع الكاهن'],
  MassIntention: ['Mass intention', 'نيّة قدّاس'],
  Blessing: ['Blessing', 'تبريك'],
  Visit: ['Visit', 'زيارة'],
  MinistryInquiry: ['Ministry', 'خدمة'],
  General: ['General request', 'طلب عام']
};
const ACTION = {
  submit: ['Sent', 'أُرسل'],
  accept: ['Accepted', 'قُبل'],
  return: ['Asked for information', 'طُلبت معلومات'],
  decline: ['Declined', 'رُفض'],
  cancel: ['Cancelled', 'أُلغي'],
  'clergy-approve': ['Approved by the priest', 'وافق الكاهن'],
  'confirm-date': ['Date confirmed', 'أُكّد الموعد'],
  complete: ['Completed', 'أُنجز'],
  triage: ['Triage updated', 'عُدّل الفرز'],
  'match-subject': ['Person record matched', 'رُبط بسجل شخص'],
  'review-authority': ['Authority reviewed', 'روجعت الصلاحية'],
  link: ['Record linked', 'رُبط سجل'],
  checklist: ['Checklist updated', 'عُدّلت القائمة'],
  handover: ['Handed over', 'سُلّم'],
  claim: ['Account link requested', 'طُلب ربط حساب'],
  associate: ['Account linked', 'رُبط الحساب'],
  'association-decline': ['Account link declined', 'رُفض ربط الحساب'],
  'rotate-tracking': ['Tracking link replaced', 'استُبدل رابط المتابعة'],
  withdraw: ['Withdrawn', 'سُحب'],
  respond: ['Applicant answered', 'أجاب مقدّم الطلب'],
  edit: ['Edited by the applicant', 'عدّله مقدّم الطلب'],
  'request-cancel': ['Cancellation requested', 'طُلب الإلغاء']
};
const LABELS = {
  description: ['Request details', 'تفاصيل الطلب'],
  email: ['Email', 'البريد'],
  phone: ['Phone', 'الهاتف'],
  behalf: ['On behalf of', 'بالنيابة عن'],
  ministry: ['Ministry', 'الخدمة'],
  sacrament: ['Sacrament', 'السرّ'],
  subject: ['Asking for', 'المطلوب'],
  message: ['In the applicant’s words', 'بكلمات مقدّم الطلب'],
  date: ['Preferred day', 'اليوم المفضّل'],
  venue: ['Place', 'المكان'],
  from: ['From', 'من'],
  to: ['Until', 'إلى'],
  occasion: ['Occasion', 'المناسبة'],
  guests: ['People expected', 'عدد الأشخاص'],
  notes: ['Notes', 'ملاحظات'],
  certificateOf: ['Certificate', 'الشهادة'],
  purpose: ['Purpose', 'الغرض'],
  language: ['Language', 'اللغة'],
  partner: ['Future spouse', 'الشريك'],
  partnerParish: ['Their parish', 'رعيّته']
};
const VALUE = {
  certificateOf: certificateName,
  purpose: purposeText,
  language: languageName,
  occasion: occasionText,
  date: v => (/^\d{4}-\d\d-\d\d$/.test(v) ? fmtDay(v) : v)
};

const row = (k, v) =>
  v ? (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  ) : null;

/* [label, value] for every detail the applicant gave, known fields first. */
function detailRows(r) {
  const d = { ...r.details },
    out = [];
  const c = d.child;
  delete d.child;
  for (const [key, value] of Object.entries(d)) {
    const known = LABELS[key];
    out.push([known ? L(...known) : key, VALUE[key] ? VALUE[key](String(value)) : String(value)]);
  }
  if (c)
    out.push([
      L('Child', 'الطفل'),
      [
        c.lat,
        c.ar,
        c.born && `${L('born', 'مواليد')} ${fmtDay(c.born)}`,
        c.father && `${L('father', 'الأب')} ${c.father}`,
        c.mother && `${L('mother', 'الأم')} ${c.mother}`
      ]
        .filter(Boolean)
        .join(' · ')
    ]);
  return out;
}

const contactLink = v =>
  /^[^@\s]+@[^@\s]+$/.test(v) ? (
    <a href={`mailto:${v}`} dir="ltr">
      {v}
    </a>
  ) : /^[+\d][\d\s()+-]{5,}$/.test(v) ? (
    <a href={`tel:${v.replace(/[^\d+]/g, '')}`}>
      <bdi dir="ltr">{v}</bdi>
    </a>
  ) : (
    v
  );

export function RequestCase({ id, onChange }) {
  const [state, setState] = useState({ loading: true }),
    [round, setRound] = useState(0),
    [busy, setBusy] = useState(''),
    [note, setNote] = useState(''),
    [fresh, setFresh] = useState('');
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [c, messages, history] = await Promise.all([getCase(id), getMessages(id), getHistory(id)]);
        await loadNames(session.parishId, [
          c.value.assignedTo,
          c.value.claimantAccountId,
          ...messages.map(m => m.authorAccountId),
          ...history.map(h => h.actorAccountId)
        ]);
        if (live) setState({ c, messages, history });
      } catch (error) {
        if (live) setState({ error: error.message });
      }
    })();
    return () => {
      live = false;
    };
  }, [id, round]);
  if (state.error) return <p className="help help-error">{state.error}</p>;
  if (!state.c) return <p className="help">{L('Loading…', 'جارٍ التحميل…')}</p>;

  const { value: dto, version } = state.c,
    r = toOffice(dto, version),
    open = !TERMINAL.includes(dto.status),
    canAct = is('priest', 'secretary'),
    priest = is('priest'),
    status = STATUS[dto.status] || [dto.status, dto.status, ''],
    subject = person(dto.subjectPersonId);

  /* One API action, then read the case again and tell the list. */
  const run = async (key, work, done) => {
    if (busy) return;
    setBusy(key);
    try {
      const result = await work();
      if (done) toast(done, '', 'success');
      setNote('');
      setRound(n => n + 1);
      await hydrate();
      onChange?.();
      return result;
    } catch (error) {
      toast(L('Could not save', 'تعذّر الحفظ'), error.message, 'danger');
    } finally {
      setBusy('');
    }
  };
  const needNote = () => {
    if (note.trim()) return true;
    toast(L('Write a message for the applicant first.', 'اكتب رسالة لمقدّم الطلب أولاً.'), '', 'warning');
    return false;
  };
  const decide =
    (action, done, withNote = false) =>
    () => {
      if (withNote && !needNote()) return;
      return run(action, () => act(id, version, action, withNote ? { explanation: note.trim() } : {}), done);
    };
  const needsAuthority = dto.relationship !== 'Self' && !dto.authorityReviewed;

  const decisions =
    !canAct || !open ? null : (
      <section className="or-section" aria-labelledby="rc-decide">
        <h3 id="rc-decide">{L('Decision', 'القرار')}</h3>
        {needsAuthority && dto.status === 'Received' ? (
          <p className="help">
            {L(
              'This request is made for someone else. Review the requester’s authority before accepting it.',
              'هذا الطلب مقدَّم لشخص آخر. راجع صلاحية مقدّم الطلب قبل قبوله.'
            )}
          </p>
        ) : null}
        <div className="formrow">
          <label className="label" htmlFor="rc-note">
            {L('Message the applicant will see', 'رسالة يراها مقدّم الطلب')}
          </label>
          <textarea
            className="textarea"
            id="rc-note"
            rows="3"
            maxLength="2000"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <span className="help">
            {L('Needed to ask for information, decline or cancel.', 'مطلوبة لطلب معلومات أو الرفض أو الإلغاء.')}
          </span>
        </div>
        <div className="account-actions">
          {dto.status === 'Received' ? (
            <button
              className="btn btn-primary"
              disabled={!!busy || needsAuthority}
              onClick={decide('accept', L('Accepted for processing', 'قُبل للمعالجة'))}
            >
              {L('Accept', 'قبول')}
            </button>
          ) : null}
          {['Received', 'AcceptedForProcessing'].includes(dto.status) ? (
            <button
              className="btn btn-secondary"
              disabled={!!busy}
              onClick={decide('return', L('Information requested', 'طُلبت معلومات'), true)}
            >
              {L('Ask for information', 'طلب معلومات')}
            </button>
          ) : null}
          {['Received', 'NeedsInformation', 'AcceptedForProcessing'].includes(dto.status) ? (
            <button
              className="btn btn-danger"
              disabled={!!busy}
              onClick={decide('decline', L('Declined', 'رُفض'), true)}
            >
              {L('Decline', 'رفض')}
            </button>
          ) : null}
          {['AcceptedForProcessing', 'CancellationRequested'].includes(dto.status) ? (
            <button
              className="btn btn-secondary"
              disabled={!!busy}
              onClick={decide('cancel', L('Cancelled', 'أُلغي'), true)}
            >
              {L('Cancel the request', 'إلغاء الطلب')}
            </button>
          ) : null}
          {dto.status === 'AcceptedForProcessing' && priest && !dto.clergyApprovedAt ? (
            <button
              className="btn btn-primary"
              disabled={!!busy}
              onClick={decide('clergy-approve', L('Approved by the priest', 'وافق الكاهن'))}
            >
              {L('Approve as the priest', 'موافقة الكاهن')}
            </button>
          ) : null}
          {dto.status === 'AcceptedForProcessing' ? (
            <button
              className="btn btn-primary"
              disabled={!!busy}
              onClick={decide('complete', L('Marked as completed', 'عُلّم كمكتمل'))}
            >
              {L('Mark as completed', 'تعليم كمكتمل')}
            </button>
          ) : null}
        </div>
        {dto.status === 'AcceptedForProcessing' ? (
          <ConfirmDate run={run} id={id} version={version} busy={busy} />
        ) : null}
      </section>
    );

  const facts = [
    [L('Received', 'استُلم'), dto.receivedAt],
    [L('Accepted', 'قُبل'), dto.acceptedAt],
    [L('Approved by the priest', 'وافق الكاهن'), dto.clergyApprovedAt],
    [L('Date confirmed for', 'الموعد المؤكَّد'), dto.confirmedDate],
    [L('Completed', 'اكتمل'), dto.completedAt]
  ].filter(([, at]) => at);

  return (
    <div className="or-body">
      <section className="or-section">
        <p>
          <Pill label={L(status[0], status[1])} tone={status[2]} />{' '}
          <bdi className="mono" dir="ltr">
            {dto.reference}
          </bdi>{' '}
          · {L(...(KIND[dto.kind] || [dto.kind, dto.kind]))}
        </p>
        <dl className="dl or-dl">
          {facts.map(([k, at], i) => (
            <div key={i} style={{ display: 'contents' }}>
              {row(k, fmtStamp(at))}
            </div>
          ))}
          {dto.notificationOutcome
            ? row(L('Applicant notice', 'إشعار مقدّم الطلب'), dto.notificationOutcome.meaning)
            : null}
          {dto.applicantExplanation
            ? row(L('Last message to the applicant', 'آخر رسالة لمقدّم الطلب'), dto.applicantExplanation)
            : null}
          {dto.deadline
            ? row(
                L('Deadline', 'الموعد النهائي'),
                fmtStamp(dto.deadline) + (dto.overdue ? ` · ${L('overdue', 'متأخر')}` : '')
              )
            : null}
          {dto.urgency === 'Urgent' ? row(L('Urgent', 'عاجل'), dto.urgencyReason) : null}
          {dto.nextAction ? row(L('Next action', 'الخطوة التالية'), dto.nextAction) : null}
          {dto.assignedTo
            ? row(
                L('Assigned to', 'مُسنَد إلى'),
                dto.assignedTo === session.accountUser?.id
                  ? L('You', 'أنت')
                  : nameOf(session.parishId, dto.assignedTo) || L('Another office member', 'عضو آخر في المكتب')
              )
            : null}
        </dl>
      </section>

      <section className="or-section" aria-labelledby="rc-from">
        <h3 id="rc-from">{L('Sent by', 'أرسله')}</h3>
        <dl className="dl or-dl">
          {row(L('Name', 'الاسم'), dto.requesterName)}
          {row(L('Contact', 'التواصل'), dto.requesterContact ? contactLink(dto.requesterContact) : '')}
          {row(L('How it arrived', 'طريقة الوصول'), L(...(ORIGIN[dto.origin] || [dto.origin, dto.origin])))}
          {dto.applicantAccountId ? row(L('Account', 'الحساب'), L('Signed in with an account', 'سجّل بحساب')) : null}
        </dl>
      </section>

      <section className="or-section" aria-labelledby="rc-for">
        <h3 id="rc-for">{L('For', 'لـ')}</h3>
        <dl className="dl or-dl">
          {row(
            L('Asked for', 'مقدَّم لـ'),
            L(...(RELATIONSHIP[dto.relationship] || [dto.relationship, dto.relationship]))
          )}
          {row(L('Described as', 'الوصف'), dto.subjectDescription)}
          {row(
            L('Person record', 'سجل الشخص'),
            subject ? (
              <a href={`#/person/${subject.id}`}>{subject.lat || subject.ar}</a>
            ) : dto.subjectPersonId ? (
              L('A record in People', 'سجل في المؤمنين')
            ) : (
              L('Not matched to a record yet', 'لم يُربط بسجل بعد')
            )
          )}
          {row(L('Authority', 'الصلاحية'), dto.authorityBasis)}
          {dto.relationship !== 'Self'
            ? row(
                L('Authority reviewed', 'رُوجعت الصلاحية'),
                dto.authorityReviewed ? L('Yes', 'نعم') : L('Not yet', 'ليس بعد')
              )
            : null}
        </dl>
        {canAct && open ? <Matching run={run} id={id} version={version} busy={busy} /> : null}
        {canAct && open && needsAuthority ? <Authority run={run} id={id} version={version} busy={busy} /> : null}
      </section>

      <section className="or-section" aria-labelledby="rc-details">
        <h3 id="rc-details">{L('The request', 'الطلب')}</h3>
        <p>
          <b>{dto.summary}</b>
        </p>
        <dl className="dl or-dl">
          {detailRows(r).map(([k, v], i) => (
            <div key={i} style={{ display: 'contents' }}>
              {row(k, <bdi>{v}</bdi>)}
            </div>
          ))}
          {row(L('Preferred dates', 'التواريخ المفضّلة'), dto.preferredDates)}
        </dl>
        {dto.links?.length ? (
          <>
            <p className="help">{L('Linked records', 'سجلات مرتبطة')}</p>
            <LinkedRecords links={dto.links} />
          </>
        ) : null}
      </section>

      {decisions}

      {canAct ? <OpenRecord dto={dto} version={version} run={run} busy={busy} /> : null}

      {canAct && open ? <Triage run={run} id={id} version={version} busy={busy} dto={dto} /> : null}

      <RequestDocuments
        record={{ id, status: r.status, api: true }}
        scope="request"
        onChange={() => setRound(n => n + 1)}
      />

      {canAct ? <RequestLetters dto={dto} /> : null}

      <Messages id={id} messages={state.messages} canAct={canAct} run={run} busy={busy} />

      {r.origin === 'Guest' && canAct ? (
        <GuestLink dto={dto} id={id} version={version} run={run} busy={busy} fresh={fresh} setFresh={setFresh} />
      ) : null}

      <section className="or-section" aria-labelledby="rc-history">
        <h3 id="rc-history">{L('History', 'السجل')}</h3>
        {state.history.length ? (
          <ol className="help">
            {state.history.map(h => (
              <li key={h.id}>
                {fmtStamp(h.at)} · {ACTION[h.action] ? L(...ACTION[h.action]) : h.action}
                {h.actorAccountId && nameOf(session.parishId, h.actorAccountId)
                  ? ` · ${nameOf(session.parishId, h.actorAccountId)}`
                  : ''}
                {h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus
                  ? ` (${caseStatus(h.fromStatus)} → ${caseStatus(h.toStatus)})`
                  : ''}
              </li>
            ))}
          </ol>
        ) : (
          <p className="help">{L('Nothing recorded yet.', 'لا شيء مسجّلاً بعد.')}</p>
        )}
      </section>
    </div>
  );
}

/* A date for the celebration or the appointment. The API needs a future moment. */
function ConfirmDate({ run, id, version, busy }) {
  const [day, setDay] = useState(''),
    [time, setTime] = useState('09:00');
  return (
    <div className="formrow">
      <span className="label">{L('Confirm a date', 'تأكيد موعد')}</span>
      <div className="account-actions">
        <input
          className="input"
          type="date"
          aria-label={L('Day', 'اليوم')}
          value={day}
          onChange={e => setDay(e.target.value)}
        />
        <input
          className="input"
          type="time"
          aria-label={L('Time', 'الوقت')}
          value={time}
          onChange={e => setTime(e.target.value)}
        />
        <button
          className="btn btn-secondary"
          disabled={!!busy || !day}
          onClick={() =>
            run(
              'confirm-date',
              () =>
                act(id, version, 'confirm-date', {
                  confirmedDate: new Date(`${day}T${time || '09:00'}`).toISOString()
                }),
              L('Date confirmed', 'أُكّد الموعد')
            )
          }
        >
          {L('Confirm date', 'تأكيد الموعد')}
        </button>
      </div>
      <span className="help">
        {L(
          'Needs every required checklist item received, and for a sacrament the priest’s approval.',
          'يتطلب استلام كل بنود القائمة المطلوبة، وموافقة الكاهن إذا كان سرّاً.'
        )}
      </span>
    </div>
  );
}

/* Match the case to a person already in People. The evidence is the identity check the office made. */
function Matching({ run, id, version, busy }) {
  const [who, setWho] = useState(''),
    [evidence, setEvidence] = useState('');
  return (
    <details>
      <summary>{L('Match to a person record', 'ربط بسجل شخص')}</summary>
      <div className="formrow">
        <Select value={who} onChange={e => setWho(e.target.value)} aria-label={L('Person', 'الشخص')}>
          <option value="">{L('Choose a person', 'اختر شخصاً')}</option>
          {PEOPLE.map(p => (
            <option key={p.id} value={p.id}>
              {p.lat || p.ar}
            </option>
          ))}
        </Select>
        <textarea
          className="textarea"
          rows="2"
          maxLength="1000"
          placeholder={L('How you checked this is the right person', 'كيف تحققت أنه الشخص الصحيح')}
          value={evidence}
          onChange={e => setEvidence(e.target.value)}
        />
        <button
          className="btn btn-secondary"
          disabled={!!busy || !who || !evidence.trim()}
          onClick={() =>
            run(
              'match',
              () => act(id, version, 'match-subject', { subjectPersonId: who, authorityEvidence: evidence.trim() }),
              L('Matched', 'تم الربط')
            )
          }
        >
          {L('Match', 'ربط')}
        </button>
      </div>
    </details>
  );
}

function Authority({ run, id, version, busy }) {
  const [evidence, setEvidence] = useState('');
  return (
    <div className="formrow">
      <label className="label" htmlFor="rc-authority">
        {L('Review the requester’s authority', 'مراجعة صلاحية مقدّم الطلب')}
      </label>
      <textarea
        className="textarea"
        id="rc-authority"
        rows="2"
        maxLength="1000"
        placeholder={L(
          'What you checked (relationship, documents seen)',
          'ما تحققت منه (القرابة، المستندات المطّلع عليها)'
        )}
        value={evidence}
        onChange={e => setEvidence(e.target.value)}
      />
      <button
        className="btn btn-secondary"
        disabled={!!busy || !evidence.trim()}
        onClick={() =>
          run(
            'authority',
            () => act(id, version, 'review-authority', { authorityEvidence: evidence.trim() }),
            L('Authority reviewed', 'روجعت الصلاحية')
          )
        }
      >
        {L('Record the review', 'تسجيل المراجعة')}
      </button>
    </div>
  );
}

/* How urgent it is, by when, what comes next, and who has it. */
function Triage({ run, id, version, busy, dto }) {
  const [urgency, setUrgency] = useState(dto.urgency || 'Normal'),
    [reason, setReason] = useState(dto.urgencyReason || ''),
    [deadline, setDeadline] = useState(dto.deadline ? dto.deadline.slice(0, 10) : ''),
    [next, setNext] = useState(dto.nextAction || ''),
    [mine, setMine] = useState(false);
  const me = session.accountUser?.id;
  return (
    <details className="or-section">
      <summary>{L('Priority, deadline and who has it', 'الأولوية والموعد النهائي والمسؤول')}</summary>
      <div className="formrow">
        <Select value={urgency} onChange={e => setUrgency(e.target.value)} aria-label={L('Priority', 'الأولوية')}>
          <option value="Normal">{L('Normal', 'عادي')}</option>
          <option value="Urgent">{L('Urgent', 'عاجل')}</option>
        </Select>
        {urgency === 'Urgent' ? (
          <input
            className="input"
            maxLength="500"
            placeholder={L('Why it is urgent', 'سبب الاستعجال')}
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        ) : null}
        <input
          className="input"
          type="date"
          aria-label={L('Deadline', 'الموعد النهائي')}
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
        />
        <input
          className="input"
          maxLength="500"
          placeholder={L('Next action', 'الخطوة التالية')}
          value={next}
          onChange={e => setNext(e.target.value)}
        />
        {me ? (
          <label className="check">
            <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />
            {L('Assign to me', 'إسناد إليّ')}
          </label>
        ) : null}
        <button
          className="btn btn-secondary"
          disabled={!!busy || (urgency === 'Urgent' && !reason.trim())}
          onClick={() =>
            run(
              'triage',
              () =>
                act(id, version, 'triage', {
                  urgency,
                  urgencyReason: urgency === 'Urgent' ? reason.trim() : '',
                  deadline: deadline ? new Date(`${deadline}T23:59:00`).toISOString() : '',
                  nextAction: next.trim(),
                  assignedTo: mine ? me : ''
                }),
              L('Saved', 'تم الحفظ')
            )
          }
        >
          {L('Save', 'حفظ')}
        </button>
      </div>
    </details>
  );
}

/* What the applicant can read, and the office's private notes. */
function Messages({ id, messages, canAct, run, busy }) {
  const [audience, setAudience] = useState('Applicant'),
    [body, setBody] = useState('');
  return (
    <section className="or-section" aria-labelledby="rc-messages">
      <h3 id="rc-messages">{L('Messages', 'الرسائل')}</h3>
      {messages.length ? (
        messages.map(m => (
          <blockquote key={m.id} className="or-quote">
            <span>
              {m.audience === 'Internal'
                ? L('Office note, not shown to the applicant', 'ملاحظة للمكتب، لا يراها مقدّم الطلب')
                : L('Visible to the applicant', 'يراها مقدّم الطلب')}{' '}
              · {(m.authorAccountId && nameOf(session.parishId, m.authorAccountId)) || m.authorKind} · {fmtStamp(m.at)}
            </span>
            <p>
              <bdi>{m.body}</bdi>
            </p>
          </blockquote>
        ))
      ) : (
        <p className="help">{L('No messages.', 'لا رسائل.')}</p>
      )}
      {canAct ? (
        <div className="formrow">
          <Select
            value={audience}
            onChange={e => setAudience(e.target.value)}
            aria-label={L('Who can read it', 'من يقرأها')}
          >
            <option value="Applicant">{L('Applicant can read it', 'يقرؤها مقدّم الطلب')}</option>
            <option value="Internal">{L('Office note', 'ملاحظة للمكتب')}</option>
          </Select>
          <textarea
            className="textarea"
            rows="2"
            maxLength="4000"
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <button
            className="btn btn-secondary"
            disabled={!!busy || !body.trim()}
            onClick={async () => {
              if (
                await run('message', () => postMessage(id, audience, body.trim()), L('Message saved', 'حُفظت الرسالة'))
              )
                setBody('');
            }}
          >
            {L('Add message', 'إضافة رسالة')}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/* A13: an account that holds the guest's tracking link asks to join the case; the office decides after
   checking identity. A leaked link is replaced here, and the new one is shown once. */
function GuestLink({ dto, id, version, run, busy, fresh, setFresh }) {
  const [text, setText] = useState(''),
    [reason, setReason] = useState('');
  const linked = !!dto.applicantAccountId;
  return (
    <section className="or-section" aria-labelledby="rc-guest">
      <h3 id="rc-guest">{L('Tracking link and account', 'رابط المتابعة والحساب')}</h3>
      {dto.claimantAccountId ? (
        <div className="formrow">
          <p>
            {L(
              'An account holder with the tracking link asked to link this request to their account. Compare their identity with the original applicant before approving. A different reviewer from the account holder must decide.',
              'طلب صاحب حساب يحمل رابط المتابعة ربط هذا الطلب بحسابه. قارن هويته بمقدّم الطلب الأصلي قبل الموافقة. يقرّر مراجع آخر غير صاحب الحساب.'
            )}
          </p>
          <textarea
            className="textarea"
            rows="2"
            maxLength="1000"
            placeholder={L(
              'Identity check made (to approve), or the reason (to decline)',
              'التحقق من الهوية (للموافقة) أو السبب (للرفض)'
            )}
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div className="account-actions">
            <button
              className="btn btn-primary"
              disabled={!!busy || !text.trim()}
              onClick={() =>
                run(
                  'approve',
                  () => decideAssociation(id, version, true, text.trim()),
                  L('Account linked', 'رُبط الحساب')
                )
              }
            >
              {L('Approve link', 'الموافقة على الربط')}
            </button>
            <button
              className="btn btn-secondary"
              disabled={!!busy || !text.trim()}
              onClick={() =>
                run(
                  'decline',
                  () => decideAssociation(id, version, false, text.trim()),
                  L('Link declined', 'رُفض الربط')
                )
              }
            >
              {L('Decline', 'رفض')}
            </button>
          </div>
        </div>
      ) : linked ? (
        <p className="help">
          {L(
            'This request now belongs to an account, so the tracking link no longer works.',
            'أصبح هذا الطلب تابعاً لحساب، فلم يعد رابط المتابعة يعمل.'
          )}
        </p>
      ) : (
        <p className="help">
          {L('No account has asked to join this request.', 'لم يطلب أي حساب الانضمام إلى هذا الطلب.')}
        </p>
      )}
      {!linked ? (
        <div className="formrow">
          <label className="label" htmlFor="rc-rotate">
            {L('Replace a leaked tracking link', 'استبدال رابط متابعة مسرَّب')}
          </label>
          <input
            className="input"
            id="rc-rotate"
            maxLength="1000"
            placeholder={L('Why (after checking who is asking)', 'السبب (بعد التحقق ممن يطلب)')}
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <button
            className="btn btn-secondary"
            disabled={!!busy || !reason.trim()}
            onClick={async () => {
              const receipt = await run('rotate', () => rotateTracking(id, version, reason.trim()));
              if (receipt) {
                setFresh(trackingLink(receipt, session.parishId));
                setReason('');
              }
            }}
          >
            {L('Replace the link', 'استبدال الرابط')}
          </button>
          <span className="help">
            {L('The old link stops working at once.', 'يتوقف الرابط القديم عن العمل فوراً.')}
          </span>
          {fresh ? (
            <label className="rq-link">
              <span>
                {L(
                  'New private link, shown once. Pass it on to the applicant.',
                  'الرابط الخاص الجديد، يظهر مرة واحدة. سلّمه لمقدّم الطلب.'
                )}
              </span>
              <input readOnly dir="ltr" className="input" value={fresh} onFocus={e => e.target.select()} />
            </label>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/* The drawer both queues open. `onChange` runs after any saved change. */
export function openRequestCase(id, onChange) {
  openDrawer({
    large: true,
    title: L('Request', 'طلب'),
    body: <RequestCase key={id} id={id} onChange={onChange} />,
    foot: (
      <button className="btn btn-secondary" onClick={closeOverlays}>
        {L('Close', 'إغلاق')}
      </button>
    )
  });
}
