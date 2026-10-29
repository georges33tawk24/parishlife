/* Search that forgives how Lebanon types a name: in Arabic or Latin letters, in French or
   English spelling (Charbel, Sharbel, Charbil, شربل; Achrafieh, Ashrafieh, الأشرفية), in
   Arabizi (3, 7, 2 for ع, ح, ء), with or without "Mar", "Saint", "St" or the article "al".
   Saints' names have their usual forms (Elie, Elias, Ilyas, الياس); other words are reduced
   to their consonants in both scripts, which is what the spellings agree on. */
const STOP = new Set(['mar', 'mart', 'saint', 'sainte', 'saints', 'st', 'ste', 'sts', 'church', 'parish', 'of', 'the', 'de', 'du', 'des', 'al', 'el',
  'مار', 'مارت', 'القديس', 'القديسة', 'القديسين', 'رعية', 'كنيسة']);
const LADY = /(our lady( of)?|notre[- ]dame( de| des| du)?|sayy?ide?t|sayyidat|sayde?h?|السيدة|سيدة)/g;
const NAMES = {
  lady: ['lady'], lebanon: ['lebanon', 'liban', 'lebnen', 'lubnan', 'لبنان'],
  elias: ['elias', 'elie', 'elia', 'ilyas', 'elyas', 'iliyas', 'الياس', 'ايليا'], joseph: ['joseph', 'youssef', 'yousef', 'youssif', 'yusuf', 'يوسف'],
  george: ['george', 'georges', 'gerges', 'jirjis', 'girgis', 'جرجس', 'جاورجيوس'], michael: ['michael', 'michel', 'mikhael', 'mkhael', 'mikhail', 'ميخائيل', 'مخايل'],
  john: ['john', 'jean', 'youhanna', 'yohanna', 'yuhanna', 'يوحنا'], peter: ['peter', 'pierre', 'boutros', 'butros', 'بطرس'], paul: ['paul', 'boulos', 'bulus', 'بولس'],
  anthony: ['anthony', 'antoine', 'antonios', 'mtanios', 'antonius', 'انطونيوس', 'مطانيوس'], mary: ['mary', 'marie', 'maryam', 'mariam', 'مريم'],
  nicholas: ['nicholas', 'nicolas', 'nicola', 'nkoula', 'nicolas', 'نقولا'], thomas: ['thomas', 'touma', 'toma', 'توما'], simon: ['simon', 'semaan', 'simaan', 'سمعان'],
  saviour: ['saviour', 'savior', 'sauveur', 'mkhalles', 'mkhallis', 'المخلص', 'مخلص'], thecla: ['thecla', 'takla', 'tekla', 'تقلا']
};
const fold = text => String(text || '').normalize('NFKD').replace(/[̀-ًͯ-ٰٟـ]/g, '').toLowerCase();
const CANON = new Map(Object.entries(NAMES).flatMap(([key, list]) => list.map(w => [fold(w), '#' + key])));
const ARABIC = { 'ب': 'b', 'پ': 'b', 'ت': 't', 'ط': 't', 'ث': 't', 'ج': 'j', 'خ': 'k', 'ك': 'k', 'ق': 'k', 'غ': 'g', 'د': 'd', 'ذ': 'd', 'ض': 'd', 'ظ': 'd',
  'ر': 'r', 'ز': 's', 'س': 's', 'ش': 's', 'ص': 's', 'ف': 'f', 'ڤ': 'f', 'ل': 'l', 'م': 'm', 'ن': 'n' };
const LATIN = [[/ch|sh/g, 's'], [/kh/g, 'k'], [/gh/g, 'G'], [/th/g, 't'], [/dh/g, 'd'], [/ph/g, 'f'], [/[cqk]/g, 'k'], [/x/g, 'ks'], [/z/g, 's'],
  [/g/g, 'j'], [/G/g, 'g'], [/v/g, 'f'], [/p/g, 'b'], [/5/g, 'k'], [/8/g, 'g'], [/9/g, 'k'], [/6/g, 't'], [/[aeiouyhw237]/g, '']];

function skeleton(word) {
  if (/[؀-ۿ]/.test(word)) {
    const bare = word.length > 3 && word.startsWith('ال') ? word.slice(2) : word;
    return [...bare].map(ch => ARABIC[ch] ?? '').join('');
  }
  return /[a-z]/.test(word) ? LATIN.reduce((w, [from, to]) => w.replace(from, to), word) : word;
}
const tokens = text => fold(text).replace(LADY, ' lady ').split(/[^a-z0-9؀-ۿ]+/).filter(w => w && !STOP.has(w));
/* A word as a key: "#elias" for a known name in any spelling, otherwise its consonants. */
const key = word => CANON.get(word) || CANON.get(word.startsWith('ال') ? word.slice(2) : '') || skeleton(word).replace(/(.)\1+/g, '$1');
export const keys = text => tokens(text).map(key).filter(Boolean);

/* The items a query finds. Plain matches (every word of the query in the text, as typed) come
   first; only when there are none do spellings count: a known name in any of its forms, or the
   consonants of each query word (two or more) beginning a word of the text, as it is typed. */
export function find(query, items, textOf, normalize) {
  const plain = normalize(String(query || '').trim());
  if (!plain) return items;
  const words = tokens(query).map(normalize).filter(Boolean);
  const strong = items.filter(item => { const text = normalize(textOf(item)); return text.includes(plain) || (words.length && words.every(w => text.includes(w))); });
  if (strong.length) return strong;
  const wanted = keys(query).filter(k => k.startsWith('#') || k.length >= 2);
  if (!wanted.length) return [];
  return items.filter(item => {
    const have = keys(textOf(item));
    return wanted.every(k => k.startsWith('#') ? have.includes(k) : have.some(h => !h.startsWith('#') && h.startsWith(k)));
  });
}
