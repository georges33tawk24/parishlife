/* Calendar actions: moving through months and days, duplicating an event, moving an event through its
   lifecycle (confirm, publish, unpublish, cancel) and saving the member's schedule as .ics. Lifecycle steps
   are calls to the API followed by a reload, not edits to the list. */
import { t } from '../../../lib/i18n.js';
import { S } from '../../model/store.js';
import { closeOverlays, openModal, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { download } from '../../shell/actions.jsx';
import { ok, refresh, today, val } from '../../shared/dialog-helpers.jsx';
import { hydrate, persist } from '../../model/persist.js';
import { downloadSchedule, eventAction } from '../../model/modules/calendar.js';

const L = (en, ar) => t(en, ar);

/* The member's own schedule across their parishes, as an iCalendar file the API builds (volunteering,
   registrations and scheduled sacraments). The API has no feed of the whole parish calendar. */
export async function downloadICS() {
  const from = new Date(),
    to = new Date(+from + 90 * 86400000);
  try {
    download('my-schedule.ics', await downloadSchedule(from, to), 'text/calendar;charset=utf-8');
    ok(
      L('Schedule downloaded', 'نُزّل الجدول'),
      L(
        'The next 90 days of your own schedule. Open the file to add it to Google, Outlook or Apple Calendar.',
        'جدولك الخاص للأيام التسعين القادمة. افتح الملف لإضافته إلى غوغل أو أوتلوك أو آبل.'
      )
    );
  } catch (error) {
    toast(L('The schedule could not be downloaded', 'تعذّر تنزيل الجدول'), error.message, 'warning');
  }
}

export function calShift(n) {
  S.ui.calOffset = n === 0 ? 0 : S.ui.calOffset + n;
  refresh();
}

export function calDay(n) {
  const [y, m, d] = (S.ui.calDay || today).split('-').map(Number);
  const x = n ? new Date(y, m - 1, d + n) : new Date(D.TODAY);
  S.ui.calDay = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  refresh();
}

/* A copy a week later, saved as a new draft. */
export async function eventDuplicate(id) {
  const e = D.EVENTS.find(x => x.id === id);
  if (!e || e.redacted) return;
  const shift = key => {
    const d = new Date(key + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  };
  const copy = {
    ...e,
    id: 'copy-' + Date.now(),
    d: shift(e.d),
    endsOn: e.endsOn && e.endsOn > e.d ? shift(e.endsOn) : e.d,
    status: 'Draft',
    published: false,
    seriesId: null,
    reason: '',
    version: ''
  };
  D.EVENTS.push(copy);
  closeOverlays();
  if (await persist()) ok(L('Event duplicated', 'نُسخ الحدث'), `${e.title} · ${copy.d}`);
  else refresh();
}

const DONE = {
  confirm: ['Event confirmed', 'ثُبّت الحدث'],
  publish: ['Event published', 'نُشر الحدث'],
  unpublish: ['Event unpublished', 'أُلغي نشر الحدث'],
  cancel: ['Event cancelled', 'أُلغي الحدث']
};

async function step(e, action, reason) {
  try {
    await eventAction(e, action, reason);
    closeOverlays();
    await hydrate();
    refresh();
    ok(
      L(...DONE[action]),
      action === 'cancel'
        ? L(
            'Nothing is sent automatically, so let those who said yes know.',
            'لا يُرسَل شيء تلقائياً، فأبلِغ من أكّدوا حضورهم.'
          )
        : e.title
    );
  } catch (error) {
    toast(L('That did not work', 'لم تنجح العملية'), error.message, 'warning');
  }
}

/* Confirm and publish need nothing more; unpublishing and cancelling ask for the reason the API records. */
export function eventStep(id, action) {
  const e = D.EVENTS.find(x => x.id === id);
  if (!e || e.redacted) return;
  if (action === 'confirm' || action === 'publish') return step(e, action);
  openModal({
    title:
      action === 'cancel'
        ? L('Cancel this event?', 'إلغاء هذا الحدث؟')
        : L('Unpublish this event?', 'إلغاء نشر هذا الحدث؟'),
    body: (
      <>
        <p>{e.title}</p>
        <C.Textarea label={L('Reason', 'السبب')} id="ev_reason" max={400} />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Keep it', 'إبقاؤه')}
        </button>
        <button className="btn btn-danger" id="ev_reason_ok">
          {action === 'cancel' ? L('Cancel event', 'إلغاء الحدث') : L('Unpublish', 'إلغاء النشر')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#ev_reason_ok').addEventListener('click', () => {
        const reason = val(el, '#ev_reason');
        if (!reason) return toast(L('Give a reason', 'اذكر السبب'), '', 'warning');
        step(e, action, reason);
      });
    }
  });
}

/* Cancelling keeps the event on the calendar, marked cancelled; nothing is deleted. */
export const eventCancel = id => eventStep(id, 'cancel');
