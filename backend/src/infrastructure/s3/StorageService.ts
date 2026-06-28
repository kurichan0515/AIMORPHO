import { IStorageService } from '../../domain/storage/IStorageService';
import {
  getUploadUrl,
  getLegalUploadUrl,
  getObjectBase64,
  getObjectText,
  putObject,
  publicUrl,
  BUCKET,
} from './S3Client';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from './S3Client';

export class StorageService implements IStorageService {
  async getMealUploadUrl(key: string): Promise<string> {
    return getUploadUrl(key);
  }

  async getAvatarUploadUrl(key: string): Promise<string> {
    return getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: 'image/jpeg' }), { expiresIn: 300 });
  }

  async getLegalUploadUrl(key: string): Promise<string> {
    return getLegalUploadUrl(key);
  }

  async getObjectBase64(key: string): Promise<string> {
    return getObjectBase64(key);
  }

  async getObjectText(key: string): Promise<string> {
    return getObjectText(key);
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    return putObject(key, body, contentType);
  }

  publicUrl(key: string): string {
    return publicUrl(key);
  }
}
