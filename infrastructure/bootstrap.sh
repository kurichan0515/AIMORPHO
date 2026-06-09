#!/usr/bin/env bash
# Run once before the first `terraform init`.
# Creates the S3 bucket and DynamoDB table used as Terraform remote state backend.
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-1}"
STATE_BUCKET="aimorpho-tfstate"
LOCK_TABLE="aimorpho-tflock"

echo "Creating Terraform state bucket: $STATE_BUCKET"
if aws s3api head-bucket --bucket "$STATE_BUCKET" --region "$REGION" 2>/dev/null; then
  echo "  already exists, skipping"
else
  aws s3api create-bucket \
    --bucket "$STATE_BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
  aws s3api put-bucket-versioning \
    --bucket "$STATE_BUCKET" \
    --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption \
    --bucket "$STATE_BUCKET" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  echo "  created"
fi

echo "Creating Terraform lock table: $LOCK_TABLE"
if aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "$REGION" 2>/dev/null; then
  echo "  already exists, skipping"
else
  aws dynamodb create-table \
    --table-name "$LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  echo "  created"
fi

echo "Bootstrap complete. Run 'terraform init' next."
