import { Select } from "../ui/components.jsx";
import { css, nodesOr, htmlAttrs, paint, markup } from "../ui/html.js";
import { CalendarView } from "../ui/collection.jsx";
/* Modules 3, 4, 6, 8, 9, 10 — groups, calendar, services, volunteers,
   registration and check-in. */
import { t, isAr, num, usd, fmtDate, fmtLong, dayShort, month } from "../../lib/i18n.js";
import { is, S, go, bus } from "../model/store.js";
import { Icon, PageHead, Panel, Who, Status, Pill, Table, Empty, openDrawer, openModal, closeOverlays, toast, Stat, Avatar, TabBar, openMenu, Paged } from "../ui/ui.jsx";
import * as C from "../ui/components.jsx";
import * as CR from "../flows/crud.jsx";
import { VERBS, download } from "../actions.jsx";
import { parishAPI, session } from "../model/api.js";
import { persist } from "../model/persist.js";
import { participantForm, consentInfo, consentPill, registrationDue, registrationMoney, paymentPill, placeLabel, transportLabel } from "../flows/registration.jsx";
import { safeRichText } from "../../lib/rich-text.js";
import * as F from "../flows/flows.jsx";
import { printWeekDialog, priestScheduleDialog } from "../flows/schedules.jsx";
import { allPlans, currentPlan, workingPlan, planDirty, savePlanDraft, normalizePlanOrder, planTotalMinutes, meetingId, attendanceCounts, attendanceValue } from "../model/planning.js";
import { eligibleEvents, eventById, selectedRegistration, selectRegistration, registrantsFor, linkedEvent, selectableCheckinEvents, selectCheckinEvent, selectedCheckin, ensureCheckinSession, eventVenue } from "../model/event-workflows.js";
import { EVENTS, EVENT_DETAIL, PEOPLE, FEASTS, GROUPS, GROUP_DETAIL, groupInfo, eventInfo, ROTA, REGISTRATIONS, REG_FORM, REGISTRANTS, REFUNDS, CHECKIN, PICKUP, INCIDENTS, VENUES, TODAY, VOLUNTEERS, SIGNUP_SHEETS, SERVICE_REQUESTS, SERVICE_TEMPLATES, EVENT_TEMPLATES, MUSIC, person, venue, group, initials } from "../model/data.js";

/* Month shown on the calendar: October 2026 moved by the prev / next buttons. */
const calMonth = () => {
  const d = new Date(2026, 9 + S.ui.calOffset, 1);
  return {
    y: d.getFullYear(),
    m: d.getMonth()
  };
};
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const L = (en, ar) => t(en, ar);
const byTime = (a, b) => (a.d + a.t).localeCompare(b.d + b.t);
const meetingKind = m => m.kind === 'committee' ? L('Committee / people in charge', 'اللجنة / المسؤولون') : L('Whole group', 'المجموعة كاملة');
const MINISTRY_ROLES = [['President', 'رئيس'], ['Vice President', 'نائب رئيس'], ['Secretary', 'أمين السرّ'], ['Treasurer', 'أمين الصندوق'], ['Responsible of Apostolic Mission', 'وكيل الرسالة'], ['Responsible for Christian Education', 'وكيل التنشئة والثقافة المسيحية'], ['Social Media Manager', 'وكيل الإعلام'], ['Consultant', 'مستشار'], ['Advisor', 'موجّه'], ['Group Monitor', 'مسؤول فريق'], ['Trainer', 'مدرّب في معهد التنشئة والتدريب'], ['Trainee', 'طالب في معهد التنشئة والتدريب'], ['Member', 'عضو']];
/* the kinds of entry the calendar can show; the chips switch each on and off */
const CAL_KINDS = [['mass', 'Masses', 'القداديس'], ['event', 'Parish events', 'أحداث الرعية'], ['group', 'Groups', 'المجموعات'], ['sacr', 'Sacraments', 'الأسرار'], ['pending', 'Reservations', 'الحجوزات']];
const calEvents = () => EVENTS.filter(e => !(S.ui.calOff || []).includes(e.kind));
const addMin = (hm, m) => {
  const [h, mi] = hm.split(':').map(Number),
    x = h * 60 + mi + m;
  return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/* ═══════════════ 4 · calendar ═══════════════ */
const CALTABS = () => [['', 'Month', 'شهر'], ['week', 'Week', 'أسبوع'], ['day', 'Day', 'يوم'], ['agenda', 'Agenda', 'جدول'], ['templates', 'Templates', 'قوالب']];
export function calendar(tab = '') {
  const head = <><PageHead crumbs={[{
      label: L('Parish life', 'حياة الرعية')
    }, {
      label: L('Calendar', 'الرزنامة')
    }]} title={L('Calendar', 'الرزنامة')} sub={L('One event system with filtered views — personal, group, parish, facility and eparchy. Pending reservations are shown only to those allowed to see them.', 'نظام أحداث واحد بعروض مرشّحة — شخصي ومجموعة ورعية ومرفق وأبرشية. الحجوزات المعلّقة تظهر فقط لمن يحقّ له.')} actions={<>{is('priest') ? <button className="btn btn-secondary" id="priest-schedule"><Icon name='print' size={17} />{L('Priest schedule', 'جدول الكهنة')}</button> : ''}{" "}<button className="btn btn-secondary" id="printweek"><Icon name='print' size={17} />{L('Print my schedule', 'اطبع جدولي')}</button>{" "}<button className="btn btn-secondary" id="subscribe"><Icon name='link' size={17} />{L('Subscribe', 'اشتراك')}</button>{" "}{is('priest', 'secretary', 'bishop') ? <C.SplitBtn label={L('New event', 'حدث جديد')} id='newev' /> : ''}</>} /><div className="collection-toolbar"><a className="btn btn-secondary" href="#/calendar">{L('Calendar', 'الرزنامة')}</a><a className="btn btn-secondary" href="#/calendar/templates">{L('Templates', 'القوالب')}</a></div></>;
  if (tab !== 'templates') {
    S.ui.sharedCalendar ||= {
      mode: tab === 'week' ? 'week' : tab === 'agenda' ? 'list' : 'month'
    };
    return <>{head}<div data-unified-calendar=""><CalendarView events={calEvents().map(e => ({
          ...e,
          date: e.d,
          time: e.t,
          title: L(e.title, e.titleAr)
        }))} state={S.ui.sharedCalendar} onOpen={id => eventDrawer(id)} /></div></>;
  }
  const filters = <div className="toolbar" style={{
    margin: "20px 0 16px"
  }}><div style={{
      display: "flex",
      gap: "6px"
    }}><C.IconBtn ico='chevL' label={L('Previous month', 'الشهر السابق')} data-act="cal-prev" />{" "}<button className="btn btn-secondary btn-dense" data-act="cal-today">{L('Today', 'اليوم')}</button>{" "}<C.IconBtn ico='chevR' label={L('Next month', 'الشهر التالي')} data-act="cal-next" /></div>{" "}<div className="chipset" role="group" aria-label={L('Show on the calendar', 'اعرض على الرزنامة')} style={{
      marginInlineStart: "auto"
    }}>{CAL_KINDS.map(([k, en, ar]) => {
        const on = !(S.ui.calOff || []).includes(k);
        return <button className={`chip ${on ? 'chip-on' : ''}`} aria-pressed={on} data-act={`cal-kind:${k}`}>{on ? <Icon name='check' size={13} /> : ''}{L(en, ar)}</button>;
      })}</div></div>;
  if (tab === 'templates') return <>{head}<div className="toolbar" style={{
      margin: "16px 0"
    }}><p className="t-caption dim">{L('Templates set defaults for new events. Existing events stay independent.', 'تحدّد القوالب إعدادات الأحداث الجديدة. تبقى الأحداث الحالية مستقلة.')}</p>{" "}{is('priest', 'secretary', 'bishop') ? <button className="btn btn-primary btn-dense" data-event-template-new=""><Icon name='plus' size={15} />{L('New template', 'قالب جديد')}</button> : ''}</div>{" "}<Table cols={[{
      label: L('Template', 'القالب')
    }, {
      label: L('Category', 'الفئة')
    }, {
      label: L('Room / duration', 'القاعة / المدة')
    }, {
      label: '',
      cls: 'shrink'
    }]} rows={EVENT_TEMPLATES.map(tpl => ({
      cells: [<b>{L(tpl.name, tpl.nameAr)}</b>, tpl.kind, `${L(venue(tpl.venue)?.name || '', venue(tpl.venue)?.ar || '')} · ${Number(tpl.duration) || 60} ${L('min', 'د')}`, <span className="row" style={{
        gap: "6px"
      }}>{is('priest', 'secretary', 'bishop') ? <><button className="btn btn-secondary btn-dense" data-tpl-use={tpl.id}>{L('Use', 'استعمال')}</button>{" "}<C.IconBtn ico='edit' label={L('Edit template', 'تعديل القالب')} data-tpl-edit={tpl.id} /><C.IconBtn ico='trash' label={L('Delete template', 'حذف القالب')} data-tpl-delete={tpl.id} /></> : ''}</span>]
    }))} /></>;
  if (tab === 'agenda') return <>{head}{filters}<Table cols={[{
      label: L('When', 'الموعد')
    }, {
      label: L('Event', 'الحدث')
    }, {
      label: L('Where', 'المكان'),
      cls: 'hide-sm'
    }, {
      label: L('Kind', 'النوع'),
      cls: 'shrink'
    }, {
      label: '',
      cls: 'shrink'
    }]} rows={calEvents().sort(byTime).map(e => ({
      cells: [<span className="mono dim">{fmtDate(e.d)}{" "}{e.t}</span>, <b>{L(e.title, e.titleAr)}</b>, <span className="dim">{L(venue(e.venue).name, venue(e.venue).ar)}</span>, e.kind === 'pending' ? <Status k='pending' /> : <Pill label={L(e.kind, e.kind)} />, <button className="btn btn-secondary btn-dense" data-ev={e.id}>{L('Open', 'فتح')}</button>]
    }))} /></>;

  /* day — the same event chip as the week, laid on an hour grid */
  if (tab === 'day') {
    const key = S.ui.calDay || iso(TODAY),
      evs = calEvents().filter(e => e.d === key).sort(byTime);
    const H0 = 7,
      ROW = 56,
      feast = FEASTS[key];
    const top = hm => {
      const [h, mi] = hm.split(':').map(Number);
      return (h - H0 + mi / 60) * ROW;
    };
    const mins = e => e.kind === 'mass' ? 60 : e.kind === 'sacr' ? 90 : 75; // ponytail: events carry no end time yet; typical length by kind
    const rooms = [...new Set(evs.map(e => e.venue))].map(venue);
    return <>{head}<div className="toolbar" style={{
        margin: "20px 0 16px"
      }}><div style={{
          display: "flex",
          gap: "6px"
        }}><C.IconBtn ico='chevL' label={L('Previous day', 'اليوم السابق')} data-act="cal-day:-1" />{" "}<button className="btn btn-secondary btn-dense" data-act="cal-day:0">{L('Today', 'اليوم')}</button>{" "}<C.IconBtn ico='chevR' label={L('Next day', 'اليوم التالي')} data-act="cal-day:1" /></div>{" "}<b className="dv-title">{fmtLong(key)}</b></div>{" "}<div className="splitview"><div className="cal dayview" style={css(`--row:${ROW}px`)}>{Array.from({
            length: 15
          }, (_, i) => <div className="dv-h"><span>{String(H0 + i).padStart(2, '0')}:00</span></div>)}{" "}<div className="dv-track">{evs.map(e => <button className={`cal-ev dv-ev ${e.kind === 'mass' ? 'mass' : e.kind === 'pending' ? 'pending' : ''}`} data-ev={e.id} style={css(`top:${top(e.t) + 2}px;height:${mins(e) / 60 * ROW - 4}px`)}><span className="row" style={{
                gap: "6px"
              }}><span className="t">{e.t}</span><b>{L(e.title, e.titleAr)}</b></span>{" "}<small>{L(venue(e.venue).name, venue(e.venue).ar)} · {mins(e)}{" "}{L('min', 'د')}</small></button>)}</div></div>{" "}<div className="sidecol"><Panel title={L('This day', 'هذا اليوم')}>{feast ? <div className="row" style={{
              gap: "8px",
              marginBottom: "12px"
            }}><span className="feastdot" /><b style={{
                font: "500 14px/20px var(--sans)"
              }}>{L(...feast)}</b></div> : ''}{" "}<dl className="dl"><dt>{L('Events', 'الأحداث')}</dt><dd className="mono">{evs.length}</dd><dt>{L('Awaiting approval', 'بانتظار الموافقة')}</dt><dd className="mono">{evs.filter(e => e.kind === 'pending').length}</dd><dt>{L('Rooms in use', 'القاعات المستخدمة')}</dt><dd>{rooms.length ? rooms.map(v => L(v.name, v.ar)).join(', ') : '—'}</dd></dl>{" "}<button className="btn btn-secondary" id="newday" style={{
              width: "100%",
              marginTop: "16px"
            }}><Icon name='plus' size={17} />{L('New event this day', 'حدث جديد في هذا اليوم')}</button></Panel></div></div></>;
  }
  if (tab === 'week') {
    const days = [4, 5, 6, 7, 8, 9, 10].map(d => new Date(2026, 9, d));
    return <>{head}{filters}<div className="cal"><div className="cal-head">{days.map(d => <div>{dayShort(d.getDay())}{" "}{d.getDate()}</div>)}</div>{" "}<div className="cal-grid">{days.map(d => {
            const evs = calEvents().filter(e => e.d === iso(d)).sort(byTime);
            return <div className="cal-day" style={{
              minHeight: "280px"
            }}>{nodesOr(evs.map(e => <span className={`cal-ev ${e.kind === 'mass' ? 'mass' : e.kind === 'pending' ? 'pending' : ''}`} data-ev={e.id}><span className="t">{e.t}</span>{L(e.title, e.titleAr)}</span>), <span className="t-caption dimmer">{L('Nothing', 'لا شيء')}</span>)}</div>;
          })}</div></div></>;
  }

  /* month */
  const {
    y,
    m
  } = calMonth();
  const first = new Date(y, m, 1),
    days = new Date(y, m + 1, 0).getDate(),
    lead = first.getDay();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push({
    d: new Date(y, m, -(lead - i - 1)),
    out: true
  });
  for (let i = 1; i <= days; i++) cells.push({
    d: new Date(y, m, i),
    out: false
  });
  while (cells.length % 7) cells.push({
    d: new Date(y, m + 1, cells.length - days - lead + 1),
    out: true
  });
  const grid = cells.map(({
    d,
    out
  }) => {
    const key = iso(d),
      evs = calEvents().filter(e => e.d === key).sort(byTime),
      feast = FEASTS[key],
      today = key === iso(TODAY);
    return <div className={`cal-day ${out ? 'out' : ''} ${today ? 'today' : ''}`}><button className="dn" data-day={key} aria-label={fmtLong(key)}>{d.getDate()}{feast && !today ? <span className="feast" /> : ''}</button>{" "}{feast && !out ? <span className="t-caption" style={{
        color: "var(--accent)",
        fontSize: "10px",
        lineHeight: "14px"
      }}>{L(...feast)}</span> : ''}{" "}{evs.slice(0, 3).map(e => <span className={`cal-ev ${e.kind === 'mass' ? 'mass' : e.kind === 'pending' ? 'pending' : ''}`} data-ev={e.id} title={L(e.title, e.titleAr)}><span className="t">{e.t}</span>{L(e.title, e.titleAr)}</span>)}{" "}{evs.length > 3 ? <span className="cal-more">+{evs.length - 3}</span> : ''}</div>;
  });
  return <>{head}{filters}<div className="cal"><div className="cal-head">{[0, 1, 2, 3, 4, 5, 6].map(i => <div>{dayShort(i)}</div>)}</div>{" "}<div className="cal-grid">{grid}</div></div>{" "}<div className="row cal-legend" style={{
      gap: "20px",
      marginTop: "16px",
      flexWrap: "wrap"
    }}>{[['mass', L('Mass', 'قدّاس')], ['', L('Parish event', 'حدث رعوي')], ['pending', L('Pending reservation — holds the slot', 'حجز معلّق — يحجز الوقت')]].map(([cls, lbl]) => <span className="row" style={{
        gap: "7px"
      }}><span className={`cal-ev cal-sw ${cls}`} />{" "}<span className="t-caption dim">{lbl}</span></span>)}{" "}<span className="row" style={{
        gap: "7px"
      }}><span className="feastdot" style={{
          width: "7px",
          height: "7px"
        }} />{" "}<span className="t-caption dim">{L('Feast day (Maronite calendar)', 'يوم عيد (الرزنامة المارونية)')}</span></span></div></>;
}
calendar.mount = host => {
  host.querySelector('#priest-schedule')?.addEventListener('click', priestScheduleDialog);
  host.querySelectorAll('[data-ev]').forEach(el => el.addEventListener('click', () => eventDrawer(el.dataset.ev)));
  host.querySelector('[data-split="newev"]')?.addEventListener('click', () => eventDrawer(null, true));
  host.querySelector('#newday')?.addEventListener('click', () => eventDrawer(null, true, {
    d: S.ui.calDay || iso(TODAY)
  }));
  host.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => {
    S.ui.calDay = b.dataset.day;
    go('calendar/day');
  }));
  host.querySelector('[data-event-template-new]')?.addEventListener('click', () => eventTemplateDrawer());
  host.querySelectorAll('[data-tpl-edit]').forEach(b => b.addEventListener('click', () => eventTemplateDrawer(b.dataset.tplEdit)));
  host.querySelectorAll('[data-tpl-delete]').forEach(b => b.addEventListener('click', () => deleteEventTemplate(b.dataset.tplDelete)));
  host.querySelectorAll('[data-tpl-use]').forEach(b => b.addEventListener('click', () => useEventTemplate(b.dataset.tplUse)));
  host.querySelector('[data-splitmenu="newev"]')?.addEventListener('click', e => openMenu(e.currentTarget, [{
    head: L('Start from a template', 'ابدأ من قالب')
  }, ...EVENT_TEMPLATES.map(tpl => ({
    label: L(tpl.name, tpl.nameAr),
    icon: tpl.icon,
    fn: () => useEventTemplate(tpl.id)
  })), {
    sep: true
  }, {
    label: L('Manage templates', 'إدارة القوالب'),
    icon: 'settings',
    fn: () => go('calendar/templates')
  }], {
    width: 240
  }));
  host.querySelector('#subscribe')?.addEventListener('click', () => openModal({
    title: L('Subscribe to this calendar', 'الاشتراك بهذه الرزنامة'),
    sub: L('Export or subscribe first; provider sync comes later, once update and cancellation behaviour is proven.', 'التصدير والاشتراك أولاً؛ والمزامنة مع المزوّدين لاحقاً بعد إثبات سلوك التحديث والإلغاء.'),
    body: <><div className="formrow"><label className="label">{L('Subscription link (iCal)', 'رابط الاشتراك (iCal)')}</label>{" "}<input className="input mono" readOnly dir="ltr" defaultValue="webcal://parishlife.app/saint-elias/cal.ics" /></div>{" "}<div className="stack" style={{
        gap: "10px"
      }}><C.CheckRow label={L('Masses and services', 'القداديس والخدم')} checked={true} />{" "}<C.CheckRow label={L('My volunteer assignments', 'مناوباتي')} checked={true} />{" "}<C.CheckRow label={L('Private group meetings', 'اجتماعات المجموعات الخاصة')} /></div>{" "}<div className="divider" />{" "}<div className="row" style={{
        gap: "8px"
      }}><button className="btn btn-secondary btn-dense" data-act="export">{L('Download .ics', 'تنزيل .ics')}</button>{" "}<button className="btn btn-secondary btn-dense" data-act="ics">{L('Google Calendar', 'رزنامة غوغل')}</button>{" "}<button className="btn btn-secondary btn-dense" data-act="ics">{L('Outlook', 'أوتلوك')}</button></div></>
  }));
  host.querySelector('#printweek')?.addEventListener('click', printWeekDialog);
};
function useEventTemplate(id) {
  const tpl = EVENT_TEMPLATES.find(x => x.id === id);
  if (!tpl) return;
  const date = S.ui.calDay || iso(TODAY);
  eventDrawer(null, true, {
    title: tpl.name,
    titleAr: tpl.nameAr,
    kind: tpl.kind,
    venue: tpl.venue,
    d: date,
    t: '12:00',
    to: addMin('12:00', Number(tpl.duration) || 60),
    templateId: id
  });
}
function eventTemplateDrawer(id) {
  const tpl = EVENT_TEMPLATES.find(x => x.id === id);
  openDrawer({
    title: tpl ? L('Edit calendar template', 'تعديل قالب الرزنامة') : L('New calendar template', 'قالب رزنامة جديد'),
    sub: L('Changes affect future events only.', 'تؤثر التغييرات في الأحداث المستقبلية فقط.'),
    body: <><C.Field label={L('Name', 'الاسم')} req={true} id='ct_name' value={tpl?.name || ''} />{" "}<C.Field label={L('Arabic name', 'الاسم العربي')} id='ct_ar' value={tpl?.nameAr || ''} />{" "}<div className="formgrid"><div className="formrow"><label className="label" htmlFor="ct_kind">{L('Category', 'الفئة')}</label><Select id="ct_kind">{[['event', 'Parish event', 'حدث رعوي'], ['mass', 'Mass', 'قدّاس'], ['group', 'Group', 'مجموعة'], ['sacr', 'Sacrament', 'سرّ']].map(([v, en, ar]) => <option value={v} selected={!!(tpl?.kind === v)}>{L(en, ar)}</option>)}</Select></div>{" "}<div className="formrow"><label className="label" htmlFor="ct_venue">{L('Default room', 'القاعة الافتراضية')}</label><Select id="ct_venue">{VENUES.map(v => <option value={v.id} selected={!!(tpl?.venue === v.id)}>{L(v.name, v.ar)}</option>)}</Select></div></div>{" "}<C.Stepper label={L('Duration in minutes', 'المدة بالدقائق')} value={tpl?.duration || 60} id='ct_duration' />{" "}<C.Textarea label={L('Default description', 'الوصف الافتراضي')} id='ct_desc' value={tpl?.description || ''} max={400} /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="ct_save" style={{
        marginInlineStart: "auto"
      }}>{L('Save template', 'حفظ القالب')}</button></>,
    onMount(el) {
      el.querySelector('#ct_save').addEventListener('click', () => {
        if (!F.need(el, '#ct_name', L('Name the template', 'سمّ القالب'))) return;
        const kind = el.querySelector('#ct_kind').value,
          name = el.querySelector('#ct_name').value.trim();
        const fields = {
          name,
          nameAr: el.querySelector('#ct_ar').value.trim() || name,
          kind,
          icon: {
            mass: 'service',
            sacr: 'sacr',
            group: 'groups',
            event: 'events'
          }[kind],
          venue: el.querySelector('#ct_venue').value,
          duration: Math.max(1, Number(el.querySelector('#ct_duration').value) || 60),
          description: el.querySelector('#ct_desc').value.trim(),
          capacity: tpl?.capacity || 0
        };
        if (tpl) Object.assign(tpl, fields);else EVENT_TEMPLATES.push({
          id: 'et' + Date.now().toString(36),
          ...fields
        });
        closeOverlays();
        bus.refresh();
        toast(L('Template saved', 'حُفظ القالب'), '', 'success');
      });
    }
  });
}
function deleteEventTemplate(id) {
  const tpl = EVENT_TEMPLATES.find(x => x.id === id);
  if (!tpl) return;
  openModal({
    title: L('Delete template?', 'حذف القالب؟'),
    body: <><p>{L(tpl.name, tpl.nameAr)}</p><p className="t-caption dim">{L('Events already made from it will stay unchanged.', 'الأحداث المنشأة منه ستبقى بلا تغيير.')}</p></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Keep template', 'إبقاء القالب')}</button><button className="btn btn-danger" id="ct_confirm">{L('Delete template', 'حذف القالب')}</button></>,
    onMount(el) {
      el.querySelector('#ct_confirm').addEventListener('click', () => {
        EVENT_TEMPLATES.splice(EVENT_TEMPLATES.indexOf(tpl), 1);
        closeOverlays();
        bus.refresh();
        toast(L('Template deleted', 'حُذف القالب'), '', 'success');
      });
    }
  });
}
function eventDrawer(id, isNew = false, pre = null) {
  const e = EVENTS.find(x => x.id === id);
  if (!isNew && !e) return;
  const d = e ? eventInfo(e) : null,
    ed = pre?.id ? eventInfo(pre) : null;
  const initialWedding = ed?.subtype === 'wedding' || /wedding/i.test(pre?.title || '') || /إكليل/.test(pre?.titleAr || '');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  if (isNew) return openDrawer({
    large: true,
    title: pre?.id ? L('Edit event', 'تعديل الحدث') : L('New event', 'حدث جديد'),
    sub: L('Choose the date, time, room, and visibility. Room conflicts appear beside the time fields.', 'اختر التاريخ والوقت والقاعة والظهور. تظهر تعارضات القاعة قرب حقول الوقت.'),
    body: <><C.Field label={L('Title', 'العنوان')} req={true} id='ev_t' value={pre ? L(pre.title, pre.titleAr) : ''} ph={L('Parish lunch', 'غداء الرعية')} />{" "}<div className="formgrid"><div className="formrow"><label className="label" htmlFor="ev_template">{L('Template', 'القالب')}</label>{" "}<Select id="ev_template"><option value="">{L('None', 'بلا')}</option>{EVENT_TEMPLATES.map(x => <option value={x.id} selected={!!(pre?.templateId === x.id)}>{L(x.name, x.nameAr)}</option>)}</Select></div>{" "}<div className="formrow"><label className="label">{L('Category', 'الفئة')}</label>{" "}<Select id="ev_cat">{[['event', 'Parish life', 'حياة الرعية'], ['mass', 'Worship', 'العبادة'], ['group', 'Formation', 'التنشئة'], ['sacr', 'Sacrament', 'سرّ']].map(([v, en, ar]) => <option value={v} selected={!!((pre?.kind || 'event') === v)}>{L(en, ar)}</option>)}</Select></div>{" "}<C.Field label={L('Date', 'التاريخ')} type='date' value={pre?.d || nextDate} id='ev_d' />{" "}<C.Field label={L('From', 'من')} type='time' value={pre?.t || '12:00'} id='ev_from' />{" "}<C.Field label={L('To', 'إلى')} type='time' value={pre?.to || '14:00'} id='ev_to' />{" "}<div id="evclash" style={{
          gridColumn: "1/-1"
        }} />{" "}<div className="formrow"><label className="label" htmlFor="ev_v">{L('Room', 'القاعة')}</label>{" "}<Select id="ev_v">{VENUES.map(v => <option value={v.id} selected={!!((pre?.venue || 'v3') === v.id)}>{L(v.name, v.ar)}</option>)}</Select></div></div>{" "}<C.Textarea label={L('Description', 'الوصف')} id='evdesc' max={400} value={ed ? L(ed.desc, ed.descAr) : EVENT_TEMPLATES.find(x => x.id === pre?.templateId)?.description || ''} />{" "}<div id="ev-subtype" hidden={!((pre?.kind || 'event') === 'sacr')} className="formrow"><label className="label" htmlFor="ev_subtype">{L('Sacrament event type', 'نوع حدث السرّ')}</label>{" "}<Select id="ev_subtype"><option value="">{L('Other sacrament', 'سرّ آخر')}</option><option value="wedding" selected={!!initialWedding}>{L('Wedding', 'إكليل')}</option></Select></div>{" "}<div id="ev-participants" hidden={!initialWedding}><div className="formgrid"><C.Field label={L('Person getting married — first', 'المتزوّج الأول')} id='ev_partner1' value={ed?.participants?.[0] || ''} />{" "}<C.Field label={L('Person getting married — second', 'المتزوّج الثاني')} id='ev_partner2' value={ed?.participants?.[1] || ''} /></div></div>{" "}<C.ChipField label={L('Required items', 'المستلزمات')} tags={(ed?.bring || []).map(([en, ar]) => L(en, ar))} />{" "}<div className="formgrid"><C.Stepper label={L('Capacity', 'السعة')} value={ed?.cap ?? EVENT_TEMPLATES.find(x => x.id === pre?.templateId)?.capacity ?? 60} id='evcap' />{" "}<div className="formrow"><label className="label" htmlFor="ev_visibility">{L('Visibility', 'الظهور')}</label>{" "}<Select id="ev_visibility"><option value="public" selected={!!(!ed?.visibility || ed.visibility === 'public')}>{L('Public — parish calendar', 'عام — رزنامة الرعية')}</option><option value="groups" selected={!!(ed?.visibility === 'groups')}>{L('Selected groups only', 'للمجموعات المحدّدة فقط')}</option><option value="confidential" selected={!!(ed?.visibility === 'confidential')}>{L('Clergy and office only', 'للإكليروس والمكتب فقط')}</option></Select></div></div>{" "}<div id="ev-visible-groups" hidden={!(ed?.visibility === 'groups')}><label className="label">{L('Groups allowed to see this event', 'المجموعات المخوّلة رؤية الحدث')}</label>{" "}<div className="choice-grid">{GROUPS.map(g => <label className="row"><input type="checkbox" data-ev-group="" defaultValue={g.id} defaultChecked={!!ed?.visibleGroupIds?.includes(g.id)} /><span>{L(g.name, g.ar)}</span></label>)}</div></div>{" "}<div id="ev-priest-box" hidden={!((pre?.kind || 'event') === 'mass')}><label className="label">{L('Assigned priests', 'الكهنة المكلّفون')}</label>{" "}<div className="choice-grid">{PEOPLE.filter(p => p.status === 'clergy').map(p => <label className="row"><input type="checkbox" data-ev-priest="" defaultValue={p.id} defaultChecked={!!ed?.priestIds?.includes(p.id)} /><span>{p.lat} · {p.ar}</span></label>)}</div></div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="ok" style={{
        marginInlineStart: "auto"
      }}>{pre?.id ? L('Save changes', 'حفظ التعديلات') : L('Create event', 'إنشاء الحدث')}</button></>,
    onMount(el) {
      const v = sel => el.querySelector(sel).value;
      const updateFields = () => {
        const sacrament = v('#ev_cat') === 'sacr',
          wedding = sacrament && v('#ev_subtype') === 'wedding';
        el.querySelector('#ev-subtype').hidden = !sacrament;
        el.querySelector('#ev-participants').hidden = !wedding;
        el.querySelector('#ev-priest-box').hidden = v('#ev_cat') !== 'mass';
        el.querySelector('#ev-visible-groups').hidden = v('#ev_visibility') !== 'groups';
      };
      ['#ev_cat', '#ev_subtype', '#ev_visibility'].forEach(sel => el.querySelector(sel).addEventListener('change', updateFields));
      updateFields();
      el.querySelector('#ev_template').addEventListener('change', () => {
        const tpl = EVENT_TEMPLATES.find(x => x.id === v('#ev_template'));
        if (!tpl) return;
        el.querySelector('#ev_t').value = L(tpl.name, tpl.nameAr);
        el.querySelector('#ev_cat').value = tpl.kind;
        el.querySelector('#ev_v').value = tpl.venue;
        el.querySelector('#ev_to').value = addMin(v('#ev_from'), Number(tpl.duration) || 60);
        el.querySelector('#evdesc').value = tpl.description || '';
        el.querySelector('#evcap').value = tpl.capacity || 0;
        updateFields();
        showClash();
      });
      /* the room clash is checked as the date, times and room change, against every other event in that room */
      const clash = () => EVENTS.find(x => x.id !== pre?.id && x.venue === v('#ev_v') && x.d === v('#ev_d') && x.t < v('#ev_to') && v('#ev_from') < (x.to || addMin(x.t, x.kind === 'mass' ? 60 : 90)));
      const showClash = () => {
        const c = clash(),
          room = venue(v('#ev_v'));
        paint(el.querySelector('#evclash'), v('#ev_from') >= v('#ev_to') ? <C.InlineAlert tone='warning' title={L('The event ends before it starts', 'ينتهي الحدث قبل أن يبدأ')} body={L('Check the two times.', 'تحقّق من الوقتين.')} /> : c ? <C.InlineAlert tone='warning' title={L(`${room ? room.name : 'The room'} is taken`, `${room ? room.ar : 'القاعة'} محجوزة`)} body={L(`${c.title} is there from ${c.t}. Pick another room or time.`, `${c.titleAr} فيها من ${c.t}. اختر قاعة أو وقتاً آخر.`)} /> : <C.InlineAlert tone='success' title={L('No clash', 'لا تعارض')} body={L(`${room ? room.name : 'The room'} is free at that time.`, `${room ? room.ar : 'القاعة'} متاحة في ذلك الوقت.`)} />);
      };
      ['#ev_d', '#ev_from', '#ev_to', '#ev_v'].forEach(s2 => el.querySelector(s2).addEventListener('change', showClash));
      showClash();
      el.querySelector('#ok').addEventListener('click', () => {
        if (!F.need(el, '#ev_t', L('Give the event a title', 'أعطِ الحدث عنواناً'))) return;
        if (!F.need(el, '#ev_to', L('Ends before it starts', 'ينتهي قبل أن يبدأ'), to => to > v('#ev_from'))) return;
        const visibility = v('#ev_visibility'),
          visibleGroupIds = [...el.querySelectorAll('[data-ev-group]:checked')].map(x => x.value);
        if (visibility === 'groups' && !visibleGroupIds.length) return toast(L('Choose at least one group', 'اختر مجموعة واحدة على الأقل'), '', 'warning');
        const wedding = !el.querySelector('#ev-participants').hidden;
        const participants = wedding ? [v('#ev_partner1').trim(), v('#ev_partner2').trim()] : [];
        if (wedding && participants.some(x => !x)) return toast(L('Enter both people getting married', 'أدخل اسمي المتزوّجين'), '', 'warning');
        const title = v('#ev_t').trim(),
          dte = v('#ev_d'),
          tme = v('#ev_from');
        const fields = {
          d: dte,
          t: tme,
          to: v('#ev_to'),
          venue: v('#ev_v'),
          kind: v('#ev_cat'),
          templateId: v('#ev_template') || null
        };
        const desc = v('#evdesc').trim(),
          cap = +v('#evcap') || 0;
        const bring = [...el.querySelectorAll('[data-chipfield] .tag')].map(tag => tag.firstChild?.textContent?.trim()).filter(Boolean).map(label => [label, label]);
        const category = {
          event: ['Parish life', 'حياة الرعية'],
          mass: ['Worship', 'العبادة'],
          group: ['Formation', 'التنشئة'],
          sacr: ['Sacrament', 'سرّ']
        }[fields.kind];
        let ev;
        if (pre?.id) {
          ev = EVENTS.find(x => x.id === pre.id);
          const same = title === L(ev.title, ev.titleAr);
          Object.assign(ev, fields, same ? {} : {
            title,
            titleAr: title
          });
        } else EVENTS.push(ev = {
          id: 'ev' + Date.now().toString(36),
          title,
          titleAr: title,
          ...fields
        });
        EVENT_DETAIL[ev.id] ||= eventInfo(ev);
        Object.assign(EVENT_DETAIL[ev.id], {
          desc,
          descAr: desc,
          cat: category[0],
          catAr: category[1],
          cap,
          bring,
          visibility,
          visibleGroupIds: visibility === 'groups' ? visibleGroupIds : [],
          priestIds: fields.kind === 'mass' ? [...el.querySelectorAll('[data-ev-priest]:checked')].map(x => x.value) : [],
          subtype: wedding ? 'wedding' : '',
          participants
        });
        const target = new Date(dte);
        S.ui.calOffset = (target.getFullYear() - 2026) * 12 + target.getMonth() - 9;
        closeOverlays();
        bus.refresh();
        document.querySelectorAll(`#view [data-ev="${ev.id}"]`).forEach(x => x.classList.add('flash'));
        toast(pre?.id ? L('Event updated', 'حُدّث الحدث') : L('Event created', 'أُنشئ الحدث'), `${title} · ${fmtDate(dte)} ${tme}`, 'success');
      });
    }
  });
  openDrawer({
    large: true,
    title: L(e.title, e.titleAr),
    sub: `${fmtLong(new Date(e.d))} · ${e.t}${e.to ? `–${e.to}` : ''} · ${venue(e.venue) ? L(venue(e.venue).name, venue(e.venue).ar) : '—'}`,
    body: <><dl className="dl"><dt>{L('Organiser', 'المنظّم')}</dt><dd>{d.organizer && person(d.organizer) ? L(person(d.organizer).lat, person(d.organizer).ar) : '—'}</dd><dt>{L('Category', 'الفئة')}</dt><dd>{L(d.cat, d.catAr)}</dd><dt>{L('Time zone', 'المنطقة الزمنية')}</dt><dd className="mono">{d.tz}</dd><dt>{L('Visibility', 'الظهور')}</dt><dd>{d.visibility === 'groups' ? L('Selected groups', 'مجموعات محدّدة') : d.visibility === 'confidential' ? L('Clergy and office', 'الإكليروس والمكتب') : L('Public', 'عام')}</dd>{d.subtype === 'wedding' ? <><dt>{L('Getting married', 'المتزوّجون')}</dt><dd>{(d.participants || []).join(' & ') || L('Not recorded', 'غير مسجّل')}</dd></> : ''}{e.kind === 'mass' ? <><dt>{L('Assigned priests', 'الكهنة المكلّفون')}</dt><dd>{(d.priestIds || []).map(pid => person(pid)?.lat || pid).join(', ') || L('Unassigned', 'غير مسند')}</dd></> : ''}{d.tags.length ? <><dt>{L('Tags', 'الوسوم')}</dt><dd>{d.tags.map(x => <span className="chip" style={{
              marginInlineEnd: "6px"
            }}>{x}</span>)}</dd></> : ''}</dl>{" "}<h4 className="t-ui" style={{
        marginTop: "14px"
      }}>{L('Purpose and details', 'الغاية والتفاصيل')}</h4>{" "}{d.desc ? <p className="t-body dim" style={{
        fontSize: "14px",
        marginTop: "6px"
      }}>{L(d.desc, d.descAr)}</p> : <p className="help">{L('No purpose or details recorded.', 'لا غاية أو تفاصيل مسجّلة.')}</p>}{" "}<div className="divider" />{" "}<h4 className="t-ui" style={{
        marginBottom: "10px"
      }}>{L('RSVP', 'تأكيد الحضور')}</h4>{" "}<div className="grid g4" style={{
        gap: "10px"
      }}>{[[L('Yes', 'نعم'), d.rsvp.yes], [L('No', 'لا'), d.rsvp.no], [L('Maybe', 'ربما'), d.rsvp.maybe], [L('No reply', 'بلا ردّ'), d.rsvp.none]].map(([k, v]) => <div className="card card-flat" style={{
          padding: "12px"
        }}><div className="t-caption dim">{k}</div>{" "}<div style={{
            font: "600 20px/26px var(--sans)",
            fontVariantNumeric: "tabular-nums"
          }}>{v}</div></div>)}</div>{" "}{d.cap ? <><span className="meter" style={{
          marginTop: "12px"
        }}><i style={css(`width:${Math.min(100, Math.round(d.rsvp.yes / d.cap * 100))}%`)} /></span>{" "}<span className="t-caption dim" style={{
          display: "block",
          marginTop: "6px"
        }}>{d.rsvp.yes} / {d.cap}{" "}{L('places', 'مقعداً')} · {d.waiting}{" "}{L('on the waiting list', 'على لائحة الانتظار')}</span></> : ''}{" "}{d.bring.length ? <><div className="divider" />{" "}<h4 className="t-ui" style={{
          marginBottom: "10px"
        }}>{L('Required items', 'المستلزمات')}</h4>{" "}<div className="stack" style={{
          gap: "8px"
        }}>{d.bring.map(([en, ar]) => <C.CheckRow label={L(en, ar)} />)}</div></> : ''}{" "}<div className="divider" />{" "}<h4 className="t-ui" style={{
        marginBottom: "10px"
      }}>{L('Tasks', 'المهام')}</h4>{" "}{d.tasks.length ? '' : <p className="t-caption dim">{L('No tasks yet.', 'لا مهام بعد.')}</p>}{" "}{d.tasks.map(([en, ar, p, due, done], ti) => <div className={`listrow ${done ? 'is-done' : ''}`} style={{
        paddingInline: 0
      }}><Avatar p={person(p)} cls='avatar-sm' /><span className="grow"><b>{L(en, ar)}</b>{" "}<small className="mono">{done ? L('done', 'أُنجزت') : `${L('due', 'حتى')} ${fmtDate(due)}`}</small></span>{" "}<C.IconBtn ico='check' label={done ? L('Reopen', 'إعادة فتح') : L('Mark done', 'تعليم كمنجز')} data-act={`evtask-toggle:${e.id}|${ti}`} aria-pressed={!!done} /></div>)}{" "}<div className="divider" />{" "}<h4 className="t-ui" style={{
        marginBottom: "10px"
      }}>{L('Linked to', 'مرتبط بـ')}</h4>{" "}<div className="row" style={{
        gap: "8px",
        flexWrap: "wrap"
      }}>{nodesOr(REGISTRATIONS.filter(form => form.eventId === e.id).map(form => <a className="chip" href="#/registrations"><Icon name='registr' size={14} />{" "}{L(form.event, form.eventAr)}</a>), <span className="help">{L('No linked registration forms are recorded.', 'لا توجد استمارات تسجيل مرتبطة مسجّلة.')}</span>)}</div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}{is('priest', 'secretary') ? <><button className="btn btn-secondary" data-act={`event-dup:${e.id}`}>{L('Duplicate', 'نسخ')}</button>{" "}<button className="btn btn-danger-quiet" data-act={`event-cancel:${e.id}`}>{L('Cancel event', 'إلغاء الحدث')}</button>{" "}<button className="btn btn-primary" style={{
          marginInlineStart: "auto"
        }} id="evedit">{L('Edit', 'تعديل')}</button></> : ''}</>,
    onMount(el) {
      el.querySelector('#evedit')?.addEventListener('click', () => eventDrawer(e.id, true, e));
    }
  });
}

/* ═══════════════ 6 · service planning ═══════════════ */
const STABS = () => [['', 'This plan', 'هذه الخدمة'], ['requests', 'Requests', 'الطلبات', SERVICE_REQUESTS.filter(r => r.status === 'pending').length], ['templates', 'Templates', 'القوالب']];
export function services(tab = '', planId = '') {
  if (is('leader')) {
    const meetings = GROUPS.flatMap(g => groupInfo(g.id).meetings.map(m => ({
      g,
      m
    }))).sort((a, b) => (a.m.d + a.m.t).localeCompare(b.m.d + b.m.t));
    return <><PageHead crumbs={[{
        label: L('My ministry', 'خدمتي')
      }, {
        label: L('Services & Activities', 'الخدمات والأنشطة')
      }]} title={L('Services & Activities', 'الخدمات والأنشطة')} sub={L('Plan your group meetings and the music for each one.', 'خطّط لاجتماعات مجموعتك والموسيقى لكل اجتماع.')} actions={<button className="btn btn-primary" data-leader-meeting-new="" disabled={!GROUPS.length}><Icon name='plus' size={17} />{L('Add meeting', 'إضافة اجتماع')}</button>} /><div className="toolbar" style={{
        margin: "16px 0"
      }}><span className="t-caption dim">{L('Choose a group meeting to manage its details and attendance.', 'اختر اجتماع مجموعة لإدارة التفاصيل والحضور.')}</span></div>{" "}{GROUPS.map(g => <Panel title={L(g.name, g.ar)} tight={true}><Table cols={[{
          label: L('Meeting', 'الاجتماع')
        }, {
          label: L('When', 'الموعد')
        }, {
          label: L('Type / place', 'النوع / المكان')
        }, {
          label: L('Music', 'الموسيقى')
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={meetings.filter(row => row.g.id === g.id).map(({
          m
        }) => ({
          cells: [<b>{m.title || L('Ministry meeting', 'اجتماع الخدمة')}</b>, `${fmtDate(m.d)} · ${m.t}`, `${meetingKind(m)}${m.place ? ` · ${m.place}` : ''}`, (m.hymns || []).map(id => MUSIC.find(item => item.id === id)).filter(Boolean).map(h => L(h.title, h.ar)).join(', ') || '—', <a className="btn btn-secondary btn-dense" href={`#/groups/${g.id}/meetings`}>{L('Open meeting', 'افتح الاجتماع')}</a>]
        }))} /></Panel>)}{" "}{!meetings.length ? <Empty glyph='calendar' title={L('No meetings yet', 'لا اجتماعات بعد')} body={L('Schedule one from your group page.', 'جدول اجتماعاً من صفحة مجموعتك.')} /> : ''}</>;
  }
  const savedPlan = tab === 'plan' ? allPlans().find(p => p.id === planId) : null;
  if (tab === 'plan' && !savedPlan) return <><PageHead title={L('Plan not found', 'الخطة غير موجودة')} crumbs={[{
      label: L('Services & Activities', 'الخدمات والأنشطة'),
      href: '#/services'
    }]} /><a className="btn btn-secondary" href="#/services">{L('All plans', 'كل الخطط')}</a></>;
  const canEdit = is('priest', 'secretary');
  const plan = savedPlan ? canEdit ? workingPlan(savedPlan.id) : savedPlan : null;
  const cel = person(plan?.celebrant),
    coord = person(plan?.coordinator);
  const total = plan ? planTotalMinutes(plan) : 0;
  const head = <><PageHead crumbs={[{
      label: L('Parish life', 'حياة الرعية')
    }, {
      label: L('Services & Activities', 'الخدمات والأنشطة'),
      href: tab === 'plan' ? '#/services' : undefined
    }]} title={plan ? L(plan.title, plan.titleAr) : L('Services & Activities', 'الخدمات والأنشطة')} sub={!plan ? L('Choose a plan to open, or create one from a reusable template. Ceremonies are separate from official registers.', 'تُخطَّط الاحتفالات هنا؛ والسجل الرسمي يُنشأ منفصلاً في سجلات الأسرار') : `${fmtLong(new Date(plan.date))} · ${L(venue(plan.venue)?.name || '', venue(plan.venue)?.ar || '')} ·
                ${L(plan.language, plan.languageAr)} · ${total} ${L('minutes', 'دقيقة')}`} actions={plan ? <><a className="btn btn-secondary" href="#/services">{L('All plans', 'كل الخطط')}</a>{" "}<button className="btn btn-secondary" id="slides"><Icon name='doc' size={17} />{L('Generate slides', 'توليد العرض')}</button>{" "}<button className="btn btn-secondary" data-act="print"><Icon name='print' size={17} />{L('Print order', 'طباعة الترتيب')}</button>{" "}{canEdit ? <><button className="btn btn-secondary" data-plan-add=""><Icon name='plus' size={17} />{L('Add item', 'إضافة بند')}</button>{" "}<button className="btn btn-primary" data-plan-save="" disabled={!planDirty()}><Icon name='check' size={17} />{L('Save plan', 'حفظ الخطة')}</button></> : ''}</> : canEdit ? <button className="btn btn-primary" data-plan-new=""><Icon name='plus' size={17} />{L('New plan', 'خطة جديدة')}</button> : ''} />{plan ? '' : <TabBar base='services' items={STABS()} active={tab} />}</>;
  if (tab === '') {
    const f = S.ui.serviceFilter || {};
    const plans = allPlans().filter(p => (!f.status || p.status === f.status) && (!f.from || p.date >= f.from) && (!f.to || p.date <= f.to) && (!f.search || `${p.title} ${p.titleAr} ${venue(p.venue)?.name || ''}`.toLocaleLowerCase().includes(f.search.toLocaleLowerCase())));
    return <>{head}<div className="tabbody"><div className="toolbar" style={{
          marginBottom: "16px",
          gap: "10px",
          flexWrap: "wrap"
        }}><label className="formrow" style={{
            margin: 0,
            minWidth: "220px",
            flex: 1
          }}><span className="label">{L('Find a service', 'ابحث عن خدمة')}</span><input className="input" data-service-filter="search" defaultValue={f.search || ''} placeholder={L('Name or place', 'الاسم أو المكان')} /></label>{" "}<label className="formrow" style={{
            margin: 0
          }}><span className="label">{L('Status', 'الحالة')}</span><Select data-service-filter="status">{[['', 'All statuses', 'كل الحالات'], ['draft', 'Draft', 'مسودة'], ['scheduled', 'Scheduled', 'مجدول'], ['ready', 'Ready', 'جاهز'], ['completed', 'Completed', 'منجز']].map(([v, en, ar]) => <option value={v} selected={!!(f.status === v)}>{L(en, ar)}</option>)}</Select></label>{" "}<label className="formrow" style={{
            margin: 0
          }}><span className="label">{L('From', 'من')}</span><input className="input" type="date" data-service-filter="from" defaultValue={f.from || ''} /></label>{" "}<label className="formrow" style={{
            margin: 0
          }}><span className="label">{L('Through', 'حتى')}</span><input className="input" type="date" data-service-filter="to" defaultValue={f.to || ''} /></label></div>{" "}<p className="t-caption dim" style={{
          marginBottom: "10px"
        }}>{plans.length}{" "}{L('plans shown', 'خطط معروضة')}</p><Table cols={[{
          label: L('Service', 'الخدمة')
        }, {
          label: L('When', 'الموعد')
        }, {
          label: L('Type / room', 'النوع / المكان')
        }, {
          label: L('Status', 'الحالة')
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={plans.slice().sort((a, b) => a.date.localeCompare(b.date)).map(p => ({
          cells: [<b>{L(p.title, p.titleAr)}</b>, <span className="mono">{fmtDate(p.date)}{" "}{p.time || ''}</span>, `${L(venue(p.venue)?.name || '', venue(p.venue)?.ar || '')} · ${L(p.language, p.languageAr)}`, <Status k={p.status || 'scheduled'} />, <a className="btn btn-secondary btn-dense" href={`#/services/plan/${p.id}`}>{L('Open plan', 'فتح الخطة')}</a>]
        }))} /></div></>;
  }
  if (tab === 'requests') return <>{head}<div className="tabbody"><Table cols={[{
        label: L('Ceremony', 'الاحتفال')
      }, {
        label: L('Requested by', 'مقدَّم من')
      }, {
        label: L('Date', 'التاريخ')
      }, {
        label: L('Preparation', 'التحضير'),
        cls: 'hide-sm'
      }, {
        label: L('Status', 'الحالة'),
        cls: 'shrink'
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={SERVICE_REQUESTS.map(r => ({
        cells: [<b>{L(r.kind, r.kindAr)}</b>, <Who p={person(r.by)} />, <span className="mono dim">{fmtDate(r.date)}</span>, r.prep === 'complete' ? <Pill label={L('Complete', 'مكتمل')} tone='success' /> : <Pill label={L(r.prep, r.prepAr || r.prep)} tone='warning' />, <Status k={r.status} />, <button className="btn btn-secondary btn-dense" data-act={`svc-request:${r.id}`}>{L('Open', 'فتح')}</button>]
      }))} />{" "}<div className="tabbody"><Panel title={L('Request a ceremony', 'طلب احتفال')}><Paged className="gridcards">{[['Mass', 'قدّاس', 'service'], ['Wedding', 'إكليل', 'sacr'], ['Baptism', 'معمودية', 'sacr'], ['Funeral', 'جنّاز', 'sacr'], ['Prayer meeting', 'لقاء صلاة', 'groups'], ['Retreat', 'خلوة', 'events'], ['Special celebration', 'احتفال خاص', 'events']].map(([en, ar, ic]) => <button className="card card-flat" style={{
              cursor: "pointer",
              textAlign: "start"
            }} data-act={`svc-request-new:${en}|${ar}`}><div className="row" style={{
                gap: "10px"
              }}><Icon name={ic} size={19} cls='dimmer' /><b style={{
                  font: "500 14px/20px var(--sans)"
                }}>{L(en, ar)}</b></div></button>)}</Paged></Panel></div></div></>;
  if (tab === 'templates') return <>{head}<div className="tabbody"><div className="toolbar" style={{
        marginBottom: "12px"
      }}><span className="t-caption dim">{L('Using a template creates an independent plan.', 'استعمال القالب ينشئ خطة مستقلة.')}</span>{" "}{canEdit ? <button className="btn btn-primary btn-dense" data-service-template-new=""><Icon name='plus' size={15} />{L('New template', 'قالب جديد')}</button> : ''}</div><Table cols={[{
        label: L('Template', 'القالب')
      }, {
        label: L('Items', 'البنود'),
        cls: 'num'
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={SERVICE_TEMPLATES.map(tpl => ({
        cells: [<b>{L(tpl.name, tpl.ar)}</b>, <span className="num">{tpl.order?.length || 0}</span>, <span className="row" style={{
          gap: "6px",
          justifyContent: "flex-end"
        }}>{canEdit ? <><button className="btn btn-secondary btn-dense" data-act={`svc-tpl:${tpl.id}`}>{L('Use', 'استعمال')}</button>{" "}<C.IconBtn ico='edit' label={L('Edit template', 'تعديل القالب')} data-service-template-edit={tpl.id} />{" "}<C.IconBtn ico='trash' label={L('Delete template', 'حذف القالب')} data-service-template-delete={tpl.id} /></> : ''}</span>]
      }))} /></div></>;
  const rows = plan.order.map((o, oi) => {
    const a = o.who?.startsWith('g') ? group(o.who) : person(o.who);
    const aLabel = !a ? '' : a.lat ? isAr() ? a.ar : a.lat : L(a.name, a.ar);
    return <div className="oos-row" data-service-row={oi} draggable={canEdit ? "true" : undefined} style={{
      padding: "14px 16px",
      minHeight: "70px",
      gap: "14px"
    }}><span className="dur">{oi + 1}. {o.start || '—'} · {o.dur}'</span>{" "}<span className="body"><b>{o.t}</b><span className="ar">{o.ar}</span>{" "}{o.note ? <span className="note">{L(o.note, o.noteAr || o.note)}</span> : ''}</span>{" "}<span className="who-s">{a && a.lat ? <Avatar p={a} cls='avatar-sm' /> : ''}<span className="t-caption dim">{aLabel}</span>{" "}{canEdit ? <>{<C.IconBtn ico='chevD' label={L('Move up', 'نقل للأعلى')} {...htmlAttrs(`data-svc-step="${oi}|-1" style="transform:rotate(180deg)" ${oi ? '' : 'disabled'}`)} />}{" "}{<C.IconBtn ico='chevD' label={L('Move down', 'نقل للأسفل')} {...htmlAttrs(`data-svc-step="${oi}|1" ${oi < plan.order.length - 1 ? '' : 'disabled'}`)} />}{" "}{<C.IconBtn ico='edit' label={L('Edit item', 'تعديل البند')} data-plan-item={oi} />}</> : ''}</span></div>;
  });
  return <>{head}<div className="splitview"><div>{canEdit ? <div className="row" style={{
          gap: "8px",
          marginBottom: "10px"
        }}><span className={`pill ${planDirty() ? 'pill-warning' : 'pill-success'}`} aria-live="polite">{planDirty() ? L('Unsaved changes', 'تغييرات غير محفوظة') : L('All changes saved', 'كل التغييرات محفوظة')}</span>{" "}<span className="t-caption dim">{L('Total planned duration', 'المدة الإجمالية للخطة')}: {total}{" "}{L('minutes', 'دقيقة')}</span></div> : ''}{" "}<Panel title={L('Order of service', 'ترتيب الخدمة')} tight={true} more={canEdit ? <button className="btn btn-ghost btn-dense" data-save-template="">{L('Save as template', 'حفظ كقالب')}</button> : ''}>{rows || <p className="t-caption dim">{L('No items yet. Add one or start from a template.', 'لا بنود بعد. أضف بنداً أو ابدأ من قالب.')}</p>}</Panel>{" "}{canEdit ? <p className="t-caption dim" style={{
          marginTop: "6px"
        }}>{L('Items follow their scheduled times. Drag or use the arrow buttons to change the order; then choose Save plan.', 'تتبع البنود أوقاتها المحدّدة. اسحب أو استخدم الأسهم لتغيير الترتيب، ثم اختر حفظ الخطة.')}</p> : ''}</div>{" "}<div className="sidecol"><Panel title={L('Details', 'التفاصيل')} more={<>{canEdit ? <button className="btn btn-ghost btn-dense" data-plan-edit="">{L('Edit details', 'تعديل التفاصيل')}</button> : ''}<a href="#/volunteers">{L('Open rota', 'افتح المناوبات')}</a></>} tight={true}><dl className="dl"><dt>{L('Date and time', 'التاريخ والوقت')}</dt><dd>{fmtDate(plan.date)}{" "}{plan.time || ''}</dd><dt>{L('Venue', 'المكان')}</dt><dd>{L(venue(plan.venue)?.name || '—', venue(plan.venue)?.ar || '—')}</dd><dt>{L('Celebrant', 'المحتفل')}</dt><dd>{cel ? isAr() ? cel.ar : cel.lat : '—'}</dd><dt>{L('Coordinator', 'المنسّقة')}</dt><dd>{coord ? isAr() ? coord.ar : coord.lat : '—'}</dd><dt>{L('Language', 'اللغة')}</dt><dd>{L(plan.language, plan.languageAr)}</dd><dt>{L('Status', 'الحالة')}</dt><dd><Status k={plan.status || 'scheduled'} /></dd></dl></Panel></div></div></>;
}
services.mount = host => {
  if (S.params[0] === 'requests' && S.params[1] && !is('leader')) F.svcRequestOpen(decodeURIComponent(S.params[1]));
  host.querySelectorAll('[data-service-filter]').forEach(input => input.addEventListener(input.type === 'text' ? 'input' : 'change', () => {
    const key = input.dataset.serviceFilter,
      value = input.value,
      pos = input.selectionStart;
    S.ui.serviceFilter = {
      ...(S.ui.serviceFilter || {}),
      [key]: value
    };
    paint(host, services(''));
    services.mount(host);
    if (input.type === 'text') {
      const replacement = host.querySelector(`[data-service-filter="${key}"]`);
      replacement?.focus();
      replacement?.setSelectionRange(pos, pos);
    }
  }));
  if (is('leader')) {
    host.querySelector('[data-leader-meeting-new]')?.addEventListener('click', () => {
      if (GROUPS.length === 1) return F.meetingNew(GROUPS[0].id);
      openModal({
        title: L('Choose ministry', 'اختر الخدمة'),
        body: <Paged className="gridcards">{GROUPS.map(g => <button className="panel card-link" style={{
            cursor: "pointer",
            textAlign: "start",
            padding: "18px"
          }} data-leader-group={g.id}><b>{L(g.name, g.ar)}</b></button>)}</Paged>,
        foot: <button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>,
        onMount(el) {
          el.querySelectorAll('[data-leader-group]').forEach(button => button.addEventListener('click', () => {
            closeOverlays();
            F.meetingNew(button.dataset.leaderGroup);
          }));
        }
      });
    });
    return;
  }
  const redraw = () => {
    if (S.route === 'services' && S.params[0] === 'plan') {
      paint(host, services(...S.params));
      services.mount(host);
    }
  };
  host.querySelector('[data-plan-new]')?.addEventListener('click', () => F.servicePlanNew());
  host.querySelector('[data-plan-edit]')?.addEventListener('click', () => editPlanDetails(redraw));
  host.querySelector('[data-plan-add]')?.addEventListener('click', () => editPlanItem(-1, redraw));
  host.querySelectorAll('[data-plan-item]').forEach(b => b.addEventListener('click', () => editPlanItem(Number(b.dataset.planItem), redraw)));
  host.querySelector('[data-plan-save]')?.addEventListener('click', async () => {
    const button = host.querySelector('[data-plan-save]');
    if (button) button.disabled = true;
    if (await savePlanDraft()) {
      redraw();
      toast(L('Plan saved', 'حُفظت الخطة'), '', 'success');
    } else {
      if (button) button.disabled = false;
      toast(L('Plan was not saved', 'لم تُحفظ الخطة'), L('Check the save error and retry.', 'تحقّق من خطأ الحفظ وأعد المحاولة.'), 'danger');
    }
  });
  host.querySelector('[data-save-template]')?.addEventListener('click', () => {
    if (planDirty()) return toast(L('Save the plan first', 'احفظ الخطة أولاً'), L('The template will use the saved order.', 'سيستخدم القالب الترتيب المحفوظ.'), 'warning');
    F.serviceTemplateEdit('', true);
  });
  host.querySelector('[data-service-template-new]')?.addEventListener('click', () => F.serviceTemplateEdit());
  host.querySelectorAll('[data-service-template-edit]').forEach(b => b.addEventListener('click', () => F.serviceTemplateEdit(b.dataset.serviceTemplateEdit)));
  host.querySelectorAll('[data-service-template-delete]').forEach(b => b.addEventListener('click', () => F.serviceTemplateDelete(b.dataset.serviceTemplateDelete)));
  host.querySelectorAll('[data-svc-step]').forEach(b => b.addEventListener('click', () => {
    const [i, delta] = b.dataset.svcStep.split('|').map(Number),
      order = workingPlan(S.params[1]).order,
      j = i + delta;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    normalizePlanOrder(workingPlan(S.params[1]), 'reflow');
    redraw();
    host.querySelector(`[data-svc-step="${j}|${delta}"]`)?.focus();
  }));
  let dragged = -1;
  host.querySelectorAll('[data-service-row]').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragged = Number(row.dataset.serviceRow);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragged));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
      const to = Number(row.dataset.serviceRow),
        order = workingPlan(S.params[1]).order;
      if (dragged < 0 || dragged === to || !order[dragged]) return;
      order.splice(to, 0, ...order.splice(dragged, 1));
      dragged = -1;
      normalizePlanOrder(workingPlan(S.params[1]), 'reflow');
      redraw();
    });
    row.addEventListener('dragend', () => {
      dragged = -1;
    });
  });
  host.querySelector('#slides')?.addEventListener('click', () => {
    if (planDirty()) return toast(L('Save the plan first', 'احفظ الخطة أولاً'), L('Slides use the saved order.', 'تستخدم الشرائح الترتيب المحفوظ.'), 'warning');
    F.slides();
  });
};
function editPlanDetails(redraw) {
  const plan = workingPlan(S.params[1]);
  if (!plan) return;
  openDrawer({
    title: L('Edit plan details', 'تعديل تفاصيل الخطة'),
    body: <><div className="formgrid"><C.Field label={L('Service name', 'اسم الخدمة')} id='pd_title' req={true} value={plan.title} />{" "}<C.Field label={L('Arabic name', 'الاسم العربي')} id='pd_ar' value={plan.titleAr} /></div>{" "}<div className="formgrid"><C.Field label={L('Date', 'التاريخ')} id='pd_date' type='date' value={plan.date} />{" "}<C.Field label={L('Start time', 'وقت البدء')} id='pd_time' type='time' value={plan.time || '09:00'} /></div>{" "}<div className="formrow"><label className="label" htmlFor="pd_venue">{L('Venue', 'المكان')}</label><Select id="pd_venue">{VENUES.map(v => <option value={v.id} selected={!!(v.id === plan.venue)}>{L(v.name, v.ar)}</option>)}</Select></div>{" "}<div className="formrow"><label className="label" htmlFor="pd_status">{L('Status', 'الحالة')}</label><Select id="pd_status">{[['draft', 'Draft', 'مسودة'], ['scheduled', 'Scheduled', 'مجدول'], ['ready', 'Ready', 'جاهز'], ['completed', 'Completed', 'منجز']].map(([v, en, ar]) => <option value={v} selected={!!(v === plan.status)}>{L(en, ar)}</option>)}</Select></div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="pd_stage">{L('Apply changes', 'تطبيق التغييرات')}</button></>,
    onMount(el) {
      el.querySelector('#pd_stage').addEventListener('click', () => {
        if (!F.need(el, '#pd_title', L('Name the plan', 'سمّ الخطة')) || !F.need(el, '#pd_date', L('Choose a date', 'اختر التاريخ'))) return;
        const oldTime = plan.time;
        Object.assign(plan, {
          title: el.querySelector('#pd_title').value.trim(),
          titleAr: el.querySelector('#pd_ar').value.trim() || el.querySelector('#pd_title').value.trim(),
          date: el.querySelector('#pd_date').value,
          time: el.querySelector('#pd_time').value,
          venue: el.querySelector('#pd_venue').value,
          status: el.querySelector('#pd_status').value
        });
        if (plan.time !== oldTime) normalizePlanOrder(plan, 'reflow');
        closeOverlays();
        redraw();
      });
    }
  });
}
function editPlanItem(index, redraw) {
  const plan = workingPlan(S.params[1]);
  if (!plan) return;
  const item = index >= 0 ? plan.order[index] : null;
  const last = plan.order.at(-1),
    after = last ? addMin(last.start || plan.time || '09:00', Number(last.dur) || 1) : plan.time || '09:00';
  openDrawer({
    title: item ? L('Edit service item', 'تعديل بند الخدمة') : L('Add service item', 'إضافة بند للخدمة'),
    body: <><div className="formgrid"><C.Field label={L('English item', 'البند بالإنكليزية')} id='pi_title' req={true} value={item?.t || ''} />{" "}<C.Field label={L('Arabic item', 'البند بالعربية')} id='pi_ar' value={item?.ar || ''} /></div>{" "}<div className="formgrid"><C.Field label={L('Scheduled time', 'الوقت المحدّد')} id='pi_start' type='time' value={item?.start || after} />{" "}<C.Field label={L('Duration (minutes)', 'المدة (دقائق)')} id='pi_dur' type='number' value={item?.dur || 3} /></div>{" "}<div className="formrow"><label className="label" htmlFor="pi_who">{L('Led by', 'يقوده')}</label><Select id="pi_who"><option value="">{L('Unassigned', 'غير محدّد')}</option>{[...GROUPS.map(g => [g.id, L(g.name, g.ar)]), ...personOptions()].map(([id, name]) => <option value={id} selected={!!(id === item?.who)}>{name}</option>)}</Select></div>{" "}<C.Field label={L('Instructions', 'تعليمات')} id='pi_note' value={item?.note || ''} /></>,
    foot: <>{item ? <button className="btn btn-danger-quiet" id="pi_delete">{L('Remove item', 'إزالة البند')}</button> : ''}{" "}<button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="pi_stage">{L('Apply changes', 'تطبيق التغييرات')}</button></>,
    onMount(el) {
      el.querySelector('#pi_stage').addEventListener('click', () => {
        if (!F.need(el, '#pi_title', L('Name the item', 'سمّ البند')) || !F.need(el, '#pi_dur', L('Enter a positive duration', 'أدخل مدة موجبة'), v => Number(v) > 0)) return;
        const t = el.querySelector('#pi_title').value.trim(),
          note = el.querySelector('#pi_note').value.trim();
        const fields = {
          t,
          ar: el.querySelector('#pi_ar').value.trim() || t,
          start: el.querySelector('#pi_start').value,
          dur: String(Number(el.querySelector('#pi_dur').value)),
          who: el.querySelector('#pi_who').value,
          note,
          noteAr: item?.note === note ? item.noteAr || note : note
        };
        if (item) Object.assign(item, fields);else plan.order.push(fields);
        normalizePlanOrder(plan, 'sort');
        closeOverlays();
        redraw();
      });
      el.querySelector('#pi_delete')?.addEventListener('click', () => {
        plan.order.splice(index, 1);
        normalizePlanOrder(plan, 'sort');
        closeOverlays();
        redraw();
      });
    }
  });
}
function personOptions() {
  return PEOPLE.filter(p => p.status !== 'visitor').map(p => [p.id, L(p.lat, p.ar)]);
}

/* ═══════════════ 3 · groups ═══════════════ */
function groupCards(items, tab = '') {
  return items.map(g => {
    const leader = person(g.leader);
    const visTone = g.vis === 'confidential' ? 'danger' : g.vis === 'private' ? 'warning' : '';
    const visLabel = g.vis === 'confidential' ? L('Confidential', 'سرّي') : g.vis === 'private' ? L('Private', 'خاص') : L('Public', 'عام');
    return <section className="panel card-link" data-find-item=""><div className="panel-b"><div className="row" style={{
          gap: "10px",
          alignItems: "flex-start"
        }}><span className="avatar avatar-lg"><Icon name='groups' size={20} /></span>{" "}<div style={{
            flex: 1,
            minWidth: 0
          }}><a className="stretch" href={`#/groups/${g.id}${tab ? `/${tab}` : ''}`}><b style={{
                display: "block",
                font: "600 16px/22px var(--sans)"
              }}>{L(g.name, g.ar)}</b></a>{" "}<small className="t-caption dim">{L(g.cat, g.catAr)}{g.meets ? ` · ${L(g.meets, g.meetsAr)}` : ''}</small></div>{" "}{!is('leader') ? CR.recBtn('group', g.id) : ''}</div>{" "}<div className="divider" />{" "}<div className="row" style={{
          gap: "10px"
        }}><Who p={leader} /><span className="row" style={{
            gap: "8px",
            marginInlineStart: "auto"
          }}><Pill label={visLabel} tone={visTone} mark={g.vis === 'public' ? true : 'lock'} />{" "}<span className="badge badge-quiet" title={L('members', 'أعضاء')}>{g.members}</span></span></div></div></section>;
  });
}
export function groups(id, tab) {
  if (id) return groupDetail(id, tab || '');
  const cards = groupCards(GROUPS); // the API has already scoped leaders to their own groups

  return <><PageHead crumbs={[{
      label: is('leader') ? L('My ministry', 'خدمتي') : L('Parish life', 'حياة الرعية')
    }, {
      label: L('Groups', 'المجموعات')
    }]} title={is('leader') ? L('My groups', 'مجموعاتي') : L('Groups and ministries', 'المجموعات والخدم')} sub={is('leader') ? L('You see only the groups you lead.', 'ترين فقط المجموعات التي تقودينها.') : L('Youth, choirs, brotherhoods, catechism classes and committees — each with its own leader, roster and visibility.', 'شبيبة وجوقات وأخويّات وصفوف تعليم ولجان — لكلٍّ مسؤولها ولائحتها ومستوى ظهورها.')} actions={<>{is('secretary') ? '' : <button className="btn btn-secondary" id="qr"><Icon name='qr' size={17} />{L('Signup QR', 'رمز التسجيل')}</button>}{" "}{!is('leader') ? <button className="btn btn-primary" data-act="group-new"><Icon name='plus' size={17} />{L('New group', 'مجموعة جديدة')}</button> : ''}</>} />{" "}<Paged className="gridcards">{cards}</Paged>{" "}<p className="t-caption dim" style={{
      marginTop: "20px"
    }}>{is('secretary') ? L('Open a group to find its members, roles, contact information, meetings and resources.', 'افتح المجموعة للاطلاع على أعضائها وأدوارهم ومعلومات التواصل والاجتماعات والموارد.') : L('People are placed into roles, not roles into people. When a leader hands over, the ongoing tasks follow the role to whoever takes it.', 'يوضع الأشخاص في الأدوار لا الأدوار في الأشخاص. وعند التسليم تنتقل المهام الجارية مع الدور إلى من يتسلّمه.')}</p></>;
}
const GTABS = () => is('secretary') ? [['roster', 'Members & contacts', 'الأعضاء والتواصل'], ['meetings', 'Meetings', 'الاجتماعات'], ['belongings', 'Resources', 'الموارد']] : [['', 'Overview', 'نظرة عامة'], ['roster', 'Roster', 'اللائحة'], ['attendance', 'Attendance', 'الحضور'], ['meetings', 'Meetings', 'الاجتماعات'], ['posts', 'Posts & files', 'المنشورات والملفات'], ['belongings', 'Resources', 'الموارد'], ['tasks', 'Tasks', 'المهام'], ['formation', 'Formation', 'التنشئة'], ['history', 'History', 'السجل']];
function groupGone() {
  return <>{<PageHead crumbs={[{
      label: L('Groups', 'المجموعات'),
      href: '#/groups'
    }]} title={L('Group not found', 'المجموعة غير موجودة')} />}{" "}{<Empty glyph='groups' title={L('This group no longer exists', 'هذه المجموعة لم تعد موجودة')} body={L('It may have been deleted. Its members keep their records.', 'ربما حُذفت. ويحتفظ أعضاؤها بسجلاتهم.')} action={<a className="btn btn-primary btn-dense" href="#/groups">{L('All groups', 'كل المجموعات')}</a>} />}</>;
}
function meetingAttendance(m) {
  const values = Object.values(m.attendance || {});
  if (values.length) return {
    present: Math.max(m.present || 0, values.filter(value => value === 'present').length),
    excused: values.filter(value => value === 'excused').length + (m.absent || []).filter(([pid]) => !(pid in (m.attendance || {}))).length,
    absent: values.filter(value => value === 'absent').length
  };
  return {
    present: m.present || 0,
    excused: (m.absent || []).length,
    absent: 0
  };
}
function meetingCard(g, m) {
  const date = new Date(`${m.d}T12:00:00`);
  const monthLabel = new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', {
    month: 'short'
  }).format(date);
  const upcoming = !m.done && m.d >= iso(new Date());
  const rsvp = m.rsvp || {};
  const counts = meetingAttendance(m);
  return <section className="meeting-card"><div className="meeting-date"><strong>{new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', {
          day: 'numeric'
        }).format(date)}</strong><span>{monthLabel}</span></div>{" "}<div className="meeting-content"><div className="meeting-heading"><div><p className="meeting-eyebrow">{fmtLong(date)}</p>{" "}<h3>{m.title || L('Group meeting', 'اجتماع المجموعة')}</h3><p className="meeting-time">{meetingKind(m)} · <Icon name='events' size={15} /><span dir="ltr">{m.t || '—'}{m.end ? `–${m.end}` : ''}</span>{m.place ? ` · ${m.place}` : ''}</p></div>{" "}<div className="meeting-heading-actions">{m.done ? <Status k='closed' /> : upcoming ? <Status k='scheduled' /> : <Pill label={is('secretary') ? L('Past meeting', 'اجتماع سابق') : L('Attendance needed', 'الحضور مطلوب')} tone='warning' />}{" "}<C.IconBtn ico='edit' label={L('Edit meeting', 'تعديل الاجتماع')} data-meeting-edit={meetingId(m)} /></div></div>{" "}{is('secretary') ? '' : <div className="meeting-summary">{m.done ? <>{attendanceTag('present', counts.present)}{attendanceTag('excused', counts.excused)}{attendanceTag('absent', counts.absent)}</> : upcoming ? <><span className="meeting-rsvp"><b>{Number(rsvp.yes) || 0}</b>{L('Going', 'سيحضرون')}</span><span className="meeting-rsvp"><b>{Number(rsvp.no) || 0}</b>{L('Not going', 'لن يحضروا')}</span><span className="meeting-rsvp"><b>{Number(rsvp.none) || 0}</b>{L('No reply', 'بلا ردّ')}</span></> : <span className="t-caption dim">{L('Record attendance to close this meeting.', 'سجّل الحضور لإقفال هذا الاجتماع.')}</span>}</div>}{" "}{m.description ? <p className="meeting-description">{m.description}</p> : ''}{" "}{m.hymns?.length ? <p className="meeting-description">{L('Music', 'الموسيقى')}: {m.hymns.map(id => MUSIC.find(h => h.id === id)).filter(Boolean).map(h => L(h.title, h.ar)).join(', ')}</p> : ''}{" "}{!is('secretary') && m.done && m.absent?.length ? <details className="meeting-details"><summary>{L('Excused absence details', 'تفاصيل الغياب بعذر')}</summary>{" "}{m.absent.map(([pid, en, ar]) => <p>{L(person(pid)?.lat || pid, person(pid)?.ar || pid)} · {L(en, ar)}</p>)}</details> : ''}{" "}<div className="meeting-actions">{upcoming ? <button className="btn btn-secondary btn-dense" data-act="remind:group">{L('Send reminder', 'إرسال تذكير')}</button> : ''}{" "}{is('secretary') ? '' : <button className="btn btn-primary btn-dense" data-meeting-review={meetingId(m)}>{m.done ? L('Review attendance', 'مراجعة الحضور') : L('Take attendance', 'تسجيل الحضور')}</button>}</div></div></section>;
}
function groupDetail(id, tab) {
  const g = group(id);
  if (!g) return groupGone();
  const d = groupInfo(g.id);
  if (is('secretary') && !['roster', 'meetings', 'belongings'].includes(tab)) tab = 'roster';
  const head = <><div className="pagehead"><div className="entityhead" style={{
        width: "100%"
      }}><div className="id"><nav className="crumbs"><a href="#/groups">{L('Groups', 'المجموعات')}</a><span className="sep">/</span><span>{L(g.name, g.ar)}</span></nav>{" "}<h1 style={{
            font: "600 26px/34px var(--sans)",
            letterSpacing: "-.02em"
          }}>{L(g.name, g.ar)}{" "}<Pill label={L(g.vis === 'private' ? 'Private' : g.vis === 'confidential' ? 'Confidential' : 'Public', g.vis === 'private' ? 'خاص' : g.vis === 'confidential' ? 'سرّي' : 'عام')} tone={g.vis === 'confidential' ? 'danger' : g.vis === 'private' ? 'warning' : ''} mark={g.vis === 'public' ? true : 'lock'} /></h1>{" "}<div className="meta">{L(g.cat, g.catAr)} · {L(g.meets, g.meetsAr)} · {g.members}{" "}{L('members', 'عضواً')}</div></div>{" "}<div className="acts">{!is('leader') ? <button className="btn btn-secondary" data-act="compose:group"><Icon name='msg' size={17} />{L('Message group', 'مراسلة المجموعة')}</button> : ''}{" "}{is('secretary') ? '' : <button className="btn btn-secondary" id="qr"><Icon name='qr' size={17} />{L('Signup QR', 'رمز التسجيل')}</button>}{" "}<button className="btn btn-primary" data-act={`member-add:${g.id}`}><Icon name='plus' size={17} />{L('Add member', 'إضافة عضو')}</button>{" "}{!is('leader') ? CR.recBtn('group', g.id, L('Group actions', 'إجراءات المجموعة')) : ''}</div></div></div><TabBar base={'groups/' + g.id} items={GTABS()} active={tab} /></>;
  const T = {
    '': () => <div className="splitview"><div className="stack" style={{
        gap: "16px"
      }}><Panel title={L('Leadership', 'المسؤوليات')} tight={true}>{d.roles.map(([p, en, ar]) => <div className="listrow"><Who p={person(p)} /><span className="grow" /><span className="chip">{L(en, ar)}</span></div>)}</Panel>{" "}<Panel title={L('Join requests', 'طلبات الانتساب')} tight={true}>{d.requests.length ? d.requests.map(r => <div className="listrow"><Who p={person(r.p)} /><span className="grow"><small className="mono">{fmtDate(r.at)}</small></span>{" "}<button className="btn btn-secondary btn-dense" data-act={`join-decline:${r.p}`}>{L('Decline', 'رفض')}</button>{" "}<button className="btn btn-primary btn-dense" data-act={`join-approve:${r.p}`}>{L('Approve', 'قبول')}</button></div>) : <Empty glyph='groups' title={L('No requests', 'لا طلبات')} body={L('Nobody is waiting.', 'لا أحد ينتظر.')} />}</Panel></div>{" "}<div className="sidecol">{!is('leader') ? <Panel title={L('Leadership handover', 'تسليم المسؤولية')}><p className="t-caption dim">{L('Transfer the group role and open tasks to an existing member. The person’s history stays intact.', 'انقل مسؤولية المجموعة ومهامها المفتوحة إلى عضو موجود. يبقى تاريخ الشخص محفوظاً.')}</p>{" "}<button className="btn btn-secondary btn-dense" style={{
            marginTop: "10px"
          }} data-act="handover">{L('Start handover', 'بدء التسليم')}</button></Panel> : ''}{" "}<Panel title={L('Budget', 'الموازنة')}><C.BarChart rows={[{
            label: L('Youth & catechism', 'الشبيبة والتعليم'),
            v: d.budget.spent,
            max: d.budget.allocated
          }]} />{" "}<p className="t-caption dim" style={{
            marginTop: "12px"
          }}>{L('Income and expenses live in Finance; the group sees only its own allocation.', 'المداخيل والمصاريف في المالية؛ وترى المجموعة مخصّصها فقط.')}</p>{" "}<a className="btn btn-secondary btn-dense" style={{
            marginTop: "10px"
          }} href="#/finance">{L('Open in Finance', 'فتح في المالية')}</a></Panel>{" "}<Panel title={L('Attendance', 'الحضور')}>{(() => {
            const recent = d.meetings.slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 4),
              counts = attendanceCounts(recent, d.roster),
              recorded = counts.present + counts.excused + counts.absent;
            return <><div className="row" style={{
                gap: "12px",
                alignItems: "baseline"
              }}><b style={{
                  font: "600 24px/30px var(--sans)"
                }}>{recorded ? Math.round(counts.present / recorded * 100) + '%' : '—'}</b>{" "}<span className="t-caption dim">{L('present among recorded statuses', 'حاضر من الحالات المسجّلة')}</span></div>{" "}<p className="t-caption dim">{recorded}{" "}{L('statuses in the last four meetings', 'حالات في آخر أربعة اجتماعات')}</p>{" "}<a className="btn btn-secondary btn-dense" style={{
                marginTop: "10px"
              }} href={`#/groups/${g.id}/attendance`}>{L('Open attendance', 'فتح الحضور')}</a></>;
          })()}</Panel></div></div>,
    roster: () => <><div className="toolbar" style={{
        margin: "16px 0",
        gap: "8px",
        flexWrap: "wrap"
      }}><div className="search" style={{
          maxWidth: "300px"
        }}><Icon name='search' size={16} /><input className="input" type="search" data-roster-search="" placeholder={L('Search members', 'ابحث عن الأعضاء')} aria-label={L('Search members', 'البحث عن الأعضاء')} /></div>{" "}<Select data-roster-filter="" aria-label={L('Filter roster', 'تصفية اللائحة')} style={{
          maxWidth: "230px"
        }}><option value="all">{L('All roles', 'كل الأدوار')}</option><option value="leaders">{L('People in charge', 'المسؤولون')}</option><option value="members">{L('Members', 'الأعضاء')}</option></Select></div>{" "}<div data-roster-list=""><Table pick={true} cols={[{
          label: L('Member', 'العضو'),
          sort: true
        }, {
          label: L('Role', 'الدور'),
          cls: 'hide-sm'
        }, {
          label: L('Joined', 'انتسب'),
          cls: 'hide-md'
        }, {
          label: is('secretary') ? L('Phone', 'الهاتف') : L('Attendance', 'الحضور'),
          cls: is('secretary') ? '' : 'num'
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={d.roster.filter(r => {
          const q = (S.ui.rosterQuery || '').toLocaleLowerCase(),
            p = person(r.p),
            mode = S.ui.rosterFilter || 'all',
            lead = r.role !== 'Member';
          return (!q || `${p?.lat || ''} ${p?.ar || ''} ${r.role || ''}`.toLocaleLowerCase().includes(q)) && (mode === 'all' || mode === 'leaders' === lead);
        }).map(r => ({
          cells: [is('secretary') ? <a href={`#/person/${r.p}`}>{L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p)}</a> : <button type="button" className="btn btn-ghost btn-dense" data-attendance-history={r.p}>{L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p)}</button>, <span className="dim">{L(r.role, r.roleAr)}</span>, <span className="mono dim">{r.joined}</span>, is('secretary') ? <span dir="ltr">{person(r.p)?.phone || '—'}</span> : <span className="num">{memberAttendancePct(d.meetings, r.p)}</span>, <span className="rowacts">{is('secretary') ? '' : <button className="btn btn-secondary btn-dense" data-roster-formation={r.p}>{L('Formation', 'التنشئة')}</button>}{!is('leader') ? <C.IconBtn ico='msg' label={L('Message', 'مراسلة')} data-act={`compose:${r.p}`} /> : ''}<C.IconBtn ico='dots' label={L('More', 'المزيد')} data-act={`member-menu:${r.p}`} /></span>]
        }))} /></div></>,
    attendance: () => attendanceMatrix(g, d),
    meetings: () => {
      const today = iso(new Date());
      const direction = S.ui.meetingReverse ? -1 : 1;
      const upcoming = d.meetings.filter(m => !m.done && m.d >= today).sort((a, b) => direction * byTime(a, b));
      const earlier = d.meetings.filter(m => m.done || m.d < today).sort((a, b) => direction * byTime(a, b));
      const calendar = S.ui.meetingView === 'calendar';
      const monthKey = S.ui.meetingMonth || today.slice(0, 7),
        [year, monthNumber] = monthKey.split('-').map(Number);
      const first = new Date(year, monthNumber - 1, 1),
        days = new Date(year, monthNumber, 0).getDate(),
        offset = first.getDay();
      const monthLabel = new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', {
        month: 'long',
        year: 'numeric'
      }).format(first);
      return <><div className="meeting-overview"><div><h2>{L('Ministry meetings', 'اجتماعات الخدمة')}</h2>{" "}<p className="t-caption dim">{is('secretary') ? L('View and arrange group meetings, dates and places.', 'اعرض ونظّم اجتماعات المجموعة ومواعيدها وأماكنها.') : L('Plan meetings, follow replies, and record attendance in one place.', 'خطّط للاجتماعات وتابع الردود وسجّل الحضور في مكان واحد.')}</p></div>{" "}<div className="row" style={{
            gap: "8px",
            flexWrap: "wrap"
          }}><button className="btn btn-secondary btn-dense" data-meeting-order="" title={L('Reverse meeting date order', 'عكس ترتيب الاجتماعات')}><Icon name='sort' size={15} />{L(S.ui.meetingReverse ? 'Newest first' : 'Oldest first', S.ui.meetingReverse ? 'الأحدث أولاً' : 'الأقدم أولاً')}</button>{" "}<div className="seg"><button data-meeting-view="list" aria-pressed={!calendar}>{L('List', 'قائمة')}</button><button data-meeting-view="calendar" aria-pressed={calendar}>{L('Calendar', 'رزنامة')}</button></div>{" "}<button className="btn btn-primary" data-act="meeting-new"><Icon name='plus' size={17} />{L('Add meeting', 'إضافة اجتماع')}</button></div></div>{" "}{!d.meetings.length ? <Empty glyph='calendar' title={L('No meetings yet', 'لا اجتماعات بعد')} body={L('Add the first meeting for this ministry.', 'أضف أول اجتماع لهذه الخدمة.')} /> : ''}{" "}{calendar ? <><div className="toolbar"><button className="btn btn-secondary btn-dense" data-meeting-month="-1" aria-label={L('Previous month', 'الشهر السابق')}><Icon name='chevL' size={16} /></button><b>{monthLabel}</b><button className="btn btn-secondary btn-dense" data-meeting-month="1" aria-label={L('Next month', 'الشهر التالي')}><Icon name='chevR' size={16} /></button></div>{" "}<div className="ministry-calendar-scroll"><div className="cal ministry-calendar"><div className="cal-head">{Array.from({
                  length: 7
                }, (_, i) => <div>{new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', {
                    weekday: 'short'
                  }).format(new Date(2026, 9, 4 + i))}</div>)}</div><div className="cal-grid">{Array.from({
                  length: Math.ceil((offset + days) / 7) * 7
                }, (_, i) => {
                  const day = new Date(year, monthNumber - 1, i - offset + 1),
                    date = iso(day),
                    outside = day.getMonth() !== monthNumber - 1;
                  const items = d.meetings.filter(m => m.d === date).sort(byTime);
                  return <div className={`cal-day${outside ? ' out' : ''}${date === today ? ' today' : ''}`}><span className="dn">{day.getDate()}</span>{items.map(m => <button className="cal-ev ministry-calendar-event" data-meeting-edit={meetingId(m)} title={m.title || L('Group meeting', 'اجتماع المجموعة')}><span>{m.title || L('Group meeting', 'اجتماع المجموعة')}</span><small>{m.t} · {meetingKind(m)}</small></button>)}</div>;
                })}</div></div></div></> : <>{upcoming.length ? <section className="meeting-section"><div className="meeting-section-title"><h3>{L('Upcoming', 'القادمة')}</h3><span className="badge badge-quiet">{upcoming.length}</span></div>{upcoming.map(m => meetingCard(g, m))}</section> : ''}{" "}{earlier.length ? <section className="meeting-section"><div className="meeting-section-title"><h3>{L('Earlier meetings', 'الاجتماعات السابقة')}</h3><span className="badge badge-quiet">{earlier.length}</span></div>{earlier.map(m => meetingCard(g, m))}</section> : ''}</>}</>;
    },
    posts: () => <div className="splitview"><div className="stack" style={{
        gap: "16px"
      }}><Panel title={L('Announcements', 'الإعلانات')}><C.RichText body='' />{" "}<button className="btn btn-primary btn-dense" style={{
            margin: "12px 0"
          }} data-act="post-add">{L('Post', 'نشر')}</button><div className="divider" />{d.posts.map(p => <div className="group-announcement"><div className="row" style={{
              gap: "10px"
            }}><Avatar p={person(p.by)} cls='avatar-sm' />{" "}<span><b style={{
                  font: "500 13px/18px var(--sans)"
                }}>{isAr() ? person(p.by).ar : person(p.by).lat}</b>{" "}<small className="t-caption dim" style={{
                  display: "block"
                }}>{fmtDate(p.at)}</small></span></div>{" "}<div className="t-body" style={{
              fontSize: "14px",
              marginTop: "10px"
            }}>{p.html ? safeRichText(p.html) : L(p.body, p.bodyAr)}</div></div>)}</Panel></div>{" "}<div className="sidecol"><Panel title={L('Files and learning resources', 'الملفات وموارد التنشئة')}>{d.files.map(([en, ar, size]) => <div className="listrow" style={{
            paddingInline: 0
          }}><Icon name='doc' size={17} cls='dimmer' />{" "}<span className="grow"><b>{isAr() ? ar : en}</b><small className="mono">{size} · {L('Legacy reference; ask the office for the file', 'مرجع قديم؛ اطلب الملف من المكتب')}</small></span></div>)}<div className="divider" /><div className="group-upload"><C.Dropzone id='gfiles' scope='group' ownerId={g.id} /></div></Panel></div></div>,
    belongings: () => <><div className="toolbar"><p className="t-caption dim">{L('Track ministry-owned items and who has borrowed them.', 'تابع مقتنيات الخدمة ومن استعارها.')}</p>{" "}<button className="btn btn-primary btn-dense" data-resource-new=""><Icon name='plus' size={15} />{L('Add item', 'إضافة صنف')}</button></div>{" "}<div className="toolbar ministry-filters"><input className="input" type="search" data-resource-search="" placeholder={L('Search items and locations', 'البحث في الأصناف والأماكن')} defaultValue={S.ui.resourceQuery || ''} /><button className="btn btn-secondary btn-dense" data-resource-search-button="">{L('Search', 'بحث')}</button><Select data-resource-filter="" aria-label={L('Filter resources', 'تصفية الموارد')}><option value="all">{L('All items', 'كل الأصناف')}</option><option value="available">{L('Available', 'متاح')}</option><option value="loaned">{L('On loan', 'مُعار')}</option></Select></div>{" "}<Paged className="gridcards resource-cards">{nodesOr(d.belongings.filter(r => {
          const q = (S.ui.resourceQuery || '').toLocaleLowerCase(),
            lent = d.resourceLoans.filter(l => l.resourceId === r.id && !l.returnedAt).reduce((n, l) => n + l.qty, 0),
            filter = S.ui.resourceFilter || 'all';
          return `${r.name} ${r.ar} ${r.location} ${r.locationAr} ${r.code || ''} ${r.description || ''}`.toLocaleLowerCase().includes(q) && (filter === 'all' || filter === 'available' && r.qty > lent || filter === 'loaned' && lent > 0);
        }).map(r => {
          const lent = d.resourceLoans.filter(l => l.resourceId === r.id && !l.returnedAt).reduce((n, l) => n + l.qty, 0);
          return <section className="panel"><div className="panel-b"><h3 className="resource-name"><span>{r.name}</span><span className="dim" lang="ar" dir="rtl">{r.ar || ''}</span></h3>{" "}<p><b>{r.qty - lent} / {r.qty}</b>{" "}{L('available', 'متاح')}{" "}{r.condition ? `· ${r.condition}` : ''}</p><p>{L('Stored at', 'محفوظ في')}: <span>{r.location || '—'}</span>{" "}<span className="dim" lang="ar" dir="rtl">{r.locationAr || ''}</span></p>{" "}{r.code ? <p>{L('Inventory code', 'رمز الجرد')}: <b>{r.code}</b></p> : ''}{r.description ? <p className="t-caption dim" style={{
                margin: "8px 0"
              }}>{r.description}</p> : ''}{" "}<div className="row" style={{
                gap: "6px",
                flexWrap: "wrap"
              }}><C.IconBtn ico='edit' label={L('Edit', 'تعديل')} data-resource-edit={r.id} /><C.IconBtn ico='trash' label={L('Delete', 'حذف')} data-resource-delete={r.id} /><button className="btn btn-secondary btn-dense" data-resource-lend={r.id} disabled={!!(r.qty - lent < 1)}>{L('Lend', 'إعارة')}</button></div></div></section>;
        }), <p className="help">{L('No matching resources.', 'لا موارد مطابقة.')}</p>)}</Paged>{" "}<h3 style={{
        margin: "24px 0 10px"
      }}>{L('Loans', 'الإعارات')}</h3>{" "}<Table cols={[{
        label: L('Item', 'الصنف')
      }, {
        label: L('Borrower', 'المستعير')
      }, {
        label: L('Quantity', 'العدد'),
        cls: 'num'
      }, {
        label: L('Due date', 'تاريخ الإرجاع')
      }, {
        label: L('Status', 'الحالة')
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={d.resourceLoans.slice().reverse().map(l => ({
        cells: [L(d.belongings.find(r => r.id === l.resourceId)?.name || '—', d.belongings.find(r => r.id === l.resourceId)?.ar || '—'), l.borrower, String(l.qty), fmtDate(l.due), l.returnedAt ? <Pill label={L('Returned', 'أُعيد')} tone='success' /> : l.due < iso(new Date()) ? <Pill label={L('Overdue', 'متأخر')} tone='danger' /> : <Pill label={L('On loan', 'مُعار')} tone='warning' />, l.returnedAt ? '' : <span className="row" style={{
          gap: "6px"
        }}><button className="btn btn-secondary btn-dense" data-resource-loan-edit={l.id}>{L('Edit', 'تعديل')}</button><button className="btn btn-secondary btn-dense" data-resource-return={l.id}>{L('Mark returned', 'تسجيل الإرجاع')}</button></span>]
      }))} /></>,
    tasks: () => <div className="ministry-tasks"><div className="toolbar ministry-section-heading"><h2>{L('Notes, tasks and follow-ups', 'الملاحظات والمهام والمتابعات')}</h2><button className="btn btn-primary btn-dense" data-group-task-new=""><Icon name='plus' size={15} />{L('Add item', 'إضافة عنصر')}</button></div>{" "}<div className="toolbar ministry-filters"><input className="input" type="search" data-group-task-search="" placeholder={L('Search notes and tasks', 'البحث في الملاحظات والمهام')} defaultValue={S.ui.groupTaskQuery || ''} /><Select data-group-task-filter=""><option value="all">{L('All', 'الكل')}</option><option value="pinned">{L('Pinned', 'مثبّتة')}</option><option value="pending">{L('Pending tasks', 'مهام معلّقة')}</option><option value="done">{L('Completed', 'مكتملة')}</option></Select></div>{" "}<Panel title='' tight={true}>{nodesOr(d.tasks.map((tk, ki) => ({
          ...tk,
          index: ki
        })).filter(tk => {
          const q = (S.ui.groupTaskQuery || '').toLocaleLowerCase(),
            filter = S.ui.groupTaskFilter || 'all';
          return `${tk.what} ${tk.whatAr || ''}`.toLocaleLowerCase().includes(q) && (filter === 'all' || filter === 'pinned' && tk.pinned || filter === 'pending' && !tk.done && tk.kind !== 'note' || filter === 'done' && tk.done);
        }).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (a.due || '9999').localeCompare(b.due || '9999')).map(tk => <div className="listrow pastoral-row" style={{
          paddingInline: 0
        }}><button className="btn-icon" data-group-task-done={tk.index} disabled={!!(tk.kind === 'note')} aria-label={L('Toggle complete', 'تغيير حالة الإنجاز')}><Icon name={tk.kind === 'note' ? 'notes' : 'check'} size={17} /></button><span className="grow"><b style={css(tk.done ? 'text-decoration:line-through' : '')}>{L(tk.what, tk.whatAr || tk.what)}</b><small>{tk.kind === 'note' ? L('Note', 'ملاحظة') : L('Task', 'مهمة')}{tk.due ? ` · ${L('Due', 'حتى')} ${fmtDate(tk.due)}` : ''}{tk.who ? ` · ${person(tk.who)?.lat || ''}` : ''}</small></span><button className="btn-icon" data-group-task-pin={tk.index} aria-pressed={!!tk.pinned} aria-label={L(tk.pinned ? 'Unpin' : 'Pin', tk.pinned ? 'إلغاء التثبيت' : 'تثبيت')}><Icon name='pin' size={17} /></button><button className="btn btn-secondary btn-dense" data-group-task-edit={tk.index}>{L('Edit', 'تعديل')}</button><button className="btn-icon" data-group-task-delete={tk.index} aria-label={L('Delete', 'حذف')}><Icon name='trash' size={16} /></button></div>), <p className="help">{L('No matching items.', 'لا عناصر مطابقة.')}</p>)}</Panel></div>,
    formation: () => <><C.InlineAlert tone='info' title={L('Formation records, not rankings', 'سجلات تنشئة، لا تصنيفات')} body={L('Record each member’s completion date and notes. Earlier totals without names remain labelled as historical.', 'سجّل تاريخ إنجاز كل عضو وملاحظاته. تبقى المجاميع القديمة غير المرتبطة بأسماء موسومة كتاريخية.')} />{" "}<div className="toolbar" style={{
        margin: "16px 0"
      }}><span className="t-caption dim">{d.milestones.length}{" "}{L('milestones', 'محطات')}</span>{" "}<button className="btn btn-primary btn-dense" data-formation-new=""><Icon name='plus' size={15} />{L('Add milestone', 'إضافة محطة')}</button></div>{" "}{d.roster.length && d.milestones.length ? <details className="panel formation-progress" style={{
        margin: "12px 0"
      }}><summary className="panel-h"><b>{L('Member progress', 'تقدّم الأعضاء')}</b><span className="more">{L('View members', 'عرض الأعضاء')}{" "}<Icon name='chevD' size={14} /></span></summary><div className="panel-b"><Table cols={[{
            label: L('Member', 'العضو')
          }, {
            label: L('Completed', 'المنجَز'),
            cls: 'num'
          }, {
            label: L('Still open', 'المتبقي'),
            cls: 'num'
          }]} rows={d.roster.map(r => {
            const active = d.milestones.filter(m => !m.archived),
              count = active.filter(m => m.completions?.[r.p]).length;
            return {
              cells: [L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p), `${count} / ${active.length}`, String(active.length - count)]
            };
          })} /></div></details> : ''}{" "}<Paged className="gridcards formation-cards">{nodesOr(d.milestones.filter(m => !m.archived).map(m => {
          const names = Object.entries(m.completions || {}).sort((a, b) => a[1].date.localeCompare(b[1].date));
          return <Panel title={L(m.name, m.ar)} more={<>{<C.IconBtn ico='edit' label={L('Edit milestone', 'تعديل المحطة')} data-formation-edit={m.id} />}{<C.IconBtn ico='trash' label={L('Delete milestone', 'حذف المحطة')} data-formation-delete={m.id} />}</>}><p className="t-caption dim">{m.description || ''}</p>{" "}<div className="row" style={{
              gap: "8px",
              flexWrap: "wrap",
              margin: "10px 0"
            }}><Pill label={`${names.length} ${L('named completions', 'إنجازات بالأسماء')}`} tone='success' />{" "}{m.legacyCount ? <Pill label={`${m.legacyCount} ${L('historical, unassigned', 'تاريخية بلا أسماء')}`} tone='warning' /> : ''}</div>{" "}{names.length ? `<details><summary>${L('View completions', 'عرض الإنجازات')} · ${names.length}</summary>` + names.map(([pid, record]) => <div className="listrow" style={{
              paddingInline: 0
            }}><span className="grow"><b>{L(person(pid)?.lat || pid, person(pid)?.ar || pid)}</b>{" "}<small>{fmtDate(record.date)}{record.notes ? ` · ${record.notes}` : ''}</small></span>{" "}<C.IconBtn ico='edit' label={L('Edit completion', 'تعديل الإنجاز')} data-formation-record={`${m.id}|${pid}`} />{" "}<C.IconBtn ico='trash' label={L('Remove completion', 'حذف الإنجاز')} data-formation-remove={`${m.id}|${pid}`} /></div>) + '</details>' : <p className="t-caption dim">{L('No named completions yet.', 'لا إنجازات بأسماء بعد.')}</p>}{" "}<div className="formation-card-actions"><button className="btn btn-secondary btn-dense" data-formation-record={m.id}><Icon name='plus' size={15} />{L('Record completion', 'تسجيل إنجاز')}</button></div></Panel>;
        }), <Empty glyph='doc' title={L('No formation milestones', 'لا محطات تنشئة')} body={L('Add the first training milestone.', 'أضف أول محطة تدريب.')} />)}</Paged></>,
    history: () => <div style={{
      maxWidth: "720px"
    }}><Panel title={L('Membership and leadership history', 'سجل العضوية والمسؤوليات')}><div className="timeline">{d.history.map(([en, ar, when]) => <div className="tl-item"><div className="when">{fmtDate(when)}</div><div className="what">{L(en, ar)}</div></div>)}</div>{" "}<div className="divider" />{" "}<p className="t-caption dim">{L('A leadership handover moves the role, not the person’s history. Ongoing tasks follow the role to whoever takes it, and the permission review runs automatically.', 'تسليم المسؤولية ينقل الدور لا تاريخ الشخص. والمهام الجارية تتبع الدور إلى من يتسلّمه، وتُراجَع الصلاحيات تلقائياً.')}</p></Panel></div>
  };
  return <>{head}<div className="ministry-content">{(T[tab] || T[''])()}</div></>;
}
const ATTENDANCE_OPTIONS = [['', 'Not recorded', 'غير مسجّل'], ['present', 'Present', 'حاضر'], ['excused', 'Excused', 'معذور'], ['absent', 'Absent', 'غائب']];
const attendanceTag = (value, count) => {
  const option = ATTENDANCE_OPTIONS.find(([key]) => key === value) || ATTENDANCE_OPTIONS[0];
  return <span className={`attendance-tag attendance-${value || 'unrecorded'}`}><span className="attendance-dot" />{count == null ? '' : <b>{count}</b>}{L(option[1], option[2])}</span>;
};
function chooseAttendance(anchor, meeting, pid, afterSave = () => {}) {
  openMenu(anchor, ATTENDANCE_OPTIONS.map(([value, en, ar]) => ({
    label: L(en, ar),
    tone: value || 'unrecorded',
    fn: () => {
      meeting.attendance ||= {};
      if (value) meeting.attendance[pid] = value;else delete meeting.attendance[pid];
      if (value) meeting.done = true;
      bus.refresh();
      afterSave();
    }
  })), {
    width: 190
  });
}
export function ministryAttendance() {
  return <><PageHead crumbs={[{
      label: L('My ministry', 'خدمتي')
    }, {
      label: L('Attendance', 'الحضور')
    }]} title={L('Attendance', 'الحضور')} sub={L('Open the attendance register for each group you lead.', 'افتح سجل الحضور لكل مجموعة تقودها.')} /><Paged className="gridcards">{groupCards(GROUPS, 'attendance')}</Paged></>;
}
function meetingReview(mid) {
  const g = group(S.params[0]),
    d = groupInfo(S.params[0]);
  const meeting = d.meetings.find(m => meetingId(m) === mid);
  if (!g || !meeting) return;
  const rosterIds = d.roster.map(r => r.p).filter(pid => !meeting.participants?.length || meeting.participants.includes(pid));
  const peopleIds = [...rosterIds, ...Object.keys(meeting.attendance || {}).filter(pid => !rosterIds.includes(pid))];
  const categories = [['present', L('Came', 'حضروا')], ['excused', L('Excused', 'معذورون')], ['absent', L('Did not come', 'لم يحضروا')], ['', L('No answer', 'بلا جواب')]];
  openModal({
    wide: true,
    title: L('Meeting attendance', 'حضور الاجتماع'),
    sub: `${L(g.name, g.ar)} · ${fmtDate(meeting.d)} · ${meeting.t}`,
    body: <>{meeting.present && !Object.values(meeting.attendance || {}).includes('present') ? <C.InlineAlert tone='info' title={L('Historical total without names', 'مجموع سابق من دون أسماء')} body={L(`${meeting.present} people were recorded as present in the old summary. Their names were not stored, so they are not assigned to a column.`, `سُجّل حضور ${meeting.present} أشخاص في الملخّص السابق من دون حفظ أسمائهم، لذلك لم يُوزّعوا على الأعمدة.`)} /> : ''}{" "}<div className="meeting-review-grid">{categories.map(([value, label]) => {
          const ids = peopleIds.filter(pid => attendanceValue(meeting, pid) === value);
          return <section className={`meeting-review-column attendance-${value || 'unrecorded'}`}><h3>{label}{" "}<span>{ids.length}</span></h3>{" "}<div className="meeting-review-list">{ids.length ? ids.map(pid => <button type="button" data-review-person={pid}>{L(person(pid)?.lat || pid, person(pid)?.ar || pid)}<Icon name='chevD' size={14} /></button>) : <p>{L('No people here', 'لا أشخاص هنا')}</p>}</div></section>;
        })}</div>{" "}<p className="t-caption dim" style={{
        marginTop: "14px"
      }}>{L('Select a person to change their attendance. Changes save immediately.', 'اختر شخصاً لتغيير حالة حضوره. تُحفظ التغييرات فوراً.')}</p></>,
    foot: <button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>,
    onMount(el) {
      el.querySelectorAll('[data-review-person]').forEach(button => button.addEventListener('click', () => chooseAttendance(button, meeting, button.dataset.reviewPerson, () => meetingReview(mid))));
    }
  });
}
function memberAttendancePct(meetings, pid) {
  const values = meetings.map(m => attendanceValue(m, pid)).filter(Boolean);
  return values.length ? `${Math.round(values.filter(x => x === 'present').length / values.length * 100)}%` : '—';
}
function attendanceMatrix(g, d) {
  if (S.ui.attendanceGroup !== g.id) {
    S.ui.attendanceGroup = g.id;
    S.ui.attendancePeriod = null;
  }
  const latest = d.meetings.slice().sort((a, b) => b.d.localeCompare(a.d))[0]?.d?.slice(0, 7) || iso(TODAY).slice(0, 7);
  const period = S.ui.attendancePeriod || latest;
  const meetings = d.meetings.filter(m => m.d.startsWith(period)).sort((a, b) => (S.ui.attendanceReverse ? -1 : 1) * byTime(a, b));
  const rosterIds = new Set(d.roster.map(r => r.p));
  const formerIds = [...new Set(meetings.flatMap(m => Object.keys(m.attendance || {})).filter(pid => !rosterIds.has(pid)))];
  const visibleRoster = [...d.roster, ...formerIds.map(p => ({
    p,
    former: true
  }))];
  const counts = attendanceCounts(meetings, d.roster);
  for (const meeting of meetings) for (const pid of formerIds) {
    const value = attendanceValue(meeting, pid);
    if (value) counts[value]++;
  }
  const recorded = counts.present + counts.excused + counts.absent;
  const [year, mo] = period.split('-').map(Number);
  const periodLabel = new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', {
    month: 'long',
    year: 'numeric'
  }).format(new Date(year, mo - 1, 1));
  const held = d.meetings.filter(m => m.done);
  const overall = held.reduce((total, m) => {
    const count = meetingAttendance(m);
    for (const key of ['present', 'excused', 'absent']) total[key] += count[key];
    return total;
  }, {
    present: 0,
    excused: 0,
    absent: 0
  });
  const known = overall.present + overall.excused + overall.absent;
  return <><div className="stats attendance-stats" style={{
      margin: "20px 0 12px"
    }}><Stat k={L('Meetings held', 'اجتماعات أُقيمت')} v={held.length} d={L('all recorded meetings', 'كل الاجتماعات المسجّلة')} />{" "}<div className="stat"><span className="k">{L('Attendance breakdown', 'تفصيل الحضور')}</span><div className="attendance-breakdown">{[['present', 'Present', 'حاضر'], ['excused', 'Excused', 'معذور'], ['absent', 'Absent', 'غائب']].map(([key, en, ar]) => <div><span>{L(en, ar)}</span><b>{overall[key]}</b><small>{known ? Math.round(overall[key] / known * 100) : 0}%</small></div>)}</div></div>{" "}<Stat k={L('Attendance rate', 'نسبة الحضور')} v={known ? `${Math.round(overall.present / known * 100)}%` : '—'} d={L('of known responses', 'من الردود المعروفة')} /></div><div className="toolbar" style={{
      margin: "16px 0",
      gap: "8px",
      flexWrap: "wrap"
    }}><div className="row" style={{
        gap: "6px"
      }}><C.IconBtn ico='chevL' label={L('Previous month', 'الشهر السابق')} data-attendance-shift="-1" />{" "}<b style={{
          minWidth: "130px",
          textAlign: "center"
        }}>{periodLabel}</b>{" "}<C.IconBtn ico='chevR' label={L('Next month', 'الشهر التالي')} data-attendance-shift="1" /></div>{" "}<input className="input" type="search" data-attendance-search="" placeholder={L('Find a member', 'ابحث عن عضو')} aria-label={L('Find a member', 'ابحث عن عضو')} style={{
        maxWidth: "230px"
      }} />{" "}<button className="btn btn-secondary btn-dense" data-attendance-order="" aria-label={L('Reverse meeting date order', 'عكس ترتيب تواريخ الاجتماعات')} title={L('Reverse meeting date order', 'عكس ترتيب تواريخ الاجتماعات')}><Icon name='sort' size={15} />{L(S.ui.attendanceReverse ? 'Newest first' : 'Oldest first', S.ui.attendanceReverse ? 'الأحدث أولاً' : 'الأقدم أولاً')}</button>{" "}<span className="t-caption dim">{recorded}/{meetings.reduce((n, m) => n + d.roster.filter(r => !m.participants?.length || m.participants.includes(r.p)).length, 0) + formerIds.reduce((n, pid) => n + meetings.filter(m => attendanceValue(m, pid)).length, 0)}{" "}{L('recorded', 'مسجّل')}</span>{" "}<span className="attendance-legend">{attendanceTag('present', counts.present)}{attendanceTag('excused', counts.excused)}{attendanceTag('absent', counts.absent)}</span>{" "}<button className="btn btn-secondary btn-dense" data-attendance-import="">{L('Import Excel', 'استيراد Excel')}</button>{" "}<button className="btn btn-secondary btn-dense" data-attendance-export="">{L('Export', 'تصدير')}</button>{" "}<button className="btn btn-secondary btn-dense" data-attendance-print=""><Icon name='print' size={15} />{L('Print', 'طباعة')}</button>{" "}<button className="btn btn-primary btn-dense" data-act="meeting-new"><Icon name='plus' size={15} />{L('Add meeting', 'إضافة اجتماع')}</button></div>{" "}{!meetings.length ? <Empty glyph='calendar' title={L('No meetings this month', 'لا اجتماعات هذا الشهر')} body={L('Add a meeting or choose another month.', 'أضف اجتماعاً أو اختر شهراً آخر.')} /> : !visibleRoster.length ? <Empty glyph='groups' title={L('No group members yet', 'لا أعضاء في المجموعة بعد')} body={L('Add members to start attendance.', 'أضف أعضاء لبدء تسجيل الحضور.')} /> : <div className="attendance-scroll" style={{
      overflow: "auto",
      maxWidth: "100%",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-card)"
    }}><table className="attendance-table" style={{
        borderCollapse: "separate",
        borderSpacing: 0,
        width: "100%",
        minWidth: "max-content"
      }}><caption className="sr">{L(g.name, g.ar)} — {periodLabel}{" "}{L('attendance', 'الحضور')}</caption><thead><tr><th className="attendance-name" style={{
              position: "sticky",
              insetInlineStart: 0,
              top: 0,
              zIndex: 3,
              background: "var(--muted)",
              padding: "10px",
              textAlign: "start",
              minWidth: "200px"
            }}>{L('Member', 'العضو')}</th>{meetings.map(m => <th style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "var(--muted)",
              padding: "8px",
              minWidth: "138px",
              textAlign: "center"
            }}><span className="mono">{fmtDate(m.d)}</span><br /><small className="dim">{m.t}</small>{" "}<C.IconBtn ico='edit' label={L('Edit meeting', 'تعديل الاجتماع')} data-meeting-edit={meetingId(m)} /></th>)}</tr></thead><tbody>{visibleRoster.map(r => {
            const p = person(r.p);
            return <tr data-attendance-member={`${p?.lat || ''} ${p?.ar || ''}`.toLowerCase()}><th className="attendance-name" scope="row" style={{
                position: "sticky",
                insetInlineStart: 0,
                zIndex: 1,
                background: "var(--surface)",
                padding: "9px 10px",
                textAlign: "start",
                borderTop: "1px solid var(--border)"
              }}><button className="btn btn-ghost btn-dense" data-attendance-history={r.p} style={{
                  textAlign: "start"
                }}>{L(p?.lat || r.p, p?.ar || r.p)}</button>{" "}{r.former ? <small className="dim" style={{
                  display: "block"
                }}>{L('Former member', 'عضو سابق')}</small> : ''}</th>{meetings.map(m => {
                const value = attendanceValue(m, r.p),
                  invited = !m.participants?.length || m.participants.includes(r.p);
                return <td style={{
                  padding: "6px",
                  borderTop: "1px solid var(--border)",
                  textAlign: "center"
                }}>{!invited && !value ? <span className="dim" title={L('Not invited', 'غير مدعو')}>—</span> : <button type="button" className={`attendance-choice attendance-${value || 'unrecorded'}`} data-attendance={`${meetingId(m)}|${r.p}`} disabled={!!(r.former || !invited)} aria-label={`${L(p?.lat || r.p, p?.ar || r.p)} — ${fmtDate(m.d)}: ${L(...(ATTENDANCE_OPTIONS.find(x => x[0] === value) || ATTENDANCE_OPTIONS[0]).slice(1))}`}>{attendanceTag(value)}<Icon name='chevD' size={14} /></button>}</td>;
              })}</tr>;
          })}</tbody></table></div>}{" "}<p className="t-caption dim" style={{
      marginTop: "10px"
    }}>{L('Each cell belongs to a group member and meeting. Changes save as you select a status.', 'كل خانة مرتبطة بعضو واجتماع. تُحفظ التغييرات عند اختيار الحالة.')}</p></>;
}
function attendanceRows(gid) {
  const d = groupInfo(gid),
    period = S.ui.attendancePeriod || d.meetings.slice().sort((a, b) => b.d.localeCompare(a.d))[0]?.d?.slice(0, 7) || '';
  const meetings = d.meetings.filter(m => m.d.startsWith(period)).sort(byTime);
  return {
    period,
    rows: meetings.flatMap(m => d.roster.filter(r => !m.participants?.length || m.participants.includes(r.p)).map(r => [m.d, m.t, m.title || '', r.p, person(r.p)?.lat || '', person(r.p)?.ar || '', attendanceValue(m, r.p) || 'unrecorded']))
  };
}
function attendanceExport(gid) {
  const {
      period,
      rows
    } = attendanceRows(gid),
    fields = [['Date', 'Time', 'Meeting', 'Person ID', 'Name', 'Arabic name', 'Attendance'], ...rows];
  const safe = value => {
    const str = String(value ?? '');
    return `"${(/^[=+@-]/.test(str) ? "'" : '') + str.replace(/"/g, '""')}"`;
  };
  download(`attendance-${gid}-${period}.csv`, fields.map(row => row.map(safe).join(',')).join('\r\n'));
}
function attendancePrint(gid) {
  const g = group(gid),
    {
      period,
      rows
    } = attendanceRows(gid);
  const popup = window.open('', '_blank');
  if (!popup) return toast(L('Allow the print window', 'اسمح بنافذة الطباعة'), '', 'warning');
  /* the sheet is written into the new window as a page of its own; React draws the table */
  const table = <table><thead><tr>{[L('Date', 'التاريخ'), L('Time', 'الوقت'), L('Meeting', 'الاجتماع'), L('Member', 'العضو'), L('Status', 'الحالة')].map((x, i) => <th key={i}>{x}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={i}>{[row[0], row[1], row[2], L(row[4], row[5]), row[6]].map((x, j) => <td key={j}>{x}</td>)}</tr>)}</tbody></table>;
  popup.document.write(`<!doctype html><html lang="${isAr() ? 'ar' : 'en'}" dir="${isAr() ? 'rtl' : 'ltr'}"><meta charset="utf-8"><title>${markup(<>{L(g.name, g.ar)} — {period}</>)}</title>
    <style>body{font:14px Arial,sans-serif;padding:24px;color:#233B32}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #DCE2DB;padding:8px;text-align:start}th{background:#EDF0E8}@page{size:landscape;margin:15mm}</style>
    ${markup(<h1>{L(g.name, g.ar)} — {period} {L('attendance', 'الحضور')}</h1>)}${markup(table)}</html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 150);
}
function attendanceImport(gid) {
  const d = groupInfo(gid);
  let workbook = [],
    mapped = [];
  const roster = d.roster.map(r => person(r.p)).filter(Boolean);
  const normalize = s => String(s || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const labels = [['present', 'Present', 'حاضر'], ['excused', 'Excused', 'معذور'], ['absent', 'Absent', 'غائب']];
  openDrawer({
    large: true,
    title: L('Import attendance from Excel', 'استيراد الحضور من Excel'),
    sub: L('Choose a workbook, map its name and status columns, review every match, then apply to one meeting. No file is stored.', 'اختر ملف Excel وحدّد عمودي الاسم والحالة وراجع كل مطابقة ثم طبّقها على اجتماع واحد. لا يُحفظ الملف.'),
    body: <><div className="formrow"><label className="label" htmlFor="ai_meeting">{L('Meeting', 'الاجتماع')}</label><Select id="ai_meeting"><option value="">{L('Choose a meeting', 'اختر اجتماعاً')}</option>{d.meetings.slice().sort((a, b) => b.d.localeCompare(a.d)).map(m => <option value={meetingId(m)}>{m.title || L('Meeting', 'اجتماع')} · {fmtDate(m.d)}</option>)}</Select></div>{" "}<div className="formrow"><label className="label" htmlFor="ai_file">{L('Excel workbook (.xlsx)', 'ملف Excel (.xlsx)')}</label><input className="input" id="ai_file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></div>{" "}<div id="ai_map" aria-live="polite" /><div id="ai_review" aria-live="polite" /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="ai_apply" disabled>{L('Apply reviewed records', 'تطبيق السجلات المراجَعة')}</button></>,
    onMount(el) {
      const mapping = el.querySelector('#ai_map'),
        review = el.querySelector('#ai_review'),
        apply = el.querySelector('#ai_apply');
      const update = () => {
        mapped = [];
        apply.disabled = true;
        const mid = el.querySelector('#ai_meeting').value,
          meeting = d.meetings.find(m => meetingId(m) === mid);
        if (!workbook.length || !meeting) {
          paint(review, null);
          return;
        }
        const ni = Number(el.querySelector('#ai_name')?.value),
          si = Number(el.querySelector('#ai_status')?.value),
          seen = new Set();
        const results = workbook.slice(1).filter(row => row.some(cell => String(cell || '').trim())).map((row, index) => {
          const source = normalize(row[ni]),
            matches = roster.filter(p => [p.id, p.lat, p.ar].some(v => normalize(v) === source));
          const p = matches.length === 1 ? matches[0] : null,
            raw = normalize(row[si]);
          const value = labels.find(([key, en, ar]) => [key, normalize(en), normalize(ar)].includes(raw))?.[0] || '';
          const error = !source ? L('Name missing', 'الاسم ناقص') : matches.length !== 1 ? L(matches.length ? 'Ambiguous name' : 'Person not in roster', matches.length ? 'الاسم ملتبس' : 'ليس في لائحة الأعضاء') : meeting.participants?.length && !meeting.participants.includes(p.id) ? L('Not invited', 'غير مدعو') : seen.has(p.id) ? L('Duplicate person', 'شخص مكرّر') : !value ? L('Unrecognized status', 'حالة غير معروفة') : '';
          if (p && !error) seen.add(p.id);
          return {
            line: index + 2,
            p,
            value,
            error,
            current: p ? attendanceValue(meeting, p.id) : '',
            source: row[ni],
            raw: row[si]
          };
        });
        mapped = results.filter(row => !row.error);
        const errors = results.filter(row => row.error);
        paint(review, <><div className="divider" /><p className="t-caption">{mapped.length}{" "}{L('ready', 'جاهز')} · {errors.length}{" "}{L('errors', 'أخطاء')}</p>{" "}{errors.length ? <C.InlineAlert tone='warning' title={L('Fix the workbook before applying', 'صحّح الملف قبل التطبيق')} body={L('Rows with errors will not be applied.', 'الصفوف التي فيها أخطاء لن تُطبّق.')} /> : ''}{" "}<div className="tablewrap"><table className="table"><thead><tr>{[L('Row', 'الصف'), L('Workbook name', 'الاسم في الملف'), L('Matched member', 'العضو المطابق'), L('Status', 'الحالة'), L('Current', 'الحالي'), L('Review', 'المراجعة')].map(label => <th>{label}</th>)}</tr></thead><tbody>{results.slice(0, 100).map(row => <tr><td>{row.line}</td><td>{row.source || '—'}</td><td>{row.p ? L(row.p.lat, row.p.ar) : '—'}</td><td>{row.raw || '—'}</td><td>{row.current || '—'}</td><td>{row.error ? <span className="help-error">{row.error}</span> : L('Ready', 'جاهز')}</td></tr>)}</tbody></table></div>{results.length > 100 ? <p className="help">{L('Only the first 100 rows are shown; all rows are checked.', 'تظهر أول ١٠٠ صف فقط، وتُفحص كل الصفوف.')}</p> : ''}</>);
        apply.disabled = !mapped.length || !!errors.length;
      };
      el.querySelector('#ai_file').addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!/\.xlsx$/i.test(file.name) || file.size > 2_000_000) {
          toast(L('Choose an .xlsx file under 2 MB', 'اختر ملف .xlsx أصغر من ٢ ميغابايت'), '', 'warning');
          return;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        try {
          workbook = (await parishAPI('attendance-preview', 'POST', {
            groupId: gid,
            data: btoa(binary)
          })).rows;
        } catch (error) {
          toast(L('Could not read workbook', 'تعذّرت قراءة الملف'), error.message, 'danger');
          return;
        }
        const headings = workbook[0] || [],
          options = headings.map((heading, index) => <option value={index}>{heading || `Column ${index + 1}`}</option>);
        paint(mapping, <><div className="formgrid"><div className="formrow"><label className="label" htmlFor="ai_name">{L('Person column', 'عمود الشخص')}</label><Select id="ai_name">{options}</Select></div>{" "}<div className="formrow"><label className="label" htmlFor="ai_status">{L('Attendance column', 'عمود الحضور')}</label><Select id="ai_status">{options}</Select></div></div>{" "}<p className="help">{L('Accepted statuses: Present, Excused, Absent (or Arabic equivalents).', 'الحالات المقبولة: حاضر، معذور، غائب (أو ما يقابلها بالإنكليزية).')}</p></>);
        const nameIndex = headings.findIndex(v => /person|member|name|الاسم|الشخص/i.test(v)),
          statusIndex = headings.findIndex(v => /status|attendance|الحضور|الحالة/i.test(v));
        el.querySelector('#ai_name').value = String(Math.max(0, nameIndex));
        el.querySelector('#ai_status').value = String(Math.max(0, statusIndex));
        el.querySelectorAll('#ai_name,#ai_status').forEach(sel => sel.addEventListener('change', update));
        update();
      });
      el.querySelector('#ai_meeting').addEventListener('change', update);
      apply.addEventListener('click', async () => {
        const meeting = d.meetings.find(m => meetingId(m) === el.querySelector('#ai_meeting').value);
        if (!meeting || !mapped.length || apply.disabled) return;
        meeting.attendance ||= {};
        for (const row of mapped) meeting.attendance[row.p.id] = row.value;
        meeting.done = true;
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Attendance imported', 'استُورد الحضور'), `${mapped.length} ${L('records', 'سجلات')}`, 'success');
      });
    }
  });
}
groups.mount = host => {
  const bindFilter = (selector, key) => {
    const el = host.querySelector(selector);
    if (!el) return;
    el.value = S.ui[key] || el.value;
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
      const caret = el.tagName === 'INPUT' ? el.selectionStart : 0;
      S.ui[key] = el.value;
      bus.refresh();
      if (el.tagName === 'INPUT') {
        const next = host.querySelector(selector);
        next?.focus();
        next?.setSelectionRange(caret, caret);
      }
    });
  };
  bindFilter('[data-roster-search]', 'rosterQuery');
  bindFilter('[data-roster-filter]', 'rosterFilter');
  bindFilter('[data-resource-search]', 'resourceQuery');
  bindFilter('[data-resource-filter]', 'resourceFilter');
  host.querySelector('[data-resource-search-button]')?.addEventListener('click', () => host.querySelector('[data-resource-search]')?.focus());
  bindFilter('[data-group-task-search]', 'groupTaskQuery');
  bindFilter('[data-group-task-filter]', 'groupTaskFilter');
  host.querySelector('[data-attendance-order]')?.addEventListener('click', () => {
    S.ui.attendanceReverse = !S.ui.attendanceReverse;
    bus.refresh();
  });
  host.querySelector('[data-meeting-order]')?.addEventListener('click', () => {
    S.ui.meetingReverse = !S.ui.meetingReverse;
    bus.refresh();
  });
  host.querySelectorAll('[data-meeting-view]').forEach(b => b.addEventListener('click', () => {
    S.ui.meetingView = b.dataset.meetingView;
    bus.refresh();
  }));
  host.querySelectorAll('[data-meeting-month]').forEach(b => b.addEventListener('click', () => {
    const [y, m] = (S.ui.meetingMonth || iso(new Date()).slice(0, 7)).split('-').map(Number),
      date = new Date(y, m - 1 + Number(b.dataset.meetingMonth), 1);
    S.ui.meetingMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    bus.refresh();
  }));
  host.querySelectorAll('[data-roster-formation]').forEach(b => b.addEventListener('click', () => {
    const d = groupInfo(S.params[0]),
      pid = b.dataset.rosterFormation,
      p = person(pid);
    openDrawer({
      title: L(p?.lat || pid, p?.ar || pid),
      sub: L('Formation progress', 'تقدّم التنشئة'),
      body: nodesOr(d.milestones.filter(m => !m.archived).map(m => <div className="listrow"><span className="grow"><b>{L(m.name, m.ar)}</b><small>{m.completions?.[pid] ? `${L('Completed', 'مكتمل')} · ${fmtDate(m.completions[pid].date)}` : L('Not completed', 'لم يكتمل')}</small></span></div>), <p>{L('No formation milestones yet.', 'لا محطات تنشئة بعد.')}</p>),
      foot: <button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>
    });
  }));
  host.querySelector('[data-group-task-new]')?.addEventListener('click', () => groupTaskForm());
  host.querySelectorAll('[data-group-task-edit]').forEach(b => b.addEventListener('click', () => groupTaskForm(Number(b.dataset.groupTaskEdit))));
  for (const [selector, field] of [['[data-group-task-pin]', 'pinned'], ['[data-group-task-done]', 'done']]) host.querySelectorAll(selector).forEach(b => b.addEventListener('click', async () => {
    const item = groupInfo(S.params[0]).tasks[Number(b.dataset.groupTaskPin ?? b.dataset.groupTaskDone)];
    if (item) {
      item[field] = !item[field];
      if (await persist()) bus.refresh();
    }
  }));
  host.querySelectorAll('[data-group-task-delete]').forEach(b => b.addEventListener('click', () => {
    const d = groupInfo(S.params[0]),
      i = Number(b.dataset.groupTaskDelete),
      item = d.tasks[i];
    if (item) openModal({
      title: L('Delete item?', 'حذف العنصر؟'),
      body: <p>{L(item.what, item.whatAr || item.what)}</p>,
      foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-danger" id="group-task-confirm">{L('Delete', 'حذف')}</button></>,
      onMount(el) {
        el.querySelector('#group-task-confirm').addEventListener('click', async () => {
          d.tasks.splice(i, 1);
          if (!(await persist())) return;
          closeOverlays();
          bus.refresh();
        });
      }
    });
  }));
  host.querySelector('[data-resource-new]')?.addEventListener('click', () => resourceForm());
  host.querySelectorAll('[data-resource-edit]').forEach(b => b.addEventListener('click', () => resourceForm(b.dataset.resourceEdit)));
  host.querySelectorAll('[data-resource-delete]').forEach(b => b.addEventListener('click', () => resourceDelete(b.dataset.resourceDelete)));
  host.querySelectorAll('[data-resource-lend]').forEach(b => b.addEventListener('click', () => resourceLend(b.dataset.resourceLend)));
  host.querySelectorAll('[data-resource-loan-edit]').forEach(b => b.addEventListener('click', () => resourceLoanEdit(b.dataset.resourceLoanEdit)));
  host.querySelectorAll('[data-resource-return]').forEach(b => b.addEventListener('click', async () => {
    const loan = groupInfo(S.params[0]).resourceLoans.find(l => l.id === b.dataset.resourceReturn);
    if (loan) {
      loan.returnedAt = iso(new Date());
      if (!(await persist())) return;
      bus.refresh();
      toast(L('Item returned', 'أُعيد الصنف'), '', 'success');
    }
  }));
  host.querySelector('[data-formation-new]')?.addEventListener('click', () => formationForm());
  host.querySelectorAll('[data-formation-edit]').forEach(b => b.addEventListener('click', () => formationForm(b.dataset.formationEdit)));
  host.querySelectorAll('[data-formation-delete]').forEach(b => b.addEventListener('click', () => formationDelete(b.dataset.formationDelete)));
  host.querySelectorAll('[data-formation-record]').forEach(b => b.addEventListener('click', () => {
    const [mid, pid = ''] = b.dataset.formationRecord.split('|');
    formationRecord(mid, pid);
  }));
  host.querySelectorAll('[data-formation-remove]').forEach(b => b.addEventListener('click', async () => {
    const [mid, pid] = b.dataset.formationRemove.split('|'),
      m = groupInfo(S.params[0]).milestones.find(x => x.id === mid);
    if (m?.completions?.[pid]) {
      delete m.completions[pid];
      if (!(await persist())) return;
      bus.refresh();
      toast(L('Completion removed', 'حُذف الإنجاز'), '', 'success');
    }
  }));
  host.querySelectorAll('[data-attendance-shift]').forEach(b => b.addEventListener('click', () => {
    const d = groupInfo(S.params[0]).meetings.slice().sort((a, b) => b.d.localeCompare(a.d))[0]?.d?.slice(0, 7) || iso(TODAY).slice(0, 7);
    const [y, m] = (S.ui.attendancePeriod || d).split('-').map(Number),
      next = new Date(y, m - 1 + Number(b.dataset.attendanceShift), 1);
    S.ui.attendancePeriod = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    bus.refresh();
  }));
  host.querySelector('[data-attendance-search]')?.addEventListener('input', e => {
    const query = e.target.value.trim().toLowerCase();
    host.querySelectorAll('[data-attendance-member]').forEach(row => {
      row.hidden = !row.dataset.attendanceMember.includes(query);
    });
  });
  host.querySelector('[data-attendance-import]')?.addEventListener('click', () => attendanceImport(S.params[0]));
  host.querySelector('[data-attendance-export]')?.addEventListener('click', () => attendanceExport(S.params[0]));
  host.querySelector('[data-attendance-print]')?.addEventListener('click', () => attendancePrint(S.params[0]));
  host.querySelectorAll('[data-attendance]').forEach(button => button.addEventListener('click', () => {
    const [mid, pid] = button.dataset.attendance.split('|'),
      meeting = groupInfo(S.params[0]).meetings.find(m => meetingId(m) === mid);
    if (meeting) chooseAttendance(button, meeting, pid);
  }));
  host.querySelectorAll('[data-attendance-history]').forEach(b => b.addEventListener('click', () => {
    const pid = b.dataset.attendanceHistory,
      p = person(pid),
      rows = groupInfo(S.params[0]).meetings.slice().sort((a, c) => c.d.localeCompare(a.d));
    const values = rows.map(m => attendanceValue(m, pid)).filter(Boolean);
    const present = values.filter(v => v === 'present').length,
      excused = values.filter(v => v === 'excused').length,
      absent = values.filter(v => v === 'absent').length;
    openDrawer({
      title: L(p?.lat || pid, p?.ar || pid),
      sub: L('Individual attendance tracking', 'متابعة الحضور الفردي'),
      body: <><div className="attendance-person-stats">{attendanceTag('present', present)}{attendanceTag('excused', excused)}{attendanceTag('absent', absent)}{" "}<span className="t-caption dim">{values.length ? `${Math.round(present / values.length * 100)}%` : '—'}{" "}{L('present among recorded meetings', 'حاضر من الاجتماعات المسجّلة')}</span></div>{rows.map(m => <div className="listrow" style={{
          paddingInline: 0
        }}><span className="grow">{fmtDate(m.d)} · {m.t}</span>{" "}{attendanceTag(attendanceValue(m, pid))}</div>)}</> || <p>{L('No meetings yet', 'لا اجتماعات بعد')}</p>,
      foot: <button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>
    });
  }));
  host.querySelectorAll('[data-meeting-review]').forEach(b => b.addEventListener('click', () => meetingReview(b.dataset.meetingReview)));
  host.querySelectorAll('[data-meeting-edit]').forEach(b => b.addEventListener('click', () => F.meetingEdit(b.dataset.meetingEdit)));
  host.querySelectorAll('[data-task]').forEach(c => c.addEventListener('change', () => VERBS['task-toggle'](c, c.dataset.task)));
  host.querySelector('#qr')?.addEventListener('click', () => openModal({
    title: L('Group signup code', 'رمز انتساب المجموعة'),
    sub: L('A revocable link that opens a controlled registration flow. It is not a way into anyone’s record.', 'رابط قابل للإلغاء يفتح مسار تسجيل مضبوطاً. وليس مدخلاً إلى سجل أحد.'),
    body: <><div style={{
        display: "grid",
        placeItems: "center",
        padding: "8px 0"
      }}><div style={{
          width: "150px",
          height: "150px",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-card)",
          display: "grid",
          placeItems: "center",
          background: "var(--muted)",
          color: "var(--text-3)"
        }}><Icon name='qr' size={64} /></div></div>{" "}<div className="formgrid" style={{
        marginTop: "16px"
      }}><div className="formrow"><label className="label">{L('Expires', 'ينتهي')}</label>{" "}<Select><option>{L('In 7 days', 'بعد ٧ أيام')}</option><option>{L('In 30 days', 'بعد ٣٠ يوماً')}</option><option>{L('Never', 'أبداً')}</option></Select></div>{" "}<C.Stepper label={L('Capacity', 'السعة')} value={30} id='qrcap' /></div>{" "}<C.CheckRow label={L('Require approval before someone joins', 'اشتراط الموافقة قبل الانتساب')} checked={true} /></>,
    foot: <><button className="btn btn-danger-quiet" data-act="qr-revoke">{L('Revoke code', 'إلغاء الرمز')}</button>{" "}<button className="btn btn-primary" style={{
        marginInlineStart: "auto"
      }} data-act="print">{L('Print', 'طباعة')}</button></>,
    onMount(el) {}
  }));
};
function groupTaskForm(index = -1) {
  const d = groupInfo(S.params[0]),
    item = d.tasks[index];
  openDrawer({
    title: item ? L('Edit item', 'تعديل العنصر') : L('Add note or task', 'إضافة ملاحظة أو مهمة'),
    body: <><div className="formrow"><label className="label" htmlFor="gt_kind">{L('Type', 'النوع')}</label><Select id="gt_kind"><option value="task" selected={!!(item?.kind !== 'note')}>{L('Task', 'مهمة')}</option><option value="note" selected={!!(item?.kind === 'note')}>{L('Note', 'ملاحظة')}</option></Select></div><C.Field label={L('Text', 'النص')} id='gt_what' value={item?.what || ''} req={true} /><C.Field label={L('Arabic text', 'النص العربي')} id='gt_ar' value={item?.whatAr || ''} /><div className="formgrid"><div className="formrow"><label className="label" htmlFor="gt_who">{L('Owner', 'المسؤول')}</label><Select id="gt_who"><option value="">—</option>{d.roster.map(r => <option value={r.p} selected={!!(item?.who === r.p)}>{L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p)}</option>)}</Select></div><C.Field label={L('Due date', 'تاريخ الاستحقاق')} id='gt_due' type='date' value={item?.due || ''} /></div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="gt_save">{L('Save', 'حفظ')}</button></>,
    onMount(el) {
      el.querySelector('#gt_save').addEventListener('click', async () => {
        const what = el.querySelector('#gt_what').value.trim();
        if (!what) return toast(L('Enter text', 'أدخل النص'), '', 'warning');
        const target = item || {
          id: `task-${Date.now().toString(36)}`
        };
        Object.assign(target, {
          kind: el.querySelector('#gt_kind').value,
          what,
          whatAr: el.querySelector('#gt_ar').value.trim() || what,
          who: el.querySelector('#gt_who').value,
          due: el.querySelector('#gt_due').value,
          done: target.done || false,
          pinned: target.pinned || false
        });
        if (!item) d.tasks.unshift(target);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
      });
    }
  });
}
function resourceForm(id = '') {
  const d = groupInfo(S.params[0]),
    r = d.belongings.find(x => x.id === id),
    lent = id ? d.resourceLoans.filter(l => l.resourceId === id && !l.returnedAt).reduce((n, l) => n + l.qty, 0) : 0;
  openDrawer({
    title: r ? L('Edit item', 'تعديل الصنف') : L('Add item', 'إضافة صنف'),
    body: <><C.Field label={L('Name', 'الاسم')} id='rs_name' value={r?.name || ''} req={true} />{" "}<C.Field label={L('Arabic name', 'الاسم العربي')} id='rs_ar' value={r?.ar || ''} />{" "}<div className="formgrid"><C.Field label={L('Inventory code', 'رمز الجرد')} id='rs_code' value={r?.code || ''} />{" "}<div className="formrow"><label className="label" htmlFor="rs_condition">{L('Condition', 'الحالة')}</label><Select id="rs_condition">{[['good', 'Good', 'جيد'], ['fair', 'Fair', 'مقبول'], ['repair', 'Needs repair', 'يحتاج تصليح'], ['damaged', 'Damaged', 'تالف']].map(([v, en, ar]) => <option value={v} selected={!!(r?.condition === v)}>{L(en, ar)}</option>)}</Select></div></div>{" "}<C.Textarea label={L('Description / care notes', 'الوصف / ملاحظات العناية')} id='rs_description' value={r?.description || ''} max={500} />{" "}<div className="formgrid"><C.Field label={L('Total quantity', 'العدد الكلي')} id='rs_qty' type='number' value={r?.qty ?? 1} />{" "}<C.Field label={L('Stored at', 'محفوظ في')} id='rs_location' value={r?.location || ''} /></div>{" "}<C.Field label={L('Location (Arabic)', 'المكان بالعربي')} id='rs_location_ar' value={r?.locationAr || ''} />{" "}{lent ? <p className="help">{lent}{" "}{L('currently on loan; total quantity cannot be lower.', 'معار حالياً؛ لا يمكن تقليل العدد الكلي إلى أقل من ذلك.')}</p> : ''}</>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="rs_save">{L('Save item', 'حفظ الصنف')}</button></>,
    onMount(el) {
      el.querySelector('#rs_save').addEventListener('click', async () => {
        if (!F.need(el, '#rs_name', L('Enter an item name', 'أدخل اسم الصنف'))) return;
        const qty = Number(el.querySelector('#rs_qty').value);
        if (!Number.isInteger(qty) || qty < lent || qty < 0) return toast(L('Invalid quantity', 'عدد غير صالح'), L(`At least ${lent} items are needed to cover active loans.`, `يلزم ${lent} صنفاً لتغطية الإعارات الحالية.`), 'warning');
        const target = r || {
          id: `res-${Date.now().toString(36)}`
        };
        Object.assign(target, {
          name: el.querySelector('#rs_name').value.trim(),
          ar: el.querySelector('#rs_ar').value.trim(),
          code: el.querySelector('#rs_code').value.trim(),
          condition: el.querySelector('#rs_condition').value,
          description: el.querySelector('#rs_description').value.trim(),
          qty,
          location: el.querySelector('#rs_location').value.trim(),
          locationAr: el.querySelector('#rs_location_ar').value.trim()
        });
        if (!r) d.belongings.push(target);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Item saved', 'حُفظ الصنف'), '', 'success');
      });
    }
  });
}
function resourceDelete(id) {
  const d = groupInfo(S.params[0]),
    r = d.belongings.find(x => x.id === id);
  if (!r) return;
  if (d.resourceLoans.some(l => l.resourceId === id)) return toast(L('Item has loan history', 'للصنف سجل إعارات'), L('Keep the item so its loan history stays attached.', 'أبق الصنف كي يظل سجل الإعارات مرتبطاً به.'), 'warning');
  openModal({
    title: L('Delete item?', 'حذف الصنف؟'),
    body: <p>{L(r.name, r.ar)}</p>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-danger" id="rs_delete">{L('Delete', 'حذف')}</button></>,
    onMount(el) {
      el.querySelector('#rs_delete').addEventListener('click', async () => {
        d.belongings.splice(d.belongings.indexOf(r), 1);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
      });
    }
  });
}
function resourceLend(id) {
  const d = groupInfo(S.params[0]),
    r = d.belongings.find(x => x.id === id);
  if (!r) return;
  const available = r.qty - d.resourceLoans.filter(l => l.resourceId === id && !l.returnedAt).reduce((n, l) => n + l.qty, 0);
  openDrawer({
    title: L('Lend item', 'إعارة صنف'),
    sub: L(r.name, r.ar),
    body: <><C.Field label={L('Borrower name', 'اسم المستعير')} id='loan_name' req={true} />{" "}<div className="formgrid"><C.Field label={L('Quantity', 'العدد')} id='loan_qty' type='number' value={1} />{" "}<C.Field label={L('Due date', 'تاريخ الإرجاع')} id='loan_due' type='date' value={iso(new Date())} req={true} /></div>{" "}<p className="help">{available}{" "}{L('available', 'متاح')}</p></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="loan_save">{L('Record loan', 'تسجيل الإعارة')}</button></>,
    onMount(el) {
      el.querySelector('#loan_save').addEventListener('click', async () => {
        if (!F.need(el, '#loan_name', L('Enter the borrower', 'أدخل اسم المستعير')) || !F.need(el, '#loan_due', L('Choose a due date', 'اختر تاريخ الإرجاع'))) return;
        const qty = Number(el.querySelector('#loan_qty').value),
          due = el.querySelector('#loan_due').value;
        if (!Number.isInteger(qty) || qty < 1 || qty > available || due < iso(new Date())) return toast(L('Check quantity and due date', 'تحقّق من العدد والتاريخ'), '', 'warning');
        d.resourceLoans.push({
          id: `loan-${Date.now().toString(36)}`,
          resourceId: id,
          borrower: el.querySelector('#loan_name').value.trim(),
          qty,
          checkedOutAt: iso(new Date()),
          due,
          returnedAt: ''
        });
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Loan recorded', 'سُجّلت الإعارة'), '', 'success');
      });
    }
  });
}
function resourceLoanEdit(id) {
  const d = groupInfo(S.params[0]),
    loan = d.resourceLoans.find(item => item.id === id);
  if (!loan) return;
  const resource = d.belongings.find(item => item.id === loan.resourceId);
  if (!resource) return;
  const otherLoans = d.resourceLoans.filter(item => item.resourceId === resource.id && !item.returnedAt && item.id !== id).reduce((count, item) => count + item.qty, 0);
  const limit = loan.returnedAt ? loan.qty : resource.qty - otherLoans;
  openDrawer({
    title: L('Edit loan', 'تعديل الإعارة'),
    sub: L(resource.name, resource.ar),
    body: <><C.Field label={L('Borrower name', 'اسم المستعير')} id='loan_name' value={loan.borrower} req={true} />{" "}<div className="formgrid"><C.Field label={L('Quantity', 'العدد')} id='loan_qty' type='number' value={loan.qty} />{" "}<C.Field label={L('Due date', 'تاريخ الإرجاع')} id='loan_due' type='date' value={loan.due} req={true} /></div>{" "}<p className="help">{loan.returnedAt ? L('This loan was returned; its quantity is retained for the record.', 'أُعيدت هذه الإعارة؛ يبقى عددها محفوظاً في السجل.') : `${limit} ${L('items available to this loan', 'أصناف متاحة لهذه الإعارة')}`}</p></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="loan_save">{L('Save loan', 'حفظ الإعارة')}</button></>,
    onMount(el) {
      el.querySelector('#loan_save').addEventListener('click', async () => {
        if (!F.need(el, '#loan_name', L('Enter the borrower', 'أدخل اسم المستعير')) || !F.need(el, '#loan_due', L('Choose a due date', 'اختر تاريخ الإرجاع'))) return;
        const qty = Number(el.querySelector('#loan_qty').value),
          due = el.querySelector('#loan_due').value;
        if (!Number.isInteger(qty) || qty < 1 || qty > limit || due < loan.checkedOutAt || loan.returnedAt && qty !== loan.qty) return toast(L('Check quantity and due date', 'تحقّق من العدد والتاريخ'), '', 'warning');
        Object.assign(loan, {
          borrower: el.querySelector('#loan_name').value.trim(),
          qty,
          due
        });
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Loan updated', 'حُدّثت الإعارة'), '', 'success');
      });
    }
  });
}
function formationForm(id = '') {
  const d = groupInfo(S.params[0]),
    m = d.milestones.find(x => x.id === id);
  openDrawer({
    title: m ? L('Edit milestone', 'تعديل المحطة') : L('Add milestone', 'إضافة محطة'),
    body: <>{<C.Field label={L('Milestone name', 'اسم المحطة')} id='fm_name' value={m?.name || ''} req={true} />}{" "}{<C.Field label={L('Arabic name', 'الاسم العربي')} id='fm_ar' value={m?.ar || ''} />}{" "}{<C.Textarea label={L('Description or learning goal', 'الوصف أو هدف التعلم')} id='fm_description' value={m?.description || ''} max={500} />}</>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="fm_save">{L('Save milestone', 'حفظ المحطة')}</button></>,
    onMount(el) {
      el.querySelector('#fm_save').addEventListener('click', async () => {
        if (!F.need(el, '#fm_name', L('Name the milestone', 'سمّ المحطة'))) return;
        const target = m || {
          id: `fm-${Date.now().toString(36)}`,
          legacyCount: 0,
          completions: {}
        };
        Object.assign(target, {
          name: el.querySelector('#fm_name').value.trim(),
          ar: el.querySelector('#fm_ar').value.trim(),
          description: el.querySelector('#fm_description').value.trim()
        });
        if (!m) d.milestones.push(target);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Milestone saved', 'حُفظت المحطة'), '', 'success');
      });
    }
  });
}
function formationDelete(id) {
  const d = groupInfo(S.params[0]),
    m = d.milestones.find(x => x.id === id);
  if (!m) return;
  if (m.legacyCount || Object.keys(m.completions || {}).length) return toast(L('Milestone has history', 'للمحطة سجل'), L('Remove individual completions first. Historical totals are preserved.', 'احذف الإنجازات الفردية أولاً. وتبقى المجاميع التاريخية محفوظة.'), 'warning');
  openModal({
    title: L('Delete milestone?', 'حذف المحطة؟'),
    body: <p>{L(m.name, m.ar)}</p>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-danger" id="fm_delete">{L('Delete', 'حذف')}</button></>,
    onMount(el) {
      el.querySelector('#fm_delete').addEventListener('click', async () => {
        d.milestones.splice(d.milestones.indexOf(m), 1);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
      });
    }
  });
}
function formationRecord(id, pid = '') {
  const d = groupInfo(S.params[0]),
    m = d.milestones.find(x => x.id === id);
  if (!m) return;
  const saved = m.completions?.[pid];
  openDrawer({
    title: L('Record completion', 'تسجيل إنجاز'),
    sub: L(m.name, m.ar),
    body: <><fieldset className="formrow"><legend className="label">{L('Members', 'الأعضاء')}</legend><div className="formation-member-choices">{d.roster.filter(r => !pid || r.p === pid).map(r => <label className="check"><input type="checkbox" name="fr_person" defaultValue={r.p} defaultChecked={!!(r.p === pid)} disabled={!!(!pid && m.completions?.[r.p])} /><span>{L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p)}{!pid && m.completions?.[r.p] ? ` · ${L('Already completed', 'مكتمل سابقاً')}` : ''}</span></label>)}</div></fieldset>{" "}<C.Field label={L('Completed on', 'تاريخ الإنجاز')} id='fr_date' type='date' value={saved?.date || iso(new Date())} req={true} />{" "}<C.Textarea label={L('Notes (optional)', 'ملاحظات (اختياري)')} id='fr_notes' value={saved?.notes || ''} max={500} /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="fr_save">{L('Save completion', 'حفظ الإنجاز')}</button></>,
    onMount(el) {
      el.querySelector('#fr_save').addEventListener('click', async () => {
        const members = [...el.querySelectorAll('[name="fr_person"]:checked')].map(box => box.value),
          date = el.querySelector('#fr_date').value;
        if (!members.length || !date) return toast(L('Choose members and date', 'اختر الأعضاء والتاريخ'), '', 'warning');
        if (members.some(member => m.completions?.[member] && member !== pid)) return toast(L('Already recorded', 'مسجّل سابقاً'), L('Edit an existing completion instead.', 'عدّل الإنجاز الموجود بدلاً من ذلك.'), 'warning');
        for (const member of members) m.completions[member] = {
          date,
          notes: el.querySelector('#fr_notes').value.trim()
        };
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Completion saved', 'حُفظ الإنجاز'), '', 'success');
      });
    }
  });
}

/* ═══════════════ 8 · volunteers ═══════════════ */
const VTABS = () => [['', 'Rota', 'المناوبات'], ['people', 'Volunteers', 'المتطوّعون', VOLUNTEERS.length], ['sheets', 'Sign-up sheets', 'لوائح التطوّع', SIGNUP_SHEETS.length], ['hours', 'Hours', 'الساعات']];
export function volunteers(tab = '') {
  if (is('leader')) {
    const managed = GROUPS,
      unique = [...new Set(managed.flatMap(g => groupInfo(g.id).roster.map(r => r.p)))];
    const held = managed.flatMap(g => groupInfo(g.id).meetings.filter(m => m.done));
    return <><PageHead crumbs={[{
        label: L('My ministry', 'خدمتي')
      }, {
        label: L('Volunteers', 'المتطوّعون')
      }]} title={L('Ministry volunteers', 'متطوعو الخدمة')} sub={L('Members and attendance in the groups you lead.', 'الأعضاء والحضور في المجموعات التي تقودها.')} /><div className="stats" style={{
        margin: "20px 0"
      }}><Stat k={L('Members', 'الأعضاء')} v={unique.length} d={L('across my groups', 'في مجموعاتي')} />{" "}<Stat k={L('Groups', 'المجموعات')} v={managed.length} d={L('I lead', 'أقودها')} />{" "}<Stat k={L('Meetings held', 'اجتماعات أُقيمت')} v={held.length} d={L('across my groups', 'في مجموعاتي')} /></div>{" "}{nodesOr(managed.map(g => {
        const d = groupInfo(g.id);
        return <Panel title={L(g.name, g.ar)} more={<><a className="btn btn-secondary btn-dense" href={`#/groups/${g.id}/roster`}>{L('Open roster', 'افتح اللائحة')}</a>{" "}<button className="btn btn-primary btn-dense" data-leader-add={g.id}>{L('Add member', 'إضافة عضو')}</button></>}><div className="toolbar"><b>{L('Role assignments', 'إسناد الأدوار')}</b><button className="btn btn-primary btn-dense" data-role-assign={g.id}><Icon name='plus' size={15} />{L('Assign role', 'إسناد دور')}</button></div>{" "}{d.roles.map(([pid, en, ar], i) => <div className="listrow"><span className="grow">{L(person(pid)?.lat || pid, person(pid)?.ar || pid)}<small>{L(en, ar)}</small></span><button className="btn-icon" data-role-remove={`${g.id}|${i}`} aria-label={L('Remove assignment', 'إزالة الإسناد')}><Icon name='trash' size={16} /></button></div>)}{" "}<div className="divider" /><Table cols={[{
            label: L('Member', 'العضو')
          }, {
            label: L('Role', 'الدور')
          }, {
            label: L('Attendance', 'الحضور'),
            cls: 'num'
          }]} rows={d.roster.map(r => ({
            cells: [L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p), L(r.role, r.roleAr), memberAttendancePct(d.meetings, r.p)]
          }))} /></Panel>;
      }), <Empty glyph='groups' title={L('No groups assigned', 'لا مجموعات مخصصة')} body={L('Ask the parish office to assign a ministry.', 'اطلب من مكتب الرعية تخصيص خدمة.')} />)}</>;
  }
  const teams = is('leader') ? ROTA.teams.filter(tm => tm.leader === 'p3') : ROTA.teams;
  const head = <><PageHead crumbs={[{
      label: L('Parish life', 'حياة الرعية')
    }, {
      label: L('Volunteers', 'المتطوّعون')
    }]} title={is('leader') ? L('My teams — Sunday Mass 10:30', 'فرقي — قدّاس الأحد ١٠:٣٠') : L('Volunteers', 'المتطوّعون')} sub={L('Plan volunteer assignments here. Anyone who needs personal access signs in as a member, with or without a ministry group.', 'نظّم مناوبات المتطوعين هنا. من يحتاج إلى دخول شخصي يسجّل كعضو، سواء انضم إلى خدمة أم لا.')} actions={<><button className="btn btn-secondary" data-act="remind:rota"><Icon name='msg' size={17} />{L('Remind everyone', 'تذكير الجميع')}</button>{" "}<button className="btn btn-primary" data-act="vol-add"><Icon name='plus' size={17} />{L('Add volunteer', 'إضافة متطوّع')}</button></>} /><TabBar base='volunteers' items={VTABS()} active={tab} /></>;
  if (tab === 'people') return <>{head}<div className="tabbody">{(() => {
        const miss = VOLUNTEERS.filter(v => v.clearance === 'missing').length,
          exp = VOLUNTEERS.filter(v => v.clearance === 'expiring').length;
        return miss || exp ? <C.InlineAlert tone='warning' title={L(`${miss} clearance${miss === 1 ? ' is' : 's are'} missing and ${exp} expire${exp === 1 ? 's' : ''} within 30 days`, `${miss} إفادة ناقصة و${exp} تنتهي خلال ٣٠ يوماً`)} body={L('Anyone without a valid safeguarding clearance cannot be scheduled to a team that works with children.', 'من لا يحمل إفادة حماية سارية لا يمكن إسناده إلى فريق يعمل مع الأطفال.')} /> : '';
      })()}{" "}<div><Table cols={[{
          label: L('Volunteer', 'المتطوّع'),
          sort: true
        }, {
          label: L('Skills', 'المهارات'),
          cls: 'hide-sm'
        }, {
          label: L('Available', 'التوفّر'),
          cls: 'hide-md'
        }, {
          label: L('Safeguarding', 'الحماية'),
          cls: 'shrink'
        }, {
          label: L('Hours', 'الساعات'),
          cls: 'num',
          sort: true
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={VOLUNTEERS.map(v => ({
          cells: [<Who p={person(v.p)} />, <span className="row" style={{
            gap: "4px",
            flexWrap: "wrap"
          }}>{(isAr() ? v.skillsAr : v.skills).map(s => <span className="chip">{s}</span>)}</span>, <span className="dim t-caption">{v.avail.join(' · ')}</span>, v.clearance === 'valid' ? <Pill label={L('Valid', 'سارية')} tone='success' /> : v.clearance === 'expiring' ? <Pill label={L('Expiring', 'تنتهي قريباً')} tone='warning' mark='st-wait' /> : <Pill label={L('Missing', 'ناقصة')} tone='danger' />, <span className="num">{v.hours}</span>, <span className="row" style={{
            gap: "6px",
            justifyContent: "flex-end"
          }}><button className="btn btn-secondary btn-dense" data-vol={v.p}>{L('Open', 'فتح')}</button>{CR.recBtn('volunteer', v.p)}</span>]
        }))} empty={<Empty glyph='vol' title={L('No volunteers yet', 'لا متطوّعين بعد')} body={L('Add parishioners who serve. A member account is optional.', 'أضف المؤمنين الذين يخدمون. حساب العضو اختياري.')} action={<button className="btn btn-primary btn-dense" data-act="vol-add">{L('Add volunteer', 'إضافة متطوّع')}</button>} />} /></div>{" "}<p className="t-caption dim" style={{
        marginTop: "16px"
      }}>{L('A high load is flagged for a human to look at. ParishLife does not diagnose burnout and never penalises anyone automatically.', 'يُعلَّم العبء المرتفع لينظر فيه إنسان. ولا يشخّص «حياة الرعية» الإنهاك ولا يعاقب أحداً تلقائياً.')}</p></div></>;
  if (tab === 'sheets') return <>{head}<div className="tabbody"><div className="toolbar"><button className="btn btn-secondary" data-act="rec-new:sheet" style={{
          marginInlineStart: "auto"
        }}><Icon name='plus' size={17} />{L('New sign-up sheet', 'لائحة تطوّع جديدة')}</button></div>{" "}{SIGNUP_SHEETS.length ? '' : <Empty glyph='vol' title={L('No sign-up sheets', 'لا لوائح تطوّع')} body={L('Open one when the parish needs hands for a date — readers, servers, a lunch team.', 'افتح واحدة حين تحتاج الرعية إلى أيادٍ لموعد — قرّاء، خدّام، فريق غداء.')} />}{" "}{SIGNUP_SHEETS.map(s => <section className="panel"><div className="panel-b"><div className="row" style={{
            gap: "12px",
            flexWrap: "wrap"
          }}><div style={{
              flex: 1,
              minWidth: "200px"
            }}><b style={{
                font: "600 15px/21px var(--sans)"
              }}>{L(s.what, s.whatAr)}</b>{" "}<div className="t-caption dim" style={{
                marginTop: "3px"
              }}>{L('closes', 'يقفل')}{" "}{fmtDate(s.deadline)}</div></div>{" "}{s.taken >= s.slots ? <Status k='ready' /> : <Pill label={`${s.slots - s.taken} ${L('left', 'متبقٍ')}`} tone='warning' />}{CR.recBtn('sheet', s.id)}</div>{" "}<span className="meter" style={{
            marginTop: "12px"
          }}><i style={css(`width:${Math.round(s.taken / s.slots * 100)}%`)} /></span>{" "}<div className="row" style={{
            gap: "8px",
            marginTop: "14px"
          }}><span className="t-caption dim">{s.taken} / {s.slots}{" "}{L('places taken', 'مركزاً مأخوذاً')}</span>{" "}<button className="btn btn-secondary btn-dense" style={{
              marginInlineStart: "auto"
            }} data-act={`sheet-open:${s.id}`}>{L('Manage participants', 'إدارة المشاركين')}</button>{" "}<button className="btn btn-primary btn-dense" data-act={`sheet-open:${s.id}`}>{L('Open sheet', 'فتح اللائحة')}</button></div></div></section>)}</div></>;
  if (tab === 'hours') return <>{head}<div style={{
      marginTop: "20px"
    }} className="splitview"><Panel title={L('Service hours, this year', 'ساعات الخدمة، هذه السنة')}><C.BarChart rows={VOLUNTEERS.map(v => ({
          label: isAr() ? person(v.p).ar : person(v.p).lat,
          v: v.hours,
          max: 140,
          text: `${v.hours} h`
        }))} /></Panel>{" "}<div className="sidecol"><Panel title={L('Recognition', 'التقدير')}><p className="t-body dim" style={{
            fontSize: "14px"
          }}>{L('Optional and never automatic. A parish can thank people; ParishLife will not rank them.', 'اختياري وغير تلقائي أبداً. تستطيع الرعية أن تشكر؛ ولن يرتّب «حياة الرعية» أحداً.')}</p>{" "}<button className="btn btn-secondary btn-dense" style={{
            marginTop: "12px"
          }} data-act="print">{L('Print thank-you cards', 'طباعة بطاقات شكر')}</button></Panel>{" "}<Panel title={L('Workload flags', 'تنبيهات العبء')}><div className="listrow" style={{
            paddingInline: 0
          }}><Who p={person('p12')} /><span className="grow" /><Pill label={L('3 teams this week', '٣ فرق هذا الأسبوع')} tone='warning' /></div>{" "}<p className="t-caption dim" style={{
            marginTop: "10px"
          }}>{L('Shown to the leader for a conversation, not acted on by the system.', 'تُعرَض على المسؤول للحوار، ولا يتصرّف النظام بناءً عليها.')}</p></Panel></div></div></>;

  /* rota board — sheet 04: drag a person onto a role. Green dot confirmed, amber awaiting
     reply, red border a double-booking; a swap request is a pending badge on the card. */
  const onTeams = id => ROTA.teams.filter(tm => tm.filled.some(f => f.p === id && f.s !== 'declined'));
  const cols = teams.map(tm => {
    const ti = ROTA.teams.indexOf(tm);
    const cards = tm.filled.map((f, si) => {
      const at = `${ti}|${si}`;
      if (!f.p) return <button className="rota-slot" data-accept="any" data-slot={at} data-act={`rota-fill:${at}`}><span className="idle">{L(`Assign ${tm.one}`, `إسناد ${tm.oneAr}`)}</span><span className="rel">{L('Release here', 'أفلت هنا')}</span></button>;
      const p = person(f.p),
        also = onTeams(f.p).filter(x => x !== tm)[0];
      const dbl = f.s !== 'declined' && !!also;
      const sub = f.s === 'declined' ? L('Declined', 'اعتذر') : dbl ? L(`Also on ${also.team}`, `أيضاً في ${also.teamAr}`) : f.s === 'pending' ? L('Awaiting confirmation', 'بانتظار التأكيد') : L(p.town, p.townAr);
      return <div className={`rota-card ${f.s}${dbl ? ' dbl' : ''}`} draggable="true" data-slot={at} data-accept={f.s === 'declined' ? 'any' : 'card'}><Avatar p={p} cls='avatar-sm' />{" "}<span className="rc-t"><b title={isAr() ? p.ar : p.lat}>{isAr() ? p.ar : p.lat}</b><small>{sub}</small></span>{" "}{f.swap ? <button className="rota-swap" data-act={`rota-swap:${at}`}>{L('Swap', 'تبديل')}</button> : ''}{" "}{f.s === 'declined' ? '' : <span className={`rdot ${f.s}`} role="img" aria-label={f.s === 'accepted' ? L('Confirmed', 'مؤكَّد') : L('Awaiting reply', 'بانتظار الردّ')} />}{" "}{f.s === 'declined' ? <button className="rota-sub" data-sub={p.id}>{L('Shortlist substitutes', 'اقتراح بدلاء')}</button> : ''}{" "}<span className="rc-acts"><button className="btn btn-secondary btn-dense" data-act={`rota-fill:${at}`}>{L('Replace', 'استبدال')}</button>{" "}<button className="btn btn-ghost btn-dense" data-act={`rota-remove:${at}`}>{L('Remove', 'إزالة')}</button></span></div>;
    });
    const ok = tm.filled.filter(f => f.p && f.s === 'accepted').length;
    return <section className="rota-col"><header><b>{L(tm.team, tm.teamAr)}</b><small>{L(tm.one, tm.oneAr)}</small>{" "}<small className={ok < tm.need ? 'short' : ''}>{L(`${ok} of ${tm.need} confirmed`, `${ok} من ${tm.need} مؤكَّد`)}</small></header>{" "}<div className="rota-list">{cards}</div></section>;
  });
  const tray = VOLUNTEERS.map(v => person(v.p)).map(p => <span className="rota-chip" draggable="true" data-p={p.id}><Avatar p={p} cls='avatar-xs' />{isAr() ? p.ar : p.lat}</span>);
  const places = teams.flatMap(tm => tm.filled);
  const open = places.filter(f => !f.p || f.s === 'declined');
  return <>{head}<div className="stats" style={{
      margin: "20px 0 24px"
    }}><Stat k={L('Places', 'المراكز')} v={places.length} d={teams.length === 1 ? L('in one team', 'في فريق واحد') : L(`across ${teams.length} teams`, `في ${teams.length} فرق`)} />{" "}<Stat k={L('Confirmed', 'مؤكَّد')} v={places.filter(f => f.p && f.s === 'accepted').length} d={L('accepted the invitation', 'قبلوا الدعوة')} />{" "}<Stat k={L('Still open', 'ما زال شاغراً')} v={open.length} d={!open.length ? L('every place is covered', 'كل المراكز مغطّاة') : open.some(f => f.s === 'declined') ? <span className="down">{L('one declined late', 'اعتذار متأخر واحد')}</span> : L('tap a place to invite someone', 'اضغط مركزاً لدعوة أحد')} />{" "}<Stat k={L('Swap requests', 'طلبات التبديل')} v={places.filter(f => f.swap).length} d={L('waiting on the leader', 'بانتظار المسؤول')} /></div>{" "}<Panel title={`${fmtLong(ROTA.date)} · ${L(ROTA.service, ROTA.serviceAr)}`} more={teams.length > 2 ? <span className="row rota-nav" style={{
      gap: "6px"
    }}><C.IconBtn ico='chevL' label={L('Scroll to earlier teams', 'الفرق السابقة')} data-rota-scroll="-1" /><C.IconBtn ico='chevR' label={L('Scroll to more teams', 'المزيد من الفرق')} data-rota-scroll="1" /></span> : ''}><div className="rota-wrap"><div className="rota-tray"><span className="overline">{L('Drag onto a place', 'اسحب إلى مركز')}</span>{tray}</div>{" "}<div className={`rota-board${teams.length < 3 ? ' few' : ''}`} tabIndex="0" aria-label={L('Teams — scroll sideways for more', 'الفرق — مرّر جانبياً للمزيد')}>{cols}</div></div>{" "}<p className="rota-legend"><span><i className="rdot accepted" />{L('confirmed', 'مؤكَّد')}</span>{" "}<span><i className="rdot pending" />{L('awaiting reply', 'بانتظار الردّ')}</span>{" "}<span><i className="rdbl" />{L('double-booked', 'حجز مزدوج')}</span>{" "}<span><i className="rota-swap" aria-hidden="true">{L('Swap', 'تبديل')}</i>{L('swap request', 'طلب تبديل')}</span>{" "}<span className="dim rota-hint">{L('On a phone, tap an empty place to invite someone.', 'على الهاتف، اضغط مركزاً شاغراً لدعوة أحد.')}</span></p></Panel>{" "}<C.InlineAlert tone='info' title={L('Late cancellations trigger a shortlist', 'الاعتذار المتأخر يُطلق لائحة بدلاء')} body={L('ParishLife proposes volunteers who are free, trained for that team and not already serving twice that week. A human always picks.', 'يقترح «حياة الرعية» متطوّعين متفرّغين ومدرَّبين لهذا الفريق وغير مناوبين مرّتين في الأسبوع نفسه. والاختيار دائماً بشري.')} /></>;
}
volunteers.mount = host => {
  if (is('leader')) {
    host.querySelectorAll('[data-leader-add]').forEach(b => b.addEventListener('click', () => F.memberAdd(b.dataset.leaderAdd)));
    host.querySelectorAll('[data-role-assign]').forEach(b => b.addEventListener('click', () => ministryRoleForm(b.dataset.roleAssign)));
    host.querySelectorAll('[data-role-remove]').forEach(b => b.addEventListener('click', () => {
      const [gid, index] = b.dataset.roleRemove.split('|'),
        d = groupInfo(gid);
      d.roles.splice(Number(index), 1);
      bus.refresh();
    }));
    return;
  }
  /* HTML drag and drop: a tray chip or a board card onto an open place (or a card onto a card to swap). */
  const board = host.querySelector('.rota-board')?.closest('.panel');
  if (board) {
    let from = null;
    const clear = () => board.querySelectorAll('.over,.dragging').forEach(x => x.classList.remove('over', 'dragging'));
    const target = e => {
      const tg = e.target.closest?.('[data-accept]');
      return tg && from && tg.dataset.slot !== from.at && (tg.dataset.accept === 'any' || from.at) ? tg : null;
    };
    board.addEventListener('dragstart', e => {
      const el = e.target.closest?.('[draggable=true]');
      if (!el) return;
      from = el.dataset.p ? {
        p: el.dataset.p
      } : {
        at: el.dataset.slot
      };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', el.dataset.p || el.dataset.slot);
      el.classList.add('dragging');
    });
    board.addEventListener('dragover', e => {
      const tg = target(e);
      if (!tg) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!tg.classList.contains('over')) {
        clear();
        tg.classList.add('over');
      }
    });
    board.addEventListener('dragleave', e => {
      const tg = target(e);
      if (tg && !tg.contains(e.relatedTarget)) tg.classList.remove('over');
    });
    board.addEventListener('drop', e => {
      const tg = target(e);
      if (!tg) return;
      e.preventDefault();
      clear();
      F.rotaDrop(from, tg.dataset.slot);
      from = null;
    });
    board.addEventListener('dragend', () => {
      clear();
      from = null;
    });
  }
  host.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => openDrawer({
    title: L('Available substitutes', 'بدلاء متاحون'),
    sub: L('Free at that hour, trained for this team, clearance valid, and not already serving twice this week.', 'متفرّغون في تلك الساعة، مدرَّبون، إفادتهم سارية، وغير مناوبين مرّتين هذا الأسبوع.'),
    body: ['p16', 'p9', 'p5'].map(id => <div className="listrow"><Who p={person(id)} /><span className="grow" />{" "}<Pill label={L('Clearance valid', 'إفادة سارية')} tone='success' />{" "}<button className="btn btn-secondary btn-dense" data-act={`sub-invite:${id}`}>{L('Invite', 'دعوة')}</button></div>),
    foot: <button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>
  })));
  host.querySelectorAll('[data-vol]').forEach(b => b.addEventListener('click', () => volDrawer(b.dataset.vol)));
  const rb = host.querySelector('.rota-board'),
    back = host.querySelector('[data-rota-scroll="-1"]'),
    more = host.querySelector('[data-rota-scroll="1"]');
  host.querySelectorAll('[data-rota-scroll]').forEach(b => b.addEventListener('click', () => {
    const step = (rb.querySelector('.rota-col')?.offsetWidth || 280) + 14,
      way = document.documentElement.dir === 'rtl' ? -1 : 1;
    rb.scrollBy({
      left: +b.dataset.rotaScroll * step * way,
      behavior: 'smooth'
    });
  }));
  /* the arrows rest at either end of the row (scrollLeft runs negative in Arabic) */
  const ends = () => {
    if (!rb || !back) return;
    const x = Math.abs(rb.scrollLeft),
      max = rb.scrollWidth - rb.clientWidth;
    back.disabled = x <= 2;
    more.disabled = x >= max - 2;
  };
  rb?.addEventListener('scroll', ends, {
    passive: true
  });
  ends();
};
function ministryRoleForm(gid) {
  const d = groupInfo(gid);
  openDrawer({
    title: L('Assign ministry role', 'إسناد دور في الخدمة'),
    sub: L(group(gid)?.name || '', group(gid)?.ar || ''),
    body: <><div className="formrow"><label className="label" htmlFor="role_name">{L('Role', 'الدور')}</label><Select id="role_name">{MINISTRY_ROLES.map(([en, ar]) => <option value={en}>{L(en, ar)}</option>)}</Select></div><div className="formrow"><label className="label" htmlFor="role_person">{L('Group member', 'عضو المجموعة')}</label><Select id="role_person">{d.roster.map(r => <option value={r.p}>{L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p)}</option>)}</Select></div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="role_save">{L('Assign', 'إسناد')}</button></>,
    onMount(el) {
      el.querySelector('#role_save').addEventListener('click', () => {
        const pid = el.querySelector('#role_person').value,
          en = el.querySelector('#role_name').value,
          ar = MINISTRY_ROLES.find(([name]) => name === en)?.[1] || en;
        if (!pid) return toast(L('Choose a group member', 'اختر عضواً من المجموعة'), '', 'warning');
        if (d.roles.some(([personId, role]) => personId === pid && role === en)) return toast(L('Already assigned', 'الدور مسند مسبقاً'), '', 'warning');
        d.roles.push([pid, en, ar]);
        closeOverlays();
        bus.refresh();
        toast(L('Role assigned', 'أُسند الدور'), '', 'success');
      });
    }
  });
}
function volDrawer(id) {
  const v = VOLUNTEERS.find(x => x.p === id),
    p = person(id);
  if (!v || !p) return;
  openDrawer({
    title: isAr() ? p.ar : p.lat,
    sub: L('Volunteer record — skills, availability and eligibility', 'سجل متطوّع — المهارات والتوفّر والأهلية'),
    body: <><dl className="dl"><dt>{L('Skills', 'المهارات')}</dt><dd>{(isAr() ? v.skillsAr : v.skills).join(', ')}</dd><dt>{L('Available', 'التوفّر')}</dt><dd>{v.avail.join(' · ')}</dd><dt>{L('Training', 'التدريب')}</dt><dd>{v.training.join(', ') || '—'}</dd><dt>{L('Service hours', 'ساعات الخدمة')}</dt><dd className="mono">{v.hours}</dd><dt>{L('Assignments', 'الإسنادات')}</dt><dd className="mono">{v.assignments}</dd></dl>{" "}<div className="divider" />{" "}{v.clearance === 'valid' ? <C.InlineAlert tone='success' title={L('Safeguarding clearance valid', 'إفادة الحماية سارية')} body={L(`Until ${fmtDate(v.until)}.`, `حتى ${fmtDate(v.until)}.`)} /> : v.clearance === 'expiring' ? <C.InlineAlert tone='warning' title={L('Clearance expires soon', 'الإفادة تنتهي قريباً')} body={L(`Expires ${fmtDate(v.until)}. Renew before the next rota.`, `تنتهي ${fmtDate(v.until)}. جدّدها قبل المناوبة التالية.`)} /> : <C.InlineAlert tone='danger' title={L('No safeguarding clearance on file', 'لا إفادة حماية في الملف')} body={L('Cannot be scheduled to any team that works with children.', 'لا يمكن إسناده إلى أي فريق يعمل مع الأطفال.')} />}{" "}<p className="t-caption dim" style={{
        marginTop: "14px"
      }}>{L('Who may see this documentation is controlled separately from who may schedule the team.', 'من يرى هذه المستندات يُضبط بمعزل عمّن يجدول الفريق.')}</p></>,
    foot: <><button className="btn btn-danger-quiet" data-act={`rec-del:volunteer|${id}`}><Icon name='trash' size={16} />{L('Remove', 'إزالة')}</button>{" "}<button className="btn btn-secondary" data-close="" style={{
        marginInlineStart: "auto"
      }}>{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-primary" data-act={`vol-edit:${id}`}>{L('Edit', 'تعديل')}</button></>
  });
}

/* ═══════════════ 9 · registration & payments ═══════════════ */
const RTABS = () => [['', 'Forms', 'الاستمارات'], ['builder', 'Form', 'الاستمارة'], ['registrants', 'Registrants', 'المسجّلون', REGISTRANTS.length], ['payments', 'Payments', 'الدفعات'], ['refunds', 'Refunds', 'الاسترجاعات', REFUNDS.length]];
function registrationNext(row, form) {
  if (row.status === 'awaiting-approval') return L('Review application', 'راجع الطلب');
  if (row.status !== 'registered') return L('Review place', 'مراجعة المقعد');
  if (consentInfo(form, row.p).required && !row.consent) return L('Consent pending', 'الموافقة معلّقة');
  if (Number(row.paid || 0) < registrationDue(row, form)) return L('Record payment', 'سجّل دفعة');
  return L('View / edit', 'عرض / تعديل');
}
export function registrations(tab = '') {
  const selected = selectedRegistration(),
    chosenEvent = linkedEvent(selected),
    selectedRows = registrantsFor(selected);
  const head = <><PageHead crumbs={[{
      label: L('Parish life', 'حياة الرعية')
    }, {
      label: L('Registrations', 'التسجيلات')
    }]} title={L('Registration and payments', 'التسجيل والدفع')} sub={L('Registration signs a participant up for a selected event. Check-in records their arrival at that same event.', 'التسجيل يضيف مشتركاً إلى حدث محدّد. التسجيل عند الباب يثبت وصوله إلى الحدث نفسه.')} actions={<button className="btn btn-primary" data-act="form-new"><Icon name='plus' size={17} />{L('New form', 'استمارة جديدة')}</button>} /><TabBar base='registrations' items={RTABS()} active={tab} />{tab ? <><div className="toolbar" style={{
        margin: "18px 0"
      }}><label className="label" htmlFor="registration-select">{L('Registration form', 'استمارة التسجيل')}</label>{" "}<Select id="registration-select" style={{
          maxWidth: "360px"
        }}><option value="">{L('Select a form', 'اختر استمارة')}</option>{REGISTRATIONS.map(f => <option value={f.id} selected={!!(selected?.id === f.id)}>{L(f.event, f.eventAr)}</option>)}</Select></div>{" "}{chosenEvent ? <div className="card card-flat" style={{
        padding: "12px",
        marginBottom: "18px"
      }}><b>{L(chosenEvent.title, chosenEvent.titleAr)}</b> · {fmtDate(chosenEvent.d)}{" "}{chosenEvent.t} · {L(eventVenue(chosenEvent)?.name || '', eventVenue(chosenEvent)?.ar || '')}</div> : ''}</> : ''}</>;
  if (tab && !selected) return <>{head}<div className="tabbody"><Empty glyph='registr' title={L('Select a registration form', 'اختر استمارة تسجيل')} body={L('Choose the event form above. No default event is selected.', 'اختر استمارة الحدث أعلاه. لا يُحدّد حدث افتراضياً.')} /></div></>;
  if (tab && !chosenEvent) return <>{head}<div className="tabbody"><C.InlineAlert tone='warning' title={L('This legacy form is not linked to an event', 'هذه الاستمارة القديمة غير مرتبطة بحدث')} body={L('Review it and link an eligible event before editing fields or checking in participants. Existing registrations are preserved.', 'راجعها واربطها بحدث صالح قبل تعديل الحقول أو تسجيل وصول المشتركين. تبقى التسجيلات القديمة محفوظة.')} />{" "}<button className="btn btn-secondary" data-act={`rec-edit:registration|${selected.id}`} style={{
        marginTop: "12px"
      }}>{L('Link event', 'ربط حدث')}</button></div></>;
  if (tab === 'builder') return <>{head}<div style={{
      marginTop: "20px"
    }} className="splitview"><div><Panel title={L(selected.event, selected.eventAr)} tight={false}>{selected.fields.map(([en, ar, type, req, he, ha], fi) => <div className="listrow" style={{
            paddingInline: 0,
            alignItems: "flex-start"
          }}><span style={{
              color: "var(--text-3)",
              marginTop: "2px"
            }}><Icon name={type === 'file' ? 'doc' : type === 'person' ? 'people' : type === 'date' ? 'events' : type === 'restricted' ? 'shield' : 'forms'} size={17} /></span>{" "}<span className="grow"><b>{L(en, ar)}{req ? <span style={{
                  color: "var(--danger)"
                }}>*</span> : ''}</b>{" "}{he ? <small style={{
                whiteSpace: "normal"
              }}>{L(he, ha || he)}</small> : ''}</span>{" "}<span className="chip">{type}</span><C.IconBtn ico='dots' label={L('Field options', 'خيارات الحقل')} data-act={`field-menu:${fi}`} /></div>)}<button className="btn btn-secondary btn-dense" style={{
            marginTop: "14px"
          }} data-act="field-add"><Icon name='plus' size={15} />{L('Add field', 'إضافة حقل')}</button></Panel>{" "}<p className="t-caption dim" style={{
          marginTop: "12px"
        }}>{L('Fixed field types first. A drag-and-drop designer comes once real forms have been tested on real registrations.', 'أنواع حقول ثابتة أولاً. ومصمّم السحب والإفلات يأتي بعد اختبار استمارات حقيقية على تسجيلات حقيقية.')}</p></div>{" "}<div className="sidecol"><Panel title={L('Fee and discounts', 'الرسم والحسومات')}><div className="amount" dir="ltr"><span className="usd">{registrationMoney(selected.fee, selected)}</span></div>{" "}<div className="divider" />{" "}{(selected.discounts || []).map(([en, ar, v]) => <div className="listrow" style={{
            paddingInline: 0
          }}><span className="grow">{L(en, ar)}</span><b className="mono">{v}</b></div>)}{" "}<div className="ac-group" style={{
            paddingInline: 0
          }}>{L('Instalments', 'أقساط')}</div>{" "}{(selected.installments || []).map(([en, ar, v]) => <div className="listrow" style={{
            paddingInline: 0
          }}><span className="grow">{L(en, ar)}</span><b className="mono">{registrationMoney(v, selected)}</b></div>)}</Panel>{" "}<Panel title={L('Registration confirmation', 'تأكيد التسجيل')}><p className="t-body dim">{L('A saved participant appears under Registrants for this event. Automated confirmation delivery is not connected.', 'يظهر المشترك المحفوظ في قائمة المسجّلين لهذا الحدث. إرسال التأكيد تلقائياً غير موصول.')}</p></Panel></div></div></>;
  if (tab === 'registrants') return <>{head}<div className="tabbody"><div className="toolbar" style={{
        marginBottom: "14px",
        gap: "8px",
        flexWrap: "wrap"
      }}><button className="btn btn-primary" data-register-participant="" disabled={!!(!selected.open || selected.taken >= selected.cap)}><Icon name='plus' size={16} />{L('Register participant', 'تسجيل مشترك')}</button>{" "}<button className="btn btn-secondary" data-select-checkin={chosenEvent.id}>{L('Open event check-in', 'فتح تسجيل الوصول للحدث')}</button></div><Table pick={true} cols={[{
        label: L('Participant', 'المشترك'),
        sort: true
      }, {
        label: L('Consent', 'الموافقة'),
        cls: 'shrink'
      }, {
        label: L('Transport', 'النقل'),
        cls: 'hide-sm'
      }, {
        label: L('Paid', 'المدفوع'),
        cls: 'num'
      }, {
        label: L('Status', 'الحالة'),
        cls: 'shrink'
      }, {
        label: L('Next action', 'الخطوة التالية'),
        cls: 'shrink'
      }]} rows={selectedRows.map(r => ({
        cells: [<Who p={person(r.p)} />, consentPill(r, selected), <span className="dim">{transportLabel(r, selected)}</span>, <><span className="num">{registrationMoney(r.paid, selected)}</span>{paymentPill(r, selected)}</>, <Pill label={placeLabel(r)} tone={r.status === 'registered' ? 'success' : 'warning'} />, <button className="btn btn-secondary btn-dense" data-registration-review={r.id}>{registrationNext(r, selected)}</button>]
      }))} empty={<Empty glyph='registr' title={L('No participants registered yet', 'لا مشتركون مسجّلون بعد')} body={L('Choose Register participant above to reserve the first place for this event.', 'اختر تسجيل مشترك أعلاه لحجز المقعد الأول لهذا الحدث.')} />} />{" "}{!selected.open ? <C.InlineAlert tone='info' title={L('Registration is closed', 'التسجيل مغلق')} body={L('Open the form before adding participants.', 'افتح الاستمارة قبل إضافة المشتركين.')} /> : selected.taken >= selected.cap ? <C.InlineAlert tone='warning' title={L('Event capacity reached', 'بلغ الحدث سعته')} body={L('Increase the reviewed capacity before adding participants.', 'زد السعة بعد مراجعتها قبل إضافة مشتركين.')} /> : ''}{" "}<p className="t-caption dim" style={{
        marginTop: "16px"
      }}>{L('Use the participant reference in this event’s check-in session. A registration records a place; check-in records arrival.', 'استعمل مرجع المشترك في جلسة الوصول الخاصة بهذا الحدث. يثبت التسجيل المقعد، ويثبت تسجيل الوصول الحضور.')}</p></div></>;
  if (tab === 'payments') {
    const paymentRows = selectedRows.map(r => {
      const form = REGISTRATIONS.find(f => f.id === r.registrationId),
        due = registrationDue(r, form),
        payments = r.payments || [];
      const methods = payments.map(payment => ({
        cash: L('Cash', 'نقداً'),
        bank: L('Bank transfer', 'تحويل مصرفي'),
        omt: 'OMT'
      })[payment.method] || payment.method).join(', ');
      return {
        cells: [<Who p={person(r.p)} />, methods ? methods : <span className="dim">{L('Not recorded', 'غير مسجّلة')}</span>, <span className="num">{registrationMoney(r.paid || 0, form)}</span>, paymentPill(r, form)]
      };
    });
    return <>{head}<div style={{
        marginTop: "20px"
      }} className="splitview"><Panel title={L('Payment tracking', 'متابعة الدفعات')} tight={true}><Table cols={[{
            label: L('Participant', 'المشترك')
          }, {
            label: L('Method', 'الطريقة'),
            cls: 'hide-sm'
          }, {
            label: L('Amount', 'المبلغ'),
            cls: 'num'
          }, {
            label: L('Status', 'الحالة'),
            cls: 'shrink'
          }]} rows={paymentRows} /></Panel>{" "}<div className="sidecol"><Panel title={L('Providers', 'مزوّدو الدفع')}><p className="t-body dim" style={{
              fontSize: "14px"
            }}>{L('Cash and bank transfers are recorded by hand with the currency they were paid in. An online provider is added only after supported countries, fees and refund behaviour have been confirmed.', 'النقد والتحاويل تُسجَّل يدوياً بعملة الدفع. ولا يُضاف مزوّد إلكتروني إلا بعد تثبيت الدول المدعومة والرسوم وسلوك الاسترجاع.')}</p>{" "}<div className="row" style={{
              gap: "8px",
              marginTop: "14px",
              flexWrap: "wrap"
            }}><span className="chip chip-on">{L('Cash', 'نقداً')}</span>{" "}<span className="chip chip-on">{L('Bank transfer', 'تحويل')}</span><span className="chip">OMT</span>{" "}<span className="chip">{L('Card — not connected', 'بطاقة — غير موصولة')}</span></div></Panel></div></div></>;
  }
  if (tab === 'refunds') return <>{head}<div className="tabbody"><Table cols={[{
        label: L('Participant', 'المشترك')
      }, {
        label: L('Reason', 'السبب')
      }, {
        label: L('Amount', 'المبلغ'),
        cls: 'num'
      }, {
        label: L('Status', 'الحالة'),
        cls: 'shrink'
      }, {
        label: L('Date', 'التاريخ'),
        cls: 'hide-sm'
      }]} rows={REFUNDS.map(r => ({
        cells: [<Who p={person(r.p)} />, <span className="dim">{L(r.why, r.whyAr)}</span>, <span className="num">{usd(r.amount)}</span>, <Status k={r.status} />, <span className="mono dim">{fmtDate(r.at)}</span>]
      }))} />{" "}<p className="t-caption dim" style={{
        marginTop: "16px"
      }}>{L('A refund reverses the contribution rather than deleting it, so the counting session it belonged to still balances.', 'الاسترجاع يعكس المساهمة ولا يحذفها، فتبقى جلسة العدّ التي تنتمي إليها متوازنة.')}</p></div></>;
  const rows = REGISTRATIONS.map(r => {
    const pct = r.cap ? Math.min(100, Math.round(r.taken / r.cap * 100)) : 0;
    const linked = !!linkedEvent(r),
      next = !linked ? L('Link an event', 'اربط حدثاً') : !r.open ? L('Open the form to accept people', 'افتح الاستمارة لقبول الأشخاص') : r.taken >= r.cap ? L('At capacity; review participants', 'بلغت السعة؛ راجع المشتركين') : L('Register or review participants', 'سجّل المشتركين أو راجعهم');
    return {
      cells: [<><b>{L(r.event, r.eventAr)}</b>{!linkedEvent(r) ? <small className="dim" style={{
          display: "block"
        }}>{L('Legacy form · link an event before use', 'استمارة قديمة · اربطها بحدث قبل الاستخدام')}</small> : ''}</>, <span style={{
        display: "block",
        minWidth: "150px"
      }}><span className="t-caption dim tnum">{r.taken} / {r.cap}</span>{" "}<span className="meter" style={{
          marginTop: "6px"
        }}><i style={css(`width:${pct}%`)} /></span></span>, r.waiting ? <Pill label={`${r.waiting} ${L('waiting', 'بالانتظار')}`} tone='warning' /> : <span className="dimmer">—</span>, r.fee ? <span className="num">{registrationMoney(r.fee, r)}</span> : <span className="dim">{L('Free', 'مجاني')}</span>, <span className="dim">{fmtDate(r.deadline)}</span>, r.open ? <Status k='open' /> : <Status k='draft' />, <span className="t-caption dim">{next}</span>, <span className="row" style={{
        gap: "6px",
        justifyContent: "flex-end"
      }}><button className="btn btn-secondary btn-dense" data-open-registration={r.id}>{linked ? L('Participants', 'المشتركون') : L('Link event', 'ربط الحدث')}</button>{CR.recBtn('registration', r.id)}</span>]
    };
  });
  return <>{head}<div className="tabbody"><div className="stats" style={{
        marginBottom: "16px"
      }}><Stat k={L('Forms', 'الاستمارات')} v={REGISTRATIONS.length} d={L('for parish events', 'لأحداث الرعية')} />{" "}<Stat k={L('Open forms', 'استمارات مفتوحة')} v={REGISTRATIONS.filter(form => form.open && linkedEvent(form)).length} d={L('accepting participants', 'تقبل المشتركين')} />{" "}<Stat k={L('Participants', 'المشتركون')} v={REGISTRANTS.length} d={L('across linked forms', 'في الاستمارات المرتبطة')} /></div><Table cols={[{
        label: L('Event', 'الحدث'),
        sort: true
      }, {
        label: L('Capacity', 'السعة')
      }, {
        label: L('Waiting', 'الانتظار'),
        cls: 'hide-sm'
      }, {
        label: L('Fee', 'الرسم'),
        cls: 'num hide-sm'
      }, {
        label: L('Closes', 'يقفل'),
        cls: 'hide-md'
      }, {
        label: L('Status', 'الحالة'),
        cls: 'shrink'
      }, {
        label: L('Next step', 'الخطوة التالية'),
        cls: 'hide-sm'
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={rows} empty={<Empty glyph='registr' title={L('No registration forms', 'لا استمارات تسجيل')} body={L('Create one for a retreat, a lunch or a catechism year.', 'أنشئ واحدة لخلوة أو غداء أو سنة تعليم.')} action={<button className="btn btn-primary btn-dense" data-act="form-new">{L('New form', 'استمارة جديدة')}</button>} />} /></div></>;
}
function registrationReview(id) {
  const row = REGISTRANTS.find(item => item.id === id),
    form = row && REGISTRATIONS.find(item => item.id === row.registrationId);
  if (row && form) participantForm(form, row);
}
registrations.mount = host => {
  host.querySelector('[data-register-participant]')?.addEventListener('click', () => F.registerParticipant());
  host.querySelectorAll('[data-registration-review]').forEach(button => button.addEventListener('click', () => registrationReview(button.dataset.registrationReview)));
  host.querySelector('#registration-select')?.addEventListener('change', e => {
    selectRegistration(e.target.value);
    bus.refresh();
  });
  host.querySelectorAll('[data-open-registration]').forEach(b => b.addEventListener('click', () => {
    const form = REGISTRATIONS.find(r => r.id === b.dataset.openRegistration);
    if (!linkedEvent(form)) return CR.edit('registration', form?.id);
    selectRegistration(form.id);
    go('registrations/registrants');
  }));
  host.querySelectorAll('[data-select-checkin]').forEach(b => b.addEventListener('click', () => {
    selectCheckinEvent(b.dataset.selectCheckin);
    go('checkin');
  }));
  host.querySelector('#regqr')?.addEventListener('click', () => openModal({
    title: L('Registration code', 'رمز التسجيل'),
    sub: L('Opens the form, and the reference it issues connects the attendee to the right check-in session.', 'يفتح الاستمارة، والرقم الذي يصدره يربط المشترك بجلسة التسجيل الصحيحة.'),
    body: <div style={{
      display: "grid",
      placeItems: "center",
      padding: "8px 0"
    }}><div style={{
        width: "150px",
        height: "150px",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        display: "grid",
        placeItems: "center",
        background: "var(--muted)",
        color: "var(--text-3)"
      }}><Icon name='qr' size={64} /></div></div>
  }));
};

/* ═══════════════ 10 · check-in & safeguarding ═══════════════ */
const CTABS = () => [['', 'Room', 'الصف'], ['pickup', 'Pickup', 'الاستلام'], ['incidents', 'Incidents', 'الحوادث', INCIDENTS.length], ['evacuation', 'Evacuation', 'الإخلاء']];
export function checkin(tab = '') {
  const chosenEvent = selectableCheckinEvents().find(e => e.id === S.ui.checkinEventId);
  const session = selectedCheckin() || {
    rows: [],
    present: 0,
    expected: chosenEvent ? REGISTRANTS.filter(r => REGISTRATIONS.some(f => f.id === r.registrationId && f.eventId === chosenEvent.id)).length : 0,
    awaitingGuardian: 0,
    room: chosenEvent?.venue
  };
  const eventParticipants = new Set(chosenEvent ? REGISTRANTS.filter(r => REGISTRATIONS.some(f => f.id === r.registrationId && f.eventId === chosenEvent.id)).map(r => r.p) : []);
  const expected = eventParticipants.size;
  const head = <><PageHead crumbs={[{
      label: L('Parish life', 'حياة الرعية')
    }, {
      label: L('Check-in', 'التسجيل عند الباب')
    }]} title={chosenEvent ? L(chosenEvent.title, chosenEvent.titleAr) : L('Check-in', 'تسجيل الوصول')} sub={chosenEvent ? <>{fmtDate(chosenEvent.d)}{" "}{chosenEvent.t} · {L(eventVenue(chosenEvent)?.name || '', eventVenue(chosenEvent)?.ar || '')} · <span className="tnum">{session.present}</span>{" "}{L('present of', 'حاضر من')}{" "}<span className="tnum">{expected}</span></> : L('Select the event whose registered participants are arriving. No event is selected by default.', 'اختر الحدث الذي يصل إليه المشتركون. لا يُحدّد حدث افتراضياً.')} actions={chosenEvent ? <><button className="btn btn-secondary" data-act="scan"><Icon name='qr' size={17} />{L('Enter reference', 'إدخال الرقم')}</button>{" "}<button className="btn btn-secondary" id="tags"><Icon name='print' size={17} />{L('Name tags', 'بطاقات الأسماء')}</button>{" "}<button className="btn btn-primary" data-act="checkin-manual"><Icon name='plus' size={17} />{L('Manual check-in', 'تسجيل يدوي')}</button></> : ''} /><div className="toolbar" style={{
      margin: "18px 0"
    }}><label className="label" htmlFor="checkin-event">{L('Check-in event', 'حدث تسجيل الوصول')}</label>{" "}<Select id="checkin-event" style={{
        maxWidth: "380px"
      }}><option value="">{L('Select event', 'اختر حدثاً')}</option>{selectableCheckinEvents().map(e => <option value={e.id} selected={!!(chosenEvent?.id === e.id)}>{L(e.title, e.titleAr)} · {e.d}{" "}{e.t} · {eventVenue(e)?.name || ''}</option>)}</Select></div><TabBar base='checkin' items={CTABS()} active={tab} /></>;
  if (!chosenEvent) return <>{head}<div className="tabbody"><Empty glyph='registr' title={L('Select an event to check in', 'اختر حدثاً لتسجيل الوصول')} body={L('Only events with linked registration forms appear above. Mass and feast liturgies are not eligible.', 'تظهر فقط الأحداث المرتبطة باستمارات تسجيل. القداديس واحتفالات الأعياد غير مشمولة.')} /></div></>;
  if (tab === 'pickup') return <>{head}<div className="tabbody"><C.InlineAlert tone='warning' title={L('Check-in and release are separate, auditable actions', 'التسجيل والتسليم إجراءان منفصلان قابلان للتدقيق')} body={L('A restricted entry means do not release, whatever code is presented. Call a member of staff.', 'القيد المقيَّد يعني عدم التسليم مهما كان الرمز المقدَّم. نادِ أحد الموظّفين.')} />{" "}<div className="stack" style={{
        gap: "16px",
        marginTop: "16px"
      }}>{nodesOr([...eventParticipants].map(pid => {
          const v = PICKUP[pid] || {
            approved: [],
            restricted: [],
            required: false
          };
          return <section className="panel"><div className="panel-h"><Who p={person(pid)} /><span style={{
                marginInlineStart: "auto"
              }} />{" "}{v.restricted.length ? <Pill label={L('Restricted', 'مقيّد')} tone='danger' mark='lock' /> : v.required === false || !PICKUP[pid] ? <Pill label={L('No pickup needed', 'لا حاجة إلى استلام')} tone='success' /> : <Pill label={L('Pickup required', 'يتطلب الاستلام')} tone='warning' />}</div>{" "}<div className="panel-b"><label className="check"><input type="checkbox" data-pickup-required={pid} defaultChecked={!!(v.required !== false && !!PICKUP[pid])} disabled={!!v.restricted.length} /><span>{L('Requires an authorised pickup', 'يتطلب استلاماً من شخص مفوّض')}</span></label>{" "}{v.required === false || !PICKUP[pid] ? <p className="help">{L('This participant can check out without a pickup code.', 'يمكن لهذا المشترك تسجيل الخروج بلا رمز استلام.')}</p> : ''}{" "}<div className="ac-group" style={{
                paddingInline: 0
              }}>{L('Approved to collect', 'مفوَّضون بالاستلام')}</div>{" "}{v.approved.map(([en, ar, rel], ai) => <div className="listrow" style={{
                paddingInline: 0
              }}><span className="grow"><b>{isAr() ? ar : en}</b><small>{rel}</small></span>{" "}<C.IconBtn ico='trash' label={L('Remove', 'إزالة')} data-act={`pickup-remove:${pid}|${ai}`} /></div>)}{" "}{v.restricted.length ? <><div className="divider" />{" "}{v.restricted.map(([en, ar]) => <C.InlineAlert tone='danger' title={L('Do not release', 'لا تُسلّم')} body={L(en, ar)} />)}</> : ''}{" "}<button className="btn btn-secondary btn-dense" style={{
                marginTop: "12px"
              }} data-act={`pickup-add:${pid}`}><Icon name='plus' size={15} />{L('Add an authorised person', 'إضافة شخص مفوَّض')}</button></div></section>;
        }), <p className="help">{L('No registered participants at this event.', 'لا مشتركون مسجّلون في هذا الحدث.')}</p>)}</div></div></>;
  if (tab === 'incidents') return <>{head}<div className="tabbody"><C.InlineAlert tone='info' title={L('Parish-wide incident log', 'سجل حوادث الرعية')} body={L('Existing incident reports are parish-wide and are not linked to the selected event. The log is restricted to authorised staff.', 'تقارير الحوادث الحالية على مستوى الرعية وغير مرتبطة بالحدث المحدّد. يقتصر السجل على الموظفين المخوّلين.')} />{" "}<div style={{
        marginTop: "16px"
      }}><Table cols={[{
          label: L('When', 'الوقت')
        }, {
          label: L('Room', 'المكان'),
          cls: 'hide-sm'
        }, {
          label: L('What happened', 'ما حدث')
        }, {
          label: L('Recorded by', 'سجّله'),
          cls: 'hide-md'
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={INCIDENTS.map(i => ({
          cells: [<span className="mono dim">{i.at}</span>, <span className="dim">{L(venue(i.room).name, venue(i.room).ar)}</span>, L(i.what, i.whatAr), <Who p={person(i.by)} />, <button className="btn btn-secondary btn-dense" data-act={`incident-open:${i.id}`}>{L('Open', 'فتح')}</button>]
        }))} /></div>{" "}<button className="btn btn-secondary" style={{
        marginTop: "16px"
      }} data-act="incident-new"><Icon name='plus' size={17} />{L('Record an incident', 'تسجيل حادث')}</button></div></>;
  if (tab === 'evacuation') return <>{head}<div className="tabbody"><C.InlineAlert tone='info' title={L('Selected event roster', 'لائحة الحدث المحدّد')} body={L('This list shows the people currently checked in to this event. It does not count everyone in the building. Emergency message delivery is not connected.', 'تُظهر هذه اللائحة الموجودين حالياً في هذا الحدث فقط، ولا تشمل كل الموجودين في المبنى. إرسال رسائل الطوارئ غير موصول.')} />{" "}<div style={{
        marginTop: "16px"
      }}><Panel title={L('Present participants', 'المشتركون الحاضرون')} tight={true}><Table cols={[{
            label: L('Participant', 'المشترك')
          }, {
            label: L('Location', 'المكان')
          }, {
            label: L('Arrived', 'وقت الوصول')
          }]} rows={session.rows.map(row => ({
            cells: [<Who p={person(row.p)} />, L(eventVenue(chosenEvent)?.name || '', eventVenue(chosenEvent)?.ar || ''), <span className="mono">{row.in || ''}</span>]
          }))} empty={<Empty glyph='people' title={L('No participants checked in', 'لا مشتركون حاضرون')} body={L('The event roster updates as participants arrive.', 'تتحدّث لائحة الحدث عند وصول المشتركين.')} />} /></Panel></div>{" "}<button className="btn btn-secondary" style={{
        marginTop: "14px"
      }} data-act="print"><Icon name='print' size={17} />{L('Print event roster', 'طباعة لائحة الحدث')}</button></div></>;

  /* room roster */
  const rows = session.rows.map(r => {
    const p = person(r.p);
    return <div className="listrow"><Who p={p} />{" "}<span className="grow">{r.alert ? <span className="pill pill-danger"><span className="dot" />{r.alert}</span> : ''}</span>{" "}<span className="mono dim" dir="ltr">{L('in', 'دخول')}{" "}{r.in}</span>{" "}<span className="t-caption dim">{r.code ? <>{r.guardian && r.guardian !== '—' ? `${L('Pickup', 'الاستلام')}: ${r.guardian} · ` : ''}<b className="mono">{r.code}</b></> : L('No pickup needed', 'لا حاجة إلى استلام')}</span>{" "}<button className="btn btn-secondary btn-dense" data-act={`checkout:${r.p}`}>{L('Check out', 'تسجيل خروج')}</button></div>;
  });
  return <>{head}<div className="stats" style={{
      margin: "20px 0 24px"
    }}><Stat k={L('Present now', 'الحاضرون الآن')} v={session.rows.length} d={`${L('registered', 'مسجّل')} ${expected}`} />{" "}<Stat k={L('Awaiting pickup', 'بانتظار الاستلام')} v={session.rows.filter(r => !!r.code).length} d={L('pickup code issued', 'صدر رمز استلام')} />{" "}<Stat k={L('No pickup needed', 'لا حاجة إلى استلام')} v={session.rows.filter(r => !r.code).length} d={L('may check out normally', 'يمكنهم تسجيل الخروج مباشرةً')} /></div>{" "}<Panel title={L('Participants checked in', 'المشتركون الحاضرون')} tight={true}>{rows || <p className="help">{L('No one has checked in yet.', 'لم يسجّل أحد وصوله بعد.')}</p>}</Panel>{" "}<C.InlineAlert tone='warning' title={L('Confirm identity before releasing a participant', 'تحقّق من الهوية قبل تسليم المشترك')} body={L('Every release, exception and override is recorded with the name of whoever approved it.', 'كل تسليم واستثناء وتجاوز يُسجَّل باسم من وافق عليه.')} /></>;
}
checkin.mount = host => {
  host.querySelectorAll('[data-pickup-required]').forEach(box => box.addEventListener('change', () => {
    const pid = box.dataset.pickupRequired;
    PICKUP[pid] ||= {
      approved: [],
      restricted: [],
      required: false
    };
    if (PICKUP[pid].restricted?.length && !box.checked) {
      box.checked = true;
      return;
    }
    PICKUP[pid].required = box.checked;
    const row = selectedCheckin()?.rows.find(r => r.p === pid);
    if (row) {
      row.pickupRequired = box.checked;
      row.code = box.checked ? row.code || String(1000 + Math.floor(Math.random() * 9000)) : '';
    }
    bus.refresh();
  }));
  host.querySelector('#checkin-event')?.addEventListener('change', e => {
    selectCheckinEvent(e.target.value);
    bus.refresh();
  });
  host.querySelector('#tags')?.addEventListener('click', () => openModal({
    title: L('Print name tags', 'طباعة بطاقات الأسماء'),
    sub: L('Choose what goes on the label. Nothing beyond what the room needs.', 'اختر ما يظهر على البطاقة. لا شيء يتجاوز حاجة الصف.'),
    body: <div className="stack" style={{
      gap: "10px"
    }}><C.CheckRow label={L('First name', 'الاسم الأول')} checked={true} />{" "}<C.CheckRow label={L('Room', 'الصف')} checked={true} />{" "}<C.CheckRow label={L('Guardian code', 'رمز وليّ الأمر')} checked={true} />{" "}<C.CheckRow label={L('Medical alert symbol (no detail)', 'رمز تنبيه طبي (بلا تفاصيل)')} checked={true} />{" "}<C.CheckRow label={L('Full name and phone', 'الاسم الكامل والهاتف')} note={L('not recommended', 'غير مستحسن')} /></div>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" data-act="print">{L('Print', 'طباعة')}</button></>,
    onMount(el) {}
  }));
};