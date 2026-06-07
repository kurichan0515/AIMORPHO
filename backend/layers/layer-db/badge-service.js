const { get, put, query } = require('./index');
const { BADGE_DEFINITIONS } = require('./badges');

// バッジ付与（未取得なら付与）
async function awardBadge(userId, badgeId) {
  const existing = await get(`USER#${userId}`, `BADGE#${badgeId}`);
  if (existing) return null;

  const def = BADGE_DEFINITIONS.find(b => b.id === badgeId);
  if (!def) return null;

  const now = new Date().toISOString();
  const item = {
    PK: `USER#${userId}`,
    SK: `BADGE#${badgeId}`,
    badgeId,
    name: def.name,
    description: def.description,
    earnedAt: now,
    GSI1PK: `BADGE#${badgeId}`,
    GSI1SK: `USER#${userId}`,
  };
  await put(item);
  return item;
}

// ストリーク数に応じたバッジチェック
async function checkStreakBadges(userId, currentDays) {
  const newBadges = [];
  for (const def of BADGE_DEFINITIONS.filter(b => b.type === 'streak')) {
    if (currentDays >= def.threshold) {
      const awarded = await awardBadge(userId, def.id);
      if (awarded) newBadges.push(awarded);
    }
  }
  return newBadges;
}

// 記録件数に応じたバッジチェック
async function checkCountBadges(userId, type, count) {
  const newBadges = [];
  for (const def of BADGE_DEFINITIONS.filter(b => b.type === type)) {
    if (count >= def.threshold) {
      const awarded = await awardBadge(userId, def.id);
      if (awarded) newBadges.push(awarded);
    }
  }
  return newBadges;
}

// 記録件数をDynamoDBから取得して計算
async function countRecords(userId, prefix) {
  const items = await query({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': prefix },
    Select: 'COUNT',
  });
  return items.length;
}

module.exports = { awardBadge, checkStreakBadges, checkCountBadges, countRecords };
