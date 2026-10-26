"""Credential changes are authenticated separately from organizational grants."""
from . import workspace


def handle(c,actor,path,method,query,session_token,hash_password,password_matches,require):
    own_change=path=='/api/account/password'
    recovery=path=='/api/workspace/password-reset'
    if not (own_change or recovery):
        return None
    require(method=='POST','Method not allowed.',405)
    if recovery:
        require(workspace.is_super_admin(c,actor),'Super Admin credential recovery access required.',403)
    require(password_matches(actor['password'],str(query.get('currentPassword') or '')),'Your current password is not correct.',403)
    password=query.get('newPassword')
    require(isinstance(password,str) and 16<=len(password)<=200,'Use a password of 16–200 characters.')
    require(password==query.get('confirmPassword'),'The passwords do not match.')
    target=actor
    reason=''
    if recovery:
        target=c.execute('SELECT * FROM users WHERE id=?',(query.get('userId'),)).fetchone()
        require(target is not None,'Account not found.',404)
        require(target['id']!=actor['id'],'Use My account to change your own password.')
        reason=str(query.get('reason') or '').strip()
        require(3<=len(reason)<=500,'Record a recovery reason of 3–500 characters.')
    require(not password_matches(target['password'],password),'Choose a password different from the current one.')
    c.execute('UPDATE users SET password=? WHERE id=?',(hash_password(password),target['id']))
    if own_change:
        c.execute('DELETE FROM sessions WHERE user_id=? AND token<>?',(target['id'],session_token))
    else:
        c.execute('DELETE FROM sessions WHERE user_id=?',(target['id'],))
    workspace.history(c,actor,'*','account.password.changed' if own_change else 'account.password.recovered',
                      {'user':target['id'],'reason':reason,'otherSessionsRevoked':True})
    return {'ok':True}
