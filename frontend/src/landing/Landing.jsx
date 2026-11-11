/* The ParishLife product page: what it is, its modules, the roles and what each one sees, why it
   is built for Lebanon, prices and questions. In English or Arabic (the language is remembered with
   the rest of ParishLife's), and each section rises in once as it is reached. */
import { useEffect, useLayoutEffect, useState } from 'react';
import { CountingDemo } from './CountingDemo.jsx';
import { BrandMark } from '../public/components/icons.jsx';

/* The icon sprite: paths lifted from the design system app shell, 20px @ 1.5 stroke. */
const SPRITE = {
  dash: [
    'M3.4 3.4h5.8v5.8H3.4zM10.8 3.4h5.8v3.6h-5.8zM10.8 8.6h5.8v8h-5.8zM3.4 10.8h5.8v5.8H3.4z',
    { strokeLinejoin: 'round' }
  ],
  people: ['M7 6.4a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M4 17c0-3.2 2.7-5 6-5s6 1.8 6 5', { strokeLinecap: 'round' }],
  family: [
    'M4.4 6.6a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0M11.6 7.4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M2.6 16.4c0-2.5 1.9-4 4.2-4s4.2 1.5 4.2 4M13.4 12.6c2.2 0 4 1.4 4 3.8',
    { strokeLinecap: 'round' }
  ],
  sacr: [
    'M4.4 3.6h7.6l3.6 3.2v9.6H4.4zM12 3.6v3.2h3.6M7.2 10.4h5.6M7.2 13.2h3.6',
    { strokeLinejoin: 'round', strokeLinecap: 'round' }
  ],
  attend: ['M3.6 3.6h12.8v12.8H3.6zM6.8 10.2l2.6 2.6 4.2-4.8', { strokeLinejoin: 'round', strokeLinecap: 'round' }],
  give: [
    'M3.4 10a6.6 6.6 0 1 0 13.2 0a6.6 6.6 0 1 0 -13.2 0M10 6.2v7.6M7.8 8.2h4.4M7.8 11.8h4.4',
    { strokeLinecap: 'round' }
  ],
  fin: ['M3.6 16.4h12.8M5.4 16.4V9.6M9.4 16.4V5M13.4 16.4v-4.8', { strokeLinecap: 'round' }],
  events: ['M4 5.2h12v11.2H4zM4 8.8h12M7.4 3.4v3.2M12.6 3.4v3.2', { strokeLinejoin: 'round', strokeLinecap: 'round' }],
  groups: [
    'M4.2 6.6a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0M11.4 6.6a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0M7.8 13.6a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0',
    {}
  ],
  vol: [
    'M7.2 6.4a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0M4.4 16.8v-1.4a3 3 0 0 1 3-3h5.2a3 3 0 0 1 3 3v1.4',
    { strokeLinecap: 'round' }
  ],
  msg: ['M3.4 4.4h13.2v8.6H8.2L4.8 16.2V13H3.4z', { strokeLinejoin: 'round' }],
  reports: [
    'M5 3.6h6.4l3.6 3.4v9.4H5zM11.4 3.6V7h3.6M7.8 10.8h4.4M7.8 13.4h3',
    { strokeLinejoin: 'round', strokeLinecap: 'round' }
  ],
  settings: ['M3.6 7h12.8M3.6 13h12.8M7.6 4.8v4.4M12.4 10.8v4.4', { strokeLinecap: 'round' }],
  checkin: ['M10 3.6v8.8M6.6 9l3.4 3.4L13.4 9M4 16.4h12', { strokeLinejoin: 'round', strokeLinecap: 'round' }],
  notes: ['M5 3.6h10v12.8H5zM7.8 7.2h4.4M7.8 10h4.4M7.8 12.8h2.6', { strokeLinejoin: 'round', strokeLinecap: 'round' }],
  check: [
    'M3 8.4l3.2 3.2L13 4.8',
    { strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' },
    '0 0 16 16'
  ],
  warn: ['M10 3.2 17.4 16H2.6zM10 8.2v3.4M10 13.6v.9', { strokeLinejoin: 'round', strokeLinecap: 'round' }],
  bell: [
    'M5.4 8.4a4.6 4.6 0 1 1 9.2 0c0 3 1.4 4.2 1.4 4.2H4S5.4 11.4 5.4 8.4M8.4 15.4a1.8 1.8 0 0 0 3.2 0',
    { strokeLinecap: 'round', strokeLinejoin: 'round' }
  ],
  search: ['M4.2 9.4a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0 -10.4 0M13.4 13.4 16.6 16.6', { strokeLinecap: 'round' }]
};
function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <g
          id="ic-base"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        ></g>
      </defs>
      {Object.entries(SPRITE).map(([id, [d, line, box = '0 0 20 20']]) => (
        <symbol key={id} id={'ic-' + id} viewBox={box}>
          <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" {...line} />
        </symbol>
      ))}
    </svg>
  );
}
const Use = ({ id, size = 17, ...props }) => (
  <svg width={size} height={size} {...props}>
    <use href={'#ic-' + id} />
  </svg>
);

/* Rails are the ones drawn in the design system app shell (05).
   ["l", en, ar, icon, badge, active] for a link, ["h", en, ar] for a heading. */
const ROLES = {
  priest: {
    en: 'Parish priest',
    ar: 'كاهن الرعية',
    user: 'Fr. Antoine Khoury',
    userAr: 'الأب أنطوان خوري',
    initials: 'AK',
    noteEn: 'Full access. The only role that can see pastoral notes, sign certificates and change the exchange rate.',
    noteAr: 'صلاحية كاملة. الدور الوحيد الذي يرى الملاحظات الرعوية ويوقّع الشهادات ويغيّر سعر الصرف.',
    titleEn: 'Good evening, Fr. Antoine',
    titleAr: 'مساء الخير يا أبونا أنطوان',
    subEn: 'Sunday 4 October · 3 certificates awaiting your signature',
    subAr: 'الأحد ٤ تشرين الأول · ٣ شهادات بانتظار توقيعك',
    items: [
      ['l', 'Dashboard', 'لوحة القيادة', 'dash', '', 1],
      ['h', 'Records', 'السجلات'],
      ['l', 'People', 'المؤمنون', 'people', '1,380'],
      ['l', 'Families', 'العائلات', 'family', '412'],
      ['l', 'Sacraments', 'الأسرار', 'sacr', '3'],
      ['l', 'Notes & Tasks', 'الملاحظات والمهام', 'notes', ''],
      ['h', 'Parish life', 'حياة الرعية'],
      ['l', 'Attendance', 'الحضور', 'attend', ''],
      ['l', 'Events', 'الأحداث', 'events', ''],
      ['l', 'Groups', 'المجموعات', 'groups', ''],
      ['l', 'Volunteers', 'المتطوّعون', 'vol', ''],
      ['l', 'Messaging', 'المراسلة', 'msg', ''],
      ['h', 'Money & admin', 'المال والإدارة'],
      ['l', 'Giving & finance', 'التقدمات والمالية', 'give', ''],
      ['l', 'Reports', 'التقارير', 'reports', ''],
      ['l', 'Settings', 'الإعدادات', 'settings', '']
    ]
  },
  secretary: {
    en: 'Secretary',
    ar: 'أمينة السرّ',
    user: 'Rita Nassar',
    userAr: 'ريتا نصّار',
    initials: 'RN',
    noteEn: 'People, records, events and messaging. Giving is not in the rail at all — hidden modules do not appear.',
    noteAr: 'المؤمنون والسجلّات والأحداث والمراسلة. التقدمات غائبة كلياً عن الشريط — الإخفاء أفضل من الإطفاء.',
    titleEn: 'Good morning, Rita',
    titleAr: 'صباح الخير يا ريتا',
    subEn: '4 certificate requests · 2 new registrations from the portal',
    subAr: '٤ طلبات شهادات · تسجيلان جديدان من البوّابة',
    items: [
      ['l', 'Dashboard', 'لوحة القيادة', 'dash', '', 1],
      ['h', 'Records', 'السجلات'],
      ['l', 'People', 'المؤمنون', 'people', '1,380'],
      ['l', 'Families', 'العائلات', 'family', '412'],
      ['l', 'Sacraments', 'الأسرار', 'sacr', '3'],
      ['h', 'Parish life', 'حياة الرعية'],
      ['l', 'Attendance', 'الحضور', 'attend', ''],
      ['l', 'Events', 'الأحداث', 'events', ''],
      ['l', 'Groups', 'المجموعات', 'groups', ''],
      ['l', 'Messaging', 'المراسلة', 'msg', '2'],
      ['h', 'Admin', 'الإدارة'],
      ['l', 'Reports', 'التقارير', 'reports', '']
    ]
  },
  treasurer: {
    en: 'Treasurer',
    ar: 'أمين الصندوق',
    user: 'Nabil Saade',
    userAr: 'نبيل سعادة',
    initials: 'NS',
    noteEn:
      'Money only. Sees amounts and envelope numbers but not pastoral notes, and is the one who can edit the parish rate.',
    noteAr: 'المال فقط. يرى المبالغ وأرقام المظاريف لا الملاحظات الرعوية، وهو من يعدّل سعر الرعية.',
    titleEn: 'Giving overview',
    titleAr: 'نظرة على التقدمات',
    subEn: 'Session 214 is open · rate last set 6 days ago',
    subAr: 'الجلسة ٢١٤ مفتوحة · آخر ضبط للسعر قبل ٦ أيام',
    items: [
      ['l', 'Dashboard', 'لوحة القيادة', 'dash', '', 1],
      ['h', 'Giving', 'التقدمات'],
      ['l', 'Contributions', 'المساهمات', 'give', ''],
      ['l', 'Counting sessions', 'جلسات العدّ', 'attend', '1'],
      ['l', 'Pledges', 'التعهّدات', 'notes', ''],
      ['l', 'Statements', 'الكشوفات', 'reports', ''],
      ['h', 'Finance', 'المالية'],
      ['l', 'Funds', 'الصناديق', 'fin', ''],
      ['l', 'Expenses', 'المصاريف', 'fin', ''],
      ['l', 'Budget vs actual', 'الموازنة مقابل الفعلي', 'fin', ''],
      ['l', 'Reconciliation', 'المطابقة', 'attend', ''],
      ['h', 'Admin', 'الإدارة'],
      ['l', 'Reports', 'التقارير', 'reports', ''],
      ['l', 'Currency & rate', 'العملة والسعر', 'settings', '']
    ]
  },
  leader: {
    en: 'Ministry leader',
    ar: 'مسؤولة خدمة',
    user: 'Maya Haddad',
    userAr: 'مايا حدّاد',
    initials: 'MH',
    noteEn:
      'Scoped to the groups she leads. Every list she opens is already filtered to her people — the parish list, giving and other groups are not in the rail at all.',
    noteAr:
      'محصورة بالمجموعات التي تقودها. كل لائحة تفتحها مرشّحة مسبقاً على أفرادها — لائحة الرعية والتقدمات والمجموعات الأخرى غائبة كلياً عن الشريط.',
    titleEn: 'Choir & Catechism G4',
    titleAr: 'الجوقة وتعليم مسيحي — الصف الرابع',
    subEn: '42 members · 2 swap requests waiting',
    subAr: '٤٢ عضواً · طلبا تبديل بالانتظار',
    items: [
      ['l', 'Dashboard', 'لوحة القيادة', 'dash', '', 1],
      ['h', 'My ministry', 'خدمتي'],
      ['l', 'Choir', 'الجوقة', 'groups', '24'],
      ['l', 'Catechism G4', 'تعليم مسيحي ٤', 'groups', '18'],
      ['l', 'Take attendance', 'تسجيل الحضور', 'attend', ''],
      ['l', 'Rota', 'المناوبات', 'vol', '2'],
      ['l', 'Message my group', 'مراسلة مجموعتي', 'msg', '']
    ]
  }
};
const ORDER = ['priest', 'secretary', 'treasurer', 'leader'];

const caps = { letterSpacing: '.06em', textTransform: 'uppercase' };

function Roles({ L }) {
  const [current, setCurrent] = useState('priest');
  const r = ROLES[current],
    ar = L(false, true);
  return (
    <>
      <div className="roletabs" style={{ marginTop: 32 }} id="roletabs">
        {ORDER.map(key => (
          <button
            key={key}
            type="button"
            className={'chip' + (key === current ? ' chip-on' : '')}
            aria-pressed={key === current}
            onClick={() => setCurrent(key)}
          >
            {ar ? ROLES[key].ar : ROLES[key].en}
          </button>
        ))}
      </div>
      <div className="rolebody">
        <div className="rolerail" id="rolerail">
          {r.items.map((it, i) =>
            it[0] === 'h' ? (
              <div key={i} className="navgroup">
                {ar ? it[2] : it[1]}
              </div>
            ) : (
              <div key={i} className={'navitem' + (it[5] ? ' on' : '')}>
                <Use id={it[3]} aria-hidden="true" />
                <span>{ar ? it[2] : it[1]}</span>
                {it[4] ? (
                  <span className="badge tnum" dir="ltr">
                    {it[4]}
                  </span>
                ) : null}
              </div>
            )
          )}
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div className="row" style={{ gap: 14 }}>
            <span className="avatar" style={{ width: 44, height: 44, fontSize: 15 }} id="roleinitials">
              {r.initials}
            </span>
            <div>
              <div className="t-sub" id="roleuser">
                {ar ? r.userAr : r.user}
              </div>
              <div className="t-ui dim" id="rolename">
                {ar ? r.ar : r.en}
              </div>
            </div>
          </div>
          <hr className="rule" style={{ margin: '20px 0' }} />
          <p className="t-body dim" id="rolenote">
            {ar ? r.noteAr : r.noteEn}
          </p>
          <div className="stack" style={{ gap: 6, marginTop: 20 }}>
            <div className="t-caption dimmer" style={caps}>
              {L('Lands on', 'الشاشة الأولى')}
            </div>
            <div className="t-sub" id="roletitle">
              {ar ? r.titleAr : r.titleEn}
            </div>
            <div className="t-ui dim" id="rolesub">
              {ar ? r.subAr : r.subEn}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const MODULES = [
  [
    'people',
    ['People', 'المؤمنون'],
    [
      'Arabic and Latin names, governorate–district–town address, +961 phone, rite, visitor or member status.',
      'اسم عربي ولاتيني، عنوان بالمحافظة والقضاء والبلدة، هاتف ‎+961‎، طقس، وحالة زائر أو منتسب.'
    ]
  ],
  [
    'family',
    ['Families', 'العائلات'],
    [
      'Households linked to one home and one envelope number, with children carried under both names.',
      'أسر مترابطة بمنزل واحد ومظروف واحد، مع أطفال يحملون الاسمين.'
    ]
  ],
  [
    'sacr',
    ['Sacraments', 'الأسرار'],
    [
      'Baptism, chrismation, communion, marriage, burial — with A4 certificates the priest signs before they print.',
      'معمودية وميرون ومناولة وإكليل ودفن — مع شهادات تُطبع على مقاس A4 وتوقيع الكاهن.'
    ]
  ],
  [
    'attend',
    ['Attendance', 'الحضور'],
    [
      'Mass counts and event check-in, with guardian pickup codes when needed.',
      'عدّ القداس وتسجيل وصول المشتركين إلى الأحداث، مع رمز لاستلام الأطفال عند الحاجة.'
    ]
  ],
  [
    'events',
    ['Events', 'الأحداث'],
    [
      'One calendar for services, meetings and reservations, with views for a person, a group, the parish and the eparchy.',
      'رزنامة واحدة للخدمات والاجتماعات والحجوزات، بعروض للشخص والمجموعة والرعية والأبرشية.'
    ]
  ],
  [
    'groups',
    ['Groups', 'المجموعات'],
    [
      'Choir, catechism, sodalities, youth — each with its own leader, roster and attendance.',
      'جوقة، تعليم مسيحي، أخويّات، شبيبة — لكلٍّ مسؤولها ولائحته وحضوره.'
    ]
  ],
  [
    'vol',
    ['Volunteers', 'المتطوّعون'],
    [
      'A rota board with swap requests, so everyone can see who is serving and when.',
      'لوحة مناوبات بطلبات تبديل، فيعرف الجميع من يخدم ومتى.'
    ]
  ],
  [
    'msg',
    ['Messaging', 'المراسلة'],
    [
      'In-app messages and parish updates, with each person’s preferred channel kept on their record.',
      'رسائل داخل التطبيق ومستجدات الرعية، مع حفظ وسيلة التواصل المفضّلة في سجلّ كل شخص.'
    ]
  ],
  [
    'give',
    ['Giving', 'التقدمات'],
    [
      'Counting sessions with numbered envelopes, unattributed cash, pledges, and year-end statements in both currencies.',
      'جلسات عدّ بمظاريف مرقّمة، ونقد غير مسمّى، وتعهّدات، وكشوفات سنوية بالعملتين.'
    ]
  ],
  [
    'fin',
    ['Finance', 'المالية'],
    [
      'Funds, expenses, budget versus actual and reconciliation — every line stamped with its rate.',
      'صناديق ومصاريف وموازنة مقابل فعلي ومطابقة — كلها تحمل سعر الصرف.'
    ]
  ],
  [
    'reports',
    ['Reports', 'التقارير'],
    [
      'Eparchy and council reports, exported to PDF or Excel in either language.',
      'تقارير للأبرشية وللمجلس، تُصدَّر إلى PDF وExcel بأيّ من اللغتين.'
    ]
  ],
  [
    'checkin',
    ['Member portal', 'بوّابة المؤمنين'],
    [
      "Families update their own address and phone and request a certificate, without reaching anyone else's record.",
      'تحدّث العائلات عنوانها وهاتفها بنفسها، وتطلب شهادة، من دون أن تدخل إلى سجلّات غيرها.'
    ]
  ]
];
const FAQ = [
  [
    ['Does it work without internet?', 'هل يعمل من دون إنترنت؟'],
    [
      'Not for office work yet. Records are saved on the parish’s server, so entering them needs a connection; if a save fails, the screen says so at once and shows what is really on record. The public pages (parishes, Mass times and events) stay readable on a phone without a connection.',
      'ليس لعمل المكتب بعد. تُحفظ السجلات على خادم الرعية، لذا يحتاج إدخالها إلى اتصال؛ وإذا تعذّر الحفظ تقول الشاشة ذلك فوراً وتعرض ما هو مسجَّل فعلاً. أمّا الصفحات العامة (الرعايا ومواعيد القداديس والأحداث) فتبقى مقروءة على الهاتف من دون اتصال.'
    ]
  ],
  [
    ['Can we keep our paper registers?', 'هل نستطيع الاحتفاظ بسجلّاتنا الورقية؟'],
    [
      'Yes, and many parishes do. ParishLife prints A4 pages carrying the same register numbering, so the bound book stays the legal original while the system is what you search and report from.',
      'نعم، والكثير من الرعايا تفعل. تطبع ParishLife على مقاس A4 بترقيم السجلّ نفسه، فيبقى الدفتر هو الأصل القانوني ويكون النظام هو ما تبحث فيه وتُصدر منه التقارير.'
    ]
  ],
  [
    ['What happens when the exchange rate moves?', 'ماذا يحصل حين يتغيّر سعر الصرف؟'],
    [
      'Past records do not change. Every amount is stored with the rate that produced it, so a receipt reprinted next year gives the same figure. A new rate applies only going forward, and the system warns you when the rate has gone stale instead of quietly using it.',
      'السجلّات القديمة لا تتغيّر. كل مبلغ محفوظ مع السعر الذي أنتجه، فإعادة طباعة إيصال من العام الماضي تعطي الرقم نفسه. السعر الجديد يسري على ما هو آتٍ فقط، ويحذّرك النظام حين يتقادم السعر.'
    ]
  ],
  [
    ['Who can see what?', 'من يرى ماذا؟'],
    [
      'Staff access follows their office role, while members use a personal portal. The priest sees pastoral notes and approves certificates. The secretary does not see finances, the treasurer does not see pastoral notes, and a ministry leader sees only their groups. A volunteer can sign in as a member without belonging to a group.',
      'للموظفين صلاحيات بحسب دورهم، وللأعضاء بوابة شخصية. الكاهن يرى الملاحظات الرعوية ويعتمد الشهادات. أمين السرّ لا يرى المال. أمين الصندوق لا يرى الملاحظات. مسؤول الخدمة يرى مجموعاته فقط. يمكن للمتطوع تسجيل الدخول كعضو، حتى لو لم يكن في أي مجموعة.'
    ]
  ],
  [
    ['Can parishioners see their own records?', 'هل يستطيع المؤمنون رؤية سجلّاتهم؟'],
    [
      "Through the member portal a family updates its own address, phone and members, requests a certificate and sees its own giving statement. It reaches no one else's record, and every change is reviewed by the office before it lands.",
      'عبر بوّابة المؤمنين: تحدّث العائلة عنوانها وهاتفها وأفرادها، وتطلب شهادة، وترى كشف تقدماتها. لا تصل إلى سجلّ أحد آخر، وكل تعديل يمرّ على المكتب قبل اعتماده.'
    ]
  ],
  [
    ['Where is the data kept, and can we export it?', 'أين تُحفظ البيانات، وهل نستطيع تصديرها؟'],
    [
      'In the parish’s database on the server. Lists and reports export to Excel, CSV or PDF in either language, without asking and without a fee. The records belong to the parish.',
      'في قاعدة بيانات الرعية على الخادم. تُصدَّر القوائم والتقارير إلى Excel أو CSV أو PDF بأيّ من اللغتين، من دون طلب ومن دون رسم. السجلات ملك الرعية.'
    ]
  ]
];
/* Scroll reveal: each section's direct content rises in once, siblings a beat apart. */
function useReveal() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return undefined;
    document.documentElement.classList.add('motion');
    const items = document.querySelectorAll('.section .wrap > *, .section-lg .wrap > *, .module, .footer .wrap > *');
    const io = new IntersectionObserver(
      entries =>
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    items.forEach(el => {
      const sibs = [...el.parentElement.children].filter(x => x.matches('.module'));
      if (el.matches('.module')) el.style.transitionDelay = `${Math.min(sibs.indexOf(el) % 4, 3) * 60}ms`;
      el.setAttribute('data-reveal', '');
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
}

export function Landing({ initialLang }) {
  const [lang, setLang] = useState(initialLang);
  const L = (en, ar) => (lang === 'ar' ? ar : en);
  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('pl-lang', lang);
    } catch {
      /* private mode */
    }
  }, [lang]);
  useReveal();
  const check = <Use id="check" size={15} />;
  return (
    <>
      <Sprite />
      <header className="topbar">
        <div className="wrap">
          <a className="brand" href="#top">
            <span className="mark" aria-hidden="true">
              <BrandMark />
            </span>
            <span className="name">{L('ParishLife', 'حياة الرعية')}</span>
          </a>
          <nav className="navlinks" aria-label="Primary">
            <a href="#how">{L('How it works', 'كيف يعمل')}</a>
            <a href="#modules">{L('Modules', 'الوحدات')}</a>
            <a href="#roles">{L('Roles', 'الأدوار')}</a>
            <a href="#lebanon">{L('Built for Lebanon', 'من أجل لبنان')}</a>
            <a href="#pricing">{L('Pricing', 'الأسعار')}</a>
          </nav>
          <div className="langtoggle" role="group" aria-label="Language">
            <button type="button" data-lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
              EN
            </button>
            <button type="button" data-lang="ar" aria-pressed={lang === 'ar'} lang="ar" onClick={() => setLang('ar')}>
              ع
            </button>
          </div>
          <a className="btn btn-primary" href="#book">
            {L('Book a walkthrough', 'احجز عرضاً')}
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap">
            <h1 className="hero-title">
              {L(
                'Your parish register, kept the way your parish actually works.',
                'سجلّ رعيّتك، محفوظ كما تعمل رعيّتك فعلاً.'
              )}
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              {L(
                'ParishLife keeps people, sacraments, attendance and the collection in one place — in Arabic and in English, in dollars and in lira.',
                'يجمع «حياة الرعية» المؤمنين والأسرار والحضور والتقدمات في مكان واحد — بالعربية والإنكليزية، بالدولار والليرة.'
              )}
            </p>
            <div className="hero-actions">
              <a className="btn btn-gilt btn-lg" href="#book">
                {L('Book a walkthrough', 'احجز عرضاً تجريبياً')}
              </a>
              <a className="btn btn-outline-dark btn-lg" href="#how">
                {L('See how it works', 'شاهد كيف يعمل')}
              </a>
            </div>
          </div>
        </section>

        <section className="demo-band">
          <div className="wrap">
            <CountingDemo L={L} Use={Use} />
            <div className="facts">
              <div className="fact">
                <div className="k">
                  EN{' / '}
                  <span lang="ar">ع</span>
                </div>
                <div className="v">
                  {L(
                    'Every screen drawn in both directions, not translated later.',
                    'كل شاشة مرسومة بالاتجاهين، لا ترجمة لاحقة.'
                  )}
                </div>
              </div>
              <div className="fact">
                <div className="k" dir="ltr">
                  {'$ / L.L'}
                </div>
                <div className="v">
                  {L(
                    'Every amount in both currencies, with the rate that produced it.',
                    'كل مبلغ بالعملتين، مع السعر الذي أنتجه.'
                  )}
                </div>
              </div>
              <div className="fact">
                <div className="k">5</div>
                <div className="v">
                  {L(
                    'roles: priest, secretary, treasurer, ministry leader, and member.',
                    'أدوار: كاهن، أمين سرّ، أمين صندوق، مسؤول خدمة، وعضو.'
                  )}
                </div>
              </div>
              <div className="fact">
                <div className="k">{L('Signed', 'موقَّعة')}</div>
                <div className="v">
                  {L(
                    'Certificates carry a signature anyone can check online.',
                    'تحمل الشهادات توقيعاً يمكن لأيّ كان التحقّق منه عبر الإنترنت.'
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="why">
          <div className="wrap">
            <h2 className="t-display" style={{ maxWidth: '20ch' }}>
              {L(
                'The parish office as it actually is — not as software assumes it is.',
                'مكتب الرعية كما هو فعلاً، لا كما تفترضه البرامج.'
              )}
            </h2>
            <div className="grid g4" style={{ marginTop: 40 }}>
              {[
                [
                  ['Two registers, two alphabets', 'سجلّان، أبجديّتان'],
                  [
                    'The baptism book is written in Arabic. The phone list the office searches is in Latin letters. Most software makes you pick one.',
                    'سجلّ المعمودية بالعربية. لائحة الهواتف التي يبحث فيها المكتب بالحروف اللاتينية. معظم البرامج تجبرك على الاختيار.'
                  ]
                ],
                [
                  ['A collection counted in cash', 'تقدمة تُعدّ نقداً'],
                  [
                    'Envelopes, two currencies, and a rate that moved since last Sunday. A spreadsheet loses the rate the moment you overwrite the cell.',
                    'مظاريف وعملتان وسعر صرف تغيّر منذ الأحد الماضي. جداول «إكسل» تفقد السعر.'
                  ]
                ],
                [
                  ['Three hours of state power', 'ثلاث ساعات كهرباء'],
                  [
                    'The connection drops in the middle of an entry. You should know at once whether it was saved.',
                    'ينقطع الاتصال في منتصف الإدخال. يجب أن تعرف فوراً هل حُفظ ما كتبت أم لا.'
                  ]
                ],
                [
                  ['One volunteer, one laptop', 'متطوّع واحد وحاسوب واحد'],
                  [
                    'Whoever is in the office on Tuesday has to be able to use it untrained, on an eight-year-old monitor in poor light.',
                    'من يكون في المكتب يوم الثلاثاء يجب أن يستطيع استعماله بلا تدريب، على شاشة قديمة وإضاءة ضعيفة.'
                  ]
                ]
              ].map(([h, p]) => (
                <div key={h[0]} className="card card-flat">
                  <h3>{L(...h)}</h3>
                  <p className="t-body dim" style={{ marginTop: 8 }}>
                    {L(...p)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-lg" id="how">
          <div className="wrap stack" style={{ gap: 72 }}>
            <div className="grid g2" style={{ alignItems: 'center', gap: 64 }}>
              <div>
                <h2 className="t-heading">
                  {L(
                    'Bilingual in the record itself, not in a translation layer.',
                    'ثنائي اللغة في السجلّ نفسه، لا في الترجمة.'
                  )}
                </h2>
                <p className="t-body dim" style={{ marginTop: 16, maxWidth: '52ch' }}>
                  {L(
                    'The Arabic name is what the certificate prints. The Latin transliteration is what the office searches by. Both are stored on every record, always, and both are always shown — the interface language only decides which one leads.',
                    'الاسم العربي هو ما تطبعه الشهادة. الحرف اللاتيني هو ما يبحث به المكتب. الاثنان محفوظان على كل سجلّ دائماً، والاثنان يظهران دائماً — لغة الواجهة تقرّر فقط أيّهما يتصدّر.'
                  )}
                </p>
                <p className="t-body dim" style={{ marginTop: 16, maxWidth: '52ch' }}>
                  {L(
                    'In Arabic everything mirrors: the sidebar side, the table column order, the chart axis, the drawer entry edge, every chevron. Clocks, logos and the play triangle never flip.',
                    'وبالعربية ينعكس كل شيء: جهة الشريط الجانبي، ترتيب أعمدة الجدول، محور الرسم البياني، حافة دخول الدرج، وأسهم التنقّل. الساعات والشعارات وأزرار التشغيل لا تنعكس أبداً.'
                  )}
                </p>
              </div>
              <div className="card" style={{ padding: 32 }}>
                <div className="row" style={{ gap: 16 }}>
                  <span className="avatar" style={{ width: 56, height: 56, fontSize: 19 }}>
                    GH
                  </span>
                  <div>
                    <div style={{ font: '600 26px/1.5 var(--arabic)' }}>جورج حدّاد</div>
                    <div className="t-ui dim" style={{ marginTop: 2 }}>
                      Georges Haddad
                    </div>
                  </div>
                </div>
                <hr className="rule" style={{ margin: '20px 0' }} />
                <div className="t-caption dimmer" style={caps}>
                  {L('Certificate name', 'اسم الشهادة')}
                </div>
                <div style={{ font: '600 18px/1.6 var(--arabic)', marginTop: 4 }}>جورج الياس حدّاد</div>
                <div className="t-caption dimmer" style={{ ...caps, marginTop: 16 }}>
                  {L('Search key', 'مفتاح البحث')}
                </div>
                <div className="t-ui" style={{ marginTop: 4 }}>
                  Georges Haddad · Georges Hadad · جورج حداد
                </div>
              </div>
            </div>

            <div className="grid g2" style={{ alignItems: 'center', gap: 64 }}>
              <div className="card" style={{ padding: 32 }}>
                <div className="t-caption dimmer" style={caps}>
                  {L('Counting session 214 — total', 'جلسة العدّ ٢١٤ — المجموع')}
                </div>
                <div className="amount" style={{ marginTop: 12 }} dir="ltr">
                  <div className="usd">$1,250.00</div>
                  <div className="lbp">L.L 111,875,000</div>
                  <div className="rate">at 89,500 · set 4 Oct 2026</div>
                </div>
                <hr className="rule" style={{ margin: '20px 0' }} />
                <div className="stack" style={{ gap: 10 }}>
                  <div className="field">
                    <span className="prefix">USD</span>
                    <span className="value" dir="ltr">
                      1,250.00
                    </span>
                  </div>
                  <div className="field">
                    <span className="prefix">L.L</span>
                    <span className="value" dir="ltr">
                      111,875,000
                    </span>
                  </div>
                </div>
                <div className="alert alert-warning" style={{ marginTop: 16 }}>
                  <Use id="warn" size={18} />
                  <span>
                    <b>{L('Rate is 6 days old', 'السعر عمره ٦ أيام')}</b>
                    <span>
                      {L(
                        'Set it again before you close the session so the receipts carry the right figure.',
                        'أعِد ضبطه قبل إقفال الجلسة كي تحمل الإيصالات السعر الصحيح.'
                      )}
                    </span>
                  </span>
                </div>
              </div>
              <div>
                <h2 className="t-heading">
                  {L('Every amount carries the rate that produced it.', 'كل مبلغ يحمل معه السعر الذي أنتجه.')}
                </h2>
                <p className="t-body dim" style={{ marginTop: 16, maxWidth: '52ch' }}>
                  {L(
                    "USD leads at full size, lira follows in mono beneath it. The rate that produced the figure travels with it — because last month's rate is a different number, and a receipt reprinted next year has to still be true.",
                    'الدولار يتصدّر بالحجم الكامل، والليرة تتبعه بخط أحادي المسافة تحته. والسعر الذي أنتج الرقم يسافر معه، لأنّ سعر الشهر الماضي رقم آخر.'
                  )}
                </p>
                <p className="t-body dim" style={{ marginTop: 16, maxWidth: '52ch' }}>
                  {L(
                    'The rate is set once in the top bar. Receipts, statements, pledge balances and the budget all derive from it, and the system tells you when it has gone stale rather than quietly using it.',
                    'يُضبط السعر مرة واحدة في الشريط العلوي. الإيصالات والكشوفات والتقارير تُحتسب كلها منه، ويحذّرك النظام حين يتقادم.'
                  )}
                </p>
              </div>
            </div>

            <div className="grid g2" style={{ alignItems: 'center', gap: 64 }}>
              <div>
                <h2 className="t-heading">
                  {L('Plain about what was saved when the line drops.', 'واضح بشأن ما حُفظ حين ينقطع الخط.')}
                </h2>
                <p className="t-body dim" style={{ marginTop: 16, maxWidth: '52ch' }}>
                  {L(
                    'Every entry is saved to the parish’s records on the server, and the sidebar always shows the state of the connection. If a save fails you are told at once, and the screen returns to what is really on record, so nobody finds out weeks later.',
                    'يُحفظ كل إدخال في سجلات الرعية على الخادم، ويُظهر الشريط الجانبي حالة الاتصال دائماً. وإذا تعذّر الحفظ تُبلَّغ فوراً وتعود الشاشة إلى ما هو مسجَّل فعلاً، فلا يكتشف أحد الأمر بعد أسابيع.'
                  )}
                </p>
                <p className="t-body dim" style={{ marginTop: 16, maxWidth: '52ch' }}>
                  {L(
                    'Entering records without a connection is not in this version. The public pages are different: parishes, Mass times and events stay readable on a phone, from the last copy it saw.',
                    'إدخال السجلات من دون اتصال غير متوفّر في هذه النسخة. أمّا الصفحات العامة فتبقى الرعايا ومواعيد القداديس والأحداث مقروءة على الهاتف، من آخر نسخة شاهدها.'
                  )}
                </p>
              </div>
              <div className="stack" style={{ gap: 12 }}>
                <div className="alert alert-danger">
                  <Use id="warn" size={18} />
                  <span>
                    <b>{L('Changes were not saved', 'لم تُحفظ التغييرات')}</b>
                    <span>
                      {L('The screen now shows what is really on record.', 'تعرض الشاشة الآن ما هو مسجَّل فعلاً.')}
                    </span>
                  </span>
                </div>
                <div className="card row" style={{ gap: 10, padding: '16px 20px', flexWrap: 'wrap' }}>
                  <span className="pill pill-success">
                    <span className="dot"></span>
                    <span>{L('Connected to parish records', 'متصل بسجلات الرعية')}</span>
                  </span>
                  <span className="t-caption dimmer">{L('always in the sidebar', 'دائماً في الشريط الجانبي')}</span>
                </div>
                <div className="card row" style={{ gap: 10, padding: '16px 20px', flexWrap: 'wrap' }}>
                  <span className="pill pill-danger">
                    <span className="dot"></span>
                    <span>{L('Save failed', 'تعذّر الحفظ')}</span>
                  </span>
                  <span className="t-caption dimmer">{L('until the next save works', 'إلى أن ينجح الحفظ التالي')}</span>
                </div>
                <div className="card row" style={{ gap: 10, padding: '16px 20px', flexWrap: 'wrap' }}>
                  <span className="pill pill-info">
                    <span className="dot"></span>
                    <span>{L('Public pages', 'الصفحات العامة')}</span>
                  </span>
                  <span className="t-caption dimmer">
                    {L('stay readable without a connection', 'تبقى مقروءة من دون اتصال')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="modules">
          <div className="wrap">
            <h2 className="t-display" style={{ maxWidth: '22ch' }}>
              {L('Everything a parish keeps, in one place.', 'كل ما تحتفظ به الرعية، في مكان واحد.')}
            </h2>
            <div className="grid g3" style={{ marginTop: 40 }}>
              {MODULES.map(([icon, name, text]) => (
                <div key={icon} className="module">
                  <span className="ico">
                    <Use id={icon} size={20} />
                  </span>
                  <span>
                    <b>{L(...name)}</b>
                    <p>{L(...text)}</p>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="roles">
          <div className="wrap">
            <h2 className="t-display" style={{ maxWidth: '24ch' }}>
              {L('Modules a role cannot use are absent, not dimmed.', 'الوحدات الممنوعة غائبة، لا مطفأة.')}
            </h2>
            <p className="lede" style={{ marginTop: 16 }}>
              {L(
                'The treasurer does not see pastoral notes. The secretary does not see money. A ministry leader sees only the people in the groups they lead. Same rail, five different products.',
                'أمين الصندوق لا يرى الملاحظات الرعوية. أمين السرّ لا يرى المال. مسؤول الخدمة يرى مجموعته فقط. الشريط الجانبي نفسه، وخمسة منتجات مختلفة.'
              )}
            </p>
            <Roles L={L} />
          </div>
        </section>

        <section className="section-lg panel-dark" id="lebanon">
          <div className="wrap">
            <h2 className="t-display" style={{ maxWidth: '26ch' }}>
              {L(
                'These are not localisation afterthoughts. They are tokens in the data model.',
                'ليست توطيناً لاحقاً — بل رموز في نموذج البيانات نفسه.'
              )}
            </h2>
            <div className="grid g2" style={{ marginTop: 48, gap: 24 }}>
              <div className="card">
                <h3 className="t-sub">{L('Rite', 'الطقس')}</h3>
                <p className="t-body dim" style={{ marginTop: 8 }}>
                  {L(
                    'Each parish and each person carries their rite, and the people list filters by it.',
                    'لكل رعية ولكل شخص طقسه، ويمكن ترشيح لائحة المؤمنين بحسبه.'
                  )}
                </p>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                  {[
                    ['Maronite', 'ماروني'],
                    ['Greek Orthodox', 'روم أرثوذكس'],
                    ['Melkite', 'روم كاثوليك'],
                    ['Armenian', 'أرمني'],
                    ['Syriac', 'سرياني'],
                    ['Latin', 'لاتيني'],
                    ['Evangelical', 'إنجيلي']
                  ].map(([en, ar], i) => (
                    <span key={en} className={'chip' + (i === 0 ? ' chip-on' : '')}>
                      {L(en, ar)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="t-sub">{L('Address & phone', 'العنوان والهاتف')}</h3>
                <p className="t-body dim" style={{ marginTop: 8 }}>
                  {L(
                    'A governorate → district → town cascade, then a free building line and a landmark line. No postal code field exists anywhere in the product.',
                    'تسلسل محافظة ← قضاء ← بلدة، ثم سطر حرّ للبناية وسطر لمَعلَم. لا حقل رمز بريدي في أيّ مكان من المنتج.'
                  )}
                </p>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                  <span className="chip">{L('Mount Lebanon', 'جبل لبنان')}</span>
                  <span className="dimmer">→</span>
                  <span className="chip">{L('Baabda', 'بعبدا')}</span>
                  <span className="dimmer">→</span>
                  <span className="chip chip-on">{L('Hadath', 'الحدث')}</span>
                </div>
                <div className="t-ui dim" style={{ marginTop: 12 }}>
                  {L('Imm. Khoury, 3rd floor — behind the municipality', 'بناية خوري، الطابق الثالث — خلف البلدية')}
                </div>
                <div className="field" style={{ marginTop: 12, maxWidth: 240 }} dir="ltr">
                  <span className="prefix">+961</span>
                  <span className="value">3 421 887</span>
                </div>
              </div>

              <div className="card">
                <h3 className="t-sub">{L('Messaging', 'المراسلة')}</h3>
                <p className="t-body dim" style={{ marginTop: 8 }}>
                  {L(
                    'Send messages and publish parish or group updates inside ParishLife. Each person’s record keeps how they prefer to be reached. WhatsApp, SMS and email delivery need a connected service, and are not included yet.',
                    'أرسل الرسائل وانشر مستجدات الرعية والمجموعات داخل «حياة الرعية». يحفظ سجلّ كل شخص وسيلة التواصل التي يفضّلها. يتطلّب الإرسال عبر واتساب والرسائل القصيرة والبريد الإلكتروني خدمة موصولة، وهو غير مشمول بعد.'
                  )}
                </p>
                <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  <span className="chip chip-on">{L('In-app', 'داخل التطبيق')}</span>
                  <span className="chip">
                    WhatsApp{' '}
                    <span className="t-caption" style={{ marginInlineStart: 6 }}>
                      {L('not connected', 'غير موصول')}
                    </span>
                  </span>
                  <span className="chip">
                    SMS{' '}
                    <span className="t-caption" style={{ marginInlineStart: 6 }}>
                      {L('not connected', 'غير موصول')}
                    </span>
                  </span>
                  <span className="chip">
                    {L('Email', 'بريد إلكتروني')}{' '}
                    <span className="t-caption" style={{ marginInlineStart: 6 }}>
                      {L('not connected', 'غير موصول')}
                    </span>
                  </span>
                </div>
              </div>

              <div className="card">
                <h3 className="t-sub">{L('Direction', 'الاتجاه')}</h3>
                <p className="t-body dim" style={{ marginTop: 8 }}>
                  {L(
                    'Arabic mirrors everything: sidebar side, table column order, chart axis, drawer entry edge, chevrons, progress fill. Clocks, logos, media controls and the play triangle never flip.',
                    'العربية تعكس كل شيء: جهة الشريط، ترتيب الأعمدة، محور الرسم، حافة الدرج، الأسهم، امتلاء شريط التقدّم. الساعات والشعارات وأزرار الوسائط ومثلّث التشغيل لا تنعكس أبداً.'
                  )}
                </p>
                <div className="row" style={{ gap: 8, marginTop: 16 }}>
                  <span className="chip mono" dir="ltr">
                    dir=ltr
                  </span>
                  <span className="chip chip-on mono" dir="ltr">
                    dir=rtl
                  </span>
                </div>
                <p className="t-caption" style={{ marginTop: 12, color: 'var(--ink)' }}>
                  {L(
                    'Numerals and amounts stay left-to-right in both directions.',
                    'الأرقام والمبالغ تبقى من اليسار إلى اليمين في الحالتين.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section-lg" id="pricing">
          <div className="wrap">
            <h2 className="t-display" style={{ maxWidth: '22ch' }}>
              {L('Priced in dollars, payable in either currency.', 'تُسعَّر بالدولار، وتُدفع بأيّ من العملتين.')}
            </h2>
            <p className="lede" style={{ marginTop: 16 }}>
              {L(
                'Shown in both currencies at the same parish rate the system uses inside. No setup fee, no annual lock-in.',
                'السعر يظهر بالعملتين على سعر الرعية نفسه المستعمل داخل النظام. لا رسوم إعداد، ولا عقد سنوي.'
              )}
            </p>

            <div className="grid g3" style={{ marginTop: 40 }}>
              <div className="card plan">
                <div>
                  <div className="t-ui dim">{L('Small parish', 'رعية صغيرة')}</div>
                  <div className="amount" style={{ marginTop: 10 }} dir="ltr">
                    <div className="usd">
                      $19
                      <span className="t-ui dim" style={{ fontWeight: 400 }}>
                        /mo
                      </span>
                    </div>
                    <div className="lbp">L.L 1,700,500</div>
                    <div className="rate">at 89,500</div>
                  </div>
                </div>
                <p className="t-body dim">
                  {L('Up to 500 records. One or two people in the office.', 'حتى ٥٠٠ سجلّ. مستعمل واحد أو اثنان.')}
                </p>
                <ul>
                  <li>
                    {check}
                    <span>{L('People, families, sacraments', 'المؤمنون والعائلات والأسرار')}</span>
                  </li>
                  <li>
                    {check}
                    <span>{L('A4 certificate printing', 'الشهادات على مقاس A4')}</span>
                  </li>
                  <li>
                    {check}
                    <span>{L('Public pages readable offline', 'صفحات عامة مقروءة بلا إنترنت')}</span>
                  </li>
                </ul>
                <a className="btn btn-secondary" href="#book">
                  {L('Start', 'ابدأ')}
                </a>
              </div>

              <div className="card plan featured">
                <div>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="t-ui dim">{L('Parish', 'رعية')}</span>
                    <span className="pill pill-info">
                      <span className="dot"></span>
                      <span>{L('Most parishes', 'الأكثر اختياراً')}</span>
                    </span>
                  </div>
                  <div className="amount" style={{ marginTop: 10 }} dir="ltr">
                    <div className="usd">
                      $49
                      <span className="t-ui dim" style={{ fontWeight: 400 }}>
                        /mo
                      </span>
                    </div>
                    <div className="lbp">L.L 4,385,500</div>
                    <div className="rate">at 89,500</div>
                  </div>
                </div>
                <p className="t-body dim">
                  {L(
                    'Unlimited records, all five roles, every module.',
                    'سجلّات غير محدودة، وخمسة أدوار، وكل الوحدات.'
                  )}
                </p>
                <ul>
                  <li>
                    {check}
                    <span>{L('Everything in Small parish', 'كل ما في الباقة الصغيرة')}</span>
                  </li>
                  <li>
                    {check}
                    <span>{L('Giving, finance, counting sessions', 'التقدمات والمالية وجلسات العدّ')}</span>
                  </li>
                  <li>
                    {check}
                    <span>{L('In-app messaging and rotas', 'المراسلة داخل التطبيق والمناوبات')}</span>
                  </li>
                  <li>
                    {check}
                    <span>{L('Member portal', 'بوّابة المؤمنين')}</span>
                  </li>
                </ul>
                <a className="btn btn-primary" href="#book">
                  {L('Book a walkthrough', 'احجز عرضاً')}
                </a>
              </div>

              <div className="card plan">
                <div>
                  <div className="t-ui dim">{L('Eparchy', 'أبرشية')}</div>
                  <div className="amount" style={{ marginTop: 10 }}>
                    <div className="usd">{L("Let's talk", 'حسب الطلب')}</div>
                    <div className="lbp" style={{ fontFamily: 'var(--sans)' }}>
                      {L('several parishes, consolidated reporting', 'عدة رعايا وتقارير موحّدة')}
                    </div>
                  </div>
                </div>
                <p className="t-body dim">
                  {L(
                    'One dashboard across parishes, shared certificate templates, support in Arabic.',
                    'لوحة موحّدة للأبرشية، وقوالب شهادات مشتركة، ودعم بالعربية.'
                  )}
                </p>
                <ul>
                  <li>
                    {check}
                    <span>{L('Everything in Parish', 'كل ما في باقة الرعية')}</span>
                  </li>
                  <li>
                    {check}
                    <span>{L('Cross-parish reporting', 'تقارير موحّدة عبر الرعايا')}</span>
                  </li>
                  <li>
                    {check}
                    <span>{L('Paper register migration', 'ترحيل السجلّات الورقية')}</span>
                  </li>
                </ul>
                <a className="btn btn-secondary" href="#book">
                  {L('Contact us', 'تواصل معنا')}
                </a>
              </div>
            </div>
            <p className="t-caption dimmer" style={{ marginTop: 20 }}>
              {L(
                'Lira figures are computed at the parish rate and move with it.',
                'تُحتسب مبالغ الليرة على سعر الرعية وتتغيّر معه.'
              )}
            </p>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="wrap">
            <h2 className="t-display">{L('What every parish asks first.', 'ما تسأله كل رعية قبل أن تبدأ.')}</h2>
            <div className="faq" style={{ marginTop: 32 }}>
              {FAQ.map(([q, a], i) => (
                <details key={i} open={i === 0 ? true : undefined}>
                  <summary>{L(...q)}</summary>
                  <p>{L(...a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="section-lg panel-dark" id="book">
          <div className="wrap" style={{ textAlign: 'center' }}>
            <h2 className="t-display" style={{ maxWidth: '20ch', marginInline: 'auto' }}>
              {L('Set your parish up in one afternoon.', 'أعدّ رعيّتك في بعد ظهر واحد.')}
            </h2>
            <p className="lede" style={{ margin: '16px auto 0', maxWidth: '56ch' }}>
              {L(
                'We walk you through setup together: the rite, the roles, the rate, and the first hundred records out of your book. In Arabic or in English.',
                'نمشي معك في الإعداد: الطقس، والأدوار، وسعر الصرف، وأول مئة سجلّ من دفترك. بالعربية أو بالإنكليزية.'
              )}
            </p>
            <div className="row" style={{ gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
              <a className="btn btn-gilt btn-lg" href="mailto:hello@parishlife.app">
                {L('Book a walkthrough', 'احجز عرضاً تجريبياً')}
              </a>
              <a className="btn btn-outline-dark btn-lg" href="https://wa.me/9613421887">
                {L('Message us on WhatsApp', 'راسلنا على واتساب')}
              </a>
            </div>
            <p className="t-caption" style={{ marginTop: 20, color: 'rgba(255,255,255,.6)' }}>
              {L(
                '30 minutes · no commitment · we bring your sample data already loaded.',
                '٣٠ دقيقة · بلا التزام · نحضر لك بياناتك التجريبية مسبقاً.'
              )}
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap">
          <div className="grid g4">
            <div>
              <div className="brand">
                <span className="mark" aria-hidden="true">
                  <BrandMark />
                </span>
                <span className="name">ParishLife</span>
              </div>
              <div style={{ font: '600 20px/1.6 var(--arabic)', marginTop: 6 }}>حياة الرعية</div>
              <p className="t-caption dimmer" style={{ marginTop: 12, maxWidth: '30ch' }}>
                {L(
                  'Parish management built in Lebanon, for parishes in Lebanon.',
                  'إدارة رعايا مبنية في لبنان، للرعايا في لبنان.'
                )}
              </p>
            </div>
            <div>
              <h5>{L('Product', 'المنتج')}</h5>
              <a href="#modules">{L('Modules', 'الوحدات')}</a>
              <a href="#roles">{L('Roles', 'الأدوار')}</a>
              <a href="#pricing">{L('Pricing', 'الأسعار')}</a>
              <a href="#faq">{L('Questions', 'أسئلة متكرّرة')}</a>
            </div>
            <div>
              <h5>{L('Parish', 'الرعية')}</h5>
              <a href="#book">{L('Book a walkthrough', 'احجز عرضاً')}</a>
              <a href="#lebanon">{L('Built for Lebanon', 'من أجل لبنان')}</a>
              <a href="#how">{L('When the line drops', 'حين ينقطع الخط')}</a>
            </div>
            <div>
              <h5>{L('Contact', 'تواصل')}</h5>
              <a href="mailto:hello@parishlife.app">hello@parishlife.app</a>
              <a href="https://wa.me/9613421887" dir="ltr">
                +961 3 421 887
              </a>
              <a href="#">{L('Beirut, Lebanon', 'بيروت، لبنان')}</a>
            </div>
          </div>
          <hr className="rule" style={{ margin: '32px 0 20px' }} />
          <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
            <span className="t-caption dimmer">© 2026 ParishLife</span>
            <span className="t-caption dimmer">{L('Privacy', 'الخصوصية')}</span>
            <span className="t-caption dimmer">{L('Terms', 'الشروط')}</span>
          </div>
        </div>
        <div className="footer-mark" aria-hidden="true">
          ParishLife
        </div>
      </footer>
    </>
  );
}
