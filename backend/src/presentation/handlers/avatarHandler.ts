import { LambdaEvent, error, parseBody, getUserId, toResponse } from '../http';
import { deps } from '../container';
import * as AvatarUseCases from '../../application/avatar/AvatarUseCases';

const avatarDeps = { avatarRepo: deps.avatarRepo, userRepo: deps.userRepo };

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/avatar'            && httpMethod === 'GET')   return toResponse(await AvatarUseCases.getAvatar(avatarDeps, userId));
    if (path === '/avatar/upload-url' && httpMethod === 'GET')  return toResponse(await AvatarUseCases.getAvatarUploadUrl(userId));
    if (path === '/avatar/generate'   && httpMethod === 'POST') {
      const { facePhotoKey } = body as { facePhotoKey?: string };
      if (!facePhotoKey) return error('facePhotoKey required');
      return toResponse(await AvatarUseCases.generateAvatar(avatarDeps, userId, facePhotoKey));
    }
    if (path === '/avatar/state'      && httpMethod === 'PUT')  {
      const { bodyState } = body as { bodyState?: number };
      if (bodyState === undefined) return error('bodyState required');
      return toResponse(await AvatarUseCases.updateAvatarState(avatarDeps, userId, bodyState));
    }
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
