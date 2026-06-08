import { LambdaEvent, error, parseBody, getUserId, toResponse } from '../http';
import { deps } from '../container';
import * as SocialUseCases from '../../application/social/SocialUseCases';

const socialDeps = { groupRepo: deps.groupRepo, userRepo: deps.userRepo, badgeRepo: deps.badgeRepo };

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
      return toResponse(await SocialUseCases.createGroup(socialDeps, userId, name));
    }
    if (path === '/groups/join'          && httpMethod === 'POST') {
      const { inviteCode } = body as { inviteCode?: string };
      if (!inviteCode) return error('inviteCode required');
      return toResponse(await SocialUseCases.joinGroup(socialDeps, userId, inviteCode));
    }
    if (path === '/groups/me'            && httpMethod === 'GET')  return toResponse(await SocialUseCases.getMyGroups(socialDeps, userId));
    if (groupId && path === `/groups/${groupId}`       && httpMethod === 'GET')    return toResponse(await SocialUseCases.getGroup(socialDeps, userId, groupId));
    if (groupId && path === `/groups/${groupId}/feed`  && httpMethod === 'GET')    return toResponse(await SocialUseCases.getGroupFeed(socialDeps, userId, groupId));
    if (groupId && path === `/groups/${groupId}/leave` && httpMethod === 'DELETE') return toResponse(await SocialUseCases.leaveGroup(socialDeps, userId, groupId));
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
