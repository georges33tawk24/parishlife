"""Start a disposable localhost fixture for administration browser tests.

This never opens the installation's database. Credentials are random, belong
only to this temporary database, and are removed when the preview exits.
"""
import http.server
import json
from pathlib import Path
import secrets
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server
from backend.administration import write_grant


def main():
    credentials_path=ROOT/'var'/'administration-preview.json'
    credentials_path.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='parishlife-preview-') as directory:
        server.DB=Path(directory)/'preview.sqlite3'
        server.init_db()
        password=secrets.token_urlsafe(28)
        hashed=server.password_hash(password)
        with server.connect() as connection:
            connection.execute("INSERT OR IGNORE INTO dioceses(id,name) VALUES('pl-platform','Platform')")
            connection.execute("INSERT INTO dioceses(id,name) VALUES('empty-preview','Empty preview archdiocese')")
            for name,role,diocese in [('preview-root','member','pl-platform'),('preview-bishop','bishop','beirut'),
                                      ('preview-parish','member','beirut'),('preview-arch','member','empty-preview'),
                                      ('preview-secretary','member','pl-platform')]:
                connection.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',(name,name,name,role,diocese,None,hashed))
            write_grant(connection,None,'preview-root','super_admin','global','*',True)
            write_grant(connection,None,'preview-parish','parish_admin','parish','p-elias',True)
            write_grant(connection,None,'preview-arch','diocesan_admin','diocese','empty-preview',True)
        class QuietHandler(server.Handler):
            def log_message(self,*args):
                pass
        http_server=http.server.ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
        credentials_path.write_text(json.dumps({'password':password,'port':http_server.server_port}),encoding='utf-8')
        print('Disposable administration preview ready; configuration is in var/administration-preview.json.',flush=True)
        try:
            http_server.serve_forever()
        finally:
            http_server.server_close()
            credentials_path.unlink(missing_ok=True)


if __name__=='__main__':
    main()
