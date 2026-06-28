terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "aimorpho-tfstate"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "aimorpho-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

module "dynamodb" {
  source     = "./modules/dynamodb"
  table_name = var.dynamodb_table_name
  environment = var.environment
}

module "s3" {
  source      = "./modules/s3"
  bucket_name = var.s3_bucket_name
  environment = var.environment
}

module "iam" {
  source              = "./modules/iam"
  environment         = var.environment
  dynamodb_table_arn  = module.dynamodb.table_arn
  s3_bucket_arn       = module.s3.bucket_arn
  lambda_code_bucket_arn = module.s3.lambda_code_bucket_arn
}

module "secrets" {
  source         = "./modules/secrets"
  environment    = var.environment
  jwt_secret     = var.jwt_secret
  gemini_api_key = var.gemini_api_key
  apple_iap      = var.apple_iap
  google_play    = var.google_play
}

module "lambda" {
  source              = "./modules/lambda"
  environment         = var.environment
  lambda_role_arn     = module.iam.lambda_role_arn
  s3_bucket_name      = module.s3.lambda_code_bucket
  s3_images_bucket    = var.s3_bucket_name
  dynamodb_table      = var.dynamodb_table_name
  aws_region          = var.aws_region

  depends_on = [module.iam, module.dynamodb, module.s3, module.secrets]
}

module "api_gateway" {
  source                = "./modules/api_gateway"
  environment           = var.environment
  aws_region            = var.aws_region
  lambda_functions      = module.lambda.function_arns
  lambda_invoke_arns    = module.lambda.function_invoke_arns
  authorizer_invoke_arn = module.lambda.authorizer_invoke_arn

  depends_on = [module.lambda]
}
