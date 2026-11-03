/* Guest requests: what visitors sent without an account. Responses appear on the applicant's
   private tracking link; documents stay with the office until one is released. */
import { useEffect, useRef, useState } from 'react';
import { reviewGuestLinks } from '../account/guest-links.jsx';
import { api, session, parishAPI } from '../../model/api.js';
import { SACRAMENTS, person } from '../../model/data.js';
import { uploadFile } from './request-documents.jsx';
import { t } from '../../../lib/i18n.js';
import { PageHead, openDrawer, closeOverlays, toast, Icon, CollectionPages } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { sign } from '../../model/signing.js';
import { Drawing } from '../../ui/signature.jsx';
import { passkeyMessage } from '../../model/passkeys.js';

const names = {
  submitted: ['Submitted', 'مُرسل'],
  'office-review': ['Office review', 'مراجعة المكتب'],
  'missing-documents': ['Missing documents', 'مستندات ناقصة'],
  'ready-for-collection': ['Ready for collection', 'جاهز للاستلام'],
  closed: ['Closed', 'مغلق']
};

names['ready-for-download'] = ['Ready for secure download', 'جاهز للتنزيل الآمن'];

/* the office's answer: a status and a response the applicant reads on their tracking link */
function Respond({ r, done }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('workspace/guest-requests', 'POST', { ...Object.fromEntries(new FormData(e.currentTarget)), id: r.id });
      closeOverlays();
      done();
      toast(t('Saved', 'تم الحفظ'), '', 'success');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <>
      <p className="message-body">{r.details.description}</p>
      <dl className="dl">
        <dt>{t('Email', 'البريد')}</dt>
        <dd>{r.details.email || '—'}</dd>
        <dt>{t('Phone', 'الهاتف')}</dt>
        <dd>{r.details.phone || '—'}</dd>
        <dt>{t('On behalf of', 'بالنيابة عن')}</dt>
        <dd>{r.details.behalf || '—'}</dd>
      </dl>
      <button className="btn btn-secondary" type="button" data-account-links="" onClick={() => reviewGuestLinks(r)}>
        {t('Review account links', 'مراجعة ربط الحسابات')}
      </button>
      {['priest', 'secretary'].includes(session.user.role) ? (
        <button className="btn btn-secondary" type="button" data-documents="" onClick={() => guestFiles(r, done)}>
          {t('Documents and secure delivery', 'المستندات والتسليم الآمن')}
        </button>
      ) : null}
      <button className="btn btn-secondary" type="button" data-letter="" onClick={() => signedLetter(r, done)}>
        <Icon name="edit" size={15} />
        {t('Write a signed letter', 'كتابة رسالة موقّعة')}
      </button>
      <form onSubmit={submit}>
        <label className="formrow">
          <span className="label">{t('Status', 'الحالة')}</span>
          <Select name="status" defaultValue={r.status}>
            {Object.entries(names).map(([v, l]) => (
              <option key={v} value={v}>
                {t(...l)}
              </option>
            ))}
          </Select>
        </label>
        <label className="formrow">
          <span className="label">{t('Response for the applicant', 'ردّ لمقدّم الطلب')}</span>
          <textarea className="textarea" name="response" maxLength="2000" rows="6" defaultValue={r.response} />
        </label>
        <p role="alert" className="help-error">
          {error}
        </p>
        <button className="btn btn-primary" disabled={busy}>
          {t('Save response', 'حفظ الرد')}
        </button>
      </form>
    </>
  );
}

export function GuestRequests() {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0);
  const [q, setQ] = useState(''),
    [status, setStatus] = useState('');
  const table = useRef(null);
  useEffect(() => {
    api('workspace/guest-requests?parish=' + encodeURIComponent(session.parishId)).then(setData, e =>
      setError(e.message)
    );
  }, [round]);
  const reload = () => setRound(n => n + 1);
  const review = r => openDrawer({ title: r.details.name, body: <Respond r={r} done={reload} /> });
  const query = q.toLowerCase().trim();
  return (
    <>
      <PageHead
        title={t('Guest requests', 'طلبات الزوّار')}
        sub={t(
          'Requests submitted without an account. Responses appear on the applicant’s private tracking link.',
          'طلبات مرسلة دون حساب. تظهر الردود على رابط المتابعة الخاص بمقدّم الطلب.'
        )}
      />
      <div data-guests="" aria-live="polite">
        {error ? (
          error
        ) : !data ? (
          t('Loading…', 'جارٍ التحميل…')
        ) : (
          <>
            <a className="btn btn-secondary" href="#/requests">
              {t('All parish requests', 'كل طلبات الرعية')}
            </a>
            <div className="collection-toolbar">
              <input
                className="input"
                type="search"
                data-search=""
                placeholder={t('Search guest requests', 'ابحث في طلبات الزوّار')}
                aria-label={t('Search requests', 'البحث في الطلبات')}
                value={q}
                onChange={e => setQ(e.target.value)}
              />
              <Select
                data-status=""
                aria-label={t('Status', 'الحالة')}
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="">{t('All statuses', 'كل الحالات')}</option>
                {Object.entries(names).map(([v, l]) => (
                  <option key={v} value={v}>
                    {t(...l)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="tablewrap" ref={table}>
              <div className="tablescroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      {[
                        t('Applicant', 'مقدّم الطلب'),
                        t('Type', 'النوع'),
                        t('Contact', 'التواصل'),
                        t('Status', 'الحالة'),
                        t('Received', 'الاستلام'),
                        t('Review', 'مراجعة')
                      ].map((x, i) => (
                        <th key={i}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests.map(r => {
                      const text = [r.details.name, r.details.description, r.details.email, r.details.phone]
                        .join(' ')
                        .toLowerCase();
                      return (
                        <tr
                          key={r.id}
                          data-search-text={text}
                          data-request-status={r.status}
                          hidden={!text.includes(query) || (!!status && r.status !== status)}
                        >
                          <td>{r.details.name}</td>
                          <td>{r.details.kind}</td>
                          <td>{r.details.email || r.details.phone}</td>
                          <td>{names[r.status] ? t(...names[r.status]) : r.status}</td>
                          <td>{r.created_at.slice(0, 10)}</td>
                          <td>
                            <button
                              className="btn btn-secondary btn-dense"
                              data-review={r.id}
                              onClick={() => review(r)}
                            >
                              {t('Review', 'مراجعة')}
                              {r.pendingLinks ? ' · ' + r.pendingLinks + ' ' + t('account links', 'ربط حسابات') : ''}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <CollectionPages target={table} body={c => c.querySelector('tbody')} />
            {data.requests.length ? null : <p>{t('No guest requests yet.', 'لا طلبات زوّار بعد.')}</p>}
          </>
        )}
      </div>
    </>
  );
}

/* A letter to the applicant, signed with the writer's own signature and sent at once: it appears
   on the applicant's private tracking page with a code that checks it. */
function Letter({ request, mine, done }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = e.currentTarget;
    const letter = {
      parish: request.parish_id || session.parishId,
      request: request.id,
      title: form.elements.title.value.trim(),
      body: form.elements.body.value.trim()
    };
    try {
      const result = await api('sign/letter', 'POST', {
        ...letter,
        signature: await sign({ type: 'letter', ...letter })
      });
      closeOverlays();
      done();
      toast(
        t('Letter signed and sent', 'وُقّعت الرسالة وأُرسلت'),
        t(`Check code ${result.code}`, `رمز التحقّق ${result.code}`),
        'success'
      );
    } catch (err) {
      setError(passkeyMessage(err, t));
      setBusy(false);
    }
  };
  return (
    <form className="sig-letter" onSubmit={submit}>
      <p className="help">
        {t('To', 'إلى')}: <b>{request.details.name}</b> ·{' '}
        {t(
          'It appears on their private tracking page as soon as you sign it.',
          'تظهر على صفحة المتابعة الخاصة به فور توقيعها.'
        )}
      </p>
      <label className="formrow">
        <span className="label">{t('Subject', 'الموضوع')}</span>
        <input className="input" name="title" required minLength="3" maxLength="160" dir="auto" />
      </label>
      <label className="formrow">
        <span className="label">{t('Letter', 'الرسالة')}</span>
        <textarea className="textarea" name="body" rows="12" required minLength="10" maxLength="6000" dir="auto" />
      </label>
      {mine ? (
        <>
          <figure className="sig-card is-small">
            <Drawing path={mine.drawing} />
            <figcaption>
              <b>{session.user.name}</b>
              {mine.title ? <span>{mine.title}</span> : null}
            </figcaption>
          </figure>
          <p className="help">
            <Icon name="lock" size={15} />
            {t('Signing asks for your face, fingerprint or PIN.', 'يطلب التوقيع وجهك أو بصمتك أو رمزك.')}
          </p>
        </>
      ) : (
        <p className="help-error">
          {t(
            'Set up your signature under My account before signing letters.',
            'أعدّ توقيعك في «حسابي» قبل توقيع الرسائل.'
          )}{' '}
          <a href="#/account">{t('Open My account', 'فتح حسابي')}</a>
        </p>
      )}
      <p role="alert" className="help-error">
        {error}
      </p>
      <button className="btn btn-primary" disabled={!mine || busy}>
        {t('Sign and send', 'التوقيع والإرسال')}
      </button>
    </form>
  );
}

async function signedLetter(request, done) {
  let mine = null;
  try {
    mine = (await api('account/signature')).signer;
  } catch {
    /* no signature yet */
  }
  openDrawer({
    title: t('Signed letter', 'رسالة موقّعة'),
    large: true,
    body: <Letter request={request} mine={mine} done={done} />
  });
}

/* ---------- documents for a guest request ---------- */
function Release({ request, fileId, done }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const issued = SACRAMENTS.filter(
    s => s.kind === 'certificate' && s.status === 'issued' && (!s.bishopReview || s.bishopReview === 'accepted')
  );
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    try {
      await api('workspace/release-document', 'POST', {
        ...Object.fromEntries(new FormData(form)),
        id: request.id,
        fileId,
        verified: form.elements.verified.checked
      });
      closeOverlays();
      done();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      {request.details.kind === 'certificate' ? (
        <label className="formrow">
          <span className="label">
            {t('Signed certificate accepted by the bishop', 'شهادة موقّعة ومقبولة من المطران')}
          </span>
          <Select name="recordId" required>
            <option value="">{t('Choose matching certificate', 'اختر الشهادة المطابقة')}</option>
            {issued.map(s => (
              <option key={s.id} value={s.id}>
                {s.reg} · {person(s.person)?.lat || ''}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <label className="check">
        <input type="checkbox" name="verified" required />
        {t(
          'I verified the applicant’s identity and checked that this is the correct document.',
          'تحققت من هوية مقدّم الطلب ومن أن هذا المستند هو المطلوب.'
        )}
      </label>
      <p className="help">
        {t(
          'Anyone with the private tracking link will be able to download this file.',
          'سيتمكن حامل رابط المتابعة الخاص من تنزيل هذا الملف.'
        )}
      </p>
      <p role="alert" className="help-error">
        {error}
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {t('Release document', 'إتاحة المستند')}
      </button>
    </form>
  );
}

function GuestFiles({ request, done }) {
  const [files, setFiles] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0),
    [busy, setBusy] = useState('');
  useEffect(() => {
    parishAPI('files?scope=guest-request&id=' + encodeURIComponent(request.id)).then(
      r => setFiles(r.files),
      e => setError(e.message)
    );
  }, [round]);
  const remove = async id => {
    setBusy(id);
    try {
      await parishAPI('files/' + encodeURIComponent(id), 'DELETE', {});
      setBusy('');
      setRound(n => n + 1);
    } catch (e) {
      setError(e.message);
      setBusy('');
    }
  };
  const upload = async e => {
    const input = e.target,
      file = input.files[0];
    if (!file) return;
    input.disabled = true;
    try {
      await uploadFile('guest-request', request.id, file);
      setRound(n => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      input.disabled = false;
      input.value = '';
    }
  };
  const release = id =>
    openDrawer({
      title: t('Release a reviewed document', 'إتاحة مستند تمت مراجعته'),
      body: <Release request={request} fileId={id} done={done} />
    });
  return (
    <>
      <p>{request.details.name}</p>
      <p className="help">
        {t(
          'Uploads stay private to the office until you explicitly release a file to the applicant.',
          'تبقى الملفات خاصة بالمكتب حتى تسمح بإرسال ملف محدّد لمقدّم الطلب.'
        )}
      </p>
      <label className="formrow">
        <span className="label">
          {t('Attach PDF, JPG or PNG (up to 10 MB)', 'إرفاق PDF أو JPG أو PNG (حتى ١٠ ميغابايت)')}
        </span>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-upload="" onChange={upload} />
      </label>
      <div data-files="">
        {files ? (
          files.length ? (
            files.map(f => (
              <article key={f.id} className="ministry-request">
                <h3>{f.name}</h3>
                <div className="account-actions">
                  <a
                    className="btn btn-secondary"
                    target="_blank"
                    rel="noopener"
                    href={`/api/parishes/${encodeURIComponent(session.parishId)}/files/${encodeURIComponent(f.id)}`}
                  >
                    {t('Review file', 'مراجعة الملف')}
                  </a>
                  <button className="btn btn-primary" data-release={f.id} onClick={() => release(f.id)}>
                    {t('Release to applicant', 'إتاحة لمقدّم الطلب')}
                  </button>
                  <button
                    className="btn btn-secondary"
                    data-remove={f.id}
                    disabled={busy === f.id}
                    onClick={() => remove(f.id)}
                  >
                    {t('Remove file', 'إزالة الملف')}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p>{t('No documents attached.', 'لا مستندات مرفقة.')}</p>
          )
        ) : null}
      </div>
      <p role="alert" className="help-error">
        {error}
      </p>
    </>
  );
}

function guestFiles(request, done) {
  openDrawer({ title: t('Request documents', 'مستندات الطلب'), body: <GuestFiles request={request} done={done} /> });
}
