/* Real SQLite-backed D1 batches verify that concurrent authority changes are
   retried before a stale authorization decision can be committed. */
import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalD1 } from './d1-sqlite.mjs';
import { Tx, Conflict } from '../src/db.js';
import { initialize } from '../src/app.js';
import { initializeWorkspace } from '../src/workspace.js';
import { setGrant, administrationHandle } from '../src/administration.js';
import { Problem } from '../src/py.js';

const directory=mkdtempSync(join(tmpdir(),'parishlife-administration-'));
const databasePath=join(directory,'concurrency.sqlite3');
const database=new LocalD1(databasePath);
try{
  await initialize(database,true);
  await initializeWorkspace(database);
  const setup=new Tx(database);
  setup.run("INSERT OR IGNORE INTO dioceses VALUES('pl-platform','Platform')");
  for(const identifier of ['first','second','secretary-one','secretary-two']){
    setup.run('INSERT INTO users VALUES(?,?,?,?,?,?,?)',identifier,identifier,identifier,'member','pl-platform',null,'test-only');
  }
  for(const identifier of ['first','second'])setup.run("INSERT INTO pl_grants VALUES(?,?,'global','*','super_admin',1,NULL,?)",'grant-'+identifier,identifier,new Date().toISOString());
  await setup.commit();

  const first=new Tx(database),second=new Tx(database);
  const revoke=userId=>({scopeType:'global',role:'super_admin',userId,active:false,_recentAuthentication:true});
  await setGrant(first,{id:'first'},revoke('first'));
  await setGrant(second,{id:'second'},revoke('second'));
  await first.commit();
  await assert.rejects(()=>second.commit(),Conflict);
  await assert.rejects(()=>setGrant(new Tx(database),{id:'second'},revoke('second')),error=>error instanceof Problem&&error.status===409);
  assert.equal((await database.prepare('SELECT COUNT(*) AS count FROM pl_active_super_admins').first()).count,1);

  const secretaryFirst=new Tx(database),secretarySecond=new Tx(database);
  const selection=userId=>({parish:'p-elias',userIds:[userId],expectedUserIds:[]});
  await administrationHandle(secretaryFirst,{id:'second'},'/api/workspace/secretaries','POST',selection('secretary-one'));
  await administrationHandle(secretarySecond,{id:'second'},'/api/workspace/secretaries','POST',selection('secretary-two'));
  await secretaryFirst.commit();
  await assert.rejects(()=>secretarySecond.commit(),Conflict);
  await assert.rejects(()=>administrationHandle(new Tx(database),{id:'second'},'/api/workspace/secretaries','POST',selection('secretary-two')),error=>error instanceof Problem&&error.status===409);
  const assignments=await database.prepare("SELECT user_id FROM pl_grants WHERE role='secretary' AND active=1").all();
  assert.deepEqual(assignments.results.map(row=>row.user_id),['secretary-one']);
  console.log('Passed concurrent last-Super-Admin protection and stale secretary replacement checks.');
}finally{
  database.close();
  unlinkSync(databasePath);
  rmdirSync(directory);
}
