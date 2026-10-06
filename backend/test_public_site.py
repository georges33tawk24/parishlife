"""Public church pages expose published data and a bounded static asset surface."""
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


class PublicSiteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_db, self.original_root = server.DB, server.ROOT
        server.DB = Path(self.temp.name) / 'public.sqlite3'
        server.init_db()
        self.http = http.server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        self.worker = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.worker.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.worker.join()
        server.DB, server.ROOT = self.original_db, self.original_root
        self.temp.cleanup()

    def request(self, path, method='GET'):
        connection = http.client.HTTPConnection(*self.http.server_address, timeout=5)
        try:
            connection.request(method, path)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def public(self, parish=None):
        path = '/api/public/parishes' + ('/' + parish if parish else '')
        status, _, body = self.request(path)
        self.assertEqual(status, 200)
        return json.loads(body)

    def replace_state(self, parish, **changes):
        with server.connect() as c:
            row = c.execute('SELECT data FROM states WHERE parish_id=?', (parish,)).fetchone()
            state = json.loads(row['data'])
            state.update(changes)
            c.execute('UPDATE states SET data=? WHERE parish_id=?', (json.dumps(state), parish))

    def test_directory_has_bilingual_towns_and_only_directory_fields(self):
        with server.connect() as c:
            rows = c.execute('SELECT id,metadata FROM parishes').fetchall()
            expected = {row['id']: json.loads(row['metadata']) for row in rows}
            metadata = {**expected['p-elias'], 'privateNote': 'Never expose this'}
            c.execute('UPDATE parishes SET metadata=? WHERE id=?', (json.dumps(metadata), 'p-elias'))
        directory = self.public()['parishes']
        self.assertEqual({item['id'] for item in directory}, set(expected))
        for item in directory:
            self.assertEqual(set(item), {'id', 'name', 'ar', 'town', 'townAr'})
            self.assertEqual(item['townAr'], expected[item['id']]['townAr'])

    def test_public_detail_filters_drafts_private_events_and_other_parishes(self):
        events = [dict(id=key, title=key, titleAr=key, kind=kind, d='2099-01-01', t='10:00',
                       privateField='private event data') for key, kind in
                  [('published', 'event'), ('group-only', 'event'), ('confidential', 'event'),
                   ('pending', 'pending'), ('legacy-mass', 'mass')]]
        details = {'published': {'visibility': 'public', 'participants': ['private person']},
                   'group-only': {'visibility': 'groups', 'visibleGroupIds': ['g1']},
                   'confidential': {'visibility': 'confidential'},
                   'pending': {'visibility': 'public'}}
        self.replace_state('p-elias',
                           CONTENT={'welcome': {'en': 'Public welcome', 'ar': 'أهلاً', 'published': True,
                                                'internalNote': 'private draft instructions'},
                                    'draft': {'en': 'Unpublished draft', 'published': False}},
                           EVENTS=events, EVENT_DETAIL=details, NOTES=[{'body': 'Clergy only'}])
        self.replace_state('p-charbel', CONTENT={'welcome': {'en': 'Other parish', 'published': True}},
                           EVENTS=[dict(id='other-parish', kind='event')],
                           EVENT_DETAIL={'other-parish': {'visibility': 'public'}})
        page = self.public('p-elias')
        self.assertEqual(set(page), {'parish', 'content', 'events', 'posts'})
        self.assertEqual(page['content'], {'welcome': {'en': 'Public welcome', 'ar': 'أهلاً'}})
        self.assertEqual({event['id'] for event in page['events']}, {'published', 'legacy-mass'})
        for event in page['events']:
            self.assertEqual(set(event), {'id', 'd', 't', 'title', 'titleAr', 'kind'})
        self.assertEqual(self.public('p-charbel')['content']['welcome']['en'], 'Other parish')
        self.assertEqual(self.request('/api/public/parishes/unknown')[0], 404)
        self.assertEqual(self.request('/api/parishes/p-elias/state')[0], 401)

    def test_contact_details_require_published_contact_section(self):
        with server.connect() as c:
            row = c.execute("SELECT data FROM states WHERE parish_id='p-elias'").fetchone()
            parish = json.loads(row['data'])['PARISH']
        parish.update(address='Office address', addressAr='عنوان المكتب', phone='01234567')
        self.replace_state('p-elias', PARISH=parish,
                           CONTENT={'contact': {'en': 'Contact us', 'published': False}})
        hidden = self.public('p-elias')['parish']
        self.assertEqual([hidden[key] for key in ('address', 'addressAr', 'phone')], ['', '', ''])
        self.replace_state('p-elias', CONTENT={'contact': {'en': 'Contact us', 'published': True}})
        published = self.public('p-elias')['parish']
        self.assertEqual([published[key] for key in ('address', 'addressAr', 'phone')],
                         ['Office address', 'عنوان المكتب', '01234567'])

    def test_local_images_and_fonts_are_served_without_exposing_internal_files(self):
        server.ROOT = Path(self.temp.name) / 'website'
        files = {
            'public.html': b'public page',
            'assets/public.css': b'body{}',
            'assets/public.js': b'void 0;',
            'assets/images/church.jpg': b'local photograph',
            'assets/images/church.webp': b'local webp',
            'assets/fonts/site.woff2': b'local font',
            'backend/secret.js': b'internal code',
            'backend/seed.json': b'private seed',
            'server.py': b'internal server',
            'var/parishlife.sqlite3': b'private database',
            'assets/images/private.sqlite3': b'not an asset',
            'assets/misplaced.jpg': b'outside image folder',
            'assets/fonts/unsupported.ttf': b'unsupported font',
        }
        for relative, content in files.items():
            target = server.ROOT / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        for relative in list(files)[:6]:
            with self.subTest(asset=relative):
                status, headers, body = self.request('/' + relative)
                self.assertEqual(status, 200)
                self.assertEqual(body, files[relative])
                self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
                self.assertEqual(self.request('/' + relative, 'HEAD')[0], 200)
        forbidden = ['/' + relative for relative in list(files)[6:]]
        forbidden += ['/assets/../backend/secret.js', '/assets/%2e%2e/backend/secret.js',
                      '/assets/%2e%2e%2fbackend/secret.js', '/assets/%2e%2e%5cbackend/secret.js',
                      '/assets/images/../../var/parishlife.sqlite3']
        for path in forbidden:
            for method in ('GET', 'HEAD'):
                with self.subTest(path=path, method=method):
                    self.assertEqual(self.request(path, method)[0], 404)


if __name__ == '__main__':
    unittest.main()
