/* Exact-message review (card N02): reports about one message, and a platform operator's request, independent
   approval, time-limited read and closing of a review of that one message. Only platform operators see it.
   Main members: ReviewsTab. Message text is shown only inside an approved access window, and only to the
   operator who asked; nothing here browses an inbox. */
import { useEffect, useState } from 'react';
import { t, fmtDate } from '../../../lib/i18n.js';
import { Pill, Empty, openModal, closeOverlays, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { session } from '../../model/api.js';
import {
  reviewQueue,
  requestReview,
  decideReview,
  readReviewedMessage,
  closeReview,
  closeReport
} from '../../model/modules/communications.js';
import { useSubmit } from './messaging-dialogs.jsx';

const L = (en, ar) => t(en, ar);
const when = iso => (iso ? fmtDate(iso.slice(0, 10)) : '—');

/* One small form in a modal: the fields, a button, and the API's own error if it refuses. */
function Ask({ fields, cta, danger = false, run }) {
  const { error, busy, submit } = useSubmit(async q => {
    await run(q);
    closeOverlays();
  });
  return (
    <form onSubmit={submit}>
      {fields}
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
        {cta}
      </button>
    </form>
  );
}
const Text = ({ name, label, rows = 3, max = 2000 }) => (
  <label className="formrow">
    <span className="label">{label}</span>
    <textarea className="textarea" name={name} required maxLength={max} rows={rows} />
  </label>
);
const ask = (title, props) => openModal({ title, body: <Ask {...props} /> });

export function ReviewsTab({ parishId }) {
  const [queue, setQueue] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    reviewQueue(parishId).then(
      r => live && setQueue(r),
      e => live && setError(e.message)
    );
    return () => {
      live = false;
    };
  }, [parishId, round]);
  const again = () => setRound(n => n + 1);
  const me = session.accountUser?.id;
  if (error) return <p className="help-error">{error}</p>;
  if (!queue) return <p className="help">{L('Loading…', 'جارٍ التحميل…')}</p>;
  const reports = queue.reports.map(r => r.value),
    versionOf = (list, id) => list.find(r => r.value.id === id)?.version;
  return (
    <>
      <C.InlineAlert
        tone="info"
        title={L('One message at a time, with a reason', 'رسالة واحدة في كل مرة وبسبب')}
        body={L(
          'A participant reports one message. An operator asks to read that exact message and says why; a different operator approves a short window or declines. Every read is recorded. People in the conversation cannot handle its review.',
          'يبلّغ مشارك عن رسالة واحدة. يطلب مشغّل قراءة هذه الرسالة بالذات ويذكر السبب، ويوافق مشغّل آخر على فترة قصيرة أو يرفض. تُسجَّل كل قراءة. لا يتولى مراجعة المحادثة من شارك فيها.'
        )}
      />
      <h2 style={{ marginTop: '20px' }}>{L('Reports', 'البلاغات')}</h2>
      {reports.length ? (
        reports.map(r => (
          <div key={r.id} className="listrow" style={{ alignItems: 'flex-start' }}>
            <span className="grow">
              <b dir="auto">{r.explanation}</b>
              <small>
                {when(r.createdAt)}
                {r.status === 'Closed' && r.reporterOutcome ? ` · ${r.reporterOutcome}` : ''}
              </small>
            </span>
            <Pill
              label={r.status === 'Closed' ? L('Closed', 'مغلق') : L('Received', 'مستلم')}
              tone={r.status === 'Closed' ? '' : 'warning'}
            />
            {r.status === 'Received' ? (
              <>
                <button
                  className="btn btn-secondary btn-dense"
                  onClick={() =>
                    ask(L('Ask to read this message', 'طلب قراءة هذه الرسالة'), {
                      cta: L('Ask for review', 'طلب المراجعة'),
                      fields: (
                        <Text
                          name="reason"
                          label={L('Why is this exact message needed?', 'لماذا تلزم هذه الرسالة بالذات؟')}
                        />
                      ),
                      run: async q => {
                        await requestReview(parishId, r, q.reason.trim());
                        again();
                      }
                    })
                  }
                >
                  {L('Ask to read it', 'طلب قراءتها')}
                </button>
                <button
                  className="btn btn-ghost btn-dense"
                  onClick={() =>
                    ask(L('Close this report', 'إغلاق هذا البلاغ'), {
                      cta: L('Close', 'إغلاق'),
                      fields: (
                        <>
                          <Text name="note" label={L('Closing note', 'ملاحظة الإغلاق')} />
                          <Text
                            name="outcome"
                            label={L('What the reporter is told', 'ما يُقال للمبلّغ')}
                            rows={2}
                            max={500}
                          />
                        </>
                      ),
                      run: async q => {
                        await closeReport(
                          parishId,
                          r.id,
                          versionOf(queue.reports, r.id),
                          q.note.trim(),
                          q.outcome.trim()
                        );
                        again();
                      }
                    })
                  }
                >
                  {L('Close', 'إغلاق')}
                </button>
              </>
            ) : null}
          </div>
        ))
      ) : (
        <Empty
          glyph="check"
          title={L('No reports', 'لا بلاغات')}
          body={L('Reports you may handle appear here.', 'تظهر هنا البلاغات التي يحق لك معالجتها.')}
        />
      )}
      <h2 style={{ marginTop: '24px' }}>{L('Review requests', 'طلبات المراجعة')}</h2>
      {queue.reviews.length ? (
        queue.reviews.map(({ value: v, version }) => (
          <div key={v.id} className="listrow" style={{ alignItems: 'flex-start' }}>
            <span className="grow">
              <b dir="auto">{v.reason}</b>
              <small>
                {when(v.requestedAt)}
                {v.accessUntil
                  ? ` · ${L('window until', 'النافذة حتى')} ${new Date(v.accessUntil).toLocaleString()}`
                  : ''}
                {v.readCount ? ` · ${L('read', 'قُرئت')} ${v.readCount}×` : ''}
                {v.decisionReason ? ` · ${v.decisionReason}` : ''}
              </small>
            </span>
            <Pill
              label={v.status}
              tone={v.status === 'Approved' ? 'success' : v.status === 'Requested' ? 'warning' : ''}
            />
            {v.status === 'Requested' && v.requestedBy !== me ? (
              <button
                className="btn btn-primary btn-dense"
                onClick={() =>
                  ask(L('Decide on this request', 'القرار في هذا الطلب'), {
                    cta: L('Save decision', 'حفظ القرار'),
                    fields: (
                      <>
                        <label className="formrow">
                          <span className="label">{L('Decision', 'القرار')}</span>
                          <select className="input" name="approve">
                            <option value="yes">{L('Approve a short window', 'الموافقة على فترة قصيرة')}</option>
                            <option value="no">{L('Decline', 'الرفض')}</option>
                          </select>
                        </label>
                        <label className="formrow">
                          <span className="label">
                            {L('Minutes of access (5 to 1440)', 'دقائق الوصول (٥ إلى ١٤٤٠)')}
                          </span>
                          <input className="input" name="minutes" type="number" min="5" max="1440" defaultValue="30" />
                        </label>
                        <Text name="reason" label={L('Reason for the decision', 'سبب القرار')} />
                      </>
                    ),
                    run: async q => {
                      await decideReview(
                        parishId,
                        v.id,
                        version,
                        q.approve === 'yes',
                        q.reason.trim(),
                        Number(q.minutes)
                      );
                      again();
                    }
                  })
                }
              >
                {L('Decide', 'قرار')}
              </button>
            ) : null}
            {v.status === 'Approved' && v.requestedBy === me ? (
              <button className="btn btn-secondary btn-dense" onClick={() => read(parishId, v, again)}>
                {L('Read the message', 'قراءة الرسالة')}
              </button>
            ) : null}
            {(v.status === 'Requested' || v.status === 'Approved') && (v.requestedBy === me || v.decidedBy === me) ? (
              <button
                className="btn btn-ghost btn-dense"
                onClick={() =>
                  ask(L('Close this review', 'إغلاق هذه المراجعة'), {
                    cta: L('Close', 'إغلاق'),
                    fields: (
                      <>
                        <Text name="note" label={L('Closing note', 'ملاحظة الإغلاق')} />
                        {v.reportId ? (
                          <Text
                            name="outcome"
                            label={L('What the reporter is told', 'ما يُقال للمبلّغ')}
                            rows={2}
                            max={500}
                          />
                        ) : null}
                      </>
                    ),
                    run: async q => {
                      await closeReview(parishId, v.id, version, q.note.trim(), q.outcome?.trim());
                      again();
                    }
                  })
                }
              >
                {L('Close', 'إغلاق')}
              </button>
            ) : null}
          </div>
        ))
      ) : (
        <Empty
          glyph="doc"
          title={L('No review requests', 'لا طلبات مراجعة')}
          body={L('Start one from a report above.', 'ابدأ واحداً من بلاغ أعلاه.')}
        />
      )}
    </>
  );
}

/* Each read is recorded by the API. The text is shown once, here, and not kept. */
async function read(parishId, review, again) {
  try {
    const m = await readReviewedMessage(parishId, review.id);
    openModal({
      title: L('The reported message', 'الرسالة المُبلَّغ عنها'),
      body: (
        <>
          <p className="help">
            {new Date(m.at).toLocaleString()} · {m.capacity}
          </p>
          <div className="message-body" style={{ whiteSpace: 'pre-wrap' }} dir="auto">
            {m.body}
          </div>
          <p className="help">
            {L('Available until', 'متاحة حتى')} {new Date(m.accessUntil).toLocaleString()}.{' '}
            {L('This read was recorded.', 'سُجّلت هذه القراءة.')}
          </p>
        </>
      )
    });
    again();
  } catch (error) {
    toast(L('Not available', 'غير متاحة'), error.message, 'danger');
  }
}
