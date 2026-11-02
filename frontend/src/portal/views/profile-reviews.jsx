/* Profile corrections: a member asks to correct what a parish holds about them, and the office
   approves the change before the record moves. */
import { useEffect, useState } from 'react';
import { api, session } from '../model/api.js';
import { hydrate } from '../model/persist.js';
import { t } from '../../lib/i18n.js';
import { PageHead, Panel, openDrawer, closeOverlays, toast, Paged } from '../ui/ui.jsx';
import { Select } from '../ui/components.jsx';
import { AddressCascade, readAddressCascade } from '../ui/geography.jsx';

const fields = { name: ['Full name', 'الاسم الكامل'], nameAr: ['Arabic name', 'الاسم بالعربية'], birthDate: ['Date of birth', 'تاريخ الميلاد'], phone: ['Phone', 'الهاتف'], email: ['Email', 'البريد الإلكتروني'], occupation: ['Occupation', 'المهنة'], language: ['Preferred language', 'اللغة المفضلة'], governorate: ['Governorate', 'المحافظة'], district: ['District', 'القضاء'], town: ['Town', 'البلدة'], townAr: ['Town in Arabic', 'البلدة بالعربية'], sector: ['Sector', 'الحيّ'] };
const status = s => ({ pending: t('Waiting for office review', 'بانتظار مراجعة المكتب'), approved: t('Approved', 'مقبول'), declined: t('Declined', 'مرفوض') })[s] || s;
const Changes = ({ data }) => <div className="tablewrap"><table className="tbl">
  <thead><tr><th>{t('Field', 'الحقل')}</th><th>{t('Current record at submission', 'السجل وقت التقديم')}</th><th>{t('Requested value', 'القيمة المطلوبة')}</th></tr></thead>
  <tbody>{Object.entries(data.changes).map(([k, v]) => <tr key={k}><td>{fields[k] ? t(...fields[k]) : k}</td><td>{data.before[k] || '—'}</td><td>{v || '—'}</td></tr>)}</tbody></table></div>;

/* ---------- on My account: what each parish holds about me ---------- */
function CorrectionForm({ record, pending, done }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), p = record.profile;
  const submit = async e => {
    e.preventDefault(); setBusy(true);
    const form = e.currentTarget;
    try {
      await api('account/records', 'POST', { parish: record.parish, profile: { ...Object.fromEntries(new FormData(form)), ...readAddressCascade(form, 'profile-address') } });
      closeOverlays(); done(); toast(t('Sent for office review', 'أُرسلت للمراجعة'), '', 'success');
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return <form onSubmit={submit}>
    <div className="formgrid">{['name', 'nameAr', 'birthDate', 'phone', 'email', 'occupation', 'language'].map(k => <label key={k} className="formrow"><span className="label">{t(...fields[k])}</span>
      <input className="input" name={k} type={k === 'birthDate' ? 'date' : k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'} defaultValue={p[k] || ''} maxLength={['name', 'nameAr'].includes(k) ? 120 : 500} required={k === 'name'} /></label>)}</div>
    <AddressCascade value={p} prefix="profile-address" />
    <p className="help">{pending ? t('Your previous changes are still awaiting review.', 'تغييراتك السابقة ما زالت بانتظار المراجعة.') : t('The office will review changes before updating this record.', 'سيراجع المكتب التغييرات قبل تحديث هذا السجل.')}</p>
    <p role="alert" className="help-error">{error}</p>
    <button className="btn btn-primary" disabled={pending || busy}>{t('Submit changes to the office', 'إرسال التغييرات إلى المكتب')}</button></form>;
}
export function RecordCorrections() {
  const [data, setData] = useState(null), [round, setRound] = useState(0);
  useEffect(() => { api('account/records').then(setData, () => {}); }, [round]);
  if (!data) return null;
  const correct = record => openDrawer({
    title: record.parishName,
    body: <CorrectionForm record={record} pending={data.requests.some(r => r.parish_id === record.parish && r.status === 'pending')} done={() => setRound(r => r + 1)} />
  });
  return <Panel title={t('My parish records', 'سجلاتي الرعوية')}>
    <p className="help">{t('Review the information already held by each parish. Submit corrections for office approval. Changes here do not replace your sign-in email or phone.', 'راجع المعلومات المسجّلة في كل رعية وأرسل التصحيحات لموافقة المكتب. لا تغيّر هذه التصحيحات بريد أو هاتف تسجيل الدخول.')}</p>
    <Paged className="account-parishes" data-paginate="">{data.records.length ? data.records.map(r => <article key={r.parish}><div><h3>{r.parishName}</h3><p>{r.profile.name} · {r.profile.phone || '—'}</p></div>
      <button className="btn btn-secondary" data-correct={r.parish} onClick={() => correct(r)}>{t('Review my information', 'مراجعة معلوماتي')}</button></article>)
      : <p>{t('Once the office links your membership, your parish records will appear here. You can request membership below.', 'تظهر سجلاتك هنا بعد ربط عضويتك من المكتب. يمكنك طلب العضوية أدناه.')}</p>}</Paged>
    <Paged className="account-parishes" data-paginate="">{data.requests.map((r, i) => <article key={i}><div><h3>{data.records.find(p => p.parish === r.parish_id)?.parishName || r.parish_id}</h3>
      <p>{status(r.status)} · {r.created_at.slice(0, 10)}</p>
      <details><summary>{t('View proposed changes', 'عرض التغييرات المقترحة')}</summary><Changes data={r.data} /></details></div></article>)}</Paged>
  </Panel>;
}

/* ---------- the office's review ---------- */
function Decide({ r, done }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const decide = async value => {
    setBusy(true);
    try { await api('workspace/profile-reviews', 'POST', { parish: session.parishId, id: r.id, status: value }); closeOverlays(); await hydrate(); done(); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return <><Changes data={r.data} />
    <p className="help">{t('Only the fields listed above will change. Sign-in details stay separate.', 'ستتغير الحقول المذكورة أعلاه فقط. تبقى معلومات تسجيل الدخول منفصلة.')}</p>
    <p role="alert" className="help-error">{error}</p>
    {r.status === 'pending' ? <div className="account-actions">
      <button className="btn btn-primary" data-decision="approved" disabled={busy} onClick={() => decide('approved')}>{t('Approve changes', 'الموافقة على التغييرات')}</button>
      <button className="btn btn-secondary" data-decision="declined" disabled={busy} onClick={() => decide('declined')}>{t('Decline', 'رفض')}</button></div> : null}</>;
}
export function ProfileReviews() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [round, setRound] = useState(0), [shown, setShown] = useState('pending');
  useEffect(() => { api('workspace/profile-reviews?parish=' + encodeURIComponent(session.parishId)).then(setData, e => setError(e.message)); }, [round]);
  const review = r => openDrawer({ title: r.name, body: <Decide r={r} done={() => setRound(n => n + 1)} /> });
  return <>
    <PageHead title={t('Profile corrections', 'تصحيحات الملفات')} sub={t('Review requested changes before updating official parish records.', 'راجع التغييرات المطلوبة قبل تحديث سجلات الرعية الرسمية.')} />
    <div data-profile-reviews="">{error ? error : !data ? t('Loading…', 'جارٍ التحميل…') : <>
      <a className="btn btn-secondary" href="#/requests">{t('All requests', 'كل الطلبات')}</a>
      <div className="collection-toolbar"><Select data-status="" aria-label={t('Status', 'الحالة')} value={shown} onChange={e => setShown(e.target.value)}>
        <option value="pending">{status('pending')}</option><option value="">{t('All statuses', 'كل الحالات')}</option><option value="approved">{status('approved')}</option><option value="declined">{status('declined')}</option></Select></div>
      <Paged className="account-parishes" data-paginate="">{data.requests.length ? data.requests.map(r => <article key={r.id} data-review-status={r.status} hidden={!!shown && r.status !== shown}>
        <div><h3>{r.name}</h3><p>{status(r.status)} · {r.created_at.slice(0, 10)}</p></div>
        <button className="btn btn-secondary" data-review={r.id} onClick={() => review(r)}>{t('View changes', 'عرض التغييرات')}</button></article>)
        : <p>{t('No profile corrections submitted.', 'لا تصحيحات مقدّمة.')}</p>}</Paged></>}</div>
  </>;
}
