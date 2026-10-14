"""A parish's colour scheme: set by the priest, checked by the server, worn by the portal and the public page."""
import http.client
import http.server
import json
import tempfile
import threading
import unittest
from pathlib import Path

import server


class QuietHandler(server.Handler):
    def log_message(self, *args):
        pass


class ParishThemeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_db = server.DB
        server.DB = Path(self.temp.name) / 'theme.sqlite3'
        server.init_db()
        self.users = {}
        with server.connect() as c:
            for name, role, person in [('nada', 'member', 'p2'), ('secretary', 'secretary', 'p4'), ('priest', 'priest', 'p17')]:
                user = dict(id='test-' + name, username=name, name=name.title(), role=role, diocese='beirut', person_id=person)
                c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)', (user['id'], name, user['name'], role, 'beirut', person, 'test-hash'))
                c.execute('INSERT INTO assignments VALUES(?,?)', (user['id'], 'p-elias'))
                self.users[name] = user

    def tearDown(self):
        server.DB = self.original_db
        self.temp.cleanup()

    def parish(self):
        with server.connect() as c:
            row = c.execute("SELECT revision,data FROM states WHERE parish_id='p-elias'").fetchone()
            return row['revision'], json.loads(row['data'])['PARISH']

    def save_theme(self, who, theme):
        revision, parish = self.parish()
        parish = dict(parish, theme=theme)
        with server.connect() as c:
            return server.save_patch(c, self.users[who], 'p-elias', dict(revision=revision, changes={'PARISH': parish}))

    def member_parish(self):
        with server.connect() as c:
            return server.member_view(c, self.users['nada'], 'p-elias')['parish']

    def public_parish(self):
        http_server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        worker = threading.Thread(target=http_server.serve_forever, daemon=True)
        worker.start()
        try:
            connection = http.client.HTTPConnection(*http_server.server_address, timeout=5)
            connection.request('GET', '/api/public/parishes/p-elias')
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            return json.loads(response.read())['parish']
        finally:
            connection.close()
            http_server.shutdown()
            http_server.server_close()
            worker.join()

    def test_a_parish_starts_in_the_default_colours(self):
        self.assertIsNone(self.parish()[1].get('theme'))
        self.assertIsNone(self.member_parish()['theme'])
        self.assertIsNone(self.public_parish()['theme'])

    def test_the_priest_chooses_a_scheme_and_every_page_wears_it(self):
        self.save_theme('priest', {'scheme': 'navy', 'primary': '#1F3A5F'})
        self.assertEqual(self.parish()[1]['theme'], {'scheme': 'navy', 'primary': '#1F3A5F'})
        self.assertEqual(self.member_parish()['theme'], {'scheme': 'navy', 'primary': '#1F3A5F'})
        self.assertEqual(self.public_parish()['theme'], {'scheme': 'navy', 'primary': '#1F3A5F'})
        self.save_theme('priest', {'scheme': 'custom', 'primary': '#7a2e3a'})
        self.assertEqual(self.public_parish()['theme'], {'scheme': 'custom', 'primary': '#7a2e3a'})
        self.save_theme('priest', None)
        self.assertIsNone(self.member_parish()['theme'])

    def test_only_a_well_formed_scheme_is_kept(self):
        for theme in [{'scheme': 'neon', 'primary': '#1F3A5F'}, {'scheme': 'custom', 'primary': 'red'},
                      {'scheme': 'custom', 'primary': '#12345'}, {'scheme': 'custom', 'primary': '#1F3A5F', 'css': 'body{}'},
                      {'scheme': ['navy'], 'primary': '#1F3A5F'}, {'primary': '#1F3A5F'}, '#1F3A5F', ['navy']]:
            with self.subTest(theme=theme), self.assertRaises(server.Problem) as raised:
                self.save_theme('priest', theme)
            self.assertEqual(raised.exception.status, 400)
            self.assertEqual(raised.exception.message, 'Invalid colour scheme.')
        self.assertIsNone(self.parish()[1].get('theme'))

    def test_only_the_priest_changes_the_colours(self):
        with self.assertRaises(server.Problem) as raised:
            self.save_theme('secretary', {'scheme': 'navy', 'primary': '#1F3A5F'})
        self.assertEqual(raised.exception.status, 403)
        self.assertIsNone(self.parish()[1].get('theme'))


if __name__ == '__main__':
    unittest.main()
