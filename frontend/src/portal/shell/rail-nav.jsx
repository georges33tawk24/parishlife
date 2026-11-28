/* Purpose: the portal's left rail, grouped into collapsible sections (owner, 28 November 2026): Overview, Community & People,
   Pastoral & Liturgical, Events & Operations, Communication, Finance and Administration. Overview starts open and the others closed;
   opening one keeps the others as they are; a small button closes them all. The open sections are remembered on this device.
   Screens in no section (the dashboard, a member's own pages, My account…) stay as plain items; the group holding the current screen
   is shown open. In the icon-only (collapsed) rail every item shows.
   Main members: GROUPS and RailNav. */
import { useState } from 'react';
import { t } from '../../lib/i18n.js';
import { Icon } from '../ui/ui.jsx';
import { S } from '../model/store.js';
import { ROUTES } from './routes.jsx';

const GROUPS = [
  ['overview', 'Overview', 'نظرة عامة', ['insights', 'reports']],
  ['community', 'Community & People', 'المجتمع والأشخاص', ['people', 'households', 'groups', 'volunteers']],
  ['pastoral', 'Pastoral & Liturgical', 'الرعوية والليتورجيا', ['sacraments', 'requests', 'music', 'services']],
  [
    'events',
    'Events & Operations',
    'الأحداث والعمليات',
    ['calendar', 'registrations', 'checkin', 'facilities', 'reservations', 'forms']
  ],
  ['communication', 'Communication', 'التواصل', ['messaging', 'notices', 'inbox']],
  ['finance', 'Finance', 'المالية', ['giving', 'finance', 'officeexpenses']],
  ['admin', 'Administration', 'الإدارة', ['workspace', 'audit', 'settings']]
];
const KEY = 'pl-rail-open';
const LAST = ['account']; // plain items shown after the sections

const remembered = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return Array.isArray(v) ? v : ['overview'];
  } catch {
    return ['overview'];
  }
};

export function RailNav({ nav, onPick }) {
  const [open, setOpen] = useState(remembered);
  const save = next => {
    setOpen(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };
  const ids = nav.filter(n => n[0] === 'l' && ROUTES[n[1]]).map(n => n[1]);
  const grouped = new Set(GROUPS.flatMap(g => g[3]));
  const item = id => {
    const rt = ROUTES[id],
      on = S.route === id,
      badge = rt.badge?.();
    return (
      <a
        key={id}
        className={'navitem ' + (on ? 'on' : '')}
        href={'#/' + id}
        aria-current={on ? 'page' : undefined}
        data-tip={t(rt.en, rt.ar)}
        onClick={onPick}
      >
        <Icon name={rt.ico} size={18} />
        <span className="nl">{t(rt.en, rt.ar)}</span>
        <span className="nb" hidden={!badge}>
          {String(badge || '')}
        </span>
      </a>
    );
  };
  const sections = GROUPS.map(([key, en, ar, members]) => [key, en, ar, members.filter(id => ids.includes(id))]).filter(
    g => g[3].length
  );
  return (
    <nav className="rail-nav" aria-label={t('Modules', 'الوحدات')}>
      {ids.filter(id => !grouped.has(id) && !LAST.includes(id)).map(item)}
      {sections.length ? (
        <button
          type="button"
          className="navgroup-all"
          onClick={() => save([])}
          disabled={!open.length}
          title={t('Close all sections', 'إغلاق كل الأقسام')}
        >
          {t('Close all', 'إغلاق الكل')}
        </button>
      ) : null}
      {sections.map(([key, en, ar, members]) => {
        const shown = open.includes(key) || members.includes(S.route);
        return (
          <div key={key} className={'navsection' + (shown ? ' open' : '')}>
            <button
              type="button"
              className="navgroup navgroup-toggle"
              aria-expanded={shown}
              onClick={() => save(shown ? open.filter(k => k !== key) : [...open, key])}
            >
              <span>{t(en, ar)}</span>
              <Icon name="chevD" size={14} />
            </button>
            <div className="navsection-items">{members.map(item)}</div>
          </div>
        );
      })}
      {ids.filter(id => LAST.includes(id)).map(item)}
    </nav>
  );
}
