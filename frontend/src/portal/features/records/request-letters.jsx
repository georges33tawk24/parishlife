/* Purpose: the office's letters for one request case: draft and revise, the priest's electronic
   authorization, release to the applicant and withdrawal, and a replacement for a signed letter.
   Main functions: RequestLetters (the section), LetterRow, SignLetter, ReleaseLetter.

   Routes (ParishLife.Api, docs/operations/document-signatures.md): GET/POST .../requests/{id}/letters,
   PUT .../letters/{l}, GET .../letters/{l}/authorization-preview, POST .../letters/{l}/authorization,
   .../release and .../withdraw. A current parish priest signs: the preview's content hash and a fresh
   code from the priest's authenticator app are sent once for that act and never kept on this page. Until
   the archdiocese records an approved electronic-signature arrangement, every signed letter is for
   reference only and the wet-signed, sealed paper is the official document: the page shows the API's own
   statement and never claims more. */
import { useEffect, useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { Select } from '../../ui/components.jsx';
import { Pill, toast } from '../../ui/ui.jsx';
import { is } from '../../model/store.js';
import {
  listLetters,
  createLetter,
  reviseLetter,
  letterPreview,
  signLetter,
  releaseLetter,
  withdrawLetter,
  getSignerProfile
} from '../../model/modules/requests.js';
import { SignerProfileForm } from '../account/signer-profile.jsx';

const L = (en, ar) => t(en, ar);
const STATUS = {
  Draft: ['Draft', 'مسودة', ''],
  Signed: ['Signed', 'موقّعة', 'info'],
  Released: ['Released', 'صادرة', 'success'],
  Withdrawn: ['Withdrawn', 'مسحوبة', 'danger'],
  Superseded: ['Replaced', 'استُبدلت', '']
};
const REFERENCE_ONLY = () =>
  L(
    'Unless the archdiocese has approved an electronic-signature arrangement, a signed letter is for reference only: the wet-signed and sealed paper is the official document.',
    'ما لم توافق الأبرشية على ترتيب للتوقيع الإلكتروني، تبقى الرسالة الموقّعة للاطّلاع فقط: الورقة الموقّعة يدوياً والمختومة هي الوثيقة الرسمية.'
  );

/** All letters of the case. `dto` is the case (for its reference and requester); onChange reloads the case view. */
export function RequestLetters({ dto }) {
  const [rows, setRows] = useState(null),
    [error, setError] = useState(''),
    [round, setRound] = useState(0),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(null); // { title, body, language, addresseeName, replacesLetterId, replaceReason }
  useEffect(() => {
    let live = true;
    listLetters(dto.id).then(
      r => live && (setRows(r || []), setError('')),
      e => live && (setRows([]), setError(e.status === 403 || e.status === 404 ? '' : e.message))
    );
    return () => {
      live = false;
    };
  }, [dto.id, round]);
  const run = async (work, done) => {
    if (busy) return false;
    setBusy(true);
    try {
      await work();
      if (done) toast(done, '', 'success');
      setRound(n => n + 1);
      return true;
    } catch (e) {
      toast(L('Could not save the letter', 'تعذّر حفظ الرسالة'), e.message, 'danger');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const office = is('priest', 'secretary');
  if (!office) return null;
  const blank = (replaces = null) => ({
    title: replaces?.title || '',
    body: replaces?.body || '',
    language: replaces?.language || 'en',
    addresseeName: replaces?.addresseeName || dto.requesterName || '',
    replacesLetterId: replaces?.id || null,
    replaceReason: ''
  });
  return (
    <section className="or-section" aria-labelledby="rc-letters" data-request-letters="" aria-busy={busy}>
      <h3 id="rc-letters">{L('Letters', 'الرسائل')}</h3>
      <p className="help">{REFERENCE_ONLY()}</p>
      {error ? <p className="help help-error">{error}</p> : null}
      {rows === null ? (
        <p className="help">{L('Loading…', 'جارٍ التحميل…')}</p>
      ) : rows.length ? (
        rows.map(r => (
          <LetterRow
            key={r.value.id}
            row={r}
            dto={dto}
            run={run}
            busy={busy}
            replace={() => setDraft(blank(r.value))}
          />
        ))
      ) : (
        <p className="help">{L('No letters for this request.', 'لا رسائل لهذا الطلب.')}</p>
      )}
      {draft ? (
        <LetterForm
          value={draft}
          setValue={setDraft}
          busy={busy}
          replacing={!!draft.replacesLetterId}
          cancel={() => setDraft(null)}
          save={async () => {
            if (await run(() => createLetter(dto.id, draft), L('Draft saved', 'حُفظت المسودة'))) setDraft(null);
          }}
        />
      ) : (
        <button className="btn btn-secondary btn-dense" disabled={busy} onClick={() => setDraft(blank())}>
          {L('Draft a letter', 'كتابة مسودة رسالة')}
        </button>
      )}
    </section>
  );
}

function LetterForm({ value, setValue, busy, save, cancel, replacing, revising = false }) {
  const set = patch => setValue({ ...value, ...patch });
  const ready =
    value.title.trim() && value.body.trim() && value.addresseeName.trim() && (!replacing || value.replaceReason.trim());
  return (
    <div className="formrow" data-letter-form="">
      <input
        className="input"
        maxLength="200"
        value={value.title}
        onChange={e => set({ title: e.target.value })}
        placeholder={L('Title', 'العنوان')}
        dir="auto"
      />
      <input
        className="input"
        maxLength="200"
        value={value.addresseeName}
        onChange={e => set({ addresseeName: e.target.value })}
        placeholder={L('Addressed to', 'موجّهة إلى')}
        dir="auto"
      />
      {revising ? null : (
        <Select
          value={value.language}
          onChange={e => set({ language: e.target.value })}
          aria-label={L('Language', 'اللغة')}
        >
          <option value="en">English</option>
          <option value="ar">العربية</option>
          <option value="fr">Français</option>
        </Select>
      )}
      <textarea
        className="textarea"
        rows="8"
        maxLength="8000"
        value={value.body}
        onChange={e => set({ body: e.target.value })}
        placeholder={L('The letter', 'نص الرسالة')}
        dir="auto"
      />
      {replacing ? (
        <input
          className="input"
          maxLength="2000"
          value={value.replaceReason}
          onChange={e => set({ replaceReason: e.target.value })}
          placeholder={L('Why the signed letter is replaced', 'سبب استبدال الرسالة الموقّعة')}
        />
      ) : null}
      <div className="account-actions">
        <button className="btn btn-primary btn-dense" disabled={busy || !ready} onClick={save}>
          {L('Save draft', 'حفظ المسودة')}
        </button>
        <button className="btn btn-secondary btn-dense" onClick={cancel}>
          {L('Cancel', 'إلغاء')}
        </button>
      </div>
    </div>
  );
}

function LetterRow({ row, dto, run, busy, replace }) {
  const { value: l, version } = row;
  const [mode, setMode] = useState(''), // '' | 'edit' | 'sign' | 'release' | 'withdraw'
    [edit, setEdit] = useState(null),
    [reason, setReason] = useState('');
  const status = STATUS[l.status] || [l.status, l.status, ''];
  const priest = is('priest');
  return (
    <div className="request-document" data-letter={l.id} data-letter-status={l.status}>
      <b dir="auto">{l.title}</b> <Pill label={L(status[0], status[1])} tone={status[2]} />{' '}
      <small>
        <bdi className="mono" dir="ltr">
          {l.reference} v{l.version}
        </bdi>{' '}
        · <bdi>{l.addresseeName}</bdi>
        {l.signatureCode ? (
          <>
            {' '}
            · {L('code', 'الرمز')}{' '}
            <bdi className="mono" dir="ltr">
              {l.signatureCode}
            </bdi>
          </>
        ) : null}
        {l.withdrawalReason ? ` · ${l.withdrawalReason}` : ''}
      </small>
      {mode === 'edit' && edit ? (
        <LetterForm
          value={edit}
          setValue={setEdit}
          busy={busy}
          revising
          cancel={() => setMode('')}
          save={async () => {
            if (await run(() => reviseLetter(l.id, version, edit), L('Draft saved', 'حُفظت المسودة'))) setMode('');
          }}
        />
      ) : (
        <blockquote className="letter-body" dir="auto">
          <p style={{ whiteSpace: 'pre-wrap' }}>{l.body}</p>
        </blockquote>
      )}
      {mode === 'sign' ? (
        <SignLetter letter={l} version={version} run={run} busy={busy} done={() => setMode('')} />
      ) : null}
      {mode === 'release' ? (
        <ReleaseLetter letter={l} version={version} dto={dto} run={run} busy={busy} done={() => setMode('')} />
      ) : null}
      {mode === 'withdraw' ? (
        <div className="formrow">
          <input
            className="input"
            maxLength="2000"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={L('Why it is withdrawn', 'سبب السحب')}
          />
          <p className="help">
            {L(
              'Withdrawal stops future reliance; copies already handed over cannot be recalled.',
              'السحب يوقف الاعتماد عليها مستقبلاً؛ لا يمكن استرجاع النسخ التي سُلّمت.'
            )}
          </p>
          <button
            className="btn btn-danger btn-dense"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              if (await run(() => withdrawLetter(l.id, version, reason.trim()), L('Letter withdrawn', 'سُحبت الرسالة')))
                setMode('');
            }}
          >
            {L('Withdraw the letter', 'سحب الرسالة')}
          </button>
        </div>
      ) : null}
      <div className="account-actions">
        {l.status === 'Draft' && mode !== 'edit' ? (
          <button
            className="btn btn-secondary btn-dense"
            onClick={() => {
              setEdit({ title: l.title, body: l.body, addresseeName: l.addresseeName });
              setMode('edit');
            }}
          >
            {L('Edit draft', 'تعديل المسودة')}
          </button>
        ) : null}
        {l.status === 'Draft' && priest && mode !== 'sign' ? (
          <button className="btn btn-primary btn-dense" onClick={() => setMode('sign')}>
            {L('Review and sign', 'مراجعة وتوقيع')}
          </button>
        ) : null}
        {l.status === 'Signed' && mode !== 'release' ? (
          <button className="btn btn-primary btn-dense" onClick={() => setMode('release')}>
            {L('Release to the applicant', 'تسليم لمقدّم الطلب')}
          </button>
        ) : null}
        {['Signed', 'Released'].includes(l.status) && mode !== 'withdraw' ? (
          <button className="btn btn-danger-quiet btn-dense" onClick={() => setMode('withdraw')}>
            {L('Withdraw', 'سحب')}
          </button>
        ) : null}
        {['Signed', 'Released', 'Withdrawn'].includes(l.status) && !l.supersededById ? (
          <button className="btn btn-secondary btn-dense" onClick={replace}>
            {L('Draft a replacement', 'مسودة بديلة')}
          </button>
        ) : null}
        {mode ? (
          <button className="btn btn-ghost btn-dense" onClick={() => setMode('')}>
            {L('Close', 'إغلاق')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* The priest reads the exact content the API will authorize, then confirms with a fresh authenticator code. */
function SignLetter({ letter, version, run, busy, done }) {
  const [preview, setPreview] = useState(null),
    [profile, setProfile] = useState(undefined),
    [code, setCode] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    letterPreview(letter.id).then(setPreview, e => setError(e.message));
    getSignerProfile().then(setProfile, () => setProfile(null));
  }, [letter.id, version]);
  if (error) return <p className="help help-error">{error}</p>;
  if (!preview || profile === undefined) return <p className="help">{L('Loading…', 'جارٍ التحميل…')}</p>;
  if (!profile)
    return (
      <div className="formrow">
        <p className="help">
          {L(
            'Set the name printed under your electronic authorization first.',
            'حدّد أولاً الاسم الذي يُطبع تحت توقيعك الإلكتروني.'
          )}
        </p>
        <SignerProfileForm profile={null} saved={setProfile} />
      </div>
    );
  return (
    <div className="formrow" data-sign-letter={letter.id}>
      <p className="help">
        {L('Signing as', 'التوقيع باسم')} <b>{profile.printedName}</b>. {L('Content fingerprint', 'بصمة المحتوى')}{' '}
        <bdi className="mono" dir="ltr">
          {preview.contentHash.slice(0, 16)}…
        </bdi>
      </p>
      <p className="help">{preview.statement || REFERENCE_ONLY()}</p>
      <label className="label" htmlFor={'sign-code-' + letter.id}>
        {L('Code from your authenticator app', 'الرمز من تطبيق المصادقة')}
      </label>
      <input
        id={'sign-code-' + letter.id}
        className="input mono"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength="12"
        value={code}
        onChange={e => setCode(e.target.value.replace(/\s/g, ''))}
        dir="ltr"
        style={{ maxWidth: 160 }}
      />
      <button
        className="btn btn-primary btn-dense"
        disabled={busy || code.length < 6}
        onClick={async () => {
          const ok = await run(
            () => signLetter(letter.id, version, preview.contentHash, code),
            L('Letter signed', 'وُقّعت الرسالة')
          );
          setCode('');
          if (ok) done();
        }}
      >
        {L('Sign this letter', 'توقيع هذه الرسالة')}
      </button>
    </div>
  );
}

/* Release re-enters the request reference and the addressee; the API compares them with the signed letter. */
function ReleaseLetter({ letter, version, dto, run, busy, done }) {
  const [preview, setPreview] = useState(null),
    [method, setMethod] = useState(dto.applicantAccountId ? 'VerifiedAccount' : 'InPerson'),
    [reference, setReference] = useState(''),
    [addressee, setAddressee] = useState(''),
    [evidence, setEvidence] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    letterPreview(letter.id).then(setPreview, e => setError(e.message));
  }, [letter.id, version]);
  if (error) return <p className="help help-error">{error}</p>;
  if (!preview) return <p className="help">{L('Loading…', 'جارٍ التحميل…')}</p>;
  const ready = reference.trim() && addressee.trim() && (method === 'VerifiedAccount' || evidence.trim());
  return (
    <div className="formrow" data-release-letter={letter.id}>
      <Select
        value={method}
        onChange={e => setMethod(e.target.value)}
        aria-label={L('How it is released', 'طريقة التسليم')}
      >
        {dto.applicantAccountId ? (
          <option value="VerifiedAccount">{L('To the applicant’s account', 'إلى حساب مقدّم الطلب')}</option>
        ) : null}
        <option value="InPerson">{L('In person, identity checked', 'شخصياً بعد التحقّق من الهوية')}</option>
      </Select>
      <input
        className="input mono"
        maxLength="40"
        value={reference}
        onChange={e => setReference(e.target.value)}
        placeholder={L('Type the request reference', 'اكتب رقم الطلب')}
        dir="ltr"
      />
      <input
        className="input"
        maxLength="200"
        value={addressee}
        onChange={e => setAddressee(e.target.value)}
        placeholder={L('Type the addressee as on the letter', 'اكتب اسم المرسَل إليه كما في الرسالة')}
        dir="auto"
      />
      {method === 'InPerson' ? (
        <input
          className="input"
          maxLength="1000"
          value={evidence}
          onChange={e => setEvidence(e.target.value)}
          placeholder={L('How identity was checked', 'كيف جرى التحقّق من الهوية')}
        />
      ) : null}
      <button
        className="btn btn-primary btn-dense"
        disabled={busy || !ready}
        onClick={async () => {
          const ok = await run(
            () =>
              releaseLetter(letter.id, version, {
                method,
                confirmRequestReference: reference.trim(),
                confirmAddresseeName: addressee.trim(),
                confirmContentHash: preview.contentHash,
                verificationEvidence: evidence.trim()
              }),
            L('Letter released', 'سُلّمت الرسالة')
          );
          if (ok) done();
        }}
      >
        {L('Release', 'تسليم')}
      </button>
    </div>
  );
}
