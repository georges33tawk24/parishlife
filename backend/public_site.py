"""The public site's shared data, the same as cloudflare/src/public-site.js: which events and
posts a parish has made public, one overview of every parish for the homepage, the parish
calendar as a feed calendars can subscribe to, and the link previews of public pages."""
import datetime as dt
import html
import json
import re
from urllib.parse import quote

# The public parish profile: contact, visit and follow details edited by the parish office.
VISIT_KEYS = ('email', 'officeHours', 'confessionTimes', 'accessibility', 'latitude', 'longitude', 'website',
              'parking', 'languages', 'expect', 'feastName', 'feastDate', 'livestream', 'whatsapp', 'sacramentNotes')
PROFILE_KEYS = ('phone', 'email', 'address', 'officeHours', 'confessionTimes', 'accessibility', 'website', 'latitude', 'longitude',
                'parking', 'languages', 'expect', 'feastName', 'feastDate', 'livestream', 'whatsapp', 'sacramentNotes')
KINDS = {'mass': ('Mass', 'قدّاس'), 'sacr': ('Sacrament', 'سرّ'), 'group': ('Group', 'لقاء جماعة'), 'event': ('Parish event', 'حدث رعوي'),
         'wedding': ('Wedding', 'إكليل'), 'baptism': ('Baptism', 'معمودية'), 'funeral': ('Funeral', 'جنّاز')}
MONTHS = (('January', 'كانون الثاني'), ('February', 'شباط'), ('March', 'آذار'), ('April', 'نيسان'), ('May', 'أيار'), ('June', 'حزيران'),
          ('July', 'تموز'), ('August', 'آب'), ('September', 'أيلول'), ('October', 'تشرين الأول'), ('November', 'تشرين الثاني'), ('December', 'كانون الأول'))
DAYS = (('Monday', 'الإثنين'), ('Tuesday', 'الثلاثاء'), ('Wednesday', 'الأربعاء'), ('Thursday', 'الخميس'), ('Friday', 'الجمعة'),
        ('Saturday', 'السبت'), ('Sunday', 'الأحد'))
DATE = re.compile(r'\d{4}-\d{2}-\d{2}')
TIME = re.compile(r'\d{2}:\d{2}')


def check_profile(values, require):
    """The follow and visit details that are links or dates must be well formed."""
    for key in ('livestream', 'whatsapp'):
        require(not values[key] or re.fullmatch(r'https://[^\s]+', values[key]), 'Use HTTPS links for the livestream and WhatsApp.')
    require(not values['whatsapp'] or re.fullmatch(r'https://(chat\.whatsapp\.com|whatsapp\.com|www\.whatsapp\.com|wa\.me)/[^\s]+', values['whatsapp']),
            'Use a WhatsApp channel, group or wa.me link.')
    if values['feastDate']:
        try:
            dt.date.fromisoformat('2024-' + values['feastDate'])
        except ValueError:
            require(False, 'Write the feast day as month and day, for example 07-20.')


def published_content(state):
    return {key: {'en': item.get('en', ''), 'ar': item.get('ar', '')}
            for key, item in state.get('CONTENT', {}).items() if isinstance(item, dict) and item.get('published', True)}


def public_events(state):
    events = []
    for event in state.get('EVENTS', []):
        detail = state.get('EVENT_DETAIL', {}).get(event.get('id'), {})
        if event.get('kind') == 'pending' or (detail.get('visibility') != 'public'
                                              and not (not detail and event.get('kind') in {'mass', 'event'})):
            continue
        events.append({key: event.get(key, '') for key in ('id', 'd', 't', 'title', 'titleAr', 'kind')})
    return events


def notices(state):
    return [dict(title=n.get('title', ''), body=n.get('ar', ''), at=n.get('at', ''))
            for n in state.get('NOTICES', []) if n.get('audience') == 'Parish' and not n.get('groupId')]


def overview(c, default_plan):
    """What the homepage shows of every parish, in one answer: no clergy, ministries or galleries."""
    today = dt.date.today()
    first, last = (today - dt.timedelta(days=7)).isoformat(), (today + dt.timedelta(days=120)).isoformat()
    parishes = [dict(id=row['id'], name=meta.get('name', ''), ar=meta.get('ar', ''), town=meta.get('town', ''),
                     townAr=meta.get('townAr', ''), diocese=row['diocese'])
                for row in c.execute('SELECT p.id,p.metadata,d.name AS diocese FROM parishes p JOIN dioceses d ON d.id=p.diocese')
                for meta in [json.loads(row['metadata'])]]
    states = {row['parish_id']: json.loads(row['data']) for row in c.execute('SELECT parish_id,data FROM states')}
    plans = {row['parish_id']: json.loads(row['data']) for row in c.execute('SELECT parish_id,data FROM pl_plans')}
    posts = {}
    for row in c.execute("SELECT parish_id,title,body,created_at FROM (SELECT parish_id,title,body,created_at,ROW_NUMBER() OVER "
                         "(PARTITION BY parish_id ORDER BY created_at DESC) AS n FROM member_content WHERE group_id IS NULL "
                         "AND kind IN ('post','announcement')) WHERE n<=8 ORDER BY created_at DESC"):
        posts.setdefault(row['parish_id'], []).append(dict(title=row['title'], body=row['body'], at=row['created_at']))
    details = {}
    for p in parishes:
        state = states.get(p['id'])
        if state is None:
            continue
        parish = state.get('PARISH', {})
        details[p['id']] = {
            'parish': {k: parish.get(k, '') for k in ('name', 'nameAr', 'town', 'townAr', 'rite', 'riteAr')},
            'content': {k: v for k, v in published_content(state).items() if k == 'massTimes'},
            'events': [e for e in public_events(state) if isinstance(e['d'], str) and first <= e['d'] <= last],
            'posts': sorted(posts.get(p['id'], []) + notices(state), key=lambda item: item['at'], reverse=True)[:8],
            'parishPhoto': state.get('PHOTOS', {}).get('parish', ''), 'gallery': parish.get('gallery', [])[:1],
            'publicRequests': plans.get(p['id'], default_plan).get('publicRequests', True),
            'visit': {k: parish.get(k, '') for k in ('latitude', 'longitude', 'livestream')}}
    return {'parishes': parishes, 'details': details}


# ---------- calendar feed ----------
TIMEZONE = ['BEGIN:VTIMEZONE', 'TZID:Asia/Beirut', 'X-LIC-LOCATION:Asia/Beirut',
            'BEGIN:STANDARD', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'TZNAME:EET', 'DTSTART:19701025T000000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
            'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'TZNAME:EEST', 'DTSTART:19700329T000000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
            'END:VTIMEZONE']


def _text(value):
    return re.sub(r'[\\,;]', lambda m: '\\' + m.group(0), str(value)).replace('\r\n', '\\n').replace('\n', '\\n')


def _fold(line):
    """Lines of at most 75 octets, continued with a space (RFC 5545)."""
    out, current = [], b''
    for ch in line:
        piece = ch.encode()
        if len(current) + len(piece) > (75 if not out else 74):
            out.append(current)
            current = b''
        current += piece
    out.append(current)
    return '\r\n '.join(part.decode() for part in out)


def _title(event, ar):
    title = (event.get('titleAr') or event.get('title')) if ar else (event.get('title') or event.get('titleAr'))
    return title or KINDS.get(event.get('kind'), KINDS['event'])[1 if ar else 0]


def calendar_feed(c, pid, origin, ar, require):
    row = c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone()
    require(row is not None, 'Parish not found.', 404)
    state = json.loads(row['data'])
    parish = state.get('PARISH', {})
    name = (parish.get('nameAr') or parish.get('name')) if ar else (parish.get('name') or parish.get('nameAr'))
    town = (parish.get('townAr') or parish.get('town')) if ar else (parish.get('town') or parish.get('townAr'))
    place = ('، ' if ar else ', ').join(v for v in (name, town) if v)
    since = (dt.date.today() - dt.timedelta(days=60)).isoformat()
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ParishLife//Parish calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
             'X-WR-CALNAME:' + _text(name or 'ParishLife'), 'X-WR-TIMEZONE:Asia/Beirut', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H', *TIMEZONE]
    for event in public_events(state):
        day = str(event.get('d') or '')
        if not DATE.fullmatch(day) or day < since:
            continue
        clock = str(event.get('t') or '')
        try:
            start = dt.datetime.fromisoformat(day + 'T' + clock) if TIME.fullmatch(clock) else dt.date.fromisoformat(day)
        except ValueError:
            continue
        if isinstance(start, dt.datetime):
            end = start + dt.timedelta(hours=1)
            when = ['DTSTART;TZID=Asia/Beirut:' + start.strftime('%Y%m%dT%H%M%S'), 'DTEND;TZID=Asia/Beirut:' + end.strftime('%Y%m%dT%H%M%S')]
        else:
            when = ['DTSTART;VALUE=DATE:' + start.strftime('%Y%m%d'), 'DTEND;VALUE=DATE:' + (start + dt.timedelta(days=1)).strftime('%Y%m%d')]
        lines += ['BEGIN:VEVENT', f"UID:{event.get('id') or day + clock}@parishlife", 'DTSTAMP:' + stamp, *when,
                  'SUMMARY:' + _text(_title(event, ar)), *(['LOCATION:' + _text(place)] if place else []),
                  f"URL:{origin}/public.html?parish={quote(pid)}&event={quote(str(event.get('id') or ''))}", 'END:VEVENT']
    lines.append('END:VCALENDAR')
    return '\r\n'.join(_fold(line) for line in lines) + '\r\n'


# ---------- link previews ----------
def _plain(text, limit=180):
    text = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', str(text or '')))).strip()
    return text if len(text) <= limit else text[:limit - 1].rsplit(' ', 1)[0] + '…'


def _day(day, clock, ar):
    date = dt.date.fromisoformat(day)
    if ar:
        text = f'{DAYS[date.weekday()][1]} {date.day} {MONTHS[date.month - 1][1]} {date.year}'
        return text + (f'، الساعة {clock}' if clock else '')
    return f'{DAYS[date.weekday()][0]} {date.day} {MONTHS[date.month - 1][0]} {date.year}' + (f', {clock}' if clock else '')


def share_meta(c, query, origin):
    """The title, description, picture and structured data a shared parish or event link shows."""
    pid = (query.get('parish') or [''])[0]
    ar = (query.get('lang') or [''])[0] == 'ar'
    row = c.execute('SELECT data FROM states WHERE parish_id=?', (pid,)).fetchone() if pid else None
    if row is None:
        return None
    state = json.loads(row['data'])
    parish = state.get('PARISH', {})
    pick = lambda en, other: (parish.get(other) or parish.get(en)) if ar else (parish.get(en) or parish.get(other))
    name, town = pick('name', 'nameAr') or pid, pick('town', 'townAr')
    photos = [state.get('PHOTOS', {}).get('parish', ''), *parish.get('gallery', [])]
    image = next((p for p in photos if isinstance(p, str) and p.startswith('https://')), origin + '/assets/images/og-home.jpg')
    url = f'{origin}/public.html?parish={quote(pid)}'
    address = {'@type': 'PostalAddress', 'addressCountry': 'LB', **({'addressLocality': town} if town else {}),
               **({'streetAddress': parish.get('address')} if parish.get('address') else {})}
    event_id = (query.get('event') or [''])[0]
    event = next((e for e in public_events(state) if e['id'] and e['id'] == event_id and DATE.fullmatch(str(e['d']))), None) if event_id else None
    if event:
        title, clock = _title(event, ar), str(event['t']) if TIME.fullmatch(str(event['t'])) else ''
        place = ('، ' if ar else ', ').join(v for v in (name, town) if v)
        description = (f'{_day(event["d"], clock, ar)} في {place}. أضفها إلى رزنامتك على ParishLife.' if ar
                       else f'{_day(event["d"], clock, ar)} at {place}. Add it to your calendar on ParishLife.')
        data = {'@context': 'https://schema.org', '@type': 'Event', 'name': title, 'startDate': event['d'] + (f'T{clock}:00' if clock else ''),
                'eventStatus': 'https://schema.org/EventScheduled', 'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
                'location': {'@type': 'Place', 'name': name, 'address': address}, 'image': [image], 'description': description,
                'organizer': {'@type': 'Organization', 'name': name, 'url': url}, 'url': f'{url}&event={quote(event_id)}'}
        return {'title': f'{title} · {name}', 'description': description, 'image': image, 'url': data['url'], 'type': 'article', 'data': data}
    welcome = published_content(state).get('welcome', {})
    lede = _plain((welcome.get('ar') or welcome.get('en')) if ar else (welcome.get('en') or welcome.get('ar')))
    description = lede or (f'مواعيد القداديس والمناسبات والأخبار في رعية {name}' + (f' في {town}' if town else '') + '، وطلبات إلى مكتب الرعية.' if ar
                           else f'Mass times, events and news from {name}' + (f' in {town}' if town else '') + ', and requests to the parish office.')
    data = {'@context': 'https://schema.org', '@type': 'Church', 'name': name, 'url': url, 'image': image, 'address': address,
            **({'telephone': parish.get('phone')} if parish.get('phone') else {})}
    if parish.get('latitude') and parish.get('longitude'):
        data['geo'] = {'@type': 'GeoCoordinates', 'latitude': parish['latitude'], 'longitude': parish['longitude']}
    return {'title': f'{name}' + (f', {town}' if town and not ar else f'، {town}' if town else '') + ' · ParishLife',
            'description': description, 'image': image, 'url': url, 'type': 'website', 'data': data}


def share_page(page, meta, origin, analytics=''):
    """public.html with the preview tags of the link, every address absolute."""
    attr = lambda v: html.escape(str(v), quote=True)
    def content(pattern, value):
        nonlocal page
        page = re.sub(r'(<meta ' + pattern + r' content=")[^"]*(")', lambda m: m.group(1) + attr(value) + m.group(2), page, count=1)
    if meta:
        page = re.sub(r'<title>[^<]*</title>', lambda m: '<title>' + attr(meta['title']) + '</title>', page, count=1)
        content(r'name="description"', meta['description'])
        content(r'property="og:type"', meta['type'])
        content(r'property="og:title"', meta['title'])
        content(r'property="og:description"', meta['description'])
        content(r'property="og:image"', meta['image'])
    else:
        content(r'property="og:image"', origin + '/assets/images/og-home.jpg')
    extra = f'  <meta property="og:url" content="{attr(meta["url"] if meta else origin + "/")}">\n'
    if meta:
        extra += '  <script type="application/ld+json">' + json.dumps(meta['data'], ensure_ascii=False).replace('<', '\\u003c') + '</script>\n'
    if analytics:
        extra += f'  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{{"token": "{attr(analytics)}"}}\'></script>\n'
    return page.replace('</head>', extra + '</head>', 1)
