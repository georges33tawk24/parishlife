/* Checking a signed document: the code printed on a certificate or letter shows which document it
   belongs to, who authorized it and whether that authorization still stands.
   Route: GET /api/public/document-verifications/{code} (api-data.js verifyDocument). The page reports
   what the API answers (status, statusMeaning, officialStatement) and nothing it does not check: it
   does not see the document, so it cannot say a signature is valid or that the content matches. */
import { useEffect, useRef, useState } from 'react';
import { useSite } from '../site.jsx';
import { verifyDocument, verdictOf } from '../api-data.js';

/* Checking a code: which document, who authorized it, and what the issuing parish's records say now. */
export function VerifyPage({ code = '' }) {
  const { L, lang } = useSite();
  const [result, setResult] = useState(null);
  const latest = useRef(0);
  const check = async value => {
    if (!value.trim()) return;
    const mine = ++latest.current;
    setResult({ checking: true });
    try {
      const d = await verifyDocument(value);
      if (mine === latest.current) setResult({ d });
    } catch (e) {
      if (mine === latest.current) setResult({ error: e.message, unknown: e.status === 404 });
    }
  };
  useEffect(() => {
    if (code) check(code);
  }, []);
  return (
    <section className="verify site-wrap" data-plain-page>
      <div className="verify-card">
        <span className="verify-seal" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none" focusable="false">
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2.4" />
            <circle cx="24" cy="24" r="14.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M24 15v18M18 21h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <h1>{L('Check a signed document', 'التحقّق من وثيقة موقّعة')}</h1>
        <p>
          {L(
            'Certificates and letters authorized on ParishLife carry a code. Enter it to see which document it belongs to, who authorized it, and whether that authorization still stands.',
            'تحمل الشهادات والرسائل المصدَّقة على ParishLife رمزاً. أدخله لترى لأي وثيقة هو، ومن صدّقها، وهل ما زال هذا التصديق قائماً.'
          )}
        </p>
        <form
          className="verify-form"
          data-verify-form
          onSubmit={e => {
            e.preventDefault();
            const v = e.currentTarget.elements.code.value;
            history.replaceState(null, '', 'public.html?verify=' + encodeURIComponent(v.trim()));
            check(v);
          }}
        >
          <label>
            <span>{L('Verification code', 'رمز التحقّق')}</span>
            <input
              name="code"
              defaultValue={code}
              placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              dir="ltr"
              required
            />
          </label>
          <button className="btn btn-gilt">{L('Check', 'تحقّق')}</button>
        </form>
        <div className="verify-result" data-verify-result aria-live="polite">
          {result ? <VerifyResult result={result} L={L} lang={lang} /> : null}
        </div>
      </div>
    </section>
  );
}

/* The title of each answer; its tone comes from verdictOf. The meaning itself is the API's own
   statusMeaning, shown below the title. */
const TITLES = {
  Valid: ['Valid: this version was authorized electronically', 'سارية: صُدِّقت هذه النسخة إلكترونيًا'],
  ReferenceOnly: [
    'Reference only: not an official electronic signature',
    'للاطّلاع فقط: ليس توقيعًا إلكترونيًا رسميًا'
  ],
  NotYetIssued: ['Authorized, not yet issued', 'مصدَّقة ولم تُصدَر بعد'],
  Superseded: ['Replaced by a newer version', 'حلّت محلّها نسخة أحدث'],
  Withdrawn: ['Withdrawn by the parish', 'سحبتها الرعية'],
  Revoked: ['Authorization revoked', 'أُلغي التصديق'],
  IntegrityCheckFailed: ['The stored authorization failed its check', 'فشل فحص التصديق المحفوظ'],
  Invalidated: ['No longer matches the document', 'لم يعد يطابق الوثيقة']
};

function VerifyResult({ result, L, lang }) {
  if (result.checking) return <p role="status">{L('Checking…', 'جارٍ التحقّق…')}</p>;
  if (result.error)
    return (
      <div className="verify-state is-critical">
        {result.unknown
          ? L(
              'No authorized document has this code. Check the code on the document.',
              'لا وثيقة مصدَّقة بهذا الرمز. تحقّق من الرمز على الوثيقة.'
            )
          : result.error}
      </div>
    );
  const d = result.d,
    { tone, key } = verdictOf(d),
    title = TITLES[key] ? L(...TITLES[key]) : d.status,
    ok = tone === 'good';
  const kind =
    d.documentType === 'Certificate'
      ? L('Certificate', 'شهادة')
      : d.documentType === 'Letter'
        ? L('Letter from the parish office', 'رسالة من مكتب الرعية')
        : d.documentType;
  const format = value =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(
      new Date(value)
    );
  /* statusMeaning and officialStatement are the API's own wording, in English. */
  const english = { lang: 'en', dir: 'ltr' };
  return (
    <>
      <div className={`verify-state is-${tone}`}>
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path
            d={ok ? 'M4.2 10.4 8 14.2l7.8-8' : 'M10 3.2 17.4 16H2.6zM10 8.2v3.4M10 13.6v.9'}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {title}
      </div>
      {/* with no recorded signature arrangement the official statement says what the code is: the Valid wording would overstate it */}
      {d.statusMeaning && key !== 'ReferenceOnly' ? (
        <p className="verify-how" {...english}>
          {d.statusMeaning}
        </p>
      ) : null}
      {d.officialStatement ? (
        <p className="verify-how" data-official-statement {...english}>
          {d.officialStatement}
        </p>
      ) : null}
      <dl className="verify-facts">
        <div>
          <dt>{L('Document', 'الوثيقة')}</dt>
          <dd>
            {kind}
            {d.documentDetail ? <> · {d.documentDetail}</> : null}
            {d.reference ? (
              <>
                {' '}
                · <bdi>{d.reference}</bdi>
              </>
            ) : null}
            {d.documentVersion ? <> · {L(`version ${d.documentVersion}`, `النسخة ${d.documentVersion}`)}</> : null}
          </dd>
        </div>
        <div>
          <dt>{L('Issuing parish', 'الرعية المُصدِرة')}</dt>
          <dd dir="auto">{d.issuingParish}</dd>
        </div>
        <div>
          <dt>{L('Authorized by', 'صدّقها')}</dt>
          <dd dir="auto">{d.authorizedBy}</dd>
        </div>
        <div>
          <dt>{L('Authorized on', 'صُدِّقت في')}</dt>
          <dd>{format(d.authorizedAt)}</dd>
        </div>
        <div>
          <dt>{L('Checked on', 'فُحصت في')}</dt>
          <dd>{format(d.checkedAt)}</dd>
        </div>
        <div>
          <dt>{L('Code', 'الرمز')}</dt>
          <dd>
            <bdi className="verify-mono">{d.code}</bdi>
          </dd>
        </div>
      </dl>
      <p className="verify-how">
        {L(
          'This page reports what the issuing parish’s records say about the code now. It does not show the document or check its contents: the official document is the one the parish issued.',
          'تعرض هذه الصفحة ما تقوله سجلّات الرعية المُصدِرة عن الرمز الآن. لا تعرض الوثيقة ولا تفحص مضمونها: الوثيقة الرسمية هي التي أصدرتها الرعية.'
        )}
      </p>
    </>
  );
}
