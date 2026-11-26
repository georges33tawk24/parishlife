/* Checking a signed document: the code printed on a certificate or letter shows which document it
   belongs to, who authorized it and whether that authorization still stands.
   Route: GET /api/public/document-verifications/{code} (api-data.js verifyDocument). The page reports
   what the API answers (status, statusMeaning, officialStatement) and nothing it does not check: it
   does not see the document, so it cannot say a signature is valid or that the content matches.
   Design A3: a title band, the code in a card with the check beside it, the answer below as a coloured
   card, and what the check shows beside them.
   Main functions: VerifyPage, VerifyResult. */
import { useEffect, useRef, useState } from 'react';
import { useSite } from '../site.jsx';
import { verifyDocument, verdictOf } from '../api-data.js';
import { A3Icon, Band } from '../components/a3.jsx';

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
    <div className="verify-page">
      <Band
        L={L}
        crumbs={[['ParishLife', 'public.html'], [L('Check a signed document', 'التحقّق من وثيقة موقّعة')]]}
        title={L('Check a signed document', 'التحقّق من وثيقة موقّعة')}
        lede={L(
          'Certificates and letters authorized on ParishLife carry a code. Enter it to see which document it belongs to, who authorized it, and whether that authorization still stands.',
          'تحمل الشهادات والرسائل المصدَّقة على ParishLife رمزاً. أدخله لترى لأي وثيقة هو، ومن صدّقها، وهل ما زال هذا التصديق قائماً.'
        )}
      />
      <section className="wrap sec">
        <div className="split">
          <div className="main">
            <form
              className="card fs verify-form"
              onSubmit={e => {
                e.preventDefault();
                const v = e.currentTarget.elements.code.value;
                history.replaceState(null, '', 'public.html?verify=' + encodeURIComponent(v.trim()));
                check(v);
              }}
            >
              <label className="lbl" htmlFor="vf-code">
                {L('Verification code', 'رمز التحقّق')}
              </label>
              <span className="hint" id="vf-code-h">
                {L(
                  'It is printed at the bottom of the certificate or letter.',
                  'تجده مطبوعاً أسفل الشهادة أو الرسالة.'
                )}
              </span>
              <div className="link-row">
                <input
                  id="vf-code"
                  name="code"
                  className="field code"
                  aria-describedby="vf-code-h"
                  defaultValue={code}
                  placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck="false"
                  dir="ltr"
                  required
                />
                <button className="btn btn-red">
                  <A3Icon name="search" />
                  {L('Check', 'تحقّق')}
                </button>
              </div>
            </form>
            <div aria-live="polite">{result ? <VerifyResult result={result} L={L} lang={lang} /> : null}</div>
          </div>
          <aside className="side">
            <div className="card t-sky side-card">
              <h2 className="t">{L('What this check shows', 'ماذا يُظهر هذا التحقّق')}</h2>
              <p>
                {L(
                  'This page reports what the issuing parish’s records say about the code now. It does not show the document or check its contents: the official document is the one the parish issued.',
                  'تعرض هذه الصفحة ما تقوله سجلّات الرعية المُصدِرة عن الرمز الآن. لا تعرض الوثيقة ولا تفحص مضمونها: الوثيقة الرسمية هي التي أصدرتها الرعية.'
                )}
              </p>
            </div>
            <div className="card t-rose side-card">
              <h2 className="t">{L('Need a certificate?', 'تحتاج إلى شهادة؟')}</h2>
              <p>
                {L(
                  'Ask your parish office for a baptism, marriage or other certificate.',
                  'اطلب من مكتب رعيتك شهادة معمودية أو زواج أو غيرها.'
                )}
              </p>
              <a className="btn btn-soft" href="public.html#directory">
                {L('Find your parish', 'ابحث عن رعيتك')}
              </a>
            </div>
          </aside>
        </div>
      </section>
    </div>
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
  if (result.checking)
    return (
      <p className="d" role="status" style={{ marginTop: 20 }}>
        {L('Checking…', 'جارٍ التحقّق…')}
      </p>
    );
  if (result.error)
    return (
      <p className="notice" style={{ marginTop: 20 }}>
        {result.unknown
          ? L(
              'No authorized document has this code. Check the code on the document.',
              'لا وثيقة مصدَّقة بهذا الرمز. تحقّق من الرمز على الوثيقة.'
            )
          : result.error}
      </p>
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
  const sep = L(', ', '، ');
  return (
    <section
      className={'card verify-result ' + (ok ? 't-sage' : tone === 'critical' ? 't-rose' : 't-gold')}
      aria-labelledby="vf-res"
    >
      <div className="verify-head">
        <span className="seal" aria-hidden="true">
          <A3Icon name={ok ? 'seal' : 'info'} />
        </span>
        <h2 id="vf-res" className="h3">
          {title}
        </h2>
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
      <dl className="facts">
        <div>
          <dt>{L('Document', 'الوثيقة')}</dt>
          <dd>
            <strong>{kind}</strong>
            {d.documentDetail ? <>{sep + d.documentDetail}</> : null}
            {d.reference ? (
              <>
                {sep}
                <bdi>{d.reference}</bdi>
              </>
            ) : null}
            {d.documentVersion ? <>{sep + L(`version ${d.documentVersion}`, `النسخة ${d.documentVersion}`)}</> : null}
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
            <bdi className="code">{d.code}</bdi>
          </dd>
        </div>
      </dl>
    </section>
  );
}
