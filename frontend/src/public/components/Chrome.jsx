/* The public site's header and footer (design A3): one white bar with the brand, the homepage's sections,
   the text size, the language and Sign in, a menu on narrow screens; a simple dark footer of links.
   Main exports: Header, Footer, BrandArch. */
import { useEffect, useState } from 'react';
import { EasyReading } from '../../reading/EasyReading.jsx';
import { A3Icon } from './a3.jsx';

const COPY = {
  times: ['Mass times', 'مواعيد القداديس'],
  week: ['This week', 'هذا الأسبوع'],
  directory: ['Find a parish', 'ابحث عن رعية'],
  requests: ['Ask your parish', 'اطلب من رعيتك'],
  signIn: ['Sign in', 'تسجيل الدخول'],
  forParishes: ['For parishes', 'للرعايا'],
  verify: ['Check a signed document', 'التحقّق من وثيقة موقّعة'],
  privacy: ['Privacy', 'الخصوصية'],
  terms: ['Terms', 'الشروط'],
  cookies: ['Cookies', 'ملفات تعريف الارتباط'],
  footer: [
    'Information published by participating parishes. Illustrative photographs from ',
    'معلومات تنشرها الرعايا المشاركة. صور توضيحية من '
  ]
};

const SECTIONS = [
  ['times', 'public.html#times'],
  ['week', 'public.html#week'],
  ['directory', 'public.html#directory'],
  ['requests', 'public.html#requests']
];

/* The brand: an arch with a lit lamp inside. */
export function BrandArch() {
  return (
    <svg viewBox="0 0 28 34" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 32V14a10 10 0 0 1 20 0v18" stroke="#7A1F2E" strokeWidth="2" />
      <path d="M1 32.5h26" stroke="#7A1F2E" strokeWidth="2" />
      <circle cx="14" cy="20" r="3.4" fill="#C9962E" />
    </svg>
  );
}

function LanguageButton({ L, lang, onToggle, ...props }) {
  return (
    <button
      type="button"
      lang={lang === 'ar' ? 'en' : 'ar'}
      /* named by the language it switches to, in that language (its lang attribute sets the voice): 2.5.3 */
      onClick={onToggle}
      {...props}
    >
      {L('العربية', 'English')}
    </button>
  );
}

export function Header({ L, lang, onToggleLang }) {
  const T = key => L(...COPY[key]);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return undefined;
    const escape = e => {
      if (e.key === 'Escape') {
        setMenu(false);
        document.getElementById('menu-toggle')?.focus();
      }
    };
    const wide = () => {
      if (innerWidth > 1140) setMenu(false);
    };
    document.addEventListener('keydown', escape);
    addEventListener('resize', wide, { passive: true });
    return () => {
      document.removeEventListener('keydown', escape);
      removeEventListener('resize', wide);
    };
  }, [menu]);
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <a className="brand" href="public.html" aria-label={L('ParishLife home', 'الصفحة الرئيسية لـ ParishLife')}>
          <BrandArch />
          <span translate="no">ParishLife</span>
        </a>
        <nav className="desktop-nav" aria-label={L('Main navigation', 'القائمة الرئيسية')}>
          {SECTIONS.map(([key, href]) => (
            <a key={key} href={href}>
              {T(key)}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <EasyReading lang={lang} />
          <span className="tool-sep" aria-hidden="true"></span>
          <LanguageButton id="lang" className="tool" L={L} lang={lang} onToggle={onToggleLang} />
          <a className="btn btn-red sign-in" href="index.html">
            <A3Icon name="person" />
            {T('signIn')}
          </a>
          <button
            className="menu-toggle"
            id="menu-toggle"
            type="button"
            aria-expanded={menu}
            aria-controls="mobile-nav"
            aria-label={L('Menu', 'القائمة')}
            onClick={() => setMenu(!menu)}
          >
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
      <nav
        id="mobile-nav"
        className="mobile-nav"
        aria-label={L('Menu', 'القائمة')}
        hidden={!menu}
        onClick={e => {
          if (e.target.closest('a')) setMenu(false);
        }}
      >
        {[...SECTIONS, ['signIn', 'index.html']].map(([key, href]) => (
          <a key={key} href={href}>
            {T(key)}
          </a>
        ))}
      </nav>
      <div className="strip" aria-hidden="true"></div>
    </header>
  );
}

export function Footer({ L, lang, onToggleLang }) {
  const T = key => L(...COPY[key]);
  const q = lang === 'ar' ? '?lang=ar' : '?lang=en';
  return (
    <footer className="site-footer dark">
      <div className="strip" aria-hidden="true"></div>
      <div className="wrap footer-main">
        <a className="brand" href="public.html" translate="no">
          ParishLife
        </a>
        <nav className="footer-links" aria-label={L('Footer', 'تذييل الصفحة')}>
          <a href="public.html#directory">{T('directory')}</a>
          <a href="public.html?view=bundles">{T('forParishes')}</a>
          <a href="public.html?view=verify">{T('verify')}</a>
          <a href={'privacy.html' + q}>{T('privacy')}</a>
          <a href={'terms.html' + q}>{T('terms')}</a>
          <a href={'cookies.html' + q}>{T('cookies')}</a>
          <LanguageButton id="footer-lang" L={L} lang={lang} onToggle={onToggleLang} />
        </nav>
      </div>
      <p className="wrap footer-note">
        © {new Date().getFullYear()} ParishLife. {T('footer')}
        <a href="https://unsplash.com/@adrienolichon" target="_blank" rel="noopener noreferrer">
          Unsplash
        </a>
        .
      </p>
    </footer>
  );
}
