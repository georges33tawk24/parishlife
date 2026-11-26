/* Inbox (parish staff) and Messages (members): conversations with the parish office, the messages in
   each, reports about a message, and the broadcasts the parish stored for the signed-in member.
   Laid out like a mail or chat app: the conversations on the left (search, folders, the parish), the one
   that is open on the right as chat bubbles with a reply box under them; on a phone the list and the chat
   take turns, with a way back. Writing a new message opens in the same place.
   Main members: InboxPage, ConversationRow, Conversation, Broadcast, Compose, Report.

   The API keeps conversations per parish; a member writes to the parish office, and office staff reply in
   it. Staff may also write directly to a linked parishioner. Senders are named through the shared
   account-name lookup (model/names.js) when the API lets this account see the name; otherwise a message
   shows "Parish office" or "Parishioner". A notice that a message arrived is stored in the app only; email, SMS and push are not
   set up, and the notice status says so in the API's own words. */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { session } from '../../model/api.js';
import { t, lang } from '../../../lib/i18n.js';
import { PageHead, openDrawer, closeOverlays, toast, Pill, Avatar } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { Icon } from '../../ui/icons.jsx';
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

/* what the list shows, kept while the visitor moves around the portal */
const filters = { box: 'open', query: '', parish: '' };

const L = t;
const parishName = id => session.parishes.find(p => p.id === id)?.name || '';
const kindLabel = kind => (kind === 'Direct' ? L('Direct message', 'رسالة مباشرة') : L('Parish office', 'مكتب الرعية'));
const locale = () => (lang === 'ar' ? 'ar-LB' : 'en-GB');
const dateOf = at => {
  const d = new Date(at);
  return Number.isNaN(d.valueOf()) ? null : d;
};
const sameDay = (a, b) => a.toDateString() === b.toDateString();
/* An avatar for a person or a parish, from the letters of its name only (no "&F" for "Saints Abda & Foucas"). */
const Face = ({ id, name }) => (
  <Avatar p={{ id, lat: String(name || '').replace(/[^\p{L}\s-]/gu, ' ') }} cls="mail-av" />
);

/* In the list: the time today, the weekday this week, the date before that. */
function listTime(at) {
  const d = dateOf(at);
  if (!d) return '';
  const now = new Date(),
    days = (now - d) / 86400000;
  const style = sameDay(d, now)
    ? { hour: 'numeric', minute: '2-digit' }
    : days < 6
      ? { weekday: 'short' }
      : d.getFullYear() === now.getFullYear()
        ? { day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(locale(), style).format(d);
}
const clock = at => {
  const d = dateOf(at);
  return d ? new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit' }).format(d) : '';
};
/* The line between days in a conversation: Today, Yesterday, or the date. */
function dayLabel(at) {
  const d = dateOf(at);
  if (!d) return '';
  const now = new Date(),
    yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return L('Today', 'اليوم');
  if (sameDay(d, yesterday)) return L('Yesterday', 'أمس');
  return new Intl.DateTimeFormat(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' })
  }).format(d);
}

const Back = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="mail-flip"
  >
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
const Send = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="mail-flip"
  >
    <path d="M21 3L10 14" />
    <path d="M21 3l-7 18-4-7-7-4z" />
  </svg>
);

/* A text box that grows with what is typed, up to a limit, then scrolls. */
function grow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 220) + 'px';
}

/* A member's new message to the parish office, in the reading pane. */
function Compose({ done, onBack }) {
  const parishes = session.parishes;
  const { error, busy, submit } = useSubmit(async q => {
    const c = await startConversation(q.parish, q.subject.trim(), q.body.trim());
    closeOverlays();
    await done(c, q.parish);
    toast(L('Message stored in the app', 'حُفظت الرسالة داخل التطبيق'), c.notificationOutcome?.meaning || '', 'success');
  });
  return (
    <div className="mail-read">
      <header className="mail-head">
        <button
          type="button"
          className="btn-icon mail-back"
          aria-label={L('Back to conversations', 'العودة إلى المحادثات')}
          onClick={onBack}
        >
          <Back />
        </button>
        <div className="mail-head-text">
          <h2>{L('New message', 'رسالة جديدة')}</h2>
          <p>{L('To the parish office, inside ParishLife', 'إلى مكتب الرعية، داخل ParishLife')}</p>
        </div>
      </header>
      <form className="mail-compose" data-compose-form="" onSubmit={submit}>
        {parishes.length > 1 ? (
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
        ) : (
          <input type="hidden" name="parish" value={parishes[0]?.id || ''} />
        )}
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
        <div className="mail-compose-acts">
          <button className="btn btn-primary" disabled={busy}>
            <Send />
            {L('Send message', 'إرسال الرسالة')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            {L('Cancel', 'إلغاء')}
          </button>
        </div>
      </form>
    </div>
  );
}

/* A conversation as a chat: the bubbles by day (opening it marks it read), a reply box at the bottom, and
   for each message the stored notice status or a way to report it. */
function Conversation({ c, who, onChange, onBack, onArchive, busy }) {
  const [list, setList] = useState(null),
    [error, setError] = useState(''),
    [reports, setReports] = useState([]),
    [notes, setNotes] = useState({});
  const scroller = useRef(null),
    input = useRef(null);
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
  /* the newest message is in view, as in any chat */
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [list?.length]);
  const reply = useSubmit(async q => {
    const sent = await postMessage(c.parishId, c.id, q.body.trim());
    toast(L('Reply stored in the app', 'حُفظ الرد داخل التطبيق'), sent.notificationOutcome?.meaning || '', 'success');
    await load();
    input.current?.focus();
  });
  const note = async m => {
    try {
      const r = await messageOutcome(c.parishId, c.id, m.id);
      setNotes(n => ({ ...n, [m.id]: r.meaning }));
    } catch (e) {
      setNotes(n => ({ ...n, [m.id]: e.message }));
    }
  };
  const status = async () => {
    try {
      const r = await conversationOutcome(c.parishId, c.id);
      toast(L('Notice status', 'حالة الإشعار'), r.meaning, 'info');
    } catch (e) {
      toast(e.message, '', 'danger');
    }
  };
  const author = m => {
    const name = nameOf(c.parishId, m.authorAccountId),
      role = m.capacity === 'Office' ? L('Parish office', 'مكتب الرعية') : L('Parishioner', 'مؤمن');
    return name ? `${name} · ${role}` : role;
  };
  const report = m =>
    openDrawer({
      title: L('Report this message', 'الإبلاغ عن هذه الرسالة'),
      body: <Report c={c} m={m} done={() => ownReports(c.parishId).then(setReports)} />
    });
  return (
    <div className="mail-read">
      <header className="mail-head">
        <button
          type="button"
          className="btn-icon mail-back"
          aria-label={L('Back to conversations', 'العودة إلى المحادثات')}
          onClick={onBack}
        >
          <Back />
        </button>
        <Face id={who.key} name={who.name} />
        <div className="mail-head-text">
          <h2 dir="auto">{c.subject}</h2>
          <p>
            {[who.name, parishName(c.parishId), kindLabel(c.kind)]
              .filter((x, i, a) => x && a.indexOf(x) === i)
              .join(' · ')}
          </p>
        </div>
        <div className="mail-head-acts">
          <button type="button" className="btn btn-ghost btn-dense" onClick={status}>
            <Icon name="info" size={16} />
            <span className="mail-hide-sm">{L('Notice status', 'حالة الإشعار')}</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-dense"
            data-state={c.id}
            data-action={c.archived ? 'unarchive' : 'archive'}
            disabled={busy}
            onClick={onArchive}
          >
            <Icon name="box" size={16} />
            <span className="mail-hide-sm">{c.archived ? L('Restore', 'استعادة') : L('Archive', 'أرشفة')}</span>
          </button>
        </div>
      </header>
      <div className="chat" ref={scroller} aria-live="polite">
        {error ? <p className="help-error">{error}</p> : null}
        {!list && !error ? <p className="help chat-wait">{L('Loading messages…', 'جارٍ تحميل الرسائل…')}</p> : null}
        {(list || []).map((m, i) => {
          const mine = !!me && m.authorAccountId === me,
            filed = reports.find(r => r.messageId === m.id),
            prev = list[i - 1],
            newDay = !prev || !sameDay(dateOf(prev.at) || new Date(0), dateOf(m.at) || new Date(0)),
            sameAuthor = prev && !newDay && prev.authorAccountId === m.authorAccountId;
          return (
            <Fragment key={m.id}>
              {newDay ? (
                <div className="chat-day">
                  <span>{dayLabel(m.at)}</span>
                </div>
              ) : null}
              <div className={'chat-row' + (mine ? ' mine' : '') + (sameAuthor ? ' cont' : '')} data-message={m.id}>
                <div className="bubble">
                  {!mine && !sameAuthor ? <span className="bubble-who">{author(m)}</span> : null}
                  <div className="bubble-body" dir="auto">
                    {m.body}
                  </div>
                  <time className="bubble-time" dateTime={m.at}>
                    {clock(m.at)}
                  </time>
                </div>
                <div className="bubble-tools">
                  {mine ? (
                    <button type="button" className="link-btn" onClick={() => note(m)}>
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
                    <button type="button" className="link-btn" onClick={() => report(m)}>
                      {L('Report', 'إبلاغ')}
                    </button>
                  )}
                </div>
                {notes[m.id] ? <p className="help bubble-note">{notes[m.id]}</p> : null}
                {filed?.reporterOutcome ? <p className="help bubble-note">{filed.reporterOutcome}</p> : null}
              </div>
            </Fragment>
          );
        })}
      </div>
      {c.archived ? (
        <p className="help mail-archived">
          {L('This conversation is archived. Restore it to reply.', 'هذه المحادثة مؤرشفة. استعدها للرد.')}
        </p>
      ) : (
        <form className="composer" onSubmit={reply.submit} data-reply-form="">
          <label className="sr-only" htmlFor={'reply-' + c.id}>
            {L('Reply', 'رد')}
          </label>
          <textarea
            id={'reply-' + c.id}
            ref={input}
            className="textarea composer-input"
            name="body"
            required
            maxLength="10000"
            rows="1"
            key={list?.length || 0}
            placeholder={L('Write a reply…', 'اكتب رداً…')}
            onInput={e => grow(e.currentTarget)}
            onKeyDown={e => {
              /* Enter sends, Shift+Enter starts a new line (on a keyboard; a phone's Enter adds a line) */
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                matchMedia('(pointer:fine)').matches
              ) {
                e.preventDefault();
                e.currentTarget.form.requestSubmit();
              }
            }}
          />
          <button
            className="btn btn-primary composer-send"
            data-reply=""
            disabled={reply.busy}
            aria-label={L('Send reply', 'إرسال الرد')}
          >
            <Send />
          </button>
          {reply.error ? (
            <p className="help-error composer-error" role="alert">
              {reply.error}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}

/* A broadcast the parish stored for this member: read only. */
function Broadcast({ b, onBack }) {
  return (
    <div className="mail-read">
      <header className="mail-head">
        <button
          type="button"
          className="btn-icon mail-back"
          aria-label={L('Back to conversations', 'العودة إلى المحادثات')}
          onClick={onBack}
        >
          <Back />
        </button>
        <Face id={b.parishId} name={parishName(b.parishId)} />
        <div className="mail-head-text">
          <h2 dir="auto">{L(b.title, b.titleAr || b.title)}</h2>
          <p>
            {parishName(b.parishId)} · {L('Message from the parish', 'رسالة من الرعية')}
          </p>
        </div>
      </header>
      <div className="chat">
        {b.sentAt ? (
          <div className="chat-day">
            <span>{dayLabel(b.sentAt)}</span>
          </div>
        ) : null}
        <div className="chat-row">
          <div className="bubble bubble-wide">
            <div className="bubble-body" dir="auto">
              {L(b.body, b.bodyAr || b.body)}
            </div>
            {b.sentAt ? <time className="bubble-time">{clock(b.sentAt)}</time> : null}
          </div>
        </div>
      </div>
      <p className="help mail-archived">
        {L(
          'Stored in the app for you when the parish sent a broadcast. Replies are not possible.',
          'حُفظت لك داخل التطبيق عندما أرسلت الرعية بثّاً. لا يمكن الرد عليها.'
        )}
      </p>
    </div>
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
    [busy, setBusy] = useState(''),
    [open, setOpen] = useState(null); // { type: 'c' | 'b' | 'new', id }
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
  /* who the conversation is with, as far as this account may see names; the parish office otherwise */
  const withWhom = c => {
    let name = '',
      key = '';
    if (c.createdBy && c.createdBy !== me) {
      key = c.createdBy;
      name = nameOf(c.parishId, c.createdBy);
    } else {
      key = (c.participantAccountIds || []).find(id => id !== me) || '';
      name = key ? nameOf(c.parishId, key) : '';
    }
    return name
      ? { name, key }
      : { name: parishName(c.parishId) || L('Parish office', 'مكتب الرعية'), key: c.parishId };
  };
  const q = filters.query.toLowerCase().trim();
  const showBroadcasts = filters.box === 'parish';
  const shown = showBroadcasts
    ? []
    : rows.filter(
        c =>
          inBox(c) &&
          (!filters.parish || c.parishId === filters.parish) &&
          (c.subject.toLowerCase().includes(q) || withWhom(c).name.toLowerCase().includes(q))
      );
  const notices = showBroadcasts
    ? received.filter(
        b =>
          (!filters.parish || b.parishId === filters.parish) &&
          String(L(b.title, b.titleAr || b.title))
            .toLowerCase()
            .includes(q)
      )
    : [];
  const unread = rows.filter(c => c.unread && !c.archived).length;
  const current = open?.type === 'c' ? rows.find(c => c.id === open.id) : null;
  const broadcast = open?.type === 'b' ? received.find(b => b.id === open.id) : null;
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
  const folders = [
    ['open', L('Inbox', 'الوارد')],
    ['unread', L('Unread', 'غير المقروءة'), unread],
    ['sent', L('Started by me', 'بدأتها أنا')],
    ['archived', L('Archived', 'المؤرشفة')],
    ...(received.length ? [['parish', L('From the parish', 'من الرعية')]] : [])
  ];
  const close = () => setOpen(null);
  return (
    <>
      <Head />
      {!session.parishes.length ? (
        <p className="help">
          {L(
            'Follow a parish in Complete Profile to contact its office.',
            'تابع رعية في إكمال الملف للتواصل مع مكتبها.'
          )}
        </p>
      ) : null}
      <div className={'mail' + (open ? ' is-reading' : '')} data-inbox="" aria-live="polite">
        <aside className="mail-list" aria-label={L('Conversations', 'المحادثات')} data-messages="">
          <div className="mail-tools">
            <div className="mail-search">
              <Icon name="search" size={16} />
              <label className="sr-only" htmlFor="inbox-search">
                {L('Search messages', 'ابحث في الرسائل')}
              </label>
              <input
                className="input"
                id="inbox-search"
                type="search"
                placeholder={L('Search', 'ابحث')}
                defaultValue={filters.query}
                onChange={e => set({ query: e.target.value })}
              />
            </div>
            <button
              className="btn btn-primary mail-new"
              data-compose=""
              disabled={!session.parishes.length}
              onClick={() => setOpen({ type: 'new' })}
            >
              <Icon name="edit" size={16} />
              {L('New message', 'رسالة جديدة')}
            </button>
          </div>
          <div className="mail-folders" role="group" aria-label={L('Folder', 'المجلّد')} data-box="">
            {folders.map(([v, label, n]) => (
              <button key={v} type="button" aria-pressed={filters.box === v} onClick={() => set({ box: v })}>
                {label}
                {n ? <span className="mail-count">{n}</span> : null}
              </button>
            ))}
          </div>
          {session.parishes.length > 1 ? (
            <div className="mail-parish">
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
            </div>
          ) : null}
          <ul className="mail-rows">
            {shown.map(c => {
              const who = withWhom(c);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={'mail-row' + (c.unread ? ' is-unread' : '')}
                    aria-current={open?.type === 'c' && open.id === c.id ? 'true' : undefined}
                    data-open={c.id}
                    onClick={() => setOpen({ type: 'c', id: c.id })}
                  >
                    <Face id={who.key} name={who.name} />
                    <span className="mail-row-text">
                      <span className="mail-row-top">
                        <span className="mail-who">{who.name}</span>
                        <time dateTime={c.lastMessageAt}>{listTime(c.lastMessageAt)}</time>
                      </span>
                      <span className="mail-subject" dir="auto">
                        {c.subject}
                      </span>
                      <span className="mail-meta">
                        {kindLabel(c.kind)}
                        {who.key !== c.parishId ? ` · ${parishName(c.parishId)}` : ''}
                      </span>
                    </span>
                    {c.unread ? <span className="mail-dot" aria-label={L('Unread', 'غير مقروءة')}></span> : null}
                  </button>
                </li>
              );
            })}
            {notices.map(b => (
              <li key={b.id} data-broadcasts="">
                <button
                  type="button"
                  className="mail-row"
                  aria-current={open?.type === 'b' && open.id === b.id ? 'true' : undefined}
                  onClick={() => setOpen({ type: 'b', id: b.id })}
                >
                  <Face id={b.parishId} name={parishName(b.parishId)} />
                  <span className="mail-row-text">
                    <span className="mail-row-top">
                      <span className="mail-who">{parishName(b.parishId)}</span>
                      <time dateTime={b.sentAt}>{listTime(b.sentAt)}</time>
                    </span>
                    <span className="mail-subject" dir="auto">
                      {L(b.title, b.titleAr || b.title)}
                    </span>
                    <span className="mail-meta" dir="auto">
                      {L(b.body, b.bodyAr || b.body)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length || notices.length ? null : (
            <p className="mail-empty">
              {q || filters.parish || filters.box !== 'open'
                ? L('No conversations match.', 'لا محادثات مطابقة.')
                : L(
                    'No conversations yet. Write to the parish office to start one.',
                    'لا محادثات بعد. راسل مكتب الرعية لتبدأ واحدة.'
                  )}
            </p>
          )}
        </aside>
        <section className="mail-pane" aria-label={L('Reading pane', 'جزء القراءة')}>
          {open?.type === 'new' ? (
            <Compose
              onBack={close}
              done={async (c, parishId) => {
                if (c?.id) setOpen({ type: 'c', id: c.id });
                if (filters.box === 'archived' || filters.box === 'parish') set({ box: 'open' });
                if (filters.parish && filters.parish !== parishId) set({ parish: '' });
                refresh();
              }}
            />
          ) : current ? (
            <Conversation
              key={current.id}
              c={current}
              who={withWhom(current)}
              onChange={refresh}
              onBack={close}
              busy={busy === current.id}
              onArchive={async () => {
                await archive(current);
                close();
              }}
            />
          ) : broadcast ? (
            <Broadcast key={broadcast.id} b={broadcast} onBack={close} />
          ) : (
            <div className="mail-none">
              <Icon name="msg" size={36} />
              <p>{L('Choose a conversation to read it here.', 'اختر محادثة لقراءتها هنا.')}</p>
            </div>
          )}
        </section>
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
