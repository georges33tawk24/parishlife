"""Real HTTP authorization tests, runnable unchanged against Python and the Worker.

Every test uses a temporary database; no developer or parish account is created
in the working installation. Session fixtures avoid weakening production login.
"""
import hashlib
import base64
import http.client
import http.server
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import time
import unittest

import server


class QuietHandler(server.Handler):
    def log_message(self, *args):
        pass


class AdministrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password = 'An independently chosen password 42!'
        cls.password_hash = server.password_hash(cls.password)

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.previous_database = server.DB
        server.DB = Path(self.directory.name) / 'administration.sqlite3'
        server.init_db()
        with server.connect() as connection:
            connection.execute("INSERT INTO dioceses VALUES('outside','Outside archdiocese'),('empty','Empty archdiocese')")
            self.other_parish = connection.execute("SELECT id FROM parishes WHERE id<>'p-elias' LIMIT 1").fetchone()[0]
            state = json.loads(connection.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()[0])
            state['PARISH']['id'] = 'outside-parish'
            connection.execute('INSERT INTO parishes VALUES(?,?,?)', ('outside-parish', 'outside', json.dumps({'id':'outside-parish','name':'Outside parish'})))
            connection.execute('INSERT INTO states VALUES(?,1,?)', ('outside-parish', json.dumps(state)))
            fixtures = [
                ('root','super_admin','beirut',None), ('root2','super_admin','beirut',None),
                ('bishop','bishop','beirut',None), ('priest','priest','beirut','p17'),
                ('arch-admin','member','beirut',None), ('parish-admin','member','beirut',None),
                ('secretary','secretary','beirut','p4'), ('target','member','pl-platform',None),
                ('mixed','member','pl-platform',None), ('outside-bishop','bishop','outside',None),
                ('empty-bishop','bishop','empty',None), ('ambiguous','admin','beirut',None)
            ]
            connection.execute("INSERT OR IGNORE INTO dioceses VALUES('pl-platform','Accounts')")
            for identifier, role, diocese, person in fixtures:
                connection.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',
                                   (identifier,identifier,identifier,role,diocese,person,self.password_hash))
                token = hashlib.sha256(identifier.encode()).hexdigest()
                connection.execute('INSERT INTO sessions VALUES(?,?,?,?)',
                                   (hashlib.sha256(token.encode()).hexdigest(),identifier,'csrf-'+identifier,time.time()+3600))
            for identifier in ['priest','secretary']:
                connection.execute('INSERT INTO assignments VALUES(?,?)', (identifier,'p-elias'))
            for identifier, scope_type, scope_id, role in [
                ('arch-admin','diocese','beirut','diocesan_admin'),
                ('parish-admin','parish','p-elias','parish_admin'),
                ('mixed','parish','p-elias','parish_admin'),
                ('mixed','parish',self.other_parish,'secretary')
            ]:
                connection.execute('INSERT INTO pl_grants VALUES(?,?,?,?,?,1,?,?)',
                                   (identifier+'-'+role,identifier,scope_type,scope_id,role,'root',server.NOW()))
        self.http = http.server.ThreadingHTTPServer(('127.0.0.1',0), QuietHandler)
        self.thread = threading.Thread(target=self.http.serve_forever, kwargs={'poll_interval':0.01}, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        server.DB = self.previous_database
        self.directory.cleanup()

    def call(self, actor, method, path, body=None, csrf=True):
        connection = http.client.HTTPConnection(*self.http.server_address, timeout=40)
        headers = {'Content-Type':'application/json'}
        if actor:
            headers['Cookie'] = 'pl_session='+hashlib.sha256(actor.encode()).hexdigest()
            if csrf:
                headers['X-CSRF-Token'] = 'csrf-'+actor
        try:
            connection.request(method,path,json.dumps(body) if body is not None else None,headers)
            response = connection.getresponse()
            data = response.read()
            return response.status, json.loads(data or b'{}')
        finally:
            connection.close()

    def grant(self, actor, role, target='target', scope='parish', active=True, **extra):
        return self.call(actor,'POST','/api/workspace/grants',
                         dict(scopeType=scope,parish='p-elias',diocese='beirut',role=role,userId=target,active=active,**extra))

    def get_state(self, actor, parish='p-elias'):
        return self.call(actor,'GET',f'/api/parishes/{parish}/state')

    def test_super_admin_has_every_scope_without_membership(self):
        status, result = self.call('root','GET','/api/session')
        self.assertEqual(status,200,result)
        self.assertEqual(result['platformRole'],'super_admin')
        self.assertIn('outside-parish',{parish['id'] for parish in result['parishes']})
        self.assertEqual(self.get_state('root','outside-parish')[0],200)

    def test_bishop_appoints_and_revokes_archdiocese_admin(self):
        self.assertEqual(self.grant('bishop','diocesan_admin',scope='diocese')[0],200)
        self.assertEqual(self.get_state('target')[0],200)
        self.assertEqual(self.get_state('target','outside-parish')[0],403)
        self.assertEqual(self.grant('bishop','diocesan_admin',scope='diocese',active=False)[0],200)
        self.assertEqual(self.get_state('target')[0],403)

    def test_bishop_cannot_appoint_in_other_archdiocese(self):
        status, _ = self.call('bishop','POST','/api/workspace/grants',dict(scopeType='diocese',diocese='outside',role='diocesan_admin',userId='target'))
        self.assertEqual(status,403)

    def test_priest_and_archdiocese_admin_appoint_parish_admins(self):
        for actor in ['priest','arch-admin']:
            with self.subTest(actor=actor):
                self.assertEqual(self.grant(actor,'parish_admin')[0],200)
                self.assertEqual(self.get_state('target')[0],200)
                self.assertEqual(self.get_state('target',self.other_parish)[0],403)
                self.assertEqual(self.grant(actor,'parish_admin',active=False)[0],200)

    def test_parish_admin_cannot_assign_admin_peers_or_higher_roles(self):
        for role, scope in [('parish_admin','parish'),('diocesan_admin','diocese'),('super_admin','global'),('priest','parish')]:
            with self.subTest(role=role):
                self.assertEqual(self.grant('parish-admin',role,scope=scope,currentPassword=self.password)[0],403)
        self.assertEqual(self.grant('parish-admin','parish_admin',target='parish-admin',active=False)[0],403)

    def test_archdiocese_admin_cannot_assign_archdiocese_admin_peers(self):
        self.assertEqual(self.grant('arch-admin','diocesan_admin',scope='diocese')[0],403)
        self.assertEqual(self.grant('arch-admin','priest',personId='p6')[0],403)

    def test_parish_admin_manages_secretary_without_clergy_status(self):
        self.assertEqual(self.grant('parish-admin','secretary')[0],200)
        status, result = self.call('target','GET','/api/session')
        self.assertEqual(status,200)
        self.assertEqual(next(parish['effectiveRole'] for parish in result['parishes'] if parish['id']=='p-elias'),'secretary')
        status, state = self.get_state('parish-admin')
        self.assertEqual(status,200)
        self.assertEqual(self.call('parish-admin','POST','/api/parishes/p-elias/workflow',dict(action='approve-sacrament-request',id='none',revision=state['revision']))[0],403)

    def test_multiple_roles_do_not_cross_scopes(self):
        status, session = self.call('mixed','GET','/api/session')
        self.assertEqual(status,200)
        roles = {parish['id']:parish['effectiveRole'] for parish in session['parishes']}
        self.assertEqual(roles['p-elias'],'parish_admin')
        self.assertEqual(roles[self.other_parish],'secretary')
        self.assertEqual(self.call('mixed','POST','/api/workspace/grants',dict(parish=self.other_parish,role='secretary',userId='target'))[0],403)

    def test_revocation_preserves_unrelated_role(self):
        self.assertEqual(self.grant('priest','parish_admin',target='mixed',active=False)[0],200)
        self.assertEqual(self.get_state('mixed')[0],403)
        self.assertEqual(self.get_state('mixed',self.other_parish)[0],200)

    def test_secretary_can_be_removed_without_deleting_account(self):
        self.assertEqual(self.grant('parish-admin','secretary',target='secretary',active=False)[0],200)
        self.assertEqual(self.get_state('secretary')[0],403)
        with server.connect() as connection:
            self.assertIsNotNone(connection.execute("SELECT 1 FROM users WHERE id='secretary'").fetchone())
            self.assertEqual(connection.execute("SELECT active FROM pl_grants WHERE user_id='secretary' AND role='secretary'").fetchone()[0],0)

    def test_secretary_selection_is_atomic_and_allows_none(self):
        self.assertEqual(self.grant('priest','secretary')[0],200)
        with server.connect() as connection:
            connection.execute("UPDATE users SET role='disabled' WHERE id='target'")
        status, result = self.call('priest','POST','/api/workspace/secretaries',dict(parish='p-elias',userIds=[],expectedUserIds=['secretary','target']))
        self.assertEqual(status,200,result)
        self.assertEqual(self.get_state('secretary')[0],403)
        with server.connect() as connection:
            connection.execute("UPDATE users SET role='member' WHERE id='target'")
        status, result = self.call('priest','POST','/api/workspace/secretaries',dict(parish='p-elias',userIds=['target','missing'],expectedUserIds=[]))
        self.assertEqual(status,404,result)
        self.assertEqual(self.get_state('target')[0],403)

    def test_stale_secretary_selection_is_rejected(self):
        self.assertEqual(self.call('priest','POST','/api/workspace/secretaries',dict(parish='p-elias',userIds=[],expectedUserIds=[]))[0],409)
        self.assertEqual(self.get_state('secretary')[0],200)

    def test_parish_creation_without_secretary_is_operational(self):
        for actor in ['bishop','arch-admin']:
            status, result = self.call(actor,'POST','/api/workspace/parishes',dict(diocese='beirut',name='A new parish',town='Beirut'))
            self.assertEqual(status,200,result)
            self.assertEqual(self.get_state(actor,result['id'])[0],200)
            status, administration = self.call(actor,'GET','/api/workspace/administration?parish='+result['id'])
            self.assertEqual(status,200,administration)
            self.assertFalse(any(grant['role']=='secretary' and grant['active'] for grant in administration['grants']))

    def test_parish_creation_accepts_optional_secretary(self):
        status, result = self.call('bishop','POST','/api/workspace/parishes',dict(diocese='beirut',name='With office',town='Beirut',secretaryUserId='target'))
        self.assertEqual(status,200,result)
        self.assertEqual(self.get_state('target',result['id'])[0],200)

    def test_empty_archdiocese_admin_appointments_need_no_parish(self):
        status, result = self.call('empty-bishop','POST','/api/workspace/grants',dict(scopeType='diocese',diocese='empty',role='diocesan_admin',userId='target'))
        self.assertEqual(status,200,result)
        status, session = self.call('target','GET','/api/session')
        self.assertEqual(session['platformRole'],'diocesan_admin')
        self.assertEqual(session['parishes'],[])
        self.assertEqual(self.call('target','POST','/api/workspace/parishes',dict(diocese='empty',name='First parish',town='Beirut'))[0],200)

    def test_super_admin_grant_requires_real_password_not_client_flag(self):
        self.assertEqual(self.grant('root','super_admin',scope='global',_recentAuthentication=True)[0],403)
        self.assertEqual(self.grant('root','super_admin',scope='global',currentPassword=self.password)[0],200)
        self.assertEqual(self.get_state('target','outside-parish')[0],200)
        self.assertEqual(self.grant('root','super_admin',scope='global',active=False,currentPassword=self.password)[0],200)
        self.assertEqual(self.get_state('target','outside-parish')[0],403)

    def test_last_super_admin_protection_in_application_and_database(self):
        self.assertEqual(self.grant('root','super_admin',target='root2',scope='global',active=False,currentPassword=self.password)[0],200)
        status, result = self.grant('root','super_admin',target='root',scope='global',active=False,currentPassword=self.password)
        self.assertEqual(status,409,result)
        with server.connect() as connection:
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute("UPDATE users SET role='disabled' WHERE id='root'")

    def test_revoked_legacy_super_admin_cannot_use_raw_account_role(self):
        self.assertEqual(self.grant('root','super_admin',target='root2',scope='global',active=False,currentPassword=self.password)[0],200)
        self.assertEqual(self.call('root2','POST','/api/workspace/dioceses',dict(name='Unauthorized archdiocese'))[0],403)
        status, result = self.call('root2','GET','/api/session')
        self.assertEqual(result['platformRole'],'member')

    def test_admins_have_finance_and_office_record_management(self):
        for actor in ['root','bishop','arch-admin','parish-admin']:
            with self.subTest(actor=actor):
                status, result = self.get_state(actor)
                self.assertEqual(status,200,result)
                parish = result['d']['PARISH']
                parish['phone'] = '01 555 123'
                status, saved = self.call(actor,'PUT','/api/parishes/p-elias/state',dict(revision=result['revision'],changes={'PARISH':parish}))
                self.assertEqual(status,200,saved)
                self.assertEqual(saved['d']['PARISH']['phone'],'01 555 123')
                self.assertEqual(saved['d']['NOTES'],[])

    def test_management_read_and_audit_are_scoped(self):
        self.assertEqual(self.call('parish-admin','GET',f'/api/workspace/administration?parish={self.other_parish}')[0],403)
        self.assertEqual(self.grant('priest','secretary')[0],200)
        status, result = self.call('parish-admin','GET','/api/workspace/history?parish=p-elias')
        self.assertEqual(status,200,result)
        self.assertTrue(any(event['action']=='role.granted' for event in result['events']))
        self.assertTrue(all(event['scope_id']=='p-elias' for event in result['events']))
        self.assertEqual(self.call('parish-admin','GET','/api/workspace/history?scopeType=global')[0],403)

    def test_office_invitation_loses_authority_when_inviter_role_revoked(self):
        status, invitation = self.call('parish-admin','POST','/api/workspace/invitations',dict(parish='p-elias',personId='p6'))
        self.assertEqual(status,200,invitation)
        self.assertEqual(self.grant('priest','parish_admin',target='parish-admin',active=False)[0],200)
        status, result = self.call('target','POST','/api/account/claim-invitation',dict(token=invitation['token']))
        self.assertEqual(status,410,result)

    def test_new_account_creation_cannot_bypass_role_assignment_rules(self):
        values = dict(parish='p-elias',diocese='beirut',name='New admin',username='new-admin',password=self.password,role='parish_admin')
        self.assertEqual(self.call('parish-admin','POST','/api/workspace/users',values)[0],403)
        status, result = self.call('priest','POST','/api/workspace/users',values)
        self.assertEqual(status,200,result)
        with server.connect() as connection:
            self.assertEqual(connection.execute('SELECT role FROM users WHERE id=?',(result['id'],)).fetchone()[0],'member')
            self.assertEqual(connection.execute('SELECT role FROM pl_grants WHERE user_id=?',(result['id'],)).fetchone()[0],'parish_admin')

    def test_assignment_constraints_and_unknown_scopes(self):
        self.assertEqual(self.call('bishop','POST','/api/workspace/grants',dict(scopeType='diocese',diocese='missing',role='diocesan_admin',userId='target'))[0],404)
        with server.connect() as connection:
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute("INSERT INTO pl_grants VALUES('invalid','target','parish','p-elias','super_admin',1,'root','now')")
        self.assertEqual(self.call('ambiguous','GET','/api/session')[0],401)

    def test_csrf_and_authentication_are_still_enforced(self):
        self.assertEqual(self.call(None,'GET','/api/workspace/administration?parish=p-elias')[0],401)
        self.assertEqual(self.call('priest','POST','/api/workspace/grants',dict(parish='p-elias',role='secretary',userId='target'),csrf=False)[0],403)

    def test_admin_cannot_remove_peer_by_deactivating_account(self):
        self.assertEqual(self.grant('priest','parish_admin')[0],200)
        status, result = self.call('parish-admin','POST','/api/workspace/suspension',dict(parish='p-elias',userId='target',active=True,reason='Attempted peer removal'))
        self.assertEqual(status,403,result)
        self.assertEqual(self.get_state('target')[0],200)

    def test_deactivation_removes_access_and_requires_authorized_reactivation(self):
        self.assertEqual(self.grant('priest','secretary')[0],200)
        self.assertEqual(self.call('arch-admin','POST','/api/workspace/suspension',dict(parish='p-elias',userId='target',active=True,reason='Office access paused'))[0],200)
        self.assertEqual(self.get_state('target')[0],403)
        self.assertEqual(self.call('parish-admin','POST','/api/workspace/suspension',dict(parish='p-elias',userId='target',active=False,reason='Attempt to override archdiocese'))[0],403)
        self.assertEqual(self.call('arch-admin','POST','/api/workspace/suspension',dict(parish='p-elias',userId='target',active=False,reason='Office access restored'))[0],200)
        self.assertEqual(self.get_state('target')[0],200)

    def test_admin_file_upload_and_cross_scope_download_isolation(self):
        payload=dict(scope='person',id='p6',name='review.pdf',data=base64.b64encode(b'%PDF-1.4\n%%EOF').decode())
        status, uploaded=self.call('parish-admin','POST','/api/parishes/p-elias/files',payload)
        self.assertEqual(status,200,uploaded)
        status, files=self.call('arch-admin','GET','/api/parishes/p-elias/files?scope=person&id=p6')
        self.assertEqual(status,200,files)
        self.assertIn(uploaded['id'],[record['id'] for record in files['files']])
        self.assertEqual(self.call('outside-bishop','GET','/api/parishes/p-elias/files?scope=person&id=p6')[0],403)
        self.assertEqual(self.call('parish-admin','GET','/api/parishes/outside-parish/files?scope=person&id=p6')[0],403)

    def test_parish_ownership_fields_cannot_be_tampered_with(self):
        for actor in ['root','arch-admin','parish-admin']:
            status, result=self.get_state(actor)
            parish=result['d']['PARISH']
            parish['id']='outside-parish'
            self.assertEqual(self.call(actor,'PUT','/api/parishes/p-elias/state',dict(revision=result['revision'],changes={'PARISH':parish}))[0],403)

    def test_profile_update_cannot_grant_admin_access(self):
        status, result=self.call('target','PUT','/api/account',dict(role='super_admin',scopeType='global',profile={'firstName':'Target','lastName':'User','role':'super_admin'}))
        self.assertEqual(status,200,result)
        self.assertEqual(self.get_state('target')[0],403)
        with server.connect() as connection:
            self.assertEqual(connection.execute("SELECT role FROM users WHERE id='target'").fetchone()[0],'member')

    def test_bulk_operations_reject_mixed_scope_without_partial_writes(self):
        status, result=self.call('arch-admin','POST','/api/workspace/plans',dict(parishes=['p-elias','outside-parish'],arrangement='Invalid shared plan',bundle='complete'))
        self.assertEqual(status,403,result)
        with server.connect() as connection:
            self.assertEqual(connection.execute('SELECT COUNT(*) FROM pl_plans').fetchone()[0],0)

    def test_additional_priest_assignment_preserves_clergy_permission(self):
        self.assertEqual(self.grant('bishop','diocesan_admin',target='priest',scope='diocese')[0],200)
        status, state=self.get_state('priest')
        self.assertEqual(status,200)
        request=next((record for record in state['d']['SACRAMENTS'] if record['status'] in {'requested','office-reviewed'} and record['kind']!='certificate'),None)
        if request is None:
            status, result=self.call('priest','POST','/api/parishes/p-elias/workflow',dict(action='create-sacrament-request',revision=state['revision'],id='sc-additional-clergy-test',person='p6',kind='baptism'))
            self.assertEqual(status,200,result)
            status,state=self.get_state('priest')
            request=next(record for record in state['d']['SACRAMENTS'] if record['id']=='sc-additional-clergy-test')
        self.assertEqual(self.call('priest','POST','/api/parishes/p-elias/workflow',dict(action='approve-sacrament-request',revision=state['revision'],id=request['id']))[0],200)

    def test_administration_directory_paginates_without_cross_scope_leaks(self):
        with server.connect() as connection:
            for number in range(105):
                identifier=f'page-user-{number:03d}'
                connection.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',(identifier,identifier,identifier,'member','outside',None,self.password_hash))
        status, page=self.call('root','GET','/api/workspace/administration?scopeType=global')
        self.assertEqual(status,200,page)
        self.assertEqual(len(page['users']),100)
        self.assertIsNotNone(page['nextUserCursor'])
        status, next_page=self.call('root','GET','/api/workspace/administration?scopeType=global&afterUser='+page['nextUserCursor'])
        self.assertEqual(status,200,next_page)
        self.assertFalse(set(user['id'] for user in page['users']) & set(user['id'] for user in next_page['users']))
        status, parish_page=self.call('parish-admin','GET','/api/workspace/administration?parish=p-elias')
        self.assertEqual(status,200,parish_page)
        self.assertFalse(any(user['id'].startswith('page-user') for user in parish_page['users']))

    def test_admin_audit_cursor_preserves_events_with_same_timestamp(self):
        with server.connect() as connection:
            for number in range(55):
                connection.execute('INSERT INTO pl_history VALUES(?,?,?,?,?,?)',(f'cursor-{number:03d}','root','p-elias','test.audit','{}','2099-01-01T00:00:00+00:00'))
        status, page=self.call('parish-admin','GET','/api/workspace/history?parish=p-elias')
        self.assertEqual(status,200,page)
        self.assertEqual(len(page['events']),50)
        from urllib.parse import quote
        status, last=self.call('parish-admin','GET','/api/workspace/history?parish=p-elias&before='+quote(page['nextCursor']))
        self.assertEqual(status,200,last)
        self.assertEqual(len(last['events']),5)
        self.assertEqual(len({event['id'] for event in page['events']+last['events']}),55)

    def test_secretary_removal_works_even_when_account_is_suspended(self):
        self.assertEqual(self.call('priest','POST','/api/workspace/suspension',dict(parish='p-elias',userId='secretary',active=True,reason='Temporary suspension'))[0],200)
        status, result=self.call('priest','POST','/api/workspace/secretaries',dict(parish='p-elias',userIds=[],expectedUserIds=['secretary']))
        self.assertEqual(status,200,result)
        with server.connect() as connection:
            self.assertEqual(connection.execute("SELECT active FROM pl_grants WHERE user_id='secretary' AND role='secretary'").fetchone()[0],0)

    def test_malformed_role_status_does_not_create_assignment(self):
        self.assertEqual(self.grant('priest','secretary',active=None)[0],400)
        self.assertEqual(self.get_state('target')[0],403)

    def test_people_management_uses_effective_roles_and_hides_peer_suspension(self):
        self.assertEqual(self.grant('priest','parish_admin')[0],200)
        status,result=self.call('parish-admin','GET','/api/workspace/people?parish=p-elias')
        self.assertEqual(status,200,result)
        peer=next(user for user in result['users'] if user['id']=='target')
        self.assertEqual(peer['effectiveRole'],'parish_admin')
        self.assertFalse(peer['canSuspend'])

    def test_legacy_bishop_assignment_does_not_expand_archdiocese_authority(self):
        with server.connect() as connection:
            connection.execute("INSERT INTO assignments VALUES('bishop','outside-parish')")
        self.assertEqual(self.get_state('bishop','outside-parish')[0],403)

    def test_repeated_migrations_preserve_role_revocation(self):
        self.assertEqual(self.grant('priest','secretary',target='secretary',active=False)[0],200)
        server.init_db()
        self.assertEqual(self.get_state('secretary')[0],403)
        with server.connect() as connection:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM pl_grants WHERE user_id='secretary' AND role='secretary'").fetchone()[0],1)

    def test_finance_is_available_to_admins_without_leaking_to_secretaries(self):
        with server.connect() as connection:
            state=json.loads(connection.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()[0])
        for actor in ['root','arch-admin','parish-admin']:
            status,result=self.get_state(actor)
            self.assertEqual(status,200,result)
            self.assertEqual(result['d']['BATCH'],state['BATCH'])
        status,secretary=self.get_state('secretary')
        self.assertEqual(status,200)
        self.assertEqual(secretary['d']['BATCH']['status'],'unavailable')

    def test_rejected_privilege_changes_are_audited_without_passwords(self):
        status,result=self.grant('parish-admin','super_admin',scope='global',currentPassword=self.password)
        self.assertEqual(status,403,result)
        with server.connect() as connection:
            row=connection.execute("SELECT * FROM pl_history WHERE actor_id='parish-admin' AND action='administration.rejected'").fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row['scope_id'],'*')
            detail=json.loads(row['detail'])
            self.assertEqual(detail['status'],403)
            self.assertTrue(detail['requestId'])
            self.assertNotIn(self.password,row['detail'])

    def test_member_recovery_cannot_take_over_scoped_staff_accounts(self):
        with server.connect() as connection:
            connection.execute("UPDATE users SET person_id='p6' WHERE id='target'")
            connection.execute("INSERT INTO assignments VALUES('target','p-elias')")
        self.assertEqual(self.grant('priest','parish_admin')[0],200)
        status,result=self.call('secretary','POST','/api/parishes/p-elias/member',dict(op='accountReset',personId='p6'))
        self.assertEqual(status,404,result)
        self.assertEqual(self.get_state('target')[0],200)
        self.assertEqual(self.grant('priest','parish_admin',active=False)[0],200)
        with server.connect() as connection:
            connection.execute('INSERT INTO pl_grants VALUES(?,?,?,?,?,1,?,?)',('other-staff','target','parish',self.other_parish,'secretary','root',server.NOW()))
        self.assertEqual(self.call('secretary','POST','/api/parishes/p-elias/member',dict(op='accountReset',personId='p6'))[0],404)
        status,state=self.get_state('secretary')
        self.assertFalse(state['d']['ACCOUNTS']['p6']['canResetPassword'])

    def test_account_password_change_without_parish_retains_only_current_session(self):
        with server.connect() as connection:
            connection.execute("INSERT INTO sessions VALUES('another-session','target','other-csrf',?)",(time.time()+3600,))
        password='A different strong account password 91!'
        status,result=self.call('target','POST','/api/account/password',dict(currentPassword=self.password,newPassword=password,confirmPassword=password))
        self.assertEqual(status,200,result)
        self.assertEqual(self.call('target','GET','/api/session')[0],200)
        with server.connect() as connection:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM sessions WHERE user_id='target'").fetchone()[0],1)
            self.assertTrue(server.password_matches(connection.execute("SELECT password FROM users WHERE id='target'").fetchone()[0],password))

    def test_staff_password_recovery_requires_super_admin_and_revokes_sessions(self):
        password='A recovered staff account password 82!'
        values=dict(userId='parish-admin',currentPassword=self.password,newPassword=password,confirmPassword=password,reason='Identity verified through operator procedure')
        self.assertEqual(self.call('arch-admin','POST','/api/workspace/password-reset',values)[0],403)
        status,result=self.call('root','POST','/api/workspace/password-reset',values)
        self.assertEqual(status,200,result)
        self.assertEqual(self.call('parish-admin','GET','/api/session')[0],401)
        self.assertEqual(self.call(None,'POST','/api/login',dict(username='parish-admin',password=password))[0],200)
        with server.connect() as connection:
            history=connection.execute("SELECT detail FROM pl_history WHERE action='account.password.recovered'").fetchone()[0]
            self.assertNotIn(password,history)
            self.assertEqual(connection.execute("SELECT active FROM pl_grants WHERE user_id='parish-admin' AND role='parish_admin'").fetchone()[0],1)

    def test_staff_cannot_lower_password_policy_through_member_portal(self):
        status,result=self.call('parish-admin','POST','/api/parishes/p-elias/member',dict(op='changePassword',current=self.password,password='shorter-pass'))
        self.assertEqual(status,400,result)
        self.assertIn('16',result['error'])

    def test_bishop_can_perform_office_publishing_without_member_portal_access(self):
        status,result=self.call('bishop','POST','/api/parishes/p-elias/member',dict(op='publish',kind='post',title='Archdiocese update',body='An authorized parish office update.',category=''))
        self.assertEqual(status,200,result)
        self.assertEqual(self.call('bishop','GET','/api/parishes/p-elias/member')[0],403)

    def test_account_lookup_rate_limit_counts_failed_attempts(self):
        with server.connect() as connection:
            for number in range(60):
                connection.execute('INSERT INTO pl_history VALUES(?,?,?,?,?,?)',(f'lookup-{number}','parish-admin','p-elias','administration.rejected','{"operation":"account-lookup"}',server.NOW()))
        status,result=self.call('parish-admin','POST','/api/workspace/account-lookup',dict(parish='p-elias',username='target'))
        self.assertEqual(status,429,result)

    def test_finance_permission_does_not_mix_parish_and_archdiocese_identifiers(self):
        with server.connect() as connection:
            state=json.loads(connection.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()[0])
            state['PARISH']['id']='beirut'
            connection.execute('INSERT INTO parishes VALUES(?,?,?)',('beirut','outside','{"id":"beirut","name":"Identifier collision fixture"}'))
            connection.execute('INSERT INTO states VALUES(?,1,?)',('beirut',json.dumps(state)))
            connection.execute("INSERT INTO pl_grants VALUES('collision','secretary','parish','beirut','finance_view',1,'root',?)",(server.NOW(),))
        status,result=self.get_state('secretary')
        self.assertEqual(status,200,result)
        self.assertEqual(result['d']['BATCH']['status'],'unavailable')

    def test_combined_secretary_and_treasurer_assignments_preserve_finance(self):
        self.assertEqual(self.grant('parish-admin','secretary')[0],200)
        self.assertEqual(self.grant('parish-admin','treasurer')[0],200)
        status,session=self.call('target','GET','/api/session')
        self.assertEqual(status,200,session)
        parish=next(parish for parish in session['parishes'] if parish['id']=='p-elias')
        self.assertEqual(parish['effectiveRole'],'secretary')
        self.assertTrue(parish['canViewFinance'])
        status,state=self.get_state('target')
        self.assertEqual(status,200,state)
        self.assertNotEqual(state['d']['BATCH']['status'],'unavailable')
        rate=state['d']['RATE']
        rate['value']=rate['value']+1
        status,result=self.call('target','PUT','/api/parishes/p-elias/state',dict(revision=state['revision'],changes={'RATE':rate}))
        self.assertEqual(status,200,result)

    def test_member_recovery_uses_strong_credentials_for_approved_members(self):
        with server.connect() as connection:
            connection.execute("INSERT INTO pl_affiliations VALUES('target','p-elias',1,'approved','p6',0,?)",(server.NOW(),))
        status,result=self.call('secretary','POST','/api/parishes/p-elias/member',dict(op='accountReset',personId='p6'))
        self.assertEqual(status,200,result)
        self.assertGreaterEqual(len(result['password']),20)
        self.assertEqual(self.call('target','GET','/api/session')[0],401)
        self.assertEqual(self.call(None,'POST','/api/login',dict(username='target',password=result['password']))[0],200)


if __name__ == '__main__':
    unittest.main()
