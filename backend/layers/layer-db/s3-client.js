const { S3Client } = require('@aws-sdk/client-s3');

const s3Config = {
  region: process.env.AWS_REGION || 'ap-northeast-1',
};
if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.credentials = {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  };
  s3Config.forcePathStyle = true; // LocalStackに必須
}

const s3 = new S3Client(s3Config);
module.exports = { s3 };
