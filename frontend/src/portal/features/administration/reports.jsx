/* Reports: each report filtered to what the reader may see, with its period and definitions. */
import { Select } from '../../ui/components.jsx';
import { t, isAr, num, usd, fmtDate } from '../../../lib/i18n.js';
import { S, bus } from '../../model/store.js';
import { Icon, PageHead, Panel, Table, Empty, openModal, Paged } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import {
  FUNDS,
  RATE,
  PARISH,
  GROUPS,
  GIVING_SERIES,
  PAYMENT_MIX,
  VOLUNTEERS,
  ARCHIVED,
  TODAY,
  GROUP_DETAIL,
  REGISTRATIONS,
  REGISTRANTS,
  CHECKIN,
  EVENTS,
  person
} from '../../model/data.js';

const L = (en, ar) => t(en, ar);

const REPORTS = [
  [
    'attendance',
    'attend',
    'Group meeting attendance',
    'حضور اجتماعات المجموعات',
    'Recorded attendance at group meetings and activities only',
    'حضور مسجّل في اجتماعات المجموعات وأنشطتها فقط'
  ],
  [
    'membership',
    'people',
    'Membership records',
    'سجلات الانتساب',
    'Current and archived parish records',
    'سجلات الرعية الحالية والمؤرشفة'
  ],
  [
    'groups',
    'groups',
    'Group participation',
    'مشاركة المجموعات',
    'Roster size, attendance rate, course completion',
    'حجم اللائحة ونسبة الحضور وإتمام الدورات'
  ],
  [
    'volunteers',
    'vol',
    'Volunteer workload',
    'عبء المتطوّعين',
    'Availability, conflicts, who is serving too often',
    'التوفّر والتعارضات ومن يخدم كثيراً'
  ],
  [
    'facilities',
    'rooms',
    'Facility utilisation',
    'استخدام المرافق',
    'Hours booked, refusals, equipment loans',
    'ساعات الحجز والرفض وإعارات التجهيزات'
  ],
  [
    'giving',
    'give',
    'Giving trends',
    'اتجاهات التقدمات',
    'By fund, by currency, with the rate applied',
    'حسب الصندوق والعملة، مع السعر المطبَّق'
  ],
  [
    'budget',
    'fin',
    'Budget and expenses',
    'الموازنة والمصاريف',
    'Budget against actual, approvals, reconciliation',
    'الموازنة مقابل الفعلي والموافقات والمطابقة'
  ],
  [
    'capacity',
    'registr',
    'Registration versus attendance',
    'التسجيل مقابل الحضور',
    'Unused capacity on events people signed up for',
    'السعة غير المستعملة في الأحداث المسجَّل لها'
  ]
];

export function reports(id = '') {
  if (id) return reportDetail(id);
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Administration', 'الإدارة') }, { label: L('Reports', 'التقارير') }]}
        title={L('Reporting and analytics', 'التقارير والتحليلات')}
        sub={L(
          'Every report is filtered to what you are allowed to see, and says which period and which definition it used.',
          'كل تقرير مرشَّح بحسب ما يحقّ لك الاطّلاع عليه، ويذكر الفترة والتعريف المستعملين.'
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-act="export">
              <Icon name="export" size={17} />
              {L('Export PDF / Excel / CSV', 'تصدير PDF / Excel / CSV')}
            </button>{' '}
            <button className="btn btn-primary" id="sched">
              <Icon name="clock" size={17} />
              {L('Scheduled delivery', 'إرسال مجدول')}
            </button>
          </>
        }
      />{' '}
      <Paged className="gridcards">
        {REPORTS.map(([slug, ic, en, ar, se, sa]) => (
          <a className="panel" href={`#/reports/${slug}`} style={{ display: 'block' }}>
            <div className="panel-b">
              <div className="row" style={{ gap: '10px', alignItems: 'flex-start' }}>
                <span className="avatar avatar-lg">
                  <Icon name={ic} size={20} />
                </span>{' '}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', font: '600 15px/21px var(--sans)' }}>{L(en, ar)}</b>{' '}
                  <small className="t-caption dim" style={{ display: 'block', marginTop: '3px' }}>
                    {L(se, sa)}
                  </small>
                </span>{' '}
                <span className="dimmer">
                  <Icon name="chevR" size={16} />
                </span>
              </div>
            </div>
          </a>
        ))}
      </Paged>{' '}
      <C.InlineAlert
        tone="info"
        title={L('What these numbers are, and are not', 'ما هي هذه الأرقام وما ليست')}
        body={L(
          'Individual attendance reports cover group meetings and activities. Event check-in requires a selected eligible event. Individual attendance at Masses and feast-day liturgies is not recorded.',
          'تشمل تقارير الحضور اجتماعات المجموعات وأنشطتها. يتطلّب تسجيل الوصول حدثاً مؤهّلاً محدداً. لا يُسجّل حضور الأفراد في القداديس وليتورجيات الأعياد.'
        )}
      />
    </>
  );
}

/* The period scales what is counted over time (visitors, gifts, hours, joins); averages move a little.
   Group rosters and event registrations are a snapshot, so those two reports have no period. */
const PERIODS = [
  ['This month', 'هذا الشهر', '2026-10-01', 0.11, 1.03],
  ['This year', 'هذه السنة', '2026-01-01', 1, 1],
  ['Since Easter', 'منذ الفصح', '2026-04-05', 0.66, 0.98]
];

const SNAPSHOT = ['groups', 'capacity'],
  MONEY = ['giving', 'budget'];

function reportDetail(slug) {
  const r = REPORTS.find(x => x[0] === slug) || REPORTS[0];
  const pi = S.ui.repPeriod ?? 1,
    [pen, par, from, k, a] = PERIODS[pi];
  const fund = (MONEY.includes(r[0]) && FUNDS.find(f => f.id === S.ui.repFund)) || null;
  const funds = fund ? [fund] : FUNDS;
  const sc = n => Math.round(n * k),
    av = n => Math.round(n * a);
  const bars = (items, max) => (
    <C.BarChart rows={items.map(([label, v]) => ({ label, v: sc(v), max: sc(max), text: num(sc(v)) }))} />
  );
  const filters = (
    <div className="toolbar">
      {SNAPSHOT.includes(r[0]) ? (
        <span className="chip">
          <Icon name="clock" size={14} />
          {L('As of', 'حتى')} {fmtDate(TODAY)}
        </span>
      ) : (
        <C.BGroup items={PERIODS.map(p => L(p[0], p[1]))} sel={pi} k="repPeriod" />
      )}{' '}
      {MONEY.includes(r[0]) ? (
        <Select style={{ width: 'auto' }} id="repfund" aria-label={L('Fund', 'الصندوق')}>
          <option value="">{L('All funds', 'كل الصناديق')}</option>
          {FUNDS.map(f => (
            <option value={f.id} selected={!!(fund === f)}>
              {L(f.name, f.ar)}
            </option>
          ))}
        </Select>
      ) : (
        ''
      )}{' '}
      <div style={{ marginInlineStart: 'auto', display: 'flex', gap: '6px' }}>
        <button className="btn btn-secondary btn-dense" data-act="pdf">
          <Icon name="export" size={15} />
          PDF
        </button>{' '}
        <button className="btn btn-secondary btn-dense" data-act="export">
          <Icon name="export" size={15} />
          Excel
        </button>{' '}
        <button className="btn btn-secondary btn-dense" data-act="export">
          <Icon name="export" size={15} />
          CSV
        </button>
      </div>
    </div>
  );
  const inPeriod = L(['this month', 'this year', 'since Easter'][pi], ['هذا الشهر', 'هذه السنة', 'منذ الفصح'][pi]);
  const given = funds.reduce((n, f) => n + f.actual, 0);
  const body =
    {
      attendance: () => (
        <Panel title={L('Group meetings and activities', 'اجتماعات المجموعات وأنشطتها')}>
          <Table
            cols={[
              { label: L('Group', 'المجموعة') },
              { label: L('Meeting', 'الاجتماع') },
              { label: L('Present', 'حاضر') },
              { label: L('Excused', 'معذور') },
              { label: L('Absent', 'غائب') }
            ]}
            rows={GROUPS.flatMap(g =>
              (GROUP_DETAIL[g.id]?.meetings || [])
                .filter(m => m.d >= from && m.d <= new Date().toISOString().slice(0, 10))
                .map(m => {
                  const values = Object.values(m.attendance || {});
                  return {
                    cells: [
                      L(g.name, g.ar),
                      fmtDate(m.d),
                      values.filter(v => v === 'present').length,
                      values.filter(v => v === 'excused').length,
                      values.filter(v => v === 'absent').length
                    ]
                  };
                })
            )}
          />
        </Panel>
      ),
      giving: () => (
        <>
          <div className="grid g2">
            <C.Kpi
              k={`${L('Given', 'المعطى')} ${inPeriod}`}
              v={usd(sc(given))}
              sub={`L.L ${num(sc(given) * RATE.value)}`}
              delta={fund ? L(fund.name, fund.ar) : L('All funds', 'كل الصناديق')}
              spark={GIVING_SERIES}
            />{' '}
            <Panel title={L('How people give', 'كيف يُعطي الناس')}>
              <C.Donut segments={PAYMENT_MIX.map(p => ({ ...p, label: isAr() ? p.labelAr : p.label }))} />
            </Panel>
          </div>{' '}
          <Panel title={L('By fund', 'حسب الصندوق')}>
            <C.BarChart
              rows={funds.map(f => ({
                label: L(f.name, f.ar),
                v: sc(f.actual),
                max: sc(f.budget),
                text: usd(sc(f.actual))
              }))}
            />
          </Panel>
        </>
      ),
      volunteers: () => (
        <Panel title={`${L('Service hours', 'ساعات الخدمة')} · ${inPeriod}`}>
          {bars(
            VOLUNTEERS.map(v => [isAr() ? person(v.p).ar : person(v.p).lat, v.hours]),
            140
          )}
        </Panel>
      ),
      groups: () => (
        <Panel title={L('Participation by group', 'المشاركة حسب المجموعة')}>
          <C.BarChart
            rows={GROUPS.slice(0, 6).map(g => ({
              label: L(g.name, g.ar),
              v: g.members,
              max: 45,
              text: String(g.members)
            }))}
          />
        </Panel>
      ),
      budget: () => (
        <Panel title={`${L('Budget against actual', 'الموازنة مقابل الفعلي')} · ${inPeriod}`}>
          <C.BarChart
            rows={funds.map(f => ({
              label: L(f.name, f.ar),
              v: sc(f.actual),
              max: sc(f.budget),
              text: `${usd(sc(f.actual))} / ${usd(sc(f.budget))}`
            }))}
          />
        </Panel>
      ),
      capacity: () => (
        <Panel title={L('Event registration and check-in', 'التسجيل في الأحداث والوصول إليها')}>
          <Table
            cols={[
              { label: L('Event', 'الحدث') },
              { label: L('Registered', 'مسجّل') },
              { label: L('Checked in', 'سجّل وصوله') }
            ]}
            rows={REGISTRATIONS.filter(r =>
              EVENTS.some(e => e.id === r.eventId && e.kind !== 'mass' && !e.liturgy && !e.feastLiturgy)
            ).map(r => ({
              cells: [
                L(r.event, r.eventAr),
                REGISTRANTS.filter(p => p.registrationId === r.id).length,
                (CHECKIN.sessions?.[r.eventId]?.rows || []).length
              ]
            }))}
          />
        </Panel>
      ),
      membership: () => (
        <Panel title={`${L('Membership records', 'سجلات الانتساب')} · ${inPeriod}`}>
          {bars(
            [
              [L('Current records', 'السجلات الحالية'), PARISH.people],
              [L('Archived records', 'السجلات المؤرشفة'), ARCHIVED.length]
            ],
            Math.max(1, PARISH.people, ARCHIVED.length)
          )}
        </Panel>
      ),
      facilities: () => (
        <Panel title={`${L('Room utilisation', 'استخدام القاعات')} · ${inPeriod}`}>
          <C.BarChart
            rows={[
              [L('Parish Hall', 'قاعة الرعية'), 68],
              [L('Meeting Room 1', 'قاعة اجتماعات ١'), 41],
              [L('Catechism Room A', 'صف التعليم أ'), 88],
              [L('Courtyard', 'ساحة الكنيسة'), 22]
            ].map(([label, v]) => ({ label, v: Math.min(av(v), 100), max: 100, text: `${Math.min(av(v), 100)}%` }))}
          />
        </Panel>
      )
    }[slug] ||
    (() => (
      <Panel title={L('Report', 'تقرير')}>
        <Empty glyph="reports" title={L('Nothing for this period', 'لا شيء لهذه الفترة')} body="" />
      </Panel>
    ));
  return (
    <>
      {
        <PageHead
          crumbs={[{ label: L('Reports', 'التقارير'), href: '#/reports' }, { label: L(r[2], r[3]) }]}
          title={L(r[2], r[3])}
          sub={L(r[4], r[5])}
          actions={
            <>
              <button className="btn btn-secondary" data-go="reports">
                <Icon name="chevL" size={17} />
                {L('All reports', 'كل التقارير')}
              </button>{' '}
              <button className="btn btn-primary" id="sched">
                <Icon name="clock" size={17} />
                {L('Schedule', 'جدولة')}
              </button>
            </>
          }
        />
      }{' '}
      {filters} {body()}{' '}
      {
        <Panel title={L('Definitions and period', 'التعاريف والفترة')}>
          <dl className="dl">
            <dt>{L('Period', 'الفترة')}</dt>
            <dd>
              {SNAPSHOT.includes(r[0])
                ? `${L('As of', 'حتى')} ${fmtDate(TODAY)}`
                : `${fmtDate(from)} – ${fmtDate(TODAY)}`}
            </dd>
            {fund ? (
              <>
                <dt>{L('Fund', 'الصندوق')}</dt>
                <dd>{L(fund.name, fund.ar)}</dd>
              </>
            ) : (
              ''
            )}
            <dt>{L('Counted by', 'من يعدّ')}</dt>
            <dd>{L('An usher, at the offertory', 'مُرشد، عند التقدمة')}</dd>
            <dt>{L('Excludes', 'يستثني')}</dt>
            <dd>
              {L(
                'Groups smaller than five, so no individual can be identified',
                'المجموعات الأصغر من خمسة، كي لا يُعرَّف شخص'
              )}
            </dd>
            <dt>{L('Your scope', 'نطاقك')}</dt>
            <dd>
              {L(PARISH.name, PARISH.nameAr)} {L('only', 'فقط')}
            </dd>
          </dl>
        </Panel>
      }
    </>
  );
}

reports.mount = host => {
  host.querySelector('#repfund')?.addEventListener('change', e => {
    S.ui.repFund = e.target.value;
    bus.refresh();
  });
  host.querySelector('#sched')?.addEventListener('click', () =>
    openModal({
      title: L('Scheduled delivery', 'إرسال مجدول'),
      sub: L(
        'The report is generated and sent on a schedule, filtered to each recipient’s own permissions.',
        'يُولَّد التقرير ويُرسَل وفق جدول، مرشَّحاً بحسب صلاحيات كل مستلم.'
      ),
      body: (
        <>
          <div className="formgrid">
            <div className="formrow">
              <label className="label">{L('Every', 'كل')}</label>{' '}
              <Select>
                <option>{L('Month', 'شهر')}</option>
                <option>{L('Quarter', 'فصل')}</option>
                <option>{L('Week', 'أسبوع')}</option>
              </Select>
            </div>{' '}
            <div className="formrow">
              <label className="label">{L('Format', 'الصيغة')}</label>{' '}
              <Select>
                <option>PDF</option>
                <option>Excel</option>
                <option>CSV</option>
              </Select>
            </div>
          </div>{' '}
          <C.PersonPicker label={L('Send to', 'إرسال إلى')} id="schedp" />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>{' '}
          <button className="btn btn-primary" data-act="report-schedule">
            {L('Schedule', 'جدولة')}
          </button>
        </>
      ),
      onMount(el) {}
    })
  );
};
