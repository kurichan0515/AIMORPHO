const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'yasrun';

const clientConfig = { region: process.env.AWS_REGION || 'ap-northeast-1' };
if (process.env.DYNAMODB_ENDPOINT) {
  clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
  clientConfig.credentials = {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  };
}
const client = new DynamoDBClient(clientConfig);
const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const get = (pk, sk) =>
  db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: pk, SK: sk } }))
    .then(r => r.Item);

const put = (item) =>
  db.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

const update = (pk, sk, expression, names, values) =>
  db.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
    UpdateExpression: expression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  })).then(r => r.Attributes);

const remove = (pk, sk) =>
  db.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: pk, SK: sk } }));

const query = (params) =>
  db.send(new QueryCommand({ TableName: TABLE_NAME, ...params }))
    .then(r => r.Items ?? []);

// 翌日JST 0時のepoch秒 (TTL用)
const nextDayJSTEpoch = () => {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  jst.setDate(jst.getDate() + 1);
  jst.setHours(0, 0, 0, 0);
  return Math.floor(jst.getTime() / 1000);
};

module.exports = { db, TABLE_NAME, get, put, update, remove, query, nextDayJSTEpoch };
