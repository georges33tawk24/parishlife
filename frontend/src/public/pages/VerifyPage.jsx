/* Checking a signed document: the code printed on a certificate or letter shows who signed it and
   whether it is unchanged. */
import { useEffect, useState } from 'react';
import { useSite } from '../site.jsx';

/* Checking a signature: who signed which document, when, and whether it still matches. */
export function VerifyPage({ code = '' }) {
  const { L, lang } = useSite();
  const [result, setResult] = useState(null);
  const check = async value => {
    if (!value.trim()) return;
    setResult({ checking: true });
    try {
      const r = await fetch('/api/public/verify/' + encodeURIComponent(value.trim())),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult({ d });
    } catch (e) {
      setResult({ error: e.message });
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
            'Certificates and letters signed on ParishLife carry a code. Enter it to see who signed, when, and whether the document is unchanged.',
            'تحمل الشهادات والرسائل الموقّعة على ParishLife رمزاً. أدخله لترى من وقّع، ومتى، وهل بقيت الوثيقة كما هي.'
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
            <span>{L('Signature code', 'رمز التوقيع')}</span>
            <input
              name="code"
              defaultValue={code}
              placeholder="XXXX-XXXX-XXXX"
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

function VerifyResult({ result, L, lang }) {
  if (result.checking) return <p role="status">{L('Checking…', 'جارٍ التحقّق…')}</p>;
  if (result.error) return <div className="verify-state is-critical">{result.error}</div>;
  const d = result.d;
  if (!d.found)
    return (
      <div className="verify-state is-critical">
        {L(
          'No signature has this code. Check the code on the document.',
          'لا توقيع بهذا الرمز. تحقّق من الرمز على الوثيقة.'
        )}
      </div>
    );
  const ok = d.signatureValid && !d.revokedAt && d.contentMatches !== false;
  const state = d.revokedAt
    ? ['critical', L('This signature was withdrawn', 'سُحب هذا التوقيع')]
    : !d.signatureValid
      ? ['critical', L('This signature does not check out', 'هذا التوقيع غير صالح')]
      : d.contentMatches === false
        ? ['critical', L('The document was changed after it was signed', 'عُدّلت الوثيقة بعد توقيعها')]
        : ['good', L('Valid signature', 'توقيع صالح')];
  const parish = lang === 'ar' ? d.parish.ar || d.parish.name : d.parish.name || d.parish.ar;
  const kind =
    d.type === 'certificate' ? L('Certificate', 'شهادة') : L('Letter from the parish office', 'رسالة من مكتب الرعية');
  const when = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(new Date(d.signedAt));
  return (
    <>
      <div className={`verify-state is-${state[0]}`}>
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
        {state[1]}
      </div>
      <dl className="verify-facts">
        <div>
          <dt>{L('Document', 'الوثيقة')}</dt>
          <dd>
            {kind}
            {d.reference ? (
              <>
                {' '}
                · <bdi>{d.reference}</bdi>
              </>
            ) : null}
            {d.subject ? ` · ${d.subject}` : null}
            {d.type === 'letter' ? (
              <>
                {' '}
                · <span dir="auto">{d.title}</span>
              </>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>{L('Parish', 'الرعية')}</dt>
          <dd>
            {parish}
            {d.parish.town ? `, ${d.parish.town}` : ''}
          </dd>
        </div>
        <div>
          <dt>{L('Signed by', 'وقّعها')}</dt>
          <dd>
            {d.signer}
            {d.role ? ` · ${d.role}` : ''}
          </dd>
        </div>
        <div>
          <dt>{L('Signed on', 'وُقّعت في')}</dt>
          <dd>{when}</dd>
        </div>
        <div>
          <dt>{L('Fingerprint', 'البصمة')}</dt>
          <dd>
            <bdi className="verify-mono">{d.fingerprint}</bdi>
          </dd>
        </div>
      </dl>
      <p className="verify-how">
        {L(
          'The signature was made with the signer’s own passkey, unlocked with their face, fingerprint or PIN, over a fingerprint of this exact document.',
          'صُنع التوقيع بمفتاح مرور الموقِّع، بعد فتحه بوجهه أو بصمته أو رمزه، على بصمة هذه الوثيقة بعينها.'
        )}
      </p>
    </>
  );
}
