/* Purpose: what a member can do with a request that is already with the parish, besides watching it:
   answer a request for information, ask to cancel an accepted one, exchange messages with the office
   and add files. Main function: Follow.

   Calls (model/modules/requests.js): the applicant actions respond and request-cancel, the messages
   the office marks as visible to the applicant, and the case's private files. */
import { useEffect, useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { session } from '../../model/api.js';
import { bus } from '../../model/store.js';
import { hydrate } from '../../model/persist.js';
import { toast } from '../../ui/ui.jsx';
import { act, getMessages, postMessage } from '../../model/modules/requests.js';
import { fmtStamp } from '../../model/sacrament-requests.js';
import { RequestDocuments } from '../records/request-documents.jsx';
import { MyRequestLetters } from './request-letters-mine.jsx';

const L = (en, ar) => t(en, ar);

export function Follow({ r }) {
  const [messages, setMessages] = useState(null),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [round, setRound] = useState(0);
  useEffect(() => {
    getMessages(r.id).then(setMessages, () => setMessages([]));
  }, [r.id, round]);
  const redraw = async () => {
    await hydrate();
    if (session.user?.role === 'member') bus.renderAll();
    else bus.refresh();
  };
  const run = async (work, done) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      setText('');
      setRound(n => n + 1);
      if (done) toast(done, '', 'success');
      await redraw();
    } catch (error) {
      toast(L('Could not send', 'تعذّر الإرسال'), error.message, 'danger');
    } finally {
      setBusy(false);
    }
  };
  const open = r.progress.stage !== 'completed' && !['declined', 'cancelled', 'withdrawn'].includes(r.progress.stage);
  return (
    <section className="member-card mr-messages" aria-labelledby="mr-messages-title">
      <h2 id="mr-messages-title">{L('Messages with the parish office', 'الرسائل مع مكتب الرعية')}</h2>
      {messages === null ? (
        <p className="help">{L('Loading…', 'جارٍ التحميل…')}</p>
      ) : messages.length ? (
        messages.map(m => (
          <blockquote key={m.id} className="mr-quote">
            <span className="lbl">
              {m.authorKind === 'Office' ? L('Parish office', 'مكتب الرعية') : L('You', 'أنت')} · {fmtStamp(m.at)}
            </span>
            <p>
              <bdi>{m.body}</bdi>
            </p>
          </blockquote>
        ))
      ) : (
        <p className="help">{L('No messages yet.', 'لا رسائل بعد.')}</p>
      )}
      {open ? (
        <div className="formrow">
          <label className="label" htmlFor="mr-reply">
            {r.canReply
              ? L('Your answer to the parish', 'جوابك للرعية')
              : L('Write to the parish office', 'اكتب إلى مكتب الرعية')}
          </label>
          <textarea
            className="textarea"
            id="mr-reply"
            rows="3"
            maxLength={r.canReply ? 2000 : 4000}
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div className="account-actions">
            {r.canReply ? (
              <button
                className="btn btn-primary"
                disabled={busy || !text.trim()}
                onClick={() =>
                  run(
                    () => act(r.id, r.api.version, 'respond', { explanation: text.trim() }),
                    L('Answer sent', 'أُرسل الجواب')
                  )
                }
              >
                {L('Send answer', 'إرسال الجواب')}
              </button>
            ) : null}
            <button
              className="btn btn-secondary"
              disabled={busy || !text.trim()}
              onClick={() =>
                run(() => postMessage(r.id, 'Applicant', text.trim()), L('Message sent', 'أُرسلت الرسالة'))
              }
            >
              {L('Send message', 'إرسال رسالة')}
            </button>
            {r.canRequestCancel ? (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    () => act(r.id, r.api.version, 'request-cancel', { explanation: text.trim() }),
                    L('Cancellation requested', 'طُلب الإلغاء')
                  )
                }
              >
                {L('Ask to cancel', 'طلب الإلغاء')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <RequestDocuments applicant record={{ id: r.id, open }} scope="request" onChange={() => redraw()} />
      <MyRequestLetters id={r.id} />
    </section>
  );
}
