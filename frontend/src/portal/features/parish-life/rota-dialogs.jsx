/* Changing the rota: removing someone from a place, dropping a person onto one, and swapping two
   places, each with undo. */
import { t } from '../../../lib/i18n.js';
import { toast, openModal, closeOverlays, openMenu } from '../../ui/ui.jsx';
import * as D from '../../model/data.js';
import { nameOf, ok, refresh, rotaSlot, rotaTeam } from '../../shared/dialog-helpers.jsx';

const L = (en, ar) => t(en, ar);

const rotaSnap = () => {
  const snap = D.ROTA.teams.map(tm => tm.filled.map(f => ({ ...f })));
  return () => {
    D.ROTA.teams.forEach((tm, i) => {
      tm.filled = snap[i];
    });
    refresh();
  };
};

const undo = fn => ({ action: { label: L('Undo', 'تراجع'), fn } });

export function rotaRemove(at) {
  const slot = rotaSlot(at);
  if (!slot?.p) return;
  const restore = rotaSnap(),
    name = nameOf(D.person(slot.p));
  openModal({
    title: L('Remove this assignment?', 'إزالة هذا الإسناد؟'),
    body: (
      <>
        <p>{name}</p>
        <p className="help">
          {L(
            'The role becomes unfilled. The person remains on the volunteer list.',
            'يصبح الدور شاغراً ويبقى الشخص في لائحة المتطوّعين.'
          )}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Keep assignment', 'إبقاء الإسناد')}
        </button>
        <button className="btn btn-danger" id="rota-remove-confirm">
          {L('Remove assignment', 'إزالة الإسناد')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#rota-remove-confirm').addEventListener('click', () => {
        Object.assign(slot, { p: null, s: 'open', swap: undefined });
        closeOverlays();
        refresh();
        ok(L('Assignment removed', 'أُزيل الإسناد'), name, undo(restore));
      });
    }
  });
}

/** from: { p } — a volunteer from the tray — or { at } — a card already on the board. */
export function rotaDrop(from, at) {
  const dst = rotaSlot(at),
    team = rotaTeam(at),
    restore = rotaSnap();
  if (!dst || from.at === at) return;
  const free = !dst.p || dst.s === 'declined';
  const who = from.p || rotaSlot(from.at).p;
  if (from.p && !free)
    return toast(
      L('Use Replace to review this change', 'استعمل الاستبدال لمراجعة التغيير'),
      L('The current assignment will not be overwritten by dragging.', 'لن يُستبدل الإسناد الحالي بالسحب.'),
      'warning'
    );
  if (
    D.ROTA.teams.some(other =>
      other.filled.some(f => f !== dst && (!from.at || f !== rotaSlot(from.at)) && f.p === who && f.s !== 'declined')
    )
  )
    return toast(L('Assignment conflict', 'تعارض في الإسناد'), nameOf(D.person(who)), 'warning');
  if (from.p) {
    Object.assign(dst, { p: from.p, s: 'pending', swap: undefined });
    refresh();
    return ok(
      L('Assignment awaiting confirmation', 'إسناد بانتظار التأكيد'),
      `${nameOf(D.person(from.p))} · ${L(team.team, team.teamAr)}`,
      undo(restore)
    );
  }
  const src = rotaSlot(from.at),
    moved = { ...src };
  Object.assign(src, free ? { p: null, s: 'open', swap: undefined } : { p: dst.p, s: dst.s, swap: dst.swap });
  Object.assign(dst, moved);
  refresh();
  ok(
    free ? L(`Moved to ${team.team}`, `نُقل إلى ${team.teamAr}`) : L('Places swapped', 'تبادلا المركزين'),
    free ? nameOf(D.person(moved.p)) : `${nameOf(D.person(moved.p))} ⇄ ${nameOf(D.person(src.p))}`,
    undo(restore)
  );
}

export function rotaSwap(anchor, at) {
  const f = rotaSlot(at),
    team = rotaTeam(at),
    by = D.person(f.p),
    to = D.person(f.swap);
  openMenu(
    anchor,
    [
      { head: L(`${nameOf(by)} asks to swap with ${nameOf(to)}`, `${nameOf(by)} يطلب التبديل مع ${nameOf(to)}`) },
      {
        label: L(`Approve — ${nameOf(to)} serves`, `موافقة — يخدم ${nameOf(to)}`),
        icon: 'check',
        fn: () => {
          const restore = rotaSnap();
          Object.assign(f, { p: f.swap, s: 'accepted', swap: undefined });
          refresh();
          ok(
            L('Swap approved', 'تمّت الموافقة على التبديل'),
            `${nameOf(to)} · ${L(team.team, team.teamAr)}`,
            undo(restore)
          );
        }
      },
      {
        label: L(`Decline — ${nameOf(by)} stays on`, `رفض — يبقى ${nameOf(by)}`),
        icon: 'close',
        fn: () => {
          const restore = rotaSnap();
          f.swap = undefined;
          refresh();
          toast(
            L('Swap declined', 'رُفض التبديل'),
            L(`${nameOf(by)} is told on WhatsApp.`, `يُبلَّغ ${nameOf(by)} عبر واتساب.`),
            '',
            undo(restore)
          );
        }
      }
    ],
    { width: 280 }
  );
}
