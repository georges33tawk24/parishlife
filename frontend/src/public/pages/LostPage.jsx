/* The page shown when a link leads nowhere or the directory could not be loaded (design A3): what
   happened, in a few words, and the way back. */
import { PlainPage } from './parish-parts.jsx';

export function LostPage({ title, body, actions }) {
  return (
    <PlainPage className="lost">
      <section className="wrap sec lost-inner">
        <h1 className="h1">{title}</h1>
        <p className="lost-body">{body}</p>
        <div className="acts">{actions}</div>
      </section>
    </PlainPage>
  );
}
