"""Anyone 13 or older opens an account with an email address and/or a phone number and no parish; they sign in
with Email, Phone number or Username in any common format, ask a parish office for membership, change their
password from My account, and the parish office can reset the password of an account without a staff role."""
import datetime as dt
import hashlib
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
        body = dict(firstName='Antoinette', lastName='Khoury', phone='03 123 456', email='', birthDate='1990-05-14',
                    password='rosary2026', confirm='rosary2026')
        body.update(values)
        return self.call('POST', '/api/signup', body)

    def session(self, cookie):
        status, data, _ = self.call('GET', '/api/session', cookie=cookie)
        self.assertEqual(status, 200)
        return data

    def login(self, identifier, password, method=None):
        body = dict(username=identifier, password=password) if method is None else dict(method=method, identifier=identifier, password=password)
        status, data, cookie = self.call('POST', '/api/login', body)
        return status, cookie

    def office(self, who):
        with server.connect() as c:
            user = c.execute('SELECT * FROM users WHERE id=?', ('test-' + who,)).fetchone()
            row = c.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()
            return server.visible(c, user, 'p-elias', json.loads(row['data']))

    def state(self):
        with server.connect() as c:
            return json.loads(c.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()['data'])

    def join(self, cookie):
        """The account asks Saint Elias for membership and the secretary approves it with a new person record."""
        csrf = self.session(cookie)['csrf']
        status, asked, _ = self.call('POST', '/api/connections', dict(op='requestMembership', parish='p-elias'), cookie, csrf)
        self.assertEqual(status, 200)
        with server.connect() as c:
            secretary = c.execute("SELECT * FROM users WHERE id='test-secretary'").fetchone()
            approved = server.office_connection_action(c, secretary, 'p-elias', dict(op='approveMembership', id=asked['id'], create=True),
                                                       [], 'http://127.0.0.1')
            c.commit()
        return approved['personId']

    def test_registration_opens_an_account_without_a_parish(self):
        people = len(self.state()['PEOPLE'])
        status, data, cookie = self.signup()
        self.assertEqual(status, 200)
        # No delivery service is configured here, so no code is sent and the answer says so.
        self.assertEqual(data, {'ok': True, 'delivery': [dict(kind='phone', value='+9613123456', delivery='not-configured')]})
        self.assertTrue(cookie.startswith('pl_session='))
        me = self.session(cookie)
        self.assertEqual((me['user']['username'], me['user']['role'], me['user']['name'], me['user']['person_id']),
                         ('+9613123456', 'user', 'Antoinette Khoury', None))
        self.assertEqual(me['parishes'], [])
        self.assertEqual(len(self.state()['PEOPLE']), people)   # no person record until a parish office approves one
        with server.connect() as c:
            contacts = [tuple(r) for r in c.execute('SELECT kind,value,verified_at FROM user_contacts WHERE user_id=?', (me['user']['id'],))]
            profile = c.execute('SELECT first_name,last_name,birth_date FROM user_profiles WHERE user_id=?', (me['user']['id'],)).fetchone()
            audit = c.execute("SELECT action FROM audit WHERE action='account.signup'").fetchall()
        self.assertEqual(contacts, [('phone', '+9613123456', None)])
        self.assertEqual(tuple(profile), ('Antoinette', 'Khoury', '1990-05-14'))
        self.assertEqual(len(audit), 1)
        self.assertEqual(self.call('GET', '/api/parishes/p-elias/member', cookie=cookie)[0], 403)

    def test_membership_approved_by_the_office_opens_the_member_portal(self):
        _, _, cookie = self.signup()
        person_id = self.join(cookie)
        me = self.session(cookie)
        self.assertEqual([(p['id'], p['roleCode']) for p in me['parishes']], [('p-elias', 'member')])
        person = next(p for p in self.state()['PEOPLE'] if p['id'] == person_id)
        self.assertEqual((person['lat'], person['ar'], person['phone'], person['email'], person['born']),
                         ('Antoinette Khoury', 'Antoinette Khoury', '3 123 456', '', '1990-05-14'))
        self.assertEqual((person['registeredOnline']['via'], person['registeredOnline']['verified']), ('account', False))
        status, view, _ = self.call('GET', '/api/parishes/p-elias/member', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual([s['id'] for s in view['requestOptions']['subjects']], [person_id])

    def test_phone_numbers_are_recorded_the_way_people_are(self):
        self.assertEqual([server.record_phone(x) for x in ['+9613123456', '+96176220415', '+33612345678']], ['3 123 456', '76 220 415', '+33612345678'])
        _, _, cookie = self.signup(phone='+33 6 12 34 56 78', firstName='Joseph', lastName='Abi Nader')
        self.assertEqual(self.session(cookie)['user']['username'], '+33612345678')
        person_id = self.join(cookie)
        self.assertEqual(next(p['phone'] for p in self.state()['PEOPLE'] if p['id'] == person_id), '+33612345678')
        _, _, cookie = self.signup(email='rima@example.com', phone='', firstName='Rima', lastName='Saad')
        person_id = self.join(cookie)
        self.assertEqual(next(p['phone'] for p in self.state()['PEOPLE'] if p['id'] == person_id), '—')

    def test_a_phone_number_signs_in_however_it_is_typed(self):
        self.signup()
        for typed in ['03 123 456', '+961 3 123 456', '00961-3-123456', '(03) 123-456', '٠٣ ١٢٣ ٤٥٦', '3123456']:
            for method in (None, 'phone'):
                with self.subTest(typed=typed, method=method):
                    status, cookie = self.login(typed, 'rosary2026', method)
                    self.assertEqual(status, 200)
                    self.assertTrue(cookie.startswith('pl_session='))
        self.assertEqual(self.login('03 123 456', 'wrong-password')[0], 401)
        self.assertEqual(self.login('03 123 457', 'rosary2026')[0], 401)
        # Each tab looks only for its own kind of sign-in name.
        self.assertEqual(self.login('03 123 456', 'rosary2026', 'email')[0], 401)
        status, data, _ = self.call('POST', '/api/login', dict(method='phone', identifier='03 123 456', password='nope-nope'))
        self.assertEqual((status, data['error']), (401, 'Incorrect phone number or password.'))
        status, data, _ = self.call('POST', '/api/login', dict(method='fax', identifier='03 123 456', password='rosary2026'))
        self.assertEqual((status, data['error']), (400, 'Choose how you sign in.'))

    def test_repeated_failures_for_one_name_are_slowed_down(self):
        self.signup()
        for _ in range(server.LOGIN_ATTEMPTS):
            self.assertEqual(self.login('03 123 456', 'wrong-password')[0], 401)
        status, data, _ = self.call('POST', '/api/login', dict(username='03 123 456', password='rosary2026'))
        self.assertEqual(status, 429)
        self.assertIn('Wait 15 minutes', data['error'])

    def test_registration_with_an_email_address_or_both(self):
        status, data, cookie = self.signup(email=' Marie.Sfeir@Example.com ', phone='', firstName='  Marie ', lastName=' Sfeir ')
        self.assertEqual((status, data['delivery']), (200, [dict(kind='email', value='marie.sfeir@example.com', delivery='not-configured')]))
        me = self.session(cookie)
        self.assertEqual((me['user']['username'], me['user']['name']), ('marie.sfeir@example.com', 'Marie Sfeir'))
        self.assertEqual(self.login('MARIE.SFEIR@example.com', 'rosary2026')[0], 200)
        self.assertEqual(self.login('marie.sfeir@example.com', 'rosary2026', 'email')[0], 200)
        status, data, cookie = self.signup(email='joe@example.com', phone='70 145 332', firstName='Joe', lastName='Haddad')
        self.assertEqual([d['kind'] for d in data['delivery']], ['email', 'phone'])
        self.assertEqual(self.session(cookie)['user']['username'], 'joe@example.com')
        self.assertEqual(self.login('70 145 332', 'rosary2026', 'phone')[0], 200)

    def test_registration_checks_every_field(self):
        young = (dt.date.today() - dt.timedelta(days=365 * 10)).isoformat()
        cases = [
            (dict(firstName=' '), 'Enter your first name.'),
            (dict(lastName=''), 'Enter your last name.'),
            (dict(phone='', email=''), 'Enter an email address, a phone number, or both.'),
            (dict(phone='12'), 'Enter a valid phone number.'),
            (dict(phone='call me'), 'Enter a valid phone number.'),
            (dict(email='not-an-email'), 'Enter a valid email address.'),
            (dict(birthDate=''), 'Enter your date of birth.'),
            (dict(birthDate='1990-02-30'), 'Enter your date of birth.'),
            (dict(birthDate=young), f'You need to be {server.MINIMUM_AGE} or older to open an account. A parent or guardian can make requests for you.'),
            (dict(password='short', confirm='short'), 'Choose a password of at least 8 characters.'),
            (dict(confirm='rosary2027'), 'The two passwords do not match.'),
            (dict(website='https://spam.example'), 'The account could not be created.'),
        ]
        for values, message in cases:
            with self.subTest(values=values):
                result = self.signup(**values)
                self.assertEqual((result[0], result[1].get('error')), (400, message))
        self.assertEqual(self.signup()[0], 200)
        status, data, _ = self.signup(phone='+961 3 123 456', firstName='Someone', lastName='Else')
        self.assertEqual((status, data['error']), (409, 'This phone number already has an account. Sign in instead.'))
        self.signup(email='a@b.co', phone='')
        status, data, _ = self.signup(email='A@B.co', phone='')
        self.assertEqual((status, data['error']), (409, 'This email address already has an account. Sign in instead.'))

    def test_too_many_new_accounts_in_an_hour_are_refused(self):
        with server.connect() as c:
            for _ in range(server.SIGNUPS_PER_HOUR):
                c.execute("INSERT INTO audit(parish_id,actor,at,action,detail) VALUES(NULL,NULL,?,'account.signup','{}')", (server.NOW(),))
        status, data, _ = self.signup()
        self.assertEqual(status, 429)
        self.assertIn('try again later', data['error'])

    def test_people_change_their_password_and_the_office_can_reset_a_members(self):
        _, _, cookie = self.signup()
        csrf = self.session(cookie)['csrf']
        status, data, _ = self.call('POST', '/api/account', dict(op='changePassword', current='nope', password='newpassword1', confirm='newpassword1'), cookie, csrf)
        self.assertEqual((status, data['error']), (403, 'Your current password is not right.'))
        status, data, _ = self.call('POST', '/api/account', dict(op='changePassword', current='rosary2026', password='short', confirm='short'), cookie, csrf)
        self.assertEqual((status, data['error']), (400, 'Choose a password of at least 8 characters.'))
        status, data, _ = self.call('POST', '/api/account', dict(op='changePassword', current='rosary2026', password='newpassword1', confirm='newpassword2'), cookie, csrf)
        self.assertEqual((status, data['error']), (400, 'The two passwords do not match.'))
        status, _, _ = self.call('POST', '/api/account', dict(op='changePassword', current='rosary2026', password='newpassword1', confirm='newpassword1'), cookie, csrf)
        self.assertEqual(status, 200)
        self.assertEqual(self.call('GET', '/api/session', cookie=cookie)[0], 200)   # this session stays signed in
        self.assertEqual(self.login('03123456', 'rosary2026')[0], 401)
        self.assertEqual(self.login('03123456', 'newpassword1')[0], 200)

        person_id = self.join(cookie)
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
            self.assertEqual(staff.exception.status, 404)  # parish staff accounts are reset by an administrator

    def test_only_the_office_sees_who_has_an_account(self):
        _, _, cookie = self.signup()
        self.assertNotIn('+9613123456', [a['username'] for a in self.office('secretary')['ACCOUNTS'].values()])   # not linked yet
        person_id = self.join(cookie)
        accounts = self.office('secretary')['ACCOUNTS']
        self.assertEqual(accounts[person_id], {'username': '+9613123456', 'role': 'member'})
        self.assertEqual(accounts['p15'], {'username': 'treasurer', 'role': 'treasurer'})
        self.assertEqual(self.office('treasurer')['ACCOUNTS'], {})

    def test_accounts_made_on_cloudflare_sign_in_on_server_py_too(self):
        stored = server.password_hash('lantern-candle', 'salt42')
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
