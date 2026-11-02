/* Bishop-only reporting. The API supplies a limited read-only projection. */
import { useEffect, useState } from 'react';
import { api, session } from '../model/api.js';
import { t, fmtDate } from '../../lib/i18n.js';
import { S } from '../model/store.js';
import { PageHead, Table, Stat, Status, openDrawer, Icon } from '../ui/ui.jsx';
import { Select } from '../ui/components.jsx';
import { CalendarView } from '../ui/collection.jsx';

const cache = new Map();
const L = (en, ar) => t(en, ar);
const key = id => `${session.user?.id}:${id || 'all'}`;
const PersonName = ({ p }) => <>{p?.lat || '—'}<small style={{ display: 'block' }} dir="rtl">{p?.ar || ''}</small></>;
const Link = ({ to, children }) => <a href={to} className="text-link">{children}</a>;
const Rows = ({ items, cols }) => items.length ? <Table cols={cols.map(label => ({ label }))} rows={items.map(cells => ({ cells }))} />
  : <p className="help" style={{ padding: '18px' }}>{L('No records to show.', 'لا سجلات لعرضها.')}</p>;
const Block = ({ id, title, children }) => <details className="panel oversight-section" id={`oversight-${id}`} open>
  <summary className="panel-h"><b>{title}</b><span className="oversight-chevron" aria-hidden="true"><Icon name="chevD" size={16} /></span></summary><div className="panel-b tight">{children}</div></details>;
const calendarStates = new Map();
const calendarState = id => { if (!calendarStates.has(id)) calendarStates.set(id, { mode: 'month' }); return calendarStates.get(id); };
const Back = ({ parishId }) => <Link to={`#/oversight/${parishId}`}><Icon name="chevL" size={15} />{L('Back to parish', 'العودة إلى الرعية')}</Link>;

function PersonDetail({ entry, parishId, personId }) {
  const p = entry.people.find(x => x.id === personId);
  if (!p) return <p className="alert alert-danger">{L('Person not found.', 'الشخص غير موجود.')}</p>;
  const records = entry.records.filter(r => r.personId === personId);
  return <><Back parishId={parishId} /><h2 style={{ margin: '18px 0 8px' }}><PersonName p={p} /></h2>
    <p className="help">{L('Read-only profile. Private member and pastoral records are excluded.', 'ملف للقراءة فقط. لا يشمل بيانات الأعضاء الخاصة أو السجلات الرعوية السرية.')}</p>
    <div className="stats" style={{ margin: '18px 0' }}><Stat k={L('Status', 'الحالة')} v={p.status} /><Stat k={L('Town', 'البلدة')} v={L(p.town, p.townAr || p.town)} /><Stat k={L('Rite', 'الطقس')} v={p.rite || '—'} /></div>
    <Block id="household" title={L('Household and groups', 'العائلة والمجموعات')}><div style={{ padding: '18px' }}><p>{L('Household', 'العائلة')}: <b>{L(p.household?.name || '—', p.household?.ar || p.household?.name || '—')}</b></p>
      <p style={{ marginTop: '10px' }}>{L('Groups', 'المجموعات')}: {p.groups.length ? p.groups.map((g, i) => <span key={g.id}>{i ? ', ' : ''}<Link to={`#/oversight/${parishId}/group/${g.id}`}>{L(g.name, g.ar || g.name)}</Link></span>) : '—'}</p></div></Block>
    <Block id="records" title={L('Sacraments and requests', 'الأسرار والطلبات')}><Rows items={records.map(r => [r.reference || '—', r.kind, fmtDate(r.date), <Status k={r.status} />])}
      cols={[L('Reference', 'المرجع'), L('Type', 'النوع'), L('Date', 'التاريخ'), L('Status', 'الحالة')]} /></Block></>;
}

function GroupDetail({ entry, parishId, groupId }) {
  const g = entry.groups.find(x => x.id === groupId);
  if (!g) return <p className="alert alert-danger">{L('Group not found.', 'المجموعة غير موجودة.')}</p>;
  return <><Back parishId={parishId} /><h2 style={{ margin: '18px 0 8px' }}>{L(g.name, g.ar || g.name)}</h2>
    <p className="help">{L('Read-only group activity based on recorded meetings.', 'نشاط المجموعة للقراءة فقط، وفق الاجتماعات المسجلة.')}</p>
    <div className="stats" style={{ margin: '18px 0' }}><Stat k={L('Members', 'الأعضاء')} v={g.members} /><Stat k={L('Meetings', 'الاجتماعات')} v={g.meetings.length} />
      <Stat k={L('Attendance', 'الحضور')} v={g.attendance.percentage === null ? '—' : `${g.attendance.percentage}%`} d={`${g.attendance.present} / ${g.attendance.recorded} ${L('recorded', 'مسجّل')}`} /></div>
    <Block id="roster" title={L('Members', 'الأعضاء')}><Rows items={g.roster.map(p => [<Link to={`#/oversight/${parishId}/person/${p.id}`}><PersonName p={p} /></Link>])} cols={[L('Person', 'الشخص')]} /></Block>
    <Block id="meetings" title={L('Meetings', 'الاجتماعات')}><Rows items={g.meetings.map(m => [m.title, fmtDate(m.date), m.time || '—', m.recorded ? `${m.present} / ${m.recorded}` : '—'])}
      cols={[L('Meeting', 'الاجتماع'), L('Date', 'التاريخ'), L('Time', 'الوقت'), L('Present / recorded', 'حاضر / مسجّل')]} /></Block></>;
}

function ParishView({ entry, id }) {
  const [, redraw] = useState(0);
  const set = (field, value) => { S.ui[field] = value; redraw(n => n + 1); };
  const q = (S.ui.oversightRecordQ || '').toLocaleLowerCase(), kind = S.ui.oversightRecordKind || '', state = S.ui.oversightRecordStatus || '';
  const filtered = entry.records.filter(r => (!kind || r.kind === kind) && (!state || r.status === state) && (!q || `${r.reference} ${r.kind} ${r.person?.lat} ${r.person?.ar}`.toLocaleLowerCase().includes(q)));
  const titles = [['people', L('People', 'المؤمنون')], ['records', L('Sacraments & requests', 'الأسرار والطلبات')], ['events', L('Calendar', 'الرزنامة')], ['groups', L('Groups', 'المجموعات')], ['activity', L('Activity', 'النشاط')]];
  const events = (entry.events || []).map(e => ({ ...e, title: L(e.title, e.titleAr || e.title), subtitle: e.kind }));
  const openEvent = eventId => { const e = events.find(x => x.id === eventId); if (e) openDrawer({ title: e.title, body: <><p>{e.date} · {e.time || ''}</p><p>{e.kind}</p></> }); };
  return <><h2>{entry.parish.name} <small dir="rtl">{entry.parish.ar}</small></h2>
    <div className="stats" style={{ margin: '16px 0' }}><Stat k={L('People', 'المؤمنون')} v={entry.counts.people} /><Stat k={L('Groups', 'المجموعات')} v={entry.counts.groups} /><Stat k={L('Official entries', 'القيود الرسمية')} v={entry.counts.registers} /></div>
    <nav className="toolbar oversight-jump" aria-label={L('Oversight sections', 'أقسام الإشراف')}>{titles.map(([section, title]) => <button key={section} className="btn btn-secondary btn-dense" data-oversight-jump={section}
      onClick={() => document.getElementById(`oversight-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{title}</button>)}</nav>
    <Block id="people" title={L('People', 'المؤمنون')}><Rows items={entry.people.map(p => [<Link to={`#/oversight/${id}/person/${p.id}`}><PersonName p={p} /></Link>, <Status k={p.status} />, L(p.town, p.townAr || p.town)])}
      cols={[L('English / Arabic name', 'الاسم الإنكليزي / العربي'), L('Status', 'الحالة'), L('Town', 'البلدة')]} /></Block>
    <Block id="records" title={L('Sacraments and requests', 'الأسرار والطلبات')}><div className="toolbar" style={{ padding: '14px', gap: '8px' }}>
      <input className="input" id="oversight-record-q" type="search" placeholder={L('Search reference or person', 'ابحث عن المرجع أو الشخص')} value={S.ui.oversightRecordQ || ''} onChange={e => set('oversightRecordQ', e.target.value)} />
      <Select id="oversight-record-kind" aria-label={L('Type', 'النوع')} value={kind} onChange={e => set('oversightRecordKind', e.target.value)}><option value="">{L('All types', 'كل الأنواع')}</option>{[...new Set(entry.records.map(r => r.kind))].sort().map(x => <option key={x} value={x}>{x}</option>)}</Select>
      <Select id="oversight-record-status" aria-label={L('Status', 'الحالة')} value={state} onChange={e => set('oversightRecordStatus', e.target.value)}><option value="">{L('All statuses', 'كل الحالات')}</option>{[...new Set(entry.records.map(r => r.status))].sort().map(x => <option key={x} value={x}>{x}</option>)}</Select></div>
      <Rows items={filtered.map(r => [r.reference || '—', r.personId ? <Link to={`#/oversight/${id}/person/${r.personId}`}><PersonName p={r.person} /></Link> : <PersonName p={r.person} />, r.kind, fmtDate(r.date), <Status k={r.status} />])}
        cols={[L('Reference', 'المرجع'), L('Person', 'الشخص'), L('Type', 'النوع'), L('Date', 'التاريخ'), L('Status', 'الحالة')]} /></Block>
    <Block id="events" title={L('Calendar activities', 'أنشطة الرزنامة')}><div data-oversight-calendar="">{entry.events ? <CalendarView events={events} state={calendarState(id)} onOpen={openEvent} /> : null}</div></Block>
    <Block id="groups" title={L('Group activity', 'نشاط المجموعات')}><Rows items={entry.groups.map(g => [<Link to={`#/oversight/${id}/group/${g.id}`}>{L(g.name, g.ar || g.name)}<Icon name="ext" size={13} cls="ext-mark" /></Link>, String(g.members), String(g.meetings.length),
      g.attendance.percentage === null ? '—' : `${g.attendance.percentage}%`])} cols={[L('Group', 'المجموعة'), L('Members', 'الأعضاء'), L('Meetings', 'الاجتماعات'), L('Recorded attendance', 'الحضور المسجل')]} /></Block>
    <Block id="activity" title={L('Recent administrative activity', 'النشاط الإداري الأخير')}><Rows items={entry.activity.map(a => [new Date(a.at).toLocaleString(document.documentElement.lang === 'ar' ? 'ar-LB' : 'en-GB'), a.actor, a.action.replaceAll('.', ' ')])}
      cols={[L('When', 'الوقت'), L('By', 'بواسطة'), L('Activity', 'النشاط')]} /></Block></>;
}

export function Oversight({ params: [id = '', detail = '', detailId = ''] = [] }) {
  const [entry, setEntry] = useState(() => cache.get(key(id)));
  useEffect(() => {
    const k = key(id), old = cache.get(k);
    if (old && (old.loading || Date.now() - (old.loadedAt || 0) < 60_000)) return;
    if (!old) cache.set(k, { loading: true });
    api(id ? `parishes/${encodeURIComponent(id)}/oversight` : 'oversight').then(data => cache.set(k, { ...data, loadedAt: Date.now() }))
      .catch(error => cache.set(k, { error: error.message, loadedAt: Date.now() })).finally(() => setEntry(cache.get(k)));
  }, []);
  const head = <PageHead title={L('Parish oversight', 'الإشراف على الرعايا')} sub={L('Parish activity and records. Use Administration to manage parishes, accounts and bundles.', 'أنشطة الرعايا وسجلاتها. استخدم الإدارة لإدارة الرعايا والحسابات والباقات.')} />;
  const picker = <div className="toolbar" style={{ margin: '18px 0' }}><label htmlFor="oversight-parish">{L('Parish', 'الرعية')}</label>
    <Select id="oversight-parish" value={id} onChange={e => { location.hash = '#/oversight' + (e.target.value ? '/' + e.target.value : ''); }}><option value="">{L('All parishes', 'كل الرعايا')}</option>
      {session.parishes.map(p => <option key={p.id} value={p.id}>{p.name} — {p.ar}</option>)}</Select></div>;
  let body;
  if (!entry || entry.loading) body = <p role="status">{L('Loading oversight…', 'جارٍ تحميل بيانات الإشراف…')}</p>;
  else if (entry.error) body = <p className="alert alert-danger">{entry.error}</p>;
  else if (!id) body = <Rows items={entry.parishes.map(x => [<>{x.parish.name}<small style={{ display: 'block' }}>{x.parish.ar}</small></>, `${x.counts.people} / ${x.counts.households}`,
    String(x.counts.registers), String(x.counts.pendingRequests), String(x.counts.upcomingEvents), <Link to={`#/oversight/${x.parish.id}`}>{L('View parish', 'عرض الرعية')}</Link>])}
    cols={[L('Parish', 'الرعية'), L('People / households', 'المؤمنون / العائلات'), L('Official entries', 'القيود الرسمية'), L('Open requests', 'الطلبات المفتوحة'), L('Upcoming events', 'الأحداث المقبلة'), '']} />;
  else if (detail === 'person') body = <PersonDetail entry={entry} parishId={id} personId={detailId} />;
  else if (detail === 'group') body = <GroupDetail entry={entry} parishId={id} groupId={detailId} />;
  else body = <ParishView entry={entry} id={id} />;
  return <>{head}{picker}{body}</>;
}

const ParishRows = ({ label }) => <Rows items={(session.parishes || []).map(p => [<>{p.name}<small style={{ display: 'block' }}>{p.ar}</small></>, L(p.town, p.townAr || p.town), <Link to={`#/oversight/${p.id}`}>{label}</Link>])}
  cols={[L('Parish', 'الرعية'), L('Town', 'البلدة'), '']} />;
export function Eparchy() {
  const parishes = session.parishes || [];
  return <><PageHead title={L('Eparchy', 'الأبرشية')} sub={L('Read-only overview of parishes in your archdiocese.', 'نظرة عامة للقراءة فقط على رعايا الأبرشية.')} />
    <div className="stats" style={{ margin: '18px 0' }}><Stat k={L('Parishes', 'الرعايا')} v={parishes.length} /><Stat k={L('People', 'المؤمنون')} v={parishes.reduce((n, p) => n + (p.people || 0), 0)} /></div>
    <ParishRows label={L('View oversight', 'عرض الإشراف')} />
    <p style={{ marginTop: '18px' }}><Link to="#/assignments">{L('View priest assignments', 'عرض تعيينات الكهنة')}</Link></p></>;
}
export function MapView() {
  return <><PageHead title={L('Parish map', 'خريطة الرعايا')} sub={L('Find parishes in the eparchy.', 'تعرّف إلى رعايا الأبرشية.')} />
    <p className="alert alert-info">{L('Exact parish coordinates have not been recorded. This list gives the known town without placing inaccurate map markers.', 'لم تُسجّل الإحداثيات الدقيقة للرعايا بعد. تعرض هذه القائمة البلدات المعروفة دون وضع علامات غير دقيقة على الخريطة.')}</p>
    <div style={{ marginTop: '18px' }}><ParishRows label={L('View parish', 'عرض الرعية')} /></div></>;
}
