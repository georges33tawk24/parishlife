/* Inbox (parish staff) and Messages (members): conversations with the parish office, the messages in
   each, reports about a message, and the broadcasts the parish stored for the signed-in member.
   Main members: InboxPage, Conversation, Compose.

   The API keeps conversations per parish; a member writes to the parish office, and office staff reply in
   it. Staff may also write directly to a linked parishioner. Senders are named through the shared
   account-name lookup (model/names.js) when the API lets this account see the name; otherwise a message
   shows "Parish office" or "Parishioner". A notice that a message arrived is stored in the app only; email, SMS and push are not
   set up, and the notice status says so in the API's own words. */
import { useEffect, useState } from 'react';
import { session } from '../../model/api.js';
import { t, fmtDate } from '../../../lib/i18n.js';
import { PageHead, openDrawer, closeOverlays, toast, Paged, Pill } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import {
  conversations,
  receivedBroadcasts,
  ownReports,
  messages as loadMessages,
  startConversation,
  postMessage,
  archiveConversation,
  conversationOutcome,
  messageOutcome,
  reportMessage
} from '../../model/modules/communications.js';
import { useSubmit } from './messaging-dialogs.jsx';
import { loadNames, nameOf } from '../../model/names.js';

const filters = { box: 'open', query: '', parish: '' };

const L = t;
const parishName = id => session.parishes.find(p => p.id === id)?.name || '';
const kindLabel = kind => (kind === 'Direct' ? L('Direct message', 'رسالة مباشرة') : L('Parish office', 'مكتب الرعية'));

/* A member's new message to the parish office. */
function Compose({ done }) {
  const parishes = session.parishes;
  const { error, busy, submit } = useSubmit(async q => {
    const c = await startConversation(q.parish, q.subject.trim(), q.body.trim());
    closeOverlays();
    await done();
    toast(
      L('Message stored in the app', 'حُفظت الرسالة داخل التطبيق'),
      c.notificationOutcome?.meaning || '',
      'success'
    );
  });
  return (
    <form data-compose-form="" onSubmit={submit}>
      <label className="formrow">
        <span className="label">{L('Parish office', 'مكتب الرعية')}</span>
        <Select name="parish" required defaultValue={session.parishId || ''}>
          {parishes.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="formrow">
        <span className="label">{L('Subject', 'الموضوع')}</span>
        <input className="input" name="subject" required maxLength="300" />
      </label>
      <label className="formrow">
        <span className="label">{L('Message', 'الرسالة')}</span>
        <textarea className="textarea" name="body" required maxLength="10000" rows="8" />
      </label>
      <p className="help">
        {L(
          'The office reads it inside ParishLife. Nothing is sent by email or SMS.',
          'يقرأها المكتب داخل ParishLife. لا يُرسل شيء بالبريد أو الرسائل القصيرة.'
        )}
      </p>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {L('Send message', 'إرسال الرسالة')}
      </button>
    </form>
  );
}

/* A conversation: its messages (opening it marks it read), a reply box, and for each message the stored
   notice status and a way to report it. */
function Conversation({ c, onChange }) {
  const [list, setList] = useState(null),
    [error, setError] = useState(''),
    [reports, setReports] = useState([]),
    [notes, setNotes] = useState({});
  const me = session.accountUser?.id;
  const load = () =>
    loadMessages(c.parishId, c.id).then(
      async m => {
        await loadNames(
          c.parishId,
          m.map(x => x.authorAccountId)
        );
        setList(m);
        onChange();
      },
      e => setError(e.message)
    );
  useEffect(() => {
    load();
    ownReports(c.parishId).then(setReports);
  }, []);
  const reply = useSubmit(async q => {
    const sent = await postMessage(c.parishId, c.id, q.body.trim());
    toast(L('Reply stored in the app', 'حُفظ الرد داخل التطبيق'), sent.notificationOutcome?.meaning || '', 'success');
    await load();
  });
  const note = async m => {
    try {
      const r = await messageOutcome(c.parishId, c.id, m.id);
      setNotes(n => ({ ...n, [m.id]: r.meaning }));
    } catch (e) {
      setNotes(n => ({ ...n, [m.id]: e.message }));
    }
  };
  const author = m => {
    if (m.authorAccountId === me) return L('You', 'أنت');
    const name = nameOf(c.parishId, m.authorAccountId),
      role = m.capacity === 'Office' ? L('Parish office', 'مكتب الرعية') : L('Parishioner', 'مؤمن');
    return name ? `${name} · ${role}` : role;
  };
  const report = m =>
    openDrawer({
      title: L('Report this message', 'الإبلاغ عن هذه الرسالة'),
      body: <Report c={c} m={m} done={() => ownReports(c.parishId).then(setReports)} />
    });
  if (error) return <p className="help-error">{error}</p>;
  if (!list) return <p className="help">{L('Loading messages…', 'جارٍ تحميل الرسائل…')}</p>;
  return (
    <>
      <p className="help">
        {parishName(c.parishId)} · {kindLabel(c.kind)}
      </p>
      {list.map(m => {
        const filed = reports.find(r => r.messageId === m.id);
        return (
          <article key={m.id} className="inbox-card" data-message={m.id}>
            <div className="account-actions">
              <small>
                {author(m)} · {new Date(m.at).toLocaleString()}
              </small>
            </div>
            <div className="message-body" style={{ whiteSpace: 'pre-wrap' }} dir="auto">
              {m.body}
            </div>
            <div className="account-actions">
              {m.authorAccountId === me ? (
                <button className="btn btn-ghost btn-dense" onClick={() => note(m)}>
                  {L('Notice status', 'حالة الإشعار')}
                </button>
              ) : filed ? (
                <Pill
                  label={
                    filed.status === 'Closed'
                      ? L('Reported · closed', 'أُبلغ عنها · مغلق')
                      : L('Reported · received', 'أُبلغ عنها · مستلم')
                  }
                />
              ) : (
                <button className="btn btn-ghost btn-dense" onClick={() => report(m)}>
                  {L('Report', 'إبلاغ')}
                </button>
              )}
            </div>
            {notes[m.id] ? <p className="help">{notes[m.id]}</p> : null}
            {filed?.reporterOutcome ? <p className="help">{filed.reporterOutcome}</p> : null}
          </article>
        );
      })}
      <form onSubmit={reply.submit} data-reply-form="">
        <label className="formrow">
          <span className="label">{L('Reply', 'رد')}</span>
          <textarea className="textarea" name="body" required maxLength="10000" rows="4" key={list.length} />
        </label>
        <p className="help-error" role="alert">
          {reply.error}
        </p>
        <button className="btn btn-primary" data-reply="" disabled={reply.busy}>
          {L('Send reply', 'إرسال الرد')}
        </button>
      </form>
    </>
  );
}

function Report({ c, m, done }) {
  const { error, busy, submit } = useSubmit(async q => {
    await reportMessage(c.parishId, c.id, m.id, q.explanation.trim());
    closeOverlays();
    await done();
    toast(
      L('Report received', 'استُلم البلاغ'),
      L(
        'Only the reviewers allowed to handle it can ask to read this one message, and every read is recorded.',
        'لا يستطيع طلب قراءة هذه الرسالة إلا المراجعون المخوّلون، وتُسجَّل كل قراءة.'
      ),
      'success'
    );
  });
  return (
    <form onSubmit={submit}>
      <label className="formrow">
        <span className="label">{L('What is wrong with it?', 'ما المشكلة فيها؟')}</span>
        <textarea className="textarea" name="explanation" required maxLength="4000" rows="6" />
      </label>
      <p className="help-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {L('Send report', 'إرسال البلاغ')}
      </button>
    </form>
  );
}

export function InboxPage() {
  const [rows, setRows] = useState(null),
    [received, setReceived] = useState([]),
    [error, setError] = useState(''),
    [round, setRound] = useState(0),
    [busy, setBusy] = useState('');
  const [, redraw] = useState(0);
  useEffect(() => {
    let live = true;
    const parishes = session.parishes.map(p => p.id);
    Promise.all(
      parishes.map(id =>
        Promise.all([conversations(id), receivedBroadcasts(id)]).then(async ([c, b]) => {
          await loadNames(
            id,
            c.flatMap(x => [x.createdBy, ...(x.participantAccountIds || [])])
          );
          return {
            conversations: c.map(x => ({ ...x, parishId: id })),
            broadcasts: b.map(x => ({ ...x, parishId: id }))
          };
        })
      )
    ).then(
      all => {
        if (!live) return;
        setRows(
          all
            .flatMap(x => x.conversations)
            .sort((a, b) => String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)))
        );
        setReceived(all.flatMap(x => x.broadcasts).sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt))));
        setBusy('');
      },
      e => live && setError(e.message)
    );
    return () => {
      live = false;
    };
  }, [round]);
  const refresh = () => setRound(n => n + 1);
  const set = patch => {
    Object.assign(filters, patch);
    redraw(n => n + 1);
  };
  if (error || !rows)
    return (
      <>
        <Head />
        <div data-inbox="" aria-live="polite">
          {error || L('Loading messages…', 'جارٍ تحميل الرسائل…')}
        </div>
      </>
    );
  const me = session.accountUser?.id;
  const inBox = c =>
    filters.box === 'archived'
      ? c.archived
      : !c.archived &&
        (filters.box === 'unread' ? c.unread : filters.box === 'sent' ? !!me && c.createdBy === me : true);
  /* who the conversation is with, as far as this account may see names */
  const withWhom = c => {
    if (c.createdBy && c.createdBy !== me)
      return nameOf(c.parishId, c.createdBy) || (c.kind === 'Direct' ? L('Parish office', 'مكتب الرعية') : '');
    const other = (c.participantAccountIds || []).find(id => id !== me);
    return other ? nameOf(c.parishId, other) : '';
  };
  const shown = rows.filter(
    c =>
      inBox(c) &&
      (!filters.parish || c.parishId === filters.parish) &&
      c.subject.toLowerCase().includes(filters.query.toLowerCase().trim())
  );
  const archive = async c => {
    setBusy(c.id);
    try {
      await archiveConversation(c.parishId, c.id, !c.archived);
      refresh();
    } catch (e) {
      toast(e.message, '', 'danger');
      setBusy('');
    }
  };
  const open = c => openDrawer({ title: c.subject, body: <Conversation c={c} onChange={refresh} /> });
  const status = async c => {
    try {
      const r = await conversationOutcome(c.parishId, c.id);
      toast(L('Notice status', 'حالة الإشعار'), r.meaning, 'info');
    } catch (e) {
      toast(e.message, '', 'danger');
    }
  };
  return (
    <>
      <Head />
      <div data-inbox="" aria-live="polite">
        <div className="collection-toolbar">
          <label className="sr-only" htmlFor="inbox-search">
            {L('Search messages', 'ابحث في الرسائل')}
          </label>
          <input
            className="input"
            id="inbox-search"
            type="search"
            placeholder={L('Search subjects', 'ابحث في المواضيع')}
            defaultValue={filters.query}
            onChange={e => set({ query: e.target.value })}
          />
          <Select
            data-box=""
            aria-label={L('Folder', 'المجلّد')}
            value={filters.box}
            onChange={e => set({ box: e.target.value })}
          >
            {[
              ['open', L('Open', 'المفتوحة')],
              ['unread', L('Unread', 'غير المقروءة')],
              ['sent', L('Started by me', 'بدأتها أنا')],
              ['archived', L('Archived', 'المؤرشفة')]
            ].map(([v, s]) => (
              <option key={v} value={v}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            data-parish=""
            aria-label={L('Parish', 'الرعية')}
            value={filters.parish}
            onChange={e => set({ parish: e.target.value })}
          >
            <option value="">{L('All parishes', 'كل الرعايا')}</option>
            {session.parishes.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <button
            className="btn btn-primary"
            data-compose=""
            disabled={!session.parishes.length}
            onClick={() => openDrawer({ title: L('New message', 'رسالة جديدة'), body: <Compose done={refresh} /> })}
          >
            {L('Write to the parish office', 'مراسلة مكتب الرعية')}
          </button>
        </div>
        {!session.parishes.length ? (
          <p className="help">
            {L(
              'Follow a parish in Complete Profile to contact its office.',
              'تابع رعية في إكمال الملف للتواصل مع مكتبها.'
            )}
          </p>
        ) : null}
        <div data-messages="">
          <p className="help">
            {shown.length} {L('conversations', 'محادثات')}
          </p>
          <Paged className="inbox-grid" data-paginate="">
            {shown.map(c => (
              <article key={c.id} className={`inbox-card ${c.unread ? 'inbox-unread' : ''}`}>
                <div className="account-actions">
                  <small>{parishName(c.parishId)}</small>
                  {c.unread ? <span className="pill">{L('Unread', 'غير مقروءة')}</span> : null}
                </div>
                <h2>
                  <button className="inbox-title" data-open={c.id} onClick={() => open(c)}>
                    {c.subject}
                  </button>
                </h2>
                <p>
                  {kindLabel(c.kind)}
                  {withWhom(c) ? ` · ${c.createdBy === me ? L('to', 'إلى') : L('from', 'من')} ${withWhom(c)}` : ''}
                </p>
                <small>{fmtDate(String(c.lastMessageAt).slice(0, 10))}</small>
                <div className="account-actions">
                  <button className="btn btn-ghost btn-dense" onClick={() => status(c)}>
                    {L('Notice status', 'حالة الإشعار')}
                  </button>
                  <button
                    className="btn btn-ghost btn-dense"
                    data-state={c.id}
                    data-action={c.archived ? 'unarchive' : 'archive'}
                    disabled={busy === c.id}
                    onClick={() => archive(c)}
                  >
                    {c.archived ? L('Restore', 'استعادة') : L('Archive', 'أرشفة')}
                  </button>
                </div>
              </article>
            ))}
          </Paged>
          {shown.length ? null : (
            <p className="member-empty">
              {L('No conversations match these filters.', 'لا محادثات تطابق هذه الفلاتر.')}
            </p>
          )}
        </div>
        {received.length ? (
          <div data-broadcasts="">
            <h2>{L('Messages from the parish', 'رسائل من الرعية')}</h2>
            <p className="help">
              {L(
                'Stored in the app for you when the parish sent a broadcast.',
                'حُفظت لك داخل التطبيق عندما أرسلت الرعية بثّاً.'
              )}
            </p>
            <Paged className="inbox-grid" data-paginate="">
              {received.map(b => (
                <article key={b.id} className="inbox-card">
                  <small>
                    {parishName(b.parishId)} · {b.sentAt ? fmtDate(b.sentAt.slice(0, 10)) : ''}
                  </small>
                  <h2 dir="auto">{L(b.title, b.titleAr || b.title)}</h2>
                  <p className="inbox-preview" dir="auto" style={{ whiteSpace: 'pre-wrap' }}>
                    {L(b.body, b.bodyAr || b.body)}
                  </p>
                </article>
              ))}
            </Paged>
          </div>
        ) : null}
      </div>
    </>
  );
}

const Head = () => (
  <PageHead
    title={L('Inbox', 'البريد')}
    sub={L('Conversations with the parish office, inside ParishLife.', 'محادثات مع مكتب الرعية، داخل ParishLife.')}
  />
);
