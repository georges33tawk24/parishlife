"""Sacrament and certificate requests from the member portal, end to end, on an isolated database."""
import json
import tempfile
import unittest
from pathlib import Path

import server


class MemberRequestTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_db = server.DB
        server.DB = Path(self.temp.name) / 'requests.sqlite3'
        server.init_db()
        self.users = {}
        with server.connect() as c:
            # nada shares household h1 with p1 and p3; charbel shares h7 with p19 and p20; carla has no household.
            for name, role, person in [('nada', 'member', 'p2'), ('charbel', 'member', 'p9'), ('carla', 'member', 'p6'),
                                       ('secretary', 'secretary', 'p4'), ('priest', 'priest', 'p17'),
                                       ('leader', 'leader', 'p3'), ('treasurer', 'treasurer', 'p15')]:
                user = dict(id='test-' + name, username=name, name=name.title(), role=role, diocese='beirut', person_id=person)
                c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',
                          (user['id'], name, user['name'], role, 'beirut', person, 'test-hash'))
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

    def state(self):
        with server.connect() as c:
            row = c.execute("SELECT revision,data FROM states WHERE parish_id='p-elias'").fetchone()
            return row['revision'], json.loads(row['data'])

    def office(self, who):
        with server.connect() as c:
            row = c.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()
            return server.visible(c, self.users[who], 'p-elias', json.loads(row['data']))

    def flow(self, who, action, sid=None, **values):
        revision, _ = self.state()
        with server.connect() as c:
            server.workflow(c, self.users[who], 'p-elias', dict(action=action, id=sid, revision=revision, **values))

    def entry(self, sid):
        return next(s for s in self.state()[1]['SACRAMENTS'] if s['id'] == sid)

    def notifications(self, who):
        return [n['kind'] for n in reversed(self.view(who)['notifications'])]

    def request(self, who, request_id):
        return next(r for r in self.view(who)['requests'] if r['id'] == request_id)

    def child_baptism(self, who='nada', **child):
        details = dict(lat='Elie Haddad', ar='إيلي حدّاد', born='2026-08-15', father='Georges Haddad', mother='Nada Haddad')
        details.update(child)
        return self.action(who, 'sacramentRequest', kind='baptism', child=details, date='2099-05-03',
                           notes='Godmother: Maya Haddad', phone='03 112 233')

    def test_household_decides_who_a_member_can_request_for(self):
        options = self.view('nada')['requestOptions']
        self.assertEqual([s['id'] for s in options['subjects']], ['p2', 'p1', 'p3'])
        self.assertTrue(options['subjects'][0]['self'])
        self.assertEqual([s['id'] for s in self.view('carla')['requestOptions']['subjects']], ['p6'])
        charbel = {s['id']: s for s in self.view('charbel')['requestOptions']['subjects']}
        self.assertEqual(charbel['p19']['onRecord'], ['baptism'])
        self.assertEqual(charbel['p20']['inProgress'], ['baptism'])
        self.assertIn('baptism', options['preparation'])
        self.assertEqual(options['phone'], '')

    def test_member_submits_a_child_baptism_and_follows_it(self):
        result = self.child_baptism()
        self.assertRegex(result['reference'], r'^WEB/\d{4}/001$')
        item = self.request('nada', result['id'])
        self.assertEqual((item['status'], item['progress']['stage'], item['canWithdraw']), ('submitted', 'received', True))
        self.assertEqual(item['subject'], dict(id='', lat='Elie Haddad', ar='إيلي حدّاد', new=True))
        self.assertEqual(item['progress']['preferredDate'], '2099-05-03')
        # Nothing reaches the parish record until the office accepts the request.
        self.assertFalse(any(p['lat'] == 'Elie Haddad' for p in self.state()[1]['PEOPLE']))
        self.assertEqual(self.child_baptism(lat='Rami Haddad')['reference'][-3:], '002')

    def test_request_validation(self):
        bad = [dict(kind='blessing', personId='p2'),
               dict(kind='communion', personId='p5'),
               dict(kind='funeral', personId='p2'),
               dict(kind='communion', child=dict(lat='A', ar='ب', born='2020-01-01')),
               dict(kind='baptism', child=dict(lat='', ar='ب', born='2020-01-01')),
               dict(kind='baptism', child=dict(lat='A', ar='ب', born='2999-01-01')),
               dict(kind='communion', personId='p3', date='2001-01-01'),
               dict(kind='communion', personId='p3', date='not a date'),
               dict(kind='marriage', personId='p2'),
               dict(kind='certificate', personId='p2', certificateOf='baptism'),
               dict(kind='certificate', personId='p2', certificateOf='funeral', purpose='Civil file'),
               dict(kind='certificate', personId='p2', certificateOf='baptism', purpose='Civil file', language='french'),
               dict(kind='communion', personId='p3', notes='x' * 501),
               dict(kind='communion', personId=['p3'])]
        for values in bad:
            with self.subTest(values=values), self.assertRaises(server.Problem):
                self.action('nada', 'sacramentRequest', **values)
        self.assertEqual(self.view('nada')['requests'], [])

    def test_register_and_open_requests_prevent_duplicates(self):
        with self.assertRaisesRegex(server.Problem, 'already recorded'):
            self.action('charbel', 'sacramentRequest', kind='baptism', personId='p19')
        with self.assertRaisesRegex(server.Problem, 'already preparing'):
            self.action('charbel', 'sacramentRequest', kind='baptism', personId='p20')
        self.action('charbel', 'sacramentRequest', kind='communion', personId='p20', date='2099-06-01')
        with self.assertRaisesRegex(server.Problem, 'already has this request'):
            self.action('charbel', 'sacramentRequest', kind='communion', personId='p20')
        self.child_baptism()
        with self.assertRaisesRegex(server.Problem, 'already has this request'):
            self.child_baptism(lat='elie haddad ')

    def test_office_sees_online_requests_and_other_roles_do_not(self):
        result = self.child_baptism()
        rows = self.office('secretary')['MEMBER_REQUESTS']
        self.assertEqual([r['id'] for r in rows], [result['id']])
        self.assertEqual(rows[0]['requester'], dict(name='Nada', personId='p2', phone='3 998 104', household='h1'))
        self.assertEqual(rows[0]['details']['child']['ar'], 'إيلي حدّاد')
        self.assertEqual([r['id'] for r in self.office('priest')['MEMBER_REQUESTS']], [result['id']])
        self.assertEqual(self.office('leader')['MEMBER_REQUESTS'], [])
        self.assertEqual(self.office('treasurer')['MEMBER_REQUESTS'], [])
        self.assertEqual(self.view('charbel')['requests'], [])
        with self.assertRaises(server.Problem):
            self.flow('nada', 'decline-member-request', requestId=result['id'], reason='No')

    def test_baptism_moves_from_portal_through_preparation(self):
        result = self.child_baptism()
        self.flow('secretary', 'accept-member-request', 'sc-web-1', requestId=result['id'], household=True, note='Welcome!')
        entry = self.entry('sc-web-1')
        self.assertEqual((entry['status'], entry['memberRequestId'], entry['memberReference']),
                         ('office-reviewed', result['id'], result['reference']))
        self.assertEqual([h['action'] for h in entry['history']], ['sacrament requested', 'office review completed'])
        self.assertEqual((entry['history'][0]['by'], entry['history'][0]['via']), ('Nada', 'portal'))
        self.assertEqual((entry['requestedDate'], entry['requestNotes'], entry['contactPhone'], entry['father']),
                         ('2099-05-03', 'Godmother: Maya Haddad', '03 112 233', 'Georges Haddad'))
        _, state = self.state()
        child = next(p for p in state['PEOPLE'] if p['id'] == entry['person'])
        self.assertEqual((child['lat'], child['hh'], child['rel']), ('Elie Haddad', 'h1', 'child'))
        self.assertIn(child['id'], next(h for h in state['HOUSEHOLDS'] if h['id'] == 'h1')['members'])
        item = self.request('nada', result['id'])
        self.assertEqual((item['status'], item['response'], item['progress']['stage'], item['canWithdraw']),
                         ('accepted', 'Welcome!', 'review', False))
        self.assertEqual(self.notifications('nada'), ['request-review'])
        with self.assertRaisesRegex(server.Problem, 'already handled'):
            self.flow('secretary', 'accept-member-request', 'sc-web-2', requestId=result['id'])

        self.flow('priest', 'approve-sacrament-request', 'sc-web-1')
        progress = self.request('nada', result['id'])['progress']
        self.assertEqual(progress['stage'], 'preparing')
        self.assertEqual([(p['required'], p['done']) for p in progress['preparation']], [(True, False), (False, False), (True, False)])
        self.flow('secretary', 'update-preparation', 'sc-web-1', date='2099-05-10', checklist=[True, False, True])
        self.flow('secretary', 'complete-preparation', 'sc-web-1')
        progress = self.request('nada', result['id'])['progress']
        self.assertEqual((progress['stage'], progress['plannedDate'], progress['preferredDate']), ('scheduled', '2099-05-10', '2099-05-03'))
        self.assertEqual([e['key'] for e in progress['events']], ['submitted', 'accepted', 'priest-accepted', 'prepared'])
        self.assertEqual(self.notifications('nada'), ['request-review', 'request-accepted', 'request-date', 'request-scheduled'])
        notice = self.view('nada')['notifications'][0]
        self.assertEqual((notice['title'], notice['body'], notice['route']),
                         ('Baptism preparation complete', '2099-05-10', 'myrequests/' + result['id']))

    def test_priest_accepts_directly_and_can_link_an_existing_person(self):
        result = self.child_baptism(lat='Yara Matar', born='2016-05-04')
        with self.assertRaisesRegex(server.Problem, 'already exists'):
            self.flow('priest', 'accept-member-request', 'sc-web-1', requestId=result['id'])
        with self.assertRaisesRegex(server.Problem, 'already recorded'):
            self.flow('priest', 'accept-member-request', 'sc-web-1', requestId=result['id'], personId='p19')
        other = self.child_baptism(lat='Joseph Haddad', born='2026-01-02')
        self.flow('priest', 'accept-member-request', 'sc-web-2', requestId=other['id'])
        entry = self.entry('sc-web-2')
        self.assertEqual((entry['status'], entry['requestApprovedBy']), ('preparing', 'Priest'))
        child = next(p for p in self.state()[1]['PEOPLE'] if p['id'] == entry['person'])
        self.assertIsNone(child['hh'])
        self.assertEqual(self.request('nada', other['id'])['progress']['stage'], 'preparing')
        self.assertEqual(self.notifications('nada'), ['request-accepted'])

    def test_office_declines_with_a_message(self):
        result = self.action('carla', 'sacramentRequest', kind='marriage', personId='p6', partner='Marc Aoun',
                             partnerParish='Saint Maron, Jounieh', date='2099-09-12')
        with self.assertRaises(server.Problem):
            self.flow('secretary', 'decline-member-request', requestId=result['id'], reason='  ')
        self.flow('secretary', 'decline-member-request', requestId=result['id'], reason='Please visit the office first.')
        item = self.request('carla', result['id'])
        self.assertEqual((item['status'], item['progress']['stage'], item['progress']['reason']),
                         ('declined', 'declined', 'Please visit the office first.'))
        self.assertEqual(item['details']['partner'], 'Marc Aoun')
        self.assertEqual(self.notifications('carla'), ['request-declined'])
        self.assertFalse(any(s.get('memberRequestId') for s in self.state()[1]['SACRAMENTS']))

    def test_withdraw_only_your_own_waiting_request(self):
        mine = self.action('charbel', 'sacramentRequest', kind='communion', personId='p20')
        with self.assertRaisesRegex(server.Problem, 'not found'):
            self.action('nada', 'requestWithdraw', id=mine['id'])
        self.action('charbel', 'requestWithdraw', id=mine['id'])
        self.assertEqual(self.request('charbel', mine['id'])['progress']['stage'], 'withdrawn')
        with self.assertRaisesRegex(server.Problem, 'already handled'):
            self.action('charbel', 'requestWithdraw', id=mine['id'])
        # A withdrawn request no longer blocks asking again.
        again = self.action('charbel', 'sacramentRequest', kind='communion', personId='p20')
        with self.assertRaisesRegex(server.Problem, 'already handled'):
            self.flow('secretary', 'accept-member-request', 'sc-web-1', requestId=mine['id'])
        self.assertNotEqual(again['reference'], mine['reference'])

    def test_certificate_request_reaches_the_member_when_issued(self):
        result = self.action('charbel', 'sacramentRequest', kind='certificate', personId='p19', certificateOf='baptism',
                             purpose='School registration', language='arabic')
        with self.assertRaisesRegex(server.Problem, 'official entry'):
            self.flow('secretary', 'accept-member-request', 'sc-web-1', requestId=result['id'], sourceRecordId='sc4')
        self.flow('secretary', 'accept-member-request', 'sc-web-1', requestId=result['id'], sourceRecordId='sc2')
        entry = self.entry('sc-web-1')
        self.assertEqual((entry['kind'], entry['status'], entry['sourceRecordId'], entry['purpose'], entry['language']),
                         ('certificate', 'awaiting-signature', 'sc2', 'School registration', 'arabic'))
        self.assertEqual(self.request('charbel', result['id'])['progress']['stage'], 'review')
        self.flow('priest', 'approve', 'sc-web-1', verified=True)
        self.assertEqual(self.request('charbel', result['id'])['progress']['stage'], 'signing')
        self.flow('priest', 'issue', 'sc-web-1', verified=True)
        item = self.request('charbel', result['id'])
        self.assertEqual(item['progress']['stage'], 'ready')
        self.assertEqual(self.notifications('charbel'), ['request-accepted', 'request-ready'])

    def test_waiting_certificate_and_cancellation_reason(self):
        result = self.action('nada', 'sacramentRequest', kind='certificate', personId='p3', certificateOf='confirmation',
                             purpose='Marriage file')
        self.flow('secretary', 'accept-member-request', 'sc-web-1', requestId=result['id'])
        self.assertEqual(self.entry('sc-web-1')['status'], 'draft')
        self.flow('secretary', 'cancel', 'sc-web-1', reason='No confirmation is recorded here; please ask your parish of confirmation.')
        item = self.request('nada', result['id'])
        self.assertEqual((item['progress']['stage'], item['progress']['reason']),
                         ('cancelled', 'No confirmation is recorded here; please ask your parish of confirmation.'))
        self.assertEqual(self.notifications('nada'), ['request-accepted', 'request-cancelled'])

    def test_portal_links_cannot_be_forged_through_a_save(self):
        result = self.action('charbel', 'sacramentRequest', kind='communion', personId='p20')
        revision, state = self.state()
        forged = dict(id='sc-forged', kind='certificate', reg='REQ/2026/099', person='p19', date='2026-10-01',
                      status='awaiting-signature', sourceRecordId='sc2', memberRequestId=result['id'])
        with server.connect() as c, self.assertRaisesRegex(server.Problem, 'server-managed'):
            server.save_patch(c, self.users['secretary'], 'p-elias',
                              dict(revision=revision, changes={'SACRAMENTS': [forged] + state['SACRAMENTS']}))
        with server.connect() as c, self.assertRaises(server.Problem):
            server.save_patch(c, self.users['secretary'], 'p-elias', dict(revision=revision, changes={'MEMBER_REQUESTS': []}))

    def test_waiting_requests_are_limited(self):
        for index in range(10):
            self.child_baptism(lat=f'Child {index}')
        with self.assertRaisesRegex(server.Problem, '10 requests'):
            self.child_baptism(lat='Child 10')


if __name__ == '__main__':
    unittest.main()
