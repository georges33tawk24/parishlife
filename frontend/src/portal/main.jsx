/* The members portal's entry: its styles, then the shell, which signs someone in and draws the
   screen for the route. */
import { createRoot } from 'react-dom/client';
import '../styles/pages/portal.css';
import { Portal } from './shell/Portal.jsx';

createRoot(document.getElementById('root')).render(<Portal />);
