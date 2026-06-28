import { LambdaEvent, error, parseBody, getUserId, fromResult } from '../http';
import { avatarSvc } from '../container';

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/avatar'            && httpMethod === 'GET')  return fromResult(await avatarSvc.getAvatar(userId as never));
    if (path === '/avatar/upload-url' && httpMethod === 'GET') return fromResult(await avatarSvc.getAvatarUploadUrl(userId as never));
    if (path === '/avatar/generate'   && httpMethod === 'POST') {
      const { facePhotoKey } = body as { facePhotoKey?: string };
      if (!facePhotoKey) return error('facePhotoKey required');
      return fromResult(await avatarSvc.generateAvatar(userId as never, facePhotoKey), 201);
    }
    if (path === '/avatar/state'      && httpMethod === 'PUT') {
      const { bodyState } = body as { bodyState?: number };
      if (bodyState === undefined) return error('bodyState required');
      return fromResult(await avatarSvc.updateAvatarState(userId as never, bodyState));
    }
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
