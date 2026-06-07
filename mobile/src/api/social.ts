import api from './client';

export const createGroup = (name: string) =>
  api.post('/groups', { name }).then(r => r.data);

export const joinGroup = (inviteCode: string) =>
  api.post('/groups/join', { inviteCode }).then(r => r.data);

export const getGroup = (groupId: string) =>
  api.get(`/groups/${groupId}`).then(r => r.data);

export const getGroupFeed = (groupId: string) =>
  api.get(`/groups/${groupId}/feed`).then(r => r.data);

export const leaveGroup = (groupId: string) =>
  api.delete(`/groups/${groupId}/leave`).then(r => r.data);

export const getMyGroups = () =>
  api.get('/groups/me').then(r => r.data);
