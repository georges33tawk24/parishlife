/* Purpose: a search-as-you-type picker for choosing several people without listing everyone: nothing is
   shown until a minimum number of characters is typed, results come a page at a time ("Show more"), and the
   chosen people stay above the field as removable chips.
   Main members: PeopleSearch (the component), selectedIds (reads the chosen ids from the field's element).

   The caller supplies search(query, cursor) → { items: [{ id, name, alt, note, disabled }], next }, so the
   same picker serves the households member search (server-side, paged) and the sacrament candidates. The
   chosen ids are kept on the root element (data-selected, JSON) and a bubbling "change" event is sent on
   every change, so the imperative forms around it can read and react to them. */
import { useEffect, useRef, useState } from 'react';
import { t } from '../../lib/i18n.js';
import { Icon } from '../ui/ui.jsx';

const WAIT_MS = 250;

/** The ids chosen in a PeopleSearch, read from its root element. */
export const selectedIds = node => {
  try {
    return JSON.parse(node?.dataset.selected || '[]');
  } catch {
    return [];
  }
};

export function PeopleSearch({
  id,
  label,
  help = '',
  initial = [],
  search,
  minChars = 2,
  req = false,
  placeholder = t('Type a name in either script', 'اكتب الاسم بأي حرف')
}) {
  const [chosen, setChosen] = useState(initial);
  const [q, setQ] = useState('');
  const [found, setFound] = useState({ items: [], next: null, state: 'idle', error: '' });
  const root = useRef(null),
    input = useRef(null),
    ask = useRef(0),
    first = useRef(true);
  const ready = q.trim().replace(/\s+/g, '').length >= minChars;

  /* Each keystroke waits briefly; only the latest question's answer is shown. */
  useEffect(() => {
    if (!ready) {
      setFound({ items: [], next: null, state: 'idle', error: '' });
      return undefined;
    }
    const mine = ++ask.current;
    setFound(f => ({ ...f, state: 'loading' }));
    const timer = setTimeout(async () => {
      try {
        const page = await search(q.trim(), null);
        if (mine === ask.current)
          setFound({ items: page.items || [], next: page.next || null, state: 'done', error: '' });
      } catch (e) {
        if (mine === ask.current) setFound({ items: [], next: null, state: 'error', error: e.message || '' });
      }
    }, WAIT_MS);
    return () => clearTimeout(timer);
  }, [q, ready]);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    node.dataset.selected = JSON.stringify(chosen.map(p => p.id));
    if (first.current) first.current = false;
    else node.dispatchEvent(new Event('change', { bubbles: true }));
  }, [chosen]);

  const more = async () => {
    const mine = ask.current;
    setFound(f => ({ ...f, state: 'loading' }));
    try {
      const page = await search(q.trim(), found.next);
      if (mine === ask.current)
        setFound(f => ({
          items: [...f.items, ...(page.items || [])],
          next: page.next || null,
          state: 'done',
          error: ''
        }));
    } catch (e) {
      if (mine === ask.current) setFound(f => ({ ...f, state: 'error', error: e.message || '' }));
    }
  };
  const pick = p => {
    if (p.disabled || chosen.some(c => c.id === p.id)) return;
    setChosen([...chosen, { id: p.id, name: p.name }]);
    input.current?.focus();
  };
  const drop = pid => setChosen(chosen.filter(c => c.id !== pid));
  const listId = `${id}-results`;

  return (
    <div className="formrow" style={{ gridColumn: '1/-1' }}>
      <label className="label" htmlFor={`${id}-q`}>
        {label}
        {req ? <span className="req">*</span> : ''}
      </label>
      <div id={id} ref={root} data-people-search="" data-selected={JSON.stringify(initial.map(p => p.id))}>
        <div
          className="chipfield"
          onClick={e => {
            if (e.target === e.currentTarget) input.current?.focus();
          }}
        >
          {chosen.map(p => (
            <span key={p.id} className="tag" data-chosen={p.id}>
              {p.name}
              <button type="button" aria-label={t('Remove', 'إزالة') + ' ' + p.name} onClick={() => drop(p.id)}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
          <input
            id={`${id}-q`}
            type="search"
            autoComplete="off"
            placeholder={placeholder}
            aria-controls={listId}
            aria-describedby={`${id}-hint`}
            ref={input}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const firstFree = found.items.find(p => !p.disabled && !chosen.some(c => c.id === p.id));
                if (firstFree) pick(firstFree);
              } else if (e.key === 'Backspace' && !q && chosen.length) drop(chosen.at(-1).id);
            }}
          />
        </div>
        <span className="help" id={`${id}-hint`} aria-live="polite">
          {!ready
            ? t(`Type at least ${minChars} letters to search.`, `اكتب ${minChars} أحرف على الأقل للبحث.`)
            : found.state === 'loading'
              ? t('Searching…', 'جارٍ البحث…')
              : found.state === 'error'
                ? t('The search failed: ', 'تعذّر البحث: ') + found.error
                : found.items.length
                  ? t(`${chosen.length} chosen`, `${chosen.length} مختار`)
                  : t('No one matches.', 'لا أحد مطابق.')}
        </span>
        <div
          className="ac-list"
          id={listId}
          hidden={!ready || !found.items.length}
          style={{ position: 'static', marginTop: '6px' }}
        >
          {found.items.map(p => {
            const taken = chosen.some(c => c.id === p.id);
            return (
              <button
                key={p.id}
                type="button"
                className="ac-opt"
                data-candidate={p.id}
                disabled={!!p.disabled || taken}
                aria-pressed={taken}
                onClick={() => pick(p)}
              >
                <span>
                  <b>{p.name}</b>
                  {p.alt || p.note ? <small>{[p.alt, p.note].filter(Boolean).join(' · ')}</small> : null}
                </span>
                {taken ? <Icon name="check" size={15} /> : null}
              </button>
            );
          })}
          {found.next ? (
            <button type="button" className="btn btn-ghost btn-dense" data-more="" onClick={more}>
              {t('Show more', 'عرض المزيد')}
            </button>
          ) : null}
        </div>
        {help ? <span className="help">{help}</span> : null}
      </div>
    </div>
  );
}
