/* The public site's other pages: following a request with its private link, checking a signed
   document, the bundles for parishes, and the page shown when something could not be found. */
import { useEffect, useRef, useState } from 'react';
import { Sanctuary } from './Sanctuary.jsx';
import { PlainPage } from './Parish.jsx';
import { useSite } from './site.jsx';

const REQUEST_STATUS = { submitted: ['Sent to the parish office', 'أُرسل إلى مكتب الرعية'], 'office-review': ['The parish office is reviewing it', 'قيد المراجعة لدى مكتب الرعية'], 'missing-documents': ['Documents are missing', 'مستندات ناقصة'], 'ready-for-collection': ['Ready to collect from the parish', 'جاهز للاستلام من الرعية'], 'ready-for-download': ['Ready to download', 'جاهز للتنزيل'], closed: ['Closed', 'مُغلق'] };
const TRACK_STEPS = [['submitted', 'Sent', 'أُرسل'], ['office-review', 'Under review', 'قيد المراجعة'], ['ready', 'Ready', 'جاهز'], ['closed', 'Closed', 'مُغلق']];

/* The private tracking page: where the request stands, as four steps, and any documents. */
export function TrackingPage({ token }) {
  const { L, lang } = useSite();
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch('/api/public/track/' + encodeURIComponent(token)), d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (live) setState({ data: d });
      } catch (e) { if (live) setState({ error: e.message }); }
    })();
    return () => { live = false; };
  }, [token]);
  const d = state.data;
  if (!d) return <section className="track site-wrap"><div className="track-card"><span className="track-lamp" aria-hidden="true"></span><h1>{L('Your request', 'طلبك')}</h1><p role="status">{state.error ?? L('Loading…', 'جارٍ التحميل…')}</p></div></section>;
  const updated = new Date(d.updated_at), status = String(d.status || 'submitted');
  const at = status === 'closed' ? 3 : /^ready/.test(status) ? 2 : status === 'submitted' ? 0 : 1, warn = status === 'missing-documents';
  return <section className="track site-wrap"><div className="track-card"><span className="track-lamp" aria-hidden="true"></span><h1>{L('Your request', 'طلبك')}</h1>
    <ol className="track-steps">{TRACK_STEPS.map(([k, en, ar], i) => <li key={k} className={i < at ? 'is-done' : i === at ? 'is-current' + (warn ? ' is-warn' : '') : undefined} aria-current={i === at ? 'step' : undefined}><span aria-hidden="true"></span>{L(en, ar)}</li>)}</ol>
    <h2>{L(...(REQUEST_STATUS[status] || [status.replaceAll('-', ' '), status.replaceAll('-', ' ')]))}</h2><p dir="auto">{d.response || L('The parish office has received your request.', 'استلم مكتب الرعية طلبك.')}</p>
    {Number.isNaN(updated.valueOf()) ? null : <small>{L('Updated ', 'آخر تحديث: ') + new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(updated)}</small>}
    {(d.files || []).length ? <div className="track-files">{d.files.map(f => <a key={f.id} className="btn btn-gilt" referrerPolicy="no-referrer" href={`/api/public/guest-files/${encodeURIComponent(token)}/${encodeURIComponent(f.id)}`} download>{L('Download', 'تنزيل')}: {f.name}</a>)}</div> : null}
    <p className="track-note">{L('Keep this page’s link private: anyone who has it can see this request.', 'احتفظ برابط هذه الصفحة لنفسك: يستطيع كل من يملكه رؤية هذا الطلب.')}</p></div>
    {(d.letters || []).map(l => <Letter key={l.code} l={l} />)}
  </section>;
}

/* A letter from the parish office, with the writer's own signature and the code that checks it. */
const drawingPath = path => String(path || '').replace(/[^MLQCZmlqcz0-9 .,-]/g, '');
function Letter({ l }) {
  const { L, lang } = useSite(), sheet = useRef(null);
  const longDate = v => { const d = new Date(v); return Number.isNaN(d.valueOf()) ? '' : new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en-GB', { dateStyle: 'long' }).format(d); };
  const printLetter = () => {
    document.body.classList.add('is-printing-letter'); sheet.current.classList.add('is-printing');
    print();
    setTimeout(() => { document.body.classList.remove('is-printing-letter'); sheet.current?.classList.remove('is-printing'); }, 500);
  };
  return <article className="letter" aria-labelledby={`letter-${l.code}`} ref={sheet}><header><span className="letter-mark" aria-hidden="true"><svg viewBox="0 0 28 34" fill="none" focusable="false"><path d="M4 32V14a10 10 0 0 1 20 0v18" stroke="currentColor" strokeWidth="1.6" /><path d="M1 32.5h26" stroke="currentColor" strokeWidth="1.6" /><circle cx="14" cy="20" r="3.2" fill="#D7A548" /></svg></span>
      {l.parish?.name ? <span className="letter-from"><b>{lang === 'ar' && l.parish.ar ? l.parish.ar : l.parish.name}</b>{l.parish.town ? <small>{l.parish.town}</small> : null}</span> : null}<time>{longDate(l.createdAt)}</time></header>
    <h2 id={`letter-${l.code}`} dir="auto">{l.title}</h2><div className="letter-body" dir="auto">{String(l.body ?? '').split('\n').map((line, i) => i ? [<br key={i} />, line] : line)}</div>
    <footer><div className="letter-signed">{l.drawing ? <svg className="letter-sign" viewBox="0 0 400 140" aria-hidden="true" focusable="false"><path d={drawingPath(l.drawing)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}<b>{l.name}</b>{l.role ? <span>{l.role}</span> : null}</div>
      <div className="letter-check"><span>{L('Digitally signed', 'موقّعة رقمياً')}</span><a href={`public.html?verify=${encodeURIComponent(l.code)}`}><bdi>{l.code}</bdi></a><small>{L('Anyone can check this code on ParishLife.', 'يمكن لأي شخص التحقّق من هذا الرمز على ParishLife.')}</small></div></footer>
    <button type="button" className="btn btn-ink-line btn-small letter-print" data-print-letter onClick={printLetter}>{L('Print or save as PDF', 'طباعة أو حفظ كـPDF')}</button></article>;
}

/* Checking a signature: who signed which document, when, and whether it still matches. */
export function VerifyPage({ code = '' }) {
  const { L, lang } = useSite();
  const [result, setResult] = useState(null);
  const check = async value => {
    if (!value.trim()) return;
    setResult({ checking: true });
    try {
      const r = await fetch('/api/public/verify/' + encodeURIComponent(value.trim())), d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult({ d });
    } catch (e) { setResult({ error: e.message }); }
  };
  useEffect(() => { if (code) check(code); }, []);
  return <section className="verify site-wrap" data-plain-page><div className="verify-card"><span className="verify-seal" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" focusable="false"><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2.4" /><circle cx="24" cy="24" r="14.5" stroke="currentColor" strokeWidth="1.4" /><path d="M24 15v18M18 21h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></span>
    <h1>{L('Check a signed document', 'التحقّق من وثيقة موقّعة')}</h1><p>{L('Certificates and letters signed on ParishLife carry a code. Enter it to see who signed, when, and whether the document is unchanged.', 'تحمل الشهادات والرسائل الموقّعة على ParishLife رمزاً. أدخله لترى من وقّع، ومتى، وهل بقيت الوثيقة كما هي.')}</p>
    <form className="verify-form" data-verify-form onSubmit={e => { e.preventDefault(); const v = e.currentTarget.elements.code.value; history.replaceState(null, '', 'public.html?verify=' + encodeURIComponent(v.trim())); check(v); }}>
      <label><span>{L('Signature code', 'رمز التوقيع')}</span><input name="code" defaultValue={code} placeholder="XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck="false" dir="ltr" required /></label><button className="btn btn-gilt">{L('Check', 'تحقّق')}</button></form>
    <div className="verify-result" data-verify-result aria-live="polite">{result ? <VerifyResult result={result} L={L} lang={lang} /> : null}</div></div></section>;
}
function VerifyResult({ result, L, lang }) {
  if (result.checking) return <p role="status">{L('Checking…', 'جارٍ التحقّق…')}</p>;
  if (result.error) return <div className="verify-state is-critical">{result.error}</div>;
  const d = result.d;
  if (!d.found) return <div className="verify-state is-critical">{L('No signature has this code. Check the code on the document.', 'لا توقيع بهذا الرمز. تحقّق من الرمز على الوثيقة.')}</div>;
  const ok = d.signatureValid && !d.revokedAt && d.contentMatches !== false;
  const state = d.revokedAt ? ['critical', L('This signature was withdrawn', 'سُحب هذا التوقيع')] : !d.signatureValid ? ['critical', L('This signature does not check out', 'هذا التوقيع غير صالح')] : d.contentMatches === false ? ['critical', L('The document was changed after it was signed', 'عُدّلت الوثيقة بعد توقيعها')] : ['good', L('Valid signature', 'توقيع صالح')];
  const parish = lang === 'ar' ? d.parish.ar || d.parish.name : d.parish.name || d.parish.ar;
  const kind = d.type === 'certificate' ? L('Certificate', 'شهادة') : L('Letter from the parish office', 'رسالة من مكتب الرعية');
  const when = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(d.signedAt));
  return <><div className={`verify-state is-${state[0]}`}><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d={ok ? 'M4.2 10.4 8 14.2l7.8-8' : 'M10 3.2 17.4 16H2.6zM10 8.2v3.4M10 13.6v.9'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>{state[1]}</div>
    <dl className="verify-facts"><div><dt>{L('Document', 'الوثيقة')}</dt><dd>{kind}{d.reference ? <> · <bdi>{d.reference}</bdi></> : null}{d.subject ? ` · ${d.subject}` : null}{d.type === 'letter' ? <> · <span dir="auto">{d.title}</span></> : null}</dd></div>
      <div><dt>{L('Parish', 'الرعية')}</dt><dd>{parish}{d.parish.town ? `, ${d.parish.town}` : ''}</dd></div>
      <div><dt>{L('Signed by', 'وقّعها')}</dt><dd>{d.signer}{d.role ? ` · ${d.role}` : ''}</dd></div>
      <div><dt>{L('Signed on', 'وُقّعت في')}</dt><dd>{when}</dd></div>
      <div><dt>{L('Fingerprint', 'البصمة')}</dt><dd><bdi className="verify-mono">{d.fingerprint}</bdi></dd></div></dl>
    <p className="verify-how">{L('The signature was made with the signer’s own passkey, unlocked with their face, fingerprint or PIN, over a fingerprint of this exact document.', 'صُنع التوقيع بمفتاح مرور الموقِّع، بعد فتحه بوجهه أو بصمته أو رمزه، على بصمة هذه الوثيقة بعينها.')}</p></>;
}

/* For parishes: the four bundles as arches (one gold light for each step up), how a parish
   joins, and the practical notes, in the words the bundles have always used. */
const BUNDLES = [
  ['presence', 'Presence', 'التعريف بالرعية', ['Public parish page', 'Contact details', 'Ministries', 'Public calendar'], ['صفحة الرعية العامة', 'معلومات التواصل', 'الخدمات', 'الرزنامة العامة']],
  ['office', 'Office', 'المكتب', ['People and households', 'Requests', 'Sacramental records', 'Office expenses'], ['الأشخاص والعائلات', 'الطلبات', 'سجلات الأسرار', 'مصاريف المكتب']],
  ['community', 'Community', 'المجتمع', ['Office records and requests', 'Ministries and registrations', 'Resources and facilities'], ['سجلات المكتب والطلبات', 'الخدمات والتسجيل', 'الموارد والمرافق']],
  ['complete', 'Complete', 'الكاملة', ['Every available module', 'Sacraments', 'Parish finance'], ['كل الوحدات المتاحة', 'الأسرار', 'مالية الرعية']]];
const Lights = ({ n }) => <span className="fp-mark" aria-hidden="true"><svg viewBox="0 0 64 80" fill="none"><path d="M6 78V32a26 26 0 0 1 52 0v46" stroke="currentColor" strokeWidth="1.5" /><path d="M1 78.5h62" stroke="currentColor" strokeWidth="1.5" />
  {Array.from({ length: n }, (_, i) => <circle key={i} cx={32 + (i - (n - 1) / 2) * 11} cy={n > 2 && i % 2 ? 50 : 56} r="3.6" fill="#F1C77A" />)}</svg></span>;
const Check = () => <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export function BundlesPage() {
  const { L, lang } = useSite(), hero = useRef(null);
  const notes = [[L('Ask through the members portal', 'اطلب عبر بوّابة المؤمنين'), L('A parish priest or the parish office opens the bundles in the portal and asks for the one that fits.', 'يفتح كاهن الرعية أو مكتبها الباقات في البوّابة ويطلب ما يناسب.')],
    [L('The parish or the diocese decides', 'الرعية أو الأبرشية تقرّر'), L('Parish priests may activate parish-managed bundles; diocese-sponsored changes are requests for diocesan approval.', 'يستطيع الكاهن تفعيل باقات الرعية؛ وتتطلب الباقات برعاية الأبرشية طلب موافقتها.')],
    [L('No online payment', 'لا دفع إلكتروني'), L('Subscriptions are managed manually at present. No online payment or automatic billing is configured.', 'تُدار الاشتراكات يدوياً حالياً. لا توجد دفعات إلكترونية أو فوترة تلقائية.')],
    [L('Records stay readable', 'تبقى السجلات قابلة للقراءة'), L('Existing records remain available to read when a module is removed.', 'تبقى السجلات قابلة للقراءة عند إزالة وحدة.')]];
  return <PlainPage className="parish-sub fp" heroRef={hero}>
    <section className="sub-hero is-sanctuary" data-hero aria-labelledby="sub-title" ref={hero}><div className="sub-art sub-sanctuary" aria-hidden="true"><Sanctuary /></div>
      <div className="site-wrap sub-inner"><nav className="ph-crumbs" aria-label={L('Breadcrumb', 'مسار التنقّل')} data-hero-rise><a href="public.html">ParishLife</a><span aria-hidden="true">/</span><span aria-current="page">{L('For parishes', 'للرعايا')}</span></nav>
        <h1 className="hero-title" id="sub-title">{L('Choose what your parish needs', 'اختر ما تحتاجه رعيتك')}</h1>
        <p data-hero-rise>{L('Start with a public presence or add tools for your parish office and community. Arrangements can cover one parish or several parishes in a diocese.', 'ابدأ بحضور عام أو أضف أدوات للمكتب والمجتمع الرعوي. يمكن أن يشمل الترتيب رعية واحدة أو عدة رعايا في أبرشية.')}</p></div></section>
    <section className="fp-bundles"><div className="site-wrap"><ol className="fp-grid">{BUNDLES.map(([key, en, ar, items, itemsAr], i) => <li key={key} data-reveal-item><article className={'fp-card' + (key === 'complete' ? ' is-complete' : '')} data-tilt>
      <Lights n={i + 1} /><h2>{L(en, ar)}</h2><p className="fp-other" lang={lang === 'ar' ? 'en' : 'ar'}>{lang === 'ar' ? en : ar}</p>
      <ul>{(lang === 'ar' ? itemsAr : items).map(item => <li key={item}><Check /><span>{item}</span></li>)}</ul>
      <a className={'btn ' + (key === 'complete' ? 'btn-gilt' : 'btn-ink-line')} href="index.html#/workspace">{L('Manage or request this bundle', 'إدارة الباقة أو طلبها')}</a></article></li>)}</ol></div></section>
    <section className="fp-how"><div className="site-wrap"><header className="sec-head" data-reveal><h2>{L('How a parish joins', 'كيف تنضمّ الرعية')}</h2><p>{L('Parish priests and offices join through their diocese. Parishioners sign in to the members portal to follow their parish.', 'ينضمّ كهنة الرعايا ومكاتبها عبر أبرشيتهم. ويدخل أبناء الرعية إلى بوّابة المؤمنين لمتابعة رعيتهم.')}</p></header>
      <ol className="fp-steps">{notes.map(([b, t]) => <li key={b} data-reveal-item><b>{b}</b><span>{t}</span></li>)}</ol></div></section>
    <section className="join fp-join"><div className="join-art" aria-hidden="true">{['sky', 'far', 'near'].map(part => <img key={part} src={`assets/images/valley/valley-wide-dusk-${part}.webp`} alt="" loading="lazy" decoding="async" />)}</div>
      <div className="site-wrap join-inner" data-reveal><h2>{L('Light your parish on the map', 'أضئ رعيتك على الخريطة')}</h2><p>{L('Every parish on ParishLife is a gold light on the map of Lebanon, with its own page, calendar and requests.', 'كل رعية على ParishLife نورٌ ذهبي على خريطة لبنان، ولها صفحتها ورزنامتها وطلباتها.')}</p>
        <div className="join-actions"><a className="btn btn-gilt" href="index.html#/workspace">{L('Open the members portal', 'ادخل إلى بوّابة المؤمنين')}</a><a className="btn btn-line" href="public.html#directory">{L('See the parishes', 'تصفّح الرعايا')}</a></div></div></section>
  </PlainPage>;
}

/* A page that could not be shown: an unlit candle in an arch (the visitor may light it), what
   happened, and the way back. */
export function LostPage({ title, body, actions }) {
  const { L } = useSite();
  const [lit, setLit] = useState(false);
  return <PlainPage className="parish-sub"><section className="lost site-wrap"><div className="lost-card" data-reveal>
    <button type="button" className={'lost-arch' + (lit ? ' is-lit' : '')} aria-pressed={lit} aria-label={L('Light a candle', 'أضئ شمعة')} onClick={() => setLit(true)}><span className="lost-candle"><i></i></span></button>
    <h1>{title}</h1><p>{body}</p><div className="lost-actions">{actions}</div></div></section></PlainPage>;
}
