"""Operator provisioning tests: subprocesses are confined to a temporary DB."""
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

import server

ROOT=Path(__file__).resolve().parents[1]
PASSWORD='Temporary provisioning test password 74!'


class AdministrationProvisioningTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory(prefix='parishlife-provisioning-')
        self.previous_database=server.DB
        server.DB=Path(self.directory.name)/'provisioning.sqlite3'
        server.init_db()

    def tearDown(self):
        server.DB=self.previous_database
        self.directory.cleanup()

    def provision_python(self,username,password=PASSWORD):
        # Explicitly set the database in the child before main() can initialize
        # it. This also works when this suite is run through the Worker adapter.
        script="""import getpass,sys
from pathlib import Path
import server
server.DB=Path(sys.argv[1])
username=sys.argv[2]
password=sys.stdin.read()
getpass.getpass=lambda prompt:password
sys.argv=['server.py','--bootstrap-super-admin',username]
server.main()
"""
        return subprocess.run([sys.executable,'-c',script,str(server.DB),username],input=password,
                              text=True,capture_output=True,cwd=ROOT,timeout=30)

    def test_python_bootstrap_is_explicit_secure_and_does_not_replace_accounts(self):
        result=self.provision_python('operator-test')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertNotIn(PASSWORD,result.stdout+result.stderr)
        with server.connect() as connection:
            account=connection.execute("SELECT * FROM users WHERE username='operator-test'").fetchone()
            self.assertEqual(account['role'],'member')
            self.assertTrue(server.password_matches(account['password'],PASSWORD))
            self.assertEqual(connection.execute('SELECT COUNT(*) FROM pl_active_super_admins').fetchone()[0],1)
            old_hash=account['password']
        duplicate=self.provision_python('operator-test','Another sufficiently strong password 98!')
        self.assertNotEqual(duplicate.returncode,0)
        with server.connect() as connection:
            self.assertEqual(connection.execute("SELECT password FROM users WHERE username='operator-test'").fetchone()[0],old_hash)
            self.assertEqual(connection.execute('SELECT COUNT(*) FROM pl_active_super_admins').fetchone()[0],1)

    def test_python_bootstrap_rejects_short_passwords_and_invalid_usernames(self):
        self.assertNotEqual(self.provision_python('operator-short','short').returncode,0)
        self.assertNotEqual(self.provision_python('invalid username').returncode,0)
        with server.connect() as connection:
            self.assertEqual(connection.execute('SELECT COUNT(*) FROM users').fetchone()[0],0)

    def test_cloudflare_provisioning_file_has_no_plaintext_password_and_is_applicable(self):
        target=Path(self.directory.name)/'private-bootstrap.sql'
        command=[os.environ.get('PARISHLIFE_TEST_NODE','node'),str(ROOT/'cloudflare/tools/bootstrap-super-admin.mjs'),
                 'operator-cloudflare',str(target),'Developer operator','--password-stdin']
        result=subprocess.run(command,input=PASSWORD+'\n',capture_output=True,text=True,cwd=ROOT,timeout=30)
        self.assertEqual(result.returncode,0,result.stderr)
        sql=target.read_text(encoding='utf-8')
        self.assertNotIn(PASSWORD,sql+result.stdout+result.stderr)
        with server.connect() as connection:
            connection.executescript(sql)
            account=connection.execute("SELECT * FROM users WHERE username='operator-cloudflare'").fetchone()
            self.assertTrue(server.password_matches(account['password'],PASSWORD))
            self.assertEqual(connection.execute('SELECT COUNT(*) FROM pl_active_super_admins').fetchone()[0],1)
            event=connection.execute("SELECT detail FROM pl_history WHERE action='super-admin.operator.provisioned'").fetchone()
            self.assertEqual(json.loads(event['detail'])['user'],account['id'])
        duplicate=subprocess.run(command,input=PASSWORD+'\n',capture_output=True,text=True,cwd=ROOT,timeout=30)
        self.assertNotEqual(duplicate.returncode,0)
        self.assertEqual(target.read_text(encoding='utf-8'),sql)
        with server.connect() as connection:
            with self.assertRaises(sqlite3.IntegrityError):
                connection.executescript(sql)
            self.assertEqual(connection.execute('SELECT COUNT(*) FROM pl_active_super_admins').fetchone()[0],1)


if __name__=='__main__':
    unittest.main()
