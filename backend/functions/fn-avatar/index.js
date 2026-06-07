const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { ok, error } = require('/opt/layer-auth');
const { get, put, update } = require('/opt/layer-db');
const { s3 } = require('/opt/layer-db/s3-client');
const { generateContent, GEMINI_VISION_MODEL } = require('/opt/layer-gemini');

const BUCKET = process.env.S3_BUCKET || 'yasrun-images';

exports.handler = async (event) => {
  const { httpMethod, path, body: rawBody, requestContext } = event;
  const userId = requestContext?.authorizer?.userId;
  if (!userId) return error('Unauthorized', 401);

  const body = rawBody ? JSON.parse(rawBody) : {};

  try {
    if (path === '/avatar/upload-url' && httpMethod === 'GET')  return getUploadUrl(userId);
    if (path === '/avatar/generate'   && httpMethod === 'POST') return generateAvatar(userId, body);
    if (path === '/avatar/state'      && httpMethod === 'PUT')  return updateAvatarState(userId, body);
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};

async function getUploadUrl(userId) {
  const key = `faces/${userId}/${Date.now()}.jpg`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: 'image/jpeg' }),
    { expiresIn: 300 }
  );
  return ok({ uploadUrl: url, s3Key: key });
}

// 顔写真 → アニメ風アバター5体 (bodyState 0-4) 一括生成
async function generateAvatar(userId, { facePhotoKey }) {
  if (!facePhotoKey) return error('facePhotoKey required');

  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: facePhotoKey }));
  const chunks = [];
  for await (const chunk of obj.Body) chunks.push(chunk);
  const base64Face = Buffer.concat(chunks).toString('base64');

  const bodyDescriptions = [
    '細身でスリムな体型（理想体型・目標達成）',
    '少しスリムな体型（やや改善）',
    '標準的な体型（中間）',
    '少し太めの体型（やや太り気味）',
    'ぽっちゃりした体型（最大ペナルティ）',
  ];

  const avatarImages = {};
  const errors = [];

  for (let i = 0; i < 5; i++) {
    try {
      const contents = [{
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: base64Face } },
          {
            text: `この顔写真の人物をベースにした、アニメ・漫画風のフルボディキャラクターを生成してください。
体型: ${bodyDescriptions[i]}
スタイル: 親しみやすいアニメ風、明るい色彩、白背景
サイズ: 縦長 (3:4比率)
このキャラクターの画像データをbase64で返してください。JSONのみで返答: { "image_base64": "...", "mime_type": "image/png" }`,
          },
        ],
        role: 'user',
      }];

      const raw = await generateContent(contents, GEMINI_VISION_MODEL);
      const text = raw.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const avatarKey = `avatars/${userId}/state_${i}.png`;
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: avatarKey,
        Body: Buffer.from(parsed.image_base64, 'base64'),
        ContentType: parsed.mime_type || 'image/png',
      }));
      avatarImages[i] = `https://${BUCKET}.s3.amazonaws.com/${avatarKey}`;
    } catch (e) {
      errors.push({ state: i, error: e.message });
      avatarImages[i] = null;
    }
  }

  const now = new Date().toISOString();
  const current = await get(`USER#${userId}`, 'AVATAR') || {};
  await put({
    PK: `USER#${userId}`,
    SK: 'AVATAR',
    facePhotoKey,
    avatarImages,
    bodyState: current.bodyState || 0,
    missedDays: current.missedDays || 0,
    bodyBalance: current.bodyBalance || null,
    regenerateCount: (current.regenerateCount || 0) + 1,
    updatedAt: now,
  });

  return ok({ avatarImages, errors: errors.length ? errors : undefined }, 201);
}

async function updateAvatarState(userId, { bodyState }) {
  if (bodyState === undefined || bodyState < 0 || bodyState > 4) {
    return error('bodyState must be 0-4');
  }
  const now = new Date().toISOString();
  const updated = await update(
    `USER#${userId}`, 'AVATAR',
    'SET bodyState = :bs, updatedAt = :now',
    undefined,
    { ':bs': bodyState, ':now': now }
  );
  return ok(updated);
}
