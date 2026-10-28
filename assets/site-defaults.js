/* Built-in homepage wording. The dashboard Homepage editor overrides any of it;
   an empty field there falls back to these lines, so the public page never shows a gap. */
export const HOME_DEFAULTS = {
  hero: {
    title: {en:'Find your parish, wherever you are in Lebanon.', ar:'ابحث عن رعيتك، أينما كنت في لبنان.'},
    subtitle: {en:'Mass times, this week’s celebrations and a direct line to the parish office, for every parish on ParishLife.',
               ar:'مواعيد القداديس واحتفالات هذا الأسبوع وتواصل مباشر مع مكتب الرعية، لكل رعية على ParishLife.'}
  },
  about: {
    title: {en:'Run by the parishes, for their people', ar:'تديره الرعايا، لأبنائها'},
    body: {en:'Each parish office keeps its registers, calendar and announcements on ParishLife. What the parish chooses to publish appears here: Mass times, celebrations, news, and the way to ask for a baptism, a wedding or a certificate. Personal records stay with the parish.',
           ar:'يحفظ كل مكتب رعية سجلاته ورزنامته وإعلاناته على ParishLife. وما تختار الرعية نشره يظهر هنا: مواعيد القداديس والاحتفالات والأخبار، وطريقة طلب معمودية أو إكليل أو شهادة. أما السجلات الشخصية فتبقى لدى الرعية.'}
  },
  join: {
    title: {en:'Bring your parish to ParishLife', ar:'انضمّوا برعيتكم إلى ParishLife'},
    body: {en:'Parish priests and offices join through their diocese. Parishioners sign in to the members portal to follow their parish, book services and receive their documents.',
           ar:'ينضمّ كهنة الرعايا ومكاتبها عبر أبرشيتهم. ويدخل أبناء الرعية إلى بوابة المؤمنين لمتابعة رعيتهم وحجز الخدمات واستلام مستنداتهم.'}
  }
};

export const HOME_SECTIONS = [
  ['week', 'This week', 'هذا الأسبوع'],
  ['map', 'Parish map and directory', 'خريطة الرعايا ودليلها'],
  ['requests', 'Ask your parish', 'اطلب من رعيتك'],
  ['times', 'Mass times', 'مواعيد القداديس'],
  ['news', 'From the parishes', 'من الرعايا'],
  ['stories', 'Stories', 'قصص'],
  ['about', 'About ParishLife', 'عن ParishLife'],
  ['join', 'Join', 'الانضمام']
];

/* Photographs shipped with the site, offered in the editor as story images. */
export const HOME_IMAGES = [
  ['assets/images/church-light.webp', 'Light through a church window', 'نور عبر نافذة كنيسة'],
  ['assets/images/church-interior.webp', 'Church interior', 'داخل كنيسة']
];
