/* Purpose: grouped permission checkboxes for office access. Ticking an area (People, Finance, …) ticks all
   its permissions; opening the area lets single permissions be unticked. Only permissions the parish
   controller may hand on are listed (grant administration and clergy authority are not delegable).
   Main members: PERMISSION_GROUPS and PermissionPicker (checkboxes named `allow`, read with FormData.getAll). */
import { useState } from 'react';
import { L } from './workspace-forms.jsx';

export const PERMISSION_GROUPS = [
  [
    L('People', 'الأشخاص'),
    [
      ['people.read', L('See people', 'رؤية الأشخاص')],
      ['people.write', L('Add and edit people', 'إضافة الأشخاص وتعديلهم')]
    ]
  ],
  [
    L('Requests and sacraments', 'الطلبات والأسرار'),
    [
      ['requests.manage', L('Handle requests', 'معالجة الطلبات')],
      ['sacraments.record', L('Record sacraments', 'تسجيل الأسرار')],
      ['documents.release', L('Release documents', 'تسليم الوثائق')]
    ]
  ],
  [
    L('Calendar and facilities', 'التقويم والمرافق'),
    [
      ['schedule.read', L('See the calendar', 'رؤية التقويم')],
      ['schedule.manage', L('Edit the calendar', 'تعديل التقويم')],
      ['schedule.publish', L('Publish the calendar', 'نشر التقويم')],
      ['facilities.manage', L('Manage facilities', 'إدارة المرافق')]
    ]
  ],
  [L('Ministries', 'الأخويات'), [['ministries.manage', L('Manage ministries', 'إدارة الأخويات')]]],
  [
    L('Registrations', 'التسجيلات'),
    [
      ['registrations.manage', L('Manage registrations', 'إدارة التسجيلات')],
      ['registrations.checkin', L('Check people in', 'تسجيل الحضور')]
    ]
  ],
  [
    L('Finance', 'المالية'),
    [
      ['finance.read', L('See finances', 'رؤية المالية')],
      ['finance.enter', L('Enter amounts', 'إدخال المبالغ')],
      ['finance.approve', L('Approve', 'الموافقة')],
      ['finance.post', L('Post to the books', 'الترحيل إلى الدفاتر')]
    ]
  ],
  [
    L('Communication', 'التواصل'),
    [
      ['communications.manage', L('Send messages', 'إرسال الرسائل')],
      ['publishing.manage', L('Edit the public page', 'تعديل الصفحة العامة')]
    ]
  ],
  [
    L('Administration', 'الإدارة'),
    [
      ['parish.manage', L('Parish details', 'تفاصيل الرعية')],
      ['settings.manage', L('Settings', 'الإعدادات')],
      ['billing.read', L('See billing', 'رؤية الفوترة')],
      ['billing.manage', L('Manage billing', 'إدارة الفوترة')],
      ['reports.read', L('Reports', 'التقارير')],
      ['audit.read', L('Audit history', 'سجل التدقيق')],
      ['imports.manage', L('Imports', 'الاستيراد')],
      ['exports.manage', L('Exports', 'التصدير')],
      ['workflows.manage', L('Workflows', 'سير العمل')]
    ]
  ]
];

export function PermissionPicker() {
  const [chosen, setChosen] = useState(() => new Set());
  const toggle = (keys, on) =>
    setChosen(prev => {
      const next = new Set(prev);
      keys.forEach(k => (on ? next.add(k) : next.delete(k)));
      return next;
    });
  return (
    <fieldset className="perm-picker">
      <legend className="label">{L('What this person may do', 'ما يمكن لهذا الشخص فعله')}</legend>
      {PERMISSION_GROUPS.map(([title, items]) => {
        const keys = items.map(([k]) => k);
        const count = keys.filter(k => chosen.has(k)).length;
        return (
          <details key={title} className="perm-group">
            <summary>
              <label className="check" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={count === keys.length}
                  ref={el => el && (el.indeterminate = count > 0 && count < keys.length)}
                  onChange={e => toggle(keys, e.target.checked)}
                />
                {title}
              </label>
              <span className="help">
                {count}/{keys.length}
              </span>
            </summary>
            {items.map(([key, label]) => (
              <label key={key} className="check perm-item">
                <input
                  type="checkbox"
                  name="allow"
                  value={key}
                  checked={chosen.has(key)}
                  onChange={e => toggle([key], e.target.checked)}
                />
                {label}
              </label>
            ))}
          </details>
        );
      })}
    </fieldset>
  );
}
