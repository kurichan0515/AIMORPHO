'use strict';

// Express req/res → Lambda event/response 変換アダプター

const toEvent = (req, userId = null) => ({
  httpMethod:            req.method,
  path:                  req.path,
  pathParameters:        req.params,
  queryStringParameters: Object.keys(req.query).length ? req.query : null,
  headers:               req.headers,
  body:                  req.body ? JSON.stringify(req.body) : null,
  requestContext: {
    authorizer: userId ? { userId } : {},
  },
});

// Lambda responseをExpressに流す
const fromResponse = (lambdaRes, res) => {
  const status = lambdaRes.statusCode || 200;
  const body   = lambdaRes.body ? JSON.parse(lambdaRes.body) : {};
  res.status(status).json(body);
};

// Lambdaハンドラーをexpress middlewareに変換 (JWT検証済みのuserIdをinjectする)
const wrap = (handler) => async (req, res) => {
  try {
    const userId   = req.userId || null;
    const event    = toEvent(req, userId);
    const result   = await handler(event);
    fromResponse(result, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { wrap };
