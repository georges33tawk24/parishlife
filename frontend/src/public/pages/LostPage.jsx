/* The page shown when a link leads nowhere or the directory could not be loaded. */
import { useState } from 'react';
import { PlainPage } from './parish-parts.jsx';
import { useSite } from '../site.jsx';

/* A page that could not be shown: an unlit candle in an arch (the visitor may light it), what
   happened, and the way back. */
export function LostPage({ title, body, actions }) {
  const { L } = useSite();
  const [lit, setLit] = useState(false);
  return (
    <PlainPage className="parish-sub">
      <section className="lost site-wrap">
        <div className="lost-card" data-reveal>
          <button
            type="button"
            className={'lost-arch' + (lit ? ' is-lit' : '')}
            aria-pressed={lit}
            aria-label={L('Light a candle', 'أضئ شمعة')}
            onClick={() => setLit(true)}
          >
            <span className="lost-candle">
              <i></i>
            </span>
          </button>
          <h1>{title}</h1>
          <p>{body}</p>
          <div className="lost-actions">{actions}</div>
        </div>
      </section>
    </PlainPage>
  );
}
