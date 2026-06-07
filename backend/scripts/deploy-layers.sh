#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-1}"
BUCKET="${S3_BUCKET_CODE:-yasrun-lambda-code}"
ENV="${ENVIRONMENT:-prod}"
LAYERS_DIR="$(dirname "$0")/../layers"

for layer in layer-db layer-auth layer-gemini; do
  echo "📦 Building $layer..."
  TMP=$(mktemp -d)
  cp -r "$LAYERS_DIR/$layer/." "$TMP/"
  cd "$TMP" && npm ci --omit=dev --silent
  ZIP="/tmp/${layer}.zip"
  zip -r "$ZIP" . -x "*.zip" > /dev/null
  echo "⬆️  Uploading $layer to s3://$BUCKET/layers/${layer}.zip"
  aws s3 cp "$ZIP" "s3://$BUCKET/layers/${layer}.zip"
  echo "🔄 Publishing Lambda Layer: yasrun-${layer}-${ENV}"
  aws lambda publish-layer-version \
    --layer-name "yasrun-${layer}-${ENV}" \
    --content "S3Bucket=$BUCKET,S3Key=layers/${layer}.zip" \
    --compatible-runtimes nodejs20.x \
    --region "$REGION"
  rm -rf "$TMP" "$ZIP"
  cd - > /dev/null
  echo "✅ $layer done"
done
