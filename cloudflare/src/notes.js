/* Pastoral-note visibility, ported from server.py. A note is its author's alone unless they share it
   with the parish's priests; a shared note is read by whoever is a priest of that parish now. Nothing
   is ever shared on anyone's behalf. Only py.js is imported: app.js loads this module. */
import { need, eq } from './py.js';

export const NOTE_VISIBILITY = ['personal', 'shared'];
const perms = u => u.perms instanceof Set ? u.perms : new Set();

export function noteVisible(u, n) {
  if (!perms(u).has('notes.pastoral') || !n.authorId) return false;
  return n.authorId === u.id || n.visibility === 'shared';
}

/* The notes a priest saves replace only what they may see: their own notes, and (to mark a task done
   that was shared and assigned to them) the shared ones. Everything else stays as it was. */
export function mergeNotes(u, old, incoming) {
  need(Array.isArray(incoming) && incoming.every(n => n !== null && typeof n === 'object' && !Array.isArray(n) && typeof n.id === 'string'), 'Invalid notes.');
  const before = new Map(old.map(n => [n.id, n]));
  const seen = new Set(), out = [];
  for (const n of incoming) {
    need(!seen.has(n.id), 'Invalid notes.');
    seen.add(n.id);
    const prior = before.get(n.id);
    const visibility = n.visibility ?? 'personal';
    need(NOTE_VISIBILITY.includes(visibility), 'Choose who can see this note.');
    if (prior === undefined) {
      out.push({ ...n, authorId: u.id, by: u.person_id ?? null, visibility });
    } else if (prior.authorId === u.id) {
      out.push({ ...n, authorId: u.id, by: prior.by || (u.person_id ?? null), visibility });
    } else {
      need(noteVisible(u, prior), 'Note not available.', 403);
      const changed = new Set([...Object.keys(n), ...Object.keys(prior)].filter(k => !eq(n[k] ?? null, prior[k] ?? null)));
      need(!changed.size || (changed.size === 1 && changed.has('done') && prior.kind === 'task' && prior.assignee === u.person_id),
        'Only the author can change this note.', 403);
      out.push({ ...prior, done: n.done ?? prior.done });
    }
  }
  for (const n of old) {
    if (seen.has(n.id)) continue;
    need(!noteVisible(u, n) || n.authorId === u.id, 'Only the author can delete this note.', 403);
    if (!noteVisible(u, n)) out.push(n);
  }
  return out;
}
