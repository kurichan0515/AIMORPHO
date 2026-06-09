import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'aimorpho';

const clientConfig: ConstructorParameters<typeof DynamoDBClient>[0] = {
  region: process.env.AWS_REGION ?? 'ap-northeast-1',
};

if (process.env.DYNAMODB_ENDPOINT) {
  clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
  clientConfig.credentials = {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
  };
}

const raw = new DynamoDBClient(clientConfig);
export const db = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

export const nextDayJSTEpoch = (): number => {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  jst.setDate(jst.getDate() + 1);
  jst.setHours(0, 0, 0, 0);
  return Math.floor(jst.getTime() / 1000);
};

export const toJSTDate = (iso: string): string =>
  new Date(iso)
    .toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
    .replace(/\//g, '-')
    .split('-')
    .map(p => p.padStart(2, '0'))
    .join('-');
