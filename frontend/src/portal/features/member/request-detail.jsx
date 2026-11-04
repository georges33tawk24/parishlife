/* One of a member's requests: where it stands, what was sent, and what the office answered. */
import { t } from '../../../lib/i18n.js';
import { M } from '../../model/member-data.js';
import { S } from '../../model/store.js';
import { Icon, Pill } from '../../ui/ui.jsx';
import {
  kindOf,
  PURPOSES,
  topicText,
  fmtDay,
  fmtStamp,
  plannedText,
  stageInfo,
  CLOSED,
  stepsFor,
  stepsDone,
  stepTimes,
  nextText,
  eventLabel
} from '../../model/sacrament-requests.js';
import {
  OWN,
  aboutOf,
  back,
  nameOf,
  otherName,
  phoneLink,
  summaryList,
  summaryRows,
  titleOf,
  txt,
  venueName
} from './requests-shared.jsx';

const L = (en, ar) => t(en, ar);

/* ---- one request --------------------------------------------------------------- */
/* The request as the member wrote it, in the same shape as a draft, for the summary. */
const asDraft = r =>
  r.kind === 'booking'
    ? {
        kind: 'booking',
        venue: r.details.venue,
        date: r.details.date,
        from: r.details.from,
        to: r.details.to,
        occasion: r.details.occasion,
        occasionOther: '',
        guests: r.details.guests,
        phone: r.details.phone || '',
        notes: r.details.notes || ''
      }
    : r.kind === 'custom'
      ? {
          kind: 'custom',
          subjectText: topicText(r.details.subject),
          message: r.details.message,
          date: r.details.date || '',
          phone: r.details.phone || ''
        }
      : {
          ...r.details,
          kind: r.kind,
          subject: r.subject.new ? 'child' : r.subject.id,
          child: r.details.child || {},
          purpose: PURPOSES.some(x => x[0] === r.details.purpose)
            ? r.details.purpose
            : r.details.purpose
              ? 'other'
              : '',
          purposeOther: r.details.purpose,
          date: r.details.date || '',
          phone: r.details.phone || '',
          notes: r.details.notes || '',
          partner: r.details.partner || '',
          partnerParish: r.details.partnerParish || ''
        };

export function detailPage(id) {
  const r = M.requests.find(x => x.id === id);
  if (!r)
    return (
      <div className="member-page mr-page">
        {back()}
        <div className="member-empty">
          <p>{L('This request could not be found.', 'تعذّر العثور على هذا الطلب.')}</p>{' '}
          <a className="btn btn-secondary btn-dense" href="#/myrequests">
            {L('See all your requests', 'عرض كل طلباتك')}
          </a>
        </div>
      </div>
    );
  const p = r.progress,
    closed = CLOSED.has(p.stage),
    [label, tone, mark] = stageInfo(r);
  const steps = stepsFor(r),
    done = stepsDone(r),
    phone = M.requestOptions?.phone,
    times = stepTimes(r);
  /* under each step: when it happened, since when the current one has waited, or when the celebration is planned */
  const celebration = !['certificate', 'booking', 'custom'].includes(r.kind) && p.plannedDate ? 4 : -1;
  const stepNote = i => {
    if (i === celebration && !closed)
      return i < done ? plannedText(p) : `${L('Planned for', 'مقرّر في')} ${plannedText(p)}`;
    if (i < done) return times[i] ? fmtStamp(times[i]) : '';
    if (closed) return '';
    const since = i === done ? times.slice(0, i).reverse().find(Boolean) : '';
    return since ? `${L('Waiting since', 'بانتظار منذ')} ${fmtStamp(since)}` : '';
  };
  const quote = (title, text) =>
    text ? (
      <blockquote className="mr-quote">
        <span className="lbl">{title}</span>
        <p>{txt(text)}</p>
      </blockquote>
    ) : (
      ''
    );
  const dates =
    r.kind === 'booking'
      ? [
          [L('Date', 'التاريخ'), fmtDay(r.details.date)],
          [
            L('Time', 'الوقت'),
            <bdi dir="ltr">
              {txt(r.details.from)}–{txt(r.details.to)}
            </bdi>
          ],
          [L('Place', 'المكان'), venueName(r.details.venue)]
        ]
      : [
          p.preferredDate && [
            r.kind === 'custom' ? L('Day', 'اليوم') : L('Preferred date', 'التاريخ المفضّل'),
            fmtDay(p.preferredDate)
          ],
          p.plannedDate && [L('Planned for', 'الموعد المقرّر'), plannedText(p)],
          p.register && [
            L('Register entry', 'رقم القيد'),
            <bdi className="mono" dir="ltr">
              {txt(p.register)}
            </bdi>
          ]
        ].filter(Boolean);
  const required = p.preparation.filter(x => x.required);
  const certificateFor =
    p.stage === 'completed' && ['baptism', 'communion', 'confirmation', 'marriage'].includes(r.kind);
  const details = summaryRows(asDraft(r)).filter(([k]) => k !== L('Request', 'الطلب') || r.kind === 'custom');
  if (!OWN.has(r.kind) && !r.subject.new && !(M.requestOptions?.subjects || []).some(s => s.id === r.subject.id))
    details.unshift([L('For', 'لـ'), nameOf(r.subject)]);
  const about = OWN.has(r.kind) ? aboutOf(r) : nameOf(r.subject),
    aboutOther = OWN.has(r.kind) ? '' : otherName(r.subject);
  return (
    <div className="member-page mr-page">
      {back()}{' '}
      {S.ui.mrJustSent === r.id ? (
        <div className="mr-sent" role="status">
          <Icon name="check" size={20} />
          <div>
            <b>{L('Your request was sent', 'أُرسل طلبك')}</b>{' '}
            <p>
              {L(
                `The parish office has received it as ${r.reference}. You will see each update here and in your notifications.`,
                `استلمه مكتب الرعية برقم ${r.reference}. ستظهر كل التحديثات هنا وفي إشعاراتك.`
              )}
            </p>
          </div>
        </div>
      ) : (
        ''
      )}{' '}
      <header className="mr-detail-head">
        <span className="mr-head-icon" aria-hidden="true">
          <Icon name={kindOf(r.kind).icon} size={26} />
        </span>{' '}
        <div className="mr-detail-title">
          <h1>{txt(titleOf(r))}</h1>{' '}
          {about ? (
            <p>
              <span>{txt(about)}</span>
              {aboutOther ? <span className="dim">· {txt(aboutOther)}</span> : ''}
            </p>
          ) : (
            ''
          )}{' '}
          <p className="mr-detail-meta">
            <bdi className="mono" dir="ltr">
              {txt(r.reference)}
            </bdi>{' '}
            · {L('Sent', 'أُرسل')} {fmtStamp(r.createdAt)}
          </p>
        </div>{' '}
        <Pill label={label} tone={tone} mark={mark} />
      </header>{' '}
      <div className="mr-layout">
        <div className="mr-main">
          <section className="member-card mr-status" aria-labelledby="mr-status-title">
            <h2 id="mr-status-title">{L('Where your request stands', 'أين أصبح طلبك')}</h2>{' '}
            <ol className={`steps${closed ? ' closed' : ''}`}>
              {steps.map((s, i) => (
                <li key={i} className={i < done ? 'done' : i === done && !closed ? 'now' : ''}>
                  <span className="dot" aria-hidden="true">
                    {i < done ? <Icon name="check" size={13} /> : i + 1}
                  </span>
                  <span className="step-text">
                    <span className="lbl">{txt(s)}</span>
                    {stepNote(i) ? <span className="when">{txt(stepNote(i))}</span> : ''}
                  </span>{' '}
                  <span className="sr-only">
                    {i < done
                      ? L('done', 'منجز')
                      : i === done && !closed
                        ? L('current step', 'الخطوة الحالية')
                        : L('not yet', 'لم يحن بعد')}
                  </span>
                </li>
              ))}
            </ol>{' '}
            <div className={`mr-next${closed ? ' is-closed' : ''}`}>
              <span className="lbl">
                {closed
                  ? L('Status', 'الحالة')
                  : p.stage === 'completed' || p.stage === 'confirmed' || p.stage === 'ready'
                    ? L('Done', 'تمّ')
                    : L('What happens next', 'ما الخطوة التالية')}
              </span>
              <p>{txt(nextText(r))}</p>
            </div>{' '}
            {closed
              ? quote(L('Message from the parish office', 'رسالة من مكتب الرعية'), p.reason)
              : quote(L('Message from the parish office', 'رسالة من مكتب الرعية'), r.response)}{' '}
            {dates.length ? (
              <dl className="mr-dates">
                {dates.map(([k, v], i) => (
                  <div key={i}>
                    <dt>{txt(k)}</dt>
                    <dd>{v.startsWith('<bdi') ? v : txt(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              ''
            )}{' '}
            {certificateFor ? (
              <button type="button" className="btn btn-primary" data-mr-certificate={txt(r.kind)}>
                <Icon name="cert" size={16} />
                {L('Request a certificate', 'طلب شهادة')}
              </button>
            ) : (
              ''
            )}
          </section>{' '}
          {p.preparation.length ? (
            <section className="member-card mr-prep" aria-labelledby="mr-prep-title">
              <div className="mr-card-head">
                <h2 id="mr-prep-title">{L('Preparation', 'التحضير')}</h2>{' '}
                <span className="dim">
                  {L(
                    `${required.filter(x => x.done).length} of ${required.length} required done`,
                    `${required.filter(x => x.done).length} من ${required.length} من المطلوب منجز`
                  )}
                </span>
              </div>{' '}
              <ul className="mr-checklist">
                {p.preparation.map((x, i) => (
                  <li key={i} className={x.done ? 'done' : ''}>
                    <Icon name={x.done ? 'check' : 'doc'} size={16} />
                    <span>{txt(t(x.en, x.ar))}</span>{' '}
                    <small>
                      {x.done ? L('Done', 'منجز') : x.required ? L('Required', 'مطلوب') : L('Optional', 'اختياري')}
                    </small>
                  </li>
                ))}
              </ul>{' '}
              <p className="help">
                {L(
                  'The parish office ticks each item once it has what it needs. Bring documents to the office.',
                  'يؤشّر مكتب الرعية على كل بند عند استلام ما يلزم. أحضر المستندات إلى المكتب.'
                )}
              </p>
            </section>
          ) : (
            ''
          )}{' '}
          <section className="member-card mr-history" aria-labelledby="mr-history-title">
            <h2 id="mr-history-title">{L('History', 'السجلّ')}</h2>{' '}
            <ol className="mr-timeline">
              {p.events
                .slice()
                .reverse()
                .map((e, i) => (
                  <li key={i}>
                    <span className="mr-timeline-dot" aria-hidden="true" />
                    <span className="mr-timeline-what">{txt(eventLabel(e.key))}</span>
                    <time dateTime={txt(e.at)}>{fmtStamp(e.at)}</time>
                  </li>
                ))}
            </ol>
          </section>
        </div>{' '}
        <aside className="mr-aside">
          <section className="member-card">
            <h2>{L('Your request', 'طلبك')}</h2>
            {summaryList(details, ' mr-summary-compact')}
          </section>{' '}
          <section className="member-card">
            <h2>{L('Questions?', 'أسئلة؟')}</h2>
            <p className="mr-aside-text">
              {L(
                `Quote ${r.reference} when you contact the parish office.`,
                `اذكر الرقم ${r.reference} عند تواصلك مع مكتب الرعية.`
              )}
            </p>
            {phone ? phoneLink(phone) : ''}{' '}
            {r.canWithdraw ? (
              <div className="mr-withdraw">
                <p className="help">
                  {L(
                    'You can withdraw this request until the parish office reviews it.',
                    'يمكنك سحب هذا الطلب ما دام مكتب الرعية لم يراجعه بعد.'
                  )}
                </p>{' '}
                <button type="button" className="btn btn-secondary btn-dense" data-mr-withdraw={txt(r.id)}>
                  {L('Withdraw request', 'سحب الطلب')}
                </button>
              </div>
            ) : (
              ''
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
