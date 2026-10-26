"""Scoped administration, shared by HTTP workflows and local operator tooling.

Callers must use a transaction. The HTTP server acquires BEGIN IMMEDIATE before
authorization; the Worker mirrors these rules inside its guarded atomic batch.
"""
import json
import secrets
import datetime as dt

from . import workspace as workspace

SENSITIVE_ENDPOINTS = {'grants','suspension','users','secretaries','parishes','dioceses','plans','plan','clergy-title','password-reset','account-lookup'}


def record_failure(c, actor, path, query, status, request_id):
    """Record a rejected mutation after its original transaction rolled back.

    Never copy the request body: it can contain passwords or private reasons.
    Attempts outside the actor's authority are visible only in the system log.
    """
    if path.rsplit('/',1)[-1] not in SENSITIVE_ENDPOINTS:
        return
    parish_id, diocese = query.get('parish'), query.get('diocese')
    scope_id = '*'
    global_request = query.get('scopeType') == 'global' or query.get('scope') == 'global'
    if not global_request and isinstance(parish_id,str) and workspace.authority(c,actor,parish_id):
        scope_id = parish_id
    elif not global_request and isinstance(diocese,str) and workspace.authority(c,actor,diocese=diocese):
        scope_id = diocese
    workspace.history(c,actor,scope_id,'administration.rejected',{
        'operation':path.rsplit('/',1)[-1], 'outcome':'rejected', 'status':status,
        'role':str(query.get('role') or '')[:80], 'user':str(query.get('userId') or '')[:120],
        'requestId':request_id})


def assignment_scope(c, query, require):
    scope_type = query.get('scopeType', 'parish')
    require(scope_type in {'global', 'diocese', 'parish'}, 'Choose a valid administrative scope.')
    scope_id = '*' if scope_type == 'global' else query.get('diocese') if scope_type == 'diocese' else query.get('parish')
    require(isinstance(scope_id, str) and scope_id, 'Choose an administrative scope.')
    if scope_type != 'global':
        table = 'dioceses' if scope_type == 'diocese' else 'parishes'
        require(scope_id != 'pl-platform' and c.execute(f'SELECT 1 FROM {table} WHERE id=?', (scope_id,)).fetchone(),
                'Administrative scope not found.', 404)
    return scope_type, scope_id


def permitted_roles(c, actor, scope_type, scope_id):
    authority = ('super_admin' if workspace.is_super_admin(c, actor) else None) if scope_type == 'global' else workspace.authority(
        c, actor, scope_id if scope_type == 'parish' else None, scope_id if scope_type == 'diocese' else None)
    roles = set(workspace.POLICY['assignable'].get(authority, []))
    if authority == 'diocesan_admin' and scope_type == 'parish':
        diocese = c.execute('SELECT diocese FROM parishes WHERE id=?', (scope_id,)).fetchone()['diocese']
        if 'clergy_assigner' in workspace.scoped_roles(c, actor, diocese=diocese):
            roles.add('priest')
    return sorted(role for role in roles if workspace.POLICY['roles'][role]['scope'] in {scope_type, 'either'})


def active_super_admins(c):
    return [row['id'] for row in c.execute('SELECT id FROM users') if workspace.is_super_admin(c, row)]


def protect_last_super_admin(c, target, require):
    if workspace.is_super_admin(c, target):
        require(len(active_super_admins(c)) > 1, 'The last active Super Admin cannot be removed or deactivated.', 409)


def write_grant(c, actor, target_id, role, scope_type, scope_id, active):
    c.execute('INSERT INTO pl_grants VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,scope_type,scope_id,role) '
              'DO UPDATE SET active=excluded.active,granted_by=excluded.granted_by,created_at=excluded.created_at',
              (secrets.token_hex(12), target_id, scope_type, scope_id, role, int(active), actor['id'] if actor else None, workspace.now()))


def set_grant(c, actor, query, require):
    scope_type, scope_id = assignment_scope(c, query, require)
    role, active = query.get('role'), query.get('active', True)
    require(isinstance(active, bool), 'Specify whether this assignment is active.')
    require(role in permitted_roles(c, actor, scope_type, scope_id), 'You cannot assign or revoke this role in this scope.', 403)
    target = c.execute('SELECT * FROM users WHERE id=?', (query.get('userId'),)).fetchone()
    require(target and (not active or target['role'] != 'disabled'), 'Account not found.', 404)
    if active:
        require(not workspace.suspended(c, target['id'], scope_id if scope_type == 'parish' else ''),
                'Reactivate this account before assigning access.', 409)
    if role == 'super_admin':
        # A current password is checked by the HTTP adapter; operator recovery is
        # explicitly separate. The service also requires that verification.
        require(query.get('_recentAuthentication') is True, 'Confirm your current password to change Super Admin access.', 403)
        if not active:
            protect_last_super_admin(c, target, require)
    if role == 'clergy_assigner' and active:
        require('diocesan_admin' in workspace.scoped_roles(c, target, diocese=scope_id),
                'Appoint an Archdiocese Admin before delegating clergy appointments.')
    if role == 'priest' and active:
        title = c.execute('SELECT title FROM pl_clergy_titles WHERE user_id=? ORDER BY created_at DESC LIMIT 1', (target['id'],)).fetchone()
        require(title['title'] in {'Priest', 'Monsignor', 'Archimandrite'} if title else target['role'] == 'priest',
                'A bishop must establish the clergy title before assigning priest access.')
        if not workspace.is_super_admin(c, actor):
            diocese = c.execute('SELECT diocese FROM parishes WHERE id=?', (scope_id,)).fetchone()['diocese']
            require(target['diocese'] == diocese, 'Cross-archdiocese clergy assignments require Super Admin authority.', 403)
    if role in {'priest', 'leader'} and active:
        context = workspace.parish_context(c, target, scope_id)
        person_id = query.get('personId') or (context['person_id'] if context else None)
        require(person_id, 'Choose this person’s record in the selected parish.')
        link_person(c, target, scope_id, person_id, require)
    previous = c.execute('SELECT active FROM pl_grants WHERE user_id=? AND scope_type=? AND scope_id=? AND role=?',
                         (target['id'], scope_type, scope_id, role)).fetchone()
    if previous and bool(previous['active']) == active:
        return {'ok': True, 'changed': False}
    # The persisted inactive row also suppresses legacy assignments. Never
    # delete it, since deletion would restore the original account-level role.
    write_grant(c, actor, target['id'], role, scope_type, scope_id, active)
    if role == 'diocesan_admin' and not active:
        c.execute("UPDATE pl_grants SET active=0 WHERE user_id=? AND scope_type='diocese' AND scope_id=? AND role='clergy_assigner'", (target['id'], scope_id))
    workspace.history(c, actor, scope_id, 'role.granted' if active else 'role.revoked',
                      {'user': target['id'], 'role': role, 'scopeType': scope_type, 'scopeId': scope_id,
                       'previousActive': bool(previous['active']) if previous else None})
    return {'ok': True, 'changed': True}


def link_person(c, target, parish_id, person_id, require):
    state = json.loads(c.execute('SELECT data FROM states WHERE parish_id=?', (parish_id,)).fetchone()['data'])
    require(any(person['id'] == person_id for person in state['PEOPLE']), 'Choose a person in this parish.')
    require(not c.execute("SELECT 1 FROM pl_affiliations WHERE parish_id=? AND person_id=? AND user_id<>? AND membership='approved' "
                          'UNION SELECT 1 FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.person_id=? AND u.id<>?',
                          (parish_id, person_id, target['id'], parish_id, person_id, target['id'])).fetchone(),
            'This person is already linked to another account.', 409)
    c.execute("INSERT INTO pl_affiliations VALUES(?,?,1,'approved',?,0,?) ON CONFLICT(user_id,parish_id) "
              "DO UPDATE SET person_id=excluded.person_id,membership='approved',updated_at=excluded.updated_at",
              (target['id'], parish_id, person_id, workspace.now()))


def handle(c, actor, path, method, query, require):
    if path == '/api/workspace/grants' and method == 'POST':
        return set_grant(c, actor, query, require)
    if path == '/api/workspace/administration' and method == 'GET':
        scope_type, scope_id = assignment_scope(c, query, require)
        authority = 'super_admin' if workspace.is_super_admin(c, actor) else workspace.authority(
            c, actor, scope_id if scope_type == 'parish' else None, scope_id if scope_type == 'diocese' else None)
        require(authority in workspace.ADMIN_ROLES | {'priest'}, 'Administration access required.', 403)
        require(scope_type != 'global' or authority == 'super_admin', 'System administration access required.', 403)
        grants = []
        # Include every account only for a Super Admin. Other scopes include
        # related users; an exact-username lookup can deliberately add an
        # existing unlinked account without exposing a global directory.
        after_user = str(query.get('afterUser') or '')
        parameters = []
        related = '1=1'
        if scope_type == 'parish':
            related = "(EXISTS(SELECT 1 FROM assignments a WHERE a.user_id=u.id AND a.parish_id=?) OR EXISTS(SELECT 1 FROM pl_affiliations f WHERE f.user_id=u.id AND f.parish_id=?) OR EXISTS(SELECT 1 FROM pl_grants g WHERE g.user_id=u.id AND g.scope_type='parish' AND g.scope_id=?))"
            parameters = [scope_id,scope_id,scope_id]
        elif scope_type == 'diocese':
            related = "(u.diocese=? OR EXISTS(SELECT 1 FROM pl_grants g WHERE g.user_id=u.id AND ((g.scope_type='diocese' AND g.scope_id=?) OR (g.scope_type='parish' AND g.scope_id IN (SELECT id FROM parishes WHERE diocese=?)))) OR EXISTS(SELECT 1 FROM assignments a JOIN parishes p ON p.id=a.parish_id WHERE a.user_id=u.id AND p.diocese=?) OR EXISTS(SELECT 1 FROM pl_affiliations f JOIN parishes p ON p.id=f.parish_id WHERE f.user_id=u.id AND p.diocese=?))"
            parameters = [scope_id]*5
        if authority == 'super_admin':
            related, parameters = '1=1', []
        rows = c.execute(f"SELECT u.id,u.name,u.username,EXISTS(SELECT 1 FROM pl_suspensions s WHERE s.user_id=u.id AND s.active=1 AND s.scope_id IN ('*',?)) AS inactive FROM users u WHERE u.role<>'disabled' AND u.id>? AND {related} ORDER BY u.id LIMIT 101",
                         (scope_id if scope_type=='parish' else '',after_user,*parameters)).fetchall()
        users = [{**dict(row),'inactive':bool(row['inactive'])} for row in rows[:100]]
        next_user_cursor = users[-1]['id'] if len(rows)>100 else None
        for grant in c.execute('SELECT g.*,u.name FROM pl_grants g JOIN users u ON u.id=g.user_id WHERE scope_type=? AND scope_id=? ORDER BY g.created_at DESC,g.id', (scope_type, scope_id)):
            grants.append(dict(grant))
        legacy_role = 'super_admin' if scope_type == 'global' else None
        if scope_type == 'parish':
            legacy = c.execute("SELECT u.* FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.role IN ('priest','parish_admin','secretary','treasurer','leader')", (scope_id,)).fetchall()
        elif legacy_role:
            legacy = c.execute('SELECT * FROM users WHERE role=?', (legacy_role,)).fetchall()
        else:
            legacy = []
        for target in legacy:
            if not any(grant['user_id'] == target['id'] and grant['role'] == target['role'] for grant in grants):
                grants.append({'id': 'legacy-'+target['id'], 'user_id': target['id'], 'name': target['name'],
                               'role': target['role'], 'active': 1, 'scope_type': scope_type, 'scope_id': scope_id})
        allowed = permitted_roles(c, actor, scope_type, scope_id)
        return {'scopeType': scope_type, 'scopeId': scope_id, 'authority': authority, 'users': users,
                'grants': [{**grant, 'canManage': grant['role'] in allowed} for grant in grants],
                'assignableRoles': [{'id': role, **workspace.POLICY['roles'][role]} for role in allowed],
                'secretaryOptional': True, 'nextUserCursor':next_user_cursor}
    if path == '/api/workspace/account-lookup' and method == 'POST':
        scope_type, scope_id = assignment_scope(c, query, require)
        require(permitted_roles(c, actor, scope_type, scope_id), 'Account assignment access required.', 403)
        username = str(query.get('username') or '').strip()
        require(3 <= len(username) <= 120, 'Enter the complete username.')
        since = (dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=1)).isoformat()
        recent = c.execute("SELECT COUNT(*) FROM pl_history WHERE actor_id=? AND (action='account.assignment.lookup' OR (action='administration.rejected' AND json_extract(detail,'$.operation')='account-lookup')) AND created_at>?", (actor['id'],since)).fetchone()[0]
        require(recent < 60, 'Too many account lookups. Please try again later.', 429)
        target = c.execute("SELECT id,name,username FROM users WHERE username=? AND role<>'disabled'", (username,)).fetchone()
        require(target, 'Account not found. Confirm the username with its owner.', 404)
        workspace.history(c, actor, scope_id, 'account.assignment.lookup', {'user': target['id']})
        return {'user': dict(target)}
    if path == '/api/workspace/history' and method == 'GET':
        scope_type, scope_id = assignment_scope(c, query, require)
        require(permitted_roles(c, actor, scope_type, scope_id), 'Administrative history access required.', 403)
        before = str(query.get('before') or '')
        limit = 50
        # Cursor includes the ID so events sharing a timestamp are not skipped.
        cursor_at, _, cursor_id = before.partition('|')
        scope_sql, parameters = 'h.scope_id=?', [scope_id]
        if scope_type == 'global':
            scope_sql, parameters = '1=1', []
        elif scope_type == 'diocese':
            scope_sql = '(h.scope_id=? OR h.scope_id IN (SELECT id FROM parishes WHERE diocese=?))'
            parameters.append(scope_id)
        rows = c.execute(f'SELECT h.*,u.name AS actorName FROM pl_history h LEFT JOIN users u ON u.id=h.actor_id WHERE {scope_sql} '
                         'AND (?=\'\' OR h.created_at<? OR (h.created_at=? AND h.id<?)) ORDER BY h.created_at DESC,h.id DESC LIMIT ?',
                         (*parameters, cursor_at, cursor_at, cursor_at, cursor_id, limit+1)).fetchall()
        result = [{**dict(row), 'detail': json.loads(row['detail'])} for row in rows[:limit]]
        return {'events': result, 'nextCursor': result[-1]['created_at']+'|'+result[-1]['id'] if len(rows)>limit else None}
    if path == '/api/workspace/secretaries' and method == 'POST':
        parish_id = query.get('parish')
        require('secretary' in permitted_roles(c, actor, 'parish', parish_id), 'Secretary management access required.', 403)
        # Replacing the selection is explicit and atomic. An empty list is a
        # supported state, and unrelated roles and person links are preserved.
        selected = query.get('userIds')
        require(isinstance(selected, list) and len(selected) <= 100 and all(isinstance(value, str) for value in selected)
                and len(selected) == len(set(selected)), 'Choose distinct secretary accounts, or leave the list empty.')
        existing = {row['user_id'] for row in c.execute("SELECT user_id FROM pl_grants WHERE scope_type='parish' AND scope_id=? AND role='secretary' AND active=1 UNION SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.role='secretary' AND NOT EXISTS(SELECT 1 FROM pl_grants g WHERE g.user_id=u.id AND g.scope_type='parish' AND g.scope_id=? AND g.role='secretary')", (parish_id,parish_id,parish_id))}
        expected = query.get('expectedUserIds')
        require(isinstance(expected,list) and all(isinstance(value,str) for value in expected), 'Reload the secretary selection before saving.')
        require(set(expected) == existing, 'Secretary assignments changed. Reload before saving.', 409)
        for target_id in sorted(existing | set(selected)):
            set_grant(c, actor, {'scopeType': 'parish', 'parish': parish_id, 'userId': target_id,
                                'role': 'secretary', 'active': target_id in selected}, require)
        workspace.history(c, actor, parish_id, 'secretary.selection.updated', {'previous': sorted(existing), 'selected': selected})
        return {'ok': True}
    return None
