/* Inbox (parish staff) and Messages (members): conversations with the parish office, the messages in
   each, reports about a message, and the broadcasts the parish stored for the signed-in member.
   Laid out like a mail or chat app: the conversations on the left (search, folders, the parish), the one
   that is open on the right as chat bubbles with a reply box under them; on a phone the list and the chat
   take turns, with a way back. Writing a new message opens in the same place.
   Main members: InboxPage, Conversation, Broadcast, Compose, Report, VoiceNote, Ticks, useVoice.

   Like a chat app (owner, 28 November 2026): one chat per person. The API adds a new message to the chat the same
   people already have; conversations from before that rule are shown together in the list and in one thread (by
   parish, kind and the other person), and a reply goes to the newest. One's own messages carry ticks: one when
   stored, two when the other side's inbox showed it, two in colour when they opened it. A microphone records a voice
   note (stored privately with the conversation). A chat with one person has voice and video call buttons
   (features/communicate/calls.jsx). Office staff may write to one parishioner of the open parish from New message
   (#/inbox/new opens it there), besides the person's own page.
   A conversation opens with the whole thread, both sides, and the reply box; #/inbox/{parish}/{conversation}
   (members: #/mymessages/...), the link a new-message notice carries, opens that conversation directly. The
   list and the open thread follow the live updates (model/live.js): when a notice or the parish's
   conversations change, the list is read again, and the open thread reloads when it has a newer message,
   keeping a reply being typed. A platform operator, who reaches every parish, sees the inbox of the parishes
   they belong to and of the parish open in the switcher, not of every parish.

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
import { onLive, onPush } from '../../model/live.js';
import { can, postVoice, voiceURL } from '../../model/modules/communications.js';
import { PEOPLE } from '../../model/data.js';
import { matches } from '../../../lib/i18n.js';
import { PeopleSearch, selectedIds } from '../../shared/people-search.jsx';
import { startCall } from './calls.jsx';

/* what the list shows, kept while the visitor moves around the portal */
const filters = { box: 'open', query: '', parish: '' };

const L = t;
/* The parishes whose inbox is shown: the account's own, the one open in the switcher, and one a link names. */
const inboxParishes = (wanted = '') =>
  session.parishes.filter(p => p.own !== false || p.id === session.parishId || p.id === wanted);
const newest = rows => rows.sort((a, b) => String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)));
const later = (a, b) => (Date.parse(a) || 0) > (Date.parse(b) || 0);
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

/* A new message, in the reading pane: members write to the parish office; office staff may also write to one
   parishioner of the open parish, picked from the people list. A chat with that person (or that office) already
   exists: the message joins it, one chat per person. */
function Compose({ done, onBack, initialTo = 'office' }) {
  const parishes = inboxParishes();
  const open = session.parishes.find(p => p.id === session.parishId);
  const office = !!open && can(open, 'communications.manage') && can(open, 'people.read');
  const [to, setTo] = useState(office ? initialTo : 'office');
  const picker = useRef(null);
  const { error, busy, submit } = useSubmit(async q => {
    let c, parish;
    if (to === 'person') {
      const chosen = selectedIds(picker.current?.querySelector('[data-people-search]'));
      if (chosen.length !== 1) throw new Error(L('Choose one person to write to.', 'اختر شخصاً واحداً لتراسله.'));
      parish = open.id;
      c = await startConversation(parish, '', q.body.trim(), { personId: chosen[0] });
    } else {
      parish = q.parish;
      c = await startConversation(parish, '', q.body.trim());
    }
    closeOverlays();
    await done(c, parish);
    toast(L('Message stored in the app', 'حُفظت الرسالة داخل التطبيق'), c.notificationOutcome?.meaning || '', 'success');
  });
  const search = query =>
    Promise.resolve({
      items: PEOPLE.filter(p => matches(`${p.lat} ${p.ar}`, query))
        .slice(0, 20)
        .map(p => ({ id: p.id, name: L(p.lat, p.ar), alt: p.town || '' })),
      next: null
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
          <p>
            {to === 'person'
              ? L('To one parishioner, inside ParishLife', 'إلى مؤمن واحد، داخل ParishLife')
              : L('To the parish office, inside ParishLife', 'إلى مكتب الرعية، داخل ParishLife')}
          </p>
        </div>
      </header>
      <form className="mail-compose" data-compose-form="" onSubmit={submit}>
        {office ? (
          <div className="mail-folders mail-to" role="group" aria-label={L('To', 'إلى')}>
            <button type="button" aria-pressed={to === 'person'} onClick={() => setTo('person')} data-to="person">
              {L('One person', 'شخص واحد')}
            </button>
            <button type="button" aria-pressed={to === 'office'} onClick={() => setTo('office')} data-to="office">
              {L('Parish office', 'مكتب الرعية')}
            </button>
          </div>
        ) : null}
        {to === 'person' ? (
          <div ref={picker}>
            <PeopleSearch
              id="compose-person"
              label={L('To', 'إلى')}
              req
              minChars={1}
              search={search}
              help={L(
                `A parishioner of ${open?.name || 'this parish'} with a ParishLife account linked to their record.`,
                `مؤمن من ${open?.name || 'هذه الرعية'} له حساب في ParishLife مرتبط بسجلّه.`
              )}
            />
          </div>
        ) : parishes.length > 1 ? (
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
          <span className="label">{L('Message', 'الرسالة')}</span>
          <textarea className="textarea" name="body" required maxLength="10000" rows="6" />
        </label>
        <p className="help">
          {L(
            'It is read inside ParishLife. Nothing is sent by email or SMS.',
            'تُقرأ داخل ParishLife. لا يُرسل شيء بالبريد أو الرسائل القصيرة.'
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

const minutes = s => {
  const n = Math.max(0, Math.round(s || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

/* Sent, delivered (the other side's inbox showed it) or read (they opened it), as the ticks in a chat app. */
const Ticks = ({ m }) => {
  const label = m.read ? L('Read', 'مقروءة') : m.delivered ? L('Delivered', 'وصلت') : L('Sent', 'أُرسلت');
  return (
    <span className={'ticks' + (m.read ? ' is-read' : '')} role="img" aria-label={label} title={label}>
      <svg
        viewBox="0 0 18 12"
        width="17"
        height="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M1.5 6.6l3 3 6.4-7" />
        {m.read || m.delivered ? <path d="M8.4 9.1l.5.5 6.6-7" /> : null}
      </svg>
    </span>
  );
};

/* A voice note: its audio is read with the session, then played from memory. */
function VoiceNote({ c, m }) {
  const [src, setSrc] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let url = '',
      alive = true;
    fetch(voiceURL(c.parishId, m.conversationId, m.id), { credentials: 'same-origin', cache: 'no-store' })
      .then(r => (r.ok ? r.blob() : Promise.reject(new Error())))
      .then(
        blob => {
          if (!alive) return;
          url = URL.createObjectURL(blob);
          setSrc(url);
        },
        () => alive && setError(L('The voice message could not be loaded.', 'تعذّر تحميل الرسالة الصوتية.'))
      );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [m.id]);
  return (
    <div className="voice" data-voice={m.id}>
      <Icon name="mic" size={16} />
      {src ? (
        <audio controls preload="metadata" src={src} />
      ) : (
        <span className="help">{error || L('Loading…', 'جارٍ التحميل…')}</span>
      )}
      <span className="voice-len">{minutes(m.voiceSeconds)}</span>
    </div>
  );
}

const MISSED = {
  'Missed voice call': ['Missed voice call', 'مكالمة صوتية فائتة'],
  'Missed video call': ['Missed video call', 'مكالمة فيديو فائتة']
};

/* Recording a voice note: the browser's own recorder (Opus in WebM or Ogg; AAC in MP4 on Safari), at most 10 minutes. */
const MAX_VOICE_S = 600;
function useVoice(send) {
  const [rec, setRec] = useState(null),
    [, tick] = useState(0);
  useEffect(() => {
    if (!rec) return;
    const timer = setInterval(() => {
      tick(n => n + 1);
      if ((Date.now() - rec.started) / 1000 >= MAX_VOICE_S) stop(true);
    }, 500);
    return () => clearInterval(timer);
  }, [rec]);
  useEffect(() => () => rec?.stream.getTracks().forEach(track => track.stop()), [rec]);
  const start = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia)
      return toast(
        L('This browser cannot record a voice message.', 'هذا المتصفح لا يستطيع تسجيل رسالة صوتية.'),
        '',
        'danger'
      );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(x =>
        MediaRecorder.isTypeSupported?.(x)
      );
      const recorder = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
      const chunks = [];
      recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
      recorder.start(250);
      setRec({ recorder, chunks, stream, started: Date.now() });
    } catch {
      toast(
        L('Allow the microphone for ParishLife to record.', 'اسمح لـ ParishLife باستخدام الميكروفون للتسجيل.'),
        '',
        'danger'
      );
    }
  };
  const stop = async keep => {
    if (!rec) return;
    const { recorder, chunks, stream, started } = rec;
    setRec(null);
    const seconds = Math.min(MAX_VOICE_S, (Date.now() - started) / 1000);
    await new Promise(done => {
      recorder.onstop = done;
      recorder.stop();
    });
    stream.getTracks().forEach(track => track.stop());
    if (keep && seconds >= 1) await send(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), seconds);
  };
  return { rec, start, stop, elapsed: rec ? (Date.now() - rec.started) / 1000 : 0 };
}

const Mic = () => <Icon name="mic" size={20} />;

/* A chat: every conversation with this person (or office), as one thread of bubbles by day (opening it marks it
   read), the ticks on one's own messages, voice notes, a reply box with a microphone, call buttons where the chat is
   with one person, and for each message the stored notice status or a way to report it. */
function Conversation({ c, who, onChange, onBack, onArchive, busy }) {
  const [list, setList] = useState(null),
    [error, setError] = useState(''),
    [reports, setReports] = useState([]),
    [notes, setNotes] = useState({}),
    [sending, setSending] = useState(false);
  const scroller = useRef(null),
    input = useRef(null);
  const me = session.accountUser?.id;
  const loadedAt = useRef('');
  const ids = c.ids || [c.id];
  const load = () =>
    Promise.all(ids.map(id => loadMessages(c.parishId, id).then(m => m.map(x => ({ ...x, conversationId: id }))))).then(
      async parts => {
        const m = parts.flat().sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
        await loadNames(
          c.parishId,
          m.map(x => x.authorAccountId)
        );
        loadedAt.current = m.length ? m[m.length - 1].at : '';
        setList(m);
        onChange();
      },
      e => setError(e.message)
    );
  useEffect(() => {
    load();
    ownReports(c.parishId).then(setReports);
  }, [ids.join(',')]);
  /* a newer message than the ones shown (the other side wrote): read the thread again */
  useEffect(() => {
    if (list && later(c.lastMessageAt, loadedAt.current)) load();
  }, [c.lastMessageAt]);
  /* the other side opened it: read again for the blue ticks */
  useEffect(
    () => onPush(e => e.type === 'inbox-read' && e.parishId === c.parishId && ids.includes(e.conversationId) && load()),
    [ids.join(',')]
  );
  /* the newest message is in view, as in any chat */
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [list?.length]);
  const reply = useSubmit(async q => {
    const sent = await postMessage(c.parishId, c.id, q.body.trim());
    toast(L('Reply stored in the app', 'حُفظ الرد داخل التطبيق'), sent.notificationOutcome?.meaning || '', 'success');
    if (input.current) {
      input.current.value = '';
      grow(input.current);
    }
    await load();
    input.current?.focus();
  });
  const voice = useVoice(async (blob, seconds) => {
    setSending(true);
    try {
      await postVoice(c.parishId, c.id, blob, seconds);
      await load();
    } catch (e) {
      toast(e.message, '', 'danger');
    } finally {
      setSending(false);
    }
  });
  const note = async m => {
    try {
      const r = await messageOutcome(c.parishId, m.conversationId, m.id);
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
  /* a call is with one person: a direct chat, or staff with the member of an office chat */
  const others = (c.participantAccountIds || []).filter(id => id !== me);
  const callable = others.length === 1 && (c.kind === 'Direct' || !(c.participantAccountIds || []).includes(me));
  const call = video =>
    startCall({ parishId: c.parishId, conversationId: c.id, name: who.name, peer: others[0], video });
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
          <h2 dir="auto">{who.name}</h2>
          <p>
            {[parishName(c.parishId), kindLabel(c.kind)]
              .filter((x, i, a) => x && x !== who.name && a.indexOf(x) === i)
              .join(' · ')}
          </p>
        </div>
        <div className="mail-head-acts">
          {callable ? (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-dense"
                onClick={() => call(false)}
                aria-label={L('Voice call', 'مكالمة صوتية')}
                title={L('Voice call', 'مكالمة صوتية')}
                data-call-voice=""
              >
                <Icon name="phone" size={16} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-dense"
                onClick={() => call(true)}
                aria-label={L('Video call', 'مكالمة فيديو')}
                title={L('Video call', 'مكالمة فيديو')}
                data-call-video=""
              >
                <Icon name="video" size={16} />
              </button>
            </>
          ) : null}
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
            sameAuthor = prev && !newDay && prev.authorAccountId === m.authorAccountId,
            missed = !m.voiceSeconds && MISSED[m.body];
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
                  {m.voiceSeconds ? (
                    <VoiceNote c={c} m={m} />
                  ) : missed ? (
                    <div className="bubble-body bubble-call">
                      <Icon name="phone" size={15} />
                      {L(missed[0], missed[1])}
                    </div>
                  ) : (
                    <div className="bubble-body" dir="auto">
                      {m.body}
                    </div>
                  )}
                  <span className="bubble-time">
                    <time dateTime={m.at}>{clock(m.at)}</time>
                    {mine ? <Ticks m={m} /> : null}
                  </span>
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
      ) : voice.rec ? (
        <div className="composer composer-rec" data-recording="">
          <span className="rec-dot" aria-hidden="true"></span>
          <span className="rec-time" aria-live="off">
            {minutes(voice.elapsed)}
          </span>
          <span className="rec-label">{L('Recording a voice message', 'جارٍ تسجيل رسالة صوتية')}</span>
          <button
            type="button"
            className="btn btn-ghost composer-send"
            onClick={() => voice.stop(false)}
            aria-label={L('Delete the recording', 'حذف التسجيل')}
          >
            <Icon name="trash" size={18} />
          </button>
          <button
            type="button"
            className="btn btn-primary composer-send"
            onClick={() => voice.stop(true)}
            aria-label={L('Send the voice message', 'إرسال الرسالة الصوتية')}
            data-voice-send=""
          >
            <Send />
          </button>
        </div>
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
            type="button"
            className="btn btn-ghost composer-send"
            onClick={voice.start}
            disabled={sending}
            aria-label={L('Record a voice message', 'تسجيل رسالة صوتية')}
            title={L('Record a voice message', 'تسجيل رسالة صوتية')}
            data-voice-record=""
          >
            <Mic />
          </button>
          <button
            className="btn btn-primary composer-send"
            data-reply=""
            disabled={reply.busy || sending}
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
    await reportMessage(c.parishId, m.conversationId || c.id, m.id, q.explanation.trim());
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

/* One parish's conversations, with the names of the people in them. */
const conversationsOf = id =>
  conversations(id).then(async c => {
    await loadNames(
      id,
      c.flatMap(x => [x.createdBy, ...(x.participantAccountIds || [])])
    );
    return c.map(x => ({ ...x, parishId: id }));
  });

export function InboxPage({ params = [] }) {
  const [first = '', second = ''] = params.map(x => decodeURIComponent(x));
  const fresh = first === 'new'; // #/inbox/new: a new message to one person
  const wanted = fresh ? '' : first,
    wantedId = fresh ? '' : second;
  const [rows, setRows] = useState(null),
    [received, setReceived] = useState([]),
    [error, setError] = useState(''),
    [round, setRound] = useState(0),
    [busy, setBusy] = useState(''),
    [open, setOpen] = useState(() => (wantedId ? { type: 'c', id: wantedId } : fresh ? { type: 'new' } : null)); // { type: 'c' | 'b' | 'new', id }
  const [, redraw] = useState(0);
  /* live updates: read the conversations again when something changed (the broadcasts stay as loaded) */
  useEffect(
    () =>
      onLive(({ changed, inboxChanged }) => {
        if (!changed && !inboxChanged) return;
        Promise.all(inboxParishes(wanted).map(p => conversationsOf(p.id))).then(
          all => setRows(newest(all.flat())),
          () => {} // the next round tries again
        );
      }),
    []
  );
  useEffect(() => {
    let live = true;
    const parishes = inboxParishes(wanted).map(p => p.id);
    Promise.all(
      parishes.map(id =>
        Promise.all([conversationsOf(id), receivedBroadcasts(id)]).then(([c, b]) => ({
          conversations: c,
          broadcasts: b.map(x => ({ ...x, parishId: id }))
        }))
      )
    ).then(
      all => {
        if (!live) return;
        setRows(newest(all.flatMap(x => x.conversations)));
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
  /* one chat per person: the conversations with the same person (or the same office), newest first */
  const chats = [],
    byKey = new Map();
  for (const c of rows) {
    const key = `${c.parishId}|${c.kind}|${withWhom(c).key}`;
    let chat = byKey.get(key);
    if (!chat) {
      chat = { ...c, key, ids: [], unread: false, archived: true };
      byKey.set(key, chat);
      chats.push(chat);
    }
    chat.ids.push(c.id);
    chat.unread = chat.unread || c.unread;
    chat.archived = chat.archived && c.archived;
  }
  const q = filters.query.toLowerCase().trim();
  const showBroadcasts = filters.box === 'parish';
  const shown = showBroadcasts
    ? []
    : chats.filter(
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
  const unread = chats.filter(c => c.unread && !c.archived).length;
  const current = open?.type === 'c' ? chats.find(c => c.ids.includes(open.id)) : null;
  const broadcast = open?.type === 'b' ? received.find(b => b.id === open.id) : null;
  const archive = async c => {
    setBusy(c.id);
    try {
      await Promise.all((c.ids || [c.id]).map(id => archiveConversation(c.parishId, id, !c.archived)));
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
          {inboxParishes(wanted).length > 1 ? (
            <div className="mail-parish">
              <Select
                data-parish=""
                aria-label={L('Parish', 'الرعية')}
                value={filters.parish}
                onChange={e => set({ parish: e.target.value })}
              >
                <option value="">{L('All parishes', 'كل الرعايا')}</option>
                {inboxParishes(wanted).map(p => (
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
                <li key={c.key}>
                  <button
                    type="button"
                    className={'mail-row' + (c.unread ? ' is-unread' : '')}
                    aria-current={open?.type === 'c' && c.ids.includes(open.id) ? 'true' : undefined}
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
              initialTo={fresh ? 'person' : 'office'}
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
              key={current.key}
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
    sub={L(
      'One chat per person: messages, voice notes and calls with the parish office and parishioners, inside ParishLife.',
      'محادثة واحدة لكل شخص: رسائل ورسائل صوتية ومكالمات مع مكتب الرعية والمؤمنين، داخل ParishLife.'
    )}
  />
);
