/* The family tree of a person or household, drawn from recorded relations. */
import { Fragment } from 'react';

import { t, isAr } from '../../../lib/i18n.js';
import { Icon, Empty, Avatar } from '../../ui/ui.jsx';
import { RELS } from './people-dialogs.jsx';
import { person } from '../../model/data.js';
import { label, relLabel } from './people-shared.jsx';

/* The household drawn as a family tree. Every member's relationship is read relative to the person
   it names ("Related to"), or to the head when it names no one, and turned into parent and partner
   links. The tree is then drawn from the head's oldest recorded ancestor down: couples side by side
   on a ring, children beneath them, grandchildren beneath their own parent. Brothers and sisters
   whose parents are not in the household hang from a marker that says so, rather than from nothing.
   Guardians and other relatives, and anyone a link cannot place, stand alongside — nobody is dropped. */
export function familyTree(h, focus) {
  const ms = h.members.map(person).filter(Boolean);
  if (!ms.length)
    return (
      <Empty
        glyph="family"
        title={t('No one in this household yet', 'لا أحد في هذه العائلة بعد')}
        body={t('Add the first member.', 'أضف الفرد الأول.')}
      />
    );
  const byId = new Map(ms.map(m => [m.id, m]));
  const anchor = byId.get(h.head) || ms.find(m => m.rel === 'head') || ms[0];
  const NORM = { son: 'child', daughter: 'child', father: 'parent', mother: 'parent' };
  const relOf = m => (m === anchor ? 'head' : NORM[m.rel] || (!m.rel || m.rel === 'head' ? 'relative' : m.rel));
  const baseOf = m => (byId.has(m.relativeTo) && m.relativeTo !== m.id ? m.relativeTo : anchor.id);
  const parents = new Map(),
    kidsOf = new Map(),
    partner = new Map(),
    ghosts = new Map(),
    side = [];
  const isGhost = id => ghosts.has(id),
    realParents = id => (parents.get(id) || []).filter(x => !isGhost(x));
  const link = (parent, kid) => {
    if (!kidsOf.has(parent)) kidsOf.set(parent, []);
    if (!parents.has(kid)) parents.set(kid, []);
    if (!kidsOf.get(parent).includes(kid)) kidsOf.get(parent).push(kid);
    if (!parents.get(kid).includes(parent)) parents.get(kid).push(parent);
  };
  const pair = (x, y) => {
    partner.set(x, y);
    partner.set(y, x);
  };
  const ghost = (kind, base) => {
    const id = `ghost:${kind}:${base}`;
    ghosts.set(id, kind);
    return id;
  };
  const others = ms.filter(m => m !== anchor);
  /* first the direct links: partners, children, parents */
  for (const m of others) {
    const r = relOf(m),
      b = baseOf(m);
    if (r === 'spouse') partner.has(b) || partner.has(m.id) ? side.push(m) : pair(b, m.id);
    else if (r === 'child') link(b, m.id);
    else if (r === 'parent') realParents(b).length < 2 ? link(m.id, b) : side.push(m);
  }
  for (const ps of parents.values())
    if (ps.length === 2 && !partner.has(ps[0]) && !partner.has(ps[1])) pair(ps[0], ps[1]);
  /* then the links that hang off those: brothers and sisters, grandchildren */
  for (const m of others) {
    const r = relOf(m),
      b = baseOf(m);
    if (r === 'sibling') {
      if (realParents(b).length) link(realParents(b)[0], m.id);
      else if (b === anchor.id || !partner.has(b)) {
        const g = ghost('parents', b);
        link(g, b);
        link(g, m.id);
      } else side.push(m);
    } else if (r === 'grandchild') {
      const kids = (kidsOf.get(b) || []).filter(k => !isGhost(k));
      if (kids.length === 1) link(kids[0], m.id);
      else {
        const g = ghost('child', b);
        link(b, g);
        link(g, m.id);
      }
    } else if (!['spouse', 'child', 'parent'].includes(r)) side.push(m);
  }
  /* lay the tree out from the head's oldest recorded ancestor, then anyone not reached yet */
  const born = id => byId.get(id)?.born || '9999';
  const placed = new Set();
  const unit = id => {
    placed.add(id);
    const pt = partner.has(id) && !placed.has(partner.get(id)) ? partner.get(id) : null;
    if (pt) placed.add(pt);
    const kids = [...new Set([...(kidsOf.get(id) || []), ...(pt ? kidsOf.get(pt) || [] : [])])]
      .filter(k => !placed.has(k))
      .sort((x, y) => born(x).localeCompare(born(y)));
    kids.forEach(k => placed.add(k));
    return {
      id,
      pt,
      kids: kids.map(k => {
        placed.delete(k);
        return unit(k);
      })
    };
  };
  let top = anchor.id;
  for (const seen = new Set(); (parents.get(top) || []).length && !seen.has(top);) {
    seen.add(top);
    top = parents.get(top)[0];
  }
  const sideIds = new Set(side.map(m => m.id));
  const forest = [unit(top)];
  for (const id of [...byId.keys(), ...ghosts.keys()]) {
    if (
      placed.has(id) ||
      sideIds.has(id) ||
      (parents.get(id) || []).length ||
      realParents(partner.get(id) || '').length
    )
      continue;
    const u = unit(id);
    if (u.kids.length || u.pt) forest.push(u); /* a second family line of its own */
    else if (!isGhost(id)) {
      side.push(byId.get(id));
      sideIds.add(id);
    } /* linked to no one drawn: stand alongside */
  }
  for (const m of ms)
    if (!placed.has(m.id) && !sideIds.has(m.id)) {
      side.push(m);
      sideIds.add(m.id);
    }
  const first = id => ((isAr() ? byId.get(id)?.ar : byId.get(id)?.lat) || byId.get(id)?.lat || '').split(' ')[0];
  const roleOf = m => {
    if (m === anchor) return h.head === m.id ? t('Head', 'ربّ العائلة') : relLabel(m, h);
    const lab = t(
      ...(RELS.find(r => r[0] === (m.rel && m.rel !== 'head' ? m.rel : 'relative')) || RELS.at(-1)).slice(1)
    );
    return baseOf(m) !== anchor.id ? `${lab} · ${first(baseOf(m))}` : lab;
  };
  const node = m => (
    <a className={`ft-node ${m.id === focus ? 'me' : ''}`} href={`#/person/${m.id}/family`}>
      <Avatar p={m} cls="avatar-lg" />
      <b dir="auto">{label(m)}</b>
      <small className="ar" dir="auto">
        {m.ar || ''}
      </small>{' '}
      <span className="ft-role">
        {roleOf(m)}
        {/^\d{4}/.test(m.born || '') ? (
          <>
            {' '}
            · <span className="mono">{m.born.slice(0, 4)}</span>
          </>
        ) : (
          ''
        )}
      </span>{' '}
      {m.id === focus ? <span className="ft-here">{t('This record', 'هذا السجل')}</span> : ''}
    </a>
  );
  const cellOf = id =>
    isGhost(id) ? (
      <span className="ft-ghost">
        {ghosts.get(id) === 'parents'
          ? t('Parents not recorded in this household', 'الوالدان غير مسجّلين في هذه العائلة')
          : t('Parent not recorded in this household', 'الوالد غير مسجّل في هذه العائلة')}
      </span>
    ) : (
      node(byId.get(id))
    );
  const draw = u => (
    <div className="ft-family">
      <div className={`ft-couple ${u.kids.length ? 'has-kids' : ''}`}>
        {cellOf(u.id)}
        {u.pt ? (
          <>
            <span className="ft-bond" role="img" aria-label={t('married', 'متزوّجان')}>
              <Icon name="rings" size={16} />
            </span>
            {cellOf(u.pt)}
          </>
        ) : (
          ''
        )}
      </div>{' '}
      {u.kids.length ? (
        <div className="ft-branch">
          <div className="ft-row">
            {u.kids.map((k, i) => (
              <div key={i} className={`ft-cell ${k.pt ? 'ft-pair' : ''}`}>
                {draw(k)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        ''
      )}
    </div>
  );
  return (
    <div className="ftree">
      <div className="ft-canvas">
        <div className="ft-forest">
          {forest.map((item, i, all) => (
            <Fragment key={i}>{draw(item, i, all)}</Fragment>
          ))}
        </div>
      </div>{' '}
      {side.length ? (
        <div className="ft-side">
          <span className="overline">{t('Also in the household', 'أيضاً في العائلة')}</span>{' '}
          <div className="ft-row">
            {side.map((item, i, all) => (
              <Fragment key={i}>{node(item, i, all)}</Fragment>
            ))}
          </div>
        </div>
      ) : (
        ''
      )}
    </div>
  );
}
