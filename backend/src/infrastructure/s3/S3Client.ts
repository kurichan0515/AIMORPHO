import { S3Client as AWSS3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const BUCKET = process.env.S3_BUCKET ?? 'yasrun-images';

export const s3 = new AWSS3Client({ region: process.env.AWS_REGION ?? 'ap-northeast-1' });

export const getUploadUrl = async (key: string): Promise<string> =>
  getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: 'image/jpeg' }), { expiresIn: 300 });

export const getObjectBase64 = async (key: string): Promise<string> => {
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  if (!obj.Body) throw new Error(`S3 key not found: ${key}`);
  for await (const chunk of obj.Body as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks).toString('base64');
};

export const putObject = async (key: string, body: Buffer, contentType: string): Promise<void> => {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
};

export const publicUrl = (key: string): string => `https://${BUCKET}.s3.amazonaws.com/${key}`;
