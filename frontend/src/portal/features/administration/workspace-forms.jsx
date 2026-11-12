/* Purpose: small building blocks shared by the workspace tabs: a form drawn from a list of field
   descriptions, opened in a drawer and sent through DrawerForm, plus helpers for the values the
   API wants (comma lists, UTC dates) and a plain list row.
   Main members: openForm, Fields, csv, startOfDay, Row, Section, ReferenceBox. */
import { useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { openDrawer, Panel } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import { DrawerForm } from '../../ui/forms.jsx';

export const L = (en, ar) => t(en, ar);
export const csv = text =>
  String(text || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
export const startOfDay = date => (date ? `${date}T00:00:00Z` : null);
export const shortDay = value => (value ? String(value).slice(0, 10) : '—');

/* field: { name, label, type = 'text' | 'date' | 'password' | 'textarea' | 'select' | 'check',
   required = true, options = [[value, label]], value, help } */
export function Fields({ fields }) {
  return fields.map(f => (
    <label key={f.name} className={f.type === 'check' ? 'check' : 'formrow'}>
      {f.type === 'check' ? (
        <>
          <input type="checkbox" name={f.name} defaultChecked={!!f.value} />
          {f.label}
        </>
      ) : (
        <>
          <span className="label">{f.label}</span>
          {f.type === 'select' ? (
            <Select name={f.name} defaultValue={f.value} required={f.required !== false}>
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          ) : f.type === 'textarea' ? (
            <textarea
              className="textarea"
              name={f.name}
              defaultValue={f.value || ''}
              required={f.required !== false}
              maxLength="2000"
            />
          ) : (
            <input
              className="input"
              name={f.name}
              type={f.type || 'text'}
              defaultValue={f.value || ''}
              required={f.required !== false}
              autoComplete={f.type === 'password' ? 'current-password' : 'off'}
              dir={f.type === 'text' || !f.type ? undefined : 'ltr'}
            />
          )}
          {f.help ? <span className="help">{f.help}</span> : null}
        </>
      )}
    </label>
  ));
}

export function openForm({ title, sub, intro, fields, save, done, label, saved }) {
  openDrawer({
    title,
    sub,
    body: (
      <DrawerForm save={save} done={done} label={label} saved={saved ?? L('Saved', 'حُفظ')}>
        {intro ? <p className="help">{intro}</p> : null}
        <Fields fields={fields} />
      </DrawerForm>
    )
  });
}

/* One record: a heading, small lines, and the actions that apply to it. */
export const Row = ({ title, lines = [], actions = null, ...attrs }) => (
  <article {...attrs}>
    <div>
      <h3>{title}</h3>
      {lines.filter(Boolean).map((line, i) => (
        <p key={i} className={i ? 'help' : undefined}>
          {line}
        </p>
      ))}
    </div>
    {actions ? <div className="account-actions">{actions}</div> : null}
  </article>
);

export const Section = ({ title, actions, children }) => (
  <Panel title={title} more={actions}>
    {children}
  </Panel>
);

/* Open a record by its reference: the API has no list for it, so its reference is what the account holds. */
export function ReferenceBox({ label, onOpen, extra = null }) {
  const [value, setValue] = useState(''),
    [error, setError] = useState('');
  const go = async e => {
    e.preventDefault();
    setError('');
    try {
      await onOpen(value.trim());
      setValue('');
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <form className="toolbar" onSubmit={go}>
      <input
        className="input"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={label}
        aria-label={label}
        required
      />
      {extra}
      <button className="btn btn-secondary btn-dense">{L('Open', 'فتح')}</button>
      {error ? (
        <span className="help-error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
