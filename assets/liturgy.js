/* The Church's year, as the Maronite calendar keeps it: its seasons and its great feasts, so the
   homepage can say where the year stands and mark the feasts on the week. Easter follows the
   Gregorian reckoning, as the Maronite Church does. Dates are civil dates (YYYY-MM-DD). */

const day = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const add = (date, n) => new Date(date.getTime() + n * 864e5);
const key = date => date.toISOString().slice(0, 10);

/* Easter Sunday in the Gregorian calendar (Meeus/Jones/Butcher). */
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), date = ((h + l - 7 * m + 114) % 31) + 1;
  return day(y, month, date);
}
/* The Sunday of the Consecration of the Church opens the year: eight Sundays before Christmas. */
function consecration(y) {
  const christmas = day(y, 12, 25), back = christmas.getUTCDay() || 7;
  return add(christmas, -back - 49);
}

const SEASONS = {
  church: ['Season of the Church', 'زمن الكنيسة'],
  birth: ['Season of the Glorious Birth', 'زمن الميلاد المجيد'],
  epiphany: ['Season of the Epiphany', 'زمن الدنح'],
  lent: ['Great Lent', 'زمن الصوم الكبير'],
  passion: ['Passion Week', 'أسبوع الآلام'],
  resurrection: ['Season of the Resurrection', 'زمن القيامة'],
  pentecost: ['Season of Pentecost', 'زمن العنصرة'],
  cross: ['Season of the Holy Cross', 'زمن الصليب']
};

/* The season a civil date falls in: { id, en, ar }. */
export function season(iso) {
  const [y, m, d] = iso.split('-').map(Number), date = day(y, m, d), e = easter(y);
  const consecrated = consecration(y), announcements = add(consecrated, 14);
  let id;
  if (date >= consecrated && date < announcements) id = 'church';
  else if (date >= announcements || date < day(y, 1, 6)) id = 'birth';
  else if (date < add(e, -49)) id = 'epiphany';
  else if (date < add(e, -7)) id = 'lent';
  else if (date < e) id = 'passion';
  else if (date < add(e, 49)) id = 'resurrection';
  else if (date < day(y, 9, 14)) id = 'pentecost';
  else id = 'cross';
  return { id, en: SEASONS[id][0], ar: SEASONS[id][1] };
}

const FIXED = {
  '01-06': ['The Epiphany', 'عيد الدنح'],
  '02-02': ['The Presentation of the Lord', 'دخول المسيح إلى الهيكل'],
  '02-09': ['Saint Maron', 'عيد مار مارون'],
  '03-19': ['Saint Joseph', 'عيد مار يوسف'],
  '03-25': ['The Annunciation', 'عيد البشارة'],
  '04-23': ['Saint George', 'عيد مار جرجس'],
  '06-29': ['Saints Peter and Paul', 'عيد الرسولين بطرس وبولس'],
  '07-20': ['The Prophet Elijah', 'عيد مار الياس'],
  '08-06': ['The Transfiguration', 'عيد التجلّي'],
  '08-15': ['The Assumption', 'عيد انتقال السيدة العذراء'],
  '09-14': ['The Exaltation of the Holy Cross', 'عيد ارتفاع الصليب'],
  '11-01': ['All Saints', 'عيد جميع القديسين'],
  '12-08': ['The Immaculate Conception', 'عيد الحبل بلا دنس'],
  '12-25': ['The Nativity of the Lord', 'عيد الميلاد المجيد']
};

/* The great feast on a civil date, if any: { en, ar }. */
export function feastOn(iso) {
  const [y] = iso.split('-').map(Number), e = easter(y);
  const movable = { [key(add(e, -7))]: ['Palm Sunday', 'أحد الشعانين'], [key(add(e, -2))]: ['Good Friday', 'الجمعة العظيمة'],
    [key(e)]: ['Easter, the Resurrection', 'عيد القيامة المجيدة'], [key(add(e, 39))]: ['The Ascension', 'عيد الصعود'], [key(add(e, 49))]: ['Pentecost', 'عيد العنصرة'] };
  // Saint Charbel is kept on the third Sunday of July
  const july = day(y, 7, 1), charbel = add(july, ((7 - july.getUTCDay()) % 7) + 14);
  movable[key(charbel)] = ['Saint Charbel', 'عيد مار شربل'];
  const hit = movable[iso] || FIXED[iso.slice(5)];
  return hit ? { en: hit[0], ar: hit[1] } : null;
}
