locals {
  routes = {
    "POST /auth/register"                  = { fn = "fn-auth",         auth = false }
    "POST /auth/login"                     = { fn = "fn-auth",         auth = false }
    "POST /auth/refresh"                   = { fn = "fn-auth",         auth = false }
    "POST /auth/logout"                    = { fn = "fn-auth",         auth = false }
    "GET /users/me"                        = { fn = "fn-user",         auth = true  }
    "PUT /users/me"                        = { fn = "fn-user",         auth = true  }
    "DELETE /users/me"                     = { fn = "fn-user",         auth = true  }
    "PUT /users/me/fcm-token"              = { fn = "fn-user",         auth = true  }
    "GET /users/me/goal"                   = { fn = "fn-user",         auth = true  }
    "POST /users/me/goal"                  = { fn = "fn-user",         auth = true  }
    "GET /users/me/streak"                 = { fn = "fn-user",         auth = true  }
    "GET /users/me/badges"                 = { fn = "fn-user",         auth = true  }
    "GET /avatar"                          = { fn = "fn-avatar",       auth = true  }
    "GET /avatar/upload-url"              = { fn = "fn-avatar",       auth = true  }
    "POST /avatar/generate"               = { fn = "fn-avatar",       auth = true  }
    "PUT /avatar/state"                   = { fn = "fn-avatar",       auth = true  }
    "POST /logs/weight"                   = { fn = "fn-log",          auth = true  }
    "GET /logs/weight"                    = { fn = "fn-log",          auth = true  }
    "GET /logs/meal/upload-url"           = { fn = "fn-meal",         auth = true  }
    "POST /logs/meal"                     = { fn = "fn-meal",         auth = true  }
    "POST /logs/meal/confirm"             = { fn = "fn-meal",         auth = true  }
    "POST /logs/meal/manual"              = { fn = "fn-meal",         auth = true  }
    "GET /logs/meal"                      = { fn = "fn-meal",         auth = true  }
    "POST /logs/exercise"                 = { fn = "fn-log",          auth = true  }
    "GET /logs/exercise"                  = { fn = "fn-log",          auth = true  }
    "GET /ai/daily-advice"               = { fn = "fn-ai",           auth = true  }
    "POST /ai/penalty-event"             = { fn = "fn-ai",           auth = true  }
    "GET /ai/goal-message"               = { fn = "fn-ai",           auth = true  }
    "GET /ai/meal-suggestion"            = { fn = "fn-ai",           auth = true  }
    "GET /ai/exercise-suggestion"        = { fn = "fn-ai",           auth = true  }
    "POST /groups"                        = { fn = "fn-social",       auth = true  }
    "POST /groups/join"                   = { fn = "fn-social",       auth = true  }
    "GET /groups/me"                      = { fn = "fn-social",       auth = true  }
    "POST /subscriptions/verify/apple"    = { fn = "fn-subscription", auth = true  }
    "POST /subscriptions/verify/google"   = { fn = "fn-subscription", auth = true  }
    "POST /subscriptions/webhook/apple"   = { fn = "fn-subscription", auth = false }
    "POST /subscriptions/webhook/google"  = { fn = "fn-subscription", auth = false }
  }

  unique_functions = toset([for r in local.routes : r.fn])

  unique_paths = distinct([for route_key, _ in local.routes : "/${join("/", slice(split("/", route_key), 1, length(split("/", route_key))))}" ])

  openapi_paths = {
    for p in local.unique_paths : p => {
      for route_key, config in local.routes :
      lower(split(" ", route_key)[0]) => {
        security = config.auth ? [{ "jwt-authorizer" = [] }] : []
        responses = { "200" = { description = "OK" } }
        "x-amazon-apigateway-integration" = {
          uri                 = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arns[config.fn]}/invocations"
          httpMethod          = "POST"
          type                = "AWS_PROXY"
          passthroughBehavior = "WHEN_NO_MATCH"
        }
      }
      if "/${join("/", slice(split("/", route_key), 1, length(split("/", route_key))))}" == p
    }
  }
}

resource "aws_api_gateway_rest_api" "aimorpho" {
  name = "aimorpho-api-${var.environment}"

  body = jsonencode({
    openapi = "3.0.1"
    info    = { title = "AIMORPHO API", version = "1.0" }
    components = {
      securitySchemes = {
        "jwt-authorizer" = {
          type = "apiKey"
          name = "Authorization"
          in   = "header"
          "x-amazon-apigateway-authtype" = "custom"
          "x-amazon-apigateway-authorizer" = {
            type           = "token"
            authorizerUri  = var.authorizer_invoke_arn
            authorizerResultTtlInSeconds = 300
          }
        }
      }
    }
    paths = local.openapi_paths
  })

  tags = { Environment = var.environment, Project = "aimorpho" }
}

resource "aws_lambda_permission" "api_gw" {
  for_each = local.unique_functions

  statement_id  = "AllowAPIGatewayInvoke-${each.key}-${var.environment}"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions[each.key]
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.aimorpho.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "aimorpho" {
  rest_api_id = aws_api_gateway_rest_api.aimorpho.id

  triggers = {
    redeployment = sha1(aws_api_gateway_rest_api.aimorpho.body)
  }

  lifecycle { create_before_destroy = true }

  depends_on = [aws_lambda_permission.api_gw]
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.aimorpho.id
  rest_api_id   = aws_api_gateway_rest_api.aimorpho.id
  stage_name    = var.environment
  tags          = { Environment = var.environment, Project = "aimorpho" }
}
