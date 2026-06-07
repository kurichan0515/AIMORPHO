const { verifyToken } = require('/opt/layer-auth');
const { get } = require('/opt/layer-db');

exports.handler = async (event) => {
  const token = event.authorizationToken?.replace('Bearer ', '');
  if (!token) return deny(event.methodArn);

  try {
    const payload = await verifyToken(token);
    const userId = payload.sub;

    // アクセストークンにjtiがある場合はブラックリスト確認不要 (RTのみ)
    return allow(userId, event.methodArn);
  } catch {
    return deny(event.methodArn);
  }
};

const allow = (userId, arn) => ({
  principalId: userId,
  policyDocument: {
    Version: '2012-10-17',
    Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: arn }],
  },
  context: { userId },
});

const deny = (arn) => ({
  principalId: 'unauthorized',
  policyDocument: {
    Version: '2012-10-17',
    Statement: [{ Action: 'execute-api:Invoke', Effect: 'Deny', Resource: arn }],
  },
});
