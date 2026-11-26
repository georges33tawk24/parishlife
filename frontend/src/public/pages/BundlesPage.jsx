/* The bundles a parish can choose, from a public presence to the whole office (design A3): a photograph
   with the title, the four bundles as coloured cards (one more light for each step up, the complete one in
   walnut), how a parish joins as four notes with icons, and the candlelit band at the end.
   Main parts: BundlesPage, Lights. */
import { PlainPage } from './parish-parts.jsx';
import { useSite } from '../site.jsx';
import { A3Icon, PhotoHero } from '../components/a3.jsx';

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

/* An arch with one gold light for each step up. */
const Lights = ({ n }) => (
  <svg className="lights" viewBox="0 0 64 80" fill="none" aria-hidden="true" focusable="false">
    <path d="M6 78V32a26 26 0 0 1 52 0v46" stroke="currentColor" strokeWidth="2" />
    <path d="M1 78.5h62" stroke="currentColor" strokeWidth="2" />
    {Array.from({ length: n }, (_, i) => (
      <circle key={i} cx={32 + (i - (n - 1) / 2) * 11} cy={n > 2 && i % 2 ? 50 : 56} r="3.6" fill="#C9962E" />
    ))}
  </svg>
);

export function BundlesPage() {
  const { L, lang } = useSite();
  const notes = [
    [
      'key',
      L('Ask through the members portal', 'اطلب عبر بوّابة المؤمنين'),
      L(
        'A parish priest or the parish office opens the bundles in the portal and asks for the one that fits.',
        'يفتح كاهن الرعية أو مكتبها الباقات في البوّابة ويطلب ما يناسب.'
      )
    ],
    [
      'shield',
      L('The parish or the diocese decides', 'الرعية أو الأبرشية تقرّر'),
      L(
        'Parish priests may activate parish-managed bundles; diocese-sponsored changes are requests for diocesan approval.',
        'يستطيع الكاهن تفعيل باقات الرعية؛ وتتطلب الباقات برعاية الأبرشية طلب موافقتها.'
      )
    ],
    [
      'nopay',
      L('No online payment', 'لا دفع إلكتروني'),
      L(
        'Subscriptions are managed manually at present. No online payment or automatic billing is configured.',
        'تُدار الاشتراكات يدوياً حالياً. لا توجد دفعات إلكترونية أو فوترة تلقائية.'
      )
    ],
    [
      'archive',
      L('Records stay readable', 'تبقى السجلات قابلة للقراءة'),
      L(
        'Existing records remain available to read when a module is removed.',
        'تبقى السجلات قابلة للقراءة عند إزالة وحدة.'
      )
    ]
  ];
  return (
    <PlainPage className="fp">
      <PhotoHero L={L} image="img-light" crumbs={[['ParishLife', 'public.html'], [L('For parishes', 'للرعايا')]]}>
        <div className="hero-gap" style={{ maxWidth: 700 }}>
          <h1 id="pg-title" className="h1">
            {L('Choose what your parish needs', 'اختر ما تحتاجه رعيتك')}
          </h1>
          <p className="hl">
            {L(
              'Start with a public presence or add tools for your parish office and community. Arrangements can cover one parish or several parishes in a diocese.',
              'ابدأ بحضور عام أو أضف أدوات للمكتب والمجتمع الرعوي. يمكن أن يشمل الترتيب رعية واحدة أو عدة رعايا في أبرشية.'
            )}
          </p>
          <div className="acts">
            <a className="btn btn-red" href="index.html#/workspace">
              {L('Open the members portal', 'ادخل إلى بوّابة المؤمنين')}
            </a>
            <a className="btn btn-ghost" href="public.html#directory">
              {L('See the parishes', 'تصفّح الرعايا')}
            </a>
          </div>
        </div>
      </PhotoHero>
      <section className="wrap sec" aria-labelledby="fp-b">
        <h2 id="fp-b" className="h2">
          {L('Four bundles', 'أربع باقات')}
        </h2>
        <p className="lede">{L('Each bundle adds to the one before it.', 'كل باقة تضيف إلى التي قبلها.')}</p>
        <ol className="g4 tints bundles">
          {BUNDLES.map(([key, en, ar, items, itemsAr], i) => (
            <li key={key}>
              <article className={'card bundle' + (key === 'complete' ? ' top dark' : '')}>
                <Lights n={i + 1} />
                <h3 className="h3">{L(en, ar)}</h3>
                <p className="d" lang={lang === 'ar' ? 'en' : 'ar'}>
                  {lang === 'ar' ? en : ar}
                </p>
                <ul className="ticks">
                  {(lang === 'ar' ? itemsAr : items).map(item => (
                    <li key={item}>
                      <A3Icon name="check" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  className={'btn btn-wide ' + (key === 'complete' ? 'btn-red' : 'btn-soft')}
                  href="index.html#/workspace"
                >
                  {L('Manage or request this bundle', 'إدارة الباقة أو طلبها')}
                </a>
              </article>
            </li>
          ))}
        </ol>
      </section>
      <section className="fp-how" aria-labelledby="fp-how">
        <div className="strip" aria-hidden="true"></div>
        <div className="wrap sec">
          <h2 id="fp-how" className="h2">
            {L('How a parish joins', 'كيف تنضمّ الرعية')}
          </h2>
          <p className="lede">
            {L(
              'Parish priests and offices join through their diocese. Parishioners sign in to the members portal to follow their parish.',
              'ينضمّ كهنة الرعايا ومكاتبها عبر أبرشيتهم. ويدخل أبناء الرعية إلى بوّابة المؤمنين لمتابعة رعيتهم.'
            )}
          </p>
          <div className="g4 tints notes">
            {notes.map(([icon, b, s]) => (
              <div key={icon} className="card note-card">
                <span className="ic" aria-hidden="true">
                  <A3Icon name={icon} />
                </span>
                <h3 className="t">{b}</h3>
                <p>{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="votive dark img-votive" aria-labelledby="fp-join">
        <div className="votive-shade" aria-hidden="true"></div>
        <div className="wrap votive-inner" style={{ maxWidth: 860 }}>
          <h2 id="fp-join" className="votive-title">
            {L('Light your parish on the map', 'أضئ رعيتك على الخريطة')}
          </h2>
          <p className="votive-lede">
            {L(
              'Every parish on ParishLife is a gold light on the map of Lebanon, with its own page, calendar and requests.',
              'كل رعية على ParishLife نورٌ ذهبي على خريطة لبنان، ولها صفحتها ورزنامتها وطلباتها.'
            )}
          </p>
          <div className="acts" style={{ justifyContent: 'center' }}>
            <a className="btn btn-red" href="index.html#/workspace">
              {L('Open the members portal', 'ادخل إلى بوّابة المؤمنين')}
            </a>
            <a className="btn btn-ghost" href="public.html#directory">
              {L('See the parishes', 'تصفّح الرعايا')}
            </a>
          </div>
        </div>
      </section>
    </PlainPage>
  );
}
