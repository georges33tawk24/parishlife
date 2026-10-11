import { parishAPI, session } from './api.js';

export const M = { parish: {}, person: {}, site: {}, groups: [], meetings: [], events: [], content: [], notes: [], todos: [],
  commitments: {}, preferences: {}, concerns: [], review: [], leaderConcerns: [], complaintPermissions: [],
  profileRequests: [], volunteerReview: [], profileReview: [], managedGroups: [], formation: [], reviewers: [], categories: [], notifications: [],
  requests: [], requestOptions: { subjects: [], preparation: {}, phone: '' } };

export async function loadMember() {
  Object.assign(M, await parishAPI('member'));
  M.loadedFor = `${session.user?.id}:${session.parishId}`;
  return M;
}

export const memberAction = (op, values = {}) => parishAPI('member', 'POST', { op, ...values });
