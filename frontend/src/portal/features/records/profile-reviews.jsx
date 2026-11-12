/* Profile corrections: a member asks to correct what a parish holds about them, and the office
   approves the change before the record moves. */
import { useEffect, useState } from 'react';
import { api } from '../../model/api.js';
import { hydrate } from '../../model/persist.js';
import { person } from '../../model/data.js';
import { correctionQueue, reviewCorrection } from '../../model/modules/people-workflows.js';
import { t } from '../../../lib/i18n.js';
import { PageHead, Panel, openDrawer, closeOverlays, toast, Paged } from '../../ui/ui.jsx';
import { AddressCascade, readAddressCascade } from '../../ui/geography.jsx';

const fields = {
  name: ['Full name', 'الاسم الكامل'],
  nameAr: ['Arabic name', 'الاسم بالعربية'],
  birthDate: ['Date of birth', 'تاريخ الميلاد'],
  phone: ['Phone', 'الهاتف'],
  email: ['Email', 'البريد الإلكتروني'],
  occupation: ['Occupation', 'المهنة'],
  language: ['Preferred language', 'اللغة المفضلة'],
  governorate: ['Governorate', 'المحافظة'],
  district: ['District', 'القضاء'],
  town: ['Town', 'البلدة'],
  townAr: ['Town in Arabic', 'البلدة بالعربية'],
  sector: ['Sector', 'الحيّ']
};

const status = s =>
  ({
    pending: t('Waiting for office review', 'بانتظار مراجعة المكتب'),
    approved: t('Approved', 'مقبول'),
    declined: t('Declined', 'مرفوض')
  })[s] || s;

const Changes = ({ data }) => (
  <div className="tablewrap">
    <div className="tablescroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>{t('Field', 'الحقل')}</th>
            <th>{t('Current record at submission', 'السجل وقت التقديم')}</th>
            <th>{t('Requested value', 'القيمة المطلوبة')}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.changes).map(([k, v]) => (
            <tr key={k}>
              <td>{fields[k] ? t(...fields[k]) : k}</td>
              <td>{data.before[k] || '—'}</td>
              <td>{v || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ---------- on My account: what each parish holds about me ---------- */
function CorrectionForm({ record, pending, done }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    p = record.profile;
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    try {
      await api('account/records', 'POST', {
        parish: record.parish,
        profile: { ...Object.fromEntries(new FormData(form)), ...readAddressCascade(form, 'profile-address') }
      });
      closeOverlays();
      done();
      toast(t('Sent for office review', 'أُرسلت للمراجعة'), '', 'success');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <div className="formgrid">
        {['name', 'nameAr', 'birthDate', 'phone', 'email', 'occupation', 'language'].map(k => (
          <label key={k} className="formrow">
            <span className="label">{t(...fields[k])}</span>
            <input
              className="input"
              name={k}
              type={k === 'birthDate' ? 'date' : k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'}
              defaultValue={p[k] || ''}
              maxLength={['name', 'nameAr'].includes(k) ? 120 : 500}
              required={k === 'name'}
            />
          </label>
        ))}
      </div>
      <AddressCascade value={p} prefix="profile-address" />
      <p className="help">
        {pending
          ? t('Your previous changes are still awaiting review.', 'تغييراتك السابقة ما زالت بانتظار المراجعة.')
          : t(
              'The office will review changes before updating this record.',
              'سيراجع المكتب التغييرات قبل تحديث هذا السجل.'
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
  const [data, setData] = useState(null),
    [round, setRound] = useState(0);
  useEffect(() => {
    api('account/records').then(setData, () => {});
  }, [round]);
  if (!data) return null;
  const correct = record =>
    openDrawer({
      title: record.parishName,
      body: (
        <CorrectionForm
          record={record}
          pending={data.requests.some(r => r.parish_id === record.parish && r.status === 'pending')}
          done={() => setRound(r => r + 1)}
        />
      )
    });
  return (
    <Panel title={t('My parish records', 'سجلاتي الرعوية')}>
      <p className="help">
        {t(
          'Review the information already held by each parish. Submit corrections for office approval. Changes here do not replace your sign-in email or phone.',
          'راجع المعلومات المسجّلة في كل رعية وأرسل التصحيحات لموافقة المكتب. لا تغيّر هذه التصحيحات بريد أو هاتف تسجيل الدخول.'
        )}
      </p>
      <Paged className="account-parishes" data-paginate="">
        {data.records.length ? (
          data.records.map(r => (
            <article key={r.parish}>
              <div>
                <h3>{r.parishName}</h3>
                <p>
                  {r.profile.name} · {r.profile.phone || '—'}
                </p>
              </div>
              <button className="btn btn-secondary" data-correct={r.parish} onClick={() => correct(r)}>
                {t('Review my information', 'مراجعة معلوماتي')}
              </button>
            </article>
          ))
        ) : (
          <p>
            {t(
              'Once the office links your membership, your parish records will appear here. You can request membership below.',
              'تظهر سجلاتك هنا بعد ربط عضويتك من المكتب. يمكنك طلب العضوية أدناه.'
            )}
          </p>
        )}
      </Paged>
      <Paged className="account-parishes" data-paginate="">
        {data.requests.map((r, i) => (
          <article key={i}>
            <div>
              <h3>{data.records.find(p => p.parish === r.parish_id)?.parishName || r.parish_id}</h3>
              <p>
                {status(r.status)} · {r.created_at.slice(0, 10)}
              </p>
              <details>
                <summary>{t('View proposed changes', 'عرض التغييرات المقترحة')}</summary>
                <Changes data={r.data} />
              </details>
            </div>
          </article>
        ))}
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
