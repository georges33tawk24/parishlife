/* Profile corrections: a member asks to correct what a parish holds about them, and the office approves the change
   before the record moves.
   On My account, RecordCorrections shows "My parish records": GET account/records returns only the account's own linked
   person in each parish (and that person's own corrections); a correction goes to POST
   parishes/{id}/profile-corrections, the existing office review. ProfileReviews is the office's queue. */
import { useEffect, useState } from 'react';
import { hydrate } from '../../model/persist.js';
import { person } from '../../model/data.js';
import { correctionQueue, reviewCorrection } from '../../model/modules/people-workflows.js';
import { loadRecords, proposeCorrection } from '../../model/account.js';
import { t } from '../../../lib/i18n.js';
import { PageHead, Panel, openDrawer, closeOverlays, toast, Paged } from '../../ui/ui.jsx';

const STATUS = () => ({
  Pending: t('Waiting for office review', 'بانتظار مراجعة المكتب'),
  Reviewed: t('Reviewed', 'تمت المراجعة'),
  Withdrawn: t('Withdrawn', 'مسحوب')
});
const DECISION = () => ({ Approved: t('Approved', 'مقبول'), Declined: t('Declined', 'مرفوض') });
const current = (r, field) =>
  ({ GivenName: r.givenName, FamilyName: r.familyName, BirthDate: r.birthDate || '', Contact: r.contact || '' })[field];

/* ---------- on My account: what each parish holds about me ---------- */
function CorrectionForm({ record, pending, done }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const changes = Object.keys(CORRECTED)
      .filter(f => String(data.get(f) || '').trim() !== String(current(record, f) || ''))
      .map(f => ({
        field: f,
        newValue: String(data.get(f) || '').trim(),
        evidence: String(data.get('evidence') || '').trim() || null
      }));
    if (!changes.length) return setError(t('Change at least one field.', 'غيّر حقلاً واحداً على الأقل.'));
    setBusy(true);
    try {
      await proposeCorrection(record.parishId, changes);
      closeOverlays();
      done();
      toast(t('Sent for office review', 'أُرسلت للمراجعة'), '', 'success');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} data-correction-form="">
      <div className="formgrid">
        {Object.keys(CORRECTED).map(f => (
          <label key={f} className="formrow">
            <span className="label">{label(f)}</span>
            <input
              className="input"
              name={f}
              type={f === 'BirthDate' ? 'date' : 'text'}
              defaultValue={current(record, f)}
              maxLength={300}
              required={f === 'GivenName' || f === 'FamilyName'}
            />
          </label>
        ))}
      </div>
      <label className="formrow">
        <span className="label">{t('Supporting evidence', 'المستند الداعم')}</span>
        <input className="input" name="evidence" maxLength={1000} />
      </label>
      <p className="help">
        {pending
          ? t('Your previous changes are still awaiting review.', 'تغييراتك السابقة ما زالت بانتظار المراجعة.')
          : t(
              'Name and birth-date changes need supporting evidence. The office reviews every change before the record moves.',
              'تحتاج تغييرات الاسم وتاريخ الميلاد إلى مستند داعم. يراجع المكتب كل تغيير قبل تعديل السجل.'
            )}
      </p>
      <p role="alert" className="help-error">
        {error}
      </p>
      <button className="btn btn-primary" disabled={pending || busy}>
        {t('Submit changes to the office', 'إرسال التغييرات إلى المكتب')}
      </button>
    </form>
  );
}

export function RecordCorrections() {
  const [records, setRecords] = useState(null),
    [round, setRound] = useState(0);
  useEffect(() => {
    loadRecords().then(setRecords, () => setRecords(null));
  }, [round]);
  if (!records) return null;
  const correct = record =>
    openDrawer({
      title: record.parishName,
      body: (
        <CorrectionForm
          record={record}
          pending={record.corrections.some(c => c.value.status === 'Pending')}
          done={() => setRound(r => r + 1)}
        />
      )
    });
  return (
    <Panel title={t('My parish records', 'سجلاتي الرعوية')}>
      <p className="help">
        {t(
          'The information each parish holds about you. Submit corrections for office approval. Changes here do not replace your sign-in email.',
          'المعلومات التي تسجّلها كل رعية عنك. أرسل التصحيحات لموافقة المكتب. لا تغيّر هذه التصحيحات بريد تسجيل الدخول.'
        )}
      </p>
      <Paged className="account-parishes" data-paginate="">
        {records.length ? (
          records.map(r => (
            <article key={r.parishId} data-record={r.parishId}>
              <div>
                <h3>{r.parishName}</h3>
                <p>
                  {r.givenName} {r.familyName} · {r.birthDate || '—'} · {r.contact || '—'}
                </p>
                {r.corrections.map(({ value: c }) => (
                  <details key={c.id}>
                    <summary>
                      {STATUS()[c.status] || c.status} · {String(c.submittedAt).slice(0, 10)}
                    </summary>
                    <ul>
                      {c.fields.map(f => (
                        <li key={f.field}>
                          {label(f.field)}: {f.oldValue || '—'} → {f.newValue}
                          {f.decision ? ` · ${DECISION()[f.decision] || f.decision}` : ''}
                          {f.reason ? ` (${f.reason})` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
              <button className="btn btn-secondary" data-correct={r.parishId} onClick={() => correct(r)}>
                {t('Review my information', 'مراجعة معلوماتي')}
              </button>
            </article>
          ))
        ) : (
          <p>
            {t(
              'Once a parish office links your membership, your parish records will appear here. You can request membership under My parishes.',
              'تظهر سجلاتك هنا بعد أن يربط مكتب الرعية عضويتك. يمكنك طلب العضوية في «رعاياي».'
            )}
          </p>
        )}
      </Paged>
    </Panel>
  );
}

/* ---------- the office's review: GET profile-corrections lists the pending ones ---------- */
const CORRECTED = {
  GivenName: ['Given name', 'الاسم الأول'],
  FamilyName: ['Family name', 'اسم العائلة'],
  BirthDate: ['Date of birth', 'تاريخ الميلاد'],
  Contact: ['Contact', 'جهة الاتصال']
};
const label = f => (CORRECTED[f] ? t(...CORRECTED[f]) : f);

function Decide({ row, done }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [approve, setApprove] = useState(Object.fromEntries(row.value.fields.map(f => [f.field, true])));
  const submit = async e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await reviewCorrection(
        row,
        row.value.fields.map(f => ({
          field: f.field,
          approve: approve[f.field],
          reason: form.get('reason-' + f.field)
        }))
      );
      closeOverlays();
      toast(t('Review saved', 'حُفظت المراجعة'), '', 'success');
      await hydrate();
      done();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <div className="tablewrap">
        <div className="tablescroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('Field', 'الحقل')}</th>
                <th>{t('Current record', 'السجل الحالي')}</th>
                <th>{t('Requested value', 'القيمة المطلوبة')}</th>
                <th>{t('Decision', 'القرار')}</th>
              </tr>
            </thead>
            <tbody>
              {row.value.fields.map(f => (
                <tr key={f.field}>
                  <td>{label(f.field)}</td>
                  <td>{f.oldValue || '—'}</td>
                  <td>{f.newValue || '—'}</td>
                  <td>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={approve[f.field]}
                        onChange={e => setApprove({ ...approve, [f.field]: e.target.checked })}
                      />
                      <span>{t('Approve', 'موافقة')}</span>
                    </label>
                    {approve[f.field] ? null : (
                      <input
                        className="input"
                        name={'reason-' + f.field}
                        maxLength={1000}
                        required
                        placeholder={t('Reason for declining', 'سبب الرفض')}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="help">
        {t(
          'Only the approved fields change. If the record changed since the request, decline that field with a reason so a fresh request can be made. Sign-in details stay separate.',
          'تتغير الحقول المقبولة فقط. إذا تغيّر السجل بعد الطلب فارفض الحقل مع السبب ليُقدَّم طلب جديد. تبقى معلومات تسجيل الدخول منفصلة.'
        )}
      </p>
      <p role="alert" className="help-error">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {t('Save review', 'حفظ المراجعة')}
      </button>
    </form>
  );
}

export function ProfileReviews() {
  const [rows, setRows] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0);
  useEffect(() => {
    correctionQueue().then(setRows, e => setError(e.message));
  }, [round]);
  const review = row =>
    openDrawer({
      title: t('Profile correction', 'تصحيح الملف'),
      body: <Decide row={row} done={() => setRound(n => n + 1)} />
    });
  return (
    <>
      <PageHead
        title={t('Profile corrections', 'تصحيحات الملفات')}
        sub={t(
          'Review requested changes before updating official parish records.',
          'راجع التغييرات المطلوبة قبل تحديث سجلات الرعية الرسمية.'
        )}
      />
      <div data-profile-reviews="">
        {error ? (
          error
        ) : !rows ? (
          t('Loading…', 'جارٍ التحميل…')
        ) : (
          <>
            <a className="btn btn-secondary" href="#/requests">
              {t('All requests', 'كل الطلبات')}
            </a>
            <Paged className="account-parishes" data-paginate="">
              {rows.length ? (
                rows.map(row => (
                  <article key={row.value.id} data-review-status="pending">
                    <div>
                      <h3>{person(row.value.personId)?.lat || t('A parishioner', 'مؤمن')}</h3>
                      <p>
                        {row.value.fields.map(f => label(f.field)).join(' · ')} ·{' '}
                        {t('Waiting for office review', 'بانتظار مراجعة المكتب')} ·{' '}
                        {String(row.value.submittedAt).slice(0, 10)}
                      </p>
                    </div>
                    <button className="btn btn-secondary" data-review={row.value.id} onClick={() => review(row)}>
                      {t('View changes', 'عرض التغييرات')}
                    </button>
                  </article>
                ))
              ) : (
                <p>{t('No profile corrections waiting for review.', 'لا تصحيحات بانتظار المراجعة.')}</p>
              )}
            </Paged>
          </>
        )}
      </div>
    </>
  );
}
