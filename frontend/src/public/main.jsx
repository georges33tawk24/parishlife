/* The public site's entry: its styles, the analytics of what visitors do, the offline copy, and the app. */
import { createRoot } from 'react-dom/client';
import '../styles/pages/public.css';
import { watchActions } from '../lib/beacon.js';
import { PublicApp, startingLanguage, setDocumentLanguage } from './App.jsx';
import { DEFAULT_PHOTOS } from './site.jsx';

/* A parish photograph that fails to load gives way to an illustrative one. */
document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.matches('.parish-card-photo,.profile-photo,.public-gallery img') || image.dataset.defaultPhoto) return;
  image.dataset.defaultPhoto = 'true'; image.src = DEFAULT_PHOTOS[0];
  image.alt = document.documentElement.lang === 'ar' ? 'صورة توضيحية افتراضية لكنيسة' : 'Default illustrative church photograph';
  const caption = image.closest('figure')?.querySelector('figcaption');
  if (caption) caption.textContent = image.alt;
}, true);

const lang = startingLanguage();
setDocumentLanguage(lang);
watchActions(() => new URLSearchParams(location.search).get('parish') || '');
createRoot(document.getElementById('root')).render(<PublicApp initialLang={lang} />);

/* Installable, and readable offline with what it last showed (see sw.js). */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost'))
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
