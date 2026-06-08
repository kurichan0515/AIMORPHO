import 'dotenv/config';
import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { BADGE_DEFINITIONS } from '../src/domain/badge/Badge';

const TABLE    = process.env.DYNAMODB_TABLE   ?? 'yasrun';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const BUCKET   = process.env.S3_BUCKET         ?? 'yasrun-images';
const S3_EP    = process.env.S3_ENDPOINT        ?? 'http://localhost:4566';

const client = new DynamoDBClient({
  region: 'ap-northeast-1',
  endpoint: ENDPOINT,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const db = DynamoDBDocumentClient.from(client);

async function createTable(): Promise<void> {
  const { TableNames } = await client.send(new ListTablesCommand({}));
  if (TableNames?.includes(TABLE)) { console.log(`✅ テーブル "${TABLE}" 既存`); return; }

  await client.send(new CreateTableCommand({
    TableName:   TABLE,
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH'  },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK',     AttributeType: 'S' },
      { AttributeName: 'SK',     AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName:  'GSI1',
      KeySchema: [
        { AttributeName: 'GSI1PK', KeyType: 'HASH'  },
        { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'KEYS_ONLY' },
    }],
  }));
  console.log(`✅ テーブル "${TABLE}" 作成`);
}

async function seedBadges(): Promise<void> {
  for (const def of BADGE_DEFINITIONS) {
    await db.send(new PutCommand({
      TableName: TABLE,
      Item: { PK: `BADGE#${def.id}`, SK: 'META', ...def },
      ConditionExpression: 'attribute_not_exists(PK)',
    })).catch(() => {});
  }
  console.log(`✅ バッジ定義 ${BADGE_DEFINITIONS.length}件 シード完了`);
}

async function setupS3(): Promise<void> {
  const s3 = new S3Client({
    region: 'ap-northeast-1',
    endpoint: S3_EP,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    forcePathStyle: true,
  });
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log(`✅ S3バケット "${BUCKET}" 既存`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`✅ S3バケット "${BUCKET}" 作成`);
  }
}

(async () => {
  try {
    await createTable();
    await seedBadges();
    await setupS3();
    console.log('\n🚀 ローカルDB/S3セットアップ完了');
  } catch (err) {
    console.error('❌ セットアップ失敗:', (err as Error).message);
    process.exit(1);
  }
})();
