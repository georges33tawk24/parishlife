"""Sign-in protections, the same as cloudflare/src/sign-in.js: a pause after repeated wrong
passwords, a check that a new password is not a common or leaked one, the Cloudflare Turnstile
check when the platform has keys for it, and passkeys (WebAuthn) to sign in without a password."""
import base64
import datetime as dt
import hashlib
import json
import os
import secrets
import urllib.parse
import urllib.request
from pathlib import Path

COMMON = set(json.loads(Path(__file__).with_name('common-passwords.json').read_text(encoding='utf-8')))

# ---------- repeated wrong passwords ----------
WINDOW, ACCOUNT_LIMIT, ADDRESS_LIMIT = dt.timedelta(minutes=15), 10, 60
TOO_MANY = 'Too many attempts to sign in. Wait 15 minutes and try again, or ask your parish office to reset your password.'


def _stamp(delta=dt.timedelta()):
    return (dt.datetime.now(dt.timezone.utc) - delta).isoformat()


def _sha(text):
    return hashlib.sha256(str(text).encode()).hexdigest()


def _failure_keys(q, address, normalize):
    return ['account:' + _sha(normalize(q.get('username')).lower()), 'address:' + _sha(address or '')]


def login_guard(c, q, address, normalize, require):
    since = _stamp(WINDOW)
    account, place = _failure_keys(q, address, normalize)
    count = lambda key: c.execute('SELECT COUNT(*) FROM pl_login_failures WHERE key=? AND created_at>?', (key, since)).fetchone()[0]
    require(count(account) < ACCOUNT_LIMIT and count(place) < ADDRESS_LIMIT, TOO_MANY, 429)


def login_failed(c, q, address, normalize):
    """Recorded and committed before the error is answered, since an error rolls the request back."""
    stamp = _stamp()
    c.execute('DELETE FROM pl_login_failures WHERE created_at<?', (_stamp(dt.timedelta(days=1)),))
    for key in _failure_keys(q, address, normalize):
        c.execute('INSERT INTO pl_login_failures VALUES(?,?)', (key, stamp))
    c.commit()


def login_succeeded(c, q, normalize):
    c.execute('DELETE FROM pl_login_failures WHERE key=?', (_failure_keys(q, '', normalize)[0],))


# ---------- new passwords ----------
WEAK_PASSWORD = 'This password is too common or has appeared in a data breach. Choose another; a short sentence is easy to remember and hard to guess.'


def _breached(password):
    """Pwned Passwords is asked about the first five characters of the password's SHA-1 only. When
    it cannot be reached the password is accepted, so an outage never blocks sign-up."""
    digest = hashlib.sha1(password.encode()).hexdigest().upper()
    request = urllib.request.Request('https://api.pwnedpasswords.com/range/' + digest[:5],
                                     headers={'Add-Padding': 'true', 'User-Agent': 'ParishLife'})
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            lines = response.read().decode().splitlines()
    except Exception:
        return False
    for line in lines:
        tail, _, count = line.strip().partition(':')
        if tail == digest[5:] and count.isdigit() and int(count) > 0:
            return True
    return False


def password_problem(password, contacts=()):
    lower = password.lower()
    if any(v and len(v) >= 4 and v.lower().lstrip('+') in lower for v in contacts):
        return 'Choose a password that does not contain your email address or phone number.'
    if lower in COMMON or 'parishlife' in lower or len(set(password)) <= 1 or _breached(password):
        return WEAK_PASSWORD
    return ''


# ---------- Turnstile ----------
def human_check(q, address, require):
    """Only when the platform has a Turnstile secret; the page then shows the widget (see auth-options)."""
    secret = os.environ.get('TURNSTILE_SECRET', '')
    if not secret:
        return
    ok, token = False, str(q.get('turnstile') or '')
    if token:
        form = {'secret': secret, 'response': token, **({'remoteip': address} if address else {})}
        try:
            with urllib.request.urlopen('https://challenges.cloudflare.com/turnstile/v0/siteverify',
                                        urllib.parse.urlencode(form).encode(), timeout=5) as response:
                ok = json.loads(response.read()).get('success') is True
        except Exception:
            ok = False
    require(ok, 'The security check did not finish. Wait a moment for it, then try again.', 403)


# ---------- passkeys ----------
FAILED = 'The passkey could not be checked. Try again, or sign in with your password.'
EXPIRED = 'The passkey request expired. Try again.'


def b64u(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def unb64u(text):
    text = str(text or '')
    try:
        return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))
    except (ValueError, TypeError):
        return b''


def passkey_context(host, secure, cookie):
    """The challenge travels in a short-lived cookie for the API only, so nothing is stored for it."""
    origin = ('https://' if secure else 'http://') + host
    return {'rpId': urllib.parse.urlsplit(origin).hostname or '', 'origin': origin, 'challenge': cookie,
            'cookie': lambda value: f"pl_passkey={value}; HttpOnly; SameSite=Strict; Path=/api/; Max-Age={300 if value else 0}{'; Secure' if secure else ''}"}


def _cbor(data, start=0):
    """The parts of CBOR that WebAuthn uses: integers, byte and text strings, arrays and maps."""
    at = start

    def read():
        nonlocal at
        first = data[at]
        at += 1
        major, info = first >> 5, first & 31
        if info < 24:
            n = info
        elif info <= 27:
            size = 1 << (info - 24)
            n = int.from_bytes(data[at:at + size], 'big')
            at += size
        else:
            raise ValueError('CBOR')
        if major == 0:
            return n
        if major == 1:
            return -1 - n
        if major in (2, 3):
            if at + n > len(data):
                raise ValueError('CBOR')
            chunk = bytes(data[at:at + n])
            at += n
            return chunk if major == 2 else chunk.decode()
        if major == 4:
            return [read() for _ in range(n)]
        if major == 5:
            out = {}
            for _ in range(n):
                key = read()
                out[key] = read()
            return out
        if major == 7:
            return {20: False, 21: True}.get(info)
        raise ValueError('CBOR')
    return read()


def _authenticator_data(data, require):
    require(len(data) >= 37, FAILED)
    out = {'rpIdHash': data[:32], 'flags': data[32], 'count': int.from_bytes(data[33:37], 'big')}
    if data[32] & 0x40:
        require(len(data) >= 55, FAILED)
        length = int.from_bytes(data[53:55], 'big')
        out['credentialId'] = data[55:55 + length]
        try:
            out['key'] = _cbor(data, 55 + length)
        except (ValueError, IndexError, UnicodeDecodeError):
            require(False, FAILED)
    return out


def _client_data(encoded, kind, ctx, require):
    try:
        data = json.loads(unb64u(encoded))
    except ValueError:
        data = None
    require(bool(ctx['challenge']), EXPIRED)
    require(isinstance(data, dict) and data.get('type') == kind and data.get('challenge') == ctx['challenge']
            and data.get('origin') == ctx['origin'], FAILED)


def _cose_key(key, require):
    """ES256 (P-256) and RS256 public keys, kept as JWK fields."""
    require(isinstance(key, dict), FAILED)
    if key.get(1) == 2 and key.get(3) == -7 and key.get(-1) == 1:
        return {'alg': -7, 'kty': 'EC', 'x': b64u(key[-2]), 'y': b64u(key[-3])}
    if key.get(1) == 3 and key.get(3) == -257:
        return {'alg': -257, 'kty': 'RSA', 'n': b64u(key[-1]), 'e': b64u(key[-2])}
    require(False, 'This passkey uses a kind of key ParishLife does not accept yet.')


# P-256, for checking ES256 signatures without a third-party library.
_P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff
_A = _P - 3
_B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b
_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551
_G = (0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296,
      0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5)


def _add(p, q):
    if p is None:
        return q
    if q is None:
        return p
    if p[0] == q[0] and (p[1] + q[1]) % _P == 0:
        return None
    if p == q:
        m = (3 * p[0] * p[0] + _A) * pow(2 * p[1], -1, _P)
    else:
        m = (q[1] - p[1]) * pow(q[0] - p[0], -1, _P)
    x = (m * m - p[0] - q[0]) % _P
    return x, (m * (p[0] - x) - p[1]) % _P


def _mul(k, point):
    out = None
    while k:
        if k & 1:
            out = _add(out, point)
        point = _add(point, point)
        k >>= 1
    return out


def _der(signature):
    if len(signature) < 8 or signature[0] != 0x30:
        raise ValueError('DER')
    at, out = 2, []
    for _ in range(2):
        if signature[at] != 2:
            raise ValueError('DER')
        length = signature[at + 1]
        out.append(int.from_bytes(signature[at + 2:at + 2 + length], 'big'))
        at += 2 + length
    return out


def _es256(x, y, signature, data):
    r, s = _der(signature)
    if not (0 < r < _N and 0 < s < _N) or (y * y - (x * x * x + _A * x + _B)) % _P:
        return False
    z, w = int.from_bytes(hashlib.sha256(data).digest(), 'big'), pow(s, -1, _N)
    point = _add(_mul(z * w % _N, _G), _mul(r * w % _N, (x, y)))
    return point is not None and point[0] % _N == r


_SHA256_INFO = bytes.fromhex('3031300d060960864801650304020105000420')


def _rs256(n, e, signature, data):
    size = (n.bit_length() + 7) // 8
    if len(signature) != size:
        return False
    digest = _SHA256_INFO + hashlib.sha256(data).digest()
    if size < len(digest) + 11:
        return False
    return pow(int.from_bytes(signature, 'big'), e, n).to_bytes(size, 'big') == b'\x00\x01' + b'\xff' * (size - 3 - len(digest)) + b'\x00' + digest


def _signature_valid(key, signature, data):
    number = lambda field: int.from_bytes(unb64u(key[field]), 'big')
    try:
        if key['kty'] == 'EC':
            return _es256(number('x'), number('y'), signature, data)
        return _rs256(number('n'), number('e'), signature, data)
    except (ValueError, IndexError, KeyError):
        return False


def _record(c, user, action, detail):
    c.execute('INSERT INTO pl_history VALUES(?,?,?,?,?,?)', (secrets.token_hex(16), user['id'], '*', action, json.dumps(detail), _stamp()))


def passkey_options(c, user, ctx):
    """Options for the browser: to sign in (any passkey of this site), or to add one to the account."""
    challenge = secrets.token_urlsafe(32)
    if user is None:
        return {'challenge': challenge, 'rpId': ctx['rpId'], 'timeout': 120000, 'userVerification': 'preferred'}
    existing = c.execute('SELECT id FROM pl_passkeys WHERE user_id=?', (user['id'],)).fetchall()
    return {'challenge': challenge, 'rp': {'name': 'ParishLife', 'id': ctx['rpId']},
            'user': {'id': b64u(user['id'].encode()), 'name': user['username'], 'displayName': user['name'] or user['username']},
            'pubKeyCredParams': [{'type': 'public-key', 'alg': -7}, {'type': 'public-key', 'alg': -257}], 'timeout': 120000, 'attestation': 'none',
            'authenticatorSelection': {'residentKey': 'required', 'requireResidentKey': True, 'userVerification': 'preferred'},
            'excludeCredentials': [{'type': 'public-key', 'id': row['id']} for row in existing]}


def passkey_add(c, user, q, ctx, require):
    _client_data(q.get('clientDataJSON'), 'webauthn.create', ctx, require)
    try:
        attestation = _cbor(unb64u(q.get('attestationObject')))
    except (ValueError, IndexError, UnicodeDecodeError):
        attestation = None
    require(isinstance(attestation, dict) and isinstance(attestation.get('authData'), bytes), FAILED)
    parsed = _authenticator_data(attestation['authData'], require)
    require(parsed['rpIdHash'] == hashlib.sha256(ctx['rpId'].encode()).digest() and parsed['flags'] & 1
            and bool(parsed.get('credentialId')), FAILED)
    key_id, key = b64u(parsed['credentialId']), _cose_key(parsed.get('key'), require)
    require(len(key_id) <= 1400, FAILED)
    require(not c.execute('SELECT 1 FROM pl_passkeys WHERE id=?', (key_id,)).fetchone(), 'This passkey is already on an account.', 409)
    require(c.execute('SELECT COUNT(*) FROM pl_passkeys WHERE user_id=?', (user['id'],)).fetchone()[0] < 10, 'An account can have up to ten passkeys.')
    name = str(q.get('name') or '').strip()[:60] or 'Passkey'
    c.execute('INSERT INTO pl_passkeys VALUES(?,?,?,?,?,?,?,NULL)', (key_id, user['id'], json.dumps(key), key['alg'], parsed['count'], name, _stamp()))
    _record(c, user, 'account.passkey.added', {'name': name})
    return {'ok': True}


def passkey_user(c, q, ctx, require):
    """The account a passkey signs in to, or an error."""
    _client_data(q.get('clientDataJSON'), 'webauthn.get', ctx, require)
    row = c.execute('SELECT * FROM pl_passkeys WHERE id=?', (str(q.get('id') or ''),)).fetchone()
    require(row is not None, 'This passkey is not on a ParishLife account. Sign in with your password, then add it in My account.', 401)
    data = unb64u(q.get('authenticatorData'))
    parsed = _authenticator_data(data, require)
    require(parsed['rpIdHash'] == hashlib.sha256(ctx['rpId'].encode()).digest() and parsed['flags'] & 1, FAILED, 401)
    if q.get('userHandle'):
        require(unb64u(q['userHandle']).decode(errors='replace') == row['user_id'], FAILED, 401)
    signed = data + hashlib.sha256(unb64u(q.get('clientDataJSON'))).digest()
    require(_signature_valid(json.loads(row['public_key']), unb64u(q.get('signature')), signed), FAILED, 401)
    # A counter that goes backwards means a copied authenticator.
    require(not (parsed['count'] and row['sign_count'] and parsed['count'] <= row['sign_count']), FAILED, 401)
    c.execute('UPDATE pl_passkeys SET sign_count=?,last_used_at=? WHERE id=?', (parsed['count'], _stamp(), row['id']))
    return row['user_id']


def account_passkeys(c, user, path, method, q, ctx, require):
    if path == '/api/account/passkeys' and method == 'GET':
        rows = c.execute('SELECT id,name,created_at,last_used_at FROM pl_passkeys WHERE user_id=? ORDER BY created_at', (user['id'],)).fetchall()
        return {'passkeys': [dict(row) for row in rows]}
    if path == '/api/account/passkeys' and method == 'POST':
        return passkey_add(c, user, q, ctx, require)
    if path == '/api/account/passkeys/remove' and method == 'POST':
        row = c.execute('SELECT name FROM pl_passkeys WHERE id=? AND user_id=?', (str(q.get('id') or ''), user['id'])).fetchone()
        require(row is not None, 'Passkey not found.', 404)
        c.execute('DELETE FROM pl_passkeys WHERE id=? AND user_id=?', (q['id'], user['id']))
        _record(c, user, 'account.passkey.removed', {'name': row['name']})
        return {'ok': True}
    return None
