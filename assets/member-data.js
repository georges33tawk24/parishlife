import { parishAPI } from './api.js';

export const M = { parish: {}, person: {}, groups: [], meetings: [], events: [], content: [], notes: [],
  commitments: {}, preferences: {}, concerns: [], review: [], complaintPermissions: [],
  profileRequests: [], volunteerReview: [], profileReview: [], managedGroups: [] };

export async function loadMember() {
  Object.assign(M, await parishAPI('member'));
  return M;
}

export const memberAction = (op, values = {}) => parishAPI('member', 'POST', { op, ...values });
