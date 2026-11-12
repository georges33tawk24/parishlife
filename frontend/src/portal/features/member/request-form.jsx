/* Asking the parish for something: the request form step by step (who, where and when, the
   details) with what to prepare. */
import { Fragment } from 'react';
import { Select } from '../../ui/components.jsx';
import { htmlAttrs } from '../../ui/html.js';
import { t } from '../../../lib/i18n.js';
import { M } from '../../model/member-data.js';
import { S } from '../../model/store.js';
import { session } from '../../model/api.js';
import { Icon } from '../../ui/ui.jsx';
import {
  REQUEST_KINDS,
  kindOf,
  CERTIFICATE_OF,
  certificateName,
  PURPOSES,
  LANGUAGES,
  languageName,
  OCCASIONS,
  TOPICS,
  todayKey,
  phoneShow
} from '../../model/sacrament-requests.js';
import { availability, back, kindGrid, nameOf, otherName, stepReview, txt, yearsAhead } from './requests-shared.jsx';

const L = (en, ar) => t(en, ar);

const ONCE = new Set(['baptism', 'communion', 'confirmation', 'funeral']);

/* Half-hour steps for start and end times: a list is easier than a clock to set on any phone. */
const TIMES = Array.from(
  { length: 34 },
  (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
);

/* ---- a new request ------------------------------------------------------------ */
const LEGEND = {
  baptism: ['Who is to be baptized?', 'من سيُعمَّد؟'],
  communion: ['Who will receive First Communion?', 'من سيتناول القربان للمرّة الأولى؟'],
  confirmation: ['Who will receive confirmation?', 'من سيقبل سرّ الميرون؟'],
  marriage: ['Who is getting married?', 'من المُقبل على الزواج؟'],
  funeral: ['Who is the funeral for?', 'الجنّاز لراحة نفس من؟'],
  certificate: ['Whose certificate do you need?', 'لمن الشهادة؟']
};

const HEADING = {
  baptism: ['Request a baptism', 'طلب معمودية'],
  communion: ['Request First Communion', 'طلب المناولة الأولى'],
  confirmation: ['Request confirmation', 'طلب سرّ الميرون'],
  marriage: ['Request a marriage', 'طلب إكليل'],
  funeral: ['Request a funeral', 'طلب جنّاز'],
  certificate: ['Request a certificate', 'طلب شهادة'],
  booking: ['Book a hall or room', 'حجز قاعة أو مكان'],
  custom: ['Ask the parish', 'اطلب من الرعية']
};

const INTRO = {
  booking: [
    'Choose the place and the time. The parish office checks that it is free, and the priest confirms your booking.',
    'اختر المكان والموعد. يتحقّق مكتب الرعية من أنّه متاح، ويؤكّد الكاهن حجزك.'
  ],
  custom: [
    'Tell the parish what you need, in your own words. The parish office will read it and contact you.',
    'أخبر الرعية بما تحتاج إليه بكلماتك. سيقرأه مكتب الرعية ويتواصل معك.'
  ]
};

const DATE_LABEL = {
  marriage: ['Preferred wedding date', 'تاريخ الإكليل المفضّل'],
  funeral: ['Preferred date for the funeral', 'التاريخ المفضّل للجنّاز'],
  custom: ['Is it for a particular day?', 'هل هو ليوم معيّن؟']
};

const NOTE_HINT = {
  baptism: ['For example: the godparents’ names or a time that suits you', 'مثلاً: أسماء العرّابين أو وقت يناسبكم'],
  marriage: [
    'For example: the church you would like, or a time that suits you',
    'مثلاً: الكنيسة التي تفضّلونها أو وقت يناسبكم'
  ],
  funeral: [
    'For example: the family’s wishes or who the priest should call',
    'مثلاً: رغبات العائلة أو من يتّصل به الكاهن'
  ],
  certificate: ['For example: how many copies you need', 'مثلاً: عدد النسخ التي تحتاج إليها'],
  booking: [
    'For example: the tables and chairs you need, or who brings the food',
    'مثلاً: الطاولات والكراسي التي تحتاجونها، أو من يحضر الطعام'
  ]
};

const STEP_NAMES = kind => [
  kind === 'booking'
    ? L('Place and time', 'المكان والموعد')
    : kind === 'custom'
      ? L('Your request', 'طلبك')
      : L('Who it is for', 'لمن الطلب'),
  L('Details', 'التفاصيل'),
  L('Review and send', 'المراجعة والإرسال')
];

function draftFor(kind) {
  if (S.ui.mrDraft?.kind === kind) return S.ui.mrDraft;
  const phone = M.person?.phone && M.person.phone !== '—' ? phoneShow(M.person.phone) : '';
  const prefill = S.ui.mrPrefill?.kind === kind ? S.ui.mrPrefill : {};
  S.ui.mrPrefill = null;
  return (S.ui.mrDraft = {
    kind,
    step: 1,
    subject: '',
    child: { lat: '', ar: '', born: '', father: '', mother: '' },
    date: '',
    partner: '',
    partnerParish: '',
    certificateOf: '',
    purpose: '',
    purposeOther: '',
    language: 'bilingual',
    phone,
    notes: '',
    venue: '',
    from: '',
    to: '',
    occasion: '',
    occasionOther: '',
    guests: '',
    topic: '',
    subjectText: '',
    message: '',
    otherName: '',
    relationship: 'Parent',
    authority: '',
    ...prefill
  });
}

/* Who a request can be for. The API links "yourself" to your own record; for anyone else the office matches
   the person, so you describe them and say why you may ask. */
function subjectChoices(kind) {
  return kind === 'funeral' ? [] : [{ id: 'self', self: true, lat: session.user?.name || '', ar: '', blocked: '' }];
}

const fieldError = id => <span className="mr-error" id={`${id}-error`} hidden />;

const labelFor = (id, label, req) => (
  <label className="label" htmlFor={id}>
    {txt(label)}
    {req ? (
      <span className="req" aria-hidden="true">
        *
      </span>
    ) : (
      <span className="opt">{L('(optional)', '(اختياري)')}</span>
    )}
  </label>
);

const input = (id, label, value, { type = 'text', req = false, help = '', attrs = '', ar = false } = {}) => (
  <div className="formrow mr-field">
    {labelFor(id, label, req)}{' '}
    <input
      className="input"
      id={id}
      type={type}
      defaultValue={txt(value)}
      aria-required={req ? 'true' : undefined}
      aria-describedby={`${help ? `${id}-help ` : ''}${id}-error`}
      dir={ar ? 'rtl' : undefined}
      lang={ar ? 'ar' : undefined}
      {...htmlAttrs(attrs)}
    />{' '}
    {help ? (
      <span className="help" id={`${id}-help`}>
        {txt(help)}
      </span>
    ) : (
      ''
    )}
    {fieldError(id)}
  </div>
);

const select = (id, label, value, options, { req = false, placeholder = '' } = {}) => (
  <div className="formrow mr-field">
    {labelFor(id, label, req)}{' '}
    <Select id={id} defaultValue={txt(value)} aria-required={req ? 'true' : undefined} aria-describedby={`${id}-error`}>
      <option value="">{txt(placeholder)}</option>
      {options.map(([v, text], i) => (
        <option key={i} value={txt(v)}>
          {txt(text)}
        </option>
      ))}
    </Select>
    {fieldError(id)}
  </div>
);

const pills = (name, items, value, otherLabel) => (
  <div className="mr-pills">
    {items.map(([en, ar], i) => (
      <label key={i} className="mr-pill">
        <input type="radio" name={name} defaultValue={txt(en)} defaultChecked={!!(value === en)} />
        <span>{txt(t(en, ar))}</span>
      </label>
    ))}{' '}
    {otherLabel ? (
      <label className="mr-pill">
        <input type="radio" name={name} defaultValue="other" defaultChecked={!!(value === 'other')} />
        <span>{txt(otherLabel)}</span>
      </label>
    ) : (
      ''
    )}
  </div>
);

const RELATIONS = [
  ['Parent', 'Parent', 'أحد الوالدين'],
  ['Guardian', 'Guardian', 'ولي الأمر'],
  ['Spouse', 'Spouse', 'الزوج/الزوجة'],
  ['Child', 'Son or daughter', 'ابن/ابنة'],
  ['Relative', 'Relative', 'قريب'],
  ['Representative', 'Representative', 'وكيل'],
  ['Other', 'Other', 'آخر']
];
/* How the person asking is related to the one they ask for, and the basis of their authority. */
const relationFields = (d, who) => (
  <>
    {select(
      `mr-${who}-relation`,
      L('You are their', 'صلتك به'),
      d.relationship,
      RELATIONS.map(([v, en, ar]) => [v, L(en, ar)]),
      { req: true }
    )}
    {input(`mr-${who}-authority`, L('Why you may ask for them', 'لماذا يحق لك الطلب عنه'), d.authority, {
      req: true,
      attrs: 'maxlength="1000"',
      help: L('For example: I am the mother, or I hold his power of attorney.', 'مثلاً: أنا والدته، أو لدي وكالة منه.')
    })}
  </>
);

function stepWho(d) {
  if (d.kind === 'booking') return stepPlace(d);
  if (d.kind === 'custom') return stepAsk(d);
  const choices = subjectChoices(d.kind);
  const option = (value, title, sub, { disabled = false, checked = false } = {}) => (
    <label className={`mr-choice${disabled ? ' is-disabled' : ''}`}>
      <input
        type="radio"
        name="mr-subject"
        defaultValue={txt(value)}
        defaultChecked={!!checked}
        disabled={!!disabled}
      />{' '}
      <span className="mr-choice-body">
        <b>{txt(title)}</b>
        {sub ? <small>{txt(sub)}</small> : ''}
      </span>
    </label>
  );
  const childFields = (
    <div className="mr-child" id="mr-child" hidden={!(d.subject === 'child')}>
      <p className="mr-child-intro">
        {L(
          'Write the names as they should appear on the baptism certificate.',
          'اكتب الاسمين كما يجب أن يظهرا في شهادة المعمودية.'
        )}
      </p>{' '}
      <div className="formgrid">
        {input('mr-child-lat', L('Child’s full name in English', 'اسم الطفل الكامل بالإنكليزية'), d.child.lat, {
          req: true,
          attrs: 'autocomplete="off" maxlength="120"'
        })}{' '}
        {input('mr-child-ar', L('Child’s full name in Arabic', 'اسم الطفل الكامل بالعربية'), d.child.ar, {
          req: true,
          ar: true,
          attrs: 'autocomplete="off" maxlength="120"'
        })}
      </div>{' '}
      {input('mr-child-born', L('Date of birth', 'تاريخ الولادة'), d.child.born, {
        type: 'date',
        req: true,
        attrs: `max="${todayKey()}"`
      })}{' '}
      <div className="formgrid">
        {input('mr-child-father', L('Father’s full name', 'اسم الأب الكامل'), d.child.father, {
          attrs: 'maxlength="120"'
        })}{' '}
        {input('mr-child-mother', L('Mother’s full name', 'اسم الأم الكامل'), d.child.mother, {
          attrs: 'maxlength="120"'
        })}
      </div>
      {relationFields(d, 'child')}
    </div>
  );
  const otherFields = (
    <div className="mr-child" id="mr-other" hidden={!(d.subject === 'other')}>
      <p className="mr-child-intro">
        {L(
          'The parish office matches this person to their record. Tell us who they are and why you may ask for them.',
          'يربط مكتب الرعية هذا الشخص بسجله. أخبرنا من هو ولماذا يحق لك الطلب عنه.'
        )}
      </p>{' '}
      {input('mr-other-name', L('Their full name', 'اسمه الكامل'), d.otherName, {
        req: true,
        attrs: 'maxlength="200"'
      })}{' '}
      {relationFields(d, 'other')}
    </div>
  );
  const people = choices.map((s, i) => (
    <Fragment key={i}>
      {option(s.id, s.self ? L('You', 'أنت') + ' — ' + nameOf(s) : nameOf(s), s.blocked || otherName(s), {
        disabled: !!s.blocked,
        checked: d.subject === s.id && !s.blocked
      })}
    </Fragment>
  ));
  return (
    <>
      <fieldset className="mr-fieldset" id="mr-subject-group" aria-describedby="mr-subject-help mr-subject-error">
        <legend className="mr-legend">{L(...LEGEND[d.kind])}</legend>{' '}
        <div className="mr-choices">
          {people}
          {d.kind === 'baptism'
            ? option(
                'child',
                L('A child who is not registered in the parish yet', 'طفل غير مسجّل في الرعية بعد'),
                L('You will add the child’s details below', 'ستضيف تفاصيل الطفل أدناه'),
                { checked: d.subject === 'child' }
              )
            : ''}
          {option('other', L('Someone else', 'شخص آخر'), L('You describe them below', 'تصفه أدناه'), {
            checked: d.subject === 'other'
          })}
        </div>{' '}
        {fieldError('mr-subject')}{' '}
        <p className="help" id="mr-subject-help">
          {d.kind === 'funeral'
            ? L('A funeral is requested for someone who has died.', 'يُطلب الجنّاز عن شخص متوفّى.')
            : L(
                'Ask for yourself, or for someone else if you are allowed to.',
                'اطلب لنفسك، أو لشخص آخر إذا كان يحق لك ذلك.'
              )}
        </p>
      </fieldset>
      {d.kind === 'baptism' ? childFields : ''}
      {otherFields}
    </>
  );
}

/* A booking: which place, which day, from when until when, and what is already taken that day. */
function stepPlace(d) {
  return (
    <>
      <fieldset className="mr-fieldset" id="mr-venue-group" aria-describedby="mr-venue-error">
        <legend className="mr-legend">{L('Which place would you like?', 'أي مكان تريد؟')}</legend>{' '}
        {input('mr-venue', L('Place or room', 'المكان أو القاعة'), d.venue, {
          req: true,
          attrs: 'maxlength="200"',
          help: L(
            'Name it as you know it, for example the parish hall. The office confirms it is free.',
            'سمِّه كما تعرفه، مثل قاعة الرعية. يؤكد المكتب أنه متاح.'
          )
        })}
      </fieldset>{' '}
      <fieldset className="mr-fieldset">
        <legend className="mr-legend mr-legend-sm">{L('When?', 'متى؟')}</legend>{' '}
        {input('mr-bdate', L('Date', 'التاريخ'), d.date, {
          type: 'date',
          req: true,
          attrs: `min="${todayKey()}" max="${yearsAhead(2)}"`
        })}{' '}
        <div className="formgrid">
          {select(
            'mr-from',
            L('From', 'من'),
            d.from,
            TIMES.slice(0, -1).map(x => [x, x]),
            { req: true, placeholder: L('Start time', 'وقت البدء') }
          )}{' '}
          {select(
            'mr-to',
            L('Until', 'حتى'),
            d.to,
            TIMES.slice(1).map(x => [x, x]),
            { req: true, placeholder: L('End time', 'وقت الانتهاء') }
          )}
        </div>{' '}
        <div className="mr-availability" id="mr-availability" aria-live="polite">
          {availability(d)}
        </div>
      </fieldset>
    </>
  );
}

/* Anything else: a few words, then the details in the parishioner's own words. */
function stepAsk(d) {
  return (
    <>
      <fieldset className="mr-fieldset" id="mr-topic-group">
        <legend className="mr-legend">{L('What would you like to ask for?', 'ماذا تودّ أن تطلب؟')}</legend>{' '}
        {pills('mr-topic', TOPICS, d.topic, L('Something else', 'أمر آخر'))}
      </fieldset>{' '}
      {input('mr-subject-text', L('In a few words', 'بكلمات قليلة'), d.subjectText, {
        req: true,
        attrs: 'maxlength="120" autocomplete="off"'
      })}{' '}
      <div className="formrow mr-field">
        {labelFor('mr-message', L('Tell the parish office more', 'أخبر مكتب الرعية بالمزيد'), true)}{' '}
        <textarea
          className="textarea"
          id="mr-message"
          rows="5"
          maxLength="1000"
          aria-required="true"
          aria-describedby="mr-message-count mr-message-error"
          placeholder={txt(L('For example: who it is for, where, and when suits you', 'مثلاً: لمن، وأين، ومتى يناسبك'))}
          defaultValue={txt(d.message)}
        />{' '}
        <span className="counter" id="mr-message-count">
          {d.message.length} / 1000
        </span>
        {fieldError('mr-message')}
      </div>
    </>
  );
}

const notesField = d => (
  <div className="formrow mr-field">
    {labelFor('mr-notes', L('Anything the parish office should know?', 'هل من أمر يجب أن يعرفه مكتب الرعية؟'), false)}{' '}
    <textarea
      className="textarea"
      id="mr-notes"
      rows="4"
      maxLength="500"
      placeholder={txt(t(...(NOTE_HINT[d.kind] || ['', ''])))}
      aria-describedby="mr-notes-count mr-notes-error"
      defaultValue={txt(d.notes)}
    />{' '}
    <span className="counter" id="mr-notes-count">
      {d.notes.length} / 500
    </span>
    {fieldError('mr-notes')}
  </div>
);

const phoneField = d =>
  input('mr-phone', L('Phone number', 'رقم الهاتف'), d.phone, {
    type: 'tel',
    help: L('So the parish office can call you if needed.', 'ليتمكّن مكتب الرعية من الاتصال بك عند الحاجة.'),
    attrs: 'autocomplete="tel" inputmode="tel" maxlength="40" dir="ltr"'
  });

function stepDetails(d) {
  const subject =
    d.subject === 'self'
      ? { self: true, lat: session.user?.name || '', ar: '' }
      : d.subject === 'other'
        ? { lat: d.otherName, ar: '' }
        : null;
  if (d.kind === 'booking') {
    const v = venueOf(d.venue);
    return (
      <>
        <fieldset className="mr-fieldset" id="mr-occasion-group" aria-describedby="mr-occasion-error">
          <legend className="mr-legend">{L('What is it for?', 'لأي مناسبة؟')}</legend>{' '}
          {pills('mr-occasion', OCCASIONS, d.occasion, L('Something else', 'مناسبة أخرى'))}
          {fieldError('mr-occasion')}{' '}
          <div id="mr-occasion-other-wrap" hidden={!(d.occasion === 'other')}>
            {input('mr-occasion-other', L('Describe the occasion', 'صِف المناسبة'), d.occasionOther, {
              req: true,
              attrs: 'maxlength="120"'
            })}
          </div>
        </fieldset>{' '}
        {input('mr-guests', L('How many people do you expect?', 'كم شخصاً تتوقّع؟'), d.guests, {
          type: 'number',
          req: true,
          help: v
            ? L(
                `${t(v.name, v.ar || v.name)} holds up to ${v.cap} people.`,
                `${t(v.name, v.ar || v.name)} يتّسع لـ ${v.cap} شخصاً.`
              )
            : '',
          attrs: `inputmode="numeric" min="1" ${v ? `max="${v.cap}"` : ''} step="1"`
        })}{' '}
        {phoneField(d)}
        {notesField(d)}
      </>
    );
  }
  if (d.kind === 'custom')
    return (
      <>
        <h2 className="mr-legend">{L('A few details', 'بعض التفاصيل')}</h2>{' '}
        {input('mr-date', L(...DATE_LABEL.custom), d.date, {
          type: 'date',
          help: L('Leave it empty if any day suits you.', 'اتركه فارغاً إذا كان أي يوم يناسبك.'),
          attrs: `min="${todayKey()}"`
        })}{' '}
        {phoneField(d)}
      </>
    );
  const body = [];
  if (d.kind === 'certificate') {
    body.push(
      <>
        <fieldset className="mr-fieldset" id="mr-of-group" aria-describedby="mr-of-error">
          <legend className="mr-legend mr-legend-sm">{L('Which certificate?', 'أي شهادة؟')}</legend>{' '}
          <div className="mr-choices mr-choices-2">
            {CERTIFICATE_OF.map(([id], i) => {
              const onRecord = subject?.onRecord.includes(id);
              return (
                <label key={i} className="mr-choice">
                  <input type="radio" name="mr-of" defaultValue={id} defaultChecked={!!(d.certificateOf === id)} />{' '}
                  <span className="mr-choice-body">
                    <b>{txt(certificateName(id))}</b>
                    <small>
                      {onRecord
                        ? L('Recorded in this parish', 'مدوَّن في هذه الرعية')
                        : L('The parish office will check the register', 'سيتحقّق مكتب الرعية من السجل')}
                    </small>
                  </span>
                </label>
              );
            })}
          </div>
          {fieldError('mr-of')}
        </fieldset>{' '}
        <fieldset className="mr-fieldset" id="mr-purpose-group" aria-describedby="mr-purpose-error">
          <legend className="mr-legend mr-legend-sm">{L('What is it for?', 'لأي غرض؟')}</legend>{' '}
          {pills('mr-purpose', PURPOSES, d.purpose, L('Something else', 'غرض آخر'))} {fieldError('mr-purpose')}{' '}
          <div id="mr-purpose-other-wrap" hidden={!(d.purpose === 'other')}>
            {input('mr-purpose-other', L('Describe the purpose', 'صِف الغرض'), d.purposeOther, {
              req: true,
              attrs: 'maxlength="200"'
            })}
          </div>
        </fieldset>{' '}
        <fieldset className="mr-fieldset">
          <legend className="mr-legend mr-legend-sm">{L('Language of the certificate', 'لغة الشهادة')}</legend>{' '}
          <div className="mr-pills">
            {LANGUAGES.map(([id], i) => (
              <label key={i} className="mr-pill">
                <input type="radio" name="mr-language" defaultValue={id} defaultChecked={!!(d.language === id)} />
                <span>{txt(languageName(id))}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </>
    );
  } else {
    body.push(<h2 className="mr-legend">{L('A few details', 'بعض التفاصيل')}</h2>);
    body.push(
      input('mr-date', L(...(DATE_LABEL[d.kind] || ['Preferred date', 'التاريخ المفضّل'])), d.date, {
        type: 'date',
        help: L('The parish office will confirm the date with you.', 'سيؤكّد مكتب الرعية الموعد معك.'),
        attrs: `min="${todayKey()}"`
      })
    );
    if (d.kind === 'marriage')
      body.push(
        <div className="formgrid">
          {input('mr-partner', L('Future spouse’s full name', 'اسم الشريك الكامل'), d.partner, {
            req: true,
            attrs: 'maxlength="120"'
          })}{' '}
          {input('mr-partner-parish', L('Their parish', 'رعيّته'), d.partnerParish, {
            help: L('If they belong to another parish', 'إذا كان من رعية أخرى'),
            attrs: 'maxlength="120"'
          })}
        </div>
      );
  }
  return (
    <>
      {body.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
      {phoneField(d)}
      {notesField(d)}
    </>
  );
}

function prepareAside(kind) {
  const after =
    kind === 'booking'
      ? [
          L('The parish office checks that the place is free', 'يتحقّق مكتب الرعية من أنّ المكان متاح'),
          L('The priest confirms the booking', 'يؤكّد الكاهن الحجز'),
          L('You collect the keys from the parish office', 'تستلم المفاتيح من مكتب الرعية')
        ]
      : kind === 'custom'
        ? [
            L('The parish office reads your request', 'يقرأ مكتب الرعية طلبك'),
            L('They accept it and contact you', 'يقبله ويتواصل معك'),
            L('You see here when it is done', 'ترى هنا متى أُنجز')
          ]
        : [
            L('The parish office reviews your request', 'يراجع مكتب الرعية طلبك'),
            kind === 'certificate'
              ? L('The priest checks the register and signs', 'يتحقّق الكاهن من السجل ويوقّع')
              : L('The priest accepts it', 'يقبله الكاهن'),
            kind === 'certificate'
              ? L('You collect it from the parish office', 'تستلمها من مكتب الرعية')
              : L('You follow preparation and dates here', 'تتابع التحضير والمواعيد من هنا')
          ];
  let first;
  if (kind === 'booking') {
    first = (
      <section className="member-card">
        <h2>{L('Good to know', 'معلومات مفيدة')}</h2>
        <p className="mr-aside-text">
          {L(
            'For the church or a chapel, please call the parish office.',
            'لحجز الكنيسة أو المصلّى، يُرجى الاتصال بمكتب الرعية.'
          )}
        </p>
      </section>
    );
  } else {
    const list = [];
    const generic = {
      communion: [
        'The parish will tell you about the First Communion preparation classes and the date of the celebration.',
        'ستُعلمك الرعية بلقاءات التحضير للمناولة الأولى وبموعد الاحتفال.'
      ],
      confirmation: [
        'The parish will tell you how to prepare and when confirmation is celebrated.',
        'ستُعلمك الرعية بكيفية التحضير وبموعد الاحتفال بالميرون.'
      ],
      funeral: [
        'Please also call the parish office so the priest can be reached quickly.',
        'يُرجى أيضاً الاتصال بمكتب الرعية ليتمكّن الكاهن من التواصل معكم سريعاً.'
      ],
      certificate: [
        'Certificates are signed by the priest. You will get a notification when yours is ready to collect.',
        'يوقّع الكاهن الشهادات، وسيصلك إشعار عندما تصبح شهادتك جاهزة للاستلام.'
      ],
      custom: [
        'Write in your own words, as you would say it on the phone. The parish office will call you if anything is unclear.',
        'اكتب بكلماتك كما لو كنت تتكلّم على الهاتف. سيتّصل بك مكتب الرعية إذا كان أي أمر غير واضح.'
      ]
    };
    const body = list.length ? (
      <>
        <ul className="mr-checklist">
          {list.map(([en, ar, required], i) => (
            <li key={i}>
              <Icon name="doc" size={16} />
              <span>{txt(t(en, ar))}</span>
              <small>{required ? L('Required', 'مطلوب') : L('Optional', 'اختياري')}</small>
            </li>
          ))}
        </ul>{' '}
        <p className="help">
          {L(
            'Bring these to the parish office. They are not needed to send the request.',
            'أحضرها إلى مكتب الرعية. لا حاجة إليها لإرسال الطلب.'
          )}
        </p>
      </>
    ) : (
      <p className="mr-aside-text">
        {txt(
          t(...(generic[kind] || ['The parish office will tell you what is needed.', 'سيُعلمك مكتب الرعية بما يلزم.']))
        )}
      </p>
    );
    first = (
      <section className="member-card">
        <h2>{list.length ? L('What to prepare', 'ما يجب تحضيره') : L('Good to know', 'معلومات مفيدة')}</h2>
        {body}
      </section>
    );
  }
  return (
    <aside className="mr-aside">
      {first}{' '}
      <section className="member-card">
        <h2>{L('After you send it', 'بعد الإرسال')}</h2>
        <ol className="mr-mini-steps">
          {after.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

export function newPage(kind) {
  if (!REQUEST_KINDS.some(k => k.id === kind))
    return (
      <div className="member-page mr-page">
        {back()}{' '}
        <header className="member-head">
          <h1>{L('What would you like to ask for?', 'ماذا تودّ أن تطلب؟')}</h1>
        </header>
        {kindGrid(REQUEST_KINDS)}
      </div>
    );
  const d = draftFor(kind),
    steps = STEP_NAMES(kind);
  return (
    <div className="member-page mr-page">
      {back()}{' '}
      <header className="member-head mr-form-head">
        <span className="mr-head-icon" aria-hidden="true">
          <Icon name={kindOf(kind).icon} size={26} />
        </span>{' '}
        <div>
          <h1>{L(...HEADING[kind])}</h1>
          <p>
            {INTRO[kind]
              ? L(...INTRO[kind])
              : L(
                  'Tell the parish office who it is for. They will review your request and guide you through every step.',
                  'أخبر مكتب الرعية لمن الطلب. سيراجع طلبك ويرافقك في كل خطوة.'
                )}
          </p>
        </div>
      </header>{' '}
      <div className="mr-layout">
        <form className="member-card mr-form" id="mr-form" noValidate>
          <ol className="mr-progress" aria-label={L('Steps', 'الخطوات')}>
            {steps.map((label, i) => (
              <li
                key={i}
                data-step-mark={i + 1}
                aria-current={d.step === i + 1 ? 'step' : undefined}
                className={d.step > i + 1 ? 'done' : ''}
              >
                <span className="n" aria-hidden="true">
                  {d.step > i + 1 ? <Icon name="check" size={13} /> : i + 1}
                </span>
                <span>{txt(label)}</span>
              </li>
            ))}
          </ol>{' '}
          <div className="alert alert-warning mr-error-summary" id="mr-errors" role="alert" tabIndex="-1" hidden />{' '}
          <div className="mr-step" data-step="1" hidden={!(d.step === 1)}>
            {stepWho(d)}
          </div>{' '}
          <div className="mr-step" data-step="2" hidden={!(d.step === 2)}>
            {stepDetails(d)}
          </div>{' '}
          <div className="mr-step" data-step="3" hidden={!(d.step === 3)} id="mr-review">
            {d.step === 3 ? stepReview(d) : ''}
          </div>{' '}
          <div className="mr-actions">
            <button type="button" className="btn btn-secondary" id="mr-back" hidden={!!(d.step === 1)}>
              {L('Back', 'رجوع')}
            </button>{' '}
            <button type="button" className="btn btn-primary" id="mr-continue" hidden={!!(d.step === 3)}>
              {L('Continue', 'متابعة')}
              <Icon name="arrowR" size={16} />
            </button>{' '}
            <button type="submit" className="btn btn-primary" id="mr-send" hidden={!(d.step === 3)}>
              <Icon name="check" size={16} />
              {L('Send request', 'إرسال الطلب')}
            </button>
          </div>
        </form>{' '}
        {prepareAside(kind)}
      </div>
    </div>
  );
}
