/* The product page's entry: its styles and the page, in the language remembered on this device. */
import { createRoot } from 'react-dom/client';
import '../styles/pages/landing.css';
import { Landing } from './Landing.jsx';

let lang = 'en';
try { lang = localStorage.getItem('pl-lang') === 'ar' ? 'ar' : 'en'; } catch { /* private mode */ }
createRoot(document.getElementById('root')).render(<Landing initialLang={lang} />);
