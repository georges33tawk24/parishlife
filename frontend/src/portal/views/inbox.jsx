/* Inbox: private conversations with the parish community, by folder and by parish. */
import { useEffect, useState } from 'react';
import { api, session } from '../model/api.js';
import { t, fmtDate } from '../../lib/i18n.js';
import { PageHead, openDrawer, closeOverlays, toast, Paged } from '../ui/ui.jsx';
import { Select } from '../ui/components.jsx';

const filters = { box: 'received', query: '', parish: '' };
const L = t;

function Compose({ recipients, reply, done }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true);
    const q = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const target = recipients[Number(q.target)];
      await api('inbox', 'POST', reply ? { action: 'reply', id: reply.id, body: q.body } : { action: 'send', parish: target.parish, recipient: target.id, title: q.title, body: q.body });
      closeOverlays(); await done(); toast(L('Message sent', 'أُرسلت الرسالة'), '', 'success');
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return <form data-compose-form="" onSubmit={submit}>
    {reply ? <p>{reply.author_name} · {reply.title}</p> : <>
      <label className="formrow"><span className="label">{L('Recipient', 'المستلم')}</span><Select name="target" required><option value="">{L('Choose a recipient', 'اختر المستلم')}</option>{recipients.map((r, i) => <option key={i} value={String(i)}>{`${r.name} · ${r.parishName}`}</option>)}</Select></label>
      <label className="formrow"><span className="label">{L('Subject', 'الموضوع')}</span><input className="input" name="title" required maxLength="160" /></label></>}
    <label className="formrow"><span className="label">{L('Message', 'الرسالة')}</span><textarea className="textarea" name="body" required maxLength="5000" rows="8" /></label>
    <p className="help-error" role="alert">{error}</p><button className="btn btn-primary" disabled={busy}>{L('Send message', 'إرسال الرسالة')}</button></form>;
}
const compose = (recipients, done, reply = null) => openDrawer({ title: reply ? L('Reply', 'رد') : L('New message', 'رسالة جديدة'), body: <Compose recipients={recipients} reply={reply} done={done} /> });

export function InboxPage() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [round, setRound] = useState(0), [busy, setBusy] = useState('');
  const [, redraw] = useState(0);
  useEffect(() => { api('inbox').then(d => { setData(d); setBusy(''); }, e => setError(e.message)); }, [round]);
  const refresh = () => setRound(n => n + 1);
  const set = patch => { Object.assign(filters, patch); redraw(n => n + 1); };
  if (error || !data) return <><Head /><div data-inbox="" aria-live="polite">{error || L('Loading messages…', 'جارٍ تحميل الرسائل…')}</div></>;
  const parishes = new Map(data.recipients.map(r => [r.parish, r.parishName]));
  for (const p of session.parishes || []) parishes.set(p.id, p.name);
  const mine = m => m.recipient_id === session.user.id;
  const rows = data.messages.filter(m => (filters.box === 'archived' ? !!m.archived : !m.archived && (filters.box === 'sent' ? m.author_id === session.user.id : mine(m))) && (!filters.parish || m.parish_id === filters.parish) && [m.title, m.body, m.author_name, m.recipient_name].join(' ').toLowerCase().includes(filters.query.toLowerCase().trim()));
  const state = async (m, action) => {
    setBusy(m.id + action);
    try { await api('inbox', 'POST', { action, id: m.id }); refresh(); } catch (e) { toast(e.message, '', 'danger'); setBusy(''); }
  };
  const openMessage = async m => {
    openDrawer({
      title: m.title,
      body: <><p>{m.author_name} → {m.recipient_name}</p><div className="message-body">{m.body}</div><p className="help">{L('Message reference', 'مرجع الرسالة')}: {m.id}</p>
        {mine(m) ? <button className="btn btn-primary" data-reply="" onClick={() => compose(data.recipients, refresh, m)}>{L('Reply', 'رد')}</button> : null}</>
    });
    try { await api('inbox', 'POST', { action: 'read', id: m.id }); m.is_read = 1; redraw(n => n + 1); } catch (e) { toast(e.message, '', 'danger'); }
  };
  return <><Head /><div data-inbox="" aria-live="polite">
    <div className="collection-toolbar">
      <label className="sr-only" htmlFor="inbox-search">{L('Search messages', 'ابحث في الرسائل')}</label><input className="input" id="inbox-search" type="search" placeholder={L('Search messages', 'ابحث في الرسائل')} defaultValue={filters.query} onChange={e => set({ query: e.target.value })} />
      <Select data-box="" aria-label={L('Folder', 'المجلّد')} value={filters.box} onChange={e => set({ box: e.target.value })}>{[['received', L('Received', 'الواردة')], ['sent', L('Sent', 'المرسلة')], ['archived', L('Archived', 'المؤرشفة')]].map(([v, s]) => <option key={v} value={v}>{s}</option>)}</Select>
      <Select data-parish="" aria-label={L('Parish', 'الرعية')} value={filters.parish} onChange={e => set({ parish: e.target.value })}><option value="">{L('All parishes', 'كل الرعايا')}</option>{[...parishes].map(([v, s]) => <option key={v} value={v}>{s}</option>)}</Select>
      <button className="btn btn-primary" data-compose="" disabled={!data.recipients.length} onClick={() => compose(data.recipients, refresh)}>{L('New message', 'رسالة جديدة')}</button></div>
    {!data.recipients.length ? <p className="help">{L('Follow a parish in Complete Profile to contact its office.', 'تابع رعية في إكمال الملف للتواصل مع مكتبها.')}</p> : null}
    <div data-messages=""><p className="help">{rows.length} {L('messages', 'رسائل')}</p>
      <Paged className="inbox-grid" data-paginate="">{rows.map(m => <article key={m.id} className={`inbox-card ${!m.is_read && mine(m) ? 'inbox-unread' : ''}`}>
        <div className="account-actions"><small>{parishes.get(m.parish_id) || m.parish_id}</small>{!m.is_read && mine(m) ? <span className="pill">{L('Unread', 'غير مقروءة')}</span> : null}</div>
        <h2><button className="inbox-title" data-open={m.id} onClick={() => openMessage(m)}>{m.title}</button></h2>
        <p>{m.author_id === session.user.id ? L('To: ', 'إلى: ') + m.recipient_name : m.author_name}</p><p className="inbox-preview">{m.body}</p><small>{fmtDate(m.created_at.slice(0, 10))}</small>
        <div className="account-actions"><button className="btn btn-ghost btn-dense" data-state={m.id} data-action={m.is_read ? 'unread' : 'read'} disabled={busy === m.id + (m.is_read ? 'unread' : 'read')} onClick={() => state(m, m.is_read ? 'unread' : 'read')}>{m.is_read ? L('Mark unread', 'تحديد كغير مقروءة') : L('Mark read', 'تحديد كمقروءة')}</button>
          <button className="btn btn-ghost btn-dense" data-state={m.id} data-action={m.archived ? 'unarchive' : 'archive'} disabled={busy === m.id + (m.archived ? 'unarchive' : 'archive')} onClick={() => state(m, m.archived ? 'unarchive' : 'archive')}>{m.archived ? L('Restore', 'استعادة') : L('Archive', 'أرشفة')}</button></div></article>)}</Paged>
      {rows.length ? null : <p className="member-empty">{L('No messages match these filters.', 'لا رسائل تطابق هذه الفلاتر.')}</p>}</div>
  </div></>;
}
const Head = () => <PageHead title={L('Inbox', 'البريد')} sub={L('Private conversations with your parish community.', 'محادثات خاصة مع مجتمع رعيتك.')} />;
