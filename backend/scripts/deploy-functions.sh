#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-1}"
BUCKET="${S3_BUCKET_CODE:-aimorpho-lambda-code}"
ENV="${ENVIRONMENT:-prod}"
FUNCTIONS_DIR="$(dirname "$0")/../functions"

FUNCTIONS=(fn-auth fn-user fn-log fn-meal fn-ai fn-avatar fn-social authorizer)

deploy_function() {
  local fn=$1
  echo "📦 Building $fn..."
  TMP=$(mktemp -d)
  cp -r "$FUNCTIONS_DIR/$fn/." "$TMP/"
  cd "$TMP"
  if [ -f package.json ]; then
    npm ci --omit=dev --silent
  fi
  ZIP="/tmp/${fn}.zip"
  zip -r "$ZIP" . -x "*.zip" "node_modules/.cache/*" > /dev/null
  echo "⬆️  Uploading $fn to s3://$BUCKET/functions/${fn}.zip"
  aws s3 cp "$ZIP" "s3://$BUCKET/functions/${fn}.zip"
  echo "🔄 Updating function: aimorpho-${fn}-${ENV}"
  aws lambda update-function-code \
    --function-name "aimorpho-${fn}-${ENV}" \
    --s3-bucket "$BUCKET" \
    --s3-key "functions/${fn}.zip" \
    --region "$REGION" \
    --no-cli-pager
  rm -rf "$TMP" "$ZIP"
  cd - > /dev/null
  echo "✅ $fn done"
}

export -f deploy_function
export REGION BUCKET ENV FUNCTIONS_DIR

# 並列デプロイ (最大4並列)
printf '%s\n' "${FUNCTIONS[@]}" | xargs -P 4 -I{} bash -c 'deploy_function "$@"' _ {}
echo "🚀 All functions deployed"
