"""Booking a parish hall or room, and general requests, from the member portal."""
import json
import tempfile
import unittest
from pathlib import Path

import server


class MemberBookingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_db, self.original_today = server.DB, server.TODAY
        server.DB = Path(self.temp.name) / 'bookings.sqlite3'
        server.TODAY = lambda: '2026-10-01'  # the sample reservations fall in October 2026
        server.init_db()
        self.users = {}
        with server.connect() as c:
            for name, role, person in [('nada', 'member', 'p2'), ('carla', 'member', 'p6'), ('secretary', 'secretary', 'p4'),
                                       ('priest', 'priest', 'p17')]:
                user = dict(id='test-' + name, username=name, name=name.title(), role=role, diocese='beirut', person_id=person)
                c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)', (user['id'], name, user['name'], role, 'beirut', person, 'test-hash'))
                c.execute('INSERT INTO assignments VALUES(?,?)', (user['id'], 'p-elias'))
                self.users[name] = user

    def tearDown(self):
        server.DB, server.TODAY = self.original_db, self.original_today
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

    def flow(self, who, action, sid=None, **values):
        revision, _ = self.state()
        with server.connect() as c:
            server.workflow(c, self.users[who], 'p-elias', dict(action=action, id=sid, revision=revision, **values))

    def save(self, who, **changes):
        revision, _ = self.state()
        with server.connect() as c:
            return server.save_patch(c, self.users[who], 'p-elias', dict(revision=revision, changes=changes))

    def request(self, who, request_id):
        return next(r for r in self.view(who)['requests'] if r['id'] == request_id)

    def notifications(self, who):
        return [(n['kind'], n['title']) for n in reversed(self.view(who)['notifications'])]

    def booking(self, who='nada', **values):
        body = dict(kind='booking', venue='v3', date='2026-11-14', **{'from': '18:00', 'to': '22:00'},
                    occasion='Baptism reception', guests=80, notes='We will bring our own food.', phone='03 998 104')
        body.update(values)
        return self.action(who, 'sacramentRequest', **body)

    def reservation(self, rid):
        return next((r for r in self.state()[1]['RESERVATIONS'] if r['id'] == rid), None)

    def test_members_see_the_places_they_can_book_and_when_they_are_taken(self):
        options = self.view('nada')['requestOptions']
        self.assertEqual([v['id'] for v in options['venues']], ['v3', 'v4', 'v5', 'v7', 'v8'])
        self.assertEqual(options['venues'][0], dict(id='v3', name='Parish Hall', ar='قاعة الرعية', cap=180, kind='Hall', kindAr='قاعة'))
        # the parish lunch runs 12:00-16:00 after 90 minutes of setting up, so the hall is taken from 10:30
        self.assertIn(dict(venue='v3', date='2026-10-18', **{'from': '10:30', 'to': '16:00'}, status='approved'), options['busy'])
        self.assertTrue(all(b['status'] in {'pending', 'approved'} and b['date'] >= '2026-10-01' for b in options['busy']))
        self.assertEqual(options['busy'], sorted(options['busy'], key=lambda b: (b['date'], b['from'], b['venue'])))

    def test_a_booking_request_is_checked_before_it_is_sent(self):
        cases = [
            (dict(venue='v1'), 'Choose the place you would like to book.'),
            (dict(venue='v6'), 'Choose the place you would like to book.'),
            (dict(date='2026-09-30'), 'Choose a date from today onwards.'),
            (dict(date='2029-01-01'), 'Choose a date from today onwards.'),
            (dict(date='2026-11-31'), 'Choose a date from today onwards.'),
            (dict(to='17:00'), 'Choose a start time before the end time.'),
            (dict(**{'from': '25:00'}), 'Choose a start time before the end time.'),
            (dict(occasion=' '), 'Tell the parish what the booking is for.'),
            (dict(guests=0), 'Enter how many people are expected.'),
            (dict(guests='80'), 'Enter how many people are expected.'),
            (dict(guests=True), 'Enter how many people are expected.'),
            (dict(guests=181), 'This place holds up to 180 people.'),
            (dict(date='2026-10-18', **{'from': '15:00', 'to': '17:00'}), 'This place is already booked at that time. Choose another time or place.'),
            # the approved lunch keeps 90 minutes before it for setting up
            (dict(date='2026-10-18', **{'from': '10:00', 'to': '10:31'}), 'This place is already booked at that time. Choose another time or place.'),
        ]
        for values, message in cases:
            with self.subTest(values=values):
                with self.assertRaises(server.Problem) as raised:
                    self.booking(**values)
                self.assertEqual(raised.exception.message, message)
        self.booking(date='2026-10-18', **{'from': '08:00', 'to': '10:30'})  # ends exactly when the set-up begins
        sent = self.booking()
        self.assertTrue(sent['reference'].startswith('WEB/2026/'))
        with self.assertRaises(server.Problem) as twice:
            self.booking()
        self.assertEqual(twice.exception.message, 'The parish office already has this request and will reply soon.')
        self.booking(who='carla')  # someone else may ask for the same time; the office decides
        mine = self.request('nada', sent['id'])
        self.assertEqual((mine['kind'], mine['subject']['id'], mine['progress']['stage']), ('booking', 'p2', 'received'))
        self.assertEqual(mine['details'], dict(personId='p2', venue='v3', date='2026-11-14', occasion='Baptism reception', guests=80,
                                               **{'from': '18:00', 'to': '22:00'}, notes='We will bring our own food.', phone='03 998 104'))

    def test_a_booking_becomes_a_reservation_and_the_priest_decides_it(self):
        sent = self.booking()
        self.flow('secretary', 'accept-member-request', 'rmember1', requestId=sent['id'], note='The hall is free that evening.')
        r = self.reservation('rmember1')
        self.assertEqual((r['status'], r['stage'], r['venue'], r['by'], r['date'], r['from'], r['to'], r['guests']),
                         ('pending', 'priest', 'v3', 'p2', '2026-11-14', '18:00', '22:00', 80))
        self.assertEqual((r['title'], r['memberReference'], r['contactPhone'], r['setup']), ('Baptism reception', sent['reference'], '03 998 104', 0))
        self.assertTrue(r['ref'].startswith('RES-2026-'))
        self.assertEqual([h['action'] for h in r['history']], ['request submitted', 'office review completed'])
        mine = self.request('nada', sent['id'])
        self.assertEqual((mine['status'], mine['progress']['stage'], mine['response']), ('accepted', 'review', 'The hall is free that evening.'))
        self.assertEqual(self.notifications('nada')[-1], ('request-review', 'Booking request sent to the priest'))
        with self.assertRaises(server.Problem):
            self.flow('secretary', 'accept-member-request', 'rmember2', requestId=sent['id'])  # already handled

        _, state = self.state()
        approved = [dict(x, status='approved', stage='done') if x['id'] == 'rmember1' else x for x in state['RESERVATIONS']]
        self.save('priest', RESERVATIONS=approved)
        r = self.reservation('rmember1')
        self.assertEqual([h['action'] for h in r['history']], ['request submitted', 'office review completed', 'approve'])
        mine = self.request('nada', sent['id'])
        self.assertEqual(mine['progress']['stage'], 'confirmed')
        self.assertEqual([e['key'] for e in mine['progress']['events']], ['submitted', 'accepted', 'confirmed'])
        self.assertEqual(self.notifications('nada')[-1], ('request-confirmed', 'Booking confirmed'))
        # Saving again without a change says nothing more.
        _, state = self.state()
        self.save('priest', RESERVATIONS=state['RESERVATIONS'])
        self.assertEqual(len(self.notifications('nada')), 2)

    def test_a_priest_confirms_a_booking_directly_and_a_refusal_is_explained(self):
        first = self.booking()
        second = self.booking(who='carla', **{'from': '19:00', 'to': '21:00'})  # sent while the hall was still free
        self.flow('priest', 'accept-member-request', 'rmember3', requestId=first['id'])
        r = self.reservation('rmember3')
        self.assertEqual((r['status'], r['stage']), ('approved', 'done'))
        self.assertEqual(self.request('nada', first['id'])['progress']['stage'], 'confirmed')
        self.assertEqual(self.notifications('nada')[-1], ('request-confirmed', 'Booking confirmed'))
        # The same time can no longer be confirmed for someone else, nor asked for again.
        with self.assertRaises(server.Problem) as taken:
            self.booking(who='carla', **{'from': '20:00', 'to': '21:00'})
        self.assertIn('already booked', taken.exception.message)
        with self.assertRaises(server.Problem) as clash:
            self.flow('priest', 'accept-member-request', 'rmember4', requestId=second['id'])
        self.assertIn('already booked', clash.exception.message)
        # A refused booking reaches the parishioner, and a removed one shows as cancelled.
        later = self.booking(who='carla', date='2026-12-05')
        self.flow('secretary', 'accept-member-request', 'rmember5', requestId=later['id'])
        _, state = self.state()
        self.save('priest', RESERVATIONS=[dict(x, status='rejected', stage='done', reason=' The hall is being painted that week. ') if x['id'] == 'rmember5' else x
                                          for x in state['RESERVATIONS']])
        refused = self.request('carla', later['id'])
        self.assertEqual((refused['progress']['stage'], refused['progress']['reason']), ('declined', 'The hall is being painted that week.'))
        self.assertEqual({k: v for k, v in self.reservation('rmember5')['history'][-1].items() if k != 'at'},
                         dict(action='reject', by='Priest', reason='The hall is being painted that week.'))
        self.assertEqual(self.notifications('carla')[-1], ('request-declined', 'Booking request not accepted'))
        _, state = self.state()
        self.save('priest', RESERVATIONS=[x for x in state['RESERVATIONS'] if x['id'] != 'rmember3'])
        self.assertEqual(self.request('nada', first['id'])['progress']['stage'], 'cancelled')
        self.assertEqual(self.notifications('nada')[-1], ('request-cancelled', 'Booking cancelled'))

    def test_a_general_request_is_accepted_then_marked_done(self):
        sent = self.action('nada', 'sacramentRequest', kind='custom', subject='House blessing', message='Please bless our new flat in Hadath.',
                           date='2026-10-20', phone='03 998 104', notes='')
        for values, message in [(dict(subject=' '), 'Say in a few words what you are asking for.'),
                                (dict(message='x'), 'Describe your request.'),
                                (dict(message='x' * 1001), 'Describe your request.'),
                                (dict(date='2026-09-01'), 'Choose a date from today onwards.')]:
            with self.subTest(values=values):
                body = dict(kind='custom', subject='Mass intention', message='For my late husband.', date='')
                body.update(values)
                with self.assertRaises(server.Problem) as raised:
                    self.action('nada', 'sacramentRequest', **body)
                self.assertEqual(raised.exception.message, message)
        with self.assertRaises(server.Problem):
            self.action('nada', 'sacramentRequest', kind='custom', subject='house BLESSING', message='Again.')
        self.action('carla', 'sacramentRequest', kind='custom', subject='House blessing', message='Our home too, please.')
        mine = self.request('nada', sent['id'])
        self.assertEqual(mine['details'], dict(personId='p2', subject='House blessing', message='Please bless our new flat in Hadath.',
                                               date='2026-10-20', notes='', phone='03 998 104'))
        self.flow('secretary', 'accept-member-request', requestId=sent['id'], note='Fr Antoine will call you to set a time.')
        mine = self.request('nada', sent['id'])
        self.assertEqual((mine['status'], mine['progress']['stage'], mine['canWithdraw']), ('accepted', 'inprogress', False))
        self.flow('priest', 'complete-member-request', requestId=sent['id'], note='Blessed on 20 October.')
        mine = self.request('nada', sent['id'])
        self.assertEqual((mine['status'], mine['progress']['stage'], mine['response']), ('completed', 'completed', 'Blessed on 20 October.'))
        self.assertEqual([e['key'] for e in mine['progress']['events']], ['submitted', 'accepted', 'completed'])
        self.assertEqual(self.notifications('nada'), [('request-accepted', 'Request accepted'), ('request-completed', 'Request completed')])
        with self.assertRaises(server.Problem):
            self.flow('priest', 'complete-member-request', requestId=sent['id'])
        # Only general requests are marked done this way.
        booking = self.booking()
        with self.assertRaises(server.Problem) as wrong:
            self.flow('priest', 'complete-member-request', requestId=booking['id'])
        self.assertEqual(wrong.exception.message, 'Only a general request is marked as done this way.')

    def test_every_step_is_logged(self):
        withdrawn = self.booking()
        self.action('nada', 'requestWithdraw', id=withdrawn['id'])
        declined = self.action('nada', 'sacramentRequest', kind='custom', subject='Visit', message='Please visit my mother.')
        self.flow('secretary', 'decline-member-request', requestId=declined['id'], reason='Please call the office to arrange it.')
        keys = {r['id']: [e['key'] for e in r['progress']['events']] for r in self.view('nada')['requests']}
        self.assertEqual(keys[withdrawn['id']], ['submitted', 'withdrawn'])
        self.assertEqual(keys[declined['id']], ['submitted', 'declined'])
        with server.connect() as c:
            office = {r['id']: r for r in server.visible(c, self.users['secretary'], 'p-elias', self.state()[1])['MEMBER_REQUESTS']}
        self.assertEqual([e['key'] for e in office[declined['id']]['log']], ['declined'])


if __name__ == '__main__':
    unittest.main()
