/* Calendar actions: moving through months and days, duplicating or cancelling an event, and saving
   events as .ics. */
import { t, fmtDate } from '../../../lib/i18n.js';
import { S } from '../../model/store.js';
import { closeOverlays } from '../../ui/ui.jsx';
import * as D from '../../model/data.js';
import { download } from '../../shell/actions.jsx';
import { ok, refresh, today } from '../../shared/dialog-helpers.jsx';

const L = (en, ar) => t(en, ar);

const ics = s => s.replace(/[,;\\]/g, m => '\\' + m);

export function downloadICS() {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ParishLife//Saint Elias//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${ics(D.PARISH.name)} — ParishLife`,
    'X-WR-TIMEZONE:Asia/Beirut'
  ];
  D.EVENTS.forEach(e => {
    const [h, m] = e.t.split(':').map(Number);
    const d = e.d.replace(/-/g, ''),
      start = `${d}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
    const end = `${d}T${String(h + 1).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
    const v = D.venue(e.venue);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@saint-elias.parishlife`,
      `DTSTAMP:20261004T190000Z`,
      `DTSTART;TZID=Asia/Beirut:${start}`,
      `DTEND;TZID=Asia/Beirut:${end}`,
      `SUMMARY:${ics(L(e.title, e.titleAr))}`,
      `LOCATION:${ics(v ? v.name : '')}, Saint Elias, Hadath`,
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  download('saint-elias-calendar.ics', lines.join('\r\n'), 'text/calendar;charset=utf-8');
  ok(
    L('Calendar downloaded', 'نُزّلت الرزنامة'),
    L(
      `${D.EVENTS.length} events · open the file to add them to Google, Outlook or Apple Calendar.`,
      `${D.EVENTS.length} حدثاً · افتح الملف لإضافتها إلى غوغل أو أوتلوك أو آبل.`
    )
  );
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

export function eventDuplicate(id) {
  const e = D.EVENTS.find(x => x.id === id) || D.EVENTS[9];
  const d = new Date(e.d);
  d.setDate(d.getDate() + 7);
  const copy = { ...e, id: 'ev' + Date.now(), d: d.toISOString().slice(0, 10) };
  D.EVENTS.push(copy);
  closeOverlays();
  refresh();
  ok(L('Event duplicated', 'نُسخ الحدث'), `${L(e.title, e.titleAr)} · ${fmtDate(copy.d)}`, {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        D.EVENTS.splice(D.EVENTS.indexOf(copy), 1);
        refresh();
      }
    }
  });
}

export function eventCancel(id) {
  const i = D.EVENTS.findIndex(x => x.id === id);
  if (i < 0) return;
  const [e] = D.EVENTS.splice(i, 1);
  closeOverlays();
  refresh();
  ok(L('Event cancelled', 'أُلغي الحدث'), L('Everyone who said yes has been told.', 'أُبلغ كل من أكّد حضوره.'), {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        D.EVENTS.splice(i, 0, e);
        refresh();
      }
    }
  });
}
