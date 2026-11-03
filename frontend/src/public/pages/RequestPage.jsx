/* Asking a parish for something without an account: choose what is needed, say who is asking,
   describe the request, and keep the private link that follows it. */
import { useEffect, useRef, useState } from 'react';
import { mountTurnstile } from '../../lib/turnstile.js';
import { trackAction } from '../../lib/beacon.js';
import { useSite, digits, still } from '../site.jsx';
import { Icon, Glyph } from '../components/icons.jsx';
import { Bring, ParishSub, Thumb, facts } from './parish-parts.jsx';

export function RequestPage({ p, d, kind }) {
  const c = useSite(),
    f = facts(c, p, d),
    { L } = c;
  const ministry = new URLSearchParams(location.search).get('ministry') || '';
  const all = [
    ...c.REQUESTS,
    ...c.OTHER_REQUESTS,
    ['appointment', 'calendar', ['Appointment', 'موعد'], ['With the parish office', 'مع مكتب الرعية']],
    ['ministry', 'church', ['Joining a ministry', 'الانضمام إلى خدمة'], ['Ask how to take part', 'اسأل عن المشاركة']]
  ];
  const chosen = all.some(r => r[0] === kind) ? kind : 'certificate';
  const steps = [
    [
      L('The office reads it', 'يقرأه المكتب'),
      L('Your request goes only to this parish’s office.', 'يصل طلبك إلى مكتب هذه الرعية فقط.')
    ],
    [
      L('It answers or asks for documents', 'يجيب أو يطلب مستندات'),
      L('Follow each step with your private link.', 'تابع كل خطوة برابطك الخاص.')
    ],
    [
      L('You collect what you asked for', 'تستلم ما طلبته'),
      L('At the parish, or as a secure download when it is offered.', 'من الرعية، أو بتنزيل آمن عند توفّره.')
    ]
  ];
  return (
    <ParishSub
      p={p}
      f={f}
      here={L('Request', 'طلب')}
      heading={L(`Ask ${f.name}`, `اطلب من رعية ${f.name}`)}
      lede={L(
        'No account is needed. Send your request to the parish office and keep the private link you receive to follow it.',
        'لا حاجة إلى حساب. أرسل طلبك إلى مكتب الرعية واحتفظ بالرابط الخاص الذي تتلقاه لمتابعته.'
      )}
    >
      <div className="site-wrap rq-grid">
        <div className="rq-main">
          <RequestForm p={p} all={all} chosen={chosen} ministry={ministry} />
        </div>
        <aside className="rq-side" data-reveal>
          <a className="rq-parish" href={c.profileURL(p.id)}>
            <Thumb src={f.photos[0]} name={f.name} />
            <span>
              <b>{f.name}</b>
              <small>{[f.town, f.rite].filter(Boolean).join(' · ')}</small>
            </span>
          </a>
          <h2>{L('What happens next', 'ماذا يحدث بعد ذلك')}</h2>
          <ol className="rq-steps">
            {steps.map(([b, s]) => (
              <li key={b}>
                <b>{b}</b>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <Bring f={f} side />
          <p className="rq-privacy">
            {L(
              'No email or text message is sent automatically. Anyone with your tracking link can see the request’s status, so keep it to yourself.',
              'لا تُرسل رسائل بريد أو رسائل نصية تلقائياً. يستطيع كل من يملك رابط المتابعة رؤية حالة الطلب، فاحتفظ به لنفسك.'
            )}
          </p>
        </aside>
      </div>
    </ParishSub>
  );
}

/* The request itself: sent to the parish office, answered with a private tracking link. */
function RequestForm({ p, all, chosen, ministry }) {
  const c = useSite(),
    { L } = c;
  const turnstile = useRef(null),
    check = useRef(null),
    result = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  useEffect(() => {
    let live = true;
    mountTurnstile(turnstile.current, c.lang === 'ar' ? 'ar' : 'en').then(state => {
      if (live) check.current = state;
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (link) result.current?.scrollIntoView({ block: 'center', behavior: still() ? 'auto' : 'smooth' });
  }, [link]);
  const send = async e => {
    e.preventDefault();
    const form = e.currentTarget;
    setSending(true);
    setError('');
    try {
      const q = {
        ...Object.fromEntries(new FormData(form)),
        parish: p.id,
        responsibleAdult: form.elements.responsibleAdult.checked,
        ...(check.current ? { turnstile: check.current.token } : {})
      };
      const response = await fetch('/api/public/guest-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send request.');
      trackAction('request-sent', p.id);
      const url = new URL('public.html', location.href);
      url.hash = 'track=' + data.trackingToken;
      setLink(url.href);
    } catch (err) {
      setError(err.message);
      setSending(false);
      check.current?.reset();
    }
  };
  return (
    <>
      <form className="rq-form" data-guest-request hidden={!!link} onSubmit={send}>
        <fieldset className="rq-step" data-reveal>
          <legend>
            <span className="rq-n" aria-hidden="true">
              {digits(c, 1)}
            </span>
            {L('What do you need?', 'ماذا تحتاج؟')}
          </legend>
          <div className="rq-kinds">
            {all.map(([k, art, t, sub]) => (
              <label key={k} className="rq-kind">
                <input type="radio" name="kind" value={k} defaultChecked={k === chosen} required />
                <span className="arch-icon">
                  <Icon name={art} />
                </span>
                <span>
                  <b>{L(...t)}</b>
                  <small>{L(...sub)}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="rq-step" data-reveal>
          <legend>
            <span className="rq-n" aria-hidden="true">
              {digits(c, 2)}
            </span>
            {L('Who is asking?', 'من يطلب؟')}
          </legend>
          <div className="rq-fields">
            <label className="rq-field">
              <span>{L('Your full name', 'اسمك الكامل')}</span>
              <input name="name" required maxLength="120" autoComplete="name" />
            </label>
            <label className="rq-field">
              <span>
                {L('On behalf of', 'بالنيابة عن')} <small>{L('optional', 'اختياري')}</small>
              </span>
              <input name="behalf" maxLength="120" />
            </label>
            <label className="rq-field">
              <span>{L('Email', 'البريد الإلكتروني')}</span>
              <input type="email" name="email" autoComplete="email" maxLength="120" dir="ltr" />
            </label>
            <label className="rq-field">
              <span>{L('Phone', 'الهاتف')}</span>
              <input type="tel" name="phone" autoComplete="tel" maxLength="40" dir="ltr" />
            </label>
          </div>
          <p className="rq-hint">
            {L(
              'Give at least one way to reach you: an email address, a phone number, or both.',
              'أدخل وسيلة واحدة على الأقل للتواصل معك: بريد إلكتروني أو رقم هاتف أو كليهما.'
            )}
          </p>
        </fieldset>
        <fieldset className="rq-step" data-reveal>
          <legend>
            <span className="rq-n" aria-hidden="true">
              {digits(c, 3)}
            </span>
            {L('Your request', 'طلبك')}
          </legend>
          <label className="rq-field">
            <span>{L('Request details', 'تفاصيل الطلب')}</span>
            <textarea
              name="description"
              required
              minLength="5"
              maxLength="4000"
              rows="5"
              placeholder={L(
                'Names, dates and anything the office should know.',
                'الأسماء والتواريخ وكل ما يجب أن يعرفه المكتب.'
              )}
              defaultValue={
                ministry ? L('I would like to learn about joining ', 'أودّ الاستفسار عن الانضمام إلى ') + ministry : ''
              }
            />
          </label>
          <div className="rq-delivery" role="radiogroup" aria-labelledby="rq-delivery-label">
            <span className="rq-label" id="rq-delivery-label">
              {L('If there is a document, how would you like it?', 'إن كان هناك مستند، كيف تودّ استلامه؟')}
            </span>
            <label className="rq-opt">
              <input type="radio" name="delivery" value="collection" defaultChecked />
              <span>
                <b>{L('Collect from the parish', 'الاستلام من الرعية')}</b>
                <small>{L('The office tells you when it is ready.', 'يُعلمك المكتب عندما يصبح جاهزاً.')}</small>
              </span>
            </label>
            <label className="rq-opt">
              <input type="radio" name="delivery" value="secure-download" />
              <span>
                <b>{L('Secure download, when available', 'تنزيل آمن عند توفّره')}</b>
                <small>{L('From your private tracking link.', 'من رابط المتابعة الخاص بك.')}</small>
              </span>
            </label>
          </div>
        </fieldset>
        <label className="rq-check" data-reveal>
          <input name="responsibleAdult" type="checkbox" required />
          <span>
            {L(
              'I am the responsible adult submitting this request. A child will be accompanied by a parent or guardian.',
              'أنا الشخص البالغ المسؤول عن هذا الطلب. سيكون الطفل برفقة أحد الوالدين أو ولي الأمر.'
            )}
          </span>
        </label>
        <div className="rq-turnstile" data-turnstile hidden ref={turnstile}></div>
        <p className="rq-error" data-request-error role="alert">
          {error}
        </p>
        <button className="btn btn-gilt rq-send" type="submit" disabled={sending}>
          {L('Send request', 'إرسال الطلب')}
          <Glyph name="arrow" />
        </button>
      </form>
      <div data-request-result aria-live="polite" ref={result}>
        {link ? <RequestDone link={link} /> : null}
      </div>
    </>
  );
}

function RequestDone({ link }) {
  const { L } = useSite(),
    field = useRef(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="rq-done">
      <svg className="rq-tick" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="24" />
        <path d="M15 27.5l7 7 15-16" />
      </svg>
      <h2>{L('Request received', 'تم استلام الطلب')}</h2>
      <p>
        {L(
          'Save this private link. Anyone with it can see this request’s status. No email or SMS has been sent.',
          'احفظ هذا الرابط الخاص. يستطيع كل من يملكه الاطّلاع على حالة الطلب. لم تُرسل أي رسالة عبر البريد الإلكتروني أو الرسائل النصية.'
        )}
      </p>
      <label className="rq-link">
        <span>{L('Private tracking link', 'رابط المتابعة الخاص')}</span>
        <span className="rq-link-row">
          <input readOnly dir="ltr" value={link} ref={field} />
          <button
            type="button"
            className="btn btn-small btn-ink-line"
            data-copy
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                field.current.select();
              }
            }}
          >
            {copied ? L('Copied', 'تم النسخ') : L('Copy', 'نسخ')}
          </button>
        </span>
      </label>
      <a className="btn btn-gilt" href={link}>
        {L('Track my request', 'متابعة طلبي')}
      </a>
    </div>
  );
}
