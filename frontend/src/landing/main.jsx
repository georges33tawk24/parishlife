/* The product page's entry: its styles and the page, in the language the address asks for (?lang) or the one remembered on this device. The built page already holds the
   English page text (scripts/prerender.mjs); React attaches to it (hydrateRoot). In Arabic, or with reduced motion (the counting demo
   then draws a still picture), the first drawing would differ from the prebuilt English one, so React draws the page afresh instead. */
import { createRoot, hydrateRoot } from 'react-dom/client';
import '../styles/pages/landing.css';
import { Landing } from './Landing.jsx';

// ?lang=ar or ?lang=en in the address wins (as on the public site), then the language remembered on this device.
let lang = 'en';
const asked = new URLSearchParams(location.search).get('lang');
if (asked === 'ar' || asked === 'en') lang = asked;
else
  try {
    lang = localStorage.getItem('pl-lang') === 'ar' ? 'ar' : 'en';
  } catch {
    /* private mode */
  }
const root = document.getElementById('root');
const prebuilt = !!root.querySelector('main, header, section');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prebuilt && lang === 'en' && !reduced) hydrateRoot(root, <Landing initialLang={lang} />);
else {
  root.replaceChildren();
  createRoot(root).render(<Landing initialLang={lang} />);
}
