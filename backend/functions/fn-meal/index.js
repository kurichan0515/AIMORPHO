const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { ok, error } = require('/opt/layer-auth');
const { put, query } = require('/opt/layer-db');
const { s3 } = require('/opt/layer-db/s3-client');
const { checkCountBadges } = require('/opt/layer-db/badge-service');
const { analyzeMeal } = require('/opt/layer-gemini');

const BUCKET = process.env.S3_BUCKET || 'yasrun-images';

exports.handler = async (event) => {
  const { httpMethod, path, body: rawBody, queryStringParameters, requestContext } = event;
  const userId = requestContext?.authorizer?.userId;
  if (!userId) return error('Unauthorized', 401);

  const body = rawBody ? JSON.parse(rawBody) : {};
  const qs = queryStringParameters || {};

  try {
    if (path === '/logs/meal/upload-url' && httpMethod === 'GET')  return getUploadUrl(userId);
    if (path === '/logs/meal'            && httpMethod === 'POST') return analyzeMealLog(userId, body);
    if (path === '/logs/meal'            && httpMethod === 'GET')  return getMealHistory(userId, qs);
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};

async function getUploadUrl(userId) {
  const key = `meals/${userId}/${Date.now()}.jpg`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: 'image/jpeg' }),
    { expiresIn: 300 }
  );
  return ok({ uploadUrl: url, s3Key: key });
}

async function analyzeMealLog(userId, { s3Key }) {
  if (!s3Key) return error('s3Key required');

  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  const chunks = [];
  for await (const chunk of obj.Body) chunks.push(chunk);
  const base64 = Buffer.concat(chunks).toString('base64');

  const result = await analyzeMeal(base64).catch(() => ({ error: 'analysis_failed' }));

  const now = new Date().toISOString();
  await put({
    PK: `USER#${userId}`,
    SK: `MEAL#${now}`,
    imageUrl: `https://${BUCKET}.s3.amazonaws.com/${s3Key}`,
    menuName: result.menu_name || '',
    kcal: result.kcal || 0,
    proteinG: result.protein_g || 0,
    fatG: result.fat_g || 0,
    carbG: result.carb_g || 0,
    confidence: result.confidence || 'low',
    geminiRaw: result.geminiRaw || '',
    recordedAt: now,
  });

  const mealLogs = await query({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'MEAL#' },
    Select: 'COUNT',
  });
  const newBadges = await checkCountBadges(userId, 'meal', mealLogs.length);

  return ok({ ...result, recordedAt: now, newBadges }, 201);
}

async function getMealHistory(userId, { from, to, limit = '30' }) {
  const items = await query({
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':from': `MEAL#${from || '1970'}`,
      ':to': `MEAL#${to || '9999'}`,
    },
    ScanIndexForward: false,
    Limit: parseInt(limit, 10),
  });
  return ok(items);
}
