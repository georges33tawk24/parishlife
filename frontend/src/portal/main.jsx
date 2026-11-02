/* The members portal's entry: its styles, then the shell, which signs someone in and draws the
   screen for the route. */
import { createRoot } from 'react-dom/client';
import '../styles/parishlife.css';
import '../styles/app.css';
import '../styles/cms-design.css';
import '../styles/collection-ui.css';
import '../styles/account.css';
import '../styles/insights.css';
import '../styles/sanctuary.css';
import '../styles/auth.css';
import '../styles/reading.css';
import { Portal } from './shell/Portal.jsx';

createRoot(document.getElementById('root')).render(<Portal />);
