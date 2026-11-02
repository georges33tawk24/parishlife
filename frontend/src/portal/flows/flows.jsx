import { Select } from "../ui/components.jsx";
import { paint, markup } from "../ui/html.js";
/* Real flows behind every button. Each one opens a designed surface, and on
   confirm changes the in-memory parish, re-renders and says what happened.
   Reversible changes carry Undo, as sheet 04 asks. */
import { t, isAr, num, usd, fmtDate, fmtLong, matches } from "../../lib/i18n.js";
import { S, bus, go, me, is } from "../model/store.js";
import { Icon, toast, openDrawer, openModal, closeOverlays, Avatar, Who, Status, openMenu, closeMenu } from "../ui/ui.jsx";
import * as C from "../ui/components.jsx";
import * as D from "../model/data.js";
import { currentPlan, copyOrder, allPlans, normalizePlanOrder } from "../model/planning.js";
import { openPastoralForm } from "../views/notes.jsx";
import { download } from "../actions.jsx";
import { persist } from "../model/persist.js";
import { safeRichText } from "../../lib/rich-text.js";
import { requestRequirements, RequestDocuments } from "./request-documents.jsx";
import { participantForm, canCheckIn } from "./registration.jsx";
import { memberAction } from "../model/member-data.js";
import { readAddressCascade } from "../ui/geography.jsx";
import { eligibleEvents, eventById, selectedRegistration, selectRegistration, selectableCheckinEvents, selectedCheckin, ensureCheckinSession, linkedEvent, registrantsFor } from "../model/event-workflows.js";
const L = (en, ar) => t(en, ar);
const refresh = () => bus.refresh();
const ok = (title, body = '', opts) => toast(title, body, 'success', opts);
const nameOf = p => p ? `${p.lat}${p.ar ? ' · ' + p.ar : ''}` : '';
const val = (el, sel) => el.querySelector(sel)?.value?.trim() || '';
/* Inline validation as sheet 03 draws it: the field turns red, the message sits under
   it and focus moves there; it clears as soon as the person types. */
export function need(el, sel, msg, ok = v => !!v) {
  const inp = el.querySelector(sel);
  if (!inp || ok(inp.value.trim())) return true;
  const row = inp.closest('.formrow') || inp.parentElement;
  let h = row.querySelector('[data-need]');
  if (!h) {
    h = Object.assign(document.createElement('span'), {
      className: 'help help-error'
    });
    h.dataset.need = '1';
    row.append(h);
  }
  h.textContent = msg;
  inp.setAttribute('aria-invalid', 'true');
  inp.focus();
  inp.addEventListener('input', () => {
    inp.removeAttribute('aria-invalid');
    h.remove();
  }, {
    once: true
  });
  return false;
}
const today = new Date().toLocaleDateString('sv-SE');
/** The group whose page is open (its flows act on it, not on the choir). */
const curGroup = () => S.route === 'groups' && S.params[0] || 'g1';
const gd = () => D.groupInfo(curGroup());

/* ═════════════ messaging ═════════════ */
const AUDIENCES = {
  all: ['All households', 'كل العائلات', 412],
  choir: ['Saint Elias Choir', 'جوقة مار الياس', 24],
  parents: ['Catechism parents', 'أهالي التعليم المسيحي', 198],
  rota: ['Volunteers on this Sunday’s rota', 'متطوّعو مناوبة هذا الأحد', 14],
  group: ['Saint Elias Choir', 'جوقة مار الياس', 24],
  guardians: ['Guardians of children checked in', 'أولياء أمور الأطفال المسجّلين', 26]
};
export function compose(audience = 'all', {
  subject = '',
  body = '',
  bodyAr = '',
  title
} = {}) {
  if (audience === 'eparchy') return toast(L('Eparchy delivery is not connected', 'خدمة الإرسال إلى الأبرشية غير موصولة'), L('Use the Eparchy contact outside this application.', 'تواصل مع الأبرشية خارج هذا التطبيق.'), 'warning');
  const person = D.person(audience);
  const groupAudience = audience === 'group';
  const [aen, aar] = person ? [person.lat, person.ar] : groupAudience ? [D.group(curGroup())?.name || 'Ministry', D.group(curGroup())?.ar || 'الخدمة'] : [L('All members', 'كل الأعضاء'), L('All members', 'كل الأعضاء')];
  openDrawer({
    large: true,
    title: title || L('New message', 'رسالة جديدة'),
    sub: L('Delivered inside ParishLife to accounts in this parish. External channels are not connected.', 'تصل داخل ParishLife إلى الحسابات في هذه الرعية. القنوات الخارجية غير موصولة.'),
    body: <><div className="formrow"><label className="label">{L('Send to', 'إرسال إلى')}</label>{" "}{groupAudience ? <Select id="mgroup">{D.GROUPS.map(g => <option value={g.id} selected={!!(g.id === curGroup())}>{L(g.name, g.ar)}</option>)}</Select> : <div className="chipfield" style={{
          cursor: "default"
        }}><span className="tag">{person ? <Avatar p={person} cls='avatar-sm' /> : <Icon name='groups' size={14} />}{" "}{L(aen, aar)}</span></div>}</div>{" "}<C.Field label={L('Subject', 'الموضوع')} value={subject} id='msubj' req={true} />{" "}<C.Textarea label={L('Message — English', 'الرسالة — إنكليزي')} id='msgen' max={480} value={body} />{" "}<C.Textarea label={L('Message — Arabic', 'الرسالة — عربي')} id='msgar' max={480} ar={true} value={bodyAr} />{" "}<p className="help">{L('Both versions appear together in the recipient’s in-app message or update.', 'تظهر النسختان معاً في رسالة المستلِم أو المستجد داخل التطبيق.')}</p></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="msend" style={{
        marginInlineStart: "auto"
      }}><Icon name='msg' size={16} />{L('Send in app', 'إرسال داخل التطبيق')}</button></>,
    onMount(el) {
      el.querySelector('#msend').addEventListener('click', async () => {
        const subject = val(el, '#msubj'),
          english = val(el, '#msgen'),
          arabic = val(el, '#msgar');
        if (!need(el, '#msubj', L('Enter a subject', 'أدخل الموضوع')) || !english && !arabic) return toast(L('Enter a subject and message', 'أدخل الموضوع والرسالة'), '', 'warning');
        const message = [english, arabic].filter(Boolean).join('\n\n');
        try {
          if (person) await memberAction('staffMessage', {
            recipientPersonId: person.id,
            title: subject,
            body: message
          });else await memberAction('publish', {
            kind: 'announcement',
            groupId: groupAudience ? val(el, '#mgroup') : null,
            title: subject,
            body: message
          });
          closeOverlays();
          ok(L('Delivered in ParishLife', 'أُرسلت داخل ParishLife'), L(aen, aar));
        } catch (error) {
          toast(L('Message was not delivered', 'لم تُرسَل الرسالة'), error.message, 'danger');
        }
      });
    }
  });
}
export function remind(context = 'rota') {
  toast(L('External reminders are not connected', 'التذكيرات الخارجية غير موصولة'), L('Use in-app announcements for the group, or contact people outside ParishLife.', 'استخدم المستجدات داخل التطبيق للمجموعة، أو تواصل خارج ParishLife.'), 'warning');
}
export function broadcast() {
  toast(L('Emergency broadcast is not connected', 'البثّ الطارئ غير موصول'), L('Use the parish’s established emergency contact procedure. No message was sent from this application.', 'استخدم إجراء الطوارئ المعتمد في الرعية. لم يُرسَل شيء من التطبيق.'), 'warning');
}

/** A person picker in a drawer — invitations, new members, substitutes. */
export function pickPerson({
  title,
  sub = '',
  cta,
  onPick,
  exclude = [],
  allow = null
}) {
  const list = D.PEOPLE.filter(p => !exclude.includes(p.id) && (!allow || allow.includes(p.id)) && p.status !== 'clergy');
  openDrawer({
    title,
    sub,
    body: <><C.SearchClear ph={L('Type a name in either script', 'اكتب الاسم بأي حرف')} id='ppq' />{" "}<div className="stack" id="pplist" style={{
        marginTop: "12px"
      }}>{list.map(p => <label className="listrow" style={{
          paddingInline: "4px",
          cursor: "pointer"
        }} data-name={`${p.lat} ${p.ar} ${p.phone}`}><input type="radio" name="pp" defaultValue={p.id} style={{
            accentColor: "var(--primary)"
          }} />{" "}<Who p={p} /><span className="grow" /><span className="t-caption dim">{L(p.town, p.townAr)}</span></label>)}</div>{" "}<p className="dim" id="ppnone" hidden style={{
        padding: "18px 4px"
      }}>{L('Nobody by that name. Try the other script, or part of the name.', 'لا أحد بهذا الاسم. جرّب الحرف الآخر أو جزءاً من الاسم.')}</p></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="ppgo" disabled style={{
        marginInlineStart: "auto"
      }}>{cta}</button></>,
    onMount(el) {
      const q = el.querySelector('#ppq'),
        goBtn = el.querySelector('#ppgo');
      q.addEventListener('input', () => {
        const rows = [...el.querySelectorAll('#pplist [data-name]')];
        rows.forEach(r => {
          r.hidden = !matches(r.dataset.name, q.value);
        });
        el.querySelector('#ppnone').hidden = rows.some(r => !r.hidden);
      });
      el.querySelectorAll('input[name=pp]').forEach(r => r.addEventListener('change', () => {
        goBtn.disabled = false;
      }));
      goBtn.addEventListener('click', () => {
        const id = el.querySelector('input[name=pp]:checked')?.value;
        if (!id) return;
        closeOverlays();
        onPick(D.person(id));
      });
    }
  });
}
export function invite(context = 'rota', at = '') {
  const target = context === 'rota' && at ? rotaSlot(at) : null;
  if (context === 'rota' && !target) return toast(L('Select a rota role first', 'اختر دوراً في المناوبة أولاً'), '', 'warning');
  const team = context === 'rota' ? rotaTeam(at) : null;
  pickPerson({
    title: context === 'rota' ? L(target.p ? 'Replace assignment' : 'Assign volunteer', target.p ? 'استبدال الإسناد' : 'إسناد متطوّع') : L('Add someone', 'إضافة شخص'),
    sub: context === 'rota' ? `${L(D.ROTA.service, D.ROTA.serviceAr)} · ${D.ROTA.date} · ${L(team.one, team.oneAr)}. ${L('Confirmation must be obtained separately; this screen does not send a message.', 'يجب الحصول على التأكيد بصورة منفصلة؛ هذه الشاشة لا ترسل رسالة.')}` : L('Select an existing parishioner.', 'اختر مؤمناً مسجّلاً.'),
    cta: context === 'rota' ? L('Review assignment', 'مراجعة الإسناد') : L('Add', 'إضافة'),
    allow: context === 'rota' ? D.VOLUNTEERS.map(v => v.p) : undefined,
    onPick: p => {
      if (context === 'rota') {
        if (team.filled.some(slot => slot !== target && slot.p === p.id && slot.s !== 'declined') || D.ROTA.teams.some(other => other !== team && other.filled.some(slot => slot.p === p.id && slot.s !== 'declined'))) return toast(L('Assignment conflict', 'تعارض في الإسناد'), L('This person is already assigned on the same rota date.', 'هذا الشخص مسند بالفعل في تاريخ المناوبة نفسه.'), 'warning');
        const former = target.p ? nameOf(D.person(target.p)) : null;
        openModal({
          title: L('Confirm rota assignment', 'تأكيد إسناد المناوبة'),
          body: <><p><b>{nameOf(p)}</b> · {L(team.team, team.teamAr)} · {L(team.one, team.oneAr)} · {D.ROTA.date}</p>{" "}{former ? <p className="help">{L('Replaces', 'يحلّ محلّ')}: {former}</p> : ''}{" "}<p className="help">{L('This records an assignment awaiting confirmation. Contact the volunteer separately.', 'يسجّل هذا إسناداً بانتظار التأكيد. تواصل مع المتطوّع بصورة منفصلة.')}</p></>,
          foot: <><button className="btn btn-secondary" data-close="">{L('Keep current assignment', 'إبقاء الإسناد الحالي')}</button><button className="btn btn-primary" id="rota-confirm">{L('Save assignment', 'حفظ الإسناد')}</button></>,
          onMount(el) {
            el.querySelector('#rota-confirm').addEventListener('click', () => {
              Object.assign(target, {
                p: p.id,
                s: 'pending',
                swap: undefined
              });
              closeOverlays();
              refresh();
              ok(L('Assignment saved', 'حُفظ الإسناد'), nameOf(p));
            });
          }
        });
        return;
      } else if (context.startsWith('sheet')) {
        const ref = context.split('|')[1];
        const s = ref ? D.SIGNUP_SHEETS.find(x => x.id === ref) : D.SIGNUP_SHEETS.find(x => x.taken < x.slots);
        if (!s || s.taken >= s.slots) return toast(L('That sheet is full', 'هذه اللائحة ممتلئة'), L('Add places to it first.', 'أضف مراكز إليها أولاً.'), 'warning');
        s.taken += 1;
      }
      refresh();
      ok(L('Person added', 'أُضيف الشخص'), nameOf(p));
    }
  });
}

/* ═════════════ portal requests ═════════════ */
function portalApply(r) {
  if (r.kind === 'address') {
    const h = D.HOUSEHOLDS.find(x => x.id === r.hh);
    if (!h) return () => {};
    const was = {
      address: h.address,
      addressAr: h.addressAr
    };
    Object.assign(h, {
      address: r.to,
      addressAr: r.toAr
    });
    return () => Object.assign(h, was);
  }
  const h = {
    id: 'h' + Date.now().toString(36),
    name: r.name,
    ar: r.nameAr,
    head: null,
    members: [],
    town: r.town,
    townAr: r.townAr,
    envelope: '',
    address: '',
    addressAr: '',
    family: null,
    branch: null
  };
  D.HOUSEHOLDS.unshift(h);
  return () => {
    const i = D.HOUSEHOLDS.indexOf(h);
    if (i > -1) D.HOUSEHOLDS.splice(i, 1);
  };
}
export function portalDecide(id, accept) {
  const i = D.PORTAL_REQUESTS.findIndex(x => x.id === id);
  if (i < 0) return;
  const [r] = D.PORTAL_REQUESTS.splice(i, 1);
  const undoApply = accept ? portalApply(r) : () => {};
  const outcome = {
    id: r.id,
    kind: 'portal',
    title: r.what,
    titleAr: r.whatAr,
    by: r.by || null,
    status: accept ? 'approved' : 'rejected',
    at: new Date().toISOString()
  };
  D.REQUEST_HISTORY.unshift(outcome);
  closeOverlays();
  refresh();
  toast(accept ? L('Change accepted', 'اعتُمد التعديل') : L('Change declined', 'رُفض التعديل'), accept ? L(`${r.what} — the record is updated and the family has been told.`, `${r.whatAr} — حُدّث السجل وأُبلغت العائلة.`) : L('The family is told the change was not applied.', 'تُبلَّغ العائلة بأن التعديل لم يُطبَّق.'), accept ? 'success' : '', {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        undoApply();
        D.PORTAL_REQUESTS.splice(i, 0, r);
        const j = D.REQUEST_HISTORY.findIndex(x => x.id === outcome.id);
        if (j >= 0) D.REQUEST_HISTORY.splice(j, 1);
        refresh();
      }
    }
  });
}
export function portalCompare(id) {
  const r = D.PORTAL_REQUESTS.find(x => x.id === id);
  if (!r) return;
  const col = (label, text) => <div className="card card-flat"><div className="overline">{label}</div>{" "}<p style={{
      font: "400 14px/22px var(--sans)",
      marginTop: "6px"
    }}>{text ? text : <span className="dim">{L('Nothing on record yet', 'لا شيء في السجل بعد')}</span>}</p></div>;
  openModal({
    title: L(r.what, r.whatAr),
    sub: `${L('Submitted from the member portal', 'مُرسل من بوّابة المؤمنين')} · ${fmtDate(r.at)}`,
    body: <div className="grid g2" style={{
      gap: "12px"
    }}>{col(L('On record', 'في السجل'), L(r.now, r.nowAr))}{col(L('Submitted', 'المُرسَل'), L(r.to, r.toAr))}</div>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-danger-quiet" id="pq_no" style={{
        marginInlineStart: "auto"
      }}>{L('Decline', 'رفض')}</button>{" "}<button className="btn btn-primary" id="pq_yes">{L('Accept', 'قبول')}</button></>,
    onMount(el) {
      el.querySelector('#pq_no').addEventListener('click', () => portalDecide(id, false));
      el.querySelector('#pq_yes').addEventListener('click', () => portalDecide(id, true));
    }
  });
}

/* ═════════════ archive ═════════════
   Archiving removes active-directory visibility while preserving related history. */
export function archivePeople(ids) {
  const moved = ids.map(id => D.PEOPLE.find(x => x.id === id)).filter(Boolean).map(p => [D.PEOPLE.indexOf(p), p]);
  if (!moved.length) return;
  moved.forEach(([, p]) => {
    D.PEOPLE.splice(D.PEOPLE.indexOf(p), 1);
    Object.assign(p, {
      archived: today,
      archivedBy: me()?.id || 'p17'
    });
    D.ARCHIVED.unshift(p);
  });
  refresh();
  toast(moved.length === 1 ? L(`${moved[0][1].lat} archived`, `أُرشف ${moved[0][1].ar}`) : L(`${moved.length} records archived`, `أُرشف ${moved.length} سجلات`), L('Removed from active People lists. Linked records remain and this person can be restored.', 'أُزيل من لوائح المؤمنين النشطة. تبقى السجلات المرتبطة ويمكن استرجاع الشخص.'), '', {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        moved.sort((a, b) => a[0] - b[0]).forEach(([i, p]) => {
          D.ARCHIVED.splice(D.ARCHIVED.indexOf(p), 1);
          delete p.archived;
          delete p.archivedBy;
          delete p.deletionRequested;
          D.PEOPLE.splice(i, 0, p);
        });
        refresh();
      }
    }
  });
}
export function restorePerson(id) {
  const p = D.ARCHIVED.find(x => x.id === id);
  if (!p) return;
  const i = D.ARCHIVED.indexOf(p),
    was = {
      archived: p.archived,
      archivedBy: p.archivedBy,
      deletionRequested: p.deletionRequested
    };
  D.ARCHIVED.splice(i, 1);
  delete p.archived;
  delete p.archivedBy;
  delete p.deletionRequested;
  D.PEOPLE.unshift(p);
  refresh();
  ok(L('Record restored', 'استُرجع السجل'), L(`${p.lat} is back in the parish lists.`, `عاد ${p.ar} إلى لوائح الرعية.`), {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        D.PEOPLE.splice(D.PEOPLE.indexOf(p), 1);
        Object.assign(p, was);
        D.ARCHIVED.splice(i, 0, p);
        refresh();
      }
    }
  });
}

/* ═════════════ rota board ═════════════
   A place is addressed as "team|slot" on D.ROTA.teams. Every change keeps a
   snapshot so the toast can offer Undo. */
const rotaSlot = at => {
  const [ti, si] = at.split('|').map(Number);
  return D.ROTA.teams[ti]?.filled[si];
};
const rotaTeam = at => D.ROTA.teams[+at.split('|')[0]];
const rotaSnap = () => {
  const snap = D.ROTA.teams.map(tm => tm.filled.map(f => ({
    ...f
  })));
  return () => {
    D.ROTA.teams.forEach((tm, i) => {
      tm.filled = snap[i];
    });
    refresh();
  };
};
const undo = fn => ({
  action: {
    label: L('Undo', 'تراجع'),
    fn
  }
});
export function rotaRemove(at) {
  const slot = rotaSlot(at);
  if (!slot?.p) return;
  const restore = rotaSnap(),
    name = nameOf(D.person(slot.p));
  openModal({
    title: L('Remove this assignment?', 'إزالة هذا الإسناد؟'),
    body: <><p>{name}</p><p className="help">{L('The role becomes unfilled. The person remains on the volunteer list.', 'يصبح الدور شاغراً ويبقى الشخص في لائحة المتطوّعين.')}</p></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Keep assignment', 'إبقاء الإسناد')}</button><button className="btn btn-danger" id="rota-remove-confirm">{L('Remove assignment', 'إزالة الإسناد')}</button></>,
    onMount(el) {
      el.querySelector('#rota-remove-confirm').addEventListener('click', () => {
        Object.assign(slot, {
          p: null,
          s: 'open',
          swap: undefined
        });
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
  if (from.p && !free) return toast(L('Use Replace to review this change', 'استعمل الاستبدال لمراجعة التغيير'), L('The current assignment will not be overwritten by dragging.', 'لن يُستبدل الإسناد الحالي بالسحب.'), 'warning');
  if (D.ROTA.teams.some(other => other.filled.some(f => f !== dst && (!from.at || f !== rotaSlot(from.at)) && f.p === who && f.s !== 'declined'))) return toast(L('Assignment conflict', 'تعارض في الإسناد'), nameOf(D.person(who)), 'warning');
  if (from.p) {
    Object.assign(dst, {
      p: from.p,
      s: 'pending',
      swap: undefined
    });
    refresh();
    return ok(L('Assignment awaiting confirmation', 'إسناد بانتظار التأكيد'), `${nameOf(D.person(from.p))} · ${L(team.team, team.teamAr)}`, undo(restore));
  }
  const src = rotaSlot(from.at),
    moved = {
      ...src
    };
  Object.assign(src, free ? {
    p: null,
    s: 'open',
    swap: undefined
  } : {
    p: dst.p,
    s: dst.s,
    swap: dst.swap
  });
  Object.assign(dst, moved);
  refresh();
  ok(free ? L(`Moved to ${team.team}`, `نُقل إلى ${team.teamAr}`) : L('Places swapped', 'تبادلا المركزين'), free ? nameOf(D.person(moved.p)) : `${nameOf(D.person(moved.p))} ⇄ ${nameOf(D.person(src.p))}`, undo(restore));
}
export function rotaSwap(anchor, at) {
  const f = rotaSlot(at),
    team = rotaTeam(at),
    by = D.person(f.p),
    to = D.person(f.swap);
  openMenu(anchor, [{
    head: L(`${nameOf(by)} asks to swap with ${nameOf(to)}`, `${nameOf(by)} يطلب التبديل مع ${nameOf(to)}`)
  }, {
    label: L(`Approve — ${nameOf(to)} serves`, `موافقة — يخدم ${nameOf(to)}`),
    icon: 'check',
    fn: () => {
      const restore = rotaSnap();
      Object.assign(f, {
        p: f.swap,
        s: 'accepted',
        swap: undefined
      });
      refresh();
      ok(L('Swap approved', 'تمّت الموافقة على التبديل'), `${nameOf(to)} · ${L(team.team, team.teamAr)}`, undo(restore));
    }
  }, {
    label: L(`Decline — ${nameOf(by)} stays on`, `رفض — يبقى ${nameOf(by)}`),
    icon: 'close',
    fn: () => {
      const restore = rotaSnap();
      f.swap = undefined;
      refresh();
      toast(L('Swap declined', 'رُفض التبديل'), L(`${nameOf(by)} is told on WhatsApp.`, `يُبلَّغ ${nameOf(by)} عبر واتساب.`), '', undo(restore));
    }
  }], {
    width: 280
  });
}

/* ═════════════ sharing & documents ═════════════ */
export function share({
  title,
  url = location.href,
  text = ''
}) {
  const wa = `https://wa.me/?text=${encodeURIComponent((text ? text + ' ' : '') + url)}`;
  openModal({
    title: L('Share', 'مشاركة'),
    sub: title,
    body: <><div className="formrow"><label className="label">{L('Link', 'الرابط')}</label>{" "}<div className="field"><input className="value" id="shurl" readOnly defaultValue={url} dir="ltr" style={{
            border: 0,
            background: "none",
            width: "100%",
            font: "400 13px/1 var(--mono)"
          }} />{" "}<button className="btn btn-ghost btn-dense" id="shcopy" style={{
            borderRadius: 0
          }}>{L('Copy', 'نسخ')}</button></div></div>{" "}<div className="grid g3" style={{
        gap: "10px"
      }}><a className="card card-flat" href={wa} target="_blank" rel="noopener" style={{
          textAlign: "center",
          padding: "16px 10px"
        }}><span style={{
            color: "var(--success)"
          }}><Icon name='msg' size={22} /></span><b style={{
            display: "block",
            font: "500 13px/18px var(--sans)",
            marginTop: "6px"
          }}>WhatsApp</b></a>{" "}<a className="card card-flat" href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`} style={{
          textAlign: "center",
          padding: "16px 10px"
        }}><span style={{
            color: "var(--primary)"
          }}><Icon name='msg' size={22} /></span><b style={{
            display: "block",
            font: "500 13px/18px var(--sans)",
            marginTop: "6px"
          }}>{L('Email', 'بريد')}</b></a>{" "}<button className="card card-flat" id="shprint" style={{
          textAlign: "center",
          padding: "16px 10px",
          cursor: "pointer"
        }}><span style={{
            color: "var(--text-2)"
          }}><Icon name='print' size={22} /></span><b style={{
            display: "block",
            font: "500 13px/18px var(--sans)",
            marginTop: "6px"
          }}>{L('Print', 'طباعة')}</b></button></div></>,
    onMount(el) {
      el.querySelector('#shcopy').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          el.querySelector('#shurl').select();
          document.execCommand('copy');
        }
        ok(L('Link copied', 'نُسخ الرابط'));
      });
      el.querySelector('#shprint').addEventListener('click', () => {
        closeOverlays();
        setTimeout(() => window.print(), 250);
      });
    }
  });
}
const docShell = (title, inner) => `<!doctype html><html lang="${isAr() ? 'ar' : 'en'}" dir="${isAr() ? 'rtl' : 'ltr'}"><head>
  <meta charset="utf-8"><title>${title}</title>
  <style>body{font:14px/1.6 Inter,system-ui,sans-serif;color:#233B32;background:#FFFFFF;margin:0;padding:32px}
  .page{max-width:720px;margin:0 auto 24px;background:#FFFFFF;border:1px solid #EDF0E8;padding:40px;page-break-after:always}
  h1{font-size:20px;margin:0 0 4px} .muted{color:#233B32} table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{padding:8px 10px;border-bottom:1px solid #EDF0E8;text-align:start} th{background:#F7F7F2;font-size:11px;
  text-transform:uppercase;letter-spacing:.06em} .num{text-align:end;font-family:ui-monospace,monospace}
  .rule{border-top:2px solid #233B32;margin:14px 0} @media print{body{background:#FFFFFF;padding:0}.page{border:0}}</style>
  </head><body>${markup(inner)}</body></html>`;

/** Preview a document the parish holds, with print and download. */
export function previewDoc(name, kind = 'file') {
  openDrawer({
    title: name,
    body: <C.InlineAlert tone='warning' title={L('Digital file unavailable', 'الملف الرقمي غير متاح')} body={L('This legacy record contains a filename but no stored file. Ask the office for the original, or upload it to the appropriate person or group record.', 'يحتوي السجل القديم على اسم الملف فقط دون نسخة محفوظة. اطلب الأصل من المكتب أو ارفعه إلى سجل الشخص أو المجموعة المناسب.')} />,
    foot: <button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>
  });
}

/* ═════════════ real file generators ═════════════ */
const ics = s => s.replace(/[,;\\]/g, m => '\\' + m);
export function downloadICS() {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ParishLife//Saint Elias//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${ics(D.PARISH.name)} — ParishLife`, 'X-WR-TIMEZONE:Asia/Beirut'];
  D.EVENTS.forEach(e => {
    const [h, m] = e.t.split(':').map(Number);
    const d = e.d.replace(/-/g, ''),
      start = `${d}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
    const end = `${d}T${String(h + 1).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
    const v = D.venue(e.venue);
    lines.push('BEGIN:VEVENT', `UID:${e.id}@saint-elias.parishlife`, `DTSTAMP:20261004T190000Z`, `DTSTART;TZID=Asia/Beirut:${start}`, `DTEND;TZID=Asia/Beirut:${end}`, `SUMMARY:${ics(L(e.title, e.titleAr))}`, `LOCATION:${ics(v ? v.name : '')}, Saint Elias, Hadath`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  download('saint-elias-calendar.ics', lines.join('\r\n'), 'text/calendar;charset=utf-8');
  ok(L('Calendar downloaded', 'نُزّلت الرزنامة'), L(`${D.EVENTS.length} events · open the file to add them to Google, Outlook or Apple Calendar.`, `${D.EVENTS.length} حدثاً · افتح الملف لإضافتها إلى غوغل أو أوتلوك أو آبل.`));
}
function receiptHTML(no, p, amount, at) {
  return <div className="page"><h1>{L('Receipt', 'إيصال')}{" "}{no}</h1>{" "}<p className="muted">{L(D.PARISH.name, D.PARISH.nameAr)} · {L(D.PARISH.eparchy, D.PARISH.eparchyAr)}</p><div className="rule" />{" "}<table><tr><th>{L('Received from', 'استُلم من')}</th><td>{p ? p.ar + ' · ' + p.lat : L('Anonymous', 'مجهول')}</td></tr><tr><th>{L('Date', 'التاريخ')}</th><td>{fmtDate(at)}</td></tr><tr><th>USD</th><td className="num">{usd(amount)}</td></tr><tr><th>L.L</th><td className="num">{num(amount * D.RATE.value)}{" "}{L('at', 'على سعر')}{" "}{num(D.RATE.value)}</td></tr></table>{" "}<p className="muted" style={{
      marginTop: "18px",
      fontSize: "12px"
    }}>{L('A record of a gift to the parish. Not a tax document.', 'سجلّ تقدمة للرعية. ليس مستنداً ضريبياً.')}</p></div>;
}
export function receipt(no, pid, amount, at = today) {
  const p = D.person(pid);
  openDrawer({
    title: L('Receipt', 'إيصال') + ' ' + no,
    sub: `${nameOf(p) || L('Anonymous', 'مجهول')} · ${usd(amount)}`,
    body: <div className="a4frame"><div style={{
        display: "flex",
        justifyContent: "center"
      }}><div className="a4" style={{
          aspectRatio: "auto",
          maxWidth: "380px",
          padding: "28px",
          alignItems: "stretch",
          textAlign: "start"
        }}><div className="row" style={{
            gap: "10px"
          }}><span className="seal-lg" style={{
              width: "36px",
              height: "36px",
              margin: 0
            }} aria-hidden="true"><Icon name='cross' size={18} /></span>{" "}<div><b style={{
                font: "600 14px/18px var(--sans)"
              }}>{L(D.PARISH.name, D.PARISH.nameAr)}</b>{" "}<div className="t-caption dim">{L('Receipt', 'إيصال')}{" "}<span className="mono">{no}</span></div></div></div>{" "}<div className="divider" />{" "}<dl className="dl" style={{
            fontSize: "13px"
          }}><dt>{L('Received from', 'استُلم من')}</dt><dd>{nameOf(p) || L('Anonymous', 'مجهول')}</dd><dt>{L('Date', 'التاريخ')}</dt><dd className="mono">{fmtDate(at)}</dd></dl>{" "}<div className="divider" />{" "}{C.ratePopover ? <div className="amount" dir="ltr"><span className="usd">{usd(amount)}</span>{" "}<span className="lbp">L.L {num(amount * D.RATE.value)}</span>{" "}<span className="rate">at {num(D.RATE.value)} · {fmtDate(D.RATE.setOn)}</span></div> : ''}{" "}<p className="t-caption dim" style={{
            marginTop: "16px"
          }}>{L('A record of a gift to the parish. Not a tax document.', 'سجلّ تقدمة للرعية. ليس مستنداً ضريبياً.')}</p></div></div></div>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-secondary" id="rcshare"><Icon name='msg' size={16} />{L('Send', 'إرسال')}</button>{" "}<button className="btn btn-secondary" id="rcprint"><Icon name='print' size={16} />{L('Print', 'طباعة')}</button>{" "}<button className="btn btn-primary" id="rcdl" style={{
        marginInlineStart: "auto"
      }}><Icon name='export' size={16} />{L('Download', 'تنزيل')}</button></>,
    onMount(el) {
      el.querySelector('#rcprint').addEventListener('click', () => {
        closeOverlays();
        setTimeout(() => window.print(), 250);
      });
      el.querySelector('#rcdl').addEventListener('click', () => {
        download(`receipt-${no}.html`, docShell('Receipt ' + no, receiptHTML(no, p, amount, at)), 'text/html');
        ok(L('Receipt downloaded', 'نُزّل الإيصال'), `receipt-${no}.html`);
      });
      el.querySelector('#rcshare').addEventListener('click', () => {
        closeOverlays();
        share({
          title: L('Receipt', 'إيصال') + ' ' + no,
          text: L('Your receipt from Saint Elias', 'إيصالك من مار الياس')
        });
      });
    }
  });
}
function statementRows(pid) {
  return D.BATCH.lines.filter(line => line.p === pid);
}
function statementHTML(pid) {
  const p = D.person(pid),
    rows = statementRows(pid),
    totalUsd = rows.reduce((a, r) => a + (r.usd || 0), 0),
    totalLbp = rows.reduce((a, r) => a + (r.lbp || 0), 0);
  return <div className="page"><h1>{L('Current counting-session statement', 'كشف جلسة العدّ الحالية')}</h1>{" "}<p className="muted">{p ? p.lat + ' · ' + p.ar : ''} · {L(D.PARISH.name, D.PARISH.nameAr)} · {D.BATCH.date}</p><div className="rule" />{" "}<table><thead><tr><th>{L('Fund', 'الصندوق')}</th><th className="num">USD</th><th className="num">L.L</th></tr></thead><tbody>{rows.map(r => {
          const f = D.FUNDS.find(x => x.id === r.fund);
          return <tr><td>{f ? L(f.name, f.ar) : r.fund}</td><td className="num">{r.usd ? usd(r.usd) : '—'}</td><td className="num">{r.lbp ? num(r.lbp) : '—'}</td></tr>;
        })}<tr><th>{L('Total', 'المجموع')}</th><th className="num">{usd(totalUsd)}</th><th className="num">{num(totalLbp)}</th></tr></tbody></table>{" "}<p className="muted" style={{
      marginTop: "18px",
      fontSize: "12px"
    }}>{L('Only recorded gifts from this counting session are shown. Not a full-year or tax statement.', 'تظهر فقط التقدمات المسجّلة في جلسة العدّ الحالية. ليس كشف سنة كاملة ولا مستنداً ضريبياً.')}</p></div>;
}
export function statement(pid) {
  const p = D.person(pid);
  download(`statement-${D.BATCH.id}-${(p?.lat || 'household').toLowerCase().replace(/\s+/g, '-')}.html`, docShell('Statement', statementHTML(pid)), 'text/html');
  ok(L('Statement downloaded', 'نُزّل الكشف'), `${nameOf(p)} · ${D.BATCH.date}`);
}
export function statementsAll() {
  const heads = D.HOUSEHOLDS.map(h => h.head);
  let n = 0;
  openModal({
    title: L('Generating statements', 'إصدار الكشوفات'),
    sub: L('One page per household contact, showing only their recorded gifts in the current counting session.', 'صفحة لكل مسؤول عائلة تعرض فقط تقدماته المسجّلة في جلسة العدّ الحالية.'),
    body: <><div className="row" style={{
        gap: "10px"
      }}><span className="spinner" /><span className="t-ui" id="sgtext">0 / {heads.length}</span></div>{" "}<span className="progress" style={{
        marginTop: "12px"
      }}><i id="sgbar" style={{
          width: "0%"
        }} /></span></>,
    onMount(el) {
      const text = el.querySelector('#sgtext'),
        bar = el.querySelector('#sgbar');
      const tick = setInterval(() => {
        /* closing the dialog cancels the run — nothing half-generated is downloaded */
        if (!text.isConnected) return clearInterval(tick);
        n += 1;
        text.textContent = `${n} / ${heads.length}`;
        bar.style.width = `${Math.round(n / heads.length * 100)}%`;
        if (n >= heads.length) {
          clearInterval(tick);
          download('statements-2026-saint-elias.html', docShell('Statements 2026', heads.map(statementHTML)), 'text/html');
          closeOverlays();
          ok(L('Statements ready', 'الكشوفات جاهزة'), `${heads.length} ${L('households', 'عائلات')} · statements-2026-saint-elias.html`);
        }
      }, 260);
    }
  });
}
export function slides() {
  const plan = currentPlan();
  const file = `${plan.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'service'}-slides.html`;
  const deck = plan.order.map((o, i) => <section className="s"><div className="k">{i + 1} / {plan.order.length}</div>{" "}<h2>{o.t}</h2><p className="ar">{o.ar}</p></section>);
  download(file, `<!doctype html><html><head><meta charset="utf-8"><title>Slides</title>
    <style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:#233B32}
    .s{height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;
      color:#FFFFFF;border-bottom:1px solid #233B32;page-break-after:always;padding:0 8vw}
    .k{color:#EDF0E8;font:500 14px ui-monospace,monospace;letter-spacing:.1em}
    h2{font-size:5vw;margin:.4em 0 .2em;font-weight:600}.ar{font-size:4vw;color:#EDF0E8;margin:0}</style></head>
    <body><section class="s"><div class="k">${D.PARISH.name.toUpperCase()}</div><h2>${L(plan.title, plan.titleAr)}</h2>
    <p class="ar">${D.PARISH.nameAr}</p></section>${markup(deck)}</body></html>`, 'text/html');
  closeOverlays();
  ok(L('Slides generated', 'تمّ توليد الشرائح'), `${plan.order.length + 1} ${L('slides', 'شريحة')}`);
}

/** Ready-made parish design: fill date and place, then export the rendered design. */
export function designTemplate(i) {
  const tp = D.TEMPLATES[+i] || D.TEMPLATES[0];
  const svg = (date, place, width = '600', height = '800') => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width={width} height={height}><rect width="600" height="800" fill="#233B32" /><rect x="28" y="28" width="544" height="744" fill="none" stroke="#EDF0E8" strokeOpacity=".45" />{" "}<text x="300" y="130" fill="#EDF0E8" fontFamily="Inter,Arial" fontSize="18" letterSpacing="4" textAnchor="middle">{D.PARISH.name.toUpperCase()}</text>{" "}<text x="300" y="170" fill="#EDF0E8" fillOpacity=".7" fontFamily="Arial" fontSize="22" textAnchor="middle">{D.PARISH.nameAr}</text>{" "}<text x="300" y="380" fill="#FFFFFF" fontFamily="Inter,Arial" fontSize="52" fontWeight="600" textAnchor="middle">{tp.name}</text>{" "}<text x="300" y="440" fill="#FFFFFF" fillOpacity=".8" fontFamily="Arial" fontSize="34" textAnchor="middle">{tp.ar}</text>{" "}<line x1="220" y1="500" x2="380" y2="500" stroke="#EDF0E8" />{" "}<text x="300" y="560" fill="#FFFFFF" fontFamily="Inter,Arial" fontSize="26" textAnchor="middle">{date}</text>{" "}<text x="300" y="600" fill="#FFFFFF" fillOpacity=".75" fontFamily="Inter,Arial" fontSize="20" textAnchor="middle">{place}</text>{" "}<text x="300" y="720" fill="#EDF0E8" fillOpacity=".6" fontFamily="Inter,Arial" fontSize="14" textAnchor="middle">Hadath · Maronite</text></svg>;
  openDrawer({
    large: true,
    title: L(tp.name, tp.ar),
    sub: L('The parish name is already on it. Fill in the date and place, then download.', 'اسم الرعية موجود. املأ التاريخ والمكان ثم نزّل التصميم.'),
    body: <div className="grid g2" style={{
      gap: "20px",
      alignItems: "start"
    }}><div><C.Field label={L('Date and time', 'التاريخ والوقت')} value={L('Thursday 24 December, 23:00', 'الخميس ٢٤ كانون الأول، ٢٣:٠٠')} id='dgdate' />{" "}<C.Field label={L('Place', 'المكان')} value={L('Upper Church, Saint Elias', 'الكنيسة العليا، مار الياس')} id='dgplace' />{" "}<C.InlineAlert tone='info' title={L('Print or share', 'اطبع أو شارك')} body={L('The file is a vector, so it prints sharp at A4 or A3.', 'الملف متّجهي، فيُطبع واضحاً على A4 أو A3.')} /></div>{" "}<div id="dgprev" style={{
        borderRadius: "var(--r-card)",
        overflow: "hidden",
        boxShadow: "var(--e2)"
      }} /></div>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<Select id="dgformat" aria-label={L('Download format', 'صيغة التنزيل')} style={{
        width: "auto",
        marginInlineStart: "auto"
      }}><option value="svg">SVG</option><option value="png">PNG</option><option value="jpeg">JPEG</option></Select>{" "}<button className="btn btn-primary" id="dgdl"><Icon name='export' size={16} />{L('Download', 'تنزيل')}</button></>,
    onMount(el) {
      /* the preview is drawn by React as the fields change; the download is that drawing at full size */
      const prev = el.querySelector('#dgprev');
      const draw = () => paint(prev, svg(val(el, '#dgdate'), val(el, '#dgplace'), '100%', undefined));
      const artworkOf = () => {
        const art = prev.querySelector('svg').cloneNode(true);
        art.setAttribute('width', '600');
        art.setAttribute('height', '800');
        return new XMLSerializer().serializeToString(art);
      };
      el.querySelectorAll('#dgdate,#dgplace').forEach(i2 => i2.addEventListener('input', draw));
      draw();
      el.querySelector('#dgdl').addEventListener('click', async () => {
        const format = val(el, '#dgformat'),
          base = tp.name.toLowerCase().replace(/\s+/g, '-');
        const artwork = artworkOf();
        if (format === 'svg') {
          download(`${base}.svg`, artwork, 'image/svg+xml');
          ok(L('Design downloaded', 'نُزّل التصميم'), `${base}.svg`);
          return;
        }
        const url = URL.createObjectURL(new Blob([artwork], {
          type: 'image/svg+xml;charset=utf-8'
        }));
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const canvas = document.createElement('canvas');
          canvas.width = 1200;
          canvas.height = 1600;
          const context = canvas.getContext('2d');
          if (format === 'jpeg') {
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);
          }
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
          const blob = await new Promise(resolve => canvas.toBlob(resolve, type, .94));
          if (!blob) throw new Error('Could not render the image.');
          const link = document.createElement('a'),
            output = URL.createObjectURL(blob);
          link.href = output;
          link.download = `${base}.${format}`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(output), 1000);
          ok(L('Design downloaded', 'نُزّل التصميم'), link.download);
        } catch (error) {
          toast(L('Could not export image', 'تعذّر تصدير الصورة'), error.message, 'danger');
        } finally {
          URL.revokeObjectURL(url);
        }
      });
    }
  });
}

/* ═════════════ people & records ═════════════ */
export function recordChooser() {
  openModal({
    title: L('New record', 'سجل جديد'),
    sub: L('What are you adding?', 'ماذا تضيف؟'),
    body: <div className="grid g2" style={{
      gap: "10px"
    }}>{[['people', L('Parishioner', 'مؤمن'), 'people', 'newperson'], ['family', L('Household', 'عائلة'), 'households', 'hhnew'], ['sacr', L('Sacrament request', 'طلب سرّ'), 'requests', 'newsacreq'], ['events', L('Event', 'حدث'), 'calendar', 'evnew'], ['rooms', L('Room request', 'طلب قاعة'), 'reservations', 'newres'], ['give', L('Counting session', 'جلسة عدّ'), 'giving', 'addenv']].map(([ic, lab, route, trigger]) => <button className="card card-flat" data-choose={`${route}|${trigger}`} style={{
        cursor: "pointer",
        textAlign: "start",
        padding: "16px",
        display: "flex",
        gap: "12px",
        alignItems: "center"
      }}><span className="avatar"><Icon name={ic} size={17} /></span><b style={{
          font: "500 14px/20px var(--sans)"
        }}>{lab}</b></button>)}</div>,
    onMount(el) {
      el.querySelectorAll('[data-choose]').forEach(b => b.addEventListener('click', () => {
        const [route, trigger] = b.dataset.choose.split('|');
        closeOverlays();
        go(route);
        setTimeout(() => (document.getElementById(trigger) || document.querySelector(`[data-act="${trigger}"],[data-split]`))?.click(), 260);
      }));
    }
  });
}
export function personEdit(id) {
  const p = D.person(id);
  if (!p) return;
  openDrawer({
    large: true,
    title: L('Edit record', 'تعديل السجل'),
    sub: p.lat + ' · ' + p.ar,
    body: <><div className="formgrid"><C.Field label={L('English name', 'الاسم الإنكليزي')} req={true} value={p.lat} dir='ltr' id='e_lat' />{" "}<C.Field label={L('Arabic name', 'الاسم العربي')} req={true} value={p.ar} dir='rtl' ar={true} id='e_ar' />{" "}<C.Field label={L('Date of birth', 'تاريخ الولادة')} type='date' value={p.born} id='e_born' />{" "}<div className="formrow"><label className="label">{L('Status', 'الحالة')}</label>{" "}<Select id="e_st">{[['member', 'Member', 'منتسب'], ['visitor', 'Visitor', 'زائر'], ['clergy', 'Clergy', 'إكليروس']].map(([v, en, ar]) => <option value={v} selected={!!(p.status === v)}>{L(en, ar)}</option>)}</Select></div></div>{" "}<C.PhoneField value={p.phone === '—' ? '' : p.phone} id='e_ph' />{" "}<C.Field label={L('Line of work', 'المهنة')} value={D.PERSON_EXTRA[p.id]?.occupation || ''} id='e_occupation' />{" "}<div className="formrow"><label className="label">{L('Photo', 'الصورة')}</label><C.AvatarUpload k={p.id} /></div>{" "}<C.AddressCascade value={{
        town: p.town,
        ...(D.PERSON_EXTRA[p.id]?.address || {})
      }} /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="e_save" style={{
        marginInlineStart: "auto"
      }}>{L('Save changes', 'حفظ التعديلات')}</button></>,
    onMount(el) {
      el.querySelector('#e_save').addEventListener('click', async e => {
        if (!need(el, '#e_lat', L('Enter the English name', 'أدخل الاسم الإنكليزي')) || !need(el, '#e_ar', L('Enter the Arabic name', 'أدخل الاسم العربي'))) return;
        e.currentTarget.disabled = true;
        const target = D.person(id),
          address = readAddressCascade(el);
        Object.assign(target, {
          ar: val(el, '#e_ar'),
          lat: val(el, '#e_lat'),
          born: val(el, '#e_born'),
          status: el.querySelector('#e_st').value,
          phone: val(el, '#e_ph') || '—',
          town: address.town,
          townAr: address.townAr
        });
        D.PERSON_EXTRA[id] ||= {};
        D.PERSON_EXTRA[id].address = address;
        D.PERSON_EXTRA[id].occupation = val(el, '#e_occupation').slice(0, 120);
        if (!(await persist())) {
          el.querySelector('#e_save').disabled = false;
          return;
        }
        closeOverlays();
        refresh();
        ok(L('Record saved', 'حُفظ السجل'), `${target.lat} · ${target.ar}`);
      });
    }
  });
}

/* How someone sits in a household: the tree draws parents above the head's row, children and
   grandchildren below, and guardians and other relatives beside it. */
export const RELS = [['head', 'Head of household', 'ربّ العائلة'], ['father', 'Father', 'أب'], ['mother', 'Mother', 'أم'], ['parent', 'Parent', 'والد/والدة'], ['spouse', 'Spouse', 'زوج/زوجة'], ['son', 'Son', 'ابن'], ['daughter', 'Daughter', 'ابنة'], ['sibling', 'Brother or sister', 'أخ/أخت'], ['child', 'Child', 'ابن/ابنة'], ['grandchild', 'Grandchild', 'حفيد/حفيدة'], ['guardian', 'Guardian', 'وصيّ'], ['relative', 'Other relative', 'قريب آخر']];
export const relOf = (p, h) => p.rel || (h?.head === p.id ? 'head' : 'relative');
const relSelect = (id, cur) => <Select id={id}>{RELS.map(([v, en, ar]) => <option value={v} selected={!!(v === cur)}>{L(en, ar)}</option>)}</Select>;

/* Put a person in a household (taking them out of any other one) and return how to undo it. */
function joinHousehold(p, h, rel, emergency) {
  const prev = D.HOUSEHOLDS.find(x => x.members.includes(p.id));
  const before = {
    p: {
      hh: p.hh,
      rel: p.rel,
      emergency: p.emergency
    },
    prev: prev && {
      members: prev.members.slice(),
      head: prev.head
    },
    h: {
      members: h.members.slice(),
      head: h.head
    }
  };
  if (prev && prev !== h) {
    prev.members = prev.members.filter(m => m !== p.id);
    if (prev.head === p.id) prev.head = prev.members[0] || null;
  }
  if (!h.members.includes(p.id)) h.members.push(p.id);
  Object.assign(p, {
    hh: h.id,
    rel,
    emergency
  });
  if (rel === 'head') h.head = p.id;else if (h.head === p.id) h.head = h.members.find(m => m !== p.id) || null;
  return () => {
    Object.assign(p, before.p);
    if (prev) Object.assign(prev, before.prev);
    Object.assign(h, before.h);
  };
}
export function relationEdit(pid) {
  const p = D.person(pid);
  if (!p) return;
  const h = D.HOUSEHOLDS.find(x => x.id === p.hh);
  openModal({
    title: L('Relationship', 'صلة القرابة'),
    sub: nameOf(p) + (h ? ` · ${L(h.name, h.ar)}` : ''),
    body: <><div className="formrow"><label className="label" htmlFor="relsel">{L('Relationship', 'صلة القرابة')}</label>{relSelect('relsel', relOf(p, h))}</div>{" "}{h ? <div className="formrow"><label className="label" htmlFor="relto">{L('Related to', 'صلة بـ')}</label><Select id="relto"><option value="">{L('Not specified', 'غير محدد')}</option>{h.members.filter(mid => mid !== p.id).map(mid => {
            const m = D.person(mid);
            return <option value={mid} selected={!!(p.relativeTo === mid)}>{nameOf(m)}</option>;
          })}</Select></div> : ''}{" "}<div className="stack" style={{
        gap: "10px"
      }}><C.CheckRow label={L('Emergency contact', 'جهة اتصال في الطوارئ')} checked={!!p.emergency} id='rel_em' />{" "}<C.CheckRow label={L('May collect children', 'مفوَّض باستلام الأطفال')} checked={!!p.canCollect} id='rel_cc' /></div></>,
    foot: <>{h ? <button className="btn btn-danger-quiet" id="relout">{L('Remove from household', 'إخراج من العائلة')}</button> : ''}{" "}<button className="btn btn-secondary" data-close="" style={{
        marginInlineStart: "auto"
      }}>{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="relok">{L('Save', 'حفظ')}</button></>,
    onMount(el) {
      el.querySelector('#relok').addEventListener('click', () => {
        const canCollect = p.canCollect,
          oldRelativeTo = p.relativeTo;
        const undo = h ? joinHousehold(p, h, el.querySelector('#relsel').value, el.querySelector('#rel_em').checked) : (() => {
          const b = {
            rel: p.rel,
            emergency: p.emergency
          };
          p.rel = el.querySelector('#relsel').value;
          p.emergency = el.querySelector('#rel_em').checked;
          return () => Object.assign(p, b);
        })();
        if (h) p.relativeTo = el.querySelector('#relto')?.value || null;
        p.canCollect = el.querySelector('#rel_cc').checked;
        closeOverlays();
        refresh();
        ok(L('Relationship saved', 'حُفظت الصلة'), `${nameOf(p)} · ${L(...RELS.find(r => r[0] === p.rel).slice(1))}`, {
          action: {
            label: L('Undo', 'تراجع'),
            fn: () => {
              undo();
              p.canCollect = canCollect;
              p.relativeTo = oldRelativeTo;
              refresh();
            }
          }
        });
      });
      el.querySelector('#relout')?.addEventListener('click', () => {
        if (D.PEOPLE.some(m => m.hh === h.id && m.relativeTo === p.id)) return toast(L('Update linked relationships first', 'حدّث الصلات المرتبطة أولاً'), L('Other members identify this person as their relative.', 'يحدّد أفراد آخرون هذا الشخص بوصفه قريبهم.'), 'warning');
        const before = {
          members: h.members.slice(),
          head: h.head,
          p: {
            hh: p.hh,
            rel: p.rel,
            relativeTo: p.relativeTo,
            emergency: p.emergency
          }
        };
        h.members = h.members.filter(m => m !== p.id);
        if (h.head === p.id) h.head = h.members[0] || null;
        Object.assign(p, {
          hh: null
        });
        delete p.rel;
        delete p.relativeTo;
        delete p.emergency;
        closeOverlays();
        refresh();
        ok(L('Removed from the household', 'أُخرج من العائلة'), L(`${nameOf(p)} is recorded on their own now.`, `${nameOf(p)} مسجّل بمفرده الآن.`), {
          action: {
            label: L('Undo', 'تراجع'),
            fn: () => {
              Object.assign(h, {
                members: before.members,
                head: before.head
              });
              Object.assign(p, before.p);
              refresh();
            }
          }
        });
      });
    }
  });
}

/** From a household: bring someone in. From a person (hid omitted): choose their household. */
export function familyAdd(hid, pid) {
  const fixedH = hid && D.HOUSEHOLDS.find(x => x.id === hid),
    fixedP = pid && D.person(pid);
  const pickP = !fixedP,
    pickH = !fixedH;
  openModal({
    title: fixedH ? L('Add a family member', 'إضافة فرد إلى العائلة') : L('Link to a household', 'ربط بعائلة'),
    sub: fixedH ? L(fixedH.name, fixedH.ar) : nameOf(fixedP),
    body: <>{pickP ? <div className="formrow"><label className="label" htmlFor="fa_p">{L('Person', 'الشخص')}</label><Select id="fa_p">{D.PEOPLE.filter(x => !fixedH || !fixedH.members.includes(x.id)).map(x => {
            const h2 = D.HOUSEHOLDS.find(y => y.members.includes(x.id));
            return <option value={x.id}>{nameOf(x)}{h2 ? ` — ${L(`now in ${h2.name}`, `حالياً في ${h2.ar}`)}` : ''}</option>;
          })}</Select></div> : ''}{" "}{pickH ? <div className="formrow"><label className="label" htmlFor="fa_h">{L('Household', 'العائلة')}</label><Select id="fa_h">{D.HOUSEHOLDS.map(x => <option value={x.id}>{L(x.name, x.ar)} · {L(x.town, x.townAr)}</option>)}</Select></div> : ''}{" "}<div className="formrow"><label className="label" htmlFor="fa_rel">{L('Relationship', 'الصلة')}</label>{relSelect('fa_rel', 'child')}</div>{" "}<div className="formrow"><label className="label" htmlFor="fa_to">{L('Related to household member', 'صلة بفرد من العائلة')}</label><Select id="fa_to" /></div>{" "}<C.CheckRow label={L('Emergency contact', 'جهة اتصال في الطوارئ')} id='fa_em' />{" "}<p className="help" style={{
        marginTop: "10px"
      }}>{L('Someone who is in another household is moved here; their record and history move with them.', 'من هو في عائلة أخرى يُنقل إلى هنا؛ ويرافقه سجلّه وتاريخه.')}</p></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="fa_go" style={{
        marginInlineStart: "auto"
      }}>{fixedH ? L('Add to household', 'إضافة إلى العائلة') : L('Link', 'ربط')}</button></>,
    onMount(el) {
      const fillRelated = () => {
        const h = fixedH || D.HOUSEHOLDS.find(x => x.id === el.querySelector('#fa_h')?.value);
        paint(el.querySelector('#fa_to'), <><option value="">{L('Not specified', 'غير محدد')}</option>{(h?.members || []).filter(mid => mid !== fixedP?.id).map(mid => <option value={mid}>{nameOf(D.person(mid))}</option>)}</>);
      };
      el.querySelector('#fa_h')?.addEventListener('change', fillRelated);
      fillRelated();
      el.querySelector('#fa_go').addEventListener('click', () => {
        const p = fixedP || D.person(el.querySelector('#fa_p')?.value),
          h = fixedH || D.HOUSEHOLDS.find(x => x.id === el.querySelector('#fa_h')?.value);
        if (!p || !h) return toast(L('Choose who and where', 'اختر الشخص والعائلة'), '', 'warning');
        const oldHouse = D.HOUSEHOLDS.find(x => x.members.includes(p.id));
        if (oldHouse && oldHouse !== h && D.PEOPLE.some(m => m.hh === oldHouse.id && m.relativeTo === p.id)) return toast(L('Update linked relationships first', 'حدّث الصلات المرتبطة أولاً'), L('Other members of the old household identify this person as their relative.', 'يحدّد أفراد من العائلة السابقة هذا الشخص بوصفه قريبهم.'), 'warning');
        const oldRelativeTo = p.relativeTo;
        const undo = joinHousehold(p, h, el.querySelector('#fa_rel').value, el.querySelector('#fa_em').checked);
        p.relativeTo = el.querySelector('#fa_to').value || null;
        closeOverlays();
        refresh();
        ok(L('Family updated', 'حُدّثت العائلة'), `${nameOf(p)} · ${L(h.name, h.ar)}`, {
          action: {
            label: L('Undo', 'تراجع'),
            fn: () => {
              undo();
              p.relativeTo = oldRelativeTo;
              refresh();
            }
          }
        });
      });
    }
  });
}
export function noteNew(pid) {
  openPastoralForm(null, 'note', pid || null);
}
export function noteEdit(id) {
  const note = D.NOTES.find(x => x.id === id);
  if (note) openPastoralForm(note);
}

/* ═════════════ groups ═════════════ */
export function memberAdd(gid = curGroup()) {
  const d = D.groupInfo(gid);
  const candidates = D.PEOPLE.filter(p => !d.roster.some(r => r.p === p.id));
  openDrawer({
    title: L('Add existing people', 'إضافة أشخاص مسجّلين'),
    sub: L('Search and select several people. Existing members are excluded.', 'ابحث واختر عدة أشخاص. الأعضاء الحاليون مستبعدون.'),
    body: <><input className="input" type="search" id="group-member-search" placeholder={L('Search names', 'البحث عن أسماء')} />{" "}<div className="choice-grid" style={{
        marginTop: "12px"
      }} id="group-member-choices">{candidates.map(p => <label className="row" data-member-name={(p.lat + ' ' + p.ar).toLowerCase()}><input type="checkbox" defaultValue={p.id} data-member-choice="" /><span>{p.lat} · {p.ar}</span></label>)}</div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="group-members-add">{L('Add selected people', 'إضافة المحدّدين')}</button></>,
    onMount(el) {
      el.querySelector('#group-member-search').addEventListener('input', e => {
        const q = e.target.value.trim().toLowerCase();
        el.querySelectorAll('[data-member-name]').forEach(row => row.hidden = !row.dataset.memberName.includes(q));
      });
      el.querySelector('#group-members-add').addEventListener('click', async () => {
        const selected = [...el.querySelectorAll('[data-member-choice]:checked')].map(c => c.value);
        if (!selected.length) return toast(L('Select at least one person', 'اختر شخصاً واحداً على الأقل'), '', 'warning');
        for (const pid of selected) if (!d.roster.some(r => r.p === pid)) d.roster.push({
          p: pid,
          role: 'Member',
          roleAr: 'عضو',
          joined: new Date().getFullYear().toString(),
          att: 0
        });
        const g = D.group(gid);
        if (g && S.role !== 'leader') g.members = (Number(g.members) || 0) + selected.length;
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Members added', 'أُضيف الأعضاء'), `${selected.length}`);
      });
    }
  });
}
export function meetingNew(gid = curGroup()) {
  const detail = D.groupInfo(gid);
  const now = new Date(),
    todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  openDrawer({
    title: L('Schedule a meeting', 'جدولة اجتماع'),
    body: <><div className="formrow"><label className="label" htmlFor="m_kind">{L('Meeting for', 'الاجتماع لـ')}</label><Select id="m_kind"><option value="group">{L('All group members', 'جميع أعضاء المجموعة')}</option><option value="committee">{L('Committee / people in charge', 'اللجنة / المسؤولون')}</option></Select></div>{" "}<C.Field label={L('Meeting title', 'عنوان الاجتماع')} id='m_title' value={L('Ministry meeting', 'اجتماع الخدمة')} req={true} />{" "}<C.Textarea label={L('Description or agenda', 'الوصف أو جدول الأعمال')} id='m_description' max={500} />{" "}<div className="formgrid"><C.Field label={L('First date', 'التاريخ الأول')} type='date' value={todayKey} id='m_d' />{" "}<C.Field label={L('Starts at', 'يبدأ عند')} type='time' value='19:00' id='m_t' /></div>{" "}<div className="formgrid"><C.Field label={L('Ends at', 'ينتهي عند')} type='time' value='20:00' id='m_end' />{" "}<C.Field label={L('Place (optional)', 'المكان (اختياري)')} id='m_place' /></div>{" "}<div className="formgrid"><div className="formrow"><label className="label" htmlFor="m_repeat">{L('Repeats', 'التكرار')}</label><Select id="m_repeat"><option value="0">{L('Once', 'مرّة')}</option><option value="7">{L('Every week', 'كل أسبوع')}</option><option value="14">{L('Every two weeks', 'كل أسبوعين')}</option></Select></div>{" "}<C.Stepper label={L('Total number of meetings', 'إجمالي عدد الاجتماعات')} value={4} id='m_count' /></div>{" "}<fieldset className="repeat-days" id="m_days" hidden><legend>{L('Repeat on', 'يتكرّر في')}</legend>{" "}<div className="repeat-day-list">{[[0, 'S', 'الأحد'], [1, 'M', 'الإثنين'], [2, 'T', 'الثلاثاء'], [3, 'W', 'الأربعاء'], [4, 'TH', 'الخميس'], [5, 'F', 'الجمعة'], [6, 'SA', 'السبت']].map(([day, en, ar]) => <label className="repeat-day"><input type="checkbox" defaultValue={day} aria-label={L(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day], ar)} /><span>{L(en, ar)}</span></label>)}</div>{" "}<p className="help">{L('The count is the total number of meetings. Choose no more weekdays than meetings.', 'العدد هو إجمالي الاجتماعات. اختر أياماً لا تتجاوز عدد الاجتماعات.')}</p></fieldset>{" "}<label className="check" style={{
        marginTop: "16px"
      }}><input type="checkbox" id="m_specific" /><span>{L('Invite specific group members', 'دعوة أعضاء محدّدين من المجموعة')}</span></label>{" "}<fieldset className="formrow" id="m_people" hidden><legend className="label">{L('Participants', 'المشاركون')}</legend><div className="choice-grid">{detail.roster.map(r => <label className="check"><input type="checkbox" defaultValue={r.p} /><span>{L(D.person(r.p)?.lat || r.p, D.person(r.p)?.ar || r.p)}</span></label>)}</div></fieldset></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="m_go" style={{
        marginInlineStart: "auto"
      }}>{L('Schedule', 'جدولة')}</button></>,
    onMount(el) {
      const count = el.querySelector('#m_count');
      count.closest('.formrow').hidden = true;
      const days = el.querySelector('#m_days');
      const selectStartDay = () => {
        if (days.querySelector('input:checked')) return;
        const raw = val(el, '#m_d');
        if (!raw) return;
        const d = new Date(`${raw}T12:00:00`);
        if (!Number.isNaN(d.getTime())) days.querySelector(`input[value="${d.getDay()}"]`).checked = true;
      };
      el.querySelector('#m_repeat').addEventListener('change', () => {
        const repeating = el.querySelector('#m_repeat').value !== '0';
        count.closest('.formrow').hidden = !repeating;
        days.hidden = !repeating;
        if (repeating) selectStartDay();
      });
      el.querySelector('#m_specific').addEventListener('change', e => {
        el.querySelector('#m_people').hidden = !e.target.checked;
      });
      days.querySelectorAll('input').forEach(box => box.addEventListener('change', () => {
        const total = Math.max(1, Number(count.value) || 1);
        if ([...days.querySelectorAll('input:checked')].length > total) {
          box.checked = false;
          toast(L('Too many weekdays', 'أيام كثيرة'), L('The number of weekdays cannot exceed the total meeting count.', 'لا يجوز أن يتجاوز عدد الأيام إجمالي الاجتماعات.'), 'warning');
        }
      }));
      el.querySelector('#m_d').addEventListener('change', () => {
        if (!days.hidden) {
          days.querySelectorAll('input').forEach(box => box.checked = false);
          selectStartDay();
        }
      });
      el.querySelector('#m_go').addEventListener('click', async () => {
        if (!need(el, '#m_title', L('Name the meeting', 'سمّ الاجتماع')) || !need(el, '#m_d', L('Choose a date', 'اختر التاريخ')) || !need(el, '#m_t', L('Choose a time', 'اختر الوقت'))) return;
        const date = val(el, '#m_d'),
          time = val(el, '#m_t'),
          end = val(el, '#m_end'),
          interval = Number(val(el, '#m_repeat')),
          count = interval ? Math.min(52, Math.max(1, Number(val(el, '#m_count')) || 4)) : 1;
        if (end && end <= time) return toast(L('End time must follow start time', 'يجب أن يكون وقت النهاية بعد البداية'), '', 'warning');
        const selected = new Set([...days.querySelectorAll('input:checked')].map(box => Number(box.value)));
        if (interval && !selected.size) return toast(L('Choose at least one weekday', 'اختر يوماً واحداً على الأقل'), '', 'warning');
        if (interval && selected.size > count) return toast(L('Too many weekdays', 'أيام كثيرة'), L('Choose no more weekdays than meetings.', 'اختر أياماً لا تتجاوز عدد الاجتماعات.'), 'warning');
        const participants = el.querySelector('#m_specific').checked ? [...el.querySelectorAll('#m_people input:checked')].map(input => input.value) : [];
        if (el.querySelector('#m_specific').checked && !participants.length) return toast(L('Choose at least one participant', 'اختر مشاركاً واحداً على الأقل'), '', 'warning');
        const starts = new Date(`${date}T12:00:00`),
          weekStart = new Date(starts),
          added = [];
        weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
        for (let i = 0; added.length < count && i < 730; i++) {
          const next = new Date(starts);
          next.setDate(starts.getDate() + i);
          const d = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
          const weeks = Math.floor((Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) - Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())) / 604800000);
          if (interval && (!selected.has(next.getDay()) || weeks % (interval / 7) !== 0)) continue;
          if (detail.meetings.some(m => m.d === d && m.t === time)) continue;
          const meeting = {
            id: `mt${Date.now().toString(36)}-${i}`,
            d,
            t: time,
            end,
            title: val(el, '#m_title'),
            kind: val(el, '#m_kind'),
            description: val(el, '#m_description'),
            place: val(el, '#m_place'),
            participants: [...participants],
            rsvp: {
              yes: 0,
              no: 0,
              none: participants.length || detail.roster.length
            },
            done: false,
            attendance: {}
          };
          detail.meetings.push(meeting);
          added.push(meeting);
          if (!interval) break;
        }
        if (!added.length) return toast(L('Meeting already exists', 'الاجتماع موجود'), L('Choose another date or time.', 'اختر تاريخاً أو وقتاً آخر.'), 'warning');
        S.ui.attendancePeriod = date.slice(0, 7);
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L(added.length === 1 ? 'Meeting scheduled' : `${added.length} meetings scheduled`, added.length === 1 ? 'جُدول الاجتماع' : `جُدولت ${added.length} اجتماعات`), `${fmtDate(date)} · ${time}`);
      });
    }
  });
}
export function meetingEdit(id) {
  const meeting = gd().meetings.find(m => (m.id || `mt-${m.d}-${m.t}`) === id);
  if (!meeting) return;
  openDrawer({
    title: L('Edit meeting', 'تعديل الاجتماع'),
    body: <><div className="formrow"><label className="label" htmlFor="me_kind">{L('Meeting for', 'الاجتماع لـ')}</label><Select id="me_kind"><option value="group" selected={!!(meeting.kind !== 'committee')}>{L('All group members', 'جميع أعضاء المجموعة')}</option><option value="committee" selected={!!(meeting.kind === 'committee')}>{L('Committee / people in charge', 'اللجنة / المسؤولون')}</option></Select></div>{" "}<C.Field label={L('Meeting title', 'عنوان الاجتماع')} id='me_title' value={meeting.title || L('Ministry meeting', 'اجتماع الخدمة')} req={true} />{" "}<C.Textarea label={L('Description or agenda', 'الوصف أو جدول الأعمال')} id='me_description' value={meeting.description || ''} max={500} />{" "}<div className="formgrid"><C.Field label={L('Date', 'التاريخ')} type='date' id='me_date' value={meeting.d} />{" "}<C.Field label={L('Starts at', 'يبدأ عند')} type='time' id='me_time' value={meeting.t} /></div>{" "}<div className="formgrid"><C.Field label={L('Ends at', 'ينتهي عند')} type='time' id='me_end' value={meeting.end || ''} />{" "}<C.Field label={L('Place (optional)', 'المكان (اختياري)')} id='me_place' value={meeting.place || ''} /></div>{" "}<label className="check" style={{
        marginTop: "16px"
      }}><input type="checkbox" id="me_specific" defaultChecked={!!meeting.participants?.length} /><span>{L('Invite specific group members', 'دعوة أعضاء محدّدين من المجموعة')}</span></label>{" "}<fieldset className="formrow" id="me_people" hidden={!meeting.participants?.length}><legend className="label">{L('Participants', 'المشاركون')}</legend><div className="choice-grid">{gd().roster.map(r => <label className="check"><input type="checkbox" defaultValue={r.p} defaultChecked={!!meeting.participants?.includes(r.p)} /><span>{L(D.person(r.p)?.lat || r.p, D.person(r.p)?.ar || r.p)}</span></label>)}</div></fieldset>{" "}<p className="t-caption dim">{is('secretary') ? L('Update the meeting date, place and invited members.', 'عدّل موعد الاجتماع ومكانه والأعضاء المدعوين.') : L('Changing this date keeps its attendance linked to the meeting.', 'تغيير التاريخ يبقي الحضور مرتبطاً بالاجتماع.')}</p></>,
    foot: <><button className="btn btn-danger-quiet" id="me_delete">{L('Delete meeting', 'حذف الاجتماع')}</button>{" "}<button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="me_save">{L('Save', 'حفظ')}</button></>,
    onMount(el) {
      el.querySelector('#me_specific').addEventListener('change', e => {
        el.querySelector('#me_people').hidden = !e.target.checked;
      });
      el.querySelector('#me_save').addEventListener('click', async () => {
        const d = val(el, '#me_date'),
          t = val(el, '#me_time'),
          end = val(el, '#me_end');
        if (!need(el, '#me_title', L('Name the meeting', 'سمّ الاجتماع')) || !d || !t) return toast(L('Choose a title, date and time', 'اختر عنواناً وتاريخاً ووقتاً'), '', 'warning');
        if (end && end <= t) return toast(L('End time must follow start time', 'يجب أن يكون وقت النهاية بعد البداية'), '', 'warning');
        if (gd().meetings.some(x => x !== meeting && x.d === d && x.t === t)) return toast(L('Meeting already exists', 'الاجتماع موجود'), '', 'warning');
        const participants = el.querySelector('#me_specific').checked ? [...el.querySelectorAll('#me_people input:checked')].map(x => x.value) : [];
        if (el.querySelector('#me_specific').checked && !participants.length) return toast(L('Choose at least one participant', 'اختر مشاركاً واحداً على الأقل'), '', 'warning');
        Object.assign(meeting, {
          d,
          t,
          end,
          kind: val(el, '#me_kind'),
          title: val(el, '#me_title'),
          description: val(el, '#me_description'),
          place: val(el, '#me_place'),
          participants
        });
        if (!(await persist())) return;
        S.ui.attendancePeriod = d.slice(0, 7);
        closeOverlays();
        refresh();
        ok(L('Meeting updated', 'حُدّث الاجتماع'));
      });
      el.querySelector('#me_delete').addEventListener('click', () => {
        closeOverlays();
        openModal({
          title: L('Delete meeting and attendance?', 'حذف الاجتماع والحضور؟'),
          body: <><p>{fmtDate(meeting.d)} · {meeting.t}</p><p className="t-caption dim">{L('Recorded attendance for this date will also be deleted.', 'سيُحذف أيضاً الحضور المسجّل لهذا التاريخ.')}</p></>,
          foot: <><button className="btn btn-secondary" data-close="">{L('Keep meeting', 'إبقاء الاجتماع')}</button><button className="btn btn-danger" id="me_confirm">{L('Delete', 'حذف')}</button></>,
          onMount(mod) {
            mod.querySelector('#me_confirm').addEventListener('click', async () => {
              gd().meetings.splice(gd().meetings.indexOf(meeting), 1);
              if (!(await persist())) return;
              closeOverlays();
              refresh();
              ok(L('Meeting deleted', 'حُذف الاجتماع'));
            });
          }
        });
      });
    }
  });
}
export async function postAdd(btn) {
  const editor = btn.closest('.panel')?.querySelector('.rte-body');
  const body = editor?.innerText.trim();
  if (!body) return toast(L('Write something first', 'اكتب شيئاً أولاً'), '', 'warning');
  if (body.length > 12000) return toast(L('Post is too long', 'المنشور طويل جداً'), L('Keep it under 12,000 characters.', 'اجعله أقل من ١٢٬٠٠٠ حرف.'), 'warning');
  gd().posts.unshift({
    by: me()?.id || 'p3',
    at: new Date().toISOString().slice(0, 10),
    body,
    bodyAr: body,
    html: safeRichText(editor.innerHTML)
  });
  if (!(await persist())) return;
  refresh();
  ok(L('Posted to the group', 'نُشر في المجموعة'));
}
export function taskAdd() {
  openModal({
    title: L('Add a task', 'إضافة مهمة'),
    body: <><C.Field label={L('Task', 'المهمة')} req={true} id='tk_w' />{" "}<div className="formgrid"><C.PersonPicker label={L('Owner', 'المسؤول')} id='tk_o' />{" "}<C.Field label={L('Due', 'المهلة')} type='date' value='2026-10-18' id='tk_d' /></div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="tk_go" style={{
        marginInlineStart: "auto"
      }}>{L('Add task', 'إضافة المهمة')}</button></>,
    onMount(el) {
      el.querySelector('#tk_go').addEventListener('click', () => {
        if (!need(el, '#tk_w', L('Name the task', 'سمّ المهمة'))) return;
        const w = val(el, '#tk_w');
        gd().tasks.unshift({
          what: w,
          whatAr: w,
          who: me()?.id || 'p3',
          due: val(el, '#tk_d'),
          done: false
        });
        closeOverlays();
        refresh();
        ok(L('Task added', 'أُضيفت المهمة'), w);
      });
    }
  });
}
export function milestoneRecord(i) {
  const m = gd().milestones[+i];
  if (!m) return;
  pickPerson({
    title: L('Record completion', 'تسجيل إنجاز'),
    sub: L(m.name, m.ar),
    cta: L('Record', 'تسجيل'),
    onPick: p => {
      if (!gd().roster.some(member => member.p === p.id)) return toast(L('Choose a group member', 'اختر عضواً من المجموعة'), '', 'warning');
      m.completions ||= {};
      m.completions[p.id] = {
        date: new Date().toISOString().slice(0, 10),
        notes: ''
      };
      refresh();
      ok(L('Milestone recorded', 'سُجّلت المحطة'), `${nameOf(p)} · ${L(m.name, m.ar)}`);
    }
  });
}
export function handover() {
  const group = D.GROUPS.find(x => x.id === curGroup()),
    detail = group && D.groupInfo(group.id);
  if (!group || !detail || is('leader')) return;
  const outgoing = group.leader,
    people = detail.roster.filter(row => row.p !== outgoing).map(row => D.person(row.p)).filter(Boolean);
  if (!people.length) return toast(L('Add another member first', 'أضف عضواً آخر أولاً'), '', 'warning');
  const due = new Date().toLocaleDateString('sv-SE');
  openDrawer({
    title: L('Leadership handover', 'تسليم المسؤولية'),
    sub: L(group.name, group.ar),
    body: <><div className="formrow"><label className="label">{L('Current leader', 'المسؤول الحالي')}</label><Who p={D.person(outgoing)} /></div>{" "}<div className="formrow"><label className="label" htmlFor="ho_to">{L('New leader', 'المسؤول الجديد')}</label><Select id="ho_to"><option value="">{L('Choose an existing member', 'اختر عضواً موجوداً')}</option>{people.map(p => <option value={p.id}>{L(p.lat, p.ar)}</option>)}</Select></div>{" "}<p className="help">{L('This change takes effect immediately.', 'يسري هذا التغيير فوراً.')}</p>{" "}<C.InlineAlert tone='info' title={L(`${detail.tasks.filter(x => !x.done && x.who === outgoing).length} open tasks will move`, `${detail.tasks.filter(x => !x.done && x.who === outgoing).length} مهام مفتوحة ستنتقل`)} body={L('The member record and attendance history stay with each person.', 'يبقى سجل العضوية والحضور مرتبطاً بكل شخص.')} /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="ho_go" style={{
        marginInlineStart: "auto"
      }}>{L('Start handover', 'بدء التسليم')}</button></>,
    onMount(el) {
      el.querySelector('#ho_go').addEventListener('click', async () => {
        const to = val(el, '#ho_to'),
          next = D.person(to);
        if (!next || !detail.roster.some(row => row.p === to)) return toast(L('Choose a group member', 'اختر عضواً في المجموعة'), '', 'warning');
        group.leader = to;
        if (group.assistant === to) {
          group.assistant = null;
          detail.assistant = null;
        }
        for (const row of detail.roster) {
          if (row.p === outgoing && row.role === 'Leader') {
            row.role = 'Member';
            row.roleAr = 'عضو';
          }
          if (row.p === to) {
            row.role = 'Leader';
            row.roleAr = 'مسؤول';
          }
        }
        detail.roles = detail.roles.filter(([pid, role]) => pid !== to && !(pid === outgoing && role === 'Leader'));
        detail.roles.unshift([to, 'Leader', 'مسؤول']);
        for (const task of detail.tasks) if (!task.done && task.who === outgoing) task.who = to;
        detail.history.unshift([`Leadership transferred from ${D.person(outgoing)?.lat || outgoing} to ${next.lat}`, `انتقلت المسؤولية من ${D.person(outgoing)?.ar || outgoing} إلى ${next.ar || next.lat}`, due]);
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Handover completed', 'اكتمل التسليم'), nameOf(next));
      });
    }
  });
}

/* ═════════════ calendar & services ═════════════ */
export function calShift(n) {
  S.ui.calOffset = n === 0 ? 0 : S.ui.calOffset + n;
  refresh();
}
export function calDay(n) {
  const [y, m, d] = (S.ui.calDay || today).split('-').map(Number);
  const x = n ? new Date(y, m - 1, d + n) : new Date(D.TODAY);
  S.ui.calDay = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  refresh();
}
export function eventDuplicate(id) {
  const e = D.EVENTS.find(x => x.id === id) || D.EVENTS[9];
  const d = new Date(e.d);
  d.setDate(d.getDate() + 7);
  const copy = {
    ...e,
    id: 'ev' + Date.now(),
    d: d.toISOString().slice(0, 10)
  };
  D.EVENTS.push(copy);
  closeOverlays();
  refresh();
  ok(L('Event duplicated', 'نُسخ الحدث'), `${L(e.title, e.titleAr)} · ${fmtDate(copy.d)}`, {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        D.EVENTS.splice(D.EVENTS.indexOf(copy), 1);
        refresh();
      }
    }
  });
}
export function eventCancel(id) {
  const i = D.EVENTS.findIndex(x => x.id === id);
  if (i < 0) return;
  const [e] = D.EVENTS.splice(i, 1);
  closeOverlays();
  refresh();
  ok(L('Event cancelled', 'أُلغي الحدث'), L('Everyone who said yes has been told.', 'أُبلغ كل من أكّد حضوره.'), {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        D.EVENTS.splice(i, 0, e);
        refresh();
      }
    }
  });
}
export function svcItemAdd() {
  openDrawer({
    title: L('Add to the order of service', 'إضافة إلى ترتيب الخدمة'),
    body: <><div className="formgrid"><C.Field label={L('Item (English)', 'البند (إنكليزي)')} req={true} id='si_en' />{" "}<C.Field label={L('Item (Arabic)', 'البند (عربي)')} dir='rtl' ar={true} id='si_ar' /></div>{" "}<div className="formgrid"><C.Stepper label={L('Minutes', 'الدقائق')} value={3} id='si_min' />{" "}<div className="formrow"><label className="label">{L('Led by', 'يقوده')}</label><Select id="si_who"><option value="p17">Fr. Antoine Khoury</option><option value="g1">{L('Saint Elias Choir', 'جوقة مار الياس')}</option><option value="p6">Carla Abou Jaoude</option></Select></div></div>{" "}<C.Field label={L('Instructions', 'تعليمات')} id='si_note' /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="si_go" style={{
        marginInlineStart: "auto"
      }}>{L('Add item', 'إضافة البند')}</button></>,
    onMount(el) {
      el.querySelector('#si_go').addEventListener('click', () => {
        if (!need(el, '#si_en', L('Name the item', 'سمّ البند'))) return;
        const en = val(el, '#si_en');
        currentPlan().order.push({
          dur: val(el, '#si_min') || '3',
          t: en,
          ar: val(el, '#si_ar') || en,
          note: val(el, '#si_note'),
          noteAr: val(el, '#si_note'),
          who: el.querySelector('#si_who').value
        });
        closeOverlays();
        refresh();
        ok(L('Added to the order', 'أُضيف إلى الترتيب'), en);
      });
    }
  });
}
export function svcItemMenu(btn, i) {
  i = +i;
  const o = currentPlan().order;
  const move = d => {
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    refresh();
  };
  openMenu(btn, [{
    label: L('Move up', 'نقل للأعلى'),
    icon: 'chevL',
    fn: () => move(-1)
  }, {
    label: L('Move down', 'نقل للأسفل'),
    icon: 'chevR',
    fn: () => move(1)
  }, {
    sep: true
  }, {
    label: L('Remove', 'إزالة'),
    icon: 'trash',
    danger: true,
    fn: () => {
      const [it] = o.splice(i, 1);
      refresh();
      ok(L('Removed from the order', 'أُزيل من الترتيب'), it.t, {
        action: {
          label: L('Undo', 'تراجع'),
          fn: () => {
            o.splice(i, 0, it);
            refresh();
          }
        }
      });
    }
  }]);
}
export function svcTemplateUse(i) {
  const tpl = D.SERVICE_TEMPLATES.find(x => x.id === i);
  if (!tpl) return;
  servicePlanNew(tpl.id);
}
export function servicePlanNew(templateId = '') {
  const first = D.SERVICE_TEMPLATES.find(x => x.id === templateId);
  openDrawer({
    title: L('New service plan', 'خطة خدمة جديدة'),
    sub: L('Choose a date and optional template. The new plan is independent of its template.', 'اختر التاريخ وقالباً اختيارياً. الخطة الجديدة مستقلة عن قالبها.'),
    body: <><div className="formgrid"><C.Field label={L('Service name', 'اسم الخدمة')} req={true} id='sp_name' value={first?.name || ''} />{" "}<C.Field label={L('Arabic name', 'الاسم العربي')} id='sp_ar' value={first?.ar || ''} /></div>{" "}<div className="formgrid"><C.Field label={L('Date', 'التاريخ')} type='date' req={true} id='sp_date' value={new Date().toISOString().slice(0, 10)} />{" "}<C.Field label={L('Time', 'الوقت')} type='time' id='sp_time' value='10:30' /></div>{" "}<div className="formrow"><label className="label" htmlFor="sp_template">{L('Start from template', 'ابدأ من قالب')}</label>{" "}<Select id="sp_template"><option value="">{L('Blank plan', 'خطة فارغة')}</option>{D.SERVICE_TEMPLATES.map(x => <option value={x.id} selected={!!(x.id === templateId)}>{L(x.name, x.ar)} · {x.order.length}{" "}{L('items', 'بنود')}</option>)}</Select></div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="sp_save">{L('Create plan', 'إنشاء الخطة')}</button></>,
    onMount(el) {
      el.querySelector('#sp_template').addEventListener('change', () => {
        const tpl = D.SERVICE_TEMPLATES.find(x => x.id === val(el, '#sp_template'));
        if (tpl) {
          el.querySelector('#sp_name').value = tpl.name;
          el.querySelector('#sp_ar').value = tpl.ar;
        }
      });
      el.querySelector('#sp_save').addEventListener('click', () => {
        if (!need(el, '#sp_name', L('Name the service', 'سمّ الخدمة')) || !need(el, '#sp_date', L('Choose a date', 'اختر التاريخ'))) return;
        const tpl = D.SERVICE_TEMPLATES.find(x => x.id === val(el, '#sp_template'));
        const name = val(el, '#sp_name');
        const plan = {
          id: 'sp' + Date.now().toString(36),
          title: name,
          titleAr: val(el, '#sp_ar') || name,
          date: val(el, '#sp_date'),
          time: val(el, '#sp_time') || '10:30',
          venue: tpl?.venue || 'v1',
          celebrant: tpl?.celebrant || 'p17',
          coordinator: tpl?.coordinator || 'p4',
          language: tpl?.language || 'Arabic & Syriac',
          languageAr: tpl?.languageAr || 'عربي وسرياني',
          status: 'draft',
          order: copyOrder(tpl?.order)
        };
        D.SERVICE_PLANS.push(plan);
        closeOverlays();
        refresh();
        go(`services/plan/${plan.id}`);
        ok(L('Plan created', 'أُنشئت الخطة'), `${name} · ${fmtDate(plan.date)}`);
      });
    }
  });
}
export function servicePlanEdit() {
  const plan = currentPlan();
  openDrawer({
    title: L('Plan details', 'تفاصيل الخطة'),
    body: <><div className="formgrid"><C.Field label={L('Name', 'الاسم')} req={true} id='pe_name' value={plan.title} />{" "}<C.Field label={L('Arabic name', 'الاسم العربي')} id='pe_ar' value={plan.titleAr} /></div>{" "}<div className="formgrid"><C.Field label={L('Date', 'التاريخ')} type='date' id='pe_date' value={plan.date} />{" "}<C.Field label={L('Time', 'الوقت')} type='time' id='pe_time' value={plan.time || '10:30'} /></div>{" "}<div className="formrow"><label className="label" htmlFor="pe_venue">{L('Venue', 'المكان')}</label><Select id="pe_venue">{D.VENUES.map(v => <option value={v.id} selected={!!(v.id === plan.venue)}>{L(v.name, v.ar)}</option>)}</Select></div>{" "}<div className="formrow"><label className="label" htmlFor="pe_status">{L('Status', 'الحالة')}</label><Select id="pe_status">{[['draft', 'Draft', 'مسودة'], ['scheduled', 'Scheduled', 'مجدول'], ['ready', 'Ready', 'جاهز'], ['completed', 'Completed', 'منجز']].map(([v, en, ar]) => <option value={v} selected={!!(v === plan.status)}>{L(en, ar)}</option>)}</Select></div></>,
    foot: <>{plan.id !== D.SERVICE.id ? <button className="btn btn-danger-quiet" id="pe_delete">{L('Delete plan', 'حذف الخطة')}</button> : ''}{" "}<button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="pe_save">{L('Save', 'حفظ')}</button></>,
    onMount(el) {
      el.querySelector('#pe_save').addEventListener('click', () => {
        if (!need(el, '#pe_name', L('Name the service', 'سمّ الخدمة')) || !need(el, '#pe_date', L('Choose a date', 'اختر التاريخ'))) return;
        Object.assign(plan, {
          title: val(el, '#pe_name'),
          titleAr: val(el, '#pe_ar') || val(el, '#pe_name'),
          date: val(el, '#pe_date'),
          time: val(el, '#pe_time') || '10:30',
          venue: val(el, '#pe_venue'),
          status: val(el, '#pe_status')
        });
        closeOverlays();
        refresh();
        ok(L('Plan updated', 'حُدّثت الخطة'));
      });
      el.querySelector('#pe_delete')?.addEventListener('click', () => {
        closeOverlays();
        openModal({
          title: L('Delete this plan?', 'حذف هذه الخطة؟'),
          body: <p>{L(plan.title, plan.titleAr)}</p>,
          foot: <><button className="btn btn-secondary" data-close="">{L('Keep plan', 'إبقاء الخطة')}</button><button className="btn btn-danger" id="pd_confirm">{L('Delete plan', 'حذف الخطة')}</button></>,
          onMount(mod) {
            mod.querySelector('#pd_confirm').addEventListener('click', () => {
              D.SERVICE_PLANS.splice(D.SERVICE_PLANS.indexOf(plan), 1);
              closeOverlays();
              refresh();
              go('services');
              ok(L('Plan deleted', 'حُذفت الخطة'));
            });
          }
        });
      });
    }
  });
}
function serviceTemplateRow(item = {}) {
  const leaders = [...D.PEOPLE.map(p => [p.id, L(p.lat, p.ar)]), ...D.GROUPS.map(g => [g.id, L(g.name, g.ar)])];
  return <div className="card card-flat" data-st-row="" data-note-ar={item.noteAr || ''} data-original-note={item.note || ''} style={{
    padding: "10px",
    marginBottom: "8px"
  }}><div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "7px"
    }}><input className="input" data-st-dur="" type="number" min="1" defaultValue={item.dur || '3'} aria-label={L('Minutes', 'الدقائق')} title={L('Minutes', 'الدقائق')} style={{
        width: "70px",
        flex: "none"
      }} />{" "}<input className="input" data-st-title="" defaultValue={item.t || ''} placeholder={L('Item name', 'اسم البند')} aria-label={L('Item name in English', 'اسم البند بالإنكليزية')} style={{
        minWidth: "140px",
        flex: "1 1 140px"
      }} />{" "}<input className="input" data-st-ar="" defaultValue={item.ar || ''} placeholder={L('Arabic name', 'الاسم العربي')} dir="rtl" aria-label={L('Item name in Arabic', 'اسم البند بالعربية')} style={{
        minWidth: "140px",
        flex: "1 1 140px"
      }} /></div>{" "}<div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "7px",
      marginTop: "7px",
      alignItems: "center"
    }}><Select data-st-who="" aria-label={L('Led by', 'يقوده')} style={{
        minWidth: "140px",
        flex: "1 1 140px"
      }}><option value="">{L('Unassigned', 'غير محدّد')}</option>{leaders.map(([v, label]) => <option value={v} selected={!!(item.who === v)}>{label}</option>)}</Select>{" "}<input className="input" data-st-note="" defaultValue={item.note || ''} placeholder={L('Instruction (optional)', 'تعليمات (اختياري)')} aria-label={L('Instruction', 'تعليمات')} style={{
        minWidth: "140px",
        flex: "1 1 140px"
      }} />{" "}<span className="row" style={{
        gap: "2px"
      }}><C.IconBtn ico='chevD' label={L('Move up', 'نقل للأعلى')} data-st-move="-1" style="transform:rotate(180deg)" />{" "}<C.IconBtn ico='chevD' label={L('Move down', 'نقل للأسفل')} data-st-move="1" />{" "}<C.IconBtn ico='trash' label={L('Remove item', 'إزالة البند')} data-st-remove="" /></span></div></div>;
}
export function serviceTemplateEdit(id = '', fromPlan = false) {
  const source = fromPlan ? currentPlan() : D.SERVICE_TEMPLATES.find(x => x.id === id);
  openDrawer({
    large: true,
    title: source && !fromPlan ? L('Edit service template', 'تعديل قالب الخدمة') : L('New service template', 'قالب خدمة جديد'),
    sub: L('Set the defaults and order once. Existing plans stay independent.', 'اضبط القيم والترتيب مرة واحدة. تبقى الخطط الموجودة مستقلة.'),
    body: <><div className="formgrid"><C.Field label={L('Template name', 'اسم القالب')} req={true} id='st_name' value={source?.name || source?.title || ''} />{" "}<C.Field label={L('Arabic name', 'الاسم العربي')} id='st_ar' value={source?.ar || source?.titleAr || ''} /></div>{" "}<div className="formgrid"><div className="formrow"><label className="label" htmlFor="st_venue">{L('Default venue', 'المكان الافتراضي')}</label><Select id="st_venue">{D.VENUES.map(v => <option value={v.id} selected={!!(v.id === (source?.venue || 'v1'))}>{L(v.name, v.ar)}</option>)}</Select></div>{" "}<div className="formrow"><label className="label" htmlFor="st_lang">{L('Language', 'اللغة')}</label><Select id="st_lang">{[['Arabic & Syriac', 'عربي وسرياني'], ['Bilingual', 'ثنائي اللغة'], ['English', 'إنكليزي']].map(([en, ar]) => <option value={en} selected={!!(en === source?.language)}>{L(en, ar)}</option>)}</Select></div></div>{" "}<div className="row" style={{
        justifyContent: "space-between",
        margin: "12px 0 8px"
      }}><b>{L('Order of service', 'ترتيب الخدمة')}</b>{" "}<button className="btn btn-secondary btn-dense" id="st_add"><Icon name='plus' size={15} />{L('Add item', 'إضافة بند')}</button></div>{" "}<div id="st_items">{(source?.order || []).map(serviceTemplateRow)}</div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="st_save">{L('Save template', 'حفظ القالب')}</button></>,
    onMount(el) {
      const items = el.querySelector('#st_items');
      el.querySelector('#st_add').addEventListener('click', () => {
        items.insertAdjacentHTML('beforeend', serviceTemplateRow());
        items.lastElementChild.querySelector('[data-st-title]').focus();
      });
      items.addEventListener('click', event => {
        const row = event.target.closest('[data-st-row]');
        if (!row) return;
        if (event.target.closest('[data-st-remove]')) {
          row.remove();
          return;
        }
        const move = event.target.closest('[data-st-move]');
        if (!move) return;
        if (move.dataset.stMove === '-1' && row.previousElementSibling) items.insertBefore(row, row.previousElementSibling);
        if (move.dataset.stMove === '1' && row.nextElementSibling) items.insertBefore(row.nextElementSibling, row);
        move.focus();
      });
      el.querySelector('#st_save').addEventListener('click', () => {
        if (!need(el, '#st_name', L('Name the template', 'سمّ القالب'))) return;
        const order = [];
        for (const row of items.querySelectorAll('[data-st-row]')) {
          const dur = Number(row.querySelector('[data-st-dur]').value),
            t = row.querySelector('[data-st-title]').value.trim(),
            ar = row.querySelector('[data-st-ar]').value.trim(),
            who = row.querySelector('[data-st-who]').value,
            note = row.querySelector('[data-st-note]').value.trim();
          if (!t || !Number.isFinite(dur) || dur <= 0) {
            row.querySelector(!t ? '[data-st-title]' : '[data-st-dur]').focus();
            toast(L('Each item needs a name and minutes', 'كل بند يحتاج اسماً ودقائق'), '', 'warning');
            return;
          }
          order.push({
            dur: String(dur),
            t,
            ar: ar || t,
            who,
            note,
            noteAr: note === row.dataset.originalNote ? row.dataset.noteAr : note
          });
        }
        const name = val(el, '#st_name'),
          lang = val(el, '#st_lang');
        const fields = {
          name,
          ar: val(el, '#st_ar') || name,
          venue: val(el, '#st_venue'),
          language: lang,
          languageAr: {
            'Bilingual': 'ثنائي اللغة',
            'English': 'إنكليزي'
          }[lang] || 'عربي وسرياني',
          celebrant: source?.celebrant || 'p17',
          coordinator: source?.coordinator || 'p4',
          order
        };
        if (source && !fromPlan) Object.assign(source, fields);else D.SERVICE_TEMPLATES.push({
          id: 'st' + Date.now().toString(36),
          ...fields
        });
        closeOverlays();
        refresh();
        ok(L('Template saved', 'حُفظ القالب'));
      });
    }
  });
}
export function serviceTemplateDelete(id) {
  const tpl = D.SERVICE_TEMPLATES.find(x => x.id === id);
  if (!tpl) return;
  openModal({
    title: L('Delete template?', 'حذف القالب؟'),
    body: <><p>{L(tpl.name, tpl.ar)}</p><p className="t-caption dim">{L('Plans already created from it stay unchanged.', 'الخطط المنشأة منه تبقى بلا تغيير.')}</p></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Keep template', 'إبقاء القالب')}</button><button className="btn btn-danger" id="std_go">{L('Delete template', 'حذف القالب')}</button></>,
    onMount(el) {
      el.querySelector('#std_go').addEventListener('click', () => {
        D.SERVICE_TEMPLATES.splice(D.SERVICE_TEMPLATES.indexOf(tpl), 1);
        closeOverlays();
        refresh();
        ok(L('Template deleted', 'حُذف القالب'));
      });
    }
  });
}
export function addToService(mid) {
  const m = D.MUSIC.find(x => x.id === mid);
  if (!m) return;
  const leader = is('leader');
  const targets = leader ? D.GROUPS.flatMap(g => D.groupInfo(g.id).meetings.map(meeting => ({
    id: `${g.id}|${meeting.id}`,
    label: `${D.group(g.id)?.name || g.id} · ${meeting.d} ${meeting.t} · ${meeting.title || 'Meeting'}`
  }))) : allPlans().map(plan => ({
    id: plan.id,
    label: `${plan.title} · ${plan.date} ${plan.time || ''}`
  }));
  if (!targets.length) return toast(L('Schedule a meeting first', 'جدول اجتماعاً أولاً'), '', 'warning');
  openModal({
    title: L('Choose where to add this hymn', 'اختر الخدمة لإضافة الترنيمة'),
    sub: L(m.title, m.ar),
    body: <div className="formrow"><label className="label" htmlFor="music_target">{L('Service or meeting', 'الخدمة أو الاجتماع')}</label>{" "}<Select id="music_target"><option value="">{L('Choose one', 'اختر واحدة')}</option>{targets.map(target => <option value={target.id}>{target.label}</option>)}</Select></div>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="music_add">{L('Add hymn', 'إضافة الترنيمة')}</button></>,
    onMount(el) {
      el.querySelector('#music_add').addEventListener('click', () => {
        const selected = el.querySelector('#music_target').value;
        if (!selected) return toast(L('Choose a service or meeting', 'اختر خدمة أو اجتماعاً'), '', 'warning');
        if (leader) {
          const [gid, meetingId] = selected.split('|'),
            meeting = D.groupInfo(gid).meetings.find(x => x.id === meetingId);
          if (!meeting) return;
          meeting.hymns ||= [];
          if (meeting.hymns.includes(mid)) return toast(L('Hymn already added', 'الترنيمة مضافة مسبقاً'), '', 'warning');
          meeting.hymns.push(mid);
        } else {
          const plan = allPlans().find(x => x.id === selected);
          if (!plan) return;
          plan.order.push({
            dur: '4',
            t: `Hymn — ${m.title}`,
            ar: `لحن — ${m.ar}`,
            note: m.key ? `Key: ${m.key}` : '',
            noteAr: m.key ? `المقام: ${m.key}` : '',
            who: 'g1',
            hymnId: mid
          });
          normalizePlanOrder(plan, 'reflow');
        }
        closeOverlays();
        refresh();
        ok(L('Hymn added', 'أُضيفت الترنيمة'), L(m.title, m.ar));
      });
    }
  });
}

/* ═════════════ music ═════════════ */
export function play(mid) {
  const m = D.MUSIC.find(x => x.id === mid);
  if (!m) return;
  const links = [m.youtubeUrl, m.anghamiUrl, m.otherUrl].filter(Boolean);
  const safe = links.find(value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  });
  if (safe) window.open(safe, '_blank', 'noopener,noreferrer');else toast(L('No playable recording linked', 'لا تسجيل مرتبط للتشغيل'), L('Add a real YouTube, Anghami, or recording link to this hymn.', 'أضف رابط يوتيوب أو أنغامي أو تسجيل حقيقي لهذا اللحن.'), 'warning');
}
export function setlistOpen(id) {
  const s = D.SETLISTS.find(x => x.id === id) || D.SETLISTS[0];
  openDrawer({
    title: L(s.name, s.ar),
    sub: s.service ? L('Linked to Sunday Mass 10:30', 'مرتبطة بقدّاس الأحد ١٠:٣٠') : L('Not linked to a service yet', 'غير مرتبطة بخدمة بعد'),
    body: s.items.map((mid, i) => {
      const m = D.MUSIC.find(x => x.id === mid);
      return m ? <div className="listrow" style={{
        paddingInline: 0
      }}><span className="mono dim" style={{
          width: "22px"
        }}>{i + 1}</span><span className="grow"><b>{m.title}</b>{" "}<small style={{
            fontFamily: "var(--arabic)"
          }}>{m.ar} · {m.key}</small></span>{" "}<button className="iconbtn" data-play={m.id} aria-label={L('Play', 'استماع')}><Icon name='play' size={16} /></button></div> : '';
    }),
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-primary" id="sl_print" style={{
        marginInlineStart: "auto"
      }}><Icon name='print' size={16} />{L('Print choir folder', 'طباعة ملف الجوقة')}</button></>,
    onMount(el) {
      el.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => play(b.dataset.play)));
      el.querySelector('#sl_print').addEventListener('click', () => {
        closeOverlays();
        setTimeout(() => window.print(), 250);
      });
    }
  });
}

/* ═════════════ volunteers ═════════════ */
export function sheetOpen(id) {
  const s = D.SIGNUP_SHEETS.find(x => x.id === id);
  if (!s) return;
  const assigned = s.people || [],
    legacy = Math.max(0, (s.taken || 0) - assigned.length);
  openDrawer({
    title: L(s.what, s.whatAr),
    sub: `${s.taken} / ${s.slots} · ${L('closes', 'يقفل')} ${fmtDate(s.deadline)}`,
    body: <>{legacy ? <p className="alert alert-info">{legacy}{" "}{L('previously filled places have no names saved; these remain reserved.', 'مراكز مُعبّأة سابقاً بلا أسماء محفوظة؛ تبقى محجوزة.')}</p> : ''}{" "}<p className="help">{L('Select several volunteers, then save. Unchecking a named volunteer removes them from this sheet.', 'اختر عدة متطوعين ثم احفظ. إزالة علامة متطوع مسمّى تُخرجه من اللائحة.')}</p>{" "}<div className="choice-grid" style={{
        marginTop: "14px"
      }}>{D.VOLUNTEERS.map(v => D.person(v.p)).filter(Boolean).map(p => <label className="check"><input type="checkbox" name="sheet-person" defaultValue={p.id} defaultChecked={!!assigned.includes(p.id)} /><span>{L(p.lat, p.ar)}</span></label>)}</div>{" "}<p className="help">{L('Capacity', 'السعة')}: {s.slots} · {L('previously filled without names', 'محجوز سابقاً بلا أسماء')}: {legacy}</p></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="sh_save" style={{
        marginInlineStart: "auto"
      }}>{L('Save participants', 'حفظ المشاركين')}</button></>,
    onMount(el) {
      el.querySelector('#sh_save').addEventListener('click', async () => {
        const people = [...el.querySelectorAll('[name="sheet-person"]:checked')].map(x => x.value);
        if (people.length + legacy > s.slots) return toast(L('Sheet is full', 'اللائحة ممتلئة'), L('Increase capacity or remove a participant.', 'زد السعة أو أزل مشاركاً.'), 'warning');
        s.people = people;
        s.taken = legacy + people.length;
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Participants saved', 'حُفظ المشاركون'), `${s.taken} / ${s.slots}`);
      });
    }
  });
}

/* ═════════════ registration ═════════════ */
export function formNew() {
  /* An event that is not in the calendar yet can be described right here; it is created together
     with the form, so cancelling the drawer leaves nothing half-made behind. */
  const canMakeEvent = is('priest', 'secretary');
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  let draft = null;
  const place = id => {
    const v = D.venue(id);
    return v ? L(v.name, v.ar || v.name) : '';
  };
  const hm = x => {
    const [h, m] = String(x || '0:0').split(':').map(Number);
    return h * 60 + m;
  };
  const options = () => <><option value="">{L('Select an event', 'اختر حدثاً')}</option>{" "}{draft ? <option value="__new__">{L('New', 'جديد')}: {draft.title} · {draft.d} · {place(draft.venue)}</option> : ''}{" "}{eligibleEvents().map(e => <option value={e.id}>{L(e.title, e.titleAr)} · {e.d} · {place(e.venue)}</option>)}</>;
  const KINDS = [['event', L('Parish event', 'حدث رعوي')], ['group', L('Group activity', 'نشاط مجموعة')], ['sacr', L('Sacrament celebration', 'احتفال بسرّ')]];
  openDrawer({
    title: L('New registration form', 'استمارة تسجيل جديدة'),
    sub: L('Registration signs someone up for a selected event. Check-in records their arrival at that event.', 'التسجيل يضيف شخصاً إلى حدث محدّد، والتسجيل عند الباب يثبت وصوله إليه.'),
    body: <><div className="formrow"><label className="label" htmlFor="rf_e">{L('Event', 'الحدث')}<span className="req">*</span></label><Select id="rf_e">{options()}</Select></div>{" "}<div className="help" id="rf_context">{L('Choose the event before creating its registration form.', 'اختر الحدث قبل إنشاء استمارة التسجيل الخاصة به.')}</div>{" "}{canMakeEvent ? <><button type="button" className="btn btn-ghost btn-dense" id="rf_newev" aria-expanded="false" aria-controls="rf_evbox" style={{
          margin: "2px 0 14px",
          paddingInline: "8px"
        }}><Icon name='plus' size={15} /><span>{L('The event isn’t listed — create it here', 'الحدث غير موجود؟ أنشئه هنا')}</span></button>{" "}<div className="inlinecard" id="rf_evbox" hidden><div className="inlinecard-h"><b>{L('New event', 'حدث جديد')}</b>{" "}<span className="t-caption dim">{L('It is added to the calendar when you create this form.', 'يُضاف إلى الرزنامة حين تُنشئ هذه الاستمارة.')}</span></div>{" "}<C.Field label={L('Event title', 'عنوان الحدث')} req={true} id='ne_t' ph={L('Youth retreat', 'خلوة الشبيبة')} />{" "}<div className="formgrid"><C.Field label={L('Date', 'التاريخ')} type='date' req={true} id='ne_d' value='' />{" "}<div className="formrow"><label className="label" htmlFor="ne_v">{L('Room', 'القاعة')}</label><Select id="ne_v">{D.VENUES.map(v => <option value={v.id}>{place(v.id)}</option>)}</Select></div></div>{" "}<div className="formgrid"><C.Field label={L('From', 'من')} type='time' id='ne_from' value='18:00' />{" "}<C.Field label={L('To', 'إلى')} type='time' id='ne_to' value='20:00' /></div>{" "}<div className="formrow"><label className="label" htmlFor="ne_k">{L('Kind of event', 'نوع الحدث')}</label><Select id="ne_k">{KINDS.map(([k, lab]) => <option value={k}>{lab}</option>)}</Select>{" "}<span className="help">{L('Masses are not registered for, so they are not offered here.', 'لا يُسجَّل للقداديس، لذلك لا تظهر هنا.')}</span></div>{" "}<div className="formrow" id="ne_group_row" hidden><label className="label" htmlFor="ne_group">{L('Group', 'المجموعة')}</label><Select id="ne_group"><option value="">{L('Choose a group', 'اختر مجموعة')}</option>{D.GROUPS.map(g => <option value={g.id}>{L(g.name, g.ar)}</option>)}</Select></div>{" "}<div id="ne_clash" />{" "}<div className="inlinecard-acts"><button type="button" className="btn btn-secondary btn-dense" id="ne_cancel">{L('Cancel', 'إلغاء')}</button>{" "}<button type="button" className="btn btn-primary btn-dense" id="ne_ok"><Icon name='check' size={15} />{L('Use this event', 'استعمل هذا الحدث')}</button></div></div></> : ''}{" "}<div className="formgrid"><C.Stepper label={L('Capacity', 'السعة')} value={60} id='rf_cap' />{" "}<C.Field label={L('Closes', 'يقفل')} type='date' value={deadline.toLocaleDateString('sv-SE')} id='rf_dl' /></div>{" "}<C.Field label={L('Fee', 'الرسم')} id='rf_fee' type='number' value={0} />{" "}<div className="formrow"><label className="label" htmlFor="rf_currency">{L('Currency', 'العملة')}</label><Select id="rf_currency"><option>USD</option><option>LBP</option></Select></div>{" "}<div className="registration-section"><h3>{L('Transport options', 'خيارات النقل')}</h3><C.CheckRow label={L('Allow own transport', 'السماح بالنقل الخاص')} id='rf_own' checked={true} /><C.CheckRow label={L('Offer parish bus', 'توفير باص الرعية')} id='rf_bus' /><C.Field label={L('Bus fee (event currency)', 'رسم الباص (عملة الحدث)')} id='rf_bus_fee' type='number' value={0} /></div>{" "}<div className="stack" style={{
        gap: "10px"
      }}><C.CheckRow label={L('Household registration', 'تسجيل عائلي')} checked={true} id='rf_household' />{" "}<C.CheckRow label={L('Waiting list once full', 'لائحة انتظار عند الامتلاء')} checked={true} id='rf_waitlist' />{" "}<C.CheckRow label={L('Parental consent for under-18s', 'موافقة الأهل لمن دون ١٨')} checked={true} id='rf_consent' /></div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="rf_go" style={{
        marginInlineStart: "auto"
      }}>{L('Create form', 'إنشاء الاستمارة')}</button></>,
    onMount(el) {
      const sel = el.querySelector('#rf_e'),
        box = el.querySelector('#rf_evbox'),
        opener = el.querySelector('#rf_newev');
      const context = () => {
        const e = sel.value === '__new__' ? draft : eventById(sel.value);
        el.querySelector('#rf_context').textContent = e ? `${sel.value === '__new__' ? L('New event, created with this form', 'حدث جديد يُنشأ مع هذه الاستمارة') + ' — ' : ''}${L(e.title, e.titleAr || e.title)} · ${e.d} ${e.t}${e.to ? `–${e.to}` : ''} · ${place(e.venue)}` : L('Choose the event before creating its registration form.', 'اختر الحدث قبل إنشاء استمارة التسجيل الخاصة به.');
      };
      sel.addEventListener('change', context);
      if (box) {
        const v = q => el.querySelector(q).value;
        el.querySelector('#ne_k').addEventListener('change', () => {
          el.querySelector('#ne_group_row').hidden = v('#ne_k') !== 'group';
        });
        /* the room is checked against the calendar, room bookings (with their set-up time) and maintenance blocks */
        const showClash = () => {
          const d = v('#ne_d'),
            from = v('#ne_from'),
            to = v('#ne_to'),
            room = v('#ne_v');
          const block = d && D.MAINTENANCE.find(m => m.venue === room && m.from <= d && d <= m.to);
          const ev = d && D.EVENTS.find(x => x.venue === room && x.d === d && x.kind !== 'pending' && hm(x.t) < hm(to) && hm(from) < (x.to ? hm(x.to) : hm(x.t) + (x.kind === 'mass' ? 60 : 90)));
          const res = d && D.RESERVATIONS.find(r => r.venue === room && r.date === d && r.status !== 'rejected' && hm(r.from) - (+r.setup || 0) < hm(to) && hm(from) < hm(r.to));
          const c = ev ? {
            title: L(ev.title, ev.titleAr || ev.title),
            at: ev.t
          } : res ? {
            title: L(res.title, res.titleAr || res.title),
            at: res.from
          } : null;
          paint(el.querySelector('#ne_clash'), !d ? '' : d < today ? <C.InlineAlert tone='warning' title={L('That day has passed', 'هذا اليوم مضى')} body={L('Choose today or a later date.', 'اختر اليوم أو تاريخاً لاحقاً.')} /> : hm(from) >= hm(to) ? <C.InlineAlert tone='warning' title={L('The event ends before it starts', 'ينتهي الحدث قبل أن يبدأ')} body={L('Check the two times.', 'تحقّق من الوقتين.')} /> : block ? <C.InlineAlert tone='warning' title={L(`${place(room)} is closed for maintenance`, `${place(room)} مغلقة للصيانة`)} body={L(`${block.why} · ${fmtDate(block.from)} – ${fmtDate(block.to)}. Pick another room or day.`, `${block.whyAr || block.why} · ${fmtDate(block.from)} – ${fmtDate(block.to)}. اختر قاعة أو يوماً آخر.`)} /> : c ? <C.InlineAlert tone='warning' title={L(`${place(room)} is taken`, `${place(room)} محجوزة`)} body={L(`${c.title} is there from ${c.at}. Pick another room or time.`, `${c.title} فيها من ${c.at}. اختر قاعة أو وقتاً آخر.`)} /> : <C.InlineAlert tone='success' title={L('The room is free', 'القاعة متاحة')} body={L(`${place(room)} is free at that time.`, `${place(room)} متاحة في ذلك الوقت.`)} />);
        };
        ['#ne_d', '#ne_from', '#ne_to', '#ne_v'].forEach(q => el.querySelector(q).addEventListener('change', showClash));
        const toggle = open => {
          box.hidden = !open;
          opener.setAttribute('aria-expanded', String(open));
          if (open) el.querySelector('#ne_t').focus();
        };
        opener.addEventListener('click', () => toggle(box.hidden));
        el.querySelector('#ne_cancel').addEventListener('click', () => toggle(false));
        el.querySelector('#ne_ok').addEventListener('click', () => {
          if (v('#ne_k') === 'group' && !v('#ne_group')) return toast(L('Choose a group', 'اختر مجموعة'), '', 'warning');
          if (![need(el, '#ne_t', L('Give the event a title', 'أعطِ الحدث عنواناً')), need(el, '#ne_d', L('Choose today or a later date', 'اختر اليوم أو تاريخاً لاحقاً'), d => !!d && d >= today), need(el, '#ne_to', L('Ends before it starts', 'ينتهي قبل أن يبدأ'), to => hm(to) > hm(v('#ne_from')))].every(Boolean)) return;
          const title = v('#ne_t').trim();
          draft = {
            title,
            titleAr: title,
            d: v('#ne_d'),
            t: v('#ne_from'),
            to: v('#ne_to'),
            venue: v('#ne_v'),
            kind: v('#ne_k'),
            groupId: v('#ne_group')
          };
          paint(sel, options());
          sel.value = '__new__';
          sel.dispatchEvent(new Event('change', {
            bubbles: true
          }));
          opener.querySelector('span').textContent = L('Change the new event', 'عدّل الحدث الجديد');
          toggle(false);
          context();
        });
      }
      el.querySelector('#rf_go').addEventListener('click', async () => {
        let e = sel.value === '__new__' ? draft : eventById(sel.value);
        if (!e) return toast(L('Select an eligible event', 'اختر حدثاً صالحاً'), canMakeEvent ? L('Or create the event here first.', 'أو أنشئ الحدث هنا أولاً.') : '', 'warning');
        if (e === draft) {
          e = {
            id: 'ev' + Date.now().toString(36),
            ...draft
          };
          D.EVENTS.push(e);
          const cat = {
            event: ['Parish life', 'حياة الرعية'],
            group: ['Formation', 'التنشئة'],
            sacr: ['Sacrament', 'سرّ']
          }[e.kind];
          D.EVENT_DETAIL[e.id] = {
            ...D.eventInfo(e),
            cat: cat[0],
            catAr: cat[1],
            cap: +val(el, '#rf_cap') || 60,
            visibility: e.kind === 'group' ? 'groups' : e.kind === 'sacr' ? 'confidential' : 'public',
            visibleGroupIds: e.kind === 'group' ? [e.groupId] : [],
            priestIds: []
          };
        }
        const form = {
          id: 'rg' + Date.now(),
          eventId: e.id,
          event: e.title,
          eventAr: e.titleAr,
          open: true,
          cap: +val(el, '#rf_cap') || 60,
          taken: 0,
          currency: val(el, '#rf_currency'),
          transportOptions: [...(el.querySelector('#rf_own').checked ? [{
            id: 'own',
            name: 'Own transport',
            nameAr: 'نقل خاص',
            fee: 0
          }] : []), ...(el.querySelector('#rf_bus').checked ? [{
            id: 'bus',
            name: 'Parish bus',
            nameAr: 'باص الرعية',
            fee: Number(val(el, '#rf_bus_fee')) || 0
          }] : [])],
          fee: parseFloat(val(el, '#rf_fee')) || 0,
          deadline: val(el, '#rf_dl'),
          waiting: 0,
          fields: [],
          discounts: [],
          installments: [],
          household: el.querySelector('#rf_household').checked,
          waitingList: el.querySelector('#rf_waitlist').checked,
          parentalConsent: el.querySelector('#rf_consent').checked
        };
        D.REGISTRATIONS.unshift(form);
        selectRegistration(form.id);
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(sel.value === '__new__' ? L('Event and form created', 'أُنشئ الحدث والاستمارة') : L('Form created and open', 'أُنشئت الاستمارة وفُتحت'), `${L(e.title, e.titleAr)} · ${e.d}`);
      });
    }
  });
}
export function registerParticipant() {
  participantForm(selectedRegistration());
}
export function fieldAdd() {
  const form = selectedRegistration();
  if (!form || !linkedEvent(form)) return toast(L('Select a linked registration form', 'اختر استمارة مرتبطة بحدث'), '', 'warning');
  openModal({
    title: L('Add a field', 'إضافة حقل'),
    body: <><div className="formgrid"><C.Field label={L('Label (English)', 'التسمية (إنكليزي)')} req={true} id='ff_en' />{" "}<C.Field label={L('Label (Arabic)', 'التسمية (عربي)')} dir='rtl' ar={true} id='ff_ar' /></div>{" "}<div className="formrow"><label className="label">{L('Type', 'النوع')}</label><Select id="ff_t"><option value="text">{L('Short text', 'نصّ قصير')}</option><option value="choice">{L('Choice', 'اختيار')}</option><option value="date">{L('Date', 'تاريخ')}</option><option value="file">{L('File', 'ملف')}</option><option value="consent">{L('Consent', 'موافقة')}</option><option value="restricted">{L('Restricted (medical)', 'مقيّد (طبي)')}</option></Select></div>{" "}<C.CheckRow label={L('Required', 'إلزامي')} /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="ff_go" style={{
        marginInlineStart: "auto"
      }}>{L('Add field', 'إضافة الحقل')}</button></>,
    onMount(el) {
      el.querySelector('#ff_go').addEventListener('click', async () => {
        if (!need(el, '#ff_en', L('Give it a label', 'أعطه تسمية'))) return;
        const en = val(el, '#ff_en');
        form.fields.push([en, val(el, '#ff_ar') || en, el.querySelector('#ff_t').value, el.querySelector('.check input').checked, '', '']);
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Field added', 'أُضيف الحقل'), en);
      });
    }
  });
}
export function fieldMenu(btn, i) {
  const f = selectedRegistration()?.fields;
  if (!f) return;
  i = +i;
  openMenu(btn, [{
    label: L('Make required', 'اجعله إلزامياً'),
    icon: 'check',
    fn: async () => {
      f[i][3] = true;
      if (!(await persist())) return;
      refresh();
      ok(L('Now required', 'صار إلزامياً'));
    }
  }, {
    label: L('Move up', 'نقل للأعلى'),
    icon: 'chevL',
    fn: async () => {
      if (i > 0) {
        [f[i - 1], f[i]] = [f[i], f[i - 1]];
        if (await persist()) refresh();
      }
    }
  }, {
    sep: true
  }, {
    label: L('Remove field', 'إزالة الحقل'),
    icon: 'trash',
    danger: true,
    fn: async () => {
      const [x] = f.splice(i, 1);
      if (!(await persist())) return;
      refresh();
      ok(L('Field removed', 'أُزيل الحقل'), L(x[0], x[1]));
    }
  }]);
}

/* ═════════════ check-in ═════════════ */
export function scan() {
  const event = selectableCheckinEvents().find(e => e.id === S.ui.checkinEventId);
  if (!event) return toast(L('Select an event first', 'اختر حدثاً أولاً'), '', 'warning');
  openModal({
    title: L('Check in by registration reference', 'التسجيل برقم الاشتراك'),
    sub: `${L(event.title, event.titleAr)} · ${event.d} ${event.t} · ${L(D.venue(event.venue)?.name || '', D.venue(event.venue)?.ar || '')}`,
    body: <div className="formrow"><label className="label" htmlFor="sc_code">{L('Registrant reference', 'رقم المشترك')}</label>{" "}<input className="input mono" id="sc_code" placeholder={L('Enter the reference on the registration', 'أدخل الرقم على التسجيل')} dir="ltr" /></div>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="sc_go" style={{
        marginInlineStart: "auto"
      }}>{L('Check in', 'تسجيل الدخول')}</button></>,
    onMount(el) {
      const found = () => {
        const forms = D.REGISTRATIONS.filter(f => f.eventId === event.id).map(f => f.id);
        const registrant = D.REGISTRANTS.find(r => r.id === val(el, '#sc_code') && forms.includes(r.registrationId));
        if (!registrant) return toast(L('Reference not registered for this event', 'الرقم غير مسجّل لهذا الحدث'), '', 'warning');
        if (!canCheckIn(registrant, D.REGISTRATIONS.find(f => f.id === registrant.registrationId))) return toast(L('Confirm the place and required consent first', 'ثبّت المقعد والموافقة المطلوبة أولاً'), '', 'warning');
        const session = ensureCheckinSession(event.id);
        if (session.rows.some(r => r.p === registrant.p)) return toast(L('Already checked in', 'مسجّل مسبقاً'), '', 'warning');
        const pickup = D.PICKUP[registrant.p],
          required = pickup?.required !== false && !!pickup;
        const code = required ? String(1000 + Math.floor(Math.random() * 9000)) : '';
        session.rows.push({
          p: registrant.p,
          in: new Date().toTimeString().slice(0, 5),
          out: null,
          guardian: pickup?.approved?.[0]?.[0] || '—',
          pickupRequired: required,
          code,
          alert: ''
        });
        session.present = session.rows.length;
        closeOverlays();
        refresh();
        ok(L('Checked in', 'سُجّل الدخول'), `${nameOf(D.person(registrant.p))} · ${L(event.title, event.titleAr)}`);
      };
      el.querySelector('#sc_go').addEventListener('click', found);
    }
  });
}
export function checkinManual() {
  const event = selectableCheckinEvents().find(e => e.id === S.ui.checkinEventId);
  if (!event) return toast(L('Select an event first', 'اختر حدثاً أولاً'), '', 'warning');
  const forms = D.REGISTRATIONS.filter(f => f.eventId === event.id).map(f => f.id);
  const allowed = D.REGISTRANTS.filter(r => forms.includes(r.registrationId) && canCheckIn(r, D.REGISTRATIONS.find(f => f.id === r.registrationId))).map(r => r.p);
  pickPerson({
    title: L('Manual check-in', 'تسجيل يدوي'),
    sub: `${L(event.title, event.titleAr)} · ${event.d} ${event.t} · ${L(D.venue(event.venue)?.name || '', D.venue(event.venue)?.ar || '')}`,
    cta: L('Check in', 'تسجيل الدخول'),
    exclude: selectedCheckin()?.rows.map(r => r.p) || [],
    allow: allowed,
    onPick: p => {
      const pickup = D.PICKUP[p.id],
        required = pickup?.required !== false && !!pickup;
      const code = required ? String(1000 + Math.floor(Math.random() * 9000)) : '';
      const session = ensureCheckinSession(event.id);
      if (!session || session.rows.some(r => r.p === p.id)) return;
      session.rows.push({
        p: p.id,
        in: new Date().toTimeString().slice(0, 5),
        out: null,
        guardian: pickup?.approved?.[0]?.[0] || '—',
        pickupRequired: required,
        code,
        alert: ''
      });
      session.present = session.rows.length;
      refresh();
      ok(L('Checked in', 'سُجّل الدخول'), `${nameOf(p)}${required ? ` · ${L('pickup code', 'رمز الاستلام')} ${code}` : ` · ${L('No pickup required', 'لا حاجة إلى استلام')}`}`);
    }
  });
}
export function pickupAdd(pid) {
  openModal({
    title: L('Add an authorised person', 'إضافة شخص مفوَّض'),
    sub: nameOf(D.person(pid)),
    body: <><div className="formgrid"><C.Field label={L('Name (English)', 'الاسم (إنكليزي)')} req={true} id='pk_en' />{" "}<C.Field label={L('Name (Arabic)', 'الاسم (عربي)')} dir='rtl' ar={true} id='pk_ar' /></div>{" "}<div className="formrow"><label className="label">{L('Relationship', 'الصلة')}</label><Select id="pk_r"><option>grandparent</option><option>aunt</option><option>uncle</option><option>family friend</option></Select></div>{" "}<C.CheckRow label={L('ID checked by a member of staff', 'تحقّق موظّف من الهوية')} checked={true} /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="pk_go" style={{
        marginInlineStart: "auto"
      }}>{L('Authorise', 'تفويض')}</button></>,
    onMount(el) {
      el.querySelector('#pk_go').addEventListener('click', () => {
        if (!need(el, '#pk_en', L('Enter a name', 'أدخل اسماً'))) return;
        const en = val(el, '#pk_en');
        D.PICKUP[pid] ||= {
          approved: [],
          restricted: [],
          required: true
        };
        D.PICKUP[pid].approved.push([en, val(el, '#pk_ar') || en, el.querySelector('#pk_r').value]);
        closeOverlays();
        refresh();
        ok(L('Authorised to collect', 'مفوَّض بالاستلام'), en);
      });
    }
  });
}
export function pickupRemove(pid, i) {
  const list = D.PICKUP[pid].approved;
  const [x] = list.splice(+i, 1);
  refresh();
  ok(L('No longer authorised', 'لم يعد مفوَّضاً'), L(x[0], x[1]), {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        list.splice(+i, 0, x);
        refresh();
      }
    }
  });
}
export function incidentNew() {
  openDrawer({
    title: L('Record an incident', 'تسجيل حادث'),
    sub: L('Restricted to the priest and the safeguarding lead. Opening it is logged.', 'مقيّد للكاهن ومسؤول الحماية. وفتحه يُسجَّل.'),
    body: <><C.PersonPicker label={L('Child involved', 'الطفل المعني')} id='in_p' />{" "}<div className="formrow"><label className="label">{L('Where', 'أين')}</label><Select id="in_room">{D.VENUES.map(v => <option value={v.id}>{L(v.name, v.ar)}</option>)}</Select></div>{" "}<C.Textarea label={L('What happened', 'ما حدث')} id='in_what' max={600} />{" "}<C.CheckRow label={L('Guardian informed', 'أُبلغ وليّ الأمر')} checked={true} /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="in_go" style={{
        marginInlineStart: "auto"
      }}>{L('Save report', 'حفظ التقرير')}</button></>,
    onMount(el) {
      el.querySelector('#in_go').addEventListener('click', () => {
        if (!need(el, '#in_what', L('Describe what happened', 'صف ما حدث'))) return;
        const w = val(el, '#in_what');
        D.INCIDENTS.unshift({
          id: 'in' + Date.now(),
          at: '2026-10-04 19:31',
          room: el.querySelector('#in_room').value,
          what: w,
          whatAr: w,
          by: 'p16',
          restricted: true
        });
        closeOverlays();
        refresh();
        ok(L('Report saved', 'حُفظ التقرير'), L('Restricted and logged.', 'مقيّد ومسجَّل.'));
      });
    }
  });
}
export function incidentOpen(id) {
  const i = D.INCIDENTS.find(x => x.id === id) || D.INCIDENTS[0];
  openDrawer({
    title: L('Incident report', 'تقرير حادث'),
    sub: <><span className="mono">{i.at}</span> · {L(D.venue(i.room).name, D.venue(i.room).ar)}</>,
    body: <><C.InlineAlert tone='warning' title={L('Restricted record', 'سجل مقيّد')} body={L('Your access to this report has been logged.', 'سُجّل وصولك إلى هذا التقرير.')} />{" "}<dl className="dl" style={{
        marginTop: "16px"
      }}><dt>{L('Recorded by', 'سجّله')}</dt><dd>{nameOf(D.person(i.by))}</dd><dt>{L('When', 'متى')}</dt><dd className="mono">{i.at}</dd></dl>{" "}<p className="t-body" style={{
        marginTop: "14px",
        fontSize: "14px"
      }}>{L(i.what, i.whatAr)}</p></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-secondary" id="io_print" style={{
        marginInlineStart: "auto"
      }}><Icon name='print' size={16} />{L('Print', 'طباعة')}</button></>,
    onMount(el) {
      el.querySelector('#io_print').addEventListener('click', () => {
        closeOverlays();
        setTimeout(() => window.print(), 250);
      });
    }
  });
}

/* ═════════════ facilities ═════════════ */
/* ═════════════ portal ═════════════ */
export function contentEdit(key = 'history') {
  const sections = {
    welcome: ['Welcome message', 'رسالة الترحيب'],
    history: ['Parish history and patron saint', 'تاريخ الرعية والشفيع'],
    massTimes: ['Mass and confession information', 'معلومات القداديس والاعتراف'],
    contact: ['Contact and visiting information', 'معلومات التواصل والزيارة'],
    sacraments: ['Sacraments and certificates', 'الأسرار والشهادات']
  };
  if (!sections[key]) key = 'history';
  const c = D.CONTENT[key] || {
    en: '',
    ar: '',
    published: false
  };
  openDrawer({
    large: true,
    title: L(...sections[key]),
    sub: L('Edit both languages, preview, then save a draft or publish.', 'حرّر اللغتين وعاين ثم احفظ مسودة أو انشر.'),
    body: <>{key === 'sacraments' ? <p className="help" style={{
        margin: "0 0 16px"
      }}>{L('This text introduces the request buttons on your public page: baptism, First Communion, confirmation, marriage, funeral and certificates. Mention anything families should know first, such as preparation sessions or documents. Without it, a short default introduction is shown.', 'يقدّم هذا النص أزرار الطلبات في صفحتك العامة: المعمودية والمناولة الأولى والميرون والإكليل والجنّاز والشهادات. اذكر ما يجب أن تعرفه العائلات أولاً، مثل لقاءات التحضير أو المستندات. ومن دونه تظهر مقدّمة قصيرة افتراضية.')}</p> : ''}<div className="formrow"><label className="label" htmlFor="ce-en">English</label><textarea className="input" id="ce-en" rows="6" maxLength="10000" defaultValue={c.en || ''} /></div>{" "}<div className="formrow"><label className="label" htmlFor="ce-ar">العربية</label><textarea className="input" id="ce-ar" rows="6" maxLength="10000" dir="rtl" defaultValue={c.ar || ''} /></div>{" "}<div className="panel" style={{
        marginTop: "14px"
      }}><div className="panel-b"><b>{L('Preview', 'معاينة')}</b><div id="ce-preview" className="stack" style={{
            marginTop: "10px",
            whiteSpace: "pre-wrap"
          }} /></div></div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-secondary" id="ce_draft">{L('Save draft', 'حفظ مسودة')}</button>{" "}<button className="btn btn-primary" id="ce_go" style={{
        marginInlineStart: "auto"
      }}>{L('Publish', 'نشر')}</button></>,
    onMount(el) {
      const preview = () => {
        paint(el.querySelector('#ce-preview'), <><p><b>English</b><br />{el.querySelector('#ce-en').value || '—'}</p><p dir="rtl"><b>العربية</b><br />{el.querySelector('#ce-ar').value || '—'}</p></>);
      };
      el.querySelectorAll('#ce-en,#ce-ar').forEach(field => field.addEventListener('input', preview));
      preview();
      const save = async published => {
        const en = val(el, '#ce-en'),
          ar = val(el, '#ce-ar');
        if (published && (!en || !ar)) return toast(L('Enter both languages before publishing', 'أدخل اللغتين قبل النشر'), '', 'warning');
        const previous = D.CONTENT[key];
        D.CONTENT[key] = {
          en,
          ar,
          published
        };
        if (!(await persist())) {
          if (previous) D.CONTENT[key] = previous;else delete D.CONTENT[key];
          return;
        }
        closeOverlays();
        refresh();
        ok(published ? L('Published', 'نُشر') : L('Draft saved', 'حُفظت المسودة'), L('Parish content saved', 'حُفظ محتوى الرعية'));
      };
      el.querySelector('#ce_go').addEventListener('click', () => save(true));
      el.querySelector('#ce_draft').addEventListener('click', () => save(false));
    }
  });
}

/* ═════════════ giving ═════════════ */
export function lineEdit(i) {
  const l = D.BATCH.lines[+i];
  if (!l) return;
  openModal({
    title: L('Edit envelope', 'تعديل المظروف'),
    sub: l.env ? <span className="mono">{l.env}</span> : L('Unattributed', 'غير مسمّى'),
    body: <C.CurrencyField label={L('Amount', 'المبلغ')} value={(l.usd || l.lbp / D.RATE.value).toFixed(2)} id='le_amt' />,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="le_go" style={{
        marginInlineStart: "auto"
      }}>{L('Save', 'حفظ')}</button></>,
    onMount(el) {
      el.querySelector('#le_go').addEventListener('click', () => {
        const before = {
            ...l
          },
          v = parseFloat(val(el, '#le_amt').replace(/,/g, '')) || 0;
        if (l.usd != null) l.usd = v;else l.lbp = Math.round(v * D.RATE.value);
        closeOverlays();
        refresh();
        ok(L('Envelope corrected', 'صُحّح المظروف'), usd(v), {
          action: {
            label: L('Undo', 'تراجع'),
            fn: () => {
              Object.assign(l, before);
              refresh();
            }
          }
        });
      });
    }
  });
}
export function lineReverse(i) {
  const lines = D.BATCH.lines;
  const [l] = lines.splice(+i, 1);
  refresh();
  toast(L('Line reversed', 'عُكس البند'), L('A reversing entry stays in the history.', 'يبقى القيد العكسي في السجل.'), 'warning', {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        lines.splice(+i, 0, l);
        refresh();
      }
    }
  });
}

/* ═════════════ services: requests ═════════════ */
export function svcRequestOpen(id) {
  const r = D.SERVICE_REQUESTS.find(x => x.id === id);
  if (!r) return;
  const reqs = requestRequirements(r);
  const stage = r.stage || (r.status === 'pending' ? 'request' : r.status === 'approved' ? 'preparation' : r.status);
  const stageLabel = {
    request: L('Request', 'طلب'),
    approval: L('Approved', 'موافَق عليه'),
    preparation: L('Preparation', 'تحضير'),
    celebration: L('Celebrated', 'احتُفل به'),
    rejected: L('Declined', 'مرفوض')
  }[stage] || stage;
  const canAdvance = is('priest') && !['celebrated', 'rejected'].includes(r.status);
  openDrawer({
    title: L(r.kind, r.kindAr),
    sub: `${nameOf(D.person(r.by))} · ${fmtDate(r.date)}`,
    body: <><dl className="dl"><dt>{L('Status', 'الحالة')}</dt><dd><Status k={r.status} /></dd><dt>{L('Requested by', 'مقدَّم من')}</dt><dd>{nameOf(D.person(r.by))}</dd><dt>{L('Preferred date and time', 'التاريخ والوقت المفضّلان')}</dt><dd className="mono">{fmtDate(r.date)}{" "}{r.time || ''}</dd><dt>{L('Place', 'المكان')}</dt><dd>{D.venue(r.venue)?.name || r.place || '—'}</dd><dt>{L('Contact', 'التواصل')}</dt><dd>{r.contact || '—'}</dd><dt>{L('Purpose / intention', 'الغاية / النيّة')}</dt><dd>{r.purpose || '—'}</dd><dt>{L('Language', 'اللغة')}</dt><dd>{r.language || '—'}</dd><dt>{L('Notes', 'ملاحظات')}</dt><dd>{r.notes || '—'}</dd>{r.celebratedAt ? <><dt>{L('Celebrated on', 'تاريخ الاحتفال')}</dt><dd>{fmtDate(r.celebratedAt)}</dd></> : ''}</dl>{" "}<div className="divider" /><h4 className="t-ui" style={{
        marginBottom: "10px"
      }}>{L('Progress', 'التقدّم')}</h4>{" "}<p className="t-caption dim">{L('Request → priest approval → preparation → celebration', 'طلب ← موافقة الكاهن ← تحضير ← احتفال')}</p>{" "}<p className="t-caption">{L('Current stage', 'المرحلة الحالية')}: <b>{stageLabel}</b></p>{" "}<RequestDocuments record={r} scope="service-request" onChange={() => {
        closeOverlays();
        svcRequestOpen(id);
      }} />{" "}{r.status === 'ready' ? <C.Field label={L('Actual celebration date', 'تاريخ الاحتفال الفعلي')} id='sr_actual' type='date' value={new Date().toLocaleDateString('sv-SE')} /> : ''}{" "}{r.status === 'celebrated' ? <C.InlineAlert tone='success' title={L('Celebration recorded', 'سُجّل الاحتفال')} body={L('This service request does not create an official sacramental register entry.', 'لا ينشئ طلب الخدمة هذا قيداً رسمياً في سجل الأسرار.')} /> : ''}</>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}{r.status === 'pending' && is('priest') ? <button className="btn btn-secondary" id="srreject">{L('Decline', 'رفض')}</button> : ''}{" "}{canAdvance ? <button className="btn btn-primary" id="srok" style={{
        marginInlineStart: "auto"
      }}>{r.status === 'pending' ? L('Approve request', 'الموافقة على الطلب') : r.status === 'approved' ? L('Start preparation', 'بدء التحضير') : r.status === 'preparing' ? L('Mark ready', 'جاهز للاحتفال') : L('Record celebration', 'تسجيل الاحتفال')}</button> : ''}</>,
    onMount(el) {
      el.querySelector('#srok')?.addEventListener('click', async () => {
        if (['preparing', 'ready'].includes(r.status) && reqs.some(([en,, required]) => required && !r.documents?.[en])) return toast(L('Complete the missing requirements first', 'أكمل المتطلبات الناقصة أولاً'), '', 'warning');
        const next = {
          pending: 'approved',
          approved: 'preparing',
          preparing: 'ready',
          ready: 'celebrated'
        }[r.status];
        if (!next) return;
        if (next === 'celebrated') {
          const actual = val(el, '#sr_actual'),
            todayKey = new Date().toLocaleDateString('sv-SE');
          if (!actual || actual > todayKey) return toast(L('Enter the actual date, today or earlier', 'أدخل التاريخ الفعلي، اليوم أو قبله'), '', 'warning');
          r.celebratedAt = actual;
        }
        r.status = next;
        r.stage = next === 'approved' ? 'approval' : next === 'preparing' || next === 'ready' ? 'preparation' : 'celebration';
        r.history ||= [];
        r.history.push({
          at: new Date().toISOString(),
          status: next,
          by: me()?.id || null
        });
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Request updated', 'حُدّث الطلب'), L(r.kind, r.kindAr));
      });
      el.querySelector('#srreject')?.addEventListener('click', async () => {
        r.status = 'rejected';
        r.stage = 'rejected';
        r.history ||= [];
        r.history.push({
          at: new Date().toISOString(),
          status: 'rejected',
          by: me()?.id || null
        });
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Request declined', 'رُفض الطلب'));
      });
    }
  });
}
export function svcRequestNew(kind = 'Mass|قدّاس') {
  const [en, ar] = kind.split('|');
  openDrawer({
    title: L(`Request — ${en}`, `طلب — ${ar}`),
    body: <><div className="formrow"><label className="label" htmlFor="sq_p">{L('Requested by', 'مقدَّم من')}</label><Select id="sq_p"><option value="">{L('Choose a person', 'اختر شخصاً')}</option>{D.PEOPLE.map(p => <option value={p.id}>{L(p.lat, p.ar)}</option>)}</Select></div>{" "}<div className="formgrid"><C.Field label={L('Preferred date', 'التاريخ المفضّل')} type='date' id='sq_d' />{" "}<C.Field label={L('Preferred time', 'الوقت المفضّل')} type='time' id='sq_t' /></div>{" "}<div className="formrow"><label className="label" htmlFor="sq_v">{L('Preferred place', 'المكان المفضّل')}</label><Select id="sq_v"><option value="">{L('To be arranged', 'يُحدّد لاحقاً')}</option>{D.VENUES.map(v => <option value={v.id}>{L(v.name, v.ar)}</option>)}</Select></div>{" "}<C.Field label={L('Contact phone or email', 'رقم الهاتف أو البريد')} id='sq_c' req={true} max={160} />{" "}<C.Field label={L('Purpose or intention', 'الغاية أو النيّة')} id='sq_i' req={true} max={240} />{" "}<div className="formrow"><label className="label" htmlFor="sq_l">{L('Language', 'اللغة')}</label><Select id="sq_l"><option value="Arabic">{L('Arabic', 'عربي')}</option><option value="Arabic & Syriac">{L('Arabic & Syriac', 'عربي وسرياني')}</option><option value="Bilingual">{L('Bilingual', 'ثنائي')}</option></Select></div>{" "}<C.Textarea label={L('Notes for the office', 'ملاحظات للمكتب')} id='sq_n' max={1000} />{" "}{['baptism', 'wedding'].includes(en.toLowerCase()) ? <p className="help">{L('A service request plans the ceremony. Submit the sacramental request separately for the official register.', 'طلب الخدمة يخطّط للاحتفال. قدّم طلب السرّ منفصلاً للسجل الرسمي.')}</p> : ''}</>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="sq_go" style={{
        marginInlineStart: "auto"
      }}>{L('Send request', 'إرسال الطلب')}</button></>,
    onMount(el) {
      el.querySelector('#sq_go').addEventListener('click', async () => {
        if (!need(el, '#sq_p', L('Choose the requester', 'اختر مقدّم الطلب')) || !need(el, '#sq_d', L('Choose a date', 'اختر تاريخاً')) || !need(el, '#sq_t', L('Choose a time', 'اختر وقتاً')) || !need(el, '#sq_c', L('Add contact details', 'أضف معلومات التواصل')) || !need(el, '#sq_i', L('Describe the purpose', 'اشرح الغاية'))) return;
        D.SERVICE_REQUESTS.unshift({
          id: 'sr' + Date.now(),
          kind: en,
          kindAr: ar,
          by: val(el, '#sq_p'),
          date: val(el, '#sq_d'),
          time: val(el, '#sq_t'),
          venue: val(el, '#sq_v'),
          contact: val(el, '#sq_c'),
          purpose: val(el, '#sq_i'),
          language: val(el, '#sq_l'),
          notes: val(el, '#sq_n'),
          documents: {},
          paperDocuments: {},
          prep: requestRequirements({
            kind: en
          }).some(([,, required]) => required) ? 'documents missing' : 'complete',
          status: 'pending',
          stage: 'request',
          history: []
        });
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Request sent', 'أُرسل الطلب'), L(`${en} · awaiting priest review`, `${ar} · بانتظار مراجعة الكاهن`));
      });
    }
  });
}
export function textEdit({
  title,
  label,
  value,
  onSave,
  max = 400,
  help = '',
  ph = ''
}) {
  openModal({
    title,
    body: <C.Textarea label={label} id='txe' max={max} value={value} help={help} ph={ph} />,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="txok" style={{
        marginInlineStart: "auto"
      }}>{L('Save', 'حفظ')}</button></>,
    onMount(el) {
      el.querySelector('#txok').addEventListener('click', () => {
        onSave(val(el, '#txe'));
        closeOverlays();
        refresh();
        ok(L('Saved', 'حُفظ'));
      });
    }
  });
}

/** Lyrics are typed one verse per line, the three scripts split by "|"; the chord chart is plain text. */
export function hymnText(mid, what) {
  const d = D.musicInfo(D.MUSIC.find(m => m.id === mid) || {
    id: mid
  });
  if (what === 'chords') return textEdit({
    title: L('Chord chart', 'جدول الأوتار'),
    label: L('Chords above the words', 'الأوتار فوق الكلمات'),
    value: d.chords,
    max: 3000,
    ph: 'Dm      Gm     A7     Dm',
    onSave: v => {
      d.chords = v;
    },
    help: L('A line of chords alone transposes; lines of words are left as they are.', 'سطر الأوتار وحده يُنقَل؛ أسطر الكلمات تبقى كما هي.')
  });
  textEdit({
    title: L('Lyrics', 'الكلمات'),
    label: L('One verse per line', 'بيت في كل سطر'),
    value: d.lyrics.map(r => r.join(' | ')).join('\n'),
    max: 4000,
    ph: 'Syriac | عربي | English',
    help: L('Separate the Syriac, Arabic and English with a vertical bar: |', 'افصل السرياني والعربي والإنكليزي بخطّ عمودي: |'),
    onSave: v => {
      d.lyrics = v.split('\n').map(x => x.trim()).filter(Boolean).map(x => {
        const c = x.split('|').map(y => y.trim());
        return [c[0] || '', c[1] || '', c[2] || ''];
      });
    }
  });
}

/** Restoring an old version adds it as the new current one, so the history is never rewritten. */
export function hymnRestore(mid, i) {
  const d = D.musicInfo(D.MUSIC.find(m => m.id === mid) || {
      id: mid
    }),
    v = d.versions[+i];
  if (!v) return;
  d.versions.unshift([`Restored — ${v[0]}`, `استرجاع — ${v[1]}`, D.TODAY.toISOString().slice(0, 10), me()?.id || v[3]]);
  refresh();
  ok(L('Version restored', 'استُرجع الإصدار'), L(v[0], v[1]), {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        d.versions.shift();
        refresh();
      }
    }
  });
}
export function memberMenu(btn, pid) {
  const d = gd(),
    i = d.roster.findIndex(r => r.p === pid),
    r = d.roster[i];
  const g = D.group(curGroup());
  if (!r) return;
  openMenu(btn, [...(S.role !== 'leader' ? [{
    label: L('Message', 'مراسلة'),
    icon: 'msg',
    fn: () => compose(pid)
  }] : []), {
    label: L('Open record', 'فتح السجل'),
    icon: 'people',
    fn: () => go('person/' + pid)
  }, ...(!is('leader') && pid !== g?.leader ? [{
    label: L('Make assistant', 'تعيين مساعداً'),
    icon: 'check',
    fn: async () => {
      if (g.assistant && g.assistant !== pid) {
        const previous = d.roster.find(row => row.p === g.assistant);
        if (previous) {
          previous.role = 'Member';
          previous.roleAr = 'عضو';
        }
      }
      g.assistant = pid;
      d.assistant = pid;
      r.role = 'Assistant';
      r.roleAr = 'مساعد';
      d.roles = d.roles.filter(([personId, role]) => personId !== pid && role !== 'Assistant');
      d.roles.push([pid, 'Assistant', 'مساعد']);
      if (!(await persist())) return;
      refresh();
      ok(L('Assistant updated', 'حُدّث المساعد'), nameOf(D.person(pid)));
    }
  }] : []), {
    sep: true
  }, {
    label: L('Remove from group', 'إزالة من المجموعة'),
    icon: 'trash',
    danger: true,
    fn: async () => {
      if (pid === g?.leader) return toast(L('Hand over leadership first', 'سلّم المسؤولية أولاً'), '', 'warning');
      if (pid === g?.assistant && is('leader')) return toast(L('Ask the parish office to change the assistant', 'اطلب من مكتب الرعية تغيير المساعد'), '', 'warning');
      d.roster.splice(i, 1);
      if (g && S.role !== 'leader') g.members = Math.max(0, Number(g.members || 0) - 1);
      if (pid === g?.assistant) {
        g.assistant = null;
        d.assistant = null;
        d.roles = d.roles.filter(([personId]) => personId !== pid);
      }
      if (!(await persist())) return;
      refresh();
      ok(L('Removed from the group', 'أُزيل من المجموعة'), nameOf(D.person(pid)));
    }
  }]);
}

/** A row's own menu — edit, duplicate, and a destructive action kept last and apart. */
export function composeToPerson() {
  pickPerson({
    title: L('Message a person', 'مراسلة شخص'),
    cta: L('Continue', 'متابعة'),
    onPick: p => compose(p.id)
  });
}

/* ═════════════ admin, eparchy, settings ═════════════ */
AUDIENCES.eparchy = ['All parishes in the eparchy', 'كل رعايا الأبرشية', 3];

/* onBack runs when the person steps back with the back button (not Esc), for example to reopen
   the drawer the question was asked from. */
export function confirmAction({
  title,
  body,
  cta,
  danger = false,
  then,
  back = L('Cancel', 'إلغاء'),
  onBack
}) {
  openModal({
    title,
    body: <p className="t-body dim" style={{
      fontSize: "14px",
      lineHeight: "22px"
    }}>{body}</p>,
    foot: <><button className="btn btn-secondary" data-close="" id="cf_back">{back}</button>{" "}<button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} id="cf_go" style={{
        marginInlineStart: "auto"
      }}>{cta}</button></>,
    onMount(el) {
      el.querySelector('#cf_go').addEventListener('click', () => {
        closeOverlays();
        then();
      });
      if (onBack) el.querySelector('#cf_back').addEventListener('click', onBack);
    }
  });
}
export function parishSwitch(id) {
  return bus.switchParish?.(id);
}
export function bulkGroup(anchor, ids) {
  openMenu(anchor, D.GROUPS.slice(0, 6).map(g => ({
    label: L(g.name, g.ar),
    icon: 'groups',
    fn: () => {
      g.members += ids.length || 14;
      ok(L('Added to the group', 'أُضيفوا إلى المجموعة'), `${ids.length || 14} · ${L(g.name, g.ar)}`);
    }
  })), {
    width: 250
  });
}
export function ruleAdd() {
  const opts = D.FORM_FIELDS.map(f => <option value={f.id}>{L(f.label, f.labelAr)}</option>);
  openModal({
    title: L('Add a rule', 'إضافة قاعدة'),
    body: <div className="formgrid"><div className="formrow"><label className="label" htmlFor="ru_a">{L('Show', 'أظهر')}</label>{" "}<Select id="ru_a">{opts}</Select></div>{" "}<div className="formrow"><label className="label" htmlFor="ru_b">{L('When', 'حين')}</label><Select id="ru_b">{opts}</Select></div>{" "}<div className="formrow"><label className="label" htmlFor="ru_op">{L('Is', 'يكون')}</label><Select id="ru_op"><option value="=">{L('equal to', 'مساوياً لـ')}</option><option value="≠">{L('not equal to', 'غير مساوٍ لـ')}</option></Select></div>{" "}<C.Field label={L('Value', 'القيمة')} req={true} id='ru_v' ph={L('the person signed in', 'الشخص المسجَّل')} /></div>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="ru_go" style={{
        marginInlineStart: "auto"
      }}>{L('Add rule', 'إضافة القاعدة')}</button></>,
    onMount(el) {
      el.querySelector('#ru_go').addEventListener('click', () => {
        if (!need(el, '#ru_v', L('Give the value', 'أدخل القيمة'))) return;
        if (!need(el, '#ru_b', L('A field cannot depend on itself', 'لا يعتمد الحقل على نفسه'), v => v !== val(el, '#ru_a'))) return;
        const r = {
          id: 'fr' + Date.now().toString(36),
          show: val(el, '#ru_a'),
          when: val(el, '#ru_b'),
          op: val(el, '#ru_op'),
          value: val(el, '#ru_v'),
          valueAr: val(el, '#ru_v')
        };
        D.FORM_RULES.push(r);
        closeOverlays();
        refresh();
        ok(L('Rule added', 'أُضيفت القاعدة'), '', {
          action: {
            label: L('Undo', 'تراجع'),
            fn: () => {
              D.FORM_RULES.splice(D.FORM_RULES.indexOf(r), 1);
              refresh();
            }
          }
        });
      });
    }
  });
}
export function permException() {
  openModal({
    title: L('Add an exception', 'إضافة استثناء'),
    sub: L('An explicit deny always beats a role grant. Every exception needs a reason and a review date.', 'المنع الصريح يتقدّم دائماً على منح الدور. ولكل استثناء سبب وتاريخ مراجعة.'),
    body: <><C.PersonPicker label={L('Person', 'الشخص')} id='px_p' />{" "}<div className="formgrid"><div className="formrow"><label className="label">{L('Action', 'الإجراء')}</label><Select id="px_a">{D.PERMISSIONS.map(p => <option value={p[0]}>{L(p[1], p[2])}</option>)}</Select></div>{" "}<div className="formrow"><label className="label">{L('Effect', 'الأثر')}</label><Select id="px_e"><option value="+">{L('Allow', 'سماح')}</option><option value="−">{L('Deny', 'منع')}</option></Select></div></div>{" "}<C.Field label={L('Reason', 'السبب')} req={true} id='px_r' />{" "}<C.Field label={L('Review on', 'المراجعة في')} type='date' value='2027-01-31' id='px_d' /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="px_go" style={{
        marginInlineStart: "auto"
      }}>{L('Add exception', 'إضافة الاستثناء')}</button></>,
    onMount(el) {
      el.querySelector('#px_go').addEventListener('click', () => {
        if (!need(el, '#px_r', L('Give a reason', 'اذكر السبب'))) return;
        const typed = val(el, '#px_p').toLowerCase();
        const p = D.PEOPLE.find(x => typed && (x.lat.toLowerCase().includes(typed) || x.ar.includes(typed)));
        if (!need(el, '#px_p', L('Choose the person from the list', 'اختر الشخص من اللائحة'), () => !!p)) return;
        const x = {
          id: 'ex' + Date.now().toString(36),
          p: p.id,
          action: val(el, '#px_a'),
          effect: val(el, '#px_e'),
          reason: val(el, '#px_r'),
          review: val(el, '#px_d')
        };
        D.EXCEPTIONS.push(x);
        closeOverlays();
        refresh();
        ok(L('Exception added', 'أُضيف الاستثناء'), `${el.querySelector('#px_e').value} ${el.querySelector('#px_a').value} · ${L('review', 'مراجعة')} ${fmtDate(val(el, '#px_d'))}`);
      });
    }
  });
}
export function webhookAdd() {
  openModal({
    title: L('Add a webhook', 'إضافة خطّاف'),
    body: <><C.Field label={L('Endpoint', 'الوجهة')} req={true} id='wh_u' dir='ltr' ph='https://' />{" "}<div className="ac-group" style={{
        paddingInline: 0
      }}>{L('Events', 'الأحداث')}</div>{" "}<div className="stack" style={{
        gap: "8px"
      }}>{['sacrament.registered', 'report.published', 'message.failed', 'reservation.approved'].map(ev => <label className="check"><input type="checkbox" defaultValue={ev} /><span className="mono" style={{
            fontSize: "13px"
          }}>{ev}</span></label>)}</div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="wh_go" style={{
        marginInlineStart: "auto"
      }}>{L('Add webhook', 'إضافة الخطّاف')}</button></>,
    onMount(el) {
      el.querySelector('#wh_go').addEventListener('click', () => {
        if (!need(el, '#wh_u', L('Use an https:// address', 'استعمل عنواناً يبدأ بـ https://'), v => /^https:\/\/\S+\.\S+/.test(v))) return;
        const url = val(el, '#wh_u');
        const events = [...el.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
        D.WEBHOOKS.push({
          url,
          events: events.length ? events : ['report.published'],
          scope: 'read',
          active: true
        });
        closeOverlays();
        refresh();
        ok(L('Webhook added', 'أُضيف الخطّاف'), url);
      });
    }
  });
}

/* A photo is cropped to a square and scaled to 192px before it is kept, so a phone
   picture becomes a few kilobytes rather than megabytes in this browser's storage. */
export function avatarPick(btn, key = 'specimen') {
  const inp = Object.assign(document.createElement('input'), {
    type: 'file',
    accept: 'image/png,image/jpeg,image/webp'
  });
  inp.addEventListener('change', () => {
    const f = inp.files[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return toast(L('That file is not a photo', 'هذا الملف ليس صورة'), L('Use a JPG, PNG or WebP image.', 'استعمل صورة JPG أو PNG أو WebP.'), 'danger');
    if (f.size > 10 * 1024 * 1024) return toast(L('That photo is too large', 'الصورة كبيرة جداً'), L('Up to 10 MB.', 'حتى ١٠ ميغابايت.'), 'danger');
    const img = new Image(),
      url = URL.createObjectURL(f);
    img.onload = () => {
      const side = Math.min(img.width, img.height),
        c = Object.assign(document.createElement('canvas'), {
          width: 192,
          height: 192
        });
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 192, 192);
      URL.revokeObjectURL(url);
      const before = D.PHOTOS[key];
      D.PHOTOS[key] = c.toDataURL('image/jpeg', 0.84);
      photoShown(btn, key);
      ok(L('Photo updated', 'حُدّثت الصورة'), f.name, {
        action: {
          label: L('Undo', 'تراجع'),
          fn: () => {
            if (before) D.PHOTOS[key] = before;else delete D.PHOTOS[key];
            photoShown(btn, key);
          }
        }
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast(L('That photo could not be read', 'تعذّرت قراءة الصورة'), '', 'danger');
    };
    img.src = url;
  });
  inp.click();
}
export function avatarRemove(btn, key) {
  const before = D.PHOTOS[key];
  if (!before) return;
  delete D.PHOTOS[key];
  photoShown(btn, key);
  ok(L('Photo removed', 'أُزيلت الصورة'), L('Initials are shown instead.', 'تظهر الأحرف الأولى بدلاً منها.'), {
    action: {
      label: L('Undo', 'تراجع'),
      fn: () => {
        D.PHOTOS[key] = before;
        photoShown(btn, key);
      }
    }
  });
}

/* Redraw the upload control where it sits (often inside a drawer), then the page and the rail behind it. */
function photoShown(btn, key) {
  const host = document.querySelector(`[data-photo="${key}"]`);
  if (host) {
    host.outerHTML = <C.AvatarUpload k={key} />;
    document.querySelector(`[data-photo="${key}"]`) && wireIn(document.querySelector(`[data-photo="${key}"]`));
  }
  if (key === 'parish' || key === me()?.id) bus.renderAll();else refresh();
}
async function wireIn(el) {
  const {
    wireActions
  } = await import("../actions.jsx");
}
export function deleteSpecimen() {
  openModal({
    title: L('Permanently delete this record?', 'حذف هذا السجل نهائياً؟'),
    sub: L('This cannot be undone.', 'لا يمكن التراجع.'),
    body: <div className="formrow"><label className="label">{L('Type', 'اكتب')}{" "}<b>Georges Haddad</b>{" "}{L('to confirm', 'للتأكيد')}</label>{" "}<input className="input" id="ds_in" autoComplete="off" /></div>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Keep record', 'الاحتفاظ بالسجل')}</button>{" "}<button className="btn btn-danger" id="ds_go" disabled style={{
        marginInlineStart: "auto"
      }}>{L('Delete permanently', 'حذف نهائي')}</button></>,
    onMount(el) {
      const b = el.querySelector('#ds_go');
      el.querySelector('#ds_in').addEventListener('input', e => {
        b.disabled = e.target.value.trim() !== 'Georges Haddad';
      });
      b.addEventListener('click', () => {
        closeOverlays();
        toast(L('Deleted', 'حُذف'), L('Specimen only — no record was touched.', 'نموذج فقط — لم يُمسّ أي سجل.'), 'danger');
      });
    }
  });
}
export function tagAdd(btn) {
  const inp = document.createElement('input');
  inp.className = 'input';
  inp.style.cssText = 'width:140px;min-height:30px;font-size:13px';
  inp.placeholder = L('New tag', 'وسم جديد');
  btn.replaceWith(inp);
  inp.focus();
  const done = () => {
    const v = inp.value.trim();
    if (v) inp.insertAdjacentHTML('beforebegin', <span className="chip">{v}</span>);
    inp.replaceWith(btn);
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') done();
    if (e.key === 'Escape') inp.replaceWith(btn);
  });
  inp.addEventListener('blur', done);
}