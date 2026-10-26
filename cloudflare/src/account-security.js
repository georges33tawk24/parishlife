import { need,passwordHash,passwordMatches,tokenHex } from './py.js';
import { isSuperAdmin,history } from './workspace.js';
import { ROUNDS } from './member.js';

export async function accountSecurity(c,actor,path,method,query,sessionToken){
  const ownChange=path==='/api/account/password',recovery=path==='/api/workspace/password-reset';
  if(!ownChange&&!recovery)return null;
  need(method==='POST','Method not allowed.',405);
  if(recovery)need(await isSuperAdmin(c,actor),'Super Admin credential recovery access required.',403);
  need(passwordMatches(actor.password,String(query.currentPassword||'')),'Your current password is not correct.',403);
  const password=query.newPassword;
  need(typeof password==='string'&&password.length>=16&&password.length<=200,'Use a password of 16–200 characters.');
  need(password===query.confirmPassword,'The passwords do not match.');
  let target=actor,reason='';
  if(recovery){
    target=await c.first('SELECT * FROM users WHERE id=?',query.userId);
    need(target,'Account not found.',404);
    need(target.id!==actor.id,'Use My account to change your own password.');
    reason=String(query.reason||'').trim();
    need(reason.length>=3&&reason.length<=500,'Record a recovery reason of 3–500 characters.');
  }
  need(!passwordMatches(target.password,password),'Choose a password different from the current one.');
  c.run('UPDATE users SET password=? WHERE id=?',passwordHash(password,tokenHex(16),ROUNDS),target.id);
  if(ownChange)c.run('DELETE FROM sessions WHERE user_id=? AND token<>?',target.id,sessionToken);
  else c.run('DELETE FROM sessions WHERE user_id=?',target.id);
  history(c,actor,'*',ownChange?'account.password.changed':'account.password.recovered',{user:target.id,reason,otherSessionsRevoked:true});
  return {ok:true};
}
