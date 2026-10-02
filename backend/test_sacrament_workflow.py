"""State-transition and role checks for sacramental and certificate requests."""
import json
import tempfile
import unittest
from pathlib import Path

import server


class SacramentWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_db, self.old_today = server.DB, server.TODAY
        server.DB = Path(self.temp.name) / 'workflow.sqlite3'
        server.TODAY = lambda: '2026-09-28'
        server.init_db()
        self.users = {}
        with server.connect() as c:
            for role, person_id in [('priest', 'p17'), ('secretary', 'p4')]:
                uid = 'workflow-' + role
                user = dict(id=uid, username=uid, name='Test ' + role,
                            role=role, diocese='beirut', person_id=person_id)
                c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',
                          (uid, uid, user['name'], role, 'beirut', person_id, 'test-hash'))
                c.execute('INSERT INTO assignments VALUES(?,?)', (uid, 'p-elias'))
                self.users[role] = user

    def tearDown(self):
        server.DB, server.TODAY = self.old_db, self.old_today
        self.temp.cleanup()

    def state(self):
        with server.connect() as c:
            row = c.execute("SELECT revision,data FROM states WHERE parish_id='p-elias'").fetchone()
            return row['revision'], json.loads(row['data'])

    def record(self, record_id):
        return next(s for s in self.state()[1]['SACRAMENTS'] if s['id'] == record_id)

    def act(self, role, action, record_id, **extra):
        revision, _ = self.state()
        with server.connect() as c:
            server.workflow(c, self.users[role], 'p-elias',
                            dict(action=action, id=record_id, revision=revision, **extra))

    def test_future_sacrament_cannot_be_submitted_or_approved(self):
        self.assertEqual(self.record('sc1')['status'], 'scheduled')
        with self.assertRaises(server.Problem) as raised:
            self.act('secretary', 'submit', 'sc1')
        self.assertIn('celebration date', raised.exception.message)
        self.assertEqual(self.record('sc1')['status'], 'scheduled')

    def test_future_request_waits_then_links_after_register_approval(self):
        self.act('secretary', 'create-certificate-request', 'sc-test-request',
                 requestId='sc-test-request', person='p20', purpose='School file',
                 requestedSacramentId='sc1')
        request = self.record('sc-test-request')
        self.assertEqual(request['status'], 'draft')
        self.assertIsNone(request['sourceRecordId'])
        with self.assertRaises(server.Problem):
            self.act('secretary', 'submit', 'sc-test-request')

        server.TODAY = lambda: '2026-10-12'
        self.act('secretary', 'submit', 'sc1')
        self.assertEqual(self.record('sc1')['status'], 'awaiting-signature')
        with self.assertRaises(server.Problem) as raised:
            self.act('secretary', 'approve', 'sc1', verified=True)
        self.assertEqual(raised.exception.status, 403)
        self.act('priest', 'approve', 'sc1', verified=True)
        self.assertEqual(self.record('sc1')['status'], 'registered')
        self.assertEqual(self.record('sc-test-request')['sourceRecordId'], 'sc1')
        self.act('secretary', 'submit', 'sc-test-request')
        self.act('priest', 'approve', 'sc-test-request', verified=True)
        self.act('priest', 'issue', 'sc-test-request', verified=True)
        issued = self.record('sc-test-request')
        self.assertEqual(issued['status'], 'issued')
        self.assertEqual(issued['sourceRecordId'], 'sc1')
        self.assertTrue(issued['issuedAt'])

    def test_unlinked_request_can_be_cancelled_with_reason(self):
        self.act('secretary', 'create-certificate-request', 'sc-test-cancel',
                 requestId='sc-test-cancel', person='p20', purpose='Family records')
        with self.assertRaises(server.Problem):
            self.act('secretary', 'cancel', 'sc-test-cancel')
        self.act('secretary', 'cancel', 'sc-test-cancel', reason='Requested in error')
        cancelled = self.record('sc-test-cancel')
        self.assertEqual(cancelled['status'], 'cancelled')
        self.assertEqual(cancelled['history'][-1]['reason'], 'Requested in error')
        with self.assertRaises(server.Problem):
            self.act('secretary', 'submit', 'sc-test-cancel')

    def test_official_entry_request_goes_directly_to_clergy_review(self):
        self.act('secretary', 'create-certificate-request', 'sc-test-official',
                 requestId='sc-test-official', person='p19', purpose='Civil file',
                 sourceRecordId='sc2')
        request = self.record('sc-test-official')
        self.assertEqual(request['sourceRecordId'], 'sc2')
        self.assertEqual(request['status'], 'awaiting-signature')
        self.assertEqual(request['history'][-1]['action'], 'submitted for clergy review')
        self.act('priest', 'approve', 'sc-test-official', verified=True)
        self.assertEqual(self.record('sc-test-official')['status'], 'approved')

    def test_planned_details_are_editable_until_submission(self):
        self.act('secretary', 'update-entry', 'sc1', fields={
            'date': '2026-09-27', 'celebrant': 'p17', 'place': 'Saint Elias'})
        self.assertEqual(self.record('sc1')['status'], 'draft')
        self.assertEqual(self.record('sc1')['place'], 'Saint Elias')
        self.act('secretary', 'submit', 'sc1')
        with self.assertRaises(server.Problem):
            self.act('secretary', 'update-entry', 'sc1', fields={'place': 'Elsewhere'})


if __name__ == '__main__':
    unittest.main()
