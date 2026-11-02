/* A form in a drawer: whatever it holds is sent to save(); the drawer closes when it succeeds and
   the error stays in the form when it does not. */
import { useState } from 'react';
import { t } from '../../lib/i18n.js';
import { closeOverlays, toast } from './ui.jsx';

export function DrawerForm({ save, done, label = t('Save', 'حفظ'), saved = '', children, buttonProps = {}, close = true, ...form }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    const el = e.currentTarget;
    try {
      await save(Object.fromEntries(new FormData(el)), el);
      if (close) closeOverlays();
      await done?.();
      if (saved) toast(saved, '', 'success');
      if (!close) setBusy(false);
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return <form {...form} onSubmit={submit}>{children}<p className="help-error" role="alert">{error}</p>
    <button type="submit" className="btn btn-primary" disabled={busy} {...buttonProps}>{label}</button></form>;
}
