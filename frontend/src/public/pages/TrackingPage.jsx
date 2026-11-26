/* Following a request with its private link: where it stands, what the parish office answered, and a way
   to write back. The link is `public.html#track=<parishId>.<requestId>.<token>`; the token goes to the API in
   a header, never in an address the server sees (model/guest-requests.js).

   What the API shows a guest is the case's status, the office's message for the applicant, the messages
   exchanged, the checklist of what the office needs, the files the guest added (names only: nothing
   downloads through the bearer link) and the office's released letters by title and status. A letter's
   text and code are never shown here: the guest collects it in person or links the request to an account.
   Design A3: a title band with where the request stands (a pill, the four steps), then the messages beside
   the documents at equal height, and the letters beside the note to keep the link private.
   Main functions: TrackingPage, GuestDocuments, GuestLetters. */
import { useEffect, useState } from 'react';
import { useSite } from '../site.jsx';
import { A3Icon, Band, Select } from '../components/a3.jsx';
import {
  parseTracking,
  guestCase,
  guestMessages,
  guestPostMessage,
  guestFiles,
  guestUpload,
  guestLetters
} from '../../portal/model/guest-requests.js';

const TYPES = /\.(pdf|png|jpe?g)$/i;

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

/* The private tracking page: where the request stands, as four steps, the messages and the documents. */
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
        const [data, messages, files, letters] = await Promise.all([
          guestCase(link),
          guestMessages(link),
          guestFiles(link).catch(() => []),
          guestLetters(link).catch(() => [])
        ]);
        if (live) setState({ data, messages, files, letters });
      } catch (e) {
        if (live) setState({ error: e.message });
      }
    })();
    return () => {
      live = false;
    };
  }, [token, round]);
  const crumbs = [['ParishLife', 'public.html'], [L('Your request', 'طلبك')]];
  const d = state.data;
  if (!d)
    return (
      <Band L={L} crumbs={crumbs} title={L('Your request', 'طلبك')}>
        <p className={state.error ? 'notice' : 'lede'} role="status" style={{ marginTop: 18 }}>
          {state.error ?? L('Loading…', 'جارٍ التحميل…')}
        </p>
      </Band>
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
    <div className="track-page">
      <Band
        L={L}
        crumbs={crumbs}
        title={L('Your request', 'طلبك')}
        lede={
          <>
            {L('Reference ', 'المرجع ')}
            <bdi dir="ltr">{d.reference}</bdi>
            {Number.isNaN(updated.valueOf())
              ? ''
              : L(`. Updated ${stamp(updated)}.`, `. آخر تحديث: ${stamp(updated)}.`)}
          </>
        }
      >
        <div className={'card status-card ' + (warn ? 't-rose' : 't-gold')}>
          <span className={'pill ' + (closed ? (d.status === 'Completed' ? 'ok' : 'optl') : warn ? 'need' : 'prog')}>
            {L(...headline)}
          </span>
          <span dir="auto">{d.applicantExplanation || L(...meaning)}</span>
          {d.confirmedDate ? (
            <strong className="time">
              {L('Date confirmed: ', 'الموعد المؤكَّد: ')}
              {stamp(d.confirmedDate)}
            </strong>
          ) : null}
        </div>
        <ol className="tracker" aria-label={L('Progress', 'مراحل الطلب')}>
          {TRACK_STEPS.map(([k, en, ar], i) => (
            <li
              key={k}
              className={i < at ? 'done' : i === at ? 'now' + (warn ? ' warn' : '') : undefined}
              aria-current={i === at ? 'step' : undefined}
            >
              {L(en, ar)}
              <small>{i < at ? L('Done', 'تمّ') : i === at ? L('Now', 'الآن') : L('Not yet', 'ليس بعد')}</small>
            </li>
          ))}
        </ol>
      </Band>
      <section className="wrap track-body">
        <div className="duo">
          <section className="card stack" aria-labelledby="tr-msg">
            <h2 id="tr-msg" className="h3">
              {L('Messages with the parish office', 'الرسائل مع مكتب الرعية')}
            </h2>
            {state.messages.length ? (
              <ol className="thread">
                {state.messages.map(m => (
                  <li key={m.id} className={'msg' + (m.authorKind === 'Office' ? '' : ' me')}>
                    <span className="who">
                      {m.authorKind === 'Office' ? L('Parish office', 'مكتب الرعية') : L('You', 'أنت')}
                      {L(', ', '، ')}
                      {stamp(m.at)}
                    </span>
                    <p dir="auto">{m.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="d" style={{ margin: '12px 0 18px' }}>
                {L('No messages yet.', 'لا رسائل بعد.')}
              </p>
            )}
            {closed ? (
              <p className="d" style={{ marginTop: 'auto' }}>
                {L('This request is closed. Contact the parish office.', 'هذا الطلب مغلق. تواصل مع مكتب الرعية.')}
              </p>
            ) : (
              <form onSubmit={send} style={{ marginTop: 'auto' }}>
                <label className="lbl" htmlFor="tr-write">
                  {L('Write to the office', 'اكتب إلى المكتب')}
                </label>
                <textarea
                  id="tr-write"
                  className="field"
                  required
                  maxLength="4000"
                  value={text}
                  onChange={e => setText(e.target.value)}
                />
                {problem ? (
                  <p className="notice" role="alert" style={{ marginTop: 12 }}>
                    {problem}
                  </p>
                ) : null}
                <button
                  className="btn btn-red"
                  type="submit"
                  disabled={sending || !text.trim()}
                  style={{ marginTop: 14 }}
                >
                  <A3Icon name="send" />
                  {L('Send', 'إرسال')}
                </button>
              </form>
            )}
          </section>
          <GuestDocuments
            link={link}
            checklist={d.checklist || []}
            files={state.files}
            closed={closed}
            stamp={stamp}
            done={() => setRound(n => n + 1)}
          />
        </div>
        <div className={state.letters.length ? 'duo' : ''} style={{ marginTop: 20 }}>
          <GuestLetters letters={state.letters} stamp={stamp} />
          <div className="card t-sage note">
            <span className="ic" aria-hidden="true">
              <A3Icon name="lock" />
            </span>
            <p>
              <strong>{L('Keep this link private.', 'احتفظ بهذا الرابط لنفسك.')}</strong>{' '}
              {L('Anyone who has it can see this request.', 'يستطيع كل من يملكه رؤية هذا الطلب.')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* What the office asked for, and the files the guest added. A file may name the item it answers; the office
   still decides whether the item is received. */
function GuestDocuments({ link, checklist, files, closed, stamp, done }) {
  const { L } = useSite();
  const [item, setItem] = useState(''),
    [busy, setBusy] = useState(false),
    [problem, setProblem] = useState('');
  const label = key => checklist.find(c => c.key === key)?.label || '';
  const take = async file => {
    if (!file) return;
    if (!TYPES.test(file.name) || !file.size || file.size > 10_000_000)
      return setProblem(L('Choose a PDF, JPG or PNG up to 10 MB.', 'اختر PDF أو JPG أو PNG حتى ١٠ ميغابايت.'));
    setBusy(true);
    setProblem('');
    try {
      await guestUpload(link, file, { checklistKey: item });
      done();
    } catch (err) {
      setProblem(err.message);
    } finally {
      setBusy(false);
    }
  };
  const pill = c =>
    c.status === 'Received' ? (
      <span className="pill ok">
        <A3Icon name="check" />
        {L('received', 'مستلم')}
      </span>
    ) : c.status === 'NotApplicable' ? (
      <span className="pill optl">{L('not needed', 'غير مطلوب')}</span>
    ) : c.required ? (
      <span className="pill need">{L('still needed', 'ما زال مطلوباً')}</span>
    ) : (
      <span className="pill optl">{L('optional', 'اختياري')}</span>
    );
  const fileState = f =>
    f.status === 'Active'
      ? ''
      : L(', ', '، ') + (f.status === 'Replaced' ? L('replaced', 'استُبدل') : L('removed', 'أُزيل'));
  return (
    <section className="card stack" aria-labelledby="tr-docs" data-guest-documents="">
      <h2 id="tr-docs" className="h3">
        {L('Documents', 'المستندات')}
      </h2>
      {checklist.length ? (
        <ul className="docs">
          {checklist.map(c => (
            <li key={c.key}>
              <bdi>{c.label}</bdi>
              {pill(c)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="d" style={{ margin: '12px 0 0' }}>
          {L('The office has not listed any documents.', 'لم يحدّد المكتب أي مستندات.')}
        </p>
      )}
      {closed ? null : (
        <>
          <h3 className="t" style={{ margin: '22px 0 6px' }}>
            {L('Send a file to the office', 'أرسل ملفاً إلى المكتب')}
          </h3>
          <p className="hint">
            {L(
              'PDF, JPG or PNG up to 10 MB. Only the parish office can open what you send; this page lists the names.',
              'PDF أو JPG أو PNG حتى ١٠ ميغابايت. لا يفتح ما ترسله إلا مكتب الرعية؛ تعرض هذه الصفحة الأسماء فقط.'
            )}
          </p>
          {checklist.length ? (
            <Select
              id="tr-item"
              label={L('This file is for', 'هذا الملف لـ')}
              value={item}
              options={[
                { value: '', label: L('No particular item', 'لا بند محدّد') },
                ...checklist.map(c => ({ value: c.key, label: c.label }))
              ]}
              onChange={setItem}
            />
          ) : null}
          <label className="filepick">
            <input
              type="file"
              className="sr-only"
              disabled={busy}
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                take(file);
              }}
            />
            <span className="btn btn-soft">
              <A3Icon name="upload" />
              {busy ? L('Sending…', 'جارٍ الإرسال…') : L('Choose a file', 'اختر ملفاً')}
            </span>
          </label>
          {problem ? (
            <p className="notice" role="alert" style={{ marginTop: 12 }}>
              {problem}
            </p>
          ) : null}
        </>
      )}
      {files.length ? (
        <>
          <h3 className="t" style={{ margin: '22px 0 6px' }}>
            {L('Files you sent', 'الملفات التي أرسلتها')}
          </h3>
          <ul className="files">
            {files.map(f => (
              <li key={f.id}>
                <A3Icon name="file" />
                <span>
                  <bdi>{f.fileName}</bdi>
                  <span className="d">
                    {' '}
                    {stamp(f.uploadedAt)}
                    {f.checklistKey ? (
                      <>
                        {L(', ', '، ')}
                        <bdi>{label(f.checklistKey)}</bdi>
                      </>
                    ) : null}
                    {fileState(f)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

/* Letters the office released for this request: title and status only. */
function GuestLetters({ letters, stamp }) {
  const { L } = useSite();
  if (!letters.length) return null;
  return (
    <section className="card t-gold letters" aria-labelledby="tr-letters" data-guest-letters="">
      <h2 id="tr-letters" className="h3">
        {L('Letters from the parish', 'رسائل من الرعية')}
      </h2>
      <ul className="docs">
        {letters.map(l => (
          <li key={l.reference + '.' + l.version}>
            <span>
              <bdi>{l.title}</bdi>{' '}
              <bdi dir="ltr" className="d">
                {l.reference}
              </bdi>
              {l.releasedAt ? <span className="d">{' ' + stamp(l.releasedAt)}</span> : null}
              {l.statement ? (
                <small className="d" dir="auto" style={{ display: 'block' }}>
                  {l.statement}
                </small>
              ) : null}
            </span>
            <span className={'pill ' + (l.status === 'Withdrawn' ? 'optl' : 'ok')}>
              {l.status === 'Withdrawn'
                ? L('withdrawn', 'مسحوبة')
                : l.releaseMethod === 'InPerson'
                  ? L('collect in person', 'تُستلم شخصياً')
                  : L('released', 'صادرة')}
            </span>
          </li>
        ))}
      </ul>
      <p className="d" style={{ margin: '12px 0 0' }}>
        {L(
          'The letter itself is not shown through this link. Collect it from the parish office, or link this request to an account.',
          'لا تظهر الرسالة نفسها عبر هذا الرابط. استلمها من مكتب الرعية، أو اربط هذا الطلب بحساب.'
        )}
      </p>
    </section>
  );
}
