/* Small helpers the dialogs share: the translation alias, redrawing after a change, the success
   toast, a person's name, reading a form field, today's date and the group being viewed. */
import { S, bus } from '../model/store.js';
import { toast } from '../ui/ui.jsx';
import * as D from '../model/data.js';

export const refresh = () => bus.refresh();

export const ok = (title, body = '', opts) => toast(title, body, 'success', opts);

export const nameOf = p => (p ? `${p.lat}${p.ar ? ' · ' + p.ar : ''}` : '');

export const val = (el, sel) => el.querySelector(sel)?.value?.trim() || '';

export const today = new Date().toLocaleDateString('sv-SE');

/** The group whose page is open (its flows act on it, not on the choir). */
export const curGroup = () => (S.route === 'groups' && S.params[0]) || 'g1';

/* ═════════════ rota board ═════════════
   A place is addressed as "team|slot" on D.ROTA.teams. Every change keeps a
   snapshot so the toast can offer Undo. */
export const rotaSlot = at => {
  const [ti, si] = at.split('|').map(Number);
  return D.ROTA.teams[ti]?.filled[si];
};

export const rotaTeam = at => D.ROTA.teams[+at.split('|')[0]];
