import { Select } from "../ui/components.jsx";
import { htmlAttrs, paint } from "../ui/html.js";
/* Member portal: ask the parish for a sacrament, a certificate, a hall or room, or anything else;
   follow it step by step, and withdraw it while it waits. Requests reach the parish office's
   Requests page. */
import { t, isAr, fmtDate } from "../../lib/i18n.js";
import { M, memberAction, loadMember } from "../model/member-data.js";
import { session } from "../model/api.js";
import { hydrate } from "../model/persist.js";
import { bus, go, S } from "../model/store.js";
import { Icon, Pill, openModal, closeOverlays, toast, Paged } from "../ui/ui.jsx";
import { REQUEST_KINDS, kindOf, kindName, CERTIFICATE_OF, certificateName, PURPOSES, purposeText, LANGUAGES, languageName, OCCASIONS, occasionText, TOPICS, topicText, fmtDay, fmtStamp, plannedText, todayKey, stageInfo, isActive, CLOSED, stepsFor, stepsDone, stepTimes, nextText, eventLabel, phoneShow } from "../model/sacrament-requests.js";
const L = (en, ar) => t(en, ar);
const txt = value => String(value ?? '');
const nameOf = x => (isAr() ? x.ar || x.lat : x.lat || x.ar) || '';
const otherName = x => {
  const other = isAr() ? x.lat : x.ar;
  return other && other !== nameOf(x) ? other : '';
};
const ONCE = new Set(['baptism', 'communion', 'confirmation', 'funeral']);
const OWN = new Set(['booking', 'custom']); // asked by the member for themselves
const venueOf = id => (M.requestOptions?.venues || []).find(v => v.id === id);
const venueName = id => {
  const v = venueOf(id);
  return v ? t(v.name, v.ar || v.name) : String(id || '');
};
const titleOf = r => r.kind === 'certificate' ? certificateName(r.details.certificateOf) : r.kind === 'booking' ? `${L('Booking', 'حجز')} · ${venueName(r.details.venue)}` : r.kind === 'custom' ? topicText(r.details.subject) : kindName(r.kind);
/* The second half of a title: who it is for, or when a booking is */
const aboutOf = r => r.kind === 'booking' ? `${fmtDay(r.details.date)}, ${r.details.from}–${r.details.to}` : r.kind === 'custom' ? '' : nameOf(r.subject);
const phoneLink = phone => phone ? <a className="mr-phone" href={`tel:${txt(String(phone).replace(/[^\d+]/g, ''))}`}><Icon name='phone' size={16} /><bdi dir="ltr">{txt(phone)}</bdi></a> : '';
const back = () => <a className="mr-back" href="#/myrequests"><Icon name='chevL' size={16} />{L('My requests', 'طلباتي')}</a>;
async function reload() {
  if (session.user?.role === 'member') await hydrate();else await loadMember();
}
const redraw = () => {
  if (session.user?.role === 'member') bus.renderAll();else bus.refresh();
};
const yearsAhead = n => `${Number(todayKey().slice(0, 4)) + n}-12-31`;
const minutes = clock => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
/* Half-hour steps for start and end times: a list is easier than a clock to set on any phone. */
const TIMES = Array.from({
  length: 34
}, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/* ---- the list -------------------------------------------------------------- */
function kindGrid(kinds, cls = '') {
  return <div className={`mr-kinds${cls}`}>{kinds.map(k => <a className="mr-kind" href={`#/myrequests/new/${k.id}`}><span className="mr-kind-icon" aria-hidden="true"><Icon name={k.icon} size={22} /></span>{" "}<span className="mr-kind-text"><b>{txt(t(k.en, k.ar))}</b><small>{txt(t(k.descEn, k.descAr))}</small></span>{" "}<Icon name='arrowR' size={18} cls='mr-kind-go' /></a>)}</div>;
}
const meter = r => {
  const total = stepsFor(r).length,
    done = stepsDone(r);
  return <span className={`mr-meter${CLOSED.has(r.progress.stage) ? ' is-closed' : ''}`} role="img" aria-label={txt(L(`${done} of ${total} steps done`, `${done} من ${total} خطوات منجزة`))}>{Array.from({
      length: total
    }, (_, i) => <i className={i < done ? "on" : undefined} />)}</span>;
};
const dateNote = r => {
  const p = r.progress;
  if (OWN.has(r.kind)) return r.kind === 'custom' && p.preferredDate && isActive(r) ? ` · ${L('For', 'ليوم')} ${fmtDay(p.preferredDate)}` : '';
  if (p.plannedDate && !CLOSED.has(p.stage)) return ` · ${L('Planned for', 'مقرّر في')} ${plannedText(p)}`;
  if (p.preferredDate && isActive(r)) return ` · ${L('Preferred date', 'التاريخ المفضّل')} ${fmtDay(p.preferredDate)}`;
  return '';
};
function requestCard(r) {
  const [label, tone, mark] = stageInfo(r),
    about = aboutOf(r);
  return <a className={`mr-card${CLOSED.has(r.progress.stage) ? ' is-closed' : ''}`} href={`#/myrequests/${txt(r.id)}`}><span className="mr-card-icon" aria-hidden="true"><Icon name={kindOf(r.kind).icon} size={22} /></span>{" "}<span className="mr-card-main"><span className="mr-card-title"><b>{txt(titleOf(r))}</b>{about ? <span>· {txt(about)}</span> : ''}</span>{" "}<span className="mr-card-next">{txt(nextText(r))}</span>{" "}{meter(r)}{" "}<span className="mr-card-meta"><bdi className="mono" dir="ltr">{txt(r.reference)}</bdi> · {L('Sent', 'أُرسل')}{" "}{fmtDate(r.createdAt)}{dateNote(r)}</span></span>{" "}<span className="mr-card-side"><Pill label={label} tone={tone} mark={mark} /><Icon name='chevR' size={18} cls='mr-card-go' /></span></a>;
}
const howItWorks = () => <section className="mr-how" aria-labelledby="mr-how-title"><h2 id="mr-how-title">{L('How it works', 'كيف يجري الطلب')}</h2><ol><li><b>{L('Send your request', 'أرسل طلبك')}</b><span>{L('Choose what you need. It takes about two minutes.', 'اختر ما تحتاج إليه. يستغرق ذلك دقيقتين تقريباً.')}</span></li><li><b>{L('The parish reviews it', 'تراجعه الرعية')}</b><span>{L('The parish office checks the details, and the priest gives his answer.', 'يتحقّق مكتب الرعية من التفاصيل، ويعطي الكاهن جوابه.')}</span></li><li><b>{L('Follow every step', 'تابع كل خطوة')}</b><span>{L('Dates, preparation and answers appear here, with a notification at each step.', 'تظهر المواعيد والتحضير والأجوبة هنا، مع إشعار عند كل خطوة.')}</span></li></ol></section>;
const unlinked = () => <div className="alert alert-info mr-alert"><Icon name='info' size={18} /><span><b>{L('Your account is not linked to a parishioner record yet.', 'حسابك غير مرتبط بسجل أحد المؤمنين بعد.')}</b>{L(' Ask the parish office to link it, then you can send requests here.', ' اطلب من مكتب الرعية ربطه، ثم يمكنك إرسال الطلبات من هنا.')}</span></div>;

/* What still matters now: requests on their way, and bookings confirmed for a day still to come. */
const current = r => isActive(r) || r.kind === 'booking' && r.progress.stage === 'confirmed' && r.details.date >= todayKey();
function listPage() {
  const active = M.requests.filter(current),
    earlier = M.requests.filter(r => !current(r));
  const linked = (M.requestOptions?.subjects || []).length > 0;
  const section = (id, title, body, extra = '') => <section className="mr-section" aria-labelledby={`mr-${id}`}><div className="member-section-head"><h2 id={`mr-${id}`}>{title}</h2>{extra}</div>{body}</section>;
  return <div className="member-page mr-page"><header className="member-head"><h1>{L('My requests', 'طلباتي')}</h1>{" "}<p>{L('Ask the parish for a sacrament, a certificate, a hall or anything else, then follow every step here.', 'اطلب من الرعية سرّاً أو شهادة أو قاعة أو أي أمر آخر، ثم تابع كل خطوة هنا.')}</p></header>{" "}{linked ? '' : unlinked()}{" "}{active.length ? section('active', L('Current requests', 'طلباتك الحالية'), <Paged className="mr-cards">{active.map(requestCard)}</Paged>) : ''}{" "}{section('sacraments', L('Sacraments and certificates', 'الأسرار والشهادات'), kindGrid(REQUEST_KINDS.filter(k => !k.other)))}{" "}{section('other', L('Book a place, or ask for something else', 'احجز مكاناً، أو اطلب أمراً آخر'), kindGrid(REQUEST_KINDS.filter(k => k.other), ' mr-kinds-2'))}{" "}{M.requests.length ? '' : howItWorks()}{" "}{earlier.length ? section('earlier', L('Completed and closed', 'المنجزة والمغلقة'), <Paged className="mr-cards">{earlier.map(requestCard)}</Paged>) : ''}</div>;
}

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
  booking: ['Choose the place and the time. The parish office checks that it is free, and the priest confirms your booking.', 'اختر المكان والموعد. يتحقّق مكتب الرعية من أنّه متاح، ويؤكّد الكاهن حجزك.'],
  custom: ['Tell the parish what you need, in your own words. The parish office will read it and contact you.', 'أخبر الرعية بما تحتاج إليه بكلماتك. سيقرأه مكتب الرعية ويتواصل معك.']
};
const DATE_LABEL = {
  marriage: ['Preferred wedding date', 'تاريخ الإكليل المفضّل'],
  funeral: ['Preferred date for the funeral', 'التاريخ المفضّل للجنّاز'],
  custom: ['Is it for a particular day?', 'هل هو ليوم معيّن؟']
};
const NOTE_HINT = {
  baptism: ['For example: the godparents’ names or a time that suits you', 'مثلاً: أسماء العرّابين أو وقت يناسبكم'],
  marriage: ['For example: the church you would like, or a time that suits you', 'مثلاً: الكنيسة التي تفضّلونها أو وقت يناسبكم'],
  funeral: ['For example: the family’s wishes or who the priest should call', 'مثلاً: رغبات العائلة أو من يتّصل به الكاهن'],
  certificate: ['For example: how many copies you need', 'مثلاً: عدد النسخ التي تحتاج إليها'],
  booking: ['For example: the tables and chairs you need, or who brings the food', 'مثلاً: الطاولات والكراسي التي تحتاجونها، أو من يحضر الطعام']
};
const STEP_NAMES = kind => [kind === 'booking' ? L('Place and time', 'المكان والموعد') : kind === 'custom' ? L('Your request', 'طلبك') : L('Who it is for', 'لمن الطلب'), L('Details', 'التفاصيل'), L('Review and send', 'المراجعة والإرسال')];
function draftFor(kind) {
  if (S.ui.mrDraft?.kind === kind) return S.ui.mrDraft;
  const phone = M.person?.phone && M.person.phone !== '—' ? phoneShow(M.person.phone) : '';
  const prefill = S.ui.mrPrefill?.kind === kind ? S.ui.mrPrefill : {};
  S.ui.mrPrefill = null;
  return S.ui.mrDraft = {
    kind,
    step: 1,
    subject: '',
    child: {
      lat: '',
      ar: '',
      born: '',
      father: '',
      mother: ''
    },
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
    ...prefill
  };
}
/* Who a request can be for: the member and their household, with the reason any of them is not available. */
function subjectChoices(kind) {
  return (M.requestOptions?.subjects || []).filter(s => !(kind === 'funeral' && s.self)).map(s => {
    let blocked = '';
    if (kind !== 'certificate') {
      if (ONCE.has(kind) && s.onRecord.includes(kind)) blocked = L('Already recorded in the parish register', 'مدوَّن في سجلّ الرعية');else if (s.inProgress.includes(kind)) blocked = L('Already being prepared with the parish', 'قيد التحضير مع الرعية');else if (M.requests.some(r => r.status === 'submitted' && r.kind === kind && r.subject.id === s.id)) blocked = L('You have already sent this request', 'أرسلتَ هذا الطلب مسبقاً');
    }
    return {
      ...s,
      blocked
    };
  });
}
const fieldError = id => <span className="mr-error" id={`${id}-error`} hidden />;
const labelFor = (id, label, req) => <label className="label" htmlFor={id}>{txt(label)}{req ? <span className="req" aria-hidden="true">*</span> : <span className="opt">{L('(optional)', '(اختياري)')}</span>}</label>;
const input = (id, label, value, {
  type = 'text',
  req = false,
  help = '',
  attrs = '',
  ar = false
} = {}) => <div className="formrow mr-field">{labelFor(id, label, req)}{" "}<input className="input" id={id} type={type} defaultValue={txt(value)} aria-required={req ? "true" : undefined} aria-describedby={`${help ? `${id}-help ` : ''}${id}-error`} dir={ar ? "rtl" : undefined} lang={ar ? "ar" : undefined} {...htmlAttrs(attrs)} />{" "}{help ? <span className="help" id={`${id}-help`}>{txt(help)}</span> : ''}{fieldError(id)}</div>;
const select = (id, label, value, options, {
  req = false,
  placeholder = ''
} = {}) => <div className="formrow mr-field">{labelFor(id, label, req)}{" "}<Select id={id} aria-required={req ? "true" : undefined} aria-describedby={`${id}-error`}><option value="">{txt(placeholder)}</option>{options.map(([v, text]) => <option value={txt(v)} selected={!!(v === value)}>{txt(text)}</option>)}</Select>{fieldError(id)}</div>;
const pills = (name, items, value, otherLabel) => <div className="mr-pills">{items.map(([en, ar]) => <label className="mr-pill"><input type="radio" name={name} defaultValue={txt(en)} defaultChecked={!!(value === en)} /><span>{txt(t(en, ar))}</span></label>)}{" "}{otherLabel ? <label className="mr-pill"><input type="radio" name={name} defaultValue="other" defaultChecked={!!(value === 'other')} /><span>{txt(otherLabel)}</span></label> : ''}</div>;
function stepWho(d) {
  if (d.kind === 'booking') return stepPlace(d);
  if (d.kind === 'custom') return stepAsk(d);
  const choices = subjectChoices(d.kind);
  const option = (value, title, sub, {
    disabled = false,
    checked = false
  } = {}) => <label className={`mr-choice${disabled ? ' is-disabled' : ''}`}><input type="radio" name="mr-subject" defaultValue={txt(value)} defaultChecked={!!checked} disabled={!!disabled} />{" "}<span className="mr-choice-body"><b>{txt(title)}</b>{sub ? <small>{txt(sub)}</small> : ''}</span></label>;
  const phone = M.requestOptions?.phone;
  const childFields = <div className="mr-child" id="mr-child" hidden={!(d.subject === 'child')}><p className="mr-child-intro">{L('Write the names as they should appear on the baptism certificate.', 'اكتب الاسمين كما يجب أن يظهرا في شهادة المعمودية.')}</p>{" "}<div className="formgrid">{input('mr-child-lat', L('Child’s full name in English', 'اسم الطفل الكامل بالإنكليزية'), d.child.lat, {
        req: true,
        attrs: 'autocomplete="off" maxlength="120"'
      })}{" "}{input('mr-child-ar', L('Child’s full name in Arabic', 'اسم الطفل الكامل بالعربية'), d.child.ar, {
        req: true,
        ar: true,
        attrs: 'autocomplete="off" maxlength="120"'
      })}</div>{" "}{input('mr-child-born', L('Date of birth', 'تاريخ الولادة'), d.child.born, {
      type: 'date',
      req: true,
      attrs: `max="${todayKey()}"`
    })}{" "}<div className="formgrid">{input('mr-child-father', L('Father’s full name', 'اسم الأب الكامل'), d.child.father, {
        attrs: 'maxlength="120"'
      })}{" "}{input('mr-child-mother', L('Mother’s full name', 'اسم الأم الكامل'), d.child.mother, {
        attrs: 'maxlength="120"'
      })}</div></div>;
  const people = choices.map(s => option(s.id, s.self ? L('You', 'أنت') + ' — ' + nameOf(s) : nameOf(s), s.blocked || otherName(s), {
    disabled: !!s.blocked,
    checked: d.subject === s.id && !s.blocked
  }));
  const none = !choices.length && d.kind !== 'baptism';
  return <><fieldset className="mr-fieldset" id="mr-subject-group" aria-describedby="mr-subject-help mr-subject-error"><legend className="mr-legend">{L(...LEGEND[d.kind])}</legend>{" "}<div className="mr-choices">{people}{d.kind === 'baptism' ? option('child', L('A child who is not registered in the parish yet', 'طفل غير مسجّل في الرعية بعد'), L('You will add the child’s details below', 'ستضيف تفاصيل الطفل أدناه'), {
          checked: d.subject === 'child'
        }) : ''}</div>{" "}{fieldError('mr-subject')}{" "}<p className="help" id="mr-subject-help">{none ? L('There is no one in your household to choose. Please contact the parish office directly.', 'لا أحد في عائلتك يمكن اختياره. يُرجى التواصل مع مكتب الرعية مباشرة.') : L('You and the people registered in your household are listed. If someone is missing, ask the parish office to add them.', 'تظهر أنت والأشخاص المسجّلون في عائلتك. إذا كان أحدهم غير موجود، اطلب من مكتب الرعية إضافته.')}{" "}{phone && (none || d.kind === 'funeral') ? phoneLink(phone) : ''}</p></fieldset>{d.kind === 'baptism' ? childFields : ''}</>;
}

/* A booking: which place, which day, from when until when, and what is already taken that day. */
function stepPlace(d) {
  const venues = M.requestOptions?.venues || [];
  return <><fieldset className="mr-fieldset" id="mr-venue-group" aria-describedby="mr-venue-error"><legend className="mr-legend">{L('Which place would you like?', 'أي مكان تريد؟')}</legend>{" "}<div className="mr-choices mr-choices-2">{venues.map(v => <label className="mr-choice"><input type="radio" name="mr-venue" defaultValue={txt(v.id)} defaultChecked={!!(d.venue === v.id)} />{" "}<span className="mr-choice-body"><b>{txt(t(v.name, v.ar || v.name))}</b><small>{txt(t(v.kind, v.kindAr || v.kind))} · {L(`Up to ${v.cap} people`, `حتى ${v.cap} شخصاً`)}</small></span></label>)}</div>{" "}{fieldError('mr-venue')}</fieldset>{" "}<fieldset className="mr-fieldset"><legend className="mr-legend mr-legend-sm">{L('When?', 'متى؟')}</legend>{" "}{input('mr-bdate', L('Date', 'التاريخ'), d.date, {
        type: 'date',
        req: true,
        attrs: `min="${todayKey()}" max="${yearsAhead(2)}"`
      })}{" "}<div className="formgrid">{select('mr-from', L('From', 'من'), d.from, TIMES.slice(0, -1).map(x => [x, x]), {
          req: true,
          placeholder: L('Start time', 'وقت البدء')
        })}{" "}{select('mr-to', L('Until', 'حتى'), d.to, TIMES.slice(1).map(x => [x, x]), {
          req: true,
          placeholder: L('End time', 'وقت الانتهاء')
        })}</div>{" "}<div className="mr-availability" id="mr-availability" aria-live="polite">{availability(d)}</div></fieldset></>;
}
const overlapping = d => (M.requestOptions?.busy || []).filter(b => b.venue === d.venue && b.date === d.date && d.from && d.to && minutes(b.from) < minutes(d.to) && minutes(d.from) < minutes(b.to));
function availability(d) {
  if (!d.venue || !d.date) return <p className="mr-avail mr-avail-hint"><Icon name='info' size={16} /><span>{L('Choose a place and a date to see when it is free.', 'اختر مكاناً وتاريخاً لترى متى يكون متاحاً.')}</span></p>;
  const taken = (M.requestOptions?.busy || []).filter(b => b.venue === d.venue && b.date === d.date);
  const where = `${venueName(d.venue)}, ${fmtDay(d.date)}`,
    chosen = d.from && d.to && d.from < d.to;
  const list = items => <ul>{items.map(b => <li><bdi dir="ltr">{txt(b.from)}–{txt(b.to)}</bdi> · {b.status === 'approved' ? L('confirmed', 'مؤكَّد') : L('someone else has asked for it', 'طلبه شخص آخر')}</li>)}</ul>;
  if (!taken.length) return <p className="mr-avail mr-avail-free"><Icon name='check' size={16} /><span>{L(`Free all day — ${where}.`, `متاح طوال اليوم — ${where}.`)}</span></p>;
  const overlap = chosen ? overlapping(d) : [];
  /* a confirmed booking at that time cannot be asked for; one only asked for can, and the office decides */
  if (overlap.some(b => b.status === 'approved')) return <div className="mr-avail mr-avail-clash"><Icon name='warn' size={16} /><div><b>{L('Your time overlaps a confirmed booking. Please choose another time.', 'يتعارض وقتك مع حجز مؤكَّد. يُرجى اختيار وقت آخر.')}</b>{list(taken)}</div></div>;
  if (overlap.length) return <div className="mr-avail mr-avail-busy"><Icon name='clock' size={16} /><div><b>{L('Someone else has asked for this time.', 'طلب شخص آخر هذا الوقت.')}</b>{" "}{L('You can still send your request; the parish office will decide.', 'يمكنك إرسال طلبك؛ وسيقرّر مكتب الرعية.')}{list(taken)}</div></div>;
  if (chosen) return <div className="mr-avail mr-avail-free"><Icon name='check' size={16} /><div><b>{L('Free at that time.', 'متاح في هذا الوقت.')}</b>{" "}{L('Also taken that day:', 'محجوز أيضاً في ذلك اليوم:')}{list(taken)}</div></div>;
  return <div className="mr-avail mr-avail-busy"><Icon name='clock' size={16} /><div><b>{L(`Already taken on ${fmtDay(d.date)}:`, `محجوز في ${fmtDay(d.date)}:`)}</b>{list(taken)}</div></div>;
}

/* Anything else: a few words, then the details in the parishioner's own words. */
function stepAsk(d) {
  return <><fieldset className="mr-fieldset" id="mr-topic-group"><legend className="mr-legend">{L('What would you like to ask for?', 'ماذا تودّ أن تطلب؟')}</legend>{" "}{pills('mr-topic', TOPICS, d.topic, L('Something else', 'أمر آخر'))}</fieldset>{" "}{input('mr-subject-text', L('In a few words', 'بكلمات قليلة'), d.subjectText, {
      req: true,
      attrs: 'maxlength="120" autocomplete="off"'
    })}{" "}<div className="formrow mr-field">{labelFor('mr-message', L('Tell the parish office more', 'أخبر مكتب الرعية بالمزيد'), true)}{" "}<textarea className="textarea" id="mr-message" rows="5" maxLength="1000" aria-required="true" aria-describedby="mr-message-count mr-message-error" placeholder={txt(L('For example: who it is for, where, and when suits you', 'مثلاً: لمن، وأين، ومتى يناسبك'))} defaultValue={txt(d.message)} />{" "}<span className="counter" id="mr-message-count">{d.message.length} / 1000</span>{fieldError('mr-message')}</div></>;
}
const notesField = d => <div className="formrow mr-field">{labelFor('mr-notes', L('Anything the parish office should know?', 'هل من أمر يجب أن يعرفه مكتب الرعية؟'), false)}{" "}<textarea className="textarea" id="mr-notes" rows="4" maxLength="500" placeholder={txt(t(...(NOTE_HINT[d.kind] || ['', ''])))} aria-describedby="mr-notes-count mr-notes-error" defaultValue={txt(d.notes)} />{" "}<span className="counter" id="mr-notes-count">{d.notes.length} / 500</span>{fieldError('mr-notes')}</div>;
const phoneField = d => input('mr-phone', L('Phone number', 'رقم الهاتف'), d.phone, {
  type: 'tel',
  help: L('So the parish office can call you if needed.', 'ليتمكّن مكتب الرعية من الاتصال بك عند الحاجة.'),
  attrs: 'autocomplete="tel" inputmode="tel" maxlength="40" dir="ltr"'
});
function stepDetails(d) {
  const subject = (M.requestOptions?.subjects || []).find(s => s.id === d.subject);
  if (d.kind === 'booking') {
    const v = venueOf(d.venue);
    return <><fieldset className="mr-fieldset" id="mr-occasion-group" aria-describedby="mr-occasion-error"><legend className="mr-legend">{L('What is it for?', 'لأي مناسبة؟')}</legend>{" "}{pills('mr-occasion', OCCASIONS, d.occasion, L('Something else', 'مناسبة أخرى'))}{fieldError('mr-occasion')}{" "}<div id="mr-occasion-other-wrap" hidden={!(d.occasion === 'other')}>{input('mr-occasion-other', L('Describe the occasion', 'صِف المناسبة'), d.occasionOther, {
            req: true,
            attrs: 'maxlength="120"'
          })}</div></fieldset>{" "}{input('mr-guests', L('How many people do you expect?', 'كم شخصاً تتوقّع؟'), d.guests, {
        type: 'number',
        req: true,
        help: v ? L(`${t(v.name, v.ar || v.name)} holds up to ${v.cap} people.`, `${t(v.name, v.ar || v.name)} يتّسع لـ ${v.cap} شخصاً.`) : '',
        attrs: `inputmode="numeric" min="1" ${v ? `max="${v.cap}"` : ''} step="1"`
      })}{" "}{phoneField(d)}{notesField(d)}</>;
  }
  if (d.kind === 'custom') return <><h2 className="mr-legend">{L('A few details', 'بعض التفاصيل')}</h2>{" "}{input('mr-date', L(...DATE_LABEL.custom), d.date, {
      type: 'date',
      help: L('Leave it empty if any day suits you.', 'اتركه فارغاً إذا كان أي يوم يناسبك.'),
      attrs: `min="${todayKey()}"`
    })}{" "}{phoneField(d)}</>;
  const body = [];
  if (d.kind === 'certificate') {
    body.push(<><fieldset className="mr-fieldset" id="mr-of-group" aria-describedby="mr-of-error"><legend className="mr-legend mr-legend-sm">{L('Which certificate?', 'أي شهادة؟')}</legend>{" "}<div className="mr-choices mr-choices-2">{CERTIFICATE_OF.map(([id]) => {
            const onRecord = subject?.onRecord.includes(id);
            return <label className="mr-choice"><input type="radio" name="mr-of" defaultValue={id} defaultChecked={!!(d.certificateOf === id)} />{" "}<span className="mr-choice-body"><b>{txt(certificateName(id))}</b><small>{onRecord ? L('Recorded in this parish', 'مدوَّن في هذه الرعية') : L('The parish office will check the register', 'سيتحقّق مكتب الرعية من السجل')}</small></span></label>;
          })}</div>{fieldError('mr-of')}</fieldset>{" "}<fieldset className="mr-fieldset" id="mr-purpose-group" aria-describedby="mr-purpose-error"><legend className="mr-legend mr-legend-sm">{L('What is it for?', 'لأي غرض؟')}</legend>{" "}{pills('mr-purpose', PURPOSES, d.purpose, L('Something else', 'غرض آخر'))}{" "}{fieldError('mr-purpose')}{" "}<div id="mr-purpose-other-wrap" hidden={!(d.purpose === 'other')}>{input('mr-purpose-other', L('Describe the purpose', 'صِف الغرض'), d.purposeOther, {
            req: true,
            attrs: 'maxlength="200"'
          })}</div></fieldset>{" "}<fieldset className="mr-fieldset"><legend className="mr-legend mr-legend-sm">{L('Language of the certificate', 'لغة الشهادة')}</legend>{" "}<div className="mr-pills">{LANGUAGES.map(([id]) => <label className="mr-pill"><input type="radio" name="mr-language" defaultValue={id} defaultChecked={!!(d.language === id)} /><span>{txt(languageName(id))}</span></label>)}</div></fieldset></>);
  } else {
    body.push(<h2 className="mr-legend">{L('A few details', 'بعض التفاصيل')}</h2>);
    body.push(input('mr-date', L(...(DATE_LABEL[d.kind] || ['Preferred date', 'التاريخ المفضّل'])), d.date, {
      type: 'date',
      help: L('The parish office will confirm the date with you.', 'سيؤكّد مكتب الرعية الموعد معك.'),
      attrs: `min="${todayKey()}"`
    }));
    if (d.kind === 'marriage') body.push(<div className="formgrid">{input('mr-partner', L('Future spouse’s full name', 'اسم الشريك الكامل'), d.partner, {
        req: true,
        attrs: 'maxlength="120"'
      })}{" "}{input('mr-partner-parish', L('Their parish', 'رعيّته'), d.partnerParish, {
        help: L('If they belong to another parish', 'إذا كان من رعية أخرى'),
        attrs: 'maxlength="120"'
      })}</div>);
  }
  return <>{body}{phoneField(d)}{notesField(d)}</>;
}
const occasionOf = d => d.occasion === 'other' ? d.occasionOther : occasionText(d.occasion);
function summaryRows(d) {
  const subject = (M.requestOptions?.subjects || []).find(s => s.id === d.subject);
  if (d.kind === 'booking') return [[L('Request', 'الطلب'), L('Booking', 'حجز')], [L('Place', 'المكان'), venueName(d.venue)], [L('When', 'الموعد'), `${fmtDay(d.date)} · ${d.from}–${d.to}`], [L('Occasion', 'المناسبة'), occasionOf(d)], [L('People expected', 'عدد الأشخاص'), String(d.guests)], [L('Phone', 'الهاتف'), d.phone || '—', 'ltr'], [L('Message', 'رسالة'), d.notes || '—']];
  if (d.kind === 'custom') return [[L('Request', 'الطلب'), d.subjectText], [L('Details', 'التفاصيل'), d.message], [L('Day', 'اليوم'), d.date ? fmtDay(d.date) : L('Any day', 'أي يوم')], [L('Phone', 'الهاتف'), d.phone || '—', 'ltr']];
  const rows = [[L('Request', 'الطلب'), d.kind === 'certificate' ? certificateName(d.certificateOf) : kindName(d.kind)]];
  if (d.subject === 'child') {
    rows.push([L('For', 'لـ'), [nameOf(d.child), otherName(d.child)].filter(Boolean).join(' · ')], [L('Date of birth', 'تاريخ الولادة'), fmtDay(d.child.born)]);
    if (d.child.father || d.child.mother) rows.push([L('Parents', 'الوالدان'), [d.child.father, d.child.mother].filter(Boolean).join(' · ')]);
  } else if (subject) rows.push([L('For', 'لـ'), subject.self ? `${L('You', 'أنت')} — ${nameOf(subject)}` : nameOf(subject)]);
  if (d.kind === 'certificate') rows.push([L('Purpose', 'الغرض'), d.purpose === 'other' ? d.purposeOther : purposeText(d.purpose)], [L('Language', 'اللغة'), languageName(d.language)]);else rows.push([L('Preferred date', 'التاريخ المفضّل'), d.date ? fmtDay(d.date) : L('No preference — the office will propose one', 'لا تفضيل — سيقترح المكتب موعداً')]);
  if (d.kind === 'marriage') rows.push([L('Future spouse', 'الشريك'), d.partner + (d.partnerParish ? ` · ${d.partnerParish}` : '')]);
  rows.push([L('Phone', 'الهاتف'), d.phone || '—', 'ltr'], [L('Message', 'رسالة'), d.notes || '—']);
  return rows;
}
/* Each value is isolated, so an English note or a phone number reads in its own direction inside Arabic. */
const summaryList = (rows, cls = '') => <dl className={`mr-summary${cls}`}>{rows.map(([k, v, dir]) => <><dt>{txt(k)}</dt><dd><bdi dir={dir ? dir : undefined}>{txt(v)}</bdi></dd></>)}</dl>;
function stepReview(d) {
  const [first, second] = d.kind === 'booking' ? [L('Change the place or time', 'تغيير المكان أو الموعد'), L('Change the details', 'تغيير التفاصيل')] : d.kind === 'custom' ? [L('Change your request', 'تغيير طلبك'), L('Change the details', 'تغيير التفاصيل')] : [L('Change who it is for', 'تغيير صاحب الطلب'), L('Change the details', 'تغيير التفاصيل')];
  return <><h2 className="mr-legend">{L('Check your request', 'راجع طلبك')}</h2>{" "}{summaryList(summaryRows(d))}{" "}<p className="mr-edit-links"><button type="button" className="btn btn-ghost btn-dense" data-mr-step="1"><Icon name='edit' size={15} />{first}</button>{" "}<button type="button" className="btn btn-ghost btn-dense" data-mr-step="2"><Icon name='edit' size={15} />{second}</button></p>{" "}<div className="mr-next-note"><Icon name='info' size={18} /><p>{L('When you send it, the parish office receives your request. You can follow it on this page and you will get a notification at each step.', 'عند الإرسال، يصل طلبك إلى مكتب الرعية. يمكنك متابعته من هذه الصفحة، وستصلك إشعارات عند كل خطوة.')}</p></div></>;
}
function prepareAside(kind) {
  const phone = M.requestOptions?.phone;
  const after = kind === 'booking' ? [L('The parish office checks that the place is free', 'يتحقّق مكتب الرعية من أنّ المكان متاح'), L('The priest confirms the booking', 'يؤكّد الكاهن الحجز'), L('You collect the keys from the parish office', 'تستلم المفاتيح من مكتب الرعية')] : kind === 'custom' ? [L('The parish office reads your request', 'يقرأ مكتب الرعية طلبك'), L('They accept it and contact you', 'يقبله ويتواصل معك'), L('You see here when it is done', 'ترى هنا متى أُنجز')] : [L('The parish office reviews your request', 'يراجع مكتب الرعية طلبك'), kind === 'certificate' ? L('The priest checks the register and signs', 'يتحقّق الكاهن من السجل ويوقّع') : L('The priest accepts it', 'يقبله الكاهن'), kind === 'certificate' ? L('You collect it from the parish office', 'تستلمها من مكتب الرعية') : L('You follow preparation and dates here', 'تتابع التحضير والمواعيد من هنا')];
  let first;
  if (kind === 'booking') {
    first = <section className="member-card"><h2>{L('Places you can book', 'الأماكن المتاحة للحجز')}</h2><ul className="mr-checklist">{(M.requestOptions?.venues || []).map(v => <li><Icon name='rooms' size={16} /><span>{txt(t(v.name, v.ar || v.name))}</span><small>{L(`${v.cap} people`, `${v.cap} شخصاً`)}</small></li>)}</ul>{" "}<p className="help">{L('For the church or a chapel, please call the parish office.', 'لحجز الكنيسة أو المصلّى، يُرجى الاتصال بمكتب الرعية.')}</p>{phone ? phoneLink(phone) : ''}</section>;
  } else {
    const list = (M.requestOptions?.preparation || {})[kind] || [];
    const generic = {
      communion: ['The parish will tell you about the First Communion preparation classes and the date of the celebration.', 'ستُعلمك الرعية بلقاءات التحضير للمناولة الأولى وبموعد الاحتفال.'],
      confirmation: ['The parish will tell you how to prepare and when confirmation is celebrated.', 'ستُعلمك الرعية بكيفية التحضير وبموعد الاحتفال بالميرون.'],
      funeral: ['Please also call the parish office so the priest can be reached quickly.', 'يُرجى أيضاً الاتصال بمكتب الرعية ليتمكّن الكاهن من التواصل معكم سريعاً.'],
      certificate: ['Certificates are signed by the priest. You will get a notification when yours is ready to collect.', 'يوقّع الكاهن الشهادات، وسيصلك إشعار عندما تصبح شهادتك جاهزة للاستلام.'],
      custom: ['Write in your own words, as you would say it on the phone. The parish office will call you if anything is unclear.', 'اكتب بكلماتك كما لو كنت تتكلّم على الهاتف. سيتّصل بك مكتب الرعية إذا كان أي أمر غير واضح.']
    };
    const body = list.length ? <><ul className="mr-checklist">{list.map(([en, ar, required]) => <li><Icon name='doc' size={16} /><span>{txt(t(en, ar))}</span><small>{required ? L('Required', 'مطلوب') : L('Optional', 'اختياري')}</small></li>)}</ul>{" "}<p className="help">{L('Bring these to the parish office. They are not needed to send the request.', 'أحضرها إلى مكتب الرعية. لا حاجة إليها لإرسال الطلب.')}</p></> : <p className="mr-aside-text">{txt(t(...(generic[kind] || ['The parish office will tell you what is needed.', 'سيُعلمك مكتب الرعية بما يلزم.'])))}</p>;
    first = <section className="member-card"><h2>{list.length ? L('What to prepare', 'ما يجب تحضيره') : L('Good to know', 'معلومات مفيدة')}</h2>{body}{phone ? phoneLink(phone) : ''}</section>;
  }
  return <aside className="mr-aside">{first}{" "}<section className="member-card"><h2>{L('After you send it', 'بعد الإرسال')}</h2><ol className="mr-mini-steps">{after.map(x => <li>{x}</li>)}</ol></section></aside>;
}
function newPage(kind) {
  if (!REQUEST_KINDS.some(k => k.id === kind)) return <div className="member-page mr-page">{back()}{" "}<header className="member-head"><h1>{L('What would you like to ask for?', 'ماذا تودّ أن تطلب؟')}</h1></header>{kindGrid(REQUEST_KINDS)}</div>;
  if (!(M.requestOptions?.subjects || []).length) return <div className="member-page mr-page">{back()}<header className="member-head"><h1>{L(...HEADING[kind])}</h1></header>{unlinked()}</div>;
  const d = draftFor(kind),
    steps = STEP_NAMES(kind);
  return <div className="member-page mr-page">{back()}{" "}<header className="member-head mr-form-head"><span className="mr-head-icon" aria-hidden="true"><Icon name={kindOf(kind).icon} size={26} /></span>{" "}<div><h1>{L(...HEADING[kind])}</h1><p>{INTRO[kind] ? L(...INTRO[kind]) : L('Tell the parish office who it is for. They will review your request and guide you through every step.', 'أخبر مكتب الرعية لمن الطلب. سيراجع طلبك ويرافقك في كل خطوة.')}</p></div></header>{" "}<div className="mr-layout"><form className="member-card mr-form" id="mr-form" noValidate><ol className="mr-progress" aria-label={L('Steps', 'الخطوات')}>{steps.map((label, i) => <li data-step-mark={i + 1} aria-current={d.step === i + 1 ? "step" : undefined} className={d.step > i + 1 ? 'done' : ''}><span className="n" aria-hidden="true">{d.step > i + 1 ? <Icon name='check' size={13} /> : i + 1}</span><span>{txt(label)}</span></li>)}</ol>{" "}<div className="alert alert-warning mr-error-summary" id="mr-errors" role="alert" tabIndex="-1" hidden />{" "}<div className="mr-step" data-step="1" hidden={!(d.step === 1)}>{stepWho(d)}</div>{" "}<div className="mr-step" data-step="2" hidden={!(d.step === 2)}>{stepDetails(d)}</div>{" "}<div className="mr-step" data-step="3" hidden={!(d.step === 3)} id="mr-review">{d.step === 3 ? stepReview(d) : ''}</div>{" "}<div className="mr-actions"><button type="button" className="btn btn-secondary" id="mr-back" hidden={!!(d.step === 1)}>{L('Back', 'رجوع')}</button>{" "}<button type="button" className="btn btn-primary" id="mr-continue" hidden={!!(d.step === 3)}>{L('Continue', 'متابعة')}<Icon name='arrowR' size={16} /></button>{" "}<button type="submit" className="btn btn-primary" id="mr-send" hidden={!(d.step === 3)}><Icon name='check' size={16} />{L('Send request', 'إرسال الطلب')}</button></div></form>{" "}{prepareAside(kind)}</div></div>;
}

/* ---- one request --------------------------------------------------------------- */
/* The request as the member wrote it, in the same shape as a draft, for the summary. */
const asDraft = r => r.kind === 'booking' ? {
  kind: 'booking',
  venue: r.details.venue,
  date: r.details.date,
  from: r.details.from,
  to: r.details.to,
  occasion: r.details.occasion,
  occasionOther: '',
  guests: r.details.guests,
  phone: r.details.phone || '',
  notes: r.details.notes || ''
} : r.kind === 'custom' ? {
  kind: 'custom',
  subjectText: topicText(r.details.subject),
  message: r.details.message,
  date: r.details.date || '',
  phone: r.details.phone || ''
} : {
  ...r.details,
  kind: r.kind,
  subject: r.subject.new ? 'child' : r.subject.id,
  child: r.details.child || {},
  purpose: PURPOSES.some(x => x[0] === r.details.purpose) ? r.details.purpose : r.details.purpose ? 'other' : '',
  purposeOther: r.details.purpose,
  date: r.details.date || '',
  phone: r.details.phone || '',
  notes: r.details.notes || '',
  partner: r.details.partner || '',
  partnerParish: r.details.partnerParish || ''
};
function detailPage(id) {
  const r = M.requests.find(x => x.id === id);
  if (!r) return <div className="member-page mr-page">{back()}<div className="member-empty"><p>{L('This request could not be found.', 'تعذّر العثور على هذا الطلب.')}</p>{" "}<a className="btn btn-secondary btn-dense" href="#/myrequests">{L('See all your requests', 'عرض كل طلباتك')}</a></div></div>;
  const p = r.progress,
    closed = CLOSED.has(p.stage),
    [label, tone, mark] = stageInfo(r);
  const steps = stepsFor(r),
    done = stepsDone(r),
    phone = M.requestOptions?.phone,
    times = stepTimes(r);
  /* under each step: when it happened, since when the current one has waited, or when the celebration is planned */
  const celebration = !['certificate', 'booking', 'custom'].includes(r.kind) && p.plannedDate ? 4 : -1;
  const stepNote = i => {
    if (i === celebration && !closed) return i < done ? plannedText(p) : `${L('Planned for', 'مقرّر في')} ${plannedText(p)}`;
    if (i < done) return times[i] ? fmtStamp(times[i]) : '';
    if (closed) return '';
    const since = i === done ? times.slice(0, i).reverse().find(Boolean) : '';
    return since ? `${L('Waiting since', 'بانتظار منذ')} ${fmtStamp(since)}` : '';
  };
  const quote = (title, text) => text ? <blockquote className="mr-quote"><span className="lbl">{title}</span><p>{txt(text)}</p></blockquote> : '';
  const dates = r.kind === 'booking' ? [[L('Date', 'التاريخ'), fmtDay(r.details.date)], [L('Time', 'الوقت'), <bdi dir="ltr">{txt(r.details.from)}–{txt(r.details.to)}</bdi>], [L('Place', 'المكان'), venueName(r.details.venue)]] : [p.preferredDate && [r.kind === 'custom' ? L('Day', 'اليوم') : L('Preferred date', 'التاريخ المفضّل'), fmtDay(p.preferredDate)], p.plannedDate && [L('Planned for', 'الموعد المقرّر'), plannedText(p)], p.register && [L('Register entry', 'رقم القيد'), <bdi className="mono" dir="ltr">{txt(p.register)}</bdi>]].filter(Boolean);
  const required = p.preparation.filter(x => x.required);
  const certificateFor = p.stage === 'completed' && ['baptism', 'communion', 'confirmation', 'marriage'].includes(r.kind);
  const details = summaryRows(asDraft(r)).filter(([k]) => k !== L('Request', 'الطلب') || r.kind === 'custom');
  if (!OWN.has(r.kind) && !r.subject.new && !(M.requestOptions?.subjects || []).some(s => s.id === r.subject.id)) details.unshift([L('For', 'لـ'), nameOf(r.subject)]);
  const about = OWN.has(r.kind) ? aboutOf(r) : nameOf(r.subject),
    aboutOther = OWN.has(r.kind) ? '' : otherName(r.subject);
  return <div className="member-page mr-page">{back()}{" "}{S.ui.mrJustSent === r.id ? <div className="mr-sent" role="status"><Icon name='check' size={20} /><div><b>{L('Your request was sent', 'أُرسل طلبك')}</b>{" "}<p>{L(`The parish office has received it as ${r.reference}. You will see each update here and in your notifications.`, `استلمه مكتب الرعية برقم ${r.reference}. ستظهر كل التحديثات هنا وفي إشعاراتك.`)}</p></div></div> : ''}{" "}<header className="mr-detail-head"><span className="mr-head-icon" aria-hidden="true"><Icon name={kindOf(r.kind).icon} size={26} /></span>{" "}<div className="mr-detail-title"><h1>{txt(titleOf(r))}</h1>{" "}{about ? <p><span>{txt(about)}</span>{aboutOther ? <span className="dim">· {txt(aboutOther)}</span> : ''}</p> : ''}{" "}<p className="mr-detail-meta"><bdi className="mono" dir="ltr">{txt(r.reference)}</bdi> · {L('Sent', 'أُرسل')}{" "}{fmtStamp(r.createdAt)}</p></div>{" "}<Pill label={label} tone={tone} mark={mark} /></header>{" "}<div className="mr-layout"><div className="mr-main"><section className="member-card mr-status" aria-labelledby="mr-status-title"><h2 id="mr-status-title">{L('Where your request stands', 'أين أصبح طلبك')}</h2>{" "}<ol className={`steps${closed ? ' closed' : ''}`}>{steps.map((s, i) => <li className={i < done ? 'done' : i === done && !closed ? 'now' : ''}><span className="dot" aria-hidden="true">{i < done ? <Icon name='check' size={13} /> : i + 1}</span><span className="step-text"><span className="lbl">{txt(s)}</span>{stepNote(i) ? <span className="when">{txt(stepNote(i))}</span> : ''}</span>{" "}<span className="sr-only">{i < done ? L('done', 'منجز') : i === done && !closed ? L('current step', 'الخطوة الحالية') : L('not yet', 'لم يحن بعد')}</span></li>)}</ol>{" "}<div className={`mr-next${closed ? ' is-closed' : ''}`}><span className="lbl">{closed ? L('Status', 'الحالة') : p.stage === 'completed' || p.stage === 'confirmed' || p.stage === 'ready' ? L('Done', 'تمّ') : L('What happens next', 'ما الخطوة التالية')}</span><p>{txt(nextText(r))}</p></div>{" "}{closed ? quote(L('Message from the parish office', 'رسالة من مكتب الرعية'), p.reason) : quote(L('Message from the parish office', 'رسالة من مكتب الرعية'), r.response)}{" "}{dates.length ? <dl className="mr-dates">{dates.map(([k, v]) => <div><dt>{txt(k)}</dt><dd>{v.startsWith('<bdi') ? v : txt(v)}</dd></div>)}</dl> : ''}{" "}{certificateFor ? <button type="button" className="btn btn-primary" data-mr-certificate={txt(r.kind)}><Icon name='cert' size={16} />{L('Request a certificate', 'طلب شهادة')}</button> : ''}</section>{" "}{p.preparation.length ? <section className="member-card mr-prep" aria-labelledby="mr-prep-title"><div className="mr-card-head"><h2 id="mr-prep-title">{L('Preparation', 'التحضير')}</h2>{" "}<span className="dim">{L(`${required.filter(x => x.done).length} of ${required.length} required done`, `${required.filter(x => x.done).length} من ${required.length} من المطلوب منجز`)}</span></div>{" "}<ul className="mr-checklist">{p.preparation.map(x => <li className={x.done ? 'done' : ''}><Icon name={x.done ? 'check' : 'doc'} size={16} /><span>{txt(t(x.en, x.ar))}</span>{" "}<small>{x.done ? L('Done', 'منجز') : x.required ? L('Required', 'مطلوب') : L('Optional', 'اختياري')}</small></li>)}</ul>{" "}<p className="help">{L('The parish office ticks each item once it has what it needs. Bring documents to the office.', 'يؤشّر مكتب الرعية على كل بند عند استلام ما يلزم. أحضر المستندات إلى المكتب.')}</p></section> : ''}{" "}<section className="member-card mr-history" aria-labelledby="mr-history-title"><h2 id="mr-history-title">{L('History', 'السجلّ')}</h2>{" "}<ol className="mr-timeline">{p.events.slice().reverse().map(e => <li><span className="mr-timeline-dot" aria-hidden="true" /><span className="mr-timeline-what">{txt(eventLabel(e.key))}</span><time dateTime={txt(e.at)}>{fmtStamp(e.at)}</time></li>)}</ol></section></div>{" "}<aside className="mr-aside"><section className="member-card"><h2>{L('Your request', 'طلبك')}</h2>{summaryList(details, ' mr-summary-compact')}</section>{" "}<section className="member-card"><h2>{L('Questions?', 'أسئلة؟')}</h2><p className="mr-aside-text">{L(`Quote ${r.reference} when you contact the parish office.`, `اذكر الرقم ${r.reference} عند تواصلك مع مكتب الرعية.`)}</p>{phone ? phoneLink(phone) : ''}{" "}{r.canWithdraw ? <div className="mr-withdraw"><p className="help">{L('You can withdraw this request until the parish office reviews it.', 'يمكنك سحب هذا الطلب ما دام مكتب الرعية لم يراجعه بعد.')}</p>{" "}<button type="button" className="btn btn-secondary btn-dense" data-mr-withdraw={txt(r.id)}>{L('Withdraw request', 'سحب الطلب')}</button></div> : ''}</section></aside></div></div>;
}

/* ---- the route ---------------------------------------------------------------- */
export function requestsPage(first = '', second = '') {
  if (first === 'new') return newPage(second);
  if (first) return detailPage(first);
  return listPage();
}
const read = (el, id) => el.querySelector('#' + id)?.value.trim() ?? '';
const topicLabel = value => {
  const o = TOPICS.find(x => x[0] === value);
  return o ? t(o[0], o[1]) : '';
};
function collect(host, d) {
  const radio = name => host.querySelector(`input[name="${name}"]:checked`)?.value || '';
  if (host.querySelector('[data-step="1"]:not([hidden])')) {
    if (d.kind === 'booking') {
      d.venue = radio('mr-venue');
      d.date = read(host, 'mr-bdate');
      d.from = read(host, 'mr-from');
      d.to = read(host, 'mr-to');
    } else if (d.kind === 'custom') {
      d.topic = radio('mr-topic');
      d.subjectText = read(host, 'mr-subject-text');
      d.message = host.querySelector('#mr-message')?.value.trim() ?? d.message;
    } else {
      d.subject = radio('mr-subject') || d.subject;
      if (d.kind === 'baptism') d.child = {
        lat: read(host, 'mr-child-lat'),
        ar: read(host, 'mr-child-ar'),
        born: read(host, 'mr-child-born'),
        father: read(host, 'mr-child-father'),
        mother: read(host, 'mr-child-mother')
      };
    }
  }
  if (host.querySelector('[data-step="2"]:not([hidden])')) {
    if (d.kind === 'certificate') {
      d.certificateOf = radio('mr-of');
      d.purpose = radio('mr-purpose');
      d.purposeOther = read(host, 'mr-purpose-other');
      d.language = radio('mr-language') || 'bilingual';
    } else if (d.kind === 'booking') {
      d.occasion = radio('mr-occasion');
      d.occasionOther = read(host, 'mr-occasion-other');
      d.guests = read(host, 'mr-guests');
    } else {
      d.date = read(host, 'mr-date');
      if (d.kind === 'marriage') {
        d.partner = read(host, 'mr-partner');
        d.partnerParish = read(host, 'mr-partner-parish');
      }
    }
    d.phone = read(host, 'mr-phone');
    if (d.kind !== 'custom') d.notes = host.querySelector('#mr-notes')?.value.trim() ?? d.notes;
  }
}
function problems(d, step) {
  const out = [];
  if (step === 1 && d.kind === 'booking') {
    if (!d.venue) out.push(['mr-venue', L('Choose the place you would like to book.', 'اختر المكان الذي تريد حجزه.')]);
    if (!d.date) out.push(['mr-bdate', L('Choose the date.', 'اختر التاريخ.')]);else if (d.date < todayKey() || d.date > yearsAhead(2)) out.push(['mr-bdate', L('Choose a date from today onwards.', 'اختر تاريخاً ابتداءً من اليوم.')]);
    if (!d.from) out.push(['mr-from', L('Choose when it starts.', 'اختر وقت البدء.')]);
    if (!d.to) out.push(['mr-to', L('Choose when it ends.', 'اختر وقت الانتهاء.')]);else if (d.from && d.to <= d.from) out.push(['mr-to', L('The end time must be after the start time.', 'يجب أن يكون وقت الانتهاء بعد وقت البدء.')]);else if (overlapping(d).some(b => b.status === 'approved')) out.push(['mr-from', L('This place is already booked at that time. Choose another time or place.', 'هذا المكان محجوز في ذلك الوقت. اختر وقتاً أو مكاناً آخر.')]);
  } else if (step === 1 && d.kind === 'custom') {
    if (d.subjectText.length < 2) out.push(['mr-subject-text', L('Say in a few words what you are asking for.', 'قل بكلمات قليلة ما الذي تطلبه.')]);
    if (d.message.length < 2) out.push(['mr-message', L('Tell the parish office a little more about your request.', 'أخبر مكتب الرعية بالمزيد عن طلبك.')]);
  } else if (step === 1) {
    if (!d.subject) out.push(['mr-subject', L('Choose who the request is for.', 'اختر لمن الطلب.')]);
    if (d.subject === 'child') {
      if (!d.child.lat) out.push(['mr-child-lat', L('Enter the child’s full name in English.', 'أدخل اسم الطفل الكامل بالإنكليزية.')]);
      if (!d.child.ar) out.push(['mr-child-ar', L('Enter the child’s full name in Arabic.', 'أدخل اسم الطفل الكامل بالعربية.')]);
      if (!d.child.born) out.push(['mr-child-born', L('Enter the child’s date of birth.', 'أدخل تاريخ ولادة الطفل.')]);else if (d.child.born > todayKey()) out.push(['mr-child-born', L('The date of birth cannot be in the future.', 'لا يمكن أن يكون تاريخ الولادة في المستقبل.')]);
    }
  }
  if (step === 2) {
    if (d.kind === 'certificate') {
      if (!d.certificateOf) out.push(['mr-of', L('Choose which certificate you need.', 'اختر الشهادة التي تحتاج إليها.')]);
      if (!d.purpose) out.push(['mr-purpose', L('Choose what the certificate is for.', 'اختر غرض الشهادة.')]);else if (d.purpose === 'other' && !d.purposeOther) out.push(['mr-purpose-other', L('Describe what the certificate is for.', 'صِف غرض الشهادة.')]);
    } else if (d.kind === 'booking') {
      const cap = venueOf(d.venue)?.cap || 0,
        guests = Number(d.guests);
      if (!d.occasion) out.push(['mr-occasion', L('Choose what the booking is for.', 'اختر المناسبة.')]);else if (d.occasion === 'other' && d.occasionOther.length < 2) out.push(['mr-occasion-other', L('Describe the occasion.', 'صِف المناسبة.')]);
      if (!d.guests || !Number.isInteger(guests) || guests < 1) out.push(['mr-guests', L('Enter how many people you expect.', 'أدخل عدد الأشخاص المتوقَّع.')]);else if (cap && guests > cap) out.push(['mr-guests', L(`This place holds up to ${cap} people.`, `هذا المكان يتّسع لـ ${cap} شخصاً كحدّ أقصى.`)]);
    } else {
      if (d.date && d.date < todayKey()) out.push(['mr-date', L('Choose a date from today onwards.', 'اختر تاريخاً ابتداءً من اليوم.')]);
      if (d.kind === 'marriage' && !d.partner) out.push(['mr-partner', L('Enter the full name of your future spouse.', 'أدخل اسم الشريك الكامل.')]);
    }
    if (d.notes.length > 500) out.push(['mr-notes', L('Keep your message within 500 characters.', 'اجعل رسالتك ضمن ٥٠٠ حرف.')]);
  }
  return out;
}
/* The control a message belongs to: on a computer a list is drawn as a button beside the hidden select. */
const fieldOf = (host, id) => host.querySelector(`#${id}-dd`) || host.querySelector('#' + id) || host.querySelector(`#${id}-group`);
function showProblems(host, list) {
  host.querySelectorAll('.mr-error').forEach(e => {
    e.hidden = true;
    e.textContent = '';
  });
  host.querySelectorAll('[aria-invalid="true"]').forEach(e => e.removeAttribute('aria-invalid'));
  const summary = host.querySelector('#mr-errors');
  if (!list.length) {
    summary.hidden = true;
    paint(summary, null);
    return true;
  }
  for (const [id, message] of list) {
    const error = host.querySelector(`#${id}-error`);
    if (error) {
      paint(error, <><Icon name='warn' size={14} /><span>{txt(message)}</span></>);
      error.hidden = false;
    }
    fieldOf(host, id)?.setAttribute('aria-invalid', 'true');
  }
  paint(summary, <><Icon name='warn' size={18} /><span><b>{L('Please check the following:', 'يُرجى التحقّق مما يلي:')}</b><ul>{list.map(([id, message]) => <li><a href={`#${id}`} data-focus={id}>{txt(message)}</a></li>)}</ul></span></>);
  summary.hidden = false;
  summary.querySelectorAll('[data-focus]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.dataset.focus,
      target = host.querySelector(`#${id}-group input:not([disabled])`) || fieldOf(host, id);
    target?.focus();
  }));
  summary.focus();
  return false;
}
/* As the parishioner corrects a field, its message goes; nothing new is flagged until they continue. */
function clearFixed(host, d) {
  const summary = host.querySelector('#mr-errors');
  if (summary.hidden) return;
  const still = new Map(problems(d, d.step));
  host.querySelectorAll('.mr-error:not([hidden])').forEach(error => {
    const id = error.id.replace(/-error$/, ''),
      message = still.get(id),
      link = summary.querySelector(`[data-focus="${id}"]`);
    if (message) {
      if (link && link.textContent !== message) {
        link.textContent = message;
        error.querySelector('span').textContent = message;
      }
      return;
    }
    error.hidden = true;
    error.textContent = '';
    fieldOf(host, id)?.removeAttribute('aria-invalid');
    link?.closest('li')?.remove();
  });
  if (!summary.querySelector('li')) {
    summary.hidden = true;
    paint(summary, null);
  }
}
function showStep(host, d, step) {
  d.step = step;
  host.querySelectorAll('.mr-step').forEach(s => {
    s.hidden = Number(s.dataset.step) !== step;
  });
  if (step === 3) paint(host.querySelector('#mr-review'), stepReview(d));
  if (step === 2 && d.kind === 'booking') {
    // the capacity under the number of people follows the chosen place
    const v = venueOf(d.venue),
      guests = host.querySelector('#mr-guests'),
      help = host.querySelector('#mr-guests-help');
    if (v && guests) guests.max = v.cap;
    if (v && help) help.textContent = L(`${t(v.name, v.ar || v.name)} holds up to ${v.cap} people.`, `${t(v.name, v.ar || v.name)} يتّسع لـ ${v.cap} شخصاً.`);
  }
  host.querySelectorAll('[data-step-mark]').forEach(li => {
    const n = Number(li.dataset.stepMark);
    li.classList.toggle('done', n < step);
    n === step ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current');
    paint(li.querySelector('.n'), n < step ? <Icon name='check' size={13} /> : String(n));
  });
  host.querySelector('#mr-back').hidden = step === 1;
  host.querySelector('#mr-continue').hidden = step === 3;
  host.querySelector('#mr-send').hidden = step !== 3;
  showProblems(host, []);
  wireReview(host, d);
  host.querySelector('#mr-form').scrollIntoView({
    block: 'start',
    behavior: 'smooth'
  });
  const heading = host.querySelector(`.mr-step[data-step="${step}"] .mr-legend`);
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({
      preventScroll: true
    });
  }
}
function wireReview(host, d) {
  host.querySelectorAll('[data-mr-step]').forEach(b => b.addEventListener('click', () => showStep(host, d, Number(b.dataset.mrStep))));
}
function payload(d) {
  if (d.kind === 'booking') return {
    kind: 'booking',
    venue: d.venue,
    date: d.date,
    from: d.from,
    to: d.to,
    occasion: d.occasion === 'other' ? d.occasionOther : d.occasion,
    guests: Number(d.guests),
    notes: d.notes,
    phone: d.phone
  };
  if (d.kind === 'custom') return {
    kind: 'custom',
    subject: d.topic && d.topic !== 'other' && d.subjectText === topicLabel(d.topic) ? d.topic : d.subjectText,
    message: d.message,
    date: d.date,
    phone: d.phone,
    notes: ''
  };
  return {
    kind: d.kind,
    notes: d.notes,
    phone: d.phone,
    ...(d.subject === 'child' ? {
      child: d.child
    } : {
      personId: d.subject
    }),
    ...(d.kind === 'certificate' ? {
      certificateOf: d.certificateOf,
      purpose: d.purpose === 'other' ? d.purposeOther : d.purpose,
      language: d.language
    } : {
      date: d.date,
      ...(d.kind === 'marriage' ? {
        partner: d.partner,
        partnerParish: d.partnerParish
      } : {})
    })
  };
}
function mountForm(host) {
  const form = host.querySelector('#mr-form');
  if (!form) return;
  const d = S.ui.mrDraft;
  const toggleChild = () => {
    const child = host.querySelector('#mr-child');
    if (child) child.hidden = host.querySelector('input[name="mr-subject"]:checked')?.value !== 'child';
  };
  host.querySelectorAll('input[name="mr-subject"]').forEach(r => r.addEventListener('change', () => {
    toggleChild();
    collect(host, d);
  }));
  for (const [name, wrapId, inputId] of [['mr-purpose', 'mr-purpose-other-wrap', 'mr-purpose-other'], ['mr-occasion', 'mr-occasion-other-wrap', 'mr-occasion-other']]) {
    host.querySelectorAll(`input[name="${name}"]`).forEach(r => r.addEventListener('change', () => {
      host.querySelector('#' + wrapId).hidden = r.value !== 'other';
      if (r.value === 'other') host.querySelector('#' + inputId).focus();
    }));
  }
  /* A topic fills "in a few words", unless the member has written something of their own. */
  host.querySelectorAll('input[name="mr-topic"]').forEach(r => r.addEventListener('change', () => {
    const field = host.querySelector('#mr-subject-text');
    const previous = topicLabel(d.topic);
    if (!field.value.trim() || field.value.trim() === previous) field.value = r.value === 'other' ? '' : topicLabel(r.value);
    if (r.value === 'other') field.focus();
  }));
  for (const [id, max] of [['mr-notes', 500], ['mr-message', 1000]]) {
    const area = host.querySelector('#' + id),
      count = host.querySelector(`#${id}-count`);
    area?.addEventListener('input', () => {
      count.textContent = `${area.value.length} / ${max}`;
    });
  }
  const availability_ = host.querySelector('#mr-availability');
  form.addEventListener('input', () => {
    collect(host, d);
    clearFixed(host, d);
  });
  form.addEventListener('change', () => {
    collect(host, d);
    clearFixed(host, d);
    if (availability_) paint(availability_, availability(d));
  });
  host.querySelector('#mr-continue').addEventListener('click', () => {
    collect(host, d);
    if (showProblems(host, problems(d, d.step))) showStep(host, d, d.step + 1);
  });
  host.querySelector('#mr-back').addEventListener('click', () => {
    collect(host, d);
    showStep(host, d, d.step - 1);
  });
  wireReview(host, d);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (d.step !== 3) {
      host.querySelector('#mr-continue').click();
      return;
    }
    const send = host.querySelector('#mr-send');
    send.disabled = true;
    send.setAttribute('aria-busy', 'true');
    try {
      const result = await memberAction('sacramentRequest', payload(d));
      S.ui.mrDraft = null;
      S.ui.mrJustSent = result.id;
      await reload();
      go('myrequests/' + result.id);
    } catch (error) {
      send.disabled = false;
      send.removeAttribute('aria-busy');
      showProblems(host, [['mr-send', error.message]]);
      toast(L('Your request was not sent', 'لم يُرسل طلبك'), error.message, 'danger');
    }
  });
}
requestsPage.mount = host => {
  mountForm(host);
  host.querySelectorAll('[data-mr-withdraw]').forEach(b => b.addEventListener('click', () => {
    const r = M.requests.find(x => x.id === b.dataset.mrWithdraw);
    if (!r) return;
    const about = aboutOf(r);
    openModal({
      title: L('Withdraw this request?', 'سحب هذا الطلب؟'),
      body: <><div className="mr-withdraw-what"><span className="mr-card-icon" aria-hidden="true"><Icon name={kindOf(r.kind).icon} size={20} /></span><div><b>{txt(titleOf(r))}</b>{" "}<span>{about ? `${txt(about)} · ` : ''}<bdi className="mono" dir="ltr">{txt(r.reference)}</bdi></span></div></div>{" "}<p className="mr-withdraw-note">{L('The parish office will no longer see it as waiting. You can send a new request at any time.', 'لن يظهر لمكتب الرعية كطلب منتظر بعد الآن. يمكنك إرسال طلب جديد في أي وقت.')}</p></>,
      foot: <><button className="btn btn-secondary" data-close="">{L('Keep the request', 'إبقاء الطلب')}</button><button className="btn btn-danger" id="mr-withdraw-yes">{L('Withdraw request', 'سحب الطلب')}</button></>,
      onMount(el) {
        const yes = el.querySelector('#mr-withdraw-yes');
        yes.addEventListener('click', async () => {
          yes.disabled = true;
          yes.setAttribute('aria-busy', 'true');
          try {
            await memberAction('requestWithdraw', {
              id: r.id
            });
            await reload();
            closeOverlays();
            redraw();
            toast(L('Request withdrawn', 'سُحب الطلب'), '', 'success');
          } catch (error) {
            yes.disabled = false;
            yes.removeAttribute('aria-busy');
            toast(L('Could not withdraw the request', 'تعذّر سحب الطلب'), error.message, 'danger');
          }
        });
      }
    });
  }));
  host.querySelectorAll('[data-mr-certificate]').forEach(b => b.addEventListener('click', () => {
    const r = M.requests.find(x => location.hash.endsWith(x.id));
    S.ui.mrDraft = null;
    S.ui.mrPrefill = {
      kind: 'certificate',
      certificateOf: b.dataset.mrCertificate,
      subject: r && !r.subject.new ? r.subject.id : ''
    };
    go('myrequests/new/certificate');
  }));
  if (S.ui.mrJustSent && location.hash.endsWith(S.ui.mrJustSent)) setTimeout(() => {
    S.ui.mrJustSent = null;
  }, 0);
};

/* The home page's view of requests: what is moving, or how to start. */
export function homeCard() {
  const active = M.requests.filter(current);
  if (active.length) return <section className="member-card mr-home"><div className="mr-card-head"><h2>{L('My requests', 'طلباتي')}</h2>{" "}<a className="btn btn-ghost btn-dense" href="#/myrequests">{L('View all', 'عرض الكل')}</a></div>{" "}<Paged className="mr-cards">{active.slice(0, 2).map(requestCard)}</Paged></section>;
  return <section className="member-card mr-home mr-home-cta"><div className="mr-home-icons" aria-hidden="true">{['water', 'rings', 'rooms'].map(i => <span><Icon name={i} size={20} /></span>)}</div>{" "}<div><h2>{L('Planning a baptism or a wedding, or need a certificate or the parish hall?', 'تخطّط لمعمودية أو إكليل، أو تحتاج إلى شهادة أو إلى قاعة الرعية؟')}</h2>{" "}<p>{L('Ask your parish online and follow every step here.', 'اطلب من رعيتك عبر الإنترنت وتابع كل خطوة من هنا.')}</p></div>{" "}<a className="btn btn-primary" href="#/myrequests">{L('Start a request', 'ابدأ طلباً')}</a></section>;
}