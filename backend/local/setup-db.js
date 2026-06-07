'use strict';

require('dotenv').config({ path: `${__dirname}/../.env.local` });

const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { BADGE_DEFINITIONS } = require('../layers/layer-db/badges');

const TABLE = process.env.DYNAMODB_TABLE || 'yasrun';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';

const client = new DynamoDBClient({
  region: 'ap-northeast-1',
  endpoint: ENDPOINT,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const db = DynamoDBDocumentClient.from(client);

async function createTable() {
  const { TableNames } = await client.send(new ListTablesCommand({}));
  if (TableNames.includes(TABLE)) {
    console.log(`✅ テーブル "${TABLE}" 既存`);
    return;
  }

  await client.send(new CreateTableCommand({
    TableName:            TABLE,
    BillingMode:          'PAY_PER_REQUEST',
    KeySchema:            [
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
      KeySchema:  [
        { AttributeName: 'GSI1PK', KeyType: 'HASH'  },
        { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'KEYS_ONLY' },
    }],
  }));
  console.log(`✅ テーブル "${TABLE}" 作成`);
}

async function seedBadges() {
  let count = 0;
  for (const def of BADGE_DEFINITIONS) {
    await db.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK:          `BADGE#${def.id}`,
        SK:          'META',
        badgeId:     def.id,
        name:        def.name,
        description: def.description,
        type:        def.type,
        threshold:   def.threshold,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    })).catch(() => {}); // 既存スキップ
    count++;
  }
  console.log(`✅ バッジ定義 ${count}件 シード完了`);
}

async function setupLocalstack() {
  const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
  const s3Endpoint = process.env.S3_ENDPOINT || 'http://localhost:4566';
  const bucket     = process.env.S3_BUCKET   || 'yasrun-images';

  const s3 = new S3Client({
    region: 'ap-northeast-1',
    endpoint: s3Endpoint,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    forcePathStyle: true,
  });

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`✅ S3バケット "${bucket}" 既存`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`✅ S3バケット "${bucket}" 作成`);
  }
}

(async () => {
  try {
    await createTable();
    await seedBadges();
    await setupLocalstack();
    console.log('\n🚀 ローカルDB/S3セットアップ完了');
  } catch (err) {
    console.error('❌ セットアップ失敗:', err.message);
    process.exit(1);
  }
})();
