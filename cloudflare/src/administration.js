/* Scoped administrative workflows. All writes stay in the request's atomic Tx. */
import policy from '../../backend/administration-policy.json' with { type: 'json' };
import { need, tokenHex, NOW } from './py.js';
import { authority, scopedRoles, isSuperAdmin, parishContext, suspended, history } from './workspace.js';

export { policy };
export const sensitiveEndpoints = ['grants','suspension','users','secretaries','parishes','dioceses','plans','plan','clergy-title','password-reset','account-lookup'];
export async function recordFailure(c, actor, path, query, status, requestId) {
  if(!sensitiveEndpoints.includes(path.split('/').at(-1)))return;
  let scopeId='*';
  const globalRequest=query.scopeType==='global'||query.scope==='global';
  if(!globalRequest&&typeof query.parish==='string'&&await authority(c,actor,query.parish))scopeId=query.parish;
  else if(!globalRequest&&typeof query.diocese==='string'&&await authority(c,actor,null,query.diocese))scopeId=query.diocese;
  history(c,actor,scopeId,'administration.rejected',{
    operation:path.split('/').at(-1),outcome:'rejected',status,
    role:String(query.role||'').slice(0,80),user:String(query.userId||'').slice(0,120),requestId
  });
}
export async function assignmentScope(c, query) {
  const scopeType = query.scopeType || 'parish';
  need(['global', 'diocese', 'parish'].includes(scopeType), 'Choose a valid administrative scope.');
  const scopeId = scopeType === 'global' ? '*' : scopeType === 'diocese' ? query.diocese : query.parish;
  need(typeof scopeId === 'string' && scopeId, 'Choose an administrative scope.');
  if (scopeType !== 'global') {
    const table = scopeType === 'diocese' ? 'dioceses' : 'parishes';
    need(scopeId !== 'pl-platform' && await c.first(`SELECT 1 FROM ${table} WHERE id=?`, scopeId), 'Administrative scope not found.', 404);
  }
  return { scopeType, scopeId };
}

export async function permittedRoles(c, actor, scopeType, scopeId) {
  const actorAuthority = scopeType === 'global' ? await isSuperAdmin(c, actor) ? 'super_admin' : null
    : await authority(c, actor, scopeType === 'parish' ? scopeId : null, scopeType === 'diocese' ? scopeId : null);
  const roles = new Set(policy.assignable[actorAuthority] || []);
  if (actorAuthority === 'diocesan_admin' && scopeType === 'parish') {
    const { diocese } = await c.first('SELECT diocese FROM parishes WHERE id=?', scopeId);
    if ((await scopedRoles(c, actor, null, diocese)).includes('clergy_assigner')) roles.add('priest');
  }
  return [...roles].filter(role => [scopeType, 'either'].includes(policy.roles[role].scope)).sort();
}

export async function protectLastSuperAdmin(c, target) {
  if (await isSuperAdmin(c, target)) {
    const row = await c.first('SELECT COUNT(*) AS count FROM pl_active_super_admins');
    need(row.count > 1, 'The last active Super Admin cannot be removed or deactivated.', 409);
  }
}

export function writeGrant(c, actor, targetId, role, scopeType, scopeId, active) {
  c.run('INSERT INTO pl_grants VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,scope_type,scope_id,role) DO UPDATE SET active=excluded.active,granted_by=excluded.granted_by,created_at=excluded.created_at',
    tokenHex(12), targetId, scopeType, scopeId, role, Number(active), actor?.id ?? null, NOW());
}

async function linkPerson(c, target, parishId, personId) {
  const state = JSON.parse((await c.first('SELECT data FROM states WHERE parish_id=?', parishId)).data);
  need(state.PEOPLE.some(person => person.id === personId), 'Choose a person in this parish.');
  need(!await c.first("SELECT 1 FROM pl_affiliations WHERE parish_id=? AND person_id=? AND user_id<>? AND membership='approved' UNION SELECT 1 FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? AND u.id<>?",
    parishId, personId, target.id, parishId, personId, target.id), 'This person is already linked to another account.', 409);
  c.run("INSERT INTO pl_affiliations VALUES(?,?,1,'approved',?,0,?) ON CONFLICT(user_id,parish_id) DO UPDATE SET person_id=excluded.person_id,membership='approved',updated_at=excluded.updated_at", target.id, parishId, personId, NOW());
}

export async function setGrant(c, actor, query) {
  const { scopeType, scopeId } = await assignmentScope(c, query);
  const role = query.role, active = query.active === undefined ? true : query.active;
  need(typeof active === 'boolean', 'Specify whether this assignment is active.');
  need((await permittedRoles(c, actor, scopeType, scopeId)).includes(role), 'You cannot assign or revoke this role in this scope.', 403);
  const target = await c.first('SELECT * FROM users WHERE id=?', query.userId);
  need(target && (!active || target.role !== 'disabled'), 'Account not found.', 404);
  if (active) need(!await suspended(c, target.id, scopeType === 'parish' ? scopeId : ''), 'Reactivate this account before assigning access.', 409);
  if (role === 'super_admin') {
    need(query._recentAuthentication === true, 'Confirm your current password to change Super Admin access.', 403);
    if (!active) await protectLastSuperAdmin(c, target);
  }
  if (role === 'clergy_assigner' && active) need((await scopedRoles(c, target, null, scopeId)).includes('diocesan_admin'), 'Appoint an Archdiocese Admin before delegating clergy appointments.');
  if (role === 'priest' && active) {
    const title = await c.first('SELECT title FROM pl_clergy_titles WHERE user_id=? ORDER BY created_at DESC LIMIT 1', target.id);
    need(title ? ['Priest', 'Monsignor', 'Archimandrite'].includes(title.title) : target.role === 'priest', 'A bishop must establish the clergy title before assigning priest access.');
    if (!await isSuperAdmin(c, actor)) {
      const { diocese } = await c.first('SELECT diocese FROM parishes WHERE id=?', scopeId);
      need(target.diocese === diocese, 'Cross-archdiocese clergy assignments require Super Admin authority.', 403);
    }
  }
  if (['priest', 'leader'].includes(role) && active) {
    const context = await parishContext(c, target, scopeId);
    const personId = query.personId || context?.person_id;
    need(personId, 'Choose this person’s record in the selected parish.');
    await linkPerson(c, target, scopeId, personId);
  }
  const previous = await c.first('SELECT active FROM pl_grants WHERE user_id=? AND scope_type=? AND scope_id=? AND role=?', target.id, scopeType, scopeId, role);
  if (previous && Boolean(previous.active) === active) return { ok: true, changed: false };
  writeGrant(c, actor, target.id, role, scopeType, scopeId, active);
  if (role === 'diocesan_admin' && !active) c.run("UPDATE pl_grants SET active=0 WHERE user_id=? AND scope_type='diocese' AND scope_id=? AND role='clergy_assigner'", target.id, scopeId);
  history(c, actor, scopeId, active ? 'role.granted' : 'role.revoked', { user: target.id, role, scopeType, scopeId, previousActive: previous ? Boolean(previous.active) : null });
  return { ok: true, changed: true };
}

export async function administrationHandle(c, actor, path, method, query) {
  if (path === '/api/workspace/grants' && method === 'POST') return setGrant(c, actor, query);
  if (path === '/api/workspace/administration' && method === 'GET') {
    const { scopeType, scopeId } = await assignmentScope(c, query);
    const actorAuthority = await isSuperAdmin(c, actor) ? 'super_admin'
      : await authority(c, actor, scopeType === 'parish' ? scopeId : null, scopeType === 'diocese' ? scopeId : null);
    need(['super_admin', 'bishop', 'diocesan_admin', 'parish_admin', 'priest'].includes(actorAuthority), 'Administration access required.', 403);
    need(scopeType !== 'global' || actorAuthority === 'super_admin', 'System administration access required.', 403);
    const afterUser=String(query.afterUser||'');
    let related='1=1', parameters=[];
    if(scopeType==='parish'){
      related="(EXISTS(SELECT 1 FROM assignments a WHERE a.user_id=u.id AND a.parish_id=?) OR EXISTS(SELECT 1 FROM pl_affiliations f WHERE f.user_id=u.id AND f.parish_id=?) OR EXISTS(SELECT 1 FROM pl_grants g WHERE g.user_id=u.id AND g.scope_type='parish' AND g.scope_id=?))";
      parameters=[scopeId,scopeId,scopeId];
    } else if(scopeType==='diocese'){
      related="(u.diocese=? OR EXISTS(SELECT 1 FROM pl_grants g WHERE g.user_id=u.id AND ((g.scope_type='diocese' AND g.scope_id=?) OR (g.scope_type='parish' AND g.scope_id IN (SELECT id FROM parishes WHERE diocese=?)))) OR EXISTS(SELECT 1 FROM assignments a JOIN parishes p ON p.id=a.parish_id WHERE a.user_id=u.id AND p.diocese=?) OR EXISTS(SELECT 1 FROM pl_affiliations f JOIN parishes p ON p.id=f.parish_id WHERE f.user_id=u.id AND p.diocese=?))";
      parameters=Array(5).fill(scopeId);
    }
    if(actorAuthority==='super_admin'){related='1=1';parameters=[];}
    const rows=await c.all(`SELECT u.id,u.name,u.username,EXISTS(SELECT 1 FROM pl_suspensions s WHERE s.user_id=u.id AND s.active=1 AND s.scope_id IN ('*',?)) AS inactive FROM users u WHERE u.role<>'disabled' AND u.id>? AND ${related} ORDER BY u.id LIMIT 101`,scopeType==='parish'?scopeId:'',afterUser,...parameters);
    const users=rows.slice(0,100).map(row=>({...row,inactive:Boolean(row.inactive)}));
    const nextUserCursor=rows.length>100?users.at(-1).id:null;
    const grants = await c.all('SELECT g.*,u.name FROM pl_grants g JOIN users u ON u.id=g.user_id WHERE scope_type=? AND scope_id=? ORDER BY g.created_at DESC,g.id', scopeType, scopeId);
    const legacy = scopeType === 'parish'
      ? await c.all("SELECT u.* FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.role IN ('priest','parish_admin','secretary','treasurer','leader')", scopeId)
      : scopeType === 'global' ? await c.all("SELECT * FROM users WHERE role='super_admin'") : [];
    for (const target of legacy) if (!grants.some(grant => grant.user_id === target.id && grant.role === target.role)) {
      grants.push({ id: 'legacy-' + target.id, user_id: target.id, name: target.name, role: target.role, active: 1, scope_type: scopeType, scope_id: scopeId });
    }
    const allowed = await permittedRoles(c, actor, scopeType, scopeId);
    return { scopeType, scopeId, authority: actorAuthority, users, grants: grants.map(grant => ({ ...grant, canManage: allowed.includes(grant.role) })),
      assignableRoles: allowed.map(role => ({ id: role, ...policy.roles[role] })), secretaryOptional: true, nextUserCursor };
  }
  if (path === '/api/workspace/account-lookup' && method === 'POST') {
    const { scopeType, scopeId } = await assignmentScope(c, query);
    need((await permittedRoles(c, actor, scopeType, scopeId)).length, 'Account assignment access required.', 403);
    const username = String(query.username || '').trim();
    need(username.length >= 3 && username.length <= 120, 'Enter the complete username.');
    const recent=await c.first("SELECT COUNT(*) AS count FROM pl_history WHERE actor_id=? AND (action='account.assignment.lookup' OR (action='administration.rejected' AND json_extract(detail,'$.operation')='account-lookup')) AND created_at>?",actor.id,new Date(Date.now()-3600000).toISOString());
    need(recent.count<60,'Too many account lookups. Please try again later.',429);
    const target = await c.first("SELECT id,name,username FROM users WHERE username=? AND role<>'disabled'", username);
    need(target, 'Account not found. Confirm the username with its owner.', 404);
    history(c, actor, scopeId, 'account.assignment.lookup', { user: target.id });
    return { user: target };
  }
  if (path === '/api/workspace/history' && method === 'GET') {
    const { scopeType, scopeId } = await assignmentScope(c, query);
    need((await permittedRoles(c, actor, scopeType, scopeId)).length, 'Administrative history access required.', 403);
    const before = String(query.before || ''), divider = before.indexOf('|');
    const cursorAt = divider < 0 ? before : before.slice(0, divider), cursorId = divider < 0 ? '' : before.slice(divider + 1);
    let scopeSql = 'h.scope_id=?', parameters = [scopeId];
    if (scopeType === 'global') { scopeSql = '1=1'; parameters = []; }
    else if (scopeType === 'diocese') { scopeSql = '(h.scope_id=? OR h.scope_id IN (SELECT id FROM parishes WHERE diocese=?))'; parameters.push(scopeId); }
    const rows = await c.all(`SELECT h.*,u.name AS actorName FROM pl_history h LEFT JOIN users u ON u.id=h.actor_id WHERE ${scopeSql} AND (?='' OR h.created_at<? OR (h.created_at=? AND h.id<?)) ORDER BY h.created_at DESC,h.id DESC LIMIT ?`,
      ...parameters, cursorAt, cursorAt, cursorAt, cursorId, 51);
    const events = rows.slice(0, 50).map(row => ({ ...row, detail: JSON.parse(row.detail) }));
    return { events, nextCursor: rows.length > 50 ? events.at(-1).created_at + '|' + events.at(-1).id : null };
  }
  if (path === '/api/workspace/secretaries' && method === 'POST') {
    const parishId = query.parish;
    need((await permittedRoles(c, actor, 'parish', parishId)).includes('secretary'), 'Secretary management access required.', 403);
    const selected = query.userIds;
    need(Array.isArray(selected) && selected.length <= 100 && selected.every(value => typeof value === 'string') && new Set(selected).size === selected.length, 'Choose distinct secretary accounts, or leave the list empty.');
    const existing = (await c.all("SELECT user_id FROM pl_grants WHERE scope_type='parish' AND scope_id=? AND role='secretary' AND active=1 UNION SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.role='secretary' AND NOT EXISTS(SELECT 1 FROM pl_grants g WHERE g.user_id=u.id AND g.scope_type='parish' AND g.scope_id=? AND g.role='secretary')",parishId,parishId,parishId)).map(row=>row.user_id);
    need(Array.isArray(query.expectedUserIds)&&query.expectedUserIds.every(value=>typeof value==='string'),'Reload the secretary selection before saving.');
    need(new Set(query.expectedUserIds).size===existing.length&&existing.every(value=>query.expectedUserIds.includes(value)),'Secretary assignments changed. Reload before saving.',409);
    for (const targetId of [...new Set([...existing, ...selected])].sort()) await setGrant(c, actor, { scopeType: 'parish', parish: parishId, userId: targetId, role: 'secretary', active: selected.includes(targetId) });
    history(c, actor, parishId, 'secretary.selection.updated', { previous: existing.sort(), selected });
    return { ok: true };
  }
  return null;
}
