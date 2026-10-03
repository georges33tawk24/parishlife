import { parishAPI, session } from './api.js';

export const M = { parish: {}, person: {}, groups: [], meetings: [], events: [], content: [], notes: [],
  commitments: {}, preferences: {}, concerns: [], review: [], leaderConcerns: [], complaintPermissions: [],
  profileRequests: [], volunteerReview: [], profileReview: [], managedGroups: [], formation: [], reviewers: [], categories: [], notifications: [] };

export async function loadMember() {
  Object.assign(M, await parishAPI('member'));
  M.loadedFor = `${session.user?.id}:${session.parishId}`;
  return M;
}

export const memberAction = (op, values = {}) => parishAPI('member', 'POST', { op, ...values });
