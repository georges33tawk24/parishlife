import { css, paint } from "../ui/html.js";
/* Module 5 — facilities, equipment, reservations, maintenance, issues, rentals. */
import { t, isAr, num, usd, fmtDate, fmtLong, month, dayShort } from "../../lib/i18n.js";
import { is, bus, S, me } from "../model/store.js";
import { Icon, PageHead, Who, Status, Pill, Table, Empty, Stat, SearchField, openDrawer, openModal, closeOverlays, toast, TabBar, Paged } from "../ui/ui.jsx";
import * as C from "../ui/components.jsx";
import * as CR from "../flows/crud.jsx";
import * as F from "../flows/flows.jsx";
import { VENUES, EQUIPMENT, RESERVATIONS, MAINTENANCE, ISSUES, RENTALS, EVENTS, PEOPLE, TODAY, person, venue, group, resClash, resStatus } from "../model/data.js";
import { onlineMark } from "./online-requests.jsx";
import { occasionText, phoneShow } from "../model/sacrament-requests.js";
const L = (en, ar) => t(en, ar);
const STAGES = [['Requested', 'الطلب'], ['Secretary review', 'مراجعة أمانة السرّ'], ['Priest approval', 'موافقة الكاهن'], ['Approved', 'موافَق عليه']];
const FTABS = () => [['', 'Rooms', 'القاعات'], ['equipment', 'Equipment', 'التجهيزات'], ['maintenance', 'Maintenance', 'الصيانة'], ['issues', 'Issues', 'الأعطال', ISSUES.length], ['rentals', 'External renters', 'الإيجار الخارجي', RENTALS.length]];
export function facilities(tab = '') {
  const head = <><PageHead crumbs={[{
      label: L('Spaces', 'المرافق')
    }, {
      label: L('Facilities', 'المرافق')
    }]} title={L('Facilities and resources', 'المرافق والموارد')} sub={L('Churches, halls, rooms, the kitchen, the courtyard and the field — with capacity, accessibility and usage policy.', 'كنائس وقاعات وغرف ومطبخ وساحة وملعب — مع السعة وإمكانية الوصول وقواعد الاستعمال.')} actions={<button className="btn btn-primary" id="newvenue"><Icon name='plus' size={17} />{L('Add facility', 'إضافة مرفق')}</button>} /><TabBar base='facilities' items={FTABS()} active={tab} /></>;
  if (tab === 'equipment') {
    /* narrow the list by name, and by whether it can go out today, is out, or needs attention */
    const f = S.ui.eqFilter || 'all',
      attention = e => e.cond === 'needs service' || e.cond === 'fair';
    const FILTERS = [['all', L('All', 'الكل'), () => true], ['available', L('Available now', 'متاح الآن'), e => e.qty - e.out > 0], ['loan', L('On loan', 'معار'), e => e.out > 0], ['service', L('Needs attention', 'يحتاج عناية'), attention]];
    const keep = (FILTERS.find(([k]) => k === f) || FILTERS[0])[2];
    return <>{head}<div className="tabbody"><div className="toolbar eqbar" style={{
          marginBottom: "14px"
        }}><div className="grow"><C.SearchClear ph={L('Search equipment', 'ابحث في التجهيزات')} id='eqsearch' data-find="" /></div>{" "}<span className="seg" role="group" aria-label={L('Show', 'عرض')}>{FILTERS.map(([k, lab, test]) => <button type="button" aria-pressed={f === k} data-act={`eq-filter:${k}`}>{lab}<span className="segn">{EQUIPMENT.filter(test).length}</span></button>)}</span></div>{" "}<Table cols={[{
          label: L('Item', 'الصنف'),
          sort: true
        }, {
          label: L('Total', 'الإجمالي'),
          cls: 'num hide-sm'
        }, {
          label: L('On loan', 'معار'),
          cls: 'num hide-sm'
        }, {
          label: L('Available', 'متاح'),
          cls: 'num'
        }, {
          label: L('Custody', 'العهدة'),
          cls: 'hide-md'
        }, {
          label: L('Condition', 'الحالة'),
          cls: 'shrink'
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={EQUIPMENT.filter(keep).map(e => ({
          attrs: 'data-find-item',
          cells: [<b>{L(e.name, e.ar)}</b>, <span className="num">{e.qty}</span>, <span className="num">{e.out}</span>, <span className="num">{e.qty - e.out}</span>, <span className="dim">{e.out ? L('Choir · until 9 Oct', 'الجوقة · حتى ٩ ت١') : L('In store', 'في المستودع')}</span>, e.cond === 'needs service' ? <Pill label={L('Needs service', 'تحتاج صيانة')} tone='warning' /> : e.cond === 'fair' ? <Pill label={L('Fair', 'مقبولة')} tone='warning' /> : <Pill label={L('Good', 'جيدة')} tone='success' />, <span className="row" style={{
            gap: "6px",
            justifyContent: "flex-end"
          }}><button className="btn btn-secondary btn-dense" id={`loan-${e.id}`} disabled={!(e.qty - e.out > 0)}>{L('Loan out', 'إعارة')}</button>{CR.recBtn('equipment', e.id)}</span>]
        }))} empty={EQUIPMENT.length ? <Empty glyph='filter' title={L('Nothing in this view', 'لا شيء في هذا العرض')} body={L('Choose another filter to see the rest of the equipment.', 'اختر مرشّحاً آخر لرؤية بقية التجهيزات.')} action={<button className="btn btn-secondary btn-dense" data-act="eq-filter:all">{L('Show all equipment', 'عرض كل التجهيزات')}</button>} /> : <Empty glyph='rooms' title={L('No equipment recorded', 'لا تجهيزات مسجّلة')} body={L('Add what the parish lends out — microphones, projectors, chairs.', 'أضف ما تعيره الرعية — مايكروفونات، أجهزة عرض، كراسي.')} />} />{" "}<div className="find-empty" hidden><Empty glyph='search' title={L('No equipment matches', 'لا تجهيزات مطابقة')} body={L('Try another name, in English or Arabic.', 'جرّب اسماً آخر، بالعربية أو بالإنكليزية.')} /></div>{" "}<button className="btn btn-secondary" style={{
          marginTop: "16px"
        }} data-act="rec-new:equipment"><Icon name='plus' size={17} />{L('Add equipment', 'إضافة تجهيز')}</button></div></>;
  }
  if (tab === 'maintenance') return <>{head}<div className="tabbody"><Table cols={[{
        label: L('Room', 'القاعة')
      }, {
        label: L('From', 'من')
      }, {
        label: L('To', 'إلى')
      }, {
        label: L('Reason', 'السبب'),
        cls: 'hide-sm'
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={MAINTENANCE.map((m, mi) => ({
        cells: [<b>{L(venue(m.venue).name, venue(m.venue).ar)}</b>, <span className="mono dim">{fmtDate(m.from)}</span>, <span className="mono dim">{fmtDate(m.to)}</span>, <span className="dim">{L(m.why, m.whyAr)}</span>, <button className="btn btn-secondary btn-dense" data-act={`block-cancel:${mi}`}>{L('Cancel block', 'إلغاء الإغلاق')}</button>]
      }))} empty={<Empty glyph='rooms' title={L('No rooms are blocked', 'لا قاعات مُغلقة')} body={L('Block a room for works or cleaning with the button on its card in Rooms.', 'أغلق قاعة للأشغال أو التنظيف من الزرّ على بطاقتها في القاعات.')} />} />{" "}<C.InlineAlert tone='info' title={L('A block stops bookings; it does not close the room', 'الإغلاق يمنع الحجز ولا يقفل القاعة')} body={L('Facility status and time-based availability are separate. A fully booked hall is still open; a blocked one refuses new requests and warns about approved ones inside the window.', 'حالة المرفق والتوفّر الزمني منفصلان. القاعة المحجوزة بالكامل تبقى مفتوحة؛ والمُغلقة ترفض الطلبات الجديدة وتنبّه على الموافَق عليها داخل المدة.')} /></div></>;
  if (tab === 'issues') return <>{head}<div className="tabbody"><Table cols={[{
        label: L('Room', 'القاعة')
      }, {
        label: L('Reported', 'العطل')
      }, {
        label: L('By', 'بواسطة'),
        cls: 'hide-sm'
      }, {
        label: L('When', 'متى'),
        cls: 'hide-md'
      }, {
        label: L('Status', 'الحالة'),
        cls: 'shrink'
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={ISSUES.map(i => ({
        cells: [<b>{venue(i.venue) ? L(venue(i.venue).name, venue(i.venue).ar) : '—'}</b>, L(i.what, i.whatAr), <Who p={person(i.by)} />, <span className="mono dim">{fmtDate(i.at)}</span>, <Status k={i.status} />, <span className="row" style={{
          gap: "6px",
          justifyContent: "flex-end"
        }}>{i.status === 'awaiting-approval' ? <button className="btn btn-secondary btn-dense" data-act={`issue-assign:${i.id}`}>{L('Assign', 'إسناد')}</button> : ''}{CR.recBtn('issue', i.id)}</span>]
      }))} empty={<Empty glyph='check' title={L('Nothing reported', 'لا أعطال مبلَّغ عنها')} body={L('Anything broken in a room can be reported here, with a photo.', 'أيّ عطل في قاعة يُبلَّغ عنه هنا، مع صورة.')} />} />{" "}<button className="btn btn-secondary" style={{
        marginTop: "16px"
      }} id="newissue"><Icon name='plus' size={17} />{L('Report an issue', 'الإبلاغ عن عطل')}</button></div></>;
  if (tab === 'rentals') return <>{head}<div className="tabbody"><Table cols={[{
        label: L('Renter', 'المستأجر')
      }, {
        label: L('Room', 'القاعة'),
        cls: 'hide-sm'
      }, {
        label: L('Date', 'التاريخ')
      }, {
        label: L('Deposit', 'العربون'),
        cls: 'num'
      }, {
        label: L('Charge', 'البدل'),
        cls: 'num'
      }, {
        label: L('Status', 'الحالة'),
        cls: 'shrink'
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={RENTALS.map(r => ({
        cells: [<b>{L(r.who, r.whoAr)}</b>, <span className="dim">{L(venue(r.venue).name, venue(r.venue).ar)}</span>, <span className="mono dim">{fmtDate(r.date)}</span>, <span className="num">{usd(r.deposit)}</span>, <span className="num">{usd(r.charge)}</span>, <Status k={r.status} />, <a className="btn btn-secondary btn-dense" href="#/finance">{L('In Finance', 'في المالية')}</a>]
      }))} />{" "}<p className="t-caption dim" style={{
        marginTop: "16px"
      }}>{L('Agreements, deposits, charges, payments and refunds for an external renter all run through the finance module, so the hall never keeps its own cash book.', 'الاتفاقات والعرابين والبدلات والدفعات والاسترجاعات للمستأجر الخارجي تمرّ كلها عبر وحدة المالية، فلا تحتفظ القاعة بدفتر نقد خاص بها.')}</p></div></>;
  const cards = VENUES.map(v => <section className="panel"><div className="panel-b"><div style={{
        height: "96px",
        margin: "-24px -24px 16px",
        background: "linear-gradient(135deg,var(--primary-subtle),var(--muted))",
        display: "grid",
        placeItems: "center",
        color: "var(--primary)"
      }}><Icon name='rooms' size={30} /></div>{" "}<div className="row" style={{
        gap: "10px",
        alignItems: "flex-start"
      }}><div style={{
          flex: 1,
          minWidth: 0
        }}><b style={{
            display: "block",
            font: "600 16px/22px var(--sans)"
          }}>{L(v.name, v.ar)}</b>{" "}<small className="t-caption dim">{L(v.kind, v.kindAr)} · {L('seats', 'يتّسع لـ')}{" "}<span className="tnum">{v.cap}</span></small></div>{CR.recBtn('venue', v.id)}</div>{" "}<div className="row" style={{
        gap: "6px",
        marginTop: "12px",
        flexWrap: "wrap"
      }}>{v.access ? <Pill label={L('Step-free access', 'مدخل بلا درج')} tone='success' /> : <Pill label={L('Stairs only', 'درج فقط')} tone='warning' />}{" "}{MAINTENANCE.filter(m => m.venue === v.id).map(m => <Pill label={L(`Blocked ${fmtDate(m.from)} – ${fmtDate(m.to)}`, `مغلقة ${fmtDate(m.from)} – ${fmtDate(m.to)}`)} tone='danger' />)}</div>{" "}<div className="divider" />{" "}<div className="row" style={{
        gap: "6px"
      }}><button className="btn btn-secondary" style={{
          flex: 1,
          minHeight: "34px",
          fontSize: "13px"
        }} data-avail={v.id}><Icon name='events' size={15} />{L('Availability', 'التوفّر')}</button>{" "}<button className="btn btn-secondary" style={{
          flex: 1,
          minHeight: "34px",
          fontSize: "13px"
        }} data-act={`book-room:${v.id}`}><Icon name='plus' size={15} />{L('Book', 'حجز')}</button></div>{" "}<button className="btn btn-ghost roomblock" data-block={v.id}><Icon name='warn' size={15} />{L('Block for maintenance', 'إغلاق للصيانة')}</button></div></section>);
  return <>{head}<Paged style={{
      marginTop: "20px"
    }} className="gridcards">{cards || <Empty glyph='rooms' title={L('No rooms yet', 'لا قاعات بعد')} body={L('Add the church, the hall and every room people can book.', 'أضف الكنيسة والقاعة وكل مكان يمكن حجزه.')} />}</Paged>{" "}<p className="t-caption dim" style={{
      marginTop: "16px"
    }}>{L('Every room carries its capacity, accessibility, photos and usage policy, so a request does not need a phone call to answer.', 'تحمل كل قاعة سعتها وإمكانية الوصول والصور وقواعد الاستعمال، فلا يحتاج الطلب إلى مكالمة هاتفية.')}</p></>;
}

/* ---------- availability: pick any day, see what holds the room and what is still free ---------- */
const mins = hm => {
  const [h, m] = String(hm || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};
const hhmm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const OPEN = [7 * 60, 23 * 60]; /* the parish day the timeline shows */
const blockOn = (vid, date) => MAINTENANCE.find(m => m.venue === vid && m.from <= date && date <= m.to);
const length = n => n >= 60 ? L(`${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}`, `${Math.floor(n / 60)} س${n % 60 ? ` ${n % 60} د` : ''}`) : L(`${n} min`, `${n} د`);

/* what holds the room that day: room requests (with their set-up time) and calendar events; a
   request and the event it was made for are the same thing and are listed once */
function heldOn(vid, date) {
  const res = RESERVATIONS.filter(r => r.venue === vid && r.date === date && r.status !== 'rejected');
  const items = res.map(r => ({
    from: mins(r.from),
    to: mins(r.to),
    buffer: +r.setup || 0,
    title: L(r.title, r.titleAr || r.title),
    state: resStatus(r),
    ref: r.ref
  }));
  for (const e of EVENTS.filter(x => x.venue === vid && x.d === date && x.kind !== 'pending')) {
    if (res.some(r => mins(r.from) === mins(e.t))) continue;
    const len = e.to ? mins(e.to) - mins(e.t) : e.kind === 'mass' ? 60 : e.kind === 'sacr' ? 90 : 120;
    items.push({
      from: mins(e.t),
      to: mins(e.t) + len,
      buffer: 0,
      title: L(e.title, e.titleAr || e.title),
      state: e.kind === 'mass' ? 'mass' : 'event'
    });
  }
  return items.sort((x, y) => x.from - y.from);
}
function freeGaps(items) {
  const gaps = [];
  let at = OPEN[0];
  for (const it of [...items].sort((x, y) => x.from - x.buffer - (y.from - y.buffer))) {
    /* set-up time starts the hold */const start = Math.max(OPEN[0], it.from - it.buffer);
    if (start - at >= 30) gaps.push([at, start]);
    at = Math.max(at, it.to);
  }
  if (OPEN[1] - at >= 30) gaps.push([at, OPEN[1]]);
  return gaps;
}
const STATE = () => ({
  approved: [L('Approved', 'موافَق عليه'), 'success'],
  pending: [L('Pending — holds the slot', 'معلّق — يحجز الوقت'), 'warning'],
  conflict: [L('Clashes with another request', 'يتعارض مع طلب آخر'), 'danger'],
  mass: [L('Mass', 'قدّاس'), 'info'],
  event: [L('Calendar event', 'حدث في الرزنامة'), 'info']
});
function availabilityDrawer(vid) {
  const v = venue(vid);
  if (!v) return;
  let day = S.ui.availDay || isoD(TODAY);
  let shown = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, 1);
  const render = () => {
    const y = shown.getFullYear(),
      m = shown.getMonth(),
      first = new Date(y, m, 1),
      n = new Date(y, m + 1, 0).getDate();
    const cells = [...Array(first.getDay()).fill(null), ...Array.from({
      length: n
    }, (_, i) => new Date(y, m, i + 1))];
    const block = blockOn(vid, day),
      items = block ? [] : heldOn(vid, day),
      gaps = block ? [] : freeGaps(items),
      past = day < isoD(TODAY);
    const pct = x => `${((Math.min(Math.max(x, OPEN[0]), OPEN[1]) - OPEN[0]) / (OPEN[1] - OPEN[0]) * 100).toFixed(2)}%`;
    const width = (a, b) => `${((Math.min(b, OPEN[1]) - Math.max(a, OPEN[0])) / (OPEN[1] - OPEN[0]) * 100).toFixed(2)}%`;
    const rows = block ? [] : [...items.map(it => ({
      at: it.from - it.buffer,
      it
    })), ...gaps.map(g => ({
      at: g[0],
      g
    }))].sort((p, q) => p.at - q.at);
    const S2 = STATE();
    return <div className="avail"><div className="avail-cal"><div className="avail-cal-h"><C.IconBtn ico='chevL' label={L('Previous month', 'الشهر السابق')} data-avm="-1" /><b>{month(m)}{" "}{y}</b><C.IconBtn ico='chevR' label={L('Next month', 'الشهر التالي')} data-avm="1" /></div>{" "}<div className="avail-grid" role="grid">{[0, 1, 2, 3, 4, 5, 6].map(i => <span className="dh">{dayShort(i)}</span>)}{" "}{cells.map(d => {
            if (!d) return <span />;
            const k = isoD(d),
              bl = blockOn(vid, k),
              busy = !bl && heldOn(vid, k).length;
            return <button type="button" className={`ad${k === day ? ' on' : ''}${k === isoD(TODAY) ? ' today' : ''}${k < isoD(TODAY) ? ' past' : ''}${bl ? ' blocked' : ''}`} data-avday={k} aria-pressed={k === day} aria-label={`${fmtLong(d)}${bl ? ' · ' + L('blocked', 'مغلقة') : busy ? ` · ${busy} ${L('booked', 'محجوز')}` : ''}`}>{d.getDate()}{busy ? <i /> : ''}</button>;
          })}</div>{" "}<div className="avail-legend"><span><i className="lg busy" />{L('something booked', 'محجوز جزئياً')}</span><span><i className="lg blocked" />{L('blocked', 'مغلقة')}</span></div>{" "}<label className="avail-jump"><span className="t-caption dim">{L('Or go straight to a date', 'أو اذهب إلى تاريخ')}</span><input className="input" type="date" id="av_date" defaultValue={day} /></label></div>{" "}<div className="avail-day"><div className="avail-day-h"><div><span className="overline">{day === isoD(TODAY) ? L('Today', 'اليوم') : L('Selected day', 'اليوم المحدّد')}</span><h4>{fmtLong(day)}{" "}{day.slice(0, 4)}</h4></div>{" "}<span className="row" style={{
            gap: "6px"
          }}><C.IconBtn ico='chevL' label={L('Previous day', 'اليوم السابق')} data-avd="-1" /><button type="button" className="btn btn-secondary btn-dense" data-avd="0">{L('Today', 'اليوم')}</button><C.IconBtn ico='chevR' label={L('Next day', 'اليوم التالي')} data-avd="1" /></span></div>{" "}{block ? <C.InlineAlert tone='warning' title={L('Blocked for maintenance', 'مغلقة للصيانة')} body={L(`${block.why} · ${fmtDate(block.from)} – ${fmtDate(block.to)}. No new requests are accepted on this day.`, `${block.whyAr || block.why} · ${fmtDate(block.from)} – ${fmtDate(block.to)}. لا تُقبل طلبات جديدة في هذا اليوم.`)} /> : <><div className="avail-strip" aria-hidden="true">{items.map(it => <>{it.buffer ? <span className="seg buf" style={css(`inset-inline-start:${pct(it.from - it.buffer)};width:${width(it.from - it.buffer, it.from)}`)} /> : ''}{" "}<span className={`seg ${it.state}`} style={css(`inset-inline-start:${pct(it.from)};width:${width(it.from, it.to)}`)} title={it.title} /></>)}</div>{" "}<div className="avail-scale" aria-hidden="true">{[7, 11, 15, 19, 23].map(h => <span>{String(h).padStart(2, '0')}:00</span>)}</div>{" "}{past ? <p className="t-caption dim" style={{
            margin: "10px 0 0"
          }}><Icon name='info' size={14} />{" "}{L('This day has passed — it is shown for reference and cannot be booked.', 'مضى هذا اليوم — يُعرض للاطّلاع ولا يمكن الحجز فيه.')}</p> : ''}{" "}<p className="t-caption dim" style={{
            margin: "10px 0 8px"
          }}>{items.length ? L(`${items.length} booking${items.length === 1 ? '' : 's'} · ${gaps.length} free slot${gaps.length === 1 ? '' : 's'} between 07:00 and 23:00`, `${items.length} حجوزات · ${gaps.length} أوقات متاحة بين 07:00 و23:00`) : L('Free all day, 07:00 – 23:00.', 'متاحة طوال اليوم، 07:00 – 23:00.')}</p>{" "}<ol className="avail-list">{rows.map(({
              it,
              g
            }) => it ? <li className="held"><span className="tm mono">{hhmm(it.from)}–{hhmm(it.to)}</span><span className="grow"><b>{it.title}</b>{it.buffer ? <small>{L(`plus ${it.buffer} min to set up before`, `مع ${it.buffer} د للتجهيز قبلها`)}</small> : it.ref ? <small className="mono">{it.ref}</small> : ''}<span className="avail-state"><Pill label={S2[it.state][0]} tone={S2[it.state][1]} /></span></span></li> : <li className="free"><span className="tm mono">{hhmm(g[0])}–{hhmm(g[1])}</span><span className="grow"><b>{L('Free', 'متاحة')}</b><small>{length(g[1] - g[0])}</small></span>{" "}{past ? '' : <button type="button" className="btn btn-secondary btn-dense" data-avbook={`${hhmm(g[0])}|${hhmm(Math.min(g[1], g[0] + 120))}`}><Icon name='plus' size={14} />{L('Book', 'احجز')}</button>}</li>)}</ol></>}</div></div>;
  };
  openDrawer({
    large: true,
    title: L(`Availability — ${v.name}`, `التوفّر — ${v.ar || v.name}`),
    sub: `${L(v.kind, v.kindAr || v.kind)} · ${L('seats', 'يتّسع لـ')} ${v.cap}${v.access ? ' · ' + L('step-free access', 'مدخل بلا درج') : ''}`,
    body: <div id="avbody">{render()}</div>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-primary" id="av_book" style={{
        marginInlineStart: "auto"
      }}><Icon name='plus' size={16} /><span /></button></>,
    onMount(el) {
      const book = (from, to) => {
        S.ui.availDay = day;
        CR.create('reservation', {
          venue: vid,
          date: day,
          ...(from ? {
            from,
            to
          } : {})
        });
      };
      const redraw = () => {
        paint(el.querySelector('#avbody'), render());
        const blocked = !!blockOn(vid, day),
          foot = el.querySelector('#av_book');
        foot.disabled = blocked || day < isoD(TODAY);
        foot.querySelector('span').textContent = L(`Book on ${fmtDate(day)}`, `احجز في ${fmtDate(day)}`);
        const go = d => {
          day = d;
          shown = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1);
          S.ui.availDay = d;
          redraw();
        };
        el.querySelectorAll('[data-avday]').forEach(b => b.addEventListener('click', () => go(b.dataset.avday)));
        el.querySelectorAll('[data-avm]').forEach(b => b.addEventListener('click', () => {
          shown = new Date(shown.getFullYear(), shown.getMonth() + +b.dataset.avm, 1);
          redraw();
        }));
        el.querySelectorAll('[data-avd]').forEach(b => b.addEventListener('click', () => {
          const n = +b.dataset.avd,
            d = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n);
          go(n ? isoD(d) : isoD(TODAY));
        }));
        el.querySelector('#av_date')?.addEventListener('change', e => {
          if (e.target.value) go(e.target.value);
        });
        el.querySelectorAll('[data-avbook]').forEach(b => b.addEventListener('click', () => {
          const [f, t2] = b.dataset.avbook.split('|');
          book(f, t2);
        }));
      };
      el.querySelector('#av_book').addEventListener('click', () => book());
      redraw();
    }
  });
}

/* Block one room: pick the dates and the reason; anything already booked inside them is listed,
   because those people need to be told and moved. */
function blockDrawer(vid) {
  const v = venue(vid);
  if (!v) return;
  const start = isoD(TODAY),
    end = isoD(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 2));
  const inside = (from, to) => [...RESERVATIONS.filter(r => r.venue === vid && r.status !== 'rejected' && r.date >= from && r.date <= to).map(r => ({
    d: r.date,
    t: r.from,
    title: L(r.title, r.titleAr || r.title),
    state: r.status,
    who: person(r.by)
  })), ...EVENTS.filter(e => e.venue === vid && e.kind !== 'pending' && e.d >= from && e.d <= to && !RESERVATIONS.some(r => r.venue === vid && r.date === e.d && r.from === e.t)).map(e => ({
    d: e.d,
    t: e.t,
    title: L(e.title, e.titleAr || e.title),
    state: e.kind === 'mass' ? 'mass' : 'event'
  }))].sort((x, y) => (x.d + x.t).localeCompare(y.d + y.t));
  openDrawer({
    title: L(`Block ${v.name} for maintenance`, `إغلاق ${v.ar || v.name} للصيانة`),
    sub: L('New requests for this room are refused for those dates. Anything already booked inside them is listed below.', 'تُرفض طلبات هذه القاعة الجديدة في تلك الأيام، وتُعرض أدناه الحجوزات القائمة داخلها.'),
    body: <><div className="formgrid"><C.Field label={L('From', 'من')} type='date' value={start} id='bk_f' req={true} />{" "}<C.Field label={L('To', 'إلى')} type='date' value={end} id='bk_t' req={true} /></div>{" "}<C.Field label={L('Reason', 'السبب')} id='bk_w' ph={L('Damp treatment on the north wall', 'معالجة الرطوبة في الجدار الشمالي')} />{" "}<C.PersonPicker label={L('Responsible staff', 'المسؤول')} id='mstaff' />{" "}<div id="bk_inside" /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="doblock" style={{
        marginInlineStart: "auto"
      }}><Icon name='warn' size={16} />{L('Block the room', 'إغلاق القاعة')}</button></>,
    onMount(el) {
      const f = () => el.querySelector('#bk_f').value,
        t2 = () => el.querySelector('#bk_t').value;
      const show = () => {
        const list = f() && t2() && f() <= t2() ? inside(f(), t2()) : [];
        paint(el.querySelector('#bk_inside'), !f() || !t2() ? '' : f() > t2() ? <C.InlineAlert tone='warning' title={L('The block ends before it starts', 'ينتهي الإغلاق قبل أن يبدأ')} body={L('Check the two dates.', 'تحقّق من التاريخين.')} /> : !list.length ? <C.InlineAlert tone='success' title={L('Nothing is booked in those dates', 'لا حجوزات في تلك الأيام')} body={L(`${v.name} is free to close.`, `يمكن إغلاق ${v.ar || v.name}.`)} /> : <><C.InlineAlert tone='warning' title={list.length === 1 ? L('One booking falls inside these dates', 'حجز واحد يقع داخل هذه الأيام') : L(`${list.length} bookings fall inside these dates`, `${list.length} حجوزات تقع داخل هذه الأيام`)} body={L('Tell the people concerned and move them to another room or day.', 'أبلغ المعنيّين وانقلهم إلى قاعة أو يوم آخر.')} /><ul className="blocklist">{list.map(x => <li><span className="mono dim">{fmtDate(x.d)} · {x.t}</span><b>{x.title}</b>{x.who ? <small>{L(x.who.lat, x.who.ar)}</small> : ''}</li>)}</ul></>);
      };
      ['#bk_f', '#bk_t'].forEach(q => el.querySelector(q).addEventListener('change', show));
      show();
      el.querySelector('#doblock').addEventListener('click', () => {
        const typed = el.querySelector('#mstaff').value.trim(),
          found = typed && PEOPLE.find(p => p.lat === typed || p.ar === typed);
        if (![F.need(el, '#bk_f', L('Choose the first day', 'اختر اليوم الأول')), F.need(el, '#bk_t', L('Choose the last day', 'اختر اليوم الأخير')), F.need(el, '#mstaff', L('Choose someone from the list, or leave it empty', 'اختر شخصاً من اللائحة، أو اتركه فارغاً'), () => !typed || !!found)].every(Boolean)) return;
        if (f() > t2()) return show();
        const why = el.querySelector('#bk_w').value.trim() || L('Maintenance', 'صيانة');
        const staff = found ? found.id : me().id;
        const entry = {
          venue: vid,
          from: f(),
          to: t2(),
          why,
          whyAr: why,
          by: staff
        };
        MAINTENANCE.unshift(entry);
        closeOverlays();
        bus.refresh();
        toast(L('Room blocked', 'أُغلقت القاعة'), `${L(v.name, v.ar || v.name)} · ${fmtDate(f())} – ${fmtDate(t2())}`, 'success', {
          action: {
            label: L('Undo', 'تراجع'),
            fn: () => {
              const i = MAINTENANCE.indexOf(entry);
              if (i >= 0) MAINTENANCE.splice(i, 1);
              bus.refresh();
            }
          }
        });
      });
    }
  });
}
facilities.mount = host => {
  host.querySelectorAll('[data-block]').forEach(b => b.addEventListener('click', () => blockDrawer(b.dataset.block)));
  host.querySelectorAll('[data-avail]').forEach(b => b.addEventListener('click', () => availabilityDrawer(b.dataset.avail)));
  host.querySelector('#newvenue')?.addEventListener('click', () => CR.create('venue'));
  host.querySelector('#newissue')?.addEventListener('click', () => CR.create('issue'));
  host.querySelectorAll('[id^="loan-"]').forEach(b => b.addEventListener('click', () => {
    const eq = EQUIPMENT.find(x => 'loan-' + x.id === b.id);
    openModal({
      title: L('Loan out equipment', 'إعارة تجهيزات'),
      sub: L(eq.name, eq.ar) + ` · ${eq.qty - eq.out} ${L('available', 'متاح')}`,
      body: <>{<C.PersonPicker label={L('Taken by', 'المستلم')} id='loanp' />}{" "}{<C.Stepper label={L('Quantity', 'العدد')} value={2} id='loanq' />}{" "}{<C.Field label={L('Back by', 'الإعادة قبل')} type='date' value='2026-10-12' />}{" "}{<C.CheckRow label={L('Condition checked on the way out', 'فُحصت الحالة عند الخروج')} checked={true} />}</>,
      foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="doloan">{L('Record loan', 'تسجيل الإعارة')}</button></>,
      onMount(el) {
        el.querySelector('#doloan').addEventListener('click', () => {
          const q = Math.min(eq.qty - eq.out, parseInt(el.querySelector('#loanq').value, 10) || 1);
          if (q <= 0) return toast(L('None left to lend', 'لا شيء متبقٍّ للإعارة'), '', 'warning');
          eq.out += q;
          closeOverlays();
          bus.refresh();
          toast(L('Loan recorded', 'سُجّلت الإعارة'), `${q} × ${L(eq.name, eq.ar)}`, 'success', {
            action: {
              label: L('Undo', 'تراجع'),
              fn: () => {
                eq.out -= q;
                bus.refresh();
              }
            }
          });
        });
      }
    });
  }));
};

/* ---------------- reservations ---------------- */
export function reservations() {
  const pending = RESERVATIONS.filter(r => r.status === 'pending');
  const clashing = pending.filter(resClash);
  const f = S.ui.resFilter || 'all';
  const shown = RESERVATIONS.filter(r => f === 'all' || (f === 'mine' ? r.status === 'pending' && (is('priest') ? r.stage === 'priest' : r.stage === 'secretary') : r.status === f));
  const rows = shown.map(r => {
    const v = venue(r.venue),
      by = person(r.by),
      g = r.group ? group(r.group) : null;
    return {
      cls: 'clickable',
      attrs: `data-res="${r.id}" tabindex="0" data-find-item`,
      cells: [<span className="mono" dir="ltr">{r.ref}</span>, <><b style={{
          font: "500 14px/20px var(--sans)"
        }}>{r.memberRequestId ? occasionText(r.title) : L(r.title, r.titleAr)}</b>{onlineMark(r)}{" "}{g ? <small className="t-caption dim" style={{
          display: "block"
        }}>{L(g.name, g.ar)}</small> : ''}</>, <span className="dim">{v ? L(v.name, v.ar) : '—'}</span>, <span className="dim">{fmtDate(r.date)}{" "}<span className="mono" dir="ltr">{r.from}–{r.to}</span></span>, <Who p={by} />, <Status k={resStatus(r)} />, CR.recBtn('reservation', r.id)]
    };
  });
  return <><PageHead crumbs={[{
      label: L('Spaces', 'المرافق')
    }, {
      label: L('Reservations', 'الحجوزات')
    }]} title={L('Reservations', 'الحجوزات')} sub={L('Requests move through a configurable approval chain. A pending request holds the slot until the hold expires or the priest decides.', 'تمرّ الطلبات في سلسلة موافقات قابلة للضبط. والطلب المعلّق يحجز الوقت حتى تنتهي المهلة أو يقرّر الكاهن.')} actions={<><button className="btn btn-secondary" data-go="facilities"><Icon name='events' size={17} />{L('Availability', 'التوفّر')}</button>{" "}<button className="btn btn-primary" data-act="rec-new:reservation"><Icon name='plus' size={17} />{L('Request a room', 'طلب قاعة')}</button></>} />{" "}<div className="stats" style={{
      marginBottom: "24px"
    }}><Stat k={L('Awaiting a decision', 'بانتظار قرار')} v={pending.length} d={clashing.length ? <span className="down">{L(`${clashing.length} with a clash`, `${clashing.length} فيها تعارض`)}</span> : L('no clashes', 'بلا تعارض')} />{" "}<Stat k={L('Approved this month', 'مُوافق عليه هذا الشهر')} v={RESERVATIONS.filter(r => r.status === 'approved').length} d={L(`${new Set(RESERVATIONS.filter(r => r.status === 'approved').map(r => r.venue)).size} rooms in use`, `${new Set(RESERVATIONS.filter(r => r.status === 'approved').map(r => r.venue)).size} قاعات مستعملة`)} />{" "}<Stat k={L('Hall utilisation', 'استخدام القاعة')} v='68%' d={<span className="up">{L('+9 on September', '+٩ عن أيلول')}</span>} />{" "}<Stat k={L('Average decision time', 'متوسط زمن القرار')} v={L('1 day', 'يوم واحد')} d={L('target: 2 days', 'الهدف: يومان')} /></div>{" "}{clashing.slice(0, 1).map(r => {
      const o = resClash(r),
        v = venue(r.venue);
      return <C.InlineAlert tone='warning' title={L(`${r.ref} clashes with ${o.ref}`, `تعارض بين ${r.ref} و${o.ref}`)} body={L(`Both want ${v ? `the ${v.name}` : 'the same room'} on ${fmtDate(r.date)}, counting their set-up time. Approving one refuses the other — each request sees the clash, not the other one’s private details.`, `كلاهما يطلب ${v ? v.ar : 'القاعة نفسها'} في ${fmtDate(r.date)}، مع وقت التحضير. الموافقة على أحدهما ترفض الآخر — ويرى كل طلب التعارض لا تفاصيل الآخر الخاصة.`)} />;
    })}{" "}<div className="toolbar" style={{
      margin: "20px 0 16px"
    }}><span className="seg" role="group" aria-label={L('Show', 'عرض')}>{[['all', 'All', 'الكل'], ['mine', 'Awaiting me', 'بانتظاري'], ['approved', 'Approved', 'موافَق'], ['rejected', 'Rejected', 'مرفوض']].map(([k, en, ar]) => <button aria-pressed={f === k} data-act={`res-filter:${k}`}>{L(en, ar)}</button>)}</span>{" "}<div className="grow" style={{
        maxWidth: "260px",
        marginInlineStart: "auto"
      }}><SearchField ph={L('Reference or title', 'الرقم أو العنوان')} data-find="" /></div></div>{" "}<Table cols={[{
      label: L('Reference', 'الرقم'),
      cls: 'shrink'
    }, {
      label: L('Request', 'الطلب'),
      sort: true
    }, {
      label: L('Room', 'القاعة'),
      cls: 'hide-sm'
    }, {
      label: L('When', 'الموعد'),
      cls: 'shrink hide-sm',
      sort: true
    }, {
      label: L('Requested by', 'مقدَّم من'),
      cls: 'hide-md'
    }, {
      label: L('Status', 'الحالة'),
      cls: 'shrink'
    }, {
      label: '',
      cls: 'shrink'
    }]} rows={rows} empty={<Empty glyph='attend' title={L('Nothing here', 'لا شيء هنا')} body={f === 'all' ? L('No room requests yet.', 'لا طلبات قاعات بعد.') : L('No request matches this filter.', 'لا طلب يطابق هذا المرشّح.')} />} />{" "}<div className="find-empty" hidden><Empty glyph='search' title={L('No request matches', 'لا طلب مطابق')} body={L('Try the reference number or part of the title.', 'جرّب رقم الطلب أو جزءاً من العنوان.')} /></div></>;
}

/* #/reservations/<id> opens that booking over the list; the address then settles back on Reservations. */
reservations.mount = (host, first) => {
  host.querySelectorAll('[data-res]').forEach(tr => {
    const open = () => resDrawer(tr.dataset.res);
    tr.addEventListener('click', e => {
      if (!e.target.closest('button, a, input, label')) open();
    });
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target === tr) open();
    });
  });
  if (first) {
    S.params = [];
    history.replaceState(null, '', '#/reservations');
    resDrawer(first);
  }
};

/* What happened to a booking, as recorded on it */
const RES_STEPS = {
  'request submitted': ['Requested', 'طُلب'],
  'office review completed': ['Checked by the parish office', 'راجعه مكتب الرعية'],
  approve: ['Confirmed', 'تأكّد'],
  reject: ['Refused', 'رُفض']
};
const resHistory = r => r.history.map((h, i) => <div className={`tl-item${i === r.history.length - 1 ? ' accent' : ''}`}><div className="when">{L(...(RES_STEPS[h.action] || [h.action, h.action]))}{h.at ? ` · ${fmtDate(h.at)}` : ''}</div>{" "}<div className="what">{h.by || ''}{h.via === 'portal' ? ` · ${L('online', 'إلكترونياً')}` : ''}{h.reason ? <small className="dim" style={{
      display: "block"
    }}>{h.reason}</small> : ''}</div></div>);
function stageBar(current) {
  const idx = {
    secretary: 1,
    priest: 2,
    done: 3
  }[current] ?? 0;
  return <div style={{
    display: "flex",
    margin: "4px 0 20px"
  }}>{STAGES.map(([en, ar], i) => <div style={{
      flex: 1,
      minWidth: 0
    }}><div style={css(`height:4px;border-radius:99px;background:${i <= idx ? 'var(--primary)' : 'var(--border)'};margin-inline-end:${i === 3 ? 0 : '4px'}`)} />{" "}<div className="t-caption" style={css(`margin-top:8px;color:${i <= idx ? 'var(--text)' : 'var(--text-3)'};font-weight:${i === idx ? 500 : 400}`)}>{L(en, ar)}</div></div>)}</div>;
}
function resDrawer(id) {
  const r = RESERVATIONS.find(x => x.id === id);
  if (!r) return;
  const v = venue(r.venue) || {
      name: '—',
      ar: '—',
      cap: 0
    },
    by = person(r.by) || {
      lat: '—',
      ar: '—'
    },
    g = r.group ? group(r.group) : null;
  const clash = resClash(r),
    online = !!r.memberRequestId;
  const canDecide = r.status === 'pending' && (is('priest') || is('secretary') && r.stage === 'secretary');
  const canCancel = r.status === 'approved' && is('priest');
  const phone = r.contactPhone || (by.phone && by.phone !== '—' ? by.phone : '');
  openDrawer({
    large: true,
    title: online ? occasionText(r.title) : L(r.title, r.titleAr),
    sub: <><span className="mono">{r.ref}</span> · {L(v.name, v.ar)} · {fmtDate(r.date)}</>,
    body: <>{stageBar(r.stage)}{" "}{clash && r.status === 'pending' ? <C.InlineAlert tone='warning' title={L('Clashes with an existing booking', 'يتعارض مع حجز قائم')} body={L(`The ${v.name} is already held on ${fmtDate(clash.date)} from ${clash.from}, including a ${clash.setup || 0}-minute set-up buffer. Approving this request refuses the other one.`, `${v.ar} محجوزة في ${fmtDate(clash.date)} من ${clash.from}، مع ${clash.setup || 0} دقيقة تحضير. الموافقة على هذا الطلب ترفض الآخر.`)} /> : ''}{" "}{online ? <C.InlineAlert tone='info' title={L('Booked online by the parishioner. ', 'حجزه المؤمن إلكترونياً. ')} body={L(`Request ${r.memberReference}. They are told when it is confirmed or refused, with your reason.`, `الطلب ${r.memberReference}. يُبلَّغ عند تأكيده أو رفضه، مع السبب.`)} /> : ''}{" "}<dl className="dl"><dt>{L('Room', 'القاعة')}</dt><dd>{L(v.name, v.ar)} · {L('seats', 'يتّسع لـ')}{" "}{v.cap}</dd><dt>{L('When', 'الموعد')}</dt><dd className="mono" dir="ltr">{fmtDate(r.date)} · {r.from}–{r.to}</dd><dt>{L('Setup buffer', 'وقت التحضير')}</dt><dd>{r.setup}{" "}{L('minutes before and after', 'دقيقة قبل وبعد')}</dd><dt>{L('Requested by', 'مقدَّم من')}</dt><dd>{r.by && person(r.by) ? <a href={`#/person/${r.by}`}>{isAr() ? by.ar || by.lat : by.lat}</a> : isAr() ? by.ar : by.lat}</dd>{phone ? <><dt>{L('Phone', 'الهاتف')}</dt><dd><a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`}><bdi dir="ltr">{phoneShow(phone)}</bdi></a></dd></> : ''}{r.guests ? <><dt>{L('People expected', 'عدد الأشخاص')}</dt><dd>{String(r.guests)}</dd></> : ''}{g ? <><dt>{L('Group', 'المجموعة')}</dt><dd>{L(g.name, g.ar)}</dd></> : ''}{online ? '' : <><dt>{L('Hold expires', 'ينتهي الحجز المؤقت')}</dt><dd className="mono">{fmtDate('2026-10-07')}</dd></>}<dt>{L('Status', 'الحالة')}</dt><dd><Status k={resStatus(r)} /></dd></dl>{" "}{r.notes ? <blockquote className="or-quote"><span>{L('Message from the parishioner', 'رسالة من المؤمن')}</span><p><bdi>{r.notes}</bdi></p></blockquote> : ''}{" "}<div className="divider" />{" "}<h4 className="t-ui" style={{
        marginBottom: "12px"
      }}>{L('Opening and closing checklist', 'لائحة الفتح والإقفال')}</h4>{" "}<div className="stack" style={{
        gap: "8px"
      }}>{[L('Keys handed to the named responsible person', 'تسليم المفاتيح إلى المسؤول المسمّى'), L('Chairs and tables returned to the store', 'إعادة الكراسي والطاولات إلى المستودع'), L('Lights and generator switched off', 'إطفاء الإنارة والمولّد'), L('Kitchen left clean', 'ترك المطبخ نظيفاً')].map(x => <C.CheckRow label={x} />)}</div>{" "}<div className="divider" />{" "}<h4 className="t-ui" style={{
        marginBottom: "10px"
      }}>{L('Decision history', 'سجل القرارات')}</h4>{" "}<div className="timeline">{r.history?.length ? resHistory(r) : <><div className="tl-item accent"><div className="when">{L('Submitted', 'قُدّم')}</div>{" "}<div className="what">{L(`By ${by.lat}`, `من ${by.ar}`)}</div></div>{" "}{r.stage !== 'secretary' ? <div className="tl-item"><div className="when">{L('Reviewed', 'رُوجع')}</div>{" "}<div className="what">{L('By Rita Nassar and forwarded to the priest', 'من ريتا نصّار وأُحيل إلى الكاهن')}</div></div> : ''}{" "}{r.status === 'approved' || r.status === 'rejected' ? <div className="tl-item"><div className="when">{L('Decided', 'قُرّر')}</div>{" "}<div className="what"><Status k={r.status} /></div></div> : ''}</>}</div></>,
    foot: canDecide ? <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-danger-quiet" data-act={`res-reject:${r.id}`}>{L('Reject', 'رفض')}</button>{" "}<button className="btn btn-primary" data-act={`res-approve:${r.id}`} style={{
        marginInlineStart: "auto"
      }}>{is('secretary') ? L('Forward to the priest', 'إحالة إلى الكاهن') : L('Approve', 'موافقة')}</button></> : canCancel ? <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-danger-quiet" data-act={`res-reject:${r.id}`} style={{
        marginInlineStart: "auto"
      }}>{L('Cancel booking…', 'إلغاء الحجز…')}</button></> : r.status !== 'pending' ? <button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button> : <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<span className="t-caption dim" style={{
        marginInlineStart: "auto"
      }}>{L('Your role can view this request but not decide it.', 'دورك يتيح الاطّلاع لا القرار.')}</span></>,
    onMount(el) {}
  });
}