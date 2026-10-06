"""Focused checks for confidential pastoral records and parish-scoped state."""
import copy
import json
import unittest
from pathlib import Path

from server import Problem, migrate_state, validate, writable


SEED = Path(__file__).with_name('seed.json')


class PastoralStateTests(unittest.TestCase):
    def setUp(self):
        self.state = migrate_state(copy.deepcopy(json.loads(SEED.read_text(encoding='utf-8'))))

    def test_legacy_notes_are_migrated_without_losing_content(self):
        note = self.state['NOTES'][0]
        self.assertEqual(note['kind'], 'note')
        self.assertTrue(note['body'])
        self.assertFalse(note['pinned'])
        validate(self.state)

    def test_general_follow_up_task_needs_no_person(self):
        self.state['NOTES'].append(dict(id='test-task', kind='task', p=None, at='2026-09-28',
                                        body='Call the parish council', bodyAr='Call the parish council',
                                        priority='attention', pinned=True, done=False, due='2026-10-01'))
        validate(self.state)

    def test_note_cannot_be_saved_without_a_person(self):
        self.state['NOTES'].append(dict(id='test-note', kind='note', p=None, at='2026-09-28',
                                        body='Private note', bodyAr='Private note', priority='ordinary',
                                        pinned=False, done=False, due=''))
        with self.assertRaises(Problem):
            validate(self.state)

    def test_non_clergy_cannot_write_pastoral_items(self):
        self.assertTrue(writable('priest', 'NOTES'))
        for role in ('bishop', 'secretary', 'treasurer', 'leader', 'member'):
            self.assertFalse(writable(role, 'NOTES'))

    def test_attendance_cannot_reference_a_person_outside_the_parish(self):
        meeting = self.state['GROUP_DETAIL']['g1']['meetings'][0]
        meeting['attendance']['another-parish-person'] = 'present'
        with self.assertRaises(Problem):
            validate(self.state)

    def test_existing_template_tuples_migrate_to_persisted_records(self):
        self.state['EVENT_TEMPLATES'] = [['Visit', 'زيارة', 'events']]
        self.state['SERVICE_TEMPLATES'] = [['Sunday Mass', 'قداس الأحد', 10]]
        self.state.pop('SERVICE_PLANS')
        migrated = migrate_state(self.state)
        self.assertEqual(migrated['EVENT_TEMPLATES'][0]['name'], 'Visit')
        self.assertIsInstance(migrated['SERVICE_TEMPLATES'][0]['order'], list)
        self.assertEqual(migrated['SERVICE_PLANS'], [])
        validate(migrated)

    def test_template_and_plan_writes_follow_office_roles(self):
        for key in ('EVENT_TEMPLATES', 'SERVICE_TEMPLATES', 'SERVICE_PLANS'):
            self.assertTrue(writable('priest', key))
            self.assertTrue(writable('secretary', key))
            self.assertFalse(writable('leader', key))


if __name__ == '__main__':
    unittest.main()
