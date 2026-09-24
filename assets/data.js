/* Demo data for Saint Elias Parish, Hadath — Maronite, Archeparchy of Beirut.
   Frontend only: nothing here is fetched, and edits live in memory for the
   session. Every name is stored as a pair because the Arabic name is the record
   of truth for certificates and the Latin one is what the office searches by. */

export const TODAY = new Date(2026, 9, 4);      // Sunday 4 October 2026
export const RATE = { value: 89500, setOn: new Date(2026, 9, 4), setBy: 'Fr. Antoine Khoury' };
export const RATE_AGE_DAYS = 0;

export const PARISH = {
  name: 'Saint Elias', nameAr: 'مار الياس',
  town: 'Hadath', townAr: 'الحدث',
  rite: 'Maronite', riteAr: 'ماروني',
  eparchy: 'Archeparchy of Beirut', eparchyAr: 'أبرشية بيروت',
  address: 'Imm. Khoury, main road — behind the municipality',
  addressAr: 'بناية خوري، الطريق العام — خلف البلدية',
  phone: '+961 5 461 220',
  people: 1380, households: 412, groups: 11, volunteers: 96
};

/* ---------- people ---------- */
const P = (id, lat, ar, town, townAr, rite, status, phone, born, hh, tags = [], extra = {}) =>
  ({ id, lat, ar, town, townAr, rite, status, phone, born, hh, tags, ...extra });

export const PEOPLE = [
  P('p1','Georges Haddad','جورج حدّاد','Hadath','الحدث','Maronite','member','3 421 887','1968-03-14','h1',['council','envelope 0142']),
  P('p2','Nada Haddad','ندى حدّاد','Hadath','الحدث','Maronite','member','3 998 104','1972-11-02','h1',['catechism parent'], { rel:'spouse', emergency:true }),
  P('p3','Maya Haddad','مايا حدّاد','Hadath','الحدث','Maronite','member','76 220 415','1999-06-21','h1',['choir','ministry leader'], { rel:'child', emergency:true }),
  P('p4','Rita Nassar','ريتا نصّار','Baabda','بعبدا','Maronite','member','3 660 918','1980-01-30','h2',['staff','envelope 0088']),
  P('p5','Tony Gemayel','طوني الجميّل','Hazmieh','الحازمية','Maronite','member','70 145 332','1961-09-09','h3',['usher']),
  P('p6','Carla Abou Jaoude','كارلا أبو جودة','Louaizeh','اللويزة','Melkite','member','71 803 559','1988-04-17','h4',['lector']),
  P('p7','Joseph Sfeir','جوزيف صفير','Hadath','الحدث','Maronite','member','3 512 776','1954-12-05','h5',['brotherhood','envelope 0031']),
  P('p8','Marie-Thérèse Saliba','ماري تريز صليبا','Furn el Chebbak','فرن الشباك','Maronite','member','76 449 201','1975-07-28','h6',[]),
  P('p9','Charbel Matar','شربل مطر','Hadath','الحدث','Maronite','member','81 337 640','2003-02-11','h7',['altar server','youth']),
  P('p10','Hanna Daou','حنّا ضو','Ain el Remmaneh','عين الرمانة','Greek Orthodox','visitor','3 274 985','1991-10-19',null,[]),
  P('p11','Zeina Kassab','زينة قصاب','Baabda','بعبدا','Maronite','member','70 908 116','1983-05-23','h8',['catechism teacher']),
  P('p12','Roy Bou Khalil','روي بو خليل','Hadath','الحدث','Maronite','member','3 118 470','1996-08-30','h9',['choir','sound']),
  P('p13','Sarkis Yammine','سركيس يمين','Hazmieh','الحازمية','Armenian','member','76 610 228','1949-01-12','h10',['envelope 0205']),
  P('p14','Pauline Chidiac','بولين شديّاق','Hadath','الحدث','Maronite','member','71 552 903','1966-03-03','h11',['legion of mary']),
  P('p15','Nabil Saade','نبيل سعادة','Hadath','الحدث','Maronite','member','3 774 016','1970-06-08','h12',['staff','treasurer']),
  P('p16','Elias Aoun','الياس عون','Baabda','بعبدا','Maronite','member','81 204 663','2001-11-27','h13',['volunteer','check-in']),
  P('p17','Antoine Khoury','أنطوان خوري','Hadath','الحدث','Maronite','clergy','3 900 411','1963-04-02',null,['parish priest']),
  P('p18','Michel Rahmé','ميشال رحمة','Hadath','الحدث','Maronite','clergy','70 331 872','1979-09-15',null,['assistant priest']),
  P('p19','Yara Matar','يارا مطر','Hadath','الحدث','Maronite','member','—','2016-05-04','h7',['catechism G4','child'], { rel:'sibling' }),
  P('p20','Karim Matar','كريم مطر','Hadath','الحدث','Maronite','member','—','2018-12-19','h7',['nursery','child'], { rel:'sibling' })
];

/* Archived people are out of every list, picker and message, but the record is kept
   and can be restored; person() still finds them so old register entries resolve. */
export const ARCHIVED = [
  { ...P('p21','Fouad Karam','فؤاد كرم','Hadath','الحدث','Maronite','member','3 205 118','1951-02-09',null,[]), archived:'2026-09-18', archivedBy:'p4' },
  { ...P('p22','Leila Azar','ليلى عازار','Baabda','بعبدا','Maronite','member','70 411 862','1987-12-01',null,[]), archived:'2026-09-30', archivedBy:'p4' }
];

export const HOUSEHOLDS = [
  { id:'h1', name:'Haddad', ar:'حدّاد', head:'p1', members:['p1','p2','p3'], town:'Hadath', townAr:'الحدث', envelope:'0142', address:'Imm. Sfeir, 3rd floor — behind the municipality', addressAr:'بناية صفير، الطابق الثالث — خلف البلدية' },
  { id:'h2', name:'Nassar', ar:'نصّار', head:'p4', members:['p4'], town:'Baabda', townAr:'بعبدا', envelope:'0088', address:'Old road, near the pharmacy', addressAr:'الطريق القديم، قرب الصيدلية' },
  { id:'h3', name:'Gemayel', ar:'الجميّل', head:'p5', members:['p5'], town:'Hazmieh', townAr:'الحازمية', envelope:'0119', address:'Main road, Hazmieh', addressAr:'الطريق العام، الحازمية' },
  { id:'h7', name:'Matar', ar:'مطر', head:'p9', members:['p9','p19','p20'], town:'Hadath', townAr:'الحدث', envelope:'0177', address:'Imm. Chidiac, 1st floor', addressAr:'بناية شديّاق، الطابق الأول' },
  { id:'h5', name:'Sfeir', ar:'صفير', head:'p7', members:['p7'], town:'Hadath', townAr:'الحدث', envelope:'0031', address:'Main street, above the bakery', addressAr:'الشارع العام، فوق الفرن' },
  { id:'h12', name:'Saade', ar:'سعادة', head:'p15', members:['p15'], town:'Hadath', townAr:'الحدث', envelope:'0096', address:'Church square', addressAr:'ساحة الكنيسة' }
];

/* ---------- groups & ministries ---------- */
export const GROUPS = [
  { id:'g1', name:'Saint Elias Choir', ar:'جوقة مار الياس', cat:'Worship', catAr:'العبادة', leader:'p3', members:24, meets:'Friday 19:00', meetsAr:'الجمعة ١٩:٠٠', vis:'public' },
  { id:'g2', name:'Catechism — Grade 4', ar:'تعليم مسيحي — الصف الرابع', cat:'Formation', catAr:'التنشئة', leader:'p3', assistant:'p11', members:18, meets:'Sunday 09:15', meetsAr:'الأحد ٠٩:١٥', vis:'private' },
  { id:'g3', name:'Parish Youth', ar:'شبيبة الرعية', cat:'Formation', catAr:'التنشئة', leader:'p9', members:41, meets:'Saturday 18:00', meetsAr:'السبت ١٨:٠٠', vis:'public' },
  { id:'g4', name:'Legion of Mary', ar:'فيلق مريم', cat:'Devotion', catAr:'التقوى', leader:'p14', members:16, meets:'Tuesday 16:30', meetsAr:'الثلاثاء ١٦:٣٠', vis:'public' },
  { id:'g5', name:'Altar Servers', ar:'خدّام المذبح', cat:'Worship', catAr:'العبادة', leader:'p18', members:22, meets:'Sunday 09:45', meetsAr:'الأحد ٠٩:٤٥', vis:'private' },
  { id:'g6', name:'Brotherhood of Our Lady', ar:'أخويّة سيدة الحدث', cat:'Devotion', catAr:'التقوى', leader:'p7', members:34, meets:'First Sunday 17:00', meetsAr:'الأحد الأول ١٧:٠٠', vis:'public' },
  { id:'g7', name:'Parish Council', ar:'المجلس الرعوي', cat:'Governance', catAr:'الإدارة', leader:'p1', members:9, meets:'Monthly', meetsAr:'شهرياً', vis:'confidential' },
  { id:'g8', name:'Hospitality Team', ar:'فريق الضيافة', cat:'Service', catAr:'الخدمة', leader:'p8', members:12, meets:'Rota', meetsAr:'بالمناوبة', vis:'public' }
];

/* ---------- facilities & reservations ---------- */
export const VENUES = [
  { id:'v1', name:'Upper Church', ar:'الكنيسة العليا', cap:420, kind:'Worship', kindAr:'عبادة', access:true },
  { id:'v2', name:'Crypt Chapel', ar:'الكنيسة السفلى', cap:120, kind:'Worship', kindAr:'عبادة', access:false },
  { id:'v3', name:'Parish Hall', ar:'قاعة الرعية', cap:180, kind:'Hall', kindAr:'قاعة', access:true },
  { id:'v4', name:'Meeting Room 1', ar:'قاعة اجتماعات ١', cap:20, kind:'Room', kindAr:'غرفة', access:true },
  { id:'v5', name:'Catechism Room A', ar:'صف التعليم أ', cap:28, kind:'Room', kindAr:'غرفة', access:true },
  { id:'v6', name:'Kitchen', ar:'المطبخ', cap:8, kind:'Service', kindAr:'خدمة', access:false },
  { id:'v7', name:'Courtyard', ar:'ساحة الكنيسة', cap:300, kind:'Outdoor', kindAr:'خارجي', access:true },
  { id:'v8', name:'Sports Field', ar:'الملعب', cap:60, kind:'Outdoor', kindAr:'خارجي', access:true }
];

export const EQUIPMENT = [
  { id:'e1', name:'Wireless microphones', ar:'مايكروفونات لاسلكية', qty:6, out:2, cond:'good' },
  { id:'e2', name:'Projector + screen', ar:'جهاز عرض وشاشة', qty:2, out:1, cond:'good' },
  { id:'e3', name:'Folding chairs', ar:'كراسي قابلة للطي', qty:200, out:60, cond:'fair' },
  { id:'e4', name:'Trestle tables', ar:'طاولات', qty:24, out:8, cond:'good' },
  { id:'e5', name:'Portable PA', ar:'نظام صوت متنقل', qty:1, out:0, cond:'needs service' }
];

export const RESERVATIONS = [
  { id:'r1', ref:'RES-2026-214', venue:'v3', by:'p3', group:'g1', title:'Choir rehearsal — Christmas', titleAr:'تمرين الجوقة — الميلاد', date:'2026-10-09', from:'19:00', to:'21:30', status:'pending', stage:'secretary', setup:30 },
  { id:'r2', ref:'RES-2026-215', venue:'v7', by:'p9', group:'g3', title:'Youth barbecue', titleAr:'حفلة شواء للشبيبة', date:'2026-10-11', from:'17:00', to:'22:00', status:'pending', stage:'priest', setup:60 },
  { id:'r3', ref:'RES-2026-212', venue:'v4', by:'p14', group:'g4', title:'Legion of Mary meeting', titleAr:'اجتماع فيلق مريم', date:'2026-10-06', from:'16:30', to:'18:00', status:'approved', stage:'done', setup:0 },
  { id:'r4', ref:'RES-2026-210', venue:'v3', by:'p8', group:'g8', title:'Parish lunch', titleAr:'غداء الرعية', date:'2026-10-18', from:'12:00', to:'16:00', status:'approved', stage:'done', setup:90 },
  { id:'r5', ref:'RES-2026-216', venue:'v7', by:'p5', group:null, title:'External renter — family baptism reception', titleAr:'إيجار خارجي — حفل معمودية', date:'2026-10-11', from:'18:00', to:'23:00', status:'pending', stage:'secretary', setup:60 },
  { id:'r6', ref:'RES-2026-208', venue:'v5', by:'p11', group:'g2', title:'Catechism G4 — weekly', titleAr:'تعليم مسيحي ٤ — أسبوعي', date:'2026-10-04', from:'09:15', to:'10:15', status:'approved', stage:'done', setup:0 },
  { id:'r7', ref:'RES-2026-217', venue:'v8', by:'p16', group:'g3', title:'Youth football', titleAr:'كرة قدم للشبيبة', date:'2026-10-13', from:'17:30', to:'19:30', status:'rejected', stage:'done', setup:0 }
];

/* Two requests clash when they want the same room on the same day and their times overlap,
   counting each one's set-up buffer. A pending request that clashes shows as a conflict. */
const mins = hm => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };
export const resClash = r => r.status === 'rejected' ? null : RESERVATIONS.find(o => o !== r && o.status !== 'rejected'
  && o.venue === r.venue && o.date === r.date
  && mins(o.from) - (o.setup || 0) < mins(r.to) && mins(r.from) - (r.setup || 0) < mins(o.to));
export const resStatus = r => r.status === 'pending' && resClash(r) ? 'conflict' : r.status;

/* ---------- events & the liturgical calendar ---------- */
export const EVENTS = [
  { id:'ev1', d:'2026-10-04', t:'08:00', title:'Mass — Arabic', titleAr:'قدّاس — عربي', kind:'mass', venue:'v1' },
  { id:'ev2', d:'2026-10-04', t:'10:30', title:'Mass — Arabic & Syriac', titleAr:'قدّاس — عربي وسرياني', kind:'mass', venue:'v1' },
  { id:'ev3', d:'2026-10-04', t:'18:00', title:'Mass — English', titleAr:'قدّاس — إنكليزي', kind:'mass', venue:'v2' },
  { id:'ev4', d:'2026-10-04', t:'09:15', title:'Catechism G4', titleAr:'تعليم مسيحي ٤', kind:'group', venue:'v5' },
  { id:'ev5', d:'2026-10-06', t:'16:30', title:'Legion of Mary', titleAr:'فيلق مريم', kind:'group', venue:'v4' },
  { id:'ev6', d:'2026-10-09', t:'19:00', title:'Choir rehearsal', titleAr:'تمرين الجوقة', kind:'pending', venue:'v3' },
  { id:'ev7', d:'2026-10-11', t:'10:30', title:'Baptism — Matar', titleAr:'معمودية — مطر', kind:'sacr', venue:'v1' },
  { id:'ev8', d:'2026-10-11', t:'17:00', title:'Youth barbecue', titleAr:'حفلة شواء للشبيبة', kind:'pending', venue:'v7' },
  { id:'ev9', d:'2026-10-14', t:'19:00', title:'Parish council', titleAr:'المجلس الرعوي', kind:'group', venue:'v4' },
  { id:'ev10', d:'2026-10-18', t:'12:00', title:'Parish lunch', titleAr:'غداء الرعية', kind:'event', venue:'v3' },
  { id:'ev11', d:'2026-10-24', t:'16:00', title:'Wedding — Bou Khalil & Kassab', titleAr:'إكليل — بو خليل وقصاب', kind:'sacr', venue:'v1' },
  { id:'ev12', d:'2026-10-25', t:'10:30', title:'First Communion', titleAr:'المناولة الأولى', kind:'sacr', venue:'v1' },
  { id:'ev13', d:'2026-10-31', t:'18:00', title:'Youth vigil', titleAr:'سهرة الشبيبة', kind:'event', venue:'v2' }
];

/* Maronite feast days that carry a gold dot on the calendar */
export const FEASTS = {
  '2026-10-02':['Guardian Angels','الملائكة الحرّاس'],
  '2026-10-07':['Our Lady of the Rosary','سيدة الورديّة'],
  '2026-10-18':['Saint Luke','مار لوقا'],
  '2026-10-28':['Saints Simon & Jude','مار سمعان ومار يهوذا']
};

/* ---------- liturgical service plan ---------- */
export const SERVICE = {
  id:'s1', title:'Sunday Mass 10:30', titleAr:'قدّاس الأحد ١٠:٣٠',
  date:'2026-10-04', venue:'v1', celebrant:'p17', coordinator:'p4',
  language:'Arabic & Syriac', languageAr:'عربي وسرياني', status:'ready',
  order:[
    { dur:'5', t:'Entrance hymn — Qadishat Aloho', ar:'نشيد الدخول — قاديشات آلوهو', note:'Choir, organ only', noteAr:'الجوقة، أرغن فقط', who:'g1' },
    { dur:'3', t:'Opening prayer', ar:'صلاة الافتتاح', note:'', who:'p17' },
    { dur:'4', t:'First reading — Romans 12:1–8', ar:'القراءة الأولى — روما ١٢: ١–٨', note:'Lector: Carla Abou Jaoude', noteAr:'القارئ: كارلا أبو جودة', who:'p6' },
    { dur:'6', t:'Gospel — Luke 8:4–15', ar:'الإنجيل — لوقا ٨: ٤–١٥', note:'', who:'p17' },
    { dur:'10', t:'Homily', ar:'العظة', note:'Recording requested by the eparchy', noteAr:'الأبرشية طلبت تسجيلاً', who:'p17' },
    { dur:'4', t:'Offertory — Ya Oummal Ilah', ar:'التقدمة — يا أمّ الإله', note:'Key: D minor', noteAr:'المقام: ري صغير', who:'g1' },
    { dur:'12', t:'Anaphora', ar:'النافور', note:'', who:'p17' },
    { dur:'8', t:'Communion', ar:'المناولة', note:'4 distributors, two aisles', noteAr:'٤ موزّعين، ممرّان', who:'g5' },
    { dur:'3', t:'Announcements', ar:'الإعلانات', note:'Parish lunch 18 Oct · counting session after', noteAr:'غداء الرعية ١٨ ت١ · جلسة العدّ بعده', who:'p4' },
    { dur:'3', t:'Final blessing & recessional', ar:'البركة الختامية والخروج', note:'', who:'p17' }
  ]
};

/* ---------- sacramental records ---------- */
export const SACRAMENTS = [
  { id:'sc1', kind:'baptism', kindAr:'معمودية', reg:'B/2026/041', person:'p20', date:'2026-10-11', celebrant:'p18', status:'scheduled', godparents:'Roy Bou Khalil · Zeina Kassab' },
  { id:'sc2', kind:'baptism', kindAr:'معمودية', reg:'B/2026/040', person:'p19', date:'2016-06-12', celebrant:'p17', status:'registered', godparents:'Tony Gemayel · Pauline Chidiac' },
  { id:'sc3', kind:'marriage', kindAr:'إكليل', reg:'M/2026/012', person:'p12', date:'2026-10-24', celebrant:'p17', status:'awaiting-signature', godparents:'Witnesses: Charbel Matar · Nada Haddad' },
  { id:'sc4', kind:'communion', kindAr:'مناولة أولى', reg:'C/2026/118', person:'p19', date:'2026-10-25', celebrant:'p17', status:'awaiting-signature', godparents:'' },
  { id:'sc5', kind:'confirmation', kindAr:'ميرون', reg:'K/2026/077', person:'p9', date:'2015-05-17', celebrant:'p17', status:'registered', godparents:'Joseph Sfeir' },
  { id:'sc6', kind:'certificate', kindAr:'طلب شهادة', reg:'REQ-2026-338', person:'p1', date:'2026-10-02', celebrant:'p17', status:'awaiting-signature', godparents:'Baptism extract for a civil file' },
  { id:'sc7', kind:'funeral', kindAr:'جنّاز', reg:'F/2026/019', person:'p13', date:'2026-09-28', celebrant:'p18', status:'registered', godparents:'' }
];

/* wedding anniversaries the system tracks and reminds on */
export const ANNIVERSARIES = [
  { couple:'Georges & Nada Haddad', ar:'جورج وندى حدّاد', years:25, on:'2026-10-19' },
  { couple:'Joseph & the late Thérèse Sfeir', ar:'جوزيف وتريز صفير', years:50, on:'2026-10-27' },
  { couple:'Tony & Carla Gemayel', ar:'طوني وكارلا الجميّل', years:10, on:'2026-11-03' }
];

/* ---------- volunteers & rota ---------- */
export const ROTA = {
  date:'2026-10-04', service:'Mass 10:30', serviceAr:'قدّاس ١٠:٣٠',
  teams:[
    { team:'Lectors', teamAr:'القرّاء', one:'a reader', oneAr:'قارئاً', need:2, filled:[{p:'p6',s:'accepted',swap:'p16'},{p:'p8',s:'accepted'}] },
    { team:'Altar servers', teamAr:'خدّام المذبح', one:'a server', oneAr:'خادماً', need:4, filled:[{p:'p9',s:'accepted'},{p:'p16',s:'accepted'},{p:'p12',s:'declined'},{p:null,s:'open'}] },
    { team:'Ushers', teamAr:'المُرشدون', one:'an usher', oneAr:'مُرشداً', need:3, filled:[{p:'p5',s:'accepted'},{p:'p7',s:'pending'},{p:null,s:'open'}] },
    { team:'Sound & presentation', teamAr:'الصوت والعرض', one:'a technician', oneAr:'تقنيّاً', need:1, filled:[{p:'p12',s:'accepted'}] },
    { team:'Hospitality', teamAr:'الضيافة', one:'a host', oneAr:'مضيفاً', need:2, filled:[{p:'p2',s:'accepted'},{p:'p14',s:'pending',swap:'p13'}] },
    { team:'Choir', teamAr:'الجوقة', one:'a singer', oneAr:'مرنّماً', need:3, leader:'p3', filled:[{p:'p3',s:'accepted'},{p:'p12',s:'accepted'},{p:null,s:'open'}] }
  ]
};

/* ---------- registration & check-in ---------- */
export const CHECKIN = {
  session:'Catechism — Sunday 09:15', sessionAr:'التعليم المسيحي — الأحد ٠٩:١٥',
  room:'v5', present:26, expected:28, awaitingGuardian:2,
  rows:[
    { p:'p19', in:'09:07', out:null, guardian:'Nada Haddad', code:'4471', alert:'' },
    { p:'p20', in:'09:09', out:null, guardian:'Nada Haddad', code:'4471', alert:'Peanut allergy' }
  ]
};

export const REGISTRATIONS = [
  { id:'rg1', event:'Youth retreat — Annaya', eventAr:'خلوة الشبيبة — عنّايا', open:true, cap:40, taken:33, fee:35, deadline:'2026-10-20', waiting:4 },
  { id:'rg2', event:'Parish lunch', eventAr:'غداء الرعية', open:true, cap:180, taken:141, fee:15, deadline:'2026-10-16', waiting:0 },
  { id:'rg3', event:'Christmas concert', eventAr:'حفل الميلاد', open:false, cap:420, taken:0, fee:0, deadline:'2026-12-10', waiting:0 },
  { id:'rg4', event:'Catechism year 2026–27', eventAr:'سنة التعليم ٢٠٢٦–٢٧', open:true, cap:220, taken:198, fee:0, deadline:'2026-10-31', waiting:0 }
];

/* ---------- giving & finance ---------- */
export const BATCH = {
  id:'cs214', ref:'Counting session 214', refAr:'جلسة العدّ ٢١٤',
  date:'2026-10-04', status:'open', counters:['p15','p7'],
  lines:[
    { env:'0142', p:'p1', usd:50, fund:'general' },
    { env:'0088', p:'p4', usd:120, fund:'general' },
    { env:'0031', p:'p7', usd:200, fund:'building' },
    { env:'0205', p:'p13', usd:75, fund:'general' },
    { env:'0177', p:'p9', usd:25, fund:'youth' },
    { env:null, p:null, usd:1080, fund:'general', note:'Loose cash — unattributed', noteAr:'نقداً — غير مسمّى' },
    { env:null, p:null, lbp:4500000, fund:'general', note:'Loose cash — lira', noteAr:'نقداً بالليرة — غير مسمّى' }
  ]
};

export const FUNDS = [
  { id:'general', name:'General fund', ar:'الصندوق العام', budget:64000, actual:51280, restricted:false },
  { id:'building', name:'Church restoration', ar:'ترميم الكنيسة', budget:120000, actual:38400, restricted:true },
  { id:'youth', name:'Youth & catechism', ar:'الشبيبة والتعليم', budget:18000, actual:14900, restricted:true },
  { id:'charity', name:'Parish charity', ar:'إحسان الرعية', budget:26000, actual:22150, restricted:true }
];

export const EXPENSES = [
  { id:'x1', d:'2026-10-02', what:'Diesel — generator, 200L', whatAr:'مازوت — مولّد، ٢٠٠ ل', fund:'general', usd:180, status:'approved', by:'p15' },
  { id:'x2', d:'2026-10-01', what:'Stonemason — north wall deposit', whatAr:'حجّار — عربون الجدار الشمالي', fund:'building', usd:2400, status:'awaiting-approval', by:'p15' },
  { id:'x3', d:'2026-09-29', what:'Catechism books (40)', whatAr:'كتب التعليم (٤٠)', fund:'youth', usd:320, status:'approved', by:'p11' },
  { id:'x4', d:'2026-09-27', what:'Food parcels — 12 families', whatAr:'حصص غذائية — ١٢ عائلة', fund:'charity', usd:540, status:'approved', by:'p14' },
  { id:'x5', d:'2026-09-25', what:'Electrician — hall lighting', whatAr:'كهربائي — إنارة القاعة', fund:'general', usd:95, status:'rejected', by:'p8' }
];

export const PLEDGES = [
  { id:'pl1', p:'p1', pledged:1200, paid:900, fund:'building' },
  { id:'pl2', p:'p7', pledged:2400, paid:2400, fund:'building' },
  { id:'pl3', p:'p13', pledged:600, paid:150, fund:'building' },
  { id:'pl4', p:'p5', pledged:900, paid:450, fund:'general' }
];

/* ---------- music library ---------- */
export const MUSIC = [
  { id:'m1', title:'Qadishat Aloho', ar:'قاديشات آلوهو', occasion:'Trisagion', occasionAr:'التقديسات', part:'Entrance', key:'D minor', lang:'Syriac', sheet:true, audio:true },
  { id:'m2', title:'Ya Oummal Ilah', ar:'يا أمّ الإله', occasion:'Marian', occasionAr:'مريمي', part:'Offertory', key:'A minor', lang:'Arabic', sheet:true, audio:true },
  { id:'m3', title:'Wa Habibi', ar:'وا حبيبي', occasion:'Good Friday', occasionAr:'الجمعة العظيمة', part:'Veneration', key:'E minor', lang:'Arabic', sheet:true, audio:false },
  { id:'m4', title:'Lakal Majd', ar:'لك المجد', occasion:'Ordinary', occasionAr:'زمن عادي', part:'Communion', key:'G major', lang:'Arabic', sheet:true, audio:true },
  { id:'m5', title:'Ya Mar Elias', ar:'يا مار الياس', occasion:'Patron feast', occasionAr:'عيد الشفيع', part:'Recessional', key:'F major', lang:'Arabic', sheet:false, audio:true },
  { id:'m6', title:'Salamun Laki', ar:'سلامٌ لكِ', occasion:'Marian', occasionAr:'مريمي', part:'Entrance', key:'C major', lang:'Arabic', sheet:true, audio:true },
  { id:'m7', title:'Ave Maria (Arcadelt)', ar:'السلام عليك يا مريم', occasion:'Wedding', occasionAr:'إكليل', part:'Communion', key:'F major', lang:'Latin', sheet:true, audio:false },
  { id:'m8', title:'Bshoubho', ar:'بشوبحو', occasion:'Nativity', occasionAr:'الميلاد', part:'Entrance', key:'D major', lang:'Syriac', sheet:true, audio:true }
];

/* ---------- communication ---------- */
export const MESSAGES = [
  { id:'mg1', subject:'Parish lunch — 18 October', subjectAr:'غداء الرعية — ١٨ تشرين الأول', audience:'All households', audienceAr:'كل العائلات', channel:'whatsapp', status:'scheduled', when:'2026-10-12 15:00', reach:412 },
  { id:'mg2', subject:'Choir rehearsal moved to Friday', subjectAr:'تمرين الجوقة انتقل إلى الجمعة', audience:'Saint Elias Choir', audienceAr:'جوقة مار الياس', channel:'whatsapp', status:'sent', when:'2026-10-02 18:30', reach:24 },
  { id:'mg3', subject:'Certificate ready for collection', subjectAr:'الشهادة جاهزة للاستلام', audience:'Georges Haddad', audienceAr:'جورج حدّاد', channel:'sms', status:'failed', when:'2026-10-03 11:05', reach:1 },
  { id:'mg4', subject:'Catechism starts Sunday 09:15', subjectAr:'التعليم المسيحي يبدأ الأحد ٠٩:١٥', audience:'Catechism parents', audienceAr:'أهالي التعليم المسيحي', channel:'whatsapp', status:'sent', when:'2026-09-28 09:00', reach:198 },
  { id:'mg5', subject:'Rota: you are serving on 11 October', subjectAr:'المناوبة: خدمتك في ١١ تشرين الأول', audience:'Ushers & lectors', audienceAr:'المُرشدون والقرّاء', channel:'whatsapp', status:'draft', when:'—', reach:14 }
];

export const TEMPLATES = [
  { id:'tp1', name:'Christmas Mass', ar:'قدّاس الميلاد' },
  { id:'tp2', name:'Youth meeting', ar:'لقاء الشبيبة' },
  { id:'tp3', name:'Fundraiser', ar:'حملة تبرّع' },
  { id:'tp4', name:'Funeral notice', ar:'نعوة' },
  { id:'tp5', name:'Feast of the patron', ar:'عيد الشفيع' }
];

/* ---------- forms & workflows ---------- */
export const WORKFLOWS = [
  { id:'w1', name:'Certificate request', ar:'طلب شهادة', open:6, avg:'2 days', avgAr:'يومان', steps:['Request','Identity check','Register lookup','Staff review','Signature','Issued'], stepsAr:['الطلب','التحقّق من الهوية','مراجعة السجل','مراجعة الموظّف','التوقيع','التسليم'] },
  { id:'w2', name:'Room reservation', ar:'حجز قاعة', open:3, avg:'1 day', avgAr:'يوم واحد', steps:['Request','Conflict check','Secretary review','Priest approval','Checklist','Closed'], stepsAr:['الطلب','فحص التعارض','مراجعة أمانة السرّ','موافقة الكاهن','لائحة التحقّق','الإقفال'] },
  { id:'w3', name:'New member welcome', ar:'ترحيب بعضو جديد', open:4, avg:'5 days', avgAr:'٥ أيام', steps:['Form','Duplicate review','Household record','Welcome message','Follow-up'], stepsAr:['الاستمارة','مراجعة التكرار','سجل العائلة','رسالة ترحيب','المتابعة'] },
  { id:'w4', name:'Expense approval', ar:'موافقة على مصروف', open:1, avg:'3 days', avgAr:'٣ أيام', steps:['Submitted','Treasurer','Priest','Paid'], stepsAr:['التقديم','أمين الصندوق','الكاهن','الدفع'] },
  { id:'w5', name:'Baptism preparation', ar:'تحضير معمودية', open:2, avg:'3 weeks', avgAr:'٣ أسابيع', steps:['Request','Documents','Preparation session','Date set','Celebrated','Registered'], stepsAr:['الطلب','المستندات','لقاء التحضير','تحديد الموعد','الاحتفال','التسجيل'] }
];

/* ---------- audit ---------- */
export const AUDIT = [
  { at:'2026-10-04 19:12', who:'p17', what:'Approved reservation RES-2026-212', whatAr:'وافق على الحجز RES-2026-212', kind:'approve' },
  { at:'2026-10-04 18:40', who:'p15', what:'Opened counting session 214', whatAr:'فتح جلسة العدّ ٢١٤', kind:'create' },
  { at:'2026-10-04 17:55', who:'p4', what:'Published notice “Parish lunch”', whatAr:'نشر إعلان «غداء الرعية»', kind:'publish' },
  { at:'2026-10-04 16:20', who:'p17', what:'Set exchange rate to 89,500', whatAr:'ضبط سعر الصرف على 89,500', kind:'settings' },
  { at:'2026-10-03 11:06', who:'p4', what:'Message to Georges Haddad failed (SMS)', whatAr:'فشل إرسال رسالة إلى جورج حدّاد (SMS)', kind:'error' },
  { at:'2026-10-03 09:31', who:'p11', what:'Viewed restricted medical alert — Karim Matar', whatAr:'اطّلع على تنبيه طبي مقيّد — كريم مطر', kind:'sensitive' }
];

export const NOTICES = [
  { id:'n1', title:'Parish lunch — Sunday 18 October', ar:'غداء الرعية — الأحد ١٨ تشرين الأول', pri:'normal', by:'p4', at:'2026-10-04', audience:'Parish', audienceAr:'الرعية' },
  { id:'n2', title:'Generator hours change from Monday', ar:'تغيير ساعات المولّد اعتباراً من الإثنين', pri:'urgent', by:'p15', at:'2026-10-03', audience:'Parish', audienceAr:'الرعية' },
  { id:'n3', title:'Catechism registration closes 31 October', ar:'تسجيل التعليم المسيحي يقفل في ٣١ تشرين الأول', pri:'normal', by:'p11', at:'2026-10-01', audience:'Parents', audienceAr:'الأهالي' }
];

/* ---------- lookups ---------- */
export const byId = (arr, id) => arr.find(x => x.id === id);
export const person = id => PEOPLE.find(p => p.id === id) || ARCHIVED.find(p => p.id === id);
export const venue = id => VENUES.find(v => v.id === id);
export const group = id => GROUPS.find(g => g.id === id);
export const initials = p => !p ? '·' : p.lat.split(/[\s-]+/).filter(Boolean).slice(-2).map(s => s[0]).join('').toUpperCase();

/* ============================================================
   Everything the roadmap asks for beyond the first pass.
   ============================================================ */

/* ---------- 1 · archdiocese & parishes ---------- */
export const PARISHES = [
  { id:'p-elias', name:'Saint Elias', ar:'مار الياس', town:'Hadath', townAr:'الحدث', role:'Parish priest', roleAr:'كاهن الرعية', people:1380, households:412 },
  { id:'p-sauveur', name:'Saint Sauveur', ar:'المخلّص', town:'Hazmieh', townAr:'الحازمية', role:'Assisting', roleAr:'مساعد', people:860, households:255 },
  { id:'p-charbel', name:'Saint Charbel', ar:'مار شربل', town:'Louaizeh', townAr:'اللويزة', role:'Read only', roleAr:'اطّلاع فقط', people:2140, households:611 }
];

export const EPARCHY_NEWS = [
  { title:'Eparchial youth day — 8 November', ar:'يوم الشبيبة الأبرشي — ٨ تشرين الثاني', at:'2026-10-03', shared:true },
  { title:'New certificate template approved', ar:'اعتماد قالب شهادة جديد', at:'2026-09-30', shared:true },
  { title:'Clergy retreat, Annaya, 2–4 December', ar:'رياضة روحية للإكليروس، عنّايا، ٢–٤ كانون الأول', at:'2026-09-21', shared:false }
];

export const TRANSFERS = [
  { id:'tr1', p:'p10', from:'Saint Charbel, Louaizeh', fromAr:'مار شربل، اللويزة', to:'Saint Elias, Hadath', toAr:'مار الياس، الحدث', effective:'2026-10-15', status:'awaiting-approval' },
  { id:'tr2', p:'p6', from:'Saint Elias, Hadath', fromAr:'مار الياس، الحدث', to:'Saint Sauveur, Hazmieh', toAr:'المخلّص، الحازمية', effective:'2026-09-01', status:'approved' }
];

/* ---------- 2 · people extras ---------- */
export const PERSON_EXTRA = {
  p1: { preferred:'Georges', lang:'ar', channel:'whatsapp', blood:'O+', skills:['Accounting','Driving'],
        dates:[['Baptism','معمودية','1968-04-20'],['Marriage','إكليل','2001-10-19']],
        consent:[['Parish announcements on WhatsApp','إعلانات الرعية على واتساب',true],
                 ['Printed parish directory','الدليل المطبوع',true],['Photos in parish media','الصور في وسائل الرعية',false]],
        directory:true, fields:[['Council seat','مقعد المجلس','Finance']] }
};

export const DUPLICATES = [
  { a:{ lat:'Georges Haddad', ar:'جورج حدّاد', town:'Hadath', env:'0142', born:'1968-03-14' },
    b:{ lat:'Georges Hadad',  ar:'جورج حداد',  town:'Hadath', env:'—',    born:'1968-03-14' },
    score:94 },
  { a:{ lat:'Marie-Thérèse Saliba', ar:'ماري تريز صليبا', town:'Furn el Chebbak', env:'—', born:'1975-07-28' },
    b:{ lat:'Therese Saliba', ar:'تريز صليبا', town:'Furn el Chebbak', env:'0311', born:'1975-07-28' },
    score:81 }
];

export const IMPORT_PREVIEW = {
  total: 412, ok: 388, warn: 19, err: 5,
  cols: [['Arabic name','الاسم العربي','ok'],['Latin name','الاسم اللاتيني','ok'],['Phone','الهاتف','warn'],
         ['Town','البلدة','ok'],['Rite','الطقس','ok'],['Postal code','الرمز البريدي','skip']],
  issues: [['Row 41','الصف ٤١','Phone has 6 digits after +961','الهاتف ٦ أرقام بعد 961+'],
           ['Row 88','الصف ٨٨','Rite “Maronit” not recognised','الطقس «Maronit» غير معروف'],
           ['Row 210','الصف ٢١٠','Looks like an existing record (Haddad, Hadath)','يشبه سجلاً قائماً (حدّاد، الحدث)']]
};

/* ---------- 3 · group detail ---------- */
export const GROUP_DETAIL = {
  g1: {
    assistant:'p12',
    roles:[['p3','Leader','مسؤولة'],['p12','Assistant & sound','مساعد وصوت'],['p6','Section lead — soprano','مسؤولة قسم — سوبرانو']],
    requests:[{ p:'p10', at:'2026-10-02' },{ p:'p8', at:'2026-09-29' }],
    meetings:[{ d:'2026-10-09', t:'19:00', rsvp:{ yes:18, no:3, none:3 }, done:false },
              { d:'2026-10-02', t:'19:00', present:21, absent:[['p12','Work travel','سفر عمل']], done:true },
              { d:'2026-09-25', t:'19:00', present:19, absent:[['p6','Illness','مرض']], done:true }],
    posts:[{ by:'p3', at:'2026-10-03', body:'Christmas programme is fixed. Two extra rehearsals in December.', bodyAr:'تحدّد برنامج الميلاد. تمرينان إضافيان في كانون الأول.' }],
    files:[['Christmas 2026 programme.pdf','برنامج الميلاد ٢٠٢٦.pdf','240 KB'],
           ['Qadishat Aloho — SATB.pdf','قاديشات آلوهو — SATB.pdf','180 KB']],
    belongings:[['Choir folders','ملفات الجوقة',30,'Sacristy cupboard','خزانة السكرستية'],
                ['Keyboard stand','حامل الأورغ',1,'Upper church','الكنيسة العليا'],
                ['Robes (adult)','أثواب (كبار)',24,'Hall store','مستودع القاعة']],
    tasks:[{ what:'Order two new robes', whatAr:'طلب ثوبين جديدين', who:'p12', due:'2026-10-20', done:false },
           { what:'Confirm organist for Christmas', whatAr:'تثبيت عازف الأرغن للميلاد', who:'p3', due:'2026-11-01', done:false },
           { what:'Collect September attendance', whatAr:'جمع حضور أيلول', who:'p3', due:'2026-10-05', done:true }],
    milestones:[['Liturgical singing — level 1','الترتيل الليتورجي — المستوى ١',14],
                ['Safeguarding briefing','إحاطة الحماية',22],
                ['Syriac pronunciation','لفظ السريانية',8]],
    history:[['Maya Haddad took over from Roy Bou Khalil','تسلّمت مايا حدّاد من روي بو خليل','2025-09-01'],
             ['Group moved from Friday 18:00 to 19:00','نُقلت المجموعة من الجمعة ١٨:٠٠ إلى ١٩:٠٠','2026-02-14']],
    budget:{ fund:'youth', allocated:2400, spent:1810 }
  }
};

/** A group's working detail; a group created in the app starts with an empty one rather than borrowing another's. */
export const groupInfo = id => GROUP_DETAIL[id] || (GROUP_DETAIL[id] = { assistant: null, roles: [], requests: [], meetings: [], posts: [], files: [],
  belongings: [], tasks: [], milestones: [], history: [], roster: [], budget: { fund: 'general', allocated: 0, spent: 0 } });

/* ---------- 4 · events ---------- */
export const EVENT_DETAIL = {
  ev10: {
    organizer:'p8', tz:'Asia/Beirut', cat:'Parish life', catAr:'حياة الرعية',
    tags:['lunch','fundraiser'], desc:'Parish lunch in the hall after the 10:30 Mass, in aid of the church restoration.',
    descAr:'غداء الرعية في القاعة بعد قدّاس ١٠:٣٠، لمصلحة ترميم الكنيسة.',
    bring:[['Trestle tables (8)','طاولات (٨)'],['Serving trays','صواني تقديم'],['Cash box','صندوق نقد']],
    tasks:[['Confirm caterer','تثبيت المتعهّد','p8','2026-10-10'],['Print tickets','طباعة البطاقات','p4','2026-10-12']],
    files:[['Seating plan.pdf','مخطط الجلوس.pdf']],
    rsvp:{ yes:141, no:22, maybe:14, none:235 }, cap:180, waiting:0,
    visibility:'public', repeat:'none', invited:['p1','p2','p5','p7']
  }
};

/** An event's working detail; one created in the app gets its own, empty, instead of borrowing the parish lunch's. */
export const eventInfo = e => EVENT_DETAIL[e.id] || (EVENT_DETAIL[e.id] = {
  organizer: e.kind === 'mass' || e.kind === 'sacr' ? 'p17' : 'p4', tz: 'Asia/Beirut',
  cat: { mass: 'Worship', group: 'Formation', sacr: 'Sacraments' }[e.kind] || 'Parish life',
  catAr: { mass: 'العبادة', group: 'التنشئة', sacr: 'الأسرار' }[e.kind] || 'حياة الرعية',
  tags: [], desc: '', descAr: '', bring: [], tasks: [], rsvp: { yes: 0, no: 0, maybe: 0, none: 0 }, cap: 0, waiting: 0 });

export const EVENT_TEMPLATES = [
  ['Sunday Mass','قدّاس الأحد','service'],['Baptism','معمودية','sacr'],['Wedding','إكليل','sacr'],
  ['Funeral','جنّاز','sacr'],['Prayer meeting','لقاء صلاة','groups'],['Retreat','خلوة','events'],
  ['Feast celebration','احتفال عيد','events']
];

/* ---------- 5 · facilities extras ---------- */
export const MAINTENANCE = [
  { venue:'v2', from:'2026-10-20', to:'2026-10-24', why:'Damp treatment on the north wall', whyAr:'معالجة الرطوبة في الجدار الشمالي', by:'p15' }
];
export const ISSUES = [
  { id:'is1', venue:'v3', what:'Two ceiling lights out', whatAr:'مصباحان في السقف معطّلان', by:'p8', at:'2026-10-02', status:'awaiting-approval' },
  { id:'is2', venue:'v6', what:'Gas bottle almost empty', whatAr:'قارورة الغاز شبه فارغة', by:'p14', at:'2026-10-03', status:'approved' }
];
export const RENTALS = [
  { id:'rn1', who:'Gemayel family', whoAr:'عائلة الجميّل', venue:'v3', date:'2026-10-11', deposit:200, charge:450, paid:200, status:'pending' }
];

/* ---------- 6 · service requests & templates ---------- */
export const SERVICE_REQUESTS = [
  { id:'sr1', kind:'Wedding', kindAr:'إكليل', by:'p12', date:'2026-10-24', prep:'complete', status:'approved' },
  { id:'sr2', kind:'Baptism', kindAr:'معمودية', by:'p9', date:'2026-10-11', prep:'documents missing', prepAr:'مستندات ناقصة', status:'pending' },
  { id:'sr3', kind:'Funeral', kindAr:'جنّاز', by:'p13', date:'2026-09-28', prep:'complete', status:'approved' },
  { id:'sr4', kind:'Retreat', kindAr:'خلوة', by:'p9', date:'2026-11-06', prep:'awaiting venue', prepAr:'بانتظار القاعة', status:'pending' }
];
export const SERVICE_TEMPLATES = [
  ['Sunday Mass — Arabic','قدّاس الأحد — عربي',10],['Sunday Mass — bilingual','قدّاس الأحد — ثنائي اللغة',10],
  ['Wedding','إكليل',14],['Baptism','معمودية',8],['Funeral','جنّاز',9],['Feast of the patron','عيد الشفيع',12]
];

/* ---------- 7 · sacrament extras ---------- */
export const PREP_REQUIREMENTS = {
  baptism:[['Parents’ marriage certificate','إفادة زواج الوالدين',true],['Godparent baptism certificate','إفادة معمودية الإشبين',false],
           ['Preparation session attended','حضور لقاء التحضير',true]],
  marriage:[['Baptism certificates, both','إفادتا معمودية',true],['Freedom-to-marry declaration','إفادة عزوبية',true],
            ['Pre-marriage course','دورة ما قبل الزواج',true],['Civil file reference','رقم الملف المدني',false]]
};
export const CORRECTIONS = [
  { id:'co1', reg:'B/2019/112', field:'Mother’s name', fieldAr:'اسم الأم', from:'Nada Khoury', to:'Nada Haddad',
    by:'p4', at:'2026-09-14', status:'approved', approver:'p17' },
  { id:'co2', reg:'M/2024/031', field:'Register page', fieldAr:'صفحة السجل', from:'82', to:'84',
    by:'p4', at:'2026-10-03', status:'awaiting-approval', approver:'p17' }
];

/* ---------- 8 · volunteers ---------- */
export const VOLUNTEERS = [
  { p:'p16', skills:['Check-in','Driving'], skillsAr:['التسجيل','القيادة'], clearance:'valid', until:'2027-03-01',
    training:['Safeguarding 2026','First aid'], avail:['Sun AM','Sat PM'], hours:42, assignments:18 },
  { p:'p5',  skills:['Usher','Hospitality'], skillsAr:['إرشاد','ضيافة'], clearance:'valid', until:'2026-12-10',
    training:['Safeguarding 2026'], avail:['Sun AM'], hours:96, assignments:41 },
  { p:'p12', skills:['Sound','Projection'], skillsAr:['صوت','عرض'], clearance:'expiring', until:'2026-11-02',
    training:['Safeguarding 2025'], avail:['Sun AM','Fri PM'], hours:130, assignments:58 },
  { p:'p6',  skills:['Lector'], skillsAr:['قراءة'], clearance:'valid', until:'2027-01-20',
    training:['Safeguarding 2026','Lector formation'], avail:['Sun AM','Sun PM'], hours:37, assignments:16 },
  { p:'p11', skills:['Catechist'], skillsAr:['تعليم مسيحي'], clearance:'missing', until:null,
    training:[], avail:['Sun AM'], hours:88, assignments:33 },
  { p:'p14', skills:['Hospitality','Visiting'], skillsAr:['ضيافة','زيارات'], clearance:'valid', until:'2027-05-30',
    training:['Safeguarding 2026'], avail:['Tue PM','Sun AM'], hours:64, assignments:29 }
];
export const SIGNUP_SHEETS = [
  { id:'ss1', what:'Christmas novena readers', whatAr:'قرّاء تساعية الميلاد', slots:9, taken:5, deadline:'2026-11-20' },
  { id:'ss2', what:'Parish lunch serving team', whatAr:'فريق خدمة غداء الرعية', slots:12, taken:12, deadline:'2026-10-14' }
];

/* ---------- 9 · registration extras ---------- */
export const REG_FORM = {
  id:'rg1', title:'Youth retreat — Annaya', titleAr:'خلوة الشبيبة — عنّايا',
  fields:[
    ['Participant','المشترك','person',true,''],
    ['Date of birth','تاريخ الولادة','date',true,''],
    ['Guardian consent','موافقة وليّ الأمر','consent',true,'shown only when the participant is under 18','تظهر فقط إذا كان المشترك دون ١٨'],
    ['Dietary needs','احتياجات غذائية','text',false,'only what the kitchen needs to know','ما يلزم المطبخ فقط'],
    ['Medical alerts','تنبيهات طبية','restricted',false,'restricted — visible to the two leaders on the trip','مقيّد — للمسؤولَين في الرحلة فقط'],
    ['Transport','النقل','choice',false,'Bus from the church (+$5) / own car','باص من الكنيسة (+٥$) / سيارة خاصة'],
    ['Room preference','تفضيل الغرفة','choice',false,'',''],
    ['Waiver signed','التنازل موقَّع','file',true,'','']
  ],
  fee:35, discounts:[['Second child in the same household','الولد الثاني في العائلة نفسها','-25%'],
                     ['Scholarship — at the priest’s discretion','منحة — بتقدير الكاهن','-100%']],
  installments:[['On registration','عند التسجيل',15],['By 10 November','قبل ١٠ تشرين الثاني',20]]
};
export const REGISTRANTS = [
  { p:'p9',  paid:35, status:'paid', consent:true, transport:'bus' },
  { p:'p16', paid:15, status:'pending', consent:true, transport:'own' },
  { p:'p19', paid:0,  status:'awaiting-approval', consent:false, transport:'bus' },
  { p:'p3',  paid:35, status:'paid', consent:true, transport:'own' }
];
export const REFUNDS = [
  { p:'p12', amount:35, why:'Cancelled — work', whyAr:'إلغاء — عمل', status:'approved', at:'2026-09-30' }
];

/* ---------- 10 · check-in extras ---------- */
export const PICKUP = {
  p19:{ approved:[['Nada Haddad','ندى حدّاد','guardian'],['Georges Haddad','جورج حدّاد','guardian'],
                  ['Maya Haddad','مايا حدّاد','sister']], restricted:[] },
  p20:{ approved:[['Nada Haddad','ندى حدّاد','guardian']],
        restricted:[['Recorded by the priest — do not release','مسجَّل من الكاهن — لا تُسلّم']] }
};
export const INCIDENTS = [
  { id:'in1', at:'2026-09-20 10:42', room:'v5', what:'Grazed knee in the courtyard, cleaned and guardian told', whatAr:'خدش في الركبة في الساحة، نُظّف وأُبلغ وليّ الأمر', by:'p16', restricted:true }
];
export const EVACUATION = { rooms:[['v5','Catechism Room A','صف التعليم أ',26],['v1','Upper Church','الكنيسة العليا',284],['v3','Parish Hall','قاعة الرعية',0]], muster:'Courtyard, by the gate', musterAr:'الساحة، عند البوابة' };

/* ---------- 11 · communication extras ---------- */
export const AUTOMATIONS = [
  { what:'Registration confirmation', whatAr:'تأكيد التسجيل', on:'on submit', onAr:'عند التقديم', active:true, sent:141 },
  { what:'Birthday greeting (consented only)', whatAr:'تهنئة عيد ميلاد (بموافقة فقط)', on:'07:00 daily', onAr:'٠٧:٠٠ يومياً', active:true, sent:38 },
  { what:'Rota reminder, 48h before', whatAr:'تذكير المناوبة قبل ٤٨ ساعة', on:'scheduled', onAr:'مجدول', active:true, sent:212 },
  { what:'Assignment changed', whatAr:'تغيّر الإسناد', on:'on change', onAr:'عند التغيير', active:true, sent:17 },
  { what:'Wedding anniversary', whatAr:'ذكرى الإكليل', on:'07:00 daily', onAr:'٠٧:٠٠ يومياً', active:false, sent:0 }
];

/* ---------- 12 · finance extras ---------- */
export const CAMPAIGNS = [
  { id:'ca1', name:'Church restoration', ar:'ترميم الكنيسة', goal:120000, raised:38400, donors:96, ends:'2027-06-30' },
  { id:'ca2', name:'Christmas appeal', ar:'حملة الميلاد', goal:15000, raised:2100, donors:31, ends:'2026-12-25' }
];
export const RECURRING = [
  { p:'p7', amount:200, every:'month', everyAr:'شهرياً', fund:'building', next:'2026-11-01', since:'2024-02-01' },
  { p:'p1', amount:50, every:'week', everyAr:'أسبوعياً', fund:'general', next:'2026-10-11', since:'2021-09-05' }
];
export const RECEIPTS = [
  { id:'rc1', no:'R-2026-0884', p:'p1', amount:50, at:'2026-10-04', sent:'whatsapp' },
  { id:'rc2', no:'R-2026-0883', p:'p4', amount:120, at:'2026-10-04', sent:'email' },
  { id:'rc3', no:'R-2026-0882', p:'p7', amount:200, at:'2026-10-04', sent:'none' }
];
export const BANKLINES = [
  { id:'bl1', at:'2026-10-02', ref:'TRF 884120', amount:2400, matched:null },
  { id:'bl2', at:'2026-10-01', ref:'CASH DEP 0991', amount:1550, matched:'cs213' },
  { id:'bl3', at:'2026-09-28', ref:'OMT 55219', amount:200, matched:null },
  { id:'bl4', at:'2026-09-27', ref:'FEE', amount:-12, matched:'fee' }
];

/* ---------- 13 · music extras ---------- */
export const MUSIC_DETAIL = {
  m1:{ composer:'Traditional Syriac', composerAr:'سرياني تقليدي', copyright:'Public domain', copyrightAr:'ملك عام',
       uses:['Print','Project','Record'], versions:[['v3 — SATB with organ','v3 — SATB مع أرغن','2026-09-02','p3'],
       ['v2 — unison','v2 — صوت واحد','2024-11-10','p12'],['v1 — original import','v1 — استيراد أصلي','2023-03-01','p3']],
       lyrics:[['ܩܰܕܺܝܫܰܬ ܐܰܠܳܗܳܐ','قاديشات آلوهو','Holy God'],['ܩܰܕܺܝܫܰܬ ܚܰܝܠܬܳܢܳܐ','قاديشات حَيلثونو','Holy Mighty'],
               ['ܩܰܕܺܝܫܰܬ ܠܳܐ ܡܳܝܽܘܬܳܐ','قاديشات لو مويوثو','Holy Immortal']],
       chords:'Dm      Gm     A7     Dm\nQa-di-shat  A-lo-ho, qa-di-shat\nDm      Gm     A7     Dm\nhayl-tho-no, qa-di-shat lo mo-yu-tho',
       notes:[['Organ','أرغن','Keep the pedal under the third phrase only','الدوّاسة تحت العبارة الثالثة فقط'],
              ['Oud','عود','Enters at the repeat','يدخل عند الإعادة']],
       annotations:[['p3','Sopranos breathe after “Aloho”, not before.','السوبرانو تتنفّس بعد «آلوهو» لا قبلها.']] }
};
/** A hymn's working detail; one added in the app starts empty rather than borrowing another hymn's words. */
export const musicInfo = m => MUSIC_DETAIL[m.id] || (MUSIC_DETAIL[m.id] = { composer: '', composerAr: '', copyright: 'Not recorded', copyrightAr: 'غير مسجَّل',
  uses: ['Project'], versions: [], lyrics: [], chords: '', notes: [], annotations: [] });

export const SETLISTS = [
  { id:'sl1', name:'Sunday 4 October — 10:30', ar:'الأحد ٤ تشرين الأول — ١٠:٣٠', items:['m1','m2','m4'], service:'s1' },
  { id:'sl2', name:'Christmas midnight', ar:'قدّاس منتصف ليل الميلاد', items:['m8','m6','m4'], service:null }
];

/* ---------- 14 · portal extras ---------- */
export const PRAYERS = [
  { id:'pr1', by:'p8', body:'For my mother, who is having surgery on Thursday.', bodyAr:'لأجل والدتي التي ستخضع لعملية الخميس.', vis:'moderated', status:'approved', at:'2026-10-02' },
  { id:'pr2', by:null, body:'For work, and for patience.', bodyAr:'لأجل العمل، ولأجل الصبر.', vis:'private', status:'private', at:'2026-10-03' },
  { id:'pr3', by:'p14', body:'In thanksgiving for the safe return of the Aoun family.', bodyAr:'شكراً لعودة عائلة عون بسلام.', vis:'moderated', status:'awaiting-approval', at:'2026-10-04' }
];

/* ---------- 15 · workflow runs ---------- */
export const RUNS = [
  { id:'r1', wf:'w1', subject:'p1', step:4, total:6, due:'2026-10-06', owner:'p17', status:'pending', overdue:false },
  { id:'r2', wf:'w1', subject:'p8', step:2, total:6, due:'2026-10-01', owner:'p4', status:'pending', overdue:true },
  { id:'r3', wf:'w3', subject:'p10', step:3, total:5, due:'2026-10-09', owner:'p4', status:'pending', overdue:false },
  { id:'r4', wf:'w5', subject:'p20', step:5, total:6, due:'2026-10-11', owner:'p18', status:'pending', overdue:false },
  { id:'r5', wf:'w4', subject:null, step:2, total:4, due:'2026-10-07', owner:'p15', status:'pending', overdue:false }
];
export const RUN_LOG = [
  ['2026-10-04 11:02','Step 3 completed — register looked up','اكتملت الخطوة ٣ — مراجعة السجل','ok'],
  ['2026-10-04 11:02','Scheduled message queued to the requester','رسالة مجدولة إلى مقدّم الطلب','ok'],
  ['2026-10-03 16:40','Retry 1 of 3 — WhatsApp gateway timeout','محاولة ١ من ٣ — انتهت مهلة بوابة واتساب','err'],
  ['2026-10-03 16:38','Step 2 completed — identity checked','اكتملت الخطوة ٢ — التحقق من الهوية','ok']
];

/* ---------- 16 · report data ---------- */
export const ATTENDANCE_SERIES = [268, 291, 254, 302, 288, 311, 276, 284];
export const GIVING_SERIES = [5200, 6100, 4800, 7300, 6900, 8420, 7100, 8100, 6400, 7700, 9100, 8420];
export const PAYMENT_MIX = [
  { label:'Cash', labelAr:'نقداً', v:54, color:'#415A77' },
  { label:'OMT / Whish', labelAr:'OMT / ويش', v:30, color:'#778D7A' },
  { label:'Card', labelAr:'بطاقة', v:13, color:'#D4C4A8' },
  { label:'Bank transfer', labelAr:'تحويل مصرفي', v:3, color:'#C3BCA2' }
];

/* ---------- 17 · security ---------- */
export const SESSIONS = [
  { device:'Parish office desktop — Chrome', deviceAr:'حاسوب المكتب — كروم', where:'Hadath', at:'now', current:true },
  { device:'iPhone — Safari', deviceAr:'آيفون — سفاري', where:'Hadath', at:'2026-10-03 18:20', current:false },
  { device:'Sacristy tablet — Chrome', deviceAr:'لوح السكرستية — كروم', where:'Hadath', at:'2026-09-28 09:05', current:false }
];
export const SECURITY_ALERTS = [
  { what:'Sign-in from a new device', whatAr:'تسجيل دخول من جهاز جديد', at:'2026-09-28 09:05', level:'info' },
  { what:'5 failed sign-in attempts on the secretary account', whatAr:'٥ محاولات دخول فاشلة على حساب أمانة السرّ', at:'2026-09-25 22:11', level:'warning' }
];
export const RETENTION = [
  ['Sacramental registers','سجلات الأسرار','Permanent','دائم'],
  ['Giving records','سجلات التقدمات','10 years','١٠ سنوات'],
  ['Safeguarding and incident reports','تقارير الحماية والحوادث','25 years, restricted','٢٥ سنة، مقيّد'],
  ['Attendance counts','عدّ الحضور','5 years','٥ سنوات'],
  ['Archived people records','سجلات المؤرشفين','Restorable for 30 days, then reviewed','قابلة للاسترجاع ٣٠ يوماً ثم تُراجَع'],
  ['Message delivery logs','سجلات إرسال الرسائل','18 months','١٨ شهراً']
];
export const WEBHOOKS = [
  { url:'https://eparchy.example/hooks/parishlife', events:['sacrament.registered','report.published'], scope:'read', active:true },
  { url:'https://sms.example/delivery', events:['message.failed'], scope:'read', active:false }
];
export const PERMISSIONS = [
  ['people.view','View people','عرض المؤمنين',['priest','secretary','treasurer']],
  ['people.edit','Edit people','تعديل المؤمنين',['priest','secretary']],
  ['notes.view','View pastoral notes','عرض الملاحظات الرعوية',['priest']],
  ['giving.view','View giving','عرض التقدمات',['priest','treasurer']],
  ['giving.close','Close a counting session','إقفال جلسة العدّ',['treasurer']],
  ['rate.edit','Change the exchange rate','تغيير سعر الصرف',['priest','treasurer']],
  ['sacrament.sign','Sign a certificate','توقيع شهادة',['priest']],
  ['reservation.approve','Approve a reservation','الموافقة على حجز',['priest']],
  ['reservation.review','Review a reservation','مراجعة حجز',['priest','secretary']],
  ['checkin.release','Release a child','تسليم طفل',['priest','secretary','volunteer']],
  ['audit.view','View the audit trail','عرض سجل التدقيق',['priest']]
];

/* ---------- mutable collections the flows write to ---------- */
/* What members submit through the portal waits here until the office accepts or declines it. */
export const PORTAL_REQUESTS = [
  { id:'pq1', kind:'address', hh:'h3', what:'Address change — Gemayel household', whatAr:'تغيير عنوان — عائلة الجميّل', at:'2026-10-03',
    now:'Main road, Hazmieh', nowAr:'الطريق العام، الحازمية', to:'Imm. Rizk, 4th floor, Hazmieh', toAr:'بناية رزق، الطابق الرابع، الحازمية' },
  { id:'pq2', kind:'family', what:'New family registration — Daou', whatAr:'تسجيل عائلة جديدة — ضو', at:'2026-10-02',
    now:'', nowAr:'', to:'Daou household, Ain el Remmaneh — 2 adults, 1 child', toAr:'عائلة ضو، عين الرمانة — راشدان وطفل', name:'Daou', nameAr:'ضو', town:'Ain el Remmaneh', townAr:'عين الرمانة' }
];

/* Photos people upload: a small square JPEG per person (and 'parish' for the seal), kept with the rest. */
export const PHOTOS = {};

/* The certificate request form, as the form builder edits it. */
export const FORM_FIELDS = [
  { id:'ff1', label:'Who is the certificate for', labelAr:'لمن الشهادة', type:'person', req:true, note:'', noteAr:'' },
  { id:'ff2', label:'Which sacrament', labelAr:'أي سرّ', type:'choice', req:true, note:'', noteAr:'' },
  { id:'ff3', label:'Reason for the request', labelAr:'سبب الطلب', type:'text', req:false, note:'civil file, school, marriage preparation', noteAr:'ملف مدني، مدرسة، تحضير زواج' },
  { id:'ff4', label:'Language of the certificate', labelAr:'لغة الشهادة', type:'choice', req:true, note:'Arabic, English or bilingual', noteAr:'عربي أو إنكليزي أو ثنائي' },
  { id:'ff5', label:'Proof of identity', labelAr:'إثبات الهوية', type:'file', req:true, note:'shown only when the requester is not the subject', noteAr:'تظهر فقط إذا لم يكن الطالب هو صاحب الشهادة' },
  { id:'ff6', label:'Collection method', labelAr:'طريقة الاستلام', type:'choice', req:false, note:'', noteAr:'' }
];
export const FORM_RULES = [
  { id:'fr1', show:'ff5', when:'ff1', op:'≠', value:'the person signed in', valueAr:'الشخص المسجَّل' }
];

/* Per-person permission exceptions: an explicit deny beats a role grant. */
export const EXCEPTIONS = [
  { id:'ex1', p:'p11', action:'checkin.release', effect:'+', reason:'Catechism lead releases children at the door', review:'2027-01-31' }
];

/* The notification feed in the top bar; read state is kept. */
export const NOTIFICATIONS = [
  ['sacr', ['3 certificate requests are waiting for your signature.', '٣ طلبات شهادات بانتظار توقيعك.'], ['20 minutes ago', 'قبل ٢٠ دقيقة'], '#/sacraments', true],
  ['warn', ['The exchange rate has not been updated for 6 days.', 'لم يُحدَّث سعر الصرف منذ ٦ أيام.'], ['Today, 08:14', 'اليوم ٠٨:١٤'], 'rate', true],
  ['give', ['Counting session 213 was closed by Rita Nassar.', 'أقفلت ريتا نصّار جلسة العدّ ٢١٣.'], ['Yesterday, 19:40', 'أمس ١٩:٤٠'], '#/giving', false],
  ['rooms', ['RES-2026-216 clashes with a booking in the same room.', 'RES-2026-216 يتعارض مع حجز في القاعة نفسها.'], ['Yesterday, 16:02', 'أمس ١٦:٠٢'], '#/reservations', false]
];

/* Switches people turn on and off (settings, consent, messaging rules), by key. */
export const PREFS = {};

export const NOTES = [
  { id:'nt1', p:'p7',  at:'12 Sep 2026', body:'Visited after the hospital stay. Asked for the Brotherhood to keep his stall.', bodyAr:'زيارة بعد الخروج من المستشفى. طلب إبقاء مقعده في الأخويّة.' },
  { id:'nt2', p:'p2',  at:'2 Sep 2026',  body:'Wants Yara prepared for First Communion with her cousins in May.', bodyAr:'تريد تحضير يارا للمناولة الأولى مع أولاد عمّها في أيار.' },
  { id:'nt3', p:'p13', at:'20 Aug 2026', body:'Family asked for the funeral arrangements to be kept off the notice board.', bodyAr:'طلبت العائلة عدم نشر ترتيبات الجنّاز على لوحة الإعلانات.' }
];
GROUP_DETAIL.g1.roster = [
  { p:'p3',  role:'Leader',    roleAr:'مسؤولة', joined:'2019', att:96 },
  { p:'p12', role:'Assistant', roleAr:'مساعد',  joined:'2021', att:88 },
  { p:'p6',  role:'Member',    roleAr:'عضو',    joined:'2023', att:74 },
  { p:'p9',  role:'Member',    roleAr:'عضو',    joined:'2024', att:91 },
  { p:'p16', role:'Member',    roleAr:'عضو',    joined:'2025', att:62 }
];
export const CONTENT = {
  history:{ en:'Saint Elias was built in 1908 on land given by the Sfeir family, and rebuilt after 1983. The parish serves Hadath and the upper part of Baabda.',
            ar:'بُنيت كنيسة مار الياس سنة ١٩٠٨ على أرض قدّمتها عائلة صفير، وأُعيد بناؤها بعد ١٩٨٣. تخدم الرعية الحدث والقسم الأعلى من بعبدا.' }
};
