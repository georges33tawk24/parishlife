"""End-to-end state write checks against an isolated SQLite database."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

import server


class ParishPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_db = server.DB
        server.DB = Path(self.temp.name) / 'test.sqlite3'
        server.init_db()
        self.users = {}
        with server.connect() as c:
            for role, person_id in [('priest', 'p17'), ('secretary', 'p4'), ('leader', 'p3'), ('bishop', None)]:
                user = dict(id='test-' + role, username='test-' + role, name='Test ' + role,
                            role=role, diocese='beirut', person_id=person_id)
                c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',
                          (user['id'], user['username'], user['name'], role, 'beirut', person_id, 'test-hash'))
                if role != 'bishop':
                    c.execute('INSERT INTO assignments VALUES(?,?)', (user['id'], 'p-elias'))
                self.users[role] = user

    def tearDown(self):
        server.DB = self.original_db
        self.temp.cleanup()

    def state(self, parish='p-elias'):
        with server.connect() as c:
            row = c.execute('SELECT revision,data FROM states WHERE parish_id=?', (parish,)).fetchone()
            return row['revision'], json.loads(row['data'])

    def patch(self, role, key, value, parish='p-elias'):
        revision, _ = self.state(parish)
        with server.connect() as c:
            return server.save_patch(c, self.users[role], parish,
                                     dict(revision=revision, changes={key: value}))

    def test_clergy_note_persists_and_is_hidden_from_secretary(self):
        _, state = self.state()
        items = copy.deepcopy(state['NOTES'])
        items.append(dict(id='test-follow-up', kind='task', p=None, at='2026-09-28',
                          body='Call family', bodyAr='اتصال بالعائلة', priority='urgent',
                          pinned=True, done=False, due='2026-10-01'))
        self.patch('priest', 'NOTES', items)
        _, saved = self.state()
        self.assertEqual(saved['NOTES'][-1]['body'], 'Call family')
        with server.connect() as c:
            self.assertEqual(server.visible(c, self.users['secretary'], 'p-elias', saved)['NOTES'], [])
        with self.assertRaises(server.Problem) as raised:
            self.patch('secretary', 'NOTES', items)
        self.assertEqual(raised.exception.status, 403)

    def test_calendar_template_persists_and_other_parish_is_not_accessible(self):
        _, state = self.state()
        templates = copy.deepcopy(state['EVENT_TEMPLATES'])
        templates.append(dict(id='test-template', name='Community meeting', nameAr='اجتماع الرعية',
                              icon='groups', kind='group', venue='v1', duration=60,
                              description='', capacity=0))
        self.patch('secretary', 'EVENT_TEMPLATES', templates)
        self.assertIn('test-template', {x['id'] for x in self.state()[1]['EVENT_TEMPLATES']})
        with self.assertRaises(server.Problem) as raised:
            self.patch('secretary', 'EVENT_TEMPLATES', templates, parish='p-charbel')
        self.assertEqual(raised.exception.status, 403)

    def test_group_attendance_persists_for_leader_group(self):
        _, state = self.state()
        detail = copy.deepcopy(state['GROUP_DETAIL']['g1'])
        member = detail['roster'][0]['p']
        detail['meetings'][0]['attendance'][member] = 'present'
        self.patch('leader', 'GROUP_DETAIL', {'g1': detail})
        self.assertEqual(self.state()[1]['GROUP_DETAIL']['g1']['meetings'][0]['attendance'][member], 'present')

    def test_new_attendance_is_limited_to_current_group_members(self):
        _, state = self.state()
        detail = copy.deepcopy(state['GROUP_DETAIL']['g1'])
        members = {member['p'] for member in detail['roster']}
        outsider = next(p['id'] for p in state['PEOPLE'] if p['id'] not in members)
        detail['meetings'][0]['attendance'][outsider] = 'present'
        with self.assertRaises(server.Problem):
            self.patch('leader', 'GROUP_DETAIL', {'g1': detail})

    def test_former_member_attendance_is_retained_as_history(self):
        _, state = self.state()
        detail = copy.deepcopy(state['GROUP_DETAIL']['g1'])
        member = detail['roster'][0]['p']
        detail['meetings'][0]['attendance'][member] = 'present'
        self.patch('leader', 'GROUP_DETAIL', {'g1': detail})
        detail['roster'] = [row for row in detail['roster'] if row['p'] != member]
        self.patch('leader', 'GROUP_DETAIL', {'g1': detail})
        saved = self.state()[1]
        self.assertEqual(saved['GROUP_DETAIL']['g1']['meetings'][0]['attendance'][member], 'present')
        with server.connect() as c:
            leader_view = server.visible(c, self.users['leader'], 'p-elias', saved)
        self.assertIn(member, {person['id'] for person in leader_view['PEOPLE']})

    def test_leader_cannot_change_another_group(self):
        _, state = self.state()
        other = next(g['id'] for g in state['GROUPS'] if g.get('leader') != 'p3' and g.get('assistant') != 'p3')
        with self.assertRaises(server.Problem) as raised:
            self.patch('leader', 'GROUP_DETAIL', {other: state['GROUP_DETAIL'].get(other, {})})
        self.assertEqual(raised.exception.status, 403)

    def test_ministry_resource_loans_preserve_inventory_and_history(self):
        _, state = self.state()
        detail = copy.deepcopy(state['GROUP_DETAIL']['g1'])
        resource = detail['belongings'][0]
        detail['resourceLoans'].append(dict(id='loan-test', resourceId=resource['id'], borrower='Choir member',
                                            qty=1, checkedOutAt='2026-10-02', due='2026-10-09', returnedAt=''))
        self.patch('leader', 'GROUP_DETAIL', {'g1': detail})
        self.assertEqual(self.state()[1]['GROUP_DETAIL']['g1']['resourceLoans'][0]['borrower'], 'Choir member')
        detail['resourceLoans'][-1]['qty'] = resource['qty'] + 1
        with self.assertRaises(server.Problem):
            self.patch('leader', 'GROUP_DETAIL', {'g1': detail})
        detail['resourceLoans'][-1]['qty'] = 1
        detail['resourceLoans'][-1]['returnedAt'] = '2026-10-05'
        self.patch('leader', 'GROUP_DETAIL', {'g1': detail})
        self.assertEqual(self.state()[1]['GROUP_DETAIL']['g1']['resourceLoans'][0]['returnedAt'], '2026-10-05')

    def test_formation_completion_is_named_dated_and_group_scoped(self):
        _, state = self.state()
        detail = copy.deepcopy(state['GROUP_DETAIL']['g1'])
        milestone = detail['milestones'][0]
        member = detail['roster'][0]['p']
        milestone['completions'][member] = dict(date='2026-10-02', notes='Completed workshop')
        self.patch('leader', 'GROUP_DETAIL', {'g1': detail})
        saved = self.state()[1]
        self.assertEqual(saved['GROUP_DETAIL']['g1']['milestones'][0]['completions'][member]['notes'], 'Completed workshop')
        self.assertGreaterEqual(saved['GROUP_DETAIL']['g1']['milestones'][0]['legacyCount'], 0)
        outsider = next(p['id'] for p in state['PEOPLE'] if p['id'] not in {r['p'] for r in detail['roster']})
        milestone['completions'][outsider] = dict(date='2026-10-02', notes='')
        with self.assertRaises(server.Problem):
            self.patch('leader', 'GROUP_DETAIL', {'g1': detail})

    def test_music_links_require_correct_https_provider(self):
        _, state = self.state()
        music = copy.deepcopy(state['MUSIC'])
        music[0]['youtubeUrl'] = 'https://www.youtube.com/watch?v=example'
        music[0]['anghamiUrl'] = 'https://play.anghami.com/song/example'
        self.patch('leader', 'MUSIC', music)
        self.assertEqual(self.state()[1]['MUSIC'][0]['youtubeUrl'], music[0]['youtubeUrl'])
        music[0]['youtubeUrl'] = 'javascript:alert(1)'
        with self.assertRaises(server.Problem):
            self.patch('leader', 'MUSIC', music)

    def test_service_plan_changes_do_not_mutate_its_template(self):
        _, state = self.state()
        template = copy.deepcopy(state['SERVICE_TEMPLATES'][0])
        plan = copy.deepcopy(state['SERVICE'])
        plan.update(id='test-plan', title='New Sunday plan', status='draft',
                    order=copy.deepcopy(template['order']))
        self.patch('secretary', 'SERVICE_PLANS', [plan])
        _, saved = self.state()
        updated = copy.deepcopy(saved['SERVICE_PLANS'])
        updated[0]['order'].append(dict(dur='2', t='Welcome', ar='ترحيب', note='', noteAr='', who=None))
        self.patch('secretary', 'SERVICE_PLANS', updated)
        _, after = self.state()
        self.assertEqual(after['SERVICE_PLANS'][0]['order'][-1]['t'], 'Welcome')
        self.assertEqual(after['SERVICE_TEMPLATES'][0], template)

    def test_bishop_has_separate_read_only_projection(self):
        revision, state = self.state()
        with server.connect() as c:
            summary = server.oversight(c, self.users['bishop'])
            self.assertTrue(summary)
            detail = server.oversight(c, self.users['bishop'], 'p-elias')
            self.assertIn('events', detail)
            self.assertNotIn('NOTES', detail)
            with self.assertRaises(server.Problem) as raised:
                server.visible(c, self.users['bishop'], 'p-elias', state)
            self.assertEqual(raised.exception.status, 403)
        with self.assertRaises(server.Problem) as raised:
            self.patch('bishop', 'EVENTS', state['EVENTS'])
        self.assertEqual(raised.exception.status, 403)

    def test_group_event_visibility_is_filtered_on_server(self):
        _, state = self.state()
        event_id = state['EVENTS'][0]['id']
        other_group = next(g['id'] for g in state['GROUPS'] if g.get('leader') != 'p3'
                           and not any(r['p'] == 'p3' for r in state['GROUP_DETAIL'].get(g['id'], {}).get('roster', [])))
        detail = copy.deepcopy(state['EVENT_DETAIL'])
        detail[event_id]['visibility'] = 'groups'
        detail[event_id]['visibleGroupIds'] = [other_group]
        self.patch('priest', 'EVENT_DETAIL', detail)
        _, saved = self.state()
        with server.connect() as c:
            leader_view = server.visible(c, self.users['leader'], 'p-elias', saved)
        self.assertNotIn(event_id, {e['id'] for e in leader_view['EVENTS']})
        self.assertNotIn(event_id, leader_view['EVENT_DETAIL'])
        self.assertEqual(leader_view['REG_FORM'], {})
        self.assertEqual(leader_view['CHECKIN']['rows'], [])
        self.assertFalse(any(not form.get('eventId') for form in leader_view['REGISTRATIONS']))
        self.assertFalse(any(not row.get('registrationId') or
                             row['registrationId'] not in {form['id'] for form in leader_view['REGISTRATIONS']}
                             for row in leader_view['REGISTRANTS']))

    def test_registration_requires_link_and_rejects_mass(self):
        _, state = self.state()
        forms = copy.deepcopy(state['REGISTRATIONS'])
        forms.append(dict(id='new-form',event='Test',eventAr='Test',eventId=None,cap=5,taken=0,fee=0,
                          deadline='2026-12-01',waiting=0,open=True,fields=[],discounts=[],installments=[]))
        with self.assertRaises(server.Problem):
            self.patch('secretary', 'REGISTRATIONS', forms)
        mass = next(e for e in state['EVENTS'] if e['kind'] == 'mass')
        forms[-1]['eventId'] = mass['id']
        with self.assertRaises(server.Problem):
            self.patch('secretary', 'REGISTRATIONS', forms)

    def test_hidden_event_hides_its_form_and_registrants(self):
        revision, state = self.state()
        event = next(event for event in state['EVENTS'] if event['kind'] == 'event')
        form = dict(id='visibility-form',eventId=event['id'],event=event['title'],eventAr=event['titleAr'],
                    cap=10,taken=1,fee=0,deadline='2026-12-01',waiting=0,open=True,
                    fields=[],discounts=[],installments=[])
        registrant = dict(id='visibility-registrant',registrationId=form['id'],p='p1',
                          paid=0,status='pending',consent=False,transport='own')
        with server.connect() as c:
            server.save_patch(c,self.users['secretary'],'p-elias',dict(revision=revision,changes={
                'REGISTRATIONS':state['REGISTRATIONS']+[form],
                'REGISTRANTS':state['REGISTRANTS']+[registrant]}))
        _, updated = self.state()
        other_group = next(g['id'] for g in updated['GROUPS'] if g.get('leader') != 'p3'
                           and not any(r['p'] == 'p3' for r in updated['GROUP_DETAIL'].get(g['id'], {}).get('roster', [])))
        detail = copy.deepcopy(updated['EVENT_DETAIL'])
        detail[event['id']]['visibility'] = 'groups'
        detail[event['id']]['visibleGroupIds'] = [other_group]
        self.patch('priest','EVENT_DETAIL',detail)
        with server.connect() as c:
            view = server.visible(c,self.users['leader'],'p-elias',self.state()[1])
        self.assertNotIn(event['id'],{item['id'] for item in view['EVENTS']})
        self.assertNotIn(form['id'],{item['id'] for item in view['REGISTRATIONS']})
        self.assertNotIn(registrant['id'],{item['id'] for item in view['REGISTRANTS']})

    def test_checkin_is_bound_to_registered_event_participants(self):
        revision, state = self.state()
        event = next(event for event in state['EVENTS'] if event['kind'] == 'event')
        form = dict(id='checkin-form',eventId=event['id'],event=event['title'],eventAr=event['titleAr'],
                    cap=10,taken=1,fee=0,deadline='2026-12-01',waiting=0,open=True,
                    fields=[],discounts=[],installments=[])
        participant = dict(id='checkin-registrant',registrationId=form['id'],p='p1',
                           paid=0,status='pending',consent=False,transport='own')
        with server.connect() as c:
            server.save_patch(c,self.users['secretary'],'p-elias',dict(revision=revision,changes={
                'REGISTRATIONS':state['REGISTRATIONS']+[form],
                'REGISTRANTS':state['REGISTRANTS']+[participant]}))
        _, saved = self.state()
        duplicate = dict(participant,id='duplicate-registrant')
        forms = copy.deepcopy(saved['REGISTRATIONS'])
        next(item for item in forms if item['id'] == form['id'])['taken'] = 2
        with server.connect() as c, self.assertRaises(server.Problem):
            server.save_patch(c,self.users['secretary'],'p-elias',dict(revision=self.state()[0],changes={
                'REGISTRATIONS':forms,'REGISTRANTS':saved['REGISTRANTS']+[duplicate]}))
        session = copy.deepcopy(saved['CHECKIN'])
        session['sessions'][event['id']] = dict(eventId=event['id'],rows=[dict(p='p1',**{'in':'09:00'},out=None)],
                                             present=1,expected=1,awaitingGuardian=0,room=event['venue'])
        self.patch('secretary','CHECKIN',session)
        self.assertEqual(self.state()[1]['CHECKIN']['sessions'][event['id']]['rows'][0]['p'],'p1')
        session['sessions'][event['id']]['rows'][0]['p'] = 'p2'
        with self.assertRaises(server.Problem):
            self.patch('secretary','CHECKIN',session)

    def test_address_cascade_must_match_verified_parent(self):
        _, state = self.state()
        extra = copy.deepcopy(state['PERSON_EXTRA'])
        extra[state['PEOPLE'][0]['id']]['address'] = dict(governorate='Mount Lebanon',district='Baabda',town='Hadath',sector='Invented')
        with self.assertRaises(server.Problem):
            self.patch('secretary', 'PERSON_EXTRA', extra)

    def test_permanent_delete_only_allows_unlinked_people(self):
        _, state = self.state()
        linked = state['PEOPLE'][0]
        with self.assertRaises(server.Problem):
            self.patch('priest', 'PEOPLE', [person for person in state['PEOPLE'] if person['id'] != linked['id']])
        fresh = dict(id='unlinked-test', lat='Unlinked Test', ar='اختبار', town='', townAr='',
                     rite='Maronite', status='member', phone='—', born='', hh=None, tags=[])
        self.patch('secretary', 'PEOPLE', state['PEOPLE'] + [fresh])
        revision, current = self.state()
        current['PERSON_EXTRA'].pop(fresh['id'], None)
        with server.connect() as c:
            server.save_patch(c, self.users['secretary'], 'p-elias', dict(revision=revision, changes={
                'PEOPLE': state['PEOPLE'], 'PERSON_EXTRA': current['PERSON_EXTRA']}))
        self.assertNotIn(fresh['id'], {person['id'] for person in self.state()[1]['PEOPLE']})


if __name__ == '__main__':
    unittest.main()
