locals {
  functions = {
    fn-auth    = { memory = 128, timeout = 5,  provisioned = false }
    fn-user    = { memory = 128, timeout = 10, provisioned = false }
    fn-log     = { memory = 256, timeout = 15, provisioned = false }
    fn-meal    = { memory = 512, timeout = 30, provisioned = true  }
    fn-ai      = { memory = 512, timeout = 30, provisioned = true  }
    fn-avatar  = { memory = 512, timeout = 90, provisioned = true  }
    fn-social  = { memory = 128, timeout = 10, provisioned = false }
    authorizer = { memory = 128, timeout = 5,  provisioned = false }
  }
  layers = ["layer-db", "layer-auth", "layer-gemini"]
  common_env = {
    DYNAMODB_TABLE = var.dynamodb_table
    S3_BUCKET      = var.s3_bucket_name
    AWS_REGION_ENV = var.aws_region
  }
}

resource "aws_lambda_layer_version" "layers" {
  for_each            = toset(local.layers)
  layer_name          = "yasrun-${each.key}-${var.environment}"
  s3_bucket           = var.s3_bucket_name
  s3_key              = "lambda-code/${each.key}.zip"
  compatible_runtimes = ["nodejs20.x"]
}

resource "aws_lambda_function" "functions" {
  for_each = local.functions

  function_name = "yasrun-${each.key}-${var.environment}"
  role          = var.lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  memory_size   = each.value.memory
  timeout       = each.value.timeout
  s3_bucket     = var.s3_bucket_name
  s3_key        = "lambda-code/${each.key}.zip"

  layers = [
    aws_lambda_layer_version.layers["layer-db"].arn,
    aws_lambda_layer_version.layers["layer-auth"].arn,
    aws_lambda_layer_version.layers["layer-gemini"].arn,
  ]

  environment {
    variables = local.common_env
  }

  tags = { Environment = var.environment, Project = "yasrun" }
}

resource "aws_lambda_provisioned_concurrency_config" "provisioned" {
  for_each = { for k, v in local.functions : k => v if v.provisioned }

  function_name                  = aws_lambda_function.functions[each.key].function_name
  qualifier                      = aws_lambda_function.functions[each.key].version
  provisioned_concurrent_executions = 2
}

resource "aws_cloudwatch_log_group" "functions" {
  for_each          = local.functions
  name              = "/aws/lambda/yasrun-${each.key}-${var.environment}"
  retention_in_days = 14
  tags              = { Environment = var.environment, Project = "yasrun" }
}
