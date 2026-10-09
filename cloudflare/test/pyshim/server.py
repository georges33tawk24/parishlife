"""Stand-in for server.py that runs the Cloudflare Worker's logic, so the existing
backend tests check the port: PYTHONPATH=cloudflare/test/pyshim:. python3 -m unittest ..."""
import atexit
import base64
import http.server
import importlib.util
import itertools
import json
import sqlite3
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
_spec = importlib.util.spec_from_file_location('server_py', REPO / 'server.py')
_real = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_real)
for _name in dir(_real):
    if not _name.startswith('__'):
        globals()[_name] = getattr(_real, _name)

DB = _real.DB
ROOT = _real.ROOT
_bridge = subprocess.Popen(['node', '--no-warnings', str(HERE.parent / 'bridge.mjs')], stdin=subprocess.PIPE,
                           stdout=subprocess.PIPE, text=True, bufsize=1)
atexit.register(_bridge.terminate)
_ids = itertools.count()


def _call(fn, *args, connection=None):
    if connection is not None and connection.in_transaction:
        connection.commit()
    today = TODAY() if TODAY is not _real.TODAY else None
    request = dict(id=next(_ids), fn=fn, db=str(DB), root=str(ROOT), today=today, args=list(args))
    _bridge.stdin.write(json.dumps(request) + '\n')
    _bridge.stdin.flush()
    reply = json.loads(_bridge.stdout.readline())
    if 'problem' in reply:
        raise Problem(*reply['problem'])
    if 'pyerror' in reply:
        raise ValueError(reply['pyerror'])
    if 'error' in reply:
        raise RuntimeError(reply['error'])
    return reply['ok']


def connect():
    c = sqlite3.connect(DB, factory=_real.Connection)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c


def _user(u):
    return {k: u[k] for k in u.keys()} if isinstance(u, sqlite3.Row) else dict(u)


def init_db():
    DB.parent.mkdir(parents=True, exist_ok=True)
    _call('init_db')


def save_patch(c, u, pid, payload): return _call('save_patch', _user(u), pid, payload, connection=c)
def workflow(c, u, pid, q): return _call('workflow', _user(u), pid, q, connection=c)
def visible(c, u, pid, d): return _call('visible', _user(u), pid, d, connection=c)
def oversight(c, u, pid=None): return _call('oversight', _user(u), pid, connection=c)
def file_access(c, u, pid, scope, owner_id, write=False): return _call('file_access', _user(u), pid, scope, owner_id, write, connection=c)
def member_view(c, u, pid): return _call('member_view', _user(u), pid, connection=c)
def member_action(c, u, pid, q): return _call('member_action', _user(u), pid, q, connection=c)
def xlsx_preview(encoded): return _call('xlsx_preview', encoded)
def migrate_state(d): return _call('migrate_state', d)
def validate(d): return _call('validate', d)


class Handler(http.server.BaseHTTPRequestHandler):
    """Every request goes through the Worker's fetch handler."""
    def _forward(self):
        length = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(length).decode('utf-8', 'surrogateescape') if length else None
        result = _call('http', self.command, self.path, dict(self.headers.items()), body)
        data = base64.b64decode(result['body'])
        self.send_response(result['status'])
        for key, value in result['headers'].items():
            if key.lower() not in {'content-length', 'date', 'server'}:
                self.send_header('-'.join(part.capitalize() for part in key.split('-')), value)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)
    do_GET = do_HEAD = do_POST = do_PUT = do_DELETE = _forward
