/* The public site's header and footer: the brand, the sections, the language, the members portal,
   the menu on phones, and the easier-reading control. */
import { useEffect, useState } from 'react';
import { EasyReading } from '../reading/EasyReading.jsx';
import { BrandMark } from './icons.jsx';

const COPY = {
  directory: ['Find a parish', 'ابحث عن رعية'],
  week: ['This week', 'هذا الأسبوع'],
  times: ['Mass times', 'مواعيد القداديس'],
  requests: ['Ask your parish', 'اطلب من رعيتك'],
  aboutNav: ['About ParishLife', 'عن ParishLife'],
  signIn: ['Members portal', 'بوّابة المؤمنين'],
  explore: ['Explore', 'استكشف'],
  forParishes: ['For parishes', 'للرعايا'],
  bundles: ['ParishLife bundles', 'باقات ParishLife'],
  verify: ['Check a signed document', 'التحقّق من وثيقة موقّعة'],
  footerIntro: ['The parishes of Lebanon, each with its light on.', 'رعايا لبنان، ولكلّ منها نورها.'],
  footer: ['Information published by participating parishes.', 'معلومات تنشرها الرعايا المشاركة.'],
  mapCredit: ['Map outline from Natural Earth', 'حدود الخريطة من Natural Earth'],
  photoCredit: ['Illustrative photographs from Unsplash', 'صور توضيحية من Unsplash']
};
const SECTIONS = [['directory', 'public.html#directory'], ['week', 'public.html#week'], ['times', 'public.html#times'], ['requests', 'public.html#requests']];

/* The header sits clear over a dark hero, and turns solid once the hero is behind it. */
export function useHeroWatch(heroRef) {
  useEffect(() => {
    const hero = heroRef.current;
    document.body.classList.toggle('over-hero', !!hero);
    if (!hero || !('IntersectionObserver' in window)) return undefined;
    const watch = new IntersectionObserver(([entry]) => document.body.classList.toggle('over-hero', entry.isIntersecting), { rootMargin: '-76px 0px 0px 0px', threshold: 0 });
    const scrolled = () => document.body.classList.toggle('is-scrolled', scrollY > 24);
    watch.observe(hero); scrolled();
    addEventListener('scroll', scrolled, { passive: true });
    return () => { watch.disconnect(); removeEventListener('scroll', scrolled); document.body.classList.remove('over-hero', 'is-scrolled'); };
  }, []);
}

function LanguageButton({ L, lang, onToggle, ...props }) {
  return <button type="button" lang={lang === 'ar' ? 'en' : 'ar'} aria-label={L('Switch to Arabic', 'التبديل إلى الإنكليزية')} onClick={onToggle} {...props}>{L('العربية', 'English')}</button>;
}

export function Header({ L, lang, onToggleLang }) {
  const T = key => L(...COPY[key]);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    document.body.classList.toggle('menu-open', menu);
    if (!menu) return undefined;
    const escape = e => { if (e.key === 'Escape') { setMenu(false); document.getElementById('menu-toggle')?.focus(); } };
    const wide = () => { if (innerWidth > 900) setMenu(false); };
    document.addEventListener('keydown', escape);
    addEventListener('resize', wide, { passive: true });
    return () => { document.removeEventListener('keydown', escape); removeEventListener('resize', wide); };
  }, [menu]);
  return <header className="site-header">
    <div className="site-wrap header-inner">
      <a className="brand" href="public.html" aria-label={L('ParishLife home', 'الصفحة الرئيسية لـ ParishLife')}><span className="brand-mark" aria-hidden="true"><BrandMark /></span><span className="brand-word">ParishLife</span></a>
      <nav className="desktop-nav" aria-label={L('Main navigation', 'القائمة الرئيسية')}>{SECTIONS.map(([key, href]) => <a key={key} href={href}>{T(key)}</a>)}</nav>
      <div className="header-actions"><EasyReading lang={lang} /><LanguageButton id="lang" className="language-button" L={L} lang={lang} onToggle={onToggleLang} /><a className="sign-in" href="index.html">{T('signIn')}</a>
        <button className="menu-toggle" id="menu-toggle" type="button" aria-expanded={menu} aria-controls="mobile-nav" aria-label={L('Toggle navigation', 'فتح أو إغلاق القائمة')} onClick={() => setMenu(!menu)}><span></span><span></span></button></div>
    </div>
    <nav id="mobile-nav" className="mobile-nav" aria-label={L('Mobile navigation', 'قائمة الهاتف')} hidden={!menu} onClick={e => { if (e.target.closest('a')) setMenu(false); }}>
      {[...SECTIONS, ['signIn', 'index.html']].map(([key, href], i) => <a key={key} href={href} style={{ '--i': i }}>{T(key)}</a>)}</nav>
  </header>;
}

export function Footer({ L, lang, onToggleLang }) {
  const T = key => L(...COPY[key]);
  return <footer className="site-footer">
    <div className="site-wrap footer-main">
      <div className="footer-brand"><a className="brand" href="public.html"><span className="brand-mark" aria-hidden="true"><BrandMark /></span><span className="brand-word">ParishLife</span></a><p>{T('footerIntro')}</p></div>
      <nav className="footer-links" aria-labelledby="footer-explore"><h2 id="footer-explore">{T('explore')}</h2>{SECTIONS.map(([key, href]) => <a key={key} href={href}>{T(key)}</a>)}<a href="public.html?view=verify">{T('verify')}</a></nav>
      <nav className="footer-links" aria-labelledby="footer-parishes"><h2 id="footer-parishes">{T('forParishes')}</h2><a href="index.html">{T('signIn')}</a><a href="public.html?view=bundles">{T('bundles')}</a><a href="public.html#about">{T('aboutNav')}</a>
        <LanguageButton id="footer-lang" className="text-button" L={L} lang={lang} onToggle={onToggleLang} /></nav>
    </div>
    <div className="site-wrap footer-bottom"><span>© <span id="year">{new Date().getFullYear()}</span> ParishLife</span><span>{T('footer')}</span><span>{T('mapCredit')}</span><a href="https://unsplash.com/@adrienolichon" target="_blank" rel="noopener noreferrer">{T('photoCredit')}</a></div>
    <div className="footer-mark" aria-hidden="true">ParishLife</div>
  </footer>;
}
