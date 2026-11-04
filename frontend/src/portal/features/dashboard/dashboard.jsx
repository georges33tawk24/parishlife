/* The dashboard: what is waiting on the signed-in person today (signatures, decisions,
   reservations, the collection) and the week ahead at the parish. */
import { css, nodesOr } from '../../ui/html.js';
import { t, isAr, num, usd, fmtLong, fmtDate } from '../../../lib/i18n.js';
import { S, me, is, bus } from '../../model/store.js';
import { session } from '../../model/api.js';
import { M, loadMember } from '../../model/member-data.js';
import { Icon, PageHead, SectionH, Stat, Panel, Who, Status, Amount, Pill, Empty, Paged } from '../../ui/ui.jsx';
import {
  PARISH,
  RATE,
  EVENTS,
  SACRAMENTS,
  RESERVATIONS,
  BATCH,
  EXPENSES,
  FUNDS,
  PEOPLE,
  HOUSEHOLDS,
  PORTAL_REQUESTS,
  GROUPS,
  GROUP_DETAIL,
  ROTA,
  AUDIT,
  anniversaryItems,
  person,
  venue,
  resStatus,
  resClash
} from '../../model/data.js';
import { waitingOnline, onlineTitle, subjectOf } from '../records/online-requests.jsx';
import * as C from '../../ui/components.jsx';
import { auditAction, auditTime } from '../../shared/audit-words.js';

const greet = () => {
  const p = me(),
    name = isAr() ? p.ar.split(' ')[0] : p.lat.split(' ')[0];
  return t(`Good evening, ${name}`, `مساء الخير يا ${name}`);
};

const sundayLine = () => `${fmtLong(new Date())} · ${t(PARISH.name, PARISH.nameAr)}`;

const todayEvents = () =>
  EVENTS.filter(e => e.d === new Date().toISOString().slice(0, 10)).sort((a, b) => a.t.localeCompare(b.t));

const awaitingSig = () =>
  SACRAMENTS.filter(
    s =>
      s.status === 'awaiting-signature' &&
      (s.kind !== 'certificate' ||
        SACRAMENTS.some(
          source =>
            source.id === s.sourceRecordId &&
            source.person === s.person &&
            ['registered', 'issued'].includes(source.status)
        ))
  );

const pendingRes = () => RESERVATIONS.filter(r => r.status === 'pending');

/* "2 baptisms, 1 marriage" from whatever is waiting, in both languages */
const kinds = list => {
  const m = new Map();
  list.forEach(s => m.set(s.kind, [(m.get(s.kind)?.[0] || 0) + 1, s.kindAr]));
  return [...m].map(([k, [n, ar]]) => t(`${n} ${k}${n > 1 ? 's' : ''}`, `${n} ${ar}`)).join(t(', ', '، '));
};

const clashNote = () => {
  const n = pendingRes().filter(resClash).length;
  return n ? (
    <span className="down">
      {t(n === 1 ? '1 has a clash' : `${n} have a clash`, n === 1 ? 'واحد فيه تعارض' : `${n} فيها تعارض`)}
    </span>
  ) : (
    t('no clashes', 'بلا تعارض')
  );
};

/* ---------- shared blocks ---------- */
/* Requests parishioners sent online — sacraments, certificates, bookings and anything else — newest first. */
const onlineRows = () =>
  waitingOnline().map((r, i) => (
    <a key={i} className="listrow" href={`#/requests/online/${r.id}`}>
      <Who p={subjectOf(r)} />{' '}
      <span className="grow">
        <b>{onlineTitle(r)}</b>
        <small>
          <span className="mono" dir="ltr">
            {r.reference}
          </span>{' '}
          · {fmtDate(r.createdAt)}
        </small>
      </span>{' '}
      <Status k="submitted" />
      <Icon name="chevR" size={16} cls="dimmer" />
    </a>
  ));

const onlinePanel = () =>
  waitingOnline().length ? (
    <Panel
      title={t('New online requests', 'طلبات إلكترونية جديدة')}
      more={<a href="#/requests">{t('All requests', 'كل الطلبات')}</a>}
      tight={true}
    >
      {onlineRows()}
    </Panel>
  ) : (
    ''
  );

/* Parishioners who opened an account themselves and whose record the office has not checked yet. */
const newOnline = () => {
  const list = PEOPLE.filter(p => p.registeredOnline && !p.registeredOnline.verified);
  if (!list.length || !is('priest', 'secretary')) return '';
  return (
    <div className="dash-new">
      <C.InlineAlert
        tone="info"
        title={t(
          list.length === 1 ? '1 parishioner registered online. ' : `${list.length} parishioners registered online. `,
          list.length === 1 ? 'سجّل مؤمن واحد إلكترونياً. ' : `سجّل ${list.length} مؤمنين إلكترونياً. `
        )}
        body={t(
          'Check their details and mark each record as verified.',
          'تحقّق من معلوماتهم وعلّم كل سجل كمُتحقَّق منه.'
        )}
        actions={
          <button className="btn btn-secondary btn-dense" data-act="people-new-open">
            {t('Review them', 'مراجعتهم')}
          </button>
        }
      />
    </div>
  );
};

function todayPanel() {
  const rows = todayEvents().map((e, i) => (
    <a key={i} className="listrow" href="#/calendar">
      <span className="mono dim" style={{ width: '46px', flex: 'none' }}>
        {e.t}
      </span>{' '}
      <span className="grow">
        <b>{t(e.title, e.titleAr)}</b> <small>{t(venue(e.venue)?.name || '', venue(e.venue)?.ar || '')}</small>
      </span>{' '}
      {e.kind === 'pending' ? <Status k="pending" /> : ''}
    </a>
  ));
  return (
    <Panel
      title={t(`Today at ${PARISH.name}`, `اليوم في ${PARISH.nameAr}`)}
      more={<a href="#/calendar">{t('Whole week', 'الأسبوع كلّه')}</a>}
      tight={true}
    >
      {rows}
    </Panel>
  );
}

function activityPanel(limit = 5) {
  const rows = AUDIT.slice(0, limit).map((a, i) => {
    const p = person(a.who);
    return (
      <div key={i} className={`tl-item ${a.kind === 'error' || a.kind === 'sensitive' ? 'accent' : ''}`}>
        <div className="when">
          <span dir="ltr">{auditTime(a.at).slice(11)}</span> ·{' '}
          {p ? (isAr() ? p.ar : p.lat) : a.actorName && a.actorName !== 'System' ? a.actorName : t('System', 'النظام')}
        </div>{' '}
        <div className="what">{auditAction(a)}</div>
      </div>
    );
  });
  return (
    <Panel
      title={t('Recent activity', 'النشاط الأخير')}
      more={is('priest') ? <a href="#/audit">{t('Audit trail', 'سجل التدقيق')}</a> : ''}
    >
      <div className="timeline">{rows}</div>
    </Panel>
  );
}

function rotaGaps() {
  const gaps = ROTA.teams.flatMap((tm, ti) =>
    tm.filled.map((f, si) => ({ tm, f, at: `${ti}|${si}` })).filter(x => x.f.s === 'open' || x.f.s === 'declined')
  );
  if (!gaps.length)
    return (
      <Panel title={t('This Sunday’s rota', 'مناوبة هذا الأحد')}>
        <Empty
          glyph="check"
          title={t('Every place is filled', 'كل المراكز مملوءة')}
          body={t('No substitutes needed.', 'لا حاجة إلى بدلاء.')}
        />
      </Panel>
    );
  const rows = gaps.map(({ tm, f, at }, i) => (
    <div key={i} className="listrow">
      <span className="grow">
        <b>{t(tm.team, tm.teamAr)}</b>{' '}
        <small>
          {f.s === 'declined'
            ? t(`${person(f.p).lat} declined`, `${person(f.p).ar} اعتذر`)
            : t('No one assigned', 'لا أحد مُسند')}
        </small>
      </span>{' '}
      <Status k={f.s === 'declined' ? 'declined' : 'unfilled'} />{' '}
      <button className="btn btn-secondary btn-dense" data-act={`rota-fill:${at}`}>
        {t('Find substitute', 'ابحث عن بديل')}
      </button>
    </div>
  ));
  return (
    <Panel
      title={t('This Sunday’s rota needs people', 'مناوبة هذا الأحد تحتاج أشخاصاً')}
      more={<a href="#/volunteers">{t('Open rota', 'فتح المناوبات')}</a>}
      tight={true}
    >
      {rows}
    </Panel>
  );
}

/* ---------- role dashboards ---------- */
function priest() {
  const sigRows = awaitingSig().map((s, i) => {
    const p = person(s.person);
    return (
      <a key={i} className="listrow sigrow" href={`#/certificate/${s.id}`}>
        <Who p={p} />{' '}
        <span className="grow">
          <b>{t(s.kind[0].toUpperCase() + s.kind.slice(1), s.kindAr)}</b> <small className="mono">{s.reg}</small>
        </span>{' '}
        <Status k="awaiting-signature" />
        <Icon name="chevR" size={16} cls="dimmer" />
      </a>
    );
  });
  const resRows = pendingRes().map((r, i) => (
    <a key={i} className="listrow" href="#/reservations">
      <span className="grow">
        <b>{t(r.title, r.titleAr)}</b>{' '}
        <small>
          {t(venue(r.venue)?.name || '', venue(r.venue)?.ar || '')} · {fmtDate(r.date)} · {r.from}–{r.to}
        </small>
      </span>{' '}
      <Status k={resStatus(r)} />
    </a>
  ));
  const annRows = anniversaryItems()
    .slice(0, 6)
    .map((a, i) => (
      <div key={i} className="listrow">
        <span className="grow">
          <b>{isAr() ? a.ar : a.couple}</b>{' '}
          <small>
            {t(`${a.kind} · ${a.years} years · ${fmtDate(a.on)}`, `${a.kind} · ${a.years} سنة · ${fmtDate(a.on)}`)}
          </small>
        </span>{' '}
        <span className="pill">{a.years}</span>
      </div>
    ));
  return (
    <>
      <PageHead
        crumbs={[{ label: t('Home', 'الرئيسية') }, { label: t('Dashboard', 'لوحة القيادة') }]}
        title={greet()}
        sub={sundayLine()}
        actions={
          <>
            <button className="btn btn-secondary" data-act="print-week">
              <Icon name="print" size={17} />
              {t('Print my schedule', 'اطبع جدولي')}
            </button>{' '}
            <button className="btn btn-primary" data-act="record-new">
              <Icon name="plus" size={17} />
              {t('New record', 'سجل جديد')}
            </button>
          </>
        }
      />{' '}
      <div className="stats">
        <Stat
          k={t('Parishioners', 'المؤمنون')}
          v={num(PEOPLE.length)}
          d={t(`${HOUSEHOLDS.length} households`, `${HOUSEHOLDS.length} عائلة`)}
        />{' '}
        <Stat
          k={t('Awaiting your signature', 'بانتظار توقيعك')}
          v={awaitingSig().length}
          d={awaitingSig().length ? kinds(awaitingSig()) : t('nothing to sign', 'لا شيء للتوقيع')}
        />{' '}
        <Stat k={t('Reservations to decide', 'حجوزات بانتظار القرار')} v={pendingRes().length} d={clashNote()} />{' '}
        <Stat
          k={t('Sunday collection', 'تقدمة الأحد')}
          v={usd(BATCH.lines.reduce((a, l) => a + (l.usd || 0), 0))}
          d={
            BATCH.status === 'closed'
              ? t('session closed', 'الجلسة مقفلة')
              : t('session still open', 'الجلسة ما زالت مفتوحة')
          }
        />
      </div>{' '}
      <div className="grid g2">
        {onlinePanel()}{' '}
        <Panel
          title={t('Awaiting your signature', 'بانتظار توقيعك')}
          more={<a href="#/sacraments">{t('All sacraments', 'كل الأسرار')}</a>}
          tight={true}
        >
          {sigRows}
        </Panel>{' '}
        {todayPanel()}{' '}
        <Panel
          title={t('Reservations to decide', 'حجوزات بانتظار قرارك')}
          more={<a href="#/reservations">{t('All reservations', 'كل الحجوزات')}</a>}
          tight={true}
        >
          {resRows}
        </Panel>{' '}
        <Panel
          title={t('Sacramental anniversaries', 'ذكريات الأسرار')}
          more={<a href="#/sacraments/anniversaries">{t('All', 'الكل')}</a>}
          tight={true}
        >
          {annRows}
        </Panel>{' '}
        {rotaGaps()} {activityPanel(4)}
      </div>
    </>
  );
}

function secretary() {
  const certs = SACRAMENTS.filter(s => s.kind === 'certificate' && s.status !== 'issued');
  const rows = certs.map((s, i) => {
    const p = person(s.person);
    return (
      <a key={i} className="listrow" href={`#/certificate/${s.id}`}>
        <Who p={p} />{' '}
        <span className="grow">
          <b>{t(s.kind[0].toUpperCase() + s.kind.slice(1), s.kindAr)}</b> <small className="mono">{s.reg}</small>
        </span>
        {!s.sourceRecordId && !['rejected', 'cancelled'].includes(s.status) ? (
          <Pill label={t('Waiting for official entry', 'بانتظار قيد رسمي')} tone="warning" />
        ) : (
          <Status k={s.status} />
        )}
      </a>
    );
  });
  return (
    <>
      <PageHead
        crumbs={[{ label: t('Home', 'الرئيسية') }, { label: t('Dashboard', 'لوحة القيادة') }]}
        title={greet()}
        sub={t(
          `${certs.length} certificate requests · ${PORTAL_REQUESTS.length + waitingOnline().length} requests from the portal`,
          `${certs.length} طلبات شهادات · ${PORTAL_REQUESTS.length + waitingOnline().length} طلبات من البوّابة`
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-act="export">
              <Icon name="export" size={17} />
              {t('Export', 'تصدير')}
            </button>{' '}
            <button className="btn btn-primary" data-go="people">
              <Icon name="plus" size={17} />
              {t('New parishioner', 'مؤمن جديد')}
            </button>
          </>
        }
      />{' '}
      <div className="stats">
        <Stat k={t('Parishioners', 'المؤمنون')} v={num(PEOPLE.length)} d={t('updated today', 'حُدّثت اليوم')} />{' '}
        <Stat
          k={t('Households', 'العائلات')}
          v={num(HOUSEHOLDS.length)}
          d={(n =>
            n ? t(`${n} need an address`, `${n} بحاجة إلى عنوان`) : t('every one has an address', 'لكلٍّ عنوان'))(
            HOUSEHOLDS.filter(h => !h.address).length
          )}
        />{' '}
        <Stat
          k={t('Certificate requests', 'طلبات الشهادات')}
          v={certs.length}
          d={t(`${awaitingSig().length} waiting on the priest`, `${awaitingSig().length} بانتظار الكاهن`)}
        />{' '}
        <Stat
          k={t('Portal requests', 'طلبات البوّابة')}
          v={PORTAL_REQUESTS.length + waitingOnline().length}
          d={
            waitingOnline().length
              ? t(
                  waitingOnline().length === 1 ? '1 sent online' : `${waitingOnline().length} sent online`,
                  waitingOnline().length === 1
                    ? 'طلب واحد أُرسل إلكترونياً'
                    : `${waitingOnline().length} أُرسلت إلكترونياً`
                )
              : PORTAL_REQUESTS.length
                ? t('to review', 'للمراجعة')
                : t('nothing waiting', 'لا شيء بالانتظار')
          }
        />
      </div>{' '}
      {newOnline()}{' '}
      <div className="grid g2">
        <Panel
          title={t('Requests in your queue', 'طلبات في صندوقك')}
          tight={true}
          more={<a href="#/requests">{t('All requests', 'كل الطلبات')}</a>}
        >
          {onlineRows() + rows}
        </Panel>{' '}
        {todayPanel()}{' '}
        <Panel title={t('Office Expenses', 'مصاريف المكتب')}>
          <p>
            {t(
              'Record the monthly allowance, attach purchase receipts and print expense vouchers.',
              'سجّل المخصّص الشهري وأرفق إيصالات المشتريات واطبع سندات المصروفات.'
            )}
          </p>
          <a className="btn btn-secondary" href="#/officeexpenses">
            {t('Open office account', 'فتح حساب المكتب')}
          </a>
        </Panel>{' '}
        <Panel title={t('Groups & contacts', 'المجموعات والتواصل')} tight={true}>
          {GROUPS.map((g, i) => (
            <a key={i} className="listrow" href={`#/groups/${g.id}/roster`}>
              <span className="grow">
                <b>{t(g.name, g.ar)}</b>
                <small>{t(person(g.leader)?.lat || '', person(g.leader)?.ar || '')}</small>
              </span>
              <span>
                {g.members} {t('members', 'أعضاء')}
              </span>
            </a>
          ))}
        </Panel>
      </div>
    </>
  );
}

function treasurer() {
  const total = BATCH.lines.reduce((a, l) => a + (l.usd || 0), 0);
  const liraOnly = BATCH.lines.reduce((a, l) => a + (l.lbp || 0), 0);
  const pendingX = EXPENSES.filter(x => x.status === 'awaiting-approval');
  const fundRows = FUNDS.map((f, i) => {
    const pct = Math.min(100, Math.round((f.actual / f.budget) * 100));
    return (
      <div key={i} className="listrow" style={{ alignItems: 'flex-start' }}>
        <span className="grow">
          <b>{t(f.name, f.ar)}</b>{' '}
          <small dir="ltr" style={{ textAlign: 'start' }}>
            {usd(f.actual)} {t('of', 'من')} {usd(f.budget)} · {pct}%
          </small>{' '}
          <span className="meter" style={{ marginTop: '8px' }}>
            <i style={css(`width:${pct}%`)} />
          </span>
        </span>{' '}
        {f.restricted ? <Pill label={t('Restricted', 'مقيّد')} tone="info" mark="lock" /> : ''}
      </div>
    );
  });
  const xRows = pendingX.map((x, i) => (
    <div key={i} className="listrow">
      <span className="grow">
        <b>{t(x.what, x.whatAr)}</b>
        <small>{fmtDate(x.d)}</small>
      </span>{' '}
      <Amount dollars={x.usd} cls="amount-sm" />
      <Status k={x.status} />
    </div>
  ));
  return (
    <>
      <PageHead
        crumbs={[{ label: t('Home', 'الرئيسية') }, { label: t('Giving overview', 'نظرة على التقدمات') }]}
        title={t('Giving overview', 'نظرة على التقدمات')}
        sub={
          <>
            {t(BATCH.ref, BATCH.refAr)}
            {' · '}
            {<Status k={BATCH.status} />}
            {' · '}
            {t('rate set', 'ضُبط السعر')} {fmtDate(RATE.setOn)}
          </>
        }
        actions={
          <>
            <button className="btn btn-secondary" data-go="finance">
              <Icon name="fin" size={17} />
              {t('Finance', 'المالية')}
            </button>{' '}
            <button className="btn btn-primary" data-go="giving">
              <Icon name="plus" size={17} />
              {t('Open counting session', 'فتح جلسة عدّ')}
            </button>
          </>
        }
      />{' '}
      <div className="stats">
        <Stat k={t('Counted so far', 'المعدود حتى الآن')} v={usd(total)} d={`L.L ${num(total * RATE.value)}`} />{' '}
        <Stat
          k={t('Lira envelopes', 'مظاريف بالليرة')}
          v={`L.L ${num(liraOnly)}`}
          d={t('kept as lira, not converted', 'تبقى ليرة، بلا تحويل')}
        />{' '}
        <Stat
          k={t('Expenses awaiting you', 'مصاريف بانتظارك')}
          v={pendingX.length}
          d={usd(pendingX.reduce((a, x) => a + x.usd, 0))}
        />{' '}
        <Stat
          k={t('Parish rate', 'سعر الرعية')}
          v={num(RATE.value)}
          d={t(`set ${fmtDate(RATE.setOn)}`, `ضُبط ${fmtDate(RATE.setOn)}`)}
        />
      </div>{' '}
      <div className="grid g2">
        <Panel title={t('Counting session 214', 'جلسة العدّ ٢١٤')}>
          <div className="row" style={{ gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <Amount dollars={total} showRate={true} cls="amount-lg" />
            </div>{' '}
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" data-go="giving">
                {t('Add envelope', 'إضافة مظروف')}
              </button>{' '}
              <button className="btn btn-primary" data-go="giving">
                {t('Close session', 'إقفال الجلسة')}
              </button>
            </div>
          </div>{' '}
          <p className="t-caption dim" style={{ marginTop: '14px' }}>
            {t(
              'Two counters signed in: Nabil Saade and Joseph Sfeir. A session cannot be closed by the person who opened it alone.',
              'عدّادان مسجّلان: نبيل سعادة وجوزيف صفير. لا يُقفل الجلسة من فتحها وحده.'
            )}
          </p>
        </Panel>{' '}
        <Panel
          title={t('Budget against actual', 'الموازنة مقابل الفعلي')}
          more={<a href="#/finance">{t('Finance', 'المالية')}</a>}
          tight={true}
        >
          {fundRows}
        </Panel>{' '}
        <Panel title={t('Expenses awaiting approval', 'مصاريف بانتظار الموافقة')} tight={true}>
          {xRows}
        </Panel>{' '}
        {activityPanel(4)}
      </div>
    </>
  );
}

function leader() {
  const mine = GROUPS.filter(g => g.leader === me().id || g.assistant === me().id);
  const meetings = mine.flatMap(g => GROUP_DETAIL[g.id]?.meetings || []);
  const upcoming = mine
    .flatMap(g =>
      (GROUP_DETAIL[g.id]?.meetings || [])
        .filter(m => !m.done && m.d >= new Date().toISOString().slice(0, 10))
        .map(m => ({ g, m }))
    )
    .sort((a, b) => (a.m.d + a.m.t).localeCompare(b.m.d + b.m.t));
  const recorded = meetings.reduce((count, meeting) => count + Object.keys(meeting.attendance || {}).length, 0);
  const cards = mine.map((g, i) => (
    <a key={i} className="panel card-link" href={`#/groups/${g.id}`} style={{ display: 'block' }}>
      <div className="panel-b">
        <div className="row" style={{ gap: '10px' }}>
          <span className="avatar">
            <Icon name="groups" size={17} />
          </span>{' '}
          <span>
            <b style={{ display: 'block', font: '600 15px/22px var(--sans)' }}>{t(g.name, g.ar)}</b>{' '}
            <small className="dim t-caption">{t(g.meets, g.meetsAr)}</small>
          </span>{' '}
          <span className="badge badge-quiet" style={{ marginInlineStart: 'auto' }}>
            {g.members}
          </span>
        </div>
      </div>
    </a>
  ));
  return (
    <>
      <PageHead
        crumbs={[{ label: t('My ministry', 'خدمتي') }, { label: t('Dashboard', 'لوحة القيادة') }]}
        title={t('My groups', 'مجموعاتي')}
        sub={t(
          `${mine.reduce((a, g) => a + g.members, 0)} members · ${upcoming.length} upcoming meetings`,
          `${mine.reduce((a, g) => a + g.members, 0)} عضواً · ${upcoming.length} اجتماعات قادمة`
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-go="messaging">
              <Icon name="msg" size={17} />
              {t('Message my group', 'مراسلة مجموعتي')}
            </button>{' '}
            <a className="btn btn-primary" href={`#/groups${mine[0] ? `/${mine[0].id}/attendance` : ''}`}>
              <Icon name="attend" size={17} />
              {t('Group attendance', 'حضور المجموعة')}
            </a>
          </>
        }
      />{' '}
      <div className="stats">
        {mine.slice(0, 2).map((g, i) => (
          <Stat
            key={i}
            k={t(g.name, g.ar)}
            v={g.members}
            d={g.meets ? t(g.meets, g.meetsAr) : t('no fixed meeting', 'بلا اجتماع ثابت')}
          />
        ))}{' '}
        <Stat
          k={t('Upcoming meetings', 'الاجتماعات القادمة')}
          v={upcoming.length}
          d={t('in my groups', 'في مجموعاتي')}
        />{' '}
        <Stat
          k={t('Recorded group attendance', 'حضور المجموعات المسجّل')}
          v={recorded}
          d={`${meetings.length} ${t('meetings', 'اجتماعات')}`}
        />{' '}
        <Stat
          k={t('Complaints received', 'الشكاوى الواردة')}
          v={M.loadedFor === `${session.user?.id}:${session.parishId}` ? M.leaderConcerns.length : '…'}
          d={<a href="#/memberhub">{t('View group complaints', 'عرض شكاوى المجموعة')}</a>}
        />
      </div>{' '}
      <SectionH title={t('My groups', 'مجموعاتي')} /> <Paged className="gridcards">{cards}</Paged>{' '}
      <div className="grid g2">
        <Panel title={t('Next ministry meetings', 'اجتماعات الخدمة القادمة')}>
          {nodesOr(
            upcoming.slice(0, 5).map(({ g, m }, i) => (
              <a key={i} className="listrow" href={`#/groups/${g.id}/meetings`}>
                <span className="grow">
                  <b>{m.title || t('Ministry meeting', 'اجتماع الخدمة')}</b>{' '}
                  <small>
                    {t(g.name, g.ar)} · {fmtDate(m.d)} {m.t}
                  </small>
                </span>
                <Icon name="chevR" size={16} />
              </a>
            )),
            <p className="t-caption dim">{t('No meetings scheduled yet.', 'لا اجتماعات مجدولة بعد.')}</p>
          )}
        </Panel>
        {todayPanel()}
      </div>{' '}
      <p className="t-caption dim" style={{ marginTop: '20px' }}>
        {t(
          'A ministry leader sees only the people in the groups they lead. The parish list, giving and other groups are not in the rail at all.',
          'مسؤول الخدمة يرى فقط أفراد مجموعاته. لائحة الرعية والتقدمات والمجموعات الأخرى ليست في الشريط إطلاقاً.'
        )}
      </p>
    </>
  );
}

export function dashboard() {
  if (is('priest')) return priest();
  if (is('secretary')) return secretary();
  if (is('treasurer')) return treasurer();
  if (is('leader')) return leader();
  return '';
}

dashboard.mount = host => {
  if (is('leader') && M.loadedFor !== `${session.user?.id}:${session.parishId}`)
    loadMember()
      .then(() => {
        if (S.route === 'dashboard') bus.refresh();
      })
      .catch(() => {});
};
