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
        self.assertEqual(self.record('sc1')['status'], 'scheduled')
        self.assertEqual(self.record('sc1')['place'], 'Saint Elias')
        self.act('secretary', 'submit', 'sc1')
        with self.assertRaises(server.Problem):
            self.act('secretary', 'update-entry', 'sc1', fields={'place': 'Elsewhere'})

    def test_priest_can_accept_family_request_without_secretary_review(self):
        self.act('secretary', 'create-sacrament-request', 'sc-family',
                 kind='baptism', person='p20', date='2026-10-12', notes='Requested by family')
        self.assertEqual(self.record('sc-family')['status'], 'requested')
        with self.assertRaises(server.Problem):
            self.act('secretary', 'complete-preparation', 'sc-family')
        with self.assertRaises(server.Problem):
            self.act('secretary', 'approve-sacrament-request', 'sc-family')
        self.act('priest', 'approve-sacrament-request', 'sc-family')
        self.assertEqual(self.record('sc-family')['status'], 'preparing')
        requirements = self.state()[1]['PREP_REQUIREMENTS']['baptism']
        with self.assertRaises(server.Problem):
            self.act('secretary', 'complete-preparation', 'sc-family')
        self.act('secretary', 'update-preparation', 'sc-family', date='2026-10-12',
                 checklist=[bool(item[2]) for item in requirements])
        self.act('secretary', 'complete-preparation', 'sc-family')
        self.assertEqual(self.record('sc-family')['status'], 'scheduled')
        server.TODAY = lambda: '2026-10-12'
        self.act('secretary', 'submit', 'sc-family')
        self.act('priest', 'approve', 'sc-family', verified=True)
        record = self.record('sc-family')
        self.assertEqual(record['status'], 'registered')
        self.assertEqual(record['requestReference'], 'SRQ/2026/001')
        self.assertTrue(record['reg'].startswith('B/2026/'))

    def test_secretary_review_and_priest_decline_leave_history(self):
        self.act('secretary', 'create-sacrament-request', 'sc-decline',
                 kind='communion', person='p19')
        self.act('secretary', 'review-sacrament-request', 'sc-decline')
        self.assertEqual(self.record('sc-decline')['status'], 'office-reviewed')
        self.act('priest', 'decline-sacrament-request', 'sc-decline', reason='Needs discussion')
        record = self.record('sc-decline')
        self.assertEqual(record['status'], 'rejected')
        self.assertEqual(record['history'][-1]['reason'], 'Needs discussion')
        with self.assertRaises(server.Problem):
            self.act('priest', 'approve-sacrament-request', 'sc-decline')

    def test_editing_a_completed_checklist_reopens_preparation(self):
        self.act('secretary', 'create-sacrament-request', 'sc-reopened',
                 kind='baptism', person='p20')
        self.act('priest', 'approve-sacrament-request', 'sc-reopened')
        requirements = self.state()[1]['PREP_REQUIREMENTS']['baptism']
        checklist = [bool(item[2]) for item in requirements]
        self.act('secretary', 'update-preparation', 'sc-reopened', date='2026-10-12', checklist=checklist)
        self.act('secretary', 'complete-preparation', 'sc-reopened')
        required_index = next(index for index, item in enumerate(requirements) if item[2])
        checklist[required_index] = False
        self.act('secretary', 'update-preparation', 'sc-reopened', date='2026-10-12', checklist=checklist)
        self.assertEqual(self.record('sc-reopened')['status'], 'preparing')
        server.TODAY = lambda: '2026-10-12'
        with self.assertRaises(server.Problem):
            self.act('secretary', 'submit', 'sc-reopened')


if __name__ == '__main__':
    unittest.main()
