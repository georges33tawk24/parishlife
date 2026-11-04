/* Insights and the parish CRM, for the Super Admin: how people use the public site (visits,
   pages, forms, where visits come from, what visitors do) and how each parish is doing, with
   its stage, follow-ups and notes. The numbers come from backend/analytics.py. */
import { useEffect, useRef, useState } from 'react';
import { api } from '../../model/api.js';
import { t, isAr } from '../../../lib/i18n.js';
import { PageHead, TabBar, openDrawer, toast, Icon, CollectionPages } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import {
  number,
  percent,
  shortDate,
  Sparkline,
  Trend,
  Bars,
  Stacked,
  Funnel,
  Meter,
  healthOf,
  HEALTH,
  useChartTips,
  DataTable
} from './insight-charts.jsx';

const LABELS = {
  pages: {
    home: ['Homepage', 'الصفحة الرئيسية'],
    parish: ['Parish pages', 'صفحات الرعايا'],
    event: ['Event pages', 'صفحات المناسبات'],
    calendar: ['Calendars', 'الرزنامات'],
    request: ['Request forms', 'استمارات الطلبات'],
    bundles: ['For parishes', 'للرعايا'],
    track: ['Request tracking', 'متابعة الطلبات'],
    verify: ['Document checks', 'التحقّق من الوثائق'],
    error: ['Pages not found', 'صفحات غير موجودة']
  },
  forms: {
    baptism: ['Baptism', 'المعمودية'],
    communion: ['First Communion', 'المناولة الأولى'],
    confirmation: ['Confirmation', 'الميرون'],
    marriage: ['Marriage', 'الإكليل'],
    funeral: ['Funeral', 'الجنّاز'],
    certificate: ['Certificate', 'شهادة'],
    booking: ['Hall booking', 'حجز قاعة'],
    custom: ['Other request', 'طلب آخر'],
    appointment: ['Appointment', 'موعد'],
    ministry: ['Joining a ministry (guest)', 'الانضمام إلى خدمة (زائر)'],
    signup: ['New account', 'حساب جديد'],
    'ministry-join': ['Joining a ministry (member)', 'الانضمام إلى خدمة (عضو)']
  },
  sources: {
    whatsapp: ['WhatsApp', 'واتساب'],
    google: ['Google', 'Google'],
    social: ['Social media', 'وسائل التواصل'],
    search: ['Other search engines', 'محرّكات بحث أخرى'],
    direct: ['Direct or the app', 'مباشرة أو من التطبيق'],
    other: ['Other websites', 'مواقع أخرى']
  },
  devices: { phone: ['Phones', 'الهواتف'], desktop: ['Computers', 'الحواسيب'], tablet: ['Tablets', 'الأجهزة اللوحية'] },
  languages: { ar: ['Arabic', 'العربية'], en: ['English', 'الإنكليزية'] },
  actions: {
    ics: ['Saved an event', 'حفظ مناسبة'],
    'ics-all': ['Saved all events', 'حفظ كل المناسبات'],
    subscribe: ['Subscribed to a calendar', 'اشترك في رزنامة'],
    google: ['Added to Google Calendar', 'أضاف إلى رزنامة Google'],
    'share-whatsapp': ['Shared on WhatsApp', 'شارك على واتساب'],
    'share-copy': ['Copied a link', 'نسخ رابطاً'],
    'share-native': ['Shared from the phone', 'شارك من الهاتف'],
    directions: ['Asked for directions', 'طلب الاتجاهات'],
    call: ['Called a parish', 'اتصل برعية'],
    livestream: ['Opened a livestream', 'فتح بثّاً مباشراً'],
    'whatsapp-follow': ['Followed on WhatsApp', 'تابع عبر واتساب'],
    search: ['Searched', 'بحث'],
    'request-sent': ['Sent a request', 'أرسل طلباً'],
    'near-me': ['Used Near me', 'استعمل «بالقرب مني»']
  },
  funnel: {
    visit: ['Visited', 'زار الموقع'],
    parish: ['Opened a parish page', 'فتح صفحة رعية'],
    request: ['Opened a request form', 'فتح استمارة طلب'],
    sent: ['Sent a request', 'أرسل طلباً']
  },
  checks: {
    story: ['Story or welcome', 'الحكاية أو الترحيب'],
    massTimes: ['Mass times', 'مواعيد القداديس'],
    contact: ['Phone or email', 'هاتف أو بريد'],
    photo: ['A photograph', 'صورة'],
    map: ['Position on the map', 'الموقع على الخريطة'],
    hours: ['Office hours', 'ساعات المكتب'],
    events: ['Events in the next 30 days', 'مناسبات في الأيام الثلاثين المقبلة'],
    visit: ['Plan your visit', 'خطّط لزيارتك']
  },
  stages: {
    onboarding: ['Onboarding', 'قيد الانضمام'],
    active: ['Active', 'ناشطة'],
    attention: ['Needs attention', 'تحتاج متابعة'],
    paused: ['Paused', 'متوقّفة']
  },
  notes: {
    note: ['Note', 'ملاحظة'],
    call: ['Call', 'اتصال'],
    meeting: ['Meeting', 'اجتماع'],
    email: ['Email', 'بريد'],
    visit: ['Visit', 'زيارة']
  },
  roles: {
    priest: ['Priest', 'كاهن'],
    secretary: ['Secretary', 'أمانة السر'],
    parish_admin: ['Parish admin', 'مدير الرعية'],
    treasurer: ['Treasurer', 'أمين الصندوق'],
    leader: ['Ministry leader', 'مسؤول خدمة'],
    member: ['Member', 'عضو']
  }
};

const label = (group, key) => (LABELS[group][key] ? t(...LABELS[group][key]) : key);

const STAGE_TONE = { onboarding: 'info', active: 'success', attention: 'warning', paused: '' };

const KPIS = [
  ['visits', 'Visits', 'زيارات', 'visits'],
  ['views', 'Page views', 'مشاهدات الصفحات', 'views'],
  ['requests', 'Requests sent', 'طلبات مُرسلة', 'requests'],
  ['signups', 'New accounts', 'حسابات جديدة'],
  ['saves', 'Calendar saves', 'حفظ في الرزنامة'],
  ['shares', 'Shares', 'مشاركات'],
  ['contacts', 'Directions and calls', 'اتجاهات واتصالات']
];

let days = (() => {
  try {
    return [7, 30, 90].includes(Number(localStorage.getItem('pl-insights-days')))
      ? Number(localStorage.getItem('pl-insights-days'))
      : 30;
  } catch {
    return 30;
  }
})();

let last = null;

const sortKey = {
  visits: r => -r.visits,
  health: r => r.health,
  requests: r => -r.requests,
  activity: r => (r.lastActivity ? -Date.parse(r.lastActivity) : 0),
  name: () => 0
};

let parishView = { stage: '', q: '', sort: 'visits' };

const parishName = r => (isAr() ? r.ar || r.name : r.name || r.ar) || r.id;

const town = r => (isAr() ? r.townAr || r.town : r.town || r.townAr);

const ago = iso => {
  if (!iso) return t('No activity recorded', 'لا نشاط مسجّل');
  const days = Math.round((Date.now() - Date.parse(iso)) / 86400000),
    rtf = new Intl.RelativeTimeFormat(isAr() ? 'ar' : 'en', { numeric: 'auto' });
  return days < 1
    ? t('Today', 'اليوم')
    : days < 45
      ? rtf.format(-days, 'day')
      : rtf.format(-Math.round(days / 30), 'month');
};

const hours = h =>
  h === null || h === undefined
    ? '—'
    : h < 1
      ? t('under an hour', 'أقل من ساعة')
      : h < 48
        ? t(`${number(Math.round(h))} h`, `${number(Math.round(h))} س`)
        : t(`${number(Math.round(h / 24))} days`, `${number(Math.round(h / 24))} يوم`);

const today = () => new Date().toISOString().slice(0, 10);

export function InsightsPage({ params: [tab = ''] = [] }) {
  tab = tab === 'parishes' ? 'parishes' : '';
  const [data, setData] = useState(() => (last && last.range.days === days ? last : null));
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const root = useRef(null),
    alive = useRef(true);
  /* the numbers for the chosen period; a save in a parish's drawer asks again, then reopens it */
  const reload = () => {
    setLoading(true);
    return api('workspace/insights?days=' + days)
      .then(
        d => {
          if (!alive.current) return;
          last = d;
          setData(d);
          setError('');
        },
        e => {
          if (alive.current) setError(e.message);
        }
      )
      .finally(() => {
        if (alive.current) setLoading(false);
      });
  };
  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
    };
  }, []);
  useChartTips(root);
  return (
    <>
      <PageHead
        title={t('Insights', 'المؤشرات')}
        sub={t(
          'How people use ParishLife, and how each parish is doing.',
          'كيف يستعمل الناس ParishLife، وكيف حال كل رعية.'
        )}
      />
      <div className={'ins' + (loading ? ' is-loading' : '')} data-insights="" data-tab={tab} ref={root}>
        {error && !data ? (
          <p className="help-error" role="alert">
            {error}
          </p>
        ) : !data ? (
          <p className="ins-loading" role="status">
            {t('Counting…', 'جارٍ العدّ…')}
          </p>
        ) : (
          <>
            <Bar
              data={data}
              tab={tab}
              choose={n => {
                days = n;
                try {
                  localStorage.setItem('pl-insights-days', String(days));
                } catch {
                  /* private mode */
                }
                reload();
              }}
            />
            {tab === 'parishes' ? <Parishes data={data} reload={reload} /> : <Overview data={data} reload={reload} />}
          </>
        )}
      </div>
    </>
  );
}

function Bar({ data, tab, choose }) {
  return (
    <div className="ins-bar">
      <TabBar
        base="insights"
        items={[
          ['', 'Overview', 'نظرة عامة'],
          ['parishes', 'Parishes', 'الرعايا', data.parishes.length]
        ]}
        active={tab}
      />
      <div className="ins-period">
        <span className="seg" role="group" aria-label={t('Period', 'الفترة')}>
          {[7, 30, 90].map(n => (
            <button key={n} type="button" data-days={n} aria-pressed={n === days} onClick={() => choose(n)}>
              {t(`${n} days`, `${number(n)} يوماً`)}
            </button>
          ))}
        </span>
        <span className="ins-range">
          {shortDate(data.range.from, { day: 'numeric', month: 'short' })} –{' '}
          {shortDate(data.range.to, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

/* ---------- overview ---------- */
function Delta({ now, before }) {
  const period = t(`vs the ${number(days)} days before`, `مقارنة بالأيام الـ${number(days)} السابقة`);
  if (!before)
    return now ? (
      <span className="ins-delta is-new">
        <Icon name="plus" size={13} />
        {t('New', 'جديد')} <small>{period}</small>
      </span>
    ) : (
      <span className="ins-delta">
        <small>{period}</small>
      </span>
    );
  const change = (now - before) / before,
    up = change > 0;
  if (Math.abs(change) < 0.005)
    return (
      <span className="ins-delta">
        {t('No change', 'لا تغيير')} <small>{period}</small>
      </span>
    );
  return (
    <span className={`ins-delta ${up ? 'is-up' : 'is-down'}`}>
      <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path d={up ? 'M6 2.5 10 8H2z' : 'M6 9.5 2 4h8z'} fill="currentColor" />
      </svg>
      {(up ? '+' : '') + percent(now - before, before)} <small>{period}</small>
    </span>
  );
}

function Kpi({ k: [key, en, ar, series], data, i }) {
  const values = series ? data.daily.map(d => d[series]) : [];
  return (
    <article className={'ins-kpi' + (i === 0 ? ' is-hero' : '')}>
      <span className="ins-kpi-label">{t(en, ar)}</span>
      <b className="ins-kpi-value">{number(data.totals[key])}</b>
      <Delta now={data.totals[key]} before={data.previous[key]} />
      {series ? <Sparkline values={values} {...(i === 0 ? { width: 180, height: 44 } : {})} /> : null}
    </article>
  );
}

const Card = ({ title, sub, extra = '', children }) => (
  <section className={'ins-card' + extra}>
    <header>
      <h2>{title}</h2>
      {sub ? <p>{sub}</p> : null}
    </header>
    {children}
  </section>
);

function Overview({ data, reload }) {
  const none = t('Nothing counted in this period yet.', 'لم يُحتسب شيء في هذه الفترة بعد.');
  const rows = (list, group, extra = () => '') =>
    list.map(r => ({ label: label(group, r.key), value: r.n, note: extra(r) }));
  const pages = rows(data.pages, 'pages', r =>
    r.visits ? t(`${number(r.visits)} visits`, `${number(r.visits)} زيارة`) : ''
  );
  const forms = rows(data.forms, 'forms', r =>
    r.guest && r.member
      ? t(
          `${number(r.guest)} guests · ${number(r.member)} members`,
          `${number(r.guest)} زائر · ${number(r.member)} عضو`
        )
      : ''
  );
  const funnelRows = data.funnel.map(r => ({ label: label('funnel', r.key), value: r.n }));
  const top = [...data.parishes].sort((a, b) => b.visits - a.visits).slice(0, 6);
  return (
    <>
      <section className="ins-kpis" aria-label={t('Headline numbers', 'الأرقام الرئيسية')}>
        {KPIS.map((k, i) => (
          <Kpi key={k[0]} k={k} data={data} i={i} />
        ))}
      </section>
      <Card
        title={t('Visits and page views', 'الزيارات ومشاهدات الصفحات')}
        sub={t(
          'A visit is one visitor on one day; nobody is followed from one day to the next.',
          'الزيارة هي زائر واحد في يوم واحد؛ لا يُتتبّع أحد من يوم إلى آخر.'
        )}
        extra=" ins-wide"
      >
        <ul className="viz-key">
          <li>
            <i className="is-area" style={{ '--c': 'var(--series-1)' }} />
            {t('Page views', 'مشاهدات الصفحات')}
          </li>
          <li>
            <i style={{ '--c': 'var(--series-2)' }} />
            {t('Visits', 'الزيارات')}
          </li>
        </ul>
        <Trend
          data-trend=""
          dates={data.daily.map(d => d.d)}
          label={t('Visits and page views by day', 'الزيارات ومشاهدات الصفحات يومياً')}
          series={[
            { label: t('Page views', 'مشاهدات الصفحات'), values: data.daily.map(d => d.views), area: true },
            { label: t('Visits', 'الزيارات'), values: data.daily.map(d => d.visits) }
          ]}
        />
        <DataTable
          caption={t('Visits and page views by day', 'الزيارات والمشاهدات يومياً')}
          head={[t('Day', 'اليوم'), t('Page views', 'المشاهدات'), t('Visits', 'الزيارات'), t('Requests', 'الطلبات')]}
          rows={data.daily.map(d => [
            shortDate(d.d, { weekday: 'short', day: 'numeric', month: 'short' }),
            number(d.views),
            number(d.visits),
            number(d.requests)
          ])}
        />
      </Card>
      <div className="ins-grid">
        <Card
          title={t('Most viewed pages', 'الصفحات الأكثر مشاهدة')}
          sub={t('Page views, with the visits that saw them', 'مشاهدات الصفحات، مع عدد الزيارات')}
        >
          <Bars rows={pages} empty={none} />
        </Card>
        <Card
          title={t('Forms filled the most', 'الاستمارات الأكثر تعبئة')}
          sub={t('Requests to parish offices, and new accounts', 'الطلبات إلى مكاتب الرعايا، والحسابات الجديدة')}
        >
          <Bars rows={forms} empty={none} />
        </Card>
      </div>
      <div className="ins-grid is-three">
        <Card title={t('Where visits come from', 'من أين تأتي الزيارات')}>
          <Bars rows={rows(data.sources, 'sources')} empty={none} />
        </Card>
        <Card title={t('Devices', 'الأجهزة')}>
          <Stacked rows={rows(data.devices, 'devices')} empty={none} />
        </Card>
        <Card title={t('Languages', 'اللغات')}>
          <Stacked rows={rows(data.languages, 'languages')} empty={none} />
        </Card>
      </div>
      <div className="ins-grid">
        <Card
          title={t('From a visit to a request', 'من الزيارة إلى الطلب')}
          sub={t(
            'Visits that reached each step; each step’s share of the one before',
            'الزيارات التي بلغت كل خطوة؛ ونسبتها من الخطوة السابقة'
          )}
        >
          {data.funnel[0].n ? <Funnel rows={funnelRows} /> : <p className="viz-empty">{none}</p>}
        </Card>
        <Card title={t('What visitors do', 'ماذا يفعل الزوّار')}>
          <Bars rows={rows(data.actions, 'actions')} empty={none} />
        </Card>
      </div>
      <div className="ins-grid">
        <Card title={t('What people search for', 'عمّا يبحث الناس')}>
          {data.searches.length ? (
            <ul className="ins-searches">
              {data.searches.map((s, i) => (
                <li key={i}>
                  <span dir="auto">{s.key}</span>
                  <b>{number(s.n)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="viz-empty">{none}</p>
          )}
        </Card>
        <Card title={t('Parishes with the most visits', 'الرعايا الأكثر زيارة')}>
          {top.length ? (
            <>
              <ol className="ins-top">
                {top.map(p => (
                  <li key={p.id}>
                    <button type="button" data-open-parish={p.id} onClick={() => openParish(p, reload)}>
                      <span>
                        <b dir="auto">{parishName(p)}</b>
                        <small>{town(p) || ''}</small>
                      </span>
                      <span className="ins-top-n">
                        {number(p.visits)}
                        <small>{t('visits', 'زيارة')}</small>
                      </span>
                      <Meter score={p.health} />
                    </button>
                  </li>
                ))}
              </ol>
              <a className="btn btn-secondary btn-dense" href="#/insights/parishes">
                {t('All parishes', 'كل الرعايا')}
              </a>
            </>
          ) : (
            <p className="viz-empty">{none}</p>
          )}
        </Card>
      </div>
    </>
  );
}

/* ---------- parishes (CRM) ---------- */
function Parishes({ data, reload }) {
  const [, redraw] = useState(0),
    table = useRef(null);
  const set = patch => {
    Object.assign(parishView, patch);
    redraw(n => n + 1);
  };
  const counts = Object.fromEntries(
    Object.keys(LABELS.stages).map(k => [k, data.parishes.filter(p => p.stage === k).length])
  );
  const due = data.parishes.filter(p => p.nextFollowup && p.nextFollowup <= today()).length;
  const tones = HEALTH.map(([, tone, glyph, en, ar]) => [
    tone,
    glyph,
    t(en, ar),
    data.parishes.filter(p => healthOf(p.health)[1] === tone).length
  ]);
  const q = parishView.q.toLowerCase().trim();
  const rows = data.parishes
    .filter(
      p =>
        (!parishView.stage ||
          (parishView.stage === 'due' ? p.nextFollowup && p.nextFollowup <= today() : p.stage === parishView.stage)) &&
        (!q || [p.name, p.ar, p.town, p.townAr, p.diocese].join(' ').toLowerCase().includes(q))
    )
    .sort(
      (a, b) =>
        sortKey[parishView.sort](a) - sortKey[parishView.sort](b) ||
        parishName(a).localeCompare(parishName(b), isAr() ? 'ar' : 'en')
    );
  const exportCSV = () => {
    const head = [
      'Parish',
      'Town',
      'Diocese',
      'Bundle',
      'Stage',
      'Health',
      'Visits',
      'Page views',
      'Requests',
      'Open',
      'Waiting 3+ days',
      'Typical reply (hours)',
      'Events next 30 days',
      'Posts last 30 days',
      'Following',
      'Staff',
      'Office last active',
      'Next follow-up',
      'Notes'
    ];
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      head,
      ...data.parishes.map(p => [
        p.name,
        p.town,
        p.diocese,
        p.bundle,
        p.stage,
        p.health,
        p.visits,
        p.views,
        p.requests,
        p.open,
        p.overdue,
        p.responseHours ?? '',
        p.upcoming,
        p.posts,
        p.members,
        p.staff,
        p.lastActivity,
        p.nextFollowup,
        p.notes
      ])
    ]
      .map(r => r.map(cell).join(','))
      .join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `parishlife-parishes-${data.range.from}-to-${data.range.to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <>
      <div className="ins-crm-head">
        <div className="ins-chips" role="group" aria-label={t('Stage', 'المرحلة')}>
          <button type="button" data-stage="" aria-pressed={!parishView.stage} onClick={() => set({ stage: '' })}>
            {t('All', 'الكل')}
            <b>{number(data.parishes.length)}</b>
          </button>
          {Object.keys(LABELS.stages).map(k => (
            <button
              key={k}
              type="button"
              data-stage={k}
              aria-pressed={parishView.stage === k}
              onClick={() => set({ stage: k })}
            >
              {label('stages', k)}
              <b>{number(counts[k])}</b>
            </button>
          ))}
          <button
            type="button"
            data-stage="due"
            aria-pressed={parishView.stage === 'due'}
            onClick={() => set({ stage: 'due' })}
          >
            <Icon name="clock" size={14} />
            {t('Follow-ups due', 'متابعات مستحقة')}
            <b>{number(due)}</b>
          </button>
        </div>
        <ul className="ins-health-sum">
          {tones.map(([tone, glyph, name, n]) => (
            <li key={tone} className={`is-${tone}`}>
              <Icon name={glyph} size={14} />
              <span>{name}</span>
              <b>{number(n)}</b>
            </li>
          ))}
        </ul>
      </div>
      <div className="collection-toolbar ins-toolbar">
        <input
          className="input"
          type="search"
          data-parish-q=""
          defaultValue={parishView.q}
          placeholder={t('Search parishes or towns', 'ابحث عن رعية أو بلدة')}
          aria-label={t('Search parishes', 'ابحث عن رعية')}
          onChange={e => set({ q: e.target.value })}
        />
        <label className="ins-sort">
          {t('Sort by', 'ترتيب حسب')}{' '}
          <Select data-parish-sort="" value={parishView.sort} onChange={e => set({ sort: e.target.value })}>
            {[
              ['visits', 'Most visits', 'الأكثر زيارة'],
              ['health', 'Lowest health first', 'الأقل صحة أولاً'],
              ['requests', 'Most requests', 'الأكثر طلبات'],
              ['activity', 'Most recent activity', 'الأحدث نشاطاً'],
              ['name', 'Name', 'الاسم']
            ].map(([v, en, ar]) => (
              <option key={v} value={v}>
                {t(en, ar)}
              </option>
            ))}
          </Select>
        </label>
        <button type="button" className="btn btn-secondary btn-dense" data-export="" onClick={exportCSV}>
          <Icon name="export" size={15} />
          {t('Download CSV', 'تنزيل CSV')}
        </button>
      </div>
      <div className="tablewrap ins-tablewrap" ref={table}>
        <table className="tbl ins-table">
          <thead>
            <tr>
              {[
                t('Parish', 'الرعية'),
                t('Stage', 'المرحلة'),
                t('Health', 'الصحة'),
                t('Visits', 'الزيارات'),
                t('Requests', 'الطلبات'),
                t('Typical reply', 'الردّ المعتاد'),
                t('Coming up', 'القادم'),
                t('Following', 'المتابعون'),
                t('Office last active', 'آخر نشاط للمكتب'),
                t('Follow-up', 'المتابعة')
              ].map((h, i) => (
                <th key={i} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-parish-rows="">
            {rows.length ? (
              rows.map(p => {
                const open = () => openParish(p, reload);
                return (
                  <tr
                    key={p.id}
                    data-parish-row={p.id}
                    tabIndex="0"
                    onClick={open}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        open();
                      }
                    }}
                  >
                    <th scope="row">
                      <b dir="auto">{parishName(p)}</b>
                      <small>{[town(p), p.bundle].filter(Boolean).join(' · ')}</small>
                    </th>
                    <td>
                      <span className={`pill ${STAGE_TONE[p.stage] ? 'pill-' + STAGE_TONE[p.stage] : ''}`}>
                        {label('stages', p.stage)}
                      </span>
                    </td>
                    <td>
                      <Meter score={p.health} />
                    </td>
                    <td className="num">
                      {number(p.visits)}
                      <small>{t(`${number(p.views)} views`, `${number(p.views)} مشاهدة`)}</small>
                    </td>
                    <td className="num">
                      {number(p.requests)}
                      {p.overdue ? (
                        <small className="is-critical">
                          <Icon name="warn" size={12} />
                          {t(`${number(p.overdue)} waiting 3+ days`, `${number(p.overdue)} بانتظار ٣ أيام+`)}
                        </small>
                      ) : p.open ? (
                        <small>{t(`${number(p.open)} open`, `${number(p.open)} مفتوح`)}</small>
                      ) : null}
                    </td>
                    <td className="num">{hours(p.responseHours)}</td>
                    <td className="num">{number(p.upcoming)}</td>
                    <td className="num">{number(p.members)}</td>
                    <td>{ago(p.lastActivity)}</td>
                    <td>
                      {p.nextFollowup ? (
                        <span className={p.nextFollowup <= today() ? 'is-due' : ''}>
                          {p.nextFollowup <= today() ? <Icon name="clock" size={13} /> : null}
                          {shortDate(p.nextFollowup)}
                        </span>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="10" className="viz-empty">
                  {t('No parish matches.', 'لا رعية مطابقة.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <CollectionPages target={table} body={c => c.querySelector('tbody')} />
    </>
  );
}

/* One parish in the CRM: its numbers, what it has published, its people, and the Super Admin's
   stage, follow-up and notes. */
function ParishDetail({ p, reload }) {
  const [detail, setDetail] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const box = useRef(null);
  useEffect(() => {
    api(`workspace/insights/parish?parish=${encodeURIComponent(p.id)}&days=${days}`).then(setDetail, e =>
      setError(e.message)
    );
  }, []);
  useChartTips(box);
  if (error)
    return (
      <div className="ins ins-drawer" data-parish-detail="">
        <p className="help-error" role="alert">
          {error}
        </p>
      </div>
    );
  if (!detail)
    return (
      <div className="ins ins-drawer" data-parish-detail="">
        <p className="ins-loading" role="status">
          {t('Counting…', 'جارٍ العدّ…')}
        </p>
      </div>
    );
  const checks = Object.entries(p.checks),
    done = checks.filter(([, ok]) => ok).length;
  const total = detail.daily.reduce((s, d) => s + d.views, 0);
  const send = async (e, path, extra = {}) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(path);
    try {
      await api(path, 'POST', { ...Object.fromEntries(new FormData(form)), parish: p.id, ...extra(form) });
      toast(t('Saved', 'حُفظ'), '', 'success');
      last = null;
      await reload();
      openParish(p, reload);
    } catch (err) {
      toast(t('Could not save', 'تعذّر الحفظ'), err.message, 'danger');
      setBusy('');
    }
  };
  return (
    <div className="ins ins-drawer" data-parish-detail="" ref={box}>
      <div className="ins-detail-head">
        <p>{[town(p), p.diocese, p.bundle].filter(Boolean).join(' · ')}</p>
        <Meter score={p.health} />
        <a
          className="btn btn-secondary btn-dense"
          href={`public.html?parish=${encodeURIComponent(p.id)}`}
          target="_blank"
          rel="noopener"
        >
          <Icon name="ext" size={14} />
          {t('Public page', 'الصفحة العامة')}
        </a>
      </div>
      <div className="ins-mini">
        {[
          [t('Visits', 'الزيارات'), number(p.visits)],
          [t('Page views', 'المشاهدات'), number(total)],
          [t('Requests', 'الطلبات'), number(p.requests)],
          [t('Typical reply', 'الردّ المعتاد'), hours(p.responseHours)],
          [t('Following', 'المتابعون'), number(p.members)],
          [t('Staff', 'الفريق'), number(p.staff)]
        ].map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <Card title={t('Visits to this parish', 'زيارات هذه الرعية')}>
        <Trend
          className="ins-trend is-small"
          data-detail-trend=""
          height={200}
          dates={detail.daily.map(d => d.d)}
          label={t('Visits to this parish by day', 'زيارات هذه الرعية يومياً')}
          series={[{ label: t('Visits', 'الزيارات'), values: detail.daily.map(d => d.visits), area: true }]}
        />
        <DataTable
          caption={t('Visits by day', 'الزيارات يومياً')}
          head={[t('Day', 'اليوم'), t('Visits', 'الزيارات'), t('Page views', 'المشاهدات')]}
          rows={detail.daily.map(d => [shortDate(d.d), number(d.visits), number(d.views)])}
        />
      </Card>
      <div className="ins-grid">
        <Card
          title={t('What it has published', 'ما نشرته')}
          sub={t(`${number(done)} of ${number(checks.length)}`, `${number(done)} من ${number(checks.length)}`)}
        >
          <ul className="ins-checks">
            {checks.map(([k, ok]) => (
              <li key={k} className={ok ? 'is-done' : 'is-missing'}>
                <Icon name={ok ? 'check' : 'close'} size={14} />
                <span>{label('checks', k)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t('Requests by kind', 'الطلبات حسب النوع')}>
          <Bars
            rows={detail.requests.map(r => ({ label: label('forms', r.key), value: r.n }))}
            empty={t('No requests in this period.', 'لا طلبات في هذه الفترة.')}
          />
        </Card>
      </div>
      <div className="ins-grid">
        <Card title={t('What visitors do here', 'ماذا يفعل الزوّار هنا')}>
          <Bars
            rows={detail.actions.map(r => ({ label: label('actions', r.key), value: r.n }))}
            empty={t('Nothing counted yet.', 'لم يُحتسب شيء بعد.')}
          />
        </Card>
        <Card title={t('The parish team', 'فريق الرعية')}>
          {detail.staff.length ? (
            <ul className="ins-staff">
              {detail.staff.map((s, i) => (
                <li key={i}>
                  <b dir="auto">{s.name}</b>
                  <span>{label('roles', s.role)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="viz-empty">{t('No staff assigned yet.', 'لا فريق معيّن بعد.')}</p>
          )}
        </Card>
      </div>
      <Card title={t('Relationship', 'العلاقة')}>
        <form
          className="ins-crm-form"
          data-crm=""
          onSubmit={e => send(e, 'workspace/crm', form => ({ owner: form.owner.checked ? 'me' : '' }))}
        >
          <label className="formrow">
            <span className="label">{t('Stage', 'المرحلة')}</span>
            <Select name="stage" defaultValue={p.stage}>
              {Object.keys(LABELS.stages).map(k => (
                <option key={k} value={k}>
                  {label('stages', k)}
                </option>
              ))}
            </Select>
          </label>
          <label className="formrow">
            <span className="label">{t('Next follow-up', 'المتابعة التالية')}</span>
            <input className="input" type="date" name="nextFollowup" defaultValue={p.nextFollowup} />
          </label>
          <label className="check">
            <input type="checkbox" name="owner" value="me" defaultChecked={!!p.owner} />
            {t('I follow this parish', 'أتابع هذه الرعية')}
          </label>
          <button className="btn btn-primary btn-dense" disabled={busy === 'workspace/crm'}>
            {t('Save', 'حفظ')}
          </button>
        </form>
      </Card>
      <Card title={t('Notes', 'الملاحظات')}>
        <form className="ins-note-form" data-note="" onSubmit={e => send(e, 'workspace/crm/notes', () => ({}))}>
          <Select name="kind" aria-label={t('Kind', 'النوع')}>
            {Object.keys(LABELS.notes).map(k => (
              <option key={k} value={k}>
                {label('notes', k)}
              </option>
            ))}
          </Select>
          <textarea
            className="textarea"
            name="body"
            rows="3"
            maxLength="2000"
            required
            placeholder={t('What was said or agreed', 'ما قيل أو اتُّفق عليه')}
          />
          <button className="btn btn-primary btn-dense" disabled={busy === 'workspace/crm/notes'}>
            {t('Add note', 'إضافة ملاحظة')}
          </button>
        </form>
        <ol className="ins-notes">
          {detail.notes.length ? (
            detail.notes.map((n, i) => (
              <li key={i}>
                <span className="ins-note-kind">{label('notes', n.kind)}</span>
                <p dir="auto">{n.body}</p>
                <small>
                  {n.author} ·{' '}
                  {new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }).format(new Date(n.created_at))}
                </small>
              </li>
            ))
          ) : (
            <li className="viz-empty">{t('No notes yet.', 'لا ملاحظات بعد.')}</li>
          )}
        </ol>
      </Card>
    </div>
  );
}

function openParish(p, reload) {
  if (!p) return;
  openDrawer({
    large: true,
    title: parishName(p),
    body: <ParishDetail key={Date.now()} p={(last?.parishes || []).find(x => x.id === p.id) || p} reload={reload} />
  });
}
