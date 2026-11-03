/* The bundles a parish can choose, from a public presence to the whole office. */
import { useRef } from 'react';
import { Sanctuary } from '../components/Sanctuary.jsx';
import { PlainPage } from './parish-parts.jsx';
import { useSite } from '../site.jsx';

/* For parishes: the four bundles as arches (one gold light for each step up), how a parish
   joins, and the practical notes, in the words the bundles have always used. */
const BUNDLES = [
  [
    'presence',
    'Presence',
    'التعريف بالرعية',
    ['Public parish page', 'Contact details', 'Ministries', 'Public calendar'],
    ['صفحة الرعية العامة', 'معلومات التواصل', 'الخدمات', 'الرزنامة العامة']
  ],
  [
    'office',
    'Office',
    'المكتب',
    ['People and households', 'Requests', 'Sacramental records', 'Office expenses'],
    ['الأشخاص والعائلات', 'الطلبات', 'سجلات الأسرار', 'مصاريف المكتب']
  ],
  [
    'community',
    'Community',
    'المجتمع',
    ['Office records and requests', 'Ministries and registrations', 'Resources and facilities'],
    ['سجلات المكتب والطلبات', 'الخدمات والتسجيل', 'الموارد والمرافق']
  ],
  [
    'complete',
    'Complete',
    'الكاملة',
    ['Every available module', 'Sacraments', 'Parish finance'],
    ['كل الوحدات المتاحة', 'الأسرار', 'مالية الرعية']
  ]
];

const Lights = ({ n }) => (
  <span className="fp-mark" aria-hidden="true">
    <svg viewBox="0 0 64 80" fill="none">
      <path d="M6 78V32a26 26 0 0 1 52 0v46" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 78.5h62" stroke="currentColor" strokeWidth="1.5" />
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={32 + (i - (n - 1) / 2) * 11} cy={n > 2 && i % 2 ? 50 : 56} r="3.6" fill="#F1C77A" />
      ))}
    </svg>
  </span>
);

const Check = () => (
  <svg
    className="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export function BundlesPage() {
  const { L, lang } = useSite(),
    hero = useRef(null);
  const notes = [
    [
      L('Ask through the members portal', 'اطلب عبر بوّابة المؤمنين'),
      L(
        'A parish priest or the parish office opens the bundles in the portal and asks for the one that fits.',
        'يفتح كاهن الرعية أو مكتبها الباقات في البوّابة ويطلب ما يناسب.'
      )
    ],
    [
      L('The parish or the diocese decides', 'الرعية أو الأبرشية تقرّر'),
      L(
        'Parish priests may activate parish-managed bundles; diocese-sponsored changes are requests for diocesan approval.',
        'يستطيع الكاهن تفعيل باقات الرعية؛ وتتطلب الباقات برعاية الأبرشية طلب موافقتها.'
      )
    ],
    [
      L('No online payment', 'لا دفع إلكتروني'),
      L(
        'Subscriptions are managed manually at present. No online payment or automatic billing is configured.',
        'تُدار الاشتراكات يدوياً حالياً. لا توجد دفعات إلكترونية أو فوترة تلقائية.'
      )
    ],
    [
      L('Records stay readable', 'تبقى السجلات قابلة للقراءة'),
      L(
        'Existing records remain available to read when a module is removed.',
        'تبقى السجلات قابلة للقراءة عند إزالة وحدة.'
      )
    ]
  ];
  return (
    <PlainPage className="parish-sub fp" heroRef={hero}>
      <section className="sub-hero is-sanctuary" data-hero aria-labelledby="sub-title" ref={hero}>
        <div className="sub-art sub-sanctuary" aria-hidden="true">
          <Sanctuary />
        </div>
        <div className="site-wrap sub-inner">
          <nav className="ph-crumbs" aria-label={L('Breadcrumb', 'مسار التنقّل')} data-hero-rise>
            <a href="public.html">ParishLife</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{L('For parishes', 'للرعايا')}</span>
          </nav>
          <h1 className="hero-title" id="sub-title">
            {L('Choose what your parish needs', 'اختر ما تحتاجه رعيتك')}
          </h1>
          <p data-hero-rise>
            {L(
              'Start with a public presence or add tools for your parish office and community. Arrangements can cover one parish or several parishes in a diocese.',
              'ابدأ بحضور عام أو أضف أدوات للمكتب والمجتمع الرعوي. يمكن أن يشمل الترتيب رعية واحدة أو عدة رعايا في أبرشية.'
            )}
          </p>
        </div>
      </section>
      <section className="fp-bundles">
        <div className="site-wrap">
          <ol className="fp-grid">
            {BUNDLES.map(([key, en, ar, items, itemsAr], i) => (
              <li key={key} data-reveal-item>
                <article className={'fp-card' + (key === 'complete' ? ' is-complete' : '')} data-tilt>
                  <Lights n={i + 1} />
                  <h2>{L(en, ar)}</h2>
                  <p className="fp-other" lang={lang === 'ar' ? 'en' : 'ar'}>
                    {lang === 'ar' ? en : ar}
                  </p>
                  <ul>
                    {(lang === 'ar' ? itemsAr : items).map(item => (
                      <li key={item}>
                        <Check />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    className={'btn ' + (key === 'complete' ? 'btn-gilt' : 'btn-ink-line')}
                    href="index.html#/workspace"
                  >
                    {L('Manage or request this bundle', 'إدارة الباقة أو طلبها')}
                  </a>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="fp-how">
        <div className="site-wrap">
          <header className="sec-head" data-reveal>
            <h2>{L('How a parish joins', 'كيف تنضمّ الرعية')}</h2>
            <p>
              {L(
                'Parish priests and offices join through their diocese. Parishioners sign in to the members portal to follow their parish.',
                'ينضمّ كهنة الرعايا ومكاتبها عبر أبرشيتهم. ويدخل أبناء الرعية إلى بوّابة المؤمنين لمتابعة رعيتهم.'
              )}
            </p>
          </header>
          <ol className="fp-steps">
            {notes.map(([b, t]) => (
              <li key={b} data-reveal-item>
                <b>{b}</b>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="join fp-join">
        <div className="join-art" aria-hidden="true">
          {['sky', 'far', 'near'].map(part => (
            <img
              key={part}
              src={`assets/images/valley/valley-wide-dusk-${part}.webp`}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
        <div className="site-wrap join-inner" data-reveal>
          <h2>{L('Light your parish on the map', 'أضئ رعيتك على الخريطة')}</h2>
          <p>
            {L(
              'Every parish on ParishLife is a gold light on the map of Lebanon, with its own page, calendar and requests.',
              'كل رعية على ParishLife نورٌ ذهبي على خريطة لبنان، ولها صفحتها ورزنامتها وطلباتها.'
            )}
          </p>
          <div className="join-actions">
            <a className="btn btn-gilt" href="index.html#/workspace">
              {L('Open the members portal', 'ادخل إلى بوّابة المؤمنين')}
            </a>
            <a className="btn btn-line" href="public.html#directory">
              {L('See the parishes', 'تصفّح الرعايا')}
            </a>
          </div>
        </div>
      </section>
    </PlainPage>
  );
}
