/* Dialogs about people: choosing a person, inviting them to an account, reviewing portal changes,
   archiving and restoring, editing a record, family relations, photographs and adding people to a
   group. */
import { Select } from '../../ui/components.jsx';
import { paint } from '../../ui/html.js';
import { t, fmtDate, matches } from '../../../lib/i18n.js';
import { bus, me } from '../../model/store.js';
import { toast, openDrawer, openModal, closeOverlays, Who, openMenu } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { persist } from '../../model/persist.js';
import { readAddressCascade } from '../../ui/geography.jsx';
import { nameOf, ok, refresh, rotaSlot, rotaTeam, today, val } from '../../shared/dialog-helpers.jsx';
import { need } from '../../shared/dialogs.jsx';

const L = (en, ar) => t(en, ar);

/** A person picker in a drawer — invitations, new members, substitutes. */
export function pickPerson({ title, sub = '', cta, onPick, exclude = [], allow = null }) {
  const list = D.PEOPLE.filter(
    p => !exclude.includes(p.id) && (!allow || allow.includes(p.id)) && p.status !== 'clergy'
  );
  openDrawer({
    title,
    sub,
    body: (
      <>
        <C.SearchClear ph={L('Type a name in either script', 'اكتب الاسم بأي حرف')} id="ppq" />{' '}
        <div className="stack" id="pplist" style={{ marginTop: '12px' }}>
          {list.map((p, i) => (
            <label
              key={i}
              className="listrow"
              style={{ paddingInline: '4px', cursor: 'pointer' }}
              data-name={`${p.lat} ${p.ar} ${p.phone}`}
            >
              <input type="radio" name="pp" defaultValue={p.id} style={{ accentColor: 'var(--primary)' }} />{' '}
              <Who p={p} />
              <span className="grow" />
              <span className="t-caption dim">{L(p.town, p.townAr)}</span>
            </label>
          ))}
        </div>{' '}
        <p className="dim" id="ppnone" hidden style={{ padding: '18px 4px' }}>
          {L(
            'Nobody by that name. Try the other script, or part of the name.',
            'لا أحد بهذا الاسم. جرّب الحرف الآخر أو جزءاً من الاسم.'
          )}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="ppgo" disabled style={{ marginInlineStart: 'auto' }}>
          {cta}
        </button>
      </>
    ),
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
      el.querySelectorAll('input[name=pp]').forEach(r =>
        r.addEventListener('change', () => {
          goBtn.disabled = false;
        })
      );
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
  if (context === 'rota' && !target)
    return toast(L('Select a rota role first', 'اختر دوراً في المناوبة أولاً'), '', 'warning');
  const team = context === 'rota' ? rotaTeam(at) : null;
  pickPerson({
    title:
      context === 'rota'
        ? L(target.p ? 'Replace assignment' : 'Assign volunteer', target.p ? 'استبدال الإسناد' : 'إسناد متطوّع')
        : L('Add someone', 'إضافة شخص'),
    sub:
      context === 'rota'
        ? `${L(D.ROTA.service, D.ROTA.serviceAr)} · ${D.ROTA.date} · ${L(team.one, team.oneAr)}. ${L('Confirmation must be obtained separately; this screen does not send a message.', 'يجب الحصول على التأكيد بصورة منفصلة؛ هذه الشاشة لا ترسل رسالة.')}`
        : L('Select an existing parishioner.', 'اختر مؤمناً مسجّلاً.'),
    cta: context === 'rota' ? L('Review assignment', 'مراجعة الإسناد') : L('Add', 'إضافة'),
    allow: context === 'rota' ? D.VOLUNTEERS.map(v => v.p) : undefined,
    onPick: p => {
      if (context === 'rota') {
        if (
          team.filled.some(slot => slot !== target && slot.p === p.id && slot.s !== 'declined') ||
          D.ROTA.teams.some(
            other => other !== team && other.filled.some(slot => slot.p === p.id && slot.s !== 'declined')
          )
        )
          return toast(
            L('Assignment conflict', 'تعارض في الإسناد'),
            L(
              'This person is already assigned on the same rota date.',
              'هذا الشخص مسند بالفعل في تاريخ المناوبة نفسه.'
            ),
            'warning'
          );
        const former = target.p ? nameOf(D.person(target.p)) : null;
        openModal({
          title: L('Confirm rota assignment', 'تأكيد إسناد المناوبة'),
          body: (
            <>
              <p>
                <b>{nameOf(p)}</b> · {L(team.team, team.teamAr)} · {L(team.one, team.oneAr)} · {D.ROTA.date}
              </p>{' '}
              {former ? (
                <p className="help">
                  {L('Replaces', 'يحلّ محلّ')}: {former}
                </p>
              ) : (
                ''
              )}{' '}
              <p className="help">
                {L(
                  'This records an assignment awaiting confirmation. Contact the volunteer separately.',
                  'يسجّل هذا إسناداً بانتظار التأكيد. تواصل مع المتطوّع بصورة منفصلة.'
                )}
              </p>
            </>
          ),
          foot: (
            <>
              <button className="btn btn-secondary" data-close="">
                {L('Keep current assignment', 'إبقاء الإسناد الحالي')}
              </button>
              <button className="btn btn-primary" id="rota-confirm">
                {L('Save assignment', 'حفظ الإسناد')}
              </button>
            </>
          ),
          onMount(el) {
            el.querySelector('#rota-confirm').addEventListener('click', () => {
              Object.assign(target, { p: p.id, s: 'pending', swap: undefined });
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
        if (!s || s.taken >= s.slots)
          return toast(
            L('That sheet is full', 'هذه اللائحة ممتلئة'),
            L('Add places to it first.', 'أضف مراكز إليها أولاً.'),
            'warning'
          );
        s.taken += 1;
      }
      refresh();
      ok(L('Person added', 'أُضيف الشخص'), nameOf(p));
    }
  });
}

function portalApply(r) {
  if (r.kind === 'address') {
    const h = D.HOUSEHOLDS.find(x => x.id === r.hh);
    if (!h) return () => {};
    const was = { address: h.address, addressAr: h.addressAr };
    Object.assign(h, { address: r.to, addressAr: r.toAr });
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
  toast(
    accept ? L('Change accepted', 'اعتُمد التعديل') : L('Change declined', 'رُفض التعديل'),
    accept
      ? L(
          `${r.what} — the record is updated and the family has been told.`,
          `${r.whatAr} — حُدّث السجل وأُبلغت العائلة.`
        )
      : L('The family is told the change was not applied.', 'تُبلَّغ العائلة بأن التعديل لم يُطبَّق.'),
    accept ? 'success' : '',
    {
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
    }
  );
}

export function portalCompare(id) {
  const r = D.PORTAL_REQUESTS.find(x => x.id === id);
  if (!r) return;
  const col = (label, text) => (
    <div className="card card-flat">
      <div className="overline">{label}</div>{' '}
      <p style={{ font: '400 14px/22px var(--sans)', marginTop: '6px' }}>
        {text ? text : <span className="dim">{L('Nothing on record yet', 'لا شيء في السجل بعد')}</span>}
      </p>
    </div>
  );
  openModal({
    title: L(r.what, r.whatAr),
    sub: `${L('Submitted from the member portal', 'مُرسل من بوّابة المؤمنين')} · ${fmtDate(r.at)}`,
    body: (
      <div className="grid g2" style={{ gap: '12px' }}>
        {col(L('On record', 'في السجل'), L(r.now, r.nowAr))}
        {col(L('Submitted', 'المُرسَل'), L(r.to, r.toAr))}
      </div>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-danger-quiet" id="pq_no" style={{ marginInlineStart: 'auto' }}>
          {L('Decline', 'رفض')}
        </button>{' '}
        <button className="btn btn-primary" id="pq_yes">
          {L('Accept', 'قبول')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#pq_no').addEventListener('click', () => portalDecide(id, false));
      el.querySelector('#pq_yes').addEventListener('click', () => portalDecide(id, true));
    }
  });
}

/* ═════════════ archive ═════════════
   Archiving removes active-directory visibility while preserving related history. */
export function archivePeople(ids) {
  const moved = ids
    .map(id => D.PEOPLE.find(x => x.id === id))
    .filter(Boolean)
    .map(p => [D.PEOPLE.indexOf(p), p]);
  if (!moved.length) return;
  moved.forEach(([, p]) => {
    D.PEOPLE.splice(D.PEOPLE.indexOf(p), 1);
    Object.assign(p, { archived: today, archivedBy: me()?.id || 'p17' });
    D.ARCHIVED.unshift(p);
  });
  refresh();
  toast(
    moved.length === 1
      ? L(`${moved[0][1].lat} archived`, `أُرشف ${moved[0][1].ar}`)
      : L(`${moved.length} records archived`, `أُرشف ${moved.length} سجلات`),
    L(
      'Removed from active People lists. Linked records remain and this person can be restored.',
      'أُزيل من لوائح المؤمنين النشطة. تبقى السجلات المرتبطة ويمكن استرجاع الشخص.'
    ),
    '',
    {
      action: {
        label: L('Undo', 'تراجع'),
        fn: () => {
          moved
            .sort((a, b) => a[0] - b[0])
            .forEach(([i, p]) => {
              D.ARCHIVED.splice(D.ARCHIVED.indexOf(p), 1);
              delete p.archived;
              delete p.archivedBy;
              delete p.deletionRequested;
              D.PEOPLE.splice(i, 0, p);
            });
          refresh();
        }
      }
    }
  );
}

export function restorePerson(id) {
  const p = D.ARCHIVED.find(x => x.id === id);
  if (!p) return;
  const i = D.ARCHIVED.indexOf(p),
    was = { archived: p.archived, archivedBy: p.archivedBy, deletionRequested: p.deletionRequested };
  D.ARCHIVED.splice(i, 1);
  delete p.archived;
  delete p.archivedBy;
  delete p.deletionRequested;
  D.PEOPLE.unshift(p);
  refresh();
  ok(
    L('Record restored', 'استُرجع السجل'),
    L(`${p.lat} is back in the parish lists.`, `عاد ${p.ar} إلى لوائح الرعية.`),
    {
      action: {
        label: L('Undo', 'تراجع'),
        fn: () => {
          D.PEOPLE.splice(D.PEOPLE.indexOf(p), 1);
          Object.assign(p, was);
          D.ARCHIVED.splice(i, 0, p);
          refresh();
        }
      }
    }
  );
}

export function personEdit(id) {
  const p = D.person(id);
  if (!p) return;
  openDrawer({
    large: true,
    title: L('Edit record', 'تعديل السجل'),
    sub: p.lat + ' · ' + p.ar,
    body: (
      <>
        <div className="formgrid">
          <C.Field label={L('English name', 'الاسم الإنكليزي')} req={true} value={p.lat} dir="ltr" id="e_lat" />{' '}
          <C.Field label={L('Arabic name', 'الاسم العربي')} req={true} value={p.ar} dir="rtl" ar={true} id="e_ar" />{' '}
          <C.Field label={L('Date of birth', 'تاريخ الولادة')} type="date" value={p.born} id="e_born" />{' '}
          <div className="formrow">
            <label htmlFor="e_st" className="label">
              {L('Status', 'الحالة')}
            </label>{' '}
            <Select defaultValue={p.status} id="e_st">
              {[
                ['member', 'Member', 'منتسب'],
                ['visitor', 'Visitor', 'زائر'],
                ['clergy', 'Clergy', 'إكليروس']
              ].map(([v, en, ar], i) => (
                <option key={i} value={v}>
                  {L(en, ar)}
                </option>
              ))}
            </Select>
          </div>
        </div>{' '}
        <C.PhoneField value={p.phone === '—' ? '' : p.phone} id="e_ph" />{' '}
        <C.Field label={L('Line of work', 'المهنة')} value={D.PERSON_EXTRA[p.id]?.occupation || ''} id="e_occupation" />{' '}
        <div className="formrow">
          <label className="label">{L('Photo', 'الصورة')}</label>
          <C.AvatarUpload k={p.id} />
        </div>{' '}
        <C.AddressCascade value={{ town: p.town, ...(D.PERSON_EXTRA[p.id]?.address || {}) }} />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="e_save" style={{ marginInlineStart: 'auto' }}>
          {L('Save changes', 'حفظ التعديلات')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#e_save').addEventListener('click', async e => {
        if (
          !need(el, '#e_lat', L('Enter the English name', 'أدخل الاسم الإنكليزي')) ||
          !need(el, '#e_ar', L('Enter the Arabic name', 'أدخل الاسم العربي'))
        )
          return;
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
export const RELS = [
  ['head', 'Head of household', 'ربّ العائلة'],
  ['father', 'Father', 'أب'],
  ['mother', 'Mother', 'أم'],
  ['parent', 'Parent', 'والد/والدة'],
  ['spouse', 'Spouse', 'زوج/زوجة'],
  ['son', 'Son', 'ابن'],
  ['daughter', 'Daughter', 'ابنة'],
  ['sibling', 'Brother or sister', 'أخ/أخت'],
  ['child', 'Child', 'ابن/ابنة'],
  ['grandchild', 'Grandchild', 'حفيد/حفيدة'],
  ['guardian', 'Guardian', 'وصيّ'],
  ['relative', 'Other relative', 'قريب آخر']
];

export const relOf = (p, h) => p.rel || (h?.head === p.id ? 'head' : 'relative');

const relSelect = (id, cur) => (
  <Select defaultValue={cur} id={id}>
    {RELS.map(([v, en, ar], i) => (
      <option key={i} value={v}>
        {L(en, ar)}
      </option>
    ))}
  </Select>
);

/* Put a person in a household (taking them out of any other one) and return how to undo it. */
function joinHousehold(p, h, rel, emergency) {
  const prev = D.HOUSEHOLDS.find(x => x.members.includes(p.id));
  const before = {
    p: { hh: p.hh, rel: p.rel, emergency: p.emergency },
    prev: prev && { members: prev.members.slice(), head: prev.head },
    h: { members: h.members.slice(), head: h.head }
  };
  if (prev && prev !== h) {
    prev.members = prev.members.filter(m => m !== p.id);
    if (prev.head === p.id) prev.head = prev.members[0] || null;
  }
  if (!h.members.includes(p.id)) h.members.push(p.id);
  Object.assign(p, { hh: h.id, rel, emergency });
  if (rel === 'head') h.head = p.id;
  else if (h.head === p.id) h.head = h.members.find(m => m !== p.id) || null;
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
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="relsel">
            {L('Relationship', 'صلة القرابة')}
          </label>
          {relSelect('relsel', relOf(p, h))}
        </div>{' '}
        {h ? (
          <div className="formrow">
            <label className="label" htmlFor="relto">
              {L('Related to', 'صلة بـ')}
            </label>
            <Select defaultValue={p.relativeTo} id="relto">
              <option value="">{L('Not specified', 'غير محدد')}</option>
              {h.members
                .filter(mid => mid !== p.id)
                .map((mid, i) => {
                  const m = D.person(mid);
                  return (
                    <option key={i} value={mid}>
                      {nameOf(m)}
                    </option>
                  );
                })}
            </Select>
          </div>
        ) : (
          ''
        )}{' '}
        <div className="stack" style={{ gap: '10px' }}>
          <C.CheckRow label={L('Emergency contact', 'جهة اتصال في الطوارئ')} checked={!!p.emergency} id="rel_em" />{' '}
          <C.CheckRow
            label={L('May collect children', 'مفوَّض باستلام الأطفال')}
            checked={!!p.canCollect}
            id="rel_cc"
          />
        </div>
      </>
    ),
    foot: (
      <>
        {h ? (
          <button className="btn btn-danger-quiet" id="relout">
            {L('Remove from household', 'إخراج من العائلة')}
          </button>
        ) : (
          ''
        )}{' '}
        <button className="btn btn-secondary" data-close="" style={{ marginInlineStart: 'auto' }}>
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="relok">
          {L('Save', 'حفظ')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#relok').addEventListener('click', () => {
        const canCollect = p.canCollect,
          oldRelativeTo = p.relativeTo;
        const undo = h
          ? joinHousehold(p, h, el.querySelector('#relsel').value, el.querySelector('#rel_em').checked)
          : (() => {
              const b = { rel: p.rel, emergency: p.emergency };
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
        if (D.PEOPLE.some(m => m.hh === h.id && m.relativeTo === p.id))
          return toast(
            L('Update linked relationships first', 'حدّث الصلات المرتبطة أولاً'),
            L('Other members identify this person as their relative.', 'يحدّد أفراد آخرون هذا الشخص بوصفه قريبهم.'),
            'warning'
          );
        const before = {
          members: h.members.slice(),
          head: h.head,
          p: { hh: p.hh, rel: p.rel, relativeTo: p.relativeTo, emergency: p.emergency }
        };
        h.members = h.members.filter(m => m !== p.id);
        if (h.head === p.id) h.head = h.members[0] || null;
        Object.assign(p, { hh: null });
        delete p.rel;
        delete p.relativeTo;
        delete p.emergency;
        closeOverlays();
        refresh();
        ok(
          L('Removed from the household', 'أُخرج من العائلة'),
          L(`${nameOf(p)} is recorded on their own now.`, `${nameOf(p)} مسجّل بمفرده الآن.`),
          {
            action: {
              label: L('Undo', 'تراجع'),
              fn: () => {
                Object.assign(h, { members: before.members, head: before.head });
                Object.assign(p, before.p);
                refresh();
              }
            }
          }
        );
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
    body: (
      <>
        {pickP ? (
          <div className="formrow">
            <label className="label" htmlFor="fa_p">
              {L('Person', 'الشخص')}
            </label>
            <Select id="fa_p">
              {D.PEOPLE.filter(x => !fixedH || !fixedH.members.includes(x.id)).map((x, i) => {
                const h2 = D.HOUSEHOLDS.find(y => y.members.includes(x.id));
                return (
                  <option key={i} value={x.id}>
                    {nameOf(x)}
                    {h2 ? ` — ${L(`now in ${h2.name}`, `حالياً في ${h2.ar}`)}` : ''}
                  </option>
                );
              })}
            </Select>
          </div>
        ) : (
          ''
        )}{' '}
        {pickH ? (
          <div className="formrow">
            <label className="label" htmlFor="fa_h">
              {L('Household', 'العائلة')}
            </label>
            <Select id="fa_h">
              {D.HOUSEHOLDS.map((x, i) => (
                <option key={i} value={x.id}>
                  {L(x.name, x.ar)} · {L(x.town, x.townAr)}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          ''
        )}{' '}
        <div className="formrow">
          <label className="label" htmlFor="fa_rel">
            {L('Relationship', 'الصلة')}
          </label>
          {relSelect('fa_rel', 'child')}
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="fa_to">
            {L('Related to household member', 'صلة بفرد من العائلة')}
          </label>
          <Select id="fa_to" />
        </div>{' '}
        <C.CheckRow label={L('Emergency contact', 'جهة اتصال في الطوارئ')} id="fa_em" />{' '}
        <p className="help" style={{ marginTop: '10px' }}>
          {L(
            'Someone who is in another household is moved here; their record and history move with them.',
            'من هو في عائلة أخرى يُنقل إلى هنا؛ ويرافقه سجلّه وتاريخه.'
          )}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="fa_go" style={{ marginInlineStart: 'auto' }}>
          {fixedH ? L('Add to household', 'إضافة إلى العائلة') : L('Link', 'ربط')}
        </button>
      </>
    ),
    onMount(el) {
      const fillRelated = () => {
        const h = fixedH || D.HOUSEHOLDS.find(x => x.id === el.querySelector('#fa_h')?.value);
        paint(
          el.querySelector('#fa_to'),
          <>
            <option value="">{L('Not specified', 'غير محدد')}</option>
            {(h?.members || [])
              .filter(mid => mid !== fixedP?.id)
              .map((mid, i) => (
                <option key={i} value={mid}>
                  {nameOf(D.person(mid))}
                </option>
              ))}
          </>
        );
      };
      el.querySelector('#fa_h')?.addEventListener('change', fillRelated);
      fillRelated();
      el.querySelector('#fa_go').addEventListener('click', () => {
        const p = fixedP || D.person(el.querySelector('#fa_p')?.value),
          h = fixedH || D.HOUSEHOLDS.find(x => x.id === el.querySelector('#fa_h')?.value);
        if (!p || !h) return toast(L('Choose who and where', 'اختر الشخص والعائلة'), '', 'warning');
        const oldHouse = D.HOUSEHOLDS.find(x => x.members.includes(p.id));
        if (oldHouse && oldHouse !== h && D.PEOPLE.some(m => m.hh === oldHouse.id && m.relativeTo === p.id))
          return toast(
            L('Update linked relationships first', 'حدّث الصلات المرتبطة أولاً'),
            L(
              'Other members of the old household identify this person as their relative.',
              'يحدّد أفراد من العائلة السابقة هذا الشخص بوصفه قريبهم.'
            ),
            'warning'
          );
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

export function bulkGroup(anchor, ids) {
  openMenu(
    anchor,
    D.GROUPS.slice(0, 6).map(g => ({
      label: L(g.name, g.ar),
      icon: 'groups',
      fn: () => {
        g.members += ids.length || 14;
        ok(L('Added to the group', 'أُضيفوا إلى المجموعة'), `${ids.length || 14} · ${L(g.name, g.ar)}`);
      }
    })),
    { width: 250 }
  );
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
    if (!/^image\/(png|jpeg|webp)$/.test(f.type))
      return toast(
        L('That file is not a photo', 'هذا الملف ليس صورة'),
        L('Use a JPG, PNG or WebP image.', 'استعمل صورة JPG أو PNG أو WebP.'),
        'danger'
      );
    if (f.size > 10 * 1024 * 1024)
      return toast(L('That photo is too large', 'الصورة كبيرة جداً'), L('Up to 10 MB.', 'حتى ١٠ ميغابايت.'), 'danger');
    const img = new Image(),
      url = URL.createObjectURL(f);
    img.onload = () => {
      const side = Math.min(img.width, img.height),
        c = Object.assign(document.createElement('canvas'), { width: 192, height: 192 });
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 192, 192);
      URL.revokeObjectURL(url);
      const before = D.PHOTOS[key];
      D.PHOTOS[key] = c.toDataURL('image/jpeg', 0.84);
      photoShown(btn, key);
      ok(L('Photo updated', 'حُدّثت الصورة'), f.name, {
        action: {
          label: L('Undo', 'تراجع'),
          fn: () => {
            if (before) D.PHOTOS[key] = before;
            else delete D.PHOTOS[key];
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
  if (key === 'parish' || key === me()?.id) bus.renderAll();
  else refresh();
}

async function wireIn(el) {
  const { wireActions } = await import('../../shell/actions.jsx');
}
