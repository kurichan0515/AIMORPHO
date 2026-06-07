import api from './client';
import { uploadImageToS3 } from './logs';

export const getAvatarUploadUrl = () =>
  api.get('/avatar/upload-url').then(r => r.data as { uploadUrl: string; s3Key: string });

export const generateAvatar = async (imageUri: string) => {
  const { uploadUrl, s3Key } = await getAvatarUploadUrl();
  await uploadImageToS3(uploadUrl, imageUri);
  return api.post('/avatar/generate', { facePhotoKey: s3Key }).then(r => r.data);
};

export const updateAvatarState = (bodyState: number) =>
  api.put('/avatar/state', { bodyState }).then(r => r.data);
