/* Asking a parish for something without an account (design A3): what happens next as a chart of four
   steps, then the request (what is needed, from a dropdown whose "Other" opens a box to describe it, and
   the details), who is asking, and the private link that follows it.
   Main parts: RequestPage, RequestForm, RequestDone. */
import { useEffect, useRef, useState } from 'react';
import { mountTurnstile } from '../../lib/turnstile.js';
import { guestSubmit, publicKind, trackingLink } from '../../portal/model/guest-requests.js';
import { useSite, still } from '../site.jsx';
import { A3Icon, Select } from '../components/a3.jsx';
import { ParishMark } from './Home.jsx';
import { Bring, CopyButton, ParishSub, facts } from './parish-parts.jsx';

/* What a visitor can ask for, as the public request form's kinds (guest-requests.js publicKind). */
const KINDS = [
  ['baptism', 'Baptism', 'المعمودية'],
  ['communion', 'First Communion', 'المناولة الأولى'],
  ['confirmation', 'Confirmation', 'الميرون'],
  ['marriage', 'Marriage', 'الإكليل'],
  ['funeral', 'Funeral', 'الجنّاز'],
  ['certificate', 'Certificate', 'شهادة'],
  ['booking', 'Book a hall or room', 'حجز قاعة أو مكان'],
  ['appointment', 'Appointment with the parish office', 'موعد مع مكتب الرعية'],
  ['ministry', 'Joining a ministry', 'الانضمام إلى خدمة'],
  ['custom', 'Other', 'آخر']
];

const RELATIONS = [
  ['Parent', 'Parent', 'أحد الوالدين'],
  ['Guardian', 'Guardian', 'ولي الأمر'],
  ['Spouse', 'Husband or wife', 'الزوج أو الزوجة'],
  ['Child', 'Son or daughter', 'الابن أو الابنة'],
  ['Relative', 'Relative', 'قريب'],
  ['Representative', 'Representative', 'وكيل'],
  ['Other', 'Other', 'صلة أخرى']
];

export function RequestPage({ p, d, kind }) {
  const c = useSite(),
    f = facts(c, p, d),
    { L, lang } = c;
  const ministry = new URLSearchParams(location.search).get('ministry') || '';
  const flow = [
    ['send', L('You send your request', 'ترسل طلبك'), L('No account is needed.', 'لا حاجة إلى حساب.')],
    [
      'inbox',
      L('The office reads it', 'يقرأه المكتب'),
      L('It goes only to this parish’s office.', 'يصل إلى مكتب هذه الرعية فقط.')
    ],
    [
      'chat',
      L('It answers or asks for documents', 'يجيب أو يطلب مستندات'),
      L('Follow each step with your private link.', 'تابع كل خطوة برابطك الخاص.')
    ],
    [
      'filecheck',
      L('You collect what you asked for', 'تستلم ما طلبته'),
      L('The office tells you how and when.', 'يخبرك المكتب كيف ومتى.')
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
      <section className="wrap flow-sec" aria-labelledby="rq-flow">
        <h2 id="rq-flow" className="h3">
          {L('What happens next', 'ماذا يحدث بعد ذلك')}
        </h2>
        <ol className="flow tints">
          {flow.map(([icon, b, s]) => (
            <li key={icon} className="card">
              <span className="ic" aria-hidden="true">
                <A3Icon name={icon} />
              </span>
              <b>{b}</b>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="wrap sec" style={{ paddingTop: 48 }}>
        <div className="split">
          <div className="main">
            <RequestForm p={p} chosen={KINDS.some(k => k[0] === kind) ? kind : ''} ministry={ministry} />
          </div>
          <aside className="side">
            <a className="card person" href={c.profileURL(p.id)}>
              <ParishMark p={p} />
              <span>
                <strong className="t">{f.name}</strong>
                <span className="d" style={{ display: 'block' }}>
                  {[f.town, f.rite].filter(Boolean).join(L(', ', '، '))}
                </span>
              </span>
            </a>
            <Bring f={f} />
            {f.phone ? (
              <div className="card t-sky side-card">
                <h2 className="t">{L('Prefer to call?', 'تفضّل الاتصال؟')}</h2>
                {f.visit.officeHours ? <p dir="auto">{f.visit.officeHours}</p> : null}
                <a className="btn btn-soft" href={`tel:${f.phone}`}>
                  <A3Icon name="phone" />
                  {L('Call the parish office', 'اتصل بمكتب الرعية')}
                </a>
              </div>
            ) : null}
            <p className="d side-note">
              {L(
                'The parish receives these details to handle your request. See the ',
                'تتلقّى الرعية هذه التفاصيل لمتابعة طلبك. راجع '
              )}
              <a href={lang === 'ar' ? 'privacy.html?lang=ar' : 'privacy.html?lang=en'}>
                {L('privacy policy', 'سياسة الخصوصية')}
              </a>
              {'. '}
              {L(
                'No email or text message is sent automatically. Anyone with your tracking link can see the request’s status, so keep it to yourself.',
                'لا تُرسل رسائل بريد أو رسائل نصية تلقائياً. يستطيع كل من يملك رابط المتابعة رؤية حالة الطلب، فاحتفظ به لنفسك.'
              )}
            </p>
          </aside>
        </div>
      </section>
    </ParishSub>
  );
}

/* The request itself: sent to the parish office, answered with a private tracking link. */
function RequestForm({ p, chosen, ministry }) {
  const c = useSite(),
    { L } = c;
  const turnstile = useRef(null),
    check = useRef(null),
    result = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [kind, setKind] = useState(chosen || (ministry ? 'ministry' : ''));
  const [behalf, setBehalf] = useState('');
  const [relation, setRelation] = useState('Parent');
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
      const el = form.elements,
        value = name => String(el[name]?.value || '').trim();
      if (!kind) {
        document.getElementById('rq-kind')?.focus();
        throw new Error(L('Choose what you need.', 'اختر ما تحتاجه.'));
      }
      if (!value('email') && !value('phone'))
        throw new Error(L('Give an email address or a phone number.', 'أدخل بريداً إلكترونياً أو رقم هاتف.'));
      if (check.current && !check.current.token) throw new Error(L('Complete the check first.', 'أكمل التحقّق أولاً.'));
      const [apiKind, label] = publicKind(kind),
        onBehalf = value('behalf'),
        other = kind === 'custom' ? value('other') : '',
        description = other ? `${other}\n\n${value('description')}` : value('description');
      const receipt = await guestSubmit(
        p.id,
        {
          kind: apiKind,
          summary: `${other || label}: ${value('description')}`.slice(0, 300),
          details: {
            requestKind: kind,
            description,
            ...(apiKind === 'SacramentInquiry' ? { sacrament: kind } : {}),
            ...(value('email') ? { email: value('email') } : {}),
            ...(value('phone') ? { phone: value('phone') } : {}),
            ...(onBehalf ? { behalf: onBehalf } : {}),
            ...(ministry ? { ministry } : {})
          },
          requesterName: value('name'),
          requesterContact: [value('email'), value('phone')].filter(Boolean).join(' · '),
          subjectDescription: onBehalf || value('name'),
          relationship: onBehalf ? relation || 'Other' : 'Self',
          authorityBasis: onBehalf ? value('authority') : null
        },
        check.current?.token
      );
      setLink(trackingLink(receipt, p.id));
    } catch (err) {
      setError(err.message);
      setSending(false);
      check.current?.reset();
    }
  };
  return (
    <>
      <form className="rq-form" hidden={!!link} onSubmit={send}>
        <fieldset className="card fs">
          <legend className="h3 lg">{L('Your request', 'طلبك')}</legend>
          <Select
            id="rq-kind"
            label={L('What do you need?', 'ماذا تحتاج؟')}
            value={kind}
            options={[
              { value: '', label: L('Choose one', 'اختر') },
              ...KINDS.map(([v, en, ar]) => ({ value: v, label: L(en, ar) }))
            ]}
            onChange={setKind}
          />
          {kind === 'custom' ? (
            <div style={{ marginTop: 18 }}>
              <label className="lbl" htmlFor="rq-other">
                {L('Tell us what you need', 'أخبرنا بما تحتاج')}
              </label>
              <input id="rq-other" name="other" className="field" required maxLength="120" />
            </div>
          ) : null}
          <label className="lbl" htmlFor="rq-details" style={{ marginTop: 22 }}>
            {L('Request details', 'تفاصيل الطلب')}
          </label>
          <span className="hint" id="rq-details-h">
            {L('Names, dates and anything the office should know.', 'الأسماء والتواريخ وكل ما يجب أن يعرفه المكتب.')}
          </span>
          <textarea
            id="rq-details"
            name="description"
            className="field"
            aria-describedby="rq-details-h"
            required
            minLength="5"
            maxLength="2000"
            defaultValue={
              ministry ? L('I would like to learn about joining ', 'أودّ الاستفسار عن الانضمام إلى ') + ministry : ''
            }
          />
        </fieldset>
        <fieldset className="card fs">
          <legend className="h3 lg">{L('Your contact details', 'معلومات التواصل معك')}</legend>
          <div className="fgrid">
            <div>
              <label className="lbl" htmlFor="rq-name">
                {L('Your full name', 'اسمك الكامل')}
              </label>
              <input id="rq-name" name="name" className="field" required maxLength="120" autoComplete="name" />
            </div>
            <div>
              <label className="lbl" htmlFor="rq-behalf">
                {L('On behalf of', 'بالنيابة عن')} <span className="opt">{L('(optional)', '(اختياري)')}</span>
              </label>
              <input
                id="rq-behalf"
                name="behalf"
                className="field"
                maxLength="120"
                value={behalf}
                onChange={e => setBehalf(e.target.value)}
              />
            </div>
            {behalf.trim() ? (
              <>
                <Select
                  id="rq-rel"
                  label={L('You are their', 'صلتك به')}
                  value={relation}
                  options={RELATIONS.map(([v, en, ar]) => ({ value: v, label: L(en, ar) }))}
                  onChange={setRelation}
                />
                <div>
                  <label className="lbl" htmlFor="rq-authority">
                    {L('Why you may ask for them', 'لماذا يحق لك الطلب عنه')}
                  </label>
                  <input id="rq-authority" name="authority" className="field" required maxLength="1000" />
                </div>
              </>
            ) : null}
            <div>
              <label className="lbl" htmlFor="rq-email">
                {L('Email', 'البريد الإلكتروني')}
              </label>
              <input
                id="rq-email"
                type="email"
                name="email"
                className="field"
                autoComplete="email"
                maxLength="120"
                dir="ltr"
              />
            </div>
            <div>
              <label className="lbl" htmlFor="rq-phone">
                {L('Phone', 'الهاتف')}
              </label>
              <input
                id="rq-phone"
                type="tel"
                name="phone"
                className="field"
                autoComplete="tel"
                maxLength="40"
                dir="ltr"
              />
            </div>
          </div>
          <p className="hint" style={{ margin: '14px 0 0' }}>
            {L(
              'Give at least one way to reach you: an email address, a phone number, or both.',
              'أدخل وسيلة واحدة على الأقل للتواصل معك: بريد إلكتروني أو رقم هاتف أو كليهما.'
            )}
          </p>
          <label className="check">
            <input name="responsibleAdult" type="checkbox" required />
            <span>
              {L(
                'I am the responsible adult submitting this request. A child will be accompanied by a parent or guardian.',
                'أنا الشخص البالغ المسؤول عن هذا الطلب. سيكون الطفل برفقة أحد الوالدين أو ولي الأمر.'
              )}
            </span>
          </label>
        </fieldset>
        <div className="rq-turnstile" data-turnstile hidden ref={turnstile}></div>
        {error ? (
          <p className="notice" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn btn-red rq-send" type="submit" disabled={sending}>
          <A3Icon name="send" />
          {L('Send request', 'إرسال الطلب')}
        </button>
      </form>
      <div aria-live="polite" ref={result}>
        {link ? <RequestDone link={link} /> : null}
      </div>
    </>
  );
}

function RequestDone({ link }) {
  const { L } = useSite();
  return (
    <div className="card goldtop rq-done">
      <span className="seal" aria-hidden="true">
        <A3Icon name="check" />
      </span>
      <h2 className="h2">{L('Request received', 'تم استلام الطلب')}</h2>
      <p>
        {L(
          'Save this private link. Anyone with it can see this request’s status. No email or SMS has been sent.',
          'احفظ هذا الرابط الخاص. يستطيع كل من يملكه الاطّلاع على حالة الطلب. لم تُرسل أي رسالة عبر البريد الإلكتروني أو الرسائل النصية.'
        )}
      </p>
      <label className="lbl" htmlFor="rq-link">
        {L('Private tracking link', 'رابط المتابعة الخاص')}
      </label>
      <div className="link-row">
        <input id="rq-link" className="field" readOnly dir="ltr" value={link} onFocus={e => e.target.select()} />
        <CopyButton url={link} label={L('Copy', 'نسخ')} done={L('Copied', 'تم النسخ')} />
      </div>
      <div className="acts">
        <a className="btn btn-red" href={link}>
          {L('Track my request', 'متابعة طلبي')}
        </a>
      </div>
    </div>
  );
}
