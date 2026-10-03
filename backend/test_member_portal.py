"""Member projection, privacy, and concern permissions use an isolated database."""
import json
import copy
import datetime as dt
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
                      ('p-elias', self.users['priest']['id'], json.dumps(['Review','Respond','Resolve','ViewIdentity','ViewSensitive'])))
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
        with server.connect() as c:
            self.assertFalse(any('concern' in row['action'] for row in c.execute('SELECT action FROM audit')))
            self.assertIsNone(c.execute("SELECT actor_id FROM complaint_audit WHERE action='submitted'").fetchone()['actor_id'])

    def test_named_reviewer_conflict_is_excluded(self):
        self.action('choir', 'concern', category='Leadership', subject='Conflict',
                    description='A concern', peopleInvolved='priest', anonymous=False)
        with server.connect() as c:
            c.execute('INSERT INTO complaint_reviewers VALUES(?,?,?)',
                      ('p-elias', self.users['priest']['id'], json.dumps(['Review','Respond','ViewSensitive'])))
            case_id = c.execute('SELECT id FROM member_concerns').fetchone()['id']
        self.assertEqual(self.view('priest')['review'], [])
        with self.assertRaises(server.Problem):
            self.action('priest', 'concernUpdate', id=case_id, status='Under Review')

    def test_assignment_and_categories_need_specific_grants(self):
        self.action('choir', 'concern', category='Other', subject='Suggestion', description='Please review')
        with server.connect() as c:
            case_id = c.execute('SELECT id FROM member_concerns').fetchone()['id']
            c.execute('INSERT INTO complaint_reviewers VALUES(?,?,?)',
                      ('p-elias', self.users['priest']['id'], json.dumps(['Review', 'Assign', 'Respond', 'ManageCategories'])))
            c.execute('INSERT INTO complaint_reviewers VALUES(?,?,?)',
                      ('p-elias', self.users['leader']['id'], json.dumps(['Review', 'Respond'])))
        with self.assertRaises(server.Problem):
            self.action('choir', 'concernAssign', id=case_id, reviewerId=self.users['leader']['id'])
        self.action('priest', 'concernAssign', id=case_id, reviewerId=self.users['leader']['id'])
        self.assertEqual(self.view('priest')['review'][0]['assignedTo'], self.users['leader']['id'])
        self.assertEqual(self.view('leader')['review'][0]['id'], case_id)
        self.action('priest', 'categoryManage', name='Suggestions', active=False)
        with self.assertRaises(server.Problem):
            self.action('choir', 'concern', category='Suggestions', subject='Idea', description='An idea')

    def test_custom_concern_category_is_sensitive_by_default(self):
        with server.connect() as c:
            c.execute('INSERT INTO complaint_reviewers VALUES(?,?,?)',
                      ('p-elias', self.users['priest']['id'], json.dumps(['ManageCategories', 'Review', 'Respond'])))
        self.action('priest', 'categoryManage', name='Safeguarding referral', active=True)
        self.action('choir', 'concern', category='Safeguarding referral', subject='Need to speak',
                    description='Please contact me')
        self.assertEqual(self.view('priest')['review'], [])
        with server.connect() as c:
            case_id = c.execute('SELECT id FROM member_concerns').fetchone()['id']
        with self.assertRaises(server.Problem):
            self.action('priest', 'concernUpdate', id=case_id, status='Under Review')

    def test_group_discussion_does_not_reach_outsiders(self):
        self.action('leader', 'publish', kind='discussion', groupId='g1', title='Practice chat', body='Welcome')
        item = next(x for x in self.view('choir')['content'] if x['kind'] == 'discussion')
        self.action('choir', 'discussionReply', id=item['id'], body='Thank you')
        self.assertEqual(self.view('choir')['content'][-1]['replies'][0]['body'], 'Thank you')
        self.assertFalse(any(x['kind'] == 'discussion' for x in self.view('other')['content']))
        with self.assertRaises(server.Problem):
            self.action('other', 'discussionReply', id=item['id'], body='Outside')

    def test_notifications_follow_scope_preferences_and_owner(self):
        self.action('leader', 'publish', kind='announcement', groupId='g1', title='Choir reminder', body='Practice')
        note = next(n for n in self.view('choir')['notifications'] if n['title'] == 'Choir reminder')
        self.assertFalse(note['read'])
        self.assertFalse(any(n['title'] == 'Choir reminder' for n in self.view('other')['notifications']))
        self.action('other', 'notificationRead', id=note['id'])
        self.assertFalse(next(n for n in self.view('choir')['notifications'] if n['id'] == note['id'])['read'])
        self.action('choir', 'notificationRead', id=note['id'])
        self.assertTrue(next(n for n in self.view('choir')['notifications'] if n['id'] == note['id'])['read'])
        self.action('choir', 'preference', key='announcements', value=False)
        self.action('leader', 'publish', kind='announcement', groupId='g1', title='Muted reminder', body='Practice')
        self.assertFalse(any(n['title'] == 'Muted reminder' for n in self.view('choir')['notifications']))

    def test_meeting_and_attendance_notifications_from_staff_changes(self):
        with server.connect() as c:
            row = c.execute("SELECT revision,data FROM states WHERE parish_id='p-elias'").fetchone()
            state = json.loads(row['data'])
            detail = copy.deepcopy(state['GROUP_DETAIL'])
            template = copy.deepcopy(detail['g1']['meetings'][0])
            template.update(id='notification-meeting', title='New choir meeting', d='2099-01-10', t='18:00',
                            attendance={}, absent=[])
            detail['g1']['meetings'].append(template)
            server.save_patch(c, self.users['priest'], 'p-elias',
                              {'revision': row['revision'], 'changes': {'GROUP_DETAIL': detail}})
        self.assertTrue(any(n['title'] == 'New meeting: New choir meeting' for n in self.view('choir')['notifications']))
        self.assertFalse(any('New choir meeting' in n['title'] for n in self.view('other')['notifications']))
        self.action('choir', 'preference', key='meetings', value=False)
        with server.connect() as c:
            row = c.execute("SELECT revision,data FROM states WHERE parish_id='p-elias'").fetchone()
            detail = copy.deepcopy(json.loads(row['data'])['GROUP_DETAIL'])
            meeting = next(m for m in detail['g1']['meetings'] if m['id'] == 'notification-meeting')
            meeting['t'] = '19:00'
            meeting['attendance']['p6'] = 'present'
            server.save_patch(c, self.users['priest'], 'p-elias',
                              {'revision': row['revision'], 'changes': {'GROUP_DETAIL': detail}})
        titles = [n['title'] for n in self.view('choir')['notifications']]
        self.assertNotIn('Meeting changed: New choir meeting', titles)
        self.assertIn('Attendance recorded: New choir meeting', titles)

    def test_upcoming_reminder_is_created_once_and_respects_preference(self):
        self.action('choir', 'preference', key='meetings', value=False)
        with server.connect() as c:
            row = c.execute("SELECT revision,data FROM states WHERE parish_id='p-elias'").fetchone()
            detail = copy.deepcopy(json.loads(row['data'])['GROUP_DETAIL'])
            meeting = copy.deepcopy(detail['g1']['meetings'][0])
            meeting.update(id='tomorrow-reminder', title='Tomorrow choir rehearsal',
                           d=(dt.date.today() + dt.timedelta(days=1)).isoformat(), t='18:00',
                           attendance={}, absent=[])
            detail['g1']['meetings'].append(meeting)
            server.save_patch(c, self.users['priest'], 'p-elias',
                              {'revision': row['revision'], 'changes': {'GROUP_DETAIL': detail}})
        self.assertFalse(any(n['title'] == 'Upcoming meeting: Tomorrow choir rehearsal'
                             for n in self.view('choir')['notifications']))
        self.action('choir', 'preference', key='meetings', value=True)
        self.view('choir')
        reminders = [n for n in self.view('choir')['notifications']
                     if n['title'] == 'Upcoming meeting: Tomorrow choir rehearsal']
        self.assertEqual(len(reminders), 1)

    def test_ministry_leader_can_reply_without_roster_membership(self):
        with server.connect() as c:
            row = c.execute("SELECT revision,data FROM states WHERE parish_id='p-elias'").fetchone()
            detail = copy.deepcopy(json.loads(row['data'])['GROUP_DETAIL'])
            detail['g1']['roster'] = [r for r in detail['g1']['roster'] if r['p'] != 'p3']
            server.save_patch(c, self.users['priest'], 'p-elias',
                              {'revision': row['revision'], 'changes': {'GROUP_DETAIL': detail}})
        self.action('choir', 'message', groupId='g1', body='Can we practice earlier?')
        self.assertTrue(any(m['groupId'] == 'g1' for m in self.view('leader')['meetings']))
        message = next(x for x in self.view('leader')['content'] if x['kind'] == 'message')
        self.action('leader', 'messageReply', id=message['id'], body='Yes, I will check.')
        self.assertTrue(any(x['body'] == 'Yes, I will check.' for x in self.view('choir')['content']))

    def test_unlinked_parish_office_can_publish_without_member_identity(self):
        office = dict(id='test-office', username='office', name='Parish Office', role='secretary',
                      diocese='beirut', person_id=None)
        with server.connect() as c:
            c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',
                      (office['id'], office['username'], office['name'], office['role'], office['diocese'], None, 'test-hash'))
            c.execute('INSERT INTO assignments VALUES(?,?)', (office['id'], 'p-elias'))
            self.assertEqual(server.member_view(c, office, 'p-elias')['person']['lat'], 'Parish Office')
            server.member_action(c, office, 'p-elias', dict(op='publish', kind='announcement',
                                                          title='Office notice', body='Welcome'))
        self.assertTrue(any(x['title'] == 'Office notice' for x in self.view('choir')['content']))


if __name__ == '__main__':
    unittest.main()
