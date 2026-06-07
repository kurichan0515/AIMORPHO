const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

let _jwtSecret = null;

const getJwtSecret = async () => {
  if (_jwtSecret) return _jwtSecret;
  if (process.env.JWT_SECRET) {
    _jwtSecret = process.env.JWT_SECRET;
    return _jwtSecret;
  }
  const r = await sm.send(new GetSecretValueCommand({ SecretId: 'yasrun/jwt-secret' }));
  _jwtSecret = JSON.parse(r.SecretString).JWT_SECRET;
  return _jwtSecret;
};

const signTokens = async (userId) => {
  const secret = await getJwtSecret();
  const jti = require('crypto').randomUUID();
  const accessToken = jwt.sign({ sub: userId }, secret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ sub: userId, jti }, secret, { expiresIn: '30d' });
  return { accessToken, refreshToken, jti };
};

const verifyToken = async (token) => {
  const secret = await getJwtSecret();
  return jwt.verify(token, secret);
};

const hashPassword = (password) => bcrypt.hash(password, 12);
const comparePassword = (password, hash) => bcrypt.compare(password, hash);

const ok = (body, statusCode = 200) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const error = (message, statusCode = 400) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message }),
});

module.exports = { signTokens, verifyToken, hashPassword, comparePassword, ok, error };
