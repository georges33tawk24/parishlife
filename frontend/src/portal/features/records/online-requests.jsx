/* Purpose: requests that arrived online (from a signed-in member, the parish office itself or, kept on
   their own page, guests): their rows in the Requests queue and the way into one case.
   Main functions: waitingOnline, onlineItems, onlineTitle, subjectOf, onlineMark, sharedNote,
   openOnlineRequest. The case itself (decisions, files, messages, history) is in requests-case.jsx.

   Each row is a ParishLife.Api request case (model/modules/requests.js). Accepting one no longer creates a
   sacrament entry or a booking, because the API records the case and its links only: the sacrament or
   booking is entered in its own page, and linked from the case. */
import { t } from '../../../lib/i18n.js';
import { bus, S } from '../../model/store.js';
import { MEMBER_REQUESTS, person } from '../../model/data.js';
import { toast } from '../../ui/ui.jsx';
import { kindOf, certificateName, topicText } from '../../model/sacrament-requests.js';
import { openRequestCase } from './requests-case.jsx';

const L = (en, ar) => t(en, ar);

/* Guests have their own page; everything else the office receives is an online request. */
const online = () => MEMBER_REQUESTS.filter(r => r.origin !== 'Guest');

/* What still needs the office: new requests, and requests where the parish asked the applicant for more. */
export const waitingOnline = () => online().filter(r => r.status === 'submitted');

const stillOpen = r => !['completed', 'declined', 'withdrawn', 'cancelled'].includes(r.status);

export const onlineTitle = r =>
  r.kind === 'certificate'
    ? certificateName(r.details.certificateOf)
    : r.kind === 'booking'
      ? `${L('Booking', 'حجز')}${r.details.venue ? ` · ${r.details.venue}` : ''}`
      : r.kind === 'custom'
        ? topicText(r.details.subject) || r.api.dto.summary
        : L(kindOf(r.kind).en, kindOf(r.kind).ar);

/* Who the request is about: the person record it was matched to, or the words the applicant used. */
export const subjectOf = r =>
  person(r.api.dto.subjectPersonId) || {
    id: '',
    lat: r.api.dto.subjectDescription || r.requester.name || L('Not matched to a record', 'غير مربوط بسجل'),
    ar: '',
    born: ''
  };

/* The API links a case to records by id only; no sacrament or booking entry carries an online mark. */
export const onlineMark = () => '';
export const sharedNote = () => '';

const STATE = {
  submitted: 'submitted',
  'needs-information': 'pending',
  accepted: 'accepted',
  'cancellation-requested': 'pending',
  completed: 'completed',
  declined: 'rejected',
  withdrawn: 'withdrawn',
  cancelled: 'cancelled'
};
const NEXT = {
  submitted: ['Review the online request', 'مراجعة الطلب الإلكتروني'],
  'needs-information': ['Waiting for the applicant’s answer', 'بانتظار جواب مقدّم الطلب'],
  accepted: ['Accepted: work on it, then mark it completed', 'مقبول: نفّذه ثم علّمه مكتملاً'],
  'cancellation-requested': ['The applicant asked to cancel: review it', 'طلب مقدّم الطلب الإلغاء: راجعه'],
  completed: ['Done', 'منجز'],
  declined: ['Nothing more to do: the applicant was told why', 'لا شيء آخر: أُبلغ مقدّم الطلب بالسبب'],
  withdrawn: ['Nothing to do: the applicant withdrew it', 'لا شيء: سحبه مقدّم الطلب'],
  cancelled: ['Cancelled', 'أُلغي']
};

/* Rows for the Requests page. */
export const onlineItems = () =>
  online().map(r => ({
    category: 'online',
    title: onlineTitle(r),
    who: subjectOf(r),
    state: STATE[r.status] || 'pending',
    open: stillOpen(r),
    date: r.createdAt,
    priority: r.api.dto.urgency === 'Urgent' ? L('Urgent', 'عاجل') : '',
    online: true,
    owner: stillOpen(r) ? L('Priest or parish office', 'الكاهن أو مكتب الرعية') : '',
    next: L(...(NEXT[r.status] || NEXT.submitted)),
    href: `#/requests/online/${r.id}`,
    ref: r.reference
  }));

/* Opens one case over the list; the address settles back on Requests. Reloads the list after a change. */
export function openOnlineRequest(id) {
  if (!MEMBER_REQUESTS.some(r => r.id === id)) {
    toast(
      L('Online request not found', 'لم يُعثر على الطلب الإلكتروني'),
      L('It may have been handled from another screen.', 'ربما عولج من شاشة أخرى.'),
      'warning'
    );
    return;
  }
  openRequestCase(id, () => bus.refresh());
  S.params = [];
}
