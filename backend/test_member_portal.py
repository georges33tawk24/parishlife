"""Member projection, privacy, and concern permissions use an isolated database."""
import json
import tempfile
import unittest
from pathlib import Path

import server


class MemberPortalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_db = server.DB
        server.DB = Path(self.temp.name) / 'member.sqlite3'
        server.init_db()
        self.users = {}
        with server.connect() as c:
            for name, role, person in [('choir', 'member', 'p6'), ('other', 'member', 'p5'),
                                       ('leader', 'leader', 'p3'), ('priest', 'priest', 'p17')]:
                user = dict(id='test-' + name, username=name, name=name, role=role,
                            diocese='beirut', person_id=person)
                c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',
                          (user['id'], name, name, role, 'beirut', person, 'test-hash'))
                c.execute('INSERT INTO assignments VALUES(?,?)', (user['id'], 'p-elias'))
                self.users[name] = user

    def tearDown(self):
        server.DB = self.original_db
        self.temp.cleanup()

    def action(self, who, op, **values):
        with server.connect() as c:
            return server.member_action(c, self.users[who], 'p-elias', dict(op=op, **values))

    def view(self, who):
        with server.connect() as c:
            return server.member_view(c, self.users[who], 'p-elias')

    def test_member_has_memberships_without_staff_access(self):
        member = self.view('choir')
        self.assertIn('g1', {g['id'] for g in member['groups']})
        self.assertEqual(member['person']['id'], 'p6')
        self.assertNotIn('GROUP_DETAIL', member)
        with server.connect() as c:
            state = json.loads(c.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()['data'])
            with self.assertRaises(server.Problem):
                server.visible(c, self.users['choir'], 'p-elias', state)
            with self.assertRaises(server.Problem):
                server.save_patch(c, self.users['choir'], 'p-elias',
                                  dict(revision=1, changes={'GROUPS': state['GROUPS']}))

    def test_private_notes_are_owner_only_even_to_priest(self):
        self.action('choir', 'note', title='Private', body='Personal reflection', category='Spiritual', tags=['hope'])
        self.assertEqual(self.view('choir')['notes'][0]['body'], 'Personal reflection')
        self.assertEqual(self.view('other')['notes'], [])
        self.assertEqual(self.view('priest')['notes'], [])
        with server.connect() as c:
            state = json.loads(c.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()['data'])
            self.assertNotIn('Personal reflection', json.dumps(state))

    def test_ministry_content_and_rsvp_are_scoped(self):
        self.action('leader', 'publish', kind='post', groupId='g1', title='Choir update', body='Practice on Friday')
        self.assertIn('Choir update', [x['title'] for x in self.view('choir')['content']])
        self.assertNotIn('Choir update', [x['title'] for x in self.view('other')['content']])
        with self.assertRaises(server.Problem):
            self.action('choir', 'publish', kind='post', groupId='g1', title='Unauthorized', body='No')
        meeting = next(m for m in self.view('choir')['meetings'] if m['groupId'] == 'g1' and m['date'] >= server.TODAY())
        self.action('choir', 'rsvp', meetingId=meeting['id'], status='no', reason='Travel')
        self.assertEqual(next(m for m in self.view('choir')['meetings'] if m['id'] == meeting['id'])['rsvp']['status'], 'no')
        with self.assertRaises(server.Problem):
            self.action('other', 'rsvp', meetingId=meeting['id'], status='yes')

    def test_anonymous_concern_and_explicit_review_grant(self):
        result = self.action('choir', 'concern', category='Safety', groupId='g1', subject='Unsafe step',
                             description='A step needs repair', anonymous=True)
        reference = result['reference']
        self.assertEqual(self.view('choir')['concerns'], [])
        self.assertEqual(self.view('priest')['review'], [])
        with server.connect() as c:
            c.execute('INSERT INTO complaint_reviewers VALUES(?,?,?)',
                      ('p-elias', self.users['priest']['id'], json.dumps(['Review','Respond','Resolve','ViewIdentity'])))
        review = self.view('priest')['review']
        self.assertEqual(len(review), 1)
        self.assertTrue(review[0]['anonymous'])
        self.assertNotIn('identity', review[0])
        self.action('priest', 'concernUpdate', id=review[0]['id'], status='Under Review',
                    publicText='We are checking the step.')
        looked_up = self.action('other', 'concernLookup', reference=reference)['concern']
        self.assertEqual(looked_up['status'], 'Under Review')
        self.assertNotIn('description', looked_up)
        self.action('other', 'concernFollowUp', reference=reference, message='Near the entrance')
        self.assertEqual(len(self.action('choir', 'concernLookup', reference=reference)['concern']['updates']), 2)

    def test_named_reviewer_conflict_is_excluded(self):
        self.action('choir', 'concern', category='Leadership', subject='Conflict',
                    description='A concern', peopleInvolved='priest', anonymous=False)
        with server.connect() as c:
            c.execute('INSERT INTO complaint_reviewers VALUES(?,?,?)',
                      ('p-elias', self.users['priest']['id'], json.dumps(['Review','Respond'])))
            case_id = c.execute('SELECT id FROM member_concerns').fetchone()['id']
        self.assertEqual(self.view('priest')['review'], [])
        with self.assertRaises(server.Problem):
            self.action('priest', 'concernUpdate', id=case_id, status='Under Review')


if __name__ == '__main__':
    unittest.main()
