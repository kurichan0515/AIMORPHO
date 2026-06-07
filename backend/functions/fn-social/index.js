const { v4: uuidv4 } = require('uuid');
const { ok, error } = require('/opt/layer-auth');
const { get, put, remove, query } = require('/opt/layer-db');

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'yasrun';

exports.handler = async (event) => {
  const { httpMethod, path, pathParameters, body: rawBody, requestContext } = event;
  const userId = requestContext?.authorizer?.userId;
  if (!userId) return error('Unauthorized', 401);

  const body = rawBody ? JSON.parse(rawBody) : {};
  const groupId = pathParameters?.group_id;

  try {
    if (path === '/groups'                         && httpMethod === 'POST')   return createGroup(userId, body);
    if (path === '/groups/join'                    && httpMethod === 'POST')   return joinGroup(userId, body);
    if (path === `/groups/${groupId}`              && httpMethod === 'GET')    return getGroup(userId, groupId);
    if (path === `/groups/${groupId}/feed`         && httpMethod === 'GET')    return getGroupFeed(userId, groupId);
    if (path === `/groups/${groupId}/leave`        && httpMethod === 'DELETE') return leaveGroup(userId, groupId);
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};

async function createGroup(userId, { name }) {
  if (!name) return error('name required');

  const groupId = uuidv4();
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = new Date().toISOString();

  await Promise.all([
    put({
      PK: `GROUP#${groupId}`,
      SK: 'META',
      name,
      createdBy: userId,
      inviteCode,
      createdAt: now,
      GSI1PK: `INVITE#${inviteCode}`,
      GSI1SK: `GROUP#${groupId}`,
    }),
    put({
      PK: `GROUP#${groupId}`,
      SK: `MEMBER#${userId}`,
      role: 'owner',
      joinedAt: now,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `GROUP#${groupId}`,
    }),
  ]);

  return ok({ groupId, inviteCode, name }, 201);
}

async function joinGroup(userId, { inviteCode }) {
  if (!inviteCode) return error('inviteCode required');

  const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const res = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :inv',
    ExpressionAttributeValues: { ':inv': `INVITE#${inviteCode}` },
  }));

  const group = res.Items?.[0];
  if (!group) return error('Invalid invite code', 404);

  const groupId = group.PK.replace('GROUP#', '');
  const existing = await get(`GROUP#${groupId}`, `MEMBER#${userId}`);
  if (existing) return error('Already a member', 409);

  const now = new Date().toISOString();
  await put({
    PK: `GROUP#${groupId}`,
    SK: `MEMBER#${userId}`,
    role: 'member',
    joinedAt: now,
    GSI1PK: `USER#${userId}`,
    GSI1SK: `GROUP#${groupId}`,
  });

  return ok({ groupId, groupName: group.name, joinedAt: now });
}

async function getGroup(userId, groupId) {
  const [meta, members] = await Promise.all([
    get(`GROUP#${groupId}`, 'META'),
    query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `GROUP#${groupId}`, ':prefix': 'MEMBER#' },
    }),
  ]);
  if (!meta) return error('Group not found', 404);

  const isMember = members.some(m => m.SK === `MEMBER#${userId}`);
  if (!isMember) return error('Forbidden', 403);

  return ok({ ...meta, members });
}

async function getGroupFeed(userId, groupId) {
  const member = await get(`GROUP#${groupId}`, `MEMBER#${userId}`);
  if (!member) return error('Forbidden', 403);

  const members = await query({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `GROUP#${groupId}`, ':prefix': 'MEMBER#' },
  });

  const feedItems = await Promise.all(
    members.map(async (m) => {
      const uid = m.SK.replace('MEMBER#', '');
      const [profile, streak, badges] = await Promise.all([
        get(`USER#${uid}`, 'PROFILE'),
        get(`USER#${uid}`, 'STREAK'),
        query({
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': `USER#${uid}`, ':prefix': 'BADGE#' },
        }),
      ]);
      return {
        userId: uid,
        displayName: profile?.displayName || '',
        currentDays: streak?.currentDays || 0,
        badgeCount: badges.length,
      };
    })
  );

  return ok(feedItems.sort((a, b) => b.currentDays - a.currentDays));
}

async function leaveGroup(userId, groupId) {
  const member = await get(`GROUP#${groupId}`, `MEMBER#${userId}`);
  if (!member) return error('Not a member', 404);

  await remove(`GROUP#${groupId}`, `MEMBER#${userId}`);
  return ok({ message: 'left group' });
}
