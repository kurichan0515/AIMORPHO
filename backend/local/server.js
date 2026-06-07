'use strict';

require('dotenv').config({ path: `${__dirname}/../.env.local` });

// Layer を /opt/ から読めるよう require パスを解決
const Module = require('module');
const path   = require('path');
const layerRoot = path.resolve(__dirname, '../layers');
const _origResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = (req, ...args) => {
  if (req.startsWith('/opt/layer-')) {
    const parts = req.replace('/opt/', '').split('/');
    const layerName = parts[0];
    const rest      = parts.slice(1).join('/');
    const resolved  = rest
      ? path.join(layerRoot, layerName, rest)
      : path.join(layerRoot, layerName, 'index.js');
    return _origResolve(resolved, ...args);
  }
  return _origResolve(req, ...args);
};

const express    = require('express');
const { wrap }   = require('./lambda-adapter');
const { verifyToken } = require('../layers/layer-auth');

// Lambda ハンドラー
const fnAuth   = require('../functions/fn-auth').handler;
const fnUser   = require('../functions/fn-user').handler;
const fnLog    = require('../functions/fn-log').handler;
const fnMeal   = require('../functions/fn-meal').handler;
const fnAi     = require('../functions/fn-ai').handler;
const fnAvatar = require('../functions/fn-avatar').handler;
const fnSocial = require('../functions/fn-social').handler;

const app  = express();
app.use(express.json({ limit: '10mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// JWT 検証ミドルウェア
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = await verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// --- 認証不要 ---
app.post('/auth/register', wrap(fnAuth));
app.post('/auth/login',    wrap(fnAuth));
app.post('/auth/refresh',  wrap(fnAuth));
app.post('/auth/logout',   wrap(fnAuth));

// --- JWT必須 ---
app.get ('/users/me',         auth, wrap(fnUser));
app.put ('/users/me',         auth, wrap(fnUser));
app.get ('/users/me/goal',    auth, wrap(fnUser));
app.post('/users/me/goal',    auth, wrap(fnUser));
app.get ('/users/me/streak',  auth, wrap(fnUser));
app.get ('/users/me/badges',  auth, wrap(fnUser));

app.get ('/avatar/upload-url', auth, wrap(fnAvatar));
app.post('/avatar/generate',   auth, wrap(fnAvatar));
app.put ('/avatar/state',      auth, wrap(fnAvatar));

app.post('/logs/weight',        auth, wrap(fnLog));
app.get ('/logs/weight',        auth, wrap(fnLog));
app.get ('/logs/meal/upload-url', auth, wrap(fnMeal));
app.post('/logs/meal',          auth, wrap(fnMeal));
app.get ('/logs/meal',          auth, wrap(fnMeal));
app.post('/logs/exercise',      auth, wrap(fnLog));
app.get ('/logs/exercise',      auth, wrap(fnLog));

app.get ('/ai/daily-advice',  auth, wrap(fnAi));
app.post('/ai/penalty-event', auth, wrap(fnAi));
app.get ('/ai/goal-message',  auth, wrap(fnAi));

app.post  ('/groups',               auth, wrap(fnSocial));
app.post  ('/groups/join',          auth, wrap(fnSocial));
app.get   ('/groups/me',            auth, wrap(fnSocial));
app.get   ('/groups/:group_id',     auth, wrap(fnSocial));
app.get   ('/groups/:group_id/feed', auth, wrap(fnSocial));
app.delete('/groups/:group_id/leave', auth, wrap(fnSocial));

// ヘルスチェック
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`YASERUN local API: http://localhost:${PORT}`);
  console.log(`DynamoDB endpoint: ${process.env.DYNAMODB_ENDPOINT || '(AWS)'}`);
  console.log(`S3 endpoint:       ${process.env.S3_ENDPOINT || '(AWS)'}`);
  console.log(`Gemini API:        ${process.env.GEMINI_API_KEY ? 'enabled' : 'mock mode'}`);
});
