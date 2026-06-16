import { LambdaEvent, error } from '../http';
import { LegalRepository, LegalFile } from '../../infrastructure/dynamodb/LegalRepository';
import { getObjectText } from '../../infrastructure/s3/S3Client';

const legalRepo = new LegalRepository();

const serveFile = async (file: LegalFile) => {
  const config = await legalRepo.get(file);
  if (!config) return error('Not found', 404);
  const html = await getObjectText(config.currentKey);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
};

export const handler = async (event: LambdaEvent) => {
  const { path } = event;
  try {
    if (path === '/legal/terms')   return serveFile('terms');
    if (path === '/legal/privacy') return serveFile('privacy');
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
