"""Parishioners open their own account with a phone number or an email address, sign in with
either in any common format, change their password, and the parish office can reset it."""
import http.client
import http.server
import json
from pathlib import Path
import tempfile
import threading
import unittest

import server


class QuietHandler(server.Handler):
    def log_message(self, *args):
        pass


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_db = server.DB
        server.DB = Path(self.temp.name) / 'accounts.sqlite3'
        server.init_db()
        with server.connect() as c:
            for name, role, person in [('secretary', 'secretary', 'p4'), ('treasurer', 'treasurer', 'p15')]:
                c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)', ('test-' + name, name, name.title(), role, 'beirut', person, 'test-hash'))
                c.execute('INSERT INTO assignments VALUES(?,?)', ('test-' + name, 'p-elias'))
        self.http = http.server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        self.worker = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.worker.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.worker.join()
        server.DB = self.original_db
        self.temp.cleanup()

    def call(self, method, path, body=None, cookie=None, csrf=None):
        connection = http.client.HTTPConnection(*self.http.server_address, timeout=30)
        headers = {'Content-Type': 'application/json'}
        if cookie: headers['Cookie'] = cookie
        if csrf: headers['X-CSRF-Token'] = csrf
        try:
            connection.request(method, path, json.dumps(body) if body is not None else None, headers)
            response = connection.getresponse()
            data = json.loads(response.read() or b'{}')
            session = (response.getheader('Set-Cookie') or '').split(';')[0]
            return response.status, data, session
        finally:
            connection.close()

    def signup(self, **values):
        body = dict(parish='p-elias', method='phone', phone='03 123 456', name='Antoinette Khoury', password='rosary2026')
        body.update(values)
        return self.call('POST', '/api/signup', body)

    def session(self, cookie):
        status, data, _ = self.call('GET', '/api/session', cookie=cookie)
        self.assertEqual(status, 200)
        return data

    def login(self, username, password):
        status, data, cookie = self.call('POST', '/api/login', dict(username=username, password=password))
        return status, cookie

    def office(self, who):
        with server.connect() as c:
            user = c.execute('SELECT * FROM users WHERE id=?', ('test-' + who,)).fetchone()
            row = c.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()
            return server.visible(c, user, 'p-elias', json.loads(row['data']))

    def test_signup_with_a_phone_number_opens_an_account_and_a_person_record(self):
        status, data, cookie = self.signup()
        self.assertEqual((status, data), (200, {'ok': True}))
        self.assertTrue(cookie.startswith('pl_session='))
        me = self.session(cookie)
        self.assertEqual((me['user']['username'], me['user']['role'], me['user']['name']), ('+9613123456', 'member', 'Antoinette Khoury'))
        self.assertEqual([p['id'] for p in me['parishes']], ['p-elias'])
        with server.connect() as c:
            state = json.loads(c.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()['data'])
            audit = c.execute("SELECT action FROM audit WHERE action='member.signup'").fetchall()
        person = next(p for p in state['PEOPLE'] if p['id'] == me['user']['person_id'])
        self.assertEqual((person['lat'], person['ar'], person['phone'], person['email']), ('Antoinette Khoury', 'Antoinette Khoury', '3 123 456', ''))
        self.assertEqual((person['registeredOnline']['via'], person['registeredOnline']['verified']), ('phone', False))
        self.assertIn(person['id'], state['PERSON_EXTRA'])
        self.assertEqual(len(audit), 1)
        # The new member can use the portal straight away, for themselves.
        status, view, _ = self.call('GET', '/api/parishes/p-elias/member', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual([s['id'] for s in view['requestOptions']['subjects']], [person['id']])

    def test_phone_numbers_are_recorded_the_way_people_are(self):
        self.assertEqual([server.record_phone(x) for x in ['+9613123456', '+96176220415', '+33612345678']], ['3 123 456', '76 220 415', '+33612345678'])
        status, _, cookie = self.signup(phone='+33 6 12 34 56 78', name='Joseph Abi Nader')
        self.assertEqual(status, 200)
        me = self.session(cookie)
        self.assertEqual(me['user']['username'], '+33612345678')
        with server.connect() as c:
            state = json.loads(c.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()['data'])
        self.assertEqual(next(p['phone'] for p in state['PEOPLE'] if p['id'] == me['user']['person_id']), '+33612345678')
        _, _, cookie = self.signup(method='email', email='rima@example.com', phone='', name='Rima Saad')
        with server.connect() as c:
            state = json.loads(c.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()['data'])
        self.assertEqual(next(p['phone'] for p in state['PEOPLE'] if p['id'] == self.session(cookie)['user']['person_id']), '—')

    def test_a_phone_number_signs_in_however_it_is_typed(self):
        self.signup()
        for typed in ['03 123 456', '+961 3 123 456', '00961-3-123456', '(03) 123-456', '٠٣ ١٢٣ ٤٥٦', '3123456']:
            with self.subTest(typed=typed):
                status, cookie = self.login(typed, 'rosary2026')
                self.assertEqual(status, 200)
                self.assertTrue(cookie.startswith('pl_session='))
        self.assertEqual(self.login('03 123 456', 'wrong-password')[0], 401)
        self.assertEqual(self.login('03 123 457', 'rosary2026')[0], 401)

    def test_signup_with_an_email_address(self):
        status, _, cookie = self.signup(method='email', email=' Marie.Sfeir@Example.com ', phone='', name='  Marie   Sfeir ')
        self.assertEqual(status, 200)
        me = self.session(cookie)
        self.assertEqual((me['user']['username'], me['user']['name']), ('marie.sfeir@example.com', 'Marie Sfeir'))
        self.assertEqual(self.login('MARIE.SFEIR@example.com', 'rosary2026')[0], 200)
        self.assertEqual(self.office('secretary')['ACCOUNTS'][me['user']['person_id']], {'username': 'marie.sfeir@example.com', 'role': 'member'})

    def test_signup_checks_every_field(self):
        cases = [
            (dict(parish='nowhere'), 400, 'Choose your parish.'),
            (dict(name=' A '), 400, 'Enter your full name.'),
            (dict(method='fax'), 400, 'Choose a phone number or an email address.'),
            (dict(phone='12'), 400, 'Enter a valid phone number.'),
            (dict(phone='call me'), 400, 'Enter a valid phone number.'),
            (dict(method='email', email='not-an-email'), 400, 'Enter a valid email address.'),
            (dict(password='short'), 400, 'Choose a password of at least 8 characters.'),
            (dict(website='https://spam.example'), 400, 'The account could not be created.'),
        ]
        for values, status, message in cases:
            with self.subTest(values=values):
                result = self.signup(**values)
                self.assertEqual((result[0], result[1].get('error')), (status, message))
        self.assertEqual(self.signup()[0], 200)
        status, data, _ = self.signup(phone='+961 3 123 456', name='Someone Else')
        self.assertEqual((status, data['error']), (409, 'This phone number already has an account. Sign in instead.'))
        self.signup(method='email', email='a@b.co')
        status, data, _ = self.signup(method='email', email='A@B.co')
        self.assertEqual((status, data['error']), (409, 'This email address already has an account. Sign in instead.'))

    def test_too_many_new_accounts_in_an_hour_are_refused(self):
        with server.connect() as c:
            for _ in range(server.SIGNUPS_PER_HOUR):
                c.execute("INSERT INTO audit(parish_id,actor,at,action,detail) VALUES('p-elias',NULL,?,'member.signup','{}')", (server.NOW(),))
        status, data, _ = self.signup()
        self.assertEqual(status, 429)
        self.assertIn('try again later', data['error'])

    def test_members_change_their_password_and_the_office_can_reset_it(self):
        _, _, cookie = self.signup()
        csrf = self.session(cookie)['csrf']
        status, data, _ = self.call('POST', '/api/parishes/p-elias/member', dict(op='changePassword', current='nope', password='newpassword1'), cookie, csrf)
        self.assertEqual((status, data['error']), (400, 'Your current password is not correct.'))
        status, data, _ = self.call('POST', '/api/parishes/p-elias/member', dict(op='changePassword', current='rosary2026', password='short'), cookie, csrf)
        self.assertEqual((status, data['error']), (400, 'Choose a password of at least 8 characters.'))
        status, _, _ = self.call('POST', '/api/parishes/p-elias/member', dict(op='changePassword', current='rosary2026', password='newpassword1'), cookie, csrf)
        self.assertEqual(status, 200)
        self.assertEqual(self.login('03123456', 'rosary2026')[0], 401)
        self.assertEqual(self.login('03123456', 'newpassword1')[0], 200)

        person_id = self.session(cookie)['user']['person_id']
        with server.connect() as c:
            secretary = c.execute("SELECT * FROM users WHERE id='test-secretary'").fetchone()
            treasurer = c.execute("SELECT * FROM users WHERE id='test-treasurer'").fetchone()
            reset = server.member_action(c, secretary, 'p-elias', dict(op='accountReset', personId=person_id))
            c.commit()
        self.assertEqual(reset['username'], '+9613123456')
        self.assertRegex(reset['password'], r'^[2-9]{8}$')
        self.assertEqual(self.call('GET', '/api/session', cookie=cookie)[0], 401)  # signed out everywhere
        self.assertEqual(self.login('03 123 456', 'newpassword1')[0], 401)
        self.assertEqual(self.login('03 123 456', reset['password'])[0], 200)
        with server.connect() as c:
            with self.assertRaises(server.Problem) as denied:
                server.member_action(c, treasurer, 'p-elias', dict(op='accountReset', personId=person_id))
            self.assertEqual(denied.exception.status, 403)
            with self.assertRaises(server.Problem) as missing:
                server.member_action(c, secretary, 'p-elias', dict(op='accountReset', personId='p1'))
            self.assertEqual(missing.exception.status, 404)
            with self.assertRaises(server.Problem) as staff:
                server.member_action(c, secretary, 'p-elias', dict(op='accountReset', personId='p15'))
            self.assertEqual(staff.exception.status, 404)  # parish staff accounts are reset by the administrator

    def test_only_the_office_sees_who_has_an_account(self):
        _, _, cookie = self.signup()
        person_id = self.session(cookie)['user']['person_id']
        accounts = self.office('secretary')['ACCOUNTS']
        self.assertEqual(accounts[person_id], {'username': '+9613123456', 'role': 'member'})
        self.assertEqual(accounts['p15'], {'username': 'treasurer', 'role': 'treasurer'})
        self.assertEqual(self.office('treasurer')['ACCOUNTS'], {})

    def test_accounts_made_on_cloudflare_sign_in_on_server_py_too(self):
        stored = server.password_hash('lantern-candle', 'salt42')
        import hashlib
        cloudflare = 'pbkdf2_sha256$10000$salt42$' + hashlib.pbkdf2_hmac('sha256', b'lantern-candle', b'salt42', 10000).hex()
        with server.connect() as c:
            c.execute("INSERT INTO users VALUES('test-old','old@example.com','Old','member','beirut','p6',?)", (stored,))
            c.execute("INSERT INTO users VALUES('test-cf','cf@example.com','Cf','member','beirut','p5',?)", (cloudflare,))
            c.execute("INSERT INTO assignments VALUES('test-old','p-elias'),('test-cf','p-elias')")
        self.assertEqual(self.login('old@example.com', 'lantern-candle')[0], 200)
        self.assertEqual(self.login('cf@example.com', 'lantern-candle')[0], 200)
        self.assertEqual(self.login('cf@example.com', 'lantern-candl')[0], 401)


if __name__ == '__main__':
    unittest.main()
