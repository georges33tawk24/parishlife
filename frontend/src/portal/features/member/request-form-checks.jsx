/* The request form once drawn: reading it, checking each step, showing problems, and sending it. */
import { paint } from '../../ui/html.js';
import { t } from '../../../lib/i18n.js';
import { submitOwn } from '../../model/modules/requests.js';
import { go, S } from '../../model/store.js';
import { toast } from '../../ui/ui.jsx';
import { TOPICS, todayKey } from '../../model/sacrament-requests.js';
import { availability, fieldOf, reload, showProblems, showStep, wireReview, yearsAhead } from './requests-shared.jsx';

const L = (en, ar) => t(en, ar);

const read = (el, id) => el.querySelector('#' + id)?.value.trim() ?? '';

const topicLabel = value => {
  const o = TOPICS.find(x => x[0] === value);
  return o ? t(o[0], o[1]) : '';
};

function collect(host, d) {
  const radio = name => host.querySelector(`input[name="${name}"]:checked`)?.value || '';
  if (host.querySelector('[data-step="1"]:not([hidden])')) {
    if (d.kind === 'booking') {
      d.venue = read(host, 'mr-venue');
      d.date = read(host, 'mr-bdate');
      d.from = read(host, 'mr-from');
      d.to = read(host, 'mr-to');
    } else if (d.kind === 'custom') {
      d.topic = radio('mr-topic');
      d.subjectText = read(host, 'mr-subject-text');
      d.message = host.querySelector('#mr-message')?.value.trim() ?? d.message;
    } else {
      d.subject = radio('mr-subject') || d.subject;
      const who = d.subject === 'child' ? 'child' : d.subject === 'other' ? 'other' : '';
      if (who) {
        d.relationship = read(host, `mr-${who}-relation`) || d.relationship;
        d.authority = read(host, `mr-${who}-authority`);
      }
      if (d.subject === 'other') d.otherName = read(host, 'mr-other-name');
      if (d.kind === 'baptism')
        d.child = {
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
    if (!d.venue) out.push(['mr-venue', L('Say which place you would like to book.', 'اذكر المكان الذي تريد حجزه.')]);
    if (!d.date) out.push(['mr-bdate', L('Choose the date.', 'اختر التاريخ.')]);
    else if (d.date < todayKey() || d.date > yearsAhead(2))
      out.push(['mr-bdate', L('Choose a date from today onwards.', 'اختر تاريخاً ابتداءً من اليوم.')]);
    if (!d.from) out.push(['mr-from', L('Choose when it starts.', 'اختر وقت البدء.')]);
    if (!d.to) out.push(['mr-to', L('Choose when it ends.', 'اختر وقت الانتهاء.')]);
    else if (d.from && d.to <= d.from)
      out.push(['mr-to', L('The end time must be after the start time.', 'يجب أن يكون وقت الانتهاء بعد وقت البدء.')]);
  } else if (step === 1 && d.kind === 'custom') {
    if (d.subjectText.length < 2)
      out.push(['mr-subject-text', L('Say in a few words what you are asking for.', 'قل بكلمات قليلة ما الذي تطلبه.')]);
    if (d.message.length < 2)
      out.push([
        'mr-message',
        L('Tell the parish office a little more about your request.', 'أخبر مكتب الرعية بالمزيد عن طلبك.')
      ]);
  } else if (step === 1) {
    if (!d.subject) out.push(['mr-subject', L('Choose who the request is for.', 'اختر لمن الطلب.')]);
    if (d.subject === 'child' || d.subject === 'other') {
      const who = d.subject === 'child' ? 'child' : 'other';
      if (!d.authority)
        out.push([
          `mr-${who}-authority`,
          L('Say why you may ask for this person.', 'اذكر لماذا يحق لك الطلب عن هذا الشخص.')
        ]);
    }
    if (d.subject === 'other' && !d.otherName)
      out.push(['mr-other-name', L('Enter their full name.', 'أدخل اسمه الكامل.')]);
    if (d.subject === 'child') {
      if (!d.child.lat)
        out.push(['mr-child-lat', L('Enter the child’s full name in English.', 'أدخل اسم الطفل الكامل بالإنكليزية.')]);
      if (!d.child.ar)
        out.push(['mr-child-ar', L('Enter the child’s full name in Arabic.', 'أدخل اسم الطفل الكامل بالعربية.')]);
      if (!d.child.born) out.push(['mr-child-born', L('Enter the child’s date of birth.', 'أدخل تاريخ ولادة الطفل.')]);
      else if (d.child.born > todayKey())
        out.push([
          'mr-child-born',
          L('The date of birth cannot be in the future.', 'لا يمكن أن يكون تاريخ الولادة في المستقبل.')
        ]);
    }
  }
  if (step === 2) {
    if (d.kind === 'certificate') {
      if (!d.certificateOf)
        out.push(['mr-of', L('Choose which certificate you need.', 'اختر الشهادة التي تحتاج إليها.')]);
      if (!d.purpose) out.push(['mr-purpose', L('Choose what the certificate is for.', 'اختر غرض الشهادة.')]);
      else if (d.purpose === 'other' && !d.purposeOther)
        out.push(['mr-purpose-other', L('Describe what the certificate is for.', 'صِف غرض الشهادة.')]);
    } else if (d.kind === 'booking') {
      const guests = Number(d.guests);
      if (!d.occasion) out.push(['mr-occasion', L('Choose what the booking is for.', 'اختر المناسبة.')]);
      else if (d.occasion === 'other' && d.occasionOther.length < 2)
        out.push(['mr-occasion-other', L('Describe the occasion.', 'صِف المناسبة.')]);
      if (!d.guests || !Number.isInteger(guests) || guests < 1)
        out.push(['mr-guests', L('Enter how many people you expect.', 'أدخل عدد الأشخاص المتوقَّع.')]);
    } else {
      if (d.date && d.date < todayKey())
        out.push(['mr-date', L('Choose a date from today onwards.', 'اختر تاريخاً ابتداءً من اليوم.')]);
      if (d.kind === 'marriage' && !d.partner)
        out.push(['mr-partner', L('Enter the full name of your future spouse.', 'أدخل اسم الشريك الكامل.')]);
    }
    if (d.notes.length > 500)
      out.push(['mr-notes', L('Keep your message within 500 characters.', 'اجعل رسالتك ضمن ٥٠٠ حرف.')]);
  }
  return out;
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

function payload(d) {
  if (d.kind === 'booking')
    return {
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
  if (d.kind === 'custom')
    return {
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
    ...(d.subject === 'child'
      ? {
          child: d.child,
          relationship: d.relationship,
          authorityBasis: d.authority,
          subjectDescription: [
            d.child.lat,
            d.child.ar,
            `born ${d.child.born}`,
            d.child.father && `father ${d.child.father}`,
            d.child.mother && `mother ${d.child.mother}`
          ]
            .filter(Boolean)
            .join(', ')
        }
      : d.subject === 'other'
        ? { relationship: d.relationship, authorityBasis: d.authority, subjectDescription: d.otherName }
        : { relationship: 'Self' }),
    ...(d.kind === 'certificate'
      ? {
          certificateOf: d.certificateOf,
          purpose: d.purpose === 'other' ? d.purposeOther : d.purpose,
          language: d.language
        }
      : { date: d.date, ...(d.kind === 'marriage' ? { partner: d.partner, partnerParish: d.partnerParish } : {}) })
  };
}

export function mountForm(host) {
  const form = host.querySelector('#mr-form');
  if (!form) return;
  const d = S.ui.mrDraft;
  const toggleChild = () => {
    const child = host.querySelector('#mr-child');
    const chosen = host.querySelector('input[name="mr-subject"]:checked')?.value,
      other = host.querySelector('#mr-other');
    if (child) child.hidden = chosen !== 'child';
    if (other) other.hidden = chosen !== 'other';
  };
  host.querySelectorAll('input[name="mr-subject"]').forEach(r =>
    r.addEventListener('change', () => {
      toggleChild();
      collect(host, d);
    })
  );
  for (const [name, wrapId, inputId] of [
    ['mr-purpose', 'mr-purpose-other-wrap', 'mr-purpose-other'],
    ['mr-occasion', 'mr-occasion-other-wrap', 'mr-occasion-other']
  ]) {
    host.querySelectorAll(`input[name="${name}"]`).forEach(r =>
      r.addEventListener('change', () => {
        host.querySelector('#' + wrapId).hidden = r.value !== 'other';
        if (r.value === 'other') host.querySelector('#' + inputId).focus();
      })
    );
  }
  /* A topic fills "in a few words", unless the member has written something of their own. */
  host.querySelectorAll('input[name="mr-topic"]').forEach(r =>
    r.addEventListener('change', () => {
      const field = host.querySelector('#mr-subject-text');
      const previous = topicLabel(d.topic);
      if (!field.value.trim() || field.value.trim() === previous)
        field.value = r.value === 'other' ? '' : topicLabel(r.value);
      if (r.value === 'other') field.focus();
    })
  );
  for (const [id, max] of [
    ['mr-notes', 500],
    ['mr-message', 1000]
  ]) {
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
      const result = await submitOwn(payload(d));
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
