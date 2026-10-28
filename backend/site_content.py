"""Homepage content: edited by the super administrator, read by the public site.

Every block is bilingual. Empty text falls back to the homepage's built-in wording,
and a block with published=False stays a draft that only the editor sees."""
import json
import re
import secrets
from . import workspace as w

SECTIONS = ('week', 'map', 'requests', 'times', 'news', 'stories', 'verse', 'about', 'join')
BLOCKS = {'hero': {'title': 140, 'subtitle': 320},
          'announcement': {'text': 280, 'linkLabel': 60},
          'about': {'title': 140, 'body': 2400},
          'join': {'title': 140, 'body': 600}}
LINK = re.compile(r'https://\S{1,490}|#[A-Za-z][A-Za-z0-9_-]{0,60}|/(?![/\\])[^\s\\]{0,200}|public\.html\S{0,200}')
IMAGE = re.compile(r'https://\S{1,1990}|assets/images/[A-Za-z0-9_-]{1,80}\.(?:jpg|jpeg|png|webp)')
STORY_ID = re.compile(r'[a-z0-9-]{1,40}')


def empty():
    data = {name: {field: {'en': '', 'ar': ''} for field in fields} for name, fields in BLOCKS.items()}
    data['announcement'].update(link='', published=False)
    data['about']['published'] = True
    data['join']['published'] = True
    data['stories'] = []
    data['sections'] = {key: True for key in SECTIONS}
    return data


def stored(c):
    row = c.execute("SELECT revision,data FROM pl_site_content WHERE key='homepage'").fetchone()
    return (row['revision'], {**empty(), **json.loads(row['data'])}) if row else (0, empty())


def text(value, limit, require):
    value = value if isinstance(value, dict) else {}
    result = {lang: str(value.get(lang) or '').strip() for lang in ('en', 'ar')}
    require(all(len(v) <= limit for v in result.values()), f'Keep each homepage field within {limit:,} characters.')
    return result


def address(value, pattern, message, require):
    value = str(value or '').strip()
    require(not value or pattern.fullmatch(value), message)
    return value


def clean(q, require):
    require(isinstance(q, dict), 'Homepage content is missing.')
    data = {}
    for name, fields in BLOCKS.items():
        block = q.get(name) if isinstance(q.get(name), dict) else {}
        data[name] = {field: text(block.get(field), limit, require) for field, limit in fields.items()}
        if name != 'hero':
            data[name]['published'] = block.get('published') is True
        if name == 'announcement':
            data[name]['link'] = address(block.get('link'), LINK, 'Use an HTTPS link, a page path or a section link such as #map.', require)
    stories = q.get('stories', [])
    require(isinstance(stories, list) and len(stories) <= 8, 'Add up to eight stories.')
    data['stories'] = []
    for story in stories:
        require(isinstance(story, dict), 'Each story needs a title.')
        sid = str(story.get('id') or '') or secrets.token_hex(6)
        require(STORY_ID.fullmatch(sid), 'A story identifier is invalid.')
        item = {'id': sid, 'title': text(story.get('title'), 120, require), 'body': text(story.get('body'), 600, require),
                'image': address(story.get('image'), IMAGE, 'Use an HTTPS image link for each story.', require),
                'link': address(story.get('link'), LINK, 'Use an HTTPS link, a page path or a section link for each story.', require),
                'published': story.get('published') is True}
        require(item['title']['en'] or item['title']['ar'], 'Give each story a title in English or Arabic.')
        data['stories'].append(item)
    require(len({s['id'] for s in data['stories']}) == len(data['stories']), 'Story identifiers must be unique.')
    sections = q.get('sections') if isinstance(q.get('sections'), dict) else {}
    data['sections'] = {key: sections.get(key, True) is not False for key in SECTIONS}
    return data


def public(data):
    """The published projection: drafts and unpublished stories never leave the server."""
    result = {'hero': data['hero'], 'sections': data['sections'],
              'stories': [{k: s[k] for k in ('id', 'title', 'body', 'image', 'link')} for s in data['stories'] if s.get('published')]}
    note = data['announcement']
    if note.get('published') and (note['text']['en'] or note['text']['ar']):
        result['announcement'] = {k: v for k, v in note.items() if k != 'published'}
    # About and Join keep their built-in wording when published empty; unpublished hides them.
    for name in ('about', 'join'):
        if data[name].get('published'):
            result[name] = {k: v for k, v in data[name].items() if k != 'published'}
    return result


def handle(c, user, path, method, q, require):
    if path == '/api/public/site' and method == 'GET':
        return public(stored(c)[1])
    if path != '/api/workspace/site-content' or user is None:
        return None
    require(w.is_super_admin(c, user), 'Only the super administrator edits the homepage.', 403)
    revision, data = stored(c)
    if method == 'GET':
        return {'revision': revision, 'content': data}
    require(method == 'PUT', 'Method not allowed.', 405)
    sent = q.get('revision')
    require(isinstance(sent, (int, float)) and not isinstance(sent, bool) and sent == revision,
            'The homepage changed since you opened it. Reopen the editor before saving.', 409)
    content = clean(q.get('content'), require)
    c.execute("INSERT INTO pl_site_content VALUES('homepage',?,?,?,?) ON CONFLICT(key) DO UPDATE SET "
              "data=excluded.data,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
              (json.dumps(content), revision + 1, user['id'], w.now()))
    w.history(c, user, '*', 'site.homepage.updated', {'revision': revision + 1})
    return {'ok': True, 'revision': revision + 1}
