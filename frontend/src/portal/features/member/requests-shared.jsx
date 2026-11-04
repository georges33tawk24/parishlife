/* What the member request pages share: titles, people, dates, times and the summary of a request. */
import { Fragment } from 'react';
import { paint } from '../../ui/html.js';
import { t, isAr } from '../../../lib/i18n.js';
import { M, loadMember } from '../../model/member-data.js';
import { session } from '../../model/api.js';
import { hydrate } from '../../model/persist.js';
import { Icon } from '../../ui/ui.jsx';
import {
  kindName,
  certificateName,
  purposeText,
  languageName,
  occasionText,
  topicText,
  fmtDay,
  todayKey
} from '../../model/sacrament-requests.js';

const L = (en, ar) => t(en, ar);

export const txt = value => String(value ?? '');

export const nameOf = x => (isAr() ? x.ar || x.lat : x.lat || x.ar) || '';

export const otherName = x => {
  const other = isAr() ? x.lat : x.ar;
  return other && other !== nameOf(x) ? other : '';
};

export const OWN = new Set(['booking', 'custom']); // asked by the member for themselves

export const venueOf = id => (M.requestOptions?.venues || []).find(v => v.id === id);

export const venueName = id => {
  const v = venueOf(id);
  return v ? t(v.name, v.ar || v.name) : String(id || '');
};

export const titleOf = r =>
  r.kind === 'certificate'
    ? certificateName(r.details.certificateOf)
    : r.kind === 'booking'
      ? `${L('Booking', 'حجز')} · ${venueName(r.details.venue)}`
      : r.kind === 'custom'
        ? topicText(r.details.subject)
        : kindName(r.kind);

/* The second half of a title: who it is for, or when a booking is */
export const aboutOf = r =>
  r.kind === 'booking'
    ? `${fmtDay(r.details.date)}, ${r.details.from}–${r.details.to}`
    : r.kind === 'custom'
      ? ''
      : nameOf(r.subject);

export const phoneLink = phone =>
  phone ? (
    <a className="mr-phone" href={`tel:${txt(String(phone).replace(/[^\d+]/g, ''))}`}>
      <Icon name="phone" size={16} />
      <bdi dir="ltr">{txt(phone)}</bdi>
    </a>
  ) : (
    ''
  );

export const back = () => (
  <a className="mr-back" href="#/myrequests">
    <Icon name="chevL" size={16} />
    {L('My requests', 'طلباتي')}
  </a>
);

export async function reload() {
  if (session.user?.role === 'member') await hydrate();
  else await loadMember();
}

export const yearsAhead = n => `${Number(todayKey().slice(0, 4)) + n}-12-31`;

const minutes = clock => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/* ---- the list -------------------------------------------------------------- */
export function kindGrid(kinds, cls = '') {
  return (
    <div className={`mr-kinds${cls}`}>
      {kinds.map((k, i) => (
        <a key={i} className="mr-kind" href={`#/myrequests/new/${k.id}`}>
          <span className="mr-kind-icon" aria-hidden="true">
            <Icon name={k.icon} size={22} />
          </span>{' '}
          <span className="mr-kind-text">
            <b>{txt(t(k.en, k.ar))}</b>
            <small>{txt(t(k.descEn, k.descAr))}</small>
          </span>{' '}
          <Icon name="arrowR" size={18} cls="mr-kind-go" />
        </a>
      ))}
    </div>
  );
}

export const unlinked = () => (
  <div className="alert alert-info mr-alert">
    <Icon name="info" size={18} />
    <span>
      <b>{L('Your account is not linked to a parishioner record yet.', 'حسابك غير مرتبط بسجل أحد المؤمنين بعد.')}</b>
      {L(
        ' Ask the parish office to link it, then you can send requests here.',
        ' اطلب من مكتب الرعية ربطه، ثم يمكنك إرسال الطلبات من هنا.'
      )}
    </span>
  </div>
);

export const overlapping = d =>
  (M.requestOptions?.busy || []).filter(
    b =>
      b.venue === d.venue &&
      b.date === d.date &&
      d.from &&
      d.to &&
      minutes(b.from) < minutes(d.to) &&
      minutes(d.from) < minutes(b.to)
  );

export function availability(d) {
  if (!d.venue || !d.date)
    return (
      <p className="mr-avail mr-avail-hint">
        <Icon name="info" size={16} />
        <span>
          {L('Choose a place and a date to see when it is free.', 'اختر مكاناً وتاريخاً لترى متى يكون متاحاً.')}
        </span>
      </p>
    );
  const taken = (M.requestOptions?.busy || []).filter(b => b.venue === d.venue && b.date === d.date);
  const where = `${venueName(d.venue)}, ${fmtDay(d.date)}`,
    chosen = d.from && d.to && d.from < d.to;
  const list = items => (
    <ul>
      {items.map((b, i) => (
        <li key={i}>
          <bdi dir="ltr">
            {txt(b.from)}–{txt(b.to)}
          </bdi>{' '}
          · {b.status === 'approved' ? L('confirmed', 'مؤكَّد') : L('someone else has asked for it', 'طلبه شخص آخر')}
        </li>
      ))}
    </ul>
  );
  if (!taken.length)
    return (
      <p className="mr-avail mr-avail-free">
        <Icon name="check" size={16} />
        <span>{L(`Free all day — ${where}.`, `متاح طوال اليوم — ${where}.`)}</span>
      </p>
    );
  const overlap = chosen ? overlapping(d) : [];
  /* a confirmed booking at that time cannot be asked for; one only asked for can, and the office decides */
  if (overlap.some(b => b.status === 'approved'))
    return (
      <div className="mr-avail mr-avail-clash">
        <Icon name="warn" size={16} />
        <div>
          <b>
            {L(
              'Your time overlaps a confirmed booking. Please choose another time.',
              'يتعارض وقتك مع حجز مؤكَّد. يُرجى اختيار وقت آخر.'
            )}
          </b>
          {list(taken)}
        </div>
      </div>
    );
  if (overlap.length)
    return (
      <div className="mr-avail mr-avail-busy">
        <Icon name="clock" size={16} />
        <div>
          <b>{L('Someone else has asked for this time.', 'طلب شخص آخر هذا الوقت.')}</b>{' '}
          {L(
            'You can still send your request; the parish office will decide.',
            'يمكنك إرسال طلبك؛ وسيقرّر مكتب الرعية.'
          )}
          {list(taken)}
        </div>
      </div>
    );
  if (chosen)
    return (
      <div className="mr-avail mr-avail-free">
        <Icon name="check" size={16} />
        <div>
          <b>{L('Free at that time.', 'متاح في هذا الوقت.')}</b>{' '}
          {L('Also taken that day:', 'محجوز أيضاً في ذلك اليوم:')}
          {list(taken)}
        </div>
      </div>
    );
  return (
    <div className="mr-avail mr-avail-busy">
      <Icon name="clock" size={16} />
      <div>
        <b>{L(`Already taken on ${fmtDay(d.date)}:`, `محجوز في ${fmtDay(d.date)}:`)}</b>
        {list(taken)}
      </div>
    </div>
  );
}

const occasionOf = d => (d.occasion === 'other' ? d.occasionOther : occasionText(d.occasion));

export function summaryRows(d) {
  const subject = (M.requestOptions?.subjects || []).find(s => s.id === d.subject);
  if (d.kind === 'booking')
    return [
      [L('Request', 'الطلب'), L('Booking', 'حجز')],
      [L('Place', 'المكان'), venueName(d.venue)],
      [L('When', 'الموعد'), `${fmtDay(d.date)} · ${d.from}–${d.to}`],
      [L('Occasion', 'المناسبة'), occasionOf(d)],
      [L('People expected', 'عدد الأشخاص'), String(d.guests)],
      [L('Phone', 'الهاتف'), d.phone || '—', 'ltr'],
      [L('Message', 'رسالة'), d.notes || '—']
    ];
  if (d.kind === 'custom')
    return [
      [L('Request', 'الطلب'), d.subjectText],
      [L('Details', 'التفاصيل'), d.message],
      [L('Day', 'اليوم'), d.date ? fmtDay(d.date) : L('Any day', 'أي يوم')],
      [L('Phone', 'الهاتف'), d.phone || '—', 'ltr']
    ];
  const rows = [
    [L('Request', 'الطلب'), d.kind === 'certificate' ? certificateName(d.certificateOf) : kindName(d.kind)]
  ];
  if (d.subject === 'child') {
    rows.push(
      [L('For', 'لـ'), [nameOf(d.child), otherName(d.child)].filter(Boolean).join(' · ')],
      [L('Date of birth', 'تاريخ الولادة'), fmtDay(d.child.born)]
    );
    if (d.child.father || d.child.mother)
      rows.push([L('Parents', 'الوالدان'), [d.child.father, d.child.mother].filter(Boolean).join(' · ')]);
  } else if (subject)
    rows.push([L('For', 'لـ'), subject.self ? `${L('You', 'أنت')} — ${nameOf(subject)}` : nameOf(subject)]);
  if (d.kind === 'certificate')
    rows.push(
      [L('Purpose', 'الغرض'), d.purpose === 'other' ? d.purposeOther : purposeText(d.purpose)],
      [L('Language', 'اللغة'), languageName(d.language)]
    );
  else
    rows.push([
      L('Preferred date', 'التاريخ المفضّل'),
      d.date ? fmtDay(d.date) : L('No preference — the office will propose one', 'لا تفضيل — سيقترح المكتب موعداً')
    ]);
  if (d.kind === 'marriage')
    rows.push([L('Future spouse', 'الشريك'), d.partner + (d.partnerParish ? ` · ${d.partnerParish}` : '')]);
  rows.push([L('Phone', 'الهاتف'), d.phone || '—', 'ltr'], [L('Message', 'رسالة'), d.notes || '—']);
  return rows;
}

/* Each value is isolated, so an English note or a phone number reads in its own direction inside Arabic. */
export const summaryList = (rows, cls = '') => (
  <dl className={`mr-summary${cls}`}>
    {rows.map(([k, v, dir], i) => (
      <Fragment key={i}>
        <dt>{txt(k)}</dt>
        <dd>
          <bdi dir={dir ? dir : undefined}>{txt(v)}</bdi>
        </dd>
      </Fragment>
    ))}
  </dl>
);

export function stepReview(d) {
  const [first, second] =
    d.kind === 'booking'
      ? [L('Change the place or time', 'تغيير المكان أو الموعد'), L('Change the details', 'تغيير التفاصيل')]
      : d.kind === 'custom'
        ? [L('Change your request', 'تغيير طلبك'), L('Change the details', 'تغيير التفاصيل')]
        : [L('Change who it is for', 'تغيير صاحب الطلب'), L('Change the details', 'تغيير التفاصيل')];
  return (
    <>
      <h2 className="mr-legend">{L('Check your request', 'راجع طلبك')}</h2> {summaryList(summaryRows(d))}{' '}
      <p className="mr-edit-links">
        <button type="button" className="btn btn-ghost btn-dense" data-mr-step="1">
          <Icon name="edit" size={15} />
          {first}
        </button>{' '}
        <button type="button" className="btn btn-ghost btn-dense" data-mr-step="2">
          <Icon name="edit" size={15} />
          {second}
        </button>
      </p>{' '}
      <div className="mr-next-note">
        <Icon name="info" size={18} />
        <p>
          {L(
            'When you send it, the parish office receives your request. You can follow it on this page and you will get a notification at each step.',
            'عند الإرسال، يصل طلبك إلى مكتب الرعية. يمكنك متابعته من هذه الصفحة، وستصلك إشعارات عند كل خطوة.'
          )}
        </p>
      </div>
    </>
  );
}

/* The control a message belongs to: on a computer a list is drawn as a button beside the hidden select. */
export const fieldOf = (host, id) =>
  host.querySelector(`#${id}-dd`) || host.querySelector('#' + id) || host.querySelector(`#${id}-group`);

export function showProblems(host, list) {
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
      paint(
        error,
        <>
          <Icon name="warn" size={14} />
          <span>{txt(message)}</span>
        </>
      );
      error.hidden = false;
    }
    fieldOf(host, id)?.setAttribute('aria-invalid', 'true');
  }
  paint(
    summary,
    <>
      <Icon name="warn" size={18} />
      <span>
        <b>{L('Please check the following:', 'يُرجى التحقّق مما يلي:')}</b>
        <ul>
          {list.map(([id, message], i) => (
            <li key={i}>
              <a href={`#${id}`} data-focus={id}>
                {txt(message)}
              </a>
            </li>
          ))}
        </ul>
      </span>
    </>
  );
  summary.hidden = false;
  summary.querySelectorAll('[data-focus]').forEach(a =>
    a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.dataset.focus,
        target = host.querySelector(`#${id}-group input:not([disabled])`) || fieldOf(host, id);
      target?.focus();
    })
  );
  summary.focus();
  return false;
}

export function showStep(host, d, step) {
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
    if (v && help)
      help.textContent = L(
        `${t(v.name, v.ar || v.name)} holds up to ${v.cap} people.`,
        `${t(v.name, v.ar || v.name)} يتّسع لـ ${v.cap} شخصاً.`
      );
  }
  host.querySelectorAll('[data-step-mark]').forEach(li => {
    const n = Number(li.dataset.stepMark);
    li.classList.toggle('done', n < step);
    n === step ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current');
    paint(li.querySelector('.n'), n < step ? <Icon name="check" size={13} /> : String(n));
  });
  host.querySelector('#mr-back').hidden = step === 1;
  host.querySelector('#mr-continue').hidden = step === 3;
  host.querySelector('#mr-send').hidden = step !== 3;
  showProblems(host, []);
  wireReview(host, d);
  host.querySelector('#mr-form').scrollIntoView({ block: 'start', behavior: 'smooth' });
  const heading = host.querySelector(`.mr-step[data-step="${step}"] .mr-legend`);
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

export function wireReview(host, d) {
  host
    .querySelectorAll('[data-mr-step]')
    .forEach(b => b.addEventListener('click', () => showStep(host, d, Number(b.dataset.mrStep))));
}
