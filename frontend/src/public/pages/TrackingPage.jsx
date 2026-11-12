/* Following a request with its private link: where it stands, what the parish office answered, and a way
   to write back. The link is `public.html#track=<parishId>.<requestId>.<token>`; the token goes to the API in
   a header, never in an address the server sees (model/guest-requests.js).

   What the API shows a guest is the case's status, the office's message for the applicant and the
   messages exchanged. Files and signed letters are not shown to guests: the API keeps files private to the
   office and signed-in applicants. */
import { useEffect, useState } from 'react';
import { useSite } from '../site.jsx';
import { parseTracking, guestCase, guestMessages, guestPostMessage } from '../../portal/model/guest-requests.js';

/* [headline, what it means for the applicant] */
const STATUS = {
  Received: [
    ['Sent to the parish office', 'أُرسل إلى مكتب الرعية'],
    ['The office has it and has not accepted it yet.', 'وصل الطلب إلى المكتب ولم يُقبل بعد.']
  ],
  NeedsInformation: [
    ['The parish needs more information', 'تحتاج الرعية إلى معلومات إضافية'],
    ['Write to the office below. The request is not declined.', 'اكتب إلى المكتب أدناه. لم يُرفض الطلب.']
  ],
  AcceptedForProcessing: [
    ['Accepted by the parish office', 'قبله مكتب الرعية'],
    ['The office is working on it.', 'يعمل المكتب على الطلب.']
  ],
  CancellationRequested: [
    ['Cancellation requested', 'طُلب الإلغاء'],
    ['The office will review the cancellation.', 'سيراجع المكتب طلب الإلغاء.']
  ],
  Completed: [
    ['Completed', 'مكتمل'],
    ['The parish has completed this request.', 'أنجزت الرعية هذا الطلب.']
  ],
  Declined: [
    ['Not accepted', 'لم يُقبل'],
    ['The parish could not accept this request.', 'تعذّر على الرعية قبول هذا الطلب.']
  ],
  Withdrawn: [
    ['Withdrawn', 'مسحوب'],
    ['This request was withdrawn.', 'سُحب هذا الطلب.']
  ],
  Cancelled: [
    ['Cancelled', 'أُلغي'],
    ['This request was cancelled.', 'أُلغي هذا الطلب.']
  ]
};

const TRACK_STEPS = [
  ['sent', 'Sent', 'أُرسل'],
  ['accepted', 'Accepted', 'قُبل'],
  ['date', 'Date confirmed', 'الموعد مؤكَّد'],
  ['done', 'Closed', 'مُغلق']
];
const stepOf = d =>
  ['Completed', 'Declined', 'Withdrawn', 'Cancelled'].includes(d.status)
    ? 3
    : d.status === 'AcceptedForProcessing'
      ? d.confirmedDate
        ? 2
        : 1
      : d.status === 'Received'
        ? 0
        : 1;

/* The private tracking page: where the request stands, as four steps, and the messages. */
export function TrackingPage({ token }) {
  const { L, lang } = useSite();
  const link = parseTracking(token);
  const [state, setState] = useState({ loading: true });
  const [text, setText] = useState(''),
    [sending, setSending] = useState(false),
    [problem, setProblem] = useState(''),
    [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    (async () => {
      if (!link) return setState({ error: L('This tracking link is not valid.', 'رابط المتابعة هذا غير صالح.') });
      try {
        const [data, messages] = await Promise.all([guestCase(link), guestMessages(link)]);
        if (live) setState({ data, messages });
      } catch (e) {
        if (live) setState({ error: e.message });
      }
    })();
    return () => {
      live = false;
    };
  }, [token, round]);
  const d = state.data;
  if (!d)
    return (
      <section className="track site-wrap">
        <div className="track-card">
          <span className="track-lamp" aria-hidden="true"></span>
          <h1>{L('Your request', 'طلبك')}</h1>
          <p role="status">{state.error ?? L('Loading…', 'جارٍ التحميل…')}</p>
        </div>
      </section>
    );
  const updated = new Date(d.updatedAt),
    [headline, meaning] = STATUS[d.status] || [
      [d.status, d.status],
      ['', '']
    ],
    at = stepOf(d),
    warn = d.status === 'NeedsInformation';
  const stamp = v =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(
      new Date(v)
    );
  const closed = ['Completed', 'Declined', 'Withdrawn', 'Cancelled'].includes(d.status);
  const send = async e => {
    e.preventDefault();
    setSending(true);
    setProblem('');
    try {
      await guestPostMessage(link, text.trim());
      setText('');
      setRound(n => n + 1);
    } catch (err) {
      setProblem(err.message);
    } finally {
      setSending(false);
    }
  };
  return (
    <section className="track site-wrap">
      <div className="track-card">
        <span className="track-lamp" aria-hidden="true"></span>
        <h1>{L('Your request', 'طلبك')}</h1>
        <p>
          <bdi dir="ltr">{d.reference}</bdi>
        </p>
        <ol className="track-steps">
          {TRACK_STEPS.map(([k, en, ar], i) => (
            <li
              key={k}
              className={i < at ? 'is-done' : i === at ? 'is-current' + (warn ? ' is-warn' : '') : undefined}
              aria-current={i === at ? 'step' : undefined}
            >
              <span aria-hidden="true"></span>
              {L(en, ar)}
            </li>
          ))}
        </ol>
        <h2>{L(...headline)}</h2>
        <p dir="auto">{d.applicantExplanation || L(...meaning)}</p>
        {d.confirmedDate ? (
          <p>
            {L('Date confirmed: ', 'الموعد المؤكَّد: ')}
            {stamp(d.confirmedDate)}
          </p>
        ) : null}
        {Number.isNaN(updated.valueOf()) ? null : <small>{L('Updated ', 'آخر تحديث: ') + stamp(updated)}</small>}
        <p className="track-note">
          {L(
            'Keep this page’s link private: anyone who has it can see this request.',
            'احتفظ برابط هذه الصفحة لنفسك: يستطيع كل من يملكه رؤية هذا الطلب.'
          )}
        </p>
      </div>
      <div className="track-card">
        <h2>{L('Messages with the parish office', 'الرسائل مع مكتب الرعية')}</h2>
        {state.messages.length ? (
          state.messages.map(m => (
            <blockquote key={m.id} className="letter-body" dir="auto">
              <small>
                {m.authorKind === 'Office' ? L('Parish office', 'مكتب الرعية') : L('You', 'أنت')} · {stamp(m.at)}
              </small>
              <p>{m.body}</p>
            </blockquote>
          ))
        ) : (
          <p>{L('No messages yet.', 'لا رسائل بعد.')}</p>
        )}
        {closed ? (
          <p>{L('This request is closed. Contact the parish office.', 'هذا الطلب مغلق. تواصل مع مكتب الرعية.')}</p>
        ) : (
          <form onSubmit={send}>
            <label className="rq-field">
              <span>{L('Write to the office', 'اكتب إلى المكتب')}</span>
              <textarea required maxLength="4000" rows="4" value={text} onChange={e => setText(e.target.value)} />
            </label>
            <p className="rq-error" role="alert">
              {problem}
            </p>
            <button className="btn btn-gilt" type="submit" disabled={sending || !text.trim()}>
              {L('Send', 'إرسال')}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
