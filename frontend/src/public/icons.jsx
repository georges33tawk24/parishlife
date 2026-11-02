/* The public site's icons, drawn on a 24-unit grid. Icon is the set the request arches and the
   parish pages share (1.5 stroke); Glyph the thinner-cornered set of the homepage and the
   calendar (1.6 stroke). */

const ICONS = {
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  church: <path d="M12 2v6m-3-3h6M3 21V11l9-5 9 5v10H3Zm6 0v-6a3 3 0 0 1 6 0v6M6 13v3m12-3v3" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6m10-6v6M3 11h18m-13 4h2m4 0h2" /></>,
  phone: <path d="m8 3 2 5-3 2a15 15 0 0 0 7 7l2-3 5 2v3a2 2 0 0 1-2 2C10 20 4 14 3 5a2 2 0 0 1 2-2Z" />,
  cross: <path d="M12 3v19M6 9h12" />,
  chevron: <path d="m8 5 7 7-7 7" />,
  /* the sacraments, drawn on the app's 20-unit grid and scaled to this one */
  water: <g transform="scale(1.2)" strokeWidth="1.25"><path d="M10 3.2C12.9 6.8 14.9 9.5 14.9 12.1a4.9 4.9 0 0 1-9.8 0C5.1 9.5 7.1 6.8 10 3.2zM7.7 12.6a2.4 2.4 0 0 0 2.3 2.2" /></g>,
  chalice: <g transform="scale(1.2)" strokeWidth="1.25"><path d="M5.8 3.6h8.4c0 3.4-1.9 5.6-4.2 5.6S5.8 7 5.8 3.6zM10 9.2v5.2M6.8 16.4c.5-1.3 1.7-2 3.2-2s2.7.7 3.2 2z" /></g>,
  flame: <g transform="scale(1.2)" strokeWidth="1.25"><path d="M10 3.2c.4 2.4 3.9 4.2 3.9 8a3.9 3.9 0 0 1-7.8 0c0-1.9.9-3.2 2-4.1c.1 1.4.7 2.3 1.6 2.6c-.3-2.2 0-4.4.3-6.5z" /></g>,
  rings: <g transform="scale(1.2)" strokeWidth="1.25"><path d="M2.6 10a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0 -8.4 0M9 10a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0 -8.4 0" /></g>,
  candle: <g transform="scale(1.2)" strokeWidth="1.25"><path d="M8.2 9h3.6v7.4H8.2zM6.4 16.4h7.2M10 3.4c1 1.2 1.5 2.1 1.5 2.8a1.5 1.5 0 0 1-3 0c0-.7.5-1.6 1.5-2.8z" /></g>,
  cert: <g transform="scale(1.2)" strokeWidth="1.25"><path d="M10.2 16.4H4.6V3.6h10.8v6.2M7.2 6.8h5.6M7.2 9.4h3.4M7.2 12h2M11.8 12.4a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0M12.9 14.3l-.5 2.7 1.6-.9 1.6.9-.5-2.7" /></g>,
  hall: <path d="M3 21V10l9-6 9 6v11M3 21h18M9 21v-6h6v6M7.5 12.5h.01M16.5 12.5h.01" />,
  message: <><path d="M4 5h16v11H10l-4 4v-4H4z" /><path d="M8 9h8M8 12.5h5" /></>
};

export function Icon({ name }) {
  return <svg className={'icon icon-' + name} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name] || ICONS.church}</svg>;
}

const GLYPHS = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  near: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /><circle cx="12" cy="12" r="7.5" /></>,
  prev: <path d="m15 5-7 7 7 7" />,
  next: <path d="m9 5 7 7-7 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  phone: <path d="m8 3 2 5-3 2a15 15 0 0 0 7 7l2-3 5 2v3a2 2 0 0 1-2 2C10 20 4 14 3 5a2 2 0 0 1 2-2Z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></>,
  route: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  door: <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M3 21h18M14.5 12h.01" />,
  access: <><circle cx="12" cy="4.5" r="1.8" /><path d="M6 8.5l6 1.2 6-1.2M12 9.7V15m0 0-3.5 6M12 15l3.5 6" /></>,
  cross: <path d="M12 3v18M7 8h10" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  cal: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M8 3v4m8-4v4M3.5 10h17" /></>,
  add: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M8 3v4m8-4v4M3.5 10h17M12 13v5m-2.5-2.5h5" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 8.5 5.5 3.5-5.5 3.5Z" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6m-7.6 6 7.6 3.6" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  whatsapp: <><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7Z" /><path d="M9.2 8.6c0 3.2 3 6.2 6.2 6.2l.9-1.5-1.9-1-1 .8a5 5 0 0 1-2.5-2.5l.8-1-1-1.9Z" /></>,
  car: <><path d="M5 16v-5l2-4.5h10L19 11v5M3.5 16h17M5 11h14" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /></>,
  star: <path d="M12 3.5 14.3 9l5.7.4-4.4 3.7 1.4 5.6L12 15.6l-5 3.1 1.4-5.6L4 9.4 9.7 9Z" />,
  doc: <><path d="M7 3h7l4 4v14H7Z" /><path d="M14 3v4h4M10 12h5M10 15.5h5" /></>,
  bell: <><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  google: <path d="M12.5 12H20a8 8 0 1 1-2.3-5.6" />
};

export function Glyph({ name }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{GLYPHS[name]}</svg>;
}

/* The cross of the Maronites, each arm ending in three small circles. */
export function MaroniteCross() {
  return <svg viewBox="0 0 22 30" fill="currentColor" aria-hidden="true" focusable="false"><path d="M9.6 4h2.8v24H9.6zM2.5 11.6h17v2.8h-17z" />
    {[[11, 3], [11, 27.6], [2.4, 13], [19.6, 13]].map(([x, y]) => <circle key={x + ',' + y} cx={x} cy={y} r="2.1" />)}
    {[[8.4, 4.4], [13.6, 4.4], [3.8, 10.4], [3.8, 15.6], [18.2, 10.4], [18.2, 15.6]].map(([x, y]) => <circle key={x + ',' + y} cx={x} cy={y} r="1.5" />)}</svg>;
}

/* A bell in its belfry, for Mass times. */
export function Bell() {
  return <svg className="bell" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true" focusable="false"><g className="bell-body"><path d="M13.5 5.5a2.5 2.5 0 0 1 5 0" /><path d="M16 6.5c-4.6 0-6 3.6-6 7.6 0 3.8-1.4 5.9-3.2 7.4h18.4c-1.8-1.5-3.2-3.6-3.2-7.4 0-4-1.4-7.6-6-7.6Z" /><path d="M10.6 17.8h10.8" opacity=".5" /></g><circle className="bell-clapper" cx="16" cy="24.6" r="2" fill="currentColor" stroke="none" /></svg>;
}

/* The ParishLife mark: an arch with its light. */
export function BrandMark({ strokeWidth = 1.8 }) {
  return <svg viewBox="0 0 28 34" fill="none" focusable="false"><path d="M4 32V14a10 10 0 0 1 20 0v18" stroke="currentColor" strokeWidth={strokeWidth} /><path d="M1 32.5h26" stroke="currentColor" strokeWidth={strokeWidth} /><circle className="brand-light" cx="14" cy="20" r="3.2" /></svg>;
}
