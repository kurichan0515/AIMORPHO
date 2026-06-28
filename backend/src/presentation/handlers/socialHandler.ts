import { LambdaEvent, error, parseBody, getUserId, fromResult } from '../http';
import { socialSvc } from '../container';

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path, pathParameters } = event;
  const body = parseBody(event.body);
  const groupId = pathParameters?.group_id ?? '';

  try {
    if (path === '/groups'               && httpMethod === 'POST') {
      const { name } = body as { name?: string };
      if (!name) return error('name required');
      return fromResult(await socialSvc.createGroup(userId as never, name), 201);
    }
    if (path === '/groups/join'          && httpMethod === 'POST') {
      const { inviteCode } = body as { inviteCode?: string };
      if (!inviteCode) return error('inviteCode required');
      return fromResult(await socialSvc.joinGroup(userId as never, inviteCode));
    }
    if (path === '/groups/me'            && httpMethod === 'GET')  return fromResult(await socialSvc.getMyGroups(userId as never));
    if (groupId && path === `/groups/${groupId}`       && httpMethod === 'GET')    return fromResult(await socialSvc.getGroup(userId as never, groupId));
    if (groupId && path === `/groups/${groupId}/feed`  && httpMethod === 'GET')    return fromResult(await socialSvc.getGroupFeed(userId as never, groupId));
    if (groupId && path === `/groups/${groupId}/leave` && httpMethod === 'DELETE') return fromResult(await socialSvc.leaveGroup(userId as never, groupId));
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
