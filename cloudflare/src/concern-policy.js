/* Domain constants have no service imports, avoiding authorization import cycles. */
export const CONCERN_CATEGORIES = ['Ministry activities', 'Leadership', 'Meetings', 'Events', 'Facilities',
  'Behaviour or conduct', 'Safety', 'Communication', 'Financial concerns',
  'Harassment or inappropriate behaviour', 'Administrative issues', 'Suggestions', 'Other'];
export const CONCERN_STATUSES = new Set(['Submitted', 'Under Review', 'Additional Information Requested', 'Referred', 'Resolved', 'Closed']);
