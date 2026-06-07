'use strict';

/**
 * 統合テスト: DynamoDB Local が必要
 * 起動: docker compose up dynamodb-local -d
 * 実行: DYNAMODB_ENDPOINT=http://localhost:8000 JWT_SECRET=test-secret npm test -- --testPathPattern=integration
 */
const request = require('supertest');

// Layer パス解決
const Module = require('module');
const path   = require('path');
const layerRoot = path.resolve(__dirname, '../../layers');
const _orig = Module._resolveFilename.bind(Module);
Module._resolveFilename = (req, ...args) => {
  if (req.startsWith('/opt/layer-')) {
    const parts = req.replace('/opt/', '').split('/');
    const resolved = parts.length > 1
      ? path.join(layerRoot, parts[0], parts.slice(1).join('/'))
      : path.join(layerRoot, parts[0], 'index.js');
    return _orig(resolved, ...args);
  }
  return _orig(req, ...args);
};

process.env.DYNAMODB_TABLE    = 'yasrun-test';
process.env.DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
process.env.JWT_SECRET        = process.env.JWT_SECRET        || 'test-secret';
process.env.AWS_ACCESS_KEY_ID     = 'local';
process.env.AWS_SECRET_ACCESS_KEY = 'local';
process.env.AWS_REGION            = 'ap-northeast-1';
process.env.GEMINI_API_KEY        = '';

const { DynamoDBClient, CreateTableCommand, DeleteTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const dbClient = new DynamoDBClient({
  region: 'ap-northeast-1',
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

// テスト用テーブル作成/削除
beforeAll(async () => {
  const { TableNames } = await dbClient.send(new ListTablesCommand({}));
  if (!TableNames.includes('yasrun-test')) {
    await dbClient.send(new CreateTableCommand({
      TableName:   'yasrun-test',
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema:   [
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
  }
});

afterAll(async () => {
  await dbClient.send(new DeleteTableCommand({ TableName: 'yasrun-test' })).catch(() => {});
});

// Expressアプリをインポート
let app;
beforeAll(() => {
  // serverを直接インポートせずexpressだけ使う
  const express = require('express');
  const { wrap } = require('../local/lambda-adapter');
  const fnAuth   = require('../functions/fn-auth').handler;
  const fnUser   = require('../functions/fn-user').handler;

  app = express();
  app.use(express.json());
  app.post('/auth/register', wrap(fnAuth));
  app.post('/auth/login',    wrap(fnAuth));
  app.post('/auth/refresh',  wrap(fnAuth));
});

describe('POST /auth/register', () => {
  const email = `test+${Date.now()}@example.com`;

  test('新規登録 → 201 + tokens', async () => {
    const res = await request(app).post('/auth/register').send({ email, password: 'password123', displayName: 'テストユーザー' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.userId).toBeTruthy();
  });

  test('同一email再登録 → 409', async () => {
    const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
    expect(res.status).toBe(409);
  });

  test('emailなし → 400', async () => {
    const res = await request(app).post('/auth/register').send({ password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  const email    = `login+${Date.now()}@example.com`;
  const password = 'mypassword123';

  beforeAll(async () => {
    await request(app).post('/auth/register').send({ email, password });
  });

  test('正しい認証情報 → 200 + tokens', async () => {
    const res = await request(app).post('/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  test('間違いパスワード → 401', async () => {
    const res = await request(app).post('/auth/login').send({ email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('存在しないemail → 401', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'no@example.com', password });
    expect(res.status).toBe(401);
  });
});
