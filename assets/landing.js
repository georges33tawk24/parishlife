/* ParishLife site — language toggle + role rail. No dependencies. */
(function () {
  'use strict';

  /* ---------------- language ---------------- */
  // Elements carry data-ar; the English is cached into data-en on first swap.
  var nodes = document.querySelectorAll('[data-ar]');

  function setLang(lang) {
    var ar = lang === 'ar';
    var root = document.documentElement;
    root.lang = ar ? 'ar' : 'en';
    root.dir = ar ? 'rtl' : 'ltr';

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.en === undefined) el.dataset.en = el.textContent;
      el.textContent = ar ? el.dataset.ar : el.dataset.en;
    }
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
    try { localStorage.setItem('pl-lang', lang); } catch (e) { /* private mode */ }
    renderRole();                       // rail labels follow the page language
  }

  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.dataset.lang); });
  });

  /* ---------------- roles ----------------
     Rails are the ones drawn in the design system app shell (05).
     ["l", en, ar, icon, badge, active] for a link, ["h", en, ar] for a heading. */
  var ROLES = {
    priest: {
      en: 'Parish priest', ar: 'كاهن الرعية', user: 'Fr. Antoine Khoury', userAr: 'الأب أنطوان خوري', initials: 'AK',
      noteEn: 'Full access. The only role that can see pastoral notes, sign certificates and change the exchange rate.',
      noteAr: 'صلاحية كاملة. الدور الوحيد الذي يرى الملاحظات الرعوية ويوقّع الشهادات ويغيّر سعر الصرف.',
      titleEn: 'Good evening, Fr. Antoine', titleAr: 'مساء الخير يا أبونا أنطوان',
      subEn: 'Sunday 4 October · 3 certificates awaiting your signature',
      subAr: 'الأحد ٤ تشرين الأول · ٣ شهادات بانتظار توقيعك',
      items: [
        ['l', 'Dashboard', 'لوحة القيادة', 'dash', '', 1],
        ['h', 'Records', 'السجلات'],
        ['l', 'People', 'المؤمنون', 'people', '1,380'],
        ['l', 'Families', 'العائلات', 'family', '412'],
        ['l', 'Sacraments', 'الأسرار', 'sacr', '3'],
        ['l', 'Pastoral notes', 'ملاحظات رعوية', 'notes', ''],
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
      en: 'Secretary', ar: 'أمينة السرّ', user: 'Rita Nassar', userAr: 'ريتا نصّار', initials: 'RN',
      noteEn: 'People, records, events and messaging. Giving is not in the rail at all — hiding beats greying out.',
      noteAr: 'المؤمنون والسجلّات والأحداث والمراسلة. التقدمات غائبة كلياً عن الشريط — الإخفاء أفضل من الإطفاء.',
      titleEn: 'Good morning, Rita', titleAr: 'صباح الخير يا ريتا',
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
      en: 'Treasurer', ar: 'أمين الصندوق', user: 'Nabil Saade', userAr: 'نبيل سعادة', initials: 'NS',
      noteEn: 'Money only. Sees amounts and envelope numbers but not pastoral notes, and is the one who can edit the parish rate.',
      noteAr: 'المال فقط. يرى المبالغ وأرقام المظاريف لا الملاحظات الرعوية، وهو من يعدّل سعر الرعية.',
      titleEn: 'Giving overview', titleAr: 'نظرة على التقدمات',
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
      en: 'Ministry leader', ar: 'مسؤولة خدمة', user: 'Maya Haddad', userAr: 'مايا حدّاد', initials: 'MH',
      noteEn: 'Scoped to the groups she leads. Every list she opens is already filtered to her people — the parish list, giving and other groups are not in the rail at all.',
      noteAr: 'محصورة بالمجموعات التي تقودها. كل لائحة تفتحها مرشّحة مسبقاً على أفرادها — لائحة الرعية والتقدمات والمجموعات الأخرى غائبة كلياً عن الشريط.',
      titleEn: 'Choir & Catechism G4', titleAr: 'الجوقة وتعليم مسيحي — الصف الرابع',
      subEn: '42 members · 2 swap requests waiting', subAr: '٤٢ عضواً · طلبا تبديل بالانتظار',
      items: [
        ['l', 'Dashboard', 'لوحة القيادة', 'dash', '', 1],
        ['h', 'My ministry', 'خدمتي'],
        ['l', 'Choir', 'الجوقة', 'groups', '24'],
        ['l', 'Catechism G4', 'تعليم مسيحي ٤', 'groups', '18'],
        ['l', 'Take attendance', 'تسجيل الحضور', 'attend', ''],
        ['l', 'Rota', 'المناوبات', 'vol', '2'],
        ['l', 'Message my group', 'مراسلة مجموعتي', 'msg', '']
      ]
    },
    volunteer: {
      en: 'Volunteer', ar: 'متطوّع', user: 'Elias Aoun', userAr: 'الياس عون', initials: 'EA',
      noteEn: 'One station, no navigation. In production the kiosk runs full-screen with no rail and no top bar — a 48px keypad and a very large Done button.',
      noteAr: 'محطة واحدة بلا تنقّل. في التشغيل الفعلي يعمل الكشك ملء الشاشة بلا شريط جانبي ولا شريط علوي — لوحة أرقام ٤٨ بكسل وزرّ «تمّ» كبير جداً.',
      titleEn: 'Sunday 10:30 check-in', titleAr: 'تسجيل الأحد ١٠:٣٠',
      subEn: '184 checked in · 12 children awaiting a guardian code',
      subAr: '١٨٤ مسجّلاً · ١٢ طفلاً بانتظار رمز وليّ الأمر',
      items: [
        ['l', 'Check-in', 'التسجيل', 'checkin', '', 1],
        ['l', 'Children', 'الأطفال', 'family', '12']
      ]
    }
  };

  var order = ['priest', 'secretary', 'treasurer', 'leader', 'volunteer'];
  var current = 'priest';
  var tabs = document.getElementById('roletabs');
  var rail = document.getElementById('rolerail');

  function ar() { return document.documentElement.dir === 'rtl'; }

  function renderRole() {
    if (!tabs || !rail) return;
    var isAr = ar(), r = ROLES[current];

    tabs.innerHTML = '';
    order.forEach(function (key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (key === current ? ' chip-on' : '');
      b.textContent = isAr ? ROLES[key].ar : ROLES[key].en;
      b.setAttribute('aria-pressed', String(key === current));
      b.addEventListener('click', function () { current = key; renderRole(); });
      tabs.appendChild(b);
    });

    rail.innerHTML = r.items.map(function (it) {
      var label = isAr ? it[2] : it[1];
      if (it[0] === 'h') return '<div class="navgroup">' + label + '</div>';
      var badge = it[4] ? '<span class="badge tnum" dir="ltr">' + it[4] + '</span>' : '';
      return '<div class="navitem' + (it[5] ? ' on' : '') + '">' +
             '<svg width="17" height="17" aria-hidden="true"><use href="#ic-' + it[3] + '"/></svg>' +
             '<span>' + label + '</span>' + badge + '</div>';
    }).join('');

    document.getElementById('roleinitials').textContent = r.initials;
    document.getElementById('roleuser').textContent = isAr ? r.userAr : r.user;
    document.getElementById('rolename').textContent = isAr ? r.ar : r.en;
    document.getElementById('rolenote').textContent = isAr ? r.noteAr : r.noteEn;
    document.getElementById('roletitle').textContent = isAr ? r.titleAr : r.titleEn;
    document.getElementById('rolesub').textContent = isAr ? r.subAr : r.subEn;
  }

  /* ---------------- boot ---------------- */
  var saved = 'en';
  try { saved = localStorage.getItem('pl-lang') || 'en'; } catch (e) { /* private mode */ }
  setLang(saved);          // also does the first renderRole()
})();

/* Scroll reveal: each section's direct content rises in once, siblings a beat apart. */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('motion');
  const items = document.querySelectorAll('.section .wrap > *, .section-lg .wrap > *, .shot, .module, .footer .wrap > *');
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(el => {
    const sibs = [...el.parentElement.children].filter(x => x.matches('.module'));
    if (el.matches('.module')) el.style.transitionDelay = `${Math.min(sibs.indexOf(el) % 4, 3) * 60}ms`;
    el.setAttribute('data-reveal', ''); io.observe(el);
  });
})();
