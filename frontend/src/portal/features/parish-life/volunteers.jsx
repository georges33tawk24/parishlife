/* Volunteers: the rota board for each Mass, the volunteer list, sign-up sheets and hours; for a
   group leader, the members and attendance of the groups they lead. */
import { Select } from '../../ui/components.jsx';
import { css, nodesOr } from '../../ui/html.js';
import { t, isAr, fmtDate, fmtLong } from '../../../lib/i18n.js';
import { is, bus } from '../../model/store.js';
import {
  Icon,
  PageHead,
  Panel,
  Who,
  Status,
  Pill,
  Table,
  Empty,
  openDrawer,
  closeOverlays,
  toast,
  Stat,
  Avatar,
  TabBar
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { memberAdd } from './groups-dialogs.jsx';
import { rotaDrop } from './rota-dialogs.jsx';
import { GROUPS, groupInfo, ROTA, VOLUNTEERS, SIGNUP_SHEETS, person, group } from '../../model/data.js';
import { memberAttendancePct } from './parish-life-shared.jsx';

const L = (en, ar) => t(en, ar);

const MINISTRY_ROLES = [
  ['President', 'رئيس'],
  ['Vice President', 'نائب رئيس'],
  ['Secretary', 'أمين السرّ'],
  ['Treasurer', 'أمين الصندوق'],
  ['Responsible of Apostolic Mission', 'وكيل الرسالة'],
  ['Responsible for Christian Education', 'وكيل التنشئة والثقافة المسيحية'],
  ['Social Media Manager', 'وكيل الإعلام'],
  ['Consultant', 'مستشار'],
  ['Advisor', 'موجّه'],
  ['Group Monitor', 'مسؤول فريق'],
  ['Trainer', 'مدرّب في معهد التنشئة والتدريب'],
  ['Trainee', 'طالب في معهد التنشئة والتدريب'],
  ['Member', 'عضو']
];

const VTABS = () => [
  ['', 'Rota', 'المناوبات'],
  ['people', 'Volunteers', 'المتطوّعون', VOLUNTEERS.length],
  ['sheets', 'Sign-up sheets', 'لوائح التطوّع', SIGNUP_SHEETS.length],
  ['hours', 'Hours', 'الساعات']
];

export function volunteers(tab = '') {
  if (is('leader')) {
    const managed = GROUPS,
      unique = [...new Set(managed.flatMap(g => groupInfo(g.id).roster.map(r => r.p)))];
    const held = managed.flatMap(g => groupInfo(g.id).meetings.filter(m => m.done));
    return (
      <>
        <PageHead
          crumbs={[{ label: L('My ministry', 'خدمتي') }, { label: L('Volunteers', 'المتطوّعون') }]}
          title={L('Ministry volunteers', 'متطوعو الخدمة')}
          sub={L('Members and attendance in the groups you lead.', 'الأعضاء والحضور في المجموعات التي تقودها.')}
        />
        <div className="stats" style={{ margin: '20px 0' }}>
          <Stat k={L('Members', 'الأعضاء')} v={unique.length} d={L('across my groups', 'في مجموعاتي')} />{' '}
          <Stat k={L('Groups', 'المجموعات')} v={managed.length} d={L('I lead', 'أقودها')} />{' '}
          <Stat k={L('Meetings held', 'اجتماعات أُقيمت')} v={held.length} d={L('across my groups', 'في مجموعاتي')} />
        </div>{' '}
        {nodesOr(
          managed.map((g, k) => {
            const d = groupInfo(g.id);
            return (
              <Panel
                key={k}
                title={L(g.name, g.ar)}
                more={
                  <>
                    <a className="btn btn-secondary btn-dense" href={`#/groups/${g.id}/roster`}>
                      {L('Open roster', 'افتح اللائحة')}
                    </a>{' '}
                    <button className="btn btn-primary btn-dense" data-leader-add={g.id}>
                      {L('Add member', 'إضافة عضو')}
                    </button>
                  </>
                }
              >
                <div className="toolbar">
                  <b>{L('Role assignments', 'إسناد الأدوار')}</b>
                  <button className="btn btn-primary btn-dense" data-role-assign={g.id}>
                    <Icon name="plus" size={15} />
                    {L('Assign role', 'إسناد دور')}
                  </button>
                </div>{' '}
                {d.roles.map(([pid, en, ar], i) => (
                  <div key={i} className="listrow">
                    <span className="grow">
                      {L(person(pid)?.lat || pid, person(pid)?.ar || pid)}
                      <small>{L(en, ar)}</small>
                    </span>
                    <button
                      className="btn-icon"
                      data-role-remove={`${g.id}|${i}`}
                      aria-label={L('Remove assignment', 'إزالة الإسناد')}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}{' '}
                <div className="divider" />
                <Table
                  cols={[
                    { label: L('Member', 'العضو') },
                    { label: L('Role', 'الدور') },
                    { label: L('Attendance', 'الحضور'), cls: 'num' }
                  ]}
                  rows={d.roster.map(r => ({
                    cells: [
                      L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p),
                      L(r.role, r.roleAr),
                      memberAttendancePct(d.meetings, r.p)
                    ]
                  }))}
                />
              </Panel>
            );
          }),
          <Empty
            glyph="groups"
            title={L('No groups assigned', 'لا مجموعات مخصصة')}
            body={L('Ask the parish office to assign a ministry.', 'اطلب من مكتب الرعية تخصيص خدمة.')}
          />
        )}
      </>
    );
  }
  const teams = is('leader') ? ROTA.teams.filter(tm => tm.leader === 'p3') : ROTA.teams;
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Parish life', 'حياة الرعية') }, { label: L('Volunteers', 'المتطوّعون') }]}
        title={
          is('leader') ? L('My teams — Sunday Mass 10:30', 'فرقي — قدّاس الأحد ١٠:٣٠') : L('Volunteers', 'المتطوّعون')
        }
        sub={L(
          'Plan volunteer assignments here. Anyone who needs personal access signs in as a member, with or without a ministry group.',
          'نظّم مناوبات المتطوعين هنا. من يحتاج إلى دخول شخصي يسجّل كعضو، سواء انضم إلى خدمة أم لا.'
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-act="remind:rota">
              <Icon name="msg" size={17} />
              {L('Remind everyone', 'تذكير الجميع')}
            </button>{' '}
            <button className="btn btn-primary" data-act="vol-add">
              <Icon name="plus" size={17} />
              {L('Add volunteer', 'إضافة متطوّع')}
            </button>
          </>
        }
      />
      <TabBar base="volunteers" items={VTABS()} active={tab} />
    </>
  );
  if (tab === 'people')
    return (
      <>
        {head}
        <div className="tabbody">
          {(() => {
            const miss = VOLUNTEERS.filter(v => v.clearance === 'missing').length,
              exp = VOLUNTEERS.filter(v => v.clearance === 'expiring').length;
            return miss || exp ? (
              <C.InlineAlert
                tone="warning"
                title={L(
                  `${miss} clearance${miss === 1 ? ' is' : 's are'} missing and ${exp} expire${exp === 1 ? 's' : ''} within 30 days`,
                  `${miss} إفادة ناقصة و${exp} تنتهي خلال ٣٠ يوماً`
                )}
                body={L(
                  'Anyone without a valid safeguarding clearance cannot be scheduled to a team that works with children.',
                  'من لا يحمل إفادة حماية سارية لا يمكن إسناده إلى فريق يعمل مع الأطفال.'
                )}
              />
            ) : (
              ''
            );
          })()}{' '}
          <div>
            <Table
              cols={[
                { label: L('Volunteer', 'المتطوّع'), sort: true },
                { label: L('Skills', 'المهارات'), cls: 'hide-sm' },
                { label: L('Available', 'التوفّر'), cls: 'hide-md' },
                { label: L('Safeguarding', 'الحماية'), cls: 'shrink' },
                { label: L('Hours', 'الساعات'), cls: 'num', sort: true },
                { label: '', cls: 'shrink' }
              ]}
              rows={VOLUNTEERS.map(v => ({
                cells: [
                  <Who p={person(v.p)} />,
                  <span className="row" style={{ gap: '4px', flexWrap: 'wrap' }}>
                    {(isAr() ? v.skillsAr : v.skills).map((s, i) => (
                      <span key={i} className="chip">
                        {s}
                      </span>
                    ))}
                  </span>,
                  <span className="dim t-caption">{v.avail.join(' · ')}</span>,
                  v.clearance === 'valid' ? (
                    <Pill label={L('Valid', 'سارية')} tone="success" />
                  ) : v.clearance === 'expiring' ? (
                    <Pill label={L('Expiring', 'تنتهي قريباً')} tone="warning" mark="st-wait" />
                  ) : (
                    <Pill label={L('Missing', 'ناقصة')} tone="danger" />
                  ),
                  <span className="num">{v.hours}</span>,
                  <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-dense" data-vol={v.p}>
                      {L('Open', 'فتح')}
                    </button>
                    {CR.recBtn('volunteer', v.p)}
                  </span>
                ]
              }))}
              empty={
                <Empty
                  glyph="vol"
                  title={L('No volunteers yet', 'لا متطوّعين بعد')}
                  body={L(
                    'Add parishioners who serve. A member account is optional.',
                    'أضف المؤمنين الذين يخدمون. حساب العضو اختياري.'
                  )}
                  action={
                    <button className="btn btn-primary btn-dense" data-act="vol-add">
                      {L('Add volunteer', 'إضافة متطوّع')}
                    </button>
                  }
                />
              }
            />
          </div>{' '}
          <p className="t-caption dim" style={{ marginTop: '16px' }}>
            {L(
              'A high load is flagged for a human to look at. ParishLife does not diagnose burnout and never penalises anyone automatically.',
              'يُعلَّم العبء المرتفع لينظر فيه إنسان. ولا يشخّص «حياة الرعية» الإنهاك ولا يعاقب أحداً تلقائياً.'
            )}
          </p>
        </div>
      </>
    );
  if (tab === 'sheets')
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="toolbar">
            <button className="btn btn-secondary" data-act="rec-new:sheet" style={{ marginInlineStart: 'auto' }}>
              <Icon name="plus" size={17} />
              {L('New sign-up sheet', 'لائحة تطوّع جديدة')}
            </button>
          </div>{' '}
          {SIGNUP_SHEETS.length ? (
            ''
          ) : (
            <Empty
              glyph="vol"
              title={L('No sign-up sheets', 'لا لوائح تطوّع')}
              body={L(
                'Open one when the parish needs hands for a date — readers, servers, a lunch team.',
                'افتح واحدة حين تحتاج الرعية إلى أيادٍ لموعد — قرّاء، خدّام، فريق غداء.'
              )}
            />
          )}{' '}
          {SIGNUP_SHEETS.map((s, i) => (
            <section key={i} className="panel">
              <div className="panel-b">
                <div className="row" style={{ gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <b style={{ font: '600 15px/21px var(--sans)' }}>{L(s.what, s.whatAr)}</b>{' '}
                    <div className="t-caption dim" style={{ marginTop: '3px' }}>
                      {L('closes', 'يقفل')} {fmtDate(s.deadline)}
                    </div>
                  </div>{' '}
                  {s.taken >= s.slots ? (
                    <Status k="ready" />
                  ) : (
                    <Pill label={`${s.slots - s.taken} ${L('left', 'متبقٍ')}`} tone="warning" />
                  )}
                  {CR.recBtn('sheet', s.id)}
                </div>{' '}
                <span className="meter" style={{ marginTop: '12px' }}>
                  <i style={css(`width:${Math.round((s.taken / s.slots) * 100)}%`)} />
                </span>{' '}
                <div className="row" style={{ gap: '8px', marginTop: '14px' }}>
                  <span className="t-caption dim">
                    {s.taken} / {s.slots} {L('places taken', 'مركزاً مأخوذاً')}
                  </span>{' '}
                  <button
                    className="btn btn-secondary btn-dense"
                    style={{ marginInlineStart: 'auto' }}
                    data-act={`sheet-open:${s.id}`}
                  >
                    {L('Manage participants', 'إدارة المشاركين')}
                  </button>{' '}
                  <button className="btn btn-primary btn-dense" data-act={`sheet-open:${s.id}`}>
                    {L('Open sheet', 'فتح اللائحة')}
                  </button>
                </div>
              </div>
            </section>
          ))}
        </div>
      </>
    );
  if (tab === 'hours')
    return (
      <>
        {head}
        <div style={{ marginTop: '20px' }} className="splitview">
          <Panel title={L('Service hours, this year', 'ساعات الخدمة، هذه السنة')}>
            <C.BarChart
              rows={VOLUNTEERS.map(v => ({
                label: isAr() ? person(v.p).ar : person(v.p).lat,
                v: v.hours,
                max: 140,
                text: `${v.hours} h`
              }))}
            />
          </Panel>{' '}
          <div className="sidecol">
            <Panel title={L('Recognition', 'التقدير')}>
              <p className="t-body dim" style={{ fontSize: '14px' }}>
                {L(
                  'Optional and never automatic. A parish can thank people; ParishLife will not rank them.',
                  'اختياري وغير تلقائي أبداً. تستطيع الرعية أن تشكر؛ ولن يرتّب «حياة الرعية» أحداً.'
                )}
              </p>{' '}
              <button className="btn btn-secondary btn-dense" style={{ marginTop: '12px' }} data-act="print">
                {L('Print thank-you cards', 'طباعة بطاقات شكر')}
              </button>
            </Panel>{' '}
            <Panel title={L('Workload flags', 'تنبيهات العبء')}>
              <div className="listrow" style={{ paddingInline: 0 }}>
                <Who p={person('p12')} />
                <span className="grow" />
                <Pill label={L('3 teams this week', '٣ فرق هذا الأسبوع')} tone="warning" />
              </div>{' '}
              <p className="t-caption dim" style={{ marginTop: '10px' }}>
                {L(
                  'Shown to the leader for a conversation, not acted on by the system.',
                  'تُعرَض على المسؤول للحوار، ولا يتصرّف النظام بناءً عليها.'
                )}
              </p>
            </Panel>
          </div>
        </div>
      </>
    );

  /* rota board — sheet 04: drag a person onto a role. Green dot confirmed, amber awaiting
     reply, red border a double-booking; a swap request is a pending badge on the card. */
  const onTeams = id => ROTA.teams.filter(tm => tm.filled.some(f => f.p === id && f.s !== 'declined'));
  const cols = teams.map((tm, i) => {
    const ti = ROTA.teams.indexOf(tm);
    const cards = tm.filled.map((f, si) => {
      const at = `${ti}|${si}`;
      if (!f.p)
        return (
          <button key={si} className="rota-slot" data-accept="any" data-slot={at} data-act={`rota-fill:${at}`}>
            <span className="idle">{L(`Assign ${tm.one}`, `إسناد ${tm.oneAr}`)}</span>
            <span className="rel">{L('Release here', 'أفلت هنا')}</span>
          </button>
        );
      const p = person(f.p),
        also = onTeams(f.p).filter(x => x !== tm)[0];
      const dbl = f.s !== 'declined' && !!also;
      const sub =
        f.s === 'declined'
          ? L('Declined', 'اعتذر')
          : dbl
            ? L(`Also on ${also.team}`, `أيضاً في ${also.teamAr}`)
            : f.s === 'pending'
              ? L('Awaiting confirmation', 'بانتظار التأكيد')
              : L(p.town, p.townAr);
      return (
        <div
          key={si}
          className={`rota-card ${f.s}${dbl ? ' dbl' : ''}`}
          draggable="true"
          data-slot={at}
          data-accept={f.s === 'declined' ? 'any' : 'card'}
        >
          <Avatar p={p} cls="avatar-sm" />{' '}
          <span className="rc-t">
            <b title={isAr() ? p.ar : p.lat}>{isAr() ? p.ar : p.lat}</b>
            <small>{sub}</small>
          </span>{' '}
          {f.swap ? (
            <button className="rota-swap" data-act={`rota-swap:${at}`}>
              {L('Swap', 'تبديل')}
            </button>
          ) : (
            ''
          )}{' '}
          {f.s === 'declined' ? (
            ''
          ) : (
            <span
              className={`rdot ${f.s}`}
              role="img"
              aria-label={f.s === 'accepted' ? L('Confirmed', 'مؤكَّد') : L('Awaiting reply', 'بانتظار الردّ')}
            />
          )}{' '}
          {f.s === 'declined' ? (
            <button className="rota-sub" data-sub={p.id}>
              {L('Shortlist substitutes', 'اقتراح بدلاء')}
            </button>
          ) : (
            ''
          )}{' '}
          <span className="rc-acts">
            <button className="btn btn-secondary btn-dense" data-act={`rota-fill:${at}`}>
              {L('Replace', 'استبدال')}
            </button>{' '}
            <button className="btn btn-ghost btn-dense" data-act={`rota-remove:${at}`}>
              {L('Remove', 'إزالة')}
            </button>
          </span>
        </div>
      );
    });
    const ok = tm.filled.filter(f => f.p && f.s === 'accepted').length;
    return (
      <section key={i} className="rota-col">
        <header>
          <b>{L(tm.team, tm.teamAr)}</b>
          <small>{L(tm.one, tm.oneAr)}</small>{' '}
          <small className={ok < tm.need ? 'short' : ''}>
            {L(`${ok} of ${tm.need} confirmed`, `${ok} من ${tm.need} مؤكَّد`)}
          </small>
        </header>{' '}
        <div className="rota-list">{cards}</div>
      </section>
    );
  });
  const tray = VOLUNTEERS.map(v => person(v.p)).map((p, i) => (
    <span key={i} className="rota-chip" draggable="true" data-p={p.id}>
      <Avatar p={p} cls="avatar-xs" />
      {isAr() ? p.ar : p.lat}
    </span>
  ));
  const places = teams.flatMap(tm => tm.filled);
  const open = places.filter(f => !f.p || f.s === 'declined');
  return (
    <>
      {head}
      <div className="stats" style={{ margin: '20px 0 24px' }}>
        <Stat
          k={L('Places', 'المراكز')}
          v={places.length}
          d={
            teams.length === 1
              ? L('in one team', 'في فريق واحد')
              : L(`across ${teams.length} teams`, `في ${teams.length} فرق`)
          }
        />{' '}
        <Stat
          k={L('Confirmed', 'مؤكَّد')}
          v={places.filter(f => f.p && f.s === 'accepted').length}
          d={L('accepted the invitation', 'قبلوا الدعوة')}
        />{' '}
        <Stat
          k={L('Still open', 'ما زال شاغراً')}
          v={open.length}
          d={
            !open.length ? (
              L('every place is covered', 'كل المراكز مغطّاة')
            ) : open.some(f => f.s === 'declined') ? (
              <span className="down">{L('one declined late', 'اعتذار متأخر واحد')}</span>
            ) : (
              L('tap a place to invite someone', 'اضغط مركزاً لدعوة أحد')
            )
          }
        />{' '}
        <Stat
          k={L('Swap requests', 'طلبات التبديل')}
          v={places.filter(f => f.swap).length}
          d={L('waiting on the leader', 'بانتظار المسؤول')}
        />
      </div>{' '}
      <Panel
        title={`${fmtLong(ROTA.date)} · ${L(ROTA.service, ROTA.serviceAr)}`}
        more={
          teams.length > 2 ? (
            <span className="row rota-nav" style={{ gap: '6px' }}>
              <C.IconBtn ico="chevL" label={L('Scroll to earlier teams', 'الفرق السابقة')} data-rota-scroll="-1" />
              <C.IconBtn ico="chevR" label={L('Scroll to more teams', 'المزيد من الفرق')} data-rota-scroll="1" />
            </span>
          ) : (
            ''
          )
        }
      >
        <div className="rota-wrap">
          <div className="rota-tray">
            <span className="overline">{L('Drag onto a place', 'اسحب إلى مركز')}</span>
            {tray}
          </div>{' '}
          <div
            className={`rota-board${teams.length < 3 ? ' few' : ''}`}
            tabIndex="0"
            aria-label={L('Teams — scroll sideways for more', 'الفرق — مرّر جانبياً للمزيد')}
          >
            {cols}
          </div>
        </div>{' '}
        <p className="rota-legend">
          <span>
            <i className="rdot accepted" />
            {L('confirmed', 'مؤكَّد')}
          </span>{' '}
          <span>
            <i className="rdot pending" />
            {L('awaiting reply', 'بانتظار الردّ')}
          </span>{' '}
          <span>
            <i className="rdbl" />
            {L('double-booked', 'حجز مزدوج')}
          </span>{' '}
          <span>
            <i className="rota-swap" aria-hidden="true">
              {L('Swap', 'تبديل')}
            </i>
            {L('swap request', 'طلب تبديل')}
          </span>{' '}
          <span className="dim rota-hint">
            {L('On a phone, tap an empty place to invite someone.', 'على الهاتف، اضغط مركزاً شاغراً لدعوة أحد.')}
          </span>
        </p>
      </Panel>{' '}
      <C.InlineAlert
        tone="info"
        title={L('Late cancellations trigger a shortlist', 'الاعتذار المتأخر يُطلق لائحة بدلاء')}
        body={L(
          'ParishLife proposes volunteers who are free, trained for that team and not already serving twice that week. A human always picks.',
          'يقترح «حياة الرعية» متطوّعين متفرّغين ومدرَّبين لهذا الفريق وغير مناوبين مرّتين في الأسبوع نفسه. والاختيار دائماً بشري.'
        )}
      />
    </>
  );
}

volunteers.mount = host => {
  if (is('leader')) {
    host
      .querySelectorAll('[data-leader-add]')
      .forEach(b => b.addEventListener('click', () => memberAdd(b.dataset.leaderAdd)));
    host
      .querySelectorAll('[data-role-assign]')
      .forEach(b => b.addEventListener('click', () => ministryRoleForm(b.dataset.roleAssign)));
    host.querySelectorAll('[data-role-remove]').forEach(b =>
      b.addEventListener('click', () => {
        const [gid, index] = b.dataset.roleRemove.split('|'),
          d = groupInfo(gid);
        d.roles.splice(Number(index), 1);
        bus.refresh();
      })
    );
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
      from = el.dataset.p ? { p: el.dataset.p } : { at: el.dataset.slot };
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
      rotaDrop(from, tg.dataset.slot);
      from = null;
    });
    board.addEventListener('dragend', () => {
      clear();
      from = null;
    });
  }
  host.querySelectorAll('[data-sub]').forEach(b =>
    b.addEventListener('click', () =>
      openDrawer({
        title: L('Available substitutes', 'بدلاء متاحون'),
        sub: L(
          'Free at that hour, trained for this team, clearance valid, and not already serving twice this week.',
          'متفرّغون في تلك الساعة، مدرَّبون، إفادتهم سارية، وغير مناوبين مرّتين هذا الأسبوع.'
        ),
        body: ['p16', 'p9', 'p5'].map((id, i) => (
          <div key={i} className="listrow">
            <Who p={person(id)} />
            <span className="grow" /> <Pill label={L('Clearance valid', 'إفادة سارية')} tone="success" />{' '}
            <button className="btn btn-secondary btn-dense" data-act={`sub-invite:${id}`}>
              {L('Invite', 'دعوة')}
            </button>
          </div>
        )),
        foot: (
          <button className="btn btn-secondary" data-close="">
            {L('Close', 'إغلاق')}
          </button>
        )
      })
    )
  );
  host.querySelectorAll('[data-vol]').forEach(b => b.addEventListener('click', () => volDrawer(b.dataset.vol)));
  const rb = host.querySelector('.rota-board'),
    back = host.querySelector('[data-rota-scroll="-1"]'),
    more = host.querySelector('[data-rota-scroll="1"]');
  host.querySelectorAll('[data-rota-scroll]').forEach(b =>
    b.addEventListener('click', () => {
      const step = (rb.querySelector('.rota-col')?.offsetWidth || 280) + 14,
        way = document.documentElement.dir === 'rtl' ? -1 : 1;
      rb.scrollBy({ left: +b.dataset.rotaScroll * step * way, behavior: 'smooth' });
    })
  );
  /* the arrows rest at either end of the row (scrollLeft runs negative in Arabic) */
  const ends = () => {
    if (!rb || !back) return;
    const x = Math.abs(rb.scrollLeft),
      max = rb.scrollWidth - rb.clientWidth;
    back.disabled = x <= 2;
    more.disabled = x >= max - 2;
  };
  rb?.addEventListener('scroll', ends, { passive: true });
  ends();
};

function ministryRoleForm(gid) {
  const d = groupInfo(gid);
  openDrawer({
    title: L('Assign ministry role', 'إسناد دور في الخدمة'),
    sub: L(group(gid)?.name || '', group(gid)?.ar || ''),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="role_name">
            {L('Role', 'الدور')}
          </label>
          <Select id="role_name">
            {MINISTRY_ROLES.map(([en, ar], i) => (
              <option key={i} value={en}>
                {L(en, ar)}
              </option>
            ))}
          </Select>
        </div>
        <div className="formrow">
          <label className="label" htmlFor="role_person">
            {L('Group member', 'عضو المجموعة')}
          </label>
          <Select id="role_person">
            {d.roster.map((r, i) => (
              <option key={i} value={r.p}>
                {L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p)}
              </option>
            ))}
          </Select>
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="role_save">
          {L('Assign', 'إسناد')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#role_save').addEventListener('click', () => {
        const pid = el.querySelector('#role_person').value,
          en = el.querySelector('#role_name').value,
          ar = MINISTRY_ROLES.find(([name]) => name === en)?.[1] || en;
        if (!pid) return toast(L('Choose a group member', 'اختر عضواً من المجموعة'), '', 'warning');
        if (d.roles.some(([personId, role]) => personId === pid && role === en))
          return toast(L('Already assigned', 'الدور مسند مسبقاً'), '', 'warning');
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
    body: (
      <>
        <dl className="dl">
          <dt>{L('Skills', 'المهارات')}</dt>
          <dd>{(isAr() ? v.skillsAr : v.skills).join(', ')}</dd>
          <dt>{L('Available', 'التوفّر')}</dt>
          <dd>{v.avail.join(' · ')}</dd>
          <dt>{L('Training', 'التدريب')}</dt>
          <dd>{v.training.join(', ') || '—'}</dd>
          <dt>{L('Service hours', 'ساعات الخدمة')}</dt>
          <dd className="mono">{v.hours}</dd>
          <dt>{L('Assignments', 'الإسنادات')}</dt>
          <dd className="mono">{v.assignments}</dd>
        </dl>{' '}
        <div className="divider" />{' '}
        {v.clearance === 'valid' ? (
          <C.InlineAlert
            tone="success"
            title={L('Safeguarding clearance valid', 'إفادة الحماية سارية')}
            body={L(`Until ${fmtDate(v.until)}.`, `حتى ${fmtDate(v.until)}.`)}
          />
        ) : v.clearance === 'expiring' ? (
          <C.InlineAlert
            tone="warning"
            title={L('Clearance expires soon', 'الإفادة تنتهي قريباً')}
            body={L(
              `Expires ${fmtDate(v.until)}. Renew before the next rota.`,
              `تنتهي ${fmtDate(v.until)}. جدّدها قبل المناوبة التالية.`
            )}
          />
        ) : (
          <C.InlineAlert
            tone="danger"
            title={L('No safeguarding clearance on file', 'لا إفادة حماية في الملف')}
            body={L(
              'Cannot be scheduled to any team that works with children.',
              'لا يمكن إسناده إلى أي فريق يعمل مع الأطفال.'
            )}
          />
        )}{' '}
        <p className="t-caption dim" style={{ marginTop: '14px' }}>
          {L(
            'Who may see this documentation is controlled separately from who may schedule the team.',
            'من يرى هذه المستندات يُضبط بمعزل عمّن يجدول الفريق.'
          )}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-danger-quiet" data-act={`rec-del:volunteer|${id}`}>
          <Icon name="trash" size={16} />
          {L('Remove', 'إزالة')}
        </button>{' '}
        <button className="btn btn-secondary" data-close="" style={{ marginInlineStart: 'auto' }}>
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-primary" data-act={`vol-edit:${id}`}>
          {L('Edit', 'تعديل')}
        </button>
      </>
    )
  });
}
