"""Personal signatures for parish staff; the same as cloudflare/src/signatures.js.

A person's handwritten signature is kept with one of their own passkeys. Nothing is signed unless
that person unlocks that passkey (face, fingerprint or PIN) over a fingerprint of the exact
content being signed, so a signature cannot be made by anyone else, nor moved to another
document. The proof (the passkey's signature and its public key) is kept with each signature,
which anyone can check at public.html?verify=CODE: who signed, when, and whether the document
still matches what was signed."""
import datetime as dt
import hashlib
import json
import re
import secrets

from . import workspace as w
from .sign_in import assertion, b64u, unb64u, _signature_valid

PATH = re.compile(r'[MLQCZmlqcz0-9 .,\-]{8,30000}')
ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'   # no 0/O, 1/I/L or U to misread
FAILED = 'The signature could not be checked. Try again.'


def canonical(payload):
    return json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def fingerprint(payload):
    return hashlib.sha256(canonical(payload).encode()).hexdigest()


def challenge(digest, nonce):
    return b64u(hashlib.sha256(f'{digest}|{nonce}'.encode()).digest())


def new_code():
    return '-'.join(''.join(secrets.choice(ALPHABET) for _ in range(4)) for _ in range(3))


def context(ctx, digest):
    """The passkey context for one document: its challenge binds the fingerprint to this request."""
    return {**ctx, 'challenge': challenge(digest, ctx['nonce']) if ctx.get('nonce') else ''}


# ---------- what is signed ----------
def certificate_payload(pid, d, s):
    source = next((x for x in d.get('SACRAMENTS', []) if x.get('id') == s.get('sourceRecordId')), None) or {}
    person = next((p for p in d.get('PEOPLE', []) if p.get('id') == (source.get('person') or s.get('person'))), None) or {}
    return {'v': 1, 'type': 'certificate', 'parish': pid, 'id': str(s.get('id', '')), 'reg': str(s.get('reg', '')),
            'kind': str(source.get('kind', '')), 'source': str(source.get('reg', '')), 'date': str(source.get('date', '')),
            'book': str(source.get('book', '')), 'page': str(source.get('page', '')),
            'person': str(person.get('lat', '')), 'personAr': str(person.get('ar', ''))}


def letter_payload(pid, request_id, title, body, user_id, day):
    return {'v': 1, 'type': 'letter', 'parish': pid, 'request': request_id, 'title': title, 'body': body, 'signer': user_id, 'date': day}


def signer_payload(user_id, drawing):
    return {'v': 1, 'type': 'signer', 'user': user_id, 'drawing': hashlib.sha256(drawing.encode()).hexdigest()}


# ---------- who may sign ----------
def office_context(c, user, pid):
    context = w.parish_context(c, user, pid)
    return context if context and (w.is_office(context) or w.has_clergy(context)) else None


def eligible(c, user):
    return any(office_context(c, user, row['id']) for row in c.execute('SELECT id FROM parishes'))


def signer(c, user):
    row = c.execute('SELECT * FROM pl_signers WHERE user_id=?', (user['id'],)).fetchone()
    if row and not c.execute('SELECT 1 FROM pl_passkeys WHERE id=? AND user_id=?', (row['credential_id'], user['id'])).fetchone():
        return None   # the passkey it was kept with was removed: the signature must be set up again
    return row


def _proof(row, q, nonce, drawing):
    # The drawing is kept as it was when signing, so changing one's signature later leaves past documents as signed.
    return {'id': row['id'], 'publicKey': json.loads(row['public_key']), 'nonce': nonce, 'drawing': drawing,
            **{k: str(q.get(k) or '') for k in ('clientDataJSON', 'authenticatorData', 'signature')}}


def _record(c, user, pid, kind, doc_id, title, digest, signer_row, proof):
    code = new_code()
    c.execute('INSERT INTO pl_signatures VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL)',
              (code, pid, kind, doc_id, title[:200], digest, user['id'], user['name'], signer_row['title'] or '',
               signer_row['credential_id'], json.dumps(proof), w.now()))
    w.history(c, user, pid, 'signature.made', {'code': code, 'document': kind, 'id': doc_id})
    return code


def _stamp(c, code):
    """What a signed document shows: the drawing, the name and title, the time and the code."""
    row = c.execute('SELECT * FROM pl_signatures WHERE code=?', (code,)).fetchone()
    return {'code': code, 'name': row['signer_name'], 'role': row['signer_role'], 'drawing': json.loads(row['proof']).get('drawing') or '', 'signedAt': row['signed_at']}


def sign_certificate(c, user, pid, d, s, q, require):
    """Called by the priest's issue step with the passkey's answer: signs exactly this certificate."""
    me = signer(c, user)
    require(me is not None, 'Set up your signature in My account before signing.', 403)
    digest = fingerprint(certificate_payload(pid, d, s))
    ctx = context(q.get('_signContext') or {}, digest)
    row = assertion(c, q.get('signature') or {}, ctx, require, user_id=user['id'], credential=me['credential_id'], verified=True)
    code = _record(c, user, pid, 'certificate', str(s['id']), str(s.get('reg', '')), digest, me, _proof(row, q.get('signature') or {}, ctx['nonce'], me['drawing']))
    s['signature'] = _stamp(c, code)
    return code


def letters(c, request_id):
    rows = c.execute('SELECT l.*,p.metadata FROM pl_letters l JOIN parishes p ON p.id=l.parish_id WHERE l.request_id=? ORDER BY l.created_at', (request_id,)).fetchall()
    return [{**dict(title=row['title'], body=row['body'], createdAt=row['created_at'], parish=_letterhead(row['metadata'])), **_stamp(c, row['signature_code'])}
            for row in rows]


def _letterhead(metadata):
    meta = json.loads(metadata)
    return {k: str(meta.get(k) or '') for k in ('name', 'ar', 'town')}


def verify(c, code):
    code = re.sub(r'[^0-9A-Z]', '', str(code).upper())
    code = '-'.join(code[i:i + 4] for i in range(0, len(code), 4))
    row = c.execute('SELECT * FROM pl_signatures WHERE code=?', (code,)).fetchone()
    if row is None:
        return {'found': False}
    meta = json.loads(c.execute('SELECT metadata FROM parishes WHERE id=?', (row['parish_id'],)).fetchone()['metadata'])
    proof = json.loads(row['proof'])
    data = unb64u(proof.get('authenticatorData'))
    client = unb64u(proof.get('clientDataJSON'))
    try:
        said = json.loads(client).get('challenge')
    except ValueError:
        said = None
    signed = said == challenge(row['digest'], proof.get('nonce', '')) and _signature_valid(proof.get('publicKey', {}), unb64u(proof.get('signature')), data + hashlib.sha256(client).digest())
    matches, reference, subject = None, '', ''
    if row['document_type'] == 'certificate':
        state = c.execute('SELECT data FROM states WHERE parish_id=?', (row['parish_id'],)).fetchone()
        d = json.loads(state['data']) if state else {}
        s = next((x for x in d.get('SACRAMENTS', []) if str(x.get('id')) == row['document_id']), None)
        if s is not None:
            payload = certificate_payload(row['parish_id'], d, s)
            matches = fingerprint(payload) == row['digest']
            reference = payload['source'] or payload['reg']
            subject = ' '.join(part[0] + '.' for part in payload['person'].split() if part)
    elif row['document_type'] == 'letter':
        letter = c.execute('SELECT * FROM pl_letters WHERE signature_code=?', (code,)).fetchone()
        if letter is not None:
            matches = fingerprint(letter_payload(row['parish_id'], letter['request_id'], letter['title'], letter['body'], row['signer_id'], letter['created_at'][:10])) == row['digest']
    return {'found': True, 'code': code, 'type': row['document_type'], 'title': row['title'], 'reference': reference, 'subject': subject,
            'parish': {'name': meta.get('name', ''), 'ar': meta.get('ar', ''), 'town': meta.get('town', '')},
            'signer': row['signer_name'], 'role': row['signer_role'], 'signedAt': row['signed_at'], 'revokedAt': row['revoked_at'] or '',
            'fingerprint': ' '.join(row['digest'][i:i + 4] for i in range(0, 24, 4)).upper(), 'signatureValid': bool(signed), 'contentMatches': matches}


def options(c, user, q, ctx, require):
    """WebAuthn options for signing one thing; the challenge is the thing's fingerprint."""
    kind = q.get('type')
    if kind == 'setup':
        drawing = str(q.get('drawing') or '')
        require(PATH.fullmatch(drawing), 'Draw your signature first.')
        digest = fingerprint(signer_payload(user['id'], drawing))
        allow = [row['id'] for row in c.execute('SELECT id FROM pl_passkeys WHERE user_id=?', (user['id'],))]
        require(allow, 'Add a passkey on this device first: your signature is kept with it.', 403)
    else:
        me = signer(c, user)
        require(me is not None, 'Set up your signature in My account before signing.', 403)
        pid = str(q.get('parish') or '')
        require(office_context(c, user, pid), 'Only the parish office can sign for this parish.', 403)
        if kind == 'certificate':
            row = c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()
            require(row is not None, 'Parish not found.', 404)
            d = json.loads(row['data'])
            s = next((x for x in d['SACRAMENTS'] if x.get('id') == q.get('id')), None)
            require(s is not None and s.get('kind') == 'certificate' and s.get('status') == 'approved', 'Approve the certificate before signing it.')
            require(w.has_clergy(office_context(c, user, pid)), 'Only the parish priest signs certificates.', 403)
            digest = fingerprint(certificate_payload(pid, d, s))
        elif kind == 'letter':
            digest = fingerprint(letter_payload(pid, str(q.get('request') or ''), *_letter_text(q, require), user['id'], w.now()[:10]))
        else:
            require(False, 'Choose what to sign.')
        allow = [me['credential_id']]
    nonce = secrets.token_urlsafe(24)
    return {'challenge': challenge(digest, nonce), 'rpId': ctx['rpId'], 'timeout': 120000, 'userVerification': 'required',
            'allowCredentials': [{'type': 'public-key', 'id': a} for a in allow], 'fingerprint': digest[:24].upper()}, nonce


def _letter_text(q, require):
    title, body = str(q.get('title') or '').strip(), str(q.get('body') or '').strip()
    require(3 <= len(title) <= 160, 'Give the letter a title (3–160 characters).')
    require(10 <= len(body) <= 6000, 'Write the letter (10–6,000 characters).')
    return title, body


def handle(c, user, path, method, q, ctx, require):
    if path == '/api/account/signature' and method == 'GET':
        me = signer(c, user)
        key = c.execute('SELECT name FROM pl_passkeys WHERE id=?', (me['credential_id'],)).fetchone() if me else None
        return {'eligible': eligible(c, user), 'passkeys': c.execute('SELECT COUNT(*) FROM pl_passkeys WHERE user_id=?', (user['id'],)).fetchone()[0],
                'signer': {'drawing': me['drawing'], 'title': me['title'], 'passkey': key['name'] if key else '', 'updatedAt': me['updated_at']} if me else None}
    if path == '/api/account/signature' and method == 'POST':
        require(eligible(c, user), 'Signatures are for parish staff.', 403)
        drawing, title = str(q.get('drawing') or ''), str(q.get('title') or '').strip()[:80]
        require(PATH.fullmatch(drawing), 'Draw your signature first.')
        digest = fingerprint(signer_payload(user['id'], drawing))
        row = assertion(c, q.get('signature') or {}, context(ctx, digest), require, user_id=user['id'], verified=True)
        stamp = w.now()
        c.execute('INSERT INTO pl_signers VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET drawing=excluded.drawing,title=excluded.title,credential_id=excluded.credential_id,updated_at=excluded.updated_at',
                  (user['id'], drawing, title, row['id'], stamp, stamp))
        w.history(c, user, '*', 'signature.set-up', {'passkey': row['name']})
        return {'ok': True}
    if path == '/api/account/signature/remove' and method == 'POST':
        c.execute('DELETE FROM pl_signers WHERE user_id=?', (user['id'],))
        w.history(c, user, '*', 'signature.removed', {})
        return {'ok': True}
    if path == '/api/sign/letter' and method == 'POST':
        pid, request_id = str(q.get('parish') or ''), str(q.get('request') or '')
        require(office_context(c, user, pid), 'Only the parish office can sign for this parish.', 403)
        request = c.execute('SELECT * FROM pl_guest_requests WHERE id=? AND parish_id=?', (request_id, pid)).fetchone()
        require(request is not None, 'Request not found.', 404)
        me = signer(c, user)
        require(me is not None, 'Set up your signature in My account before signing.', 403)
        title, body = _letter_text(q, require)
        stamp = w.now()
        digest = fingerprint(letter_payload(pid, request_id, title, body, user['id'], stamp[:10]))
        sign_ctx = context(ctx, digest)
        row = assertion(c, q.get('signature') or {}, sign_ctx, require, user_id=user['id'], credential=me['credential_id'], verified=True)
        code = _record(c, user, pid, 'letter', request_id, title, digest, me, _proof(row, q.get('signature') or {}, sign_ctx['nonce'], me['drawing']))
        c.execute('INSERT INTO pl_letters VALUES(?,?,?,?,?,?,?)', (secrets.token_hex(12), pid, request_id, title, body, code, stamp))
        c.execute("UPDATE pl_guest_requests SET status=CASE WHEN status IN ('closed') THEN status ELSE 'ready-for-download' END,updated_at=? WHERE id=?", (stamp, request_id))
        return {'ok': True, 'code': code}
    if path == '/api/sign/revoke' and method == 'POST':
        row = c.execute('SELECT * FROM pl_signatures WHERE code=?', (str(q.get('code') or ''),)).fetchone()
        require(row is not None, 'Signature not found.', 404)
        require(row['signer_id'] == user['id'] or w.is_super_admin(c, user), 'Only the person who signed can withdraw a signature.', 403)
        reason = str(q.get('reason') or '').strip()
        require(3 <= len(reason) <= 500, 'Say why the signature is withdrawn (3–500 characters).')
        c.execute('UPDATE pl_signatures SET revoked_at=? WHERE code=? AND revoked_at IS NULL', (w.now(), row['code']))
        w.history(c, user, row['parish_id'], 'signature.revoked', {'code': row['code'], 'reason': reason})
        return {'ok': True}
    return None
